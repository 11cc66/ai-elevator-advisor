import { createHash, randomUUID } from "node:crypto";

import {
  DatabaseTestHarness,
  extractDatabaseError,
  type HarnessTransaction,
  type TransactionRun,
} from "./harness.js";
import type {
  DatabaseErrorDetails,
  FixtureCheck,
  FixtureIdFactory,
  FixtureName,
  FixturePlan,
  FixtureStatement,
  QueryResult,
  SqlValue,
} from "./types.js";

export interface FixtureBuilderOptions {
  idFactory?: FixtureIdFactory;
  now?: Date;
}

export interface FixtureExecution {
  plan: FixturePlan;
  transactionOutcome: TransactionRun<void>;
  finalChecks: ReadonlyArray<{
    id: string;
    rows: QueryResult["rows"];
  }>;
  finalCheckError: DatabaseErrorDetails | null;
}

const defaultIdFactory: FixtureIdFactory = (kind) =>
  `${kind.slice(0, 12).toLowerCase()}_${randomUUID()
    .replaceAll("-", "")
    .slice(0, 16)}`;

function checksum(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isoDate(value: Date): Date {
  return new Date(value.getTime());
}

function plusMilliseconds(value: Date, milliseconds: number): Date {
  return new Date(value.getTime() + milliseconds);
}

interface FixtureIds {
  user: string;
  customer: string;
  project: string;
  file: string;
  intent: string;
  attempt: string;
  stagingLifecycle: string;
  canonicalLifecycle?: string;
  operation?: string;
  fileVersion?: string;
}

interface FixtureValues {
  now: Date;
  lease: Date;
  expiresAt: Date;
  purgeAfter: Date;
  stagingKey: string;
  canonicalKey: string;
  checksum: string;
  ownerToken: string;
  closeAttestationId: string;
  quarantinePath: string;
}

interface BuildContext {
  name: FixtureName;
  ids: FixtureIds;
  values: FixtureValues;
  steps: FixtureStatement[];
  finalChecks: FixtureCheck[];
}

function createIds(
  name: FixtureName,
  idFactory: FixtureIdFactory,
  needsCanonical: boolean,
): FixtureIds {
  const prefix = name.replace("FX-", "").toLowerCase();
  const ids: FixtureIds = {
    user: idFactory("user"),
    customer: idFactory("cust"),
    project: idFactory("proj"),
    file: idFactory("file"),
    intent: idFactory("intent"),
    attempt: idFactory("attempt"),
    stagingLifecycle: idFactory("life"),
  };

  if (needsCanonical) {
    ids.canonicalLifecycle = idFactory("canon");
    ids.operation = idFactory("op");
  }

  if (name === "FX-ACT") {
    ids.fileVersion = idFactory("fv");
  }

  for (const value of Object.values(ids)) {
    if (value !== undefined && (value.length === 0 || value.length > 64)) {
      throw new Error(`P13_FIXTURE_ID_INVALID:${prefix}:${value}`);
    }
  }

  return ids;
}

function addStep(
  context: BuildContext,
  label: string,
  purpose: string,
  sql: string,
  parameters: readonly SqlValue[],
  expectedIntermediateState: string,
  deferredCheckpoint?: string,
): void {
  context.steps.push({
    id: `${context.name}:${context.steps.length + 1}:${label}`,
    label,
    purpose,
    sql,
    parameters,
    expectedIntermediateState,
    ...(deferredCheckpoint === undefined
      ? {}
      : { deferredCheckpoint }),
  });
}

function addBaseGraph(context: BuildContext): void {
  const { ids, values } = context;
  const emailId = ids.user.replaceAll("_", "-");

  addStep(
    context,
    "insert-user",
    "Create the fixture uploader.",
    `INSERT INTO "user"
      ("id", "name", "email", "emailVerified", "username",
       "displayUsername", "updatedAt")
     VALUES ($1, $2, $3, false, $4, $5, $6)`,
    [
      ids.user,
      `P13 Fixture User ${context.name}`,
      `${emailId}@fixture.invalid`,
      emailId,
      `P13 ${context.name}`,
      values.now,
    ],
    "User exists and can be referenced by project/file/intent.",
  );

  addStep(
    context,
    "insert-customer",
    "Create the fixture customer.",
    `INSERT INTO "customer"
      ("id", "organizationName", "contactName", "dataClassification",
       "createdById", "updatedAt")
     VALUES ($1, $2, $3, $4::"DataClassification", $5, $6)`,
    [
      ids.customer,
      `P13 Fixture Customer ${context.name}`,
      "Fixture Contact",
      "DEMO_MOCK",
      ids.user,
      values.now,
    ],
    "Customer exists as DEMO_MOCK.",
  );

  addStep(
    context,
    "insert-project",
    "Create the fixture project.",
    `INSERT INTO "project"
      ("id", "projectCode", "customerId", "name", "address",
       "projectType", "status", "dataClassification",
       "createdById", "updatedAt")
     VALUES ($1, $2, $3, $4, $5,
             $6::"ProjectType", $7::"ProjectStatus",
             $8::"DataClassification", $9, $10)`,
    [
      ids.project,
      `P13-${ids.project.slice(0, 30)}`,
      ids.customer,
      `P13 Fixture ${context.name}`,
      "Fixture Address",
      "OLD_BUILDING_ELEVATOR",
      "DRAFT",
      "DEMO_MOCK",
      ids.user,
      values.now,
    ],
    "Project exists and belongs to fixture customer.",
  );

  addStep(
    context,
    "insert-file",
    "Create the base File row used by the active fixture.",
    `INSERT INTO "file"
      ("id", "customerId", "projectId", "displayName", "status",
       "dataClassification", "createdById", "updatedAt")
     VALUES ($1, $2, $3, $4, $5::"FileStatus",
             $6::"DataClassification", $7, $8)`,
    [
      ids.file,
      ids.customer,
      ids.project,
      `P13 Fixture ${context.name}`,
      "ACTIVE",
      "DEMO_MOCK",
      ids.user,
      values.now,
    ],
    "File exists with no current version.",
  );
}

function addIntent(context: BuildContext): void {
  const { ids, values } = context;

  addStep(
    context,
    "insert-intent",
    "Create a PENDING Intent with no current attempt or completed version.",
    `INSERT INTO "file_upload_intent"
      ("id", "requestKey", "requestFingerprint", "uploadedById",
       "projectId", "displayName", "originalFilename",
       "sanitizedFilename", "declaredMimeType", "declaredSizeBytes",
       "expiresAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      ids.intent,
      `fixture-${ids.intent}`,
      checksum(`request-${ids.intent}`),
      ids.user,
      ids.project,
      `P13 Fixture ${context.name}`,
      "fixture.pdf",
      "fixture.pdf",
      "application/pdf",
      1024n,
      values.expiresAt,
      values.now,
    ],
    "Intent is PENDING with currentAttemptId=NULL.",
    "p13_upload_intent_chain_guard",
  );
}

function addAttemptAndReservedLifecycle(context: BuildContext): void {
  const { ids, values } = context;

  addStep(
    context,
    "insert-attempt-reserved",
    "Create a RESERVED attempt with a fresh staging key.",
    `INSERT INTO "file_upload_attempt"
      ("id", "intentId", "stagingKey", "status", "updatedAt")
     VALUES ($1, $2, $3, $4::"UploadAttemptStatus", $5)`,
    [
      ids.attempt,
      ids.intent,
      values.stagingKey,
      "RESERVED",
      values.now,
    ],
    "Attempt is RESERVED and canonicalStorageKey is NULL.",
    "p13_attempt_staging_owner_guard",
  );

  addStep(
    context,
    "insert-staging-reserved-lifecycle",
    "Create the STAGING_RESERVED lifecycle for the attempt.",
    `INSERT INTO "storage_object_lifecycle"
      ("id", "objectKind", "storageKey", "state",
       "reservedAttemptId", "reservedIntentId",
       "fencingGeneration", "lastTransitionAt", "updatedAt")
     VALUES ($1, $2::"StorageObjectKind", $3,
             $4::"StorageObjectState", $5, $6, 0, $7, $8)`,
    [
      ids.stagingLifecycle,
      "STAGING",
      values.stagingKey,
      "STAGING_RESERVED",
      ids.attempt,
      ids.intent,
      values.now,
      values.now,
    ],
    "Staging lifecycle reserves the same Attempt and Intent.",
    "p13_lifecycle_upload_chain_guard",
  );

  addStep(
    context,
    "activate-intent",
    "Point the Intent at its only open Attempt.",
    `UPDATE "file_upload_intent"
     SET "status"=$1::"FileUploadIntentStatus",
         "currentAttemptId"=$2,
         "updatedAt"=$3
     WHERE "id"=$4`,
    ["UPLOADING", ids.attempt, values.now, ids.intent],
    "Intent UPLOADING, Attempt RESERVED, Lifecycle STAGING_RESERVED.",
    "p13_upload_intent_chain_guard",
  );
}

function addWriting(context: BuildContext): void {
  const { ids, values } = context;

  addStep(
    context,
    "lifecycle-writing",
    "Move the staging lifecycle to STAGING with owner and lease.",
    `UPDATE "storage_object_lifecycle"
     SET "state"=$1::"StorageObjectState",
         "ownerToken"=$2,
         "fencingGeneration"=$3,
         "leaseExpiresAt"=$4,
         "lastTransitionAt"=$5,
         "updatedAt"=$5
     WHERE "id"=$6`,
    [
      "STAGING",
      values.ownerToken,
      1n,
      values.lease,
      values.now,
      ids.stagingLifecycle,
    ],
    "Lifecycle STAGING with owner/generation/lease.",
    "p13_lifecycle_upload_chain_guard",
  );

  addStep(
    context,
    "attempt-writing",
    "Move the attempt to WRITING.",
    `UPDATE "file_upload_attempt"
     SET "status"=$1::"UploadAttemptStatus", "updatedAt"=$2
     WHERE "id"=$3`,
    ["WRITING", values.now, ids.attempt],
    "Attempt WRITING and Lifecycle STAGING.",
    "p13_attempt_staging_owner_guard",
  );
}

function addReady(context: BuildContext): void {
  const { ids, values } = context;

  addStep(
    context,
    "lifecycle-ready-with-attestation",
    "Set content identity and complete close attestation.",
    `UPDATE "storage_object_lifecycle"
     SET "state"=$1::"StorageObjectState",
         "sizeBytes"=$2,
         "checksumSha256"=$3,
         "closeAttestationId"=$4,
         "closedByAttemptId"=$5,
         "closedOwnerToken"=$6,
         "closedGeneration"=$7,
         "writerClosedAt"=$8,
         "closedDev"=$9,
         "closedIno"=$10,
         "closedSizeBytes"=$2,
         "closedChecksumSha256"=$3,
         "closedIdentityVerified"=true,
         "lastTransitionAt"=$8,
         "updatedAt"=$8
     WHERE "id"=$11`,
    [
      "STAGING_READY",
      1024n,
      values.checksum,
      values.closeAttestationId,
      ids.attempt,
      values.ownerToken,
      1n,
      values.now,
      "fixture-dev",
      "fixture-ino",
      ids.stagingLifecycle,
    ],
    "Lifecycle STAGING_READY with complete snapshot-matched proof.",
    "p13_assert_staging_cleanup_attestation_trigger",
  );

  addStep(
    context,
    "attempt-ready",
    "Move the attempt to READY after proof exists.",
    `UPDATE "file_upload_attempt"
     SET "status"=$1::"UploadAttemptStatus",
         "readyAt"=$2,
         "updatedAt"=$2
     WHERE "id"=$3`,
    ["READY", values.now, ids.attempt],
    "Attempt READY with a complete close attestation.",
    "p13_attempt_staging_owner_guard",
  );
}

function addFinalizing(context: BuildContext): void {
  const { ids, values } = context;
  const canonicalLifecycle = ids.canonicalLifecycle;
  const operation = ids.operation;

  if (!canonicalLifecycle || !operation) {
    throw new Error("P13_FIXTURE_CANONICAL_IDS_MISSING");
  }

  addStep(
    context,
    "insert-canonical-finalizing",
    "Create a CANONICAL FINALIZING lifecycle referencing the future current operation.",
    `INSERT INTO "storage_object_lifecycle"
      ("id", "objectKind", "storageKey", "state", "currentOperationId",
       "ownerToken", "fencingGeneration", "leaseExpiresAt",
       "sizeBytes", "checksumSha256", "lastTransitionAt", "updatedAt")
     VALUES ($1, $2::"StorageObjectKind", $3,
             $4::"StorageObjectState", $5, $6, 1, $7, $8, $9, $10, $10)`,
    [
      canonicalLifecycle,
      "CANONICAL",
      values.canonicalKey,
      "FINALIZING",
      operation,
      values.ownerToken,
      values.lease,
      1024n,
      values.checksum,
      values.now,
    ],
    "Canonical FINALIZING lifecycle awaits deferred currentOperation FK.",
    "p13_lifecycle_operation_guard",
  );

  addStep(
    context,
    "insert-finalize-operation",
    "Create an active FINALIZE operation owned by the same lifecycle.",
    `INSERT INTO "storage_object_operation"
      ("id", "objectLifecycleId", "storageKey", "sourceAttemptId",
       "operationType", "state", "ownerToken", "fencingGeneration",
       "leaseExpiresAt", "sourcePath", "targetPath",
       "expectedSizeBytes", "expectedChecksumSha256", "updatedAt")
     VALUES ($1, $2, $3, $4,
             $5::"StorageObjectOperationType",
             $6::"StorageObjectOperationState",
             $7, 1, $8, $9, $10, $11, $12, $13)`,
    [
      operation,
      canonicalLifecycle,
      values.canonicalKey,
      ids.attempt,
      "FINALIZE",
      "EXECUTING",
      values.ownerToken,
      values.lease,
      values.stagingKey,
      values.canonicalKey,
      1024n,
      values.checksum,
      values.now,
    ],
    "FINALIZE EXECUTING is current for CANONICAL FINALIZING.",
    "p13_operation_lifecycle_guard",
  );

  addStep(
    context,
    "attempt-finalizing",
    "Associate the ready Attempt with the canonical object and FINALIZING state.",
    `UPDATE "file_upload_attempt"
     SET "status"=$1::"UploadAttemptStatus",
         "canonicalStorageKey"=$2,
         "updatedAt"=$3
     WHERE "id"=$4`,
    ["FINALIZING", values.canonicalKey, values.now, ids.attempt],
    "Attempt FINALIZING points to owned canonical lifecycle.",
    "p13_attempt_canonical_owner",
  );
}

function addActive(context: BuildContext): void {
  const { ids, values } = context;
  const canonicalLifecycle = ids.canonicalLifecycle;
  const operation = ids.operation;
  const fileVersion = ids.fileVersion;

  if (!canonicalLifecycle || !operation || !fileVersion) {
    throw new Error("P13_FIXTURE_ACTIVE_IDS_MISSING");
  }

  addStep(
    context,
    "finalize-applied",
    "Apply the FINALIZE operation and clear its lease.",
    `UPDATE "storage_object_operation"
     SET "state"=$1::"StorageObjectOperationState",
         "leaseExpiresAt"=NULL,
         "completedAt"=$2,
         "updatedAt"=$2
     WHERE "id"=$3`,
    ["APPLIED", values.now, operation],
    "FINALIZE Operation APPLIED; lifecycle ACTIVE required at commit.",
    "p13_operation_lifecycle_guard",
  );

  addStep(
    context,
    "canonical-active",
    "Move canonical lifecycle to ACTIVE.",
    `UPDATE "storage_object_lifecycle"
     SET "state"=$1::"StorageObjectState",
         "leaseExpiresAt"=NULL,
         "lastTransitionAt"=$2,
         "updatedAt"=$2
     WHERE "id"=$3`,
    ["ACTIVE", values.now, canonicalLifecycle],
    "ACTIVE canonical lifecycle must gain exactly one FileVersion.",
    "p13_lifecycle_file_version_bijection_guard",
  );

  addStep(
    context,
    "attempt-completed",
    "Complete the attempt before inserting FileVersion.",
    `UPDATE "file_upload_attempt"
     SET "status"=$1::"UploadAttemptStatus",
         "completedAt"=$2,
         "updatedAt"=$2
     WHERE "id"=$3`,
    ["COMPLETED", values.now, ids.attempt],
    "Attempt COMPLETED with canonical key and no lease.",
    "p13_attempt_staging_owner_guard",
  );

  addStep(
    context,
    "staging-deleted",
    "Delete the staging lifecycle through the allowed attested path.",
    `UPDATE "storage_object_lifecycle"
     SET "state"=$1::"StorageObjectState",
         "leaseExpiresAt"=NULL,
         "lastTransitionAt"=$2,
         "updatedAt"=$2
     WHERE "id"=$3`,
    ["DELETED", values.now, ids.stagingLifecycle],
    "Staging lifecycle DELETED with preserved close attestation.",
    "p13_staging_cleanup_attestation_guard",
  );

  addStep(
    context,
    "insert-file-version",
    "Create the one FileVersion for the ACTIVE canonical lifecycle.",
    `INSERT INTO "file_version"
      ("id", "fileId", "versionNumber", "originalFilename",
       "sanitizedFilename", "declaredMimeType", "detectedMimeType",
       "sizeBytes", "checksumSha256", "storageKey",
       "uploadIntentId", "uploadAttemptId",
       "creationOperationAttemptId", "uploadStatus",
       "validationStatus", "malwareScanStatus", "integrityStatus",
       "recognitionStatus", "finalizedAt", "uploadedById", "updatedAt")
     VALUES ($1, $2, 1, $3, $4, $5, $5, $6, $7, $8,
             $9, $10, $11, $12::"FileVersionUploadStatus",
             $13::"FileValidationStatus",
             $14::"MalwareScanStatus",
             $15::"FileIntegrityStatus",
             $16::"FileRecognitionStatus", $17, $18, $17)`,
    [
      fileVersion,
      ids.file,
      "fixture.pdf",
      "fixture.pdf",
      "application/pdf",
      1024n,
      values.checksum,
      values.canonicalKey,
      ids.intent,
      ids.attempt,
      operation,
      "UPLOADED",
      "PASSED",
      "CLEAN",
      "VERIFIED",
      "NOT_REQUESTED",
      values.now,
      ids.user,
    ],
    "Exactly one FileVersion references ACTIVE canonical lifecycle.",
    "p13_file_version_lifecycle_guard",
  );

  addStep(
    context,
    "set-file-current-version",
    "Point File.currentVersionId at the fixture FileVersion.",
    `UPDATE "file"
     SET "currentVersionId"=$1, "updatedAt"=$2
     WHERE "id"=$3`,
    [fileVersion, values.now, ids.file],
    "File references the same fixture version.",
  );

  addStep(
    context,
    "complete-intent",
    "Complete the Intent with no current attempt and one completed FileVersion.",
    `UPDATE "file_upload_intent"
     SET "status"=$1::"FileUploadIntentStatus",
         "currentAttemptId"=NULL,
         "completedFileVersionId"=$2,
         "completedAt"=$3,
         "updatedAt"=$3
     WHERE "id"=$4`,
    ["COMPLETED", fileVersion, values.now, ids.intent],
    "Intent COMPLETED with exactly one COMPLETED Attempt and one FileVersion.",
    "p13_upload_intent_chain_guard",
  );
}

function addOrphanCanonical(
  context: BuildContext,
  state: "QUARANTINED" | "PURGE_PENDING" | "DELETED" | "FAILED_RETAINED",
): void {
  const { ids, values } = context;
  const canonicalLifecycle = ids.canonicalLifecycle;
  const operation = ids.operation;

  if (!canonicalLifecycle || !operation) {
    throw new Error("P13_FIXTURE_CANONICAL_IDS_MISSING");
  }

  const operationType =
    state === "FAILED_RETAINED" ? "PURGE" : state === "QUARANTINED" ? "QUARANTINE" : "PURGE";
  const operationState =
    state === "PURGE_PENDING"
      ? "EXECUTING"
      : state === "FAILED_RETAINED"
        ? "ABANDONED"
        : "APPLIED";
  const lease =
    operationState === "EXECUTING" ? values.lease : null;
  const lifecycleLease =
    state === "PURGE_PENDING" ? values.lease : null;
  const sourcePath =
    operationType === "QUARANTINE"
      ? values.canonicalKey
      : values.quarantinePath;
  const targetPath =
    operationType === "QUARANTINE"
      ? values.quarantinePath
      : null;

  addStep(
    context,
    "insert-orphan-canonical",
    "Create a canonical lifecycle with a deferred current-operation reference.",
    `INSERT INTO "storage_object_lifecycle"
      ("id", "objectKind", "storageKey", "state", "currentOperationId",
       "ownerToken", "fencingGeneration", "leaseExpiresAt",
       "sourcePath", "targetPath", "quarantinePath",
       "quarantinedAt", "purgeAfter", "sizeBytes", "checksumSha256",
       "lastTransitionAt", "updatedAt")
     VALUES ($1, $2::"StorageObjectKind", $3,
             $4::"StorageObjectState", $5, $6, 1, $7,
             $8, $9, $10, $11, $12, $13, $14, $11, $11)`,
    [
      canonicalLifecycle,
      "CANONICAL",
      values.canonicalKey,
      state,
      operation,
      values.ownerToken,
      lifecycleLease,
      values.canonicalKey,
      values.canonicalKey,
      values.quarantinePath,
      values.now,
      values.purgeAfter,
      1024n,
      values.checksum,
    ],
    "Canonical lifecycle has no FileVersion and awaits its deferred Operation FK.",
    "p13_lifecycle_operation_guard",
  );

  addStep(
    context,
    "insert-orphan-operation",
    "Create the matching current operation.",
    `INSERT INTO "storage_object_operation"
      ("id", "objectLifecycleId", "storageKey", "operationType",
       "state", "ownerToken", "fencingGeneration", "leaseExpiresAt",
       "sourcePath", "targetPath", "quarantinePath",
       "expectedSizeBytes", "expectedChecksumSha256",
       "completedAt", "updatedAt")
     VALUES ($1, $2, $3,
             $4::"StorageObjectOperationType",
             $5::"StorageObjectOperationState",
             $6, 1, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      operation,
      canonicalLifecycle,
      values.canonicalKey,
      operationType,
      operationState,
      values.ownerToken,
      lease,
      sourcePath,
      targetPath,
      operationType === "QUARANTINE" ? values.quarantinePath : null,
      1024n,
      values.checksum,
      operationState === "EXECUTING" ? null : values.now,
      values.now,
    ],
    "Operation is current and matches lifecycle owner/generation/lease.",
    "p13_operation_lifecycle_guard",
  );
}

function finalChecks(
  name: FixtureName,
  ids: FixtureIds,
  values: FixtureValues,
): FixtureCheck[] {
  const checks: FixtureCheck[] = [
    {
      id: `${name}:intent-attempt`,
      label: "Intent and Attempt final state",
      sql: `SELECT "status", "currentAttemptId", "completedFileVersionId"
            FROM "file_upload_intent" WHERE "id"=$1`,
      parameters: [ids.intent],
      expectedSummary:
        name === "FX-ACT"
          ? "COMPLETED / NULL / fixture FileVersion"
          : "UPLOADING / fixture Attempt / NULL",
    },
    {
      id: `${name}:staging-lifecycle`,
      label: "Staging lifecycle final state",
      sql: `SELECT "state", "reservedAttemptId", "reservedIntentId"
            FROM "storage_object_lifecycle" WHERE "id"=$1`,
      parameters: [ids.stagingLifecycle],
      expectedSummary:
        name === "FX-ACT"
          ? "DELETED with matching reserved ownership"
          : `${name.replace("FX-", "")} staging state`,
    },
  ];

  if (
    name === "FX-FZ" ||
    name === "FX-ACT" ||
    name === "FX-QN" ||
    name === "FX-PP" ||
    name === "FX-DE" ||
    name === "FX-FR"
  ) {
    if (!ids.canonicalLifecycle || !ids.operation) {
      throw new Error("P13_FIXTURE_CANONICAL_FINAL_CHECK_MISSING");
    }
    checks.push({
      id: `${name}:operation-lifecycle`,
      label: "Canonical lifecycle and current operation",
      sql: `SELECT l."state", l."currentOperationId",
                   op."operationType", op."state",
                   op."ownerToken"=l."ownerToken" AS owner_matches,
                   op."fencingGeneration"=l."fencingGeneration" AS generation_matches
            FROM "storage_object_lifecycle" l
            JOIN "storage_object_operation" op
              ON op."id"=l."currentOperationId"
            WHERE l."id"=$1`,
      parameters: [ids.canonicalLifecycle],
      expectedSummary:
        "Lifecycle state, Operation type/state, owner and generation match.",
    });
  }

  checks.push({
    id: `${name}:checksum`,
    label: "Fixture checksum remains stable",
    sql:
      name === "FX-ACT"
        ? `SELECT "storageKey", "uploadIntentId", "uploadAttemptId",
                  "creationOperationAttemptId", "checksumSha256"
           FROM "file_version" WHERE "id"=$1`
        : `SELECT $1::text AS fixture_name, $2::text AS checksum`,
    parameters:
      name === "FX-ACT" && ids.fileVersion
        ? [ids.fileVersion]
        : [name, values.checksum],
    expectedSummary:
      name === "FX-ACT"
        ? "FileVersion references the fixture Intent/Attempt/Operation and checksum."
        : "Checksum reserved for downstream assertions.",
  });

  return checks;
}

function builderValues(
  name: FixtureName,
  ids: FixtureIds,
  now: Date,
): FixtureValues {
  const canonicalLifecycle =
    ids.canonicalLifecycle ?? ids.stagingLifecycle;
  const operation = ids.operation ?? ids.attempt;

  return {
    now,
    lease: plusMilliseconds(now, 60 * 60 * 1000),
    expiresAt: plusMilliseconds(now, 24 * 60 * 60 * 1000),
    purgeAfter: plusMilliseconds(now, 7 * 24 * 60 * 60 * 1000),
    stagingKey: `staging/${ids.stagingLifecycle}`,
    canonicalKey: `objects/${canonicalLifecycle}`,
    checksum: checksum(`${name}:${ids.attempt}`),
    ownerToken: `owner-${ids.attempt}`,
    closeAttestationId: `close-${ids.attempt}`,
    quarantinePath:
      `quarantine/${canonicalLifecycle}/g1/${operation}/object`,
  };
}

export function buildFixture(
  name: FixtureName,
  options: FixtureBuilderOptions = {},
): FixturePlan {
  const needsCanonical = [
    "FX-FZ",
    "FX-ACT",
    "FX-QN",
    "FX-PP",
    "FX-DE",
    "FX-FR",
  ].includes(name);
  const ids = createIds(name, options.idFactory ?? defaultIdFactory, needsCanonical);
  const now = isoDate(options.now ?? new Date());
  const values = builderValues(name, ids, now);
  const context: BuildContext = {
    name,
    ids,
    values,
    steps: [],
    finalChecks: [],
  };

  addBaseGraph(context);
  addIntent(context);
  addAttemptAndReservedLifecycle(context);

  if (name !== "FX-SR") {
    addWriting(context);
  }
  if (
    name === "FX-SRdy" ||
    name === "FX-FZ" ||
    name === "FX-ACT"
  ) {
    addReady(context);
  }
  if (name === "FX-FZ" || name === "FX-ACT") {
    addFinalizing(context);
  }
  if (name === "FX-ACT") {
    addActive(context);
  }
  if (name === "FX-QN") {
    addOrphanCanonical(context, "QUARANTINED");
  }
  if (name === "FX-PP") {
    addOrphanCanonical(context, "PURGE_PENDING");
  }
  if (name === "FX-DE") {
    addOrphanCanonical(context, "DELETED");
  }
  if (name === "FX-FR") {
    addOrphanCanonical(context, "FAILED_RETAINED");
  }

  return {
    name,
    description: `P1-3 database behavior fixture ${name}.`,
    steps: context.steps,
    finalChecks: finalChecks(name, ids, values),
  };
}

export async function executeFixturePlan(
  harness: DatabaseTestHarness,
  plan: FixturePlan,
): Promise<FixtureExecution> {
  const transactionOutcome = await harness.runTransaction(
    `fixture:${plan.name}`,
    async (tx: HarnessTransaction) => {
      for (const step of plan.steps) {
        await tx.query(step.id, step.sql, step.parameters, {
          table: inferTable(step.sql),
          trigger: step.deferredCheckpoint,
        });
      }
    },
  );

  const finalChecks: Array<{
    id: string;
    rows: QueryResult["rows"];
  }> = [];

  if (transactionOutcome.status !== "committed") {
    return {
      plan,
      transactionOutcome,
      finalChecks,
      finalCheckError: null,
    };
  }

  try {
    for (const check of plan.finalChecks) {
      const result = await harness.query(
        check.id,
        check.sql,
        check.parameters,
      );
      finalChecks.push({ id: check.id, rows: result.rows });
    }

    return {
      plan,
      transactionOutcome,
      finalChecks,
      finalCheckError: null,
    };
  } catch (error) {
    return {
      plan,
      transactionOutcome,
      finalChecks,
      finalCheckError: extractDatabaseError(error),
    };
  }
}

function inferTable(sql: string): string | undefined {
  const insert = sql.match(/^\s*INSERT\s+INTO\s+"([^"]+)"/i);
  if (insert?.[1]) {
    return insert[1];
  }
  const update = sql.match(/^\s*UPDATE\s+"([^"]+)"/i);
  return update?.[1];
}
