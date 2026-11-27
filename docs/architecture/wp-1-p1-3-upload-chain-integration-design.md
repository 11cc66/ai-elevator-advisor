# WP-1 — P1-3 Upload Chain Integration Design

## 0. Document Control

```text
Task: WP-1
Mode: READ-ONLY INVESTIGATION / DESIGN ONLY
Execution date: 2026-11-25, Asia/Hong_Kong
Repository: D:\thinkbook\Desktop\jieya
Remote: https://github.com/11cc66/ai-elevator-advisor.git
Initial branch: codex/public-github-sync
Initial HEAD: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
Initial origin/main: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
Overall disposition: PASS WITH WARNINGS
Implementation authorization: NOT GRANTED
```

This document is an integration design. It is not source implementation,
Migration authorization, database proof, Storage proof, deployment approval or
a new lifecycle exception.

Evidence labels used below:

```text
FACT
  Directly proven by the current source, schema, Migration or command output.

DESIGN RECOMMENDATION
  Proposed implementation contract derived from the frozen lifecycle design and
  the current source gaps.

UNVERIFIED ASSUMPTION
  Requires a real test database, filesystem, Windows API or independent review.

USER DECISION REQUIRED
  Must not be approved by this report.
```

### 0.1 Skills Applied

The task routing and these Skill bodies/references were read and applied:

| Skill | Applied purpose |
|---|---|
| `$project-architecture` | preserve Web, Worker, storage, lifecycle and database boundaries |
| `$prisma-db-safety` | transaction, CAS, lock, constraint and state-machine review |
| `$security-audit` | authorization, tenant isolation, response loss, stale owner and evidence attacks |
| `$testing-and-verification` | separate static design evidence from database/filesystem execution |
| `$file-lifecycle` | preserve immutable lifecycle evidence, object identity, fencing and fail-closed behavior |

## 1. Executive Summary

### 1.1 Result

```text
WP-1 investigation and design:
PASS WITH WARNINGS

Current upload source compatible with P1-3:
NO

Current web TypeScript check:
FAIL

P1-3 application upload chain:
NOT IMPLEMENTED

Current database behavior verified by this task:
NOT EXECUTED — DATABASE ACCESS NOT AUTHORIZED

Current filesystem identity/no-overwrite behavior verified by this task:
NOT EXECUTED — STORAGE ACCESS NOT AUTHORIZED

Implementation authorization:
NOT GRANTED
```

`PASS WITH WARNINGS` applies only to the completeness and reviewability of this
design. It is not a runtime PASS and not an implementation-ready verdict.

### 1.2 Principal Findings

1. **FACT:** The ordinary upload path still uses the legacy Intent-level
   `stagingKey` and an `fs.rename()` finalize path.
2. **FACT:** The application creates no `FileUploadAttempt`,
   `StorageObjectLifecycle`, or `StorageObjectOperation`; repository search over
   `apps/` and `packages/` returns no application references to these Prisma
   models.
3. **FACT:** `FileVersion.create()` in the current upload transaction omits the
   required `uploadIntentId`, `uploadAttemptId`, and
   `creationOperationAttemptId` fields. The read-only TypeScript check fails on
   those fields and on nullable legacy `stagingKey` use.
4. **FACT:** The P1-3 schema already requires a completed Attempt, an APPLIED
   FINALIZE Operation, an ACTIVE CANONICAL Lifecycle, and a matching immutable
   FileVersion chain. The current path cannot satisfy those constraints.
5. **FACT:** The current local storage write closes the handle but does not
   expose a close attestation with dev/ino identity, fsync evidence, writer
   generation, or attempt ownership. The current finalize path checks target
   existence and then calls `fs.rename()`, which is not the frozen hard-link
   no-overwrite protocol.
6. **FACT:** The current tests still encode the legacy chain. Several direct
   `fileVersion.create()` fixtures and the Phase 3.2 upload tests fail the
   current TypeScript type boundary.
7. **DESIGN RECOMMENDATION:** Create a P1-3-aware upload lifecycle service with
   separate short database transactions around a streamed file write and a
   persisted FINALIZE Operation. No database transaction may span the request
   stream.
8. **DESIGN RECOMMENDATION:** Use a `GET` upload-intent status endpoint and
   idempotent `PUT` replay so response loss can be resolved from durable state,
   not by guessing whether a database COMMIT or filesystem publish occurred.
9. **UNVERIFIED ASSUMPTION:** Identity-verified close attestation and
   no-overwrite publication remain implementation-sensitive on Windows. The
   exact publication primitive must be tested on the supported local NTFS
   volume before production enablement.
10. **FACT:** R5 has 57 Open Decisions, all still `OPEN`, with zero user
    approvals. BV7 remains `FAIL`; BV8 and R8 are not approved independent
    baselines. None is treated here as implementation authority.

### 1.3 Implementation Gate

The next separate implementation authorization must at minimum cover:

- a safe storage close-attestation and no-overwrite publication capability;
- P1-3-aware upload transaction/repository code;
- upload and download route integration;
- permission, response-loss, timeout, stale-owner and negative tests;
- dedicated test-database and isolated filesystem validation;
- required positive and negative typecheck.

This report does not authorize any of those changes.

## 2. Current Upload Call Chain

### 2.1 Intent Creation

**FACT — request route**

- `apps/web/src/app/api/projects/[projectId]/files/upload-intents/route.ts:35`
  calls `requireProjectPermission(..., PERMISSIONS.FILE_UPLOAD)`.
- The same route calls `assertSameOrigin` at line 40 and
  `createUploadIntent` at line 55.
- The route requires an `Idempotency-Key` and calls `getPrivateStorage()` at
  line 60.

**FACT — service**

- `apps/web/src/modules/files/upload-service.ts:155` begins
  `createUploadIntent`.
- Lines 43–143 validate the project, building, installation unit and optional
  existing File ownership graph with service-level queries.
- Lines 197–214 create one legacy staging key and store it on
  `FileUploadIntent.stagingKey`.
- `apps/web/src/modules/files/upload-service.ts:200` creates only
  `FileUploadIntent`. It creates no Attempt and no Lifecycle.
- The idempotency lookup uses `(uploadedById, requestKey)` and compares a
  content fingerprint. A concurrent P2002 insert race is resolved by re-reading
  the same idempotency key.

**Current durable state**

```text
file_upload_intent:
  PENDING
  currentAttemptId = NULL
  stagingKey = legacy field populated
  objectStorageKey = NULL

file_upload_attempt:
  no row

storage_object_lifecycle:
  no row

storage_object_operation:
  no row
```

The frozen ordinary creation protocol instead permits a PENDING Intent only
when there is no open Attempt. This means the legacy field is merely an
unowned path string; it is not a P1-3 reservation.

### 2.2 Content Upload

**FACT — request route**

- `apps/web/src/app/api/projects/[projectId]/files/upload-intents/[intentId]/content/route.ts:37`
  applies project permission.
- Line 42 applies same-origin protection.
- Lines 52–58 parse `Content-Length` and `Content-Type`.
- Line 60 calls `completeUpload`.

**FACT — service claim**

- `apps/web/src/modules/files/upload-service.ts:267` begins `completeUpload`.
- Lines 274–310 query the Intent and require the same `projectId` and
  `uploadedById`.
- A repeated request for an already `COMPLETED` Intent returns the stored
  FileVersion and latest Extraction.
- Lines 359–369 CAS `PENDING -> UPLOADING` with `claimedAt`.
- This transition does not create a `FileUploadAttempt`, does not set
  `currentAttemptId`, and does not create a `StorageObjectLifecycle`.
- Under the P1-3 chain Trigger, an Intent in `UPLOADING` must have exactly one
  open Attempt and a non-null `currentAttemptId`; therefore the legacy claim is
  incompatible with the installed P1-3 schema.

**FACT — stream and content validation**

- `apps/web/src/modules/files/upload-service.ts:384` calls
  `writeToStaging(intent.stagingKey, source, MAX_FILE_SIZE_BYTES)`.
- The legacy `stagingKey` is nullable in the current Prisma type. The read-only
  TypeScript check reports errors at lines 385 and 441 because the service
  passes `string | null` where `string` is required.
- `apps/web/src/modules/files/upload-service.ts:390` checks streamed size.
- The route/service checks declared MIME, actual signature and filename/MIME
  consistency.

**FACT — canonical claim and publication**

- `apps/web/src/modules/files/upload-service.ts:422` stores the canonical key
  on `FileUploadIntent.objectStorageKey`.
- `apps/web/src/modules/files/upload-service.ts:441` calls the legacy
  `storage.finalize(intent.stagingKey, objectKey)`.
- The current filesystem implementation at
  `packages/file-storage/src/local-private-storage.ts:172` resolves both paths,
  checks target existence at line 177, and calls `fs.rename()` at line 191.
- There is a check-then-rename window and no persisted FINALIZE Operation,
  canonical target identity verification, hard-link no-overwrite protocol or
  post-publication hash verification.

### 2.3 Database Finalization

**FACT**

- `apps/web/src/modules/files/upload-service.ts:443` starts the only upload
  business transaction.
- It creates or reuses a File, computes the next version number, creates a
  FileVersion, creates the first Extraction, updates the File current version,
  completes the Intent and appends an AuditLog.
- `apps/web/src/modules/files/upload-service.ts:474` creates the FileVersion.
- That create input omits `uploadIntentId`, `uploadAttemptId`, and
  `creationOperationAttemptId`.
- The read-only TypeScript check therefore reports:

```text
src/modules/files/upload-service.ts(475,11):
  missing uploadIntentId, uploadAttemptId, creationOperationAttemptId
```

- No canonical Lifecycle, FINALIZE Operation, Attempt terminal state, or staging
  lifecycle DELETED transition is written.
- The File row is not locked before `versionNumber` is calculated. Concurrent
  existing-file uploads can compete for the same next number; the unique
  `(fileId, versionNumber)` constraint may reject one request, but the service
  has no deterministic retry or File-row serialization contract.

### 2.4 Error Handling

**FACT**

- `markIntentFailed()` at
  `apps/web/src/modules/files/upload-service.ts:251` changes only Intent state.
- The catch at line 599 does not reconcile Attempt, Lifecycle or Operation.
- The catch logs that physical artifacts are retained and no cleanup is
  performed.
- `cleanupExpiredUploadIntents()` at line 147 always raises
  `LegacyStorageCleanupDisabledError`.

This retention is directionally safe, but without persisted lifecycle evidence
the system cannot distinguish `never created`, `partial write`, `closed
staging`, `published canonical`, and `database commit unknown`.

### 2.5 Current File Access

**FACT**

- `apps/web/src/app/api/projects/[projectId]/files/[fileId]/versions/[versionId]/content/route.ts`
  applies `file.read` project permission before calling
  `prepareFileDownload`.
- `apps/web/src/modules/files/download-service.ts:242` finds the File by
  `fileId + projectId`.
- Line 261 finds the FileVersion by `versionId + fileId`.
- Lines 282–305 evaluate upload, validation, integrity and malware-scan policy.
- Line 440 reads the full verified object into a bounded Buffer.
- Lines 479–489 mark integrity VERIFIED and append a download audit.

The current download path verifies storage size and checksum, but it does not
join or require:

```text
StorageObjectLifecycle.objectKind = CANONICAL
StorageObjectLifecycle.state = ACTIVE
StorageObjectLifecycle.storageKey = FileVersion.storageKey
```

The database Trigger prevents a malformed FileVersion insert, but normal access
should still verify the lifecycle relation explicitly instead of relying on the
historical insert-time invariant alone.

## 3. Current Schema and Application Mapping

### 3.1 Prisma Models

| Object | Current schema evidence | Current application evidence | Integration status |
|---|---|---|---|
| `File` | `prisma/schema.prisma:367` | Created by the legacy final transaction | Reusable business owner; needs row serialization |
| `FileVersion` | `prisma/schema.prisma:398` | Created without chain fields | Type-incompatible |
| `FileUploadIntent` | `prisma/schema.prisma:501` | Created with legacy `stagingKey` | Partially compatible |
| `FileUploadAttempt` | `prisma/schema.prisma:548` | No application use | Not implemented |
| `StorageObjectLifecycle` | `prisma/schema.prisma:577` | No application use | Not implemented |
| `StorageObjectOperation` | `prisma/schema.prisma:627` | No application use | Not implemented |
| `AuditLog` | `prisma/schema.prisma:785` | Used in current final transaction | Reusable |

### 3.2 Required FileVersion Fields

**FACT**

- `prisma/schema.prisma:409` requires non-null `uploadIntentId`.
- `prisma/schema.prisma:410` requires unique non-null `uploadAttemptId`.
- `prisma/schema.prisma:411` requires unique non-null
  `creationOperationAttemptId`.
- `prisma/schema.prisma:431` requires the `storageKey` to reference a
  `StorageObjectLifecycle`.

### 3.3 Attempt and Lifecycle Relations

**FACT**

- Each Attempt has one required staging lifecycle and an optional canonical
  lifecycle.
- The Intent can point to one current Attempt and one completed FileVersion.
- A canonical Lifecycle points to one current Operation.
- The Operation points back to the same Lifecycle and storage key.

### 3.4 Database Guards

**FACT — lifecycle initial states**

`prisma/migrations/20261117140000_phase37_p13_lifecycle_initial_state_guard/migration.sql`
limits ordinary Lifecycle INSERTs to:

```text
STAGING   -> STAGING_RESERVED
CANONICAL -> FINALIZING
```

**FACT — Attempt and Operation transitions**

- `prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:603`
  protects Attempt identity and its transition whitelist.
- Lines 925–1006 protect Operation identity and terminal immutability.
- Lines 1194–1357 assert Intent/Attempt/FileVersion completion cardinality.

**FACT — currentOperation and owner consistency**

- Lines 1010–1142 require an active Operation to be the Lifecycle current
  Operation and require owner token, generation and lease equality.
- Lines 1466–1527 require FINALIZING to have an active FINALIZE Operation and
  ACTIVE to have an APPLIED FINALIZE Operation.

**FACT — FileVersion chain**

- Lines 1797–1805 require ACTIVE exactly-one-FileVersion bijection.
- Lines 1824–1862 require the FileVersion to reference ACTIVE CANONICAL,
  COMPLETED Attempt and APPLIED FINALIZE.
- Lines 1905–1943 repeat the critical storage/Attempt/Operation checks before
  INSERT.

### 3.5 Migration Coverage Gaps

**FACT**

- The P1-3 schema migration refuses non-empty historical `file_version` or
  `file_upload_intent` tables unless a separately approved backfill exists.
- The application and test fixtures have not been converted to the new chain.
- The existing Phase 3.2 integration and E2E tests assert legacy
  `intent.stagingKey`, `objectStorageKey`, and Intents without Attempts.

**UNVERIFIED ASSUMPTION**

The current deployed/test database state cannot be inferred from source.
Database catalog state and historical row compatibility are outside this task.

## 4. Target Upload Flow

### 4.1 Public Request Contract

Recommended minimal API contract:

```text
POST /api/projects/{projectId}/files/upload-intents
  Idempotency-Key: required
  -> creates one PENDING Intent
  -> returns Intent id, PENDING status, expiry and content upload path

PUT /api/projects/{projectId}/files/upload-intents/{intentId}/content
  -> claims Intent and creates a new Attempt on first body upload
  -> streams exact declared bytes
  -> returns completed FileVersion summary or a durable in-progress/recovery state

GET /api/projects/{projectId}/files/upload-intents/{intentId}
  -> authorized uploader/project status lookup
  -> returns Intent/Attempt/Operation summary without storageKey or owner token
```

`DESIGN RECOMMENDATION`: Add the status endpoint so response-loss recovery does
not require resending file bytes. The route must require `file.upload` and
return 404 for an Intent owned by another user.

### 4.2 Step A — Create Intent

1. Authenticate the API actor.
2. Re-check `file.upload` permission in the service, not only the route.
3. Validate project/customer, building/project, installation-unit/building and
   optional existing-File/customer/project/building/unit relationships.
4. Require a valid Idempotency-Key and parse the explicit size/MIME contract.
5. Compute the request fingerprint.
6. In one short transaction:
   - resolve an existing `(uploadedById, requestKey)` Intent;
   - reject a different fingerprint with 409;
   - otherwise create a PENDING Intent;
   - write `stagingKey = NULL` and `objectStorageKey = NULL` on the new row.
7. A concurrent P2002 race must re-read and compare the fingerprint.

No filesystem object is created by Intent creation.

### 4.3 Step B — Claim Attempt and Create Staging Lifecycle

On the first `PUT`:

1. Lock the Intent row.
2. Revalidate actor, project, expiry and the immutable target fields.
3. Require `PENDING`, `currentAttemptId = NULL`, and no open Attempt.
4. Re-check the existing File and target graph.
5. Generate:
   - Attempt id;
   - staging key `staging/<intentId>/<attemptId>.part`;
   - owner token with at least 256 bits of cryptographic entropy;
   - fencing generation 1;
   - a finite lease expiry after the final lock.
6. In one transaction create:
   - `FileUploadAttempt(RESERVED)`;
   - `StorageObjectLifecycle(STAGING, STAGING_RESERVED)`;
   - final transition to Attempt `WRITING`, Lifecycle `STAGING`;
   - Intent `UPLOADING` with `currentAttemptId`.
7. Commit before opening the staging file.

The owner token must never be logged or returned to the browser.

### 4.4 Step C — Stream to Staging

1. Open the exact staging key with exclusive create (`wx` or equivalent).
2. Write only while the Attempt, owner token, generation and lease still match.
3. Enforce the 20 MiB limit during streaming.
4. Compute SHA-256 while streaming and retain at most the required signature
   header bytes.
5. On normal end, flush/sync where supported, close the handle, and prove the
   close result.
6. Re-open or stat through a non-following metadata path and verify:
   - regular file;
   - no reparse/symlink at the final component;
   - size equals the declared and written size;
   - SHA-256 equals the streamed checksum;
   - stable dev/ino identity matches the reopened metadata.
7. Persist a complete close attestation and transition:
   - staging Lifecycle `STAGING -> STAGING_READY`;
   - Attempt `WRITING -> READY`;
   - Intent remains `UPLOADING`.

The database cannot prove that every OS handle is closed. The application
attestation must therefore be restricted to the trusted upload component and
must fail closed if the close or identity checks are unknown.

For successful upload, the target requires
`closedIdentityVerified = true`. Although the current schema can represent a
non-identity-verified close attestation while an object is merely READY, the
ordinary `DELETED` staging transition requires an identity-verified snapshot.
An environment that cannot provide that proof must retain the object and stop;
it must not claim upload completion.

### 4.5 Step D — Prepare FINALIZE

After the staging close attestation:

1. Generate a fresh canonical key `objects/<random UUID>.<extension>`.
2. Open a short transaction and obtain a transaction-scoped storage-key lock in
   canonical key order.
3. Revalidate that the Attempt is still READY and the Intent is still
   UPLOADING under the same owner/generation.
4. Insert a CANONICAL Lifecycle in `FINALIZING` with:
   - owner token;
   - generation;
   - lease;
   - size and checksum;
   - `currentOperationId`;
   - no reserved Attempt/Intent owner fields.
5. Insert the FINALIZE Operation with:
   - the same storage key, Lifecycle, owner and generation;
   - source Attempt;
   - source path = staging key;
   - target path = canonical key;
   - expected size and checksum;
   - state `PREPARED`.
6. Transition Attempt `READY -> FINALIZING` and set its
   `canonicalStorageKey`.
7. Commit.
8. In a separate CAS update, transition Operation `PREPARED -> EXECUTING`.

No filesystem publication occurs before the durable EXECUTING transition.

### 4.6 Step E — Publish Without Overwrite

The storage capability must expose a publication primitive equivalent to:

```text
publishClosedStagingToCanonical({
  attemptId,
  ownerToken,
  fencingGeneration,
  stagingKey,
  canonicalKey,
  expectedSizeBytes,
  expectedChecksumSha256,
  expectedStagingIdentity
})
```

Required behavior:

1. Revalidate staging identity, size and hash against the close attestation.
2. Reject reparse/symlink paths and unsupported filesystems.
3. Create the target without overwriting an existing object.
4. Prefer hard-link publish followed by target identity verification and
   explicit staging unlink:

```text
link(staging, target)
-> verify target identity equals staged closed object
-> verify target size and SHA-256
-> unlink(staging)
```

5. If the target already exists:
   - same staged object and same verified content may continue only under the
     exact frozen recovery rules;
   - a different identity or hash is `FAILED_RETAINED`/UNKNOWN and must not be
     overwritten or deleted.
6. If hard-link or identity semantics are unavailable, stop.

`USER DECISION REQUIRED`: approve the exact hard-link or copy-on-publish
primitive after Windows/NTFS tests. A normal rename is not acceptable merely
because it exists.

### 4.7 Step F — Final Database Transaction

After publication and staging unlink are proven:

```text
Operation:              EXECUTING -> APPLIED
CANONICAL Lifecycle:    FINALIZING -> ACTIVE
Attempt:                FINALIZING -> COMPLETED
STAGING Lifecycle:      STAGING_READY -> DELETED
FileVersion:            INSERT with complete P1-3 chain
File:                   currentVersionId update under row serialization
FileExtraction:         INSERT first QUEUED extraction
Intent:                 UPLOADING -> COMPLETED
AuditLog:               append in the same transaction
```

FileVersion values come from the close attestation and the verified canonical
object:

```text
uploadIntentId              = Intent.id
uploadAttemptId             = Attempt.id
creationOperationAttemptId  = FINALIZE Operation.id
storageKey                  = CANONICAL storageKey
sizeBytes                   = verified canonical size
checksumSha256              = verified canonical SHA-256
uploadStatus                = UPLOADED
validationStatus            = PASSED only after all validations succeed
integrityStatus             = VERIFIED only after canonical identity/hash proof
malwareScanStatus           = current policy value, not inferred CLEAN
```

The canonical object creation and database state are not atomic. The Operation
is the durable recovery record between them.

### 4.8 Step G — Queue Dispatch

After the final DB COMMIT, dispatch the extraction job.

- A queue failure does not roll back the committed FileVersion.
- The Extraction remains `QUEUED`; existing recovery/retry behavior applies.
- The upload response may be returned only after the database result is
  durable. Queue enqueue failure may be reported as a warning state, not as
  physical upload failure.

## 5. State Transition Design

### 5.1 Intent

```text
PENDING
  -> UPLOADING
  -> COMPLETED

PENDING / FAILED
  -> EXPIRED

UPLOADING
  -> PENDING       only after the current Attempt is ABANDONED/FAILED
  -> COMPLETED
  -> FAILED
  -> EXPIRED
```

Invariants:

```text
PENDING     currentAttemptId NULL, open Attempts 0, FileVersions 0
UPLOADING   currentAttemptId set, open Attempts 1, FileVersions 0
COMPLETED   currentAttemptId NULL, COMPLETED Attempts 1, FileVersions 1
FAILED      currentAttemptId NULL, open Attempts 0, FileVersions 0
EXPIRED     currentAttemptId NULL, open Attempts 0, FileVersions 0
```

### 5.2 Attempt

```text
RESERVED
  -> WRITING
  -> READY
  -> FINALIZING
  -> COMPLETED

RESERVED / WRITING / READY
  -> ABANDONED
  -> FAILED

FINALIZING
  -> RECOVERY_REQUIRED
  -> COMPLETED

RECOVERY_REQUIRED
  -> COMPLETED
  -> FAILED
```

`FINALIZING` must not go directly to ABANDONED.

### 5.3 Staging Lifecycle

```text
STAGING_RESERVED
  -> STAGING
  -> STAGING_READY
  -> DELETED

STAGING
  -> STAGING_ABANDONED

STAGING_READY
  -> STAGING_ABANDONED

STAGING_ABANDONED
  -> DELETED
```

For ordinary upload in this report, only the success path to `DELETED` is
designed. Quarantine and maintenance transitions are outside scope.

### 5.4 Canonical Lifecycle

```text
FINALIZING
  -> ACTIVE
  -> FAILED_RETAINED
```

Only the normal `FINALIZING -> ACTIVE` path is in scope. ACTIVE with a
FileVersion cannot leave ACTIVE.

### 5.5 FINALIZE Operation

```text
PREPARED
  -> EXECUTING
  -> APPLIED

PREPARED / EXECUTING
  -> FAILED

EXECUTING
  -> UNKNOWN

UNKNOWN
  -> APPLIED
  -> FAILED
```

UNKNOWN is not a failure to be cleaned automatically. It requires exact
filesystem and database reconciliation.

### 5.6 Success State Matrix

| Stage | Intent | Attempt | Staging Lifecycle | Canonical Lifecycle | Operation |
|---|---|---|---|---|---|
| Intent created | PENDING | none | none | none | none |
| Claimed | UPLOADING | WRITING | STAGING | none | none |
| File written and closed | UPLOADING | READY | STAGING_READY | none | none |
| Finalize prepared | UPLOADING | FINALIZING | STAGING_READY | FINALIZING | PREPARED/EXECUTING |
| Object published, DB pending | UPLOADING | FINALIZING | STAGING_READY | FINALIZING | EXECUTING/UNKNOWN |
| Upload complete | COMPLETED | COMPLETED | DELETED | ACTIVE | APPLIED |

## 6. Database Transaction Boundaries

### 6.1 Required Split

The request stream must run outside any long-lived database transaction.

| Boundary | Database work | Filesystem work | Atomicity claim |
|---|---|---|---|
| T0 Intent | Find/create Intent | none | DB-only transaction |
| T1 Claim | Create Attempt/Lifecycle; activate Intent | none | DB-only transaction |
| T2 Write | optional lease heartbeat CAS | stream and close staging | no DB/FS atomicity |
| T3 Ready | persist close attestation; Attempt READY | none | DB-only transaction |
| T4 Prepare | create canonical FINALIZING + FINALIZE PREPARED; Attempt FINALIZING | none | DB-only transaction |
| T5 Execute | Operation PREPARED -> EXECUTING | none | DB-only CAS |
| T6 Publish | none | no-overwrite publish and staging unlink | no DB atomicity |
| T7 Complete | Operation APPLIED, Lifecycle ACTIVE, Attempt COMPLETED, staging DELETED, FileVersion/File/Extraction/Intent/Audit | none | one DB transaction |

### 6.2 Lock Order

**DESIGN RECOMMENDATION**

All ordinary upload mutations that can touch more than one row use:

```text
transaction-scoped storage-key advisory lock(s) in lexical order
-> Intent row
-> Attempt row
-> staging Lifecycle row
-> canonical Lifecycle row
-> current Operation row
-> File row, when the version belongs to an existing File
```

All advisory locks must be acquired in sorted storage-key order before row
locks. No path may select, update or insert an open Attempt/Operation without
the same prefix locks.

The current application has no such lock order. The database behavior test plan
records application lock order as `NOT IMPLEMENTED`.

### 6.3 Lease and Fencing

- Claim uses a fresh owner token and generation.
- Every state-changing CAS checks owner token, generation and unexpired lease.
- A lease expiry never proves that the old writer stopped.
- A new owner cannot take over by deleting or rewriting the old staging object.
- The upload request should update the lease only through a CAS; if heartbeat
  fails, it must stop reading and accepting more bytes.
- A stale owner must receive 409/UNKNOWN and perform no cleanup.

### 6.4 Expiry Decision Time

`DESIGN RECOMMENDATION`: sample authoritative time only after the final
Intent/Attempt row lock. Do not sample time, wait for a lock, then use the stale
sample to claim or expire the Attempt.

### 6.5 Retryable Database Errors

- `40001` serialization failure and `40P01` deadlock may be retried only around
  a complete database-only transaction.
- The retry must re-read all state.
- Never retry the filesystem publish inside a database retry loop.
- COMMIT-unknown is not a normal serialization retry.

## 7. Concurrency and Idempotency

### 7.1 Intent Idempotency

The durable idempotency tuple is:

```text
(FileUploadIntent.uploadedById, FileUploadIntent.requestKey)
```

Rules:

```text
same key + same fingerprint -> same Intent
same key + different fingerprint -> 409
concurrent insert + same fingerprint -> re-read and return same Intent
concurrent insert + different fingerprint -> 409
```

### 7.2 One Open Attempt

The database partial unique index permits one open Attempt per Intent. The
application should not emulate retry by leaving the old Attempt open.

```text
first concurrent PUT -> creates Attempt A
second concurrent PUT -> sees UPLOADING/A and returns 409
```

After a proven abandonment/failure and correct Intent transition to PENDING, a
later PUT may create Attempt B with a new staging key.

### 7.3 Existing File Version Serialization

For `existingFileId`:

1. Lock the File row.
2. Revalidate File customer/project/building/unit ownership.
3. Compute `max(versionNumber) + 1`.
4. Insert FileVersion under the same transaction.
5. Update `currentVersionId` using the lock-protected current state.
6. Retry only on a recognized serialization/deadlock or a provably equivalent
   database conflict; do not synthesize a new Attempt.

For a new File, the File row is created inside T7, so no unrelated File can
compete for that new row.

### 7.4 Operation Uniqueness

The database permits at most one active Operation per storage key. The
application must reuse the existing FINALIZE Operation for the same Attempt:

```text
same Intent/Attempt/Operation + same expected identity -> reconcile/read result
different Attempt or different expected content -> conflict; no second publish
```

### 7.5 Stale Finalizer

A stale request or old Worker may still run OS code after losing the database
lease. The database generation only fences database writes. It cannot retract
an already issued filesystem call.

Required behavior:

- stale writes lose CAS and stop;
- no retry under a new generation against the same staging/canonical object;
- if a late filesystem result is possible, mark UNKNOWN and require exact
  object reconciliation;
- do not assume a closed database connection stopped the old process.

### 7.6 Physical Deletion Race

Physical canonical deletion is not part of WP-1. The current Web capability has
no delete method, and the Worker is read-only. Therefore ordinary upload and
download must not introduce a delete/CAS dependency.

A future maintenance/purge design must independently guarantee:

```text
no FileVersion can be inserted after deletion eligibility is decided
the deletion Operation and reference check share the same storage-key lock
deletion never relies on an expired lease or a stale reference snapshot
```

Those rules come from the frozen lifecycle design, but their implementation is
currently blocked and is not authorized by this report.

## 8. Response-Loss Handling

### 8.1 POST Intent Response Loss

The client retries the same Idempotency-Key. The service returns the existing
Intent if the fingerprint matches. No duplicate Attempt or file is created.

### 8.2 PUT Response Loss Before Commit

The durable state determines the response:

| Durable state | Response |
|---|---|
| PENDING | 202 / retry content upload |
| UPLOADING + active Attempt | 409 `UPLOAD_IN_PROGRESS` |
| Attempt READY + FINALIZE PREPARED | resume the exact finalization path |
| Attempt FINALIZING + Operation EXECUTING | 202 / reconcile, do not resend body |
| Operation UNKNOWN | 202/409 `FINALIZATION_UNKNOWN`, retain artifacts |
| Intent COMPLETED | 200 with same FileVersion/Extraction summary |
| Intent FAILED/EXPIRED | stable terminal error |

### 8.3 Status Endpoint

The status endpoint is the preferred recovery interface:

```text
GET /api/projects/{projectId}/files/upload-intents/{intentId}

response:
  intentStatus
  attemptStatus
  attemptId
  operationState
  recoveryRequired
  fileVersion summary when completed
  safe failureCode
```

It must not return:

```text
ownerToken
stagingKey
canonical storageKey
filesystem path
raw operation evidence
```

### 8.4 COMMIT Lock

```
FS publish result known and successful
-> commit final transaction
-> if COMMIT response lost, query the exact Operation/Attempt/Intent/FileVersion
-> if committed, return the durable result
-> if not committed, set Operation UNKNOWN only through CAS
-> do not delete canonical and do not create a second FileVersion
```

### 8.5 Response Loss After Success

Because `FileUploadIntent.completedFileVersionId` is unique and durable, a
replayed request can return the same FileVersion after verifying:

- Intent ownership and project;
- FileVersion belongs to the Intent and Attempt;
- canonical Lifecycle is ACTIVE;
- the FileVersion's storage object still matches the recorded size/hash.

## 9. Timeout and Failure Recovery

### 9.1 Claim Timeout

- Client abort before staging open: Attempt/Lifecycle may be moved to
  ABANDONED/STAGING_ABANDONED; Intent may return to PENDING only under the
  state matrix.
- Intent expiry: terminalize to EXPIRED only under a locked, CAS-protected
  transaction with no open Attempt.
- Never delete a staging file merely because the claim expired.

### 9.2 Stream Timeout or Abort

- Stop reading.
- Close the write handle if possible.
- Record the observed reason in a safe failure code.
- Do not mark READY without complete size and hash.
- Do not publish.
- Retain the partial object and lifecycle evidence.
- A retry requires a new Attempt unless the exact same Attempt can be safely
  resumed and the storage adapter can prove the same file identity.

### 9.3 Heartbeat Failure

If the request cannot renew:

```text
stop reading
stop accepting a new body
do not perform cleanup
attempt a fail-closed terminal/abandoned transition if ownership still permits
otherwise leave UNKNOWN/RECOVERY_REQUIRED
```

### 9.4 Publication Failure

| Observed result | State |
|---|---|
| target absent; source proves unchanged | Operation FAILED; retain staging and canonical FINALIZING/FAILED_RETAINED as applicable |
| target exists with different identity/hash | FAILED_RETAINED; no overwrite or delete |
| target exists with same identity/hash | same Operation may reconcile |
| target verification unavailable | UNKNOWN; no success |
| staging unlink unavailable | UNKNOWN/FAILED_RETAINED; no FileVersion until proven |
| commit status unknown | UNKNOWN; query exact transaction rows |

### 9.5 Recovery Boundary

This WP only permits ordinary-upload reconciliation of the same Operation. It
does not authorize quarantine, restore, purge, global orphan scanning, physical
delete of a canonical object, or automatic cleanup.

## 10. Permissions and Isolation

### 10.1 Current Controls

**FACT**

- Upload POST/PUT routes require `file.upload`.
- Download route requires `file.read`.
- Same-origin protection exists on upload routes.
- `loadActor()` expands global and project-scoped role permissions.
- `prepareFileDownload()` re-checks file/version relationship but does not
  explicitly re-check the File customer against the Project customer.

### 10.2 Required Service-Level Checks

`DESIGN RECOMMENDATION`

Even if the route checks permission, service methods must re-check:

```text
actor has file.upload/file.read for projectId
Intent.uploadedById matches the uploading actor for an upload status/body call
Intent.projectId matches the route projectId
File.customerId matches Project.customerId
building and installation unit belong to the project/file target
existingFileId belongs to the same customer/project/building/unit
FileVersion belongs to File and storage key belongs to ACTIVE CANONICAL
```

Do not trust client-provided `projectId`, `fileId`, `versionId`, `intentId` or
relationship ids. Always query the full ownership chain.

### 10.3 Cross-Tenant and Cross-Project

- A project-scoped actor cannot consume another actor's Intent.
- A customer/project actor cannot infer or download a File by URL ID.
- A version from project A fails when requested under project B.
- A file with an inconsistent customer association fails closed.
- The response must not reveal whether a hidden file exists across a project
  boundary; return a stable 403/404 policy.

### 10.4 Trigger Defense

The database Trigger is a last line of defense, not a substitute for service
authorization:

- missing/invalid chain fields fail;
- invalid Lifecycle state fails;
- ACTIVE without exactly one FileVersion fails;
- current Operation/owner/generation mismatch fails;
- direct FileVersion deletion/identity rewrite fails.

### 10.5 Current Gaps

- No application attempt/lifecycle/operation authorization layer exists.
- The database role model still uses `elevator_app` ownership; independent
  Web/Worker/Maintenance/Recovery roles are not established.
- `elevator_app` ownership means an owner-level or migration-level caller is a
  potential application-bypass surface, especially if it can disable or
  replace guards. Triggers are necessary defense-in-depth but are not a
  substitute for the approved runtime roles and grants.
- PUBLIC function EXECUTE remains unresolved in lifecycle status.
- The current storage object can be read directly by a caller that has the
  canonical key, although API responses do not expose it.
- The current download path does not explicitly require ACTIVE lifecycle state.

## 11. Legacy Upload Path Handling

### 11.1 Current Legacy Fields

**FACT**

- `FileUploadIntent.stagingKey` is nullable and documented as a legacy
  compatibility field.
- `FileUploadIntent.objectStorageKey` is still used by the current service.
- The current storage finalize path uses `fs.rename()` and target-existence
  checking.

### 11.2 Required Treatment

`DESIGN RECOMMENDATION`

1. New Intent creation writes `stagingKey = NULL` and `objectStorageKey = NULL`.
2. New content upload uses only `FileUploadAttempt.stagingKey`.
3. A legacy Intent with non-null `stagingKey` or `objectStorageKey` is rejected
   from new upload attempts with a stable `LEGACY_UPLOAD_PATH_DISABLED` error,
   unless a separately approved historical migration/exception exists.
4. The service must not fall back to the legacy finalizer if P1-3 objects are
   absent.
5. The route must not expose a second upload API that calls the old path.
6. Old integration/E2E fixtures must be migrated or explicitly excluded from
   the P1-3-enabled test suite.
7. The database Trigger remains a defense-in-depth rejection for direct writes.

### 11.3 Trigger Rejection

If an unstaged old FileVersion insert is attempted against the P1-3 schema, the
expected first-order failure is:

```text
FileVersion requires ACTIVE CANONICAL lifecycle
SQLSTATE 23514
```

If an Intent is moved to UPLOADING without a current Attempt, the deferred chain
guard is expected to fail at COMMIT:

```text
invalid UPLOADING upload chain counts
SQLSTATE 23514
```

This is design expectation; no database execution was authorized in WP-1.

## 12. Complete Test Matrix

All tests below are design-only until a separate database/filesystem test
authorization is granted. `DB` means a dedicated disposable test database.
`FS` means an isolated test storage root.

| ID | Precondition | Operation | Expected DB state | Expected object state |
|---|---|---|---|---|
| `UPL-01` | Authorized actor, valid PDF, existing File | POST Intent, PUT exact PDF | Intent COMPLETED; Attempt COMPLETED; FINALIZE APPLIED; canonical ACTIVE; one FileVersion; AuditLog | staging removed after publish; canonical regular object; size/hash match; no storageKey in response |
| `UPL-02` | Same `Idempotency-Key`, same fingerprint | POST twice concurrently | exactly one Intent; same Intent/result; no duplicate Attempt | no new object |
| `UPL-03` | Intent PENDING; two PUTs same Intent | run two bodies concurrently | one winning Attempt; loser 409; Intent points to one open Attempt | only winner's staging key; no second write |
| `UPL-04` | Existing File with current version 1; two different Intents | finalize concurrently | one File lock/version at a time; versions 2 and 3; currentVersionId is the last valid committed version | two distinct canonical objects; no same-key collision |
| `UPL-05` | Existing File; finalization forced after File row changes target | finalize with stale target snapshot | fail closed; no FileVersion; preserve Attempt/Lifecycle evidence | no overwrite; canonical absent or retained as failure evidence |
| `TIM-01` | PENDING Intent, client stops stream before declared size | PUT and abort | Intent not COMPLETED; Attempt WRITING/ABANDONED per policy; no FileVersion | partial staging retained; no canonical object |
| `TIM-02` | PENDING Intent, declared size exceeded | PUT oversized body | Intent FAILED/terminal per policy; no FileVersion; no cleanup of partial file | partial staging retained, no canonical |
| `TIM-03` | Expired Intent | PUT after expiry | Intent EXPIRED; currentAttempt NULL; no open Attempt | no new object; old object retained |
| `RSP-01` | POST response lost after Intent commit | retry same Idempotency-Key | one PENDING Intent | none |
| `RSP-02` | PUT final transaction committed; response lost | GET status or retry PUT | Intent COMPLETED; FileVersion same id; no second FileVersion | canonical unchanged; staging deleted |
| `RSP-03` | PUT DB commit response lost before client can query | retry status/reconcile | exact operation either APPLIED or UNKNOWN; never guessed | canonical/staging identities checked; no duplicate publish |
| `DBU-01` | FS publish succeeds; final transaction COMMIT unknown | reconnect and query by Operation/Intent | committed rows return success; uncommitted rows remain FINALIZING/UNKNOWN | inspect target and staging; no deletion or blind retry |
| `DBU-02` | FS publish result unknown | timeout/crash injection | Operation UNKNOWN; no FileVersion | target/source identities and hash reconciled before any terminal state |
| `WRK-01` | Old finalizer holds stale owner/generation | new generation attempts CAS | stale CAS fails; no old write accepted | late FS operation retained as UNKNOWN if observable |
| `WRK-02` | Two finalizers attempt the same PREPARED Operation | run them concurrently | exactly one EXECUTING/APPLIED owner; loser 409/UNKNOWN; one FileVersion | one publish attempt; no second target |
| `AUTH-01` | No authenticated session | POST or PUT | 401; no Intent/Attempt writes | no object |
| `AUTH-02` | Actor has no `file.upload` for project | POST/PUT | 403; no durable state | no object |
| `AUTH-03` | Actor has project read but not upload | PUT | 403; no claim | no object |
| `TEN-01` | Project A actor requests project B file/version | download | 403/404; no content | no object read |
| `TEN-02` | File.customerId does not match project.customerId | create/finalize/download | fail closed before write/read | no object mutation |
| `REL-01` | building/project mismatch or installation unit/building mismatch | POST | 400/409; no Intent | no object |
| `REL-02` | existingFileId belongs to another project/customer/building/unit | POST | 400/409; no Intent | no object |
| `STA-01` | Attempt WRITING; force READY without close attestation | direct service/DB attempted transition | `23514` at commit/statement; no READY | staging remains |
| `STA-02` | Lifecycle STAGING_RESERVED; force direct STAGING_READY or ACTIVE | direct DB mutation | `23514`; no transition | unchanged |
| `STA-03` | ACTIVE canonical + FileVersion; attempt leave ACTIVE | direct DB mutation | `23514`; FileVersion remains valid | no delete |
| `OLD-01` | Legacy Intent has Intent.stagingKey; no Attempt | call old complete path | fail closed; no FileVersion; operation not silently created | no canonical overwrite |
| `OLD-02` | Direct FileVersion INSERT without chain fields | test DB INSERT | NOT NULL/FK/Trigger rejection | object state unchanged |
| `DL-01` | Valid ACTIVE object, authorized project reader, test scan policy satisfied | GET content | FileVersion integrity VERIFIED; audit entries; no storageKey | full body hash matches; no-store headers |
| `DL-02` | Valid FileVersion but canonical Lifecycle not ACTIVE | GET content | 409/403; integrity event/audit; no data | no content returned |
| `DL-03` | Unauthorized/cross-project request | GET content | 403/404; no content | no read side effect |
| `DL-04` | Canonical object missing/replaced/wrong hash | GET content | integrity FAILED; security event; download blocked | no content returned |
| `DL-05` | File/version relation is wrong or version belongs to another File | GET content | 404; no content | no read |

### 12.1 Mandatory Negative Assertions

Every applicable test must assert that:

```text
response loss does not produce two FileVersions
lease expiry does not become a successful physical operation
database rollback does not delete a published canonical object
filesystem publish does not occur before durable Operation EXECUTING
old path cannot create a FileVersion under P13 schema
no response exposes stagingKey/canonicalKey/ownerToken
```

The response-loss test must derive the first result, replay result, Operation
state, FileVersion row and AuditLog counts from the actual transition
fixtures. A hardcoded business result compared with itself is not valid
evidence.

## 13. Expected Modified File List

No file in this table was modified by WP-1. This is the proposed implementation
scope for a later separately authorized phase.

| Planned file | Purpose | Authorization status |
|---|---|---|
| `apps/web/src/modules/files/upload-lifecycle-service.ts` | Atomic Intent/Attempt/Lifecycle/Operation helpers and recovery state machine | NOT AUTHORIZED |
| `apps/web/src/modules/files/upload-service.ts` | Replace legacy staging/finalize path and satisfy chain fields | NOT AUTHORIZED |
| `apps/web/src/app/api/projects/[projectId]/files/upload-intents/route.ts` | Create PENDING Intent without legacy storage key | NOT AUTHORIZED |
| `apps/web/src/app/api/projects/[projectId]/files/upload-intents/[intentId]/content/route.ts` | Idempotent claim/resume behavior | NOT AUTHORIZED |
| `apps/web/src/app/api/projects/[projectId]/files/upload-intents/[intentId]/route.ts` | New safe status endpoint, if approved | NOT AUTHORIZED |
| `apps/web/src/modules/files/download-service.ts` | Explicit ACTIVE canonical lifecycle check and project/customer isolation | NOT AUTHORIZED |
| `apps/web/src/modules/files/file-query-service.ts` | Consistent project/customer filtering if required | NOT AUTHORIZED |
| `packages/file-storage/src/capabilities.ts` | Close attestation and publish capability contract | NOT AUTHORIZED |
| `packages/file-storage/src/local-private-storage.ts` | Identity-aware write close and no-overwrite publication | NOT AUTHORIZED |
| `apps/web/src/server/files/storage.ts` | Expose only the approved upload/read capabilities | NOT AUTHORIZED |
| `apps/web/tests/integration/phase32-upload-service.test.ts` | P1-3 A–D upload workflow and retry tests | NOT AUTHORIZED |
| `apps/web/tests/e2e/phase32-upload.spec.ts` | Replace legacy assertions; response-loss/timeout paths | NOT AUTHORIZED |
| `apps/web/tests/integration/phase33-file-access.test.ts` | ACTIVE lifecycle and tenant/isolation tests | NOT AUTHORIZED |
| `packages/file-storage/tests/local-private-storage.test.ts` | No-overwrite, identity, reparse and target tamper tests | NOT AUTHORIZED |
| `apps/web/tests/integration/phase31-schema.test.ts` | Stop direct out-of-chain FileVersion fixture creation | NOT AUTHORIZED |
| Other integration fixtures that create FileVersion directly | Replace with lifecycle-aware fixture builder | NOT AUTHORIZED |

No Prisma Schema or Migration change is expected for the core fields because
the P1-3 models are already present. Any schema or Migration change requires a
separate design and authorization.

## 14. Implementation Sequence

### Stage 0 — Static Baseline Repair

- Make the current TypeScript tree compile with `--incremental false`.
- Decide which historical integration fixtures cannot exist under P1-3 and
  either move them to a legacy suite or construct them through the lifecycle
  fixture builder.
- Prove the five P1-3 models are generated in Prisma Client.

### Stage 1 — Storage Capability

- Add a close-attestation result contract.
- Add a canonical publish/no-overwrite contract.
- Add explicit unsupported-filesystem/reparse/identity errors.
- Keep Web read+upload capability and no delete capability.
- Do not add quarantine, restore, purge or maintenance delete.

### Stage 2 — Lifecycle Repository

- Implement Intent claim.
- Implement Attempt and staging Lifecycle creation.
- Implement close-attestation transition.
- Implement FINALIZE PREPARED/EXECUTING/APPLIED transitions.
- Implement exact COMMIT-unknown/UNKNOWN reconciliation helpers.
- Use explicit storage-key locks and lease/generation CAS.

### Stage 3 — Upload Service and Routes

- Create Intent without legacy `stagingKey`.
- Stream through an Attempt-owned staging path.
- Finalize through the Operation.
- Add status/replay behavior.
- Remove/disable every legacy finalize path.

### Stage 4 — Normal Access

- Join FileVersion to ACTIVE canonical Lifecycle.
- Revalidate customer/project/building/unit authorization.
- Keep existing malware-scan, MIME, size, checksum and response-safety rules.
- Record access and integrity events without exposing storage keys.

### Stage 5 — Verification

- Run static tests and positive/negative typecheck with `--incremental false`.
- Run unit tests that create only isolated temporary files.
- Run the dedicated test database matrix only after separate authorization.
- Run isolated filesystem identity/no-overwrite tests only after separate
  authorization.
- Do not run E2E, production Build, services or Native RPC as part of WP-1.

## 15. Open Decisions

### 15.1 Global R5 Decisions

**FACT**

`docs/product/full-mvp-remediation-design-r3-c8-corrections-r5/OPEN_DECISIONS_DISPOSITION_R5.md`
records:

```text
Original IDs: 57
Present and unique: 57/57
Approved by User: 0
Still OPEN: 57
```

This report approves none of them. Relevant still-open areas include identity
broker/topology, candidate maintenance identity, evidence retention, recovery
limits, break-glass, database execution, runtime concurrency and role topology.

### 15.2 WP-1 Decisions

| ID | Decision | State | Why it cannot be self-approved |
|---|---|---|---|
| `WP1-OD-01` | Hard-link or copy-on-publish primitive | OPEN | Windows/NTFS identity and crash behavior not tested |
| `WP1-OD-02` | Exact close-attestation identity strength on supported Windows | OPEN | Node core cannot prove all handles closed; native authority is not approved |
| `WP1-OD-03` | New Attempt on timeout/retry vs same-Attempt resume | OPEN | affects evidence and retry policy |
| `WP1-OD-04` | Retention of abandoned partial staging | OPEN | cleanup/purge policy is outside WP-1 |
| `WP1-OD-05` | Status endpoint response and error taxonomy | OPEN | public API contract change |
| `WP1-OD-06` | Whether upload completion may include a cross-process finalizer | OPEN | ordinary Web-only design must remain separate from maintenance/native authority |
| `WP1-OD-07` | Historical Intent/FileVersion backfill | OPEN | migration/backfill not authorized |
| `WP1-OD-08` | Exact `FileVersion.integrityStatus` semantics before/after normal download | OPEN | current source marks VERIFIED from upload-side evidence; this must be aligned with lifecycle evidence |

### 15.3 Not Approved Baselines

- `R5` product remediation design remains `DESIGN COMPLETE WITH OPEN BLOCKERS`.
- R5 independent review is `FAIL — DESIGN CORRECTIONS REQUIRED` with P2/P3
  findings.
- BV7 PFR review is `FAIL`.
- BV8 is `READY FOR INDEPENDENT REVIEW`, not independently approved.
- R8 is `BLOCKED — REQUIRED DESIGN EVIDENCE MISSING` and is not an approved
  baseline.
- Native RPC, Build Broker, PFR policy, ACL and trust-root changes are not
  dependencies that WP-1 may silently enable.

## 16. Risk Register

| Risk | Severity | Current evidence | Required disposition |
|---|---|---|---|
| Current upload code fails the P1-3 type contract | High | `tsc --noEmit --incremental false` errors at upload-service lines 385, 441, 475 and legacy fixtures | Fix in separately authorized implementation |
| Legacy finalize can create an object but no valid P13 chain | High | current `fs.rename` + no Attempt/Lifecycle/Operation | Disable path and add route/service tests |
| Staging writer closure is not cryptographically/identity attested | High | current `writeToStaging` returns size/hash/header only | Add fail-closed attestation capability; test real FS |
| `fs.access` + `fs.rename` is not atomic no-overwrite | High | current adapter lines 177/191 | Replace with verified no-overwrite protocol |
| Concurrent existing-file uploads race on version/currentVersion | High | no File row lock in current final transaction | Add File serialization and concurrent tests |
| Unknown DB COMMIT can be misreported as success or cleaned incorrectly | High | current catch only marks Intent failed | Add Operation UNKNOWN and exact reconciliation |
| Response loss after body upload | High | current status only supports completed Intent and requires body | Add durable status/replay state |
| Tenant/project association is not explicitly checked on download | Medium/High | `download-service` finds by projectId and fileId only | Add customer/project relation assertion |
| Old tests/fixtures bypass the new chain | High | Phase 3.2 and direct FileVersion fixture creates | Rewrite or isolate before implementation |
| P13 DB behavior is not proven | High | DBTP says behavioral/COMMIT/concurrency not verified | Execute only in dedicated clone/database under separate authorization |
| `$null` protected artifact | Protected baseline | Existing untracked `$null`; WP-1 did not read/hash/modify it | Preserve unchanged; no disposition here |
| BV8/R8 unresolved work distracts from ordinary upload | Medium | BV8/R8 documents are not approved baselines | Keep separate; do not mix Native/PFR scope |

## 17. Prohibited Operations and Authorization Boundary

This task did not and the next task must not infer authorization for:

```text
source, Schema, Migration, test or configuration modification
database write, SQL migration, reset or backfill
real Storage object creation, deletion, move, rename or access
ACL, owner, IAM, token, service, scheduler or audit-policy change
E2E, production Build, Native Build, MIDL, MSVC, linker or Native RPC Runtime
Git add, commit, reset, restore, clean, checkout, stash, rebase or force push
reading .env, .env.test, secrets, tokens, passwords or connection strings
```

Protected objects:

```text
D:\thinkbook\Desktop\jieya\$null
apps/web/.next
apps/worker/dist
```

`$null` was not read, hashed, modified, moved or deleted by WP-1. The two build
directories were not read, started, moved, modified or cleaned.

## 18. Mermaid Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Authorized User
    participant API as Web Upload API
    participant Svc as P1-3 Upload Service
    participant DB as PostgreSQL
    participant FS as Private Local Storage
    participant Q as Queue

    User->>API: POST Intent + Idempotency-Key
    API->>Svc: authenticate + authorize + validate target
    Svc->>DB: T0 find/create PENDING Intent
    DB-->>Svc: Intent
    Svc-->>API: Intent id / expiry
    API-->>User: 201 or replay 200

    User->>API: PUT content for Intent
    API->>Svc: auth + body metadata
    Svc->>DB: T1 lock Intent; create Attempt + STAGING_RESERVED
    Svc->>DB: activate UPLOADING / currentAttempt
    Svc->>DB: T1 transition STAGING / WRITING with owner + lease
    DB-->>Svc: committed claim
    Svc->>FS: exclusive staging write
    FS-->>Svc: bytes, size, SHA-256, close result
    Svc->>DB: T3 close attestation + STAGING_READY + READY

    Svc->>DB: T4 CANONICAL FINALIZING + FINALIZE PREPARED + Attempt FINALIZING
    Svc->>DB: T5 Operation EXECUTING
    Svc->>FS: no-overwrite publish + identity/hash verification
    alt publish proven
        FS-->>Svc: target verified, staging unlinked
        Svc->>DB: T7 APPLIED + ACTIVE + COMPLETED + FileVersion + Intent + Audit
        DB-->>Svc: committed
        Svc->>Q: enqueue extraction
        Svc-->>API: FileVersion summary
        API-->>User: 201 / replay 200
    else publish unknown or conflicting
        FS-->>Svc: UNKNOWN or FAILED_RETAINED evidence
        Svc->>DB: Operation UNKNOWN/FAILED_RETAINED; no FileVersion
        Svc-->>API: recovery-required response
        API-->>User: 202/409 with status lookup path
    end

    opt Response lost
        User->>API: GET Intent status or retry same Intent
        API->>Svc: authenticated read
        Svc->>DB: exact Intent/Attempt/Operation/FileVersion lookup
        alt committed result exists
            Svc-->>API: same FileVersion summary
            API-->>User: 200
        else operation is UNKNOWN/FINALIZING
            Svc-->>API: recoveryRequired
            API-->>User: 202/409; no duplicate body required
        end
    end
```

## 19. Evidence Index

### 19.1 Source Facts

| Evidence | Location |
|---|---|
| Legacy Intent creation | `apps/web/src/modules/files/upload-service.ts:155-236` |
| Legacy content claim/stream/finalize | `apps/web/src/modules/files/upload-service.ts:267-599` |
| Upload routes | `apps/web/src/app/api/projects/[projectId]/files/upload-intents/route.ts`; `.../[intentId]/content/route.ts` |
| Download service | `apps/web/src/modules/files/download-service.ts:242-525` |
| Storage write/finalize | `packages/file-storage/src/local-private-storage.ts:108-191` |
| Storage read identity checks | `packages/file-storage/src/local-private-storage.ts:224-482` |
| P1-3 models | `prisma/schema.prisma:367-655` |
| FileVersion chain fields | `prisma/schema.prisma:409-431` |
| Lifecycle initial state guard | `prisma/migrations/20261117140000_phase37_p13_lifecycle_initial_state_guard/migration.sql` |
| Attempt/Lifecycle/Operation guards | `prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:603-1142` |
| Upload chain assertions | same Migration, lines 1194-1357 |
| FileVersion lifecycle assertions | same Migration, lines 1797-1947 |

### 19.2 Historical Status

| Evidence | Status |
|---|---|
| `docs/architecture/file-lifecycle-p13-design-freeze.md` | Design approved for isolated schema implementation; runtime not authorized |
| `docs/architecture/file-lifecycle-p13-implementation-status.md:404` | Explicitly records that upload chain does not create the three P1-3 objects |
| `docs/architecture/file-lifecycle-p13-implementation-status.md:289` | Business integration test incomplete |
| `docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md` | Test design; database behavior not executed by WP-1 |
| R5 product remediation design | Design complete with open blockers |
| R5 independent review | FAIL — design corrections required |
| BV7 independent review | FAIL |
| BV8 PFR corrections | Ready for independent review, not approved |
| R8 fourth blocking corrections | Blocked by missing design evidence |

### 19.3 Static Command Evidence

The following command was executed read-only:

```powershell
pnpm --filter @elevator/web exec tsc --noEmit --incremental false
```

It exited `1` with the current upload chain and legacy fixture errors, including:

```text
upload-service.ts(385): string | null not assignable to string
upload-service.ts(441): string | null not assignable to string
upload-service.ts(475): missing uploadIntentId/uploadAttemptId/
  creationOperationAttemptId
Phase32 E2E: three nullable legacy stagingKey uses
Phase31/33/36/37 integration fixtures: incomplete FileVersion chain
```

No source was modified by this check. `--incremental false` was used to avoid
refreshing the incremental TypeScript cache.

## 20. Investigation Scope and Non-Actions

### Completed

- Read the root and blueprint project instructions and applicable Skills.
- Inspected current Git branch, HEAD, remote and untracked state.
- Read the current upload/download routes and services.
- Inspected the current local private-storage adapter and capability boundary.
- Inspected the current Prisma models and P1-3 Migration guards.
- Inspected the current Phase 3.2/3.3 tests and lifecycle fixture builder.
- Read the latest lifecycle status/test-plan, R5 design/review/open decisions,
  BV7, BV8, R8 and related design-material status.
- Ran one no-emit, non-incremental TypeScript check.

### Not Performed

- No database connection, SQL, migration, backfill or DB behavior test.
- No Storage access or object operation.
- No upload, download or E2E execution.
- No production build or Native RPC build/runtime.
- No source, Schema, Migration, configuration or test modification.
- No Git write operation.
- No `.env`, `.env.test`, secret or credential read.
- No `$null`, `.next` or worker `dist` read/modification/startup.

## 21. Final Conclusion and Stop Point

```text
WP-1 DESIGN DELIVERY:
PASS WITH WARNINGS

CURRENT APPLICATION UPLOAD CHAIN:
NOT P1-3 INTEGRATED

CURRENT TYPE CHECK:
FAIL

IMPLEMENTATION:
NOT AUTHORIZED

DATABASE / STORAGE / RUNTIME:
NOT ACCESSED

OPEN DECISIONS:
57 GLOBAL R5 IDS REMAIN OPEN; LOCAL WP-1 DECISIONS REMAIN OPEN

NEXT AUTHORIZATION:
SEPARATE WP-2/WP-3 IMPLEMENTATION AND VERIFICATION AUTHORIZATION REQUIRED
```

This is the mandatory stop point. Do not start source changes, database
execution, filesystem publication, Build, Native RPC, `$null` disposition,
Git writes or another work package without new explicit authorization.

## 22. Report Integrity

Self-hash convention:

- On the line following `CANONICAL SELF-HASH`, replace either the pre-final
  placeholder or the embedded 64-character digest with 64 ASCII `0`
  characters.
- Hash the resulting UTF-8 bytes with SHA-256.
- The canonical self-hash is the resulting digest.
- The raw final file SHA-256 is reported externally after the final write and
  is not self-embedded, because embedding it would change the file bytes.

```text
CANONICAL SELF-HASH:
D943A7249685AD2F96A5446D91B7EF03E3385D412FA6CDA714A4D76E5B0283A9
```
