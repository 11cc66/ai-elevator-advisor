# Open Decisions Review R3-C8 Corrections

## Result

```text
Original Open Decisions: 57
Independently Reviewed: 57/57
Approved by User: 0
Still OPEN: 57
Implementation Blockers: 57
Cross-Cutting Blockers: 8
```

All original IDs and meanings are preserved. A technical mechanism in the
Corrections is not approval of the underlying business, authority, retention,
deployment or production policy.

## R2 Decisions

| ID | Independent state | Remaining blocker |
|---|---|---|
| `OD-R2-01` | OPEN — options preserved | Formal Operational/rule values |
| `OD-R2-02` | OPEN — options preserved | Professional-review authority |
| `OD-R2-03` | OPEN — options preserved | Catalog reviewer/content authority |
| `OD-R2-04` | OPEN — options preserved | Evidence/source retention |
| `OD-R2-05` | OPEN — options preserved | Price validity and historical-price policy |
| `OD-R2-06` | OPEN — options preserved | Scenario mutation/backfill |
| `OD-R2-07` | OPEN — options preserved | Requirement-head policy |
| `OD-R2-08` | OPEN — options preserved | Conversation/sales visibility |
| `OD-R2-09` | OPEN — options preserved | Snapshot retention/visibility |
| `OD-R2-10` | OPEN — options preserved | Demo identity |
| `OD-R2-11` | OPEN — options preserved | Effective-version resolution |
| `OD-R2-12` | OPEN — options preserved | Legacy quarantine/backfill |
| `OD-R2-13` | OPEN — options preserved | Rule author/approver separation |
| `OD-R2-14` | OPEN — options preserved | Historical Basis compatibility |
| `OD-R2-15` | OPEN — options preserved | Legacy JSON repair/backfill |
| `OD-R2-16` | OPEN — options preserved | Professional workflow |
| `OD-R2-17` | OPEN — options preserved | Sales assignment scope |
| `OD-R2-18` | OPEN — options preserved | Source-review cadence |
| `OD-R2-19` | OPEN — options preserved | Preliminary-result visibility |
| `OD-R2-20` | OPEN — options preserved | Production rollout |

## R3 Decisions

| ID | Independent state | Remaining blocker |
|---|---|---|
| `OD-R3-01` | OPEN — options preserved | Evidence archive |
| `OD-R3-02` | OPEN — options preserved | Raw/text Basis contract |
| `OD-R3-03` | OPEN — options preserved | Review-event retention |
| `OD-R3-04` | OPEN — options preserved | Policy continuity |
| `OD-R3-05` | OPEN — options preserved | Snapshot export/deletion |
| `OD-R3-06` | OPEN — options preserved | Legacy scenario disposition |
| `OD-R3-07` | OPEN — options preserved | RuleSet authority |
| `OD-R3-08` | OPEN — options preserved | Failure persistence/replay |
| `OD-R3-09` | OPEN — options preserved | Lost-evidence recovery |

## R3-C2 Decisions

| ID | Independent state | Remaining blocker |
|---|---|---|
| `OD-R3-C2-01` | OPEN — options preserved | Typed catalog/units |
| `OD-R3-C2-02` | OPEN — options preserved | Archive verifier identity |
| `OD-R3-C2-03` | OPEN — options preserved | Transition owner |
| `OD-R3-C2-04` | OPEN — options preserved | Basis implementation authority |

## R3-C3 Decisions

| ID | Independent state | Remaining blocker |
|---|---|---|
| `OD-R3-C3-01` | OPEN — options preserved | CUID/Text identity |
| `OD-R3-C3-02` | OPEN — options preserved | Typed catalog authority |
| `OD-R3-C3-03` | OPEN — options preserved | Transition ownership/grants |
| `OD-R3-C3-04` | OPEN — options preserved | Archive/verifier |

## R3-C4 Decisions

| ID | Independent state | Remaining blocker |
|---|---|---|
| `OD-R3-C4-01` | OPEN — options preserved | Snapshot Registry approval |
| `OD-R3-C4-02` | OPEN — options preserved | Catalog/unit domains |
| `OD-R3-C4-03` | OPEN — options preserved | Event function ownership |
| `OD-R3-C4-04` | OPEN — options preserved | Snapshot Registry rollout |

## R3-C5 Decisions

| ID | Independent state | Remaining blocker |
|---|---|---|
| `OD-R3-C5-01` | OPEN — options preserved | Identity broker/session binding |
| `OD-R3-C5-02` | OPEN — options preserved | Snapshot/Basis rollout |
| `OD-R3-C5-03` | OPEN — options preserved | SourceKey storage derivation |
| `OD-R3-C5-04` | OPEN — options preserved | Reviewer/approver separation |
| `OD-R3-C5-05` | OPEN — options preserved | Break-glass ownership |

## R3-C6 Decisions

| ID | Independent state | Remaining blocker |
|---|---|---|
| `OD-R3-C6-01` | OPEN — options preserved | Session assertion/broker |
| `OD-R3-C6-02` | OPEN — options preserved | Registry/Basis rollout |
| `OD-R3-C6-03` | OPEN — options preserved | Price validity policy |
| `OD-R3-C6-04` | OPEN — options preserved | Session-role topology |
| `OD-R3-C6-05` | OPEN — options preserved | Policy approval separation |

## R3-C7 Decisions

| ID | Independent state | Remaining blocker |
|---|---|---|
| `OD-R3-C7-01` | OPEN — options preserved | Function/deployment identities |
| `OD-R3-C7-02` | OPEN — options preserved | PostgreSQL JSON/version policy |
| `OD-R3-C7-03` | OPEN — options preserved | Basis resource budget |
| `OD-R3-C7-04` | OPEN — options preserved | Lock/retry/long-transaction limits |
| `OD-R3-C7-05` | OPEN — options preserved | View grants/break-glass |
| `OD-R3-C7-06` | OPEN — options preserved | Evidence retention/export |

## Cross-Cutting Blockers

1. identity broker/assertion and credential custody;
2. session-role provisioning and connection topology;
3. function/deployment ownership;
4. bootstrap/root recovery ownership;
5. Policy author/approver separation;
6. price validity and historical-price policy;
7. evidence retention/export;
8. break-glass and production role ownership.

## Corrections Impact

The Corrections introduces mechanisms for Price facts, source/event identity,
bootstrap, role closure, Request Ledger and Source-Aux. Those mechanisms do not
supply user approval for any decision ID. All 57 remain blockers for Schema,
Migration, Runtime or Production to the extent stated by their original
decision scope.
