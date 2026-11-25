# P1 Product Remediation R3-C4 Changelog

## Status

```text
R1/R2/R3/C2/C3: PRESERVED / NOT MODIFIED
R3-C4 DESIGN: COMPLETE WITH OPEN BLOCKERS
SOURCE/Schema/Migration: NOT MODIFIED
DATABASE/Runtime: NOT VERIFIED
```

## Corrections

### ProfessionalReview FK

Added exact six-column Event UNIQUE key and separate six-column Review parent
FK. FieldValue/Assertion use the exact Event source key. No Event-ID-only
fallback is permitted.

### Snapshot Registry and child schema

Added `SNAPSHOT_REGISTRY_R1` with record types 0–9, stable keys, field tags,
types and ordering. Added full normalized child tables, metadata, validation
results and deferred COMMIT checks.

### Snapshot Basis

Introduced `R3-BASIS-1-R4` with `SNAPSHOT-R1`. Added the complete
`C4-SNAP-01` vector with 15 records and exact SHA-256. Generic framing is not
claimed as full Snapshot validation.

### Typed and legacy model

Added R1 typed field catalogue with SQL types, limits, units and nullability.
Added a per-path legacy JSON migration matrix, deterministic conversion rules
and quarantine categories.

### Source identity and event permissions

Replaced ambiguous colon parsing with structured source identity plus a
length-prefixed derived sourceKey. Added role/function/table privilege design,
fixed `search_path`, PUBLIC revocation, append-only events and direct DML
denial.

## Preserved

R1/R2/R3/R3-C2/R3-C3 approved directions remain: conversation/project
separation, conditional semantics, scenario constraints, RuleSet/Professional
event-only state, catalog archive direction, sales ownership/filtering,
technical/commercial/trust separation, no approved rules → no Operational,
DEMO immutability and P1-3 isolation.

## Non-Changes

```text
Application source: NOT MODIFIED
Tests: NOT MODIFIED
Prisma Schema: NOT MODIFIED
Migration: NOT MODIFIED
Configuration/Lockfile: NOT MODIFIED
Database/Storage: NOT ACCESSED
Build/Worker/Native RPC/Runtime: NOT USED
Git writes: NONE
$null: NOT READ/HASHED/MODIFIED
```

## Remaining

All historical and C4 Open Decisions remain. Independent review, implementation
authorization, database behavior and Runtime verification are outstanding.
