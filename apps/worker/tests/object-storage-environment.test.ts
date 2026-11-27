import path from "node:path";

import { LocalObjectStorageAdapter } from "@elevator/file-storage";
import { describe, expect, it } from "vitest";

import { createWorkerObjectStorageForEnvironment } from "../src/storage.js";

describe("Worker local object adapter environment factory", () => {
  const env = {
    PRIVATE_STORAGE_ROOT: path.join("storage", "private"),
  };

  it.each(["development", "test"])(
    "selects local storage only for explicit %s",
    (environment) => {
      expect(
        createWorkerObjectStorageForEnvironment(environment, env),
      ).toBeInstanceOf(LocalObjectStorageAdapter);
    },
  );

  it.each([undefined, "", "staging", "production", "unknown", "Test"])(
    "fails closed for %s",
    (environment) => {
      expect(
        createWorkerObjectStorageForEnvironment(environment, env),
      ).toBeUndefined();
    },
  );
});
