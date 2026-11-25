# Selection Provenance Independent Audit R3-C7

## Result

```text
SELECTION PROVENANCE: FAIL
CANDIDATE BINDING: FAIL
PARAMETER BINDING: PARTIAL
PRICE BINDING: PASS — static constraints
RULESET BINDING: PARTIAL
```

## Correct Improvements

- SelectionRun references SalesCase context and RuleSet ID/digest.
- SelectionCandidate references SelectionRun, ProductRevision, and
  SpecificationRevision with composite keys.
- SelectionCandidateResult references the complete SelectionCandidate tuple.
- Snapshot Header references `selection_run_seal`, preventing direct reference
  to an unsealed run.
- Snapshot Parameter/Price rows have exact candidate and catalogue/price parent
  composite keys.

## P1-01 Counterexample

`sales_snapshot_candidate_r3` stores Product, ProductRevision, Specification,
RuleSet and status fields, but its result FK uses only:

```text
(selection_result_item_id,candidate_id,selection_run_id)
```

No FK binds the stored Product/Specification/RuleSet values to the referenced
SelectionCandidateResult. No direct ProductRevision/SpecificationRevision FK is
shown on SnapshotCandidate.

A row can therefore reference a valid result while displaying a different
product/specification/ruleset tuple. The final Basis would encode the false
tuple and still pass the local validation shown.

## P1-02 Counterexample

RequirementField, Source, CatalogReview, ProfessionalReview, Warning and
MissingField tables link by IDs only or header context. Their Basis-visible
content fields are not proven equal to the sealed source rows.

`require_no_active_snapshot_children_r3` validates only candidate count and
parameter/price orphans. It does not require:

- one snapshot source per sealed source;
- one requirement field per sealed field;
- one review/event per sealed review;
- all warnings/missing fields;
- exact copied value/digest equality.

Removing or altering those rows can produce a smaller, internally valid Basis.

## Price/RuleSet

The PriceRevision parent key includes Product, ProductRevision, Specification,
Source, currency, basis, tax, applicability and time fields. The Snapshot Price
row references that exact key. This part is structurally sound.

RuleSet ID/digest are present in SelectionRun, Seal, Snapshot Header and Basis,
but Snapshot Candidate’s RuleSet fields are not part of its result FK. Therefore
the overall RuleSet binding remains partial.

## Required Acceptance

All `PROV-01..12` cases must reject by named constraints after independent
database execution. The review did not execute SQL.
