# WP-2A-CM1 — Append Intent Relational Integrity Independent Review R5

## 0. Final Conclusion

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

The new-File provenance direction is materially stronger and closes the R3
NULL-target attack in design. The offline Migration gate is also a sound
direction.

The Append persistent invariant, however, is not implemented correctly in the
R4 proposal. Its File-side deferred trigger reads the event-local
`NEW.currentVersionId`:

```text
R4 design: 442-473
```

and therefore does not re-read the final File row at COMMIT, despite R4
stating that both functions do so. A transaction that updates the File current
version more than once can be rejected even when the final state is valid.

This is a concrete design defect in the core R3-P1-02 remediation. PostgreSQL
execution was not performed; that remains separately `NOT VERIFIED`.

## 1. Document Control

Reviewed report:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-remediation-design-r4.md
```

Expected SHA-256:

```text
929B40685EBC784E8FC22947959DD2E8416AB3727E1AC6834BD57D6D9FDC3DE1
```

Actual SHA-256:

```text
929B40685EBC784E8FC22947959DD2E8416AB3727E1AC6834BD57D6D9FDC3DE1
```

```text
Bytes: 31,038
Lines: 1,101
```

The hash, byte count and line count match the supplied baseline.

## 2. Review Inputs

Read or rechecked:

```text
R4 design
R3 independent review
R2 design and independent review
R1 design
prisma/schema.prisma
all current CM1 and P1-3 upload-related Migrations
local and object upload services
reservation/finalization/recovery paths
current upload test helpers and integration tests
controlled PostgreSQL and Prisma runner evidence
D02 D03 D04 D05 D08 D09 D11
P30-P37 FZ ST DBTP
```

The reviewed source has no tracked change since R4. Existing modified and
untracked user work was preserved.

## 3. Git State at Review Start

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  78
Untracked files:        79
```

Git was inspected using a command-local `safe.directory` override. No Git
configuration was changed.

## 4. R3 Finding Revalidation

| Finding | R4 mechanism | Independent result | Status |
|---|---|---|---|
| `R3-P1-01` new-File provenance | origin column, unique FK, File Trigger, completion/deferred guards | The relation design closes the existing-File misbinding path in design | `RESOLVED BY DESIGN` |
| `R3-P1-02` persistent Append snapshot | Intent-side and File-side deferred guards | Intent-side re-reads final state; File-side reads event-local `NEW` | `PARTIALLY RESOLVED` |
| `R3-P2-01` Migration deadlock | offline drain + three-table `ACCESS EXCLUSIVE NOWAIT` | Direction is sound; operational drain and Prisma transaction remain unverified | `PARTIALLY RESOLVED` |
| `R3-P2-02` SQLSTATE and target control | corrected first-layer matrix | Mostly corrected; missing final-state/multi-update and several Deferred semantics tests | `PARTIALLY RESOLVED` |

## 5. New-File Provenance Attack Analysis

### 5.1 Existing-File relabel attack

Attack:

```text
1. Create an existing File F with createdByUploadIntentId=NULL.
2. Create a new-file Intent I.
3. UPDATE F.createdByUploadIntentId=I.
```

Expected control:

```text
p13_file_creation_origin_guard
File creation provenance is immutable
42501
```

The R4 immutable Trigger covers this direct UPDATE. A Bypass was not found in
ordinary DML.

### 5.2 `INSERT ... ON CONFLICT DO UPDATE`

An existing File ID cannot be inserted again. Any conflict-update branch that
attempts to change the origin is a row UPDATE and is covered by the same
Trigger. Under normal trigger execution, it is rejected.

### 5.3 One Intent, two Files

The unique index:

```text
file_createdByUploadIntentId_key
```

is the final concurrent guard. Two File INSERTs for one Intent cannot both
commit; the loser receives:

```text
23505
```

The File origin Trigger also requires the Intent to remain UPLOADING and to be
a new-File Intent.

### 5.4 File without terminal chain

R4 adds a deferred File-only guard. A transaction committing only the origin
File should fail with `23514` unless, at COMMIT:

```text
Intent COMPLETED
completed version belongs to the origin File
currentVersionId points to that version
```

This design closes the partial-commit concern, subject to real PostgreSQL
constraint-trigger verification.

### 5.5 Completion against an existing File

Extended completion guard:

```text
N/N Intent
-> completed FileVersion
-> File
-> require File.createdByUploadIntentId = Intent.id
```

The R3 attack is therefore closed in design:

```text
existing File
  origin NULL or another Intent
  -> completion provenance mismatch
  -> 42501
```

### 5.6 Historical Files

Existing File rows have no origin and remain valid for Append use. Historical
completed N/N Intents cannot be retroactively proven. R4 correctly preserves
them as `LEGACY_PROVENANCE_UNVERIFIED` rather than fabricating origin.

### 5.7 Residual risks

- The origin column is still supplied during File INSERT by the writer.
- The Trigger validates Intent state and metadata, and immutability prevents
  retro-labelling.
- A role that owns the tables can disable Triggers or modify DDL. Current
  database-role/IAM isolation remains `NOT VERIFIED`.
- Other legitimate File creation paths remain legal only with origin NULL;
  they cannot be used as a new-File Intent's completion target.

No new P1 was found in the provenance relation model itself.

## 6. Persistent Append Invariant Attack Analysis

### 6.1 Intent-side function

The Intent-side function:

```text
R4 design: 395-429
```

re-reads the final Intent and final File by IDs. That is the correct direction.

### 6.2 File-side function defect

The File-side function:

```text
R4 design: 442-462
```

uses:

```text
NEW."currentVersionId"
```

inside the deferred check. A deferred Constraint Trigger is invoked later, but
`NEW` is still the row image captured by the UPDATE event that queued the
trigger. It is not automatically re-read from the final row version.

R4 nevertheless states:

```text
Both functions re-read final state.
```

at R4 design line 473. That statement is false for the File-side function.

### 6.3 Concrete legal false rejection

Initial state:

```text
File F.currentVersionId = FV0
Intent I.status = UPLOADING
Intent I.expectedCurrentFileVersionId = FV0
```

One transaction:

```sql
UPDATE "file"
SET "currentVersionId" = 'FV1'
WHERE id = 'F';

UPDATE "file"
SET "currentVersionId" = 'FV0'
WHERE id = 'F';

COMMIT;
```

Final state is valid:

```text
F.currentVersionId = FV0
I remains UPLOADING expected FV0
```

But two File-side deferred events are queued:

```text
event 1 NEW.currentVersionId = FV1
event 2 NEW.currentVersionId = FV0
```

At COMMIT, event 1 compares the final UPLOADING Intent to its captured
`NEW=FV1`, raises `23514`, and aborts the transaction even though the final
state is valid.

This may not be produced by the current single-update happy path, but it
violates R4's claimed final-state protocol and the required legal intermediate
state handling.

### 6.4 Required correction direction

The File-side deferred function must re-read the final File row:

```sql
DECLARE
  f "file"%ROWTYPE;
BEGIN
  SELECT * INTO f
  FROM "file"
  WHERE id = NEW.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'active Append target File disappeared'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "file_upload_intent" i
    WHERE i."existingFileId" = f.id
      AND i.status = 'UPLOADING'
      AND i."expectedCurrentFileVersionId"
          IS DISTINCT FROM f."currentVersionId"
  )
  THEN
    RAISE EXCEPTION
      'UPLOADING append lost its expected-current invariant'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
```

The function should use only `NEW.id`/`OLD.id` as identity keys, not mutable
state from the event image.

## 7. Deferred Trigger Semantics

### 7.1 What is supported in principle

R4 uses:

```text
CREATE CONSTRAINT TRIGGER
AFTER INSERT OR UPDATE
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
```

This shape is consistent with PostgreSQL's ordinary Constraint Trigger syntax.

### 7.2 Coverage

| Mutation | R4 coverage | Review |
|---|---|---|
| Intent INSERT | deferred Intent trigger | covered |
| Intent UPDATE | deferred Intent trigger | covered |
| File UPDATE | deferred File trigger | covered, but final-state bug |
| Intent DELETE | blocked by existing delete Trigger | protected outside new guard |
| File DELETE | restricted by Intent/FileVersion FKs | protected outside new guard |
| FileVersion DELETE | blocked by BEFORE delete Triggers | protected outside new guard |
| TRUNCATE | existing child truncate guards / FKs | must be tested |

The missing File final re-read is a real design defect even though other paths
are protected.

### 7.3 Multiple events

Multiple deferred row events can be queued for the same row. R4 does not
specify deduplication. Re-reading final state makes duplicate checks
idempotent; event-local state does not.

### 7.4 `SET CONSTRAINTS`

`SET CONSTRAINTS ALL IMMEDIATE` can force deferred checks before the rest of a
transaction completes. R4 does not define the legal application behavior.

Required design rule:

```text
normal finalization leaves constraint mode deferred until COMMIT
forcing constraints immediate mid-chain may fail safely
```

This must be tested rather than assumed.

### 7.5 Subtransactions and savepoints

Events queued inside a committed subtransaction remain checked at outer
COMMIT. Events from a rolled-back savepoint are discarded. This is a reasonable
PostgreSQL expectation but remains `NOT VERIFIED` without execution.

### 7.6 Trigger ordering with FKs

Deferred constraint triggers and deferred FKs both run at COMMIT. The first
error may be an FK or a custom Trigger depending on catalog/order and event
history. Tests must not assume one unless isolated.

### 7.7 Recursion

The proposed functions only `SELECT`; they do not write the checked tables and
therefore should not recurse. This remains a runtime verification item.

### 7.8 Query visibility and locking

At deferred execution, plain `SELECT` should see the transaction's final
state. The functions must re-read by stable row IDs. Locking must remain in the
BEFORE entry Triggers and application transaction, not be retrofitted to the
deferred SELECT.

## 8. Migration Offline Protocol

### 8.1 Strong points

R4 correctly rejects an online lock-order claim and requires:

```text
stop Web/Worker
verify no active transaction
lock file_version, file, file_upload_intent
ACCESS EXCLUSIVE NOWAIT
precheck
DDL
postcheck
COMMIT
```

The three-table lock set covers the DDL/FK target tables and the new Trigger
queries.

### 8.2 Remaining attack

A drain command cannot by itself prove that all old service instances,
schedulers, administrative scripts, pool clients, prepared transactions or
restart policies are absent.

If an unobserved writer attempts DML before the lock:

```text
NOWAIT
-> 55P03
-> Migration transaction should abort with no DDL
```

If a new client connects after the lock, its conflicting DML waits/fails; the
database schema change remains serialized by the lock.

### 8.3 Migration versus finalization timeline

```text
Session F:
BEGIN
lock File
insert FileVersion
update File current
update Intent
COMMIT

Session M:
BEGIN
LOCK TABLE file_version, file, file_upload_intent
  ACCESS EXCLUSIVE NOWAIT
```

If F already holds a conflicting lock:

```text
M fails 55P03
no precheck/DDL
F may complete under old schema
operator must re-drain and restart Migration
```

If F starts after M owns all three locks:

```text
F blocks
M may complete schema
F resumes against new schema
```

This is safe only if source compatibility exists; R4 requires stopped old
services.

### 8.4 Other File/FileVersion writer

```text
Session W:
BEGIN
insert/update File or FileVersion
COMMIT

Session M:
LOCK ... NOWAIT
```

Either:

```text
W already holds a conflict -> M 55P03, no DDL
W starts after M -> W waits/fails against migration lock
```

### 8.5 Drain versus reconnection

```text
operator stops old processes
pooled client reconnects
Migration requests lock NOWAIT
```

If reconnect has no transaction/lock, M may acquire locks; its later DML
blocks behind AccessExclusive.

If reconnect already holds a conflicting transaction/lock, M aborts `55P03`.

No `NOWAIT` failure is converted into success. This part is sound in design.

## 9. Migration Failure and Recovery

Required behavior:

```text
lock failure 55P03
precheck 23514
DDL error
=> Migration transaction fails
=> no partial schema
=> Prisma P3018 / unfinished migration row
=> service remains stopped
=> inspect old schema
=> explicit reviewed resolve or replacement clone
=> retry blocked as P3009 until resolved
```

R4 states the main failure and retry behavior correctly. Post-DDL rollback and
new-runner history are still `NOT VERIFIED`.

R4 does not yet give an exact executable recovery checklist for:

- old service pool still connected after drain;
- prepared transactions;
- auto-restart of legacy services;
- verification that old schema remains intact after P3018;
- restart authorization after a failed Migration.

Those are operational blockers before any real database execution, not source
implementation requirements.

## 10. SQLSTATE and Test Review

### 10.1 Corrected cases

The following R4 test attributions are correct in principle:

- FileVersion DELETE is caught by a BEFORE identity Trigger with `42501`,
  before FK `23503`;
- `existingFileId` mutation is caught by the phase32 identity Trigger;
- expected-current field mutation is caught by target-slot guard;
- active F/N is normally caught by custom validation before Pair CHECK;
- N/F reaches Pair CHECK;
- Migration lock conflict uses `55P03`.

### 10.2 Missing tests

R4 lacks a test for the defect in §6:

```text
multiple File.currentVersionId updates
final state valid
COMMIT must succeed
```

Also missing:

- multiple Intent updates in one transaction;
- `SET CONSTRAINTS ALL IMMEDIATE` before/after completion;
- savepoint rollback event removal;
- active Intent/File delete attempts with exact first rejection;
- direct constraints on File origin INSERT with invalid status/actor/project;
- File-only commit with no FileVersion;
- new-File completion whose FileVersion belongs to another origin File.

### 10.3 Target-mechanism isolation

The R4 cross-File compound FK isolation is plausible:

```text
temporarily set cross-File current
insert/reserve Intent
create matching same-File completed version
restore File current to same-File version
COMMIT
```

At COMMIT only the compound expected-current FK should remain invalid.

Do not claim the Pair CHECK was exercised in active F/N where a BEFORE Trigger
already rejected the statement.

## 11. Prisma and PostgreSQL Consistency

R4 gives one semantic Prisma model for:

```text
File.createdByUploadIntentId -> FileUploadIntent.id
expectedCurrentFileVersion model
```

but these remain design proposals:

- the field does not exist in current `prisma/schema.prisma`;
- migrations do not contain it;
- Prisma has not generated the final SQL;
- the PostgreSQL DB does not contain the new Trigger/constraint set.

R4 correctly marks generated SQL, Client relation behavior, MATCH,
deferrability and Trigger execution `NOT VERIFIED`.

## 12. Complete State and Invariant Matrix

| State/operation | Expected | R4 design | Independent review |
|---|---|---|---|
| N/N PENDING new File | allowed | allowed | correct |
| N/N UPLOADING new File | allowed | allowed | correct |
| N/N File origin I created | allowed only in I UPLOADING | File Trigger | correct in design |
| N/N completed with origin I | complete chain | provenance + FileVersion | correct in design |
| N/N completed under existing File | reject | completion provenance | correct in design |
| N/N File-only commit | reject | deferred consumed chain | correct in design |
| I/I Append PENDING | allowed | existing + new constraints | correct |
| I/I Append UPLOADING same current | allowed | entry check | correct |
| Append current changes and Intent completes same tx | allowed | deferred checks | correct if File function fixed |
| Append current changes and Intent remains UPLOADING | reject | deferred checks | current File function uses stale event data |
| Terminal append F/N | legacy query-only | CHECK allows | correct |
| Direct target field change | reject | immutability Trigger | correct |
| Active slot race | one winner | unique + lock | correct in design |
| File DELETE under history | reject | FK/guards | correct in design |
| FileVersion DELETE | reject | BEFORE triggers | correct |

## 13. Historical Finding Tracker

| Finding | Independent status | Basis |
|---|---|---|
| `CM1-R2-IReview-P1-01` | `RESOLVED` | R4 origin relation design closes misbinding |
| `CM1-R2-IReview-P2-01` | `RESOLVED` | stale PENDING policy and precheck classification |
| `CM1-R2-IReview-P2-02` | `NOT VERIFIED` | Prisma generated SQL not executed |
| `CM1-R2-IReview-P2-03` | `PARTIALLY RESOLVED` | future tests added, but missing multi-event/Deferred tests |
| `CM1-R2-IReview-P3-01` | `RESOLVED` | split INSERT/UPDATE Triggers |
| `R3-P1-01` | `RESOLVED` | durable File origin design |
| `R3-P1-02` | `PARTIALLY RESOLVED` | File-side deferred check reads stale NEW current |
| `R3-P2-01` | `RESOLVED` | offline drain + NOWAIT direction |
| `R3-P2-02` | `PARTIALLY RESOLVED` | SQLSTATE improved, final-state/multi-event tests missing |
| binding-parent-chain duplicate | `NOT VERIFIED` | unchanged |
| orphan FileVersion | `NOT VERIFIED` | unchanged |
| multiple FileVersion terminal | `NOT VERIFIED` | unchanged |
| `P2-05` | `OPEN` | retention policy unchanged |
| R5 57 Open Decisions | `OPEN` | unchanged |
| BV7 | `FAIL` | unchanged |
| BV8 | `NOT VERIFIED` | unchanged |
| historical R8 | `BLOCKED` | unchanged |
| live Web/Worker + PostgreSQL | `NOT VERIFIED` | unchanged |
| real Provider | `NOT VERIFIED` | unchanged |
| Windows OS fencing | `NOT VERIFIED` | unchanged |
| IAM/ACL | `NOT VERIFIED` | unchanged |
| production migration/deployment | `BLOCKED` | no authorization |

## 14. New Findings

### R5-P1-01 — File-side deferred guard uses event-local NEW state

Location:

```text
R4 design: 442-473
```

Impact:

- Legal transactions with multiple File current updates can be rejected.
- R4's claim that both functions read final state is false.
- The persistent invariant's implementation does not match its intended
  deferred/final-state semantics.

Required correction:

- re-read the final File row in the deferred function by a stable identity key;
- use only `NEW.id`/`OLD.id` as event identity;
- repeat the same pattern for any other deferred check;
- add legal multi-update and intermediate-state tests.

### R5-P2-01 — Deferred trigger lifecycle matrix is incomplete

Required additions:

- multiple row updates;
- `SET CONSTRAINTS ALL IMMEDIATE`;
- savepoint rollback;
- trigger/FK ordering;
- DELETE/TRUNCATE path;
- duplicate queued events.

Until executed, these remain `NOT VERIFIED`.

### R5-P2-02 — Drain protocol has unproven operational completeness

The design assumes that stopping Web/Worker is enough, but the repository
status records unknown legacy workers, schedulers, auto-restart and production
instances. This does not invalidate the design, but it blocks a production
Migration claim.

## 15. NOT VERIFIED / BLOCKED Items

```text
PostgreSQL Trigger compilation and deferred execution: NOT VERIFIED
Prisma generated SQL and Client relation behavior:     NOT VERIFIED
Migration atomicity after DDL starts:                  NOT VERIFIED
NOWAIT rollback and P3018 history for R4 Migration:    NOT VERIFIED
historical file provenance on non-empty DB:            NOT VERIFIED
actual old workers/schedulers/auto restart:            NOT VERIFIED
live Web/Worker PostgreSQL integration:                NOT VERIFIED
real Provider:                                         NOT VERIFIED
Windows OS fencing:                                    NOT VERIFIED
IAM/ACL:                                               NOT VERIFIED
production migration/deployment:                       BLOCKED
```

## 16. Required PostgreSQL Validation Before Approval

1. Compile all proposed functions and Triggers on isolated PostgreSQL 18.
2. Verify Constraint Trigger event and deferrability catalog fields.
3. Execute the multiple-update final-state case.
4. Execute `SET CONSTRAINTS` and savepoint cases.
5. Execute legal new-File provenance and all misbinding attacks.
6. Execute persistent Append stale-current cases with two Sessions.
7. Verify File and Intent delete/truncate paths and first SQLSTATE.
8. Verify FileVersion DELETE first-layer `42501`.
9. Verify compound FK cross-File case with exact constraint name.
10. Verify Prisma-generated SQL and a clean/non-empty Migration.
11. Verify Migration `NOWAIT` lock failure and P3018/P3009 history.
12. Keep Provider, ACL and production out of this validation.

## 17. Git State at Review End

Only this review report is added.

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  79
Untracked files:        80
New report:             docs/architecture/wp-2a-cm1-append-intent-relational-integrity-independent-review-r5.md
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

The durable new-File provenance design is accepted in principle. The
File-side Append deferred invariant is not final-state correct and must be
revised before any controlled implementation review can pass.
