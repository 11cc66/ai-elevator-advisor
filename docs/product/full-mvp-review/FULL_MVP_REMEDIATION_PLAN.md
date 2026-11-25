# FULL_MVP Remediation Plan

This plan is design and authorization guidance only. No remediation was executed in FULL-MVP-REVIEW-001.

## Priority policy

- P0: possible data breach, destructive action, privilege bypass or an engineering conclusion presented as valid.
- P1: blocks a core product flow or Demo.
- P2: quality, concurrency, trust or maintainability issue.
- P3: non-blocking UX or maintenance issue.

## MVP product remediation

### MVP-R-01 — Correct negative external-installation parsing

- Priority: P1
- Evidence: `mock-provider.ts:82-86`; pure reproduction with `"外装不允许"` returns `true`.
- Impact: wrong structured requirement and potentially wrong recommendation.
- Direction: test negative forms before positive forms; require whole-phrase matching; add table-driven cases for `不可以`, `不允许`, `不可行`, `禁止`.
- Design needed: No.
- Independent review: Required after implementation due engineering-impacting input.
- Acceptance: all negative variants persist `false`; a positive-only phrase persists `true`; E2E asserts the stored value.

### MVP-R-02 — Scope requirements and scenarios to the conversation and project

- Priority: P1
- Evidence: `service.ts:82-86,150-153`; message route `:25-37`.
- Impact: older conversations show or mutate another conversation's requirements; scenario can drift from project type.
- Direction: store conversation scenario; query latest requirement by `(projectId, conversationId)`; validate conversation scenario against `Project.projectType`; return immutable 409 on mismatch.
- Design needed: Yes, minimal identity model and migration.
- Independent review: Required.
- Acceptance: two concurrent conversations retain independent requirements; opening old conversation never returns another conversation's requirement; cross-scenario API attempt returns 409/422.

### MVP-R-03 — Enforce catalog trust levels and effective dates

- Priority: P1
- Evidence: hidden demo source in product edit form; product verification-only filter; latest spec/price by version; unused effective dates.
- Impact: fictional or stale data can appear `VERIFIED`/`OPERATIONAL`.
- Direction: require source type, source locator, reviewer, review time and validity for VERIFIED; include manufacturer/brand/specification verification; select effective versions; expired price becomes quote-required; customer APIs must not infer operational status from one model row.
- Design needed: Yes.
- Independent review: Required.
- Acceptance: demo source cannot elevate data to VERIFIED; expired effective window is excluded or marked requote; customer E2E proves verified/demo/expired separation.

### MVP-R-04 — Make selection fail closed on critical incomplete data

- Priority: P1
- Evidence: `selection-engine/src/index.ts:190-225`; pure reproduction recommends a VERIFIED product without `maxTravelM` as `OPERATIONAL`.
- Impact: false positive recommendation.
- Direction: define required fields per installed scenario; missing critical shaft/pit/overhead/travel data blocks operational recommendation; retain Demo-only exploratory candidates under an explicit `DEMO_ONLY` status.
- Design needed: Yes, business confirmation required.
- Independent review: Required.
- Acceptance: missing each critical constraint yields pending/NO_OPERATIONAL_MATCH, never an operational candidate; negative tests cover every required field.

### MVP-R-05 — Remove unapproved floor-to-capacity/speed hard constraints

- Priority: P1
- Evidence: `selection-engine/src/index.ts:112-132`; no approved threshold matrix in reviewed business/decision documents.
- Impact: valid products can be excluded and customers can infer engineering parameters not provided by a professional.
- Direction: separate exploratory guidance from hard filtering; require approved rule authority before using minimum capacity/speed; otherwise display as pending professional determination.
- Design needed: Yes, business approval required.
- Independent review: Required.
- Acceptance: no hard exclusion based solely on floor count without an approved rule ID and source; rule version and authority recorded.

### MVP-R-06 — Add same-origin protection to every state-changing MVP API

- Priority: P2
- Evidence: file mutations call `assertSameOrigin`; project, advisor, requirement, selection, handoff and catalog mutations do not.
- Impact: defense-in-depth loss for same-site cross-origin requests.
- Direction: enforce origin check in POST/PATCH/PUT/DELETE handlers or a shared authenticated mutation wrapper.
- Design needed: No.
- Independent review: No, security regression testing required.
- Acceptance: missing/mismatched Origin returns 403; same-origin tests pass.

### MVP-R-07 — Bind sales handoff to a requirement and selection snapshot

- Priority: P2
- Evidence: handoff has only summary/budget concern; sales view dynamically selects latest requirement and latest run; all handoffs are loaded before filtering.
- Impact: sales may see a different state than the one handed off; unnecessary internal data processing.
- Direction: store `requirementId`, `selectionRunId`, `handedOffAt`; filter in SQL by authorized project IDs; render snapshot provenance.
- Design needed: Yes.
- Independent review: Yes for customer/sales visibility.
- Acceptance: later requirement edits do not change an existing handoff snapshot; sales only receives authorized rows from the query.

### MVP-R-08 — Add optimistic concurrency and trusted field provenance

- Priority: P2
- Evidence: requirement PATCH has no `expectedVersion`; client can submit `fieldSources`.
- Impact: concurrent edits overwrite context; source genealogy can be forged.
- Direction: require `expectedRevision`, ignore client-supplied source map, create server-owned field-source records/types, and return 409 on stale edits.
- Design needed: Yes.
- Independent review: Required for provenance.
- Acceptance: concurrent PATCH has one winner and one 409; client cannot write trusted source fields.

### MVP-R-09 — Add database relationship and validity constraints

- Priority: P2
- Evidence: conversation/project, requirement/project, recommendation/spec, effective-date and `assignedToId` relationships lack composite enforcement.
- Impact: inconsistent data through future write paths.
- Direction: add composite FKs/check constraints or trusted database functions, with forward migration.
- Design needed: Yes.
- Independent review: Required.
- Acceptance: direct SQL cannot create cross-project requirement/selection links or invalid effective windows.

### MVP-R-10 — Add an explicit Demo startup guard

- Priority: P2
- Evidence: only test tooling injects the test database; normal app accepts arbitrary `DATABASE_URL`.
- Impact: operator can inadvertently connect a demo UI to a non-demo database.
- Direction: explicit `DEMO_MODE=true` startup gate requiring expected database identity/marker, demo storage root and Mock provider.
- Design needed: Yes.
- Independent review: Required.
- Acceptance: demo startup refuses unknown database/storage identity; no secret is printed.

### MVP-R-11 — Repair test infrastructure and flake classification

- Priority: P2
- Evidence: root `pnpm test` cannot resolve `vitest` for `authority-core`; PDF test timed out only in concurrent package run.
- Impact: unreliable CI signal.
- Direction: fix workspace binary resolution; record known timing constraints or isolate heavy worker tests; do not hide failures.
- Design needed: No.
- Independent review: No.
- Acceptance: clean install/offline environment reproduces root test command; repeated worker suite passes deterministically.

### MVP-R-12 — Browser and visual acceptance

- Priority: P3
- Evidence: Chromium executable absent; only authenticated route HTML was tested.
- Impact: client JavaScript, responsive layout and interaction state unverified.
- Direction: install a pinned approved browser in a separately authorized environment and execute the runbook.
- Design needed: No.
- Independent review: Not required.
- Acceptance: desktop/mobile browser suite passes with screenshots and no console errors.

## P1-3 security-architecture remediation

These tasks are separate from MVP product remediation.

### P13-R-01 — Integrate upload Intent/Attempt/Lifecycle chain

- Priority: P1, separate security workstream.
- Evidence: `upload-service.ts:359-371,474-495`; trigger at P1-3 migration `1250-1258`.
- Impact: real upload fails; FileVersion creation is invalid.
- Direction: create Attempt and staging lifecycle first; own staging under Attempt; create canonical FINALIZE operation; create FileVersion with full chain; update Intent to COMPLETED only at finalization.
- Design needed: Yes.
- Independent security review: Required.
- Acceptance: all P1-3 chain/deferred/trigger/COMMIT-unknown tests pass against an isolated clone; no direct final-state fixture shortcuts.

### P13-R-02 — Complete runtime roles and file-system authority

- Priority: P1, not a Demo blocker only because Demo uses no real files.
- Evidence: implementation status records independent runtime roles, PUBLIC EXECUTE minimization, native identity and cleanup proof as unimplemented/unverified.
- Impact: production file deletion or identity claims are unsupported.
- Direction: follow the approved runtime/authority design and separate Web/Worker/Maintenance/Recovery capabilities.
- Design needed: Completed only in part; additional approval required.
- Independent security review: Required.
- Acceptance: ACL/public execute/minter role tests, OS identity and fail-closed filesystem tests pass.

### P13-R-03 — Quarantine/purge/recovery and audit truncate guard

- Priority: P2 until destructive runtime is authorized.
- Evidence: design/report statuses identify blocked special protocols and missing AuditLog TRUNCATE guard.
- Impact: cleanup cannot be safely enabled.
- Direction: complete operation-based cleanup and audit guard; remain disabled until evidence is complete.
- Design needed: Yes.
- Independent security review: Required.
- Acceptance: no destructive operation without persisted Operation, close proof, unique active operation, durable evidence and recovery behavior.

## Sequencing

```text
1. Fix P1 product correctness in a design-approved branch.
2. Add negative and multi-conversation tests.
3. Restore clean repository-wide typecheck and test signal.
4. Complete browser verification.
5. Re-run full MVP E2E and obtain independent re-review.
6. Only then reconsider Demo approval.
7. Handle P1-3 upload/lifecycle integration as a separate security workstream.
```

