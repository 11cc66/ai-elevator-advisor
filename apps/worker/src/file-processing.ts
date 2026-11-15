import { createHash } from "node:crypto";

import {
  isVerifiedTestRuntime,
  type FileRecognitionJob,
} from "@elevator/contracts";
import {
  detectAllowedFileType,
  LocalPrivateStorage,
  PrivateStorageError,
} from "@elevator/file-storage";
import { Prisma, PrismaClient } from "@prisma/client";

import { readWorkerEnv, type WorkerEnv } from "./config.js";
import {
  blockedProcessingError,
  ClassifiedProcessingError,
  computeRetryAt,
  FileProcessingRetryError,
  getSafeErrorCode,
  permanentProcessingError,
  SimulatedWorkerCrashError,
  type ProcessingFailureClass,
} from "./file-processing-errors.js";
import { evaluateFileProcessingPolicy } from "./file-processing-policy.js";
import {
  FileProcessingLeaseController,
  FileProcessingLeaseLostError,
} from "./file-processing-lease.js";
import {
  claimFileExtraction,
  completeFileExtraction,
  failExhaustedFileExtraction,
  failExhaustedUnclaimedFileExtraction,
  failFileExtraction,
  scheduleFileExtractionRetry,
  type CompletionBlock,
  type ProcessingClaim,
} from "./file-processing-state.js";
import { extractImageMetadata } from "./image-metadata.js";
import { logger } from "./logger.js";
import { PdfParserError, parsePdfInWorker } from "./pdf-parser-client.js";
import { createWorkerStorage } from "./storage.js";

const MAX_FILE_BYTES = 20n * 1024n * 1024n;
const PDF_PROVIDER_VERSION = "pdfjs-dist@6.5.438";
const IMAGE_PROVIDER_VERSION = "image-size@2.1.0";

export type ProcessingCheckpoint =
  | "AFTER_CLAIM"
  | "AFTER_READ"
  | "BEFORE_PARSE"
  | "AFTER_PARSE"
  | "BEFORE_COMMIT"
  | "AFTER_COMMIT";

export interface FileProcessingDependencies {
  prisma?: PrismaClient;
  storage?: LocalPrivateStorage;
  parsePdf?: typeof parsePdfInWorker;
  readObject?: (
    storage: LocalPrivateStorage,
    storageKey: string,
  ) => Promise<Buffer>;
  now?: () => Date;
  jobId?: string;
  checkpoint?: (
    checkpoint: ProcessingCheckpoint,
  ) => void | Promise<void>;
  leaseMs?: number;
  leaseRenewIntervalMs?: number;
}

interface WorkerRuntime {
  env: WorkerEnv;
  prisma: PrismaClient;
  storage: LocalPrivateStorage;
}

function createRuntime(
  prisma: PrismaClient,
  storage?: LocalPrivateStorage,
): WorkerRuntime {
  const env = readWorkerEnv();
  return {
    env,
    prisma,
    storage: storage ?? createWorkerStorage(env),
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
    process.env.NODE_ENV !== "test" ||
    runtime.env.FILE_ACCESS_MODE !== "test"
  ) {
    return false;
  }

  const expectedMarker = runtime.env.TEST_DATABASE_MARKER;

  if (!expectedMarker) {
    return false;
  }

  const context = await runtime.prisma.$queryRaw<
    Array<{ databaseName: string; databaseRole: string }>
  >`
    SELECT
      current_database() AS "databaseName",
      current_user AS "databaseRole"
  `;
  if (!context[0]) {
    return false;
  }

  const marker = await runtime.prisma.$queryRaw<Array<{ value: unknown }>>`
    SELECT "value"
    FROM "system_metadata"
    WHERE "key" = 'test_database_marker'
    LIMIT 1
  `;
  return isVerifiedTestRuntime({
    nodeEnvironment: process.env.NODE_ENV,
    fileAccessMode: runtime.env.FILE_ACCESS_MODE,
    databaseName: context[0].databaseName,
    databaseRole: context[0].databaseRole,
    databaseMarker: marker[0]?.value,
    expectedDatabaseMarker: expectedMarker,
  });
}

async function readObjectBytes(
  storage: LocalPrivateStorage,
  storageKey: string,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0n;

  for await (const chunk of storage.openReadStream(storageKey)) {
    const buffer = Buffer.from(chunk);
    totalBytes += BigInt(buffer.byteLength);
    if (totalBytes > MAX_FILE_BYTES) {
      throw new PdfParserError("FILE_TOO_LARGE");
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

async function runCheckpoint(
  dependencies: FileProcessingDependencies,
  checkpoint: ProcessingCheckpoint,
): Promise<void> {
  await dependencies.checkpoint?.(checkpoint);
}

async function recordSecurityEvent(
  prisma: PrismaClient,
  input: {
    fileVersionId: string;
    eventType:
      | "CHECKSUM_MISMATCH"
      | "MIME_MISMATCH"
      | "VALIDATION_FAILED"
      | "POLICY_BLOCKED"
      | "SCAN_UNAVAILABLE_BLOCK"
      | "STORAGE_OBJECT_MISSING";
    severity: "INFO" | "WARNING" | "HIGH" | "CRITICAL";
    actorUserId: string | null;
    jobId?: string;
    policyCode: string;
    expectedChecksum?: string;
    actualChecksum?: string;
    details?: Prisma.InputJsonObject;
  },
): Promise<void> {
  await prisma.fileSecurityEvent.create({
    data: {
      fileVersionId: input.fileVersionId,
      eventType: input.eventType,
      severity: input.severity,
      actorUserId: input.actorUserId,
      jobId: input.jobId,
      policyCode: input.policyCode,
      expectedChecksum: input.expectedChecksum,
      actualChecksum: input.actualChecksum,
      details: input.details,
    },
  });
}

export function classifyFileProcessingError(
  error: unknown,
): {
  code: string;
  safeMessage: string;
  failureClass: ProcessingFailureClass;
} {
  if (error instanceof ClassifiedProcessingError) {
    return {
      code: error.code,
      safeMessage: error.safeMessage,
      failureClass: error.failureClass,
    };
  }

  if (error instanceof PdfParserError) {
    if (
      error.code === "PDF_WORKER_TIMEOUT" ||
      error.code === "PDF_WORKER_CRASHED" ||
      error.code === "PDF_WORKER_ERROR" ||
      error.code === "PDF_WORKER_EXITED"
    ) {
      return {
        code: error.code,
        safeMessage: "PDF 解析暂时中断，将按策略重试。",
        failureClass: "TRANSIENT",
      };
    }

    return {
      code: error.code,
      safeMessage:
        error.code === "PDF_PAGE_LIMIT_EXCEEDED"
          ? "PDF 页数超过允许上限。"
          : error.code === "PDF_TEXT_LIMIT_EXCEEDED"
            ? "PDF 提取文字超过允许上限。"
            : "PDF 内容无法解析或已经损坏。",
      failureClass: "PERMANENT",
    };
  }

  if (error instanceof PrivateStorageError) {
    return {
      code: error.code,
      safeMessage: "文件类型或私有存储对象不符合处理要求。",
      failureClass: "PERMANENT",
    };
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ["P1001", "P1002", "P1008", "P1017", "P2024"].includes(error.code)
  ) {
    return {
      code: "DATABASE_TEMPORARILY_UNAVAILABLE",
      safeMessage: "数据库暂时不可用，将按策略重试。",
      failureClass: "TRANSIENT",
    };
  }

  const errorCode = getSafeErrorCode(error);
  if (errorCode === "ENOENT") {
    return {
      code: "STORAGE_OBJECT_MISSING",
      safeMessage: "原始文件对象不存在。",
      failureClass: "PERMANENT",
    };
  }
  if (errorCode === "EACCES" || errorCode === "EPERM") {
    return {
      code: "STORAGE_ACCESS_DENIED",
      safeMessage: "私有存储拒绝访问。",
      failureClass: "PERMANENT",
    };
  }
  if (
    error instanceof Error &&
    (error.message === "IMAGE_DIMENSIONS_UNAVAILABLE" ||
      error.message === "IMAGE_PIXEL_LIMIT_EXCEEDED")
  ) {
    return {
      code: error.message,
      safeMessage:
        error.message === "IMAGE_DIMENSIONS_UNAVAILABLE"
          ? "无法读取图片尺寸。"
          : "图片像素数量超过允许上限。",
      failureClass: "PERMANENT",
    };
  }

  return {
    code: "FILE_PROCESSING_TRANSIENT_ERROR",
    safeMessage: "文件处理暂时失败，将按策略重试。",
    failureClass: "TRANSIENT",
  };
}

export async function processFileRecognitionJob(
  job: FileRecognitionJob,
  dependencies: FileProcessingDependencies = {},
): Promise<"COMPLETED" | "IGNORED" | "FAILED" | "BLOCKED"> {
  const ownsPrisma = !dependencies.prisma;
  const prisma = dependencies.prisma ?? new PrismaClient();
  const runtime = createRuntime(prisma, dependencies.storage);
  const currentTime = (): Date => dependencies.now?.() ?? new Date();
  let claim: ProcessingClaim | null = null;
  let lease: FileProcessingLeaseController | null = null;
  let actorUserId: string | null = null;

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
      return "IGNORED";
    }

    if (
      extraction.status === "COMPLETED" ||
      extraction.status === "FAILED" ||
      extraction.status === "UNSUPPORTED"
    ) {
      return "IGNORED";
    }

    const now = currentTime();
    const exhausted =
      extraction.attempt >= runtime.env.FILE_PROCESSING_MAX_ATTEMPTS &&
      (extraction.status === "QUEUED" ||
        (extraction.status === "PROCESSING" &&
          extraction.leaseExpiresAt !== null &&
          extraction.leaseExpiresAt.getTime() < now.getTime()));
    if (exhausted) {
      const failed = await failExhaustedUnclaimedFileExtraction(prisma, {
        extractionId: extraction.id,
        fileVersionId: extraction.fileVersionId,
        expectedToken: extraction.processingToken,
        actorUserId: extraction.fileVersion.uploadedById,
        attempt: extraction.attempt,
        failedAt: now,
      });
      return failed ? "FAILED" : "IGNORED";
    }

    claim = await claimFileExtraction(prisma, {
      extractionId: extraction.id,
      fileVersionId: extraction.fileVersionId,
      maxAttempts: runtime.env.FILE_PROCESSING_MAX_ATTEMPTS,
      leaseMs:
        dependencies.leaseMs ?? runtime.env.FILE_PROCESSING_LEASE_MS,
      now,
    });
    if (!claim) {
      return "IGNORED";
    }

    lease = new FileProcessingLeaseController({
      prisma,
      claim,
      leaseMs:
        dependencies.leaseMs ?? runtime.env.FILE_PROCESSING_LEASE_MS,
      renewIntervalMs:
        dependencies.leaseRenewIntervalMs ??
        runtime.env.FILE_PROCESSING_LEASE_RENEW_INTERVAL_MS,
    });
    lease.start();
    await lease.assertHeld();
    await runCheckpoint(dependencies, "AFTER_CLAIM");

    const user = await prisma.user.findUnique({
      where: { id: job.requestedByUserId },
      select: { id: true },
    });
    if (!user) {
      throw permanentProcessingError(
        "PROCESSING_USER_NOT_FOUND",
        "处理请求账号不存在。",
      );
    }
    actorUserId = user.id;

    const permissions = await loadProjectPermissions(
      prisma,
      job.requestedByUserId,
      extraction.fileVersion.file.projectId,
    );
    const hasUploadPermission =
      permissions.global.has("file.upload") ||
      permissions.project.has("file.upload");
    if (!hasUploadPermission) {
      throw blockedProcessingError(
        "PROCESSING_PERMISSION_DENIED",
        "请求账号没有该项目的文件上传权限。",
      );
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
      await lease.assertHeld();
      await recordSecurityEvent(prisma, {
        fileVersionId: extraction.fileVersion.id,
        eventType:
          policy.reason === "MALWARE_SCAN_REQUIRED"
            ? "SCAN_UNAVAILABLE_BLOCK"
            : "POLICY_BLOCKED",
        severity: "HIGH",
        actorUserId,
        jobId: dependencies.jobId,
        policyCode: policy.reason,
      });
      throw blockedProcessingError(
        policy.reason,
        "当前环境不允许处理该文件。",
      );
    }

    let objectBytes: Buffer;
    try {
      await lease.assertHeld();
      objectBytes = await (dependencies.readObject ?? readObjectBytes)(
        runtime.storage,
        extraction.fileVersion.storageKey,
      );
    } catch (error) {
      if (error instanceof SimulatedWorkerCrashError) {
        throw error;
      }

      const code = getSafeErrorCode(error);
      if (code === "ENOENT" || code === "FILE_TOO_LARGE") {
        await prisma.$transaction(async (tx) => {
          await tx.fileVersion.update({
            where: { id: extraction.fileVersion.id },
            data: { integrityStatus: "FAILED" },
          });
        });
        await recordSecurityEvent(prisma, {
          fileVersionId: extraction.fileVersion.id,
          eventType:
            code === "ENOENT"
              ? "STORAGE_OBJECT_MISSING"
              : "VALIDATION_FAILED",
          severity: "CRITICAL",
          expectedChecksum: extraction.fileVersion.checksumSha256,
          actorUserId,
          jobId: dependencies.jobId,
          policyCode: "PROCESSING_INTEGRITY_PREFLIGHT",
        });
        throw permanentProcessingError(
          code === "ENOENT"
            ? "STORAGE_OBJECT_MISSING"
            : "FILE_TOO_LARGE",
          code === "ENOENT"
            ? "原始文件对象不存在。"
            : "原始文件大小超过处理上限。",
        );
      }

      throw error;
    }

    await lease.assertHeld();
    await runCheckpoint(dependencies, "AFTER_READ");

    const actualChecksum = createHash("sha256")
      .update(objectBytes)
      .digest("hex");
    if (actualChecksum !== extraction.fileVersion.checksumSha256) {
      await lease.assertHeld();
      await prisma.fileVersion.update({
        where: { id: extraction.fileVersion.id },
        data: { integrityStatus: "FAILED" },
      });
      await recordSecurityEvent(prisma, {
        fileVersionId: extraction.fileVersion.id,
        eventType: "CHECKSUM_MISMATCH",
        severity: "CRITICAL",
        expectedChecksum: extraction.fileVersion.checksumSha256,
        actualChecksum,
        actorUserId,
        jobId: dependencies.jobId,
        policyCode: "PROCESSING_INTEGRITY_PREFLIGHT",
      });
      throw permanentProcessingError(
        "FILE_INTEGRITY_FAILED",
        "文件完整性校验失败。",
      );
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
      await lease.assertHeld();
      await recordSecurityEvent(prisma, {
        fileVersionId: extraction.fileVersion.id,
        eventType: "VALIDATION_FAILED",
        severity: "HIGH",
        actorUserId,
        jobId: dependencies.jobId,
        policyCode: "PROCESSING_TYPE_PREFLIGHT",
      });
      throw permanentProcessingError(
        code,
        "文件类型无法确认或不受支持。",
      );
    }

    if (detected.mimeType !== extraction.fileVersion.detectedMimeType) {
      await lease.assertHeld();
      await recordSecurityEvent(prisma, {
        fileVersionId: extraction.fileVersion.id,
        eventType: "MIME_MISMATCH",
        severity: "HIGH",
        actorUserId,
        jobId: dependencies.jobId,
        policyCode: "PROCESSING_TYPE_PREFLIGHT",
        details: {
          expectedMimeType:
            extraction.fileVersion.detectedMimeType ?? "UNKNOWN",
          actualMimeType: detected.mimeType,
        },
      });
      throw permanentProcessingError(
        "MIME_MISMATCH",
        "文件实际类型与已存版本不一致。",
      );
    }

    let providerMetadata: object;
    let extractedText = "";
    let outputCharacterCount = 0;
    let pageCount: number | null = null;
    let parserVersion: string;
    let blocks: CompletionBlock[] = [];
    let safetyNotes: string | null = null;

    await runCheckpoint(dependencies, "BEFORE_PARSE");
    await lease.assertHeld();
    if (detected.mimeType === "application/pdf") {
      const parsed = await (dependencies.parsePdf ?? parsePdfInWorker)(
        objectBytes,
        {
          maxPages: runtime.env.PDF_MAX_PAGES,
          maxCharacters: runtime.env.PDF_MAX_TEXT_CHARS,
          timeoutMs: runtime.env.PDF_PARSE_TIMEOUT_MS,
          signal: lease.signal,
        },
      );
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
    await lease.assertHeld();
    await runCheckpoint(dependencies, "AFTER_PARSE");
    await runCheckpoint(dependencies, "BEFORE_COMMIT");
    await lease.assertHeld();
    const completedAt = currentTime();
    await lease.stop();

    const completed = await completeFileExtraction(prisma, {
      claim,
      actorUserId,
      extractedText,
      providerMetadata,
      pageCount,
      outputCharacterCount,
      parserVersion,
      safetyNotes,
      blocks,
      completedAt,
    });
    if (!completed) {
      return "IGNORED";
    }

    await runCheckpoint(dependencies, "AFTER_COMMIT");

    logger.info(
      {
        event: "file.processing.completed",
        extractionId: extraction.id,
        fileVersionId: extraction.fileVersion.id,
        mimeType: detected.mimeType,
        attempt: claim.attempt,
      },
      "File processing completed",
    );
    return "COMPLETED";
  } catch (error) {
    if (error instanceof SimulatedWorkerCrashError) {
      throw error;
    }
    if (
      error instanceof FileProcessingLeaseLostError ||
      lease?.lost
    ) {
      throw new FileProcessingLeaseLostError();
    }

    const failure = classifyFileProcessingError(error);
    if (!claim) {
      logger.error(
        {
          event: "file.processing.pre_claim_failed",
          code: failure.code,
          extractionId: job.extractionId,
        },
        "File processing failed before claim",
      );
      throw error;
    }

    await lease?.stop();

    if (failure.failureClass === "TRANSIENT") {
      if (claim.attempt >= runtime.env.FILE_PROCESSING_MAX_ATTEMPTS) {
        const failed = await failExhaustedFileExtraction(prisma, {
          extractionId: claim.extractionId,
          fileVersionId: claim.fileVersionId,
          expectedToken: claim.token,
          actorUserId: actorUserId ?? job.requestedByUserId,
          attempt: claim.attempt,
          code: failure.code,
          failedAt: currentTime(),
        });
        logger.error(
          {
            event: "file.processing.retry_exhausted",
            extractionId: claim.extractionId,
            attempt: claim.attempt,
            code: failure.code,
          },
          "File processing retry exhausted",
        );
        return failed ? "FAILED" : "IGNORED";
      }

      const retryAt = computeRetryAt({
        now: currentTime(),
        attempt: claim.attempt,
        baseDelaySeconds:
          runtime.env.FILE_PROCESSING_RETRY_DELAY_SECONDS,
        maxDelaySeconds:
          runtime.env.FILE_PROCESSING_RETRY_MAX_SECONDS,
      });
      const released = await scheduleFileExtractionRetry(prisma, {
        claim,
        actorUserId,
        code: failure.code,
        safeMessage: failure.safeMessage,
        nextAttemptAt: retryAt,
        transitionAt: currentTime(),
      });
      if (!released) {
        return "IGNORED";
      }

      logger.warn(
        {
          event: "file.processing.retry_scheduled",
          extractionId: claim.extractionId,
          attempt: claim.attempt,
          code: failure.code,
          retryAt: retryAt.toISOString(),
        },
        "File processing retry scheduled",
      );
      throw new FileProcessingRetryError(
        failure.code,
        claim.attempt,
        retryAt,
      );
    }

    const isBlocked = failure.failureClass === "BLOCKED";
    const failed = await failFileExtraction(prisma, {
      claim,
      actorUserId,
      code: failure.code,
      safeMessage: failure.safeMessage,
      recognitionStatus: isBlocked ? "BLOCKED" : "FAILED",
      auditAction: isBlocked
        ? "file.extraction.blocked"
        : "file.extraction.failed",
      failedAt: currentTime(),
    });
    logger.error(
      {
        event: isBlocked
          ? "file.processing.blocked"
          : "file.processing.failed",
        extractionId: claim.extractionId,
        attempt: claim.attempt,
        code: failure.code,
      },
      "File processing stopped",
    );
    return failed ? (isBlocked ? "BLOCKED" : "FAILED") : "IGNORED";
  } finally {
    await lease?.stop();
    if (ownsPrisma) {
      await prisma.$disconnect();
    }
  }
}
