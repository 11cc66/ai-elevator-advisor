# P1/P2/P3 Acceptance Test Matrix R4

## R2 Historical Findings

| Finding | Positive evidence | Negative evidence | R4 result |
|---|---|---|---|
| P1-01 Bootstrap structure | immutable Generation FKs, recovery R4 flow | mutable/source-column mutations | Design accepted |
| P1-02 Catalog target identity | exact Source/Binding PK FKs | target-key and digest mutations | Design accepted |
| P1-03 PUBLIC ACL | final PUBLIC revoke and explicit capability map | missing PUBLIC revoke/helper grant | Design accepted |
| P2-01 Result Recovery | one record per Request, replay first | duplicate/terminal-first replay | Design accepted |
| P2-02 Bootstrap replay/interruption | commit LOCKED, ordered new Attempt, failed issuance Begin | rollback expiry, old unique, stale Execute | Design accepted |
| P2-03 Owner lock | advisory xact lock | absent lock mutation | Design accepted |
| P2-04 ACTIVE Principal | ACTIVE rechecks under lock | disabled Principal path | Design accepted |
| P2-05 Catalog actor Grant | composite Session/Grant/Principal FK | pair mismatch | Design accepted |
| P2-06 Validator | final-definition and semantic checks | 29/29 + 12/12 + 46/46 mutations | Design accepted |
| P3-01 State/timestamps | named constraints including R4 terminal fields | invalid terminal timestamps | Design accepted |
| P3-02 Guard evidence | child exit and finish recorded | failure-with-verified-only evidence | Design accepted |

## R3 Findings

| Finding | Positive | Negative | Status |
|---|---|---|---|
| R3 P2-01 | normal expiry transaction commits LOCKED | update-then-RAISE, swallowed exception | `RESOLVED — DESIGN` |
| R3 P2-02 | Denied/Locked -> next Attempt | old unique, duplicate active, caller sequence | `RESOLVED — DESIGN` |
| R3 P2-03 | semantic Validator detects target defects | text-only PASS, unrelated failure | `RESOLVED — DESIGN` |
| R3 P3-01 | both Candidate columns NOT NULL | NULL injection, invented backfill | `RESOLVED — DESIGN` |

## Must Be Proven Only by Real PostgreSQL

- Complete DDL parses on PostgreSQL 18.
- Exact unique keys and FKs are accepted by the Catalog.
- Partial unique index accepts terminal history and rejects two active rows.
- Row locks serialize Begin/Approve/Execute.
- PL/pgSQL error paths produce the intended COMMIT/ROLLBACK.
- Audit/Event sequence uniqueness under concurrent calls.
- Candidate backfill row counts are unambiguous on existing data.
- ALTER TABLE lock duration and migration interruption behavior.
- Final ACL and function Owners in the Catalog.

## Must Be Proven Only by Runtime/Integration

- RPC or application retries after lost response.
- Connection failure during COMMIT.
- Concurrent callers through real pool connections.
- Root provisioning and credential-custody path.
- Break-glass and emergency behavior after user approval.
- Any file/Storage side effect. None is authorized in this stage.

## Test-State Labels

```text
Offline structural checks: COMPLETED
Offline mutations: COMPLETED
Offline state models: COMPLETED
PostgreSQL compilation: NOT VERIFIED
Database constraints/Triggers: NOT VERIFIED
Runtime concurrency: NOT EXECUTED
Storage: NOT ACCESSED
```
