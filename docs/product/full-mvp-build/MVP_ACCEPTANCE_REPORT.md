# AI Elevator Advisor — Full MVP Acceptance Report

Date: 2026-11-23

Task: `FULL-MVP-BUILD-001`

Final product conclusion:

```text
MVP COMPLETE — DEMO-READY
```

This conclusion covers the authorized Mock-AI/DEMO product scope. It does not authorize real AI, real files, production deployment, Native RPC, PFR modification or formal engineering/commercial conclusions.

## 1. Final architecture

```text
Next.js App Router
  customer and admin pages
  authenticated Route Handlers
       |
       +-- Better Auth Session
       +-- global/project-scoped RBAC
       +-- advisor service -> MockAIProvider
       +-- requirement revisions
       +-- catalog service
       +-- deterministic selection-engine
       +-- sales handoff
       |
PostgreSQL + Prisma
  additive MVP domain tables
  existing P1-3 models preserved
```

The selection engine remains pure. AI does not own hard constraints, catalog facts or prices.

## 2. Implemented product scope

- customer home, project list, project creation and project details;
- conversation and message history;
- deterministic multi-turn requirement extraction;
- manual structured edits with missing-field recomputation;
- requirement versioning and customer confirmation;
- three installation scenarios;
- versioned manufacturer/brand/product/specification/price data;
- DEMO catalog seed and customer filtering;
- deterministic selection with constraints, budget status, reasons, warnings and source references;
- recommendation history and candidate comparison;
- sales handoff, follow-up status and notes;
- product-change audit records;
- project-scoped customer/sales authorization.

## 3. Main implementation files

Key modules:

```text
apps/web/src/modules/advisor/mock-provider.ts
apps/web/src/modules/advisor/missing-fields.ts
apps/web/src/modules/advisor/service.ts
apps/web/src/modules/mvp/store.ts
apps/web/src/modules/mvp/types.ts
apps/web/src/modules/selection/service.ts
packages/selection-engine/src/index.ts
packages/contracts/src/index.ts
```

Customer/admin pages:

```text
apps/web/src/app/page.tsx
apps/web/src/app/catalog/page.tsx
apps/web/src/app/projects/
apps/web/src/app/admin/products/
apps/web/src/app/admin/sales/
```

MVP API:

```text
apps/web/src/app/api/projects/
apps/web/src/app/api/catalog/
apps/web/src/app/api/admin/catalog/
apps/web/src/app/api/admin/sales/
```

Authorization and seed:

```text
apps/web/src/modules/access/permissions.ts
apps/web/src/modules/access/policy.ts
apps/web/scripts/seed-mvp-roles.ts
apps/web/scripts/test-db/seed.ts
```

Tests:

```text
apps/web/tests/advisor-mock-provider.test.ts
apps/web/tests/advisor-missing-fields.test.ts
apps/web/tests/mvp-project-access.test.ts
apps/web/tests/e2e/full-mvp-flow.spec.ts
apps/web/tests/e2e/mvp-scenarios.spec.ts
apps/web/tests/e2e/mvp-catalog-sales.spec.ts
apps/web/tests/e2e/mvp-ui-routes.spec.ts
packages/selection-engine/tests/selection-engine.test.ts
```

## 4. Database changes

Forward migration:

```text
prisma/migrations/20261123130000_full_mvp_domain/migration.sql
```

Added entities:

- advisor conversations and messages;
- building requirements and revisions;
- manufacturers, brands, product models, specifications and prices;
- selection runs and recommendations;
- sales handoffs and follow-up notes;
- `Customer.userId`;
- project/requirement/catalog/pricing/selection/sales enums.

The migration is additive. Existing P1-3 tables and state semantics were not changed.

## 5. AI Adapter

The only active provider is `MockAIProvider`.

Properties:

- no network calls;
- deterministic parsing;
- bounded field extraction;
- no invented model, price or technical specification;
- explicit missing-field questions;
- output marked `MOCK`;
- professional review always required.

`REAL_PROVIDER` is reserved in persistence types, but no real provider or credential path was activated.

## 6. Deterministic selection rules

Implemented behavior:

- scenario compatibility;
- floor-derived preliminary capacity and speed targets;
- minimum floor and travel checks;
- rejection of `UNVERIFIED` and `EXPIRED` products;
- allowance of explicit `DEMO_MOCK` products for demonstration;
- within-budget classification;
- improvement classification up to 15% above reference budget;
- hard-budget exclusion support;
- reasons, unmatched constraints, warnings and source references;
- professional-review and site-survey warnings;
- deterministic ordering and rules version `1.0.0`.

## 7. Authorization design

Important controls:

- project creation requires global `project.create`;
- customers receive only that global account permission;
- advisor access requires project-scoped `advisor.use`;
- requirement editing/confirmation requires `advisor.use`;
- selection write requires `selection.run`;
- handoff creation requires `sales.handoff.create`;
- sales follow-up requires `sales.manage` in global or matching project scope;
- admin catalog management requires global `catalog.manage`;
- project/resource IDs are not trusted from the client;
- every conversation and handoff is checked against its project.

## 8. Test results

Passed:

```text
Web unit/static: 28 files, 275 tests
Worker: 6 files, 19 tests
Contracts: 4 files, 15 tests
Selection engine: 2 files, 9 tests
File storage: 2 files, 19 tests
```

MVP E2E:

```text
4 files, 4 tests passed in 36.4s
```

The suite covers:

- full customer flow;
- all three installation scenarios;
- cross-customer isolation;
- customer catalog visibility;
- product validation/versioning/audit;
- sales requirement/recommendation visibility;
- unassigned-sales denial;
- authenticated server-rendered UI routes.

Database:

```text
pnpm test:db:verify: PASS
pnpm test:db:reset: PASS on elevator_advisor_test
all 14 migrations: PASS
pnpm db:validate: PASS
pnpm db:generate: PASS
pnpm build:packages: PASS
```

Browser UI automation:

```text
NOT VERIFIED — Playwright Chromium not installed
```

No browser download was attempted.

## 9. E2E scenario results

| Scenario | Result |
|---|---|
| A — Old-building addition | PASS |
| B — New-building installation | PASS |
| C — Existing-elevator renovation | PASS |
| D — Permission isolation | PASS |
| E — Product catalog | PASS |
| F — Sales handoff | PASS |

## 10. Demo data

All product facts and prices are fictional `DEMO_MOCK`.

Recommendations state:

- data classification;
- budget assessment;
- source references;
- matching reasons;
- limitations/warnings;
- professional-review requirement.

No AI-generated product, price or engineering fact is accepted as real.

## 11. Repository-level failures outside MVP

### Old file upload

The legacy upload path remains incompatible with P1-3 Attempt/Lifecycle requirements:

```text
invalid UPLOADING upload chain counts
```

Legacy E2E result:

```text
5 passed, 5 failed
```

Database constraint suite:

```text
12 passed, 55 failed
```

Failures are concentrated in old upload/FileVersion fixtures that do not provide the P1-3 chain fields. This task was explicitly forbidden from modifying or bypassing that security state machine.

### Typecheck

Web typecheck after fresh Prisma Client generation reports only pre-existing P1-3 upload/fixture incompatibilities:

```text
missing uploadIntentId
missing uploadAttemptId
missing creationOperationAttemptId
nullable stagingKey handling
```

It reported no diagnostic in the new MVP advisor/catalog/selection/sales modules.

### Production build

```text
FAIL — Missing required build configuration: P13_RELEASE_ID
```

The security Gate was not bypassed.

### Root aggregate tests

```text
pnpm test: FAIL
```

The failure occurs because `@elevator/authority-core` cannot resolve `vitest`. Relevant packages were executed independently and passed.

## 12. Modified/new file grouping

Modified shared files include:

```text
prisma/schema.prisma
packages/contracts/src/index.ts
packages/contracts/tests/project-contracts.test.ts
packages/selection-engine/src/index.ts
packages/selection-engine/tests/engine-descriptor.test.ts
apps/web/src/modules/access/permissions.ts
apps/web/src/modules/access/policy.ts
apps/web/src/app/page.tsx
apps/web/src/app/admin/layout.tsx
apps/web/src/app/admin/projects/page.tsx
apps/web/scripts/test-db/seed.ts
apps/web/scripts/test-db/env.ts
apps/web/playwright.config.ts
apps/web/tests/e2e/phase3-test-account.spec.ts
```

New Full-MVP files include the advisor, MVP store, selection service, customer/admin pages, product APIs, E2E tests, role seed, migration and this documentation set.

Detailed current Git state must be read with a command-scoped `safe.directory`; no global Git configuration was changed.

Final read-only Git snapshot:

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 41
Untracked: 71
Staged: 0
Deleted: 0
```

The count differs from the task-start reference because this task added MVP source, tests, migration and documentation. Pre-existing P1-3 changes remain in the same worktree. No commit or push occurred.

## 13. Protected boundaries

```text
Real AI calls: NONE
Real customer files: NONE
Real private Storage writes/deletes: NONE
Native RPC: NONE
Native Build/Runtime: NONE
PFR / Registry: NONE
ACL / Owner / Service changes: NONE
$null read/hash/modify/delete: NONE
Git commit/push/reset/restore/clean/checkout/stash: NONE
```

The isolated test database was reset only after identity guard verification.

## 14. Remaining decisions

Future work requires separate authorization or product decisions for:

- real AI provider, privacy and prompt governance;
- real product-source ingestion and approval;
- P1-3 upload integration;
- controlled drawing parsing;
- user/role/sales-assignment administration;
- formal survey, approval, quotation and contract workflows;
- production signing/Build Gate configuration;
- browser installation and visual/mobile acceptance.

## 15. Final decision

The authorized Mock-AI/DEMO MVP meets its product acceptance criteria:

- primary end-to-end flows pass;
- multi-turn advisor and structured confirmation pass;
- catalog and deterministic selection execute real rules;
- recommendations are traceable and clearly DEMO;
- customer/admin/sales authorization boundaries pass;
- critical MVP tests pass;
- no real operation or security bypass was used.

Final status:

```text
MVP COMPLETE — DEMO-READY
```

Repository-wide production readiness remains `PARTIAL / NOT VERIFIED` because of the pre-existing P1-3 file-chain incompatibility, missing browser runtime, and guarded production-build configuration.

