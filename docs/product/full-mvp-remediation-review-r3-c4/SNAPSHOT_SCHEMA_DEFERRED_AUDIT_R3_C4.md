# Snapshot Schema and Deferred Validation Audit R3-C4

Date: 2026-11-24

Results:

```text
SNAPSHOT NORMALIZED SCHEMA: FAIL
DEFERRED VALIDATION: FAIL
DATABASE BEHAVIOR: NOT VERIFIED — DATABASE NOT ACCESSED
```

## 1. Authority Model

The design correctly states that normalized Snapshot rows are the sole
authority and that a JSON/JCS representation is derived. That direction avoids
two writable truths.

The implementation does not yet realize the claim because several fields
required by the Registry are absent from the canonical rows.

## 2. Registry-to-Row Reconciliation

| Registry field | Canonical row field | Result |
|---|---|---|
| Header snapshot/case/project/version/run/registry/protocol | Present in `SalesSnapshotHeaderRecord` | PASS |
| Requirement source kind/entity ID | Present | PASS |
| Requirement source type/aux/sourceKey/FieldValue ID | Not in Registry; present in row | FAIL — not digest protected |
| Parameter candidate/key/type/value/unit/source revision | Present | PASS |
| Price candidate/price revision/amount/currency/tax/applicability | Candidate is via `candidateRowId`; other values present | PARTIAL |
| Source `sourceKind` | Missing from `SalesSnapshotSource` | FAIL |
| Catalog `targetRevisionId` | Missing | FAIL |
| Catalog `policyRevisionId` | Missing | FAIL |
| Professional event/review/policy/decision/basis | Present | PASS |
| Warning candidate/code/text | Present | PASS |
| Warning `warningSequence` | Only embedded in text `stableKey` | FAIL |
| Missing candidate/field/reason | Candidate is via `candidateRowId`; other values present | PARTIAL |

## 3. Parent and Ownership Relationships

Observed:

- `SalesSnapshotRequirementField` has no explicit Snapshot Header FK.
- `SalesSnapshotCandidate` has no explicit Snapshot Header or SelectionCandidate
  FK.
- Parameter/Price/Source/Warning/Missing child FKs bind `candidateRowId` to a
  globally unique Candidate row, but do not enforce same `snapshotId`.
- `SalesSnapshotCatalogReview` has no declared parent/source FK.
- `SalesSnapshotProfessionalReview` has no exact ProfessionalReviewEvent FK.
- `SnapshotBasisMetadata` and `SnapshotValidationResult` have no declared FK to
  Snapshot Header.
- Most “exact” relationships are prose in the deferred check, not table
  constraints.

The controlled create function reduces direct-write risk but does not make the
stated database ownership graph inspectable or immune to a later grant/function
bug.

## 4. State Model

```text
[transaction starts]
        |
        v
 DRAFT Snapshot
   + Header
   + immutable candidate/field/source/review children
   + Basis metadata
        |
        | commit-time validation
  +-----+------+
  |            |
 PASS         FAIL
  |            |
FINALIZED   rollback
  |
advance case pointer
  |
commit
```

This is directionally correct. Static completeness is not established:

- no exact state CHECK/enum definition is shown;
- no `FINALIZED` transition function is fully specified;
- no exact “already finalized cannot be changed” trigger is shown;
- concurrent creation relies on the Case row lock and unique case/version,
  which is conceptually sound.

## 5. Deferred Trigger Audit

Proposed trigger:

```text
AFTER INSERT/UPDATE on child tables
DEFERRABLE INITIALLY DEFERRED
```

Required missing details:

1. exact table/event matrix;
2. Header update trigger;
3. child DELETE handling;
4. trigger function owner;
5. fixed safe `search_path`;
6. REVOKE EXECUTE from PUBLIC/application roles;
7. exact traversal and locking order;
8. final-state query for all required children;
9. exception code/error state;
10. proof that direct mutation of a `FINALIZED` Snapshot is denied.

PostgreSQL constraint triggers do not fire for `TRUNCATE`; revocation and
ownership are required. No database execution was performed.

## 6. Illegal-State Counterexamples

1. Insert parameter row in Snapshot A linked to Candidate row in Snapshot B.
   The shown ID-only FK permits this; the prose trigger claims it will fail but
   has no executable body.
2. Create a Catalog Review row without target/policy. The Registry needs both
   fields, but the canonical row has nowhere to store them.
3. Create a Source row. The Registry needs `sourceKind`, but it is absent.
4. Create a Warning with a stableKey containing sequence 1 but no structured
   sequence. A Basis rebuild cannot distinguish intended sequence from parsed
   display text.
5. Delete a child before finalization when only INSERT/UPDATE triggers are
   declared.

## 7. Required Acceptance

- Exact canonical schema DDL.
- One-to-one Registry mapping.
- Exact composite FKs for every ownership/source relation.
- Exact constraint-trigger DDL and privilege model.
- `INSERT/UPDATE/DELETE` and Header finalization tests.
- Concurrent finalization and rollback tests in an authorized isolated database.
- Basis generated from the actual normalized rows equals the corrected vector.

