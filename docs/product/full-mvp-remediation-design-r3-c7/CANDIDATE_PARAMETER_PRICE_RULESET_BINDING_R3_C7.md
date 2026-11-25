# Candidate / Parameter / Price / RuleSet Binding R3-C7

Artifact: `CANDIDATE_PARAMETER_PRICE_RULESET_BINDING_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. Candidate Binding

The candidate record is immutable after run seal. Its Basis tags `1..14` are
projected from exact columns:

- SelectionResult item and Candidate ID;
- product/revision/digest;
- specification/revision/digest;
- optional exact PriceRevision through a separate child row;
- RuleSet ID;
- technical/commercial/trust/review/overall statuses.

An absent price is represented by tag 8 `NULL`; a present price must satisfy the
non-null candidate-price and PriceRevision composite FKs.

## 2. Parameter Binding

The catalog parameter parent carries:

```text
product_id, product_revision_id, parameter_key,
value_type, source_revision_id, value, unit
```

Candidate parameter references both the candidate product revision and this
exact parent. Materialization copies the immutable revision ID and value into
the Snapshot parameter table.

## 3. Price Binding and Time

Distinct timestamps remain distinct:

| Meaning | Source |
|---|---|
| Price revision creation | `created_at` |
| Start of price validity | `valid_from` |
| End of price validity | `valid_until` |
| Quote production | `quoted_at` |
| Snapshot decision point | `basis_as_of` |
| Snapshot completion | `finalized_at` |

The Snapshot uses `basis_as_of`, not "current time", for price validity.
Expired future-ness is accepted only when the candidate status explicitly says
`PRICE_EXPIRED` or `REQUIRES_QUOTE`; such a candidate cannot be Operational.

## 4. RuleSet

RuleSet authority appears in:

- RuleSetRevision table;
- SelectionRun FK with ID+digest;
- SelectionRunSeal;
- Snapshot Header FK;
- Snapshot Candidate check against Header;
- Header Basis tags 9-10.

No post-seal replacement is possible through ordinary roles.

## 5. Basis Projection

`app_private.snapshot_record_projection_r3` directly selects these immutable
columns for record types 2, 3 and 4. `app_private.r6_record` validates field tags,
types and resource limits before emitting bytes.

## 6. Acceptance

Future DB tests must prove all PROV/PRICE/RULE counterexamples reject. The
current evidence is static DDL completeness only.
