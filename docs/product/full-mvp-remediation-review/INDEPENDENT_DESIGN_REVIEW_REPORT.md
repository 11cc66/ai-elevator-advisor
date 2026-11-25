# FULL-MVP-REMEDIATION-REVIEW-001 Independent Design Review

Date: 2026-11-23

Project root: `D:\thinkbook\Desktop\jieya`

Review mode: independent, read-only, adversarial design review.

Overall result:

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

The design materially improves the original remediation plan, but unresolved P1 defects remain in requirement semantics, database scenario enforcement, source-of-truth consistency, run-state semantics, catalog review binding, and sales snapshot integrity. The design cannot receive future staged implementation authorization until these are corrected and re-reviewed.

## 1. Input Integrity

All required input documents were read.

`docs/product/full-mvp-build/SHA256SUMS.txt`:

```text
All five entries: MATCH
Manifest SHA-256:
4C48F50E387596D9464BF6EE0C2C1EAAD91E808C7C1C2D57302EE86143471077
```

`docs/product/full-mvp-review/SHA256SUMS.txt`:

```text
All three entries: MATCH
Manifest SHA-256:
CBC6240FA37E2533D8B185104B738DF1064F5FBD632814A0C33757FBCC7D1AC9
```

`docs/product/full-mvp-remediation-design/SHA256SUMS.txt`:

```text
All five entries: length, line count and SHA-256 MATCH
Manifest SHA-256:
AB146C592DE41479994C88FABD811610D9ADFF90F46267F844F74409F3E70485
```

Input references:

| File | SHA-256 |
|---|---|
| `P1_PRODUCT_REMEDIATION_DESIGN.md` | `258FC87A5E907E29746E55B76663817FBC895DA83C1DFF252E7AB05FCD28660A` |
| `P1_PRODUCT_REMEDIATION_TRACEABILITY.md` | `4F4CBB107F9DDE7D0283B8E4F53EAA5B5A89571CEEB83129DA41F9F1EC07E56B` |
| `P1_PRODUCT_REMEDIATION_TEST_PLAN.md` | `28A7B070A9905387A2D70988EDF59C0E7E57905947F41073C1438D08C2DC6E58` |
| `P1_PRODUCT_REMEDIATION_OPEN_DECISIONS.md` | `D2103A6E006DC9F55D3D99918E63C4EFB8987009C842642145685C50C231EEA2` |
| `P1_PRODUCT_REMEDIATION_BASELINE_SNAPSHOT.md` | `15688AF84E156B8EFCB76E4FB719C4755AE86A5299F8C43FB8278807644EC1C9` |

## 2. Shell and Worktree

Verified PowerShell:

```text
Path: C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe
Parent PID: 30360
Child PID: 6184
Child Parent PID: 30360
External FileVersion: 7.6.9.500
Internal PSVersion: 7.6.9
PSEdition: Core
Exit code: 0
```

Initial snapshot:

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 41
Untracked entries: 71
Staged: 0
Deleted: 0
```

The complete lists match `P1_PRODUCT_REMEDIATION_BASELINE_SNAPSHOT.md`.

This review did not:

- connect to a database;
- run tests, migrations, seed, reset or SQL;
- access Storage or real files;
- modify design, source, tests or configuration;
- execute Git writes;
- touch `$null`;
- run Native RPC or builds.

## 3. Original Finding Coverage

| Original remediation item | Coverage | Review result |
|---|---|---|
| `MVP-R-01` negative external semantics | Design A1 | **PARTIAL** — conditionals, double negation variants and temporal correction examples are absent |
| `MVP-R-02` conversation/scenario isolation | Design A2–A5 | **PARTIAL** — conversation isolation is designed, but scenario consistency lacks database enforcement |
| `MVP-R-03` catalog trust/effective dates | Design B | **PARTIAL** — review-target version binding and source immutability remain underspecified |
| `MVP-R-04` missing critical parameter fail-closed | Design C | **PARTIAL** — run-level status conflates review pending with missing data |
| `MVP-R-05` unapproved floor thresholds | Design C2 | **ADDRESSED IN DESIGN** — numeric authority remains open and formal Operational is disabled |
| `MVP-R-06` same-origin mutation guard | Design E1 | **PARTIAL** — no complete route inventory/content-type strategy |
| `MVP-R-07` sales snapshot and SQL filtering | Design D2/E2 | **PARTIAL** — snapshot IDs/digests are not demonstrably self-contained |
| `MVP-R-08` CAS and trusted provenance | Design A5/A7/D1 | **PARTIAL** — fields JSON vs requirement field rows has no canonical rule |
| `MVP-R-09` database relationships/validity | Design D3/B5 | **PARTIAL** — scenario link, exact unique keys and snapshot item normalization missing |
| `MVP-R-10` Demo guard | Design B6/OD-10 | **PARTIAL** — safe direction exists but the exact startup gate is still an open implementation decision |
| `MVP-R-11` test infrastructure | Design Stage 5 | **PARTIAL** — no root cause or concrete fix for authority-core Vitest resolution |
| `MVP-R-12` browser/visual | Design Stage 5 | **ADDRESSED IN TEST PLAN** — execution remains separately unauthorized |
| `P13-R-01/02/03` | Exclusion section | **CORRECTLY EXCLUDED** from product remediation |
| Original finding: requirement revision UI showed only latest version | Not present in traceability | **UNADDRESSED** |

Detailed findings are in `INDEPENDENT_REVIEW_FINDINGS.md`.

## 4. Requirement Semantics

The design correctly introduces explicit outcomes, source spans and conflict state:

- `EXTRACTED_EXPLICIT`
- `NEEDS_CONFIRMATION`
- `CONFLICT`
- `ABSENT`

It also correctly prevents `NEEDS_CONFIRMATION`/`CONFLICT` from writing a boolean.

The test plan does not cover all user-mandated adversarial expressions:

```text
外装允许，但不能从临街侧施工。
不是不允许外装，只是需要再确认。
如果物业不反对，可以考虑外装。
不排除外装，但不能确定。
外装不行，除非没有其他方案。
我说的是不允许外装，不是允许。
```

None of these exact phrases appears in the design or test plan. The design mentions uncertain-word detection generally, but does not define conditional-intent semantics. Conditional statements can therefore be implemented as explicit facts. This is a P1 design gap.

## 5. Conversation and Scenario Isolation

The target conversation pointer and explicit project head are architecture improvements. The design correctly forbids project-latest lookup for conversation reads.

The database design does not carry `installationScenario` through the composite foreign key chain:

```text
Requirement(conversationId, projectId) -> Conversation(id, projectId)
```

A row can satisfy this FK while `Requirement.installationScenario` differs from both Conversation and Project.

Required missing invariant:

```text
Conversation(id, projectId, installationScenario)
Requirement(id, projectId, conversationId, installationScenario)
Project(id, projectType)
```

with composite FKs enforcing scenario equality. Current test plan has project-level API tests but no direct SQL/DB-constraint test for this mismatch.

## 6. Requirement Source of Truth

The design adds `RequirementFieldValue` but keeps `BuildingRequirement.fields` and `missingFields` JSON. It does not state which representation is authoritative or how they remain equal.

Current implementation reads selection inputs from `requirement.fields`, while extraction provenance is stored in field rows:

```text
apps/web/src/modules/selection/service.ts:37-43
prisma/schema.prisma:904-912
```

The design does not add a database constraint or trigger for JSON/field-row equivalence, and the test plan does not assert it. A request can leave JSON `externalInstallationAllowed=true` while `RequirementFieldValue` says false. This is a P1 design defect.

## 7. Catalog Trust

The design correctly separates lifecycle, source, review, product revision and effective validity.

It remains insufficiently concrete in two critical areas:

1. `CatalogReview.subjectType/subjectId/subjectVersion` is polymorphic. No exact typed FK or CHECK-based binding is defined.
2. `CatalogSource.contentDigest` is optional and CatalogSource mutation/versioning after review is not prohibited.

Counterexample:

```text
Review says subjectVersion=2, but implementation resolves version=3.
Source content changes after review; review remains APPROVED.
```

Evidence is attached to sources, but not guaranteed to the exact immutable source content and exact product/specification/price row reviewed.

## 8. Selection State Machine

The candidate states are mostly appropriate, but the run-level state machine is wrong:

```text
else if any INSUFFICIENT_DATA/REQUIRES_PROFESSIONAL_REVIEW -> INSUFFICIENT_DATA
```

This collapses two distinct liabilities:

- missing input/data;
- pending engineering or rule authority.

A candidate that is complete but awaits rule authority becomes run status `INSUFFICIENT_DATA`. The API and UI cannot route the workflow correctly. `REQUIRES_PROFESSIONAL_REVIEW` must be a distinct run outcome and must not be represented as missing data.

The design also lacks a candidate field for the `priceStatus=REQUIRES_QUOTE` stated in the prose. A technically complete candidate may remain `OPERATIONAL` while price is invalid; the single-status API does not clearly distinguish technical eligibility from commercial readiness.

## 9. Sales Snapshot

The separation into case/snapshot is directionally correct, but the proposed snapshot is not yet a verifiable immutable evidence object:

- `productSpecificationIds[]` and `priceIds[]` are arrays rather than FK-bearing snapshot rows;
- no normalized join table for exact selected specification/price records is specified;
- digests are named but no canonicalization algorithm or payload field set is defined;
- no explicit rule states that all referenced requirement/selection/catalog evidence is copied into an immutable payload;
- no test checks history after source/specification withdrawal.

The snapshot must remain explainable even if catalog review/source state later expires or is withdrawn.

## 10. Database and Concurrency

The design recognizes the right constraints and uses row locks/CAS. Remaining issues:

- `ProjectRequirementHead` references `(Project.projectId, Requirement.id)`, but no unique key `(projectId,id)` is proposed; only `(id,projectId,conversationId)` is proposed.
- `SalesHandoffCase.assignedToId` has no user foreign key or relationship.
- `CatalogReview` polymorphic subject cannot be protected by a normal FK.
- `SalesHandoffSnapshot` arrays cannot be FK-protected.
- Effective-time boundary/as-of/time-zone semantics are not defined.

The design correctly says runtime verification is required, but these static model omissions prevent a clean migration design.

## 11. Test Plan Effectiveness

The test plan is substantially better than the original delivery test plan. It includes negative and fail-closed cases.

It still has gaps:

- all mandated conditional/double-negation examples are absent;
- no test asserts requirement JSON equals server-owned field rows;
- no DB test asserts scenario equality through project/conversation/requirement;
- no test distinguishes run `REQUIRES_PROFESSIONAL_REVIEW` from `INSUFFICIENT_DATA`;
- no test binds a review to an exact version/source digest;
- no test checks old recommendation/snapshot after source withdrawal;
- no test covers lost response/retry correlation beyond simple duplicate message;
- no complete route inventory prevents omission of a mutation from same-origin protection;
- many tables contain expected results but no explicit failure-condition column.

This does not mean the design is untestable; it means the test plan is not sufficient to prove the stated invariants.

## 12. Open Decisions Assessment

The open decisions are largely genuine and correctly block formal/operational behavior:

- OD-01, OD-02, OD-03, OD-04, OD-05, OD-06, OD-07, OD-08, OD-09, OD-10, OD-11, OD-12 and OD-13 all require external authority or an explicit product decision.

Several decisions are correctly conservative:

- no approved engineering rules -> no Operational result;
- no effective approved price -> requote;
- Demo cannot be client-selected;
- legacy ambiguities fail closed.

However, the design sometimes states a safe behavior as if decided while listing the same issue as open. Project Type immutability, reviewer separation and current-requirement policy must be labeled as implementation defaults, not approved business facts.

## 13. Final Assessment

The design is not implementation-ready. It should be revised, then independently re-reviewed.

```text
P0: NONE IDENTIFIED
P1: 7
P2: 10
P3: 1
Overall: FAIL — DESIGN CORRECTIONS REQUIRED
```

The most important corrections are:

1. define conditional/double-negation grammar and tests;
2. enforce project/conversation/requirement scenario equality;
3. resolve fields JSON vs field-value canonical ownership;
4. preserve `REQUIRES_PROFESSIONAL_REVIEW` as a run outcome;
5. bind reviews to exact immutable catalog versions/source digests;
6. make sales snapshots normalized/self-contained;
7. separate technical eligibility from price/commercial readiness.

