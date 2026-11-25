# FULL-MVP-REMEDIATION-REVIEW-R3-C4 Findings

Date: 2026-11-24

```text
P0: 0
P1: 4
P2: 6
P3: 1
```

## P0

None identified.

## P1

### REV-R3-C4-P1-01 — Snapshot stableKey remains an ambiguous tuple encoding

- Related original finding: `REV-R3-C3-P1-02`
- Files:
  - `docs/product/full-mvp-remediation-design-r3-c4/SNAPSHOT_REGISTRY_R1.md:29-37,98,111,146,158,168`
  - `docs/product/full-mvp-remediation-design-r3-c4/CANONICAL_SOURCE_IDENTITY_R2.md:37-38`
  - `docs/product/full-mvp-remediation-design-r3-c4/P1_PRODUCT_REMEDIATION_TEST_PLAN_R3_C4.md:31-41`
- Problem: multi-component keys use raw `:` concatenation while canonical text
  IDs may contain `:`.
- Counterexample:

```text
PRICE:a:b:c

(candidateId="a:b", priceRevisionId="c")
(candidateId="a",   priceRevisionId="b:c")
```

- Impact: A valid Snapshot is rejected as duplicate, or an implementation
  invents an unregistered tuple encoding. The Registry cannot guarantee one
  key per business tuple.
- Why tests do not close it: `C4-SNP-10` tests an already-duplicate key;
  `C4-SNP-11` tests `sourceKey`, not the Snapshot stableKey; C4-SNAP-01 has no
  colon-bearing IDs.
- Required correction: define a versioned `SNAPSHOT-R1` length-prefixed tuple
  encoder, or use structured columns plus a collision-safe derivation.
- Acceptance: colon, empty, Unicode, leading-zero and multi-segment fixtures
  prove injective encoding where the domain permits each value; regenerate the
  affected Basis vector.

### REV-R3-C4-P1-02 — The delivered C4-SNAP-01 Basis bytes disagree with the declared hash

- Files:
  - `docs/product/full-mvp-remediation-design-r3-c4/R3_BASIS_V4_FIXED_VECTORS.md:25-41,66-77`
  - `docs/product/full-mvp-remediation-design-r3-c4/R3_BASIS_V4_INDEPENDENT_REPRODUCTION.md:45-66`
- Problem: independent Node.js and Python construction from the semantic
  records produces 2350 bytes and
  `8C88E3F0EE8480AD78373375E737555B932CFF4CECB89E152A688D73E8A234E2`.
  The hex at line 71 also has length 2350 but hashes to
  `4874A5E512C53EBF4C480577C03DBB8FAE1CE7F0C582B414DC3D8DA4A0C2E262`.
- Concrete defect: parsed record types are
  `0,0,0,2,3,...,9`; the table requires `0,1,1,2,...,9`. The first differing
  byte is offset 188.
- Impact: the delivered full known-answer vector cannot be used to validate a
  real encoder. A correct encoder following the table is forced to disagree
  with the checked-in bytes.
- Required correction: regenerate the complete hex from the corrected Registry
  and semantic records, then compare complete bytes, not only hashes.
- Acceptance: the checked-in hex parses to exactly 15 records with types
  `0,1,1,2,3,4,5,6,7,8,9`, has length 2350 and the declared SHA-256.

### REV-R3-C4-P1-03 — Normalized Snapshot rows cannot reconstruct the Registry/Basis

- Files:
  - `docs/product/full-mvp-remediation-design-r3-c4/SNAPSHOT_REGISTRY_R1.md:59-67,113-132,150-158`
  - `docs/product/full-mvp-remediation-design-r3-c4/SNAPSHOT_NORMALIZED_CHILD_SCHEMA_R1.md:66-169`
  - `docs/product/full-mvp-remediation-design-r3-c4/CANONICAL_SOURCE_IDENTITY_R2.md:18-20`
- Problem: fields declared as canonical Basis inputs are absent from the
  normalized child rows:
  - `SalesSnapshotSource.sourceKind`;
  - `SalesSnapshotCatalogReview.targetRevisionId`;
  - `SalesSnapshotCatalogReview.policyRevisionId`;
  - structured `SalesSnapshotWarning.warningSequence`.
- Additional omission: the Requirement Field Registry contains only
  `sourceKind` and `sourceEntityId`, while the source identity contract says
  `sourceKey` participates in the Basis. `sourceFieldValueId`,
  `sourceEntityType` and `sourceAuxId` are also absent from that record.
- Impact: the declared rows are not the sole authority they claim to be. Basis
  generation would need unplanned joins or non-canonical text parsing, and the
  source binding is not fully covered by the digest.
- Required correction: reconcile Registry tags and normalized columns
  one-to-one; either include every canonical source-binding fact in the Basis
  or explicitly remove the claim and define its integrity proof elsewhere.
- Acceptance: a generated schema mapping table contains no missing/extra
  canonical field; every Basis field can be selected directly from immutable
  Snapshot rows.

### REV-R3-C4-P1-04 — Event transition can accept a forged actor and arbitrary requested state

- Files:
  - `docs/product/full-mvp-remediation-design-r3-c4/EVENT_ONLY_DATABASE_PRIVILEGE_DESIGN_R1.md:54-92`
  - `docs/product/full-mvp-remediation-design-r3-c4/PROFESSIONAL_REVIEW_COMPOSITE_FK_DESIGN_R3_C4.md:76-83,101-107`
- Problem: the `SECURITY DEFINER` function accepts `p_actor_id`,
  `p_new_state`, and `p_policy_revision_id` from the caller. The design never
  maps the authenticated DB principal to actor/authority, and never defines a
  closed transition matrix. `actor_authority_id` has no FK or authority check.
- Counterexample: a role granted EXECUTE invokes the function with another
  user's actor ID, an authority ID not held by that user, and `APPROVED`.
- Impact: event authenticity and audit attribution can be forged; approval
  authority can be manufactured unless the omitted function body contains
  controls not present in the reviewed design.
- Required correction: derive actor identity from a trusted session/role
  mapping or a separately authenticated principal; derive authority from an
  exact immutable authority record; define and enforce the complete transition
  matrix; reject entity/actor scope mismatches.
- Acceptance: tests prove reviewer A cannot emit an event attributed to user B,
  use authority C without a current grant, or choose an undefined transition.

## P2

### REV-R3-C4-P2-01 — ProfessionalReview policy equality is not enforced by the shown DDL

- Files:
  - `docs/product/full-mvp-remediation-design-r3-c4/PROFESSIONAL_REVIEW_COMPOSITE_FK_DESIGN_R3_C4.md:101-102,150-151`
- Problem: `professional_review_event_policy_matches_review` checks only
  `policy_revision_id IS NOT NULL`, which repeats `NOT NULL` and does not
  compare with the Review.
- Required correction: add `FK(policy_revision_id)` and a concrete deferred
  constraint trigger or make policy equality part of an exact composite FK.

### REV-R3-C4-P2-02 — Deferred validation lacks executable trigger coverage

- Files:
  - `docs/product/full-mvp-remediation-design-r3-c4/SNAPSHOT_DEFERRED_VALIDATION_CONTRACT_R1.md:18-31,67-76`
- Problem: no trigger DDL, owner, fixed `search_path`, execute revokes, or exact
  event list is provided. `AFTER INSERT/UPDATE` leaves DELETE and Header state
  transition semantics unspecified.
- Required correction: publish the exact `CREATE CONSTRAINT TRIGGER`
  statements, touched tables/events, function owner/grants, and commit-time
  matrix.

### REV-R3-C4-P2-03 — Snapshot parent/source FKs are prose rather than declared constraints

- Files:
  - `docs/product/full-mvp-remediation-design-r3-c4/SNAPSHOT_NORMALIZED_CHILD_SCHEMA_R1.md:20-192`
- Problem: most child rows have no explicit FK to Snapshot Header; candidate
  children use `candidateRowId -> Candidate(id)` without proving
  `child.snapshotId = candidate.snapshotId`; review/source rows lack exact
  source FKs.
- Required correction: add composite same-snapshot parent keys and exact
  source/revision FKs, with `RESTRICT` behavior suitable for finalized rows.

### REV-R3-C4-P2-04 — Event privilege design omits several PostgreSQL bypass surfaces

- File:
  - `docs/product/full-mvp-remediation-design-r3-c4/EVENT_ONLY_DATABASE_PRIVILEGE_DESIGN_R1.md:25-50,83-109`
- Problem: schema `USAGE/CREATE`, default privileges, sequences, role
  membership/inheritance, `ALTER FUNCTION ... OWNER TO`, trigger-function
  execute revocation and ownership of the writable `approved_review_schema`
  are not specified.
- Required correction: provide exact pre/post privilege inspection and deny
  paths for every object and role.

### REV-R3-C4-P2-05 — Registry and protocol disagree on field order behavior

- Files:
  - `docs/product/full-mvp-remediation-design-r3-c4/SNAPSHOT_REGISTRY_R1.md:177`
  - `docs/product/full-mvp-remediation-design-r3-c4/R3_BASIS_V4_PROTOCOL_AND_VECTOR_SPEC.md:83-90`
  - `docs/product/full-mvp-remediation-design-r3-c4/P1_PRODUCT_REMEDIATION_TEST_PLAN_R3_C4.md:53-54`
- Problem: the Registry rejects misordered input while the protocol and tests
  require canonical sorting to make reversed input equivalent.
- Required correction: reject duplicate/non-canonical *pre-decoded* frames only
  as explicitly intended; define separate API-input and parser-input rules.

### REV-R3-C4-P2-06 — Canonical source component domain contradicts Unicode tests

- File:
  - `docs/product/full-mvp-remediation-design-r3-c4/CANONICAL_SOURCE_IDENTITY_R2.md:25-38,62-70`
- Problem: components are limited to 64 ASCII bytes, but tests require Unicode
  and normalization behavior.
- Required correction: define separate ASCII ID and UTF-8 text component
  domains and their byte limits, or remove Unicode from the domain and tests.

## P3

### REV-R3-C4-P3-01 — Test Plan calls the Registry “nine record types”

- File:
  - `docs/product/full-mvp-remediation-design-r3-c4/P1_PRODUCT_REMEDIATION_TEST_PLAN_R3_C4.md:31`
- Problem: the Registry has ten record types, `0` through `9`; the vector has
  nine non-header child types.
- Required correction: say “ten record types including Header” or “nine child
  record types”.

