import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  auditStorageDeletePaths,
  type DeleteAllowlistEntry,
} from "../scripts/p13-storage-delete-audit/scanner";

const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));
let root = "";

beforeEach(async () => {
  root = await fs.mkdtemp(
    path.join(os.tmpdir(), "p13-storage-delete-audit-"),
  );
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

async function write(relativePath: string, content: string): Promise<void> {
  const absolutePath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content);
}

describe("storage delete path scanner", () => {
  it("finds production delete calls through static and dynamic imports", async () => {
    await write(
      "apps/web/src/entry.ts",
      [
        'import { remove } from "./helper.js";',
        'await import("./dynamic-helper.js");',
        "void remove;",
      ].join("\n"),
    );
    await write(
      "apps/web/src/helper.ts",
      "export function remove(storage: any) { return storage.removeObject('x'); }\n",
    );
    await write(
      "apps/web/src/dynamic-helper.ts",
      "export async function run(fs: any) { await fs.rm('x'); }\n",
    );

    const result = await auditStorageDeletePaths({
      workspaceRoot: root,
      sourceRoots: ["apps/web/src"],
      entryPoints: ["apps/web/src/entry.ts"],
      allowlist: [],
    });

    expect(result.reachableFileCount).toBe(3);
    expect(result.productionBlockingFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relativePath: "apps/web/src/helper.ts",
          marker: "remove-object",
        }),
        expect.objectContaining({
          relativePath: "apps/web/src/dynamic-helper.ts",
          marker: "fs-rm",
        }),
      ]),
    );
  });

  it("does not mistake quarantine declarations or string markers for delete calls", async () => {
    await write(
      "apps/web/src/entry.ts",
      'export const marker = "/\\\\.removeObject\\\\s*\\\\(/";\n',
    );
    await write(
      "packages/file-storage/src/legacy-cleanup.ts",
      [
        "export class QuarantinedLegacyStorageCleanup {",
        "  async removeObject(_key: string): Promise<void> {",
        "    throw new Error('disabled');",
        "  }",
        "}",
      ].join("\n"),
    );

    const result = await auditStorageDeletePaths({
      workspaceRoot: root,
      sourceRoots: ["apps/web/src", "packages/file-storage/src"],
      entryPoints: ["apps/web/src/entry.ts"],
      allowlist: [],
    });

    expect(result.findings).toEqual([]);
  });

  it("reports non-literal dynamic imports as unresolved", async () => {
    await write(
      "apps/web/src/entry.ts",
      [
        "const name = './plugin.js';",
        "await import(name);",
        "require(name);",
      ].join("\n"),
    );

    const result = await auditStorageDeletePaths({
      workspaceRoot: root,
      sourceRoots: ["apps/web/src"],
      entryPoints: ["apps/web/src/entry.ts"],
      allowlist: [],
    });

    expect(result.unresolvedDynamicImports).toHaveLength(2);
    expect(result.unresolvedDynamicImports).toEqual([
      expect.objectContaining({
        relativePath: "apps/web/src/entry.ts",
      }),
      expect.objectContaining({
        relativePath: "apps/web/src/entry.ts",
      }),
    ]);
  });

  it("classifies explicit build/test allowlist entries without hiding unknown calls", async () => {
    await write(
      "apps/web/scripts/build-secure.ts",
      "await fs.rm(buildRoot, { recursive: true });\n",
    );
    await write(
      "apps/web/src/unsafe.ts",
      "await fs.rm(unknownRoot, { recursive: true });\n",
    );
    const allowlist: DeleteAllowlistEntry[] = [
      {
        relativePath: "apps/web/scripts/build-secure.ts",
        marker: "fs-rm",
        classification: "BUILD_TEMP",
      },
    ];

    const result = await auditStorageDeletePaths({
      workspaceRoot: root,
      sourceRoots: ["apps/web/src", "apps/web/scripts"],
      entryPoints: ["apps/web/src/unsafe.ts"],
      allowlist,
    });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relativePath: "apps/web/scripts/build-secure.ts",
          classification: "BUILD_TEMP",
        }),
        expect.objectContaining({
          relativePath: "apps/web/src/unsafe.ts",
          classification: "PRODUCTION_BLOCKED",
        }),
      ]),
    );
  });

  it("fails closed when a configured source root is missing", async () => {
    await expect(
      auditStorageDeletePaths({
        workspaceRoot: root,
        sourceRoots: ["apps/web/missing-source"],
        entryPoints: [],
        allowlist: [],
      }),
    ).rejects.toThrow("SOURCE_ROOT_MISSING");
  });
});

describe("repository storage delete audit", () => {
  it("has no unallowlisted production physical delete calls", async () => {
    const result = await auditStorageDeletePaths({
      workspaceRoot,
    });

    expect(result.unresolvedDynamicImports).toEqual([]);
    expect(result.productionBlockingFindings).toEqual([]);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relativePath: "apps/web/scripts/build-secure.ts",
          classification: "BUILD_TEMP",
        }),
        expect.objectContaining({
          relativePath: "apps/web/scripts/test-db/cli.ts",
          classification: "TEST_ROOT",
        }),
      ]),
    );
  });
});
