export type ProcessingFailureClass =
  | "TRANSIENT"
  | "PERMANENT"
  | "BLOCKED";

export class ClassifiedProcessingError extends Error {
  constructor(
    public readonly code: string,
    public readonly failureClass: ProcessingFailureClass,
    public readonly safeMessage: string,
  ) {
    super(code);
    this.name = "ClassifiedProcessingError";
  }
}

export class FileProcessingRetryError extends Error {
  constructor(
    public readonly code: string,
    public readonly attempt: number,
    public readonly retryAt: Date,
  ) {
    super("FILE_PROCESSING_RETRY_SCHEDULED");
    this.name = "FileProcessingRetryError";
  }
}

export class SimulatedWorkerCrashError extends Error {
  constructor(public readonly checkpoint: string) {
    super(`SIMULATED_WORKER_CRASH:${checkpoint}`);
    this.name = "SimulatedWorkerCrashError";
  }
}

export function permanentProcessingError(
  code: string,
  safeMessage: string,
): ClassifiedProcessingError {
  return new ClassifiedProcessingError(
    code,
    "PERMANENT",
    safeMessage,
  );
}

export function blockedProcessingError(
  code: string,
  safeMessage: string,
): ClassifiedProcessingError {
  return new ClassifiedProcessingError(code, "BLOCKED", safeMessage);
}

export function getSafeErrorCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return error instanceof Error ? error.name : "UNKNOWN_ERROR";
}

export function computeRetryAt(input: {
  now: Date;
  attempt: number;
  baseDelaySeconds: number;
  maxDelaySeconds: number;
}): Date {
  const exponent = Math.max(0, input.attempt - 1);
  const delaySeconds = Math.min(
    input.baseDelaySeconds * 2 ** exponent,
    input.maxDelaySeconds,
  );
  return new Date(input.now.getTime() + delaySeconds * 1_000);
}
