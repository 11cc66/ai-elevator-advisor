# Requirement, CatalogReview and ProfessionalReview Provenance R3-C8 Corrections

## Requirement Chain

New authoritative tables:

```text
requirement_assertion_r3
requirement_field_value_r3
```

`requirement_assertion_r3` binds:

- RequirementVersion, Requirement, Project, Conversation and scenario;
- field key;
- source kind/type/auxiliary data;
- actor Principal, Session, AuthorityGrant, Request ID/hash and database time;
- a digest computed by `requirement_source_digest_r3`.

`requirement_field_value_r3` binds each value to an assertion using the full
requirement context and field key. Both tables are append-only and TRUNCATE
guarded.

`selection_requirement_field` now has exact FKs to the assertion and FieldValue
identities and content digests. Its trigger recomputes the full row digest and
rejects any copied value/source-field mismatch. Snapshot Requirement children
then carry the full source digests and re-verify the copied row.

The `record_selection_requirement_field` signature is retained for call
compatibility, but all caller-provided payload fields must match the
authoritative FieldValue/Assertion rows. The function copies from the
authoritative rows.

## CatalogReview Chain

`catalog_review_event_r3` is the immutable review event. It binds:

- source revision;
- policy revision;
- target kind and exact target ProductRevision/SpecificationRevision/
  PriceRevision, including target digest;
- decision;
- actor Principal, Session and AuthorityGrant;
- Request ID/hash and database-generated review time;
- an event content digest.

`create_catalog_review_event_r3` is the controlled producer. The target FK is
chosen by target kind; a caller cannot attach a ProductRevision to another
product/specification/Price fact. Selection CatalogReview rows carry the event
digest and full target identity. Their snapshot children re-check the copied
facts against the event.

## ProfessionalReview Chain

`professional_review` now binds the exact sealed
`selection_candidate_result_id`, result row digest, ProductRevision and
ProductRevision digest. `create_professional_review` derives project,
conversation, requirement, scenario, candidate, target and timestamps from the
sealed result.

`professional_review_event` carries:

- exact Review and result identity;
- target revision and digest;
- immutable state/command/next state;
- actor Principal/Session/AuthorityGrant;
- database-generated occurrence time;
- canonical `basis_payload` and database-computed `basis_digest`;
- database-computed `event_digest`.

The caller can no longer choose decision, basis digest, timestamp or target
revision independently of the event. `record_selection_professional_review_result`
requires equality with the event and copies from it.

## Counterexamples

Rejected:

- real Review ID with a different Project;
- Review ID with another result/target revision;
- caller-supplied approved decision on a rejected event;
- caller-supplied basis digest or timestamp;
- an event or result from another SelectionRun;
- changing a sealed source row after the SelectionRun is sealed;
- deleting an event or Audit row;
- replacing Snapshot Review content while retaining IDs.

## Residual Boundary

Database grammar, Catalog, trigger execution, ACL behavior and runtime races
remain `NOT VERIFIED — DATABASE NOT AUTHORIZED`.
