# DDL and Object Cross Reference R5

## Independent Inventory

```text
Tables:                         76
Foreign-key declarations:      127
FK structural errors:            0
Function signatures:            168
Missing function owners:         0
Unresolved app call targets:     0
Triggers:                      188
Trigger target/function errors:  0
Roles:                          26
Views:                          17
Procedures:                      0
PostgreSQL sequences:            0
```

## FK Result

The independent parser checks:

- source table and source columns;
- source/target arity;
- target table;
- exact target PRIMARY/UNIQUE key membership.

All 127 declarations pass structural checks.

PostgreSQL type compatibility, deferrability, validation timing and locking
remain `NOT VERIFIED`.

## Function and Registry Result

```text
Registry signatures:              168
DDL final signatures:             168
Signature sets equal:             YES
Return-type mismatches:            0
Owner mismatches:                  0
Effective-grant map equal:        YES
Security-mode mismatches:         128
search_path mismatches:           157
```

The 128/157 mismatches are a P2 integrity defect in the Registry. The final DDL
has the correct `SECURITY DEFINER` and explicit search paths; the Registry's
parser loses those attributes.

## Trigger Result

All 188 Trigger targets exist.

The seven identity mutex Triggers are:

- statement level;
- BEFORE UPDATE OR DELETE;
- on all Root-invalidating identity tables;
- call the common identity lock Trigger function.

The Generation Trigger is BEFORE INSERT ROW and performs the ROTATION
revalidation.

## ACL Result

The effective EXECUTE map matches the Registry and preserves the R4 Recovery
capability set:

```text
R4 public Recovery functions -> existing exact roles
R5 helper functions          -> no role EXECUTE
Candidate backfill           -> no PUBLIC/runtime EXECUTE
```

Actual Catalog/default privilege/role membership state remains
`NOT VERIFIED — DATABASE NOT AUTHORIZED`.

## Composition

The final Complete DDL includes the transformed R4 complete source plus the R5
Overlay. R5 final definitions override the R4 versions for affected signatures.
No final function signature is missing or duplicated.

## Verification Boundary

```text
Static structure:        COMPLETED
PostgreSQL grammar:      NOT VERIFIED
Compilation:             NOT VERIFIED
Catalog introspection:   NOT VERIFIED
Trigger execution:       NOT VERIFIED
Runtime constraints:     NOT VERIFIED
```

