# Selection Provenance Database Integrity Design R3-C7

Artifact: `SELECTION_PROVENANCE_DATABASE_INTEGRITY_DESIGN_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. Result

```text
SELECTION PROVENANCE: PASS (static DDL design)
RUNTIME CONSTRAINT BEHAVIOR: NOT VERIFIED
```

The design replaces isolated IDs with context-bearing composite keys. Each
child repeats only the tuple required to reference one exact immutable parent.

## 2. Context Key

The base context tuple is:

```text
project_id, conversation_id, requirement_id,
requirement_version_id, installation_scenario
```

`requirement_version` owns that tuple. `sales_case` references it and carries a
monotonic case mutation version. `selection_run` references the exact Case
tuple and exact RuleSet `(id,content_digest)`.

## 3. Seal Boundary

`selection_run_seal` is a one-row immutable child of a SEALED SelectionRun. It
contains:

- the exact run + Case + context + RuleSet tuple;
- nonempty candidate count;
- canonical result digest;
- seal timestamp.

A Snapshot has an FK only to `selection_run_seal`, not to an arbitrary
SelectionRun. It cannot cite an unsealed run by changing an application query.

## 4. Candidate Boundary

`selection_candidate` references:

- exact SelectionRun/context/RuleSet tuple;
- ProductRevision `(product_id,id,digest)`;
- SpecificationRevision
  `(product_id,product_revision_id,id,digest)`.

Price and parameter are separate non-null child rows. This avoids a nullable
multi-column price FK that could skip the composite check under SQL NULL
semantics.

`selection_candidate_result` references the complete candidate key, including
run, context, RuleSet, ProductRevision and SpecificationRevision.

## 5. Finalization

`seal_selection_run`:

1. locks the active trusted session;
2. locks the run `FOR UPDATE`;
3. checks RUNNING and expected mutation version;
4. requires one result per candidate and nonempty results;
5. computes a canonical result digest from ordered immutable fields;
6. updates RUNNING -> SEALED with CAS;
7. inserts the immutable seal row;
8. commits all steps together.

Any later mutation on candidate/result/parameter/price rows is rejected by the
sealed-result trigger.

## 6. Snapshot Boundary

`create_snapshot_r3` accepts only:

```text
snapshot_id
sealed_selection_run_id
expected_case_version
```

Case, context, RuleSet and result authority are selected from the seal. The
function no longer accepts an independent RequirementVersion or Scenario.

## 7. Required Future Database Proof

Run `C7-PROV-01..12` on an authorized isolated PostgreSQL 18 instance and prove
each named FK/trigger rejects. Until then this document is design evidence only.
