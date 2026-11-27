# WP-1E — P1-3 Upload Chain Security Protocol Closure R4

## 0. Document Control

```text
Stage: WP-1E
Mode: READ-ONLY INVESTIGATION / PROTOCOL DESIGN
Date: 2026-11-25
Repository: D:\thinkbook\Desktop\jieya
Branch at start: codex/public-github-sync
HEAD at start: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main at start: 101e8a362e430f4fa7b31b67c56823cb702eb1e6

Protocol design result:
  PASS WITH WARNINGS — PROTOCOL DESIGN COMPLETE

Implementation gate:
  BLOCKED — OS AUTHORITY, DATABASE ROLES, WINDOWS PROBES, HISTORICAL DATA
  AND LEGACY DRAIN ARE NOT VERIFIED
```

This report is design-only. It does not modify source, Schema, Migration,
Trigger, configuration or tests; it does not execute SQL, migration, Storage,
Windows ACL, service, Build, Native RPC or drain operations.

Evidence labels:

```text
SOURCE FACT
  Current source, Schema, Migration or command output.

DESIGN
  Normative protocol in this report.

ASSUMPTION
  Platform behavior not measured in this task.

NOT VERIFIED
  No executable evidence exists.

USER APPROVAL
  Requires explicit user decision.

RUNTIME AUTHORITY
  Requires separate OS/ACL/DB/deployment authorization.
```

### 0.1 Skills Applied

- `$project-architecture`
- `$prisma-db-safety`
- `$security-audit`
- `$testing-and-verification`
- `$file-lifecycle`

## 1. Executive Summary

### 1.1 Result

WP-1D-R identified four blocking protocol ambiguities: Evidence writer,
Authority Session persistence, authority validation, and legacy read-only
storage. This R4 report selects one normative path for each:

```text
Publication Evidence:
  Broker OS facts -> restricted SECURITY DEFINER ingestion
  -> immutable evidence -> FileVersion evidence FK

Authority:
  Database-authoritative StorageAuthoritySession
  -> Broker queries restricted verification functions
  -> short-lived Broker capability

Broker:
  local Named Pipe + OS peer SID/process identity
  + per-operation capability + boot epoch

Legacy data:
  separate append-only legacy archive/read-only contract
  + normal API rejection

Recovery:
  advisory storage-key lock
  -> Lifecycle/Operation/Attempt row locks
  -> generation/lease CAS
  -> Broker authority session
```

The protocol is singular at design level. The current platform still lacks the
Native Broker, database roles, Windows probes, actual historical mapping and
legacy drain evidence, so implementation remains blocked.

### 1.2 What Is Closed

| WP-1D-R issue | R4 disposition |
|---|---|
| Evidence trusted writer ambiguous | One restricted SECURITY DEFINER ingestion path selected |
| Evidence sequence ambiguous | One BROKER_PUBLISH evidence per Operation; recovery evidence append-only |
| Authority session store ambiguous | DB `StorageAuthoritySession` is authoritative |
| DB query vs signed permit ambiguous | Broker direct least-privilege DB verification; no signed-permit path |
| Recovery ownership race | Advisory lock, row lock and generation CAS protocol specified |
| Legacy read-only storage missing | `LegacyFileVersion` archive and legacy read contract |
| Drain queue/handle/rollback gaps | D0–D10 evidence matrix with queue and handle gates |
| P2 items | Pseudo SQL, constraints, fixtures and failure behavior specified |

### 1.3 What Is Not Closed

These are implementation/runtime gates, not permission to relax the protocol:

```text
Windows Named Pipe/SID/ACL behavior
Windows File ID/Volume Serial/Reparse/handle-close behavior
Broker service build and deployment identity
Database roles/functions/Migration
Actual historical data mapping
Legacy Worker/artifact drain
Old `.next`/`dist` live state
PostgreSQL Trigger/COMMIT/concurrency tests
```

## 2. Source and Historical Baseline

### 2.1 Git Baseline

At start:

```text
Branch: codex/public-github-sync
HEAD: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified: 0
Staged: 0
Deleted: 0
Untracked: 10
```

The worktree already contained WP-1, WP-1R, WP-1C, WP-1C-R, WP-1D,
WP-1D-R, `$null`, `UNKNOWN'`, `__pycache__/` and the post-GitHub baseline
report. `UNKNOWN'` is an unexpected shell artifact and was not read, hashed,
modified, moved or deleted.

### 2.2 Current Source Facts

| File | Fact |
|---|---|
| `apps/web/src/modules/files/upload-service.ts:155-236` | Legacy Intent-level stagingKey. |
| `apps/web/src/modules/files/upload-service.ts:267-441` | Claim, stream and legacy finalize path. |
| `apps/web/src/modules/files/upload-service.ts:443-575` | FileVersion creation without P1-3 chain. |
| `apps/web/src/modules/files/upload-service.ts:599-605` | Catch marks only Intent failed. |
| `packages/file-storage/src/local-private-storage.ts:108-191` | Current `wx`/close and `access`/`rename` behavior. |
| `packages/file-storage/src/capabilities.ts` | Raw `openReadStream` remains exposed. |
| `apps/web/src/modules/files/download-service.ts:242-495` | Current download flow lacks an ACTIVE lifecycle join. |

### 2.3 Current Schema and Trigger Facts

- `prisma/schema.prisma:398-443`: FileVersion requires
  `uploadIntentId`, `uploadAttemptId`, `creationOperationAttemptId`.
- `prisma/schema.prisma:501-655`: Intent/Attempt/Lifecycle/Operation.
- `prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:992-1004`:
  current Operation transitions:

```text
PREPARED  -> EXECUTING | FAILED | ABANDONED
EXECUTING -> APPLIED | UNKNOWN | FAILED
UNKNOWN   -> APPLIED | FAILED | ABANDONED
```

- Same Migration, lines 603-825: Attempt and staging/canonical ownership.
- Same Migration, lines 1194-1357: deferred upload chain checks.
- Same Migration, lines 1797-1947: FileVersion/lifecycle/finalize checks.
- Same Migration, lines 1949-2005: Intent guard; legacy fields are not
  currently rejected or immutable.

### 2.4 Historical Facts

`docs/architecture/file-lifecycle-p13-implementation-status.md:235-243`
records old Worker instances UNKNOWN, old `.next`/Worker `dist`
present/dangerous and legacy drain not executed. This is historical status,
not current live process inventory.

## 3. WP-1D-R Findings Closure

| Finding | R4 closure | Status |
|---|---|---|
| `WP1DR-P1-01` Evidence trusted writer | Restricted SECURITY DEFINER ingestion selected | `CLOSED AT DESIGN` |
| `WP1DR-P1-02` Legacy read-only storage | Legacy archive schema and API denial specified | `CLOSED AT DESIGN` |
| `WP1DR-P1-03` Authority store/validation ambiguity | DB session + Broker direct verification selected | `CLOSED AT DESIGN` |
| `WP1DR-P1-04` Recovery race | Advisory lock/row lock/generation CAS specified | `CLOSED AT DESIGN` |
| `WP1DR-P2-01` Drain mechanics | Queue, handle, rollback evidence added | `CLOSED AT DESIGN` |
| `WP1DR-P2-02` Evidence sequence | Unique BROKER_PUBLISH evidence + recovery sequence | `CLOSED AT DESIGN` |
| `WP1DR-P2-03` File/Migration list | Exact component list and pseudo SQL added | `CLOSED AT DESIGN` |
| `WP1DR-P2-04` Test harness | SQL/fault hook/fixture contract added | `CLOSED AT DESIGN` |

“Closed at design” removes ambiguity; it does not mean the corresponding
Windows, database or runtime control exists.

## 4. P1-04 — Recovery Owner, Generation and CAS

### 4.1 Fields and Authority

Current fields already present:

```text
StorageObjectOperation.id
StorageObjectOperation.storageKey
StorageObjectOperation.sourceAttemptId
StorageObjectOperation.ownerToken
StorageObjectOperation.fencingGeneration
StorageObjectOperation.leaseExpiresAt
StorageObjectOperation.state
StorageObjectLifecycle.ownerToken
StorageObjectLifecycle.fencingGeneration
StorageObjectLifecycle.leaseExpiresAt
```

The following are **DESIGN NEW** and must not be claimed to exist:

```text
StorageObjectOperation.ownerPrincipalId
StorageObjectOperation.heartbeatAt
StorageObjectOperation.recoveryGeneration
StorageObjectOperation.authoritySessionId
StorageObjectLifecycle.heartbeatAt
StorageObjectLifecycle.recoveryGeneration
StorageObjectLifecycle.authoritySessionId
StorageAuthoritySession.*
StoragePublicationEvidence.*
LegacyFileVersion.*
```

`ownerToken` becomes a digest/reference for existing Trigger compatibility, not
a raw bearer capability.

### 4.2 Normative State Table

| State | Owner authority | OS effect possible | Recovery takeover | Allowed next states |
|---|---:|---:|---:|---|
| `PREPARED` | upload owner | no | only no-authority proof | `EXECUTING`, `FAILED`, `ABANDONED` |
| `EXECUTING` | upload owner + current Broker session | yes/unknown | CAS/session transfer only | `APPLIED`, `UNKNOWN`, `FAILED` |
| `UNKNOWN` | recovery owner after CAS | yes/unknown | one owner | `APPLIED`, `FAILED`, `ABANDONED` only with proof |
| `APPLIED` | terminal evidence owner | no | no | none |
| `FAILED` | terminal retained owner | no | no | none |
| `ABANDONED` | terminal no-effect owner | no | no | none |

`PREPARED -> UNKNOWN` is forbidden. `UNKNOWN` is entered only from
`EXECUTING` after execution authority was acquired.

### 4.3 Recovery CAS Pseudo SQL

This is design pseudo SQL, not executable authorization.

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;

SELECT pg_advisory_xact_lock(
  hashtextextended($storage_key, 0)
);

SELECT * FROM "file_upload_intent"
WHERE id = $intent_id FOR UPDATE;

SELECT * FROM "storage_object_lifecycle"
WHERE id = $lifecycle_id FOR UPDATE;

SELECT * FROM "storage_object_operation"
WHERE id = $operation_id FOR UPDATE;

SELECT * FROM "file_upload_attempt"
WHERE id = $attempt_id FOR UPDATE;

UPDATE "storage_object_operation"
SET
  "ownerToken" = $new_owner_token_digest,
  "ownerPrincipalId" = $recovery_principal,
  "fencingGeneration" = "fencingGeneration" + 1,
  "recoveryGeneration" = "recoveryGeneration" + 1,
  "heartbeatAt" = now(),
  "leaseExpiresAt" = $new_lease,
  "authoritySessionId" = $new_authority_session_id,
  "updatedAt" = now()
WHERE id = $operation_id
  AND state IN ('EXECUTING', 'UNKNOWN')
  AND "fencingGeneration" = $expected_generation
  AND "leaseExpiresAt" <= now()
RETURNING *;

UPDATE "storage_object_lifecycle"
SET
  "ownerToken" = $new_owner_token_digest,
  "heartbeatAt" = now(),
  "leaseExpiresAt" = $new_lease,
  "authoritySessionId" = $new_authority_session_id,
  "fencingGeneration" = $expected_generation + 1,
  "recoveryGeneration" = "recoveryGeneration" + 1,
  "updatedAt" = now()
WHERE id = $lifecycle_id
  AND "fencingGeneration" = $expected_generation;
```

If either row count is not exactly one, rollback and do not touch files.

Two Recovery Workers:

```text
both read same UNKNOWN row
-> both attempt condition update
-> only first matches generation/lease
-> second receives row count 0
-> second must not acquire Broker authority or touch storage
```

The Broker session is acquired only after the CAS commits. If CAS succeeds but
Broker acquisition fails, the Operation remains new-owner `UNKNOWN`/`EXECUTING`
with no valid publication capability; it must be reconciled, not APPLIED.

### 4.4 Lock Order and Deadlock Control

Normative order:

```text
1. transaction-scoped advisory lock on storageKey
2. FileUploadIntent row
3. StorageObjectLifecycle row
4. StorageObjectOperation row
5. FileUploadAttempt row
6. StoragePublicationEvidence rows
7. FileVersion row/insert
```

This matches the Trigger path that locks canonical Lifecycle then Operation in
`p13_assert_attempt_canonical_owner`. No path may lock FileVersion or Evidence
first and then descend to Lifecycle/Operation.

Controls:

- every storage-key operation acquires the advisory lock first;
- one active Authority Session per Operation;
- no FS action inside a DB retry;
- lock timeout is fail-closed, not a second writer;
- missing lock order is an implementation defect.

### 4.5 Recovery Result Matrix

| Outcome | Required result |
|---|---|
| CAS succeeds, Broker authority and exact target | `UNKNOWN -> APPLIED` with evidence |
| CAS succeeds, Broker unavailable | remain `UNKNOWN`; no FileVersion |
| Broker proves no request issued | `UNKNOWN -> ABANDONED` with session/request evidence |
| target/evidence mismatch | `FAILED_RETAINED`; no FileVersion |
| CAS fails | no DB update, no Broker call, no object mutation |
| response lost after CAS | query owner/generation/session; same recovery identity returns same result |

## 5. Authority Session — One Normative Protocol

### 5.1 Selected Architecture

```text
Authoritative session store: PostgreSQL

Broker direct DB access:
  dedicated least-privilege role
  EXECUTE on narrow verification functions only
  no arbitrary table writes

Broker local memory:
  ephemeral cache only
  never authoritative

No signed-permit alternative is used in the normative protocol.
```

The database is the single authority for session state. A Broker restart cannot
use a local journal as authority.

### 5.2 StorageAuthoritySession Draft

```text
StorageAuthoritySession
  id                    varchar(32) PK
  operationId           varchar(32) NOT NULL
  attemptId             varchar(32) NOT NULL
  storageKey            varchar(255) NOT NULL
  authorityBootEpoch    varchar(64) NOT NULL
  brokerServiceSid      varchar(255) NOT NULL
  callerSid             varchar(255) NOT NULL
  callerPid             integer NOT NULL
  callerCreationTime    timestamptz NOT NULL
  capabilityDigest      char(64) NOT NULL
  state                 ISSUED | CONSUMED | RELEASED | REVOKED | EXPIRED
  requestId             varchar(64) NOT NULL
  leaseExpiresAt        timestamptz NOT NULL
  issuedAt              timestamptz NOT NULL
  consumedAt            timestamptz
  revokedAt             timestamptz
  publicationEvidenceId varchar(32)
  createdAt              timestamptz NOT NULL
  updatedAt              timestamptz NOT NULL
```

Constraints:

```text
unique (operationId) where state in (ISSUED, CONSUMED)
unique (operationId, requestId)
unique (capabilityDigest)
FK operationId -> StorageObjectOperation.id
FK attemptId -> FileUploadAttempt.id
FK publicationEvidenceId -> StoragePublicationEvidence.id
terminal state cannot return to ISSUED/CONSUMED
```

The Broker generates the raw capability. The DB stores only its digest. The
raw value exists only in Broker memory and the authenticated caller context.

### 5.3 Broker DB Role

The Broker database role has:

```text
EXECUTE on:
  p13_register_broker_boot_epoch
  p13_acquire_authority_session
  p13_verify_authority_session
  p13_consume_authority_capability
  p13_revoke_authority_session
  p13_append_publication_evidence
  p13_append_recovery_verification

SELECT on only the minimum session/operation/evidence views
no arbitrary table writes
no ACL/role/Trigger/Migration writes
```

Function owners are dedicated NOLOGIN roles. Functions verify `session_user` is
the Broker role; Web/Worker/Maintenance cannot execute ingestion functions.

### 5.4 Boot Epoch

At startup:

1. Generate a random 256-bit `bootEpochId`.
2. Authenticate as the dedicated Broker DB role.
3. Call `p13_register_broker_boot_epoch`.
4. The function expires/revokes all prior active sessions and records the new
   epoch.
5. If registration fails, Broker refuses new authority or starts read-only.

DB unavailable:

```text
no new authority
no capability consumption
no publish/unlink
objects and Operations remain UNKNOWN/executing state
```

## 6. Publication Evidence — One Trusted Write Chain

### 6.1 Selected Chain

```text
Broker performs the OS operation and records OS facts
-> Broker calls a restricted SECURITY DEFINER ingestion function
-> function verifies Broker role, session, operation, generation and payload
-> append-only Evidence row is inserted
-> FileVersion references the accepted Evidence row
```

No Broker-signing alternative is used in v1. The Broker is the OS fact
producer; the DB role is the authenticator; the digest protects encoding
integrity, not OS truth.

### 6.2 PublicationEvidence Draft

```text
StoragePublicationEvidence
  id                       varchar(32) PK
  operationId              varchar(32) NOT NULL
  attemptId                varchar(32) NOT NULL
  intentId                 varchar(32) NOT NULL
  canonicalLifecycleId     varchar(32) NOT NULL
  storageKey               varchar(255) NOT NULL

  evidenceSchemaVersion    integer NOT NULL
  evidenceKind             BROKER_PUBLISH | RECOVERY_VERIFY | HISTORICAL_VERIFIED
  evidenceSequence         integer NOT NULL
  evidenceStatus           VERIFIED | REJECTED | UNKNOWN

  authoritySessionId       varchar(32) NOT NULL
  authorityBootEpoch       varchar(64) NOT NULL
  brokerServiceSid         varchar(255) NOT NULL

  stagingVolumeSerial      varchar(40) NOT NULL
  stagingFileId            varchar(64) NOT NULL
  stagingParentFileId      varchar(64) NOT NULL
  stagingPath              varchar(255) NOT NULL

  targetVolumeSerial       varchar(40) NOT NULL
  targetFileId             varchar(64) NOT NULL
  targetParentFileId       varchar(64) NOT NULL
  targetPath               varchar(255) NOT NULL
  targetNamespaceId        varchar(255) NOT NULL

  targetSizeBytes          bigint NOT NULL
  targetChecksumSha256     char(64) NOT NULL
  reparseVerified          boolean NOT NULL
  hardLinkObserved         boolean NOT NULL
  writerClosed             boolean NOT NULL
  targetSealAlgorithm      varchar(100) NOT NULL
  targetSealDigest         char(64) NOT NULL
  targetAclEvidenceDigest  char(64) NOT NULL
  targetWriteDeniedForOld  boolean NOT NULL

  publicationStartedAt     timestamptz
  publicationCompletedAt   timestamptz
  verifiedAt               timestamptz NOT NULL
  evidenceDigest           char(64) NOT NULL
  createdAt                timestamptz NOT NULL
```

`HISTORICAL_VERIFIED` is available only to the migration role; it does not
claim a new OS publication occurred.

### 6.3 Access and Append-Only Rules

- Broker ingestion functions are SECURITY DEFINER and callable only by the
  Broker role.
- Migration historical evidence is callable only by the migration role.
- Web, Worker, Maintenance and Recovery application roles cannot directly
  INSERT/UPDATE/DELETE evidence.
- UPDATE, DELETE and TRUNCATE are denied by Trigger and ACL.
- Recovery appends a new `RECOVERY_VERIFY` record; it never mutates broker
  evidence.
- `FileVersion.publicationEvidenceId` is UNIQUE and NOT NULL for active
  P1-3 FileVersions.

### 6.4 Association and Trigger Rules

```text
Evidence.operationId -> Operation.id
Evidence.attemptId -> Attempt.id
Evidence.intentId -> Intent.id
Evidence.canonicalLifecycleId -> Canonical Lifecycle.id
Evidence.storageKey -> Canonical Lifecycle.storageKey
FileVersion.uploadIntentId/uploadAttemptId/creationOperationAttemptId
  -> the same evidence chain
FileVersion.publicationEvidenceId -> accepted Evidence.id
```

FileVersion INSERT rejects missing/wrong/revoked evidence, wrong target
identity, wrong size/hash, wrong lifecycle, old boot epoch or evidence reuse.

### 6.5 Evidence Timing

```text
T5 Operation EXECUTING
T6 Broker creates target, copies, closes writer, verifies identity/ACL
T6E restricted Evidence ingestion commits
T7 Operation APPLIED + Lifecycle ACTIVE + Attempt COMPLETED
    + Staging DELETED + FileVersion with evidence FK + Intent/Audit
```

If T6E fails, retain target/staging, keep Operation EXECUTING/UNKNOWN and no
FileVersion. Recovery may append a new recovery evidence only after exact
target revalidation.

If T6E succeeds but T7 fails, evidence remains immutable; the same Operation
may retry T7. It may not create another target or rewrite evidence.

If T7 commits but the response is lost, query the same operation/evidence/
FileVersion and return the same result.

## 7. Broker Capability and OS Fencing

### 7.1 IPC

```text
local Named Pipe only
remote clients rejected
server DACL restricts Broker and approved clients
caller identity comes from OS process/token APIs
client-supplied SID/process identity is not trusted
impersonation only for access checks and reverted immediately
```

### 7.2 Capability

```text
capabilityDigest
authoritySessionId
operationId
attemptId
storageKey
namespace
operationType
bootEpoch
callerSid
processCreationTime
expiry
oneUse
```

The capability is bound to one Operation and storage key, consumed once,
revoked on lease loss/boot change, and unusable for another Attempt/namespace.

### 7.3 Publish Sequence

```text
DB T5 EXECUTING
-> Broker peer authentication
-> Broker p13_acquire_authority_session
-> DB verifies operation/generation/lease
-> Broker CREATE_NEW target and copy
-> Broker p13_consume_authority_capability
-> close/reopen/verify File ID, volume, parent, size, hash, Reparse
-> target seal and ACL readback
-> p13_append_publication_evidence
-> DB T7 Active/FileVersion
```

If DB is unavailable after target creation, stop destructive operations, retain
target/staging and keep the Operation UNKNOWN/EXECUTING.

### 7.4 Fencing Matrix

| Principal | Direct staging write | Broker publish | Direct canonical delete | Evidence insert |
|---|---:|---:|---:|---:|
| Broker service | scoped | yes | scoped only | via definer |
| Web upload | no | capability request | no | no |
| Worker | no | read/verify | no | no |
| Maintenance | no | cleanup via broker | no canonical | no |
| Recovery | no | recovery verify | no | recovery definer |
| Legacy cleanup | no v2 | no | no v2 | no |

## 8. Windows File Identity and ACL

Required evidence:

```text
Volume Serial Number
File ID (128-bit)
parent File ID
final path by handle
FILE_STANDARD_INFO
FILE_ATTRIBUTE_TAG_INFO
Reparse tag/state
Number of links
DeletePending
size and SHA-256
writer close result
ACL/security descriptor digest
AccessCheck for old writer SIDs
```

Native sequence:

```text
CreateFileW
GetFinalPathNameByHandleW
GetFileInformationByHandleEx(FILE_ID_INFO)
GetFileInformationByHandleEx(FILE_STANDARD_INFO)
GetFileInformationByHandleEx(FILE_ATTRIBUTE_TAG_INFO)
FlushFileBuffers
CloseHandle
read-only reopen
SetSecurityInfo / approved sealer
GetSecurityInfo / AccessCheck
```

Identity distinctions:

| Claim | Evidence | Limit |
|---|---|---|
| same path | final path by handle | not object identity |
| same content | size + SHA-256 | not object identity |
| same object | volume + File ID + handle | not no-writer proof |
| writer stopped | handle close + session/authority + ACL + drain | not physical media proof |

ACL boundary:

- v2 root write/delete/ACL authority only to Broker;
- Web/Worker/Maintenance/Recovery direct write/delete denied;
- old cleanup SID denied v2 namespace;
- target parent denies old create/delete/rename/reparse;
- target seal denies old write/delete/ACL;
- existing old handles are addressed by drain, not ACL change alone.

If any identity or ACL evidence is unavailable:

```text
PUBLICATION = UNKNOWN/BLOCKED
No ACTIVE FileVersion
```

## 9. Legacy Read-only Data Isolation

### 9.1 Selected Model

Use separate append-only archive tables:

```text
LegacyFileVersion
  id
  originalFileVersionId UNIQUE
  originalFileId
  storageKey
  sizeBytes
  checksumSha256
  detectedMimeType
  originalFilename
  sourceSnapshotDigest
  legacyReason
  legacyState: READ_ONLY | BLOCKED
  archivedAt

LegacyFileUploadIntent
  id
  originalIntentId UNIQUE
  originalFileVersionId nullable
  legacyReason
  legacyState
  sourceSnapshotDigest
  archivedAt
```

These are not active FileVersions and cannot be referenced by a new upload,
File.currentVersionId, Extraction or Review.

### 9.2 FileVersion Evidence Rules

```text
New FileVersion:
  publicationEvidenceId NOT NULL; evidence VERIFIED

Historical mapped FileVersion:
  publicationEvidenceId NOT NULL; evidence HISTORICAL_VERIFIED + provenance

Legacy archive:
  no active publicationEvidenceId; only LegacyFileVersion archive
```

There is no nullable `publicationEvidenceId` path for an active FileVersion.
The archive is separate, so missing evidence is not hidden.

### 9.3 API Contract

```text
normal list/download/reference:
  active P1-3 FileVersion only
  LegacyFileVersion -> 404/LEGACY_FILE_READ_ONLY
  never expose storageKey/path
  never return unverified object

future legacy.read:
  metadata only unless separately authorized
  no normal download
```

### 9.4 Migration Restriction

Historical promotion requires exact Intent/FileVersion mapping, staging/close
evidence or accepted migration evidence, canonical identity verification, no
duplicates/conflicts, all-or-nothing transaction and user-approved disposition.
Unmappable rows remain permanently read-only. No cleanup or deletion is
allowed without separate authorization.

## 10. Legacy Drain and Rollback Evidence Matrix

### 10.1 Queue Gate

D0 must stop new admission for:

```text
active recognition jobs
retry jobs
delayed jobs
dead-letter jobs
scheduled maintenance jobs
legacy cleanup jobs
```

D3 records active job IDs and terminal/retained states. D4 disables restarts,
watchdogs and schedulers. No retry or dead-letter replay may create a new
legacy upload/cleanup task.

### 10.2 Handle Release Matrix

| Class | Detection | Acceptance |
|---|---|---|
| process handles | process inventory/exit status | no old process/child/restart |
| file handles | native handle enumeration or Broker session inventory | no old session/handle |
| inherited/duplicate handles | process/tree and handle inspection | no writer authority |
| child/external handles | process tree and approved inventory | no writer/delete handle |
| memory-mapped files | native file-handle inventory | no mapping remains |
| active cleanup | queue/operation status | terminal, no delete right |

Process exit alone is not sufficient.

### 10.3 Rollback

```text
If D0-D8 fails:
  no v2 admission; retain v1 read-only/blocked.

If D9 canary fails:
  stop v2 admission;
  revoke all capabilities and issue a new boot epoch;
  retain v2 objects;
  deny old cleanup any v2 access;
  return to read-only legacy-safe state only if no-delete is proven.

If rollback cannot prove old cleanup isolation:
  remain BLOCKED; do not restore broad old Storage permissions.

Before re-switch:
  repeat D0-D8.
```

## 11. P2 Exact Design

### 11.1 Legacy Intent Guard

Future forward Migration/Trigger:

```sql
ALTER TABLE "file_upload_intent"
  ADD COLUMN "legacyState" "LegacyIntentState" NOT NULL DEFAULT 'NONE';

ALTER TABLE "file_upload_intent"
  ADD CONSTRAINT "intent_legacy_fields_shape_check"
  CHECK (
    ("legacyState" = 'READ_ONLY'
      AND "stagingKey" IS NOT NULL)
    OR
    ("legacyState" = 'NONE'
      AND "stagingKey" IS NULL
      AND "objectStorageKey" IS NULL)
  );
```

Trigger rules:

```text
INSERT legacyState=NONE with legacy fields -> reject
UPDATE legacyState=NONE setting legacy fields -> reject
READ_ONLY writes -> migration role only
READ_ONLY cannot create Attempt/FileVersion/currentAttempt
```

### 11.2 T7 Target Ownership

```sql
BEGIN SERIALIZABLE;
SELECT ... FROM "file" WHERE id=$file_id FOR UPDATE;
SELECT ... FROM "project" WHERE id=$project_id FOR SHARE;
SELECT ... FROM "building" WHERE id=$building_id FOR SHARE;
SELECT ... FROM "installation_unit" WHERE id=$unit_id FOR SHARE;
-- require file.projectId = intent.projectId
-- require file.customerId = project.customerId
-- require file.buildingId = intent.buildingId
-- require file.installationUnitId = intent.installationUnitId
-- require file.status = ACTIVE
-- compute version number after the File lock
```

### 11.3 sourcePath Binding

Future Trigger/guard:

```text
FINALIZE Operation:
  sourceAttemptId = Attempt.id
  sourcePath = Attempt.stagingKey
  targetPath = Canonical Lifecycle.storageKey
  objectLifecycleId = Canonical Lifecycle.id
  storageKey = Canonical Lifecycle.storageKey
```

### 11.4 Lease/Heartbeat

```text
heartbeat interval: 30 seconds
lease duration: 120 seconds
renew:
  UPDATE operation/lifecycle
  WHERE ownerToken=$owner
    AND fencingGeneration=$generation
    AND state IN ('PREPARED','EXECUTING','UNKNOWN')
    AND leaseExpiresAt > now()
  RETURNING ...
```

No heartbeat after terminal state. Heartbeat failure stops reading and never
grants a new file handle.

### 11.5 Fixture and Fault Hooks

Fixture sequence:

```text
User -> Customer -> Project -> Building -> InstallationUnit -> File
-> Intent -> Attempt -> STAGING_RESERVED -> STAGING
-> STAGING_READY + close evidence
-> CANONICAL FINALIZING + FINALIZE PREPARED
-> EXECUTING -> PublicationEvidence -> FileVersion/ACTIVE/COMPLETED
```

Hooks:

```text
afterClaim, afterStagingWrite, beforeClose, afterClose,
afterPrepare, afterExecuteCAS, beforeBrokerCopy, afterBrokerCopy,
afterBrokerClose, afterEvidenceInsert, beforeT7, afterEachT7Update,
beforeCommit, afterCommit, afterResponseLoss, afterBrokerRestart,
afterCapabilityRevocation
```

Tests use disposable DB clone and isolated test storage; no trigger disabling
or production data.

### 11.6 Verified Lifecycle Read

```text
authorize project/customer
-> File
-> FileVersion
-> exactly one ACTIVE canonical Lifecycle
-> accepted PublicationEvidence
-> Broker verified handle
-> Volume/File ID/parent/size/hash/Reparse
-> download policy
-> body
```

Raw `openReadStream` is not part of normal Web/Worker runtime. Missing evidence
or identity blocks access and marks integrity failure.

## 12. Cross-Layer Execution Matrix

| Step | Unique actor | Identity/permission | DB state | OS action | Evidence | Failure/recovery | Race |
|---|---|---|---|---|---|---|---|
| Web intent | Web | auth, project upload | PENDING Intent | none | fingerprint | idempotent replay | duplicate POST |
| Claim | Web | owner/project | UPLOADING/WRITING/STAGING | none | lifecycle | abort | two PUT |
| Stage | Broker | Broker client | WRITING/STAGING | exclusive write | close/identity | retain | heartbeat |
| Close | Broker | Broker client | READY/STAGING_READY | sync/close/reopen | close evidence | fail closed | lease |
| Prepare | Web/DB | generation CAS | FINALIZING/PREPARED | none | operation | ABANDONED/FAILED | finalizers |
| Execute | Web/DB | EXECUTING authority | EXECUTING | Broker capability | session | UNKNOWN | stale worker |
| Publish | Broker | Broker service | FINALIZING | CREATE_NEW/copy/seal | publication evidence | retain/UNKNOWN | two recovery |
| Evidence | Broker/DB definer | restricted writer | evidence | none | immutable evidence | T6E fail | duplicate |
| T7 | Web/DB | File lock | ACTIVE/COMPLETED | none | FileVersion/audit | COMMIT unknown | recovery |
| Read | Web/Broker | file.read | ACTIVE + one FV | verified read | audit | block | replacement |
| Drain | Deployment | service/ACL | no old v2 writes | no old process | D0-D10 | block/retain | old cleanup |

## 13. Fault Injection Matrix

| ID | Scenario | Wrong result | Allowed | Forbidden | Final |
|---|---|---|---|---|---|
| F1 | two Recovery Workers | both terminalize | one CAS/session | two effects | one result |
| F2 | old Worker late | writes/publishes | reject generation | apply old | UNKNOWN/retained |
| F3 | Broker restart | old capability works | revoke/reacquire | reuse old | AUTHORITY_DENIED |
| F4 | DB unavailable | Broker continues | stop/UNKNOWN | APPLIED | retained |
| F5 | capability replay | second publish | deny/audit | consume twice | no effect |
| F6 | Evidence insert fails | ACTIVE without evidence | retain/reverify | FileVersion | no active |
| F7 | target replaced | reads target B | identity mismatch/fail | overwrite | no read |
| F8 | legacy queue replay | old job runs | block/stop | process old | no old task |
| F9 | inherited handle | writes v2 | handle probe/drain | ACL-only claim | blocked |
| F10 | rollback cleanup | deletes v2 | deny/retain | restore broad ACL | blocked/retained |
| F11 | PREPARED crash | tries UNKNOWN | ABANDONED/FAILED | PREPARED→UNKNOWN | no target |
| F12 | EXECUTING crash | assumes no effect | UNKNOWN + probe | cleanup | retained |
| F13 | Evidence/T7 split | duplicate FV | same T7 retry | rewrite evidence | one evidence/FV |
| F14 | canonical missing | serves empty/other | integrity failed | replace object | blocked |

## 14. User Decision Register

### A. Derived Invariants

- A-01: PREPARED timeout does not become UNKNOWN.
- A-02: hard link/rename/path equality is not publication proof.
- A-03: DB lease does not close a handle.
- A-04: no active FileVersion without evidence.
- A-05: unmapped legacy data is not guessed into a new chain.
- A-06: R5/BV7/BV8/R8 statuses remain unchanged.

### B. Recommended, User Approval Required

| ID | Recommendation | Cost/changeability |
|---|---|---|
| B-01 | Native Storage Authority Broker | high implementation cost; hard boundary |
| B-02 | DB-authoritative session + Broker restricted DB access | DB role/credentials |
| B-03 | SECURITY DEFINER Evidence ingestion, no signing key in v1 | function/role ownership |
| B-04 | same local NTFS volume | limited deployment |
| B-05 | 30s/120s lease baseline | tuning |
| B-06 | new Attempt for known failure; same Operation for exact UNKNOWN | retained objects |
| B-07 | separate legacy archive/read-only API | data policy |
| B-08 | D0–D10 drain before v2 | downtime |
| B-09 | separate Web/Worker/Broker/Maintenance/Definer/Recovery roles | provisioning |

### C. Evidence Missing

- Windows Named Pipe/SID/ACL behavior.
- Windows File ID/Volume/Reparse/handle-close behavior.
- Actual Broker service and restart behavior.
- Old Worker/scheduler/queue/cleanup inventory.
- Actual `.next`/`dist` runtime references.
- Actual historical data mapping and close evidence.
- PostgreSQL Trigger/COMMIT/deadlock behavior.
- v2 root/parent/target ACL behavior.
- Queue replay, handle release and drain rollback.

## 15. R5 / BV7 / BV8 / R8

```text
R5 independent review: FAIL — DESIGN CORRECTIONS REQUIRED
R5 Open Decisions: 57/57 OPEN; 0 approved
BV7: FAIL — BLOCKING DESIGN CORRECTIONS REQUIRED
BV8: READY FOR INDEPENDENT REVIEW; NOT APPROVED
R8: BLOCKED — REQUIRED DESIGN EVIDENCE MISSING
```

No status is changed. The new Broker is separate from R4/R5 Termination
Host/Worker/Helper authority and trust roots.

## 16. Remaining Risks and Blockers

| ID | Severity | Status |
|---|---|---|
| R4-P1-01 | P1 | Evidence ingestion/authority DB role not implemented |
| R4-P1-02 | P1 | Windows native identity/seal proof not present |
| R4-P1-03 | P1 | Broker service/IPC/ACL not present |
| R4-P1-04 | P1 | Recovery CAS/owner migration not executable in current schema |
| R4-P1-05 | P1 | Historical data/legacy archive not verified |
| R4-P1-06 | P1 | Legacy drain/v2 isolation not executed |
| R4-P2-01 | P2 | Exact Schema/Migration not implemented |
| R4-P2-02 | P2 | Fixtures/fault hooks not implemented |
| R4-P2-03 | P2 | Normal read evidence integration not implemented |
| R4-P3-01 | P3 | Environment-specific Windows evidence labels absent |

Hard stop:

```text
NO source implementation
NO Schema/Migration
NO Native Broker Build
NO Windows ACL/service changes
NO Storage publish/read
NO Worker Drain
NO deployment
```

## 17. Git and Non-Action Record

At start:

```text
Branch: codex/public-github-sync
HEAD: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified: 0
Staged: 0
Deleted: 0
Untracked: 10
```

The final state is recorded in the delivery message. This report adds one
untracked file. Existing `$null`, `UNKNOWN'`, WP-1/WP-1R/WP-1C/WP-1C-R/WP-1D/
WP-1D-R reports, `__pycache__/` and the baseline report remain untouched.

No source, Schema, Migration, Trigger, configuration or test was modified.
No database, Storage, Windows ACL, service, E2E, Build, Native RPC or drain
was executed. `$null`, `.next`, `.dist` and `UNKNOWN'` were not read,
modified, moved or deleted.

## 18. Final Design Verdict

```text
Protocol design:
  PASS WITH WARNINGS — PROTOCOL DESIGN COMPLETE

P1-04:
  CLOSED AT DESIGN — owner/generation/CAS and lock order specified

P1-01 / P1-02:
  CLOSED AT DESIGN — one Evidence chain and Windows identity protocol specified

P1-03:
  CLOSED AT DESIGN — one DB-authoritative session and Named Pipe capability protocol

P1-05:
  CLOSED AT DESIGN — legacy archive and API isolation specified

P1-06:
  CLOSED AT DESIGN — queue, handle, rollback and post-switch evidence specified

Implementation:
  BLOCKED — DB roles/Migration, Native Broker, Windows probes, actual data and
  drain evidence do not exist

Independent review:
  REQUIRED
```

This is the mandatory stop point. Do not implement source, apply Schema or
Migration, build/start the Broker, change ACLs, execute drain, access Storage
or deploy without separate authorization.
