import {
  readTestEnvironment,
} from "../../scripts/test-db/env";
import {
  verifyTestDatabaseIdentity,
} from "../../scripts/test-db/guard";

export default async function globalSetup(): Promise<void> {
  await verifyTestDatabaseIdentity(
    "verify",
    readTestEnvironment(),
  );
}
