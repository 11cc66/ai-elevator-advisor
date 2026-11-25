import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import {
  BuildIntegrityError,
  executeGuardedBuild,
  generateSignedReleaseManifest,
  runBuildSecurityPreflight,
  validateSigningPrivateKeyPath,
} from "@elevator/build-integrity";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(scriptDirectory, "..");
const workspaceRoot = path.resolve(appDirectory, "../..");
const require = createRequire(import.meta.url);
const SAFE_BUILD_ERROR_CODES = new Set([
  "Missing required build configuration",
  "P13_RELEASE_ID_INVALID",
  "P13_WORKER_RELEASE_ROOT_ALREADY_EXISTS",
  "GIT_IDENTITY_UNAVAILABLE",
  "WORKER_BUILD_FAILED",
]);

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required build configuration: ${name}`);
  }
  return value;
}

function gitValue(args: string[]): string {
  const programFiles = process.env.ProgramFiles;
  const windowsGit =
    process.platform === "win32" && programFiles
      ? path.join(programFiles, "Git", "cmd", "git.exe")
      : undefined;
  const gitExecutable =
    windowsGit && existsSync(windowsGit) ? windowsGit : "git";
  const result = spawnSync(
    gitExecutable,
    ["-c", `safe.directory=${workspaceRoot}`, ...args],
    {
      cwd: workspaceRoot,
      encoding: "utf8",
      windowsHide: true,
    },
  );
  if (result.status !== 0) {
    const spawnErrorCode =
      result.error &&
      "code" in result.error &&
      typeof result.error.code === "string"
        ? result.error.code
        : "NO_ERROR";
    throw new Error(
      `GIT_IDENTITY_UNAVAILABLE:${args[0]}:${result.status}:${spawnErrorCode}`,
    );
  }
  return result.stdout.trim();
}

async function main(): Promise<void> {
  const releaseId = required("P13_RELEASE_ID");
  if (!/^[A-Za-z0-9._-]{1,120}$/.test(releaseId)) {
    throw new Error("P13_RELEASE_ID_INVALID");
  }
  const releaseRoot = path.resolve(
    required("P13_WORKER_RELEASE_ROOT"),
  );
  const signingKeyId = required("P13_SIGNING_KEY_ID");
  const signingPrivateKeyPath =
    await validateSigningPrivateKeyPath({
      workspaceRoot,
      artifactRoot: releaseRoot,
      privateKeyPath: required("P13_SIGNING_PRIVATE_KEY_PATH"),
    });
  const gitSha = gitValue(["rev-parse", "HEAD"]);
  const gitDirty =
    gitValue(["status", "--porcelain"]).length > 0;

  let securityPreflight: Awaited<
    ReturnType<typeof runBuildSecurityPreflight>
  > | undefined;
  const buildResult = await executeGuardedBuild({
    runPreflight: () =>
      runBuildSecurityPreflight({
        application: "worker",
        workspaceRoot,
        appDirectory,
        targetRoot: releaseRoot,
      }),
    verifyBuildIdentity: (report) => {
      if (!/^[A-Za-z0-9._-]{1,120}$/.test(signingKeyId)) {
        throw new Error("P13_SIGNING_KEY_ID_INVALID");
      }
      securityPreflight = report;
    },
    build: async () => {
      const typescriptRoot = path.dirname(
        require.resolve("typescript/package.json"),
      );
      const tscCli = path.join(typescriptRoot, "bin", "tsc");
      return spawnSync(
        process.execPath,
        [
          tscCli,
          "-p",
          path.join(appDirectory, "tsconfig.build.json"),
          "--outDir",
          releaseRoot,
          "--incremental",
          "false",
        ],
        {
          cwd: appDirectory,
          env: process.env,
          stdio: "inherit",
          windowsHide: true,
        },
      );
    },
  });
  if (!securityPreflight) {
    throw new Error("WORKER_BUILD_PREFLIGHT_REPORT_MISSING");
  }
  console.log(
    JSON.stringify({
      event: "worker.build_preflight_passed",
      headStatus: securityPreflight.head.status,
      headVsWorktree: securityPreflight.headVsWorktree,
      changedSecurityFiles: securityPreflight.differences.length,
    }),
  );
  if (buildResult.status !== 0) {
    throw new Error("WORKER_BUILD_FAILED");
  }

  const result = await generateSignedReleaseManifest({
    application: "worker",
    workspaceRoot,
    artifactRoot: releaseRoot,
    runtimeRoot: appDirectory,
    gitSha,
    gitDirty,
    releaseId,
    keyId: signingKeyId,
    privateKeyPath: signingPrivateKeyPath,
  });

  console.log(
    JSON.stringify({
      event: "worker.release_built",
      buildId: result.manifest.buildId,
      releaseId: result.manifest.releaseId,
      artifactDigest: result.manifest.artifactDigest,
      manifestPath: result.manifestPath,
    }),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  const safeErrorCode = [...SAFE_BUILD_ERROR_CODES].some((value) =>
    message.startsWith(value),
  )
    ? message
    : undefined;
  console.error(
    JSON.stringify({
      event: "worker.release_build_rejected",
      errorName: error instanceof Error ? error.name : "UNKNOWN_ERROR",
      integrityMessage:
        error instanceof BuildIntegrityError
          ? error.message
          : undefined,
      errorCode:
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : safeErrorCode ?? "UNSPECIFIED",
    }),
  );
  process.exitCode = 1;
});
