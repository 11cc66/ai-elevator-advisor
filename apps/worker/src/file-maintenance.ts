import { randomUUID } from "node:crypto";

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
  failExhaustedUnclaimedFileExtraction,
  recoverExpiredFileExtraction,
} from "./file-processing-state.js";
import { logger } from "./logger.js";

const STALE_UPLOADING_MS = 15 * 60 * 1000;
const MAINTENANCE_LOCK_KEY = "file_maintenance_lease";

export interface FileMaintenanceResult {
  skipped: boolean;
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
}): Promise<FileMaintenanceResult> {
  const owner = randomUUID();
  const now = new Date();
  const acquired = await acquireMaintenanceLease({
    ...input,
    owner,
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
      requeued: 0,
      recoveredProcessing: 0,
      exhaustedProcessing: 0,
      expiredIntents: 0,
      removedOrphanObjects: 0,
      removedTempEntries: 0,
      cleanupFailures: 0,
    };
  }

  try {
    await input.testHooks?.afterLease?.();
    return await runFileMaintenanceUnlocked(input);
  } finally {
    await releaseMaintenanceLease(input.prisma, owner).catch((error) => {
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

async function acquireMaintenanceLease(input: {
  prisma: PrismaClient;
  env: WorkerEnv;
  owner: string;
  now: Date;
}): Promise<boolean> {
  const expiresAt = new Date(
    input.now.getTime() + input.env.FILE_MAINTENANCE_LEASE_MS,
  );
  const payload = JSON.stringify({
    owner: input.owner,
    expiresAt: expiresAt.toISOString(),
  });
  const rows = await input.prisma.$queryRaw<
    Array<{ owner: string | null }>
  >`
    INSERT INTO "system_metadata"
      ("id", "key", "value", "created_at", "updated_at")
    VALUES
      (
        ${randomUUID()},
        ${MAINTENANCE_LOCK_KEY},
        ${payload}::jsonb,
        ${input.now},
        ${input.now}
      )
    ON CONFLICT ("key") DO UPDATE
    SET
      "value" = EXCLUDED."value",
      "updated_at" = EXCLUDED."updated_at"
    WHERE COALESCE(
      ("system_metadata"."value"->>'expiresAt')::timestamptz,
      '-infinity'::timestamptz
    ) < ${input.now}
    RETURNING "value"->>'owner' AS "owner"
  `;
  return rows[0]?.owner === input.owner;
}

async function releaseMaintenanceLease(
  prisma: PrismaClient,
  owner: string,
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "system_metadata"
    SET
      "value" = jsonb_set(
        "value",
        '{expiresAt}',
        to_jsonb(${new Date().toISOString()}::text)
      ),
      "updated_at" = ${new Date()}
    WHERE "key" = ${MAINTENANCE_LOCK_KEY}
      AND "value"->>'owner' = ${owner}
  `;
}

async function runFileMaintenanceUnlocked(input: {
  prisma: PrismaClient;
  boss: PgBoss;
  storage: LocalPrivateStorage;
  env: WorkerEnv;
}): Promise<FileMaintenanceResult> {
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
    );
  const removedTempEntries = await input.storage.cleanupTemp(
    input.env.TEMP_RETENTION_MS,
    (error) => recordCleanupFailure("temp_entry", error),
  );
  const result = {
    skipped: false,
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
