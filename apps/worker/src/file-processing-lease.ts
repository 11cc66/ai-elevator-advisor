import type { PrismaClient } from "@prisma/client";

import { LeaseHeartbeat } from "./lease-heartbeat.js";
import {
  renewFileExtractionLease,
  type ProcessingClaim,
} from "./file-processing-state.js";
import { logger } from "./logger.js";

export class FileProcessingLeaseLostError extends Error {
  constructor() {
    super("FILE_PROCESSING_LEASE_LOST");
    this.name = "FileProcessingLeaseLostError";
  }
}

export class FileProcessingLeaseController {
  readonly claim: ProcessingClaim;
  readonly heartbeat: LeaseHeartbeat;
  readonly #prisma: PrismaClient;
  readonly #leaseMs: number;

  constructor(input: {
    prisma: PrismaClient;
    claim: ProcessingClaim;
    leaseMs: number;
    renewIntervalMs: number;
  }) {
    this.#prisma = input.prisma;
    this.#leaseMs = input.leaseMs;
    this.claim = input.claim;
    this.heartbeat = new LeaseHeartbeat({
      intervalMs: input.renewIntervalMs,
      renew: () => this.renew(),
      onLost: () => {
        logger.warn(
          {
            event: "file.processing.lease_lost",
            extractionId: input.claim.extractionId,
            attempt: input.claim.attempt,
          },
          "File processing lease was lost",
        );
      },
    });
  }

  get signal(): AbortSignal {
    return this.heartbeat.signal;
  }

  get lost(): boolean {
    return this.heartbeat.lost;
  }

  start(): void {
    this.heartbeat.start();
  }

  async assertHeld(): Promise<void> {
    try {
      await this.heartbeat.assertHeld();
    } catch {
      throw new FileProcessingLeaseLostError();
    }
  }

  async renew(): Promise<boolean> {
    return renewFileExtractionLease(this.#prisma, {
      claim: this.claim,
      leaseMs: this.#leaseMs,
      now: new Date(),
    });
  }

  async stop(): Promise<void> {
    await this.heartbeat.stop();
  }
}
