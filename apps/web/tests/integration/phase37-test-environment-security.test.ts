import { afterAll, expect, it } from "vitest";

import { verifyIsolatedTestFileEnvironment } from "../../src/modules/files/download-service";
import {
  readRuntimeNodeEnvironment,
  readWebEnv,
} from "../../src/server/env";

const originalTestMarker = process.env.TEST_DATABASE_MARKER;

function buildEnvironment(value: string | undefined) {
  const source = { ...process.env };
  if (value === undefined) {
    Reflect.deleteProperty(source, "NODE_ENV");
  } else {
    Reflect.set(source, "NODE_ENV", value);
  }
  return readWebEnv(source);
}

afterAll(() => {
  if (originalTestMarker === undefined) {
    delete process.env.TEST_DATABASE_MARKER;
  } else {
    process.env.TEST_DATABASE_MARKER = originalTestMarker;
  }
});

it("reads NODE_ENV from the real runtime without accepting invalid values", () => {
  expect(
    readRuntimeNodeEnvironment({ NODE_ENV: "test" }),
  ).toBe("test");
  expect(readRuntimeNodeEnvironment({})).toBeUndefined();
  expect(
    readRuntimeNodeEnvironment({
      NODE_ENV: 123,
    }),
  ).toBeUndefined();
});

it("requires an exact test runtime, fixed database identity and marker", async () => {
  expect(
    await verifyIsolatedTestFileEnvironment(
      buildEnvironment("test"),
    ),
  ).toBe(true);

  for (const nodeEnvironment of [
    undefined,
    "development",
    "staging",
    "production",
    "preview",
  ]) {
    expect(
      await verifyIsolatedTestFileEnvironment(
        buildEnvironment(nodeEnvironment),
      ),
    ).toBe(false);
  }

  process.env.TEST_DATABASE_MARKER = "incorrect-test-marker";
  expect(
    await verifyIsolatedTestFileEnvironment(
      buildEnvironment("test"),
    ),
  ).toBe(false);
});
