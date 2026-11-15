import { afterAll, beforeAll, expect, it } from "vitest";

import { verifyIsolatedTestFileEnvironment } from "../../src/modules/files/download-service";
import { readWebEnv } from "../../src/server/env";

const env = readWebEnv();
const originalNodeEnvironment = process.env.NODE_ENV;
const originalTestMarker = process.env.TEST_DATABASE_MARKER;

function setNodeEnvironment(value: string | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, "NODE_ENV");
  } else {
    Reflect.set(process.env, "NODE_ENV", value);
  }
}

beforeAll(() => {
  setNodeEnvironment("test");
});

afterAll(() => {
  setNodeEnvironment(originalNodeEnvironment);
  if (originalTestMarker === undefined) {
    delete process.env.TEST_DATABASE_MARKER;
  } else {
    process.env.TEST_DATABASE_MARKER = originalTestMarker;
  }
});

it("requires an exact test runtime, fixed database identity and marker", async () => {
  expect(await verifyIsolatedTestFileEnvironment(env)).toBe(true);

  for (const nodeEnvironment of [
    undefined,
    "development",
    "staging",
    "production",
  ]) {
    setNodeEnvironment(nodeEnvironment);
    expect(await verifyIsolatedTestFileEnvironment(env)).toBe(false);
  }

  setNodeEnvironment("test");
  process.env.TEST_DATABASE_MARKER = "incorrect-test-marker";
  expect(await verifyIsolatedTestFileEnvironment(env)).toBe(false);
});
