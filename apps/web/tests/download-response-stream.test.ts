import { describe, expect, it, vi } from "vitest";

import { DownloadResourcePool } from "../src/modules/files/download-resource-pool";
import { createVerifiedDownloadStream } from "../src/modules/files/download-response-stream";

function waitForTask(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("verified download Web stream", () => {
  it("holds the resource until a delayed Web reader consumes the buffer", async () => {
    const body = Buffer.from("%PDF-1.7\nverified");
    const release = vi.fn();
    const stream = createVerifiedDownloadStream(body, release);
    const response = new Response(stream);

    await waitForTask();
    expect(release).not.toHaveBeenCalled();

    const reader = response.body!.getReader();
    const first = await reader.read();
    expect(first.done).toBe(false);
    expect(Buffer.from(first.value!)).toEqual(body);

    const second = await reader.read();
    expect(second.done).toBe(true);
    await waitForTask();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("expires an unread Web stream after the absolute timeout", async () => {
    const release = vi.fn();
    const onInterrupted = vi.fn();
    const stream = createVerifiedDownloadStream(
      Buffer.from("verified"),
      release,
      {
        timeoutMs: 20,
        onInterrupted,
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(onInterrupted).toHaveBeenCalledTimes(1);
    expect(onInterrupted).toHaveBeenCalledWith("RESPONSE_TIMEOUT");
    expect(release).toHaveBeenCalledTimes(1);

    const reader = stream.getReader();
    await expect(reader.read()).rejects.toThrow(
      "DOWNLOAD_RESPONSE_TIMEOUT",
    );
  });

  it("reads the complete verified buffer and releases exactly once", async () => {
    const body = Buffer.from("verified response body");
    const release = vi.fn();
    const onInterrupted = vi.fn();
    const stream = createVerifiedDownloadStream(body, release, {
      timeoutMs: 100,
      onInterrupted,
    });
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const result = await reader.read();
      if (result.done) {
        break;
      }
      chunks.push(result.value);
    }

    await waitForTask();
    expect(Buffer.concat(chunks)).toEqual(body);
    expect(release).toHaveBeenCalledTimes(1);
    expect(onInterrupted).not.toHaveBeenCalled();
  });

  it("releases and records one interruption when the Web stream is canceled", async () => {
    const release = vi.fn();
    const onInterrupted = vi.fn();
    const stream = createVerifiedDownloadStream(
      Buffer.from("verified"),
      release,
      { onInterrupted },
    );

    await waitForTask();
    await stream.cancel("client-abort");
    await stream.cancel("client-abort-again");
    await waitForTask();

    expect(release).toHaveBeenCalledTimes(1);
    expect(onInterrupted).toHaveBeenCalledTimes(1);
    expect(onInterrupted).toHaveBeenCalledWith(
      "RESPONSE_STREAM_ABORTED",
    );
  });

  it("releases even when interruption auditing throws", async () => {
    const release = vi.fn();
    const onInterrupted = vi.fn(() => {
      throw new Error("audit unavailable");
    });
    const stream = createVerifiedDownloadStream(
      Buffer.from("verified"),
      release,
      { onInterrupted },
    );

    await waitForTask();
    await stream.cancel("client-abort");

    expect(onInterrupted).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("settles abort, cancel and timeout races exactly once", async () => {
    const abortController = new AbortController();
    const release = vi.fn();
    const onInterrupted = vi.fn();
    const stream = createVerifiedDownloadStream(
      Buffer.from("verified"),
      release,
      {
        timeoutMs: 10,
        signal: abortController.signal,
        onInterrupted,
      },
    );

    await waitForTask();
    abortController.abort();
    await stream.cancel("client-abort").catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(release).toHaveBeenCalledTimes(1);
    expect(onInterrupted).toHaveBeenCalledTimes(1);
    expect(onInterrupted).toHaveBeenCalledWith(
      "RESPONSE_STREAM_ABORTED",
    );
  });

  it("keeps delayed streams within the four-request and 64 MiB budget", async () => {
    const pool = new DownloadResourcePool();
    const maxConcurrent = 4;
    const maxBytes = 64 * 1024 * 1024;
    const streams: ReadableStream<Uint8Array>[] = [];

    for (let index = 0; index < maxConcurrent; index += 1) {
      const bytes = 16 * 1024 * 1024;
      const release = pool.acquire({
        bytes,
        maxConcurrent,
        maxBytes,
      });
      expect(release).not.toBeNull();
      streams.push(
        createVerifiedDownloadStream(
          Buffer.alloc(bytes, index),
          release!,
          { timeoutMs: 60_000 },
        ),
      );
    }

    await waitForTask();
    expect(pool.snapshot()).toMatchObject({
      activeCount: 4,
      activeBytes: maxBytes,
    });
    expect(
      pool.acquire({
        bytes: 1,
        maxConcurrent,
        maxBytes,
      }),
    ).toBeNull();

    await Promise.all(streams.map((stream) => stream.cancel()));
    await waitForTask();
    expect(pool.snapshot()).toMatchObject({
      activeCount: 0,
      activeBytes: 0,
    });
  });
});
