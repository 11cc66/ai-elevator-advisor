# Candidate NOT NULL and Backfill Review R4

## Original Finding

```text
REV-R3-R3-P3-01:
RESOLVED — INDEPENDENT STATIC REVIEW
```

Both source columns now have real NOT NULL constraints:

```text
app.selection_professional_review_result.candidate_id
app.sales_snapshot_professional_review_r3.candidate_id
```

The composite Candidate FKs remain structurally valid:

```text
(selection_candidate_result_id,candidate_id,result_row_digest)
  -> (id,candidate_id,row_digest)
```

## Authoritative Backfill

Selection source:

```text
professional_review_event.id
  -> selection_professional_review_result.professional_review_event_id
  -> Event.candidate_id
```

Snapshot source:

```text
(selection_run_id,professional_review_id,event_sequence)
  -> Selection Result primary key
  -> Selection.candidate_id
```

Both joins are unique. No default/random Candidate or `LIMIT 1` was found.
Rows that remain NULL abort with `23502` before NOT NULL.

## Sealed/Finalized Exception

The helper accepts only:

```text
OLD.candidate_id IS NULL
NEW.candidate_id IS NOT NULL
all other JSONB fields equal
```

The exact table and UPDATE conditions are checked in both existing immutable
guards. Trigger execution order is statically compatible:

```text
Selection: guard -> Candidate bind
Snapshot: R3 source bind -> guard -> Candidate bind -> digest verify
```

The helper is owned by the Trigger Owner and PUBLIC execution is revoked before
backfill. The migration acquires `SHARE ROW EXCLUSIVE` locks on Event,
Selection, Snapshot Header and Snapshot Review tables.

The Candidate is not included directly in the existing row digest, but it is
determined indirectly by the already-digested Selection Result ID and result
row digest plus the composite FK. No digest/actual-field contradiction was
found.

## New Finding — Missing Durable Audit

```text
REV-R4-IND-P2-03
Severity: P2
```

The backfill at Complete DDL lines 15568-15612 performs plain bulk UPDATEs and
does not:

- `RETURNING` changed keys into an evidence table;
- record before/after state;
- append Audit Events;
- attest affected row counts; or
- retain a per-row provenance digest.

The narrow guard protects value correctness, but it does not preserve an
auditable record of the immutable-row migration.

Minimum correction: add a transaction-scoped append-only backfill evidence
table/event containing source table, exact row key, old NULL marker, resolved
Candidate, authoritative source identity, and batch digest/count; compare its
rows to UPDATE `ROW_COUNT` before COMMIT.

## Historical Classification

```text
Safe automatic:
  exact Event/Selection source exists and composite FK accepts Candidate

Manual review:
  source is present but deployment evidence requires reconciliation

Blocked:
  source missing, Candidate remains NULL, FK/digest mismatch, lock acquisition failure

Unknown:
  existing deployed row cardinality is not available in this authorized scope
```

No actual historical row is claimed migrated.

## Verification Boundary

Trigger order, lock waits, row counts, FK validation and SQLSTATE remain
`NOT VERIFIED` without PostgreSQL.
