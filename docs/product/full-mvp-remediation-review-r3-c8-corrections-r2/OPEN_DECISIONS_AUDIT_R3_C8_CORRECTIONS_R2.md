# Open Decisions Audit R3-C8 Corrections R2

## Result

```text
Original Open Decisions: 57
Present and unique: 57/57
Approved by User: 0
Still OPEN: 57
```

The R2 package preserves all IDs and does not present technical mechanisms as
business approval. Implementation remains blocked where the original decision
controls roles, retention, price policy, ownership, deployment or production.

| ID | Status | Review impact |
|---|---|---|
| `OD-R2-01` | OPEN | Rule values/authority unresolved |
| `OD-R2-02` | OPEN | Professional reviewer authority unresolved |
| `OD-R2-03` | OPEN | Catalog reviewer authority unresolved |
| `OD-R2-04` | OPEN | Source/evidence retention unresolved |
| `OD-R2-05` | OPEN | Price validity policy unresolved |
| `OD-R2-06` | OPEN | Scenario mutation/backfill unresolved |
| `OD-R2-07` | OPEN | Requirement-head policy unresolved |
| `OD-R2-08` | OPEN | Conversation visibility unresolved |
| `OD-R2-09` | OPEN | Snapshot retention/visibility unresolved |
| `OD-R2-10` | OPEN | Demo identity unresolved |
| `OD-R2-11` | OPEN | Effective-version policy unresolved |
| `OD-R2-12` | OPEN | Legacy quarantine/backfill unresolved |
| `OD-R2-13` | OPEN | Rule approval separation unresolved |
| `OD-R2-14` | OPEN | Historical Basis compatibility policy unresolved |
| `OD-R2-15` | OPEN | Legacy JSON repair/backfill unresolved |
| `OD-R2-16` | OPEN | Review workflow unresolved |
| `OD-R2-17` | OPEN | Sales assignment scope unresolved |
| `OD-R2-18` | OPEN | Source-review cadence unresolved |
| `OD-R2-19` | OPEN | Preliminary-result visibility unresolved |
| `OD-R2-20` | OPEN | Production rollout unresolved |
| `OD-R3-01` | OPEN | Evidence archive policy unresolved |
| `OD-R3-02` | OPEN | Raw/text Basis policy unresolved |
| `OD-R3-03` | OPEN | Review history retention unresolved |
| `OD-R3-04` | OPEN | Policy continuity unresolved |
| `OD-R3-05` | OPEN | Snapshot export/deletion unresolved |
| `OD-R3-06` | OPEN | Legacy scenario disposition unresolved |
| `OD-R3-07` | OPEN | RuleSet authority unresolved |
| `OD-R3-08` | OPEN | Failure replay retention unresolved |
| `OD-R3-09` | OPEN | Lost-evidence recovery unresolved |
| `OD-R3-C2-01` | OPEN | Typed catalogue/units unresolved |
| `OD-R3-C2-02` | OPEN | Archive verifier identity unresolved |
| `OD-R3-C2-03` | OPEN | Transition function owner unresolved |
| `OD-R3-C2-04` | OPEN | Basis implementation authority unresolved |
| `OD-R3-C3-01` | OPEN | CUID/Text identity unresolved |
| `OD-R3-C3-02` | OPEN | Typed catalogue authority unresolved |
| `OD-R3-C3-03` | OPEN | Transition ownership/grants unresolved |
| `OD-R3-C3-04` | OPEN | Archive/verifier identity unresolved |
| `OD-R3-C4-01` | OPEN | Snapshot Registry approval unresolved |
| `OD-R3-C4-02` | OPEN | Catalogue/units unresolved |
| `OD-R3-C4-03` | OPEN | Event function owner unresolved |
| `OD-R3-C4-04` | OPEN | Registry rollout unresolved |
| `OD-R3-C5-01` | OPEN | Identity broker/session binding unresolved |
| `OD-R3-C5-02` | OPEN | Snapshot/Basis rollout unresolved |
| `OD-R3-C5-03` | OPEN | SourceKey storage derivation unresolved |
| `OD-R3-C5-04` | OPEN | Reviewer/approver separation unresolved |
| `OD-R3-C5-05` | OPEN | Break-glass ownership unresolved |
| `OD-R3-C6-01` | OPEN | Session assertion/broker unresolved |
| `OD-R3-C6-02` | OPEN | Registry/Basis rollout unresolved |
| `OD-R3-C6-03` | OPEN | Price validity policy unresolved |
| `OD-R3-C6-04` | OPEN | Session-role topology unresolved |
| `OD-R3-C6-05` | OPEN | Policy approval split unresolved |
| `OD-R3-C7-01` | OPEN | Function/deployment identities unresolved |
| `OD-R3-C7-02` | OPEN | PostgreSQL JSON/version policy unresolved |
| `OD-R3-C7-03` | OPEN | Basis resource budget unresolved |
| `OD-R3-C7-04` | OPEN | Lock/retry/long-transaction limits unresolved |
| `OD-R3-C7-05` | OPEN | View grants/break-glass unresolved |
| `OD-R3-C7-06` | OPEN | Evidence retention/export unresolved |

## Review Conclusion

The 57 decisions are correctly retained as OPEN. Several are direct blockers for
the next implementation phases, including:

- root recovery/rotation approval ownership;
- credential custody and break-glass ownership;
- Session role provisioning and connection topology;
- function/deployment ownership;
- Policy approval separation;
- price validity policy;
- evidence retention/export.

No decision was approved by this review.
