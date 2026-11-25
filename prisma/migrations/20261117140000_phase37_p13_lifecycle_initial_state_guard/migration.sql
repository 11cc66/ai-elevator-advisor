-- Restrict ordinary Lifecycle INSERTs to their approved initial states.
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

    IF NEW."objectKind" IS NULL
       OR NEW.state IS NULL
       OR NOT (
         (NEW."objectKind" = 'STAGING'
          AND NEW.state = 'STAGING_RESERVED')
         OR
         (NEW."objectKind" = 'CANONICAL'
          AND NEW.state = 'FINALIZING')
       )
    THEN
      RAISE EXCEPTION 'invalid storage lifecycle initial state'
        USING ERRCODE = '23514';
    END IF;

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
