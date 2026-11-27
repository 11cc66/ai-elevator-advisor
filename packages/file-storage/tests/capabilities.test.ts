import { Readable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import {
  createStorageReadCapability,
  createStorageRuntimeCapability,
  createStorageUploadWriteCapability,
  type StorageRuntimeCapability,
} from "../src/index.js";

function storageDouble(): StorageRuntimeCapability {
  return {
    verifyObjectChecksum: vi.fn(async () => ({
      valid: true,
      actualChecksumSha256: "a".repeat(64),
    })),
    readVerifiedObject: vi.fn(async () => ({
      bytes: Buffer.from("verified"),
      sizeBytes: 8n,
      checksumSha256: "a".repeat(64),
    })),
    openReadStream: vi.fn(() => Readable.from([Buffer.from("read")])),
    writeToStaging: vi.fn(async () => ({
      stagingKey: "staging/test.part",
      sizeBytes: 1n,
      checksumSha256: "b".repeat(64),
      headerBytes: Uint8Array.from([1]),
      writerClosedAt: new Date(0),
      closedIdentity: {
        dev: "1",
        ino: "2",
      },
    })),
    finalize: vi.fn(async () => undefined),
  };
}

describe("storage capability factories", () => {
  it("exposes only read methods through the worker read capability", () => {
    const capability = createStorageReadCapability(storageDouble());

    expect(Object.keys(capability).sort()).toEqual([
      "openReadStream",
      "readVerifiedObject",
      "verifyObjectChecksum",
    ]);
    expect(Object.isFrozen(capability)).toBe(true);
    expect("writeToStaging" in capability).toBe(false);
    expect("removeObject" in capability).toBe(false);
  });

  it("exposes only upload write methods through the upload capability", () => {
    const capability = createStorageUploadWriteCapability(
      storageDouble(),
    );

    expect(Object.keys(capability).sort()).toEqual([
      "finalize",
      "writeToStaging",
    ]);
    expect(Object.isFrozen(capability)).toBe(true);
    expect("readVerifiedObject" in capability).toBe(false);
    expect("cleanupTemp" in capability).toBe(false);
  });

  it("exposes ordinary runtime read/write methods without delete methods", () => {
    const capability = createStorageRuntimeCapability(
      storageDouble(),
    );

    expect(Object.keys(capability).sort()).toEqual([
      "finalize",
      "openReadStream",
      "readVerifiedObject",
      "verifyObjectChecksum",
      "writeToStaging",
    ]);
    expect(Object.isFrozen(capability)).toBe(true);
    for (const deleteMethod of [
      "removeStaging",
      "removeObject",
      "cleanupOrphanObjects",
      "cleanupTemp",
    ]) {
      expect(deleteMethod in capability).toBe(false);
    }
  });
});
