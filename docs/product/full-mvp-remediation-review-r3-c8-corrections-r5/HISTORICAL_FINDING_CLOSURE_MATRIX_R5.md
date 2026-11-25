# Historical Finding Closure Matrix R5

## R2 Findings

| Finding | Independent status | Basis |
|---|---|---|
| `R2-P1-01` Bootstrap structure | `RESOLVED — INDEPENDENT STATIC REVIEW` | immutable Generation history and ordered Attempt model remain structurally present |
| `R2-P1-02` Catalog FK targets | `RESOLVED — INDEPENDENT STATIC REVIEW` | exact Catalog Source/Binding keys retained; 0 FK structural errors |
| `R2-P1-03` PUBLIC EXECUTE | `RESOLVED — INDEPENDENT STATIC REVIEW` | final PUBLIC revoke and role capability closure pass |
| `R2-P2-01` Result Recovery duplication | `RESOLVED — INDEPENDENT STATIC REVIEW` | one recovery per command request and replay-first retained |
| `R2-P2-02` Bootstrap replay/interruption | `RESOLVED — INDEPENDENT STATIC REVIEW` | Begin auto-sweep and committed expiry paths present; Runtime replay unverified |
| `R2-P2-03` Owner lock | `RESOLVED — INDEPENDENT STATIC REVIEW` | owner closure and identity advisory lock present |
| `R2-P2-04` Principal ACTIVE | `RESOLVED — INDEPENDENT STATIC REVIEW` | active checks plus R5 current-Root Execute gate |
| `R2-P2-05` Catalog Actor Grant | `RESOLVED — INDEPENDENT STATIC REVIEW` | composite Session/Grant/Principal relation retained |
| `R2-P2-06` Validator | `PARTIALLY RESOLVED` | literal mutations reproduce, but independent negative evidence remains incomplete |
| `R2-P3-01` State/timestamp | `RESOLVED — INDEPENDENT STATIC REVIEW` | terminal Attempt and terminalization constraints present; time-order warning remains |
| `R2-P3-02` Guard outcome | `RESOLVED — INDEPENDENT STATIC REVIEW` | Guard records child exit and finish time |

## R3 Findings

| Finding | Independent status | Basis |
|---|---|---|
| `REV-R3-R3-P2-01` | `RESOLVED — INDEPENDENT STATIC REVIEW` | expiry helper has no update-then-raise or swallowed-write path |
| `REV-R3-R3-P2-02` | `RESOLVED — INDEPENDENT STATIC REVIEW` | terminal history no longer blocks next ordered Attempt |
| `REV-R3-R3-P2-03` | `PARTIALLY RESOLVED` | 29/29 and 12/12 literal mutation targets apply; 22-rule independent suite is 21/22 |
| `REV-R3-R3-P3-01` | `RESOLVED — INDEPENDENT STATIC REVIEW` | both Candidate NOT NULL constraints and composite FKs present |

## R4 Independent Findings

| Finding | Independent status | Basis |
|---|---|---|
| `REV-R4-IND-P2-01` | `RESOLVED — INDEPENDENT STATIC REVIEW` | Execute Root gate and Generation Trigger form complete static ROTATION check |
| `REV-R4-IND-P2-02` | `RESOLVED — INDEPENDENT STATIC REVIEW` | expired Attempt auto-terminalization and next Attempt are atomic in one function |
| `REV-R4-IND-P2-03` | `PARTIALLY RESOLVED` | row audit complete; Actor binding incomplete |
| `REV-R4-IND-P3-01` | `PARTIALLY RESOLVED` | Candidate/TX-09 repaired; vector ID drift remains |

## R5 Findings

| Finding | Severity | Status |
|---|---|---|
| `REV-R5-IND-P2-01` Function Registry security/search_path | P2 | `NOT RESOLVED` |
| `REV-R5-IND-P2-02` hardcoded response-loss result | P2 | `PARTIALLY RESOLVED` |
| `REV-R5-IND-P2-03` Candidate actor binding | P2 | `PARTIALLY RESOLVED` |
| `REV-R5-IND-P2-04` non-mutation evidence/Open Decisions check | P2 | `PARTIALLY RESOLVED` |
| `REV-R5-IND-P3-01` state-vector ID drift | P3 | `NOT RESOLVED` |
| `REV-R5-IND-P3-02` Begin time before Attempt lock | P3 | `PARTIALLY RESOLVED` |

## Non-Promotions

No historical status was promoted to Runtime or implementation verification.
All PostgreSQL, Catalog, Trigger, lock and concurrency checks remain outside
this review.

