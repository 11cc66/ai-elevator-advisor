# Unverified Items R3-C8 Corrections R2

## Database

```text
PostgreSQL Grammar:
NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER

PostgreSQL Compilation:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Catalog Introspection:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Constraint/Trigger/ACL/DEFERRED FK Runtime:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Runtime Concurrency:
NOT VERIFIED — RUNTIME NOT AUTHORIZED

Connection Pool / Session Reset:
NOT VERIFIED — DATABASE/RUNTIME NOT AUTHORIZED
```

## Behavior Requiring Real PostgreSQL

- `pg_auth_members` option columns and `pg_has_role` exact behavior;
- Catalog visibility for Owners and ACL rows;
- advisory-lock coordination with external role provisioning;
- SECURITY DEFINER and fixed `search_path`;
- deferred circular FK checks for bootstrap session/grant mapping;
- generated columns and composite target uniqueness;
- trigger ordering and exception SQLSTATE;
- transaction rollback, serialization and deadlock behavior;
- concurrent session termination, Request replay and recovery approval;
- root change crash windows and credential rotation.

## External Authority

The following remain Open Decisions:

```text
root-change approval ownership
root credential delivery and custody
emergency recovery authority
role provisioning identity
break-glass access
production connection topology
evidence retention/export
```

## Offline Evidence That Did Pass

- all input manifest hashes;
- complete DDL generation;
- 145-function Registry owner/call-target checks;
- static object/FK/trigger/role inventory;
- 48 validator invariants;
- 12 targeted DDL mutations;
- 55 design-case vectors;
- C6-SNAP-01 exact bytes/hash;
- R6 23 scalar and 14 resource vectors;
- guarded PowerShell/Python child identity;
- direct-Python fail-closed negative test.

None is a PostgreSQL Runtime or production PASS.
