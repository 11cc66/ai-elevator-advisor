import { describe, expect, it } from "vitest";

import {
  buildFileProcessingRetryOptions,
  FILE_PROCESSING_RETRY_DEFAULTS,
} from "../src/index";

describe("file processing retry contract", () => {
  it("maps maximum attempts to bounded pg-boss backoff options", () => {
    expect(
      buildFileProcessingRetryOptions({
        maxAttempts: 3,
        retryDelaySeconds: 5,
        retryDelayMaxSeconds: 60,
        jobExpireSeconds: 180,
      }),
    ).toEqual({
      retryLimit: 2,
      retryDelay: 5,
      retryBackoff: true,
      retryDelayMax: 60,
      expireInSeconds: 180,
    });
  });

  it("clamps invalid effective delays and supports a single attempt", () => {
    expect(
      buildFileProcessingRetryOptions({
        maxAttempts: 0,
        retryDelaySeconds: 10,
        retryDelayMaxSeconds: 3,
        jobExpireSeconds: 0,
      }),
    ).toEqual({
      retryLimit: 0,
      retryDelay: 10,
      retryBackoff: true,
      retryDelayMax: 10,
      expireInSeconds: 1,
    });
    expect(FILE_PROCESSING_RETRY_DEFAULTS.maxAttempts).toBe(3);
  });
});
