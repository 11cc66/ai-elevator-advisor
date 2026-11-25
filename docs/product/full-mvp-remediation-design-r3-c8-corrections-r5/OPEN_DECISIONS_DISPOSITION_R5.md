# Open Decisions Disposition R5

```text
Original IDs: 57
Present and unique: 57/57
Approved by User: 0
Still OPEN: 57
```

No R5 document approves a business, identity, credential, emergency, retention,
price, deployment or recovery-policy decision.

| ID | State | Implementation dependency |
|---|---|---|
| `OD-R2-01` | OPEN | Rule values/authority |
| `OD-R2-02` | OPEN | Professional review authority |
| `OD-R2-03` | OPEN | Catalog review authority |
| `OD-R2-04` | OPEN | Source/evidence retention |
| `OD-R2-05` | OPEN | Price validity |
| `OD-R2-06` | OPEN | Scenario mutation |
| `OD-R2-07` | OPEN | Requirement head |
| `OD-R2-08` | OPEN | Conversation visibility |
| `OD-R2-09` | OPEN | Snapshot retention |
| `OD-R2-10` | OPEN | Demo identity |
| `OD-R2-11` | OPEN | Effective versions |
| `OD-R2-12` | OPEN | Legacy quarantine |
| `OD-R2-13` | OPEN | Rule approval split |
| `OD-R2-14` | OPEN | Historical Basis |
| `OD-R2-15` | OPEN | Legacy JSON |
| `OD-R2-16` | OPEN | Review workflow |
| `OD-R2-17` | OPEN | Sales assignment |
| `OD-R2-18` | OPEN | Source cadence |
| `OD-R2-19` | OPEN | Preliminary visibility |
| `OD-R2-20` | OPEN | Production rollout |
| `OD-R3-01` | OPEN | Evidence archive |
| `OD-R3-02` | OPEN | Raw/text Basis |
| `OD-R3-03` | OPEN | Review retention |
| `OD-R3-04` | OPEN | Policy continuity |
| `OD-R3-05` | OPEN | Snapshot export/delete |
| `OD-R3-06` | OPEN | Legacy scenario |
| `OD-R3-07` | OPEN | RuleSet authority |
| `OD-R3-08` | OPEN | Failure replay |
| `OD-R3-09` | OPEN | Lost evidence |
| `OD-R3-C2-01` | OPEN | Catalogue/units |
| `OD-R3-C2-02` | OPEN | Archive verifier |
| `OD-R3-C2-03` | OPEN | Transition owner |
| `OD-R3-C2-04` | OPEN | Basis authority |
| `OD-R3-C3-01` | OPEN | Identity format |
| `OD-R3-C3-02` | OPEN | Typed catalog |
| `OD-R3-C3-03` | OPEN | Transition grants |
| `OD-R3-C3-04` | OPEN | Archive verifier |
| `OD-R3-C4-01` | OPEN | Registry approval |
| `OD-R3-C4-02` | OPEN | Catalogue/units |
| `OD-R3-C4-03` | OPEN | Event owner |
| `OD-R3-C4-04` | OPEN | Registry rollout |
| `OD-R3-C5-01` | OPEN | Identity broker |
| `OD-R3-C5-02` | OPEN | Snapshot rollout |
| `OD-R3-C5-03` | OPEN | SourceKey storage |
| `OD-R3-C5-04` | OPEN | Reviewer separation |
| `OD-R3-C5-05` | OPEN | Break-glass |
| `OD-R3-C6-01` | OPEN | Session assertion |
| `OD-R3-C6-02` | OPEN | Snapshot rollout |
| `OD-R3-C6-03` | OPEN | Price validity |
| `OD-R3-C6-04` | OPEN | Role topology |
| `OD-R3-C6-05` | OPEN | Policy approval |
| `OD-R3-C7-01` | OPEN | Deployment identities |
| `OD-R3-C7-02` | OPEN | PostgreSQL JSON/version |
| `OD-R3-C7-03` | OPEN | Basis budget |
| `OD-R3-C7-04` | OPEN | Lock/retry limits |
| `OD-R3-C7-05` | OPEN | View/break-glass |
| `OD-R3-C7-06` | OPEN | Evidence retention |

## R5-specific Fail-Closed Dependencies

Until separately approved:

- no automatic Candidate backfill actor identity is invented;
- no Identity Broker, Session provisioning or Root credential custody is chosen;
- no recovery maximum or break-glass bypass is introduced;
- no Candidate audit retention period is invented;
- no ROTATION is allowed without the complete current Root graph;
- no RECOVERY is converted into ROTATION;
- no database execution or Runtime is authorized.

