# Snapshot Schema and Registry/Schema/Basis Crosswalk Audit

Date: 2026-11-24

Result:

```text
Normalized Schema: FAIL
Registry / Schema / Basis Crosswalk: FAIL
```

## 1. Positive Findings

- Snapshot Header context keys are explicit.
- Most child rows have same-Snapshot candidate/context FKs.
- Requirement field contains complete structured source binding.
- Source has `source_kind`.
- Catalog Review has target and policy revision.
- Warning has integer sequence.
- Professional Review uses exact six/seven-column relationships.
- `ON DELETE RESTRICT`/`ON UPDATE RESTRICT` is consistent.

## 2. Row-to-Registry Match

| Record | Result | Detail |
|---|---|---|
| Header | FAIL | physical `rule_set_revision_id`, conversation/scenario not fully classified in Basis |
| Requirement Field | PASS | all selected fields map |
| Candidate | FAIL | product/spec/price source relationship missing |
| Parameter | FAIL | table-only catalog revision |
| Price | FAIL | no source/validity fields |
| Source Revision | PASS | all fields map |
| Catalog Review | PASS | all fields map |
| Professional Review | PASS | all fields map |
| Warning | FAIL | ordering source ID absent |
| Missing Field | PARTIAL | reason enum/impact semantics absent |

## 3. Candidate Provenance Counterexample

Source selection candidate:

```text
id               = candidate-1
candidate_id     = candidate-1
product_revision  = product-rev-A
spec_revision     = spec-rev-A
price_revision    = price-rev-A
```

Snapshot row:

```text
candidate_id           = candidate-1
product_revision_id    = product-rev-B
specification_revision = spec-rev-B
price_revision_id      = price-rev-B
```

The shown FK at `SNAPSHOT_NORMALIZED_CHILD_SCHEMA_R2.md:229-237` checks:

```text
candidate_id, selection_run_id, project/conversation/requirement/version/
scenario, rule_set_revision_id
```

It does not check product/specification/price revision. The wrong revisions can
commit and will produce a different Basis that is internally valid but
provenance-invalid.

## 4. Parameter and Price

Parameter:

```text
catalog_parameter_revision_id
```

is stored at line 260 but is absent from:

- `SNAPSHOT_REGISTRY_R2.md` Parameter tags;
- Basis record type 3;
- Crosswalk section 5.

Price:

```text
source_revision_id
valid_from
valid_until
price_scope/type
price revision FK
```

are all absent. `applicability` alone does not preserve effective validity or
source evidence.

## 5. Rule Set in Basis

`sales_handoff_snapshot.rule_set_revision_id` exists at Schema line 34.
Crosswalk line 40 says source/rules identities enter the Basis. Header tags
1–9 contain no rule-set field. `selectionRunId` may indirectly identify a run,
but the Snapshot rows are declared sole authority and no exact derivation is
stated.

## 6. Warning Sequence

Registry ordering:

```text
(warningCode,warningText,sourceWarningId)
```

`sales_snapshot_warning` lines 454–475 do not contain `source_warning_id`.
Thus for identical code/text values, sequence assignment is not reconstructible
from canonical Snapshot rows.

## 7. Version Vector

Deferred contract line 239 uses:

```text
version_vector = expected
```

No `version_vector` exists in the Schema. The existing `version_number` is
Snapshot business version, not a mutation/version vector.

## 8. Basis-Excluded Fields

The crosswalk excludes:

- local row PK;
- child snapshot FK;
- record type constant;
- child creation time;
- validation diagnostics;
- stable-key encoding column.

This is reasonable for those fields. It does not classify:

- `rule_set_revision_id`;
- `catalog_parameter_revision_id`;
- `created_by_user_id`;
- `version_number`;
- candidate product/spec/price revision relations.

Each must be marked DIRECT, DERIVED with proof, or METADATA with rationale.

## 9. Required Acceptance

A machine-generated crosswalk must prove:

```text
Registry tag -> normalized column(s)/derivation -> Basis frame
Normalized business column -> Registry/Basis or approved metadata reason
Structured key -> FK/UNIQUE
```

No manual table may stand in for this check.

