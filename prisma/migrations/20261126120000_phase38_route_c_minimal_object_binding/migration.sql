-- WP-2A-CM1: minimal object binding and backend discriminator.
-- This is a forward-only migration. Historical migrations are not modified.

CREATE TYPE "StorageBackend" AS ENUM (
  'LEGACY_LOCAL',
  'OBJECT_STORE'
);

CREATE TYPE "StorageObjectBindingState" AS ENUM (
  'PENDING',
  'VERIFIED',
  'FAILED_RETAINED'
);

ALTER TABLE "storage_object_lifecycle"
  ADD COLUMN "storageBackend" "StorageBackend"
  NOT NULL DEFAULT 'LEGACY_LOCAL';

ALTER TABLE "storage_object_lifecycle"
  DROP CONSTRAINT "storage_object_ready_content_check";

ALTER TABLE "storage_object_lifecycle"
  ADD CONSTRAINT "storage_object_ready_content_check"
  CHECK (
    "storageBackend" = 'OBJECT_STORE'
    OR (
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
    )
  );

ALTER TABLE "file_version"
  ADD COLUMN "storageBackend" "StorageBackend"
  NOT NULL DEFAULT 'LEGACY_LOCAL',
  ADD COLUMN "storageObjectBindingId" VARCHAR(32);

CREATE TABLE "storage_object_binding" (
  "id" VARCHAR(32) NOT NULL,
  "objectLifecycleId" VARCHAR(32) NOT NULL,
  "operationId" VARCHAR(32) NOT NULL,
  "providerKind" VARCHAR(64) NOT NULL,
  "accountScopeRef" VARCHAR(128) NOT NULL,
  "region" VARCHAR(64) NOT NULL,
  "bucketOrContainer" VARCHAR(255) NOT NULL,
  "objectKey" VARCHAR(255) NOT NULL,
  "providerVersionId" VARCHAR(255),
  "providerGeneration" BIGINT,
  "sizeBytes" BIGINT,
  "checksumSha256" CHAR(64),
  "state" "StorageObjectBindingState" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMPTZ(6),
  CONSTRAINT "storage_object_binding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "storage_object_binding_objectLifecycleId_key"
  ON "storage_object_binding"("objectLifecycleId");
CREATE UNIQUE INDEX "storage_object_binding_operationId_key"
  ON "storage_object_binding"("operationId");
CREATE UNIQUE INDEX "storage_object_binding_provider_version_key"
  ON "storage_object_binding"(
    "providerKind",
    "accountScopeRef",
    "region",
    "bucketOrContainer",
    "objectKey",
    "providerVersionId"
  );
CREATE INDEX "storage_object_binding_state_idx"
  ON "storage_object_binding"("state");

ALTER TABLE "storage_object_binding"
  ADD CONSTRAINT "storage_object_binding_lifecycle_fkey"
  FOREIGN KEY ("objectLifecycleId")
  REFERENCES "storage_object_lifecycle"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "storage_object_binding"
  ADD CONSTRAINT "storage_object_binding_operation_fkey"
  FOREIGN KEY ("operationId")
  REFERENCES "storage_object_operation"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "file_version"
  ADD CONSTRAINT "file_version_storageObjectBinding_fkey"
  FOREIGN KEY ("storageObjectBindingId")
  REFERENCES "storage_object_binding"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE UNIQUE INDEX "file_version_storageObjectBindingId_key"
  ON "file_version"("storageObjectBindingId");

ALTER TABLE "file_version"
  ADD CONSTRAINT "file_version_backend_binding_check"
  CHECK (
    ("storageBackend" = 'LEGACY_LOCAL' AND "storageObjectBindingId" IS NULL)
    OR
    ("storageBackend" = 'OBJECT_STORE' AND "storageObjectBindingId" IS NOT NULL)
  );

ALTER TABLE "storage_object_binding"
  ADD CONSTRAINT "storage_object_binding_state_fields_check"
  CHECK (
    (
      "state" = 'PENDING'
      AND "verifiedAt" IS NULL
    )
    OR
    (
      "state" = 'VERIFIED'
      AND "providerVersionId" IS NOT NULL
      AND "sizeBytes" IS NOT NULL
      AND "sizeBytes" > 0
      AND "checksumSha256" IS NOT NULL
      AND "checksumSha256" ~ '^[0-9A-Fa-f]{64}$'
      AND "verifiedAt" IS NOT NULL
    )
    OR
    (
      "state" = 'FAILED_RETAINED'
    )
  );

CREATE OR REPLACE FUNCTION "p13_protect_storage_binding"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'storage object binding cannot be deleted'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW."objectLifecycleId" IS DISTINCT FROM OLD."objectLifecycleId"
     OR NEW."operationId" IS DISTINCT FROM OLD."operationId"
     OR NEW."providerKind" IS DISTINCT FROM OLD."providerKind"
     OR NEW."accountScopeRef" IS DISTINCT FROM OLD."accountScopeRef"
     OR NEW."region" IS DISTINCT FROM OLD."region"
     OR NEW."bucketOrContainer" IS DISTINCT FROM OLD."bucketOrContainer"
     OR NEW."objectKey" IS DISTINCT FROM OLD."objectKey"
  THEN
    RAISE EXCEPTION 'storage object binding identity is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.state IN ('VERIFIED', 'FAILED_RETAINED')
     AND (
       NEW.state IS DISTINCT FROM OLD.state
       OR NEW."providerVersionId" IS DISTINCT FROM OLD."providerVersionId"
       OR NEW."providerGeneration" IS DISTINCT FROM OLD."providerGeneration"
       OR NEW."sizeBytes" IS DISTINCT FROM OLD."sizeBytes"
       OR NEW."checksumSha256" IS DISTINCT FROM OLD."checksumSha256"
       OR NEW."verifiedAt" IS DISTINCT FROM OLD."verifiedAt"
     )
  THEN
    RAISE EXCEPTION 'terminal storage object binding is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.state = 'PENDING'
     AND NEW.state NOT IN ('PENDING', 'VERIFIED', 'FAILED_RETAINED')
  THEN
    RAISE EXCEPTION 'invalid storage object binding transition'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "p13_storage_binding_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "storage_object_binding"
FOR EACH ROW
EXECUTE FUNCTION "p13_protect_storage_binding"();

CREATE OR REPLACE FUNCTION "p13_protect_storage_lifecycle_backend"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."storageBackend" IS DISTINCT FROM OLD."storageBackend" THEN
    RAISE EXCEPTION 'lifecycle storage backend is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "p13_storage_lifecycle_backend_guard"
BEFORE UPDATE OF "storageBackend" ON "storage_object_lifecycle"
FOR EACH ROW
EXECUTE FUNCTION "p13_protect_storage_lifecycle_backend"();

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

  IF l."storageBackend" = 'LEGACY_LOCAL'
     AND NEW.status IN (
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

CREATE OR REPLACE FUNCTION "p13_assert_file_version_binding"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  b "storage_object_binding"%ROWTYPE;
BEGIN
  IF NEW."storageBackend" = 'LEGACY_LOCAL' THEN
    IF NEW."storageObjectBindingId" IS NOT NULL THEN
      RAISE EXCEPTION 'legacy FileVersion must not have object binding'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."storageObjectBindingId" IS NULL THEN
    RAISE EXCEPTION 'object FileVersion requires object binding'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO b
  FROM "storage_object_binding"
  WHERE id = NEW."storageObjectBindingId"
  FOR SHARE;

  IF NOT FOUND
     OR b.state <> 'VERIFIED'
     OR b."objectKey" IS DISTINCT FROM NEW."storageKey"
     OR b."sizeBytes" IS DISTINCT FROM NEW."sizeBytes"
     OR b."checksumSha256" IS DISTINCT FROM NEW."checksumSha256"
  THEN
    RAISE EXCEPTION 'FileVersion does not match verified object binding'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "p13_file_version_binding_guard"
BEFORE INSERT OR UPDATE OF "storageBackend", "storageObjectBindingId"
ON "file_version"
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_file_version_binding"();

CREATE OR REPLACE FUNCTION "p13_reject_storage_binding_delete"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'storage object binding cannot be deleted or truncated'
    USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER "p13_storage_binding_delete_guard"
BEFORE DELETE ON "storage_object_binding"
FOR EACH ROW
EXECUTE FUNCTION "p13_reject_storage_binding_delete"();

CREATE TRIGGER "p13_storage_binding_truncate_guard"
BEFORE TRUNCATE ON "storage_object_binding"
FOR EACH STATEMENT
EXECUTE FUNCTION "p13_reject_storage_binding_delete"();
