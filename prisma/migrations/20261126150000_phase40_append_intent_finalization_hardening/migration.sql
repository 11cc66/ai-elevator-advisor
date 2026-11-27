-- WP-2A-CM1 R14: unify completion provenance, fail closed on
-- legacy-unverified Files and freeze File business identity.
-- Offline Migration: Web, Worker, schedulers and retry workers must be drained.
-- This Migration must not be applied without controlled PostgreSQL validation.

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '15min';

LOCK TABLE
  "project",
  "file_version",
  "file",
  "file_upload_intent"
IN ACCESS EXCLUSIVE MODE NOWAIT;

DO $$
DECLARE
  v_category_count BIGINT;
  v_unique_unsafe_count BIGINT;
  v_details JSONB;
BEGIN
  WITH conflicts AS (
    SELECT 'invalid_pair'::text AS category, i.id::text AS object_id
    FROM "file_upload_intent" i
    WHERE NOT (
      (
        i."existingFileId" IS NULL
        AND i."expectedCurrentFileVersionId" IS NULL
      )
      OR
      (
        i."existingFileId" IS NOT NULL
        AND i."expectedCurrentFileVersionId" IS NOT NULL
      )
      OR
      (
        i."existingFileId" IS NOT NULL
        AND i."expectedCurrentFileVersionId" IS NULL
        AND i.status IN ('COMPLETED', 'FAILED', 'EXPIRED')
      )
    )

    UNION ALL

    SELECT 'dangling_expected', i.id
    FROM "file_upload_intent" i
    WHERE i."expectedCurrentFileVersionId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "file_version" fv
        WHERE fv.id = i."expectedCurrentFileVersionId"
      )

    UNION ALL

    SELECT 'cross_file_expected', i.id
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
      )

    UNION ALL

    SELECT 'uploading_current_mismatch', i.id
    FROM "file_upload_intent" i
    WHERE i.status = 'UPLOADING'
      AND i."existingFileId" IS NOT NULL
      AND i."expectedCurrentFileVersionId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "file" f
        WHERE f.id = i."existingFileId"
          AND f."currentVersionId" = i."expectedCurrentFileVersionId"
      )

    UNION ALL

    SELECT 'completed_target_missing_or_wrong_intent', i.id
    FROM "file_upload_intent" i
    LEFT JOIN "file_version" fv
      ON fv.id = i."completedFileVersionId"
    WHERE i.status = 'COMPLETED'
      AND (
        i."completedFileVersionId" IS NULL
        OR fv.id IS NULL
        OR fv."uploadIntentId" IS DISTINCT FROM i.id
      )

    UNION ALL

    SELECT 'append_completed_target_wrong_file', i.id
    FROM "file_upload_intent" i
    JOIN "file_version" fv
      ON fv.id = i."completedFileVersionId"
    WHERE i.status = 'COMPLETED'
      AND i."existingFileId" IS NOT NULL
      AND fv."fileId" IS DISTINCT FROM i."existingFileId"

    UNION ALL

    SELECT 'append_expected_not_before_target', i.id
    FROM "file_upload_intent" i
    JOIN "file_version" expected
      ON expected.id = i."expectedCurrentFileVersionId"
    JOIN "file_version" completed
      ON completed.id = i."completedFileVersionId"
    WHERE i.status = 'COMPLETED'
      AND i."existingFileId" IS NOT NULL
      AND expected."fileId" = i."existingFileId"
      AND completed."fileId" = i."existingFileId"
      AND expected."versionNumber" >= completed."versionNumber"

    UNION ALL

    SELECT 'append_target_missing', i.id
    FROM "file_upload_intent" i
    WHERE i."existingFileId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "file" f
        WHERE f.id = i."existingFileId"
      )

    UNION ALL

    SELECT 'append_building_scope_mismatch', i.id
    FROM "file_upload_intent" i
    JOIN "file" f
      ON f.id = i."existingFileId"
    WHERE i."existingFileId" IS NOT NULL
      AND i."buildingId" IS DISTINCT FROM f."buildingId"
      AND i."installationUnitId"
        IS NOT DISTINCT FROM f."installationUnitId"

    UNION ALL

    SELECT 'append_installation_unit_scope_mismatch', i.id
    FROM "file_upload_intent" i
    JOIN "file" f
      ON f.id = i."existingFileId"
    WHERE i."existingFileId" IS NOT NULL
      AND i."buildingId" IS NOT DISTINCT FROM f."buildingId"
      AND i."installationUnitId"
        IS DISTINCT FROM f."installationUnitId"

    UNION ALL

    SELECT 'append_scope_combination_mismatch', i.id
    FROM "file_upload_intent" i
    JOIN "file" f
      ON f.id = i."existingFileId"
    WHERE i."existingFileId" IS NOT NULL
      AND i."buildingId" IS DISTINCT FROM f."buildingId"
      AND i."installationUnitId"
        IS DISTINCT FROM f."installationUnitId"

    UNION ALL

    SELECT 'append_expected_current_wrong_file', i.id
    FROM "file_upload_intent" i
    JOIN "file_version" expected
      ON expected.id = i."expectedCurrentFileVersionId"
    WHERE i."existingFileId" IS NOT NULL
      AND i."expectedCurrentFileVersionId" IS NOT NULL
      AND expected."fileId" IS DISTINCT FROM i."existingFileId"

    UNION ALL

    SELECT 'new_file_origin_conflict', i.id
    FROM "file_upload_intent" i
    JOIN "file_version" fv
      ON fv.id = i."completedFileVersionId"
    JOIN "file" f
      ON f.id = fv."fileId"
    WHERE i.status = 'COMPLETED'
      AND i."existingFileId" IS NULL
      AND f."createdByUploadIntentId" IS NOT NULL
      AND f."createdByUploadIntentId" IS DISTINCT FROM i.id

    UNION ALL

    SELECT 'new_file_target_not_origin', i.id
    FROM "file_upload_intent" i
    JOIN "file_version" fv
      ON fv.id = i."completedFileVersionId"
    JOIN "file" target_file
      ON target_file.id = fv."fileId"
    WHERE i.status = 'COMPLETED'
      AND i."existingFileId" IS NULL
      AND EXISTS (
        SELECT 1
        FROM "file" origin_file
        WHERE origin_file."createdByUploadIntentId" = i.id
          AND origin_file.id <> target_file.id
      )

    UNION ALL

    SELECT 'origin_scope_mismatch', f.id
    FROM "file" f
    JOIN "file_upload_intent" origin_intent
      ON origin_intent.id = f."createdByUploadIntentId"
    JOIN "project" project
      ON project.id = origin_intent."projectId"
    WHERE origin_intent."existingFileId" IS NOT NULL
      OR origin_intent."expectedCurrentFileVersionId" IS NOT NULL
      OR origin_intent.status <> 'COMPLETED'
      OR f."customerId" IS DISTINCT FROM project."customerId"
      OR f."projectId" IS DISTINCT FROM origin_intent."projectId"
      OR f."buildingId" IS DISTINCT FROM origin_intent."buildingId"
      OR f."installationUnitId"
        IS DISTINCT FROM origin_intent."installationUnitId"
      OR f."createdById" IS DISTINCT FROM origin_intent."uploadedById"

    UNION ALL

    SELECT 'versioned_file_null_current', f.id
    FROM "file" f
    WHERE f."currentVersionId" IS NULL
      AND EXISTS (
        SELECT 1
        FROM "file_version" fv
        WHERE fv."fileId" = f.id
      )

    UNION ALL

    SELECT 'file_current_not_max', f.id
    FROM "file" f
    WHERE f."currentVersionId" IS NOT NULL
      AND (
        NOT EXISTS (
          SELECT 1
          FROM "file_version" current_version
          WHERE current_version.id = f."currentVersionId"
            AND current_version."fileId" = f.id
        )
        OR EXISTS (
          SELECT 1
          FROM "file_version" newer
          WHERE newer."fileId" = f.id
            AND newer."versionNumber" > (
              SELECT current_version."versionNumber"
              FROM "file_version" current_version
              WHERE current_version.id = f."currentVersionId"
                AND current_version."fileId" = f.id
            )
        )
      )

    UNION ALL

    SELECT 'file_current_unowned', f.id
    FROM "file" f
    WHERE f."currentVersionId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "file_upload_intent" i
        WHERE i.status = 'COMPLETED'
          AND i."completedFileVersionId" = f."currentVersionId"
          AND (
            i."existingFileId" = f.id
            OR f."createdByUploadIntentId" = i.id
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM "file_upload_intent" legacy_i
        WHERE legacy_i.status = 'COMPLETED'
          AND legacy_i."completedFileVersionId" = f."currentVersionId"
          AND legacy_i."existingFileId" IS NULL
      )

    UNION ALL

    SELECT 'active_append_legacy_origin', i.id
    FROM "file_upload_intent" i
    JOIN "file" f
      ON f.id = i."existingFileId"
    WHERE i.status IN ('PENDING', 'UPLOADING')
      AND f."createdByUploadIntentId" IS NULL

    UNION ALL

    SELECT 'legacy_unverified', i.id
    FROM "file_upload_intent" i
    JOIN "file_version" fv
      ON fv.id = i."completedFileVersionId"
    JOIN "file" f
      ON f.id = fv."fileId"
    WHERE i.status = 'COMPLETED'
      AND i."existingFileId" IS NULL
      AND f."createdByUploadIntentId" IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "file" origin_file
        WHERE origin_file."createdByUploadIntentId" = i.id
      )

    UNION ALL

    SELECT 'legacy_append_unverified', i.id
    FROM "file_upload_intent" i
    JOIN "file" f
      ON f.id = i."existingFileId"
    WHERE i."existingFileId" IS NOT NULL
      AND f."createdByUploadIntentId" IS NULL
  ),
  classified AS (
    SELECT
      category,
      object_id,
      CASE
        WHEN category IN (
          'origin_scope_mismatch',
          'versioned_file_null_current',
          'file_current_not_max',
          'file_current_unowned'
        ) THEN 'file'
        ELSE 'intent'
      END AS record_kind
    FROM conflicts
  ),
  ranked AS (
    SELECT
      category,
      object_id,
      record_kind,
      row_number() OVER (
        PARTITION BY category
        ORDER BY object_id
      ) AS row_number
    FROM classified
  ),
  grouped AS (
    SELECT
      category,
      count(*)::BIGINT AS row_count,
      array_agg(object_id ORDER BY object_id)
        FILTER (WHERE row_number <= 20) AS sample_ids
    FROM ranked
    GROUP BY category
  )
  SELECT
    coalesce(
      (SELECT sum(row_count)
       FROM grouped
       WHERE category NOT IN (
         'legacy_unverified',
         'legacy_append_unverified'
       ))::BIGINT,
      0::BIGINT
    ),
    coalesce(
      (SELECT count(DISTINCT record_kind || ':' || object_id)
       FROM classified
       WHERE category NOT IN (
         'legacy_unverified',
         'legacy_append_unverified'
       ))::BIGINT,
      0::BIGINT
    ),
    coalesce(
      jsonb_object_agg(
        category,
        jsonb_build_object(
          'count', row_count,
          'sampleIds', to_jsonb(sample_ids)
        )
      ),
      '{}'::jsonb
    )
  INTO v_category_count, v_unique_unsafe_count, v_details
  FROM grouped;

  IF v_unique_unsafe_count > 0 THEN
    RAISE EXCEPTION
      'phase40 append finalization precheck failed: categoryCount=%, uniqueUnsafeRecords=%, details=%',
      v_category_count,
      v_unique_unsafe_count,
      v_details
      USING ERRCODE = '23514';
  END IF;

  IF v_details ? 'legacy_unverified'
     OR v_details ? 'legacy_append_unverified'
  THEN
    RAISE NOTICE
      'phase40 legacy-unverified inventory: %',
      v_details;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION "validate_upload_intent_completion"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  completed_file_id TEXT;
  completed_customer_id TEXT;
  completed_project_id TEXT;
  completed_building_id TEXT;
  completed_unit_id TEXT;
  completed_created_by_id TEXT;
  completed_origin_intent_id TEXT;
  completed_upload_intent_id TEXT;
  project_customer_id TEXT;
BEGIN
  IF NEW."completedFileVersionId" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'completed version requires COMPLETED intent status'
      USING ERRCODE = '23514';
  END IF;

  SELECT
    fv."fileId",
    f."customerId",
    f."projectId",
    f."buildingId",
    f."installationUnitId",
    f."createdById",
    f."createdByUploadIntentId",
    fv."uploadIntentId",
    project."customerId"
  INTO
    completed_file_id,
    completed_customer_id,
    completed_project_id,
    completed_building_id,
    completed_unit_id,
    completed_created_by_id,
    completed_origin_intent_id,
    completed_upload_intent_id,
    project_customer_id
  FROM "file_version" fv
  JOIN "file" f
    ON f.id = fv."fileId"
  JOIN "project" project
    ON project.id = f."projectId"
  WHERE fv.id = NEW."completedFileVersionId";

  IF completed_file_id IS NULL
     OR completed_upload_intent_id IS DISTINCT FROM NEW.id
     OR completed_customer_id IS DISTINCT FROM project_customer_id
     OR completed_project_id IS DISTINCT FROM NEW."projectId"
     OR completed_building_id IS DISTINCT FROM NEW."buildingId"
     OR completed_unit_id IS DISTINCT FROM NEW."installationUnitId"
     OR (
       NEW."existingFileId" IS NOT NULL
       AND completed_file_id IS DISTINCT FROM NEW."existingFileId"
     )
     OR (
       NEW."existingFileId" IS NULL
       AND (
         NEW."expectedCurrentFileVersionId" IS NOT NULL
         OR completed_origin_intent_id IS DISTINCT FROM NEW.id
         OR completed_created_by_id IS DISTINCT FROM NEW."uploadedById"
       )
     )
  THEN
    RAISE EXCEPTION 'upload intent completion provenance mismatch'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_assert_append_creation_snapshot"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_version TEXT;
  v_origin_intent_id TEXT;
BEGIN
  IF NEW."existingFileId" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW."expectedCurrentFileVersionId" IS NULL THEN
    RAISE EXCEPTION 'append intent creation requires expected-current'
      USING ERRCODE = '23514';
  END IF;

  SELECT
    f."currentVersionId",
    f."createdByUploadIntentId"
  INTO
    v_current_version,
    v_origin_intent_id
  FROM "file" f
  WHERE f.id = NEW."existingFileId"
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'append creation snapshot target File is missing'
      USING ERRCODE = '23514';
  END IF;

  IF v_origin_intent_id IS NULL THEN
    RAISE EXCEPTION
      'legacy-unverified File cannot become a new Append target'
      USING ERRCODE = '42501';
  END IF;

  IF v_current_version IS DISTINCT FROM
     NEW."expectedCurrentFileVersionId"
  THEN
    RAISE EXCEPTION
      'append creation snapshot does not match target File current version'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_assert_completed_intent_final"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  i "file_upload_intent"%ROWTYPE;
  fv "file_version"%ROWTYPE;
  expected "file_version"%ROWTYPE;
  f "file"%ROWTYPE;
  v_expected_found BOOLEAN;
  v_max_version_number INTEGER;
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

  IF NOT FOUND OR i.status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'completed Intent final row is missing or non-terminal'
      USING ERRCODE = '23514';
  END IF;

  IF i."completedFileVersionId" IS NULL THEN
    RAISE EXCEPTION 'completed Intent has no target FileVersion'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO fv
  FROM "file_version"
  WHERE id = i."completedFileVersionId";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'completed Intent target FileVersion is missing'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO f
  FROM "file"
  WHERE id = fv."fileId";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'completed Intent target File is missing'
      USING ERRCODE = '23514';
  END IF;

  IF fv."uploadIntentId" IS DISTINCT FROM i.id THEN
    RAISE EXCEPTION 'completed Intent target belongs to another Intent'
      USING ERRCODE = '23514';
  END IF;

  IF i."existingFileId" IS NULL THEN
    IF i."expectedCurrentFileVersionId" IS NOT NULL
       OR f."createdByUploadIntentId" IS DISTINCT FROM i.id
    THEN
      RAISE EXCEPTION 'completed new-file Intent provenance mismatch'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    IF f.id IS DISTINCT FROM i."existingFileId"
       OR i."expectedCurrentFileVersionId" IS NULL
    THEN
      RAISE EXCEPTION 'completed Append target File mismatch'
        USING ERRCODE = '23514';
    END IF;

    SELECT * INTO expected
    FROM "file_version"
    WHERE id = i."expectedCurrentFileVersionId";
    v_expected_found := FOUND;

    IF NOT v_expected_found
       OR expected."fileId" IS DISTINCT FROM f.id
       OR expected."versionNumber" >= fv."versionNumber"
    THEN
      RAISE EXCEPTION 'completed Append expected-current mismatch'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT max(file_version."versionNumber")
  INTO v_max_version_number
  FROM "file_version"
  WHERE file_version."fileId" = f.id;

  IF f."currentVersionId" IS DISTINCT FROM fv.id
     OR fv."versionNumber" IS DISTINCT FROM v_max_version_number
  THEN
    RAISE EXCEPTION 'completed Intent current pointer mismatch'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS "p13_completed_append_current_guard"
ON "file_upload_intent";

DROP FUNCTION IF EXISTS "p13_assert_completed_append_current"();

CREATE CONSTRAINT TRIGGER "p13_completed_intent_final_guard"
AFTER UPDATE ON "file_upload_intent"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_completed_intent_final"();

CREATE OR REPLACE FUNCTION "p13_protect_file_provenance_scope"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."customerId" IS DISTINCT FROM OLD."customerId"
     OR NEW."projectId" IS DISTINCT FROM OLD."projectId"
     OR NEW."buildingId" IS DISTINCT FROM OLD."buildingId"
     OR NEW."installationUnitId"
        IS DISTINCT FROM OLD."installationUnitId"
     OR NEW."createdById" IS DISTINCT FROM OLD."createdById"
     OR NEW."createdByUploadIntentId"
        IS DISTINCT FROM OLD."createdByUploadIntentId"
  THEN
    RAISE EXCEPTION 'File provenance scope is immutable'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "p13_file_provenance_scope_immutable"
ON "file";

CREATE TRIGGER "p13_file_provenance_scope_immutable"
BEFORE UPDATE OF
  "customerId",
  "projectId",
  "buildingId",
  "installationUnitId",
  "createdById",
  "createdByUploadIntentId"
ON "file"
FOR EACH ROW
EXECUTE FUNCTION "p13_protect_file_provenance_scope"();

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

  IF f."createdByUploadIntentId" IS NULL
     AND (
       f."currentVersionId" IS NOT NULL
       OR EXISTS (
         SELECT 1
         FROM "file_version" fv
         WHERE fv."fileId" = f.id
       )
     )
  THEN
    RAISE EXCEPTION
      'legacy-unverified File current pointer cannot change'
      USING ERRCODE = '42501';
  END IF;

  IF f."currentVersionId" IS NULL THEN
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

DO $$
DECLARE
  v_file_scope_trigger "pg_trigger"%ROWTYPE;
  v_completion_trigger "pg_trigger"%ROWTYPE;
BEGIN
  SELECT t.*
  INTO v_completion_trigger
  FROM pg_trigger t
  JOIN pg_class relation
    ON relation.oid = t.tgrelid
  WHERE NOT t.tgisinternal
    AND t.tgname = 'p13_completed_intent_final_guard'
    AND relation.relname = 'file_upload_intent'
    AND t.tgenabled <> 'D'
    AND t.tgdeferrable
    AND t.tginitdeferred
    AND (t.tgtype & 17) = 17;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unified completion trigger postcheck failed'
      USING ERRCODE = '23514';
  END IF;

  SELECT t.*
  INTO v_file_scope_trigger
  FROM pg_trigger t
  JOIN pg_class relation
    ON relation.oid = t.tgrelid
  WHERE NOT t.tgisinternal
    AND t.tgname = 'p13_file_provenance_scope_immutable'
    AND relation.relname = 'file'
    AND t.tgenabled <> 'D'
    AND (t.tgtype & 19) = 19;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'File provenance scope trigger postcheck failed'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    WHERE NOT t.tgisinternal
      AND t.tgname = 'p13_completed_append_current_guard'
  ) THEN
    RAISE EXCEPTION 'legacy Append completion trigger still exists'
      USING ERRCODE = '23514';
  END IF;

  IF to_regprocedure(
    'p13_assert_completed_append_current()'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'legacy Append completion function still exists'
      USING ERRCODE = '23514';
  END IF;

  IF to_regprocedure(
    'validate_upload_intent_completion()'
  ) IS NULL
     OR to_regprocedure(
       'p13_assert_append_creation_snapshot()'
     ) IS NULL
     OR to_regprocedure(
       'p13_assert_file_current_latest_completed()'
     ) IS NULL
     OR to_regprocedure(
       'p13_assert_completed_intent_final()'
     ) IS NULL
     OR to_regprocedure(
       'p13_protect_file_provenance_scope()'
     ) IS NULL
  THEN
    RAISE EXCEPTION 'phase40 trigger function postcheck failed'
      USING ERRCODE = '23514';
  END IF;
END;
$$;
