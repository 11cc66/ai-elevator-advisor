import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import {
  LocalObjectStorageAdapter,
  ObjectStorageError,
  type ObjectStorageAdapter,
  type ObjectStorageExactDiscoveryRequest,
  type ObjectStorageExactDiscoveryResult,
  type ObjectStorageExactReadRequest,
  type ObjectStorageExactReadResult,
  type ObjectStorageWriteRequest,
  type ObjectStorageWriteResult,
} from "@elevator/file-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/prisma", async () => {
  const { sharedObjectUploadPrismaHarness } = await import(
    "./helpers/object-upload-prisma-harness"
  );
  return {
    prisma: sharedObjectUploadPrismaHarness,
  };
});

vi.mock("@/modules/audit/log", () => ({
  appendAuditLog: vi.fn(async () => undefined),
}));

import type { Actor } from "../src/modules/access/actor";
import {
  completeObjectUpload,
  type CompleteObjectUploadInput,
} from "../src/modules/files/object-upload-service";
import { sharedObjectUploadPrismaHarness as harness } from "./helpers/object-upload-prisma-harness";

const PDF_BYTES = Buffer.from(
  "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
);
const PDF_SIZE = BigInt(PDF_BYTES.byteLength);
const PDF_HASH = createHash("sha256").update(PDF_BYTES).digest("hex");

const actor: Actor = {
  userId: "user-1",
  globalPermissions: new Set(),
  projectPermissions: new Map(),
};

interface StoredObject {
  bytes: Buffer;
  checksumSha256: string;
  idempotencyKey: string;
}

function versionIdFor(bytes: Buffer): string {
  return `${createHash("sha256").update(bytes).digest("hex")}:${bytes.byteLength}`;
}

class StrictObjectStorageAdapter implements ObjectStorageAdapter {
  readonly provider = {
    providerKind: "FAKE_TEST",
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

  readonly objects = new Map<string, StoredObject>();
  readonly writeKeys: string[] = [];
  readonly discoveryKeys: string[] = [];
  writeCount = 0;
  discoveryCount = 0;
  dropWriteResponseOnce = false;
  temporaryUnavailableOnce = false;
  wrongVersionOnce = false;
  delayMs = 0;
  onWrite?: () => void;

  async writeImmutable(
    request: ObjectStorageWriteRequest,
  ): Promise<ObjectStorageWriteResult> {
    this.writeCount += 1;
    this.writeKeys.push(request.idempotencyKey);
    if (this.temporaryUnavailableOnce) {
      this.temporaryUnavailableOnce = false;
      throw new ObjectStorageError(
        "OBJECT_STORAGE_PROVIDER_TEMPORARY_FAILURE",
        "temporary provider failure",
        { retryable: true },
      );
    }
    this.onWrite?.();
    if (this.delayMs > 0) {
      await waitForDelay(this.delayMs, request.signal);
    }
    const chunks: Buffer[] = [];
    for await (const rawChunk of request.source) {
      const chunk = Buffer.isBuffer(rawChunk)
        ? rawChunk
        : Buffer.from(rawChunk);
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    const checksumSha256 = createHash("sha256")
      .update(bytes)
      .digest("hex");
    if (
      BigInt(bytes.byteLength) !== request.expectedSizeBytes ||
      checksumSha256 !== request.expectedChecksumSha256
    ) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_CHECKSUM_MISMATCH",
        "fake checksum mismatch",
      );
    }
    this.objects.set(request.objectKey, {
      bytes,
      checksumSha256,
      idempotencyKey: request.idempotencyKey,
    });
    if (this.dropWriteResponseOnce) {
      this.dropWriteResponseOnce = false;
      throw new ObjectStorageError(
        "OBJECT_STORAGE_WRITE_UNCERTAIN",
        "response lost after immutable write",
      );
    }
    const providerVersionId = this.wrongVersionOnce
      ? "wrong-provider-version"
      : versionIdFor(bytes);
    this.wrongVersionOnce = false;
    return this.writeResult(request, bytes, providerVersionId);
  }

  async discoverExact(
    request: ObjectStorageExactDiscoveryRequest,
  ): Promise<ObjectStorageExactDiscoveryResult> {
    this.discoveryCount += 1;
    this.discoveryKeys.push(request.idempotencyKey);
    const object = this.objects.get(request.objectKey);
    if (!object) {
      return { status: "NOT_FOUND", requestId: request.idempotencyKey };
    }
    if (object.idempotencyKey !== request.idempotencyKey) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_BINDING_INVALID",
        "discovery idempotency identity does not match write result",
      );
    }
    if (
      BigInt(object.bytes.byteLength) !== request.expectedSizeBytes ||
      object.checksumSha256 !== request.expectedChecksumSha256
    ) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_CHECKSUM_MISMATCH",
        "discovered object does not match snapshot",
      );
    }
    return {
      status: "FOUND",
      version: {
        ...this.provider,
        objectKey: request.objectKey,
        providerVersionId: versionIdFor(object.bytes),
        providerGeneration: 1n,
      },
      sizeBytes: BigInt(object.bytes.byteLength),
      checksumSha256: object.checksumSha256,
      etag: null,
      requestId: request.idempotencyKey,
    };
  }

  async readExact(
    request: ObjectStorageExactReadRequest,
  ): Promise<ObjectStorageExactReadResult> {
    const object = this.objects.get(request.version.objectKey);
    if (!object) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_NOT_FOUND",
        "fake object missing",
      );
    }
    if (
      request.version.providerVersionId !== versionIdFor(object.bytes) ||
      object.checksumSha256 !== request.expectedChecksumSha256 ||
      BigInt(object.bytes.byteLength) !== request.expectedSizeBytes
    ) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_VERSION_MISMATCH",
        "fake exact read mismatch",
      );
    }
    return {
      bytes: object.bytes,
      sizeBytes: BigInt(object.bytes.byteLength),
      checksumSha256: object.checksumSha256,
      requestId: request.version.providerVersionId,
    };
  }

  private writeResult(
    request: ObjectStorageWriteRequest,
    bytes: Buffer,
    providerVersionId: string,
  ): ObjectStorageWriteResult {
    return {
      version: {
        ...this.provider,
        objectKey: request.objectKey,
        providerVersionId,
        providerGeneration: 1n,
      },
      sizeBytes: BigInt(bytes.byteLength),
      checksumSha256: createHash("sha256")
        .update(bytes)
        .digest("hex"),
      etag: null,
      requestId: request.idempotencyKey,
    };
  }
}

async function waitForDelay(
  delayMs: number,
  signal: AbortSignal | undefined,
): Promise<void> {
  if (signal?.aborted) {
    throw new ObjectStorageError(
      "OBJECT_STORAGE_WRITE_UNCERTAIN",
      "write aborted",
    );
  }
  await new Promise<void>((resolve, reject) => {
    const finish = (): void => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const abort = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(
        new ObjectStorageError(
          "OBJECT_STORAGE_WRITE_UNCERTAIN",
          "write aborted",
        ),
      );
    };
    const timer = setTimeout(finish, delayMs);
    signal?.addEventListener(
      "abort",
      abort,
      { once: true },
    );
  });
}

function upload(
  adapter: ObjectStorageAdapter,
  overrides: Partial<
    Pick<
      CompleteObjectUploadInput,
      "nodeEnvironment" | "leaseMs" | "leaseRenewIntervalMs"
    >
  > = {},
): ReturnType<typeof completeObjectUpload> {
  const input: CompleteObjectUploadInput = {
    actor,
    projectId: "project-1",
    intentId: "intent-1",
    requestContentLength: PDF_BYTES.byteLength,
    requestMimeType: "application/pdf",
    source: Readable.from([PDF_BYTES]),
    requestId: "request-1",
    objectStorage: adapter,
    nodeEnvironment: overrides.nodeEnvironment ?? "test",
    leaseMs: overrides.leaseMs ?? 120_000,
    leaseRenewIntervalMs:
      overrides.leaseRenewIntervalMs ?? 60_000,
  };
  return completeObjectUpload(input);
}

beforeEach(() => {
  harness.reset();
  harness.seedProject("project-1", "customer-1");
  harness.seedPendingIntent({
    id: "intent-1",
    projectId: "project-1",
    uploadedById: actor.userId,
  });
});

describe("completeObjectUpload service fault injection", () => {
  it("publishes one exact object and persists the same write identity", async () => {
    const adapter = new StrictObjectStorageAdapter();
    const result = await upload(adapter);
    const state = harness.currentState();

    expect(adapter.writeCount).toBe(1);
    expect(adapter.discoveryCount).toBe(0);
    expect(result.version.id).toBe(state.fileVersions[0]?.id);
    expect(state.intent?.status).toBe("COMPLETED");
    expect(state.attempt?.status).toBe("COMPLETED");
    expect(state.operation?.state).toBe("APPLIED");
    expect(state.operation?.writeIdempotencyKey).toBe(
      adapter.writeKeys[0],
    );
    expect(String(state.operation?.id)).toHaveLength(32);
    expect(String(state.attempt?.id)).toHaveLength(32);
    expect(state.binding?.state).toBe("VERIFIED");
    expect(state.fileVersions).toHaveLength(1);
    expect(harness.transactionOptions.length).toBeGreaterThan(0);
    for (const options of harness.transactionOptions) {
      expect(options).toEqual(
        expect.objectContaining({
          isolationLevel: "ReadCommitted",
        }),
      );
    }
    expect([...harness.files.values()]).toEqual([
      expect.objectContaining({
        createdByUploadIntentId: "intent-1",
        currentVersionId: state.fileVersions[0]?.id,
      }),
    ]);
  });

  it("uses the persisted write key after a Provider response loss", async () => {
    const adapter = new StrictObjectStorageAdapter();
    adapter.dropWriteResponseOnce = true;
    const result = await upload(adapter);
    const state = harness.currentState();

    expect(adapter.writeCount).toBe(1);
    expect(adapter.discoveryCount).toBe(1);
    expect(adapter.discoveryKeys[0]).toBe(adapter.writeKeys[0]);
    expect(result.version.id).toBe(state.fileVersions[0]?.id);
    expect(state.fileVersions).toHaveLength(1);
  });

  it("recovers an Observation DB failure by exact discovery on reentry", async () => {
    const adapter = new StrictObjectStorageAdapter();
    harness.failNextOperationLock = true;

    await expect(upload(adapter)).rejects.toBeDefined();
    let state = harness.currentState();
    expect(state.intent?.status).toBe("UPLOADING");
    expect(state.attempt?.status).toBe("RECOVERY_REQUIRED");
    expect(state.operation?.state).toBe("UNKNOWN");
    expect(state.binding?.writeObservedAt).toBeNull();
    expect(state.fileVersions).toHaveLength(0);

    harness.expireCurrentLease("intent-1");
    await upload(adapter);
    state = harness.currentState();
    expect(adapter.writeCount).toBe(1);
    expect(adapter.discoveryCount).toBe(1);
    expect(adapter.discoveryKeys[0]).toBe(adapter.writeKeys[0]);
    expect(state.fileVersions).toHaveLength(1);
    expect(state.intent?.status).toBe("COMPLETED");
  });

  it("confirms a Finalization COMMIT response loss without publishing twice", async () => {
    const adapter = new StrictObjectStorageAdapter();
    harness.nextCommitResponseLoss = "FINALIZATION";

    await expect(upload(adapter)).resolves.toMatchObject({
      version: { id: expect.any(String) },
    });
    expect(adapter.writeCount).toBe(1);
    expect(harness.currentState().fileVersions).toHaveLength(1);
  });

  it("recovers a reservation COMMIT response loss before dispatch", async () => {
    const adapter = new StrictObjectStorageAdapter();
    harness.nextCommitResponseLoss = "RESERVATION";

    await expect(upload(adapter)).rejects.toBeDefined();
    expect(adapter.writeCount).toBe(0);
    harness.expireCurrentLease("intent-1");
    await upload(adapter);

    expect(adapter.writeCount).toBe(1);
    expect(harness.currentState().fileVersions).toHaveLength(1);
  });

  it("does not overwrite the current version when expected-current changed", async () => {
    harness.reset();
    harness.seedProject("project-1", "customer-1");
    harness.seedFile({
      id: "file-1",
      projectId: "project-1",
      customerId: "customer-1",
      currentVersionId: "version-current",
    });
    harness.seedPendingIntent({
      id: "intent-1",
      projectId: "project-1",
      uploadedById: actor.userId,
      existingFileId: "file-1",
      expectedCurrentFileVersionId: "version-old",
    });
    const adapter = new StrictObjectStorageAdapter();

    await expect(upload(adapter)).rejects.toMatchObject({
      code: "UPLOAD_TARGET_CHANGED",
    });
    expect(adapter.writeCount).toBe(0);
    expect(harness.currentState().fileVersions).toHaveLength(0);
  });

  it("retains recovery state on Provider temporary failure without a FileVersion", async () => {
    const adapter = new StrictObjectStorageAdapter();
    adapter.temporaryUnavailableOnce = true;

    await expect(upload(adapter)).rejects.toMatchObject({
      code: "OBJECT_STORAGE_UNAVAILABLE",
    });
    const state = harness.currentState();
    expect(state.fileVersions).toHaveLength(0);
    expect(state.operation?.state).toBe("UNKNOWN");
    expect(state.attempt?.status).toBe("RECOVERY_REQUIRED");
  });

  it("fails closed on an invalid Provider version without publishing", async () => {
    const adapter = new StrictObjectStorageAdapter();
    adapter.wrongVersionOnce = true;

    await expect(upload(adapter)).rejects.toMatchObject({
      code: "OBJECT_STORAGE_VERSION_MISMATCH",
    });
    expect(harness.currentState().fileVersions).toHaveLength(0);
  });

  it("runs two recovery entrants concurrently and publishes once", async () => {
    const adapter = new StrictObjectStorageAdapter();
    harness.failNextOperationLock = true;
    await expect(upload(adapter)).rejects.toBeDefined();
    harness.expireCurrentLease("intent-1");

    const results = await Promise.allSettled([
      upload(adapter),
      upload(adapter),
    ]);
    const fulfilled = results.filter(
      (result) => result.status === "fulfilled",
    );
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(adapter.writeCount).toBe(1);
    expect(harness.currentState().fileVersions).toHaveLength(1);
  });

  it("rejects a late old-generation update after recovery takeover", async () => {
    const adapter = new StrictObjectStorageAdapter();
    harness.failNextOperationLock = true;
    await expect(upload(adapter)).rejects.toBeDefined();
    const staleOperation = harness.currentState().operation;
    if (!staleOperation) {
      throw new Error("EXPECTED_STALE_OPERATION");
    }
    const staleOwner = staleOperation.ownerToken;
    const staleGeneration = staleOperation.fencingGeneration;
    harness.expireCurrentLease("intent-1");
    await upload(adapter);

    const staleWrite = await harness.storageObjectOperation.updateMany({
      where: {
        id: String(staleOperation.id),
        ownerToken: staleOwner,
        fencingGeneration: staleGeneration,
        state: "UNKNOWN",
      },
      data: {
        state: "APPLIED",
        completedAt: new Date(),
      },
    });

    expect(staleWrite.count).toBe(0);
    expect(harness.currentState().fileVersions).toHaveLength(1);
  });

  it("recovers a Finalization pre-commit failure from durable observation", async () => {
    const adapter = new StrictObjectStorageAdapter();
    harness.failFinalizationBeforeCommit = true;

    await expect(upload(adapter)).rejects.toBeDefined();
    let state = harness.currentState();
    expect(state.fileVersions).toHaveLength(0);
    expect(state.binding?.writeObservedAt).toBeInstanceOf(Date);

    harness.expireCurrentLease("intent-1");
    await upload(adapter);
    state = harness.currentState();
    expect(adapter.writeCount).toBe(1);
    expect(adapter.discoveryCount).toBe(0);
    expect(state.fileVersions).toHaveLength(1);
  });

  it("recovers an Observation COMMIT response loss from the committed row", async () => {
    const adapter = new StrictObjectStorageAdapter();
    harness.nextCommitResponseLoss = "BINDING_OBSERVATION";

    await expect(upload(adapter)).rejects.toBeDefined();
    expect(harness.currentState().binding?.writeObservedAt)
      .toBeInstanceOf(Date);
    harness.expireCurrentLease("intent-1");
    await upload(adapter);

    expect(adapter.writeCount).toBe(1);
    expect(adapter.discoveryCount).toBe(0);
    expect(harness.currentState().fileVersions).toHaveLength(1);
  });

  it("fails closed when the durable write identity is missing", async () => {
    const adapter = new StrictObjectStorageAdapter();
    harness.nextCommitResponseLoss = "RESERVATION";
    await expect(upload(adapter)).rejects.toBeDefined();

    const operation = harness.currentState().operation;
    if (!operation) {
      throw new Error("EXPECTED_OPERATION");
    }
    const storedOperation = harness.operations.get(operation.id);
    if (!storedOperation) {
      throw new Error("EXPECTED_STORED_OPERATION");
    }
    storedOperation.writeIdempotencyKey = null;
    harness.expireCurrentLease("intent-1");

    await expect(upload(adapter)).rejects.toMatchObject({
      code: "UPLOAD_RECOVERY_WRITE_IDENTITY_MISSING",
    });
    expect(adapter.writeCount).toBe(0);
  });

  it("aborts the old executor when heartbeat identity is lost", async () => {
    const adapter = new StrictObjectStorageAdapter();
    adapter.delayMs = 80;
    adapter.onWrite = () => {
      harness.failNextLeaseLookup = true;
    };

    await expect(
      upload(adapter, {
        leaseMs: 200,
        leaseRenewIntervalMs: 10,
      }),
    ).rejects.toMatchObject({
      code: "OBJECT_STORAGE_WRITE_UNCERTAIN",
    });
    expect(harness.currentState().fileVersions).toHaveLength(0);
  });

  it("rejects direct Local Adapter injection outside development/test", async () => {
    const adapter = new LocalObjectStorageAdapter("storage/private");

    await expect(
      upload(adapter, { nodeEnvironment: "production" }),
    ).rejects.toMatchObject({
      code: "OBJECT_STORAGE_ADAPTER_NOT_ALLOWED",
    });
    expect(harness.currentState().intent?.status).toBe("PENDING");
  });
});
