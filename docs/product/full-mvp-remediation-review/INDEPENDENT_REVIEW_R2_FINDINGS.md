# FULL-MVP-REMEDIATION-REVIEW-R2 Independent Findings

Date: 2026-11-23

Review type: independent, read-only, adversarial design review.

Reviewed design status:

```text
R2 DESIGN COMPLETE WITH OPEN BLOCKERS
```

Independent result:

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

## Counts

```text
P0: 0
P1: 5
P2: 5
P3: 1
```

No finding below means source implementation, database migration, Runtime
verification or problem closure has occurred.

## P0

```text
NONE IDENTIFIED
```

## P1

### REV-R2-P1-01 — Requirement provenance can point outside its requirement and conversation

- Severity: P1
- Location:
  - `P1_PRODUCT_REMEDIATION_DESIGN_R2.md:238-300`
  - `P1_PRODUCT_REMEDIATION_DESIGN_R2.md:338-365`
  - `P1_PRODUCT_REMEDIATION_TEST_PLAN_R2.md:70-85`
- Current implementation evidence:
  - `prisma/schema.prisma:904-942`
  - `apps/web/src/modules/selection/service.ts:17-43`
- Problem: `RequirementFieldValue.sourceAssertionId` has an independent ID and
  no declared composite FK to an assertion carrying the same `requirementId`.
  `RequirementFieldAssertion.sourceMessageId` similarly has no declared
  ownership constraint proving that the message belongs to the requirement's
  conversation. `confirmationBy` is described as an actor but has no declared
  same-project or User FK rule.
- Counterexample: Requirement A in conversation A1 stores a resolved value and
  sets `sourceAssertionId` to an assertion from requirement B in conversation
  B1. Both rows are valid by their own PK/FK rules. Selection reads A's value,
  while the audit endpoint reports B1 as its source. A future direct SQL,
  import, migration or alternate write service can create this state.
- Impact: Trusted field provenance can be forged or accidentally crossed
  without changing the selected value's uniqueness. This defeats the intended
  single-fact/source chain and can misattribute customer or professional
  evidence.
- Why existing tests are insufficient: `SRC-04` checks that audit reads the
  same value/source in the normal path. No test attempts a cross-requirement
  or cross-conversation source link.
- Required correction:
  - add `UNIQUE(requirementId, id)` to `RequirementFieldAssertion`;
  - add a composite FK from `(requirementId, sourceAssertionId)` to that key;
  - bind a source message through the exact conversation/requirement chain;
  - bind confirmation actors to a trusted User FK;
  - normalize any conflict candidate IDs that must be auditable;
  - define whether a system-derived value may omit a source assertion and make
    that exception explicit.
- Acceptance:
  - direct SQL cannot link a value to an assertion from another requirement;
  - direct SQL cannot link a source message from another conversation;
  - direct SQL cannot use an unknown or out-of-scope confirmer;
  - selection and source-audit queries still resolve the same exact row.
- Blocks implementation: requirement persistence, selection input, provenance
  API and migration.

### REV-R2-P1-02 — Catalog source digest is not backed by immutable content evidence

- Severity: P1
- Location:
  - `P1_PRODUCT_REMEDIATION_DESIGN_R2.md:460-480`
  - `P1_PRODUCT_REMEDIATION_DESIGN_R2.md:491-535`
  - `P1_PRODUCT_REMEDIATION_OPEN_DECISIONS_R2.md:76-96`
- Current implementation evidence:
  - `prisma/schema.prisma:949-1039`
- Problem: `CatalogSourceRevision` stores a mutable-looking `locator` and a
  required `contentDigest`, but no immutable content object, stored evidence
  bytes, stable evidence identity, or mandatory content-availability check.
  Making the database row immutable does not make external URL/file content
  immutable.
- Counterexample: A source at locator L is reviewed with digest D and retained
  as SourceRevision S1. The external content at L later changes while S1 is not
  edited and no withdrawal/new revision is recorded. The old review still
  points to S1 and D, but the system has no stored content with which to prove
  that D ever represented the reviewed evidence.
- Impact: A formal review can remain apparently valid after the external source
  changes or disappears. This leaves the original catalog-source trust defect
  partially open and makes later audit impossible.
- Why existing tests are insufficient: `CAT-03` rejects a null digest and
  `CAT-04` attempts to alter the database row. Neither tests mutable external
  content, unavailable evidence or an unverifiable digest.
- Required correction:
  - define the stable content identity used by `contentDigest`;
  - either retain immutable evidence content in an approved evidence store or
    require a verifiable signed/archived artifact identity;
  - define fail-closed behavior when the evidence cannot be fetched or its
    digest cannot be verified;
  - bind the review input digest to the exact policy version and evidence
    set;
  - keep catalog evidence integration separate from any change to the P1-3
    file lifecycle protocol.
- Acceptance:
  - formal review rejects a digest with no verifiable evidence identity;
  - changing or removing external locator content cannot leave the old source
    revision silently valid;
  - an auditor can recompute the source and review digests from retained
    evidence or receive a typed trust failure.
- Blocks implementation: source review, catalog approval and formal selection.

### REV-R2-P1-03 — Sales handoff does not bind case, project, requirement, version and selection run as one exact chain

- Severity: P1
- Location:
  - `P1_PRODUCT_REMEDIATION_DESIGN_R2.md:409-430`
  - `P1_PRODUCT_REMEDIATION_DESIGN_R2.md:756-781`
  - `P1_PRODUCT_REMEDIATION_TEST_PLAN_R2.md:152-173`
- Current implementation evidence:
  - `prisma/schema.prisma:1042-1097`
  - `apps/web/src/modules/mvp/store.ts:1001-1066`
- Problem: `SalesHandoffSnapshot` independently references a project,
  requirement and selection run. The design only proves:
  - requirement belongs to the same project;
  - selection run belongs to the same project;
  - snapshot belongs to its case by ID.

  It does not prove:
  - snapshot project equals its case project;
  - selection run's requirement equals the snapshot requirement;
  - snapshot `requirementVersion` equals the referenced requirement row;
  - the snapshot conversation matches the requirement conversation.
- Counterexamples:
  1. Case C belongs to project P1. A snapshot is inserted with `caseId=C` but
     `projectId=P2`, `requirementId` from P2 and `selectionRunId` from P2. Both
     project-qualified FKs pass, and `currentSnapshotId` passes because it binds
     only snapshot ID and case ID.
  2. Case C and snapshot use project P. `requirementId=RA` is a confirmed
     requirement, while `selectionRunId=RB_RUN` is a run based on requirement
     RB in the same project. Both project-qualified FKs pass, but the handoff
     labels RA's evidence while exposing RB's recommendation.
- Impact: A sales user can receive a snapshot whose project, requirement or
  recommendation basis differs from the payload. That is both an integrity
  failure and, for the cross-project case, a confidentiality boundary failure
  if application filtering is later bypassed or implemented incorrectly.
- Why existing tests are insufficient: `DB-17` and `DB-18` test cross-project
  references separately. They do not test a same-project wrong requirement/run
  pair or a case/snapshot project mismatch. `SNP-01` states the desired normal
  path but does not prove a DB invariant.
- Required correction:
  - add a case key such as `UNIQUE(id, projectId)`;
  - link snapshot `(caseId, projectId)` to that exact case key;
  - add a selection-run key including requirement identity, for example
    `UNIQUE(id, projectId, requirementId)`;
  - link the snapshot's `(selectionRunId, projectId, requirementId)` as one FK;
  - include conversation and immutable requirement version in the exact
    requirement key;
  - specify `ON DELETE/UPDATE RESTRICT` for historical evidence.
- Acceptance:
  - direct SQL rejects a case/snapshot project mismatch;
  - direct SQL rejects a selection run built from a different requirement;
  - direct SQL rejects a fake snapshot requirement version;
  - a valid snapshot reconstructs one project, conversation, requirement
    version and selection run.
- Blocks implementation: sales snapshot schema, handoff API and sales read
  model.

### REV-R2-P1-04 — Professional-review state and basis are not a persistent executable model

- Severity: P1
- Location:
  - `P1_PRODUCT_REMEDIATION_DESIGN_R2.md:603-718`
  - `P1_PRODUCT_REMEDIATION_TEST_PLAN_R2.md:143-148`
  - `P1_PRODUCT_REMEDIATION_OPEN_DECISIONS_R2.md:334-353`
- Problem: R2 correctly defines separate assessment names, but does not define
  a professional-review record, append-only transition events, exact FKs,
  current-state projection, reviewer/submitter ownership, supersession,
  invalidation events, or uniqueness of an active approval over one exact
  basis. The displayed arrows are a list of labels rather than a transition
  matrix with actor, precondition, evidence, transaction boundary and failure
  state.
- Counterexample: A review is approved for a run, then a specification or
  source revision changes. Without a persisted invalidation event tied to the
  exact old and new basis, read code can continue returning `APPROVED`.
  Alternatively, a submitted review can be treated as approved because there is
  no constrained transition record.
- Impact: `OPERATIONAL` depends on professional approval, but the design does
  not make approval, rejection, return, expiry or invalidation a durable,
  database-verifiable fact. A changed basis can be presented as approved.
- Why existing tests are insufficient: `PROF-01` through `PROF-06` describe
  expected behavior but no DB tables/FKs/state guards exist to make those tests
  meaningful. No concurrency test covers approval racing with source,
  specification or rule changes.
- Required correction:
  - define `SelectionProfessionalReview` and append-only
    `ProfessionalReviewEvent` structures;
  - store exact selection run/candidate, requirement digest, rule-set digest,
    product revision, specification revision, optional price revision, source
    set digest and policy version;
  - store submitter and reviewer identities with trusted User FKs;
  - define allowed transition edges, actors, evidence and failure states;
  - make active approval unique per exact basis;
  - create an explicit invalidation/supersession event on any basis change;
  - require a transactional recheck of the basis at decision time.
- Acceptance:
  - submitted, in-review and approved are distinct durable states;
  - rejected, returned and invalidated reviews cannot authorize `OPERATIONAL`;
  - an approval cannot be reused after any bound basis changes;
  - concurrent approval and basis mutation produce one valid outcome and one
    fail-closed outcome.
- Blocks implementation: professional-review API/UI, formal selection and
  `OPERATIONAL`.

### REV-R2-P1-05 — Canonical snapshot payload and normalized snapshot items have no declared single authority

- Severity: P1
- Location:
  - `P1_PRODUCT_REMEDIATION_DESIGN_R2.md:788-863`
  - `P1_PRODUCT_REMEDIATION_TEST_PLAN_R2.md:154-172`
- Problem: R2 requires both a self-contained `canonicalPayload` and normalized
  item/source rows, but does not define which is authoritative, how both are
  generated from one transaction-time basis, or how their contents are
  cross-checked. `payloadFragmentDigest` has no defined input, no relation to
  the canonical payload, and no requirement that item refs exactly summarize
  one payload candidate.
- Counterexample: `SalesHandoffSnapshotItem` correctly references product A,
  specification A2 and price A3, while `canonicalPayload` contains product B,
  specification B1 and a different price. Both can be immutable and share a
  valid snapshot ID. The item FKs are correct in isolation, but the sales UI
  and audit reader can disagree about which product was handed off.
- Impact: A hash-protected snapshot can still contain two contradictory
  business facts. This preserves tampering evidence for each blob but does not
  establish that the two immutable representations describe the same handoff.
- Why existing tests are insufficient: `SNP-03` checks exact item FKs and
  `SNP-14` checks that a changed payload changes the payload digest. No test
  creates valid item refs with a contradictory payload or vice versa.
- Required correction:
  - choose either payload-first or items-first as the authoritative creation
    model, while keeping the other as an immutable derived projection;
  - define canonical item ordering and a digest over the complete normalized
    item/source set;
  - require the payload and normalized set to carry the same basis digest;
  - generate and verify both inside one controlled transaction/function;
  - make direct mutation of either side impossible.
- Acceptance:
  - the payload and item/source set can be independently reconstructed from
    one canonical basis;
  - a valid snapshot cannot describe different requirements, products,
    specification revisions, prices or source sets in its two representations;
  - direct SQL cannot insert or update one side without the matching digest.
- Blocks implementation: sales snapshot schema, sales API and historical
  evidence reader.

## P2

### REV-R2-P2-01 — Project scenario immutability is not fully translated into database behavior

- Severity: P2
- Location: `P1_PRODUCT_REMEDIATION_DESIGN_R2.md:371-444`
- Problem: R2 states that project scenario is canonical, `projectType` follows
  a deterministic mapping, and scenario becomes immutable after a conversation.
  It does not define:
  - `installationScenario NOT NULL`;
  - a database CHECK for the legacy `projectType` mapping;
  - `ON UPDATE RESTRICT` for historical composite FKs;
  - a trigger or equivalent that rejects a project-scenario update after
    activity starts.
- Failure path: an administrator or future alternate write path updates
  `Project.installationScenario` while historical conversations exist. If the
  FK is implemented with a default/cascade choice intended for convenience,
  the historical scenario chain can change or the migration can become
  inconsistent.
- Impact: The core composite-FK chain works for inserts but may not preserve
  historical scenario identity under updates.
- Required correction: specify nullability, legacy mapping CHECK, update
  behavior and the immutable-after-activity trigger.
- Acceptance: direct SQL update of project scenario after the first
  conversation is rejected and all history remains unchanged.
- Blocks implementation: migration and project update API.

### REV-R2-P2-02 — Selection rule-set identity is not carried through the persisted result contract

- Severity: P2
- Location:
  - `P1_PRODUCT_REMEDIATION_DESIGN_R2.md:681-749`
  - `P1_PRODUCT_REMEDIATION_TEST_PLAN_R2.md:139-142`
- Problem: `SelectionRuleSet` and `SelectionRule` are described in prose, but
  no concrete table/key/FK model is given. `SelectionCandidateResult` carries
  only `ruleSetVersion`, not an exact rule-set ID or canonical digest. A
  candidate can therefore be persisted without a database-verifiable reference
  to the exact approved rule basis.
- Failure path: two rule sets have the same display version, or a rule set is
  superseded after a run. Historical candidates retain only a string that
  cannot be resolved to one immutable approved rule set.
- Impact: The selected status may be reproducible only by application
  convention, not from durable exact evidence.
- Required correction: define concrete immutable rule-set/rule IDs and link
  each run/candidate to the exact rule-set ID and digest.
- Acceptance: a candidate with no exact immutable rule-set reference cannot be
  persisted or used in a formal result.
- Blocks implementation: deterministic selection persistence and formal
  result.

### REV-R2-P2-03 — Advisor interaction idempotency records lack exact referential and failure-state semantics

- Severity: P2
- Location: `P1_PRODUCT_REMEDIATION_DESIGN_R2.md:907-940`
- Problem: `AdvisorInteractionRequest` stores message/requirement IDs and a
  `FAILED` state but declares no FKs proving those IDs belong to the same
  conversation. The meaning of `FAILED` is also unclear: a transaction that
  fails atomically leaves no row, while a separately committed failure record
  would require its own transaction and response contract.
- Failure path: a request row for conversation A points to a message or
  requirement from conversation B; a retry can return a response correlated to
  the wrong conversation. A separate `FAILED` row may be persisted without a
  defined retry policy or user-visible result.
- Impact: The idempotency mechanism can return an incorrect prior response or
  create contradictory transaction history.
- Required correction: add composite FKs for conversation/user/requirement/
  assistant message correlation and define exactly when `FAILED` is committed
  and how it is retried.
- Acceptance: direct SQL rejects cross-conversation correlation; a lost
  response returns the exact prior committed response; a failed transaction
  leaves no false committed mapping.
- Blocks implementation: advisor command transaction and retry contract.

### REV-R2-P2-04 — Review digest reproducibility omits an explicit policy-version identity

- Severity: P2
- Location:
  - `P1_PRODUCT_REMEDIATION_DESIGN_R2.md:496-525`
  - `P1_PRODUCT_REMEDIATION_OPEN_DECISIONS_R2.md:290-310`
- Problem: `inputDigest` is said to include the policy version, but
  `CatalogReview` has no stored `policyVersion`/policy-reference field. If the
  policy changes, an auditor cannot independently recompute the original
  digest without relying on a mutable default or external convention.
- Failure path: old review digest verification runs under a newer policy and
  incorrectly fails or, worse, accepts a recomputed digest without the same
  policy semantics.
- Impact: Review evidence cannot be reliably reproduced over time.
- Required correction: persist the exact policy version/reference and define
  the canonical digest input.
- Acceptance: a review created under an old policy remains verifiable after a
  newer policy is introduced, and a deliberate policy mismatch fails closed.
- Blocks implementation: catalog review and audit replay.

### REV-R2-P2-05 — Test matrix does not prove several newly identified database and concurrency invariants

- Severity: P2
- Location:
  - `P1_PRODUCT_REMEDIATION_TEST_PLAN_R2.md:70-173`
  - `P1_PRODUCT_REMEDIATION_TEST_PLAN_R2.md:224-229`
- Problem: The matrix remains too normal-path-heavy for the claims in the
  design. It lacks direct negative tests for:
  - same-project snapshot requirement/selection-run mismatch;
  - case/snapshot project mismatch;
  - canonical payload versus normalized item mismatch;
  - requirement value/assertion cross-requirement links;
  - source locator content change with an unchanged DB row;
  - professional review transition graph and basis invalidation under
    concurrent source/spec/rule mutation;
  - snapshot creation racing with source withdrawal;
  - price expiry racing with recommendation generation.
- Impact: The test suite can pass while the database accepts contradictory
  historical evidence or the reviewer can approve a stale basis.
- Required correction: add the listed negative and concurrency cases, each
  with final DB state and absence-of-effect assertions.
- Acceptance: every claimed database invariant has a direct failure test and
  every claimed concurrency rule identifies the winning and losing
  transaction.
- Blocks implementation: database migration acceptance and runtime test
  authorization.

## P3

### REV-R2-P3-01 — R2 traceability overstates that no new unresolved finding exists

- Severity: P3
- Location: `P1_PRODUCT_REMEDIATION_TRACEABILITY_R2.md:71-86`
- Problem: The trace states that R2 introduces no new unresolved design
  finding, while the independent review finds the provenance, source-evidence,
  snapshot-chain and professional-review gaps above.
- Impact: A reader may stop at the `DESIGN_CORRECTED` labels and overlook
  structural invariants that are only described by prose.
- Required correction: qualify the trace table as “no author-identified new
  issue” and add the independent R2 finding IDs when the next correction round
  is authored.
- Acceptance: traceability and review counts reconcile exactly before a next
  approval decision.
- Blocks implementation: no.

## Finding Summary

The highest-risk unresolved issues are:

1. requirement field provenance can cross requirement/conversation boundaries;
2. source digests are not backed by immutable, auditable content evidence;
3. sales snapshot ownership and selection basis are not one exact composite
   chain;
4. professional-review decisions are not a durable, enforced state machine;
5. canonical snapshot payload and normalized snapshot items can disagree.

No P0 finding is identified in this design-only review. This is not a claim
that the eventual SQL, migration or Runtime implementation is safe.
