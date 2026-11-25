export type SqlValue =
  | string
  | number
  | bigint
  | boolean
  | Date
  | null;

export interface QueryResult<
  Row extends Record<string, unknown> = Record<string, unknown>,
> {
  rows: Row[];
  rowCount?: number | null;
}

/**
 * Minimal query surface. Callers must inject a real adapter only in a
 * separately authorized database-test phase.
 */
export interface SqlClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    parameters?: readonly SqlValue[],
  ): Promise<QueryResult<Row>>;
}

export type FixtureName =
  | "FX-SR"
  | "FX-SW"
  | "FX-SRdy"
  | "FX-FZ"
  | "FX-ACT"
  | "FX-QN"
  | "FX-PP"
  | "FX-DE"
  | "FX-FR";

export interface FixtureIdFactory {
  (kind: string): string;
}

export interface FixtureStatement {
  id: string;
  label: string;
  purpose: string;
  sql: string;
  parameters: readonly SqlValue[];
  expectedIntermediateState: string;
  deferredCheckpoint?: string;
}

export interface FixtureCheck {
  id: string;
  label: string;
  sql: string;
  parameters: readonly SqlValue[];
  expectedSummary: string;
}

export interface FixturePlan {
  name: FixtureName;
  description: string;
  steps: readonly FixtureStatement[];
  finalChecks: readonly FixtureCheck[];
}

export interface DatabaseErrorDetails {
  sqlstate: string | null;
  prismaCode: string | null;
  constraintName: string | null;
  constraintTargets: readonly string[];
  tableName: string | null;
  schemaName: string | null;
  columnName: string | null;
  triggerFunctionName: string | null;
  routine: string | null;
  message: string;
  detail: string | null;
  hint: string | null;
  where: string | null;
}

export type TransactionPhase =
  | "begin"
  | "statement"
  | "commit"
  | "rollback";

export type TransactionStatus =
  | "committed"
  | "rolled_back"
  | "commit_unknown"
  | "rollback_failed"
  | "begin_failed";

export interface StatementContext {
  table?: string;
  trigger?: string;
  function?: string;
}
