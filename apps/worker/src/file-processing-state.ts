import { randomUUID } from "node:crypto";

import type { Prisma, PrismaClient } from "@prisma/client";

export interface ProcessingClaim {
  extractionId: string;
  fileVersionId: string;
  token: string;
  attempt: number;
  startedAt: Date;
  leaseExpiresAt: Date;
}

export interface CompletionBlock {
  pageNumber: number | null;
  blockIndex: number;
  text: string;
  sourceKind: string;
  sourceRef: string | null;
  positionData: unknown;
  characterCount: number;
}

async function updateLatestRecognitionStatus(
  tx: Prisma.TransactionClient,
  fileVersionId: string,
  extractionId: string,
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "BLOCKED",
): Promise<void> {
  const latest = await tx.fileExtraction.findFirst({
    where: { fileVersionId },
    orderBy: { extractionVersion: "desc" },
    select: { id: true },
  });

  if (latest?.id === extractionId) {
    await tx.fileVersion.update({
      where: { id: fileVersionId },
      data: { recognitionStatus: status },
    });
  }
}

export async function claimFileExtraction(
  prisma: PrismaClient,
  input: {
    extractionId: string;
    fileVersionId: string;
    maxAttempts: number;
    leaseMs: number;
    now: Date;
  },
): Promise<ProcessingClaim | null> {
  const token = randomUUID();
  const leaseExpiresAt = new Date(input.now.getTime() + input.leaseMs);
  const claimed = await prisma.fileExtraction.updateMany({
    where: {
      id: input.extractionId,
      attempt: { lt: input.maxAttempts },
      OR: [
        { status: "QUEUED" },
        {
          status: "PROCESSING",
          leaseExpiresAt: { lt: input.now },
        },
      ],
    },
    data: {
      status: "PROCESSING",
      processingToken: token,
      leaseExpiresAt,
      nextAttemptAt: null,
      startedAt: input.now,
      completedAt: null,
      attempt: { increment: 1 },
    },
  });

  if (claimed.count !== 1) {
    return null;
  }

  const extraction = await prisma.fileExtraction.findUniqueOrThrow({
    where: { id: input.extractionId },
    select: { attempt: true },
  });

  return {
    extractionId: input.extractionId,
    fileVersionId: input.fileVersionId,
    token,
    attempt: extraction.attempt,
    startedAt: input.now,
    leaseExpiresAt,
  };
}

export async function completeFileExtraction(
  prisma: PrismaClient,
  input: {
    claim: ProcessingClaim;
    actorUserId: string | null;
    extractedText: string;
    providerMetadata: object;
    pageCount: number | null;
    outputCharacterCount: number;
    parserVersion: string;
    safetyNotes: string | null;
    blocks: CompletionBlock[];
    completedAt: Date;
  },
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const changed = await tx.fileExtraction.updateMany({
      where: {
        id: input.claim.extractionId,
        status: "PROCESSING",
        processingToken: input.claim.token,
      },
      data: {
        status: "COMPLETED",
        processingToken: null,
        leaseExpiresAt: null,
        nextAttemptAt: null,
        extractedText: input.extractedText,
        providerMetadata: input.providerMetadata,
        pageCount: input.pageCount,
        outputCharacterCount: input.outputCharacterCount,
        parserVersion: input.parserVersion,
        safetyNotes: input.safetyNotes,
        safeErrorCode: null,
        safeErrorMessage: null,
        completedAt: input.completedAt,
      },
    });

    if (changed.count !== 1) {
      return false;
    }

    if (input.blocks.length > 0) {
      await tx.extractionTextBlock.createMany({
        data: input.blocks.map((block) => ({
          extractionId: input.claim.extractionId,
          pageNumber: block.pageNumber,
          blockIndex: block.blockIndex,
          text: block.text,
          sourceKind: block.sourceKind,
          sourceRef: block.sourceRef,
          positionData: block.positionData as Prisma.InputJsonValue,
          characterCount: block.characterCount,
        })),
      });
    }

    await updateLatestRecognitionStatus(
      tx,
      input.claim.fileVersionId,
      input.claim.extractionId,
      "COMPLETED",
    );
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "file.extraction.completed",
        objectType: "FileVersion",
        objectId: input.claim.fileVersionId,
        newValue: {
          extractionId: input.claim.extractionId,
          attempt: input.claim.attempt,
          pageCount: input.pageCount,
          outputCharacterCount: input.outputCharacterCount,
        },
      },
    });
    return true;
  });
}

export async function scheduleFileExtractionRetry(
  prisma: PrismaClient,
  input: {
    claim: ProcessingClaim;
    actorUserId: string | null;
    code: string;
    safeMessage: string;
    nextAttemptAt: Date;
  },
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const changed = await tx.fileExtraction.updateMany({
      where: {
        id: input.claim.extractionId,
        status: "PROCESSING",
        processingToken: input.claim.token,
      },
      data: {
        status: "QUEUED",
        processingToken: null,
        leaseExpiresAt: null,
        nextAttemptAt: input.nextAttemptAt,
        startedAt: null,
        safeErrorCode: input.code,
        safeErrorMessage: input.safeMessage,
      },
    });

    if (changed.count !== 1) {
      return false;
    }

    await updateLatestRecognitionStatus(
      tx,
      input.claim.fileVersionId,
      input.claim.extractionId,
      "QUEUED",
    );
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "file.extraction.retry_scheduled",
        objectType: "FileVersion",
        objectId: input.claim.fileVersionId,
        reason: input.code,
        newValue: {
          extractionId: input.claim.extractionId,
          attempt: input.claim.attempt,
          retryable: true,
          nextAttemptAt: input.nextAttemptAt.toISOString(),
        },
      },
    });
    return true;
  });
}

export async function failFileExtraction(
  prisma: PrismaClient,
  input: {
    claim: ProcessingClaim;
    actorUserId: string | null;
    code: string;
    safeMessage: string;
    recognitionStatus: "FAILED" | "BLOCKED";
    auditAction:
      | "file.extraction.failed"
      | "file.extraction.blocked"
      | "file.extraction.retry_exhausted";
    failedAt: Date;
    details?: Prisma.InputJsonObject;
  },
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const changed = await tx.fileExtraction.updateMany({
      where: {
        id: input.claim.extractionId,
        status: "PROCESSING",
        processingToken: input.claim.token,
      },
      data: {
        status: "FAILED",
        processingToken: null,
        leaseExpiresAt: null,
        nextAttemptAt: null,
        safeErrorCode: input.code,
        safeErrorMessage: input.safeMessage,
        completedAt: input.failedAt,
      },
    });

    if (changed.count !== 1) {
      return false;
    }

    await updateLatestRecognitionStatus(
      tx,
      input.claim.fileVersionId,
      input.claim.extractionId,
      input.recognitionStatus,
    );
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.auditAction,
        objectType: "FileVersion",
        objectId: input.claim.fileVersionId,
        reason: input.code,
        newValue: {
          extractionId: input.claim.extractionId,
          attempt: input.claim.attempt,
          retryable: false,
          ...(input.details ?? {}),
        },
      },
    });
    return true;
  });
}

export async function failExhaustedFileExtraction(
  prisma: PrismaClient,
  input: {
    extractionId: string;
    fileVersionId: string;
    expectedToken: string;
    actorUserId: string;
    attempt: number;
    code: string;
    failedAt: Date;
  },
): Promise<boolean> {
  return failFileExtraction(prisma, {
    claim: {
      extractionId: input.extractionId,
      fileVersionId: input.fileVersionId,
      token: input.expectedToken,
      attempt: input.attempt,
      startedAt: input.failedAt,
      leaseExpiresAt: input.failedAt,
    },
    actorUserId: input.actorUserId,
    code: input.code,
    safeMessage: "文件处理已达到最大重试次数，请稍后重新发起处理。",
    recognitionStatus: "FAILED",
    auditAction: "file.extraction.retry_exhausted",
    failedAt: input.failedAt,
    details: {
      maxAttemptsReached: true,
    },
  });
}

export async function failExhaustedUnclaimedFileExtraction(
  prisma: PrismaClient,
  input: {
    extractionId: string;
    fileVersionId: string;
    expectedToken: string | null;
    actorUserId: string;
    attempt: number;
    failedAt: Date;
  },
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const changed = await tx.fileExtraction.updateMany({
      where: {
        id: input.extractionId,
        attempt: { gte: input.attempt },
        OR: [
          { status: "QUEUED" },
          {
            status: "PROCESSING",
            processingToken: input.expectedToken ?? "",
            leaseExpiresAt: { lt: input.failedAt },
          },
        ],
      },
      data: {
        status: "FAILED",
        processingToken: null,
        leaseExpiresAt: null,
        nextAttemptAt: null,
        safeErrorCode: "MAX_ATTEMPTS_EXHAUSTED",
        safeErrorMessage:
          "文件处理已达到最大重试次数，请稍后重新发起处理。",
        completedAt: input.failedAt,
      },
    });

    if (changed.count !== 1) {
      return false;
    }

    await updateLatestRecognitionStatus(
      tx,
      input.fileVersionId,
      input.extractionId,
      "FAILED",
    );
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "file.extraction.retry_exhausted",
        objectType: "FileVersion",
        objectId: input.fileVersionId,
        reason: "MAX_ATTEMPTS_EXHAUSTED",
        newValue: {
          extractionId: input.extractionId,
          attempt: input.attempt,
          retryable: false,
        },
      },
    });
    return true;
  });
}

export async function recoverExpiredFileExtraction(
  prisma: PrismaClient,
  input: {
    extractionId: string;
    fileVersionId: string;
    expectedToken: string;
    actorUserId: string;
    now: Date;
  },
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const changed = await tx.fileExtraction.updateMany({
      where: {
        id: input.extractionId,
        status: "PROCESSING",
        processingToken: input.expectedToken,
        leaseExpiresAt: { lt: input.now },
      },
      data: {
        status: "QUEUED",
        processingToken: null,
        leaseExpiresAt: null,
        nextAttemptAt: input.now,
        startedAt: null,
        completedAt: null,
        safeErrorCode: "WORKER_LEASE_EXPIRED",
        safeErrorMessage: "处理执行租约已过期，任务已重新排队。",
      },
    });

    if (changed.count !== 1) {
      return false;
    }

    await updateLatestRecognitionStatus(
      tx,
      input.fileVersionId,
      input.extractionId,
      "QUEUED",
    );
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "file.extraction.recovered",
        objectType: "FileVersion",
        objectId: input.fileVersionId,
        reason: "WORKER_LEASE_EXPIRED",
        newValue: {
          extractionId: input.extractionId,
        },
      },
    });
    return true;
  });
}
