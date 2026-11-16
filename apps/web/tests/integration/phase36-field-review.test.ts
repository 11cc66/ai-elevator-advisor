import { randomUUID } from "node:crypto";

import {
  PrismaClient,
  type ExtractionFieldStatus,
} from "@prisma/client";
import { afterAll, beforeAll, expect, it } from "vitest";

import type { Actor } from "../../src/modules/access/actor";
import { loadActor } from "../../src/modules/access/actor";
import { submitCustomerFieldReview } from "../../src/modules/files/field-review-service";
import {
  deriveEffectiveFieldStatus,
} from "../../src/modules/files/field-review-policy";
import { TEST_FIXTURE_IDS } from "../../scripts/test-db/seed";

const prisma = new PrismaClient();
let adminUserId = "";
let customerActor: Actor;
let adminActor: Actor;
let sequence = 0;

beforeAll(async () => {
  const admin = await prisma.user.findUniqueOrThrow({
    where: {
      username: process.env.TEST_ADMIN_USERNAME?.toLowerCase(),
    },
    select: { id: true },
  });
  const customer = await prisma.user.findUniqueOrThrow({
    where: {
      username: process.env.TEST_CUSTOMER_USERNAME?.toLowerCase(),
    },
    select: { id: true },
  });
  adminUserId = admin.id;
  adminActor = await loadActor(admin.id);
  customerActor = await loadActor(customer.id);
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createFixture() {
  sequence += 1;
  const file = await prisma.file.create({
    data: {
      customerId: TEST_FIXTURE_IDS.customer,
      projectId: TEST_FIXTURE_IDS.project,
      buildingId: TEST_FIXTURE_IDS.building,
      installationUnitId: TEST_FIXTURE_IDS.installationUnit,
      displayName: `DEMO_MOCK Phase 3.6 文件 ${sequence}`,
      dataClassification: "DEMO_MOCK",
      createdById: adminUserId,
    },
  });
  const version = await prisma.fileVersion.create({
    data: {
      fileId: file.id,
      versionNumber: 1,
      originalFilename: `phase36-${sequence}.pdf`,
      sanitizedFilename: `phase36-${sequence}.pdf`,
      declaredMimeType: "application/pdf",
      detectedMimeType: "application/pdf",
      sizeBytes: 100n,
      checksumSha256: String(sequence % 10).repeat(64),
      storageKey: `test/phase36/${sequence}-${randomUUID()}`,
      uploadStatus: "UPLOADED",
      validationStatus: "PASSED",
      malwareScanStatus: "SCAN_UNAVAILABLE",
      integrityStatus: "VERIFIED",
      recognitionStatus: "COMPLETED",
      uploadedById: adminUserId,
      finalizedAt: new Date(),
    },
  });
  const extraction = await prisma.fileExtraction.create({
    data: {
      fileVersionId: version.id,
      extractionVersion: 1,
      provider: "DEMO_MOCK",
      providerVersion: "phase3.6-test",
      parserVersion: "phase3.6-test",
      dataClassification: "DEMO_MOCK",
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  return { file, version, extraction };
}

async function createField(
  extractionId: string,
  input: {
    classification: "ORDINARY" | "PROFESSIONAL";
    fieldKey: string;
    value: string | number;
    initialStatus?: ExtractionFieldStatus;
    customerConfirmable?: boolean;
    requiresProfessionalReview?: boolean;
  },
) {
  return prisma.extractionField.create({
    data: {
      extractionId,
      fieldKey: input.fieldKey,
      fieldLabel: input.fieldKey,
      valueType:
        input.classification === "ORDINARY" ? "TEXT" : "NUMBER",
      originalRawValue: input.value,
      originalNormalizedValue: input.value,
      unit: input.classification === "PROFESSIONAL" ? "mm" : null,
      pageNumber: 1,
      sourceText: `DEMO_MOCK source ${input.fieldKey}`,
      sourceRefs: [{ page: 1 }],
      confidence: 0.88,
      fieldClassification: input.classification,
      initialStatus:
        input.initialStatus ??
        (input.classification === "PROFESSIONAL"
          ? "PENDING_VERIFICATION"
          : "EXTRACTED"),
      customerConfirmable:
        input.customerConfirmable ??
        (input.classification === "ORDINARY"),
      requiresProfessionalReview:
        input.requiresProfessionalReview ??
        (input.classification === "PROFESSIONAL"),
    },
  });
}

it("appends ordinary confirm, correction and rejection history", async () => {
  const fixture = await createFixture();
  const title = await createField(fixture.extraction.id, {
    classification: "ORDINARY",
    fieldKey: "building_name",
    value: "DEMO_MOCK 一号楼",
  });
  const address = await createField(fixture.extraction.id, {
    classification: "ORDINARY",
    fieldKey: "building_address",
    value: "DEMO_MOCK 原地址",
  });
  const description = await createField(fixture.extraction.id, {
    classification: "ORDINARY",
    fieldKey: "file_description",
    value: "DEMO_MOCK 文件说明",
  });
  const base = {
    actor: customerActor,
    projectId: TEST_FIXTURE_IDS.project,
    fileId: fixture.file.id,
    versionId: fixture.version.id,
    extractionId: fixture.extraction.id,
    requestId: randomUUID(),
  };

  await submitCustomerFieldReview({
    ...base,
    fieldId: title.id,
    review: {
      action: "CONFIRM",
      expectedReviewSequence: 0,
    },
  });
  await submitCustomerFieldReview({
    ...base,
    requestId: randomUUID(),
    fieldId: address.id,
    review: {
      action: "CORRECT",
      correctedRawValue: "DEMO_MOCK 更正地址",
      expectedReviewSequence: 0,
      note: "客户补充门牌",
    },
  });
  await submitCustomerFieldReview({
    ...base,
    requestId: randomUUID(),
    fieldId: description.id,
    review: {
      action: "REJECT",
      expectedReviewSequence: 0,
      note: "该说明不适用于本项目",
    },
  });

  const fields = await prisma.extractionField.findMany({
    where: { extractionId: fixture.extraction.id },
    include: { reviews: true },
  });
  const byKey = new Map(fields.map((field) => [field.fieldKey, field]));
  expect(byKey.get("building_name")?.originalRawValue).toBe(
    "DEMO_MOCK 一号楼",
  );
  expect(
    byKey.get("building_name")?.reviews[0]?.statusAfterReview,
  ).toBe("CUSTOMER_CONFIRMED");
  expect(byKey.get("building_address")?.originalRawValue).toBe(
    "DEMO_MOCK 原地址",
  );
  expect(
    byKey.get("building_address")?.reviews[0]?.correctedRawValue,
  ).toBe("DEMO_MOCK 更正地址");
  expect(
    byKey.get("file_description")?.reviews[0]?.statusAfterReview,
  ).toBe("CUSTOMER_REJECTED");
  expect(
    await prisma.auditLog.count({
      where: {
        objectType: "ExtractionField",
        objectId: { in: [title.id, address.id, description.id] },
      },
    }),
  ).toBe(3);
});

it("allows only correction suggestions for professional fields", async () => {
  const fixture = await createFixture();
  const field = await createField(fixture.extraction.id, {
    classification: "PROFESSIONAL",
    fieldKey: "shaft_width",
    value: 2200,
  });
  const base = {
    actor: customerActor,
    projectId: TEST_FIXTURE_IDS.project,
    fileId: fixture.file.id,
    versionId: fixture.version.id,
    extractionId: fixture.extraction.id,
    fieldId: field.id,
    requestId: randomUUID(),
  };

  await expect(
    submitCustomerFieldReview({
      ...base,
      review: {
        action: "CONFIRM",
        expectedReviewSequence: 0,
      },
    }),
  ).rejects.toMatchObject({
    code: "PROFESSIONAL_FIELD_CONFIRM_FORBIDDEN",
    status: 403,
  });
  await expect(
    submitCustomerFieldReview({
      ...base,
      review: {
        action: "REJECT",
        expectedReviewSequence: 0,
      },
    }),
  ).rejects.toMatchObject({
    code: "PROFESSIONAL_FIELD_REJECT_FORBIDDEN",
    status: 403,
  });
  const result = await submitCustomerFieldReview({
    ...base,
    requestId: randomUUID(),
    review: {
      action: "CORRECT",
      correctedRawValue: 2250,
      expectedReviewSequence: 0,
      note: "DEMO_MOCK 客户建议值，待现场测量",
    },
  });

  expect(result.effectiveStatus).toBe("PENDING_VERIFICATION");
  const stored = await prisma.extractionField.findUniqueOrThrow({
    where: { id: field.id },
    include: { reviews: true },
  });
  expect(stored.originalRawValue).toBe(2200);
  expect(stored.reviews).toHaveLength(1);
  expect(stored.reviews[0]?.statusAfterReview).toBe(
    "PENDING_VERIFICATION",
  );
});

it("fails closed for conflicting review requirements and abnormal initial states", async () => {
  const fixture = await createFixture();
  await expect(
    createField(fixture.extraction.id, {
      classification: "ORDINARY",
      fieldKey: "conflicting_ordinary",
      value: "DEMO_MOCK 冲突普通字段",
      initialStatus: "EXTRACTED",
      customerConfirmable: true,
      requiresProfessionalReview: true,
    }),
  ).rejects.toBeDefined();
  const pendingOrdinary = await createField(fixture.extraction.id, {
    classification: "ORDINARY",
    fieldKey: "pending_ordinary",
    value: "DEMO_MOCK 待核实普通字段",
    initialStatus: "PENDING_VERIFICATION",
    customerConfirmable: true,
    requiresProfessionalReview: false,
  });
  const invalidatedOrdinary = await createField(
    fixture.extraction.id,
    {
      classification: "ORDINARY",
      fieldKey: "invalidated_ordinary",
      value: "DEMO_MOCK 已作废普通字段",
      initialStatus: "INVALIDATED",
      customerConfirmable: true,
      requiresProfessionalReview: false,
    },
  );
  const invalidatedProfessional = await createField(
    fixture.extraction.id,
    {
      classification: "PROFESSIONAL",
      fieldKey: "invalidated_professional",
      value: 2200,
      initialStatus: "INVALIDATED",
      customerConfirmable: false,
      requiresProfessionalReview: true,
    },
  );
  const base = {
    actor: customerActor,
    projectId: TEST_FIXTURE_IDS.project,
    fileId: fixture.file.id,
    versionId: fixture.version.id,
    extractionId: fixture.extraction.id,
  };

  for (const field of [pendingOrdinary, invalidatedOrdinary]) {
    for (const action of [
      "CONFIRM",
      "CORRECT",
      "REJECT",
    ] as const) {
      await expect(
        submitCustomerFieldReview({
          ...base,
          fieldId: field.id,
          requestId: randomUUID(),
          review: {
            action,
            ...(action === "CORRECT"
              ? { correctedRawValue: "DEMO_MOCK 异常修正" }
              : {}),
            expectedReviewSequence: 0,
          },
        }),
      ).rejects.toMatchObject({
        code: "FIELD_CURRENT_STATUS_INVALID",
        status: 403,
      });
    }
  }

  await expect(
    submitCustomerFieldReview({
      ...base,
      fieldId: invalidatedProfessional.id,
      requestId: randomUUID(),
      review: {
        action: "CORRECT",
        correctedRawValue: 2250,
        expectedReviewSequence: 0,
      },
    }),
  ).rejects.toMatchObject({
    code: "FIELD_CURRENT_STATUS_INVALID",
    status: 403,
  });

  const fieldIds = [
    pendingOrdinary.id,
    invalidatedOrdinary.id,
    invalidatedProfessional.id,
  ];
  expect(
    await prisma.extractionFieldReview.count({
      where: { extractionFieldId: { in: fieldIds } },
    }),
  ).toBe(0);
  expect(
    await prisma.auditLog.count({
      where: {
        objectType: "ExtractionField",
        objectId: { in: fieldIds },
      },
    }),
  ).toBe(0);
});

it("serializes concurrent submissions with the expected sequence", async () => {
  const fixture = await createFixture();
  const field = await createField(fixture.extraction.id, {
    classification: "ORDINARY",
    fieldKey: "building_usage",
    value: "DEMO_MOCK 住宅",
  });
  const base = {
    actor: customerActor,
    projectId: TEST_FIXTURE_IDS.project,
    fileId: fixture.file.id,
    versionId: fixture.version.id,
    extractionId: fixture.extraction.id,
    fieldId: field.id,
  };
  const results = await Promise.allSettled([
    submitCustomerFieldReview({
      ...base,
      requestId: randomUUID(),
      review: {
        action: "CONFIRM",
        expectedReviewSequence: 0,
      },
    }),
    submitCustomerFieldReview({
      ...base,
      requestId: randomUUID(),
      review: {
        action: "CORRECT",
        correctedRawValue: "DEMO_MOCK 商用",
        expectedReviewSequence: 0,
      },
    }),
  ]);

  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  const rejected = results.find(
    (result) => result.status === "rejected",
  );
  expect(rejected).toMatchObject({
    status: "rejected",
    reason: {
      code: "FIELD_REVIEW_STALE",
      status: 409,
    },
  });
  expect(
    await prisma.extractionFieldReview.count({
      where: { extractionFieldId: field.id },
    }),
  ).toBe(1);
});

it("rejects stale sequences, cross-resource IDs and non-customer admins", async () => {
  const fixture = await createFixture();
  const field = await createField(fixture.extraction.id, {
    classification: "ORDINARY",
    fieldKey: "building_name",
    value: "DEMO_MOCK 名称",
  });
  const base = {
    actor: customerActor,
    projectId: TEST_FIXTURE_IDS.project,
    fileId: fixture.file.id,
    versionId: fixture.version.id,
    extractionId: fixture.extraction.id,
    fieldId: field.id,
    requestId: randomUUID(),
  };

  await expect(
    submitCustomerFieldReview({
      ...base,
      review: {
        action: "CONFIRM",
        expectedReviewSequence: 1,
      },
    }),
  ).rejects.toMatchObject({
    code: "FIELD_REVIEW_STALE",
    status: 409,
  });
  await expect(
    submitCustomerFieldReview({
      ...base,
      extractionId: "wrong-extraction",
      review: {
        action: "CONFIRM",
        expectedReviewSequence: 0,
      },
    }),
  ).rejects.toMatchObject({
    code: "EXTRACTION_FIELD_NOT_FOUND",
    status: 404,
  });
  await expect(
    submitCustomerFieldReview({
      ...base,
      requestId: randomUUID(),
      review: {
        action: "CORRECT",
        correctedRawValue: 123,
        expectedReviewSequence: 0,
      },
    }),
  ).rejects.toMatchObject({
    code: "FIELD_CORRECTION_VALUE_INVALID",
    status: 400,
  });
  await expect(
    submitCustomerFieldReview({
      ...base,
      actor: adminActor,
      review: {
        action: "CONFIRM",
        expectedReviewSequence: 0,
      },
    }),
  ).rejects.toMatchObject({
    code: "CUSTOMER_ROLE_REQUIRED",
    status: 403,
  });
});

it("does not inherit review history into a new extraction", async () => {
  const fixture = await createFixture();
  const oldField = await createField(fixture.extraction.id, {
    classification: "ORDINARY",
    fieldKey: "building_name",
    value: "DEMO_MOCK 旧识别",
  });
  await submitCustomerFieldReview({
    actor: customerActor,
    projectId: TEST_FIXTURE_IDS.project,
    fileId: fixture.file.id,
    versionId: fixture.version.id,
    extractionId: fixture.extraction.id,
    fieldId: oldField.id,
    requestId: randomUUID(),
    review: {
      action: "CONFIRM",
      expectedReviewSequence: 0,
    },
  });
  const nextExtraction = await prisma.fileExtraction.create({
    data: {
      fileVersionId: fixture.version.id,
      extractionVersion: 2,
      provider: "DEMO_MOCK",
      providerVersion: "phase3.6-test",
      dataClassification: "DEMO_MOCK",
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });
  const nextField = await createField(nextExtraction.id, {
    classification: "ORDINARY",
    fieldKey: "building_name",
    value: "DEMO_MOCK 新识别",
  });

  expect(
    deriveEffectiveFieldStatus({
      fieldClassification: nextField.fieldClassification,
      initialStatus: nextField.initialStatus,
    }),
  ).toBe("EXTRACTED");
  expect(
    await prisma.extractionFieldReview.count({
      where: { extractionFieldId: nextField.id },
    }),
  ).toBe(0);
  expect(nextField.originalRawValue).toBe("DEMO_MOCK 新识别");
});
