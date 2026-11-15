import { describe, expect, it } from "vitest";

import { isSessionExpired } from "../src/modules/auth/session-time";

describe("session expiration", () => {
  it("rejects a session whose expiry is in the past", () => {
    expect(
      isSessionExpired(new Date(Date.now() - 1_000)),
    ).toBe(true);
  });

  it("rejects malformed expiry values", () => {
    expect(isSessionExpired("not-a-date")).toBe(true);
  });

  it("accepts a session whose expiry is in the future", () => {
    expect(
      isSessionExpired(new Date(Date.now() + 60_000)),
    ).toBe(false);
  });
});
