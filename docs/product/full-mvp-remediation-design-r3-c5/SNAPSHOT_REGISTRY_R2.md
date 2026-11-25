# Snapshot Registry R2

Status:

```text
REGISTRY: SNAPSHOT-R2
PROTOCOL: R3-BASIS-1-R5
STABLE KEY: SK-R2
NORMATIVE DESIGN
NOT IMPLEMENTED
```

## 1. Registry Rules

```text
recordType: uint16, exactly 0..9
stableKey: complete SK-R2 bytes
rowId: canonical ASCII CUID/Text, 1..64 bytes
record sort: (recordType, stableKey bytes, rowId ASCII bytes)
field sort: fieldTag ascending during canonicalization
field tags: record-local, unique, all required tags present
NULL fields: present with typeTag=0,presence=0
```

Semantic input may arrive in arbitrary record/field order. The canonicalizer
sorts it. A pre-encoded wire frame containing unsorted field tags or duplicate
tags is invalid and rejected by the decoder. This resolves the C4 ambiguity
between input ordering and canonical Basis ordering.

## 2. Record Types and Stable-Key Tuples

| Type | Entity | Tuple components |
|---:|---|---|
| `0x0000` | Snapshot Header | `snapshotId` |
| `0x0001` | Requirement Field | `requirementVersionId`, `fieldKey` |
| `0x0002` | Candidate | `candidateId` |
| `0x0003` | Parameter | `candidateId`, `parameterKey` |
| `0x0004` | Price | `candidateId`, `priceRevisionId` |
| `0x0005` | Source Revision | `sourceRevisionId` |
| `0x0006` | Catalog Review | `catalogReviewId` |
| `0x0007` | Professional Review | `professionalReviewId`, `eventSequence` |
| `0x0008` | Warning | `candidateId`, `warningSequence` |
| `0x0009` | Missing Field | `candidateId`, `fieldKey` |

Exact tuple domains and byte vectors are defined in
`SNAPSHOT_STABLE_KEY_TUPLE_ENCODING_R2.md`.

No two rows in one Snapshot may share `(recordType,stableKey)`. No two rows in
one record type may share `rowId`.

## 3. Type 0 — Snapshot Header

| Tag | Name | Type | Null |
|---:|---|---|---|
| 1 | `snapshotId` | CANONICAL_ID | no |
| 2 | `caseId` | CANONICAL_ID | no |
| 3 | `projectId` | CANONICAL_ID | no |
| 4 | `requirementId` | CANONICAL_ID | no |
| 5 | `requirementVersionId` | CANONICAL_ID | no |
| 6 | `selectionRunId` | CANONICAL_ID | no |
| 7 | `registryRevision` | ENUM (`SNAPSHOT-R2`) | no |
| 8 | `protocolRevision` | ENUM (`R3-BASIS-1-R5`) | no |
| 9 | `stableKeyEncoding` | ENUM (`SK-R2`) | no |

## 4. Type 1 — Requirement Field

| Tag | Name | Type | Null |
|---:|---|---|---|
| 1 | `fieldKey` | TEXT | no |
| 2 | `valueType` | ENUM | no |
| 3 | `value` | its declared typed scalar | yes |
| 4 | `unit` | TEXT | yes |
| 5 | `fieldStatus` | ENUM | no |
| 6 | `sourceFieldValueId` | CANONICAL_ID | no |
| 7 | `sourceKind` | ENUM | no |
| 8 | `sourceEntityType` | ENUM | no |
| 9 | `sourceEntityId` | CANONICAL_ID | no |
| 10 | `sourceAuxId` | TEXT UTF-8 NFC | yes |
| 11 | `sourceKey` | BYTES (`SOURCE_KEY_R3`) | no |

`sourceKey` is deterministically derived from the first four structured source
identity facts. It is included in the Basis so a source binding change cannot
leave the digest unchanged.

## 5. Type 2 — Candidate

| Tag | Name | Type | Null |
|---:|---|---|---|
| 1 | `candidateId` | CANONICAL_ID | no |
| 2 | `productRevisionId` | CANONICAL_ID | no |
| 3 | `specificationRevisionId` | CANONICAL_ID | no |
| 4 | `priceRevisionId` | CANONICAL_ID | yes |
| 5 | `technicalStatus` | ENUM | no |
| 6 | `commercialStatus` | ENUM | no |
| 7 | `trustStatus` | ENUM | no |
| 8 | `professionalReviewStatus` | ENUM | no |
| 9 | `overallStatus` | ENUM | no |

## 6. Type 3 — Parameter

| Tag | Name | Type | Null |
|---:|---|---|---|
| 1 | `candidateId` | CANONICAL_ID | no |
| 2 | `parameterKey` | TEXT | no |
| 3 | `valueType` | ENUM | no |
| 4 | `value` | its declared typed scalar | no |
| 5 | `unit` | TEXT | yes |
| 6 | `sourceRevisionId` | CANONICAL_ID | no |

## 7. Type 4 — Price

| Tag | Name | Type | Null |
|---:|---|---|---|
| 1 | `candidateId` | CANONICAL_ID | no |
| 2 | `priceRevisionId` | CANONICAL_ID | no |
| 3 | `amountMinor` | INTEGER | no |
| 4 | `currency` | ENUM | no |
| 5 | `taxBasis` | ENUM | no |
| 6 | `applicability` | ENUM | no |

## 8. Type 5 — Source Revision

| Tag | Name | Type | Null |
|---:|---|---|---|
| 1 | `sourceRevisionId` | CANONICAL_ID | no |
| 2 | `evidenceObjectId` | CANONICAL_ID | no |
| 3 | `rawContentDigest` | TEXT | no |
| 4 | `sourceKind` | ENUM | no |

The normalized Source row also stores the owning Snapshot and optional
candidate relation. Those are ownership metadata; tag 4 is the business source
kind and is part of the Basis.

## 9. Type 6 — Catalog Review

| Tag | Name | Type | Null |
|---:|---|---|---|
| 1 | `catalogReviewId` | CANONICAL_ID | no |
| 2 | `targetRevisionId` | CANONICAL_ID | no |
| 3 | `policyRevisionId` | CANONICAL_ID | no |
| 4 | `decision` | ENUM | no |
| 5 | `reviewedAt` | TIMESTAMP | no |

The tuple must match the immutable source Catalog Review row. A mutable
current-status value is not an acceptable substitute.

## 10. Type 7 — Professional Review

| Tag | Name | Type | Null |
|---:|---|---|---|
| 1 | `professionalReviewEventId` | CANONICAL_ID | no |
| 2 | `professionalReviewId` | CANONICAL_ID | no |
| 3 | `policyRevisionId` | CANONICAL_ID | no |
| 4 | `decision` | ENUM | no |
| 5 | `basisDigest` | TEXT | no |

The event and review are bound through exact six/seven-column relationships
defined in the normalized schema and trusted-transition design.

## 11. Type 8 — Warning

| Tag | Name | Type | Null |
|---:|---|---|---|
| 1 | `candidateId` | CANONICAL_ID | no |
| 2 | `warningSequence` | INTEGER | no |
| 3 | `warningCode` | ENUM | no |
| 4 | `warningText` | TEXT | no |

Sequence is assigned deterministically while the Snapshot is created:

1. lock the Case;
2. collect the immutable warning set for the candidate;
3. sort by `(warningCode ASCII bytes,warningText UTF-8 NFC bytes,sourceWarningId)`;
4. assign sequence `1..N`;
5. persist both sequence and derived stableKey.

Concurrent finalization cannot create two independent sequences because the
Case and Snapshot are locked and the Snapshot candidate/warning tuples have
structured UNIQUE constraints.

## 12. Type 9 — Missing Field

| Tag | Name | Type | Null |
|---:|---|---|---|
| 1 | `candidateId` | CANONICAL_ID | no |
| 2 | `fieldKey` | TEXT | no |
| 3 | `reasonCode` | ENUM | no |

## 13. Validation and Rejection

Reject:

- unknown/missing record type;
- unknown/missing/duplicate field tag;
- field order wrong in an already encoded wire frame;
- missing required tag;
- NULL where not allowed;
- empty required identity;
- invalid scalar type;
- enum not in the approved R2 table;
- sourceKey mismatch;
- stableKey tuple mismatch;
- structured-column/stableKey mismatch;
- duplicate structured business tuple;
- duplicate stableKey or rowId;
- child/Snapshot ownership mismatch;
- record Count/Body length mismatch;
- unconsumed bytes.

## 14. Version Policy

`SNAPSHOT-R1` remains immutable historical design. This Registry is
`SNAPSHOT-R2`; it is not a silent edit of R1. Registry revision, Basis protocol
revision and stable-key encoding revision are stored independently in the
Snapshot header and Basis metadata.

Changing any record type, field tag, stable-key tuple, scalar semantics,
NFC/domain rule, or Registry field means a new Registry revision and new
vectors. Existing R2 Snapshots remain readable only with the exact R2
implementation.

