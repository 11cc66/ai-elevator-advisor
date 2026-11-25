# Open Decisions Independent Audit R5

## Result

```text
Original IDs: 57
Present: 57
Unique: 57
User-approved: 0
Still OPEN: 57
```

The exact 57 IDs from R4 are preserved. No R5 document converts an Open
Decision to APPROVED.

## Complete ID Audit

| ID | State | R5 dependency |
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

## Critical Dependencies

| Decision area | R5 dependency | Current behavior |
|---|---|---|
| `OD-R3-C5-01` Identity Broker | Root/target identity provisioning | Fail Closed; no auto-provision at Execute |
| `OD-R3-C6-04` Role topology | Session/Root role provisioning | Fail Closed |
| `OD-R3-C5-04` Reviewer separation | two-support-approval integrity | required, but external identity authority remains OPEN |
| `OD-R3-C5-05` Break-glass | emergency access | prohibited; no bypass |
| `OD-R3-C7-04` Lock/retry limits | Recovery concurrency operation | conservative normal flow only |
| `OD-R2-04`/`OD-R3-03`/`OD-R3-C7-06` | Candidate audit retention | no retention period approved; evidence retained for design only |
| Candidate maintenance identity | controlled backfill actor | no approved executable maintenance identity |

## R5-specific Actions

The following remain blocked until user decisions and separate implementation
authorization:

- provisioning the target Root Principal/Epoch;
- defining the authority grant/code for Candidate maintenance;
- enabling the Candidate backfill function for any role;
- configuring retry maximums, cooldowns or emergency recovery;
- archive/retention/export/delete policy for new evidence tables;
- establishing deployment roles, Owners, Default Privileges and Catalog ACLs.

## Independent Safety Conclusion

The design remains fail-closed where the required identity objects are absent.
This does not approve any Open Decision and does not make the design
implementation-ready.

