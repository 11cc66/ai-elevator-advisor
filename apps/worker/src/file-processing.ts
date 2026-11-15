import { createHash } from "node:crypto";

import {
  detectAllowedFileType,
  LocalPrivateStorage,
  PrivateStorageError,
} from "@elevator/file-storage";
import type { FileRecognitionJob } from "@elevator/contracts";
import { PrismaClient } from "@prisma/client";

import { readWorkerEnv, type WorkerEnv } from "./config.js";
import { evaluateFileProcessingPolicy } from "./file-processing-policy.js";
import { extractImageMetadata } from "./image-metadata.js";
import { logger } from "./logger.js";
import { PdfParserError, parsePdfInWorker } from "./pdf-parser-client.js";
import { createWorkerStorage } from "./storage.js";

const MAX_FILE_BYTES = 20n * 1024n * 1024n;
const STALE_PROCESSING_MS = 5 * 60 * 1000;
const PDF_PROVIDER_VERSION = "pdfjs-dist@6.5.438";
const IMAGE_PROVIDER_VERSION = "image-size@2.1.0";

interface WorkerRuntime {
  env: WorkerEnv;
  prisma: PrismaClient;
  storage: LocalPrivateStorage;
}

function createRuntime(prisma: PrismaClient): WorkerRuntime {
  const env = readWorkerEnv();
  return {
    env,
    prisma,
    storage: createWorkerStorage(env),
  };
}

async function loadProjectPermissions(
  prisma: PrismaClient,
  userId: string,
  projectId: string,
): Promise<{
  global: Set<string>;
  project: Set<string>;
}> {
  const assignments = await prisma.userRole.findMany({
    where: {
      userId,
      OR: [
        { scope: "GLOBAL" },
        {
          scope: "PROJECT",
          projectId,
        },
      ],
    },
    include: {
      role: {
        include: {
          permissions: true,
        },
      },
    },
  });
  const global = new Set<string>();
  const project = new Set<string>();

  for (const assignment of assignments) {
    const target = assignment.scope === "GLOBAL" ? global : project;
    for (const permission of assignment.role.permissions) {
      target.add(permission.permissionCode);
    }
  }

  return { global, project };
}

async function verifyTestIdentity(runtime: WorkerRuntime): Promise<boolean> {
  if (
    process.env.NODE_ENV === "production" ||
    runtime.env.FILE_ACCESS_MODE !== "test"
  ) {
    return false;
  }

  const expectedDatabase = runtime.env.TEST_DATABASE_NAME;
  const expectedRole = runtime.env.TEST_DATABASE_ROLE;
  const expectedMarker = runtime.env.TEST_DATABASE_MARKER;

  if (!expectedDatabase || !expectedRole || !expectedMarker) {
    return false;
  }

  const context = await runtime.prisma.$queryRaw<
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

  const marker = await runtime.prisma.$queryRaw<Array<{ value: unknown }>>`
    SELECT "value"
    FROM "system_metadata"
    WHERE "key" = 'test_database_marker'
    LIMIT 1
  `;
  return marker[0]?.value === expectedMarker;
}

async function readObjectBytes(
  runtime: WorkerRuntime,
  storageKey: string,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0n;

  for await (const chunk of runtime.storage.openReadStream(storageKey)) {
    const buffer = Buffer.from(chunk);
    totalBytes += BigInt(buffer.byteLength);
    if (totalBytes > MAX_FILE_BYTES) {
      throw new PdfParserError("FILE_TOO_LARGE");
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

async function markExtractionFailed(
  runtime: WorkerRuntime,
  input: {
    extractionId: string;
    fileVersionId: string;
    fileId: string;
    actorUserId: string | null;
    code: string;
    message: string;
    recognitionStatus?: "FAILED" | "BLOCKED";
  },
): Promise<boolean> {
  return runtime.prisma.$transaction(async (tx) => {
    const changed = await tx.fileExtraction.updateMany({
      where: {
        id: input.extractionId,
        status: "PROCESSING",
      },
      data: {
        status: "FAILED",
        safeErrorCode: input.code,
        safeErrorMessage: input.message,
        completedAt: new Date(),
      },
    });

    if (changed.count !== 1) {
      return false;
    }

    const latest = await tx.fileExtraction.findFirst({
      where: { fileVersionId: input.fileVersionId },
      orderBy: { extractionVersion: "desc" },
      select: { id: true },
    });
    if (latest?.id === input.extractionId) {
      await tx.fileVersion.update({
        where: { id: input.fileVersionId },
        data: {
          recognitionStatus: input.recognitionStatus ?? "FAILED",
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "file.extraction.failed",
        objectType: "FileVersion",
        objectId: input.fileVersionId,
        reason: input.code,
        newValue: {
          fileId: input.fileId,
          extractionId: input.extractionId,
        },
      },
    });
    return true;
  });
}

export async function processFileRecognitionJob(
  job: FileRecognitionJob,
  prisma = new PrismaClient(),
): Promise<"COMPLETED" | "IGNORED" | "FAILED" | "BLOCKED"> {
  const runtime = createRuntime(prisma);

  try {
    const extraction = await prisma.fileExtraction.findUnique({
      where: { id: job.extractionId },
      include: {
        fileVersion: {
          include: {
            file: {
              select: {
                id: true,
                customerId: true,
                projectId: true,
                buildingId: true,
                installationUnitId: true,
                dataClassification: true,
              },
            },
          },
        },
      },
    });

    if (
      !extraction ||
      extraction.fileVersionId !== job.fileVersionId
    ) {
      throw new Error("FILE_PROCESSING_RESOURCE_MISMATCH");
    }

    if (
      extraction.status === "COMPLETED" ||
      extraction.status === "FAILED" ||
      extraction.status === "UNSUPPORTED"
    ) {
      return "IGNORED";
    }

    const now = new Date();
    const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);
    const claim =
      extraction.status === "QUEUED"
        ? await prisma.fileExtraction.updateMany({
            where: {
              id: extraction.id,
              status: "QUEUED",
            },
            data: {
              status: "PROCESSING",
              startedAt: now,
              attempt: { increment: 1 },
            },
          })
        : await prisma.fileExtraction.updateMany({
            where: {
              id: extraction.id,
              status: "PROCESSING",
              startedAt: { lt: staleBefore },
            },
            data: {
              startedAt: now,
              attempt: { increment: 1 },
            },
          });

    if (claim.count !== 1) {
      return "IGNORED";
    }

    const user = await prisma.user.findUnique({
      where: { id: job.requestedByUserId },
      select: { id: true },
    });
    if (!user) {
      const marked = await markExtractionFailed(runtime, {
        extractionId: extraction.id,
        fileVersionId: extraction.fileVersion.id,
        fileId: extraction.fileVersion.file.id,
        actorUserId: null,
        code: "PROCESSING_USER_NOT_FOUND",
        message: "处理请求账号不存在。",
      });
      return marked ? "FAILED" : "IGNORED";
    }

    const permissions = await loadProjectPermissions(
      prisma,
      job.requestedByUserId,
      extraction.fileVersion.file.projectId,
    );
    const hasUploadPermission =
      permissions.global.has("file.upload") ||
      permissions.project.has("file.upload");
    if (!hasUploadPermission) {
      const marked = await markExtractionFailed(runtime, {
        extractionId: extraction.id,
        fileVersionId: extraction.fileVersion.id,
        fileId: extraction.fileVersion.file.id,
        actorUserId: job.requestedByUserId,
        code: "PROCESSING_PERMISSION_DENIED",
        message: "请求账号没有该项目的文件上传权限。",
      });
      return marked ? "FAILED" : "IGNORED";
    }

    const testIdentityVerified = await verifyTestIdentity(runtime);
    const policy = evaluateFileProcessingPolicy({
      nodeEnvironment: process.env.NODE_ENV,
      fileAccessMode: runtime.env.FILE_ACCESS_MODE,
      testIdentityVerified,
      hasUnscannedTestAccess:
        permissions.global.has("file.unscanned.test_access") ||
        permissions.project.has("file.unscanned.test_access"),
      uploadStatus: extraction.fileVersion.uploadStatus,
      validationStatus: extraction.fileVersion.validationStatus,
      integrityStatus: extraction.fileVersion.integrityStatus,
      malwareScanStatus: extraction.fileVersion.malwareScanStatus,
    });

    if (!policy.allowed) {
      const marked = await markExtractionFailed(runtime, {
        extractionId: extraction.id,
        fileVersionId: extraction.fileVersion.id,
        fileId: extraction.fileVersion.file.id,
        actorUserId: job.requestedByUserId,
        code: policy.reason,
        message: "当前环境不允许处理该文件。",
        recognitionStatus: "BLOCKED",
      });
      return marked ? "BLOCKED" : "IGNORED";
    }

    let objectBytes: Buffer;

    try {
      objectBytes = await readObjectBytes(
        runtime,
        extraction.fileVersion.storageKey,
      );
    } catch {
      await prisma.$transaction(async (tx) => {
        await tx.fileVersion.update({
          where: { id: extraction.fileVersion.id },
          data: { integrityStatus: "FAILED" },
        });
        await tx.fileSecurityEvent.create({
          data: {
            fileVersionId: extraction.fileVersion.id,
            eventType: "STORAGE_OBJECT_MISSING",
            severity: "CRITICAL",
            expectedChecksum: extraction.fileVersion.checksumSha256,
            policyCode: "PROCESSING_INTEGRITY_PREFLIGHT",
            actorUserId: job.requestedByUserId,
          },
        });
      });
      const marked = await markExtractionFailed(runtime, {
        extractionId: extraction.id,
        fileVersionId: extraction.fileVersion.id,
        fileId: extraction.fileVersion.file.id,
        actorUserId: job.requestedByUserId,
        code: "STORAGE_OBJECT_MISSING",
        message: "原始文件对象不存在。",
      });
      return marked ? "FAILED" : "IGNORED";
    }

    const actualChecksum = createHash("sha256")
      .update(objectBytes)
      .digest("hex");
    if (actualChecksum !== extraction.fileVersion.checksumSha256) {
      await prisma.$transaction(async (tx) => {
        await tx.fileVersion.update({
          where: { id: extraction.fileVersion.id },
          data: { integrityStatus: "FAILED" },
        });
        await tx.fileSecurityEvent.create({
          data: {
            fileVersionId: extraction.fileVersion.id,
            eventType: "CHECKSUM_MISMATCH",
            severity: "CRITICAL",
            expectedChecksum: extraction.fileVersion.checksumSha256,
            actualChecksum,
            policyCode: "PROCESSING_INTEGRITY_PREFLIGHT",
            actorUserId: job.requestedByUserId,
          },
        });
      });
      const marked = await markExtractionFailed(runtime, {
        extractionId: extraction.id,
        fileVersionId: extraction.fileVersion.id,
        fileId: extraction.fileVersion.file.id,
        actorUserId: job.requestedByUserId,
        code: "FILE_INTEGRITY_FAILED",
        message: "文件完整性校验失败。",
      });
      return marked ? "FAILED" : "IGNORED";
    }

    let detected;
    try {
      detected = await detectAllowedFileType(
        objectBytes.subarray(0, 4100),
      );
    } catch (error) {
      const code =
        error instanceof PrivateStorageError
          ? error.code
          : "FILE_TYPE_UNKNOWN";
      const marked = await markExtractionFailed(runtime, {
        extractionId: extraction.id,
        fileVersionId: extraction.fileVersion.id,
        fileId: extraction.fileVersion.file.id,
        actorUserId: job.requestedByUserId,
        code,
        message: "文件类型无法确认或不受支持。",
      });
      return marked ? "FAILED" : "IGNORED";
    }

    if (detected.mimeType !== extraction.fileVersion.detectedMimeType) {
      await prisma.fileSecurityEvent.create({
        data: {
          fileVersionId: extraction.fileVersion.id,
          eventType: "MIME_MISMATCH",
          severity: "HIGH",
          policyCode: "PROCESSING_TYPE_PREFLIGHT",
          actorUserId: job.requestedByUserId,
          details: {
            expectedMimeType: extraction.fileVersion.detectedMimeType,
            actualMimeType: detected.mimeType,
          },
        },
      });
      const marked = await markExtractionFailed(runtime, {
        extractionId: extraction.id,
        fileVersionId: extraction.fileVersion.id,
        fileId: extraction.fileVersion.file.id,
        actorUserId: job.requestedByUserId,
        code: "MIME_MISMATCH",
        message: "文件实际类型与已存版本不一致。",
      });
      return marked ? "FAILED" : "IGNORED";
    }

    try {
      let providerMetadata: object;
      let extractedText = "";
      let outputCharacterCount = 0;
      let pageCount: number | null = null;
      let parserVersion: string;
      let blocks: Array<{
        pageNumber: number | null;
        blockIndex: number;
        text: string;
        sourceKind: string;
        sourceRef: string | null;
        positionData: unknown;
        characterCount: number;
      }> = [];
      let safetyNotes: string | null = null;

      if (detected.mimeType === "application/pdf") {
        const parsed = await parsePdfInWorker(objectBytes, {
          maxPages: runtime.env.PDF_MAX_PAGES,
          maxCharacters: runtime.env.PDF_MAX_TEXT_CHARS,
          timeoutMs: runtime.env.PDF_PARSE_TIMEOUT_MS,
        });
        providerMetadata = {
          pageCount: parsed.pageCount,
          textLayerEmpty: parsed.textLayerEmpty,
        };
        extractedText = parsed.extractedText;
        outputCharacterCount = parsed.outputCharacterCount;
        pageCount = parsed.pageCount;
        parserVersion = PDF_PROVIDER_VERSION;
        blocks = parsed.blocks;
        if (parsed.textLayerEmpty) {
          safetyNotes = "PDF 未包含可提取文字层；当前版本不执行 OCR。";
        }
      } else {
        providerMetadata = extractImageMetadata(
          objectBytes,
          runtime.env.IMAGE_MAX_PIXELS,
        );
        parserVersion = IMAGE_PROVIDER_VERSION;
        safetyNotes =
          "当前版本尚未进行图片文字提取或 AI 图像识别。图片仅完成基础文件校验和元数据读取，不构成现场情况、结构、尺寸或工程可行性判断。";
      }

      const completed = await prisma.$transaction(async (tx) => {
        const current = await tx.fileExtraction.findUnique({
          where: { id: extraction.id },
          select: { status: true },
        });
        if (current?.status !== "PROCESSING") {
          return false;
        }

        if (blocks.length > 0) {
          await tx.extractionTextBlock.createMany({
            data: blocks.map((block) => ({
              extractionId: extraction.id,
              pageNumber: block.pageNumber,
              blockIndex: block.blockIndex,
              text: block.text,
              sourceKind: block.sourceKind,
              sourceRef: block.sourceRef,
              positionData: block.positionData as object,
              characterCount: block.characterCount,
            })),
          });
        }

        await tx.fileExtraction.update({
          where: { id: extraction.id },
          data: {
            status: "COMPLETED",
            extractedText,
            providerMetadata: providerMetadata as object,
            pageCount,
            outputCharacterCount,
            parserVersion,
            safetyNotes,
            completedAt: new Date(),
          },
        });
        const latest = await tx.fileExtraction.findFirst({
          where: { fileVersionId: extraction.fileVersion.id },
          orderBy: { extractionVersion: "desc" },
          select: { id: true },
        });
        if (latest?.id === extraction.id) {
          await tx.fileVersion.update({
            where: { id: extraction.fileVersion.id },
            data: { recognitionStatus: "COMPLETED" },
          });
        }
        await tx.auditLog.create({
          data: {
            actorUserId: job.requestedByUserId,
            action: "file.extraction.completed",
            objectType: "FileVersion",
            objectId: extraction.fileVersion.id,
            newValue: {
              extractionId: extraction.id,
              pageCount,
              outputCharacterCount,
            },
          },
        });
        return true;
      });

      if (!completed) {
        return "IGNORED";
      }

      logger.info(
        {
          event: "file.processing.completed",
          extractionId: extraction.id,
          fileVersionId: extraction.fileVersion.id,
          mimeType: detected.mimeType,
        },
        "File processing completed",
      );
      return "COMPLETED";
    } catch (error) {
      const code =
        error instanceof PdfParserError
          ? error.code
          : error instanceof Error &&
              (error.message === "IMAGE_DIMENSIONS_UNAVAILABLE" ||
                error.message === "IMAGE_PIXEL_LIMIT_EXCEEDED")
            ? error.message
            : "FILE_PROCESSING_FAILED";
      const marked = await markExtractionFailed(runtime, {
        extractionId: extraction.id,
        fileVersionId: extraction.fileVersion.id,
        fileId: extraction.fileVersion.file.id,
        actorUserId: job.requestedByUserId,
        code,
        message:
          code === "PDF_WORKER_TIMEOUT"
            ? "PDF 解析超时，解析线程已终止。"
            : code === "PDF_PAGE_LIMIT_EXCEEDED"
              ? "PDF 页数超过允许上限。"
              : code === "PDF_TEXT_LIMIT_EXCEEDED"
                ? "PDF 提取文字超过允许上限。"
                : code === "IMAGE_DIMENSIONS_UNAVAILABLE"
                  ? "无法读取图片尺寸。"
                  : code === "IMAGE_PIXEL_LIMIT_EXCEEDED"
                    ? "图片像素数量超过允许上限。"
                  : "文件处理失败。",
      });
      logger.error(
        {
          event: "file.processing.failed",
          extractionId: extraction.id,
          code,
        },
        "File processing failed",
      );
      return marked ? "FAILED" : "IGNORED";
    }
  } finally {
    if (prisma === runtime.prisma) {
      await prisma.$disconnect();
    }
  }
}
