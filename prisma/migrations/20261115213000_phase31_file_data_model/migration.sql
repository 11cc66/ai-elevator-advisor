-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FileVersionUploadStatus" AS ENUM ('PENDING', 'UPLOADED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FileValidationStatus" AS ENUM ('PENDING', 'PASSED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "MalwareScanStatus" AS ENUM ('SCAN_UNAVAILABLE', 'PENDING', 'CLEAN', 'INFECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "FileIntegrityStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "FileRecognitionStatus" AS ENUM ('NOT_REQUESTED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'UNSUPPORTED');

-- CreateEnum
CREATE TYPE "ExtractionFieldClassification" AS ENUM ('ORDINARY', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "ExtractionFieldStatus" AS ENUM ('EXTRACTED', 'CUSTOMER_CONFIRMED', 'CUSTOMER_REJECTED', 'PENDING_VERIFICATION', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "FieldReviewAction" AS ENUM ('CONFIRM', 'CORRECT', 'REJECT');

-- CreateEnum
CREATE TYPE "FileSecurityEventType" AS ENUM ('CHECKSUM_MISMATCH', 'MIME_MISMATCH', 'VALIDATION_FAILED', 'POLICY_BLOCKED', 'SCAN_UNAVAILABLE_BLOCK', 'STORAGE_OBJECT_MISSING', 'STALE_JOB_IGNORED');

-- CreateEnum
CREATE TYPE "FileSecuritySeverity" AS ENUM ('INFO', 'WARNING', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "file" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "buildingId" TEXT,
    "installationUnitId" TEXT,
    "displayName" VARCHAR(255) NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentVersionId" TEXT,
    "dataClassification" "DataClassification" NOT NULL DEFAULT 'DEMO_MOCK',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_version" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "originalFilename" VARCHAR(255) NOT NULL,
    "sanitizedFilename" VARCHAR(255) NOT NULL,
    "declaredMimeType" VARCHAR(150) NOT NULL,
    "detectedMimeType" VARCHAR(150),
    "sizeBytes" BIGINT NOT NULL,
    "checksumSha256" CHAR(64) NOT NULL,
    "storageKey" VARCHAR(255) NOT NULL,
    "uploadStatus" "FileVersionUploadStatus" NOT NULL DEFAULT 'PENDING',
    "validationStatus" "FileValidationStatus" NOT NULL DEFAULT 'PENDING',
    "validationDetail" JSONB,
    "malwareScanStatus" "MalwareScanStatus" NOT NULL DEFAULT 'SCAN_UNAVAILABLE',
    "malwareScanDetail" JSONB,
    "integrityStatus" "FileIntegrityStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "lastIntegrityVerifiedAt" TIMESTAMPTZ(6),
    "recognitionStatus" "FileRecognitionStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "uploadRequestKey" VARCHAR(100),
    "uploadedById" TEXT NOT NULL,
    "uploadExpiresAt" TIMESTAMPTZ(6),
    "finalizedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "file_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_extraction" (
    "id" TEXT NOT NULL,
    "fileVersionId" TEXT NOT NULL,
    "extractionVersion" INTEGER NOT NULL,
    "provider" VARCHAR(100) NOT NULL,
    "providerVersion" VARCHAR(100) NOT NULL,
    "dataClassification" "DataClassification" NOT NULL DEFAULT 'DEMO_MOCK',
    "status" "ExtractionStatus" NOT NULL DEFAULT 'QUEUED',
    "extractedText" TEXT,
    "missingItems" JSONB,
    "safetyNotes" TEXT,
    "safeErrorCode" VARCHAR(100),
    "safeErrorMessage" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "queuedAt" TIMESTAMPTZ(6),
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_extraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_text_block" (
    "id" TEXT NOT NULL,
    "extractionId" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "blockIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "sourceKind" VARCHAR(100) NOT NULL,
    "sourceRef" VARCHAR(500),
    "characterCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extraction_text_block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_field" (
    "id" TEXT NOT NULL,
    "extractionId" TEXT NOT NULL,
    "fieldKey" VARCHAR(100) NOT NULL,
    "fieldLabel" VARCHAR(160) NOT NULL,
    "valueType" VARCHAR(50) NOT NULL,
    "originalRawValue" JSONB NOT NULL,
    "originalNormalizedValue" JSONB,
    "unit" VARCHAR(50),
    "pageNumber" INTEGER,
    "sourceText" TEXT,
    "sourceRefs" JSONB,
    "confidence" DECIMAL(5,4),
    "fieldClassification" "ExtractionFieldClassification" NOT NULL,
    "initialStatus" "ExtractionFieldStatus" NOT NULL DEFAULT 'EXTRACTED',
    "customerConfirmable" BOOLEAN NOT NULL DEFAULT false,
    "requiresProfessionalReview" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extraction_field_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_field_review" (
    "id" TEXT NOT NULL,
    "extractionFieldId" TEXT NOT NULL,
    "reviewSequence" INTEGER NOT NULL,
    "action" "FieldReviewAction" NOT NULL,
    "originalValueSnapshot" JSONB NOT NULL,
    "correctedRawValue" JSONB,
    "correctedNormalizedValue" JSONB,
    "statusAfterReview" "ExtractionFieldStatus" NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT NOT NULL,
    "actorRoleSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extraction_field_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_security_event" (
    "id" TEXT NOT NULL,
    "fileVersionId" TEXT NOT NULL,
    "eventType" "FileSecurityEventType" NOT NULL,
    "severity" "FileSecuritySeverity" NOT NULL,
    "expectedChecksum" CHAR(64),
    "actualChecksum" CHAR(64),
    "policyCode" VARCHAR(100),
    "details" JSONB,
    "requestId" VARCHAR(100),
    "jobId" VARCHAR(100),
    "actorUserId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_security_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "file_currentVersionId_key" ON "file"("currentVersionId");

-- CreateIndex
CREATE INDEX "file_customerId_idx" ON "file"("customerId");

-- CreateIndex
CREATE INDEX "file_projectId_idx" ON "file"("projectId");

-- CreateIndex
CREATE INDEX "file_buildingId_idx" ON "file"("buildingId");

-- CreateIndex
CREATE INDEX "file_installationUnitId_idx" ON "file"("installationUnitId");

-- CreateIndex
CREATE INDEX "file_currentVersionId_idx" ON "file"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "file_version_storageKey_key" ON "file_version"("storageKey");

-- CreateIndex
CREATE INDEX "file_version_fileId_createdAt_idx" ON "file_version"("fileId", "createdAt");

-- CreateIndex
CREATE INDEX "file_version_checksumSha256_idx" ON "file_version"("checksumSha256");

-- CreateIndex
CREATE UNIQUE INDEX "file_version_fileId_versionNumber_key" ON "file_version"("fileId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "file_version_id_fileId_key" ON "file_version"("id", "fileId");

-- CreateIndex
CREATE UNIQUE INDEX "file_version_uploadedById_uploadRequestKey_key" ON "file_version"("uploadedById", "uploadRequestKey");

-- CreateIndex
CREATE INDEX "file_extraction_fileVersionId_createdAt_idx" ON "file_extraction"("fileVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "file_extraction_status_idx" ON "file_extraction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "file_extraction_fileVersionId_extractionVersion_key" ON "file_extraction"("fileVersionId", "extractionVersion");

-- CreateIndex
CREATE INDEX "extraction_text_block_extractionId_idx" ON "extraction_text_block"("extractionId");

-- CreateIndex
CREATE UNIQUE INDEX "extraction_text_block_extractionId_pageNumber_blockIndex_key" ON "extraction_text_block"("extractionId", "pageNumber", "blockIndex");

-- CreateIndex
CREATE INDEX "extraction_field_extractionId_idx" ON "extraction_field"("extractionId");

-- CreateIndex
CREATE INDEX "extraction_field_fieldKey_idx" ON "extraction_field"("fieldKey");

-- CreateIndex
CREATE INDEX "extraction_field_fieldClassification_idx" ON "extraction_field"("fieldClassification");

-- CreateIndex
CREATE INDEX "extraction_field_review_extractionFieldId_createdAt_idx" ON "extraction_field_review"("extractionFieldId", "createdAt");

-- CreateIndex
CREATE INDEX "extraction_field_review_actorUserId_createdAt_idx" ON "extraction_field_review"("actorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "extraction_field_review_extractionFieldId_reviewSequence_key" ON "extraction_field_review"("extractionFieldId", "reviewSequence");

-- CreateIndex
CREATE INDEX "file_security_event_fileVersionId_createdAt_idx" ON "file_security_event"("fileVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "file_security_event_eventType_createdAt_idx" ON "file_security_event"("eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "project_id_customerId_key" ON "project"("id", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "building_id_projectId_key" ON "building"("id", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "installation_unit_id_buildingId_key" ON "installation_unit"("id", "buildingId");

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "file_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "file_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "file_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "file_installationUnitId_fkey" FOREIGN KEY ("installationUnitId") REFERENCES "installation_unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "file_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "file_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "file_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_version" ADD CONSTRAINT "file_version_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "file"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_version" ADD CONSTRAINT "file_version_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_extraction" ADD CONSTRAINT "file_extraction_fileVersionId_fkey" FOREIGN KEY ("fileVersionId") REFERENCES "file_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_text_block" ADD CONSTRAINT "extraction_text_block_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "file_extraction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_field" ADD CONSTRAINT "extraction_field_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "file_extraction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_field_review" ADD CONSTRAINT "extraction_field_review_extractionFieldId_fkey" FOREIGN KEY ("extractionFieldId") REFERENCES "extraction_field"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_field_review" ADD CONSTRAINT "extraction_field_review_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_security_event" ADD CONSTRAINT "file_security_event_fileVersionId_fkey" FOREIGN KEY ("fileVersionId") REFERENCES "file_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_security_event" ADD CONSTRAINT "file_security_event_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Composite foreign keys enforce the full project ownership chain.
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

ALTER TABLE "file"
ADD CONSTRAINT "file_installation_requires_building_check"
CHECK ("installationUnitId" IS NULL OR "buildingId" IS NOT NULL);

ALTER TABLE "file_version"
ADD CONSTRAINT "file_version_number_positive_check"
CHECK ("versionNumber" > 0);

ALTER TABLE "file_version"
ADD CONSTRAINT "file_version_size_positive_check"
CHECK ("sizeBytes" > 0);

ALTER TABLE "file_version"
ADD CONSTRAINT "file_version_checksum_format_check"
CHECK ("checksumSha256" ~ '^[0-9A-Fa-f]{64}$');

ALTER TABLE "file_extraction"
ADD CONSTRAINT "file_extraction_version_positive_check"
CHECK ("extractionVersion" > 0 AND "attempt" > 0);

ALTER TABLE "extraction_text_block"
ADD CONSTRAINT "extraction_text_block_values_check"
CHECK (
  ("pageNumber" IS NULL OR "pageNumber" > 0)
  AND "blockIndex" >= 0
  AND "characterCount" >= 0
);

ALTER TABLE "extraction_field"
ADD CONSTRAINT "extraction_field_confidence_range_check"
CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1));

ALTER TABLE "extraction_field_review"
ADD CONSTRAINT "extraction_field_review_sequence_positive_check"
CHECK ("reviewSequence" > 0);

-- File version identity and original bytes become immutable after insert.
CREATE OR REPLACE FUNCTION "protect_file_version_identity"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'file_version rows cannot be deleted'
      USING ERRCODE = '42501';
  END IF;

  IF NEW."fileId" IS DISTINCT FROM OLD."fileId"
    OR NEW."versionNumber" IS DISTINCT FROM OLD."versionNumber"
    OR NEW."originalFilename" IS DISTINCT FROM OLD."originalFilename"
    OR NEW."sanitizedFilename" IS DISTINCT FROM OLD."sanitizedFilename"
    OR NEW."declaredMimeType" IS DISTINCT FROM OLD."declaredMimeType"
    OR NEW."detectedMimeType" IS DISTINCT FROM OLD."detectedMimeType"
    OR NEW."sizeBytes" IS DISTINCT FROM OLD."sizeBytes"
    OR NEW."checksumSha256" IS DISTINCT FROM OLD."checksumSha256"
    OR NEW."storageKey" IS DISTINCT FROM OLD."storageKey"
    OR NEW."uploadedById" IS DISTINCT FROM OLD."uploadedById"
  THEN
    RAISE EXCEPTION 'file_version identity is immutable'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "file_version_identity_guard"
BEFORE UPDATE OR DELETE ON "file_version"
FOR EACH ROW
EXECUTE FUNCTION "protect_file_version_identity"();

-- Extraction identity cannot change; completed result content is immutable.
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

CREATE TRIGGER "file_extraction_result_guard"
BEFORE UPDATE OR DELETE ON "file_extraction"
FOR EACH ROW
EXECUTE FUNCTION "protect_file_extraction_result"();

-- Text blocks and original extraction fields are append-only.
CREATE OR REPLACE FUNCTION "reject_immutable_row_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME
    USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER "extraction_text_block_append_only"
BEFORE UPDATE OR DELETE ON "extraction_text_block"
FOR EACH ROW
EXECUTE FUNCTION "reject_immutable_row_mutation"();

CREATE TRIGGER "extraction_field_append_only"
BEFORE UPDATE OR DELETE ON "extraction_field"
FOR EACH ROW
EXECUTE FUNCTION "reject_immutable_row_mutation"();

CREATE TRIGGER "extraction_field_review_append_only"
BEFORE UPDATE OR DELETE ON "extraction_field_review"
FOR EACH ROW
EXECUTE FUNCTION "reject_immutable_row_mutation"();

CREATE TRIGGER "file_security_event_append_only"
BEFORE UPDATE OR DELETE ON "file_security_event"
FOR EACH ROW
EXECUTE FUNCTION "reject_immutable_row_mutation"();

-- Professional fields can never be customer-confirmed by a Review.
CREATE OR REPLACE FUNCTION "enforce_field_review_status"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  field_classification "ExtractionFieldClassification";
BEGIN
  SELECT "fieldClassification"
  INTO field_classification
  FROM "extraction_field"
  WHERE "id" = NEW."extractionFieldId";

  IF field_classification = 'PROFESSIONAL'
    AND NEW."statusAfterReview" <> 'PENDING_VERIFICATION'
  THEN
    RAISE EXCEPTION 'professional fields must remain pending verification'
      USING ERRCODE = '42501';
  END IF;

  IF field_classification = 'ORDINARY' THEN
    IF NEW."action" = 'REJECT'
      AND NEW."statusAfterReview" <> 'CUSTOMER_REJECTED'
    THEN
      RAISE EXCEPTION 'ordinary rejection must use CUSTOMER_REJECTED'
        USING ERRCODE = '23514';
    END IF;

    IF NEW."action" IN ('CONFIRM', 'CORRECT')
      AND NEW."statusAfterReview" <> 'CUSTOMER_CONFIRMED'
    THEN
      RAISE EXCEPTION 'ordinary confirmation must use CUSTOMER_CONFIRMED'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "field_review_status_guard"
BEFORE INSERT ON "extraction_field_review"
FOR EACH ROW
EXECUTE FUNCTION "enforce_field_review_status"();
