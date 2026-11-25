# FULL-MVP-REMEDIATION-REVIEW-R3-C2 Independent Findings

Date: 2026-11-24

Review type: independent, read-only, adversarial design review.

Reviewed status:

```text
R3-C2 DESIGN COMPLETE WITH OPEN BLOCKERS
```

Independent result:

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

## Counts

```text
P0: 0
P1: 3
P2: 4
P3: 1
```

No finding means implementation, database behavior and Runtime verification
have occurred.

## P0

```text
NONE IDENTIFIED
```

## P1

### REV-R3-C2-P1-01 — The fixed R3-BASIS-1 vectors are not reproducible from the stated protocol

- Severity: P1
- Affected invariant: exact `R3-BASIS-1` bytes and SHA-256; snapshot basis
  integrity.
- Design references:
  - `P1_PRODUCT_REMEDIATION_DESIGN_R3_C2.md:881-963` (protocol).
  - `P1_PRODUCT_REMEDIATION_TEST_PLAN_R3_C2.md:129-154` (V01–V26).
- Independent verification:
  - V01–V20 contain an extra `0000` two-byte field between the 16-byte
    `rowId` and the `stableKeyLength`. The protocol does not define that field.
  - Consequently expected record lengths are `0x29` while independent
    implementations produce `0x27`; body lengths differ by two bytes and every
    V01–V20 SHA-256 differs.
  - V21 declares `input=integer 1`, but the expected `field` is
    `...0000000131` (length 1). The protocol requires INTEGER to be exactly
    eight bytes; the independently encoded INTEGER field is
    `...000000080000000000000001`.
  - V22 and V23 reproduce independently; this is not enough to validate the
    format.
- Counterexample: a developer follows the protocol literally, implements the
  independent encoder, and runs V01. The resulting bytes are not the bytes in
  the test plan, so the test plan rejects a correct implementation.
- Why existing controls fail: the document supplies expected hashes but the
  expected field/record bytes themselves encode an unstated frame and a
  nonconforming INTEGER. A SHA value cannot repair inconsistent input bytes.
- Required correction:
  - regenerate V01–V20 from the exact protocol, with no unstated `0000`
    separator;
  - regenerate V21 with an eight-byte signed integer;
  - add a byte-diff test that fails before SHA comparison for frame mismatch;
  - include multi-record and multi-field vectors, not only one record/one field.
- Verification required:
  - two independent encoders produce exact identical bytes for every valid
    vector;
  - V01–V23 are independently reproduced;
  - V24–V26 are rejected before hashing;
  - the test artifact includes both expected and actual offset-level bytes.
- Blocks: snapshot digest implementation, snapshot creation and audit replay.

### REV-R3-C2-P1-02 — ProfessionalReview source events are not bound to the field's requirement/version

- Severity: P1
- Affected invariant: exact FieldValue provenance across Project,
  Conversation, RequirementVersion and professional review event.
- Design references:
  - `P1_PRODUCT_REMEDIATION_DESIGN_R3_C2.md:287-398` (FieldValue source kinds).
  - `P1_PRODUCT_REMEDIATION_DESIGN_R3_C2.md:737-848` (ProfessionalReview
    header/events).
- Problem: `RequirementFieldValue.sourceProfessionalReviewEventId` has a
  foreign key to `ProfessionalReviewEvent(id)`, and `sourceKey` is checked to
  equal that event ID. It does **not** prove that the event's review belongs to
  the same Project, Conversation, Requirement or RequirementVersion as the
  FieldValue.
- Counterexample:
  1. Create a valid professional-review event E in Project B/Requirement B.
  2. Insert a FieldValue in Project A/Requirement A with
     `sourceKind='PROFESSIONAL_REVIEW'`, `sourceKey=E.id` and
     `sourceProfessionalReviewEventId=E.id`.
  3. The event FK and sourceKey equality pass; the field's source is now a
     professional review from another requirement.
- Why existing controls fail: the exact composite FK on the field value covers
  the RequirementVersion chain, but the professional-event FK is a standalone
  ID. `sourceKey` is an identity consistency check, not an ownership check.
- Required correction:
  - bind the professional review event through its review header's exact
    project/conversation/requirement/version/candidate key;
  - add a composite FK or deferred trigger that verifies the event's review
    header exactly matches the FieldValue owner;
  - repeat the same ownership check for the Snapshot FieldValue source.
- Verification required: direct SQL cannot attach an event from another
  requirement/version; `C2-PRO-12`, `C2-SNP-10` and a new source-event test
  assert final DB rows.
- Blocks: professional review as a trusted Requirement fact source.

### REV-R3-C2-P1-03 — Source identity type is inconsistent with the current repository identifiers

- Severity: P1
- Affected invariant: executable FK/column definitions and migration
  compatibility.
- Design references:
  - `P1_PRODUCT_REMEDIATION_DESIGN_R3_C2.md:277-285` states `sourceKey` and
    source identity columns use native UUIDs.
  - `P1_PRODUCT_REMEDIATION_DESIGN_R3_C2.md:287-398` uses those identities in
    CHECK/FK expressions.
- Current implementation evidence:
  - `prisma/schema.prisma:197-203` defines `Project.id` as `String`/CUID.
  - `prisma/schema.prisma:887-901` defines `AdvisorMessage.id` and
    `conversationId` as String.
  - `prisma/schema.prisma:904-928` defines Requirement IDs and CUIDs as String.
- Problem: C2 uses native UUID equality for `sourceKey` and source identities,
  while the current repository uses CUID/text primary keys. A migration that
  follows C2 literally requires a repository-wide identifier type conversion
  or an explicit compatibility representation. C2 does not specify that
  conversion, backfill or dual-key transition.
- Counterexample: keep existing CUID `sourceAssertionId` and create
  `sourceKey UUID`; PostgreSQL cannot compare/enforce the intended equality
  without a cast, and a cast changes the type-safety claimed by C2. A partial
  conversion leaves existing FKs incompatible.
- Why existing controls fail: the exact C2 field definitions and current
  Prisma identities disagree. The design claims native UUID semantics without
  defining migration behavior.
- Required correction: choose one:
  1. retain text/CUID identifiers and define canonical source keys as
     length-delimited text; or
  2. define a full UUID conversion/backfill/compatibility migration.
  Record the choice in Open Decisions and Migration preflight.
- Verification required: migration on a clone containing existing CUID rows,
  plus a direct proof that the chosen key type matches every parent/child FK.
- Blocks: Requirement/evidence migration and all source-key constraints.

## P2

### REV-R3-C2-P2-01 — Typed value database types and range/unit checks remain under-specified

- Severity: P2
- Design reference: `P1_PRODUCT_REMEDIATION_DESIGN_R3_C2.md:170-419`
- Problem: the design names `booleanValue`, `integerValue`, `decimalValue`,
  text/enum/UUID/timestamp/bytes columns, but does not state exact PostgreSQL
  types, widths, decimal scale/precision, range bounds, unit allowlists,
  enum catalogue or `CHECK` predicates. The typed catalogue itself remains
  `OD-R3-C2-01`.
- Counterexample: a DECIMAL with scale 9 and an INTEGER beyond the intended
  engineering range can be accepted while the documentation still calls the
  model typed. Empty/whitespace text and unsupported units can be normalized
  differently by two implementations.
- Impact: two implementations can disagree on what values are valid, and the
  database cannot enforce the claimed field contract.
- Required correction: publish exact column SQL types, ranges, scales, units
  and enum codes, or mark the columns unimplemented until the decision is
  resolved.
- Verification required: direct SQL boundary tests for every type and unit.
- Blocks: typed-value migration and parser persistence.

### REV-R3-C2-P2-02 — R3-BASIS-1 vector coverage does not exercise a complete multi-record basis

- Severity: P2
- Design reference: `P1_PRODUCT_REMEDIATION_TEST_PLAN_R3_C2.md:121-154`
- Problem: all valid vectors encode one record and one field. There is no
  fixed vector for multiple records, multiple fields, field-tag ordering,
  record-type ordering, stableKey tie rejection with a second record, or a
  multi-record body-length calculation.
- Impact: a serializer can pass the documented vectors while producing
  non-canonical or ambiguous bytes for a real snapshot with many candidates,
  parameters, sources and reviews.
- Required correction: add at least multi-record/multi-field fixed vectors
  with exact bytes and hashes; include ordering and duplicate rejection.
- Verification required: two independent full-snapshot encoders.
- Blocks: snapshot implementation.

### REV-R3-C2-P2-03 — Some source/evidence combinations are declared unsupported but lack a migration-safe quarantine

- Severity: P2
- Design reference: `P1_PRODUCT_REMEDIATION_DESIGN_R3_C2.md:236-285`
- Problem: `OTHER_AUTHORIZED_SOURCE` is rejected by a `CHECK`-equivalent
  `implies false`, while `RequirementFieldValue` has no explicit quarantine
  table for existing sources that do not fit the current four source kinds.
  A legacy or future professional/document source cannot be represented as a
  typed row and may be silently dropped during migration.
- Counterexample: a legacy document-extraction field cannot be mapped to
  `USER_ASSERTION`, `PROFESSIONAL_REVIEW`, `CATALOG_EVIDENCE` or
  `SYSTEM_DERIVED`; inserting it fails, but the migration path does not record
  the source as quarantined.
- Impact: historical requirement facts may be lost or misclassified.
- Required correction: define an explicit quarantine row or typed extension
  path and make migration outcome observable.
- Verification required: legacy fixture maps to quarantine or a typed source;
  no fact is silently discarded.
- Blocks: legacy requirement migration.

### REV-R3-C2-P2-04 — Event functions and policy authoring still lack exact ownership/privilege design

- Severity: P2
- Design references:
  - `P1_PRODUCT_REMEDIATION_DESIGN_R3_C2.md:611-722` RuleSet.
  - `P1_PRODUCT_REMEDIATION_DESIGN_R3_C2.md:724-848` ProfessionalReview.
  - `P1_PRODUCT_REMEDIATION_OPEN_DECISIONS_R3_C2.md` `OD-R3-C2-03`.
- Problem: the documents say ordinary roles cannot insert events and name a
  transition function, but do not define exact DDL owner, `SECURITY DEFINER`
  versus invoker, fixed `search_path`, execute grants, function invocation
  signature or policy-revision authoring privileges. `OD-R3-C2-03` is an
  open decision, but the absence of these details is also a technical design
  gap.
- Counterexample: a role can execute the function with an arbitrary policy
  revision, or call the event table directly if grants are omitted; either
  bypasses the intended event-only state.
- Impact: the event-only design cannot be shown to be database-enforced.
- Required correction: provide exact function signatures, owner/role matrix,
  fixed search path, revoke/grant statements and policy-authoring constraints
  before implementation.
- Verification required: direct table write denial, function execution denial
  from unauthorized roles, and policy mismatch/transition tests.
- Blocks: RuleSet and ProfessionalReview implementation.

## P3

### REV-R3-C2-P3-01 — The R3-C2 traceability claims all P1s addressed despite the failed basis-vector reproduction

- Severity: P3
- Design reference: `P1_PRODUCT_REMEDIATION_TRACEABILITY_R3_C2.md:1-22`
- Problem: `REV-R3-P1-05` is marked `DESIGN_ADDRESSED_PENDING_REVIEW` while
  V01–V21 fail independent byte reproduction. The trace also describes
  `R3-BASIS-1` as complete.
- Impact: a reader may treat an inconsistent test artifact as ready for
  implementation.
- Required correction: add the failed vector result and new P1 IDs; do not
  label `R3-BASIS-1` complete until vectors are regenerated.
- Verification required: trace counts reconcile with the independent report.
- Blocks: report integrity only.

## Severity Summary

The highest-risk findings are:

1. inconsistent `R3-BASIS-1` vectors;
2. cross-requirement ProfessionalReview source events;
3. UUID/CUID source identity mismatch;
4. under-specified typed-value SQL contract;
5. incomplete multi-record codec evidence.

No P0 finding is identified in this design-only review.
