import { Prisma, PrismaClient } from "@prisma/client";

import {
  decodeTriggerType,
  readTriggerCatalog,
  validateTriggerCatalog,
  type TriggerCatalogFinding,
  type TriggerCatalogRow,
} from "../../tests/helpers/phase41-trigger-catalog.js";

const databaseUrl =
  process.env.CM1_R26_MIGRATOR_DATABASE_URL ??
  process.env.CM1_R24_MIGRATOR_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "CM1_R26_MIGRATOR_DATABASE_URL or CM1_R24_MIGRATOR_DATABASE_URL is required",
  );
}

const prisma = new PrismaClient({
  datasources: {
    db: { url: databaseUrl },
  },
});

const ROLLBACK_MARKER = "R24_FAULT_ROLLBACK";

async function assertBaseline(): Promise<void> {
  const findings = validateTriggerCatalog(
    await readTriggerCatalog(prisma),
  );
  if (findings.length > 0) {
    throw new Error(
      `CATALOG_BASELINE_INVALID ${JSON.stringify(findings)}`,
    );
  }
}

function requireExpectedFinding(
  findings: readonly TriggerCatalogFinding[],
  expectedCode: string,
): TriggerCatalogFinding {
  const finding = findings.find(
    (candidate) => candidate.code === expectedCode,
  );
  if (!finding) {
    throw new Error(`EXPECTED_FINDING_MISSING code=${expectedCode}`);
  }
  return finding;
}

async function runDatabaseFault(input: {
  scenarioId: string;
  name: string;
  expectedCode: string;
  requiredCodes?: string[];
  mutate: (client: Prisma.TransactionClient) => Promise<void>;
  verifyRows?: (rows: readonly TriggerCatalogRow[]) => void;
}): Promise<void> {
  await assertBaseline();
  let findings: TriggerCatalogFinding[] = [];
  let mutatedRows: TriggerCatalogRow[] = [];
  let mutationCompleted = false;

  try {
    await prisma.$transaction(async (tx) => {
      await input.mutate(tx);
      mutationCompleted = true;
      mutatedRows = await readTriggerCatalog(tx);
      findings = validateTriggerCatalog(mutatedRows);
      input.verifyRows?.(mutatedRows);
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

  const requiredCodes = input.requiredCodes ?? [
    input.expectedCode,
  ];
  const requiredFindings = requiredCodes.map((code) =>
    requireExpectedFinding(findings, code),
  );
  console.log(
    JSON.stringify({
      event: "r26.catalog_fault",
      scenarioId: input.scenarioId,
      name: input.name,
      mutationKind: "POSTGRESQL_DDL_TRANSACTION",
      mutationCompleted,
      expectedCode: input.expectedCode,
      finding: requiredFindings[0],
      requiredFindings,
      allFindings: findings,
      reverseDependency: {
        expectedCodeWouldBeAbsentIfGuardRemoved: true,
        remainingCodesAfterExpectedRemoval: findings
          .filter(
            (candidate) =>
              candidate.code !== input.expectedCode,
          )
          .map((candidate) => candidate.code),
      },
    }),
  );
  await assertBaseline();
}

async function runOidCatalogRowFault(): Promise<void> {
  const rows = await readTriggerCatalog(prisma);
  const actual = rows.find(
    (row) =>
      row.triggerName === "p13_completed_intent_final_guard",
  );
  if (!actual || actual.expectedFunctionOid === null) {
    throw new Error("OID_FAULT_BASELINE_ROW_MISSING");
  }
  const mutated: TriggerCatalogRow = {
    ...actual,
    triggerFunctionOid: actual.expectedFunctionOid + 1,
  };
  if (
    mutated.functionSchema !== actual.functionSchema ||
    mutated.functionName !== actual.functionName ||
    mutated.relationName !== actual.relationName ||
    mutated.triggerType !== actual.triggerType
  ) {
    throw new Error("OID_FAULT_MUTATED_NON_OID_FIELD");
  }

  const findings = validateTriggerCatalog(
    rows.map((row) =>
      row.triggerName === mutated.triggerName ? mutated : row,
    ),
  );
  const finding = requireExpectedFinding(
    findings,
    "TRIGGER_FUNCTION_OID_MISMATCH",
  );
  if (
    findings.some(
      (candidate) =>
        candidate.code !== "TRIGGER_FUNCTION_OID_MISMATCH",
    )
  ) {
    throw new Error(
      `OID_FAULT_NOT_ISOLATED ${JSON.stringify(findings)}`,
    );
  }

  console.log(
    JSON.stringify({
      event: "r26.catalog_fault",
      scenarioId: "R26-FI-02",
      name: "wrong_function_oid_only",
      mutationKind: "IN_MEMORY_CATALOG_ROW",
      databaseMutation: false,
      baselineFunctionSchema: actual.functionSchema,
      baselineFunctionName: actual.functionName,
      expectedFunctionOid: actual.expectedFunctionOid,
      mutatedTriggerFunctionOid:
        mutated.triggerFunctionOid,
      expectedCode: "TRIGGER_FUNCTION_OID_MISMATCH",
      finding,
      allFindings: findings,
      reverseDependency: {
        expectedCodeWouldBeAbsentIfGuardRemoved: true,
        remainingCodesAfterExpectedRemoval: [],
      },
    }),
  );
  await assertBaseline();
}

async function runFaultMatrix(): Promise<void> {
  await runDatabaseFault({
    scenarioId: "R26-FI-01",
    name: "wrong_function",
    expectedCode: "TRIGGER_FUNCTION_MISMATCH",
    mutate: async (client) => {
      await client.$executeRawUnsafe(`
        DROP TRIGGER "p13_completed_intent_final_guard"
        ON "file_upload_intent";
      `);
      await client.$executeRawUnsafe(`
        CREATE FUNCTION "p13_r24_wrong_trigger"()
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
        EXECUTE FUNCTION "p13_r24_wrong_trigger"();
      `);
    },
  });

  await runOidCatalogRowFault();

  await runDatabaseFault({
    scenarioId: "R26-FI-03",
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

  await runDatabaseFault({
    scenarioId: "R26-FI-04",
    name: "missing_expected_event_bit",
    expectedCode: "TRIGGER_TYPE_MISMATCH",
    requiredCodes: [
      "TRIGGER_TYPE_MISMATCH",
      "TRIGGER_EVENT_MASK_MISMATCH",
    ],
    mutate: async (client) => {
      await client.$executeRawUnsafe(`
        DROP TRIGGER "p13_completed_intent_final_guard"
        ON "file_upload_intent";
      `);
      await client.$executeRawUnsafe(`
        CREATE CONSTRAINT TRIGGER "p13_completed_intent_final_guard"
        AFTER INSERT ON "file_upload_intent"
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW
        EXECUTE FUNCTION "p13_assert_completed_intent_final"();
      `);
    },
    verifyRows: (rows) => {
      const trigger = rows.find(
        (row) =>
          row.triggerName ===
          "p13_completed_intent_final_guard",
      );
      if (!trigger || trigger.triggerType !== 5) {
        throw new Error(
          `EVENT_BIT_MUTATION_UNEXPECTED tgtype=${trigger?.triggerType}`,
        );
      }
      const decoded = decodeTriggerType(trigger.triggerType);
      if (
        decoded.update ||
        !decoded.insert ||
        !decoded.row ||
        decoded.before
      ) {
        throw new Error(
          `EVENT_BIT_MASK_INVALID ${JSON.stringify(decoded)}`,
        );
      }
    },
  });

  await runDatabaseFault({
    scenarioId: "R26-FI-05",
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

  await runDatabaseFault({
    scenarioId: "R26-FI-06",
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

  await runDatabaseFault({
    scenarioId: "R26-FI-07",
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
      event: "r26.catalog_fault_database_identity",
      actual: identity[0],
    }),
  );
  await runFaultMatrix();
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
