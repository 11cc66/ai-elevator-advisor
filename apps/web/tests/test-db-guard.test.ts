import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertDevelopmentDatabaseAclIsolation,
  TestDatabaseIdentityError,
} from "../scripts/test-db/guard";
import {
  resolveTestStorageRootPath,
  resolveVerifiedTestStorageRoot,
  TestStorageRootError,
} from "../scripts/test-db/storage-root";

describe("test database ACL guard", () => {
  it("accepts a test role without development database access", () => {
    expect(() =>
      assertDevelopmentDatabaseAclIsolation({
        canConnectDevelopment: false,
        memberOfDevelopmentRole: false,
      }),
    ).not.toThrow();
  });

  it("rejects CONNECT or application role membership", () => {
    expect(() =>
      assertDevelopmentDatabaseAclIsolation({
        canConnectDevelopment: true,
        memberOfDevelopmentRole: false,
      }),
    ).toThrow(
      new TestDatabaseIdentityError(
        "TEST_ROLE_CAN_CONNECT_DEVELOPMENT",
      ),
    );
    expect(() =>
      assertDevelopmentDatabaseAclIsolation({
        canConnectDevelopment: false,
        memberOfDevelopmentRole: true,
      }),
    ).toThrow(
      new TestDatabaseIdentityError(
        "TEST_ROLE_MEMBER_OF_DEVELOPMENT_ROLE",
      ),
    );
  });
});

describe("test storage root guard", () => {
  const workspace = path.resolve(process.cwd(), "test-workspace");
  const safeRoot = path.join(
    workspace,
    "storage",
    "private-test",
  );

  it("rejects any storage path outside the fixed test directory", () => {
    expect(() =>
      resolveTestStorageRootPath(workspace, "storage/private"),
    ).toThrow(
      new TestStorageRootError(
        "TEST_STORAGE_ROOT_IDENTITY_MISMATCH",
      ),
    );
    expect(() =>
      resolveTestStorageRootPath(
        workspace,
        path.join(workspace, "..", "other", "storage", "private-test"),
      ),
    ).toThrow(
      new TestStorageRootError(
        "TEST_STORAGE_ROOT_IDENTITY_MISMATCH",
      ),
    );
  });

  it("accepts the canonical workspace test storage root", async () => {
    const root = await resolveVerifiedTestStorageRoot(
      workspace,
      "storage/private-test",
      {
        realpath: async (value: string) => String(value),
        lstat: async () => {
          throw Object.assign(new Error("missing"), { code: "ENOENT" });
        },
        mkdir: async () => undefined,
      } as never,
    );

    expect(root).toBe(safeRoot);
  });

  it("rejects a symlink or junction component", async () => {
    await expect(
      resolveVerifiedTestStorageRoot(
        workspace,
        "storage/private-test",
        {
          realpath: async (value: string) => String(value),
          lstat: async () => ({
            isSymbolicLink: () => true,
          }),
          mkdir: async () => undefined,
        } as never,
      ),
    ).rejects.toThrow(
      new TestStorageRootError("TEST_STORAGE_SYMLINK_FORBIDDEN"),
    );
  });

  it("rejects a realpath that escapes the canonical target", async () => {
    let realpathCalls = 0;

    await expect(
      resolveVerifiedTestStorageRoot(
        workspace,
        "storage/private-test",
        {
          realpath: async (value: string) => {
            realpathCalls += 1;
            return realpathCalls === 1
              ? String(value)
              : path.join(workspace, "..", "outside", "private-test");
          },
          lstat: async () => {
            throw Object.assign(new Error("missing"), {
              code: "ENOENT",
            });
          },
          mkdir: async () => undefined,
        } as never,
      ),
    ).rejects.toThrow(
      new TestStorageRootError("TEST_STORAGE_REALPATH_MISMATCH"),
    );
  });
});
