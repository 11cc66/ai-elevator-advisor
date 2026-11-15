import type { Readable } from "node:stream";

import {
  ALLOWED_FILE_MIME_TYPES,
  type PrivateStorageAdapter,
} from "@elevator/file-storage";

import type { Actor } from "@/modules/access/actor";
import { PERMISSIONS } from "@/modules/access/permissions";
import { canAccessProject } from "@/modules/access/policy";
import { appendAuditLog } from "@/modules/audit/log";
import { AppError } from "@/server/http/errors";
import { prisma } from "@/server/prisma";
import type { WebEnv } from "@/server/env";

import { evaluateDownloadPolicy } from "./download-policy";

export interface PreparedDownload {
  fileName: string;
  mimeType: string;
  sizeBytes: bigint;
  stream: Readable;
}

async function verifyIsolatedTestFileEnvironment(
  env: WebEnv,
): Promise<boolean> {
  if (
    process.env.NODE_ENV === "production" ||
    env.FILE_ACCESS_MODE !== "test"
  ) {
    return false;
  }

  const expectedDatabase = process.env.TEST_DATABASE_NAME;
  const expectedRole = process.env.TEST_DATABASE_ROLE;
  const expectedMarker = process.env.TEST_DATABASE_MARKER;

  if (!expectedDatabase || !expectedRole || !expectedMarker) {
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
    if (
      context[0]?.databaseName !== expectedDatabase ||
      context[0]?.databaseRole !== expectedRole
    ) {
      return false;
    }

    const marker = await prisma.$queryRaw<Array<{ value: unknown }>>`
      SELECT "value"
      FROM "system_metadata"
      WHERE "key" = 'test_database_marker'
      LIMIT 1
    `;

    return marker[0]?.value === expectedMarker;
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

export async function prepareFileDownload(input: {
  actor: Actor;
  projectId: string;
  fileId: string;
  versionId: string;
  requestId: string;
  env: WebEnv;
  storage: PrivateStorageAdapter;
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
    nodeEnvironment: process.env.NODE_ENV,
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

  let integrity;

  try {
    integrity = await input.storage.verifyObjectChecksum(
      version.storageKey,
      version.checksumSha256,
    );
  } catch {
    await prisma.$transaction(async (tx) => {
      await tx.fileVersion.update({
        where: { id: version.id },
        data: { integrityStatus: "FAILED" },
      });
      await tx.fileSecurityEvent.create({
        data: {
          fileVersionId: version.id,
          eventType: "STORAGE_OBJECT_MISSING",
          severity: "CRITICAL",
          expectedChecksum: version.checksumSha256,
          policyCode: "DOWNLOAD_INTEGRITY_PREFLIGHT",
          requestId: input.requestId,
          actorUserId: input.actor.userId,
        },
      });
      await appendAuditLog(tx, {
        actorUserId: input.actor.userId,
        action: "file.download_blocked",
        objectType: "FileVersion",
        objectId: version.id,
        reason: "STORAGE_OBJECT_MISSING",
        requestId: input.requestId,
        newValue: { fileId: file.id },
      });
    });

    throw new AppError(
      "STORAGE_OBJECT_MISSING",
      "文件内容不可用，已阻止下载。",
      409,
    );
  }

  if (!integrity.valid) {
    await prisma.$transaction(async (tx) => {
      await tx.fileVersion.update({
        where: { id: version.id },
        data: { integrityStatus: "FAILED" },
      });
      await tx.fileSecurityEvent.create({
        data: {
          fileVersionId: version.id,
          eventType: "CHECKSUM_MISMATCH",
          severity: "CRITICAL",
          expectedChecksum: version.checksumSha256,
          actualChecksum: integrity.actualChecksumSha256,
          policyCode: "DOWNLOAD_INTEGRITY_PREFLIGHT",
          requestId: input.requestId,
          actorUserId: input.actor.userId,
        },
      });
      await appendAuditLog(tx, {
        actorUserId: input.actor.userId,
        action: "file.download_blocked",
        objectType: "FileVersion",
        objectId: version.id,
        reason: "CHECKSUM_MISMATCH",
        requestId: input.requestId,
        newValue: { fileId: file.id },
      });
    });

    throw new AppError(
      "FILE_INTEGRITY_FAILED",
      "文件完整性校验失败，已阻止下载。",
      409,
    );
  }

  if (
    !version.detectedMimeType ||
    !ALLOWED_FILE_MIME_TYPES.includes(
      version.detectedMimeType as
        | "application/pdf"
        | "image/jpeg"
        | "image/png",
    )
  ) {
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
      action: "file.downloaded",
      objectType: "FileVersion",
      objectId: version.id,
      requestId: input.requestId,
      newValue: {
        fileId: file.id,
        projectId: input.projectId,
        accessReason: policy.reason,
      },
    });
  });

  return {
    fileName: version.sanitizedFilename,
    mimeType: version.detectedMimeType,
    sizeBytes: version.sizeBytes,
    stream: input.storage.openReadStream(version.storageKey),
  };
}
