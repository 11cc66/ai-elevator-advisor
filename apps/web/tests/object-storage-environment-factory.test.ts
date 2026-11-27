import os from "node:os";
import path from "node:path";

import { LocalObjectStorageAdapter } from "@elevator/file-storage";
import { describe, expect, it } from "vitest";

import { createObjectStorageAdapterForEnvironment } from "../src/server/files/storage";

describe("Web local object adapter environment factory", () => {
  const storageRoot = path.join(os.tmpdir(), "elevator-object-env-test");

  it.each(["development", "test"])(
    "selects local storage only for explicit %s",
    (environment) => {
      expect(
        createObjectStorageAdapterForEnvironment(environment, storageRoot),
      ).toBeInstanceOf(LocalObjectStorageAdapter);
    },
  );

  it.each([undefined, "", "staging", "production", "unknown", "Test"])(
    "fails closed for %s",
    (environment) => {
      expect(
        createObjectStorageAdapterForEnvironment(environment, storageRoot),
      ).toBeUndefined();
    },
  );
});
