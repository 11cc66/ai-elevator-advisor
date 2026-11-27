# WP-2A-D5 — Route C Final Design Remediation

## 0. Document Control

```text
Stage:
  WP-2A-D5

Mode:
  READ-ONLY INVESTIGATION / DESIGN REMEDIATION

Date:
  2026-11-25

Repository:
  D:\thinkbook\Desktop\jieya

Branch at start:
  codex/public-github-sync

HEAD at start:
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

origin/main at start:
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

Tracked modified:
  0

Staged:
  0

Deleted:
  0

Untracked:
  31

Input D4:
  docs/architecture/wp-2a-route-c-object-storage-remediation-design-d4.md

D4 SHA-256:
  267C86AF4A6E0B645619641F7B6CB6EF8388369BAAC26FD6994556E4A0CF3056

Input R5:
  docs/architecture/wp-2a-route-c-object-storage-independent-review-r5.md

R5 SHA-256:
  7CBE52DC195528E5FBC511BC4712B60606A820EF0D4F3ED95373DEBF65369714

Final result:
  D5 DESIGN COMPLETE — READY FOR INDEPENDENT REVIEW

Implementation:
  NOT AUTHORIZED

Database / Provider / Storage:
  NOT ACCESSED
```

D5 replaces D4 rules where they conflict. Historical reports and all existing
untracked files remain unchanged.

D5 is a design artifact. It does not assert source, database, Provider, IAM,
Windows, Linux or runtime verification.

## 1. Scope and Non-Authorization

Allowed:

- read-only source/document investigation;
- field-level relationship and state design;
- database constraint and transaction specification;
- Provider/transaction boundary specification;
- fixed test inputs and expected assertions;
- one new D5 report.

Not authorized:

```text
source, test, Prisma, SQL, Migration, Trigger or Function changes
database or SQL execution
Provider, Storage, IAM, ACL, credential or trust-root access
Build, E2E, Native RPC, deployment, service or scheduler operation
Git reset, restore, clean, checkout, stash, add, commit or push
```

Protected:

```text
$null
UNKNOWN'
apps/web/.next
apps/worker/dist
.env
.env.test
all existing reports, untracked files and credentials
```

## 2. Skills and Evidence

### 2.1 Skills Invoked

The following Skills were read completely and applied:

- `$project-architecture`;
- `$prisma-db-safety`;
- `$security-audit`;
- `$testing-and-verification`;
- `$file-lifecycle`.

### 2.2 Evidence Levels

| Label | Meaning |
|---|---|
| `SOURCE VERIFIED` | Present in current source, Schema or Migration |
| `D5 DESIGN` | Normative design; not implemented |
| `D5 TEST SPEC` | Fixed future test specification |
| `NOT VERIFIED` | Needs isolated database/Provider/runtime |
| `BLOCKED` | External decision or environment required |

### 2.3 Current Source Facts

`SOURCE VERIFIED`:

| Fact | Source |
|---|---|
| Current FileVersion storage/chain fields | `prisma/schema.prisma:398-443` |
| Current P1-3 lifecycle/attempt/operation models | `prisma/schema.prisma:501-655` |
| Current operation enum | `prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:55-60` |
| STAGING/CANONICAL namespaces | same Migration `377-388` |
| Local close proof | same Migration `484-543` |
| Staging cleanup proof | same Migration `674-718` |
| Lifecycle/operation guards | same Migration `873-1008` |
| Upload completion guard | same Migration `1360-1537` |
| FileVersion guards | same Migration `1781-1946` |
| Test capability gaps | `apps/web/scripts/p13-db-tests/capabilities.ts:1-16` |
| Current raw Storage contract | `packages/file-storage/src/capabilities.ts:23-98` |

No D5 protocol table is currently implemented.

## 3. R5 P1 Trace and D5 Change Summary

| R5 finding | D5 correction | Status |
|---|---|---|
| `WP2AR5-P1-01` Action/Effect identity | add `StorageProviderEffectOwner`, exact Action/Publish/Cleanup effect FKs | `RESOLVED BY DESIGN` |
| `WP2AR5-P1-02` composite FK/active pointers | add parent anchors, `MATCH FULL` and deferred pointer checks | `RESOLVED BY DESIGN` |
| `WP2AR5-P1-03` request digest | add binary canonicalizer and fixed SHA-256 vectors | `RESOLVED BY DESIGN` |
| `WP2AR5-P1-04` Quarantine/Dispatch race | add dispatch permit, representation epoch, evidence snapshot and event tables | `RESOLVED BY DESIGN` |
| `WP2AR5-P1-05` typed Evidence | add per-subtype PK/FK/UNIQUE/CHECK/null contracts | `RESOLVED BY DESIGN` |
| `WP2AR5-P1-06` test executability | add concrete fixture generator and row-level test specs | `RESOLVED BY DESIGN` |

## 4. Authority and Effect Ownership

### 4.1 Effect Table

`StorageProviderEffect`:

```text
id                         varchar(32) PK
effectKind                 UPLOAD_CREATE | UPLOAD_PART |
                           UPLOAD_COMPLETE | UPLOAD_ABORT |
                           CANONICAL_PUBLISH | MIGRATION_COPY |
                           ROLLBACK_COPY | DELETE | CONFLICT_CLEANUP
operationId                varchar(32) NOT NULL
allocationId               varchar(32) NOT NULL
providerScopeId            varchar(32) NOT NULL
endpointBindingId          varchar(32) NOT NULL
objectKey                  varchar(255) NOT NULL
sourceClaimId              varchar(32) NOT NULL
sourceGeneration           bigint NOT NULL CHECK > 0
requestNonce               varchar(100) NOT NULL
requestState               NOT_STARTED | DISPATCH_ELIGIBLE |
                           DISPATCHED | RESPONSE_OBSERVED | RESPONSE_UNKNOWN
effectState                NOT_STARTED | IN_FLIGHT | NO_EFFECT |
                           EXACT_OBSERVED | CONTENT_VERIFIED |
                           WRONG_CONTENT | LATE_EFFECT_UNCLAIMED |
                           FAILED_RETAINED
objectVersionId            varchar(32) NULL
providerRequestId          varchar(255) NULL
firstDispatchedAt          timestamptz(6) NULL
lastObservedAt             timestamptz(6) NULL
terminalAt                 timestamptz(6) NULL
createdAt                  timestamptz(6) NOT NULL
```

Unique:

```text
UNIQUE(operationId, requestNonce)
UNIQUE(id, operationId, allocationId, sourceGeneration)
UNIQUE(id, providerScopeId, endpointBindingId, objectKey)
```

Exact FKs:

```text
(sourceClaimId, operationId, sourceGeneration)
  -> StorageOperationAuthorityClaim(id, operationId, generation)

(allocationId, operationId)
  -> StorageObjectKeyAllocation(id, operationId)

(objectVersionId, allocationId)
  -> StorageObjectVersion(id, allocationId)

(providerScopeId, endpointBindingId)
  -> StorageProviderEndpointBinding(providerScopeId, id)
```

Parent anchors required:

```text
StorageObjectVersion UNIQUE(id, allocationId)
StorageObjectKeyAllocation UNIQUE(id, operationId)
StorageProviderEndpointBinding UNIQUE(id, providerScopeId)
```

### 4.2 Effect Owner

Every mutating Action, Publisher attempt or Cleanup attempt that can cause a
Provider side effect has exactly one primary owner. Reconcile/read-only work
may reference the Effect without creating a new owner.

`StorageProviderEffectOwner`:

```text
effectId                   varchar(32) PK
ownerKind                  UPLOAD_ACTION | PUBLISHER_ATTEMPT |
                           CLEANUP_ATTEMPT
uploadActionId             varchar(32) NULL UNIQUE
publisherAttemptId         varchar(32) NULL UNIQUE
cleanupAttemptId           varchar(32) NULL UNIQUE
createdAt                  timestamptz(6) NOT NULL
```

```text
num_nonnulls(uploadActionId, publisherAttemptId, cleanupAttemptId)=1
ownerKind matches the non-null owner family
```

One effect has one primary owner. Multiple Reconcile actions may reference the
same effect; they do not create a second owner.

### 4.3 Action ↔ Effect

`StorageProviderUploadAction`:

```text
providerEffectId           varchar(32) NOT NULL
effectRelation              PRIMARY | RECONCILE
```

Rules:

```text
PRIMARY action -> exactly one EffectOwner row
RECONCILE action -> references existing Effect; no new owner
UNIQUE(providerEffectId) WHERE effectRelation='PRIMARY'
UNIQUE(id, providerEffectId, effectRelation)
```

Exact FKs:

```text
(providerEffectId, uploadSessionId, stagingOperationId)
  -> StorageProviderEffect(
       id, operationId, allocationId, sourceGeneration
     )
  after resolving staging operation and effect operation

(providerEffectId, uploadActionId)
  -> StorageProviderEffectOwner(effectId, uploadActionId)
  WHERE effectRelation='PRIMARY'
```

The Effect and Action insertion/ownership rows are deferred and finalized in
the same transaction. A committed orphan Effect/Owner is invalid.

### 4.4 Publisher Attempt and Cleanup Effect

`StoragePublisherAttempt.providerEffectId` is `NOT NULL UNIQUE`, with exact
effect/owner FKs. `StorageCleanupAttempt.providerEffectId` is `NOT NULL` for
destructive or Provider-backed cleanup actions.

The `StorageProviderEffect` state is the sole Provider mutation result. The
Action and Attempt tables may expose request/transport state but cannot define
an independent terminal outcome.

### 4.5 Stale Effect Adoption

A stale source effect may be used as a candidate only by a current Finalizer:

```text
source claim CLOSED/SUPERSEDED
source effect exact and same Operation/allocation/key
request nonce and provider metadata match
size/hash match the Operation snapshot
exact-version Readback Evidence exists
current Finalizer claim/lease/generation valid
no quarantine/incident
```

This does not restore source claim write authority. FileVersion creation occurs
only in the current Finalizer transaction.

## 5. Complete DB Constraint Definitions

### 5.1 Parent Unique Anchors

| Parent | Required UNIQUE |
|---|---|
| ObjectVersion | `(id,allocationId)`, `(id,providerScopeId,objectKey,providerVersionToken)` |
| ObjectOperation | `(id,operationType)`, `(id,providerScopeId,objectLifecycleId,storageKey,namespaceKind)` |
| ObjectLifecycle | `(id,providerScopeId,storageKey,objectKind)`, `(id,storageBackend,storageKey)` |
| KeyAllocation | `(id,operationId,providerScopeId,lifecycleId,objectKey)` |
| UploadSession | `(id,stagingOperationId,sessionGeneration)`, `(id,stagingOperationId,allocationId)` |
| UploadAction | `(id,uploadSessionId)`, `(id,stagingOperationId)`, `(providerEffectId)` |
| Effect | `(id,operationId,allocationId,sourceGeneration)`, `(id,providerScopeId,endpointBindingId,objectKey)` |
| RepresentationSlot | `(id,fileVersionId,role,backendKind)` |
| RepresentationAttempt | `(slotId,id,backendKind)` |
| ObjectBinding | `(id,operationId,objectVersionId)`, `(id,allocationId,providerScopeId,objectKey,objectVersionId)` |
| Evidence | `(id,evidenceType)`, `(id,evidenceType,operationId,objectVersionId)` |
| MigrationRecord | `(id,sourceSlotId)`, `(id,targetRepresentationAttemptId)` |
| DestructiveTarget | `(operationId,targetRepresentationAttemptId)` |

### 5.2 Active Pointer FKs

```text
UploadSessionActionSlot
  FK (uploadSessionId, activeActionId)
    -> UploadAction(uploadSessionId,id)
  MATCH FULL
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED

RepresentationSlot
  FK (activeAttemptId, id, backendKind)
    -> RepresentationAttempt(id,slotId,backendKind)
  MATCH FULL
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED
```

`MATCH FULL` alone does not prove the pointed attempt is active. Deferred
triggers enforce:

```text
activeActionId IS NULL OR action.state IN
  ('PREPARED','DISPATCHED','RESPONSE_UNKNOWN')

activeAttemptId IS NULL OR attempt.state IN
  ('CANDIDATE','VERIFIED','ACTIVE')
and attempt.slotId = slot.id
```

### 5.3 Nullability Rules

```text
Effect.objectVersionId:
  NULL only for NO_EFFECT/WRONG_CONTENT/IN_FLIGHT

UploadAction.providerUploadId:
  NULL only CREATE before response

UploadSession.completedObjectVersionId:
  NULL until COMPLETED

ActionSlot.activeActionId:
  NULL only while no active Complete/Abort/Reconcile

RepresentationSlot.activeAttemptId:
  NULL only while no CANDIDATE/VERIFIED/ACTIVE attempt

ObjectVersion.providerGeneration:
  NULL only VERSION_TOKEN_ONLY
```

Every nullable composite relation uses `MATCH FULL` or a typed subtype plus a
CHECK; no MATCH SIMPLE null bypass is permitted.

### 5.4 Terminal and Deletion Behavior

```text
Effect/Action/Evidence/Quarantine history: no DELETE/TRUNCATE
Failed RepresentationAttempt: immutable, retained
RepresentationSlot active pointer: only current transaction may clear
ActionSlot active pointer: clear only with action terminal result
Cross-operation/scope/version FKs: ON UPDATE/DELETE RESTRICT
```

## 6. requestDigest Canonicalization

### 6.1 Envelope

Canonicalizer version 1:

```text
domain = UTF-8("aic-elevator/storage-upload-action/v1") + 0x00
u8 version = 0x01
u16 field count, big-endian
for each fixed field:
  u16 name length
  name UTF-8
  u8 type
  encoded value
```

Type codes:

```text
0x00 NULL
0x01 BOOL (1 byte 0/1)
0x02 S64 (signed two's complement, big-endian, 8 bytes)
0x03 UTF8 (u32 byte length + UTF-8 bytes)
0x04 BYTES (u32 length + raw bytes)
0x05 ARRAY (u32 count + typed elements)
0x06 ENUM_UTF8
```

Strings are valid UTF-8, NFC-normalized, no BOM, and implicitly length-prefixed.
All fields are present exactly once; missing, unknown and duplicate fields are
invalid. NULL is explicit.

### 6.2 Field Order

```text
1 actionPayloadDigest          BYTES(32)
2 actionType                   ENUM_UTF8
3 authorityClaimId             UTF8
4 authoritySessionId           UTF8
5 endpointBindingId            UTF8
6 expectedChecksumSha256       BYTES(32)
7 expectedSizeBytes            S64
8 objectKey                    UTF8
9 partNumber                   S64 | NULL
10 providerScopeId             UTF8
11 providerUploadId            UTF8 | NULL
12 sessionGeneration           S64
13 stagingOperationId          UTF8
14 uploadSessionId             UTF8
```

Action payload uses the same envelope with domain
`aic-elevator/storage-upload-payload/v1\0`.

Payload fields:

| Type | Fields |
|---|---|
| CREATE | provider API operation, expected size/hash, declared MIME |
| PART | provider operation, part number, part size/hash, ETag |
| COMPLETE | provider operation, ordered parts `(number, ETag, hash)` |
| ABORT | provider operation, provider upload ID |
| RECONCILE | target effect/version, observation type, verifier request ID |

Multipart parts are sorted by part number before canonical encoding.

### 6.3 Idempotency

```text
same actionType + nonce + canonical bytes
  -> return existing action result

same nonce + different canonical bytes
  -> D5_ACTION_NONCE_MISMATCH

same nonce + different actionType
  -> conflict before Provider call
```

The action stores `canonicalizerVersion`, `requestDigest`, `canonicalPayload`
and `payloadLength`. A new canonicalizer version cannot reinterpret old bytes.

### 6.4 Fixed Vectors

Common values:

```text
session = d5-fv-05-up
operation = d5-fv-05-op
claim = d5-fv-05-c1
authority session = d5-fv-05-s1
scope = d5-fv-05-scope
endpoint = d5-fv-05-e1
key = staging/d5-fv-05-k
expected size = 1048576
expected hash = 32 bytes 0xaa
provider upload = d5-fv-05-upload
generation = 1
```

CREATE payload digest:

```text
ec766e7bbc7acaf3d4e8f6831e7d1f163efce242445aeb7d3d9586346fddd57e
```

CREATE request bytes length 557. The exact byte stream is:

```text
61 69 63 2d 65 6c 65 76 61 74 6f 72 2f 73 74 6f 72 61 67 65 2d 75 70
6c 6f 61 64 2d 61 63 74 69 6f 6e 2f 76 31 00 01 00 0e 00 00 00 13
61 63 74 69 6f 6e 50 61 79 6c 6f 61 64 44 69 67 65 73 74 00 04 00
00 00 20 ec 76 6e 7b bc 7a ca f3 d4 e8 f6 83 1e 7d 1f 16 3e fc e2
42 44 5a eb 7d 3d 95 86 34 6f dd d5 7e 00 00 00 0a 61 63 74 69 6f
6e 54 79 70 65 00 03 00 00 00 06 43 52 45 41 54 45 00 00 00 10 61
75 74 68 6f 72 69 74 79 43 6c 61 69 6d 49 64 00 03 00 00 00 0b 64
35 2d 66 76 2d 30 35 2d 63 31 00 00 00 12 61 75 74 68 6f 72 69 74
79 53 65 73 73 69 6f 6e 49 64 00 03 00 00 00 0b 64 35 2d 66 76 2d
30 35 2d 73 31 00 00 00 11 65 6e 64 70 6f 69 6e 74 42 69 6e 64 69
6e 67 49 64 00 03 00 00 00 0b 64 35 2d 66 76 2d 30 35 2d 65 31 00
00 00 16 65 78 70 65 63 74 65 64 43 68 65 63 6b 73 75 6d 53 68 61
32 35 36 00 04 00 00 00 20 aa aa aa aa aa aa aa aa aa aa aa aa aa aa
aa aa aa aa aa aa aa aa aa aa aa aa aa aa aa aa aa 00 00 00 11 65 78
70 65 63 74 65 64 53 69 7a 65 42 79 74 65 73 00 02 00 00 00 00 00
10 00 00 00 00 00 00 09 6f 62 6a 65 63 74 4b 65 79 00 03 00 00 00
12 73 74 61 67 69 6e 67 2f 64 35 2d 66 76 2d 30 35 2d 6b 00 00 00
0a 70 61 72 74 4e 75 6d 62 65 72 00 00 00 00 0f 70 72 6f 76 69 64
65 72 53 63 6f 70 65 49 64 00 03 00 00 00 0e 64 35 2d 66 76 2d 30
35 2d 73 63 6f 70 65 00 00 00 10 70 72 6f 76 69 64 65 72 55 70 6c
6f 61 64 49 64 00 00 00 00 11 73 65 73 73 69 6f 6e 47 65 6e 65 72
61 74 69 6f 6e 00 02 00 00 00 00 00 00 00 01 00 00 00 12 73 74 61
67 69 6e 67 4f 70 65 72 61 74 69 6f 6e 49 64 00 03 00 00 00 0b 64
35 2d 66 76 2d 30 35 2d 6f 70 00 00 00 0f 75 70 6c 6f 61 64 53 65
73 73 69 6f 6e 49 64 00 03 00 00 00 0b 64 35 2d 66 76 2d 30 35 2d 75 70
```

CREATE SHA-256:

```text
2298527CD6E86C1A3B95774A79A5E99A643545CFE13AED408EB90D0BAAB43EE1
```

PART payload digest:

```text
f2851e3841c969a3992a26f9d7df23568621ec2a5cbd938d11f1cbf19a07dbee
```

PART request length 582, SHA-256:

```text
0165370C472856DC582CDF3BB5069E7ED95BF6134B05171EBAF13F10717776BD
```

COMPLETE payload digest:

```text
9a7f68a0fa1ef59f16f54ac86ecd0260a5006e20e159229f82c57eb72d1f611e
```

COMPLETE request length 578, SHA-256:

```text
F1D31DB3C292D85507AE2957D862C9E7A9AFAB9E8D28551F4D619CAE0C2A6B79
```

Same nonce, changed `providerScopeId=d5-fv-05-OTHER`, SHA-256:

```text
BE107476431E1F1B8CE253AAD3950ACC9844BF1BF2DD473B22BFB4765556272F
```

The final vector MUST be rejected with
`D5_ACTION_NONCE_MISMATCH`.

## 7. Quarantine and Dispatch

### 7.1 Representation Epoch

Add to `StorageRepresentationAttempt`:

```text
quarantineEpoch        bigint NOT NULL DEFAULT 0
dispatchBlocked        boolean NOT NULL DEFAULT false
```

Only the incident function increments the epoch and sets `dispatchBlocked`.

### 7.2 Dispatch Permit

`StorageProviderDispatchPermit`:

```text
id
effectId
representationAttemptId NULL
routingEpoch
quarantineEpochSnapshot
trustRootEpoch
revocationEpoch
state ISSUED | CONSUMED | REVOKED | EXPIRED
issuedAt
expiresAt
consumedAt NULL
```

```text
UNIQUE(effectId) WHERE state IN ('ISSUED','CONSUMED')
UNIQUE(id,effectId)
```

Issuance transaction:

```text
lock sealed key plan
lock representation attempt/operation/effect
verify current quarantineEpoch and dispatchBlocked=false
verify trust/revocation/routing epochs
INSERT permit ISSUED
UPDATE effect requestState=DISPATCH_ELIGIBLE
COMMIT
```

Immediately before network call:

```text
UPDATE permit
SET state='CONSUMED', consumedAt=now()
WHERE id=:permit
  AND state='ISSUED'
  AND expiresAt > now()
  AND quarantineEpochSnapshot=current representation epoch
  AND dispatchBlocked=false;
rowcount MUST BE 1
```

### 7.3 Quarantine and In-flight Effects

| Phase | Required behavior |
|---|---|
| Not dispatched | revoke/block permit; no Provider call |
| Permit issued, not consumed | revoke permit |
| Permit consumed/DISPATCHED | cannot recall; effect becomes in-flight under quarantine |
| Provider result response lost | exact reconcile; no acceptance |
| DB result observed, Finalization pending | Finalizer rechecks epoch; fail closed |
| Provider may still honor stale credential | late effect is recorded against original effect/key |

The database does not claim to cancel an already-issued Provider call.

### 7.4 Destructive Cleanup Snapshot

Before a `DELETE` or `CONFLICT_CLEANUP` request is consumed:

```text
copy exact Provider version to protected evidence object OR
copy local object to protected evidence lifecycle
verify exact identity, size and SHA-256
record StorageInvestigationSnapshot
```

`StorageInvestigationSnapshot`:

```text
id
sourceRepresentationAttemptId
providerScopeId NULL
sourceObjectVersionId NULL
localLifecycleId NULL
snapshotObjectVersionId NULL
snapshotLocalLifecycleId NULL
sizeBytes
checksumSha256
evidenceId
createdAt
```

If exact-version snapshot capability is unavailable, destructive cleanup is
disabled. A quarantine received after a delete request cannot undo Provider
deletion; the evidence snapshot is the required investigation artifact.

### 7.5 Incident and Quarantine Events

Incident and quarantine aggregates are immutable; state is represented by
append-only events:

```text
StorageIntegrityIncidentEvent(
  incidentId, fromState, toState, evidenceId, actorWorkloadId, createdAt
)

StorageRepresentationQuarantineEvent(
  quarantineId, fromState, toState, evidenceId, createdAt
)
```

Current state is the latest event. Release requires independent verifier
readback and a fresh `QuarantineReleaseEvidence`; no same-detector self-release
is allowed.

### 7.6 Read Lease

`StorageReadLease` includes exact representation attempt, routing epoch,
quarantine epoch and state. New reads fail if a current quarantine event exists.
Already-open streams check every 1 MiB or 5 seconds; if they cannot be aborted,
the lease is revoked and the interruption is recorded. Bytes already delivered
cannot be retracted by the database.

## 8. Representation Slots and FileVersion

### 8.1 Slot

```text
StorageRepresentationSlot
  id
  fileVersionId
  role ORIGIN | V2_CANONICAL | ROLLBACK_FALLBACK
  backendKind LOCAL_FILE | OBJECT_STORE
  activeAttemptId NULL
```

```text
UNIQUE(fileVersionId,role)
UNIQUE(id,fileVersionId,role,backendKind)
FK (activeAttemptId,id,backendKind)
  -> RepresentationAttempt(id,slotId,backendKind)
  MATCH FULL
```

### 8.2 Attempt

```text
StorageRepresentationAttempt
  id
  slotId
  attemptGeneration
  operationId
  backendKind
  state CANDIDATE | VERIFIED | ACTIVE | SUPERSEDED | FAILED_RETAINED
  storageKey
  sizeBytes
  checksumSha256
  quarantineEpoch
  dispatchBlocked
```

```text
UNIQUE(slotId,attemptGeneration)
UNIQUE(slotId,id,backendKind)
UNIQUE(slotId) WHERE state IN ('CANDIDATE','VERIFIED','ACTIVE')
```

Old failed attempts remain. A new attempt gets `max(generation)+1`.

### 8.3 FileVersion

```text
originSlotId
originAttemptId
originBackendKind
storageOrigin
storageKey
sizeBytes
checksumSha256
uploadIntentId NULL
uploadAttemptId NULL
creationOperationAttemptId NULL
```

Exact FK:

```text
(originSlotId,originAttemptId,originBackendKind)
  -> RepresentationAttempt(slotId,id,backendKind)
```

Origin matrix and no-fake-ID rules are inherited from D3/D4:

```text
LEGACY_LOCAL: local ORIGIN
UPLOAD_V2: object ORIGIN
MIGRATED_V2: local ORIGIN + object V2_CANONICAL
```

`LEGACY_LOCAL -> MIGRATED_V2` is the only one-way origin update, performed by
Migration Finalizer. Failures do not rewrite FileVersion or IDs.

## 9. Fourteen Evidence Models

Common base:

```text
StorageLifecycleEvidence
  id
  schemaVersion
  evidenceType
  operationId
  providerEffectId NULL
  uploadActionId NULL
  representationAttemptId NULL
  incidentId NULL
  authorityClaimId
  authoritySessionId
  producerWorkloadId
  producerDbRole
  producerPurpose
  requestNonce
  objectVersionId NULL
  canonicalizerVersion
  canonicalPayloadDigest
  observedAt
  createdAt
```

```text
UNIQUE(id,evidenceType)
UNIQUE(id,evidenceType,operationId,objectVersionId)
UNIQUE(operationId,evidenceType,requestNonce)
```

Common producer FKs:

```text
(authoritySessionId,producerWorkloadId,producerDbRole,operationId)
  -> AuthoritySession(id,workloadId,dbRole,operationId)

(authorityClaimId,operationId,authoritySessionId)
  -> AuthorityClaim(id,operationId,sessionId)
```

Every subtype has `PK(evidenceId)` and exact
`(evidenceId,discriminator) -> Evidence(id,evidenceType)`. All subtype rows are
append-only.

### 9.1 AuthorizationEvidence

Fields: `authorityClaimId, authorityGeneration, authorityStateSnapshot,
ownerTokenDigest, leaseExpiresAt, trustRootEpoch, revocationEpoch, routingEpoch`.

```text
FK (authorityClaimId,operationId,authorityGeneration)
  -> AuthorityClaim(id,operationId,generation)
CHECK authorityStateSnapshot in allowed enum
CHECK ownerTokenDigest is 64 lowercase hex
```

Proves DB authorization only.

### 9.2 ProviderOperationEvidence

Fields: `providerEffectId, publisherAttemptId NULL, uploadActionId NULL,
providerScopeId, endpointBindingId, objectKey, apiOperationName,
requestParametersDigest, providerRequestId NULL, requestState`.

```text
CHECK num_nonnulls(publisherAttemptId,uploadActionId)=1
FK (providerEffectId,operationId,providerScopeId,endpointBindingId,objectKey)
  -> ProviderEffect(id,operationId,providerScopeId,endpointBindingId,objectKey)
UNIQUE(providerEffectId,requestNonce)
```

### 9.3 ProviderOutcomeEvidence

Fields: `providerEffectId, providerRequestId, normalizedResult,
providerStatusCode, providerVersionToken NULL, providerGeneration NULL,
resultObjectVersionId NULL, responseDigest`.

```text
FK providerEffectId -> ProviderEffect(id)
UNIQUE(providerEffectId,providerRequestId)
CHECK responseDigest 64 hex
CHECK version/generation follows effect's scheme
```

### 9.4 ReadbackEvidence

Fields: `providerEffectId NULL, representationAttemptId NULL,
providerScopeId, endpointBindingId, objectKey, objectVersionId,
providerVersionToken, providerGeneration NULL, sizeBytes, checksumSha256,
readbackRequestId UNIQUE, readStartedAt, readCompletedAt`.

```text
FK (objectVersionId,providerScopeId,objectKey)
  -> ObjectVersion(id,providerScopeId,objectKey)
CHECK sizeBytes > 0
CHECK readCompletedAt >= readStartedAt
```

### 9.5 UploadActionEvidence

Fields: `uploadActionId, uploadSessionId, uploadSessionGeneration,
actionType, idempotencyNonce, requestDigest, providerUploadId NULL,
normalizedResult, resultObjectVersionId NULL`.

```text
FK (uploadActionId,uploadSessionId)
  -> UploadAction(id,uploadSessionId)
UNIQUE(uploadActionId,idempotencyNonce)
CHECK action/result nullability
```

### 9.6 MigrationCopyEvidence

Fields: `migrationRecordId, sourceRepresentationAttemptId,
targetRepresentationAttemptId, targetAllocationId, bindingId,
targetObjectVersionId, copyRequestId`.

```text
FK migrationRecordId -> MigrationRecord(id)
FK source/target attempts -> RepresentationAttempt(id)
FK (targetAllocationId,targetObjectVersionId)
  -> ObjectVersion(allocationId,id)
UNIQUE(migrationRecordId,copyRequestId)
```

### 9.7 MigrationReadbackEvidence

Fields: `migrationRecordId, sourceRepresentationAttemptId,
targetRepresentationAttemptId, sourceSizeBytes, sourceChecksumSha256,
targetSizeBytes, targetChecksumSha256, verifierReadbackRequestId`.

```text
FK migrationRecordId -> MigrationRecord(id)
FK source/target attempts -> RepresentationAttempt(id)
CHECK sourceSizeBytes=targetSizeBytes
CHECK sourceChecksumSha256=targetChecksumSha256
UNIQUE(migrationRecordId,verifierReadbackRequestId)
```

### 9.8 RepresentationEvidence

Fields: `representationSlotId, representationAttemptId,
representationGeneration, backendKind, targetLifecycleId NULL,
targetBindingId NULL, targetObjectVersionId NULL, sizeBytes,
checksumSha256`.

```text
FK (representationSlotId,representationAttemptId,backendKind)
  -> RepresentationAttempt(slotId,id,backendKind)
CHECK exactly one backend target family
```

### 9.9 DeleteResultEvidence

Fields: `destructiveTargetId, providerEffectId, providerScopeId NULL,
endpointBindingId NULL, exactObjectVersionId NULL, localLifecycleId NULL,
providerDeleteReadbackId NULL, normalizedResult, providerRequestId`.

```text
FK destructiveTargetId -> DestructiveTarget(id)
FK providerEffectId -> ProviderEffect(id)
CHECK exactly one target family
UNIQUE(providerEffectId,providerRequestId)
```

### 9.10 DeleteReadbackEvidence

Fields: `destructiveTargetId, exactObjectVersionId NULL,
localLifecycleId NULL, absenceVerified, retentionLockObserved,
deleteMarkerObserved, observedAt`.

```text
FK destructiveTargetId -> DestructiveTarget(id)
CHECK exactly one target family
CHECK absenceVerified OR retentionLockObserved OR deleteMarkerObserved
```

### 9.11 ProviderAuditEvidence

Fields: `providerEventId UNIQUE, providerRequestId NULL,
providerPrincipalId, providerScopeId, endpointBindingId, objectKey NULL,
objectVersionId NULL, normalizedAction, eventResult, eventAt,
deliveryComplete`.

```text
FK (providerScopeId,endpointBindingId)
  -> EndpointBinding(providerScopeId,id)
UNIQUE(providerScopeId,providerEventId)
CHECK objectKey/objectVersion together when object event
```

### 9.12 ManifestRevocationEvidence

Fields: `revocationRecordId, manifestId NULL, revokedKeyId NULL,
revocationEpoch, rootVersionId, gateWorkloadId, effectiveAt`.

```text
FK revocationRecordId -> ManifestRevocation(id)
FK rootVersionId -> TrustRootVersion(id)
CHECK num_nonnulls(manifestId,revokedKeyId)=1
```

### 9.13 IntegrityIncidentEvidence

Fields: `incidentId, detectionSource, detectedRepresentationAttemptId NULL,
observedProviderVersionId NULL, observedSizeBytes NULL,
observedChecksumSha256 NULL, observationDigest`.

```text
FK incidentId -> IntegrityIncident(id)
FK detectedRepresentationAttemptId -> RepresentationAttempt(id)
CHECK at least one observed fact non-null
```

### 9.14 QuarantineReleaseEvidence

Fields: `incidentId, representationAttemptId,
independentReadbackEvidenceId, verifierWorkloadId, decision`.

```text
FK (incidentId,representationAttemptId)
  -> IncidentTarget(incidentId,representationAttemptId)
FK independentReadbackEvidenceId -> ReadbackEvidence(evidenceId)
CHECK verifierWorkloadId differs from detector workload
```

### 9.15 Evidence Canonical Digest

The D4 canonicalizer v1 is retained:

```text
domain = UTF-8("aic-elevator/storage-evidence/v1") + 0x00
u8 version 1
u16 total field count
(field name UTF8 length+bytes, type code, typed bytes) in published
subtype order
```

Type encodings:

```text
NULL 0x00
BOOL 0x01 + one byte
S64 0x02 + 8-byte signed big-endian
UTF8 0x03 + u32 byte length + NFC UTF-8
BYTES 0x04 + u32 length + bytes
ARRAY 0x05 + u32 count + elements
```

Digest:

```text
SHA-256(domain || envelope)
```

The NOLOGIN ingestion function computes the digest. Caller-provided digest is
never trusted. Read verification recomputes from the immutable subtype row. If
the database has no trusted SHA-256 primitive, Evidence ingestion is disabled.

## 10. State Machines

### 10.1 Provider Effect

```text
NOT_STARTED
  -> DISPATCH_ELIGIBLE
  -> IN_FLIGHT
  -> NO_EFFECT | EXACT_OBSERVED | CONTENT_VERIFIED |
     WRONG_CONTENT | LATE_EFFECT_UNCLAIMED |
     RESPONSE_UNKNOWN | FAILED_RETAINED

RESPONSE_UNKNOWN -> EXACT_OBSERVED | NO_EFFECT |
                    LATE_EFFECT_UNCLAIMED | FAILED_RETAINED
EXACT_OBSERVED -> CONTENT_VERIFIED | WRONG_CONTENT
NO_EFFECT/EXACT_OBSERVED/CONTENT_VERIFIED/WRONG_CONTENT/
LATE_EFFECT_UNCLAIMED/FAILED_RETAINED -> terminal
```

### 10.2 Upload Action

```text
PREPARED -> DISPATCHED -> SUCCEEDED | FAILED | RESPONSE_UNKNOWN
RESPONSE_UNKNOWN -> DISPATCHED | SUCCEEDED | FAILED | SUPERSEDED
terminal states immutable
```

### 10.3 Representation Attempt

```text
CANDIDATE -> VERIFIED -> ACTIVE
CANDIDATE -> FAILED_RETAINED
VERIFIED -> FAILED_RETAINED
ACTIVE -> SUPERSEDED | FAILED_RETAINED
SUPERSEDED/FAILED_RETAINED -> terminal
```

### 10.4 Quarantine and Incident

```text
Incident: OPEN -> CONTAINED -> REVIEW -> RELEASED | REJECTED
Quarantine: ACTIVE -> RELEASED | REJECTED
```

State changes are append-only transition events; current state is derived from
the latest event.

## 11. Transaction and Error Contract

### 11.1 Claim / Action / Effect

The D4 CAS skeleton is retained, with these required additions:

```text
WHERE effect.id=:effectId
  AND effect.operationId=:operationId
  AND effect.allocationId=:allocationId
  AND effect.sourceClaimId=:claimId
  AND effect.sourceGeneration=:generation
  AND effect.requestNonce=:nonce
```

No update by Action ID alone is allowed.

### 11.2 Finalizer

The Finalizer transaction must:

```text
lock sealed plan keys
lock provider effect, action/attempt, binding, representation
verify exact Evidence link rows
verify effect relation
verify current quarantine epoch
verify current trust/revocation/routing epoch
CAS binding/attempt/acceptance/FileVersion
```

### 11.3 Error Categories

| Error | SQLSTATE/application |
|---|---|
| claim CAS lost | `23514` / `D5_CLAIM_CONFLICT` |
| action nonce mismatch | `23505` or `409` / `D5_ACTION_NONCE_MISMATCH` |
| action in progress | `23505` or `409` / `D5_UPLOAD_ACTION_IN_PROGRESS` |
| effect ownership mismatch | `23514` / `D5_EFFECT_OWNERSHIP_MISMATCH` |
| stale generation/lease | `23514` / `D5_STALE_GENERATION` |
| representation active conflict | `23505` / `D5_REPRESENTATION_CONFLICT` |
| quarantine active | `23514` or `409` / `D5_QUARANTINED` |
| trust epoch stale | `23514` / `D5_TRUST_EPOCH_STALE` |
| route epoch stale | `23514` / `D5_ROUTE_EPOCH_STALE` |
| Provider result unknown | application `409` / `D5_PROVIDER_RESULT_UNKNOWN` |

Provider-specific HTTP/error codes are `NOT VERIFIED` and must not be invented.

## 12. Deterministic Test Fixtures

### 12.1 Fixed Namespace

For every test ID:

```text
d5-x-01-*
d5-fv-01-*
d5-xt-01-*
```

The suffix is literal. No unresolved symbolic fixture ID is allowed.

### 12.2 Fixed Values

```text
HASH-A = aa repeated 32 bytes
HASH-B = bb repeated 32 bytes
HASH-WRONG = cc repeated 32 bytes
SIZE = 1048576
T0 = 2026-11-25T00:00:00.000000Z
T1 = 2026-11-25T00:00:10.000000Z
T2 = 2026-11-25T00:02:00.000000Z
```

Owner tokens:

```text
owner-w1 -> F55521549216C191A1F90D6B512514E6C5BE7F80869C499E39512987C559CFE9
owner-w2 -> A4430A53333FAA92C4357F676BA2BCD87F1753F738AC29909A8A67BA535FC223
owner-w3 -> 028D909D7F6B9109170FE7688A57ED96AE845E2BD8C44F5F3F56CD255B0AFD1C
```

Each test uses:

```text
DB1/DB2/DB3: separate sessions
W1/W2/W3: separate workload principals and DB roles
S1/S2/S3: authority sessions
PROV: deterministic Provider double
BAR: explicit barrier
FAIL: explicit injection point
```

### 12.3 Test Assertion Format

Every test must record:

```text
initial DB row snapshot
initial Provider object/request snapshot
step order and transaction boundaries
Provider call result or injected failure
SQLSTATE/application error
rowcount for every mutation
final DB snapshot
final Provider object/inventory
final Evidence rows and canonical digests
negative absence queries
cleanup/recovery final state
```

## 13. Sixteen Race Specifications

### `d5-x-01` Concurrent Claim

```text
Initial: d5-x-01-op generation 6, no active claim; s1/s2 active.
Steps: DB1 locks op; BAR-01; DB2 locks op; DB1 claim C7 rowcount 1;
       DB1 COMMIT; DB2 claim C8 expected 6 rowcount 0; DB2 ROLLBACK.
Final: C7 ACTIVE generation 7; no C8; no effects.
Error: DB2 23514/D5_CLAIM_CONFLICT.
Negative: one active claim, no Provider call.
Cleanup: none.
```

### `d5-x-02` Old Upload After Supersession

```text
Initial: C7 session/action complete dispatched; C7 lease expires T0.
Steps: DB2 claims C8; C7 SUPERSEDED; PROV old Complete V7; DB1 result under
       old C7 rowcount 0; DB2 creates new key/session.
Final: E7 LATE_EFFECT_UNCLAIMED; V7 retained; no FileVersion.
Evidence: provider operation/outcome for E7.
Negative: no C7 new effect; no V7 binding; no new FileVersion.
Cleanup: V7 conflict retained.
```

### `d5-x-03` New Generation Before Old Complete

```text
Initial: C7 request in flight; C8 available.
Steps: DB2 claims C8; DB2 new key U2; PROV old V7/HASH-A; PROV new V8/HASH-B;
       DB1 stale rowcount 0; DB2 current result rowcount 1.
Final: V7 late retained; V8 current candidate.
Negative: no overwrite or latest-key binding.
Cleanup: V7 retained.
```

### `d5-x-04` Response Loss and Recovery

```text
Initial: C7 effect E7 REQUEST_SENT; C8 not active.
Steps: PROV exact V7; socket loss; E7 RESPONSE_UNKNOWN; DB2 claims C8;
       verifier observation+readback; Finalizer C8 accepts E7.
Final: binding accepted, one FileVersion, C7 unchanged source provenance.
Error: old effect update rowcount 0 if attempted; Finalizer rowcounts 1.
Negative: no PUBLISH_RESULT; no duplicate FileVersion; C7 not reactivated.
Cleanup: none.
```

### `d5-x-05` Complete Success / DB Commit Lost

```text
Initial: upload U OPEN; Complete action PREPARED.
Steps: action DISPATCHED; Provider Complete V; FAIL after response before TX;
       DB2 reads DISPATCHED; same nonce RECONCILE; result/readback persisted.
Final: action SUCCEEDED; effect exact; one version/action result.
Negative: no duplicate upload/action/version.
Cleanup: none.
```

### `d5-x-06` Complete vs Abort

```text
Initial: session OPEN; action slot empty.
Steps: DB1 Complete PREPARED slot 1; BAR-06; DB2 Abort PREPARED slot 0;
       Provider Complete once; DB1 result.
Final: Complete SUCCEEDED; Abort absent; session COMPLETED.
Error: DB2 D5_UPLOAD_ACTION_IN_PROGRESS/409.
Negative: no Abort Provider call; no dual terminal.
Cleanup: none.
```

### `d5-x-07` Readback Then Later Version

```text
Initial: V1/HASH-A readback verified; no V2.
Steps: Finalizer locks K; Provider V2/HASH-B appears; finalizer validates V1.
Final: V1 accepted; V2 conflict; exact V1 read.
Negative: no latest substitution.
Cleanup: V2 retained.
```

### `d5-x-08` Allocation Owner Loss

```text
Initial A: allocation RESERVED, no mutation.
Initial B: same, mutationStartedAt set.
Steps A: C8 takeover; successor adopts same key.
Steps B: C8 adoption rejected; old allocation retired; new operation/key.
Final: one active custody in A; no reuse in B.
Negative: no stale key authority.
Cleanup: mutated old key retained.
```

### `d5-x-09` Migration Crash

```text
Initial: migration source slot OPEN.
Steps: W1 claim generation 1; target V copied; FAIL before checkpoint;
       W2 claim generation 2; exact V observation/readback.
Final: one source slot/current record; W1 stale rowcount 0; W2 commit.
Negative: no second record/representation.
Cleanup: partial target retained.
```

### `d5-x-10` Rollback During New FileVersion

```text
Initial: OBJECT_V2_PRIMARY epoch 10; old upload in-flight.
Steps: route CAS epoch 11; old finalizer rowcount 0/23514; inventory all
       committed FileVersions; no new writes until drain.
Final: ROLLBACK_FREEZE.
Negative: no post-freeze hidden FileVersion.
Cleanup: no deletion during inventory.
```

### `d5-x-11` Missing Local Fallback

```text
Initial: UPLOAD_V2 has object origin, no local fallback.
Steps: request ROLLBACK_LEGACY; gate finds missing local representation.
Final: ROLLBACK_FAILED_RETAINED; transition rowcount 0.
Negative: no local-only route.
Cleanup: no fallback deletion.
```

### `d5-x-12` Capability Revocation

```text
Initial: old E7 IN_FLIGHT under manifest M/root R/epoch E.
Steps: revocation epoch E+1; old lease revoked; new claim denied; old provider
       response comes late.
Final: late effect/conflict only; no FileVersion; no new effect.
Negative: no old lease extension.
Cleanup: late object retained.
```

### `d5-x-13` Trust Root Rotation

```text
Initial: R1 active, R2 candidate, L1 lease.
Steps: root epoch CAS +1; R2 active; old L1 attempts claim.
Final: old claim denied D5_TRUST_EPOCH_STALE; R2 required.
Negative: no R1 fresh lease after overlap.
Cleanup: none.
```

### `d5-x-14` Cleanup vs Readback

```text
Initial: exact V; cleanup target; verifier readback.
Steps: both acquire sealed key plan; one wins; if cleanup first, delete only
       after evidence snapshot and reference checks; if readback first,
       cleanup recheck sees reference and fails.
Final: no bound version deletion.
Negative: no key-only delete; no post-lock-lost delete.
Cleanup: snapshot retained.
```

### `d5-x-15` Evidence Without Finalizer

```text
Initial: candidate binding and evidence; no Finalizer.
Steps: query evidence; do not call Finalizer.
Final: candidate remains; no FileVersion/current pointer.
Negative: Evidence alone cannot publish.
Cleanup: no FileVersion reference.
```

### `d5-x-16` Finalizer Commit Response Lost

```text
Initial: Finalizer IK, current C8.
Steps: commit acceptance/FileVersion; FAIL after commit; DB2 retry IK.
Final: one acceptance, one FileVersion, one audit event.
Error: retry insert rowcount 0, existing durable result returned.
Negative: no duplicate extraction/FileVersion.
Cleanup: none.
```

## 14. Twenty-Four Fixed Vectors

All use `d5-fv-NN-*`, fixed hash/time values, and no Provider request unless
listed.

| ID | Input/precondition | Action sequence | Expected DB | Expected Provider/Evidence | Error/rowcount | Negative/cleanup |
|---|---|---|---|---|---|---|
| `d5-fv-01` | scope+E1+key | create/read scope | one namespace tuple | control observation | 1 | no alias |
| `d5-fv-02` | STAGE_WRITE, `staging/K` | allocate | legal staging row | none | 1 | no objects/% |
| `d5-fv-03` | STAGE_WRITE, `objects/K` | allocate | rejected | none | 0/23514 | no key |
| `d5-fv-04` | FINALIZE, `objects/K` | allocate | legal canonical row | none | 1 | no staging |
| `d5-fv-05` | CREATE action, no upload ID | dispatch/reconcile | action unknown/open state | action evidence | 1/0 | no second upload |
| `d5-fv-06` | Complete action U | Provider success then DB failure | action/effect result | result/readback | 1 | no duplicate |
| `d5-fv-07` | Complete C vs Abort A | concurrent slot | one winner | one terminal action | 1/0/409 | no second call |
| `d5-fv-08` | C7 and S1/S2 | concurrent claims | one active claim | auth evidence | 1/0 | no C8 |
| `d5-fv-09` | allocation no-mutation / mutation | successor custody | adopt or retire | custody evidence | 1/conflict | no stale adopt |
| `d5-fv-10` | close evidence other op | attach close | rejected | none | 0/23503 | no ready |
| `d5-fv-11` | response-loss E7 | observation/readback/finalize | accepted V7 | recovery evidence | 1 | no fake publish |
| `d5-fv-12` | migration copy/readback | migration finalizer | object representation | migration evidence | 1 | no new FV |
| `d5-fv-13` | wrong hash object | finalizer | conflict/retain | conflict evidence | 0/409 | no acceptance |
| `d5-fv-14` | legacy key mismatch | classify/insert | rejected | none | 23514 | no pointer |
| `d5-fv-15` | UPLOAD origin + fallback | activate representation | two attempts, one current | representation evidence | 1 | no second FV |
| `d5-fv-16` | failed fallback gen1 | retry gen2 | old failed + new active | retry evidence | 1 | no history overwrite |
| `d5-fv-17` | provider/local mismatch | read selection | conflict/quarantine | incident evidence | 409 | no fallback |
| `d5-fv-18` | revoked manifest | new lease/claim | denied | revocation evidence | 0/23514 | no Provider call |
| `d5-fv-19` | root overlap | root epoch CAS | R2 active, R1 stale | root evidence | 1/0 | no fresh R1 |
| `d5-fv-20` | cleanup V + finalizer B | key barrier | serialized | delete/readback or binding | 1/0 | no live delete |
| `d5-fv-21` | finalizer IK lost | retry IK | one acceptance/FV | one evidence set | 0 retry insert | no duplicate |
| `d5-fv-22` | route epoch 10/11 | stale read | denied/re-auth | route evidence | 0/23514 | no stale route |
| `d5-fv-23` | no version token | ingest | rejected | capability evidence | 0/23502 | no binding |
| `d5-fv-24` | strict audit missing | finalize/read/cleanup | blocked/retained | no acceptance | 409 | no cleanup |

## 15. Twelve Additional Cross-Protocol Tests

### `d5-xt-01` Stale + response loss

Initial `d5-xt-01` C7 E7 request unknown; C8 available; V7 HASH-A. Steps:
claim C8, observe/readback V7, finalize. Final: one FV, one binding; no C7
reactivation; no duplicate FV. Rowcounts: stale E7 update 0, finalizer 1.

### `d5-xt-02` Complete/Abort actions

Initial U open, action slot empty. Complete C PREPARED; BAR; Abort A; different
nonce rejected; Provider Complete once. Final: C SUCCEEDED, A absent, one
terminal action. Rowcounts 1/0; error `D5_UPLOAD_ACTION_IN_PROGRESS`.

### `d5-xt-03` Failed fallback retry

Initial FV object origin, no fallback. gen1 CANDIDATE -> FAILED_RETAINED; slot
active null; gen2 acts. Final: gen2 ACTIVE. Old gen1 row count unchanged;
negative no overwrite/delete.

### `d5-xt-04` Audit contradiction

Initial accepted V/HASH-A. Provider audit reports wrong version. Incident and
quarantine commit; read lease revoke; cleanup target reject. Final representation
quarantined/read blocked. No automatic fallback.

### `d5-xt-05` Evidence cross-reference

Evidence from op1/V1 used for op2/V2. Composite FK returns 23503/23514, no
acceptance. Negative no Evidence update.

### `d5-xt-06` Digest tamper

Change subtype field without updating digest; recompute check fails
`D5_EVIDENCE_DIGEST_MISMATCH`; no acceptance/FileVersion.

### `d5-xt-07` Revocation lag

Old E7 IN_FLIGHT under epoch E; revocation E+1; new claim denied; late V7 is
late/conflict. No provider call for new claim; V7 retained.

### `d5-xt-08` Cleanup/quarantine

Cleanup target V with evidence snapshot. BAR; quarantine commits before delete
permit consume. Permit CAS 0; 0 Provider DELETE; V retained. No delete evidence.

### `d5-xt-09` Rollback/quarantine

Rollback copy source V; quarantine V during copy. Final local activation
recheck fails; partial local remains; no route switch. Quarantine row 1,
activation 0.

### `d5-xt-10` Migration source contention

Source slot SS. W1 inserts R1/current; W2 inserts R2/current. W1 row 1; W2
23505/D5_MIGRATION_SOURCE_CONFLICT. No second representation.

### `d5-xt-11` Endpoint provisioning

E1 ACTIVE, slot candidate null. W1 E2 PROVISIONING/CAS 1; W2 E3 0/23505. E1
remains active; no second candidate.

### `d5-xt-12` Multi-key lock inversion

Plans K1/K3, K2/K1, K3/K2; W1/W2/W3 seal and sort. W1 dynamic K4 append after
K1 gives D5_LOCK_PLAN_MUTATED, no Provider call, no side effect.

## 16. R5 P2/P3 Trace

| Finding | D5 disposition |
|---|---|
| `WP2AR5-P2-01` global nonce | `PARTIALLY RESOLVED` — global uniqueness is safe but cross-tenant availability needs explicit namespace policy |
| `WP2AR5-P2-02` active pointers | `RESOLVED BY DESIGN` — exact FKs/anchors in §5 |
| `WP2AR5-P2-03` incident state | `RESOLVED BY DESIGN` — event tables in §7.5 |
| `WP2AR5-P2-04` migration target | `PARTIALLY RESOLVED` — target tuple and slot shown; migration transaction remains to be implemented/tested |
| `WP2AR5-P2-05` endpoint/capability ownership | `PARTIALLY RESOLVED` — rotation slot and Gate child-set ownership defined; deployment proofs remain external |
| `WP2AR5-P3-01` action evidence naming | `RESOLVED BY DESIGN` — canonical uploadActionId/action session relation |
| `WP2AR5-P3-02` effect null matrix | `RESOLVED BY DESIGN` — effect kind/objectVersion matrix in §4.1 and §6.3 |

## 17. Open External Dependencies

```text
Provider kind/account/region: OPEN / NOT VERIFIED
Exact-key IAM/STS/credential issuance: NOT VERIFIED
Provider exact-version read/list/delete/multipart semantics: NOT VERIFIED
Provider exact-version copy and audit delivery: NOT VERIFIED
PostgreSQL certificate/pg_ident/pooler behavior: NOT VERIFIED
Trust-root key custody/rotation: NOT VERIFIED
Historical local/Provider inventory: NOT VERIFIED
P2-05 cost/degraded-read/retention policy: OPEN
R5 57 Open Decisions: OPEN
BV7: FAIL
BV8: NOT INDEPENDENTLY APPROVED
R8: BLOCKED
Current P1-3 application integration: NOT IMPLEMENTED
```

No Provider, database, ACL or runtime verification is claimed.

## 18. Git and Integrity

At design start:

```text
Branch: codex/public-github-sync
HEAD: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified: 0
Staged: 0
Deleted: 0
Untracked: 31
```

At design end:

```text
Branch: codex/public-github-sync
HEAD: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified: 0
Staged: 0
Deleted: 0
Untracked: 32
```

Only the D5 report was added. SHA-256, bytes and lines are supplied after the
file is frozen.

No source, Schema, Migration, Trigger, Function, test, configuration, database,
Provider, Storage, IAM, service, Build, E2E, Native RPC or deployment operation
was modified or executed.

## 19. Final Verdict

```text
D5 DESIGN COMPLETE — READY FOR INDEPENDENT REVIEW

R5 P1:
  6/6 RESOLVED BY DESIGN

R5 P2:
  2 RESOLVED BY DESIGN
  3 PARTIALLY RESOLVED / EXTERNAL VALIDATION REQUIRED

R5 P3:
  2/2 RESOLVED BY DESIGN

Typed Evidence:
  14/14 SCHEMA CONTRACTS DEFINED

Race tests:
  16/16 DETERMINISTIC SPECIFICATIONS DEFINED

Fixed vectors:
  24/24 DETERMINISTIC SPECIFICATIONS DEFINED

Additional cross tests:
  12/12 DETERMINISTIC SPECIFICATIONS DEFINED

Route C isolated validation:
  NOT AUTOMATICALLY GRANTED

Implementation:
  NOT AUTHORIZED

Provider / Database / Storage / Runtime:
  NOT VERIFIED

Production:
  NOT AUTHORIZED
```
