import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BarrierResetError,
  BarrierTimeoutError,
  buildFixture,
  DatabaseStepError,
  DatabaseTestHarness,
  executeFixturePlan,
  extractDatabaseError,
  formatHarnessReport,
  InMemoryConnectionBarrier,
  P13_TEST_CAPABILITIES,
  type FixtureName,
  type QueryResult,
  type SqlClient,
  type SqlValue,
} from "../scripts/p13-db-tests/index.js";

const fixtureNames: readonly FixtureName[] = [
  "FX-SR",
  "FX-SW",
  "FX-SRdy",
  "FX-FZ",
  "FX-ACT",
  "FX-QN",
  "FX-PP",
  "FX-DE",
  "FX-FR",
];

interface FailureRule {
  matches: (sql: string) => boolean;
  error: unknown;
}

class RecordingClient implements SqlClient {
  readonly calls: Array<{
    sql: string;
    parameters: readonly SqlValue[];
  }> = [];

  constructor(private readonly failures: readonly FailureRule[] = []) {}

  async query<Row extends Record<string, unknown>>(
    sql: string,
    parameters: readonly SqlValue[] = [],
  ): Promise<QueryResult<Row>> {
    this.calls.push({ sql, parameters });
    const failure = this.failures.find((rule) => rule.matches(sql));
    if (failure) {
      throw failure.error;
    }
    return {
      rows: [{ ok: true } as unknown as Row],
      rowCount: 1,
    };
  }
}

function deterministicIdFactory(): (kind: string) => string {
  let sequence = 0;
  return (kind) => `${kind.slice(0, 6)}_${++sequence}`;
}

function fixtureSql(plan: ReturnType<typeof buildFixture>): string {
  return plan.steps.map((step) => step.sql).join("\n");
}

function buildTestFixture(name: FixtureName) {
  return buildFixture(name, {
    idFactory: deterministicIdFactory(),
    now: new Date("2026-11-17T00:00:00.000Z"),
  });
}

function isFinalCheckSql(sql: string): boolean {
  return /^\s*SELECT\s+"(?:status|state|storageKey)"/i.test(sql) ||
    /fixture_name/i.test(sql);
}

afterEach(() => {
  vi.useRealTimers();
});

describe.sequential("P1-3 fixture planner", () => {
  it("keeps unverified application and filesystem capabilities unimplemented", () => {
    expect(P13_TEST_CAPABILITIES).toMatchObject({
      fixtureBuilder: "IMPLEMENTED",
      databaseTestHarness: "IMPLEMENTED",
      commitUnknownClassification: "IMPLEMENTED",
      barrierTimeoutAndAbort: "IMPLEMENTED",
      generationCas: "NOT_IMPLEMENTED",
      storageKeyLockOrdering: "NOT_IMPLEMENTED",
      recoveryScanner: "NOT_IMPLEMENTED",
      filesystemFencing: "NOT_IMPLEMENTED",
      realDatabaseFixtureExecution: "NOT_AUTHORIZED",
    });
  });

  it("builds all nine fixtures with only ordinary INSERT/UPDATE statements", () => {
    for (const name of fixtureNames) {
      const plan = buildTestFixture(name);
      const sql = fixtureSql(plan);

      expect(plan.name).toBe(name);
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.finalChecks.length).toBeGreaterThan(0);

      for (const step of plan.steps) {
        expect(step.sql).toMatch(/^\s*(INSERT|UPDATE)\b/i);
        expect(step.sql).not.toMatch(
          /\b(DELETE|TRUNCATE|ALTER|CREATE\s+TABLE|DROP|GRANT|REVOKE)\b/i,
        );
        expect(step.sql).not.toMatch(/session_replication_role/i);
        expect(step.sql).not.toMatch(/DISABLE\s+TRIGGER/i);
        expect(step.sql).not.toMatch(/\b(BEGIN|COMMIT|ROLLBACK)\b/i);
      }

      expect(new Set(plan.steps.map((step) => step.id)).size).toBe(
        plan.steps.length,
      );
    }
  });

  it("starts FX-SR in the documented intent/attempt/lifecycle order", () => {
    const labels = buildTestFixture("FX-SR").steps.map(
      (step) => step.label,
    );

    expect(labels.indexOf("insert-intent")).toBeLessThan(
      labels.indexOf("insert-attempt-reserved"),
    );
    expect(labels.indexOf("insert-attempt-reserved")).toBeLessThan(
      labels.indexOf("insert-staging-reserved-lifecycle"),
    );
    expect(labels.indexOf("insert-staging-reserved-lifecycle")).toBeLessThan(
      labels.indexOf("activate-intent"),
    );
  });

  it("uses complete identity-verified attestation for ready and active fixtures", () => {
    for (const name of ["FX-SRdy", "FX-FZ", "FX-ACT"] as const) {
      const readyStep = buildTestFixture(name).steps.find(
        (step) => step.label === "lifecycle-ready-with-attestation",
      );

      expect(readyStep).toBeDefined();
      expect(readyStep?.parameters).toContain("fixture-dev");
      expect(readyStep?.parameters).toContain("fixture-ino");
      expect(readyStep?.parameters).toContain(1024n);
      expect(readyStep?.sql).toContain('"closedIdentityVerified"=true');
      expect(readyStep?.sql).toContain('"closedSizeBytes"=$2');
      expect(readyStep?.sql).toContain(
        '"closedChecksumSha256"=$3',
      );
    }
  });

  it("does not encode DF-05 as two simultaneous open attempts", () => {
    for (const name of fixtureNames) {
      const plan = buildTestFixture(name);
      const attemptInserts = plan.steps.filter((step) =>
        step.sql.includes('INSERT INTO "file_upload_attempt"'),
      );
      expect(attemptInserts).toHaveLength(1);
      expect(attemptInserts[0]?.parameters).toContain("RESERVED");
    }
  });
});

describe.sequential("transaction outcomes", () => {
  it("returns committed only after successful COMMIT", async () => {
    const client = new RecordingClient();
    const harness = new DatabaseTestHarness(client);

    const outcome = await harness.runTransaction("success", async (tx) => {
      await tx.query("step", 'INSERT INTO "file_upload_intent" DEFAULT VALUES');
    });

    expect(outcome.status).toBe("committed");
    expect(outcome.failedPhases).toEqual([]);
    expect(client.calls.map((call) => call.sql)).toEqual([
      "BEGIN",
      'INSERT INTO "file_upload_intent" DEFAULT VALUES',
      "COMMIT",
    ]);
  });

  it("returns rolled_back after statement failure and successful ROLLBACK", async () => {
    const client = new RecordingClient([
      {
        matches: (sql) => sql.includes("EXPECTED_STATEMENT_FAILURE"),
        error: {
          code: "23514",
          constraint: "statement_constraint",
          table: "storage_object_lifecycle",
        },
      },
    ]);
    const harness = new DatabaseTestHarness(client);

    const outcome = await harness.runTransaction("statement-failure", async (tx) => {
      await tx.query(
        "failing-statement",
        "SELECT 'EXPECTED_STATEMENT_FAILURE'",
      );
    });

    expect(outcome.status).toBe("rolled_back");
    expect(outcome.failedPhases).toEqual(["statement"]);
    expect(outcome.operationError?.sqlstate).toBe("23514");
    expect(outcome.commitError).toBeNull();
    expect(outcome.rollbackError).toBeNull();
    expect(client.calls.at(-1)?.sql).toBe("ROLLBACK");
  });

  it("retains an explicit COMMIT failure and reports rolled_back after ROLLBACK", async () => {
    const client = new RecordingClient([
      {
        matches: (sql) => sql === "COMMIT",
        error: {
          code: "23514",
          constraint: "close_attestation_complete_check",
          table: "storage_object_lifecycle",
        },
      },
    ]);
    const harness = new DatabaseTestHarness(client);

    const outcome = await harness.runTransaction("commit-failure", async (tx) => {
      await tx.query("step", "SELECT 1");
    });

    expect(outcome.status).toBe("rolled_back");
    expect(outcome.failedPhases).toEqual(["commit"]);
    expect(outcome.operationError).toBeNull();
    expect(outcome.commitError?.sqlstate).toBe("23514");
    expect(outcome.rollbackError).toBeNull();
  });

  it("reports commit_unknown for a lost COMMIT response and does not run ROLLBACK", async () => {
    const client = new RecordingClient([
      {
        matches: (sql) => sql === "COMMIT",
        error: {
          code: "ECONNRESET",
          message: "socket disconnected after COMMIT was sent",
        },
      },
    ]);
    const harness = new DatabaseTestHarness(client);

    const outcome = await harness.runTransaction("commit-unknown", async (tx) => {
      await tx.query("step", "SELECT 1");
    });

    expect(outcome.status).toBe("commit_unknown");
    expect(outcome.failedPhases).toEqual(["commit"]);
    expect(outcome.commitError?.sqlstate).toBeNull();
    expect(outcome.rollbackError).toBeNull();
    expect(client.calls.some((call) => call.sql === "ROLLBACK")).toBe(false);
  });

  it("reports rollback_failed when ROLLBACK itself fails", async () => {
    const client = new RecordingClient([
      {
        matches: (sql) => sql.includes("STATEMENT_FAILURE"),
        error: { code: "23514", message: "original failure" },
      },
      {
        matches: (sql) => sql === "ROLLBACK",
        error: { code: "08006", message: "connection failure" },
      },
    ]);
    const harness = new DatabaseTestHarness(client);

    const outcome = await harness.runTransaction("rollback-failure", async (tx) => {
      await tx.query("step", "SELECT 'STATEMENT_FAILURE'");
    });

    expect(outcome.status).toBe("rollback_failed");
    expect(outcome.failedPhases).toEqual(["statement", "rollback"]);
    expect(outcome.operationError?.sqlstate).toBe("23514");
    expect(outcome.rollbackError?.sqlstate).toBe("08006");
  });

  it("reports begin_failed when BEGIN fails", async () => {
    const client = new RecordingClient([
      {
        matches: (sql) => sql === "BEGIN",
        error: { code: "08001", message: "cannot begin transaction" },
      },
    ]);
    const harness = new DatabaseTestHarness(client);

    const outcome = await harness.runTransaction("begin-failure", async () => {});

    expect(outcome.status).toBe("begin_failed");
    expect(outcome.failedPhases).toEqual(["begin"]);
    expect(outcome.beginError?.sqlstate).toBe("08001");
  });
});

describe.sequential("expected failure isolation", () => {
  it("preserves an outer transaction after an expected failure", async () => {
    const client = new RecordingClient([
      {
        matches: (sql) => sql.includes("EXPECTED_FAILURE"),
        error: {
          code: "23514",
          constraint: "test_constraint",
          table: "storage_object_lifecycle",
        },
      },
    ]);
    const events: Parameters<typeof formatHarnessReport>[0] = [];
    const harness = new DatabaseTestHarness(client, (event) => {
      (events as Array<typeof event>).push(event);
    });

    const result = await harness.runTransaction("expect-failure", async (tx) => {
      const failure = await tx.expectFailure(
        "invalid-state",
        "SELECT 'EXPECTED_FAILURE'",
        [],
        {
          table: "storage_object_lifecycle",
          trigger: "p13_storage_lifecycle_guard",
        },
      );
      expect(failure.failedAsExpected).toBe(true);
      expect(failure.error?.sqlstate).toBe("23514");
    });

    expect(result.status).toBe("committed");
    expect(client.calls.map((call) => call.sql)).toEqual([
      "BEGIN",
      "SAVEPOINT p13_test_sp_1",
      "SELECT 'EXPECTED_FAILURE'",
      "ROLLBACK TO SAVEPOINT p13_test_sp_1",
      "RELEASE SAVEPOINT p13_test_sp_1",
      "COMMIT",
    ]);
    expect(formatHarnessReport(events)).toContain("test_constraint");
  });
});

describe.sequential("fixture final checks", () => {
  it("runs final checks only after a successful COMMIT", async () => {
    const client = new RecordingClient();
    const harness = new DatabaseTestHarness(client);
    const plan = buildTestFixture("FX-SR");

    const result = await executeFixturePlan(harness, plan);

    expect(result.transactionOutcome.status).toBe("committed");
    expect(result.finalCheckError).toBeNull();
    expect(result.finalChecks).toHaveLength(plan.finalChecks.length);

    const commitIndex = client.calls.findIndex(
      (call) => call.sql === "COMMIT",
    );
    const finalCheckIndexes = client.calls
      .map((call, index) => ({ call, index }))
      .filter(({ call }) => isFinalCheckSql(call.sql))
      .map(({ index }) => index);

    expect(commitIndex).toBeGreaterThan(-1);
    expect(finalCheckIndexes.length).toBe(plan.finalChecks.length);
    expect(finalCheckIndexes.every((index) => index > commitIndex)).toBe(true);
  });

  it("skips final checks after an explicit COMMIT failure", async () => {
    const client = new RecordingClient([
      {
        matches: (sql) => sql === "COMMIT",
        error: { code: "23514", message: "deferred failure" },
      },
    ]);
    const result = await executeFixturePlan(
      new DatabaseTestHarness(client),
      buildTestFixture("FX-SR"),
    );

    expect(result.transactionOutcome.status).toBe("rolled_back");
    expect(result.finalChecks).toEqual([]);
    expect(result.finalCheckError).toBeNull();
    expect(client.calls.some((call) => isFinalCheckSql(call.sql))).toBe(false);
  });

  it("skips final checks after commit_unknown", async () => {
    const client = new RecordingClient([
      {
        matches: (sql) => sql === "COMMIT",
        error: { code: "ECONNRESET", message: "response lost" },
      },
    ]);
    const result = await executeFixturePlan(
      new DatabaseTestHarness(client),
      buildTestFixture("FX-SR"),
    );

    expect(result.transactionOutcome.status).toBe("commit_unknown");
    expect(result.finalChecks).toEqual([]);
    expect(result.finalCheckError).toBeNull();
    expect(client.calls.some((call) => isFinalCheckSql(call.sql))).toBe(false);
  });

  it("skips final checks after rollback_failed", async () => {
    const client = new RecordingClient([
      {
        matches: (sql) => sql.includes('INSERT INTO "user"'),
        error: { code: "23514", message: "fixture failure" },
      },
      {
        matches: (sql) => sql === "ROLLBACK",
        error: { code: "08006", message: "rollback failed" },
      },
    ]);
    const result = await executeFixturePlan(
      new DatabaseTestHarness(client),
      buildTestFixture("FX-SR"),
    );

    expect(result.transactionOutcome.status).toBe("rollback_failed");
    expect(result.finalChecks).toEqual([]);
    expect(result.finalCheckError).toBeNull();
    expect(client.calls.some((call) => isFinalCheckSql(call.sql))).toBe(false);
  });

  it("preserves committed status when a final check fails", async () => {
    const client = new RecordingClient([
      {
        matches: isFinalCheckSql,
        error: {
          code: "23514",
          constraint: "final_check_constraint",
          table: "file_upload_intent",
        },
      },
    ]);
    const result = await executeFixturePlan(
      new DatabaseTestHarness(client),
      buildTestFixture("FX-SR"),
    );

    expect(result.transactionOutcome.status).toBe("committed");
    expect(result.transactionOutcome.commitError).toBeNull();
    expect(result.finalChecks).toEqual([]);
    expect(result.finalCheckError?.sqlstate).toBe("23514");
    expect(result.finalCheckError?.constraintName).toBe(
      "final_check_constraint",
    );
  });
});

describe.sequential("SQLSTATE and error context", () => {
  it("extracts PostgreSQL fields and maps only known Prisma codes", () => {
    const error = Object.assign(new Error("ownership mismatch"), {
      code: "23514",
      constraint: "close_attestation_complete_check",
      table: "storage_object_lifecycle",
      schema: "public",
      column: "closedIdentityVerified",
      routine: "p13_assert_staging_cleanup_attestation",
      where: "SQL statement in trigger",
    });

    expect(extractDatabaseError(error)).toMatchObject({
      sqlstate: "23514",
      constraintName: "close_attestation_complete_check",
      tableName: "storage_object_lifecycle",
      schemaName: "public",
      columnName: "closedIdentityVerified",
      triggerFunctionName: "p13_assert_staging_cleanup_attestation",
      routine: "p13_assert_staging_cleanup_attestation",
      where: "SQL statement in trigger",
    });

    expect(
      extractDatabaseError({
        meta: { code: "P2003", target: ["uploadAttemptId"] },
        message: "Foreign key constraint failed",
      }),
    ).toMatchObject({
      sqlstate: "23503",
      prismaCode: "P2003",
      constraintTargets: ["uploadAttemptId"],
    });

    expect(
      extractDatabaseError({
        code: "P2034",
        message: "Transaction conflict",
      }),
    ).toMatchObject({
      sqlstate: null,
      prismaCode: "P2034",
    });
  });

  it("extracts a p13 function from where when routine is absent", () => {
    const error = extractDatabaseError({
      code: "23514",
      message: "chain mismatch",
      where:
        "PL/pgSQL function p13_assert_chain_from_intent() line 12 at RAISE",
    });

    expect(error.triggerFunctionName).toBe(
      "p13_assert_chain_from_intent",
    );
  });

  it("keeps expected trigger context separate from the observed function", () => {
    const details = extractDatabaseError({
      code: "23514",
      routine: "p13_actual_function",
      message: "actual failure",
    });
    const error = new DatabaseStepError(
      "test-step",
      details,
      { trigger: "p13_expected_trigger" },
    );

    expect(error.expectedContext.trigger).toBe("p13_expected_trigger");
    expect(error.details.triggerFunctionName).toBe(
      "p13_actual_function",
    );
  });
});

describe.sequential("connection barrier", () => {
  it("releases two participants together", async () => {
    const barrier = new InMemoryConnectionBarrier();
    barrier.declare("two", ["a", "b"]);

    let released = 0;
    const a = barrier.arriveAndWait("two", "a").then(() => {
      released += 1;
    });
    const b = barrier.arriveAndWait("two", "b").then(() => {
      released += 1;
    });

    await Promise.all([a, b]);
    expect(released).toBe(2);
  });

  it("releases more than two participants together", async () => {
    const barrier = new InMemoryConnectionBarrier();
    barrier.declare("many", ["a", "b", "c"]);

    let released = 0;
    const waits = ["a", "b", "c"].map((participant) =>
      barrier
        .arriveAndWait("many", participant)
        .then(() => {
          released += 1;
        }),
    );

    await Promise.all(waits);
    expect(released).toBe(3);
  });

  it("rejects missing participants after timeout", async () => {
    vi.useFakeTimers();
    const barrier = new InMemoryConnectionBarrier(50);
    barrier.declare("timeout", ["a", "b"]);

    const pending = barrier.arriveAndWait("timeout", "a");
    const rejection = expect(pending).rejects.toBeInstanceOf(
      BarrierTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(50);
    await rejection;
  });

  it("rejects waiting participants on reset", async () => {
    const barrier = new InMemoryConnectionBarrier(1_000);
    barrier.declare("reset", ["a", "b"]);

    const pending = barrier.arriveAndWait("reset", "a");
    const rejection = expect(pending).rejects.toBeInstanceOf(
      BarrierResetError,
    );
    barrier.reset("reset");
    await rejection;
  });

  it("does not double-settle a timeout race and permits a new round", async () => {
    vi.useFakeTimers();
    const barrier = new InMemoryConnectionBarrier(25);
    barrier.declare("generation", ["old-a", "old-b"]);

    let oldSettlements = 0;
    const oldA = barrier
      .arriveAndWait("generation", "old-a")
      .then(
        () => {
          oldSettlements += 1;
        },
        () => {
          oldSettlements += 1;
        },
      );
    const timeout = expect(oldA).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(25);
    await timeout;
    expect(oldSettlements).toBe(1);

    barrier.declare("generation", ["new-a", "new-b"]);
    let newSettlements = 0;
    const newA = barrier
      .arriveAndWait("generation", "new-a")
      .then(() => {
        newSettlements += 1;
      });
    const newB = barrier
      .arriveAndWait("generation", "new-b")
      .then(() => {
        newSettlements += 1;
      });

    await Promise.all([newA, newB]);
    await vi.advanceTimersByTimeAsync(100);
    expect(newSettlements).toBe(2);
  });
});

describe.sequential("connection safety boundary", () => {
  it("does not import database clients or environment loaders", () => {
    const directory = path.resolve(
      process.cwd(),
      "scripts/p13-db-tests",
    );
    const source = fs
      .readdirSync(directory)
      .filter((name) => name.endsWith(".ts"))
      .map((name) => fs.readFileSync(path.join(directory, name), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/from\s+["']pg["']/);
    expect(source).not.toMatch(/from\s+["']@prisma\/client["']/);
    expect(source).not.toMatch(/\bPrismaClient\b/);
    expect(source).not.toMatch(/\bdotenv\b/);
    expect(source).not.toMatch(/process\.env/);
    expect(source).not.toMatch(/DATABASE_URL|TEST_DATABASE_URL/);
  });
});
