# Historical Finding Closure Matrix R5

## R2 Findings

| Finding | R5 design status | Basis |
|---|---|---|
| `R2-P1-01` Bootstrap structure | `RESOLVED — DESIGN` | immutable Generation and ordered Attempt retained |
| `R2-P1-02` Catalog FK targets | `RESOLVED — DESIGN` | exact Source/Binding keys retained; 0 FK structure errors |
| `R2-P1-03` PUBLIC EXECUTE | `RESOLVED — DESIGN` | final PUBLIC revoke and exact R4 capability map retained |
| `R2-P2-01` Result Recovery duplication | `RESOLVED — DESIGN` | one recovery per command request and replay-first retained |
| `R2-P2-02` Bootstrap replay/interruption | `RESOLVED — DESIGN` | committed expiry plus Begin auto-sweep added |
| `R2-P2-03` Owner advisory lock | `RESOLVED — DESIGN` | owner lock and R5 identity lock retained |
| `R2-P2-04` Root/Approver ACTIVE | `RESOLVED — DESIGN` | Begin, Approve, Deny and Execute checks; Execute Root recheck added |
| `R2-P2-05` Catalog Actor Grant | `RESOLVED — DESIGN` | composite Session/Grant/Principal relation retained |
| `R2-P2-06` Validator | `RESOLVED — DESIGN` | 29/12/46 and 22 independent rules |
| `R2-P3-01` State/timestamp invariants | `RESOLVED — DESIGN` | terminal Attempt and R5 terminalization constraints |
| `R2-P3-02` Guard completion evidence | `RESOLVED — DESIGN` | R5 Guard records child exit/finish evidence |

## R3 Independent Findings

| Finding | R5 status | Basis |
|---|---|---|
| `REV-R3-R3-P2-01` | `RESOLVED — DESIGN` | no update-then-raise expiry path |
| `REV-R3-R3-P2-02` | `RESOLVED — DESIGN` | terminal-preserving Attempt history |
| `REV-R3-R3-P2-03` | `RESOLVED — DESIGN` | all formal and independent mutations detected |
| `REV-R3-R3-P3-01` | `RESOLVED — DESIGN` | both Candidate columns NOT NULL with composite FKs |

## R4 Independent Findings

| Finding | R5 status | Basis |
|---|---|---|
| `REV-R4-IND-P2-01` | `RESOLVED — DESIGN` | mutex, Execute gate and Generation Trigger |
| `REV-R4-IND-P2-02` | `RESOLVED — DESIGN` | Begin expired sweep and terminal evidence |
| `REV-R4-IND-P2-03` | `RESOLVED — DESIGN` | batch and per-row durable audit |
| `REV-R4-IND-P3-01` | `RESOLVED — DESIGN` | canonical registry and repaired references |

## Non-Promotions

`RESOLVED — DESIGN` is not:

- independent R5 review;
- PostgreSQL compilation;
- Catalog ACL verification;
- Trigger or constraint execution;
- concurrent transaction proof;
- Runtime readiness;
- implementation authorization.

All historical `NOT VERIFIED`, `PARTIAL`, Open Decision and Runtime items remain
visible in `UNVERIFIED_ITEMS_R5.md`.

