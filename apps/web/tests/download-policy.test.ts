import { describe, expect, it } from "vitest";

import { evaluateDownloadPolicy } from "../src/modules/files/download-policy";

const validBase = {
  nodeEnvironment: "test",
  fileAccessMode: "test" as const,
  testIdentityVerified: true,
  hasUnscannedTestAccess: true,
  uploadStatus: "UPLOADED" as const,
  validationStatus: "PASSED" as const,
  integrityStatus: "VERIFIED" as const,
  malwareScanStatus: "SCAN_UNAVAILABLE" as const,
};

describe("download security policy", () => {
  it("allows a clean file in production", () => {
    expect(
      evaluateDownloadPolicy({
        ...validBase,
        nodeEnvironment: "production",
        fileAccessMode: "enforce",
        testIdentityVerified: false,
        hasUnscannedTestAccess: false,
        malwareScanStatus: "CLEAN",
      }),
    ).toEqual({ allowed: true, reason: "CLEAN" });
  });

  it("never bypasses an unavailable scan in production", () => {
    expect(
      evaluateDownloadPolicy({
        ...validBase,
        nodeEnvironment: "production",
      }),
    ).toEqual({
      allowed: false,
      reason: "MALWARE_SCAN_REQUIRED",
    });
  });

  it("requires verified test identity and explicit project permission", () => {
    expect(evaluateDownloadPolicy(validBase)).toEqual({
      allowed: true,
      reason: "TEST_UNSCANNED",
    });
    expect(
      evaluateDownloadPolicy({
        ...validBase,
        testIdentityVerified: false,
      }),
    ).toEqual({
      allowed: false,
      reason: "MALWARE_SCAN_REQUIRED",
    });
    expect(
      evaluateDownloadPolicy({
        ...validBase,
        hasUnscannedTestAccess: false,
      }),
    ).toEqual({
      allowed: false,
      reason: "MALWARE_SCAN_REQUIRED",
    });
  });

  it("blocks incomplete or invalid file versions", () => {
    expect(
      evaluateDownloadPolicy({
        ...validBase,
        validationStatus: "FAILED",
      }),
    ).toEqual({
      allowed: false,
      reason: "VALIDATION_NOT_PASSED",
    });
    expect(
      evaluateDownloadPolicy({
        ...validBase,
        integrityStatus: "FAILED",
      }),
    ).toEqual({
      allowed: false,
      reason: "INTEGRITY_NOT_VERIFIED",
    });
  });
});
