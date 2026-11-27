import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../prisma/migrations/20261126130000_phase38_route_c_minimal_recovery_hardening/migration.sql",
);

describe("Route C-Minimal recovery migration invariants", () => {
  it("contains database-owned identity, key and immutability guards", async () => {
    const sql = await fs.readFile(migrationPath, "utf8");

    expect(sql).toContain(
      'CREATE UNIQUE INDEX "storage_object_binding_namespace_objectKey_key"',
    );
    expect(sql).toContain('ADD COLUMN "writeObservedAt"');
    expect(sql).toContain(
      'ADD COLUMN "writeIdempotencyKey" VARCHAR(160)',
    );
    expect(sql).toContain(
      'CONSTRAINT "storage_object_operation_write_idempotency_check"',
    );
    expect(sql).toContain(
      'ADD COLUMN "expectedCurrentFileVersionId"',
    );
    expect(sql).toContain(
      'ADD CONSTRAINT "storage_object_binding_operation_chain_fkey"',
    );
    expect(sql).toContain(
      'ADD CONSTRAINT "file_version_binding_chain_fkey"',
    );
    expect(sql).toContain(
      'CREATE TRIGGER "p13_file_version_storage_pointer_immutable"',
    );
    expect(sql).toContain(
      'CREATE TRIGGER "p13_upload_intent_target_slot_guard"',
    );
    expect(sql).toContain(
      'CREATE TRIGGER "p13_operation_write_identity_guard"',
    );
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "one_active_append_intent_per_file"',
    );
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION "p13_collect_lifecycle_intent_ids"',
    );
    expect(sql).toContain(
      'l."storageBackend" IN (\'OBJECT_STORE\', \'LEGACY_LOCAL\')',
    );
    expect(sql).toContain(
      'l.state = \'STAGING_READY\'',
    );
    expect(sql).toContain(
      'binding cannot be verified before Provider exact version observation',
    );
    const precheckIndex = sql.indexOf(
      "CM1-R3 precheck blocked before DDL",
    );
    const firstDdlIndex = sql.indexOf(
      'ADD COLUMN "providerRequestId"',
    );
    expect(precheckIndex).toBeGreaterThan(-1);
    expect(firstDdlIndex).toBeGreaterThan(-1);
    expect(precheckIndex).toBeLessThan(firstDdlIndex);
    expect(sql).toContain(
      "SELECT count(*) INTO v_any_binding",
    );
    expect(sql).toContain(
      "SELECT count(*) INTO v_any_object_lifecycle",
    );
    expect(sql).toContain(
      "SELECT count(*) INTO v_object_finalize_operation",
    );
    expect(sql).toContain(
      "SELECT count(*) INTO v_active_append_intent",
    );
    expect(sql).toContain(
      "SELECT count(*) INTO v_incomplete_binding_chain",
    );
    expect(sql).toContain(
      'CREATE CONSTRAINT TRIGGER "p13_binding_terminal_guard"',
    );
    expect(sql).toContain(
      'CREATE CONSTRAINT TRIGGER "p13_operation_binding_terminal_guard"',
    );
    expect(sql).toContain(
      'CREATE CONSTRAINT TRIGGER "p13_file_version_binding_terminal_guard"',
    );
    expect(sql).toContain(
      'VERIFIED binding requires APPLIED operation, ACTIVE lifecycle and one matching FileVersion',
    );
  });

  it("sorts after the CM1 migration and not after the current date", async () => {
    const directory = path.dirname(migrationPath);
    const name = path.basename(directory);
    expect(name).toBe(
      "20261126130000_phase38_route_c_minimal_recovery_hardening",
    );
    expect(name > "20261126120000_phase38_route_c_minimal_object_binding")
      .toBe(true);
  });
});
