# P1 Product Remediation Traceability R3

Status:

```text
R3 DESIGN COMPLETE WITH OPEN BLOCKERS
```

Status meanings:

- `DESIGN_ADDRESSED_PENDING_REVIEW`: R3 contains a concrete executable design;
  independent review and implementation evidence are still absent.
- `DESIGN_PRESERVED`: R2 design was approved by the R2 review and R3 does not
  weaken it.
- `DESIGN_PRESERVED_WITH_DEPENDENCY`: R2 design is preserved but a named R3/R2
  Open Decision still blocks the affected implementation.
- `OPEN_DECISION_RETAINED`: no authority exists to choose the value.

No status below means the issue is implemented or fixed.

## 1. Five R2 P1 Findings

| R2 Finding | R3 design | Database invariant | Negative tests | Acceptance criterion | Open dependency | Status |
|---|---|---|---|---|---|---|
| `REV-R2-P1-01` requirement provenance crosses ownership | R3 §4; stable Requirement/Version; full Project/Conversation/Requirement/Version/Assertion/Message chain | `UNIQUE(id, requirementId)` on assertion; composite Value→Assertion FK; Assertion→Message `(messageId,conversationId)` FK; state-aware NOT NULL CHECK | `R3-SRC-01`–`R3-SRC-13` | direct SQL rejects cross-requirement, cross-conversation, wrong-version and NULL-bypass links | `OD-R3-06` only for legacy disposition | `DESIGN_ADDRESSED_PENDING_REVIEW` |
| `REV-R2-P1-02` catalog digest lacks immutable content | R3 §5; separate CatalogEvidenceArchive, content-addressed object, immutable SourceRevision and verification events | exact EvidenceObject/SourceRevision keys; review evidence binds `MATCH` verification; impossible to edit approved source evidence | `R3-EVID-01`–`R3-EVID-13` | same URL/new content cannot reuse old review; missing/mismatch evidence blocks formal approval | `OD-R3-01/02/09` | `DESIGN_ADDRESSED_PENDING_REVIEW` |
| `REV-R2-P1-03` sales ownership basis is recombined | R3 §7 and §9; exact RequirementVersion and SelectionRun keys; case/project/version/run snapshot FKs | Snapshot `(caseId,projectId)`, exact requirement version and exact `(run,project,conversation,requirement,version,scenario,ruleset)` FKs | `R3-SNP-01`–`R3-SNP-18` | same-project wrong requirement/run and cross-project case/snapshot inserts fail at COMMIT | `OD-R3-05` only for retention/export | `DESIGN_ADDRESSED_PENDING_REVIEW` |
| `REV-R2-P1-04` professional review not persistent/enforced | R3 §8; immutable policy revisions, exact review basis, append-only events and transition function | event sequence/version uniqueness; review state CAS; exact basis/source/policy FKs; trigger verification | `R3-PRO-01`–`R3-PRO-16`, `R3-RULE-*` | approval cannot transfer across basis or policy changes; concurrent reviewers produce one event winner | `OD-R3-03/04/07` | `DESIGN_ADDRESSED_PENDING_REVIEW` |
| `REV-R2-P1-05` payload and items disagree | R3 §9.2–9.4; normalized rows are the sole authority; payload is read-only reconstruction | no writable canonical payload; deferred copy-equality and completeness checks; database-defined basis digest; JCS rendered separately | `R3-SNP-11`–`R3-SNP-18` | no valid DB state can contain normalized items and reconstructed payload that describe different handoff evidence | `OD-R3-05` for schema/format approval | `DESIGN_ADDRESSED_PENDING_REVIEW` |

## 2. Five R2 P2 Groups

The R3 task groups P2 work as P2-A through P2-E. Their exact R2 Finding IDs are:

| R3 group | Exact R2 finding | R3 correction | Negative tests | Status |
|---|---|---|---|---|
| P2-A | `REV-R2-P2-01` | §11 project scenario NULL/update/legacy mapping: expand-backfill-validate, mapping CHECK, immutable-after-conversation trigger, same Project row lock for change vs conversation create | `R3-SCN-01`–`R3-SCN-10` | `DESIGN_ADDRESSED_PENDING_REVIEW`; `OD-R3-06` |
| P2-B | `REV-R2-P2-02` | §6–7 immutable `SelectionRuleSetRevision`, normalized rule rows, exact run/candidate rule revision binding | `R3-RULE-01`–`R3-RULE-10` | `DESIGN_ADDRESSED_PENDING_REVIEW`; `OD-R3-07` |
| P2-C | `REV-R2-P2-03` | §10 conversation-scoped idempotency keys, exact message/version FKs, separate success/failure transaction semantics and commit-unknown recovery | `R3-IDEM-01`–`R3-IDEM-12` | `DESIGN_ADDRESSED_PENDING_REVIEW`; `OD-R3-08` |
| P2-D | `REV-R2-P2-04` | §5.4 and §8.1/8.3 immutable catalog/professional review policy revisions; every review/event binds exact policy revision and digest | `R3-EVID-13`, `R3-PRO-07`–`R3-PRO-12`, `R3-POL-01`–`R3-POL-08` | `DESIGN_ADDRESSED_PENDING_REVIEW`; `OD-R3-04` |
| P2-E | `REV-R2-P2-05` | `P1_PRODUCT_REMEDIATION_TEST_PLAN_R3.md`: direct DB negative, concurrent, commit-unknown, stale-basis and payload consistency tests | `R3-CT-01`–`R3-CT-12` and all cross-domain negative tests | `DESIGN_ADDRESSED_PENDING_REVIEW`; execution requires separate authorization |

## 3. R2 P3

| R2 Finding | R3 correction | Status |
|---|---|---|
| `REV-R2-P3-01` R2 traceability overclaimed no new issue | R3 explicitly names all reviewed R2 findings, distinguishes design from implementation, and does not claim that no new issue exists | `DESIGN_ADDRESSED_PENDING_REVIEW` |

## 4. Original Seven P1 Findings Preserved From R2

| Original Finding | R3 effect | Status |
|---|---|---|
| `REV-P1-01` conditional and uncertainty semantics | R3 §4 retains R2 semantic kinds, precedence, raw source text and no-boolean rules | `DESIGN_PRESERVED` |
| `REV-P1-02` Project/Conversation/Requirement scenario equality | R3 §11 preserves composite scenario chain and strengthens update/backfill mechanics | `DESIGN_PRESERVED_WITH_DEPENDENCY` (`OD-R2-06`/`OD-R3-06`) |
| `REV-P1-03` requirement single source | R3 §4 makes normalized Assertion/Value rows authoritative and closes provenance ownership | `DESIGN_ADDRESSED_PENDING_REVIEW` |
| `REV-P1-04` professional-review run outcome | R3 §8 and §9 retain separate `INSUFFICIENT_DATA`, `REQUIRES_PROFESSIONAL_REVIEW`, `REQUIRES_QUOTE` and `OPERATIONAL` semantics | `DESIGN_PRESERVED_WITH_DEPENDENCY` (`OD-R2-01/13`) |
| `REV-P1-05` catalog exact revision/source binding | R3 §5 preserves typed review targets and adds immutable source evidence | `DESIGN_ADDRESSED_PENDING_REVIEW` |
| `REV-P1-06` sales snapshot self-containment | R3 §9 preserves normalized item/source evidence and removes payload dual authority | `DESIGN_ADDRESSED_PENDING_REVIEW` |
| `REV-P1-07` technical/commercial/trust/overall separation | R3 §7 retains independent assessment dimensions and `REQUIRES_QUOTE` behavior | `DESIGN_PRESERVED_WITH_DEPENDENCY` (`OD-R2-05`) |

## 5. Original R2 P2 Findings Preserved

| Finding | R3 effect | Status |
|---|---|---|
| `REV-P2-01` head unique key | `UNIQUE(projectId,id)` retained in R3 §4 | `DESIGN_PRESERVED` |
| `REV-P2-02` route inventory | R2 executable inventory policy retained; implementation still needs independent security review | `DESIGN_PRESERVED_WITH_DEPENDENCY` |
| `REV-P2-03` sales assignee | User FK and project scope retained; assignment policy in `OD-R2-17` | `DESIGN_PRESERVED_WITH_DEPENDENCY` |
| `REV-P2-04` requirement history | immutable history/API/UI retained; sharing policy in `OD-R2-08` | `DESIGN_PRESERVED_WITH_DEPENDENCY` |
| `REV-P2-05` effective times | UTC/asOf and `[from,to)` retained; ambiguity policy in `OD-R2-11` | `DESIGN_PRESERVED_WITH_DEPENDENCY` |
| `REV-P2-06` idempotency response correlation | replaced/strengthened by R3 §10 and exact `REV-R2-P2-03` correction | `DESIGN_ADDRESSED_PENDING_REVIEW` |
| `REV-P2-07` initial atomicity | R3 transaction table retains one creation transaction | `DESIGN_PRESERVED` |
| `REV-P2-08` stale historical overlay | R3 snapshot basis-diff retains immutable history/current separation | `DESIGN_PRESERVED_WITH_DEPENDENCY` |
| `REV-P2-09` test completeness | R3 test plan supplies direct DB/concurrency gaps from R2 | `DESIGN_ADDRESSED_PENDING_REVIEW` |
| `REV-P2-10` test infrastructure | R2 frozen-install preflight retained; environment work separately authorized | `DESIGN_PRESERVED_WITH_DEPENDENCY` |

## 6. R3 Design Changes By Area

### Requirement

R2 field/value rows become an exact chain with stable Requirement and immutable
RequirementVersion. Values cannot source another requirement's assertion or
message. Corrections append new versions and cannot reuse invalidated evidence.

### Catalog

R2 digest-only source is replaced by content-addressed immutable evidence,
source revision binding, append-only verification and exact review evidence.
The archive is a new capability and does not touch P1-3.

### Professional review

R2 status labels become an event-sourced review with append-only events,
policy revisions, exact basis, CAS state transitions and explicit invalidation.

### Sales

R2 case/project/requirement/run references become a complete composite chain.
Snapshot normalized rows are the sole authority; JCS payload is derived at read
time and cannot be independently written.

### Candidate/rule/status

R3 §7 carries the exact rule-set revision and candidate revision IDs through a
selection run. No string display version can stand in for the run's immutable
rule set.

## 7. Unresolved Dependencies

The following are intentionally unresolved:

- any actual source content archive provider, retention, encryption and legal
  hold;
- whether raw bytes, canonical text or both are the legally accepted review
  basis;
- professional-review roles, qualifications, assignment and policy-change
  continuity;
- rule-set creator/approver separation;
- price types, tax and geographic scope;
- project scenario change policy and unmappable legacy disposition;
- project current requirement policy;
- conversation sharing and sales visibility;
- snapshot retention, export and deletion;
- preliminary-result visibility;
- Demo startup identity;
- final canonical snapshot schema/format approval;
- formal rollout.

These dependencies are detailed in `P1_PRODUCT_REMEDIATION_OPEN_DECISIONS_R3.md`.
They do not waive the technical invariants in R3 §§4–10.

## 8. P1-3 Exclusion

R3 does not modify:

- `FileUploadIntent`;
- `FileUploadAttempt`;
- `StorageObjectLifecycle`;
- `StorageObjectOperation`;
- `FileVersion`;
- P1-3 migration, triggers or storage capabilities.

`CatalogEvidenceArchive` is a separate evidence capability. It is not a
FileVersion and cannot use the P1-3 object namespace. Any future integration
with uploaded files requires a separately reviewed read-only interface.

## 9. Traceability Conclusion

```text
R2 P1 findings addressed in design: 5 / 5
R2 P2 groups addressed in design: 5 / 5
R3 independent review: PENDING
Open Decisions: RETAINED
Source implementation: NOT AUTHORIZED
Schema/Migration: NOT AUTHORIZED
Database behavior: NOT VERIFIED
Runtime: NOT VERIFIED
```
