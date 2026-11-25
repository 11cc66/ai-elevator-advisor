import fs from "node:fs/promises";
import type { BigIntStats } from "node:fs";
import path from "node:path";

const AREAS = ["staging", "objects", "temp"] as const;

export interface StorageAreaInventory {
  area: (typeof AREAS)[number];
  exists: boolean;
  fileCount: number;
  totalBytes: number;
  oldestMtime: string | null;
  newestMtime: string | null;
  symlinkCount: number;
  reparsePointCount: number;
  inaccessibleEntryCount: number;
  vanishedEntryCount: number;
  changedFileCount: number;
  scanComplete: boolean;
}

export interface StorageInventoryResult {
  root: string;
  scanComplete: boolean;
  capacity: {
    blockSizeBytes: number;
    totalBytes: number;
    freeBytes: number;
    availableBytes: number;
  };
  areas: StorageAreaInventory[];
}

export interface StorageInventoryHooks {
  afterFileStat?: (
    absolutePath: string,
    stats: BigIntStats,
  ) => void | Promise<void>;
}

function nativeErrorCode(error: unknown): string | undefined {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : undefined;
}

function sameFileIdentity(
  left: BigIntStats,
  right: BigIntStats,
): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs
  );
}

async function assertNoReparseComponents(
  absolutePath: string,
): Promise<void> {
  const parsed = path.parse(absolutePath);
  const relative = path.relative(parsed.root, absolutePath);
  if (!relative) {
    return;
  }
  let current = parsed.root;
  for (const segment of relative.split(path.sep)) {
    if (!segment) {
      continue;
    }
    current = path.join(current, segment);
    const stats = await fs.lstat(current, { bigint: true });
    if (stats.isSymbolicLink()) {
      throw new Error("STORAGE_ROOT_REPARSE_PATH");
    }
  }
}

async function readFileIdentity(
  absolutePath: string,
): Promise<BigIntStats | null> {
  try {
    return await fs.lstat(absolutePath, { bigint: true });
  } catch (error) {
    if (nativeErrorCode(error) === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function inventoryStorageRoot(
  root: string,
  hooks: StorageInventoryHooks = {},
): Promise<StorageInventoryResult> {
  const requestedRoot = path.resolve(root);
  await assertNoReparseComponents(requestedRoot);
  const rootBefore = await fs.lstat(requestedRoot, { bigint: true });
  if (rootBefore.isSymbolicLink() || !rootBefore.isDirectory()) {
    throw new Error("STORAGE_ROOT_INVALID");
  }

  const absoluteRoot = await fs.realpath(requestedRoot);
  const canonicalBefore = await fs.lstat(absoluteRoot, {
    bigint: true,
  });
  if (
    canonicalBefore.isSymbolicLink() ||
    !canonicalBefore.isDirectory() ||
    rootBefore.dev !== canonicalBefore.dev ||
    rootBefore.ino !== canonicalBefore.ino
  ) {
    throw new Error("STORAGE_ROOT_IDENTITY_INVALID");
  }

  const stats = await fs.statfs(absoluteRoot);
  const areas: StorageAreaInventory[] = [];
  let scanComplete = true;

  for (const area of AREAS) {
    const areaRoot = path.join(absoluteRoot, area);
    let fileCount = 0;
    let totalBytes = 0;
    let oldest: number | null = null;
    let newest: number | null = null;
    let symlinkCount = 0;
    let reparsePointCount = 0;
    let inaccessibleEntryCount = 0;
    let vanishedEntryCount = 0;
    let changedFileCount = 0;
    let areaScanComplete = true;

    async function walk(directory: string): Promise<void> {
      let entries;
      try {
        entries = await fs.readdir(directory, {
          withFileTypes: true,
        });
      } catch (error) {
        if (nativeErrorCode(error) === "ENOENT") {
          vanishedEntryCount += 1;
        } else {
          inaccessibleEntryCount += 1;
        }
        areaScanComplete = false;
        scanComplete = false;
        return;
      }

      for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);
        let entryStats: BigIntStats;
        try {
          entryStats = await fs.lstat(entryPath, { bigint: true });
        } catch (error) {
          if (nativeErrorCode(error) === "ENOENT") {
            vanishedEntryCount += 1;
          } else {
            inaccessibleEntryCount += 1;
          }
          areaScanComplete = false;
          scanComplete = false;
          continue;
        }

        if (entryStats.isSymbolicLink()) {
          symlinkCount += 1;
          if (process.platform === "win32") {
            reparsePointCount += 1;
          }
          continue;
        }
        if (entryStats.isDirectory()) {
          await walk(entryPath);
          continue;
        }
        if (!entryStats.isFile()) {
          inaccessibleEntryCount += 1;
          areaScanComplete = false;
          scanComplete = false;
          continue;
        }

        fileCount += 1;
        totalBytes += Number(entryStats.size);
        const mtime = Number(entryStats.mtimeMs);
        oldest = oldest === null ? mtime : Math.min(oldest, mtime);
        newest = newest === null ? mtime : Math.max(newest, mtime);

        await hooks.afterFileStat?.(entryPath, entryStats);
        const afterStats = await readFileIdentity(entryPath);
        if (!afterStats) {
          vanishedEntryCount += 1;
          changedFileCount += 1;
          areaScanComplete = false;
          scanComplete = false;
          continue;
        }
        if (
          afterStats.isSymbolicLink() ||
          !afterStats.isFile() ||
          !sameFileIdentity(entryStats, afterStats)
        ) {
          changedFileCount += 1;
          areaScanComplete = false;
          scanComplete = false;
        }
      }
    }

    let exists = true;
    try {
      const areaStats = await fs.lstat(areaRoot, { bigint: true });
      if (areaStats.isSymbolicLink()) {
        symlinkCount += 1;
        if (process.platform === "win32") {
          reparsePointCount += 1;
        }
        areaScanComplete = false;
        scanComplete = false;
      } else if (!areaStats.isDirectory()) {
        inaccessibleEntryCount += 1;
        areaScanComplete = false;
        scanComplete = false;
      } else {
        await walk(areaRoot);
      }
    } catch (error) {
      if (nativeErrorCode(error) === "ENOENT") {
        exists = false;
      } else {
        inaccessibleEntryCount += 1;
        areaScanComplete = false;
        scanComplete = false;
      }
    }

    areas.push({
      area,
      exists,
      fileCount,
      totalBytes,
      oldestMtime:
        oldest === null ? null : new Date(oldest).toISOString(),
      newestMtime:
        newest === null ? null : new Date(newest).toISOString(),
      symlinkCount,
      reparsePointCount,
      inaccessibleEntryCount,
      vanishedEntryCount,
      changedFileCount,
      scanComplete: areaScanComplete,
    });
  }

  const canonicalAfter = await fs.lstat(absoluteRoot, {
    bigint: true,
  });
  if (
    canonicalAfter.isSymbolicLink() ||
    !canonicalAfter.isDirectory() ||
    canonicalAfter.dev !== canonicalBefore.dev ||
    canonicalAfter.ino !== canonicalBefore.ino
  ) {
    scanComplete = false;
  }

  return {
    root: absoluteRoot,
    scanComplete,
    capacity: {
      blockSizeBytes: Number(stats.bsize),
      totalBytes: Number(stats.blocks) * Number(stats.bsize),
      freeBytes: Number(stats.bfree) * Number(stats.bsize),
      availableBytes: Number(stats.bavail) * Number(stats.bsize),
    },
    areas,
  };
}
