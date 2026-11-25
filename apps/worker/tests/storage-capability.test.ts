import { expect, it } from "vitest";

import type { WorkerEnv } from "../src/config.js";
import { createWorkerStorage } from "../src/storage.js";

it("grants worker processing only the read storage capability", () => {
  const storage = createWorkerStorage({
    PRIVATE_STORAGE_ROOT: "storage/isolated-worker-test",
  } as WorkerEnv);

  expect(Object.keys(storage).sort()).toEqual([
    "openReadStream",
    "readVerifiedObject",
    "verifyObjectChecksum",
  ]);
  expect(Object.isFrozen(storage)).toBe(true);
  for (const unavailableMethod of [
    "writeToStaging",
    "finalize",
    "removeStaging",
    "removeObject",
    "cleanupOrphanObjects",
    "cleanupTemp",
  ]) {
    expect(unavailableMethod in storage).toBe(false);
  }
});
