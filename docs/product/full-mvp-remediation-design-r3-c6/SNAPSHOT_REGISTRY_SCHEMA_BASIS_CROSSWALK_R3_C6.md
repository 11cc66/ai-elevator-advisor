# Snapshot Registry / Schema / Basis Crosswalk R3-C6

Status:

```text
REGISTRY: SNAPSHOT-R3
SCHEMA: SNAPSHOT-SCHEMA-R3
BASIS: R3-BASIS-1-R6
```

## 1. Complete Field Crosswalk

| Type | Tag | Registry field | Schema column | Basis class |
|---:|---:|---|---|---|
| 0 | 1 | snapshotId | snapshot.id | DIRECT |
| 0 | 2 | caseId | snapshot.case_id | DIRECT |
| 0 | 3 | projectId | snapshot.project_id | DIRECT |
| 0 | 4 | conversationId | snapshot.conversation_id | DIRECT |
| 0 | 5 | requirementId | snapshot.requirement_id | DIRECT |
| 0 | 6 | requirementVersionId | snapshot.requirement_version_id | DIRECT |
| 0 | 7 | installationScenario | snapshot.installation_scenario | DIRECT |
| 0 | 8 | selectionRunId | snapshot.selection_run_id | DIRECT |
| 0 | 9 | ruleSetRevisionId | snapshot.rule_set_revision_id | DIRECT |
| 0 | 10 | ruleSetContentDigest | snapshot.rule_set_content_digest | DIRECT |
| 0 | 11 | basisAsOf | snapshot.basis_as_of | DIRECT |
| 0 | 12 | registryRevision | metadata.registry_revision | DIRECT |
| 0 | 13 | protocolRevision | metadata.protocol_revision | DIRECT |
| 0 | 14 | stableKeyEncoding | metadata.stable_key_encoding | DIRECT |
| 1 | 1 | fieldKey | requirement.field_key | DIRECT |
| 1 | 2 | valueType | requirement.value_type | DIRECT |
| 1 | 3 | value | requirement typed value | DIRECT |
| 1 | 4 | unit | requirement.unit | DIRECT |
| 1 | 5 | fieldStatus | requirement.field_status | DIRECT |
| 1 | 6 | sourceFieldValueId | requirement.source_field_value_id | DIRECT |
| 1 | 7 | sourceKind | requirement.source_kind | DIRECT |
| 1 | 8 | sourceEntityType | requirement.source_entity_type | DIRECT |
| 1 | 9 | sourceEntityId | requirement.source_entity_id | DIRECT |
| 1 | 10 | sourceAuxId | requirement.aux null/text | DIRECT |
| 1 | 11 | sourceKey | derived `source_key_r3` | DERIVED |
| 2 | 1 | selectionResultItemId | candidate.selection_result_item_id | DIRECT |
| 2 | 2 | candidateId | candidate.candidate_id | DIRECT |
| 2 | 3 | productId | candidate.product_id | DIRECT |
| 2 | 4 | productRevisionId | candidate.product_revision_id | DIRECT |
| 2 | 5 | productRevisionDigest | candidate.product_revision_digest | DIRECT |
| 2 | 6 | specificationRevisionId | candidate.specification_revision_id | DIRECT |
| 2 | 7 | specificationRevisionDigest | candidate.specification_revision_digest | DIRECT |
| 2 | 8 | priceRevisionId | candidate.price_revision_id | DIRECT |
| 2 | 9 | ruleSetRevisionId | candidate.rule_set_revision_id | DIRECT |
| 2 | 10 | technicalStatus | candidate.technical_status | DIRECT |
| 2 | 11 | commercialStatus | candidate.commercial_status | DIRECT |
| 2 | 12 | trustStatus | candidate.trust_status | DIRECT |
| 2 | 13 | professionalReviewStatus | candidate.professional_review_status | DIRECT |
| 2 | 14 | overallStatus | candidate.overall_status | DIRECT |
| 3 | 1 | candidateId | candidate join | DERIVED |
| 3 | 2 | catalogParameterRevisionId | parameter.catalog_parameter_revision_id | DIRECT |
| 3 | 3 | parameterKey | parameter.parameter_key | DIRECT |
| 3 | 4 | valueType | parameter.value_type | DIRECT |
| 3 | 5 | value | parameter typed value | DIRECT |
| 3 | 6 | unit | parameter.unit | DIRECT |
| 3 | 7 | sourceRevisionId | parameter.source_revision_id | DIRECT |
| 4 | 1 | candidateId | candidate join | DERIVED |
| 4 | 2 | priceRevisionId | price.price_revision_id | DIRECT |
| 4 | 3 | productRevisionId | price.product_revision_id | DIRECT |
| 4 | 4 | sourceRevisionId | price.source_revision_id | DIRECT |
| 4 | 5 | amountMinor | price.amount_minor | DIRECT |
| 4 | 6 | currency | price.currency | DIRECT |
| 4 | 7 | priceBasis | price.price_basis | DIRECT |
| 4 | 8 | taxBasis | price.tax_basis | DIRECT |
| 4 | 9 | applicability | price.applicability | DIRECT |
| 4 | 10 | validFrom | price.valid_from | DIRECT |
| 4 | 11 | validUntil | price.valid_until | DIRECT |
| 4 | 12 | quotedAt | price.quoted_at | DIRECT |
| 5 | 1 | sourceRevisionId | source.source_revision_id | DIRECT |
| 5 | 2 | evidenceObjectId | source.evidence_object_id | DIRECT |
| 5 | 3 | rawContentDigest | source.raw_content_digest | DIRECT |
| 5 | 4 | sourceKind | source.source_kind | DIRECT |
| 5 | 5 | capturedAt | source.captured_at | DIRECT |
| 6 | 1 | catalogReviewId | catalog_review.catalog_review_id | DIRECT |
| 6 | 2 | targetRevisionId | catalog_review.target_revision_id | DIRECT |
| 6 | 3 | sourceRevisionId | catalog_review.source_revision_id | DIRECT |
| 6 | 4 | policyRevisionId | catalog_review.policy_revision_id | DIRECT |
| 6 | 5 | decision | catalog_review.decision | DIRECT |
| 6 | 6 | reviewedAt | catalog_review.reviewed_at | DIRECT |
| 7 | 1 | professionalReviewEventId | review.event_id | DIRECT |
| 7 | 2 | professionalReviewId | review.review_id | DIRECT |
| 7 | 3 | eventSequence | review.event_sequence | DIRECT |
| 7 | 4 | policyRevisionId | review.policy_revision_id | DIRECT |
| 7 | 5 | decision | review.decision | DIRECT |
| 7 | 6 | basisDigest | review.basis_digest | DIRECT |
| 7 | 7 | occurredAt | review.occurred_at | DIRECT |
| 8 | 1 | candidateId | candidate join | DERIVED |
| 8 | 2 | sourceWarningId | warning.source_warning_id | DIRECT |
| 8 | 3 | warningSequence | warning.warning_sequence | DIRECT |
| 8 | 4 | severity | warning.severity | DIRECT |
| 8 | 5 | warningCode | warning.warning_code | DIRECT |
| 8 | 6 | warningText | warning.warning_text | DIRECT |
| 9 | 1 | candidateId | candidate join | DERIVED |
| 9 | 2 | fieldKey | missing.field_key | DIRECT |
| 9 | 3 | reasonCode | missing.reason_code | DIRECT |
| 9 | 4 | impactScope | missing.impact_scope | DIRECT |

The full one-to-one tables are in the design JSON:

```text
C6_SNAPSHOT_VECTOR_01.json
```

## 2. Candidate Provenance

Exact parent:

```text
selection_candidate_result(
 id, selection_run_id, candidate_id,
 project/conversation/requirement/version/scenario,
 rule_set_revision_id, product_id,
 product_revision_id, product_revision_digest,
 specification_revision_id, specification_revision_digest,
 price_has_value, price_revision_key)
```

The Snapshot Candidate FK contains the same columns. A mismatch rejects.

## 3. Parameter

The Snapshot Parameter includes `catalogParameterRevisionId` in both storage and
Basis tag 2. Exact candidate and immutable parameter revision FKs are required.

## 4. Price

The Snapshot Price includes price revision, product revision, source revision,
price semantics, validity, and quote time. All copied dimensions participate in
the immutable PriceRevision FK and Basis.

## 5. RuleSet

Header tags 9–10 include RuleSet Revision and content digest. SelectionRun
exposes the same composite key and Snapshot inherits it exactly.

## 6. Warning

Tag 2 stores structured `sourceWarningId`, used as a deterministic tie-break.
Tag 3 stores sequence. Both are immutable and Basis-covered.

## 7. Metadata

`state`, `created_at`, `finalized_at`, `mutation_version`, local PK, and the
duplicate same-row `snapshot_id` FK are operational metadata.

`created_by_principal_id` is an audit identity and is also duplicated in an
AuditEvent; it is not part of business Basis.

## 8. Acceptance

Every Registry tag has a schema source and Basis encoding. Every business source
field is either:

- present in Registry/Basis; or
- derivable through an exact immutable parent key listed above.

