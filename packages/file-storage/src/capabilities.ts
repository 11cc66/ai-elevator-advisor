import type { Readable } from "node:stream";

export interface WrittenUpload {
  stagingKey: string;
  sizeBytes: bigint;
  checksumSha256: string;
  headerBytes: Uint8Array;
  writerClosedAt: Date;
  closedIdentity: {
    dev: string;
    ino: string;
  } | null;
}

export interface IntegrityCheck {
  valid: boolean;
  actualChecksumSha256: string;
}

export interface VerifiedObjectRead {
  bytes: Buffer;
  sizeBytes: bigint;
  checksumSha256: string;
}

export interface ReadVerifiedObjectInput {
  objectKey: string;
  expectedSizeBytes: bigint;
  expectedChecksumSha256: string;
  maxBytes: bigint;
}

export interface StorageReadCapability {
  verifyObjectChecksum(
    objectKey: string,
    expectedChecksumSha256: string,
  ): Promise<IntegrityCheck>;
  readVerifiedObject(
    input: ReadVerifiedObjectInput,
  ): Promise<VerifiedObjectRead>;
  openReadStream(objectKey: string): Readable;
}

export interface StorageUploadWriteCapability {
  writeToStaging(
    stagingKey: string,
    source: Readable,
    maxBytes: bigint,
  ): Promise<WrittenUpload>;
  finalize(
    stagingKey: string,
    objectKey: string,
    expected?: {
      sizeBytes: bigint;
      checksumSha256: string;
    },
  ): Promise<void>;
}

export interface StorageRuntimeCapability
  extends StorageReadCapability,
    StorageUploadWriteCapability {}

export interface LegacyStorageCleanupCapability {
  removeStaging(stagingKey: string): Promise<void>;
  removeObject(objectKey: string): Promise<void>;
  cleanupOrphanObjects(
    referencedObjectKeys: readonly string[],
    olderThanMs: number,
    onError?: (error: unknown) => void,
    beforeDelete?: (objectKey: string) => void | Promise<void>,
  ): Promise<number>;
  cleanupTemp(
    olderThanMs: number,
    onError?: (error: unknown) => void,
    beforeDelete?: (storageKey: string) => void | Promise<void>,
  ): Promise<number>;
}

export function createStorageReadCapability(
  storage: StorageReadCapability,
): StorageReadCapability {
  return Object.freeze({
    verifyObjectChecksum: (
      objectKey: string,
      expectedChecksumSha256: string,
    ) =>
      storage.verifyObjectChecksum(
        objectKey,
        expectedChecksumSha256,
      ),
    readVerifiedObject: (input: ReadVerifiedObjectInput) =>
      storage.readVerifiedObject(input),
    openReadStream: (objectKey: string) =>
      storage.openReadStream(objectKey),
  });
}

export function createStorageUploadWriteCapability(
  storage: StorageUploadWriteCapability,
): StorageUploadWriteCapability {
  return Object.freeze({
    writeToStaging: (
      stagingKey: string,
      source: Readable,
      maxBytes: bigint,
    ) =>
      storage.writeToStaging(stagingKey, source, maxBytes),
    finalize: (
      stagingKey: string,
      objectKey: string,
      expected?: {
        sizeBytes: bigint;
        checksumSha256: string;
      },
    ) => storage.finalize(stagingKey, objectKey, expected),
  });
}

export function createStorageRuntimeCapability(
  storage: StorageRuntimeCapability,
): StorageRuntimeCapability {
  return Object.freeze({
    ...createStorageReadCapability(storage),
    ...createStorageUploadWriteCapability(storage),
  });
}
