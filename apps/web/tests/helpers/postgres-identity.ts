import type { Prisma, PrismaClient } from "@prisma/client";

export interface ExpectedPostgresIdentity {
  database: string;
  role: string;
  host: string;
  port: number;
}

export const R22_EXPECTED_DATABASE_IDENTITY: ExpectedPostgresIdentity = {
  database: "cm1_r22_v4v7",
  role: "cm1_r22_app",
  host: "127.0.0.1",
  port: 55440,
};

export const R24_EXPECTED_CATALOG_IDENTITY: ExpectedPostgresIdentity = {
  database: "cm1_r24_catalog",
  role: "cm1_r24_app",
  host: "127.0.0.1",
  port: 55441,
};

export const R26_EXPECTED_CATALOG_IDENTITY: ExpectedPostgresIdentity = {
  database: "cm1_r26_catalog",
  role: "cm1_r26_app",
  host: "127.0.0.1",
  port: 55442,
};

export interface ActualPostgresIdentity {
  database: string;
  role: string;
  host: string | null;
  port: number | null;
  configuredPort: string;
}

export async function readPostgresIdentity(
  client: PrismaClient | Prisma.TransactionClient,
): Promise<ActualPostgresIdentity> {
  const rows = await client.$queryRaw<
    Array<{
      database: string;
      role: string;
      host: string | null;
      port: number | null;
      configuredPort: string;
    }>
  >`
    SELECT
      current_database()::text AS database,
      current_user::text AS role,
      host(inet_server_addr()) AS host,
      inet_server_port() AS port,
      current_setting('port') AS "configuredPort"
  `;
  const identity = rows[0];
  if (!identity) {
    throw new Error("POSTGRES_IDENTITY_QUERY_EMPTY");
  }
  return identity;
}

export function assertPostgresIdentity(
  actual: ActualPostgresIdentity,
  expected: ExpectedPostgresIdentity,
): void {
  if (
    actual.database !== expected.database ||
    actual.role !== expected.role ||
    actual.host !== expected.host ||
    actual.port !== expected.port ||
    actual.configuredPort !== String(expected.port)
  ) {
    throw new Error(
      `POSTGRES_IDENTITY_MISMATCH expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`,
    );
  }
}
