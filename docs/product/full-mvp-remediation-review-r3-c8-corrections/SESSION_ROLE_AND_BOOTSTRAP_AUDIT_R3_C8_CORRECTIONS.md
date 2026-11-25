# Session Role and Bootstrap Audit

## Role Closure

The correction adds:

```text
LOGIN / SUPERUSER / CREATEDB / CREATEROLE / REPLICATION /
BYPASSRLS / INHERIT / CONNECTION LIMIT
```

checks, direct CONNECT, recursive membership traversal and membership-option
inspection.

Independent result: `PARTIAL`.

Finding `P1-02`: database ownership is not explicitly rejected. The validator
uses `pg_database.datacl` to require CONNECT but does not reject
`pg_database.datdba = v_role`. A database owner can satisfy the ACL path.

## Bootstrap

The correction adds seed, initiator, approver, root issuer, two approvals and
a first session-bound `AUTHORITY_ISSUE` Grant. A fresh database path is now
structurally reachable.

Independent result: `FAIL`.

Finding `P1-01`: `bootstrap_complete_root_r3` reads `rootop` by
`session_user` and `operator_kind='ROOT'`, but does not compare
`rootop.principal_id` with `st.root_principal_id` before creating the root
session and Grant.

Additional issue: after `COMPLETE`, a lost root response has no implemented
controlled recovery/rotation transaction; the documented external recovery is
not a complete executable protocol.

## View Isolation

`trusted_session_status_v` and `trusted_session_audit_v` retain active caller
context and subject-scoped audit checks. Static review: `PASS`.

## Verdict

```text
Session Role Closure: PARTIAL
Bootstrap: FAIL
Dynamic CONNECT: PARTIAL — design path exists; provisioning evidence not run
View Isolation: PASS STATIC
```
