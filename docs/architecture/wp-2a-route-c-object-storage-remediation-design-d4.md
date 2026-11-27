# WP-2A-D4 — Executable Route C Protocol Specification

## 0. Document Control

```text
Stage:
  WP-2A-D4

Mode:
  READ-ONLY INVESTIGATION / EXECUTABLE DESIGN SPECIFICATION

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
  29

Input D3:
  docs/architecture/wp-2a-route-c-object-storage-remediation-design-d3.md

D3 SHA-256:
  D5CDB6BE582DA618057F581FA03A2612CBCC012F0A5FB4435F8CB8FFB36BFD33

Input R4:
  docs/architecture/wp-2a-route-c-object-storage-independent-review-r4.md

R4 SHA-256:
  9CD9D62F5A393D0256257B3F6214BDFDF7AE5C40A08DF7C4DB71FD6669C66667

Final result:
  D4 DESIGN COMPLETE — READY FOR INDEPENDENT REVIEW

Implementation:
  NOT AUTHORIZED

Database / Provider / Storage:
  NOT ACCESSED
```

D4 replaces D3 protocol definitions where they conflict. It does not change
D1, D2, D3, R2, R3, R4 or any historical report.

D4 completion means the protocol is sufficiently explicit to implement and
test in a separately authorized isolated environment. It does not mean any
source code, SQL, database, Provider, IAM, filesystem or runtime behavior has
been verified.

## 1. Authorization and Scope

Authorized:

1. Resolve all five R4 P1 findings.
2. Dispose all six R4 P2 findings.
3. Dispose both R4 P3 findings.
4. Provide field-level data definitions and database constraints.
5. Provide transaction/CAS pseudocode and Provider-call boundaries.
6. Convert 16 race timelines and 24 vectors into deterministic test
   specifications.
7. Add the required cross-protocol tests.

Not authorized:

```text
source / Schema / Migration / Trigger / Function changes
test / configuration / dependency changes
SQL or database connection
Provider, Storage, IAM or credential access
service, Worker, Scheduler or deployment operation
Build, E2E, Native RPC or runtime verification
Git staging, commit, push or branch operation
```

The following remain independently unsettled:

```text
R5:
  57/57 Open Decisions remain OPEN

BV7:
  FAIL remains in force

BV8:
  NOT INDEPENDENTLY APPROVED

R8:
  BLOCKED remains in force

Old upload chain / P1-3 integration:
  NOT IMPLEMENTED

Provider/account/region/credentials/IAM:
  NOT VERIFIED

Historical local/Provider object inventory:
  NOT VERIFIED

P2-05 cost/degraded-read policy:
  OPEN
```

## 2. Skills and Evidence

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
| `SOURCE VERIFIED` | Current source/Schema/Migration fact |
| `D4 DESIGN` | Normative executable design |
| `D4 TEST SPEC` | Deterministic future test specification |
| `NOT VERIFIED` | Requires target database/Provider/OS/runtime |
| `BLOCKED` | External decision or environment required |

### 2.3 Current Source Facts

`SOURCE VERIFIED`:

| Evidence | Location |
|---|---|
| Current FileVersion storage/chain fields | `prisma/schema.prisma:398-443` |
| Current P1-3 lifecycle and operation models | `prisma/schema.prisma:501-655` |
| Current operation enum | `prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:55-60` |
| Current key namespaces | same Migration `377-388` |
| Current close constraints | same Migration `484-543` |
| Current local cleanup proof | same Migration `674-718` |
| Current lifecycle/operation transitions | same Migration `873-1008` |
| Current upload completion chain | same Migration `1360-1537` |
| Current FileVersion guards | same Migration `1781-1946` |
| Current DB test gaps | `apps/web/scripts/p13-db-tests/capabilities.ts:1-16` |
| Current local Storage contract | `packages/file-storage/src/capabilities.ts:23-98` |

No D4 database object exists in the repository.

## 3. D3 to D4 Change Matrix

| R4 finding | D3 defect | D4 correction |
|---|---|---|
| `WP2AR4-P1-01` | Claim outcome and attempt state could disagree | Add authoritative `StorageProviderEffect`; AuthorityClaim has no terminal outcome |
| `WP2AR4-P1-02` | Complete/Abort nonce absent from fields | Add Upload Action Ledger and action-result attempts |
| `WP2AR4-P1-03` | One terminal representation per role | Add RepresentationSlot + append-only RepresentationAttempt |
| `WP2AR4-P1-04` | Audit contradiction could remain readable | Add append-only Incident, active quarantine and read/cleanup guards |
| `WP2AR4-P1-05` | Evidence subtype fields missing | Add complete Evidence subtype contracts and canonical digest algorithm |
| `WP2AR4-P2-01` | dynamic lock discovery | Add sealed Operation Lock Plan; no key addition after locking |
| `WP2AR4-P2-02` | multiple PROVISIONING endpoints | Add singleton EndpointRotationSlot |
| `WP2AR4-P2-03` | migration source no unique slot | Add MigrationSourceSlot uniqueness |
| `WP2AR4-P2-04` | custody predicates incomplete | Add custody transition matrix and owner-digest equality |
| `WP2AR4-P2-05` | timelines descriptive | Replace with deterministic 16-case specifications |
| `WP2AR4-P2-06` | vectors descriptive | Add fixed fixtures, ordering, rowcounts and negative assertions |
| `WP2AR4-P3-1` | endpoint FAILED transition missing | Add explicit rotation fail transition |
| `WP2AR4-P3-2` | capability child ownership missing | Add trusted child-set ingestion and validation |

## 4. Authority and Provider-effect Model

### 4.1 One Authority Source

D4 removes terminal outcome from `StorageOperationAuthorityClaim`.

```text
StorageOperationAuthorityClaim:
  authority only

StorageProviderEffect:
  authoritative external-side-effect fact

StorageLifecycleEvidence:
  attributed observation/corroboration

StorageFinalizerAttempt:
  current final acceptance authority

FileVersion / Representation:
  committed business result
```

`StoragePublisherAttempt` and `StorageProviderUploadAction` reference the same
`StorageProviderEffect`; they do not own independent final outcome states.

### 4.2 `StorageOperationAuthorityClaim`

```text
id                         varchar(32) PK
operationId                varchar(32) NOT NULL
operationTypeSnapshot      StorageOperationType NOT NULL
sessionId                  varchar(32) NOT NULL
authorityKind              AuthorityKind NOT NULL
generation                 bigint NOT NULL CHECK (generation > 0)
ownerTokenDigest           char(64) NOT NULL
leaseExpiresAt             timestamptz(6) NOT NULL
state                      ACTIVE | CLOSED | SUPERSEDED | REVOKED
providerMutationStartedAt  timestamptz(6) NULL
createdAt                  timestamptz(6) NOT NULL
endedAt                    timestamptz(6) NULL
```

Constraints:

```text
UNIQUE(operationId, generation)
UNIQUE(operationId) WHERE state = 'ACTIVE'
UNIQUE(id, operationId, generation)
UNIQUE(id, operationId, sessionId)
```

Exact FKs:

```text
(operationId, operationTypeSnapshot)
  -> StorageObjectOperation(id, operationType)

(sessionId, operationId)
  -> StorageOperationAuthoritySession(id, operationId)

(operationTypeSnapshot, authorityKind)
  -> StorageOperationAuthorityPermission(operationType, authorityKind)
```

Allowed:

```text
ACTIVE -> CLOSED
ACTIVE -> SUPERSEDED
ACTIVE -> REVOKED
CLOSED/SUPERSEDED/REVOKED -> terminal
```

No transition reopens a claim.

### 4.3 `StorageProviderEffect`

```text
id                         varchar(32) PK
operationId                varchar(32) NOT NULL
allocationId               varchar(32) NOT NULL
effectKind                 STAGE_WRITE | CANONICAL_PUBLISH |
                           MIGRATION_COPY | ROLLBACK_COPY |
                           DELETE | CONFLICT_CLEANUP
sourceClaimId              varchar(32) NOT NULL
sourceGeneration           bigint NOT NULL
requestNonce               varchar(100) NOT NULL
requestState               NOT_STARTED | DISPATCHING | REQUEST_SENT |
                           RESPONSE_OBSERVED | RESPONSE_UNKNOWN
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

Constraints:

```text
UNIQUE(operationId, requestNonce)
UNIQUE(id, operationId, allocationId, sourceGeneration)
CHECK state/field combinations below
```

Exact FKs:

```text
(sourceClaimId, operationId, sourceGeneration)
  -> StorageOperationAuthorityClaim(id, operationId, generation)

(allocationId, operationId)
  -> StorageObjectKeyAllocation(id, operationId)

(objectVersionId, allocationId)
  -> StorageObjectVersion(id, allocationId)
```

State compatibility:

| Request state | Effect state |
|---|---|
| `NOT_STARTED` | `NOT_STARTED` |
| `DISPATCHING` | `IN_FLIGHT` |
| `REQUEST_SENT` | `IN_FLIGHT` |
| `RESPONSE_OBSERVED` | `NO_EFFECT`, `EXACT_OBSERVED`, `CONTENT_VERIFIED`, `WRONG_CONTENT` |
| `RESPONSE_UNKNOWN` | `IN_FLIGHT`, `LATE_EFFECT_UNCLAIMED`, `FAILED_RETAINED` |

Illegal:

```text
NOT_STARTED + EXACT_OBSERVED
REQUEST_SENT + CONTENT_VERIFIED
RESPONSE_OBSERVED + objectVersionId NULL for an object effect
CONTENT_VERIFIED without a READBACK_VERIFIED Evidence row
sourceClaimId from another Operation
allocationId from another Operation
```

### 4.4 Superseded Exact-object Adoption

The source claim may be:

```text
CLOSED or SUPERSEDED
```

The source effect may be:

```text
EXACT_OBSERVED or CONTENT_VERIFIED
```

Recovery Finalizer may use it as a source candidate if:

```text
source effect belongs to the same Operation/allocation/key
source request nonce/metadata matches the physical object
source size/SHA-256 match Operation snapshot
exact-version Readback exists
candidate binding is unique
current Finalizer claim/lease/generation is valid
trust/revocation/routing epochs are current
```

This does not reactivate the source claim or its Provider write credential.

The derived authority rule is:

```text
Source effect:
  evidence of a past external effect

Current Finalizer:
  authority to accept or reject that effect

FileVersion:
  created only by the current Finalizer transaction
```

### 4.5 Claim/Publish State Derivation

`StoragePublisherAttempt` stores:

```text
providerEffectId
requestState
attemptState
```

but no terminal aggregate outcome. `attemptState` is limited to:

```text
CLAIMED
REQUEST_SENT
CLOSED
SUPERSEDED
REVOKED
```

The aggregate function:

```text
storage_effect_authoritative_state(effectId)
```

returns the single effect state. A DB trigger rejects:

```text
attempt.providerEffectId points to another operation/allocation
attempt.requestState differs from effect.requestState
attempt claims CONTENT_VERIFIED without Readback Evidence
```

## 5. Upload Action Ledger

### 5.1 `StorageProviderUploadAction`

```text
id                         varchar(32) PK
uploadSessionId            varchar(32) NOT NULL
stagingOperationId         varchar(32) NOT NULL
actionType                 CREATE | PART | COMPLETE | ABORT | RECONCILE
idempotencyNonce           varchar(100) NOT NULL UNIQUE
requestDigest              char(64) NOT NULL
sessionGeneration          bigint NOT NULL
authorityClaimId           varchar(32) NOT NULL
authoritySessionId         varchar(32) NOT NULL
providerScopeId            varchar(32) NOT NULL
endpointBindingId          varchar(32) NOT NULL
objectKey                  varchar(255) NOT NULL
providerUploadId           varchar(255) NULL
partNumber                 integer NULL
state                      PREPARED | DISPATCHED | RESPONSE_UNKNOWN |
                           SUCCEEDED | FAILED | SUPERSEDED
requestedAt                timestamptz(6) NOT NULL
terminalAt                 timestamptz(6) NULL
```

Constraints:

```text
UNIQUE(actionType, idempotencyNonce)
UNIQUE(id, uploadSessionId, actionType)
CHECK partNumber IS NOT NULL only for PART
CHECK providerUploadId NOT NULL for PART/COMPLETE/ABORT after CREATE success
CHECK terminalAt NOT NULL for SUCCEEDED/FAILED
```

Exact FKs:

```text
(uploadSessionId, sessionGeneration)
  -> StorageProviderUploadSession(id, sessionGeneration)

(authorityClaimId, authoritySessionId, stagingOperationId)
  -> StorageOperationAuthorityClaim(
       id, sessionId, operationId
     )

(uploadSessionId, stagingOperationId, sessionGeneration)
  -> StorageProviderUploadSession(
       id, stagingOperationId, sessionGeneration
     )

(providerScopeId, endpointBindingId)
  -> StorageProviderEndpointBinding(providerScopeId, id)
```

### 5.2 `StorageProviderUploadActionResult`

Append-only result per Provider attempt:

```text
id                         varchar(32) PK
actionId                   varchar(32) NOT NULL
attemptNumber              integer NOT NULL CHECK > 0
workerWorkloadId           varchar(64) NOT NULL
authorityClaimId           varchar(32) NOT NULL
providerRequestId          varchar(255) NULL
httpStatus                 integer NULL
normalizedResult           OK | NOT_FOUND | CONFLICT | DENIED |
                           RETRYABLE_ERROR | UNKNOWN
resultObjectVersionId      varchar(32) NULL
providerErrorClass         varchar(100) NULL
evidenceId                 varchar(32) NOT NULL
startedAt                   timestamptz(6) NOT NULL
responseAt                  timestamptz(6) NULL
```

Constraints:

```text
UNIQUE(actionId, attemptNumber)
UNIQUE(evidenceId)
```

Every result row has exact typed Provider Operation/Outcome Evidence.

### 5.3 `StorageUploadPartCheckpoint`

```text
id                         varchar(32) PK
uploadSessionId            varchar(32) NOT NULL
actionId                   varchar(32) NOT NULL UNIQUE
partNumber                 integer NOT NULL CHECK > 0
partETag                   varchar(255) NOT NULL
partSizeBytes              bigint NOT NULL CHECK > 0
partChecksumSha256         char(64) NOT NULL
authorityGeneration        bigint NOT NULL
providerRequestId          varchar(255) NULL
state                      PREPARED | COMMITTED | UNKNOWN | FAILED_RETAINED
observedAt                 timestamptz(6) NOT NULL
```

Constraints:

```text
UNIQUE(uploadSessionId, partNumber)
(actionId, uploadSessionId)
  -> StorageProviderUploadAction(id, uploadSessionId)
```

A committed checkpoint cannot be overwritten. A duplicate part request with a
different checksum/ETag is a conflict and is retained for review.

### 5.4 `StorageUploadSessionActionSlot`

Only one active Complete/Abort/Reconcile intent per session:

```text
uploadSessionId            varchar(32) PK
activeActionId             varchar(32) NULL UNIQUE
slotEpoch                  bigint NOT NULL
updatedAt                  timestamptz(6) NOT NULL
```

Rules:

```text
activeActionId required while action state is PREPARED/DISPATCHED/RESPONSE_UNKNOWN
activeActionId cleared only when the action reaches SUCCEEDED/FAILED/SUPERSEDED
different Complete/Abort action with active slot -> D4_UPLOAD_ACTION_IN_PROGRESS
same idempotency nonce + same requestDigest -> return existing action
same nonce + different requestDigest -> D4_ACTION_NONCE_MISMATCH
```

### 5.5 Transaction Boundaries

Prepare action:

```text
BEGIN
  lock session/action slot/session generation
  validate nonce and request digest
  INSERT action PREPARED
  claim action slot
COMMIT
```

Dispatch marker:

```text
UPDATE action
SET state='DISPATCHED'
WHERE id=:action
  AND state='PREPARED'
  AND idempotencyNonce=:nonce
  AND requestDigest=:digest
rowcount MUST BE 1
COMMIT
```

Provider call:

```text
outside any DB transaction and advisory lock
```

Result:

```text
BEGIN
  ingest typed Provider result Evidence
  INSERT action result
  UPDATE action to SUCCEEDED/FAILED/RESPONSE_UNKNOWN
  update slot
  update session terminal/result state if exact
COMMIT
```

Crash after dispatch marker leaves `DISPATCHED`; reconciliation uses the same
action nonce. It never creates a new action with a different nonce.

## 6. Representation Slots and Retryable Attempts

### 6.1 `StorageRepresentationSlot`

```text
id                         varchar(32) PK
fileVersionId              varchar(32) NOT NULL
role                       ORIGIN | V2_CANONICAL | ROLLBACK_FALLBACK
backendKind                LOCAL_FILE | OBJECT_STORE
activeAttemptId            varchar(32) NULL UNIQUE
createdAt                  timestamptz(6) NOT NULL
```

Constraints:

```text
UNIQUE(fileVersionId, role)
UNIQUE(id, fileVersionId, role, backendKind)
```

### 6.2 `StorageRepresentationAttempt`

```text
id                         varchar(32) PK
slotId                     varchar(32) NOT NULL
attemptGeneration          bigint NOT NULL CHECK > 0
backendKind                LOCAL_FILE | OBJECT_STORE
operationId                varchar(32) NOT NULL
state                      CANDIDATE | VERIFIED | ACTIVE |
                           SUPERSEDED | FAILED_RETAINED
storageKey                 varchar(255) NOT NULL
sizeBytes                  bigint NOT NULL
checksumSha256             char(64) NOT NULL
createdAt                  timestamptz(6) NOT NULL
verifiedAt                 timestamptz(6) NULL
supersededAt               timestamptz(6) NULL
failedAt                   timestamptz(6) NULL
```

Constraints:

```text
UNIQUE(slotId, attemptGeneration)
UNIQUE(id, slotId, backendKind)
UNIQUE(slotId) WHERE state IN ('CANDIDATE','VERIFIED','ACTIVE')
```

`FAILED_RETAINED` is terminal for that attempt, not for the slot.

### 6.3 Attempt Transitions

```text
CANDIDATE -> VERIFIED
CANDIDATE -> FAILED_RETAINED
VERIFIED -> ACTIVE
VERIFIED -> FAILED_RETAINED
ACTIVE -> SUPERSEDED
ACTIVE -> FAILED_RETAINED
SUPERSEDED -> terminal
FAILED_RETAINED -> terminal
```

New attempt:

```text
only when slot.activeAttemptId IS NULL
new attemptGeneration = max(slot attempts)+1
slot.activeAttemptId set in same transaction
```

Old failed attempt remains immutable.

### 6.4 Typed Representation Targets

`StorageLocalRepresentationAttempt`:

```text
attemptId                  varchar(32) PK
lifecycleId                varchar(32) NOT NULL
storageKey                 varchar(255) NOT NULL
closeEvidenceId            varchar(32) NOT NULL
```

Exact FKs:

```text
(attemptId, 'LOCAL_FILE')
  -> StorageRepresentationAttempt(id, backendKind)

(lifecycleId, 'LOCAL_FILE', storageKey)
  -> StorageObjectLifecycle(id, storageBackend, storageKey)
```

`StorageObjectRepresentationAttempt`:

```text
attemptId                  varchar(32) PK
bindingId                  varchar(32) NOT NULL
allocationId               varchar(32) NOT NULL
objectVersionId            varchar(32) NOT NULL
providerScopeId            varchar(32) NOT NULL
objectKey                  varchar(255) NOT NULL
```

Exact FKs:

```text
(attemptId, 'OBJECT_STORE')
  -> StorageRepresentationAttempt(id, backendKind)

(bindingId, allocationId, providerScopeId, objectKey, objectVersionId)
  -> StorageObjectBinding(
       id, allocationId, providerScopeId, objectKey, objectVersionId
     )
```

### 6.5 FileVersion Origin

`FileVersion` uses stable slots and active attempts:

```text
originSlotId               varchar(32) NOT NULL
originAttemptId            varchar(32) NOT NULL
originBackendKind          LOCAL_FILE | OBJECT_STORE
storageOrigin              LEGACY_LOCAL | UPLOAD_V2 | MIGRATED_V2
```

Exact FK:

```text
(originSlotId, originAttemptId, originBackendKind)
  -> StorageRepresentationAttempt(
       slotId, id, backendKind
     )
```

No second ORIGIN slot is legal. A retry changes the active attempt for the same
slot; it does not fabricate a new FileVersion.

## 7. Integrity Incident and Quarantine

### 7.1 `StorageIntegrityIncident`

```text
id                         varchar(32) PK
incidentType               PROVIDER_VERSION_MISSING |
                           VERSION_ID_MISMATCH |
                           CHECKSUM_MISMATCH |
                           UNEXPECTED_REPLACEMENT |
                           AUDIT_CONTRADICTION |
                           INCOMPLETE_AUDIT |
                           SCOPE_ENDPOINT_MISMATCH |
                           OBJECT_UNREADABLE |
                           READBACK_POSTCHECK_FAILED
fileVersionId              varchar(32) NOT NULL
representationAttemptId    varchar(32) NULL
providerScopeId            varchar(32) NULL
objectVersionId            varchar(32) NULL
localLifecycleId           varchar(32) NULL
detectionSource            PROVIDER_AUDIT | VERIFIER | READ |
                           CLEANUP | MIGRATION | ROLLBACK | OPERATOR
severity                   WARNING | HIGH | CRITICAL
state                      OPEN | CONTAINED | REVIEW | RELEASED | REJECTED
summaryDigest              char(64) NOT NULL
detectedAt                 timestamptz(6) NOT NULL
containedAt                timestamptz(6) NULL
closedAt                   timestamptz(6) NULL
```

Exact target rules:

```text
OBJECT_STORE incident:
  providerScopeId/provider evidence/objectVersion identity required

LOCAL_FILE incident:
  local lifecycle/exact local evidence required

Exactly one or more target representations may be affected through
StorageIntegrityIncidentTarget.
```

### 7.2 `StorageIntegrityIncidentTarget`

```text
incidentId
representationAttemptId
bindingId NULL
objectVersionId NULL
localLifecycleId NULL
PRIMARY KEY(incidentId, representationAttemptId)
```

### 7.3 `StorageRepresentationQuarantine`

```text
id
representationAttemptId
incidentId
state ACTIVE | RELEASED | REJECTED
quarantineEpoch
createdAt
releasedAt
```

Constraints:

```text
UNIQUE(representationAttemptId) WHERE state='ACTIVE'
UNIQUE(incidentId, representationAttemptId)
```

An ACTIVE quarantine excludes the exact representation from:

```text
new read selection
new read lease issuance
cleanup target eligibility
rollback copy source
migration acceptance
representation activation
```

### 7.4 Read Guard

`StorageReadLease`:

```text
id
fileVersionId
representationAttemptId
routeEpoch
quarantineEpochSnapshot
state OPEN | CLOSED | REVOKED
openedAt
closedAt
```

Rules:

```text
read issuance locks representation slot and checks no ACTIVE quarantine
incident containment increments representation quarantine epoch
new reads fail closed
an already-open stream is checked at each bounded 1 MiB chunk or 5-second
  interval
quarantine change aborts the stream if the runtime supports cancellation
otherwise the lease is marked REVOKED and the interruption is audited
no automatic fallback is selected
```

### 7.5 Incident/Quarantine Transaction

```text
BEGIN
  acquire sorted key locks
  lock representation attempts and active read leases
  INSERT incident + targets + typed Incident Evidence
  INSERT ACTIVE quarantine rows
  increment each target's quarantine epoch
  revoke current read leases
  block cleanup references
COMMIT
```

If the detector cannot persist the incident because DB is unavailable:

```text
affected workload enters INTEGRITY_UNCONFIRMED
new reads/writes/cleanup for its objects are blocked
alert is emitted
same incident retry continues
```

No incident is silently dropped.

### 7.6 Release

Release requires:

```text
independent verifier identity
new exact readback of the exact object
Provider evidence consistent with scope/endpoint/version
no active retention/cleanup investigation
new QuarantineReleaseEvidence
```

Release returns the representation to `VERIFIED`/`ACTIVE` only through the
Finalizer/Representation function. An unreviewed fallback is not selected.

## 8. Typed Evidence Engine

### 8.1 Common Evidence Base

`StorageLifecycleEvidence`:

```text
id                         varchar(32) PK
schemaVersion              integer NOT NULL DEFAULT 1
evidenceType               EvidenceType NOT NULL
operationId                varchar(32) NOT NULL
providerEffectId           varchar(32) NULL
uploadActionId             varchar(32) NULL
representationAttemptId    varchar(32) NULL
incidentId                 varchar(32) NULL
authorityClaimId           varchar(32) NOT NULL
authoritySessionId         varchar(32) NOT NULL
producerWorkloadId         varchar(64) NOT NULL
producerDbRole             varchar(63) NOT NULL
producerPurpose            varchar(64) NOT NULL
requestNonce               varchar(100) NOT NULL
objectVersionId            varchar(32) NULL
canonicalizerVersion       varchar(32) NOT NULL
canonicalPayloadDigest     char(64) NOT NULL
observedAt                 timestamptz(6) NOT NULL
createdAt                  timestamptz(6) NOT NULL
```

Constraints:

```text
UNIQUE(id, evidenceType)
UNIQUE(id, evidenceType, operationId, objectVersionId)
UNIQUE(operationId, evidenceType, requestNonce)
```

Exact producer FKs:

```text
(authoritySessionId, producerWorkloadId, producerDbRole, operationId)
  -> StorageOperationAuthoritySession(
       id, workloadId, dbRole, operationId
     )

(authorityClaimId, operationId, authoritySessionId)
  -> StorageOperationAuthorityClaim(
       id, operationId, sessionId
     )
```

Every subtype has:

```text
PRIMARY KEY(evidenceId)
(evidenceId, discriminator)
  -> StorageLifecycleEvidence(id, evidenceType)
UNIQUE(evidenceId, discriminator, operationId, objectVersionId)
```

### 8.2 Complete Subtype Contracts

#### `StorageAuthorizationEvidence`

```text
evidenceId                 PK/FK
discriminator              AUTHORIZATION
authorizedOperationType
authorityClaimId
authorityGeneration
authorityStateSnapshot
ownerTokenDigest
leaseExpiresAt
trustRootEpoch
revocationEpoch
routingEpoch
```

Purpose: prove DB authorization existed at a time. It does not prove Provider
activity.

#### `StorageProviderOperationEvidence`

```text
evidenceId
discriminator              PROVIDER_OPERATION
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

Exactly one of `publisherAttemptId`/`uploadActionId` is non-null.

#### `StorageProviderOutcomeEvidence`

```text
evidenceId
discriminator              PROVIDER_OUTCOME
providerEffectId
requestId
normalizedResult
providerStatusCode
providerVersionToken NULL
providerGeneration NULL
resultObjectVersionId NULL
responseDigest
```

#### `StorageReadbackEvidence`

```text
evidenceId
discriminator              READBACK_VERIFIED
providerEffectId NULL
representationAttemptId NULL
providerScopeId NULL
endpointBindingId NULL
objectKey NULL
objectVersionId NOT NULL
providerVersionToken
providerGeneration NULL
sizeBytes
checksumSha256
readbackRequestId
readStartedAt
readCompletedAt
```

#### `StorageUploadActionEvidence`

```text
evidenceId
discriminator              UPLOAD_ACTION
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

#### `StorageMigrationCopyEvidence`

```text
evidenceId
discriminator              MIGRATION_COPY_RESULT
migrationRecordId
sourceRepresentationAttemptId
targetRepresentationAttemptId
targetAllocationId
bindingId
targetObjectVersionId
copyRequestId
```

#### `StorageMigrationReadbackEvidence`

```text
evidenceId
discriminator              MIGRATION_READBACK
migrationRecordId
sourceRepresentationAttemptId
targetRepresentationAttemptId
sourceSizeBytes
sourceChecksumSha256
targetSizeBytes
targetChecksumSha256
verifierReadbackRequestId
```

#### `StorageRepresentationEvidence`

```text
evidenceId
discriminator              REPRESENTATION
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

#### `StorageDeleteResultEvidence`

```text
evidenceId
discriminator              DELETE_RESULT
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

#### `StorageDeleteReadbackEvidence`

```text
evidenceId
discriminator              DELETE_READBACK
destructiveTargetId
exactObjectVersionId NULL
localLifecycleId NULL
absenceVerified
retentionLockObserved
deleteMarkerObserved
observedAt
```

#### `StorageProviderAuditEvidence`

```text
evidenceId
discriminator              PROVIDER_AUDIT_EVENT
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

#### `StorageManifestRevocationEvidence`

```text
evidenceId
discriminator              MANIFEST_REVOCATION
revocationRecordId
manifestId NULL
revokedKeyId NULL
revocationEpoch
rootVersionId
gateWorkloadId
effectiveAt
```

#### `StorageIntegrityIncidentEvidence`

```text
evidenceId
discriminator              INTEGRITY_INCIDENT
incidentId
detectionSource
detectedRepresentationAttemptId NULL
observedProviderVersionId NULL
observedSizeBytes NULL
observedChecksumSha256 NULL
observationDigest
```

#### `StorageQuarantineReleaseEvidence`

```text
evidenceId
discriminator              QUARANTINE_RELEASE
incidentId
representationAttemptId
independentReadbackEvidenceId
verifierWorkloadId
decision
```

### 8.3 Nullability Matrix

| Subtype | Nullable fields and reason |
|---|---|
| AuthorizationEvidence | Provider fields absent; authorization is DB-only |
| ProviderOperationEvidence | exactly one of attempt/action; request ID absent before response |
| ProviderOutcomeEvidence | version fields absent for no-effect/error outcomes |
| ReadbackEvidence | representation/effect optional because read can be pre-binding |
| UploadActionEvidence | provider upload ID absent only for CREATE before response |
| MigrationCopyEvidence | all fields non-null |
| MigrationReadbackEvidence | all fields non-null |
| RepresentationEvidence | exactly one target family non-null |
| DeleteResultEvidence | backend-specific target fields mutually exclusive |
| DeleteReadbackEvidence | backend-specific target fields mutually exclusive |
| ProviderAuditEvidence | object fields absent for control-plane-only events |
| ManifestRevocationEvidence | exactly one of manifest/key non-null |
| IncidentEvidence | observed object fields depend on incident type |
| ReleaseEvidence | all fields non-null |

### 8.4 Canonical Payload Digest

Canonicalizer:

```text
name: aic-elevator/storage-evidence-canonical
version: 1
input: common evidence fields + discriminator-specific fields
domain prefix:
  UTF8("aic-elevator/storage-evidence/v1") + 0x00
```

Field encoding:

```text
fieldName = UTF-8 exact database field name
value:
  NULL       -> byte 0x00
  false      -> byte 0x10
  true       -> byte 0x11
  integer    -> 0x12 + UTF-8 decimal two's-complement-independent digits
  bigint     -> 0x13 + UTF-8 decimal digits
  text       -> 0x20 + UTF-8 length + UTF-8 bytes
  timestamp  -> 0x30 + UTF-8 UTC with exactly six fractional digits + "Z"
  bytes/hash -> 0x40 + lowercase hex
```

Payload:

```text
counted sequence of (fieldName,value) pairs
pairs sorted by fieldName UTF-8 byte order
no duplicate field names
no absent optional field; send explicit NULL
```

Digest:

```text
SHA-256(domainPrefix || encodedPairs)
```

Trusted ingestion:

```text
NOLOGIN-owned function receives typed fields
builds canonical payload
computes digest
inserts common + subtype row
callers have no direct INSERT grant
```

If the isolated database lacks a trusted SHA-256 primitive:

```text
migration/implementation is BLOCKED
no fallback to caller-supplied digest
```

Read verification:

```text
storage_verify_evidence_digest(evidenceId)
recomputes from the immutable subtype row and compares
```

Schema version:

```text
new canonicalizer/schema version for any semantic field change
old evidence remains verified with its original version
version downgrade/reinterpretation is forbidden
```

### 8.5 Evidence Append-only and Producer Checks

For every base/subtype row:

```text
UPDATE/DELETE/TRUNCATE rejected
producerDbRole = SESSION_USER at ingestion
producerWorkloadId derived from StorageWorkloadPrincipal
evidenceType independently determines allowed producer authority
a caller-supplied producer or digest is rejected
```

## 9. Authority/Recovery Transactions and Error Contract

### 9.1 Claim Operation

```sql
BEGIN;
SELECT pg_advisory_xact_lock(:storage_lock_key);
SELECT * FROM storage_object_operation
 WHERE id=:operation_id FOR UPDATE;
SELECT * FROM storage_object_lifecycle
 WHERE id=:lifecycle_id FOR UPDATE;
SELECT * FROM storage_operation_authority_claim
 WHERE id=:claim_id FOR UPDATE;

UPDATE storage_operation_authority_claim
SET state='ACTIVE'
WHERE id=:claim_id
  AND operation_id=:operation_id
  AND session_id=:session_id
  AND generation=:generation
  AND state='CLOSED'
  AND lease_expires_at > now();
-- rowcount MUST be 1

UPDATE storage_object_operation
SET active_authority_claim_id=:claim_id,
    fencing_generation=:generation,
    owner_token_digest=:owner_digest,
    lease_expires_at=:lease
WHERE id=:operation_id
  AND active_authority_claim_id IS NULL
  AND fencing_generation=:expected_generation;
-- rowcount MUST be 1
COMMIT;
```

If either update is zero:

```text
D4_CLAIM_CONFLICT / 23514
no Provider request
```

### 9.2 Effect Transition

```sql
UPDATE storage_provider_effect
SET request_state=:new_request_state,
    effect_state=:new_effect_state,
    object_version_id=:object_version,
    provider_request_id=:request_id,
    terminal_at=:terminal_at
WHERE id=:effect_id
  AND operation_id=:operation_id
  AND allocation_id=:allocation_id
  AND source_claim_id=:claim_id
  AND source_generation=:generation
  AND request_nonce=:nonce
  AND request_state=:expected_request_state
  AND effect_state=:expected_effect_state;
-- rowcount MUST be 1
```

Zero row -> `D4_EFFECT_STATE_CONFLICT`.

### 9.3 Finalizer Acceptance

```sql
BEGIN;
SELECT pg_advisory_xact_lock(sort_key)
FROM storage_operation_lock_plan
WHERE operation_id=:operation_id AND plan_state='SEALED'
ORDER BY sort_key;

SELECT * FROM storage_provider_effect
WHERE id=:effect_id FOR UPDATE; -- exact branch expected
SELECT * FROM storage_object_binding
WHERE id=:binding_id FOR UPDATE;
SELECT * FROM storage_operation_authority_claim
WHERE id=:finalizer_claim_id FOR UPDATE;

UPDATE storage_object_binding
SET state='ACCEPTED', accepted_at=now()
WHERE id=:binding_id
  AND operation_id=:operation_id
  AND object_version_id=:object_version_id
  AND state='CANDIDATE';
-- rowcount 1

INSERT INTO storage_binding_acceptance(...);
INSERT INTO storage_acceptance_evidence(... typed exact rows ...);

UPDATE storage_finalizer_attempt
SET state='COMMITTED', acceptance_id=:acceptance_id,
    file_version_id=:file_version_id
WHERE id=:finalizer_attempt_id
  AND operation_id=:operation_id
  AND authority_generation=:generation
  AND owner_token_digest=:owner_digest
  AND state IN ('CLAIMED','VERIFYING','READY_TO_COMMIT');
-- rowcount 1
COMMIT;
```

All Evidence must remain visible after rollback; a failed COMMIT cannot create
partial acceptance/FileVersion.

### 9.4 Error Contract

| Error category | SQLSTATE/class | Meaning |
|---|---|---|
| `D4_CLAIM_CONFLICT` | `23514` | authority generation/owner/lease mismatch |
| `D4_STALE_GENERATION` | `23514` | old generation attempted a new effect |
| `D4_EFFECT_STATE_CONFLICT` | `23514` | invalid effect/request state pair |
| `D4_ACTION_NONCE_MISMATCH` | `23505` | same nonce, different action/request |
| `D4_UPLOAD_ACTION_IN_PROGRESS` | `23505` / `409` app | active Complete/Abort slot |
| `D4_REPRESENTATION_CONFLICT` | `23505` | more than one current attempt |
| `D4_QUARANTINED` | `23514` / `409` app | target has active incident |
| `D4_TRUST_EPOCH_STALE` | `23514` | stale root/revocation lease |
| `D4_ROUTE_EPOCH_STALE` | `23514` | stale routing/read decision |
| `D4_ACTION_UNKNOWN` | app `409` | Provider/DB outcome unknown |
| `D4_INTEGRITY_INCIDENT` | app `409` | object must be quarantined |

Provider-specific error codes remain `PROVIDER-SPECIFIC / NOT VERIFIED`.

## 10. Complete Data Model Inventory

The tables below are the authoritative D4 model. Fields already defined in
§§4–8 retain those definitions; this section supplies the remaining
field-level D3-compatible tables and records the D4-only additions.

### 10.1 Provider Scope and Endpoint

`StorageProviderScope`:

```text
id                         varchar(32) PK
providerKind               ProviderKind NOT NULL
accountScopeRef            varchar(128) NOT NULL
namespaceResourceId        varchar(255) NOT NULL
region                     varchar(64) NOT NULL
bucketOrContainer          varchar(255) NOT NULL
namespaceIdentityDigest    char(64) NOT NULL
controlPlaneObservationId  varchar(32) NOT NULL UNIQUE
state                      ACTIVE | SUSPENDED | RETIRED
createdAt                  timestamptz(6) NOT NULL
stateChangedAt             timestamptz(6) NOT NULL
```

```text
UNIQUE(providerKind, accountScopeRef, namespaceResourceId)
UNIQUE(namespaceIdentityDigest)
UNIQUE(providerKind, accountScopeRef, region, bucketOrContainer)
UNIQUE(id, state)
```

`StorageProviderControlPlaneObservation`:

```text
id
observationNonce UNIQUE
providerKind
accountScopeRef
namespaceResourceId
region
bucketOrContainer
endpointRef
observedConfigurationDigest
capabilityManifestId
rootVersionId
revocationEpoch
collectorWorkloadId
signatureKeyId
signatureDigest
observedAt
expiresAt
state PASS | FAIL | UNKNOWN
```

`StorageProviderEndpointBinding`:

```text
id
providerScopeId
endpointRef
apiVersion
sdkVersion
capabilityManifestId
configurationEpoch
predecessorBindingId NULL
state PROVISIONING | ACTIVE | SUSPENDED | RETIRED | FAILED
verifiedAt NULL
createdAt
retiredAt NULL
```

```text
UNIQUE(id, providerScopeId)
UNIQUE(providerScopeId, configurationEpoch)
UNIQUE(providerScopeId) WHERE state='ACTIVE'
```

`StorageEndpointRotationSlot`:

```text
providerScopeId PK
activeBindingId
candidateBindingId NULL UNIQUE
rotationEpoch
state STABLE | VALIDATING | ACTIVATING | FAILED | ROLLED_BACK
updatedAt
```

```text
UNIQUE(providerScopeId) WHERE candidateBindingId IS NOT NULL
```

There can be one ACTIVE endpoint and one PROVISIONING candidate per scope.

`StorageReadBindingAttestation`:

```text
id
objectVersionId
providerScopeId
objectKey
providerVersionToken
providerGeneration NULL
fromEndpointBindingId NULL
toEndpointBindingId
readbackEvidenceId
state VERIFIED | REJECTED | SUPERSEDED
verifiedAt
```

```text
UNIQUE(objectVersionId,toEndpointBindingId)
```

Exact FKs:

```text
(objectVersionId,providerScopeId,objectKey)
  -> StorageObjectVersion(id,providerScopeId,objectKey)
(toEndpointBindingId,providerScopeId)
  -> StorageProviderEndpointBinding(id,providerScopeId)
(readbackEvidenceId,'READBACK_VERIFIED',objectVersionId)
  -> StorageReadbackEvidence(evidenceId,evidenceType,objectVersionId)
```

The historical observation endpoint is never rewritten.

### 10.2 Workload and Session

`StorageWorkloadPrincipal`:

```text
id
workloadId UNIQUE
dbLoginRole UNIQUE
workloadIdentityDigest
certificateFingerprint
state ACTIVE | SUSPENDED | REVOKED
revocationEpoch
createdAt
```

`StorageWorkloadAuthorityKind`:

```text
workloadId
authorityKind
PRIMARY KEY(workloadId,authorityKind)
```

`StorageOperationAuthorityPermission`:

```text
operationType
authorityKind
phase
PRIMARY KEY(operationType,authorityKind)
```

The table is immutable, provisioned only by a controlled schema migration, and
is referenced by every AuthorityClaim.

`StorageOperationAuthoritySession`:

```text
id
workloadId
dbRole
operationId
sessionNonce UNIQUE
state ACTIVE | REVOKED | EXPIRED | CONSUMED
issuedAt
expiresAt
revocationEpochSnapshot
```

```text
UNIQUE(id, operationId)
UNIQUE(id, workloadId, dbRole, operationId)
```

Principal/session FK:

```text
(workloadId, dbRole)
  -> StorageWorkloadPrincipal(workloadId, dbLoginRole)
```

The issuance function compares the session snapshot with the current
revocation epoch.

### 10.3 Lifecycle and Operation

`StorageObjectLifecycle`:

```text
id
objectKind STAGING | CANONICAL
storageBackend LOCAL_FILE | OBJECT_STORE
storageKey
providerScopeId NULL
state
reservedAttemptId NULL
reservedIntentId NULL
currentOperationId NULL
activeAuthorityClaimId NULL
ownerTokenDigest NULL
fencingGeneration
leaseExpiresAt NULL
closeEvidenceId NULL
sizeBytes NULL
checksumSha256 NULL
createdAt
updatedAt
```

`StorageObjectOperation`:

```text
id
objectLifecycleId
storageKey
namespaceKind STAGING | CANONICAL
storageBackend
providerScopeId NULL
endpointBindingId NULL
capabilityLeaseId NULL
trustRootEpoch NULL
manifestRevocationEpoch NULL
routingEpoch
operationType
state
sourceAttemptId NULL
sourceUploadSessionId NULL
sourceRepresentationId NULL
targetRepresentationId NULL
activeAuthorityClaimId NULL
ownerTokenDigest NULL
fencingGeneration
leaseExpiresAt NULL
sourcePath NULL
targetPath NULL
quarantinePath NULL
expectedSizeBytes NULL
expectedChecksumSha256 NULL
lastErrorCode NULL
```

Unique anchors:

```text
UNIQUE(id, operationType)
UNIQUE(id, objectLifecycleId, storageKey, namespaceKind)
UNIQUE(id, providerScopeId, objectLifecycleId, storageKey, namespaceKind)
UNIQUE(id, operationType, routingEpoch)
UNIQUE(id, storageBackend)
```

### 10.4 Key Allocation and Custody

`StorageObjectKeyAllocation`:

```text
id
providerScopeId
namespaceIdentityDigest
operationId
operationGeneration
lifecycleId
namespaceKind
objectKey
keyNonce
state RESERVED | PROVIDER_EFFECT_STARTED | BOUND | CONFLICT | RETIRED
boundAt NULL
retiredAt NULL
createdAt
```

```text
UNIQUE(providerScopeId,objectKey)
UNIQUE(operationId)
UNIQUE(id,operationId,objectKey)
UNIQUE(id,providerScopeId,objectKey)
UNIQUE(id,operationId,providerScopeId,lifecycleId,objectKey)
UNIQUE(id,namespaceKind,lifecycleId,objectKey)
```

`StorageAllocationCustody`:

```text
id
allocationId
operationId
authorityClaimId
generation
ownerTokenDigest
state ACTIVE | RELEASED | SUPERSEDED | RETIRED | REVOKED | FAILED_RETAINED
leaseExpiresAt
providerMutationStartedAt NULL
createdAt
endedAt NULL
```

```text
UNIQUE(allocationId) WHERE state='ACTIVE'
UNIQUE(allocationId,generation)
```

Custody transition matrix:

| From | To | Condition |
|---|---|---|
| `ACTIVE` | `RELEASED` | owner explicitly closes before mutation |
| `ACTIVE` | `SUPERSEDED` | takeover transaction after lease expiry |
| `ACTIVE` | `REVOKED` | workload/session revocation |
| `ACTIVE` | `FAILED_RETAINED` | provider mutation state ambiguous |
| `SUPERSEDED` | terminal | immutable history |
| `RELEASED` | terminal | immutable history |
| `REVOKED` | terminal | immutable history |
| `FAILED_RETAINED` | terminal | immutable history |

`custody.ownerTokenDigest` must equal the referenced
`AuthorityClaim.ownerTokenDigest`; a deferred trigger rejects mismatch.

### 10.5 Upload Session and Actions

`StorageProviderUploadSession`:

```text
id
stagingOperationId
allocationId
authorityClaimId
authorityGeneration
ownerTokenDigest
providerScopeId
endpointBindingId
capabilityLeaseId
objectKey
initiationNonce UNIQUE
providerUploadId NULL UNIQUE(providerScopeId,providerUploadId)
state INITIATING | OPEN | COMPLETING | COMPLETED | ABORTING |
      ABORTED | INITIATION_UNKNOWN | COMPLETION_UNKNOWN |
      ABORT_UNKNOWN | EXPIRED | FAILED_RETAINED
expectedSizeBytes
expectedChecksumSha256
sessionGeneration
leaseExpiresAt
completedObjectVersionId NULL
providerRequestId NULL
createdAt
startedAt NULL
completedAt NULL
abortedAt NULL
```

Constraints:

```text
UNIQUE(id, stagingOperationId, sessionGeneration)
UNIQUE(id, stagingOperationId, allocationId)
UNIQUE(allocationId, sessionGeneration)
UNIQUE(stagingOperationId) WHERE state IN
  ('INITIATING','OPEN','COMPLETING','ABORTING','INITIATION_UNKNOWN',
   'COMPLETION_UNKNOWN','ABORT_UNKNOWN')
```

`StorageUploadPartCheckpoint` and upload actions/results are defined in §5.

### 10.6 Provider Versions and Binding

`StorageObjectVersion`:

```text
id
allocationId
providerScopeId
objectKey
observedEndpointBindingId
sourceOperationId
sourceUploadSessionId NULL
sourcePublisherAttemptId NULL
versionIdentityScheme GENERATION_REQUIRED | VERSION_TOKEN_ONLY
providerVersionToken
providerGeneration NULL
providerETag
sizeBytes
checksumSha256
state OBSERVED | VERIFIED | REJECTED | QUARANTINED | DELETED
firstObservedAt
```

`StorageObjectBinding`:

```text
id
allocationId
operationId
providerScopeId
endpointBindingId
objectKey
objectVersionId
sourceAuthorityClaimId
sourceAuthorityGeneration
sourcePublisherAttemptId NULL
sourcePublisherGeneration NULL
state CANDIDATE | ACCEPTED | REJECTED | QUARANTINED
acceptedAt NULL
acceptanceId NULL UNIQUE
createdAt
```

Exact composite FKs from D3 §10.2 apply, with the source attempt/generation
pair allowing a stale exact-object source under current Finalizer acceptance.

`StoragePublisherAttempt`:

```text
id
operationId
allocationId
providerScopeId
objectKey
authorityClaimId
authorityGeneration
attemptKind PUBLISH | MIGRATION_COPY
providerEffectId
attemptState CLAIMED | REQUEST_SENT | CLOSED | SUPERSEDED | REVOKED
createdAt
```

`StorageFinalizerAttempt`:

```text
id
operationId
authorityClaimId
authorityGeneration
ownerTokenDigest
state CLAIMED | VERIFYING | READY_TO_COMMIT | COMMITTED |
      UNKNOWN | SUPERSEDED | FAILED_RETAINED
candidateBindingId
acceptanceMode NORMAL_UPLOAD | RESPONSE_LOSS_RECOVERY | MIGRATION
acceptanceId NULL
fileVersionId NULL
leaseExpiresAt
idempotencyKey UNIQUE
```

### 10.7 Representation

The authoritative D4 model is `StorageRepresentationSlot` +
`StorageRepresentationAttempt` from §6. It replaces D3's single representation
row per role. Existing failed attempts remain retained and a new generation may
be inserted for the same slot.

### 10.8 Migration Locks and Source Slot

`StorageMigrationSourceSlot`:

```text
id
sourceFileVersionId
sourceRepresentationSlotId
currentRecordId NULL UNIQUE
state OPEN | CLAIMED | COMPLETED | FAILED_RETAINED
createdAt
```

```text
UNIQUE(sourceFileVersionId, sourceRepresentationSlotId)
```

`StorageMigrationBatch`:

```text
id
batchRequestKey UNIQUE
sourceBackend
targetProviderScopeId
manifestDigest
state INVENTORYING | INVENTORY_COMPLETE | COPYING | VERIFYING |
      READY_FOR_CUTOVER | CUTOVER | COMPLETE | FAILED_RETAINED |
      ROLLED_BACK
createdAt
updatedAt
```

`StorageMigrationRecord`:

```text
id
batchId
sourceSlotId UNIQUE
sourceFileVersionId
sourceRepresentationAttemptId
sourceRepresentationSlotId
sourceSizeBytes
sourceChecksumSha256
sourceRevalidationAt NULL
targetProviderScopeId
targetEndpointBindingId
targetObjectKey
targetAllocationId NULL
targetObjectVersionId NULL
targetRepresentationAttemptId NULL
bindingId NULL
importOperationId NULL
state
ownerClaimId NULL
ownerTokenDigest NULL
generation
leaseExpiresAt NULL
checkpoint
checkpointAt
idempotencyKey UNIQUE
safeErrorCode NULL
createdAt
updatedAt
```

`StorageMigrationAttempt`:

```text
id
migrationRecordId
authorityClaimId
generation
ownerTokenDigest
state CLAIMED | COPYING | VERIFYING | UNKNOWN |
      SUCCEEDED | FAILED_RETAINED
leaseExpiresAt
startedAt
terminalAt NULL
```

```text
UNIQUE(migrationRecordId,generation)
UNIQUE(migrationRecordId) WHERE state IN ('CLAIMED','COPYING','VERIFYING')
```

All target fields must be filled together or remain absent. The source slot's
unique key prevents two batches from promoting different sources as the same
valid historical origin.

### 10.9 Lock Plans

`StorageOperationLockPlan`:

```text
id
operationId
planVersion
state BUILDING | SEALED
createdAt
sealedAt NULL
```

`StorageOperationLockKey`:

```text
planId
sortKey char(64)
advisoryKey char(64)
lockDomain PROVIDER | LOCAL
providerScopeId NULL
objectKey NULL
localLifecycleId NULL
PRIMARY KEY(planId,sortKey)
```

Lock key derivation is defined in §15.

### 10.10 Capability Trust

`StorageTrustRootVersion`:

```text
id
keyId UNIQUE
publicKeyFingerprint
rootEpoch
notBefore
notAfter
state ACTIVE | DEPRECATED | REVOKED
predecessorRootVersionId NULL
successorRootVersionId NULL
signatureEvidenceId
createdAt
```

`StorageTrustEpochState`:

```text
singletonId PK
activeRootSetEpoch
manifestRevocationEpoch
updatedAt
auditId
```

`StorageTrustEpochRoot`:

```text
rootSetEpoch
rootVersionId
trustStateDuringEpoch
PRIMARY KEY(rootSetEpoch,rootVersionId)
```

`StorageCapabilityManifest`:

```text
id
manifestVersion
rootVersionId
issuerKeyId
signature
providerKind
apiVersion
sdkVersion
scopeDigest
endpointBindingDigest
configurationPredicatesDigest
testEvidenceBundleDigest
assertionLevel
issuedAt
expiresAt
```

`StorageCapabilityManifestOperation`:

```text
manifestId
operationType
supportState SUPPORTED | UNSUPPORTED | NOT_TESTED
apiName
requestConstraintsDigest
responseParserVersion
requiredProviderVersionScheme
PRIMARY KEY(manifestId,operationType)
```

`StorageManifestRevocation`:

```text
id
manifestId NULL
keyId NULL
revocationEpoch
effectiveAt
reason
signatureEvidenceId
ingestedByCapabilityGateId
createdAt
CHECK num_nonnulls(manifestId,keyId)=1
```

`StorageCapabilityObservation`:

```text
id
manifestId
endpointBindingId
rootVersionId
rootSetEpoch
revocationEpoch
observedConfigurationDigest
probeEvidenceId
state PASS | FAIL | UNKNOWN
observedAt
expiresAt
ingestedByCapabilityGateId
canonicalDigest
```

`StorageCapabilityLease`:

```text
id
manifestId
endpointBindingId
observationId
trustRootVersionId
rootSetEpoch
revocationEpoch
configurationDigest
state ACTIVE | SUSPENDED | EXPIRED | REVOKED
issuedAt
expiresAt
```

`StorageCapabilityLeaseOperation`:

```text
leaseId
operationType
PRIMARY KEY(leaseId,operationType)
```

Manifest operation rows are inserted only by the Capability Gate function.
Lease-operation rows are copied only from the verified manifest operation set.

### 10.11 Cleanup and Quarantine

`StorageDestructiveOperationTarget`:

```text
id
operationId UNIQUE
backendKind
targetRepresentationAttemptId
targetProviderScopeId NULL
targetEndpointBindingId NULL
targetObjectVersionId NULL
targetLocalLifecycleId NULL
expectedLifecycleState
originalCreationOperationId
cleanupAuthorizationDecisionId
expectedSizeBytes
expectedChecksumSha256
createdAt
```

Backend checks:

```text
OBJECT_STORE:
  providerScopeId/endpointBindingId/objectVersionId NOT NULL
  localLifecycleId NULL

LOCAL_FILE:
  localLifecycleId NOT NULL
  Provider target fields NULL
```

`StorageCleanupAttempt`:

```text
id
destructiveTargetId
operationId
authorityClaimId
generation
ownerTokenDigest
leaseExpiresAt
state CLAIMED | EXECUTING | APPLIED | UNKNOWN | FAILED_RETAINED
providerEffectId NULL
startedAt
terminalAt NULL
```

```text
UNIQUE(operationId) WHERE state IN ('CLAIMED','EXECUTING')
UNIQUE(destructiveTargetId,generation)
```

The target must reference an exact representation attempt/object version or
local lifecycle, never a role or key alone.

### 10.12 Global Table Constraint Matrix

`NN` = NOT NULL at insert unless a state-specific rule permits a later
one-way fill.

| Table | Nullable fields | Unique anchors | Required CHECK/FK |
|---|---|---|---|
| ProviderScope | none | resource id, namespace digest, bucket tuple | immutable identity; state transition; observation FK |
| ControlPlaneObservation | none | nonce | root FK; expiry; one-use |
| EndpointBinding | `predecessorBindingId`, `verifiedAt`, `retiredAt` | scope+epoch; ACTIVE per scope | configuration/observation state |
| EndpointRotationSlot | `candidateBindingId` | candidate singleton | active/candidate belong same scope |
| WorkloadPrincipal | none | workloadId, role | state/revocation epoch |
| WorkloadAuthorityKind | none | workloadId+kind | principal FK |
| AuthoritySession | none | nonce, id+operation tuple | principal/session-user and expiry |
| AuthorityClaim | `providerMutationStartedAt`, `endedAt` | op+generation, one ACTIVE | session/operation/type/authority-kind FKs |
| ObjectLifecycle | owner/current/close/content fields per state | key; id+backend+key | namespace/backend/state/close |
| ObjectOperation | backend and target fields per type | id+operationType and composite anchors | lifecycle/key/namespace/type |
| KeyAllocation | `boundAt`, `retiredAt` | scope+key; operationId | operation/lifecycle/namespace |
| AllocationCustody | `providerMutationStartedAt`, `endedAt` | one ACTIVE; allocation+generation | claim/owner digest/generation |
| UploadSession | `providerUploadId`, completion/result/request IDs | allocation+generation; provider ID | operation/allocation/key/state |
| UploadAction | `providerUploadId`, `partNumber`, `terminalAt` | actionType+nonce; action id triple | session/claim/scope/endpoint |
| UploadActionResult | `providerRequestId`, `httpStatus`, version/error fields | action+attempt; evidence unique | action/evidence/claim |
| UploadActionSlot | `activeActionId` | session PK; active action unique | one active Complete/Abort |
| UploadPartCheckpoint | all NN | session+part | session generation/claim |
| ObjectVersion | `providerGeneration`, source session/attempt | scope+key+token | exact scheme; allocation/endpoint |
| PublisherAttempt | source/effect depending kind | attempt id+operation+generation | effect/allocation/claim |
| FinalizerAttempt | acceptance/fileVersion before terminal | operation+generation; one active | one mode/current claim |
| ObjectBinding | publisher source fields for migration | objectVersion; one ACCEPTED per allocation | exact allocation/version/evidence |
| BindingAcceptance | audit fields when optional | bindingId; finalizer/idempotency | mode-specific evidence |
| AcceptanceEvidence | none for required tuples | acceptance+role; evidence unique | exact evidence role/type/object |
| EvidenceBase | subtype-specific optional refs | operation+type+nonce | producer/session/claim/digest |
| EvidenceSubtype | type-specific NULL matrix §8.3 | evidenceId+discriminator | subtype/base exact FK |
| StagingCloseEvidence | backend-specific fields | lifecycle+backend | typed close/attempt/operation |
| RepresentationSlot | `activeAttemptId` | fileVersion+role; active attempt unique | backend/role |
| RepresentationAttempt | verified/superseded/failed timestamps | slot+generation; one current | target subtype/backend/operation |
| FileVersion | origin-specific chain fields | origin slot/attempt; storage key | representation/content/origin matrix |
| MigrationSourceSlot | `currentRecordId` | source fileversion+representation slot | one record |
| MigrationBatch | none | request key | state |
| MigrationRecord | target/owner/checkpoint fields before fill | source slot, idempotency key | exact source/target/lease |
| MigrationAttempt | `terminalAt` | record+generation; one active | authority/lease |
| RoutingState | none | singleton | epoch/mode flags |
| LockPlan | `sealedAt` | operation+plan version | SEALED immutability |
| LockKey | provider/local target fields by domain | plan+sortKey | one domain target family |
| TrustRootVersion | predecessor/successor | keyId/rootEpoch | root lifecycle |
| TrustEpochState | none | singleton | monotonic epoch CAS |
| TrustEpochRoot | none | epoch+root | root FK |
| CapabilityManifest | none | manifest id/version | root/signature/expiry |
| CapabilityManifestOperation | none | manifest+operation | operation allowlist |
| ManifestRevocation | `manifestId`,`keyId` one null | revocation epoch | exactly one target |
| CapabilityObservation | none | id; gate+time | root/revocation/endpoint |
| CapabilityLease | none | active per endpoint | manifest/observation/epoch |
| CapabilityLeaseOperation | none | lease+operation | lease FK |
| DestructiveTarget | backend fields mutually exclusive | operationId | exact representation/version |
| CleanupAttempt | `providerEffectId`, `terminalAt` | operation active; target+generation | owner/claim |
| IntegrityIncident | target fields by type | incident id | target identity/state |
| IncidentTarget | exact target fields by backend | incident+representation | representation FK |
| RepresentationQuarantine | `releasedAt` | active quarantine per representation | incident+representation |
| ReadLease | `closedAt` | id | route/quarantine epoch |

All tables also require append-only/delete/truncate guards where §8.5 or §7
states them.

## 11. Sealed Lock Plans

### 11.1 Key Snapshot Before Locking

No operation may acquire one key and later discover another.

Before a lockable operation:

1. Resolve immutable source representation(s).
2. Resolve target lifecycle/key from existing state or a prepared reservation.
3. Build a complete `StorageOperationLockPlan`.
4. Seal the plan.
5. Acquire every key in sorted order.

All candidate keys are derived from:

```text
Operation.sourceRepresentationId
Operation.targetRepresentationId
MigrationRecord.sourceRepresentationId
MigrationRecord.targetAllocationId
DestructiveTarget exact target
RoutingState/rollback inventory
```

No caller-provided raw key list is trusted.

### 11.2 Lock Plan Seal

`storage_seal_operation_lock_plan(operationId, expectedPlanVersion)`:

```text
lock Operation FOR UPDATE
verify plan state BUILDING
verify planVersion expected
derive canonical key list
reject duplicate (lockDomain,scope,key)
verify all source/target representations exist
verify no Provider effect has started unless the plan represents that effect
INSERT/verify all StorageOperationLockKey rows
UPDATE plan SET state='SEALED', sealedAt=now()
rowcount MUST be 1
```

No key can be inserted after state SEALED.

If an operation discovers a new target key after seal:

```text
abort current operation
no Provider mutation
create a new Operation and new plan
```

### 11.3 Lock Key

```text
providerBytes =
  UTF8("provider") || 0x00 ||
  UTF8(providerScopeId) || 0x00 ||
  UTF8(objectKey)

localBytes =
  UTF8("local") || 0x00 ||
  UTF8(localLifecycleId) || 0x00 ||
  UTF8(storageKey)

sortKey = lowercase(SHA-256(bytes))
advisoryKey = first 8 bytes of SHA-256("storage-lock-v1" || 0x00 || bytes)
```

Hash collision causes extra serialization only; it cannot authorize access.

### 11.4 Acquisition

```sql
BEGIN;
SELECT state, planVersion
FROM storage_operation_lock_plan
WHERE operationId=:operation_id;

-- state MUST be SEALED; planVersion MUST equal expected
SELECT sortKey, advisoryKey
FROM storage_operation_lock_key
WHERE planId=:plan_id
ORDER BY sortKey;

-- acquire pg_advisory_xact_lock(advisoryKey) in returned order

SELECT state, planVersion
FROM storage_operation_lock_plan
WHERE operationId=:operation_id;
-- must still be SEALED with same planVersion
```

Then acquire row locks in D4 order:

```text
Operation
Lifecycle
AuthorityClaim
Allocation/Custody
UploadSession/Action/Attempt
ObjectVersion/Binding/Acceptance/Evidence
FileVersion
RepresentationSlot/Attempt
File
Migration/Rollback/Incident/Quarantine
```

No Provider network call is made inside this transaction.

### 11.5 Transaction Retry

Only transient SQLSTATE `40001`/`40P01` may be retried.

A retry re-performs:

```text
planVersion read
current claim/generation/lease check
effect/action state check
routing/trust/revocation epoch check
```

It never reuses stale in-memory authority.

### 11.6 Three-key Test Obligation

The test suite must include:

```text
W1 keys K1,K3
W2 keys K2,K1
W3 keys K3,K2
```

All must acquire sorted `[K1,K2]`, `[K1,K2]`, `[K2,K3]`; no provider side
effect occurs before a successful claim/lock plan.

## 12. Endpoint Rotation and Migration Source Uniqueness

### 12.1 Endpoint Rotation

`StorageEndpointRotationSlot` has exactly:

```text
activeBindingId
candidateBindingId NULL
```

Rules:

```text
one ACTIVE endpoint per scope
one candidate endpoint per scope
candidate must reference a PASS observation and current capability lease
activation CAS increments rotationEpoch
old active becomes RETIRED only after candidate activation transaction
old operations retain old binding and historical Evidence
new operations use new active binding
historical reads use ReadBindingAttestation
```

Failure transition:

```text
VALIDATING -> FAILED
```

The failed candidate is retained and `candidateBindingId` is cleared only by
the same transaction; a new candidate gets a higher configuration epoch.

### 12.2 Migration Source Slot

Each `(sourceFileVersionId, sourceRepresentationSlotId)` has one
`StorageMigrationSourceSlot`.

Only one current MigrationRecord can be bound:

```text
UNIQUE(sourceFileVersionId, sourceRepresentationSlotId)
UNIQUE(currentRecordId) WHERE currentRecordId IS NOT NULL
```

Two workers:

```text
W1 claims source slot and inserts record
W2 attempts same source -> unique violation / D4_MIGRATION_SOURCE_CONFLICT
```

A failed record does not erase source history. A retry either reuses the same
record with a higher record generation or creates a replacement only after the
source slot transitions to `OPEN`.

## 13. Provider Call / Transaction Boundaries

### 13.1 Forbidden Pattern

```text
BEGIN
hold advisory + row locks
wait for Provider network
COMMIT
```

This is forbidden because Provider latency can exceed DB timeouts and a late
response cannot be classified while the transaction is open.

### 13.2 Required Pattern

```text
TX1:
  claim/validate authority
  create effect/action PREPARED
  seal lock plan
  commit

TX2:
  CAS action/effect to DISPATCHED/IN_FLIGHT
  record dispatch nonce/request digest
  commit

PROVIDER CALL:
  outside DB transaction and advisory locks
  bounded deadline and idempotency nonce

TX3:
  ingest Provider evidence
  CAS effect/action to terminal/unknown
  update custody/session
  commit
```

Crash windows:

| Crash point | Required recovery |
|---|---|
| Before TX2 commit | No Provider call; safe retry same action |
| After TX2 before call | Provider may not receive; reconcile, keep UNKNOWN until proven |
| During call | New connection sees DISPATCHED; exact reconcile |
| After Provider success before TX3 | Provider effect exists; TX3 retry records exact version |
| After TX3 before client response | Client retries same action nonce and reads durable result |
| DB unavailable | Fail closed; no cleanup/delete; Provider objects retained |

### 13.3 Response-loss State Changes

```text
IN_FLIGHT -> RESPONSE_UNKNOWN
```

No Provider result is inferred from a socket error.

For object versions, Provider reconciliation must produce:

```text
exact version token/generation
scope/key/endpoint match
request/action metadata match
size/hash or a reason not to infer
```

If an exact candidate is found:

```text
effect = EXACT_OBSERVED
```

If exact readback succeeds:

```text
effect = CONTENT_VERIFIED
```

If wrong content is found:

```text
effect = WRONG_CONTENT / conflict
```

If nothing is provable:

```text
effect = FAILED_RETAINED or IN_FLIGHT/UNKNOWN
```

## 14. Rollback, Representation and Migration Transaction Rules

### 14.1 Representation Activation

```text
BEGIN
acquire lock plan
lock RepresentationSlot/Attempt
verify attempt state CANDIDATE
verify exact target object/local lifecycle
verify target size/hash and evidence
verify no active quarantine
update attempt VERIFIED -> ACTIVE
update slot activeAttemptId
update origin slot/attempt only for ORIGIN
append AuditLog
COMMIT
```

New attempt generation:

```text
BEGIN
lock slot
verify no CANDIDATE/VERIFIED/ACTIVE attempt
INSERT attempt generation=max+1
update slot currentAttemptId
COMMIT
```

Old FAILED_RETAINED remains immutable and retained.

### 14.2 Migration Commit

```text
BEGIN
acquire lock plan
lock MigrationRecord/source slot/target representation
verify source representation hash identity
verify target object version readback
verify migration copy/readback Evidence
verify no active quarantine
activate target object representation
update source FileVersion.storageOrigin LEGACY->MIGRATED once
update MigrationRecord COMPLETE
append AuditLog
COMMIT
```

No new FileVersion is created.

### 14.3 Rollback Copy

```text
BEGIN
seal/lock source object + local target key plan
claim ROLLBACK_COPY operation
insert local target representation attempt CANDIDATE
commit
PROVIDER exact read outside DB tx
LOCAL write/close outside DB tx
TX verify local lifecycle and readback
activate representation attempt
COMMIT
```

On local failure:

```text
attempt -> FAILED_RETAINED
slot activeAttemptId -> NULL
next retry creates attempt generation+1
```

No `ROLLBACK_LEGACY` until every required FileVersion has an ACTIVE/VERIFIED
local attempt.

## 15. Capability Child-Set Validation

The Capability Gate function:

```text
storage_ingest_capability_result(bundle)
```

must atomically:

1. verify signed manifest with active root set;
2. verify manifest not revoked/expired;
3. insert manifest operation rows;
4. insert control-plane observation;
5. insert lease rows only for PASS operations;
6. set lease `rootSetEpoch` and `revocationEpoch`;
7. reject if any referenced root/key/revocation is stale.

No application role can insert a manifest-operation or lease-operation row
directly.

Revocation event:

```text
BEGIN
lock TrustEpochState
insert append-only revocation
newEpoch = oldEpoch + 1
update singleton
set all matching leases REVOKED
append AuditLog
COMMIT
```

If the newest revocation ledger cannot be fetched:

```text
Capability Gate state = UNKNOWN
all new leases deny
all new Provider effects deny
reads only through an already valid read lease and active local representation
```

## 16. Deterministic Test Fixture Protocol

### 16.1 Fixture Namespace

Every test ID gets its own namespace so no two tests share mutable rows.

For test ID `D4-X-01` or `D4-FV-01`, use prefix:

```text
D4-X-01-*
D4-FV-01-*
```

Required fixture rows:

```text
<T>-SCOPE       StorageProviderScope
<T>-E1          first endpoint binding
<T>-E2          candidate/rotated endpoint binding
<T>-UID-A       workload principal W1
<T>-UID-B       workload principal W2
<T>-S1          authority session W1
<T>-S2          authority session W2
<T>-C7          claim generation 7
<T>-C8          claim generation 8
<T>-OP          object operation
<T>-LC-STAGE    STAGING lifecycle
<T>-LC-CANON    CANONICAL lifecycle
<T>-ALLOC-S     staging allocation
<T>-ALLOC-C     canonical allocation
<T>-UP          upload session
<T>-ACT-C       COMPLETE action
<T>-ACT-A       ABORT action
<T>-VER         object version
<T>-BIND        candidate binding
<T>-FV          FileVersion
<T>-SLOT-ORIGIN representation slot
<T>-SLOT-FALLBACK representation slot
```

Fixed values:

```text
HASH-A =
  aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

HASH-B =
  bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb

HASH-WRONG =
  cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc

SIZE-A = 1048576 bytes
SIZE-WRONG = 1048577 bytes
T0 = 2026-11-25T00:00:00.000000Z
T1 = 2026-11-25T00:00:10.000000Z
T2 = 2026-11-25T00:01:00.000000Z
LEASE-TTL = 120 seconds
```

Test IDs are symbolic DB text IDs, not production secrets.

### 16.2 Step Notation

```text
BAR(name)
  two or more connections wait until all reach the barrier.

TX-BEGIN(actor)
TX-COMMIT(actor)
TX-ROLLBACK(actor)

SQL(actor, function/SQL, expected-rowcount, expected-error)

PROV(actor, operation, result/fault)
  occurs only after DISPATCHED/IN_FLIGHT is durably committed.

FAIL(point)
  injected after the named statement/provider response.

ASSERT-ABSENT(rows)
ASSERT-STATE(row, state)
ASSERT-EVIDENCE(type/count)
```

Provider-specific failures are represented by:

```text
PROVIDER-SPECIFIC / NOT VERIFIED
```

and a normalized internal result.

## 17. Deterministic 16-Race Specifications

### `D4-X-01` Two Claims

```text
Initial:
  <T>-OP exists with no active claim, generation 6
  <T>-S1 and <T>-S2 ACTIVE

Actors:
  W1 session S1, expected generation 6
  W2 session S2, expected generation 6

Order:
  W1 TX-BEGIN; SELECT Operation FOR UPDATE
  BAR(B1)
  W2 TX-BEGIN; SELECT Operation FOR UPDATE (waits)
  W1 claim generation 7: rowcount 1
  W1 TX-COMMIT
  W2 resumes; attempts generation 7/expected 6: rowcount 0
  W2 TX-ROLLBACK

Expected:
  exactly one ACTIVE C7
  no Provider effect/action
  W2 error D4_CLAIM_CONFLICT / 23514

Must be absent:
  second active claim
  Provider request
```

### `D4-X-02` Old Upload Continues After Supersession

```text
Initial:
  OP with C7/upload session U7 OPEN, lease expires at T0
  staging allocation S7/key staging/K7

Order:
  W2 claims C8 at T1
  W1 dispatches COMPLETE A7 before knowing lease loss
  PROV W1 Complete(U7) -> exact version V7
  SQL W1 record action result using C7: rowcount 0/D4_STALE_GENERATION
  W2 creates new local custody; old server-side completion is discovered

Expected:
  C7 SUPERSEDED, C8 ACTIVE
  effect V7 = LATE_EFFECT_UNCLAIMED under old key
  conflict/late Evidence exists
  no FileVersion points V7
  new attempt uses new key/session

Must be absent:
  reactivation of C7
  V7 bound to new attempt
```

### `D4-X-03` New Generation Before Old Complete

```text
Initial:
  same as X-02 except W1 COMPLETE request is still in flight

Order:
  W2 claims C8
  W2 creates different staging key/session
  W1 Complete returns success
  W1 applies exact observation to effect A7
  W2 completes and observes V8

Expected:
  V7 retained under old allocation/conflict
  V8 can become the candidate for C8
  at most one accepted binding for the new allocation

Must be absent:
  V7 overwrite
  latest-key substitution
```

### `D4-X-04` Provider Success / Response Lost / Exact Recovery

```text
Initial:
  C7 REQUEST_SENT, effect state IN_FLIGHT
  lease expires at T0

Order:
  PROV Publisher exact-key Put -> success; W1 receives socket loss
  W1 records RESPONSE_UNKNOWN
  W2 claims C8
  verifier observes exact V7 and size/HASH-A
  verifier inserts READBACK_VERIFIED
  Finalizer C8 evaluates source effect A7
  acceptance mode = RESPONSE_LOSS_RECOVERY
  finalizer transaction commits acceptance + FileVersion

Expected:
  one accepted binding for V7
  one FileVersion
  A7 remains source provenance only
  C7 never reactivated

Must be absent:
  fabricated PUBLISH_RESULT
  second FileVersion
```

### `D4-X-05` Complete Succeeds / DB Commit Lost

```text
Initial:
  upload session U OPEN; action COMPLETE A PREPARED

Order:
  TX action A -> DISPATCHED, rowcount 1, COMMIT
  PROV Complete(U) -> success V
  FAIL(after Provider response before result TX COMMIT)
  new DB connection reads A state DISPATCHED
  recovery action RECONCILE R with same action nonce/request digest
  exact version/readback

Expected:
  action A SUCCEEDED
  effect/session COMPLETED to exact V
  one action result
  one exact version

Must be absent:
  second Provider upload
  second FileVersion
```

### `D4-X-06` Complete vs Abort

```text
Initial:
  session U OPEN; action slot empty

Order:
  W1 PREPARE COMPLETE C, commit, slot points C
  BAR(B2)
  W2 PREPARE ABORT A, different nonce
  W2 action rowcount 0/D4_UPLOAD_ACTION_IN_PROGRESS
  PROV Complete once
  Complete result commits SUCCEEDED
  Abort remains absent

Expected:
  one active action slot
  session COMPLETED exact V

Must be absent:
  abort Provider call
  session terminal from both actions
```

### `D4-X-07` Readback Then New Version

```text
Initial:
  exact V1/HASH-A readback verified
  Finalizer C8 current; effect A7 observed exact

Order:
  Finalizer transaction begins and locks key K
  Provider creates V2/HASH-B before finalizer commit
  finalizer verifies V1 exact identity, not latest
  commit acceptance for V1

Expected:
  accepted version V1
  V2 recorded conflict
  reads use exact V1

Must be absent:
  V2 substituted as canonical
```

### `D4-X-08` Key Allocation Owner Loss

```text
Part A:
  allocation RESERVED with no Provider mutation
  C7 expires -> C8 claims
  C8 supersedes custody; adopts same key

Part B:
  same setup but C7 session action CREATE dispatched
  provider mutation started before C8
  C8 cannot adopt; old allocation RETIRED/PROVIDER_EFFECT_STARTED
  new recovery operation/key created

Expected:
  no two active custodies
  no stale provider mutation accepted as new authority

Must be absent:
  key reused after provider effect started
```

### `D4-X-09` Migration Crash / New Worker

```text
Initial:
  MigrationSourceSlot OPEN

Order:
  W1 claim record generation 1, copy Provider target V1
  FAIL(before checkpoint commit)
  W1 lease expires
  W2 claim same source slot generation 2
  exact target V1 observed/readback

Expected:
  one migration record/one source slot
  W1 update rowcount 0/stale
  W2 may commit TARGET_VERIFIED

Must be absent:
  second migration record
  second source representation
```

### `D4-X-10` Rollback While New FileVersion Appears

```text
Initial:
  routing OBJECT_V2_PRIMARY epoch N
  W1 has a not-yet-committed upload operation epoch N

Order:
  operator CAS routing epoch N -> ROLLBACK_FREEZE, v2Write=false
  W1 finalizer attempts epoch N: rowcount 0/D4_ROUTE_EPOCH_STALE
  inventory sees all committed FileVersions and all V2-only representations

Expected:
  no post-freeze FileVersion
  inventory/reconcile cannot complete until all active old writes drain

Must be absent:
  hidden FileVersion created after freeze
```

### `D4-X-11` Local Fallback Missing

```text
Initial:
  UPLOAD_V2 FileVersion has object ORIGIN
  no ACTIVE/VERIFIED local fallback

Order:
  operator requests ROLLBACK_LEGACY
  gate queries every FileVersion representation
  local fallback count = 0

Expected:
  transition rowcount 0
  state ROLLBACK_FAILED_RETAINED
  object remains readable only under approved freeze/dual-read policy

Must be absent:
  local-only routing
```

### `D4-X-12` Capability Revoked During Lease

```text
Initial:
  C7 effect IN_FLIGHT under manifest M/root R/epoch E

Order:
  revocation event increments epoch E+1
  new C8 session/claim attempts Provider work
  old Provider call completes late

Expected:
  C8 denied D4_TRUST_EPOCH_STALE
  old effect recorded as late/conflict
  no FileVersion from old authority

Must be absent:
  new operation using old lease
```

### `D4-X-13` Trust-root Rotation

```text
Initial:
  root R1 ACTIVE, manifest M1/lease L1
  root R2 PROVISIONING, overlap [T1,T2]

Order:
  activate root set epoch N+1
  new leases must use R2
  old R1 lease at T2+1 attempts claim

Expected:
  old lease stale/denied
  historical M1 still verifiable as history
  no new Provider effect under R1 after overlap

Must be absent:
  silently extended R1 authority
```

### `D4-X-14` Cleanup vs Readback

```text
Initial:
  exact object version V no FileVersion binding
  cleanup target CT(operation C)
  verifier begins readback R

Order:
  both seal lock plans for same K
  one acquires advisory K first
  if cleanup first: CT proceeds, R later sees V missing
  if R first: readback completes, cleanup recheck rejects bound target

Expected:
  no target deletion while a valid binding is committed
  cleanup/readback terminal states obey rowcounts

Must be absent:
  delete after losing the shared key lock
```

### `D4-X-15` Evidence Written / No Finalizer

```text
Initial:
  candidate binding B; PUBLISH_RESULT and READBACK Evidence exist
  no FinalizerAttempt

Order:
  read Evidence through normal queries
  do not invoke Finalizer
  query FileVersion and current pointer

Expected:
  B CANDIDATE
  no acceptance
  no FileVersion
  no extraction/current pointer

Must be absent:
  Evidence-only publication
```

### `D4-X-16` Finalizer COMMIT Response Lost

```text
Initial:
  Finalizer idempotency key IK, current generation C8

Order:
  TX inserts acceptance/FileVersion and commits
  FAIL(after DB server commit, before client response)
  client retries Finalizer with IK
  new connection queries IK

Expected:
  retry returns existing acceptance/FileVersion
  one FileVersion
  one acceptance
  one AuditLog finalization event

Must be absent:
  duplicate FileVersion
  duplicate extraction/current pointer event
```

## 18. Deterministic 24 Fixed Vectors

### 18.1 Inputs and Assertions

Each vector uses the `D4-FV-NN-*` fixture namespace. A test passes only if
all positive and negative assertions hold.

| ID | Fixture/input | Ordered action | Expected DB/Provider/Evidence | Error/rowcount | Negative assertion |
|---|---|---|---|---|---|
| `D4-FV-01` | scope S-A, endpoint E1, key K-A | active provisioning and allocation | scope/key/endpoint exactly one row | rowcount 1 each | no second scope/key alias |
| `D4-FV-02` | STAGE_WRITE, STAGING lifecycle, `staging/K` | insert allocation | legal row | rows 1 | no objects/% stage key |
| `D4-FV-03` | STAGE_WRITE, `objects/K` | insert allocation | rejected before Provider | `23514` | no allocation/no Provider call |
| `D4-FV-04` | FINALIZE, CANONICAL lifecycle, `objects/K` | insert allocation | legal row | rows 1 | no staging lifecycle |
| `D4-FV-05` | upload CREATE action, Provider initiation response lost | dispatch and reconcile | action DISPATCHED/unknown, session initiation unknown | rows 1/0 | no second upload/session |
| `D4-FV-06` | COMPLETE action, Provider success, DB response fails | recover same action nonce | action result/reconcile exact V | one action result | no duplicate version/action |
| `D4-FV-07` | COMPLETE and ABORT actions | concurrent with barrier | one action slot winner, other rejected | `23505`/app 409 | no two Provider terminal calls |
| `D4-FV-08` | C7 ACTIVE, S1/S2 | concurrent claim | one C8 ACTIVE | one row / other 0 | no second active claim |
| `D4-FV-09` | allocation RESERVED with two subcases: no Provider mutation vs mutation started | successor custody attempt | no-mutation branch adopts one key; mutation-started branch retires/creates new operation | rows 1 / proper conflict | no adoption after mutation |
| `D4-FV-10` | close evidence E from another operation | attach to stage close | rejected | `23503`/`23514` | no close/READY |
| `D4-FV-11` | response loss, observation+readback, no PUBLISH_RESULT | Finalizer mode recovery | accepted exact V | rowcounts one | no fake publish Evidence |
| `D4-FV-12` | migration copy+readback, no PUBLISH_RESULT | Migration Finalizer | target representation active, origin MIGRATED | rows one | no new FileVersion/synthetic IDs |
| `D4-FV-13` | readback V/HASH-WRONG vs expected HASH-A | Finalizer | rejected/conflict/retained | D4 effect conflict | no accepted binding/version |
| `D4-FV-14` | LEGACY_LOCAL key/lifecycle mismatch | insert/classify FileVersion | rejected | `23514`/FK | no current pointer |
| `D4-FV-15` | UPLOAD_V2 + local fallback candidate | activate representation | two representation attempts for same FileVersion | rows one active | no second FileVersion |
| `D4-FV-16` | fallback FAILED_RETAINED | retry rollback copy | new attempt generation 2 accepted | rows one current | old failed retained |
| `D4-FV-17` | dual-read provider HASH-A/local HASH-WRONG | read selection | conflict/quarantine | app 409 | no automatic fallback |
| `D4-FV-18` | manifest M revoked epoch E+1 | new lease/claim | denied | D4_TRUST_EPOCH_STALE | no Provider call |
| `D4-FV-19` | root R1/R2 overlap, stale R1 lease | claim after overlap | denied | D4_TRUST_EPOCH_STALE | no fresh R1 lease |
| `D4-FV-20` | cleanup target V + finalizer candidate V | barrier around key lock | serialized; no referenced deletion | exact rows | no post-delete live reference |
| `D4-FV-21` | Finalizer success, response lost | retry idempotency key | one FileVersion | rowcounts 0 on retry insert | no duplicate acceptance |
| `D4-FV-22` | old reader epoch N, routing epoch N+1 | read authorization | reauth/reject | D4_ROUTE_EPOCH_STALE | no stale cache acceptance |
| `D4-FV-23` | version token absent/invalid scheme | ingest version | rejected before binding | `23502`/`23514` | no FileVersion |
| `D4-FV-24` | strict audit profile, audit missing | Finalizer/read/cleanup | blocked/retained | app 409/23514 | no cleanup claim |

### 18.2 Vector Provider/Evidence State

| ID | Initial Provider state | Initial Evidence | Final Provider state | Final Evidence |
|---|---|---|---|---|
| `D4-FV-01` | none | none | none | scope/endpoint control-plane evidence |
| `D4-FV-02` | none | none | none | staging allocation only |
| `D4-FV-03` | none | none | none | no Provider Evidence |
| `D4-FV-04` | none | none | none | canonical allocation only |
| `D4-FV-05` | no upload ID | CREATE action | correlated upload ID or unknown | action/provider-operation Evidence |
| `D4-FV-06` | upload ID, no completed version | COMPLETE dispatched | exact V | action/outcome/readback Evidence |
| `D4-FV-07` | open upload | COMPLETE/ABORT | one terminal result | one terminal action Evidence |
| `D4-FV-08` | none | none | none | authorization Evidence for winner |
| `D4-FV-09` | no mutation / mutation-started subcase | custody Evidence | same key / old key retained | authorization/custody Evidence |
| `D4-FV-10` | exact object exists | unrelated readback Evidence | unchanged | no accepted close |
| `D4-FV-11` | successful exact object, response lost | observation+readback | V retained/accepted | no PUBLISH_RESULT |
| `D4-FV-12` | exact migrated target | copy+readback | target retained | migration Evidence |
| `D4-FV-13` | exact wrong-hash object | readback for wrong hash | V retained/conflict | conflict Evidence |
| `D4-FV-14` | none | none | none | rejection Evidence only |
| `D4-FV-15` | object origin + local copy | representation Evidence | both valid, one active fallback | representation Evidence |
| `D4-FV-16` | no fallback | failed attempt Evidence | local fallback V2 | new representation Evidence |
| `D4-FV-17` | provider V/local V differ | both hashes | quarantine provider rep | incident Evidence |
| `D4-FV-18` | manifest M | revocation record | no new operation | revocation Evidence |
| `D4-FV-19` | R1/R2 manifests | root overlap evidence | R2 active only | trust-root Evidence |
| `D4-FV-20` | target V exists | readback and cleanup intent | V absent or retained per winner | delete/readback or binding Evidence |
| `D4-FV-21` | exact V exists | finalizer evidence committed | one FileVersion | one acceptance Evidence set |
| `D4-FV-22` | exact provider/local maps | old route decision | read denied/re-authorized | route Evidence |
| `D4-FV-23` | object without exact token | no readback | object retained/rejected | capability failure Evidence |
| `D4-FV-24` | exact object exists, audit absent | no audit Evidence | reads/cleanup blocked per profile | no finalization/cleanup Evidence |

### 18.3 Vector Pass Conditions

Each vector is complete only when the test harness records:

```text
DB fixture snapshot before
SQLSTATE/application error
rowcount for each UPDATE
final row snapshot
Provider requests/responses
Evidence rows and digests
artifact/object inventory
negative absence queries
cleanup/recovery final state
```

No test may pass based only on an observed exception.

## 19. Additional Cross-Protocol Tests

| ID | Forced combination | Required assertions |
|---|---|---|
| `D4-XT-01` | stale C7 + Provider success + response loss + C8 recovery | exact V may be adopted once; no C7 write authority; no duplicate FileVersion |
| `D4-XT-02` | Complete/Abort actions with lost responses | same nonce replay idempotent; different nonce gets action-slot conflict |
| `D4-XT-03` | FAILED_RETAINED fallback then retry | new generation accepted; failed attempt retained; cleanup preserves both |
| `D4-XT-04` | Provider audit contradiction after accepted binding | incident/quarantine/read block/cleanup block; no silent fallback |
| `D4-XT-05` | Evidence subtype cross-reference substitution | composite FK rejection; no acceptance |
| `D4-XT-06` | canonical digest tamper | ingestion/read verification fails closed |
| `D4-XT-07` | revocation epoch stale in running Worker | new claim denied; late Provider effect retained as conflict |
| `D4-XT-08` | cleanup vs quarantine | target retained while incident open; no deletion |
| `D4-XT-09` | rollback vs quarantine | quarantined representation cannot be fallback source; no route switch |
| `D4-XT-10` | migration source contention | one MigrationSourceSlot/current record; other rowcount zero |
| `D4-XT-11` | endpoint PROVISIONING race | one candidate slot; second candidate rejected; old active remains |
| `D4-XT-12` | three-key lock inversion | all lock plans sealed/sorted; no deadlock success path; no Provider side effect on failed lock |

Each XT test uses `D4-XT-NN-*` namespaces, fixed hashes above, two/three
sessions, deterministic barriers, and explicit negative queries.

### 19.1 Deterministic XT Specifications

#### `D4-XT-01`

```text
Initial:
  C7 ACTIVE->expired; effect E7 IN_FLIGHT; no FileVersion
Steps:
  W2 claims C8; C7 SUPERSEDED
  PROVIDER E7 returns exact V/HASH-A; response unknown
  verifier writes observation + readback
  Finalizer C8 accepts V
Expected:
  one FileVersion; E7 source provenance; C7 not reactivated
Error/rowcount:
  C8 claim rowcount 1; stale C7 effect update rowcount 0
Negative:
  no second FileVersion; no C7 write path
```

#### `D4-XT-02`

```text
Initial:
  U OPEN; action slot empty
Steps:
  Complete C PREPARED/COMMITTED
  duplicate Complete C same nonce/digest -> existing action
  different Complete nonce -> action slot conflict
  Abort A different nonce -> action slot conflict
  one Provider Complete success
Expected:
  one SUCCEEDED action; session COMPLETED; V exact
Errors:
  duplicate returns existing; conflicts D4_UPLOAD_ACTION_IN_PROGRESS
Negative:
  no Abort Provider call; no duplicate result
```

#### `D4-XT-03`

```text
Initial:
  FV has object ORIGIN and no local fallback
Steps:
  create fallback attempt gen1; mark FAILED_RETAINED
  slot.activeAttemptId NULL
  create fallback attempt gen2; local copy succeeds; readback verifies
  activate gen2
Expected:
  gen1 retained; gen2 ACTIVE; one current fallback
Negative:
  no failed attempt update; no second FileVersion
```

#### `D4-XT-04`

```text
Initial:
  accepted version V; active local fallback R
Steps:
  Provider audit records wrong version/principal/digest
  insert Incident + Quarantine for V representation
  increment quarantine epoch; revoke open read leases
  new read and cleanup target authorization
Expected:
  incident OPEN/CONTAINED; representation excluded
  read returns D4_INTEGRITY_INCIDENT
  cleanup target rowcount 0
Negative:
  no automatic switch to R without new verification
```

#### `D4-XT-05`

```text
Initial:
  evidence E belongs to Operation O1/target V1
Steps:
  attempt acceptance for O2/V2 with E
  attempt close attestation for O2/V2 with E
Expected:
  FK/trigger rejects both
Error/rowcount:
  23503/23514; no acceptance/close
Negative:
  no accepted binding/FileVersion
```

#### `D4-XT-06`

```text
Initial:
  valid evidence payload fields
Steps:
  alter size/hash/version field while retaining old digest
  call storage_verify_evidence_digest
  attempt acceptance
Expected:
  digest mismatch rejected
Error:
  D4_EVIDENCE_DIGEST_MISMATCH / app 409
Negative:
  no Evidence update; no acceptance
```

#### `D4-XT-07`

```text
Initial:
  C7/effect in flight under manifest M epoch E
Steps:
  revocation E+1 commits
  new C8 claim
  old Provider response arrives
Expected:
  C8 denied D4_TRUST_EPOCH_STALE
  old effect retained/conflict; no FileVersion
Negative:
  no new effect under old lease; no retry with cached lease
```

#### `D4-XT-08`

```text
Initial:
  cleanup target CT exact V; incident I opens on V
Steps:
  CT already EXECUTING; I transaction / quarantine
  CT reacquires plan lock after I commit
Expected:
  CT cannot APPLIED/delete; state FAILED_RETAINED/UNKNOWN
Negative:
  no DELETE_RESULT; V retained
```

#### `D4-XT-09`

```text
Initial:
  rollback wants copy source V; quarantine Q(V)
Steps:
  rollback COPY operation requests V
  read selection checks ACTIVE quarantine
Expected:
  source selection rejected; routing remains FREEZE/FAILED_RETAINED
Negative:
  no local fallback activation from quarantined V
```

#### `D4-XT-10`

```text
Initial:
  source slot SS OPEN
Steps:
  W1 inserts record R1/currentRecordId R1
  W2 attempts second record R2 for SS
Expected:
  R1 rowcount 1; R2 unique conflict
Error:
  23505 / D4_MIGRATION_SOURCE_CONFLICT
Negative:
  no second record/source representation
```

#### `D4-XT-11`

```text
Initial:
  E1 ACTIVE; rotation slot candidate NULL
Steps:
  W1 creates E2 PROVISIONING and claims candidate slot
  W2 attempts E3 candidate
  E2 validation PASS; activation CAS
Expected:
  E2 ACTIVE; E1 retired; E3 rejected
Error/rowcount:
  E3 23505; E2 activation rowcount 1
Negative:
  no two active/candidates
```

#### `D4-XT-12`

```text
Initial:
  plan A keys [K1,K3], plan B [K2,K1], plan C [K3,K2]
Steps:
  W1/W2/W3 seal plans and acquire sorted advisory locks
  one transaction attempts dynamic K2 addition after K1 lock
Expected:
  sorted waits only; dynamic addition D4_LOCK_PLAN_MUTATED
Negative:
  no Provider effect before successful lock plan transaction
```

## 20. R4 P2/P3 Disposition

| Finding | D4 disposition | Evidence |
|---|---|---|
| `WP2AR4-P2-01` dynamic lock set | `RESOLVED BY DESIGN` | sealed lock plan + sorted derived keys |
| `WP2AR4-P2-02` endpoint candidates | `RESOLVED BY DESIGN` | singleton rotation slot + candidate unique |
| `WP2AR4-P2-03` migration source | `RESOLVED BY DESIGN` | MigrationSourceSlot unique source |
| `WP2AR4-P2-04` custody | `RESOLVED BY DESIGN` | state matrix + owner digest equality |
| `WP2AR4-P2-05` timelines | `RESOLVED BY DESIGN` | §17 deterministic 16-race specs |
| `WP2AR4-P2-06` vectors | `RESOLVED BY DESIGN` | §18 fixed fixtures/actions/assertions |
| `WP2AR4-P3-1` endpoint failed | `RESOLVED BY DESIGN` | rotation slot `FAILED` transition |
| `WP2AR4-P3-2` capability child ownership | `RESOLVED BY DESIGN` | Gate-only child-set ingestion in §15 |

## 21. R4 P1 Closure Matrix

| R4 P1 | D4 status | Executable evidence |
|---|---|---|
| `WP2AR4-P1-01` authority/effect | `RESOLVED BY DESIGN` | single ProviderEffect authority; superseded exact adoption |
| `WP2AR4-P1-02` upload actions | `RESOLVED BY DESIGN` | Action Ledger + result attempts + slot |
| `WP2AR4-P1-03` representation retry | `RESOLVED BY DESIGN` | slot/attempt generation model |
| `WP2AR4-P1-04` audit contradiction | `RESOLVED BY DESIGN` | Incident/Quarantine/ReadLease/fail-closed |
| `WP2AR4-P1-05` typed Evidence | `RESOLVED BY DESIGN` | complete subtype contracts + canonical digest |

## 22. Remaining Open Items and Boundaries

No D4 P1 is intentionally left open. The following remain external:

```text
Provider choice/account/region:
  OPEN / NOT VERIFIED

Exact-key IAM and credential issuance:
  NOT VERIFIED

Provider API behavior and audit delivery:
  NOT VERIFIED

PostgreSQL certificate mapping and pg_ident:
  NOT VERIFIED

Trust-root production keys and rotation:
  NOT VERIFIED

Historical object inventory:
  NOT VERIFIED

Cost, degraded read, dual-read retention, audit assurance:
  OPEN business decisions
```

The P2-05 boundary remains:

```text
safe fail-closed behavior:
  engineering invariant

budget/availability/data-residency/retention:
  user decision, not inferred
```

## 23. Implementation and Verification Boundary

This report does not authorize:

```text
Prisma/Schema/Migration/Trigger/Function implementation
SQL or database connection
Provider/Storage/IAM/credential access
service/Worker/Scheduler/Broker operation
Build/E2E/Native RPC/deployment
Git staging/commit/push/reset
```

D4 only supplies the executable protocol specification for a later isolated
schema/migration draft and test implementation authorization.

## 24. Git and Integrity

At design start:

```text
Branch:
  codex/public-github-sync

HEAD:
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

origin/main:
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

Tracked modified:
  0

Staged:
  0

Deleted:
  0

Untracked:
  29
```

At design end:

```text
Branch:
  codex/public-github-sync

HEAD:
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

origin/main:
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

Tracked modified:
  0

Staged:
  0

Deleted:
  0

Untracked:
  30
```

This design adds one untracked report. The final SHA-256 is external delivery
metadata after the bytes are frozen.

No source, Schema, Migration, Trigger, Function, test, configuration, database,
Provider, Storage, IAM, service, Scheduler, Build, E2E, Native RPC or
deployment operation was modified or executed.

## 25. Final Verdict

```text
D4 DESIGN COMPLETE — READY FOR INDEPENDENT REVIEW

R4 P1:
  5/5 RESOLVED BY DESIGN

R4 P2:
  6/6 RESOLVED BY DESIGN

R4 P3:
  2/2 RESOLVED BY DESIGN

16 race specifications:
  COMPLETE

24 fixed vectors:
  COMPLETE

12 additional cross-protocol tests:
  DEFINED

Route C isolated validation:
  NOT AUTOMATICALLY GRANTED

Implementation:
  NOT AUTHORIZED

Provider / Database / Storage / IAM / Runtime:
  NOT VERIFIED

Production:
  NOT AUTHORIZED
```



