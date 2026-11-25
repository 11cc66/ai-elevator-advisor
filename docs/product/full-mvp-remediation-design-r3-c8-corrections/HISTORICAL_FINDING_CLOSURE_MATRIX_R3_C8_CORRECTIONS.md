# Historical Finding Closure Matrix R3-C8 Corrections

## Rule

Design work can only be `DESIGN-ADDRESSED — PENDING INDEPENDENT REVIEW`.
No historical finding is marked `RESOLVED` by this corrections phase alone.

## R3-C4

| Finding | State |
|---|---|
| `P1-01` stableKey | DESIGN-ADDRESSED — C6 vector unchanged |
| `P1-02` Basis bytes | DESIGN-ADDRESSED — C6 vector unchanged |
| `P1-03` Registry/Schema/Basis | DESIGN-ADDRESSED — Price/source completeness correction |
| `P1-04` actor/state | DESIGN-ADDRESSED — role closure/bootstrap/event identity |
| `P2-01` policy equality | DESIGN-ADDRESSED — retained Policy FKs/triggers |
| `P2-02` deferred validation | DESIGN-ADDRESSED — 12 deferred triggers retained |
| `P2-03` exact FKs | DESIGN-ADDRESSED — new source/target FKs |
| `P2-04` privileges | DESIGN-ADDRESSED — role closure/CONNECT/bootstrap |
| `P2-05` field order | DESIGN-ADDRESSED — C6/SK-R2 unchanged |
| `P2-06` source domain | DESIGN-ADDRESSED — full source-aux path |
| `P3-01` wording | DESIGN-ADDRESSED — preserved |

## R3-C5

| Finding | State |
|---|---|
| `P1-02` provenance | DESIGN-ADDRESSED — Price/Requirement/Catalog/Review |
| `P1-03` session lifecycle | DESIGN-ADDRESSED — backend/epoch/role closure |
| `P1-04` policy lifecycle | DESIGN-ADDRESSED — retained and reviewed |
| `P2-02` deferred validation | DESIGN-ADDRESSED — source content and state triggers |
| `P2-04` privileges | DESIGN-ADDRESSED — bootstrap/CONNECT/ownership |

## R3-C6

| Finding | State |
|---|---|
| `P1-01` root/selection provenance | DESIGN-ADDRESSED |
| `P1-02` undefined functions | DESIGN-ADDRESSED — Registry generated |
| `P1-03` session race | DESIGN-ADDRESSED — lock/recheck retained |
| `P1-04` policy digest/event | DESIGN-ADDRESSED — retained |
| `P2-01` views | DESIGN-ADDRESSED — caller/scoped views retained |
| `P2-02` signatures/grants | DESIGN-ADDRESSED — corrections registry |
| `P2-03` replay order | DESIGN-ADDRESSED — ledger semantics |
| `P2-04` Basis limits | DESIGN-ADDRESSED — C6/R6 unchanged |
| `P2-05` scalar vectors | DESIGN-ADDRESSED — offline vectors retained |
| `P2-06` SourceKey boundary | DESIGN-ADDRESSED — source validation |

## R3-C7

| Finding | State |
|---|---|
| `P1-01` candidate binding | DESIGN-ADDRESSED |
| `P1-02` child/source completeness | DESIGN-ADDRESSED — new authoritative facts and full row digests |
| `P1-03` session binding | DESIGN-ADDRESSED — recursive closure/backend recheck |
| `P1-04` privilege graph | DESIGN-ADDRESSED — bootstrap/CONNECT/grants |
| `P1-05` creation path | DESIGN-ADDRESSED — controlled facts/reviews/events |
| `P1-06` status View | DESIGN-ADDRESSED — retained scoped views |
| `P2-01` R6 parity | DESIGN-ADDRESSED — static aligned |
| `P2-02` SourceKey NFC | DESIGN-ADDRESSED — shared helper |
| `P2-03` replay | DESIGN-ADDRESSED — session/epoch semantics |
| `P2-04` AuthorityGrant | DESIGN-ADDRESSED — bootstrap/recipient/subject |
| `P2-05` Policy lifecycle | DESIGN-ADDRESSED — retained |
| `P2-06` TRUNCATE | DESIGN-ADDRESSED — review guard added |
| `P3-01` duplicate assignment | DESIGN-ADDRESSED — retained cleanup |
