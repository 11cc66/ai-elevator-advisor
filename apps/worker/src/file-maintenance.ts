import {
  FILE_RECOGNITION_QUEUE,
  type FileRecognitionJob,
} from "@elevator/contracts";
import type { LocalPrivateStorage } from "@elevator/file-storage";
import type { PrismaClient } from "@prisma/client";
import type { PgBoss } from "pg-boss";

import type { WorkerEnv } from "./config.js";
import { logger } from "./logger.js";

const STALE_UPLOADING_MS = 15 * 60 * 1000;
const STALE_PROCESSING_MS = 5 * 60 * 1000;

export interface FileMaintenanceResult {
  requeued: number;
  recoveredProcessing: number;
  expiredIntents: number;
  removedOrphanObjects: number;
  removedTempEntries: number;
}

export async function runFileMaintenance(input: {
  prisma: PrismaClient;
  boss: PgBoss;
  storage: LocalPrivateStorage;
  env: WorkerEnv;
}): Promise<FileMaintenanceResult> {
  const now = new Date();
  const staleProcessing = new Date(
    now.getTime() - STALE_PROCESSING_MS,
  );
  let recoveredProcessing = 0;

  const staleExtractions = await input.prisma.fileExtraction.findMany({
    where: {
      status: "PROCESSING",
      startedAt: { lt: staleProcessing },
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
    const updated = await input.prisma.$transaction(async (tx) => {
      const changed = await tx.fileExtraction.updateMany({
        where: {
          id: extraction.id,
          status: "PROCESSING",
          startedAt: { lt: staleProcessing },
        },
        data: {
          status: "QUEUED",
          startedAt: null,
          completedAt: null,
          safeErrorCode: null,
          safeErrorMessage: null,
        },
      });

      if (changed.count === 1) {
        const latest = await tx.fileExtraction.findFirst({
          where: { fileVersionId: extraction.fileVersionId },
          orderBy: { extractionVersion: "desc" },
          select: { id: true },
        });
        if (latest?.id === extraction.id) {
          await tx.fileVersion.update({
            where: { id: extraction.fileVersionId },
            data: { recognitionStatus: "QUEUED" },
          });
        }
        await tx.auditLog.create({
          data: {
            actorUserId: extraction.fileVersion.uploadedById,
            action: "file.extraction.recovered",
            objectType: "FileVersion",
            objectId: extraction.fileVersionId,
            reason: "STALE_PROCESSING_JOB",
            newValue: { extractionId: extraction.id },
          },
        });
      }
      return changed.count;
    });

    recoveredProcessing += updated;
  }

  const queued = await input.prisma.fileExtraction.findMany({
    where: { status: "QUEUED" },
    orderBy: { queuedAt: "asc" },
    take: 100,
    select: {
      id: true,
      fileVersionId: true,
      fileVersion: {
        select: { uploadedById: true },
      },
    },
  });
  let requeued = 0;

  for (const extraction of queued) {
    const job: FileRecognitionJob = {
      extractionId: extraction.id,
      fileVersionId: extraction.fileVersionId,
      requestedByUserId: extraction.fileVersion.uploadedById,
      trigger: "UPLOAD",
    };
    await input.boss.send(FILE_RECOGNITION_QUEUE, job, {
      singletonKey: extraction.id,
      retryLimit: 2,
      retryDelay: 5,
      expireInSeconds: 180,
    });
    requeued += 1;
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

  for (const intent of expiredIntents) {
    await input.storage
      .removeStaging(intent.stagingKey)
      .catch(() => undefined);
    if (
      !intent.completedFileVersionId &&
      intent.objectStorageKey
    ) {
      await input.storage
        .removeObject(intent.objectStorageKey)
        .catch(() => undefined);
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
    );
  const removedTempEntries = await input.storage.cleanupTemp(
    input.env.TEMP_RETENTION_MS,
  );
  const result = {
    requeued,
    recoveredProcessing,
    expiredIntents: expiredCount,
    removedOrphanObjects,
    removedTempEntries,
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
