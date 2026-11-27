import { Prisma, PrismaClient } from "@prisma/client";

export interface TriggerCatalogRow {
  triggerSchema: string;
  relationSchema: string;
  relationName: string;
  triggerName: string;
  functionSchema: string;
  functionName: string;
  functionOid: number;
  triggerFunctionOid: number;
  expectedFunctionOid: number | null;
  triggerType: number;
  enabled: string;
  deferrable: boolean;
  initiallyDeferred: boolean;
  constraintTrigger: boolean;
  updateColumns: string[];
}

export interface ExpectedTriggerCatalogRow {
  triggerSchema: string;
  relationSchema: string;
  relationName: string;
  triggerName: string;
  functionSchema: string;
  functionName: string;
  triggerType: number;
  enabled: "O";
  deferrable: boolean;
  initiallyDeferred: boolean;
  constraintTrigger: boolean;
  updateColumns: string[];
}

export interface TriggerCatalogFinding {
  code: string;
  triggerName: string;
  message: string;
}

export interface DecodedTriggerType {
  row: boolean;
  before: boolean;
  insteadOf: boolean;
  insert: boolean;
  delete: boolean;
  update: boolean;
  truncate: boolean;
}

export const PHASE41_EXPECTED_TRIGGERS: readonly ExpectedTriggerCatalogRow[] =
  [
    {
      triggerSchema: "public",
      relationSchema: "public",
      relationName: "file_upload_intent",
      triggerName: "p13_completed_intent_final_guard",
      functionSchema: "public",
      functionName: "p13_assert_completed_intent_final",
      triggerType: 17,
      enabled: "O",
      deferrable: true,
      initiallyDeferred: true,
      constraintTrigger: true,
      updateColumns: [],
    },
    {
      triggerSchema: "public",
      relationSchema: "public",
      relationName: "file",
      triggerName: "p13_file_provenance_scope_immutable",
      functionSchema: "public",
      functionName: "p13_protect_file_provenance_scope",
      triggerType: 19,
      enabled: "O",
      deferrable: false,
      initiallyDeferred: false,
      constraintTrigger: false,
      updateColumns: [
        "customerId",
        "projectId",
        "buildingId",
        "installationUnitId",
        "createdById",
        "createdByUploadIntentId",
      ],
    },
  ];

export function decodeTriggerType(
  triggerType: number,
): DecodedTriggerType {
  return {
    row: (triggerType & 1) === 1,
    before: (triggerType & 2) === 2,
    insteadOf: (triggerType & 64) === 64,
    insert: (triggerType & 4) === 4,
    delete: (triggerType & 8) === 8,
    update: (triggerType & 16) === 16,
    truncate: (triggerType & 32) === 32,
  };
}

export async function readTriggerCatalog(
  client: PrismaClient | Prisma.TransactionClient,
): Promise<TriggerCatalogRow[]> {
  return client.$queryRaw<TriggerCatalogRow[]>`
    SELECT
      trigger_namespace.nspname::text AS "triggerSchema",
      relation_namespace.nspname::text AS "relationSchema",
      relation.relname::text AS "relationName",
      trigger.tgname::text AS "triggerName",
      function_namespace.nspname::text AS "functionSchema",
      trigger_function.proname::text AS "functionName",
      trigger_function.oid::int AS "functionOid",
      trigger.tgfoid::int AS "triggerFunctionOid",
      CASE trigger.tgname
        WHEN 'p13_completed_intent_final_guard'
          THEN to_regprocedure(
            'public.p13_assert_completed_intent_final()'
          )::oid::int
        WHEN 'p13_file_provenance_scope_immutable'
          THEN to_regprocedure(
            'public.p13_protect_file_provenance_scope()'
          )::oid::int
      END AS "expectedFunctionOid",
      trigger.tgtype::int AS "triggerType",
      trigger.tgenabled::text AS "enabled",
      trigger.tgdeferrable AS "deferrable",
      trigger.tginitdeferred AS "initiallyDeferred",
      (trigger.tgconstraint <> 0) AS "constraintTrigger",
      ARRAY(
        SELECT attribute.attname::text
        FROM unnest(trigger.tgattr)
          WITH ORDINALITY AS columns(attnum, ordinality)
        JOIN pg_attribute attribute
          ON attribute.attrelid = trigger.tgrelid
         AND attribute.attnum = columns.attnum
        ORDER BY columns.ordinality
      ) AS "updateColumns"
    FROM pg_trigger trigger
    JOIN pg_class relation
      ON relation.oid = trigger.tgrelid
    JOIN pg_namespace relation_namespace
      ON relation_namespace.oid = relation.relnamespace
    JOIN pg_namespace trigger_namespace
      ON trigger_namespace.oid = relation.relnamespace
    JOIN pg_proc trigger_function
      ON trigger_function.oid = trigger.tgfoid
    JOIN pg_namespace function_namespace
      ON function_namespace.oid = trigger_function.pronamespace
    WHERE NOT trigger.tgisinternal
      AND trigger.tgname IN (
        'p13_completed_intent_final_guard',
        'p13_file_provenance_scope_immutable',
        'p13_completed_append_current_guard'
      )
    ORDER BY trigger.tgname
  `;
}

export function validateTriggerCatalog(
  rows: readonly TriggerCatalogRow[],
): TriggerCatalogFinding[] {
  const findings: TriggerCatalogFinding[] = [];
  const byName = new Map(rows.map((row) => [row.triggerName, row]));

  for (const expected of PHASE41_EXPECTED_TRIGGERS) {
    const actual = byName.get(expected.triggerName);
    if (!actual) {
      findings.push({
        code: "TRIGGER_MISSING",
        triggerName: expected.triggerName,
        message: "Expected Trigger is absent",
      });
      continue;
    }
    const compare = (
      code: string,
      expectedValue: unknown,
      actualValue: unknown,
    ) => {
      if (JSON.stringify(expectedValue) !== JSON.stringify(actualValue)) {
        findings.push({
          code,
          triggerName: expected.triggerName,
          message: `expected=${JSON.stringify(expectedValue)} actual=${JSON.stringify(actualValue)}`,
        });
      }
    };

    compare(
      "TRIGGER_SCHEMA_MISMATCH",
      expected.triggerSchema,
      actual.triggerSchema,
    );
    compare(
      "TRIGGER_RELATION_SCHEMA_MISMATCH",
      expected.relationSchema,
      actual.relationSchema,
    );
    compare(
      "TRIGGER_RELATION_MISMATCH",
      expected.relationName,
      actual.relationName,
    );
    compare(
      "TRIGGER_FUNCTION_SCHEMA_MISMATCH",
      expected.functionSchema,
      actual.functionSchema,
    );
    compare(
      "TRIGGER_FUNCTION_MISMATCH",
      expected.functionName,
      actual.functionName,
    );
    compare(
      "TRIGGER_FUNCTION_OID_MISMATCH",
      actual.expectedFunctionOid,
      actual.triggerFunctionOid,
    );
    compare(
      "TRIGGER_TYPE_MISMATCH",
      expected.triggerType,
      actual.triggerType,
    );
    compare(
      "TRIGGER_ENABLED_MISMATCH",
      expected.enabled,
      actual.enabled,
    );
    compare(
      "TRIGGER_DEFERRABLE_MISMATCH",
      expected.deferrable,
      actual.deferrable,
    );
    compare(
      "TRIGGER_INITIALLY_DEFERRED_MISMATCH",
      expected.initiallyDeferred,
      actual.initiallyDeferred,
    );
    compare(
      "TRIGGER_CONSTRAINT_MISMATCH",
      expected.constraintTrigger,
      actual.constraintTrigger,
    );
    compare(
      "TRIGGER_UPDATE_COLUMNS_MISMATCH",
      expected.updateColumns,
      actual.updateColumns,
    );

    const decoded = decodeTriggerType(actual.triggerType);
    compare(
      "TRIGGER_EVENT_MASK_MISMATCH",
      {
        row: true,
        before: expected.triggerType === 19,
        insteadOf: false,
        insert: false,
        delete: false,
        update: true,
        truncate: false,
      },
      decoded,
    );
  }

  if (byName.has("p13_completed_append_current_guard")) {
    findings.push({
      code: "LEGACY_TRIGGER_PRESENT",
      triggerName: "p13_completed_append_current_guard",
      message: "Legacy completion Trigger must be absent",
    });
  }
  return findings;
}

export function assertTriggerCatalog(
  rows: readonly TriggerCatalogRow[],
): void {
  const findings = validateTriggerCatalog(rows);
  if (findings.length > 0) {
    throw new Error(
      `PHASE41_TRIGGER_CATALOG_INVALID ${JSON.stringify(findings)}`,
    );
  }
}
