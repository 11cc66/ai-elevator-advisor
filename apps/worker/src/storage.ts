import path from "node:path";

import {
  createStorageReadCapability,
  isExplicitLocalObjectStorageEnvironment,
  LocalPrivateStorage,
  LocalObjectStorageAdapter,
  type ObjectStorageReadCapability,
  type StorageReadCapability,
} from "@elevator/file-storage";

import { workerWorkspaceRoot, type WorkerEnv } from "./config.js";

export function createWorkerStorage(
  env: WorkerEnv,
): StorageReadCapability {
  const root = path.isAbsolute(env.PRIVATE_STORAGE_ROOT)
    ? path.resolve(env.PRIVATE_STORAGE_ROOT)
    : path.resolve(workerWorkspaceRoot, env.PRIVATE_STORAGE_ROOT);
  return createStorageReadCapability(
    new LocalPrivateStorage(root),
  );
}

export function createWorkerObjectStorage(
  env: Pick<WorkerEnv, "PRIVATE_STORAGE_ROOT">,
): ObjectStorageReadCapability | undefined {
  return createWorkerObjectStorageForEnvironment(
    process.env.NODE_ENV,
    env,
  );
}

export function createWorkerObjectStorageForEnvironment(
  nodeEnvironment: string | undefined,
  env: Pick<WorkerEnv, "PRIVATE_STORAGE_ROOT">,
): ObjectStorageReadCapability | undefined {
  if (!isExplicitLocalObjectStorageEnvironment(nodeEnvironment)) {
    return undefined;
  }
  const root = path.isAbsolute(env.PRIVATE_STORAGE_ROOT)
    ? path.resolve(env.PRIVATE_STORAGE_ROOT)
    : path.resolve(workerWorkspaceRoot, env.PRIVATE_STORAGE_ROOT);
  return new LocalObjectStorageAdapter(root);
}
