# Snapshot Registry R3-C6

Status:

```text
REGISTRY: SNAPSHOT-R3
PROTOCOL: R3-BASIS-1-R6
STABLE KEY: SK-R2 with registry code 3
```

## 1. Global Rules

- record types are exactly `0..9`;
- field tags are record-local, unique and all present;
- semantic input may be unordered; canonical output sorts field tags;
- encoded wire input must already be sorted;
- stable keys are complete SK-R2 bytes with registry code 3;
- row IDs are printable ASCII 1..64;
- unknown record/tag/version rejects.

## 2. Header (Type 0)

| Tag | Field | Type |
|---:|---|---|
| 1 | snapshotId | CANONICAL_ID |
| 2 | caseId | CANONICAL_ID |
| 3 | projectId | CANONICAL_ID |
| 4 | conversationId | CANONICAL_ID |
| 5 | requirementId | CANONICAL_ID |
| 6 | requirementVersionId | CANONICAL_ID |
| 7 | installationScenario | ENUM |
| 8 | selectionRunId | CANONICAL_ID |
| 9 | ruleSetRevisionId | CANONICAL_ID |
| 10 | ruleSetContentDigest | TEXT |
| 11 | basisAsOf | TIMESTAMP |
| 12 | registryRevision | ENUM `SNAPSHOT-R3` |
| 13 | protocolRevision | ENUM `R3-BASIS-1-R6` |
| 14 | stableKeyEncoding | ENUM `SK-R2` |

## 3. Requirement Field (Type 1)

| Tag | Field | Type | Null |
|---:|---|---|---|
| 1 | fieldKey | TEXT | no |
| 2 | valueType | ENUM | no |
| 3 | value | typed scalar | yes |
| 4 | unit | TEXT | yes |
| 5 | fieldStatus | ENUM | no |
| 6 | sourceFieldValueId | CANONICAL_ID | no |
| 7 | sourceKind | ENUM | no |
| 8 | sourceEntityType | ENUM | no |
| 9 | sourceEntityId | CANONICAL_ID | no |
| 10 | sourceAuxId | TEXT NFC | yes |
| 11 | sourceKey | BYTES SOURCE_KEY_R3 | no |

## 4. Candidate (Type 2)

| Tag | Field | Type | Null |
|---:|---|---|---|
| 1 | selectionResultItemId | CANONICAL_ID | no |
| 2 | candidateId | CANONICAL_ID | no |
| 3 | productId | CANONICAL_ID | no |
| 4 | productRevisionId | CANONICAL_ID | no |
| 5 | productRevisionDigest | TEXT | no |
| 6 | specificationRevisionId | CANONICAL_ID | no |
| 7 | specificationRevisionDigest | TEXT | no |
| 8 | priceRevisionId | CANONICAL_ID | yes |
| 9 | ruleSetRevisionId | CANONICAL_ID | no |
| 10 | technicalStatus | ENUM | no |
| 11 | commercialStatus | ENUM | no |
| 12 | trustStatus | ENUM | no |
| 13 | professionalReviewStatus | ENUM | no |
| 14 | overallStatus | ENUM | no |

## 5. Parameter (Type 3)

| Tag | Field | Type | Null |
|---:|---|---|---|
| 1 | candidateId | CANONICAL_ID | no |
| 2 | catalogParameterRevisionId | CANONICAL_ID | no |
| 3 | parameterKey | TEXT | no |
| 4 | valueType | ENUM | no |
| 5 | value | typed scalar | no |
| 6 | unit | TEXT | yes |
| 7 | sourceRevisionId | CANONICAL_ID | no |

## 6. Price (Type 4)

| Tag | Field | Type | Null |
|---:|---|---|---|
| 1 | candidateId | CANONICAL_ID | no |
| 2 | priceRevisionId | CANONICAL_ID | no |
| 3 | productRevisionId | CANONICAL_ID | no |
| 4 | sourceRevisionId | CANONICAL_ID | no |
| 5 | amountMinor | INTEGER | no |
| 6 | currency | ENUM | no |
| 7 | priceBasis | ENUM | no |
| 8 | taxBasis | ENUM | no |
| 9 | applicability | ENUM | no |
| 10 | validFrom | TIMESTAMP | no |
| 11 | validUntil | TIMESTAMP | yes |
| 12 | quotedAt | TIMESTAMP | no |

## 7. Source Revision (Type 5)

| Tag | Field | Type |
|---:|---|---|
| 1 | sourceRevisionId | CANONICAL_ID |
| 2 | evidenceObjectId | CANONICAL_ID |
| 3 | rawContentDigest | TEXT |
| 4 | sourceKind | ENUM |
| 5 | capturedAt | TIMESTAMP |

## 8. Catalog Review (Type 6)

| Tag | Field | Type |
|---:|---|---|
| 1 | catalogReviewId | CANONICAL_ID |
| 2 | targetRevisionId | CANONICAL_ID |
| 3 | sourceRevisionId | CANONICAL_ID |
| 4 | policyRevisionId | CANONICAL_ID |
| 5 | decision | ENUM |
| 6 | reviewedAt | TIMESTAMP |

## 9. Professional Review (Type 7)

| Tag | Field | Type |
|---:|---|---|
| 1 | professionalReviewEventId | CANONICAL_ID |
| 2 | professionalReviewId | CANONICAL_ID |
| 3 | eventSequence | INTEGER |
| 4 | policyRevisionId | CANONICAL_ID |
| 5 | decision | ENUM |
| 6 | basisDigest | TEXT |
| 7 | occurredAt | TIMESTAMP |

## 10. Warning (Type 8)

| Tag | Field | Type |
|---:|---|---|
| 1 | candidateId | CANONICAL_ID |
| 2 | sourceWarningId | CANONICAL_ID |
| 3 | warningSequence | INTEGER |
| 4 | severity | ENUM |
| 5 | warningCode | ENUM |
| 6 | warningText | TEXT |

Warning sequence is assigned by:

```text
sort(warningCode, warningText, sourceWarningId)
```

All three tie-break fields are present in the canonical record.

## 11. Missing Field (Type 9)

| Tag | Field | Type |
|---:|---|---|
| 1 | candidateId | CANONICAL_ID |
| 2 | fieldKey | TEXT |
| 3 | reasonCode | ENUM |
| 4 | impactScope | ENUM |

`reasonCode` includes:

```text
NOT_PROVIDED
NOT_APPLICABLE
UNRECOGNIZED
INSUFFICIENT_DATA
SOURCE_UNAVAILABLE
CONFLICTED
```

`impactScope` includes:

```text
REQUIREMENT_COMPLETENESS
INSTALLATION_FEASIBILITY
SELECTION_ELIGIBILITY
PRICING
PROFESSIONAL_REVIEW
```

## 12. Rejections

Unknown version/tag/type, missing fields, duplicate tags, duplicate stable key
or row ID, source-key mismatch, provenance mismatch, cross-Snapshot relation,
oversized scalar, invalid UTF-8/NFC and trailing bytes all reject.

