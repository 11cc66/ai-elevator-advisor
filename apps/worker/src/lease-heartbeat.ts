export class LeaseHeartbeat {
  readonly #intervalMs: number;
  readonly #renew: () => Promise<boolean>;
  readonly #onLost: (error: Error) => void;
  readonly abortController = new AbortController();
  #timer: NodeJS.Timeout | null = null;
  #inFlight: Promise<boolean> | null = null;
  #lostError: Error | null = null;
  #stopped = false;

  constructor(input: {
    intervalMs: number;
    renew: () => Promise<boolean>;
    onLost: (error: Error) => void;
  }) {
    this.#intervalMs = input.intervalMs;
    this.#renew = input.renew;
    this.#onLost = input.onLost;
  }

  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  get lost(): boolean {
    return this.#lostError !== null;
  }

  start(): void {
    if (this.#timer || this.#stopped) {
      return;
    }
    this.#timer = setInterval(() => {
      void this.renewNow();
    }, this.#intervalMs);
    this.#timer.unref();
  }

  async renewNow(): Promise<boolean> {
    if (this.#lostError) {
      return false;
    }
    if (this.#stopped) {
      return true;
    }
    if (this.#inFlight) {
      return this.#inFlight;
    }

    this.#inFlight = this.#renew()
      .then((renewed) => {
        if (!renewed) {
          this.markLost(
            new Error("LEASE_RENEWAL_REJECTED"),
          );
        }
        return renewed;
      })
      .catch(() => {
        this.markLost(new Error("LEASE_RENEWAL_UNAVAILABLE"));
        return false;
      })
      .finally(() => {
        this.#inFlight = null;
      });
    return this.#inFlight;
  }

  async assertHeld(): Promise<void> {
    if (this.#lostError) {
      throw this.#lostError;
    }
    if (!(await this.renewNow())) {
      throw this.#lostError ?? new Error("LEASE_LOST");
    }
  }

  markLost(error: Error): void {
    if (this.#lostError) {
      return;
    }
    this.#lostError = error;
    this.abortController.abort(error);
    this.#onLost(error);
  }

  async stop(): Promise<void> {
    this.#stopped = true;
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
    await this.#inFlight;
  }
}
