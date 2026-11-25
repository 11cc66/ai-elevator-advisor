# FULL-MVP-REMEDIATION-REVIEW-R3-C3 Independent Findings

Date: 2026-11-24

Review mode: independent, read-only, adversarial design review.

Reviewed design status:

```text
R3-C3 DESIGN COMPLETE WITH OPEN BLOCKERS
```

Independent result:

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

## Counts

```text
P0: 0
P1: 2
P2: 5
P3: 1
```

## P0

```text
NONE IDENTIFIED
```

## P1

### REV-R3-C3-P1-01 — ProfessionalReviewEvent parent UNIQUE does not match the FieldValue source FK

- Severity: P1
- Affected files:
  - `P1_PRODUCT_REMEDIATION_DESIGN_R3_C3.md:288-325, 230-235`
  - `R3_C3_PROFESSIONAL_REVIEW_SOURCE_BINDING.md:59-115`
- Problem: `ProfessionalReviewEvent` declares:
  ```text
  UNIQUE(id, reviewId, projectId, conversationId, requirementId,
         requirementVersionId, installationScenario)
  ```
  but `RequirementFieldValue` references:
  ```text
  (sourceProfessionalReviewEventId, projectId, conversationId,
   requirementId, requirementVersionId, installationScenario)
  ```
  There is no parent UNIQUE with exactly those six columns. PostgreSQL will
  reject the FK at migration time because `reviewId` is an extra parent column.
- Counterexample: create a valid review event with review R and requirement
  A. Try to create the declared FieldValue FK on the six-column tuple. The
  intended FK cannot be created as written; a developer must invent an
  unplanned key or add `reviewId` to the child, neither of which is in the
  reviewed design.
- Impact: The claimed cross-requirement/version source protection is not
  database-enforceable as specified. A hand-crafted or partially implemented
  schema can fall back to a single event-ID FK, reopening the R3-C2 finding.
- Required correction:
  - add `UNIQUE(id, projectId, conversationId, requirementId,
    requirementVersionId, installationScenario)` on the Event, or
  - include `reviewId` in the FieldValue FK and parent key consistently;
  - apply the same exact-key decision to Assertion professional sources and
    Snapshot-derived binds;
  - add a migration test that creates this FK from an empty isolated clone.
- Verification required: direct SQL proves an event from another
  requirement/version cannot be referenced; DDL introspection confirms exact
  column sets.
- Blocks: ProfessionalReview source provenance and all Snapshot professional
  source evidence.

### REV-R3-C3-P1-02 — R3-BASIS has synthetic vectors but no actual Snapshot record/field registry and stableKey mapping

- Severity: P1
- Affected files:
  - `R3_BASIS_V3_PROTOCOL_AND_VECTOR_SPEC.md:20-111`
  - `R3_BASIS_V3_FIXED_VECTORS.md`
  - `P1_PRODUCT_REMEDIATION_DESIGN_R3_C3.md:365-425`
- Problem: The protocol delegates `record type` and `field tag` to an
  “approved registry,” but the deliverables do not define the registry for
  actual snapshot entities:
  - requirement fields;
  - candidate results;
  - catalog parameters;
  - prices;
  - source revisions;
  - catalog reviews;
  - professional-review events;
  - warnings and missing fields.

  The fixed vectors only use synthetic record type `0001` and field tags
  `0001`/`0002`. They do not define how a real Snapshot table row maps to a
  record type, stableKey, field tag or semantic field ordering.
- Counterexample: one encoder assigns `requirement field` record type 1 and
  field tag 9; another assigns it type 4 and tag 1. Both can pass the synthetic
  vectors and produce different real Snapshot basis bytes.
- Impact: Independent implementations cannot reconstruct the same full
  Snapshot Basis. The 23-vector pass proves only the synthetic frame, not the
  actual model.
- Why current controls fail: the stableKey description says it is a semantic
  key, but does not state the exact composition for each entity. The protocol
  cannot be independently implemented from the document set.
- Required correction:
  - publish a complete versioned record/field registry;
  - define exact stableKey construction and uniqueness scope for every
    normalized Snapshot row;
  - map every Snapshot table/column to a record tag and field tag;
  - add multi-entity fixture vectors containing each record type;
  - make an unknown registry version a hard rejection.
- Verification required: two independent encoders produce the same bytes for
  all actual Snapshot entity records and mixed-record bases.
- Blocks: Snapshot creation, export and historical reconstruction.

## P2

### REV-R3-C3-P2-01 — Main design still lacks a complete concrete Snapshot child schema

- Severity: P2
- Affected file: `P1_PRODUCT_REMEDIATION_DESIGN_R3_C3.md:390-425`
- Problem: The section describes Snapshot sourceKey and basis behavior but
  does not show the complete normalized child tables (candidate, parameter,
  price, source, catalog review, professional review, warning) with their
  unique/FK/deferred constraints. Those details appear partly in the prior C2
  design or source-binding appendix, not in the C3 main design.
- Impact: A developer cannot implement the claimed Snapshot authority without
  consulting an unversioned mixture of R3-C2 and C3 files.
- Required correction: move the complete C3 Snapshot schema and deferred
  validation contract into the C3 main design.
- Verification required: schema checklist and all `C3-SNP-*` tests reference
  the same C3 table definitions.
- Blocks: Snapshot implementation.

### REV-R3-C3-P2-02 — Typed SQL catalogue still leaves business ranges and unit authority unresolved

- Severity: P2
- Affected file: `P1_PRODUCT_REMEDIATION_DESIGN_R3_C3.md:427-446`
- Problem: C3 defines column families and some limits, but exact engineering
  ranges, unit allowlists, enum catalogue and scenario-specific typed fields
  remain under `OD-R3-C3-02`.
- Counterexample: `DECIMAL(18,6)` is a storage type, not an approved
  engineering value range. A valid-looking unapproved unit can be persisted
  if the unit catalogue is not enforced.
- Impact: Typed storage exists without a complete authoritative field
  contract.
- Required correction: bind each fieldKey to an approved type/unit/range
  catalogue version and reject unknown combinations.
- Verification required: direct SQL boundary and unknown-unit tests.
- Blocks: typed field activation; does not block pure protocol fixtures.

### REV-R3-C3-P2-03 — Legacy mapping does not yet define a deterministic JSON-to-typed field mapping

- Severity: P2
- Affected file: `R3_C3_IDENTITY_AND_MIGRATION_DESIGN.md:55-107`
- Problem: The migration design has preflight/quarantine phases but does not
  provide a mapping table for legacy `BuildingRequirement.fields` names,
  types, units, source references and conflicts.
- Counterexample: two legacy JSON records with different field-source shapes
  can both be labeled “mapped” without proving they yield the same typed
  FieldValue semantics.
- Impact: Historical facts can be silently misclassified or quarantined
  without a reproducible acceptance boundary.
- Required correction: add a versioned legacy field mapping matrix and exact
  unmappable categories.
- Verification required: migration fixtures for every legacy field.
- Blocks: Legacy data import.

### REV-R3-C3-P2-04 — Event-only function security remains only partially specified

- Severity: P2
- Affected files:
  - `P1_PRODUCT_REMEDIATION_DESIGN_R3_C3.md:327-363`
  - `P1_PRODUCT_REMEDIATION_OPEN_DECISIONS_R3_C3.md:33-39`
- Problem: C3 names an approved transition owner and fixed search path, but
  leaves owner identity, exact EXECUTE role grants, policy-authoring role and
  deployment mechanism to Open Decisions. The event table/view mechanism is
  described, but the complete role boundary is not yet executable.
- Impact: A role can remain over-privileged unless the implementation chooses
  the exact grants; direct event DML denial is not proved.
- Required correction: provide DDL-level role matrix, revoke/grant statements
  and function signatures in the design before implementation.
- Verification required: direct event/status/function privilege tests.
- Blocks: RuleSet/ProfessionalReview implementation.

### REV-R3-C3-P2-05 — sourceKey colon concatenation is not reversible when IDs may contain a colon

- Severity: P2
- Affected file: `R3_C3_IDENTITY_AND_MIGRATION_DESIGN.md:18-58`
- Problem: Canonical IDs allow `:` but `session-system:<ruleSetRevisionId>:<assertionId>`
  uses `:` as a delimiter. The typed source columns and parent FK still enforce
  ownership, but the advertised sourceKey identity is not independently
  reversible from its string representation.
- Counterexample: IDs `abc:def` and `abc` + `def` can yield the same visual
  prefix pattern if a parser trusts string splitting rather than typed
  columns.
- Impact: Legacy mapping or audit tooling may recover the wrong source pair
  even though the database row is otherwise valid.
- Required correction: restrict IDs to separator-free CUIDs, length-prefix the
  sourceKey components, or define sourceKey as intentionally non-parseable and
  use typed columns for reverse lookup.
- Verification required: sourceKey parse/reverse fixtures and migration tests
  for colon-bearing legacy IDs.
- Blocks: Legacy source migration and audit tooling.

## P3

### REV-R3-C3-P3-01 — Traceability uses synthetic vector completion as evidence for all Snapshot basis behavior

- Severity: P3
- Affected file: `P1_PRODUCT_REMEDIATION_TRACEABILITY_R3_C3.md`
- Problem: The trace records `R3-BASIS-1` as globally addressed after V01–V23,
  but the vectors do not cover the actual Snapshot record registry.
- Impact: A reader may mistake generic framing success for full Snapshot
  encoding coverage.
- Required correction: qualify the trace until actual record/field registry
  vectors exist.
- Verification required: trace status matches the independent protocol
  findings.
- Blocks: report integrity only.

## Highest-Risk Findings

1. ProfessionalReviewEvent parent key mismatch.
2. Missing actual Snapshot record/field registry and stableKey mapping.

No P0 finding is identified in this design-only review.
