import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { LocalPrivateStorage } from "@elevator/file-storage";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, expect, it } from "vitest";

import { loadActor, type Actor } from "../../src/modules/access/actor";
import {
  cleanupExpiredUploadIntents,
  completeUpload,
  createUploadIntent,
} from "../../src/modules/files/upload-service";
import { TEST_FIXTURE_IDS } from "../../scripts/test-db/seed";

const prisma = new PrismaClient();
const storage = new LocalPrivateStorage(
  process.env.PRIVATE_STORAGE_ROOT!,
);
const PDF_BYTES = Buffer.from(
  "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
);

let actor: Actor;

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

it("completes a streamed upload into immutable private storage", async () => {
  const intent = await createUploadIntent(
    actor,
    TEST_FIXTURE_IDS.project,
    randomUUID(),
    {
      displayName: "DEMO integration.pdf",
      originalFilename: "integration.pdf",
      declaredMimeType: "application/pdf",
      declaredSizeBytes: PDF_BYTES.byteLength,
      buildingId: TEST_FIXTURE_IDS.building,
      installationUnitId: TEST_FIXTURE_IDS.installationUnit,
      existingFileId: undefined,
    },
    storage,
  );
  const version = await completeUpload({
    actor,
    projectId: TEST_FIXTURE_IDS.project,
    intentId: intent.id,
    requestContentLength: PDF_BYTES.byteLength,
    requestMimeType: "application/pdf",
    source: Readable.from([PDF_BYTES]),
    requestId: "phase32-integration",
    storage,
  });

  expect(version.checksumSha256).toBe(
    createHash("sha256").update(PDF_BYTES).digest("hex"),
  );
  expect(version.uploadStatus).toBe("UPLOADED");
  expect(version.validationStatus).toBe("PASSED");
  expect(version.malwareScanStatus).toBe("SCAN_UNAVAILABLE");
  expect(version.integrityStatus).toBe("VERIFIED");
  const integrity = await storage.verifyObjectChecksum(
    version.storageKey,
    version.checksumSha256,
  );
  expect(integrity.valid).toBe(true);
});

it("cleans staging files for expired upload intents", async () => {
  const stagingKey = `staging/expired-${randomUUID()}.part`;
  await storage.writeToStaging(
    stagingKey,
    Readable.from([Buffer.from("abandoned")]),
    100n,
  );
  const intent = await prisma.fileUploadIntent.create({
    data: {
      requestKey: randomUUID(),
      requestFingerprint: "a".repeat(64),
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
      expiresAt: new Date(Date.now() - 1_000),
    },
  });

  const cleaned = await cleanupExpiredUploadIntents(storage);
  expect(cleaned).toBeGreaterThan(0);

  const expired = await prisma.fileUploadIntent.findUniqueOrThrow({
    where: { id: intent.id },
  });
  expect(expired.status).toBe("EXPIRED");
  await expect(
    fs.access(
      path.join(process.env.PRIVATE_STORAGE_ROOT!, stagingKey),
    ),
  ).rejects.toBeDefined();
});

it("cleans an orphan object after an interrupted completion", async () => {
  const stagingKey = `staging/interrupted-${randomUUID()}.part`;
  const objectKey = `objects/interrupted-${randomUUID()}.bin`;
  await storage.writeToStaging(
    stagingKey,
    Readable.from([Buffer.from("interrupted")]),
    100n,
  );
  await storage.finalize(stagingKey, objectKey);

  const intent = await prisma.fileUploadIntent.create({
    data: {
      requestKey: randomUUID(),
      requestFingerprint: "b".repeat(64),
      uploadedById: actor.userId,
      projectId: TEST_FIXTURE_IDS.project,
      buildingId: TEST_FIXTURE_IDS.building,
      installationUnitId: TEST_FIXTURE_IDS.installationUnit,
      displayName: "interrupted.pdf",
      originalFilename: "interrupted.pdf",
      sanitizedFilename: "interrupted.pdf",
      declaredMimeType: "application/pdf",
      declaredSizeBytes: 11n,
      stagingKey,
      objectStorageKey: objectKey,
      status: "UPLOADING",
      claimedAt: new Date(Date.now() - 20 * 60 * 1000),
      expiresAt: new Date(Date.now() + 60_000),
    },
  });

  await expect(
    fs.access(
      path.join(process.env.PRIVATE_STORAGE_ROOT!, objectKey),
    ),
  ).resolves.toBeUndefined();

  await cleanupExpiredUploadIntents(storage);

  const expired = await prisma.fileUploadIntent.findUniqueOrThrow({
    where: { id: intent.id },
  });
  expect(expired.status).toBe("EXPIRED");
  await expect(
    fs.access(
      path.join(process.env.PRIVATE_STORAGE_ROOT!, objectKey),
    ),
  ).rejects.toBeDefined();
});
