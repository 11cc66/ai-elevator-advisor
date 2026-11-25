# Owner Privilege Closure and Concurrency R3

`assert_protected_owner_closure_r3` first executes:

```sql
pg_advisory_xact_lock(hashtextextended('AIEA:owner-catalog:v3',0));
```

and then invokes the R2 Owner Catalog checks. The lock is held to transaction
end. Approved role creation, membership changes, object Owner changes and
Default Privilege changes must acquire the same key.

Lock order:

```text
Owner Catalog advisory lock
 -> Role/Principal locks
 -> business row locks
```

The closure scans database, Schema, table/partition/view/materialized/foreign
table/sequence, function/procedure and type/domain Owners. It rejects recursive
membership, INHERIT, SET, ADMIN, direct object ACLs and incomplete Catalog
snapshots.

The closure digest is recorded at request start and rechecked before completion.
A superuser action that bypasses the cooperative lock remains an external
trust-root action but is detected at the next check when possible.

Actual PostgreSQL advisory-lock and Catalog behavior remains `NOT VERIFIED`.
