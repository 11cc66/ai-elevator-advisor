# FULL-MVP-REVIEW-001 — Independent Product Delivery Review

Date: 2026-11-23

Project root: `D:\thinkbook\Desktop\jieya`

Review mode: independent, read-only, source and evidence based.

Overall result:

```text
NOT DEMO-READY
```

The previous `MVP COMPLETE — DEMO-READY` conclusion is not accepted. The application has a substantial Mock-AI/DEMO implementation and meaningful automated evidence, but several P1 product-integrity defects can produce wrong requirement facts or operational-looking recommendations. Browser behavior was not independently verified, and the known P1-3 upload incompatibility remains unresolved.

## 1. Input Integrity

The required delivery documents were read in full:

```text
docs/product/full-mvp-build/README.md
docs/product/full-mvp-build/MVP_IMPLEMENTATION_STATUS.md
docs/product/full-mvp-build/MVP_ACCEPTANCE_MATRIX.md
docs/product/full-mvp-build/MVP_ACCEPTANCE_REPORT.md
docs/product/full-mvp-build/MVP_KNOWN_LIMITATIONS.md
docs/product/full-mvp-build/SHA256SUMS.txt
```

Hash verification:

| File | Bytes | Lines | SHA-256 | Manifest |
|---|---:|---:|---|---|
| `README.md` | 2056 | 83 | `975C600A0A0CF03684C7D03B5C65F597AFA75D63EFDE32000F692DE73D0A9A76` | MATCH |
| `MVP_IMPLEMENTATION_STATUS.md` | 3891 | 103 | `703D029B62EA3CEC9DA693F98B35088985AE45510F21621B7EA61DE60BB07FD3` | MATCH |
| `MVP_ACCEPTANCE_MATRIX.md` | 4089 | 70 | `A88ACF3D1809FADA3CDEC48352B4384FB92867F5090392E37D7BA67EA447B39E` | MATCH |
| `MVP_ACCEPTANCE_REPORT.md` | 10578 | 389 | `74D0CBB210234812C88DD865F073A1769739AE5E9B0683EA3DB9AE36AE669800` | MATCH |
| `MVP_KNOWN_LIMITATIONS.md` | 2624 | 57 | `ED319F09A081859DC1677EC049E4712E3A1B43B30EE1E1B083855A5422B64E93` | MATCH |

`SHA256SUMS.txt`:

```text
Length: 444
Lines: 5
SHA-256: 4C48F50E387596D9464BF6EE0C2C1EAAD91E808C7C1C2D57302EE86143471077
All five manifest entries verified: TRUE
```

No input document was modified.

## 2. Shell Identity

PowerShell was dynamically discovered from the current execution environment and WindowsApps runtime:

```text
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe
```

Direct child process verification:

```text
Parent PID: 23224
Child PID: 5660
Child Parent PID: 23224
ExecutablePath: exact discovered candidate
External FileVersion: 7.6.9.500
External ProductVersion: 7.6.9
Internal PSVersion: 7.6.9
Internal PSEdition: Core
Child exit code: 0
```

Subsequent review commands were invoked through the verified `pwsh.exe`.

## 3. Initial Git Snapshot

```text
RepositoryRoot: D:/thinkbook/Desktop/jieya
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 41
Untracked entries: 71
Staged: 0
Deleted: 0
```

Tracked modified files:

```text
 AGENTS.md
 apps/web/next-env.d.ts
 apps/web/next.config.ts
 apps/web/package.json
 apps/web/playwright.config.ts
 apps/web/scripts/test-db/env.ts
 apps/web/scripts/test-db/seed.ts
 apps/web/src/app/admin/layout.tsx
 apps/web/src/app/admin/projects/page.tsx
 apps/web/src/app/admin/projects/project-form.tsx
 apps/web/src/app/page.tsx
 apps/web/src/modules/access/permissions.ts
 apps/web/src/modules/access/policy.ts
 apps/web/src/modules/files/download-service.ts
 apps/web/src/modules/files/upload-service.ts
 apps/web/src/modules/projects/service.ts
 apps/web/src/server/files/storage.ts
 apps/web/tests/e2e/global-setup.ts
 apps/web/tests/e2e/phase3-test-account.spec.ts
 apps/web/tests/integration/phase32-upload-service.test.ts
 apps/web/tests/integration/phase34-file-processing.test.ts
 apps/web/tests/integration/phase35-lease-renewal.test.ts
 apps/web/tests/integration/phase35-processing-reliability.test.ts
 apps/worker/package.json
 apps/worker/src/config.ts
 apps/worker/src/file-maintenance.ts
 apps/worker/src/file-processing.ts
 apps/worker/src/index.ts
 apps/worker/src/storage.ts
 apps/worker/tsconfig.json
 package.json
 packages/contracts/src/index.ts
 packages/contracts/tests/project-contracts.test.ts
 packages/file-storage/src/errors.ts
 packages/file-storage/src/index.ts
 packages/file-storage/src/local-private-storage.ts
 packages/file-storage/tests/local-private-storage.test.ts
 packages/selection-engine/src/index.ts
 packages/selection-engine/tests/engine-descriptor.test.ts
 pnpm-lock.yaml
 prisma/schema.prisma
```

Untracked entries:

```text
?? $null
?? .agents/
?? apps/web/scripts/build-secure.ts
?? apps/web/scripts/p13-build-audit/
?? apps/web/scripts/p13-db-tests/
?? apps/web/scripts/p13-deployment-evidence/
?? apps/web/scripts/p13-startup-security/
?? apps/web/scripts/p13-storage-delete-audit/
?? apps/web/scripts/p13-storage-inventory/
?? apps/web/scripts/seed-mvp-roles.ts
?? apps/web/scripts/start-secure.mjs
?? apps/web/src/app/admin/products/
?? apps/web/src/app/admin/sales/
?? apps/web/src/app/api/admin/catalog/
?? apps/web/src/app/api/admin/sales/
?? apps/web/src/app/api/catalog/
?? apps/web/src/app/api/projects/[projectId]/advisor/
?? apps/web/src/app/api/projects/[projectId]/requirements/
?? apps/web/src/app/api/projects/[projectId]/sales-handoff/
?? apps/web/src/app/api/projects/[projectId]/selection-runs/
?? apps/web/src/app/api/projects/route.ts
?? apps/web/src/app/catalog/
?? apps/web/src/app/projects/[projectId]/advisor/
?? apps/web/src/app/projects/[projectId]/page.tsx
?? apps/web/src/app/projects/[projectId]/project-actions.tsx
?? apps/web/src/app/projects/new/
?? apps/web/src/app/projects/page.tsx
?? apps/web/src/instrumentation.ts
?? apps/web/src/modules/advisor/
?? apps/web/src/modules/mvp/
?? apps/web/src/modules/selection/
?? apps/web/src/server/security/
?? apps/web/tests/advisor-missing-fields.test.ts
?? apps/web/tests/advisor-mock-provider.test.ts
?? apps/web/tests/e2e/full-mvp-flow.spec.ts
?? apps/web/tests/e2e/mvp-catalog-sales.spec.ts
?? apps/web/tests/e2e/mvp-scenarios.spec.ts
?? apps/web/tests/e2e/mvp-ui-routes.spec.ts
?? apps/web/tests/legacy-cleanup-shutdown.test.ts
?? apps/web/tests/mvp-project-access.test.ts
?? apps/web/tests/p13-a-migration.test.ts
?? apps/web/tests/p13-b-migration.test.ts
?? apps/web/tests/p13-build-audit.test.ts
?? apps/web/tests/p13-db-tooling.test.ts
?? apps/web/tests/p13-deployment-evidence-bundle.test.ts
?? apps/web/tests/p13-deployment-evidence.test.ts
?? apps/web/tests/p13-release-security.test.ts
?? apps/web/tests/p13-startup-powershell-resolver.test.ts
?? apps/web/tests/p13-startup-preflight.test.ts
?? apps/web/tests/p13-storage-delete-audit.test.ts
?? apps/web/tests/p13-storage-inventory.test.ts
?? apps/worker/scripts/
?? apps/worker/src/bootstrap.ts
?? apps/worker/src/security/
?? apps/worker/src/worker-entry.ts
?? apps/worker/tests/legacy-cleanup-shutdown.test.ts
?? apps/worker/tests/storage-capability.test.ts
?? apps/worker/tests/test-worker-entry.ts
?? docs/architecture/
?? docs/product/
?? packages/authority-core/
?? packages/build-integrity/
?? packages/file-storage/src/capabilities.ts
?? packages/file-storage/src/legacy-cleanup.ts
?? packages/file-storage/tests/capabilities.test.ts
?? packages/selection-engine/tests/selection-engine.test.ts
?? prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/
?? prisma/migrations/20261117130000_phase37_p13_lifecycle_insert_guard/
?? prisma/migrations/20261117140000_phase37_p13_lifecycle_initial_state_guard/
?? prisma/migrations/20261123130000_full_mvp_domain/
?? tools/
```

No complete pre-build path manifest was found. Baseline comparison against BUILD-001 start is therefore:

```text
BASELINE COMPARISON NOT AVAILABLE
```

The current snapshot exactly matches the BUILD-001 final count, but that is not proof of per-file identity across the implementation period.

## 4. Review Scope and Restrictions

Reviewed:

- all BUILD-001 delivery documents and their hashes;
- root project rule routing and relevant business, AI, catalog, API and test documents;
- P1-3 design freeze, implementation status and behavior-test plan;
- MVP advisor, requirement, catalog, selection, sales and authorization source;
- MVP new migration and relevant Prisma schema;
- MVP E2E source and test assertions;
- known P1-3 upload/test failure source paths.

Not performed by this review:

- database connection, SQL, migration, seed or reset;
- E2E execution;
- Storage access;
- browser download or browser launch;
- build execution;
- source, migration, config or test modification;
- Git write operation;
- ACL, service, registry, PFR or `$null` operation.

## 5. Functional Review

### 5.1 Three scenarios

All three scenario entry points exist and use structured requirements, confirmation and selection:

- `OLD_BUILDING_ADDITION`;
- `EXISTING_ELEVATOR_RENOVATION`;
- `NEW_BUILDING_INSTALLATION`.

Risk messages and the professional-review boundary are present.

However, three material defects prevent a clean pass.

#### P1-01 — Negative external-installation text is inverted

Source:

```text
apps/web/src/modules/advisor/mock-provider.ts:82-86
```

The parser checks positive keywords before negative keywords:

```text
if 外装
  if 可以 | 允许 | 可行 -> true
  else if 不可以 | 不允许 | 不可行 -> false
```

Because `"外装不允许"` contains `"允许"`, the first branch wins. A pure runtime reproduction returned:

```json
{"externalInstallationAllowed":true,"missingFields":[]}
```

This is a confirmed data-integrity defect and contradicts the existing renovation E2E input at:

```text
apps/web/tests/e2e/mvp-scenarios.spec.ts:135
```

The test did not assert the resulting external-installation value.

#### P1-02 — Conversation state is project-global, not conversation-scoped

Source:

```text
apps/web/src/app/api/projects/[projectId]/advisor/conversations/[conversationId]/messages/route.ts:25
apps/web/src/modules/advisor/service.ts:82-86
apps/web/src/modules/advisor/service.ts:150-153
```

Every message route obtains the project's latest requirement and uses that requirement's scenario. Conversation detail also returns the project's latest requirement, not the requirement belonging to the requested conversation.

Consequences:

- opening an older conversation can show another conversation's requirement;
- continuing an older conversation can use another conversation's scenario;
- creating a new scenario conversation can cause subsequent updates to replace the project-global latest state.

No test covers two conversations with different scenarios.

#### P1-03 — Requirement scenario is not bound to the project scenario

Conversation creation accepts the scenario from the request without checking `Project.projectType`. Requirement PATCH can also change the scenario.

Source:

```text
apps/web/src/app/api/projects/[projectId]/advisor/conversations/route.ts:58-65
apps/web/src/app/api/projects/[projectId]/requirements/route.ts:47-75
```

An API caller can therefore place a new-building requirement under an old-building project and run selection against the modified scenario. The UI normally sends the project-derived scenario, but the server does not enforce the invariant.

### 5.2 AI Advisor

Confirmed strengths:

- messages and structured data persist in dedicated tables;
- the provider is deterministic and does not make network calls;
- merged requirements pass the Zod draft schema;
- manual edits recalculate missing fields;
- requirement versions and revisions are append-oriented.

Confirmed weaknesses:

- the requirement UI displays only the latest version, not the full revision history;
- message, requirement and assistant reply writes are not one transaction; a failure can leave a user message without a structured update or assistant reply;
- manual edits do not establish trusted field-source metadata;
- `requirementUpdateSchema` accepts client-provided `fieldSources` and the PATCH spread accepts it:

```text
packages/contracts/src/index.ts:361
apps/web/src/app/api/projects/[projectId]/requirements/route.ts:53-55
```

### 5.3 Product catalog

Confirmed strengths:

- manufacturer, brand, product, specification and price records exist;
- specification and price version rows are created;
- product updates write an AuditLog inside the transaction;
- customer catalog filters product-level `DEMO_MOCK`/`VERIFIED`.

Confirmed P1 trust defects:

- product verification status can be changed to `VERIFIED` while the hidden source remains the hard-coded demo source;
- manufacturer and brand verification/source are not considered by customer APIs or selection;
- latest specification and price rows are selected solely by version number;
- specification verification, `effectiveFrom` and `effectiveTo` are not used;
- API contracts do not expose effective dates;
- the customer catalog trusts product-level verification while displaying parameters from a latest specification row whose verification status is not checked.

Evidence:

```text
apps/web/src/app/admin/products/product-form.tsx:29-48
apps/web/src/app/admin/products/[productId]/product-edit-form.tsx:45-64
apps/web/src/modules/mvp/store.ts:402-425
apps/web/src/modules/mvp/store.ts:440-463
apps/web/src/app/api/catalog/products/route.ts:20-23
prisma/schema.prisma:1014-1034
```

### 5.4 Deterministic selection

The engine is deterministic and does not call a model. It checks scenario, capacity, speed, floors, travel when present and budget category.

Critical defects:

- capacity and speed targets are derived solely from floor count using hard-coded thresholds;
- those inferred targets are used as exclusion rules;
- no approved business source in the reviewed documents defines these thresholds;
- evaluation proceeds without detecting ambiguous values such as exactly `8` or `10` floors in the test message;
- missing `maxTravelM` is accepted as a successful recommendation;
- missing shaft, pit and overhead dimensions are accepted;
- product, specification and price validity are conflated with product-level status;
- excluded products do not expose their exact exclusion reasons.

Pure reproduction with a `VERIFIED` product lacking `maxTravelM` returned:

```text
status: COMPLETED
recommendationCount: 1
dataClassification: OPERATIONAL
warnings: []
```

This is not safe for a customer-facing operational recommendation without explicit missing-data handling.

Source:

```text
packages/selection-engine/src/index.ts:112-132
packages/selection-engine/src/index.ts:190-225
packages/selection-engine/src/index.ts:262
apps/web/src/modules/selection/service.ts:25-44
```

### 5.5 Customer, sales and administrator flows

Confirmed strengths:

- customer project reads and writes require project-scoped permissions;
- conversation IDs are checked against the URL project;
- selection writes require `selection.run`;
- sales follow-up checks the handoff's project before writing;
- product management requires global `catalog.manage`;
- cross-customer E2E source includes negative project, conversation and requirement requests.

Weaknesses:

- sales list APIs load every handoff, latest requirement and selection run before filtering to authorized projects;
- a handoff is not bound to a requirement version or selection-run snapshot, so the sales view can change after handoff;
- new state-changing MVP APIs do not use the existing `assertSameOrigin` control used by file mutations.

## 6. Database and Migration Review

Migration:

```text
prisma/migrations/20261123130000_full_mvp_domain/migration.sql
```

Static positives:

- only additive enum values and tables are present;
- no existing P1-3 table is dropped or redefined;
- core parent/user references use foreign keys;
- version uniqueness exists for requirements, specifications and prices;
- product changes have a transaction-level audit record.

Static gaps requiring correction or runtime proof:

- `building_requirement.conversationId` does not enforce that the conversation belongs to the same project;
- `selection_run.requirementId` does not enforce that the requirement belongs to `selection_run.projectId`;
- `selection_recommendation.specVersion` has no foreign/composite reference to the selected specification;
- `sales_handoff.assignedToId` is a text field with no foreign key;
- specification and price effective-date ordering is not constrained;
- product-scenario JSON and requirement field JSON have no database shape constraint;
- no composite database constraint prevents cross-project requirement/selection relationships.

These are primarily defense-in-depth and state-integrity gaps. Application authorization currently prevents an ordinary customer from selecting another project's requirement through the HTTP path. Database behavior and trigger interaction remain:

```text
RUNTIME VERIFICATION REQUIRED
```

## 7. P1-3 Compatibility

The existing upload service still performs:

```text
FileUploadIntent PENDING -> UPLOADING
```

before creating the required Attempt chain:

```text
apps/web/src/modules/files/upload-service.ts:359-371
```

The P1-3 trigger requires `currentAttemptId` and exactly one open Attempt when status is `UPLOADING`:

```text
prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:1250-1258
```

The trigger is correct relative to the approved P1-3 design. The legacy upload service is incompatible. FileVersion creation also lacks the required chain fields:

```text
apps/web/src/modules/files/upload-service.ts:474-495
prisma/schema.prisma:409-411
```

This blocks:

- real file upload;
- legacy upload E2E;
- file-related integration tests;
- repository-wide Web typecheck;
- production readiness.

It does not block the no-file Mock-AI demonstration path, but it invalidates a broad all-tests-green claim.

## 8. Known Failure Classification

| Failure | Classification | Evidence and impact |
|---|---|---|
| External installation negation inverted | `MVP_NEW_CODE_DEFECT` | Confirmed pure reproduction; blocks safe negative-condition demo |
| Conversation requirement cross-contamination | `MVP_NEW_CODE_DEFECT` | Project-global latest requirement; blocks multi-conversation correctness |
| Product verified/demo source elevation | `MVP_NEW_CODE_DEFECT` | Hidden demo source can satisfy VERIFIED check; blocks catalog trust |
| Operational recommendation with missing travel | `MVP_NEW_CODE_DEFECT` | Pure reproduction; blocks reliable selection |
| Legacy upload chain failure | `P1_3_LEGACY_COMPATIBILITY` | Intent transitions before Attempt; trigger rejects |
| Legacy FileVersion fixtures missing chain fields | `P1_3_LEGACY_COMPATIBILITY` | Web typecheck and DB constraints fail |
| Playwright Chromium unavailable | `TEST_INFRASTRUCTURE` + `NOT_VERIFIED` | Browser behavior cannot be observed |
| Root test fails on `authority-core` `vitest` resolution | `TEST_INFRASTRUCTURE` | Package declares test but command cannot resolve binary |
| Worker PDF timeout under parallel package run | `TEST_INFRASTRUCTURE` | Isolated rerun passes; suite is resource-sensitive |
| Production build missing `P13_RELEASE_ID` | `SECURITY_GATE_BLOCKED` + `ENVIRONMENT_CONFIGURATION` | Expected secure refusal; not bypassed |
| DB trigger/migration behavior not re-executed | `NOT_VERIFIED` | This review is prohibited from database access |

## 9. Current Test Evidence

Independently executed this review, without database access:

```text
Web unit/static: 28 files / 275 tests PASS
Worker first parallel package run: 18/19 PASS, 1 PDF timeout
Worker isolated rerun: 6 files / 19 tests PASS
Contracts: 4 files / 15 tests PASS
Selection: 2 files / 9 tests PASS
File storage: 2 files / 19 tests PASS
```

Typecheck:

```text
Worker: PASS
Contracts: PASS
Selection: PASS
Web: FAIL
```

Web errors are confined to legacy P1-3 upload/file-version fixtures in the current compiler output.

Not executed:

```text
MVP E2E
full E2E
database constraint suite
browser UI
production build
```

## 10. Demo Environment Assessment

A controlled API/route demo can be prepared, but current default product behavior is not safe for unrestricted demonstration.

Required restrictions:

- use only the verified isolated test database and test Worker entry;
- use only seeded `DEMO_MOCK` products;
- do not change a product to `VERIFIED`;
- avoid negative external-installation language until P1-01 is fixed;
- use one requirement conversation per project until P1-02/P1-03 are fixed;
- do not demonstrate real upload/download;
- install and verify a browser separately before UI acceptance;
- display Mock AI, preliminary-advice and site-survey disclaimers throughout.

There is no dedicated application-level `DEMO_MODE` that prevents a manually started normal Web process from using an arbitrary `DATABASE_URL`. E2E configuration injects the test database, but the runbook must enforce the environment.

## 11. Eleven Required Conclusions

| Area | Conclusion | Reason |
|---|---|---|
| `PRODUCT_FUNCTIONAL_COMPLETENESS` | **FAIL** | core scenario and conversation correctness defects |
| `CUSTOMER_DATA_ISOLATION` | **PASS WITH WARNINGS** | source controls are coherent; current DB E2E not rerun and DB composite gaps remain |
| `SALES_AND_ADMIN_AUTHORIZATION` | **PASS WITH WARNINGS** | server checks exist; global-fetch-before-filter and no snapshot binding remain |
| `CATALOG_DATA_TRUSTWORTHINESS` | **FAIL** | DEMO source can be elevated to VERIFIED; effective dates and nested verification ignored |
| `SELECTION_RESULT_RELIABILITY` | **FAIL** | missing critical dimensions can produce OPERATIONAL recommendations |
| `DATABASE_CHANGE_SAFETY` | **BLOCKED** | migration is additive but runtime behavior and cross-entity constraints are unverified |
| `P1_3_COMPATIBILITY` | **FAIL** | legacy upload service conflicts with approved Attempt/Lifecycle chain |
| `TEST_SUITE_HEALTH` | **FAIL** | Web typecheck fails; root tests fail; worker has timeout fragility; E2E not independently rerun |
| `BROWSER_VERIFICATION` | **NOT VERIFIED** | Chromium absent |
| `DEMO_ENVIRONMENT_READINESS` | **NOT VERIFIED** | no browser run, no runnable guarded demo command, core P1 defects |
| `PRODUCTION_READINESS` | **BLOCKED** | P1-3, demo/real separation, Build Gate config and runtime evidence |

## 12. Overall Decision

```text
NOT DEMO-READY
```

No P0 vulnerability was confirmed. However, P1 product-integrity defects affect requirement extraction and recommendation trust. A demo could be manually constrained around these defects, but that would be a scripted exception rather than a safe product readiness claim.

The next phase must remediate P1 product defects first and P1-3 compatibility separately. This report does not authorize remediation.

