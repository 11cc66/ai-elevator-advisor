import type { WebEnv } from "@/server/env";

export class DownloadResourcePool {
  #activeCount = 0;
  #activeBytes = 0;
  #timeoutCount = 0;
  #interruptionCount = 0;

  acquire(input: {
    bytes: number;
    maxConcurrent: number;
    maxBytes: number;
  }): (() => void) | null {
    if (
      !Number.isSafeInteger(input.bytes) ||
      input.bytes <= 0 ||
      this.#activeCount >= input.maxConcurrent ||
      this.#activeBytes + input.bytes > input.maxBytes
    ) {
      return null;
    }

    this.#activeCount += 1;
    this.#activeBytes += input.bytes;
    let released = false;

    return () => {
      if (released) {
        return;
      }
      released = true;
      this.#activeCount -= 1;
      this.#activeBytes -= input.bytes;
    };
  }

  snapshot() {
    return {
      activeCount: this.#activeCount,
      activeBytes: this.#activeBytes,
      timeoutCount: this.#timeoutCount,
      interruptionCount: this.#interruptionCount,
    };
  }

  recordTimeout(): void {
    this.#timeoutCount += 1;
  }

  recordInterruption(): void {
    this.#interruptionCount += 1;
  }
}

export const downloadResourcePool = new DownloadResourcePool();

export function acquireDownloadResources(
  env: WebEnv,
  bytes: number,
): (() => void) | null {
  return downloadResourcePool.acquire({
    bytes,
    maxConcurrent: env.FILE_DOWNLOAD_MAX_CONCURRENT,
    maxBytes: env.FILE_DOWNLOAD_BUFFER_BUDGET_BYTES,
  });
}
