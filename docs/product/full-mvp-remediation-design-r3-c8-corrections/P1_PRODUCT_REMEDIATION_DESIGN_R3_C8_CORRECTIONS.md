# FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS

## Status

```text
DESIGN COMPLETE — READY FOR INDEPENDENT REVIEW
P1: 4/4 DESIGN-ADDRESSED
P2: 4/4 DESIGN-ADDRESSED
P3: 3/3 DESIGN-ADDRESSED
```

This is a design-only correction package. It does not authorize Schema,
Migration, database access, Runtime or production.

## Architecture

The corrections preserve the layered C8 design and add a final-state overlay:

```text
Frozen C8 baseline
  -> C8 corrections Overlay
  -> complete corrections DDL
```

The new overlay is the authoritative correction layer for:

- Price fact content and digest;
- Requirement assertion/FieldValue source identity;
- CatalogReview event and target identity;
- ProfessionalReview event, basis and target identity;
- recursive Session Role/privilege closure;
- bootstrap, root authority and direct CONNECT;
- Request Ledger epoch/session replay;
- Review TRUNCATE protection;
- Source-Aux pre-Seal validation.

## Data/Authority Chains

```text
Price Source -> PriceRevision -> CandidatePrice -> SelectionRun Seal
  -> SnapshotPrice -> Price Row Digest -> Basis

Requirement Assertion -> FieldValue -> SelectionRequirement
  -> SnapshotRequirement -> Basis

Catalog Source -> CatalogReviewEvent -> SelectionCatalogReview
  -> SnapshotCatalogReview -> Basis

SelectionResult -> ProfessionalReview -> Event/Basis
  -> SelectionReviewSnapshot -> Basis
```

The complete DDL and traceability are the implementation-facing design
locations. PostgreSQL compilation and Runtime are `NOT VERIFIED`.

## Offline Validation

```text
Invariants: 28/28 PASS
Mutation fixtures: 13/13 detected
Tables: 58
Foreign keys: 87
Functions: 118
Roles: 26
Triggers: 137
C6-SNAP-01: 4036 bytes / exact SHA-256
Node/Python C6 reconstruction: PASS
PostgreSQL grammar/compilation: NOT VERIFIED
```
