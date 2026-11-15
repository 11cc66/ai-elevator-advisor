import { describe, expect, it } from "vitest";

import { evaluateFileProcessingPolicy } from "../src/file-processing-policy.js";

const base = {
  nodeEnvironment: "test",
  fileAccessMode: "test" as const,
  testIdentityVerified: true,
  hasUnscannedTestAccess: true,
  uploadStatus: "UPLOADED" as const,
  validationStatus: "PASSED" as const,
  integrityStatus: "VERIFIED" as const,
  malwareScanStatus: "SCAN_UNAVAILABLE" as const,
};

describe("file processing security policy", () => {
  it("allows unscanned files only in a verified test identity", () => {
    expect(evaluateFileProcessingPolicy(base)).toEqual({
      allowed: true,
      reason: "TEST_UNSCANNED",
    });
    expect(
      evaluateFileProcessingPolicy({
        ...base,
        testIdentityVerified: false,
      }),
    ).toEqual({
      allowed: false,
      reason: "MALWARE_SCAN_REQUIRED",
    });
    expect(
      evaluateFileProcessingPolicy({
        ...base,
        hasUnscannedTestAccess: false,
      }),
    ).toEqual({
      allowed: false,
      reason: "MALWARE_SCAN_REQUIRED",
    });
  });

  it("never permits an unscanned file in production", () => {
    expect(
      evaluateFileProcessingPolicy({
        ...base,
        nodeEnvironment: "production",
      }),
    ).toEqual({
      allowed: false,
      reason: "MALWARE_SCAN_REQUIRED",
    });
  });

  it("never enables test processing outside an explicit test runtime", () => {
    for (const nodeEnvironment of [
      undefined,
      "development",
      "staging",
      "production",
    ]) {
      expect(
        evaluateFileProcessingPolicy({
          ...base,
          nodeEnvironment,
        }),
      ).toEqual({
        allowed: false,
        reason: "MALWARE_SCAN_REQUIRED",
      });
    }
  });

  it("allows only a clean scanned file in production", () => {
    expect(
      evaluateFileProcessingPolicy({
        ...base,
        nodeEnvironment: "production",
        fileAccessMode: "enforce",
        testIdentityVerified: false,
        hasUnscannedTestAccess: false,
        malwareScanStatus: "CLEAN",
      }),
    ).toEqual({ allowed: true, reason: "CLEAN" });
  });
});
