import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const sourcePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/modules/files/object-upload-service.ts",
);

describe("object upload source ordering", () => {
  it("persists dispatch and exact version observation before finalization", async () => {
    const source = await fs.readFile(sourcePath, "utf8");
    const dispatchBody = source.slice(
      source.indexOf("async function dispatchAndFinalize"),
      source.indexOf("async function recoverObjectUpload"),
    );
    const dispatch = source.indexOf('state: "EXECUTING"');
    const providerWrite = dispatchBody.indexOf(".writeImmutable({");
    const observation = dispatchBody.indexOf(
      "recordBindingObservation({",
    );

    expect(dispatch).toBeGreaterThan(-1);
    expect(observation).toBeGreaterThan(providerWrite);
    expect(source).toContain('state: "APPLIED"');
    expect(source).not.toMatch(/\blatest version\b/i);
  });

  it("fences finalization with owner, generation and live lease", async () => {
    const source = await fs.readFile(sourcePath, "utf8");
    expect(source).toContain('ownerToken: input.chain.ownerToken');
    expect(source).toContain(
      "fencingGeneration: input.chain.generation",
    );
    expect(source).toContain("leaseExpiresAt: { gt: now }");
    expect(source).toContain("RECOVERY_REQUIRED");
    expect(source).toContain("UNKNOWN");
    expect(source).toContain("discoverExact");
  });

  it("never rewrites an object during post-dispatch recovery", async () => {
    const source = await fs.readFile(sourcePath, "utf8");
    const recoveryBody = source.slice(
      source.indexOf("async function recoverObjectUpload"),
      source.indexOf("export async function completeObjectUpload"),
    );
    expect(recoveryBody).not.toContain("writeImmutable");
    expect(recoveryBody).toContain("discoverObservedVersion");
    expect(recoveryBody).toContain("recordBindingObservation");
  });
});
