import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ObjectStorageError } from "@elevator/file-storage";
import { describe, expect, it } from "vitest";

import { classifyFileProcessingError } from "../src/file-processing.js";

describe("Worker object storage integrity classification", () => {
  it("classifies object checksum mismatch as a blocked failure", () => {
    expect(
      classifyFileProcessingError(
        new ObjectStorageError(
          "OBJECT_STORAGE_CHECKSUM_MISMATCH",
          "checksum mismatch",
        ),
      ),
    ).toMatchObject({
      code: "OBJECT_STORAGE_CHECKSUM_MISMATCH",
      failureClass: "BLOCKED",
    });
  });

  it.each([
    ["OBJECT_STORAGE_ADAPTER_UNAVAILABLE", "TRANSIENT"],
    ["OBJECT_STORAGE_PROVIDER_TEMPORARY_FAILURE", "TRANSIENT"],
    ["OBJECT_STORAGE_PROVIDER_CONFIGURATION_UNAVAILABLE", "BLOCKED"],
  ] as const)("classifies %s as %s", (code, failureClass) => {
    expect(
      classifyFileProcessingError(new ObjectStorageError(code, code)),
    ).toMatchObject({ code, failureClass });
  });

  it("requires the binding operation and observed exact version", async () => {
    const source = await fs.readFile(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../src/file-processing.ts",
      ),
      "utf8",
    );
    expect(source).toContain(
      "binding.operationId !==\n            extraction.fileVersion.creationOperationAttemptId",
    );
    expect(source).toContain("!binding.writeObservedAt");
    expect(source).toContain("readExact({");
  });

  it("routes legacy reads through verified object reads and gates production", async () => {
    const source = await fs.readFile(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../src/file-processing.ts",
      ),
      "utf8",
    );
    expect(source).toContain("storage.readVerifiedObject({");
    expect(source).not.toContain("storage.openReadStream(");
    expect(source).toContain("PROCESSING_LEGACY_LOCAL_STORAGE_DISABLED");
    expect(source).toContain(
      "!isExplicitLocalObjectStorageEnvironment(process.env.NODE_ENV)",
    );
  });
});
