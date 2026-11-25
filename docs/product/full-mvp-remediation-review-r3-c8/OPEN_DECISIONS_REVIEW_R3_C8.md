# Open Decisions Review R3-C8

## Result

```text
Original Open Decisions: 57
Independently Reviewed: 57/57
Approved by User: 0
Still OPEN: 57
Implementation blockers: 57 remain open; 8 are current cross-cutting blockers
```

The C8 document preserves every original identifier and classifies each
decision as business, data, security, database, operations or deployment
choice. Its recommendations are explicitly non-binding. No approval evidence
exists.

## R2 Decisions

| ID | Decision class | Independent review | Remains blocking |
|---|---|---|---|
| `OD-R2-01` | Engineering authority | PRESENT / OPEN / options preserved | Formal Operational and rule data |
| `OD-R2-02` | Professional authority | PRESENT / OPEN / options preserved | Professional review permissions |
| `OD-R2-03` | Catalog approval authority | PRESENT / OPEN / options preserved | VERIFIED catalog transitions |
| `OD-R2-04` | Source retention/expiry | PRESENT / OPEN / options preserved | Source evidence |
| `OD-R2-05` | Price semantics | PRESENT / OPEN / options preserved | Price schema/quote behavior |
| `OD-R2-06` | Project type changes | PRESENT / OPEN / options preserved | Project mutation/backfill |
| `OD-R2-07` | Current requirement pointer | PRESENT / OPEN / options preserved | Project selection entry |
| `OD-R2-08` | Conversation/sales visibility | PRESENT / OPEN / options preserved | Conversation/sales APIs |
| `OD-R2-09` | Snapshot retention/visibility | PRESENT / OPEN / options preserved | Export/deletion |
| `OD-R2-10` | Demo identity | PRESENT / OPEN / options preserved | Demo startup |
| `OD-R2-11` | Effective-version ambiguity | PRESENT / OPEN / options preserved | Formal resolver |
| `OD-R2-12` | Legacy data disposition | PRESENT / OPEN / options preserved | Migration/formal query |
| `OD-R2-13` | Rule approval separation | PRESENT / OPEN / options preserved | Rule activation |
| `OD-R2-14` | Snapshot canonicalization | PRESENT / OPEN / options preserved | Snapshot/export |
| `OD-R2-15` | Legacy JSON mismatch | PRESENT / OPEN / options preserved | Requirement backfill |
| `OD-R2-16` | Professional workflow | PRESENT / OPEN / options preserved | Professional workflow |
| `OD-R2-17` | Sales assignment scope | PRESENT / OPEN / options preserved | Sales assignment/list |
| `OD-R2-18` | Source review cadence | PRESENT / OPEN / options preserved | Formal catalog trust |
| `OD-R2-19` | Preliminary result visibility | PRESENT / OPEN / options preserved | Customer recommendation UI |
| `OD-R2-20` | Formal rollout | PRESENT / OPEN / options preserved | Production |

## R3 Decisions

| ID | Decision class | Independent review | Remains blocking |
|---|---|---|---|
| `OD-R3-01` | Evidence archive | PRESENT / OPEN / options preserved | Source archive |
| `OD-R3-02` | Raw/text basis | PRESENT / OPEN / options preserved | Review-basis contract |
| `OD-R3-03` | Review history retention | PRESENT / OPEN / options preserved | Professional retention |
| `OD-R3-04` | Policy continuity | PRESENT / OPEN / options preserved | Review resolution across policy changes |
| `OD-R3-05` | Snapshot retention/export | PRESENT / OPEN / options preserved | Snapshot purge/export |
| `OD-R3-06` | Unmappable legacy scenario | PRESENT / OPEN / options preserved | Legacy mapping |
| `OD-R3-07` | RuleSet authority | PRESENT / OPEN / options preserved | RuleSet transitions |
| `OD-R3-08` | Failure persistence/replay | PRESENT / OPEN / options preserved | Advisor failure replay |
| `OD-R3-09` | Lost evidence | PRESENT / OPEN / options preserved | Evidence recovery |

## R3-C2 Decisions

| ID | Decision class | Independent review | Remains blocking |
|---|---|---|---|
| `OD-R3-C2-01` | Typed catalogue/units | PRESENT / OPEN / options preserved | Typed value DDL |
| `OD-R3-C2-02` | Evidence verifier | PRESENT / OPEN / options preserved | Archive verification |
| `OD-R3-C2-03` | Transition function owner | PRESENT / OPEN / options preserved | Function deployment |
| `OD-R3-C2-04` | Basis implementation authority | PRESENT / OPEN / options preserved | Snapshot verifier |

## R3-C3 Decisions

| ID | Decision class | Independent review | Remains blocking |
|---|---|---|---|
| `OD-R3-C3-01` | CUID/Text identity | PRESENT / OPEN / options preserved | Schema/data import |
| `OD-R3-C3-02` | Typed catalogue authority | PRESENT / OPEN / options preserved | Typed activation |
| `OD-R3-C3-03` | Transition ownership/grants | PRESENT / OPEN / options preserved | Function deployment |
| `OD-R3-C3-04` | Evidence archive/verifier | PRESENT / OPEN / options preserved | Source evidence |

## R3-C4 Decisions

| ID | Decision class | Independent review | Remains blocking |
|---|---|---|---|
| `OD-R3-C4-01` | Snapshot Registry approval | PRESENT / OPEN / options preserved | Snapshot schema |
| `OD-R3-C4-02` | Catalogue/units | PRESENT / OPEN / options preserved | Typed activation |
| `OD-R3-C4-03` | Event function ownership | PRESENT / OPEN / options preserved | Transition creation |
| `OD-R3-C4-04` | Registry rollout | PRESENT / OPEN / options preserved | Production rollout |

## R3-C5 Decisions

| ID | Decision class | Independent review | Remains blocking |
|---|---|---|---|
| `OD-R3-C5-01` | Identity broker/session binding | PRESENT / OPEN / options preserved | Principal/session deployment |
| `OD-R3-C5-02` | Snapshot/Basis rollout | PRESENT / OPEN / options preserved | Snapshot migration |
| `OD-R3-C5-03` | SourceKey storage | PRESENT / OPEN / options preserved | SourceKey DDL |
| `OD-R3-C5-04` | Reviewer/approver separation | PRESENT / OPEN / options preserved | Professional review |
| `OD-R3-C5-05` | Owner break-glass | PRESENT / OPEN / options preserved | Production privileged access |

## R3-C6 Decisions

| ID | Decision class | Independent review | Remains blocking |
|---|---|---|---|
| `OD-R3-C6-01` | Session assertion/broker | PRESENT / OPEN / options preserved | Session deployment |
| `OD-R3-C6-02` | Registry/Basis rollout | PRESENT / OPEN / options preserved | Snapshot migration |
| `OD-R3-C6-03` | Price validity | PRESENT / OPEN / options preserved | Price import/quotation |
| `OD-R3-C6-04` | Session role topology | PRESENT / OPEN / options preserved | Production session deployment |
| `OD-R3-C6-05` | Policy approval process | PRESENT / OPEN / options preserved | Policy events |

## R3-C7 Decisions

| ID | Decision class | Independent review | Remains blocking |
|---|---|---|---|
| `OD-R3-C7-01` | Function/deployment identity | PRESENT / OPEN / options preserved | Schema/migration |
| `OD-R3-C7-02` | PostgreSQL JSON/version | PRESENT / OPEN / options preserved | Policy/Basis activation |
| `OD-R3-C7-03` | Basis budget | PRESENT / OPEN / options preserved | Basis implementation |
| `OD-R3-C7-04` | Lock/retry/long transaction | PRESENT / OPEN / options preserved | Production concurrency |
| `OD-R3-C7-05` | View grants/break-glass | PRESENT / OPEN / options preserved | View deployment |
| `OD-R3-C7-06` | Evidence retention/export | PRESENT / OPEN / options preserved | Evidence retention |

## Review Conclusion

The classification is complete and no decision was silently approved. However,
several technical mechanisms in C8 depend on choices that remain OPEN, notably
identity broker/topology, function ownership/deployment identity, price policy,
locking limits and audit retrieval. Those dependencies must remain explicit
implementation blockers.
