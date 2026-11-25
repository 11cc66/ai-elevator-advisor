import {
  ALLOWED_FILE_MIME_TYPES,
  PrivateStorageError,
  type StorageReadCapability,
} from "@elevator/file-storage";
import {
  isVerifiedTestRuntime,
} from "@elevator/contracts";

import type { Actor } from "@/modules/access/actor";
import { PERMISSIONS } from "@/modules/access/permissions";
import { canAccessProject } from "@/modules/access/policy";
import { appendAuditLog } from "@/modules/audit/log";
import { AppError } from "@/server/http/errors";
import { prisma } from "@/server/prisma";
import type { WebEnv } from "@/server/env";
import { logger } from "@/server/logger";

import {
  acquireDownloadResources,
  downloadResourcePool,
} from "./download-resource-pool";
import { evaluateDownloadPolicy } from "./download-policy";

const MAX_DOWNLOAD_BYTES = 20n * 1024n * 1024n;

export interface PreparedDownload {
  fileName: string;
  mimeType: string;
  sizeBytes: bigint;
  body: Buffer;
  release: () => void;
  responseTimeoutMs: number;
  reportInterruption: (reason: string) => void;
}

type StorageFailureClass = {
  eventType:
    | "STORAGE_OBJECT_MISSING"
    | "CHECKSUM_MISMATCH"
    | "VALIDATION_FAILED";
  severity: "HIGH" | "CRITICAL";
  markIntegrityFailed: boolean;
  clientCode: string;
  clientMessage: string;
  status: number;
};

function classifyStorageFailure(code: string): StorageFailureClass {
  if (code === "STORAGE_OBJECT_MISSING") {
    return {
      eventType: "STORAGE_OBJECT_MISSING",
      severity: "CRITICAL",
      markIntegrityFailed: true,
      clientCode: "STORAGE_OBJECT_MISSING",
      clientMessage: "文件内容不可用，已阻止下载。",
      status: 409,
    };
  }

  if (code === "STORAGE_OBJECT_CHECKSUM_MISMATCH") {
    return {
      eventType: "CHECKSUM_MISMATCH",
      severity: "CRITICAL",
      markIntegrityFailed: true,
      clientCode: "FILE_INTEGRITY_FAILED",
      clientMessage: "文件完整性校验失败，已阻止下载。",
      status: 409,
    };
  }

  if (
    code === "STORAGE_OBJECT_SYMLINK" ||
    code === "STORAGE_OBJECT_NOT_REGULAR" ||
    code === "STORAGE_OBJECT_IDENTITY_CHANGED" ||
    code === "STORAGE_OBJECT_OUTSIDE_ROOT" ||
    code === "STORAGE_OBJECT_SIZE_MISMATCH" ||
    code === "STORAGE_OBJECT_SIZE_INVALID" ||
    code === "STORAGE_OBJECT_CHECKSUM_INVALID" ||
    code === "STORAGE_KEY_INVALID" ||
    code === "STORAGE_KEY_OUTSIDE_ROOT"
  ) {
    return {
      eventType: "VALIDATION_FAILED",
      severity: "CRITICAL",
      markIntegrityFailed: true,
      clientCode: "FILE_INTEGRITY_FAILED",
      clientMessage: "文件完整性校验失败，已阻止下载。",
      status: 409,
    };
  }

  return {
    eventType: "VALIDATION_FAILED",
    severity: "HIGH",
    markIntegrityFailed: false,
    clientCode:
      code === "STORAGE_RESOURCE_EXHAUSTED"
        ? "STORAGE_RESOURCE_BUSY"
        : "STORAGE_UNAVAILABLE",
    clientMessage: "文件存储暂时不可用，请稍后重试。",
    status: 503,
  };
}

export async function verifyIsolatedTestFileEnvironment(
  env: WebEnv,
): Promise<boolean> {
  if (
    env.NODE_ENV !== "test" ||
    env.FILE_ACCESS_MODE !== "test"
  ) {
    return false;
  }

  const expectedMarker = process.env.TEST_DATABASE_MARKER;

  if (!expectedMarker) {
    return false;
  }

  try {
    const context = await prisma.$queryRaw<
      Array<{ databaseName: string; databaseRole: string }>
    >`
      SELECT
        current_database() AS "databaseName",
        current_user AS "databaseRole"
    `;
    if (!context[0]) {
      return false;
    }

    const marker = await prisma.$queryRaw<Array<{ value: unknown }>>`
      SELECT "value"
      FROM "system_metadata"
      WHERE "key" = 'test_database_marker'
      LIMIT 1
    `;

    return isVerifiedTestRuntime({
      nodeEnvironment: env.NODE_ENV,
      fileAccessMode: env.FILE_ACCESS_MODE,
      databaseName: context[0].databaseName,
      databaseRole: context[0].databaseRole,
      databaseMarker: marker[0]?.value,
      expectedDatabaseMarker: expectedMarker,
    });
  } catch {
    return false;
  }
}

async function recordDownloadBlocked(input: {
  actorUserId: string;
  fileId: string;
  fileVersionId: string;
  reason: string;
  requestId: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: "file.download_blocked",
      objectType: "FileVersion",
      objectId: input.fileVersionId,
      reason: input.reason,
      requestId: input.requestId,
      newValue: {
        fileId: input.fileId,
        reason: input.reason,
      },
    },
  });
}

async function recordStorageIntegrityBlock(input: {
  actorUserId: string;
  fileId: string;
  fileVersionId: string;
  expectedChecksumSha256: string;
  actualChecksumSha256?: string;
  eventType:
    | "STORAGE_OBJECT_MISSING"
    | "CHECKSUM_MISMATCH"
    | "VALIDATION_FAILED";
  severity: "HIGH" | "CRITICAL";
  markIntegrityFailed: boolean;
  reason: string;
  policyCode: string;
  requestId: string;
  details?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (input.markIntegrityFailed) {
      await tx.fileVersion.update({
        where: { id: input.fileVersionId },
        data: { integrityStatus: "FAILED" },
      });
    }
    await tx.fileSecurityEvent.create({
      data: {
        fileVersionId: input.fileVersionId,
        eventType: input.eventType,
        severity: input.severity,
        expectedChecksum: input.expectedChecksumSha256,
        actualChecksum: input.actualChecksumSha256,
        policyCode: input.policyCode,
        details: input.details
          ? {
              ...input.details,
            }
          : undefined,
        requestId: input.requestId,
        actorUserId: input.actorUserId,
      },
    });
    await appendAuditLog(tx, {
      actorUserId: input.actorUserId,
      action: "file.download_blocked",
      objectType: "FileVersion",
      objectId: input.fileVersionId,
      reason: input.reason,
      requestId: input.requestId,
      newValue: {
        fileId: input.fileId,
        reason: input.reason,
      },
    });
  });
}

export async function prepareFileDownload(input: {
  actor: Actor;
  projectId: string;
  fileId: string;
  versionId: string;
  requestId: string;
  env: WebEnv;
  storage: StorageReadCapability;
}): Promise<PreparedDownload> {
  const file = await prisma.file.findFirst({
    where: {
      id: input.fileId,
      projectId: input.projectId,
    },
    select: {
      id: true,
      currentVersionId: true,
    },
  });

  if (!file) {
    throw new AppError(
      "FILE_NOT_FOUND",
      "文件不存在或不属于当前项目。",
      404,
    );
  }

  const version = await prisma.fileVersion.findFirst({
    where: {
      id: input.versionId,
      fileId: file.id,
    },
  });

  if (!version) {
    throw new AppError(
      "FILE_VERSION_NOT_FOUND",
      "文件版本不存在或不属于该文件。",
      404,
    );
  }

  const testIdentityVerified =
    await verifyIsolatedTestFileEnvironment(input.env);
  const hasUnscannedTestAccess = canAccessProject(
    input.actor,
    input.projectId,
    PERMISSIONS.FILE_UNSCANNED_TEST_ACCESS,
  );
  const policy = evaluateDownloadPolicy({
    nodeEnvironment: input.env.NODE_ENV,
    fileAccessMode: input.env.FILE_ACCESS_MODE,
    testIdentityVerified,
    hasUnscannedTestAccess,
    uploadStatus: version.uploadStatus,
    validationStatus: version.validationStatus,
    integrityStatus: version.integrityStatus,
    malwareScanStatus: version.malwareScanStatus,
  });

  if (!policy.allowed) {
    await recordDownloadBlocked({
      actorUserId: input.actor.userId,
      fileId: file.id,
      fileVersionId: version.id,
      reason: policy.reason,
      requestId: input.requestId,
    });

    const status =
      policy.reason === "MALWARE_SCAN_REQUIRED" ? 403 : 409;
    throw new AppError(
      policy.reason,
      policy.reason === "MALWARE_SCAN_REQUIRED"
        ? "当前环境不允许下载未扫描文件。"
        : "文件状态尚未满足下载条件。",
      status,
    );
  }

  if (version.sizeBytes <= 0n) {
    await recordStorageIntegrityBlock({
      actorUserId: input.actor.userId,
      fileId: file.id,
      fileVersionId: version.id,
      expectedChecksumSha256: version.checksumSha256,
      eventType: "VALIDATION_FAILED",
      severity: "CRITICAL",
      markIntegrityFailed: true,
      reason: "FILE_SIZE_INVALID",
      policyCode: "DOWNLOAD_FILE_SIZE_INVALID",
      requestId: input.requestId,
      details: { sizeBytes: version.sizeBytes.toString() },
    });
    throw new AppError(
      "FILE_SIZE_INVALID",
      "文件大小元数据无效，已阻止下载。",
      409,
    );
  }
  if (version.sizeBytes > MAX_DOWNLOAD_BYTES) {
    await recordStorageIntegrityBlock({
      actorUserId: input.actor.userId,
      fileId: file.id,
      fileVersionId: version.id,
      expectedChecksumSha256: version.checksumSha256,
      eventType: "VALIDATION_FAILED",
      severity: "CRITICAL",
      markIntegrityFailed: true,
      reason: "FILE_TOO_LARGE",
      policyCode: "DOWNLOAD_FILE_TOO_LARGE",
      requestId: input.requestId,
      details: { sizeBytes: version.sizeBytes.toString() },
    });
    throw new AppError(
      "FILE_TOO_LARGE",
      "文件超过允许下载的大小。",
      413,
    );
  }

  const releaseResource = acquireDownloadResources(
    input.env,
    Number(version.sizeBytes),
  );
  if (!releaseResource) {
    throw new AppError(
      "DOWNLOAD_RESOURCE_BUSY",
      "当前下载请求较多，请稍后重试。",
      503,
    );
  }

  let released = false;
  logger.info(
    {
      event: "file.download.resource_acquired",
      ...downloadResourcePool.snapshot(),
    },
    "Download buffer resource acquired",
  );
  const release = () => {
    if (released) {
      return;
    }
    released = true;
    releaseResource();
    logger.info(
      {
        event: "file.download.resource_released",
        ...downloadResourcePool.snapshot(),
      },
      "Download buffer resource released",
    );
  };
  let interruptionReported = false;
  const reportInterruption = (reason: string) => {
    if (interruptionReported) {
      return;
    }
    interruptionReported = true;
    if (reason === "RESPONSE_TIMEOUT") {
      downloadResourcePool.recordTimeout();
    } else {
      downloadResourcePool.recordInterruption();
    }
    logger.warn(
      {
        event: "file.download.interrupted",
        reason,
        ...downloadResourcePool.snapshot(),
      },
      "Download response interrupted",
    );
    void prisma.auditLog
      .create({
        data: {
          actorUserId: input.actor.userId,
          action: "file.download_interrupted",
          objectType: "FileVersion",
          objectId: version.id,
          reason,
          requestId: input.requestId,
          newValue: {
            fileId: file.id,
            projectId: input.projectId,
            reason,
          },
        },
      })
      .catch((error: unknown) => {
        logger.error(
          {
            event: "file.download.interruption_audit_failed",
            reason,
            errorName:
              error instanceof Error
                ? error.name
                : "UnknownError",
          },
          "Failed to append download interruption audit",
        );
      });
  };

  try {
    const verifiedObject = await input.storage.readVerifiedObject({
      objectKey: version.storageKey,
      expectedSizeBytes: version.sizeBytes,
      expectedChecksumSha256: version.checksumSha256.toLowerCase(),
      maxBytes: MAX_DOWNLOAD_BYTES,
    });

    if (
      !version.detectedMimeType ||
      !ALLOWED_FILE_MIME_TYPES.includes(
        version.detectedMimeType as
          | "application/pdf"
          | "image/jpeg"
          | "image/png",
      )
    ) {
      await recordStorageIntegrityBlock({
        actorUserId: input.actor.userId,
        fileId: file.id,
        fileVersionId: version.id,
        expectedChecksumSha256: version.checksumSha256,
        eventType: "VALIDATION_FAILED",
        severity: "HIGH",
        markIntegrityFailed: false,
        reason: "FILE_TYPE_NOT_ALLOWED",
        policyCode: "DOWNLOAD_MIME_TYPE_NOT_ALLOWED",
        requestId: input.requestId,
        details: {
          detectedMimeType: version.detectedMimeType,
          allowedMimeTypes: ALLOWED_FILE_MIME_TYPES.join(","),
        },
      });
      throw new AppError(
        "FILE_TYPE_NOT_ALLOWED",
        "文件类型不允许下载。",
        415,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.fileVersion.update({
        where: { id: version.id },
        data: {
          integrityStatus: "VERIFIED",
          lastIntegrityVerifiedAt: new Date(),
        },
      });
      await appendAuditLog(tx, {
        actorUserId: input.actor.userId,
        action: "file.download_verified",
        objectType: "FileVersion",
        objectId: version.id,
        requestId: input.requestId,
        newValue: {
          fileId: file.id,
          projectId: input.projectId,
          accessReason: policy.reason,
          sizeBytes: version.sizeBytes.toString(),
          checksumSha256: verifiedObject.checksumSha256,
        },
      });
    });

    return {
      fileName: version.sanitizedFilename,
      mimeType: version.detectedMimeType,
      sizeBytes: verifiedObject.sizeBytes,
      body: verifiedObject.bytes,
      release,
      responseTimeoutMs: input.env.FILE_DOWNLOAD_RESPONSE_TIMEOUT_MS,
      reportInterruption,
    };
  } catch (error) {
    if (error instanceof PrivateStorageError) {
      release();
      const failure = classifyStorageFailure(error.code);
      const actualChecksumSha256 =
        typeof error.details?.actualChecksumSha256 === "string"
          ? error.details.actualChecksumSha256
          : undefined;

      await recordStorageIntegrityBlock({
        actorUserId: input.actor.userId,
        fileId: file.id,
        fileVersionId: version.id,
        expectedChecksumSha256: version.checksumSha256,
        actualChecksumSha256,
        eventType: failure.eventType,
        severity: failure.severity,
        markIntegrityFailed: failure.markIntegrityFailed,
        reason: error.code,
        policyCode: `DOWNLOAD_${error.code}`,
        requestId: input.requestId,
        details: {
          errorCode: error.code,
          actualChecksumSha256:
            actualChecksumSha256 ?? null,
        },
      });

      throw new AppError(
        failure.clientCode,
        failure.clientMessage,
        failure.status,
      );
    }

    release();
    throw error;
  }
}
