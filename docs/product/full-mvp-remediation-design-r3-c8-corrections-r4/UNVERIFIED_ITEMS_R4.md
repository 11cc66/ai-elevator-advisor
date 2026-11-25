# Unverified Items R4

## PostgreSQL and Database

```text
R4 Complete DDL grammar:
NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER

PostgreSQL 18 compilation:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Catalog Introspection:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Constraint and Trigger behavior:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Migration against existing rows:
NOT VERIFIED — DATABASE NOT AUTHORIZED

COMMIT visibility after connection loss:
NOT VERIFIED — DATABASE/RUNTIME NOT AUTHORIZED
```

Specific items:

- actual SQLSTATE from CHECK, FK, NOT NULL and Trigger competition;
- actual lock duration of Candidate NOT NULL migration;
- actual determinism of Candidate backfill on deployed data;
- actual row counts and duplicate/cardinality;
- actual partial unique-index behavior;
- actual role grants and function Owners;
- actual Default Privilege interaction with new objects;
- actual Audit Event sequence under concurrent callers;
- actual behavior of legacy terminal timestamp backfill.

## Concurrency

```text
Two-connection Begin/Approve/Execute:
NOT EXECUTED

Deadlock and lock-wait observation:
NOT EXECUTED

Concurrent commit visibility:
NOT EXECUTED

Response loss through a real transaction:
NOT EXECUTED
```

The offline line interpreter cannot prove PostgreSQL MVCC, lock acquisition,
upsert conflict behavior or transaction retry semantics.

## ACL and Owner

- final Catalog ACL;
- Default ACL;
- exact role membership;
- INHERIT/SET/ADMIN mode;
- object Owner;
- advisory-lock cooperation from external role provisioning.

## Candidate Integrity

- whether every historical row has a unique source;
- whether an existing wrong Candidate was tolerated before R4;
- whether all FKs and Triggers execute in expected order;
- whether a real migration can complete without an unacceptable lock.
- whether the deployment runner actually executes the Overlay in one
  transaction and honors the required rollback boundary.
- whether the external identity-provisioning path can create the required
  Active target Principal and Epoch 1 without violating OPEN decisions.

## Open Decisions

All 57 Open Decisions remain OPEN. No root recovery ownership, credential
custody, break-glass, retry maximum, role provisioning, price policy or
evidence-retention choice is approved.

## Runtime and Storage

```text
RPC/Business Runtime:
NOT EXECUTED

Native RPC:
NOT EXECUTED

Storage:
NOT ACCESSED

File deletion/move/recovery:
NOT EXECUTED

Production:
NOT AUTHORIZED
```

## Protected Objects

`$null` content was not read, hashed, modified, moved, renamed or deleted in
this stage. `apps/web/.next` and `apps/worker/dist` were not built, started,
moved or modified.
