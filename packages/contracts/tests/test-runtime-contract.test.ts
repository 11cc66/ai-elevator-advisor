import { describe, expect, it } from "vitest";

import {
  isStrictTestRuntime,
  isVerifiedTestRuntime,
  TEST_DATABASE_NAME,
  TEST_DATABASE_ROLE,
} from "../src/index.js";

const base = {
  nodeEnvironment: "test",
  fileAccessMode: "test" as const,
  databaseName: TEST_DATABASE_NAME,
  databaseRole: TEST_DATABASE_ROLE,
};

describe("strict test runtime contract", () => {
  it("requires the complete fixed test identity", () => {
    expect(isStrictTestRuntime(base)).toBe(true);
    expect(
      isStrictTestRuntime({
        ...base,
        nodeEnvironment: undefined,
      }),
    ).toBe(false);
    expect(
      isStrictTestRuntime({
        ...base,
        nodeEnvironment: "development",
      }),
    ).toBe(false);
    expect(
      isStrictTestRuntime({
        ...base,
        nodeEnvironment: "staging",
      }),
    ).toBe(false);
    expect(
      isStrictTestRuntime({
        ...base,
        nodeEnvironment: "production",
      }),
    ).toBe(false);
    expect(
      isStrictTestRuntime({
        ...base,
        fileAccessMode: "enforce",
      }),
    ).toBe(false);
    expect(
      isStrictTestRuntime({
        ...base,
        databaseName: "elevator_advisor",
      }),
    ).toBe(false);
    expect(
      isStrictTestRuntime({
        ...base,
        databaseRole: "elevator_app",
      }),
    ).toBe(false);
  });

  it("requires the exact non-empty test database marker", () => {
    const verified = {
      ...base,
      databaseMarker: "test-marker",
      expectedDatabaseMarker: "test-marker",
    };

    expect(isVerifiedTestRuntime(verified)).toBe(true);
    expect(
      isVerifiedTestRuntime({
        ...verified,
        databaseMarker: "wrong-marker",
      }),
    ).toBe(false);
    expect(
      isVerifiedTestRuntime({
        ...verified,
        expectedDatabaseMarker: undefined,
      }),
    ).toBe(false);
  });
});
