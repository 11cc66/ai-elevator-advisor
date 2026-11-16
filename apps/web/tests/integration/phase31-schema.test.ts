import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PERMISSIONS } from "../../src/modules/access/permissions";
import { TEST_FIXTURE_IDS } from "../../scripts/test-db/seed";

const prisma = new PrismaClient();

let adminUserId = "";
let customerUserId = "";
let sequence = 0;

function checksum(character: string): string {
  return character.repeat(64);
}

function storageKey(prefix: string): string {
  sequence += 1;
  return `test/${prefix}/${sequence}-${randomUUID()}`;
}

async function createFileFixture() {
  sequence += 1;
  return prisma.file.create({
    data: {
      customerId: TEST_FIXTURE_IDS.customer,
      projectId: TEST_FIXTURE_IDS.project,
      buildingId: TEST_FIXTURE_IDS.building,
      installationUnitId: TEST_FIXTURE_IDS.installationUnit,
      displayName: `DEMO_PHASE31 文件 ${sequence}`,
      dataClassification: "DEMO_MOCK",
      createdById: adminUserId,
    },
  });
}

async function createVersion(fileId: string, marker: string) {
  return prisma.fileVersion.create({
    data: {
      fileId,
      versionNumber: 1,
      originalFilename: `${marker}.pdf`,
      sanitizedFilename: `${marker}.pdf`,
      declaredMimeType: "application/pdf",
      detectedMimeType: "application/pdf",
      sizeBytes: 1024n,
      checksumSha256: checksum(marker),
      storageKey: storageKey(marker),
      uploadedById: adminUserId,
    },
  });
}

beforeAll(async () => {
  const username = process.env.TEST_ADMIN_USERNAME?.toLowerCase();
  const customerUsername =
    process.env.TEST_CUSTOMER_USERNAME?.toLowerCase();
  expect(username).toBeTruthy();
  expect(customerUsername).toBeTruthy();

  const admin = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  const customer = await prisma.user.findUnique({
    where: { username: customerUsername },
    select: { id: true },
  });

  expect(admin).not.toBeNull();
  expect(customer).not.toBeNull();
  adminUserId = admin!.id;
  customerUserId = customer!.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe.sequential("Phase 3.1 database constraints", () => {
  it("seeds file permissions with project-scoped customer access", async () => {
    const permissions = await prisma.permission.findMany({
      where: {
        code: {
          in: [
            PERMISSIONS.FILE_READ,
            PERMISSIONS.FILE_UPLOAD,
            PERMISSIONS.FILE_PROCESS,
            PERMISSIONS.FILE_CONFIRM,
            PERMISSIONS.FILE_UNSCANNED_TEST_ACCESS,
          ],
        },
      },
      select: { code: true },
    });
    expect(permissions).toHaveLength(5);

    const customerRole = await prisma.role.findUniqueOrThrow({
      where: { code: "CUSTOMER" },
      include: {
        permissions: true,
        assignments: true,
      },
    });
    const customerPermissions = customerRole.permissions.map(
      (permission) => permission.permissionCode,
    );

    expect(customerPermissions).toContain(PERMISSIONS.FILE_READ);
    expect(customerPermissions).toContain(PERMISSIONS.FILE_UPLOAD);
    expect(customerPermissions).toContain(PERMISSIONS.FILE_CONFIRM);
    expect(customerPermissions).not.toContain(PERMISSIONS.FILE_PROCESS);
    expect(
      customerRole.assignments.every(
        (assignment) => assignment.scope === "PROJECT",
      ),
    ).toBe(true);
  });

  it("rejects a building that belongs to another project", async () => {
    const otherProject = await prisma.project.create({
      data: {
        projectCode: `DEMO-PHASE31-OTHER-${Date.now()}`,
        customerId: TEST_FIXTURE_IDS.customer,
        name: "DEMO_PHASE31 另一项目",
        address: "DEMO_PHASE31 测试地址",
        createdById: adminUserId,
      },
    });
    const otherBuilding = await prisma.building.create({
      data: {
        buildingCode: `DEMO-PHASE31-B-${Date.now()}`,
        projectId: otherProject.id,
        name: "DEMO_PHASE31 另一建筑",
        createdById: adminUserId,
      },
    });

    await expect(
      prisma.file.create({
        data: {
          customerId: TEST_FIXTURE_IDS.customer,
          projectId: TEST_FIXTURE_IDS.project,
          buildingId: otherBuilding.id,
          displayName: "错误归属测试",
          createdById: adminUserId,
        },
      }),
    ).rejects.toBeDefined();
  });

  it("rejects a file whose customer does not own the project", async () => {
    const otherCustomer = await prisma.customer.create({
      data: {
        organizationName: `DEMO_PHASE31 另一客户 ${Date.now()}`,
        contactName: "DEMO 联系人",
        createdById: adminUserId,
      },
    });

    await expect(
      prisma.file.create({
        data: {
          customerId: otherCustomer.id,
          projectId: TEST_FIXTURE_IDS.project,
          displayName: "错误客户归属测试",
          createdById: adminUserId,
        },
      }),
    ).rejects.toBeDefined();
  });

  it("requires a building when assigning an installation unit", async () => {
    await expect(
      prisma.file.create({
        data: {
          customerId: TEST_FIXTURE_IDS.customer,
          projectId: TEST_FIXTURE_IDS.project,
          installationUnitId: TEST_FIXTURE_IDS.installationUnit,
          displayName: "缺少建筑测试",
          createdById: adminUserId,
        },
      }),
    ).rejects.toBeDefined();
  });

  it("prevents currentVersionId from referencing another file", async () => {
    const firstFile = await createFileFixture();
    const secondFile = await createFileFixture();
    const firstVersion = await createVersion(firstFile.id, "a");

    const updatedFirstFile = await prisma.file.update({
      where: { id: firstFile.id },
      data: { currentVersionId: firstVersion.id },
    });
    expect(updatedFirstFile.currentVersionId).toBe(firstVersion.id);

    await expect(
      prisma.file.update({
        where: { id: secondFile.id },
        data: { currentVersionId: firstVersion.id },
      }),
    ).rejects.toBeDefined();
  });

  it("protects original file versions from identity changes and deletion", async () => {
    const file = await createFileFixture();
    const version = await createVersion(file.id, "b");

    await expect(
      prisma.fileVersion.update({
        where: { id: version.id },
        data: { checksumSha256: checksum("c") },
      }),
    ).rejects.toBeDefined();

    const uploaded = await prisma.fileVersion.update({
      where: { id: version.id },
      data: { uploadStatus: "UPLOADED" },
    });
    expect(uploaded.uploadStatus).toBe("UPLOADED");

    await expect(
      prisma.fileVersion.delete({ where: { id: version.id } }),
    ).rejects.toBeDefined();
  });

  it("keeps completed extraction content and text blocks immutable", async () => {
    const file = await createFileFixture();
    const version = await createVersion(file.id, "d");
    const extraction = await prisma.fileExtraction.create({
      data: {
        fileVersionId: version.id,
        extractionVersion: 1,
        provider: "DEMO_TEST",
        providerVersion: "1.0.0",
        dataClassification: "DEMO_MOCK",
      },
    });
    const block = await prisma.extractionTextBlock.create({
      data: {
        extractionId: extraction.id,
        pageNumber: 1,
        blockIndex: 0,
        text: "DEMO_MOCK extracted text",
        sourceKind: "PDF_TEXT_LAYER",
        characterCount: 23,
      },
    });

    await prisma.fileExtraction.update({
      where: { id: extraction.id },
      data: {
        status: "COMPLETED",
        extractedText: "DEMO_MOCK extracted text",
        completedAt: new Date(),
      },
    });

    await expect(
      prisma.fileExtraction.update({
        where: { id: extraction.id },
        data: { extractedText: "changed" },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.fileExtraction.update({
        where: { id: extraction.id },
        data: { status: "PROCESSING" },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.extractionTextBlock.update({
        where: { id: block.id },
        data: { text: "changed" },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.extractionTextBlock.delete({ where: { id: block.id } }),
    ).rejects.toBeDefined();
    await expect(
      prisma.fileExtraction.delete({ where: { id: extraction.id } }),
    ).rejects.toBeDefined();
  });

  it("keeps professional fields pending after a customer correction", async () => {
    const file = await createFileFixture();
    const version = await createVersion(file.id, "e");
    const extraction = await prisma.fileExtraction.create({
      data: {
        fileVersionId: version.id,
        extractionVersion: 1,
        provider: "DEMO_TEST",
        providerVersion: "1.0.0",
      },
    });
    await prisma.fileExtraction.update({
      where: { id: extraction.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
    const professionalField = await prisma.extractionField.create({
      data: {
        extractionId: extraction.id,
        fieldKey: "shaft_width",
        fieldLabel: "井道宽度",
        valueType: "NUMBER",
        originalRawValue: { value: 2200 },
        originalNormalizedValue: { value: 2200, unit: "mm" },
        unit: "mm",
        fieldClassification: "PROFESSIONAL",
        initialStatus: "PENDING_VERIFICATION",
        customerConfirmable: false,
        requiresProfessionalReview: true,
      },
    });

    await expect(
      prisma.extractionField.update({
        where: { id: professionalField.id },
        data: { originalRawValue: { value: 2300 } },
      }),
    ).rejects.toBeDefined();

    const reviewBase = {
      extractionFieldId: professionalField.id,
      action: "CORRECT" as const,
      originalValueSnapshot: { value: 2200 },
      correctedRawValue: { value: 2300 },
      correctedNormalizedValue: { value: 2300, unit: "mm" },
      actorUserId: customerUserId,
      actorRoleSnapshot: {
        roleCodes: ["CUSTOMER"],
        scope: "PROJECT",
        projectId: TEST_FIXTURE_IDS.project,
      },
    };

    await expect(
      prisma.extractionFieldReview.create({
        data: {
          ...reviewBase,
          reviewSequence: 1,
          statusAfterReview: "CUSTOMER_CONFIRMED",
        },
      }),
    ).rejects.toBeDefined();

    const pendingReview = await prisma.extractionFieldReview.create({
      data: {
        ...reviewBase,
        reviewSequence: 1,
        statusAfterReview: "PENDING_VERIFICATION",
      },
    });

    expect(pendingReview.statusAfterReview).toBe(
      "PENDING_VERIFICATION",
    );
    expect(professionalField.originalRawValue).toEqual({ value: 2200 });

    await expect(
      prisma.extractionFieldReview.update({
        where: { id: pendingReview.id },
        data: { note: "changed" },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.extractionFieldReview.delete({
        where: { id: pendingReview.id },
      }),
    ).rejects.toBeDefined();
  });

  it("preserves original ordinary values while appending review history", async () => {
    const file = await createFileFixture();
    const version = await createVersion(file.id, "f");
    const extraction = await prisma.fileExtraction.create({
      data: {
        fileVersionId: version.id,
        extractionVersion: 1,
        provider: "DEMO_TEST",
        providerVersion: "1.0.0",
      },
    });
    await prisma.fileExtraction.update({
      where: { id: extraction.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
    const field = await prisma.extractionField.create({
      data: {
        extractionId: extraction.id,
        fieldKey: "document_title",
        fieldLabel: "文档标题",
        valueType: "TEXT",
        originalRawValue: "原始标题",
        originalNormalizedValue: "原始标题",
        fieldClassification: "ORDINARY",
        customerConfirmable: true,
        requiresProfessionalReview: false,
      },
    });
    const reviewBase = {
      extractionFieldId: field.id,
      originalValueSnapshot: "原始标题",
      actorUserId: customerUserId,
      actorRoleSnapshot: {
        roleCodes: ["CUSTOMER"],
        scope: "PROJECT",
        projectId: TEST_FIXTURE_IDS.project,
      },
    };

    await prisma.extractionFieldReview.create({
      data: {
        ...reviewBase,
        reviewSequence: 1,
        action: "CONFIRM",
        statusAfterReview: "CUSTOMER_CONFIRMED",
      },
    });
    await prisma.extractionFieldReview.create({
      data: {
        ...reviewBase,
        reviewSequence: 2,
        action: "CORRECT",
        correctedRawValue: "更正后的标题",
        correctedNormalizedValue: "更正后的标题",
        statusAfterReview: "CUSTOMER_CONFIRMED",
      },
    });
    await prisma.extractionFieldReview.create({
      data: {
        ...reviewBase,
        reviewSequence: 3,
        action: "REJECT",
        statusAfterReview: "CUSTOMER_REJECTED",
      },
    });

    const storedField = await prisma.extractionField.findUniqueOrThrow({
      where: { id: field.id },
      include: {
        reviews: { orderBy: { reviewSequence: "asc" } },
      },
    });

    expect(storedField.originalRawValue).toBe("原始标题");
    expect(storedField.reviews.map((review) => review.action)).toEqual([
      "CONFIRM",
      "CORRECT",
      "REJECT",
    ]);
  });

  it("keeps security events append-only", async () => {
    const file = await createFileFixture();
    const version = await createVersion(file.id, "f");
    const event = await prisma.fileSecurityEvent.create({
      data: {
        fileVersionId: version.id,
        eventType: "SCAN_UNAVAILABLE_BLOCK",
        severity: "WARNING",
        policyCode: "TEST_ONLY",
      },
    });

    await expect(
      prisma.fileSecurityEvent.update({
        where: { id: event.id },
        data: { severity: "INFO" },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.fileSecurityEvent.delete({ where: { id: event.id } }),
    ).rejects.toBeDefined();
  });

  it("rejects malformed checksums and invalid confidence values", async () => {
    const file = await createFileFixture();

    await expect(
      prisma.fileVersion.create({
        data: {
          fileId: file.id,
          versionNumber: 2,
          originalFilename: "bad.pdf",
          sanitizedFilename: "bad.pdf",
          declaredMimeType: "application/pdf",
          sizeBytes: 1n,
          checksumSha256: "not-a-checksum",
          storageKey: storageKey("invalid"),
          uploadedById: adminUserId,
        },
      }),
    ).rejects.toBeDefined();

    const validVersion = await createVersion(file.id, "a");
    const extraction = await prisma.fileExtraction.create({
      data: {
        fileVersionId: validVersion.id,
        extractionVersion: 1,
        provider: "DEMO_TEST",
        providerVersion: "1.0.0",
      },
    });

    await expect(
      prisma.extractionField.create({
        data: {
          extractionId: extraction.id,
          fieldKey: "invalid_confidence",
          fieldLabel: "无效置信度",
          valueType: "TEXT",
          originalRawValue: "value",
          confidence: 1.2,
          fieldClassification: "ORDINARY",
        },
      }),
    ).rejects.toBeDefined();
  });
});
