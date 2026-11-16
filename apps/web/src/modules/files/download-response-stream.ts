export type DownloadInterruptionReason =
  | "RESPONSE_TIMEOUT"
  | "RESPONSE_STREAM_ERROR"
  | "RESPONSE_STREAM_ABORTED";

function createAbortError(): Error {
  const error = new Error("Download request was aborted.");
  error.name = "AbortError";
  return error;
}

export function createVerifiedDownloadStream(
  body: Buffer,
  release: () => void,
  options?: {
    timeoutMs?: number;
    signal?: AbortSignal;
    onInterrupted?: (reason: DownloadInterruptionReason) => void;
  },
): ReadableStream<Uint8Array> {
  let controller:
    | ReadableStreamDefaultController<Uint8Array>
    | undefined;
  let phase: "waiting" | "enqueued" | "settled" = "waiting";
  let bufferedBody: Buffer | undefined = body;
  let released = false;
  let interruptionReported = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const releaseOnce = () => {
    if (released) {
      return;
    }
    released = true;
    release();
  };

  const reportInterruption = (reason: DownloadInterruptionReason) => {
    if (interruptionReported) {
      return;
    }
    interruptionReported = true;
    try {
      options?.onInterrupted?.(reason);
    } catch {
      // Interruption auditing is best-effort and must not block release.
    }
  };

  const detachSignal = () => {
    options?.signal?.removeEventListener("abort", handleAbort);
  };

  const stopTimer = () => {
    if (timeout) {
      clearTimeout(timeout);
    }
  };

  const settleNormally = () => {
    if (phase === "settled") {
      return;
    }
    phase = "settled";
    bufferedBody = undefined;
    stopTimer();
    detachSignal();
    releaseOnce();
  };

  const settleWithInterruption = (
    reason: DownloadInterruptionReason,
    error: unknown,
  ) => {
    if (phase === "settled") {
      return;
    }
    phase = "settled";
    bufferedBody = undefined;
    stopTimer();
    detachSignal();
    reportInterruption(reason);
    try {
      controller?.error(error);
    } catch {
      // The stream may already be canceled or errored.
    }
    releaseOnce();
  };

  function handleAbort() {
    settleWithInterruption(
      "RESPONSE_STREAM_ABORTED",
      createAbortError(),
    );
  }

  timeout =
    options?.timeoutMs === undefined
      ? undefined
      : setTimeout(() => {
          settleWithInterruption(
            "RESPONSE_TIMEOUT",
            new Error("DOWNLOAD_RESPONSE_TIMEOUT"),
          );
        }, options.timeoutMs);
  timeout?.unref();

  const stream = new ReadableStream<Uint8Array>(
    {
      start(streamController) {
        controller = streamController;
      },
      pull(streamController) {
        if (phase === "waiting") {
          if (!bufferedBody) {
            settleWithInterruption(
              "RESPONSE_STREAM_ERROR",
              new Error("DOWNLOAD_RESPONSE_BODY_MISSING"),
            );
            return;
          }
          try {
            streamController.enqueue(bufferedBody);
            phase = "enqueued";
          } catch (error) {
            settleWithInterruption("RESPONSE_STREAM_ERROR", error);
          }
          return;
        }

        if (phase === "enqueued") {
          try {
            streamController.close();
          } finally {
            settleNormally();
          }
        }
      },
      cancel() {
        if (phase === "settled") {
          return;
        }
        phase = "settled";
        bufferedBody = undefined;
        stopTimer();
        detachSignal();
        reportInterruption("RESPONSE_STREAM_ABORTED");
        releaseOnce();
      },
    },
    {
      highWaterMark: 1,
    },
  );

  if (options?.signal?.aborted) {
    handleAbort();
  } else {
    options?.signal?.addEventListener("abort", handleAbort, {
      once: true,
    });
  }

  return stream;
}
