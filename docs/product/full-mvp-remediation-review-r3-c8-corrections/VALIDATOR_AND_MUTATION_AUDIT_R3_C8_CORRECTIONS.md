# Validator and Mutation Audit

The Corrections self-validator was read but not executed.

## Claimed Results

```text
28/28 invariants
13/13 mutation fixtures detected
```

## Independent Result

The independent checker used the corrected complete DDL directly and found:

```text
Independent checks: 32/37 PASS
Failed:
  catalog_source_target_binding
  database_owner_rejected
  protected_owner_closure_rejected
  bootstrap_root_principal_binding
  bootstrap_recovery
Foreign-key arity errors: 0
Independent targeted mutations detected: 13/13
```

The self-validator's mutation set does not include:

- bootstrap root-operator/session/state Principal mismatch;
- database owner accepted through `pg_database.datdba`;
- CatalogReview source revision paired to an unrelated target.

The independent mutation runner counts a mutation as detected only when it
introduces a new failure relative to the unchanged baseline. This avoids
counting an already-failing property as a successful detection.

Therefore the Corrections `28/28` result is a partial static lint result, not a
complete design proof. Missing inputs and missing objects are not treated as
PASS by the review verifier because they raise before evaluation.

## Mutation Coverage Limitation

The self-validator's mutation substitutions are text-token mutations. They do
not prove semantic behavior under PostgreSQL trigger ordering, ACL inheritance,
or concurrent transactions. Mutation detection of a token is not equivalent to
mutation detection of the real DDL constraint.

```text
Static validation: PARTIAL
PostgreSQL semantic validation: NOT VERIFIED
```
