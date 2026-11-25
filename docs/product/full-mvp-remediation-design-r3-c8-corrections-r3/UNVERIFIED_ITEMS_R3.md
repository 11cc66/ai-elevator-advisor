# Unverified Items R3

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

Database: NOT ACCESSED
Storage: NOT ACCESSED
Runtime: NOT EXECUTED
Production: NOT AUTHORIZED
```

Specific items requiring PostgreSQL:

- all FK target keys and deferrable constraint timing;
- Source/Event binding trigger ordering;
- final function ACL after `ALTER FUNCTION OWNER`;
- Owner advisory locks and Catalog visibility;
- concurrent recovery and Request Ledger replay;
- transaction rollback at each recovery stage;
- Registry signatures versus real Catalog;
- trigger/function exception SQLSTATE.

R3 static artifacts cannot substitute for PostgreSQL compilation or Runtime.
