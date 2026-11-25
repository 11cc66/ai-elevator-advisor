-- P1-3 isolated storage lifecycle schema.
-- This migration is intended for an empty database created from migration
-- history. Existing FileUploadIntent/FileVersion data requires the separately
-- reviewed backfill migration and must not be migrated by this file.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "file_upload_intent")
     OR EXISTS (SELECT 1 FROM "file_version")
  THEN
    RAISE EXCEPTION
      'P1-3 schema migration requires empty upload/file tables; use the approved backfill migration'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE TYPE "UploadAttemptStatus" AS ENUM (
  'RESERVED',
  'WRITING',
  'READY',
  'FINALIZING',
  'RECOVERY_REQUIRED',
  'COMPLETED',
  'ABANDONED',
  'FAILED'
);

CREATE TYPE "StorageObjectKind" AS ENUM ('STAGING', 'CANONICAL');

CREATE TYPE "StorageObjectState" AS ENUM (
  'STAGING_RESERVED',
  'STAGING',
  'STAGING_READY',
  'STAGING_ABANDONED',
  'FINALIZING',
  'ACTIVE',
  'QUARANTINING',
  'QUARANTINED',
  'RESTORING',
  'PURGE_PENDING',
  'DELETED',
  'FAILED_RETAINED'
);

CREATE TYPE "StorageObjectOperationState" AS ENUM (
  'PREPARED',
  'EXECUTING',
  'UNKNOWN',
  'APPLIED',
  'FAILED',
  'ABANDONED'
);

CREATE TYPE "StorageObjectOperationType" AS ENUM (
  'FINALIZE',
  'QUARANTINE',
  'RESTORE',
  'PURGE'
);

CREATE TABLE "storage_object_lifecycle" (
  "id" VARCHAR(32) NOT NULL,
  "objectKind" "StorageObjectKind" NOT NULL,
  "storageKey" VARCHAR(255) NOT NULL,
  "state" "StorageObjectState" NOT NULL,
  "reservedAttemptId" VARCHAR(32),
  "reservedIntentId" VARCHAR(32),
  "currentOperationId" VARCHAR(32),
  "ownerToken" VARCHAR(64),
  "fencingGeneration" BIGINT NOT NULL DEFAULT 0,
  "leaseExpiresAt" TIMESTAMPTZ(6),
  "sourcePath" VARCHAR(255),
  "targetPath" VARCHAR(255),
  "quarantinePath" VARCHAR(255),
  "quarantinedAt" TIMESTAMPTZ(6),
  "purgeAfter" TIMESTAMPTZ(6),
  "sizeBytes" BIGINT,
  "checksumSha256" CHAR(64),
  "deleteReason" VARCHAR(100),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastErrorCode" VARCHAR(100),
  "lastTransitionAt" TIMESTAMPTZ(6) NOT NULL,
  "closeAttestationId" VARCHAR(64),
  "closedByAttemptId" VARCHAR(32),
  "closedOwnerToken" VARCHAR(64),
  "closedGeneration" BIGINT,
  "writerClosedAt" TIMESTAMPTZ(6),
  "closedDev" VARCHAR(40),
  "closedIno" VARCHAR(80),
  "closedSizeBytes" BIGINT,
  "closedChecksumSha256" CHAR(64),
  "closedIdentityVerified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "storage_object_lifecycle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "storage_object_lifecycle_storageKey_key"
  ON "storage_object_lifecycle"("storageKey");
CREATE UNIQUE INDEX "storage_object_lifecycle_reservedAttemptId_key"
  ON "storage_object_lifecycle"("reservedAttemptId");
CREATE UNIQUE INDEX "storage_object_lifecycle_currentOperationId_key"
  ON "storage_object_lifecycle"("currentOperationId");
CREATE UNIQUE INDEX "storage_object_lifecycle_closeAttestationId_key"
  ON "storage_object_lifecycle"("closeAttestationId");
CREATE UNIQUE INDEX "storage_object_lifecycle_id_storageKey_key"
  ON "storage_object_lifecycle"("id", "storageKey");
CREATE UNIQUE INDEX
  "storage_object_lifecycle_reservedAttemptId_reservedIntentId_storageKey_key"
  ON "storage_object_lifecycle"(
    "reservedAttemptId",
    "reservedIntentId",
    "storageKey"
  );
CREATE INDEX "storage_object_lifecycle_state_leaseExpiresAt_idx"
  ON "storage_object_lifecycle"("state", "leaseExpiresAt");
CREATE INDEX "storage_object_lifecycle_state_purgeAfter_idx"
  ON "storage_object_lifecycle"("state", "purgeAfter");
CREATE INDEX "storage_object_lifecycle_objectKind_state_idx"
  ON "storage_object_lifecycle"("objectKind", "state");

ALTER TABLE "storage_object_lifecycle"
  ADD CONSTRAINT "storage_object_lifecycle_reservedIntentId_fkey"
  FOREIGN KEY ("reservedIntentId")
  REFERENCES "file_upload_intent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "file_upload_attempt" (
  "id" VARCHAR(32) NOT NULL,
  "intentId" VARCHAR(32) NOT NULL,
  "stagingKey" VARCHAR(255) NOT NULL,
  "canonicalStorageKey" VARCHAR(255),
  "status" "UploadAttemptStatus" NOT NULL DEFAULT 'RESERVED',
  "readyAt" TIMESTAMPTZ(6),
  "abandonedAt" TIMESTAMPTZ(6),
  "completedAt" TIMESTAMPTZ(6),
  "failureCode" VARCHAR(100),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "file_upload_attempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "file_upload_attempt_stagingKey_key"
  ON "file_upload_attempt"("stagingKey");
CREATE UNIQUE INDEX "file_upload_attempt_canonicalStorageKey_key"
  ON "file_upload_attempt"("canonicalStorageKey");
CREATE UNIQUE INDEX "file_upload_attempt_id_intentId_key"
  ON "file_upload_attempt"("id", "intentId");
CREATE UNIQUE INDEX "file_upload_attempt_id_intentId_stagingKey_key"
  ON "file_upload_attempt"("id", "intentId", "stagingKey");
CREATE UNIQUE INDEX
  "file_upload_attempt_id_intentId_canonicalStorageKey_key"
  ON "file_upload_attempt"("id", "intentId", "canonicalStorageKey");
CREATE UNIQUE INDEX "file_upload_attempt_id_stagingKey_key"
  ON "file_upload_attempt"("id", "stagingKey");
CREATE INDEX "file_upload_attempt_intentId_createdAt_idx"
  ON "file_upload_attempt"("intentId", "createdAt");
CREATE INDEX "file_upload_attempt_status_idx"
  ON "file_upload_attempt"("status");

CREATE UNIQUE INDEX "one_open_upload_attempt_per_intent"
  ON "file_upload_attempt"("intentId")
  WHERE "status" IN (
    'RESERVED',
    'WRITING',
    'READY',
    'FINALIZING',
    'RECOVERY_REQUIRED'
  );

CREATE UNIQUE INDEX "one_completed_upload_attempt_per_intent"
  ON "file_upload_attempt"("intentId")
  WHERE "status" = 'COMPLETED';

ALTER TABLE "file_upload_attempt"
  ADD CONSTRAINT "file_upload_attempt_intentId_fkey"
  FOREIGN KEY ("intentId")
  REFERENCES "file_upload_intent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "file_upload_attempt"
  ADD CONSTRAINT "file_upload_attempt_stagingKey_fkey"
  FOREIGN KEY ("stagingKey")
  REFERENCES "storage_object_lifecycle"("storageKey")
  ON DELETE RESTRICT ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "file_upload_attempt"
  ADD CONSTRAINT "file_upload_attempt_canonicalStorageKey_fkey"
  FOREIGN KEY ("canonicalStorageKey")
  REFERENCES "storage_object_lifecycle"("storageKey")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "storage_object_lifecycle"
  ADD CONSTRAINT "lifecycle_reserved_attempt_fk"
  FOREIGN KEY (
    "reservedAttemptId",
    "reservedIntentId",
    "storageKey"
  )
  REFERENCES "file_upload_attempt"(
    "id",
    "intentId",
    "stagingKey"
  )
  ON DELETE RESTRICT ON UPDATE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE "storage_object_operation" (
  "id" VARCHAR(32) NOT NULL,
  "objectLifecycleId" VARCHAR(32) NOT NULL,
  "storageKey" VARCHAR(255) NOT NULL,
  "sourceAttemptId" VARCHAR(32),
  "operationType" "StorageObjectOperationType" NOT NULL,
  "state" "StorageObjectOperationState" NOT NULL,
  "ownerToken" VARCHAR(64) NOT NULL,
  "fencingGeneration" BIGINT NOT NULL,
  "leaseExpiresAt" TIMESTAMPTZ(6),
  "sourcePath" VARCHAR(255),
  "targetPath" VARCHAR(255),
  "quarantinePath" VARCHAR(255),
  "expectedSizeBytes" BIGINT,
  "expectedChecksumSha256" CHAR(64),
  "lastErrorCode" VARCHAR(100),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "executionStartedAt" TIMESTAMPTZ(6),
  "completedAt" TIMESTAMPTZ(6),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "storage_object_operation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
  "storage_object_operation_id_objectLifecycleId_storageKey_key"
  ON "storage_object_operation"(
    "id",
    "objectLifecycleId",
    "storageKey"
  );
CREATE INDEX "storage_object_operation_storageKey_state_idx"
  ON "storage_object_operation"("storageKey", "state");
CREATE INDEX "storage_object_operation_state_leaseExpiresAt_idx"
  ON "storage_object_operation"("state", "leaseExpiresAt");

CREATE UNIQUE INDEX "one_active_storage_operation"
  ON "storage_object_operation"("storageKey")
  WHERE "state" IN ('PREPARED', 'EXECUTING', 'UNKNOWN');

ALTER TABLE "storage_object_operation"
  ADD CONSTRAINT "storage_object_operation_objectLifecycleId_fkey"
  FOREIGN KEY ("objectLifecycleId")
  REFERENCES "storage_object_lifecycle"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "storage_object_operation"
  ADD CONSTRAINT "storage_object_operation_sourceAttemptId_fkey"
  FOREIGN KEY ("sourceAttemptId")
  REFERENCES "file_upload_attempt"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "storage_object_operation"
  ADD CONSTRAINT "operation_lifecycle_key_fk"
  FOREIGN KEY ("objectLifecycleId", "storageKey")
  REFERENCES "storage_object_lifecycle"("id", "storageKey")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "storage_object_lifecycle"
  ADD CONSTRAINT "storage_object_lifecycle_currentOperationId_fkey"
  FOREIGN KEY ("currentOperationId")
  REFERENCES "storage_object_operation"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "storage_object_lifecycle"
  ADD CONSTRAINT "lifecycle_current_operation_fk"
  FOREIGN KEY ("currentOperationId", "id", "storageKey")
  REFERENCES "storage_object_operation"(
    "id",
    "objectLifecycleId",
    "storageKey"
  )
  ON DELETE RESTRICT ON UPDATE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "file_upload_intent"
  ADD COLUMN "currentAttemptId" VARCHAR(32);

ALTER TABLE "file_upload_intent"
  ALTER COLUMN "stagingKey" DROP NOT NULL;

CREATE UNIQUE INDEX "file_upload_intent_currentAttemptId_key"
  ON "file_upload_intent"("currentAttemptId");

ALTER TABLE "file_upload_intent"
  ADD CONSTRAINT "file_upload_intent_currentAttemptId_fkey"
  FOREIGN KEY ("currentAttemptId")
  REFERENCES "file_upload_attempt"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "file_upload_intent"
  ADD CONSTRAINT "intent_current_attempt_belongs_fk"
  FOREIGN KEY ("currentAttemptId", "id")
  REFERENCES "file_upload_attempt"("id", "intentId")
  ON DELETE RESTRICT ON UPDATE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "file_version"
  ADD COLUMN "uploadIntentId" VARCHAR(32) NOT NULL,
  ADD COLUMN "uploadAttemptId" VARCHAR(32) NOT NULL,
  ADD COLUMN "creationOperationAttemptId" VARCHAR(64) NOT NULL;

CREATE UNIQUE INDEX "file_version_uploadAttemptId_key"
  ON "file_version"("uploadAttemptId");
CREATE UNIQUE INDEX "file_version_creationOperationAttemptId_key"
  ON "file_version"("creationOperationAttemptId");
CREATE UNIQUE INDEX "file_version_id_uploadIntentId_key"
  ON "file_version"("id", "uploadIntentId");
CREATE UNIQUE INDEX "file_version_uploadAttemptId_uploadIntentId_storageKey_key"
  ON "file_version"(
    "uploadAttemptId",
    "uploadIntentId",
    "storageKey"
  );

ALTER TABLE "file_version"
  ADD CONSTRAINT "file_version_uploadIntentId_fkey"
  FOREIGN KEY ("uploadIntentId")
  REFERENCES "file_upload_intent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "file_version"
  ADD CONSTRAINT "file_version_uploadAttemptId_fkey"
  FOREIGN KEY ("uploadAttemptId")
  REFERENCES "file_upload_attempt"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "file_version"
  ADD CONSTRAINT "file_version_storageKey_fkey"
  FOREIGN KEY ("storageKey")
  REFERENCES "storage_object_lifecycle"("storageKey")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "file_version"
  ADD CONSTRAINT "file_version_creationOperationAttemptId_fkey"
  FOREIGN KEY ("creationOperationAttemptId")
  REFERENCES "storage_object_operation"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "file_version"
  ADD CONSTRAINT "fv_attempt_chain_fk"
  FOREIGN KEY ("uploadAttemptId", "uploadIntentId", "storageKey")
  REFERENCES "file_upload_attempt"(
    "id",
    "intentId",
    "canonicalStorageKey"
  )
  ON DELETE RESTRICT ON UPDATE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "storage_object_lifecycle"
  ADD CONSTRAINT "staging_owner_fields_check"
  CHECK (
    (
      "objectKind" = 'STAGING'
      AND "reservedAttemptId" IS NOT NULL
      AND "reservedIntentId" IS NOT NULL
    )
    OR
    (
      "objectKind" = 'CANONICAL'
      AND "reservedAttemptId" IS NULL
      AND "reservedIntentId" IS NULL
    )
  );

ALTER TABLE "storage_object_lifecycle"
  ADD CONSTRAINT "storage_object_path_namespace_check"
  CHECK (
    (
      "objectKind" = 'STAGING'
      AND "storageKey" LIKE 'staging/%'
    )
    OR
    (
      "objectKind" = 'CANONICAL'
      AND "storageKey" LIKE 'objects/%'
    )
  );

ALTER TABLE "storage_object_lifecycle"
  ADD CONSTRAINT "storage_object_owner_state_check"
  CHECK (
    (
      "state" = 'STAGING_RESERVED'
      AND "ownerToken" IS NULL
      AND "leaseExpiresAt" IS NULL
      AND "fencingGeneration" = 0
    )
    OR
    (
      "state" IN (
        'STAGING',
        'STAGING_READY',
        'FINALIZING',
        'QUARANTINING',
        'RESTORING',
        'PURGE_PENDING'
      )
      AND "ownerToken" IS NOT NULL
      AND "leaseExpiresAt" IS NOT NULL
      AND "fencingGeneration" > 0
    )
    OR
    (
      "state" IN (
        'STAGING_ABANDONED',
        'ACTIVE',
        'QUARANTINED',
        'FAILED_RETAINED'
      )
      AND "ownerToken" IS NOT NULL
      AND "leaseExpiresAt" IS NULL
      AND "fencingGeneration" > 0
    )
    OR
    (
      "state" = 'DELETED'
      AND "leaseExpiresAt" IS NULL
      AND (
        ("ownerToken" IS NULL AND "fencingGeneration" = 0)
        OR
        ("ownerToken" IS NOT NULL AND "fencingGeneration" > 0)
      )
    )
  );

ALTER TABLE "storage_object_lifecycle"
  ADD CONSTRAINT "storage_object_size_check"
  CHECK (
    "sizeBytes" IS NULL OR "sizeBytes" > 0
  );

ALTER TABLE "storage_object_lifecycle"
  ADD CONSTRAINT "storage_object_ready_content_check"
  CHECK (
    "state" NOT IN (
      'STAGING_READY',
      'FINALIZING',
      'ACTIVE',
      'QUARANTINING',
      'QUARANTINED',
      'RESTORING',
      'PURGE_PENDING',
      'DELETED',
      'FAILED_RETAINED'
    )
    OR (
      "sizeBytes" IS NOT NULL
      AND "sizeBytes" > 0
      AND "checksumSha256" IS NOT NULL
      AND "checksumSha256" ~ '^[0-9A-Fa-f]{64}$'
    )
  );

ALTER TABLE "storage_object_lifecycle"
  ADD CONSTRAINT "storage_object_quarantine_fields_check"
  CHECK (
    "state" NOT IN ('QUARANTINED', 'PURGE_PENDING')
    OR (
      "currentOperationId" IS NOT NULL
      AND "quarantinePath" IS NOT NULL
      AND "quarantinedAt" IS NOT NULL
      AND "purgeAfter" IS NOT NULL
      AND "fencingGeneration" > 0
      AND "quarantinePath" =
        'quarantine/' || "id" ||
        '/g' || "fencingGeneration"::text ||
        '/' || "currentOperationId" || '/object'
    )
  );

ALTER TABLE "storage_object_lifecycle"
  ADD CONSTRAINT "close_attestation_complete_check"
  CHECK (
    (
      "closeAttestationId" IS NULL
      AND "closedByAttemptId" IS NULL
      AND "closedOwnerToken" IS NULL
      AND "closedGeneration" IS NULL
      AND "writerClosedAt" IS NULL
      AND "closedDev" IS NULL
      AND "closedIno" IS NULL
      AND "closedSizeBytes" IS NULL
      AND "closedChecksumSha256" IS NULL
      AND "closedIdentityVerified" = false
    )
    OR
    (
      "closeAttestationId" IS NOT NULL
      AND "closedByAttemptId" IS NOT NULL
      AND "closedOwnerToken" IS NOT NULL
      AND "closedGeneration" IS NOT NULL
      AND "writerClosedAt" IS NOT NULL
      AND "closedSizeBytes" IS NOT NULL
      AND "closedSizeBytes" > 0
      AND "closedChecksumSha256" IS NOT NULL
      AND "closedChecksumSha256" ~ '^[0-9A-Fa-f]{64}$'
      AND (
        (
          "closedIdentityVerified" = true
          AND "closedDev" IS NOT NULL
          AND "closedIno" IS NOT NULL
        )
        OR
        (
          "closedIdentityVerified" = false
          AND "closedDev" IS NULL
          AND "closedIno" IS NULL
        )
      )
    )
  );

ALTER TABLE "storage_object_lifecycle"
  ADD CONSTRAINT "close_attestation_lifecycle_snapshot_check"
  CHECK (
    "objectKind" <> 'STAGING'
    OR "closeAttestationId" IS NULL
    OR (
      "closedByAttemptId" IS NOT DISTINCT FROM "reservedAttemptId"
      AND "closedOwnerToken" IS NOT DISTINCT FROM "ownerToken"
      AND "closedGeneration" IS NOT DISTINCT FROM "fencingGeneration"
      AND "closedSizeBytes" IS NOT DISTINCT FROM "sizeBytes"
      AND "closedChecksumSha256" IS NOT DISTINCT FROM "checksumSha256"
    )
  );

ALTER TABLE "storage_object_lifecycle"
  ADD CONSTRAINT "close_attestation_attempt_fk"
  FOREIGN KEY ("closedByAttemptId", "storageKey")
  REFERENCES "file_upload_attempt"("id", "stagingKey")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "storage_object_operation"
  ADD CONSTRAINT "storage_operation_state_lease_check"
  CHECK (
    (
      "state" IN ('PREPARED', 'EXECUTING', 'UNKNOWN')
      AND "leaseExpiresAt" IS NOT NULL
    )
    OR
    (
      "state" IN ('APPLIED', 'FAILED', 'ABANDONED')
      AND "leaseExpiresAt" IS NULL
    )
  );

ALTER TABLE "storage_object_operation"
  ADD CONSTRAINT "storage_operation_paths_check"
  CHECK (
    (
      "operationType" = 'FINALIZE'
      AND "sourcePath" IS NOT NULL
      AND "targetPath" = "storageKey"
      AND "targetPath" LIKE 'objects/%'
    )
    OR
    (
      "operationType" = 'QUARANTINE'
      AND "sourcePath" IS NOT NULL
      AND "targetPath" IS NOT NULL
      AND "targetPath" LIKE 'quarantine/%'
    )
    OR
    (
      "operationType" = 'RESTORE'
      AND "sourcePath" IS NOT NULL
      AND "sourcePath" LIKE 'quarantine/%'
      AND "targetPath" = "storageKey"
    )
    OR
    (
      "operationType" = 'PURGE'
      AND "sourcePath" IS NOT NULL
      AND "sourcePath" LIKE 'quarantine/%'
      AND "targetPath" IS NULL
    )
  );

-- Generic delete rejection for append-only lifecycle history.
CREATE OR REPLACE FUNCTION "p13_reject_chain_delete"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% rows cannot be deleted in P1-3', TG_TABLE_NAME
    USING ERRCODE = '42501';
END;
$$;

-- Attempt identity, state transition and first canonical association.
CREATE OR REPLACE FUNCTION "p13_protect_upload_attempt"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'file_upload_attempt cannot be deleted'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."canonicalStorageKey" IS NOT NULL THEN
      RAISE EXCEPTION 'new attempt must not set canonicalStorageKey'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.status <> 'RESERVED' THEN
      RAISE EXCEPTION 'new attempt must start RESERVED'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW."intentId" IS DISTINCT FROM OLD."intentId"
     OR NEW."stagingKey" IS DISTINCT FROM OLD."stagingKey"
  THEN
    RAISE EXCEPTION 'attempt identity is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD."canonicalStorageKey" IS NOT NULL
     AND NEW."canonicalStorageKey" IS DISTINCT FROM OLD."canonicalStorageKey"
  THEN
    RAISE EXCEPTION 'canonicalStorageKey is immutable once set'
      USING ERRCODE = '23514';
  END IF;

  IF OLD."canonicalStorageKey" IS NULL
     AND NEW."canonicalStorageKey" IS NOT NULL
     AND NOT (OLD.status = 'READY' AND NEW.status = 'FINALIZING')
  THEN
    RAISE EXCEPTION 'canonicalStorageKey requires READY to FINALIZING'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (
       (OLD.status = 'RESERVED'
        AND NEW.status IN ('WRITING', 'ABANDONED', 'FAILED'))
       OR
       (OLD.status = 'WRITING'
        AND NEW.status IN ('READY', 'ABANDONED', 'FAILED'))
       OR
       (OLD.status = 'READY'
        AND NEW.status IN ('FINALIZING', 'ABANDONED', 'FAILED'))
       OR
       (OLD.status = 'FINALIZING'
        AND NEW.status IN ('RECOVERY_REQUIRED', 'COMPLETED'))
       OR
       (OLD.status = 'RECOVERY_REQUIRED'
        AND NEW.status IN ('COMPLETED', 'FAILED'))
     )
  THEN
    RAISE EXCEPTION 'invalid upload attempt state transition'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_assert_staging_cleanup_attestation"(
  l "storage_object_lifecycle"
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF l."objectKind" <> 'STAGING' THEN
    RETURN;
  END IF;

  IF l."closeAttestationId" IS NOT NULL
     AND (
       l."closedByAttemptId" IS DISTINCT FROM l."reservedAttemptId"
       OR l."closedOwnerToken" IS DISTINCT FROM l."ownerToken"
       OR l."closedGeneration" IS DISTINCT FROM l."fencingGeneration"
       OR l."closedSizeBytes" IS DISTINCT FROM l."sizeBytes"
       OR l."closedChecksumSha256" IS DISTINCT FROM l."checksumSha256"
     )
  THEN
    RAISE EXCEPTION
      'close attestation does not match lifecycle ownership/content snapshot'
      USING ERRCODE = '23514';
  END IF;

  IF l.state IN (
       'QUARANTINING',
       'QUARANTINED',
       'PURGE_PENDING',
       'DELETED'
     )
     AND (
       l."closeAttestationId" IS NULL
       OR l."writerClosedAt" IS NULL
       OR l."closedSizeBytes" IS NULL
       OR l."closedChecksumSha256" IS NULL
       OR l."closedIdentityVerified" IS DISTINCT FROM true
     )
  THEN
    RAISE EXCEPTION
      'STAGING cleanup requires complete identity-verified close attestation'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_assert_staging_cleanup_attestation_trigger"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM "p13_assert_staging_cleanup_attestation"(NEW);
  RETURN NULL;
END;
$$;

-- Staging lifecycle ownership is checked after both rows exist.
CREATE OR REPLACE FUNCTION "p13_assert_attempt_staging_owner"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  l "storage_object_lifecycle"%ROWTYPE;
BEGIN
  SELECT * INTO l
  FROM "storage_object_lifecycle"
  WHERE "storageKey" = NEW."stagingKey";

  IF NOT FOUND
     OR l."objectKind" <> 'STAGING'
     OR l."reservedAttemptId" IS DISTINCT FROM NEW.id
     OR l."reservedIntentId" IS DISTINCT FROM NEW."intentId"
  THEN
    RAISE EXCEPTION 'attempt staging lifecycle ownership mismatch'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status IN (
       'READY',
       'FINALIZING',
       'RECOVERY_REQUIRED',
       'COMPLETED'
     )
     AND l."closeAttestationId" IS NULL
  THEN
    RAISE EXCEPTION 'attempt cannot advance without close attestation'
      USING ERRCODE = '23514';
  END IF;

  PERFORM "p13_assert_staging_cleanup_attestation"(l);

  RETURN NULL;
END;
$$;

-- Canonical association requires the exact finalize operation.
CREATE OR REPLACE FUNCTION "p13_assert_attempt_canonical_owner"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  l "storage_object_lifecycle"%ROWTYPE;
  op "storage_object_operation"%ROWTYPE;
BEGIN
  IF OLD."canonicalStorageKey" IS NULL
     AND NEW."canonicalStorageKey" IS NOT NULL
  THEN
    SELECT * INTO l
    FROM "storage_object_lifecycle"
    WHERE "storageKey" = NEW."canonicalStorageKey"
    FOR UPDATE;

    IF l."objectKind" <> 'CANONICAL'
       OR l.state <> 'FINALIZING'
       OR l."currentOperationId" IS NULL
    THEN
      RAISE EXCEPTION 'canonical lifecycle is not FINALIZING'
        USING ERRCODE = '23514';
    END IF;

    SELECT * INTO op
    FROM "storage_object_operation"
    WHERE id = l."currentOperationId"
    FOR UPDATE;

    IF op."operationType" <> 'FINALIZE'
       OR op."sourceAttemptId" IS DISTINCT FROM NEW.id
       OR op."objectLifecycleId" IS DISTINCT FROM l.id
       OR op."storageKey" IS DISTINCT FROM l."storageKey"
       OR op."targetPath" IS DISTINCT FROM l."storageKey"
       OR op.state NOT IN ('PREPARED', 'EXECUTING')
       OR op."ownerToken" IS DISTINCT FROM l."ownerToken"
       OR op."fencingGeneration" IS DISTINCT FROM l."fencingGeneration"
    THEN
      RAISE EXCEPTION 'canonical finalize operation ownership mismatch'
        USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      SELECT 1 FROM "file_version"
      WHERE "storageKey" = NEW."canonicalStorageKey"
    ) THEN
      RAISE EXCEPTION 'canonical lifecycle already has FileVersion'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Lifecycle identity, transition and close-attestation immutability.
CREATE OR REPLACE FUNCTION "p13_protect_storage_lifecycle"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'storage_object_lifecycle cannot be deleted'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM "p13_assert_staging_cleanup_attestation"(NEW);
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW."objectKind" IS DISTINCT FROM OLD."objectKind"
     OR NEW."storageKey" IS DISTINCT FROM OLD."storageKey"
     OR NEW."reservedAttemptId" IS DISTINCT FROM OLD."reservedAttemptId"
     OR NEW."reservedIntentId" IS DISTINCT FROM OLD."reservedIntentId"
  THEN
    RAISE EXCEPTION 'storage lifecycle identity is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD."closeAttestationId" IS NOT NULL
     AND (
       NEW."closeAttestationId" IS DISTINCT FROM OLD."closeAttestationId"
       OR NEW."closedByAttemptId" IS DISTINCT FROM OLD."closedByAttemptId"
       OR NEW."closedOwnerToken" IS DISTINCT FROM OLD."closedOwnerToken"
       OR NEW."closedGeneration" IS DISTINCT FROM OLD."closedGeneration"
       OR NEW."writerClosedAt" IS DISTINCT FROM OLD."writerClosedAt"
       OR NEW."closedDev" IS DISTINCT FROM OLD."closedDev"
       OR NEW."closedIno" IS DISTINCT FROM OLD."closedIno"
       OR NEW."closedSizeBytes" IS DISTINCT FROM OLD."closedSizeBytes"
       OR NEW."closedChecksumSha256" IS DISTINCT FROM OLD."closedChecksumSha256"
       OR NEW."closedIdentityVerified" IS DISTINCT FROM OLD."closedIdentityVerified"
       OR NEW."ownerToken" IS DISTINCT FROM OLD."ownerToken"
       OR NEW."fencingGeneration" IS DISTINCT FROM OLD."fencingGeneration"
       OR NEW."sizeBytes" IS DISTINCT FROM OLD."sizeBytes"
       OR NEW."checksumSha256" IS DISTINCT FROM OLD."checksumSha256"
     )
  THEN
    RAISE EXCEPTION 'close attestation and lifecycle snapshot are immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.state IS DISTINCT FROM OLD.state
     AND NOT (
       (OLD.state = 'STAGING_RESERVED'
        AND NEW.state = 'STAGING')
       OR
       (OLD.state = 'STAGING'
        AND NEW.state IN ('STAGING_READY', 'STAGING_ABANDONED'))
       OR
       (OLD.state = 'STAGING_READY'
        AND NEW.state IN ('DELETED', 'QUARANTINING', 'STAGING_ABANDONED'))
       OR
       (OLD.state = 'STAGING_ABANDONED'
        AND NEW.state IN ('QUARANTINING', 'DELETED'))
       OR
       (OLD.state = 'FINALIZING'
        AND NEW.state IN ('ACTIVE', 'QUARANTINING', 'FAILED_RETAINED'))
       OR
       (OLD.state = 'QUARANTINING'
        AND NEW.state IN ('QUARANTINED', 'FAILED_RETAINED'))
       OR
       (OLD.state = 'QUARANTINED'
        AND NEW.state IN ('PURGE_PENDING', 'RESTORING', 'FAILED_RETAINED'))
       OR
       (OLD.state = 'RESTORING'
        AND NEW.state IN ('ACTIVE', 'FAILED_RETAINED'))
       OR
       (OLD.state = 'PURGE_PENDING'
        AND NEW.state IN ('DELETED', 'FAILED_RETAINED'))
     )
  THEN
    RAISE EXCEPTION 'invalid storage lifecycle state transition'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.state = 'ACTIVE'
     AND NEW.state IS DISTINCT FROM 'ACTIVE'
     AND EXISTS (
       SELECT 1 FROM "file_version"
       WHERE "storageKey" = OLD."storageKey"
     )
  THEN
    RAISE EXCEPTION 'ACTIVE lifecycle with FileVersion cannot leave ACTIVE'
      USING ERRCODE = '23514';
  END IF;

  PERFORM "p13_assert_staging_cleanup_attestation"(NEW);

  RETURN NEW;
END;
$$;

-- Operation identity, transition and terminal immutability.
CREATE OR REPLACE FUNCTION "p13_protect_storage_operation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'storage_object_operation cannot be deleted'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW."objectLifecycleId" IS DISTINCT FROM OLD."objectLifecycleId"
     OR NEW."storageKey" IS DISTINCT FROM OLD."storageKey"
     OR NEW."sourceAttemptId" IS DISTINCT FROM OLD."sourceAttemptId"
     OR NEW."operationType" IS DISTINCT FROM OLD."operationType"
  THEN
    RAISE EXCEPTION 'operation identity is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD."sourcePath" IS NOT NULL
     AND NEW."sourcePath" IS DISTINCT FROM OLD."sourcePath"
  THEN
    RAISE EXCEPTION 'operation sourcePath is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD."targetPath" IS NOT NULL
     AND NEW."targetPath" IS DISTINCT FROM OLD."targetPath"
  THEN
    RAISE EXCEPTION 'operation targetPath is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD."quarantinePath" IS NOT NULL
     AND NEW."quarantinePath" IS DISTINCT FROM OLD."quarantinePath"
  THEN
    RAISE EXCEPTION 'operation quarantinePath is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.state IN ('APPLIED', 'FAILED', 'ABANDONED')
     AND (
       NEW.state IS DISTINCT FROM OLD.state
       OR NEW."ownerToken" IS DISTINCT FROM OLD."ownerToken"
       OR NEW."fencingGeneration" IS DISTINCT FROM OLD."fencingGeneration"
       OR NEW."leaseExpiresAt" IS DISTINCT FROM OLD."leaseExpiresAt"
       OR NEW."sourcePath" IS DISTINCT FROM OLD."sourcePath"
       OR NEW."targetPath" IS DISTINCT FROM OLD."targetPath"
       OR NEW."quarantinePath" IS DISTINCT FROM OLD."quarantinePath"
       OR NEW."expectedSizeBytes" IS DISTINCT FROM OLD."expectedSizeBytes"
       OR NEW."expectedChecksumSha256" IS DISTINCT FROM OLD."expectedChecksumSha256"
       OR NEW."lastErrorCode" IS DISTINCT FROM OLD."lastErrorCode"
       OR NEW."executionStartedAt" IS DISTINCT FROM OLD."executionStartedAt"
       OR NEW."completedAt" IS DISTINCT FROM OLD."completedAt"
     )
  THEN
    RAISE EXCEPTION 'terminal storage operation is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.state IS DISTINCT FROM OLD.state
     AND NOT (
       (OLD.state = 'PREPARED'
        AND NEW.state IN ('EXECUTING', 'FAILED', 'ABANDONED'))
       OR
       (OLD.state = 'EXECUTING'
        AND NEW.state IN ('APPLIED', 'UNKNOWN', 'FAILED'))
       OR
       (OLD.state = 'UNKNOWN'
        AND NEW.state IN ('APPLIED', 'FAILED', 'ABANDONED'))
     )
  THEN
    RAISE EXCEPTION 'invalid storage operation state transition'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_assert_operation_lifecycle_relation"(
  p_operation_id VARCHAR
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  op "storage_object_operation"%ROWTYPE;
  l "storage_object_lifecycle"%ROWTYPE;
  expected_state "StorageObjectState";
BEGIN
  SELECT * INTO op
  FROM "storage_object_operation"
  WHERE id = p_operation_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT * INTO l
  FROM "storage_object_lifecycle"
  WHERE id = op."objectLifecycleId";

  IF NOT FOUND
     OR l."storageKey" IS DISTINCT FROM op."storageKey"
  THEN
    RAISE EXCEPTION 'operation lifecycle/key mismatch'
      USING ERRCODE = '23514';
  END IF;

  IF op.state IN ('PREPARED', 'EXECUTING', 'UNKNOWN') THEN
    IF l."currentOperationId" IS DISTINCT FROM op.id THEN
      RAISE EXCEPTION 'active operation is not currentOperation'
        USING ERRCODE = '23514';
    END IF;

    IF l."ownerToken" IS DISTINCT FROM op."ownerToken"
       OR l."fencingGeneration" IS DISTINCT FROM op."fencingGeneration"
       OR l."leaseExpiresAt" IS NULL
       OR op."leaseExpiresAt" IS NULL
       OR l."leaseExpiresAt" IS DISTINCT FROM op."leaseExpiresAt"
    THEN
      RAISE EXCEPTION 'active operation owner/generation/lease mismatch'
        USING ERRCODE = '23514';
    END IF;

    expected_state := CASE op."operationType"
      WHEN 'FINALIZE' THEN 'FINALIZING'
      WHEN 'QUARANTINE' THEN 'QUARANTINING'
      WHEN 'RESTORE' THEN 'RESTORING'
      WHEN 'PURGE' THEN 'PURGE_PENDING'
    END;

    IF l.state <> expected_state THEN
      RAISE EXCEPTION 'active operation lifecycle state mismatch'
        USING ERRCODE = '23514';
    END IF;

  ELSIF l."currentOperationId" = op.id THEN
    IF l."ownerToken" IS DISTINCT FROM op."ownerToken"
       OR l."fencingGeneration" IS DISTINCT FROM op."fencingGeneration"
       OR l."leaseExpiresAt" IS NOT NULL
       OR op."leaseExpiresAt" IS NOT NULL
    THEN
      RAISE EXCEPTION 'terminal current operation ownership mismatch'
        USING ERRCODE = '23514';
    END IF;

    IF op.state = 'APPLIED' THEN
      IF NOT (
        (op."operationType" = 'FINALIZE' AND l.state = 'ACTIVE')
        OR
        (op."operationType" = 'QUARANTINE' AND l.state = 'QUARANTINED')
        OR
        (op."operationType" = 'RESTORE' AND l.state = 'ACTIVE')
        OR
        (op."operationType" = 'PURGE' AND l.state = 'DELETED')
      ) THEN
        RAISE EXCEPTION 'applied operation lifecycle state mismatch'
          USING ERRCODE = '23514';
      END IF;
    ELSIF op.state IN ('FAILED', 'ABANDONED') THEN
      IF l.state <> 'FAILED_RETAINED' THEN
        RAISE EXCEPTION 'failed operation lifecycle must be FAILED_RETAINED'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  IF op."operationType" = 'FINALIZE' THEN
    IF op."sourceAttemptId" IS NULL
       OR op."targetPath" IS DISTINCT FROM op."storageKey"
    THEN
      RAISE EXCEPTION 'finalize operation source/target mismatch'
        USING ERRCODE = '23514';
    END IF;
  ELSIF op."operationType" = 'QUARANTINE' THEN
    IF op."sourcePath" IS NULL
       OR op."targetPath" IS NULL
       OR op."targetPath" NOT LIKE 'quarantine/%'
    THEN
      RAISE EXCEPTION 'quarantine operation path mismatch'
        USING ERRCODE = '23514';
    END IF;
    IF op.state = 'APPLIED'
       AND l."quarantinePath" IS DISTINCT FROM op."targetPath"
    THEN
      RAISE EXCEPTION 'quarantined lifecycle path mismatch'
        USING ERRCODE = '23514';
    END IF;
  ELSIF op."operationType" = 'RESTORE' THEN
    IF op."sourcePath" IS NULL
       OR op."sourcePath" NOT LIKE 'quarantine/%'
       OR op."targetPath" IS DISTINCT FROM op."storageKey"
    THEN
      RAISE EXCEPTION 'restore operation path mismatch'
        USING ERRCODE = '23514';
    END IF;
  ELSIF op."operationType" = 'PURGE' THEN
    IF op."sourcePath" IS NULL
       OR op."sourcePath" NOT LIKE 'quarantine/%'
       OR op."targetPath" IS NOT NULL
    THEN
      RAISE EXCEPTION 'purge operation path mismatch'
        USING ERRCODE = '23514';
    END IF;
    IF l."quarantinePath" IS DISTINCT FROM op."sourcePath" THEN
      RAISE EXCEPTION 'purge lifecycle path mismatch'
        USING ERRCODE = '23514';
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_assert_operation_from_operation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_id VARCHAR;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT "currentOperationId" INTO current_id
    FROM "storage_object_lifecycle"
    WHERE id = OLD."objectLifecycleId";
    IF current_id IS NOT NULL THEN
      PERFORM "p13_assert_operation_lifecycle_relation"(current_id);
    END IF;
    PERFORM "p13_assert_operation_lifecycle_relation"(OLD.id);
  END IF;

  SELECT "currentOperationId" INTO current_id
  FROM "storage_object_lifecycle"
  WHERE id = NEW."objectLifecycleId";
  IF current_id IS NOT NULL THEN
    PERFORM "p13_assert_operation_lifecycle_relation"(current_id);
  END IF;
  PERFORM "p13_assert_operation_lifecycle_relation"(NEW.id);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_assert_operation_from_lifecycle"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."currentOperationId" IS NOT NULL
  THEN
    PERFORM "p13_assert_operation_lifecycle_relation"(
      OLD."currentOperationId"
    );
  END IF;

  IF NEW."currentOperationId" IS NOT NULL THEN
    PERFORM "p13_assert_operation_lifecycle_relation"(
      NEW."currentOperationId"
    );
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_assert_upload_chain"(
  p_intent_id VARCHAR
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  i "file_upload_intent"%ROWTYPE;
  a "file_upload_attempt"%ROWTYPE;
  fv "file_version"%ROWTYPE;
  l "storage_object_lifecycle"%ROWTYPE;
  op "storage_object_operation"%ROWTYPE;
  open_count INTEGER;
  completed_attempt_count INTEGER;
  completed_file_version_count INTEGER;
BEGIN
  SELECT * INTO i
  FROM "file_upload_intent"
  WHERE id = p_intent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'upload intent not found'
      USING ERRCODE = '23503';
  END IF;

  SELECT count(*) INTO open_count
  FROM "file_upload_attempt"
  WHERE "intentId" = i.id
    AND status IN (
      'RESERVED',
      'WRITING',
      'READY',
      'FINALIZING',
      'RECOVERY_REQUIRED'
    );

  SELECT count(*) INTO completed_attempt_count
  FROM "file_upload_attempt"
  WHERE "intentId" = i.id
    AND status = 'COMPLETED';

  SELECT count(*) INTO completed_file_version_count
  FROM "file_version"
  WHERE "uploadIntentId" = i.id;

  IF i.status = 'PENDING' THEN
    IF i."currentAttemptId" IS NOT NULL
       OR i."completedFileVersionId" IS NOT NULL
       OR open_count <> 0
       OR completed_attempt_count <> 0
       OR completed_file_version_count <> 0
    THEN
      RAISE EXCEPTION 'invalid PENDING upload chain'
        USING ERRCODE = '23514';
    END IF;

  ELSIF i.status = 'UPLOADING' THEN
    IF i."currentAttemptId" IS NULL
       OR i."completedFileVersionId" IS NOT NULL
       OR open_count <> 1
       OR completed_attempt_count <> 0
       OR completed_file_version_count <> 0
    THEN
      RAISE EXCEPTION 'invalid UPLOADING upload chain counts'
        USING ERRCODE = '23514';
    END IF;

    SELECT * INTO a
    FROM "file_upload_attempt"
    WHERE id = i."currentAttemptId";

    IF NOT FOUND
       OR a."intentId" <> i.id
       OR a.status NOT IN (
         'RESERVED',
         'WRITING',
         'READY',
         'FINALIZING',
         'RECOVERY_REQUIRED'
       )
    THEN
      RAISE EXCEPTION 'invalid current upload attempt'
        USING ERRCODE = '23514';
    END IF;

  ELSIF i.status = 'COMPLETED' THEN
    IF i."currentAttemptId" IS NOT NULL
       OR i."completedFileVersionId" IS NULL
       OR open_count <> 0
       OR completed_attempt_count <> 1
       OR completed_file_version_count <> 1
    THEN
      RAISE EXCEPTION 'invalid COMPLETED upload chain counts'
        USING ERRCODE = '23514';
    END IF;

    SELECT * INTO fv
    FROM "file_version"
    WHERE id = i."completedFileVersionId";

    IF NOT FOUND
       OR fv."uploadIntentId" <> i.id
    THEN
      RAISE EXCEPTION 'completed FileVersion mismatch'
        USING ERRCODE = '23514';
    END IF;

    SELECT * INTO a
    FROM "file_upload_attempt"
    WHERE id = fv."uploadAttemptId";

    IF NOT FOUND
       OR a."intentId" <> i.id
       OR a.status <> 'COMPLETED'
       OR a."canonicalStorageKey" IS DISTINCT FROM fv."storageKey"
    THEN
      RAISE EXCEPTION 'completed attempt mismatch'
        USING ERRCODE = '23514';
    END IF;

    SELECT * INTO l
    FROM "storage_object_lifecycle"
    WHERE "storageKey" = fv."storageKey";

    IF NOT FOUND
       OR l."objectKind" <> 'CANONICAL'
       OR l.state <> 'ACTIVE'
       OR l."currentOperationId" IS NULL
    THEN
      RAISE EXCEPTION 'completed lifecycle mismatch'
        USING ERRCODE = '23514';
    END IF;

    SELECT * INTO op
    FROM "storage_object_operation"
    WHERE id = l."currentOperationId";

    IF NOT FOUND
       OR op."operationType" <> 'FINALIZE'
       OR op.state <> 'APPLIED'
       OR op."sourceAttemptId" IS DISTINCT FROM a.id
       OR op."objectLifecycleId" IS DISTINCT FROM l.id
       OR op."storageKey" IS DISTINCT FROM l."storageKey"
       OR op."targetPath" IS DISTINCT FROM fv."storageKey"
       OR op."ownerToken" IS DISTINCT FROM l."ownerToken"
       OR op."fencingGeneration" IS DISTINCT FROM l."fencingGeneration"
       OR fv."creationOperationAttemptId" IS DISTINCT FROM op.id
    THEN
      RAISE EXCEPTION 'completed finalize operation mismatch'
        USING ERRCODE = '23514';
    END IF;

  ELSIF i.status IN ('FAILED', 'EXPIRED') THEN
    IF i."currentAttemptId" IS NOT NULL
       OR i."completedFileVersionId" IS NOT NULL
       OR open_count <> 0
       OR completed_attempt_count <> 0
       OR completed_file_version_count <> 0
    THEN
      RAISE EXCEPTION 'invalid terminal upload chain'
        USING ERRCODE = '23514';
    END IF;
  END IF;
END;
$$;

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
    ELSIF a.status = 'READY'
          AND l.state NOT IN ('STAGING_READY', 'QUARANTINING', 'FAILED_RETAINED')
    THEN
      RAISE EXCEPTION 'READY attempt lifecycle mismatch'
        USING ERRCODE = '23514';
    ELSIF a.status IN ('FINALIZING', 'RECOVERY_REQUIRED')
          AND l.state NOT IN ('STAGING_READY', 'DELETED', 'FAILED_RETAINED')
    THEN
      RAISE EXCEPTION 'FINALIZING attempt staging lifecycle mismatch'
        USING ERRCODE = '23514';
    ELSIF a.status = 'COMPLETED' AND l.state <> 'DELETED' THEN
      RAISE EXCEPTION 'COMPLETED attempt requires DELETED staging lifecycle'
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

CREATE OR REPLACE FUNCTION "p13_collect_lifecycle_intent_ids_snapshot"(
  p_lifecycle_id VARCHAR,
  p_storage_key VARCHAR,
  p_reserved_attempt_id VARCHAR,
  p_reserved_intent_id VARCHAR,
  p_current_operation_id VARCHAR
)
RETURNS SETOF VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
  v_canonical_intent VARCHAR;
  v_operation_intent VARCHAR;
  v_file_version_intent VARCHAR;
BEGIN
  IF p_reserved_intent_id IS NOT NULL THEN
    IF p_reserved_attempt_id IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM "file_upload_attempt" a
         WHERE a.id = p_reserved_attempt_id
           AND a."intentId" = p_reserved_intent_id
           AND a."stagingKey" = p_storage_key
       )
    THEN
      RAISE EXCEPTION 'lifecycle snapshot staging ownership mismatch'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT a."intentId"
  INTO v_canonical_intent
  FROM "file_upload_attempt" a
  WHERE a."canonicalStorageKey" = p_storage_key;

  IF p_current_operation_id IS NOT NULL THEN
    SELECT a."intentId"
    INTO v_operation_intent
    FROM "storage_object_operation" op
    LEFT JOIN "file_upload_attempt" a
      ON a.id = op."sourceAttemptId"
    WHERE op.id = p_current_operation_id
      AND op."objectLifecycleId" = p_lifecycle_id
      AND op."storageKey" = p_storage_key;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'lifecycle snapshot current operation mismatch'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT fv."uploadIntentId"
  INTO v_file_version_intent
  FROM "file_version" fv
  WHERE fv."storageKey" = p_storage_key;

  RETURN QUERY
  SELECT p_reserved_intent_id
  WHERE p_reserved_intent_id IS NOT NULL
  UNION
  SELECT v_canonical_intent
  WHERE v_canonical_intent IS NOT NULL
  UNION
  SELECT v_operation_intent
  WHERE v_operation_intent IS NOT NULL
  UNION
  SELECT v_file_version_intent
  WHERE v_file_version_intent IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_assert_chain_from_intent"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    PERFORM "p13_assert_upload_chain"(OLD.id);
  END IF;
  PERFORM "p13_assert_upload_chain"(NEW.id);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_assert_chain_from_attempt"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    PERFORM "p13_assert_upload_chain"(OLD."intentId");
  END IF;
  PERFORM "p13_assert_upload_chain"(NEW."intentId");
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_assert_chain_from_file_version"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    PERFORM "p13_assert_upload_chain"(OLD."uploadIntentId");
  END IF;
  PERFORM "p13_assert_upload_chain"(NEW."uploadIntentId");
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_assert_chain_from_lifecycle"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  intent_id VARCHAR;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR intent_id IN
      SELECT * FROM "p13_collect_lifecycle_intent_ids_snapshot"(
        OLD.id,
        OLD."storageKey",
        OLD."reservedAttemptId",
        OLD."reservedIntentId",
        OLD."currentOperationId"
      )
    LOOP
      PERFORM "p13_assert_upload_chain"(intent_id);
    END LOOP;
  END IF;

  FOR intent_id IN
    SELECT * FROM "p13_collect_lifecycle_intent_ids_snapshot"(
      NEW.id,
      NEW."storageKey",
      NEW."reservedAttemptId",
      NEW."reservedIntentId",
      NEW."currentOperationId"
    )
  LOOP
    PERFORM "p13_assert_upload_chain"(intent_id);
  END LOOP;

  PERFORM "p13_collect_lifecycle_intent_ids"(NEW.id);

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_assert_chain_from_operation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  intent_id VARCHAR;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR intent_id IN
      SELECT a."intentId"
      FROM "file_upload_attempt" a
      WHERE a.id = OLD."sourceAttemptId"
      UNION
      SELECT fv."uploadIntentId"
      FROM "file_version" fv
      WHERE fv."storageKey" = OLD."storageKey"
    LOOP
      PERFORM "p13_assert_upload_chain"(intent_id);
    END LOOP;
  END IF;

  FOR intent_id IN
    SELECT a."intentId"
    FROM "file_upload_attempt" a
    WHERE a.id = NEW."sourceAttemptId"
    UNION
    SELECT fv."uploadIntentId"
    FROM "file_version" fv
    WHERE fv."storageKey" = NEW."storageKey"
  LOOP
    PERFORM "p13_assert_upload_chain"(intent_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_assert_lifecycle_file_version"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
  v_state "StorageObjectState";
  v_storage_key VARCHAR;
BEGIN
  v_state := NEW.state;
  v_storage_key := NEW."storageKey";

  SELECT count(*) INTO v_count
  FROM "file_version"
  WHERE "storageKey" = v_storage_key;

  IF v_state = 'ACTIVE' AND v_count <> 1 THEN
    RAISE EXCEPTION 'ACTIVE lifecycle must have exactly one FileVersion'
      USING ERRCODE = '23514';
  END IF;

  IF v_state <> 'ACTIVE' AND v_count <> 0 THEN
    RAISE EXCEPTION 'non-ACTIVE lifecycle must not have FileVersion'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_assert_file_version_lifecycle"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  l "storage_object_lifecycle"%ROWTYPE;
  a "file_upload_attempt"%ROWTYPE;
  op "storage_object_operation"%ROWTYPE;
BEGIN
  SELECT * INTO l
  FROM "storage_object_lifecycle"
  WHERE "storageKey" = NEW."storageKey";

  IF NOT FOUND
     OR l."objectKind" <> 'CANONICAL'
     OR l.state <> 'ACTIVE'
  THEN
    RAISE EXCEPTION 'FileVersion requires ACTIVE CANONICAL lifecycle'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO a
  FROM "file_upload_attempt"
  WHERE id = NEW."uploadAttemptId";

  IF NOT FOUND
     OR a."intentId" <> NEW."uploadIntentId"
     OR a."canonicalStorageKey" IS DISTINCT FROM NEW."storageKey"
     OR a.status <> 'COMPLETED'
  THEN
    RAISE EXCEPTION 'FileVersion upload attempt chain mismatch'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO op
  FROM "storage_object_operation"
  WHERE id = NEW."creationOperationAttemptId";

  IF NOT FOUND
     OR op."operationType" <> 'FINALIZE'
     OR op.state <> 'APPLIED'
     OR op."sourceAttemptId" IS DISTINCT FROM a.id
     OR op."objectLifecycleId" IS DISTINCT FROM l.id
     OR op."storageKey" IS DISTINCT FROM l."storageKey"
     OR op."targetPath" IS DISTINCT FROM l."storageKey"
     OR l."currentOperationId" IS DISTINCT FROM op.id
     OR op."ownerToken" IS DISTINCT FROM l."ownerToken"
     OR op."fencingGeneration" IS DISTINCT FROM l."fencingGeneration"
  THEN
    RAISE EXCEPTION 'FileVersion finalize operation chain mismatch'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_protect_file_version_identity"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'file_version cannot be deleted'
      USING ERRCODE = '42501';
  END IF;

  IF NEW."uploadIntentId" IS DISTINCT FROM OLD."uploadIntentId"
     OR NEW."uploadAttemptId" IS DISTINCT FROM OLD."uploadAttemptId"
     OR NEW."creationOperationAttemptId"
        IS DISTINCT FROM OLD."creationOperationAttemptId"
  THEN
    RAISE EXCEPTION 'FileVersion upload chain is immutable'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_assert_file_version_storage_active"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  l "storage_object_lifecycle"%ROWTYPE;
  a "file_upload_attempt"%ROWTYPE;
  op "storage_object_operation"%ROWTYPE;
BEGIN
  SELECT * INTO l
  FROM "storage_object_lifecycle"
  WHERE "storageKey" = NEW."storageKey"
  FOR SHARE;

  IF NOT FOUND
     OR l."objectKind" <> 'CANONICAL'
     OR l.state <> 'ACTIVE'
     OR l."currentOperationId" IS DISTINCT FROM NEW."creationOperationAttemptId"
  THEN
    RAISE EXCEPTION 'FileVersion requires ACTIVE CANONICAL lifecycle'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO a
  FROM "file_upload_attempt"
  WHERE id = NEW."uploadAttemptId";

  IF NOT FOUND
     OR a."intentId" <> NEW."uploadIntentId"
     OR a."canonicalStorageKey" IS DISTINCT FROM NEW."storageKey"
     OR a.status <> 'COMPLETED'
  THEN
    RAISE EXCEPTION 'FileVersion upload attempt ownership mismatch'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO op
  FROM "storage_object_operation"
  WHERE id = NEW."creationOperationAttemptId";

  IF NOT FOUND
     OR op."operationType" <> 'FINALIZE'
     OR op.state <> 'APPLIED'
     OR op."sourceAttemptId" IS DISTINCT FROM a.id
     OR op."objectLifecycleId" IS DISTINCT FROM l.id
     OR op."storageKey" IS DISTINCT FROM l."storageKey"
     OR op."targetPath" IS DISTINCT FROM l."storageKey"
     OR op."ownerToken" IS DISTINCT FROM l."ownerToken"
     OR op."fencingGeneration" IS DISTINCT FROM l."fencingGeneration"
  THEN
    RAISE EXCEPTION 'FileVersion finalize operation mismatch'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "p13_protect_upload_intent"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'file_upload_intent cannot be deleted'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'PENDING'
       OR NEW."currentAttemptId" IS NOT NULL
       OR NEW."completedFileVersionId" IS NOT NULL
    THEN
      RAISE EXCEPTION 'new upload intent must be PENDING without active attempts'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
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
     OR NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt"
  THEN
    RAISE EXCEPTION 'upload intent identity is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (
       (OLD.status = 'PENDING'
        AND NEW.status IN ('UPLOADING', 'EXPIRED'))
       OR
       (OLD.status = 'UPLOADING'
        AND NEW.status IN ('PENDING', 'COMPLETED', 'FAILED', 'EXPIRED'))
       OR
       (OLD.status = 'FAILED'
        AND NEW.status = 'EXPIRED')
     )
  THEN
    RAISE EXCEPTION 'invalid upload intent state transition'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "p13_upload_intent_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "file_upload_intent"
FOR EACH ROW
EXECUTE FUNCTION "p13_protect_upload_intent"();

CREATE CONSTRAINT TRIGGER "p13_upload_intent_chain_guard"
AFTER INSERT OR UPDATE ON "file_upload_intent"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_chain_from_intent"();

CREATE TRIGGER "p13_upload_attempt_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "file_upload_attempt"
FOR EACH ROW
EXECUTE FUNCTION "p13_protect_upload_attempt"();

CREATE TRIGGER "p13_attempt_canonical_owner_guard"
BEFORE UPDATE OF "canonicalStorageKey" ON "file_upload_attempt"
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_attempt_canonical_owner"();

CREATE CONSTRAINT TRIGGER "p13_attempt_staging_owner_guard"
AFTER INSERT OR UPDATE ON "file_upload_attempt"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_attempt_staging_owner"();

CREATE CONSTRAINT TRIGGER "p13_upload_attempt_chain_guard"
AFTER INSERT OR UPDATE ON "file_upload_attempt"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_chain_from_attempt"();

CREATE TRIGGER "p13_file_version_storage_guard"
BEFORE INSERT OR UPDATE OF "storageKey" ON "file_version"
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_file_version_storage_active"();

CREATE TRIGGER "p13_file_version_chain_identity_guard"
BEFORE UPDATE OR DELETE ON "file_version"
FOR EACH ROW
EXECUTE FUNCTION "p13_protect_file_version_identity"();

CREATE CONSTRAINT TRIGGER "p13_file_version_upload_chain_guard"
AFTER INSERT OR UPDATE ON "file_version"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_chain_from_file_version"();

CREATE CONSTRAINT TRIGGER "p13_file_version_lifecycle_guard"
AFTER INSERT OR UPDATE ON "file_version"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_file_version_lifecycle"();

CREATE TRIGGER "p13_storage_lifecycle_guard"
BEFORE UPDATE OR DELETE ON "storage_object_lifecycle"
FOR EACH ROW
EXECUTE FUNCTION "p13_protect_storage_lifecycle"();

CREATE CONSTRAINT TRIGGER "p13_lifecycle_upload_chain_guard"
AFTER INSERT OR UPDATE ON "storage_object_lifecycle"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_chain_from_lifecycle"();

CREATE CONSTRAINT TRIGGER "p13_lifecycle_operation_guard"
AFTER INSERT OR UPDATE ON "storage_object_lifecycle"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_operation_from_lifecycle"();

CREATE CONSTRAINT TRIGGER "p13_lifecycle_file_version_bijection_guard"
AFTER INSERT OR UPDATE ON "storage_object_lifecycle"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_lifecycle_file_version"();

CREATE CONSTRAINT TRIGGER "p13_staging_cleanup_attestation_guard"
AFTER INSERT OR UPDATE ON "storage_object_lifecycle"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_staging_cleanup_attestation_trigger"();

CREATE TRIGGER "p13_storage_operation_guard"
BEFORE UPDATE OR DELETE ON "storage_object_operation"
FOR EACH ROW
EXECUTE FUNCTION "p13_protect_storage_operation"();

CREATE CONSTRAINT TRIGGER "p13_operation_lifecycle_guard"
AFTER INSERT OR UPDATE ON "storage_object_operation"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_operation_from_operation"();

CREATE CONSTRAINT TRIGGER "p13_operation_upload_chain_guard"
AFTER INSERT OR UPDATE ON "storage_object_operation"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_chain_from_operation"();

CREATE TRIGGER "p13_storage_operation_delete_guard"
BEFORE DELETE ON "storage_object_operation"
FOR EACH ROW
EXECUTE FUNCTION "p13_reject_chain_delete"();

CREATE OR REPLACE FUNCTION "p13_reject_chain_truncate"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% rows cannot be truncated in P1-3', TG_TABLE_NAME
    USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER "p13_upload_intent_truncate_guard"
BEFORE TRUNCATE ON "file_upload_intent"
FOR EACH STATEMENT
EXECUTE FUNCTION "p13_reject_chain_truncate"();

CREATE TRIGGER "p13_upload_attempt_truncate_guard"
BEFORE TRUNCATE ON "file_upload_attempt"
FOR EACH STATEMENT
EXECUTE FUNCTION "p13_reject_chain_truncate"();

CREATE TRIGGER "p13_file_version_truncate_guard"
BEFORE TRUNCATE ON "file_version"
FOR EACH STATEMENT
EXECUTE FUNCTION "p13_reject_chain_truncate"();

CREATE TRIGGER "p13_storage_lifecycle_truncate_guard"
BEFORE TRUNCATE ON "storage_object_lifecycle"
FOR EACH STATEMENT
EXECUTE FUNCTION "p13_reject_chain_truncate"();

CREATE TRIGGER "p13_storage_operation_truncate_guard"
BEFORE TRUNCATE ON "storage_object_operation"
FOR EACH STATEMENT
EXECUTE FUNCTION "p13_reject_chain_truncate"();
