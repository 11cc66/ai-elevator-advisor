export interface SelectionRunCandidate {
  id: string;
  requirementId: string;
  status: string;
  createdAt: Date;
}

export type CurrentSelectionResolution<T extends SelectionRunCandidate> =
  | {
      kind: "CURRENT";
      run: T;
    }
  | {
      kind:
        | "NO_REQUIREMENT"
        | "NO_MATCH"
        | "AMBIGUOUS"
        | "INVALID_TIMESTAMP";
    };

export function resolveCurrentSelectionRun<T extends SelectionRunCandidate>(
  requirementId: string | null | undefined,
  runs: readonly T[],
): CurrentSelectionResolution<T> {
  if (!requirementId) {
    return { kind: "NO_REQUIREMENT" };
  }

  const uniqueById = new Map<string, T>();
  for (const run of runs) {
    if (run.requirementId === requirementId) {
      uniqueById.set(run.id, run);
    }
  }

  const matching = [...uniqueById.values()];
  if (matching.length === 0) {
    return { kind: "NO_MATCH" };
  }

  const withTimestamps = matching.map((run) => ({
    run,
    time: run.createdAt.getTime(),
  }));
  if (withTimestamps.some(({ time }) => !Number.isFinite(time))) {
    return { kind: "INVALID_TIMESTAMP" };
  }

  const latestTime = Math.max(...withTimestamps.map(({ time }) => time));
  const latest = withTimestamps.filter(({ time }) => time === latestTime);
  if (latest.length !== 1) {
    return { kind: "AMBIGUOUS" };
  }
  const latestRun = latest[0];
  if (!latestRun) {
    return { kind: "AMBIGUOUS" };
  }

  return {
    kind: "CURRENT",
    run: latestRun.run,
  };
}
