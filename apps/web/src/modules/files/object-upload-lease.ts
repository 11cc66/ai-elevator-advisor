import type { PrismaClient } from "@prisma/client";

export class ObjectUploadLeaseLostError extends Error {
  constructor() {
    super("OBJECT_UPLOAD_LEASE_LOST");
    this.name = "ObjectUploadLeaseLostError";
  }
}

export interface ObjectUploadLeaseTarget {
  attemptId: string;
  stagingLifecycleId: string;
  canonicalLifecycleId: string;
  operationId: string;
  ownerToken: string;
  generation: bigint;
}

export async function renewObjectUploadLease(
  prisma: PrismaClient,
  target: ObjectUploadLeaseTarget,
  leaseExpiresAt: Date,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const operation = await tx.storageObjectOperation.updateMany({
      where: {
        id: target.operationId,
        ownerToken: target.ownerToken,
        fencingGeneration: target.generation,
        state: { in: ["PREPARED", "EXECUTING", "UNKNOWN"] },
      },
      data: { leaseExpiresAt },
    });
    const canonical = await tx.storageObjectLifecycle.updateMany({
      where: {
        id: target.canonicalLifecycleId,
        ownerToken: target.ownerToken,
        fencingGeneration: target.generation,
        state: "FINALIZING",
      },
      data: { leaseExpiresAt },
    });
    const staging = await tx.storageObjectLifecycle.updateMany({
      where: {
        id: target.stagingLifecycleId,
        ownerToken: target.ownerToken,
        fencingGeneration: target.generation,
        state: { in: ["STAGING", "STAGING_READY"] },
      },
      data: { leaseExpiresAt },
    });
    if (
      operation.count !== 1 ||
      canonical.count !== 1 ||
      staging.count !== 1
    ) {
      throw new ObjectUploadLeaseLostError();
    }
  });
}

export class ObjectUploadLeaseController {
  readonly #prisma: PrismaClient;
  readonly #target: ObjectUploadLeaseTarget;
  readonly #leaseMs: number;
  readonly #renewIntervalMs: number;
  readonly #abortController = new AbortController();
  #timer: ReturnType<typeof setInterval> | undefined;
  #renewing: Promise<void> | undefined;
  #lost = false;

  constructor(input: {
    prisma: PrismaClient;
    target: ObjectUploadLeaseTarget;
    leaseMs: number;
    renewIntervalMs: number;
  }) {
    if (
      input.leaseMs <= 0 ||
      input.renewIntervalMs <= 0 ||
      input.renewIntervalMs >= input.leaseMs
    ) {
      throw new Error("OBJECT_UPLOAD_LEASE_CONFIGURATION_INVALID");
    }
    this.#prisma = input.prisma;
    this.#target = input.target;
    this.#leaseMs = input.leaseMs;
    this.#renewIntervalMs = input.renewIntervalMs;
  }

  get signal(): AbortSignal {
    return this.#abortController.signal;
  }

  get lost(): boolean {
    return this.#lost;
  }

  start(): void {
    if (this.#timer) {
      return;
    }
    this.#timer = setInterval(() => {
      if (this.#renewing) {
        return;
      }
      this.#renewing = this.#renew()
        .catch(() => {
          this.#lost = true;
          this.#abortController.abort();
        })
        .finally(() => {
          this.#renewing = undefined;
        });
    }, this.#renewIntervalMs);
    this.#timer.unref?.();
  }

  async assertHeld(): Promise<void> {
    const now = new Date();
    const operation = await this.#prisma.storageObjectOperation.findFirst({
      where: {
        id: this.#target.operationId,
        ownerToken: this.#target.ownerToken,
        fencingGeneration: this.#target.generation,
        state: { in: ["PREPARED", "EXECUTING", "UNKNOWN"] },
        leaseExpiresAt: { gt: now },
      },
      select: { id: true },
    });
    if (!operation || this.#lost) {
      this.#lost = true;
      this.#abortController.abort();
      throw new ObjectUploadLeaseLostError();
    }
  }

  async renewNow(): Promise<void> {
    await this.#renew();
  }

  async stop(): Promise<void> {
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = undefined;
    }
    await this.#renewing?.catch(() => undefined);
  }

  async #renew(): Promise<void> {
    await this.assertHeld();
    const leaseExpiresAt = new Date(Date.now() + this.#leaseMs);
    await renewObjectUploadLease(
      this.#prisma,
      this.#target,
      leaseExpiresAt,
    );
  }
}
