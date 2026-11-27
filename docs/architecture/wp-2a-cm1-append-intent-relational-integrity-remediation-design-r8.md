# WP-2A-CM1 — Append Intent Relational Integrity Design R8

## 0. Final Conclusion

```text
DESIGN COMPLETE — READY FOR INDEPENDENT REVIEW
```

R8 closes the R7 design findings:

```text
R7-P1-01  completed Append/current pointer mismatch   RESOLVED BY DESIGN
R7-P2-01  upload transaction isolation level          RESOLVED BY DESIGN
R7-P2-02  ambiguous negative-test controls            RESOLVED BY DESIGN
R7-P2-03  offline drain evidence boundary             RESOLVED BY DESIGN
```

No PostgreSQL execution, Prisma migration, Build, E2E or Provider operation
was performed. Runtime behavior remains `NOT VERIFIED`.

## 1. Inputs and Document Control

Reviewed R7:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-independent-review-r7.md
SHA-256 F05BF22C12230EF0A1EF7D8C527920694CE9609AB5799788C4F8311B245B411C
21,078 bytes
797 lines
```

The review hash matches the supplied baseline.

Base design:

```text
R6 SHA-256 7948C582AE04D0F2774E0B4F33FA759FE118AF2947158E990430EB8250392A1F
```

Also rechecked:

```text
R1-R5
current Prisma Schema
all upload/FileVersion/lifecycle Migrations
local and object upload services
reservation/finalization/recovery/retry paths
completion guard and P1-3 chain guard
current tests and controlled PostgreSQL evidence
```

## 2. Current Source Facts

The real completed target field is:

```text
FileUploadIntent.completedFileVersionId
```

Current Schema:

```text
prisma/schema.prisma:516-563
```

There is no field named `completedTargetFileVersionId`. R8's semantic name
maps to the existing single `completedFileVersionId`.

Current completion guard:

```text
prisma/migrations/20261115233000_phase32_upload_intents/migration.sql:190-247
```

It checks project/building/unit and that an Append target File matches, but it
does not compare:

```text
File.currentVersionId = Intent.completedFileVersionId
```

The P1-3 completed chain:

```text
prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:1279-1345
```

checks Attempt/Lifecycle/Operation/FileVersion ownership but not File current.

Both normal finalization paths update File current before Intent completion:

```text
upload-service.ts:1116-1235, 2246-2273
object-upload-service.ts:995-1110
```

Neither upload transaction currently specifies an isolation level:

```text
upload-service.ts:1049, 2150
object-upload-service.ts:929
```

## 3. Git State at Design Start

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  81
Untracked files:        82
```

Git was inspected with command-local `safe.directory`; no Git config changed.

## 4. Two Append Invariants

### 4.1 UPLOADING

```text
Intent.status = UPLOADING
AND Intent.existingFileId IS NOT NULL
=> File.currentVersionId = Intent.expectedCurrentFileVersionId
```

This is the R6 persistent helper.

### 4.2 COMPLETED transition

```text
Intent.status = COMPLETED
AND Intent.existingFileId IS NOT NULL
=> File.currentVersionId = Intent.completedFileVersionId
```

This condition is checked at the transaction that performs
`UPLOADING -> COMPLETED`, using final re-read state at COMMIT.

### 4.3 Completed target identity

The target is the existing `completedFileVersionId`. It is unique on Intent.
For Append:

```text
FileVersion.id = Intent.completedFileVersionId
FileVersion.fileId = Intent.existingFileId
File.currentVersionId = FileVersion.id
```

For new File:

```text
FileVersion.id = Intent.completedFileVersionId
File.createdByUploadIntentId = Intent.id
File.currentVersionId = FileVersion.id
```

## 5. Completed Append Database Design

### 5.1 Same-File completed target FK

Reuse:

```text
file_version(id,fileId) UNIQUE
```

Add:

```sql
ALTER TABLE "file_upload_intent"
ADD CONSTRAINT
  "file_upload_intent_completed_current_same_file_fkey"
FOREIGN KEY (
  "completedFileVersionId",
  "existingFileId"
)
REFERENCES "file_version"("id", "fileId")
MATCH SIMPLE
ON DELETE RESTRICT
ON UPDATE RESTRICT
DEFERRABLE INITIALLY DEFERRED;
```

For Append I/I completion this proves the completed version belongs to the
target File.

For new File N/N completion the FK is skipped; the existing single
`completedFileVersionId -> file_version(id)` FK plus R4 File-origin rule cover
existence and creation source.

The single completed-version relation is retained. It is an existence guard,
not same-File proof.

### 5.2 Completion transition guard

The target FileVersion must equal current at completion COMMIT.

```sql
CREATE OR REPLACE FUNCTION "p13_assert_completed_append_current"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  i "file_upload_intent"%ROWTYPE;
  fv "file_version"%ROWTYPE;
  f "file"%ROWTYPE;
BEGIN
  IF TG_OP <> 'UPDATE'
     OR OLD.status <> 'UPLOADING'
     OR NEW.status <> 'COMPLETED'
  THEN
    RETURN NULL;
  END IF;

  SELECT * INTO i
  FROM "file_upload_intent"
  WHERE id = NEW.id;

  IF NOT FOUND OR i.status <> 'COMPLETED' THEN
    RETURN NULL;
  END IF;

  IF i."existingFileId" IS NULL THEN
    RETURN NULL; -- new-File path is covered by R4/R6 guards
  END IF;

  IF i."completedFileVersionId" IS NULL THEN
    RAISE EXCEPTION
      'completed Append has no target FileVersion'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO fv
  FROM "file_version"
  WHERE id = i."completedFileVersionId";

  SELECT * INTO f
  FROM "file"
  WHERE id = i."existingFileId";

  IF NOT FOUND
     OR fv."fileId" IS DISTINCT FROM f.id
     OR f."currentVersionId"
        IS DISTINCT FROM i."completedFileVersionId"
  THEN
    RAISE EXCEPTION
      'completed Append current pointer mismatch'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER
  "p13_completed_append_current_guard"
AFTER UPDATE ON "file_upload_intent"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_completed_append_current"();
```

`OLD/NEW.status` is used only to classify the completion event. All current
rows are re-read at COMMIT.

The deferred timing allows either legal order in one transaction:

```text
File current update -> Intent COMPLETED
or
Intent COMPLETED -> File current update
```

### 5.3 Completed target immutability

After an Intent is COMPLETED, these fields must not change:

```text
completedFileVersionId
completedAt
existingFileId
expectedCurrentFileVersionId
```

A BEFORE UPDATE guard rejects changes with:

```text
42501
```

This prevents editing a historical completion after a later Append advances
the File current pointer.

### 5.4 P1-3 chain responsibility

| Control | Responsibility |
|---|---|
| Existing completion guard | target ownership/project/building/unit |
| P1-3 chain guard | Attempt/Lifecycle/Operation/FileVersion counts and identity |
| Compound completed FK | Append target belongs existing File |
| Completion transition guard | final current pointer equals completed target |
| Completed-target immutability | history cannot be rewritten |

## 6. Post-Completion File Current Guard

The completion transition guard alone prevents an inconsistent completion,
but a later direct UPDATE could point current back to an older FileVersion.

Add a File-side deferred guard:

```sql
CREATE OR REPLACE FUNCTION "p13_assert_file_current_latest_completed"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  f "file"%ROWTYPE;
  v_current_number INTEGER;
  v_max_number INTEGER;
BEGIN
  IF TG_OP <> 'UPDATE'
     OR OLD."currentVersionId" IS NOT DISTINCT FROM NEW."currentVersionId"
  THEN
    RETURN NULL;
  END IF;

  SELECT * INTO f
  FROM "file"
  WHERE id = NEW.id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF f."currentVersionId" IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM "file_version" fv WHERE fv."fileId" = f.id
    )
    THEN
      RAISE EXCEPTION
        'versioned File cannot have NULL current pointer'
        USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
  END IF;

  SELECT "versionNumber" INTO v_current_number
  FROM "file_version"
  WHERE id = f."currentVersionId"
    AND "fileId" = f.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'File current pointer is not owned by File'
      USING ERRCODE = '23514';
  END IF;

  SELECT max("versionNumber") INTO v_max_number
  FROM "file_version"
  WHERE "fileId" = f.id;

  IF v_current_number IS DISTINCT FROM v_max_number THEN
    RAISE EXCEPTION
      'File current pointer is not the latest version'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "file_upload_intent" i
    WHERE i.status = 'COMPLETED'
      AND i."completedFileVersionId" = f."currentVersionId"
      AND (
        i."existingFileId" = f.id
        OR f."createdByUploadIntentId" = i.id
      )
  )
  THEN
    RAISE EXCEPTION
      'File current pointer has no completed Intent'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER
  "p13_file_current_latest_completed_guard"
AFTER UPDATE ON "file"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_file_current_latest_completed"();
```

This guard:

- runs only when the current pointer changed;
- re-reads final File and FileVersions;
- allows a later legitimate Append to advance to a newer completed version;
- rejects regression to an older version;
- rejects a current pointer without a completed Intent;
- permits legacy Files until their current pointer is changed.

The app contract remains append-only version progression.

## 7. Direct DML Bypass Matrix

| Attack | Expected DB result |
|---|---|
| COMPLETED without current update | completion transition guard `23514` |
| current update without Intent completion | active current guard/latest-completed guard `23514` |
| COMPLETED target from another File | immediate completion guard `42501`; compound FK backup |
| COMPLETED target is an older same-File version | current mismatch `23514` |
| COMPLETED target does not exist | existing completion guard `42501` before FK |
| current pointer changed after completion to older version | latest-completed guard `23514` |
| completed target changed after completion | immutable completion guard `42501` |
| Intent target File changed after creation | existing immutability Trigger `42501` |
| File current changed without any completed target | latest-completed guard `23514` |
| two completions in one transaction | first completion final-current check fails unless target is final current |

## 8. Same-Transaction Attack Sequences

### 8.1 Complete without pointer

```text
I: UPLOADING expected=FV0
FV1 completed target exists
UPDATE I COMPLETED completedFileVersionId=FV1
COMMIT
```

Final:

```text
F.currentVersionId=FV0 != FV1
=> 23514
transaction rollback
```

### 8.2 Pointer without completion

```text
I UPLOADING expected=FV0
UPDATE F current=FV2
COMMIT
```

R6 active helper sees UPLOADING expected FV0 vs final FV2:

```text
23514
```

### 8.3 Pointer first, completion later

```text
UPDATE F current=FV1
UPDATE I COMPLETED completedFileVersionId=FV1
COMMIT
```

Completion guard final read:

```text
current=FV1, completed=FV1
pass
```

### 8.4 Completion first, pointer later

```text
UPDATE I COMPLETED completedFileVersionId=FV1
UPDATE F current=FV1
COMMIT
```

Deferred completion guard sees final:

```text
current=FV1, completed=FV1
pass
```

### 8.5 Wrong or old target

```text
completedFileVersionId = other File/old version
```

Immediate ownership or final-current mismatch rejects the transaction.

### 8.6 Two different completions in one transaction

```text
Intent A completes at FV1
Intent B completes at FV2
current final=FV2
```

A's completion deferred event re-reads current FV2 and completed FV1:

```text
23514
```

Two active Appends for one File are already excluded by the active slot.

### 8.7 SAVEPOINT

Events in a rolled-back subtransaction are expected to be discarded. A
committed subtransaction's event remains and re-reads outer final state.

### 8.8 Commit response loss

The final transaction is all-or-nothing. A retry must re-read
Intent.completedFileVersionId, File.currentVersionId and the target version.

## 9. Concurrency and Isolation

### 9.1 Selected isolation

All interactive upload transactions that reserve, finalize, fail or recover
File/Intent/Version state use:

```text
Prisma.TransactionIsolationLevel.ReadCommitted
```

Example:

```ts
database.$transaction(
  async (tx) => { /* existing transaction body */ },
  {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  },
)
```

Single-statement create/fail operations without an explicit interactive
transaction rely on statement atomicity and database Triggers.

Raw SQL inside these transactions inherits the explicitly selected level.

### 9.2 Why Read Committed

READ COMMITTED is selected because:

- the critical protocol uses File row locks and Intent/Attempt CAS;
- active Append is protected by a partial unique index;
- final relationship checks are deferred to COMMIT and re-read final rows;
- stronger isolation would add retries without removing direct-DML need for
  database guards;
- current business paths have bounded transactions and no long reports.

### 9.3 Comparison

| Level | Snapshot/serialization | Benefit | Cost | Decision |
|---|---|---|---|---|
| READ COMMITTED | statement snapshots + row locks | aligns with CAS/locks; low retry | must rely on explicit locks and final guards | selected |
| REPEATABLE READ | transaction snapshot; write conflicts `40001` | fewer changing reads | more retry complexity; may reject benign concurrent status reads | not selected |
| SERIALIZABLE | full serialization, `40001` | strongest generic protection | highest retry/operational cost; not needed with row protocol | fallback for special recovery only |

### 9.4 Write-skew proof

- File current update holds the File row lock.
- Intent reservation locks File `FOR UPDATE`.
- Append creation locks File `FOR SHARE`.
- Active slot is unique.
- Deferred completion transition and current-pointer guards re-read final rows.

No two transactions can both commit an active or completed Append with
different current targets.

### 9.5 Prisma enforcement

Future source implementation must:

- add the ReadCommitted option to every upload interactive transaction;
- use the same option in tests and production;
- avoid a fallback to unconfigured default;
- add a test that executes `SHOW transaction_isolation` inside a representative
  transaction and expects `read committed`;
- add a source scan asserting all upload `$transaction` callbacks carry the
  option;
- explicitly retry only PostgreSQL `40001`/`40P01` when policy permits.

## 10. Lock Order and Deadlock

### 10.1 Two Append finalizations

```text
A: storage rows -> File FOR UPDATE -> FileVersion -> current -> Intent -> COMMIT
B: storage rows -> waits for File
A commits
B fencing/CAS count 0 -> ROLLBACK
```

Expected one winner.

### 10.2 Current pointer vs completion

```text
F: File FOR UPDATE -> insert version -> current new -> Intent completed
D: waits for File -> after F commits
```

or:

```text
D: File FOR UPDATE -> current new
F: waits
D leaves Intent UPLOADING -> deferred guard 23514 -> D ROLLBACK
```

No lock-free bypass remains because File update row lock is held through
deferred checks.

### 10.3 Migration vs residual writer

```text
W: holds any related row/table lock
M: LOCK file_version,file,file_upload_intent ACCESS EXCLUSIVE NOWAIT
=> M 55P03, no DDL
```

After M owns locks, new writers block until Migration ends.

## 11. Completion Guard / P1-3 Duty Boundary

```text
completion guard:
  target FileVersion belongs Intended File
  project/building/unit ownership

P1-3 chain:
  Attempt/Operation/Lifecycle/FileVersion exact chain

new completion guard:
  completedFileVersionId = File.currentVersionId at completion COMMIT

new current-pointer guard:
  current is latest FileVersion with a completed Intent

compound FK:
  completed target belongs Append File

immutability:
  completed target/history cannot be rewritten
```

## 12. Negative Test Matrix

Target statuses are design-only until executed.

| ID | Target | Fixture/operation | First control | SQLSTATE | Final assertion |
|---|---|---|---|---|---|
| `R8-T-01` | Complete without pointer | FV1 complete, current FV0 | completion guard | `23514` | rollback, I UPLOADING |
| `R8-T-02` | Pointer without completion | current FV1, I UPLOADING | R6 active guard | `23514` | rollback |
| `R8-T-03` | Complete with other File version | Append F, completed G/FV | completion guard | `42501` | rollback |
| `R8-T-04` | Complete with older same-File version | current FV2, completed FV1 | completion guard | `23514` | rollback |
| `R8-T-05` | Complete with missing version | completed missing | completion guard | `42501` | rollback before FK |
| `R8-T-06` | Pointer first, completion later | same transaction, final FV1/FV1 | pass | none | valid COMPLETED |
| `R8-T-07` | Completion first, pointer later | same transaction, final FV1/FV1 | pass | none | valid COMPLETED |
| `R8-T-08` | After complete, current to old | latest-completed guard | `23514` | current unchanged |
| `R8-T-09` | After complete, change completed target | completed immutability | `42501` | target unchanged |
| `R8-T-10` | Two completed targets in one tx | first final mismatch | `23514` | rollback |
| `R8-T-11` | Two concurrent finalizations | fenced loser | application/CAS | one target |
| `R8-T-12` | Old owner/generation retry | fencing CAS | application | no second version |
| `R8-T-13` | COMMIT response lost | new read | none | exact durable chain |
| `R8-T-14` | SAVEPOINT rollback | discarded event | none | final valid |
| `R8-T-15` | Multiple deferred events | final read | none | deterministic final state |

## 13. Migration Evidence Checklist

| Evidence | Automated | Manual confirmation |
|---|---|---|
| Branch/HEAD/hashes | yes | no |
| Web ingress stopped | partial | yes |
| Web instances stopped | partial | yes |
| Worker instances stopped | partial | yes |
| Scheduler paused | partial | yes |
| Auto-restart/auto-scale disabled | no DB proof | yes |
| DB role/client inventory | yes with role/secret-free query | yes |
| Active writers drained | `pg_stat_activity` | yes |
| Prepared transactions absent | `pg_prepared_xacts` | yes |
| Long transactions absent | `pg_stat_activity` | yes |
| Three-table locks acquired | psql/Prisma output | verifier |
| `_prisma_migrations` before | DB query | verifier |
| Migration exit code | runner output | verifier |
| `_prisma_migrations` after | DB query | verifier |
| schema before/after | catalog snapshots | verifier |
| rollback after failure | connection + catalog | verifier |
| old service absent after migration | processes/services/scheduler | yes |
| post-migration lifecycle smoke | isolated test data | verifier |
| production DB/provider untouched | authorization/assets | yes |

## 14. Historical Finding Tracker

| Finding | Status | Basis |
|---|---|---|
| `CM1-R2-IReview-P1-01` | `RESOLVED` | file provenance design |
| `CM1-R2-IReview-P2-01` | `RESOLVED` | stale PENDING design |
| `CM1-R2-IReview-P2-02` | `NOT VERIFIED` | Prisma SQL not run |
| `CM1-R2-IReview-P2-03` | `PARTIALLY RESOLVED` | more tests defined; not run |
| `CM1-R2-IReview-P3-01` | `RESOLVED` | Trigger split/admission |
| `R3-P1-01` | `RESOLVED` | provenance |
| `R3-P1-02` | `PARTIALLY RESOLVED` | completed invariant added to design; runtime pending |
| `R3-P2-01` | `PARTIALLY RESOLVED` | runbook design; operational evidence pending |
| `R3-P2-02` | `PARTIALLY RESOLVED` | more matrices; runtime pending |
| `R5-P1-01` | `RESOLVED` | final re-read |
| `R5-P2-01` | `PARTIALLY RESOLVED` | test design incomplete until R8 additions run |
| `R5-P2-02` | `PARTIALLY RESOLVED` | operational evidence pending |
| `R7-P1-01` | `RESOLVED` | completed guard design |
| `R7-P2-01` | `RESOLVED` | explicit READ COMMITTED design |
| `R7-P2-02` | `RESOLVED` | matrix split |
| `R7-P2-03` | `PARTIALLY RESOLVED` | evidence checklist |

External statuses remain unchanged:

```text
binding-parent-chain         NOT VERIFIED
orphan FileVersion           NOT VERIFIED
multiple FileVersion         NOT VERIFIED
P2-05                        OPEN
R5 57 decisions              OPEN
BV7                          FAIL
BV8                          NOT VERIFIED
historical R8                BLOCKED
real Provider                NOT VERIFIED
Windows OS fencing           NOT VERIFIED
IAM/ACL                      NOT VERIFIED
live Web/Worker PG           NOT VERIFIED
production deployment        BLOCKED
```

## 15. Controlled PostgreSQL Validation Plan

1. Compile all R4/R6/R8 Triggers.
2. Verify catalog event/deferrability/parent keys/FK actions.
3. Execute all R8 completion tests and R6 event matrix.
4. Verify both transaction orderings.
5. Verify wrong/old/dangling target cases and first SQLSTATE.
6. Verify direct current pointer regression and target mutation.
7. Verify two-session finalization and response-loss retry.
8. Verify `SAVEPOINT`, `SET CONSTRAINTS`, and multiple deferred events.
9. Verify explicit `READ COMMITTED` in every relevant entry.
10. Apply to empty/non-empty clones and inspect `_prisma_migrations`.
11. Run the offline Migration evidence drill.
12. Keep Provider/Windows/IAM/prod out of scope.

## 16. Git State

### Before this report

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  81
Untracked files:        82
```

### After this report

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  82
Untracked files:        83
New report:             docs/architecture/wp-2a-cm1-append-intent-relational-integrity-remediation-design-r8.md
```

## 17. Report Metadata

Final SHA-256, byte count and line count are recorded in the delivery response.

```text
Markdown fences:      balanced/static check
Trailing whitespace: static check
PostgreSQL execution: none
Build/E2E execution:  none
Provider access:      none
```

## 18. Final Design Decision

```text
DESIGN COMPLETE — READY FOR INDEPENDENT REVIEW
```

R7-P1-01 is closed in design by the completion transition guard, same-File
completed FK, completed target immutability and latest-current guard.

All implementation and PostgreSQL claims remain `NOT VERIFIED`.
