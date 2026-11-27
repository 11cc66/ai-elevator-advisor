import { describe, expect, it } from "vitest";

import {
  attemptTransitionAllowed,
  classifyObjectUploadRecovery,
  completedAttemptStagingAllowed,
  isValidObjectStorageVersionId,
  isValidObjectWriteIdempotencyKey,
  makeObjectWriteIdempotencyKey,
  operationTransitionAllowed,
} from "../src/modules/files/object-upload-protocol";

const now = new Date("2026-11-26T00:00:00.000Z");

describe("object upload recovery protocol", () => {
  it("returns the existing result when a FileVersion or completed Intent exists", () => {
    expect(
      classifyObjectUploadRecovery({
        intentCompleted: true,
        fileVersionExists: false,
        intentStatus: "COMPLETED",
        attemptStatus: "COMPLETED",
        operationState: "APPLIED",
        bindingState: "VERIFIED",
        bindingObserved: true,
        leaseExpiresAt: null,
        now,
        discoverySupported: true,
      }),
    ).toBe("COMPLETED");
    expect(
      classifyObjectUploadRecovery({
        intentCompleted: false,
        fileVersionExists: true,
        intentStatus: "UPLOADING",
        attemptStatus: "COMPLETED",
        operationState: "APPLIED",
        bindingState: "VERIFIED",
        bindingObserved: true,
        leaseExpiresAt: null,
        now,
        discoverySupported: true,
      }),
    ).toBe("COMPLETED");
  });

  it("does not take over a live lease", () => {
    expect(
      classifyObjectUploadRecovery({
        intentCompleted: false,
        fileVersionExists: false,
        intentStatus: "UPLOADING",
        attemptStatus: "WRITING",
        operationState: "PREPARED",
        bindingState: "PENDING",
        bindingObserved: false,
        leaseExpiresAt: new Date(now.getTime() + 1),
        now,
        discoverySupported: true,
      }),
    ).toBe("WAIT_FOR_LEASE");
  });

  it("resumes only pre-dispatch work with a fresh Provider call", () => {
    expect(
      classifyObjectUploadRecovery({
        intentCompleted: false,
        fileVersionExists: false,
        intentStatus: "UPLOADING",
        attemptStatus: "WRITING",
        operationState: "PREPARED",
        bindingState: "PENDING",
        bindingObserved: false,
        leaseExpiresAt: new Date(now.getTime() - 1),
        now,
        discoverySupported: true,
      }),
    ).toBe("RESUME_BEFORE_DISPATCH");
  });

  it("discovers rather than rewrites after dispatch may have happened", () => {
    expect(
      classifyObjectUploadRecovery({
        intentCompleted: false,
        fileVersionExists: false,
        intentStatus: "UPLOADING",
        attemptStatus: "FINALIZING",
        operationState: "EXECUTING",
        bindingState: "PENDING",
        bindingObserved: false,
        leaseExpiresAt: new Date(now.getTime() - 1),
        now,
        discoverySupported: true,
      }),
    ).toBe("DISCOVER_THEN_FINALIZE");
  });

  it("finalizes a durably observed version without a second Provider write", () => {
    expect(
      classifyObjectUploadRecovery({
        intentCompleted: false,
        fileVersionExists: false,
        intentStatus: "UPLOADING",
        attemptStatus: "RECOVERY_REQUIRED",
        operationState: "UNKNOWN",
        bindingState: "PENDING",
        bindingObserved: true,
        leaseExpiresAt: new Date(now.getTime() - 1),
        now,
        discoverySupported: true,
      }),
    ).toBe("FINALIZE_OBSERVED_VERSION");
  });

  it("fails closed when discovery cannot distinguish an in-flight write", () => {
    expect(
      classifyObjectUploadRecovery({
        intentCompleted: false,
        fileVersionExists: false,
        intentStatus: "UPLOADING",
        attemptStatus: "FINALIZING",
        operationState: "UNKNOWN",
        bindingState: "PENDING",
        bindingObserved: false,
        leaseExpiresAt: new Date(now.getTime() - 1),
        now,
        discoverySupported: false,
      }),
    ).toBe("FAIL_CLOSED");
  });

  it.each([
    ["sha256:content", true],
    ["opaque-provider-version", true],
    ["", false],
    [" version-with-space", false],
    ["version-with-space ", false],
    [null, false],
    [undefined, false],
  ] as const)("validates Provider Version %s", (value, valid) => {
    expect(isValidObjectStorageVersionId(value)).toBe(valid);
  });

  it("uses only the frozen Operation transitions", () => {
    expect(operationTransitionAllowed("PREPARED", "EXECUTING")).toBe(true);
    expect(operationTransitionAllowed("EXECUTING", "APPLIED")).toBe(true);
    expect(operationTransitionAllowed("EXECUTING", "UNKNOWN")).toBe(true);
    expect(operationTransitionAllowed("UNKNOWN", "APPLIED")).toBe(true);
    expect(operationTransitionAllowed("PREPARED", "APPLIED")).toBe(false);
    expect(operationTransitionAllowed("APPLIED", "EXECUTING")).toBe(false);
  });

  it("uses only the frozen Attempt transitions", () => {
    expect(attemptTransitionAllowed("WRITING", "READY")).toBe(true);
    expect(attemptTransitionAllowed("READY", "FINALIZING")).toBe(true);
    expect(
      attemptTransitionAllowed("FINALIZING", "RECOVERY_REQUIRED"),
    ).toBe(true);
    expect(
      attemptTransitionAllowed("RECOVERY_REQUIRED", "COMPLETED"),
    ).toBe(true);
    expect(attemptTransitionAllowed("WRITING", "COMPLETED")).toBe(false);
  });

  it("allows only known backends to retain verified staging", () => {
    expect(
      completedAttemptStagingAllowed({
        storageBackend: "OBJECT_STORE",
        lifecycleState: "STAGING_READY",
      }),
    ).toBe(true);
    expect(
      completedAttemptStagingAllowed({
        storageBackend: "LEGACY_LOCAL",
        lifecycleState: "STAGING_READY",
      }),
    ).toBe(true);
    expect(
      completedAttemptStagingAllowed({
        storageBackend: "LEGACY_LOCAL",
        lifecycleState: "DELETED",
      }),
    ).toBe(true);
    expect(
      completedAttemptStagingAllowed({
        storageBackend: "UNKNOWN",
        lifecycleState: "STAGING_READY",
      }),
    ).toBe(false);
  });

  it("derives one immutable write identity per Attempt and Operation", () => {
    const first = makeObjectWriteIdempotencyKey({
      attemptId: "attempt-1",
      operationId: "operation-1",
    });
    const second = makeObjectWriteIdempotencyKey({
      attemptId: "attempt-1",
      operationId: "operation-2",
    });
    const third = makeObjectWriteIdempotencyKey({
      attemptId: "attempt-2",
      operationId: "operation-1",
    });

    expect(first).not.toBe(second);
    expect(first).not.toBe(third);
    expect(
      isValidObjectWriteIdempotencyKey({
        idempotencyKey: first,
        attemptId: "attempt-1",
        operationId: "operation-1",
      }),
    ).toBe(true);
    expect(
      isValidObjectWriteIdempotencyKey({
        idempotencyKey: first,
        attemptId: "attempt-2",
        operationId: "operation-1",
      }),
    ).toBe(false);
  });
});
