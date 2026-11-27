import { randomUUID } from "node:crypto";

import { Prisma, PrismaClient } from "@prisma/client";

export interface P13TestFileVersionTransactionHooks {
  onTransactionStart?: (
    tx: Prisma.TransactionClient,
  ) => Promise<void>;
  beforeIntentUploading?: (
    tx: Prisma.TransactionClient,
  ) => Promise<void>;
  beforeFinalization?: (
    tx: Prisma.TransactionClient,
  ) => Promise<void>;
}

export interface P13TestFileVersionInput {
  fileId?: string;
  newFileTargetFileId?: string;
  skipCurrentPointerUpdate?: boolean;
  completionOrder?: "POINTER_FIRST" | "COMPLETION_FIRST";
  forceFinalCompletionGuardImmediate?: boolean;
  uploadedById: string;
  projectId: string;
  buildingId: string | null;
  installationUnitId: string | null;
  versionNumber: number;
  originalFilename: string;
  sanitizedFilename: string;
  declaredMimeType: string;
  detectedMimeType: string | null;
  sizeBytes: bigint;
  checksumSha256: string;
  storageKey?: string;
  uploadStatus?:
    | "PENDING"
    | "UPLOADED"
    | "FAILED";
  validationStatus?: "PENDING" | "PASSED" | "FAILED";
  integrityStatus?: "UNVERIFIED" | "VERIFIED" | "FAILED";
  recognitionStatus?:
    | "NOT_REQUESTED"
    | "QUEUED"
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED"
    | "BLOCKED";
  finalizedAt?: Date | null;
  completedTargetMode?:
    | "CREATED_VERSION"
    | "NULL"
    | "OVERRIDE";
  completedTargetFileVersionId?: string;
  transactionHooks?: P13TestFileVersionTransactionHooks;
}

/**
 * Test-only valid P1-3 fixture. It never represents a real upload or a real
 * historical local object; it exists so database invariant tests can create a
 * FileVersion without bypassing the P1-3 triggers.
 */
export async function createP13TestFileVersion(
  prisma: PrismaClient,
  input: P13TestFileVersionInput,
) {
  const overrideTarget = input.completedTargetFileVersionId;
  if (input.fileId && input.newFileTargetFileId) {
    throw new Error(
      "fileId and newFileTargetFileId cannot both be set",
    );
  }
  if (
    input.completedTargetMode === "OVERRIDE" &&
    !overrideTarget
  ) {
    throw new Error(
      "completedTargetFileVersionId is required for OVERRIDE",
    );
  }
  const makeDbId = () => randomUUID().replaceAll("-", "");
  const attemptId = makeDbId();
  const intentId = makeDbId();
  const stagingLifecycleId = makeDbId();
  const canonicalLifecycleId = makeDbId();
  const operationId = makeDbId();
  const stagingKey = `staging/${randomUUID()}.part`;
  const canonicalKey =
    input.storageKey?.startsWith("objects/")
      ? input.storageKey
      : `objects/${randomUUID()}`;
  const ownerToken = randomUUID().replaceAll("-", "");
  const closeAttestationId = randomUUID();
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + 120_000);

  return prisma.$transaction(async (tx) => {
    await input.transactionHooks?.onTransactionStart?.(tx);
    const existingFile = input.fileId
      ? await tx.file.findUniqueOrThrow({
          where: { id: input.fileId },
          select: {
            currentVersionId: true,
          },
        })
      : null;
    await tx.fileUploadIntent.create({
      data: {
        id: intentId,
        requestKey: randomUUID(),
        requestFingerprint: "f".repeat(64),
        uploadedById: input.uploadedById,
        projectId: input.projectId,
        buildingId: input.buildingId,
        installationUnitId: input.installationUnitId,
        existingFileId: input.fileId ?? null,
        expectedCurrentFileVersionId: existingFile?.currentVersionId ?? null,
        displayName: input.originalFilename,
        originalFilename: input.originalFilename,
        sanitizedFilename: input.sanitizedFilename,
        declaredMimeType: input.declaredMimeType,
        declaredSizeBytes: input.sizeBytes,
        stagingKey,
        status: "PENDING",
        expiresAt: new Date(now.getTime() + 600_000),
      },
    });
    await tx.storageObjectLifecycle.create({
      data: {
        id: stagingLifecycleId,
        objectKind: "STAGING",
        storageBackend: "LEGACY_LOCAL",
        storageKey: stagingKey,
        state: "STAGING_RESERVED",
        reservedAttemptId: attemptId,
        reservedIntentId: intentId,
        fencingGeneration: 0n,
        lastTransitionAt: now,
      },
    });
    await tx.fileUploadAttempt.create({
      data: {
        id: attemptId,
        intentId,
        stagingKey,
        status: "RESERVED",
      },
    });
    await input.transactionHooks?.beforeIntentUploading?.(tx);
    await tx.fileUploadIntent.update({
      where: { id: intentId },
      data: {
        status: "UPLOADING",
        currentAttemptId: attemptId,
        claimedAt: now,
      },
    });
    await tx.storageObjectLifecycle.update({
      where: { id: stagingLifecycleId },
      data: {
        state: "STAGING",
        ownerToken,
        fencingGeneration: 1n,
        leaseExpiresAt,
        lastTransitionAt: now,
      },
    });
    await tx.fileUploadAttempt.update({
      where: { id: attemptId },
      data: { status: "WRITING" },
    });
    await tx.storageObjectLifecycle.update({
      where: { id: stagingLifecycleId },
      data: {
        state: "STAGING_READY",
        sizeBytes: input.sizeBytes,
        checksumSha256: input.checksumSha256,
        closeAttestationId,
        closedByAttemptId: attemptId,
        closedOwnerToken: ownerToken,
        closedGeneration: 1n,
        writerClosedAt: now,
        closedDev: "TEST_DEV",
        closedIno: "TEST_INO",
        closedSizeBytes: input.sizeBytes,
        closedChecksumSha256: input.checksumSha256,
        closedIdentityVerified: true,
        lastTransitionAt: now,
      },
    });
    await tx.fileUploadAttempt.update({
      where: { id: attemptId },
      data: { status: "READY" },
    });
    await tx.storageObjectLifecycle.create({
      data: {
        id: canonicalLifecycleId,
        objectKind: "CANONICAL",
        storageBackend: "LEGACY_LOCAL",
        storageKey: canonicalKey,
        state: "FINALIZING",
        ownerToken,
        fencingGeneration: 1n,
        leaseExpiresAt,
        sizeBytes: input.sizeBytes,
        checksumSha256: input.checksumSha256,
        lastTransitionAt: now,
      },
    });
    /*
     * The canonical lifecycle begins in FINALIZING with no FileVersion. Its
     * deferred bijection event is therefore valid at this point. Settle that
     * event before the lifecycle later becomes ACTIVE in the same transaction
     * so the commit-time check observes only the final ACTIVE state.
     */
    await tx.$executeRawUnsafe(
      'SET CONSTRAINTS "p13_lifecycle_file_version_bijection_guard" IMMEDIATE',
    );
    await tx.$executeRawUnsafe(
      'SET CONSTRAINTS "p13_lifecycle_file_version_bijection_guard" DEFERRED',
    );
    await tx.storageObjectOperation.create({
      data: {
        id: operationId,
        objectLifecycleId: canonicalLifecycleId,
        storageKey: canonicalKey,
        sourceAttemptId: attemptId,
        operationType: "FINALIZE",
        state: "PREPARED",
        ownerToken,
        fencingGeneration: 1n,
        leaseExpiresAt,
        sourcePath: stagingKey,
        targetPath: canonicalKey,
        expectedSizeBytes: input.sizeBytes,
        expectedChecksumSha256: input.checksumSha256,
      },
    });
    await tx.storageObjectLifecycle.update({
      where: { id: canonicalLifecycleId },
      data: { currentOperationId: operationId },
    });
    await tx.$executeRawUnsafe(
      'SET CONSTRAINTS "p13_lifecycle_file_version_bijection_guard" IMMEDIATE',
    );
    await tx.$executeRawUnsafe(
      'SET CONSTRAINTS "p13_lifecycle_file_version_bijection_guard" DEFERRED',
    );
    await tx.fileUploadAttempt.update({
      where: { id: attemptId },
      data: {
        status: "FINALIZING",
        canonicalStorageKey: canonicalKey,
      },
    });
    await tx.storageObjectOperation.update({
      where: { id: operationId },
      data: { state: "EXECUTING" },
    });
    await tx.storageObjectOperation.update({
      where: { id: operationId },
      data: {
        state: "APPLIED",
        leaseExpiresAt: null,
        completedAt: now,
      },
    });
    await tx.storageObjectLifecycle.update({
      where: { id: canonicalLifecycleId },
      data: {
        state: "ACTIVE",
        leaseExpiresAt: null,
        lastTransitionAt: now,
      },
    });
    await tx.storageObjectLifecycle.update({
      where: { id: stagingLifecycleId },
      data: {
        state: "DELETED",
        leaseExpiresAt: null,
        lastTransitionAt: now,
      },
    });
    await tx.fileUploadAttempt.update({
      where: { id: attemptId },
      data: { status: "COMPLETED", completedAt: now },
    });

    let fileId = input.fileId ?? input.newFileTargetFileId;
    if (!fileId) {
      const project = await tx.project.findUniqueOrThrow({
        where: { id: input.projectId },
        select: {
          customerId: true,
          dataClassification: true,
        },
      });
      const createdFile = await tx.file.create({
        data: {
          createdByUploadIntentId: intentId,
          customerId: project.customerId,
          projectId: input.projectId,
          buildingId: input.buildingId,
          installationUnitId: input.installationUnitId,
          displayName: input.originalFilename,
          dataClassification: project.dataClassification,
          createdById: input.uploadedById,
        },
      });
      fileId = createdFile.id;
    }

    const version = await tx.fileVersion.create({
      data: {
        fileId,
        versionNumber: input.versionNumber,
        originalFilename: input.originalFilename,
        sanitizedFilename: input.sanitizedFilename,
        declaredMimeType: input.declaredMimeType,
        detectedMimeType: input.detectedMimeType,
        sizeBytes: input.sizeBytes,
        checksumSha256: input.checksumSha256,
        storageKey: canonicalKey,
        storageBackend: "LEGACY_LOCAL",
        uploadIntentId: intentId,
        uploadAttemptId: attemptId,
        creationOperationAttemptId: operationId,
        uploadStatus: input.uploadStatus ?? "UPLOADED",
        validationStatus: input.validationStatus ?? "PASSED",
        integrityStatus: input.integrityStatus ?? "VERIFIED",
        recognitionStatus:
          input.recognitionStatus ?? "NOT_REQUESTED",
        uploadedById: input.uploadedById,
        finalizedAt: input.finalizedAt ?? now,
      },
    });
    await input.transactionHooks?.beforeFinalization?.(tx);
    const completeIntent = () =>
      tx.fileUploadIntent.update({
        where: { id: intentId },
        data: {
          status: "COMPLETED",
          currentAttemptId: null,
          completedAt: now,
          completedFileVersionId:
            input.completedTargetMode === "NULL"
              ? null
              : input.completedTargetMode === "OVERRIDE"
                && overrideTarget
                ? overrideTarget
                : version.id,
        },
      });
    const updateCurrentPointer = () =>
      tx.file.update({
        where: { id: fileId },
        data: { currentVersionId: version.id },
      });

    if (input.completionOrder === "COMPLETION_FIRST") {
      await completeIntent();
      if (!input.skipCurrentPointerUpdate) {
        await updateCurrentPointer();
      }
    } else {
      if (!input.skipCurrentPointerUpdate) {
        await updateCurrentPointer();
      }
      await completeIntent();
    }
    if (input.forceFinalCompletionGuardImmediate) {
      await tx.$executeRawUnsafe(
        'SET CONSTRAINTS "p13_completed_intent_final_guard" IMMEDIATE',
      );
    }
    return version;
  }, input.transactionHooks
    ? {
        maxWait: 10_000,
        timeout: 20_000,
      }
    : undefined);
}
