# WP-2A-CM1 — Append Intent Relational Integrity Design R4

## 0. Final Conclusion

```text
DESIGN COMPLETE — READY FOR INDEPENDENT REVIEW
```

This design corrects all four R3 findings:

```text
R3-P1-01   New-file creation provenance          RESOLVED BY DESIGN
R3-P1-02   Persistent Append current invariant   RESOLVED BY DESIGN
R3-P2-01   Migration lock/deadlock gate          RESOLVED BY DESIGN
R3-P2-02   Deterministic SQLSTATE/control matrix RESOLVED BY DESIGN
```

The two unavoidable implementation limits remain explicit:

```text
PostgreSQL Trigger/FK/Migration execution: NOT VERIFIED
Prisma generated SQL and Client behavior:  NOT VERIFIED
```

No source, Schema, Migration, SQL, Trigger, test or database was changed by
this task.

## 1. Document Control

Reviewed R3:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-independent-review-r3.md
SHA-256 385E3311379C00A2EF1B79FF3713116B8157766E1A12F66EA18944935A4CCA28
```

The actual R3 file has:

```text
32,939 bytes
1,141 lines
```

and matches the supplied SHA-256.

Also read or rechecked:

```text
R1 design
R2 design
R2 independent review
R3 independent review
prisma/schema.prisma
all CM1 upload-intent/FileVersion/lifecycle Migrations
current local and object upload services
current upload/recovery tests and fixtures
D02 D03 D04 D05 D08 D09 D11
P30-P37 FZ ST DBTP
```

The reviewed source has no tracked change since R3. Existing uncommitted and
untracked user work was preserved.

## 2. Executive Summary

### 2.1 New-file provenance

R4 adds a nullable `File.createdByUploadIntentId` column, unique FK, immutable
column guard, INSERT guard, completion guard and deferred terminal guard.

This is not an application Boolean or client mode flag:

- it is a relational FK to the server-created Intent;
- it is unique, so one Intent creates at most one File;
- it is rejected unless the Intent is a legal UPLOADING new-File Intent;
- it is immutable after File INSERT;
- Intent completion must resolve back to that exact originating File;
- File, FileVersion, completed pointer and Intent terminal state are checked
  again at COMMIT.

### 2.2 Persistent Append snapshot

The entry-time Trigger remains. A deferred invariant re-reads final transaction
state and requires every UPLOADING Append to satisfy:

```text
File.currentVersionId = Intent.expectedCurrentFileVersionId
```

It is queued by both Intent and File-current changes. Normal finalization may
advance current and complete the Intent in one transaction. An unrelated
current advance committed while the Intent remains UPLOADING fails at COMMIT.

### 2.3 Migration

R4 explicitly rejects online Migration. The controlled sequence is:

1. stop Web and Worker;
2. verify no unapproved transaction remains;
3. use `LOCK TABLE ... NOWAIT` on
   `file_version`, `file`, and `file_upload_intent`;
4. run precheck before DDL;
5. execute all DDL in one migration transaction;
6. postcheck;
7. start only updated services after success.

Table locks are a final barrier, not a substitute for the drain gate.

## 3. Current Source Facts

Current `File` has no creation-Intent provenance:

```text
prisma/schema.prisma:367-395
```

Current Intent target fields and single expected-current relation:

```text
prisma/schema.prisma:516-563
```

Current completion guard does not prove new-File origin when
`existingFileId IS NULL`:

```text
prisma/migrations/20261115233000_phase32_upload_intents/migration.sql:190-247
```

The P1-3 deferred upload chain checks ownership/counts but not File creation
origin:

```text
prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:1194-1357, 1693-1738
```

Reservation paths:

```text
upload-service.ts:484-563
object-upload-service.ts:324-391
```

Finalization paths:

```text
upload-service.ts:1078-1238, 2146-2283
object-upload-service.ts:929-1117
```

Active Append slot:

```text
prisma/migrations/20261126130000_phase38_route_c_minimal_recovery_hardening/migration.sql:112-116
```

All source evidence supports the R3 finding that the application follows a
coherent happy path while the database still lacks two persistent invariants.

## 4. R3-P1-01 — New-File Creation Provenance

### 4.1 Alternatives

| Option | Direct-DML resistance | Recovery | Compatibility | Verdict |
|---|---|---|---|---|
| Application-only target flag | Weak | Good | Easy | Rejected |
| Client-supplied creation nonce | Replayable | Conditional | Easy | Rejected |
| File ID equals Intent ID | Binds one File but couples ID namespaces | Good | Changes allocation | Not selected |
| `File.createdByUploadIntentId` unique FK plus Triggers | Strong relational origin; existing Files remain NULL | Durable one-to-one | Small additive field | Selected |
| Separate mutable claim row | Needs the same relational/immutability controls | More moving parts | Extra table | Rejected |

### 4.2 Prisma model

Add to `File`:

```prisma
createdByUploadIntentId String? @unique

createdByUploadIntent FileUploadIntent? @relation(
  "UploadIntentCreatedFile",
  fields: [createdByUploadIntentId],
  references: [id],
  onDelete: Restrict,
  onUpdate: Restrict
)
```

Add to `FileUploadIntent`:

```prisma
createdFile File? @relation("UploadIntentCreatedFile")
```

Semantics:

- NULL means legacy or non-protocol-created File;
- non-NULL means the one File created by that new-File Intent;
- UNIQUE is the concurrent duplicate guard;
- an immutability Trigger prevents retro-labelling;
- FK prevents dangling origin;
- RESTRICT preserves history.

The origin is not trusted by itself. It must match the Intent state, hierarchy,
actor and completed chain.

### 4.3 File origin Trigger

Proposed SQL specification:

```sql
CREATE OR REPLACE FUNCTION "p13_assert_file_creation_origin"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  i "file_upload_intent"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."createdByUploadIntentId"
       IS DISTINCT FROM OLD."createdByUploadIntentId"
    THEN
      RAISE EXCEPTION
        'File creation provenance is immutable'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."createdByUploadIntentId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO i
  FROM "file_upload_intent"
  WHERE id = NEW."createdByUploadIntentId"
  FOR UPDATE;

  IF NOT FOUND
     OR i.status <> 'UPLOADING'
     OR i."existingFileId" IS NOT NULL
     OR i."expectedCurrentFileVersionId" IS NOT NULL
     OR i."currentAttemptId" IS NULL
     OR i."completedFileVersionId" IS NOT NULL
     OR i."projectId" IS DISTINCT FROM NEW."projectId"
     OR i."buildingId" IS DISTINCT FROM NEW."buildingId"
     OR i."installationUnitId" IS DISTINCT FROM NEW."installationUnitId"
     OR i."uploadedById" IS DISTINCT FROM NEW."createdById"
  THEN
    RAISE EXCEPTION
      'new File creation provenance does not match an active new-file Intent'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "p13_file_creation_origin_guard"
BEFORE INSERT OR UPDATE OF "createdByUploadIntentId"
ON "file"
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_file_creation_origin"();
```

The final concurrent guard is:

```sql
CREATE UNIQUE INDEX "file_createdByUploadIntentId_key"
  ON "file"("createdByUploadIntentId");
```

A second File for one Intent fails with:

```text
23505 unique_violation
```

### 4.4 Extended completion guard

Replace `validate_upload_intent_completion()` so that when a completed
FileVersion exists it also selects:

```text
File.createdByUploadIntentId
FileVersion.uploadIntentId
```

and requires:

```text
if Intent.existingFileId IS NULL:
    File.createdByUploadIntentId = Intent.id

if Intent.existingFileId IS NOT NULL:
    completed File.id = Intent.existingFileId
```

For a new-File Intent, these are rejected:

```text
File.createdByUploadIntentId IS NULL
File.createdByUploadIntentId = another Intent
FileVersion.fileId != the originating File
```

The existing ownership mismatch SQLSTATE remains:

```text
42501
```

Use a distinct message:

```text
new-file Intent completion provenance mismatch
```

### 4.5 Deferred consumed-chain guard

Immediate File INSERT does not prove that the transaction reached a complete
chain. Add a constraint trigger:

```text
AFTER INSERT ON file
DEFERRABLE INITIALLY DEFERRED
```

At COMMIT, for every non-NULL origin require:

```text
Intent exists
Intent.status = COMPLETED
Intent.existingFileId IS NULL
Intent.expectedCurrentFileVersionId IS NULL
Intent.completedFileVersionId IS NOT NULL
completed FileVersion.fileId = File.id
completed FileVersion.uploadIntentId = Intent.id
File.currentVersionId = Intent.completedFileVersionId
one matching FileVersion for this File and Intent
```

Failure:

```text
23514
```

The legal order:

```text
create File with provenance
-> create FileVersion
-> update current
-> complete Intent
-> COMMIT
```

is checked at the final state.

### 4.6 Failure and recovery

- Rollback: File, version, pointer and Intent completion all disappear.
- Successful COMMIT: provenance is durable recovery evidence.
- COMMIT response loss: a new connection reads the final chain.
- File-only or File+Version-only commit: deferred guard rejects.
- Duplicate File: unique `23505`.
- Replay after terminal status: File origin Trigger rejects non-UPLOADING.
- Provider object: retained/discovered externally; no DB rollback claim.

### 4.7 Non-empty history

| Historical state | Policy |
|---|---|
| COMPLETED N/N without provable origin | preserve as `LEGACY_PROVENANCE_UNVERIFIED` |
| PENDING/UPLOADING N/N without FileVersion | may continue after updated source deploy |
| Active N/N with FileVersion/completed pointer | block precheck |
| Existing File rows without origin | valid legacy Files |
| Append target originally created by earlier Intent | valid |

No provenance is guessed or invented.

## 5. R3-P1-02 — Persistent Append Expected-Current Invariant

### 5.1 Entry checks remain

- Append creation checks current under File `FOR SHARE`;
- Append reservation checks current under File `FOR UPDATE`;
- active partial unique permits one UPLOADING Append per File.

These remain necessary but are not a persistent invariant.

### 5.2 Deferred Intent-side check

```sql
CREATE OR REPLACE FUNCTION "p13_assert_append_current_from_intent"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  i "file_upload_intent"%ROWTYPE;
  f "file"%ROWTYPE;
BEGIN
  SELECT * INTO i
  FROM "file_upload_intent"
  WHERE id = NEW.id;

  IF NOT FOUND
     OR i.status <> 'UPLOADING'
     OR i."existingFileId" IS NULL
  THEN
    RETURN NULL;
  END IF;

  SELECT * INTO f
  FROM "file"
  WHERE id = i."existingFileId";

  IF NOT FOUND
     OR f."currentVersionId"
        IS DISTINCT FROM i."expectedCurrentFileVersionId"
  THEN
    RAISE EXCEPTION
      'UPLOADING append lost its expected-current invariant'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER
  "p13_append_current_intent_commit_guard"
AFTER INSERT OR UPDATE ON "file_upload_intent"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_append_current_from_intent"();
```

### 5.3 Deferred File-side check

```sql
CREATE OR REPLACE FUNCTION "p13_assert_append_current_from_file"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "file_upload_intent" i
    WHERE i."existingFileId" = NEW.id
      AND i.status = 'UPLOADING'
      AND i."expectedCurrentFileVersionId"
          IS DISTINCT FROM NEW."currentVersionId"
  )
  THEN
    RAISE EXCEPTION
      'File current version advanced while Append remained UPLOADING'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER
  "p13_append_current_file_commit_guard"
AFTER UPDATE ON "file"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_append_current_from_file"();
```

Both functions re-read final state. They do not trust earlier statements.

### 5.4 Legal and illegal outcomes

Legal:

```text
File current FV1->FV2
Intent UPLOADING->COMPLETED FV2
same transaction
COMMIT succeeds
```

Illegal:

```text
File current FV1->FV2
Intent remains UPLOADING expected FV1
COMMIT fails 23514
```

### 5.5 Responsibility split

| Control | Responsibility |
|---|---|
| INSERT/UPDATE entry Trigger | creation/reservation snapshot |
| active partial unique | one active Append |
| deferred Intent/File invariant | committed UPLOADING equality |
| application File lock/CAS | normal business serialization |
| compound FK | same-File expected version |
| FileVersion/current CAS | prevent stale finalization |

## 6. Complete Lifecycle

### 6.1 New File

```text
PENDING N/N
-> UPLOADING N/N
-> create File(createdByUploadIntentId=I)
-> create FileVersion under File
-> currentVersionId = FileVersion
-> COMPLETED N/N
-> COMMIT
```

Required terminal state:

```text
one origin File
one completed FileVersion
current = completed version
File origin = Intent
```

### 6.2 Append

```text
PENDING I/I
-> entry current check
-> UPLOADING I/I
-> finalization File lock
-> create version under existingFileId
-> current = version
-> Intent COMPLETED
-> COMMIT
```

Any commit that leaves UPLOADING with a different current fails.

### 6.3 Terminal history

- new File terminal history retains N/N;
- Append terminal history retains I/I or legacy F/N;
- completed origin Files retain their provenance;
- terminal rows are append-only and non-executable.

## 7. Concurrency Timelines

### 7.1 Migration versus Append finalization

Without quiescence:

```text
Session F:
  holds File row lock
  inserted FileVersion           -- file_version ROW EXCLUSIVE
  waits to update File.current
  later needs file_upload_intent

Session M:
  holds file_upload_intent ACCESS EXCLUSIVE
  requests file_version/file lock
  waits on F

possible wait cycle and deadlock
```

With R4:

```text
drain gate confirms F is absent
M runs LOCK TABLE file_version, file, file_upload_intent
  IN ACCESS EXCLUSIVE MODE NOWAIT
if any writer remains:
  55P03 lock_not_available
  no precheck/DDL
```

The Migration does not run online.

### 7.2 Two Append finalizations

```text
Session A:
BEGIN
claim operation/lifecycle ownership
lock File FOR UPDATE
create FileVersion
update current
complete Intent
COMMIT

Session B:
BEGIN
claim operation/lifecycle ownership
wait for File
after A commits:
  CAS/fencing count = 0
ROLLBACK
```

Expected:

```text
one winner
one committed FileVersion/current transition
loser writes no business terminal state
```

Normal active-slot and fencing guards prevent two different active owners.

### 7.3 Finalization versus File current advancement

Finalizer first:

```text
F: lock File -> version/current -> complete Intent -> COMMIT
D: wait -> after F, no UPLOADING Append remains
```

Direct advancement first:

```text
D: lock File -> current=FV2 -> queues deferred check
F: waits
D COMMIT: Intent still UPLOADING expected=FV1
  deferred invariant raises 23514
  D ROLLBACK
F continues
```

### 7.4 Commit response loss

```text
full final transaction COMMIT sent
-> response lost
-> new Session reads final Intent/File/Version/provenance
```

The transaction is all-or-nothing. No Provider or file-system inference is
made from missing response.

## 8. Migration Lock and Ordering

### 8.1 Exact gate

Inside one transaction:

```sql
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '15min';

LOCK TABLE
  "file_version",
  "file",
  "file_upload_intent"
IN ACCESS EXCLUSIVE MODE NOWAIT;
```

Fixed order:

```text
1. file_version
2. file
3. file_upload_intent
```

`NOWAIT` ensures a conflicting online writer aborts before DDL.

### 8.2 Ordered Migration steps

```text
1. controlled Web/Worker drain
2. transaction start
3. timeouts
4. three-table ACCESS EXCLUSIVE NOWAIT
5. historical precheck
6. add File.createdByUploadIntentId
7. add unique index and FK
8. install File origin and completion guards
9. install persistent Append deferred guards
10. remove old expected-current FK
11. replace existingFileId FK with RESTRICT/RESTRICT
12. add compound expected-current FK and pair CHECK
13. catalog/data postcheck
14. COMMIT
```

No backfill guess, deletion, cleanup or Provider operation.

### 8.3 Historical precheck

Block before DDL:

```text
active invalid target pair
active Append missing expected
N/F target
dangling expected
cross-File expected
stale UPLOADING Append
active N/N with a FileVersion or completed pointer
```

Preserve:

```text
stale PENDING
terminal legacy N/N without provenance, recorded as
  LEGACY_PROVENANCE_UNVERIFIED
N/N UPLOADING with no FileVersion
pre-R4 File rows with NULL creation origin
```

### 8.4 Postcheck

Verify:

- File origin column exists, is nullable and unique;
- FK actions are RESTRICT/RESTRICT;
- unique index exists;
- File origin/immutability Trigger exists;
- completion guard references File origin;
- deferred consumed-chain Trigger exists;
- persistent Append Intent/File Triggers exist and are deferred;
- old single expected FK absent;
- compound expected FK column order/parent/MATCH/actions/deferrability;
- pair CHECK validates;
- no invalid current data remains.

Prisma migration failure:

```text
55P03 lock gate, 23514 precheck or other DDL error
-> Prisma P3018
-> unfinished migration row
-> no later migration
-> P3009 on unchanged retry
```

Post-DDL atomicity remains `NOT VERIFIED` until isolated execution.

## 9. Prisma / PostgreSQL Consistency

Prisma can express:

- `File.createdByUploadIntentId` unique optional relation;
- one compound expected-current relation;
- existing File RESTRICT/RESTRICT relation.

Prisma cannot express:

- Pair CHECK;
- `MATCH SIMPLE`;
- deferrability;
- immutable origin Trigger;
- File creation status/hierarchy Trigger;
- completed-chain provenance guard;
- persistent Append deferred guards;
- lifecycle identity guards.

Final validation must include:

```text
pnpm db:validate
Prisma generated SQL inspection
clean Migration rebuild
non-empty Migration clone
from-Migrations/to-schema empty diff
Client create/update/delete relation smoke tests
```

Current status:

```text
NOT VERIFIED
```

### 9.1 Existing fixture compatibility

`apps/web/tests/helpers/p13-file-version.ts:61-79` currently creates an Intent
with no `existingFileId`.

It later creates a FileVersion under caller-provided `input.fileId` and
completes that Intent:

```text
apps/web/tests/helpers/p13-file-version.ts:222-253
```

After R4 this must not be used for an arbitrary pre-existing File. Future
implementation must split the helper into:

```text
createNewFileVersionFixture:
  create File with createdByUploadIntentId = Intent.id

createAppendVersionFixture:
  existingFileId + expectedCurrentFileVersionId
  FileVersion under that existing File
```

All database/unit tests that use the old shape must be migrated in the same
implementation batch. This is a deterministic expected test failure, not a
reason to weaken the provenance rule.

### 9.2 Future source changes required

The later source implementation must:

- add the Prisma fields/relations;
- set `createdByUploadIntentId` in both new-File creation paths;
- preserve the File/FileVersion/current/Intent completion transaction;
- update recovery reads to include provenance;
- map origin/provenance invariant failures to Fail Closed business errors;
- update the fixture helper and all affected tests.

No source is changed in R4.

## 10. Negative Tests and SQLSTATE

Every negative test records:

```text
target control
fixture identities
exact SQL
session/transaction barrier
first rejecting Trigger/Constraint/Index
SQLSTATE
custom message or constraint name
pre/post rows
commit/rollback result
```

Trigger errors use a unique message and catalog confirmation. Deferred
constraint errors are observed at COMMIT and the failing constraint name is
captured.

### 10.1 Required matrix

| ID | Target | Fixture and operation | First control | SQLSTATE | Proof |
|---|---|---|---|---|---|
| `R4-T-01` | Legal new File | N/N UPLOADING I; File origin I; version/current/complete I | successful | none | full terminal chain committed |
| `R4-T-02` | N/N completes under existing File | existing File F; version under F; complete N/N I | completion provenance guard | `42501` | custom mismatched-origin message |
| `R4-T-03` | N/N completes under File of another Intent | File origin J; complete Intent I | completion provenance guard | `42501` | custom message |
| `R4-T-04` | Two Files claim one Intent | two origin File INSERTs for I | unique index | `23505` | `file_createdByUploadIntentId_key` |
| `R4-T-05` | File origin references Append Intent | I/I Intent; File origin I | File origin Trigger | `23514` | custom origin-state message |
| `R4-T-06` | Mutate File origin | UPDATE `createdByUploadIntentId` | origin immutability Trigger | `42501` | custom immutable message |
| `R4-T-07` | Commit File without completed chain | origin File only | deferred consumed-chain guard | `23514` | COMMIT fails |
| `R4-T-08` | Stale Append reservation | current FV1, expected FV0 | entry Trigger | `23514` | stale-reservation message |
| `R4-T-09` | Direct current advance under UPLOADING | current FV1→FV2, Intent remains UPLOADING expected FV1 | deferred File invariant | `23514` | COMMIT fails |
| `R4-T-10` | Legal same-tx finalization | current→new and Intent COMPLETED in one transaction | successful | none | final pointer/Intent state |
| `R4-T-11` | Active Append missing expected | I/F active | expected Trigger | `23514` | trigger message; not Pair CHECK |
| `R4-T-12` | New target with expected | N/F | Pair CHECK | `23514` | `upload_intent_expected_current_pair_check` |
| `R4-T-13` | Cross-File expected isolated | transient cross current/reservation then matching same-File current before COMMIT | compound FK | `23503` | exact FK name |
| `R4-T-14` | Expected FileVersion DELETE | real referenced version | first BEFORE DELETE Trigger | `42501` | phase31 identity-guard message |
| `R4-T-15` | Target File DELETE | File with version/Intent history | FK | `23503` | reference constraint name |
| `R4-T-16` | UPDATE `existingFileId` | existing Intent | early identity Trigger | `42501` | phase32 identity message |
| `R4-T-17` | UPDATE expected-current ID | existing Intent | target-slot Trigger | `23514` | target-slot message |
| `R4-T-18` | Two active slots | two Sessions reserve same File | File lock/unique index | `23505` | active index name |
| `R4-T-19` | Migration with active writer | writer holds related lock | `NOWAIT` lock gate | `55P03` | no precheck/DDL |
| `R4-T-20` | Prisma failed Migration | retry unfinished row | Prisma runner | P3018/P3009 | migration history/output |

### 10.2 Target-control caveat

PostgreSQL BEFORE triggers run before row CHECKs. Therefore:

- active F/N is normally rejected by the custom expected Trigger
  (`23514`), not by the Pair CHECK;
- N/F passes the creation Trigger and reaches Pair CHECK (`23514`);
- FileVersion DELETE is rejected by the first BEFORE identity Trigger
  (`42501`), not the FK (`23503`).

Tests must not claim the wrong control was proven.

The pair CHECK is also catalog-verified and evaluated over all 20 Boolean
combinations. That evaluation is not described as a PostgreSQL behavior test.

### 10.3 Cross-File FK isolation

To reach the deferred compound FK without an earlier snapshot rejection:

1. within one transaction, temporarily set target File current to the
   cross-File expected version while the File same-File FK remains deferred;
2. insert/reserve the Append while current matches;
3. create a legal FileVersion for the append target;
4. reset File current to the new same-File version;
5. complete the Intent;
6. COMMIT.

The File same-File FK then passes, while the Intent compound FK still points
cross-File and must fail `23503`. The test must assert the compound constraint
name and roll back.

## 11. Complete State Matrix

### 11.1 Intent target/null

| Status | N/N | I/I | F/N | N/F |
|---|---|---|---|---|
| PENDING | new File candidate | Append candidate | reject | reject |
| UPLOADING | new File upload | Append reservation | reject | reject |
| COMPLETED | new File complete with origin | Append complete | legacy terminal only | reject |
| FAILED | new File history | Append history | legacy terminal only | reject |
| EXPIRED | new File history | Append history | legacy terminal only | reject |

### 11.2 New File provenance

| Intent | File origin | Version | Result |
|---|---|---|---|
| UPLOADING N/N | NULL | none | creation may proceed |
| UPLOADING N/N | I | none | pending same-tx chain |
| COMPLETED N/N | I | matching | pass |
| COMPLETED N/N | NULL/other | matching | reject |
| COMPLETED N/N | I | wrong File/Intent | reject |
| FAILED/EXPIRED | I | none | File-only commit rejected |

### 11.3 Append terminal

| Existing target | Expected | Final current | Result |
|---|---|---|---|
| I | FV1 | FV1 while UPLOADING | pass |
| I | FV1 | FV2 while UPLOADING | reject |
| I | FV1 | FV2 with COMPLETED FV2 | pass |
| I | NULL | any | reject |
| NULL | FV | any | reject |

## 12. Responsibilities

| Invariant | Database | Application |
|---|---|---|
| New File origin | unique FK and origin/terminal guards | populate exact Intent id |
| File-only partial commit | deferred consumed-chain guard | keep finalization in one transaction |
| One active Append | partial unique index | CAS reservation |
| Entry snapshot | INSERT/UPDATE Triggers | File lock/CAS |
| Persistent snapshot | deferred Intent/File Triggers | current update + completion same tx |
| Same-File expected version | compound FK | immutable target |
| Target pair shape | CHECK | valid construction |
| Current pointer | CAS, same-File FK, completion guard | update before completion |
| Provider uncertainty | outside DB rollback | retain/discover exact object |

## 13. Migration Failure and Retry

```text
active writer prevents NOWAIT lock:
  55P03
  Prisma P3018
  no precheck or DDL

invalid historical data:
  23514
  Prisma P3018
  no DDL

later DDL failure:
  full migration transaction rollback
  no partial column/index/FK/Trigger

unchanged retry:
  P3009
```

Prior controlled R2 evidence proves P3018/P3009 behavior for the preceding
R3 precheck:

```text
wp-2a-cm1-controlled-validation-completion-r2.md:266-315
```

It does not prove post-precheck DDL rollback or deadlock behavior for this
Migration. Those remain future evidence.

## 14. Historical Finding Tracker

| Finding | Status | Basis |
|---|---|---|
| `CM1-R2-IReview-P1-01` | `RESOLVED` | durable File origin + completion/terminal guards |
| `CM1-R2-IReview-P2-01` | `RESOLVED` | stale PENDING preserved; only illegal/stale active states block |
| `CM1-R2-IReview-P2-02` | `NOT VERIFIED` | one Prisma semantic edge defined; generated SQL not run |
| `CM1-R2-IReview-P2-03` | `RESOLVED` | full lifecycle and corrected SQLSTATE matrices |
| `CM1-R2-IReview-P3-01` | `RESOLVED` | split INSERT/UPDATE Triggers; runtime unverified |
| `R3-P1-01` | `RESOLVED` | `File.createdByUploadIntentId` origin protocol |
| `R3-P1-02` | `RESOLVED` | deferred persistent Append snapshot |
| `R3-P2-01` | `RESOLVED` | offline drain + NOWAIT three-table gate |
| `R3-P2-02` | `RESOLVED` | exact first-control/SQLSTATE test matrix |
| binding-parent-chain duplicate | `NOT VERIFIED` | outside current scope |
| orphan FileVersion | `NOT VERIFIED` | outside current scope |
| multiple FileVersion terminal | `NOT VERIFIED` | outside current scope |
| `P2-05` | `OPEN` | retention policy unresolved |
| R5 57 Open Decisions | `OPEN` | no product decision here |
| BV7 | `FAIL` | unchanged |
| BV8 | `NOT VERIFIED` | no independent approval |
| historical R8 | `BLOCKED` | governance blocker unchanged |
| real Provider | `NOT VERIFIED` | out of scope |
| Windows OS fencing | `NOT VERIFIED` | out of scope |
| IAM/ACL | `NOT VERIFIED` | out of scope |
| live Web/Worker PostgreSQL integration | `NOT VERIFIED` | out of scope |
| production Migration/deployment | `BLOCKED` | no authorization |

`RESOLVED` means the design now has a concrete database-enforceable rule and
source-based test. It does not mean PostgreSQL executed it.

## 15. Remaining Unverified and Out of Scope

This design does not claim:

- Trigger/FK/CHECK code compiles;
- Prisma emits the intended SQL;
- the Migration is online safe;
- the old upload chain is fully integrated;
- real Provider conditional write/discovery works;
- Windows OS-level fencing exists;
- IAM/ACL boundaries are implemented;
- Web/Worker E2E passes;
- production data migration is authorized.

## 16. Controlled PostgreSQL Validation Plan

After separate authorization:

1. Create a disposable isolated PostgreSQL 18 instance.
2. Apply all Migrations including R4.
3. Compare generated Prisma SQL with hand-written SQL.
4. Verify catalog columns, unique indexes, FK order/actions, MATCH,
   deferrability, CHECK and Trigger events.
5. Run `R4-T-01` through `R4-T-20` with raw outputs.
6. Run `MIG-*` vectors on a non-empty clone.
7. Run new-File legal and misbound provenance cases.
8. Run two-session persistent Append snapshot cases.
9. Run COMMIT-response-loss with a new connection.
10. Run Prisma failure and P3009 retry history.
11. Dispose only the isolated instance through the approved control path.
12. Keep production, shared DB, Provider and deployment out of scope.

## 17. Git State

### Before this report

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  77
Untracked files:        78
```

### After this report

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  78
Untracked files:        79
New report:             docs/architecture/wp-2a-cm1-append-intent-relational-integrity-remediation-design-r4.md
```

Only this report was added.

## 18. Report Metadata

Final SHA-256, byte count and line count are recorded in the delivery response
to avoid a self-referential hash.

Static checks:

```text
Markdown fences:      balanced
Trailing whitespace: none
PostgreSQL execution: none
Build/test execution: none
Provider access:      none
```

## 19. Final Design Decision

```text
DESIGN COMPLETE — READY FOR INDEPENDENT REVIEW
```

The design provides:

- durable unique new-File creation provenance;
- a completion and COMMIT guard binding the full new-File chain;
- persistent committed UPLOADING Append current equality;
- an offline drain/NOWAIT Migration gate preventing the known lock cycle;
- deterministic first-control and SQLSTATE verification requirements.

PostgreSQL and Prisma runtime validation remain the next separately authorized
stage.

