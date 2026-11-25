# Acceptance Test Matrix R3

| Finding | Positive | Negative | Boundary |
|---|---|---|---|
| P1-01 | valid Generation N→N+1 issuance | wrong/missing columns, mutable history, duplicate approval | lost response, failed issuance, concurrent execute |
| P1-02 | exact Product/Spec/Price Binding and Event | non-unique target, cross source/target, wrong Project/digest | source evidence mutation, binding/event update |
| P1-03 | final PUBLIC revoke with explicit role grants | omitted revoke, scoped schema, direct helper grant | SET ROLE, Schema USAGE, Default Privilege path |
| P2-01 | one two-approval result recovery | duplicate recovery, changed payload/Principal/Epoch | lost approval/result response |
| P2-02 | replay-first Begin/Approve/Execute | old Generation, stale approval, revoked Session | failed new issuance, retry, denial |
| P2-03 | Owner advisory lock implemented | docs-only lock, missing key/order | role/Owner change during request |
| P2-04 | ACTIVE Root+Approvers locked/rechecked | disabled Principal or Operator | concurrent disable |
| P2-05 | exact actor Session/Grant/Principal FK | cross-session/Principal Grant | revoked Grant |
| P2-06 | structural Validator detects R2 defects | missing file/hash/object/ACL | malformed DDL |
| P3-01 | valid state/timestamp combinations | ACTIVE with revoked timestamp, ISSUED without completion | rollback |
| P3-02 | guard records exit code/finish | missing/false success evidence | child failure |

## Verification Classes

```text
Static structure: PASS/FAIL in VALIDATION_EVIDENCE_R3.json
Formal mutations: 29 required root/owner/catalog classes
R2 mutations: 12 replayed
C6-SNAP-01: exact bytes/hash
R6 vectors: 23 scalar + 14 resource
PostgreSQL grammar/compilation/catalog/concurrency: NOT VERIFIED
```

