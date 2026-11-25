# FULL-MVP-REMEDIATION-REVIEW-R2 Independent Design Review

Date: 2026-11-23

Project root: `D:\thinkbook\Desktop\jieya`

Review mode: independent, read-only, adversarial design review.

Review target: `FULL-MVP-REMEDIATION-DESIGN-R2`.

Overall result:

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

R2 materially improves the first correction attempt. The semantic model,
scenario composite keys, normalized requirement authority, technical/commercial
status separation and several P2 proposals are directionally sound. The design
is still not approved because five P1 invariants remain non-executable or
incomplete:

1. requirement provenance can cross requirement/conversation boundaries;
2. catalog source digests are not backed by immutable content evidence;
3. sales handoff ownership and selection basis are not an exact composite
   chain;
4. professional review is not backed by a durable state/event model;
5. canonical snapshot payload and normalized snapshot items can disagree.

No source implementation, Schema change, Migration, database test, Storage
operation, Build, Native RPC or Runtime execution was performed.

## 1. Input Integrity

All required R2 delivery files were read and independently rehashed.

| File | Bytes | Lines | SHA-256 | Result |
|---|---:|---:|---|---|
| `P1_PRODUCT_REMEDIATION_DESIGN_R2.md` | 35476 | 1286 | `717CB6C238C147388B66D0877F8B9941F0AAE1C1023BFD01724DA48B71B5463B` | MATCH |
| `P1_PRODUCT_REMEDIATION_TRACEABILITY_R2.md` | 8208 | 98 | `A5E806FB4133E9082D348BAA356B567A42E825A844C1F5CDB2D40C392444ACF5` | MATCH |
| `P1_PRODUCT_REMEDIATION_TEST_PLAN_R2.md` | 33153 | 284 | `06BC471C2C80C7AB59F962976A38DCF5908D2D2B0D2240447C7532575A0BFE92` | MATCH |
| `P1_PRODUCT_REMEDIATION_OPEN_DECISIONS_R2.md` | 12933 | 437 | `AD0E8D038D6608877503AF79202D127406BD08739B3620EED4BAD223E2A90B79` | MATCH |
| `P1_PRODUCT_REMEDIATION_R2_CHANGELOG.md` | 5501 | 200 | `5BF8AB3FB5F7864E0855ED6C47D320247593884D83CA8A0B7BA30CF9035A3FFC` | MATCH |
| `SHA256SUMS_R2.txt` | 793 | 5 | `F031F01440572B16DFBC2770AA435EBBE5AC46CA1ED2EE1991D81AA671BF9B06` | MATCH |

All five entries inside `SHA256SUMS_R2.txt` independently matched their
recorded byte length, line count and SHA-256.

The following prior manifests were also rechecked:

| Manifest | SHA-256 | Result |
|---|---|---|
| R1 remediation design | `AB146C592DE41479994C88FABD811610D9ADFF90F46267F844F74409F3E70485` | all five entries MATCH |
| First independent review | `EA593A3CADD38BC4B1E2C08E874E32A60E4C34550D20B41C79DA80D585D8C458` | all three entries MATCH |
| MVP build baseline | `4C48F50E387596D9464BF6EE0C2C1EAAD91E808C7C1C2D57302EE86143471077` | all five entries MATCH |
| MVP product review | `CBC6240FA37E2533D8B185104B738DF1064F5FBD632814A0C33757FBCC7D1AC9` | all three entries MATCH |

R1 design, the first independent review, product evidence and MVP acceptance
documents were read in full for this review. Current source, Prisma Schema,
MVP migration, relevant tests and P1-3 status/boundary documents were inspected
where needed to distinguish proposed design from current implementation.

## 2. Shell and Worktree

Verified actual PowerShell process:

```text
ExecutablePath:
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe

PID: 21852
Parent PID: 27624
Parent executable: C:\Program Files\WindowsApps\OpenAI.Codex_26.1117.4957.0_x64__2p2nqsd0c76g0\app\resources\codex.exe
FileVersion: 7.6.9.500
PSEdition: Core
Internal PSVersion: 7.6.9
```

The review commands used this verified PowerShell process directly. CMD/Bash
wrappers and output redirection were not used. Any command submitted with an
incorrect wrapper label failed harmlessly and was rerun through verified
PowerShell; no repository file operation occurred in those failed attempts.

Initial Git snapshot:

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 41
Untracked entries: 71
Staged: 0
Deleted: 0
```

The complete status list matched
`P1_PRODUCT_REMEDIATION_BASELINE_SNAPSHOT.md`. The only new review files are
inside the already-existing `?? docs/product/` aggregate entry.

## 3. Scope and Restrictions

Reviewed:

- all R2 design deliverables and their embedded claims;
- all 7 P1, 10 P2 and 1 P3 findings from the first independent review;
- R1 design, remediation plan, build status and product/engineering documents;
- current advisor, requirement, catalog, selection and sales implementation;
- current Prisma Schema and MVP migration;
- relevant P1-3 design/status boundaries.

Not performed:

- source, Schema, Migration, config or test modification;
- database connection, SQL, migration, seed or reset;
- test, E2E, browser, build or Runtime execution;
- Storage or real-file access;
- Git index/write operation;
- ACL, Owner, Service, Registry, PFR or `$null` operation.

No test result is claimed. Test-plan effectiveness is evaluated statically.

## 4. Original R1 Finding Review

Status meanings:

- `DESIGN_APPROVED`: the design correction is adequate for future implementation
  authorization assessment, subject to separate authorization.
- `DESIGN_APPROVED_WITH_DEPENDENCY`: the invariant is adequately designed, but
  an identified product, engineering, security or environment decision remains.
- `DESIGN_CORRECTION_REQUIRED`: a safety-critical design invariant is still
  incomplete or non-executable.

### 4.1 Seven P1 findings

| Finding | Independent result | Reason |
|---|---|---|
| `REV-P1-01` conditional/double-negation semantics | `DESIGN_APPROVED` | R2 defines a structured assertion grammar, precedence, six required outcomes and negative tests. No conditional/uncertain phrase is allowed to become a decision fact without explicit confirmation. |
| `REV-P1-02` scenario equality | `DESIGN_APPROVED_WITH_DEPENDENCY` | The main Project/Conversation/Requirement composite chain is correct. `OD-R2-06` still decides later scenario-change policy; `REV-R2-P2-01` requires exact update/nullability DB mechanics. |
| `REV-P1-03` requirement fact/source of truth | `DESIGN_CORRECTION_REQUIRED` | JSON projection is correctly demoted, but field-to-assertion/message ownership is not exact. `REV-R2-P1-01` can cross provenance chains. |
| `REV-P1-04` run review-versus-data state | `DESIGN_APPROVED_WITH_DEPENDENCY` | Run and count outcomes now distinguish insufficient data, professional review and quote. `OD-R2-01/13` still blocks approved rule authority. |
| `REV-P1-05` catalog exact review/source binding | `DESIGN_CORRECTION_REQUIRED` | Typed review target FKs are a major improvement, but a digest plus mutable locator does not establish immutable source evidence. See `REV-R2-P1-02`. |
| `REV-P1-06` self-contained sales snapshot | `DESIGN_CORRECTION_REQUIRED` | Normalization and self-contained payload direction are correct, but exact ownership/basis binding and payload/item consistency remain incomplete. See `REV-R2-P1-03` and `REV-R2-P1-05`. |
| `REV-P1-07` technical/commercial/overall separation | `DESIGN_APPROVED_WITH_DEPENDENCY` | Dimensions and `REQUIRES_QUOTE` are correctly separated. `OD-R2-05` still blocks price semantics and applicable commercial ranges. |

### 4.2 Ten P2 findings

| Finding | Independent result | Reason |
|---|---|---|
| `REV-P2-01` ProjectRequirementHead unique key | `DESIGN_APPROVED` | `UNIQUE(projectId,id)` is now explicit and usable by the head FK. |
| `REV-P2-02` route inventory/content type | `DESIGN_APPROVED_WITH_DEPENDENCY` | Executable route inventory and guarded map are defined. Framework exemptions still require security approval. |
| `REV-P2-03` handoff assignee | `DESIGN_APPROVED_WITH_DEPENDENCY` | User FK and project-scope checks are specified. `OD-R2-17` still decides assignment semantics. |
| `REV-P2-04` requirement history | `DESIGN_APPROVED_WITH_DEPENDENCY` | Read model, API/UI and browser tests are included. `OD-R2-08` controls conversation sharing visibility. |
| `REV-P2-05` effective-time semantics | `DESIGN_APPROVED_WITH_DEPENDENCY` | Single transaction `asOf`, UTC and `[from,to)` are explicit. `OD-R2-11` controls ambiguity policy. |
| `REV-P2-06` response-correlated idempotency | `DESIGN_CORRECTION_REQUIRED` | A transaction record exists, but exact ownership FKs and committed `FAILED` semantics are missing. See `REV-R2-P2-03`. |
| `REV-P2-07` initial conversation atomicity | `DESIGN_APPROVED` | Conversation, requirement, pointer and greeting share one transaction and have failure tests. |
| `REV-P2-08` stale historical recommendation overlay | `DESIGN_APPROVED_WITH_DEPENDENCY` | Historical result stays immutable and a current-basis overlay is designed. `OD-R2-19` controls preliminary visibility. |
| `REV-P2-09` test completeness | `DESIGN_CORRECTION_REQUIRED` | Failure columns exist, but several direct DB ownership checks and concurrency race tests remain absent. See `REV-R2-P2-05`. |
| `REV-P2-10` root test infrastructure | `DESIGN_APPROVED_WITH_DEPENDENCY` | Frozen install, package binary preflight, root test and serial worker execution are concrete. Environment setup remains separately authorized. |

### 4.3 P3 finding

| Finding | Independent result | Reason |
|---|---|---|
| `REV-P3-01` overclaimed self-check | `DESIGN_APPROVED` | R2 uses a qualified completion status and no longer claims implementation closure. |

## 5. Semantic Model Review

The six mandatory expressions are represented safely and are not reduced to a
boolean:

| Expression | R2 result | Independent assessment |
|---|---|---|
| `外装允许，但不能从临街侧施工。` | `CONDITIONAL`, no unconditional value | PASS |
| `不是不允许外装，只是需要再确认。` | `UNCERTAIN`, no value | PASS |
| `原来可以外装，现在明确不允许了。` | current correction with history | PASS |
| `如果物业不反对，可以考虑外装。` | unresolved condition | PASS |
| `不排除外装，但不能确定。` | uncertainty | PASS |
| `外装不行，除非没有其他方案。` | exception | PASS |

The test matrix also covers unrelated-clause negation, conflict, parser
version/source spans, clarification, temporal correction and prevention of
formal selection from unresolved semantics.

Remaining provenance concern is structural, not semantic: the source assertion
and message identifiers are not bound tightly enough to the owning requirement
and conversation. See `REV-R2-P1-01`.

## 6. Scenario Consistency Review

The Project, Conversation and Requirement chain is materially corrected:

```text
Project(id, installationScenario)
  -> AdvisorConversation(id, projectId, installationScenario)
  -> BuildingRequirement(id, projectId, conversationId, installationScenario)
  -> currentRequirement pointer
```

The referenced keys and cross-project tests are present. A new requirement
cannot be cross-bound to another project or scenario through the normal
composite relation.

Two residual issues remain:

- project-scenario update/nullability/legacy mapping mechanics require a
  concrete DB rule (`REV-R2-P2-01`);
- the sales handoff chain later recombines project, requirement and selection
  run without a full exact composite key (`REV-R2-P1-03`).

## 7. Requirement Source-of-Truth Review

R2 makes the correct architectural choice:

```text
RequirementFieldAssertion + RequirementFieldValue
  = authoritative current fact/source

BuildingRequirement.fields
  = compatibility projection only
```

Selection, audit and compatibility API are all directed to normalized values.
This resolves the original two-writable-JSON/rows defect in principle.

It does not fully close source provenance because the value's source assertion
and the assertion's source message are not constrained to the same requirement,
conversation and project chain. A direct SQL/import path can create a value in
one requirement sourced from another requirement. This is `REV-R2-P1-01`.

## 8. Catalog Review

The replacement of polymorphic `subjectType/subjectId/subjectVersion` with
typed target FKs and a CHECK for exactly one target is correct. Append-only
source withdrawal, exact review evidence rows, effective intervals and
re-review on revision changes are all appropriate.

The remaining trust gap is evidence identity. A database digest without
immutable reviewable content only proves a hash string was stored. It does not
prove external locator content stayed unchanged or can later be audited. R2's
own `OD-R2-04` acknowledges the unresolved content-retention question, but the
design currently appears to allow digest-only evidence while still describing
the source revision as immutable. Formal review must remain blocked until a
verifiable evidence identity is defined.

## 9. Selection and Professional Review

The independent dimensions are correctly separated:

- technical;
- commercial;
- trust;
- professional review;
- overall status.

`OPERATIONAL` requires approved rules, approved exact revisions, complete
parameters, valid professional review and valid applicable price. Expired or
missing price no longer implies Operational success.

However, the professional-review implementation is not yet a state machine. It
is an enum followed by a list of labels. No exact review/event schema, FK chain,
active-approval uniqueness, invalidation event or decision-time basis recheck
is specified. Since `OPERATIONAL` depends on it, this remains P1.

The rule-set model is also only described in prose. Candidate rows carry a
string version rather than an exact immutable rule-set ID/digest. That is a
separate P2 because it weakens reproducibility but does not alone bypass the
professional-review gate.

## 10. Sales Snapshot Review

R2 correctly moves from arrays to normalized items and adds a canonical payload,
source items, exact product/specification/price FKs and immutability rules.

Three structural guarantees are still missing:

1. snapshot/case/project/requirement/selection-run ownership is not one exact
   FK chain;
2. selected run may be based on a different requirement in the same project;
3. canonical payload and normalized items have no single authority or shared
   basis digest.

These are independent failure paths and are recorded as
`REV-R2-P1-03` and `REV-R2-P1-05`. A sales snapshot cannot be approved for
implementation while valid database rows can describe contradictory handoff
facts.

## 11. Open Decisions Assessment

All `OD-R2-01` through `OD-R2-20` were reviewed. They are genuine decisions,
but they do not excuse missing technical invariants.

| Decision | Blocking assessment |
|---|---|
| `OD-R2-01` engineering rules | Blocks formal rule data and `OPERATIONAL`; parser work can proceed. |
| `OD-R2-02` professional data/review authority | Blocks professional workflow and Operational; cannot define who may approve. |
| `OD-R2-03` VERIFIED approval roles | Blocks catalog approval; exact review FKs can still be designed. |
| `OD-R2-04` source content/retention | Blocks catalog source and formal review; the missing content identity is also `REV-R2-P1-02`. |
| `OD-R2-05` price semantics | Blocks commercial status, budget logic and quote policy. |
| `OD-R2-06` project type changes | Blocks final update API; safe immutable default can be designed. |
| `OD-R2-07` project current requirement | Blocks head UI/default workflows; explicit requirement ID can remain. |
| `OD-R2-08` conversation/sales visibility | Blocks API exposure and raw-history access. |
| `OD-R2-09` snapshot retention/visibility | Blocks deletion/export policy; append-only default is safe. |
| `OD-R2-10` Demo identity | Blocks Demo startup and realistic demo data. |
| `OD-R2-11` effective-version ambiguity | Blocks automatic resolver policy; fail-closed is the only current safe default. |
| `OD-R2-12` legacy data disposition | Blocks migration/backfill of ambiguous historical rows. |
| `OD-R2-13` rule approval separation | Blocks approved rule sets and Operational. |
| `OD-R2-14` snapshot canonicalization | Blocks snapshot format/implementation. Payload/items consistency under `REV-R2-P1-05` is still a technical design requirement. |
| `OD-R2-15` historical JSON mismatch | Blocks requirement backfill. |
| `OD-R2-16` professional workflow | Blocks reviewer roles/evidence. The persistent state/event/basis design remains required under `REV-R2-P1-04`. |
| `OD-R2-17` sales assignment scope | Blocks sales UI/list/assignment implementation. |
| `OD-R2-18` source review cadence | Blocks source approval and trust expiry. |
| `OD-R2-19` preliminary visibility | Blocks customer/sales presentation of preliminary results. |
| `OD-R2-20` formal rollout | Blocks production `OPERATIONAL`; this is the final rollout gate. |

No reviewed Open Decision was used to infer a business threshold or reviewer
qualification. Some technical gaps are correctly separated from product
decisions and must not be reclassified as Open Decisions.

## 12. Test-Plan Effectiveness

Strengths:

- each row has a test ID, invariant, preconditions, operation, concurrency
  condition, expected API result, expected DB state, failure assertion and
  finding;
- the six semantic examples have dedicated tests;
- CAS, initial conversation atomicity, exact revision targets, effective
  boundaries, DEMO isolation and mutation route inventory are planned;
- the plan explicitly prohibits treating HTTP success as proof.

Critical gaps:

- no direct DB test for same-project wrong requirement/run handoff;
- no case/snapshot cross-project test;
- no canonical payload versus normalized item mismatch test;
- no cross-requirement assertion/value provenance test;
- no source locator tamper/unavailable evidence test;
- no complete review transition matrix test;
- no concurrent review-versus-specification/source/rule update test;
- no snapshot-versus-withdrawal or price-expiry-versus-run race test;
- no exact rule-set reference test on each candidate.

The plan therefore has a real negative-test structure but cannot yet prove all
newly identified invariants. This is `REV-R2-P2-05`.

## 13. P1-3 Isolation

R2 correctly keeps P1-3 separate:

- upload and lifecycle objects are not redesigned;
- `FileVersion` chain changes are excluded;
- Native RPC and production deployment are excluded;
- the P1-3 test matrix is explicitly separate;
- `MIG-08` checks that product migration does not alter P1-3 tables.

No P1-3 boundary violation was found in R2. The `file upload streaming uses
same-origin` statement is a browser mutation policy across the boundary, not a
change to the P1-3 lifecycle state machine. It still requires separate security
review when implemented.

## 14. New Findings

| ID | Severity | Summary |
|---|---|---|
| `REV-R2-P1-01` | P1 | Requirement provenance can cross requirement/conversation ownership. |
| `REV-R2-P1-02` | P1 | Catalog source digest is not backed by immutable auditable content. |
| `REV-R2-P1-03` | P1 | Sales handoff case/project/requirement/version/run chain is not exact. |
| `REV-R2-P1-04` | P1 | Professional review is not a durable, enforced state/event model. |
| `REV-R2-P1-05` | P1 | Canonical snapshot payload and normalized items can disagree. |
| `REV-R2-P2-01` | P2 | Project scenario update/nullability/legacy mapping DB behavior is incomplete. |
| `REV-R2-P2-02` | P2 | Persisted candidate results do not exact-bind the immutable rule-set digest. |
| `REV-R2-P2-03` | P2 | Advisor idempotency record lacks exact FKs and clear `FAILED` semantics. |
| `REV-R2-P2-04` | P2 | Review input digest lacks stored policy-version identity. |
| `REV-R2-P2-05` | P2 | Test matrix lacks several ownership, payload and concurrency checks. |
| `REV-R2-P3-01` | P3 | R2 traceability claims no new unresolved issue. |

## 15. Final Assessment

```text
P0: 0
P1: 5
P2: 5
P3: 1
Overall: FAIL — DESIGN CORRECTIONS REQUIRED
```

R2 is not ready for future implementation authorization. The next step must be
a separately authorized, design-only correction round targeted at the five P1
findings and the P2 invariants above. Independent re-review follows.

This result does not authorize code, Schema, Migration, database, test, Storage,
Native RPC, build, Runtime or deployment work.
