import type {
  DatabaseErrorDetails,
  QueryResult,
  SqlClient,
  SqlValue,
  StatementContext,
  TransactionPhase,
  TransactionStatus,
} from "./types.js";

export type HarnessPhase =
  | "BEGIN"
  | "STATEMENT"
  | "COMMIT"
  | "ROLLBACK"
  | "SAVEPOINT"
  | "ROLLBACK_TO_SAVEPOINT"
  | "RELEASE_SAVEPOINT"
  | "FINAL_CHECK";

export interface HarnessEvent {
  phase: HarnessPhase;
  label: string;
  ok: boolean;
  durationMs: number;
  expectedContext?: StatementContext;
  error?: DatabaseErrorDetails;
}

export interface TransactionRun<Result> {
  name: string;
  status: TransactionStatus;
  result: Result | null;
  failedPhases: readonly TransactionPhase[];
  beginError: DatabaseErrorDetails | null;
  operationError: DatabaseErrorDetails | null;
  commitError: DatabaseErrorDetails | null;
  rollbackError: DatabaseErrorDetails | null;
  events: readonly HarnessEvent[];
}

export interface ExpectedFailureResult<Row extends Record<string, unknown>> {
  failedAsExpected: boolean;
  error: DatabaseErrorDetails | null;
  unexpectedResult: QueryResult<Row> | null;
}

export class DatabaseStepError extends Error {
  constructor(
    public readonly label: string,
    public readonly details: DatabaseErrorDetails,
    public readonly expectedContext: StatementContext,
  ) {
    super(details.message);
    this.name = "DatabaseStepError";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function stringProperty(
  record: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function prismaSqlstate(code: string | null): string | null {
  switch (code) {
    case "P2002":
      return "23505";
    case "P2003":
      return "23503";
    default:
      return null;
  }
}

function extractSqlstate(record: Record<string, unknown>): string | null {
  const explicit =
    stringProperty(record, "sqlState") ??
    stringProperty(record, "sqlstate");

  if (explicit) {
    return explicit;
  }

  const code = stringProperty(record, "code");
  if (code && /^[0-9A-Z]{5}$/.test(code) && !/^P\d{4}$/.test(code)) {
    return code;
  }

  const meta = asRecord(record.meta);
  const metaCode = stringProperty(meta, "code");
  if (
    metaCode &&
    /^[0-9A-Z]{5}$/.test(metaCode) &&
    !/^P\d{4}$/.test(metaCode)
  ) {
    return metaCode;
  }

  return prismaSqlstate(code) ?? prismaSqlstate(metaCode);
}

function extractConstraintTargets(
  record: Record<string, unknown>,
): readonly string[] {
  const meta = asRecord(record.meta);
  const target = meta?.target;

  if (Array.isArray(target)) {
    return target.filter(
      (entry): entry is string => typeof entry === "string",
    );
  }

  return typeof target === "string" ? [target] : [];
}

function extractTriggerFunction(
  record: Record<string, unknown>,
): string | null {
  const routine = stringProperty(record, "routine");
  if (routine?.startsWith("p13_")) {
    return routine;
  }

  const where = stringProperty(record, "where");
  const match = where?.match(
    /PL\/pgSQL function\s+"?(p13_[a-zA-Z0-9_]+)"?/i,
  );
  return match?.[1] ?? null;
}

export function extractDatabaseError(error: unknown): DatabaseErrorDetails {
  if (error instanceof DatabaseStepError) {
    return error.details;
  }

  const record = asRecord(error) ?? {};
  const code = stringProperty(record, "code");

  return {
    sqlstate: extractSqlstate(record),
    prismaCode:
      code?.startsWith("P") && code.length === 5
        ? code
        : stringProperty(asRecord(record.meta), "code")?.startsWith("P") &&
            stringProperty(asRecord(record.meta), "code")?.length === 5
          ? stringProperty(asRecord(record.meta), "code")
          : null,
    constraintName: stringProperty(record, "constraint"),
    constraintTargets: extractConstraintTargets(record),
    tableName: stringProperty(record, "table"),
    schemaName: stringProperty(record, "schema"),
    columnName: stringProperty(record, "column"),
    triggerFunctionName: extractTriggerFunction(record),
    routine: stringProperty(record, "routine"),
    message:
      error instanceof Error
        ? error.message
        : stringProperty(record, "message") ?? String(error),
    detail: stringProperty(record, "detail"),
    hint: stringProperty(record, "hint"),
    where: stringProperty(record, "where"),
  };
}

function nowMilliseconds(): number {
  return Date.now();
}

export class HarnessTransaction {
  private savepointSequence = 0;

  constructor(
    private readonly client: SqlClient,
    private readonly emit: (event: HarnessEvent) => void,
  ) {}

  async query<Row extends Record<string, unknown>>(
    label: string,
    sql: string,
    parameters: readonly SqlValue[] = [],
    context: StatementContext = {},
  ): Promise<QueryResult<Row>> {
    const startedAt = nowMilliseconds();
    try {
      const result = await this.client.query<Row>(sql, parameters);
      this.emit({
        phase: "STATEMENT",
        label,
        ok: true,
        durationMs: nowMilliseconds() - startedAt,
        expectedContext: context,
      });
      return result;
    } catch (error) {
      const details = extractDatabaseError(error);
      this.emit({
        phase: "STATEMENT",
        label,
        ok: false,
        durationMs: nowMilliseconds() - startedAt,
        expectedContext: context,
        error: details,
      });
      throw new DatabaseStepError(label, details, context);
    }
  }

  /**
   * Runs a statement expected to fail, while preserving the outer
   * transaction. The caller must assert failedAsExpected.
   */
  async expectFailure<Row extends Record<string, unknown>>(
    label: string,
    sql: string,
    parameters: readonly SqlValue[] = [],
    context: StatementContext = {},
  ): Promise<ExpectedFailureResult<Row>> {
    const savepoint = `p13_test_sp_${++this.savepointSequence}`;
    await this.control("SAVEPOINT", `SAVEPOINT ${savepoint}`);

    try {
      const result = await this.query<Row>(
        label,
        sql,
        parameters,
        context,
      );
      await this.control(
        "ROLLBACK_TO_SAVEPOINT",
        `ROLLBACK TO SAVEPOINT ${savepoint}`,
      );
      await this.control(
        "RELEASE_SAVEPOINT",
        `RELEASE SAVEPOINT ${savepoint}`,
      );
      return {
        failedAsExpected: false,
        error: null,
        unexpectedResult: result,
      };
    } catch (error) {
      const details = extractDatabaseError(error);
      await this.control(
        "ROLLBACK_TO_SAVEPOINT",
        `ROLLBACK TO SAVEPOINT ${savepoint}`,
      );
      await this.control(
        "RELEASE_SAVEPOINT",
        `RELEASE SAVEPOINT ${savepoint}`,
      );
      return {
        failedAsExpected: true,
        error: details,
        unexpectedResult: null,
      };
    }
  }

  private async control(
    phase: HarnessPhase,
    sql: string,
  ): Promise<void> {
    const startedAt = nowMilliseconds();
    try {
      await this.client.query(sql);
      this.emit({
        phase,
        label: sql,
        ok: true,
        durationMs: nowMilliseconds() - startedAt,
      });
    } catch (error) {
      this.emit({
        phase,
        label: sql,
        ok: false,
        durationMs: nowMilliseconds() - startedAt,
        error: extractDatabaseError(error),
      });
      throw error;
    }
  }
}

export class DatabaseTestHarness {
  constructor(
    private readonly client: SqlClient,
    private readonly sink: (event: HarnessEvent) => void = () => {},
  ) {}

  async query<Row extends Record<string, unknown>>(
    label: string,
    sql: string,
    parameters: readonly SqlValue[] = [],
  ): Promise<QueryResult<Row>> {
    const startedAt = nowMilliseconds();
    try {
      const result = await this.client.query<Row>(sql, parameters);
      this.sink({
        phase: "FINAL_CHECK",
        label,
        ok: true,
        durationMs: nowMilliseconds() - startedAt,
      });
      return result;
    } catch (error) {
      const details = extractDatabaseError(error);
      this.sink({
        phase: "FINAL_CHECK",
        label,
        ok: false,
        durationMs: nowMilliseconds() - startedAt,
        error: details,
      });
      throw error;
    }
  }

  async runTransaction<Result>(
    name: string,
    operation: (transaction: HarnessTransaction) => Promise<Result>,
  ): Promise<TransactionRun<Result>> {
    const events: HarnessEvent[] = [];
    const emit = (event: HarnessEvent): void => {
      events.push(event);
      this.sink(event);
    };
    const startedAt = nowMilliseconds();

    try {
      await this.client.query("BEGIN");
      emit({
        phase: "BEGIN",
        label: name,
        ok: true,
        durationMs: nowMilliseconds() - startedAt,
      });
    } catch (error) {
      return {
        name,
        status: "begin_failed",
        result: null,
        failedPhases: ["begin"],
        beginError: extractDatabaseError(error),
        operationError: null,
        commitError: null,
        rollbackError: null,
        events,
      };
    }

    const transaction = new HarnessTransaction(this.client, emit);

    let result: Result;
    try {
      result = await operation(transaction);
    } catch (error) {
      const operationError = extractDatabaseError(error);
      return this.rollbackAfterFailure(
        name,
        events,
        emit,
        startedAt,
        ["statement"],
        operationError,
        null,
      );
    }

    try {
      await this.client.query("COMMIT");
      emit({
        phase: "COMMIT",
        label: name,
        ok: true,
        durationMs: nowMilliseconds() - startedAt,
      });
      return {
        name,
        status: "committed",
        result,
        failedPhases: [],
        beginError: null,
        operationError: null,
        commitError: null,
        rollbackError: null,
        events,
      };
    } catch (error) {
      const commitError = extractDatabaseError(error);
      emit({
        phase: "COMMIT",
        label: name,
        ok: false,
        durationMs: nowMilliseconds() - startedAt,
        error: commitError,
      });

      if (commitOutcomeIsUnknown(commitError)) {
        return {
          name,
          status: "commit_unknown",
          result: null,
          failedPhases: ["commit"],
          beginError: null,
          operationError: null,
          commitError,
          rollbackError: null,
          events,
        };
      }

      return this.rollbackAfterFailure(
        name,
        events,
        emit,
        startedAt,
        ["commit"],
        null,
        commitError,
      );
    }
  }

  private async rollbackAfterFailure<Result>(
    name: string,
    events: HarnessEvent[],
    emit: (event: HarnessEvent) => void,
    startedAt: number,
    failedPhases: readonly TransactionPhase[],
    operationError: DatabaseErrorDetails | null,
    commitError: DatabaseErrorDetails | null,
  ): Promise<TransactionRun<Result>> {
    try {
      await this.client.query("ROLLBACK");
      emit({
        phase: "ROLLBACK",
        label: name,
        ok: true,
        durationMs: nowMilliseconds() - startedAt,
      });
      return {
        name,
        status: "rolled_back",
        result: null,
        failedPhases,
        beginError: null,
        operationError,
        commitError,
        rollbackError: null,
        events,
      };
    } catch (error) {
      const rollbackError = extractDatabaseError(error);
      emit({
        phase: "ROLLBACK",
        label: name,
        ok: false,
        durationMs: nowMilliseconds() - startedAt,
        error: rollbackError,
      });
      return {
        name,
        status: "rollback_failed",
        result: null,
        failedPhases: [...failedPhases, "rollback"],
        beginError: null,
        operationError,
        commitError,
        rollbackError,
        events,
      };
    }
  }
}

function commitOutcomeIsUnknown(
  error: DatabaseErrorDetails,
): boolean {
  if (error.sqlstate === null) {
    return true;
  }

  return (
    error.sqlstate.startsWith("08") ||
    error.sqlstate === "40003" ||
    error.sqlstate === "57P01" ||
    error.sqlstate === "57P02" ||
    error.sqlstate === "57P03"
  );
}

export function formatHarnessReport(
  events: readonly HarnessEvent[],
): string {
  return events
    .map((event) => {
      const context = [
        event.expectedContext?.table,
        event.expectedContext?.trigger,
        event.expectedContext?.function,
      ]
        .filter(Boolean)
        .join("/");
      const error = event.error
        ? [
            event.error.sqlstate,
            event.error.constraintName,
            event.error.triggerFunctionName,
            event.error.message,
          ]
            .filter(Boolean)
            .join(" | ")
        : "";

      return [
        event.phase,
        event.ok ? "OK" : "FAIL",
        event.label,
        `${event.durationMs}ms`,
        context,
        error,
      ]
        .filter(Boolean)
        .join(" | ");
    })
    .join("\n");
}
