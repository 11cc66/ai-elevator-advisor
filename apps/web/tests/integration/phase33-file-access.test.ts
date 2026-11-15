import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { LocalPrivateStorage } from "@elevator/file-storage";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, expect, it } from "vitest";

import { loadActor, type Actor } from "../../src/modules/access/actor";
import { prepareFileDownload } from "../../src/modules/files/download-service";
import {
  getProjectFileDetails,
  listProjectFiles,
} from "../../src/modules/files/file-query-service";
import {
  completeUpload,
  createUploadIntent,
} from "../../src/modules/files/upload-service";
import { readWebEnv } from "../../src/server/env";
import { TEST_FIXTURE_IDS } from "../../scripts/test-db/seed";

const prisma = new PrismaClient();
const storage = new LocalPrivateStorage(
  process.env.PRIVATE_STORAGE_ROOT!,
);
const PDF_BYTES = Buffer.from(
  "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
);

let actor: Actor;

async function uploadFile(existingFileId?: string) {
  const intent = await createUploadIntent(
    actor,
    TEST_FIXTURE_IDS.project,
    randomUUID(),
    {
      displayName: "DEMO Phase 3.3 file.pdf",
      originalFilename: "access-test.pdf",
      declaredMimeType: "application/pdf",
      declaredSizeBytes: PDF_BYTES.byteLength,
      buildingId: TEST_FIXTURE_IDS.building,
      installationUnitId: TEST_FIXTURE_IDS.installationUnit,
      existingFileId,
    },
    storage,
  );

  return completeUpload({
    actor,
    projectId: TEST_FIXTURE_IDS.project,
    intentId: intent.id,
    requestContentLength: PDF_BYTES.byteLength,
    requestMimeType: "application/pdf",
    source: Readable.from([PDF_BYTES]),
    requestId: `phase33-${randomUUID()}`,
    storage,
  });
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

it("lists files, shows version history and downloads a verified object", async () => {
  const firstVersion = await uploadFile();
  const secondVersion = await uploadFile(firstVersion.fileId);
  const files = await listProjectFiles(TEST_FIXTURE_IDS.project);
  const file = await getProjectFileDetails(
    TEST_FIXTURE_IDS.project,
    firstVersion.fileId,
  );

  expect(files.some((item) => item.id === firstVersion.fileId)).toBe(true);
  expect(file.currentVersionId).toBe(secondVersion.id);
  expect(file.versions.map((version) => version.versionNumber)).toEqual([
    2, 1,
  ]);

  const download = await prepareFileDownload({
    actor,
    projectId: TEST_FIXTURE_IDS.project,
    fileId: firstVersion.fileId,
    versionId: firstVersion.id,
    requestId: `download-${randomUUID()}`,
    env: readWebEnv(),
    storage,
  });
  const chunks: Buffer[] = [];

  for await (const chunk of download.stream) {
    chunks.push(Buffer.from(chunk));
  }

  expect(
    createHash("sha256").update(Buffer.concat(chunks)).digest("hex"),
  ).toBe(firstVersion.checksumSha256);
  expect(download.fileName).not.toContain("..");

  const audit = await prisma.auditLog.findFirst({
    where: {
      action: "file.downloaded",
      objectType: "FileVersion",
      objectId: firstVersion.id,
    },
  });
  expect(audit).not.toBeNull();
});

it("rejects a version that belongs to a different file", async () => {
  const firstVersion = await uploadFile();
  const secondVersion = await uploadFile();

  await expect(
    prepareFileDownload({
      actor,
      projectId: TEST_FIXTURE_IDS.project,
      fileId: firstVersion.fileId,
      versionId: secondVersion.id,
      requestId: `wrong-version-${randomUUID()}`,
      env: readWebEnv(),
      storage,
    }),
  ).rejects.toMatchObject({ code: "FILE_VERSION_NOT_FOUND" });
});

it("blocks corrupted objects and records an integrity event", async () => {
  const version = await uploadFile();
  const objectPath = path.join(
    process.env.PRIVATE_STORAGE_ROOT!,
    version.storageKey,
  );
  await fs.writeFile(objectPath, Buffer.from("corrupted"));

  await expect(
    prepareFileDownload({
      actor,
      projectId: TEST_FIXTURE_IDS.project,
      fileId: version.fileId,
      versionId: version.id,
      requestId: `corrupt-${randomUUID()}`,
      env: readWebEnv(),
      storage,
    }),
  ).rejects.toMatchObject({ code: "FILE_INTEGRITY_FAILED" });

  const updated = await prisma.fileVersion.findUniqueOrThrow({
    where: { id: version.id },
  });
  const securityEvent = await prisma.fileSecurityEvent.findFirst({
    where: {
      fileVersionId: version.id,
      eventType: "CHECKSUM_MISMATCH",
    },
  });

  expect(updated.integrityStatus).toBe("FAILED");
  expect(securityEvent).not.toBeNull();
});
