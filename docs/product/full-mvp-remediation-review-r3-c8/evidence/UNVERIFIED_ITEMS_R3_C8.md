# Unverified Items R3-C8

```text
PostgreSQL SQL Grammar:
NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER

PostgreSQL Compilation:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Catalog Introspection:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Runtime Concurrency:
NOT VERIFIED — RUNTIME NOT AUTHORIZED

Trigger Semantics:
NOT VERIFIED — DATABASE NOT AUTHORIZED

ACL Semantics:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Connection Pool / Transaction Pool Behavior:
NOT VERIFIED — DATABASE/RUNTIME NOT AUTHORIZED

Session Reset / DISCARD ALL / SET LOCAL:
NOT VERIFIED — DATABASE/RUNTIME NOT AUTHORIZED

TRUNCATE CASCADE Behavior:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Real Role Membership Graph:
NOT VERIFIED — NO DATABASE CATALOG ACCESS

Historical C8 Bash Process Tree:
PARTIALLY VERIFIED — CURRENT ARTIFACTS MATCH; HISTORICAL PROCESS EVIDENCE INSUFFICIENT

Source / Storage:
NOT ACCESSED

Runtime / Native RPC / Product Build:
NOT EXECUTED

Production:
NOT AUTHORIZED
```

## Why These Remain Unverified

The authorized review permitted static file inspection and independent offline
encoding calculations only. It prohibited PostgreSQL access, SQL execution,
build, Runtime, Storage and process-state mutation.

No compatible offline PostgreSQL parser was installed (`pglast`, `sqlglot` and
`sqlparse` were absent); no dependency was installed.

The independent verifier therefore labels its SQL analysis as static text
consistency only. It must not be described as PostgreSQL compilation or
Catalog validation.
