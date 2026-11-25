# DDL and Privilege Independent Audit

## Inventory

Independent static parser results:

```text
Tables:                    58
FK declarations:           87
Unique function names:     118
CREATE ROLE declarations:  26
Trigger declarations:      137
FK arity errors:            0
```

The complete DDL and overlay markers are present. The main DDL contains the C8
baseline and corrections overlay. Overlay-only execution is not claimed as a
standalone complete DDL.

## FK Audit

All parsed FK declarations have equal source/target arity. This is an arity
check, not proof that every declared parent key exists in the final Catalog.

Semantic gaps remain:

- root operator Principal is not tied to bootstrap state Principal;
- CatalogReview source revision is not tied to target Product/Specification/
  Price facts;
- database and protected-object ownership is not explicitly rejected by role
  validation.

These are P1 findings, even though their FK columns are structurally present.

## Function / Owner / Grant

The Corrections Registry reports 118 functions with owners and no unresolved
qualified call names. The DDL contains explicit owners for the added correction
functions. Runtime roles receive capability/function/View grants; direct base
table access remains revoked.

PostgreSQL Catalog, ACL inheritance and actual EXECUTE behavior are not
introspected.

## Trigger and Overlay

The correction adds:

- Price fact digest triggers;
- Requirement source digest/binding triggers;
- CatalogReview event/row digest triggers;
- ProfessionalReview event/basis/state guards;
- Source-Aux pre-seal validation;
- explicit Review and Session TRUNCATE guards.

Static trigger names and event/table references are present. PostgreSQL runtime
ordering, trigger activation and CASCADE behavior are `NOT VERIFIED`.

## SQL Boundary

```text
PostgreSQL Grammar:
NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER

PostgreSQL Compilation:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Catalog Introspection:
NOT VERIFIED — DATABASE NOT AUTHORIZED
```
