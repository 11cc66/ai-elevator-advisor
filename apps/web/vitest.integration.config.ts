import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { readTestEnvironment } from "./scripts/test-db/env";

const directory = path.dirname(fileURLToPath(import.meta.url));
const testEnv = readTestEnvironment();

process.env.DATABASE_URL = testEnv.TEST_DATABASE_URL;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(directory, "src"),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    exclude: ["tests/e2e/**"],
    fileParallelism: false,
    maxWorkers: 1,
  },
});
