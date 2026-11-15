-- CreateEnum
CREATE TYPE "FileUploadIntentStatus" AS ENUM ('PENDING', 'UPLOADING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- DropForeignKey
ALTER TABLE "file" DROP CONSTRAINT "file_building_project_fkey";

-- DropForeignKey
ALTER TABLE "file" DROP CONSTRAINT "file_current_version_same_file_fkey";

-- DropForeignKey
ALTER TABLE "file" DROP CONSTRAINT "file_project_customer_fkey";

-- DropForeignKey
ALTER TABLE "file" DROP CONSTRAINT "file_unit_building_fkey";

-- CreateTable
CREATE TABLE "file_upload_intent" (
    "id" TEXT NOT NULL,
    "requestKey" VARCHAR(100) NOT NULL,
    "requestFingerprint" CHAR(64) NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "buildingId" TEXT,
    "installationUnitId" TEXT,
    "existingFileId" TEXT,
    "displayName" VARCHAR(255) NOT NULL,
    "originalFilename" VARCHAR(255) NOT NULL,
    "sanitizedFilename" VARCHAR(255) NOT NULL,
    "declaredMimeType" VARCHAR(150) NOT NULL,
    "declaredSizeBytes" BIGINT NOT NULL,
    "stagingKey" VARCHAR(255) NOT NULL,
    "status" "FileUploadIntentStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "claimedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "failureCode" VARCHAR(100),
    "completedFileVersionId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "file_upload_intent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "file_upload_intent_stagingKey_key" ON "file_upload_intent"("stagingKey");

-- CreateIndex
CREATE UNIQUE INDEX "file_upload_intent_completedFileVersionId_key" ON "file_upload_intent"("completedFileVersionId");

-- CreateIndex
CREATE INDEX "file_upload_intent_projectId_status_idx" ON "file_upload_intent"("projectId", "status");

-- CreateIndex
CREATE INDEX "file_upload_intent_status_expiresAt_idx" ON "file_upload_intent"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "file_upload_intent_buildingId_idx" ON "file_upload_intent"("buildingId");

-- CreateIndex
CREATE INDEX "file_upload_intent_installationUnitId_idx" ON "file_upload_intent"("installationUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "file_upload_intent_uploadedById_requestKey_key" ON "file_upload_intent"("uploadedById", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "file_id_projectId_key" ON "file"("id", "projectId");

-- AddForeignKey
ALTER TABLE "file_upload_intent" ADD CONSTRAINT "file_upload_intent_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_upload_intent" ADD CONSTRAINT "file_upload_intent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_upload_intent" ADD CONSTRAINT "file_upload_intent_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_upload_intent" ADD CONSTRAINT "file_upload_intent_installationUnitId_fkey" FOREIGN KEY ("installationUnitId") REFERENCES "installation_unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_upload_intent" ADD CONSTRAINT "file_upload_intent_existingFileId_fkey" FOREIGN KEY ("existingFileId") REFERENCES "file"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_upload_intent" ADD CONSTRAINT "file_upload_intent_completedFileVersionId_fkey" FOREIGN KEY ("completedFileVersionId") REFERENCES "file_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restore Phase 3.1 composite constraints that Prisma cannot represent.
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

-- Upload intent ownership must follow the same project/building/unit chain.
ALTER TABLE "file_upload_intent"
ADD CONSTRAINT "upload_intent_installation_requires_building_check"
CHECK ("installationUnitId" IS NULL OR "buildingId" IS NOT NULL);

ALTER TABLE "file_upload_intent"
ADD CONSTRAINT "upload_intent_declared_size_check"
CHECK ("declaredSizeBytes" > 0 AND "declaredSizeBytes" <= 20971520);

ALTER TABLE "file_upload_intent"
ADD CONSTRAINT "upload_intent_fingerprint_format_check"
CHECK ("requestFingerprint" ~ '^[0-9A-Fa-f]{64}$');

ALTER TABLE "file_upload_intent"
ADD CONSTRAINT "upload_intent_request_key_not_empty_check"
CHECK (length("requestKey") > 0 AND length("stagingKey") > 0);

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

-- An upload intent's identity and target cannot be changed after creation.
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

  RETURN NEW;
END;
$$;

CREATE TRIGGER "file_upload_intent_identity_guard"
BEFORE UPDATE OR DELETE ON "file_upload_intent"
FOR EACH ROW
EXECUTE FUNCTION "protect_upload_intent_identity"();

-- A completed intent must reference a version under its intended ownership.
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
BEGIN
  IF NEW."completedFileVersionId" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW."status" <> 'COMPLETED' THEN
    RAISE EXCEPTION 'completed version requires COMPLETED intent status'
      USING ERRCODE = '23514';
  END IF;

  SELECT
    fv."fileId",
    f."customerId",
    f."projectId",
    f."buildingId",
    f."installationUnitId"
  INTO
    completed_file_id,
    completed_customer_id,
    completed_project_id,
    completed_building_id,
    completed_unit_id
  FROM "file_version" fv
  JOIN "file" f ON f."id" = fv."fileId"
  WHERE fv."id" = NEW."completedFileVersionId";

  IF completed_file_id IS NULL
    OR completed_project_id IS DISTINCT FROM NEW."projectId"
    OR completed_building_id IS DISTINCT FROM NEW."buildingId"
    OR completed_unit_id IS DISTINCT FROM NEW."installationUnitId"
    OR (
      NEW."existingFileId" IS NOT NULL
      AND completed_file_id IS DISTINCT FROM NEW."existingFileId"
    )
  THEN
    RAISE EXCEPTION 'upload intent completion ownership mismatch'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "file_upload_intent_completion_guard"
BEFORE UPDATE ON "file_upload_intent"
FOR EACH ROW
EXECUTE FUNCTION "validate_upload_intent_completion"();
