import type { Readable } from "node:stream";

export interface ObjectStorageVersionIdentity {
  providerKind: string;
  accountScopeRef: string;
  region: string;
  bucketOrContainer: string;
  objectKey: string;
  providerVersionId: string;
  providerGeneration: bigint | null;
}

export interface ObjectStorageWriteRequest {
  objectKey: string;
  source: Readable;
  expectedSizeBytes: bigint;
  expectedChecksumSha256: string | null;
  idempotencyKey: string;
  signal?: AbortSignal;
}

export interface ObjectStorageWriteResult {
  version: ObjectStorageVersionIdentity;
  sizeBytes: bigint;
  checksumSha256: string;
  etag: string | null;
  requestId: string | null;
}

export interface ObjectStorageExactReadRequest {
  version: ObjectStorageVersionIdentity;
  expectedSizeBytes: bigint;
  expectedChecksumSha256: string;
  maxBytes: bigint;
  signal?: AbortSignal;
}

export interface ObjectStorageExactReadResult {
  bytes: Buffer;
  sizeBytes: bigint;
  checksumSha256: string;
  requestId: string | null;
}

export interface ObjectStorageExactDiscoveryRequest {
  objectKey: string;
  idempotencyKey: string;
  expectedSizeBytes: bigint;
  expectedChecksumSha256: string;
  maxBytes: bigint;
  signal?: AbortSignal;
}

export type ObjectStorageExactDiscoveryResult =
  | {
      status: "FOUND";
      version: ObjectStorageVersionIdentity;
      sizeBytes: bigint;
      checksumSha256: string;
      etag: string | null;
      requestId: string | null;
    }
  | {
      status: "NOT_FOUND";
      requestId: string | null;
    };

export type ObjectStorageCapabilityState =
  | "SUPPORTED"
  | "UNSUPPORTED"
  | "NOT_VERIFIED";

export interface ObjectStorageCapabilities {
  immutableWrite: ObjectStorageCapabilityState;
  exactVersionRead: ObjectStorageCapabilityState;
  exactVersionIdentity: ObjectStorageCapabilityState;
  checksumReadback: ObjectStorageCapabilityState;
  exactWriteDiscovery: ObjectStorageCapabilityState;
}

export interface ObjectStorageReadCapability {
  readonly provider: {
    providerKind: string;
    accountScopeRef: string;
    region: string;
    bucketOrContainer: string;
  };
  readonly capabilities: ObjectStorageCapabilities;
  readExact(
    request: ObjectStorageExactReadRequest,
  ): Promise<ObjectStorageExactReadResult>;
}

export interface ObjectStorageRecoveryCapability {
  discoverExact(
    request: ObjectStorageExactDiscoveryRequest,
  ): Promise<ObjectStorageExactDiscoveryResult>;
}

export interface ObjectStorageAdapter
  extends ObjectStorageReadCapability,
    ObjectStorageRecoveryCapability {
  writeImmutable(
    request: ObjectStorageWriteRequest,
  ): Promise<ObjectStorageWriteResult>;
}
