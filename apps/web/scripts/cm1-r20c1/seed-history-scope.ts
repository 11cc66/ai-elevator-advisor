import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";

import { createP13TestFileVersion } from "../../tests/helpers/p13-file-version.js";

type FixtureMode = "safe" | "building" | "unit" | "combo";

const databaseUrl = process.env.CM1_FIXTURE_DATABASE_URL;
const mode = process.env.CM1_FIXTURE_MODE as FixtureMode | undefined;

if (!databaseUrl) {
  throw new Error("CM1_FIXTURE_DATABASE_URL is required");
}
if (!mode || !["safe", "building", "unit", "combo"].includes(mode)) {
  throw new Error(
    "CM1_FIXTURE_MODE must be one of safe, building, unit, combo",
  );
}

const prisma = new PrismaClient({
  datasources: {
    db: { url: databaseUrl },
  },
});

const suffix = randomUUID().replaceAll("-", "").slice(0, 16);
const ids = {
  user: `r20c1_user_${suffix}`,
  customer: `r20c1_customer_${suffix}`,
  project: `r20c1_project_${suffix}`,
  building1: `r20c1_building1_${suffix}`,
  building2: `r20c1_building2_${suffix}`,
  unit1: `r20c1_unit1_${suffix}`,
  unit2: `r20c1_unit2_${suffix}`,
  unit1b: `r20c1_unit1b_${suffix}`,
} as const;

async function seed(): Promise<void> {
  const identity = await prisma.$queryRaw<
    Array<{ database: string; role: string }>
  >`
    SELECT
      current_database() AS database,
      current_user AS role
  `;

  await prisma.user.create({
    data: {
      id: ids.user,
      name: "CM1 R20-C1 isolated fixture",
      email: `${suffix}@r20c1.invalid`,
      emailVerified: true,
      username: `r20c1_${suffix}`,
      displayUsername: `r20c1_${suffix}`,
    },
  });
  await prisma.customer.create({
    data: {
      id: ids.customer,
      organizationName: "DEMO_MOCK CM1 R20-C1 customer",
      contactName: "CM1 R20-C1",
      dataClassification: "DEMO_MOCK",
      createdById: ids.user,
    },
  });
  await prisma.project.create({
    data: {
      id: ids.project,
      projectCode: `DEMO-R20C1-${suffix}`,
      customerId: ids.customer,
      name: "DEMO_MOCK CM1 R20-C1 project",
      address: "DEMO_MOCK isolated PostgreSQL validation",
      projectType: "OLD_BUILDING_ELEVATOR",
      status: "DRAFT",
      dataClassification: "DEMO_MOCK",
      createdById: ids.user,
    },
  });
  await prisma.building.createMany({
    data: [
      {
        id: ids.building1,
        buildingCode: `DEMO-R20C1-B1-${suffix}`,
        projectId: ids.project,
        name: "DEMO_MOCK building 1",
        status: "DRAFT",
        dataClassification: "DEMO_MOCK",
        createdById: ids.user,
      },
      {
        id: ids.building2,
        buildingCode: `DEMO-R20C1-B2-${suffix}`,
        projectId: ids.project,
        name: "DEMO_MOCK building 2",
        status: "DRAFT",
        dataClassification: "DEMO_MOCK",
        createdById: ids.user,
      },
    ],
  });
  await prisma.installationUnit.createMany({
    data: [
      {
        id: ids.unit1,
        unitCode: `DEMO-R20C1-U1-${suffix}`,
        buildingId: ids.building1,
        intendedLocation: "DEMO_MOCK unit 1",
        status: "PENDING_CONFIRMATION",
        dataClassification: "DEMO_MOCK",
        createdById: ids.user,
      },
      {
        id: ids.unit1b,
        unitCode: `DEMO-R20C1-U1B-${suffix}`,
        buildingId: ids.building1,
        intendedLocation: "DEMO_MOCK unit 1b",
        status: "PENDING_CONFIRMATION",
        dataClassification: "DEMO_MOCK",
        createdById: ids.user,
      },
      {
        id: ids.unit2,
        unitCode: `DEMO-R20C1-U2-${suffix}`,
        buildingId: ids.building2,
        intendedLocation: "DEMO_MOCK unit 2",
        status: "PENDING_CONFIRMATION",
        dataClassification: "DEMO_MOCK",
        createdById: ids.user,
      },
    ],
  });

  const baseUnitId = mode === "building" ? null : ids.unit1;
  const version = await createP13TestFileVersion(prisma, {
    uploadedById: ids.user,
    projectId: ids.project,
    buildingId: ids.building1,
    installationUnitId: baseUnitId,
    versionNumber: 1,
    originalFilename: `DEMO_MOCK-r20c1-${mode}.pdf`,
    sanitizedFilename: `DEMO_MOCK-r20c1-${mode}.pdf`,
    declaredMimeType: "application/pdf",
    detectedMimeType: "application/pdf",
    sizeBytes: 1024n,
    checksumSha256: "a".repeat(64),
    storageKey: `objects/r20c1/${mode}-${suffix}`,
    uploadStatus: "UPLOADED",
    validationStatus: "PASSED",
    integrityStatus: "VERIFIED",
    recognitionStatus: "NOT_REQUESTED",
  });
  const file = await prisma.file.findUniqueOrThrow({
    where: { id: version.fileId },
  });

  const intentScope =
    mode === "safe"
      ? { buildingId: ids.building1, installationUnitId: ids.unit1 }
      : mode === "building"
        ? { buildingId: ids.building2, installationUnitId: null }
        : mode === "unit"
          ? { buildingId: ids.building1, installationUnitId: ids.unit1b }
          : { buildingId: ids.building2, installationUnitId: ids.unit2 };

  const appendIntent = await prisma.fileUploadIntent.create({
    data: {
      requestKey: `r20c1-${mode}-${suffix}`,
      requestFingerprint: "b".repeat(64),
      uploadedById: ids.user,
      projectId: ids.project,
      buildingId: intentScope.buildingId,
      installationUnitId: intentScope.installationUnitId,
      existingFileId: file.id,
      expectedCurrentFileVersionId: version.id,
      displayName: `DEMO_MOCK-r20c1-append-${mode}.pdf`,
      originalFilename: `DEMO_MOCK-r20c1-append-${mode}.pdf`,
      sanitizedFilename: `DEMO_MOCK-r20c1-append-${mode}.pdf`,
      declaredMimeType: "application/pdf",
      declaredSizeBytes: 1024n,
      stagingKey: `staging/r20c1-${mode}-${suffix}.part`,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 600_000),
    },
  });

  console.log(
    JSON.stringify(
      {
        mode,
        database: identity[0]?.database,
        role: identity[0]?.role,
        projectId: ids.project,
        fileId: file.id,
        currentFileVersionId: version.id,
        appendIntentId: appendIntent.id,
        fileScope: {
          buildingId: file.buildingId,
          installationUnitId: file.installationUnitId,
        },
        appendIntentScope: intentScope,
      },
      null,
      2,
    ),
  );
}

seed()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
