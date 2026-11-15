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
ALTER TABLE "file_upload_intent" ADD COLUMN     "objectStorageKey" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "file_upload_intent_objectStorageKey_key" ON "file_upload_intent"("objectStorageKey");

-- Restore composite ownership constraints removed by schema-only diff.
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

ALTER TABLE "file_upload_intent"
ADD CONSTRAINT "upload_intent_storage_keys_differ_check"
CHECK (
  "objectStorageKey" IS NULL
  OR "objectStorageKey" <> "stagingKey"
);

CREATE OR REPLACE FUNCTION "protect_upload_intent_identity"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'file_upload_intent rows cannot be deleted'
      USING ERRCODE = '42501';
  END IF;

  IF NEW."requestKey" IS DISTINCT FROM OLD."requestKey"
    OR NEW."requestFingerprint" IS DISTINCT FROM OLD."requestFingerprint"
    OR NEW."uploadedById" IS DISTINCT FROM OLD."uploadedById"
    OR NEW."projectId" IS DISTINCT FROM OLD."projectId"
    OR NEW."buildingId" IS DISTINCT FROM OLD."buildingId"
    OR NEW."installationUnitId" IS DISTINCT FROM OLD."installationUnitId"
    OR NEW."existingFileId" IS DISTINCT FROM OLD."existingFileId"
    OR NEW."displayName" IS DISTINCT FROM OLD."displayName"
    OR NEW."originalFilename" IS DISTINCT FROM OLD."originalFilename"
    OR NEW."sanitizedFilename" IS DISTINCT FROM OLD."sanitizedFilename"
    OR NEW."declaredMimeType" IS DISTINCT FROM OLD."declaredMimeType"
    OR NEW."declaredSizeBytes" IS DISTINCT FROM OLD."declaredSizeBytes"
    OR NEW."stagingKey" IS DISTINCT FROM OLD."stagingKey"
    OR NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt"
  THEN
    RAISE EXCEPTION 'file_upload_intent identity is immutable'
      USING ERRCODE = '42501';
  END IF;

  IF OLD."objectStorageKey" IS NOT NULL
    AND NEW."objectStorageKey" IS DISTINCT FROM OLD."objectStorageKey"
  THEN
    RAISE EXCEPTION 'file_upload_intent object key is immutable once set'
      USING ERRCODE = '42501';
  END IF;

  IF OLD."objectStorageKey" IS NULL
    AND NEW."objectStorageKey" IS NOT NULL
    AND OLD."status" <> 'UPLOADING'
  THEN
    RAISE EXCEPTION 'object key can only be set while upload is active'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
