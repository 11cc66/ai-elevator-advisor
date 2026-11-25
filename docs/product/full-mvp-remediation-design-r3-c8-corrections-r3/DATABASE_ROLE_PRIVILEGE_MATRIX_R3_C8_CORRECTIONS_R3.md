# Database Role Privilege Matrix R3

## Session Login Role

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
exact bootstrap + capability memberships
INHERIT FALSE
SET TRUE
ADMIN FALSE
no direct protected object privileges
```

## Final ACL Phase

After all R2/R3 function definitions:

```sql
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA app FROM PUBLIC;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA app_private FROM PUBLIC;
```

Explicit capability grants are applied afterward.

## Function Access

| Function class | Effective caller |
|---|---|
| Root completion | `elevator_root_issuer` |
| Balance/Recovery begin | `elevator_bootstrap_initiator` |
| Balance/Recovery approve/deny | `elevator_bootstrap_approver` |
| Balance/Recovery execute/fail issuance | `elevator_bootstrap_seed` |
| Catalog Binding | catalog reviewer/publisher |
| Session termination | identity broker |
| Result Recovery request/execute | runtime Web/Worker |
| Result Recovery approve | security admin |
| Private bootstrap ledger/event helpers | no direct grants; internal owner only |

## Default Privileges

Default privileges are not treated as proof. The explicit final REVOKE is
independent of the DDL execution role and covers every function created before
that stage.

## Schema USAGE

`app_private` USAGE is limited to approved owner/function roles. `app` USAGE is
granted only to capability and approved operational roles. Session login roles
reach capabilities through `SET ROLE`, not inherited direct privileges.

## Owner Classes

Database, Schema, relation, sequence, function/procedure and type/domain Owners
are rejected by the Owner Closure.

## Unverified

Actual ACL and default ACL Catalog state require PostgreSQL 18 execution.
