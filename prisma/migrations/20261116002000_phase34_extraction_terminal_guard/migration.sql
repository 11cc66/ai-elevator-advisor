-- A terminal extraction is an immutable historical result. Replacing content or
-- moving it back to an active state would allow an old job to rewrite history.
CREATE OR REPLACE FUNCTION "protect_file_extraction_result"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'file_extraction rows cannot be deleted'
      USING ERRCODE = '42501';
  END IF;

  IF NEW."fileVersionId" IS DISTINCT FROM OLD."fileVersionId"
    OR NEW."extractionVersion" IS DISTINCT FROM OLD."extractionVersion"
    OR NEW."provider" IS DISTINCT FROM OLD."provider"
    OR NEW."providerVersion" IS DISTINCT FROM OLD."providerVersion"
    OR NEW."dataClassification" IS DISTINCT FROM OLD."dataClassification"
  THEN
    RAISE EXCEPTION 'file_extraction identity is immutable'
      USING ERRCODE = '42501';
  END IF;

  IF OLD."status" IN ('COMPLETED', 'FAILED', 'UNSUPPORTED')
    AND NEW IS DISTINCT FROM OLD
  THEN
    RAISE EXCEPTION 'terminal file_extraction results are immutable'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
