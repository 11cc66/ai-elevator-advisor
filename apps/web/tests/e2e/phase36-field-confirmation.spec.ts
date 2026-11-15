import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import {
  expect,
  test,
  type APIRequestContext,
} from "@playwright/test";

import { createTestPdf } from "../fixtures/test-pdf";

const projectId = "phase3_test_project";
const buildingId = "phase3_test_building";
const installationUnitId = "phase3_test_unit";
const PDF_BYTES = createTestPdf(["Phase 3.6 structured field fixture"]);

async function login(
  request: APIRequestContext,
  username: string | undefined,
  password: string | undefined,
) {
  const response = await request.post("/api/auth/sign-in/username", {
    data: { username, password },
  });
  expect(response.status()).toBe(200);
}

async function upload(request: APIRequestContext) {
  const intentResponse = await request.post(
    `/api/projects/${projectId}/files/upload-intents`,
    {
      headers: { "Idempotency-Key": randomUUID() },
      data: {
        displayName: "DEMO_MOCK Phase 3.6.pdf",
        originalFilename: "phase36-customer.pdf",
        declaredMimeType: "application/pdf",
        declaredSizeBytes: PDF_BYTES.byteLength,
        buildingId,
        installationUnitId,
      },
    },
  );
  expect(intentResponse.status()).toBe(201);
  const intentBody = (await intentResponse.json()) as {
    uploadIntent: { uploadPath: string };
  };
  const response = await request.put(intentBody.uploadIntent.uploadPath, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(PDF_BYTES.byteLength),
    },
    data: PDF_BYTES,
  });
  expect(response.status()).toBe(201);

  return (await response.json()) as {
    extractionId: string;
    fileVersion: { id: string; fileId: string };
  };
}

async function waitForExtraction(
  request: APIRequestContext,
  uploaded: Awaited<ReturnType<typeof upload>>,
) {
  const path =
    `/api/projects/${projectId}/files/${uploaded.fileVersion.fileId}` +
    `/versions/${uploaded.fileVersion.id}/extractions/${uploaded.extractionId}`;
  await expect
    .poll(
      async () => {
        const response = await request.get(path);
        if (response.status() !== 200) {
          return `HTTP_${response.status()}`;
        }
        const body = (await response.json()) as {
          extraction: { status: string };
        };
        return body.extraction.status;
      },
      { timeout: 30_000 },
    )
    .toBe("COMPLETED");
  return path;
}

test("customer confirms ordinary fields while professional data stays pending", async ({
  request,
}) => {
  await login(
    request,
    process.env.TEST_CUSTOMER_USERNAME,
    process.env.TEST_CUSTOMER_PASSWORD,
  );
  const uploaded = await upload(request);
  const extractionPath = await waitForExtraction(request, uploaded);
  const pagePath =
    `/projects/${projectId}/files/${uploaded.fileVersion.fileId}` +
    `/versions/${uploaded.fileVersion.id}/extractions/${uploaded.extractionId}`;

  const emptyPage = await request.get(pagePath);
  expect(emptyPage.status()).toBe(200);
  expect(await emptyPage.text()).toContain(
    "当前识别版本没有结构化字段",
  );

  const prisma = new PrismaClient();

  try {
    const ordinaryField = await prisma.extractionField.create({
      data: {
        extractionId: uploaded.extractionId,
        fieldKey: "building_name",
        fieldLabel: "建筑名称",
        valueType: "TEXT",
        originalRawValue: "DEMO_MOCK 幸福里一号楼",
        originalNormalizedValue: "DEMO_MOCK 幸福里一号楼",
        pageNumber: 1,
        sourceText: "DEMO_MOCK building name source",
        sourceRefs: [{ page: 1 }],
        confidence: 0.91,
        fieldClassification: "ORDINARY",
        initialStatus: "EXTRACTED",
        customerConfirmable: true,
        requiresProfessionalReview: false,
      },
    });
    const professionalField = await prisma.extractionField.create({
      data: {
        extractionId: uploaded.extractionId,
        fieldKey: "shaft_width",
        fieldLabel: "井道宽度",
        valueType: "NUMBER",
        originalRawValue: 2200,
        originalNormalizedValue: 2200,
        unit: "mm",
        pageNumber: 2,
        sourceText: "DEMO_MOCK shaft width source",
        sourceRefs: [{ page: 2 }],
        confidence: 0.72,
        fieldClassification: "PROFESSIONAL",
        initialStatus: "PENDING_VERIFICATION",
        customerConfirmable: false,
        requiresProfessionalReview: true,
      },
    });
    const baseFieldPath =
      `${extractionPath}/fields`;
    const ordinaryReviewPath = `${baseFieldPath}/${ordinaryField.id}/reviews`;
    const professionalReviewPath = `${baseFieldPath}/${professionalField.id}/reviews`;

    const detailResponse = await request.get(extractionPath);
    expect(detailResponse.status()).toBe(200);
    const detailBody = await detailResponse.json();
    expect(detailBody.extraction.fields).toHaveLength(2);
    expect(JSON.stringify(detailBody)).not.toContain("storageKey");
    expect(JSON.stringify(detailBody)).not.toContain("processingToken");

    const populatedPage = await request.get(pagePath);
    expect(populatedPage.status()).toBe(200);
    const populatedHtml = await populatedPage.text();
    expect(populatedHtml).toContain("建筑名称");
    expect(populatedHtml).toContain("专业工程信息");
    expect(populatedHtml).toContain("待专业人员核实");
    expect(populatedHtml).toContain("提交修正建议");

    const confirmation = await request.post(ordinaryReviewPath, {
      data: {
        action: "CONFIRM",
        expectedReviewSequence: 0,
      },
    });
    expect(confirmation.status()).toBe(201);
    const confirmationBody = await confirmation.json();
    expect(
      confirmationBody.fieldReview.effectiveStatus,
    ).toBe("CUSTOMER_CONFIRMED");

    const professionalConfirm = await request.post(
      professionalReviewPath,
      {
        data: {
          action: "CONFIRM",
          expectedReviewSequence: 0,
        },
      },
    );
    expect(professionalConfirm.status()).toBe(403);
    expect(await professionalConfirm.json()).toMatchObject({
      error: {
        code: "PROFESSIONAL_FIELD_CONFIRM_FORBIDDEN",
      },
    });

    const professionalReject = await request.post(
      professionalReviewPath,
      {
        data: {
          action: "REJECT",
          expectedReviewSequence: 0,
        },
      },
    );
    expect(professionalReject.status()).toBe(403);

    const professionalCorrection = await request.post(
      professionalReviewPath,
      {
        data: {
          action: "CORRECT",
          correctedRawValue: 2250,
          expectedReviewSequence: 0,
          note: "DEMO_MOCK 客户建议值",
        },
      },
    );
    expect(professionalCorrection.status()).toBe(201);
    expect(
      (await professionalCorrection.json()).fieldReview.effectiveStatus,
    ).toBe("PENDING_VERIFICATION");

    const storedOrdinary =
      await prisma.extractionField.findUniqueOrThrow({
        where: { id: ordinaryField.id },
        include: { reviews: true },
      });
    const storedProfessional =
      await prisma.extractionField.findUniqueOrThrow({
        where: { id: professionalField.id },
        include: { reviews: true },
      });
    expect(storedOrdinary.originalRawValue).toBe(
      "DEMO_MOCK 幸福里一号楼",
    );
    expect(storedOrdinary.reviews).toHaveLength(1);
    expect(storedProfessional.originalRawValue).toBe(2200);
    expect(storedProfessional.reviews).toHaveLength(1);
    expect(
      storedProfessional.reviews[0]?.statusAfterReview,
    ).toBe("PENDING_VERIFICATION");
    expect(
      await prisma.auditLog.count({
        where: {
          objectType: "ExtractionField",
          objectId: {
            in: [ordinaryField.id, professionalField.id],
          },
        },
      }),
    ).toBe(2);

    const confirmedPage = await request.get(pagePath);
    expect(confirmedPage.status()).toBe(200);
    const confirmedHtml = await confirmedPage.text();
    expect(confirmedHtml).toContain("客户已确认");
    expect(confirmedHtml).toContain("待专业人员核实");
    expect(confirmedHtml).toContain("历史记录");

    const stale = await request.post(ordinaryReviewPath, {
      data: {
        action: "REJECT",
        expectedReviewSequence: 0,
      },
    });
    expect(stale.status()).toBe(409);

    const csrf = await request.post(ordinaryReviewPath, {
      headers: {
        Origin: "https://cross-site.invalid",
      },
      data: {
        action: "CORRECT",
        correctedRawValue: "DEMO_MOCK 伪造修改",
        expectedReviewSequence: 1,
      },
    });
    expect(csrf.status()).toBe(403);

    await request.post("/api/auth/sign-out", { data: {} });
    await login(
      request,
      process.env.TEST_CUSTOMER_2_USERNAME,
      process.env.TEST_CUSTOMER_PASSWORD,
    );
    const crossCustomer = await request.post(ordinaryReviewPath, {
      data: {
        action: "CORRECT",
        correctedRawValue: "DEMO_MOCK 越权修改",
        expectedReviewSequence: 1,
      },
    });
    expect(crossCustomer.status()).toBe(403);

    await request.post("/api/auth/sign-out", { data: {} });
    await login(
      request,
      process.env.TEST_ADMIN_USERNAME,
      process.env.TEST_ADMIN_PASSWORD,
    );
    const adminAttempt = await request.post(ordinaryReviewPath, {
      data: {
        action: "CORRECT",
        correctedRawValue: "DEMO_MOCK 管理员伪造",
        expectedReviewSequence: 1,
      },
    });
    expect(adminAttempt.status()).toBe(403);
    expect(await adminAttempt.json()).toMatchObject({
      error: {
        code: "CUSTOMER_ROLE_REQUIRED",
      },
    });

    await request.post("/api/auth/sign-out", { data: {} });
    const unauthenticated = await request.post(ordinaryReviewPath, {
      data: {
        action: "CONFIRM",
        expectedReviewSequence: 1,
      },
    });
    expect(unauthenticated.status()).toBe(401);

    const unauthenticatedApi = await request.get(extractionPath);
    expect(unauthenticatedApi.status()).toBe(401);
  } finally {
    await prisma.$disconnect();
  }
});
