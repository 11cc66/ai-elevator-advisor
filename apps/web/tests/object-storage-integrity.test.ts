import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { classifyStorageFailure } from "../src/modules/files/download-service";

describe("object storage integrity classification", () => {
  it.each([
    ["OBJECT_STORAGE_NOT_FOUND", "STORAGE_OBJECT_MISSING", true],
    ["OBJECT_STORAGE_CHECKSUM_MISMATCH", "CHECKSUM_MISMATCH", true],
    ["OBJECT_STORAGE_VERSION_MISMATCH", "VALIDATION_FAILED", true],
    ["OBJECT_STORAGE_SIZE_MISMATCH", "VALIDATION_FAILED", true],
    ["OBJECT_STORAGE_BINDING_INVALID", "VALIDATION_FAILED", true],
    ["OBJECT_STORAGE_CAPABILITY_UNVERIFIED", "VALIDATION_FAILED", false],
    ["OBJECT_STORAGE_ADAPTER_UNAVAILABLE", "VALIDATION_FAILED", false],
    [
      "OBJECT_STORAGE_PROVIDER_CONFIGURATION_UNAVAILABLE",
      "VALIDATION_FAILED",
      false,
    ],
    [
      "OBJECT_STORAGE_PROVIDER_TEMPORARY_FAILURE",
      "VALIDATION_FAILED",
      false,
    ],
    ["OBJECT_STORAGE_UNAVAILABLE", "VALIDATION_FAILED", false],
  ] as const)(
    "maps %s to download integrity evidence",
    (code, eventType, markIntegrityFailed) => {
      expect(classifyStorageFailure(code)).toMatchObject({
        eventType,
        markIntegrityFailed,
      });
    },
  );

  it("binds downloads to the exact FileVersion operation and observed version", async () => {
    const source = await fs.readFile(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../src/modules/files/download-service.ts",
      ),
      "utf8",
    );
    expect(source).toContain(
      "binding.operationId !== version.creationOperationAttemptId",
    );
    expect(source).toContain("!binding.writeObservedAt");
    expect(source).toContain("readExact({");
  });
});
