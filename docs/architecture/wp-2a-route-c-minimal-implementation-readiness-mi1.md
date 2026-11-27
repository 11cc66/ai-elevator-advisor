# WP-2A-MI1 — Route C-Minimal Implementation Readiness and Source-Level Validation

## 0. Document Control

```text
Stage:
  WP-2A-MI1

Mode:
  READ-ONLY IMPLEMENTATION READINESS / SOURCE-LEVEL VALIDATION

Date:
  2026-11-26

Repository:
  D:\thinkbook\Desktop\jieya

Branch:
  codex/public-github-sync

HEAD:
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

origin/main:
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

Architecture baseline:
  docs/architecture/wp-2a-architecture-reassessment-ra1.md

RA1 SHA-256:
  3F0516BA8B39606FA5D196D4BC61D78C53FF8558FA763A86E61E13A4D9399615

Final result:
  MI1 READY WITH BLOCKERS
```

This report is a read-only implementation-readiness assessment. It does not
modify source, Prisma Schema, Migration, Trigger, test, configuration, policy,
ACL, IAM or Git history. It does not authorize source implementation or
runtime validation.

## 1. Architectural Baseline

RA1 is accepted as the architecture baseline:

```text
Route C-Minimal
  server-proxied object storage
  one immutable object key per FileVersion/attempt
  exact Provider object version binding
  existing P1-3 Intent/Attempt/Lifecycle/Operation chain
  DB business authority
  no automatic cleanup or arbitrary delete
  no Web/Worker direct Provider credentials
```

This MI1 does not reopen D3-D6. The full ProviderEffect/EffectOwner,
DispatchPermit, InvestigationSnapshot, 14 Evidence classes, trust-root
manifests, migration/rollback and quarantine/purge protocol remain deferred.

## 2. Evidence and Method

Evidence classes:

| Label | Meaning |
|---|---|
| `SOURCE VERIFIED` | Current source, Schema, Migration or test file |
| `HISTORY VERIFIED` | Existing design/status/review report |
| `INFERRED` | Engineering conclusion derived from source |
| `NOT VERIFIED` | Requires Provider, PostgreSQL, IAM, OS or runtime |
| `BLOCKED` | External decision or approval required |

The review read:

- root and blueprint `AGENTS.md`;
- the five file/database/security/testing Skills;
- RA1 and D3-D6/R3-R7 conclusions;
- current upload, download, Worker, storage and access modules;
- current Prisma Schema and P1-3 Migration;
- current P1-3 implementation status and database behavior test plan;
- current Web/Worker/package manifests and file tests.

No test, database connection, Provider call, Build, E2E, Native RPC, service
restart or deployment was executed.

## 3. Current Real Code Path

### 3.1 Upload entry path

`SOURCE VERIFIED`:

```text
POST /api/projects/{projectId}/files/upload-intents
  -> requireApiActor
  -> requireProjectPermission(file.upload)
  -> assertSameOrigin
  -> Idempotency-Key validation
  -> createUploadIntent
  -> FileUploadIntent.create

PUT /api/projects/{projectId}/files/upload-intents/{intentId}/content
  -> requireApiActor
  -> requireProjectPermission(file.upload)
  -> assertSameOrigin
  -> completeUpload
  -> FileUploadIntent.updateMany(PENDING -> UPLOADING)
  -> storage.writeToStaging
  -> detectAllowedFileType
  -> storage.finalize
  -> prisma.$transaction(File/FileVersion/Extraction/currentVersion/Intent/Audit)
```

File references:

- `apps/web/src/app/api/projects/[projectId]/files/upload-intents/route.ts`
- `apps/web/src/app/api/projects/[projectId]/files/upload-intents/[intentId]/content/route.ts`
- `apps/web/src/modules/files/upload-service.ts:155-238`
- `apps/web/src/modules/files/upload-service.ts:267-591`

Current conclusion:

- The route and service have good authentication, origin, project, MIME, length
  and idempotency checks.
- They do not create `FileUploadAttempt`, `StorageObjectLifecycle` or
  `StorageObjectOperation`.
- They write a local staging object and call `finalize` before the FileVersion
  transaction.
- `FileVersion.create` at `upload-service.ts:474-501` omits the required
  `uploadIntentId`, `uploadAttemptId` and `creationOperationAttemptId` fields.
- The catch path at `upload-service.ts:592-648` marks the Intent failed but
  retains physical artifacts without an exact provider binding or a recovery
  identity.

### 3.2 Current storage/finalize path

`SOURCE VERIFIED`:

- `packages/file-storage/src/local-private-storage.ts:108-166` uses
  `fs.open(path, "wx", 0o600)`, streams bytes and computes SHA-256.
- `local-private-storage.ts:168-192` checks `fs.access` and then calls
  `fs.rename`. This is a check-then-rename sequence, not an atomic
  no-overwrite primitive.
- `local-private-storage.ts:211-479` provides a strong readback with path
  component checks, identity checks, size checks, extra-byte rejection and
  SHA-256 verification.
- `packages/file-storage/src/capabilities.ts` exposes separate read/upload
  interfaces and a combined runtime capability.
- `apps/web/src/server/files/storage.ts` gives Web the combined read/write
  runtime capability.
- `apps/worker/src/storage.ts` gives Worker only `StorageReadCapability`.

Current conclusion:

- The read path is useful for bounded local development.
- The current `finalize` cannot be used as production proof of no-overwrite.
- The current Web/Worker split is an interface boundary, not a Provider
  credential boundary and not a database role boundary.

### 3.3 Current download path

`SOURCE VERIFIED`:

- `apps/web/src/modules/files/download-service.ts:233-312` finds File by
  project/file ID, finds FileVersion by file/version ID, evaluates upload,
  validation, integrity and malware policy, then reads.
- `download-service.ts:439-501` calls `readVerifiedObject` using
  `version.storageKey`, verifies size/SHA, updates integrity and appends
  download audit.
- The download response route requires `file.read`, `private, no-store`,
  attachment disposition, sandbox CSP and nosniff headers.
- No current code uses a `StorageObjectBinding`; it trusts the FileVersion
  storage key and current file/version row.

### 3.4 Current Worker path

`SOURCE VERIFIED`:

- `apps/worker/src/file-processing.ts:331-479` claims FileExtraction with a
  processing token, rechecks user/project permission, scan/integrity policy,
  then reads by `extraction.fileVersion.storageKey` using `openReadStream`.
- `file-processing.ts:531-554` computes SHA-256 and records a security event
  on mismatch.
- `file-processing-state.ts:44-96` claims extraction only with
  `attempt < maxAttempts` and a valid token/lease.
- `file-maintenance.ts:117-251` recovers stale extraction leases and requeues
  work. It does not physically clean storage.
- Worker receives `StorageReadCapability`, not a write/delete capability.

Current conclusion:

- The Worker is already read-only at the storage interface level.
- It trusts the FileVersion storage key and does not require an exact provider
  binding or P1-3 lifecycle state.
- Worker's current tests cover processing errors, policy, PDF/image parsing,
  worker identity and non-destructive maintenance, but not real database
  concurrency or provider readback.

### 3.5 Current deletion and cleanup path

`SOURCE VERIFIED`:

- `apps/web/src/modules/files/upload-service.ts:147-153` throws
  `LegacyStorageCleanupDisabledError`.
- `packages/file-storage/src/legacy-cleanup.ts` throws for `removeStaging`,
  `removeObject`, `cleanupOrphanObjects` and `cleanupTemp`.
- Current API route enumeration contains File list/details/extraction/content
  routes but no business DELETE route for File or FileVersion.
- `apps/worker/src/file-maintenance.ts` only recovers/requeues extraction
  work; it does not perform physical cleanup.

The MVP must preserve these fail-closed boundaries. No delete/cleanup code may
be added or enabled as a side effect of MI1 implementation.

## 4. Current Schema and Migration Facts

`SOURCE VERIFIED`:

- `prisma/schema.prisma:398-443` FileVersion has:

```text
storageKey                      unique, required
uploadIntentId                  required
uploadAttemptId                 unique, required
creationOperationAttemptId      unique, required
storageObject                   relation to StorageObjectLifecycle(storageKey)
```

- `prisma/schema.prisma:501-575` defines Intent/Attempt with
  `currentAttemptId`, unique staging/canonical keys and status enums.
- `prisma/schema.prisma:577-655` defines Lifecycle/Operation with local
  namespaces, owner token, fencing generation, lease, close attestation,
  current operation and state enums.
- `prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql`
  defines the current tables and triggers.
- The P1-3 migration is forward-only and refuses a non-empty
  Intent/FileVersion baseline; historical backfill is separate.
- The migration's local path checks require:

```text
STAGING -> storageKey LIKE 'staging/%'
CANONICAL -> storageKey LIKE 'objects/%'
```

- The current FileVersion trigger requires ACTIVE canonical lifecycle,
  APPLIED FINALIZE operation and the complete Intent/Attempt chain.
- The current completed-upload trigger expects the staging lifecycle to be
  `DELETED`; this local assumption must be branched for an object-store
  logical staging record, or the object route cannot satisfy the existing
  completed chain without physical deletion.
- `docs/architecture/file-lifecycle-p13-implementation-status.md` records
  P1-3 application integration, close attestation, generation/locks, runtime
  roles and full behavior tests as `NOT_IMPLEMENTED` or `NOT_VERIFIED`.
- `docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md` records
  no application-level P1-3 CAS, lock order, close attestation or filesystem
  operation implementation.

Current source fact derived from the missing fields:

```text
current completeUpload cannot create a valid P1-3 FileVersion
```

The README already records this as a pre-existing typecheck/integration
failure. MI1 does not run `pnpm typecheck`; the failure is a historical
reported limitation, not a new test result.

## 5. Route C-Minimal Target Model

### 5.1 Required new binding table

`StorageObjectBinding`:

```text
id                         varchar(32) PK
objectLifecycleId          varchar(32) NOT NULL UNIQUE
operationId                varchar(32) NOT NULL UNIQUE
storageBackend             OBJECT_STORE
providerKind               provider-neutral enum
accountScopeRef            varchar(128) NOT NULL
region                     varchar(64) NOT NULL
bucketOrContainer          varchar(255) NOT NULL
objectKey                  varchar(255) NOT NULL
providerVersionId          varchar(255) NULL
providerGeneration         bigint NULL
sizeBytes                  bigint NULL
checksumSha256             char(64) NULL
state                      PENDING | VERIFIED | FAILED_RETAINED
createdAt                  timestamptz(6) NOT NULL
verifiedAt                 timestamptz(6) NULL
```

Minimum constraints:

```text
PK(id)
FK(objectLifecycleId) -> StorageObjectLifecycle(id)
FK(operationId) -> StorageObjectOperation(id)
UNIQUE(objectLifecycleId)
UNIQUE(operationId)
UNIQUE(providerKind,accountScopeRef,region,bucketOrContainer,
       objectKey,providerVersionId) WHERE providerVersionId IS NOT NULL
CHECK state=PENDING:
  providerVersionId may be NULL;
  sizeBytes/checksum may be expected values pending exact readback
CHECK state=VERIFIED:
  providerVersionId IS NOT NULL
  sizeBytes > 0
  checksumSha256 matches 64 hex
  verifiedAt IS NOT NULL
CHECK state=FAILED_RETAINED:
  no VERIFIED-only claim
append-only terminal transition and no DELETE/TRUNCATE
```

`providerVersionId` is not necessarily an ETag. It is an opaque provider
version identity; ETag is not allowed to substitute for SHA-256.

### 5.2 FileVersion additions

Proposed additions:

```text
storageBackend              LEGACY_LOCAL | OBJECT_STORE
storageObjectBindingId      unique, nullable only for LEGACY_LOCAL
```

Required invariant:

```text
OBJECT_STORE:
  storageObjectBindingId NOT NULL
  binding state = VERIFIED
  binding.objectLifecycleId = FileVersion lifecycle id
  binding.objectKey = FileVersion.storageKey
  binding.sizeBytes = FileVersion.sizeBytes
  binding.checksumSha256 = FileVersion.checksumSha256
  binding.providerVersionId present

LEGACY_LOCAL:
  storageObjectBindingId NULL
  v2 ordinary read/processing/write disabled until classified
```

Existing `storageObject` relation through `storageKey` remains, but it is no
longer sufficient alone to identify the object-store version.

### 5.3 Existing P1-3 chain reuse

Reuse:

```text
FileUploadIntent
FileUploadAttempt
StorageObjectLifecycle
StorageObjectOperation
```

MVP states:

```text
Intent:
  PENDING -> UPLOADING -> COMPLETED | FAILED | EXPIRED

Attempt:
  RESERVED -> WRITING -> READY -> FINALIZING -> COMPLETED
  RECOVERY_REQUIRED | FAILED | ABANDONED

Lifecycle:
  STAGING_RESERVED -> STAGING -> STAGING_READY -> FINALIZING -> ACTIVE
  FAILED_RETAINED

Operation:
  PREPARED -> EXECUTING -> APPLIED | UNKNOWN | FAILED | ABANDONED
```

For object storage:

- `StorageObjectLifecycle.storageBackend = OBJECT_STORE`;
- the staging lifecycle and keys are logical database coordination records;
- only the canonical provider object is written through the server adapter;
- the staging logical lifecycle must not be treated as a physical local file;
- the current local `DELETED` assumption in the completed-upload trigger must
  be branched to a retained staging state for object storage, without
  physical deletion.

This branch is a required database change. It is not acceptable to mark a
staging lifecycle `DELETED` without exact Provider delete evidence.

## 6. Provider Adapter Design

The adapter is provider-neutral and server-only:

```text
StorageObjectWriteCapability
  putImmutable(input): exact object version result
  headExact(input): current exact-version metadata
  readExact(input): bounded/streamed exact-version bytes

StorageObjectReadCapability
  headExact(input)
  readExact(input)
```

No `delete` method is exposed in the MVP adapter. No method accepts a raw
client-supplied object key. Required input identity:

```text
bindingId
operationId
attemptId
providerKind
accountScopeRef
region
bucketOrContainer
objectKey
expectedSizeBytes
expectedChecksumSha256
```

Result:

```text
providerVersionId
providerGeneration
observedSizeBytes
observedChecksumSha256
observedETag
requestId
```

Capability requirements before enabling the object route:

- server-only credentials for the Ingest/Write identity;
- read-only credentials for Worker/Read identity;
- exact version token/generation retrieval;
- exact-version readback;
- stable request ID/error mapping;
- no unconditional same-key overwrite path;
- lifecycle automation cannot delete DB-referenced versions;
- provider region/account/data-residency approval.

If the selected provider cannot supply exact-version readback, the route is
disabled. There is no local fallback or blind retry.

## 7. Web, Worker and Provider Permission Boundary

### 7.1 Web

Allowed:

- authenticate actor and project;
- require `file.upload` or `file.read`;
- create/claim logical Intent/Attempt;
- call server-side Ingest/Publisher adapter;
- create/verify binding;
- finalize FileVersion after exact readback;
- server-proxy authorized reads.

Not allowed:

- Provider credentials in browser;
- direct canonical write from a client;
- arbitrary object key;
- Provider delete;
- automatic cleanup/purge;
- list or read objects outside approved project scope.

### 7.2 Worker

Allowed:

- read a FileVersion's verified binding;
- exact-version read with size/SHA verification;
- process extraction and write extraction/review/security/audit records.

Not allowed:

- Provider upload/write credential;
- Provider delete credential;
- direct object key from an untrusted job message;
- reading an unbound or legacy row through the v2 object path;
- cleanup/purge/restore.

### 7.3 Provider credentials

Credentials live only in the server-side adapter configuration/secret store.
They are not stored in database rows, browser responses, logs, job payloads or
URLs. Web and Worker use separate capability grants if the selected Provider
supports them.

The current `elevator_app` database owner is not a valid production
Web/Worker/Maintenance separation. Separate DB roles and ACL evidence are a
blocker for claiming production permission isolation.

## 8. Exact Upload and Binding Sequence

### 8.1 Normal sequence

```text
1. Web authenticates actor and project.
2. Validate request key, fingerprint, target ownership and file policy.
3. In one database transaction:
   - create/reuse Intent;
   - create one Attempt with a fresh staging logical key;
   - create STAGING_RESERVED lifecycle;
   - create PREPARED FINALIZE operation;
   - reserve one canonical object key;
   - create PENDING StorageObjectBinding with operation/lifecycle identity.
4. Commit before the Provider call.
5. Stream the request body through the server adapter.
6. Validate Content-Length, real MIME, size and SHA-256.
7. Provider writes to the reserved canonical key without reuse.
8. Obtain exact provider version/token/generation and read back exact bytes.
9. If size/hash match, CAS binding PENDING -> VERIFIED in one transaction.
10. Finalize logical Operation/Attempt/lifecycle and FileVersion/Extraction
    in one database transaction.
11. Commit, then enqueue processing.
```

The response-loss cases are split:

- Provider call response lost: retain PENDING/UNKNOWN, exact read by key, then
  bind.
- DB commit response lost: new connection reads binding/operation/attempt and
  returns the existing FileVersion.

### 8.2 Current local finalize replacement

For Route C-Minimal, the local `LocalPrivateStorage.finalize` is not used as
the object publication primitive. The adapter writes directly to the reserved
canonical key through a server-only Provider capability. The local
`writeToStaging`/`rename` path remains limited to bounded-local development
and must not be reused as the object route.

For Bounded-Local, the existing `LocalPrivateStorage.finalize` must not be
claimed safe until its check-then-rename window is replaced by a reviewed
no-overwrite/local publication primitive.

### 8.3 Duplicate request

The idempotency identity is:

```text
uploader + requestKey -> Intent
Intent + attempt generation -> Attempt
Attempt + operation -> Binding
```

Rules:

- Same request key and same fingerprint returns the existing state.
- Same request key and different fingerprint fails before Provider call.
- Same completed request returns the existing FileVersion.
- A new attempt after terminal failure must have a fresh staging/canonical key
  and a new binding; historical rows remain immutable.
- Two requests for the same FileVersion must use a unique current pointer and
  an exact database CAS. Only one can become current.

## 9. Read, Integrity and Worker Binding

### 9.1 Download

The minimal read sequence is:

```text
authenticated project file.read
-> File belongs to project
-> FileVersion belongs to File
-> FileVersion has OBJECT_STORE binding
-> binding is VERIFIED
-> provider exact version/token expected
-> bounded exact read
-> size and SHA-256 match
-> scan/integrity policy passes
-> server-proxied response
```

No response contains `storageKey`, `providerVersionId`, physical path,
credentials or raw Provider URLs.

### 9.2 Worker

The Worker must select:

```text
FileExtraction
-> FileVersion
-> StorageObjectBinding
-> exact provider object version
```

The job payload may contain extraction ID and FileVersion ID, but not a
trusted object key, provider version or project ID. The Worker re-reads all
relationships from the database and exact Provider readback.

A mismatch produces `FileSecurityEvent`, sets `integrityStatus=FAILED`, blocks
processing and retains the object. It does not substitute a newer key,
fallback representation or delete the object.

## 10. Deletion and Cleanup Boundary

MVP decision:

```text
Web delete:                NOT IMPLEMENTED
Worker delete:             NOT IMPLEMENTED
Automatic staging cleanup: DISABLED
Automatic orphan cleanup:  DISABLED
Automatic purge:           DISABLED
Automatic restore:         DISABLED
Legacy cleanup:            FAIL-CLOSED
Provider lifecycle delete: DISABLED
```

The current no-delete behavior already exists:

- `cleanupExpiredUploadIntents` throws;
- `QuarantinedLegacyStorageCleanup` throws for every method;
- no business File/FileVersion DELETE route exists.

MI1 implementation must keep this behavior and add negative tests proving no
new upload/error path calls a delete, rename-over-target, provider delete,
purge, restore or orphan cleanup API.

## 11. Schema and Migration Plan

### 11.1 Batch A — expand only

Forward migration, no Provider call:

1. Add `StorageBackend` enum and `StorageObjectBinding` table.
2. Add `StorageObjectLifecycle.storageBackend` nullable for existing rows.
3. Add `FileVersion.storageBackend` nullable and
   `storageObjectBindingId` nullable.
4. Add unique/composite anchors for binding, lifecycle, operation and
   FileVersion.
5. Add append-only and terminal-immutability triggers for binding.
6. Add object-route branches to P1-3 triggers without changing existing local
   behavior.

### 11.2 Batch B — classify existing data

1. Inventory existing FileVersion/lifecycle rows in an isolated clone.
2. Classify deterministic local rows as `LEGACY_LOCAL` only when the existing
   storage/lifecycle relation is valid.
3. Leave unprovable rows legacy/read-only; do not fabricate attempts,
   bindings, provider versions or close evidence.
4. Do not run the backfill against a development or production database
   without separate authorization.

### 11.3 Batch C — contract

After isolated validation:

1. Make `storageBackend` and `storageObjectBindingId` required under the
   object/local matrix.
2. Tighten object-route triggers.
3. Keep historical no-fabrication and no-cleanup behavior.

The exact migration name must be new and forward-only; the existing
`20261117120000_phase37_p13_storage_lifecycle_schema` must not be edited.

## 12. Source Modification List

### 12.1 Database/Schema

- `prisma/schema.prisma`
- new forward migration under `prisma/migrations/`
- existing P1-3 database test fixtures/builders only in a separately
  authorized test phase

### 12.2 Contracts and storage package

- `packages/contracts/src/index.ts`
  - upload/attempt status contracts if API response changes;
  - safe error taxonomy for object binding failures.
- `packages/file-storage/src/capabilities.ts`
  - separate object write/read capabilities; no delete capability.
- `packages/file-storage/src/index.ts`
  - export the new adapter/interface only.
- new `packages/file-storage/src/object-storage-adapter.ts`
  - provider-neutral port, exact version result, no raw key acceptance.
- new `packages/file-storage/src/object-storage-errors.ts`
  - capability, exact-version, response-loss and integrity errors.

### 12.3 Web

- `apps/web/src/server/files/storage.ts`
  - instantiate the server-only object adapter while preserving local fallback
    only for bounded development.
- `apps/web/src/modules/files/upload-service.ts`
  - create Attempt/Lifecycle/Operation/Binding before Provider I/O;
  - compute/verify hash;
  - exact readback;
  - finalize only after binding VERIFIED;
  - populate all required FileVersion chain fields;
  - preserve failures.
- `apps/web/src/modules/files/download-service.ts`
  - select exact binding, verify binding state/version/size/hash before read.
- `apps/web/src/modules/files/file-query-service.ts`
  - keep object keys and provider version tokens out of public response.
- upload/download Route Handlers
  - preserve auth, project scope, Content-Length, MIME, no-store and response
    safety headers; add safe pending/unknown/recovery responses where needed.

### 12.4 Worker

- `apps/worker/src/storage.ts`
  - create only exact-read object capability.
- `apps/worker/src/file-processing.ts`
  - read FileVersion -> binding -> exact object version;
  - never use a job-provided storage key;
  - retain no-write/no-delete behavior.
- `apps/worker/src/file-maintenance.ts`
  - remain extraction recovery/requeue only; do not add storage cleanup.

### 12.5 Tests

- `apps/web/tests/integration/phase32-upload-service.test.ts`
- `apps/web/tests/integration/phase33-file-access.test.ts`
- `apps/web/tests/integration/phase35-processing-reliability.test.ts`
- `apps/web/tests/integration/phase31-schema.test.ts`
- `apps/web/tests/e2e/` file flow
- `packages/file-storage/tests/local-private-storage.test.ts`
- new `packages/file-storage/tests/object-storage-adapter.test.ts`
- new DB fixture/constraint tests for binding/trigger matrix
- `apps/worker/tests/` exact-binding, wrong-object, no-write/no-delete tests

All tests must use a disposable clone and synthetic Provider objects.

## 13. Twelve RA1 Acceptance Scenarios

Each scenario names a real code path and required test type.

| ID | Real code path | Test type | Initial state | Expected DB state | Expected Provider state | Forbidden side effect / evidence |
|---|---|---|---|---|---|---|
| `RA1-V01` | upload route -> `completeUpload` -> adapter -> binding -> FileVersion | Web integration, DB clone, fake/sandbox provider | Intent/Attempt/Lifecycle/Operation/binding PENDING; no FV | Intent COMPLETED; Attempt COMPLETED; Operation APPLIED; binding VERIFIED; exactly one FileVersion/current pointer | exactly one exact-version object; size/hash match | no second FV/object; no overwrite; audit contains one upload result |
| `RA1-V02` | upload route -> streaming adapter interruption | Web integration + fault proxy | Intent UPLOADING; attempt WRITING; binding PENDING | Attempt FAILED_RETAINED/RECOVERY_REQUIRED; no FV/current pointer | partial object may exist; no known version or exact retained version | no delete, no blind replay, no completed FileVersion; failure audit retained |
| `RA1-V03` | adapter response -> DB finalization response loss | Web integration, test DB transaction fault injection | binding/adapter result exists; DB commit response lost | New DB connection sees binding/operation/FV or deterministic UNKNOWN | exactly one provider object/version | no second provider write; retry returns existing result |
| `RA1-V04` | POST intent + PUT content repeated | Web integration | Same uploader/requestKey/fingerprint; first request completed | same Intent/FV; no new row | at most one object version | no duplicate upload/FileVersion; same error class if fingerprint differs |
| `RA1-V05` | concurrent complete/current pointer | two DB connections + fake provider | two requests target same FileVersion/current pointer | exactly one winner/current pointer; loser rejected/retained | no second accepted version | no dual current pointer; no last-write overwrite |
| `RA1-V06` | adapter readback / file-service integrity path | Provider fake returns wrong bytes; Web/Worker integrity | expected hash A; observed hash B | binding not VERIFIED; no FV; SecurityEvent/integrity block | wrong object retained; exact version identified | no read/publish; no delete/latest-key fallback |
| `RA1-V07` | download route + `prepareFileDownload` | Web API integration/E2E | FileVersion of project A; actor project B | request denied; blocked audit event | no object read | no bytes, metadata, key or path leakage |
| `RA1-V08` | no business DELETE route; legacy cleanup methods | API/static test | existing FileVersion/object | no DB/object mutation | object remains | no Provider delete, purge, restore or orphan cleanup |
| `RA1-V09` | Worker `processFileRecognitionJob` -> binding read | Worker unit/integration | job extraction points to wrong/stale object identity or binding | extraction blocked/failed; no accepted wrong bytes event | exact referenced object remains | no raw storageKey substitution; no Worker write/delete |
| `RA1-V10` | adapter timeout/unavailable | Web/Worker fault injection | reserved binding/operation; no exact response | attempt/binding retained as recovery/failed; no FV | no confirmed version or unknown retained | no cleanup, no success marking, no silent fallback |
| `RA1-V11` | DB/provider mismatch reconciliation | DB clone + fake provider | provider object exists without binding, or binding VERIFIED but object absent | conflict/FAILED_RETAINED; read/process blocked; no fabricated FV | exact object retained if present | no delete; no alternate object substitution; mismatch SecurityEvent |
| `RA1-V12` | process restart after provider/DB step | integration with process boundary/restart simulation | binding/operation durable; process killed before next response | restart reads durable state and either returns existing FV or recovery state | exactly one exact object | no memory-only success, no duplicate object/FV, no blind retry |

All twelve require:

```text
exact initial rows
explicit transaction and Provider call boundaries
expected rowcounts
expected error class/SQLSTATE where applicable
final DB and Provider snapshots
negative absence queries
an audit/security event where the failure must be visible
```

## 14. Implementation Batching

### Batch 1 — Low-risk contracts and pure adapter boundary

Can be authorized together:

- add object read/write capability types;
- add exact-version result/error types;
- add upload response/recovery contracts;
- add pure adapter contract tests with no external side effects;
- add source-level checks that no delete method exists.

Gate: no database or Provider connection.

### Batch 2 — Expand data model on isolated clone

Requires separate database implementation authorization:

- add `StorageObjectBinding`;
- add FileVersion binding/backend fields;
- add Branch constraints and P1-3 object backend trigger branches;
- run `db:validate`, `db:generate`, isolated migration and constraint tests.

Gate: no development or production database.

### Batch 3 — Upload and exact binding

Requires separate source + sandbox Provider authorization:

- wire upload route/service;
- write exact binding before Provider I/O;
- exact readback and binding transition;
- populate required P1-3 FileVersion chain fields;
- no delete/cleanup methods.

Gate: fake Provider tests must prove no blind retry and no overwrite.

### Batch 4 — Download and Worker

Requires separate authorization:

- download selects exact binding;
- Worker selects exact binding and remains read-only;
- cross-project/object mismatch tests;
- no storageKey in API/job/response.

### Batch 5 — Failure recovery and 12-scenario acceptance

Requires isolated DB clone and Provider sandbox:

- response-loss, restart, mismatch and concurrency tests;
- DB/provider audit and negative assertions;
- service restart simulation;
- no cleanup/delete calls.

### Batch 6 — Production permissions

Separate high-risk approval:

- database roles;
- Provider IAM;
- Worker read-only credential;
- Web write-only/no-delete credential;
- deployment/ACL evidence.

No production enablement is included in Batches 1–5.

## 15. Blockers and Stop Conditions

Current blockers:

- Provider/account/region and data-residency choice;
- exact Provider version/readback capability;
- Provider conditional/unique-key semantics and audit/error mapping;
- separate DB roles/ACL and `PUBLIC EXECUTE` changes;
- real historical FileVersion/lifecycle inventory;
- current source FileVersion chain omission;
- current P1-3 trigger local `DELETED` assumption for completed staging;
- actual isolated PostgreSQL behavior;
- production deployment not authorized.

Stop immediately if:

- the selected Provider has no exact version or exact readback;
- a stale attempt can write the same canonical key;
- the server must expose a Provider write/delete credential to Web, Worker or
  browser;
- a successful binding cannot be proven by size/SHA/version evidence;
- any code path performs automatic delete, purge, restore or orphan cleanup;
- the existing P1-3 FileVersion chain cannot be populated without fabrication;
- the object backend cannot use the existing Intent/Attempt/Lifecycle/
  Operation chain without weakening lifecycle safety;
- historical rows cannot be classified deterministically.

## 16. Historical and External Status Preserved

```text
R5 57 Open Decisions:                         OPEN
BV7:                                          FAIL
BV8:                                          NOT INDEPENDENTLY APPROVED
R8:                                           BLOCKED
P2-05 business policy:                        OPEN
Old upload chain / P1-3 integration:          NOT IMPLEMENTED
Current FileVersion creation:                 OMITS P1-3 CHAIN FIELDS
P1-3 app CAS/close recovery/locks:             NOT IMPLEMENTED
Provider/region/credentials/IAM:               NOT VERIFIED
Trust root/manifest/Capability Lease:           NOT VERIFIED
Historical object inventory:                   NOT VERIFIED
Production DB roles/ACL:                       NOT VERIFIED
Production deployment:                         NOT AUTHORIZED
```

## 17. Git and Integrity

At MI1 start:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       0
Staged:                 0
Deleted:                0
Untracked:              36
```

This report is the only file added by MI1. Final whole-file SHA-256, byte
count, line count and final untracked count are supplied as delivery metadata
after the report is frozen.

No source, Schema, Migration, Trigger, test, configuration, database, Provider,
Storage, IAM, ACL, Trust Root, service, Build, E2E, Native RPC or deployment
operation was modified or executed.

The following were not read, hashed, modified, moved, deleted or started:

```text
$null
UNKNOWN'
apps/web/.next
apps/worker/dist
```

## 18. Final Verdict

```text
WP-2A-MI1:
  MI1 READY WITH BLOCKERS

Chosen route:
  Route C-Minimal

Implementation batch:
  READY TO DEFINE — NOT YET AUTHORIZED

R7 five P1:
  full D3-D6 findings remain deferred; not inherited by C-Minimal

12 RA1 scenarios:
  12/12 MAPPED TO CODE PATHS AND TEST TYPES

Current source integration:
  NOT IMPLEMENTED

Source implementation:
  NOT AUTHORIZED

Provider / Database / Storage / IAM / Runtime:
  NOT VERIFIED
```
