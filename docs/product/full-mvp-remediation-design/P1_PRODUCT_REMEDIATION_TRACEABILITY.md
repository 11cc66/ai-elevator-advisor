# P1 Product Remediation Traceability

All items below are `OPEN — DESIGN ONLY`. A completed design does not close an implementation finding.

## Traceability Matrix

| Review ID | Original finding | Evidence | Design section | Planned implementation area | Planned tests | Acceptance condition | Current status |
|---|---|---|---|---|---|---|---|
| `P1-01` / `MVP-R-01` | Negative external-installation text becomes true | `apps/web/src/modules/advisor/mock-provider.ts:82-86`; pure reproduction | Design A1 | advisor extraction contracts/parser | `NS-01`–`NS-12` | all negative forms become false or confirmation; no wrong boolean | OPEN — DESIGN ONLY |
| `P1-02` / `MVP-R-02` | Requirement state is project-global instead of conversation-scoped | `advisor/service.ts:82-86,150-153`; message route `:25-37` | Design A2/A5 | conversation pointer, requirement repository, routes | `CI-01`–`CI-08` | conversation read/write always uses its own current requirement | OPEN — DESIGN ONLY |
| `P1-03` / `MVP-R-02` | Requirement scenario can diverge from project scenario | conversation route `:58-65`; requirement route `:47-75` | Design A3/A4 | project/conversation FK and server-derived scenario | `PT-01`–`PT-06` | client scenario rejected or absent; project type immutable after activity | OPEN — DESIGN ONLY |
| `MVP-R-03` | DEMO product can be changed to VERIFIED with hidden demo source | admin product forms; contracts source check; product/store queries | Design B1/B2/B6 | source/review/revision model | `CT-01`–`CT-09` | DEMO classification cannot become formal; approval requires separate review | OPEN — DESIGN ONLY |
| `MVP-R-03` / catalog | Product-level status is trusted while manufacturer/brand/spec/price/effective windows are ignored | `store.ts:402-463`; customer catalog route `:20-23` | Design B1/B3/B5/B7 | trusted catalog repository/queries | `CT-10`–`CT-22` | formal candidate requires all dimensions valid at evaluation time | OPEN — DESIGN ONLY |
| `MVP-R-04` | Missing `maxTravelM`/shaft/pit/overhead can yield OPERATIONAL | `selection-engine/src/index.ts:190-225`; pure reproduction | Design C1/C2/C4 | selection contracts/engine | `SL-01`–`SL-15` | missing critical data yields `INSUFFICIENT_DATA`, never OPERATIONAL | OPEN — DESIGN ONLY |
| `MVP-R-05` | Floor-only capacity/speed thresholds lack authority | `selection-engine/src/index.ts:112-132` | Design C2 | rule set model and engine | `RA-01`–`RA-08` | no hard rule runs without approved authority/version | OPEN — DESIGN ONLY |
| `MVP-R-08` | Requirement PATCH has no CAS and client can submit field provenance | requirements route `:47-76`; contracts `:361` | Design A5/A7/D1 | contract, server-owned field model, transaction | `CC-01`–`CC-08`, `PV-01`–`PV-04` | stale PATCH yields 409 and caller cannot write provenance | OPEN — DESIGN ONLY |
| `P1-02` / advisor transaction | Conversation/message/requirement writes can partially commit | `advisor/service.ts:88-130`; store append/version transactions | Design A5/A6 | atomic interaction command | `TX-01`–`TX-06` | retries are idempotent and no partial visible interaction | OPEN — DESIGN ONLY |
| `MVP-R-07` | Sales handoff dynamically changes after later requirement edits | `store.ts:1018-1065` | Design D2 | handoff case/snapshot model | `SH-01`–`SH-10` | handoff snapshot remains byte-stable after project changes | OPEN — DESIGN ONLY |
| `MVP-R-07` / query | Sales query loads unauthorized handoffs before filtering | admin sales route `:25-31`; page `:25-31` | Design E2 | SQL-scoped repository | `SQ-01`–`SQ-08` | authorization predicate executes before join/limit and unauthorized rows never enter application memory | OPEN — DESIGN ONLY |
| `MVP-R-06` | New state-changing APIs lack same-origin check | existing `assertSameOrigin` used only by file routes | Design E1 | shared mutation guard | `CS-01`–`CS-07` | every browser mutation rejects missing/mismatched Origin | OPEN — DESIGN ONLY |
| `MVP-R-09` | Cross-project composite relationships are not DB-enforced | migration `:84-120,244-315` | Design D3 | forward migration + composite FKs/checks | `DB-01`–`DB-16` | direct SQL cannot form cross-project conversation/requirement/selection/handoff chain | OPEN — DESIGN ONLY |
| `MVP-R-09` / effective windows | Specification/price validity ordering and overlap not enforced | migration `:195-241` | Design B5 | CHECK/partial unique/exclusion constraints | `DB-17`–`DB-24` | ambiguous/overlapping effective versions cannot enter formal resolution | OPEN — DESIGN ONLY |
| `MVP-R-10` | No explicit guarded Demo runtime target | test tooling only injects test DB | Design B6/Stage 5 | startup demo guard | `DE-01`–`DE-08` | unknown DB/storage/provider context prevents Demo startup | OPEN — DESIGN ONLY |
| `MVP-R-11` | Root test command cannot resolve authority-core vitest; worker test is resource-sensitive | `authority-core/package.json`; prior review evidence | Design Stage 5 | tooling only, separate from product correctness | `TI-01`–`TI-05` | clean environment root test is reproducible and flake policy is explicit | OPEN — DESIGN ONLY |
| `MVP-R-12` | Browser UI is unverified | Chromium absent | Design Stage 5 | browser suite | `BR-01`–`BR-08` | desktop/mobile browser flow passes with screenshots and console checks | OPEN — DESIGN ONLY |
| `P13-R-01` | Upload Intent transitions to UPLOADING before Attempt chain; FileVersion lacks chain fields | upload service `:359-371,474-495`; P1-3 trigger `:1250-1258` | Design section 2.5 and explicit exclusion | none in this remediation | separate P1-3 tests | approved Attempt/Lifecycle chain passes | OUT OF SCOPE / OPEN |
| `P13-R-02` | Runtime roles, OS identity and cleanup evidence incomplete | P1-3 implementation status | explicit exclusion | none in this remediation | separate security plan | independent runtime security review passes | OUT OF SCOPE / OPEN |

## Finding-to-Test Detail

### P1-01

Original attack/failure:

```text
input: 外装不允许
actual: externalInstallationAllowed = true
expected: false or NEEDS_CONFIRMATION
```

The current test suite covers only an affirmative external-installation example and does not assert the renovation negative value.

### P1-02

Current evidence:

```text
message route loads project latest requirement
service loads project latest requirement again
conversation detail returns project latest requirement
```

Target removes latest-project lookup from conversation APIs. A project current pointer, if present, is separate and never used as an implicit conversation source.

### MVP-R-03

The target review distinguishes:

- source classification;
- source review;
- manufacturer status;
- brand status;
- product revision status;
- specification status/effective window;
- price status/effective window;
- review state.

No single editable product enum can represent all of these as VERIFIED.

### MVP-R-04/MVP-R-05

The current test expectation that capacity/speed are derived from floors must be replaced after product/business approval. It is not an acceptable hard rule solely because a test asserts it.

### MVP-R-07

Snapshot acceptance must compare canonical digest before and after a later requirement/selection change. A UI label is insufficient.

### MVP-R-09

Application-level authorization remains required. Composite constraints only guarantee that accepted IDs form a valid ownership chain.

## P1-3 Separation Register

The following remain excluded from this design’s implementation plan:

```text
apps/web/src/modules/files/upload-service.ts
prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql
prisma/migrations/20261117130000_phase37_p13_lifecycle_insert_guard/migration.sql
prisma/migrations/20261117140000_phase37_p13_lifecycle_initial_state_guard/migration.sql
```

No compatibility field, disabled trigger, direct final-state fixture, or test-only bypass is permitted.

## Current Closure Statement

```text
P1 design coverage: COMPLETE
P1 implementation: NOT STARTED
Independent review: PENDING
Problem closure: NONE
```

