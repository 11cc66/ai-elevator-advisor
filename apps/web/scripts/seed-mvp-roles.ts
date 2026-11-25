import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";

import {
  PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
} from "../src/modules/access/permissions";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, "../../..");
loadEnv({ path: path.join(workspaceRoot, ".env") });

const prisma = new PrismaClient();

const roles = [
  {
    code: "CUSTOMER_ACCOUNT",
    name: "客户账户",
    permissions: [PERMISSIONS.PROJECT_CREATE],
  },
  {
    code: "CUSTOMER",
    name: "客户",
    permissions: [
      PERMISSIONS.PROJECT_READ,
      PERMISSIONS.ADVISOR_USE,
      PERMISSIONS.CATALOG_READ,
      PERMISSIONS.SELECTION_RUN,
      PERMISSIONS.SALES_HANDOFF_CREATE,
    ],
  },
  {
    code: "SALES",
    name: "销售",
    permissions: [
      PERMISSIONS.PROJECT_READ,
      PERMISSIONS.CATALOG_READ,
      PERMISSIONS.SELECTION_RUN,
      PERMISSIONS.SALES_MANAGE,
    ],
  },
  {
    code: "PRODUCT_ADMIN",
    name: "产品管理员",
    permissions: [
      PERMISSIONS.CATALOG_READ,
      PERMISSIONS.CATALOG_MANAGE,
    ],
  },
] as const;

async function main(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const [code, description] of Object.entries(PERMISSION_DESCRIPTIONS)) {
      await tx.permission.upsert({
        where: { code },
        create: { code, description },
        update: { description },
      });
    }
    for (const definition of roles) {
      const role = await tx.role.upsert({
        where: { code: definition.code },
        create: {
          code: definition.code,
          name: definition.name,
          description: "Full MVP DEMO role",
          isSystem: true,
        },
        update: {
          name: definition.name,
          isSystem: true,
        },
      });
      for (const permission of definition.permissions) {
        await tx.rolePermission.upsert({
          where: {
            roleId_permissionCode: {
              roleId: role.id,
              permissionCode: permission,
            },
          },
          create: {
            roleId: role.id,
            permissionCode: permission,
          },
          update: {},
        });
      }
    }
  });
  console.log(
    JSON.stringify({
      event: "mvp_roles_seeded",
      roles: roles.map((role) => role.code),
    }),
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      `seed_mvp_roles_failed=${error instanceof Error ? error.name : "UnknownError"}`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
