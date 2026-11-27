import { createHash, randomUUID } from "node:crypto";

import {
  Prisma,
  PrismaClient,
  type FileUploadIntent,
  type FileVersion,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TEST_FIXTURE_IDS } from "../../scripts/test-db/seed";
import { PHASE40_HISTORY_VECTORS } from "../fixtures/phase40-append-intent-history-vectors";
import {
  createP13TestFileVersion,
  type P13TestFileVersionTransactionHooks,
} from "../helpers/p13-file-version";
import {
  assertPostgresIdentity,
  readPostgresIdentity,
  type ExpectedPostgresIdentity,
} from "../helpers/postgres-identity";

const prisma = new PrismaClient();
let adminUserId = "";
const EXPECTED_DATABASE_IDENTITY: ExpectedPostgresIdentity = {
  database: "cm1_r22_v4v7",
  role: "cm1_r22_app",
  host: "127.0.0.1",
  port: 55440,
};

function checksum(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

interface Barrier {
  arrive: () => Promise<void>;
  release: () => void;
}

interface Signal {
  promise: Promise<void>;
  resolve: () => void;
}

function createSignal(): Signal {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function createBarrier(): Barrier {
  let arrivals = 0;
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });

  return {
    async arrive() {
      arrivals += 1;
      if (arrivals >= 2) {
        release();
      }
      await ready;
    },
    release,
  };
}

interface LockWaitEvidence {
  pid: number;
  waitEventType: string;
  waitEvent: string | null;
  query: string;
}

async function waitForLockWait(
  observer: PrismaClient,
  pid: number,
): Promise<LockWaitEvidence> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const rows = await observer.$queryRaw<LockWaitEvidence[]>`
      SELECT
        pid,
        wait_event_type AS "waitEventType",
        wait_event AS "waitEvent",
        query
      FROM pg_stat_activity
      WHERE pid = ${pid}
    `;
    const row = rows[0];
    if (row?.waitEventType === "Lock") {
      return row;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`LOCK_WAIT_NOT_OBSERVED pid=${pid}`);
}

async function waitForBackendPid(
  readPid: () => number,
  label: string,
): Promise<number> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (readPid() > 0) {
      return readPid();
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`BACKEND_PID_NOT_OBSERVED label=${label}`);
}

async function createVersion(input: {
  marker: string;
  fileId?: string;
  completionOrder?: "POINTER_FIRST" | "COMPLETION_FIRST";
  skipCurrentPointerUpdate?: boolean;
  newFileTargetFileId?: string;
  completedTargetMode?: "CREATED_VERSION" | "NULL" | "OVERRIDE";
  completedTargetFileVersionId?: string;
  forceFinalCompletionGuardImmediate?: boolean;
  transactionHooks?: P13TestFileVersionTransactionHooks;
}): Promise<FileVersion> {
  const max =
    input.fileId || input.newFileTargetFileId
      ? await prisma.fileVersion.aggregate({
          where: {
            fileId: input.fileId ?? input.newFileTargetFileId,
          },
          _max: { versionNumber: true },
        })
      : null;
  if (!input.fileId && !input.newFileTargetFileId) {
    return createP13TestFileVersion(prisma, {
      uploadedById: adminUserId,
      projectId: TEST_FIXTURE_IDS.project,
      buildingId: TEST_FIXTURE_IDS.building,
      installationUnitId: TEST_FIXTURE_IDS.installationUnit,
      versionNumber: 1,
      originalFilename: `phase40-${input.marker}.pdf`,
      sanitizedFilename: `phase40-${input.marker}.pdf`,
      declaredMimeType: "application/pdf",
      detectedMimeType: "application/pdf",
      sizeBytes: 1024n,
      checksumSha256: checksum(input.marker),
      storageKey: `objects/phase40/${input.marker}-${randomUUID()}`,
      completionOrder: input.completionOrder,
      skipCurrentPointerUpdate: input.skipCurrentPointerUpdate,
      completedTargetMode: input.completedTargetMode,
      completedTargetFileVersionId:
        input.completedTargetFileVersionId,
      forceFinalCompletionGuardImmediate:
        input.forceFinalCompletionGuardImmediate,
      transactionHooks: input.transactionHooks,
    });
  }

  return createP13TestFileVersion(prisma, {
    fileId: input.fileId,
    newFileTargetFileId: input.newFileTargetFileId,
    uploadedById: adminUserId,
    projectId: TEST_FIXTURE_IDS.project,
    buildingId: TEST_FIXTURE_IDS.building,
    installationUnitId: TEST_FIXTURE_IDS.installationUnit,
    versionNumber: (max?._max.versionNumber ?? 0) + 1,
    originalFilename: `phase40-${input.marker}.pdf`,
    sanitizedFilename: `phase40-${input.marker}.pdf`,
    declaredMimeType: "application/pdf",
    detectedMimeType: "application/pdf",
    sizeBytes: 1024n,
    checksumSha256: checksum(`${input.marker}-${randomUUID()}`),
    storageKey: `objects/phase40/${input.marker}-${randomUUID()}`,
    completionOrder: input.completionOrder,
    skipCurrentPointerUpdate: input.skipCurrentPointerUpdate,
    completedTargetMode: input.completedTargetMode,
    completedTargetFileVersionId:
      input.completedTargetFileVersionId,
    forceFinalCompletionGuardImmediate:
      input.forceFinalCompletionGuardImmediate,
    transactionHooks: input.transactionHooks,
  });
}

async function completedIntent(
  version: FileVersion,
): Promise<FileUploadIntent> {
  return prisma.fileUploadIntent.findUniqueOrThrow({
    where: { id: version.uploadIntentId },
  });
}

function errorText(error: unknown): string {
  if (error instanceof Error) {
    const metadata =
      "meta" in error ? JSON.stringify(error.meta) : "";
    return `${error.name}: ${error.message} ${metadata}`;
  }
  return String(error);
}

function errorTarget(error: unknown): unknown {
  if (!error || typeof error !== "object" || !("meta" in error)) {
    return null;
  }
  const meta = error.meta;
  if (!meta || typeof meta !== "object" || !("target" in meta)) {
    return null;
  }
  return meta.target;
}

async function expectDatabaseRejection(
  operation: () => Promise<unknown>,
  expected: { sqlState?: string; message?: string },
): Promise<void> {
  let failure: unknown;
  try {
    await operation();
  } catch (error) {
    failure = error;
  }

  expect(failure, "operation unexpectedly succeeded").toBeDefined();
  const text = errorText(failure);
  if (expected.sqlState) {
    expect(text).toContain(expected.sqlState);
  }
  if (expected.message) {
    expect(text).toContain(expected.message);
  }
  expect(expected.sqlState ?? expected.message).toBeDefined();
}

beforeAll(async () => {
  const identity = await readPostgresIdentity(prisma);
  console.log(
    JSON.stringify({
      event: "r22.test_database_identity",
      expected: EXPECTED_DATABASE_IDENTITY,
      actual: identity,
    }),
  );
  assertPostgresIdentity(identity, EXPECTED_DATABASE_IDENTITY);

  const admin = await prisma.user.findUniqueOrThrow({
    where: {
      username: process.env.TEST_ADMIN_USERNAME?.toLowerCase(),
    },
    select: { id: true },
  });
  adminUserId = admin.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe.sequential(
  "Phase 4.0 append intent finalization",
  () => {
    it("accepts N/N current pointer update before completion", async () => {
      const version = await createVersion({
        marker: "pointer-first",
        completionOrder: "POINTER_FIRST",
      });
      const intent = await completedIntent(version);
      const file = await prisma.file.findUniqueOrThrow({
        where: { id: version.fileId },
      });

      expect(intent.status).toBe("COMPLETED");
      expect(intent.completedFileVersionId).toBe(version.id);
      expect(file.currentVersionId).toBe(version.id);
      expect(file.createdByUploadIntentId).toBe(intent.id);
    });

    it("accepts N/N completion before current pointer update", async () => {
      const version = await createVersion({
        marker: "completion-first",
        completionOrder: "COMPLETION_FIRST",
      });
      const intent = await completedIntent(version);
      const file = await prisma.file.findUniqueOrThrow({
        where: { id: version.fileId },
      });

      expect(intent.status).toBe("COMPLETED");
      expect(file.currentVersionId).toBe(version.id);
    });

    it("rejects N/N completion under an unrelated existing File", async () => {
      const first = await createVersion({ marker: "nn-owner" });

      await expectDatabaseRejection(
        () =>
          createP13TestFileVersion(prisma, {
            newFileTargetFileId: first.fileId,
            uploadedById: adminUserId,
            projectId: TEST_FIXTURE_IDS.project,
            buildingId: TEST_FIXTURE_IDS.building,
            installationUnitId: TEST_FIXTURE_IDS.installationUnit,
            versionNumber: 99,
            originalFilename: "phase40-nn-invalid.pdf",
            sanitizedFilename: "phase40-nn-invalid.pdf",
            declaredMimeType: "application/pdf",
            detectedMimeType: "application/pdf",
            sizeBytes: 1024n,
            checksumSha256: checksum("nn-invalid"),
            storageKey: `objects/phase40/nn-${randomUUID()}`,
          }),
        {
          sqlState: "42501",
          message: "upload intent completion provenance mismatch",
        },
      );
    });

    it("rejects N/N completion under another Intent's File", async () => {
      const first = await createVersion({ marker: "nn-other-owner" });

      await expectDatabaseRejection(
        () =>
          createP13TestFileVersion(prisma, {
            newFileTargetFileId: first.fileId,
            uploadedById: adminUserId,
            projectId: TEST_FIXTURE_IDS.project,
            buildingId: TEST_FIXTURE_IDS.building,
            installationUnitId: TEST_FIXTURE_IDS.installationUnit,
            versionNumber: 100,
            originalFilename: "phase40-nn-other.pdf",
            sanitizedFilename: "phase40-nn-other.pdf",
            declaredMimeType: "application/pdf",
            detectedMimeType: "application/pdf",
            sizeBytes: 1024n,
            checksumSha256: checksum("nn-other"),
            storageKey: `objects/phase40/nn-${randomUUID()}`,
          }),
        {
          sqlState: "42501",
          message: "upload intent completion provenance mismatch",
        },
      );
    });

    it("rejects a completed N/N target without current advance", async () => {
      await expectDatabaseRejection(
        () =>
          createVersion({
            marker: "no-current",
            skipCurrentPointerUpdate: true,
          }),
        {
          message: "new File terminal provenance chain is incomplete",
        },
      );
    });

    it("rejects a same-File target owned by another Intent", async () => {
      const first = await createVersion({ marker: "other-target-v1" });

      await expectDatabaseRejection(
        () =>
          createVersion({
            marker: "other-target-v2",
            fileId: first.fileId,
            completedTargetMode: "OVERRIDE",
            completedTargetFileVersionId: first.id,
          }),
        {
          sqlState: "42501",
          message: "upload intent completion provenance mismatch",
        },
      );
    });

    it("rejects File provenance scope update", async () => {
      const version = await createVersion({ marker: "scope" });

      await expectDatabaseRejection(
        () =>
          prisma.$executeRaw`
            UPDATE "file"
            SET "projectId" = ${TEST_FIXTURE_IDS.project2},
                "customerId" = ${TEST_FIXTURE_IDS.customer2}
            WHERE id = ${version.fileId}
          `,
        {
          sqlState: "42501",
          message: "File provenance scope is immutable",
        },
      );

      expect(
        await prisma.file.findUniqueOrThrow({
          where: { id: version.fileId },
          select: { projectId: true, customerId: true },
        }),
      ).toEqual({
        projectId: TEST_FIXTURE_IDS.project,
        customerId: TEST_FIXTURE_IDS.customer,
      });
    });

    it("rejects File creator change and NULL scope transitions", async () => {
      const version = await createVersion({ marker: "scope-fields" });

      await expectDatabaseRejection(
        () =>
          prisma.$executeRaw`
            UPDATE "file"
            SET "createdById" = 'another-user'
            WHERE id = ${version.fileId}
          `,
        {
          sqlState: "42501",
          message: "File provenance scope is immutable",
        },
      );
      await expectDatabaseRejection(
        () =>
          prisma.$executeRaw`
            UPDATE "file"
            SET "buildingId" = NULL,
                "installationUnitId" = NULL
            WHERE id = ${version.fileId}
          `,
        {
          sqlState: "42501",
          message: "File provenance scope is immutable",
        },
      );
    });

    it("rejects completed target deletion", async () => {
      const version = await createVersion({ marker: "history" });

      await expectDatabaseRejection(
        () =>
          prisma.$executeRaw`
            DELETE FROM "file_version" WHERE id = ${version.id}
          `,
        { sqlState: "42501" },
      );
    });

    it("records the actual first control for COMPLETED to UPLOADING", async () => {
      const version = await createVersion({ marker: "state-revert" });
      const intent = await completedIntent(version);

      await expectDatabaseRejection(
        () =>
          prisma.$executeRaw`
            UPDATE "file_upload_intent"
            SET status = 'UPLOADING'
            WHERE id = ${intent.id}
          `,
        {
          sqlState: "23514",
          message:
            "completed version requires COMPLETED intent status",
        },
      );
    });

    it("rejects FileVersion identity mutations and truncate", async () => {
      const version = await createVersion({ marker: "version-guard" });

      await expectDatabaseRejection(
        () =>
          prisma.$executeRaw`
            UPDATE "file_version"
            SET "versionNumber" = 999
            WHERE id = ${version.id}
          `,
        {
          sqlState: "42501",
          message: "file_version identity is immutable",
        },
      );

      await expectDatabaseRejection(
        () =>
          prisma.$executeRawUnsafe(
            'TRUNCATE TABLE "file_version" CASCADE',
          ),
        {
          sqlState: "42501",
          message: "file_version rows cannot be truncated in P1-3",
        },
      );
    });

    it("rejects NULL completed target with the unified final guard", async () => {
      await expectDatabaseRejection(
        () =>
          createP13TestFileVersion(prisma, {
            uploadedById: adminUserId,
            projectId: TEST_FIXTURE_IDS.project,
            buildingId: TEST_FIXTURE_IDS.building,
            installationUnitId: TEST_FIXTURE_IDS.installationUnit,
            versionNumber: 1,
            originalFilename: "phase40-null-target.pdf",
            sanitizedFilename: "phase40-null-target.pdf",
            declaredMimeType: "application/pdf",
            detectedMimeType: "application/pdf",
            sizeBytes: 1024n,
            checksumSha256: checksum("null-target"),
            storageKey: `objects/phase40/null-${randomUUID()}`,
            completedTargetMode: "NULL",
            forceFinalCompletionGuardImmediate: true,
          }),
        { sqlState: "23514" },
      );
    });

    it("rejects a different-File completed target before deferred checks", async () => {
      const first = await createVersion({ marker: "cross-target" });
      await expectDatabaseRejection(
        () =>
          createP13TestFileVersion(prisma, {
            fileId: first.fileId,
            uploadedById: adminUserId,
            projectId: TEST_FIXTURE_IDS.project,
            buildingId: TEST_FIXTURE_IDS.building,
            installationUnitId: TEST_FIXTURE_IDS.installationUnit,
            versionNumber: 2,
            originalFilename: "phase40-cross-target.pdf",
            sanitizedFilename: "phase40-cross-target.pdf",
            declaredMimeType: "application/pdf",
            detectedMimeType: "application/pdf",
            sizeBytes: 1024n,
            checksumSha256: checksum("cross-target"),
            storageKey: `objects/phase40/cross-${randomUUID()}`,
            completedTargetMode: "OVERRIDE",
            completedTargetFileVersionId: first.id,
          }),
        { sqlState: "42501" },
      );
    });

    it("keeps two-client active-slot competition distinct", async () => {
      const base = await createVersion({ marker: "active-base" });
      const pending = await Promise.all([
        createPendingIntent(base.fileId, base.id),
        createPendingIntent(base.fileId, base.id),
      ]);
      const clientA = new PrismaClient();
      const clientB = new PrismaClient();
      const barrier = createBarrier();

      try {
        const results = await Promise.allSettled([
          reservePending(clientA, pending[0], barrier),
          reservePending(clientB, pending[1], barrier),
        ]);
        expect(
          results.filter((result) => result.status === "fulfilled"),
        ).toHaveLength(1);
        const loser = results.find(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected",
        );
        expect(loser?.reason).toMatchObject({
          code: "P2002",
        });
        expect(errorTarget(loser?.reason)).toEqual(
          expect.arrayContaining(["existingFileId"]),
        );
        expect(errorText(loser?.reason)).not.toContain("23514");
      } finally {
        barrier.release();
        await Promise.all([
          clientA.$disconnect(),
          clientB.$disconnect(),
        ]);
      }
    });

    it("rejects a real duplicate fileId/versionNumber insert", async () => {
      const base = await createVersion({ marker: "version-unique" });
      let failure: unknown;
      try {
        await insertDuplicateVersion(prisma, base, "duplicate-version");
      } catch (error) {
        failure = error;
      }
      expect(failure).toMatchObject({ code: "P2002" });
      expect(errorText(failure)).toContain("fileId");
      expect(errorText(failure)).toContain("versionNumber");
      expect(
        await prisma.fileVersion.count({
          where: {
            fileId: base.fileId,
            versionNumber: base.versionNumber,
          },
        }),
      ).toBe(1);
    });

    it("keeps stale-current competition explicit", async () => {
      const base = await createVersion({ marker: "stale-base" });
      const pending = await createPendingIntent(base.fileId, base.id);
      await createVersion({
        marker: "stale-next",
        fileId: base.fileId,
      });
      await expectDatabaseRejection(
        () =>
          prisma.$executeRaw`
            UPDATE "file_upload_intent"
            SET status = 'UPLOADING'
            WHERE id = ${pending.id}
          `,
        { sqlState: "23514" },
      );
    });

    it("uses two clients for lock-wait rejection of a pre-staled Append", async () => {
      const base = await createVersion({ marker: "two-client-base" });
      const pending = await createPendingIntent(base.fileId, base.id);
      const next = await createVersion({
        marker: "two-client-next",
        fileId: base.fileId,
      });
      const clientA = new PrismaClient();
      const clientB = new PrismaClient();
      const fileLocked = createSignal();
      const staleStarted = createSignal();
      const releaseA = createSignal();

      try {
        const owner = clientA.$transaction(
          async (tx) => {
            await tx.$queryRaw`
              SELECT id
              FROM "file"
              WHERE id = ${base.fileId}
              FOR UPDATE
            `;
            fileLocked.resolve();
            await releaseA.promise;
          },
          {
            isolationLevel:
              Prisma.TransactionIsolationLevel.ReadCommitted,
          },
        );
        await fileLocked.promise;

        const stale = clientB.$transaction(
          async (tx) => {
            staleStarted.resolve();
            await tx.$executeRaw`
              UPDATE "file_upload_intent"
              SET status = 'UPLOADING'
              WHERE id = ${pending.id}
            `;
          },
          {
            isolationLevel:
              Prisma.TransactionIsolationLevel.ReadCommitted,
          },
        );
        await staleStarted.promise;
        await new Promise((resolve) => setTimeout(resolve, 100));
        releaseA.resolve();
        await expectDatabaseRejection(() => stale, {
          message:
            "append reservation expected-current is stale or missing",
        });
        await owner;
        expect(
          await prisma.file.findUniqueOrThrow({
            where: { id: base.fileId },
            select: { currentVersionId: true },
          }),
        ).toMatchObject({ currentVersionId: next.id });
      } finally {
        releaseA.resolve();
        await Promise.all([
          clientA.$disconnect(),
          clientB.$disconnect(),
        ]);
      }
    });

    it("competes current advancement before reservation against a live Append", async () => {
      const base = await createVersion({ marker: "current-wins-base" });
      const pending = await createPendingIntent(base.fileId, base.id);
      const clientA = new PrismaClient();
      const clientB = new PrismaClient();
      const observer = new PrismaClient();
      const fileLocked = createSignal();
      const releaseA = createSignal();
      let pidA = 0;
      let pidB = 0;

      try {
        const advancing = createVersion({
          marker: "current-wins-next",
          fileId: base.fileId,
          transactionHooks: {
            onTransactionStart: async (tx) => {
              const rows = await tx.$queryRaw<Array<{ pid: number }>>`
                SELECT pg_backend_pid() AS pid
              `;
              pidA = rows[0]!.pid;
            },
            beforeFinalization: async (tx) => {
              await tx.$queryRaw`
                SELECT id
                FROM "file"
                WHERE id = ${base.fileId}
                FOR UPDATE
              `;
              fileLocked.resolve();
              await releaseA.promise;
            },
          },
        });

        await fileLocked.promise;
        const reserving = reservePending(
          clientB,
          pending,
          undefined,
          {
            onTransactionStart: async (tx) => {
              const rows = await tx.$queryRaw<Array<{ pid: number }>>`
                SELECT pg_backend_pid() AS pid
              `;
              pidB = rows[0]!.pid;
            },
          },
        );
        const observedPidB = await waitForBackendPid(
          () => pidB,
          "current_pointer_wins_reservation",
        );
        const lockWait = await waitForLockWait(
          observer,
          observedPidB,
        );
        await new Promise((resolve) => setTimeout(resolve, 1_200));
        console.log(
          JSON.stringify({
            event: "r22.current_pointer_wins",
            pidA,
            pidB: observedPidB,
            lockWait,
          }),
        );

        releaseA.resolve();
        const advancedVersion = await advancing;
        await expectDatabaseRejection(() => reserving, {
          message:
            "append reservation expected-current is stale or missing",
        });

        const [
          file,
          completedIntent,
          pendingIntent,
          candidateLifecycle,
          candidateOperation,
          pendingAttemptCount,
        ] = await Promise.all([
          prisma.file.findUniqueOrThrow({
            where: { id: base.fileId },
          }),
          completedIntentForVersion(advancedVersion),
          prisma.fileUploadIntent.findUniqueOrThrow({
            where: { id: pending.id },
          }),
          prisma.storageObjectLifecycle.findFirstOrThrow({
            where: {
              storageKey: advancedVersion.storageKey,
              objectKind: "CANONICAL",
            },
          }),
          prisma.storageObjectOperation.findUniqueOrThrow({
            where: {
              id: advancedVersion.creationOperationAttemptId,
            },
          }),
          prisma.fileUploadAttempt.count({
            where: { intentId: pending.id },
          }),
        ]);

        expect(file.currentVersionId).toBe(advancedVersion.id);
        expect(completedIntent.status).toBe("COMPLETED");
        expect(pendingIntent.status).toBe("PENDING");
        expect(pendingAttemptCount).toBe(0);
        expect(candidateLifecycle.state).toBe("ACTIVE");
        expect(candidateOperation.state).toBe("APPLIED");
        expect(
          await prisma.fileUploadIntent.count({
            where: {
              existingFileId: base.fileId,
              status: "UPLOADING",
            },
          }),
        ).toBe(0);
      } finally {
        releaseA.resolve();
        await Promise.all([
          clientA.$disconnect(),
          clientB.$disconnect(),
          observer.$disconnect(),
        ]);
      }
    });

    it("competes reservation before current advancement", async () => {
      const base = await createVersion({ marker: "reservation-wins-base" });
      const pending = await createPendingIntent(base.fileId, base.id);
      const clientA = new PrismaClient();
      const clientB = new PrismaClient();
      const observer = new PrismaClient();
      const reservationClaimed = createSignal();
      const currentAdvanceStarted = createSignal();
      const releaseB = createSignal();
      let pidA = 0;
      let pidB = 0;

      try {
        const reserving = reservePending(
          clientB,
          pending,
          undefined,
          {
            onTransactionStart: async (tx) => {
              const rows = await tx.$queryRaw<Array<{ pid: number }>>`
                SELECT pg_backend_pid() AS pid
              `;
              pidB = rows[0]!.pid;
            },
            afterUploading: async () => {
              reservationClaimed.resolve();
              await releaseB.promise;
            },
          },
        );
        await reservationClaimed.promise;

        const advancing = createVersion({
          marker: "reservation-wins-next",
          fileId: base.fileId,
          transactionHooks: {
            onTransactionStart: async (tx) => {
              const rows = await tx.$queryRaw<Array<{ pid: number }>>`
                SELECT pg_backend_pid() AS pid
              `;
              pidA = rows[0]!.pid;
              currentAdvanceStarted.resolve();
            },
          },
        });
        await currentAdvanceStarted.promise;
        const lockWait = await waitForLockWait(observer, pidA);
        await new Promise((resolve) => setTimeout(resolve, 1_200));
        console.log(
          JSON.stringify({
            event: "r22.reservation_wins",
            pidA,
            pidB,
            lockWait,
          }),
        );

        releaseB.resolve();
        await reserving;
        let advanceFailure: unknown;
        try {
          await advancing;
        } catch (error) {
          advanceFailure = error;
        }
        expect(advanceFailure).toMatchObject({ code: "P2002" });
        expect(errorTarget(advanceFailure)).toEqual(
          expect.arrayContaining(["existingFileId"]),
        );

        const [
          file,
          reservedIntent,
          reservedAttempts,
          fileVersions,
          activeIntents,
        ] = await Promise.all([
          prisma.file.findUniqueOrThrow({
            where: { id: base.fileId },
          }),
          prisma.fileUploadIntent.findUniqueOrThrow({
            where: { id: pending.id },
          }),
          prisma.fileUploadAttempt.findMany({
            where: { intentId: pending.id },
            select: { status: true },
          }),
          prisma.fileVersion.findMany({
            where: { fileId: base.fileId },
            select: { id: true },
          }),
          prisma.fileUploadIntent.count({
            where: {
              existingFileId: base.fileId,
              status: "UPLOADING",
            },
          }),
        ]);

        expect(file.currentVersionId).toBe(base.id);
        expect(reservedIntent.status).toBe("UPLOADING");
        expect(reservedAttempts).toEqual([{ status: "WRITING" }]);
        expect(fileVersions).toEqual([{ id: base.id }]);
        expect(activeIntents).toBe(1);
      } finally {
        releaseB.resolve();
        await Promise.all([
          clientA.$disconnect(),
          clientB.$disconnect(),
          observer.$disconnect(),
        ]);
      }
    });

    it("fails closed when the expected database identity differs", async () => {
      const actual = await readPostgresIdentity(prisma);
      expect(() =>
        assertPostgresIdentity(actual, {
          ...EXPECTED_DATABASE_IDENTITY,
          database: "cm1_r22_wrong_database",
        }),
      ).toThrow("POSTGRES_IDENTITY_MISMATCH");
    });

    it("installs the required trigger event matrix", async () => {
      const triggers = await prisma.$queryRaw<
        Array<{
          tgname: string;
          tgtype: number;
          tgdeferrable: boolean;
          tginitdeferred: boolean;
        }>
      >`
        SELECT tgname, tgtype, tgdeferrable, tginitdeferred
        FROM pg_trigger
        WHERE NOT tgisinternal
          AND tgname IN (
            'p13_file_creation_origin_guard',
            'p13_created_file_terminal_guard',
            'p13_append_current_file_commit_guard',
            'p13_file_current_latest_completed_guard',
            'p13_file_provenance_scope_immutable',
            'p13_append_creation_snapshot_guard',
            'p13_append_reservation_snapshot_guard',
            'p13_completed_intent_final_guard',
            'p13_upload_intent_guard',
            'p13_upload_intent_truncate_guard',
            'file_version_identity_guard',
            'p13_file_version_truncate_guard'
          )
        ORDER BY tgname
      `;

      const byName = new Map(
        triggers.map((trigger) => [trigger.tgname, trigger]),
      );
      expect(byName.get("p13_completed_intent_final_guard")).toMatchObject({
        tgtype: 17,
        tgdeferrable: true,
        tginitdeferred: true,
      });
      expect(byName.get("p13_file_provenance_scope_immutable")).toMatchObject(
        {
          tgtype: 19,
          tgdeferrable: false,
          tginitdeferred: false,
        },
      );
      expect(byName.get("p13_created_file_terminal_guard")).toMatchObject({
        tgtype: 5,
        tgdeferrable: true,
        tginitdeferred: true,
      });
      expect(byName.get("p13_append_current_file_commit_guard")).toMatchObject(
        {
          tgtype: 29,
          tgdeferrable: true,
          tginitdeferred: true,
        },
      );
      expect(byName.get("p13_upload_intent_truncate_guard")).toMatchObject({
        tgtype: 34,
        tgdeferrable: false,
        tginitdeferred: false,
      });
    });

    it("uses two clients for stale execution ownership competition", async () => {
      const base = await createVersion({ marker: "ownership-base" });
      const pending = await createPendingIntent(base.fileId, base.id);
      const reservationClient = new PrismaClient();
      const clientA = new PrismaClient();
      const clientB = new PrismaClient();
      const start = createBarrier();

      try {
        await reservePending(reservationClient, pending);
        const lifecycle = await prisma.storageObjectLifecycle.findFirstOrThrow({
          where: {
            reservedIntentId: pending.id,
            objectKind: "STAGING",
            state: "STAGING",
          },
        });
        const oldOwner = lifecycle.ownerToken;
        const oldGeneration = lifecycle.fencingGeneration;
        expect(oldOwner).not.toBeNull();

        const takeOver = (client: PrismaClient, ownerToken: string) =>
          client.$transaction(
            async (tx) => {
              await start.arrive();
              return tx.storageObjectLifecycle.updateMany({
                where: {
                  id: lifecycle.id,
                  ownerToken: oldOwner,
                  fencingGeneration: oldGeneration,
                  state: "STAGING",
                  leaseExpiresAt: { gt: new Date() },
                },
                data: {
                  ownerToken,
                  fencingGeneration: oldGeneration + 1n,
                  leaseExpiresAt: new Date(Date.now() + 120_000),
                },
              });
            },
            {
              isolationLevel:
                Prisma.TransactionIsolationLevel.ReadCommitted,
            },
          );

        const results = await Promise.all([
          takeOver(clientA, "a".repeat(64)),
          takeOver(clientB, "b".repeat(64)),
        ]);
        expect(results.map((result) => result.count).sort()).toEqual([
          0, 1,
        ]);
        expect(
          await prisma.storageObjectLifecycle.findUniqueOrThrow({
            where: { id: lifecycle.id },
            select: {
              ownerToken: true,
              fencingGeneration: true,
            },
          }),
        ).toMatchObject({
          fencingGeneration: oldGeneration + 1n,
        });
      } finally {
        start.release();
        await Promise.all([
          reservationClient.$disconnect(),
          clientA.$disconnect(),
          clientB.$disconnect(),
        ]);
      }
    });

    it("records legacy-unverified Append target as a migration vector", () => {
      expect(
        PHASE40_HISTORY_VECTORS.some(
          (vector) =>
            vector.expectedCategory === "active_append_legacy_origin" &&
            vector.expectedContinue === false,
        ),
      ).toBe(true);
    });

    it("records legacy-unverified current advance as a migration vector", () => {
      expect(
        PHASE40_HISTORY_VECTORS.some(
          (vector) =>
            vector.expectedCategory === "legacy_unverified" &&
            vector.expectedContinue === true,
        ),
      ).toBe(true);
    });
  },
);

async function createPendingIntent(
  fileId: string,
  expectedCurrentFileVersionId: string,
): Promise<FileUploadIntent> {
  return prisma.fileUploadIntent.create({
    data: {
      requestKey: randomUUID(),
      requestFingerprint: checksum(randomUUID()),
      uploadedById: adminUserId,
      projectId: TEST_FIXTURE_IDS.project,
      buildingId: TEST_FIXTURE_IDS.building,
      installationUnitId: TEST_FIXTURE_IDS.installationUnit,
      existingFileId: fileId,
      expectedCurrentFileVersionId,
      displayName: `phase40-${randomUUID()}.pdf`,
      originalFilename: "phase40.pdf",
      sanitizedFilename: "phase40.pdf",
      declaredMimeType: "application/pdf",
      declaredSizeBytes: 1024n,
      stagingKey: `staging/phase40-${randomUUID()}.part`,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 600_000),
    },
  });
}

async function completedIntentForVersion(
  version: FileVersion,
): Promise<FileUploadIntent> {
  return prisma.fileUploadIntent.findUniqueOrThrow({
    where: { id: version.uploadIntentId },
  });
}

async function reservePending(
  client: PrismaClient,
  intent: FileUploadIntent,
  barrier?: Barrier,
  hooks?: {
    onTransactionStart?: (
      tx: Prisma.TransactionClient,
    ) => Promise<void>;
    afterUploading?: (
      tx: Prisma.TransactionClient,
    ) => Promise<void>;
  },
): Promise<void> {
  const attemptId = randomUUID().replaceAll("-", "");
  const stagingLifecycleId = randomUUID().replaceAll("-", "");
  const ownerToken = randomUUID().replaceAll("-", "");
  const now = new Date();

  await client.$transaction(
    async (tx) => {
      await hooks?.onTransactionStart?.(tx);
      await tx.storageObjectLifecycle.create({
        data: {
          id: stagingLifecycleId,
          objectKind: "STAGING",
          storageBackend: "LEGACY_LOCAL",
          storageKey: intent.stagingKey!,
          state: "STAGING_RESERVED",
          reservedAttemptId: attemptId,
          reservedIntentId: intent.id,
          fencingGeneration: 0n,
          lastTransitionAt: now,
        },
      });
      await tx.fileUploadAttempt.create({
        data: {
          id: attemptId,
          intentId: intent.id,
          stagingKey: intent.stagingKey!,
          status: "RESERVED",
        },
      });

      if (barrier) {
        await barrier.arrive();
      }

      await tx.fileUploadIntent.update({
        where: { id: intent.id },
        data: {
          status: "UPLOADING",
          currentAttemptId: attemptId,
          claimedAt: now,
        },
      });
      await hooks?.afterUploading?.(tx);
      await tx.storageObjectLifecycle.update({
        where: { id: stagingLifecycleId },
        data: {
          state: "STAGING",
          ownerToken,
          fencingGeneration: 1n,
          leaseExpiresAt: new Date(now.getTime() + 120_000),
          lastTransitionAt: now,
        },
      });
      await tx.fileUploadAttempt.update({
        where: { id: attemptId },
        data: { status: "WRITING" },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 10_000,
      timeout: 20_000,
    },
  );
}

async function insertDuplicateVersion(
  client: PrismaClient,
  base: FileVersion,
  marker: string,
): Promise<FileVersion> {
  const makeDbId = () => randomUUID().replaceAll("-", "");
  const intentId = makeDbId();
  const attemptId = makeDbId();
  const stagingLifecycleId = makeDbId();
  const canonicalLifecycleId = makeDbId();
  const operationId = makeDbId();
  const duplicateVersionId = makeDbId();
  const stagingKey = `staging/phase40-${randomUUID()}.part`;
  const canonicalKey = `objects/phase40/${marker}-${randomUUID()}`;
  const ownerToken = randomUUID().replaceAll("-", "");
  const closeAttestationId = randomUUID();
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + 120_000);

  return client.$transaction(async (tx) => {
    await tx.fileUploadIntent.create({
      data: {
        id: intentId,
        requestKey: randomUUID(),
        requestFingerprint: "a".repeat(64),
        uploadedById: adminUserId,
        projectId: TEST_FIXTURE_IDS.project,
        buildingId: TEST_FIXTURE_IDS.building,
        installationUnitId: TEST_FIXTURE_IDS.installationUnit,
        existingFileId: null,
        expectedCurrentFileVersionId: null,
        displayName: "phase40 duplicate.pdf",
        originalFilename: "phase40 duplicate.pdf",
        sanitizedFilename: "phase40 duplicate.pdf",
        declaredMimeType: "application/pdf",
        declaredSizeBytes: base.sizeBytes,
        stagingKey,
        status: "PENDING",
        expiresAt: new Date(now.getTime() + 600_000),
      },
    });
    await tx.storageObjectLifecycle.create({
      data: {
        id: stagingLifecycleId,
        objectKind: "STAGING",
        storageBackend: "LEGACY_LOCAL",
        storageKey: stagingKey,
        state: "STAGING_RESERVED",
        reservedAttemptId: attemptId,
        reservedIntentId: intentId,
        fencingGeneration: 0n,
        lastTransitionAt: now,
      },
    });
    await tx.fileUploadAttempt.create({
      data: {
        id: attemptId,
        intentId,
        stagingKey,
        status: "RESERVED",
      },
    });
    await tx.fileUploadIntent.update({
      where: { id: intentId },
      data: {
        status: "UPLOADING",
        currentAttemptId: attemptId,
        claimedAt: now,
      },
    });
    await tx.storageObjectLifecycle.update({
      where: { id: stagingLifecycleId },
      data: {
        state: "STAGING",
        ownerToken,
        fencingGeneration: 1n,
        leaseExpiresAt,
        lastTransitionAt: now,
      },
    });
    await tx.fileUploadAttempt.update({
      where: { id: attemptId },
      data: { status: "WRITING" },
    });
    await tx.storageObjectLifecycle.update({
      where: { id: stagingLifecycleId },
      data: {
        state: "STAGING_READY",
        sizeBytes: base.sizeBytes,
        checksumSha256: base.checksumSha256,
        closeAttestationId,
        closedByAttemptId: attemptId,
        closedOwnerToken: ownerToken,
        closedGeneration: 1n,
        writerClosedAt: now,
        closedDev: "TEST_DEV",
        closedIno: "TEST_INO",
        closedSizeBytes: base.sizeBytes,
        closedChecksumSha256: base.checksumSha256,
        closedIdentityVerified: true,
        lastTransitionAt: now,
      },
    });
    await tx.fileUploadAttempt.update({
      where: { id: attemptId },
      data: { status: "READY" },
    });
    await tx.storageObjectLifecycle.create({
      data: {
        id: canonicalLifecycleId,
        objectKind: "CANONICAL",
        storageBackend: "LEGACY_LOCAL",
        storageKey: canonicalKey,
        state: "FINALIZING",
        ownerToken,
        fencingGeneration: 1n,
        leaseExpiresAt,
        sizeBytes: base.sizeBytes,
        checksumSha256: base.checksumSha256,
        lastTransitionAt: now,
      },
    });
    await tx.storageObjectOperation.create({
      data: {
        id: operationId,
        objectLifecycleId: canonicalLifecycleId,
        storageKey: canonicalKey,
        sourceAttemptId: attemptId,
        operationType: "FINALIZE",
        state: "PREPARED",
        ownerToken,
        fencingGeneration: 1n,
        leaseExpiresAt,
        sourcePath: stagingKey,
        targetPath: canonicalKey,
        expectedSizeBytes: base.sizeBytes,
        expectedChecksumSha256: base.checksumSha256,
      },
    });
    await tx.storageObjectLifecycle.update({
      where: { id: canonicalLifecycleId },
      data: { currentOperationId: operationId },
    });
    await tx.fileUploadAttempt.update({
      where: { id: attemptId },
      data: {
        status: "FINALIZING",
        canonicalStorageKey: canonicalKey,
      },
    });
    await tx.storageObjectOperation.update({
      where: { id: operationId },
      data: { state: "EXECUTING" },
    });
    await tx.storageObjectOperation.update({
      where: { id: operationId },
      data: {
        state: "APPLIED",
        leaseExpiresAt: null,
        completedAt: now,
      },
    });
    await tx.storageObjectLifecycle.update({
      where: { id: canonicalLifecycleId },
      data: {
        state: "ACTIVE",
        leaseExpiresAt: null,
        lastTransitionAt: now,
      },
    });
    await tx.storageObjectLifecycle.update({
      where: { id: stagingLifecycleId },
      data: {
        state: "DELETED",
        leaseExpiresAt: null,
        lastTransitionAt: now,
      },
    });
    await tx.fileUploadAttempt.update({
      where: { id: attemptId },
      data: { status: "COMPLETED", completedAt: now },
    });

    return tx.fileVersion.create({
      data: {
        id: duplicateVersionId,
        fileId: base.fileId,
        versionNumber: base.versionNumber,
        originalFilename: base.originalFilename,
        sanitizedFilename: base.sanitizedFilename,
        declaredMimeType: base.declaredMimeType,
        detectedMimeType: base.detectedMimeType,
        sizeBytes: base.sizeBytes,
        checksumSha256: base.checksumSha256,
        storageKey: canonicalKey,
        storageBackend: "LEGACY_LOCAL",
        uploadIntentId: intentId,
        uploadAttemptId: attemptId,
        creationOperationAttemptId: operationId,
        uploadStatus: "UPLOADED",
        validationStatus: "PASSED",
        integrityStatus: "VERIFIED",
        recognitionStatus: "NOT_REQUESTED",
        uploadedById: adminUserId,
        finalizedAt: now,
      },
    });
  });
}
