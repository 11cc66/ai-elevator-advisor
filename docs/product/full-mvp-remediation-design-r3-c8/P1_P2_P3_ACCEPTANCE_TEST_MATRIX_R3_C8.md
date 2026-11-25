# P1 / P2 / P3 Acceptance Test Matrix R3-C8

## P1

| Finding | Positive Test | Negative/Adversarial Test | Acceptance |
|---|---|---|---|
| P1-01 candidate binding | create candidate/result/snapshot from one product/spec/rule set | same result ID with changed product/spec/digest/ruleset/status | full result-digest FK/trigger rejects |
| P1-02 child completeness | create all source/review/warning/missing rows then finalize | omit, duplicate, alter or cross-run one child | both-direction set comparison or child digest trigger rejects |
| P1-03 session binding | activate one session role on one backend | shared runtime role, copied role on second backend, wrong token, stale epoch | `open/activate/lock` rejects |
| P1-04 privilege chain | broker opens session; worker creates/seals; reviewer transitions | runtime direct INSERT/UPDATE/DELETE/TRUNCATE; PUBLIC execute | owner succeeds, runtime direct DML fails |
| P1-05 create paths | empty DB -> run -> candidate -> price/param -> result -> seal -> snapshot; create professional review | skip controlled function or insert source row directly | controlled path succeeds; direct DML denied |
| P1-06 session View | active caller reads own/subject-scoped sessions | unbound caller or unrelated principal queries audit View | zero rows/rejection; revoked rows only in audit |

## P2

| Finding | Positive Test | Negative Test |
|---|---|---|
| P2-01 encoder parity | valid C6/scalar vectors | 19-digit Decimal, wrong Header type, wrong StableKey arity |
| P2-02 Unicode | NFC source | NFD, invalid UTF-8, C1 control, 129-byte auxiliary |
| P2-03 idempotency | same Request ID/hash after lost response | same ID/different hash; concurrent duplicate |
| P2-04 grant scope | normal project grant with recipient Principal and no subject; separately issued subject-scoped audit grant | ordinary grant carrying a subject, audit grant without subject, other session/recipient/project/action, or implicit scope mismatch |
| P2-05 state/pointer | closed state values and valid pointer | unknown state, wrong Revision/Event/Policy tuple |
| P2-06 truncate | normal lifecycle commit | TRUNCATE every protected selection/policy table |

## P3

| Item | Acceptance |
|---|---|
| duplicate assignment | canonical content is assigned once; digest unchanged |

## Test Classifications

```text
Static DDL structure: to be executed offline
Node/Python encoding: to be executed offline
PostgreSQL constraint/trigger/ACL/concurrency: NOT EXECUTED — DATABASE NOT AUTHORIZED
Runtime: NOT EXECUTED — RUNTIME NOT AUTHORIZED
```
