# P1 Product Remediation Design R3

Task:

```text
FULL-MVP-REMEDIATION-DESIGN-R3
```

Date: 2026-11-23

Status:

```text
R3 DESIGN COMPLETE WITH OPEN BLOCKERS
```

R3 corrects only the design defects identified by the independent R2 review.
It does not modify R1/R2, authorize source or Schema work, establish that the
findings are fixed, execute a database operation, or enter Runtime.

## 1. Input Baseline

Verified PowerShell:

```text
ExecutablePath:
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe

PID: 34328
Parent PID: 27624
Parent executable: C:\Program Files\WindowsApps\OpenAI.Codex_26.1117.4957.0_x64__2p2nqsd0c76g0\app\resources\codex.exe
FileVersion: 7.6.9.500
PSEdition: Core
Internal PSVersion: 7.6.9
```

R2 inputs:

| File | Bytes | Lines | SHA-256 | Manifest |
|---|---:|---:|---|---|
| `P1_PRODUCT_REMEDIATION_DESIGN_R2.md` | 35476 | 1286 | `717CB6C238C147388B66D0877F8B9941F0AAE1C1023BFD01724DA48B71B5463B` | MATCH |
| `P1_PRODUCT_REMEDIATION_TRACEABILITY_R2.md` | 8208 | 98 | `A5E806FB4133E9082D348BAA356B567A42E825A844C1F5CDB2D40C392444ACF5` | MATCH |
| `P1_PRODUCT_REMEDIATION_TEST_PLAN_R2.md` | 33153 | 284 | `06BC471C2C80C7AB59F962976A38DCF5908D2D2B0D2240447C7532575A0BFE92` | MATCH |
| `P1_PRODUCT_REMEDIATION_OPEN_DECISIONS_R2.md` | 12933 | 437 | `AD0E8D038D6608877503AF79202D127406BD08739B3620EED4BAD223E2A90B79` | MATCH |
| `P1_PRODUCT_REMEDIATION_R2_CHANGELOG.md` | 5501 | 200 | `5BF8AB3FB5F7864E0855ED6C47D320247593884D83CA8A0B7BA30CF9035A3FFC` | MATCH |
| `SHA256SUMS_R2.txt` | 793 | 5 | `F031F01440572B16DFBC2770AA435EBBE5AC46CA1ED2EE1991D81AA671BF9B06` | MATCH |

Independent R2 review inputs:

| File | SHA-256 |
|---|---|
| `INDEPENDENT_DESIGN_REVIEW_R2_REPORT.md` | `849DC3154F44F357BF8982FD52A7481692D152183848D36F5D8A91648A2A7A20` |
| `INDEPENDENT_REVIEW_R2_FINDINGS.md` | `A860DCD6E9A54E50907E0ABF4B4A14E4EA8702CC58703AC34EBA29019019E43C` |
| `IMPLEMENTATION_AUTHORIZATION_MATRIX_R2.md` | `EBCD053D5F6CB153DE40F38A65F183F794668D19E366EBDF03277A1B105E057D` |
| `SHA256SUMS_R2_REVIEW.txt` | `BA9B433C4D14D9999D192B088C330996015069D7939C455FADD2B660D1BC3C80` |

Every entry in both R2 manifests was independently verified. R1, the first
independent review, MVP review/build evidence and the current implementation
remain input evidence; none was modified.

## 2. Current Implementation Gap

The current implementation is a DEMO/Mock foundation, not the R3 model:

- `BuildingRequirement.fields` is currently read by selection;
- conversation and requirement identity are not one exact source chain;
- catalog source references are mutable text fields without captured evidence;
- specification and price versions lack complete immutable review evidence;
- selection runs reference project and requirement independently;
- sales handoff points to no immutable requirement/selection snapshot;
- professional review is a boolean/status concept, not an event history.

Evidence:

- `apps/web/src/modules/selection/service.ts:17-54`;
- `apps/web/src/modules/advisor/service.ts:25-153`;
- `apps/web/src/modules/mvp/store.ts:808-1100`;
- `packages/selection-engine/src/index.ts:106-310`;
- `prisma/schema.prisma:868-1109`;
- `prisma/migrations/20261123130000_full_mvp_domain/migration.sql:41-334`.

R3 describes a future forward migration. It does not treat these tables as if
they already contain the proposed keys.

## 3. Design Principles

1. Every ownership relation used for authorization or historical evidence has
   all of its identity columns NOT NULL.
2. A real foreign key proves ownership; a digest does not substitute for a
   relation.
3. A mutable external locator is not a content identity.
4. Historical approval binds to exact immutable revisions and a durable basis.
5. Event history is append-only; current status is a transactionally maintained
   projection of events.
6. Snapshot normalized detail is the single authority. A canonical payload is
   reconstructed from it and is never a second writable truth.
7. Unexpected rollback, ambiguous commit and unavailable evidence fail closed.
8. Open product decisions may choose policy values, but cannot replace missing
   database consistency mechanics.
9. The catalog evidence archive is a separate capability. It must not change or
   reuse the P1-3 upload/lifecycle protocol.

## 4. Requirement Source Chain

### 4.1 Canonical chain

```text
Project
  -> AdvisorConversation
      -> Requirement
          -> RequirementVersion
              -> RequirementFieldAssertion
                  -> AdvisorMessage (when sourceType = CUSTOMER_MESSAGE)
              -> RequirementFieldValue
                  -> RequirementFieldAssertion
```

`Requirement` is the stable logical requirement identity.
`RequirementVersion` is immutable. A correction creates a new version and new
assertions; it never updates old source messages or prior assertions.

### 4.2 Required keys

```text
Project
  PRIMARY KEY(id)
  installationScenario NOT NULL
  UNIQUE(id, installationScenario)

AdvisorConversation
  PRIMARY KEY(id)
  projectId NOT NULL
  installationScenario NOT NULL
  UNIQUE(projectId, id)
  UNIQUE(id, projectId, installationScenario)
  FK(projectId, installationScenario)
    -> Project(id, installationScenario)

AdvisorMessage
  PRIMARY KEY(id)
  conversationId NOT NULL
  UNIQUE(id, conversationId)
  FK(conversationId) -> AdvisorConversation(id)

Requirement
  PRIMARY KEY(id)
  projectId NOT NULL
  conversationId NOT NULL
  installationScenario NOT NULL
  UNIQUE(id, projectId, conversationId, installationScenario)
  FK(projectId, conversationId, installationScenario)
    -> AdvisorConversation(id, projectId, installationScenario)

RequirementVersion
  PRIMARY KEY(id)
  requirementId NOT NULL
  projectId NOT NULL
  conversationId NOT NULL
  installationScenario NOT NULL
  versionNumber NOT NULL
  fieldStateDigest NOT NULL
  UNIQUE(requirementId, versionNumber)
  UNIQUE(id, projectId, conversationId)
  UNIQUE(id, projectId, conversationId, installationScenario)
  UNIQUE(id, requirementId, projectId, conversationId, installationScenario)
  FK(requirementId, projectId, conversationId, installationScenario)
    -> Requirement(id, projectId, conversationId, installationScenario)

RequirementFieldAssertion
  PRIMARY KEY(id)
  requirementVersionId NOT NULL
  requirementId NOT NULL
  projectId NOT NULL
  conversationId NOT NULL
  sourceType NOT NULL
  sourceMessageId NULL
  createdByUserId NOT NULL
  UNIQUE(id, requirementId)
  UNIQUE(
    id, requirementVersionId, requirementId, projectId, conversationId
  )
  FK(
    requirementVersionId, requirementId, projectId, conversationId
  ) -> RequirementVersion(
    id, requirementId, projectId, conversationId
  )
  FK(sourceMessageId, conversationId)
    -> AdvisorMessage(id, conversationId)
  CHECK (
    (sourceType = 'CUSTOMER_MESSAGE'
      AND sourceMessageId IS NOT NULL)
    OR
    (sourceType <> 'CUSTOMER_MESSAGE'
      AND sourceMessageId IS NULL)
  )

RequirementFieldValue
  PRIMARY KEY(id)
  requirementVersionId NOT NULL
  requirementId NOT NULL
  projectId NOT NULL
  conversationId NOT NULL
  fieldKey NOT NULL
  sourceAssertionId NOT NULL
  UNIQUE(requirementVersionId, fieldKey)
  UNIQUE(
    id, requirementVersionId, requirementId, projectId, conversationId
  )
  FK(
    requirementVersionId, requirementId, projectId, conversationId
  ) -> RequirementVersion(
    id, requirementId, projectId, conversationId
  )
  FK(
    sourceAssertionId,
    requirementVersionId,
    requirementId,
    projectId,
    conversationId
  ) -> RequirementFieldAssertion(
    id,
    requirementVersionId,
    requirementId,
    projectId,
    conversationId
  )
```

`AdvisorConversation.currentRequirementVersionId` and
`ProjectRequirementHead.requirementVersionId` use composite FKs containing
project, conversation and scenario. When the pointer is NULL, the command path
is explicitly "no current version"; otherwise every component is non-null.

```text
ProjectRequirementHead
  projectId PRIMARY KEY
  requirementVersionId NOT NULL
  requirementId NOT NULL
  conversationId NOT NULL
  installationScenario NOT NULL
  selectedByUserId NOT NULL
  selectedAt NOT NULL
  FK(
    requirementVersionId, requirementId, projectId, conversationId,
    installationScenario
  ) -> RequirementVersion(
    id, requirementId, projectId, conversationId, installationScenario
  )
  FK(selectedByUserId) -> User(id)
```

### 4.3 Assertion evidence classes

The initial implementation supports:

- `CUSTOMER_MESSAGE`: exact `AdvisorMessage` source;
- `USER_EDIT`: actor and idempotent edit request;
- `SYSTEM_DERIVED`: deterministic rule identity plus source assertion IDs;
- `PROFESSIONAL_CONFIRMATION`: exact professional review event.

Other evidence types require a typed extension table. They must not use a
polymorphic free-text ID. A future file-derived source is an opaque read-only
evidence reference approved by a separate file-evidence interface; it does not
modify P1-3.

### 4.4 Corrections and confirmations

`RequirementConfirmationEvent` is append-only and binds the exact version,
requirement, project, conversation, actor and idempotency request. A correction:

1. creates a new RequirementVersion;
2. inserts new assertions, with optional `supersedesAssertionId` constrained to
   the same stable Requirement;
3. marks old versions historical, never deletes them;
4. updates the conversation/project pointer under a row lock and CAS;
5. records the customer confirmation and audit event in the same transaction.

An unresolved condition, conflict, invalidated assertion or missing source
cannot produce a resolved formal field value.

The minimum confirmation record is:

```text
id
requirementVersionId
requirementId
projectId
conversationId
action CONFIRM | REJECT | CORRECT
actorUserId NOT NULL
requestId NOT NULL
previousStatus
newStatus
occurredAt
UNIQUE(requirementVersionId, requestId)
FK(requirementVersionId, requirementId, projectId, conversationId)
  -> RequirementVersion(id, requirementId, projectId, conversationId)
```

A confirmation may reference only assertions that have the same
`(requirementVersionId, requirementId, projectId, conversationId)` tuple. The
API cannot accept an actor, assertion, message or version from the client as
trusted evidence.

## 5. Catalog Source Evidence

### 5.1 Options

| Option | Benefit | Risk | Decision |
|---|---|---|---|
| Store raw content in PostgreSQL | Transactional and simple for small material | Database bloat; binary PDF/media limits; still needs hash verification | Only acceptable for bounded small sources if separately approved |
| Immutable content archive | Handles text/binary, content-addressed identity, independent verification | Adds a new capability and storage lifecycle | Selected design |
| Locator plus digest only | Small schema | Cannot prove or recover reviewed content | Rejected |

### 5.2 Separate archive capability

R3 introduces `CatalogEvidenceArchive`, independent from P1-3:

```text
putIfAbsent(bytes, mediaType) -> immutable object
readExact(archiveObjectId, expectedDigest, expectedLength) -> bytes
stat(archiveObjectId) -> identity, length, digest metadata
```

Rules:

- object identity is content-addressed or otherwise write-once immutable;
- writing the same identity twice with different bytes is rejected;
- objects cannot be overwritten under the same identity;
- archive access identity is separate from Web/Worker file lifecycle roles;
- raw source bytes are not written into the P1-3 `storage/private` namespace;
- no Upload Intent/Attempt/Lifecycle/FileVersion object is created or changed;
- archive unavailable means catalog evidence is unavailable, not trusted.

Normative identity is the tuple `(archiveAdapterId, rawContentDigest,
byteLength)`. The adapter may map it to an opaque immutable object ID, but that
mapping must be one-to-one and immutable. If the adapter cannot prove that
constraint, it is not eligible for formal catalog evidence.

The final archive product, retention and encryption policy remain
`OD-R3-01`/`OD-R3-02`; formal review is blocked until that decision is made.

### 5.3 Evidence tables

```text
CatalogEvidenceObject
  PRIMARY KEY(id)
  archiveAdapterId NOT NULL
  archiveObjectId NOT NULL
  mediaType NOT NULL
  byteLength NOT NULL
  rawContentDigest NOT NULL
  canonicalTextDigest NULL
  capturedAt NOT NULL
  UNIQUE(archiveAdapterId, archiveObjectId)
  UNIQUE(id, rawContentDigest)
  UNIQUE(id, rawContentDigest, byteLength)

CatalogSourceRevision
  PRIMARY KEY(id)
  sourceId NOT NULL
  revisionNumber NOT NULL
  locator NOT NULL
  evidenceObjectId NOT NULL
  rawContentDigest NOT NULL
  byteLength NOT NULL
  contentEncoding NULL
  parserVersion NOT NULL
  capturedAt NOT NULL
  validFrom NOT NULL
  validTo NULL
  UNIQUE(sourceId, revisionNumber)
  UNIQUE(id, rawContentDigest)
  UNIQUE(id, rawContentDigest, evidenceObjectId)
  UNIQUE(id, rawContentDigest, byteLength, evidenceObjectId)
  FK(evidenceObjectId, rawContentDigest, byteLength)
    -> CatalogEvidenceObject(id, rawContentDigest, byteLength)

CatalogEvidenceVerification
  PRIMARY KEY(id)
  evidenceObjectId NOT NULL
  expectedDigest NOT NULL
  observedDigest NULL
  outcome MATCH | MISMATCH | MISSING | INACCESSIBLE
  verifierIdentity NOT NULL
  verifierVersion NOT NULL
  verifiedAt NOT NULL
  UNIQUE(id, evidenceObjectId, expectedDigest, observedDigest, outcome)
  FK(evidenceObjectId, expectedDigest)
    -> CatalogEvidenceObject(id, rawContentDigest)
  CHECK (
    (outcome = 'MATCH' AND observedDigest = expectedDigest)
    OR
    (outcome <> 'MATCH')
  )

CatalogSourceWithdrawal
  id
  sourceRevisionId
  actorUserId
  reason
  occurredAt
  replacementSourceRevisionId NULL
  UNIQUE(sourceRevisionId)
  FK(sourceRevisionId) -> CatalogSourceRevision(id)
  FK(replacementSourceRevisionId) -> CatalogSourceRevision(id)
  FK(actorUserId) -> User(id)
```

`verifierIdentity` identifies the bounded verifier service/role. Ordinary
product-admin, customer and sales roles cannot insert verification rows.

### 5.4 Review evidence binding

```text
CatalogReview
  id
  reviewType
  manufacturerRevisionId NULL
  brandRevisionId NULL
  productRevisionId NULL
  specificationRevisionId NULL
  priceRevisionId NULL
  sourceRevisionId NULL
  decision APPROVE | REJECT | REVOKE
  reviewerUserId
  reviewerAuthorityId
  reviewedAt
  inputDigest
  policyRevisionId
  CHECK exactly one target FK is non-null
  CHECK reviewType matches target FK
  FK(reviewerUserId) -> User(id)
  FK(policyRevisionId) -> CatalogReviewPolicyRevision(id)

CatalogReviewPolicyRevision
  id
  policyKey
  revisionNumber
  contentJson
  contentDigest
  approvedAt
  approvedByUserId
  effectiveFrom
  effectiveTo NULL
  UNIQUE(policyKey, revisionNumber)
  UNIQUE(id, contentDigest)
  FK(approvedByUserId) -> User(id)

CatalogReviewSourceEvidence
  reviewId
  sourceRevisionId
  evidenceVerificationId
  UNIQUE(reviewId, sourceRevisionId)
  FK(reviewId, sourceRevisionId)
  FK(evidenceVerificationId)
```

A deferred constraint trigger verifies that:

- the SourceRevision evidence object is the verification evidence object;
- verification outcome is `MATCH`;
- the expected digest equals the SourceRevision raw digest;
- no later `MISMATCH`, `MISSING` or `INACCESSIBLE` event supersedes the
  selected verification.

`CatalogReview.inputDigest` is computed from the exact target revision digest,
the sorted evidence SourceRevision IDs and raw/canonical digests, the selected
verification IDs, `reviewType`, `CatalogReviewPolicyRevision.id` and its
content digest, and the review-basis schema version. A caller cannot supply a
digest without the matching rows, and an old review retains its policy identity
after a newer policy becomes effective.

Catalog decisions are inserted only through a review-decision function under a
reviewer role. The function locks the target revision and evidence rows,
recomputes the digest, verifies the policy revision and inserts the
append-only decision. Ordinary product-admin and customer roles cannot insert
or update a decision or evidence-binding row directly.

Changing the locator target, replacing a PDF, redirecting the URL or changing
text creates a new CatalogEvidenceObject and CatalogSourceRevision. The old
review remains bound only to the old revisions.

### 5.5 Verification and failure behavior

- Archive write succeeds and DB transaction fails: the object is an untracked
  archive object and cannot become review evidence without a later DB insert.
- Archive write fails: no SourceRevision is created.
- Archive read fails or identity/length/digest differs: append a negative
  verification event; formal review cannot be approved.
- External locator returns new content: capture a new object/revision; never
  update the old evidence object.
- Source withdrawal is an append-only `CatalogSourceWithdrawal` event. It does
  not delete the archive object or historical review.
- Digest present but content absent is an explicit `MISSING` failure, never an
  implicit valid review.

## 6. Selection Rule Set Identity

Catalog revision keys required by the later links are:

```text
ProductRevision         UNIQUE(id, productId)
SpecificationRevision   UNIQUE(id, productRevisionId)
PriceRevision           UNIQUE(id, productRevisionId)
CatalogParameterRevision UNIQUE(id, specificationRevisionId, parameterKey)
```

`CatalogParameterRevision` is immutable and contains the normalized parameter
key, typed value, unit, source revision ID and catalog review evidence ID:

```text
CatalogParameterRevision
  id
  specificationRevisionId
  parameterKey
  valueType
  valueText
  unit
  sourceRevisionId
  catalogReviewId
  UNIQUE(specificationRevisionId, parameterKey)
  UNIQUE(id, sourceRevisionId)
  UNIQUE(id, specificationRevisionId, parameterKey)
  FK(specificationRevisionId) -> SpecificationRevision(id)
  FK(sourceRevisionId) -> CatalogSourceRevision(id)
  FK(catalogReviewId) -> CatalogReview(id)
```

```text
SelectionRuleSet
  id
  stableKey
  scenario

SelectionRuleSetRevision
  id
  ruleSetId
  revisionNumber
  installationScenario
  status
  statusVersion NOT NULL
  contentDigest
  authoritySourceRevisionId
  effectiveFrom
  effectiveTo
  approvedAt NULL
  approvedByUserId NULL
  UNIQUE(ruleSetId, revisionNumber)
  UNIQUE(id, installationScenario)
  UNIQUE(id, contentDigest)
  FK(authoritySourceRevisionId) -> CatalogSourceRevision(id)
  FK(approvedByUserId) -> User(id)
  CHECK (
    status <> 'APPROVED'
    OR (approvedAt IS NOT NULL AND approvedByUserId IS NOT NULL)
  )

SelectionRuleRevision
  id
  ruleSetRevisionId
  ruleKey
  operator
  valueJson
  unit
  sourceRevisionId
  UNIQUE(ruleSetRevisionId, ruleKey)
  FK(ruleSetRevisionId) -> SelectionRuleSetRevision(id)

SelectionRuleSetReviewEvent
  id
  ruleSetRevisionId
  eventSequence
  previousStatus
  newStatus
  actorUserId
  actorAuthorityId
  reason
  basisDigest
  occurredAt
  requestId
  UNIQUE(ruleSetRevisionId, eventSequence)
  UNIQUE(ruleSetRevisionId, requestId)
  FK(ruleSetRevisionId) -> SelectionRuleSetRevision(id)
```

Only an `APPROVED` immutable rule-set revision within its effective interval
may be used for formal `OPERATIONAL` evaluation. Rule-set review uses the typed,
append-only events above; creator/approver separation remains `OD-R3-07`.

A rule-set revision is invalidated by an authority-source withdrawal,
unverifiable evidence, a changed rule content digest, or a policy transition
that does not explicitly preserve its review. The formal resolver rechecks the
exact source verification and review event before use.

## 7. Selection Run and Candidate Results

```text
SelectionRun
  PRIMARY KEY(id)
  projectId NOT NULL
  conversationId NOT NULL
  requirementId NOT NULL
  requirementVersionId NOT NULL
  installationScenario NOT NULL
  ruleSetRevisionId NOT NULL
  asOf NOT NULL
  inputDigest NOT NULL
  outputDigest NOT NULL
  status NOT NULL
  UNIQUE(
    id, projectId, conversationId, requirementId,
    requirementVersionId, installationScenario, ruleSetRevisionId
  )
  FK(
    requirementVersionId, requirementId, projectId,
    conversationId, installationScenario
  ) -> RequirementVersion(
    id, requirementId, projectId, conversationId, installationScenario
  )
  FK(ruleSetRevisionId, installationScenario)
    -> SelectionRuleSetRevision(id, installationScenario)

SelectionCandidateResult
  PRIMARY KEY(id)
  selectionRunId NOT NULL
  projectId NOT NULL
  conversationId NOT NULL
  requirementId NOT NULL
  requirementVersionId NOT NULL
  installationScenario NOT NULL
  ruleSetRevisionId NOT NULL
  productRevisionId NOT NULL
  specificationRevisionId NOT NULL
  priceRevisionId NULL
  technicalStatus NOT NULL
  commercialStatus NOT NULL
  trustStatus NOT NULL
  professionalReviewStatus NOT NULL
  overallStatus NOT NULL
  candidateBasisDigest NOT NULL
  UNIQUE(
    id, selectionRunId, projectId, conversationId, requirementId,
    requirementVersionId, installationScenario, ruleSetRevisionId
  )
  FK(
    selectionRunId, projectId, conversationId, requirementId,
    requirementVersionId, installationScenario, ruleSetRevisionId
  ) -> SelectionRun(
    id, projectId, conversationId, requirementId,
    requirementVersionId, installationScenario, ruleSetRevisionId
  )
  FK(specificationRevisionId, productRevisionId)
    -> SpecificationRevision(id, productRevisionId)
  FK(priceRevisionId, productRevisionId)
    -> PriceRevision(id, productRevisionId)

SelectionCandidateSourceRevision
  candidateId
  sourceRevisionId
  sourceRole
  rawContentDigest
  evidenceVerificationId
  UNIQUE(candidateId, sourceRevisionId)
  FK(candidateId) -> SelectionCandidateResult(id)
  FK(sourceRevisionId, rawContentDigest)
    -> CatalogSourceRevision(id, rawContentDigest)
  FK(evidenceVerificationId) -> CatalogEvidenceVerification(id)
```

The run stores the exact rule-set revision and requirement version. Every
candidate stores exact product/specification/price revisions and the complete
status tuple. The rule-set ID is not inferred from a display version string.

## 8. Professional Review State Machine

### 8.1 Policy revision

```text
ProfessionalReviewPolicyRevision
  id
  policyKey
  revisionNumber
  contentJson
  contentDigest
  effectiveFrom
  effectiveTo NULL
  approvedAt
  approvedByUserId
  UNIQUE(policyKey, revisionNumber)
  UNIQUE(id, contentDigest)
```

The row is immutable after approval. A new policy is a new revision. A review
always binds a policy revision ID and reflects it in every event. The decision
on whether an old approval survives a policy transition remains
`OD-R3-04`; the safe default is that a formal resolver requires the review's
policy revision to be the currently selected approved policy revision.

### 8.2 Review header and exact basis

```text
ProfessionalReview
  PRIMARY KEY(id)
  candidateId NOT NULL
  selectionRunId NOT NULL
  projectId NOT NULL
  conversationId NOT NULL
  requirementId NOT NULL
  requirementVersionId NOT NULL
  installationScenario NOT NULL
  ruleSetRevisionId NOT NULL
  policyRevisionId NOT NULL
  attemptNumber NOT NULL
  state NOT NULL
  stateVersion NOT NULL
  basisDigest NOT NULL
  createdByUserId NOT NULL
  createdAt NOT NULL
  UNIQUE(candidateId, policyRevisionId, attemptNumber)
  UNIQUE(id, basisDigest, policyRevisionId)
  UNIQUE(id, state, stateVersion, basisDigest)
  FK(
    candidateId, selectionRunId, projectId, conversationId,
    requirementId, requirementVersionId, installationScenario,
    ruleSetRevisionId
  ) -> SelectionCandidateResult(
    id, selectionRunId, projectId, conversationId,
    requirementId, requirementVersionId, installationScenario,
    ruleSetRevisionId
  )
  FK(policyRevisionId) -> ProfessionalReviewPolicyRevision(id)

Partial unique index:

  UNIQUE(candidateId, policyRevisionId)
  WHERE state IN ('CREATED', 'SUBMITTED', 'IN_REVIEW', 'APPROVED')

ProfessionalReviewSourceBasis
  reviewId
  sourceRevisionId
  sourceRawDigest
  evidenceVerificationId
  UNIQUE(reviewId, sourceRevisionId)
  FK(reviewId) -> ProfessionalReview(id)
  FK(sourceRevisionId, sourceRawDigest)
    -> CatalogSourceRevision(id, rawContentDigest)
  FK(evidenceVerificationId) -> CatalogEvidenceVerification(id)

ProfessionalReviewPriceBasis
  reviewId
  priceRevisionId
  UNIQUE(reviewId)
  FK(reviewId) -> ProfessionalReview(id)
  FK(priceRevisionId) -> PriceRevision(id)
```

A deferred trigger checks that all source-basis rows exactly equal the
candidate's `SelectionCandidateSourceRevision` set, that every verification is
`MATCH`, and that the policy/revision selection is exact. A review cannot
silently inherit another candidate's source or price basis.

### 8.3 Events

```text
ProfessionalReviewEvent
  id
  reviewId
  eventSequence
  previousState
  newState
  resultingStateVersion
  actorUserId
  actorAuthorityId
  decision
  reason
  occurredAt
  basisDigest
  policyRevisionId
  requestId
  UNIQUE(reviewId, eventSequence)
  UNIQUE(reviewId, resultingStateVersion)
  UNIQUE(reviewId, requestId)
  UNIQUE(id, reviewId, basisDigest, policyRevisionId)
  FK(reviewId, basisDigest, policyRevisionId)
    -> ProfessionalReview(id, basisDigest, policyRevisionId)
  FK(actorUserId) -> User(id)
  CHECK (
    newState NOT IN ('APPROVED', 'REJECTED', 'RETURNED_FOR_INFORMATION')
    OR decision IS NOT NULL
  )
```

The event table is append-only. A transition function locks the review row,
checks `expectedStateVersion`, verifies the exact current basis, inserts one
event and updates the current-state projection in the same transaction. Normal
roles cannot directly INSERT/UPDATE/DELETE events or update the review state.

### 8.4 Transitions

| From | To | Actor | Preconditions | CAS / result |
|---|---|---|---|---|
| none | `CREATED` | authorized requester | exact candidate basis exists | insert event sequence 1 |
| `CREATED` | `SUBMITTED` | submitter | complete basis and policy revision | expected version; submit event |
| `SUBMITTED` | `IN_REVIEW` | authorized reviewer | reviewer is not submitter if policy requires | one winner by `stateVersion` |
| `IN_REVIEW` | `APPROVED` | authorized reviewer | every exact basis and policy check passes | approval event |
| `IN_REVIEW` | `REJECTED` | authorized reviewer | decision and reason present | rejection event |
| `IN_REVIEW` | `RETURNED_FOR_INFORMATION` | authorized reviewer | missing/invalid basis documented | return event |
| `CREATED`/`SUBMITTED`/`IN_REVIEW` | `WITHDRAWN` | submitter or authorized admin | no terminal approval exists | withdrawal event |
| any nonterminal or `APPROVED` | `INVALIDATED` | basis guardian/system | basis changed, source withdrawn or policy no longer applicable | invalidation event |
| `APPROVED` | `EXPIRED` | policy evaluator | policy expiry or evidence expiry | expiry event |

`REJECTED`, `RETURNED_FOR_INFORMATION`, `WITHDRAWN`, `INVALIDATED` and
`EXPIRED` are terminal for that review instance. A new submission creates a new
review instance; a terminal instance cannot be revived.

Two reviewers claiming or deciding concurrently use `SELECT ... FOR UPDATE` on
the review plus `stateVersion` CAS. The loser receives a conflict and cannot
append an event. A source/spec/rule change and approval race must either
serialize through the same review-basis function or cause approval to fail the
deferred exact-basis check.

### 8.5 Formal eligibility

The formal result function requires:

- a review instance in `APPROVED`;
- exact matching candidate/run/requirement/rule/policy revision IDs;
- matching `basisDigest`;
- all required source verifications `MATCH`;
- no later withdrawal, mismatch, missing/inaccessible evidence or policy
  incompatibility;
- current professional-review policy and rule authority are approved.

If any check fails, the resolver returns `REQUIRES_PROFESSIONAL_REVIEW` or
`INSUFFICIENT_DATA`; it never returns `OPERATIONAL`.

## 9. Sales Handoff Ownership Chain

### 9.1 Case and snapshot keys

```text
SalesHandoffCase
  PRIMARY KEY(id)
  projectId NOT NULL
  currentSnapshotId NULL
  status NOT NULL
  assignedToId NULL
  UNIQUE(projectId)
  UNIQUE(id, projectId)
  FK(projectId) -> Project(id)
  FK(assignedToId) -> User(id)
  FK(currentSnapshotId, id, projectId)
    -> SalesHandoffSnapshot(id, caseId, projectId)

SalesAssignmentEvent
  id
  caseId
  previousAssigneeId NULL
  newAssigneeId
  actorUserId
  reason
  occurredAt
  requestId
  UNIQUE(caseId, requestId)
  FK(caseId) -> SalesHandoffCase(id)
  FK(previousAssigneeId) -> User(id)
  FK(newAssigneeId) -> User(id)
  FK(actorUserId) -> User(id)

SalesHandoffSnapshot
  PRIMARY KEY(id)
  caseId NOT NULL
  projectId NOT NULL
  conversationId NOT NULL
  requirementId NOT NULL
  requirementVersionId NOT NULL
  selectionRunId NOT NULL
  installationScenario NOT NULL
  ruleSetRevisionId NOT NULL
  versionNumber NOT NULL
  schemaVersion NOT NULL
  basisDigest NOT NULL
  createdByUserId NOT NULL
  createdAt NOT NULL
  UNIQUE(id, caseId, projectId)
  UNIQUE(caseId, versionNumber)
  UNIQUE(
    id, projectId, conversationId, requirementId, requirementVersionId
  )
  UNIQUE(
    id, projectId, conversationId, requirementId,
    requirementVersionId, installationScenario,
    selectionRunId, ruleSetRevisionId
  )
  UNIQUE(
    id, caseId, projectId, conversationId, requirementId,
    requirementVersionId, installationScenario,
    selectionRunId, ruleSetRevisionId
  )
  FK(caseId, projectId)
    -> SalesHandoffCase(id, projectId)
  FK(
    requirementVersionId, requirementId, projectId,
    conversationId, installationScenario
  ) -> RequirementVersion(
    id, requirementId, projectId, conversationId, installationScenario
  )
  FK(
    selectionRunId, projectId, conversationId, requirementId,
    requirementVersionId, installationScenario, ruleSetRevisionId
  ) -> SelectionRun(
    id, projectId, conversationId, requirementId,
    requirementVersionId, installationScenario, ruleSetRevisionId
  )
```

The `currentSnapshotId` FK uses a DEFERRABLE transaction so the first case and
snapshot can be inserted, then the pointer set before COMMIT. The snapshot
cannot point to a case in another project, and its selection run must be built
from the exact same requirement version.

### 9.2 Authoritative normalized snapshot

R3 selects **Option A: normalized snapshot detail is the only authority**.
There is no independently writable `canonicalPayload` column or table.

Authoritative rows:

```text
SalesSnapshotRequirementField
  snapshotId
  projectId
  conversationId
  requirementId
  requirementVersionId
  fieldKey
  sourceFieldValueId
  valueJson
  valueType
  unit
  fieldStatus
  sourceAssertionId
  copiedAt
  UNIQUE(snapshotId, fieldKey)
  FK(
    snapshotId, projectId, conversationId, requirementId,
    requirementVersionId
  ) -> SalesHandoffSnapshot(
    id, projectId, conversationId, requirementId,
    requirementVersionId
  )
  FK(
    sourceFieldValueId, requirementVersionId, requirementId,
    projectId, conversationId
  ) -> RequirementFieldValue(
    id, requirementVersionId, requirementId, projectId, conversationId
  )
  FK(
    sourceAssertionId, requirementVersionId, requirementId,
    projectId, conversationId
  ) -> RequirementFieldAssertion(
    id, requirementVersionId, requirementId, projectId, conversationId
  )

SalesSnapshotCandidate
  id
  snapshotId
  candidateId
  selectionRunId
  projectId
  conversationId
  requirementId
  requirementVersionId
  installationScenario
  ruleSetRevisionId
  productRevisionId
  specificationRevisionId
  priceRevisionId?
  technicalStatus
  commercialStatus
  trustStatus
  professionalReviewStatus
  overallStatus
  UNIQUE(id, snapshotId)
  UNIQUE(snapshotId, candidateId)
  FK(
    snapshotId, projectId, conversationId, requirementId,
    requirementVersionId, installationScenario, selectionRunId,
    ruleSetRevisionId
  ) -> SalesHandoffSnapshot(
    id, projectId, conversationId, requirementId,
    requirementVersionId, installationScenario, selectionRunId,
    ruleSetRevisionId
  )
  FK(
    candidateId, selectionRunId, projectId, conversationId,
    requirementId, requirementVersionId, installationScenario,
    ruleSetRevisionId
  ) -> SelectionCandidateResult(
    id, selectionRunId, projectId, conversationId,
    requirementId, requirementVersionId, installationScenario,
    ruleSetRevisionId
  )
  FK(specificationRevisionId, productRevisionId)
    -> SpecificationRevision(id, productRevisionId)
  FK(priceRevisionId, productRevisionId)
    -> PriceRevision(id, productRevisionId)

SalesSnapshotParameter
  snapshotItemId
  catalogParameterRevisionId
  parameterKey
  valueText
  valueType
  unit
  sourceRevisionId
  UNIQUE(snapshotItemId, parameterKey)
  FK(snapshotItemId) -> SalesSnapshotCandidate(id)
  FK(catalogParameterRevisionId) -> CatalogParameterRevision(id)
  FK(catalogParameterRevisionId, sourceRevisionId)
    -> CatalogParameterRevision(id, sourceRevisionId)

SalesSnapshotPrice
  snapshotItemId
  priceRevisionId
  amountMinor
  currency
  taxBasis
  applicability
  UNIQUE(snapshotItemId)
  FK(snapshotItemId) -> SalesSnapshotCandidate(id)
  FK(priceRevisionId) -> PriceRevision(id)

SalesSnapshotSource
  snapshotItemId
  sourceRevisionId
  evidenceObjectId
  rawContentDigest
  UNIQUE(snapshotItemId, sourceRevisionId)
  FK(snapshotItemId) -> SalesSnapshotCandidate(id)
  FK(sourceRevisionId, rawContentDigest, evidenceObjectId)
    -> CatalogSourceRevision(id, rawContentDigest, evidenceObjectId)

SalesSnapshotCatalogReview
  snapshotItemId
  catalogReviewId
  decision
  reviewedAt
  UNIQUE(snapshotItemId, catalogReviewId)
  FK(snapshotItemId) -> SalesSnapshotCandidate(id)
  FK(catalogReviewId) -> CatalogReview(id)

SalesSnapshotProfessionalReview
  snapshotItemId
  professionalReviewId
  professionalReviewEventId
  policyRevisionId
  decision
  basisDigest
  UNIQUE(snapshotItemId, professionalReviewId)
  FK(snapshotItemId) -> SalesSnapshotCandidate(id)
  FK(professionalReviewId, basisDigest, policyRevisionId)
    -> ProfessionalReview(id, basisDigest, policyRevisionId)
  FK(
    professionalReviewEventId, professionalReviewId,
    basisDigest, policyRevisionId
  ) -> ProfessionalReviewEvent(
    id, reviewId, basisDigest, policyRevisionId
  )

SalesSnapshotWarning
  snapshotItemId
  warningSequence
  warningCode
  warningText
  UNIQUE(snapshotItemId, warningSequence)
  FK(snapshotItemId) -> SalesSnapshotCandidate(id)
```

Every copied parameter, price, source, review and professional-review row has
an exact FK to its immutable source revision and a deferred validation trigger
comparing the copied value/status/digest with that source row. A snapshot row
cannot refer to a different candidate or product.

### 9.3 Snapshot payload is a read-only reconstruction

There is no stored payload truth. `reconstruct_sales_handoff_payload(snapshotId,
schemaVersion)`:

1. reads only the immutable normalized rows;
2. verifies all exact ownership chains and copy equality;
3. orders rows by documented semantic keys;
4. emits an RFC 8785 JCS document;
5. computes `payloadDigest` for display/export.

The normalized rows remain authoritative even if reconstruction is unavailable.
The API must return an integrity error, not an alternative payload assembled
from current catalog state.

`basisDigest` is a SHA-256 over a database-defined canonical byte encoding of
the normalized basis (type, row key, exact IDs, canonical values, sorted by
declared semantic order). PostgreSQL can recompute this encoding with a
controlled function over immutable rows. The read-only JCS payload is a
different representation and is not used as a second source of truth.
`schemaVersion` determines the canonical field set and reconstruction order.

The `R3-BASIS-1` encoding is:

```text
for each normalized record, sorted by (recordType, stableKey, rowId):
  uint32be(byteLength(recordType)) || UTF8(recordType) || 0x1f
  for each declared field in schema order:
    NULL marker 0x00, or present marker 0x01
    || uint32be(byteLength(encodedValue)) || encodedValue
    || 0x1f
  || 0x1e
basisDigest = SHA-256(concatenated bytes)
```

`encodedValue` is a documented scalar encoding; it is never an unordered JSON
object serialization. A schema change requires a new `schemaVersion` and a new
basis algorithm version, never reinterpretation of an old digest.

### 9.4 Snapshot creation

Only `create_sales_handoff_snapshot(...)` may insert snapshot rows. The function:

1. locks the case row;
2. reads the exact requirement version and selection run;
3. verifies the run's rule-set revision and candidate membership;
4. inserts all snapshot field/candidate/parameter/price/source/review rows;
5. computes and sets `basisDigest`;
6. advances `currentSnapshotId` with CAS;
7. inserts the audit event;
8. commits.

At deferred COMMIT, triggers verify:

- case and snapshot project match;
- run belongs to the exact requirement/version;
- every candidate in the run is represented once;
- every copied value/status/digest matches its referenced immutable source;
- no row references a candidate from another run;
- basis digest matches the normalized rows;
- every source/evidence verification is `MATCH`.

If any check fails, the entire transaction rolls back and no pointer advances.
Snapshot rows and notes are append-only; no ordinary role can update/delete
them. Later product/source/price/review changes appear only as a read-time
basis diff, never by modifying the snapshot.

### 9.5 Historical meaning

The snapshot stores exact revision identities and copied normalized values.
Product withdrawal, price expiry, source withdrawal, review invalidation,
case reassignment or project/case status changes do not change the snapshot.
The API shows:

```text
snapshot basis
projectCurrent
basisDiff:
  requirementChanged
  selectionChanged
  sourceWithdrawn
  priceExpired
  reviewInvalidated
  policyChanged
```

An incorrectly associated historical row goes to an append-only integrity
quarantine record; it is not silently repaired or hidden.

## 10. Advisor Idempotency and Transactions

```text
AdvisorInteractionRequest
  PRIMARY KEY(id)
  projectId NOT NULL
  conversationId NOT NULL
  actorUserId NOT NULL
  clientMessageId NOT NULL
  operation NOT NULL
  requestDigest NOT NULL
  state COMMITTED | FAILED
  responseDigest NOT NULL
  failureCode NULL
  userMessageId NULL
  assistantMessageId NULL
  requirementVersionId NULL
  createdAt NOT NULL
  committedAt NULL
  UNIQUE(actorUserId, conversationId, clientMessageId)
  FK(projectId, conversationId)
    -> AdvisorConversation(projectId, id)
  FK(actorUserId) -> User(id)
  FK(userMessageId, conversationId)
    -> AdvisorMessage(id, conversationId)
  FK(assistantMessageId, conversationId)
    -> AdvisorMessage(id, conversationId)
  FK(requirementVersionId, projectId, conversationId)
    -> RequirementVersion(id, projectId, conversationId)
  CHECK (
    (state = 'COMMITTED'
      AND failureCode IS NULL
      AND userMessageId IS NOT NULL
      AND assistantMessageId IS NOT NULL
      AND requirementVersionId IS NOT NULL)
    OR
    (state = 'FAILED'
      AND failureCode IS NOT NULL
      AND userMessageId IS NULL
      AND assistantMessageId IS NULL
      AND requirementVersionId IS NULL)
  )
```

Transaction semantics:

1. A successful command writes request, user message, requirement version,
   assertions/values, assistant message, pointer and audit in one transaction.
   The request row is visible only after the same COMMIT.
2. A deterministic business rejection that must be replayable opens a separate
   failure-recording transaction. It performs no business mutation, writes one
   `FAILED` row with a response digest and commits. It does not claim that the
   failed business transaction also persisted its own row.
3. An unexpected exception, serialization/deadlock failure or connection loss
   rolls back all business and request rows. The client retries the command;
   no fake `FAILED` row is promised.
4. A COMMIT-unknown client re-reads the unique idempotency key using a new
   connection. If a committed row exists, it returns the stored correlated
   response; if none exists, it retries as a new attempt.
5. Concurrent same-key requests serialize on the unique key. If the first
   commits, the second must return the exact prior response; if the first rolls
   back, the second may proceed.
6. Same key with different request digest returns 409 and never invokes the
   business handler. A request from another conversation cannot reuse the row
   because the unique/FK chain is conversation-specific.
6. The output digest covers the response plus exact user/assistant/requirement
   IDs, so a replay cannot use a merely similar response.

## 11. Project Scenario and Migration

### 11.1 Runtime invariant

`Project.installationScenario` is NOT NULL after the expand/backfill window.
`projectType` is a compatibility field with a deterministic mapping:

```text
OLD_BUILDING_ELEVATOR -> OLD_BUILDING_ADDITION
OLD_BUILDING_ADDITION -> OLD_BUILDING_ADDITION
EXISTING_ELEVATOR_RENOVATION -> EXISTING_ELEVATOR_RENOVATION
NEW_BUILDING_INSTALLATION -> NEW_BUILDING_INSTALLATION
```

A CHECK rejects mismatched `(projectType, installationScenario)`.

Project scenario updates:

- before any conversation: the `project.manage` command locks the project row,
  validates the mapping and updates `projectType` and `installationScenario`
  together;
- after the first conversation: rejected by a trigger regardless of API path;
- both the update command and conversation creation lock the same project row;
- `ON UPDATE RESTRICT` is used for all historical scenario FKs.

### 11.2 Expand/backfill/validate

1. Freeze project scenario writes.
2. Add nullable `installationScenario` on existing Project rows.
3. Backfill only from an unambiguous existing ProjectType under the mapping.
4. Quarantine a project whose historical ProjectType cannot be mapped; do not
   guess.
5. Validate conversation/requirement scenario equality from all stored parent
   relationships.
6. Set Project.scenario NOT NULL and add the composite UNIQUE/FKs.
7. Add update triggers.
8. Resume writes only after all prechecks pass.

Legacy Requirement rows without `conversationId` are read-only/quarantined
until `OD-R3-06` disposition. They cannot be promoted into a new conversation.

## 12. Transaction and Concurrency Matrix

| Operation | Lock | Final-state rule | Failure result |
|---|---|---|---|
| Requirement edit/confirm | conversation row + project read lock | pointer, version, assertions, messages, request and audit commit together | one 200, stale request 409; no partial rows |
| Project scenario change vs conversation create | Project row lock in both | no scenario change after first conversation | one operation fails; no mixed child |
| Catalog capture | archive idempotency + evidence insert | archive object exists before evidence row | orphan archive object retained; no revision |
| Catalog source withdrawal vs review approval | source revision row lock | approval requires current MATCH verification and no withdrawal | approval fails closed |
| Professional review claim/decision | review row `FOR UPDATE` + stateVersion CAS | one event sequence, one current state | loser 409; no second event |
| Professional review vs basis change | review/basis lock | exact-basis recheck in transaction | review becomes invalidated/blocked |
| Snapshot creation | case row lock + deferred checks | all rows, basis digest, pointer and audit commit together | no snapshot/pointer/audit |
| Snapshot creation vs source withdrawal | case lock plus source read verification | snapshot captures one pre-withdrawal basis or aborts | no mixed evidence |
| Sale case assignment | case row lock | old/new assignee audit; snapshot unchanged | no silent reassignment |
| Project head update | project row lock + requirement version FK | one exact version pointer | stale CAS 409 |

For serialization/deadlock retries, retry only the classification approved by
the DB safety rules; never retry a commit-unknown business mutation without
re-reading durable state.

## 13. Failure States

```text
REQUIREMENT_SOURCE_MISMATCH       -> reject command; no version/value
EVIDENCE_MISSING                  -> review blocked; source not trusted
EVIDENCE_DIGEST_MISMATCH          -> review invalidated/rejected
SNAPSHOT_RELATION_MISMATCH        -> transaction rollback; integrity quarantine
SNAPSHOT_BASIS_MISMATCH           -> snapshot rejected; no pointer update
REVIEW_STATE_CONFLICT             -> 409; current event remains authoritative
REVIEW_BASIS_CHANGED              -> invalidation; no Operational
RULE_SET_NOT_APPROVED             -> REQUIRES_PROFESSIONAL_REVIEW
PRICE_NOT_APPLICABLE              -> REQUIRES_QUOTE
IDEMPOTENCY_KEY_REUSED             -> 409 with prior digest metadata
COMMIT_UNKNOWN                    -> re-read with fresh connection; preserve
                                     all canonical/archive evidence
```

No error handler turns an unknown relation, missing archive object, failed
verification or digest mismatch into `OPERATIONAL`.

## 14. Permissions

New capabilities:

```text
catalog.evidence.capture
catalog.evidence.verify
professional.review.submit
professional.review.decide
professional.review.withdraw
selection.rules.approve
sales.snapshot.create
```

Rules:

- product admins may create catalog drafts and evidence captures, not approve
  their own reviews;
- evidence verifier role may append verification events, not approve product
  or professional conclusions;
- reviewers must have an approved role/authority binding for the exact policy
  and project scope;
- System Admin cannot impersonate engineering approval;
- sales users may read only authorized snapshots and append notes;
- customers cannot insert source verification, professional-review events,
  rule-set approvals or snapshot rows;
- all table/function privileges follow least privilege, not table ownership by
  the application role.

Exact role names, project-wide qualifications and reviewer assignment remain
Open Decisions.

## 15. Open Decisions and Required Blocking

All R2 decisions remain open unless R3 explicitly maps them to a superseding
decision. The R3 decision list records:

- source archive product, retention, encryption and legal hold
  (`OD-R3-01`);
- raw bytes versus canonical text as the formal review basis
  (`OD-R3-02`);
- professional-review workflow, role separation and policy invalidation
  (`OD-R3-03/04`);
- snapshot retention/export (`OD-R3-05`);
- history scenario quarantine disposition (`OD-R3-06`);
- ruleset creator/approver roles (`OD-R3-07`);
- idempotency failure retention and customer replay display (`OD-R3-08`);
- evidence unavailable/missing behavior (`OD-R3-09`);
- all existing R2 business/engineering decisions.

Technical constraints in this document are not open business choices:

- ownership FKs;
- append-only event mechanics;
- evidence identity;
- exact snapshot version binding;
- snapshot payload projection authority;
- transaction and concurrency failure behavior.

## 16. Implementation Phases

### A. Design-only foundations

- pure semantic parser fixtures;
- DTO/status fixtures;
- independent catalog evidence archive contract tests;
- test-only canonical serializer fixtures;
- documentation and traceability.

### B. Future decision-dependent

- source capture/retention;
- rule authority;
- professional-review roles;
- price and applicable scope;
- project type policy;
- sales visibility/assignment;
- snapshot retention/export;
- formal rollout.

### C. Separately authorized high-risk implementation

- Prisma/Schema expand migration;
- composite FKs, checks, exclusion constraints and triggers;
- immutable catalog evidence metadata and archive adapter;
- requirement/provenance tables;
- professional-review events;
- rule-set revisions;
- normalized sales snapshot tables;
- database functions and least-privilege roles;
- all negative, concurrency and COMMIT-unknown verification.

### D. Never merged into this stream

- P1-3 Upload/Attempt/Lifecycle/FileVersion;
- Native RPC/Helper Runtime;
- production deployment and release Gate changes;
- real AI provider integration;
- real customer/Storage data.

## 17. Acceptance Criteria

```text
Five R2 P1 findings have executable R3 designs: REQUIRED
Five R2 P2 groups have executable R3 designs: REQUIRED
Every ownership FK has an exact referenced UNIQUE/PK: REQUIRED
Every append-only event has a uniqueness/CAS rule: REQUIRED
Source content is independently re-verifiable: REQUIRED
Snapshot has one authoritative normalized model: REQUIRED
Open Decisions are explicitly retained: REQUIRED
P1-3 boundary remains untouched: REQUIRED
Independent R3 review: PENDING
Source/Schema/Migration implementation: NOT AUTHORIZED
Database behavior: NOT VERIFIED
Runtime: NOT VERIFIED
```

R3 is a design artifact only. It is complete for independent review only if
the accompanying traceability and test matrix are complete and consistent.
