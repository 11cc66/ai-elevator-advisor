# Policy Revision Lifecycle R3-C6

## 1. Policy Revision

```sql
CREATE TABLE app.policy_revision (
  id text PRIMARY KEY,
  policy_kind text NOT NULL,
  content jsonb NOT NULL,
  content_digest text NOT NULL,
  created_by_principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  created_at timestamptz(6) NOT NULL,
  UNIQUE (policy_kind, content_digest)
);
```

`content_digest` is computed from a canonical read-only representation. The
content and digest are immutable.

## 2. Policy Review Event

```sql
CREATE TABLE app.policy_review_event (
  id text PRIMARY KEY,
  policy_revision_id text NOT NULL REFERENCES app.policy_revision(id),
  event_sequence bigint NOT NULL,
  resulting_state_version bigint NOT NULL,
  previous_state text,
  new_state text NOT NULL,
  actor_principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  actor_authority_grant_id text NOT NULL REFERENCES app.authority_grant(id),
  request_id text NOT NULL,
  request_hash text NOT NULL,
  decision text,
  reason text,
  occurred_at timestamptz(6) NOT NULL,
  UNIQUE (policy_revision_id,event_sequence),
  UNIQUE (policy_revision_id,resulting_state_version),
  UNIQUE (policy_revision_id,request_id),
  CHECK (new_state IN ('DRAFT','IN_REVIEW','APPROVED','REJECTED',
                       'INVALIDATED','EXPIRED','SUPERSEDED'))
);
```

Events are insert-only for the transition-owner functions. Direct runtime DML is
revoked.

## 3. State Matrix

| Current | Command | Authority | Next |
|---|---|---|---|
| none | CREATE | POLICY_AUTHOR | DRAFT |
| DRAFT | SUBMIT | POLICY_AUTHOR | IN_REVIEW |
| IN_REVIEW | APPROVE | POLICY_APPROVER | APPROVED |
| IN_REVIEW | REJECT | POLICY_APPROVER | REJECTED |
| APPROVED | INVALIDATE | POLICY_SECURITY_ADMIN | INVALIDATED |
| APPROVED | EXPIRE | POLICY_LIFECYCLE | EXPIRED |
| APPROVED | SUPERSEDE | POLICY_APPROVER | SUPERSEDED |

The author principal cannot approve its own revision.

## 4. Current Effective Policy

A view/function derives the latest event:

```text
latest event by (policy_revision_id,event_sequence DESC)
effective only when new_state='APPROVED'
and no subsequent INVALIDATED/EXPIRED/SUPERSEDED event
```

Unique constraints ensure one event per sequence/state version/request.

## 5. Immutable Approval Evidence

An APPROVED event contains:

- exact policy revision ID and content digest;
- actor principal;
- concrete authority grant;
- immutable event ID/sequence;
- timestamp;
- request hash.

No mutable `approved boolean` is authoritative.

## 6. Revocation/Supersession

These are new append-only events. The original APPROVED event remains immutable.
ProfessionalReview references the exact policy revision; it cannot silently
switch policy.

