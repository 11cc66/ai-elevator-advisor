import type {
  FileIntegrityStatus,
  FileValidationStatus,
  FileVersionUploadStatus,
  MalwareScanStatus,
} from "@prisma/client";

export interface FileProcessingPolicyInput {
  nodeEnvironment: string | undefined;
  fileAccessMode: "enforce" | "test";
  testIdentityVerified: boolean;
  hasUnscannedTestAccess: boolean;
  uploadStatus: FileVersionUploadStatus;
  validationStatus: FileValidationStatus;
  integrityStatus: FileIntegrityStatus;
  malwareScanStatus: MalwareScanStatus;
}

export type FileProcessingPolicyDecision =
  | { allowed: true; reason: "CLEAN" | "TEST_UNSCANNED" }
  | {
      allowed: false;
      reason:
        | "UPLOAD_INCOMPLETE"
        | "VALIDATION_NOT_PASSED"
        | "INTEGRITY_NOT_VERIFIED"
        | "MALWARE_SCAN_REQUIRED";
    };

export function evaluateFileProcessingPolicy(
  input: FileProcessingPolicyInput,
): FileProcessingPolicyDecision {
  if (input.uploadStatus !== "UPLOADED") {
    return { allowed: false, reason: "UPLOAD_INCOMPLETE" };
  }

  if (input.validationStatus !== "PASSED") {
    return { allowed: false, reason: "VALIDATION_NOT_PASSED" };
  }

  if (input.integrityStatus !== "VERIFIED") {
    return { allowed: false, reason: "INTEGRITY_NOT_VERIFIED" };
  }

  if (input.malwareScanStatus === "CLEAN") {
    return { allowed: true, reason: "CLEAN" };
  }

  if (
    input.nodeEnvironment === "test" &&
    input.fileAccessMode === "test" &&
    input.testIdentityVerified &&
    input.hasUnscannedTestAccess
  ) {
    return { allowed: true, reason: "TEST_UNSCANNED" };
  }

  return { allowed: false, reason: "MALWARE_SCAN_REQUIRED" };
}
