import { createHash, randomUUID } from "node:crypto";

import type { UploadIntentInput } from "@elevator/contracts";
import {
  detectAllowedFileType,
  filenameMatchesMimeType,
  isExplicitLocalObjectStorageEnvironment,
  LegacyStorageCleanupDisabledError,
  LocalPrivateStorage,
  type ObjectStorageAdapter,
  sanitizeDisplayFilename,
  PrivateStorageError,
  type StorageRuntimeCapability,
  type StorageUploadWriteCapability,
  type WrittenUpload,
} from "@elevator/file-storage";
import { Prisma, type PrismaClient } from "@prisma/client";
import { Readable } from "node:stream";

import type { Actor } from "@/modules/access/actor";
import { appendAuditLog } from "@/modules/audit/log";
import { AppError } from "@/server/http/errors";
import { enqueueFileRecognition } from "@/server/jobs/file-recognition-queue";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import { completeObjectUpload } from "./object-upload-service";
import { ObjectUploadLeaseController } from "./object-upload-lease";
import { makeStorageLifecycleId } from "./object-upload-protocol";

const MAX_FILE_SIZE_BYTES = 20n * 1024n * 1024n;
const UPLOAD_INTENT_TTL_MS = 30 * 60 * 1000;
const UPLOAD_TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
} as const;

interface UploadTarget {
  customerId: string;
  projectId: string;
  buildingId: string | null;
  installationUnitId: string | null;
  existingFileId: string | null;
  expectedCurrentFileVersionId: string | null;
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
  let expectedCurrentFileVersionId: string | null = null;

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
        currentVersionId: true,
        createdByUploadIntentId: true,
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
    if (existingFile.createdByUploadIntentId === null) {
      throw new AppError(
        "LEGACY_FILE_APPEND_FORBIDDEN",
        "该文件来源无法证明，不能追加新版本。",
        409,
      );
    }
    expectedCurrentFileVersionId = existingFile.currentVersionId;
  }

  return {
    customerId: project.customerId,
    projectId,
    buildingId,
    installationUnitId,
    existingFileId: input.existingFileId ?? null,
    expectedCurrentFileVersionId,
  };
}

export async function cleanupExpiredUploadIntents(
  _storage: StorageUploadWriteCapability,
): Promise<number> {
  throw new LegacyStorageCleanupDisabledError(
    "cleanupExpiredUploadIntents",
  );
}

export async function createUploadIntent(
  actor: Actor,
  projectId: string,
  requestKey: string,
  input: UploadIntentInput,
  _storage: StorageUploadWriteCapability,
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
        expectedCurrentFileVersionId:
          target.expectedCurrentFileVersionId,
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
  storage: StorageRuntimeCapability;
  objectStorage?: ObjectStorageAdapter;
  database?: PrismaClient;
  nodeEnvironment?: string;
  leaseMs?: number;
}

type UploadIntentWithProject = Prisma.FileUploadIntentGetPayload<{
  include: {
    project: {
      select: {
        customerId: true;
        dataClassification: true;
      };
    };
  };
}>;

async function markIntentFailed(
  database: PrismaClient,
  intentId: string,
  failureCode: string,
): Promise<void> {
  await database.fileUploadIntent.updateMany({
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

interface BufferedLocalUpload {
  bytes: Buffer;
  checksumSha256: string;
  headerBytes: Buffer;
  detectedMimeType: "application/pdf" | "image/jpeg" | "image/png";
}

async function bufferLocalSource(
  source: Readable,
  expectedSizeBytes: bigint,
): Promise<BufferedLocalUpload> {
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
    headerBytes: bytes.subarray(0, 4100),
    detectedMimeType: detected.mimeType,
  };
}

interface LocalPreparedChain {
  attemptId: string;
  stagingLifecycleId: string;
  canonicalLifecycleId: string;
  operationId: string;
  stagingKey: string;
  canonicalKey: string;
  ownerToken: string;
  closeAttestationId: string;
  generation: bigint;
  leaseExpiresAt: Date;
}

class LocalStagingLeaseController {
  readonly #database: PrismaClient;
  readonly #target: {
    stagingLifecycleId: string;
    ownerToken: string;
    generation: bigint;
  };
  readonly #leaseMs: number;
  readonly #renewIntervalMs: number;
  #timer: ReturnType<typeof setInterval> | undefined;
  #renewing: Promise<void> | undefined;
  #lost = false;

  constructor(input: {
    database: PrismaClient;
    target: {
      stagingLifecycleId: string;
      ownerToken: string;
      generation: bigint;
    };
    leaseMs: number;
  }) {
    this.#database = input.database;
    this.#target = input.target;
    this.#leaseMs = input.leaseMs;
    this.#renewIntervalMs = Math.max(
      1,
      Math.floor(input.leaseMs / 2),
    );
  }

  get lost(): boolean {
    return this.#lost;
  }

  start(): void {
    if (this.#timer) {
      return;
    }
    this.#timer = setInterval(() => {
      if (this.#renewing) {
        return;
      }
      this.#renewing = this.#renew()
        .catch(() => {
          this.#lost = true;
        })
        .finally(() => {
          this.#renewing = undefined;
        });
    }, this.#renewIntervalMs);
    this.#timer.unref?.();
  }

  async assertHeld(): Promise<void> {
    const row = await this.#database.storageObjectLifecycle.findFirst({
      where: {
        id: this.#target.stagingLifecycleId,
        ownerToken: this.#target.ownerToken,
        fencingGeneration: this.#target.generation,
        state: "STAGING",
        leaseExpiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!row || this.#lost) {
      this.#lost = true;
      throw new AppError(
        "UPLOAD_RECOVERY_LEASE_ACTIVE",
        "本地上传 staging 租约已丢失。",
        409,
      );
    }
  }

  async stop(): Promise<void> {
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = undefined;
    }
    await this.#renewing?.catch(() => undefined);
  }

  async #renew(): Promise<void> {
    await this.assertHeld();
    const updated = await this.#database.storageObjectLifecycle.updateMany({
      where: {
        id: this.#target.stagingLifecycleId,
        ownerToken: this.#target.ownerToken,
        fencingGeneration: this.#target.generation,
        state: "STAGING",
        leaseExpiresAt: { gt: new Date() },
      },
      data: {
        leaseExpiresAt: new Date(Date.now() + this.#leaseMs),
      },
    });
    if (updated.count !== 1) {
      throw new Error("LOCAL_STAGING_LEASE_LOST");
    }
  }
}

async function prepareLocalStagingChain(input: {
  database: PrismaClient;
  intent: {
    id: string;
    stagingKey: string;
    existingFileId: string | null;
    expectedCurrentFileVersionId: string | null;
    expiresAt: Date;
  };
  leaseMs: number;
}): Promise<LocalPreparedChain> {
  const attemptId = makeStorageLifecycleId();
  const stagingLifecycleId = makeStorageLifecycleId();
  const canonicalLifecycleId = makeStorageLifecycleId();
  const operationId = makeStorageLifecycleId();
  const canonicalKey = `objects/${randomUUID()}`;
  const ownerToken = randomUUID().replaceAll("-", "");
  const closeAttestationId = randomUUID();
  const generation = 1n;
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + input.leaseMs);

  try {
    await input.database.$transaction(async (tx) => {
      await tx.storageObjectLifecycle.create({
        data: {
          id: stagingLifecycleId,
          objectKind: "STAGING",
          storageBackend: "LEGACY_LOCAL",
          storageKey: input.intent.stagingKey,
          state: "STAGING_RESERVED",
          reservedAttemptId: attemptId,
          reservedIntentId: input.intent.id,
          fencingGeneration: 0n,
          lastTransitionAt: now,
        },
      });
      await tx.fileUploadAttempt.create({
        data: {
          id: attemptId,
          intentId: input.intent.id,
          stagingKey: input.intent.stagingKey,
          status: "RESERVED",
        },
      });
      const claimed = await tx.fileUploadIntent.updateMany({
        where: {
          id: input.intent.id,
          status: "PENDING",
          currentAttemptId: null,
          completedFileVersionId: null,
          expiresAt: { gt: now },
        },
        data: {
          status: "UPLOADING",
          currentAttemptId: attemptId,
          claimedAt: now,
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
          lastTransitionAt: now,
        },
      });
      await tx.fileUploadAttempt.update({
        where: { id: attemptId },
        data: { status: "WRITING" },
      });
    }, UPLOAD_TRANSACTION_OPTIONS);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        "UPLOAD_ALREADY_CLAIMED",
        "该文件已有进行中的上传。",
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
    stagingKey: input.intent.stagingKey,
    canonicalKey,
    ownerToken,
    closeAttestationId,
    generation,
    leaseExpiresAt,
  };
}

async function prepareLocalCanonicalChain(input: {
  database: PrismaClient;
  chain: LocalPreparedChain;
  intentId: string;
  written: {
    sizeBytes: bigint;
    checksumSha256: string;
    writerClosedAt: Date;
    closedIdentity: {
      dev: string;
      ino: string;
    } | null;
  };
}): Promise<void> {
  const now = new Date();
  const leaseExpiresAt = input.chain.leaseExpiresAt;
  if (!input.written.closedIdentity) {
    throw new AppError(
      "LOCAL_CLOSE_IDENTITY_UNAVAILABLE",
      "本地存储无法证明写句柄关闭后的文件身份。",
      503,
    );
  }
  const closedIdentity = input.written.closedIdentity;

  await input.database.$transaction(async (tx) => {
    const staging = await tx.storageObjectLifecycle.updateMany({
      where: {
        id: input.chain.stagingLifecycleId,
        ownerToken: input.chain.ownerToken,
        fencingGeneration: input.chain.generation,
        state: "STAGING",
        leaseExpiresAt: { gt: now },
      },
      data: {
        state: "STAGING_READY",
        sizeBytes: input.written.sizeBytes,
        checksumSha256: input.written.checksumSha256,
        writerClosedAt: input.written.writerClosedAt,
        closeAttestationId: input.chain.closeAttestationId,
        closedByAttemptId: input.chain.attemptId,
        closedOwnerToken: input.chain.ownerToken,
        closedGeneration: input.chain.generation,
        closedDev: closedIdentity.dev,
        closedIno: closedIdentity.ino,
        closedSizeBytes: input.written.sizeBytes,
        closedChecksumSha256: input.written.checksumSha256,
        closedIdentityVerified: true,
        lastTransitionAt: now,
      },
    });
    const ready = await tx.fileUploadAttempt.updateMany({
      where: {
        id: input.chain.attemptId,
        status: "WRITING",
      },
      data: { status: "READY" },
    });
    await tx.storageObjectLifecycle.create({
      data: {
        id: input.chain.canonicalLifecycleId,
        objectKind: "CANONICAL",
        storageBackend: "LEGACY_LOCAL",
        storageKey: input.chain.canonicalKey,
        state: "FINALIZING",
        ownerToken: input.chain.ownerToken,
        fencingGeneration: input.chain.generation,
        leaseExpiresAt,
        sizeBytes: input.written.sizeBytes,
        checksumSha256: input.written.checksumSha256,
        lastTransitionAt: now,
      },
    });
    await tx.storageObjectOperation.create({
      data: {
        id: input.chain.operationId,
        objectLifecycleId: input.chain.canonicalLifecycleId,
        storageKey: input.chain.canonicalKey,
        sourceAttemptId: input.chain.attemptId,
        operationType: "FINALIZE",
        state: "PREPARED",
        ownerToken: input.chain.ownerToken,
        fencingGeneration: input.chain.generation,
        leaseExpiresAt,
        sourcePath: input.chain.stagingKey,
        targetPath: input.chain.canonicalKey,
        expectedSizeBytes: input.written.sizeBytes,
        expectedChecksumSha256: input.written.checksumSha256,
      },
    });
    await tx.storageObjectLifecycle.update({
      where: { id: input.chain.canonicalLifecycleId },
      data: { currentOperationId: input.chain.operationId },
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
    const executing = await tx.storageObjectOperation.updateMany({
      where: {
        id: input.chain.operationId,
        ownerToken: input.chain.ownerToken,
        fencingGeneration: input.chain.generation,
        state: "PREPARED",
      },
      data: { state: "EXECUTING" },
    });
    if (
      staging.count !== 1 ||
      ready.count !== 1 ||
      finalizing.count !== 1 ||
      executing.count !== 1
    ) {
      throw new AppError(
        "UPLOAD_RECOVERY_TAKEOVER_CONFLICT",
        "本地上传 canonical 准备权已失效。",
        409,
      );
    }
  }, UPLOAD_TRANSACTION_OPTIONS);
}

async function loadLocalRecoveryChain(
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
      },
    },
  });
  const operation = attempt?.operations[0];
  if (
    !attempt ||
    !attempt.stagingLifecycle
  ) {
    throw new AppError(
      "UPLOAD_RECOVERY_CHAIN_INVALID",
      "本地上传恢复链不完整。",
      409,
    );
  }
  if (attempt.operations.length > 1) {
    throw new AppError(
      "UPLOAD_RECOVERY_CHAIN_INVALID",
      "本地上传恢复链包含多个 FINALIZE Operation。",
      409,
    );
  }
  if (
    (attempt.canonicalLifecycle && !operation) ||
    (!attempt.canonicalLifecycle && operation) ||
    attempt.stagingLifecycle.reservedAttemptId !== attempt.id ||
    attempt.stagingLifecycle.reservedIntentId !== intent.id ||
    attempt.stagingLifecycle.storageKey !== attempt.stagingKey ||
    (attempt.canonicalLifecycle !== null &&
      (attempt.canonicalStorageKey === null ||
        attempt.canonicalLifecycle.storageKey !==
          attempt.canonicalStorageKey ||
        operation?.objectLifecycleId !== attempt.canonicalLifecycle.id))
  ) {
    throw new AppError(
      "UPLOAD_RECOVERY_CHAIN_INVALID",
      "本地上传 canonical Lifecycle 与 Operation 不一致。",
      409,
    );
  }
  return {
    attempt,
    operation: operation ?? null,
    staging: attempt.stagingLifecycle,
    canonical: attempt.canonicalLifecycle ?? null,
  };
}

type LocalRecoveryChain = Awaited<ReturnType<typeof loadLocalRecoveryChain>>;

async function takeoverLocalStagingChain(input: {
  database: PrismaClient;
  chain: LocalRecoveryChain;
  leaseMs: number;
}): Promise<{
  ownerToken: string;
  generation: bigint;
  leaseExpiresAt: Date;
}> {
  const now = new Date();
  if (
    input.chain.staging.state !== "STAGING" ||
    !input.chain.staging.ownerToken ||
    !input.chain.staging.leaseExpiresAt ||
    input.chain.staging.leaseExpiresAt.getTime() > now.getTime()
  ) {
    throw new AppError(
      "UPLOAD_RECOVERY_LEASE_ACTIVE",
      "本地上传 staging 租约仍有效或状态不可接管。",
      409,
    );
  }
  const ownerToken = randomUUID().replaceAll("-", "");
  const generation = input.chain.staging.fencingGeneration + 1n;
  const leaseExpiresAt = new Date(now.getTime() + input.leaseMs);
  const updated = await input.database.storageObjectLifecycle.updateMany({
    where: {
      id: input.chain.staging.id,
      ownerToken: input.chain.staging.ownerToken,
      fencingGeneration: input.chain.staging.fencingGeneration,
      state: "STAGING",
      leaseExpiresAt: { lt: now },
    },
    data: {
      ownerToken,
      fencingGeneration: generation,
      leaseExpiresAt,
    },
  });
  if (updated.count !== 1) {
    throw new AppError(
      "UPLOAD_RECOVERY_TAKEOVER_CONFLICT",
      "另一个本地上传恢复者已接管 staging。",
      409,
    );
  }
  return { ownerToken, generation, leaseExpiresAt };
}

async function takeoverLocalCanonicalChain(input: {
  database: PrismaClient;
  chain: LocalRecoveryChain;
  leaseMs: number;
}): Promise<{
  ownerToken: string;
  generation: bigint;
  leaseExpiresAt: Date;
}> {
  const operation = input.chain.operation;
  const canonical = input.chain.canonical;
  if (
    !operation ||
    !canonical ||
    !operation.ownerToken ||
    !canonical.ownerToken ||
    !input.chain.staging.ownerToken ||
    operation.ownerToken !== canonical.ownerToken ||
    operation.fencingGeneration !== canonical.fencingGeneration ||
    input.chain.staging.ownerToken !== operation.ownerToken ||
    input.chain.staging.fencingGeneration !== operation.fencingGeneration ||
    !operation.leaseExpiresAt ||
    !canonical.leaseExpiresAt ||
    !input.chain.staging.leaseExpiresAt ||
    operation.leaseExpiresAt.getTime() !== canonical.leaseExpiresAt.getTime() ||
    operation.leaseExpiresAt.getTime() !==
      input.chain.staging.leaseExpiresAt.getTime() ||
    operation.leaseExpiresAt.getTime() > Date.now()
  ) {
    throw new AppError(
      "UPLOAD_RECOVERY_LEASE_ACTIVE",
      "本地上传 canonical 租约仍有效或链路不一致。",
      409,
    );
  }
  const now = new Date();
  const ownerToken = randomUUID().replaceAll("-", "");
  const generation = operation.fencingGeneration + 1n;
  const leaseExpiresAt = new Date(now.getTime() + input.leaseMs);
  const updatedOperation =
    await input.database.storageObjectOperation.updateMany({
      where: {
        id: operation.id,
        ownerToken: operation.ownerToken,
        fencingGeneration: operation.fencingGeneration,
        state: { in: ["EXECUTING", "UNKNOWN"] },
        leaseExpiresAt: { lt: now },
      },
      data: { ownerToken, fencingGeneration: generation, leaseExpiresAt },
    });
  const updatedCanonical =
    await input.database.storageObjectLifecycle.updateMany({
      where: {
        id: canonical.id,
        ownerToken: canonical.ownerToken,
        fencingGeneration: canonical.fencingGeneration,
        state: "FINALIZING",
        leaseExpiresAt: { lt: now },
      },
      data: { ownerToken, fencingGeneration: generation, leaseExpiresAt },
    });
  const updatedStaging =
    await input.database.storageObjectLifecycle.updateMany({
      where: {
        id: input.chain.staging.id,
        ownerToken: input.chain.staging.ownerToken,
        fencingGeneration: input.chain.staging.fencingGeneration,
        state: "STAGING_READY",
        leaseExpiresAt: { lt: now },
      },
      data: { ownerToken, fencingGeneration: generation, leaseExpiresAt },
    });
  if (
    updatedOperation.count !== 1 ||
    updatedCanonical.count !== 1 ||
    updatedStaging.count !== 1
  ) {
    throw new AppError(
      "UPLOAD_RECOVERY_TAKEOVER_CONFLICT",
      "另一个本地上传恢复者已接管 canonical。",
      409,
    );
  }
  return { ownerToken, generation, leaseExpiresAt };
}

async function ensureLocalStagingObject(input: {
  storage: StorageRuntimeCapability;
  chain: { stagingKey: string };
  source: BufferedLocalUpload;
  maxBytes: bigint;
}): Promise<WrittenUpload> {
  if (!(input.storage instanceof LocalPrivateStorage)) {
    throw new AppError(
      "LOCAL_STORAGE_CAPABILITY_UNVERIFIED",
      "本地恢复需要受支持的 LocalPrivateStorage。",
      503,
    );
  }
  try {
    const existing = await input.storage.verifyStagingForRecovery({
      stagingKey: input.chain.stagingKey,
      expectedSizeBytes: BigInt(input.source.bytes.byteLength),
      expectedChecksumSha256: input.source.checksumSha256,
      maxBytes: input.maxBytes,
    });
    return existing;
  } catch (error) {
    if (
      !(error instanceof PrivateStorageError) ||
      error.code !== "STORAGE_OBJECT_MISSING"
    ) {
      throw error;
    }
  }

  try {
    return await input.storage.writeToStaging(
      input.chain.stagingKey,
      Readable.from([input.source.bytes]),
      input.maxBytes,
    );
  } catch (error) {
    try {
      return await input.storage.verifyStagingForRecovery({
        stagingKey: input.chain.stagingKey,
        expectedSizeBytes: BigInt(input.source.bytes.byteLength),
        expectedChecksumSha256: input.source.checksumSha256,
        maxBytes: input.maxBytes,
      });
    } catch {
      throw error;
    }
  }
}

async function readVerifiedLocalObject(
  storage: StorageRuntimeCapability,
  objectKey: string,
  expectedSizeBytes: bigint,
  expectedChecksumSha256: string,
) {
  try {
    return await storage.readVerifiedObject({
      objectKey,
      expectedSizeBytes,
      expectedChecksumSha256: expectedChecksumSha256.toLowerCase(),
      maxBytes: MAX_FILE_SIZE_BYTES,
    });
  } catch (error) {
    if (error instanceof PrivateStorageError) {
      throw new AppError(
        "UPLOAD_RECOVERY_OBJECT_UNAVAILABLE",
        "无法读取已保留的本地对象。",
        409,
      );
    }
    throw error;
  }
}

async function detectLocalMime(
  intent: UploadIntentWithProject,
  bytes: Uint8Array,
): Promise<"application/pdf" | "image/jpeg" | "image/png"> {
  const detected = await detectAllowedFileType(bytes.subarray(0, 4100));
  if (
    detected.mimeType !== intent.declaredMimeType ||
    !filenameMatchesMimeType(
      intent.sanitizedFilename,
      detected.mimeType,
    )
  ) {
    throw new AppError(
      "UPLOAD_RECOVERY_CONTENT_MISMATCH",
      "恢复对象与上传意图不一致。",
      409,
    );
  }
  return detected.mimeType;
}

async function assertLocalContent(
  intent: UploadIntentWithProject,
  headerBytes: Uint8Array,
): Promise<"application/pdf" | "image/jpeg" | "image/png"> {
  return detectLocalMime(intent, headerBytes);
}

async function finalizeRecoveredLocalUpload(input: {
  database: PrismaClient;
  actor: Actor;
  requestId: string;
  intent: UploadIntentWithProject;
  chain: {
    attemptId: string;
    stagingLifecycleId: string;
    canonicalLifecycleId: string;
    operationId: string;
    stagingKey: string;
    canonicalKey: string;
    ownerToken: string;
    generation: bigint;
  };
  verified: {
    sizeBytes: bigint;
    checksumSha256: string;
  };
  detectedMimeType: string;
}) {
  return input.database.$transaction(async (tx) => {
    const now = new Date();
    const operation = await tx.storageObjectOperation.updateMany({
      where: {
        id: input.chain.operationId,
        operationType: "FINALIZE",
        ownerToken: input.chain.ownerToken,
        fencingGeneration: input.chain.generation,
        leaseExpiresAt: { gt: now },
        state: { in: ["EXECUTING", "UNKNOWN"] },
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
        leaseExpiresAt: { gt: now },
        state: "FINALIZING",
      },
      data: {
        state: "ACTIVE",
        leaseExpiresAt: null,
        lastTransitionAt: now,
      },
    });
    const staging = await tx.storageObjectLifecycle.updateMany({
      where: {
        id: input.chain.stagingLifecycleId,
        ownerToken: input.chain.ownerToken,
        fencingGeneration: input.chain.generation,
        leaseExpiresAt: { gt: now },
        state: "STAGING_READY",
        closedIdentityVerified: true,
      },
      data: {
        lastTransitionAt: now,
      },
    });
    const attempt = await tx.fileUploadAttempt.updateMany({
      where: {
        id: input.chain.attemptId,
        status: { in: ["FINALIZING", "RECOVERY_REQUIRED"] },
      },
      data: {
        status: "COMPLETED",
        completedAt: now,
      },
    });
    if (
      operation.count !== 1 ||
      canonical.count !== 1 ||
      staging.count !== 1 ||
      attempt.count !== 1
    ) {
      throw new AppError(
        "UPLOAD_FINALIZATION_FENCED",
        "本地上传终态化权已失效。",
        409,
      );
    }

    let fileId = input.intent.existingFileId;
    if (fileId) {
      const rows = await tx.$queryRaw<
        Array<{ currentVersionId: string | null }>
      >`
        SELECT "currentVersionId"
        FROM "file"
        WHERE "id" = ${fileId}
        FOR UPDATE
      `;
      if (
        !rows[0] ||
        rows[0].currentVersionId !==
          input.intent.expectedCurrentFileVersionId
      ) {
        throw new AppError(
          "UPLOAD_TARGET_CHANGED",
          "目标文件版本在恢复发布前发生变化。",
          409,
        );
      }
    } else {
      const created = await tx.file.create({
        data: {
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
      fileId = created.id;
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
        sizeBytes: input.verified.sizeBytes,
        checksumSha256: input.verified.checksumSha256,
        storageKey: input.chain.canonicalKey,
        storageBackend: "LEGACY_LOCAL",
        uploadIntentId: input.intent.id,
        uploadAttemptId: input.chain.attemptId,
        creationOperationAttemptId: input.chain.operationId,
        uploadStatus: "UPLOADED",
        validationStatus: "PASSED",
        validationDetail: {
          signalMatches: true,
          sizeMatches: true,
          recoveryVerified: true,
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
        provider: "LOCAL_FILE_PROCESSOR",
        providerVersion: "phase3.4-r2",
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
    const completed = await tx.fileUploadIntent.updateMany({
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
        checksumSha256: input.verified.checksumSha256,
        sizeBytes: input.verified.sizeBytes.toString(),
        detectedMimeType: input.detectedMimeType,
        recoveryVerified: true,
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

async function recoverLocalUpload(input: {
  database: PrismaClient;
  actor: Actor;
  requestId: string;
  intent: UploadIntentWithProject;
  storage: StorageRuntimeCapability;
  buffered: BufferedLocalUpload;
  leaseMs: number;
}) {
  const existingVersion = await input.database.fileVersion.findFirst({
    where: { uploadIntentId: input.intent.id },
    select: { id: true },
  });
  if (existingVersion) {
    const version = await input.database.fileVersion.findUniqueOrThrow({
      where: { id: existingVersion.id },
    });
    const extraction =
      await input.database.fileExtraction.findFirstOrThrow({
      where: { fileVersionId: version.id },
      orderBy: { extractionVersion: "desc" },
      select: { id: true },
    });
    return { version, extractionId: extraction.id };
  }

  let loaded = await loadLocalRecoveryChain(input.database, input.intent);
  if (loaded.canonical) {
    if (
      !loaded.operation ||
      !["FINALIZING", "RECOVERY_REQUIRED"].includes(
        loaded.attempt.status,
      ) ||
      !["EXECUTING", "UNKNOWN"].includes(loaded.operation.state) ||
      loaded.canonical.state !== "FINALIZING" ||
      !loaded.operation.expectedSizeBytes ||
      !loaded.operation.expectedChecksumSha256 ||
      loaded.operation.expectedSizeBytes !==
        BigInt(input.buffered.bytes.byteLength) ||
      loaded.operation.expectedChecksumSha256.toLowerCase() !==
        input.buffered.checksumSha256.toLowerCase()
    ) {
      throw new AppError(
        "UPLOAD_RECOVERY_FAIL_CLOSED",
        "本地上传 canonical 链与恢复请求不一致。",
        409,
      );
    }
    await claimLocalObjectKey({
      database: input.database,
      intent: input.intent,
      attemptId: loaded.attempt.id,
      objectKey: loaded.canonical.storageKey,
    });
    const takeover = await takeoverLocalCanonicalChain({
      database: input.database,
      chain: loaded,
      leaseMs: input.leaseMs,
    });
    const canonicalLease = new ObjectUploadLeaseController({
      prisma: input.database,
      target: {
        attemptId: loaded.attempt.id,
        stagingLifecycleId: loaded.staging.id,
        canonicalLifecycleId: loaded.canonical.id,
        operationId: loaded.operation.id,
        ownerToken: takeover.ownerToken,
        generation: takeover.generation,
      },
      leaseMs: input.leaseMs,
      renewIntervalMs: Math.max(1, Math.floor(input.leaseMs / 2)),
    });
    canonicalLease.start();
    try {
      await canonicalLease.assertHeld();
      await input.storage.finalize(
        loaded.staging.storageKey,
        loaded.canonical.storageKey,
        {
          sizeBytes: loaded.operation.expectedSizeBytes,
          checksumSha256: loaded.operation.expectedChecksumSha256,
        },
      );
      const verified = await readVerifiedLocalObject(
        input.storage,
        loaded.canonical.storageKey,
        loaded.operation.expectedSizeBytes,
        loaded.operation.expectedChecksumSha256,
      );
      const detected = await detectLocalMime(
        input.intent,
        verified.bytes,
      );
      await canonicalLease.assertHeld();
      return await finalizeRecoveredLocalUpload({
        database: input.database,
        actor: input.actor,
        requestId: input.requestId,
        intent: input.intent,
        chain: {
          attemptId: loaded.attempt.id,
          stagingLifecycleId: loaded.staging.id,
          canonicalLifecycleId: loaded.canonical.id,
          operationId: loaded.operation.id,
          stagingKey: loaded.staging.storageKey,
          canonicalKey: loaded.canonical.storageKey,
          ownerToken: takeover.ownerToken,
          generation: takeover.generation,
        },
        verified,
        detectedMimeType: detected,
      });
    } finally {
      await canonicalLease.stop();
    }
  }

  if (
    loaded.attempt.status !== "WRITING" ||
    loaded.staging.state !== "STAGING" ||
    loaded.staging.reservedAttemptId !== loaded.attempt.id ||
    loaded.staging.reservedIntentId !== input.intent.id ||
    loaded.attempt.canonicalStorageKey !== null
  ) {
    throw new AppError(
      "UPLOAD_RECOVERY_FAIL_CLOSED",
      "本地上传 pre-canonical 链不可安全接管。",
      409,
    );
  }
  if (input.intent.expiresAt.getTime() <= Date.now()) {
    const expiredChain: LocalPreparedChain = {
      attemptId: loaded.attempt.id,
      stagingLifecycleId: loaded.staging.id,
      canonicalLifecycleId: makeStorageLifecycleId(),
      operationId: makeStorageLifecycleId(),
      stagingKey: loaded.staging.storageKey,
      canonicalKey: `objects/${randomUUID()}`,
      ownerToken: loaded.staging.ownerToken ?? "",
      closeAttestationId: randomUUID(),
      generation: loaded.staging.fencingGeneration,
      leaseExpiresAt: new Date(0),
    };
    await failLocalStagingChain({
      database: input.database,
      chain: expiredChain,
      intentId: input.intent.id,
      code: "UPLOAD_INTENT_EXPIRED_BEFORE_CANONICAL",
    });
    throw new AppError(
      "UPLOAD_INTENT_EXPIRED",
      "上传意图在 canonical 准备前已过期。",
      410,
    );
  }
  const takeover = await takeoverLocalStagingChain({
    database: input.database,
    chain: loaded,
    leaseMs: input.leaseMs,
  });
  const stagingLease = new LocalStagingLeaseController({
    database: input.database,
    target: {
      stagingLifecycleId: loaded.staging.id,
      ownerToken: takeover.ownerToken,
      generation: takeover.generation,
    },
    leaseMs: input.leaseMs,
  });
  stagingLease.start();
  let written: WrittenUpload;
  try {
    await stagingLease.assertHeld();
    written = await ensureLocalStagingObject({
      storage: input.storage,
      chain: { stagingKey: loaded.staging.storageKey },
      source: input.buffered,
      maxBytes: MAX_FILE_SIZE_BYTES,
    });
    await stagingLease.assertHeld();
  } finally {
    await stagingLease.stop();
  }
  if (
    written.sizeBytes !== BigInt(input.buffered.bytes.byteLength) ||
    written.checksumSha256.toLowerCase() !==
      input.buffered.checksumSha256.toLowerCase()
  ) {
    throw new AppError(
      "UPLOAD_RECOVERY_CONTENT_MISMATCH",
      "恢复 staging 内容与请求快照不一致。",
      409,
    );
  }
  await assertLocalContent(input.intent, written.headerBytes);
  const chain: LocalPreparedChain = {
    attemptId: loaded.attempt.id,
    stagingLifecycleId: loaded.staging.id,
    canonicalLifecycleId: makeStorageLifecycleId(),
    operationId: makeStorageLifecycleId(),
    stagingKey: loaded.staging.storageKey,
    canonicalKey: `objects/${randomUUID()}`,
    ownerToken: takeover.ownerToken,
    closeAttestationId: randomUUID(),
    generation: takeover.generation,
    leaseExpiresAt: takeover.leaseExpiresAt,
  };
  chain.leaseExpiresAt = new Date(Date.now() + input.leaseMs);
  await prepareLocalCanonicalChain({
    database: input.database,
    chain,
    intentId: input.intent.id,
    written,
  });
  const canonicalLease = new ObjectUploadLeaseController({
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
    renewIntervalMs: Math.max(1, Math.floor(input.leaseMs / 2)),
  });
  canonicalLease.start();
  try {
    await canonicalLease.assertHeld();
    await input.storage.finalize(
      chain.stagingKey,
      chain.canonicalKey,
      {
        sizeBytes: written.sizeBytes,
        checksumSha256: written.checksumSha256,
      },
    );
    loaded = await loadLocalRecoveryChain(input.database, input.intent);
  if (
    !loaded.canonical ||
    !loaded.operation ||
    loaded.operation.expectedSizeBytes !==
      BigInt(input.buffered.bytes.byteLength) ||
    loaded.operation.expectedChecksumSha256?.toLowerCase() !==
      input.buffered.checksumSha256.toLowerCase()
  ) {
    throw new AppError(
      "UPLOAD_RECOVERY_COMMIT_UNKNOWN",
      "本次 canonical 准备的事务结果无法确认，已保留恢复证据。",
      409,
    );
  }
  await claimLocalObjectKey({
    database: input.database,
    intent: input.intent,
    attemptId: loaded.attempt.id,
    objectKey: loaded.canonical.storageKey,
  });
  const verified = await readVerifiedLocalObject(
    input.storage,
    loaded.canonical.storageKey,
    loaded.operation.expectedSizeBytes,
    loaded.operation.expectedChecksumSha256,
  );
  const detected = await detectLocalMime(input.intent, verified.bytes);
    return await finalizeRecoveredLocalUpload({
    database: input.database,
    actor: input.actor,
    requestId: input.requestId,
    intent: input.intent,
    chain: {
      attemptId: loaded.attempt.id,
      stagingLifecycleId: loaded.staging.id,
      canonicalLifecycleId: loaded.canonical.id,
      operationId: loaded.operation.id,
      stagingKey: loaded.staging.storageKey,
      canonicalKey: loaded.canonical.storageKey,
      ownerToken: loaded.canonical.ownerToken ?? "",
      generation: loaded.canonical.fencingGeneration,
    },
    verified,
    detectedMimeType: detected,
    });
  } finally {
    await canonicalLease.stop();
  }
}

async function failLocalStagingChain(input: {
  database: PrismaClient;
  chain: LocalPreparedChain;
  intentId: string;
  code: string;
}): Promise<void> {
  const now = new Date();
  await input.database.$transaction(async (tx) => {
    await tx.storageObjectLifecycle.updateMany({
      where: {
        id: input.chain.stagingLifecycleId,
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
        status: { in: ["PENDING", "UPLOADING"] },
        completedFileVersionId: null,
      },
      data: {
        status: "FAILED",
        currentAttemptId: null,
        failureCode: input.code,
      },
    });
  }, UPLOAD_TRANSACTION_OPTIONS);
}

async function loadCompletedLocalUpload(
  database: PrismaClient,
  intent: UploadIntentWithProject,
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

async function claimLocalObjectKey(input: {
  database: PrismaClient;
  intent: UploadIntentWithProject;
  attemptId: string;
  objectKey: string;
}): Promise<void> {
  const claimed = await input.database.fileUploadIntent.updateMany({
    where: {
      id: input.intent.id,
      status: "UPLOADING",
      currentAttemptId: input.attemptId,
      objectStorageKey: null,
    },
    data: { objectStorageKey: input.objectKey },
  });
  if (claimed.count === 1) {
    return;
  }
  const current = await input.database.fileUploadIntent.findUnique({
    where: { id: input.intent.id },
    select: { objectStorageKey: true, status: true },
  });
  if (
    current?.status === "UPLOADING" &&
    current.objectStorageKey === input.objectKey
  ) {
    return;
  }
  throw new AppError(
    "UPLOAD_OBJECT_KEY_CONFLICT",
    "上传对象状态发生并发冲突。",
    409,
  );
}

async function completeLocalP13Upload(input: {
  database: PrismaClient;
  actor: Actor;
  requestId: string;
  intent: UploadIntentWithProject;
  storage: LocalPrivateStorage;
  buffered: BufferedLocalUpload;
  leaseMs: number;
}): Promise<{
  version: Prisma.FileVersionGetPayload<Record<string, never>>;
  extractionId: string;
}> {
  if (input.intent.status !== "PENDING") {
    throw new AppError(
      "UPLOAD_INTENT_NOT_AVAILABLE",
      "上传意图不是可领取状态。",
      409,
    );
  }
  try {
    const chain = await prepareLocalStagingChain({
      database: input.database,
      intent: {
        id: input.intent.id,
        stagingKey: input.intent.stagingKey!,
        existingFileId: input.intent.existingFileId,
        expectedCurrentFileVersionId:
          input.intent.expectedCurrentFileVersionId,
        expiresAt: input.intent.expiresAt,
      },
      leaseMs: input.leaseMs,
    });
    const stagingLease = new LocalStagingLeaseController({
      database: input.database,
      target: {
        stagingLifecycleId: chain.stagingLifecycleId,
        ownerToken: chain.ownerToken,
        generation: chain.generation,
      },
      leaseMs: input.leaseMs,
    });
    stagingLease.start();
    let written: WrittenUpload;
    try {
      await stagingLease.assertHeld();
      written = await ensureLocalStagingObject({
        storage: input.storage,
        chain,
        source: input.buffered,
        maxBytes: MAX_FILE_SIZE_BYTES,
      });
      await stagingLease.assertHeld();
      chain.leaseExpiresAt = new Date(Date.now() + input.leaseMs);
      await prepareLocalCanonicalChain({
        database: input.database,
        chain,
        intentId: input.intent.id,
        written,
      });
    } finally {
      await stagingLease.stop();
    }
    if (
      written.sizeBytes !== input.intent.declaredSizeBytes ||
      written.checksumSha256.toLowerCase() !==
        input.buffered.checksumSha256.toLowerCase()
    ) {
      throw new AppError(
        "UPLOAD_SIZE_MISMATCH",
        "实际上传大小与声明大小不一致。",
        400,
      );
    }
    await assertLocalContent(input.intent, written.headerBytes);
    const canonicalLease = new ObjectUploadLeaseController({
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
      renewIntervalMs: Math.max(1, Math.floor(input.leaseMs / 2)),
    });
    canonicalLease.start();
    try {
      await canonicalLease.assertHeld();
      await input.storage.finalize(
        chain.stagingKey,
        chain.canonicalKey,
        {
          sizeBytes: written.sizeBytes,
          checksumSha256: written.checksumSha256,
        },
      );
      const preparedIntent = {
        ...input.intent,
        status: "UPLOADING",
        currentAttemptId: chain.attemptId,
      };
      const loaded = await loadLocalRecoveryChain(
        input.database,
        preparedIntent,
      );
    if (!loaded.canonical || !loaded.operation) {
      throw new AppError(
        "UPLOAD_RECOVERY_COMMIT_UNKNOWN",
        "canonical 准备结果无法确认。",
        409,
      );
    }
    await claimLocalObjectKey({
      database: input.database,
      intent: input.intent,
      attemptId: loaded.attempt.id,
      objectKey: loaded.canonical.storageKey,
    });
    const verified = await readVerifiedLocalObject(
      input.storage,
      loaded.canonical.storageKey,
      loaded.operation.expectedSizeBytes!,
      loaded.operation.expectedChecksumSha256!,
    );
    const detected = await detectLocalMime(
      input.intent,
      verified.bytes,
    );
    await canonicalLease.assertHeld();
    return await finalizeRecoveredLocalUpload({
      database: input.database,
      actor: input.actor,
      requestId: input.requestId,
      intent: input.intent,
      chain: {
        attemptId: loaded.attempt.id,
        stagingLifecycleId: loaded.staging.id,
        canonicalLifecycleId: loaded.canonical.id,
        operationId: loaded.operation.id,
        stagingKey: loaded.staging.storageKey,
        canonicalKey: loaded.canonical.storageKey,
        ownerToken: loaded.canonical.ownerToken ?? "",
        generation: loaded.canonical.fencingGeneration,
      },
      verified,
      detectedMimeType: detected,
    });
    } finally {
      await canonicalLease.stop();
    }
  } catch (error) {
    const fresh = await input.database.fileUploadIntent.findUnique({
      where: { id: input.intent.id },
      include: {
        project: {
          select: {
            customerId: true,
            dataClassification: true,
          },
        },
      },
    });
    if (fresh?.completedFileVersionId) {
      return loadCompletedLocalUpload(input.database, fresh);
    }
    if (fresh?.status === "UPLOADING" && fresh.stagingKey) {
      return recoverLocalUpload({
        database: input.database,
        actor: input.actor,
        requestId: input.requestId,
        intent: fresh,
        storage: input.storage,
        buffered: input.buffered,
        leaseMs: input.leaseMs,
      });
    }
    throw error;
  }
}

export async function completeUpload(
  input: CompleteUploadInput,
) {
  const database = input.database ?? prisma;
  const nodeEnvironment =
    input.nodeEnvironment ?? process.env.NODE_ENV;
  const leaseMs = input.leaseMs ?? 120_000;

  if (input.objectStorage) {
    const completed = await completeObjectUpload({
      actor: input.actor,
      projectId: input.projectId,
      intentId: input.intentId,
      requestContentLength: input.requestContentLength,
      requestMimeType: input.requestMimeType,
      source: input.source,
      requestId: input.requestId,
      objectStorage: input.objectStorage,
      database,
      nodeEnvironment,
      leaseMs,
    });

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
  }

  if (
    !isExplicitLocalObjectStorageEnvironment(nodeEnvironment)
  ) {
    throw new AppError(
      "OBJECT_STORAGE_REQUIRED",
      "当前环境必须使用已配置的精确对象存储绑定。",
      503,
    );
  }

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
    intent.uploadedById !== input.actor.userId
  ) {
    throw new AppError(
      "UPLOAD_INTENT_NOT_FOUND",
      "上传意图不存在。",
      404,
    );
  }

  if (intent.status === "COMPLETED" && intent.completedFileVersionId) {
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

  if (
    intent.status !== "PENDING" &&
    intent.status !== "UPLOADING"
  ) {
    throw new AppError(
      "UPLOAD_INTENT_NOT_AVAILABLE",
      "上传意图已过期、正在处理或已失败。",
      409,
    );
  }

  if (!intent.stagingKey) {
    throw new AppError(
      "UPLOAD_STAGING_KEY_MISSING",
      "上传意图缺少 staging 身份。",
      409,
    );
  }

  if (
    intent.status === "PENDING" &&
    intent.expiresAt.getTime() <= Date.now()
  ) {
    await markIntentFailed(database, intent.id, "UPLOAD_INTENT_EXPIRED");
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

  const localStorage =
    input.storage instanceof LocalPrivateStorage
      ? input.storage
      : null;
  if (localStorage) {
    const buffered = await bufferLocalSource(
      input.source,
      intent.declaredSizeBytes,
    );
    await assertLocalContent(intent, buffered.headerBytes);
    const completed =
      intent.status === "UPLOADING"
        ? await recoverLocalUpload({
            database,
            actor: input.actor,
            requestId: input.requestId,
            intent,
            storage: localStorage,
            buffered,
            leaseMs,
          })
        : await completeLocalP13Upload({
            database,
            actor: input.actor,
            requestId: input.requestId,
            intent,
            storage: localStorage,
            buffered,
            leaseMs,
          });
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
  }

  if (intent.status === "UPLOADING") {
    throw new AppError(
      "UPLOAD_RECOVERY_REQUIRED",
      "该上传需要对象存储恢复。",
      409,
    );
  }

  const claimed = await database.fileUploadIntent.updateMany({
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

  const legacyChain = {
    attemptId: makeStorageLifecycleId(),
    stagingLifecycleId: makeStorageLifecycleId(),
    canonicalLifecycleId: makeStorageLifecycleId(),
    operationId: makeStorageLifecycleId(),
    stagingKey: intent.stagingKey,
    canonicalKey: `objects/${randomUUID()}`,
    ownerToken: randomUUID().replaceAll("-", ""),
    closeAttestationId: randomUUID(),
    generation: 1n,
    leaseExpiresAt: new Date(),
  };
  let objectKey: string | null = legacyChain.canonicalKey;

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

    objectKey = legacyChain.canonicalKey;
    const objectClaimed = await database.fileUploadIntent.updateMany({
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

    await input.storage.finalize(intent.stagingKey, objectKey, {
      sizeBytes: written.sizeBytes,
      checksumSha256: written.checksumSha256,
    });
    const completed = await database.$transaction(
      async (tx) => {
        let fileId = intent.existingFileId;

        if (!fileId) {
          const createdFile = await tx.file.create({
            data: {
              createdByUploadIntentId: intent.id,
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

        const fileRows = await tx.$queryRaw<
          Array<{ currentVersionId: string | null }>
        >`
          SELECT "currentVersionId"
          FROM "file"
          WHERE "id" = ${fileId}
          FOR UPDATE
        `;
        if (
          !fileRows[0] ||
          fileRows[0].currentVersionId !==
            intent.expectedCurrentFileVersionId
        ) {
          throw new AppError(
            "UPLOAD_TARGET_CHANGED",
            "目标文件版本在发布前发生变化。",
            409,
          );
        }

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
            storageBackend: "LEGACY_LOCAL",
            uploadIntentId: intent.id,
            uploadAttemptId: legacyChain.attemptId,
            creationOperationAttemptId: legacyChain.operationId,
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

        const pointer = await tx.file.updateMany({
          where: {
            id: fileId,
            currentVersionId: intent.expectedCurrentFileVersionId,
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

        const completed = await tx.fileUploadIntent.updateMany({
          where: {
            id: intent.id,
            status: "UPLOADING",
            currentAttemptId: legacyChain.attemptId,
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
      UPLOAD_TRANSACTION_OPTIONS,
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
    const code =
      error instanceof AppError
        ? error.code
        : error instanceof PrivateStorageError
          ? error.code
          : "UPLOAD_FAILED";
    await markIntentFailed(database, intent.id, code).catch(() => undefined);

    logger.error(
      {
        event: "file.upload_failed_artifacts_retained",
        intentId: intent.id,
        requestId: input.requestId,
        canonicalObjectFinalized: objectKey !== null,
        recoveryRequired: true,
      },
      "File upload failed; physical artifacts were retained",
    );

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
