# Snapshot Transaction, Concurrency and CAS Design R3-C6

## 1. Isolation

Use `READ COMMITTED` plus explicit row locks. Do not claim serializable isolation
is required.

## 2. Lock Order

```text
SalesCase FOR UPDATE
  -> SelectionRun FOR SHARE
  -> RequirementVersion FOR SHARE
  -> Product/Specification/Price/Parameter revisions ORDER BY id FOR SHARE
  -> Snapshot row FOR UPDATE
  -> canonical child rows
  -> Basis metadata
```

Every mutation of a DRAFT child locks its Snapshot parent first. Therefore a
concurrent finalization and child update have one serial order.

## 3. Finalization CAS

The `mutation_version` column exists. Finalization is allowed only by:

```sql
UPDATE app.sales_handoff_snapshot_r3
SET state='FINALIZED',
    finalized_at=now(),
    mutation_version=mutation_version+1
WHERE id=p_snapshot_id
  AND state='DRAFT'
  AND mutation_version=p_expected_mutation_version;
```

One row = success, zero rows = conflict. The deferred trigger validates final
state before COMMIT.

## 4. Transaction Table

| Scenario | Result |
|---|---|
| incomplete draft completed before commit | accept |
| incomplete draft commit | deferred validation rollback |
| two finalizers | row/CAS one winner |
| child update during finalization | lock serializes; invalid post-final mutation fails |
| source revision replacement | sealed/source revision immutability rejects |
| parent delete | FK/restrict and header guard reject |
| truncate | privilege and statement trigger reject |
| COMMIT unknown | re-read Snapshot/request by durable identity |

## 5. Retry

Retry only:

```text
40001 serialization_failure
40P01 deadlock_detected
```

Do not retry validation, authorization, session revocation, CAS mismatch or
immutable-data errors.

## 6. Why No Lost Update

- Finalizer holds Snapshot row lock.
- Child mutator must lock same parent row.
- Finalization CAS includes explicit mutation version.
- Deferred validator rechecks final rows and Basis.
- Any stale Basis metadata after child mutation fails exact byte reconstruction.

