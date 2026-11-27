export type ObjectUploadRecoveryAction =
  | "COMPLETED"
  | "WAIT_FOR_LEASE"
  | "RESUME_BEFORE_DISPATCH"
  | "DISCOVER_THEN_FINALIZE"
  | "FINALIZE_OBSERVED_VERSION"
  | "FAIL_CLOSED";

const OBJECT_WRITE_IDEMPOTENCY_PREFIX = "object-write:v1";

export function makeStorageLifecycleId(): string {
  return randomUUID().replaceAll("-", "");
}

export function makeObjectWriteIdempotencyKey(input: {
  attemptId: string;
  operationId: string;
}): string {
  return [
    OBJECT_WRITE_IDEMPOTENCY_PREFIX,
    input.attemptId,
    input.operationId,
  ].join(":");
}

export function isValidObjectWriteIdempotencyKey(input: {
  idempotencyKey: string | null | undefined;
  attemptId: string;
  operationId: string;
}): input is { idempotencyKey: string; attemptId: string; operationId: string } {
  return (
    input.idempotencyKey ===
    makeObjectWriteIdempotencyKey({
      attemptId: input.attemptId,
      operationId: input.operationId,
    })
  );
}

export function classifyObjectUploadRecovery(input: {
  intentCompleted: boolean;
  fileVersionExists: boolean;
  intentStatus: string;
  attemptStatus: string | null;
  operationState: string | null;
  bindingState: string | null;
  bindingObserved: boolean;
  leaseExpiresAt: Date | null;
  now: Date;
  discoverySupported: boolean;
}): ObjectUploadRecoveryAction {
  if (input.intentCompleted || input.fileVersionExists) {
    return "COMPLETED";
  }
  if (
    input.intentStatus !== "UPLOADING" ||
    !input.attemptStatus ||
    !input.operationState
  ) {
    return "FAIL_CLOSED";
  }
  if (
    input.leaseExpiresAt &&
    input.leaseExpiresAt.getTime() > input.now.getTime()
  ) {
    return "WAIT_FOR_LEASE";
  }
  if (
    input.attemptStatus === "WRITING" &&
    input.operationState === "PREPARED"
  ) {
    return "RESUME_BEFORE_DISPATCH";
  }
  if (
    (input.attemptStatus === "FINALIZING" ||
      input.attemptStatus === "RECOVERY_REQUIRED") &&
    (input.operationState === "EXECUTING" ||
      input.operationState === "UNKNOWN") &&
    input.bindingState === "PENDING"
  ) {
    if (input.bindingObserved) {
      return "FINALIZE_OBSERVED_VERSION";
    }
    return input.discoverySupported
      ? "DISCOVER_THEN_FINALIZE"
      : "FAIL_CLOSED";
  }
  return "FAIL_CLOSED";
}

export function isValidObjectStorageVersionId(
  providerVersionId: string | null | undefined,
): providerVersionId is string {
  return Boolean(
    providerVersionId &&
      providerVersionId.length > 0 &&
      providerVersionId.trim() === providerVersionId,
  );
}

export function operationTransitionAllowed(
  current: string,
  next: string,
): boolean {
  return (
    (current === "PREPARED" &&
      ["EXECUTING", "FAILED", "ABANDONED"].includes(next)) ||
    (current === "EXECUTING" &&
      ["APPLIED", "UNKNOWN", "FAILED"].includes(next)) ||
    (current === "UNKNOWN" &&
      ["APPLIED", "FAILED", "ABANDONED"].includes(next))
  );
}

export function attemptTransitionAllowed(
  current: string,
  next: string,
): boolean {
  return (
    (current === "RESERVED" &&
      ["WRITING", "ABANDONED", "FAILED"].includes(next)) ||
    (current === "WRITING" &&
      ["READY", "ABANDONED", "FAILED"].includes(next)) ||
    (current === "READY" &&
      ["FINALIZING", "ABANDONED", "FAILED"].includes(next)) ||
    (current === "FINALIZING" &&
      ["RECOVERY_REQUIRED", "COMPLETED"].includes(next)) ||
    (current === "RECOVERY_REQUIRED" &&
      ["COMPLETED", "FAILED"].includes(next))
  );
}

export function completedAttemptStagingAllowed(input: {
  storageBackend: string;
  lifecycleState: string;
}): boolean {
  return (
    input.lifecycleState === "DELETED" ||
    (["OBJECT_STORE", "LEGACY_LOCAL"].includes(input.storageBackend) &&
      input.lifecycleState === "STAGING_READY")
  );
}
import { randomUUID } from "node:crypto";

