# Session Role Privilege Closure R3-C8 Corrections

## Eligibility

`validate_session_role_r3` now checks:

```text
LOGIN                  required
SUPERUSER              rejected
CREATEDB               rejected
CREATEROLE             rejected
REPLICATION            rejected
BYPASSRLS              rejected
INHERIT                rejected
CONNECTION LIMIT       1
```

It also verifies exactly the expected capability membership and the
`elevator_session_bootstrap` membership, with:

```text
INHERIT FALSE
SET TRUE
ADMIN FALSE
```

## Recursive Closure

The validator uses a recursive CTE over `pg_auth_members` and rejects any
reachable role other than the exact capability and bootstrap roles. This
catches direct, indirect and cyclic membership paths.

## Direct Object Privilege Rejection

The validator rejects:

- direct database privileges other than the required direct CONNECT;
- direct schema USAGE/CREATE on `app` or `app_private`;
- direct table/sequence privileges in `app`;
- direct function EXECUTE in `app`/`app_private`;
- dangerous PUBLIC relation privileges.

Capability access remains through `SET ROLE` to the registered capability.
`lock_current_session` re-runs the closure check before each request, so
membership or object grants changed during a Session fail closed.

## Dynamic Login Roles

A dedicated non-Runtime provisioner creates each login role with a unique name,
direct database CONNECT and exact memberships. The login role does not receive
direct table/schema/function privileges. Credentials are delivered separately;
the role is retired after session termination.

## Remaining Boundary

The exact PostgreSQL Catalog API behavior and `pg_auth_members` option columns
must be confirmed by PostgreSQL 18 Catalog tests. No such database exists in
this authorization.
