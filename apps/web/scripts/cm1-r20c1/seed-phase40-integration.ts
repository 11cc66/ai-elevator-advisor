import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";

import { TEST_FIXTURE_IDS } from "../test-db/seed.js";

const databaseUrl = process.env.CM1_FIXTURE_DATABASE_URL;
const adminUsername = (
  process.env.CM1_FIXTURE_ADMIN_USERNAME ?? "r20c1admin"
).toLowerCase();

if (!databaseUrl) {
  throw new Error("CM1_FIXTURE_DATABASE_URL is required");
}

const prisma = new PrismaClient({
  datasources: {
    db: { url: databaseUrl },
  },
});

async function seed(): Promise<void> {
  const identity = await prisma.$queryRaw<
    Array<{ database: string; role: string }>
  >`
    SELECT current_database() AS database, current_user AS role
  `;

  const admin = await prisma.user.upsert({
    where: { username: adminUsername },
    create: {
      id: randomUUID(),
      name: "DEMO_MOCK CM1 R20-C1 integration admin",
      email: `${adminUsername}@r20c1.invalid`,
      emailVerified: true,
      username: adminUsername,
      displayUsername: adminUsername,
    },
    update: {
      emailVerified: true,
    },
  });

  await prisma.customer.upsert({
    where: { id: TEST_FIXTURE_IDS.customer },
    create: {
      id: TEST_FIXTURE_IDS.customer,
      organizationName: "DEMO_MOCK CM1 R20-C1 customer",
      contactName: "CM1 R20-C1",
      dataClassification: "DEMO_MOCK",
      createdById: admin.id,
    },
    update: {
      createdById: admin.id,
    },
  });
  await prisma.project.upsert({
    where: { id: TEST_FIXTURE_IDS.project },
    create: {
      id: TEST_FIXTURE_IDS.project,
      projectCode: "DEMO-R20C1-PROJECT",
      customerId: TEST_FIXTURE_IDS.customer,
      name: "DEMO_MOCK CM1 R20-C1 project",
      address: "DEMO_MOCK isolated PostgreSQL validation",
      projectType: "OLD_BUILDING_ELEVATOR",
      status: "DRAFT",
      dataClassification: "DEMO_MOCK",
      createdById: admin.id,
    },
    update: {
      createdById: admin.id,
    },
  });
  await prisma.building.upsert({
    where: { id: TEST_FIXTURE_IDS.building },
    create: {
      id: TEST_FIXTURE_IDS.building,
      buildingCode: "DEMO-R20C1-BUILDING",
      projectId: TEST_FIXTURE_IDS.project,
      name: "DEMO_MOCK CM1 R20-C1 building",
      status: "DRAFT",
      dataClassification: "DEMO_MOCK",
      createdById: admin.id,
    },
    update: {
      createdById: admin.id,
    },
  });
  await prisma.installationUnit.upsert({
    where: { id: TEST_FIXTURE_IDS.installationUnit },
    create: {
      id: TEST_FIXTURE_IDS.installationUnit,
      unitCode: "DEMO-R20C1-UNIT",
      buildingId: TEST_FIXTURE_IDS.building,
      intendedLocation: "DEMO_MOCK CM1 R20-C1 unit",
      status: "PENDING_CONFIRMATION",
      dataClassification: "DEMO_MOCK",
      createdById: admin.id,
    },
    update: {
      createdById: admin.id,
    },
  });

  await prisma.customer.upsert({
    where: { id: TEST_FIXTURE_IDS.customer2 },
    create: {
      id: TEST_FIXTURE_IDS.customer2,
      organizationName: "DEMO_MOCK CM1 R20-C1 customer 2",
      contactName: "CM1 R20-C1",
      dataClassification: "DEMO_MOCK",
      createdById: admin.id,
    },
    update: {
      createdById: admin.id,
    },
  });
  await prisma.project.upsert({
    where: { id: TEST_FIXTURE_IDS.project2 },
    create: {
      id: TEST_FIXTURE_IDS.project2,
      projectCode: "DEMO-R20C1-PROJECT-2",
      customerId: TEST_FIXTURE_IDS.customer2,
      name: "DEMO_MOCK CM1 R20-C1 project 2",
      address: "DEMO_MOCK isolated PostgreSQL validation 2",
      projectType: "OLD_BUILDING_ELEVATOR",
      status: "DRAFT",
      dataClassification: "DEMO_MOCK",
      createdById: admin.id,
    },
    update: {
      createdById: admin.id,
    },
  });
  await prisma.building.upsert({
    where: { id: TEST_FIXTURE_IDS.building2 },
    create: {
      id: TEST_FIXTURE_IDS.building2,
      buildingCode: "DEMO-R20C1-BUILDING-2",
      projectId: TEST_FIXTURE_IDS.project2,
      name: "DEMO_MOCK CM1 R20-C1 building 2",
      status: "DRAFT",
      dataClassification: "DEMO_MOCK",
      createdById: admin.id,
    },
    update: {
      createdById: admin.id,
    },
  });
  await prisma.installationUnit.upsert({
    where: { id: TEST_FIXTURE_IDS.installationUnit2 },
    create: {
      id: TEST_FIXTURE_IDS.installationUnit2,
      unitCode: "DEMO-R20C1-UNIT-2",
      buildingId: TEST_FIXTURE_IDS.building2,
      intendedLocation: "DEMO_MOCK CM1 R20-C1 unit 2",
      status: "PENDING_CONFIRMATION",
      dataClassification: "DEMO_MOCK",
      createdById: admin.id,
    },
    update: {
      createdById: admin.id,
    },
  });

  console.log(
    JSON.stringify(
      {
        database: identity[0]?.database,
        role: identity[0]?.role,
        adminUsername,
        fixtureIds: TEST_FIXTURE_IDS,
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
