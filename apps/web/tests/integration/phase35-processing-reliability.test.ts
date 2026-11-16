import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import {
  buildFileProcessingRetryOptions,
  FILE_RECOGNITION_QUEUE,
  fileRecognitionJobSchema,
  type FileRecognitionJob,
} from "@elevator/contracts";
import { LocalPrivateStorage } from "@elevator/file-storage";
import { PrismaClient } from "@prisma/client";
import { PgBoss } from "pg-boss";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { runFileMaintenance } from "../../../worker/src/file-maintenance";
import {
  FileProcessingRetryError,
  SimulatedWorkerCrashError,
} from "../../../worker/src/file-processing-errors";
import { FileProcessingLeaseLostError } from "../../../worker/src/file-processing-lease";
import {
  processFileRecognitionJob,
  type FileProcessingDependencies,
  type ProcessingCheckpoint,
} from "../../../worker/src/file-processing";
import {
  parsePdfInWorker,
  PdfParserError,
} from "../../../worker/src/pdf-parser-client";
import { readWorkerEnv } from "../../../worker/src/config";
import { createWorkerStorage } from "../../../worker/src/storage";
import { loadActor, type Actor } from "../../src/modules/access/actor";
import {
  completeUpload,
  createUploadIntent,
} from "../../src/modules/files/upload-service";
import { TEST_FIXTURE_IDS } from "../../scripts/test-db/seed";
import { createTestPdf } from "../fixtures/test-pdf";

const prisma = new PrismaClient();
const storage = new LocalPrivateStorage(
  process.env.PRIVATE_STORAGE_ROOT!,
);
const validPdf = createTestPdf([
  "Reliable first page",
  "Reliable second page",
]);
let actor: Actor;

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

async function upload(
  bytes: Buffer,
  filename: string,
  mimeType: "application/pdf" | "image/png" | "image/jpeg" =
    "application/pdf",
) {
  const intent = await createUploadIntent(
    actor,
    TEST_FIXTURE_IDS.project,
    randomUUID(),
    {
      displayName: filename,
      originalFilename: filename,
      declaredMimeType: mimeType,
      declaredSizeBytes: bytes.byteLength,
      buildingId: TEST_FIXTURE_IDS.building,
      installationUnitId: TEST_FIXTURE_IDS.installationUnit,
      existingFileId: undefined,
    },
    storage,
  );
  return completeUpload({
    actor,
    projectId: TEST_FIXTURE_IDS.project,
    intentId: intent.id,
    requestContentLength: bytes.byteLength,
    requestMimeType: mimeType,
    source: Readable.from([bytes]),
    requestId: `phase35-${randomUUID()}`,
    storage,
  });
}

function jobFor(input: {
  extractionId: string;
  versionId: string;
}): FileRecognitionJob {
  return {
    extractionId: input.extractionId,
    fileVersionId: input.versionId,
    requestedByUserId: actor.userId,
    trigger: "UPLOAD",
  };
}

function parsePdf(
  bytes: Uint8Array,
  limits: Parameters<typeof parsePdfInWorker>[1],
) {
  return parsePdfInWorker(bytes, limits);
}

async function auditCount(
  fileVersionId: string,
  action: string,
): Promise<number> {
  return prisma.auditLog.count({
    where: {
      objectType: "FileVersion",
      objectId: fileVersionId,
      action,
    },
  });
}

async function waitForExtractionStatus(
  extractionId: string,
  expected: "COMPLETED" | "FAILED",
): Promise<void> {
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    const extraction = await prisma.fileExtraction.findUniqueOrThrow({
      where: { id: extractionId },
      select: { status: true },
    });
    if (extraction.status === expected) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`EXTRACTION_STATUS_TIMEOUT:${extractionId}`);
}

beforeAll(async () => {
  const username = process.env.TEST_ADMIN_USERNAME?.toLowerCase();
  const admin = await prisma.user.findUniqueOrThrow({
    where: { username },
    select: { id: true },
  });
  actor = await loadActor(admin.id);
});

afterAll(async () => {
  await prisma.$disconnect();
});

it("allows only one concurrent worker to claim the same extraction", async () => {
  const uploaded = await upload(validPdf, "concurrent-claim.pdf");
  const parserStarted = deferred();
  const parserGate = deferred();
  let parserCalls = 0;
  const dependencies: FileProcessingDependencies = {
    prisma,
    storage,
    parsePdf: async (bytes, limits) => {
      parserCalls += 1;
      parserStarted.resolve();
      await parserGate.promise;
      return parsePdf(bytes, limits);
    },
  };

  const first = processFileRecognitionJob(
    jobFor({
      extractionId: uploaded.extractionId,
      versionId: uploaded.version.id,
    }),
    dependencies,
  );
  await parserStarted.promise;
  const second = processFileRecognitionJob(
    jobFor({
      extractionId: uploaded.extractionId,
      versionId: uploaded.version.id,
    }),
    dependencies,
  );

  await expect(second).resolves.toBe("IGNORED");
  parserGate.resolve();
  await expect(first).resolves.toBe("COMPLETED");

  const extraction = await prisma.fileExtraction.findUniqueOrThrow({
    where: { id: uploaded.extractionId },
    include: { textBlocks: true },
  });
  expect(parserCalls).toBe(1);
  expect(extraction.attempt).toBe(1);
  expect(extraction.textBlocks).toHaveLength(2);
  expect(
    await auditCount(uploaded.version.id, "file.extraction.completed"),
  ).toBe(1);
});

it("prevents a stale worker from overwriting the newer lease owner", async () => {
  const uploaded = await upload(validPdf, "stale-token.pdf");
  const parserStarted = deferred();
  const parserGate = deferred();
  let parserCalls = 0;
  const staleDependencies: FileProcessingDependencies = {
    prisma,
    storage,
    parsePdf: async (bytes, limits) => {
      parserCalls += 1;
      if (parserCalls === 1) {
        parserStarted.resolve();
        await parserGate.promise;
      }
      return parsePdf(bytes, limits);
    },
  };

  const staleWorker = processFileRecognitionJob(
    jobFor({
      extractionId: uploaded.extractionId,
      versionId: uploaded.version.id,
    }),
    staleDependencies,
  );
  await parserStarted.promise;
  await prisma.fileExtraction.update({
    where: { id: uploaded.extractionId },
    data: { leaseExpiresAt: new Date(Date.now() - 1_000) },
  });

  await expect(
    processFileRecognitionJob(
      jobFor({
        extractionId: uploaded.extractionId,
        versionId: uploaded.version.id,
      }),
      { prisma, storage },
    ),
  ).resolves.toBe("COMPLETED");

  parserGate.resolve();
  await expect(staleWorker).rejects.toBeInstanceOf(
    FileProcessingLeaseLostError,
  );
  const extraction = await prisma.fileExtraction.findUniqueOrThrow({
    where: { id: uploaded.extractionId },
    include: { textBlocks: true },
  });
  expect(extraction.attempt).toBe(2);
  expect(extraction.status).toBe("COMPLETED");
  expect(extraction.textBlocks).toHaveLength(2);
  expect(
    await auditCount(uploaded.version.id, "file.extraction.completed"),
  ).toBe(1);
});

it("keeps newer Extraction state when an older task finishes concurrently", async () => {
  const uploaded = await upload(validPdf, "older-concurrent.pdf");
  const parserStarted = deferred();
  const parserGate = deferred();
  const worker = processFileRecognitionJob(
    jobFor({
      extractionId: uploaded.extractionId,
      versionId: uploaded.version.id,
    }),
    {
      prisma,
      storage,
      parsePdf: async (bytes, limits) => {
        parserStarted.resolve();
        await parserGate.promise;
        return parsePdf(bytes, limits);
      },
    },
  );

  await parserStarted.promise;
  await prisma.fileExtraction.create({
    data: {
      fileVersionId: uploaded.version.id,
      extractionVersion: 2,
      provider: "LOCAL_FILE_PROCESSOR",
      providerVersion: "phase3.5-test",
      dataClassification: "DEMO_MOCK",
      status: "FAILED",
      safeErrorCode: "NEWER_EXTRACTION_FAILED",
      safeErrorMessage: "DEMO_MOCK newer extraction state",
      completedAt: new Date(),
    },
  });
  await prisma.fileVersion.update({
    where: { id: uploaded.version.id },
    data: { recognitionStatus: "FAILED" },
  });

  parserGate.resolve();
  await expect(worker).resolves.toBe("COMPLETED");

  expect(
    (
      await prisma.fileVersion.findUniqueOrThrow({
        where: { id: uploaded.version.id },
        select: { recognitionStatus: true },
      })
    ).recognitionStatus,
  ).toBe("FAILED");
  expect(
    (
      await prisma.fileExtraction.findUniqueOrThrow({
        where: { id: uploaded.extractionId },
        select: { status: true },
      })
    ).status,
  ).toBe("COMPLETED");
});

it("releases transient failures for bounded retry and records each attempt", async () => {
  const uploaded = await upload(validPdf, "transient-retry.pdf");
  let failuresRemaining = 1;
  const dependencies: FileProcessingDependencies = {
    prisma,
    storage,
    parsePdf: async (bytes, limits) => {
      if (failuresRemaining > 0) {
        failuresRemaining -= 1;
        throw new PdfParserError("PDF_WORKER_CRASHED");
      }
      return parsePdf(bytes, limits);
    },
  };
  const job = jobFor({
    extractionId: uploaded.extractionId,
    versionId: uploaded.version.id,
  });

  await expect(
    processFileRecognitionJob(job, dependencies),
  ).rejects.toBeInstanceOf(FileProcessingRetryError);
  const retryState = await prisma.fileExtraction.findUniqueOrThrow({
    where: { id: uploaded.extractionId },
  });
  expect(retryState.status).toBe("QUEUED");
  expect(retryState.attempt).toBe(1);
  expect(retryState.processingToken).toBeNull();
  expect(retryState.leaseExpiresAt).toBeNull();
  expect(retryState.nextAttemptAt).not.toBeNull();
  expect(retryState.safeErrorCode).toBe("PDF_WORKER_CRASHED");

  await expect(
    processFileRecognitionJob(job, dependencies),
  ).resolves.toBe("COMPLETED");
  const completed = await prisma.fileExtraction.findUniqueOrThrow({
    where: { id: uploaded.extractionId },
  });
  expect(completed.status).toBe("COMPLETED");
  expect(completed.attempt).toBe(2);
  expect(completed.safeErrorCode).toBeNull();
  expect(
    await auditCount(
      uploaded.version.id,
      "file.extraction.retry_scheduled",
    ),
  ).toBe(1);
  expect(
    await auditCount(uploaded.version.id, "file.extraction.completed"),
  ).toBe(1);
});

it("retries transient failures through a real pg-boss queue", async () => {
  const uploaded = await upload(validPdf, "real-queue-retry.pdf");
  const job = jobFor({
    extractionId: uploaded.extractionId,
    versionId: uploaded.version.id,
  });
  let failuresRemaining = 1;
  const retryOptions = buildFileProcessingRetryOptions({
    maxAttempts: 3,
    retryDelaySeconds: 1,
    retryDelayMaxSeconds: 1,
    jobExpireSeconds: 30,
  });
  const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL!,
    application_name: "phase35-reliability-test",
    max: 2,
  });

  try {
    await boss.start({ attempts: 2 });
    await boss.createQueue(FILE_RECOGNITION_QUEUE, retryOptions);
    await boss.work(
      FILE_RECOGNITION_QUEUE,
      { batchSize: 1, pollingIntervalSeconds: 0.5 },
      async (jobs) => {
        for (const queuedJob of jobs) {
          const parsed = fileRecognitionJobSchema.parse(queuedJob.data);
          await processFileRecognitionJob(parsed, {
            prisma,
            storage,
            jobId: queuedJob.id,
            parsePdf: async (bytes, limits) => {
              if (failuresRemaining > 0) {
                failuresRemaining -= 1;
                throw new PdfParserError("PDF_WORKER_CRASHED");
              }
              return parsePdf(bytes, limits);
            },
          });
        }
        return { processed: jobs.length };
      },
    );
    await boss.send(FILE_RECOGNITION_QUEUE, job, {
      singletonKey: job.extractionId,
      ...retryOptions,
    });

    await waitForExtractionStatus(
      uploaded.extractionId,
      "COMPLETED",
    );
  } finally {
    await boss.stop({ graceful: true, timeout: 10_000 });
  }

  const extraction = await prisma.fileExtraction.findUniqueOrThrow({
    where: { id: uploaded.extractionId },
  });
  expect(extraction.attempt).toBe(2);
  expect(extraction.safeErrorCode).toBeNull();
  expect(
    await auditCount(
      uploaded.version.id,
      "file.extraction.retry_scheduled",
    ),
  ).toBe(1);
}, 15_000);

it("does not retry a permanently damaged PDF", async () => {
  const damaged = Buffer.from("%PDF-1.7\nthis is not a valid PDF body");
  const uploaded = await upload(damaged, "permanently-damaged.pdf");

  await expect(
    processFileRecognitionJob(
      jobFor({
        extractionId: uploaded.extractionId,
        versionId: uploaded.version.id,
      }),
      { prisma, storage },
    ),
  ).resolves.toBe("FAILED");
  const extraction = await prisma.fileExtraction.findUniqueOrThrow({
    where: { id: uploaded.extractionId },
  });
  expect(extraction.status).toBe("FAILED");
  expect(extraction.attempt).toBe(1);
  expect(extraction.nextAttemptAt).toBeNull();
  expect(extraction.safeErrorCode).toBe("PDF_PARSE_FAILED");
  expect(
    await auditCount(uploaded.version.id, "file.extraction.failed"),
  ).toBe(1);
});

it("stops after the configured maximum number of attempts", async () => {
  const uploaded = await upload(validPdf, "retry-limit.pdf");
  const dependencies: FileProcessingDependencies = {
    prisma,
    storage,
    parsePdf: async () => {
      throw new PdfParserError("PDF_WORKER_CRASHED");
    },
  };
  const job = jobFor({
    extractionId: uploaded.extractionId,
    versionId: uploaded.version.id,
  });

  await expect(
    processFileRecognitionJob(job, dependencies),
  ).rejects.toBeInstanceOf(FileProcessingRetryError);
  await expect(
    processFileRecognitionJob(job, dependencies),
  ).rejects.toBeInstanceOf(FileProcessingRetryError);
  await expect(
    processFileRecognitionJob(job, dependencies),
  ).resolves.toBe("FAILED");

  const extraction = await prisma.fileExtraction.findUniqueOrThrow({
    where: { id: uploaded.extractionId },
  });
  expect(extraction.status).toBe("FAILED");
  expect(extraction.attempt).toBe(3);
  expect(extraction.processingToken).toBeNull();
  expect(extraction.leaseExpiresAt).toBeNull();
  expect(extraction.nextAttemptAt).toBeNull();
  expect(extraction.safeErrorCode).toBe("PDF_WORKER_CRASHED");
  expect(
    await auditCount(
      uploaded.version.id,
      "file.extraction.retry_scheduled",
    ),
  ).toBe(2);
  expect(
    await auditCount(
      uploaded.version.id,
      "file.extraction.retry_exhausted",
    ),
  ).toBe(1);
});

it("recovers worker crashes at each processing phase", async () => {
  const cases: Array<{
    label: string;
    dependencies?: FileProcessingDependencies;
    checkpoint?: ProcessingCheckpoint;
    crashesAfterCommit?: boolean;
  }> = [
    {
      label: "before read",
      checkpoint: "AFTER_CLAIM",
    },
    {
      label: "during read",
      dependencies: {
        readObject: async () => {
          throw new SimulatedWorkerCrashError("DURING_READ");
        },
      },
    },
    {
      label: "during PDF parsing",
      dependencies: {
        parsePdf: async () => {
          throw new SimulatedWorkerCrashError("DURING_PDF_PARSE");
        },
      },
    },
    {
      label: "before database commit",
      checkpoint: "BEFORE_COMMIT",
    },
    {
      label: "after database commit before queue acknowledgement",
      checkpoint: "AFTER_COMMIT",
      crashesAfterCommit: true,
    },
  ];

  for (const crashCase of cases) {
    const uploaded = await upload(
      validPdf,
      `crash-${randomUUID()}.pdf`,
    );
    const job = jobFor({
      extractionId: uploaded.extractionId,
      versionId: uploaded.version.id,
    });

    await expect(
      processFileRecognitionJob(job, {
        prisma,
        storage,
        ...crashCase.dependencies,
        checkpoint: async (checkpoint) => {
          if (checkpoint === crashCase.checkpoint) {
            throw new SimulatedWorkerCrashError(checkpoint);
          }
        },
      }),
    ).rejects.toBeInstanceOf(SimulatedWorkerCrashError);

    const crashed = await prisma.fileExtraction.findUniqueOrThrow({
      where: { id: uploaded.extractionId },
    });

    if (crashCase.crashesAfterCommit) {
      expect(crashed.status, crashCase.label).toBe("COMPLETED");
      expect(crashed.processingToken, crashCase.label).toBeNull();
      await expect(
        processFileRecognitionJob(job, { prisma, storage }),
      ).resolves.toBe("IGNORED");
      expect(
        (
          await prisma.fileExtraction.findUniqueOrThrow({
            where: { id: uploaded.extractionId },
          })
        ).attempt,
        crashCase.label,
      ).toBe(1);
      continue;
    }

    expect(crashed.status, crashCase.label).toBe("PROCESSING");
    expect(crashed.processingToken, crashCase.label).not.toBeNull();
    await prisma.fileExtraction.update({
      where: { id: uploaded.extractionId },
      data: { leaseExpiresAt: new Date(Date.now() - 1_000) },
    });
    await expect(
      processFileRecognitionJob(job, { prisma, storage }),
    ).resolves.toBe("COMPLETED");
    expect(
      (
        await prisma.fileExtraction.findUniqueOrThrow({
          where: { id: uploaded.extractionId },
          select: { attempt: true },
        })
      ).attempt,
      crashCase.label,
    ).toBe(2);
  }
}, 15_000);

it("rechecks malware policy when recovering an expired task", async () => {
  const uploaded = await upload(validPdf, "recovered-scan-policy.pdf");
  const token = randomUUID();
  await prisma.fileExtraction.update({
    where: { id: uploaded.extractionId },
    data: {
      status: "PROCESSING",
      attempt: 1,
      processingToken: token,
      leaseExpiresAt: new Date(Date.now() - 1_000),
      startedAt: new Date(Date.now() - 120_000),
    },
  });
  await prisma.fileVersion.update({
    where: { id: uploaded.version.id },
    data: { recognitionStatus: "PROCESSING" },
  });
  const previousMode = process.env.FILE_ACCESS_MODE;
  process.env.FILE_ACCESS_MODE = "enforce";

  try {
    await expect(
      processFileRecognitionJob(
        jobFor({
          extractionId: uploaded.extractionId,
          versionId: uploaded.version.id,
        }),
        { prisma, storage },
      ),
    ).resolves.toBe("BLOCKED");
  } finally {
    process.env.FILE_ACCESS_MODE = previousMode;
  }

  const extraction = await prisma.fileExtraction.findUniqueOrThrow({
    where: { id: uploaded.extractionId },
  });
  const version = await prisma.fileVersion.findUniqueOrThrow({
    where: { id: uploaded.version.id },
  });
  expect(extraction.status).toBe("FAILED");
  expect(extraction.safeErrorCode).toBe("MALWARE_SCAN_REQUIRED");
  expect(version.malwareScanStatus).toBe("SCAN_UNAVAILABLE");
  expect(version.recognitionStatus).toBe("BLOCKED");
});

it("serializes maintenance and preserves objects referenced by active files", async () => {
  const active = await upload(validPdf, "active-maintenance.pdf");
  const orphanStagingKey = `staging/maintenance-lock-${randomUUID()}.part`;
  const orphanObjectKey = `objects/maintenance-lock-${randomUUID()}.pdf`;
  await storage.writeToStaging(
    orphanStagingKey,
    Readable.from([Buffer.from("orphan")]),
    100n,
  );
  await storage.finalize(orphanStagingKey, orphanObjectKey);
  const orphanPath = path.join(
    process.env.PRIVATE_STORAGE_ROOT!,
    orphanObjectKey,
  );
  await fs.utimes(
    orphanPath,
    new Date(Date.now() - 2 * 60 * 60_000),
    new Date(Date.now() - 2 * 60 * 60_000),
  );

  const entered = deferred();
  const gate = deferred();
  const fakeBoss = {
    send: vi.fn(async () => "job-id"),
    sendAfter: vi.fn(async () => "job-id"),
  } as unknown as PgBoss;
  const workerStorage = createWorkerStorage(readWorkerEnv());
  const first = runFileMaintenance({
    prisma,
    boss: fakeBoss,
    storage: workerStorage,
    env: readWorkerEnv(),
    testHooks: {
      afterLease: async () => {
        entered.resolve();
        await gate.promise;
      },
    },
  });
  await entered.promise;

  await expect(
    runFileMaintenance({
      prisma,
      boss: fakeBoss,
      storage: workerStorage,
      env: readWorkerEnv(),
    }),
  ).resolves.toMatchObject({ skipped: true });

  gate.resolve();
  const result = await first;
  expect(result.skipped).toBe(false);
  expect(result.removedOrphanObjects).toBeGreaterThanOrEqual(1);
  expect(result.cleanupFailures).toBe(0);
  await expect(fs.access(orphanPath)).rejects.toBeDefined();

  const activeVersion = await prisma.fileVersion.findUniqueOrThrow({
    where: { id: active.version.id },
  });
  await expect(
    fs.access(
      path.join(
        process.env.PRIVATE_STORAGE_ROOT!,
        activeVersion.storageKey,
      ),
    ),
  ).resolves.toBeUndefined();
  expect(
    (
      await prisma.fileExtraction.findUniqueOrThrow({
        where: { id: active.extractionId },
        select: { status: true },
      })
    ).status,
  ).toBe("QUEUED");
  expect(FILE_RECOGNITION_QUEUE).toBe("file-recognition");
});

it("enforces lease fields in the database", async () => {
  const uploaded = await upload(validPdf, "lease-constraint.pdf");
  const extraction = await prisma.fileExtraction.findUniqueOrThrow({
    where: { id: uploaded.extractionId },
  });
  expect(extraction.attempt).toBe(0);
  expect(extraction.processingToken).toBeNull();

  await expect(
    prisma.fileExtraction.update({
      where: { id: uploaded.extractionId },
      data: { status: "PROCESSING" },
    }),
  ).rejects.toBeDefined();
});
