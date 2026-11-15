-- Attempts count claimed processing runs. Existing Phase 3.4 rows used a
-- one-based default before the first claim, so normalize them to actual runs.
ALTER TABLE "file_extraction"
ALTER COLUMN "attempt" SET DEFAULT 0;

UPDATE "file_extraction"
SET "attempt" = GREATEST("attempt" - 1, 0)
WHERE "attempt" > 0;

ALTER TABLE "file_extraction"
ADD COLUMN "processingToken" VARCHAR(64),
ADD COLUMN "leaseExpiresAt" TIMESTAMPTZ(6),
ADD COLUMN "nextAttemptAt" TIMESTAMPTZ(6);

-- In-flight Phase 3.4 rows receive a lease that can expire and be recovered by
-- a worker using the new claim protocol.
UPDATE "file_extraction"
SET
  "processingToken" = md5(random()::text || clock_timestamp()::text),
  "leaseExpiresAt" = COALESCE("startedAt", CURRENT_TIMESTAMP) + INTERVAL '120 seconds'
WHERE "status" = 'PROCESSING';

ALTER TABLE "file_extraction"
DROP CONSTRAINT "file_extraction_version_positive_check";

ALTER TABLE "file_extraction"
ADD CONSTRAINT "file_extraction_version_positive_check"
CHECK ("extractionVersion" > 0 AND "attempt" >= 0);

ALTER TABLE "file_extraction"
ADD CONSTRAINT "file_extraction_processing_lease_check"
CHECK (
  (
    "status" = 'PROCESSING'
    AND "processingToken" IS NOT NULL
    AND "leaseExpiresAt" IS NOT NULL
  )
  OR (
    "status" <> 'PROCESSING'
    AND "processingToken" IS NULL
    AND "leaseExpiresAt" IS NULL
  )
);

CREATE UNIQUE INDEX "file_extraction_processingToken_key"
ON "file_extraction"("processingToken");

CREATE INDEX "file_extraction_status_leaseExpiresAt_idx"
ON "file_extraction"("status", "leaseExpiresAt");

CREATE INDEX "file_extraction_status_nextAttemptAt_idx"
ON "file_extraction"("status", "nextAttemptAt");
