import { createHash, randomUUID } from "node:crypto";

import {
  PrismaClient,
  type FileUploadIntent,
  type FileVersion,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TEST_FIXTURE_IDS } from "../../scripts/test-db/seed";
import { createP13TestFileVersion } from "../helpers/p13-file-version";

const prisma = new PrismaClient();
let adminUserId = "";

function checksum(marker: string): string {
  return createHash("sha256").update(marker).digest("hex");
}

interface ErrorWithMetadata extends Error {
  meta?: unknown;
}

function hasMetadata(error: Error): error is ErrorWithMetadata {
  return "meta" in error;
}

async function createVersion(input: {
  marker: string;
  fileId?: string;
  completedTargetMode?:
    | "CREATED_VERSION"
    | "NULL"
    | "OVERRIDE";
  completedTargetFileVersionId?: string;
}): Promise<FileVersion> {
  const current = input.fileId
    ? await prisma.fileVersion.aggregate({
        where: { fileId: input.fileId },
        _max: { versionNumber: true },
      })
    : null;
  const versionNumber =
    (current?._max.versionNumber ?? 0) + 1;

  return createP13TestFileVersion(prisma, {
    fileId: input.fileId,
    uploadedById: adminUserId,
    projectId: TEST_FIXTURE_IDS.project,
    buildingId: TEST_FIXTURE_IDS.building,
    installationUnitId: TEST_FIXTURE_IDS.installationUnit,
    versionNumber,
    originalFilename: `phase39-${input.marker}.pdf`,
    sanitizedFilename: `phase39-${input.marker}.pdf`,
    declaredMimeType: "application/pdf",
    detectedMimeType: "application/pdf",
    sizeBytes: BigInt(1024 + versionNumber),
    checksumSha256: checksum(`${input.marker}-${randomUUID()}`),
    storageKey: `objects/phase39/${input.marker}-${randomUUID()}`,
    uploadStatus: "UPLOADED",
    validationStatus: "PASSED",
    integrityStatus: "VERIFIED",
    recognitionStatus: "COMPLETED",
    finalizedAt: new Date(),
    completedTargetMode: input.completedTargetMode,
    completedTargetFileVersionId:
      input.completedTargetFileVersionId,
  });
}

async function completedIntent(
  version: FileVersion,
): Promise<FileUploadIntent> {
  return prisma.fileUploadIntent.findUniqueOrThrow({
    where: { id: version.uploadIntentId },
  });
}

async function createPendingAppendIntent(input: {
  fileId: string;
  expectedCurrentFileVersionId: string;
}): Promise<FileUploadIntent> {
  return prisma.fileUploadIntent.create({
    data: {
      requestKey: randomUUID(),
      requestFingerprint: checksum(randomUUID()),
      uploadedById: adminUserId,
      projectId: TEST_FIXTURE_IDS.project,
      buildingId: TEST_FIXTURE_IDS.building,
      installationUnitId: TEST_FIXTURE_IDS.installationUnit,
      existingFileId: input.fileId,
      expectedCurrentFileVersionId:
        input.expectedCurrentFileVersionId,
      displayName: `phase39-pending-${randomUUID()}.pdf`,
      originalFilename: "phase39-pending.pdf",
      sanitizedFilename: "phase39-pending.pdf",
      declaredMimeType: "application/pdf",
      declaredSizeBytes: 1024n,
      stagingKey: `staging/phase39-${randomUUID()}.part`,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 600_000),
    },
  });
}

function errorText(error: unknown): string {
  if (error instanceof Error) {
    const metadata = hasMetadata(error)
      ? JSON.stringify(error.meta)
      : "";
    return `${error.name}: ${error.message} ${metadata}`;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function expectDatabaseRejection(
  operation: () => Promise<unknown>,
  expected: {
    sqlState: string;
    message?: string;
  },
): Promise<void> {
  let failure: unknown;
  try {
    await operation();
  } catch (error) {
    failure = error;
  }

  expect(failure, "operation unexpectedly succeeded").toBeDefined();
  const text = errorText(failure);
  expect(text).toContain(expected.sqlState);
  if (expected.message) {
    expect(text).toContain(expected.message);
  }
}

beforeAll(async () => {
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
  "Phase 3.9 append intent relational integrity",
  () => {
    it("completes new-file and Append chains with exact current targets", async () => {
      const first = await createVersion({ marker: "positive-v1" });
      const second = await createVersion({
        marker: "positive-v2",
        fileId: first.fileId,
      });
      const file = await prisma.file.findUniqueOrThrow({
        where: { id: first.fileId },
      });
      const firstIntent = await completedIntent(first);
      const secondIntent = await completedIntent(second);

      expect(file.createdByUploadIntentId).toBe(firstIntent.id);
      expect(file.currentVersionId).toBe(second.id);
      expect(firstIntent).toMatchObject({
        status: "COMPLETED",
        existingFileId: null,
        expectedCurrentFileVersionId: null,
        completedFileVersionId: first.id,
      });
      expect(secondIntent).toMatchObject({
        status: "COMPLETED",
        existingFileId: first.fileId,
        expectedCurrentFileVersionId: first.id,
        completedFileVersionId: second.id,
      });
    });

    it("installs the named compound relations and deferred guards", async () => {
      const constraints = await prisma.$queryRaw<
        Array<{
          conname: string;
          contype: string;
          confmatchtype: string | null;
          condeferrable: boolean;
          condeferred: boolean;
          convalidated: boolean;
        }>
      >`
        SELECT
          conname,
          contype,
          confmatchtype,
          condeferrable,
          condeferred,
          convalidated
        FROM pg_constraint
        WHERE conname IN (
          'file_upload_intent_expectedCurrentFileVersionId_existingFileId_fkey',
          'file_upload_intent_completed_current_same_file_fkey',
          'upload_intent_expected_current_pair_check'
        )
        ORDER BY conname
      `;
      expect(constraints).toHaveLength(3);
      expect(constraints).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            conname:
              "file_upload_intent_expectedCurrentFileVersionId_existingFileId_fkey",
            contype: "f",
            confmatchtype: "s",
            condeferrable: true,
            condeferred: true,
            convalidated: true,
          }),
          expect.objectContaining({
            conname:
              "file_upload_intent_completed_current_same_file_fkey",
            contype: "f",
            confmatchtype: "s",
            condeferrable: true,
            condeferred: true,
            convalidated: true,
          }),
          expect.objectContaining({
            conname:
              "upload_intent_expected_current_pair_check",
            contype: "c",
            convalidated: true,
          }),
        ]),
      );

      const triggers = await prisma.$queryRaw<
        Array<{
          tgname: string;
          tgdeferrable: boolean;
          tginitdeferred: boolean;
        }>
      >`
        SELECT tgname, tgdeferrable, tginitdeferred
        FROM pg_trigger
        WHERE NOT tgisinternal
          AND tgname IN (
            'p13_created_file_terminal_guard',
            'p13_append_current_file_commit_guard',
            'p13_append_current_intent_commit_guard',
            'p13_completed_append_current_guard',
            'p13_file_current_latest_completed_guard'
          )
        ORDER BY tgname
      `;
      expect(triggers).toHaveLength(5);
      expect(
        triggers.every(
          (trigger) =>
            trigger.tgdeferrable && trigger.tginitdeferred,
        ),
      ).toBe(true);
    });

    it("rejects reservation after the expected-current snapshot becomes stale", async () => {
      const base = await createVersion({
        marker: "stale-reservation-base",
      });
      const pending = await createPendingAppendIntent({
        fileId: base.fileId,
        expectedCurrentFileVersionId: base.id,
      });
      const next = await createVersion({
        marker: "stale-reservation-next",
        fileId: base.fileId,
      });

      await expectDatabaseRejection(
        () =>
          prisma.$executeRaw`
            UPDATE "file_upload_intent"
            SET status = 'UPLOADING'
            WHERE id = ${pending.id}
          `,
        {
          sqlState: "23514",
          message:
            "append reservation expected-current is stale or missing",
        },
      );

      const [storedIntent, file] = await Promise.all([
        prisma.fileUploadIntent.findUniqueOrThrow({
          where: { id: pending.id },
          select: { status: true },
        }),
        prisma.file.findUniqueOrThrow({
          where: { id: base.fileId },
          select: { currentVersionId: true },
        }),
      ]);
      expect(storedIntent.status).toBe("PENDING");
      expect(file.currentVersionId).toBe(next.id);
    });

    it("rejects COMPLETED with NULL target without partial rows", async () => {
      const before = await Promise.all([
        prisma.file.count(),
        prisma.fileVersion.count(),
        prisma.fileUploadIntent.count(),
      ]);

      await expectDatabaseRejection(
        () =>
          createVersion({
            marker: "null-target",
            completedTargetMode: "NULL",
          }),
        { sqlState: "23514" },
      );

      await expect(
        Promise.all([
          prisma.file.count(),
          prisma.fileVersion.count(),
          prisma.fileUploadIntent.count(),
        ]),
      ).resolves.toEqual(before);
    });

    it("rejects a same-File completed target owned by another Intent", async () => {
      const first = await createVersion({
        marker: "other-intent-v1",
      });

      await expectDatabaseRejection(
        () =>
          createVersion({
            marker: "other-intent-v2",
            fileId: first.fileId,
            completedTargetMode: "OVERRIDE",
            completedTargetFileVersionId: first.id,
          }),
        { sqlState: "23514" },
      );

      const [file, versions] = await Promise.all([
        prisma.file.findUniqueOrThrow({
          where: { id: first.fileId },
        }),
        prisma.fileVersion.findMany({
          where: { fileId: first.fileId },
        }),
      ]);
      expect(file.currentVersionId).toBe(first.id);
      expect(versions.map((version) => version.id)).toEqual([
        first.id,
      ]);
    });

    it("rejects FileVersion.fileId identity mutation", async () => {
      const first = await createVersion({
        marker: "file-id-immutable",
      });
      const other = await createVersion({
        marker: "file-id-other",
      });

      await expectDatabaseRejection(
        () =>
          prisma.$executeRaw`
            UPDATE "file_version"
            SET "fileId" = ${other.fileId}
            WHERE id = ${first.id}
          `,
        {
          sqlState: "42501",
          message: "file_version identity is immutable",
        },
      );

      const stored = await prisma.fileVersion.findUniqueOrThrow({
        where: { id: first.id },
      });
      expect(stored.fileId).toBe(first.fileId);
    });

    it("rejects FileVersion.versionNumber identity mutation", async () => {
      const version = await createVersion({
        marker: "version-number-immutable",
      });

      await expectDatabaseRejection(
        () =>
          prisma.$executeRaw`
            UPDATE "file_version"
            SET "versionNumber" = ${version.versionNumber + 100}
            WHERE id = ${version.id}
          `,
        {
          sqlState: "42501",
          message: "file_version identity is immutable",
        },
      );

      const stored = await prisma.fileVersion.findUniqueOrThrow({
        where: { id: version.id },
      });
      expect(stored.versionNumber).toBe(version.versionNumber);
    });

    it("rejects deletion of a completed target", async () => {
      const version = await createVersion({
        marker: "completed-delete",
      });

      await expectDatabaseRejection(
        () =>
          prisma.$executeRaw`
            DELETE FROM "file_version"
            WHERE id = ${version.id}
          `,
        {
          sqlState: "42501",
          message: "file_version rows cannot be deleted",
        },
      );

      expect(
        await prisma.fileVersion.findUnique({
          where: { id: version.id },
        }),
      ).not.toBeNull();
    });

    it("rejects COMPLETED to UPLOADING state reversal", async () => {
      const version = await createVersion({
        marker: "state-reversal",
      });
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
          message: "invalid upload intent state transition",
        },
      );

      expect((await completedIntent(version)).status).toBe(
        "COMPLETED",
      );
    });

    it("rejects regression to an older completed version", async () => {
      const first = await createVersion({
        marker: "regression-v1",
      });
      await createVersion({
        marker: "regression-v2",
        fileId: first.fileId,
      });

      await expectDatabaseRejection(
        () =>
          prisma.$executeRaw`
            UPDATE "file"
            SET "currentVersionId" = ${first.id}
            WHERE id = ${first.fileId}
          `,
        {
          sqlState: "23514",
          message: "File current pointer is not the latest version",
        },
      );

      const current = await prisma.file.findUniqueOrThrow({
        where: { id: first.fileId },
        select: { currentVersionId: true },
      });
      expect(current.currentVersionId).not.toBe(first.id);
    });

    it("rejects multiple current-pointer changes in one transaction", async () => {
      const first = await createVersion({
        marker: "multi-event-v1",
      });
      const second = await createVersion({
        marker: "multi-event-v2",
        fileId: first.fileId,
      });
      const third = await createVersion({
        marker: "multi-event-v3",
        fileId: first.fileId,
      });

      await expectDatabaseRejection(
        () =>
          prisma.$transaction(async (tx) => {
            await tx.$executeRaw`
              UPDATE "file"
              SET "currentVersionId" = ${second.id}
              WHERE id = ${first.fileId}
            `;
            await tx.$executeRaw`
              UPDATE "file"
              SET "currentVersionId" = ${first.id}
              WHERE id = ${first.fileId}
            `;
          }),
        {
          sqlState: "23514",
          message: "File current pointer is not the latest version",
        },
      );

      const current = await prisma.file.findUniqueOrThrow({
        where: { id: first.fileId },
        select: { currentVersionId: true },
      });
      expect(current.currentVersionId).toBe(third.id);
    });

    it("enforces the named guard when SET CONSTRAINTS is IMMEDIATE", async () => {
      const first = await createVersion({
        marker: "set-constraints-v1",
      });
      const second = await createVersion({
        marker: "set-constraints-v2",
        fileId: first.fileId,
      });

      await expectDatabaseRejection(
        () =>
          prisma.$transaction(async (tx) => {
            await tx.$executeRaw`
              UPDATE "file"
              SET "currentVersionId" = ${first.id}
              WHERE id = ${first.fileId}
            `;
            await tx.$executeRawUnsafe(
              'SET CONSTRAINTS "p13_file_current_latest_completed_guard" IMMEDIATE',
            );
          }),
        {
          sqlState: "23514",
          message: "File current pointer is not the latest version",
        },
      );

      expect(
        await prisma.file.findUniqueOrThrow({
          where: { id: first.fileId },
          select: { currentVersionId: true },
        }),
      ).toMatchObject({ currentVersionId: second.id });
    });

    it("discards deferred events from a rolled-back SAVEPOINT", async () => {
      const first = await createVersion({
        marker: "savepoint-v1",
      });
      const second = await createVersion({
        marker: "savepoint-v2",
        fileId: first.fileId,
      });

      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SAVEPOINT r10_guard_test");
        await tx.$executeRaw`
          UPDATE "file"
          SET "currentVersionId" = ${first.id}
          WHERE id = ${first.fileId}
        `;
        await tx.$executeRawUnsafe(
          "ROLLBACK TO SAVEPOINT r10_guard_test",
        );
        await tx.$executeRawUnsafe(
          "RELEASE SAVEPOINT r10_guard_test",
        );
      });

      expect(
        await prisma.file.findUniqueOrThrow({
          where: { id: first.fileId },
          select: { currentVersionId: true },
        }),
      ).toMatchObject({ currentVersionId: second.id });
    });

    it("rejects TRUNCATE of FileVersion history", async () => {
      const before = await prisma.fileVersion.count();

      await expectDatabaseRejection(
        () =>
          prisma.$executeRawUnsafe(
            'TRUNCATE TABLE "file_version"',
          ),
        {
          sqlState: "42501",
          message: "file_version rows cannot be truncated in P1-3",
        },
      );

      expect(await prisma.fileVersion.count()).toBe(before);
    });

    it("retains the FK restriction when deleting a parent File", async () => {
      const version = await createVersion({
        marker: "file-delete-fk",
      });

      await expectDatabaseRejection(
        () =>
          prisma.$executeRaw`
            DELETE FROM "file"
            WHERE id = ${version.fileId}
          `,
        { sqlState: "23503" },
      );

      expect(
        await prisma.file.findUnique({
          where: { id: version.fileId },
        }),
      ).not.toBeNull();
    });

    it("allows one winner when two sessions append from the same current", async () => {
      const base = await createVersion({
        marker: "concurrent-base",
      });
      const contenders = await Promise.allSettled([
        createVersion({
          marker: `concurrent-a-${randomUUID()}`,
          fileId: base.fileId,
        }),
        createVersion({
          marker: `concurrent-b-${randomUUID()}`,
          fileId: base.fileId,
        }),
      ]);

      expect(
        contenders.filter(
          (result) => result.status === "fulfilled",
        ),
      ).toHaveLength(1);
      const loser = contenders.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );
      expect(loser).toBeDefined();
      expect(errorText(loser?.reason)).toMatch(
        /23514|23505|Unique constraint|stale or missing/,
      );

      const [file, versions] = await Promise.all([
        prisma.file.findUniqueOrThrow({
          where: { id: base.fileId },
          select: { currentVersionId: true },
        }),
        prisma.fileVersion.findMany({
          where: { fileId: base.fileId },
          select: { id: true, uploadIntentId: true },
        }),
      ]);
      expect(versions).toHaveLength(2);
      expect(versions.map((version) => version.id)).toContain(
        file.currentVersionId,
      );
      expect(
        await prisma.fileUploadIntent.count({
          where: {
            completedFileVersionId: file.currentVersionId,
            status: "COMPLETED",
          },
        }),
      ).toBe(1);
    });
  },
);
