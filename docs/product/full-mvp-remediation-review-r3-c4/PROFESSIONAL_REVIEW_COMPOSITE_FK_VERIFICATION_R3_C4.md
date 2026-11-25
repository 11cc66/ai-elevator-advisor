# ProfessionalReview Composite FK Verification R3-C4

Date: 2026-11-24

Result:

```text
PROFESSIONAL_REVIEW_COMPOSITE_FK: PASS
REV-R3-C3-P1-01: RESOLVED
DATABASE BEHAVIOR: NOT VERIFIED — DATABASE NOT ACCESSED
```

## 1. Parent Key

`ProfessionalReview` declares:

```text
UNIQUE(
  id,
  project_id,
  conversation_id,
  requirement_id,
  requirement_version_id,
  installation_scenario
)
```

All columns exist and are `NOT NULL`. This is a table UNIQUE constraint, not a
partial or expression index.

## 2. Event-to-Review FK

```text
Event(review_id, project_id, conversation_id, requirement_id,
      requirement_version_id, installation_scenario)
→ Review(id, project_id, conversation_id, requirement_id,
         requirement_version_id, installation_scenario)
```

The parent and child sets have the same six columns in the same semantic order.
Wrong Review, Project, Conversation, Requirement, Version or Scenario produces
no matching parent tuple under ordinary PostgreSQL FK semantics.

## 3. Event Parent Key

`ProfessionalReviewEvent` declares the exact six-column UNIQUE:

```text
(id, project_id, conversation_id, requirement_id,
 requirement_version_id, installation_scenario)
```

## 4. FieldValue-to-Event FK

```text
FieldValue(source_professional_review_event_id, project_id,
           conversation_id, requirement_id,
           requirement_version_id, installation_scenario)
→ Event(id, project_id, conversation_id, requirement_id,
        requirement_version_id, installation_scenario)
```

This is an exact match. No seven-column parent key is used as if it were six.

## 5. NULL Semantics

- The five ownership columns in the FieldValue child are `NOT NULL`.
- `source_professional_review_event_id` is nullable because other source kinds
  use other typed source FKs.
- The retained C3 source-kind CHECK requires that ID to be non-null when
  `sourceKind='PROFESSIONAL_REVIEW'`, so PostgreSQL `MATCH SIMPLE` cannot be
  used to bypass the professional source relation.
- The C4 document restates this rule at lines 146–148 but its abbreviated DDL
  snippet does not print the complete CHECK. The eventual migration must print
  and test it.

## 6. Adversarial Matrix

| Case | Static result |
|---|---|
| FK-01 wrong Project | Reject |
| FK-02 wrong Conversation | Reject |
| FK-03 wrong Requirement | Reject |
| FK-04 wrong RequirementVersion | Reject |
| FK-05 wrong installationScenario | Reject |
| FK-06 REVIEW_ID points to another Review | Reject through Event-to-Review FK |
| FK-07 source Event ID NULL while source kind professional | Reject if retained CHECK is implemented as specified |
| FK-08 FieldValue ownership mismatch | Reject |
| FK-09 Assertion ownership mismatch | Uses the same retained C3 exact key; must be introspected after DDL |
| FK-10 Event UPDATE | Requires append-only trigger/privilege; not verified |
| FK-11 Event DELETE | Requires append-only trigger/privilege; not verified |
| FK-12 Event TRUNCATE | Triggers cannot cover TRUNCATE; privilege/owner controls required |

## 7. Residual P2

The Event policy column has no FK to the policy revision, and:

```text
CONSTRAINT professional_review_event_policy_matches_review
  CHECK (policy_revision_id IS NOT NULL)
```

does not compare the Event policy with the Review policy. The prose replaces
the database invariant with an unspecified “deferred trigger or transition
function.” It must be made concrete before implementation.

## 8. Evidence Boundary

This is a static DDL comparison. No database was connected and no FK was
created. Runtime PostgreSQL behavior remains `NOT VERIFIED`.

