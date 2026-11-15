import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

import {
  PERMISSIONS,
  SYSTEM_ADMIN_ROLE,
} from "../src/modules/access/permissions";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, "../../..");
loadEnv({ path: path.join(workspaceRoot, ".env") });

const seedEnvSchema = z.object({
  DEV_ADMIN_USERNAME: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[A-Za-z0-9_]+$/),
  DEV_ADMIN_PASSWORD: z
    .string()
    .min(12, "DEV_ADMIN_PASSWORD must contain at least 12 characters")
    .max(128)
    .refine(
      (value) => !value.startsWith("REPLACE_WITH_"),
      "DEV_ADMIN_PASSWORD must be replaced locally",
    ),
  DEV_ADMIN_NAME: z.string().trim().min(1).max(120).default("开发管理员"),
});

function readSeedEnv() {
  const result = seedEnvSchema.safeParse(process.env);

  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ].join(", ");
    throw new Error(
      `Invalid development seed environment fields: ${fields}`,
    );
  }

  return result.data;
}

const permissionDescriptions: Record<string, string> = {
  [PERMISSIONS.CUSTOMER_READ]: "查看客户资料",
  [PERMISSIONS.CUSTOMER_MANAGE]: "创建和维护客户资料",
  [PERMISSIONS.PROJECT_READ]: "查看项目、建筑和安装单元",
  [PERMISSIONS.PROJECT_MANAGE]: "创建和维护项目、建筑和安装单元",
  [PERMISSIONS.AUDIT_READ]: "查看审计日志",
};

let prisma: PrismaClient | undefined;

async function seed(): Promise<void> {
  const seedEnv = readSeedEnv();
  const username = seedEnv.DEV_ADMIN_USERNAME.toLowerCase();
  const email = `${username}@dev.invalid`;
  prisma = new PrismaClient();
  const passwordHash = await hashPassword(seedEnv.DEV_ADMIN_PASSWORD);

  await prisma.$transaction(async (tx) => {
    for (const [code, description] of Object.entries(permissionDescriptions)) {
      await tx.permission.upsert({
        where: { code },
        create: { code, description },
        update: { description },
      });
    }

    const role = await tx.role.upsert({
      where: { code: SYSTEM_ADMIN_ROLE },
      create: {
        code: SYSTEM_ADMIN_ROLE,
        name: "系统管理员",
        description: "开发环境预置管理员，仅拥有 Phase 2 管理权限。",
        isSystem: true,
      },
      update: {
        name: "系统管理员",
        isSystem: true,
      },
    });

    for (const code of Object.keys(permissionDescriptions)) {
      await tx.rolePermission.upsert({
        where: {
          roleId_permissionCode: {
            roleId: role.id,
            permissionCode: code,
          },
        },
        create: {
          roleId: role.id,
          permissionCode: code,
        },
        update: {},
      });
    }

    const existingUser = await tx.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    const user = existingUser
      ? await tx.user.update({
          where: { id: existingUser.id },
          data: {
            name: seedEnv.DEV_ADMIN_NAME,
            email,
            emailVerified: true,
            username,
            displayUsername: seedEnv.DEV_ADMIN_USERNAME,
          },
        })
      : await tx.user.create({
          data: {
            id: randomUUID(),
            name: seedEnv.DEV_ADMIN_NAME,
            email,
            emailVerified: true,
            username,
            displayUsername: seedEnv.DEV_ADMIN_USERNAME,
          },
        });

    const credentialAccount = await tx.account.findFirst({
      where: {
        userId: user.id,
        providerId: "credential",
      },
    });

    if (credentialAccount) {
      await tx.account.update({
        where: { id: credentialAccount.id },
        data: {
          accountId: user.id,
          password: passwordHash,
        },
      });
    } else {
      await tx.account.create({
        data: {
          id: randomUUID(),
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: passwordHash,
        },
      });
    }

    const existingAssignment = await tx.userRole.findFirst({
      where: {
        userId: user.id,
        roleId: role.id,
        scope: "GLOBAL",
        projectId: null,
      },
    });

    if (!existingAssignment) {
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
          scope: "GLOBAL",
        },
      });
    }
  });

  console.log(
    `Development administrator seeded: username=${username}, role=${SYSTEM_ADMIN_ROLE}`,
  );
}

seed()
  .catch((error: unknown) => {
    console.error(
      `Development seed failed: ${error instanceof Error ? error.name : "UnknownError"}`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma?.$disconnect();
  });
