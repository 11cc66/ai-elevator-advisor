# Implementation Authorization Matrix R3-C2

Date: 2026-11-24

This matrix is an independent review opinion, not an authorization.

Overall basis:

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

## Matrix

| Work item | Status | Required predecessor |
|---|---|---|
| Pure conditional/uncertainty parser and fixtures | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | Separate implementation authorization |
| Typed assertion/value schema | `BLOCKED_BY_OPEN_DECISION` | `OD-R3-C2-01` exact types/ranges/units and `REV-R3-C2-P2-01` |
| Requirement source chain | `BLOCKED_BY_OPEN_DECISION` | Source-key UUID/CUID decision from `REV-R3-C2-P1-03` |
| Requirement provenance API/UI | `BLOCKED_BY_OPEN_DECISION` | `OD-R2-08`, typed catalogue, source identity migration |
| Project scenario migration | `BLOCKED_BY_OPEN_DECISION` | `OD-R3-06`; legacy mapping |
| Advisor idempotency | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | Separate DB transaction and COMMIT-unknown authorization; `OD-R3-08` for failure replay |
| CatalogEvidenceArchive | `BLOCKED_BY_OPEN_DECISION` | `OD-R3-01/02/09`, archive ACL/retention |
| Catalog review/source binding | `DESIGN_CORRECTION_REQUIRED` | Exact archive verification and function/role enforcement |
| RuleSet event-only status | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | `OD-R3-C2-03` function owner/search path/grants; direct DB tests |
| ProfessionalReview event-only status | `DESIGN_CORRECTION_REQUIRED` | `REV-R3-C2-P1-02` source-event ownership; function/role details |
| R3-BASIS-1 encoding/vectors | `DESIGN_CORRECTION_REQUIRED` | Regenerate V01–V20/V21, multi-record vectors, two independent encoders |
| Snapshot sourceKey relationship | `DESIGN_CORRECTION_REQUIRED` | Exact professional source/event ownership and typed source kind |
| Sales snapshot schema | `BLOCKED_BY_OPEN_DECISION` | Fixed basis, source event binding, `OD-R3-05` retention |
| Legacy Requirement mapping | `BLOCKED_BY_OPEN_DECISION` | `OD-R3-06`, `OD-R2-12/15`; quarantine path |
| SQL-scoped sales access | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | Separate authorization regression review |
| Formal `OPERATIONAL` selection | `BLOCKED_BY_TECHNICAL_AUTHORITY` | Approved rules, professional authority, price policy and basis/source fixes |
| P1-3 Upload/Lifecycle/FileVersion | `BLOCKED_BY_INDEPENDENT_SECURITY_REVIEW` | Separate P1-3 workstream only |
| Native RPC/Helper Runtime | `BLOCKED_BY_INDEPENDENT_SECURITY_REVIEW` | Separate platform security gate |
| Production Build/Runtime/deployment | `BLOCKED_BY_TECHNICAL_AUTHORITY` | Separate release and security authorization |

## Future Low-Risk Work Candidates

Only after corrections and separate authorization:

- semantic parser unit fixtures;
- non-Operational DTO/status UI;
- R3-BASIS-1 vector fixtures in an isolated test harness;
- read-only event transition simulations;
- documentation and traceability maintenance;
- SQL-scoped sales query tests.

## Must Remain Blocked

- all Prisma Schema/Migration changes;
- exact UUID/CUID source conversion;
- typed value and unit catalogue activation;
- catalog evidence archive and review;
- RuleSet/ProfessionalReview transition functions;
- sales snapshot creation/export;
- formal Operational selection;
- legacy backfill and quarantine;
- all P1-3 and Native/Runtime work.

## Explicit Non-Authorization

```text
No source changes are authorized.
No Schema or Migration changes are authorized.
No database or Storage access is authorized.
No test, Build, Native RPC or Runtime execution is authorized.
No R3-C2 Open Decision is approved by this matrix.
```
