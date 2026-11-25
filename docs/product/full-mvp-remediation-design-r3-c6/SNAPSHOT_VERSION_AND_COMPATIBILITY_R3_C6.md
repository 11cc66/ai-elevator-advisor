# Snapshot Version and Compatibility R3-C6

## 1. Version Decision

| Concern | Version |
|---|---|
| StableKey | `SK-R2` preserved |
| Source Identity | `SOURCE_KEY_R3` preserved |
| Registry | new `SNAPSHOT-R3` |
| Basis | new `R3-BASIS-1-R6` |
| Schema | `SNAPSHOT-SCHEMA-R3` |

Registry R3 is required because C6 adds/changes fields:

- Header context, RuleSet and basisAsOf tags;
- Candidate provenance fields;
- Parameter catalog revision;
- Price provenance/validity;
- Source captured time;
- Catalog Review source revision;
- Professional event sequence/time;
- Warning source ID/severity;
- Missing impact scope.

R6 is required because the field inventory and BYTES maximum change.

## 2. Preserved History

The following are never changed:

```text
SNAPSHOT-R1
SNAPSHOT-R2
R3-BASIS-1-R4
R3-BASIS-1-R5
C5-SNAP-01
3051 bytes
83F00E53B7AC21779B2753F0640B3023E2DE6A53AFA405BC0E4C8A2FDC056FB1
```

## 3. Compatibility Matrix

| Source | Target | Compatible | Migration | Basis impact | Approval |
|---|---|---|---|---|---|
| R1/R4 | R3/R6 | no direct identity | new snapshot or structured re-encode | new Basis | OD-R3-C5-02 |
| R2/R5 | R3/R6 | field semantic superset, not byte-compatible | new snapshot version | new Basis | OD-R3-C6-02 |
| R2/R5 | read-only historical | yes | none | preserve old bytes | no |
| R3/R6 | R3/R6 | yes | exact registry/protocol/encoding | direct verify | pending approval |

## 4. Coexistence

Registry and protocol versions are stored in every Basis Header. A parser dispatches
only to the exact registered implementation. It does not reinterpret an R2
stable key or R5 record under R3/R6.

## 5. Migration

1. preserve old Snapshot and Basis.
2. determine whether all new provenance/validity fields can be recovered from
   immutable source records.
3. if not, quarantine; do not guess.
4. create a new R3/R6 Snapshot.
5. store both old and new evidence references.

## 6. Rollout

R3/R6 production enablement remains blocked by:

- Registry R3 approval;
- new source/price policy approval;
- database-role/session approval;
- runtime validation.

