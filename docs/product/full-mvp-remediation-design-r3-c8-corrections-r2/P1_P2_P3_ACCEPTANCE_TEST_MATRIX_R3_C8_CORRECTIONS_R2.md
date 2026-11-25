# P1/P2/P3 Acceptance Test Matrix R3-C8 Corrections R2

## P1

| ID | Positive | Negative | Concurrency / boundary | Evidence |
|---|---|---|---|---|
| `REV-R3-C8-CORRECTIONS-P1-01` Root Principal | exact role/state/session/grant identity completes | any Principal, role, issuance or recipient mismatch rejects | two completions serialize; replay returns same Grant | `ROOT_PRINCIPAL_BINDING_R3_C8_R2.md`; root case matrix; root mutation |
| `REV-R3-C8-CORRECTIONS-P1-02` Owner Closure | exact CONNECT/memberships/attributes passes | database, schema, relation, function or type Owner path rejects | closure digest stable through request | `OWNER_PRIVILEGE_CLOSURE_R3_C8_R2.md`; 14 owner cases; owner mutations |
| `REV-R3-C8-CORRECTIONS-P1-03` Catalog Binding | exact Source and exact target binding accepted | cross-source, revision, digest, project or target rejects | event/binding/selection/snapshot identity stable | `CATALOG_SOURCE_TARGET_BINDING_R3_C8_R2.md`; 10 catalog cases; catalog mutations |

## P2

| ID | Positive | Negative | Boundary | Evidence |
|---|---|---|---|---|
| `REV-R3-C8-CORRECTIONS-P2-01` Recovery | lost response replays one root Grant; approved rotation creates one new generation | one approval, same approver, stale generation, duplicate root, old root still active rejects | concurrent root change locks lifecycle | bootstrap case matrix; recovery mutation |
| `REV-R3-C8-CORRECTIONS-P2-02` Ledger Revocation | normal close/expiry replays safely; approved recovery returns result once | security revoke, disabled principal, different Principal, stale epoch, changed payload rejects | recovery consumes once; no command re-execution | request case matrix; original-session mutation |
| `REV-R3-C8-CORRECTIONS-P2-03` Validator | detects removed Root/Owner/Catalog/Bootstrap/Request/Domain guards | missing file or object fails closed | mutation evidence records expected/new failures | `VALIDATION_R3_C8_CORRECTIONS_R2.json` |

## P3

| ID | Positive | Negative | Boundary | Evidence |
|---|---|---|---|---|
| `REV-R3-C8-CORRECTIONS-P3-01` FieldValue Domains | typed confirmed/proposed payloads accepted | null misuse, unit misuse, bad NFC/control/type/shape rejects | Requirement/Selection/Snapshot shared trigger | field-domain mutation; R6 vectors |
| `REV-R3-C8-CORRECTIONS-P3-02` Execution Guard | verified pwsh 7.6.9 launches Python child | CMD/Bash/wrong path/PID parent mismatch fails before tool | wrong output root or direct Python launch fails | guard self-test; `SHELL_GUARD_EVIDENCE...`; shell mutation |

## Offline Classes

```text
Static design checks:
  PASS/FAIL recorded in evidence/VALIDATION_R3_C8_CORRECTIONS_R2.json

Offline compatibility:
  C6-SNAP-01 exact bytes/hash
  R6 23 scalar + 14 resource vectors

Design case matrices:
  Root 10 cases
  Owner 15 cases
  Catalog 10 cases
  Recovery 10 cases
  Request 10 cases

PostgreSQL grammar:
  NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER

PostgreSQL constraints/triggers/ACL/concurrency:
  NOT VERIFIED — DATABASE/RUNTIME NOT AUTHORIZED
```

