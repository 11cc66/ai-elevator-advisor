import { Readable } from "node:stream";

import {
  LegacyStorageCleanupDisabledError,
  type StorageRuntimeCapability,
} from "@elevator/file-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
    },
    fileUploadIntent: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  appendAuditLog: vi.fn(async () => undefined),
  enqueueFileRecognition: vi.fn(async () => undefined),
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
  detectAllowedFileType: vi.fn(async () => ({
    mimeType: "application/pdf",
    extension: "pdf",
  })),
}));

vi.mock("@/server/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/modules/audit/log", () => ({
  appendAuditLog: mocks.appendAuditLog,
}));

vi.mock("@/server/jobs/file-recognition-queue", () => ({
  enqueueFileRecognition: mocks.enqueueFileRecognition,
}));

vi.mock("@/server/logger", () => ({
  logger: mocks.logger,
}));

vi.mock("@elevator/file-storage", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@elevator/file-storage")>();
  return {
    ...actual,
    detectAllowedFileType: mocks.detectAllowedFileType,
  };
});

import {
  cleanupExpiredUploadIntents,
  completeUpload,
  createUploadIntent,
} from "../src/modules/files/upload-service";
import type { Actor } from "../src/modules/access/actor";
import type { PermissionCode } from "../src/modules/access/permissions";

const actor: Actor = {
  userId: "user-1",
  globalPermissions: new Set<PermissionCode>(),
  projectPermissions: new Map<string, ReadonlySet<PermissionCode>>(),
};

const pdfBytes = Buffer.from(
  "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
);

function uploadIntent(overrides: Record<string, unknown> = {}) {
  return {
    id: "intent-1",
    requestKey: "request-1",
    requestFingerprint: "a".repeat(64),
    uploadedById: actor.userId,
    projectId: "project-1",
    buildingId: null,
    installationUnitId: null,
    existingFileId: "file-1",
    expectedCurrentFileVersionId: null,
    displayName: "demo.pdf",
    originalFilename: "demo.pdf",
    sanitizedFilename: "demo.pdf",
    declaredMimeType: "application/pdf",
    declaredSizeBytes: BigInt(pdfBytes.byteLength),
    stagingKey: "staging/intent-1.part",
    objectStorageKey: null,
    status: "PENDING",
    currentAttemptId: null,
    expiresAt: new Date(Date.now() + 60_000),
    claimedAt: null,
    completedAt: null,
    failureCode: null,
    completedFileVersionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    project: {
      customerId: "customer-1",
      dataClassification: "DEMO_MOCK",
    },
    ...overrides,
  };
}

function storageDouble() {
  return {
    writeToStaging: vi.fn(async () => ({
      stagingKey: "staging/intent-1.part",
      sizeBytes: BigInt(pdfBytes.byteLength),
      checksumSha256: "b".repeat(64),
      headerBytes: pdfBytes.subarray(0, 16),
      writerClosedAt: new Date(),
      closedIdentity: {
        dev: "1",
        ino: "2",
      },
    })),
    finalize: vi.fn(async () => undefined),
    verifyObjectChecksum: vi.fn(async () => ({
      valid: true,
      actualChecksumSha256: "b".repeat(64),
    })),
    readVerifiedObject: vi.fn(async () => ({
      bytes: pdfBytes,
      sizeBytes: BigInt(pdfBytes.byteLength),
      checksumSha256: "b".repeat(64),
    })),
    openReadStream: vi.fn(() => Readable.from([pdfBytes])),
  } as StorageRuntimeCapability & {
    writeToStaging: ReturnType<typeof vi.fn>;
    finalize: ReturnType<typeof vi.fn>;
  };
}

function expectNoDeleteCapability(
  storage: StorageRuntimeCapability,
): void {
  expect("removeStaging" in storage).toBe(false);
  expect("removeObject" in storage).toBe(false);
  expect("cleanupOrphanObjects" in storage).toBe(false);
  expect("cleanupTemp" in storage).toBe(false);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("legacy Web cleanup shutdown", () => {
  it("fails closed without touching storage deletion capabilities", async () => {
    const storage = storageDouble();

    await expect(
      cleanupExpiredUploadIntents(storage),
    ).rejects.toBeInstanceOf(LegacyStorageCleanupDisabledError);

    expectNoDeleteCapability(storage);
  });

  it("does not invoke expired-intent cleanup while creating an Intent", async () => {
    const storage = storageDouble();
    mocks.prisma.project.findUnique.mockResolvedValue({
      id: "project-1",
      customerId: "customer-1",
    });
    mocks.prisma.fileUploadIntent.findUnique.mockResolvedValue(null);
    mocks.prisma.fileUploadIntent.create.mockResolvedValue(uploadIntent());

    await createUploadIntent(
      actor,
      "project-1",
      "request-1",
      {
        displayName: "demo.pdf",
        originalFilename: "demo.pdf",
        declaredMimeType: "application/pdf",
        declaredSizeBytes: pdfBytes.byteLength,
        buildingId: undefined,
        installationUnitId: undefined,
        existingFileId: undefined,
      },
      storage,
    );

    expect(mocks.prisma.fileUploadIntent.findMany).not.toHaveBeenCalled();
    expectNoDeleteCapability(storage);
  });
});

describe("complete upload cleanup shutdown", () => {
  it.each([undefined, "staging", "production", "unknown", "test "])(
    "fails closed without an exact adapter in NODE_ENV=%s",
    async (nodeEnvironment) => {
      const storage = storageDouble();
      vi.stubEnv("NODE_ENV", nodeEnvironment);

      try {
        await expect(
          completeUpload({
            actor,
            projectId: "project-1",
            intentId: "intent-1",
            requestContentLength: pdfBytes.byteLength,
            requestMimeType: "application/pdf",
            source: Readable.from([pdfBytes]),
            requestId: "request-1",
            storage,
          }),
        ).rejects.toMatchObject({ code: "OBJECT_STORAGE_REQUIRED" });
        expect(storage.writeToStaging).not.toHaveBeenCalled();
        expect(storage.finalize).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllEnvs();
      }
    },
  );

  it.each([
    ["explicit commit failure", new Error("COMMIT_FAILED")],
    [
      "unknown commit result",
      new Error("CONNECTION_LOST_AFTER_COMMIT_SENT"),
    ],
  ])(
    "retains the finalized canonical object after %s",
    async (_caseName, transactionError) => {
      const storage = storageDouble();
      mocks.prisma.fileUploadIntent.findUnique.mockResolvedValue(
        uploadIntent(),
      );
      mocks.prisma.fileUploadIntent.updateMany.mockResolvedValue({
        count: 1,
      });
      mocks.prisma.$transaction.mockRejectedValue(transactionError);

      await expect(
        completeUpload({
          actor,
          projectId: "project-1",
          intentId: "intent-1",
          requestContentLength: pdfBytes.byteLength,
          requestMimeType: "application/pdf",
          source: Readable.from([pdfBytes]),
          requestId: "request-1",
          storage,
        }),
      ).rejects.toMatchObject({ code: "UPLOAD_FAILED" });

      expect(storage.finalize).toHaveBeenCalledTimes(1);
      expectNoDeleteCapability(storage);
      expect(mocks.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "file.upload_failed_artifacts_retained",
          canonicalObjectFinalized: true,
          recoveryRequired: true,
        }),
        "File upload failed; physical artifacts were retained",
      );
    },
  );

  it("retains the canonical object when commit succeeds and notification fails", async () => {
    const storage = storageDouble();
    const version = {
      id: "version-1",
      fileId: "file-1",
      storageKey: "objects/upload-1.pdf",
    };
    const extraction = { id: "extraction-1" };
    const tx = {
      $executeRaw: vi.fn(async () => 1),
      $queryRaw: vi.fn(async () => [
        { currentVersionId: null },
      ]),
      file: {
        update: vi.fn(async () => ({})),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      fileVersion: {
        aggregate: vi.fn(async () => ({ _max: { versionNumber: 0 } })),
        create: vi.fn(async () => version),
        update: vi.fn(async () => version),
        findUniqueOrThrow: vi.fn(async () => version),
      },
      fileExtraction: {
        create: vi.fn(async () => extraction),
      },
      fileUploadIntent: {
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
    };
    mocks.prisma.fileUploadIntent.findUnique.mockResolvedValue(
      uploadIntent(),
    );
    mocks.prisma.fileUploadIntent.updateMany.mockResolvedValue({
      count: 1,
    });
    mocks.prisma.$transaction.mockImplementation(
      async (callback: (value: typeof tx) => unknown) => callback(tx),
    );
    mocks.enqueueFileRecognition.mockRejectedValue(
      new Error("QUEUE_UNAVAILABLE"),
    );

    await expect(
      completeUpload({
        actor,
        projectId: "project-1",
        intentId: "intent-1",
        requestContentLength: pdfBytes.byteLength,
        requestMimeType: "application/pdf",
        source: Readable.from([pdfBytes]),
        requestId: "request-1",
        storage,
      }),
    ).resolves.toMatchObject({
      version,
      extractionId: extraction.id,
    });

    expect(storage.finalize).toHaveBeenCalledTimes(1);
    expectNoDeleteCapability(storage);
  });
});
