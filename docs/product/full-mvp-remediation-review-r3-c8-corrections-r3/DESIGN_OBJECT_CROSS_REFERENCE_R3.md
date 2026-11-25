# Design Object Cross Reference

## Inventory

```text
Tables:                    72
FK declarations:          123
Unique function names:    153
Function signatures:      154
Triggers:                 174
Roles:                     26
```

## FK Audit

All 123 declarations have valid source and target column sets in the
independent parser. No target-key or arity errors were found.

Key repaired relations:

- Approval -> immutable Generation
- Root Session -> immutable Generation
- Binding -> CatalogSourceRevision PK
- Event -> Binding PK
- ProfessionalReview sources -> full candidate/result keys

## Registry

```text
Registry signatures: 154
Missing owners:       0
Unresolved calls:     0
```

The 153 unique names / 154 signatures difference is the two overloads of
`bootstrap_complete_root_r3`.

## Trigger Audit

All Trigger targets exist. Function creation precedes Trigger creation.

Catalog evidence/binding and Professional candidate triggers run before their
related digest/FK checks by trigger-name ordering.

## Remaining Limitations

Type compatibility, PostgreSQL Catalog resolution, deferred checking, trigger
execution and ACL runtime are not proven offline.
