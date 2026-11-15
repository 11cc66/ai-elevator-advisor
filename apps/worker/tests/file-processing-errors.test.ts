import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { computeRetryAt } from "../src/file-processing-errors.js";
import { classifyFileProcessingError } from "../src/file-processing.js";

describe("file processing retry timing", () => {
  it("uses exponential backoff with a hard upper bound", () => {
    const now = new Date("2026-11-16T00:00:00.000Z");
    const attempts = [1, 2, 3, 4].map((attempt) =>
      computeRetryAt({
        now,
        attempt,
        baseDelaySeconds: 5,
        maxDelaySeconds: 20,
      }),
    );

    expect(attempts.map((date) => date.toISOString())).toEqual([
      "2026-11-16T00:00:05.000Z",
      "2026-11-16T00:00:10.000Z",
      "2026-11-16T00:00:20.000Z",
      "2026-11-16T00:00:20.000Z",
    ]);
  });

  it("classifies a temporarily unavailable database as retryable", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "database unavailable",
      {
        code: "P1001",
        clientVersion: "test",
      },
    );

    expect(classifyFileProcessingError(error)).toEqual({
      code: "DATABASE_TEMPORARILY_UNAVAILABLE",
      safeMessage: "数据库暂时不可用，将按策略重试。",
      failureClass: "TRANSIENT",
    });
  });
});
