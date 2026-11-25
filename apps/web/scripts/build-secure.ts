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
  "P13_WEB_RELEASE_ROOT_MISMATCH",
  "P13_WEB_RELEASE_ROOT_ALREADY_EXISTS",
  "GIT_IDENTITY_UNAVAILABLE",
  "WEB_BUILD_FAILED",
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
  const relativeDistDir = `.p13-releases/${releaseId}`;
  const relativeTsconfigPath = `.p13-build/${releaseId}/tsconfig.json`;
  const expectedReleaseRoot = path.join(
    appDirectory,
    relativeDistDir,
  );
  const buildConfigRoot = path.join(
    appDirectory,
    ".p13-build",
    releaseId,
  );
  const configuredReleaseRoot = path.resolve(
    required("P13_WEB_RELEASE_ROOT"),
  );
  if (configuredReleaseRoot !== expectedReleaseRoot) {
    throw new Error("P13_WEB_RELEASE_ROOT_MISMATCH");
  }
  const signingKeyId = required("P13_SIGNING_KEY_ID");
  const signingPrivateKeyPath =
    await validateSigningPrivateKeyPath({
      workspaceRoot,
      artifactRoot: expectedReleaseRoot,
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
        application: "web",
        workspaceRoot,
        appDirectory,
        targetRoot: expectedReleaseRoot,
        newWritePaths: [buildConfigRoot],
      }),
    verifyBuildIdentity: (report) => {
      if (!/^[A-Za-z0-9._-]{1,120}$/.test(signingKeyId)) {
        throw new Error("P13_SIGNING_KEY_ID_INVALID");
      }
      securityPreflight = report;
    },
    build: async () => {
      const nextEnvPath = path.join(
        appDirectory,
        "next-env.d.ts",
      );
      const originalNextEnv = await fs.readFile(nextEnvPath);
      await fs.mkdir(buildConfigRoot, { recursive: true });
      await fs.writeFile(
        path.join(buildConfigRoot, "tsconfig.json"),
        `${JSON.stringify(
          {
            extends: "../../tsconfig.json",
            compilerOptions: {
              incremental: false,
              tsBuildInfoFile: "./.tsbuildinfo.json",
            },
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
      try {
        const nextRoot = path.dirname(
          require.resolve("next/package.json"),
        );
        const nextCli = path.join(
          nextRoot,
          "dist",
          "bin",
          "next",
        );
        return spawnSync(
          process.execPath,
          [nextCli, "build"],
          {
            cwd: appDirectory,
            env: {
              ...process.env,
              P13_NEXT_DIST_DIR: relativeDistDir,
              P13_NEXT_TSCONFIG_PATH: relativeTsconfigPath,
              NEXT_TELEMETRY_DISABLED: "1",
            },
            stdio: "inherit",
            windowsHide: true,
          },
        );
      } finally {
        await fs.writeFile(nextEnvPath, originalNextEnv).catch(
          () => undefined,
        );
        await fs.rm(buildConfigRoot, {
          recursive: true,
          force: true,
        });
      }
    },
  });
  if (!securityPreflight) {
    throw new Error("WEB_BUILD_PREFLIGHT_REPORT_MISSING");
  }
  console.log(
    JSON.stringify({
      event: "web.build_preflight_passed",
      headStatus: securityPreflight.head.status,
      headVsWorktree: securityPreflight.headVsWorktree,
      changedSecurityFiles: securityPreflight.differences.length,
    }),
  );
  if (buildResult.status !== 0) {
    throw new Error("WEB_BUILD_FAILED");
  }

  const result = await generateSignedReleaseManifest({
    application: "web",
    workspaceRoot,
    artifactRoot: expectedReleaseRoot,
    runtimeRoot: appDirectory,
    gitSha,
    gitDirty,
    releaseId,
    keyId: signingKeyId,
    privateKeyPath: signingPrivateKeyPath,
  });

  console.log(
    JSON.stringify({
      event: "web.release_built",
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
      event: "web.release_build_rejected",
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
