import { describe, expect, it } from "vitest";

import {
  AppError,
  getErrorStatus,
  toApiError,
} from "../src/server/http/errors";

describe("API error handling", () => {
  it("keeps an explicitly public application error", () => {
    const error = new AppError("PROJECT_NOT_FOUND", "项目不存在。", 404);
    const body = toApiError(error, "request-1");

    expect(body.error.code).toBe("PROJECT_NOT_FOUND");
    expect(getErrorStatus(error)).toBe(404);
  });

  it("does not expose an unknown internal error", () => {
    const body = toApiError(
      new Error("internal database failure with sensitive details"),
      "request-2",
    );

    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).not.toContain("sensitive details");
    expect(getErrorStatus(new Error("internal"))).toBe(500);
  });
});
