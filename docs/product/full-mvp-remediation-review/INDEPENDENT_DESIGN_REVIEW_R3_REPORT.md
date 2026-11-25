# FULL-MVP-REMEDIATION-REVIEW-R3 Independent Design Review

Date: 2026-11-24

Project root: `D:\thinkbook\Desktop\jieya`

Review mode: independent, read-only, adversarial design review.

Review target:

```text
FULL-MVP-REMEDIATION-DESIGN-R3
```

Overall result:

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

R3 improves the R2 design substantially, especially the ownership diagrams,
source-evidence concept, event tables, exact revision references and adversarial
test vocabulary. It is not yet an executable design because:

- the RequirementVersion key required by its own Assertion/Value FKs is not
  declared;
- the authoritative Assertion/Value tables omit the semantic value and status
  fields accepted in R2;
- RuleSet and ProfessionalReview current status can diverge from their event
  history;
- `R3-BASIS-1` leaves scalar encoding undefined;
- snapshot field provenance can point to a different valid assertion than the
  authoritative FieldValue.

No source, Schema, Migration, database, Storage, Build, Native RPC or Runtime
operation was performed.

## 1. Input Integrity

### 1.1 R3 delivery

All five R3 documents and the R3 manifest were read and independently rehashed:

| File | Bytes | Lines | SHA-256 | Result |
|---|---:|---:|---|---|
| `P1_PRODUCT_REMEDIATION_DESIGN_R3.md` | 49018 | 1441 | `53138CEB7AC7A6A65321F15CF909A3EE3549D959E4109FBBA850592CDA927499` | MATCH |
| `P1_PRODUCT_REMEDIATION_TRACEABILITY_R3.md` | 10708 | 157 | `7C18E10978D80934907229BFD34104CE8F5831FA7A4BF367EA095B5FB059BED3` | MATCH |
| `P1_PRODUCT_REMEDIATION_TEST_PLAN_R3.md` | 25791 | 220 | `D4ADF577519074A5E3536E281329CB7C3B6F5F208DB9476633B838F0F58C9EA5` | MATCH |
| `P1_PRODUCT_REMEDIATION_OPEN_DECISIONS_R3.md` | 10959 | 219 | `1AA4F88CEAF1435750D65A3290A2ADF80B30B14EC5C0BD40E88691C83B5F60C1` | MATCH |
| `P1_PRODUCT_REMEDIATION_R3_CHANGELOG.md` | 7271 | 219 | `1B28B588B48E3E4B406F88F04A63A93A6B2EA4C2F5ED79DC2A5A23FE4EAE5030` | MATCH |
| `SHA256SUMS_R3.txt` | 795 | 5 | `25654CBCEF6BD40E4D23411930A94813D4CBA52C3CB1F15CCF343B3759D56E26` | MATCH |

All five manifest entries matched their recorded length, line count and hash.

### 1.2 Prior inputs

The following manifests were rechecked:

| Manifest | SHA-256 | Result |
|---|---|---|
| R2 design | `F031F01440572B16DFBC2770AA435EBBE5AC46CA1ED2EE1991D81AA671BF9B06` | all entries MATCH |
| R2 review | `BA9B433C4D14D9999D192B088C330996015069D7939C455FADD2B660D1BC3C80` | all three entries MATCH |
| R1 design | `AB146C592DE41479994C88FABD811610D9ADFF90F46267F844F74409F3E70485` | all entries MATCH |
| R1 independent review | `EA593A3CADD38BC4B1E2C08E874E32A60E4C34550D20B41C79DA80D585D8C458` | all entries MATCH |
| MVP build | `4C48F50E387596D9464BF6EE0C2C1EAAD91E808C7C1C2D57302EE86143471077` | all entries MATCH |
| MVP product review | `CBC6240FA37E2533D8B185104B738DF1064F5FBD632814A0C33757FBCC7D1AC9` | all entries MATCH |

R1, R2, prior independent reports, MVP review/build reports and current source
implementation were read as context. The design's current-vs-proposed
distinction is accurate for the major JSON requirement, source, selection and
sales tables.

## 2. Shell and Worktree

Verified PowerShell:

```text
ExecutablePath:
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe

PID: 4044
Parent PID: 27624
Parent executable: C:\Program Files\WindowsApps\OpenAI.Codex_26.1117.4957.0_x64__2p2nqsd0c76g0\app\resources\codex.exe
FileVersion: 7.6.9.500
PSEdition: Core
Internal PSVersion: 7.6.9
```

The review commands used verified PowerShell. CMD/Bash wrappers and output
redirection were not used. A few incorrectly labelled wrapper attempts failed
without changing files and were rerun through PowerShell.

Initial snapshot:

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 41
Untracked entries: 71
Staged: 0
Deleted: 0
```

The complete status list matches the existing R2/R3 worktree baseline. R3
documents are inside the pre-existing `?? docs/product/` aggregate entry.

## 3. Scope and Restrictions

Reviewed:

- all R3 design, traceability, test, decisions and changelog text;
- all R2 P1/P2/P3 findings and Open Decisions;
- R1 design and independent review;
- current advisor, requirement, selection, MVP store, contracts and selection
  engine source;
- current Prisma Schema and MVP migration;
- relevant P1-3 implementation-status and design boundary material.

Not performed:

- source, Schema, Migration, config, test or R3 modification;
- database connection, SQL, migration, seed or reset;
- test, E2E, browser, Build, Storage, Native RPC or Runtime execution;
- Git index/write operation;
- ACL, Owner, Service, Registry, PFR or `$null` operation.

Static analysis cannot prove PostgreSQL FK creation, trigger execution,
isolation behavior, deferred constraint behavior, archive immutability or
Runtime state. Those remain `NOT VERIFIED` until separately authorized.

## 4. R2 Findings — Complete Disposition

Statuses:

- `DESIGN_APPROVED`: R3 is sufficient for this finding in design.
- `DESIGN_APPROVED_WITH_DEPENDENCY`: design is sufficient but a named Open
  Decision remains.
- `DESIGN_CORRECTION_REQUIRED`: a core design defect remains.
- `UNADDRESSED`: no credible R3 treatment.

### 4.1 The five P1 findings

| R2 Finding | R3 result | Reason |
|---|---|---|
| `REV-R2-P1-01` requirement provenance | `DESIGN_CORRECTION_REQUIRED` | R3 defines the chain direction, but the Assertion→RequirementVersion FK references a non-declared exact UNIQUE key; Assertion/Value schemas also omit their semantic value/status fields. See `REV-R3-P1-01` and `REV-R3-P1-02`. |
| `REV-R2-P1-02` immutable source content | `DESIGN_APPROVED_WITH_DEPENDENCY` | R3 separates locator, evidence object, digest and verification and gives fail-closed handling. The actual archive product/ACL/retention remains `OD-R3-01/02/09`, and archive behavior is not runtime verified. |
| `REV-R2-P1-03` sales ownership/version chain | `DESIGN_APPROVED_WITH_DEPENDENCY` | Exact case/project/requirement/version/run FKs and deferred completeness are specified. Snapshot field source assertion equality remains a P1 correction (`REV-R3-P1-06`). |
| `REV-R2-P1-04` professional review | `DESIGN_CORRECTION_REQUIRED` | The event and basis model is directionally correct, but the current `ProfessionalReview.state` is not database-proved to equal the event projection. See `REV-R3-P1-04`. |
| `REV-R2-P1-05` snapshot payload/items | `DESIGN_CORRECTION_REQUIRED` | The normalized authority choice is correct, but `R3-BASIS-1` leaves scalar encoding undefined and snapshot field provenance can diverge. See `REV-R3-P1-05/06`. |

### 4.2 The five P2 groups

| Group | Exact R2 Finding | R3 result | Reason |
|---|---|---|---|
| P2-A | `REV-R2-P2-01` | `DESIGN_APPROVED_WITH_DEPENDENCY` | Scenario mapping, freeze, NOT NULL and row-lock strategy are specified. Historical migration remains open and not executable for current rows. |
| P2-B | `REV-R2-P2-02` | `DESIGN_CORRECTION_REQUIRED` | Exact RuleSetRevision binding is improved, but status is not event-derived and no-event approval is possible. See `REV-R3-P1-03`. |
| P2-C | `REV-R2-P2-03` | `DESIGN_APPROVED_WITH_DEPENDENCY` | Conversation/actor/message/version FKs and success/failure/COMMIT-unknown semantics are substantially complete. Failure retention/UI remains `OD-R3-08`. |
| P2-D | `REV-R2-P2-04` | `DESIGN_APPROVED_WITH_DEPENDENCY` | Catalog and professional policy revisions are exact-bound in the design. Policy continuity remains `OD-R3-04`; current event-state enforcement remains a separate P1. |
| P2-E | `REV-R2-P2-05` | `DESIGN_CORRECTION_REQUIRED` | Many negative tests were added, but the test matrix still omits the exact direct writes and codec vectors needed to prove the new P1 issues. |

### 4.3 Older R2 findings and P3

The following R2-approved/preserved directions remain valid:

- conditional/uncertain semantic outcomes and explicit confirmation;
- conversation-scoped current requirement and explicit project head;
- server-derived scenario;
- no approved rule → no formal Operational;
- immutable DEMO classification;
- separate technical/commercial/trust/professional/overall status;
- `REQUIRES_QUOTE` for invalid commercial price;
- SQL-scoped sales access;
- append-only history and stale-basis overlay;
- P1-3 isolation.

`REV-R2-P3-01` is corrected in the R3 trace, but the new trace overclaims
that all R2 P1 designs are addressed. That is `REV-R3-P3-01`.

## 5. Requirement Source Chain

### 5.1 Positive findings

R3 correctly chooses stable `Requirement`, immutable `RequirementVersion`,
owned Assertions and Values, and a composite message/conversation relation.
The direction of ownership and the intent to reject cross-project/cross-
conversation combinations are sound.

### 5.2 Blocking key mismatch

`RequirementVersion` declares these UNIQUE sets:

```text
(requirementId, versionNumber)
(id, projectId, conversationId)
(id, projectId, conversationId, installationScenario)
(id, requirementId, projectId, conversationId, installationScenario)
```

Assertion and FieldValue reference:

```text
(id, requirementId, projectId, conversationId)
```

No parent UNIQUE exactly matches that column set. PostgreSQL does not accept
that foreign key by implication. This is a direct P1, not an application
checklist issue.

### 5.3 Missing authoritative values

R3 describes the source chain but omits the semantic fields and resolved value
fields required by the R2 design. The current selection path still reads JSON
`fields` at `apps/web/src/modules/selection/service.ts:37-43`, while R3's
proposed FieldValue has no canonical value/type/unit/status. The replacement
therefore cannot feed selection without falling back to the legacy JSON.

## 6. CatalogEvidenceArchive

The design correctly rejects `locator + digest` as sufficient evidence. It
introduces a content-addressed archive interface, immutable evidence metadata,
verification events and exact source-review binding. The archive is explicitly
separate from P1-3 and no P1-3 object or trigger is modified.

Limitations:

- the archive product, encryption, retention and physical write-once mechanism
  remain `OD-R3-01/02/09`;
- no actual archive implementation or ACL was executed;
- `CatalogEvidenceArchive` contract tests are only planned;
- database cannot independently prove external bytes if the archive service is
  compromised or unavailable.

These are dependency and runtime limitations, not a reason to call the
direction unsafe. The formal resolver's fail-closed requirement is the correct
boundary.

## 7. Sales Ownership and Snapshot

R3 materially fixes the R2 ownership recombination risk. It defines exact
case/project, requirement version and selection run keys, exact candidate
revision FKs, append-only snapshot rows, a normalized authority and read-only
payload reconstruction.

Two residual defects remain:

1. `R3-BASIS-1` is not a complete, independently implementable encoding.
2. `SalesSnapshotRequirementField` can store a valid assertion different from
   the source assertion of its authoritative FieldValue.

The first blocks digest reproducibility and the second blocks source evidence
accuracy. The snapshot cannot be approved for implementation until both are
corrected.

## 8. Professional Review and RuleSet

The R3 direction is correct:

- exact candidate/run/requirement/product/rule/policy basis;
- append-only events;
- `FOR UPDATE` plus state-version CAS;
- typed source and price basis;
- explicit invalidation, expiry and terminal states;
- no transfer of approval to changed input.

The missing database contracts are material:

- `ProfessionalReview.state` is an independently writable projection with no
  exact last-event trigger or permission proof;
- `ProfessionalReviewEvent.previousState/newState` are not constrained to the
  approved transition table at the database layer;
- `SelectionRuleSetRevision.status` can be set to `APPROVED` with approval
  metadata but no matching `SelectionRuleSetReviewEvent`.

These create a formal-Operational bypass and are P1/P2 findings.

## 9. Test Plan Effectiveness

Strengths:

- broad adversarial test categories;
- direct DB intent for most ownership relations;
- CAS, deferred constraints, COMMIT-unknown and archive failure cases;
- snapshot candidate completeness and payload reconstruction intent;
- P1-3 explicitly excluded.

Defects:

- no exact parent-key creation test for the mismatched
  `RequirementVersion` → Assertion/Value FK;
- no direct test for missing canonical FieldValue fields or actor User FKs;
- no no-event `SelectionRuleSetRevision.APPROVED` test;
- no direct `ProfessionalReview.state` update/current-event divergence test;
- no forbidden transition test;
- no `R3-BASIS-1` fixed vectors for null/empty/Unicode/decimal/duplicate/type
  boundaries;
- no snapshot source assertion mismatch test where two assertions are both
  valid in the same version.

Because these tests are absent, the matrix cannot disprove the P1 findings.

## 10. Open Decisions

All R2 decisions `OD-R2-01` through `OD-R2-20` remain. All R3 decisions
`OD-R3-01` through `OD-R3-09` have owners, options, risks and blocked modules.

The decisions are not being used to hide the identified technical errors:

- the Requirement key mismatch is a schema defect regardless of product policy;
- the missing Assertion/Value fields are a schema/API contract defect;
- RuleSet and ProfessionalReview event projection is a database mechanism;
- `R3-BASIS-1` scalar encoding is a technical specification;
- source assertion equality is an ownership constraint.

The following areas remain blocked by decisions:

- archive provider/retention/encryption;
- raw-versus-canonical review basis;
- professional role/qualification/policy continuity;
- snapshot retention/export;
- legacy scenario and previous JSON data disposition;
- price/tax/region/rule authority;
- sales visibility/assignment;
- Demo startup;
- formal rollout.

## 11. P1-3 Isolation

R3 does not modify Upload Intent, Upload Attempt, FileVersion, Lifecycle,
Operation, P1-3 triggers or P1-3 migration. The independent evidence archive is
explicitly separate. No current P1-3 storage capability was used by this
static review.

Any future catalog evidence capture that reads customer files must receive a
separate read-only file-interface approval. It cannot silently reuse or bypass
P1-3.

## 12. New Findings

| ID | Severity | Summary |
|---|---|---|
| `REV-R3-P1-01` | P1 | RequirementVersion does not declare the exact UNIQUE key required by Assertion/Value FKs. |
| `REV-R3-P1-02` | P1 | Assertion/Value tables omit semantic and resolved value/status fields. |
| `REV-R3-P1-03` | P1 | RuleSet APPROVED status can exist without a review event. |
| `REV-R3-P1-04` | P1 | ProfessionalReview current state is not database-proved to equal event history. |
| `REV-R3-P1-05` | P1 | `R3-BASIS-1` scalar encoding and DB implementation are incomplete. |
| `REV-R3-P1-06` | P1 | Snapshot field source assertion can differ from its authoritative FieldValue source. |
| `REV-R3-P2-01` | P2 | Actor/author identity FKs and message author binding are incomplete. |
| `REV-R3-P2-02` | P2 | Existing BuildingRequirement-to-Requirement/Version migration is not designed. |
| `REV-R3-P2-03` | P2 | Catalog/RuleSet review append-only and status projection need exact DB enforcement. |
| `REV-R3-P2-04` | P2 | Test matrix lacks the necessary direct writes and codec vectors. |
| `REV-R3-P3-01` | P3 | R3 trace overstates closure relative to the findings above. |

## 13. Final Assessment

```text
P0: 0
P1: 6
P2: 4
P3: 1
Overall: FAIL — DESIGN CORRECTIONS REQUIRED
```

R3 is directionally stronger than R2 and should be revised rather than
discarded. A new design-only correction round is required before any staged
implementation authorization. No Schema, Migration, database test, Build,
Runtime or deployment work is authorized.
