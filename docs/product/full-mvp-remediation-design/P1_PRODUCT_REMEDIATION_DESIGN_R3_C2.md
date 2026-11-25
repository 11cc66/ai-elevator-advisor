# P1 Product Remediation Design R3-C2

Task:

```text
FULL-MVP-REMEDIATION-DESIGN-R3-C2
```

Date: 2026-11-24

Status:

```text
R3-C2 DESIGN COMPLETE WITH OPEN BLOCKERS
```

R3-C2 is a design-only correction to R3. It does not modify R3, R2, R1,
source, Schema, Migration, tests, configuration or any runtime state. It does
not assert implementation closure.

## 1. Inputs and Current Boundary

The R3 design and R3 independent review are the immediate inputs. Their
verified hashes are recorded in `SHA256SUMS_R3.txt` and
`SHA256SUMS_R3_REVIEW.txt`. R2/R1, the MVP review/acceptance evidence and the
current implementation were read as historical context.

Current implementation facts remain unchanged:

- `apps/web/src/modules/selection/service.ts:17-54` still reads
  `requirement.fields`;
- `apps/web/src/modules/advisor/service.ts:25-153` still creates JSON
  requirement versions;
- `prisma/schema.prisma:904-942` still uses `BuildingRequirement` JSON and
  nullable conversation IDs;
- `prisma/schema.prisma:1042-1097` still has no exact R3 sales snapshot chain.

These are current-code facts, not R3-C2 implementation.

## 2. Corrections Selected

R3-C2 makes these normative choices:

1. Requirement assertions and field values use an explicit typed-value model.
2. RuleSet current status is derived from append-only review events; no
   independently writable `status` projection is authoritative.
3. ProfessionalReview current state is derived from append-only events; no
   independently writable `state`/`stateVersion` copy is authoritative.
4. `R3-BASIS-1` is a complete binary protocol with a fixed scalar catalogue,
   fixed record framing and independent test vectors.
5. Snapshot fields use an exact `FieldValue + sourceKind + sourceAssertionId`
   binding; a second assertion cannot masquerade as the field source.
6. All prior P2 decisions already approved by R3 remain preserved.

## 3. Requirement Source Chain

### 3.1 Chain and owners

```text
Project
  -> AdvisorConversation
      -> Requirement
          -> RequirementVersion
              -> RequirementFieldValue
                  -> RequirementAssertion
                      -> AdvisorMessage (USER_ASSERTION only)
```

`Requirement` is the stable logical requirement. `RequirementVersion` is
immutable. Corrections create a new version and never update prior messages,
assertions or values.

Every ownership column below is `NOT NULL` unless explicitly marked nullable.
The `installationScenario` is carried into the full RequirementVersion key so
the project/conversation scenario chain cannot be bypassed.

### 3.2 Project, Conversation and Message

```text
Project
  id PRIMARY KEY
  installationScenario NOT NULL
  projectType NOT NULL
  UNIQUE(id, installationScenario)
  CHECK projectType maps exactly to installationScenario

AdvisorConversation
  id PRIMARY KEY
  projectId NOT NULL
  installationScenario NOT NULL
  currentRequirementVersionId NULL
  UNIQUE(id, projectId, installationScenario)
  UNIQUE(projectId, id)
  FK(projectId, installationScenario)
    -> Project(id, installationScenario)

AdvisorMessage
  id PRIMARY KEY
  conversationId NOT NULL
  authorUserId NOT NULL
  role NOT NULL
  sequence NOT NULL
  content NOT NULL
  UNIQUE(conversationId, sequence)
  UNIQUE(id, conversationId)
  FK(conversationId) -> AdvisorConversation(id)
  FK(authorUserId) -> User(id)
```

`authorUserId` is server-derived. A client may not set it. For system-authored
messages, a dedicated system actor ID is used rather than a null author.

### 3.3 Requirement and exact version key

```text
Requirement
  id PRIMARY KEY
  projectId NOT NULL
  conversationId NOT NULL
  installationScenario NOT NULL
  UNIQUE(id, projectId, conversationId, installationScenario)
  FK(projectId, conversationId, installationScenario)
    -> AdvisorConversation(id, projectId, installationScenario)

RequirementVersion
  id PRIMARY KEY
  requirementId NOT NULL
  projectId NOT NULL
  conversationId NOT NULL
  installationScenario NOT NULL
  versionNumber NOT NULL
  versionStatus NOT NULL
  fieldStateDigest NOT NULL
  createdAt NOT NULL
  UNIQUE(requirementId, versionNumber)
  UNIQUE(id, projectId, conversationId)
  UNIQUE(id, requirementId, projectId, conversationId)
  UNIQUE(
    id, requirementId, projectId, conversationId, installationScenario
  )
  FK(requirementId, projectId, conversationId, installationScenario)
    -> Requirement(
      id, projectId, conversationId, installationScenario
    )
```

The two exact keys required by child relations are:

```text
UNIQUE(id, requirementId, projectId, conversationId)
UNIQUE(id, requirementId, projectId, conversationId, installationScenario)
```

Every FK that requires the scenario uses the five-column key. Every FK that
does not carry scenario uses the four-column key. No implementer may infer a
UNIQUE key that is not declared.

`AdvisorConversation.currentRequirementVersionId` uses:

```text
FK(currentRequirementVersionId, projectId, id, installationScenario)
  -> RequirementVersion(
       id, projectId, conversationId, installationScenario
     )
```

The pointer is nullable only for an explicitly empty conversation. When
non-null, all four FK values must match.

### 3.4 Complete RequirementAssertion

The complete assertion model is:

```text
RequirementFieldAssertion
  id PRIMARY KEY
  requirementVersionId NOT NULL
  requirementId NOT NULL
  projectId NOT NULL
  conversationId NOT NULL
  installationScenario NOT NULL
  fieldKey NOT NULL
  valueType NOT NULL
  booleanValue NULL
  integerValue NULL
  decimalValue NULL
  textValue NULL
  enumValue NULL
  uuidValue NULL
  timestampValue NULL
  bytesValue NULL
  unit NULL
  polarity NOT NULL
  semanticKind NOT NULL
  conditionJson NULL
  exceptionJson NULL
  temporalScope NULL
  modality NULL
  assertionStatus NOT NULL
  sourceKind NOT NULL
  sourceMessageId NULL
  sourceProfessionalReviewEventId NULL
  sourceEvidenceObjectId NULL
  sourceSystemRuleRevisionId NULL
  createdByUserId NOT NULL
  parsedAt NOT NULL
  parserRuleId NOT NULL
  parserVersion NOT NULL
  confirmationState NOT NULL
  confirmationByUserId NULL
  supersedesAssertionId NULL
  UNIQUE(id, requirementId)
  UNIQUE(
    id, requirementVersionId, requirementId, projectId, conversationId,
    installationScenario
  )
  FK(
    requirementVersionId, requirementId, projectId, conversationId,
    installationScenario
  ) -> RequirementVersion(
    id, requirementId, projectId, conversationId, installationScenario
  )
  FK(sourceMessageId, conversationId)
    -> AdvisorMessage(id, conversationId)
  FK(sourceProfessionalReviewEventId)
    -> ProfessionalReviewEvent(id)
  FK(sourceEvidenceObjectId) -> CatalogEvidenceObject(id)
  FK(sourceSystemRuleRevisionId) -> SelectionRuleSetRevision(id)
  FK(createdByUserId) -> User(id)
  FK(confirmationByUserId) -> User(id)
  FK(supersedesAssertionId, requirementId)
    -> RequirementFieldAssertion(id, requirementId)
  CHECK exactly one typed value column is non-null when value is present
  CHECK valueType matches the non-null typed column
  CHECK valueType = 'NULL' when all typed value columns are null
  CHECK sourceKind = 'USER_ASSERTION'
        implies sourceMessageId IS NOT NULL
  CHECK sourceKind <> 'USER_ASSERTION'
        implies sourceMessageId IS NULL
  CHECK sourceKind = 'PROFESSIONAL_REVIEW'
        implies sourceProfessionalReviewEventId IS NOT NULL
  CHECK sourceKind = 'CATALOG_EVIDENCE'
        implies sourceEvidenceObjectId IS NOT NULL
  CHECK sourceKind = 'SYSTEM_DERIVED'
        implies sourceSystemRuleRevisionId IS NOT NULL
  CHECK sourceKind = 'OTHER_AUTHORIZED_SOURCE'
        implies false
  CHECK (
    (sourceKind = 'USER_ASSERTION'
      AND sourceMessageId IS NOT NULL
      AND sourceProfessionalReviewEventId IS NULL
      AND sourceEvidenceObjectId IS NULL
      AND sourceSystemRuleRevisionId IS NULL)
    OR
    (sourceKind = 'PROFESSIONAL_REVIEW'
      AND sourceMessageId IS NULL
      AND sourceProfessionalReviewEventId IS NOT NULL
      AND sourceEvidenceObjectId IS NULL
      AND sourceSystemRuleRevisionId IS NULL)
    OR
    (sourceKind = 'CATALOG_EVIDENCE'
      AND sourceMessageId IS NULL
      AND sourceProfessionalReviewEventId IS NULL
      AND sourceEvidenceObjectId IS NOT NULL
      AND sourceSystemRuleRevisionId IS NULL)
    OR
    (sourceKind = 'SYSTEM_DERIVED'
      AND sourceMessageId IS NULL
      AND sourceProfessionalReviewEventId IS NULL
      AND sourceEvidenceObjectId IS NULL
      AND sourceSystemRuleRevisionId IS NOT NULL)
  )
  CHECK semanticKind = 'CONDITIONAL' implies conditionJson IS NOT NULL
  CHECK semanticKind = 'EXCEPTION' implies exceptionJson IS NOT NULL
```

`typedValue` is represented by the typed columns, never by an unconstrained
JSON value. `conditionJson` and `exceptionJson` are structured condition
objects whose schema is versioned and validated by the parser command; they
cannot be used as a second arbitrary value field.

All `sourceKey` and source identity columns use UUID values (not free-form
text). A UUID text rendering may be shown in the API, but the database FK and
equality checks use native UUID equality. This keeps assertion, review-event
and evidence identities type-safe and comparable.

### 3.5 Complete RequirementFieldValue

```text
RequirementFieldValue
  id PRIMARY KEY
  requirementVersionId NOT NULL
  requirementId NOT NULL
  projectId NOT NULL
  conversationId NOT NULL
  installationScenario NOT NULL
  fieldKey NOT NULL
  valueType NOT NULL
  booleanValue NULL
  integerValue NULL
  decimalValue NULL
  textValue NULL
  enumValue NULL
  uuidValue NULL
  timestampValue NULL
  bytesValue NULL
  unit NULL
  conditionJson NULL
  fieldStatus NOT NULL
  sourceKind NOT NULL
  sourceKey NOT NULL
  sourceAssertionId NULL
  sourceProfessionalReviewEventId NULL
  sourceEvidenceObjectId NULL
  sourceSystemRuleRevisionId NULL
  confirmationState NOT NULL
  confirmationEventId NULL
  requiresProfessionalReview NOT NULL
  UNIQUE(requirementVersionId, fieldKey)
  UNIQUE(
    id, requirementVersionId, requirementId, projectId, conversationId,
    installationScenario
  )
  UNIQUE(
    id, requirementVersionId, requirementId, projectId, conversationId,
    installationScenario, sourceKind, sourceKey
  )
  FK(
    requirementVersionId, requirementId, projectId, conversationId,
    installationScenario
  ) -> RequirementVersion(
    id, requirementId, projectId, conversationId, installationScenario
  )
  FK(sourceAssertionId, requirementVersionId, requirementId, projectId,
     conversationId, installationScenario)
    -> RequirementFieldAssertion(
      id, requirementVersionId, requirementId, projectId, conversationId,
      installationScenario
    )
  FK(sourceProfessionalReviewEventId)
    -> ProfessionalReviewEvent(id)
  FK(sourceEvidenceObjectId) -> CatalogEvidenceObject(id)
  FK(sourceSystemRuleRevisionId) -> SelectionRuleSetRevision(id)
  FK(confirmationEventId) -> RequirementConfirmationEvent(id)
  CHECK exactly one value column is non-null when valueType <> 'NULL'
  CHECK valueType matches the non-null typed value column
  CHECK sourceKind = 'USER_ASSERTION'
        implies sourceAssertionId IS NOT NULL
  CHECK sourceKind = 'USER_ASSERTION'
        implies sourceKey = sourceAssertionId
  CHECK sourceKind = 'PROFESSIONAL_REVIEW'
        implies sourceProfessionalReviewEventId IS NOT NULL
  CHECK sourceKind = 'CATALOG_EVIDENCE'
        implies sourceEvidenceObjectId IS NOT NULL
  CHECK sourceKind = 'SYSTEM_DERIVED'
        implies sourceAssertionId IS NOT NULL
  CHECK sourceKind = 'SYSTEM_DERIVED'
        implies sourceKey = sourceAssertionId
  CHECK (
    (sourceKind = 'USER_ASSERTION'
      AND sourceAssertionId IS NOT NULL
      AND sourceProfessionalReviewEventId IS NULL
      AND sourceEvidenceObjectId IS NULL
      AND sourceSystemRuleRevisionId IS NULL)
    OR
    (sourceKind = 'PROFESSIONAL_REVIEW'
      AND sourceAssertionId IS NULL
      AND sourceProfessionalReviewEventId IS NOT NULL
      AND sourceEvidenceObjectId IS NULL
      AND sourceSystemRuleRevisionId IS NULL)
    OR
    (sourceKind = 'CATALOG_EVIDENCE'
      AND sourceAssertionId IS NULL
      AND sourceProfessionalReviewEventId IS NULL
      AND sourceEvidenceObjectId IS NOT NULL
      AND sourceSystemRuleRevisionId IS NULL)
    OR
    (sourceKind = 'SYSTEM_DERIVED'
      AND sourceAssertionId IS NOT NULL
      AND sourceProfessionalReviewEventId IS NULL
      AND sourceEvidenceObjectId IS NULL
      AND sourceSystemRuleRevisionId IS NOT NULL)
  )
  CHECK (
    (sourceKind = 'USER_ASSERTION' AND sourceKey = sourceAssertionId)
    OR (sourceKind = 'PROFESSIONAL_REVIEW'
        AND sourceKey = sourceProfessionalReviewEventId)
    OR (sourceKind = 'CATALOG_EVIDENCE'
        AND sourceKey = sourceEvidenceObjectId)
    OR (sourceKind = 'SYSTEM_DERIVED'
        AND sourceKey = sourceAssertionId)
  )
  CHECK fieldStatus <> 'CONFIRMED'
        OR confirmationEventId IS NOT NULL
  CHECK fieldStatus <> 'CONFIRMED'
        OR confirmationState = 'CONFIRMED'
  CHECK fieldStatus <> 'CONDITIONAL'
        OR conditionJson IS NOT NULL
  CHECK fieldStatus IN
    ('ASSERTED','CONDITIONAL','NEEDS_CONFIRMATION','CONFIRMED',
     'CONFLICTED','REJECTED','SUPERSEDED','UNKNOWN')
```

`valueType = 'NULL'` is only legal for `UNKNOWN` or `NEEDS_CONFIRMATION`;
`CONFIRMED` requires a typed value and a valid confirmation event. The exact
typed columns are:

| valueType | column | validation |
|---|---|---|
| `BOOLEAN` | `booleanValue` | boolean only |
| `INTEGER` | `integerValue` | signed 64-bit integer |
| `DECIMAL` | `decimalValue` | numeric with approved scale |
| `TEXT` | `textValue` | non-null UTF-8 text |
| `ENUM` | `enumValue` | allowlisted enum code |
| `UUID` | `uuidValue` | UUID |
| `TIMESTAMP` | `timestampValue` | UTC timestamp |
| `BYTES` | `bytesValue` | bounded bytes |
| `NULL` | none | only unknown/unconfirmed |

A `FIELD_VALUE` cannot reference a different version, project, conversation
or source assertion. A client payload cannot supply the `authorUserId`,
`createdByUserId`, `confirmationByUserId` or source IDs as trusted facts.

### 3.6 Confirmation and JSON projection

```text
RequirementConfirmationEvent
  id PRIMARY KEY
  requirementVersionId NOT NULL
  requirementId NOT NULL
  projectId NOT NULL
  conversationId NOT NULL
  installationScenario NOT NULL
  action CONFIRM | REJECT | CORRECT
  actorUserId NOT NULL
  requestId NOT NULL
  previousFieldStateDigest NULL
  newFieldStateDigest NOT NULL
  occurredAt NOT NULL
  UNIQUE(requirementVersionId, requestId)
  FK(requirementVersionId, requirementId, projectId, conversationId,
     installationScenario)
    -> RequirementVersion(
      id, requirementId, projectId, conversationId, installationScenario
    )
  FK(actorUserId) -> User(id)
```

The JSON compatibility projection is a read-only materialization:

- it is generated from `RequirementFieldValue` rows by one versioned
  projection function;
- it has a `projectionDigest` over the generated value;
- it is not accepted from a client and not independently writable;
- if generation fails, the transaction fails and no version/pointer commits;
- legacy JSON is read-only, quarantined or migrated only under an approved
  deterministic mapping;
- selection always reads `RequirementFieldValue`, never the legacy JSON.

## 4. Catalog Evidence

The R3 independent archive direction is retained:

```text
CatalogEvidenceArchive
  putIfAbsent(bytes, mediaType) -> immutable object
  readExact(archiveObjectId, expectedDigest, expectedLength)
  stat(archiveObjectId)
```

The archive is content-addressed/write-once, has an identity separate from
P1-3 file lifecycle, and cannot use `storage/private`. The archive provider,
encryption, retention and Legal Hold remain Open Decisions.

Catalog revision keys used below are:

```text
ProductRevision          UNIQUE(id, productId)
SpecificationRevision    UNIQUE(id, productRevisionId)
PriceRevision            UNIQUE(id, productRevisionId)
CatalogParameterRevision UNIQUE(id, specificationRevisionId, parameterKey)
CatalogParameterRevision UNIQUE(id, sourceRevisionId)
```

`CatalogParameterRevision` is immutable and stores parameter key, typed
value/unit, exact source revision, and exact catalog review evidence:

```text
CatalogParameterRevision
  id PRIMARY KEY
  specificationRevisionId NOT NULL
  parameterKey NOT NULL
  valueType NOT NULL
  valueText NOT NULL
  unit NULL
  sourceRevisionId NOT NULL
  catalogReviewId NOT NULL
  UNIQUE(specificationRevisionId, parameterKey)
  UNIQUE(id, sourceRevisionId)
  FK(specificationRevisionId) -> SpecificationRevision(id)
  FK(sourceRevisionId) -> CatalogSourceRevision(id)
  FK(catalogReviewId) -> CatalogReview(id)
```

```text
CatalogEvidenceObject
  id PRIMARY KEY
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
  id PRIMARY KEY
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
  id PRIMARY KEY
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
  CHECK (outcome = 'MATCH' AND observedDigest = expectedDigest
         OR outcome <> 'MATCH')

CatalogSourceWithdrawal
  id PRIMARY KEY
  sourceRevisionId NOT NULL
  actorUserId NOT NULL
  reason NOT NULL
  occurredAt NOT NULL
  replacementSourceRevisionId NULL
  UNIQUE(sourceRevisionId)
  FK(sourceRevisionId) -> CatalogSourceRevision(id)
  FK(replacementSourceRevisionId) -> CatalogSourceRevision(id)
  FK(actorUserId) -> User(id)

CatalogReviewPolicyRevision
  id PRIMARY KEY
  policyKey NOT NULL
  revisionNumber NOT NULL
  contentJson NOT NULL
  contentDigest NOT NULL
  effectiveFrom NOT NULL
  effectiveTo NULL
  approvedAt NOT NULL
  approvedByUserId NOT NULL
  UNIQUE(policyKey, revisionNumber)
  UNIQUE(id, contentDigest)
  FK(approvedByUserId) -> User(id)

CatalogReview
  id PRIMARY KEY
  reviewType NOT NULL
  manufacturerRevisionId NULL
  brandRevisionId NULL
  productRevisionId NULL
  specificationRevisionId NULL
  priceRevisionId NULL
  sourceRevisionId NULL
  decision APPROVE | REJECT | REVOKE
  reviewerUserId NOT NULL
  reviewerAuthorityId NOT NULL
  reviewedAt NOT NULL
  inputDigest NOT NULL
  policyRevisionId NOT NULL
  CHECK exactly one target FK is non-null
  CHECK reviewType matches target FK
  FK(reviewerUserId) -> User(id)
  FK(policyRevisionId) -> CatalogReviewPolicyRevision(id)

CatalogReviewSourceEvidence
  reviewId NOT NULL
  sourceRevisionId NOT NULL
  evidenceVerificationId NOT NULL
  UNIQUE(reviewId, sourceRevisionId)
  FK(reviewId) -> CatalogReview(id)
  FK(sourceRevisionId) -> CatalogSourceRevision(id)
  FK(evidenceVerificationId) -> CatalogEvidenceVerification(id)
```

For a formal review, `CatalogReviewSourceEvidence` binds the exact
SourceRevision to a `MATCH` verification. The deferred check ensures the
verification object/digest equals the SourceRevision object/digest and no later
negative verification exists.

## 5. RuleSet Event-Authoritative State

### 4.1 Models

```text
SelectionRuleSet
  id PRIMARY KEY
  stableKey NOT NULL
  UNIQUE(stableKey)

SelectionRuleSetRevision
  id PRIMARY KEY
  ruleSetId NOT NULL
  revisionNumber NOT NULL
  installationScenario NOT NULL
  contentDigest NOT NULL
  authoritySourceRevisionId NOT NULL
  effectiveFrom NOT NULL
  effectiveTo NULL
  createdAt NOT NULL
  UNIQUE(ruleSetId, revisionNumber)
  UNIQUE(id, installationScenario)
  UNIQUE(id, contentDigest)
  FK(ruleSetId) -> SelectionRuleSet(id)
  FK(authoritySourceRevisionId) -> CatalogSourceRevision(id)

SelectionRuleRevision
  id PRIMARY KEY
  ruleSetRevisionId NOT NULL
  ruleKey NOT NULL
  operator NOT NULL
  valueType NOT NULL
  valueText NOT NULL
  unit NULL
  sourceRevisionId NOT NULL
  UNIQUE(ruleSetRevisionId, ruleKey)
  FK(ruleSetRevisionId) -> SelectionRuleSetRevision(id)
  FK(sourceRevisionId) -> CatalogSourceRevision(id)

RuleSetReviewPolicyRevision
  id PRIMARY KEY
  policyKey NOT NULL
  revisionNumber NOT NULL
  contentJson NOT NULL
  contentDigest NOT NULL
  effectiveFrom NOT NULL
  effectiveTo NULL
  approvedAt NOT NULL
  approvedByUserId NOT NULL
  UNIQUE(policyKey, revisionNumber)
  UNIQUE(id, contentDigest)
  FK(approvedByUserId) -> User(id)

SelectionRuleSetReviewEvent
  id PRIMARY KEY
  ruleSetRevisionId NOT NULL
  eventSequence NOT NULL
  resultingStatusVersion NOT NULL
  previousStatus NOT NULL
  newStatus NOT NULL
  actorUserId NOT NULL
  actorAuthorityId NOT NULL
  policyRevisionId NOT NULL
  basisDigest NOT NULL
  decision NOT NULL
  reason NOT NULL
  occurredAt NOT NULL
  requestId NOT NULL
  UNIQUE(ruleSetRevisionId, eventSequence)
  UNIQUE(ruleSetRevisionId, resultingStatusVersion)
  UNIQUE(ruleSetRevisionId, requestId)
  UNIQUE(id, ruleSetRevisionId, basisDigest, policyRevisionId)
  FK(ruleSetRevisionId) -> SelectionRuleSetRevision(id)
  FK(policyRevisionId) -> RuleSetReviewPolicyRevision(id)
  FK(actorUserId) -> User(id)
  CHECK newStatus IN
    ('DRAFT','PENDING_REVIEW','APPROVED','REJECTED','REVOKED',
     'EXPIRED')
  CHECK newStatus NOT IN ('APPROVED','REJECTED')
        OR decision IS NOT NULL
```

### 4.2 Authority choice

The event table is authoritative. `SelectionRuleSetRevision` has no mutable
`status` truth. A read-only view computes current status and current event:

```text
selection_rule_set_current
  = latest event by (ruleSetRevisionId, eventSequence DESC)
```

The formal resolver uses the latest event and exact policy/source checks. An
`APPROVED` status without an event does not exist as an authoritative state.

Only a controlled `transition_rule_set_review` function may insert an event.
It locks the RuleSetRevision row, reads the latest event, checks
`expectedStatusVersion`, validates the exact revision/policy/source digest,
inserts one event and commits. Ordinary roles cannot INSERT/UPDATE/DELETE the
event table or bypass the function.

### 4.3 Formal use

`SelectionRun` binds the exact `ruleSetRevisionId`. A formal run requires:

- latest event `APPROVED`;
- event policy revision approved and effective;
- exact rule content digest and authority source verification;
- no later `REVOKED` or `EXPIRED` event;
- exactly one applicable approved revision; otherwise fail closed.

Old runs retain their old revision ID and remain historically explainable.

## 6. ProfessionalReview Event-Authoritative State

### 5.1 Authority choice

R3-C2 chooses event-only authority for ProfessionalReview. There is no mutable
`ProfessionalReview.state` or `stateVersion` truth. Current state is the latest
valid event:

```text
professional_review_current
  = latest ProfessionalReviewEvent by (reviewId, eventSequence DESC)
```

### 5.2 Header

```text
ProfessionalReviewPolicyRevision
  id PRIMARY KEY
  policyKey NOT NULL
  revisionNumber NOT NULL
  contentJson NOT NULL
  contentDigest NOT NULL
  effectiveFrom NOT NULL
  effectiveTo NULL
  approvedAt NOT NULL
  approvedByUserId NOT NULL
  UNIQUE(policyKey, revisionNumber)
  UNIQUE(id, contentDigest)
  FK(approvedByUserId) -> User(id)

ProfessionalReview
  id PRIMARY KEY
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
  basisDigest NOT NULL
  createdByUserId NOT NULL
  createdAt NOT NULL
  UNIQUE(candidateId, policyRevisionId, attemptNumber)
  UNIQUE(id, basisDigest, policyRevisionId)
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
  FK(createdByUserId) -> User(id)

SelectionCandidateSourceRevision
  candidateId NOT NULL
  sourceRevisionId NOT NULL
  sourceRole NOT NULL
  rawContentDigest NOT NULL
  evidenceVerificationId NOT NULL
  UNIQUE(candidateId, sourceRevisionId)
  FK(candidateId) -> SelectionCandidateResult(id)
  FK(sourceRevisionId, rawContentDigest)
    -> CatalogSourceRevision(id, rawContentDigest)
  FK(evidenceVerificationId) -> CatalogEvidenceVerification(id)

ProfessionalReviewSourceBasis
  reviewId NOT NULL
  sourceRevisionId NOT NULL
  sourceRawDigest NOT NULL
  evidenceVerificationId NOT NULL
  UNIQUE(reviewId, sourceRevisionId)
  FK(reviewId) -> ProfessionalReview(id)
  FK(sourceRevisionId, sourceRawDigest)
    -> CatalogSourceRevision(id, rawContentDigest)
  FK(evidenceVerificationId) -> CatalogEvidenceVerification(id)

ProfessionalReviewPriceBasis
  reviewId NOT NULL
  priceRevisionId NOT NULL
  UNIQUE(reviewId)
  FK(reviewId) -> ProfessionalReview(id)
  FK(priceRevisionId) -> PriceRevision(id)

ProfessionalReviewEvent
  id PRIMARY KEY
  reviewId NOT NULL
  eventSequence NOT NULL
  resultingStateVersion NOT NULL
  previousState NULL
  newState NOT NULL
  actorUserId NOT NULL
  actorAuthorityId NOT NULL
  decision NULL
  reason NULL
  occurredAt NOT NULL
  basisDigest NOT NULL
  policyRevisionId NOT NULL
  requestId NOT NULL
  UNIQUE(reviewId, eventSequence)
  UNIQUE(reviewId, resultingStateVersion)
  UNIQUE(reviewId, requestId)
  UNIQUE(id, reviewId, basisDigest, policyRevisionId)
  FK(reviewId, basisDigest, policyRevisionId)
    -> ProfessionalReview(id, basisDigest, policyRevisionId)
  FK(actorUserId) -> User(id)
  CHECK newState IN
    ('CREATED','SUBMITTED','IN_REVIEW','APPROVED','REJECTED',
     'RETURNED_FOR_INFORMATION','WITHDRAWN','INVALIDATED','EXPIRED')
  CHECK newState NOT IN ('APPROVED','REJECTED','RETURNED_FOR_INFORMATION')
        OR decision IS NOT NULL
```

A deferred constraint trigger checks that the
`ProfessionalReviewSourceBasis` set is exactly the candidate's
`SelectionCandidateSourceRevision` set, that every verification is `MATCH`, and
that the optional price basis exactly matches the candidate price revision.
Missing, duplicate or extra source-basis rows reject the transaction.

### 5.3 Transition function and constraints

`transition_professional_review(...)`:

1. locks the `ProfessionalReview` row;
2. reads the latest event and its state/version;
3. checks the supplied `expectedStateVersion` and allowed transition;
4. verifies the exact candidate, requirement, rule, source, price and policy
   basis;
5. inserts exactly one event with `eventSequence = previous + 1`;
6. commits; there is no separate mutable status update.

Only the function's owner/service role may execute it. Direct
INSERT/UPDATE/DELETE on the event table is denied. The view is the only
current-state read model. A missing last event is an integrity failure, never
an inferred state.

Allowed transitions:

```text
none -> CREATED
CREATED -> SUBMITTED | WITHDRAWN | INVALIDATED
SUBMITTED -> IN_REVIEW | WITHDRAWN | INVALIDATED
IN_REVIEW -> APPROVED | REJECTED | RETURNED_FOR_INFORMATION | WITHDRAWN |
             INVALIDATED
APPROVED -> INVALIDATED | EXPIRED
terminal states -> no further event
```

The event table is append-only and the current view is deterministic. Two
reviewers concurrently selecting/deciding: one event sequence wins; the other
fails due to lock/CAS/unique constraints.

## 7. R3-BASIS-1 Revision 2

### 6.1 Scope

`R3-BASIS-1` defines the authoritative byte encoding used for a normalized
sales snapshot basis. It is not a JSON serialization. The payload shown to a
user is separately rendered using the approved JCS profile; the payload is not
an alternate writable fact.

Top-level bytes:

```text
Magic:               52 33 42 41 53 49 53 00 (ASCII "R3BASIS\0")
Format version:      uint16be = 0x0002
Payload type:        uint16be = 0x0001 (snapshot basis)
Header length:       uint32be = 28
Record count:        uint32be
Body byte length:    uint64be
Body:                concatenated records
```

All integers are big-endian. All strings are UTF-8 with Unicode NFC
normalization. Invalid UTF-8, non-NFC text, invalid enum values and overflowed
lengths are rejected before hashing.

### 6.2 Record framing

```text
recordLength        uint32be, includes this field and entire record
recordType          uint16be, fixed schema registry
rowId               16 bytes, UUID binary form
stableKeyLength     uint16be
stableKey           UTF-8 NFC bytes, 1..512 bytes
fieldCount          uint16be
fields              field records in ascending fieldTag order
```

`stableKey` is a deterministic semantic key defined per record type. It is not
a surrogate row ID. It contains a type prefix and length-delimited identity
components; no random value is allowed. `rowId` is the stored row's stable
UUID and is included so a snapshot instance can identify its exact row. A
duplicate `(recordType, stableKey)` is a rejection, not an ordering tie.
Records are sorted by `(recordType, stableKey bytes, rowId bytes)`.

### 6.3 Field framing

```text
fieldTag            uint16be, schema-defined and unique in a record
typeTag             uint8
presence            0x00 = null, 0x01 = present
valueLength         uint32be
encodedValue        exactly valueLength bytes
```

Fields must be sorted by `fieldTag`; missing required fields and duplicate tags
are rejected. For `presence=0`, `typeTag=0` and `valueLength=0`; a present
value may not use the NULL type.

### 6.4 Scalar catalogue

| typeTag | type | exact encoding |
|---:|---|---|
| 0 | NULL | presence=0, length=0 |
| 1 | BOOLEAN | one byte `00` false or `01` true |
| 2 | INTEGER | signed 64-bit big-endian two's complement |
| 3 | DECIMAL | canonical ASCII, no exponent, sign then digits, no leading zeros, trailing fractional zeros removed, zero encoded `0`; max 18 digits and scale 6 |
| 4 | TEXT | UTF-8 NFC bytes, max 1 MiB |
| 5 | ENUM | ASCII stable enum code, max 128 bytes |
| 6 | UUID | exactly 16 RFC 4122 bytes, network order |
| 7 | TIMESTAMP | signed 64-bit big-endian Unix epoch milliseconds, UTC only |
| 8 | BYTES | raw bytes, max 1 MiB |
| 9 | LIST | one byte element type, uint32be count, then each uint32be length + encoded element; list length max 10,000; elements are sorted by encoded bytes and duplicates are rejected unless the field schema says duplicates are allowed |

`encodedValue` is the raw bytes after the type-specific encoding. It is not
JSON. A `TEXT` value `"1"` and an `INTEGER` value `1` therefore have different
type tags and field frames.

### 6.5 Canonical examples

The complete valid vector set, including exact field/record/basis bytes and
SHA-256 values, is in `P1_PRODUCT_REMEDIATION_TEST_PLAN_R3_C2.md`. The vector
set contains at least 20 valid vectors plus rejection vectors for invalid
UTF-8 and oversized values.

## 8. Sales Snapshot Source Consistency

### 7.1 FieldValue source model

`RequirementFieldValue` has one explicit `sourceKind` and a corresponding
source identity:

- `USER_ASSERTION`: exact `RequirementFieldAssertion` + Message;
- `PROFESSIONAL_REVIEW`: exact `ProfessionalReviewEvent`;
- `CATALOG_EVIDENCE`: exact immutable catalog evidence;
- `SYSTEM_DERIVED`: exact deterministic assertion/rule evidence;
- `OTHER_AUTHORIZED_SOURCE`: a typed extension table, never a free ID.

Exactly one source kind is selected. A missing source is an explicit
`NEEDS_CONFIRMATION`/`UNKNOWN` state, not a NULL FK that bypasses the check.

### 7.2 Snapshot field

R3-C2 chooses **Option B** for snapshot self-containment: copy the source
identity, but bind it to an exact parent key.

The C2 header retains the R3 exact chain and adds the explicit six-column
identity used by snapshot fields:

```text
SelectionRun
  id PRIMARY KEY
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
  UNIQUE(id, projectId, conversationId, requirementId,
         requirementVersionId, installationScenario, ruleSetRevisionId)
  FK(requirementVersionId, requirementId, projectId, conversationId,
     installationScenario)
    -> RequirementVersion(
      id, requirementId, projectId, conversationId, installationScenario
    )
  FK(ruleSetRevisionId, installationScenario)
    -> SelectionRuleSetRevision(id, installationScenario)

SelectionCandidateResult
  id PRIMARY KEY
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
  UNIQUE(id, selectionRunId, projectId, conversationId, requirementId,
         requirementVersionId, installationScenario, ruleSetRevisionId)
  FK(selectionRunId, projectId, conversationId, requirementId,
     requirementVersionId, installationScenario, ruleSetRevisionId)
    -> SelectionRun(id, projectId, conversationId, requirementId,
                    requirementVersionId, installationScenario,
                    ruleSetRevisionId)
  FK(specificationRevisionId, productRevisionId)
    -> SpecificationRevision(id, productRevisionId)
  FK(priceRevisionId, productRevisionId)
    -> PriceRevision(id, productRevisionId)

SalesHandoffCase
  id PRIMARY KEY
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

SalesHandoffSnapshot
  id PRIMARY KEY
  caseId NOT NULL
  projectId NOT NULL
  conversationId NOT NULL
  requirementId NOT NULL
  requirementVersionId NOT NULL
  installationScenario NOT NULL
  selectionRunId NOT NULL
  ruleSetRevisionId NOT NULL
  versionNumber NOT NULL
  schemaVersion NOT NULL
  basisDigest NOT NULL
  createdByUserId NOT NULL
  createdAt NOT NULL
  UNIQUE(caseId, versionNumber)
  UNIQUE(id, caseId, projectId)
  UNIQUE(id, projectId, conversationId, requirementId,
         requirementVersionId, installationScenario)
  UNIQUE(id, projectId, conversationId, requirementId,
         requirementVersionId, installationScenario, selectionRunId,
         ruleSetRevisionId)
  FK(caseId, projectId) -> SalesHandoffCase(id, projectId)
  FK(requirementVersionId, requirementId, projectId, conversationId,
     installationScenario)
    -> RequirementVersion(
      id, requirementId, projectId, conversationId, installationScenario
    )
  FK(selectionRunId, projectId, conversationId, requirementId,
     requirementVersionId, installationScenario, ruleSetRevisionId)
    -> SelectionRun(
      id, projectId, conversationId, requirementId,
      requirementVersionId, installationScenario, ruleSetRevisionId
    )
  FK(createdByUserId) -> User(id)
```

```text
SalesSnapshotRequirementField
  id PRIMARY KEY
  snapshotId NOT NULL
  projectId NOT NULL
  conversationId NOT NULL
  requirementId NOT NULL
  requirementVersionId NOT NULL
  installationScenario NOT NULL
  fieldKey NOT NULL
  sourceFieldValueId NOT NULL
  sourceKind NOT NULL
  sourceKey NOT NULL
  sourceAssertionId NULL
  valueJson NOT NULL
  valueType NOT NULL
  unit NULL
  fieldStatus NOT NULL
  copiedAt NOT NULL
  UNIQUE(snapshotId, fieldKey)
  UNIQUE(id, snapshotId)
  FK(snapshotId, projectId, conversationId, requirementId,
     requirementVersionId, installationScenario)
    -> SalesHandoffSnapshot(
      id, projectId, conversationId, requirementId,
      requirementVersionId, installationScenario
    )
  FK(sourceFieldValueId, requirementVersionId, requirementId, projectId,
     conversationId, installationScenario, sourceKind, sourceKey)
    -> RequirementFieldValue(
      id, requirementVersionId, requirementId, projectId, conversationId,
      installationScenario, sourceKind, sourceKey
    )
```

The parent `UNIQUE` includes `sourceKind` and `sourceKey`; therefore a
snapshot row cannot combine FieldValue F with assertion A2 when F's source is
A1. The non-null `sourceKey` is a canonical identity for every source kind:
assertion ID, professional review event ID, evidence object ID or system
evidence ID. For `USER_ASSERTION`, `sourceKey` must equal `sourceAssertionId`;
for other kinds, the typed source column is checked by its kind. The parent
key is never bypassed by a NULL component.

The remaining normalized snapshot tables are:

```text
SalesSnapshotCandidate
  id PRIMARY KEY
  snapshotId NOT NULL
  candidateId NOT NULL
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
  UNIQUE(id, snapshotId)
  UNIQUE(snapshotId, candidateId)
  FK(snapshotId, projectId, conversationId, requirementId,
     requirementVersionId, installationScenario, selectionRunId,
     ruleSetRevisionId)
    -> SalesHandoffSnapshot(
      id, projectId, conversationId, requirementId,
      requirementVersionId, installationScenario, selectionRunId,
      ruleSetRevisionId
    )
  FK(candidateId, selectionRunId, projectId, conversationId,
     requirementId, requirementVersionId, installationScenario,
     ruleSetRevisionId)
    -> SelectionCandidateResult(
      id, selectionRunId, projectId, conversationId,
      requirementId, requirementVersionId, installationScenario,
      ruleSetRevisionId
    )
  FK(specificationRevisionId, productRevisionId)
    -> SpecificationRevision(id, productRevisionId)
  FK(priceRevisionId, productRevisionId)
    -> PriceRevision(id, productRevisionId)

SalesSnapshotParameter
  snapshotItemId NOT NULL
  catalogParameterRevisionId NOT NULL
  parameterKey NOT NULL
  valueText NOT NULL
  valueType NOT NULL
  unit NULL
  sourceRevisionId NOT NULL
  UNIQUE(snapshotItemId, parameterKey)
  FK(snapshotItemId) -> SalesSnapshotCandidate(id)
  FK(catalogParameterRevisionId) -> CatalogParameterRevision(id)
  FK(catalogParameterRevisionId, sourceRevisionId)
    -> CatalogParameterRevision(id, sourceRevisionId)

SalesSnapshotPrice
  snapshotItemId NOT NULL
  priceRevisionId NOT NULL
  amountMinor NOT NULL
  currency NOT NULL
  taxBasis NOT NULL
  applicability NOT NULL
  UNIQUE(snapshotItemId)
  FK(snapshotItemId) -> SalesSnapshotCandidate(id)
  FK(priceRevisionId) -> PriceRevision(id)

SalesSnapshotSource
  snapshotItemId NOT NULL
  sourceRevisionId NOT NULL
  evidenceObjectId NOT NULL
  rawContentDigest NOT NULL
  UNIQUE(snapshotItemId, sourceRevisionId)
  FK(snapshotItemId) -> SalesSnapshotCandidate(id)
  FK(sourceRevisionId, rawContentDigest, evidenceObjectId)
    -> CatalogSourceRevision(id, rawContentDigest, evidenceObjectId)

SalesSnapshotCatalogReview
  snapshotItemId NOT NULL
  catalogReviewId NOT NULL
  decision NOT NULL
  reviewedAt NOT NULL
  UNIQUE(snapshotItemId, catalogReviewId)
  FK(snapshotItemId) -> SalesSnapshotCandidate(id)
  FK(catalogReviewId) -> CatalogReview(id)

SalesSnapshotProfessionalReview
  snapshotItemId NOT NULL
  professionalReviewId NOT NULL
  professionalReviewEventId NOT NULL
  policyRevisionId NOT NULL
  decision NOT NULL
  basisDigest NOT NULL
  UNIQUE(snapshotItemId, professionalReviewId)
  FK(snapshotItemId) -> SalesSnapshotCandidate(id)
  FK(professionalReviewId, basisDigest, policyRevisionId)
    -> ProfessionalReview(id, basisDigest, policyRevisionId)
  FK(professionalReviewEventId, professionalReviewId,
     basisDigest, policyRevisionId)
    -> ProfessionalReviewEvent(
      id, reviewId, basisDigest, policyRevisionId
    )

SalesSnapshotWarning
  snapshotItemId NOT NULL
  warningSequence NOT NULL
  warningCode NOT NULL
  warningText NOT NULL
  UNIQUE(snapshotItemId, warningSequence)
  FK(snapshotItemId) -> SalesSnapshotCandidate(id)
```

The snapshot creation function inserts all run candidates exactly once,
inserts these child rows from immutable sources, and validates copied values,
source identities, candidate membership and the `R3-BASIS-1` digest at
deferred COMMIT. No child row can be independently constructed from current
catalog state.

### 7.3 Snapshot authority

The normalized snapshot rows are the sole authority. There is no writable
payload column/table. `reconstruct_sales_handoff_payload` reads only those rows
and applies the approved JCS serializer. `basisDigest` is computed from the
normalized `R3-BASIS-1` bytes. The exact chain is:

```text
SalesHandoffCase
  -> Project
  -> RequirementVersion
  -> SelectionRun
  -> normalized Snapshot rows
  -> deterministic R3-BASIS-1 bytes
  -> basisDigest
```

Case/project/requirement/version/run keys, candidate completeness, source
copies and copy equality are checked at deferred COMMIT. Any mismatch rolls
back the snapshot and pointer update.

## 9. Advisor Idempotency

R3's conversation-scoped idempotency design is preserved:

```text
UNIQUE(actorUserId, conversationId, clientMessageId)
FK(projectId, conversationId) -> AdvisorConversation(projectId, id)
FK(userMessageId, conversationId) -> AdvisorMessage(id, conversationId)
FK(assistantMessageId, conversationId) -> AdvisorMessage(id, conversationId)
FK(requirementVersionId, projectId, conversationId)
  -> RequirementVersion(id, projectId, conversationId)
```

A successful request row is written with the complete business result in one
transaction. A deterministic replayable rejection uses a separate failure
recording transaction with no business mutation. Unexpected errors roll back
all records; COMMIT-unknown is resolved by a new-connection key read. A
same-key/different-request-digest is rejected.

## 10. Scenario and Legacy Mapping

The R3-approved scenario design is preserved:

- final `Project.installationScenario NOT NULL`;
- deterministic ProjectType mapping CHECK;
- expand/backfill/validate with writes frozen;
- unmappable history quarantined rather than guessed;
- scenario immutable after the first conversation;
- Project update and conversation creation acquire the same Project row lock;
- historical scenario FKs use `ON UPDATE RESTRICT`.

R3 did not design the existing `BuildingRequirement` JSON/version migration.
R3-C2 adds a required preflight table:

```text
LegacyRequirementMapping
  id
  legacyRequirementId
  sourceProjectId
  sourceConversationId NULL
  targetRequirementId NULL
  targetRequirementVersionId NULL
  mappingOutcome MAPPED | QUARANTINED
  reason
  createdAt
  UNIQUE(legacyRequirementId)
```

A row is mapped only when the project/conversation/scenario chain is
unambiguous and every JSON field can be mapped to a typed assertion/value.
Otherwise it remains read-only and quarantined. No JSON value may be silently
chosen or guessed.

## 11. Transactions and Failure Behavior

| Operation | Transaction boundary | Failure behavior |
|---|---|---|
| Requirement command | lock conversation + version CAS; typed values, assertions, source message, confirmation and project/conversation pointers commit together | full rollback; stale 409 |
| Requirement projection | generated from typed values inside the same transaction | generation failure aborts version commit |
| Catalog capture | archive write before DB metadata; DB insert after exact content identity exists | orphan archive retained; no source revision |
| RuleSet transition | lock revision; exact event/basis/policy check; event insert | one event; conflict/failure rolls back |
| Professional transition | lock review; latest event/CAS/basis check; event insert | one event; conflict/failure rolls back |
| Snapshot create | lock case; exact basis; normalized rows + deferred checks + pointer + audit | whole rollback; no pointer |
| Idempotent success | request/business/messages/version/queue in one transaction | complete rollback on unexpected error |
| Idempotent deterministic failure | independent failure row only | no business side effect |
| COMMIT unknown | new connection reads durable key/evidence | no guessed success or rollback |

No `UNKNOWN`, missing evidence, invalid source, stale review, invalid rules or
digest mismatch may produce `OPERATIONAL`.

## 12. Open Decisions and Boundaries

All R2 `OD-R2-01` through `OD-R2-20` remain open. All R3 `OD-R3-01` through
`OD-R3-09` remain open unless an equivalent is explicitly represented in the
R3-C2 decisions file. The C2 design does not choose:

- archive provider, legal retention, encryption or Legal Hold;
- raw versus canonical source review basis;
- professional reviewer qualification/separation;
- policy change continuity;
- snapshot retention/export;
- scenario legacy disposition;
- rule authority;
- price/tax/region policy;
- sales visibility;
- Demo identity;
- formal rollout.

Technical constraints in this document are not Open Decisions:

- exact composite keys and non-null ownership;
- typed values and source checks;
- event-only RuleSet/ProfessionalReview state;
- append-only event tables;
- exact snapshot source binding;
- deterministic R3-BASIS-1 encoding.

## 13. Implementation Phases

### A. Design-only foundations after review

- semantic typed-value fixtures;
- R3-BASIS-1 independent vectors;
- event transition fixtures;
- snapshot reconstruction fixtures;
- documentation and traceability.

### B. Decision-dependent

- archive provider and evidence basis;
- professional/workflow roles and policy continuity;
- scenario legacy disposition;
- rule authority;
- price and commercial scope;
- snapshot retention/export;
- sales visibility and Demo.

### C. Separately authorized high-risk implementation

- forward Prisma schema/migration;
- composite FKs, typed-value columns/checks, exclusions;
- event views/transition functions and append-only privileges;
- archive adapter;
- normalized snapshot tables and deferred checks;
- isolated DB constraints, trigger, concurrency and COMMIT-unknown tests.

### D. Never merged

- P1-3 upload/lifecycle/FileVersion;
- Native RPC/Helper Runtime;
- production Build Gate/deployment;
- real customer/storage data;
- real AI provider.

## 14. Acceptance Conditions

```text
Six C2 P1 corrections represented: REQUIRED
All referenced composite keys physically declared: REQUIRED
Typed assertion/value fields complete: REQUIRED
RuleSet status event-derived: REQUIRED
ProfessionalReview current state event-derived: REQUIRED
R3-BASIS-1 complete and independently implementable: REQUIRED
At least 20 fixed vectors with bytes/hash: REQUIRED
Snapshot source assertion exact-bound: REQUIRED
Open Decisions retained: REQUIRED
P1-3 separated: REQUIRED
Independent R3-C2 review: PENDING
Implementation: NOT AUTHORIZED
Database/Runtime: NOT VERIFIED
```
