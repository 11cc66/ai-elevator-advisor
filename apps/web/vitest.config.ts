import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const directory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(directory, "src"),
      "@elevator/file-storage": path.resolve(
        directory,
        "../../packages/file-storage/src/index.ts",
      ),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "tests/integration/**"],
    testTimeout: 20_000,
  },
});
