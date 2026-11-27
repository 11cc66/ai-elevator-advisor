-- WP-2A-CM1-R2: close object binding ownership, key reuse,
-- exact-version persistence and interrupt-recovery source gaps.

-- These checks use only columns that existed before this Migration. They run
-- before any ALTER TABLE so a dangerous non-empty database cannot be changed
-- by a failed precheck. Historical object chains are deliberately blocked:
-- the schema prior to R3 cannot prove their write identity or observation
-- timestamp, and this Migration must not invent those facts.
DO $$
DECLARE
  v_any_binding INTEGER;
  v_any_object_lifecycle INTEGER;
  v_object_finalize_operation INTEGER;
  v_active_append_intent INTEGER;
  v_incomplete_binding_chain INTEGER;
BEGIN
  SELECT count(*) INTO v_any_binding
  FROM "storage_object_binding";

  SELECT count(*) INTO v_any_object_lifecycle
  FROM "storage_object_lifecycle"
  WHERE "storageBackend" = 'OBJECT_STORE';

  SELECT count(*) INTO v_object_finalize_operation
  FROM "storage_object_operation" op
  JOIN "storage_object_lifecycle" l
    ON l.id = op."objectLifecycleId"
  WHERE l."storageBackend" = 'OBJECT_STORE'
    AND op."operationType" = 'FINALIZE';

  SELECT count(*) INTO v_active_append_intent
  FROM "file_upload_intent"
  WHERE "existingFileId" IS NOT NULL
    AND status IN ('PENDING', 'UPLOADING');

  SELECT count(*) INTO v_incomplete_binding_chain
  FROM "storage_object_binding" b
  LEFT JOIN "storage_object_operation" op ON op.id = b."operationId"
  LEFT JOIN "storage_object_lifecycle" l ON l.id = b."objectLifecycleId"
  WHERE op.id IS NULL
     OR l.id IS NULL
     OR op."objectLifecycleId" IS DISTINCT FROM b."objectLifecycleId"
     OR op."storageKey" IS DISTINCT FROM b."objectKey"
     OR l."storageKey" IS DISTINCT FROM b."objectKey";

  IF v_any_binding > 0
     OR v_any_object_lifecycle > 0
     OR v_object_finalize_operation > 0
     OR v_active_append_intent > 0
     OR v_incomplete_binding_chain > 0
  THEN
    RAISE EXCEPTION
      'CM1-R3 precheck blocked before DDL: any_binding=%, any_object_lifecycle=%, object_finalize_operation=%, active_append_intent=%, incomplete_binding_chain=%',
      v_any_binding,
      v_any_object_lifecycle,
      v_object_finalize_operation,
      v_active_append_intent,
      v_incomplete_binding_chain
      USING ERRCODE = '23514';
  END IF;
END;
$$;

ALTER TABLE "storage_object_binding"
  ADD COLUMN "providerRequestId" VARCHAR(255),
  ADD COLUMN "writeObservedAt" TIMESTAMPTZ(6);

ALTER TABLE "file_upload_intent"
  ADD COLUMN "expectedCurrentFileVersionId" VARCHAR(32);

ALTER TABLE "storage_object_operation"
  ADD COLUMN "writeIdempotencyKey" VARCHAR(160);

ALTER TABLE "storage_object_operation"
  ADD CONSTRAINT "storage_object_operation_write_idempotency_check"
  CHECK (
    "writeIdempotencyKey" IS NULL
    OR "writeIdempotencyKey" =
      'object-write:v1:' || "sourceAttemptId" || ':' || "id"
  );

CREATE OR REPLACE FUNCTION "p13_protect_operation_write_identity"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."writeIdempotencyKey"
     IS DISTINCT FROM OLD."writeIdempotencyKey"
  THEN
    RAISE EXCEPTION 'operation write idempotency identity is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "p13_operation_write_identity_guard"
BEFORE UPDATE OF "writeIdempotencyKey"
ON "storage_object_operation"
FOR EACH ROW
EXECUTE FUNCTION "p13_protect_operation_write_identity"();

ALTER TABLE "file_upload_intent"
  ADD CONSTRAINT "file_upload_intent_expectedCurrentFileVersion_fkey"
  FOREIGN KEY ("expectedCurrentFileVersionId")
  REFERENCES "file_version"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE INDEX "file_upload_intent_existingFileId_status_idx"
  ON "file_upload_intent"("existingFileId", "status");

-- Only one upload may hold the append slot for a File at one time.
CREATE UNIQUE INDEX "one_active_append_intent_per_file"
  ON "file_upload_intent"("existingFileId")
  WHERE "existingFileId" IS NOT NULL
    AND "status" = 'UPLOADING';

-- An object key is allocated once for an Attempt and is never reused,
-- even when a later Provider Version may exist for the same key.
CREATE UNIQUE INDEX "storage_object_binding_namespace_objectKey_key"
  ON "storage_object_binding"(
    "providerKind",
    "accountScopeRef",
    "region",
    "bucketOrContainer",
    "objectKey"
  );

CREATE UNIQUE INDEX "storage_object_binding_id_operationId_objectKey_key"
  ON "storage_object_binding"("id", "operationId", "objectKey");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "storage_object_binding" b
    JOIN "storage_object_operation" op ON op.id = b."operationId"
    WHERE op."objectLifecycleId" IS DISTINCT FROM b."objectLifecycleId"
       OR op."storageKey" IS DISTINCT FROM b."objectKey"
  ) THEN
    RAISE EXCEPTION
      'existing storage binding does not match its operation chain'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "storage_object_binding" b
    JOIN "storage_object_lifecycle" l
      ON l.id = b."objectLifecycleId"
    WHERE l."storageKey" IS DISTINCT FROM b."objectKey"
  ) THEN
    RAISE EXCEPTION
      'existing storage binding does not match its lifecycle key'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "file_version" fv
    JOIN "storage_object_binding" b
      ON b.id = fv."storageObjectBindingId"
    WHERE fv."creationOperationAttemptId" IS DISTINCT FROM b."operationId"
       OR fv."storageKey" IS DISTINCT FROM b."objectKey"
  ) THEN
    RAISE EXCEPTION
      'existing FileVersion does not match its object binding chain'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

ALTER TABLE "storage_object_binding"
  ADD CONSTRAINT "storage_object_binding_lifecycle_key_fkey"
  FOREIGN KEY ("objectLifecycleId", "objectKey")
  REFERENCES "storage_object_lifecycle"("id", "storageKey")
  ON DELETE RESTRICT ON UPDATE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "storage_object_binding"
  ADD CONSTRAINT "storage_object_binding_operation_chain_fkey"
  FOREIGN KEY ("operationId", "objectLifecycleId", "objectKey")
  REFERENCES "storage_object_operation"(
    "id",
    "objectLifecycleId",
    "storageKey"
  )
  ON DELETE RESTRICT ON UPDATE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "file_version"
  ADD CONSTRAINT "file_version_binding_chain_fkey"
  FOREIGN KEY (
    "storageObjectBindingId",
    "creationOperationAttemptId",
    "storageKey"
  )
  REFERENCES "storage_object_binding"("id", "operationId", "objectKey")
  ON DELETE RESTRICT ON UPDATE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "storage_object_binding"
  DROP CONSTRAINT "storage_object_binding_state_fields_check";

ALTER TABLE "storage_object_binding"
  ADD CONSTRAINT "storage_object_binding_state_fields_check"
  CHECK (
    (
      "state" = 'PENDING'
      AND "verifiedAt" IS NULL
      AND (
        (
          "providerVersionId" IS NULL
          AND "providerGeneration" IS NULL
          AND "providerRequestId" IS NULL
          AND "sizeBytes" IS NULL
          AND "checksumSha256" IS NULL
          AND "writeObservedAt" IS NULL
        )
        OR
        (
          "providerVersionId" IS NOT NULL
          AND char_length(btrim("providerVersionId")) > 0
          AND "sizeBytes" IS NOT NULL
          AND "sizeBytes" > 0
          AND "checksumSha256" IS NOT NULL
          AND "checksumSha256" ~ '^[0-9A-Fa-f]{64}$'
          AND "writeObservedAt" IS NOT NULL
        )
      )
    )
    OR
    (
      "state" = 'VERIFIED'
      AND "providerVersionId" IS NOT NULL
      AND char_length(btrim("providerVersionId")) > 0
      AND "sizeBytes" IS NOT NULL
      AND "sizeBytes" > 0
      AND "checksumSha256" IS NOT NULL
      AND "checksumSha256" ~ '^[0-9A-Fa-f]{64}$'
      AND "writeObservedAt" IS NOT NULL
      AND "verifiedAt" IS NOT NULL
    )
    OR
    (
      "state" = 'FAILED_RETAINED'
      AND "verifiedAt" IS NULL
    )
  );

ALTER TABLE "storage_object_binding"
  ADD CONSTRAINT "storage_object_binding_identity_text_check"
  CHECK (
    char_length(btrim("providerKind")) > 0
    AND "providerKind" = btrim("providerKind")
    AND char_length(btrim("accountScopeRef")) > 0
    AND "accountScopeRef" = btrim("accountScopeRef")
    AND char_length(btrim("region")) > 0
    AND "region" = btrim("region")
    AND char_length(btrim("bucketOrContainer")) > 0
    AND "bucketOrContainer" = btrim("bucketOrContainer")
    AND "objectKey" LIKE 'objects/%'
    AND char_length(btrim("objectKey")) > 0
    AND "objectKey" = btrim("objectKey")
    AND (
      "providerVersionId" IS NULL
      OR (
        char_length(btrim("providerVersionId")) > 0
        AND "providerVersionId" = btrim("providerVersionId")
      )
    )
    AND (
      "providerRequestId" IS NULL
      OR (
        char_length(btrim("providerRequestId")) > 0
        AND "providerRequestId" = btrim("providerRequestId")
      )
    )
  );

CREATE OR REPLACE FUNCTION "p13_protect_storage_binding"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'storage object binding cannot be deleted'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW."objectLifecycleId" IS DISTINCT FROM OLD."objectLifecycleId"
     OR NEW."operationId" IS DISTINCT FROM OLD."operationId"
     OR NEW."providerKind" IS DISTINCT FROM OLD."providerKind"
     OR NEW."accountScopeRef" IS DISTINCT FROM OLD."accountScopeRef"
     OR NEW."region" IS DISTINCT FROM OLD."region"
     OR NEW."bucketOrContainer" IS DISTINCT FROM OLD."bucketOrContainer"
     OR NEW."objectKey" IS DISTINCT FROM OLD."objectKey"
  THEN
    RAISE EXCEPTION 'storage object binding identity is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD."writeObservedAt" IS NOT NULL
     AND (
       NEW."providerVersionId" IS DISTINCT FROM OLD."providerVersionId"
       OR NEW."providerGeneration" IS DISTINCT FROM OLD."providerGeneration"
       OR NEW."providerRequestId" IS DISTINCT FROM OLD."providerRequestId"
       OR NEW."sizeBytes" IS DISTINCT FROM OLD."sizeBytes"
       OR NEW."checksumSha256" IS DISTINCT FROM OLD."checksumSha256"
       OR NEW."writeObservedAt" IS DISTINCT FROM OLD."writeObservedAt"
     )
  THEN
    RAISE EXCEPTION 'observed storage object version is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.state IN ('VERIFIED', 'FAILED_RETAINED')
     AND (
       NEW.state IS DISTINCT FROM OLD.state
       OR NEW."providerVersionId" IS DISTINCT FROM OLD."providerVersionId"
       OR NEW."providerGeneration" IS DISTINCT FROM OLD."providerGeneration"
       OR NEW."providerRequestId" IS DISTINCT FROM OLD."providerRequestId"
       OR NEW."sizeBytes" IS DISTINCT FROM OLD."sizeBytes"
       OR NEW."checksumSha256" IS DISTINCT FROM OLD."checksumSha256"
       OR NEW."writeObservedAt" IS DISTINCT FROM OLD."writeObservedAt"
       OR NEW."verifiedAt" IS DISTINCT FROM OLD."verifiedAt"
     )
  THEN
    RAISE EXCEPTION 'terminal storage object binding is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.state = 'PENDING'
     AND NEW.state NOT IN ('PENDING', 'VERIFIED', 'FAILED_RETAINED')
  THEN
    RAISE EXCEPTION 'invalid storage object binding transition'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.state = 'PENDING'
     AND NEW.state = 'VERIFIED'
     AND NEW."writeObservedAt" IS NULL
  THEN
    RAISE EXCEPTION
      'binding cannot be verified before Provider exact version observation'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_assert_file_version_binding"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  b "storage_object_binding"%ROWTYPE;
  l "storage_object_lifecycle"%ROWTYPE;
BEGIN
  IF NEW."storageBackend" = 'LEGACY_LOCAL' THEN
    IF NEW."storageObjectBindingId" IS NOT NULL THEN
      RAISE EXCEPTION 'legacy FileVersion must not have object binding'
        USING ERRCODE = '23514';
    END IF;
    SELECT * INTO l
    FROM "storage_object_lifecycle"
    WHERE "storageKey" = NEW."storageKey"
    FOR SHARE;
    IF NOT FOUND OR l."storageBackend" <> 'LEGACY_LOCAL' THEN
      RAISE EXCEPTION
        'legacy FileVersion lifecycle backend does not match'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."storageObjectBindingId" IS NULL THEN
    RAISE EXCEPTION 'object FileVersion requires object binding'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO b
  FROM "storage_object_binding"
  WHERE id = NEW."storageObjectBindingId"
  FOR SHARE;

  SELECT * INTO l
  FROM "storage_object_lifecycle"
  WHERE "storageKey" = NEW."storageKey"
  FOR SHARE;

  IF NOT FOUND
     OR l."storageBackend" <> 'OBJECT_STORE'
     OR l.id IS DISTINCT FROM b."objectLifecycleId"
     OR l."storageKey" IS DISTINCT FROM b."objectKey"
  THEN
    RAISE EXCEPTION
      'FileVersion object binding is not owned by its lifecycle'
      USING ERRCODE = '23514';
  END IF;

  IF b.state <> 'VERIFIED'
     OR b."operationId" IS DISTINCT FROM NEW."creationOperationAttemptId"
     OR b."objectKey" IS DISTINCT FROM NEW."storageKey"
     OR b."sizeBytes" IS DISTINCT FROM NEW."sizeBytes"
     OR b."checksumSha256" IS DISTINCT FROM NEW."checksumSha256"
     OR b."providerVersionId" IS NULL
     OR b."writeObservedAt" IS NULL
  THEN
    RAISE EXCEPTION 'FileVersion does not match verified object binding'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_protect_file_version_storage_pointer"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."storageBackend" IS DISTINCT FROM OLD."storageBackend"
     OR NEW."storageObjectBindingId"
        IS DISTINCT FROM OLD."storageObjectBindingId"
  THEN
    RAISE EXCEPTION 'FileVersion storage pointer is immutable'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "p13_file_version_storage_pointer_immutable"
BEFORE UPDATE OF "storageBackend", "storageObjectBindingId"
ON "file_version"
FOR EACH ROW
EXECUTE FUNCTION "p13_protect_file_version_storage_pointer"();

CREATE OR REPLACE FUNCTION "p13_protect_upload_intent_target_slot"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."expectedCurrentFileVersionId"
     IS DISTINCT FROM OLD."expectedCurrentFileVersionId"
  THEN
    RAISE EXCEPTION 'upload intent target slot is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "p13_upload_intent_target_slot_guard"
BEFORE UPDATE OF "expectedCurrentFileVersionId"
ON "file_upload_intent"
FOR EACH ROW
EXECUTE FUNCTION "p13_protect_upload_intent_target_slot"();

CREATE OR REPLACE FUNCTION "p13_assert_binding_terminal_chain"(
  p_binding_id VARCHAR
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  b "storage_object_binding"%ROWTYPE;
  op "storage_object_operation"%ROWTYPE;
  l "storage_object_lifecycle"%ROWTYPE;
  fv "file_version"%ROWTYPE;
  v_file_version_count INTEGER;
  v_operation_found BOOLEAN;
  v_lifecycle_found BOOLEAN;
BEGIN
  IF p_binding_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO b
  FROM "storage_object_binding"
  WHERE id = p_binding_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT * INTO op
  FROM "storage_object_operation"
  WHERE id = b."operationId";
  v_operation_found := FOUND;
  SELECT * INTO l
  FROM "storage_object_lifecycle"
  WHERE id = b."objectLifecycleId";
  v_lifecycle_found := FOUND;

  IF NOT v_operation_found
     OR NOT v_lifecycle_found
     OR op."objectLifecycleId" IS DISTINCT FROM b."objectLifecycleId"
     OR op."storageKey" IS DISTINCT FROM b."objectKey"
     OR l."storageKey" IS DISTINCT FROM b."objectKey"
  THEN
    RAISE EXCEPTION 'binding terminal chain relation mismatch'
      USING ERRCODE = '23514';
  END IF;

  IF op."writeIdempotencyKey"
     IS DISTINCT FROM
       'object-write:v1:' || op."sourceAttemptId" || ':' || op.id
  THEN
    RAISE EXCEPTION 'object operation write identity mismatch'
      USING ERRCODE = '23514';
  END IF;

  SELECT count(*) INTO v_file_version_count
  FROM "file_version"
  WHERE "storageObjectBindingId" = b.id;

  IF b.state = 'VERIFIED' THEN
    SELECT * INTO fv
    FROM "file_version"
    WHERE "storageObjectBindingId" = b.id;

    IF op.state <> 'APPLIED'
       OR l.state <> 'ACTIVE'
       OR l."storageBackend" <> 'OBJECT_STORE'
       OR v_file_version_count <> 1
       OR fv."creationOperationAttemptId" IS DISTINCT FROM op.id
       OR fv."storageKey" IS DISTINCT FROM b."objectKey"
       OR fv."sizeBytes" IS DISTINCT FROM b."sizeBytes"
       OR fv."checksumSha256" IS DISTINCT FROM b."checksumSha256"
    THEN
      RAISE EXCEPTION
        'VERIFIED binding requires APPLIED operation, ACTIVE lifecycle and one matching FileVersion'
        USING ERRCODE = '23514';
    END IF;
  ELSIF v_file_version_count <> 0 THEN
    RAISE EXCEPTION 'non-VERIFIED binding cannot be referenced by FileVersion'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_assert_binding_terminal_from_binding"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM "p13_assert_binding_terminal_chain"(NEW.id);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_assert_binding_terminal_from_operation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_binding_id VARCHAR;
BEGIN
  SELECT id INTO v_binding_id
  FROM "storage_object_binding"
  WHERE "operationId" = NEW.id;
  PERFORM "p13_assert_binding_terminal_chain"(v_binding_id);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_assert_binding_terminal_from_lifecycle"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_binding_id VARCHAR;
BEGIN
  SELECT id INTO v_binding_id
  FROM "storage_object_binding"
  WHERE "objectLifecycleId" = NEW.id;
  PERFORM "p13_assert_binding_terminal_chain"(v_binding_id);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_assert_binding_terminal_from_file_version"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM "p13_assert_binding_terminal_chain"(
    NEW."storageObjectBindingId"
  );
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "p13_binding_terminal_guard"
AFTER INSERT OR UPDATE ON "storage_object_binding"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_binding_terminal_from_binding"();

CREATE CONSTRAINT TRIGGER "p13_operation_binding_terminal_guard"
AFTER UPDATE ON "storage_object_operation"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_binding_terminal_from_operation"();

CREATE CONSTRAINT TRIGGER "p13_lifecycle_binding_terminal_guard"
AFTER UPDATE ON "storage_object_lifecycle"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_binding_terminal_from_lifecycle"();

CREATE CONSTRAINT TRIGGER "p13_file_version_binding_terminal_guard"
AFTER INSERT OR UPDATE ON "file_version"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_binding_terminal_from_file_version"();

-- Keep the original lifecycle ownership checks, but permit the object-backend
-- logical staging record to remain STAGING_READY after successful completion.
CREATE OR REPLACE FUNCTION "p13_collect_lifecycle_intent_ids"(
  p_lifecycle_id VARCHAR
)
RETURNS SETOF VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
  l "storage_object_lifecycle"%ROWTYPE;
  a "file_upload_attempt"%ROWTYPE;
  op "storage_object_operation"%ROWTYPE;
  fv "file_version"%ROWTYPE;
  v_staging_intent VARCHAR;
  v_canonical_intent VARCHAR;
  v_operation_intent VARCHAR;
  v_file_version_intent VARCHAR;
  v_distinct_count INTEGER;
BEGIN
  SELECT * INTO l
  FROM "storage_object_lifecycle"
  WHERE id = p_lifecycle_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'storage lifecycle not found'
      USING ERRCODE = '23503';
  END IF;

  PERFORM "p13_assert_staging_cleanup_attestation"(l);

  IF l."objectKind" = 'STAGING' THEN
    IF l."reservedAttemptId" IS NULL
       OR l."reservedIntentId" IS NULL
    THEN
      RAISE EXCEPTION 'STAGING lifecycle missing reserved ownership'
        USING ERRCODE = '23514';
    END IF;

    SELECT * INTO a
    FROM "file_upload_attempt"
    WHERE id = l."reservedAttemptId"
      AND "intentId" = l."reservedIntentId"
      AND "stagingKey" = l."storageKey";

    IF NOT FOUND THEN
      RAISE EXCEPTION 'STAGING lifecycle owner mismatch'
        USING ERRCODE = '23514';
    END IF;

    IF a.status = 'RESERVED' AND l.state <> 'STAGING_RESERVED' THEN
      RAISE EXCEPTION 'RESERVED attempt requires STAGING_RESERVED lifecycle'
        USING ERRCODE = '23514';
    ELSIF a.status = 'WRITING'
          AND l.state NOT IN ('STAGING', 'STAGING_ABANDONED')
    THEN
      RAISE EXCEPTION 'WRITING attempt lifecycle mismatch'
        USING ERRCODE = '23514';
    ELSIF a.status IN ('READY', 'FINALIZING', 'RECOVERY_REQUIRED')
          AND l.state NOT IN ('STAGING_READY', 'DELETED', 'FAILED_RETAINED')
    THEN
      RAISE EXCEPTION 'attempt requires retained staging lifecycle'
        USING ERRCODE = '23514';
    ELSIF a.status = 'COMPLETED'
          AND NOT (
            l.state = 'DELETED'
            OR (
              l."storageBackend" IN ('OBJECT_STORE', 'LEGACY_LOCAL')
              AND l.state = 'STAGING_READY'
            )
          )
    THEN
      RAISE EXCEPTION
        'COMPLETED attempt requires DELETED or retained staging lifecycle'
        USING ERRCODE = '23514';
    ELSIF a.status IN ('ABANDONED', 'FAILED')
          AND l.state NOT IN (
            'STAGING_ABANDONED',
            'QUARANTINING',
            'QUARANTINED',
            'FAILED_RETAINED',
            'DELETED'
          )
    THEN
      RAISE EXCEPTION 'terminal attempt staging lifecycle mismatch'
        USING ERRCODE = '23514';
    END IF;

    IF a.status IN (
         'READY',
         'FINALIZING',
         'RECOVERY_REQUIRED',
         'COMPLETED'
       )
       AND l."closeAttestationId" IS NULL
       AND l."storageBackend" = 'LEGACY_LOCAL'
    THEN
      RAISE EXCEPTION 'staging attempt advanced without close attestation'
        USING ERRCODE = '23514';
    END IF;

    v_staging_intent := a."intentId";
  END IF;

  IF l."objectKind" = 'CANONICAL' THEN
    IF l."currentOperationId" IS NULL THEN
      RAISE EXCEPTION 'CANONICAL lifecycle requires current operation'
        USING ERRCODE = '23514';
    END IF;

    SELECT * INTO op
    FROM "storage_object_operation"
    WHERE id = l."currentOperationId";

    IF NOT FOUND
       OR op."objectLifecycleId" <> l.id
       OR op."storageKey" <> l."storageKey"
    THEN
      RAISE EXCEPTION 'CANONICAL current operation mismatch'
        USING ERRCODE = '23514';
    END IF;

    IF l.state = 'FINALIZING' THEN
      IF op."operationType" <> 'FINALIZE'
         OR op.state NOT IN ('PREPARED', 'EXECUTING', 'UNKNOWN')
         OR op."sourceAttemptId" IS NULL
      THEN
        RAISE EXCEPTION 'FINALIZING operation state mismatch'
          USING ERRCODE = '23514';
      END IF;
    ELSIF l.state = 'ACTIVE' THEN
      IF op."operationType" <> 'FINALIZE'
         OR op.state <> 'APPLIED'
         OR op."sourceAttemptId" IS NULL
      THEN
        RAISE EXCEPTION 'ACTIVE lifecycle requires APPLIED FINALIZE'
          USING ERRCODE = '23514';
      END IF;
    ELSIF l.state = 'QUARANTINING' THEN
      IF op."operationType" <> 'QUARANTINE'
         OR op.state NOT IN ('PREPARED', 'EXECUTING', 'UNKNOWN')
      THEN
        RAISE EXCEPTION 'QUARANTINING operation state mismatch'
          USING ERRCODE = '23514';
      END IF;
    ELSIF l.state = 'QUARANTINED' THEN
      IF op."operationType" <> 'QUARANTINE'
         OR op.state <> 'APPLIED'
      THEN
        RAISE EXCEPTION 'QUARANTINED operation state mismatch'
          USING ERRCODE = '23514';
      END IF;
    ELSIF l.state = 'RESTORING' THEN
      IF op."operationType" <> 'RESTORE'
         OR op.state NOT IN ('PREPARED', 'EXECUTING', 'UNKNOWN')
      THEN
        RAISE EXCEPTION 'RESTORING operation state mismatch'
          USING ERRCODE = '23514';
      END IF;
    ELSIF l.state = 'PURGE_PENDING' THEN
      IF op."operationType" <> 'PURGE'
         OR op.state NOT IN ('PREPARED', 'EXECUTING', 'UNKNOWN')
      THEN
        RAISE EXCEPTION 'PURGE_PENDING operation state mismatch'
          USING ERRCODE = '23514';
      END IF;
    ELSIF l.state = 'DELETED' THEN
      IF op."operationType" <> 'PURGE' OR op.state <> 'APPLIED' THEN
        RAISE EXCEPTION 'DELETED operation state mismatch'
          USING ERRCODE = '23514';
      END IF;
    ELSIF l.state = 'FAILED_RETAINED' THEN
      IF op.state NOT IN ('FAILED', 'ABANDONED') THEN
        RAISE EXCEPTION 'FAILED_RETAINED operation state mismatch'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    SELECT * INTO fv
    FROM "file_version"
    WHERE "storageKey" = l."storageKey";

    IF FOUND THEN
      v_file_version_intent := fv."uploadIntentId";
    END IF;
  END IF;

  SELECT * INTO a
  FROM "file_upload_attempt"
  WHERE "canonicalStorageKey" = l."storageKey";

  IF FOUND THEN
    v_canonical_intent := a."intentId";
  END IF;

  IF l."currentOperationId" IS NOT NULL THEN
    SELECT attempt_row."intentId"
    INTO v_operation_intent
    FROM "storage_object_operation" operation_row
    LEFT JOIN "file_upload_attempt" attempt_row
      ON attempt_row.id = operation_row."sourceAttemptId"
    WHERE operation_row.id = l."currentOperationId";
  END IF;

  IF l."objectKind" = 'CANONICAL'
     AND l.state IN ('FINALIZING', 'ACTIVE')
     AND v_operation_intent IS NULL
  THEN
    RAISE EXCEPTION 'CANONICAL upload lifecycle missing source intent'
      USING ERRCODE = '23514';
  END IF;

  SELECT count(DISTINCT intent_id)
  INTO v_distinct_count
  FROM (
    SELECT v_staging_intent AS intent_id
    WHERE v_staging_intent IS NOT NULL
    UNION ALL
    SELECT v_canonical_intent
    WHERE v_canonical_intent IS NOT NULL
    UNION ALL
    SELECT v_operation_intent
    WHERE v_operation_intent IS NOT NULL
    UNION ALL
    SELECT v_file_version_intent
    WHERE v_file_version_intent IS NOT NULL
  ) intents;

  IF v_distinct_count > 1 THEN
    RAISE EXCEPTION 'lifecycle references multiple upload intents'
      USING ERRCODE = '23514';
  END IF;

  RETURN QUERY
  SELECT v_staging_intent WHERE v_staging_intent IS NOT NULL
  UNION
  SELECT v_canonical_intent WHERE v_canonical_intent IS NOT NULL
  UNION
  SELECT v_operation_intent WHERE v_operation_intent IS NOT NULL
  UNION
  SELECT v_file_version_intent WHERE v_file_version_intent IS NOT NULL;
END;
$$;
