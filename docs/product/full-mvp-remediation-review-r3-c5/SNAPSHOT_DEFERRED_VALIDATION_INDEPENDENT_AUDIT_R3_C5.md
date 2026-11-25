# Snapshot Deferred Validation Independent Audit

Date: 2026-11-24

Result:

```text
Deferred Validation: FAIL
DATABASE: NOT ACCESSED
```

## 1. Positive Design

- Case-first lock order is defined.
- Child triggers are deferred to commit.
- INSERT/UPDATE/DELETE are listed.
- TRUNCATE is separated from constraint-trigger scope.
- Finalized mutation guards are described.
- Transaction traces TX-A through TX-G cover key races.
- Source revisions are locked before Snapshot construction.

## 2. Blocking Schema Gap

The CAS example uses undefined `version_vector`:

```sql
UPDATE ... WHERE id=... AND state='DRAFT'
             AND version_vector=expected;
```

The Snapshot table has no `version_vector` column. The existing `version_number`
is a Snapshot business version and does not provide mutation/version CAS.

## 3. Incomplete Trigger DDL

Only the Header guard contains a real function body. The child guard and
TRUNCATE guard remain prose. `validate_snapshot_change()` is referenced but not
defined. `validate_snapshot_r2(...)` contains `BEGIN ... END`.

Missing exact definitions:

- trigger function owner;
- fixed search_path per function;
- EXECUTE revokes and owner assignments;
- Header deferred trigger DDL;
- child trigger attachments;
- TRUNCATE trigger attachments;
- exception details and idempotent behavior.

## 4. Final-State Validation Gaps

The validator cannot yet prove:

- candidate revision identity matches SelectionCandidateResult;
- Price source/validity is correct;
- Parameter catalog revision matches source;
- Warning ties are deterministic;
- Policy Event is valid/effective;
- one authoritative Basis metadata row is immutable;
- validation result references the current Basis.

## 5. Concurrency Assessment

Static ordering is plausible:

```text
Case -> Snapshot -> Requirement/Run -> source/review -> Basis/children
```

If every writer takes the parent Snapshot lock, finalization and child update
serialize. But the child guard is not actual DDL, so this cannot be verified as
implemented behavior.

## 6. Transaction Trace Comments

| Trace | Review |
|---|---|
| TX-A incomplete then complete | concept valid |
| TX-B commit incomplete | concept valid |
| TX-C concurrent finalize | requires missing CAS field |
| TX-D child mutation during finalize | requires child guard DDL |
| TX-E finalized mutation | privileges + guard; partly prose |
| TX-F source deletion/move | FK design mostly good |
| TX-G truncate | no exact trigger DDL |

## 7. Required Acceptance

- exact executable DDL;
- defined CAS field/condition;
- full validator body;
- all table/event trigger attachments;
- object owner/privileges;
- isolated authorized DB tests for every TX-A..TX-G;
- proof all illegal final states roll back.

