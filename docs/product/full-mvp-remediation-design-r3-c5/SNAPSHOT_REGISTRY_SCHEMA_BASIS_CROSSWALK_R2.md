# Registry / Schema / Basis Crosswalk R2

Status:

```text
REGISTRY: SNAPSHOT-R2
SCHEMA: SNAPSHOT-SCHEMA-R2
BASIS: R3-BASIS-1-R5
EVERY BASIS FIELD IS IMMUTABLE SNAPSHOT DATA OR A REGISTERED DERIVATION
```

## 1. Classification

| Class | Meaning |
|---|---|
| `DIRECT` | Stored directly in the canonical row and serialized at the tag |
| `DERIVED` | Derived deterministically from stored structured fields |
| `METADATA` | Runtime/ownership/validation data not part of business Basis |

Metadata may be excluded only when changing it cannot change the represented
business facts, source authenticity or canonical reconstruction result.

## 2. Type 0 — Header

| Tag | Registry field | Table.column | Class |
|---:|---|---|---|
| 1 | snapshotId | `sales_handoff_snapshot.id` | DIRECT |
| 2 | caseId | `sales_handoff_snapshot.case_id` | DIRECT |
| 3 | projectId | `.project_id` | DIRECT |
| 4 | requirementId | `.requirement_id` | DIRECT |
| 5 | requirementVersionId | `.requirement_version_id` | DIRECT |
| 6 | selectionRunId | `.selection_run_id` | DIRECT |
| 7 | registryRevision | `sales_snapshot_basis_metadata.registry_revision` | DIRECT |
| 8 | protocolRevision | `.protocol_revision` | DIRECT |
| 9 | stableKeyEncoding | `.stable_key_encoding` | DIRECT |

Snapshot `state`, `created_at`, `finalized_at`, `created_by_user_id` and
version-envelope identity are metadata. They control finalization/audit but do
not alter the immutable business facts once the Basis is committed. The
selected source/rules/requirement/run identities do enter the Basis.

## 3. Type 1 — Requirement Field

| Tag | Registry field | Table.column | Class |
|---:|---|---|---|
| 1 | fieldKey | `sales_snapshot_requirement_field.field_key` | DIRECT |
| 2 | valueType | `.value_type` | DIRECT |
| 3 | value | one of `.boolean_value`, `.integer_value`, `.decimal_value`, `.text_value`, `.enum_value`, `.canonical_id_value`, `.timestamp_value`, `.bytes_value`, or explicit null | DIRECT |
| 4 | unit | `.unit` | DIRECT |
| 5 | fieldStatus | `.field_status` | DIRECT |
| 6 | sourceFieldValueId | `.source_field_value_id` | DIRECT |
| 7 | sourceKind | `.source_kind` | DIRECT |
| 8 | sourceEntityType | `.source_entity_type` | DIRECT |
| 9 | sourceEntityId | `.source_entity_id` | DIRECT |
| 10 | sourceAuxId | `.source_aux_is_null`, `.source_aux_text` | DIRECT |
| 11 | sourceKey | `.source_key` | DERIVED and equality-checked |

`sourceKey` derivation:

```text
sourceKey = source_key_r3(
  sourceKind,
  sourceEntityType,
  sourceEntityId,
  sourceAuxIsNull,
  sourceAuxText
)
```

The database CHECK and deferred validation both recompute it. The structured
identity, not sourceKey text parsing, is authoritative.

## 4. Type 2 — Candidate

| Tag | Registry field | Table.column | Class |
|---:|---|---|---|
| 1 | candidateId | `sales_snapshot_candidate.candidate_id` | DIRECT |
| 2 | productRevisionId | `.product_revision_id` | DIRECT |
| 3 | specificationRevisionId | `.specification_revision_id` | DIRECT |
| 4 | priceRevisionId | `.price_revision_id` | DIRECT |
| 5 | technicalStatus | `.technical_status` | DIRECT |
| 6 | commercialStatus | `.commercial_status` | DIRECT |
| 7 | trustStatus | `.trust_status` | DIRECT |
| 8 | professionalReviewStatus | `.professional_review_status` | DIRECT |
| 9 | overallStatus | `.overall_status` | DIRECT |

The source SelectionRun/revision identity is enforced by a composite FK to the
immutable selection result. It is also represented by the exact Snapshot
envelope and Candidate relationship, so it cannot drift independently.

## 5. Type 3 — Parameter

| Tag | Registry field | Table.column | Class |
|---:|---|---|---|
| 1 | candidateId | candidate row `.candidate_id` | DERIVED |
| 2 | parameterKey | `sales_snapshot_parameter.parameter_key` | DIRECT |
| 3 | valueType | `.value_type` | DIRECT |
| 4 | value | typed value column | DIRECT |
| 5 | unit | `.unit` | DIRECT |
| 6 | sourceRevisionId | `.source_revision_id` | DIRECT |

The candidate ID is derived through the same-snapshot Candidate FK and is
copied into the stable tuple and Basis.

## 6. Type 4 — Price

| Tag | Registry field | Table.column | Class |
|---:|---|---|---|
| 1 | candidateId | candidate row `.candidate_id` | DERIVED |
| 2 | priceRevisionId | `sales_snapshot_price.price_revision_id` | DIRECT |
| 3 | amountMinor | `.amount_minor` | DIRECT |
| 4 | currency | `.currency` | DIRECT |
| 5 | taxBasis | `.tax_basis` | DIRECT |
| 6 | applicability | `.applicability` | DIRECT |

## 7. Type 5 — Source Revision

| Tag | Registry field | Table.column | Class |
|---:|---|---|---|
| 1 | sourceRevisionId | `sales_snapshot_source.source_revision_id` | DIRECT |
| 2 | evidenceObjectId | `.evidence_object_id` | DIRECT |
| 3 | rawContentDigest | `.raw_content_digest` | DIRECT |
| 4 | sourceKind | `.source_kind` | DIRECT |

The exact immutable catalog source revision FK validates all four fields.

## 8. Type 6 — Catalog Review

| Tag | Registry field | Table.column | Class |
|---:|---|---|---|
| 1 | catalogReviewId | `sales_snapshot_catalog_review.catalog_review_id` | DIRECT |
| 2 | targetRevisionId | `.target_revision_id` | DIRECT |
| 3 | policyRevisionId | `.policy_revision_id` | DIRECT |
| 4 | decision | `.decision` | DIRECT |
| 5 | reviewedAt | `.reviewed_at` | DIRECT |

All five fields participate in the immutable parent FK.

## 9. Type 7 — Professional Review

| Tag | Registry field | Table.column | Class |
|---:|---|---|---|
| 1 | professionalReviewEventId | `sales_snapshot_professional_review.professional_review_event_id` | DIRECT |
| 2 | professionalReviewId | `.professional_review_id` | DIRECT |
| 3 | policyRevisionId | `.policy_revision_id` | DIRECT |
| 4 | decision | `.decision` | DIRECT |
| 5 | basisDigest | `.basis_digest` | DIRECT |

The six-column Event FK and policy-inclusive Review FK prevent substitution.

## 10. Type 8 — Warning

| Tag | Registry field | Table.column | Class |
|---:|---|---|---|
| 1 | candidateId | candidate row `.candidate_id` | DERIVED |
| 2 | warningSequence | `sales_snapshot_warning.warning_sequence` | DIRECT |
| 3 | warningCode | `.warning_code` | DIRECT |
| 4 | warningText | `.warning_text` | DIRECT |

Sequence is structured and immutable. The stable key encodes the integer
directly as INT64; no colon parsing or leading-zero text is involved.

## 11. Type 9 — Missing Field

| Tag | Registry field | Table.column | Class |
|---:|---|---|---|
| 1 | candidateId | candidate row `.candidate_id` | DERIVED |
| 2 | fieldKey | `sales_snapshot_missing_field.field_key` | DIRECT |
| 3 | reasonCode | `.reason_code` | DIRECT |

## 12. Basis-Excluded Snapshot Metadata

| Data | Why excluded |
|---|---|
| local row PK `id` | duplicate of immutable `row_id`; local storage identity only |
| `snapshot_id` FK in each child | ownership enforcement; header carries the same snapshot identity in Basis |
| `record_type` constant column | derives from table and is serialized as the Record Type |
| `created_at` of child rows | creation timing is transaction metadata, not business fact; authoritative audit event is separate |
| validation result rows | diagnostics of validation, not business content |
| stable-key encoding version column | repeated in Header tag 9 and metadata; changes require a new Registry/Protocol revision |

None of these can alter a selected field, source, candidate, price, review,
warning, missing-field fact or the reconstructed rule input.

## 13. One-to-One Acceptance

Automated schema introspection must generate the same mapping and assert:

```text
for every Registry tag:
  normalized column(s) exist
  SQL type is compatible
  nullability matches
  Basis encoder has exactly one mapping

for every Basis tag:
  a Registry tag exists
  no duplicate semantic source exists
  the generated C5 fixture reconstructs identical bytes
```

Manual mapping tables are review evidence, not a substitute for that generated
check in implementation.

