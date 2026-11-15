-- DropForeignKey
ALTER TABLE "file" DROP CONSTRAINT "file_building_project_fkey";

-- DropForeignKey
ALTER TABLE "file" DROP CONSTRAINT "file_current_version_same_file_fkey";

-- DropForeignKey
ALTER TABLE "file" DROP CONSTRAINT "file_project_customer_fkey";

-- DropForeignKey
ALTER TABLE "file" DROP CONSTRAINT "file_unit_building_fkey";

-- DropForeignKey
ALTER TABLE "file_upload_intent" DROP CONSTRAINT "upload_intent_building_project_fkey";

-- DropForeignKey
ALTER TABLE "file_upload_intent" DROP CONSTRAINT "upload_intent_existing_file_project_fkey";

-- DropForeignKey
ALTER TABLE "file_upload_intent" DROP CONSTRAINT "upload_intent_unit_building_fkey";

-- AlterTable
ALTER TABLE "extraction_text_block" ADD COLUMN     "positionData" JSONB;

-- AlterTable
ALTER TABLE "file_extraction" ADD COLUMN     "outputCharacterCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pageCount" INTEGER,
ADD COLUMN     "parserVersion" VARCHAR(100),
ADD COLUMN     "providerMetadata" JSONB;

CREATE INDEX "file_extraction_status_queuedAt_idx" ON "file_extraction"("status", "queuedAt");

CREATE INDEX "file_extraction_status_startedAt_idx" ON "file_extraction"("status", "startedAt");

ALTER TABLE "file_extraction"
ADD CONSTRAINT "file_extraction_page_count_check"
CHECK ("pageCount" IS NULL OR "pageCount" > 0);

ALTER TABLE "file_extraction"
ADD CONSTRAINT "file_extraction_output_character_count_check"
CHECK ("outputCharacterCount" >= 0);

-- Restore composite constraints omitted from schema-only diff.
ALTER TABLE "file"
ADD CONSTRAINT "file_project_customer_fkey"
FOREIGN KEY ("projectId", "customerId")
REFERENCES "project"("id", "customerId")
DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "file"
ADD CONSTRAINT "file_building_project_fkey"
FOREIGN KEY ("buildingId", "projectId")
REFERENCES "building"("id", "projectId")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "file"
ADD CONSTRAINT "file_unit_building_fkey"
FOREIGN KEY ("installationUnitId", "buildingId")
REFERENCES "installation_unit"("id", "buildingId")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "file"
ADD CONSTRAINT "file_current_version_same_file_fkey"
FOREIGN KEY ("currentVersionId", "id")
REFERENCES "file_version"("id", "fileId")
DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "file_upload_intent"
ADD CONSTRAINT "upload_intent_building_project_fkey"
FOREIGN KEY ("buildingId", "projectId")
REFERENCES "building"("id", "projectId")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "file_upload_intent"
ADD CONSTRAINT "upload_intent_unit_building_fkey"
FOREIGN KEY ("installationUnitId", "buildingId")
REFERENCES "installation_unit"("id", "buildingId")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "file_upload_intent"
ADD CONSTRAINT "upload_intent_existing_file_project_fkey"
FOREIGN KEY ("existingFileId", "projectId")
REFERENCES "file"("id", "projectId")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Completed extraction metadata is immutable with the rest of the result.
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
    AND (
      NEW."extractedText" IS DISTINCT FROM OLD."extractedText"
      OR NEW."parserVersion" IS DISTINCT FROM OLD."parserVersion"
      OR NEW."providerMetadata" IS DISTINCT FROM OLD."providerMetadata"
      OR NEW."pageCount" IS DISTINCT FROM OLD."pageCount"
      OR NEW."outputCharacterCount" IS DISTINCT FROM OLD."outputCharacterCount"
      OR NEW."missingItems" IS DISTINCT FROM OLD."missingItems"
      OR NEW."safetyNotes" IS DISTINCT FROM OLD."safetyNotes"
      OR NEW."safeErrorCode" IS DISTINCT FROM OLD."safeErrorCode"
      OR NEW."safeErrorMessage" IS DISTINCT FROM OLD."safeErrorMessage"
      OR NEW."completedAt" IS DISTINCT FROM OLD."completedAt"
    )
  THEN
    RAISE EXCEPTION 'completed file_extraction results are immutable'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
