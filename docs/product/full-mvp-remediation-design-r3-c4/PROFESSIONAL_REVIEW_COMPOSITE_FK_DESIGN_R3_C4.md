# ProfessionalReview Composite FK Design R3-C4

## 1. Selected Option

R3-C4 selects Option A: retain the seven-column Review/Event relationship and
add the exact six-column Event key required by FieldValue/Assertion/ Snapshot.

```text
Review ownership:
  Project -> Conversation -> Requirement -> RequirementVersion

Event ownership:
  ProfessionalReviewEvent
    -> ProfessionalReview (six-column owner key)
    -> RequirementVersion (through Review)

FieldValue source:
  RequirementFieldValue
    -> ProfessionalReviewEvent (six-column source key)
```

No FK is by Event ID alone.

## 2. DDL Design

```sql
CREATE TABLE professional_review (
  id text PRIMARY KEY,
  project_id text NOT NULL,
  conversation_id text NOT NULL,
  requirement_id text NOT NULL,
  requirement_version_id text NOT NULL,
  installation_scenario text NOT NULL,
  candidate_id text NOT NULL,
  selection_run_id text NOT NULL,
  rule_set_revision_id text NOT NULL,
  policy_revision_id text NOT NULL,
  attempt_number integer NOT NULL,
  basis_digest text NOT NULL,
  created_by_user_id text NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  created_at timestamptz(6) NOT NULL,
  CONSTRAINT professional_review_owner_key UNIQUE (
    id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario
  ),
  CONSTRAINT professional_review_attempt_key UNIQUE (
    candidate_id, policy_revision_id, attempt_number
  ),
  CONSTRAINT professional_review_candidate_fk FOREIGN KEY (
    candidate_id, selection_run_id, project_id, conversation_id,
    requirement_id, requirement_version_id, installation_scenario,
    rule_set_revision_id
  ) REFERENCES selection_candidate_result (
    id, selection_run_id, project_id, conversation_id,
    requirement_id, requirement_version_id, installation_scenario,
    rule_set_revision_id
  ) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT professional_review_policy_fk
    FOREIGN KEY (policy_revision_id)
    REFERENCES professional_review_policy_revision(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE professional_review_event (
  id text PRIMARY KEY,
  review_id text NOT NULL,
  project_id text NOT NULL,
  conversation_id text NOT NULL,
  requirement_id text NOT NULL,
  requirement_version_id text NOT NULL,
  installation_scenario text NOT NULL,
  event_sequence integer NOT NULL,
  resulting_state_version integer NOT NULL,
  previous_state text,
  new_state text NOT NULL,
  actor_user_id text NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  actor_authority_id text NOT NULL,
  decision text,
  reason text,
  occurred_at timestamptz(6) NOT NULL,
  basis_digest text NOT NULL,
  policy_revision_id text NOT NULL,
  request_id text NOT NULL,
  CONSTRAINT professional_review_event_owner_key UNIQUE (
    id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario
  ),
  CONSTRAINT professional_review_event_sequence_key
    UNIQUE (review_id, event_sequence),
  CONSTRAINT professional_review_event_state_version_key
    UNIQUE (review_id, resulting_state_version),
  CONSTRAINT professional_review_event_request_key
    UNIQUE (review_id, request_id),
  CONSTRAINT professional_review_event_review_fk FOREIGN KEY (
    review_id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario
  ) REFERENCES professional_review (
    id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario
  ) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT professional_review_event_policy_matches_review
    CHECK (policy_revision_id IS NOT NULL),
  CONSTRAINT professional_review_event_decision_check
    CHECK (
      new_state NOT IN ('APPROVED','REJECTED','RETURNED_FOR_INFORMATION')
      OR decision IS NOT NULL
    )
);

CREATE TABLE requirement_field_value (
  -- all C3 typed/ownership columns,
  source_professional_review_event_id text,
  project_id text NOT NULL,
  conversation_id text NOT NULL,
  requirement_id text NOT NULL,
  requirement_version_id text NOT NULL,
  installation_scenario text NOT NULL,
  CONSTRAINT requirement_field_value_pr_event_fk FOREIGN KEY (
    source_professional_review_event_id,
    project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario
  ) REFERENCES professional_review_event (
    id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario
  ) ON DELETE RESTRICT ON UPDATE RESTRICT
);
```

The final column sets are:

```text
Event parent unique:
  (id, project_id, conversation_id, requirement_id,
   requirement_version_id, installation_scenario)

FieldValue child FK:
  (source_professional_review_event_id,
   project_id, conversation_id, requirement_id,
   requirement_version_id, installation_scenario)

Exact match: YES
```

## 3. NULL and Event Rules

- All six source columns are NOT NULL when `sourceKind='PROFESSIONAL_REVIEW'`.
- When source kind is not professional review, the event ID is NULL and the
  other source columns remain governed by their own source-kind FK.
- Event `previous_state` is NULL only for the first `CREATED` event.
- Event `policy_revision_id` must equal the Review's policy revision; use a
  deferred trigger or transition function to enforce this across tables.
- Event append-only trigger rejects UPDATE, DELETE and TRUNCATE by ordinary
  roles.
- Event parent deletes are restricted.

## 4. Snapshot Inheritance

Snapshot Requirement Field references:

```text
(source_field_value_id, requirement_version_id, requirement_id, project_id,
 conversation_id, installation_scenario, source_kind, source_entity_type,
 source_entity_id, source_aux_id, source_key)
```

The FieldValue parent key includes the exact professional event source. A
Snapshot cannot replace the event or source kind.

## 5. Required Tests

1. Event `reviewId` refers to another Review.
2. Event project/conversation/requirement/version/scenario mismatch.
3. FieldValue points to an Event in another Requirement/Version.
4. Any source FK component is NULL when professional source is selected.
5. Event parent delete/update.
6. Event UPDATE/DELETE/TRUNCATE.
7. Duplicate event sequence/state version/request.
8. Concurrent approve/revoke.
9. Snapshot sourceKey/FieldValue mismatch.
10. Greenfield FK creation and exact unique introspection.

## 6. Result

```text
ProfessionalReview source relation: DESIGNED
Exact parent/child column sets: CLOSED
Implementation authorization: NOT GRANTED
```
