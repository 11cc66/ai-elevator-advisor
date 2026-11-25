import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@playwright/test";
import { readTestEnvironment } from "./scripts/test-db/env";
import { resolveTestStorageRootPath } from "./scripts/test-db/storage-root";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const testEnv = readTestEnvironment();
const baseURL = testEnv.TEST_APP_BASE_URL;
const basePort = new URL(baseURL).port || "3100";
const testStorageRoot = resolveTestStorageRootPath(
  path.resolve(configDirectory, "../.."),
  testEnv.TEST_PRIVATE_STORAGE_ROOT,
);

process.env.DATABASE_URL = testEnv.TEST_DATABASE_URL;
process.env.BETTER_AUTH_URL = testEnv.BETTER_AUTH_URL;
process.env.BETTER_AUTH_SECRET = testEnv.BETTER_AUTH_SECRET;
process.env.PRIVATE_STORAGE_ROOT = testStorageRoot;
process.env.TEST_CUSTOMER_2_USERNAME =
  testEnv.TEST_CUSTOMER_2_USERNAME;
process.env.TEST_CUSTOMER_2_NAME = testEnv.TEST_CUSTOMER_2_NAME;
process.env.TEST_SALES_USERNAME = testEnv.TEST_SALES_USERNAME;
process.env.TEST_SALES_NAME = testEnv.TEST_SALES_NAME;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    extraHTTPHeaders: {
      Origin: baseURL,
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${basePort}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: testEnv.TEST_DATABASE_URL,
      BETTER_AUTH_URL: testEnv.BETTER_AUTH_URL,
      BETTER_AUTH_SECRET: testEnv.BETTER_AUTH_SECRET,
      PRIVATE_STORAGE_ROOT: testStorageRoot,
      FILE_ACCESS_MODE: "test",
      TEST_DATABASE_MARKER: testEnv.TEST_DATABASE_MARKER,
    },
  },
});
