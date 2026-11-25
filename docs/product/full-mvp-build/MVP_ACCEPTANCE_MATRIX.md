# MVP Acceptance Matrix

| Required capability | Result | Actual evidence |
|---|---|---|
| Customer login and Session | PASS | Better Auth login exercised in API and authenticated route tests |
| Server-side RBAC | PASS | Permission checks in every MVP API; scoped role tests |
| Customer data isolation | PASS | Other-customer project, advisor and requirement access return 403 |
| AI Advisor | PASS | Multi-turn deterministic advisor, persisted messages and requirement revisions |
| Mock AI offline operation | PASS | No outbound AI/network call in advisor or selection code |
| Requirement collection | PASS | Chat extraction, manual editing, missing fields and confirmation |
| Three business entry scenarios | PASS | Old addition, existing renovation and new installation each completed through selection |
| Elevator catalog | PASS | Catalog query, scenario/brand/model filtering, admin versions |
| DEMO data distinction | PASS | `DEMO_MOCK` labels on products and recommendations |
| Deterministic selection | PASS | Pure package tests and persisted selection runs |
| Budget analysis | PASS | Within, slightly over and unknown/expired behavior |
| Recommendation traceability | PASS | Product/spec/price versions, source references, reasons and warnings |
| Candidate comparison | PASS | Multiple eligible candidates rendered in comparison table |
| Customer project pages | PASS | Home, list, create, detail, advisor and catalog routes |
| New-project customer bootstrap | PASS | Global account role grants only project creation; project role is assigned transactionally |
| Sales handoff | PASS | Requirement, latest selection, budget concern, notes and status |
| Sales project isolation | PASS | Scoped sales sees assigned project; unassigned handoff write denied |
| Product management | PASS | Create/edit, validation, version increment and audit |
| Unauthenticated rejection | PASS | Existing and new route tests verify Session enforcement |
| Critical automated tests | PASS | Web, Worker, contracts, selection, file-storage and four MVP E2E files |
| Browser/component execution | NOT VERIFIED | Playwright Chromium is not installed; no download was attempted |
| Repository-wide typecheck | FAIL — PRE-EXISTING | Fresh generated Client exposes old P1-3 upload/fixture chain-field errors |
| Repository-wide legacy file E2E | FAIL — PRE-EXISTING | Old upload path conflicts with P1-3 Upload Attempt/Lifecycle triggers |
| Production web build | BLOCKED — CONFIGURATION | Secure build rejects missing `P13_RELEASE_ID`; Gate not bypassed |
| Real AI | NOT IMPLEMENTED BY DESIGN | Mock-only authorization |
| Real files/Storage | NOT IMPLEMENTED BY DESIGN | P1-3 integration remains separately blocked |
| Survey/quote/contract/delivery | NOT IMPLEMENTED | Outside Demo-Ready batch |

## Acceptance scenarios

### Scenario A — Old-building addition

`PASS`

Validated residential building, eight floors, floor height, budget, external installation condition, requirement confirmation and DEMO recommendation.

### Scenario B — New-building installation

`PASS`

Validated school building, floors, height, budget, external installation condition and drawing metadata. The UI explicitly states that drawing recognition is not connected.

### Scenario C — Existing-elevator renovation

`PASS`

Validated office renovation, original elevator description and renovation goal, then preliminary selection.

### Scenario D — Authorization isolation

`PASS`

Cross-customer and unassigned-sales requests fail closed. Advisor routes use `advisor.use`; requirements use `advisor.use`; selection writes use `selection.run`; handoff creation uses `sales.handoff.create`.

### Scenario E — Product catalog

`PASS`

Admin creates a DEMO product, rejects invalid parameters, edits it into spec/price version 2, reads version 2 and verifies audit entry.

### Scenario F — Sales handoff

`PASS`

Sales receives the customer-confirmed requirement, latest completed selection, budget concern and can append an internal follow-up note. No quotation or contract is created.

