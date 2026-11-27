import { describe, expect, it } from "vitest";

import {
  isExplicitLocalObjectStorageEnvironment,
  isObjectStorageAdapterAllowed,
} from "../src/index.js";

describe("local object storage environment gate", () => {
  it.each([
    ["development", true],
    ["test", true],
    ["staging", false],
    ["production", false],
    [undefined, false],
    ["", false],
    ["Development", false],
    ["test ", false],
  ] as const)("classifies %s as %s", (environment, allowed) => {
    expect(
      isExplicitLocalObjectStorageEnvironment(environment),
    ).toBe(allowed);
  });

  it("permits LOCAL_DEVELOPMENT only in explicit local environments", () => {
    expect(
      isObjectStorageAdapterAllowed("LOCAL_DEVELOPMENT", "development"),
    ).toBe(true);
    expect(
      isObjectStorageAdapterAllowed("LOCAL_DEVELOPMENT", "test"),
    ).toBe(true);
    expect(
      isObjectStorageAdapterAllowed("LOCAL_DEVELOPMENT", "staging"),
    ).toBe(false);
    expect(
      isObjectStorageAdapterAllowed("LOCAL_DEVELOPMENT", "production"),
    ).toBe(false);
    expect(isObjectStorageAdapterAllowed("LOCAL_DEVELOPMENT", undefined))
      .toBe(false);
    expect(isObjectStorageAdapterAllowed("", "test")).toBe(false);
    expect(isObjectStorageAdapterAllowed("FAKE_TEST", "test")).toBe(true);
  });
});
