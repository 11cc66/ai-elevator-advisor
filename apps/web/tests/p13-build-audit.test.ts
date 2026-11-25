import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  auditBuildArtifacts,
  digestText,
  validateBuildManifest,
} from "../scripts/p13-build-audit/scanner";

let root = "";

beforeEach(async () => {
  root = await fs.mkdtemp(
    path.join(os.tmpdir(), "p13-build-audit-"),
  );
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("legacy build artifact scanner", () => {
  it("finds legacy deletion calls without executing artifact code", async () => {
    const workerDist = path.join(root, "apps/worker/dist");
    await fs.mkdir(workerDist, { recursive: true });
    await fs.writeFile(
      path.join(workerDist, "legacy.js"),
      [
        "await storage.removeObject(key);",
        "await storage.cleanupOrphanObjects(keys, ttl);",
      ].join("\n"),
    );
    await fs.writeFile(
      path.join(workerDist, "safe.js"),
      "throw new LegacyStorageCleanupDisabledError('removeObject');",
    );

    const result = await auditBuildArtifacts(root);

    expect(result.artifactRoots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relativePath: "apps/worker/dist",
          artifactType: "WORKER_BUNDLE",
          startupReachable: true,
        }),
      ]),
    );
    expect(result.dangerousFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relativePath: "apps/worker/dist/legacy.js",
          markerId: "remove-object",
        }),
        expect.objectContaining({
          relativePath: "apps/worker/dist/legacy.js",
          markerId: "cleanup-orphan-objects",
        }),
      ]),
    );
    expect(
      result.dangerousFindings.some((finding) =>
        finding.relativePath.endsWith("safe.js"),
      ),
    ).toBe(false);
  });

  it("discovers web bundles, caches, test artifacts, and archives", async () => {
    for (const relativePath of [
      "apps/web/.next",
      "packages/file-storage/dist",
      ".turbo",
      "coverage",
      "test-results",
    ]) {
      await fs.mkdir(path.join(root, relativePath), { recursive: true });
    }
    await fs.writeFile(
      path.join(root, "apps/web/.next/BUILD_ID"),
      "test-build",
    );
    await fs.writeFile(
      path.join(root, "apps/web/tsconfig.tsbuildinfo"),
      "{}",
    );
    await fs.writeFile(
      path.join(root, "release.zip"),
      "not executed",
    );

    const result = await auditBuildArtifacts(root);
    const types = result.artifactRoots.map(
      (artifact) => artifact.artifactType,
    );

    expect(types).toEqual(
      expect.arrayContaining([
        "WEB_SERVER_BUNDLE",
        "PACKAGE_BUNDLE",
        "CACHE",
        "TEST_ARTIFACT",
        "ARCHIVE",
      ]),
    );
    expect(
      result.artifactRoots.find(
        (artifact) => artifact.artifactType === "WEB_SERVER_BUNDLE",
      )?.buildId,
    ).toBe("test-build");
    expect(result.artifactRoots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relativePath: "apps/web/tsconfig.tsbuildinfo",
          artifactType: "CACHE",
        }),
      ]),
    );
  });
});

describe("build manifest validation", () => {
  const expected = {
    application: "worker" as const,
    gitSha: "b".repeat(40),
    artifactDigest: digestText("artifact"),
    minimumLifecycleSafetyVersion: "1.0.0",
  };
  const validManifest = {
    application: "worker",
    buildId: "build-1",
    gitSha: expected.gitSha,
    sourceTreeDigest: digestText("source"),
    artifactDigest: expected.artifactDigest,
    buildTimestamp: "2026-11-18T00:00:00.000Z",
    lifecycleSafetyVersion: "1.0.0",
    cleanupCapability: "DISABLED",
    manifestVersion: 1,
  };

  it("accepts a complete disabled-cleanup manifest", () => {
    expect(validateBuildManifest(validManifest, expected)).toEqual({
      valid: true,
      reasons: [],
    });
  });

  it("fails closed for missing, stale, mismatched, or unsafe fields", () => {
    const cases = [
      {
        input: null,
        reason: "MANIFEST_INVALID",
      },
      {
        input: { ...validManifest, buildId: "" },
        reason: "MISSING_buildId",
      },
      {
        input: { ...validManifest, gitSha: "a".repeat(40) },
        reason: "GIT_SHA_MISMATCH",
      },
      {
        input: { ...validManifest, artifactDigest: digestText("other") },
        reason: "ARTIFACT_DIGEST_MISMATCH",
      },
      {
        input: {
          ...validManifest,
          lifecycleSafetyVersion: "0.9.9",
        },
        reason: "LIFECYCLE_SAFETY_VERSION_TOO_OLD",
      },
      {
        input: {
          ...validManifest,
          cleanupCapability: "ENABLED",
        },
        reason: "CLEANUP_CAPABILITY_NOT_DISABLED",
      },
      {
        input: {
          unexpectedField: "ignored",
        },
        reason: "MISSING_buildId",
      },
    ];

    for (const testCase of cases) {
      const result = validateBuildManifest(
        testCase.input,
        expected,
      );
      expect(result.valid).toBe(false);
      expect(result.reasons).toContain(testCase.reason);
    }
  });
});
