# Unverified Items R3-C8 Corrections Review

## PostgreSQL and Runtime

```text
PostgreSQL Grammar:
NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER

PostgreSQL Compilation:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Catalog Introspection:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Constraint/Trigger/ACL Runtime:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Runtime Concurrency:
NOT VERIFIED — RUNTIME NOT AUTHORIZED

Connection Pool / Session Reset:
NOT VERIFIED — DATABASE/RUNTIME NOT AUTHORIZED
```

Static text checks do not prove that PostgreSQL accepts the DDL, that referenced
relations/columns exist in the intended final Catalog, that function replacement
is signature-compatible, or that triggers fire in the required order.

## Specific Semantics Not Proven

- composite FK parent keys exist with the expected final types and uniqueness;
- `SECURITY DEFINER` ownership, fixed `search_path` and indirect EXECUTE paths;
- membership option columns and recursive role behavior in PostgreSQL 18;
- owner-derived privileges and `BYPASSRLS`/RLS behavior;
- partial unique index behavior for active AuthorityGrants;
- deferred constraint trigger order and final commit-state checks;
- TRUNCATE CASCADE and table-owner bypass behavior;
- row-lock acquisition, deadlock/serialization outcomes and retry classes;
- concurrent Request Ledger claims, Seal and review-event processing;
- bootstrap crash windows, transaction rollback and lost-response recovery;
- original revoked-Session replay behavior;
- PostgreSQL text rendering of `jsonb`, timestamps, numerics and SHA-256 input.

## External Decisions and Operations

```text
Open business/authority/deployment decisions: 57 OPEN
User approvals found: 0
Production role topology: NOT APPROVED
Identity broker/credential custody: NOT APPROVED
Break-glass ownership: NOT APPROVED
Evidence retention/export: NOT APPROVED
Production rollout: NOT AUTHORIZED
```

## Protected Environments

```text
Database: NOT ACCESSED
Storage: NOT ACCESSED
Build/Product Tests/E2E: NOT EXECUTED
Native RPC: NOT EXECUTED
Deployment/Production: NOT AUTHORIZED
```

## Offline Evidence That Did Pass

The following are limited to static/offline claims:

- all 24 Corrections manifest records match SHA-256, byte count, line count,
  uniqueness and coverage;
- 58 table declarations, 87 FK declarations, 118 function names, 137 trigger
  declarations and 26 role declarations were parsed;
- all 87 parsed FK declarations have equal source/target arity;
- 13 targeted static mutations introduced new detected failures;
- C6-SNAP-01 independently retains 15 records, 4036 bytes and the expected
  SHA-256;
- R6 offline scalar/resource vectors retain 23/23 and 14/14 results.

Those results are not PostgreSQL Runtime or production evidence.
