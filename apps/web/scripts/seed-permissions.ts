import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";

import {
  PERMISSION_DESCRIPTIONS,
  SYSTEM_ADMIN_ROLE,
} from "../src/modules/access/permissions";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, "../../..");
loadEnv({ path: path.join(workspaceRoot, ".env") });

const prisma = new PrismaClient();

async function seedPermissions(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const adminRole = await tx.role.findUnique({
      where: { code: SYSTEM_ADMIN_ROLE },
    });

    if (!adminRole) {
      throw new Error("SYSTEM_ADMIN role must exist before syncing permissions");
    }

    for (const [code, description] of Object.entries(
      PERMISSION_DESCRIPTIONS,
    )) {
      await tx.permission.upsert({
        where: { code },
        create: { code, description },
        update: { description },
      });

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
  });

  console.log(
    `Permission catalog synced: count=${Object.keys(PERMISSION_DESCRIPTIONS).length}, role=${SYSTEM_ADMIN_ROLE}`,
  );
}

seedPermissions()
  .catch((error: unknown) => {
    console.error(
      `Permission seed failed: ${error instanceof Error ? error.name : "UnknownError"}`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
