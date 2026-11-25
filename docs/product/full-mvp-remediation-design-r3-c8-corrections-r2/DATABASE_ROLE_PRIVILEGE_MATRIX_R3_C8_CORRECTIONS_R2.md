# Database Role and Privilege Matrix R3-C8 Corrections R2

## Session Login Roles

Dynamic Session roles remain:

```text
LOGIN
NOINHERIT
NOSUPERUSER
NOCREATEDB
NOCREATEROLE
NOREPLICATION
NOBYPASSRLS
CONNECTION LIMIT 1
direct database CONNECT
exactly two memberships:
  elevator_session_bootstrap
  one exact capability role
BOTH MEMBERSHIPS:
  INHERIT FALSE
  SET TRUE
  ADMIN FALSE
```

No direct database privilege other than `CONNECT` is allowed.

## Capability Roles

Existing capability roles remain NOLOGIN. Session access is through `SET ROLE`
after the login-level connection and closure check. Capability roles receive only
the controlled function/View grants defined in the final DDL.

## Protected Owner Classes

The closure rejects Session Role reachability to:

```text
pg_database.datdba
pg_database_owner implicit database-owner semantics
app and app_private Schema Owners
table / partitioned table / view / materialized view / foreign table Owners
sequence Owners
function and procedure Owners
domain / enum / composite / range type Owners
```

The check uses both direct OID equality and PostgreSQL membership semantics.

## PostgreSQL 18 Rules Applied

- `INHERIT TRUE` enables automatic inherited privileges through a membership
  chain; `INHERIT FALSE` stops automatic inheritance.
- `SET TRUE` permits `SET ROLE` regardless of intermediate `SET ROLE` steps.
- `ADMIN TRUE` allows membership expansion and is therefore treated as
  reachability even when `INHERIT` and `SET` are false.
- `pg_database_owner` has exactly one implicit member, the current database
  owner, and cannot be granted as a role membership. Comparing the session
  closure with `datdba` and `pg_has_role(...,'MEMBER')` covers this path.
- Object Owners implicitly hold all object privileges and grant options even if
  an explicit ACL is empty.

## Validation Points

`validate_session_role_r3` runs:

1. during Session registration/activation;
2. when `lock_current_session` starts a request;
3. again in `assert_active_session` before business completion.

An `aiea.owner_closure_digest` transaction setting records the closure observed
at request start. The completion check recomputes and compares it.

## Known Boundary

Catalog writes and role changes not honoring the design's transaction advisory
lock are part of the deployment trust root. Runtime must still fail closed at
the completion check or next request. Actual PostgreSQL 18 Catalog behavior is
`NOT VERIFIED`.
