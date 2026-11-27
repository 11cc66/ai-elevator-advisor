import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { LocalPrivateStorage } from "@elevator/file-storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/prisma", async () => {
  const { sharedObjectUploadPrismaHarness } = await import(
    "./helpers/object-upload-prisma-harness"
  );
  return {
    prisma: sharedObjectUploadPrismaHarness,
  };
});

vi.mock("@/modules/audit/log", () => ({
  appendAuditLog: vi.fn(async () => undefined),
}));

vi.mock("@/server/jobs/file-recognition-queue", () => ({
  enqueueFileRecognition: vi.fn(async () => undefined),
}));

vi.mock("@/server/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import type { Actor } from "../src/modules/access/actor";
import { completeUpload } from "../src/modules/files/upload-service";
import { sharedObjectUploadPrismaHarness as harness } from "./helpers/object-upload-prisma-harness";

const PDF_BYTES = Buffer.from(
  "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
);
const actor: Actor = {
  userId: "user-1",
  globalPermissions: new Set(),
  projectPermissions: new Map(),
};

let root = "";

function upload(
  storage: LocalPrivateStorage,
  overrides: Partial<{
    nodeEnvironment: string;
    leaseMs: number;
  }> = {},
) {
  return completeUpload({
    actor,
    projectId: "project-1",
    intentId: "intent-1",
    requestContentLength: PDF_BYTES.byteLength,
    requestMimeType: "application/pdf",
    source: Readable.from([PDF_BYTES]),
    requestId: "request-1",
    storage,
    nodeEnvironment: overrides.nodeEnvironment ?? "test",
    leaseMs: overrides.leaseMs ?? 500,
  });
}

beforeEach(async () => {
  harness.reset();
  root = await fs.mkdtemp(path.join(os.tmpdir(), "elevator-local-recovery-"));
  harness.seedProject("project-1", "customer-1");
  harness.seedPendingIntent({
    id: "intent-1",
    projectId: "project-1",
    uploadedById: actor.userId,
  });
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("completeUpload local P1-3 recovery service", () => {
  it("publishes a normal local upload through the real service entry", async () => {
    const result = await upload(new LocalPrivateStorage(root));
    const state = harness.currentState();

    expect(result.version).toMatchObject({
      storageBackend: "LEGACY_LOCAL",
      uploadStatus: "UPLOADED",
      integrityStatus: "VERIFIED",
    });
    expect(state.intent?.status).toBe("COMPLETED");
    expect(state.attempt?.status).toBe("COMPLETED");
    expect(state.operation?.state).toBe("APPLIED");
    expect(state.fileVersions).toHaveLength(1);
    expect(
      [...harness.lifecycles.values()].filter(
        (row) =>
          row.objectKind === "CANONICAL" && row.state === "ACTIVE",
      ),
    ).toHaveLength(1);
  });

  it("recovers a staging-chain COMMIT response loss by identifiable state", async () => {
    harness.nextCommitResponseLoss = "LOCAL_STAGING";

    await expect(upload(new LocalPrivateStorage(root))).rejects.toMatchObject({
      code: "UPLOAD_RECOVERY_LEASE_ACTIVE",
    });
    expect(harness.currentState().intent?.status).toBe("UPLOADING");
    expect(
      [...harness.lifecycles.values()].filter(
        (row) => row.objectKind === "STAGING",
      ),
    ).toHaveLength(1);

    harness.expireStagingLease("intent-1");
    const result = await upload(new LocalPrivateStorage(root));

    expect(result.version).toMatchObject({ storageBackend: "LEGACY_LOCAL" });
    expect(harness.currentState().intent?.status).toBe("COMPLETED");
    expect(harness.currentState().fileVersions).toHaveLength(1);
    expect(
      [...harness.attempts.values()].filter(
        (row) => row.intentId === "intent-1",
      ),
    ).toHaveLength(1);
  });

  it("does not leave a false chain when staging reservation fails before commit", async () => {
    harness.failNextTransaction = "LOCAL_STAGING";

    await expect(upload(new LocalPrivateStorage(root))).rejects.toBeDefined();

    expect(harness.currentState().intent?.status).toBe("PENDING");
    expect(harness.currentState().attempt).toBeNull();
    expect([...harness.lifecycles.values()]).toHaveLength(0);
    await expect(fs.access(path.join(root, "staging"))).rejects.toBeDefined();
  });

  it("recognizes a committed canonical chain after response loss and finalizes once", async () => {
    harness.nextCommitResponseLoss = "LOCAL_CANONICAL";

    await expect(upload(new LocalPrivateStorage(root))).rejects.toMatchObject({
      code: "UPLOAD_RECOVERY_LEASE_ACTIVE",
    });
    expect(harness.currentState().fileVersions).toHaveLength(0);

    harness.expireCurrentLease("intent-1");
    const result = await upload(new LocalPrivateStorage(root));

    expect(result.version).toMatchObject({ storageBackend: "LEGACY_LOCAL" });
    expect(harness.currentState().intent?.status).toBe("COMPLETED");
    expect(harness.currentState().fileVersions).toHaveLength(1);
    expect(
      [...harness.attempts.values()].filter(
        (row) => row.intentId === "intent-1",
      ),
    ).toHaveLength(1);
  });

  it("re-enters after a canonical transaction failure before commit without duplicating records", async () => {
    harness.failNextTransaction = "LOCAL_CANONICAL";

    await expect(upload(new LocalPrivateStorage(root))).rejects.toMatchObject({
      code: "UPLOAD_RECOVERY_LEASE_ACTIVE",
    });
    harness.expireStagingLease("intent-1");
    const result = await upload(new LocalPrivateStorage(root));

    expect(result.version).toBeDefined();
    expect(harness.currentState().intent?.status).toBe("COMPLETED");
    expect(harness.currentState().fileVersions).toHaveLength(1);
    expect(
      [...harness.lifecycles.values()].filter(
        (row) => row.objectKind === "CANONICAL",
      ),
    ).toHaveLength(1);
  });

  it("reuses the committed result after finalization COMMIT response loss", async () => {
    harness.nextCommitResponseLoss = "LOCAL_FINALIZATION";

    const result = await upload(new LocalPrivateStorage(root));
    const second = await upload(new LocalPrivateStorage(root));

    expect(result.version.id).toBe(second.version.id);
    expect(harness.currentState().fileVersions).toHaveLength(1);
  });

  it("serializes two canonical recovery entrants through persisted ownership", async () => {
    harness.nextCommitResponseLoss = "LOCAL_CANONICAL";
    await expect(upload(new LocalPrivateStorage(root))).rejects.toMatchObject({
      code: "UPLOAD_RECOVERY_LEASE_ACTIVE",
    });
    harness.expireCurrentLease("intent-1");

    const results = await Promise.allSettled([
      upload(new LocalPrivateStorage(root)),
      upload(new LocalPrivateStorage(root)),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(harness.currentState().fileVersions).toHaveLength(1);
  });

  it("runs two real concurrent recovery entrants and prevents a second FileVersion", async () => {
    let releaseFirst: (() => void) | undefined;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstEntered = new Promise<void>((resolve) => {
      const firstStorage = new LocalPrivateStorage(root, {
        afterStagingClose: async () => {
          resolve();
          await firstBlocked;
        },
      });
      void completeUpload({
        actor,
        projectId: "project-1",
        intentId: "intent-1",
        requestContentLength: PDF_BYTES.byteLength,
        requestMimeType: "application/pdf",
        source: Readable.from([PDF_BYTES]),
        requestId: "request-1",
        storage: firstStorage,
        nodeEnvironment: "test",
        leaseMs: 500,
      }).catch(() => undefined);
    });

    await firstEntered;
    harness.expireStagingLease("intent-1");

    const second = await upload(new LocalPrivateStorage(root));
    releaseFirst?.();
    await upload(new LocalPrivateStorage(root));

    expect(second.version.id).toBeDefined();
    expect(harness.currentState().intent?.status).toBe("COMPLETED");
    expect(harness.currentState().fileVersions).toHaveLength(1);
  });

  it("stops the old Local executor when its lease heartbeat lookup fails", async () => {
    const storage = new LocalPrivateStorage(root, {
      afterStagingClose: () => {
        harness.failNextLeaseLookup = true;
      },
    });

    await expect(upload(storage)).rejects.toBeDefined();

    expect(harness.currentState().fileVersions).toHaveLength(0);
    expect(harness.currentState().intent?.status).toBe("UPLOADING");
  });

  it("fails closed for production Local upload entry", async () => {
    await expect(
      upload(new LocalPrivateStorage(root), {
        nodeEnvironment: "production",
      }),
    ).rejects.toMatchObject({
      code: "OBJECT_STORAGE_REQUIRED",
      status: 503,
    });
    expect(harness.currentState().intent?.status).toBe("PENDING");
  });
});
