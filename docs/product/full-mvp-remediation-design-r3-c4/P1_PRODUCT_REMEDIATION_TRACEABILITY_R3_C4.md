# P1 Product Remediation Traceability R3-C4

Status:

```text
R3-C4 DESIGN COMPLETE WITH OPEN BLOCKERS
```

## 1. R3-C3 Findings

| R3-C3 finding | C4 correction | Evidence | Status |
|---|---|---|---|
| `REV-R3-C3-P1-01` Event/FieldValue parent mismatch | Exact six-column Event UNIQUE plus six-column FieldValue/Assertion FK; Review parent remains separately six-column FK | `PROFESSIONAL_REVIEW_COMPOSITE_FK_DESIGN_R3_C4.md`; C4 main §4 | `DESIGN_ADDRESSED_PENDING_REVIEW` |
| `REV-R3-C3-P1-02` missing actual Snapshot Registry | Registry R1 defines record types 0–9, tags, stable keys, fields and ordering | `SNAPSHOT_REGISTRY_R1.md`; C4-SNAP-01 | `DESIGN_ADDRESSED_PENDING_REVIEW` |
| `REV-R3-C3-P2-01` incomplete Snapshot child schema | Full normalized child tables/immutability/deferred checks | `SNAPSHOT_NORMALIZED_CHILD_SCHEMA_R1.md`, `SNAPSHOT_DEFERRED_VALIDATION_CONTRACT_R1.md` | `DESIGN_ADDRESSED_PENDING_REVIEW` |
| `REV-R3-C3-P2-02` typed catalogue incomplete | R1 field/type/unit/range catalogue; engineering authority retained | `TYPED_FIELD_CATALOGUE_R1.md` | `DESIGN_ADDRESSED_PENDING_REVIEW` |
| `REV-R3-C3-P2-03` legacy JSON mapping incomplete | Per-field migration matrix and quarantine requirements | `LEGACY_JSON_TYPED_MIGRATION_MAP_R1.md` | `DESIGN_ADDRESSED_PENDING_REVIEW` |
| `REV-R3-C3-P2-04` event privilege unclear | Role matrix, REVOKE/GRANT, function owner/search_path and append-only rules | `EVENT_ONLY_DATABASE_PRIVILEGE_DESIGN_R1.md` | `DESIGN_ADDRESSED_PENDING_REVIEW` |
| `REV-R3-C3-P2-05` sourceKey delimiter ambiguity | Structured source identity plus length-prefixed derived key | `CANONICAL_SOURCE_IDENTITY_R2.md` | `DESIGN_ADDRESSED_PENDING_REVIEW` |
| `REV-R3-C3-P3-01` generic vs full Snapshot overclaim | Generic framing and C4-SNAP-01 full snapshot distinguished | `R3_BASIS_V4_INDEPENDENT_REPRODUCTION.md` | `DESIGN_ADDRESSED_PENDING_REVIEW` |

## 2. C4 Internal Findings

No new internal finding is intentionally left unresolved in this design pass.
All C4 changes remain subject to independent review. The following are
Open-Decision dependencies rather than hidden technical omissions:

- exact engineering units/ranges/thresholds;
- archive product/ACL/retention;
- professional reviewer/policy authority;
- legacy data disposition;
- deployment role names/owner;
- snapshot retention/export.

## 3. Preserved Historical Findings

The approved R1/R2/R3/C2/R3-C3 directions remain:

- conversation/project separation;
- scenario consistency;
- conditional semantics;
- no approved rules → no Operational;
- DEMO immutability;
- catalog evidence archive separation;
- technical/commercial/trust/professional separation;
- SQL-scoped sales;
- append-only history;
- P1-3 isolation.

R3-C3's generic vector acceptance is narrowed to generic framing only. C4-SNAP-01
is the actual Snapshot vector.

## 4. Verification Status

```text
Generic framing vectors: INHERITED / READ-ONLY
Full Snapshot vector C4-SNAP-01: DESIGNED
Node/Python full Snapshot reproduction: PASS (design-time)
ProfessionalReview exact FK: DESIGNED
Snapshot Registry: DESIGNED
Snapshot child schema: DESIGNED
Deferred validation: DESIGNED
Implementation: NOT AUTHORIZED
Database/Runtime: NOT VERIFIED
Independent R3-C4 review: PENDING
```
