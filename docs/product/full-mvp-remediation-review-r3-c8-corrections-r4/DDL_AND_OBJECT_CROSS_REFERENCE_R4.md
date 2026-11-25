# DDL and Object Cross Reference R4

## Independent Inventory

```text
Tables:                         73
Foreign-key declarations:      124
Final function signatures:     161
Triggers:                      174
Roles:                          26
Effective grant signatures:     42
Procedures:                      0
Views:                          17
PostgreSQL sequences:            0
```

These were independently parsed from the final Complete DDL; the numbers match
the design submission by recomputation, not copied output.

## Complete DDL Composition

```text
PASS — exact byte-for-byte reconstruction from verified R3 Complete DDL
       plus verified R4 Overlay
```

The final function map uses the last definition for each signature. R3
historical bodies remain visible in the frozen prefix but are overridden by R4
final definitions for the affected Recovery entry points.

## FK Audit

```text
FK source-column errors:        0
FK target-table errors:         0
FK arity errors:                0
FK target PRIMARY/UNIQUE errors:0
```

Validated relevant keys include:

- Candidate composite relation to `selection_candidate_result`;
- new Sequence table relation to Bootstrap Generation;
- historical Generation, Approval and Root Session relations;
- Catalog Source/Binding identity;
- Catalog actor Grant identity;
- Result Recovery exact keys.

The parser verifies column names and exact target key membership. PostgreSQL
type compatibility and deferrable runtime behavior remain unverified.

## Function and Registry Audit

```text
Registry signatures:             161/161
Missing owners:                      0
Unresolved app call targets:         0
Registry DDL hash match:          true
Registry effective grant match:   true
```

R4-specific functions checked:

- `next_bootstrap_recovery_sequence_r4`;
- `lock_expired_root_change_r4`;
- `bootstrap_begin_root_change_r4`;
- `bootstrap_approve_root_change_r4`;
- `bootstrap_execute_root_change_r4`;
- `bootstrap_deny_root_change_r4`;
- `r4_candidate_backfill_row_allowed`.

All R4 functions that modify protected state are SECURITY DEFINER with a fixed
search path.

## Trigger Audit

```text
Trigger count:                  174
Missing target tables:            0
Missing trigger functions:        0
```

The snapshot/sealed guard replacement is installed over the same Trigger
functions. Candidate binding Trigger ordering is statically compatible with the
new Candidate-only guard, but actual firing order is not Runtime verified.

## ACL Audit

The final effective capability map equals the verified R3 map:

```text
remove four unsafe bootstrap Recovery entries
add four R4 Recovery replacements
```

Evidence:

- final PUBLIC function revoke occurs after all function definitions;
- no post-revoke PUBLIC grant exists;
- old Recovery role grants are revoked;
- root completion grant is restored;
- new Sequence table PUBLIC access is revoked;
- `elevator_review_function_owner` receives exact
  `SELECT/INSERT/UPDATE` on the Sequence table.

Actual Catalog ACL and Default Privilege state remain `NOT VERIFIED`.

## Verification Boundary

```text
Static structural parsing: COMPLETED
PostgreSQL grammar: NOT VERIFIED
PostgreSQL compilation: NOT VERIFIED
Catalog introspection: NOT VERIFIED
Trigger execution: NOT VERIFIED
Concurrent constraint behavior: NOT VERIFIED
```
