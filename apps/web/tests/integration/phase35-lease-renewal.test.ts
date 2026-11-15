import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { LocalPrivateStorage } from "@elevator/file-storage";
import { PrismaClient } from "@prisma/client";
import type { PgBoss } from "pg-boss";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { runFileMaintenance } from "../../../worker/src/file-maintenance";
import { FileProcessingLeaseLostError } from "../../../worker/src/file-processing-lease";
import {
  processFileRecognitionJob,
  type FileProcessingDependencies,
} from "../../../worker/src/file-processing";
import {
  acquireMaintenanceLease,
  MaintenanceLeaseController,
} from "../../../worker/src/maintenance-lease";
import { readWorkerEnv } from "../../../worker/src/config";
import {
  parsePdfInWorker,
  PdfParserError,
} from "../../../worker/src/pdf-parser-client";
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
const workerStorage = createWorkerStorage(readWorkerEnv());
const pdfBytes = createTestPdf([
  "Lease renewal page one",
  "Lease renewal page two",
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

function fakeBoss(): PgBoss {
  return {
    send: vi.fn(async () => "job-id"),
    sendAfter: vi.fn(async () => "job-id"),
  } as unknown as PgBoss;
}

async function createOldOrphan(label: string) {
  const stagingKey = `staging/${label}-${randomUUID()}.part`;
  const objectKey = `objects/${label}-${randomUUID()}.pdf`;
  await storage.writeToStaging(
    stagingKey,
    Readable.from([Buffer.from("orphan")]),
    100n,
  );
  await storage.finalize(stagingKey, objectKey);
  const objectPath = path.join(
    process.env.PRIVATE_STORAGE_ROOT!,
    objectKey,
  );
  const old = new Date(Date.now() - 2 * 60 * 60_000);
  await fs.utimes(objectPath, old, old);
  return objectPath;
}

async function upload() {
  const filename = `lease-renewal-${randomUUID()}.pdf`;
  const intent = await createUploadIntent(
    actor,
    TEST_FIXTURE_IDS.project,
    randomUUID(),
    {
      displayName: filename,
      originalFilename: filename,
      declaredMimeType: "application/pdf",
      declaredSizeBytes: pdfBytes.byteLength,
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
    requestContentLength: pdfBytes.byteLength,
    requestMimeType: "application/pdf",
    source: Readable.from([pdfBytes]),
    requestId: `lease-renewal-${randomUUID()}`,
    storage,
  });
}

function processJob(uploaded: Awaited<ReturnType<typeof upload>>) {
  return {
    extractionId: uploaded.extractionId,
    fileVersionId: uploaded.version.id,
    requestedByUserId: actor.userId,
    trigger: "UPLOAD" as const,
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

it("renews maintenance leases beyond the initial window and blocks takeover", async () => {
  const orphanPath = await createOldOrphan("long-maintenance");
  const entered = deferred();
  const gate = deferred();
  const first = runFileMaintenance({
    prisma,
    boss: fakeBoss(),
    storage: workerStorage,
    env: readWorkerEnv(),
    leasePolicy: { leaseMs: 600, renewIntervalMs: 100 },
    testHooks: {
      afterLease: async () => {
        entered.resolve();
        await gate.promise;
      },
    },
  });

  await entered.promise;
  await new Promise((resolve) => setTimeout(resolve, 900));
  const second = await runFileMaintenance({
    prisma,
    boss: fakeBoss(),
    storage: workerStorage,
    env: readWorkerEnv(),
    leasePolicy: { leaseMs: 600, renewIntervalMs: 100 },
  });
  expect(second.skipped).toBe(true);
  expect(second.leaseLost).toBe(false);

  gate.resolve();
  const firstResult = await first;
  expect(firstResult.leaseLost).toBe(false);
  expect(firstResult.removedOrphanObjects).toBeGreaterThanOrEqual(1);
  await expect(fs.access(orphanPath)).rejects.toBeDefined();
});

it("stops an expired maintainer before cleanup and allows only the new owner to delete", async () => {
  const orphanPath = await createOldOrphan("expired-maintainer");
  const entered = deferred();
  const invalidated = deferred();
  const gate = deferred();
  let staleOwner = "";
  const stale = runFileMaintenance({
    prisma,
    boss: fakeBoss(),
    storage: workerStorage,
    env: readWorkerEnv(),
    leasePolicy: { leaseMs: 600, renewIntervalMs: 100 },
    testHooks: {
      afterLease: async () => {
        const row = await prisma.$queryRaw<
          Array<{ owner: string }>
        >`
          SELECT "value"->>'owner' AS "owner"
          FROM "system_metadata"
          WHERE "key" = 'file_maintenance_lease'
        `;
        staleOwner = row[0]?.owner ?? "";
        const expiredAt = new Date(Date.now() - 1_000);
        await prisma.$executeRaw`
          UPDATE "system_metadata"
          SET "value" = jsonb_set(
            "value",
            '{expiresAt}',
            to_jsonb(${expiredAt.toISOString()}::text)
          )
          WHERE "key" = 'file_maintenance_lease'
        `;
        invalidated.resolve();
        await gate.promise;
      },
    },
  });

  await invalidated.promise;
  await new Promise((resolve) => setTimeout(resolve, 250));
  const takeover = await runFileMaintenance({
    prisma,
    boss: fakeBoss(),
    storage: workerStorage,
    env: readWorkerEnv(),
    leasePolicy: { leaseMs: 600, renewIntervalMs: 100 },
  });
  expect(takeover.leaseLost).toBe(false);
  expect(takeover.removedOrphanObjects).toBeGreaterThanOrEqual(1);
  await expect(fs.access(orphanPath)).rejects.toBeDefined();

  gate.resolve();
  const staleResult = await stale;
  expect(staleResult.leaseLost).toBe(true);
  const ownerRows = await prisma.$queryRaw<
    Array<{ owner: string }>
  >`
    SELECT "value"->>'owner' AS "owner"
    FROM "system_metadata"
    WHERE "key" = 'file_maintenance_lease'
  `;
  expect(ownerRows[0]?.owner).not.toBe(staleOwner);
});

it("rejects renewal by an expired maintenance owner and fences release", async () => {
  const leaseMs = 600;
  const acquired = await acquireMaintenanceLease({
    prisma,
    leaseMs,
    now: new Date(),
  });
  expect(acquired).not.toBeNull();
  const oldOwner = new MaintenanceLeaseController({
    prisma,
    owner: acquired!.owner,
    leaseMs,
    renewIntervalMs: 100,
  });
  expect(await oldOwner.renew()).toBe(true);

  const expiredAt = new Date(Date.now() - 1_000);
  await prisma.$executeRaw`
    UPDATE "system_metadata"
    SET "value" = jsonb_set(
      "value",
      '{expiresAt}',
      to_jsonb(${expiredAt.toISOString()}::text)
    )
    WHERE "key" = 'file_maintenance_lease'
  `;
  expect(await oldOwner.renew()).toBe(false);

  const replacement = await acquireMaintenanceLease({
    prisma,
    leaseMs,
    now: new Date(),
  });
  expect(replacement).not.toBeNull();
  expect(replacement!.owner).not.toBe(acquired!.owner);
  await oldOwner.release();
  const current = await prisma.$queryRaw<
    Array<{ owner: string }>
  >`
    SELECT "value"->>'owner' AS "owner"
    FROM "system_metadata"
    WHERE "key" = 'file_maintenance_lease'
  `;
  expect(current[0]?.owner).toBe(replacement!.owner);
});

it("renews a file processing lease without consuming another attempt", async () => {
  const uploaded = await upload();
  const parserStarted = deferred();
  const dependencies: FileProcessingDependencies = {
    prisma,
    storage,
    leaseMs: 600,
    leaseRenewIntervalMs: 100,
    parsePdf: async (bytes, limits) => {
      parserStarted.resolve();
      await new Promise((resolve) => setTimeout(resolve, 900));
      return parsePdfInWorker(bytes, limits);
    },
  };
  const first = processFileRecognitionJob(
    processJob(uploaded),
    dependencies,
  );
  await parserStarted.promise;
  await new Promise((resolve) => setTimeout(resolve, 750));
  await expect(
    processFileRecognitionJob(processJob(uploaded), {
      prisma,
      storage,
    }),
  ).resolves.toBe("IGNORED");
  await expect(first).resolves.toBe("COMPLETED");

  const extraction = await prisma.fileExtraction.findUniqueOrThrow({
    where: { id: uploaded.extractionId },
  });
  expect(extraction.status).toBe("COMPLETED");
  expect(extraction.attempt).toBe(1);
  expect(extraction.processingToken).toBeNull();
});

it("aborts a processor that loses its lease before it can save results", async () => {
  const uploaded = await upload();
  const parserStarted = deferred();
  const dependencies: FileProcessingDependencies = {
    prisma,
    storage,
    leaseMs: 500,
    leaseRenewIntervalMs: 100,
    parsePdf: async (bytes, limits) =>
      new Promise((resolve, reject) => {
        parserStarted.resolve();
        limits.signal?.addEventListener(
          "abort",
          () => reject(limits.signal?.reason),
          { once: true },
        );
        void parsePdfInWorker(bytes, limits).then(resolve, reject);
      }),
  };
  const staleWorker = processFileRecognitionJob(
    processJob(uploaded),
    dependencies,
  );
  await parserStarted.promise;
  await prisma.fileExtraction.update({
    where: { id: uploaded.extractionId },
    data: { leaseExpiresAt: new Date(Date.now() - 1_000) },
  });

  await expect(staleWorker).rejects.toBeInstanceOf(
    FileProcessingLeaseLostError,
  );
  const lost = await prisma.fileExtraction.findUniqueOrThrow({
    where: { id: uploaded.extractionId },
  });
  expect(lost.status).toBe("PROCESSING");
  expect(lost.attempt).toBe(1);
  expect(lost.extractedText).toBeNull();

  await expect(
    processFileRecognitionJob(processJob(uploaded), {
      prisma,
      storage,
    }),
  ).resolves.toBe("COMPLETED");
  const recovered = await prisma.fileExtraction.findUniqueOrThrow({
    where: { id: uploaded.extractionId },
  });
  expect(recovered.attempt).toBe(2);
  expect(recovered.status).toBe("COMPLETED");
});

it("does not let expired workers release or fail a newer worker lease", async () => {
  const uploaded = await upload();
  const parserStarted = deferred();
  const parserGate = deferred();
  const stale = processFileRecognitionJob(processJob(uploaded), {
    prisma,
    storage,
    leaseMs: 500,
    leaseRenewIntervalMs: 100,
    parsePdf: async () => {
      parserStarted.resolve();
      await parserGate.promise;
      throw new PdfParserError("PDF_WORKER_CRASHED");
    },
  });
  await parserStarted.promise;
  await prisma.fileExtraction.update({
    where: { id: uploaded.extractionId },
    data: { leaseExpiresAt: new Date(Date.now() - 1_000) },
  });
  await new Promise((resolve) => setTimeout(resolve, 250));

  await expect(
    processFileRecognitionJob(processJob(uploaded), {
      prisma,
      storage,
    }),
  ).resolves.toBe("COMPLETED");
  parserGate.resolve();
  await expect(stale).rejects.toBeInstanceOf(
    FileProcessingLeaseLostError,
  );

  const extraction = await prisma.fileExtraction.findUniqueOrThrow({
    where: { id: uploaded.extractionId },
  });
  expect(extraction.status).toBe("COMPLETED");
  expect(extraction.attempt).toBe(2);
  expect(extraction.nextAttemptAt).toBeNull();
  expect(extraction.safeErrorCode).toBeNull();
});
