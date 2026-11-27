import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { PHASE40_HISTORY_VECTORS } from "./fixtures/phase40-append-intent-history-vectors";

const root = resolve(import.meta.dirname, "../../..");

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

const migration = read(
  "prisma/migrations/20261126150000_phase40_append_intent_finalization_hardening/migration.sql",
);
const phase39Migration = read(
  "prisma/migrations/20261126140000_phase39_append_intent_relational_integrity/migration.sql",
);
const phase41Migration = read(
  "prisma/migrations/20261126160000_phase41_append_scope_precheck/migration.sql",
);
const phase40Integration = read(
  "apps/web/tests/integration/phase40-append-intent-finalization.test.ts",
);
const phase41CatalogIntegration = read(
  "apps/web/tests/integration/phase41-trigger-catalog.test.ts",
);
const phase41CatalogHelper = read(
  "apps/web/tests/helpers/phase41-trigger-catalog.ts",
);
const p13Helper = read("apps/web/tests/helpers/p13-file-version.ts");
const uploadService = read(
  "apps/web/src/modules/files/upload-service.ts",
);
const objectUploadService = read(
  "apps/web/src/modules/files/object-upload-service.ts",
);

describe("R14 phase40 migration", () => {
  it("locks and prechecks before the first DDL", () => {
    const lockIndex = migration.indexOf("LOCK TABLE");
    const precheckIndex = migration.indexOf("DO $$");
    const firstFunctionIndex = migration.indexOf(
      'CREATE OR REPLACE FUNCTION "validate_upload_intent_completion"',
    );
    const firstDropIndex = migration.indexOf("DROP TRIGGER");

    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(precheckIndex).toBeGreaterThan(lockIndex);
    expect(firstFunctionIndex).toBeGreaterThan(precheckIndex);
    expect(firstDropIndex).toBeGreaterThan(precheckIndex);
    expect(migration).toContain("ACCESS EXCLUSIVE MODE NOWAIT");
    expect(migration.indexOf('"project",')).toBeLessThan(
      migration.indexOf('"file_version",'),
    );
    expect(migration.indexOf('"file_version",')).toBeLessThan(
      migration.indexOf('"file",'),
    );
    expect(migration.indexOf('"file",')).toBeLessThan(
      migration.indexOf('"file_upload_intent"'),
    );
  });

  it("retains the R10 Migration and adds a forward-only correction", () => {
    expect(phase39Migration).toContain(
      '"p13_completed_append_current_guard"',
    );
    expect(migration).toContain(
      'DROP TRIGGER IF EXISTS "p13_completed_append_current_guard"',
    );
    expect(migration).toContain(
      '"p13_completed_intent_final_guard"',
    );
    expect(migration).toContain(
      "'legacy Append completion function still exists'",
    );
    expect(migration).toContain(
      '"p13_assert_completed_intent_final"',
    );
  });

  it("implements the unified N/N and Append completion invariant", () => {
    expect(migration).toContain(
      '"completedFileVersionId" IS NULL',
    );
    expect(migration).toContain(
      'f."createdByUploadIntentId" IS DISTINCT FROM i.id',
    );
    expect(migration).toContain(
      'f.id IS DISTINCT FROM i."existingFileId"',
    );
    expect(migration).toContain(
      'expected."fileId" IS DISTINCT FROM f.id',
    );
    expect(migration).toContain(
      'expected."versionNumber" >= fv."versionNumber"',
    );
    expect(migration).toContain(
      'f."currentVersionId" IS DISTINCT FROM fv.id',
    );
    expect(migration).toContain(
      'fv."versionNumber" IS DISTINCT FROM v_max_version_number',
    );
    expect(migration).not.toMatch(
      /IF i\."existingFileId" IS NULL THEN\s+RETURN NULL;/,
    );
  });

  it("fails closed for new Append targets and current changes on legacy Files", () => {
    expect(migration).toContain(
      "'legacy-unverified File cannot become a new Append target'",
    );
    expect(migration).toContain(
      "'legacy-unverified File current pointer cannot change'",
    );
    expect(migration).toContain(
      "f.\"createdByUploadIntentId\" IS NULL",
    );
    expect(uploadService).toContain(
      "LEGACY_FILE_APPEND_FORBIDDEN",
    );
    expect(uploadService).toContain(
      "createdByUploadIntentId: true",
    );
  });

  it("freezes all six File provenance-scope fields", () => {
    const normalizedMigration = migration.replace(/\s+/g, " ");
    for (const field of [
      '"customerId"',
      '"projectId"',
      '"buildingId"',
      '"installationUnitId"',
      '"createdById"',
      '"createdByUploadIntentId"',
    ]) {
      expect(normalizedMigration).toContain(
        `NEW.${field} IS DISTINCT FROM OLD.${field}`,
      );
      expect(migration).toContain(field);
    }
    expect(migration).toContain(
      'CREATE TRIGGER "p13_file_provenance_scope_immutable"',
    );
    expect(migration).toContain("'File provenance scope is immutable'");
  });

  it("defines executable history vectors for every precheck category", () => {
    const categories = new Set(
      PHASE40_HISTORY_VECTORS.map((vector) => vector.expectedCategory),
    );

    expect(PHASE40_HISTORY_VECTORS).toHaveLength(22);
    expect(categories).toContain("safe");
    expect(categories).toContain("legacy_unverified");
    for (const category of [
      "invalid_pair",
      "dangling_expected",
      "cross_file_expected",
      "uploading_current_mismatch",
      "completed_target_missing_or_wrong_intent",
      "append_completed_target_wrong_file",
      "append_expected_not_before_target",
      "new_file_origin_conflict",
      "new_file_target_not_origin",
      "origin_scope_mismatch",
      "versioned_file_null_current",
      "file_current_not_max",
      "file_current_unowned",
      "active_append_legacy_origin",
      "append_target_missing",
      "append_building_scope_mismatch",
      "append_installation_unit_scope_mismatch",
      "append_scope_combination_mismatch",
      "append_expected_current_wrong_file",
      "legacy_append_unverified",
    ]) {
      expect(categories).toContain(category);
      expect(
        migration.includes(`'${category}'`) ||
          phase41Migration.includes(`'${category}'`),
      ).toBe(true);
    }
  });

  it("adds the phase41 Append scope precheck before any DDL", () => {
    const lockIndex = phase41Migration.indexOf("LOCK TABLE");
    const precheckIndex = phase41Migration.indexOf("DO $$");
    const firstDdlIndex = phase41Migration.search(
      /\b(CREATE|ALTER|DROP|TRUNCATE)\b/,
    );

    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(precheckIndex).toBeGreaterThan(lockIndex);
    expect(firstDdlIndex).toBe(-1);
    expect(phase41Migration).toContain(
      "append_building_scope_mismatch",
    );
    expect(phase41Migration).toContain(
      "append_installation_unit_scope_mismatch",
    );
    expect(phase41Migration).toContain(
      "append_scope_combination_mismatch",
    );
    expect(phase41Migration).toContain(
      "legacy_append_unverified",
    );
    expect(phase41Migration).toContain(
      "uniqueUnsafeRecords",
    );
    expect(phase41Migration).toContain(
      "p13_completed_intent_final_guard",
    );
    expect(phase41Migration).toContain(
      "File provenance trigger postcheck failed",
    );
    const phase41Precheck = phase41Migration.slice(
      phase41Migration.indexOf("WITH conflicts AS ("),
      phase41Migration.indexOf("DO $$\nBEGIN"),
    );
    const phase41Ranked = phase41Precheck.slice(
      phase41Precheck.indexOf("ranked AS ("),
      phase41Precheck.indexOf("grouped AS ("),
    );
    expect(phase41Ranked).toContain("record_kind");
    expect(phase41Ranked).toContain("FROM classified");
    expect(phase41Ranked).not.toContain("FROM conflicts");
  });

  it("moves all Append scope categories before phase40 DDL", () => {
    const firstFunctionIndex = migration.indexOf(
      'CREATE OR REPLACE FUNCTION "validate_upload_intent_completion"',
    );
    for (const category of [
      "append_target_missing",
      "append_building_scope_mismatch",
      "append_installation_unit_scope_mismatch",
      "append_scope_combination_mismatch",
      "append_expected_current_wrong_file",
      "legacy_append_unverified",
    ]) {
      expect(migration.indexOf(category)).toBeGreaterThanOrEqual(0);
      expect(migration.indexOf(category)).toBeLessThan(
        firstFunctionIndex,
      );
    }
    expect(migration).toContain("uniqueUnsafeRecords");
    expect(migration).toContain("classified AS");
  });

  it("keeps the ranked CTE column dependency on classified", () => {
    const precheckStart = migration.indexOf("WITH conflicts AS (");
    const rankedStart = migration.indexOf("ranked AS (");
    const groupedStart = migration.indexOf("grouped AS (");
    const precheck = migration.slice(precheckStart, groupedStart);
    const ranked = precheck.slice(
      precheck.indexOf("ranked AS ("),
      precheck.indexOf("grouped AS ("),
    );
    const declared = precheck.slice(
      precheck.indexOf("classified AS ("),
      rankedStart,
    );

    expect(precheckStart).toBeGreaterThanOrEqual(0);
    expect(rankedStart).toBeGreaterThan(precheckStart);
    expect(groupedStart).toBeGreaterThan(rankedStart);
    expect(declared).toContain("AS record_kind");
    expect(ranked).toContain("record_kind");
    expect(ranked).toContain("FROM classified");
    expect(ranked).not.toContain("FROM conflicts");
    expect(migration).toContain(
      "count(DISTINCT record_kind || ':' || object_id)",
    );
  });

  it("contains the R13 first-control and concurrency test source", () => {
    for (const scenario of [
      "N/N completion under an unrelated existing File",
      "N/N completion under another Intent's File",
      "completion before current pointer update",
      "current pointer update before completion",
      "NULL completed target",
      "same-File target owned by another Intent",
      "File provenance scope update",
      "legacy-unverified Append target",
      "legacy-unverified current advance",
      "active-slot competition",
      "rejects a real duplicate fileId/versionNumber insert",
      "stale-current competition",
      "stale execution ownership competition",
      "competes current advancement before reservation against a live Append",
      "competes reservation before current advancement",
      "fails closed when the expected database identity differs",
    ]) {
      expect(phase40Integration).toContain(scenario);
    }
    expect(phase40Integration).toContain("new PrismaClient()");
    expect(phase40Integration).toContain("createBarrier");
    expect(phase40Integration).toContain(
      'expect.arrayContaining(["existingFileId"])',
    );
    expect(p13Helper).toContain(
      "SET CONSTRAINTS \"p13_completed_intent_final_guard\" IMMEDIATE",
    );
    expect(phase41CatalogIntegration).toContain(
      "binds every critical Trigger to the expected function and event mask",
    );
    expect(phase41CatalogHelper).toContain("trigger.tgfoid");
    expect(phase41CatalogHelper).toContain("trigger.tgenabled");
    expect(phase41CatalogHelper).toContain(
      "p13_assert_completed_intent_final",
    );
    expect(phase41CatalogHelper).toContain(
      "p13_protect_file_provenance_scope",
    );
  });

  it("retains explicit READ COMMITTED for every upload interaction", () => {
    for (const source of [uploadService, objectUploadService]) {
      expect(source).toContain(
        "isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted",
      );
    }
    expect(
      uploadService.match(/\$transaction\(/g),
    ).toHaveLength(
      (uploadService.match(/UPLOAD_TRANSACTION_OPTIONS/g) ?? []).length -
        1,
    );
    expect(
      objectUploadService.match(/\$transaction\(/g),
    ).toHaveLength(
      (objectUploadService.match(/UPLOAD_TRANSACTION_OPTIONS/g) ?? [])
        .length - 1,
    );
  });

  it("keeps test-fixture-only negative modes explicit", () => {
    expect(p13Helper).toContain("newFileTargetFileId");
    expect(p13Helper).toContain("skipCurrentPointerUpdate");
    expect(p13Helper).toContain(
      'completionOrder === "COMPLETION_FIRST"',
    );
    expect(p13Helper).toContain(
      "forceFinalCompletionGuardImmediate",
    );
  });
});
