import path from "node:path";

import { LocalPrivateStorage } from "@elevator/file-storage";

import { workerWorkspaceRoot, type WorkerEnv } from "./config.js";

export function createWorkerStorage(env: WorkerEnv): LocalPrivateStorage {
  const root = path.isAbsolute(env.PRIVATE_STORAGE_ROOT)
    ? path.resolve(env.PRIVATE_STORAGE_ROOT)
    : path.resolve(workerWorkspaceRoot, env.PRIVATE_STORAGE_ROOT);
  return new LocalPrivateStorage(root);
}
