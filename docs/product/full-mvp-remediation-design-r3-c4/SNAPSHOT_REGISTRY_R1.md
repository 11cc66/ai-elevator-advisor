# Snapshot Registry R1

Status:

```text
NORMATIVE REGISTRY FOR R3-BASIS-1 REVISION 4
NOT IMPLEMENTED
```

## 1. Registry Rules

The registry revision is identified in the snapshot header as `SNAPSHOT-R1`.
Unknown registry versions, record types, field tags, scalar types and missing
required fields are rejected.

```text
Stable key uniqueness: per (recordType, stableKey)
Row ID: canonical CUID/Text
Record sort: (recordType, stableKey bytes, rowId bytes)
Field sort: fieldTag ascending
No query/order/locale-derived ordering is allowed.
```

## 2. Record Types

| Type | Entity | Stable key | Required relationship |
|---:|---|---|---|
| `0x0000` | Snapshot Header | `HEADER:<snapshotId>` | snapshot/case/project |
| `0x0001` | Requirement Field | `REQ:<requirementVersionId>:<fieldKey>` | exact RequirementVersion |
| `0x0002` | Candidate | `CAND:<candidateId>` | exact SelectionRun |
| `0x0003` | Parameter | `PARAM:<candidateId>:<parameterKey>` | exact Candidate/Revision |
| `0x0004` | Price | `PRICE:<candidateId>:<priceRevisionId>` | exact Candidate/PriceRevision |
| `0x0005` | Source Revision | `SRC:<sourceRevisionId>` | exact immutable SourceRevision |
| `0x0006` | Catalog Review | `CREVIEW:<catalogReviewId>` | exact typed catalog target |
| `0x0007` | Professional Review | `PREVIEW:<professionalReviewId>:<eventSequence>` | exact Review/Event basis |
| `0x0008` | Warning | `WARN:<candidateId>:<warningSequence>` | exact Candidate |
| `0x0009` | Missing Field | `MISS:<candidateId>:<fieldKey>` | exact Candidate/RequirementVersion |

No two active Snapshot child rows may have the same `(recordType, stableKey)`.
The row ID is included after stableKey in canonical sort but does not permit a
duplicate stableKey.

## 3. Header Record

Fields:

| Tag | Name | Type | Null | Rule |
|---:|---|---|---|---|
| 1 | `snapshotId` | CANONICAL_ID | no | exact Snapshot |
| 2 | `caseId` | CANONICAL_ID | no | exact Case |
| 3 | `projectId` | CANONICAL_ID | no | exact Project |
| 4 | `requirementVersionId` | CANONICAL_ID | no | exact immutable version |
| 5 | `selectionRunId` | CANONICAL_ID | no | exact run |
| 6 | `registryRevision` | ENUM | no | `SNAPSHOT-R1` |
| 7 | `protocolRevision` | ENUM | no | `R3-BASIS-1-R4` |

## 4. Requirement Field

| Tag | Name | Type | Null | Rule |
|---:|---|---|---|---|
| 1 | `fieldKey` | TEXT | no | typed catalogue key |
| 2 | `valueType` | ENUM | no | scalar type |
| 3 | `value` | typed scalar | conditional | exact typed scalar; NULL type only for unknown |
| 4 | `unit` | TEXT | conditional | required for dimensional values |
| 5 | `fieldStatus` | ENUM | no | status enum |
| 6 | `sourceKind` | ENUM | no | source kind |
| 7 | `sourceEntityId` | CANONICAL_ID | no | typed source ID |

Stable key: `REQ:<requirementVersionId>:<fieldKey>`.

## 5. Candidate

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

Stable key: `CAND:<candidateId>`.

## 6. Parameter

| Tag | Name | Type | Null |
|---:|---|---|---|
| 1 | `candidateId` | CANONICAL_ID | no |
| 2 | `parameterKey` | TEXT | no |
| 3 | `valueType` | ENUM | no |
| 4 | `value` | typed scalar | no |
| 5 | `unit` | TEXT | conditional |
| 6 | `sourceRevisionId` | CANONICAL_ID | no |

Stable key: `PARAM:<candidateId>:<parameterKey>`.

## 7. Price

| Tag | Name | Type | Null |
|---:|---|---|---|
| 1 | `candidateId` | CANONICAL_ID | no |
| 2 | `priceRevisionId` | CANONICAL_ID | no |
| 3 | `amountMinor` | INTEGER | no |
| 4 | `currency` | ENUM | no |
| 5 | `taxBasis` | ENUM | no |
| 6 | `applicability` | ENUM | no |

Stable key: `PRICE:<candidateId>:<priceRevisionId>`.

## 8. Source Revision

| Tag | Name | Type | Null |
|---:|---|---|---|
| 1 | `sourceRevisionId` | CANONICAL_ID | no |
| 2 | `evidenceObjectId` | CANONICAL_ID | no |
| 3 | `rawContentDigest` | TEXT | no |
| 4 | `sourceKind` | ENUM | no |

Stable key: `SRC:<sourceRevisionId>`.

## 9. Catalog Review

| Tag | Name | Type | Null |
|---:|---|---|---|
| 1 | `catalogReviewId` | CANONICAL_ID | no |
| 2 | `targetRevisionId` | CANONICAL_ID | no |
| 3 | `policyRevisionId` | CANONICAL_ID | no |
| 4 | `decision` | ENUM | no |
| 5 | `reviewedAt` | TIMESTAMP | no |

Stable key: `CREVIEW:<catalogReviewId>`.

## 10. Professional Review

| Tag | Name | Type | Null |
|---:|---|---|---|
| 1 | `professionalReviewEventId` | CANONICAL_ID | no |
| 2 | `professionalReviewId` | CANONICAL_ID | no |
| 3 | `policyRevisionId` | CANONICAL_ID | no |
| 4 | `decision` | ENUM | no |
| 5 | `basisDigest` | TEXT | no |

Stable key: `PREVIEW:<professionalReviewId>:<eventSequence>`.

## 11. Warning and Missing Field

Warning:

| Tag | Name | Type | Null |
|---:|---|---|---|
| 1 | `candidateId` | CANONICAL_ID | no |
| 2 | `warningCode` | ENUM | no |
| 3 | `warningText` | TEXT | no |

Stable key: `WARN:<candidateId>:<warningSequence>`.

Missing Field:

| Tag | Name | Type | Null |
|---:|---|---|---|
| 1 | `candidateId` | CANONICAL_ID | no |
| 2 | `fieldKey` | TEXT | no |
| 3 | `reasonCode` | ENUM | no |

Stable key: `MISS:<candidateId>:<fieldKey>`.

## 12. Registry Rejections

Reject:

- unregistered type/tag;
- duplicate `(type,stableKey)`;
- missing required field;
- duplicate/misordered field tags before canonical sorting;
- type/value mismatch;
- unknown enum;
- missing parent IDs;
- warnings/missing fields without candidate;
- source record without source revision;
- any record whose stableKey changes with display text or query order.
