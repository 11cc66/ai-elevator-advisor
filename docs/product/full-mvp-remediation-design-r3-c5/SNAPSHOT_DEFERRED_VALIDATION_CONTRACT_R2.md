# Snapshot Deferred Validation Contract R2

Status:

```text
DDL DESIGN
NOT EXECUTED
DATABASE BEHAVIOR NOT VERIFIED
```

## 1. Invariant

A Snapshot may commit as `FINALIZED` only if:

- all canonical rows belong to that Snapshot;
- every required child set is complete exactly once;
- every structured business tuple matches its `SK-R2` bytes;
- every source binding is complete and exact;
- the Basis metadata identifies an immutable Basis;
- the independent Basis verifier reproduces the exact bytes and digest;
- no child changed after finalization.

## 2. Protected Objects

```text
sales_handoff_snapshot
sales_snapshot_basis_metadata
sales_snapshot_validation_result
sales_snapshot_requirement_field
sales_snapshot_candidate
sales_snapshot_parameter
sales_snapshot_price
sales_snapshot_source
sales_snapshot_catalog_review
sales_snapshot_professional_review
sales_snapshot_warning
sales_snapshot_missing_field
```

## 3. Finalization Path

The controlled function `app.create_snapshot_r2(...)` uses this order:

1. lock the Sales Case row `FOR UPDATE`;
2. lock the exact RequirementVersion and SelectionRun `FOR SHARE`;
3. lock source/review revisions in ascending ID order `FOR SHARE`;
4. insert Snapshot envelope with `state=DRAFT`;
5. insert all canonical child rows in record-type order;
6. recompute each stable key from structured columns;
7. build canonical Basis with the generating implementation;
8. independently decode and rebuild it with the verifier implementation;
9. insert Basis metadata;
10. run final-state validation;
11. update `DRAFT -> FINALIZED` with CAS on the expected version;
12. advance the Case pointer;
13. append AuditEvent;
14. commit.

Deferred triggers repeat the final-state validation at COMMIT. Intermediate
incompleteness is allowed only inside this transaction.

## 4. Immediate Triggers

### 4.1 Header Mutation Guard

```sql
CREATE FUNCTION app_private.guard_snapshot_header()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app_private
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'snapshot header delete denied' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.state = 'FINALIZED' THEN
    RAISE EXCEPTION 'finalized snapshot is immutable' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.case_id IS DISTINCT FROM OLD.case_id
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
       OR NEW.requirement_id IS DISTINCT FROM OLD.requirement_id
       OR NEW.requirement_version_id IS DISTINCT FROM OLD.requirement_version_id
       OR NEW.installation_scenario IS DISTINCT FROM OLD.installation_scenario
       OR NEW.selection_run_id IS DISTINCT FROM OLD.selection_run_id
       OR NEW.rule_set_revision_id IS DISTINCT FROM OLD.rule_set_revision_id
       OR NEW.version_number IS DISTINCT FROM OLD.version_number THEN
      RAISE EXCEPTION 'snapshot identity is immutable' USING ERRCODE = '23514';
    END IF;

    IF OLD.state = 'DRAFT' AND NEW.state = 'FINALIZED' THEN
      NULL;
    ELSIF NEW.state IS DISTINCT FROM OLD.state THEN
      RAISE EXCEPTION 'illegal snapshot state transition' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_snapshot_header
BEFORE UPDATE OR DELETE ON app.sales_handoff_snapshot
FOR EACH ROW EXECUTE FUNCTION app_private.guard_snapshot_header();
```

### 4.2 Child Mutation Guard

The child guard obtains `OLD.snapshot_id` or `NEW.snapshot_id`, locks the
Snapshot row, and rejects:

- INSERT/UPDATE/DELETE when the parent is `FINALIZED`;
- UPDATE/DELETE from an ordinary direct-DML path;
- any UPDATE that changes `id`, `snapshot_id`, `record_type`, `row_id` or
  `stable_key` after insertion.

The controlled creation function executes in a DRAFT Snapshot. It has a
separate scoped privilege path. No runtime web/worker/reviewer role receives
direct INSERT/UPDATE/DELETE on canonical Snapshot tables.

### 4.3 TRUNCATE

PostgreSQL row triggers do not fire for `TRUNCATE`. Protection therefore uses
both:

- no runtime `TRUNCATE` grant;
- a `BEFORE TRUNCATE ... FOR EACH STATEMENT` guard that unconditionally raises;
- protected table ownership outside all runtime/migration identities.

The same is required for validation-result tables and metadata.

## 5. Deferred Constraint Triggers

Each canonical child table and Basis metadata table receives:

```sql
CREATE CONSTRAINT TRIGGER deferred_validate_snapshot
AFTER INSERT OR UPDATE OR DELETE ON app.<canonical_table>
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION app_private.validate_snapshot_change();
```

Tables:

```text
sales_snapshot_basis_metadata
sales_snapshot_requirement_field
sales_snapshot_candidate
sales_snapshot_parameter
sales_snapshot_price
sales_snapshot_source
sales_snapshot_catalog_review
sales_snapshot_professional_review
sales_snapshot_warning
sales_snapshot_missing_field
```

The Header also receives a deferred trigger for `INSERT OR UPDATE`. The trigger
uses `NEW/OLD.id`; child triggers use `COALESCE(NEW.snapshot_id,
OLD.snapshot_id)`.

Multiple events may invoke validation more than once. The validator is
idempotent and reads final transaction state, so duplicate invocation does not
change acceptance.

## 6. Validator

```sql
CREATE FUNCTION app_private.validate_snapshot_r2(p_snapshot_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app_private
AS $$ BEGIN ... END; $$;
```

Validation checklist:

1. Snapshot row exists and is `FINALIZED`.
2. Exactly one Basis metadata row exists.
3. Registry=`SNAPSHOT-R2`, Protocol=`R3-BASIS-1-R5`,
   encoding=`SK-R2`.
4. Header has exactly one canonical header record perspective.
5. All child rows have the exact Snapshot context.
6. Candidate set equals the immutable SelectionRun candidate set.
7. Each required candidate/value/review/price/source set is complete.
8. Required absence is represented by an explicit MissingField row where
   policy requires a missing-field record.
9. No NULL is permitted in ownership/source/stable-key fields.
10. `source_aux_is_null` and text representation are valid.
11. Every `source_key` equals `source_key_r3(...)`.
12. Every `stable_key` equals the registered `SK-R2` tuple bytes.
13. Structured business UNIQUE and row counts match.
14. The verifier independently rebuilds the complete Basis from rows.
15. Rebuilt length, record count, bytes and SHA-256 equal metadata.
16. No child references another Snapshot/Case/Project/Run.
17. No finalized child can have been inserted, updated or deleted after the
    finalizing transaction's final state was established.

Failure raises an exception with SQLSTATE `23514`; the transaction rolls back.

## 7. Basis Verification Boundary

The generator and verifier must not share the same implementation object.

Allowed deployments remain subject to `OD-R3-C2-04`:

```text
application generator + independent SQL verifier
SQL generator + independent application verifier
separate evidence/signing verifier
```

Until that decision is approved, implementation remains blocked. This contract
does not approve a database extension or deployment topology.

## 8. Locking and Isolation

Lock order:

```text
Sales Case
  -> Snapshot
  -> RequirementVersion / SelectionRun
  -> source and review revisions ordered by text ID
  -> Basis metadata and children
```

Creation uses `READ COMMITTED` plus explicit row locks. Finalization uses an
expected Snapshot version/state condition:

```text
UPDATE ... SET state='FINALIZED'
WHERE id = p_snapshot_id AND state='DRAFT' AND version_vector = expected
```

Only `40001` serialization failures and `40P01` deadlocks are eligible for a
bounded retry. Commit-unknown is resolved by re-reading durable Snapshot state,
not by assuming rollback.

## 9. Transaction Traces

| Trace | Final-state behavior |
|---|---|
| TX-A insert incomplete, then complete, commit | Allowed; deferred validation sees complete final state |
| TX-B insert incomplete then commit | Rejected `23514`; all rows roll back |
| TX-C two concurrent Finalize | Case/Snapshot lock and CAS allow one winner; loser conflicting |
| TX-D modify child while another finalizes | Child mutation first causes validation failure, or finalization wins and later mutation is denied |
| TX-E modify FINALIZED Snapshot | Immediate header/child guard and privileges deny |
| TX-F delete/move source binding | FK `RESTRICT` and finalized mutation guard deny |
| TX-G TRUNCATE | Statement guard plus no privilege deny |

## 10. Post-Finalization

After `FINALIZED`:

- header identity/state/digest inputs are immutable;
- child insert/update/delete is denied;
- source bindings are immutable;
- validation results are append-only;
- only a separate immutable quarantine/integrity event may describe later
  mismatch;
- a correction creates a new Snapshot version, never mutates the old Basis.

Database behavior is `NOT VERIFIED — DATABASE NOT ACCESSED`.

