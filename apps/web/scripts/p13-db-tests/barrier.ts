export interface ConnectionBarrier {
  declare(key: string, participantIds: readonly string[]): void;
  arriveAndWait(key: string, participantId: string): Promise<void>;
  reset(key?: string): void;
}

export class BarrierTimeoutError extends Error {
  constructor(public readonly key: string) {
    super(`P13_BARRIER_TIMEOUT:${key}`);
    this.name = "BarrierTimeoutError";
  }
}

export class BarrierResetError extends Error {
  constructor(public readonly key: string) {
    super(`P13_BARRIER_RESET:${key}`);
    this.name = "BarrierResetError";
  }
}

interface BarrierState {
  key: string;
  expected: ReadonlySet<string>;
  arrived: Set<string>;
  waiters: Map<
    string,
    {
      resolve: () => void;
      reject: (error: Error) => void;
    }
  >;
  settled: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * In-process barrier for two database connections driven by one test process.
 * Cross-process barriers remain NOT_IMPLEMENTED.
 */
export class InMemoryConnectionBarrier implements ConnectionBarrier {
  private readonly barriers = new Map<string, BarrierState>();

  constructor(private readonly timeoutMs = 5_000) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error("P13_BARRIER_TIMEOUT_INVALID");
    }
  }

  declare(key: string, participantIds: readonly string[]): void {
    if (participantIds.length === 0) {
      throw new Error("P13_BARRIER_EMPTY");
    }
    if (new Set(participantIds).size !== participantIds.length) {
      throw new Error("P13_BARRIER_DUPLICATE_PARTICIPANT");
    }
    if (this.barriers.has(key)) {
      throw new Error(`P13_BARRIER_ALREADY_DECLARED:${key}`);
    }

    this.barriers.set(key, {
      key,
      expected: new Set(participantIds),
      arrived: new Set(),
      waiters: new Map(),
      settled: false,
      timer: null,
    });
  }

  async arriveAndWait(key: string, participantId: string): Promise<void> {
    const barrier = this.barriers.get(key);
    if (!barrier) {
      throw new Error(`P13_BARRIER_NOT_DECLARED:${key}`);
    }
    if (!barrier.expected.has(participantId)) {
      throw new Error(
        `P13_BARRIER_UNKNOWN_PARTICIPANT:${key}:${participantId}`,
      );
    }
    if (barrier.arrived.has(participantId)) {
      throw new Error(
        `P13_BARRIER_DUPLICATE_ARRIVAL:${key}:${participantId}`,
      );
    }

    const wait = new Promise<void>((resolve, reject) => {
      barrier.waiters.set(participantId, { resolve, reject });
    });
    barrier.arrived.add(participantId);

    if (barrier.timer === null) {
      barrier.timer = setTimeout(() => {
        this.settleBarrier(
          barrier,
          new BarrierTimeoutError(key),
        );
      }, this.timeoutMs);
    }

    if (barrier.arrived.size === barrier.expected.size) {
      this.settleBarrier(barrier, null);
    }

    return wait;
  }

  reset(key?: string): void {
    if (key !== undefined) {
      const barrier = this.barriers.get(key);
      if (barrier) {
        this.settleBarrier(
          barrier,
          new BarrierResetError(key),
        );
      }
      return;
    }

    for (const barrier of [...this.barriers.values()]) {
      this.settleBarrier(
        barrier,
        new BarrierResetError(barrier.key),
      );
    }
  }

  private settleBarrier(
    barrier: BarrierState,
    error: Error | null,
  ): void {
    if (barrier.settled) {
      return;
    }

    barrier.settled = true;
    if (barrier.timer !== null) {
      clearTimeout(barrier.timer);
      barrier.timer = null;
    }

    if (error) {
      for (const waiter of barrier.waiters.values()) {
        waiter.reject(error);
      }
    } else {
      for (const waiter of barrier.waiters.values()) {
        waiter.resolve();
      }
    }

    this.barriers.delete(barrier.key);
  }
}
