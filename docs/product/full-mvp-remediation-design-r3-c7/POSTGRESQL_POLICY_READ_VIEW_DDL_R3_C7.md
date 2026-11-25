# PostgreSQL Policy Read View DDL R3-C7

Artifact: `POSTGRESQL_POLICY_READ_VIEW_DDL_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. Complete DDL

The authoritative View DDL is in:

```text
DATABASE_COMPLETE_DDL_R3_C7.sql
```

It includes:

- `current_policy_revision_v`;
- `audit_policy_events_v`;
- `current_sales_snapshot_v`;
- `current_professional_review_v`;
- `audit_professional_review_events_v`;
- `trusted_session_status_v`;
- `authority_grant_v`;
- `selection_result_read_v`.

No View is represented only by a name or placeholder.

## 2. Effective Policy Predicate

`current_policy_revision_v` requires all of:

- `policy_current.state='APPROVED'`;
- current pointer revision and Event IDs resolve;
- Event belongs to that Revision and has `next_state='APPROVED'`;
- no later event exists on that Revision;
- current caller has active Session/Epoch;
- Session is unexpired and not revoked;
- `POLICY_READ` AuthorityGrant covers project scope.

Latest REJECTED, INVALIDATED or EXPIRED events cannot appear as effective.

## 3. Audit Policy View

`audit_policy_events_v` exposes immutable event history but requires
`POLICY_AUDIT` authority for the policy project. It does not expose assertion
digest, DB credential or other session secrets.

## 4. Session and Authority Views

`trusted_session_status_v` hides `db_auth_role` and assertion material. It
requires `SESSION_AUDIT`.

`authority_grant_v` requires `AUTHORITY_AUDIT` and shows grant scope/validity,
not credentials.

## 5. Runtime and Auditor Grants

- Web/Worker: SELECT current policy/snapshot/review/selection read views only.
- Auditor: SELECT current and audit views.
- Reporting: SELECT current non-sensitive views.
- No runtime base-table SELECT.
- No sequence privilege.
- No TRIGGER or REFERENCES privilege.

## 6. PostgreSQL Behavior

All Views are defined with:

```sql
WITH (security_barrier=true,security_invoker=false)
```

and owned by a non-login review-function owner. Base-table ACLs are revoked
from runtime roles. Actual View ACL and execution remain `NOT VERIFIED`.
