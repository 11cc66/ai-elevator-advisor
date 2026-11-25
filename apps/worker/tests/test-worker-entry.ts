import { startWorker } from "../src/worker-entry.js";

startWorker().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      event: "worker.test_entry_failed",
      errorName: error instanceof Error ? error.name : "UNKNOWN_ERROR",
    }),
  );
  process.exitCode = 1;
});
