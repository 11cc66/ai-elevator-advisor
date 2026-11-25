# Policy Effective and Audit View DDL R3-C7

Artifact: `POLICY_EFFECTIVE_VIEW_AND_AUDIT_VIEW_DDL_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

Authoritative DDL: `DATABASE_COMPLETE_DDL_R3_C7.sql`.

## 1. Current Policy View

`app.current_policy_revision_v` is:

- `security_barrier=true`;
- `security_invoker=false`;
- owned by `elevator_review_function_owner`;
- sourced from the current pointer, exact current Event and Revision;
- visible only when current state is APPROVED;
- void when any later event exists on the same revision;
- filtered by active TrustedSession, current epoch, unexpired session and
  `POLICY_READ` authority scoped to the policy project.

It does not return the latest REJECTED/INVALIDATED/EXPIRED state as effective.

## 2. Policy Audit View

`audit_policy_events_v` returns immutable event sequence, state/version,
previous/next state, actor, concrete grant, request ID/hash, evidence reference
and timestamp.

It requires an active Session/Epoch and `POLICY_AUDIT` authority for the policy
scope. Actor principal IDs are audit data; assertion digest and session
credentials are not exposed.

## 3. Other Required Views

| View | Primary scope | Required capability |
|---|---|---|
| `current_sales_snapshot_v` | FINALIZED Snapshot/project | `SNAPSHOT_READ` |
| `current_professional_review_v` | latest review event/project | `REVIEW_READ` |
| `audit_professional_review_events_v` | event ledger/project | `REVIEW_AUDIT` |
| `trusted_session_status_v` | session lifecycle | `SESSION_AUDIT` |
| `authority_grant_v` | grants | `AUTHORITY_AUDIT` |
| `selection_result_read_v` | sealed/unsealed result visibility per role | `SELECTION_READ` |

Every project-bearing view includes the project capability predicate.

## 4. Access Rules

Runtime Web/Worker receive SELECT on approved current/read views. Auditor
receives the audit views. There is no base-table SELECT for those roles.

Revoked, expired or epoch-stale sessions are excluded by the view predicate.
Because views are `security_definer` by owner semantics, direct base-table
access is revoked and the owner remains a non-login role.

## 5. PostgreSQL Semantics

Official reference checked read-only:

```text
PostgreSQL 18 — CREATE VIEW
PostgreSQL 18 — GRANT
```

The SQL is a design draft; actual owner/ACL behavior remains
`NOT VERIFIED — DATABASE NOT AUTHORIZED`.
