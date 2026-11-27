import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const directory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(directory, "src"),
    },
  },
  test: {
    include: [
      "tests/integration/phase40-append-intent-finalization.test.ts",
      "tests/integration/phase41-trigger-catalog.test.ts",
    ],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
  },
});
