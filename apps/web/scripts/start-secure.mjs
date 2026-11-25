import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BuildIntegrityError,
  verifyStartupRelease,
} from "@elevator/build-integrity";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(scriptDirectory, "..");
const require = createRequire(import.meta.url);

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

async function main() {
  const releaseRoot = path.resolve(
    required("P13_WEB_RELEASE_ROOT"),
  );
  const relativeDistDir = path
    .relative(appDirectory, releaseRoot)
    .replaceAll("\\", "/");
  if (
    !/^\.p13-releases\/[A-Za-z0-9._-]+$/.test(relativeDistDir)
  ) {
    throw new BuildIntegrityError(
      "STARTUP_RELEASE_ROOT_INVALID",
      "Web release root is not an isolated release directory.",
    );
  }
  await verifyStartupRelease({
    releaseRoot,
    runtimeRoot: required("P13_WEB_RUNTIME_ROOT"),
    manifestPath: required("P13_WEB_MANIFEST_PATH"),
    trustedPublicKeysPath: required(
      "P13_TRUSTED_PUBLIC_KEYS_PATH",
    ),
    expected: {
      application: "web",
      gitSha: required("P13_BUILD_GIT_SHA"),
      releaseId: required("P13_RELEASE_ID"),
    },
  });

  const nextRoot = path.dirname(
    require.resolve("next/package.json"),
  );
  const nextCli = path.join(nextRoot, "dist", "bin", "next");
  const child = spawn(process.execPath, [nextCli, "start"], {
    cwd: appDirectory,
    env: {
      ...process.env,
      NODE_ENV: "production",
      P13_NEXT_DIST_DIR: relativeDistDir,
      NEXT_TELEMETRY_DISABLED: "1",
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
      event: "web.startup_rejected",
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
