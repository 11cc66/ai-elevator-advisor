# Historical Finding Closure Matrix R3-C8

## R3-C4

| Finding | C7 Status | C8 Design |
|---|---|---|
| `P1-01` stableKey | RESOLVED | preserved, independent C6 check |
| `P1-02` Basis vector | RESOLVED | preserved |
| `P1-03` Registry/Schema/Basis | NOT RESOLVED | DESIGN-ADDRESSED: candidate/child digests and completeness |
| `P1-04` actor/state | PARTIAL | DESIGN-ADDRESSED: connection-bound Session and exact grant |
| `P2-01` policy equality | RESOLVED | preserved plus pointer composite FKs |
| `P2-02` deferred validation | RESOLVED static | expanded completeness checks |
| `P2-03` exact FKs | NOT RESOLVED | DESIGN-ADDRESSED by result/source digest FKs |
| `P2-04` privileges | NOT RESOLVED | DESIGN-ADDRESSED by full role matrix |
| `P2-05` field order | RESOLVED | preserved |
| `P2-06` source domain | RESOLVED static | SQL NFC normalization and schema checks |
| `P3-01` wording | RESOLVED | preserved |

## R3-C5

| Finding | C7 Status | C8 Design |
|---|---|---|
| `P1-02` provenance | NOT RESOLVED | DESIGN-ADDRESSED by source digests/completeness |
| `P1-03` session lifecycle | NOT RESOLVED | DESIGN-ADDRESSED by backend/token binding |
| `P1-04` policy lifecycle | FULLY RESOLVED core | improved pointer/request/append-only safeguards |
| `P2-02` deferred validation | PARTIAL | DESIGN-ADDRESSED by complete selected-set checks |
| `P2-04` privileges | NOT RESOLVED | DESIGN-ADDRESSED by exact owner/broker/capability matrix |

## R3-C6

| Finding | C7 Status | C8 Design |
|---|---|---|
| `P1-01` provenance | NOT RESOLVED | DESIGN-ADDRESSED |
| `P1-02` undefined functions | RESOLVED static | extended function registry |
| `P1-03` session race | RESOLVED lock-level | connection-bound session protocol |
| `P1-04` policy digest/event | RESOLVED | pointer/request and view isolation enhanced |
| `P2-01` views | RESOLVED DDL level | caller-bound session/audit Views |
| `P2-02` grant signatures | RESOLVED | final registry/validator |
| `P2-03` replay order | RESOLVED | unchanged and extended to create/seal ledger |
| `P2-04` basis limits | RESOLVED | unchanged |
| `P2-05` scalar negative vectors | RESOLVED offline | unchanged |
| `P2-06` SourceKey boundary | RESOLVED offline | SQL normalization aligned |

## R3-C7

All 13 R3-C7 findings have an explicit C8 correction location. Independent
closure remains `PENDING` until a later R3-C8 review.
