# P1 Product Remediation Traceability R2

Status legend:

```text
DESIGN_CORRECTED
DESIGN_ALREADY_SATISFIES
OPEN_DECISION_RETAINED
OUT_OF_SCOPE_WITH_RATIONALE
DESIGN_CORRECTION_STILL_REQUIRED
```

No `DESIGN_CORRECTED` entry means source implementation or problem closure. It
means the R2 design contains an actionable correction awaiting independent
review and separate implementation authorization.

## P1 Findings

| Finding | Severity | Evidence | Root cause | R2 design | Planned change | Tests | Acceptance | Open dependency | Disposition |
|---|---|---|---|---|---|---|---|---|---|
| `REV-P1-01` | P1 | `mock-provider.ts:82-86`; six review expressions absent from R1 test plan | substring polarity and no conditional scope | R2 §4.1–4.4 | parser assertion model; precedence; condition/exception states | `SEM-01`–`SEM-16` | all six expressions produce explicit non-fact states; no boolean for uncertainty | OD-R2-01/02 for professional confirmation, not parser safety | `DESIGN_CORRECTED` |
| `REV-P1-02` | P1 | R1 composite FK omits scenario | scenario only app-level | R2 §4.3, §6 | Project installationScenario, composite FKs, mutable legacy mapping | `SCN-01`–`SCN-08`, `DB-01`–`DB-04` | DB rejects cross-project/cross-scenario requirement links | OD-R2-06 for later type changes | `DESIGN_CORRECTED` |
| `REV-P1-03` | P1 | JSON `fields` read by selection; R1 adds field rows without source hierarchy | two writable representations | R2 §5 | normalized assertions/values authoritative; `fields` compatibility projection | `SRC-01`–`SRC-08`, `TX-01`–`TX-06` | selection and audit read same normalized field value | legacy mapping decision OD-R2-15 | `DESIGN_CORRECTED` |
| `REV-P1-04` | P1 | R1 run summary maps review requirement to insufficient data | run enum lacks distinct state | R2 §8.1–8.3 | separate candidate/run outcomes and counts | `RUN-01`–`RUN-08` | complete data/no rule returns `REQUIRES_PROFESSIONAL_REVIEW` | OD-R2-01/13 | `DESIGN_CORRECTED` |
| `REV-P1-05` | P1 | `CatalogReview.subjectType/subjectId/subjectVersion`; optional source digest | polymorphic review and mutable source identity | R2 §7 | typed exact revision FKs; SourceRevision; typed review; withdrawal | `CAT-01`–`CAT-16`, `DB-09`–`DB-16` | wrong target/source/version cannot be approved | OD-R2-03/04/18 | `DESIGN_CORRECTED` |
| `REV-P1-06` | P1 | snapshot arrays/digests; no item FK/content payload | snapshot references mutable dynamic state | R2 §9 | self-contained canonical payload + normalized items + source items + digest | `SNP-01`–`SNP-14` | snapshot reconstructs evidence after withdrawal | OD-R2-09/14 | `DESIGN_CORRECTED` |
| `REV-P1-07` | P1 | R1 candidate prose references undefined `priceStatus`; OPERATIONAL can coexist with expired price | single overloaded status | R2 §8.1–8.4 | independent technical, commercial, trust, review, overall dimensions | `SEL-01`–`SEL-14` | expired price yields `REQUIRES_QUOTE`, no unqualified Operational | OD-R2-05 | `DESIGN_CORRECTED` |

## P2 Findings

| Finding | Evidence | Root cause | R2 design | Planned change | Tests | Acceptance | Open dependency | Disposition |
|---|---|---|---|---|---|---|---|---|
| `REV-P2-01` | R1 ProjectRequirementHead FK references `(projectId,id)` but R1 unique list lacks it | unverified referenced key | R2 §5.2, §6.2 | add `UNIQUE(projectId,id)` before head FK | `DB-01`, `DB-05` | migration FK validates | none | `DESIGN_CORRECTED` |
| `REV-P2-02` | R1 §8 shared wrapper but no complete route inventory/content type | policy incompleteness | R2 §11 | guarded route map, content allowlist, inventory test | `CS-01`–`CS-04` | every current/future mutation is guarded | auth-framework exemptions need security approval | `DESIGN_CORRECTED` |
| `REV-P2-03` | R1 handoff case still had free `assignedToId` | missing FK/scope | R2 §9.1, §14 | User FK + project scope + audit | `SAL-01`–`SAL-04` | invalid/unassigned sales user rejected | OD-R2-17 policy | `DESIGN_CORRECTED` |
| `REV-P2-04` | Original review noted latest-only requirement UI; R1 trace omitted it | missing history read model | R2 §13.1 | history API/UI + immutable versions | `HIS-01`–`HIS-05` | all versions/sources visible | OD-R2-08 access policy | `DESIGN_CORRECTED` |
| `REV-P2-05` | R1 effective fields no timezone/boundary/as-of | ambiguous time semantics | R2 §7.5, §9.3 | UTC `[from,to)`, one transaction `asOf`, ambiguity failure | `EFF-01`–`EFF-06` | exact boundaries deterministic | OD-R2-11 | `DESIGN_CORRECTED` |
| `REV-P2-06` | R1 message idempotency lacked response correlation | one unique message row insufficient | R2 §10.3 | `AdvisorInteractionRequest` response record | `IDEM-01`–`IDEM-04` | lost response replay returns exact prior result | none | `DESIGN_CORRECTED` |
| `REV-P2-07` | R1 atomicity did not cover initial create/greeting | separate current calls | R2 §10.2 | one conversation-create transaction | `INIT-01`–`INIT-03` | no partial conversation | none | `DESIGN_CORRECTED` |
| `REV-P2-08` | R1 kept old Operational runs without current-basis overlay | immutable history vs current validity conflated | R2 §7.4, §9.5 | stale/review basis overlay | `HIS-06`–`HIS-08` | old run retained but marked stale | OD-R2-19 visibility | `DESIGN_CORRECTED` |
| `REV-P2-09` | R1 tests lacked failure columns and invariants | test plan completeness | R2 test matrix | full failure assertions/DB states/IDs | all R2 tests | every invariant has a negative test | none | `DESIGN_CORRECTED` |
| `REV-P2-10` | R1 said fix Vitest but no concrete path/root | environment/manifest distinction absent | R2 §18.1 | frozen install, binary preflight, serial worker suite | `TI-01`–`TI-06` | clean root test resolves Vitest and stable worker suite | separately authorized env setup | `DESIGN_CORRECTED` |

## P3 Finding

| Finding | Evidence | Root cause | R2 design | Planned change | Tests/acceptance | Open dependency | Disposition |
|---|---|---|---|---|---|---|---|
| `REV-P3-01` | R1 self-check claimed complete despite gaps | overstated summary | R2 uses qualified status and this trace | rewrite final status and mapping | independent reviewer enumerates all dispositions | none | `DESIGN_CORRECTED` |

## Original MVP Review Baseline

| Original ID | R2 mapping | Disposition |
|---|---|---|
| `P1-01` | `REV-P1-01` / `MVP-R-01` | `DESIGN_CORRECTED` |
| `P1-02` | `REV-P1-02` / `MVP-R-02` | `DESIGN_CORRECTED` |
| `P1-03` | `REV-P1-02` / `MVP-R-02` | `DESIGN_CORRECTED` |
| `MVP-R-03` | `REV-P1-05` | `DESIGN_CORRECTED` |
| `MVP-R-04` | `REV-P1-04`, `REV-P1-07` | `DESIGN_CORRECTED` |
| `MVP-R-05` | R2 §8.4 / `REV-P1-04`, `REV-P1-07` | `DESIGN_CORRECTED` |
| `MVP-R-06` | `REV-P2-02` | `DESIGN_CORRECTED` |
| `MVP-R-07` | `REV-P1-06` | `DESIGN_CORRECTED` |
| `MVP-R-08` | `REV-P1-03` | `DESIGN_CORRECTED` |
| `MVP-R-09` | `REV-P1-02`, `REV-P2-01`, `REV-P2-03` | `DESIGN_CORRECTED` |
| `MVP-R-10` | `OD-R2-10` | `OPEN_DECISION_RETAINED` |
| `MVP-R-11` | `REV-P2-10` | `DESIGN_CORRECTED` |
| `MVP-R-12` | R2 test matrix browser section | `DESIGN_CORRECTED` |
| `P13-R-01` | R2 §19D | `OUT_OF_SCOPE_WITH_RATIONALE` |
| `P13-R-02` | R2 §19D | `OUT_OF_SCOPE_WITH_RATIONALE` |
| `P13-R-03` | R2 §19D | `OUT_OF_SCOPE_WITH_RATIONALE` |

## R2 Internal Finding Trace

R2 does not introduce a new unresolved design finding. All caveats below are
open decisions or residual verification obligations:

| R2 issue | Disposition |
|---|---|
| Engineering thresholds and professional review | `OPEN_DECISION_RETAINED` |
| Source/reviewer authority | `OPEN_DECISION_RETAINED` |
| Price/tax/region policy | `OPEN_DECISION_RETAINED` |
| Project Type change policy | `OPEN_DECISION_RETAINED` |
| Project head policy | `OPEN_DECISION_RETAINED` |
| Conversation sharing/sales visibility | `OPEN_DECISION_RETAINED` |
| Snapshot retention | `OPEN_DECISION_RETAINED` |
| Legacy data disposition | `OPEN_DECISION_RETAINED` |
| Demo startup identity | `OPEN_DECISION_RETAINED` |

## Closure Statement

```text
P1 design corrections: WRITTEN IN R2
P2 design corrections: WRITTEN IN R2
P3 disposition: WRITTEN IN R2
Independent review: PENDING
Implementation: NOT AUTHORIZED
Problem closure: NONE
```

