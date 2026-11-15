import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import {
  expect,
  test,
  type APIRequestContext,
} from "@playwright/test";

import { createTestPdf } from "../fixtures/test-pdf";

const username = process.env.TEST_ADMIN_USERNAME;
const password = process.env.TEST_ADMIN_PASSWORD;
const projectId = "phase3_test_project";
const buildingId = "phase3_test_building";
const installationUnitId = "phase3_test_unit";
const workspaceRoot = path.resolve(process.cwd(), "../..");
const storageRoot = path.join(workspaceRoot, "storage", "private-test");

const PDF_BYTES = createTestPdf(["Phase 3.2 upload test"]);
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function login(request: APIRequestContext) {
  const response = await request.post("/api/auth/sign-in/username", {
    data: { username, password },
  });
  expect(response.status()).toBe(200);
}

async function createIntent(
  request: APIRequestContext,
  input: {
    originalFilename: string;
    declaredMimeType: string;
    bytes: Buffer;
    existingFileId?: string;
    requestKey?: string;
  },
) {
  return request.post(
    `/api/projects/${projectId}/files/upload-intents`,
    {
      headers: {
        "Idempotency-Key": input.requestKey ?? randomUUID(),
      },
      data: {
        displayName: input.originalFilename,
        originalFilename: input.originalFilename,
        declaredMimeType: input.declaredMimeType,
        declaredSizeBytes: input.bytes.byteLength,
        buildingId,
        installationUnitId,
        existingFileId: input.existingFileId,
      },
    },
  );
}

async function uploadBytes(
  request: APIRequestContext,
  uploadPath: string,
  bytes: Buffer,
  mimeType: string,
) {
  return request.put(uploadPath, {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(bytes.byteLength),
    },
    data: bytes,
  });
}

test("Phase 3.2 private streaming upload flow", async ({ request }) => {
  expect(username).toBeTruthy();
  expect(password).toBeTruthy();

  const prisma = new PrismaClient();

  try {
    await request.put(
      `/api/projects/${projectId}/files/upload-intents/not-authenticated/content`,
      {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": String(PDF_BYTES.byteLength),
        },
        data: PDF_BYTES,
      },
    ).then((response) => expect(response.status()).toBe(401));

    await login(request);

    const rejectedOrigin = await request.post(
      `/api/projects/${projectId}/files/upload-intents`,
      {
        headers: {
          Origin: "https://untrusted.invalid",
          "Idempotency-Key": randomUUID(),
        },
        data: {
          displayName: "rejected.pdf",
          originalFilename: "rejected.pdf",
          declaredMimeType: "application/pdf",
          declaredSizeBytes: PDF_BYTES.byteLength,
          buildingId,
          installationUnitId,
        },
      },
    );
    expect(rejectedOrigin.status()).toBe(403);

    const requestKey = randomUUID();
    const firstIntent = await createIntent(request, {
      originalFilename: "demo.pdf",
      declaredMimeType: "application/pdf",
      bytes: PDF_BYTES,
      requestKey,
    });
    expect(firstIntent.status()).toBe(201);
    const firstIntentBody = (await firstIntent.json()) as {
      uploadIntent: { id: string; uploadPath: string };
    };

    const duplicateIntent = await createIntent(request, {
      originalFilename: "demo.pdf",
      declaredMimeType: "application/pdf",
      bytes: PDF_BYTES,
      requestKey,
    });
    expect(duplicateIntent.status()).toBe(201);
    const duplicateIntentBody = (await duplicateIntent.json()) as {
      uploadIntent: { id: string };
    };
    expect(duplicateIntentBody.uploadIntent.id).toBe(
      firstIntentBody.uploadIntent.id,
    );

    const upload = await uploadBytes(
      request,
      firstIntentBody.uploadIntent.uploadPath,
      PDF_BYTES,
      "application/pdf",
    );
    const uploadStatus = upload.status();
    const uploadPayload = (await upload.json()) as {
      fileVersion: {
        id: string;
        fileId: string;
        versionNumber: number;
        checksumSha256: string;
        validationStatus: string;
        malwareScanStatus: string;
        integrityStatus: string;
      };
      error?: { code?: string };
    };
    expect(uploadStatus, JSON.stringify(uploadPayload)).toBe(201);
    const uploadBody = uploadPayload as {
      fileVersion: {
        id: string;
        fileId: string;
        versionNumber: number;
        checksumSha256: string;
        validationStatus: string;
        malwareScanStatus: string;
        integrityStatus: string;
      };
    };
    const expectedChecksum = createHash("sha256")
      .update(PDF_BYTES)
      .digest("hex");

    expect(uploadBody.fileVersion.versionNumber).toBe(1);
    expect(uploadBody.fileVersion.checksumSha256).toBe(expectedChecksum);
    expect(uploadBody.fileVersion.validationStatus).toBe("PASSED");
    expect(uploadBody.fileVersion.malwareScanStatus).toBe(
      "SCAN_UNAVAILABLE",
    );
    expect(uploadBody.fileVersion.integrityStatus).toBe("VERIFIED");
    expect(JSON.stringify(uploadBody)).not.toContain("storageKey");

    const filesPage = await request.get(
      `/projects/${projectId}/files`,
    );
    expect(filesPage.status()).toBe(200);
    const filesPageHtml = await filesPage.text();
    expect(filesPageHtml).toContain("demo.pdf");
    expect(filesPageHtml).toContain("SCAN_UNAVAILABLE");

    const fileDetailPage = await request.get(
      `/projects/${projectId}/files/${uploadBody.fileVersion.fileId}`,
    );
    expect(fileDetailPage.status()).toBe(200);
    const fileDetailPageHtml = await fileDetailPage.text();
    const normalizedDetailHtml = fileDetailPageHtml.replaceAll(
      "<!-- -->",
      "",
    );
    expect(normalizedDetailHtml).toContain("版本 1");
    expect(normalizedDetailHtml).toContain("受控下载");

    const storedVersion = await prisma.fileVersion.findUniqueOrThrow({
      where: { id: uploadBody.fileVersion.id },
      include: { file: true },
    });
    expect(storedVersion.checksumSha256).toBe(expectedChecksum);
    expect(storedVersion.file.currentVersionId).toBe(storedVersion.id);
    expect(storedVersion.storageKey).not.toContain("demo.pdf");
    expect(filesPageHtml).not.toContain(storedVersion.storageKey);
    expect(fileDetailPageHtml).not.toContain(storedVersion.storageKey);

    const objectPath = path.join(storageRoot, storedVersion.storageKey);
    const objectBytes = await fs.readFile(objectPath);
    expect(createHash("sha256").update(objectBytes).digest("hex")).toBe(
      expectedChecksum,
    );
    await expect(
      fs.access(
        path.join(
          workspaceRoot,
          "apps",
          "web",
          "public",
          storedVersion.storageKey,
        ),
      ),
    ).rejects.toBeDefined();

    const intentRecord = await prisma.fileUploadIntent.findUniqueOrThrow({
      where: { id: firstIntentBody.uploadIntent.id },
    });
    await expect(
      fs.access(path.join(storageRoot, intentRecord.stagingKey)),
    ).rejects.toBeDefined();

    const fileList = await request.get(
      `/api/projects/${projectId}/files`,
    );
    expect(fileList.status()).toBe(200);
    const fileListText = await fileList.text();
    expect(fileListText).toContain(storedVersion.id);
    expect(fileListText).not.toContain(storedVersion.storageKey);

    const fileDetail = await request.get(
      `/api/projects/${projectId}/files/${storedVersion.fileId}`,
    );
    expect(fileDetail.status()).toBe(200);
    const fileDetailText = await fileDetail.text();
    expect(fileDetailText).not.toContain(storedVersion.storageKey);
    expect(fileDetailText).toContain('"currentVersionId"');

    const downloadUrl = `/api/projects/${projectId}/files/${storedVersion.fileId}/versions/${storedVersion.id}/content`;
    const download = await request.get(downloadUrl);
    expect(download.status()).toBe(200);
    expect(download.headers()["content-type"]).toBe("application/pdf");
    expect(download.headers()["content-disposition"]).toContain(
      "attachment",
    );
    expect(download.headers()["cache-control"]).toContain("no-store");
    expect(download.headers()["x-content-type-options"]).toBe("nosniff");
    expect(
      createHash("sha256").update(await download.body()).digest("hex"),
    ).toBe(expectedChecksum);

    const wrongProjectDownload = await request.get(
      `/api/projects/phase3_test_project_2/files/${storedVersion.fileId}/versions/${storedVersion.id}/content`,
    );
    expect(wrongProjectDownload.status()).toBe(404);
    const wrongFileDownload = await request.get(
      `/api/projects/${projectId}/files/nonexistent-file/versions/${storedVersion.id}/content`,
    );
    expect(wrongFileDownload.status()).toBe(404);
    const wrongVersionDownload = await request.get(
      `/api/projects/${projectId}/files/${storedVersion.fileId}/versions/nonexistent-version/content`,
    );
    expect(wrongVersionDownload.status()).toBe(404);

    const downloadAudit = await request.get("/api/admin/audit");
    expect(downloadAudit.status()).toBe(200);
    const downloadAuditBody = (await downloadAudit.json()) as {
      auditLogs: Array<{ action: string; objectId: string }>;
    };
    expect(
      downloadAuditBody.auditLogs.some(
        (entry) =>
          entry.action === "file.downloaded" &&
          entry.objectId === storedVersion.id,
      ),
    ).toBe(true);
    expect(
      downloadAuditBody.auditLogs.some(
        (entry) =>
          entry.action === "file.viewed" &&
          entry.objectId === storedVersion.fileId,
      ),
    ).toBe(true);

    const repeatedUpload = await uploadBytes(
      request,
      firstIntentBody.uploadIntent.uploadPath,
      PDF_BYTES,
      "application/pdf",
    );
    expect(repeatedUpload.status()).toBe(201);
    expect(await prisma.fileVersion.count({
      where: { fileId: storedVersion.fileId },
    })).toBe(1);

    const spoofedIntent = await createIntent(request, {
      originalFilename: "spoofed.pdf",
      declaredMimeType: "application/pdf",
      bytes: PNG_BYTES,
    });
    expect(spoofedIntent.status()).toBe(201);
    const spoofedBody = (await spoofedIntent.json()) as {
      uploadIntent: { id: string; uploadPath: string };
    };
    const spoofedUpload = await uploadBytes(
      request,
      spoofedBody.uploadIntent.uploadPath,
      PNG_BYTES,
      "application/pdf",
    );
    expect(spoofedUpload.status()).toBe(422);
    const failedIntent = await prisma.fileUploadIntent.findUniqueOrThrow({
      where: { id: spoofedBody.uploadIntent.id },
    });
    expect(failedIntent.status).toBe("FAILED");
    expect(failedIntent.completedFileVersionId).toBeNull();
    await expect(
      fs.access(path.join(storageRoot, failedIntent.stagingKey)),
    ).rejects.toBeDefined();

    const lengthMismatchIntent = await createIntent(request, {
      originalFilename: "length-mismatch.pdf",
      declaredMimeType: "application/pdf",
      bytes: PDF_BYTES,
    });
    const lengthMismatchBody = (await lengthMismatchIntent.json()) as {
      uploadIntent: { id: string; uploadPath: string };
    };
    const mismatchedBytes = Buffer.concat([PDF_BYTES, Buffer.from("?")]);
    const lengthMismatchUpload = await uploadBytes(
      request,
      lengthMismatchBody.uploadIntent.uploadPath,
      mismatchedBytes,
      "application/pdf",
    );
    expect(lengthMismatchUpload.status()).toBe(400);
    const unchangedIntent = await prisma.fileUploadIntent.findUniqueOrThrow({
      where: { id: lengthMismatchBody.uploadIntent.id },
    });
    expect(unchangedIntent.status).toBe("PENDING");
    await expect(
      fs.access(path.join(storageRoot, unchangedIntent.stagingKey)),
    ).rejects.toBeDefined();

    const tooLargeIntent = await request.post(
      `/api/projects/${projectId}/files/upload-intents`,
      {
        headers: { "Idempotency-Key": randomUUID() },
        data: {
          displayName: "too-large.pdf",
          originalFilename: "too-large.pdf",
          declaredMimeType: "application/pdf",
          declaredSizeBytes: 20 * 1024 * 1024 + 1,
          buildingId,
          installationUnitId,
        },
      },
    );
    expect(tooLargeIntent.status()).toBe(400);

    const firstConcurrentIntent = await createIntent(request, {
      originalFilename: "version-two.png",
      declaredMimeType: "image/png",
      bytes: PNG_BYTES,
      existingFileId: storedVersion.fileId,
    });
    const secondConcurrentIntent = await createIntent(request, {
      originalFilename: "version-three.png",
      declaredMimeType: "image/png",
      bytes: PNG_BYTES,
      existingFileId: storedVersion.fileId,
    });
    const firstConcurrentBody = (await firstConcurrentIntent.json()) as {
      uploadIntent: { uploadPath: string };
    };
    const secondConcurrentBody = (await secondConcurrentIntent.json()) as {
      uploadIntent: { uploadPath: string };
    };
    const concurrentUploads = await Promise.all([
      uploadBytes(
        request,
        firstConcurrentBody.uploadIntent.uploadPath,
        PNG_BYTES,
        "image/png",
      ),
      uploadBytes(
        request,
        secondConcurrentBody.uploadIntent.uploadPath,
        PNG_BYTES,
        "image/png",
      ),
    ]);

    expect(concurrentUploads.map((response) => response.status())).toEqual([
      201,
      201,
    ]);
    const versions = await prisma.fileVersion.findMany({
      where: { fileId: storedVersion.fileId },
      orderBy: { versionNumber: "asc" },
      select: { id: true, versionNumber: true },
    });
    expect(versions.map((version) => version.versionNumber)).toEqual([
      1, 2, 3,
    ]);
    expect(versions[versions.length - 1]?.id).toBe(
      (
        await prisma.file.findUniqueOrThrow({
          where: { id: storedVersion.fileId },
          select: { currentVersionId: true },
        })
      ).currentVersionId,
    );

    const logout = await request.post("/api/auth/sign-out", {
      data: {},
    });
    expect(logout.status()).toBe(200);

    const afterLogoutDownload = await request.get(downloadUrl);
    expect(afterLogoutDownload.status()).toBe(401);
  } finally {
    await prisma.$disconnect();
  }
});
