import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const directory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@elevator/file-storage": path.resolve(
        directory,
        "../../packages/file-storage/src/index.ts",
      ),
    },
  },
  test: {
    testTimeout: 30_000,
  },
});
