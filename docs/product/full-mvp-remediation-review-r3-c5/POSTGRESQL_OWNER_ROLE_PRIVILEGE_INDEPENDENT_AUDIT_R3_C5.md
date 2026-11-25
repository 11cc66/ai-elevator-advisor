# PostgreSQL Owner / Role / Privilege Independent Audit

Date: 2026-11-24

Result:

```text
PostgreSQL Owner / Role / Privilege: FAIL
DATABASE: NOT ACCESSED
```

## 1. Positive Controls

The design correctly separates logical roles for:

- database administration;
- database/schema/table/function ownership;
- migration;
- Web/Worker runtime;
- reviewer, policy author and policy reviewer;
- auditor/reporting;
- per-principal login.

It also states:

- runtime roles do not own protected objects;
- PUBLIC table access is revoked;
- transition EXECUTE is capability-limited;
- owner roles are NOLOGIN/NOINHERIT;
- fixed search_path and no dynamic SQL;
- no runtime TRUNCATE;
- trigger functions are not directly executable by runtime.

## 2. Missing Role DDL

The baseline is described as DDL, but does not include:

```sql
CREATE ROLE ...
ALTER ROLE ... LOGIN/NOLOGIN INHERIT/NOINHERIT
GRANT capability TO principal WITH INHERIT FALSE, SET TRUE
REVOKE ADMIN OPTION ...
```

Thus transitive membership, SET ROLE and ADMIN OPTION cannot be reviewed as an
executable role graph.

## 3. Missing Authorization Objects

The protected-table list omits:

- `trusted_principal`;
- `authority_grant`;
- PolicyRevision;
- PolicyReviewEvent;
- current/effective policy views;
- any actor/session revocation table.

These are authoritative inputs to the transition decision. They need explicit
owners, SELECT/DML grants, append policies and default privileges.

## 4. Views

The SELECT matrix depends on:

- latest Review view;
- policy draft view;
- current Snapshot view;
- immutable audit view.

No view DDL is provided. Missing:

- view owner;
- `security_barrier`;
- row/project filtering;
- column redaction;
- `WITH CHECK OPTION` where relevant;
- base-table revokes versus view grants.

## 5. Owner Assignments

`ALTER FUNCTION transition... OWNER` is shown once. Not shown:

- exact CREATE ROLE role options;
- schema authorization/owner;
- table ownership;
- trigger function ownership;
- type ownership;
- validation function ownership;
- `ALTER DEFAULT PRIVILEGES` for table/function owner.

## 6. Default Privileges

The file resets defaults only for `elevator_migrator`, then says equivalent
revokes are required for other object creators. That is a requirement, not a
complete design.

## 7. Privilege Inventory

Required object-by-object inventory:

```text
Database CONNECT/TEMP
Schema USAGE/CREATE
Table SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER
View SELECT
Sequence USAGE/SELECT/UPDATE
Function EXECUTE
Type USAGE
Default privileges
Role memberships and SET/ADMIN
```

The file covers most categories conceptually but not all objects and roles.

## 8. Append-only

The append-only policy is stated but lacks trigger function DDL, owner, grants,
and coverage for Event, policy events and authorization grants.

## 9. Required Acceptance

- exact executable role/owner DDL;
- complete protected object catalog;
- exact GRANT/REVOKE/default privilege matrix;
- view definitions;
- append-only trigger definitions;
- pre/post privilege introspection;
- inherited-role and SET ROLE tests;
- PUBLIC/owner/trigger-function bypass tests.

