# Post-GitHub Development Baseline and Next-Phase Plan

## 1. Executive Summary

```text
Date:
2026-11-25

Mode:
READ-ONLY BASELINE RECOVERY / NEXT-PHASE PLANNING

Final Status:
PASS WITH WARNINGS — BASELINE RECOVERED; IMPLEMENTATION NOT AUTHORIZED
```

The public GitHub baseline is intact and directly traceable:

```text
Repository:
https://github.com/11cc66/ai-elevator-advisor

Branch:
codex/public-github-sync

HEAD / origin/main:
101e8a362e430f4fa7b31b67c56823cb702eb1e6
```

The project has a credible DEMO_MOCK product flow:

- authentication and project-scoped authorization;
- deterministic Mock AI requirement intake;
- three installation scenarios;
- DEMO product catalog;
- deterministic preliminary selection;
- customer recommendation pages;
- sales handoff and follow-up notes.

It is not production-ready and its full V1.0 workflow is incomplete:

- AI is deterministic mock code, not a real provider integration;
- all product and price data is fictional `DEMO_MOCK`;
- legacy upload code is incompatible with the existing P1-3 upload chain;
- repository-wide typecheck currently fails in that pre-existing upload area;
- P1-3 cleanup/recovery/OS authority remains blocked;
- the latest product-remediation independent review is FAIL;
- the latest completed P1-3 Native/PFR independent review is FAIL;
- follow-up design corrections have not been independently reviewed;
- survey, formal approval, quotation, contract, delivery and maintenance are not implemented.

No source, schema, migration, build, database, Storage, ACL, Service or Native
RPC operation was performed by this task.

## 2. Skills and Rules Applied

Read and applied:

- root `AGENTS.md`;
- blueprint `AGENTS.md`;
- `$project-architecture` and its architecture review reference;
- `$prisma-db-safety` and its database change review reference;
- `$security-audit` and its adversarial review reference;
- `$testing-and-verification` and its verification matrix;
- `$file-lifecycle` and its lifecycle review reference.

The root file-lifecycle route required complete reading of:

- `D01` through `D11`;
- `P1`, `P2`, `P30` through `P37`;
- `FZ` (`file-lifecycle-p13-design-freeze.md`);
- `ST` (`file-lifecycle-p13-implementation-status.md`);
- `DBTP` (`file-lifecycle-p13-database-behavior-test-plan.md`).

The review also read the latest relevant MVP, R3-C8/R4/R5, Native/PFR and P1-3
review materials. No `.env`, `.env.test`, key, token, credential or real
connection string was read.

## 3. Git Baseline

### 3.1 Initial state

```text
Repository root:
D:\thinkbook\Desktop\jieya

Branch:
codex/public-github-sync

HEAD:
101e8a362e430f4fa7b31b67c56823cb702eb1e6

origin/main:
101e8a362e430f4fa7b31b67c56823cb702eb1e6

HEAD == origin/main:
YES

Tracked modified:
0

Staged:
0

Deleted:
0

Untracked non-ignored:
2

  $null
  docs/product/full-mvp-remediation-review-r3-c5/tools/__pycache__/
```

`$null` content was not read, hashed, modified, moved or deleted.
`apps/web/.next` and `apps/worker/dist` were not modified, moved, deleted or
started.

Preserved branch pointers:

```text
feature/p1-3-storage-lifecycle-schema:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

local main:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

release branch:
101e8a362e430f4fa7b31b67c56823cb702eb1e6
```

The release branch is the current checkout and tracks `origin/main`.

### 3.2 Final state

This report is the only file added:

```text
Tracked modified: 0
Staged: 0
Deleted: 0
Untracked non-ignored: 3
```

The third untracked path is this report. No existing user file was overwritten.

## 4. Public Repository State

GitHub confirms:

```text
Account:          11cc66
Repository:       ai-elevator-advisor
Visibility:       PUBLIC
Default branch:   main
Remote HEAD:      101e8a362e430f4fa7b31b67c56823cb702eb1e6
Viewer permission:ADMIN / PUSH
Tree SHA:         f036849c47793857bb084e7930968e66a884bfb8
Tracked files:    1,089
```

The remote tree, README blob, publication report and candidate Manifest were
verified byte-for-byte by the preceding publication task. This task rechecked
the current branch/HEAD and remote HEAD relationship only; it did not rewrite
the repository.

## 5. Actual Project Capability Status

### 5.1 Product UI and workflow

| Area | Evidence-backed state | Runtime |
|---|---|---|
| Login/session | Implemented with Better Auth database sessions | Historical tests / current Runtime NOT VERIFIED |
| Global and project RBAC | Implemented in server modules and APIs | Historical tests / current Runtime NOT VERIFIED |
| Customer project list/create/detail | Implemented | Historical route tests |
| Advisor conversation UI | Implemented with persisted messages | Historical route tests |
| Requirement draft/confirmation | Implemented, versioned | Historical tests |
| Catalog customer/admin pages | Implemented with versioned DEMO data | Historical tests |
| Selection/recommendation pages | Implemented | Historical tests |
| Sales handoff/notes | Implemented | Historical tests |
| File upload/download/field-review UI | Existing infrastructure | Historical tests; current upload chain blocked |
| Survey/formal approval/quotation/contract | Not implemented | N/A |

The earlier MVP Readiness estimate of 21% is obsolete after the Full MVP Build.
No defensible single percentage is currently used because the repository mixes
a substantially implemented Demo scope with largely unimplemented production
workflow and security/runtime tracks.

### 5.2 AI provider

Actual active implementation:

```text
MockAIProvider
deterministic bounded Chinese text parsing
no outbound AI/network call
provider = MOCK
professional review always required
```

Real AI provider:

```text
NOT IMPLEMENTED
NOT AUTHORIZED
NO CREDENTIAL PATH FOUND
```

`REAL_PROVIDER` exists only as a persistence/type value and is not activated.

### 5.3 Product data and price

```text
Manufacturer/Brand/ProductModel/
ProductSpecification/ProductPrice models: IMPLEMENTED
DEMO seed: IMPLEMENTED
Real manufacturer data: NOT PRESENT
Real price source: NOT PRESENT
Formal review workflow: NOT IMPLEMENTED
```

All displayed guidance remains `DEMO_MOCK` and is unsuitable for procurement,
engineering or formal quotation.

### 5.4 Installation scenarios

Implemented:

- `OLD_BUILDING_ADDITION`;
- `EXISTING_ELEVATOR_RENOVATION`;
- `NEW_BUILDING_INSTALLATION`.

Historical Full MVP E2E records all three as PASS. Current E2E was not rerun in
this read-only task.

### 5.5 P1-3 upload and lifecycle

Schema models exist for:

- `FileUploadAttempt`;
- `StorageObjectLifecycle`;
- `StorageObjectOperation`;
- FileVersion upload chain fields.

Database-side design and migrations exist, but application integration remains
incomplete:

```text
legacy upload service:
does not create the required Attempt/Lifecycle/Operation chain

result:
current upload feature SCHEMA-INCOMPATIBLE
repository-wide typecheck FAIL
legacy file E2E/integration tests fail
```

Production file lifecycle capabilities:

```text
close attestation: NOT IMPLEMENTED
writer fencing: NOT IMPLEMENTED
quarantine/restore/purge: NOT IMPLEMENTED / NOT ENABLED
Active exception recovery: NOT IMPLEMENTED / PROHIBITED
Maintenance storage authority: UNAVAILABLE
Legacy physical cleanup: DISABLED / FAIL-CLOSED
```

This is the most direct blocker to a truthful "real file upload" MVP.

## 6. Verification State

### 6.1 Current observations

This task did not execute tests because it was read-only and tests can create
databases, Storage, build artifacts or other persistent side effects.

Current source inspection and the immediately preceding publication preparation
record:

```text
Contracts unit tests:        15/15 PASS
Selection-engine unit tests:  9/9 PASS
Repository typecheck:        FAIL — pre-existing P1-3 upload chain
```

### 6.2 Historical Full MVP evidence

`FULL-MVP-BUILD-001` reports:

```text
Web unit/static:  28 files / 275 tests PASS
Worker:            6 files / 19 tests PASS
Contracts:         4 files / 15 tests PASS
Selection engine:  2 files / 9 tests PASS
File storage:      2 files / 19 tests PASS
MVP E2E:           4 files / 4 tests PASS
Isolated DB reset: PASS
14 migrations:     PASS on elevator_advisor_test
db:validate:       PASS
db:generate:       PASS
build:packages:    PASS
```

These are historical test claims, not re-executed evidence in this task.

### 6.3 Known failures

```text
Legacy upload E2E:          5 PASS / 5 FAIL
Legacy DB constraints:     12 PASS / 55 FAIL
Web Typecheck:             FAIL in old upload/fixture chain
Root pnpm test:             FAIL due authority-core vitest resolution
Secure Web production build: BLOCKED — P13_RELEASE_ID missing
Browser UI automation:      NOT VERIFIED — Chromium unavailable
```

### 6.4 Runtime validation matrix

| Surface | Status |
|---|---|
| Current PostgreSQL environment | NOT ACCESSED |
| Current test database | NOT ACCESSED |
| Current migration execution | NOT EXECUTED |
| Current Storage | NOT ACCESSED |
| Web/Worker Runtime | NOT STARTED |
| Native RPC Build | NOT EXECUTED |
| Native RPC Runtime | NOT EXECUTED |
| Production deployment | NOT AUTHORIZED |

## 7. Review Timeline

### 7.1 Product remediation track

```text
R3-C8 design/review
-> corrections R2
-> corrections R3
-> corrections R4
-> corrections R5
-> R5 Independent Review
```

Latest completed independent review:

```text
docs/product/full-mvp-remediation-review-r3-c8-corrections-r5/INDEPENDENT_REVIEW_R5.md
Date: 2026-11-25
Result: FAIL — DESIGN CORRECTIONS REQUIRED
P0: 0
P1: 0
P2: 4
P3: 2
```

Unresolved P2:

1. Function Registry security/search_path metadata is wrong.
2. Response-loss replay still uses a hardcoded result.
3. Candidate backfill Actor is not bound to the executing session/backend.
4. Independent negative evidence is not fully mutation-traceable and the Open
   Decisions Validator is not exact.

P3:

1. Documented state-vector IDs do not match evidence IDs.
2. Begin samples authoritative time before the final active-Attempt lock.

No R5 correction package or independent follow-up review exists after this
FAIL. No R3-C9 directory/report was found in the released tree.

### 7.2 P1-3 Native/PFR track

```text
R5 Runtime Readiness
-> R5-R2 Pre-Runtime Source Remediation
-> R5-R2-R1/R2 corrections and R7 review
-> R8 fourth blocking design corrections
-> R6-BV6 PFR policy design
-> R6-BV7 independent PFR review
-> R6-BV8 design corrections
```

Latest completed independent Native/PFR review:

```text
BV7
Result: FAIL — BLOCKING DESIGN CORRECTIONS REQUIRED
P0: 0
P1: 6
P2: 5
P3: 2
```

BV7 P1 findings:

1. raw PFR operation grammar;
2. unknown `*1`/`*2` prefix semantics;
3. missing Manifest trust root;
4. deferred path-object binding;
5. incomplete build toolchain dependency closure;
6. no unique/unbypassable Build Entry.

The preceding R7 review reported P1=4, P2=3, P3=2 for Host/Worker identity,
termination authority, Bundle key binding, Challenge pipe inheritance and
related gaps.

### 7.3 Design-only corrections awaiting independent review

```text
R8:
READY FOR INDEPENDENT REVIEW
No R9 independent review found.

BV8:
READY FOR INDEPENDENT REVIEW
No BV9 independent review found.
```

R8 and BV8 claim their predecessor P1/P2 issues are closed at design. Those
claims are not promoted to independent PASS until separate review.

## 8. P1-3 Current Safety State

```text
P1-3 schema: IMPLEMENTED
P1-3 migration: APPLIED IN PRIOR AUTHORIZED ENVIRONMENT
Selected Trigger/constraint tests: HISTORICAL PASS / PARTIAL
Full Trigger matrix: NOT VERIFIED
Deferred OLD/NEW chain behavior: NOT VERIFIED
CANONICAL orphan: BLOCKED
Empty STAGING DELETED: SCHEMA GAP / BLOCKED
Quarantine/Restore/Purge: NOT IMPLEMENTED / NOT ENABLED
Close attestation: NOT IMPLEMENTED
ACTIVE exception recovery: NOT IMPLEMENTED / PROHIBITED
OS-native authority broker: DESIGN ONLY
Current PFR policy: UNCHANGED / FAIL-CLOSED
Current PFR 38/19: CANDIDATE ONLY / NOT APPROVED
```

Protected build artifacts:

```text
apps/web/.next:
PRESENT / not inspected in this task / not modified

apps/worker/dist:
PRESENT / not inspected in this task / not modified
```

Their historical whole-tree integrity remains `NOT VERIFIED`.

## 9. Open Decisions and Unapproved Decisions

The product-remediation R5 line preserves:

```text
Original Open Decision IDs: 57
Present and unique:         57
User-approved:               0
Still OPEN:                  57
```

Critical OPEN areas include:

- Identity Broker;
- Session role topology;
- Root identity provisioning and credential custody;
- Recovery retry limits;
- break-glass authority;
- Candidate maintenance identity;
- evidence retention;
- real AI provider/privacy;
- real product sources and price policy;
- production deployment topology.

P1-3/BV8 additionally requires separate approval or evidence for:

- Host/Worker service identities and SDDL;
- P13 termination test interface;
- Ledger Head Anchor;
- trust keys and Bundle keys;
- Build Broker identity and compiler ACLs;
- immutable path ACL evidence;
- complete toolchain closure;
- parser/prefix/watcher vectors.

No design decision above is treated as user-approved by this report.

## 10. Main MVP Blockers

### Blocker 1 — Upload chain integration

The existing application cannot create a valid P1-3 `FileVersion` chain.
Real file upload, legacy upload E2E and repository-wide typecheck are blocked.

Priority:

```text
P1 PRODUCT DELIVERY BLOCKER
```

### Blocker 2 — R5 product-remediation design remains FAIL

The R5 design has four P2 and two P3 findings and no corrective successor.
R5-dependent Schema/Migration implementation cannot be treated as review-ready.

Priority:

```text
P2 DESIGN/IMPLEMENTATION BLOCKER
```

### Blocker 3 — Native/PFR design chain remains unclosed

BV8 and R8 are only ready for independent review. The current Build Gate remains
fail-closed, and Native RPC Build/Runtime remains prohibited.

Priority:

```text
P1 SECURITY/DEPLOYMENT BLOCKER for Native Runtime
NOT A BLOCKER for Demo Advisor runtime
```

### Blocker 4 — No real AI provider

The active advisor is deterministic mock code. Real provider privacy, data
processing, model choice and operational policy remain OPEN.

Priority:

```text
PRODUCTION V1 BLOCKER
```

### Blocker 5 — No real catalog or formal approval/quote workflow

The catalog and selections are DEMO only. Survey, engineering confirmation,
technical approval, quotation, contract and delivery workflows are absent.

Priority:

```text
PRODUCTION V1 BLOCKER
```

### Blocker 6 — Verification and release evidence incomplete

Typecheck fails; browser/visual E2E is not verified; production build requires
an unconfigured release identity/trust root; CI is absent.

## 11. Recommended Next Work Packages

### WP-1 — P1-3 Upload Chain Integration Design and Implementation Readiness

Goal:

```text
Align current Web upload/finalize code with the existing
FileUploadAttempt / StorageObjectLifecycle / StorageObjectOperation schema
without bypassing Triggers or re-enabling destructive cleanup.
```

This is the highest-value next work package because it unblocks:

- real file upload;
- repository typecheck;
- legacy integration tests;
- safe file/drawing future work;
- a coherent Demo-to-production file path.

Required phases:

1. design addendum: exact app-to-schema mapping, transaction boundaries,
   staging ownership, failure handling, test fixtures;
2. implementation;
3. isolated test-database verification;
4. independent security/lifecycle review.

Do not include quarantine, restore, purge or ACTIVE recovery.

### WP-2 — R5 Design Corrections R6

Scope:

- fix Function Registry parser metadata;
- replace hardcoded replay result with state-derived evidence;
- bind Candidate backfill Actor to executor identity;
- make independent negative evidence mutation-traceable;
- make Open Decisions check exact;
- repair Test Vector IDs;
- correct Begin time/locking order.

Then require a separate R6 independent design review.

### WP-3 — Native/PFR Independent Review Gate

Authorize a read-only independent review of:

- R8 fourth blocking design corrections;
- BV8 PFR policy corrections;
- their decisions/open items and exact source boundaries.

This package must not build or run Native RPC. It can close the design-review
gap only; Build-only remains a later gate.

### WP-4 — Browser and Demo UX Acceptance

After explicit authorization for browser tooling and isolated test database:

- install/use a verified Chromium runtime;
- run browser-level UX and responsive checks;
- verify upload, empty/error states and project isolation;
- preserve current business flow.

This can run in parallel with design-only WP-2/WP-3 only after WP-1 no longer
blocks the page suite.

### WP-5 — Production AI Provider Decision

Must begin as a product/security design:

- provider/privacy choice;
- data processing and retention;
- prompt/tool boundary;
- structured output;
- key management;
- mock-to-real adapter contract.

Implementation must not start until user approval.

### WP-6 — Formal Workflow Expansion

Design and implement in separate vertical slices:

- survey;
- engineering data confirmation;
- formal technical approval;
- quotation;
- contract.

These depend on real role/decision policy and should not be merged into file
lifecycle or Native RPC work.

## 12. Dependency and Authorization Strategy

Recommended sequence:

```text
Gate A:
WP-2 and WP-3 design/review work may be authorized in parallel.

Gate B:
WP-1 design addendum.

Gate C:
WP-1 implementation + unit/typecheck.

Gate D:
WP-1 isolated database/file lifecycle tests.

Gate E:
WP-1 independent security review.

Gate F:
WP-4 browser/demo acceptance.

Gate G:
WP-5 provider design decision.

Gate H:
WP-5 implementation and independent review.

Gate I:
WP-6 formal workflow slices.
```

Tasks that may reasonably share one authorization:

- WP-2 design correction package may include static parser/validator changes and
  offline tests, but not implementation of the corrected database design.
- WP-3 may review R8 and BV8 in one independent read-only gate if each review
  remains separately evidenced.
- WP-1 implementation and non-database unit/typecheck may share one coding
  authorization if it is explicitly limited to that source slice.

Tasks that must remain separate:

- design correction vs independent review;
- source implementation vs isolated database behavior execution;
- Build-only vs Runtime;
- Runtime vs production deployment;
- real AI provider decision vs implementation;
- file lifecycle cleanup/recovery vs ordinary upload.

## 13. Prohibited Operations for the Immediate Next Step

Until separately authorized:

- Prisma Schema or Migration changes;
- database connection, SQL, migration or reset;
- real Storage upload/read/delete/move;
- quarantine/restore/purge or ACTIVE recovery;
- Native RPC Build/Runtime;
- service, Scheduler, ACL, IAM, Owner or audit-policy changes;
- production deployment or production build trust-root setup;
- real customer, manufacturer or pricing data;
- real AI credentials/API calls;
- reading `.env`, `.env.test`, secrets or connection strings;
- deleting or modifying `.next`, worker `dist`, or `$null`;
- destructive Git operations or history rewrite.

## 14. Remaining Unknowns

```text
Current live development/test database schema: NOT ACCESSED
Current live PFR value: NOT READ
Production identity/ACL state: NOT VERIFIED
Production build/trust root: NOT CONFIGURED
Browser visual/mobile behavior: NOT VERIFIED
Full P1-3 Trigger/Deferred behavior: NOT VERIFIED
Upload chain application integration: BLOCKED
BV8 PFR policy: INDEPENDENT REVIEW PENDING
R8 Native TCB design: INDEPENDENT REVIEW PENDING
R5 remediation corrections: NOT STARTED
```

## 15. Final Conclusion

```text
Baseline Recovery:
PASS

Public Repository Traceability:
PASS

Demo Product Code Presence:
PASS WITH WARNINGS

Repository-wide Build/Typecheck:
FAIL — PRE-EXISTING FILE CHAIN INCOMPATIBILITY

Latest Product Remediation Review:
FAIL — R5 CORRECTIONS REQUIRED

Latest P1-3 Native/PFR Review:
FAIL — BV7 BLOCKERS; BV8 REVIEW PENDING

Production Readiness:
NOT VERIFIED

Final Status:
PASS WITH WARNINGS — BASELINE RECOVERED; NEXT WORK REQUIRES SEPARATE AUTHORIZATION
```

The next recommended authorization is **WP-1 — P1-3 Upload Chain Integration
Design**. In parallel, if desired, a separate read-only **WP-3 Native/PFR
Independent Review** can close the design-review gap without widening Runtime
authority.

