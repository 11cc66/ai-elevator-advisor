# ProfessionalReview Candidate NOT NULL R4

## Scope

The two source tables are:

```text
app.selection_professional_review_result
app.sales_snapshot_professional_review_r3
```

Each must expose a non-null `candidate_id` before its composite Candidate FK can
be considered complete.

## Authoritative Backfill

### Selection result

```text
selection_professional_review_result.professional_review_event_id
  -> professional_review_event.id
  -> professional_review_event.candidate_id
```

The Event Candidate is NOT NULL and is already part of the immutable review
identity.

### Sales snapshot

```text
(selection_run_id, professional_review_id, event_sequence)
  -> selection_professional_review_result
  -> candidate_id
```

This is the Selection result primary key. If multiple matching rows existed,
the database primary key would already be violated; the migration never uses
`LIMIT 1`.

## Migration Sequence

```text
install exact Candidate-only guard exception
-> replace sealed/finalized guards with the narrow exception
lock Event/Selection/Snapshot source tables in SHARE ROW EXCLUSIVE mode
backfill Selection Candidate from Event
-> backfill Snapshot Candidate from Selection result
-> fail-closed NULL preflight
-> ALTER both columns SET NOT NULL
-> retain composite Candidate FKs
```

The immutable guards previously rejected all UPDATEs to sealed Selection results
and finalized Snapshot children. R4 does not disable or delete those Trigger
functions. It replaces them with an exact exception:

- old `candidate_id` is NULL;
- new `candidate_id` is non-NULL;
- JSON objects excluding `candidate_id` must be identical;
- only the two exact source tables and only UPDATE are eligible;
- the composite FK still validates the exact Candidate tuple.

The helper is transferred to `elevator_review_function_owner` and removed from
PUBLIC before the guarded backfill. This ensures the Trigger Owner can execute
the helper even after default PUBLIC function privileges are closed.

The same migration transaction locks all four source/target tables before it
reads provenance, so a concurrent Snapshot finalization cannot move the source
set between preflight and backfill.

The deployment runner must execute the Overlay in one transaction and roll back
on any statement failure. The Overlay intentionally contains no internal
`COMMIT` or `ROLLBACK`; otherwise the source freeze and backfill could be split
into different visibility windows.

After backfill, `OLD.candidate_id` is non-NULL, so the exception cannot be used
again on the same row.

If any row remains unresolved, migration aborts with SQLSTATE `23502`. No
default, random or synthetic Candidate is created.

## Integrity Result

After migration:

- Trigger-populated normal insert still derives Candidate identity;
- Trigger bypass by a trusted table owner cannot insert NULL;
- composite FK cannot use a NULL source component to escape;
- wrong Candidate is rejected by the composite FK;
- Event, Selection result, Snapshot and Candidate remain exact;
- business identity is not changed by backfill.

## Mutation Evidence

| Mutation | Detected |
|---|---|
| candidate_id nullable | Yes |
| Overlay backfills but omits NOT NULL | Yes |
| Trigger bypass writes NULL | Yes |
| composite FK has nullable Candidate | Yes |
| backfill invents a Candidate | Yes |
| unresolved history proceeds to NOT NULL | Yes |
| sealed Selection guard blocks backfill | Yes |
| finalized Snapshot guard is over-broad | Yes |
| migration helper permits another field change | Yes |
| helper Owner assigned after guarded backfill | Yes |
| source tables not frozen during backfill | Yes |

## Runtime Boundary

Actual backfill cardinality, row counts, FK enforcement, lock duration and
migration SQLSTATE on existing data remain `NOT VERIFIED — DATABASE NOT AUTHORIZED`.
