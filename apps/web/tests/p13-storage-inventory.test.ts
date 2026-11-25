import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, expect, it } from "vitest";

import { inventoryStorageRoot } from "../scripts/p13-storage-inventory/inventory";

let root = "";

beforeEach(async () => {
  root = await fs.mkdtemp(
    path.join(os.tmpdir(), "p13-storage-inventory-"),
  );
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

it("inventories staging, objects, and temp without reading file contents", async () => {
  await fs.mkdir(path.join(root, "staging"), { recursive: true });
  await fs.mkdir(path.join(root, "objects"), { recursive: true });
  await fs.writeFile(path.join(root, "staging/a.part"), "abc");
  await fs.writeFile(path.join(root, "objects/b.bin"), "12345");

  const result = await inventoryStorageRoot(root);

  expect(result.areas).toEqual([
    expect.objectContaining({
      area: "staging",
      exists: true,
      fileCount: 1,
      totalBytes: 3,
      symlinkCount: 0,
      reparsePointCount: 0,
      inaccessibleEntryCount: 0,
      vanishedEntryCount: 0,
      changedFileCount: 0,
      scanComplete: true,
    }),
    expect.objectContaining({
      area: "objects",
      exists: true,
      fileCount: 1,
      totalBytes: 5,
      symlinkCount: 0,
    }),
    expect.objectContaining({
      area: "temp",
      exists: false,
      fileCount: 0,
      totalBytes: 0,
    }),
  ]);
  expect(result.capacity.totalBytes).toBeGreaterThanOrEqual(
    result.capacity.freeBytes,
  );
  expect(result.scanComplete).toBe(true);
});

it("rejects a symbolic link or junction used as the storage root", async () => {
  const actualRoot = path.join(root, "actual");
  const linkedRoot = path.join(root, "linked");
  await fs.mkdir(path.join(actualRoot, "staging"), {
    recursive: true,
  });
  await fs.symlink(
    actualRoot,
    linkedRoot,
    process.platform === "win32" ? "junction" : "dir",
  );

  await expect(
    inventoryStorageRoot(linkedRoot),
  ).rejects.toThrow("STORAGE_ROOT_REPARSE_PATH");
});

it("rejects a parent junction that changes the canonical storage root", async () => {
  const actualParent = path.join(root, "actual-parent");
  const linkedParent = path.join(root, "linked-parent");
  await fs.mkdir(path.join(actualParent, "storage-root", "staging"), {
    recursive: true,
  });
  await fs.symlink(
    actualParent,
    linkedParent,
    process.platform === "win32" ? "junction" : "dir",
  );

  await expect(
    inventoryStorageRoot(path.join(linkedParent, "storage-root")),
  ).rejects.toThrow("STORAGE_ROOT_REPARSE_PATH");
});

it("counts links without following them", async () => {
  await fs.mkdir(path.join(root, "staging"), { recursive: true });
  await fs.mkdir(path.join(root, "objects"), { recursive: true });
  await fs.writeFile(path.join(root, "staging/target.part"), "abc");
  await fs.symlink(
    path.join(root, "staging"),
    path.join(root, "objects/link"),
    process.platform === "win32" ? "junction" : "dir",
  );

  const result = await inventoryStorageRoot(root);
  const objects = result.areas.find((area) => area.area === "objects");

  expect(objects).toMatchObject({
    fileCount: 0,
    symlinkCount: 1,
    reparsePointCount: process.platform === "win32" ? 1 : 0,
    scanComplete: true,
  });
});

it("marks the scan unstable when a file changes during measurement", async () => {
  await fs.mkdir(path.join(root, "staging"), { recursive: true });
  const filePath = path.join(root, "staging/changing.part");
  await fs.writeFile(filePath, "before");

  const result = await inventoryStorageRoot(root, {
    afterFileStat: async (absolutePath) => {
      if (path.basename(absolutePath) === "changing.part") {
        await fs.appendFile(filePath, "-after");
      }
    },
  });
  const staging = result.areas.find((area) => area.area === "staging");

  expect(result.scanComplete).toBe(false);
  expect(staging).toMatchObject({
    changedFileCount: 1,
    scanComplete: false,
  });
});
