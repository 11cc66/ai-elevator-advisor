# FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS-R4

## Status

```text
DESIGN COMPLETE — READY FOR SEPARATE INDEPENDENT REVIEW
P1: 0 new implementation authorizations
P2: R3 P2-01/P2-02/P2-03 DESIGN-ADDRESSED
P3: R3 P3-01 DESIGN-ADDRESSED
Database: NOT ACCESSED
SQL Execution: NOT EXECUTED
Runtime: NOT EXECUTED
Storage: NOT ACCESSED
Git Writes: NONE
```

This package is design and offline verification only. It does not authorize
Prisma, Migration, SQL, Build, Native RPC Runtime, Storage, deployment, or
production activity.

## Skills Actually Read and Applied

The following complete Skill bodies and their referenced review checklists were
read:

| Skill | Path | Applied constraint |
|---|---|---|
| `$project-architecture` | `.agents/skills/project-architecture/SKILL.md` and `references/architecture-review.md` | Preserved DB/domain/Web/Worker/Storage ownership and design-only boundary |
| `$prisma-db-safety` | `.agents/skills/prisma-db-safety/SKILL.md` and `references/database-change-review.md` | Required real constraints, transaction boundaries, CAS/row locks and exact FK targets |
| `$security-audit` | `.agents/skills/security-audit/SKILL.md` and `references/adversarial-review.md` | Treated caller input, retries, lost responses, concurrent callers and Catalog ACL as adversarial |
| `$testing-and-verification` | `.agents/skills/testing-and-verification/SKILL.md` and `references/verification-matrix.md` | Separated static evidence, offline simulation and unavailable PostgreSQL Runtime evidence |
| `$file-lifecycle` | `.agents/skills/file-lifecycle/SKILL.md` and `references/lifecycle-review.md` | Preserved Fail Closed, lease/fencing, UNKNOWN, immutable evidence and no physical side effects |

The high-risk document route was also read: root `README.md`, `D02`, `D03`,
`D04`, `D05`, `D08`, `D09`, `D11`, `P30` through `P37`, `FZ`, `ST`, and `DBTP`.
The R1, R2 and R3 design/review materials named by the authorization were read
from their source files rather than from summaries.

## Input Integrity

All four input Manifests were independently parsed using the actual
`SHA-256 / bytes / lines / path` record format:

```text
R3 design Manifest:
C5611B8807D50E3E02286A63B5C9E39F9F745684793C2FD5525DCA4537A71825
28/28 records valid

R3 review Manifest:
1500C72F8059AAD1D15F4829818D1BA688CD57B95DD606CDFEB26A3D58285EC2
18/18 records valid

R2 design Manifest:
45331850C8DB01CC4AE1DC58825AFFB9E5187259CD28F0B68D6BE32F9F6422E8

R2 review Manifest:
5865AAE961DDCFF7A546D6435729455D091810FF3BF8D4A155CA0EDB36082FF1
```

No input Manifest mismatch was found.

## Transformation

The R4 complete DDL is generated only after fully verifying the frozen R3
Manifest:

```text
verified R3 complete DDL
  -> R4 Final-State Overlay
  -> R4 Complete DDL
```

The generator fails on a Manifest hash, byte, line, duplicate-path or key-input
mismatch. It does not edit R2/R3 inputs.

## P2-01 — Approval Expiry Must Commit

The R3 pattern:

```text
UPDATE Recovery/Lifecycle -> LOCKED
RAISE EXCEPTION
```

is forbidden because the exception rolls the update back.

R4 uses a structured, committing transaction:

```text
row lock Recovery
  -> claim original Approve or Execute Request
  -> detect expiry
  -> update Recovery to LOCKED
  -> update Lifecycle to LOCKED
  -> append immutable LOCKED Event
  -> complete the original Approve/Execute Ledger operation
  -> return structured LOCKED
  -> transaction commits
```

`app_private.lock_expired_root_change_r4(text)` only mutates Recovery, Lifecycle
and Event. It never completes a Ledger operation because the operation name
belongs to the original caller:

```text
BOOTSTRAP_APPROVE_ROOT_CHANGE_R4
BOOTSTRAP_EXECUTE_ROOT_CHANGE_R4
```

The caller completes its own Ledger row before returning. Any state, Event or
Ledger failure aborts and rolls back the entire transaction. There is no
swallowed `WHEN OTHERS`, no autonomous-transaction assumption, and no response
path that reports success before the durable writes complete.

Final DDL references:

- `app_private.lock_expired_root_change_r4`: Complete DDL line 15723.
- `app.bootstrap_approve_root_change_r4`: Complete DDL line 15760.
- `app.bootstrap_execute_root_change_r4`: Complete DDL line 16054.
- Final R4 ACL revoke: Complete DDL line 16431.

## P2-02 — Ordered Recovery Attempts

R4 separates historical Attempts from the single active Attempt:

```text
bootstrap_recovery_r2
  = immutable Attempt history by recovery ID

bootstrap_recovery_attempt_sequence_r4
  = per Bootstrap/Generation monotonic sequence allocator

bootstrap_recovery_one_active_attempt_r4
  = partial unique index over PENDING/APPROVED only
```

Every Begin call:

1. locks the current Lifecycle row;
2. claims Request Ledger replay first;
3. rejects an existing PENDING/APPROVED Attempt;
4. obtains Sequence from an atomic upsert;
5. inserts a new immutable Attempt;
6. materializes its Initiator approval;
7. updates Lifecycle;
8. appends Event and completes Ledger.

DENIED and LOCKED are terminal history states. A later Begin creates a new
Attempt and a new approval object. Old approvals remain bound to the old
`recovery_id`; the old Attempt cannot become active again.

For existing rows, `attempt_sequence` is deterministically backfilled by
`requested_at,id` within each Bootstrap/Generation before NOT NULL and unique
constraints are installed. The secondary tie-breaker is the immutable recovery
ID, not caller input.

The Attempt allocator and active uniqueness mutate through the one canonical
path. Application-side `MAX(sequence)+1` is not accepted.

Final DDL references:

- Deterministic legacy sequence backfill: Complete DDL line 15628.
- Sequence table: Complete DDL line 15673.
- Active Attempt partial unique index: Complete DDL line 15693.
- Atomic allocator: Complete DDL line 15697.
- Begin function: Complete DDL line 15855.

## P2-03 — Semantic Validator

The R4 Validator does not treat a word occurrence or a submitted PASS as
proof. It builds the final function definition map, where the last definition
of an overload replaces historical bodies, and checks:

- Expiry helper does not complete Ledger;
- Expiry helper has no unhandled business RAISE or swallowed exception;
- Approve and Execute call the helper and complete their own Ledger rows;
- replay occurs before terminal-state rejection;
- the historical one-per-Generation unique is dropped;
- the new Attempt sequence and active partial unique exist;
- Begin locks Lifecycle and has no caller-supplied sequence parameter;
- historical Attempts are never updated back to PENDING;
- Candidate source columns are NOT NULL and composite FKs remain present;
- final role capability set equals the frozen R3 capability set after removing
  the four unsafe Recovery entry points and adding the four R4 replacements;
- final PUBLIC revoke occurs after every function definition.

The Validator re-runs:

```text
R3 formal mutations: 29/29
R2 historical mutations: 12/12
R4 semantic mutations: 46/46
transaction state vectors: 10/10
Attempt concurrency vectors: 5/5
```

## P3-01 — ProfessionalReview Candidate NOT NULL

Two source tables receive a database-level NOT NULL constraint:

```text
app.selection_professional_review_result.candidate_id
app.sales_snapshot_professional_review_r3.candidate_id
```

Before NOT NULL is installed:

1. Selection rows are backfilled only from the exact referenced
   `professional_review_event.candidate_id`.
2. Snapshot rows are backfilled only from the exact Selection result keyed by
   `(selection_run_id, professional_review_id, event_sequence)`.
3. Existing sealed/finalized guards are replaced with a Candidate-only
   exception that requires every other row field to remain byte-equivalent at
   the JSON representation level.
4. A fail-closed preflight aborts if any row remains NULL.

No default Candidate, `LIMIT 1`, random Candidate, Trigger-only guarantee, or
composite-FK NULL escape is accepted. Trigger bypass by a trusted table owner
still cannot write NULL.

Final DDL references:

- Candidate-only guard helper: Complete DDL line 15470.
- Candidate preflight: Complete DDL line 15603.
- Two NOT NULL alterations: Complete DDL lines 15610 and 15612.

## State and Timestamp Invariants

R4 adds:

```text
bootstrap_recovery_terminal_reason_check_r4
```

DENIED and LOCKED require `locked_at`, a nonblank `denial_reason`, and no
`executed_at`. Other states require both R4 terminal fields to be NULL.

For rows already terminal before R4, the migration records the exact R4
migration observation timestamp and the explicit reason
`LEGACY_TERMINAL_STATE_PRE_R4`. This does not claim that the migration time was
the original denial time.

The existing R3 Generation, Root Session, Recovery and Result Recovery
timestamp checks remain in force.

## Final ACL

After every new function is defined, R4 executes final PUBLIC revokes and then
reasserts the complete approved capability set. The four historical Recovery
entry points are explicitly revoked from their roles; their compatibility
wrappers call R4 logic but are not caller-accessible capabilities.

The final ACL restoration includes root completion, identity broker, policy,
professional review, selection, snapshot, catalog, Request Recovery and
bootstrap capabilities. New internal helpers and the sequence table have no
PUBLIC access. The new sequence table explicitly grants only
`SELECT/INSERT/UPDATE` to `elevator_review_function_owner`, whose SECURITY
DEFINER allocator must perform the atomic upsert.

## Required Boundaries

```text
PostgreSQL Grammar:
NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER

PostgreSQL Compilation:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Catalog Introspection:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Transaction Rollback and Constraint Timing:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Concurrent Attempt Execution:
NOT VERIFIED — RUNTIME NOT AUTHORIZED

Database: NOT ACCESSED
Storage: NOT ACCESSED
Runtime: NOT EXECUTED
Production: NOT AUTHORIZED
Git Writes: NONE
```

This package must receive a separate independent R4 review before any
implementation authorization.
