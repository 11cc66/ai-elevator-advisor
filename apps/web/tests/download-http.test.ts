import { describe, expect, it } from "vitest";

import { downloadErrorResponse } from "../src/modules/files/download-http";
import { AppError } from "../src/server/http/errors";

describe("download HTTP errors", () => {
  it("returns a controlled retry response when resources are exhausted", () => {
    const response = downloadErrorResponse(
      new AppError(
        "DOWNLOAD_RESOURCE_BUSY",
        "当前下载请求较多，请稍后重试。",
        503,
      ),
      "request-download-busy",
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("1");
  });
});
