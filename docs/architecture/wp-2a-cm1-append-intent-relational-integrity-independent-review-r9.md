# WP-2A-CM1 — Append Intent Relational Integrity Independent Review R9

## 0. Final Conclusion

```text
PASS WITH RESTRICTIONS — DESIGN APPROVED WITH EXPLICIT LIMITATIONS
```

R8 closes the R7 P1 in design:

- the real completed target is `completedFileVersionId`;
- an Append completion must reference a same-File FileVersion;
- the completion-transition guard re-reads final state at COMMIT;
- the completed target becomes immutable after completion;
- a latest-completed File current guard prevents regression to an old or
  uncompleted version.

No PostgreSQL, Prisma, Build or runtime test was performed. Approval is limited
to controlled implementation after the mandatory PostgreSQL validation listed
in this report.

## 1. Document Control

Reviewed:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-remediation-design-r8.md
SHA-256 1D5331C62553A2B3C38466B6D6FFC0B10FA25735147E61CA58470CD539502FCC
22,844 bytes
807 lines
```

The file matches the supplied baseline.

Reviewed or rechecked:

```text
R1-R7 design and review chain
current Prisma Schema
all CM1/P1-3 upload-related Migrations
upload and object-upload services
completion guard and P1-3 chain guard
current tests and controlled PostgreSQL evidence
```

## 2. Git State at Review Start

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  82
Untracked files:        83
```

Git was inspected using a command-local `safe.directory`. No Git configuration
was changed.

## 3. R8 Design Summary

R8 uses current fields:

```text
File.currentVersionId
FileVersion.id
FileVersion.fileId
FileVersion.versionNumber
FileUploadIntent.existingFileId
FileUploadIntent.expectedCurrentFileVersionId
FileUploadIntent.completedFileVersionId
```

No non-existent `completedTargetFileVersionId` field is assumed.

Proposed mechanisms:

1. completed same-File compound FK;
2. deferred completion-transition guard;
3. completed-target immutability;
4. post-completion latest-current guard;
5. explicit `READ COMMITTED` upload transactions;
6. split single-purpose tests;
7. Migration evidence checklist.

## 4. R7 Finding Revalidation

| Finding | Independent result | Status |
|---|---|---|
| `R7-P1-01` completed current mismatch | completion transition and latest-current guards close the logical gap | `RESOLVED` by design |
| `R7-P2-01` implicit isolation | explicit READ COMMITTED protocol selected | `RESOLVED` by design; source not changed |
| `R7-P2-02` ambiguous tests | much improved, but several required cases are still missing | `PARTIALLY RESOLVED` |
| `R7-P2-03` drain evidence | evidence checklist complete; no operational evidence exists | `PARTIALLY RESOLVED` |

## 5. Completed State Integrity

### 5.1 Real target field

The authoritative target is:

```text
FileUploadIntent.completedFileVersionId
```

It is nullable in the current Schema and unique.

Current source binds it when Intent transitions to COMPLETED:

```text
upload-service.ts:1217-1229, 2261-2272
object-upload-service.ts:1097-1109
```

### 5.2 Same-File target

The proposed compound FK:

```text
(completedFileVersionId, existingFileId)
  -> file_version(id, fileId)
```

is correct for Append. The existing single-column FK remains for existence:

```text
completedFileVersionId -> file_version(id)
```

For a new-File N/N Intent, the compound FK is skipped and the existing
File-origin rules enforce creation provenance.

### 5.3 Completion transition guard

The guard:

```text
R8 design: 203-264
```

is correctly deferred. At COMMIT it re-reads:

```text
Intent
FileVersion
File
```

and requires:

```text
FileVersion.fileId = File.id
File.currentVersionId = Intent.completedFileVersionId
```

for an Append completion.

### 5.4 Completed target immutability

R8 requires these fields not to change after COMPLETED:

```text
completedFileVersionId
completedAt
existingFileId
expectedCurrentFileVersionId
```

This is required because a later Append may legitimately advance the File
current pointer; historical completed Intents must not be rewritten to chase
the new current.

### 5.5 Null and wrong target

- `COMPLETED` + NULL completed target: rejected by the P1-3 completed chain and
  R8 completion guard.
- target of another File: existing immediate completion ownership guard emits
  `42501`; completed compound FK is backup.
- missing target: existing completion guard `42501` before FK.
- old same-File target: deferred completion guard `23514`.
- target belonging same File but another Intent: P1-3 chain guard `23514`.

Runtime SQLSTATE/order remains `NOT VERIFIED`.

## 6. Latest-Completed Current Guard

### 6.1 Latest definition

R8 defines latest by:

```text
FileVersion.versionNumber
```

This is an immutable, DB-authoritative, per-File unique business sequence:

```text
UNIQUE (fileId, versionNumber)
```

It does not rely on timestamps, client values or mutable display fields.

### 6.2 Guard behavior

The proposed guard:

```text
R8 design: 316-397
```

re-reads final File and versions when current changes, requiring:

```text
current != NULL
current belongs to File
current.versionNumber = max(versionNumber for File)
current has a COMPLETED Intent for that File
```

### 6.3 Coverage

| Mutation | Control |
|---|---|
| File current update | latest-current guard |
| Append completion | completion transition guard |
| FileVersion INSERT | P1-3 chain requires matching completion/current |
| FileVersion fileId/version UPDATE | existing identity guard |
| FileVersion DELETE | existing BEFORE Trigger `42501` |
| Intent target mutation | completed-target immutability |
| Intent DELETE | existing Intent guard |
| TRUNCATE | existing chain TRUNCATE guards/FKs |

The latest guard runs only when current changed, so unrelated legacy File
metadata updates are not retroactively rejected.

### 6.4 Normal version progression

```text
V1 complete/current
-> V2 complete/current
-> V3 complete/current
```

Each transition is legal.

```text
V2 current -> V1
```

is rejected because V1 is not max version and cannot be the current completed
target under this model.

### 6.5 Existing legacy Files

Legacy current pointers are not rewritten or backfilled by the trigger. The
guard applies when current changes. A future Append must create the next max
version and complete it atomically.

## 7. Direct DML and Transaction Revalidation

### 7.1 Complete without current

```text
Intent UPLOADING expected=FV0
completedFileVersionId=FV1
File.currentVersionId=FV0
COMMIT
```

Deferred completion guard:

```text
23514
```

No false COMPLETED state commits.

### 7.2 Current without completion

```text
File.currentVersionId=FV1
Intent remains UPLOADING expected=FV0
```

R6 active guard:

```text
23514
```

Current with no active Append but no completed Intent is rejected by the
latest-completed guard.

### 7.3 Both orders in one transaction

```text
File current first -> Intent COMPLETED
```

and:

```text
Intent COMPLETED first -> File current
```

both pass when final state is `current = completedFileVersionId`.

### 7.4 Two completed targets in one transaction

```text
Intent A -> FV1
Intent B -> FV2
current final FV2
```

A's deferred completion check re-reads final current FV2 and its target FV1:

```text
23514
```

The transaction rolls back.

### 7.5 Completed target changed later

The completed-target immutability trigger rejects with `42501`.

### 7.6 Current regressed after completion

The latest-current guard rejects with `23514`.

## 8. READ COMMITTED and MVCC

### 8.1 Selected level

R8 selects explicit:

```text
Prisma.TransactionIsolationLevel.ReadCommitted
```

for all interactive upload transactions that reserve, finalize, fail or
recover File/Intent/Version state.

Single-statement writes remain implicitly atomic and are guarded by DB
Triggers.

Raw SQL inside these transactions inherits Read Committed.

### 8.2 Why Read Committed is sufficient

- File current update holds a File row lock.
- Reservation holds File `FOR UPDATE`.
- Append creation holds File `FOR SHARE`.
- Active slot is unique.
- completion and current guards re-read final state at COMMIT.
- every cross-table invariant has an authoritative write-phase lock and/or
  final DB check.

Stronger isolation would add serialization retries without removing the need
for these database guards.

### 8.3 Snapshot behavior

Each Read Committed statement sees data committed before the statement starts
plus its own transaction writes. A deferred guard executing at COMMIT sees the
transaction's final own writes.

A concurrent uncommitted update cannot be ignored if it later commits without
its own guard: every File current update and Intent transition queues the same
final-state checks.

### 8.4 Required source evidence

Current source does not explicitly set upload isolation:

```text
upload-service.ts:1049, 2150
object-upload-service.ts:929
```

Future implementation must update all relevant interactive transactions and
add a representative:

```text
SHOW transaction_isolation
```

test expecting `read committed`.

Status:

```text
source change: NOT IMPLEMENTED
runtime isolation: NOT VERIFIED
```

## 9. Concurrency Timelines

### 9.1 Two Append completions for one File

```text
Session A:
BEGIN READ COMMITTED
claim Operation/Lifecycle
File F FOR UPDATE
create V1
current=V1
Intent A=COMPLETED target=V1
COMMIT

Session B:
BEGIN READ COMMITTED
claim Operation/Lifecycle
wait File F
after A:
  fencing/CAS count=0
ROLLBACK
```

Expected one completed version/intent.

If B is a stale old execution of a different attempt, unique currentAttempt/
uploadAttempt and fencing reject it.

### 9.2 Completion guard vs concurrent current update

```text
A:
BEGIN
File FOR UPDATE
create V1
current=V1
Intent=COMPLETED
COMMIT

B:
BEGIN
File FOR UPDATE
current=V2
...
```

B waits. After A, B sees Intent terminal and current V1. If B points to a
completed V2, it must be the next legitimate Append. If no completed target,
latest guard `23514`.

### 9.3 Completed Intent and new Append

```text
Old Intent: COMPLETED V1
New Append: expected current V1
create V2
current=V2
new Intent COMPLETED V2
COMMIT
```

Old Intent remains immutable historical evidence. New current is latest.

### 9.4 FileVersion and Intent interleaving

```text
BEGIN
create FileVersion V2
update File.current=V2
update Intent COMPLETED V2
COMMIT
```

All deferred events re-read final state. Both orders are legal if final state
matches.

### 9.5 TOCTOU after guard read

The write transaction holds the File row lock through its deferred check. A
concurrent current update must wait or fail its own final check. No unprotected
read-to-commit window was found in the proposed design.

### 9.6 Isolation variants

- Read Committed: intended application path.
- Repeatable Read: stronger snapshot may return `40001`; retry from fresh read.
- Serializable: additional serialization failures; not selected because locks
  and explicit guards already cover the invariant.
- Direct DML outside app: DB locks/constraints execute; its session isolation
  does not eliminate the final checks.

## 10. Lock Order and Deadlock

### 10.1 Two Append completions

Both use:

```text
storage rows
-> File FOR UPDATE
-> FileVersion
-> File current
-> Intent COMPLETED
-> COMMIT
```

The second waits at File or fails its ownership/CAS checks. No new lock is
taken by deferred final-state SELECTs.

### 10.2 Current vs completion

```text
Completion:
File lock -> version/current -> Intent complete

Current updater:
File lock -> current -> own deferred check
```

One waits. No File -> Intent / Intent -> File cycle is created because the
current updater does not need Intent.

### 10.3 Migration vs residual writer

```text
W: related table/row lock
M: LOCK file_version,file,file_upload_intent
   ACCESS EXCLUSIVE NOWAIT
```

Conflicting writer:

```text
M -> 55P03
no DDL
```

No wait ring is entered.

## 11. FileVersion and Completed Target Immutability

Current controls:

```text
file_version_identity_guard
p13_file_version_chain_identity_guard
p13_file_version_truncate_guard
```

plus R4/R8:

```text
completed target immutability
compound completed FK
completion/current guards
```

Expected behavior:

| Operation | Expected |
|---|---|
| FileVersion.fileId UPDATE | `42501` existing identity guard |
| FileVersion.versionNumber UPDATE | `42501` |
| FileVersion DELETE | `42501` BEFORE delete Trigger |
| completedFileVersionId -> NULL/other | `42501` R8 immutability |
| COMPLETED -> UPLOADING | `23514` existing state guard |
| completed Intent DELETE | `42501` existing delete guard |
| parent File delete | FK `23503` |

These are design expectations; PostgreSQL execution remains pending.

## 12. New File / Append Interaction

New File:

```text
N/N Intent
File.createdByUploadIntentId=I
completedFileVersionId=V1
current=V1
```

Append:

```text
existingFileId=F
expectedCurrentFileVersionId=old current
completedFileVersionId=new version under F
current=new version
```

The completed compound FK is skipped for N/N and enforced for I/I. R4 origin
rules prevent N/N completion under a pre-existing File.

Append completion cannot satisfy the new-File origin guard because it has no
`createdByUploadIntentId` relation. New File completion cannot bypass Append
expected-current because target IDs are N/N and File origin must match.

## 13. Prisma / PostgreSQL Consistency

Prisma can represent:

- one single-column completedFileVersion relation;
- File origin relation;
- expected-current compound relation.

Prisma cannot represent:

- completed same-File compound FK as a second manual constraint;
- deferrability/MATCH;
- completion/current immutability;
- latest and completion deferred guards.

Implementation must verify:

- Prisma relation compiles;
- no duplicate completed relation;
- single completed FK plus compound FK coexist;
- clean migration and non-empty migration;
- migrate diff preserves manual objects;
- Client create/update/delete calls trigger database guards.

Status:

```text
NOT VERIFIED
```

## 14. Test Matrix Review

### 14.1 R8 matrix status

R8 defines 15 focused cases. None is implemented or executed.

```text
designed: 15
implemented: 0
executed: 0
PostgreSQL verified: 0
```

### 14.2 Accepted cases

The matrix correctly covers:

- complete without pointer;
- pointer without completion;
- target other File;
- old same-File target;
- missing target;
- both transaction orderings;
- post-completion pointer regression;
- post-completion target mutation;
- two completions;
- concurrent finalizations;
- stale owner retry;
- commit response loss;
- savepoint;
- multiple deferred events.

### 14.3 Missing cases

The following are required additions:

```text
R9-T-01  COMPLETED with NULL completedFileVersionId
R9-T-02  target version belongs same File but another Intent
R9-T-03  FileVersion.fileId direct update
R9-T-04  FileVersion.versionNumber direct update
R9-T-05  completed target DELETE
R9-T-06  COMPLETED -> UPLOADING
R9-T-07  File update to an older but completed version
R9-T-08  File update to an uncompleted max version
R9-T-09  two completed Intents, last transaction complete
R9-T-10  TRUNCATE/FK behavior separately from Trigger
R9-T-11  current pointer NULL while File has versions
R9-T-12  exact constraint names for completed compound FK
```

### 14.4 First-control discipline

- Null completed target may be caught by R8 guard or P1-3 chain depending
  Trigger order; isolate.
- Wrong cross-File target may be caught by immediate completion guard before
  compound FK; test both separately.
- Target missing may be caught by completion guard `42501` before FK `23503`.
- Active F/N may be caught by custom entry Trigger before Pair CHECK.

Tests must assert the chosen target control and final state, not just an
exception.

## 15. SQLSTATE Expectations

| Case | Expected |
|---|---|
| current pointer mismatch at completion | `23514` |
| wrong/immutable completed target | `42501` |
| completed target FK violation if reached | `23503` |
| stale active Append | `23514` |
| active slot duplicate | `23505` |
| FileVersion DELETE | `42501` first |
| File DELETE restricted | `23503` |
| Migration lock `NOWAIT` | `55P03` |
| serialization/deadlock | `40001`/`40P01` |

Exact first control requires isolated tests.

## 16. Migration Drain Evidence

R8's checklist is sufficient for design:

```text
Web ingress stopped
Web instances stopped
Worker/scheduler/automatic retry stopped
auto restart/scale controlled
DB writer identities inventoried
pg_stat_activity drained
pg_prepared_xacts empty
access-exclusive locks acquired
migration exit/result recorded
_prisma_migrations before/after captured
schema/data postcheck captured
failure rollback evidence captured
old instances absent before restore
```

Automated database evidence cannot prove deployment boundaries, auto-restart,
or an as-yet-unmade connection. Those remain manual platform/operations
evidence.

No operational evidence exists yet:

```text
NOT VERIFIED
```

## 17. Historical Finding Tracker

| Finding | Status | Basis |
|---|---|---|
| `CM1-R2-IReview-P1-01` | `RESOLVED` | durable provenance |
| `CM1-R2-IReview-P2-01` | `RESOLVED` | PENDING historical policy |
| `CM1-R2-IReview-P2-02` | `NOT VERIFIED` | Prisma SQL/Client not run |
| `CM1-R2-IReview-P2-03` | `PARTIALLY RESOLVED` | tests defined, not executed |
| `CM1-R2-IReview-P3-01` | `RESOLVED` | split Trigger admission |
| `R3-P1-01` | `RESOLVED` | File origin design |
| `R3-P1-02` | `PARTIALLY RESOLVED` | completed invariant design added; runtime absent |
| `R3-P2-01` | `PARTIALLY RESOLVED` | offline protocol; ops evidence absent |
| `R3-P2-02` | `PARTIALLY RESOLVED` | test design broader; execution absent |
| `R5-P1-01` | `RESOLVED` | final File re-read |
| `R5-P2-01` | `PARTIALLY RESOLVED` | incomplete cases still |
| `R5-P2-02` | `PARTIALLY RESOLVED` | evidence checklist complete |
| `R7-P1-01` | `RESOLVED` | completion/current invariants |
| `R7-P2-01` | `RESOLVED` | explicit Read Committed design |
| `R7-P2-02` | `PARTIALLY RESOLVED` | matrix still lacks cases |
| `R7-P2-03` | `PARTIALLY RESOLVED` | no actual drain evidence |
| binding-parent-chain duplicate | `NOT VERIFIED` | unchanged |
| orphan FileVersion | `NOT VERIFIED` | unchanged |
| multiple FileVersion terminal | `NOT VERIFIED` | unchanged |
| `P2-05` | `OPEN` | unchanged |
| R5 57 decisions | `OPEN` | unchanged |
| BV7 | `FAIL` | unchanged |
| BV8 | `NOT VERIFIED` | unchanged |
| historical R8 | `BLOCKED` | unchanged |
| real Provider | `NOT VERIFIED` | unchanged |
| Windows OS fencing | `NOT VERIFIED` | unchanged |
| IAM/ACL | `NOT VERIFIED` | unchanged |
| live Web/Worker PG | `NOT VERIFIED` | unchanged |
| production deployment | `BLOCKED` | unchanged |

## 18. New Findings

### R9-P2-01 — Negative test matrix is incomplete

Severity:

```text
P2
```

Missing NULL target, different Intent target, FileVersion identity mutation,
target DELETE, state reversion, uncompleted current, NULL current, and
TRUNCATE/FK cases.

### R9-P2-02 — READ COMMITTED source implementation is absent

Severity:

```text
P2
```

The design selects it, but no existing upload transaction has the option.

### R9-P2-03 — Drain evidence is only a checklist

Severity:

```text
P2
```

No actual instance, scheduler, auto-restart or DB-writer evidence exists.

No new P1 was found.

## 19. NOT VERIFIED / BLOCKED

```text
PostgreSQL completed/latest guards:          NOT VERIFIED
PostgreSQL Deferred Trigger semantics:       NOT VERIFIED
READ COMMITTED upload source implementation: NOT VERIFIED
Prisma generated SQL / Client behavior:      NOT VERIFIED
R8/R9 test behavior:                         NOT VERIFIED
Migration rollback/P3018/P3009:              NOT VERIFIED
Actual drain/auto-restart evidence:          NOT VERIFIED
historical File provenance on real DB:       NOT VERIFIED
live Web/Worker PostgreSQL integration:      NOT VERIFIED
real Provider:                               NOT VERIFIED
Windows OS fencing:                          NOT VERIFIED
IAM/ACL:                                     NOT VERIFIED
E2E/deployment:                              NOT VERIFIED
production migration:                        BLOCKED
```

## 20. Required Controlled PostgreSQL Validation

1. Compile completed FK, completion guard, immutability and latest guards.
2. Verify catalog definitions and event timing.
3. Execute all R8/R9 completion cases and both transaction orders.
4. Verify latest definition by immutable versionNumber.
5. Test FileVersion identity/delete and completed target mutation.
6. Test multiple events, savepoints and `SET CONSTRAINTS`.
7. Test two-Session finalization/current races under all supported isolation
   levels.
8. Verify every upload interaction explicitly reports `read committed`.
9. Verify Prisma-generated relational SQL and Client behavior.
10. Verify clean/non-empty Migration and `_prisma_migrations`.
11. Run the offline migration evidence drill.
12. Keep Provider, Windows, IAM/ACL and production out of scope.

## 21. Git State at Review End

Only this review report is added.

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  83
Untracked files:        84
New report:             docs/architecture/wp-2a-cm1-append-intent-relational-integrity-independent-review-r9.md
```

No source, Schema, Migration, SQL, Trigger, test, configuration, database or
existing report was modified.

## 22. Report Metadata

Final SHA-256, byte count and line count are recorded in the delivery response.

Static checks:

```text
Markdown fences:      balanced
Trailing whitespace: none
PostgreSQL execution: none
Build/test execution: none
Provider access:      none
```

## 23. Final Decision

```text
PASS WITH RESTRICTIONS — DESIGN APPROVED WITH EXPLICIT LIMITATIONS
```

R8's completion design is logically sound. Approval is restricted to controlled
implementation after mandatory PostgreSQL validation and completion of the
missing negative-test matrix and operational evidence.
