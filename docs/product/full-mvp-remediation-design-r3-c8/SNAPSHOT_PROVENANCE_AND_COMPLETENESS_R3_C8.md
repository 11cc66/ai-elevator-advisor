# Snapshot Provenance and Completeness R3-C8

## 1. Candidate Binding

The Snapshot Candidate stores the full selection result context and revision
fields. It references the exact SelectionCandidateResult row through:

```text
selection_result_item_id
candidate_id
selection_run_id
result_row_digest
```

The source row digest is computed by the Selection Result digest trigger from
the complete canonical row: context, RuleSet ID/digest, Product ID/revision/
digest, Specification ID/digest and all five statuses.

The Snapshot Candidate has an equal `result_row_digest`; its digest trigger
recomputes the copied row and rejects any mismatch.

## 2. Other Child Binding

RequirementField, Source, CatalogReview, ProfessionalReview, Warning and
MissingField source tables have canonical row digests. Snapshot children store
`source_row_digest` and have:

- an exact FK to the source row/digest;
- a BEFORE INSERT/UPDATE trigger that recomputes the copied logical payload.

Selection Candidate Price/Parameter and their Snapshot counterparts use the
same source-digest scheme. Price and Parameter immutable revision FKs remain.

## 3. Required Set Equality

`require_no_active_snapshot_children_r3` compares both directions with `EXCEPT`
for:

- candidates;
- requirement fields;
- sources;
- catalogue reviews;
- professional review events;
- warnings;
- missing fields;
- parameters;
- prices.

Omission, replacement, duplicate or cross-run insertion causes a source-set
mismatch and blocks FINALIZED.

## 4. Freeze Boundary

Once a SelectionRun is SEALED:

- candidate, result, price, parameter, source, review, warning and missing rows
  reject INSERT/UPDATE/DELETE;
- direct selection evidence tables reject TRUNCATE through named guards;
- the seal row is immutable;
- all Runtime roles have no direct table DML.

## 5. Final Validation

Snapshot finalization runs:

```text
deferred trigger
  -> complete source-set comparison
  -> digest-bound child checks
  -> Price basisAsOf checks
  -> warning ordering checks
  -> RuleSet binding checks
  -> exact Basis rebuild/verification
  -> metadata byte/count checks
```

Failure rolls back the whole transaction. No partial FINALIZED Snapshot is
returned.

## 6. C6 Compatibility

The C6-SNAP-01 bytes remain:

```text
15 records
4036 bytes
7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB
```

The C8 source-digest and completeness mechanisms do not alter the wire format.
