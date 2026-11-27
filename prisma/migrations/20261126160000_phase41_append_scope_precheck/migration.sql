-- WP-2A-CM1 R16: precheck historical Append File scope.
-- This is a precheck-only forward migration. It deliberately performs no DDL.
-- Offline execution: Web, Worker, schedulers and retry workers must be drained.

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
    SELECT 'append_target_missing'::text AS category, i.id::text AS object_id
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

    SELECT 'append_expected_not_before_target', i.id
    FROM "file_upload_intent" i
    JOIN "file_version" expected
      ON expected.id = i."expectedCurrentFileVersionId"
    JOIN "file_version" completed
      ON completed.id = i."completedFileVersionId"
    WHERE i."existingFileId" IS NOT NULL
      AND i."expectedCurrentFileVersionId" IS NOT NULL
      AND i."completedFileVersionId" IS NOT NULL
      AND expected."fileId" = i."existingFileId"
      AND completed."fileId" = i."existingFileId"
      AND expected."versionNumber" >= completed."versionNumber"

    UNION ALL

    SELECT 'legacy_append_unverified', i.id
    FROM "file_upload_intent" i
    JOIN "file" f
      ON f.id = i."existingFileId"
    WHERE i."existingFileId" IS NOT NULL
      AND f."createdByUploadIntentId" IS NULL
  ),
  classified AS (
    SELECT category, object_id, 'intent'::text AS record_kind
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
       WHERE category <> 'legacy_append_unverified')::BIGINT,
      0::BIGINT
    ),
    coalesce(
      (SELECT count(DISTINCT record_kind || ':' || object_id)
       FROM classified
       WHERE category <> 'legacy_append_unverified')::BIGINT,
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
      'phase41 Append scope precheck failed: categoryCount=%, uniqueUnsafeRecords=%, details=%',
      v_category_count,
      v_unique_unsafe_count,
      v_details
      USING ERRCODE = '23514';
  END IF;

  IF v_details ? 'legacy_append_unverified' THEN
    RAISE NOTICE
      'phase41 legacy append inventory: %',
      v_details -> 'legacy_append_unverified';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class r ON r.oid = t.tgrelid
    WHERE NOT t.tgisinternal
      AND t.tgname = 'p13_completed_intent_final_guard'
      AND r.relname = 'file_upload_intent'
      AND t.tgenabled <> 'D'
      AND t.tgdeferrable
      AND t.tginitdeferred
  ) THEN
    RAISE EXCEPTION 'phase41 completion guard postcheck failed'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class r ON r.oid = t.tgrelid
    WHERE NOT t.tgisinternal
      AND t.tgname = 'p13_file_provenance_scope_immutable'
      AND r.relname = 'file'
      AND t.tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'phase41 File provenance trigger postcheck failed'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    WHERE NOT t.tgisinternal
      AND t.tgname = 'p13_completed_append_current_guard'
  ) THEN
    RAISE EXCEPTION 'phase41 legacy completion trigger still exists'
      USING ERRCODE = '23514';
  END IF;
END;
$$;
