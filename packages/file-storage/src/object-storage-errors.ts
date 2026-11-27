export type ObjectStorageErrorCode =
  | "OBJECT_STORAGE_ADAPTER_UNAVAILABLE"
  | "OBJECT_STORAGE_PROVIDER_CONFIGURATION_UNAVAILABLE"
  | "OBJECT_STORAGE_PROVIDER_TEMPORARY_FAILURE"
  | "OBJECT_STORAGE_BINDING_INVALID"
  | "OBJECT_STORAGE_UNAVAILABLE"
  | "OBJECT_STORAGE_PERMISSION_DENIED"
  | "OBJECT_STORAGE_WRITE_UNCERTAIN"
  | "OBJECT_STORAGE_VERSION_REQUIRED"
  | "OBJECT_STORAGE_NOT_FOUND"
  | "OBJECT_STORAGE_VERSION_MISMATCH"
  | "OBJECT_STORAGE_CHECKSUM_MISMATCH"
  | "OBJECT_STORAGE_SIZE_MISMATCH"
  | "OBJECT_STORAGE_NO_OVERWRITE_UNSUPPORTED"
  | "OBJECT_STORAGE_CAPABILITY_UNVERIFIED";

export class ObjectStorageError extends Error {
  readonly code: ObjectStorageErrorCode;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: ObjectStorageErrorCode,
    message: string,
    options: {
      retryable?: boolean;
      details?: Readonly<Record<string, unknown>>;
      cause?: unknown;
    } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ObjectStorageError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}
