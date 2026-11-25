export {
  DatabaseTestHarness,
  DatabaseStepError,
  HarnessTransaction,
  extractDatabaseError,
  formatHarnessReport,
} from "./harness.js";
export { P13_TEST_CAPABILITIES } from "./capabilities.js";
export {
  BarrierResetError,
  BarrierTimeoutError,
  InMemoryConnectionBarrier,
  type ConnectionBarrier,
} from "./barrier.js";
export {
  buildFixture,
  executeFixturePlan,
  type FixtureBuilderOptions,
  type FixtureExecution,
} from "./fixture-builder.js";
export type {
  DatabaseErrorDetails,
  FixtureCheck,
  FixtureIdFactory,
  FixtureName,
  FixturePlan,
  FixtureStatement,
  QueryResult,
  SqlClient,
  SqlValue,
  StatementContext,
} from "./types.js";
