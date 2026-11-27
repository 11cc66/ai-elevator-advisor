import { describe, expect, it } from "vitest";

import { classifyObjectStorageFailure } from "../src/index.js";

describe("object storage failure classification", () => {
  it.each([
    ["OBJECT_STORAGE_ADAPTER_UNAVAILABLE", "ADAPTER_UNAVAILABLE", false],
    [
      "OBJECT_STORAGE_PROVIDER_CONFIGURATION_UNAVAILABLE",
      "PROVIDER_CONFIGURATION_UNAVAILABLE",
      false,
    ],
    [
      "OBJECT_STORAGE_PROVIDER_TEMPORARY_FAILURE",
      "PROVIDER_TEMPORARY_FAILURE",
      false,
    ],
    ["OBJECT_STORAGE_NOT_FOUND", "OBJECT_NOT_FOUND", true],
    [
      "OBJECT_STORAGE_VERSION_MISMATCH",
      "OBJECT_VERSION_MISMATCH",
      true,
    ],
    ["OBJECT_STORAGE_SIZE_MISMATCH", "OBJECT_SIZE_MISMATCH", true],
    [
      "OBJECT_STORAGE_CHECKSUM_MISMATCH",
      "OBJECT_HASH_MISMATCH",
      true,
    ],
    ["OBJECT_STORAGE_BINDING_INVALID", "BINDING_INVALID", true],
  ] as const)(
    "classifies %s without conflating operational and integrity failures",
    (code, kind, integrityFailure) => {
      expect(classifyObjectStorageFailure(code)).toMatchObject({
        kind,
        integrityFailure,
      });
    },
  );
});
