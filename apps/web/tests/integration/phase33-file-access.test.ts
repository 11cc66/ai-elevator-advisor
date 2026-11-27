import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { LocalPrivateStorage } from "@elevator/file-storage";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, expect, it } from "vitest";

import { loadActor, type Actor } from "../../src/modules/access/actor";
import { downloadResourcePool } from "../../src/modules/files/download-resource-pool";
import { createVerifiedDownloadStream } from "../../src/modules/files/download-response-stream";
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
import { createP13TestFileVersion } from "../helpers/p13-file-version";

const prisma = new PrismaClient();
const storage = new LocalPrivateStorage(
  process.env.PRIVATE_STORAGE_ROOT!,
);
const PDF_BYTES = Buffer.from(
  "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
);

let actor: Actor;

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs = 2_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("WAIT_FOR_TIMEOUT");
}

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

  const completed = await completeUpload({
    actor,
    projectId: TEST_FIXTURE_IDS.project,
    intentId: intent.id,
    requestContentLength: PDF_BYTES.byteLength,
    requestMimeType: "application/pdf",
    source: Readable.from([PDF_BYTES]),
    requestId: `phase33-${randomUUID()}`,
    storage,
  });
  return completed.version;
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
  try {
    expect(createHash("sha256").update(download.body).digest("hex")).toBe(
      firstVersion.checksumSha256,
    );
    expect(download.fileName).not.toContain("..");
  } finally {
    download.release();
  }

  const audit = await prisma.auditLog.findFirst({
    where: {
      action: "file.download_verified",
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
  await fs.writeFile(
    objectPath,
    Buffer.alloc(PDF_BYTES.byteLength, 0x78),
  );

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

it("classifies missing objects without recording a successful download", async () => {
  const version = await uploadFile();
  const objectPath = path.join(
    process.env.PRIVATE_STORAGE_ROOT!,
    version.storageKey,
  );
  await fs.rm(objectPath);

  await expect(
    prepareFileDownload({
      actor,
      projectId: TEST_FIXTURE_IDS.project,
      fileId: version.fileId,
      versionId: version.id,
      requestId: `missing-${randomUUID()}`,
      env: readWebEnv(),
      storage,
    }),
  ).rejects.toMatchObject({ code: "STORAGE_OBJECT_MISSING" });

  expect(
    await prisma.fileSecurityEvent.count({
      where: {
        fileVersionId: version.id,
        eventType: "STORAGE_OBJECT_MISSING",
      },
    }),
  ).toBe(1);
  expect(
    await prisma.auditLog.count({
      where: {
        action: "file.download_verified",
        objectType: "FileVersion",
        objectId: version.id,
      },
    }),
  ).toBe(0);
});

it("rejects oversized metadata before allocating a download buffer", async () => {
  const version = await uploadFile();
  const oversized = await createP13TestFileVersion(prisma, {
    fileId: version.fileId,
    uploadedById: actor.userId,
    projectId: TEST_FIXTURE_IDS.project,
    buildingId: TEST_FIXTURE_IDS.building,
    installationUnitId: TEST_FIXTURE_IDS.installationUnit,
    versionNumber: 3,
    originalFilename: "oversized.pdf",
    sanitizedFilename: "oversized.pdf",
    declaredMimeType: "application/pdf",
    detectedMimeType: "application/pdf",
    sizeBytes: 20n * 1024n * 1024n + 1n,
    checksumSha256: "a".repeat(64),
    storageKey: `objects/phase33/oversized-${randomUUID()}`,
    uploadStatus: "UPLOADED",
    validationStatus: "PASSED",
    integrityStatus: "VERIFIED",
    recognitionStatus: "COMPLETED",
    finalizedAt: new Date(),
  });

  await expect(
    prepareFileDownload({
      actor,
      projectId: TEST_FIXTURE_IDS.project,
      fileId: version.fileId,
      versionId: oversized.id,
      requestId: `oversized-${randomUUID()}`,
      env: readWebEnv(),
      storage,
    }),
  ).rejects.toMatchObject({ code: "FILE_TOO_LARGE", status: 413 });
});

it("records MIME rejection without changing integrity status", async () => {
  const version = await uploadFile();
  const written = await storage.writeToStaging(
    `staging/mime-${randomUUID()}.part`,
    Readable.from([PDF_BYTES]),
    20n * 1024n * 1024n,
  );
  const storageKey = `objects/mime-${randomUUID()}.bin`;
  await storage.finalize(written.stagingKey, storageKey);
  const mimeRejected = await createP13TestFileVersion(prisma, {
    fileId: version.fileId,
    uploadedById: actor.userId,
    projectId: TEST_FIXTURE_IDS.project,
    buildingId: TEST_FIXTURE_IDS.building,
    installationUnitId: TEST_FIXTURE_IDS.installationUnit,
    versionNumber: 2,
    originalFilename: "mime-rejected.txt",
    sanitizedFilename: "mime-rejected.txt",
    declaredMimeType: "text/plain",
    detectedMimeType: "text/plain",
    sizeBytes: written.sizeBytes,
    checksumSha256: written.checksumSha256,
    storageKey,
    uploadStatus: "UPLOADED",
    validationStatus: "PASSED",
    integrityStatus: "VERIFIED",
    recognitionStatus: "COMPLETED",
    finalizedAt: new Date(),
  });
  const requestId = `mime-${randomUUID()}`;

  await expect(
    prepareFileDownload({
      actor,
      projectId: TEST_FIXTURE_IDS.project,
      fileId: version.fileId,
      versionId: mimeRejected.id,
      requestId,
      env: readWebEnv(),
      storage,
    }),
  ).rejects.toMatchObject({
    code: "FILE_TYPE_NOT_ALLOWED",
    status: 415,
  });

  expect(
    (
      await prisma.fileVersion.findUniqueOrThrow({
        where: { id: mimeRejected.id },
        select: { integrityStatus: true },
      })
    ).integrityStatus,
  ).toBe("VERIFIED");
  const event = await prisma.fileSecurityEvent.findFirstOrThrow({
    where: {
      fileVersionId: mimeRejected.id,
      policyCode: "DOWNLOAD_MIME_TYPE_NOT_ALLOWED",
    },
  });
  expect(event.eventType).toBe("VALIDATION_FAILED");
  expect(event.details).toMatchObject({
    detectedMimeType: "text/plain",
  });
  expect(
    await prisma.auditLog.count({
      where: {
        requestId,
        action: "file.download_blocked",
        reason: "FILE_TYPE_NOT_ALLOWED",
      },
    }),
  ).toBe(1);
  expect(
    await prisma.auditLog.count({
      where: {
        requestId,
        action: "file.download_verified",
      },
    }),
  ).toBe(0);
});

it("records a Web Stream timeout without claiming client completion", async () => {
  const version = await uploadFile();
  const requestId = `interrupted-${randomUUID()}`;
  const download = await prepareFileDownload({
    actor,
    projectId: TEST_FIXTURE_IDS.project,
    fileId: version.fileId,
    versionId: version.id,
    requestId,
    env: readWebEnv(),
    storage,
  });
  const stream = createVerifiedDownloadStream(
    download.body,
    download.release,
    {
      timeoutMs: 20,
      onInterrupted: download.reportInterruption,
    },
  );

  await new Promise((resolve) => setTimeout(resolve, 40));
  await expect(stream.getReader().read()).rejects.toThrow(
    "DOWNLOAD_RESPONSE_TIMEOUT",
  );
  await waitFor(async () => {
    return (
      (await prisma.auditLog.count({
        where: {
          requestId,
          action: "file.download_interrupted",
          reason: "RESPONSE_TIMEOUT",
        },
      })) === 1
    );
  });

  expect(
    await prisma.auditLog.count({
      where: {
        requestId,
        action: "file.download_verified",
      },
    }),
  ).toBe(1);
  expect(
    await prisma.auditLog.count({
      where: {
        requestId,
        action: "file.download_interrupted",
        reason: "RESPONSE_TIMEOUT",
      },
    }),
  ).toBe(1);
});

it("rejects downloads when bounded buffer resources are exhausted", async () => {
  const version = await uploadFile();
  const webEnv = readWebEnv();
  const releases = Array.from(
    { length: webEnv.FILE_DOWNLOAD_MAX_CONCURRENT },
    () =>
    downloadResourcePool.acquire({
      bytes: 1,
      maxConcurrent: webEnv.FILE_DOWNLOAD_MAX_CONCURRENT,
      maxBytes: webEnv.FILE_DOWNLOAD_BUFFER_BUDGET_BYTES,
    }),
  );

  try {
    expect(releases.every(Boolean)).toBe(true);
    await expect(
      prepareFileDownload({
        actor,
        projectId: TEST_FIXTURE_IDS.project,
        fileId: version.fileId,
        versionId: version.id,
        requestId: `busy-${randomUUID()}`,
        env: readWebEnv(),
        storage,
      }),
    ).rejects.toMatchObject({
      code: "DOWNLOAD_RESOURCE_BUSY",
      status: 503,
    });
  } finally {
    for (const release of releases) {
      release?.();
    }
  }
});
