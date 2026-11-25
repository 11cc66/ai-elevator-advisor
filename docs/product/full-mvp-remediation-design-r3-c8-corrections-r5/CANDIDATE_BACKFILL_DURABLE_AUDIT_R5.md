# Candidate Backfill Durable Audit R5

## Finding

```text
REV-R4-IND-P2-03
Status: RESOLVED — DESIGN
```

The R4 direct bulk UPDATE changed sealed/finalized rows without durable per-row
before/after evidence.

R5 removes that uncontrolled UPDATE from the complete DDL. Candidate
materialization is permitted only through
`app_private.execute_candidate_backfill_r5`, which is owned by the review
function owner and not executable by PUBLIC or runtime roles.

## Batch Contract

`app.candidate_backfill_batch_r5` records:

- batch and request identity;
- target table;
- expected, applied and failed counts;
- policy version;
- actor Principal, Session and Authority Grant;
- reason;
- state, timestamps and batch digest.

`request_id` is UNIQUE. The function claims the batch with
`ON CONFLICT (request_id) DO NOTHING`. A completed replay returns the stored
non-NULL result only when the request hash, target and actor identity all match.
A different request cannot reuse another batch.

## Row Contract

For every target row, `app.candidate_backfill_row_audit_r5` records:

| Required evidence | R5 column |
|---|---|
| Audit and batch | `id`, `batch_id` |
| Target identity | `target_table`, `target_row_key`, `target_row_key_digest` |
| Exact old state | `old_candidate_was_null=true`, `old_candidate_id=NULL` |
| Resolved state | `new_candidate_id` |
| Authoritative source | `provenance_type`, `provenance_record_id`, `provenance_version` |
| Policy | `provenance_policy_version` |
| Parent state | `target_parent_state` |
| Row integrity | `old_row_digest`, `new_row_digest` |
| Sealed proof | `original_sealed_digest` |
| Historical revision proof | `correction_digest` |
| Actor and reason | Principal, Session, Grant and reason |
| General audit link | `audit_event_id -> review_audit(id)` |
| Outcome | `occurred_at`, `success=true` |

The unique `(batch_id,target_table,target_row_key_digest)` constraint prevents
duplicate row evidence. The audit table is append-only.

## Ordering and Atomicity

For each row:

```text
lock target row
-> resolve exact authoritative source
-> compute old/new row digests
-> compute correction digest
-> insert review_audit
-> insert candidate_backfill_row_audit_r5
-> UPDATE candidate_id WHERE candidate_id IS NULL
-> require ROW_COUNT = 1
```

The table audit insert and row update share one PostgreSQL transaction. An
Event/audit failure, row-count mismatch, FK failure, missing source or count
mismatch rolls back the audit and data updates together.

## Count and Freeze Rules

- Expected rows are supplied explicitly and compared with a locked count.
- The actual applied count must equal expected.
- Any failed row count prevents COMPLETED.
- Event, Selection, Snapshot Header and Snapshot Review tables are locked in
  `SHARE ROW EXCLUSIVE` mode for the controlled transaction.
- Selection source is the exact `professional_review_event.id`.
- Snapshot source is the exact Selection primary key
  `(selection_run_id,professional_review_id,event_sequence)`.
- No `LIMIT 1`, random Candidate or default Candidate is used.
- Only NULL to non-NULL Candidate is updated.

## Deployment Boundary

The Complete DDL is not a one-shot executable migration. A separately approved
maintenance identity must invoke one controlled batch for each target table
before the final NULL preflight and NOT NULL closure. That identity/provisioning
decision remains OPEN.

## Evidence

`R4-CAND-01..11`, `IND-MUT-15..19/21`, and Candidate state checks pass in the
offline suite. Actual row cardinality, Trigger order, lock duration and
SQLSTATE remain `NOT VERIFIED`.

