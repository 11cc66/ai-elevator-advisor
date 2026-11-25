# Owner Privilege Closure R3-C8 R2

## Complete Closure

```text
Session Login Role
  -> direct memberships
  -> recursive memberships
  -> INHERIT reachability
  -> SET ROLE reachability
  -> ADMIN reachability
  -> database Owner / pg_database_owner semantics
  -> protected Schema Owners
  -> protected Relation Owners
  -> protected Function/Procedure Owners
  -> protected Type/Domain Owners
```

## Database Owner

The validator reads `pg_database.datdba` for the current database. A Session
Role rejects if it is the Owner or reaches the Owner through any membership
option.

PostgreSQL 18 defines `pg_database_owner` as having exactly one implicit member,
the current database owner. The `datdba` and `pg_has_role(...,'MEMBER')` checks
cover that implicit path; `pg_database_owner` cannot itself be granted.

## Protected Objects

`app` and `app_private` are protected. The closure scans:

- table, partitioned table, view, materialized view, foreign table and sequence
  Owners;
- function and procedure Owners, including SECURITY DEFINER owners;
- domain, enum, composite and range Type Owners.

Any Owner reachable from the Session Role fails.

## Direct Privileges

The validator rejects:

- database privileges other than direct CONNECT;
- Schema USAGE/CREATE;
- relation and sequence privileges;
- column ACL privileges;
- function EXECUTE;
- PUBLIC protected-relation privileges;
- unexpected membership and ADMIN expansion.

## Request-Time Stability

At request start, `validate_session_role_r3` records the Owner Closure digest in
the transaction-local `aiea.owner_closure_digest`. `assert_active_session`
recomputes it before completion. A changed closure fails with serialization-like
SQLSTATE.

Approved role provisioning and Owner changes must coordinate through the same
transaction advisory lock. A superuser change that ignores the lock remains an
external trust-root action but is detected at the end check or at the next
request.

## Fail Closed

The function rejects when:

- expected protected Schemas are missing;
- relation, function or type inventory is empty;
- owner Catalog rows cannot be read;
- any owner is reachable;
- membership paths or options are ambiguous;
- the request-start digest is missing.

PostgreSQL Catalog and ACL behavior remain `NOT VERIFIED`.
