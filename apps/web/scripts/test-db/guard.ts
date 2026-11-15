import fs from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { parse as parseEnv } from "dotenv";

import {
  readTestEnvironment,
  workspaceRoot,
  type TestEnvironment,
} from "./env.js";

export type DatabaseGuardMode = "init" | "reset" | "verify";

export interface GuardResult {
  databaseName: string;
  databaseRole: string;
  markerVerified: boolean;
  developmentUrlDiffers: boolean;
  developmentConnectBlocked: boolean;
  developmentRoleMembershipBlocked: boolean;
}

const DEVELOPMENT_DATABASE_NAME = "elevator_advisor";
const DEVELOPMENT_DATABASE_ROLE = "elevator_app";

export class TestDatabaseIdentityError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "TestDatabaseIdentityError";
  }
}

export function assertDevelopmentDatabaseAclIsolation(input: {
  canConnectDevelopment: boolean;
  memberOfDevelopmentRole: boolean;
}): void {
  if (input.canConnectDevelopment) {
    throw new TestDatabaseIdentityError(
      "TEST_ROLE_CAN_CONNECT_DEVELOPMENT",
    );
  }

  if (input.memberOfDevelopmentRole) {
    throw new TestDatabaseIdentityError(
      "TEST_ROLE_MEMBER_OF_DEVELOPMENT_ROLE",
    );
  }
}

function assertTestUrlIdentity(env: TestEnvironment): URL {
  const testUrl = new URL(env.TEST_DATABASE_URL);
  const databaseName = decodeURIComponent(testUrl.pathname.slice(1));
  const role = decodeURIComponent(testUrl.username);

  if (databaseName !== env.TEST_DATABASE_NAME) {
    throw new TestDatabaseIdentityError(
      "TEST_DATABASE_NAME_MISMATCH",
    );
  }

  if (role !== env.TEST_DATABASE_ROLE) {
    throw new TestDatabaseIdentityError(
      "TEST_DATABASE_ROLE_MISMATCH",
    );
  }

  return testUrl;
}

async function assertDevelopmentUrlDiffers(
  env: TestEnvironment,
): Promise<boolean> {
  try {
    const developmentEnv = parseEnv(
      await fs.readFile(path.join(workspaceRoot, ".env"), "utf8"),
    );

    if (
      developmentEnv.DATABASE_URL &&
      developmentEnv.DATABASE_URL === env.TEST_DATABASE_URL
    ) {
      throw new TestDatabaseIdentityError(
        "TEST_DATABASE_EQUALS_DEVELOPMENT",
      );
    }
  } catch (error) {
    if (error instanceof TestDatabaseIdentityError) {
      throw error;
    }
    throw new TestDatabaseIdentityError(
      "DEVELOPMENT_ENV_NOT_READABLE",
    );
  }

  return true;
}

export async function verifyTestDatabaseIdentity(
  mode: DatabaseGuardMode,
  env: TestEnvironment = readTestEnvironment(),
): Promise<GuardResult> {
  if (mode === "init" && !env.ALLOW_TEST_DB_INIT) {
    throw new TestDatabaseIdentityError("TEST_DB_INIT_NOT_ALLOWED");
  }

  if (mode === "reset" && !env.ALLOW_TEST_DB_RESET) {
    throw new TestDatabaseIdentityError("TEST_DB_RESET_NOT_ALLOWED");
  }

  assertTestUrlIdentity(env);
  const developmentUrlDiffers =
    await assertDevelopmentUrlDiffers(env);

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: env.TEST_DATABASE_URL,
      },
    },
  });

  try {
    const rows = await prisma.$queryRaw<
      Array<{ databaseName: string; databaseRole: string }>
    >`
      SELECT
        current_database() AS "databaseName",
        current_user AS "databaseRole"
    `;
    const actual = rows[0];

    if (!actual) {
      throw new TestDatabaseIdentityError(
        "TEST_DATABASE_CONTEXT_UNAVAILABLE",
      );
    }

    if (actual.databaseName !== env.TEST_DATABASE_NAME) {
      throw new TestDatabaseIdentityError(
        "CURRENT_DATABASE_MISMATCH",
      );
    }

    if (actual.databaseRole !== env.TEST_DATABASE_ROLE) {
      throw new TestDatabaseIdentityError("CURRENT_ROLE_MISMATCH");
    }

    const aclRows = await prisma.$queryRaw<
      Array<{
        canConnectDevelopment: boolean;
        memberOfDevelopmentRole: boolean;
      }>
    >`
      SELECT
        has_database_privilege(
          current_user,
          ${DEVELOPMENT_DATABASE_NAME},
          'CONNECT'
        ) AS "canConnectDevelopment",
        pg_has_role(
          current_user,
          ${DEVELOPMENT_DATABASE_ROLE},
          'MEMBER'
        ) AS "memberOfDevelopmentRole"
    `;
    const acl = aclRows[0];

    if (!acl) {
      throw new TestDatabaseIdentityError(
        "TEST_DATABASE_ACL_UNAVAILABLE",
      );
    }

    assertDevelopmentDatabaseAclIsolation({
      canConnectDevelopment: acl.canConnectDevelopment,
      memberOfDevelopmentRole: acl.memberOfDevelopmentRole,
    });

    const tableRows = await prisma.$queryRaw<
      Array<{ exists: boolean }>
    >`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'system_metadata'
      ) AS "exists"
    `;
    const metadataTableExists = tableRows[0]?.exists === true;
    let markerVerified = false;

    if (metadataTableExists) {
      const markerRows = await prisma.$queryRaw<
        Array<{ value: unknown }>
      >`
        SELECT "value"
        FROM "system_metadata"
        WHERE "key" = 'test_database_marker'
        LIMIT 1
      `;
      markerVerified =
        markerRows[0]?.value === env.TEST_DATABASE_MARKER;
    }

    if (mode !== "init" && !markerVerified) {
      throw new TestDatabaseIdentityError(
        "TEST_DATABASE_MARKER_MISSING_OR_INVALID",
      );
    }

    return {
      databaseName: actual.databaseName,
      databaseRole: actual.databaseRole,
      markerVerified,
      developmentUrlDiffers,
      developmentConnectBlocked: true,
      developmentRoleMembershipBlocked: true,
    };
  } finally {
    await prisma.$disconnect();
  }
}
