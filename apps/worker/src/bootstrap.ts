import { BuildIntegrityError } from "@elevator/build-integrity";

import { runWorkerStartupGate } from "./security/startup-gate.js";

export interface WorkerBusinessEntry {
  startWorker(): Promise<void>;
}

export interface WorkerBootstrapDependencies {
  runStartupGate?: typeof runWorkerStartupGate;
  loadBusinessEntry?: () => Promise<WorkerBusinessEntry>;
}

export function safeWorkerStartupErrorCode(
  error: unknown,
): string {
  return error instanceof BuildIntegrityError
    ? error.code
    : error instanceof Error
      ? error.name
      : "UNKNOWN_ERROR";
}

export async function runWorkerBootstrap(
  dependencies: WorkerBootstrapDependencies = {},
): Promise<void> {
  const runStartupGate =
    dependencies.runStartupGate ?? runWorkerStartupGate;
  const loadBusinessEntry =
    dependencies.loadBusinessEntry ??
    (async () => import("./worker-entry.js"));

  await runStartupGate();
  const workerEntry = await loadBusinessEntry();
  await workerEntry.startWorker();
}
