import { Prisma, PrismaClient } from "@prisma/client";

import {
  readTriggerCatalog,
  validateTriggerCatalog,
} from "../../tests/helpers/phase41-trigger-catalog.js";

const databaseUrl = process.env.CM1_R22_MIGRATOR_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("CM1_R22_MIGRATOR_DATABASE_URL is required");
}

const prisma = new PrismaClient({
  datasources: {
    db: { url: databaseUrl },
  },
});

const ROLLBACK_MARKER = "R22_FAULT_ROLLBACK";

async function assertBaseline(): Promise<void> {
  const rows = await readTriggerCatalog(prisma);
  const findings = validateTriggerCatalog(rows);
  if (findings.length > 0) {
    throw new Error(
      `CATALOG_BASELINE_INVALID ${JSON.stringify(findings)}`,
    );
  }
}

async function runFault(input: {
  name: string;
  expectedCode: string;
  mutate: (client: Prisma.TransactionClient) => Promise<void>;
}): Promise<void> {
  await assertBaseline();
  let findings: ReturnType<typeof validateTriggerCatalog> = [];
  let mutationCompleted = false;

  try {
    await prisma.$transaction(async (tx) => {
      await input.mutate(tx);
      mutationCompleted = true;
      findings = validateTriggerCatalog(
        await readTriggerCatalog(tx),
      );
      throw new Error(ROLLBACK_MARKER);
    });
  } catch (error) {
    if (
      !(error instanceof Error) ||
      error.message !== ROLLBACK_MARKER
    ) {
      throw error;
    }
  }

  const finding = findings.find(
    (candidate) => candidate.code === input.expectedCode,
  );
  console.log(
    JSON.stringify({
      event: "r22.catalog_fault",
      name: input.name,
      mutationCompleted,
      expectedCode: input.expectedCode,
      finding,
      allFindings: findings,
    }),
  );
  if (!mutationCompleted || !finding) {
    throw new Error(
      `CATALOG_FAULT_NOT_DETECTED name=${input.name} expected=${input.expectedCode}`,
    );
  }
  await assertBaseline();
}

async function main(): Promise<void> {
  const identity = await prisma.$queryRaw<
    Array<{
      database: string;
      role: string;
      host: string | null;
      port: number | null;
    }>
  >`
    SELECT
      current_database()::text AS database,
      current_user::text AS role,
      host(inet_server_addr()) AS host,
      inet_server_port() AS port
  `;
  console.log(
    JSON.stringify({
      event: "r22.catalog_fault_database_identity",
      actual: identity[0],
    }),
  );

  await runFault({
    name: "wrong_function",
    expectedCode: "TRIGGER_FUNCTION_MISMATCH",
    mutate: async (client) => {
      await client.$executeRawUnsafe(`
        DROP TRIGGER "p13_completed_intent_final_guard"
        ON "file_upload_intent";
      `);
      await client.$executeRawUnsafe(`
        CREATE FUNCTION "p13_r22_wrong_trigger"()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          RETURN NEW;
        END;
        $$;
      `);
      await client.$executeRawUnsafe(`
        CREATE TRIGGER "p13_completed_intent_final_guard"
        AFTER UPDATE ON "file_upload_intent"
        FOR EACH ROW
        EXECUTE FUNCTION "p13_r22_wrong_trigger"();
      `);
    },
  });

  await runFault({
    name: "reduced_update_columns",
    expectedCode: "TRIGGER_UPDATE_COLUMNS_MISMATCH",
    mutate: async (client) => {
      await client.$executeRawUnsafe(`
        DROP TRIGGER "p13_file_provenance_scope_immutable"
        ON "file";
      `);
      await client.$executeRawUnsafe(`
        CREATE TRIGGER "p13_file_provenance_scope_immutable"
        BEFORE UPDATE OF "customerId" ON "file"
        FOR EACH ROW
        EXECUTE FUNCTION "p13_protect_file_provenance_scope"();
      `);
    },
  });

  await runFault({
    name: "replica_only_enabled",
    expectedCode: "TRIGGER_ENABLED_MISMATCH",
    mutate: async (client) => {
      await client.$executeRawUnsafe(`
        ALTER TABLE "file"
        ENABLE REPLICA TRIGGER
          "p13_file_provenance_scope_immutable";
      `);
    },
  });

  await runFault({
    name: "wrong_relation",
    expectedCode: "TRIGGER_RELATION_MISMATCH",
    mutate: async (client) => {
      await client.$executeRawUnsafe(`
        DROP TRIGGER "p13_file_provenance_scope_immutable"
        ON "file";
      `);
      await client.$executeRawUnsafe(`
        CREATE TRIGGER "p13_file_provenance_scope_immutable"
        BEFORE UPDATE OF "name" ON "project"
        FOR EACH ROW
        EXECUTE FUNCTION "p13_protect_file_provenance_scope"();
      `);
    },
  });

  await runFault({
    name: "completion_not_deferrable",
    expectedCode: "TRIGGER_DEFERRABLE_MISMATCH",
    mutate: async (client) => {
      await client.$executeRawUnsafe(`
        DROP TRIGGER "p13_completed_intent_final_guard"
        ON "file_upload_intent";
      `);
      await client.$executeRawUnsafe(`
        CREATE TRIGGER "p13_completed_intent_final_guard"
        AFTER UPDATE ON "file_upload_intent"
        FOR EACH ROW
        EXECUTE FUNCTION "p13_assert_completed_intent_final"();
      `);
    },
  });
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
