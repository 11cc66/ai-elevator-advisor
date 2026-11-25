# ProfessionalReview Composite FK Verification

Date: 2026-11-24

## Intended Chain

```text
Project
  -> Conversation
  -> Requirement
  -> RequirementVersion
  -> ProfessionalReview
  -> ProfessionalReviewEvent
  -> RequirementFieldValue
  -> SalesSnapshotRequirementField
```

The intended C3 invariant is that a professional-review FieldValue source
belongs to the same Project, Conversation, Requirement, RequirementVersion and
installationScenario as the event.

## Independent Key Check

`R3_C3_PROFESSIONAL_REVIEW_SOURCE_BINDING.md` declares:

```text
ProfessionalReviewEvent UNIQUE(
  id,
  reviewId,
  projectId,
  conversationId,
  requirementId,
  requirementVersionId,
  installationScenario
)
```

The FieldValue source FK references:

```text
(
  sourceProfessionalReviewEventId,
  projectId,
  conversationId,
  requirementId,
  requirementVersionId,
  installationScenario
)
```

The parent key contains an additional `reviewId`; the child key does not.
There is no exact parent UNIQUE for the six-column FK.

## Failure

On an empty isolated clone, creating the FK must fail with a PostgreSQL
missing-unique-key error. A fallback FK on `sourceProfessionalReviewEventId`
alone would reopen the cross-Requirement/cross-Version source bug.

## Required Repair

Use one exact form:

```text
A:
  Event UNIQUE(id, projectId, conversationId, requirementId,
               requirementVersionId, installationScenario)
  FieldValue FK on those six columns

B:
  Event UNIQUE(id, reviewId, projectId, conversationId, requirementId,
               requirementVersionId, installationScenario)
  FieldValue stores reviewId and its FK includes all seven columns
```

Apply the same exact match to Assertion professional source and Snapshot
inheritance.

## Verification Conditions

- greenfield migration succeeds;
- event ID from another requirement fails the FK;
- event ID from another version fails the FK;
- event ID with wrong project/conversation/scenario fails the FK;
- event with wrong review parent fails the FK;
- Snapshot sourceKey cannot bypass the exact source relation.

## Result

```text
CORRECTION REQUIRED
```
