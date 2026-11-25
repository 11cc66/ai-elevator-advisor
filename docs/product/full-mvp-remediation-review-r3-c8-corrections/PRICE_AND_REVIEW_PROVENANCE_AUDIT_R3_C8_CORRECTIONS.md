# Price and Review Provenance Audit

## Price Fact

Static model review:

- The Price fact exposes amount, currency, basis, tax basis, applicability,
  validity, unit and quantity fields.
- `price_fact_canonical_v1` contains the required business fields.
- `price_row_payload_v1` contains the corresponding Snapshot fields.
- PriceRevision, SelectionCandidatePrice and SnapshotPrice have a fact digest/FK
  chain.
- PriceRevision contains an immutability/truncate guard.

The price-specific findings are not independently resolved because PostgreSQL
did not compile or execute the functions and constraints.

## Requirement

The corrections introduce `requirement_assertion_r3` and
`requirement_field_value_r3`, with context FKs, source digests, append-only
guards and exact Selection/Snapshot child bindings. The selected Requirement
row is copied from authoritative FieldValue/Assertion rows rather than trusted
from caller payload.

Remaining domain weakness: source FieldValue `value_type`, `unit` and
`field_status` are not as tightly constrained as the Selection/Snapshot fields.

## CatalogReview

The correction introduces an immutable CatalogReviewEvent with source revision,
policy, target Product/Specification/Price Revision and actor/decision facts.
Selection and Snapshot rows carry the event digest and target digest.

Finding `P1-03`: the source revision is bound only by
`catalog_source_revision(id)`. No constraint proves that the source revision
belongs to the target product/specification/price fact. A valid source for
Product A can therefore be paired with a Product B target while the event
digest remains internally consistent.

## ProfessionalReview

The correction adds exact result/event/result digest and target revision
bindings. `create_professional_review` derives context from the sealed
SelectionResult; transitions compute canonical basis digest; Snapshot copies
the event-derived decision, basis and timestamp.

Static chain review: `PASS WITH CAVEAT`; PostgreSQL runtime is `NOT VERIFIED`.

## Verdict

```text
Price Fact:
PASS STATIC — but SQL execution not verified

Requirement:
PASS STATIC — with P3 domain hardening

CatalogReview:
FAIL — source-to-target identity incomplete

ProfessionalReview:
PASS STATIC — event/result/basis/target chain present
```
