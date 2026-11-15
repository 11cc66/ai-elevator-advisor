import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { LeaseHeartbeat } from "./lease-heartbeat.js";
import { logger } from "./logger.js";

const MAINTENANCE_LOCK_KEY = "file_maintenance_lease";

export class MaintenanceLeaseLostError extends Error {
  constructor() {
    super("MAINTENANCE_LEASE_LOST");
    this.name = "MaintenanceLeaseLostError";
  }
}

interface MaintenanceLeaseRecord {
  owner: string;
  expiresAt: Date;
}

async function readLease(
  prisma: PrismaClient,
): Promise<MaintenanceLeaseRecord | null> {
  const rows = await prisma.$queryRaw<
    Array<{ owner: string | null; expiresAt: Date | null }>
  >`
    SELECT
      "value"->>'owner' AS "owner",
      ("value"->>'expiresAt')::timestamptz AS "expiresAt"
    FROM "system_metadata"
    WHERE "key" = ${MAINTENANCE_LOCK_KEY}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row?.owner || !row.expiresAt) {
    return null;
  }
  return { owner: row.owner, expiresAt: row.expiresAt };
}

export async function acquireMaintenanceLease(input: {
  prisma: PrismaClient;
  leaseMs: number;
  now: Date;
}): Promise<{
  owner: string;
  expiresAt: Date;
} | null> {
  const owner = randomUUID();
  const expiresAt = new Date(input.now.getTime() + input.leaseMs);
  const payload = JSON.stringify({
    owner,
    fencingToken: owner,
    expiresAt: expiresAt.toISOString(),
  });
  const rows = await input.prisma.$queryRaw<
    Array<{ owner: string | null }>
  >`
    INSERT INTO "system_metadata"
      ("id", "key", "value", "created_at", "updated_at")
    VALUES
      (
        ${randomUUID()},
        ${MAINTENANCE_LOCK_KEY},
        ${payload}::jsonb,
        ${input.now},
        ${input.now}
      )
    ON CONFLICT ("key") DO UPDATE
    SET
      "value" = EXCLUDED."value",
      "updated_at" = EXCLUDED."updated_at"
    WHERE COALESCE(
      ("system_metadata"."value"->>'expiresAt')::timestamptz,
      '-infinity'::timestamptz
    ) < ${input.now}
    RETURNING "value"->>'owner' AS "owner"
  `;

  return rows[0]?.owner === owner ? { owner, expiresAt } : null;
}

export class MaintenanceLeaseController {
  readonly owner: string;
  readonly heartbeat: LeaseHeartbeat;
  readonly #prisma: PrismaClient;
  readonly #leaseMs: number;

  constructor(input: {
    prisma: PrismaClient;
    owner: string;
    leaseMs: number;
    renewIntervalMs: number;
  }) {
    this.#prisma = input.prisma;
    this.#leaseMs = input.leaseMs;
    this.owner = input.owner;
    this.heartbeat = new LeaseHeartbeat({
      intervalMs: input.renewIntervalMs,
      renew: () => this.renew(),
      onLost: () => {
        logger.warn(
          {
            event: "file.maintenance.lease_lost",
          },
          "File maintenance lease was lost",
        );
      },
    });
  }

  start(): void {
    this.heartbeat.start();
  }

  async assertHeld(): Promise<void> {
    try {
      await this.heartbeat.assertHeld();
    } catch {
      throw new MaintenanceLeaseLostError();
    }
  }

  async renew(): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.#leaseMs);
    const rows = await this.#prisma.$queryRaw<
      Array<{ owner: string | null }>
    >`
      UPDATE "system_metadata"
      SET
        "value" = jsonb_set(
          "value",
          '{expiresAt}',
          to_jsonb(${expiresAt.toISOString()}::text)
        ),
        "updated_at" = ${now}
      WHERE "key" = ${MAINTENANCE_LOCK_KEY}
        AND "value"->>'owner' = ${this.owner}
        AND ("value"->>'expiresAt')::timestamptz > ${now}
      RETURNING "value"->>'owner' AS "owner"
    `;
    return rows[0]?.owner === this.owner;
  }

  async stop(): Promise<void> {
    await this.heartbeat.stop();
  }

  async release(): Promise<void> {
    const now = new Date();
    await this.#prisma.$executeRaw`
      UPDATE "system_metadata"
      SET
        "value" = jsonb_set(
          "value",
          '{expiresAt}',
          to_jsonb(${now.toISOString()}::text)
        ),
        "updated_at" = ${now}
      WHERE "key" = ${MAINTENANCE_LOCK_KEY}
        AND "value"->>'owner' = ${this.owner}
        AND ("value"->>'expiresAt')::timestamptz > ${now}
    `;
  }

  async inspect(): Promise<MaintenanceLeaseRecord | null> {
    return readLease(this.#prisma);
  }
}
