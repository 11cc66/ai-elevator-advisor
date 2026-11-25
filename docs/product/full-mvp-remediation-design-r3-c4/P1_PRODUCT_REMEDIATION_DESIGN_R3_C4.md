# P1 Product Remediation Design R3-C4

Status:

```text
R3-C4 DESIGN COMPLETE WITH OPEN BLOCKERS
```

R3-C4 is a design-only remediation of R3-C3. It does not modify source,
Schema, Migration, tests, configuration, database or Runtime, and does not
grant implementation authorization.

## 1. Scope

R3-C4 resolves the R3-C3 review findings:

- `REV-R3-C3-P1-01` exact ProfessionalReviewEvent parent key;
- `REV-R3-C3-P1-02` actual Snapshot Registry and stableKey mapping;
- `REV-R3-C3-P2-01` complete Snapshot child schema;
- `REV-R3-C3-P2-02` typed SQL catalogue;
- `REV-R3-C3-P2-03` legacy JSON mapping;
- `REV-R3-C3-P2-04` event-only DDL privileges;
- `REV-R3-C3-P2-05` sourceKey delimiter ambiguity;
- `REV-R3-C3-P3-01` generic-vs-Snapshot capability overclaim.

R1/R2/R3/R3-C2/R3-C3 are historical evidence and are not modified.

## 2. Identity and Source Structure

### 2.1 Canonical entity identity

C4 retains the existing CUID/Text entity IDs:

```text
CanonicalEntityId = TEXT
new ID generation = server-side CUID
```

External IDs, legacy IDs and source identities are bounded ASCII text. A
separator is not used as a security boundary.

### 2.2 Structured source identity

Instead of a delimiter-parsed `sourceKey`, every `RequirementFieldValue`
stores structured source columns:

```text
sourceKind TEXT NOT NULL
sourceEntityType TEXT NOT NULL
sourceEntityId TEXT NOT NULL
sourceAuxId TEXT NULL
sourceKey TEXT NOT NULL
```

The authoritative source relation is the exact typed FK below, not parsing
`sourceKey`. `sourceKey` is a derived, immutable display/audit key produced by
the versioned `canonical_source_key_r2` function with length-prefixed fields.
It is never used as the only authorization or ownership check.

Supported source kinds:

```text
USER_ASSERTION
PROFESSIONAL_REVIEW
CATALOG_EVIDENCE
SYSTEM_DERIVED
OTHER_AUTHORIZED_SOURCE
```

`sourceEntityType` and `sourceEntityId` must match the source-kind/check and
the typed FK. Unknown namespace, empty ID, malformed sourceKey, overlong ID or
unknown source kind is rejected.

## 3. Requirement Model

The C3 typed Requirement model is retained with C4 source identity:

```text
Requirement
  id TEXT PRIMARY KEY
  projectId TEXT NOT NULL
  conversationId TEXT NOT NULL
  installationScenario NOT NULL
  UNIQUE(id, projectId, conversationId, installationScenario)
  FK(projectId, conversationId, installationScenario)
    -> AdvisorConversation(id, projectId, installationScenario)

RequirementVersion
  id TEXT PRIMARY KEY
  requirementId TEXT NOT NULL
  projectId TEXT NOT NULL
  conversationId TEXT NOT NULL
  installationScenario NOT NULL
  versionNumber INTEGER NOT NULL
  fieldStateDigest TEXT NOT NULL
  UNIQUE(requirementId, versionNumber)
  UNIQUE(id, requirementId, projectId, conversationId)
  UNIQUE(id, requirementId, projectId, conversationId, installationScenario)
  FK(requirementId, projectId, conversationId, installationScenario)
    -> Requirement(id, projectId, conversationId, installationScenario)
```

`RequirementFieldAssertion` and `RequirementFieldValue` retain the complete
typed columns from R3-C3:

- Boolean, BIGINT, NUMERIC(18,6), TEXT/NFC, ENUM, CANONICAL_ID,
  TIMESTAMPTZ(6), BYTEA;
- field key, polarity, semantic kind, condition/exception, temporal scope,
  modality, assertion status, parser version, confirmation state;
- exactly-one typed value CHECK;
- source kind/source entity identity;
- confirmation event and append-only history.

The exact child ownership keys are:

```text
Assertion UNIQUE(
  id, requirementVersionId, requirementId, projectId, conversationId,
  installationScenario
)
FieldValue UNIQUE(
  id, requirementVersionId, requirementId, projectId, conversationId,
  installationScenario
)
```

All child FKs use those exact keys. Existing JSON `fields` is a read-only
compatibility projection generated from `RequirementFieldValue`; it is never
the selection source.

## 4. ProfessionalReview Exact Relationship

### 4.1 Chosen structure

C4 chooses the C3 review **Option A with an explicit exact six-column Event
key**:

```text
ProfessionalReview
  id TEXT PRIMARY KEY
  projectId TEXT NOT NULL
  conversationId TEXT NOT NULL
  requirementId TEXT NOT NULL
  requirementVersionId TEXT NOT NULL
  installationScenario TEXT NOT NULL
  candidateId TEXT NOT NULL
  selectionRunId TEXT NOT NULL
  ruleSetRevisionId TEXT NOT NULL
  policyRevisionId TEXT NOT NULL
  attemptNumber INTEGER NOT NULL
  basisDigest TEXT NOT NULL
  UNIQUE(id, projectId, conversationId, requirementId,
         requirementVersionId, installationScenario)
  UNIQUE(candidateId, policyRevisionId, attemptNumber)
  FK(candidateId, selectionRunId, projectId, conversationId,
     requirementId, requirementVersionId, installationScenario,
     ruleSetRevisionId)
    -> SelectionCandidateResult(...)
  FK(policyRevisionId) -> ProfessionalReviewPolicyRevision(id)

ProfessionalReviewEvent
  id TEXT PRIMARY KEY
  reviewId TEXT NOT NULL
  projectId TEXT NOT NULL
  conversationId TEXT NOT NULL
  requirementId TEXT NOT NULL
  requirementVersionId TEXT NOT NULL
  installationScenario TEXT NOT NULL
  eventSequence INTEGER NOT NULL
  resultingStateVersion INTEGER NOT NULL
  previousState TEXT NULL
  newState TEXT NOT NULL
  actorUserId TEXT NOT NULL
  actorAuthorityId TEXT NOT NULL
  decision TEXT NULL
  reason TEXT NULL
  occurredAt TIMESTAMPTZ(6) NOT NULL
  basisDigest TEXT NOT NULL
  policyRevisionId TEXT NOT NULL
  requestId TEXT NOT NULL
  UNIQUE(
    id, projectId, conversationId, requirementId,
    requirementVersionId, installationScenario
  )
  UNIQUE(reviewId, eventSequence)
  UNIQUE(reviewId, resultingStateVersion)
  UNIQUE(reviewId, requestId)
  FK(reviewId, projectId, conversationId, requirementId,
     requirementVersionId, installationScenario)
    -> ProfessionalReview(id, projectId, conversationId, requirementId,
                          requirementVersionId, installationScenario)
  FK(actorUserId) -> User(id)
```

The six-column Event UNIQUE is the exact parent used by Assertion/FieldValue:

```text
FK(
  sourceProfessionalReviewEventId,
  projectId,
  conversationId,
  requirementId,
  requirementVersionId,
  installationScenario
)
  -> ProfessionalReviewEvent(
    id, projectId, conversationId, requirementId,
    requirementVersionId, installationScenario
  )
```

The Event's `reviewId` relation remains separately enforced by the six-column
Review FK. No seven-column parent key is reused as if it were a six-column
key. See `PROFESSIONAL_REVIEW_COMPOSITE_FK_DESIGN_R3_C4.md` for DDL.

### 4.2 Event-only authority

There is no mutable authoritative ProfessionalReview state. The read model is
the latest event by `(reviewId,eventSequence DESC)`. A transition function
locks the Review row, verifies previous state, expected sequence, basis and
policy, then inserts exactly one event. Events are append-only.

## 5. Snapshot Registry

`SNAPSHOT_REGISTRY_R1.md` is normative. Record types:

| Type | Entity | stableKey |
|---:|---|---|
| 0 | Snapshot Header | `HEADER:<snapshotId>` |
| 1 | Requirement Field | `REQ:<requirementVersionId>:<fieldKey>` |
| 2 | Candidate | `CAND:<candidateId>` |
| 3 | Parameter | `PARAM:<candidateId>:<parameterKey>` |
| 4 | Price | `PRICE:<candidateId>:<priceRevisionId>` |
| 5 | Source Revision | `SRC:<sourceRevisionId>` |
| 6 | Catalog Review | `CREVIEW:<catalogReviewId>` |
| 7 | Professional Review | `PREVIEW:<professionalReviewId>:<eventSequence>` |
| 8 | Warning | `WARN:<candidateId>:<warningSequence>` |
| 9 | Missing Field | `MISS:<candidateId>:<fieldKey>` |

The registry defines every field tag, type, presence/nulls, parent binding and
canonical key. Unknown types/tags are rejected. No record type or stableKey
may be inferred from query order or display labels.

## 6. Snapshot Normalized Child Schema

`SNAPSHOT_NORMALIZED_CHILD_SCHEMA_R1.md` defines:

- Snapshot Header;
- Snapshot Record;
- Snapshot Field;
- Source Binding;
- Basis Metadata;
- Validation Result;
- Registry/Protocol Revision;
- canonical child rows for all nine record types.

Canonical child rows are the sole authority. A JCS payload is reconstructed
from them; no writable payload or independent JSON truth is allowed. The
snapshot creation function writes all child rows and basis metadata in one
transaction.

## 7. R3-BASIS Revision 4

`R3_BASIS_V4_PROTOCOL_AND_VECTOR_SPEC.md` defines the actual Snapshot protocol:

- text/CUID `rowId`;
- 8-byte magic, version 4, payload type;
- 28-byte header;
- Record and Field framing;
- canonical scalar types;
- Record/Field sorting;
- registry-based record/field tags;
- duplicate, unknown, length and unconsumed-byte rejection.

`R3_BASIS_V4_FIXED_VECTORS.md` contains the 23 generic vectors plus the
complete Snapshot vector `C4-SNAP-01` with:

- Header;
- two Requirement Fields;
- two Candidates;
- two Parameters;
- two Prices;
- two Sources;
- Catalog Review;
- Professional Review;
- Warning;
- Missing Field.

`R3_BASIS_V4_INDEPENDENT_REPRODUCTION.md` records Node.js and Python
independent results.

## 8. Typed Field Catalogue and Legacy Mapping

`TYPED_FIELD_CATALOGUE_R1.md` defines field keys, scalar types, precision,
limits, units, nullability and applicability. Unknown engineering thresholds
and unit authority remain Open Decisions; they cannot be inferred from storage
types.

`LEGACY_JSON_TYPED_MIGRATION_MAP_R1.md` defines the legacy JSON path mapping,
lossless/lossy classification, default prohibition, quarantine reasons and
manual review requirements for existing `BuildingRequirement.fields`.

## 9. Event-only DDL Privileges

`EVENT_ONLY_DATABASE_PRIVILEGE_DESIGN_R1.md` defines:

- separate migration, schema owner, function owner, runtime service, reviewer,
  policy author and read-only auditor roles;
- fixed `search_path`;
- `REVOKE ALL` and `REVOKE EXECUTE FROM PUBLIC`;
- function-specific grants;
- append-only Event tables;
- no direct Event/current-status DML for ordinary roles;
- policy-author/reviewer separation;
- transaction/CAS and invalid-relation rejection.

Exact deployment owner names remain Open Decision `OD-R3-C4-03`, but the
privilege relationships are normative.

## 10. Transactions and Failure Behavior

- Requirement writes use conversation/version lock and typed source/value
  inserts in one transaction.
- Professional/RuleSet transitions lock the owner row, verify exact event
  parent and policy basis, insert one event, and commit.
- Snapshot creation locks the case, reads exact immutable records, writes all
  canonical children, computes revision 4 Basis, runs deferred validation and
  advances the pointer in one transaction.
- Catalog evidence archive writes precede metadata; orphan objects are not
  authoritative.
- Idempotent success is one transaction; deterministic replayable failures use
  an explicit failure record; unexpected failures roll back; COMMIT unknown
  is re-read from durable storage.

No unknown, failed, missing, expired or inconsistent state can become
`OPERATIONAL`, `APPROVED`, or a trusted Snapshot.

## 11. P1-3 Isolation

R3-C4 does not modify Upload Intent, Upload Attempt, Lifecycle, FileVersion,
Operation Attempts, P1-3 migration or triggers. Catalog evidence archive is a
separate capability and no Storage path is accessed.

## 12. Open Decisions and Acceptance

All historical decisions remain in `P1_PRODUCT_REMEDIATION_OPEN_DECISIONS_R3_C4.md`.

```text
ProfessionalReview exact FK: DESIGNED
Snapshot Registry R1: DESIGNED
Snapshot child schema: DESIGNED
Deferred validation: DESIGNED
Basis generic vectors: 23
Full Snapshot vectors: C4-SNAP-01
Independent Node/Python: REQUIRED
Typed catalogue: DESIGNED WITH BUSINESS OD
Legacy mapping: DESIGNED WITH DATA OD
Event-only DDL privileges: DESIGNED WITH ROLE OD
Implementation authorization: NOT GRANTED
Database/Runtime: NOT VERIFIED
```
