# Independent Review Findings

Status legend: all findings are design findings. None is an implementation finding.

## P0

```text
NONE IDENTIFIED
```

No current design path was confirmed that directly permits cross-customer access or a guaranteed false operational engineering conclusion without another design/implementation failure.

## P1

### REV-P1-01 — Conditional and multi-negation semantics remain under-specified

- Severity: P1
- Design location: `P1_PRODUCT_REMEDIATION_DESIGN.md:218-255`; `P1_PRODUCT_REMEDIATION_TEST_PLAN.md:16-36`.
- Related implementation: `apps/web/src/modules/advisor/mock-provider.ts:82-86`.
- Problem: The design distinguishes simple negation and a few ambiguous phrases, but does not define conditional, exception, temporal or multiple-negation grammar. The required examples from the review are absent from both design and tests.
- Counterexample: `如果物业不反对，可以考虑外装。` contains a conditional and a positive phrase. Without a conditional rule, an implementation may set the field true even though the condition is unverified. `不是不允许外装，只是需要再确认。` may be interpreted as a double-negative fact.
- Impact: Conditions and uncertainty can become customer-confirmed engineering facts, causing wrong candidate filtering.
- Why design is insufficient: “识别不确定词” is not an operational grammar; no condition-state or required test exists.
- Required correction: Define conditional and uncertain operators explicitly; any unresolved condition yields `NEEDS_CONFIRMATION`; add the exact six review inputs and multi-field cases with source spans and expected status.
- Acceptance: All conditional/double-negation cases have table-driven expected outcomes; no boolean is persisted for uncertain/conditional input.
- Blocking: Yes, Stage 1 cannot implement safely.

### REV-P1-02 — Scenario equality is not enforced by database constraints

- Severity: P1
- Design location: `P1_PRODUCT_REMEDIATION_DESIGN.md:280-290,854-865`.
- Related source/schema: `prisma/schema.prisma:904-912`; current conversation has no scenario.
- Problem: `Requirement(conversationId, projectId)` can be made valid by composite FK even if the requirement and conversation scenarios differ; project type is also not in the FK chain.
- Counterexample: Create Project P `OLD_BUILDING_ADDITION`, Conversation C `OLD_BUILDING_ADDITION`, then insert Requirement R with `conversationId=C`, `projectId=P`, `installationScenario=NEW_BUILDING_INSTALLATION`. The proposed FK passes. Selection reads the new-building scenario.
- Impact: The original scenario-drift P1 can remain reachable through a direct SQL path, import, migration bug or future alternate write endpoint.
- Why design is insufficient: Scenario is checked only by service rules; the stated database constraint chain omits it.
- Required correction: Add `Conversation UNIQUE(id,projectId,installationScenario)`, `Requirement UNIQUE(id,projectId,conversationId,installationScenario)`, and an FK from Requirement to Conversation on all four columns; add a `Project(id,projectType)` reference for inherited conversation scenario.
- Acceptance: `DB-25` attempts cross-scenario requirement and conversation/project links and receives FK/CHECK failure.
- Blocking: Yes, Stage 1 migration.

### REV-P1-03 — Requirement JSON and field-value provenance have no declared source of truth

- Severity: P1
- Design location: `P1_PRODUCT_REMEDIATION_DESIGN.md:292-415`.
- Related source/schema: `prisma/schema.prisma:904-912`; `apps/web/src/modules/selection/service.ts:37-43`.
- Problem: The design retains `BuildingRequirement.fields`/`missingFields` JSON and adds `RequirementFieldValue`, but never states which representation drives selection or how they stay consistent. The current selection service reads `fields`.
- Counterexample: A transaction or compatibility path stores `fields.externalInstallationAllowed=true` while the field row is false. Formal selection reads the JSON; the provenance UI reads the row. Both are valid database state.
- Impact: Source traceability can say one thing while the selected value is another; unsafe fact can bypass confirmation/provenance.
- Why design is insufficient: No canonicalization, derivation rule, DB CHECK/trigger or equality test is specified.
- Required correction: Make `RequirementFieldValue` authoritative and generate the JSON snapshot from it at commit, or make JSON the only source and remove field rows from the decision path. Store a digest and reject divergence.
- Acceptance: A transaction that mutates JSON and field rows inconsistently must fail; selection and provenance read the same immutable value.
- Blocking: Yes, Stage 1 and 3.

### REV-P1-04 — Run status conflates REQUIRES_PROFESSIONAL_REVIEW with INSUFFICIENT_DATA

- Severity: P1
- Design location: `P1_PRODUCT_REMEDIATION_DESIGN.md:609-638,721-789`.
- Problem: Candidate `REQUIRES_PROFESSIONAL_REVIEW` is collapsed to run `INSUFFICIENT_DATA`; no run-level review-pending state exists.
- Counterexample: Product and requirement data are complete, but no approved rule set exists. Candidate check returns `REQUIRES_PROFESSIONAL_REVIEW`; run summary returns `INSUFFICIENT_DATA`. The UI asks for missing data rather than rule authority/professional review.
- Impact: Incorrect workflow routing and a false representation of missing data.
- Why design is insufficient: The run state enum omits a distinct review-pending value and the test plan asserts only candidate state for `RA-01`.
- Required correction: Add `REQUIRES_PROFESSIONAL_REVIEW` to run outcomes and define precedence; `INSUFFICIENT_DATA` remains only for absent required data. Add run-state assertions.
- Acceptance: No-rule/complete-data returns run `REQUIRES_PROFESSIONAL_REVIEW`; missing-data returns `INSUFFICIENT_DATA`.
- Blocking: Yes, Stage 3.

### REV-P1-05 — Catalog review/source approval is not bound to exact immutable versions

- Severity: P1
- Design location: `P1_PRODUCT_REMEDIATION_DESIGN.md:455-499`.
- Related source: current `ProductSpecification`/`ProductPrice` have separate version rows but existing models lack source/review constraints (`prisma/schema.prisma:998-1039`).
- Problem: `CatalogReview.subjectType/subjectId/subjectVersion` is polymorphic; no exact FK to ProductRevision/Specification/Price is defined. `CatalogSource.contentDigest` is optional, and source content revision/immutability after review is not defined.
- Counterexample: Review row targets `product_specification` ID S, version 2, while the approved active row is S version 3; or review points to source X and source X content is changed later without a new review. `inputDigest` is mentioned but its canonical payload and source mutation prohibition are absent.
- Impact: A review can be accepted as evidence for the wrong version or altered source, allowing untrusted data into formal recommendations.
- Why design is insufficient: Generic `subjectType/subjectId` cannot be protected by a normal foreign key and no source version table is specified.
- Required correction: Use typed `productRevisionId`, `specificationId`, `priceId` foreign keys with CHECK exactly-one; create immutable `CatalogSourceVersion` with required digest; bind review to source version IDs and a canonical full input digest.
- Acceptance: Wrong-version/tampered-source review insert is rejected; revoking a source excludes all formal candidates based on it; tests DB-25–DB-28 cover both.
- Blocking: Yes, Stage 2.

### REV-P1-06 — Sales handoff snapshot is not normalized or self-contained

- Severity: P1
- Design location: `P1_PRODUCT_REMEDIATION_DESIGN.md:800-831,854-890`.
- Problem: Snapshot stores `productSpecificationIds[]`/`priceIds[]` arrays and two digests, but no normalized snapshot-item relation, canonical payload definition or immutable copy of source/review state. Arrays cannot bear FKs to exact product/spec/price rows.
- Counterexample: Handoff snapshot records spec IDs A/B and digests. Later spec A is withdrawn, price B is expired, or the catalog review row changes. The snapshot still has IDs/digests but cannot prove the content, status or source/review evidence at handoff time.
- Impact: The sales view cannot reliably explain what was handed off; historical evidence can become opaque.
- Why design is insufficient: Database-valid exact membership is absent, and “immutable snapshot” is asserted without a snapshot payload/transaction-time evidence contract.
- Required correction: Add `SalesHandoffSnapshotItem` rows with exact FK IDs and a stored immutable canonical snapshot JSON/status/source/review payload; define canonical serialization, digest algorithm and append-only protection. Also bind `assignedToId` to User.
- Acceptance: `SH-11` after source/spec/price withdrawal must reconstruct the original handoff and show original statuses with a current-difference marker; direct SQL cannot alter snapshot items.
- Blocking: Yes, Stage 4.

### REV-P1-07 — Candidate status does not distinguish technical eligibility from price/commercial readiness

- Severity: P1
- Design location: `P1_PRODUCT_REMEDIATION_DESIGN.md:529-543,721-766`; test plan `SL-07` at line 149.
- Problem: Candidate prose introduces `priceStatus=REQUIRES_QUOTE`, but the candidate result contract contains no `priceStatus` field and `OPERATIONAL` can remain the candidate status when the selected price is invalid.
- Counterexample: A product has complete technical data and an expired price. Candidate is `OPERATIONAL`, `priceStatus=REQUIRES_QUOTE` (undefined field), and the run can be `COMPLETED_WITH_OPERATIONAL_MATCH`; a consumer may present it as an operational recommendation.
- Impact: Customers may see an operational recommendation without a valid price basis.
- Why design is insufficient: A single status conflates technical and commercial readiness; the test checks no budget pass but not the top-level candidate/run status.
- Required correction: Add explicit `technicalEligibilityStatus` and `commercialPriceStatus`, or make overall recommendation status `REQUIRES_QUOTE` when commercial evidence is invalid. Define which status controls UI and sales.
- Acceptance: Expired/unapproved price never yields an unqualified `OPERATIONAL` recommendation; response exposes both technical and price states and tests assert both.
- Blocking: Yes, Stage 3/4 UI/API contract.

## P2

### REV-P2-01 — ProjectRequirementHead references a non-declared unique key

- Severity: P2
- Design location: `P1_PRODUCT_REMEDIATION_DESIGN.md:396-405,860-864`.
- Problem: Proposed FK `(projectId,requirementId) -> Requirement(projectId,id)` requires unique `(projectId,id)`, but the design only lists unique `(id,projectId,conversationId)`. PostgreSQL requires the exact referenced key.
- Impact: migration may be unimplementable as written or need an unplanned constraint.
- Correction: Declare `UNIQUE(projectId,id)` on Requirement and verify FK order.
- Acceptance: Migration DDL succeeds and composite FK validates.
- Blocking: No if corrected before Stage 1 migration.

### REV-P2-02 — Same-origin migration lacks a complete route inventory

- Severity: P2
- Design location: `P1_PRODUCT_REMEDIATION_DESIGN.md:912-938`; test plan `CS-01`–`CS-07`.
- Problem: The wrapper is described, but the plan only names representative endpoints. It does not require an audited inventory of every mutation or content-type enforcement.
- Impact: A future route can be added or left migrated without `assertSameOrigin`.
- Correction: Add an executable route-map test that enumerates POST/PATCH/PUT/DELETE and fails any handler not using the wrapper, plus content-type policy.
- Acceptance: A deliberately unguarded test route fails the inventory.
- Blocking: No, but required before Stage 4 completion.

### REV-P2-03 — SalesHandoffCase.assignedToId remains unbound

- Severity: P2
- Design location: `P1_PRODUCT_REMEDIATION_DESIGN.md:805-831`; current schema `prisma/schema.prisma:1081-1097`.
- Problem: `assignedToId?` has no User foreign key or role/assignment invariant, and no test covers invalid assignment.
- Impact: orphaned or cross-scope sales ownership.
- Correction: Add FK to User and project scope validation; test invalid assignee and reassignment.
- Acceptance: invalid user/scope assignment fails.

### REV-P2-04 — Requirement revision history remains untraced and unplanned

- Severity: P2
- Design location: traceability has no requirement-history row; design 7.4 only states immutability.
- Related source: current UI reads `getLatestRequirement` (`apps/web/src/app/projects/[projectId]/page.tsx:45`).
- Problem: Original review identified that UI displays only latest version; new design adds history storage but no history query/UI/API or test.
- Impact: customer cannot audit prior corrections, weakening source traceability.
- Correction: Add read-only version history endpoint/UI and tests for edited/corrected versions.
- Acceptance: history shows all versions and sources, newest/latest clearly marked.

### REV-P2-05 — Effective-time boundaries and as-of semantics are undefined

- Severity: P2
- Design location: `P1_PRODUCT_REMEDIATION_DESIGN.md:529-543`.
- Problem: `effectiveFrom/effectiveTo` checks omit timezone, inclusive/exclusive boundaries, evaluation timestamp source and deterministic behavior under clock changes.
- Impact: two evaluations can choose different versions; overlapping boundary behavior is untestable.
- Correction: define UTC/database timestamp, `[from,to)`, evaluation `asOfId`, deterministic recheck and boundaries.
- Acceptance: tests at exact start/end and clock skew pass with identical result.

### REV-P2-06 — Idempotent message retry has no response correlation design

- Severity: P2
- Design location: `P1_PRODUCT_REMEDIATION_DESIGN.md:330-350`; test `TX-04`.
- Problem: `clientMessageId` unique on message prevents duplicate row, but does not identify the already-created requirement and assistant response when the first response is lost.
- Impact: retry may return an incomplete or wrong response, or attempt a second transaction.
- Correction: add an interaction/request record keyed by `(conversationId,clientMessageId)` storing user message ID, requirement ID/version and assistant message ID and committed result digest.
- Acceptance: response-loss retry returns exact prior result without side effects.

### REV-P2-07 — Initial conversation creation is not covered by atomicity test

- Severity: P2
- Design location: `P1_PRODUCT_REMEDIATION_DESIGN.md:330-350`.
- Problem: The atomic interaction design covers message-based updates, but the current service also creates conversation, initial requirement and greeting separately (`apps/web/src/modules/advisor/service.ts:25-54`). No designated transaction or failure test covers initial creation.
- Impact: new conversation can exist without initial requirement/greeting.
- Correction: define one creation transaction and a failure-injection test.
- Acceptance: failure at any insert leaves no partial conversation.

### REV-P2-08 — Historical recommendations after catalog withdrawal are not addressed

- Severity: P2
- Design location: `P1_PRODUCT_REMEDIATION_DESIGN.md:1090`.
- Problem: Immutable old selection runs remain, but no read-time revalidation/status overlay tells users that the product/source/spec has since expired or been withdrawn.
- Impact: old `OPERATIONAL` run can remain visible without a clear current-invalid marker.
- Correction: store basis IDs and calculate current `STALE/REQUIRES_REVIEW` overlay on read without mutating history.
- Acceptance: after source/spec withdrawal, old run is retained but never presented as currently operational.

### REV-P2-09 — Test plan omits required failure columns and several invariants

- Severity: P2
- Design location: `P1_PRODUCT_REMEDIATION_TEST_PLAN.md:97-218`.
- Problem: Several tables (`RA`, `SH`, `SQ`, `CS`, `AU`, `DB`, `E2E`, `BR`, `DE`, `TI`) list expected outcomes but no explicit failure condition. Also missing: JSON/field-row divergence, scenario composite mismatch, review exact version, post-withdrawal history, response-loss retry.
- Impact: tests cannot prove all safety properties described in design.
- Correction: add failure column and explicit cases for the listed invariants, with database final-state assertions.
- Acceptance: every design safety invariant maps to a test with an executable negative assertion.

### REV-P2-10 — Root test failure has no concrete remediation design

- Severity: P2
- Design location: `P1_PRODUCT_REMEDIATION_TEST_PLAN.md:319-327` and design Stage 5.
- Problem: The plan says fix workspace binary resolution but does not identify why `authority-core` cannot resolve Vitest or which package/install/workspace layout change is required.
- Impact: future Stage 5 may remain blocked by the same test-infrastructure failure.
- Correction: inspect manifest/lockfile relationship and design a reproducible install-safe fix; do not install during this design review.
- Acceptance: clean environment root test command resolves every test binary.

## P3

### REV-P3-01 — Design self-check overstates original-finding coverage

- Severity: P3
- Design location: `P1_PRODUCT_REMEDIATION_DESIGN.md:1225-1245`.
- Problem: The design states `All P1 review findings mapped: YES` while the trace/test plan omit requirement history and several exact conditions.
- Impact: reviewers may stop before checking mapping details.
- Correction: change summary to “mapped with identified corrections/open gaps” until all gaps close.
- Acceptance: summary matches traceability and independent review.

## Counts

```text
P0: 0
P1: 7
P2: 10
P3: 1
```

## Required Design Revisions

1. Add conditional/temporal/double-negation semantics and exact tests.
2. Add scenario fields to composite FK chain.
3. Resolve requirement field JSON versus field-row source of truth.
4. Add run-level professional-review state.
5. Replace polymorphic catalog reviews and optional digests with exact immutable version bindings.
6. Normalize and self-contain sales snapshots.
7. Separate technical eligibility and commercial/price readiness.
8. Fix P2 relationship, route inventory, history, clock, idempotency and test-plan gaps.

