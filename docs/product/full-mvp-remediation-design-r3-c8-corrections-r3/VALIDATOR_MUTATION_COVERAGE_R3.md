# Validator Mutation Coverage R3

## R2 Mutations

The 12 submitted R2 mutations are replayed against the transformed R3 DDL:

```text
root principal binding
root grant recipient
all recovery functions
database owner check
schema owner check
relation owner check
function owner check
catalog binding table
catalog event binding digest
original Session state check
selection FieldValue trigger
bootstrap audit guard
```

## Formal 29 Mutation Classes

### Root Principal — 8

1. Operator Principal mismatch.
2. Operator Role mismatch.
3. Root Session Principal mismatch.
4. Grant recipient mismatch.
5. Grant issuer/session mismatch.
6. Non-root approval marker.
7. Generation mismatch.
8. Duplicate root Grant.

### Owner Closure — 12

1. Direct database Owner.
2. Database Owner membership.
3. `pg_database_owner` semantics.
4. Direct Schema Owner.
5. Indirect Schema Owner.
6. Relation Owner.
7. Sequence Owner.
8. View Owner.
9. Function Owner.
10. SET path.
11. INHERIT path.
12. ADMIN path.

### Catalog Binding — 9

1. Binding table absent.
2. Product Source key absent.
3. Specification Source key absent.
4. Price Source key absent.
5. Source FK uses wrong target.
6. Target uniqueness absent.
7. Event Binding FK absent.
8. Event digest omits Binding.
9. Snapshot Binding FK absent.

## Additional Structural Failures

The R3 Validator must fail closed for:

- source column missing;
- target column missing;
- FK arity/order mismatch;
- invalid FK target key;
- missing final PUBLIC revoke;
- wrong R2/R3 hash;
- missing required file;
- Registry/DDL mismatch;
- Overlay not present in Complete DDL.

Success is accepted only when the named invariant, not an unrelated error,
changes from PASS to FAIL.

PostgreSQL grammar remains unverified.
