import path from "node:path";

import { LocalPrivateStorage } from "@elevator/file-storage";

import { readWebEnv } from "@/server/env";

const workspaceRoot = path.resolve(process.cwd(), "../..");
const publicDirectory = path.join(workspaceRoot, "apps", "web", "public");

export function getPrivateStorage(): LocalPrivateStorage {
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

  return new LocalPrivateStorage(storageRoot);
}
