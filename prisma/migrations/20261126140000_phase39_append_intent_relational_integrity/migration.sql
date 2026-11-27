-- WP-2A-CM1 R10: append-intent relational integrity.
-- Offline Migration. Web, Worker, schedulers and retry workers must be drained.
-- This file must not be applied without the R8/R9/R10 controlled validation.

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '15min';

LOCK TABLE
  "file_version",
  "file",
  "file_upload_intent"
IN ACCESS EXCLUSIVE MODE NOWAIT;

DO $$
DECLARE
  v_invalid_pair BIGINT;
  v_dangling_expected BIGINT;
  v_cross_file_expected BIGINT;
  v_uploading_current_mismatch BIGINT;
  v_completed_cross_file BIGINT;
  v_active_new_file_with_version BIGINT;
BEGIN
  SELECT count(*) INTO v_invalid_pair
  FROM "file_upload_intent" i
  WHERE NOT (
    (i."existingFileId" IS NULL
      AND i."expectedCurrentFileVersionId" IS NULL)
    OR
    (i."existingFileId" IS NOT NULL
      AND i."expectedCurrentFileVersionId" IS NOT NULL)
    OR
    (i."existingFileId" IS NOT NULL
      AND i."expectedCurrentFileVersionId" IS NULL
      AND i.status IN ('COMPLETED', 'FAILED', 'EXPIRED'))
  );

  SELECT count(*) INTO v_dangling_expected
  FROM "file_upload_intent" i
  WHERE i."expectedCurrentFileVersionId" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "file_version" fv
      WHERE fv.id = i."expectedCurrentFileVersionId"
    );

  SELECT count(*) INTO v_cross_file_expected
  FROM "file_upload_intent" i
  WHERE i."existingFileId" IS NOT NULL
    AND i."expectedCurrentFileVersionId" IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM "file_version" fv
      WHERE fv.id = i."expectedCurrentFileVersionId"
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "file_version" fv
      WHERE fv.id = i."expectedCurrentFileVersionId"
        AND fv."fileId" = i."existingFileId"
    );

  SELECT count(*) INTO v_uploading_current_mismatch
  FROM "file_upload_intent" i
  WHERE i.status = 'UPLOADING'
    AND i."existingFileId" IS NOT NULL
    AND i."expectedCurrentFileVersionId" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "file" f
      WHERE f.id = i."existingFileId"
        AND f."currentVersionId" = i."expectedCurrentFileVersionId"
    );

  SELECT count(*) INTO v_completed_cross_file
  FROM "file_upload_intent" i
  WHERE i."existingFileId" IS NOT NULL
    AND i."completedFileVersionId" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "file_version" fv
      WHERE fv.id = i."completedFileVersionId"
        AND fv."fileId" = i."existingFileId"
    );

  SELECT count(*) INTO v_active_new_file_with_version
  FROM "file_upload_intent" i
  WHERE i.status IN ('PENDING', 'UPLOADING')
    AND i."existingFileId" IS NULL
    AND i."expectedCurrentFileVersionId" IS NULL
    AND (
      i."completedFileVersionId" IS NOT NULL
      OR EXISTS (
        SELECT 1
        FROM "file_version" fv
        WHERE fv."uploadIntentId" = i.id
      )
    );

  IF v_invalid_pair > 0
     OR v_dangling_expected > 0
     OR v_cross_file_expected > 0
     OR v_uploading_current_mismatch > 0
     OR v_completed_cross_file > 0
     OR v_active_new_file_with_version > 0
  THEN
    RAISE EXCEPTION
      'append integrity precheck failed: invalid_pair=%, dangling_expected=%, cross_file_expected=%, uploading_current_mismatch=%, completed_cross_file=%, active_new_file_with_version=%',
      v_invalid_pair,
      v_dangling_expected,
      v_cross_file_expected,
      v_uploading_current_mismatch,
      v_completed_cross_file,
      v_active_new_file_with_version
      USING ERRCODE = '23514';
  END IF;
END;
$$;

ALTER TABLE "file"
  ADD COLUMN "createdByUploadIntentId" TEXT;

CREATE UNIQUE INDEX "file_createdByUploadIntentId_key"
  ON "file"("createdByUploadIntentId");

ALTER TABLE "file"
  ADD CONSTRAINT "file_createdByUploadIntentId_fkey"
  FOREIGN KEY ("createdByUploadIntentId")
  REFERENCES "file_upload_intent"("id")
  ON DELETE RESTRICT
  ON UPDATE RESTRICT;

ALTER TABLE "file_upload_intent"
  DROP CONSTRAINT "file_upload_intent_existingFileId_fkey";

ALTER TABLE "file_upload_intent"
  ADD CONSTRAINT "file_upload_intent_existingFileId_fkey"
  FOREIGN KEY ("existingFileId")
  REFERENCES "file"("id")
  ON DELETE RESTRICT
  ON UPDATE RESTRICT;

ALTER TABLE "file_upload_intent"
  DROP CONSTRAINT "file_upload_intent_expectedCurrentFileVersion_fkey";

ALTER TABLE "file_upload_intent"
  ADD CONSTRAINT
    "file_upload_intent_expectedCurrentFileVersionId_existingFileId_fkey"
  FOREIGN KEY (
    "expectedCurrentFileVersionId",
    "existingFileId"
  )
  REFERENCES "file_version"("id", "fileId")
  MATCH SIMPLE
  ON DELETE RESTRICT
  ON UPDATE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "file_upload_intent"
  ADD CONSTRAINT "upload_intent_expected_current_pair_check"
  CHECK (
    (
      "existingFileId" IS NULL
      AND "expectedCurrentFileVersionId" IS NULL
    )
    OR
    (
      "existingFileId" IS NOT NULL
      AND "expectedCurrentFileVersionId" IS NOT NULL
    )
    OR
    (
      "existingFileId" IS NOT NULL
      AND "expectedCurrentFileVersionId" IS NULL
      AND "status" IN ('COMPLETED', 'FAILED', 'EXPIRED')
    )
  );

ALTER TABLE "file_upload_intent"
  ADD CONSTRAINT
    "file_upload_intent_completed_current_same_file_fkey"
  FOREIGN KEY (
    "completedFileVersionId",
    "existingFileId"
  )
  REFERENCES "file_version"("id", "fileId")
  MATCH SIMPLE
  ON DELETE RESTRICT
  ON UPDATE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION "p13_assert_file_creation_origin"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  i "file_upload_intent"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."createdByUploadIntentId"
       IS DISTINCT FROM OLD."createdByUploadIntentId"
    THEN
      RAISE EXCEPTION 'File creation provenance is immutable'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."createdByUploadIntentId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO i
  FROM "file_upload_intent"
  WHERE id = NEW."createdByUploadIntentId"
  FOR UPDATE;

  IF NOT FOUND
     OR i.status <> 'UPLOADING'
     OR i."existingFileId" IS NOT NULL
     OR i."expectedCurrentFileVersionId" IS NOT NULL
     OR i."currentAttemptId" IS NULL
     OR i."completedFileVersionId" IS NOT NULL
     OR i."projectId" IS DISTINCT FROM NEW."projectId"
     OR i."buildingId" IS DISTINCT FROM NEW."buildingId"
     OR i."installationUnitId" IS DISTINCT FROM NEW."installationUnitId"
     OR i."uploadedById" IS DISTINCT FROM NEW."createdById"
  THEN
    RAISE EXCEPTION
      'new File creation provenance does not match an active new-file Intent'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "p13_file_creation_origin_guard"
BEFORE INSERT OR UPDATE OF "createdByUploadIntentId"
ON "file"
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_file_creation_origin"();

CREATE OR REPLACE FUNCTION "p13_assert_created_file_terminal_chain"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  f "file"%ROWTYPE;
  i "file_upload_intent"%ROWTYPE;
  fv "file_version"%ROWTYPE;
  v_intent_found BOOLEAN;
  v_version_found BOOLEAN;
  v_version_count INTEGER;
BEGIN
  SELECT * INTO f
  FROM "file"
  WHERE id = NEW.id;

  IF NOT FOUND
     OR f."createdByUploadIntentId" IS NULL
  THEN
    RETURN NULL;
  END IF;

  SELECT * INTO i
  FROM "file_upload_intent"
  WHERE id = f."createdByUploadIntentId";
  v_intent_found := FOUND;

  SELECT * INTO fv
  FROM "file_version"
  WHERE id = i."completedFileVersionId";
  v_version_found := FOUND;

  SELECT count(*) INTO v_version_count
  FROM "file_version"
  WHERE "fileId" = f.id;

  IF NOT v_intent_found
     OR NOT v_version_found
     OR i.status <> 'COMPLETED'
     OR i."existingFileId" IS NOT NULL
     OR i."expectedCurrentFileVersionId" IS NOT NULL
     OR i."completedFileVersionId" IS NULL
     OR fv."fileId" IS DISTINCT FROM f.id
     OR fv."uploadIntentId" IS DISTINCT FROM i.id
     OR f."currentVersionId"
        IS DISTINCT FROM i."completedFileVersionId"
     OR v_version_count <> 1
  THEN
    RAISE EXCEPTION
      'new File terminal provenance chain is incomplete'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "p13_created_file_terminal_guard"
AFTER INSERT ON "file"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_created_file_terminal_chain"();

CREATE OR REPLACE FUNCTION "p13_assert_append_creation_snapshot"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_version TEXT;
BEGIN
  IF NEW."existingFileId" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW."expectedCurrentFileVersionId" IS NULL THEN
    RAISE EXCEPTION 'append intent creation requires expected-current'
      USING ERRCODE = '23514';
  END IF;

  SELECT f."currentVersionId"
  INTO v_current_version
  FROM "file" f
  WHERE f.id = NEW."existingFileId"
  FOR SHARE;

  IF NOT FOUND
     OR v_current_version IS DISTINCT FROM
        NEW."expectedCurrentFileVersionId"
  THEN
    RAISE EXCEPTION
      'append creation snapshot does not match target File current version'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "p13_append_creation_snapshot_guard"
BEFORE INSERT ON "file_upload_intent"
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_append_creation_snapshot"();

CREATE OR REPLACE FUNCTION "p13_assert_append_reservation_snapshot"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_version TEXT;
BEGIN
  IF NEW.status <> 'UPLOADING'
     OR OLD.status = 'UPLOADING'
  THEN
    RETURN NEW;
  END IF;

  IF NEW."existingFileId" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW."expectedCurrentFileVersionId" IS NULL THEN
    RAISE EXCEPTION 'append reservation requires expected-current'
      USING ERRCODE = '23514';
  END IF;

  SELECT f."currentVersionId"
  INTO v_current_version
  FROM "file" f
  WHERE f.id = NEW."existingFileId"
  FOR UPDATE;

  IF NOT FOUND
     OR v_current_version IS DISTINCT FROM
        NEW."expectedCurrentFileVersionId"
  THEN
    RAISE EXCEPTION
      'append reservation expected-current is stale or missing'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "p13_append_reservation_snapshot_guard"
BEFORE UPDATE OF "status" ON "file_upload_intent"
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_append_reservation_snapshot"();

CREATE OR REPLACE FUNCTION "p13_assert_append_current_for_file"(
  p_file_id TEXT
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  f "file"%ROWTYPE;
BEGIN
  SELECT * INTO f
  FROM "file"
  WHERE id = p_file_id;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1
      FROM "file_upload_intent" i
      WHERE i."existingFileId" = p_file_id
        AND i.status = 'UPLOADING'
    )
    THEN
      RAISE EXCEPTION 'active Append target File is missing'
        USING ERRCODE = '23514';
    END IF;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "file_upload_intent" i
    WHERE i."existingFileId" = f.id
      AND i.status = 'UPLOADING'
      AND i."expectedCurrentFileVersionId"
          IS DISTINCT FROM f."currentVersionId"
  )
  THEN
    RAISE EXCEPTION
      'UPLOADING append lost its expected-current invariant'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_assert_append_current_from_file"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_id TEXT;
  v_new_id TEXT;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old_id := OLD.id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new_id := NEW.id;
  END IF;

  IF v_old_id IS NOT NULL THEN
    PERFORM "p13_assert_append_current_for_file"(v_old_id);
  END IF;
  IF v_new_id IS NOT NULL
     AND v_new_id IS DISTINCT FROM v_old_id
  THEN
    PERFORM "p13_assert_append_current_for_file"(v_new_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "p13_append_current_file_commit_guard"
AFTER INSERT OR UPDATE OR DELETE ON "file"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_append_current_from_file"();

CREATE OR REPLACE FUNCTION "p13_assert_append_current_from_intent"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_file_id TEXT;
  v_new_file_id TEXT;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old_file_id := OLD."existingFileId";
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new_file_id := NEW."existingFileId";
  END IF;

  IF v_old_file_id IS NOT NULL THEN
    PERFORM "p13_assert_append_current_for_file"(v_old_file_id);
  END IF;
  IF v_new_file_id IS NOT NULL
     AND v_new_file_id IS DISTINCT FROM v_old_file_id
  THEN
    PERFORM "p13_assert_append_current_for_file"(v_new_file_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "p13_append_current_intent_commit_guard"
AFTER INSERT OR UPDATE OR DELETE ON "file_upload_intent"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_append_current_from_intent"();

CREATE OR REPLACE FUNCTION "p13_assert_completed_append_current"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  i "file_upload_intent"%ROWTYPE;
  fv "file_version"%ROWTYPE;
  f "file"%ROWTYPE;
  v_intent_found BOOLEAN;
  v_version_found BOOLEAN;
  v_file_found BOOLEAN;
BEGIN
  IF TG_OP <> 'UPDATE'
     OR OLD.status <> 'UPLOADING'
     OR NEW.status <> 'COMPLETED'
  THEN
    RETURN NULL;
  END IF;

  SELECT * INTO i
  FROM "file_upload_intent"
  WHERE id = NEW.id;
  v_intent_found := FOUND;

  IF NOT v_intent_found OR i.status <> 'COMPLETED' THEN
    RETURN NULL;
  END IF;

  IF i."existingFileId" IS NULL THEN
    RETURN NULL;
  END IF;

  IF i."completedFileVersionId" IS NULL THEN
    RAISE EXCEPTION 'completed Append has no target FileVersion'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO fv
  FROM "file_version"
  WHERE id = i."completedFileVersionId";
  v_version_found := FOUND;

  SELECT * INTO f
  FROM "file"
  WHERE id = i."existingFileId";
  v_file_found := FOUND;

  IF NOT v_version_found
     OR NOT v_file_found
     OR fv."fileId" IS DISTINCT FROM f.id
     OR fv."uploadIntentId" IS DISTINCT FROM i.id
     OR f."currentVersionId"
        IS DISTINCT FROM i."completedFileVersionId"
  THEN
    RAISE EXCEPTION 'completed Append current pointer mismatch'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "p13_completed_append_current_guard"
AFTER UPDATE ON "file_upload_intent"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_completed_append_current"();

CREATE OR REPLACE FUNCTION "p13_protect_completed_intent_history"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'COMPLETED'
     AND (
       NEW."completedFileVersionId"
         IS DISTINCT FROM OLD."completedFileVersionId"
       OR NEW."completedAt" IS DISTINCT FROM OLD."completedAt"
       OR NEW."existingFileId" IS DISTINCT FROM OLD."existingFileId"
       OR NEW."expectedCurrentFileVersionId"
          IS DISTINCT FROM OLD."expectedCurrentFileVersionId"
     )
  THEN
    RAISE EXCEPTION 'completed upload intent history is immutable'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "p13_completed_intent_history_guard"
BEFORE UPDATE ON "file_upload_intent"
FOR EACH ROW
EXECUTE FUNCTION "p13_protect_completed_intent_history"();

CREATE OR REPLACE FUNCTION "p13_assert_file_current_latest_completed"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  f "file"%ROWTYPE;
  v_current_number INTEGER;
  v_max_number INTEGER;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."currentVersionId"
         IS NOT DISTINCT FROM NEW."currentVersionId"
  THEN
    RETURN NULL;
  END IF;

  SELECT * INTO f
  FROM "file"
  WHERE id = NEW.id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF f."currentVersionId" IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM "file_version" fv
      WHERE fv."fileId" = f.id
    )
    THEN
      RAISE EXCEPTION 'versioned File cannot have NULL current pointer'
        USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
  END IF;

  SELECT fv."versionNumber" INTO v_current_number
  FROM "file_version" fv
  WHERE fv.id = f."currentVersionId"
    AND fv."fileId" = f.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'File current pointer is not owned by File'
      USING ERRCODE = '23514';
  END IF;

  SELECT max(fv."versionNumber") INTO v_max_number
  FROM "file_version" fv
  WHERE fv."fileId" = f.id;

  IF v_current_number IS DISTINCT FROM v_max_number THEN
    RAISE EXCEPTION 'File current pointer is not the latest version'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "file_upload_intent" i
    WHERE i.status = 'COMPLETED'
      AND i."completedFileVersionId" = f."currentVersionId"
      AND (
        i."existingFileId" = f.id
        OR f."createdByUploadIntentId" = i.id
      )
  )
  THEN
    RAISE EXCEPTION 'File current pointer has no completed Intent'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "p13_file_current_latest_completed_guard"
AFTER INSERT OR UPDATE ON "file"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_file_current_latest_completed"();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename = 'file'
      AND indexname = 'file_createdByUploadIntentId_key'
  ) THEN
    RAISE EXCEPTION 'File creation provenance index postcheck failed'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'upload_intent_expected_current_pair_check'
      AND contype = 'c'
      AND convalidated
  ) THEN
    RAISE EXCEPTION 'expected-current pair CHECK postcheck failed'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'file_upload_intent_expectedCurrentFileVersionId_existingFileId_fkey'
      AND contype = 'f'
      AND confmatchtype = 's'
      AND condeferrable
      AND condeferred
  ) THEN
    RAISE EXCEPTION 'expected-current compound FK postcheck failed'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'file_upload_intent_completed_current_same_file_fkey'
      AND contype = 'f'
      AND confmatchtype = 's'
      AND condeferrable
      AND condeferred
  ) THEN
    RAISE EXCEPTION 'completed target compound FK postcheck failed'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'file_upload_intent_expectedCurrentFileVersion_fkey'
  ) THEN
    RAISE EXCEPTION 'legacy single expected-current FK still exists'
      USING ERRCODE = '23514';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_trigger
    WHERE NOT tgisinternal
      AND tgname IN (
        'p13_file_creation_origin_guard',
        'p13_created_file_terminal_guard',
        'p13_append_creation_snapshot_guard',
        'p13_append_reservation_snapshot_guard',
        'p13_append_current_file_commit_guard',
        'p13_append_current_intent_commit_guard',
        'p13_completed_append_current_guard',
        'p13_completed_intent_history_guard',
        'p13_file_current_latest_completed_guard'
      )
  ) <> 9 THEN
    RAISE EXCEPTION 'append integrity trigger postcheck failed'
      USING ERRCODE = '23514';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_trigger
    WHERE NOT tgisinternal
      AND tgname IN (
        'p13_created_file_terminal_guard',
        'p13_append_current_file_commit_guard',
        'p13_append_current_intent_commit_guard',
        'p13_completed_append_current_guard',
        'p13_file_current_latest_completed_guard'
      )
      AND tgdeferrable
      AND tginitdeferred
  ) <> 5 THEN
    RAISE EXCEPTION 'append integrity deferred trigger postcheck failed'
      USING ERRCODE = '23514';
  END IF;
END;
$$;
