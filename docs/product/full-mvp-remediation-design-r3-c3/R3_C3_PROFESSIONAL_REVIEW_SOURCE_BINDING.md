# R3-C3 Professional Review Source Binding

## 1. Invariant

For every `RequirementFieldValue` whose `sourceKind` is
`PROFESSIONAL_REVIEW`:

```text
FieldValue.projectId
= ProfessionalReviewEvent.projectId

FieldValue.conversationId
= ProfessionalReviewEvent.conversationId

FieldValue.requirementId
= ProfessionalReviewEvent.requirementId

FieldValue.requirementVersionId
= ProfessionalReviewEvent.requirementVersionId

FieldValue.installationScenario
= ProfessionalReviewEvent.installationScenario
```

The source event must also belong to the exact `ProfessionalReview` header,
policy revision and review basis.

## 2. Required Keys

```text
ProfessionalReview
  id TEXT PRIMARY KEY
  projectId TEXT NOT NULL
  conversationId TEXT NOT NULL
  requirementId TEXT NOT NULL
  requirementVersionId TEXT NOT NULL
  installationScenario TEXT NOT NULL
  candidateId TEXT NOT NULL
  selectionRunId TEXT NOT NULL
  ruleSetRevisionId TEXT NOT NULL
  policyRevisionId TEXT NOT NULL
  attemptNumber INTEGER NOT NULL
  basisDigest TEXT NOT NULL
  UNIQUE(
    id, projectId, conversationId, requirementId,
    requirementVersionId, installationScenario
  )
  UNIQUE(candidateId, policyRevisionId, attemptNumber)
  FK(candidateId, selectionRunId, projectId, conversationId,
     requirementId, requirementVersionId, installationScenario,
     ruleSetRevisionId)
    -> SelectionCandidateResult(
      id, selectionRunId, projectId, conversationId,
      requirementId, requirementVersionId, installationScenario,
      ruleSetRevisionId
    )
  FK(policyRevisionId) -> ProfessionalReviewPolicyRevision(id)

ProfessionalReviewEvent
  id TEXT PRIMARY KEY
  reviewId TEXT NOT NULL
  projectId TEXT NOT NULL
  conversationId TEXT NOT NULL
  requirementId TEXT NOT NULL
  requirementVersionId TEXT NOT NULL
  installationScenario TEXT NOT NULL
  eventSequence INTEGER NOT NULL
  resultingStateVersion INTEGER NOT NULL
  previousState TEXT NULL
  newState TEXT NOT NULL
  actorUserId TEXT NOT NULL
  actorAuthorityId TEXT NOT NULL
  decision TEXT NULL
  reason TEXT NULL
  occurredAt TIMESTAMPTZ(6) NOT NULL
  basisDigest TEXT NOT NULL
  policyRevisionId TEXT NOT NULL
  requestId TEXT NOT NULL
  UNIQUE(reviewId, eventSequence)
  UNIQUE(reviewId, resultingStateVersion)
  UNIQUE(reviewId, requestId)
  UNIQUE(
    id, reviewId, projectId, conversationId, requirementId,
    requirementVersionId, installationScenario
  )
  FK(reviewId, projectId, conversationId, requirementId,
     requirementVersionId, installationScenario)
    -> ProfessionalReview(
      id, projectId, conversationId, requirementId,
      requirementVersionId, installationScenario
    )
  FK(actorUserId) -> User(id)
```

FieldValue source FK:

```text
RequirementFieldValue
  sourceProfessionalReviewEventId TEXT NULL
  projectId TEXT NOT NULL
  conversationId TEXT NOT NULL
  requirementId TEXT NOT NULL
  requirementVersionId TEXT NOT NULL
  installationScenario TEXT NOT NULL
  FK(
    sourceProfessionalReviewEventId, projectId, conversationId,
    requirementId, requirementVersionId, installationScenario
  ) -> ProfessionalReviewEvent(
    id, projectId, conversationId, requirementId,
    requirementVersionId, installationScenario
  )
  CHECK sourceKind = 'PROFESSIONAL_REVIEW'
        implies sourceProfessionalReviewEventId IS NOT NULL
  CHECK sourceKind <> 'PROFESSIONAL_REVIEW'
        implies sourceProfessionalReviewEventId IS NULL
```

This is a six-column ownership FK; an event ID lookup by itself is not
sufficient.

## 3. Snapshot Inheritance

`SalesSnapshotRequirementField` references:

```text
(sourceFieldValueId, requirementVersionId, requirementId, projectId,
 conversationId, installationScenario, sourceKind, sourceKey)
```

The FieldValue parent key includes the exact professional event source key:

```text
sourceKey = 'professional-event:' || sourceProfessionalReviewEventId
```

Therefore a Snapshot cannot copy a FieldValue but substitute another event.
The snapshot source kind/key is immutable and validated at deferred COMMIT.

## 4. Event Authority

There is no mutable `ProfessionalReview.state` or `stateVersion` authority.
The current event is selected by:

```text
ORDER BY eventSequence DESC
```

The transition function:

1. locks the review header;
2. reads the latest event;
3. validates `expectedStateVersion` and allowed predecessor;
4. verifies exact candidate/requirement/version/rule/policy/source basis;
5. inserts exactly one event;
6. commits.

Events are append-only. Direct event DML is denied to ordinary roles. Function
owner, fixed `search_path`, execute grants and policy-authoring rights are
approved under `OD-R3-C2-03`; these are security decisions, not optional
application conventions.

## 5. Invalidation

RequirementVersion, SelectionRun, RuleSetRevision, CatalogRevision,
SourceRevision or PolicyRevision change creates a new basis. An old event
remains historical but cannot be selected as current for the new basis.
Withdrawal, evidence failure or policy incompatibility produces a new
`INVALIDATED` or `EXPIRED` event in the same controlled transition path.

## 6. Negative Tests

- FieldValue Requirement A points to Requirement B event;
- FieldValue Version A points to Version B event;
- Event ID exists but belongs to another ProfessionalReview;
- Event has wrong project/conversation/scenario;
- ProfessionalReview policy differs from event policy;
- Event `previousState` does not equal the prior event state;
- duplicate event sequence or concurrent approve;
- direct deletion/update of an event;
- Snapshot FieldValue/sourceKey mismatch.

Every case must fail at the database/deferred-commit boundary, not only at an
API `if`.
