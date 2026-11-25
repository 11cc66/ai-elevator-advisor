# Trusted Principal, Authority and Transition Design R2

Status:

```text
SECURITY DESIGN
NOT IMPLEMENTED
DEPLOYMENT IDENTITY BROKER: OPEN DECISION
```

## 1. Trust Decision

The transition function must not accept actor identity or target state from the
caller. R3-C5 chooses an identity-bound database session:

```text
authenticated business principal
  -> trusted identity broker
  -> dedicated PostgreSQL login role for that principal/session class
  -> transition function uses session_user
  -> active TrustedPrincipal row maps role to app_user
  -> active AuthorityGrant is checked
  -> closed command matrix derives next state
  -> append-only event
```

A shared runtime database role plus caller-provided `app.actor_id`,
`current_user`, or `session_user` alone is not sufficient and is rejected for
review transitions.

## 2. Session Identity

Required deployment properties:

1. The user authenticates through the approved application identity provider.
2. A trusted identity broker authenticates the database session or selects a
   principal-bound login role after successful user authentication.
3. The login role name is unique to the principal session class.
4. The runtime pool must not reuse a principal-bound connection for another
   user. Cross-user pooled connections are prohibited.
5. The identity assertion/credential has expiry and revocation.
6. The broker prevents replay and binds assertions to audience and session.
7. Runtime principal roles are `NOINHERIT`, have no `SET ROLE` path to
   schema/function owner, and cannot be members of migrator/owner roles.
8. The function derives `session_user`; `current_user` is the SECURITY DEFINER
   owner and is not the actor.

Exact broker product, certificate/credential mechanism, connection lifecycle,
and HA behavior remain `OD-R3-C5-01`. Until approved, transition implementation
is blocked.

## 3. Principal Tables

```sql
CREATE TABLE app.trusted_principal (
  id text PRIMARY KEY,
  app_user_id text NOT NULL REFERENCES app.app_user(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  auth_subject text NOT NULL,
  db_login_role text NOT NULL UNIQUE,
  state text NOT NULL CHECK (state IN ('ACTIVE','REVOKED')),
  valid_from timestamptz(6) NOT NULL,
  valid_until timestamptz(6),
  revoked_at timestamptz(6),
  revoked_by_principal_id text,
  revocation_reason text,
  CONSTRAINT trusted_principal_state_chk CHECK (
    (state='ACTIVE' AND revoked_at IS NULL)
    OR (state='REVOKED' AND revoked_at IS NOT NULL)
  )
);

CREATE TABLE app.authority_grant (
  id text PRIMARY KEY,
  principal_id text NOT NULL REFERENCES app.trusted_principal(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  authority_code text NOT NULL,
  project_id text,
  scope_object_type text,
  scope_object_id text,
  policy_revision_id text,
  valid_from timestamptz(6) NOT NULL,
  valid_until timestamptz(6),
  revoked_at timestamptz(6),
  issued_by_principal_id text NOT NULL,
  evidence_ref text NOT NULL,
  CONSTRAINT authority_grant_active_chk
    CHECK (revoked_at IS NULL AND valid_until > valid_from)
);
```

Authority grants are append-only. Revocation inserts a new immutable grant
status event or sets a controlled revocation timestamp through a privileged
function; direct runtime UPDATE is denied.

## 4. Function Inputs

```sql
CREATE TYPE app.professional_review_command AS ENUM (
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'RETURN',
  'RESUBMIT',
  'INVALIDATE',
  'EXPIRE'
);

CREATE FUNCTION app.transition_professional_review(
  p_review_id text,
  p_expected_sequence integer,
  p_command app.professional_review_command,
  p_expected_policy_revision_id text,
  p_basis_digest text,
  p_request_id text,
  p_reason text
) RETURNS TABLE (
  event_id text,
  event_sequence integer,
  resulting_state text,
  replay boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app, app_private
AS $$ BEGIN ... END; $$;
```

No `actor_id`, `authority_id`, or `new_state` parameter exists. The function
derives all three from trusted stored state.

`p_expected_policy_revision_id` may be caller-supplied only as a CAS expectation.
It must equal the immutable Review/Policy binding; it cannot select another
policy.

## 5. Principal Resolution

Inside the function:

```text
session_role   = session_user
principal      = trusted_principal WHERE db_login_role = session_user
actor_user_id  = principal.app_user_id
```

Reject if:

- no row exists;
- principal is revoked;
- current time is outside validity;
- role membership or session routing does not match the active principal;
- the caller attempts to use a shared runtime role.

The SECURITY DEFINER owner is not considered the actor.

## 6. Authority Resolution

For the command/current state, the function selects an active grant satisfying:

```text
grant.principal_id = trusted principal
grant.authority_code = required authority
grant.project_id IS NULL OR grant.project_id = review.project_id
grant.scope object matches review candidate/conversation/requirement
grant.policy_revision_id = review.policy_revision_id, when required
now within validity and not revoked
```

The exact `authority_grant_id` is stored in the Event. The function stores no
free-form authority claimed by the caller.

## 7. Closed Transition Matrix

Current state is read from the latest immutable event under Review row lock.

| Current State | Command | Required Authority | Additional Preconditions | Next State |
|---|---|---|---|---|
| `CREATED` | `SUBMIT` | `REVIEW_SUBMITTER` | exact basis, active policy | `IN_REVIEW` |
| `IN_REVIEW` | `APPROVE` | `PROFESSIONAL_APPROVER` | not author; active policy; complete evidence | `APPROVED` |
| `IN_REVIEW` | `REJECT` | `PROFESSIONAL_APPROVER` | reason required; not author | `REJECTED` |
| `IN_REVIEW` | `RETURN` | `PROFESSIONAL_APPROVER` | reason required | `RETURNED_FOR_INFORMATION` |
| `RETURNED_FOR_INFORMATION` | `RESUBMIT` | `REVIEW_SUBMITTER` | new basis/evidence required | `IN_REVIEW` |
| `CREATED` | `INVALIDATE` | `REVIEW_INVALIDATOR` | invalidation reason | `INVALIDATED` |
| `IN_REVIEW` | `INVALIDATE` | `REVIEW_INVALIDATOR` | invalidation reason | `INVALIDATED` |
| `RETURNED_FOR_INFORMATION` | `INVALIDATE` | `REVIEW_INVALIDATOR` | invalidation reason | `INVALIDATED` |
| `APPROVED` | `INVALIDATE` | `REVIEW_SECURITY_ADMIN` | source/policy/evidence mismatch | `INVALIDATED` |
| `IN_REVIEW` | `EXPIRE` | `POLICY_LIFECYCLE` | policy validity ended | `EXPIRED` |
| `APPROVED` | `EXPIRE` | `POLICY_LIFECYCLE` | policy validity ended | `EXPIRED` |

All other `(state,command)` pairs are rejected. `REJECTED`, `INVALIDATED` and
`EXPIRED` are terminal for that Review instance; a new review requires a new
Review row and event sequence.

## 8. Review/Policy Separation

- `professional_review.created_by_principal_id` is immutable.
- The principal that created the review cannot execute `APPROVE`.
- A policy author cannot approve their own Policy Revision.
- A Policy Revision becomes effective only from an immutable PolicyReviewEvent
  whose actor is a different active principal and holds the required authority.
- `professional_review.policy_revision_id` is immutable.
- Event policy equality is enforced by:

```text
ProfessionalReview UNIQUE(
  id, policy_revision_id, project_id, conversation_id,
  requirement_id, requirement_version_id, installation_scenario)

ProfessionalReviewEvent FK(
  review_id, policy_revision_id, project_id, conversation_id,
  requirement_id, requirement_version_id, installation_scenario)
```

The original six-column Event owner key remains unchanged for FieldValue and
Snapshot source FKs.

## 9. Event Schema Changes

Add/replace:

```text
professional_review.created_by_principal_id text NOT NULL
  -> trusted_principal(id)

professional_review UNIQUE(
  id, policy_revision_id, project_id, conversation_id,
  requirement_id, requirement_version_id, installation_scenario)

actor_principal_id text NOT NULL
actor_authority_grant_id text NOT NULL
command app.professional_review_command NOT NULL
request_hash text NOT NULL
```

Remove trusted use of caller-supplied:

```text
actor_user_id
actor_authority_id
new_state
```

`actor_user_id` may remain as the immutable derived display value with a FK to
the principal mapping, but the function obtains it from TrustedPrincipal.

Foreign keys:

```text
actor_principal_id -> trusted_principal(id)
actor_authority_grant_id -> authority_grant(id)
policy_revision_id -> policy_revision(id)
```

## 10. Concurrency and Replay

Transaction:

1. validate session_user and principal;
2. lock Review row `FOR UPDATE`;
3. read latest Event;
4. verify expected sequence/state;
5. verify exact policy and basis;
6. resolve authority;
7. compute canonical request hash;
8. if `(review_id,request_id)` exists:
   - same request hash -> return prior result with `replay=true`;
   - different hash -> conflict;
9. derive next state from matrix;
10. insert one Event with sequence/state-version/request;
11. commit.

Unique constraints:

```text
(review_id,event_sequence)
(review_id,resulting_state_version)
(review_id,request_id)
```

Concurrent commands lock the same Review row. Exactly one wins; the other must
re-read and re-evaluate or receive a stable conflict. `40001`/`40P01` retries are
bounded and re-run the full identity/authority/policy check.

## 11. Failure Behavior

- Invalid session/principal -> authorization failure, no Event.
- No/expired/revoked authority -> authorization failure, no Event.
- Undefined transition -> conflict, no Event.
- Self-approval -> authorization failure, no Event.
- Policy mismatch/expired -> conflict or authorization failure, no Event.
- Duplicate request/same hash -> existing Event, `replay=true`.
- Duplicate request/different hash -> conflict, no new Event.
- Event insert failure -> rollback.
- Commit unknown -> re-read by request ID and Review sequence.

## 12. Required Tests

- Reviewer A cannot claim Reviewer B's actor ID.
- Reviewer A cannot use Authority B.
- Expired/revoked authority fails.
- Undefined transition fails.
- Self-approval fails even with authority.
- Policy author self-approval fails.
- Stale policy ID fails.
- Replay returns one Event.
- Replay with changed payload conflicts.
- Concurrent approvals produce one Event.
- Shared/legacy runtime role is rejected.
- Owner/migrator session is rejected as business actor unless a separately
  approved break-glass procedure exists.

## 13. Open Decisions

`OD-R3-C5-01` — Identity broker, per-principal login mechanism, assertion
format, audience, expiry, replay cache and connection-pool design.

`OD-R3-C5-04` — Exact reviewer/approver policy and whether dual review is
mandatory for a scenario.

No identity mechanism is claimed operational until separately approved and
tested.

