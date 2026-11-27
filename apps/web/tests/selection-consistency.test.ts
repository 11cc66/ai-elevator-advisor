import { describe, expect, it } from "vitest";

import { resolveCurrentSelectionRun } from "../src/modules/workbench/selection-consistency";

const currentRequirementId = "requirement-current";

function run(input: {
  id: string;
  requirementId?: string;
  status?: string;
  createdAt: string;
}) {
  return {
    id: input.id,
    requirementId: input.requirementId ?? currentRequirementId,
    status: input.status ?? "COMPLETED",
    createdAt: new Date(input.createdAt),
  };
}

describe("resolveCurrentSelectionRun", () => {
  it("A: returns a completed run linked to the current requirement", () => {
    const current = run({
      id: "run-current",
      createdAt: "2026-11-27T01:00:00.000Z",
    });
    const resolution = resolveCurrentSelectionRun(
      currentRequirementId,
      [current],
    );

    expect(resolution).toEqual({ kind: "CURRENT", run: current });
  });

  it("B: does not use an old completed run when the current requirement has no run", () => {
    const old = run({
      id: "run-old",
      requirementId: "requirement-old",
      createdAt: "2026-11-27T05:00:00.000Z",
    });

    expect(
      resolveCurrentSelectionRun(currentRequirementId, [old]),
    ).toEqual({ kind: "NO_MATCH" });
  });

  it("C: finds the current requirement run even when an old run is newer", () => {
    const current = run({
      id: "run-current",
      createdAt: "2026-11-27T01:00:00.000Z",
    });
    const newerOld = run({
      id: "run-old",
      requirementId: "requirement-old",
      createdAt: "2026-11-27T05:00:00.000Z",
    });

    expect(
      resolveCurrentSelectionRun(currentRequirementId, [
        newerOld,
        current,
      ]),
    ).toEqual({ kind: "CURRENT", run: current });
  });

  it("D: uses timestamp rather than array position for multiple current runs", () => {
    const older = run({
      id: "run-current-older",
      createdAt: "2026-11-27T01:00:00.000Z",
    });
    const newer = run({
      id: "run-current-newer",
      createdAt: "2026-11-27T02:00:00.000Z",
    });

    expect(
      resolveCurrentSelectionRun(currentRequirementId, [newer, older]),
    ).toEqual({ kind: "CURRENT", run: newer });
  });

  it("E: returns the current non-completed run instead of an old completed run", () => {
    const old = run({
      id: "run-old-completed",
      requirementId: "requirement-old",
      createdAt: "2026-11-27T05:00:00.000Z",
    });
    const currentPending = run({
      id: "run-current-pending",
      status: "PROCESSING",
      createdAt: "2026-11-27T01:00:00.000Z",
    });
    const resolution = resolveCurrentSelectionRun(
      currentRequirementId,
      [old, currentPending],
    );

    expect(resolution).toEqual({
      kind: "CURRENT",
      run: currentPending,
    });
    expect(
      resolution.kind === "CURRENT" &&
        resolution.run.status === "COMPLETED",
    ).toBe(false);
  });

  it("F: returns NO_REQUIREMENT when no current requirement exists", () => {
    const old = run({
      id: "run-old",
      requirementId: "requirement-old",
      createdAt: "2026-11-27T05:00:00.000Z",
    });

    expect(resolveCurrentSelectionRun(null, [old])).toEqual({
      kind: "NO_REQUIREMENT",
    });
  });

  it("is conservative when the newest matching runs have equal timestamps", () => {
    const first = run({
      id: "run-a",
      createdAt: "2026-11-27T01:00:00.000Z",
    });
    const second = run({
      id: "run-b",
      createdAt: "2026-11-27T01:00:00.000Z",
    });

    expect(
      resolveCurrentSelectionRun(currentRequirementId, [first, second]),
    ).toEqual({ kind: "AMBIGUOUS" });
  });

  it("is conservative when a matching timestamp is invalid", () => {
    const invalid = {
      ...run({
        id: "run-invalid",
        createdAt: "2026-11-27T01:00:00.000Z",
      }),
      createdAt: new Date(Number.NaN),
    };

    expect(
      resolveCurrentSelectionRun(currentRequirementId, [invalid]),
    ).toEqual({ kind: "INVALID_TIMESTAMP" });
  });
});
