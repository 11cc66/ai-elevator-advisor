import path from "node:path";

import {
  createStorageRuntimeCapability,
  isExplicitLocalObjectStorageEnvironment,
  LocalPrivateStorage,
  LocalObjectStorageAdapter,
  type ObjectStorageAdapter,
  type StorageRuntimeCapability,
} from "@elevator/file-storage";

import { readWebEnv } from "@/server/env";

const workspaceRoot = path.resolve(process.cwd(), "../..");
const publicDirectory = path.join(workspaceRoot, "apps", "web", "public");

export function getPrivateStorage(): StorageRuntimeCapability {
  const env = readWebEnv();
  const storageRoot = path.isAbsolute(env.PRIVATE_STORAGE_ROOT)
    ? path.resolve(env.PRIVATE_STORAGE_ROOT)
    : path.resolve(
        /* turbopackIgnore: true */
        workspaceRoot,
        env.PRIVATE_STORAGE_ROOT,
      );
  const relativeToPublic = path.relative(publicDirectory, storageRoot);

  if (
    relativeToPublic === "" ||
    (!relativeToPublic.startsWith("..") &&
      !path.isAbsolute(relativeToPublic))
  ) {
    throw new Error("PRIVATE_STORAGE_ROOT must be outside the public directory");
  }

  return createStorageRuntimeCapability(
    new LocalPrivateStorage(storageRoot),
  );
}

/**
 * The Provider adapter is intentionally absent until a Provider capability
 * profile is approved and an isolated adapter is supplied by the runtime.
 * Callers must fail closed rather than treating local storage as a Provider.
 */
export function getObjectStorageAdapter(): ObjectStorageAdapter | undefined {
  const env = readWebEnv();
  if (!isExplicitLocalObjectStorageEnvironment(env.NODE_ENV)) {
    return undefined;
  }

  const storageRoot = path.isAbsolute(env.PRIVATE_STORAGE_ROOT)
    ? path.resolve(env.PRIVATE_STORAGE_ROOT)
    : path.resolve(workspaceRoot, env.PRIVATE_STORAGE_ROOT);
  return createObjectStorageAdapterForEnvironment(
    env.NODE_ENV,
    storageRoot,
  );
}

export function createObjectStorageAdapterForEnvironment(
  nodeEnvironment: string | undefined,
  storageRoot: string,
): ObjectStorageAdapter | undefined {
  if (!isExplicitLocalObjectStorageEnvironment(nodeEnvironment)) {
    return undefined;
  }
  const relativeToPublic = path.relative(publicDirectory, storageRoot);
  if (
    relativeToPublic === "" ||
    (!relativeToPublic.startsWith("..") &&
      !path.isAbsolute(relativeToPublic))
  ) {
    throw new Error("PRIVATE_STORAGE_ROOT must be outside the public directory");
  }

  return new LocalObjectStorageAdapter(storageRoot);
}
