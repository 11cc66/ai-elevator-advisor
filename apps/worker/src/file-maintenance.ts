import {
  buildFileProcessingRetryOptions,
  FILE_RECOGNITION_QUEUE,
  type FileRecognitionJob,
} from "@elevator/contracts";
import type { LocalPrivateStorage } from "@elevator/file-storage";
import type { PrismaClient } from "@prisma/client";
import type { PgBoss } from "pg-boss";

import type { WorkerEnv } from "./config.js";
import {
  acquireMaintenanceLease,
  MaintenanceLeaseController,
  MaintenanceLeaseLostError,
} from "./maintenance-lease.js";
import {
  failExhaustedUnclaimedFileExtraction,
  recoverExpiredFileExtraction,
} from "./file-processing-state.js";
import { logger } from "./logger.js";

const STALE_UPLOADING_MS = 15 * 60 * 1000;

export interface FileMaintenanceResult {
  skipped: boolean;
  leaseLost: boolean;
  requeued: number;
  recoveredProcessing: number;
  exhaustedProcessing: number;
  expiredIntents: number;
  removedOrphanObjects: number;
  removedTempEntries: number;
  cleanupFailures: number;
}

export async function runFileMaintenance(input: {
  prisma: PrismaClient;
  boss: PgBoss;
  storage: LocalPrivateStorage;
  env: WorkerEnv;
  testHooks?: {
    afterLease?: () => void | Promise<void>;
  };
  leasePolicy?: {
    leaseMs?: number;
    renewIntervalMs?: number;
  };
}): Promise<FileMaintenanceResult> {
  const leaseMs =
    input.leasePolicy?.leaseMs ?? input.env.FILE_MAINTENANCE_LEASE_MS;
  const renewIntervalMs =
    input.leasePolicy?.renewIntervalMs ??
    input.env.FILE_MAINTENANCE_RENEW_INTERVAL_MS;
  const now = new Date();
  const acquired = await acquireMaintenanceLease({
    prisma: input.prisma,
    leaseMs,
    now,
  });

  if (!acquired) {
    logger.info(
      {
        event: "file.maintenance.skipped",
        reason: "CONCURRENT_MAINTENANCE",
      },
      "File maintenance already running",
    );
    return {
      skipped: true,
      leaseLost: false,
      requeued: 0,
      recoveredProcessing: 0,
      exhaustedProcessing: 0,
      expiredIntents: 0,
      removedOrphanObjects: 0,
      removedTempEntries: 0,
      cleanupFailures: 0,
    };
  }

  const lease = new MaintenanceLeaseController({
    prisma: input.prisma,
    owner: acquired.owner,
    leaseMs,
    renewIntervalMs,
  });
  lease.start();

  try {
    await input.testHooks?.afterLease?.();
    await lease.assertHeld();
    return await runFileMaintenanceUnlocked(input, lease);
  } catch (error) {
    if (error instanceof MaintenanceLeaseLostError) {
      logger.warn(
        {
          event: "file.maintenance.aborted",
          reason: "LEASE_LOST",
        },
        "File maintenance stopped after losing its lease",
      );
      return {
        skipped: true,
        leaseLost: true,
        requeued: 0,
        recoveredProcessing: 0,
        exhaustedProcessing: 0,
        expiredIntents: 0,
        removedOrphanObjects: 0,
        removedTempEntries: 0,
        cleanupFailures: 0,
      };
    }
    throw error;
  } finally {
    await lease.stop();
    await lease.release().catch((error) => {
      logger.warn(
        {
          event: "file.maintenance.lease_release_failed",
          errorCode:
            error instanceof Error ? error.name : "UNKNOWN_ERROR",
        },
        "File maintenance lease release failed",
      );
    });
  }
}

async function runFileMaintenanceUnlocked(input: {
  prisma: PrismaClient;
  boss: PgBoss;
  storage: LocalPrivateStorage;
  env: WorkerEnv;
}, lease: MaintenanceLeaseController): Promise<FileMaintenanceResult> {
  const now = new Date();
  let recoveredProcessing = 0;
  let exhaustedProcessing = 0;

  const staleExtractions = await input.prisma.fileExtraction.findMany({
    where: {
      status: "PROCESSING",
      leaseExpiresAt: { lt: now },
    },
    take: 50,
    include: {
      fileVersion: {
        select: {
          id: true,
          uploadedById: true,
        },
      },
    },
  });

  for (const extraction of staleExtractions) {
    await lease.assertHeld();
    if (
      extraction.attempt >= input.env.FILE_PROCESSING_MAX_ATTEMPTS
    ) {
      const failed = await failExhaustedUnclaimedFileExtraction(
        input.prisma,
        {
          extractionId: extraction.id,
          fileVersionId: extraction.fileVersionId,
          expectedToken: extraction.processingToken,
          actorUserId: extraction.fileVersion.uploadedById,
          attempt: extraction.attempt,
          failedAt: now,
        },
      );
      if (failed) {
        exhaustedProcessing += 1;
      }
      continue;
    }

    if (!extraction.processingToken) {
      continue;
    }

    const recovered = await recoverExpiredFileExtraction(input.prisma, {
      extractionId: extraction.id,
      fileVersionId: extraction.fileVersionId,
      expectedToken: extraction.processingToken,
      actorUserId: extraction.fileVersion.uploadedById,
      now,
    });
    if (recovered) {
      recoveredProcessing += 1;
    }
  }

  const queued = await input.prisma.fileExtraction.findMany({
    where: { status: "QUEUED" },
    orderBy: { queuedAt: "asc" },
    take: 100,
    select: {
      id: true,
      fileVersionId: true,
      attempt: true,
      nextAttemptAt: true,
      fileVersion: {
        select: { uploadedById: true },
      },
    },
  });
  let requeued = 0;
  const retryOptions = buildFileProcessingRetryOptions({
    maxAttempts: input.env.FILE_PROCESSING_MAX_ATTEMPTS,
    retryDelaySeconds: input.env.FILE_PROCESSING_RETRY_DELAY_SECONDS,
    retryDelayMaxSeconds: input.env.FILE_PROCESSING_RETRY_MAX_SECONDS,
    jobExpireSeconds: input.env.FILE_PROCESSING_JOB_EXPIRE_SECONDS,
  });

  for (const extraction of queued) {
    await lease.assertHeld();
    if (
      extraction.attempt >= input.env.FILE_PROCESSING_MAX_ATTEMPTS
    ) {
      await failExhaustedUnclaimedFileExtraction(input.prisma, {
        extractionId: extraction.id,
        fileVersionId: extraction.fileVersionId,
        expectedToken: null,
        actorUserId: extraction.fileVersion.uploadedById,
        attempt: extraction.attempt,
        failedAt: now,
      });
      continue;
    }

    const job: FileRecognitionJob = {
      extractionId: extraction.id,
      fileVersionId: extraction.fileVersionId,
      requestedByUserId: extraction.fileVersion.uploadedById,
      trigger: "UPLOAD",
    };
    const sendOptions = {
      singletonKey: extraction.id,
      ...retryOptions,
    };
    const jobId =
      extraction.nextAttemptAt &&
      extraction.nextAttemptAt.getTime() > now.getTime()
        ? await input.boss.sendAfter(
            FILE_RECOGNITION_QUEUE,
            job,
            sendOptions,
            Math.max(
              1,
              Math.ceil(
                (extraction.nextAttemptAt.getTime() - now.getTime()) /
                  1_000,
              ),
            ),
          )
        : await input.boss.send(
            FILE_RECOGNITION_QUEUE,
            job,
            sendOptions,
          );
    if (jobId) {
      requeued += 1;
    }
  }

  const staleUploading = new Date(now.getTime() - STALE_UPLOADING_MS);
  const expiredIntents = await input.prisma.fileUploadIntent.findMany({
    where: {
      OR: [
        {
          status: { in: ["PENDING", "FAILED"] },
          expiresAt: { lt: now },
        },
        {
          status: "UPLOADING",
          claimedAt: { lt: staleUploading },
        },
      ],
    },
    take: 100,
    select: {
      id: true,
      stagingKey: true,
      objectStorageKey: true,
      completedFileVersionId: true,
      uploadedById: true,
    },
  });
  let expiredCount = 0;
  let cleanupFailures = 0;
  const recordCleanupFailure = (
    operation: string,
    error: unknown,
  ): void => {
    cleanupFailures += 1;
    logger.warn(
      {
        event: "file.cleanup.entry_failed",
        operation,
        errorCode:
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          typeof error.code === "string"
            ? error.code
            : error instanceof Error
              ? error.name
              : "UNKNOWN_ERROR",
      },
      "File cleanup entry failed",
    );
  };

  for (const intent of expiredIntents) {
    await lease.assertHeld();
    await input.storage
      .removeStaging(intent.stagingKey)
      .catch((error) =>
        recordCleanupFailure("expired_staging", error),
      );
    if (
      !intent.completedFileVersionId &&
      intent.objectStorageKey
    ) {
      await input.storage
        .removeObject(intent.objectStorageKey)
        .catch((error) =>
          recordCleanupFailure("expired_object", error),
        );
    }
    await lease.assertHeld();
    const updated = await input.prisma.$transaction(async (tx) => {
      const changed = await tx.fileUploadIntent.updateMany({
        where: {
          id: intent.id,
          status: { in: ["PENDING", "UPLOADING", "FAILED"] },
        },
        data: {
          status: "EXPIRED",
          failureCode: "UPLOAD_INTENT_EXPIRED",
        },
      });
      if (changed.count === 1) {
        await tx.auditLog.create({
          data: {
            actorUserId: intent.uploadedById,
            action: "file.upload_intent.expired",
            objectType: "FileUploadIntent",
            objectId: intent.id,
            reason: "UPLOAD_INTENT_EXPIRED",
          },
        });
      }
      return changed.count;
    });
    expiredCount += updated;
  }

  const [versions, activeIntents] = await Promise.all([
    input.prisma.fileVersion.findMany({
      select: { storageKey: true },
    }),
    input.prisma.fileUploadIntent.findMany({
      where: {
        status: { not: "EXPIRED" },
        objectStorageKey: { not: null },
      },
      select: { objectStorageKey: true },
    }),
  ]);
  const referencedObjectKeys = [
    ...versions.map((version) => version.storageKey),
    ...activeIntents.flatMap((intent) =>
      intent.objectStorageKey ? [intent.objectStorageKey] : [],
    ),
  ];
  const removedOrphanObjects =
    await input.storage.cleanupOrphanObjects(
      referencedObjectKeys,
      input.env.TEMP_RETENTION_MS,
      (error) => recordCleanupFailure("orphan_object", error),
      () => lease.assertHeld(),
    );
  const removedTempEntries = await input.storage.cleanupTemp(
    input.env.TEMP_RETENTION_MS,
    (error) => recordCleanupFailure("temp_entry", error),
    () => lease.assertHeld(),
  );
  const result = {
    skipped: false,
    leaseLost: false,
    requeued,
    recoveredProcessing,
    exhaustedProcessing,
    expiredIntents: expiredCount,
    removedOrphanObjects,
    removedTempEntries,
    cleanupFailures,
  };

  logger.info(
    {
      event: "file.maintenance.completed",
      ...result,
    },
    "File maintenance completed",
  );
  return result;
}
