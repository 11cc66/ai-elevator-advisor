import { defineConfig } from "@playwright/test";
import { readTestEnvironment } from "./scripts/test-db/env";

const testEnv = readTestEnvironment();
const baseURL = testEnv.TEST_APP_BASE_URL;
const basePort = new URL(baseURL).port || "3100";

process.env.DATABASE_URL = testEnv.TEST_DATABASE_URL;
process.env.BETTER_AUTH_URL = testEnv.BETTER_AUTH_URL;
process.env.BETTER_AUTH_SECRET = testEnv.BETTER_AUTH_SECRET;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
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
    },
  },
});
