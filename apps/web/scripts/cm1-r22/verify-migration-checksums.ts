import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.CM1_R22_MIGRATOR_DATABASE_URL;
const migrationsRoot =
  process.env.CM1_R22_MIGRATION_ROOT ??
  "D:\\AI-Elevator-Advisor-CM1-R22\\migration-harness\\prisma\\migrations";

if (!databaseUrl) {
  throw new Error("CM1_R22_MIGRATOR_DATABASE_URL is required");
}

const prisma = new PrismaClient({
  datasources: {
    db: { url: databaseUrl },
  },
});

async function main(): Promise<void> {
  const rows = await prisma.$queryRaw<
    Array<{
      migrationName: string;
      checksum: string;
      finishedAt: Date | null;
    }>
  >`
    SELECT
      migration_name AS "migrationName",
      checksum,
      finished_at AS "finishedAt"
    FROM _prisma_migrations
    ORDER BY started_at
  `;
  const byName = new Map(
    rows.map((row) => [row.migrationName, row]),
  );
  const results: Array<{
    migration: string;
    databaseChecksum: string;
    fileSha256: string;
    match: boolean;
    finished: boolean;
  }> = [];

  for (const row of rows) {
    const migrationFile = path.join(
      migrationsRoot,
      row.migrationName,
      "migration.sql",
    );
    const fileBytes = await readFile(migrationFile);
    const fileSha256 = createHash("sha256")
      .update(fileBytes)
      .digest("hex");
    results.push({
      migration: row.migrationName,
      databaseChecksum: row.checksum.toLowerCase(),
      fileSha256,
      match: row.checksum.toLowerCase() === fileSha256,
      finished: row.finishedAt !== null,
    });
  }

  const missing = [...byName.keys()].filter(
    (name) => !results.some((result) => result.migration === name),
  );
  const summary = {
    algorithm:
      "Prisma Migration checksum is SHA-256 over migration.sql bytes",
    migrationCount: rows.length,
    allFinished: results.every((result) => result.finished),
    allChecksumsMatch: results.every((result) => result.match),
    missing,
    results,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (
    !summary.allFinished ||
    !summary.allChecksumsMatch ||
    missing.length > 0
  ) {
    process.exitCode = 1;
  }
}

main()
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
