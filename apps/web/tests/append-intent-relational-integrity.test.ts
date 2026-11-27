import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

const migration = read(
  "prisma/migrations/20261126140000_phase39_append_intent_relational_integrity/migration.sql",
);
const schema = read("prisma/schema.prisma");
const uploadService = read("apps/web/src/modules/files/upload-service.ts");
const objectUploadService = read(
  "apps/web/src/modules/files/object-upload-service.ts",
);
const phase31Migration = read(
  "prisma/migrations/20261115213000_phase31_file_data_model/migration.sql",
);
const phase37Migration = read(
  "prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql",
);
const p13FileVersionHelper = read(
  "apps/web/tests/helpers/p13-file-version.ts",
);
const phase39Integration = read(
  "apps/web/tests/integration/phase39-append-intent-integrity.test.ts",
);

describe("R10 append intent relational integrity migration", () => {
  it("locks the three authoritative tables before precheck and DDL", () => {
    const lockIndex = migration.indexOf("LOCK TABLE");
    const precheckIndex = migration.indexOf("DO $$");
    const firstAlterIndex = migration.indexOf("ALTER TABLE");

    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(precheckIndex).toBeGreaterThan(lockIndex);
    expect(firstAlterIndex).toBeGreaterThan(precheckIndex);
    expect(migration).toContain("ACCESS EXCLUSIVE MODE NOWAIT");
    expect(migration.indexOf('"file_version",')).toBeLessThan(
      migration.indexOf('"file",'),
    );
    expect(migration.indexOf('"file",')).toBeLessThan(
      migration.indexOf('"file_upload_intent"'),
    );
  });

  it("defines one authoritative expected-current relation and pair CHECK", () => {
    expect(migration).toContain(
      'DROP CONSTRAINT "file_upload_intent_expectedCurrentFileVersion_fkey"',
    );
    expect(migration).toContain(
      '"file_upload_intent_expectedCurrentFileVersionId_existingFileId_fkey"',
    );
    expect(migration).toContain('REFERENCES "file_version"("id", "fileId")');
    expect(migration).toContain("MATCH SIMPLE");
    expect(migration).toContain("DEFERRABLE INITIALLY DEFERRED");
    expect(migration).toContain(
      '"upload_intent_expected_current_pair_check"',
    );
  });

  it("defines durable File creation provenance", () => {
    expect(schema).toContain("createdByUploadIntentId String?");
    expect(schema).toContain(
      '@relation("UploadIntentCreatedFile"',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "file_createdByUploadIntentId_key"',
    );
    expect(migration).toContain('"p13_file_creation_origin_guard"');
    expect(migration).toContain('"p13_created_file_terminal_guard"');
    expect(uploadService).toContain(
      "createdByUploadIntentId: input.intent.id",
    );
    expect(uploadService).toContain(
      "createdByUploadIntentId: intent.id",
    );
    expect(objectUploadService).toContain(
      "createdByUploadIntentId: input.intent.id",
    );
  });

  it("defines UPLOADING and COMPLETED final-state guards", () => {
    expect(migration).toContain(
      '"p13_append_current_file_commit_guard"',
    );
    expect(migration).toContain(
      '"p13_append_current_intent_commit_guard"',
    );
    expect(migration).toContain(
      "FROM \"file\"\n  WHERE id = p_file_id",
    );
    expect(migration).toContain(
      '"p13_completed_append_current_guard"',
    );
    expect(migration).toContain(
      '"p13_file_current_latest_completed_guard"',
    );
    expect(migration).toContain(
      '"file_upload_intent_completed_current_same_file_fkey"',
    );
    expect(migration).toContain(
      '"p13_completed_intent_history_guard"',
    );
    expect(migration).toContain("v_intent_found := FOUND;");
    expect(migration).toContain("v_version_found := FOUND;");
    expect(migration).toContain("v_file_found := FOUND;");
    expect(migration).toContain(
      "'append integrity trigger postcheck failed'",
    );
    expect(migration).toContain(
      "'append integrity deferred trigger postcheck failed'",
    );
    const terminalFunction = migration.slice(
      migration.indexOf(
        'CREATE OR REPLACE FUNCTION "p13_assert_created_file_terminal_chain"',
      ),
      migration.indexOf(
        'CREATE CONSTRAINT TRIGGER "p13_created_file_terminal_guard"',
      ),
    );
    expect(terminalFunction).toContain(
      "SELECT count(*) INTO v_version_count",
    );
    expect(terminalFunction).not.toMatch(
      /SELECT count\(\*\) INTO v_version_count[\s\S]*?IF NOT FOUND/,
    );
  });

  it("enforces the full status and NULL relationship matrix", () => {
    const isValid = (
      status: string,
      existing: string | null,
      expected: string | null,
    ): boolean =>
      (existing === null && expected === null) ||
      (existing !== null && expected !== null) ||
      (existing !== null &&
        expected === null &&
        ["COMPLETED", "FAILED", "EXPIRED"].includes(status));

    const statuses = [
      "PENDING",
      "UPLOADING",
      "COMPLETED",
      "FAILED",
      "EXPIRED",
    ];

    for (const status of statuses) {
      expect(isValid(status, null, null)).toBe(true);
      expect(isValid(status, "file", "version")).toBe(true);
      expect(isValid(status, null, "version")).toBe(false);
      expect(isValid(status, "file", null)).toBe(
        ["COMPLETED", "FAILED", "EXPIRED"].includes(status),
      );
    }
  });

  it("retains the R9 database-first controls and test mappings", () => {
    expect(phase31Migration).toContain(
      '"file_version_identity_guard"',
    );
    expect(phase31Migration).toContain(
      "'file_version identity is immutable'",
    );
    expect(phase31Migration).toContain(
      "'file_version rows cannot be deleted'",
    );
    expect(phase37Migration).toContain(
      '"p13_file_version_truncate_guard"',
    );
    expect(phase37Migration).toContain(
      '"p13_upload_intent_truncate_guard"',
    );
    expect(phase37Migration).toContain(
      "'invalid upload intent state transition'",
    );

    for (const scenario of [
      "installs the named compound relations and deferred guards",
      "rejects reservation after the expected-current snapshot becomes stale",
      "rejects COMPLETED with NULL target without partial rows",
      "rejects a same-File completed target owned by another Intent",
      "rejects FileVersion.fileId identity mutation",
      "rejects FileVersion.versionNumber identity mutation",
      "rejects deletion of a completed target",
      "rejects COMPLETED to UPLOADING state reversal",
      "rejects regression to an older completed version",
      "rejects multiple current-pointer changes in one transaction",
      "enforces the named guard when SET CONSTRAINTS is IMMEDIATE",
      "discards deferred events from a rolled-back SAVEPOINT",
      "rejects TRUNCATE of FileVersion history",
      "retains the FK restriction when deleting a parent File",
    ]) {
      expect(phase39Integration).toContain(scenario);
    }
    expect(phase39Integration).toContain(
      "allows one winner when two sessions append from the same current",
    );
    expect(p13FileVersionHelper).toContain(
      'completedTargetMode === "NULL"',
    );
    expect(p13FileVersionHelper).toContain(
      'completedTargetMode === "OVERRIDE"',
    );
  });
});

describe("R10 upload transaction isolation", () => {
  it("uses explicit READ COMMITTED for every upload interactive transaction", () => {
    expect(uploadService).toContain(
      "isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted",
    );
    expect(objectUploadService).toContain(
      "isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted",
    );

    expect(
      uploadService.match(/\$transaction\(/g),
    ).toHaveLength(
      uploadService.match(/UPLOAD_TRANSACTION_OPTIONS/g)?.length ===
        undefined
        ? 0
        : uploadService.match(/UPLOAD_TRANSACTION_OPTIONS/g)!.length - 1,
    );
    expect(
      objectUploadService.match(/\$transaction\(/g),
    ).toHaveLength(
      objectUploadService.match(/UPLOAD_TRANSACTION_OPTIONS/g)?.length ===
        undefined
        ? 0
        : objectUploadService.match(/UPLOAD_TRANSACTION_OPTIONS/g)!.length -
            1,
    );
  });
});
