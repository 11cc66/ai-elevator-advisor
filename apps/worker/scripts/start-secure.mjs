import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import {
  BuildIntegrityError,
  verifyStartupRelease,
} from "@elevator/build-integrity";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new BuildIntegrityError(
      "STARTUP_CONFIGURATION_MISSING",
      `Required startup configuration is missing: ${name}.`,
    );
  }
  return value;
}

function isPathInside(root, candidate) {
  const normalize = (value) =>
    process.platform === "win32"
      ? path.resolve(value).toLowerCase()
      : path.resolve(value);
  const normalizedRoot = normalize(root);
  const normalizedCandidate = normalize(candidate);
  return (
    normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(
      `${normalizedRoot}${path.sep}`,
    )
  );
}

async function main() {
  const releaseRoot = path.resolve(
    required("P13_WORKER_RELEASE_ROOT"),
  );
  await verifyStartupRelease({
    releaseRoot,
    runtimeRoot: required("P13_WORKER_RUNTIME_ROOT"),
    manifestPath: required("P13_WORKER_MANIFEST_PATH"),
    trustedPublicKeysPath: required(
      "P13_TRUSTED_PUBLIC_KEYS_PATH",
    ),
    expected: {
      application: "worker",
      gitSha: required("P13_BUILD_GIT_SHA"),
      releaseId: required("P13_RELEASE_ID"),
    },
  });

  const entryPath = path.join(releaseRoot, "index.js");
  const entryStats = await fs.lstat(entryPath);
  if (entryStats.isSymbolicLink() || !entryStats.isFile()) {
    throw new BuildIntegrityError(
      "WORKER_RELEASE_ENTRY_INVALID",
      "Worker release entry must be a regular file.",
    );
  }
  const canonicalReleaseRoot = await fs.realpath(releaseRoot);
  const canonicalEntry = await fs.realpath(entryPath);
  if (!isPathInside(canonicalReleaseRoot, canonicalEntry)) {
    throw new BuildIntegrityError(
      "WORKER_RELEASE_ENTRY_OUTSIDE_ROOT",
      "Worker release entry resolves outside the release root.",
    );
  }

  const child = spawn(process.execPath, [canonicalEntry], {
    cwd: path.dirname(canonicalEntry),
    env: {
      ...process.env,
      NODE_ENV: "production",
    },
    stdio: "inherit",
    windowsHide: true,
  });
  child.once("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exitCode = code ?? 1;
  });
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      event: "worker.startup_rejected",
      errorCode:
        error instanceof BuildIntegrityError
          ? error.code
          : error instanceof Error
            ? error.name
            : "UNKNOWN_ERROR",
    }),
  );
  process.exitCode = 1;
});
