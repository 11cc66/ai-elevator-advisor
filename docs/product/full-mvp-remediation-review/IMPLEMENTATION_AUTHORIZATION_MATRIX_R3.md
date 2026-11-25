# Implementation Authorization Matrix R3

Date: 2026-11-24

This is an independent review opinion. It is not an implementation,
Migration, Runtime or deployment authorization.

Overall basis:

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

## Matrix

| Work item | Status | Required predecessor |
|---|---|---|
| Conditional/uncertain semantic parser and fixtures | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | Separate implementation authorization; no DB claim |
| Requirement assertion/value schema | `DESIGN_CORRECTION_REQUIRED` | `REV-R3-P1-01/02`; add exact keys and complete semantic/value fields |
| Requirement history and provenance API/UI | `DESIGN_CORRECTION_REQUIRED` | Same P1 corrections plus `OD-R2-08` sharing policy |
| Project scenario composite keys and migration | `DESIGN_APPROVED_WITH_DEPENDENCY` | `OD-R3-06`; legacy BuildingRequirement mapping still needs design (`REV-R3-P2-02`) |
| Project Type update/immutable trigger | `DESIGN_APPROVED_WITH_DEPENDENCY` | `OD-R2-06`/`OD-R3-06`; direct SQL trigger implementation separately authorized |
| Advisor idempotency and CAS | `DESIGN_APPROVED_WITH_DEPENDENCY` | `OD-R3-08`; exact implementation and COMMIT-unknown tests after authorization |
| Same-origin mutation route inventory | `BLOCKED_BY_INDEPENDENT_SECURITY_REVIEW` | Separate security review and route inventory |
| SQL-scoped sales access | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | Separate implementation and authorization regression review |
| CatalogEvidenceArchive interface and evidence model | `BLOCKED_BY_OPEN_DECISION` | `OD-R3-01/02/09`; archive product, retention, encryption and evidence basis |
| Catalog source revision/review binding | `DESIGN_CORRECTION_REQUIRED` | Exact append-only decision enforcement (`REV-R3-P2-03`) and archive dependency |
| Catalog review/authority roles | `BLOCKED_BY_OPEN_DECISION` | `OD-R2-02/03` and `OD-R3-...` role decisions |
| Professional review basis/source/price FKs | `DESIGN_CORRECTION_REQUIRED` | `REV-R3-P1-04`; event/current-state database enforcement |
| Professional review policy revision | `DESIGN_APPROVED_WITH_DEPENDENCY` | `OD-R3-03/04`; policy retention/continuity |
| Selection rule-set exact revision | `DESIGN_CORRECTION_REQUIRED` | `REV-R3-P1-03`; status must be event-derived and DB-enforced |
| Formal `OPERATIONAL` evaluation | `BLOCKED_BY_TECHNICAL_AUTHORITY` | Approved rules, professional authority, price policy, data evidence and independent security review |
| Sales case/project/requirement/version/run chain | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | Separate migration authorization; exact FK creation is not yet verified |
| Snapshot normalized authority/candidate completeness | `DESIGN_CORRECTION_REQUIRED` | `REV-R3-P1-05/06`; canonical codec and source assertion equality |
| Snapshot payload/export | `DESIGN_CORRECTION_REQUIRED` | Complete `R3-BASIS-1` and `OD-R3-05` export/retention |
| Sales assignment and visibility | `BLOCKED_BY_OPEN_DECISION` | `OD-R2-17/08/19` |
| Snapshot retention/deletion | `BLOCKED_BY_OPEN_DECISION` | `OD-R3-05`; no default deletion or cascade |
| Legacy requirement/catalog/handoff migration | `BLOCKED_BY_OPEN_DECISION` | `OD-R3-06/09`, `OD-R2-12/15`; migration design and data decision |
| Demo startup identity | `BLOCKED_BY_OPEN_DECISION` | `OD-R2-10`; no default Demo launch |
| P1-3 upload/lifecycle/FileVersion | `BLOCKED_BY_INDEPENDENT_SECURITY_REVIEW` | Separate P1-3 workstream only |
| Native RPC/Helper Runtime | `BLOCKED_BY_INDEPENDENT_SECURITY_REVIEW` | Separate platform-security gate |
| Production deployment/Build Gate | `BLOCKED_BY_TECHNICAL_AUTHORITY` | Separate release, runtime identity, P1-3 and security approvals |

## Future Low-Risk Batch Candidates

Only after the named corrections and decisions:

- pure semantic parser/fixture work;
- status and non-Operational UI DTO work;
- documentation and traceability updates;
- archive interface contract tests in an isolated fixture environment;
- serializer test vectors with no database connection;
- E2E/browser test preparation after separate environment authorization.

## Must Remain Blocked

- any Prisma Schema or Migration implementing R3 tables;
- composite FKs, exclusion constraints, triggers and permission changes;
- catalog evidence archive or source capture;
- requirement provenance and FieldValue implementation;
- professional-review workflow and formal Operational selection;
- ruleset approval and rule execution;
- sales snapshot creation, update, export or deletion;
- legacy backfill and quarantine disposition;
- archive/source/price/review changes during snapshot creation;
- all P1-3, Native RPC, Build Gate and deployment changes.

## Separately Authorized High-Risk Work

After a new independent design approval:

- forward expand/backfill/validate migrations;
- database role separation and least-privilege grants;
- composite FK/UNIQUE/CHECK/deferred trigger implementation;
- append-only event functions and state projections;
- `R3-BASIS-1` database/trusted-serializer implementation and vector tests;
- archive adapter integration and ACL verification;
- concurrency, COMMIT-unknown, rollback and trigger tests on an isolated clone;
- snapshot creation and audit reconstruction.

## Explicit Non-Authorization

```text
This matrix does not authorize source edits.
This matrix does not authorize Schema or Migration changes.
This matrix does not authorize database access or tests.
This matrix does not authorize Storage or real customer data access.
This matrix does not authorize Native RPC, Build, Runtime or deployment.
This matrix does not accept any R3 Open Decision.
```
