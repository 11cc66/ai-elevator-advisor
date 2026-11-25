# Candidate / Parameter / Price Revision Binding R3-C6

## 1. Candidate Basis Fields

| Tag | Field | Type |
|---:|---|---|
| 1 | selectionResultItemId | CANONICAL_ID |
| 2 | candidateId | CANONICAL_ID |
| 3 | productId | CANONICAL_ID |
| 4 | productRevisionId | CANONICAL_ID |
| 5 | productRevisionDigest | TEXT |
| 6 | specificationRevisionId | CANONICAL_ID |
| 7 | specificationRevisionDigest | TEXT |
| 8 | priceRevisionId | CANONICAL_ID/null |
| 9 | ruleSetRevisionId | CANONICAL_ID |
| 10 | technicalStatus | ENUM |
| 11 | commercialStatus | ENUM |
| 12 | trustStatus | ENUM |
| 13 | professionalReviewStatus | ENUM |
| 14 | overallStatus | ENUM |

Snapshot Candidate FKs to the exact immutable SelectionCandidateResult key.

## 2. Parameter Basis Fields

| Tag | Field | Type |
|---:|---|---|
| 1 | candidateId | CANONICAL_ID |
| 2 | catalogParameterRevisionId | CANONICAL_ID |
| 3 | parameterKey | TEXT |
| 4 | valueType | ENUM |
| 5 | value | typed scalar |
| 6 | unit | TEXT/null |
| 7 | sourceRevisionId | CANONICAL_ID |

Schema FK:

```text
(catalogParameterRevisionId, parameterKey, valueType,
 sourceRevisionId, snapshotId)
-> CatalogParameterRevision(
   id, parameterKey, valueType, sourceRevisionId, snapshotId)
```

The actual CatalogParameterRevision row is immutable and bound to its catalog
entity/source revision. Its ID is in the Basis.

## 3. Price Basis Fields

| Tag | Field | Type |
|---:|---|---|
| 1 | candidateId | CANONICAL_ID |
| 2 | priceRevisionId | CANONICAL_ID |
| 3 | productRevisionId | CANONICAL_ID |
| 4 | sourceRevisionId | CANONICAL_ID |
| 5 | amountMinor | INTEGER |
| 6 | currency | ENUM |
| 7 | priceBasis | ENUM |
| 8 | taxBasis | ENUM |
| 9 | applicability | ENUM |
| 10 | validFrom | TIMESTAMP |
| 11 | validUntil | TIMESTAMP/null |
| 12 | quotedAt | TIMESTAMP |

Exact PriceRevision FK includes all immutable dimensions and source revision.

## 4. Price Time Semantics

The Snapshot records the historical selected price at its own `basisAsOf`.
Finalization does not silently substitute a newer current price.

Validity at finalization:

```text
valid_from <= basis_as_of
AND (valid_until IS NULL OR basis_as_of <= valid_until)
```

An expired price can be included only if the Candidate is explicitly marked
`PRICE_EXPIRED`/`REQUIRES_QUOTE`; such a Snapshot cannot become Operational.

## 5. Required Rejections

- parameter revision belongs to another candidate/key/type/source;
- price revision belongs to another candidate/product;
- price source missing;
- price currency/basis mismatch with PriceRevision;
- Candidate revision mismatches SelectionResult;
- finalized price/source update;
- price row references another Snapshot's Source Revision.

