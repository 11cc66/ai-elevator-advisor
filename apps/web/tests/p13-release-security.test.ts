import {
  generateKeyPairSync,
  randomUUID,
} from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  BuildIntegrityError,
  canonicalize,
  computeArtifactDigest,
  computeRuntimeDependencyClosure,
  computeSourceTreeDigest,
  createBuildManifest,
  generateSignedReleaseManifest,
  loadTrustedPublicKeys,
  parseStrictJson,
  signBuildManifest,
  verifySignedBuildManifest,
  verifyStartupRelease,
} from "@elevator/build-integrity";
import { PHASE_PRODUCTION_SERVER } from "next/constants";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import nextConfig from "../next.config";
import { runWebStartupGate } from "@/server/security/startup-gate";
import { runWorkerBootstrap } from "../../worker/src/bootstrap";
import { runWorkerStartupGate } from "../../worker/src/security/startup-gate";

let root = "";
let privateKeyPem = "";
let publicKeyPem = "";
let privateKeyPath = "";
let trustedKeysPath = "";

beforeEach(async () => {
  root = await fs.mkdtemp(
    path.join(os.tmpdir(), "p13-release-security-"),
  );
  const keys = generateKeyPairSync("ed25519");
  privateKeyPem = keys.privateKey.export({
    format: "pem",
    type: "pkcs8",
  }) as string;
  publicKeyPem = keys.publicKey.export({
    format: "pem",
    type: "spki",
  }) as string;
  privateKeyPath = path.join(root, "test-private-key.pem");
  trustedKeysPath = path.join(root, "trusted-keys.json");
  await fs.writeFile(privateKeyPath, privateKeyPem, { mode: 0o600 });
  await fs.writeFile(
    trustedKeysPath,
    JSON.stringify({ keys: { "test-key": publicKeyPem } }),
    { mode: 0o600 },
  );
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

async function createReleaseFixture(
  application: "web" | "worker" = "worker",
) {
  const sourceRoot = path.join(root, `source-${application}`);
  const artifactRoot = path.join(root, `release-${application}`);
  await fs.mkdir(path.join(sourceRoot, "src"), { recursive: true });
  await fs.mkdir(path.join(sourceRoot, "node_modules/pkg"), {
    recursive: true,
  });
  await fs.mkdir(path.join(sourceRoot, "dist"), { recursive: true });
  await fs.mkdir(
    path.join(sourceRoot, "node_modules/test-dep"),
    { recursive: true },
  );
  await fs.mkdir(artifactRoot, { recursive: true });
  await fs.writeFile(
    path.join(sourceRoot, "src", "entry.ts"),
    "export const safe = true;\n",
  );
  await fs.writeFile(
    path.join(sourceRoot, ".env"),
    "SECRET=must-not-enter-digest\n",
  );
  await fs.writeFile(
    path.join(sourceRoot, "node_modules/pkg/index.js"),
    "ignored\n",
  );
  await fs.writeFile(
    path.join(sourceRoot, "dist/old.js"),
    "ignored\n",
  );
  await fs.writeFile(
    path.join(sourceRoot, "pnpm-lock.yaml"),
    "lockfileVersion: '9.0'\n",
  );
  await fs.writeFile(
    path.join(sourceRoot, "package.json"),
    JSON.stringify({
      name: `test-${application}`,
      version: "1.0.0",
      dependencies: { "test-dep": "1.0.0" },
    }),
  );
  await fs.writeFile(
    path.join(sourceRoot, "node_modules/test-dep/package.json"),
    JSON.stringify({
      name: "test-dep",
      version: "1.0.0",
    }),
  );
  await fs.writeFile(
    path.join(sourceRoot, "node_modules/test-dep/index.js"),
    "module.exports = 1;\n",
  );
  await fs.writeFile(
    path.join(artifactRoot, "index.js"),
    "process.stdout.write('safe');\n",
  );
  const generated = await generateSignedReleaseManifest({
    application,
    workspaceRoot: sourceRoot,
    artifactRoot,
    runtimeRoot: sourceRoot,
    gitSha: "a".repeat(40),
    gitDirty: true,
    releaseId: "release-test-1",
    keyId: "test-key",
    privateKeyPath,
  });
  return {
    sourceRoot,
    artifactRoot,
    manifestPath: generated.manifestPath,
    manifest: generated.manifest,
  };
}

describe("canonical serialization and strict JSON", () => {
  it("sorts keys deterministically and rejects duplicate JSON fields", () => {
    expect(
      canonicalize({
        z: 1,
        a: { y: true, x: null },
      }),
    ).toBe('{"a":{"x":null,"y":true},"z":1}');
    expect(() =>
      parseStrictJson('{"a":1,"a":2}'),
    ).toThrowError(BuildIntegrityError);
    expect(() =>
      parseStrictJson('{"a":1} trailing'),
    ).toThrowError(BuildIntegrityError);
  });
});

describe("source and artifact digests", () => {
  it("is deterministic and excludes secrets, dependencies, and old builds", async () => {
    const sourceRoot = path.join(root, "source");
    await fs.mkdir(path.join(sourceRoot, "src"), { recursive: true });
    await fs.mkdir(path.join(sourceRoot, "node_modules/pkg"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(sourceRoot, "src/entry.ts"),
      "export const value = 1;\n",
    );
    await fs.writeFile(
      path.join(sourceRoot, ".env"),
      "SECRET=one\n",
    );
    await fs.writeFile(
      path.join(sourceRoot, "node_modules/pkg/index.js"),
      "ignored one\n",
    );
    const first = await computeSourceTreeDigest({
      root: sourceRoot,
    });
    await fs.writeFile(
      path.join(sourceRoot, ".env"),
      "SECRET=two\n",
    );
    await fs.writeFile(
      path.join(sourceRoot, "node_modules/pkg/index.js"),
      "ignored two\n",
    );
    const second = await computeSourceTreeDigest({
      root: sourceRoot,
    });
    expect(second.digest).toBe(first.digest);

    await fs.writeFile(
      path.join(sourceRoot, "src/entry.ts"),
      "export const value = 2;\n",
    );
    const third = await computeSourceTreeDigest({
      root: sourceRoot,
    });
    expect(third.digest).not.toBe(first.digest);

    await fs.writeFile(path.join(sourceRoot, "artifact.js"), "safe\n");
    const artifact = await computeArtifactDigest({
      root: sourceRoot,
    });
    await fs.writeFile(path.join(sourceRoot, "artifact.js"), "changed\n");
    const changedArtifact = await computeArtifactDigest({
      root: sourceRoot,
    });
    expect(changedArtifact.digest).not.toBe(artifact.digest);
  });

  it("rejects symlinks in artifact roots", async () => {
    const artifactRoot = path.join(root, "symlink-release");
    await fs.mkdir(artifactRoot, { recursive: true });
    const target = path.join(root, "target-directory");
    await fs.mkdir(target, { recursive: true });
    await fs.symlink(
      target,
      path.join(artifactRoot, "linked-directory"),
      "junction",
    );

    await expect(
      computeArtifactDigest({ root: artifactRoot }),
    ).rejects.toMatchObject({ code: "SYMLINK_FORBIDDEN" });
  });

  it("rejects a Junction used as the artifact root", async () => {
    const target = path.join(root, "artifact-root-target");
    const link = path.join(root, "artifact-root-link");
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, "index.js"), "safe\n");
    await fs.symlink(target, link, "junction");

    await expect(
      computeArtifactDigest({ root: link }),
    ).rejects.toMatchObject({
      code: "DIRECTORY_IDENTITY_INVALID",
    });
  });

  it("rejects a parent Junction on a security-sensitive root", async () => {
    const actualParent = path.join(root, "actual-parent");
    const linkedParent = path.join(root, "linked-parent");
    const releaseRoot = path.join(actualParent, "release");
    await fs.mkdir(releaseRoot, { recursive: true });
    await fs.writeFile(
      path.join(releaseRoot, "index.js"),
      "safe\n",
    );
    await fs.symlink(actualParent, linkedParent, "junction");

    await expect(
      computeArtifactDigest({
        root: path.join(linkedParent, "release"),
      }),
    ).rejects.toMatchObject({
      code: "REPARSE_POINT_PATH_FORBIDDEN",
    });
  });

  it("allows only explicitly trusted dependency symlinks and binds their target content", async () => {
    const artifactRoot = path.join(root, "trusted-link-release");
    const dependencyRoot = path.join(root, "trusted-dependency");
    await fs.mkdir(artifactRoot, { recursive: true });
    await fs.mkdir(dependencyRoot, { recursive: true });
    await fs.writeFile(
      path.join(dependencyRoot, "index.js"),
      "module.exports = 1;\n",
    );
    await fs.symlink(
      dependencyRoot,
      path.join(artifactRoot, "dependency"),
      "junction",
    );

    const first = await computeArtifactDigest({
      root: artifactRoot,
      allowedSymlinkRoots: [dependencyRoot],
    });
    await fs.writeFile(
      path.join(dependencyRoot, "index.js"),
      "module.exports = 2;\n",
    );
    const second = await computeArtifactDigest({
      root: artifactRoot,
      allowedSymlinkRoots: [dependencyRoot],
    });
    expect(second.digest).not.toBe(first.digest);

    await expect(
      computeArtifactDigest({ root: artifactRoot }),
    ).rejects.toMatchObject({ code: "SYMLINK_FORBIDDEN" });
  });

  it("binds the complete runtime dependency closure", async () => {
    const applicationRoot = path.join(root, "dependency-app");
    const dependencyRoot = path.join(
      applicationRoot,
      "node_modules/test-dep",
    );
    await fs.mkdir(dependencyRoot, { recursive: true });
    await fs.writeFile(
      path.join(applicationRoot, "package.json"),
      JSON.stringify({
        name: "dependency-app",
        version: "1.0.0",
        dependencies: { "test-dep": "1.0.0" },
        optionalDependencies: {
          "optional-not-installed": "1.0.0",
        },
      }),
    );
    await fs.writeFile(
      path.join(dependencyRoot, "package.json"),
      JSON.stringify({
        name: "test-dep",
        version: "1.0.0",
        dependencies: {},
      }),
    );
    await fs.writeFile(
      path.join(dependencyRoot, "index.js"),
      "module.exports = 1;\n",
    );
    await fs.writeFile(path.join(dependencyRoot, "native.node"), "native");

    const first = await computeRuntimeDependencyClosure({
      applicationRoot,
    });
    expect(first.packageCount).toBe(1);
    expect(first.nativePackages).toEqual(["test-dep@1.0.0"]);
    expect(first.missingOptionalDependencies).toHaveLength(1);

    await fs.writeFile(
      path.join(dependencyRoot, "index.js"),
      "module.exports = 2;\n",
    );
    const changed = await computeRuntimeDependencyClosure({
      applicationRoot,
    });
    expect(changed.digest).not.toBe(first.digest);

    await fs.writeFile(
      path.join(dependencyRoot, "unexpected.js"),
      "unexpected\n",
    );
    const withExtra = await computeRuntimeDependencyClosure({
      applicationRoot,
    });
    expect(withExtra.digest).not.toBe(changed.digest);
  });
});

describe("signed manifests", () => {
  it("signs and verifies an Ed25519 manifest", () => {
    const manifest = createBuildManifest({
      application: "worker",
      releaseId: "release-1",
      gitSha: "b".repeat(40),
      gitDirty: true,
      sourceTreeDigest: "c".repeat(64),
      dependencyLockDigest: "d".repeat(64),
      runtimeDependencyDigest: "f".repeat(64),
      runtimeDependencyCount: 1,
      runtimePlatform: "test-platform",
      artifactDigest: "e".repeat(64),
    });
    const envelope = signBuildManifest(
      manifest,
      privateKeyPem,
      "test-key",
    );
    expect(
      verifySignedBuildManifest({
        envelope,
        trustedPublicKeys: { "test-key": publicKeyPem },
      }).buildId,
    ).toBe(manifest.buildId);
    expect(() =>
      verifySignedBuildManifest({
        envelope,
        trustedPublicKeys: { "different-key": publicKeyPem },
      }),
    ).toThrowError(BuildIntegrityError);
  });

  it("creates application-specific identities for the same source inputs", () => {
    const common = {
      releaseId: "release-shared",
      gitSha: "b".repeat(40),
      gitDirty: true,
      sourceTreeDigest: "c".repeat(64),
      dependencyLockDigest: "d".repeat(64),
      runtimeDependencyDigest: "f".repeat(64),
      runtimeDependencyCount: 1,
      runtimePlatform: "test-platform",
      artifactDigest: "e".repeat(64),
    };
    const web = createBuildManifest({
      ...common,
      application: "web",
    });
    const worker = createBuildManifest({
      ...common,
      application: "worker",
    });

    expect(web.application).toBe("web");
    expect(worker.application).toBe("worker");
    expect(web.buildId).not.toBe(worker.buildId);
    expect(web.gitDirty).toBe(true);
    expect(worker.gitDirty).toBe(true);
  });

  it("rejects tampering, unknown fields, and unsafe capabilities", () => {
    const manifest = createBuildManifest({
      application: "worker",
      releaseId: "release-1",
      gitSha: "b".repeat(40),
      gitDirty: false,
      sourceTreeDigest: "c".repeat(64),
      dependencyLockDigest: "d".repeat(64),
      runtimeDependencyDigest: "f".repeat(64),
      runtimeDependencyCount: 1,
      runtimePlatform: "test-platform",
      artifactDigest: "e".repeat(64),
    });
    const envelope = signBuildManifest(
      manifest,
      privateKeyPem,
      "test-key",
    );

    expect(() =>
      verifySignedBuildManifest({
        envelope: {
          ...envelope,
          manifest: {
            ...envelope.manifest,
            buildId: "tampered",
          },
        },
        trustedPublicKeys: { "test-key": publicKeyPem },
      }),
    ).toThrowError(BuildIntegrityError);
    expect(() =>
      verifySignedBuildManifest({
        envelope: {
          ...envelope,
          manifest: {
            ...envelope.manifest,
            unexpectedField: true,
          },
        },
        trustedPublicKeys: { "test-key": publicKeyPem },
      }),
    ).toThrowError(BuildIntegrityError);
    expect(() =>
      verifySignedBuildManifest({
        envelope: {
          ...envelope,
          manifest: {
            ...envelope.manifest,
            cleanupCapability: "UNKNOWN",
          },
        },
        trustedPublicKeys: { "test-key": publicKeyPem },
      }),
    ).toThrowError(BuildIntegrityError);
  });

  it("rejects signing keys placed inside source or artifact trees", async () => {
    const sourceRoot = path.join(root, "source-key-boundary");
    const artifactRoot = path.join(root, "artifact-key-boundary");
    await fs.mkdir(sourceRoot, { recursive: true });
    await fs.mkdir(artifactRoot, { recursive: true });
    await fs.writeFile(
      path.join(sourceRoot, "index.js"),
      "safe\n",
    );
    const embeddedKey = path.join(sourceRoot, "signing-key.pem");
    await fs.writeFile(embeddedKey, privateKeyPem, {
      mode: 0o600,
    });

    await expect(
      generateSignedReleaseManifest({
        application: "worker",
        workspaceRoot: sourceRoot,
        artifactRoot,
        runtimeRoot: sourceRoot,
        gitSha: "a".repeat(40),
        gitDirty: true,
        releaseId: "release-key-boundary",
        keyId: "test-key",
        privateKeyPath: embeddedKey,
      }),
    ).rejects.toMatchObject({
      code: "PRIVATE_KEY_PATH_FORBIDDEN",
    });
  });

  it("rejects a trusted-key file reached through a parent Junction", async () => {
    const actualParent = path.join(root, "trust-parent");
    const linkedParent = path.join(root, "trust-link");
    await fs.mkdir(actualParent, { recursive: true });
    await fs.writeFile(
      path.join(actualParent, "trusted-keys.json"),
      JSON.stringify({ keys: { "test-key": publicKeyPem } }),
    );
    await fs.symlink(actualParent, linkedParent, "junction");

    await expect(
      loadTrustedPublicKeys(
        path.join(linkedParent, "trusted-keys.json"),
      ),
    ).rejects.toMatchObject({
      code: "REPARSE_POINT_PATH_FORBIDDEN",
    });
  });
});

describe("startup verification", () => {
  it("verifies signed manifest and artifact digest", async () => {
    const fixture = await createReleaseFixture();
    const result = await verifyStartupRelease({
      releaseRoot: fixture.artifactRoot,
      runtimeRoot: fixture.sourceRoot,
      manifestPath: fixture.manifestPath,
      trustedPublicKeysPath: trustedKeysPath,
      expected: {
        application: "worker",
        gitSha: "a".repeat(40),
        releaseId: "release-test-1",
      },
    });
    expect(result.manifest.buildId).toBe(
      fixture.manifest.buildId,
    );
  });

  it("rejects artifact replacement and legacy deletion code", async () => {
    const fixture = await createReleaseFixture();
    await fs.writeFile(
      path.join(fixture.artifactRoot, "index.js"),
      "await storage.removeObject(key);\n",
    );
    await expect(
      verifyStartupRelease({
        releaseRoot: fixture.artifactRoot,
        runtimeRoot: fixture.sourceRoot,
        manifestPath: fixture.manifestPath,
        trustedPublicKeysPath: trustedKeysPath,
        expected: {
          application: "worker",
          gitSha: "a".repeat(40),
          releaseId: "release-test-1",
        },
      }),
    ).rejects.toMatchObject({
      code: "ARTIFACT_DIGEST_MISMATCH",
    });
  });

  it("rejects missing manifests and missing Trust Roots", async () => {
    const fixture = await createReleaseFixture();
    const expected = {
      application: "worker" as const,
      gitSha: "a".repeat(40),
      releaseId: "release-test-1",
    };

    await expect(
      verifyStartupRelease({
        releaseRoot: fixture.artifactRoot,
        runtimeRoot: fixture.sourceRoot,
        manifestPath: path.join(
          fixture.artifactRoot,
          "missing-manifest.json",
        ),
        trustedPublicKeysPath: trustedKeysPath,
        expected,
      }),
    ).rejects.toMatchObject({
      code: "MANIFEST_IDENTITY_INVALID",
    });
    await expect(
      verifyStartupRelease({
        releaseRoot: fixture.artifactRoot,
        runtimeRoot: fixture.sourceRoot,
        manifestPath: fixture.manifestPath,
        trustedPublicKeysPath: path.join(
          root,
          "missing-trusted-keys.json",
        ),
        expected,
      }),
    ).rejects.toMatchObject({
      code: "TRUST_ROOT_IDENTITY_INVALID",
    });
  });

  it("rejects a Trust Root containing a replacement public key", async () => {
    const fixture = await createReleaseFixture();
    const replacement = generateKeyPairSync("ed25519");
    const replacementPublic = replacement.publicKey.export({
      format: "pem",
      type: "spki",
    }) as string;
    await fs.writeFile(
      trustedKeysPath,
      JSON.stringify({
        keys: { "test-key": replacementPublic },
      }),
    );

    await expect(
      verifyStartupRelease({
        releaseRoot: fixture.artifactRoot,
        runtimeRoot: fixture.sourceRoot,
        manifestPath: fixture.manifestPath,
        trustedPublicKeysPath: trustedKeysPath,
        expected: {
          application: "worker",
          gitSha: "a".repeat(40),
          releaseId: "release-test-1",
        },
      }),
    ).rejects.toMatchObject({
      code: "SIGNATURE_INVALID",
    });
  });

  it("rejects old lifecycle safety and expired build timestamps after re-signing", async () => {
    const fixture = await createReleaseFixture();
    const envelope = parseStrictJson(
      await fs.readFile(fixture.manifestPath, "utf8"),
    ) as {
      manifest: Record<string, unknown>;
      signature: unknown;
    };
    for (const manifestPatch of [
      { lifecycleSafetyVersion: "0.9.9" },
      { buildTimestamp: "2020-01-01T00:00:00.000Z" },
    ]) {
      const signed = signBuildManifest(
        {
          ...envelope.manifest,
          ...manifestPatch,
        } as never,
        privateKeyPem,
        "test-key",
      );
      await fs.writeFile(
        fixture.manifestPath,
        `${canonicalize(signed)}\n`,
      );

      await expect(
        verifyStartupRelease({
          releaseRoot: fixture.artifactRoot,
          runtimeRoot: fixture.sourceRoot,
          manifestPath: fixture.manifestPath,
          trustedPublicKeysPath: trustedKeysPath,
          expected: {
            application: "worker",
            gitSha: "a".repeat(40),
            releaseId: "release-test-1",
          },
        }),
      ).rejects.toMatchObject({
        code:
          "lifecycleSafetyVersion" in manifestPatch
            ? "LIFECYCLE_SAFETY_VERSION_TOO_OLD"
            : "BUILD_EXPIRED",
      });
    }
  });

  it("rejects a release ID mismatch and newly added artifact files", async () => {
    const fixture = await createReleaseFixture();
    await expect(
      verifyStartupRelease({
        releaseRoot: fixture.artifactRoot,
        runtimeRoot: fixture.sourceRoot,
        manifestPath: fixture.manifestPath,
        trustedPublicKeysPath: trustedKeysPath,
        expected: {
          application: "worker",
          gitSha: "a".repeat(40),
          releaseId: "different-release",
        },
      }),
    ).rejects.toMatchObject({
      code: "RELEASE_ID_MISMATCH",
    });

    await fs.writeFile(
      path.join(fixture.artifactRoot, "unexpected.js"),
      "safe but unexpected\n",
    );
    await expect(
      verifyStartupRelease({
        releaseRoot: fixture.artifactRoot,
        runtimeRoot: fixture.sourceRoot,
        manifestPath: fixture.manifestPath,
        trustedPublicKeysPath: trustedKeysPath,
        expected: {
          application: "worker",
          gitSha: "a".repeat(40),
          releaseId: "release-test-1",
        },
      }),
    ).rejects.toMatchObject({
      code: "ARTIFACT_DIGEST_MISMATCH",
    });
  });

  it("rejects runtime dependency mutation and deletion", async () => {
    const fixture = await createReleaseFixture();
    const dependencyFile = path.join(
      fixture.sourceRoot,
      "node_modules/test-dep/index.js",
    );
    await fs.writeFile(dependencyFile, "module.exports = 99;\n");
    await expect(
      verifyStartupRelease({
        releaseRoot: fixture.artifactRoot,
        runtimeRoot: fixture.sourceRoot,
        manifestPath: fixture.manifestPath,
        trustedPublicKeysPath: trustedKeysPath,
        expected: {
          application: "worker",
          gitSha: "a".repeat(40),
          releaseId: "release-test-1",
        },
      }),
    ).rejects.toMatchObject({
      code: "RUNTIME_DEPENDENCY_DIGEST_MISMATCH",
    });

    await fs.rm(dependencyFile);
    await expect(
      verifyStartupRelease({
        releaseRoot: fixture.artifactRoot,
        runtimeRoot: fixture.sourceRoot,
        manifestPath: fixture.manifestPath,
        trustedPublicKeysPath: trustedKeysPath,
        expected: {
          application: "worker",
          gitSha: "a".repeat(40),
          releaseId: "release-test-1",
        },
      }),
    ).rejects.toMatchObject({
      code: "RUNTIME_DEPENDENCY_DIGEST_MISMATCH",
    });
  });

  it("detects Artifact changes between successive startup checks", async () => {
    const fixture = await createReleaseFixture();
    const expected = {
      application: "worker" as const,
      gitSha: "a".repeat(40),
      releaseId: "release-test-1",
    };
    await expect(
      verifyStartupRelease({
        releaseRoot: fixture.artifactRoot,
        runtimeRoot: fixture.sourceRoot,
        manifestPath: fixture.manifestPath,
        trustedPublicKeysPath: trustedKeysPath,
        expected,
      }),
    ).resolves.toBeDefined();

    await fs.writeFile(
      path.join(fixture.artifactRoot, "index.js"),
      "process.stdout.write('changed');\n",
    );
    await expect(
      verifyStartupRelease({
        releaseRoot: fixture.artifactRoot,
        runtimeRoot: fixture.sourceRoot,
        manifestPath: fixture.manifestPath,
        trustedPublicKeysPath: trustedKeysPath,
        expected,
      }),
    ).rejects.toMatchObject({
      code: "ARTIFACT_DIGEST_MISMATCH",
    });
  });

  it("fails closed when startup configuration is missing", async () => {
    await expect(runWebStartupGate({})).rejects.toMatchObject({
      code: "STARTUP_CONFIGURATION_MISSING",
    });
    await expect(runWorkerStartupGate({})).rejects.toMatchObject({
      code: "STARTUP_CONFIGURATION_MISSING",
    });
  });

  it("runs the web and worker gates for matching signed releases", async () => {
    const webFixture = await createReleaseFixture("web");
    await expect(
      runWebStartupGate({
        P13_WEB_RELEASE_ROOT: webFixture.artifactRoot,
        P13_WEB_RUNTIME_ROOT: webFixture.sourceRoot,
        P13_WEB_MANIFEST_PATH: webFixture.manifestPath,
        P13_TRUSTED_PUBLIC_KEYS_PATH: trustedKeysPath,
        P13_BUILD_GIT_SHA: "a".repeat(40),
        P13_RELEASE_ID: "release-test-1",
      }),
    ).resolves.toMatchObject({
      manifest: {
        application: "web",
        releaseId: "release-test-1",
      },
    });

    const workerFixture = await createReleaseFixture("worker");
    await expect(
      runWorkerStartupGate({
        P13_WORKER_RELEASE_ROOT: workerFixture.artifactRoot,
        P13_WORKER_RUNTIME_ROOT: workerFixture.sourceRoot,
        P13_WORKER_MANIFEST_PATH: workerFixture.manifestPath,
        P13_TRUSTED_PUBLIC_KEYS_PATH: trustedKeysPath,
        P13_BUILD_GIT_SHA: "a".repeat(40),
        P13_RELEASE_ID: "release-test-1",
      }),
    ).resolves.toMatchObject({
      manifest: {
        application: "worker",
        releaseId: "release-test-1",
      },
    });
  });
});

describe("minimal worker bootstrap", () => {
  it("loads the gated worker entry only through dynamic import", async () => {
    const indexSource = await fs.readFile(
      path.resolve(
        import.meta.dirname,
        "../../worker/src/index.ts",
      ),
      "utf8",
    );
    const bootstrapSource = await fs.readFile(
      path.resolve(
        import.meta.dirname,
        "../../worker/src/bootstrap.ts",
      ),
      "utf8",
    );
    expect(indexSource).toContain("runWorkerBootstrap()");
    expect(bootstrapSource).toContain(
      'import("./worker-entry.js")',
    );
    expect(bootstrapSource.indexOf("await runStartupGate()")).toBeLessThan(
      bootstrapSource.indexOf("await loadBusinessEntry()"),
    );
    expect(indexSource).not.toMatch(
      /^import .*["']\.\/worker-entry\.js["'];?$/m,
    );
    expect(indexSource).not.toMatch(
      /^import .*["']pg-boss["'];?$/m,
    );
    expect(indexSource).not.toMatch(
      /^import .*["']@prisma\/client["'];?$/m,
    );
    expect(bootstrapSource).not.toMatch(
      /^import .*["'](?:pg-boss|@prisma\/client)["'];?$/m,
    );
  });

  it("does not load Worker business code when the Gate fails", async () => {
    const gateError = new BuildIntegrityError(
      "SIGNATURE_INVALID",
      "invalid test signature",
    );
    const loadBusinessEntry = vi.fn();

    await expect(
      runWorkerBootstrap({
        runStartupGate: async () => {
          throw gateError;
        },
        loadBusinessEntry,
      }),
    ).rejects.toBe(gateError);

    expect(loadBusinessEntry).not.toHaveBeenCalled();
  });

  it("runs the business entry only after the Gate succeeds", async () => {
    const events: string[] = [];
    const startWorker = vi.fn(async () => {
      events.push("startWorker");
    });

    await runWorkerBootstrap({
      runStartupGate: async () => {
        events.push("gate");
        return {} as never;
      },
      loadBusinessEntry: async () => {
        events.push("loadBusiness");
        return { startWorker };
      },
    });

    expect(events).toEqual([
      "gate",
      "loadBusiness",
      "startWorker",
    ]);
  });

  it("keeps the web instrumentation gate free of business imports", async () => {
    const source = await fs.readFile(
      path.resolve(
        import.meta.dirname,
        "../src/instrumentation.ts",
      ),
      "utf8",
    );
    expect(source).toContain(
      'await import(\n    "@/server/security/startup-gate"',
    );
    expect(source).toContain(
      'process.env.NEXT_RUNTIME !== "nodejs"',
    );
    expect(source).not.toMatch(/@prisma\/client|pg-boss|file-storage/);
  });

  it("routes supported build and start scripts through security wrappers", async () => {
    const webPackage = JSON.parse(
      await fs.readFile(
        path.resolve(import.meta.dirname, "../package.json"),
        "utf8",
      ),
    ) as { scripts: Record<string, string> };
    const workerPackage = JSON.parse(
      await fs.readFile(
        path.resolve(import.meta.dirname, "../../worker/package.json"),
        "utf8",
      ),
    ) as { scripts: Record<string, string> };
    const nextConfig = await fs.readFile(
      path.resolve(import.meta.dirname, "../next.config.ts"),
      "utf8",
    );
    const workerStart = await fs.readFile(
      path.resolve(
        import.meta.dirname,
        "../../worker/scripts/start-secure.mjs",
      ),
      "utf8",
    );
    const webStart = await fs.readFile(
      path.resolve(
        import.meta.dirname,
        "../scripts/start-secure.mjs",
      ),
      "utf8",
    );

    expect(webPackage.scripts.build).toContain(
      "scripts/build-secure.ts",
    );
    expect(webPackage.scripts.start).toContain(
      "scripts/start-secure.mjs",
    );
    expect(workerPackage.scripts.build).toContain(
      "scripts/build-secure.ts",
    );
    expect(workerPackage.scripts.start).toContain(
      "scripts/start-secure.mjs",
    );
    expect(workerPackage.scripts.start).not.toContain("dist/index.js");
    expect(workerStart).toContain("verifyStartupRelease");
    expect(workerStart).toContain('path.join(releaseRoot, "index.js")');
    expect(workerStart).toContain("spawn(process.execPath");
    expect(workerStart).toContain('NODE_ENV: "production"');
    expect(webStart.indexOf("await verifyStartupRelease")).toBeLessThan(
      webStart.indexOf("const child = spawn"),
    );
    expect(workerStart.indexOf("await verifyStartupRelease")).toBeLessThan(
      workerStart.indexOf("const child = spawn"),
    );
    expect(webStart).not.toMatch(
      /@prisma\/client|pg-boss|@elevator\/file-storage/,
    );
    expect(workerStart).not.toMatch(
      /@prisma\/client|pg-boss|@elevator\/file-storage/,
    );
    expect(nextConfig).not.toMatch(/\b(dotenv|loadEnv)\b/);
    expect(nextConfig).toContain("P13_NEXT_DIST_DIR");
  });

  it("rejects production server startup without an isolated Next dist dir", () => {
    const previous = process.env.P13_NEXT_DIST_DIR;
    try {
      delete process.env.P13_NEXT_DIST_DIR;
      expect(() =>
        nextConfig(PHASE_PRODUCTION_SERVER),
      ).toThrow("P13_NEXT_DIST_DIR is required");

      process.env.P13_NEXT_DIST_DIR =
        ".p13-releases/release-test-1";
      expect(nextConfig(PHASE_PRODUCTION_SERVER).distDir).toBe(
        ".p13-releases/release-test-1",
      );
    } finally {
      if (previous === undefined) {
        delete process.env.P13_NEXT_DIST_DIR;
      } else {
        process.env.P13_NEXT_DIST_DIR = previous;
      }
    }
  });

  it("has no production package script that directly starts legacy entries", async () => {
    const packagePaths = [
      path.resolve(import.meta.dirname, "../../../package.json"),
      path.resolve(import.meta.dirname, "../package.json"),
      path.resolve(import.meta.dirname, "../../worker/package.json"),
    ];
    const scripts: Array<{ file: string; name: string; command: string }> = [];
    for (const packagePath of packagePaths) {
      const parsed = JSON.parse(
        await fs.readFile(packagePath, "utf8"),
      ) as { scripts?: Record<string, string> };
      for (const [name, command] of Object.entries(
        parsed.scripts ?? {},
      )) {
        scripts.push({ file: packagePath, name, command });
      }
    }

    for (const script of scripts) {
      expect(
        script.command,
        `${script.file}:${script.name}`,
      ).not.toMatch(/\bnext\s+start\b/);
      expect(
        script.command,
        `${script.file}:${script.name}`,
      ).not.toMatch(/\bnode\s+(?:\.\/)?dist\/index\.js\b/);
    }
  });

  it("keeps E2E on an explicit test-only worker entry", async () => {
    const globalSetup = await fs.readFile(
      path.resolve(import.meta.dirname, "e2e/global-setup.ts"),
      "utf8",
    );
    const testEntry = await fs.readFile(
      path.resolve(
        import.meta.dirname,
        "../../worker/tests/test-worker-entry.ts",
      ),
      "utf8",
    );

    expect(globalSetup).toContain("tests/test-worker-entry.ts");
    expect(globalSetup).not.toContain('"src/index.ts"');
    expect(testEntry).toContain('from "../src/worker-entry.js"');
  });
});
