-- Field configuration must remain internally consistent. These constraints
-- intentionally use NOT VALID so historical rows are preserved for explicit
-- review instead of being rewritten by the migration.
ALTER TABLE "extraction_field"
ADD CONSTRAINT "extraction_field_review_configuration_check"
CHECK (
  (
    "fieldClassification" = 'PROFESSIONAL'
    AND "customerConfirmable" = false
    AND "requiresProfessionalReview" = true
  )
  OR (
    "fieldClassification" = 'ORDINARY'
    AND NOT (
      "customerConfirmable" = true
      AND "requiresProfessionalReview" = true
    )
  )
)
NOT VALID;

ALTER TABLE "extraction_field_review"
ADD CONSTRAINT "extraction_field_review_payload_check"
CHECK (
  (
    "action" = 'CORRECT'
    AND "correctedRawValue" IS NOT NULL
  )
  OR (
    "action" IN ('CONFIRM', 'REJECT')
    AND "correctedRawValue" IS NULL
    AND "correctedNormalizedValue" IS NULL
  )
)
NOT VALID;

-- COALESCE is required because CHECK constraints treat SQL NULL as passing.
-- This rejects JSON null, missing keys, scalar snapshots and malformed roles.
ALTER TABLE "extraction_field_review"
ADD CONSTRAINT "extraction_field_review_actor_snapshot_check"
CHECK (
  COALESCE(
    jsonb_typeof("actorRoleSnapshot") = 'object'
    AND jsonb_typeof("actorRoleSnapshot"->'roleCodes') = 'array'
    AND "actorRoleSnapshot"->'roleCodes' = '["CUSTOMER"]'::jsonb
    AND jsonb_typeof("actorRoleSnapshot"->'scope') = 'string'
    AND "actorRoleSnapshot"->>'scope' = 'PROJECT'
    AND jsonb_typeof("actorRoleSnapshot"->'projectId') = 'string'
    AND btrim("actorRoleSnapshot"->>'projectId') <> '',
    false
  )
)
NOT VALID;

-- Replace the existing guard function in place. The existing
-- field_review_status_guard trigger continues to call this function.
CREATE OR REPLACE FUNCTION "enforce_field_review_status"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  field_classification "ExtractionFieldClassification";
  field_initial_status "ExtractionFieldStatus";
  field_customer_confirmable boolean;
  field_requires_professional_review boolean;
  field_original_value jsonb;
  extraction_status "ExtractionStatus";
  actual_project_id text;
  current_status "ExtractionFieldStatus";
  expected_next_sequence integer;
  expected_snapshot jsonb;
BEGIN
  SELECT
    field_record."fieldClassification",
    field_record."initialStatus",
    field_record."customerConfirmable",
    field_record."requiresProfessionalReview",
    field_record."originalRawValue",
    extraction_record."status",
    file_record."projectId"
  INTO
    field_classification,
    field_initial_status,
    field_customer_confirmable,
    field_requires_professional_review,
    field_original_value,
    extraction_status,
    actual_project_id
  FROM "extraction_field" AS field_record
  INNER JOIN "file_extraction" AS extraction_record
    ON extraction_record."id" = field_record."extractionId"
  INNER JOIN "file_version" AS version_record
    ON version_record."id" = extraction_record."fileVersionId"
  INNER JOIN "file" AS file_record
    ON file_record."id" = version_record."fileId"
  WHERE field_record."id" = NEW."extractionFieldId"
  FOR UPDATE OF field_record;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'extraction field does not exist'
      USING ERRCODE = '23503';
  END IF;

  IF extraction_status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'field review requires a completed extraction'
      USING ERRCODE = '23514';
  END IF;

  IF field_classification = 'PROFESSIONAL' THEN
    IF field_customer_confirmable IS DISTINCT FROM false
      OR field_requires_professional_review IS DISTINCT FROM true
    THEN
      RAISE EXCEPTION 'professional field configuration is invalid'
        USING ERRCODE = '42501';
    END IF;
  ELSIF field_classification = 'ORDINARY' THEN
    IF field_customer_confirmable IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'ordinary field is not customer confirmable'
        USING ERRCODE = '42501';
    END IF;

    IF field_requires_professional_review IS DISTINCT FROM false THEN
      RAISE EXCEPTION 'ordinary field configuration is invalid'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'unknown field classification'
      USING ERRCODE = '42501';
  END IF;

  IF NEW."originalValueSnapshot"
    IS DISTINCT FROM field_original_value
  THEN
    RAISE EXCEPTION 'original value snapshot does not match extraction field'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."action" = 'CORRECT' THEN
    IF NEW."correctedRawValue" IS NULL THEN
      RAISE EXCEPTION 'correction requires corrected raw value'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."correctedRawValue" IS NOT NULL
    OR NEW."correctedNormalizedValue" IS NOT NULL
  THEN
    RAISE EXCEPTION 'only correction may include corrected values'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "user_role" AS assignment_record
    INNER JOIN "role" AS role_record
      ON role_record."id" = assignment_record."roleId"
    WHERE assignment_record."userId" = NEW."actorUserId"
      AND assignment_record."scope" = 'PROJECT'
      AND assignment_record."projectId" = actual_project_id
      AND role_record."code" = 'CUSTOMER'
  ) THEN
    RAISE EXCEPTION 'actor does not have CUSTOMER role for field project'
      USING ERRCODE = '42501';
  END IF;

  expected_snapshot := jsonb_build_object(
    'roleCodes', jsonb_build_array('CUSTOMER'),
    'scope', 'PROJECT',
    'projectId', actual_project_id
  );

  IF NEW."actorRoleSnapshot" IS DISTINCT FROM expected_snapshot THEN
    RAISE EXCEPTION 'actor role snapshot does not match field project'
      USING ERRCODE = '42501';
  END IF;

  SELECT review_record."statusAfterReview"
  INTO current_status
  FROM "extraction_field_review" AS review_record
  WHERE review_record."extractionFieldId" = NEW."extractionFieldId"
  ORDER BY review_record."reviewSequence" DESC
  LIMIT 1;

  IF NOT FOUND THEN
    current_status := field_initial_status;
  END IF;

  IF current_status = 'INVALIDATED' THEN
    RAISE EXCEPTION 'invalidated field cannot be reactivated'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(MAX(review_record."reviewSequence"), 0) + 1
  INTO expected_next_sequence
  FROM "extraction_field_review" AS review_record
  WHERE review_record."extractionFieldId" = NEW."extractionFieldId";

  IF NEW."reviewSequence" <> expected_next_sequence THEN
    RAISE EXCEPTION 'review sequence must be continuous'
      USING ERRCODE = '23514';
  END IF;

  IF field_classification = 'PROFESSIONAL' THEN
    IF current_status <> 'PENDING_VERIFICATION' THEN
      RAISE EXCEPTION 'professional field is not pending verification'
        USING ERRCODE = '42501';
    END IF;

    IF NEW."action" <> 'CORRECT' THEN
      RAISE EXCEPTION 'professional field only accepts correction suggestions'
        USING ERRCODE = '42501';
    END IF;

    IF NEW."statusAfterReview" <> 'PENDING_VERIFICATION' THEN
      RAISE EXCEPTION 'professional field must remain pending verification'
        USING ERRCODE = '42501';
    END IF;
  ELSIF field_classification = 'ORDINARY' THEN
    IF current_status NOT IN (
      'EXTRACTED',
      'CUSTOMER_CONFIRMED',
      'CUSTOMER_REJECTED'
    ) THEN
      RAISE EXCEPTION 'ordinary field current state cannot be reviewed'
        USING ERRCODE = '42501';
    END IF;

    IF NEW."action" = 'REJECT' THEN
      IF current_status = 'CUSTOMER_REJECTED' THEN
        RAISE EXCEPTION 'repeated rejection does not change field state'
          USING ERRCODE = '23514';
      END IF;

      IF NEW."statusAfterReview" <> 'CUSTOMER_REJECTED' THEN
        RAISE EXCEPTION 'ordinary rejection must use CUSTOMER_REJECTED'
          USING ERRCODE = '23514';
      END IF;
    ELSIF NEW."action" IN ('CONFIRM', 'CORRECT') THEN
      IF current_status = 'CUSTOMER_CONFIRMED'
        AND NEW."action" = 'CONFIRM'
      THEN
        RAISE EXCEPTION 'repeated confirmation does not change field state'
          USING ERRCODE = '23514';
      END IF;

      IF NEW."statusAfterReview" <> 'CUSTOMER_CONFIRMED' THEN
        RAISE EXCEPTION 'ordinary confirmation must use CUSTOMER_CONFIRMED'
          USING ERRCODE = '23514';
      END IF;
    ELSE
      RAISE EXCEPTION 'unknown field review action'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'unknown field classification'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
