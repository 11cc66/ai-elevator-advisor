# FULL-MVP-REMEDIATION-REVIEW-R3 Independent Findings

Date: 2026-11-24

Review mode: independent, read-only, adversarial design review.

Reviewed design status:

```text
R3 DESIGN COMPLETE WITH OPEN BLOCKERS
```

Independent result:

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

## Counts

```text
P0: 0
P1: 6
P2: 4
P3: 1
```

No finding means implementation, migration, database behavior or Runtime
verification has occurred.

## P0

```text
NONE IDENTIFIED
```

The remaining problems are reachable through direct database writes only
after the proposed tables exist, and no current implementation was changed or
executed. A future implementation that follows this design would carry P1
evidence-integrity risk.

## P1

### REV-R3-P1-01 — The RequirementVersion parent key required by the assertion/value FKs is not declared

- Severity: P1
- Evidence:
  - `P1_PRODUCT_REMEDIATION_DESIGN_R3.md:155-167` defines
    `RequirementVersion` and its UNIQUE keys.
  - `P1_PRODUCT_REMEDIATION_DESIGN_R3.md:169-226` defines Assertion and
    FieldValue FKs to columns
    `(id, requirementId, projectId, conversationId)`.
- Problem: PostgreSQL foreign keys must reference a declared UNIQUE/PK column
  set with exactly matching columns. The design declares:
  - `UNIQUE(id, projectId, conversationId)`;
  - `UNIQUE(id, projectId, conversationId, installationScenario)`;
  - `UNIQUE(id, requirementId, projectId, conversationId, installationScenario)`.

  None is exactly `(id, requirementId, projectId, conversationId)`, which the
  Assertion FK and FieldValue FK require. The same mismatch affects
  `RequirementConfirmationEvent`.
- Counterexample: a migration author follows the R3 text literally and creates
  the listed UNIQUE constraints. PostgreSQL rejects the Assertion/Value FK at
  migration time. If the implementer adds an unplanned key, the design is no
  longer the reviewed design and the exact ownership contract is unverified.
- Impact: The primary source-of-truth chain cannot be implemented as written.
  This is not a tuning issue; it blocks the foundational Requirement schema.
- Required correction:
  - add `UNIQUE(id, requirementId, projectId, conversationId)` to
    `RequirementVersion`, or change every dependent FK to include
    `installationScenario` and declare that exact key;
  - make the same exact key explicit for `RequirementConfirmationEvent`;
  - state `MATCH FULL` versus `MATCH SIMPLE` and NULL behavior for every
    composite relation.
- Acceptance:
  - each Assertion and FieldValue FK references a key whose column list exactly
    equals the referencing list;
  - migration on an empty isolated test database creates all FKs;
  - direct SQL cross-version/cross-requirement inserts fail.
- Blocks: Requirement persistence and all downstream selection/sales work.

### REV-R3-P1-02 — Assertion and FieldValue tables omit the semantic value/status model needed by the selected source of truth

- Severity: P1
- Evidence:
  - R3 `RequirementFieldAssertion` only declares source identity, source type,
    message ID and creator, at
    `P1_PRODUCT_REMEDIATION_DESIGN_R3.md:169-195`.
  - R3 `RequirementFieldValue` only declares ownership, field key and
    `sourceAssertionId`, at `P1_PRODUCT_REMEDIATION_DESIGN_R3.md:197-226`.
  - R2's accepted model includes assertion polarity, semantic kind, value,
    unit, condition state, time scope, modality, parser version and
    confirmation state, and resolved value/status/unit fields.
  - Current selection reads `requirement.fields` at
    `apps/web/src/modules/selection/service.ts:37-43`;
    `prisma/schema.prisma:904-912` stores the current JSON projection.
- Problem: The R3 table sketch does not contain any column that stores the
  actual assertion value, polarity, condition, semantic kind, parser version,
  or the resolved canonical value/status/unit. A FieldValue row can prove
  ownership but cannot supply the selection engine with a selected fact.
- Counterexample: A valid FieldValue row with fieldKey
  `externalInstallationAllowed` has no `canonicalValueJson` or `fieldStatus`.
  Selection must either read the legacy JSON (the defect R2 corrected) or
  invent an unspecified field elsewhere.
- Impact: The claimed single source of truth is not representable. The
  approved conditional/exception semantics and fail-closed selection cannot be
  implemented from the R3 schema.
- Required correction:
  - restore the complete assertion fields from the accepted R2 model;
  - restore `canonicalValueJson`, `valueType`, `unit`, `fieldStatus`,
    `sourceType`, `requiresProfessionalReview` and confirmation provenance on
    `RequirementFieldValue`;
  - make an unresolved/conditional/conflicted assertion unable to create a
    resolved FieldValue through a DB constraint or controlled function;
  - specify the exact canonical value encoding for every field type.
- Acceptance:
  - a direct insert cannot create a resolved value without an explicit
    canonical value, status and source assertion;
  - uncertain/conditional/conflicted assertions cannot become formal selection
    input;
  - selection and audit read the same FieldValue row and its exact assertion.
- Blocks: Requirement parser, selection input, history and audit.

### REV-R3-P1-03 — RuleSet approval status is not tied to the review-event history

- Severity: P1
- Evidence:
  - `P1_PRODUCT_REMEDIATION_DESIGN_R3.md:536-557` makes `status` and
    `statusVersion` ordinary fields. The only CHECK requires non-null approval
    metadata when status is `APPROVED`.
  - `P1_PRODUCT_REMEDIATION_DESIGN_R3.md:570-584` defines review events but no
    function, trigger, permission rule or current-state constraint linking
    event sequence/status to the revision row.
  - Test plan `R3-RULE-03` and `R3-RULE-04` do not attempt direct status
    approval without an event (`P1_PRODUCT_REMEDIATION_TEST_PLAN_R3.md:82-91`).
- Counterexample: a role with normal table UPDATE can set a rule-set revision
  to `APPROVED`, set `approvedAt` and `approvedByUserId`, and leave no
  `SelectionRuleSetReviewEvent`. The formal resolver sees APPROVED and may
  allow `OPERATIONAL`.
- Impact: The approved-rule gate can be bypassed without a professional
  approval event, invalidating the primary Operational safety control.
- Required correction:
  - make the revision status/current projection writable only by a controlled
    approval/transition function;
  - revoke direct INSERT/UPDATE/DELETE on revision status/event/history from
    ordinary roles;
  - require event sequence, previous/new status, actor authority and exact
    content/authority digest to match;
  - make `APPROVED` require a matching approved event and current source
    verification;
  - add a direct SQL no-event approval test.
- Acceptance:
  - an APPROVED status with no matching event is impossible;
  - event history can reconstruct the current status and version;
  - direct status mutation, event deletion and event reordering fail closed;
  - formal evaluation returns `REQUIRES_PROFESSIONAL_REVIEW` for an
    event-inconsistent rule set.
- Blocks: RuleSet approval, formal selection and `OPERATIONAL`.

### REV-R3-P1-04 — ProfessionalReview current state can diverge from its event history

- Severity: P1
- Evidence:
  - `P1_PRODUCT_REMEDIATION_DESIGN_R3.md:703-737` stores `state` and
    `stateVersion` directly on `ProfessionalReview`.
  - `P1_PRODUCT_REMEDIATION_DESIGN_R3.md:766-797` defines events and says a
    function and role restrictions exist, but no database-level check,
    partition constraint or trigger proves:
    - current state equals the last event;
    - previous state equals the prior event state;
    - stateVersion is monotonic;
    - event insertion and current-state update cannot occur separately;
    - direct UPDATE of `ProfessionalReview.state` is rejected.
- Counterexample: an application/database role updates a review to `APPROVED`
  without adding an event, or inserts an APPROVED event but leaves the review
  at `IN_REVIEW`. The formal resolver may use one representation while the
  audit endpoint uses the other.
- Impact: The professional approval gate and audit trail can disagree. A
  stale or forged approval projection can authorize formal Operational output.
- Required correction:
  - make event history the authority and current state a controlled projection;
  - add database trigger/function checks for exact previous state, allowed
    transition, monotonic version, request idempotency and same-basis policy;
  - revoke direct state mutation from ordinary roles;
  - add direct SQL tamper tests and a reconstruction test that compares the
    last event to the current row.
- Acceptance:
  - no commit can produce an APPROVED current row without a matching event;
  - no commit can produce an event whose previous state differs from the prior
    event;
  - concurrent approve/reject produces exactly one event/chain;
  - a current-state/event mismatch is rejected or quarantined.
- Blocks: Professional review and Operational gating.

### REV-R3-P1-05 — R3-BASIS-1 is not fully specified and cannot yet be independently implemented or DB-recomputed

- Severity: P1
- Evidence:
  - `P1_PRODUCT_REMEDIATION_DESIGN_R3.md:1101-1123` defines a byte framing
    algorithm but leaves `encodedValue`, `stableKey` and `rowId` undefined.
  - The algorithm does not specify canonical numeric representation, decimal
    precision, Unicode normalization, boolean/null encodings, unit
    representation, time encoding, array/list order, duplicate handling or
    scalar type tags.
  - Test plan `R3-SNP-12` and `R3-SNP-13` call for reconstruction and digest
    matching but provide no test vectors for null versus empty string, Unicode
    normalization, decimal scale, repeated values or independently implemented
    encoders.
- Counterexample: one implementation encodes decimals as `1.0` and another as
  `1.00`, or one normalizes Unicode while another does not. Both satisfy the
  prose but produce different `basisDigest`, while a collision-prone or
  type-confused encoding can make different rows produce the same bytes.
- Impact: The database/read path cannot independently prove the snapshot
  basis. Valid snapshots may be rejected; forged or semantically different
  snapshots may be accepted.
- Required correction:
  - define a complete versioned scalar encoding and field catalogue;
  - name exact SQL function(s), language, privileges and deployment version;
  - specify canonical sort keys and duplicate/array rules;
  - publish deterministic test vectors with independent implementation
    fixtures;
  - state whether PostgreSQL's native functions or a trusted serializer
    computes bytes, and how the DB compares the result.
- Acceptance:
  - two independent implementations produce byte-identical encodings for all
    test vectors;
  - direct SQL cannot set a matching-looking digest for different normalized
    rows;
  - null, empty string, Unicode, decimal, unit and repeated-row cases are
    covered;
  - old schema versions remain recomputable.
- Blocks: Snapshot creation, export and historical evidence reconstruction.

### REV-R3-P1-06 — Snapshot RequirementField source assertion is not tied to the authoritative FieldValue

- Severity: P1
- Evidence:
  - `P1_PRODUCT_REMEDIATION_DESIGN_R3.md:928-976` stores both
    `sourceFieldValueId` and a separate `sourceAssertionId`.
  - `P1_PRODUCT_REMEDIATION_DESIGN_R3.md:1081-1084` describes deferred checks
    for copied value/status/digest, but not equality between the snapshot
    assertion and `RequirementFieldValue.sourceAssertionId`.
  - Test `R3-SNP-10` only changes copied value/status
    (`P1_PRODUCT_REMEDIATION_TEST_PLAN_R3.md:156-158`).
- Counterexample: F is a valid FieldValue sourced from assertion A1. The
  snapshot row uses `sourceFieldValueId=F` and `sourceAssertionId=A2`, where A2
  is another valid assertion in the same RequirementVersion. Both FKs pass.
  The snapshot claims A2 as provenance even though the authoritative value F
  came from A1.
- Impact: Sales history can show a false source without changing the value.
  This breaks the same provenance guarantee R3 P1-01 is intended to
  guarantee.
- Required correction:
  - remove the duplicated assertion field or constrain it with a composite FK
    to `(RequirementFieldValue.sourceAssertionId, requirement ownership)`;
  - add a deferred equality check between the FieldValue's assertion and the
    snapshot source;
  - add a direct negative test with two valid assertions.
- Acceptance:
  - a snapshot field cannot select a different assertion from its authoritative
    FieldValue;
  - changing the FieldValue's source assertion after snapshot creation is
    impossible or changes a new version only;
  - audit and reconstructed payload show the exact source assertion.
- Blocks: Sales snapshot provenance.

## P2

### REV-R3-P2-01 — Actor/author identity is not fully bound for Requirement and confirmation sources

- Severity: P2
- Evidence:
  - R3 `AdvisorMessage` has only `conversationId`, `P1_PRODUCT_REMEDIATION_DESIGN_R3.md:140-143`.
  - R3 `RequirementFieldAssertion.createdByUserId` has no declared User FK,
    `P1_PRODUCT_REMEDIATION_DESIGN_R3.md:169-195`.
  - R3 `RequirementConfirmationEvent.actorUserId` has no User FK in the block,
    `P1_PRODUCT_REMEDIATION_DESIGN_R3.md:285-304`.
  - Current `AdvisorMessage` has no author column:
    `prisma/schema.prisma:887-901`.
- Failure path: a direct DB writer creates a customer-message assertion whose
  createdByUser is a different user or nonexistent user, while the message
  belongs to the customer conversation. The source chain's ownership is
  syntactically correct but the actor is false.
- Impact: Audit attribution and project authorization cannot be reconstructed
  from the proposed schema.
- Required correction: add trusted User FKs to all actor fields and bind a
  message to its author/session identity without trusting the client.
- Acceptance: direct SQL rejects unknown/cross-project actors; confirmation
  actor equals the authenticated command actor.
- Blocks: provenance audit, not the entire mechanism.

### REV-R3-P2-02 — The migration from current BuildingRequirement rows to stable Requirement/Version identities is not complete

- Severity: P2
- Evidence:
  - R3 introduces stable `Requirement` and `RequirementVersion` at
    `P1_PRODUCT_REMEDIATION_DESIGN_R3.md:103-167`.
  - Current implementation stores each version as a
    `BuildingRequirement` row with nullable `conversationId`, JSON fields and
    project-level version uniqueness:
    `prisma/schema.prisma:904-928`;
    `apps/web/src/modules/advisor/service.ts:85-123`.
  - R3 only states that legacy rows without conversation are read-only or
    quarantined; it does not define how existing conversation-linked rows are
    mapped into stable Requirement identities/versions or how JSON/source data
    is resolved.
- Impact: A migration cannot deterministically create the new chain for
  existing data. Implementers must invent a mapping, risking loss of history
  or incorrect requirement ownership.
- Required correction: define a preflight inventory, stable identity key,
  version-chain mapping, JSON/assertion mapping, conflict quarantine and
  rollback boundary.
- Acceptance: an existing demo project migrates with a complete Requirement
  chain or enters a recorded quarantine; no JSON value is silently chosen.
- Blocks: Legacy migration; not the new empty-database schema.

### REV-R3-P2-03 — CatalogReview and RuleSetReview append-only/current-state behavior is not fully specified at DB level

- Severity: P2
- Evidence:
  - R3 `CatalogReview` has a decision and function prose at
    `P1_PRODUCT_REMEDIATION_DESIGN_R3.md:413-478`, but no explicit
    UPDATE/DELETE trigger, current-decision uniqueness or construction rule in
    the block.
  - R3 `SelectionRuleSetRevision`/ReviewEvent at
    `P1_PRODUCT_REMEDIATION_DESIGN_R3.md:536-584` has no explicit transition
    function, append-only trigger or status-projection constraint.
  - R3 test plan has `R3-RULE-08`, but no test inserts an APPROVED status with
    no event or directly mutates a decision.
- Impact: Direct SQL or a future repository can create review/approval states
  that are not derivable from the event history.
- Required correction: name the approved database function/trigger and
  least-privilege grants; enforce immutable decisions and current projection;
  add direct mutation tests.
- Acceptance: no approval/review event can be updated/deleted; no status
  transition can commit without its event.
- Blocks: Catalog/rules formal trust until corrected.

### REV-R3-P2-04 — Test matrix omits key counterexamples for the newly introduced models

- Severity: P2
- Evidence:
  - `P1_PRODUCT_REMEDIATION_TEST_PLAN_R3.md:31-43` covers source ownership but
    not missing source value/status fields or actor identity.
  - `P1_PRODUCT_REMEDIATION_TEST_PLAN_R3.md:82-91` covers rule digest and
    self-approval but not no-event approval, status projection, or direct
    current-state mutation.
  - `P1_PRODUCT_REMEDIATION_TEST_PLAN_R3.md:103-112` covers event
    previous-state and duplicate sequence but not direct `ProfessionalReview`
    state update, current/event divergence, or forbidden event transition.
  - `P1_PRODUCT_REMEDIATION_TEST_PLAN_R3.md:156-165` covers copied values but
    not copied source assertion identity.
  - No vectorized `R3-BASIS-1` boundary tests exist for null/empty, Unicode,
    decimals, type tags, duplicates or independent encoders.
- Impact: Tests can pass while the P1 defects above remain.
- Required correction: add direct DB negative tests and independent byte
  vectors, including final DB states and no-side-effect assertions.
- Acceptance: each claimed DB invariant has a negative test; each codec case
  has a fixed vector and two independent implementations.
- Blocks: Database test approval.

## P3

### REV-R3-P3-01 — R3 traceability overstates design closure relative to the incomplete schema and event projection

- Severity: P3
- Location: `P1_PRODUCT_REMEDIATION_TRACEABILITY_R3.md:18-32`
- Problem: R3 marks all five R2 P1 findings as `DESIGN_ADDRESSED_PENDING_REVIEW`
  while the Requirement schema omits the accepted semantic/value fields, the
  FKs have no exact parent key, and RuleSet/ProfessionalReview status projection
  has no database-level enforcement. The trace does not identify these
  residuals.
- Impact: A reader can treat layout/field sketches as implementation-ready.
- Required correction: add R3 findings and mark each as unresolved or dependent.
- Acceptance: traceability counts and design completeness agree with the
  independent findings before the next review.
- Blocks: no implementation; it is a report integrity issue.

## Severity Summary

The highest-risk unresolved issues are:

1. a key/layout mismatch in the Requirement source chain;
2. no stored semantic value/status in the authoritative Requirement model;
3. rule-set approval status not event-bound;
4. professional-review current state not provably derived from events;
5. `R3-BASIS-1` not independently specified;
6. snapshot field source assertion can diverge from the FieldValue authority.

No P0 finding is identified in this design-only review.
