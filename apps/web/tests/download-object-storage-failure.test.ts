import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import {
  LocalObjectStorageAdapter,
  ObjectStorageError,
  type ObjectStorageReadCapability,
  type ObjectStorageExactReadRequest,
} from "@elevator/file-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const update = vi.fn(async () => undefined);
  const securityCreate = vi.fn(async () => undefined);
  return {
    update,
    securityCreate,
    prisma: {
      file: {
        findFirst: vi.fn(async () => ({
          id: "file-1",
          currentVersionId: "version-1",
        })),
      },
      fileVersion: {
        findFirst: vi.fn(async () => ({
          id: "version-1",
          fileId: "file-1",
          storageKey: "objects/object-1",
          storageBackend: "OBJECT_STORE",
          sizeBytes: 32n,
          checksumSha256: "0".repeat(64),
          uploadStatus: "UPLOADED",
          validationStatus: "PASSED",
          integrityStatus: "VERIFIED",
          malwareScanStatus: "CLEAN",
          detectedMimeType: "application/pdf",
          sanitizedFilename: "demo.pdf",
          creationOperationAttemptId: "operation-1",
          storageObjectBinding: {
            state: "VERIFIED",
            operationId: "operation-1",
            objectKey: "objects/object-1",
            sizeBytes: 32n,
            checksumSha256: "0".repeat(64),
            providerKind: "FAKE_TEST",
            accountScopeRef: "TEST",
            region: "TEST",
            bucketOrContainer: "bucket",
            providerVersionId: "version",
            providerGeneration: 1n,
            writeObservedAt: new Date(),
          },
        })),
        update,
      },
      fileSecurityEvent: {
        create: securityCreate,
      },
      auditLog: {
        create: vi.fn(async () => undefined),
      },
      $transaction: vi.fn(
        async (
          callback: (tx: {
            fileVersion: { update: typeof update };
            fileSecurityEvent: { create: typeof securityCreate };
          }) => Promise<unknown>,
        ) =>
          callback({
            fileVersion: { update },
            fileSecurityEvent: { create: securityCreate },
          }),
      ),
    },
  };
});

vi.mock("@/server/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/modules/audit/log", () => ({
  appendAuditLog: vi.fn(async () => undefined),
}));

vi.mock("@/server/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import type { Actor } from "../src/modules/access/actor";
import { prepareFileDownload } from "../src/modules/files/download-service";

const PDF_BYTES = Buffer.from(
  "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
);
const PDF_HASH = createHash("sha256").update(PDF_BYTES).digest("hex");

const actor: Actor = {
  userId: "user-1",
  globalPermissions: new Set(),
  projectPermissions: new Map(),
};

async function seedVersion(): Promise<void> {
  const version = await mocks.prisma.fileVersion.findFirst();
  version.sizeBytes = BigInt(PDF_BYTES.byteLength);
  version.checksumSha256 = PDF_HASH;
  if (version.storageObjectBinding) {
    version.storageObjectBinding.sizeBytes = BigInt(PDF_BYTES.byteLength);
    version.storageObjectBinding.checksumSha256 = PDF_HASH;
  }
}

class ReadOnlyObjectStorage implements ObjectStorageReadCapability {
  readonly provider = {
    providerKind: "FAKE_TEST",
    accountScopeRef: "TEST",
    region: "TEST",
    bucketOrContainer: "bucket",
  };

  readonly capabilities = {
    immutableWrite: "UNSUPPORTED" as const,
    exactVersionRead: "SUPPORTED" as const,
    exactVersionIdentity: "SUPPORTED" as const,
    checksumReadback: "SUPPORTED" as const,
    exactWriteDiscovery: "UNSUPPORTED" as const,
  };

  corrupt = false;
  operationalFailureCode:
    | "OBJECT_STORAGE_PROVIDER_TEMPORARY_FAILURE"
    | "OBJECT_STORAGE_PROVIDER_CONFIGURATION_UNAVAILABLE"
    | null = null;

  async readExact(
    _request: ObjectStorageExactReadRequest,
  ) {
    if (this.corrupt) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_CHECKSUM_MISMATCH",
        "corrupt object",
      );
    }
    if (this.operationalFailureCode) {
      throw new ObjectStorageError(
        this.operationalFailureCode,
        "operational failure",
      );
    }
    return {
      bytes: PDF_BYTES,
      sizeBytes: BigInt(PDF_BYTES.byteLength),
      checksumSha256: PDF_HASH,
      requestId: "read-1",
    };
  }
}

function download(
  objectStorage?: ObjectStorageReadCapability,
  nodeEnvironment = "test",
) {
  return prepareFileDownload({
    actor,
    projectId: "project-1",
    fileId: "file-1",
    versionId: "version-1",
    requestId: "request-1",
    env: {
      NODE_ENV: nodeEnvironment,
      DATABASE_URL: "postgresql://redacted",
      LOG_LEVEL: "silent",
      BETTER_AUTH_URL: "http://127.0.0.1",
      BETTER_AUTH_SECRET: "x".repeat(32),
      PRIVATE_STORAGE_ROOT: "storage/private",
      FILE_ACCESS_MODE: "enforce",
      FILE_PROCESSING_MAX_ATTEMPTS: 3,
      FILE_PROCESSING_RETRY_DELAY_SECONDS: 5,
      FILE_PROCESSING_RETRY_MAX_SECONDS: 60,
      FILE_PROCESSING_JOB_EXPIRE_SECONDS: 180,
      FILE_DOWNLOAD_MAX_CONCURRENT: 4,
      FILE_DOWNLOAD_BUFFER_BUDGET_BYTES: 64 * 1024 * 1024,
      FILE_DOWNLOAD_RESPONSE_TIMEOUT_MS: 30_000,
    },
    storage: {
      verifyObjectChecksum: vi.fn(async () => ({
        valid: true,
        actualChecksumSha256: PDF_HASH,
      })),
      readVerifiedObject: vi.fn(async () => ({
        bytes: PDF_BYTES,
        sizeBytes: BigInt(PDF_BYTES.byteLength),
        checksumSha256: PDF_HASH,
      })),
      openReadStream: vi.fn(() => Readable.from([PDF_BYTES])),
    },
    objectStorage,
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  await seedVersion();
});

describe("download object storage operational failures", () => {
  it("does not mark integrity failed when Adapter is unavailable", async () => {
    await expect(download()).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
      status: 503,
    });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.securityCreate).toHaveBeenCalledTimes(1);
  });

  it("allows exact verification after Adapter recovery", async () => {
    const prepared = await download(new ReadOnlyObjectStorage());
    expect(prepared.body).toEqual(PDF_BYTES);
    prepared.release();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          integrityStatus: "VERIFIED",
        }),
      }),
    );
  });

  it("marks a real object hash failure as integrity failure", async () => {
    const adapter = new ReadOnlyObjectStorage();
    adapter.corrupt = true;
    await expect(download(adapter)).rejects.toMatchObject({
      code: "FILE_INTEGRITY_FAILED",
      status: 409,
    });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { integrityStatus: "FAILED" },
      }),
    );
  });

  it("does not permanently fail integrity for temporary Provider outage", async () => {
    const adapter = new ReadOnlyObjectStorage();
    adapter.operationalFailureCode =
      "OBJECT_STORAGE_PROVIDER_TEMPORARY_FAILURE";
    await expect(download(adapter)).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
      status: 503,
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects direct Local Object Adapter injection outside local environments", async () => {
    await expect(
      download(new LocalObjectStorageAdapter("storage/private"), "production"),
    ).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
      status: 503,
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("fails closed instead of reading LEGACY_LOCAL bytes in production", async () => {
    const version = await mocks.prisma.fileVersion.findFirst();
    mocks.prisma.fileVersion.findFirst.mockResolvedValueOnce({
      ...version,
      storageBackend: "LEGACY_LOCAL",
    });

    await expect(download(undefined, "production")).rejects.toMatchObject({
      code: "LEGACY_LOCAL_STORAGE_DISABLED",
      status: 503,
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
