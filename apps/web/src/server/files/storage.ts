import path from "node:path";

import {
  createStorageRuntimeCapability,
  LocalPrivateStorage,
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
