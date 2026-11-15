import { describe, expect, it } from "vitest";

import {
  readRuntimeNodeEnvironment,
  readWebEnv,
} from "../src/server/env";

const baseEnvironment = {
  DATABASE_URL: "postgresql://demo.invalid/elevator_advisor",
  BETTER_AUTH_URL: "http://127.0.0.1:3100",
  BETTER_AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
  PRIVATE_STORAGE_ROOT: "storage/private-test",
  FILE_ACCESS_MODE: "test",
};

describe("web runtime environment", () => {
  it("reads NODE_ENV through runtime reflection", () => {
    expect(
      readRuntimeNodeEnvironment({ NODE_ENV: "test" }),
    ).toBe("test");
    expect(
      readRuntimeNodeEnvironment({ NODE_ENV: "production" }),
    ).toBe("production");
  });

  it("does not provide a fallback for missing or non-string values", () => {
    expect(readRuntimeNodeEnvironment({})).toBeUndefined();
    expect(
      readRuntimeNodeEnvironment({
        NODE_ENV: 123,
      }),
    ).toBeUndefined();
  });

  it("places the runtime NODE_ENV into the validated environment snapshot", () => {
    expect(
      readWebEnv({
        ...baseEnvironment,
        NODE_ENV: "test",
      }).NODE_ENV,
    ).toBe("test");

    expect(
      readWebEnv({
        ...baseEnvironment,
        NODE_ENV: "production",
      }).NODE_ENV,
    ).toBe("production");

    expect(
      readWebEnv({
        ...baseEnvironment,
        NODE_ENV: 123,
      }).NODE_ENV,
    ).toBeUndefined();
  });
});
