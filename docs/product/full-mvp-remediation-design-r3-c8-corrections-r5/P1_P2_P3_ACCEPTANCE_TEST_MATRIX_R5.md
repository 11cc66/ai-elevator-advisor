# P1/P2/P3 Acceptance Test Matrix R5

## Corrected Findings

| Finding | Positive evidence | Negative evidence | R5 status |
|---|---|---|---|
| `REV-R4-IND-P2-01` | Execute current-Root query and Generation Trigger | root identity mutations; `IND-MUT-10` | `RESOLVED — DESIGN` |
| `REV-R4-IND-P2-02` | Begin expired sweep and new ordered Attempt | expired/locked vectors; `IND-MUT-20` | `RESOLVED — DESIGN` |
| `REV-R4-IND-P2-03` | batch/per-row audit and exact update count | Candidate audit mutations; `IND-MUT-21` | `RESOLVED — DESIGN` |
| `REV-R3-R3-P2-03` | 29/12/46 + 22 independent rules | each named semantic check | `RESOLVED — DESIGN` |
| `REV-R4-IND-P3-01` | canonical registries and complete ranges | duplicate/unknown/orphan checks | `RESOLVED — DESIGN` |

## ROTATION Matrix

| ID | Scenario | Expected |
|---|---|---|
| `R5-ROT-01` | Begin/Approve valid, Principal revoked before Execute | DENY, Generation unchanged |
| `R5-ROT-02` | Session revoked before Execute | DENY |
| `R5-ROT-03` | Grant revoked before Execute | DENY |
| `R5-ROT-04` | Epoch changes before Execute | DENY |
| `R5-ROT-05` | Session expired before Execute | DENY |
| `R5-ROT-06` | Grant expired before Execute | DENY |
| `R5-ROT-07` | two Execute | one Effect; other replay/conflict |
| `R5-ROT-08` | Execute vs Principal revocation | one mutex order, no stale Effect |
| `R5-ROT-09` | Execute vs Grant revocation | one mutex order |
| `R5-ROT-10` | Execute vs Epoch rotation | one mutex order |
| `R5-ROT-11` | old Generation delayed Execute | DENY |
| `R5-ROT-12` | identity row missing | DENY |

## Expired Attempt Matrix

| ID | Scenario | Expected |
|---|---|---|
| `R5-EXP-01` | expired PENDING, old request idle | Begin locks old and creates next |
| `R5-EXP-02` | expired APPROVED, old request idle | same |
| `R5-EXP-03` | two Begin | one replaces, other sees new active Attempt |
| `R5-EXP-04` | Execute races expiry sweep | serialized; only one terminal outcome |
| `R5-EXP-05` | Approve races expiry sweep | serialized |
| `R5-EXP-06` | old approval replay | cannot satisfy new Attempt |
| `R5-EXP-07` | Begin commit lost | same request replays committed result |

## Candidate Matrix

| ID | Scenario | Expected |
|---|---|---|
| `R5-CAND-01` | each row audited | one immutable audit row |
| `R5-CAND-02` | old NULL/new Candidate | exact values recorded |
| `R5-CAND-03` | missing source | abort |
| `R5-CAND-04` | audit insert fails | row update and batch roll back |
| `R5-CAND-05` | data update fails | audit and batch roll back |
| `R5-CAND-06` | duplicate request | replay existing result |
| `R5-CAND-07` | count mismatch | abort |
| `R5-CAND-08` | sealed/finalized digest | original unchanged; correction recorded |
| `R5-CAND-09` | non-unique source | abort |
| `R5-CAND-10` | source tables change | lock serialization only; runtime not verified |
| `R5-CAND-11` | non-Candidate field update | guard denies |

## Runtime Boundary

All matrix rows are offline design assertions unless explicitly marked otherwise.
No PostgreSQL or Runtime row has been executed.

