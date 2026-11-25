import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { PrismaClient } from "@prisma/client";
import type { PgBoss } from "pg-boss";
import { describe, expect, it, vi } from "vitest";

const leaseMocks = vi.hoisted(() => ({
  acquire: vi.fn(async () => ({
    owner: "test-maintenance-owner",
    expiresAt: new Date(Date.now() + 60_000),
  })),
  assertHeld: vi.fn(async () => undefined),
}));

vi.mock("../src/maintenance-lease.js", () => {
  class MaintenanceLeaseLostError extends Error {}

  class MaintenanceLeaseController {
    readonly owner = "test-maintenance-owner";

    start(): void {}

    async assertHeld(): Promise<void> {
      await leaseMocks.assertHeld();
    }

    async stop(): Promise<void> {}

    async release(): Promise<void> {}
  }

  return {
    MaintenanceLeaseLostError,
    MaintenanceLeaseController,
    acquireMaintenanceLease: leaseMocks.acquire,
  };
});

import { runFileMaintenance } from "../src/file-maintenance.js";
import { MaintenanceLeaseLostError } from "../src/maintenance-lease.js";
import { registerFileMaintenanceJob } from "../src/worker-entry.js";

describe("legacy worker cleanup shutdown", () => {
  it("runs database-only maintenance without any storage dependency", async () => {
    const prisma = {
      fileExtraction: {
        findMany: vi.fn(async () => []),
      },
    } as unknown as PrismaClient;
    const boss = {
      send: vi.fn(async () => "job-id"),
      sendAfter: vi.fn(async () => "job-id"),
    } as unknown as PgBoss;

    const result = await runFileMaintenance({
      prisma,
      boss,
      env: {
        FILE_MAINTENANCE_LEASE_MS: 60_000,
        FILE_MAINTENANCE_RENEW_INTERVAL_MS: 30_000,
        FILE_PROCESSING_MAX_ATTEMPTS: 3,
        FILE_PROCESSING_RETRY_DELAY_SECONDS: 5,
        FILE_PROCESSING_RETRY_MAX_SECONDS: 60,
        FILE_PROCESSING_JOB_EXPIRE_SECONDS: 180,
        TEMP_RETENTION_MS: 60_000,
      } as never,
    });

    expect(result).toMatchObject({
      skipped: false,
      requeued: 0,
      recoveredProcessing: 0,
      exhaustedProcessing: 0,
    });
    expect(result).not.toHaveProperty("storage");
    expect(result).not.toHaveProperty("removedOrphanObjects");
  });

  it("routes startup and scheduled jobs through the same non-deleting function", async () => {
    let registeredHandler:
      | (() => Promise<{ processed: number }>)
      | undefined;
    const work = vi.fn(
      async (
        _queue: string,
        _options: { batchSize: number },
        handler: () => Promise<{ processed: number }>,
      ) => {
        registeredHandler = handler;
        return "worker-id";
      },
    );
    const schedule = vi.fn(async () => undefined);
    const maintenanceRunner = vi.fn(
      async (_input: Parameters<typeof runFileMaintenance>[0]) => ({
        skipped: false,
        leaseLost: false,
        requeued: 0,
        recoveredProcessing: 0,
        exhaustedProcessing: 0,
      }),
    );
    const prisma = {} as PrismaClient;

    await registerFileMaintenanceJob({
      boss: {
        work,
        schedule,
        send: vi.fn(async () => "job-id"),
        sendAfter: vi.fn(async () => "job-id"),
      } as unknown as Pick<
        PgBoss,
        "work" | "schedule" | "send" | "sendAfter"
      >,
      prisma,
      env: {} as never,
      maintenanceRunner,
    });

    expect(schedule).toHaveBeenCalledWith(
      "file-maintenance",
      "*/15 * * * *",
      {},
      { key: "regular-file-maintenance" },
    );
    expect(maintenanceRunner).toHaveBeenCalledTimes(1);
    expect(maintenanceRunner.mock.calls[0]?.[0]).not.toHaveProperty(
      "storage",
    );

    await registeredHandler?.();

    expect(maintenanceRunner).toHaveBeenCalledTimes(2);
    expect(maintenanceRunner.mock.calls[1]?.[0]).not.toHaveProperty(
      "storage",
    );
  });

  it("fails closed when the maintenance lease is lost", async () => {
    leaseMocks.assertHeld.mockRejectedValueOnce(
      new MaintenanceLeaseLostError(),
    );
    const prisma = {
      fileExtraction: {
        findMany: vi.fn(async () => []),
      },
    } as unknown as PrismaClient;

    const result = await runFileMaintenance({
      prisma,
      boss: {
        send: vi.fn(),
        sendAfter: vi.fn(),
      } as unknown as PgBoss,
      env: {
        FILE_MAINTENANCE_LEASE_MS: 60_000,
        FILE_MAINTENANCE_RENEW_INTERVAL_MS: 30_000,
        FILE_PROCESSING_MAX_ATTEMPTS: 3,
        FILE_PROCESSING_RETRY_DELAY_SECONDS: 5,
        FILE_PROCESSING_RETRY_MAX_SECONDS: 60,
        FILE_PROCESSING_JOB_EXPIRE_SECONDS: 180,
      } as never,
    });

    expect(result).toMatchObject({
      skipped: true,
      leaseLost: true,
      requeued: 0,
    });
    expect(prisma.fileExtraction.findMany).not.toHaveBeenCalled();
  });

  it("keeps the gated entry and static call chain non-destructive", async () => {
    const indexSource = await fs.readFile(
      fileURLToPath(new URL("../src/index.ts", import.meta.url)),
      "utf8",
    );
    const maintenanceSource = await fs.readFile(
      fileURLToPath(new URL("../src/file-maintenance.ts", import.meta.url)),
      "utf8",
    );
    const workerEntrySource = await fs.readFile(
      fileURLToPath(new URL("../src/worker-entry.ts", import.meta.url)),
      "utf8",
    );

    expect(indexSource).toContain(
      'runWorkerBootstrap()',
    );
    expect(indexSource).not.toMatch(
      /^import .*["']\.\/worker-entry\.js["'];?$/m,
    );
    expect(workerEntrySource).toContain(
      "registerFileMaintenanceJob",
    );
    expect(workerEntrySource).not.toContain(
      "storage: LocalPrivateStorage",
    );
    expect(indexSource).not.toContain("cleanupOrphanObjects");
    expect(indexSource).not.toContain(".removeObject");
    expect(indexSource).not.toContain(".removeStaging");
    expect(maintenanceSource).not.toContain("cleanupOrphanObjects(");
    expect(maintenanceSource).not.toContain("cleanupTemp(");
    expect(maintenanceSource).not.toContain(".removeObject(");
    expect(maintenanceSource).not.toContain(".removeStaging(");
    expect(maintenanceSource).not.toContain(
      'fileUploadIntent.findMany',
    );
  });
});
