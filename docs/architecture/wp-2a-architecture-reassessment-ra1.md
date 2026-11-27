# WP-2A-RA1 — Route C Architecture Reassessment and MVP Scope Reduction

## 0. Document Control

```text
Stage:
  WP-2A-RA1

Mode:
  READ-ONLY ARCHITECTURE REASSESSMENT

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

Input R7 SHA-256:
  B3DB4A74D652E6EA8C6710DA0F647FA4F067D44779B3C72D79F2B7E36165A3BC

Final conclusion:
  RA1 COMPLETE — MINIMAL ARCHITECTURE RECOMMENDED
```

This report is a read-only architecture decision. It does not modify source,
Prisma Schema, Migration, Trigger, test, configuration, policy, ACL, IAM or Git
history. It does not authorize D8, isolated runtime validation or
implementation.

## 1. Executive Decision

The preferred target architecture is:

```text
Route C-Minimal
  server-proxied object storage
  + one immutable object key per FileVersion
  + exact Provider object version binding
  + existing P1-3 Intent/Attempt/Lifecycle/Operation chain
  + DB business authority
  + no automatic destructive cleanup
  + no Web/Worker direct Provider credentials
```

The full D3-D6 protocol is not the first MVP design. It is retained only as a
future high-assurance extension after its five R7 P1 findings are independently
closed.

The current local filesystem path may be used only as a bounded local
development/demo harness. It must not be treated as the production target and
must not enable automatic cleanup.

The selected route is not yet implementation-ready because no Provider,
region, account, IAM, retention policy or production database role set is
approved. Those are explicit external gates, not reasons to restore the
complex D3-D6 protocol.

## 2. Evidence and Source Baseline

Evidence classes:

| Label | Meaning |
|---|---|
| `SOURCE VERIFIED` | Read from current source, Schema, Migration or tests |
| `HISTORY VERIFIED` | Read from D3-D6/R3-R7 reports |
| `INFERRED` | Architecture recommendation derived from evidence |
| `NOT VERIFIED` | Requires target environment |
| `BLOCKED` | External choice or approval required |

### 2.1 Current upload path

`SOURCE VERIFIED`:

- `apps/web/src/app/api/projects/[projectId]/files/upload-intents/route.ts`
  authenticates the actor, requires project `file.upload`, checks origin,
  validates `Idempotency-Key`, and calls `createUploadIntent`.
- `apps/web/src/modules/files/upload-service.ts:155-238` creates a
  `FileUploadIntent` with a random `stagingKey`, but does not create a
  `FileUploadAttempt`, `StorageObjectLifecycle` or `StorageObjectOperation`.
- `apps/web/src/modules/files/upload-service.ts:267-591` claims only the
  Intent `PENDING -> UPLOADING`, streams through `writeToStaging`, detects MIME,
  assigns a random `objects/<uuid>` key, calls `storage.finalize`, and creates
  File/FileVersion/Extraction/current-version rows in a Prisma transaction.
- The FileVersion creation at lines 474-501 supplies `storageKey`,
  `uploadStatus`, and file metadata but omits the required
  `uploadIntentId`, `uploadAttemptId` and `creationOperationAttemptId`
  fields defined in `prisma/schema.prisma:409-411`.
- Failure handling at lines 592-648 marks the Intent failed but intentionally
  retains physical artifacts. It does not have a recovery worker or an exact
  binding record to reconcile the retained object.

### 2.2 Current storage path

`SOURCE VERIFIED`:

- `packages/file-storage/src/local-private-storage.ts:108-166` uses an
  exclusive staging file (`wx`, mode `0600`) and computes size/hash while
  streaming.
- The same class `finalize()` at lines 168-192 performs `fs.access(objectPath)`
  and then `fs.rename(stagingPath, objectPath)`. The check and rename are not
  one atomic no-overwrite operation; a concurrent target can be replaced or
  race between check and rename.
- `readVerifiedObject()` at lines 211-479 performs a stronger same-handle
  read, size/checksum/path identity checks and rejects symlinks, but this is a
  read path, not proof that every writer has closed.
- `apps/web/src/server/files/storage.ts` exposes a Web runtime capability and
  `apps/worker/src/storage.ts` exposes only a read capability. This is a good
  boundary, but it is not a Provider identity boundary.

### 2.3 Current download and Worker paths

`SOURCE VERIFIED`:

- The download route requires `file.read` and project scope before calling
  `prepareFileDownload`.
- `apps/web/src/modules/files/download-service.ts:233-312` verifies File,
  FileVersion, project, upload/validation/integrity/scan policy.
- It reads `version.storageKey` through `readVerifiedObject` at lines 439-501
  and compares size/SHA-256 before streaming.
- `apps/worker/src/file-processing.ts:331-479` claims a FileExtraction with a
  processing token, checks project permissions, scan policy and user, then
  reads `extraction.fileVersion.storageKey` via `openReadStream` at lines
  483-489 and verifies SHA/MIME in-process.
- `apps/worker/src/file-maintenance.ts:117-251` currently recovers stale
  extractions and requeues work; it does not perform physical storage cleanup.
- Neither path proves the P1-3 lifecycle state or an exact provider object
  version; both trust the FileVersion `storageKey` and current database row.

### 2.4 Current P1-3 schema and cleanup

`SOURCE VERIFIED`:

- `prisma/schema.prisma:398-443` defines FileVersion with non-null
  `uploadIntentId`, `uploadAttemptId` and `creationOperationAttemptId`.
- `prisma/schema.prisma:501-655` defines the current Intent/Attempt/
  Lifecycle/Operation models.
- `prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql`
  contains local close-attestation, lifecycle state allowlists, active
  FileVersion guards and cleanup attestation requirements.
- The P1-3 migration explicitly requires empty upload/file tables; it is not a
  historical backfill migration.
- `apps/web/src/modules/files/upload-service.ts:147-153` fails closed for
  legacy intent cleanup.
- `packages/file-storage/src/legacy-cleanup.ts` fails closed for all legacy
  delete/cleanup methods.
- There is no Web business DELETE route for File/FileVersion in the current
  API tree.

`HISTORY VERIFIED`:

- `docs/architecture/file-lifecycle-p13-implementation-status.md` records
  `P1-3 application integration: NOT_IMPLEMENTED`, `close attestation:
  NOT_IMPLEMENTED`, generation CAS/locking/Runtime `NOT_IMPLEMENTED`, and
  special cleanup/quarantine/restore paths `BLOCKED`.
- The current TypeScript integration is known to fail because the old upload
  chain does not satisfy the P1-3 FileVersion fields/triggers.

## 3. Historical Review Summary

The history is not a sequence of approvals; it is a sequence of narrowing
attempts whose independent reviews remained failed or partial:

| Stage | Result | Consequence |
|---|---|---|
| D3/R4 | `FAIL`; complex acceptance/authority staging defects | D4 added more states and locks |
| D4/R5 | `FAIL`; 6 P1 | D5 added owner/action/evidence detail |
| D5/R6 | `FAIL`; canonicalization and relationship errors | D6 added more DDL detail |
| D6/R7 | `FAIL`; 5 P1 remain | Stop D8; reassess scope |

The D3-D6 designs contain valuable principles, but no version has passed
independent review as an isolated validation baseline. The number of new
tables, Evidence classes, authority sessions, trust manifests, destructive
operations and test vectors is far beyond the current MVPs proven needs.

## 4. Route Comparison

### 4.1 Route C-Full

Definition:

```text
Full D3-D6 object-storage authority protocol
  ProviderEffect/Owner
  AuthoritySession/Claim
  UploadAction ledger
  typed Evidence
  DispatchPermit
  InvestigationSnapshot
  RepresentationSlot/Attempt
  TrustRoot/Manifest/CapabilityLease
  Migration/rollback
  Quarantine/recovery/purge
```

Actual benefits:

- strongest support for exact Provider side-effect ownership;
- explicit response-loss and late-Writer treatment;
- append-only evidence and exact-version binding;
- future destructive-cleanup and multi-provider migration capability.

Actual costs and risks:

- requires many new tables and 14 Evidence subtypes;
- requires cross-role/Provider/IAM/trust-root evidence;
- requires exact PostgreSQL behavior that has not been executed;
- requires a Provider capability matrix, exact-version copy/read/delete/audit
  support and operational runbooks;
- D6/R7 still has five P1 findings:
  1. invalid/incomplete Permit and epoch FK anchors;
  2. incomplete Evidence base/subtype enforcement;
  3. unproven Snapshot/cleanup gate;
  4. under-materialized 52-test suite;
  5. no legal retry after a Permit is consumed before the external call.
- every additional retry/recovery primitive expands the state space and
  requires another independent review cycle.

Decision:

```text
DEFER
```

Retain the design as a future high-assurance extension. Do not start D8 by
default. Do not implement its full table set for the MVP.

### 4.2 Route C-Minimal

Definition:

```text
Server-proxied object storage
  + one immutable key per upload attempt/FileVersion
  + exact provider object version binding
  + existing P1-3 logical lifecycle
  + DB business authority
  + no automatic cleanup or arbitrary delete
```

Advantages:

- removes Windows file-handle/mmap/Reparse Point authority from the critical
  publication path;
- retains the existing FileVersion business graph and downstream extraction/
  security/audit FKs;
- has a smaller model than D3-D6: one binding, one upload operation, one
  current attempt, no 14 Evidence classes;
- can reuse current server-side auth, project authorization, MIME/size/hash
  checks, Worker read-only capability and maintenance lease patterns;
- supports exact object identity and readback without claiming that a DB
  transaction can cancel a Provider operation;
- keeps destructive cleanup disabled until a separate reviewed phase.

Constraints:

- requires a chosen Provider/region/account and IAM design;
- requires a Provider capability policy for conditional create/versioning and
  exact-version read;
- single-stream upload is the first MVP capability; multipart/resumable is
  deferred;
- no Provider lifecycle rule may delete a DB-referenced object;
- no direct browser or Web/Worker Provider credentials;
- no automatic cleanup, purge, restore or rollback;
- exact-version binding and readback must be a database-enforced business
  prerequisite, not an audit annotation.

Decision:

```text
SELECT AS TARGET MVP ARCHITECTURE
```

### 4.3 Route Bounded-Local

Definition:

```text
Current local private storage, without a Windows Storage Authority Broker,
limited to disposable/isolated development or demo operation
```

Advantages:

- no provider/region/IAM prerequisite;
- smallest immediate code delta from the existing repository;
- current read path has useful path, identity, size and checksum checks;
- suitable for DEMO_MOCK and test fixtures with synthetic files.

Constraints:

- `LocalPrivateStorage.finalize()` is not a safe no-overwrite primitive because
  it uses check-then-rename;
- Lease/generation does not prove old writer handles are closed;
- Worker/Web multi-process writes and stale file handles remain hard to fence;
- Node core cannot prove all Windows Reparse Point and handle semantics;
- backup, disk loss, host migration and multi-host access are operational
  risks;
- no automatic cleanup should be enabled;
- no production customer data or production deployment.

Decision:

```text
DEVELOPMENT/DEMO ONLY
```

It may be used as an isolated harness while the Provider decision is pending,
provided:

1. no production data;
2. one writer identity/process at a time;
3. Worker is read-only;
4. no automatic physical deletion;
5. failed artifacts are retained and manually investigated;
6. test fixtures are synthetic;
7. no claim of Windows authority or production readiness.

It is not the selected target architecture.

## 5. R7 Five P1 Disposition by Route

| R7 P1 | C-Full | C-Minimal | Bounded-Local |
|---|---|---|---|
| Invalid/incomplete Permit/epoch FKs | Remains a blocker; D8 would be required | Removed by not using DispatchPermit/ProviderEffectOwner/trust epochs in MVP | Not applicable; use only the existing logical chain |
| Evidence base/subtype incompleteness | Remains a blocker; 14 subtypes need complete DDL | Avoided: use exact object binding + one readback result + existing AuditLog/SecurityEvent; no 14-class Evidence claim | Not applicable; current FileSecurityEvent/AuditLog only |
| Snapshot/cleanup gate incomplete | Remains a blocker; snapshot and destructive permit require another design | Destructive cleanup, quarantine, restore and purge are out of scope; retain failed objects | Same: delete/cleanup disabled |
| Under-materialized 52 tests | Remains a blocker; all tests need materialization | Do not inherit them; define a new 12-scenario MVP suite with exact rows | Use the same 12-scenario suite where local semantics apply |
| Permit consumed before Provider call has no retry path | Remains a blocker; requires generation/permit redesign | Replace permits with an attempt-bound idempotent upload operation and operator-visible recovery; retry is a new attempt or exact readback, never a blind duplicate | Local equivalent uses Attempt/Operation CAS; OS handle/rename uncertainty remains a blocker |

This disposition is a scope decision, not a claim that the five D3-D6 P1s were
all fixed. They remain open for the deferred full protocol.

## 6. Recommended MVP Capability Boundary

### 6.1 Supported in the first Route C-Minimal slice

- Existing authenticated Web/API upload and download routes.
- Project-scoped `file.upload` and `file.read` authorization.
- PDF, JPEG and PNG only; 20 MiB maximum.
- Server-side stream through an Ingest/Storage proxy; no browser object
  credentials.
- One immutable object key per upload attempt/FileVersion.
- Exact provider object version ID/token (and generation if the selected
  provider requires it).
- Server-computed size and SHA-256; provider readback verification.
- FileVersion only after exact binding and readback.
- Private server-proxied download with current integrity/scan policy.
- Worker reads only the exact bound object version; no Worker write/delete.
- Immutable FileVersion, Extraction, SecurityEvent and AuditLog behavior.
- Failed uploads retained as `FAILED_RETAINED` or operator-visible recovery
  state; no automatic cleanup.
- Manual backup/restore runbook for metadata and provider versions.

### 6.2 Explicitly unsupported in the first slice

- Customer or ordinary Web file deletion.
- Automatic staging/orphan/object cleanup.
- Purge, quarantine recovery, restore, rollback or destructive cleanup.
- Provider multipart/resumable upload and abort workflows.
- Provider lifecycle rules that delete DB-referenced versions.
- Cross-region replication as a correctness guarantee.
- Full D3-D6 EffectOwner/AuthoritySession/Permit/14-Evidence protocol.
- Windows Storage Authority Broker or Native RPC.
- Historical file migration without an approved inventory and backfill.
- Real AI, OCR or real customer data.
- Production deployment.

## 7. Minimum Security Invariants

The following are non-negotiable for the MVP:

1. All reads/writes start from a server-side authenticated actor and project
   scope; URL or request IDs never establish authorization.
2. FileVersion is immutable after upload finalization.
3. An object key is generated server-side, non-user-controlled and not reused.
4. A FileVersion is created only when:

```text
one exact StorageObjectBinding exists
AND binding state is VERIFIED
AND binding size/SHA-256 match the operation snapshot
AND binding provider version/token is present
AND P1-3 FINALIZE operation is APPLIED
AND lifecycle is ACTIVE
```

5. FileVersion storageBackend and binding are inseparable; an OBJECT_STORE
   FileVersion cannot be created without a VERIFIED binding.
6. Web and Worker cannot receive Provider write/delete credentials.
7. Worker and read paths use the exact binding, not a client-provided or
   job-provided raw key.
8. No failure path deletes canonical/provider objects.
9. A provider success with uncertain DB commit is reconciled by durable
   FileUploadAttempt/Operation/binding rows; it is never assumed successful
   from memory.
10. A DB success whose response is lost is replayed by the same immutable
   attempt/idempotency identity.
11. Provider unavailable/missing/unreadable objects block reads and processing,
   mark integrity/security state, and retain evidence; no latest-key fallback.
12. No Provider lifecycle rule or automated cleanup may remove a version
   referenced by FileVersion, binding or append-only history.

## 8. Minimum Database Model

The existing File/FileVersion/Extraction/Review/SecurityEvent/Audit graph stays.
The minimum new relation for Route C-Minimal is:

### 8.1 `StorageObjectBinding`

Fields:

```text
id
fileVersionId               UNIQUE, required for OBJECT_STORE
operationId                 required
providerKind
accountScopeRef             non-secret reference
region
bucketOrContainer
objectKey
providerVersionId
providerGeneration NULL
sizeBytes
checksumSha256
state: PENDING | VERIFIED | FAILED_RETAINED
createdAt / verifiedAt
```

Constraints:

```text
UNIQUE(fileVersionId)
UNIQUE(providerKind,accountScopeRef,region,bucketOrContainer,
       objectKey,providerVersionId)
FK(fileVersionId) -> FileVersion(id) RESTRICT
FK(operationId) -> StorageObjectOperation(id) RESTRICT
CHECK providerVersionId present before state=VERIFIED
CHECK sizeBytes > 0 and checksumSha256 matches 64 hex
CHECK VERIFIED binding identity/content is immutable
append-only terminal history; no ordinary UPDATE/DELETE
```

`fileVersionId` is nullable only for a pre-finalization binding waiting for
the FileVersion transaction; after finalization it is required. The binding
is created before the Provider write and cannot be repointed to another
FileVersion.

### 8.2 Reused P1-3 tables

```text
FileUploadIntent
FileUploadAttempt
StorageObjectLifecycle
StorageObjectOperation
```

The MVP uses only:

```text
Intent PENDING/UPLOADING/COMPLETED/FAILED/EXPIRED
Attempt RESERVED/WRITING/READY/FINALIZING/COMPLETED/
        ABANDONED/FAILED/RECOVERY_REQUIRED
Lifecycle STAGING_RESERVED/STAGING/STAGING_READY/
          FINALIZING/ACTIVE/FAILED_RETAINED
Operation PREPARED/EXECUTING/APPLIED/UNKNOWN/FAILED/
          ABANDONED
```

The MVP does not use `QUARANTINE`, `RESTORE` or `PURGE` operations.

### 8.3 FileVersion additions

The minimum additions are:

```text
storageBackend: LEGACY_LOCAL | OBJECT_STORE
storageObjectBindingId: nullable only for LEGACY_LOCAL
```

Required invariant:

```text
storageBackend=OBJECT_STORE
  -> storageObjectBindingId NOT NULL
  -> binding state VERIFIED
  -> binding.fileVersionId = this FileVersion
  -> binding.objectKey = storageKey
  -> binding.sizeBytes = FileVersion.sizeBytes
  -> binding.checksumSha256 = FileVersion.checksumSha256

storageBackend=LEGACY_LOCAL
  -> binding NULL
  -> ordinary v2 upload/processing path disabled until classified
```

The exact implementation may instead use a typed local/object relation table;
it must not rely on a nullable `storageKey` string alone.

### 8.4 Current FileVersion chain

The existing required fields remain:

```text
uploadIntentId
uploadAttemptId
creationOperationAttemptId
```

Current `upload-service.ts:474-501` omits all three. The MVP cannot implement
FileVersion insertion until that source defect is fixed by a separately
authorized code change.

## 9. Minimal Upload Lifecycle

### 9.1 Reservation

```text
Web authenticated request
-> validate project/building/unit and permission
-> idempotent Intent lookup by (uploadedById, requestKey)
-> create/choose one Attempt
-> create STAGING_RESERVED lifecycle and FINALIZE operation
-> create PENDING StorageObjectBinding with server-generated objectKey
-> commit before any Provider write
```

The Intent/Attempt/Operation/binding records are the durable recovery anchor.

### 9.2 Server-proxied write

```text
stream request body through bounded buffer
-> validate Content-Length, real MIME and size
-> compute SHA-256 while streaming
-> provider conditional create / unique-key write
-> exact Provider version response or exact readback
-> persist providerVersionId, size, checksum and VERIFIED binding
-> finalize FileVersion/extraction/current pointer in one DB transaction
```

The browser never receives Provider credentials. Web does not hold a raw
Provider delete capability.

### 9.3 State on failure

| Failure point | DB state | Provider/object state | Allowed next action |
|---|---|---|---|
| Before write | Intent/Attempt/Operation recorded, no FileVersion | none | same attempt may retry only with exact idempotency identity |
| Stream interrupted | Attempt `FAILED_RETAINED` or `RECOVERY_REQUIRED`; no FileVersion | partial object may exist | retain; operator reads exact key; do not delete |
| Provider unavailable | Attempt `FAILED_RETAINED`/recovery; no FileVersion | unknown/no object | retain; retry only through a new attempt with new key/nonce |
| Provider success, response lost | Attempt `RECOVERY_REQUIRED`; binding PENDING/UNKNOWN | exact version may exist | exact key/version read; if exact match, CAS binding+operation and finalize |
| DB commit response lost | durable rows may be committed; unknown response | exact version recorded | new connection reads by binding/operation ID; return same FileVersion |
| Checksum/MIME mismatch | Attempt failed retained; no FileVersion | object retained | record SecurityEvent; no read/publish; no delete |
| Existing target | Attempt conflict; no overwrite | target untouched | report conflict; never rename over it |

`StorageObjectOperation.UNKNOWN` may only be resolved by exact Provider
readback or a new operation, never by elapsed lease alone.

## 10. Read, Delete and Worker Boundaries

### 10.1 Read

```text
requireApiActor
-> require project file.read
-> select File and FileVersion by project/file/version
-> require storageBackend=OBJECT_STORE and VERIFIED binding
-> provider exact-version read
-> verify size/SHA-256 and current scan/integrity policy
-> server-proxy response with no-store/attachment/sandbox headers
```

No response contains storageKey, Provider version, credentials or physical
path.

### 10.2 Delete

For MVP:

```text
customer delete: NOT SUPPORTED
Web object delete: NOT SUPPORTED
Worker object delete: NOT SUPPORTED
automatic cleanup: DISABLED
legacy cleanup: FAIL-CLOSED
operator destructive tool: OUT OF SCOPE UNTIL SEPARATE REVIEW
```

The API must return an explicit unsupported/forbidden result and must not
mutate the object. DB archival flags, if later needed, do not authorize
physical deletion.

### 10.3 Worker

Worker receives only:

```text
read-only exact binding read capability
no Provider write/delete credentials
no raw object key from job message
```

Worker selects `FileVersion -> StorageObjectBinding`, verifies exact
version/size/hash and then reads. A missing/mismatched object marks integrity
and security events and blocks processing.

## 11. Failure and Restart Protocol

1. Every durable operation starts with a DB row before external I/O.
2. Provider response loss is resolved by exact key/version readback and
   durable binding, not by blind Provider retry.
3. DB commit response loss is resolved by reading the durable
   Attempt/Operation/binding IDs; the retry returns the existing result.
4. A stale attempt cannot update a newer FileVersion; use the existing
   Attempt status/processing token/generation where applicable.
5. Provider object exists without DB binding: do not create FileVersion and
   do not delete; record an operator-visible orphan case.
6. DB binding says VERIFIED but Provider object is missing: mark integrity
   failed, block read/processing, retain metadata; do not fall back to a
   different key.
7. Service restart reconstructs state only from DB and exact Provider
   readback; no in-memory success assumption.

## 12. Twelve MVP Verification Scenarios

This is a verification definition only; no run is authorized here.

| ID | Scenario | Expected DB state | Expected object side effect | Forbidden side effect |
|---|---|---|---|---|
| `RA1-V01` | Successful PDF upload | Intent COMPLETED; Attempt COMPLETED; Operation APPLIED; binding VERIFIED; one FileVersion/current pointer | exactly one exact-version object; size/hash match | no second FileVersion, no second object version, no overwrite |
| `RA1-V02` | Upload interrupted mid-stream | Attempt FAILED_RETAINED/RECOVERY_REQUIRED; no FileVersion/current pointer | partial retained if written | no delete, no silent retry, no fabricated FileVersion |
| `RA1-V03` | Provider success but DB confirmation response lost | one durable binding/operation/FV or recoverable UNKNOWN | exact object retained | no second Provider write; retry returns same result |
| `RA1-V04` | Same request repeated with same Idempotency-Key/fingerprint | same Intent/Attempt/result | at most one exact object | no duplicate upload, no duplicate FileVersion |
| `RA1-V05` | Two requests compete for one FileVersion | one winner; unique/current pointer remains consistent | one exact object | no dual current pointer, no second version |
| `RA1-V06` | Provider bytes/checksum differ | no VERIFIED binding/FV; integrity/security event | mismatched object retained | no read/publish, no delete, no “latest key” fallback |
| `RA1-V07` | Cross-user read | request denied; audit blocked event | no object read | no metadata/path leak; no bytes streamed |
| `RA1-V08` | Unauthorized delete | request forbidden/unsupported | object unchanged | no Provider delete, no DB delete/purge |
| `RA1-V09` | Worker reads wrong/stale binding | job blocked; integrity event | exact referenced object unchanged | no raw storageKey substitution, no Worker write/delete |
| `RA1-V10` | Provider temporarily unavailable | attempt/binding retained; no FV | none or unknown retained | no successful FileVersion, no cleanup |
| `RA1-V11` | DB/provider mismatch | DB state marked conflict/integrity failed; reads blocked | exact object retained where present | no auto-delete or alternate object fallback |
| `RA1-V12` | Service restart between provider and DB commit | restart reconciles terminal/unknown state | exact object retained | no duplicate write/version; no memory-only success |

Each test must use a disposable database clone and a dedicated synthetic
provider prefix/account in a future separately authorized environment.

## 13. D3-D6 Retention, Deferral and Discard List

### 13.1 Retain

- D1's `StorageObjectBinding` concept and exact Provider version/identity
  requirement.
- Current P1-3 `FileUploadIntent`, `FileUploadAttempt`,
  `StorageObjectLifecycle`, `StorageObjectOperation` as the logical lifecycle
  chain.
- Current FileVersion, Extraction, Review, SecurityEvent and AuditLog graph.
- Current Web/Worker authorization, project scope, MIME/size/hash validation,
  Worker processing token/lease and read-verification principles.
- D4-D6's explicit “DB success does not prove Provider success” and
  “Provider success does not prove DB commit” principles.
- The fail-closed no-delete/no-cleanup principle.

### 13.2 Defer

- Provider multipart/resumable session and part checkpoint tables.
- ProviderEffect/EffectOwner/Action/PublisherAttempt/Finalizer graphs.
- AuthoritySession/AuthorityClaim/Custody/TrustRoot/Manifest/CapabilityLease.
- DispatchPermit and InvestigationSnapshot.
- 14 typed Evidence families.
- Quarantine, restore, purge, rollback, migration and cross-region failover.
- Automatic recovery workers and complex lock-plan protocols.

### 13.3 Discard

- Continue D8 as an unconditional next step.
- Re-enable the failed Route A Windows Storage Authority/Broker as a default.
- Direct Web/Worker Provider root/delete credentials.
- Automatic cleanup based on lease age, Intent expiry or DB DELETED state.
- Treating a normal `rename` or a prechecked path as proof of no-overwrite.
- Reusing historical Evidence/Effect IDs without actual source evidence.
- The assumption that provider versioning alone solves lifecycle safety.

## 14. Historical and External Blockers

The following remain unchanged:

```text
R5 57 Open Decisions:                         OPEN
BV7:                                          FAIL
BV8:                                          NOT INDEPENDENTLY APPROVED
R8:                                           BLOCKED
P2-05 business policy:                        OPEN
Old upload chain / P1-3 integration:          NOT IMPLEMENTED
Current FileVersion creation:                 OMITS P1-3 CHAIN FIELDS
Generation CAS / key locks / recovery:        NOT IMPLEMENTED
Close attestation and OS fencing:             NOT IMPLEMENTED / NOT VERIFIED
Provider account/region/credentials/IAM:      NOT VERIFIED
Exact provider version/copy/delete/audit:     NOT VERIFIED
Trust root and manifest trust:                 NOT VERIFIED
Historical object inventory:                   NOT VERIFIED
Production ACL/Role set:                       NOT VERIFIED
Production deployment:                         NOT AUTHORIZED
```

The following business decisions remain required before implementation:

- provider and region;
- data residency and customer data permission;
- file retention and deletion policy;
- malware scanning provider/policy;
- budget and outage tolerance;
- real product/customer data usage.

## 15. Implementation Phase Sequence

### Phase A — Decision and capability gate

Do not code yet. Obtain approval for:

1. selected Provider/account/region;
2. server-proxy single-stream upload;
3. one immutable object/form version per FileVersion;
4. no deletion/cleanup in MVP;
5. retention and failed-object handling;
6. data classification/residency.

Stop if the Provider cannot prove conditional create/unique-key behavior,
exact-version readback, checksum/size readback and a stable version token.

### Phase B — Minimal data model and isolated schema

Separate authorization required:

1. add `StorageObjectBinding`;
2. add `FileVersion.storageBackend` and binding relation;
3. integrate the existing P1-3 chain;
4. add forward-only migration and backfill classification;
5. test in a disposable PostgreSQL clone.

Stop if any FileVersion cannot be deterministically classified as
LEGACY_LOCAL or OBJECT_STORE.

### Phase C — Server-proxied upload/download

Separate authorization required:

1. implement provider adapter behind a server-only port;
2. eliminate raw Web/Worker object key usage from the MVP path;
3. implement exact readback and binding finalization;
4. preserve failed objects;
5. run the 12 verification scenarios.

Stop on any read/write path that can reach Provider credentials from browser or
Worker, or any automatic cleanup path.

### Phase D — Worker and historical boundary

Separate authorization required:

1. Worker uses exact binding read-only;
2. legacy rows remain read-only;
3. unmappable history is retained/blocked;
4. no migration cutover until inventory evidence exists.

### Phase E — Future full protocol expansion

A new reviewed package may add:

- multipart/resumable;
- ProviderEffect/Evidence;
- quarantine/recovery;
- automatic cleanup/purge;
- migration/rollback;
- trust-root/capability manifests;
- full D3-D6 semantics.

It must re-start from R7's remaining findings. D6 cannot be reused as an
approved baseline.

## 16. Stop Conditions

Stop the architecture or implementation if any of the following occurs:

- no approved Provider/region/account;
- no reliable exact Provider version/token or readback;
- no server-only upload/read path;
- no deterministic FileVersion-to-binding relation;
- historical rows cannot be classified without fabrication;
- a cleanup/delete path can run without a separately reviewed protocol;
- source FileVersion creation cannot satisfy the existing P1-3 required
  fields;
- the chosen provider's lifecycle rules can delete referenced versions;
- the minimal path requires a full trust root/manifest/evidence graph before
  delivering basic upload/read;
- any security boundary requires a Windows Broker or Native RPC for the
  selected local route.

## 17. Final Architecture Decision

```text
Preferred target:
  Route C-Minimal

Full D3-D6 protocol:
  DEFERRED / NOT APPROVED

Bounded-Local:
  DEVELOPMENT/DEMO HARNESS ONLY

Automatic cleanup or deletion:
  DISABLED

Current upload/P1-3 source integration:
  NOT IMPLEMENTED

Provider / IAM / Trust Root / Historical inventory:
  NOT VERIFIED

Implementation:
  NOT AUTHORIZED
```

## 18. Git and Integrity

At RA1 start:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       0
Staged:                 0
Deleted:                0
Untracked:              35
```

At RA1 end, only this RA1 report is added. The final SHA-256, byte count,
line count, and untracked count are supplied as delivery metadata after the
file is frozen.

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

## 19. Final Verdict

```text
WP-2A-RA1:
  RA1 COMPLETE — MINIMAL ARCHITECTURE RECOMMENDED

Preferred target:
  Route C-Minimal

Full D3-D6:
  DEFERRED; R7 five P1 remain open

Bounded local:
  DEVELOPMENT/DEMO ONLY

No automatic delete/cleanup:
  REQUIRED

Source implementation:
  NOT AUTHORIZED

Route C isolated validation:
  NOT YET AUTHORIZED

Provider / Database / Storage / IAM / Runtime:
  NOT VERIFIED
```
