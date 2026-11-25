# Implementation Authorization Matrix R2

Date: 2026-11-23

This matrix is an independent review opinion. It does not grant implementation
authorization, database access, Migration execution, Runtime access or
deployment authority.

Overall basis:

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

## Matrix

| Work item | Status | Required predecessor |
|---|---|---|
| Conditional/uncertain assertion parser and fixtures | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | Separate implementation authorization; no DB or formal engineering claim |
| Requirement status/DTO/UI copy | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | Preserve non-Operational labels and separate review authorization |
| Scenario composite Project/Conversation/Requirement keys | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | `REV-R2-P2-01` correction; product decision in `OD-R2-06` |
| Project Type update policy | `BLOCKED_BY_OPEN_DECISION` | `OD-R2-06` and safe immutable update design |
| Project current-requirement head | `BLOCKED_BY_OPEN_DECISION` | `OD-R2-07` |
| Normalized Requirement Assertion/Value schema | `DESIGN_CORRECTION_REQUIRED` | `REV-R2-P1-01` exact requirement/conversation provenance |
| JSON compatibility projection | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | Generate from normalized authority; never select from JSON |
| Requirement history API/UI | `BLOCKED_BY_OPEN_DECISION` | `OD-R2-08` visibility plus normal authorization review |
| Advisor transaction and CAS | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | Separate DB transaction/concurrency test authorization |
| Advisor idempotency record | `DESIGN_CORRECTION_REQUIRED` | `REV-R2-P2-03` exact FKs and `FAILED` semantics |
| Initial conversation atomicity | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | Separate implementation and failure-injection authorization |
| Shared mutation guard and route inventory | `BLOCKED_BY_INDEPENDENT_SECURITY_REVIEW` | Separate security review of allowlisted framework exceptions and file-route integration |
| SQL-scoped sales query | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | Project authorization regression and query-plan review |
| Catalog source revision model | `DESIGN_CORRECTION_REQUIRED` | `REV-R2-P1-02` immutable content evidence and `OD-R2-04` |
| Typed CatalogReview target FKs | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | `REV-R2-P2-04` policy version; role decision `OD-R2-03` |
| Catalog review role/authority | `BLOCKED_BY_OPEN_DECISION` | `OD-R2-02/03/18` |
| Source review cadence and expiry | `BLOCKED_BY_OPEN_DECISION` | `OD-R2-04/18` |
| Price and tax/region semantics | `BLOCKED_BY_OPEN_DECISION` | `OD-R2-05` |
| Effective version ambiguity | `BLOCKED_BY_OPEN_DECISION` | `OD-R2-11`; fail-closed remains mandatory until decided |
| Technical/commercial/trust/overall statuses | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | No formal Operational until `OD-R2-01/05/13/20` |
| Selection rule set and persisted result | `DESIGN_CORRECTION_REQUIRED` | `REV-R2-P2-02` exact rule-set ID/digest binding |
| Professional review persistence/state machine | `DESIGN_CORRECTION_REQUIRED` | `REV-R2-P1-04` and `OD-R2-16` |
| Formal Operational selection | `BLOCKED_BY_TECHNICAL_AUTHORITY` | Approved rules, professional authority, price policy and independent security review |
| Sales handoff exact ownership/basis chain | `DESIGN_CORRECTION_REQUIRED` | `REV-R2-P1-03` composite case/project/requirement/version/run chain |
| Sales snapshot payload/item consistency | `DESIGN_CORRECTION_REQUIRED` | `REV-R2-P1-05` and `OD-R2-14` |
| Sales snapshot retention/export | `BLOCKED_BY_OPEN_DECISION` | `OD-R2-09` |
| Sales assignment identity/scope | `BLOCKED_BY_OPEN_DECISION` | `OD-R2-17` |
| Preliminary result visibility | `BLOCKED_BY_OPEN_DECISION` | `OD-R2-19` |
| Demo startup identity | `BLOCKED_BY_OPEN_DECISION` | `OD-R2-10` |
| Legacy JSON/VERIFIED/handoff migration | `BLOCKED_BY_OPEN_DECISION` | `OD-R2-12/15` plus a separately authorized migration review |
| Root test infrastructure repair | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | Separate environment setup authorization; no dependency changes in review |
| Browser/visual execution | `BLOCKED_BY_INDEPENDENT_SECURITY_REVIEW` | Separate browser installation/execution authorization |
| P1-3 upload/lifecycle integration | `BLOCKED_BY_INDEPENDENT_SECURITY_REVIEW` | Separate P1-3 workstream only |
| P1-3 FileVersion chain repair | `BLOCKED_BY_INDEPENDENT_SECURITY_REVIEW` | Separate P1-3 authorization; never merge here |
| Native RPC / Helper Runtime | `BLOCKED_BY_INDEPENDENT_SECURITY_REVIEW` | Separate platform-security gate |
| Production deployment | `BLOCKED_BY_TECHNICAL_AUTHORITY` | Build Gate, runtime identities, P1-3, security and operational approvals |

## Low-Risk Future Batch Candidates

Only after the required design corrections and any named Open Decision are
accepted:

- pure conditional/double-negation parser implementation and table-driven
  fixtures;
- status DTO fixtures and visible non-Operational labels;
- documentation and traceability maintenance;
- preparation of browser and E2E test specifications without browser install;
- JSON-projection generation logic that consumes normalized field values and
  is not a second writable source.

These are candidates for a future authorization request, not current authority.

## Must Remain Blocked

- every Prisma/PostgreSQL Schema or Migration touching requirement, catalog,
  selection, professional review or sales snapshot relations;
- formal `OPERATIONAL` selection;
- catalog source approval when evidence identity is not retained/verifiable;
- professional review approval or reuse across changed bases;
- sales snapshot creation, update, deletion or export;
- cross-project sales visibility or assignment policy;
- automatic catalog effective-version selection without an approved ambiguity
  policy;
- legacy backfill or quarantine disposition;
- Demo startup using an arbitrary database/storage identity;
- all P1-3 upload/lifecycle/FileVersion work;
- Native RPC, Helper Runtime, production Build Gate or deployment.

## Separately Authorized High-Risk Work

The following can be considered only after a future independent design approval:

- composite FK, CHECK, exclusion constraint and append-only trigger
  implementation;
- controlled database functions for immutable requirement, review and snapshot
  creation;
- catalog source/revision/evidence migration;
- professional-review event and approval migration;
- sales handoff exact-chain migration;
- database constraint, rollback, concurrency and COMMIT-unknown verification;
- same-origin rollout across all mutation handlers.

## Must Not Be Merged

```text
P1-3 Upload/Attempt/Lifecycle/FileVersion
Native RPC / runtime authority
Production deployment or Build Gate exceptions
Real AI provider integration
Real customer/file/Storage data
```

## Matrix Conclusion

```text
No P1 product module is currently approved for implementation.
The parser/status and several non-destructive design directions may be
considered in a future staged authorization after correction and re-review.
All database, professional-review, snapshot and runtime work remains blocked.
```
