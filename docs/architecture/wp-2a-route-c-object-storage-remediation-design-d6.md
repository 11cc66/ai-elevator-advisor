# WP-2A-D6 — Final Bounded Route C Design Remediation

## 0. Document Control

```text
Stage:
  WP-2A-D6

Mode:
  READ-ONLY INVESTIGATION / BOUNDED DESIGN REMEDIATION

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
  32

Input D5:
  docs/architecture/wp-2a-route-c-object-storage-remediation-design-d5.md

D5 SHA-256:
  951055E6133CEAB11CF397F5F1EA6E0B3A77002667445BFCDC3AE2794134EC6D

Input R6:
  docs/architecture/wp-2a-route-c-object-storage-independent-review-r6.md

R6 SHA-256:
  D40BE35EFD9704C1D3CC8DB1F11ADDCD98D49B9CB2F13100340C7020591E01B7

Final result:
  D6 DESIGN COMPLETE — READY FOR INDEPENDENT REVIEW

Implementation:
  NOT AUTHORIZED

Database / Provider / Storage:
  NOT ACCESSED
```

D6 replaces D5 where it conflicts. It does not alter any historical report.

D6 completion is a design and static-specification result. It is not a claim
that PostgreSQL, a Provider, an IAM deployment, a trust root or a runtime has
been tested.

## 1. Authorization and Scope

Authorized:

- read-only source/doc investigation;
- resolve the six R6 P1 findings;
- specify PostgreSQL-supported constraints and transaction semantics;
- define deterministic canonicalization and test vectors;
- define DispatchPermit / InvestigationSnapshot / Quarantine behavior;
- define all 14 Evidence subtypes;
- create only this D6 report.

Not authorized:

```text
source, Schema, Migration, Trigger, Function or test changes
SQL or database access
Provider, Storage, IAM, ACL, credential or trust-root access
Build, E2E, Native RPC, deployment, service restart or runtime verification
Git add, commit, push, reset, restore, clean, checkout or stash
```

## 2. Skills and Baseline

### 2.1 Skills Invoked

The following Skills were read completely and applied:

- `$project-architecture`;
- `$prisma-db-safety`;
- `$security-audit`;
- `$testing-and-verification`;
- `$file-lifecycle`.

### 2.2 Evidence Classes

| Label | Meaning |
|---|---|
| `SOURCE VERIFIED` | Current source/Schema/Migration |
| `D6 DESIGN` | Normative design |
| `D6 TEST SPEC` | Deterministic future test |
| `NOT VERIFIED` | Requires target database/Provider/runtime |
| `BLOCKED` | External decision/environment |

### 2.3 Current Source Facts

`SOURCE VERIFIED`:

| Fact | Location |
|---|---|
| FileVersion chain/storage | `prisma/schema.prisma:398-443` |
| P1-3 lifecycle/attempt/operation | `prisma/schema.prisma:501-655` |
| Current operation enum | `prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:55-60` |
| STAGING/CANONICAL namespaces | same Migration `377-388` |
| Local close proof | same Migration `484-543` |
| Cleanup proof | same Migration `674-718` |
| State guards | same Migration `873-1008` |
| Upload chain | same Migration `1360-1537` |
| FileVersion guards | same Migration `1781-1946` |
| DB test gaps | `apps/web/scripts/p13-db-tests/capabilities.ts:1-16` |
| Storage boundary | `packages/file-storage/src/capabilities.ts:23-98` |

No D6 protocol object is implemented.

## 3. R6 P1 Trace

| R6 finding | D6 correction | Status |
|---|---|---|
| `WP2AR6-P1-01` request digest mismatch | final u32 TLV spec + two independent recalculations | `RESOLVED BY DESIGN` |
| `WP2AR6-P1-02` Effect/Action/Owner FKs | explicit owner FKs and parent anchors | `RESOLVED BY DESIGN` |
| `WP2AR6-P1-03` MATCH FULL nullable pointers | single-column FK + deferred membership checks | `RESOLVED BY DESIGN` |
| `WP2AR6-P1-04` DispatchPermit/Snapshot | exact parent FKs, snapshot retention and poison-delete handling | `RESOLVED BY DESIGN` |
| `WP2AR6-P1-05` Evidence FK completeness | per-subtype parent anchors and exact relations | `RESOLVED BY DESIGN` |
| `WP2AR6-P1-06` deterministic tests | fixed d6 fixture generator and row-level assertions | `RESOLVED BY DESIGN` |

No status is a runtime verification.

## 4. Authority and Effect

### 4.1 Authoritative Effect

`StorageProviderEffect` remains the sole authority for Provider-side-effect
observation:

```text
id
effectKind
operationId
allocationId
providerScopeId
endpointBindingId
objectKey
sourceClaimId
sourceGeneration
requestNonce
requestState
effectState
objectVersionId NULL
providerRequestId NULL
firstDispatchedAt NULL
lastObservedAt NULL
terminalAt NULL
createdAt
```

No action or publisher row owns an independent terminal outcome.

Exact Effect constraints:

```text
UNIQUE(operationId,requestNonce)
UNIQUE(id,operationId)
UNIQUE(id,operationId,effectKind)
UNIQUE(id,operationId,sourceGeneration)
UNIQUE(id,operationId,allocationId,sourceGeneration)
UNIQUE(id,operationId,providerScopeId,endpointBindingId,objectKey)
UNIQUE(id,effectKind,operationId,providerScopeId,endpointBindingId,
       objectKey,sourceGeneration)

FK(sourceClaimId,operationId,sourceGeneration)
  -> StorageOperationAuthorityClaim(id,operationId,generation)
FK(allocationId,operationId)
  -> StorageObjectKeyAllocation(id,operationId)
FK(providerScopeId,endpointBindingId)
  -> StorageProviderEndpointBinding(providerScopeId,id)
FK(objectVersionId,allocationId)
  -> StorageObjectVersion(id,allocationId)
  when objectVersionId is non-null
```

Required parent anchors are
`Claim(id,operationId,generation)`,
`Allocation(id,operationId)`,
`EndpointBinding(providerScopeId,id)` and
`ObjectVersion(id,allocationId)`. `effectKind`, state, scope, endpoint, key,
allocation and source generation are immutable after insert; only whitelisted
state/evidence projection fields may change through the named Effect function.

### 4.2 EffectOwner

`StorageProviderEffectOwner`:

```text
effectId                    varchar(32) PK
ownerKind                   UPLOAD_ACTION | PUBLISHER_ATTEMPT |
                            CLEANUP_ATTEMPT
uploadActionId              varchar(32) NULL UNIQUE
publisherAttemptId          varchar(32) NULL UNIQUE
cleanupAttemptId            varchar(32) NULL UNIQUE
createdAt                    timestamptz(6) NOT NULL
```

Exact FKs:

```text
effectId -> StorageProviderEffect(id)
uploadActionId -> StorageProviderUploadAction(id)
publisherAttemptId -> StoragePublisherAttempt(id)
cleanupAttemptId -> StorageCleanupAttempt(id)
```

CHECK:

```text
num_nonnulls(uploadActionId,publisherAttemptId,cleanupAttemptId)=1
ownerKind matches the non-null owner column
```

Parent anchors:

```text
UNIQUE(effectId,uploadActionId)
UNIQUE(effectId,publisherAttemptId)
UNIQUE(effectId,cleanupAttemptId)
```

### 4.3 Action ↔ Effect

`StorageProviderUploadAction`:

```text
id
uploadSessionId
stagingOperationId
providerEffectId             varchar(32) NOT NULL
effectRelation                PRIMARY | RECONCILE
primaryEffectOwnerActionId    varchar(32) NULL
all remaining D4 action fields are retained unchanged
```

Exact constraint:

```text
UNIQUE(providerEffectId) WHERE effectRelation='PRIMARY'
UNIQUE(id,uploadSessionId)
UNIQUE(id,stagingOperationId)
UNIQUE(id,providerEffectId,effectRelation)

(providerEffectId,stagingOperationId)
  -> StorageProviderEffect(id,operationId)

(providerEffectId,primaryEffectOwnerActionId)
  -> StorageProviderEffectOwner(effectId,uploadActionId)

CHECK (
  (effectRelation='PRIMARY'
   AND primaryEffectOwnerActionId=id)
  OR
  (effectRelation='RECONCILE'
   AND primaryEffectOwnerActionId IS NULL)
)
```

`StorageProviderEffect` must declare:

```text
UNIQUE(id,operationId)
```

The owner row, action row and effect row are inserted in one deferred
transaction. `RECONCILE` actions reference an existing effect and do not insert
an owner row.

### 4.4 Publisher and Cleanup

```text
StoragePublisherAttempt.providerEffectId NOT NULL UNIQUE
StorageCleanupAttempt.providerEffectId NOT NULL
```

Exact FKs:

```text
(providerEffectId,operationId,authorityGeneration)
  -> StorageProviderEffect(id,operationId,sourceGeneration)

(providerEffectId,id)
  -> StorageProviderEffectOwner(effectId,publisherAttemptId)
```

The same pattern applies to CleanupAttempt, using
`(providerEffectId,id) -> StorageProviderEffectOwner(effectId,cleanupAttemptId)`.
The owner table is the one-effect/one-owner gate; the attempt row is the one
attempt/one-effect gate. Both directions are deferred circular FKs inside one
transaction, so neither an ownerless effect nor an effect owned by a second
workload can commit.

### 4.5 Recovery

Response-loss recovery may use an existing exact Effect from a
`CLOSED`/`SUPERSEDED` source claim, but only through:

```text
current Finalizer claim
same operation/allocation/key
exact Provider version
size/hash readback
no quarantine/incident
one candidate binding
```

It does not restore Provider write authority or create a second Effect.

## 5. PostgreSQL-Supported Active Pointers

### 5.1 No `MATCH FULL` on Nullable Active Pointers

D5's `MATCH FULL` construction is replaced.

PostgreSQL applies `MATCH FULL` only when every referencing column is NULL or
every referencing column is non-NULL. Because `uploadSessionId` and
`representationSlot.id/backendKind` are non-null even when no active pointer
exists, `MATCH FULL` would reject the normal empty state.

D6 therefore uses:

```text
nullable single-column FK for identity
+ deferred trigger for same-session/same-slot membership
+ partial unique index for one active target
+ explicit state CHECK
```

### 5.2 Upload Action Slot

```text
StorageUploadSessionActionSlot:
  uploadSessionId PK
  activeActionId NULL
  slotEpoch bigint NOT NULL

FK activeActionId -> StorageProviderUploadAction(id)
UNIQUE(activeActionId)
```

Deferred trigger:

```text
activeActionId IS NULL
OR (
  action.uploadSessionId = slot.uploadSessionId
  AND action.state IN ('PREPARED','DISPATCHED','RESPONSE_UNKNOWN')
)
```

Clearing `activeActionId` is allowed only when the referenced action is
terminal or the current action is superseded by a fresh generation.

### 5.3 Representation Slot

```text
StorageRepresentationSlot:
  id PK
  fileVersionId
  role
  backendKind
  activeAttemptId NULL

FK activeAttemptId -> StorageRepresentationAttempt(id)
UNIQUE(activeAttemptId)
```

Deferred trigger:

```text
activeAttemptId IS NULL
OR (
  attempt.slotId = slot.id
  AND attempt.backendKind = slot.backendKind
  AND attempt.state IN ('CANDIDATE','VERIFIED','ACTIVE')
)
```

UNIQUE:

```text
UNIQUE(fileVersionId,role)
UNIQUE(id,fileVersionId,role,backendKind)
```

### 5.4 Other Active Pointers

```text
StorageObjectOperation.activeAuthorityClaimId
StorageObjectLifecycle.activeAuthorityClaimId
```

use deferred FKs:

```text
FK(activeAuthorityClaimId,id,fencingGeneration)
 -> AuthorityClaim(id,operationId,generation)
```

The exact parent unique is
`AuthorityClaim UNIQUE(id,operationId,generation)`. A deferred trigger requires
the claim operation/session/owner and claim state to match the operation and
lifecycle row. `activeAuthorityClaimId` remains nullable, so the single-column
identity FK plus deferred membership trigger is used; no composite nullable FK
is declared.

## 6. requestDigest v1 Final Specification

### 6.1 Encoding

This is the final D6 version. It uses **u32 field-name lengths**; the D5 u16
sentence is explicitly replaced.

Domain:

```text
UTF-8("aic-elevator/storage-upload-action/v1") + 0x00
```

Envelope:

```text
domain bytes
u8  version = 1
u16 field count, big-endian
for each fixed field:
  u32 name byte length, big-endian
  UTF-8 name
  u8 type
  encoded value
```

Types:

```text
0x00 NULL: zero value bytes
0x01 BOOL: one byte 0/1
0x02 S64: 8-byte signed two's complement, big-endian
0x03 UTF8: u32 byte length + NFC UTF-8
0x04 BYTES: u32 length + raw bytes
```

All fields are present exactly once. Missing, duplicate or unknown fields are
invalid. Strings reject embedded NUL and invalid UTF-8. NFC is required; a
non-NFC input is rejected rather than normalized silently.

Before encoding, the implementation rejects overflow and impossible values:

```text
expectedSizeBytes: 1 .. 20971520
partNumber:        1 .. 10000 when actionType=PART, otherwise NULL
partSizeBytes:     1 .. 20971520
sessionGeneration: 1 .. 9223372036854775807
all hash/BYTES fields: exact 32 bytes for SHA-256 fields
all timestamps: not request fields
all floating-point numbers: not request fields
```

S64 overflow, a negative size/generation, a wrong SHA length, duplicate field
name, unknown enum value, or trailing bytes is rejected before digesting with
`400/D6_REQUEST_SHAPE`. The canonicalizer never truncates or coerces.

### 6.2 Fixed Field Order

```text
1 actionPayloadDigest        BYTES(32)
2 actionType                 UTF8
3 authorityClaimId           UTF8
4 authoritySessionId         UTF8
5 endpointBindingId          UTF8
6 expectedChecksumSha256     BYTES(32)
7 expectedSizeBytes          S64
8 objectKey                  UTF8
9 partNumber                 S64 | NULL
10 providerScopeId            UTF8
11 providerUploadId           UTF8 | NULL
12 sessionGeneration          S64
13 stagingOperationId         UTF8
14 uploadSessionId            UTF8
```

Action payload fields use domain:

```text
UTF-8("aic-elevator/storage-upload-payload/v1") + 0x00
```

Payloads:

```text
CREATE:
  declaredMimeType UTF8
  expectedChecksumSha256 BYTES(32)
  expectedSizeBytes S64
  providerApiOperation UTF8

PART:
  partChecksumSha256 BYTES(32)
  partETag UTF8
  partNumber S64
  partSizeBytes S64
  providerApiOperation UTF8

COMPLETE:
  partsDigest BYTES(32)
  providerApiOperation UTF8

ABORT:
  providerUploadId UTF8
  providerApiOperation UTF8

RECONCILE:
  targetEffectId UTF8
  providerVersionToken UTF8
  observationType UTF8
```

`partsDigest` is:

```text
SHA-256(
  UTF-8("aic-elevator/storage-upload-parts/v1") + 0x00
  + u16 count
  + repeated sorted part entry:
    partChecksumSha256 BYTES(32)
    partETag UTF8
    partNumber S64
    partSizeBytes S64
)
```

Sorted by unsigned part number ascending.

### 6.3 Fixed Vectors

The identifiers below are opaque canonicalization-test byte values, not test
fixture namespaces. They intentionally retain the historical `d5-fv-05` text so
the D5 byte-level regression can be distinguished from the executable D6
fixture namespaces.

Common inputs:

```text
session=d5-fv-05-up
operation=d5-fv-05-op
claim=d5-fv-05-c1
sessionId=d5-fv-05-s1
scope=d5-fv-05-scope
endpoint=d5-fv-05-e1
key=staging/d5-fv-05-k
size=1048576
checksum=32 bytes 0xaa
uploadId=d5-fv-05-upload
generation=1
declaredMimeType=application/pdf
partNumber=1
partSizeBytes=524288
partChecksumSha256=32 bytes 0xbb
partETag="d6-etag-1"
providerVersionToken=v-d6-0001
```

CREATE payload digest:

```text
627E4794EA1514859EDF9CD0C8260A2624EC6F7C80E8B51F6A9D370A7359E24E
```

CREATE request length 543, SHA-256:

```text
36F30B1128F712DD58034A0B18FE6062853E801EA5AF3239523535231A62AD39
```

PART payload digest:

```text
D30C9943151FEF50D2A5A11C3E689C7F8DE081934A62BD5AB31193A1D6406C3F
```

PART request length 568, SHA-256:

```text
A8A648F0A86CB72523DD0E541E39A1EA7D2F6FAC40B2C712FEF092D1C647EE13
```

PARTS digest:

```text
E21ADEA1368E313D78F976396A65BC3DE9B7857C4425647993112EB61A6CAEF9
```

COMPLETE payload digest:

```text
9E02066C61285ECB97FE2A409E7DBFDE9CB70F12E4D57C632CAA6E558F2A13A5
```

COMPLETE request length 564, SHA-256:

```text
BCE3A15E149B344AA312800E3702D7857F931479688991D770C3AAF49DDB99D3
```

ABORT payload digest:

```text
A18BAD56774421C86DC7786194ED5F93418362488A8E664731DE56DB573C5EED
```

ABORT request length 561, SHA-256:

```text
86925BA3451BB8EBFA507E78A9F6BB7C9DAD34B6C5564420A08C03989206FEEB
```

RECONCILE payload digest:

```text
7D13A7D573462DF4B83EDBA233B02D50050C07FA4D031818D4707B5F737FE242
```

RECONCILE request length 565, SHA-256:

```text
E8A6BAE3DD9F6D127605EDB03A5E3BF981A8749E36C091BBB66570F35D8894F7
```

Same COMPLETE nonce, provider scope changed to `d5-fv-05-OTHER`, length 564:

```text
92F100478C2DDFBF497FC78595345C52CBC64C0A48310A318F670238F1C861E8
```

The last value MUST be rejected with `D6_ACTION_NONCE_MISMATCH`.

The full hex bytes for all six request vectors and the `partsDigest` preimage
are in Appendix A. Each vector was calculated by both a Python serializer and a
separate Node.js serializer; Agreement is a static canonicalization result, not
PostgreSQL or Provider verification.

## 7. Quarantine, Dispatch and Provider Operations

### 7.1 Representation Quarantine Epoch

`StorageRepresentationAttempt` gains:

```text
quarantineEpoch        bigint NOT NULL DEFAULT 0
dispatchBlocked        boolean NOT NULL DEFAULT false
```

Only the incident/quarantine function can increment the epoch or set the blocked
flag. The operation takes the same sealed key-plan locks as cleanup, rollback
and Finalizer.

### 7.2 DispatchPermit

`StorageProviderDispatchPermit`:

```text
id                         varchar(32) PK
effectId                   varchar(32) NOT NULL
effectKind                 enum NOT NULL
representationAttemptId    varchar(32) NULL
operationId                varchar(32) NOT NULL
providerScopeId            varchar(32) NOT NULL
endpointBindingId          varchar(32) NOT NULL
objectKey                  varchar(255) NOT NULL
effectSourceGeneration     bigint NOT NULL
routingEpoch               bigint NOT NULL
quarantineEpochSnapshot    bigint NOT NULL
trustRootEpoch             bigint NOT NULL
revocationEpoch            bigint NOT NULL
destructiveTargetId        varchar(32) NULL
investigationSnapshotId    varchar(32) NULL
state                      ISSUED | CONSUMED | REVOKED | EXPIRED
issuedAt                   timestamptz(6) NOT NULL
expiresAt                  timestamptz(6) NOT NULL
consumedAt                 timestamptz(6) NULL
revokedAt                  timestamptz(6) NULL
```

Exact FKs:

```text
(effectId,effectKind,operationId,providerScopeId,endpointBindingId,
 objectKey,effectSourceGeneration)
  -> StorageProviderEffect(
       id,effectKind,operationId,providerScopeId,endpointBindingId,
       objectKey,sourceGeneration)

representationAttemptId
  -> StorageRepresentationAttempt(id)

(destructiveTargetId,operationId)
  -> StorageDestructiveOperationTarget(id,operationId)

(investigationSnapshotId,destructiveTargetId,operationId)
  -> StorageInvestigationSnapshot(id,destructiveTargetId,operationId)
```

Parent anchors:

```text
StorageProviderEffect
  UNIQUE(id,effectKind,operationId,providerScopeId,endpointBindingId,
         objectKey,sourceGeneration)

StorageRepresentationAttempt
  PK(id)

StorageDestructiveOperationTarget
  UNIQUE(id,operationId)

StorageInvestigationSnapshot
  UNIQUE(id,destructiveTargetId,operationId)

StorageRoutingState
  UNIQUE(epoch)

StorageTrustRootVersion
  UNIQUE(rootEpoch,id)

StorageManifestRevocation
  UNIQUE(revocationEpoch,id)
```

Additional exact epoch FKs:

```text
FK(routingEpoch) -> StorageRoutingState(epoch)
FK(trustRootEpoch) -> StorageTrustRootVersion(rootEpoch)
FK(revocationEpoch) -> StorageManifestRevocation(revocationEpoch)
```

Unique/check:

```text
UNIQUE(effectId) WHERE state IN ('ISSUED','CONSUMED')
CHECK state='ISSUED'  -> consumedAt IS NULL AND revokedAt IS NULL
CHECK state='CONSUMED'-> consumedAt IS NOT NULL AND revokedAt IS NULL
CHECK state='REVOKED' -> consumedAt IS NULL AND revokedAt IS NOT NULL
CHECK state='EXPIRED' -> consumedAt IS NULL AND revokedAt IS NULL
CHECK issuedAt < expiresAt
CHECK destructive effectKind IN ('DELETE','CONFLICT_CLEANUP')
      -> destructiveTargetId IS NOT NULL
         AND investigationSnapshotId IS NOT NULL
CHECK destructive effectKind NOT IN ('DELETE','CONFLICT_CLEANUP')
      -> destructiveTargetId IS NULL
         AND investigationSnapshotId IS NULL
CHECK representationAttemptId IS NOT NULL
      OR quarantineEpochSnapshot=0
```

The deferred permit trigger additionally enforces:

```text
representationAttemptId IS NULL
OR (
  attempt.operationId = permit.operationId
  AND effect.operationId = permit.operationId
  AND (
    attempt.backendKind = 'LOCAL_FILE'
    OR EXISTS (
      SELECT 1
      FROM StorageObjectRepresentationAttempt objectTarget
      WHERE objectTarget.attemptId = attempt.id
        AND objectTarget.providerScopeId = permit.providerScopeId
        AND objectTarget.objectKey = permit.objectKey
    )
  )
)
```

Issuance:

```text
BEGIN
 acquire sealed key plan locks
 lock effect/representation/operation
 verify current quarantine epoch and dispatchBlocked=false
 verify trust/revocation/routing epochs
 INSERT permit ISSUED
 UPDATE effect requestState=DISPATCH_ELIGIBLE
 UPDATE effect state to not-yet-dispatched
COMMIT
```

The issue function additionally requires a `VERIFIED` snapshot in the same
transaction for every destructive effect. A missing/unsupported snapshot makes
issuance fail with SQLSTATE `23514` and `D6_SNAPSHOT_REQUIRED`; it does not
issue a permit that cleanup may later use. Epoch columns have exact parent FKs to
the route-control, trust-root and revocation records, and the issue trigger
rechecks each current value. Advisory locks are not substituted for these row
constraints.

Consumption:

```text
BEGIN
 UPDATE permit
 SET state='CONSUMED', consumedAt=now()
 WHERE id=:permit
   AND state='ISSUED'
   AND expiresAt > now()
   AND quarantineEpochSnapshot=current attempt epoch
   AND dispatchBlocked=false;
 rowcount MUST BE 1
 UPDATE effect requestState=DISPATCHED
COMMIT
```

The Provider call is made after the consumption transaction. A quarantine
after this commit cannot recall it.

### 7.3 InvestigationSnapshot

`StorageDestructiveOperationTarget` is the immutable target selector:

```text
id                           varchar(32) PK
operationId                  varchar(32) NOT NULL
targetRepresentationAttemptId varchar(32) NOT NULL
targetKind                   OBJECT_STORE | LOCAL_FILE
sourceProviderScopeId        varchar(32) NULL
sourceObjectKey              varchar(255) NULL
sourceObjectVersionId        varchar(32) NULL
sourceProviderVersionToken   varchar(255) NULL
sourceProviderGeneration     bigint NULL
sourceLocalLifecycleId       varchar(32) NULL
createdAt                    timestamptz(6) NOT NULL
```

```text
UNIQUE(operationId)
UNIQUE(id,operationId)
UNIQUE(id,operationId,targetRepresentationAttemptId)
FK(targetRepresentationAttemptId) -> StorageRepresentationAttempt(id)
FK(targetRepresentationAttemptId,operationId)
  -> StorageRepresentationAttempt(id,operationId)
```

`StorageRepresentationAttempt` therefore declares
`UNIQUE(id,operationId)`. The target family matrix is mandatory:

```text
OBJECT_STORE: sourceProviderScopeId/sourceObjectKey/sourceObjectVersionId/
              sourceProviderVersionToken NOT NULL;
              sourceProviderGeneration may be NULL only for token-only schemes;
              sourceLocalLifecycleId NULL
LOCAL_FILE:   sourceLocalLifecycleId NOT NULL;
              all Provider fields NULL
```

`StorageInvestigationSnapshot`:

```text
id                         varchar(32) PK
destructiveTargetId        varchar(32) NOT NULL
operationId                varchar(32) NOT NULL
sourceRepresentationAttemptId varchar(32) NOT NULL
sourceProviderScopeId      varchar(32) NULL
sourceObjectKey            varchar(255) NULL
sourceObjectVersionId      varchar(32) NULL
sourceProviderVersionToken varchar(255) NULL
sourceProviderGeneration   bigint NULL
sourceLocalLifecycleId     varchar(32) NULL
snapshotProviderScopeId    varchar(32) NULL
snapshotObjectKey          varchar(255) NULL
snapshotObjectVersionId    varchar(32) NULL
snapshotProviderVersionToken varchar(255) NULL
snapshotProviderGeneration bigint NULL
snapshotLocalLifecycleId   varchar(32) NULL
sizeBytes                  bigint NOT NULL CHECK > 0
checksumSha256             char(64) NOT NULL
evidenceId                 varchar(32) NOT NULL
state                      VERIFIED | RETAINED |
                           RELEASE_PENDING | RELEASED
releaseEvidenceId          varchar(32) NULL
releasedAt                 timestamptz(6) NULL
createdAt                  timestamptz(6) NOT NULL
```

Exact FKs:

```text
(destructiveTargetId,operationId,sourceRepresentationAttemptId)
  -> StorageDestructiveOperationTarget(
       id,operationId,targetRepresentationAttemptId)

(sourceObjectVersionId,sourceProviderScopeId,sourceObjectKey,
 sourceProviderVersionToken)
  -> StorageObjectVersion(
       id,providerScopeId,objectKey,providerVersionToken)

(snapshotObjectVersionId,snapshotProviderScopeId,snapshotObjectKey,
 snapshotProviderVersionToken)
  -> StorageObjectVersion(
       id,providerScopeId,objectKey,providerVersionToken)

sourceProviderScopeId -> StorageProviderScope(id) when non-null
sourceLocalLifecycleId -> StorageObjectLifecycle(id) when non-null
snapshotProviderScopeId -> StorageProviderScope(id) when non-null
snapshotLocalLifecycleId -> StorageObjectLifecycle(id) when non-null
evidenceId -> StorageLifecycleEvidence(id)
releaseEvidenceId -> StorageQuarantineReleaseEvidence(evidenceId)
  when releaseEvidenceId is non-null
```

Uniques:

```text
PK(id)
UNIQUE(destructiveTargetId)
UNIQUE(id,destructiveTargetId,operationId)
UNIQUE(evidenceId)
```

Checks:

```text
OBJECT_STORE:
  sourceProviderScopeId/sourceObjectKey/sourceObjectVersionId/
  sourceProviderVersionToken/snapshotProviderScopeId/snapshotObjectKey/
  snapshotObjectVersionId/snapshotProviderVersionToken NOT NULL
  local fields NULL

LOCAL_FILE:
  sourceLocalLifecycleId/snapshotLocalLifecycleId NOT NULL
  provider fields NULL

state='VERIFIED' -> size/hash/Evidence are complete
state IN ('VERIFIED','RETAINED','RELEASE_PENDING')
  -> releaseEvidenceId IS NULL AND releasedAt IS NULL
state='RELEASED'
  -> releaseEvidenceId IS NOT NULL AND releasedAt IS NOT NULL
releaseEvidenceId <> evidenceId
release is forbidden while any open incident references destructiveTargetId
snapshot size/hash and Evidence size/hash match the selected source family
OBJECT_STORE snapshot evidence is exactly one ProviderOutcome subtype
LOCAL_FILE snapshot evidence is exactly one Representation subtype
```

Destructive DELETE/Conflict Cleanup cannot consume a permit unless its exact
target has a `VERIFIED` snapshot. If snapshot capability is unavailable, the
cleanup capability manifest must be `unsupported` and the operation disabled.

### 7.4 Incident and Quarantine Events

Incident/quarantine state changes use append-only event tables with exact
Incident/Quarantine FKs and Evidence FKs. The latest event is authoritative.
Snapshot retention is not released while any incident target is open.

### 7.5 Read Lease

`StorageReadLease` has exact representation attempt, route epoch,
quarantine epoch snapshot, state, and last check time. New reads require no
ACTIVE quarantine. A stream checks at 1 MiB/5 seconds; if cancellation is
unsupported, it is marked REVOKED and interruption is recorded. The database
cannot retract bytes already delivered.

### 7.6 In-flight External Effect

The following is the only allowed outcome matrix:

| Quarantine timing | Provider request | Result |
|---|---|---|
| before permit | no request | no effect |
| permit ISSUED, before CONSUMED | no request | permit REVOKED |
| after CONSUMED, before response | may execute | effect IN_FLIGHT/UNKNOWN; snapshot protects investigation |
| after response, before Finalization | external success exists | Finalizer rejects due quarantine |
| after Finalization | existing representation | incident/quarantine blocks new reads/cleanup |

No database transaction is claimed to cancel an issued request.

## 8. Complete Constraint Matrix

### 8.1 Parent Unique/PK Anchors

| Parent | Required anchor |
|---|---|
| ProviderEffect | `PK(id)`, `(id,operationId)`, `(id,operationId,effectKind)`, `(id,operationId,sourceGeneration)`, `(id,operationId,allocationId,sourceGeneration)`, `(id,operationId,providerScopeId,endpointBindingId,objectKey)`, `(id,effectKind,operationId,providerScopeId,endpointBindingId,objectKey,sourceGeneration)` |
| ProviderEffectOwner | `PK(effectId)`, `(effectId,uploadActionId)`, `(effectId,publisherAttemptId)`, `(effectId,cleanupAttemptId)` |
| UploadAction | `PK(id)`, `(id,uploadSessionId)`, `(id,stagingOperationId)`, `(id,providerEffectId)`, `(id,providerEffectId,effectRelation)` |
| PublisherAttempt | `PK(id)`, `(id,providerEffectId)`, `(id,operationId,authorityGeneration)` |
| CleanupAttempt | `PK(id)`, `(id,providerEffectId)`, `(id,operationId,authorityGeneration)` |
| UploadSession | `PK(id)`, `(id,stagingOperationId,sessionGeneration)`, `(id,stagingOperationId,allocationId)` |
| ObjectVersion | `PK(id)`, `(id,allocationId)`, `(id,sourceOperationId)`, `(id,sourceUploadSessionId)`, `(id,providerScopeId,objectKey)`, `(id,providerScopeId,objectKey,providerVersionToken)` |
| RepresentationSlot | `PK(id)`, `(id,fileVersionId,role,backendKind)` |
| RepresentationAttempt | `PK(id)`, `(id,slotId,backendKind)`, `(id,operationId)` |
| ObjectBinding | `PK(id)`, `(id,objectVersionId)`, `(id,operationId,objectVersionId)`, `(id,allocationId,providerScopeId,objectKey,objectVersionId)` |
| Evidence | `PK(id)`, `(id)`, `(id,evidenceType)`, `(id,operationId)` |
| MigrationRecord | `PK(id)`, `(id,sourceSlotId)`, `(id,sourceRepresentationAttemptId,targetRepresentationAttemptId)` |
| DestructiveTarget | `PK(id)`, `(id,operationId)`, `(id,operationId,targetRepresentationAttemptId)`, `(operationId,targetRepresentationAttemptId)` |
| InvestigationSnapshot | `PK(id)`, `(destructiveTargetId)`, `(id,destructiveTargetId,operationId)` |
| DispatchPermit | `PK(id)`, `(effectId)` partial active, `(id,effectId)` |
| AuthorityClaim | `PK(id)`, `(id,operationId,generation)`, `(id,operationId,sessionId)` |
| AuthoritySession | `PK(id)`, `(id,workloadId,dbRole,operationId)` |
| ObjectKeyAllocation | `PK(id)`, `(id,operationId)` |
| EndpointBinding | `PK(id)`, `(providerScopeId,id)` |
| IncidentTarget | `PK(incidentId,representationAttemptId)` |
| ManifestRevocation | `PK(id)`, `(id,manifestId,revokedKeyId,epoch)` |
| ReadbackEvidence | `UNIQUE(evidenceId)` |
| QuarantineReleaseEvidence | `UNIQUE(evidenceId)` |

### 8.2 Active Pointer Constraints

```text
UploadSessionActionSlot.activeActionId:
  nullable single-column FK -> UploadAction(id)
  deferred trigger same session + active action state
  UNIQUE(activeActionId)
  slot table PK(uploadSessionId)

RepresentationSlot.activeAttemptId:
  nullable single-column FK -> RepresentationAttempt(id)
  deferred trigger same slot/backend + active attempt state
  UNIQUE(activeAttemptId)
  slot table UNIQUE(fileVersionId,role)

Operation/Lifecycle.activeAuthorityClaimId:
  deferred composite FK -> Claim(id,operationId,generation)
```

`MATCH FULL` is not used for a pointer with another non-null component and a
NULL pointer state. The FK identity is exact; membership and state are enforced
by deferred triggers.

Pointer CAS rules:

```text
ActionSlot acquire:
  UPDATE StorageUploadSessionActionSlot
  SET activeActionId=:newAction, slotEpoch=slotEpoch+1
  WHERE uploadSessionId=:session
    AND slotEpoch=:expectedEpoch
    AND (activeActionId IS NULL OR activeActionId=:sameAction)
  rowcount=1

ActionSlot release:
  UPDATE StorageUploadSessionActionSlot
  SET activeActionId=NULL
  WHERE uploadSessionId=:session
    AND activeActionId=:finishedAction
    AND slotEpoch=:expectedEpoch
  rowcount=1

RepresentationSlot acquire/release uses the same row CAS with
activeAttemptId and the attempt's slot/backend/quarantine epoch snapshot.
```

A NULL pointer cannot be “replaced” by a predicate that omits `IS NULL`;
the exact predicates above are part of the implementation contract.

### 8.3 Delete/Update

```text
Evidence, Effects, Owners, Actions, Results, Attempts, Incidents: append-only
Active pointers: updated only by named NOLOGIN functions
Terminal effects/actions/attempts: immutable
Parent rows: ON DELETE RESTRICT
Cross-scope/operation/version updates: RESTRICT or immutable
```

## 9. Typed Evidence Complete Model

All subtypes inherit the common base:

```text
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

Common constraints:

```text
UNIQUE(id,evidenceType)
UNIQUE(operationId,evidenceType,requestNonce)

FK(authoritySessionId,producerWorkloadId,producerDbRole,operationId)
  -> AuthoritySession(id,workloadId,dbRole,operationId)
FK(authorityClaimId,operationId,authoritySessionId)
  -> AuthorityClaim(id,operationId,sessionId)
```

Every subtype has:

```text
evidenceId         varchar(32) PK
discriminator      varchar(40) NOT NULL
operationId        varchar(32) NOT NULL
objectVersionId    varchar(32) NULL

FK(evidenceId) -> StorageLifecycleEvidence(id)
  DEFERRABLE INITIALLY DEFERRED
UNIQUE(evidenceId,discriminator)
```

The `objectVersionId` nullable component deliberately does **not** use a
nullable composite FK. PostgreSQL `MATCH SIMPLE` would skip the whole FK when
the column is NULL. A deferred constraint trigger instead requires, after every
subtype/base insert or update:

```text
subtype.discriminator = base.evidenceType
subtype.operationId = base.operationId
subtype.objectVersionId IS NOT DISTINCT FROM base.objectVersionId
```

The same trigger enforces the subtype-specific object linkage and rejects a
subtype that lacks the discriminator/operation/object columns. These are
database trigger predicates, not an application-side convention. All subtype
and base tables reject UPDATE of canonical fields and all DELETE/TRUNCATE.

### 9.1 Authorization Evidence

Fields:

```text
authorityClaimId
authorityGeneration
authorityStateSnapshot
ownerTokenDigest
leaseExpiresAt
trustRootEpoch
revocationEpoch
routingEpoch
```

FK/check:

```text
FK(authorityClaimId,operationId,authorityGeneration)
  -> AuthorityClaim(id,operationId,generation)
CHECK authorityStateSnapshot in enum
CHECK ownerTokenDigest 64 lowercase hex
```

### 9.2 Provider Operation Evidence

Fields:

```text
providerEffectId
publisherAttemptId NULL
uploadActionId NULL
providerScopeId
endpointBindingId
objectKey
apiOperationName
requestParametersDigest
providerRequestId NULL
requestState
```

FK/check:

```text
CHECK num_nonnulls(publisherAttemptId,uploadActionId)=1
FK(providerEffectId,operationId,providerScopeId,endpointBindingId,objectKey)
  -> ProviderEffect(id,operationId,providerScopeId,endpointBindingId,objectKey)
UNIQUE(providerEffectId,requestNonce)
FK(uploadActionId,providerEffectId)
  -> UploadAction(id,providerEffectId) when uploadActionId is non-null
FK(publisherAttemptId,providerEffectId)
  -> PublisherAttempt(id,providerEffectId) when publisherAttemptId is non-null
base.providerEffectId = providerEffectId
base.operationId = providerEffect.operationId
```

### 9.3 Provider Outcome Evidence

Fields:

```text
providerEffectId
effectOperationId
effectKind
effectAllocationId
providerRequestId
normalizedResult
providerStatusCode
providerVersionToken NULL
providerGeneration NULL
resultObjectVersionId NULL
responseDigest
```

FK/check:

```text
FK(providerEffectId,effectOperationId,effectKind)
  -> ProviderEffect(id,operationId,effectKind)
base.providerEffectId = providerEffectId
base.operationId = effectOperationId
base.objectVersionId IS NOT DISTINCT FROM resultObjectVersionId
UNIQUE(providerEffectId,providerRequestId)
CHECK responseDigest 64 hex
CHECK version/generation nullability follows ProviderEffect scheme
FK(resultObjectVersionId,effectOperationId)
  -> ObjectVersion(id,sourceOperationId) when resultObjectVersionId is non-null
FK(resultObjectVersionId,effectAllocationId)
  -> ObjectVersion(id,allocationId) when resultObjectVersionId is non-null
```

### 9.4 Readback Evidence

Fields:

```text
providerEffectId NULL
representationAttemptId NULL
providerScopeId
endpointBindingId
objectKey
objectVersionId
providerVersionToken
providerGeneration NULL
sizeBytes
checksumSha256
readbackRequestId UNIQUE
readStartedAt
readCompletedAt
```

FK/check:

```text
FK(objectVersionId,providerScopeId,objectKey)
  -> ObjectVersion(id,providerScopeId,objectKey)
base.objectVersionId = objectVersionId
CHECK num_nonnulls(providerEffectId,representationAttemptId)=1
FK(providerEffectId) -> ProviderEffect(id) when present
FK(representationAttemptId) -> RepresentationAttempt(id) when present
CHECK provider version token = ObjectVersion.providerVersionToken
CHECK sizeBytes > 0
CHECK readCompletedAt >= readStartedAt
```

### 9.5 Upload Action Evidence

Fields:

```text
uploadActionId
uploadSessionId
uploadSessionGeneration
actionType
idempotencyNonce
requestDigest
providerUploadId NULL
normalizedResult
resultObjectVersionId NULL
```

FK/check:

```text
FK(uploadActionId,uploadSessionId)
  -> UploadAction(id,uploadSessionId)
UNIQUE(uploadActionId,idempotencyNonce)
CHECK resultObjectVersionId required for COMPLETE SUCCEEDED
base.uploadActionId = uploadActionId
base.operationId = uploadAction.stagingOperationId
base.objectVersionId IS NOT DISTINCT FROM resultObjectVersionId
FK(resultObjectVersionId,uploadSessionId)
  -> ObjectVersion(id,sourceUploadSessionId) when resultObjectVersionId is non-null
```

### 9.6 Migration Copy Evidence

Fields:

```text
migrationRecordId
sourceRepresentationAttemptId
targetRepresentationAttemptId
targetAllocationId
bindingId
targetObjectVersionId
copyRequestId
```

FK/unique:

```text
FK(migrationRecordId) -> MigrationRecord(id)
FK(sourceRepresentationAttemptId) -> RepresentationAttempt(id)
FK(targetRepresentationAttemptId) -> RepresentationAttempt(id)
FK(targetObjectVersionId,targetAllocationId)
  -> ObjectVersion(id,allocationId)
FK(bindingId,targetObjectVersionId)
  -> ObjectBinding(id,objectVersionId)
FK(migrationRecordId,sourceRepresentationAttemptId,targetRepresentationAttemptId)
  -> MigrationRecord(
       id,sourceRepresentationAttemptId,targetRepresentationAttemptId)
base.objectVersionId = targetObjectVersionId
UNIQUE(migrationRecordId,copyRequestId)
```

### 9.7 Migration Readback Evidence

Fields:

```text
migrationRecordId
sourceRepresentationAttemptId
targetRepresentationAttemptId
sourceSizeBytes
sourceChecksumSha256
targetSizeBytes
targetChecksumSha256
verifierReadbackRequestId
```

FK/check:

```text
FK(migrationRecordId) -> MigrationRecord(id)
FK(migrationRecordId,sourceRepresentationAttemptId,targetRepresentationAttemptId)
  -> MigrationRecord(
       id,sourceRepresentationAttemptId,targetRepresentationAttemptId)
base.objectVersionId IS NULL
CHECK sourceSizeBytes=targetSizeBytes
CHECK sourceChecksumSha256=targetChecksumSha256
UNIQUE(migrationRecordId,verifierReadbackRequestId)
```

### 9.8 Representation Evidence

Fields:

```text
representationSlotId
representationAttemptId
representationGeneration
backendKind
targetLifecycleId NULL
targetBindingId NULL
targetObjectVersionId NULL
sizeBytes
checksumSha256
```

FK/check:

```text
FK(representationAttemptId,representationSlotId,backendKind)
  -> RepresentationAttempt(id,slotId,backendKind)
CHECK exactly one target family
FK(targetLifecycleId) -> ObjectLifecycle(id) when targetLifecycleId present
FK(targetBindingId) -> ObjectBinding(id) when targetBindingId present
FK(targetObjectVersionId) -> ObjectVersion(id) when targetObjectVersionId present
base.representationAttemptId = representationAttemptId
base.objectVersionId IS NOT DISTINCT FROM targetObjectVersionId
```

### 9.9 Delete Result Evidence

Fields:

```text
destructiveTargetId
providerEffectId
providerScopeId NULL
endpointBindingId NULL
exactObjectVersionId NULL
localLifecycleId NULL
providerDeleteReadbackId NULL
normalizedResult
providerRequestId
```

```text
FK(destructiveTargetId) -> DestructiveTarget(id)
FK(providerEffectId) -> ProviderEffect(id)
CHECK exactly one target family
UNIQUE(providerEffectId,providerRequestId)
FK(destructiveTargetId,operationId)
  -> DestructiveTarget(id,operationId)
FK(providerEffectId,operationId,effectKind)
  -> ProviderEffect(id,operationId,effectKind)
CHECK effectKind IN ('DELETE','CONFLICT_CLEANUP')
FK(providerDeleteReadbackId) -> DeleteReadbackEvidence(evidenceId)
  DEFERRABLE INITIALLY DEFERRED
base.objectVersionId IS NOT DISTINCT FROM exactObjectVersionId
```

### 9.10 Delete Readback Evidence

Fields:

```text
destructiveTargetId
exactObjectVersionId NULL
localLifecycleId NULL
absenceVerified
retentionLockObserved
deleteMarkerObserved
observedAt
```

```text
FK(destructiveTargetId) -> DestructiveTarget(id)
FK(destructiveTargetId,operationId)
  -> DestructiveTarget(id,operationId)
CHECK exactly one target family
CHECK absenceVerified OR retentionLockObserved OR deleteMarkerObserved
base.objectVersionId IS NOT DISTINCT FROM exactObjectVersionId
```

### 9.11 Provider Audit Evidence

Fields:

```text
providerEventId UNIQUE
providerRequestId NULL
providerPrincipalId
providerScopeId
endpointBindingId
objectKey NULL
objectVersionId NULL
normalizedAction
eventResult
eventAt
deliveryComplete
```

```text
FK(providerScopeId,endpointBindingId)
  -> EndpointBinding(providerScopeId,id)
UNIQUE(providerScopeId,providerEventId)
CHECK objectKey/objectVersion together when event references object
FK(objectVersionId,providerScopeId,objectKey)
  -> ObjectVersion(id,providerScopeId,objectKey)
  when objectVersionId is non-null
base.objectVersionId IS NOT DISTINCT FROM objectVersionId
base.operationId must match the correlated known Effect/Operation
```

An uncorrelated raw Provider audit event is retained in a quarantine intake
table and is not accepted as `ProviderAuditEvidence` and cannot satisfy a
Finalizer or cleanup gate.

### 9.12 Manifest Revocation Evidence

Fields:

```text
revocationRecordId
manifestId NULL
revokedKeyId NULL
revocationEpoch
rootVersionId
gateWorkloadId
effectiveAt
```

```text
FK(revocationRecordId) -> ManifestRevocation(id)
FK(rootVersionId) -> TrustRootVersion(id)
CHECK num_nonnulls(manifestId,revokedKeyId)=1
FK(revocationRecordId,manifestId,revokedKeyId,revocationEpoch)
  -> ManifestRevocation(id,manifestId,revokedKeyId,epoch)
base.objectVersionId IS NULL
```

### 9.13 Integrity Incident Evidence

Fields:

```text
incidentId
detectionSource
detectedRepresentationAttemptId NULL
observedProviderVersionId NULL
observedSizeBytes NULL
observedChecksumSha256 NULL
observationDigest
```

```text
FK(incidentId) -> IntegrityIncident(id)
FK(detectedRepresentationAttemptId) -> RepresentationAttempt(id)
CHECK at least one observed fact non-null
FK(incidentId,detectedRepresentationAttemptId)
  -> IncidentTarget(incidentId,representationAttemptId)
  when detectedRepresentationAttemptId is non-null
base.incidentId = incidentId
base.representationAttemptId IS NOT DISTINCT FROM detectedRepresentationAttemptId
```

### 9.14 Quarantine Release Evidence

Fields:

```text
incidentId
representationAttemptId
independentReadbackEvidenceId
verifierWorkloadId
decision
```

```text
FK(incidentId,representationAttemptId)
  -> IncidentTarget(incidentId,representationAttemptId)
FK(independentReadbackEvidenceId) -> ReadbackEvidence(evidenceId)
CHECK verifierWorkloadId differs from detector workload
UNIQUE(incidentId,representationAttemptId)
FK(incidentId,representationAttemptId)
  -> IncidentTarget(incidentId,representationAttemptId)
base.incidentId = incidentId
base.representationAttemptId = representationAttemptId
base.objectVersionId = independentReadback.objectVersionId
```

### 9.15 Digest Verification

Canonical evidence bytes:

```text
domain = UTF-8("aic-elevator/storage-evidence/v1") + 0x00
u8 schema version
u16 field count
for each published subtype field:
  u32 field-name length
  field-name UTF-8
  u8 type
  value encoding (same type codes as requestDigest)
```

`canonicalPayloadDigest = SHA-256(domain || envelope)`.

The NOLOGIN ingestion function computes it from the typed row and common
fields. Caller-supplied digest is not trusted. Read verification recomputes it.
If the database lacks an approved SHA-256 primitive, Evidence ingestion and
acceptance remain disabled.

### 9.16 Per-subtype acceptance matrix

All fourteen tables are physical tables. Each table has the four common child
columns from §9, `PK(evidenceId)`, the table-specific `discriminator` constant,
the base-row FK, exact domain FKs, `UNIQUE(evidenceId)`, append-only guards and
the deferred base-projection trigger. `producerPurpose` is copied from the
Authority Session and cannot be supplied by the caller.

| Type | Discriminator | Required refs not already common | Nullable refs | Allowed producer purpose |
|---|---|---|---|---|
| `StorageAuthorizationEvidence` | `AUTHORIZATION` | `authorityClaimId`, `authorityGeneration` | Provider/object refs | `AUTHORITY_SERVICE` |
| `StorageProviderOperationEvidence` | `PROVIDER_OPERATION` | `providerEffectId`, `providerScopeId`, `endpointBindingId`, `objectKey` | `providerRequestId`; exactly one action/attempt owner | `BROKER` |
| `StorageProviderOutcomeEvidence` | `PROVIDER_OUTCOME` | `providerEffectId`, `effectOperationId`, `effectKind`, `providerStatusCode`, `normalizedResult`, `responseDigest` | version/result version for no-effect | `BROKER` |
| `StorageReadbackEvidence` | `READBACK_VERIFIED` | `providerScopeId`, `endpointBindingId`, `objectKey`, `objectVersionId`, version token, size, checksum | exactly one effect/attempt correlation | `READBACK_VERIFIER` or `INDEPENDENT_VERIFIER` |
| `StorageUploadActionEvidence` | `UPLOAD_ACTION` | `uploadActionId`, `uploadSessionId`, `uploadSessionGeneration`, `actionType`, `idempotencyNonce`, `requestDigest` | `providerUploadId`, `resultObjectVersionId` per action state | `UPLOAD_WORKER` |
| `StorageMigrationCopyEvidence` | `MIGRATION_COPY_RESULT` | migration record/source/target attempts, target allocation/version/binding, `copyRequestId` | none | `MIGRATION_WORKER` |
| `StorageMigrationReadbackEvidence` | `MIGRATION_READBACK` | migration record/source/target attempts, source/target size/hash, request ID | none; base object version is NULL | `INDEPENDENT_VERIFIER` |
| `StorageRepresentationEvidence` | `REPRESENTATION` | slot, attempt, generation, backend, size, checksum | backend target family by the matrix below | `REPRESENTATION_FINALIZER` |
| `StorageDeleteResultEvidence` | `DELETE_RESULT` | destructive target, effect, normalized result, provider request ID | backend-specific scope/endpoint/version/lifecycle/readback | `CLEANUP_WORKER` |
| `StorageDeleteReadbackEvidence` | `DELETE_READBACK` | destructive target, absence/retention/delete-marker result | exact version plus local lifecycle | `CLEANUP_VERIFIER` |
| `StorageProviderAuditEvidence` | `PROVIDER_AUDIT_EVENT` | provider event ID, principal, scope, endpoint, action, result, event time, delivery complete | request ID, object key, object version | `PROVIDER_EVENT_INGESTOR` |
| `StorageManifestRevocationEvidence` | `MANIFEST_REVOCATION` | revocation record, revocation epoch, root version, gate workload, effective time | exactly one of manifest/key in the revocation record | `CAPABILITY_GATE` |
| `StorageIntegrityIncidentEvidence` | `INTEGRITY_INCIDENT` | incident, detection source, observation digest | detected attempt and observed version/size/hash, with at least one observation | `DETECTOR` |
| `StorageQuarantineReleaseEvidence` | `QUARANTINE_RELEASE` | incident, representation, independent readback ID, verifier workload, decision | none; base object version must equal readback version | `INDEPENDENT_VERIFIER` distinct from detector |

The matrix in the `StorageRepresentationEvidence` row is intentionally
normalized as follows:

```text
LOCAL_FILE:   targetLifecycleId NOT NULL;
              targetBindingId/targetObjectVersionId NULL
OBJECT_STORE: targetBindingId/targetObjectVersionId NOT NULL;
              targetLifecycleId NULL
```

For `StorageRepresentationEvidence`, the executable CHECK is the three-column
matrix immediately above.

Failures are deterministic:

| Condition | SQLSTATE / code |
|---|---|
| missing/extra subtype field, invalid NULL combination, wrong discriminator | `23514` / `D6_EVIDENCE_SHAPE` |
| base/subtype projection mismatch | `23514` / `D6_EVIDENCE_PROJECTION_MISMATCH` |
| producer workload/role/purpose not allowed for subtype | `42501` / `D6_EVIDENCE_PRODUCER_DENIED` |
| digest supplied by caller or recomputed differently | `23514` / `D6_EVIDENCE_DIGEST_MISMATCH` |
| duplicate nonce or duplicate unique parent tuple | `23505` / `D6_EVIDENCE_REPLAY` |
| parent/object/operation mismatch | `23503` / `D6_EVIDENCE_FK_MISMATCH` |
| any UPDATE/DELETE/TRUNCATE after insert | `42501` / `D6_EVIDENCE_IMMUTABLE` |

These are reject paths for a later schema implementation. No SQLSTATE has been
executed in this design task.

## 10. Complete State Machines

### 10.1 Provider Effect

The Effect row is the only authority for Provider-side mutation outcome.
`requestState` records the transport boundary; `effectState` records observed
effect. They never create a second terminal result table.

```text
requestState:
  NOT_STARTED -> DISPATCH_ELIGIBLE -> DISPATCHED
  DISPATCHED -> RESPONSE_OBSERVED | RESPONSE_UNKNOWN
  RESPONSE_UNKNOWN -> RESPONSE_OBSERVED
  RESPONSE_OBSERVED / RESPONSE_UNKNOWN are terminal for transport

effectState:
  NOT_STARTED -> IN_FLIGHT
  IN_FLIGHT -> NO_EFFECT | EXACT_OBSERVED | CONTENT_VERIFIED |
                WRONG_CONTENT | LATE_EFFECT_UNCLAIMED | FAILED_RETAINED
  EXACT_OBSERVED -> CONTENT_VERIFIED | WRONG_CONTENT
  NO_EFFECT | CONTENT_VERIFIED | WRONG_CONTENT |
  LATE_EFFECT_UNCLAIMED | FAILED_RETAINED -> terminal
```

`RESPONSE_UNKNOWN + IN_FLIGHT` is legal. It is not an inferred failure.
`CONTENT_VERIFIED` requires a `StorageReadbackEvidence` row bound to the same
object version, size and SHA-256. `NO_EFFECT` is allowed only after an exact
Provider reconciliation; a timeout alone is insufficient.

Effect kind matrix:

| Effect kind | Object version | Provider request | Terminal evidence |
|---|---|---|---|
| `UPLOAD_CREATE` | NULL | NULL before observation; request ID later | Provider Operation, then Outcome |
| `UPLOAD_PART` | NULL | part request ID | Provider Operation/Outcome and part checkpoint |
| `UPLOAD_COMPLETE` | required on success | request ID | Outcome plus Readback |
| `UPLOAD_ABORT` | NULL | request ID | Outcome only |
| `CANONICAL_PUBLISH` | required | request ID | Outcome plus Readback |
| `MIGRATION_COPY` | required | request ID | Copy and Readback Evidence |
| `ROLLBACK_COPY` | required | request ID | Copy and Readback Evidence |
| `DELETE` | exact source version snapshot | request ID | Delete Result/Readback |
| `CONFLICT_CLEANUP` | exact source version snapshot | request ID | Delete Result/Readback |

No object version, request ID or version token is invented for a failed or
no-effect transition.

### 10.2 Upload Action and Owner

```text
PREPARED -> DISPATCHED
PREPARED -> FAILED
DISPATCHED -> SUCCEEDED | FAILED | RESPONSE_UNKNOWN
RESPONSE_UNKNOWN -> SUCCEEDED | FAILED | SUPERSEDED
SUCCEEDED | FAILED | SUPERSEDED -> terminal
```

- Only one `PRIMARY` action may own an Effect.
- A `RECONCILE` action must reference the existing Effect and has
  `primaryEffectOwnerActionId=NULL`.
- Only the current action-slot row can dispatch a new mutation.
- `DISPATCHED` after a crash means “Provider may have received the request.”
  It is reconciled, not blindly invoked again.
- An action terminal result is a projection of its Effect; it cannot disagree
  with Effect state.

The exact nonce key is:

```text
UNIQUE(
  operationId,
  uploadSessionId,
  actionType,
  idempotencyNonce
)
```

`idempotencyNonce` is 32 random bytes encoded as 64 lowercase hex characters.
The stored nonce is a digest; the scope prevents an unrelated operation from
consuming availability. A collision inside one operation/action type is a
conflict, not a second action.

### 10.3 Representation Attempt

```text
CANDIDATE -> VERIFIED -> ACTIVE
CANDIDATE -> FAILED_RETAINED
VERIFIED -> FAILED_RETAINED
ACTIVE -> SUPERSEDED | FAILED_RETAINED
SUPERSEDED | FAILED_RETAINED -> terminal
```

`quarantineEpoch` advances only when an incident quarantines the attempt.
`dispatchBlocked` can go false -> true in that same transaction, never back to
false for the same attempt. A new attempt gets the next generation. A failed
attempt and its provider object are retained.

### 10.4 Dispatch Permit

```text
ISSUED -> CONSUMED
ISSUED -> REVOKED
ISSUED -> EXPIRED
CONSUMED | REVOKED | EXPIRED -> terminal
```

The `ISSUED -> CONSUMED` CAS is the last DB gate before the external call.
`CONSUMED` means the caller has permission to attempt the call, not that the
Provider observed it. A crash after this CAS leaves `DISPATCHED`/unknown and
requires reconciliation. No code path turns `CONSUMED` back into `ISSUED`.

### 10.5 Incident and Quarantine

```text
Incident:
  DETECTED -> CONTAINED -> REVIEW -> RELEASED
  DETECTED | CONTAINED | REVIEW -> REJECTED_RETAINED

Quarantine:
  ACTIVE -> RELEASE_PENDING -> RELEASED
  ACTIVE -> REJECTED_RETAINED
```

Each state transition is an append-only event. Aggregate current state is the
event with the greatest contiguous `sequenceNo`; gaps, duplicate sequence
numbers, cycles, illegal transition and concurrent same-sequence inserts are
rejected. `CONTAINED` requires a concrete attempt quarantine epoch increment.
Release requires independent verifier readback, a release Evidence row, and no
open incident target. A release never changes prior event rows.

### 10.6 Routing and Capability

```text
Routing epoch:
  N -> N+1 on a one-way cutover

Capability lease:
  ACTIVE -> SUSPENDED | EXPIRED | REVOKED
  SUSPENDED -> ACTIVE only after fresh observation and a new lease generation
  EXPIRED | REVOKED -> terminal
```

Endpoint candidate, manifest operation children, observation, and lease are
all inserted in one transaction. A lease is ACTIVE only when:

```text
manifest operation set includes the lease operation set
root epoch and revocation epoch match the current trust state
endpoint binding and provider scope match exactly
observation state=PASS and expires after the lease
configuration digest matches
```

The child-set relation is deferrable. Missing manifest children cause COMMIT
failure, not a partially active capability.

## 11. Transaction, Lock and Recovery Protocol

### 11.1 Global lock order

All state-changing functions use this order; they may skip unneeded levels but
may not reverse them:

```text
1. operation lock-plan rows, sorted by lock-plan sort key
2. Authority Session / Authority Claim
3. Operation and Lifecycle
4. Upload Session and Action Slot
5. Provider Effect and Effect Owner
6. Publisher/Cleanup Attempt and Representation Slot/Attempt
7. Binding / exact Object Version / FileVersion
8. Destructive Target / Investigation Snapshot
9. Evidence, event, and audit rows
```

Multi-key plans store the complete key set before locking, sorted by UTF-8
byte order. Acquiring a new key after seal, or locking outside this order,
returns `D6_LOCK_PLAN_MUTATED` / SQLSTATE `55000`. Serialization failure
`40001` and deadlock `40P01` may be retried only from the outer transaction;
row-level state is re-read.

### 11.2 Claim and action/effect creation

```text
BEGIN
  lock operation and current claim
  verify operation type, session, expiry, trust/revocation/routing epochs
  CAS claim generation N -> N+1 in one UPDATE
  rowcount MUST be 1
  close previous claim exactly once
  assert exactly one ACTIVE claim
COMMIT
```

Action/Effect creation is one deferred transaction:

```text
BEGIN
  lock action slot, operation, upload session
  resolve exact request bytes and canonicalizer v1 digest
  INSERT ProviderEffect NOT_STARTED
  INSERT UploadAction PREPARED
  INSERT EffectOwner(uploadActionId=action.id)
  INSERT or replace active ActionSlot pointer
  assert one owner, one primary action, and same operation/key
COMMIT
```

The owner/action/effect cycle uses deferred FKs. A duplicate nonce with
identical canonical bytes returns the existing action without Provider call.
A duplicate nonce with different bytes fails before any permit or call.

### 11.3 Dispatch

```text
BEGIN
  lock sealed key plan, effect, operation, representation attempt
  assert current quarantine epoch, no incident, no dispatchBlocked
  assert current routing/trust/revocation epochs
  assert exact Effect tuple and one owner
  assert destructive effects have a VERIFIED Investigation Snapshot
  INSERT DispatchPermit ISSUED
COMMIT

BEGIN
  UPDATE DispatchPermit
    SET state='CONSUMED', consumedAt=:now
    WHERE id=:permit AND state='ISSUED'
      AND expiresAt > :now
      AND current attempt quarantineEpoch=quarantineEpochSnapshot
      AND dispatchBlocked=false
  rowcount MUST be 1
  UPDATE ProviderEffect SET requestState='DISPATCHED'
COMMIT

Provider double/system called at most once for this permit generation
```

The external call cannot be made inside the DB transaction and cannot be
retracted by a later CAS. If the consumed call response is lost, the next
state is `RESPONSE_UNKNOWN`; only exact reconciliation/readback may assign an
object version.

### 11.4 Provider outcome and response loss

```text
BEGIN
  lock effect, action/attempt, permit
  assert permit is CONSUMED for this exact effect
  INSERT ProviderOperationEvidence
  INSERT ProviderOutcomeEvidence
  if object expected: INSERT ReadbackEvidence with exact token/size/hash
  CAS responseState DISPATCHED/RESPONSE_UNKNOWN -> RESPONSE_OBSERVED
  CAS effectState IN_FLIGHT -> EXACT_OBSERVED/CONTENT_VERIFIED/NO_EFFECT
  rowcount MUST be 1
COMMIT
```

If the DB COMMIT response is lost, a fresh connection re-reads by action
nonce/digest, Effect ID and Evidence ID. The retry may return the existing
committed result; it must not create another Effect, action, object version or
FileVersion. If no durable row exists, the same action/Effect is reopened only
through reconciliation under its current claim.

### 11.5 Finalizer

```text
BEGIN
  lock sealed keys, current claim/session
  lock Source Effect, current Publisher/Finalizer attempt
  lock Binding, ObjectVersion, Representation Attempt, FileVersion
  assert source Effect from same operation/allocation/key
  assert source claim CLOSED/SUPERSEDED for response-loss recovery
  assert exact version Readback and size/SHA-256 match
  assert no incident/quarantine, current route/trust/revocation
  CAS binding CANDIDATE -> ACCEPTED
  CAS representation VERIFIED -> ACTIVE
  INSERT FileVersion exactly once
  INSERT BindingAcceptance and exactly-once acceptance Evidence
  INSERT AuditLog
COMMIT
```

An Evidence row without this Finalizer leaves a candidate retained; it never
creates a FileVersion. If the finalizer transaction fails after commit
uncertainty, retry queries by immutable `idempotencyKey`; rowcount 0 means read
the committed result.

### 11.6 Quarantine containment

Quarantine and cleanup use the same sealed key plan. The quarantine operation
must commit the incident, quarantine epoch increment, `dispatchBlocked=true`,
and containment event before it is allowed to influence a new permit. It
cannot retract a consumed request.

`StorageInvestigationSnapshot` is created and Verified before any destructive
permit is consumed. It is retained while an incident target is open. If a
Provider cannot create an exact-version snapshot, its DELETE/CONFLICT_CLEANUP
capability is `UNSUPPORTED`; no permit is issued and cleanup remains disabled.
A late in-flight Provider deletion after quarantine is acceptable only because
the pre-existing snapshot preserves the exact source version and its readback.

### 11.7 Cleanup and rollback

```text
BEGIN
  lock sealed key plan and destructive target
  assert exact target identity and current size/hash
  assert no live FileVersion / binding dependency
  assert no open incident target
  assert VERIFIED snapshot and current capability
  INSERT/Consume destructive DispatchPermit
COMMIT
Provider DELETE/COPY
BEGIN
  INSERT exact Provider Outcome/Readback Evidence
  CAS cleanup attempt to APPLIED/UNKNOWN/FAILED_RETAINED
  CAS target state
  INSERT AuditLog
COMMIT
```

Rollback copy follows the same pattern, but a quarantine committed during copy
prevents local activation. The partial local copy is retained as
`FAILED_RETAINED`; it is not promoted or silently deleted.

### 11.8 COMMIT unknown

No branch treats an unknown commit as successful or failed. A new connection
must read durable rows by immutable operation/action/attempt IDs, then inspect
the exact Provider version or snapshot. The allowed resolution is:

```text
durable terminal result present -> return it
durable active/unknown row     -> same-operation reconciliation
no durable row + object absent -> no-effect candidate only after exact probe
identity/hash/rule conflict    -> FAILED_RETAINED and quarantine
```

## 12. Authority, Database Roles and Evidence Trust

The current source has `elevator_app` as owner and no approved independent
runtime roles. D6 cannot claim those roles exist. The required future boundary
is:

| Principal | Allowed writes |
|---|---|
| `elevator_web` | Session/project auth and ordinary upload API; no Provider mutation or Evidence direct INSERT |
| `elevator_worker` | Queue reads and state proposals only; no direct authority/Evidence grants |
| `elevator_broker` | Provider dispatch through NOLOGIN functions |
| `elevator_maintenance` | cleanup gateway functions, never direct table/Storage delete |
| `elevator_definer` | NOLOGIN, owns narrowly scoped `SECURITY DEFINER` functions |
| `elevator_recovery` | separate future NOLOGIN/approved recovery path; not enabled |

Required function controls:

```text
SECURITY DEFINER functions owned by a NOLOGIN role
fixed search_path = pg_catalog, approved application schema
schema-qualified object references
REVOKE EXECUTE FROM PUBLIC
explicit EXECUTE only for the named runtime/Broker role
caller identity and workload principal re-read from DB, not request fields
no dynamic SQL, arbitrary table name, caller-supplied digest or owner ID
```

Evidence producer binding is a database fact: Authority Session must be
current, the workload/role/purpose must be allowed for the subtype, and the
claim/session/operation tuple must match. A caller-provided `producerDbRole`,
`producerWorkloadId`, authority generation or digest is rejected.

Trust levels are separate:

| Level | What it proves | What it does not prove |
|---|---|---|
| DB constraint | relational consistency and append-only rows | OS/Provider honesty |
| Provider API response | response bytes received by Broker | object physical truth |
| Exact-version readback | Provider returned matching bytes/metadata | independent identity of all future reads |
| Snapshot copy | retained investigation artifact | deletion did not occur elsewhere |
| Authority Session | DB-approved caller/epochs | process has stopped or handles closed |

A compromised Broker can forge any fact it is authorized to submit. It cannot
make that fact sufficient for final acceptance without exact Readback and the
Finalizer's independent checks. If the trust chain itself is unknown, all
publication, cleanup and release remain fail-closed. No client or Worker can
use a database constraint to bypass this boundary.

## 13. R6 P2/P3 and Cross-design Resolution

| Finding | D6 disposition | Evidence |
|---|---|---|
| `WP2AR6-P2-01` global nonce scope | `RESOLVED BY DESIGN` | scoped nonce key in §10.2; 256-bit nonce requirement |
| `WP2AR6-P2-02` active pointer triggers | `RESOLVED BY DESIGN` | §5 and §10.4; deferred membership/state triggers |
| `WP2AR6-P2-03` incident event FKs | `RESOLVED BY DESIGN` | §10.5; append-only event sequence and exact parent FKs |
| `WP2AR6-P2-04` migration target sealing | `RESOLVED BY DESIGN` | §13.1; all target fields all-or-none CHECK and deferred FKs |
| `WP2AR6-P2-05` capability child atomicity | `RESOLVED BY DESIGN` | §10.6 and §11; deferred child-set and one active lease |
| `WP2AR6-P3-01` action evidence naming | `RESOLVED BY DESIGN` | `StorageUploadActionEvidence.uploadActionId` is canonical; session is snapshot |
| `WP2AR6-P3-02` non-object effect NULL matrix | `RESOLVED BY DESIGN` | §10.1 effect-kind matrix |

### 13.1 Migration target sealing

`StorageMigrationRecord` has these target fields:

```text
targetAllocationId
targetObjectVersionId
targetRepresentationAttemptId
bindingId
importOperationId
checkpoint
checkpointAt
```

The target and checkpoint columns obey the all-or-none rule:

```text
CHECK (
  num_nonnulls(
    targetAllocationId,
    targetObjectVersionId,
    targetRepresentationAttemptId,
    bindingId,
    importOperationId,
    checkpoint,
    checkpointAt
  ) IN (0,7)
)
```

Exact FKs:

```text
(targetObjectVersionId,targetAllocationId)
  -> StorageObjectVersion(id,allocationId)
(bindingId,targetObjectVersionId)
  -> StorageObjectBinding(id,objectVersionId)
(targetRepresentationAttemptId)
  -> StorageRepresentationAttempt(id)
(importOperationId)
  -> StorageObjectOperation(id)
```

Parent anchors are `ObjectVersion(id,allocationId)`,
`ObjectBinding(id,objectVersionId)`, `RepresentationAttempt(id)` and
`ObjectOperation(id)`. `StorageMigrationSourceSlot(currentRecordId)` is UNIQUE,
and `StorageMigrationRecord.sourceSlotId` is UNIQUE. A source-slot claimant can
create one current record; a different record cannot become current.

The promotion transaction locks source slot, target allocation/version,
binding, target attempt and FileVersion in the global lock order. It fills all
seven fields and changes the record state in one deferred transaction. A
partial fill fails with `23514/D6_MIGRATION_TARGET_PARTIAL`; retrying the same
idempotency key returns the completed record. No synthetic Attempt,
Operation or version is created for unmappable history.

Cross-design checks:

1. EffectOwner cannot be bypassed by a Reconcile action; only Primary actions
   own effects.
2. Action Ledger and Provider Effect have one operation/key tuple; a reconcile
   action can only reference the same Effect.
3. Representation Slot pointers are nullable, single-column identity FKs plus
   deferred same-slot/backend triggers; active uniqueness is enforced by slot
   and attempt generation.
4. DispatchPermit snapshots both quarantine epoch and routing/trust/revocation
   epochs; the consume CAS rechecks all current values.
5. InvestigationSnapshot belongs to one destructive target and one exact source
   object; cleanup cannot use a snapshot from another target.
6. Typed Evidence common fields and subtype fields are checked by a deferred
   projection trigger; no nullable composite FK can silently skip.
7. FileVersion points to exact origin attempt/backend and, for provider
   versions, the exact Provider token/generation recorded in ObjectVersion.
8. Capability Manifest operation children and lease children are validated
   as one deferred child set.
9. Migration target fields all-or-none; source slot uniqueness prevents two
   historical records being promoted as the same origin.
10. Lock order is sealed and sorted; dynamic key addition, stale owner updates,
    and reverse acquisition fail closed.

## 14. Historical Finding Trace and Remaining Boundaries

### 14.1 D3 -> D4 -> D5 -> D6

| Source | Historical result | D6 treatment |
|---|---|---|
| D3 / R3 | malformed or ambiguous authority/effect relationships; exact-version and snapshot gaps | replaced by exact owner relation, explicit effect tuple, exact snapshot and target FKs |
| D4 / R4 | global nonce, active pointer, incident events, migration target, capability child-set gaps | superseded by scoped nonce, nullable pointer + trigger, event sequence, all-or-none target, deferred child-set |
| D5 / R5 | 6 P1 and 3 partially resolved P2 | all 6 P1 addressed by D6 and P2/P3 trace in §13; no D5 claim is accepted merely because it was marked resolved |
| R6 | 6 P1, 5 P2, 2 P3; isolated validation not admitted | D6 is a design-only response; it does not retroactively change R6 to PASS |

The six R6 P1 mapping is normative:

```text
WP2AR6-P1-01 -> §6 + Appendix A
WP2AR6-P1-02 -> §4, §8.1, §9
WP2AR6-P1-03 -> §5, §8.2
WP2AR6-P1-04 -> §7, §10.4—§11.7
WP2AR6-P1-05 -> §9, §9.16
WP2AR6-P1-06 -> §15—§18
```

### 14.2 Preserved independent states

```text
R5 57 Open Decisions:                         OPEN
BV7:                                          FAIL
BV8:                                          NOT INDEPENDENTLY APPROVED
Historical governance R8:                     BLOCKED
P2-05 business policy:                        OPEN
Old upload chain / P1-3 integration:          NOT IMPLEMENTED
Provider account/region/credentials/IAM:      NOT VERIFIED
Trust root / capability manifests:             NOT VERIFIED
Historical object inventory:                   NOT VERIFIED
Windows/OS authority implementation:           NOT IMPLEMENTED
PostgreSQL DDL/trigger behavior:               NOT VERIFIED
```

These are not cleared by D6. D6 also does not authorize R7, isolated
validation, migration, source implementation or production enablement.

## 15. Deterministic Fixture Contract

### 15.1 Literal names and values

The following row encodings are part of the test specification. A tuple names
every state-bearing field relevant to the table; all omitted nullable fields
are SQL NULL and all omitted defaults are the declared defaults. Every test
below supplies literal IDs, not generated identifiers.

```text
T0 = 2026-11-25T00:00:00.000000Z
T1 = 2026-11-25T00:00:10.000000Z
T2 = 2026-11-25T00:02:00.000000Z
T3 = 2026-11-25T00:05:00.000000Z
SIZE = 1048576
PART_SIZE = 524288
HASH-A = 32 bytes 0xaa
HASH-B = 32 bytes 0xbb
HASH-WRONG = 32 bytes 0xcc
OWNER-W1 = F55521549216C191A1F90D6B512514E6C5BE7F80869C499E39512987C559CFE9
OWNER-W2 = A4430A53333FAA92C4357F676BA2BCD87F1753F738AC29909A8A67BA535FC223
OWNER-W3 = 028D909D7F6B9109170FE7688A57ED96AE845E2BD8C44F5F3F56CD255B0AFD1C
```

Tuple notation:

```text
CLAIM(id,operationId,sessionId,generation,state,ownerDigest,leaseAt)
SESSION(id,workloadId,dbRole,purpose,operationId,state,expiresAt)
OP(id,lifecycleId,key,type,state,activeClaimId,generation,leaseAt)
EFFECT(id,kind,operationId,allocationId,scope,endpoint,key,
       sourceClaimId,sourceGeneration,nonce,requestState,effectState,
       objectVersionId,providerRequestId,terminalAt)
OWNER(effectId,ownerKind,uploadActionId,publisherAttemptId,cleanupAttemptId)
ACTION(id,sessionId,operationId,effectId,relation,ownerActionId,state,
       nonce,requestDigest,providerUploadId)
ASLOT(sessionId,activeActionId,slotEpoch)
PERMIT(id,effectId,attemptId,state,quarantineEpoch,trustEpoch,
       revocationEpoch,expiresAt,targetId,snapshotId)
ATTEMPT(id,slotId,operationId,generation,backend,state,key,size,hash,
        quarantineEpoch,dispatchBlocked)
SLOT(id,fileVersionId,role,backend,activeAttemptId)
BINDING(id,operationId,allocationId,scope,endpoint,key,versionId,
        claimId,generation,state)
VERSION(id,allocationId,scope,key,token,generation,size,hash,sourceOperation)
TARGET(id,operationId,attemptId,kind,scope,key,versionId,token,generation,
       localLifecycleId)
SNAPSHOT(id,targetId,operationId,sourceAttemptId,sourceScope,sourceKey,
         sourceVersionId,sourceToken,snapshotScope,snapshotKey,
         snapshotVersionId,snapshotToken,size,hash,evidenceId,state)
INCIDENT(id,state,sequenceNo,attemptId,epoch,createdAt)
EVENT(id,incidentId,sequenceNo,fromState,toState,evidenceId,actor,at)
EVIDENCE(id,type,operationId,objectVersionId,producer,nonce,state)
FV(id,fileId,versionNumber,uploadIntentId,uploadAttemptId,
   creationOperationId,key,size,hash,state)
```

The test harness must use a 32-byte canonical `requestDigest`; the literal
digests below are the uppercase hex values from Appendix A or a test-only
SHA-256 of the specified action bytes. No database is contacted in D6.

### 15.2 Common actors and sessions

```text
DB1 = Broker connection, DB role elevator_broker
DB2 = second Broker connection, same role, distinct session
DB3 = read-only verifier connection, DB role elevator_verifier
DB4 = Finalizer connection, DB role elevator_finalizer
BAR = pg_sync barrier; no lock is released before both sides arrive
PROV = deterministic Provider double; records call count and exact version
```

Every test starts with no pre-existing rows for its own prefix except rows
listed in its initial snapshot. Cleanup after a test is only rollback of its
transaction or destruction of the isolated database clone; no production
table, Storage object or queue is touched.

Universal assertion semantics remove unspecified behavior:

```text
every named INSERT/UPDATE/CAS has expected rowcount=1
unless the same step explicitly prints 0 or an SQLSTATE/application error
every enumerated test row is the complete final row state for that table
all omitted subclass columns are NULL/default exactly as declared
no row with the test prefix may exist unless enumerated
a successful COMMIT has no SQLSTATE
Provider calls and object versions are exactly those in the closure register
an Evidence ID listed by a test has one base row and exactly one subtype row
an “empty” Evidence set means zero rows, not a NULL row
```

These rules apply to all 16 race, 24 fixed-vector and 12 cross-protocol tests.

## 16. Sixteen Deterministic Race Specifications

### `d6-x-01` Concurrent claim

Initial rows:

```text
SESSION(d6-x-01-s1,elevator_broker,elevator_broker,AUTHORITY,d6-x-01-op,ACTIVE,T3)
SESSION(d6-x-01-s2,elevator_broker,elevator_broker,AUTHORITY,d6-x-01-op,ACTIVE,T3)
OP(d6-x-01-op,d6-x-01-lc,staging/d6-x-01,FINALIZE,
   PREPARED,NULL,6,T3)
```

Steps:

```text
DB1 BEGIN; SELECT op FOR UPDATE
BAR-01; DB2 BEGIN; SELECT op FOR UPDATE (waits)
DB1 INSERT CLAIM(d6-x-01-c7,d6-x-01-op,d6-x-01-s1,7,ACTIVE,OWNER-W1,T3)
DB1 UPDATE OP activeClaimId=c7,generation=7; rowcount 1
DB1 COMMIT
DB2 UPDATE OP WHERE generation=6; rowcount 0
DB2 ROLLBACK
```

Expected final rows:

```text
CLAIM(d6-x-01-c7,d6-x-01-op,d6-x-01-s1,7,ACTIVE,OWNER-W1,T3)
OP(d6-x-01-op,d6-x-01-lc,staging/d6-x-01,FINALIZE,PREPARED,
   d6-x-01-c7,7,T3)
no CLAIM d6-x-01-c8
no EFFECT/PERMIT/Provider call
```

Error: DB2 `23514/D6_CLAIM_CONFLICT`. Negative query:
`count(*) FROM Claim WHERE operationId='d6-x-01-op' AND state='ACTIVE'` = 1.

### `d6-x-02` Old upload after supersession

Initial rows:

```text
CLAIM(d6-x-02-c7,d6-x-02-op,d6-x-02-s1,7,SUPERSEDED,OWNER-W1,T0)
EFFECT(d6-x-02-e7,UPLOAD_COMPLETE,d6-x-02-op,d6-x-02-a1,
       d6-x-02-scope,d6-x-02-endpoint,staging/d6-x-02,
       d6-x-02-c7,7,d6-x-02-n7,DISPATCHED,IN_FLIGHT,NULL,NULL,NULL)
OWNER(d6-x-02-e7,UPLOAD_ACTION,d6-x-02-act7,NULL,NULL)
ACTION(d6-x-02-act7,d6-x-02-us,d6-x-02-op,d6-x-02-e7,PRIMARY,
       d6-x-02-act7,DISPATCHED,d6-x-02-n7,
       A8A648F0A86CB72523DD0E541E39A1EA7D2F6FAC40B2C712FEF092D1C647EE13,
       d6-x-02-upload)
SLOT(d6-x-02-slot,d6-x-02-fv,ORIGIN,OBJECT_STORE,NULL)
```

Steps:

```text
DB2 claim c8 generation 8; rowcount 1
DB2 creates ACTION d6-x-02-act8 with nonce d6-x-02-n8; rowcount 1
PROV old request returns VERSION d6-x-02-v7/HASH-A; call count 1
DB1 writes Outcome for e7 under old claim; UPDATE effect rowcount 0
DB2 writes Outcome/Readback for e8; rowcount 1
```

Final:

```text
e7 = LATE_EFFECT_UNCLAIMED, no FileVersion from e7
e8 = CONTENT_VERIFIED, objectVersionId d6-x-02-v8
one FileVersion d6-x-02-fv from current binding only
```

Negative: no v7 binding, no second FileVersion, no active pointer to act7;
Provider call count exactly 2 (old and new requests), never 3.

### `d6-x-03` New generation before old completion

Initial:

```text
OP(d6-x-03-op,d6-x-03-lc,staging/d6-x-03,FINALIZE,EXECUTING,NULL,6,T3)
ATTEMPT(d6-x-03-a1,d6-x-03-slot,d6-x-03-op,1,OBJECT_STORE,CANDIDATE,
        staging/d6-x-03,SIZE,HASH-A,0,false)
```

Steps:

```text
DB2 claim/construct d6-x-03-a2 generation 2 and new key d6-x-03-key2
PROV old request returns d6-x-03-v1/HASH-A
PROV new request returns d6-x-03-v2/HASH-B
DB1 old binding UPDATE rowcount 0 / 23514
DB2 current binding UPDATE rowcount 1
```

Final: a1 `FAILED_RETAINED`, a2 `ACTIVE`, v1 retained, v2 active, exactly one
FileVersion. Provider calls exactly 2; no latest-key substitution and no delete
of v1.

### `d6-x-04` Provider response loss with exact recovery

Initial:

```text
EFFECT(d6-x-04-e1,CANONICAL_PUBLISH,d6-x-04-op,d6-x-04-a1,
       d6-x-04-scope,d6-x-04-ept,d6-x-04-key,d6-x-04-c1,1,
       d6-x-04-n1,DISPATCHED,IN_FLIGHT,NULL,NULL,NULL)
PERMIT(d6-x-04-p1,d6-x-04-e1,d6-x-04-attempt1,CONSUMED,0,2,1,T2,NULL,NULL)
```

Steps:

```text
PROV executes once, socket is dropped before DB observation; call count 1
DB1 creates Provider Operation Evidence with responseState UNKNOWN
DB2 claims same operation generation 2
DB3 exact-version list/read observes d6-x-04-v1, SIZE, HASH-A
DB4 Finalizer inserts Outcome/Readback and CAS binding CANDIDATE->ACCEPTED
```

Final: e1 `CONTENT_VERIFIED`; binding `ACCEPTED`; one FileVersion
`d6-x-04-fv1`; Provider object v1 retained; no duplicate Effect/action.
Negative: no v2, no second publish call; stale e1 update rowcount 0.

### `d6-x-05` Complete success and DB response loss

Initial:

```text
ACTION(d6-x-05-act1,d6-x-05-us,d6-x-05-op,d6-x-05-e1,PRIMARY,
       d6-x-05-act1,DISPATCHED,d6-x-05-n1,
       BCE3A15E149B344AA312800E3702D7857F931479688991D770C3AAF49DDB99D3,
       d6-x-05-upload)
EFFECT(d6-x-05-e1,UPLOAD_COMPLETE,d6-x-05-op,d6-x-05-a1,
       d6-x-05-scope,d6-x-05-ept,staging/d6-x-05,d6-x-05-c1,1,
       d6-x-05-n1,RESPONSE_UNKNOWN,IN_FLIGHT,NULL,NULL,NULL)
```

Steps:

```text
PROV Complete once -> exact version d6-x-05-v1/HASH-A; call count 1
FAIL-05 after Provider response, before DB COMMIT
DB2 re-reads action by nonce/digest; no new action row
DB2 inserts Outcome/Readback for e1; rowcount 1
DB2 CAS action RESPONSE_UNKNOWN->SUCCEEDED; rowcount 1
```

Final: one action, one effect, one v1, one FileVersion, one Outcome/Readback.
Negative: second insert of action returns duplicate `23505`; Provider call
count remains 1; no synthetic publish Evidence.

### `d6-x-06` Complete versus Abort

Initial:

```text
ASLOT(d6-x-06-us,NULL,0)
```

Steps:

```text
DB1 inserts action d6-x-06-complete PREPARED; activeActionId=complete; rowcount 1
BAR-06
DB2 inserts action d6-x-06-abort PREPARED; activeActionId=abort; rowcount 0
DB1 consumes d6-x-06-pc; PROV Complete call count 1
DB1 writes success result rowcount 1
```

Final: complete `SUCCEEDED`, abort absent, session `COMPLETED`, no second
Provider terminal call. Error: `23505` or `409/D6_UPLOAD_ACTION_IN_PROGRESS`.
Negative: no abort permit/effect; no dual terminal state.

### `d6-x-07` Readback then later Provider version

Initial:

```text
VERSION(d6-x-07-v1,d6-x-07-a1,d6-x-07-scope,d6-x-07-key,
        v-d6-x-07-1,NULL,SIZE,HASH-A,d6-x-07-op)
EVIDENCE(d6-x-07-rb1,READBACK_VERIFIED,d6-x-07-op,d6-x-07-v1,
         elevator_verifier,d6-x-07-rbn1,VERIFIED)
BINDING(d6-x-07-b1,d6-x-07-op,d6-x-07-a1,d6-x-07-scope,
        d6-x-07-ept,d6-x-07-key,d6-x-07-v1,d6-x-07-c1,1,CANDIDATE)
```

Steps:

```text
Finalizer locks key; PROV creates a newer v2/HASH-B after readback; call count 0
Finalizer validates v1 token/hash; binds v1 only
Reader queries current binding; rowcount 1 for v1, 0 for v2
```

Final: v1 accepted, v2 `LATE_EFFECT_UNCLAIMED`/retained; no latest substitution.

### `d6-x-08` Allocation owner loss

Case A initial: allocation `d6-x-08-a1` state RESERVED, custody ACTIVE,
`providerMutationStartedAt=NULL`, generation 1.

Case B initial: same allocation but `providerMutationStartedAt=T0` and
Authority claim `d6-x-08-c1` expired.

Steps:

```text
A: DB2 CAS custody generation 2; rowcount 1; successor adopts key.
B: DB2 CAS custody generation 2; rowcount 0; old allocation RETIRED;
   create new operation d6-x-08-op2/key d6-x-08-key2.
```

Final A: one ACTIVE custody; same key retained. Final B: old key retained and
no second writer; new key is independent. Negative: no stale key adoption in
B, Provider mutation count 0 for case A, 1 for case B.

### `d6-x-09` Migration crash

Initial:

```text
MIGRATION(d6-x-09-m1,d6-x-09-op,SSTATE,d6-x-09-src,d6-x-09-srcAttempt,
          source, SIZE,HASH-A,target, d6-x-09-ept, d6-x-09-key,
          NULL,NULL,NULL,NULL,COPYING,d6-x-09-generation-1,
          OWNER-W1,T2,d6-x-09-idempotency)
```

Steps:

```text
W1 claims migration generation 1; copies target v1; FAIL-09 before checkpoint
W2 claims generation 2; exact v1 observation/readback; rowcount 1
W1 attempts checkpoint with generation 1; rowcount 0/23514
W2 writes all target fields together; rowcount 1
```

Final: one migration record, one generation-2 attempt, one target version,
source remains intact, partial target v1 retained. Negative: no second record,
no second representation, no W1 post-crash mutation.

### `d6-x-10` Rollback and quarantine at cutover

Initial:

```text
Routing epoch = 10
Representation attempt d6-x-10-a1 ACTIVE, v1/HASH-A
Incident d6-x-10-i1 absent
Destructive target d6-x-10-t1 absent
```

Steps:

```text
W1 acquires rollback key; route CAS 10->11 rowcount 1
W2 attempts new FileVersion under epoch 10 rowcount 0/23514
W3 commits Incident(d6-x-10-i1,ACTIVE,sequence 1,epoch 1)
W1 activation rechecks quarantine; rowcount 0/409; partial local v2 retained
```

Final: route 11, attempt a1 quarantineEpoch 1, target t1 absent, v2
`FAILED_RETAINED`; no post-freeze hidden FileVersion. Negative: no cleanup
delete of v1 or partial v2.

### `d6-x-11` Missing local fallback

Initial:

```text
VERSION(d6-x-11-v1,d6-x-11-a1,d6-x-11-scope,d6-x-11-key,
        v-d6-x-11-1,NULL,SIZE,HASH-A,d6-x-11-op)
FileVersion d6-x-11-fv has origin OBJECT_STORE; no local slot/attempt.
```

Steps:

```text
request ROLLBACK_LEGACY; gate reads FileVersion origin and local slot
rowcount SELECT local attempt = 0; UPDATE route rowcount 0
```

Final: rollback `FAILED_RETAINED`; v1 unchanged; no local-only route.
Negative: no deletion/creation of fallback; no Provider call.

### `d6-x-12` Capability revocation during lease

Initial:

```text
ATTEMPT(d6-x-12-a1,d6-x-12-slot,d6-x-12-op,1,OBJECT_STORE,CANDIDATE,
        d6-x-12-key,SIZE,HASH-A,0,false)
PERMIT(d6-x-12-p1,d6-x-12-e1,d6-x-12-a1,CONSUMED,0,1,1,T2,NULL,NULL)
```

Steps:

```text
Manifest revocation transaction commits epoch 2; CAS lease REVOKED rowcount 1
DB2 new permit issuance sees revocation epoch 2; rowcount 0
PROV old request returns v-old; old Effect becomes LATE_EFFECT_UNCLAIMED
```

Final: old effect retained, no FileVersion, new permit absent, Provider old
call count 1. Negative: no lease extension, no fresh claim after revocation.

### `d6-x-13` Trust root rotation

Initial:

```text
Trust roots R1 ACTIVE epoch 1, R2 CANDIDATE epoch 2
Old lease d6-x-13-l1 ACTIVE, rootVersionId R1
```

Steps:

```text
DB2 CAS trust epoch 1->2 rowcount 1; R2 ACTIVE; R1 DEPRECATED
DB1 claim with R1 rowcount 0
DB2 claim with R2 rowcount 1
```

Final: one R2 claim/lease; R1 history retained. Error:
`23514/D6_TRUST_EPOCH_STALE`. Negative: no fresh R1 lease, no Provider call.

### `d6-x-14` Cleanup, readback and quarantine

Initial:

```text
TARGET(d6-x-14-t1,d6-x-14-op,d6-x-14-a1,OBJECT_STORE,
       d6-x-14-scope,d6-x-14-key,d6-x-14-v1,v-d6-x-14-1,NULL,NULL)
SNAPSHOT(d6-x-14-s1,d6-x-14-t1,d6-x-14-op,d6-x-14-a1,
         d6-x-14-scope,d6-x-14-key,d6-x-14-v1,v-d6-x-14-1,
         d6-x-14-snapScope,d6-x-14-snapKey,d6-x-14-snapV,
         v-d6-x-14-snap,SIZE,HASH-A,d6-x-14-sev,VERIFIED)
EFFECT d6-x-14-e1 DELETE NOT_STARTED; no permit
```

Steps:

```text
DB1 locks delete key and inserts permit d6-x-14-p1; rowcount 1
DB2 commits incident d6-x-14-i1 and quarantine epoch 1; rowcount 1
DB1 consume permit CAS checks epoch 0 vs current 1; rowcount 0
DB3 verifies snapshot/readback; rowcount 1
```

Final: target present, snapshot VERIFIED/RETAINED, DELETE effect remains
`DISPATCH_ELIGIBLE`/`NOT_STARTED`, Provider delete count 0; no delete result
evidence. Negative: no attempt/object deletion; no permit CONSUMED.

### `d6-x-15` Evidence without Finalizer

Initial:

```text
EVIDENCE(d6-x-15-evd1,PROVIDER_OUTCOME,d6-x-15-op,d6-x-15-v1,
         elevator_broker,d6-x-15-n1,VERIFIED)
BINDING(d6-x-15-b1,d6-x-15-op,d6-x-15-a1,d6-x-15-scope,d6-x-15-ept,
        d6-x-15-key,d6-x-15-v1,d6-x-15-c1,1,CANDIDATE)
```

Steps:

```text
DB3 SELECT Evidence; no Finalizer call
DB2 attempts UPDATE FileVersion; rowcount 0
```

Final: Evidence and candidate binding retained, no FileVersion, no current
pointer. Negative: Evidence cannot authorize publication and cannot be deleted.

### `d6-x-16` Finalizer COMMIT response lost

Initial:

```text
BINDING(d6-x-16-b1,d6-x-16-op,d6-x-16-a1,d6-x-16-scope,d6-x-16-ept,
        d6-x-16-key,d6-x-16-v1,d6-x-16-c1,8,CANDIDATE)
CLAIM(d6-x-16-c1,d6-x-16-op,d6-x-16-s1,8,ACTIVE,OWNER-W1,T3)
```

Steps:

```text
DB4 transaction CAS binding ACCEPTED, attempt ACTIVE, insert FV d6-x-16-fv
FAIL-16 after COMMIT before response
DB2 retries with same finalizer idempotencyKey
SELECT existing acceptance/FileVersion rowcount 1; INSERT retry rowcount 0
```

Final: exactly one FV, one acceptance, one AuditLog; no second extraction.
Negative: no duplicate FV, no second finalizer commit, Provider count unchanged.

### 16.1 Race Evidence and Provider closure register

The following is the complete Evidence set for each race. `none` means the
test's final negative query is
`SELECT count(*) FROM Evidence WHERE operationId='<literal test op>' AND type IN (14 subtypes)` = 0.
Where a row is listed, it must include the nonce and digest asserted by its
subtype section.

| Test | Exact Provider calls | Exact Provider object versions | Exact Evidence IDs/types | Required absence |
|---|---:|---|---|---|
| `d6-x-01` | 0 | none | none | no Effect/Permit/Evidence |
| `d6-x-02` | 2 | `d6-x-02-v7`, `d6-x-02-v8` | `d6-x-02-po7` ProviderOperation; `d6-x-02-oo7` Outcome; `d6-x-02-rb8` Readback | no v7 binding; no v7 FV |
| `d6-x-03` | 2 | `d6-x-03-v1`, `d6-x-03-v2` | `d6-x-03-op1` ProviderOperation; `d6-x-03-rb1` Readback; `d6-x-03-rb2` Readback | no v1 binding/FV |
| `d6-x-04` | 1 | `d6-x-04-v1` | `d6-x-04-op` ProviderOperation; `d6-x-04-out` Outcome; `d6-x-04-rb` Readback; `d6-x-04-acc` BindingAcceptance | no v2; no second publish Effect |
| `d6-x-05` | 1 | `d6-x-05-v1` | `d6-x-05-ua` UploadAction; `d6-x-05-out` Outcome; `d6-x-05-rb` Readback | no duplicate action/FV |
| `d6-x-06` | 1 | `d6-x-06-v1` | `d6-x-06-ua` UploadAction; `d6-x-06-out` Outcome | no Abort action/effect |
| `d6-x-07` | 0 write; 2 exact reads | `d6-x-07-v1`, `d6-x-07-v2` | `d6-x-07-rb1` Readback; `d6-x-07-rb2` Readback | v2 not bound, v1 not substituted |
| `d6-x-08` | A 0; B 1 | B `d6-x-08-v2` | `d6-x-08-auth` Authorization; `d6-x-08-out2` Outcome | no A stale adoption; no B stale key mutation |
| `d6-x-09` | 1 copy; 1 read | `d6-x-09-v1` | `d6-x-09-copy` MigrationCopy; `d6-x-09-rb` MigrationReadback | no second record/target attempt |
| `d6-x-10` | 1 read | `d6-x-10-v1` | `d6-x-10-inc` IntegrityIncident; `d6-x-10-rb` Readback | no target, no post-freeze FV |
| `d6-x-11` | 0 | `d6-x-11-v1` retained | `d6-x-11-fail` Representation failure Evidence | no local fallback/route |
| `d6-x-12` | 1 old request | `d6-x-12-v-old` retained | `d6-x-12-rev` ManifestRevocation; `d6-x-12-late` Outcome | no new permit/FV |
| `d6-x-13` | 0 | none | `d6-x-13-root` ManifestRevocation/root Evidence | no fresh R1 lease |
| `d6-x-14` | 0 delete | `d6-x-14-v1` retained; `d6-x-14-snapV` retained | `d6-x-14-snapEvd` Outcome; `d6-x-14-inc` IntegrityIncident | no DELETE result; no deleted source |
| `d6-x-15` | 0 | `d6-x-15-v1` retained | `d6-x-15-evd1` Outcome | no FV; no acceptance |
| `d6-x-16` | 0 | `d6-x-16-v1` retained | `d6-x-16-acc` BindingAcceptance; `d6-x-16-rb` Readback | no duplicate FV/acceptance |

## 17. Twenty-Four Fixed Vectors

Each row is a separate isolated-clone test. `0 calls` means the Provider double
is not reachable on that branch. `Readback` always records exact token,
generation (or explicit token-only capability), size and SHA-256. Evidence IDs
are literal; no Evidence is accepted from an unlisted producer.

| ID | Exact initial/inset fixture | Operations and rowcounts | Final DB state | Provider effect count/version | Evidence snapshot | Negative assertions |
|---|---|---|---|---|---|---|
| `d6-fv-01` | scope `d6-fv-01-scope`, endpoint `d6-fv-01-ept`, key `d6-fv-01-key`; no allocation | provision endpoint 1; insert scope 1; select exact tuple 1 | one ACTIVE endpoint/scope and one RESERVED allocation | 0 calls | `d6-fv-01-evd` control observation, producer CAPABILITY_GATE | no alias key, no second endpoint, no Provider request |
| `d6-fv-02` | operation `d6-fv-02-op`, lifecycle `d6-fv-02-lc`, key `staging/d6-fv-02`; STAGING_RESERVED | insert allocation STAGE_WRITE 1 | allocation RESERVED, lifecycle STAGING_RESERVED | 0 calls; no object | `d6-fv-02-evd` allocation Evidence | no `objects/%` lifecycle |
| `d6-fv-03` | operation `d6-fv-03-op`, STAGING lifecycle, requested key `objects/d6-fv-03` | allocation insert 0, CHECK `23514` | no allocation/lifecycle for invalid key | 0 calls | none accepted | no `objects/d6-fv-03` row/object |
| `d6-fv-04` | operation `d6-fv-04-op`, canonical lifecycle `objects/d6-fv-04`, FINALIZE | insert allocation 1; set source/target paths 1 | one canonical FINALIZE operation | 0 calls | `d6-fv-04-evd` representation authorization | no staging key alias |
| `d6-fv-05` | session `d6-fv-05-us`, effect `d6-fv-05-e1`, action `d6-fv-05-act`, key `staging/d6-fv-05-k` | CREATE permit ISSUED 1; CONSUMED 1; Provider call 1; response UNKNOWN 1; reconcile Outcome 1 | action RESPONSE_UNKNOWN; effect IN_FLIGHT/UNKNOWN; no FV | 1 call, upload ID `d6-fv-05-upload` | `d6-fv-05-evd` `UPLOAD_ACTION`, nonce `d6-fv-05-n` | no second upload/action/effect |
| `d6-fv-06` | upload session `d6-fv-06-us`, COMPLETE effect `d6-fv-06-e1` | consume 1; Provider Complete 1; DB response lost; retry read 1/insert 0 | one action SUCCEEDED, one effect CONTENT_VERIFIED | 1 call, v `d6-fv-06-v1` | `d6-fv-06-evd` Outcome+Readback | no duplicate effect/version/FV |
| `d6-fv-07` | ASLOT `d6-fv-07-us` empty; Complete `d6-fv-07-c`, Abort `d6-fv-07-a` | Complete slot CAS 1; Abort slot CAS 0/`23505`; Complete call 1 | Complete terminal, Abort absent | 1 call terminal, no Abort call | `d6-fv-07-evd` one Upload Action | no dual terminal, no second Provider terminal |
| `d6-fv-08` | operation `d6-fv-08-op` generation 7 no active claim; sessions `d6-fv-08-s1/s2` | two claim CAS: one 1, other 0/`23514` | one C8 ACTIVE, one C8 absent | 0 calls | `d6-fv-08-evd` Authorization for winner only | no second active claim |
| `d6-fv-09` | allocation `d6-fv-09-a1`; case A mutationStarted NULL; case B mutationStarted T0 | A adopt CAS 1; B adopt CAS 0/`23514`; B new operation 1 | A same key; B old key retained + new op/key | A 0, B 1 mutation | `d6-fv-09-evd` custody evidence | no stale custody mutation/adoption |
| `d6-fv-10` | operation `d6-fv-10-op1` has close Evidence `d6-fv-10-evd`; operation `d6-fv-10-op2` requests it | attach cross-operation evidence 0/`23503` | op2 remains not READY | 0 calls | original evidence unchanged | no close/READY/FV on op2 |
| `d6-fv-11` | response-loss effect `d6-fv-11-e1`, exact object `d6-fv-11-v1/HASH-A` | observe 1; readback 1; finalizer accept 1 | one binding and one FV | 0 new calls; v1 | `d6-fv-11-evd` Readback + Finalizer | no PUBLISH_RESULT or second effect |
| `d6-fv-12` | migration `d6-fv-12-m1`, source `d6-fv-12-src`, target key `d6-fv-12-key` | copy 1; readback 1; all target fields fill 1 | target representation ACTIVE; source unchanged | 1 copy; v `d6-fv-12-v1` | Copy+Readback Evidence IDs `d6-fv-12-copy`, `d6-fv-12-rb` | no new FileVersion, no synthetic IDs |
| `d6-fv-13` | object `d6-fv-13-v1` content HASH-WRONG, binding expects HASH-A | finalizer CAS 0/`409`; quarantine event 1 | effect WRONG_CONTENT, binding REJECTED, no FV | 1 readback; v1 retained | `d6-fv-13-evd` Outcome and incident Evidence | no accepted binding or deletion |
| `d6-fv-14` | legacy FileVersion `d6-fv-14-fv` key `objects/d6-fv-14`; lifecycle key `objects/d6-fv-14-other` | classify/insert 0/`23514` | no current pointer or invented origin | 0 calls | rejection only, not typed Evidence | no fallback or synthetic attempt |
| `d6-fv-15` | FileVersion `d6-fv-15-fv` origin OBJECT_STORE; local fallback candidate `d6-fv-15-local` | activate object 1; activate local 1; current pointer projection 1 | two attempts retained, exactly one ACTIVE per slot | 0 calls | Representation Evidence `d6-fv-15-rep` | no second FV |
| `d6-fv-16` | fallback attempt `d6-fv-16-a1` FAILED_RETAINED; slot active NULL | create generation 2 `d6-fv-16-a2` 1; activate 1 | a1 retained, a2 ACTIVE | 0 calls | `d6-fv-16-evd` generation-2 Representation | no overwrite/history deletion |
| `d6-fv-17` | provider v `d6-fv-17-vp/HASH-A`, local v `d6-fv-17-vl/HASH-WRONG` | dual read 2; compare 1 mismatch; incident 1; quarantine 1 | provider representation quarantined; local READ-blocked | 2 reads; both versions retained | incident Evidence `d6-fv-17-inc` | no automatic fallback or cleanup |
| `d6-fv-18` | manifest `d6-fv-18-m` revoked epoch 2; lease `d6-fv-18-l` epoch 1 | lease CAS REVOKED 1; new claim 0/`23514` | no ACTIVE lease after epoch 2 | 0 calls | revocation Evidence `d6-fv-18-evd` | no new lease/extension for revoked manifest |
| `d6-fv-19` | roots `d6-fv-19-r1` epoch 1 ACTIVE, `d6-fv-19-r2` epoch 2 candidate | epoch CAS 1; activate R2 1; old claim 0 | R2 ACTIVE, R1 historical | 0 calls | root Evidence `d6-fv-19-evd` | no fresh R1 lease |
| `d6-fv-20` | target `d6-fv-20-t1`, snapshot `d6-fv-20-s1`; finalizer binding `d6-fv-20-b1` initially CANDIDATE | cleanup permit ISSUED 1; BAR; finalizer locks key and accepts binding 1; cleanup consume 0/`409` | no referenced version deletion; snapshot retained; one accepted binding | delete 0 | cleanup rejection + acceptance Evidence exact | no key-only delete; no cleanup of bound version |
| `d6-fv-21` | Finalizer `d6-fv-21-fz`, binding `d6-fv-21-b1`, no FV | commit acceptance 1; response lost; retry insert 0 | one FV `d6-fv-21-fv`, one acceptance/audit | 0 new calls | `d6-fv-21-evd` acceptance snapshot | no duplicate FV/audit |
| `d6-fv-22` | reader lease `d6-fv-22-l` route epoch 10; routing now 11 | read authorization 0/`409` | reader revoked, no file bytes | 0 calls | route Evidence `d6-fv-22-evd` | no stale cache acceptance |
| `d6-fv-23` | endpoint `d6-fv-23-ept` reports token absent/invalid capability | attempt insert 0/`23502` or `23514` | no binding/version | 0 calls | capability failure Evidence `d6-fv-23-evd` | no FileVersion |
| `d6-fv-24` | exact v `d6-fv-24-v1`; audit profile strict; no Audit row `d6-fv-24-audit` | finalizer 0/`409`; read 0/`409`; cleanup 0/`23514` | v1 retained, no publication/cleanup | 0 mutation; 1 readback retained | no acceptance/cleanup Evidence | no delete or FV |

## 18. Twelve Cross-Protocol Tests

### `d6-xt-01` Stale claim plus response loss

Initial rows are `CLAIM(d6-xt-01-c7,d6-xt-01-op,d6-xt-01-s1,7,SUPERSEDED,
OWNER-W1,T0)`, `EFFECT(d6-xt-01-e7,CANONICAL_PUBLISH,d6-xt-01-op,
d6-xt-01-a1,d6-xt-01-scope,d6-xt-01-ept,d6-xt-01-key,d6-xt-01-c7,7,
d6-xt-01-n7,DISPATCHED,IN_FLIGHT,NULL,NULL,NULL)`, and no binding.

Steps: DB1 exact readback v1; DB2 claims generation 8 rowcount 1; DB1 writes
Outcome under old claim rowcount 0; DB2 Finalizer binds v1 rowcount 1. Final:
one FV, one binding, effect source provenance c7 retained. Negative: no C7
reactivation, no second FV/effect; Provider calls 0 during recovery.

### `d6-xt-02` Complete and Abort with same session

Initial: `ASLOT(d6-xt-02-us,NULL,0)`, no actions/effects. DB1 inserts COMPLETE
action and slot CAS 1; barrier; DB2 inserts ABORT action slot CAS 0; Provider
Complete once. Final: Complete SUCCEEDED, Abort absent. Error
`23505/D6_UPLOAD_ACTION_IN_PROGRESS`; no Abort permit/effect.

### `d6-xt-03` Failed fallback retry

Initial: `d6-xt-03-fv` has object origin and no local fallback. Generation 1
candidate `d6-xt-03-l1` fails (`FAILED_RETAINED`, slot active NULL); generation
2 `d6-xt-03-l2` inserts and activates rowcount 1. Final: old failed object
retained, new fallback active, one current slot. Negative: no overwrite/delete
or extra FV; Provider call count 0.

### `d6-xt-04` Provider audit contradiction

Initial: FileVersion `d6-xt-04-fv` bound to v1/HASH-A. Provider audit event
`d6-xt-04-aud` reports v2/HASH-B. Steps: ingest audit Evidence rowcount 1;
incident rowcount 1; quarantine epoch 0->1 rowcount 1; read lease revoke 1;
cleanup target insert 0/`409`. Final: v1 remains but reads blocked; cleanup
blocked; no automatic fallback. Negative: no delete/delete permit.

### `d6-xt-05` Evidence cross-reference

Initial: op1/v1 Evidence `d6-xt-05-evd1`; op2/v2 binding
`d6-xt-05-b2`. Attempt attach e1 to b2 rowcount 0/`23503`; direct update of
Evidence rowcount 0/`42501`. Final: both original rows unchanged, op2 candidate
not accepted. Negative: no cross-object FK insertion or accepted FV.

### `d6-xt-06` Evidence digest tamper

Initial: subtype row `d6-xt-06-auth` and base evidence `d6-xt-06-e1`, digest
computed by ingestion function. Alter `authorityGeneration` in a clone row;
recompute check returns `D6_EVIDENCE_DIGEST_MISMATCH`/`23514`; insertion/update
rowcount 0. Final: original Evidence remains immutable; no acceptance. Negative:
no caller-supplied replacement digest.

### `d6-xt-07` Revocation lag with late Provider result

Initial: effect `d6-xt-07-e7` IN_FLIGHT under lease `d6-xt-07-l1`, revocation
epoch 1. Commit revocation epoch 2; lease CAS REVOKED 1; new claim 0/`23514`;
late v7 record rowcount 1 but state LATE_EFFECT_UNCLAIMED. Final: v7 retained,
no FV; Provider old call count 1; no new call.

### `d6-xt-08` Cleanup versus quarantine

Initial: `TARGET(d6-xt-08-t1,d6-xt-08-op,d6-xt-08-a1,OBJECT_STORE,
d6-xt-08-scope,d6-xt-08-key,d6-xt-08-v1,v-d6-xt-08-1,NULL,NULL)`;
Snapshot `d6-xt-08-s1` VERIFIED. Steps: DB1 DELETE permit ISSUED 1; DB2
incident/quarantine commit 1; DB1 permit consume 0/`409`; provider delete call
0; snapshot remains VERIFIED. Negative: no delete result, no object/version
deletion, no re-use of snapshot by another target.

### `d6-xt-09` Rollback and quarantine during copy

Initial: source `d6-xt-09-src`, partial local `d6-xt-09-local` CANDIDATE.
W1 copy call 1; W2 quarantine epoch increment 1; W1 activation CAS 0/`409`;
local remains FAILED_RETAINED. Final: source v1 retained, no route switch,
snapshot/incident retained. Negative: no local activation or deletion.

### `d6-xt-10` Migration source contention

Initial: source slot `d6-xt-10-slot` OPEN. W1 inserts record `d6-xt-10-m1`
rowcount 1; W2 inserts `d6-xt-10-m2` rowcount 0/`23505`. Final: one current
record, one source slot; W2 cannot write target/attempt. Negative: no second
representation or synthetic source.

### `d6-xt-11` Endpoint/capability child-set

Initial: endpoint `d6-xt-11-e1` ACTIVE, rotation slot candidate NULL. W1 inserts
manifest/operation children/observation/lease in one transaction rowcount 1;
W2 attempts a second candidate rowcount 0/`23505`. Final: one candidate/lease,
all children exact; E1 remains active until CAS. Negative: no orphan manifest
child set or lease operation from an unverified manifest.

### `d6-xt-12` Multi-key lock inversion

Initial: plans `d6-xt-12-p1` keys K1,K3 and `d6-xt-12-p2` keys K2,K1; both
sealed. W1 sorts K1,K3; W2 sorts K1,K2; no reverse lock. Inject K4 insertion
after seal for W1 -> `55000/D6_LOCK_PLAN_MUTATED`; no permit, no Provider call.
Final rowcounts: W1 and W2 each acquire in sorted order; dynamic branch 0;
Provider side effects 0. Negative: no lock-key set mutation or unsorted lock.

### 18.1 Cross-test closure register

| Test | Provider calls/object versions | Evidence rows | Final absent rows |
|---|---|---|---|
| `d6-xt-01` | 0 recovery calls; `d6-xt-01-v1` | `d6-xt-01-rb`, `d6-xt-01-out`, `d6-xt-01-acc` | no second Effect/FV |
| `d6-xt-02` | 1 Complete; `d6-xt-02-v1` | `d6-xt-02-ua`, `d6-xt-02-out` | no Abort action/permit/effect |
| `d6-xt-03` | 0 | `d6-xt-03-r1`, `d6-xt-03-r2` Representation | no overwritten generation |
| `d6-xt-04` | 1 audit delivery | `d6-xt-04-aud`, `d6-xt-04-inc` | no new lease/cleanup permit |
| `d6-xt-05` | 0 | original `d6-xt-05-evd1` only | no cross-linked Evidence/acceptance |
| `d6-xt-06` | 0 | original `d6-xt-06-e1` only | no tampered row/accepted FV |
| `d6-xt-07` | 1 late old call; `d6-xt-07-v7` | `d6-xt-07-rev`, `d6-xt-07-late` | no new permit/FV |
| `d6-xt-08` | 0 delete | `d6-xt-08-snapEvd`, `d6-xt-08-inc` | no DELETE result/target deletion |
| `d6-xt-09` | 1 copy; `d6-xt-09-vpart` retained | `d6-xt-09-copy`, `d6-xt-09-inc` | no active local representation/route |
| `d6-xt-10` | 0 | `d6-xt-10-m1` record only | no m2/source alias |
| `d6-xt-11` | 0 Provider data call | `d6-xt-11-cap` capability Evidence | no orphan manifest operation/lease |
| `d6-xt-12` | 0 | none | no permit/effect/Evidence mutation |

## Appendix A — Complete requestDigest Byte Vectors

### A.1 Literal inputs

```text
domainAction  = UTF-8("aic-elevator/storage-upload-action/v1") + 0x00
domainPayload = UTF-8("aic-elevator/storage-upload-payload/v1") + 0x00
domainParts   = UTF-8("aic-elevator/storage-upload-parts/v1") + 0x00
uploadSessionId = d5-fv-05-up
stagingOperationId = d5-fv-05-op
authorityClaimId = d5-fv-05-c1
authoritySessionId = d5-fv-05-s1
providerScopeId = d5-fv-05-scope
endpointBindingId = d5-fv-05-e1
objectKey = staging/d5-fv-05-k
expectedSizeBytes = 1048576
expectedChecksumSha256 = aa repeated 32 bytes
providerUploadId = d5-fv-05-upload
sessionGeneration = 1
declaredMimeType = application/pdf
providerCreateOperation = CreateMultipartUpload
partNumber = 1
partSizeBytes = 524288
partChecksumSha256 = bb repeated 32 bytes
partETag = "d6-etag-1"  (literal double quotes included)
providerPartOperation = UploadPart
providerCompleteOperation = CompleteMultipartUpload
providerAbortOperation = AbortMultipartUpload
providerVersionToken = v-d6-0001
observationType = EXACT_OBJECT
targetEffectId = d6-fv-05-e1
changedProviderScopeId = d5-fv-05-OTHER
```

All lengths are unsigned big-endian. Timestamps are not part of
`requestDigest`; `observedAt` remains Evidence metadata.

### A.2 CREATE payload preimage

Length: 225 bytes. SHA-256:
`627E4794EA1514859EDF9CD0C8260A2624EC6F7C80E8B51F6A9D370A7359E24E`.

```text
6169632d656c657661746f722f73746f726167652d75706c6f61642d7061796c6f61642f763100010004000000106465636c617265644d696d6554797065030000000f6170706c69636174696f6e2f706466000000166578706563746564436865636b73756d5368613235360400000020aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa00000011657870656374656453697a6542797465730200000000001000000000001470726f76696465724170694f7065726174696f6e03000000154372656174654d756c74697061727455706c6f6164
```

### A.3 PART payload preimage

Length: 217 bytes. SHA-256:
`D30C9943151FEF50D2A5A11C3E689C7F8DE081934A62BD5AB31193A1D6406C3F`.

```text
6169632d656c657661746f722f73746f726167652d75706c6f61642d7061796c6f61642f7631000100050000001270617274436865636b73756d5368613235360400000020bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb000000087061727445546167030000000b2264362d657461672d31220000000a706172744e756d6265720200000000000000010000000d7061727453697a6542797465730200000000000800000000001470726f76696465724170694f7065726174696f6e030000000a55706c6f616450617274
```

### A.4 ABORT payload preimage

Length: 131 bytes. SHA-256:
`A18BAD56774421C86DC7786194ED5F93418362488A8E664731DE56DB573C5EED`.

```text
6169632d656c657661746f722f73746f726167652d75706c6f61642d7061796c6f61642f7631000100020000001070726f766964657255706c6f61644964030000000f64352d66762d30352d75706c6f61640000001470726f76696465724170694f7065726174696f6e030000001441626f72744d756c74697061727455706c6f6164
```

### A.5 RECONCILE payload preimage

Length: 150 bytes. SHA-256:
`7D13A7D573462DF4B83EDBA233B02D50050C07FA4D031818D4707B5F737FE242`.

```text
6169632d656c657661746f722f73746f726167652d75706c6f61642d7061796c6f61642f7631000100030000000f6f62736572766174696f6e54797065030000000c45584143545f4f424a4543540000001470726f766964657256657273696f6e546f6b656e0300000009762d64362d303030310000000e7461726765744566666563744964030000000b64362d66762d30352d6531
```

### A.6 partsDigest preimage

Length: 175 bytes. SHA-256:
`E21ADEA1368E313D78F976396A65BC3DE9B7857C4425647993112EB61A6CAEF9`.

```text
6169632d656c657661746f722f73746f726167652d75706c6f61642d70617274732f76310000010000001270617274436865636b73756d5368613235360400000020bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb000000087061727445546167030000000b2264362d657461672d31220000000a706172744e756d6265720200000000000000010000000d7061727453697a654279746573020000000000080000
```

### A.7 COMPLETE payload preimage

Length: 146 bytes. SHA-256:
`9E02066C61285ECB97FE2A409E7DBFDE9CB70F12E4D57C632CAA6E558F2A13A5`.

```text
6169632d656c657661746f722f73746f726167652d75706c6f61642d7061796c6f61642f7631000100020000000b70617274734469676573740400000020e21adea1368e313d78f976396a65bc3de9b7857c4425647993112eb61a6caef90000001470726f76696465724170694f7065726174696f6e0300000017436f6d706c6574654d756c74697061727455706c6f6164
```

### A.8 CREATE request bytes

Length: 543 bytes. SHA-256:
`36F30B1128F712DD58034A0B18FE6062853E801EA5AF3239523535231A62AD39`.

```text
6169632d656c657661746f722f73746f726167652d75706c6f61642d616374696f6e2f76310001000e00000013616374696f6e5061796c6f61644469676573740400000020627e4794ea1514859edf9cd0c8260a2624ec6f7c80e8b51f6a9d370a7359e24e0000000a616374696f6e54797065030000000643524541544500000010617574686f72697479436c61696d4964030000000b64352d66762d30352d633100000012617574686f7269747953657373696f6e4964030000000b64352d66762d30352d733100000011656e64706f696e7442696e64696e674964030000000b64352d66762d30352d6531000000166578706563746564436865636b73756d5368613235360400000020aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa00000011657870656374656453697a654279746573020000000000100000000000096f626a6563744b6579030000001273746167696e672f64352d66762d30352d6b0000000a706172744e756d626572000000000f70726f766964657253636f70654964030000000e64352d66762d30352d73636f70650000001070726f766964657255706c6f61644964000000001173657373696f6e47656e65726174696f6e0200000000000000010000001273746167696e674f7065726174696f6e4964030000000b64352d66762d30352d6f700000000f75706c6f616453657373696f6e4964030000000b64352d66762d30352d7570
```

### A.9 PART request bytes

Length: 568 bytes. SHA-256:
`A8A648F0A86CB72523DD0E541E39A1EA7D2F6FAC40B2C712FEF092D1C647EE13`.

```text
6169632d656c657661746f722f73746f726167652d75706c6f61642d616374696f6e2f76310001000e00000013616374696f6e5061796c6f61644469676573740400000020d30c9943151fef50d2a5a11c3e689c7f8de081934a62bd5ab31193a1d6406c3f0000000a616374696f6e5479706503000000045041525400000010617574686f72697479436c61696d4964030000000b64352d66762d30352d633100000012617574686f7269747953657373696f6e4964030000000b64352d66762d30352d733100000011656e64706f696e7442696e64696e674964030000000b64352d66762d30352d6531000000166578706563746564436865636b73756d5368613235360400000020aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa00000011657870656374656453697a654279746573020000000000100000000000096f626a6563744b6579030000001273746167696e672f64352d66762d30352d6b0000000a706172744e756d6265720200000000000000010000000f70726f766964657253636f70654964030000000e64352d66762d30352d73636f70650000001070726f766964657255706c6f61644964030000000f64352d66762d30352d75706c6f61640000001173657373696f6e47656e65726174696f6e0200000000000000010000001273746167696e674f7065726174696f6e4964030000000b64352d66762d30352d6f700000000f75706c6f616453657373696f6e4964030000000b64352d66762d30352d7570
```

### A.10 COMPLETE request bytes

Length: 564 bytes. SHA-256:
`BCE3A15E149B344AA312800E3702D7857F931479688991D770C3AAF49DDB99D3`.

```text
6169632d656c657661746f722f73746f726167652d75706c6f61642d616374696f6e2f76310001000e00000013616374696f6e5061796c6f616444696765737404000000209e02066c61285ecb97fe2a409e7dbfde9cb70f12e4d57c632caa6e558f2a13a50000000a616374696f6e547970650300000008434f4d504c45544500000010617574686f72697479436c61696d4964030000000b64352d66762d30352d633100000012617574686f7269747953657373696f6e4964030000000b64352d66762d30352d733100000011656e64706f696e7442696e64696e674964030000000b64352d66762d30352d6531000000166578706563746564436865636b73756d5368613235360400000020aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa00000011657870656374656453697a654279746573020000000000100000000000096f626a6563744b6579030000001273746167696e672f64352d66762d30352d6b0000000a706172744e756d626572000000000f70726f766964657253636f70654964030000000e64352d66762d30352d73636f70650000001070726f766964657255706c6f61644964030000000f64352d66762d30352d75706c6f61640000001173657373696f6e47656e65726174696f6e0200000000000000010000001273746167696e674f7065726174696f6e4964030000000b64352d66762d30352d6f700000000f75706c6f616453657373696f6e4964030000000b64352d66762d30352d7570
```

### A.11 ABORT request bytes

Length: 561 bytes. SHA-256:
`86925BA3451BB8EBFA507E78A9F6BB7C9DAD34B6C5564420A08C03989206FEEB`.

```text
6169632d656c657661746f722f73746f726167652d75706c6f61642d616374696f6e2f76310001000e00000013616374696f6e5061796c6f61644469676573740400000020a18bad56774421c86dc7786194ed5f93418362488a8e664731de56db573c5eed0000000a616374696f6e54797065030000000541424f525400000010617574686f72697479436c61696d4964030000000b64352d66762d30352d633100000012617574686f7269747953657373696f6e4964030000000b64352d66762d30352d733100000011656e64706f696e7442696e64696e674964030000000b64352d66762d30352d6531000000166578706563746564436865636b73756d5368613235360400000020aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa00000011657870656374656453697a654279746573020000000000100000000000096f626a6563744b6579030000001273746167696e672f64352d66762d30352d6b0000000a706172744e756d626572000000000f70726f766964657253636f70654964030000000e64352d66762d30352d73636f70650000001070726f766964657255706c6f61644964030000000f64352d66762d30352d75706c6f61640000001173657373696f6e47656e65726174696f6e0200000000000000010000001273746167696e674f7065726174696f6e4964030000000b64352d66762d30352d6f700000000f75706c6f616453657373696f6e4964030000000b64352d66762d30352d7570
```

### A.12 RECONCILE request bytes

Length: 565 bytes. SHA-256:
`E8A6BAE3DD9F6D127605EDB03A5E3BF981A8749E36C091BBB66570F35D8894F7`.

```text
6169632d656c657661746f722f73746f726167652d75706c6f61642d616374696f6e2f76310001000e00000013616374696f6e5061796c6f616444696765737404000000207d13a7d573462df4b83edba233b02d50050c07fa4d031818d4707b5f737fe2420000000a616374696f6e5479706503000000095245434f4e43494c4500000010617574686f72697479436c61696d4964030000000b64352d66762d30352d633100000012617574686f7269747953657373696f6e4964030000000b64352d66762d30352d733100000011656e64706f696e7442696e64696e674964030000000b64352d66762d30352d6531000000166578706563746564436865636b73756d5368613235360400000020aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa00000011657870656374656453697a654279746573020000000000100000000000096f626a6563744b6579030000001273746167696e672f64352d66762d30352d6b0000000a706172744e756d626572000000000f70726f766964657253636f70654964030000000e64352d66762d30352d73636f70650000001070726f766964657255706c6f61644964030000000f64352d66762d30352d75706c6f61640000001173657373696f6e47656e65726174696f6e0200000000000000010000001273746167696e674f7065726174696f6e4964030000000b64352d66762d30352d6f700000000f75706c6f616453657373696f6e4964030000000b64352d66762d30352d7570
```

### A.13 Changed-scope COMPLETE request bytes

Length: 564 bytes. SHA-256:
`92F100478C2DDFBF497FC78595345C52CBC64C0A48310A318F670238F1C861E8`.

```text
6169632d656c657661746f722f73746f726167652d75706c6f61642d616374696f6e2f76310001000e00000013616374696f6e5061796c6f616444696765737404000000209e02066c61285ecb97fe2a409e7dbfde9cb70f12e4d57c632caa6e558f2a13a50000000a616374696f6e547970650300000008434f4d504c45544500000010617574686f72697479436c61696d4964030000000b64352d66762d30352d633100000012617574686f7269747953657373696f6e4964030000000b64352d66762d30352d733100000011656e64706f696e7442696e64696e674964030000000b64352d66762d30352d6531000000166578706563746564436865636b73756d5368613235360400000020aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa00000011657870656374656453697a654279746573020000000000100000000000096f626a6563744b6579030000001273746167696e672f64352d66762d30352d6b0000000a706172744e756d626572000000000f70726f766964657253636f70654964030000000e64352d66762d30352d4f544845520000001070726f766964657255706c6f61644964030000000f64352d66762d30352d75706c6f61640000001173657373696f6e47656e65726174696f6e0200000000000000010000001273746167696e674f7065726174696f6e4964030000000b64352d66762d30352d6f700000000f75706c6f616453657373696f6e4964030000000b64352d66762d30352d7570
```

## Appendix B — Normative PostgreSQL DDL Gate

These are design-time DDL requirements, not an executed Migration. Names are
quoted exactly so later implementation can compare them mechanically. Every
`ON DELETE` and `ON UPDATE` action is explicit; no action is inferred.

### B.1 Effect and Owner

```sql
ALTER TABLE "StorageProviderEffect"
  ADD CONSTRAINT "effect_id_operation_uq"
    UNIQUE ("id", "operationId"),
  ADD CONSTRAINT "effect_id_operation_generation_uq"
    UNIQUE ("id", "operationId", "sourceGeneration"),
  ADD CONSTRAINT "effect_id_operation_kind_uq"
    UNIQUE ("id", "operationId", "effectKind"),
  ADD CONSTRAINT "effect_id_operation_scope_endpoint_key_uq"
    UNIQUE ("id", "operationId", "providerScopeId",
            "endpointBindingId", "objectKey");

ALTER TABLE "StorageProviderEffectOwner"
  ADD CONSTRAINT "effect_owner_effect_fk"
    FOREIGN KEY ("effectId")
    REFERENCES "StorageProviderEffect" ("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT "effect_owner_upload_action_fk"
    FOREIGN KEY ("uploadActionId")
    REFERENCES "StorageProviderUploadAction" ("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT "effect_owner_publisher_fk"
    FOREIGN KEY ("publisherAttemptId")
    REFERENCES "StoragePublisherAttempt" ("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT "effect_owner_cleanup_fk"
    FOREIGN KEY ("cleanupAttemptId")
    REFERENCES "StorageCleanupAttempt" ("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT "effect_owner_exactly_one_ck"
    CHECK (num_nonnulls("uploadActionId", "publisherAttemptId",
                        "cleanupAttemptId") = 1),
  ADD CONSTRAINT "effect_owner_kind_ck"
    CHECK (
      ("ownerKind" = 'UPLOAD_ACTION' AND "uploadActionId" IS NOT NULL)
      OR ("ownerKind" = 'PUBLISHER_ATTEMPT' AND "publisherAttemptId" IS NOT NULL)
      OR ("ownerKind" = 'CLEANUP_ATTEMPT' AND "cleanupAttemptId" IS NOT NULL)
    );
```

### B.2 Primary action link

```sql
ALTER TABLE "StorageProviderUploadAction"
  ADD CONSTRAINT "action_effect_operation_fk"
    FOREIGN KEY ("providerEffectId", "stagingOperationId")
    REFERENCES "StorageProviderEffect" ("id", "operationId")
    ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT "action_effect_owner_fk"
    FOREIGN KEY ("providerEffectId", "primaryEffectOwnerActionId")
    REFERENCES "StorageProviderEffectOwner" ("effectId", "uploadActionId")
    ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT "action_primary_owner_ck"
    CHECK (
      ("effectRelation" = 'PRIMARY'
       AND "primaryEffectOwnerActionId" = "id")
      OR
      ("effectRelation" = 'RECONCILE'
       AND "primaryEffectOwnerActionId" IS NULL)
    );
```

The `action_effect_owner_fk` is nullable only for `RECONCILE`; the CHECK makes
NULL unreachable for `PRIMARY`. A partial foreign key is not used because
PostgreSQL has no partial-FK syntax.

Publisher and cleanup attempts use the same two-way owner binding:

```sql
ALTER TABLE "StoragePublisherAttempt"
  ADD CONSTRAINT "publisher_effect_generation_fk"
    FOREIGN KEY ("providerEffectId", "operationId", "authorityGeneration")
    REFERENCES "StorageProviderEffect"
      ("id", "operationId", "sourceGeneration")
    ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT "publisher_effect_owner_fk"
    FOREIGN KEY ("providerEffectId", "id")
    REFERENCES "StorageProviderEffectOwner"
      ("effectId", "publisherAttemptId")
    ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "StorageCleanupAttempt"
  ADD CONSTRAINT "cleanup_effect_generation_fk"
    FOREIGN KEY ("providerEffectId", "operationId", "authorityGeneration")
    REFERENCES "StorageProviderEffect"
      ("id", "operationId", "sourceGeneration")
    ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT "cleanup_effect_owner_fk"
    FOREIGN KEY ("providerEffectId", "id")
    REFERENCES "StorageProviderEffectOwner"
      ("effectId", "cleanupAttemptId")
    ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
```

### B.3 Active pointer tables and triggers

```sql
ALTER TABLE "StorageUploadSessionActionSlot"
  ADD CONSTRAINT "action_slot_active_fk"
    FOREIGN KEY ("activeActionId")
    REFERENCES "StorageProviderUploadAction" ("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "StorageRepresentationSlot"
  ADD CONSTRAINT "representation_slot_active_fk"
    FOREIGN KEY ("activeAttemptId")
    REFERENCES "StorageRepresentationAttempt" ("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;

CREATE CONSTRAINT TRIGGER "action_slot_membership_guard"
AFTER INSERT OR UPDATE OF "activeActionId", "uploadSessionId"
ON "StorageUploadSessionActionSlot"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "d6_assert_action_slot_membership"();

CREATE CONSTRAINT TRIGGER "representation_slot_membership_guard"
AFTER INSERT OR UPDATE OF "activeAttemptId", "id", "backendKind"
ON "StorageRepresentationSlot"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "d6_assert_representation_slot_membership"();

CREATE CONSTRAINT TRIGGER "action_state_slot_guard"
AFTER INSERT OR UPDATE OF "state", "uploadSessionId"
ON "StorageProviderUploadAction"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "d6_assert_action_slot_membership_reverse"();

CREATE CONSTRAINT TRIGGER "attempt_state_slot_guard"
AFTER INSERT OR UPDATE OF "state", "slotId", "backendKind"
ON "StorageRepresentationAttempt"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "d6_assert_representation_slot_membership_reverse"();
```

The functions return an exception with SQLSTATE `23514` unless the pointed
action/attempt exists, belongs to the same session/slot, is in an allowed
state, and the pointer release matched the expected old pointer and epoch.

### B.4 Permit and snapshot

```sql
ALTER TABLE "StorageProviderDispatchPermit"
  ADD CONSTRAINT "permit_effect_tuple_fk"
    FOREIGN KEY ("effectId", "effectKind", "operationId",
                 "providerScopeId", "endpointBindingId", "objectKey",
                 "effectSourceGeneration")
    REFERENCES "StorageProviderEffect"
      ("id", "effectKind", "operationId", "providerScopeId",
       "endpointBindingId", "objectKey", "sourceGeneration")
    ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT "permit_target_operation_fk"
    FOREIGN KEY ("destructiveTargetId", "operationId")
    REFERENCES "StorageDestructiveOperationTarget" ("id", "operationId")
    ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT "permit_snapshot_target_fk"
    FOREIGN KEY ("investigationSnapshotId", "destructiveTargetId", "operationId")
    REFERENCES "StorageInvestigationSnapshot"
      ("id", "destructiveTargetId", "operationId")
    ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "StorageInvestigationSnapshot"
  ADD CONSTRAINT "snapshot_destructive_source_fk"
    FOREIGN KEY ("destructiveTargetId", "operationId",
                 "sourceRepresentationAttemptId")
    REFERENCES "StorageDestructiveOperationTarget"
      ("id", "operationId", "targetRepresentationAttemptId")
    ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
```

A destructive permit has both target and snapshot columns non-null by CHECK;
the snapshot state is rechecked by its deferred trigger. The provider call is
never run from inside the database transaction.

### B.5 Evidence base/subtype projection

```sql
ALTER TABLE "StorageLifecycleEvidence"
  ADD CONSTRAINT "evidence_id_type_uq" UNIQUE ("id", "evidenceType");

-- Applied to each of the 14 subtype tables with its literal discriminator:
ALTER TABLE "StorageAuthorizationEvidence"
  ADD CONSTRAINT "authorization_base_fk"
    FOREIGN KEY ("evidenceId")
    REFERENCES "StorageLifecycleEvidence" ("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT "authorization_type_ck"
    CHECK ("discriminator" = 'AUTHORIZATION');

CREATE CONSTRAINT TRIGGER "authorization_projection_guard"
AFTER INSERT OR UPDATE ON "StorageAuthorizationEvidence"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "d6_assert_evidence_projection"();
```

The same two statements are mandatory for each of the other thirteen tables,
with its own table name and literal discriminator. The trigger compares the
subtype's `discriminator`, `operationId` and nullable `objectVersionId` to the
base row using `IS NOT DISTINCT FROM`; it rejects a mismatch with
`23514/D6_EVIDENCE_PROJECTION_MISMATCH`.


## 19. Remaining P2/P3 and External Verification Items

These items remain after the six P1 design corrections. They do not authorize a
runtime change and must not be presented as executed controls.

| ID | Severity | Item | Current state | Exit condition |
|---|---|---|---|---|
| `D6-R-01` | P2 | Provider account, bucket, region, exact-version copy/list/delete and audit-delivery semantics | `NOT VERIFIED` | isolated Provider capability probe and manifest evidence |
| `D6-R-02` | P2 | PostgreSQL function/SHA-256 availability, Deferred FK/trigger behavior and performance | `NOT VERIFIED` | isolated clone DDL + behavior tests |
| `D6-R-03` | P2 | Database roles, `SECURITY DEFINER` owner, `search_path`, `PUBLIC EXECUTE` and mTLS/pg_ident identity | `NOT VERIFIED` | approved ACL/role design execution in an isolated environment |
| `D6-R-04` | P2 | Trust root, manifest signature, revocation issuer and epoch source | `NOT VERIFIED` | signed capability/trust evidence bundle |
| `D6-R-05` | P2 | Windows/NTFS file identity, reparse point, handle closure and OS fencing | `NOT VERIFIED` | approved native authority or explicit Route C object-only boundary |
| `D6-R-06` | P2 | Historical object inventory and legacy source mapping | `NOT VERIFIED` | read-only inventory with deterministic mapping; no fabricated IDs |
| `D6-R-07` | P2 | Retention/deletion policy and investigation-snapshot lifetime outside open incidents | `OPEN` | product/security owner policy |
| `D6-R-08` | P3 | Exact wording of operator runbooks and public error messages | `OPEN` | implementation/UX review |
| `D6-R-09` | P3 | Query/index cardinality and lock-plan cost under large histories | `NOT VERIFIED` | isolated performance/plan test |

### 19.1 External dependency classification

```text
Provider side-effect idempotency:       REQUIRED CAPABILITY / NOT VERIFIED
Provider exact-version snapshot/copy:   REQUIRED CAPABILITY / NOT VERIFIED
Provider exact-version readback:        REQUIRED CAPABILITY / NOT VERIFIED
Provider audit delivery:                REQUIRED CAPABILITY / NOT VERIFIED
PostgreSQL SHA-256 primitive:           REQUIRED / NOT VERIFIED
Authority/Broker mTLS and DB identity:  REQUIRED / NOT VERIFIED
Trust root and revocation source:       REQUIRED / NOT VERIFIED
Historical object inventory:            REQUIRED / NOT VERIFIED
DB role/ACL implementation:             NOT IMPLEMENTED
Source integration:                     NOT IMPLEMENTED
```

D6 does not claim that any Provider can satisfy a required capability. If a
required capability is absent, the corresponding destructive/publication path
must remain disabled; there is no degraded mode that silently deletes or
publishes.

## 20. Static Design Self-check

The following checks were run against this report only. They are not a
PostgreSQL, Provider, Storage, Windows, ACL, build or runtime test:

```text
R6 P1 trace rows:                         6
R6 P2 trace rows:                         5
R6 P3 trace rows:                         2
Typed Evidence subtype definitions:       14
Race test headings:                       16
Fixed vector IDs:                         24
Cross-protocol test headings:             12
PostgreSQL MATCH FULL on nullable pointers: prohibited, not used
Fixed request vectors parsed and hashed:   12 byte preimages
Normative PostgreSQL DDL appendix:        PRESENT
```

### 20.1 Schema cross-check

The following parent anchors are explicitly declared for every composite
relation used by Effect, Owner, Active Pointer, Permit, Snapshot, Migration and
Evidence definitions:

```text
Claim(id,operationId,generation)
Claim(id,operationId,sessionId)
Session(id,workloadId,dbRole,operationId)
Effect(id,operationId,effectKind)
Effect(id,operationId,sourceGeneration)
Effect(id,operationId,allocationId,sourceGeneration)
Effect(id,operationId,providerScopeId,endpointBindingId,objectKey)
EffectOwner(effectId,uploadActionId)
EffectOwner(effectId,publisherAttemptId)
EffectOwner(effectId,cleanupAttemptId)
UploadAction(id,uploadSessionId)
UploadAction(id,stagingOperationId)
UploadAction(id,providerEffectId)
RepresentationAttempt(id,slotId,backendKind)
RepresentationAttempt(id,operationId)
ObjectVersion(id,allocationId)
ObjectVersion(id,sourceOperationId)
ObjectVersion(id,sourceUploadSessionId)
ObjectVersion(id,providerScopeId,objectKey)
ObjectVersion(id,providerScopeId,objectKey,providerVersionToken)
ObjectBinding(id,objectVersionId)
MigrationRecord(id,sourceRepresentationAttemptId,targetRepresentationAttemptId)
DestructiveTarget(id,operationId,targetRepresentationAttemptId)
InvestigationSnapshot(id,destructiveTargetId,operationId)
IncidentTarget(incidentId,representationAttemptId)
EndpointBinding(providerScopeId,id)
ManifestRevocation(id,manifestId,revokedKeyId,epoch)
```

The nullable active-pointer columns use a single-column FK for identity and a
deferred membership/state trigger for ownership; no composite nullable FK is
used. The composite Evidence/base relation uses a deferred projection trigger
rather than a nullable composite FK, preventing PostgreSQL `MATCH SIMPLE` from
silently skipping a subtype relation.

### 20.2 Digest cross-check

Python and Node.js independently parsed/constructed the same twelve canonical
preimages. Both produced the lengths and SHA-256 values in Appendix A:

```text
CREATE payload  225  627E4794EA1514859EDF9CD0C8260A2624EC6F7C80E8B51F6A9D370A7359E24E
PART payload    217  D30C9943151FEF50D2A5A11C3E689C7F8DE081934A62BD5AB31193A1D6406C3F
ABORT payload   131  A18BAD56774421C86DC7786194ED5F93418362488A8E664731DE56DB573C5EED
RECONCILE p.    150  7D13A7D573462DF4B83EDBA233B02D50050C07FA4D031818D4707B5F737FE242
partsDigest p.  175  E21ADEA1368E313D78F976396A65BC3DE9B7857C4425647993112EB61A6CAEF9
COMPLETE p.     146  9E02066C61285ECB97FE2A409E7DBFDE9CB70F12E4D57C632CAA6E558F2A13A5
CREATE request  543  36F30B1128F712DD58034A0B18FE6062853E801EA5AF3239523535231A62AD39
PART request    568  A8A648F0A86CB72523DD0E541E39A1EA7D2F6FAC40B2C712FEF092D1C647EE13
COMPLETE req.   564  BCE3A15E149B344AA312800E3702D7857F931479688991D770C3AAF49DDB99D3
ABORT request   561  86925BA3451BB8EBFA507E78A9F6BB7C9DAD34B6C5564420A08C03989206FEEB
RECONCILE req.  565  E8A6BAE3DD9F6D127605EDB03A5E3BF981A8749E36C091BBB66570F35D8894F7
changed scope   564  92F100478C2DDFBF497FC78595345C52CBC64C0A48310A318F670238F1C861E8
```

No vector uses the D5 u16 field-name rule. The D5 u16 vector remains a
historical mismatch (`529` bytes /
`832A6EEDFF8D31963722D223C0B90529D6D22817DDCA12E737E961D90CA017CE`) and is
not accepted by D6 canonicalizer version 1.

### 20.3 Markdown and test-ID static checks

```text
Unbalanced triple-backtick fences:       0
Unresolved control markers:              0
Ellipsis fixture tokens:                 0
Missing d6-x IDs in 01..16:              0
Missing d6-fv IDs in 01..24:             0
Missing d6-xt IDs in 01..12:             0
Missing named Evidence subtype tables:   0
D6 whitespace diagnostics:               0 errors (only repository LF/CRLF notice)
Tracked `git diff --check`:               PASS
```

There is no unresolved generated-identifier directive or unresolved fixture
identifier.

### 20.4 Source and environment boundary

```text
Source/Schema/Migration/Trigger changes: 0
Database/SQL/Migration execution:          NOT EXECUTED
Provider/Storage/IAM/ACL operations:       NOT EXECUTED
Web/Worker/Broker/Scheduler operations:    NOT EXECUTED
Build/E2E/Native RPC/deploy:               NOT EXECUTED
Secrets or .env read:                      NO
$null read/hash/modify/delete:             NO
UNKNOWN' read/modify/move/delete:           NO
apps/web/.next touched:                    NO
apps/worker/dist touched:                  NO
```

### 20.5 Git state

At D6 start:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       0
Staged:                 0
Deleted:                0
Untracked:              34
```

At D6 end:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       0
Staged:                 0
Deleted:                0
Untracked:              34
```

Only this D6 report was edited. The pre-existing untracked files, including
`$null`, `UNKNOWN'`, the review history and the Python cache were preserved
without reading or deleting protected contents.

### 20.6 Self-reference note

A file cannot contain its own whole-file SHA-256 without changing that SHA.
The final `SHA-256`, byte count and line count are therefore supplied as
delivery metadata after the report bytes are frozen; the values below are a
hash of all bytes preceding this section, which is independently stable.

```text
Body SHA-256 (bytes before §20): 7411A20402A84D3A82ADB082C9B127AED5509713FC712DA4FC20E80B6D4C2875
```

## 21. Final Decision

```text
D6 DESIGN COMPLETE — READY FOR INDEPENDENT REVIEW

R6 P1:
  6/6 ADDRESSED BY DESIGN

R6 P2:
  5/5 ADDRESSED BY DESIGN

R6 P3:
  2/2 ADDRESSED BY DESIGN

Typed Evidence:
  14/14 COMPLETE DATABASE RELATION DEFINITIONS

Deterministic test specifications:
  16/16 RACES
  24/24 FIXED VECTORS
  12/12 CROSS-PROTOCOL TESTS

Independent review:
  REQUIRED

Isolated verification:
  NOT AUTHORIZED BY D6

Source implementation:
  NOT AUTHORIZED

PostgreSQL / Provider / Storage / Windows / Runtime:
  NOT VERIFIED
```

This is a design, static-consistency and canonicalization result. It is not a
claim that the proposed DDL compiles, that PostgreSQL executes the triggers as
intended, that any Provider supports the required primitives, that a Broker
identity is real, or that filesystem/OS fencing works. R7 and all runtime work
require separate authorization.
