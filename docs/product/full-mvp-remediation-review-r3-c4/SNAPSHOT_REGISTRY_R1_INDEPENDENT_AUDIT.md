# Snapshot Registry R1 Independent Audit

Date: 2026-11-24

Result:

```text
SNAPSHOT REGISTRY R1: FAIL
REV-R3-C3-P1-02: NOT RESOLVED
```

## 1. Record Type Inventory

| Type | Entity | Field tags | Static structure | Result |
|---:|---|---|---|---|
| 0 | Header | 1–7 | Present | PASS |
| 1 | Requirement Field | 1–7 | Present | FAIL — Basis omits declared source-binding components |
| 2 | Candidate | 1–9 | Present | PASS |
| 3 | Parameter | 1–6 | Present | PASS in Registry; normalized schema mismatch noted separately |
| 4 | Price | 1–6 | Present | FAIL — composed key is ambiguous |
| 5 | Source Revision | 1–4 | Present | PASS in Registry; normalized schema misses `sourceKind` |
| 6 | Catalog Review | 1–5 | Present | PASS in Registry; normalized schema misses two fields |
| 7 | Professional Review | 1–5 | Present | PASS |
| 8 | Warning | 1–3 | Present | PASS in Registry; normalized schema lacks structured sequence |
| 9 | Missing Field | 1–3 | Present | PASS |

## 2. Stable-Key Collision Analysis

The Registry uses:

```text
HEADER:<snapshotId>
REQ:<requirementVersionId>:<fieldKey>
CAND:<candidateId>
PARAM:<candidateId>:<parameterKey>
PRICE:<candidateId>:<priceRevisionId>
SRC:<sourceRevisionId>
CREVIEW:<catalogReviewId>
PREVIEW:<professionalReviewId>:<eventSequence>
WARN:<candidateId>:<warningSequence>
MISS:<candidateId>:<fieldKey>
```

The canonical source identity document explicitly states that IDs may contain
`:`. Ordinary concatenation is therefore not a tuple encoding.

Concrete collision:

```text
Record 1:
  candidateId     = "a:b"
  priceRevisionId = "c"
  stableKey       = "PRICE:a:b:c"

Record 2:
  candidateId     = "a"
  priceRevisionId = "b:c"
  stableKey       = "PRICE:a:b:c"
```

These are different business tuples. Under the uniqueness rule they must be
rejected as a duplicate. The Registry does not prohibit `:` in either canonical
ID.

The same pattern applies to any multi-component key containing two
separator-capable identifiers.

## 3. Empty, NULL, Unicode and Leading-Zero Semantics

- Empty IDs are rejected by `CANONICAL_ID` 1..64.
- Parameter and requirement field keys are catalogue text, but the Registry
  does not define a canonical representation beyond “TEXT”/“typed catalogue
  key.”
- NULL is rejected where tags are required, except typed scalar `value` uses a
  conditional presence rule.
- Unicode/NFC is not consistently specified for stable-key components.
- Leading-zero behavior is not relevant to integer sequence fields because
  their textual canonical form is not explicit.

These missing rules prevent a complete adversarial fixture set.

## 4. Field Order Contradiction

Registry line 177 rejects “misordered field tags before canonical sorting.”
Protocol lines 83–90 require canonical sorting and state input order must not
affect output. Test Plan `C4-BASIS-04` expects reversed input to produce the
same Basis.

At least one of these rules must be changed. The current set cannot be
implemented unambiguously.

## 5. Parent Relationship Audit

The Registry identifies the intended parent for each type, but the normalized
schema does not declare all exact FKs. Controlled function insertion and a
deferred trigger are proposed, but no complete SQL trigger/body is provided.

## 6. Test Coverage

Missing adversarial cases:

- colon-bearing `(candidateId, priceRevisionId)` collision;
- empty or NFC-equivalent key components where permitted;
- multi-segment IDs for all composed keys;
- stableKey length boundary;
- duplicate normalized keys after tuple decoding;
- Registry/schema one-to-one field inventory.

`C4-SNP-10` covers only an already duplicate string. `C4-SNP-11` covers
`sourceKey`, not Snapshot stableKey.

## 7. Required Acceptance

1. Register one versioned tuple encoder for each composed stable key.
2. Define ASCII/UTF-8 byte limits and canonical text rules.
3. Add collision fixtures.
4. Resolve field-order behavior.
5. Regenerate the complete Basis vector.
6. Prove each stable key is derived from immutable structured columns.

