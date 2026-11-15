import fs from "node:fs/promises";
import path from "node:path";

export class TestStorageRootError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "TestStorageRootError";
  }
}

interface StorageRootFileSystem {
  realpath: typeof fs.realpath;
  lstat: typeof fs.lstat;
  mkdir: typeof fs.mkdir;
}

function samePath(left: string, right: string): boolean {
  const normalize = (value: string) =>
    process.platform === "win32"
      ? path.resolve(value).toLowerCase()
      : path.resolve(value);
  return normalize(left) === normalize(right);
}

export function resolveTestStorageRootPath(
  workspace: string,
  configuredPath: string,
): string {
  const expected = path.join(
    path.resolve(workspace),
    "storage",
    "private-test",
  );
  const resolved = path.resolve(workspace, configuredPath);

  if (!samePath(resolved, expected)) {
    throw new TestStorageRootError(
      "TEST_STORAGE_ROOT_IDENTITY_MISMATCH",
    );
  }

  return expected;
}

export async function resolveVerifiedTestStorageRoot(
  workspace: string,
  configuredPath: string,
  fileSystem: StorageRootFileSystem = fs,
): Promise<string> {
  resolveTestStorageRootPath(workspace, configuredPath);
  const realWorkspace = await fileSystem.realpath(
    path.resolve(workspace),
  );
  const expectedReal = path.join(
    realWorkspace,
    "storage",
    "private-test",
  );
  const components = [
    path.join(realWorkspace, "storage"),
    expectedReal,
  ];

  for (const component of components) {
    try {
      const stats = await fileSystem.lstat(component);
      if (stats.isSymbolicLink()) {
        throw new TestStorageRootError(
          "TEST_STORAGE_SYMLINK_FORBIDDEN",
        );
      }
    } catch (error) {
      if (error instanceof TestStorageRootError) {
        throw error;
      }
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error
          ? (error as { code?: string }).code
          : undefined;
      if (code !== "ENOENT") {
        throw error;
      }
    }
  }

  await fileSystem.mkdir(expectedReal, { recursive: true });
  const realExpected = await fileSystem.realpath(expectedReal);

  if (!samePath(realExpected, expectedReal)) {
    throw new TestStorageRootError(
      "TEST_STORAGE_REALPATH_MISMATCH",
    );
  }

  return realExpected;
}
