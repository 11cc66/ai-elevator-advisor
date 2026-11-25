# MVP Implementation Status

## Product modules

| Module | State | Evidence |
|---|---|---|
| Customer session and project scope | TESTED | Better Auth Session; global `project.create`; project-scoped `CUSTOMER` role |
| AI Advisor | TESTED | Conversation/message persistence, deterministic `MockAIProvider`, multi-turn updates |
| Requirement intake | TESTED | Three scenarios, revisions, manual edits, missing-field recomputation, customer confirmation |
| Catalog | TESTED | Manufacturer/brand/product/spec/price versions, provenance checks, DEMO seed, filters |
| Deterministic selection | TESTED | Pure rule engine with hard constraints, budget classification and traceability |
| Recommendation UI | TESTED | Route-level acceptance, recommendation history, side-by-side candidate table, risk boundaries |
| Customer project UI | TESTED | Home, project list, project creation, project detail and advisor routes |
| Admin catalog UI/API | TESTED | Create, edit, version increment, invalid-input rejection and audit |
| Sales handoff | TESTED | Customer handoff, scoped sales list, requirement and recommendation visibility, notes |
| Customer isolation | TESTED | Cross-customer project, advisor and requirement requests return deny |
| Sales isolation | TESTED | Project-scoped sales visibility and deny for unassigned handoff |
| Demo readiness | TESTED | API, persistence, selection and server-rendered routes operate without real AI or files |

## Database

Added forward migration:

```text
prisma/migrations/20261123130000_full_mvp_domain/migration.sql
```

The migration adds advisor, requirement, catalog, selection and sales-domain tables. It does not drop or redefine an existing table and preserves the P1-3 lifecycle models.

Verification:

- `pnpm db:validate`: PASS
- `pnpm db:generate`: PASS
- isolated test database identity guard: PASS
- all migrations on `elevator_advisor_test`: PASS

## Authorization model

Relevant permissions:

```text
project.create
project.read
advisor.use
catalog.read
catalog.manage
selection.run
sales.handoff.create
sales.manage
```

Role composition:

- `CUSTOMER_ACCOUNT`: global `project.create` only;
- `CUSTOMER`: project-scoped advisor, selection, catalog, handoff and project read;
- `SALES`: project-scoped project read, catalog read, selection and sales management;
- `PRODUCT_ADMIN`: global catalog management;
- `SYSTEM_ADMIN`: existing global administrative permission set.

No customer role is assigned global `project.read`.

## Product API inventory

```text
GET  /api/catalog/products
GET  /api/projects
POST /api/projects
GET  /api/projects/[projectId]/advisor/conversations
POST /api/projects/[projectId]/advisor/conversations
GET  /api/projects/[projectId]/advisor/conversations/[conversationId]
POST /api/projects/[projectId]/advisor/conversations/[conversationId]/messages
GET  /api/projects/[projectId]/requirements
PATCH /api/projects/[projectId]/requirements
POST /api/projects/[projectId]/requirements/confirm
GET  /api/projects/[projectId]/selection-runs
POST /api/projects/[projectId]/selection-runs
POST /api/projects/[projectId]/sales-handoff
GET  /api/admin/catalog/products
POST /api/admin/catalog/products
GET  /api/admin/catalog/products/[productId]
PATCH /api/admin/catalog/products/[productId]
POST /api/admin/catalog/seed-demo
GET  /api/admin/sales
POST /api/admin/sales/[handoffId]/notes
```

Every product API validates Session, permission and project/resource ownership before data access. Inputs are validated by shared Zod contracts.

## Current progress

```text
Product code: IMPLEMENTED
Unit/static tests: TESTED
Isolated database migration: TESTED
MVP API and route E2E: TESTED
Browser automation: NOT VERIFIED
Repository-wide typecheck/build: BLOCKED BY PRE-EXISTING P1-3 INCOMPATIBILITY
Real AI: NOT USED
Real file/Storage: NOT USED
Native RPC/PFR: NOT USED
Git commit/push: NOT EXECUTED
```

