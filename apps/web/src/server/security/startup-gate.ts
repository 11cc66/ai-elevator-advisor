import {
  BuildIntegrityError,
  verifyStartupRelease,
} from "@elevator/build-integrity";

type RuntimeEnvironment = Record<string, string | undefined>;

function required(
  source: RuntimeEnvironment,
  name: string,
): string {
  const value = source[name];
  if (!value) {
    throw new BuildIntegrityError(
      "STARTUP_CONFIGURATION_MISSING",
      `Required startup configuration is missing: ${name}.`,
    );
  }
  return value;
}

export async function runWebStartupGate(
  source: RuntimeEnvironment = process.env,
) {
  return verifyStartupRelease({
    releaseRoot: required(source, "P13_WEB_RELEASE_ROOT"),
    runtimeRoot: required(source, "P13_WEB_RUNTIME_ROOT"),
    manifestPath: required(source, "P13_WEB_MANIFEST_PATH"),
    trustedPublicKeysPath: required(
      source,
      "P13_TRUSTED_PUBLIC_KEYS_PATH",
    ),
    expected: {
      application: "web",
      gitSha: required(source, "P13_BUILD_GIT_SHA"),
      releaseId: required(source, "P13_RELEASE_ID"),
    },
  });
}
