import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

import {
  PERMISSIONS,
  SYSTEM_ADMIN_ROLE,
} from "../../src/modules/access/permissions.js";
import type { TestEnvironment } from "./env.js";

const CUSTOMER_ROLE = "CUSTOMER";
const TEST_CUSTOMER_ID = "phase3_test_customer";
const TEST_PROJECT_ID = "phase3_test_project";
const TEST_BUILDING_ID = "phase3_test_building";
const TEST_UNIT_ID = "phase3_test_unit";

const permissionDescriptions: Record<string, string> = {
  [PERMISSIONS.CUSTOMER_READ]: "查看客户资料",
  [PERMISSIONS.CUSTOMER_MANAGE]: "创建和维护客户资料",
  [PERMISSIONS.PROJECT_READ]: "查看项目、建筑和安装单元",
  [PERMISSIONS.PROJECT_MANAGE]: "创建和维护项目、建筑和安装单元",
  [PERMISSIONS.AUDIT_READ]: "查看审计日志",
};

async function ensureCredentialAccount(
  prisma: PrismaClient,
  userId: string,
  password: string,
): Promise<void> {
  const passwordHash = await hashPassword(password);
  const account = await prisma.account.findFirst({
    where: {
      userId,
      providerId: "credential",
    },
  });

  if (account) {
    await prisma.account.update({
      where: { id: account.id },
      data: {
        accountId: userId,
        password: passwordHash,
      },
    });
    return;
  }

  await prisma.account.create({
    data: {
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
    },
  });
}

export async function seedTestDatabase(
  env: TestEnvironment,
): Promise<void> {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: env.TEST_DATABASE_URL,
      },
    },
  });
  const adminUsername = env.TEST_ADMIN_USERNAME.toLowerCase();
  const customerUsername =
    env.TEST_CUSTOMER_USERNAME.toLowerCase();

  try {
    await prisma.systemMetadata.upsert({
      where: { key: "test_database_marker" },
      create: {
        key: "test_database_marker",
        value: env.TEST_DATABASE_MARKER,
      },
      update: {
        value: env.TEST_DATABASE_MARKER,
      },
    });

    await prisma.$transaction(async (tx) => {
      for (const [code, description] of Object.entries(
        permissionDescriptions,
      )) {
        await tx.permission.upsert({
          where: { code },
          create: { code, description },
          update: { description },
        });
      }

      const adminRole = await tx.role.upsert({
        where: { code: SYSTEM_ADMIN_ROLE },
        create: {
          code: SYSTEM_ADMIN_ROLE,
          name: "测试系统管理员",
          description: "Phase 3 隔离测试环境管理员。",
          isSystem: true,
        },
        update: {
          name: "测试系统管理员",
          isSystem: true,
        },
      });

      for (const code of Object.keys(permissionDescriptions)) {
        await tx.rolePermission.upsert({
          where: {
            roleId_permissionCode: {
              roleId: adminRole.id,
              permissionCode: code,
            },
          },
          create: {
            roleId: adminRole.id,
            permissionCode: code,
          },
          update: {},
        });
      }

      const customerRole = await tx.role.upsert({
        where: { code: CUSTOMER_ROLE },
        create: {
          code: CUSTOMER_ROLE,
          name: "测试客户",
          description:
            "仅能访问 Phase 3 测试项目范围的开发测试角色。",
          isSystem: true,
        },
        update: {
          name: "测试客户",
          isSystem: true,
        },
      });

      await tx.rolePermission.upsert({
        where: {
          roleId_permissionCode: {
            roleId: customerRole.id,
            permissionCode: PERMISSIONS.PROJECT_READ,
          },
        },
        create: {
          roleId: customerRole.id,
          permissionCode: PERMISSIONS.PROJECT_READ,
        },
        update: {},
      });

      const admin = await tx.user.upsert({
        where: { email: `${adminUsername}@test.invalid` },
        create: {
          id: randomUUID(),
          name: env.TEST_ADMIN_NAME,
          email: `${adminUsername}@test.invalid`,
          emailVerified: true,
          username: adminUsername,
          displayUsername: env.TEST_ADMIN_USERNAME,
        },
        update: {
          name: env.TEST_ADMIN_NAME,
          username: adminUsername,
          displayUsername: env.TEST_ADMIN_USERNAME,
          emailVerified: true,
        },
      });

      const customerUser = await tx.user.upsert({
        where: { email: `${customerUsername}@test.invalid` },
        create: {
          id: randomUUID(),
          name: env.TEST_CUSTOMER_NAME,
          email: `${customerUsername}@test.invalid`,
          emailVerified: true,
          username: customerUsername,
          displayUsername: env.TEST_CUSTOMER_USERNAME,
        },
        update: {
          name: env.TEST_CUSTOMER_NAME,
          username: customerUsername,
          displayUsername: env.TEST_CUSTOMER_USERNAME,
          emailVerified: true,
        },
      });

      await ensureCredentialAccount(
        tx as PrismaClient,
        admin.id,
        env.TEST_ADMIN_PASSWORD,
      );
      await ensureCredentialAccount(
        tx as PrismaClient,
        customerUser.id,
        env.TEST_CUSTOMER_PASSWORD,
      );

      const customer = await tx.customer.upsert({
        where: { id: TEST_CUSTOMER_ID },
        create: {
          id: TEST_CUSTOMER_ID,
          organizationName: "DEMO_PHASE3 隔离测试客户",
          contactName: env.TEST_CUSTOMER_NAME,
          contactPhone: "000-0000-DEMO",
          dataClassification: "DEMO_MOCK",
          createdById: admin.id,
        },
        update: {
          organizationName: "DEMO_PHASE3 隔离测试客户",
          contactName: env.TEST_CUSTOMER_NAME,
          createdById: admin.id,
        },
      });

      const project = await tx.project.upsert({
        where: { id: TEST_PROJECT_ID },
        create: {
          id: TEST_PROJECT_ID,
          projectCode: "DEMO-PHASE3-TEST-PROJECT",
          customerId: customer.id,
          name: "DEMO_PHASE3 隔离测试项目",
          address: "DEMO_PHASE3 测试地址",
          projectType: "OLD_BUILDING_ELEVATOR",
          status: "DRAFT",
          dataClassification: "DEMO_MOCK",
          createdById: admin.id,
        },
        update: {
          customerId: customer.id,
          name: "DEMO_PHASE3 隔离测试项目",
          address: "DEMO_PHASE3 测试地址",
          createdById: admin.id,
        },
      });

      const building = await tx.building.upsert({
        where: { id: TEST_BUILDING_ID },
        create: {
          id: TEST_BUILDING_ID,
          buildingCode: "DEMO-PHASE3-TEST-BUILDING",
          projectId: project.id,
          name: "DEMO_PHASE3 测试建筑",
          usageType: "住宅",
          status: "DRAFT",
          dataClassification: "DEMO_MOCK",
          createdById: admin.id,
        },
        update: {
          projectId: project.id,
          name: "DEMO_PHASE3 测试建筑",
          createdById: admin.id,
        },
      });

      await tx.installationUnit.upsert({
        where: { id: TEST_UNIT_ID },
        create: {
          id: TEST_UNIT_ID,
          unitCode: "DEMO-PHASE3-TEST-UNIT",
          buildingId: building.id,
          intendedLocation: "DEMO_PHASE3 测试位置",
          status: "PENDING_CONFIRMATION",
          dataClassification: "DEMO_MOCK",
          createdById: admin.id,
        },
        update: {
          buildingId: building.id,
          intendedLocation: "DEMO_PHASE3 测试位置",
          createdById: admin.id,
        },
      });

      const adminAssignment = await tx.userRole.findFirst({
        where: {
          userId: admin.id,
          roleId: adminRole.id,
          scope: "GLOBAL",
          projectId: null,
        },
      });

      if (!adminAssignment) {
        await tx.userRole.create({
          data: {
            userId: admin.id,
            roleId: adminRole.id,
            scope: "GLOBAL",
          },
        });
      }

      const customerAssignment = await tx.userRole.findFirst({
        where: {
          userId: customerUser.id,
          roleId: customerRole.id,
          scope: "PROJECT",
          projectId: project.id,
        },
      });

      if (!customerAssignment) {
        await tx.userRole.create({
          data: {
            userId: customerUser.id,
            roleId: customerRole.id,
            scope: "PROJECT",
            projectId: project.id,
          },
        });
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}

export const TEST_FIXTURE_IDS = {
  customer: TEST_CUSTOMER_ID,
  project: TEST_PROJECT_ID,
  building: TEST_BUILDING_ID,
  installationUnit: TEST_UNIT_ID,
} as const;
