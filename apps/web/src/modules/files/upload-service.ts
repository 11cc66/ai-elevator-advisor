import { createHash, randomUUID } from "node:crypto";

import type { UploadIntentInput } from "@elevator/contracts";
import {
  detectAllowedFileType,
  filenameMatchesMimeType,
  sanitizeDisplayFilename,
  PrivateStorageError,
  type PrivateStorageAdapter,
} from "@elevator/file-storage";
import { Prisma } from "@prisma/client";
import type { Readable } from "node:stream";

import type { Actor } from "@/modules/access/actor";
import { appendAuditLog } from "@/modules/audit/log";
import { AppError } from "@/server/http/errors";
import { enqueueFileRecognition } from "@/server/jobs/file-recognition-queue";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";

const MAX_FILE_SIZE_BYTES = 20n * 1024n * 1024n;
const UPLOAD_INTENT_TTL_MS = 30 * 60 * 1000;
const STALE_UPLOAD_MS = 15 * 60 * 1000;

interface UploadTarget {
  customerId: string;
  projectId: string;
  buildingId: string | null;
  installationUnitId: string | null;
  existingFileId: string | null;
}

function requestFingerprint(
  projectId: string,
  input: UploadIntentInput,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        projectId,
        displayName: input.displayName,
        originalFilename: input.originalFilename,
        declaredMimeType: input.declaredMimeType,
        declaredSizeBytes: input.declaredSizeBytes,
        buildingId: input.buildingId ?? null,
        installationUnitId: input.installationUnitId ?? null,
        existingFileId: input.existingFileId ?? null,
      }),
    )
    .digest("hex");
}

async function validateUploadTarget(
  projectId: string,
  input: UploadIntentInput,
): Promise<UploadTarget> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, customerId: true },
  });

  if (!project) {
    throw new AppError("PROJECT_NOT_FOUND", "项目不存在。", 404);
  }

  let buildingId: string | null = null;
  let installationUnitId: string | null = null;

  if (input.buildingId) {
    const building = await prisma.building.findUnique({
      where: { id: input.buildingId },
      select: { id: true, projectId: true },
    });

    if (!building || building.projectId !== projectId) {
      throw new AppError(
        "BUILDING_PROJECT_MISMATCH",
        "建筑不属于当前项目。",
        400,
      );
    }

    buildingId = building.id;
  }

  if (input.installationUnitId) {
    if (!buildingId) {
      throw new AppError(
        "BUILDING_REQUIRED",
        "选择安装单元时必须同时选择建筑。",
        400,
      );
    }

    const unit = await prisma.installationUnit.findUnique({
      where: { id: input.installationUnitId },
      select: { id: true, buildingId: true },
    });

    if (!unit || unit.buildingId !== buildingId) {
      throw new AppError(
        "INSTALLATION_UNIT_BUILDING_MISMATCH",
        "安装单元不属于当前建筑。",
        400,
      );
    }

    installationUnitId = unit.id;
  }

  if (input.existingFileId) {
    const existingFile = await prisma.file.findUnique({
      where: { id: input.existingFileId },
      select: {
        id: true,
        customerId: true,
        projectId: true,
        buildingId: true,
        installationUnitId: true,
      },
    });

    if (
      !existingFile ||
      existingFile.customerId !== project.customerId ||
      existingFile.projectId !== projectId ||
      existingFile.buildingId !== buildingId ||
      existingFile.installationUnitId !== installationUnitId
    ) {
      throw new AppError(
        "EXISTING_FILE_TARGET_MISMATCH",
        "要追加版本的文件不属于当前项目归属。",
        400,
      );
    }
  }

  return {
    customerId: project.customerId,
    projectId,
    buildingId,
    installationUnitId,
    existingFileId: input.existingFileId ?? null,
  };
}

export async function cleanupExpiredUploadIntents(
  storage: PrivateStorageAdapter,
): Promise<number> {
  const now = new Date();
  const staleClaim = new Date(now.getTime() - STALE_UPLOAD_MS);
  const expired = await prisma.fileUploadIntent.findMany({
    where: {
      OR: [
        {
          status: { in: ["PENDING", "FAILED"] },
          expiresAt: { lt: now },
        },
        {
          status: "UPLOADING",
          claimedAt: { lt: staleClaim },
        },
      ],
    },
    orderBy: { expiresAt: "asc" },
    take: 50,
    select: {
      id: true,
      stagingKey: true,
      objectStorageKey: true,
      completedFileVersionId: true,
    },
  });

  for (const intent of expired) {
    await storage.removeStaging(intent.stagingKey).catch(() => undefined);
    if (
      !intent.completedFileVersionId &&
      intent.objectStorageKey
    ) {
      await storage
        .removeObject(intent.objectStorageKey)
        .catch(() => undefined);
    }
    await prisma.fileUploadIntent.updateMany({
      where: {
        id: intent.id,
        status: { in: ["PENDING", "UPLOADING", "FAILED"] },
      },
      data: {
        status: "EXPIRED",
        failureCode: "UPLOAD_INTENT_EXPIRED",
      },
    });
  }

  return expired.length;
}

export async function createUploadIntent(
  actor: Actor,
  projectId: string,
  requestKey: string,
  input: UploadIntentInput,
  storage: PrivateStorageAdapter,
) {
  const target = await validateUploadTarget(projectId, input);
  const sanitizedFilename = sanitizeDisplayFilename(
    input.originalFilename,
  );

  if (!filenameMatchesMimeType(sanitizedFilename, input.declaredMimeType)) {
    throw new AppError(
      "FILENAME_MIME_MISMATCH",
      "文件扩展名与声明的文件类型不一致。",
      400,
    );
  }

  await cleanupExpiredUploadIntents(storage);

  const fingerprint = requestFingerprint(projectId, input);
  const existing = await prisma.fileUploadIntent.findUnique({
    where: {
      uploadedById_requestKey: {
        uploadedById: actor.userId,
        requestKey,
      },
    },
  });

  if (existing) {
    if (existing.requestFingerprint !== fingerprint) {
      throw new AppError(
        "IDEMPOTENCY_KEY_REUSED",
        "同一幂等键不能用于不同的上传请求。",
        409,
      );
    }
    return existing;
  }

  const expiresAt = new Date(Date.now() + UPLOAD_INTENT_TTL_MS);
  const stagingKey = `staging/${randomUUID()}.part`;

  try {
    return await prisma.fileUploadIntent.create({
      data: {
        requestKey,
        requestFingerprint: fingerprint,
        uploadedById: actor.userId,
        projectId: target.projectId,
        buildingId: target.buildingId,
        installationUnitId: target.installationUnitId,
        existingFileId: target.existingFileId,
        displayName: input.displayName,
        originalFilename: sanitizedFilename,
        sanitizedFilename,
        declaredMimeType: input.declaredMimeType,
        declaredSizeBytes: BigInt(input.declaredSizeBytes),
        stagingKey,
        expiresAt,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await prisma.fileUploadIntent.findUnique({
        where: {
          uploadedById_requestKey: {
            uploadedById: actor.userId,
            requestKey,
          },
        },
      });

      if (raced?.requestFingerprint === fingerprint) {
        return raced;
      }
    }
    throw error;
  }
}

interface CompleteUploadInput {
  actor: Actor;
  projectId: string;
  intentId: string;
  requestContentLength: number | null;
  requestMimeType: string | null;
  source: Readable;
  requestId: string;
  storage: PrivateStorageAdapter;
}

async function markIntentFailed(
  intentId: string,
  failureCode: string,
): Promise<void> {
  await prisma.fileUploadIntent.updateMany({
    where: {
      id: intentId,
      status: { in: ["PENDING", "UPLOADING"] },
    },
    data: {
      status: "FAILED",
      failureCode,
    },
  });
}

export async function completeUpload(
  input: CompleteUploadInput,
) {
  const intent = await prisma.fileUploadIntent.findUnique({
    where: { id: input.intentId },
    include: {
      project: {
        select: {
          customerId: true,
          dataClassification: true,
        },
      },
    },
  });

  if (
    !intent ||
    intent.projectId !== input.projectId ||
    intent.uploadedById !== input.actor.userId
  ) {
    throw new AppError(
      "UPLOAD_INTENT_NOT_FOUND",
      "上传意图不存在。",
      404,
    );
  }

  if (intent.status === "COMPLETED" && intent.completedFileVersionId) {
    const version = await prisma.fileVersion.findUniqueOrThrow({
      where: { id: intent.completedFileVersionId },
    });
    const extraction = await prisma.fileExtraction.findFirstOrThrow({
      where: { fileVersionId: version.id },
      orderBy: { extractionVersion: "desc" },
      select: { id: true },
    });
    return { version, extractionId: extraction.id };
  }

  if (intent.status !== "PENDING") {
    throw new AppError(
      "UPLOAD_INTENT_NOT_AVAILABLE",
      "上传意图已过期、正在处理或已失败。",
      409,
    );
  }

  if (intent.expiresAt.getTime() <= Date.now()) {
    await markIntentFailed(intent.id, "UPLOAD_INTENT_EXPIRED");
    throw new AppError(
      "UPLOAD_INTENT_EXPIRED",
      "上传意图已过期。",
      410,
    );
  }

  if (
    input.requestContentLength === null ||
    !Number.isSafeInteger(input.requestContentLength) ||
    input.requestContentLength <= 0
  ) {
    throw new AppError(
      "CONTENT_LENGTH_REQUIRED",
      "上传请求必须提供有效的 Content-Length。",
      411,
    );
  }

  if (input.requestContentLength > MAX_FILE_SIZE_BYTES) {
    throw new AppError("FILE_TOO_LARGE", "文件不能超过 20 MiB。", 413);
  }

  if (BigInt(input.requestContentLength) !== intent.declaredSizeBytes) {
    throw new AppError(
      "CONTENT_LENGTH_MISMATCH",
      "实际上传长度与上传意图不一致。",
      400,
    );
  }

  if (
    !input.requestMimeType ||
    input.requestMimeType.toLowerCase() !==
      intent.declaredMimeType.toLowerCase()
  ) {
    throw new AppError(
      "REQUEST_MIME_MISMATCH",
      "请求文件类型与上传意图不一致。",
      415,
    );
  }

  const claimed = await prisma.fileUploadIntent.updateMany({
    where: {
      id: intent.id,
      uploadedById: input.actor.userId,
      projectId: input.projectId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    data: {
      status: "UPLOADING",
      claimedAt: new Date(),
    },
  });

  if (claimed.count !== 1) {
    throw new AppError(
      "UPLOAD_ALREADY_CLAIMED",
      "该上传正在由另一个请求处理。",
      409,
    );
  }

  let stagingCleanup = true;
  let objectKey: string | null = null;

  try {
    const written = await input.storage.writeToStaging(
      intent.stagingKey,
      input.source,
      MAX_FILE_SIZE_BYTES,
    );

    if (written.sizeBytes !== intent.declaredSizeBytes) {
      throw new AppError(
        "UPLOAD_SIZE_MISMATCH",
        "实际上传大小与声明大小不一致。",
        400,
      );
    }

    const detected = await detectAllowedFileType(written.headerBytes);

    if (detected.mimeType !== intent.declaredMimeType) {
      throw new AppError(
        "FILE_SIGNATURE_MISMATCH",
        "文件实际类型与声明类型不一致。",
        422,
      );
    }

    if (
      !filenameMatchesMimeType(
        intent.sanitizedFilename,
        detected.mimeType,
      )
    ) {
      throw new AppError(
        "FILENAME_MIME_MISMATCH",
        "文件扩展名与文件实际类型不一致。",
        422,
      );
    }

    objectKey = `objects/${randomUUID()}.${detected.extension}`;
    const objectClaimed = await prisma.fileUploadIntent.updateMany({
      where: {
        id: intent.id,
        status: "UPLOADING",
        objectStorageKey: null,
      },
      data: {
        objectStorageKey: objectKey,
      },
    });

    if (objectClaimed.count !== 1) {
      throw new AppError(
        "UPLOAD_OBJECT_KEY_CONFLICT",
        "上传对象状态发生并发冲突。",
        409,
      );
    }

    await input.storage.finalize(intent.stagingKey, objectKey);
    stagingCleanup = false;

    const completed = await prisma.$transaction(
      async (tx) => {
        let fileId = intent.existingFileId;

        if (!fileId) {
          const createdFile = await tx.file.create({
            data: {
              customerId: intent.project.customerId,
              projectId: intent.projectId,
              buildingId: intent.buildingId,
              installationUnitId: intent.installationUnitId,
              displayName: intent.displayName,
              dataClassification: intent.project.dataClassification,
              createdById: input.actor.userId,
            },
          });
          fileId = createdFile.id;
        }

        await tx.$executeRaw`
          UPDATE "file"
          SET "id" = "id"
          WHERE "id" = ${fileId}
        `;

        const latest = await tx.fileVersion.aggregate({
          where: { fileId },
          _max: { versionNumber: true },
        });
        const versionNumber =
          (latest._max.versionNumber ?? 0) + 1;
        const createdVersion = await tx.fileVersion.create({
          data: {
            fileId,
            versionNumber,
            originalFilename: intent.originalFilename,
            sanitizedFilename: intent.sanitizedFilename,
            declaredMimeType: intent.declaredMimeType,
            detectedMimeType: detected.mimeType,
            sizeBytes: written.sizeBytes,
            checksumSha256: written.checksumSha256,
            storageKey: objectKey!,
            uploadStatus: "UPLOADED",
            validationStatus: "PASSED",
            validationDetail: {
              signalMatches: true,
              sizeMatches: true,
            },
            malwareScanStatus: "SCAN_UNAVAILABLE",
            malwareScanDetail: {
              scannerConfigured: false,
            },
            integrityStatus: "VERIFIED",
            lastIntegrityVerifiedAt: new Date(),
            uploadRequestKey: intent.requestKey,
            uploadedById: input.actor.userId,
            uploadExpiresAt: intent.expiresAt,
            finalizedAt: new Date(),
          },
        });

        const extraction = await tx.fileExtraction.create({
          data: {
            fileVersionId: createdVersion.id,
            extractionVersion: 1,
            provider: "LOCAL_FILE_PROCESSOR",
            providerVersion: "phase3.4",
            dataClassification: intent.project.dataClassification,
            status: "QUEUED",
            queuedAt: new Date(),
          },
        });

        await tx.fileVersion.update({
          where: { id: createdVersion.id },
          data: { recognitionStatus: "QUEUED" },
        });

        await tx.file.update({
          where: { id: fileId },
          data: { currentVersionId: createdVersion.id },
        });

        const completed = await tx.fileUploadIntent.updateMany({
          where: {
            id: intent.id,
            status: "UPLOADING",
            completedFileVersionId: null,
          },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
            completedFileVersionId: createdVersion.id,
          },
        });

        if (completed.count !== 1) {
          throw new AppError(
            "UPLOAD_COMPLETION_CONFLICT",
            "上传完成状态发生并发冲突。",
            409,
          );
        }

        await appendAuditLog(tx, {
          actorUserId: input.actor.userId,
          action: "file.version.uploaded",
          objectType: "FileVersion",
          objectId: createdVersion.id,
          newValue: {
            fileId,
            versionNumber,
            checksumSha256: written.checksumSha256,
            sizeBytes: written.sizeBytes.toString(),
            detectedMimeType: detected.mimeType,
            malwareScanStatus: "SCAN_UNAVAILABLE",
          },
          requestId: input.requestId,
        });

        return {
          version: await tx.fileVersion.findUniqueOrThrow({
            where: { id: createdVersion.id },
          }),
          extractionId: extraction.id,
        };
      },
    );

    try {
      await enqueueFileRecognition({
        extractionId: completed.extractionId,
        fileVersionId: completed.version.id,
        requestedByUserId: input.actor.userId,
        trigger: "UPLOAD",
      });
    } catch (error) {
      logger.warn(
        {
          err: error,
          event: "file_queue.enqueue_failed",
          extractionId: completed.extractionId,
          fileVersionId: completed.version.id,
        },
        "File recognition queue dispatch failed; recovery is required",
      );
    }

    return completed;
  } catch (error) {
    if (objectKey) {
      await input.storage.removeObject(objectKey).catch(() => undefined);
    }
    if (stagingCleanup) {
      await input.storage
        .removeStaging(intent.stagingKey)
        .catch(() => undefined);
    }

    const code =
      error instanceof AppError
        ? error.code
        : error instanceof PrivateStorageError
          ? error.code
          : "UPLOAD_FAILED";
    await markIntentFailed(intent.id, code).catch(() => undefined);

    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof PrivateStorageError) {
      const status =
        error.code === "FILE_TOO_LARGE"
          ? 413
          : error.code === "STORAGE_OBJECT_EXISTS"
            ? 409
            : 500;
      throw new AppError(
        error.code,
        status === 413
          ? "文件不能超过 20 MiB。"
          : status === 409
            ? "文件版本发生并发冲突。"
            : "文件存储失败，请联系系统管理员。",
        status,
      );
    }

    logger.error(
      {
        event: "file.upload_failed",
        errorName: error instanceof Error ? error.name : "UnknownError",
        intentId: intent.id,
        requestId: input.requestId,
      },
      "File upload failed",
    );

    throw new AppError(
      "UPLOAD_FAILED",
      "文件上传处理失败，请重新创建上传意图。",
      500,
    );
  }
}
