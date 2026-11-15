import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@playwright/test";
import { config as loadEnv } from "dotenv";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(configDirectory, "../../.env") });
const baseURL = process.env.APP_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
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
    command: "node node_modules/next/dist/bin/next dev",
    url: `${baseURL}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
