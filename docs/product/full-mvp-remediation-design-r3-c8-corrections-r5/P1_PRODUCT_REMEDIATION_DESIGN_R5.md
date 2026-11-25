# P1 Product Remediation Design R5

## Purpose

R5 is a design-only correction package for the four P2 findings and one P3
finding issued by the independent R4 review. It does not modify Prisma,
migrations, application code, build artifacts, a database or any historical
report.

```text
R5 status: DESIGN COMPLETE WITH OPEN BLOCKERS
Independent review: REQUIRED
Implementation: NOT AUTHORIZED
PostgreSQL grammar: NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER
PostgreSQL execution: NOT EXECUTED
Runtime concurrency: NOT EXECUTED
```

## Input Baseline

The R4 design Manifest, R4 review Manifest and all covered files were verified
before generation:

```text
R4 design Manifest records: 25
R4 review Manifest records: 16
Manifest, path, byte, line and SHA-256 errors: 0
R4 Complete DDL:
F4DA543931B69F67DEB6672B41F968FCF24E1D8E025B367E5282B4AF44711B2F
R4 Overlay:
87A3814632B59FBD6614CCA31E6A388FE3FDEDD0D695611FC04B1E39C4664552
R4 Function Registry:
C0FD9D353F5E82D937E587A81106652B3A66DC47256B777BD8CE2DF430F86EA3
```

The authorization text contains one transcription inconsistency for the R4
review evidence hash. The independently authorized Review Manifest verifies the
actual file as:

```text
5C7B393CBCCC90B70B8508F296DAF7ACA0F56C85D5CDBB1BADB4CBB2FFC88D6D
```

The authorization transcription contains `1ADDB` at the corresponding
position. This is recorded as an input-instruction transcription warning, not
as a file mutation. No historical file was changed.

## Skills Invoked

| Skill | Read reference | Applied constraint |
|---|---|---|
| `$project-architecture` | `.agents/skills/project-architecture/references/architecture-review.md` | Preserve database/application/Worker/Storage ownership and open decisions |
| `$prisma-db-safety` | `.agents/skills/prisma-db-safety/references/database-change-review.md` | Constraints, CAS/locks, transaction boundaries, fail-closed schema design |
| `$security-audit` | `.agents/skills/security-audit/references/adversarial-review.md` | Distrust callers, stale state, replay, authorization and evidence paths |
| `$testing-and-verification` | `.agents/skills/testing-and-verification/references/verification-matrix.md` | Separate static analysis, state simulation, grammar, compilation and Runtime |
| `$file-lifecycle` | `.agents/skills/file-lifecycle/references/lifecycle-review.md` | Preserve immutable evidence, commit-unknown and app-owned lifecycle boundaries |

The root `AGENTS.md` router was applied as a high-risk database/security design
task. No file-lifecycle production operation is enabled by R5.

## Corrected Invariants

1. All Begin/Approve/Execute/Deny commands and all
   Root-invalidating identity mutation paths acquire one transaction-scoped
   Bootstrap identity advisory lock before protected work.
2. A ROTATION Execute rechecks the current Root Principal, Session, Grant,
   Principal Epoch, validity window and current Generation before the Effect.
3. A Generation `BEFORE INSERT` Trigger repeats the ROTATION authority check
   for the transition, while allowing an already-superseded old Generation only
   inside that locked transition.
4. Begin detects an expired PENDING/APPROVED Attempt, locks it, transitions it to
   LOCKED, appends its Event and durable terminalization evidence, then creates
   the next Attempt in the same transaction.
5. Candidate materialization runs only through a controlled batch function that
   writes an immutable per-row audit before each exact row update.
6. Every audited row records old NULL marker, resolved Candidate, authoritative
   source, old/new row digests, original sealed digest and a new correction
   digest.
7. Response-loss validation uses non-NULL request, first result, replay result,
   Ledger row and transition/event counts.
8. Finding, Mutation and Test Vector IDs use one exact registry.

## Final Design Objects

| Object | R5 evidence |
|---|---|
| Identity mutex | `app_private.lock_bootstrap_identity_r5()`, Complete DDL line 16540 |
| Current Root gate | `app_private.assert_current_root_authority_r5(...)`, line 16592 |
| Generation final guard | `app_private.enforce_rotation_generation_revalidation_r5()`, line 16673 |
| Expired terminalization | `app.terminalize_expired_root_change_r5` logic, line 16790 |
| R5 Begin | `app.bootstrap_begin_root_change_r4(...)`, line 17026 |
| R5 Execute | `app.bootstrap_execute_root_change_r4(...)`, line 17226 |
| Candidate batch | `app.candidate_backfill_batch_r5`, line 17523 |
| Candidate row audit | `app.candidate_backfill_row_audit_r5`, line 17564 |
| Controlled Candidate function | `app_private.execute_candidate_backfill_r5(...)`, line 17607 |

## Validation Summary

```text
R3 formal mutations:       29/29 detected
R2 historical mutations:   12/12 detected
R4 semantic mutations:     46/46 detected
Independent negative rules: 22/22 detected
Offline state vectors:      5/5 pass
FK structural errors:       0
Function signatures:        168
Missing function owners:    0
Unresolved app calls:       0
```

These results prove only the documented static contract. They do not prove
PostgreSQL parsing, compilation, Trigger execution, MVCC, lock waiting,
deadlocks, Catalog ACL state or concurrent behavior.

## Open Blockers

All 57 Open Decisions remain OPEN. In particular:

- Identity Broker and root provisioning topology are not approved.
- Session role topology is not approved.
- Recovery retry limits and break-glass authority are not approved.
- Candidate audit retention is not approved.
- A concrete authorized maintenance identity for Candidate backfill is not
  provisioned.
- PostgreSQL 18 Compilation and Runtime concurrency still require separate
  authorization.

## Decision

```text
DESIGN COMPLETE WITH OPEN BLOCKERS
READY FOR SEPARATE INDEPENDENT R5 DESIGN REVIEW
IMPLEMENTATION AND DATABASE EXECUTION NOT AUTHORIZED
```

