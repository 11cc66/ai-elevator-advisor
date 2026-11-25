import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import {
  FILE_RECOGNITION_QUEUE,
  type FileRecognitionJob,
} from "@elevator/contracts";
import { LocalPrivateStorage } from "@elevator/file-storage";
import { PrismaClient } from "@prisma/client";
import type { PgBoss } from "pg-boss";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { runFileMaintenance } from "../../../worker/src/file-maintenance";
import { processFileRecognitionJob } from "../../../worker/src/file-processing";
import { readWorkerEnv } from "../../../worker/src/config";
import { loadActor, type Actor } from "../../src/modules/access/actor";
import {
  completeUpload,
  createUploadIntent,
} from "../../src/modules/files/upload-service";
import { createTestPdf } from "../fixtures/test-pdf";
import { TEST_FIXTURE_IDS } from "../../scripts/test-db/seed";

const prisma = new PrismaClient();
const storage = new LocalPrivateStorage(
  process.env.PRIVATE_STORAGE_ROOT!,
);
const pdfBytes = createTestPdf(["Worker page one", "Worker page two"]);
const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
let actor: Actor;

async function upload(
  bytes: Buffer,
  filename: string,
  mimeType: string,
) {
  const intent = await createUploadIntent(
    actor,
    TEST_FIXTURE_IDS.project,
    randomUUID(),
    {
      displayName: filename,
      originalFilename: filename,
      declaredMimeType: mimeType as
        | "application/pdf"
        | "image/png"
        | "image/jpeg",
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
    requestId: `phase34-${randomUUID()}`,
    storage,
  });
}

function jobFor(
  extractionId: string,
  fileVersionId: string,
): FileRecognitionJob {
  return {
    extractionId,
    fileVersionId,
    requestedByUserId: actor.userId,
    trigger: "UPLOAD",
  };
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

it("processes multi-page PDF and image metadata without duplicating history", async () => {
  const pdfUpload = await upload(
    pdfBytes,
    "worker-pages.pdf",
    "application/pdf",
  );
  const pdfJob = jobFor(
    pdfUpload.extractionId,
    pdfUpload.version.id,
  );

  expect(
    await processFileRecognitionJob(pdfJob),
  ).toBe("COMPLETED");
  const pdfExtraction = await prisma.fileExtraction.findUniqueOrThrow({
    where: { id: pdfUpload.extractionId },
    include: {
      textBlocks: { orderBy: [{ pageNumber: "asc" }, { blockIndex: "asc" }] },
    },
  });

  expect(pdfExtraction.pageCount).toBe(2);
  expect(pdfExtraction.status).toBe("COMPLETED");
  expect(pdfExtraction.textBlocks.map((block) => block.pageNumber)).toEqual([
    1, 2,
  ]);
  expect(pdfExtraction.textBlocks[0]?.text).toContain("Worker page one");
  expect(pdfExtraction.textBlocks[1]?.text).toContain("Worker page two");
  expect(pdfExtraction.textBlocks[0]?.positionData).toBeTruthy();

  const blockCount = pdfExtraction.textBlocks.length;
  expect(await processFileRecognitionJob(pdfJob)).toBe("IGNORED");
  expect(
    await processFileRecognitionJob(pdfJob),
  ).toBe("IGNORED");
  expect(
    await prisma.extractionTextBlock.count({
      where: { extractionId: pdfExtraction.id },
    }),
  ).toBe(blockCount);

  const storedVersion = await prisma.fileVersion.findUniqueOrThrow({
    where: { id: pdfUpload.version.id },
  });
  const objectBytes = await fs.readFile(
    path.join(process.env.PRIVATE_STORAGE_ROOT!, storedVersion.storageKey),
  );
  expect(createHash("sha256").update(objectBytes).digest("hex")).toBe(
    storedVersion.checksumSha256,
  );

  const imageUpload = await upload(
    pngBytes,
    "worker-image.png",
    "image/png",
  );
  expect(
    await processFileRecognitionJob(
      jobFor(imageUpload.extractionId, imageUpload.version.id),
    ),
  ).toBe("COMPLETED");
  const imageExtraction = await prisma.fileExtraction.findUniqueOrThrow({
    where: { id: imageUpload.extractionId },
    include: { textBlocks: true },
  });

  expect(imageExtraction.providerMetadata).toMatchObject({
    width: 1,
    height: 1,
    format: "png",
  });
  expect(imageExtraction.textBlocks).toHaveLength(0);
  expect(imageExtraction.pageCount).toBeNull();
});

it("does not let an older extraction overwrite a newer recognition state", async () => {
  const uploaded = await upload(
    pdfBytes,
    "older-job.pdf",
    "application/pdf",
  );
  await prisma.fileExtraction.create({
    data: {
      fileVersionId: uploaded.version.id,
      extractionVersion: 2,
      provider: "LOCAL_FILE_PROCESSOR",
      providerVersion: "phase3.4-test",
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

  expect(
    await processFileRecognitionJob(
      jobFor(uploaded.extractionId, uploaded.version.id),
    ),
  ).toBe("COMPLETED");
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

it("recovers stale processing jobs without executing legacy physical cleanup", async () => {
  const completed = await upload(
    pdfBytes,
    "maintenance.pdf",
    "application/pdf",
  );
  expect(
    await processFileRecognitionJob(
      jobFor(completed.extractionId, completed.version.id),
    ),
  ).toBe("COMPLETED");

  const stale = await upload(
    pdfBytes,
    "stale-processing.pdf",
    "application/pdf",
  );
  await prisma.fileExtraction.create({
    data: {
      fileVersionId: stale.version.id,
      extractionVersion: 2,
      provider: "LOCAL_FILE_PROCESSOR",
      providerVersion: "phase3.4-test",
      dataClassification: "DEMO_MOCK",
      status: "COMPLETED",
      extractedText: "DEMO_MOCK newer maintenance state",
      completedAt: new Date(),
    },
  });
  await prisma.fileExtraction.update({
    where: { id: stale.extractionId },
    data: {
      status: "PROCESSING",
      startedAt: new Date(Date.now() - 10 * 60_000),
      processingToken: randomUUID(),
      leaseExpiresAt: new Date(Date.now() - 60_000),
    },
  });
  await prisma.fileVersion.update({
    where: { id: stale.version.id },
    data: { recognitionStatus: "COMPLETED" },
  });

  const stagingKey = `staging/maintenance-${randomUUID()}.part`;
  await storage.writeToStaging(
    stagingKey,
    Readable.from([Buffer.from("abandoned")]),
    100n,
  );
  const expiredIntent = await prisma.fileUploadIntent.create({
    data: {
      requestKey: randomUUID(),
      requestFingerprint: "c".repeat(64),
      uploadedById: actor.userId,
      projectId: TEST_FIXTURE_IDS.project,
      buildingId: TEST_FIXTURE_IDS.building,
      installationUnitId: TEST_FIXTURE_IDS.installationUnit,
      displayName: "expired.pdf",
      originalFilename: "expired.pdf",
      sanitizedFilename: "expired.pdf",
      declaredMimeType: "application/pdf",
      declaredSizeBytes: 9n,
      stagingKey,
      expiresAt: new Date(Date.now() - 60_000),
    },
  });
  const orphanStagingKey = `staging/orphan-${randomUUID()}.part`;
  const orphanObjectKey = `objects/orphan-${randomUUID()}.pdf`;
  await storage.writeToStaging(
    orphanStagingKey,
    Readable.from([Buffer.from("orphan")]),
    100n,
  );
  await storage.finalize(orphanStagingKey, orphanObjectKey);
  const orphanObjectPath = path.join(
    process.env.PRIVATE_STORAGE_ROOT!,
    orphanObjectKey,
  );
  await fs.utimes(
    orphanObjectPath,
    new Date(Date.now() - 2 * 60 * 60_000),
    new Date(Date.now() - 2 * 60 * 60_000),
  );
  const oldTempDirectory = path.join(
    process.env.PRIVATE_STORAGE_ROOT!,
    "temp",
    "stale-worker-entry",
  );
  await fs.mkdir(oldTempDirectory, { recursive: true });
  await fs.writeFile(path.join(oldTempDirectory, "partial"), "temp");
  await fs.utimes(
    oldTempDirectory,
    new Date(Date.now() - 2 * 60 * 60_000),
    new Date(Date.now() - 2 * 60 * 60_000),
  );

  const sent: FileRecognitionJob[] = [];
  const fakeBoss = {
    send: vi.fn(async (_queue: string, job: FileRecognitionJob) => {
      sent.push(job);
      return "job-id";
    }),
  } as unknown as PgBoss;
  const result = await runFileMaintenance({
    prisma,
    boss: fakeBoss,
    env: readWorkerEnv(),
  });

  expect(result.recoveredProcessing).toBeGreaterThanOrEqual(1);
  expect(
    sent.some((job) => job.extractionId === stale.extractionId),
  ).toBe(true);
  expect(
    (
      await prisma.fileExtraction.findUniqueOrThrow({
        where: { id: stale.extractionId },
        select: { status: true },
      })
    ).status,
  ).toBe("QUEUED");
  expect(
    (
      await prisma.fileVersion.findUniqueOrThrow({
        where: { id: stale.version.id },
        select: { recognitionStatus: true },
      })
    ).recognitionStatus,
  ).toBe("COMPLETED");
  expect(
    (
      await prisma.fileUploadIntent.findUniqueOrThrow({
        where: { id: expiredIntent.id },
        select: { status: true },
      })
    ).status,
  ).toBe("PENDING");
  await expect(fs.access(orphanObjectPath)).resolves.toBeUndefined();
  await expect(fs.access(oldTempDirectory)).resolves.toBeUndefined();

  const completedVersion = await prisma.fileVersion.findUniqueOrThrow({
    where: { id: completed.version.id },
  });
  await expect(
    fs.access(
      path.join(
        process.env.PRIVATE_STORAGE_ROOT!,
        completedVersion.storageKey,
      ),
    ),
  ).resolves.toBeUndefined();
  expect(FILE_RECOGNITION_QUEUE).toBe("file-recognition");
});
