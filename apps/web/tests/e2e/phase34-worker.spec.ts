import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type APIRequestContext } from "@playwright/test";

import { createTestPdf } from "../fixtures/test-pdf";

const projectId = "phase3_test_project";
const buildingId = "phase3_test_building";
const installationUnitId = "phase3_test_unit";
const workspaceRoot = path.resolve(process.cwd(), "../..");
const storageRoot = path.join(workspaceRoot, "storage", "private-test");
const PDF_BYTES = createTestPdf([
  "Phase 3.4 first page",
  "Phase 3.4 second page",
]);
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function login(request: APIRequestContext): Promise<void> {
  const response = await request.post("/api/auth/sign-in/username", {
    data: {
      username: process.env.TEST_ADMIN_USERNAME,
      password: process.env.TEST_ADMIN_PASSWORD,
    },
  });
  expect(response.status()).toBe(200);
}

async function upload(
  request: APIRequestContext,
  bytes: Buffer,
  filename: string,
  mimeType: string,
) {
  const intentResponse = await request.post(
    `/api/projects/${projectId}/files/upload-intents`,
    {
      headers: { "Idempotency-Key": randomUUID() },
      data: {
        displayName: filename,
        originalFilename: filename,
        declaredMimeType: mimeType,
        declaredSizeBytes: bytes.byteLength,
        buildingId,
        installationUnitId,
      },
    },
  );
  expect(intentResponse.status()).toBe(201);
  const intent = (await intentResponse.json()) as {
    uploadIntent: { uploadPath: string };
  };
  const uploadResponse = await request.put(
    intent.uploadIntent.uploadPath,
    {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(bytes.byteLength),
      },
      data: bytes,
    },
  );
  expect(uploadResponse.status()).toBe(201);
  return (await uploadResponse.json()) as {
    extractionId: string;
    fileVersion: {
      id: string;
      fileId: string;
      checksumSha256: string;
    };
  };
}

test("worker extracts PDF pages and reads image metadata without OCR", async ({
  request,
}) => {
  await login(request);
  const pdfUpload = await upload(
    request,
    PDF_BYTES,
    "phase34-multi-page.pdf",
    "application/pdf",
  );
  const extractionPath = `/api/projects/${projectId}/files/${pdfUpload.fileVersion.fileId}/versions/${pdfUpload.fileVersion.id}/extractions/${pdfUpload.extractionId}`;

  let pdfExtraction:
    | {
        status: string;
        pageCount: number | null;
        textBlocks: Array<{ pageNumber: number; text: string }>;
      }
    | undefined;

  await expect
    .poll(
      async () => {
        const response = await request.get(extractionPath);
        if (response.status() !== 200) {
          return `HTTP_${response.status()}`;
        }
        const body = (await response.json()) as {
          extraction: typeof pdfExtraction;
        };
        pdfExtraction = body.extraction;
        return body.extraction?.status;
      },
      { timeout: 30_000 },
    )
    .toBe("COMPLETED");

  expect(pdfExtraction?.pageCount).toBe(2);
  expect(pdfExtraction?.textBlocks.map((block) => block.pageNumber)).toEqual([
    1, 2,
  ]);
  expect(pdfExtraction?.textBlocks[0]?.text).toContain(
    "Phase 3.4 first page",
  );
  expect(pdfExtraction?.textBlocks[1]?.text).toContain(
    "Phase 3.4 second page",
  );
  expect(JSON.stringify(pdfExtraction)).not.toContain("processingToken");
  expect(JSON.stringify(pdfExtraction)).not.toContain("leaseExpiresAt");

  const prisma = new PrismaClient();

  try {
    const version = await prisma.fileVersion.findUniqueOrThrow({
      where: { id: pdfUpload.fileVersion.id },
    });
    const objectBytes = await fs.readFile(
      path.join(storageRoot, version.storageKey),
    );
    expect(createHash("sha256").update(objectBytes).digest("hex")).toBe(
      pdfUpload.fileVersion.checksumSha256,
    );
  } finally {
    await prisma.$disconnect();
  }

  const imageUpload = await upload(
    request,
    PNG_BYTES,
    "phase34-image.png",
    "image/png",
  );
  const imageExtractionPath = `/api/projects/${projectId}/files/${imageUpload.fileVersion.fileId}/versions/${imageUpload.fileVersion.id}/extractions/${imageUpload.extractionId}`;
  let imageExtraction:
    | {
        status: string;
        pageCount: number | null;
        providerMetadata: { width?: number; height?: number; format?: string };
        textBlocks: Array<{ text: string }>;
      }
    | undefined;

  await expect
    .poll(
      async () => {
        const response = await request.get(imageExtractionPath);
        if (response.status() !== 200) {
          return `HTTP_${response.status()}`;
        }
        const body = (await response.json()) as {
          extraction: typeof imageExtraction;
        };
        imageExtraction = body.extraction;
        return body.extraction?.status;
      },
      { timeout: 30_000 },
    )
    .toBe("COMPLETED");

  expect(imageExtraction?.providerMetadata).toMatchObject({
    width: 1,
    height: 1,
    format: "png",
  });
  expect(imageExtraction?.textBlocks).toEqual([]);
  expect(imageExtraction?.pageCount).toBeNull();

  const prismaForSchedule = new PrismaClient();
  try {
    const schedules = await prismaForSchedule.$queryRaw<
      Array<{ name: string }>
    >`
      SELECT "name"
      FROM "pgboss"."schedule"
      WHERE "name" = 'file-maintenance'
    `;
    expect(schedules.length).toBeGreaterThan(0);
  } finally {
    await prismaForSchedule.$disconnect();
  }

  const logout = await request.post("/api/auth/sign-out", {
    data: {},
  });
  expect(logout.status()).toBe(200);
});
