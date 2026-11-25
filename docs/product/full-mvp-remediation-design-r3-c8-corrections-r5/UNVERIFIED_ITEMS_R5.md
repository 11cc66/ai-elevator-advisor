# Unverified Items R5

## PostgreSQL

```text
PostgreSQL 18 grammar:       NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER
Compilation:                 NOT VERIFIED — DATABASE NOT AUTHORIZED
Catalog introspection:       NOT VERIFIED — DATABASE NOT AUTHORIZED
Constraint execution:        NOT VERIFIED — DATABASE NOT AUTHORIZED
Trigger firing/order:        NOT VERIFIED — DATABASE NOT AUTHORIZED
Function SECURITY DEFINER:    NOT VERIFIED — DATABASE NOT AUTHORIZED
Role/ACL/default privileges: NOT VERIFIED — DATABASE NOT AUTHORIZED
Migration lock behavior:     NOT VERIFIED — DATABASE NOT AUTHORIZED
```

Specific runtime questions:

- exact advisory-lock wait/deadlock selection;
- partial-unique and sequence upsert behavior under two connections;
- Event/terminalization insertion and FK timing;
- Candidate batch source-table lock duration;
- exact `ROW_COUNT` behavior and transaction rollback visibility;
- Candidate Trigger execution order;
- behavior of direct identity updates through undiscovered owner paths;
- existing Candidate row cardinality and uniqueness.

## Recovery Identity

Identity Broker, root provisioning, Session role topology, credential custody,
recovery limits, break-glass and evidence retention remain OPEN. The design uses
only already established identity tables and fails closed if required rows are
missing.

## Candidate Maintenance Identity

No concrete approved maintenance Principal/Session/Authority Grant exists in
this design phase. The controlled function requires all three and therefore
cannot be enabled until a separate provisioning decision is approved.

## Runtime and Storage

```text
Native RPC:       NOT EXECUTED
Application:      NOT STARTED
Worker:           NOT STARTED
Storage:          NOT ACCESSED
Database:         NOT ACCESSED
Production:       NOT AUTHORIZED
```

## Protected State

`$null` content was not read, hashed, modified, moved or deleted.
`apps/web/.next` and `apps/worker/dist` were not built, started, moved or
modified.

