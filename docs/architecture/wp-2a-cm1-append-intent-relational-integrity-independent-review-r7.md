# WP-2A-CM1 — Append Intent Relational Integrity Independent Review R7

## 0. Final Conclusion

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

R6 correctly fixes R5-P1-01: the deferred File-side check now uses only a
stable File identity and re-reads final File state. It also adds a substantial
Deferred Trigger matrix and an offline Migration Runbook.

However, a new concrete P1 remains:

```text
Append Intent can be committed as COMPLETED while
File.currentVersionId still points to an older version.
```

Neither the existing completion guard nor the P1-3 upload chain compares
`completedFileVersionId` with `File.currentVersionId`. R6's final-state guard
checks only active `UPLOADING` Append states, so a completed inconsistent
Append is invisible to it.

No PostgreSQL or Prisma behavior was executed in this review.

## 1. Document Control

Reviewed:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-remediation-design-r6.md
SHA-256 7948C582AE04D0F2774E0B4F33FA759FE118AF2947158E990430EB8250392A1F
33,155 bytes
1,070 lines
```

The file matches the supplied baseline.

Also checked:

```text
R5 independent review
R4 design
R3 independent review
R2 design/review chain
R1 original design
current Prisma Schema
all related CM1/P1-3 Migrations
upload and object-upload services
recovery/finalization/retry paths
current tests and evidence
```

## 2. Git State at Review Start

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  80
Untracked files:        81
```

Git was inspected with a command-local `safe.directory` override. No Git
configuration was changed.

## 3. R6 Design Summary

R6:

- preserves R4's `File.createdByUploadIntentId` provenance;
- changes the File-side Append guard to use `OLD.id`/`NEW.id` only;
- re-reads the final File row and checks all active Append Intents;
- adds Intent-side OLD/NEW File relationship checks;
- specifies 36 Deferred Trigger test cases;
- defines an offline drain, session, prepared-transaction and `NOWAIT` lock
  Runbook.

The stale `NEW.currentVersionId` defect is corrected in the proposed SQL.

## 4. R5 Findings Revalidation

| Finding | Independent result | Status |
|---|---|---|
| `R5-P1-01` stale event-local NEW | R6 helper re-reads final File by stable ID | `RESOLVED` by design |
| `R5-P2-01` Deferred matrix incomplete | Broad matrix added, but one new completion-state case is missing | `PARTIALLY RESOLVED` |
| `R5-P2-02` Migration operational proof | Runbook is executable in design; actual operational evidence absent | `PARTIALLY RESOLVED` |

## 5. Final-State Re-read Review

### 5.1 Correct part

R6's helper:

```text
R6 design: 169-211
```

queries the final `file` row by `p_file_id` and uses `f.currentVersionId`.

The File-side function:

```text
R6 design: 224-259
```

uses OLD/NEW only to determine old/new File IDs.

This fixes:

```text
A -> B -> A
```

with a final valid active Append state.

### 5.2 Intent-side function

The Intent-side function:

```text
R6 design: 272-307
```

checks old/new associated File IDs through the same helper. Existing
immutability/ RISTRICT constraints normally prevent these IDs from changing.

### 5.3 Missing completion check

R6's helper only rejects:

```text
Intent.status = 'UPLOADING'
AND File.currentVersionId != expectedCurrentFileVersionId
```

It does not reject:

```text
Intent.status = 'COMPLETED'
AND File.currentVersionId != completedFileVersionId
```

This is the R7-P1-01 defect.

## 6. Finding R7-P1-01 — Completed Append Can Keep Old Current Pointer

### Severity

```text
P1
```

### Locations

```text
R6 design: 169-211, 582-610, 631-668
prisma/migrations/20261115233000_phase32_upload_intents/migration.sql:190-247
prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:1279-1345
```

### Existing completion guard

The current completion guard verifies:

- completed FileVersion exists;
- project/building/unit match;
- Append completed File equals `existingFileId`.

It does not compare:

```text
File.currentVersionId = Intent.completedFileVersionId
```

### Existing P1-3 completed chain

For COMPLETED Intent, the chain guard verifies:

- no current Attempt;
- exactly one completed FileVersion;
- FileVersion uploadIntent ownership;
- Attempt/lifecycle/operation consistency.

It also does not compare the File current pointer.

### R6 persistent guard

R6's helper queries only:

```text
i.status = 'UPLOADING'
```

A COMPLETED Append is therefore outside its check.

### Complete counterexample

Initial legal state:

```text
File F.currentVersionId = FV0
Intent I:
  existingFileId = F
  expectedCurrentFileVersionId = FV0
  status = UPLOADING
  one legal Attempt/Lifecycle/Operation chain
```

Direct DML builds/uses a legal completed FileVersion:

```sql
-- FV1 belongs to F, has the Intent/Attempt/Operation chain,
-- ACTIVE canonical lifecycle and APPLIED finalize operation.

UPDATE "file_upload_intent"
SET
  status = 'COMPLETED',
  currentAttemptId = NULL,
  completedAt = NOW(),
  completedFileVersionId = 'FV1'
WHERE id = 'I';

-- Deliberately do not update File.currentVersionId.
COMMIT;
```

Checks:

```text
completion guard: FV1.fileId = I.existingFileId = F -> pass
P1-3 completed chain: one matching FV1/Attempt/Lifecycle/Op -> pass
pair CHECK: I/I -> pass
compound FK: FV1/F -> pass
R6 active guard: no remaining UPLOADING row -> pass
```

Final:

```text
Intent I = COMPLETED, completedFileVersionId=FV1
File F.currentVersionId = FV0
```

This is an inconsistent completed Append.

### Impact

- A completed Intent can disagree with the File current pointer.
- A later ordinary append uses FV0 as expected-current even though a completed
  Intent says FV1 is current.
- Recovery/download/version navigation can present contradictory current
  history.
- The database does not make Append finalization atomic in the final state.
- Direct DML bypasses the application's normal CAS ordering.

### Minimal correction

Add a deferred completion-transition guard, separate from the persistent
UPLOADING helper:

```text
when an Intent event changes UPLOADING -> COMPLETED:
  at COMMIT, re-read final Intent
  if final status is COMPLETED:
    re-read completed FileVersion and target File
    require File.currentVersionId = completedFileVersionId
```

Use OLD/NEW event values only to classify that the event is a completion
transition:

```text
OLD.status = UPLOADING
NEW.status = COMPLETED
```

The actual current/version check uses final re-read rows.

Do not enforce this against every later update of an already-COMPLETED
historical Intent, because a later legitimate Append may advance current.

### Required test

```text
R7-T-COMP-01
Intent UPLOADING, legal completed FileVersion exists, but File.current remains FV0
UPDATE Intent -> COMPLETED
COMMIT
expected: 23514
final: transaction rollback; Intent remains UPLOADING; current remains FV0
```

Legal negative:

```text
R7-T-COMP-02
same transaction: Intent completes, File current later changes to FV1
expected: COMMIT success
```

The guard must run at COMMIT, not immediately at the Intent UPDATE.

## 7. Same-Transaction Multi-Event Analysis

### 7.1 A -> B -> A

```text
File F current A
Intent I UPLOADING expected A
UPDATE F current=B   -- deferred event F1
UPDATE F current=A   -- deferred event F2
COMMIT
```

Each event identifies F. R6 helper re-reads final A. Final active invariant is
valid. Expected: PASS.

### 7.2 A -> B -> C

```text
UPDATE F current=B
CREATE completed FileVersion C
UPDATE F current=C
UPDATE I status=COMPLETED, completedVersion=C
COMMIT
```

Final active helper sees no UPLOADING Intent. A completion guard is needed to
prove final current equals C. R6 currently lacks that.

### 7.3 File first, Intent terminal later

If final File current equals completed version, valid once the missing
completion guard is added.

### 7.4 Intent terminal first, File current later

The completion event and later File update are both deferred. The new
completion guard should re-read final File at COMMIT and pass for FV1.

### 7.5 Intent completes without File update

This is R7-P1-01 and must reject.

### 7.6 Multiple Intent updates

R6 helper re-reads final Intent. Intermediate status events are idempotent
except that a transition to COMPLETED must queue the new completion guard.

### 7.7 Savepoint

Events in a rolled-back subtransaction should be discarded. Events retained by
a committed subtransaction must still check final outer-transaction state.

### 7.8 `SET CONSTRAINTS`

If IMMEDIATE is forced before the whole chain reaches its valid final state,
failure is expected. If forced after a valid final state, checks should pass.
The application must keep normal constraints deferred.

### 7.9 COMMIT response loss

Retry must read whether the full final transaction, including current pointer
and Intent completion, was committed. It must not infer from a missing
response.

## 8. Concurrency and TOCTOU

### 8.1 File row lock

File current update holds the File row lock until transaction end. Deferred
plain SELECT re-reads that transaction's final row and no other File update can
commit concurrently.

### 8.2 Active Append entry

Append creation uses File `FOR SHARE`; reservation uses File `FOR UPDATE`
inside the existing entry Trigger. Active stale state cannot appear after the
entry check without another writer later changing current.

### 8.3 Guard read to commit window

If an Intent-only transaction re-reads File and passes, a concurrent File
current update cannot commit unnoticed:

- its own File-side deferred check sees the active Intent;
- if the Intent transaction commits first, the File transaction fails;
- if File commits first, the Intent transaction re-read sees the new current.

No write-skew path was found for active UPLOADING.

### 8.4 Completed transition

The missing completion guard leaves a direct-DML data-integrity path. This is
not closed by concurrency reasoning.

### 8.5 Isolation level evidence

Upload reservation/finalization calls `$transaction()` without explicit
`isolationLevel`:

```text
upload-service.ts:484-563, 1049-1235, 2150-2281
object-upload-service.ts:324-391, 929-1110
```

The effective upload isolation therefore depends on PostgreSQL's configured
default. The repository contains explicit Repeatable Read tests for other
workflows, not upload.

Status:

```text
effective upload isolation: NOT VERIFIED
```

The lock design appears safe under Read Committed and should fail/retry under
stronger isolation, but this remains an execution/configuration gate.

## 9. Lock Order and Deadlock Timelines

### 9.1 Two Append finalizations

```text
Session A:
claim storage/operation ownership
lock File FOR UPDATE
create FileVersion
update File.current
update Intent COMPLETED
COMMIT

Session B:
claim ownership rows
wait for File
after A:
  fencing/CAS returns 0
ROLLBACK
```

Locks are acquired in the same File -> FileVersion/current -> Intent order.
No new lock is acquired by deferred SELECT. Expected one winner.

### 9.2 File current update versus finalization

```text
Session F:
lock File
insert FileVersion
update current
complete Intent
COMMIT

Session D:
wait at File
after F commit, inspect current/active slot
```

Or:

```text
Session D:
lock File
update current
deferred final check
Session F:
wait
D COMMIT while Intent UPLOADING -> 23514
D ROLLBACK
F proceeds
```

The corrected R6 helper reads final row, so D's own event is evaluated
correctly.

### 9.3 Migration versus residual writer

```text
Session W:
BEGIN
IO on file/file_version/intent
COMMIT

Session M:
BEGIN
LOCK TABLE file_version, file, file_upload_intent
ACCESS EXCLUSIVE NOWAIT
```

If W already holds a conflict:

```text
M -> 55P03
no precheck/DDL
```

If W starts after M locks:

```text
W blocks/fails
M retains all locks
```

The new Deferred queries do not add commit-time locks; they read final state.

## 10. 36-Case Matrix Review

### 10.1 Classification

R6's 36 rows are a design matrix only:

```text
tests designed: 36
tests implemented: 0
tests executed: 0
PostgreSQL behavior confirmed: 0
```

No row may be called PASS before execution.

### 10.2 Strong coverage

The matrix covers:

- full new-File provenance;
- stale event final re-read;
- A -> B -> A;
- same-transaction Intent/File ordering;
- SAVEPOINT;
- `SET CONSTRAINTS`;
- concurrency;
- old executor;
- COMMIT response loss;
- delete/truncate/FK paths.

### 10.3 Missing/ambiguous rows

| R6 row | Issue |
|---|---|
| `R6-T-15` | covers Intent terminal then File update, but not completion with no File update |
| `R6-T-30` | SQLSTATE written `23503/42501`; target path is not isolated |
| `R6-T-33` | “related File field changes PASS/REJECT” is not a deterministic case |
| `R6-T-34` | umbrella “direct DML” row does not identify exact SQL/control |
| `R6-T-36` | N/A/PG umbrella does not enumerate each FK action |

Minimum additions:

```text
R7-T-COMP-01 completed Append with old current: reject
R7-T-COMP-02 completion then current in same tx: pass
R7-T-COMP-03 current then completion in same tx: pass
R7-T-COMP-04 later legitimate Append after prior completion: pass
R7-T-DEL-01 active File DELETE exact first control
R7-T-DEL-02 active Intent DELETE exact first control
R7-T-FK-01 each CASCADE/RESTRICT action separately
```

## 11. Offline Migration Runbook Review

### 11.1 Executable strengths

R6 correctly defines:

- release/operations/DBA/verifier roles;
- ingress and maintenance stop;
- Worker/scheduler/retry/auto-restart stop;
- writer/session/prepared transaction inventory;
- no fixed-delay-only drain;
- `NOWAIT` three-table lock;
- pre/postcheck;
- `_prisma_migrations` state;
- no restart after failure;
- old-schema verification/replacement clone.

### 11.2 Remaining operational gaps

The following cannot be established by DB queries alone:

- no unknown host/container instance;
- no external scheduler;
- no future auto-restart;
- no external client will reconnect;
- provider-side effects are quiesced.

R6 correctly labels these manual/non-DB-provable. Until deployment evidence is
provided:

```text
Runbook design: COMPLETE
Operational readiness: NOT VERIFIED
```

### 11.3 Re-entry window

After locks are acquired, DML on the three protected tables blocks. An idle
reconnected client cannot write those tables until Migration releases locks.

A client may still touch unrelated storage tables; old services must remain
stopped. Database locks alone do not prove all application entry points are
offline.

## 12. SQLSTATE Review

Confirmed by static source:

- FileVersion DELETE is caught first by a BEFORE identity Trigger, `42501`.
- Intent DELETE is caught by the BEFORE upload-intent guard, `42501`.
- `existingFileId` UPDATE is caught by phase32 identity guard, `42501`.
- expected-current UPDATE is caught by target-slot guard, `23514`.
- Pair CHECK violation is `23514`.
- unique violation is `23505`.
- FK violation is `23503`.
- Migration `NOWAIT` conflict is `55P03`.
- deadlock victim is `40P01`.

For the new completion guard, the expected failure should be:

```text
23514
```

with a unique custom message such as:

```text
completed Intent current pointer mismatch
```

Tests must capture the first error and ensure no earlier check masks the target
case.

## 13. Historical Finding Tracker

| Finding | Independent status | Basis |
|---|---|---|
| `CM1-R2-IReview-P1-01` | `RESOLVED` | R4 provenance model retained |
| `CM1-R2-IReview-P2-01` | `RESOLVED` | stale PENDING classification |
| `CM1-R2-IReview-P2-02` | `NOT VERIFIED` | generated SQL not executed |
| `CM1-R2-IReview-P2-03` | `PARTIALLY RESOLVED` | matrix broadened but incomplete |
| `CM1-R2-IReview-P3-01` | `RESOLVED` | split entry Trigger design |
| `R3-P1-01` | `RESOLVED` | new-File origin relation |
| `R3-P1-02` | `PARTIALLY RESOLVED` | final re-read fixed; completed current gap remains |
| `R3-P2-01` | `PARTIALLY RESOLVED` | Runbook designed; no operational evidence |
| `R3-P2-02` | `PARTIALLY RESOLVED` | SQLSTATE/target matrix incomplete |
| `R5-P1-01` | `RESOLVED` | stable identity + final File re-read |
| `R5-P2-01` | `PARTIALLY RESOLVED` | 36 rows designed, new completion case missing |
| `R5-P2-02` | `PARTIALLY RESOLVED` | Runbook design complete, execution not |
| binding-parent-chain duplicate | `NOT VERIFIED` | unchanged |
| orphan FileVersion | `NOT VERIFIED` | unchanged |
| multiple FileVersion terminal | `NOT VERIFIED` | unchanged |
| `P2-05` | `OPEN` | unchanged |
| R5 57 Open Decisions | `OPEN` | unchanged |
| BV7 | `FAIL` | unchanged |
| BV8 | `NOT VERIFIED` | unchanged |
| historical R8 | `BLOCKED` | unchanged |
| live Web/Worker + PostgreSQL | `NOT VERIFIED` | unchanged |
| real Provider | `NOT VERIFIED` | unchanged |
| Windows OS fencing | `NOT VERIFIED` | unchanged |
| IAM/ACL | `NOT VERIFIED` | unchanged |
| production migration/deployment | `BLOCKED` | unchanged |

## 14. New Findings

### R7-P1-01 — Completed Append current pointer is unchecked

Severity:

```text
P1
```

A direct Append completion can commit without updating `File.currentVersionId`.
The missing check is described in §6.

Correction:

- add a deferred completion-transition guard;
- identify completion via event OLD/NEW status only;
- re-read final Intent/File/FileVersion;
- require current pointer equality;
- do not enforce this globally on historical completed Intents.

### R7-P2-01 — Isolation level is not explicitly fixed for upload flow

Severity:

```text
P2
```

The upload transactions rely on the database default. It must be recorded and
tested; stronger isolation must map `40001` to controlled retry.

### R7-P2-02 — Test matrix retains ambiguous umbrella rows

Severity:

```text
P2
```

Specific SQL/control/SQLSTATE must be supplied for delete, FK and direct-DML
rows.

### R7-P2-03 — Runbook operational evidence remains external

Severity:

```text
P2
```

No evidence yet proves old instances, schedulers, restart and external clients
are disabled.

## 15. NOT VERIFIED / BLOCKED

```text
PostgreSQL deferred Trigger execution:          NOT VERIFIED
Effective upload isolation level:               NOT VERIFIED
Prisma generated SQL/Client behavior:           NOT VERIFIED
36-case behavior matrix execution:              NOT VERIFIED
Post-DDL Migration rollback:                    NOT VERIFIED
P3018/P3009 for R6 Migration:                   NOT VERIFIED
Operational drain/auto-restart evidence:        NOT VERIFIED
historical new-File provenance on a real DB:    NOT VERIFIED
live Web/Worker PostgreSQL integration:         NOT VERIFIED
real Provider:                                  NOT VERIFIED
Windows OS fencing:                             NOT VERIFIED
IAM/ACL:                                        NOT VERIFIED
E2E/deployment:                                 NOT VERIFIED
production migration:                           BLOCKED
```

## 16. Required Controlled PostgreSQL Validation

1. Compile final Trigger functions in isolated PostgreSQL 18.
2. Verify Constraint Trigger events, deferrability and final-state visibility.
3. Execute the missing completion-pointer cases.
4. Execute all R6 rows plus R7 completion/delete/FK additions.
5. Test multiple updates, SAVEPOINT, `SET CONSTRAINTS`.
6. Test two-Session active/finalization/current races under each supported
   isolation level.
7. Confirm no stale UPLOADING and no inconsistent COMPLETED Append.
8. Verify first SQLSTATE/control and final row state.
9. Verify Prisma-generated SQL and Client relations.
10. Verify empty/non-empty Migration and `_prisma_migrations`.
11. Execute the Runbook only in a separately authorized isolated maintenance
    drill.
12. Keep Provider, Windows, IAM/ACL and production out of scope.

## 17. Git State at Review End

Only this review report is added.

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  81
Untracked files:        82
New report:             docs/architecture/wp-2a-cm1-append-intent-relational-integrity-independent-review-r7.md
```

No source, Schema, Migration, SQL, Trigger, test, configuration, database or
existing report was modified.

## 18. Report Metadata

Final SHA-256, byte count and line count are recorded in the delivery response.

Static checks:

```text
Markdown fences:      balanced
Trailing whitespace: none
PostgreSQL execution: none
Build/test execution: none
Provider access:      none
```

## 19. Final Decision

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

R6 correctly fixes stale event-local File state. It does not yet close the
completed Append current-pointer invariant, so R3-P1-02 and R5-P2-01 remain
partially resolved.
