import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import {
  detectAllowedFileType,
  filenameMatchesMimeType,
  isObjectStorageAdapterAllowed,
  ObjectStorageError,
  type ObjectStorageAdapter,
  type ObjectStorageVersionIdentity,
} from "@elevator/file-storage";
import { Prisma, type PrismaClient } from "@prisma/client";

import type { Actor } from "@/modules/access/actor";
import { appendAuditLog } from "@/modules/audit/log";
import { AppError } from "@/server/http/errors";
import { prisma } from "@/server/prisma";

import {
  ObjectUploadLeaseController,
  ObjectUploadLeaseLostError,
  renewObjectUploadLease,
} from "./object-upload-lease";
import {
  classifyObjectUploadRecovery,
  isValidObjectStorageVersionId,
  isValidObjectWriteIdempotencyKey,
  makeObjectWriteIdempotencyKey,
  makeStorageLifecycleId,
} from "./object-upload-protocol";

const MAX_FILE_SIZE_BYTES = 20n * 1024n * 1024n;
const DEFAULT_LEASE_MS = 120_000;
const DEFAULT_RENEW_INTERVAL_MS = 30_000;
const UPLOAD_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
} as const;

export interface CompleteObjectUploadInput {
  actor: Actor;
  projectId: string;
  intentId: string;
  requestContentLength: number | null;
  requestMimeType: string | null;
  source: Readable;
  requestId: string;
  objectStorage: ObjectStorageAdapter;
  database?: PrismaClient;
  nodeEnvironment?: string;
  leaseMs?: number;
  leaseRenewIntervalMs?: number;
}

interface PreparedObjectChain {
  attemptId: string;
  stagingLifecycleId: string;
  canonicalLifecycleId: string;
  operationId: string;
  bindingId: string;
  stagingKey: string;
  canonicalKey: string;
  ownerToken: string;
  generation: bigint;
  leaseExpiresAt: Date;
  expectedSizeBytes: bigint;
  expectedChecksumSha256: string;
  writeIdempotencyKey: string;
}

interface BufferedUpload {
  bytes: Buffer;
  checksumSha256: string;
  detectedMimeType: "application/pdf" | "image/jpeg" | "image/png";
}

interface ObservedVersion {
  providerVersionId: string;
  providerGeneration: bigint | null;
  providerRequestId: string | null;
  sizeBytes: bigint;
  checksumSha256: string;
}

function makeOwnerToken(): string {
  return randomUUID().replaceAll("-", "");
}

function mapStorageFailure(error: ObjectStorageError): AppError {
  switch (error.code) {
    case "OBJECT_STORAGE_WRITE_UNCERTAIN":
      return new AppError(
        "OBJECT_STORAGE_WRITE_UNCERTAIN",
        "对象存储写入结果不确定，已保留状态等待核实。",
        409,
      );
    case "OBJECT_STORAGE_UNAVAILABLE":
    case "OBJECT_STORAGE_ADAPTER_UNAVAILABLE":
    case "OBJECT_STORAGE_PROVIDER_TEMPORARY_FAILURE":
      return new AppError(
        "OBJECT_STORAGE_UNAVAILABLE",
        "对象存储暂时不可用。",
        503,
      );
    case "OBJECT_STORAGE_PROVIDER_CONFIGURATION_UNAVAILABLE":
      return new AppError(
        error.code,
        "对象存储配置不可用。",
        503,
      );
    case "OBJECT_STORAGE_PERMISSION_DENIED":
      return new AppError(
        "OBJECT_STORAGE_PERMISSION_DENIED",
        "对象存储权限不足。",
        403,
      );
    case "OBJECT_STORAGE_NOT_FOUND":
      return new AppError(
        "OBJECT_STORAGE_NOT_FOUND",
        "对象存储中的文件版本不存在。",
        409,
      );
    case "OBJECT_STORAGE_VERSION_MISMATCH":
    case "OBJECT_STORAGE_BINDING_INVALID":
      return new AppError(
        "OBJECT_STORAGE_VERSION_MISMATCH",
        "对象存储返回了错误的版本。",
        409,
      );
    case "OBJECT_STORAGE_CHECKSUM_MISMATCH":
      return new AppError(
        "OBJECT_STORAGE_CHECKSUM_MISMATCH",
        "对象内容摘要校验失败。",
        409,
      );
    case "OBJECT_STORAGE_SIZE_MISMATCH":
      return new AppError(
        "OBJECT_STORAGE_SIZE_MISMATCH",
        "对象大小校验失败。",
        409,
      );
    case "OBJECT_STORAGE_VERSION_REQUIRED":
    case "OBJECT_STORAGE_NO_OVERWRITE_UNSUPPORTED":
    case "OBJECT_STORAGE_CAPABILITY_UNVERIFIED":
      return new AppError(
        error.code,
        "对象存储能力未满足安全要求。",
        503,
      );
    default:
      return new AppError(
        "OBJECT_STORAGE_FAILED",
        "对象存储处理失败。",
        500,
      );
  }
}

function assertAdapterCapabilities(adapter: ObjectStorageAdapter): void {
  if (
    adapter.capabilities.immutableWrite !== "SUPPORTED" ||
    adapter.capabilities.exactVersionRead !== "SUPPORTED" ||
    adapter.capabilities.exactVersionIdentity !== "SUPPORTED" ||
    adapter.capabilities.checksumReadback !== "SUPPORTED" ||
    adapter.capabilities.exactWriteDiscovery !== "SUPPORTED"
  ) {
    throw new AppError(
      "OBJECT_STORAGE_CAPABILITY_UNVERIFIED",
      "对象存储能力未满足 Route C-Minimal 安全要求。",
      503,
    );
  }
}

async function bufferUploadSource(
  source: Readable,
  expectedSizeBytes: bigint,
): Promise<BufferedUpload> {
  const chunks: Buffer[] = [];
  let sizeBytes = 0n;
  const hash = createHash("sha256");

  for await (const rawChunk of source) {
    const chunk = Buffer.isBuffer(rawChunk)
      ? rawChunk
      : Buffer.from(rawChunk);
    sizeBytes += BigInt(chunk.byteLength);
    if (sizeBytes > expectedSizeBytes || sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new AppError(
        "CONTENT_LENGTH_MISMATCH",
        "上传大小与声明不一致。",
        400,
      );
    }
    hash.update(chunk);
    chunks.push(chunk);
  }

  if (sizeBytes !== expectedSizeBytes || sizeBytes === 0n) {
    throw new AppError(
      "CONTENT_LENGTH_MISMATCH",
      "上传大小与声明不一致。",
      400,
    );
  }

  const bytes = Buffer.concat(chunks);
  const detected = await detectAllowedFileType(bytes.subarray(0, 4100));
  return {
    bytes,
    checksumSha256: hash.digest("hex"),
    detectedMimeType: detected.mimeType,
  };
}

function assertVersionIdentity(input: {
  version: ObjectStorageVersionIdentity;
  provider: ObjectStorageAdapter["provider"];
  objectKey: string;
  sizeBytes: bigint;
  checksumSha256: string;
}): void {
  if (
    input.version.providerKind !== input.provider.providerKind ||
    input.version.accountScopeRef !== input.provider.accountScopeRef ||
    input.version.region !== input.provider.region ||
    input.version.bucketOrContainer !==
      input.provider.bucketOrContainer ||
    input.version.objectKey !== input.objectKey ||
    !isValidObjectStorageVersionId(input.version.providerVersionId) ||
    input.sizeBytes <= 0n ||
    !/^[0-9a-f]{64}$/i.test(input.checksumSha256)
  ) {
    throw new ObjectStorageError(
      "OBJECT_STORAGE_VERSION_MISMATCH",
      "Provider returned an invalid exact object identity.",
    );
  }
}

async function findIntent(
  database: PrismaClient,
  input: {
    intentId: string;
    projectId: string;
    actorId: string;
  },
) {
  const intent = await database.fileUploadIntent.findUnique({
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
    intent.uploadedById !== input.actorId
  ) {
    throw new AppError("UPLOAD_INTENT_NOT_FOUND", "上传意图不存在。", 404);
  }
  return intent;
}

type UploadIntentRecord = Awaited<ReturnType<typeof findIntent>>;

async function loadCompletedUpload(
  database: PrismaClient,
  intent: {
    completedFileVersionId: string | null;
  },
) {
  if (!intent.completedFileVersionId) {
    throw new AppError(
      "UPLOAD_COMPLETION_NOT_AVAILABLE",
      "上传尚未完成。",
      409,
    );
  }
  const version = await database.fileVersion.findUniqueOrThrow({
    where: { id: intent.completedFileVersionId },
  });
  const extraction = await database.fileExtraction.findFirstOrThrow({
    where: { fileVersionId: version.id },
    orderBy: { extractionVersion: "desc" },
    select: { id: true },
  });
  return { version, extractionId: extraction.id };
}

type CompletedObjectUpload = Awaited<ReturnType<typeof loadCompletedUpload>>;

async function prepareObjectChain(input: {
  database: PrismaClient;
  intent: UploadIntentRecord;
  provider: ObjectStorageAdapter["provider"];
  upload: BufferedUpload;
  now: Date;
  leaseMs: number;
}): Promise<PreparedObjectChain> {
  if (!input.intent.stagingKey) {
    throw new AppError(
      "UPLOAD_STAGING_KEY_MISSING",
      "上传意图缺少 staging 身份。",
      409,
    );
  }

  const attemptId = makeStorageLifecycleId();
  const stagingLifecycleId = makeStorageLifecycleId();
  const canonicalLifecycleId = makeStorageLifecycleId();
  const operationId = makeStorageLifecycleId();
  const bindingId = makeStorageLifecycleId();
  const canonicalKey = `objects/${randomUUID()}`;
  const ownerToken = makeOwnerToken();
  const generation = 1n;
  const writeIdempotencyKey = makeObjectWriteIdempotencyKey({
    attemptId,
    operationId,
  });
  const leaseExpiresAt = new Date(input.now.getTime() + input.leaseMs);

  try {
    await input.database.$transaction(async (tx) => {
      await tx.storageObjectLifecycle.create({
        data: {
          id: stagingLifecycleId,
          objectKind: "STAGING",
          storageBackend: "OBJECT_STORE",
          storageKey: input.intent.stagingKey!,
          state: "STAGING_RESERVED",
          reservedAttemptId: attemptId,
          reservedIntentId: input.intent.id,
          fencingGeneration: 0n,
          lastTransitionAt: input.now,
        },
      });

      await tx.fileUploadAttempt.create({
        data: {
          id: attemptId,
          intentId: input.intent.id,
          stagingKey: input.intent.stagingKey!,
          status: "RESERVED",
        },
      });

      const claimed = await tx.fileUploadIntent.updateMany({
        where: {
          id: input.intent.id,
          status: "PENDING",
          currentAttemptId: null,
          completedFileVersionId: null,
          expiresAt: { gt: input.now },
        },
        data: {
          status: "UPLOADING",
          currentAttemptId: attemptId,
          claimedAt: input.now,
        },
      });
      if (claimed.count !== 1) {
        throw new AppError(
          "UPLOAD_ALREADY_CLAIMED",
          "该上传正在由另一个请求处理。",
          409,
        );
      }

      if (input.intent.existingFileId) {
        const rows = await tx.$queryRaw<
          Array<{ currentVersionId: string | null }>
        >`
          SELECT "currentVersionId"
          FROM "file"
          WHERE "id" = ${input.intent.existingFileId}
          FOR UPDATE
        `;
        if (
          !rows[0] ||
          rows[0].currentVersionId !==
            input.intent.expectedCurrentFileVersionId
        ) {
          throw new AppError(
            "UPLOAD_TARGET_CHANGED",
            "目标文件版本已变化，请重新创建上传意图。",
            409,
          );
        }
      }

      await tx.storageObjectLifecycle.update({
        where: { id: stagingLifecycleId },
        data: {
          state: "STAGING",
          ownerToken,
          fencingGeneration: generation,
          leaseExpiresAt,
          lastTransitionAt: input.now,
        },
      });
      await tx.fileUploadAttempt.update({
        where: { id: attemptId },
        data: { status: "WRITING" },
      });

      await tx.storageObjectLifecycle.create({
        data: {
          id: canonicalLifecycleId,
          objectKind: "CANONICAL",
          storageBackend: "OBJECT_STORE",
          storageKey: canonicalKey,
          state: "FINALIZING",
          ownerToken,
          fencingGeneration: generation,
          leaseExpiresAt,
          lastTransitionAt: input.now,
        },
      });
      await tx.storageObjectOperation.create({
        data: {
          id: operationId,
          objectLifecycleId: canonicalLifecycleId,
          storageKey: canonicalKey,
          sourceAttemptId: attemptId,
          operationType: "FINALIZE",
          state: "PREPARED",
          ownerToken,
          fencingGeneration: generation,
          writeIdempotencyKey,
          leaseExpiresAt,
          sourcePath: input.intent.stagingKey,
          targetPath: canonicalKey,
          expectedSizeBytes: input.upload.bytes.byteLength
            ? BigInt(input.upload.bytes.byteLength)
            : input.intent.declaredSizeBytes,
          expectedChecksumSha256: input.upload.checksumSha256,
        },
      });
      await tx.storageObjectLifecycle.update({
        where: { id: canonicalLifecycleId },
        data: { currentOperationId: operationId },
      });
      await tx.storageObjectBinding.create({
        data: {
          id: bindingId,
          objectLifecycleId: canonicalLifecycleId,
          operationId,
          providerKind: input.provider.providerKind,
          accountScopeRef: input.provider.accountScopeRef,
          region: input.provider.region,
          bucketOrContainer: input.provider.bucketOrContainer,
          objectKey: canonicalKey,
          state: "PENDING",
        },
      });
    }, UPLOAD_TRANSACTION_OPTIONS);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        "UPLOAD_ALREADY_CLAIMED",
        "该文件已有进行中的上传或对象键发生冲突。",
        409,
      );
    }
    throw error;
  }

  return {
    attemptId,
    stagingLifecycleId,
    canonicalLifecycleId,
    operationId,
    bindingId,
    stagingKey: input.intent.stagingKey,
    canonicalKey,
    ownerToken,
    generation,
    leaseExpiresAt,
    expectedSizeBytes: BigInt(input.upload.bytes.byteLength),
    expectedChecksumSha256: input.upload.checksumSha256,
    writeIdempotencyKey,
  };
}

async function advanceChainForDispatch(input: {
  database: PrismaClient;
  chain: PreparedObjectChain;
  now: Date;
  leaseMs: number;
}): Promise<void> {
  const leaseExpiresAt = new Date(input.now.getTime() + input.leaseMs);
  await input.database.$transaction(async (tx) => {
    const operation = await tx.storageObjectOperation.updateMany({
      where: {
        id: input.chain.operationId,
        ownerToken: input.chain.ownerToken,
        fencingGeneration: input.chain.generation,
        state: "PREPARED",
        leaseExpiresAt: { gt: input.now },
      },
      data: {
        state: "EXECUTING",
        executionStartedAt: input.now,
        leaseExpiresAt,
        expectedSizeBytes: input.chain.expectedSizeBytes,
        expectedChecksumSha256: input.chain.expectedChecksumSha256,
      },
    });
    const staging = await tx.storageObjectLifecycle.updateMany({
      where: {
        id: input.chain.stagingLifecycleId,
        ownerToken: input.chain.ownerToken,
        fencingGeneration: input.chain.generation,
        state: "STAGING",
        leaseExpiresAt: { gt: input.now },
      },
      data: {
        state: "STAGING_READY",
        sizeBytes: input.chain.expectedSizeBytes,
        checksumSha256: input.chain.expectedChecksumSha256,
        leaseExpiresAt,
        lastTransitionAt: input.now,
      },
    });
    const ready = await tx.fileUploadAttempt.updateMany({
      where: {
        id: input.chain.attemptId,
        status: "WRITING",
      },
      data: { status: "READY", readyAt: input.now },
    });
    const canonical = await tx.storageObjectLifecycle.updateMany({
      where: {
        id: input.chain.canonicalLifecycleId,
        ownerToken: input.chain.ownerToken,
        fencingGeneration: input.chain.generation,
        state: "FINALIZING",
        leaseExpiresAt: { gt: input.now },
      },
      data: { leaseExpiresAt },
    });
    const finalizing = await tx.fileUploadAttempt.updateMany({
      where: {
        id: input.chain.attemptId,
        status: "READY",
      },
      data: {
        status: "FINALIZING",
        canonicalStorageKey: input.chain.canonicalKey,
      },
    });
    if (
      operation.count !== 1 ||
      staging.count !== 1 ||
      ready.count !== 1 ||
      canonical.count !== 1 ||
      finalizing.count !== 1
    ) {
      throw new ObjectUploadLeaseLostError();
    }
  }, UPLOAD_TRANSACTION_OPTIONS);
  input.chain.leaseExpiresAt = leaseExpiresAt;
}

async function loadAttemptChain(
  database: PrismaClient,
  intent: {
    id: string;
    currentAttemptId: string | null;
  },
) {
  if (!intent.currentAttemptId) {
    throw new AppError(
      "UPLOAD_RECOVERY_CHAIN_MISSING",
      "上传恢复链缺少当前 Attempt。",
      409,
    );
  }
  const attempt = await database.fileUploadAttempt.findUnique({
    where: { id: intent.currentAttemptId },
    include: {
      stagingLifecycle: true,
      canonicalLifecycle: true,
      operations: {
        where: { operationType: "FINALIZE" },
        include: {
          objectBinding: {
            include: {
              objectLifecycle: true,
            },
          },
        },
      },
    },
  });
  const operation = attempt?.operations[0];
  const binding = operation?.objectBinding;
  const canonical =
    attempt?.canonicalLifecycle ??
    operation?.objectBinding?.objectLifecycle ??
    null;
  if (
    !attempt ||
    attempt.operations.length !== 1 ||
    !attempt.stagingLifecycle ||
    !canonical ||
    !operation ||
    !binding ||
    binding.objectLifecycleId !== canonical.id ||
    (attempt.canonicalStorageKey !== null &&
      binding.objectKey !== attempt.canonicalStorageKey)
  ) {
    throw new AppError(
      "UPLOAD_RECOVERY_CHAIN_INVALID",
      "上传恢复链不完整，已保持保留状态。",
      409,
    );
  }
  return {
    attempt,
    operation,
    binding,
    staging: attempt.stagingLifecycle,
    canonical,
  };
}

async function takeoverAttemptChain(input: {
  database: PrismaClient;
  chain: PreparedObjectChain;
  loadedOperationLeaseExpiresAt: Date | null;
  now: Date;
  leaseMs: number;
}): Promise<PreparedObjectChain> {
  if (
    !input.loadedOperationLeaseExpiresAt ||
    input.loadedOperationLeaseExpiresAt.getTime() > input.now.getTime()
  ) {
    throw new AppError(
      "UPLOAD_RECOVERY_LEASE_ACTIVE",
      "原上传执行者的租约仍然有效。",
      409,
    );
  }
  const ownerToken = makeOwnerToken();
  const generation = input.chain.generation + 1n;
  const leaseExpiresAt = new Date(input.now.getTime() + input.leaseMs);

  await input.database.$transaction(async (tx) => {
    const operation = await tx.storageObjectOperation.updateMany({
      where: {
        id: input.chain.operationId,
        ownerToken: input.chain.ownerToken,
        fencingGeneration: input.chain.generation,
        state: { in: ["PREPARED", "EXECUTING", "UNKNOWN"] },
        leaseExpiresAt: { lt: input.now },
      },
      data: {
        ownerToken,
        fencingGeneration: generation,
        leaseExpiresAt,
      },
    });
    const canonical = await tx.storageObjectLifecycle.updateMany({
      where: {
        id: input.chain.canonicalLifecycleId,
        ownerToken: input.chain.ownerToken,
        fencingGeneration: input.chain.generation,
        state: "FINALIZING",
        leaseExpiresAt: { lt: input.now },
      },
      data: {
        ownerToken,
        fencingGeneration: generation,
        leaseExpiresAt,
      },
    });
    const staging = await tx.storageObjectLifecycle.updateMany({
      where: {
        id: input.chain.stagingLifecycleId,
        ownerToken: input.chain.ownerToken,
        fencingGeneration: input.chain.generation,
        state: { in: ["STAGING", "STAGING_READY"] },
        leaseExpiresAt: { lt: input.now },
      },
      data: {
        ownerToken,
        fencingGeneration: generation,
        leaseExpiresAt,
      },
    });
    if (
      operation.count !== 1 ||
      canonical.count !== 1 ||
      staging.count !== 1
    ) {
      throw new AppError(
        "UPLOAD_RECOVERY_TAKEOVER_CONFLICT",
        "另一个恢复执行者已经接管。",
        409,
      );
    }
  }, UPLOAD_TRANSACTION_OPTIONS);

  return {
    ...input.chain,
    ownerToken,
    generation,
    leaseExpiresAt,
  };
}

async function recordBindingObservation(input: {
  database: PrismaClient;
  chain: PreparedObjectChain;
  observed: ObservedVersion;
}): Promise<void> {
  await input.database.$transaction(async (tx) => {
    const operationRows = await tx.$queryRaw<
      Array<{ id: string }>
    >`
      SELECT "id"
      FROM "storage_object_operation"
      WHERE "id" = ${input.chain.operationId}
        AND "ownerToken" = ${input.chain.ownerToken}
        AND "fencingGeneration" = ${input.chain.generation}
        AND "state" IN ('EXECUTING', 'UNKNOWN')
      FOR UPDATE
    `;
    if (!operationRows[0]) {
      throw new ObjectUploadLeaseLostError();
    }
    const updated = await tx.storageObjectBinding.updateMany({
      where: {
        id: input.chain.bindingId,
        state: "PENDING",
        writeObservedAt: null,
      },
      data: {
        providerVersionId: input.observed.providerVersionId,
        providerGeneration: input.observed.providerGeneration,
        providerRequestId: input.observed.providerRequestId,
        sizeBytes: input.observed.sizeBytes,
        checksumSha256: input.observed.checksumSha256,
        writeObservedAt: new Date(),
      },
    });
    if (updated.count === 1) {
      return;
    }
    const existing = await tx.storageObjectBinding.findUnique({
      where: { id: input.chain.bindingId },
    });
    if (
      !existing ||
      existing.state !== "PENDING" ||
      existing.providerVersionId !== input.observed.providerVersionId ||
      existing.providerGeneration !== input.observed.providerGeneration ||
      existing.providerRequestId !== input.observed.providerRequestId ||
      existing.sizeBytes !== input.observed.sizeBytes ||
      existing.checksumSha256?.toLowerCase() !==
        input.observed.checksumSha256.toLowerCase() ||
      !existing.writeObservedAt
    ) {
      throw new AppError(
        "UPLOAD_VERSION_OBSERVATION_CONFLICT",
        "对象精确版本观察与已有持久状态冲突。",
        409,
      );
    }
  }, UPLOAD_TRANSACTION_OPTIONS);
}

async function setRecoveryRequired(input: {
  database: PrismaClient;
  chain: PreparedObjectChain;
  code: string;
}): Promise<void> {
  const now = new Date();
  await input.database.$transaction(async (tx) => {
    const operationRows = await tx.$queryRaw<
      Array<{ state: string }>
    >`
      SELECT "state"
      FROM "storage_object_operation"
      WHERE "id" = ${input.chain.operationId}
        AND "ownerToken" = ${input.chain.ownerToken}
        AND "fencingGeneration" = ${input.chain.generation}
      FOR UPDATE
    `;
    const operation = operationRows[0];
    if (!operation || !["EXECUTING", "UNKNOWN"].includes(operation.state)) {
      return;
    }
    if (operation.state === "EXECUTING") {
      await tx.storageObjectOperation.updateMany({
        where: {
          id: input.chain.operationId,
          ownerToken: input.chain.ownerToken,
          fencingGeneration: input.chain.generation,
          state: "EXECUTING",
        },
        data: {
          state: "UNKNOWN",
          lastErrorCode: input.code,
        },
      });
    }
    await tx.fileUploadAttempt.updateMany({
      where: {
        id: input.chain.attemptId,
        status: "FINALIZING",
      },
      data: {
        status: "RECOVERY_REQUIRED",
        failureCode: input.code,
      },
    });
    await tx.storageObjectOperation.updateMany({
      where: {
        id: input.chain.operationId,
        ownerToken: input.chain.ownerToken,
        fencingGeneration: input.chain.generation,
        state: "UNKNOWN",
      },
      data: {
        lastErrorCode: input.code,
      },
    });
  }, UPLOAD_TRANSACTION_OPTIONS);
}

async function failBeforeDispatch(input: {
  database: PrismaClient;
  chain: PreparedObjectChain;
  intentId: string;
  code: string;
}): Promise<void> {
  const now = new Date();
  await input.database.$transaction(async (tx) => {
    await tx.storageObjectBinding.updateMany({
      where: {
        id: input.chain.bindingId,
        state: "PENDING",
        writeObservedAt: null,
      },
      data: { state: "FAILED_RETAINED" },
    });
    await tx.storageObjectOperation.updateMany({
      where: {
        id: input.chain.operationId,
        ownerToken: input.chain.ownerToken,
        fencingGeneration: input.chain.generation,
        state: "PREPARED",
      },
      data: {
        state: "FAILED",
        leaseExpiresAt: null,
        lastErrorCode: input.code,
        completedAt: now,
      },
    });
    await tx.storageObjectLifecycle.updateMany({
      where: {
        id: input.chain.canonicalLifecycleId,
        ownerToken: input.chain.ownerToken,
        fencingGeneration: input.chain.generation,
        state: "FINALIZING",
      },
      data: {
        state: "FAILED_RETAINED",
        leaseExpiresAt: null,
        lastTransitionAt: now,
        lastErrorCode: input.code,
      },
    });
    await tx.storageObjectLifecycle.updateMany({
      where: {
        id: input.chain.stagingLifecycleId,
        ownerToken: input.chain.ownerToken,
        fencingGeneration: input.chain.generation,
        state: "STAGING",
      },
      data: {
        state: "STAGING_ABANDONED",
        leaseExpiresAt: null,
        lastTransitionAt: now,
        lastErrorCode: input.code,
      },
    });
    await tx.fileUploadAttempt.updateMany({
      where: {
        id: input.chain.attemptId,
        status: "WRITING",
      },
      data: {
        status: "FAILED",
        failureCode: input.code,
      },
    });
    await tx.fileUploadIntent.updateMany({
      where: {
        id: input.intentId,
        status: "UPLOADING",
        completedFileVersionId: null,
      },
      data: {
        status: "FAILED",
        failureCode: input.code,
      },
    });
  }, UPLOAD_TRANSACTION_OPTIONS);
}

async function finalizeObjectChain(input: {
  database: PrismaClient;
  actor: Actor;
  requestId: string;
  intent: UploadIntentRecord;
  chain: PreparedObjectChain;
  observed: ObservedVersion;
  detectedMimeType: string;
}) {
  return input.database.$transaction(async (tx) => {
    const now = new Date();
    const operation = await tx.storageObjectOperation.updateMany({
      where: {
        id: input.chain.operationId,
        ownerToken: input.chain.ownerToken,
        fencingGeneration: input.chain.generation,
        state: { in: ["EXECUTING", "UNKNOWN"] },
        leaseExpiresAt: { gt: now },
      },
      data: {
        state: "APPLIED",
        leaseExpiresAt: null,
        completedAt: now,
      },
    });
    const canonical = await tx.storageObjectLifecycle.updateMany({
      where: {
        id: input.chain.canonicalLifecycleId,
        ownerToken: input.chain.ownerToken,
        fencingGeneration: input.chain.generation,
        state: "FINALIZING",
        leaseExpiresAt: { gt: now },
      },
      data: {
        state: "ACTIVE",
        leaseExpiresAt: null,
        lastTransitionAt: now,
      },
    });
    const attempt = await tx.fileUploadAttempt.updateMany({
      where: {
        id: input.chain.attemptId,
        status: { in: ["FINALIZING", "RECOVERY_REQUIRED"] },
        canonicalStorageKey: input.chain.canonicalKey,
      },
      data: {
        status: "COMPLETED",
        completedAt: now,
      },
    });
    const binding = await tx.storageObjectBinding.updateMany({
      where: {
        id: input.chain.bindingId,
        state: "PENDING",
        providerVersionId: input.observed.providerVersionId,
        writeObservedAt: { not: null },
      },
      data: {
        state: "VERIFIED",
        verifiedAt: now,
      },
    });
    if (
      operation.count !== 1 ||
      canonical.count !== 1 ||
      attempt.count !== 1 ||
      binding.count !== 1
    ) {
      throw new AppError(
        "UPLOAD_FINALIZATION_FENCED",
        "上传终态化权已被其他执行者或状态变化取代。",
        409,
      );
    }

    const fileId = input.intent.existingFileId ?? randomUUID();
    if (input.intent.existingFileId) {
      const rows = await tx.$queryRaw<
        Array<{ currentVersionId: string | null }>
      >`
        SELECT "currentVersionId"
        FROM "file"
        WHERE "id" = ${input.intent.existingFileId}
        FOR UPDATE
      `;
      if (
        !rows[0] ||
        rows[0].currentVersionId !==
          input.intent.expectedCurrentFileVersionId
      ) {
        throw new AppError(
          "UPLOAD_TARGET_CHANGED",
          "目标文件版本在发布前发生变化。",
          409,
        );
      }
    } else {
      await tx.file.create({
        data: {
          id: fileId,
          createdByUploadIntentId: input.intent.id,
          customerId: input.intent.project.customerId,
          projectId: input.intent.projectId,
          buildingId: input.intent.buildingId,
          installationUnitId: input.intent.installationUnitId,
          displayName: input.intent.displayName,
          dataClassification:
            input.intent.project.dataClassification,
          createdById: input.actor.userId,
        },
      });
    }

    const latest = await tx.fileVersion.aggregate({
      where: { fileId },
      _max: { versionNumber: true },
    });
    const versionNumber = (latest._max.versionNumber ?? 0) + 1;
    const createdVersion = await tx.fileVersion.create({
      data: {
        fileId,
        versionNumber,
        originalFilename: input.intent.originalFilename,
        sanitizedFilename: input.intent.sanitizedFilename,
        declaredMimeType: input.intent.declaredMimeType,
        detectedMimeType: input.detectedMimeType,
        sizeBytes: input.observed.sizeBytes,
        checksumSha256: input.observed.checksumSha256,
        storageKey: input.chain.canonicalKey,
        storageBackend: "OBJECT_STORE",
        storageObjectBindingId: input.chain.bindingId,
        uploadIntentId: input.intent.id,
        uploadAttemptId: input.chain.attemptId,
        creationOperationAttemptId: input.chain.operationId,
        uploadStatus: "UPLOADED",
        validationStatus: "PASSED",
        validationDetail: {
          signalMatches: true,
          sizeMatches: true,
          exactVersionReadback: true,
        },
        malwareScanStatus: "SCAN_UNAVAILABLE",
        malwareScanDetail: { scannerConfigured: false },
        integrityStatus: "VERIFIED",
        lastIntegrityVerifiedAt: now,
        uploadRequestKey: input.intent.requestKey,
        uploadedById: input.actor.userId,
        uploadExpiresAt: input.intent.expiresAt,
        finalizedAt: now,
      },
    });
    const extraction = await tx.fileExtraction.create({
      data: {
        fileVersionId: createdVersion.id,
        extractionVersion: 1,
        provider: "OBJECT_STORAGE",
        providerVersion: "CM1-R2",
        dataClassification:
          input.intent.project.dataClassification,
        status: "QUEUED",
        queuedAt: now,
      },
    });
    const pointer = await tx.file.updateMany({
      where: {
        id: fileId,
        currentVersionId:
          input.intent.expectedCurrentFileVersionId,
      },
      data: { currentVersionId: createdVersion.id },
    });
    if (pointer.count !== 1) {
      throw new AppError(
        "UPLOAD_CURRENT_VERSION_CONFLICT",
        "当前文件版本指针发生并发冲突。",
        409,
      );
    }
    const completedIntent = await tx.fileUploadIntent.updateMany({
      where: {
        id: input.intent.id,
        status: "UPLOADING",
        currentAttemptId: input.chain.attemptId,
        completedFileVersionId: null,
      },
      data: {
        status: "COMPLETED",
        currentAttemptId: null,
        completedAt: now,
        completedFileVersionId: createdVersion.id,
      },
    });
    if (completedIntent.count !== 1) {
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
        storageBackend: "OBJECT_STORE",
        providerVersionId: input.observed.providerVersionId,
        checksumSha256: input.observed.checksumSha256,
        sizeBytes: input.observed.sizeBytes.toString(),
      },
      requestId: input.requestId,
    });
    return {
      version: await tx.fileVersion.findUniqueOrThrow({
        where: { id: createdVersion.id },
      }),
      extractionId: extraction.id,
    };
  }, UPLOAD_TRANSACTION_OPTIONS);
}

async function readExactVerified(input: {
  adapter: ObjectStorageAdapter;
  chain: PreparedObjectChain;
  version: ObjectStorageVersionIdentity;
  signal: AbortSignal;
}) {
  assertVersionIdentity({
    version: input.version,
    provider: input.adapter.provider,
    objectKey: input.chain.canonicalKey,
    sizeBytes: input.chain.expectedSizeBytes,
    checksumSha256: input.chain.expectedChecksumSha256,
  });
  const readback = await input.adapter.readExact({
    version: input.version,
    expectedSizeBytes: input.chain.expectedSizeBytes,
    expectedChecksumSha256: input.chain.expectedChecksumSha256,
    maxBytes: MAX_FILE_SIZE_BYTES,
    signal: input.signal,
  });
  const actualChecksum = createHash("sha256")
    .update(readback.bytes)
    .digest("hex");
  if (
    readback.sizeBytes !== input.chain.expectedSizeBytes ||
    BigInt(readback.bytes.byteLength) !== input.chain.expectedSizeBytes ||
    readback.checksumSha256.toLowerCase() !==
      input.chain.expectedChecksumSha256.toLowerCase() ||
    actualChecksum !== input.chain.expectedChecksumSha256.toLowerCase()
  ) {
    throw new ObjectStorageError(
      "OBJECT_STORAGE_VERSION_MISMATCH",
      "Provider exact readback does not match the request snapshot.",
    );
  }
  return readback;
}

async function discoverObservedVersion(input: {
  adapter: ObjectStorageAdapter;
  chain: PreparedObjectChain;
  signal: AbortSignal;
}): Promise<ObservedVersion | null> {
  const discovered = await input.adapter.discoverExact({
    objectKey: input.chain.canonicalKey,
    idempotencyKey: input.chain.writeIdempotencyKey,
    expectedSizeBytes: input.chain.expectedSizeBytes,
    expectedChecksumSha256: input.chain.expectedChecksumSha256,
    maxBytes: MAX_FILE_SIZE_BYTES,
    signal: input.signal,
  });
  if (discovered.status === "NOT_FOUND") {
    return null;
  }
  assertVersionIdentity({
    version: discovered.version,
    provider: input.adapter.provider,
    objectKey: input.chain.canonicalKey,
    sizeBytes: discovered.sizeBytes,
    checksumSha256: discovered.checksumSha256,
  });
  await readExactVerified({
    adapter: input.adapter,
    chain: input.chain,
    version: discovered.version,
    signal: input.signal,
  });
  return {
    providerVersionId: discovered.version.providerVersionId,
    providerGeneration: discovered.version.providerGeneration,
    providerRequestId: discovered.requestId,
    sizeBytes: discovered.sizeBytes,
    checksumSha256: discovered.checksumSha256,
  };
}

async function completeFromObserved(input: {
  database: PrismaClient;
  actor: Actor;
  requestId: string;
  intent: Parameters<typeof finalizeObjectChain>[0]["intent"];
  chain: PreparedObjectChain;
  observed: ObservedVersion;
  lease: ObjectUploadLeaseController;
  adapter: ObjectStorageAdapter;
  buffered: BufferedUpload;
}) {
  await input.lease.assertHeld();
  const version: ObjectStorageVersionIdentity = {
    ...input.adapter.provider,
    objectKey: input.chain.canonicalKey,
    providerVersionId: input.observed.providerVersionId,
    providerGeneration: input.observed.providerGeneration,
  };
  const readback = await readExactVerified({
    adapter: input.adapter,
    chain: input.chain,
    version,
    signal: input.lease.signal,
  });
  const detected = await detectAllowedFileType(
    readback.bytes.subarray(0, 4100),
  );
  if (
    detected.mimeType !== input.intent.declaredMimeType ||
    detected.mimeType !== input.buffered.detectedMimeType ||
    !filenameMatchesMimeType(
      input.intent.sanitizedFilename,
      detected.mimeType,
    )
  ) {
    throw new ObjectStorageError(
      "OBJECT_STORAGE_CHECKSUM_MISMATCH",
      "Provider object content does not match the declared file type.",
    );
  }
  await input.lease.assertHeld();
  return finalizeObjectChain({
    database: input.database,
    actor: input.actor,
    requestId: input.requestId,
    intent: input.intent,
    chain: input.chain,
    observed: input.observed,
    detectedMimeType: detected.mimeType,
  });
}

async function dispatchAndFinalize(input: {
  database: PrismaClient;
  actor: Actor;
  requestId: string;
  intent: Parameters<typeof finalizeObjectChain>[0]["intent"];
  chain: PreparedObjectChain;
  adapter: ObjectStorageAdapter;
  buffered: BufferedUpload;
  leaseMs: number;
  leaseRenewIntervalMs: number;
}) {
  try {
    await advanceChainForDispatch({
      database: input.database,
      chain: input.chain,
      now: new Date(),
      leaseMs: input.leaseMs,
    });
  } catch (error) {
    await failBeforeDispatch({
      database: input.database,
      chain: input.chain,
      intentId: input.intent.id,
      code:
        error instanceof AppError
          ? error.code
          : "OBJECT_DISPATCH_FAILED",
    }).catch(() => undefined);
    throw error;
  }
  const lease = new ObjectUploadLeaseController({
    prisma: input.database,
    target: {
      attemptId: input.chain.attemptId,
      stagingLifecycleId: input.chain.stagingLifecycleId,
      canonicalLifecycleId: input.chain.canonicalLifecycleId,
      operationId: input.chain.operationId,
      ownerToken: input.chain.ownerToken,
      generation: input.chain.generation,
    },
    leaseMs: input.leaseMs,
    renewIntervalMs: input.leaseRenewIntervalMs,
  });
  lease.start();

  try {
    await lease.assertHeld();
    let write;
    try {
      write = await input.adapter.writeImmutable({
        objectKey: input.chain.canonicalKey,
        source: Readable.from([input.buffered.bytes]),
        expectedSizeBytes: input.chain.expectedSizeBytes,
        expectedChecksumSha256: input.chain.expectedChecksumSha256,
        idempotencyKey: input.chain.writeIdempotencyKey,
        signal: lease.signal,
      });
    } catch (writeError) {
      const discovered = await discoverObservedVersion({
        adapter: input.adapter,
        chain: input.chain,
        signal: lease.signal,
      });
      if (discovered) {
        await recordBindingObservation({
          database: input.database,
          chain: input.chain,
          observed: discovered,
        });
        return await completeFromObserved({
          database: input.database,
          actor: input.actor,
          requestId: input.requestId,
          intent: input.intent,
          chain: input.chain,
          observed: discovered,
          lease,
          adapter: input.adapter,
          buffered: input.buffered,
        });
      }
      throw writeError;
    }

    assertVersionIdentity({
      version: write.version,
      provider: input.adapter.provider,
      objectKey: input.chain.canonicalKey,
      sizeBytes: write.sizeBytes,
      checksumSha256: write.checksumSha256,
    });
    if (
      write.sizeBytes !== input.chain.expectedSizeBytes ||
      write.checksumSha256.toLowerCase() !==
        input.chain.expectedChecksumSha256.toLowerCase()
    ) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_VERSION_MISMATCH",
        "Provider write result does not match the upload snapshot.",
      );
    }

    await readExactVerified({
      adapter: input.adapter,
      chain: input.chain,
      version: write.version,
      signal: lease.signal,
    });
    const observed: ObservedVersion = {
      providerVersionId: write.version.providerVersionId,
      providerGeneration: write.version.providerGeneration,
      providerRequestId: write.requestId,
      sizeBytes: write.sizeBytes,
      checksumSha256: write.checksumSha256,
    };
    await recordBindingObservation({
      database: input.database,
      chain: input.chain,
      observed,
    });
    return await completeFromObserved({
      database: input.database,
      actor: input.actor,
      requestId: input.requestId,
      intent: input.intent,
      chain: input.chain,
      observed,
      lease,
      adapter: input.adapter,
      buffered: input.buffered,
    });
  } catch (error) {
    const completed = await input.database.fileUploadIntent
      .findUnique({
        where: { id: input.intent.id },
        select: { completedFileVersionId: true },
      })
      .catch(() => null);
    if (completed?.completedFileVersionId) {
      return loadCompletedUpload(input.database, completed);
    }
    if (!(error instanceof ObjectUploadLeaseLostError) && !lease.lost) {
      await setRecoveryRequired({
        database: input.database,
        chain: input.chain,
        code:
          error instanceof ObjectStorageError
            ? error.code
            : error instanceof AppError
              ? error.code
              : "OBJECT_UPLOAD_RECOVERY_REQUIRED",
      }).catch(() => undefined);
    }
    if (error instanceof ObjectStorageError) {
      throw mapStorageFailure(error);
    }
    throw error;
  } finally {
    await lease.stop();
  }
}

async function recoverObjectUpload(input: {
  database: PrismaClient;
  actor: Actor;
  requestId: string;
  intent: Parameters<typeof finalizeObjectChain>[0]["intent"] & {
    status: string;
    currentAttemptId: string | null;
    completedFileVersionId: string | null;
  };
  adapter: ObjectStorageAdapter;
  buffered: BufferedUpload;
  intentExpired: boolean;
  leaseMs: number;
  leaseRenewIntervalMs: number;
}) {
  const fileVersion = await input.database.fileVersion.findFirst({
    where: { uploadIntentId: input.intent.id },
    select: { id: true },
  });
  const loaded = await loadAttemptChain(input.database, input.intent);
  const decision = classifyObjectUploadRecovery({
    intentCompleted: Boolean(input.intent.completedFileVersionId),
    fileVersionExists: Boolean(fileVersion),
    intentStatus: input.intent.status,
    attemptStatus: loaded.attempt.status,
    operationState: loaded.operation.state,
    bindingState: loaded.binding.state,
    bindingObserved: Boolean(loaded.binding.writeObservedAt),
    leaseExpiresAt: loaded.operation.leaseExpiresAt,
    now: new Date(),
    discoverySupported:
      input.adapter.capabilities.exactWriteDiscovery === "SUPPORTED",
  });

  if (decision === "COMPLETED") {
    if (!input.intent.completedFileVersionId && fileVersion) {
      const version = await input.database.fileVersion.findUniqueOrThrow({
        where: { id: fileVersion.id },
      });
      const extraction =
        await input.database.fileExtraction.findFirstOrThrow({
          where: { fileVersionId: version.id },
          orderBy: { extractionVersion: "desc" },
          select: { id: true },
        });
      return { version, extractionId: extraction.id };
    }
    return loadCompletedUpload(input.database, input.intent);
  }
  if (decision === "WAIT_FOR_LEASE") {
    throw new AppError(
      "UPLOAD_RECOVERY_LEASE_ACTIVE",
      "原上传执行者仍持有租约。",
      409,
    );
  }
  if (decision === "FAIL_CLOSED") {
    throw new AppError(
      "UPLOAD_RECOVERY_FAIL_CLOSED",
      "上传状态无法安全自动恢复。",
      409,
    );
  }

  let chain: PreparedObjectChain = {
    attemptId: loaded.attempt.id,
    stagingLifecycleId: loaded.staging.id,
    canonicalLifecycleId: loaded.canonical.id,
    operationId: loaded.operation.id,
    bindingId: loaded.binding.id,
    stagingKey: loaded.staging.storageKey,
    canonicalKey: loaded.canonical.storageKey,
    ownerToken: loaded.canonical.ownerToken ?? "",
    generation: loaded.canonical.fencingGeneration,
    leaseExpiresAt:
      loaded.operation.leaseExpiresAt ?? new Date(0),
    expectedSizeBytes:
      loaded.operation.expectedSizeBytes ??
      BigInt(input.buffered.bytes.byteLength),
    expectedChecksumSha256:
      loaded.operation.expectedChecksumSha256 ??
      input.buffered.checksumSha256,
    writeIdempotencyKey: loaded.operation.writeIdempotencyKey ?? "",
  };
  if (
    !isValidObjectWriteIdempotencyKey({
      idempotencyKey: chain.writeIdempotencyKey,
      attemptId: chain.attemptId,
      operationId: chain.operationId,
    })
  ) {
    throw new AppError(
      "UPLOAD_RECOVERY_WRITE_IDENTITY_MISSING",
      "上传恢复缺少有效的持久化写入幂等身份。",
      409,
    );
  }
  if (
    chain.expectedSizeBytes !==
      BigInt(input.buffered.bytes.byteLength) ||
    chain.expectedChecksumSha256.toLowerCase() !==
      input.buffered.checksumSha256.toLowerCase()
  ) {
    throw new AppError(
      "UPLOAD_RECOVERY_CONTENT_MISMATCH",
      "恢复请求内容与持久化上传快照不一致。",
      409,
    );
  }
  chain = await takeoverAttemptChain({
    database: input.database,
    chain,
    loadedOperationLeaseExpiresAt: loaded.operation.leaseExpiresAt,
    now: new Date(),
    leaseMs: input.leaseMs,
  });

  if (decision === "RESUME_BEFORE_DISPATCH") {
    if (input.intentExpired) {
      await failBeforeDispatch({
        database: input.database,
        chain,
        intentId: input.intent.id,
        code: "UPLOAD_INTENT_EXPIRED_BEFORE_DISPATCH",
      });
      throw new AppError(
        "UPLOAD_INTENT_EXPIRED",
        "上传意图在 Provider 派发前已过期。",
        410,
      );
    }
    return dispatchAndFinalize({
      database: input.database,
      actor: input.actor,
      requestId: input.requestId,
      intent: input.intent,
      chain,
      adapter: input.adapter,
      buffered: input.buffered,
      leaseMs: input.leaseMs,
      leaseRenewIntervalMs: input.leaseRenewIntervalMs,
    });
  }

  await setRecoveryRequired({
    database: input.database,
    chain,
    code: "OBJECT_UPLOAD_RECOVERY_IN_PROGRESS",
  });
  const lease = new ObjectUploadLeaseController({
    prisma: input.database,
    target: {
      attemptId: chain.attemptId,
      stagingLifecycleId: chain.stagingLifecycleId,
      canonicalLifecycleId: chain.canonicalLifecycleId,
      operationId: chain.operationId,
      ownerToken: chain.ownerToken,
      generation: chain.generation,
    },
    leaseMs: input.leaseMs,
    renewIntervalMs: input.leaseRenewIntervalMs,
  });
  lease.start();
  try {
    await lease.assertHeld();
    let observed: ObservedVersion | null = null;
    if (loaded.binding.writeObservedAt) {
      if (
        !isValidObjectStorageVersionId(
          loaded.binding.providerVersionId,
        ) ||
        !loaded.binding.sizeBytes ||
        !loaded.binding.checksumSha256 ||
        loaded.binding.sizeBytes !== chain.expectedSizeBytes ||
        loaded.binding.checksumSha256.toLowerCase() !==
          chain.expectedChecksumSha256.toLowerCase()
      ) {
        throw new AppError(
          "UPLOAD_RECOVERY_OBSERVATION_INVALID",
          "持久化的对象版本观察不完整。",
          409,
        );
      }
      observed = {
        providerVersionId: loaded.binding.providerVersionId,
        providerGeneration: loaded.binding.providerGeneration,
        providerRequestId: loaded.binding.providerRequestId,
        sizeBytes: loaded.binding.sizeBytes,
        checksumSha256: loaded.binding.checksumSha256,
      };
    } else {
      observed = await discoverObservedVersion({
        adapter: input.adapter,
        chain,
        signal: lease.signal,
      });
      if (!observed) {
        await renewObjectUploadLease(
          input.database,
          chain,
          new Date(Date.now() + input.leaseMs),
        );
        throw new AppError(
          "UPLOAD_RECOVERY_VERSION_NOT_FOUND",
          "尚无法证明 Provider 已生成该上传的精确版本。",
          409,
        );
      }
      await recordBindingObservation({
        database: input.database,
        chain,
        observed,
      });
    }
    return await completeFromObserved({
      database: input.database,
      actor: input.actor,
      requestId: input.requestId,
      intent: input.intent,
      chain,
      observed,
      lease,
      adapter: input.adapter,
      buffered: input.buffered,
    });
  } catch (error) {
    if (error instanceof ObjectUploadLeaseLostError) {
      throw error;
    }
    await setRecoveryRequired({
      database: input.database,
      chain,
      code:
        error instanceof ObjectStorageError
          ? error.code
          : error instanceof AppError
            ? error.code
            : "OBJECT_UPLOAD_RECOVERY_REQUIRED",
    }).catch(() => undefined);
    if (error instanceof ObjectStorageError) {
      throw mapStorageFailure(error);
    }
    throw error;
  } finally {
    await lease.stop();
  }
}

export async function completeObjectUpload(
  input: CompleteObjectUploadInput,
): Promise<CompletedObjectUpload> {
  const database = input.database ?? prisma;
  const leaseMs = input.leaseMs ?? DEFAULT_LEASE_MS;
  const leaseRenewIntervalMs =
    input.leaseRenewIntervalMs ?? DEFAULT_RENEW_INTERVAL_MS;
  const nodeEnvironment =
    input.nodeEnvironment ?? process.env.NODE_ENV;
  if (
    !isObjectStorageAdapterAllowed(
      input.objectStorage.provider.providerKind,
      nodeEnvironment,
    )
  ) {
    throw new AppError(
      "OBJECT_STORAGE_ADAPTER_NOT_ALLOWED",
      "对象存储 Adapter 不允许在当前环境使用。",
      503,
    );
  }
  const intent = await findIntent(database, {
    intentId: input.intentId,
    projectId: input.projectId,
    actorId: input.actor.userId,
  });

  if (intent.status === "COMPLETED" && intent.completedFileVersionId) {
    return loadCompletedUpload(database, intent);
  }
  if (intent.status !== "PENDING" && intent.status !== "UPLOADING") {
    throw new AppError(
      "UPLOAD_INTENT_NOT_AVAILABLE",
      "上传意图已经终止。",
      409,
    );
  }
  if (
    intent.status === "PENDING" &&
    intent.expiresAt.getTime() <= Date.now()
  ) {
    throw new AppError("UPLOAD_INTENT_EXPIRED", "上传意图已过期。", 410);
  }
  if (
    input.requestContentLength === null ||
    !Number.isSafeInteger(input.requestContentLength) ||
    input.requestContentLength <= 0 ||
    BigInt(input.requestContentLength) !== intent.declaredSizeBytes ||
    BigInt(input.requestContentLength) > MAX_FILE_SIZE_BYTES
  ) {
    throw new AppError("CONTENT_LENGTH_MISMATCH", "上传大小不匹配。", 400);
  }
  if (
    !input.requestMimeType ||
    input.requestMimeType.toLowerCase() !==
      intent.declaredMimeType.toLowerCase()
  ) {
    throw new AppError("REQUEST_MIME_MISMATCH", "上传类型不匹配。", 415);
  }
  assertAdapterCapabilities(input.objectStorage);

  const buffered = await bufferUploadSource(
    input.source,
    intent.declaredSizeBytes,
  );
  if (
    buffered.detectedMimeType !== intent.declaredMimeType ||
    !filenameMatchesMimeType(
      intent.sanitizedFilename,
      buffered.detectedMimeType,
    )
  ) {
    throw new AppError(
      "FILE_SIGNATURE_MISMATCH",
      "文件实际类型或扩展名与声明不一致。",
      422,
    );
  }

  const intentForFinalize = {
    ...intent,
    status: intent.status,
    currentAttemptId: intent.currentAttemptId,
    completedFileVersionId: intent.completedFileVersionId,
  };

  if (intent.status === "UPLOADING") {
    return recoverObjectUpload({
      database,
      actor: input.actor,
      requestId: input.requestId,
      intent: intentForFinalize,
      adapter: input.objectStorage,
      buffered,
      intentExpired: intent.expiresAt.getTime() <= Date.now(),
      leaseMs,
      leaseRenewIntervalMs,
    });
  }
  if (!intent.stagingKey) {
    throw new AppError(
      "UPLOAD_STAGING_KEY_MISSING",
      "上传意图缺少 staging 身份。",
      409,
    );
  }

  const chain = await prepareObjectChain({
    database,
    intent,
    provider: input.objectStorage.provider,
    upload: buffered,
    now: new Date(),
    leaseMs,
  });
  try {
    return await dispatchAndFinalize({
      database,
      actor: input.actor,
      requestId: input.requestId,
      intent: intentForFinalize,
      chain,
      adapter: input.objectStorage,
      buffered,
      leaseMs,
      leaseRenewIntervalMs,
    });
  } catch (error) {
    if (error instanceof ObjectUploadLeaseLostError) {
      throw new AppError(
        "UPLOAD_RECOVERY_REQUIRED",
        "上传执行权已失效，必须等待受控恢复。",
        409,
      );
    }
    throw error;
  }
}
