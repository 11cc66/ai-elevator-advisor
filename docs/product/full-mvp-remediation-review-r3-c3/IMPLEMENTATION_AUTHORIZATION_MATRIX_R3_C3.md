# Implementation Authorization Matrix R3-C3

Date: 2026-11-24

This is an independent review opinion. It does not authorize implementation.

Overall basis:

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

## Matrix

| Work item | Status | Required predecessor |
|---|---|---|
| Pure semantic parser/fixtures | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | Separate implementation authorization |
| Requirement exact parent keys | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | Separate Schema authorization; identity approval `OD-R3-C3-01` |
| Typed Assertion/FieldValue | `BLOCKED_BY_OPEN_DECISION` | `OD-R3-C3-02` full field/unit/range catalogue |
| ProfessionalReview source binding | `DESIGN_CORRECTION_REQUIRED` | Add exact six-column Event parent UNIQUE or include `reviewId` consistently |
| RuleSet event-only state | `DESIGN_APPROVED_WITH_DEPENDENCY` | `OD-R3-C3-03` owner/search_path/grants; direct DML denial tests |
| ProfessionalReview event-only state | `DESIGN_CORRECTION_REQUIRED` | Source-key mismatch and exact transition permissions |
| R3-BASIS-1 revision 3 generic framing | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | Separate protocol/verifier authorization; vectors already byte-identical |
| Actual Snapshot record/field registry | `DESIGN_CORRECTION_REQUIRED` | Publish real registry, stableKey mapping and mixed-entity vectors |
| Snapshot sourceKey inheritance | `DESIGN_CORRECTION_REQUIRED` | Event parent FK fix and actual registry |
| Snapshot child schema | `DESIGN_CORRECTION_REQUIRED` | Move complete C3 child tables/deferred validation into main design |
| Legacy CUID/Text migration | `BLOCKED_BY_OPEN_DECISION` | `OD-R3-C3-01`, `OD-R3-06`, `OD-R2-12/15`; mapping matrix required |
| CatalogEvidenceArchive | `BLOCKED_BY_OPEN_DECISION` | `OD-R3-C3-04`, archive ACL/retention/verifier |
| Idempotency/commit-unknown | `DESIGN_APPROVED_WITH_DEPENDENCY` | `OD-R3-08` failure retention/replay display |
| SQL-scoped sales access | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | Separate security regression authorization |
| Formal Operational | `BLOCKED_BY_TECHNICAL_AUTHORITY` | approved rules, roles, evidence, price and all C3 fixes |
| P1-3 Upload/Lifecycle/FileVersion | `BLOCKED_BY_INDEPENDENT_SECURITY_REVIEW` | Separate P1-3 workstream only |
| Native RPC/Runtime/deployment | `BLOCKED_BY_INDEPENDENT_SECURITY_REVIEW` | Separate platform and release gates |

## Future Low-Risk Candidates

Only after corrections and separate authorization:

- conditional parser and status DTOs;
- generic R3-BASIS framing fixtures in an isolated harness;
- immutable event simulation;
- SQL-scoped sales authorization tests;
- documentation and traceability maintenance.

## Must Remain Blocked

- Prisma Schema/Migration and all database roles;
- ProfessionalReview source FKs and event transition functions;
- real Snapshot registry and creation;
- catalog evidence archive;
- legacy migration and quarantine execution;
- formal Operational selection;
- all P1-3 and Native RPC/Runtime/deployment work.

## Non-Authorization

```text
IMPLEMENTATION AUTHORIZATION: NOT GRANTED
DATABASE BEHAVIOR: NOT VERIFIED
RUNTIME: NOT VERIFIED
```
