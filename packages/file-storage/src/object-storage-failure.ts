import type { ObjectStorageErrorCode } from "./object-storage-errors.js";

export type ObjectStorageFailureKind =
  | "ADAPTER_UNAVAILABLE"
  | "PROVIDER_CONFIGURATION_UNAVAILABLE"
  | "PROVIDER_TEMPORARY_FAILURE"
  | "OBJECT_NOT_FOUND"
  | "OBJECT_VERSION_MISMATCH"
  | "OBJECT_SIZE_MISMATCH"
  | "OBJECT_HASH_MISMATCH"
  | "BINDING_INVALID"
  | "WRITE_RESULT_UNCERTAIN"
  | "UNKNOWN";

export interface ObjectStorageFailureDisposition {
  kind: ObjectStorageFailureKind;
  integrityFailure: boolean;
  transient: boolean;
}

export function classifyObjectStorageFailure(
  code: ObjectStorageErrorCode | string,
): ObjectStorageFailureDisposition {
  switch (code) {
    case "OBJECT_STORAGE_ADAPTER_UNAVAILABLE":
      return {
        kind: "ADAPTER_UNAVAILABLE",
        integrityFailure: false,
        transient: true,
      };
    case "OBJECT_STORAGE_PROVIDER_CONFIGURATION_UNAVAILABLE":
    case "OBJECT_STORAGE_PERMISSION_DENIED":
    case "OBJECT_STORAGE_CAPABILITY_UNVERIFIED":
    case "OBJECT_STORAGE_NO_OVERWRITE_UNSUPPORTED":
      return {
        kind: "PROVIDER_CONFIGURATION_UNAVAILABLE",
        integrityFailure: false,
        transient: false,
      };
    case "OBJECT_STORAGE_PROVIDER_TEMPORARY_FAILURE":
    case "OBJECT_STORAGE_UNAVAILABLE":
      return {
        kind: "PROVIDER_TEMPORARY_FAILURE",
        integrityFailure: false,
        transient: true,
      };
    case "OBJECT_STORAGE_NOT_FOUND":
      return {
        kind: "OBJECT_NOT_FOUND",
        integrityFailure: true,
        transient: false,
      };
    case "OBJECT_STORAGE_VERSION_MISMATCH":
    case "OBJECT_STORAGE_VERSION_REQUIRED":
      return {
        kind: "OBJECT_VERSION_MISMATCH",
        integrityFailure: true,
        transient: false,
      };
    case "OBJECT_STORAGE_SIZE_MISMATCH":
      return {
        kind: "OBJECT_SIZE_MISMATCH",
        integrityFailure: true,
        transient: false,
      };
    case "OBJECT_STORAGE_CHECKSUM_MISMATCH":
      return {
        kind: "OBJECT_HASH_MISMATCH",
        integrityFailure: true,
        transient: false,
      };
    case "OBJECT_STORAGE_BINDING_INVALID":
      return {
        kind: "BINDING_INVALID",
        integrityFailure: true,
        transient: false,
      };
    case "OBJECT_STORAGE_WRITE_UNCERTAIN":
      return {
        kind: "WRITE_RESULT_UNCERTAIN",
        integrityFailure: false,
        transient: false,
      };
    default:
      return {
        kind: "UNKNOWN",
        integrityFailure: false,
        transient: false,
      };
  }
}
