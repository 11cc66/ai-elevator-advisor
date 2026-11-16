import { describe, expect, it } from "vitest";

import { DownloadResourcePool } from "../src/modules/files/download-resource-pool";

describe("download resource pool", () => {
  it("enforces concurrency and byte budgets", () => {
    const pool = new DownloadResourcePool();
    const first = pool.acquire({
      bytes: 12,
      maxConcurrent: 2,
      maxBytes: 20,
    });
    const second = pool.acquire({
      bytes: 8,
      maxConcurrent: 2,
      maxBytes: 20,
    });
    const overCount = pool.acquire({
      bytes: 1,
      maxConcurrent: 2,
      maxBytes: 20,
    });

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(overCount).toBeNull();
    expect(pool.snapshot()).toEqual({
      activeCount: 2,
      activeBytes: 20,
      timeoutCount: 0,
      interruptionCount: 0,
    });

    first?.();
    first?.();
    expect(pool.snapshot()).toEqual({
      activeCount: 1,
      activeBytes: 8,
      timeoutCount: 0,
      interruptionCount: 0,
    });
  });

  it("rejects requests exceeding the byte budget and releases fully", () => {
    const pool = new DownloadResourcePool();
    expect(
      pool.acquire({
        bytes: 21,
        maxConcurrent: 2,
        maxBytes: 20,
      }),
    ).toBeNull();

    const release = pool.acquire({
      bytes: 20,
      maxConcurrent: 2,
      maxBytes: 20,
    });
    expect(
      pool.acquire({
        bytes: 1,
        maxConcurrent: 2,
        maxBytes: 20,
      }),
    ).toBeNull();
    release?.();
    expect(pool.snapshot()).toEqual({
      activeCount: 0,
      activeBytes: 0,
      timeoutCount: 0,
      interruptionCount: 0,
    });
  });

  it("records timeout and interruption counters", () => {
    const pool = new DownloadResourcePool();
    pool.recordTimeout();
    pool.recordInterruption();
    pool.recordInterruption();

    expect(pool.snapshot()).toEqual({
      activeCount: 0,
      activeBytes: 0,
      timeoutCount: 1,
      interruptionCount: 2,
    });
  });
});
