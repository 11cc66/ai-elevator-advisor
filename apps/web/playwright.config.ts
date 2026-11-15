import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@playwright/test";
import { readTestEnvironment } from "./scripts/test-db/env";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const testEnv = readTestEnvironment();
const baseURL = testEnv.TEST_APP_BASE_URL;
const basePort = new URL(baseURL).port || "3100";
const testStorageRoot = path.resolve(
  configDirectory,
  "../..",
  testEnv.TEST_PRIVATE_STORAGE_ROOT,
);

process.env.DATABASE_URL = testEnv.TEST_DATABASE_URL;
process.env.BETTER_AUTH_URL = testEnv.BETTER_AUTH_URL;
process.env.BETTER_AUTH_SECRET = testEnv.BETTER_AUTH_SECRET;
process.env.PRIVATE_STORAGE_ROOT = testStorageRoot;

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
      DATABASE_URL: testEnv.TEST_DATABASE_URL,
      BETTER_AUTH_URL: testEnv.BETTER_AUTH_URL,
      BETTER_AUTH_SECRET: testEnv.BETTER_AUTH_SECRET,
      PRIVATE_STORAGE_ROOT: testStorageRoot,
    },
  },
});
