# WP-2A-CM1 Append Intent Relational Integrity Remediation Design R12

## 0. Final conclusion

```text
DESIGN COMPLETE — READY FOR INDEPENDENT REVIEW
```

R12 closes `R11-P1-01` and `R11-P1-02` by design without reopening Route C or
replacing R8. Source and PostgreSQL behavior remain `NOT VERIFIED`.

The correction consists of:

1. a completion-provenance guard for both N/N and Append completion;
2. one deferred final-state completion guard shared by both paths;
3. immutable File business scope and creator fields;
4. a deterministic historical precheck that runs before all DDL;
5. test-source requirements that isolate the intended first rejection control.

## 1. Scope and baselines

Inputs verified:

```text
R11 SHA-256 D1136571FB17D399250F4C365AAC73C722650EA6C90C3D407A406D950339BAF9
R8  SHA-256 1D5331C62553A2B3C38466B6D6FFC0B10FA25735147E61CA58470CD539502FCC
R10 SHA-256 29EE0315E5CBDCD64FAC8AF5F55A897B63B2A44AC27642B7B2F6CAAD708F08E4
```

Reviewed:

```text
prisma/schema.prisma
phase 3.1 file/version constraints
phase 3.2 Intent completion guard
phase 3.7 P1-3 chain
phase 3.8 active Append and target-slot guards
R10 phase 3.9 Migration
upload-service.ts
object-upload-service.ts
R10 static tests
R10 PostgreSQL integration test source
```

R12 is design-only. No source, Schema, Migration, test, database or runtime
operation was performed.

## 2. Current source fact basis

The real authoritative fields remain:

```text
File.createdByUploadIntentId
File.customerId
File.projectId
File.buildingId
File.installationUnitId
File.createdById
File.currentVersionId

FileUploadIntent.existingFileId
FileUploadIntent.expectedCurrentFileVersionId
FileUploadIntent.completedFileVersionId
FileUploadIntent.status

FileVersion.id
FileVersion.fileId
FileVersion.versionNumber
FileVersion.uploadIntentId
```

R10 already supplies:

- the unique File origin relation;
- Compound expected-current and completed-target FKs;
- File INSERT origin guard;
- deferred Append expected-current guards;
- completed-target immutability;
- deferred latest-current guard;
- explicit Read Committed on all 12 upload interaction transactions.

R12 retains all of these.

## 3. R11-P1-01 root cause

The existing deferred completion guard classifies an Intent transition and
then returns for N/N Intents.

The new-File terminal guard is attached only to:

```text
AFTER INSERT ON file
```

It therefore cannot observe a later FileVersion INSERT under a File that
already exists without the File's own INSERT event.

The P1-3 upload chain verifies Attempt/Lifecycle/Operation/FileVersion
identity, but not that the FileVersion's File was created by the N/N Intent.

This permits:

```text
existing File F
-> valid N/N Intent I
-> valid FileVersion FV under F
-> Intent COMPLETED target FV
-> File current unchanged
-> COMMIT
```

No source trigger closes this path. This is the reason completion must be
checked at the Intent completion event itself, using final transaction rows.

## 4. Unified completion invariant

Let:

```text
I  = persisted FileUploadIntent
FV = persisted completed FileVersion
F  = persisted FileVersion.file
```

Every transition into `COMPLETED` must satisfy this final-state expression:

```text
I.status = 'COMPLETED'
AND FV.uploadIntentId = I.id
AND FV.fileId = F.id
AND F.currentVersionId = FV.id
AND FV.versionNumber = max(versionNumber for all FileVersions of F)
AND (
  (
    I.existingFileId IS NULL
    AND I.expectedCurrentFileVersionId IS NULL
    AND F.createdByUploadIntentId = I.id
  )
  OR
  (
    I.existingFileId IS NOT NULL
    AND F.id = I.existingFileId
  )
)
```

This is the shared completion rule. N/N and Append differ only in how File
ownership is proven:

| Path | File ownership proof |
|---|---|
| N/N | `F.createdByUploadIntentId = I.id` |
| Append | `F.id = I.existingFileId` |

Both paths require the same target, current and latest-version results.

This invariant is checked twice:

1. immediately when a completed target is first assigned, for stable
   provenance/ownership that does not depend on later pointer order;
2. at COMMIT using deferred final rows, for current and latest-version
   consistency.

## 5. R11-P1-01 correction design

### 5.1 Immediate completion-provenance guard

Replace the phase 3.2 `validate_upload_intent_completion()` implementation
through a new forward migration.

Required checks when `NEW.completedFileVersionId` is non-null:

- Intent status is COMPLETED;
- target FileVersion exists;
- target FileVersion.uploadIntentId equals the Intent ID;
- target FileVersion.fileId equals its target File;
- target File project/building/unit equals Intent project/building/unit;
- for Append, target File ID equals `existingFileId`;
- for N/N, target File `createdByUploadIntentId` equals the Intent ID.

The N/N provenance failure uses:

```text
SQLSTATE 42501
message: new-file Intent completion provenance mismatch
```

This guard does not require File current to equal the target yet. That permits
the legal completion-first transaction order.

It does not trust the event image for relationships. It re-queries the target
FileVersion and File.

### 5.2 Deferred unified completion guard

Create:

```text
p13_assert_completed_intent_final()
p13_completed_intent_final_guard
AFTER UPDATE ON file_upload_intent
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
```

The event images are used only to identify `UPLOADING -> COMPLETED`.

At deferred execution the function:

1. re-reads the final Intent by primary key;
2. requires final status COMPLETED;
3. re-reads the final completed FileVersion;
4. re-reads the final File by `FileVersion.fileId`;
5. computes the final maximum FileVersion.versionNumber for that File;
6. applies the full unified invariant from section 4.

Required failures:

```text
missing/wrong target:
  SQLSTATE 23514
  message: completed Intent target chain mismatch

N/N origin mismatch:
  SQLSTATE 42501
  message: completed new-file Intent provenance mismatch

current/latest mismatch:
  SQLSTATE 23514
  message: completed Intent current pointer mismatch
```

The old R10 completion guard is retired in the forward correction migration
after its replacement is created and postchecked. No duplicate completion
events are required.

### 5.3 Event coverage rationale

The deferred check is attached to Intent completion because every successful
completion creates exactly that event.

The FileVersion-side P1-3 deferred chain already rejects:

- FileVersion without a valid Attempt/Lifecycle/Operation;
- a second FileVersion for a COMPLETED Intent;
- FileVersion target/uploadIntent mismatch.

The File-side latest guard already rejects later current regression and
uncompleted current targets.

Therefore a FileVersion-side completion trigger is not required in the
minimal design. It remains an additional defense-in-depth option for
PostgreSQL review.

### 5.4 Legal transaction orders

Append:

```text
UPDATE File current = FV1
UPDATE Intent COMPLETED target = FV1
COMMIT
```

and:

```text
UPDATE Intent COMPLETED target = FV1
UPDATE File current = FV1
COMMIT
```

both pass because the deferred guard re-reads the final rows.

New File:

```text
INSERT File with origin I
INSERT FileVersion under that File
UPDATE Intent COMPLETED target = FV1
UPDATE File current = FV1
COMMIT
```

and the same sequence with current updated before Intent completion both pass.

### 5.5 Rejected sequences

```text
N/N target under an unrelated existing File
N/N target under a File created by another Intent
higher FileVersion inserted without current advance
Intent completed while final current is another version
current points to an uncompleted max version
two Intent completions left inconsistent with final current
```

Each sequence must roll back through the first applicable guard and leave no
partial File, FileVersion or Intent completion.

## 6. R11-P1-02 correction design

The following File columns become immutable after INSERT:

```text
customerId
projectId
buildingId
installationUnitId
createdById
```

`createdByUploadIntentId` remains protected by its existing immutability
Trigger. The new scope guard also checks it so a combined UPDATE cannot depend
on trigger ordering.

Rules:

| Transition | Decision |
|---|---|
| same value | allowed |
| non-NULL -> NULL | rejected |
| NULL -> non-NULL | rejected |
| non-NULL -> different non-NULL | rejected |
| combined scope moves | rejected atomically |
| single-row UPDATE | rejected |
| multi-row UPDATE | rejected per row |
| FK cascade attempts to change value | expected rejected |

There is no ordinary business requirement in the confirmed current product to
move a File between projects, buildings, units, customers or creators. A future
transfer/reassignment workflow requires its own audited protocol and must
preserve origin history.

Proposed guard:

```sql
CREATE FUNCTION p13_protect_file_provenance_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."customerId" IS DISTINCT FROM OLD."customerId"
     OR NEW."projectId" IS DISTINCT FROM OLD."projectId"
     OR NEW."buildingId" IS DISTINCT FROM OLD."buildingId"
     OR NEW."installationUnitId"
        IS DISTINCT FROM OLD."installationUnitId"
     OR NEW."createdById" IS DISTINCT FROM OLD."createdById"
     OR NEW."createdByUploadIntentId"
        IS DISTINCT FROM OLD."createdByUploadIntentId"
  THEN
    RAISE EXCEPTION 'File provenance scope is immutable'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
```

Trigger:

```sql
CREATE TRIGGER p13_file_provenance_scope_immutable
BEFORE UPDATE OF
  "customerId",
  "projectId",
  "buildingId",
  "installationUnitId",
  "createdById",
  "createdByUploadIntentId"
ON "file"
FOR EACH ROW
EXECUTE FUNCTION p13_protect_file_provenance_scope();
```

The rule applies to database users and direct DML. No Session GUC, application
flag or runtime waiver is introduced.

Legacy rows are frozen from the Migration onward. No historical field is
backfilled or guessed.

## 7. Trigger and constraint coverage matrix

| Table/event | Control | Timing | Responsibility |
|---|---|---|---|
| Intent INSERT | phase 3.7 PENDING guard | BEFORE | creation shape |
| Intent target assignment | extended completion provenance | BEFORE UPDATE | same Intent/File origin |
| Intent status transition | phase 3.7 state guard | BEFORE | allowed transition |
| Intent `UPLOADING -> COMPLETED` | unified completion guard | deferred | final current/latest/owner proof |
| Intent COMPLETED history | completed-history guard | BEFORE UPDATE | target/history immutability |
| File INSERT with origin | File origin guard | BEFORE | legal N/N Intent/scope/actor |
| File scope/creator UPDATE | new immutability guard | BEFORE UPDATE | stable business identity |
| File INSERT origin chain | created-file terminal guard | deferred | origin File reaches one valid version |
| File INSERT/UPDATE | active Append current guard | deferred | UPLOADING expected-current |
| File INSERT/UPDATE | latest completed current guard | deferred | current=max and completed owner |
| FileVersion INSERT/UPDATE | P1-3 storage/lifecycle guard | BEFORE/deferred | exact Attempt/Lifecycle/Operation |
| FileVersion UPDATE/DELETE | original identity guard | BEFORE | immutable version, no delete |
| Intent/Attempt/FileVersion/Lifecycle chain | TRUNCATE guards | BEFORE TRUNCATE | no bulk destruction |
| Completed same-File FK | FK | deferred | Append target belongs File |
| Expected-current same-File FK | FK + pair CHECK | deferred/CHECK | no cross-File or partial-pair bypass |

No deferred guard may use mutable business values copied from OLD or NEW.
Event images supply stable row identity and transition classification only.

## 8. Concurrency and lock analysis

### 8.1 Two Append reservations

```text
A: BEGIN
   reserve Intent A -> UPDATE Intent lock
   File F FOR UPDATE in reservation guard
   hold one UPLOADING slot

B: BEGIN
   reserve Intent B -> waits for File or unique slot
```

Expected:

- one active Append reservation;
- loser rejected by `one_active_append_intent_per_file` or stale
  expected-current guard;
- loser cannot create a FileVersion or move File current.

### 8.2 Completion versus next Append

```text
Completion:
  File FOR UPDATE -> new FileVersion -> File current -> Intent COMPLETED

Creation of next Append:
  File FOR SHARE or waits
```

After completion commits, a new Intent must use the new current version.
An earlier pending snapshot becomes stale and cannot reserve.

### 8.3 Current pointer versus completion

The unified guard runs at COMMIT and re-reads:

```text
final Intent
final FileVersion
final File
final max(versionNumber)
```

READ COMMITTED alone is not treated as concurrency proof. The design retains:

- File row locks;
- Intent row locks/CAS;
- active Append partial unique index;
- deferred final-state checks;
- existing fencing and lease checks for object upload.

### 8.4 File scope update

A direct scope UPDATE obtains the File row lock. Concurrent scope updates
serialize. The first attempted change fails; the second evaluates against the
unchanged old row and fails for the same guard.

### 8.5 Remaining PostgreSQL question

The exact behavior of FK cascades when parent IDs change and the exact ordering
of deferred constraint triggers remain `NOT VERIFIED` until real PostgreSQL
testing.

## 9. Migration correction design

R12 correction is a new forward-only phase-40 Migration. R10 phase 3.9 is not
edited.

The Migration is offline. Web, Worker, schedulers and retry executors remain
drained.

### 9.1 Lock order

Required lock order:

```text
project
-> file_version
-> file
-> file_upload_intent
```

All are acquired `ACCESS EXCLUSIVE NOWAIT`.

`project` is included because the historical precheck compares
`Project.customerId` with File customer scope. The original three-table core
order remains unchanged relative to each other.

### 9.2 Precheck categories

The precheck runs after locks and before any function/trigger DDL.

| Category | Failure |
|---|---|
| malformed expected pair | fail |
| dangling expected version | fail |
| cross-File expected version | fail |
| active Append expected != current | fail |
| completed target missing/wrong Intent | fail |
| Append completed target wrong File | fail |
| Append expected version not before completed version | fail |
| non-NULL origin does not match Intent scope/actor | fail |
| non-NULL origin Intent is not a completed new-File Intent | fail |
| versioned File has NULL current | fail |
| current pointer is not max version | fail |
| current version has no completed Intent owner | fail |
| N/N completed target has NULL origin | record legacy-unverified |
| N/N completed target has conflicting non-NULL origin | fail |

Legacy-unverified rows are not auto-repaired, published, rebound or advanced.
They remain historical evidence. The precheck reports counts and sample IDs.

No runtime waiver lets a new N/N completion omit origin.

### 9.3 Precheck output

On failure, return one `23514` containing:

```text
category
count
bounded sample of File/Intent/FileVersion IDs
```

No full sensitive payload or filesystem path is emitted.

### 9.4 DDL sequence

After a clean precheck:

1. replace completion-provenance function;
2. create unified deferred completion function;
3. drop the R10 Append-only completion constraint trigger;
4. create unified completion constraint trigger;
5. create File provenance-scope function and Trigger;
6. add catalog postchecks.

Failure after precheck must roll back the whole forward correction.

### 9.5 Postchecks

Verify:

- old Append-only completion trigger is absent;
- unified completion trigger exists on `file_upload_intent`, deferred;
- extended provenance function exists;
- File provenance-scope Trigger exists with correct events;
- original FKs/CHECKs remain present;
- no constraint or trigger is disabled.

## 10. Prisma Schema and service impact

No new column, enum or Prisma relation is required.

The design uses existing fields and manual PostgreSQL triggers/FKs. Prisma
Client models remain aligned with R10.

Service source changes are not required for the P1 correction because:

- both File creation paths already write `createdByUploadIntentId`;
- both finalization paths update current and complete the Intent in one
  Read Committed transaction;
- no current business action changes File scope or creator.

Future implementation must still add tests proving those source properties
remain true.

## 11. Test matrix

### 11.1 Completion and provenance

| ID | Scenario | First control | SQLSTATE | Final assertion |
|---|---|---|---|---|
| `R12-T-01` | legal N/N completion | all pass | none | File/version/current/Intent exact |
| `R12-T-02` | legal Append completion | all pass | none | target/current/Append exact |
| `R12-T-03` | N/N target under unrelated existing File | immediate provenance | `42501` | no completion |
| `R12-T-04` | N/N target under another Intent's File | immediate provenance | `42501` | no completion |
| `R12-T-05` | N/N target same File but no current update | unified deferred | `23514` | rollback |
| `R12-T-06` | completed target belongs another Intent | unified deferred | `23514` | rollback |
| `R12-T-07` | higher FileVersion inserted, no current move | unified deferred | `23514` | rollback |
| `R12-T-08` | current first, completion later | all pass | none | valid |
| `R12-T-09` | completion first, current later | all pass | none | valid |
| `R12-T-10` | two completions leave final mismatch | unified deferred | `23514` | both rolled back |

To isolate the R10/R12 target guard, tests use:

```text
SET CONSTRAINTS p13_completed_intent_final_guard IMMEDIATE
```

while unrelated deferred constraint triggers remain deferred.

### 11.2 File immutability

| ID | Mutation | First control | SQLSTATE |
|---|---|---|---|
| `R12-T-11` | customerId change | scope immutability | `42501` |
| `R12-T-12` | projectId/building/unit combined move | scope immutability | `42501` |
| `R12-T-13` | createdById change | scope immutability | `42501` |
| `R12-T-14` | null/non-null scope transition | scope immutability | `42501` |
| `R12-T-15` | multi-row scope UPDATE | per-row scope immutability | `42501` |
| `R12-T-16` | parent FK cascade attempts File scope change | scope immutability | expected `42501`; DB verify |
| `R12-T-17` | update display metadata/current only | no scope guard | allowed if otherwise valid |

### 11.3 Existing first-control cases

| ID | Scenario | Control |
|---|---|---|
| `R12-T-18` | NULL completed target | unified deferred, forced immediate |
| `R12-T-19` | cross-File completed target | immediate provenance |
| `R12-T-20` | FileVersion fileId/versionNumber mutation | phase 3.1 identity |
| `R12-T-21` | completed target DELETE | FileVersion delete guard |
| `R12-T-22` | COMPLETED -> UPLOADING | phase 3.7 state guard |
| `R12-T-23` | TRUNCATE protected chain | P1-3 truncate guard |
| `R12-T-24` | File DELETE with history | FK `23503` |

### 11.4 Deferred/event tests

| ID | Scenario |
|---|---|
| `R12-T-25` | SAVEPOINT rollback discards completion event |
| `R12-T-26` | committed subtransaction retains final check |
| `R12-T-27` | `SET CONSTRAINTS IMMEDIATE` before valid final state rejects |
| `R12-T-28` | final valid state passes immediate check |
| `R12-T-29` | multiple File updates followed by final valid state |
| `R12-T-30` | Intent target/current interleaving final invalid case |

### 11.5 True two-client concurrency

Use:

```text
PrismaClient A
PrismaClient B
independent PostgreSQL sessions
explicit Node barrier
```

Reservation race:

1. create base version and two PENDING Appends with same expected-current;
2. both transactions reach a barrier;
3. both attempt PENDING -> UPLOADING;
4. commit the reservation winner without advancing current;
5. assert loser is rejected by the active partial unique index;
6. record `23505` and index name.

Stale-current race:

1. one transaction reserves and advances a File version to completion;
2. second transaction reaches the reservation guard while the first is in
   progress;
3. after winner commit, loser must fail stale expected-current `23514`;
4. no second FileVersion/current/completion remains.

Finalization race:

- each client preallocates distinct version numbers inside its own transaction;
- explicit barrier proves both transactions entered the target window;
- exactly one final current/Intent/FV chain commits;
- loser control is recorded separately from unique-key collisions.

## 12. Historical finding disposition

| Finding | Design disposition |
|---|---|
| `R11-P1-01` | `RESOLVED BY DESIGN` |
| `R11-P1-02` | `RESOLVED BY DESIGN` |
| R8 completed/current invariant | completed for both N/N and Append by design |
| `R9-P2-01` | complete test design supplied; source not changed |
| `R9-P2-02` | existing source retained; runtime not verified |
| `R9-P2-03` | `NOT VERIFIED` |
| `R7-P2-02` | first-control matrix supplied |
| `R7-P2-03` | operational evidence still absent |
| `R5-P2-01` | complete matrix supplied |
| `R5-P2-02` | evidence requirements retained |
| `R3-P1-02` | completed by unified N/N/Append final guard design |
| `R3-P2-01` | offline Migration design retained |
| `R3-P2-02` | SQLSTATE/control matrix expanded |
| `CM1-R2-IReview-P2-02` | `NOT VERIFIED` |
| `CM1-R2-IReview-P2-03` | test design complete; execution absent |

External restrictions remain:

```text
binding-parent-chain duplicate:        NOT VERIFIED
orphan FileVersion:                    NOT VERIFIED
multiple FileVersion terminal matrix:  NOT VERIFIED
P2-05:                                OPEN
R5 57 decisions:                      OPEN
BV7:                                  FAIL
BV8:                                  NOT VERIFIED
historical R8:                        BLOCKED
real Provider:                        NOT VERIFIED
Windows OS fencing:                   NOT VERIFIED
IAM/ACL:                              NOT VERIFIED
live Web/Worker PostgreSQL:           NOT VERIFIED
real drain:                           NOT VERIFIED
production Migration:                 BLOCKED
```

## 13. NOT VERIFIED and implementation prerequisites

```text
PL/pgSQL compilation:                       NOT VERIFIED
deferred trigger firing order:              NOT VERIFIED
FK cascade versus File immutability Trigger: NOT VERIFIED
actual Read Committed server state:          NOT VERIFIED
two-client concurrency:                      NOT VERIFIED
Migration precheck overlap/locking:          NOT VERIFIED
Migration rollback:                          NOT VERIFIED
Prisma `_prisma_migrations` failure state:    NOT VERIFIED
historical legacy inventory:                  NOT VERIFIED
Prisma Schema final migration diff:           NOT VERIFIED
live Web/Worker database integration:         NOT VERIFIED
Provider/Windows/IAM/ACL/E2E/deployment:     NOT VERIFIED
```

The next source implementation is not authorized by this report.

## 14. Git state

Before R12:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      88
Untracked files:        89
```

After adding this report:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      89
Untracked files:        90
New report:             docs/architecture/wp-2a-cm1-append-intent-relational-integrity-remediation-design-r12.md
```

No source, Schema, Migration, test or existing report was changed.

## 15. Report metadata

```text
Database connection:     none
SQL/Migration execution: none
Build/E2E execution:     none
Provider access:         none
Git write:               none
Worktree cleanup:        none
```

The final SHA-256, byte count and line count are reported in the delivery
response because a file cannot contain its own stable final SHA-256.

## 16. Final design decision

```text
DESIGN COMPLETE — READY FOR INDEPENDENT REVIEW
```

R12 is the minimal correction to R8/R10. It unifies completion invariants for
N/N and Append, freezes File business provenance, adds deterministic historical
prechecks and specifies executable first-control and two-client tests.
