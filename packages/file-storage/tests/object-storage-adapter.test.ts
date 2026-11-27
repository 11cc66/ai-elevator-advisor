import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";

import type { ObjectStorageAdapter } from "../src/object-storage-adapter.js";
import { ObjectStorageError } from "../src/object-storage-errors.js";

class FakeObjectStorage implements ObjectStorageAdapter {
  readonly provider = {
    providerKind: "FAKE",
    accountScopeRef: "TEST_ACCOUNT",
    region: "TEST_REGION",
    bucketOrContainer: "test-bucket",
  };

  readonly capabilities = {
    immutableWrite: "SUPPORTED" as const,
    exactVersionRead: "SUPPORTED" as const,
    exactVersionIdentity: "SUPPORTED" as const,
    checksumReadback: "SUPPORTED" as const,
    exactWriteDiscovery: "SUPPORTED" as const,
  };

  readonly objects = new Map<string, Buffer>();

  async writeImmutable(
    request: Parameters<ObjectStorageAdapter["writeImmutable"]>[0],
  ) {
    if (this.objects.has(request.objectKey)) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_NO_OVERWRITE_UNSUPPORTED",
        "Fake adapter rejects overwrite.",
      );
    }
    const chunks: Buffer[] = [];
    let sizeBytes = 0n;
    for await (const chunk of request.source) {
      const buffer = Buffer.from(chunk);
      chunks.push(buffer);
      sizeBytes += BigInt(buffer.byteLength);
    }
    const bytes = Buffer.concat(chunks);
    const checksumSha256 = createHash("sha256")
      .update(bytes)
      .digest("hex");
    this.objects.set(request.objectKey, bytes);
    return {
      version: {
        ...this.provider,
        objectKey: request.objectKey,
        providerVersionId: `fake:${checksumSha256}:${sizeBytes}`,
        providerGeneration: 1n,
      },
      sizeBytes,
      checksumSha256,
      etag: null,
      requestId: "fake-request",
    };
  }

  async readExact(
    request: Parameters<ObjectStorageAdapter["readExact"]>[0],
  ) {
    const bytes = this.objects.get(request.version.objectKey);
    if (!bytes) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_NOT_FOUND",
        "Fake object not found.",
      );
    }
    if (bytes.byteLength > Number(request.maxBytes)) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_SIZE_MISMATCH",
        "Fake object too large.",
      );
    }
    const checksumSha256 = createHash("sha256")
      .update(bytes)
      .digest("hex");
    if (
      request.version.providerVersionId !==
      `fake:${checksumSha256}:${bytes.byteLength}`
    ) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_VERSION_MISMATCH",
        "Fake object version mismatch.",
      );
    }
    return {
      bytes,
      sizeBytes: BigInt(bytes.byteLength),
      checksumSha256,
      requestId: "fake-read",
    };
  }

  async discoverExact(
    request: Parameters<ObjectStorageAdapter["discoverExact"]>[0],
  ) {
    const bytes = this.objects.get(request.objectKey);
    if (!bytes) {
      return {
        status: "NOT_FOUND" as const,
        requestId: request.idempotencyKey,
      };
    }
    const read = await this.readExact({
      version: {
        ...this.provider,
        objectKey: request.objectKey,
        providerVersionId: `fake:${createHash("sha256")
          .update(bytes)
          .digest("hex")}:${bytes.byteLength}`,
        providerGeneration: 1n,
      },
      expectedSizeBytes: request.expectedSizeBytes,
      expectedChecksumSha256: request.expectedChecksumSha256,
      maxBytes: request.maxBytes,
      signal: request.signal,
    });
    return {
      status: "FOUND" as const,
      version: {
        ...this.provider,
        objectKey: request.objectKey,
        providerVersionId: `fake:${read.checksumSha256}:${read.sizeBytes}`,
        providerGeneration: 1n,
      },
      sizeBytes: read.sizeBytes,
      checksumSha256: read.checksumSha256,
      etag: null,
      requestId: request.idempotencyKey,
    };
  }
}

describe("ObjectStorageAdapter contract", () => {
  it("writes one immutable exact version and reads it back", async () => {
    const adapter = new FakeObjectStorage();
    const bytes = Buffer.from("%PDF-1.7\nfake");
    const written = await adapter.writeImmutable({
      objectKey: "objects/fake-1",
      source: Readable.from([bytes]),
      expectedSizeBytes: BigInt(bytes.length),
      expectedChecksumSha256: null,
      idempotencyKey: "attempt-1",
    });
    const read = await adapter.readExact({
      version: written.version,
      expectedSizeBytes: written.sizeBytes,
      expectedChecksumSha256: written.checksumSha256,
      maxBytes: 1024n,
    });

    expect(read.bytes).toEqual(bytes);
    expect(read.checksumSha256).toBe(written.checksumSha256);
    expect(adapter.objects.size).toBe(1);
  });

  it("rejects a version mismatch instead of falling back to latest", async () => {
    const adapter = new FakeObjectStorage();
    const bytes = Buffer.from("content");
    const written = await adapter.writeImmutable({
      objectKey: "objects/fake-2",
      source: Readable.from([bytes]),
      expectedSizeBytes: BigInt(bytes.length),
      expectedChecksumSha256: null,
      idempotencyKey: "attempt-2",
    });
    const badVersion = {
      ...written.version,
      objectKey: "objects/fake-2",
      providerVersionId: "fake:wrong",
    };
    const read = adapter.readExact({
      version: badVersion,
      expectedSizeBytes: written.sizeBytes,
      expectedChecksumSha256: written.checksumSha256,
      maxBytes: 1024n,
    });

    await expect(read).rejects.toMatchObject({
      code: "OBJECT_STORAGE_VERSION_MISMATCH",
    });
  });

  it("discovers only the exact version bound to the reserved key", async () => {
    const adapter = new FakeObjectStorage();
    const bytes = Buffer.from("%PDF-1.7\ndiscover");
    const checksum = createHash("sha256").update(bytes).digest("hex");
    await adapter.writeImmutable({
      objectKey: "objects/discover-1",
      source: Readable.from([bytes]),
      expectedSizeBytes: BigInt(bytes.byteLength),
      expectedChecksumSha256: checksum,
      idempotencyKey: "attempt-discover",
    });

    await expect(
      adapter.discoverExact({
        objectKey: "objects/discover-1",
        idempotencyKey: "attempt-discover",
        expectedSizeBytes: BigInt(bytes.byteLength),
        expectedChecksumSha256: checksum,
        maxBytes: 1024n,
      }),
    ).resolves.toMatchObject({
      status: "FOUND",
      checksumSha256: checksum,
    });
  });

  it("exposes no delete method in the MVP contract", () => {
    const adapter = new FakeObjectStorage();
    expect("delete" in adapter).toBe(false);
    expect("removeObject" in adapter).toBe(false);
  });
});
