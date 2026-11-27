import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  assertTriggerCatalog,
  PHASE41_EXPECTED_TRIGGERS,
  readTriggerCatalog,
  validateTriggerCatalog,
} from "../helpers/phase41-trigger-catalog";
import {
  assertPostgresIdentity,
  R26_EXPECTED_CATALOG_IDENTITY,
  readPostgresIdentity,
} from "../helpers/postgres-identity";

const prisma = new PrismaClient();

beforeAll(async () => {
  const identity = await readPostgresIdentity(prisma);
  console.log(
    JSON.stringify({
      event: "r26.catalog_test_database_identity",
      expected: R26_EXPECTED_CATALOG_IDENTITY,
      actual: identity,
    }),
  );
  assertPostgresIdentity(identity, R26_EXPECTED_CATALOG_IDENTITY);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("R26 phase-41 Trigger catalog identity", () => {
  it("binds every critical Trigger to the expected function and event mask", async () => {
    const rows = await readTriggerCatalog(prisma);
    const criticalRows = rows.filter((row) =>
      PHASE41_EXPECTED_TRIGGERS.some(
        (expected) => expected.triggerName === row.triggerName,
      ),
    );

    console.log(
      JSON.stringify({
        event: "r26.phase41_trigger_catalog",
        rows: criticalRows,
      }),
    );
    expect(criticalRows).toHaveLength(2);
    expect(validateTriggerCatalog(rows)).toEqual([]);
    expect(() => assertTriggerCatalog(rows)).not.toThrow();
  });
});
