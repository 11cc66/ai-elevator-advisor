# WP-2A-CM1-R3 — Append Intent Relational Integrity Remediation Design

## 0. Final Conclusion

```text
DESIGN COMPLETE — READY FOR INDEPENDENT REVIEW
```

The R2 PostgreSQL validation defect is real: PostgreSQL accepted an
`UPLOADING` append Intent whose `expectedCurrentFileVersionId` belonged to a
different File. The recommended design closes this relation with a database
composite foreign key, plus a narrowly scoped reservation/creation trigger for
the time-sensitive current-version snapshot.

This report is design-only. It does not change Schema, Migration, source,
triggers, tests, roles or databases, and it does not claim the proposed
constraints have already been implemented or PostgreSQL-executed.

## 1. Inputs and Evidence

Reviewed inputs:

```text
docs/architecture/wp-2a-cm1-controlled-validation-completion-r2.md
docs/architecture/wp-2a-cm1-postgresql-independent-review-r1.md
docs/architecture/wp-2a-cm1-postgresql-controlled-validation.md
prisma/schema.prisma
prisma/migrations/20261115213000_phase31_file_data_model/migration.sql
prisma/migrations/20261115233000_phase32_upload_intents/migration.sql
prisma/migrations/20261126130000_phase38_route_c_minimal_recovery_hardening/migration.sql
apps/web/src/modules/files/upload-service.ts
apps/web/src/modules/files/object-upload-service.ts
```

The decisive observed R2 evidence is:

```text
stale_intent|ia_stale|f_stale|fv_r2||UPLOADING
```

`fv_r2` belongs to `f_r2`; `ia_stale.existingFileId` is `f_stale`. The
PostgreSQL transaction committed.

Current relevant schema:

```text
FileVersion:
  id          String @id
  fileId      String
  @@unique([id, fileId])                 // prisma/schema.prisma:441

FileUploadIntent:
  existingFileId                String?
  expectedCurrentFileVersionId  String?
  status                        FileUploadIntentStatus
```

R3 currently has only:

```sql
ALTER TABLE "file_upload_intent"
  ADD CONSTRAINT "file_upload_intent_expectedCurrentFileVersion_fkey"
  FOREIGN KEY ("expectedCurrentFileVersionId")
  REFERENCES "file_version"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
```

This proves version existence but not ownership by `existingFileId`.

## 2. Existing Database Precedent

The repository already has the exact same-file relation pattern for a File's
current pointer:

```sql
ALTER TABLE "file"
ADD CONSTRAINT "file_current_version_same_file_fkey"
FOREIGN KEY ("currentVersionId", "id")
REFERENCES "file_version"("id", "fileId")
DEFERRABLE INITIALLY DEFERRED;
```

Reference: `prisma/migrations/20261115233000_phase32_upload_intents/migration.sql:107-111`.

The parent key already exists:

```sql
CREATE UNIQUE INDEX "file_version_id_fileId_key"
  ON "file_version"("id", "fileId");
```

Reference: `prisma/migrations/20261115213000_phase31_file_data_model/migration.sql:213`.

Therefore adding a new `(fileId,id)` index is unnecessary. Reusing
`file_version(id,fileId)` has the lowest schema cost and follows an existing
database invariant.

## 3. Alternatives Compared

| Option | Cross-File protection | Null/new-File behavior | History compatibility | Complexity |
|---|---|---|---|---|
| Add/reuse unique `(fileId,id)` only | None | None | None | Insufficient |
| Composite FK on `(expectedCurrentFileVersionId, existingFileId)` | Strong, at commit | `MATCH SIMPLE` skips partial NULLs; pair CHECK needed | Historical terminal NULL expected can be preserved with status-aware check | Recommended |
| Trigger-only ownership check | Strong for DML that executes trigger | Must implement every insert/update path | Requires careful trigger coverage | Higher risk |
| Permanent FK to `file.currentVersionId` | Would invalidate history on normal current-version changes | Not viable for historical Intents | Fails temporal requirement | Rejected |
| Application-only CAS | Normal service path protected | Direct DML bypasses | No DB authority | Rejected |

Recommended: **reuse existing `file_version(id,fileId)` parent UNIQUE and add a
composite FK, supplemented by a narrow active-status/current-snapshot trigger.**

## 4. Recommended Relational Model

### 4.1 Parent key

No new parent key is required:

```text
file_version(id, fileId)
UNIQUE: file_version_id_fileId_key
```

This key is already present and is the parent of
`file_current_version_same_file_fkey`.

### 4.2 Child composite FK

Proposed forward DDL:

```sql
ALTER TABLE "file_upload_intent"
ADD CONSTRAINT "file_upload_intent_expected_current_same_file_fkey"
FOREIGN KEY (
  "expectedCurrentFileVersionId",
  "existingFileId"
)
REFERENCES "file_version"("id", "fileId")
MATCH SIMPLE
ON DELETE RESTRICT
ON UPDATE RESTRICT
DEFERRABLE INITIALLY DEFERRED;
```

This guarantees that whenever both fields are non-NULL:

```text
expectedCurrentFileVersionId
  exists in file_version
and its file_version.fileId = existingFileId.
```

The existing single-column `file_upload_intent_expectedCurrentFileVersion_fkey`
may remain as an additional version-existence guard. It is not sufficient by
itself and must not be described as same-File proof.

### 4.3 NULL and pair CHECK

PostgreSQL `MATCH SIMPLE` skips the composite FK if either child column is
NULL. Add a status-aware CHECK so that active new-file and append paths are
unambiguous while old terminal history is preserved:

```sql
ALTER TABLE "file_upload_intent"
ADD CONSTRAINT "upload_intent_expected_current_pair_check"
CHECK (
  (
    "existingFileId" IS NULL
    AND "expectedCurrentFileVersionId" IS NULL
    AND "status" IN ('PENDING', 'COMPLETED', 'FAILED', 'EXPIRED')
  )
  OR
  (
    "existingFileId" IS NOT NULL
    AND "expectedCurrentFileVersionId" IS NOT NULL
  )
  OR
  (
    "existingFileId" IS NOT NULL
    AND "expectedCurrentFileVersionId" IS NULL
    AND "status" IN ('COMPLETED', 'FAILED', 'EXPIRED')
  )
);
```

Rules:

- New File Intent: `existingFileId=NULL`, `expectedCurrentFileVersionId=NULL`
  for `PENDING` or terminal status.
- Active append Intent: both IDs MUST be non-NULL.
- Old terminal append history with `existingFileId` present but
  `expectedCurrentFileVersionId=NULL` remains readable and immutable.
- `existingFileId=NULL` with an expected version is invalid in every status.
- An active append with a missing expected version is rejected.

The CHECK intentionally does not compare expected to the File's *current*
version. That comparison is temporal and belongs to creation/reservation
triggers, not a permanent row constraint: a legitimate PENDING Intent must
remain historical after a later normal File current-version change.

### 4.4 Existing File FK

The current `file_upload_intent_existingFileId_fkey` is `ON DELETE SET NULL`.
For historical append integrity, replace it with:

```sql
ALTER TABLE "file_upload_intent"
DROP CONSTRAINT "file_upload_intent_existingFileId_fkey";

ALTER TABLE "file_upload_intent"
ADD CONSTRAINT "file_upload_intent_existingFileId_fkey"
FOREIGN KEY ("existingFileId")
REFERENCES "file"("id")
ON DELETE RESTRICT
ON UPDATE RESTRICT;
```

This prevents a File deletion from converting an append Intent into a
half-null pair. The existing FileVersion and lifecycle deletion guards already
make physical deletion non-ordinary; this change makes the relation explicit
at the Intent boundary.

## 5. Expected-Current Time Semantics

The two IDs mean different things at different times:

| Moment | Meaning | Database responsibility |
|---|---|---|
| Intent INSERT | Snapshot of the target File current version at creation | Same-File FK; creation trigger checks current snapshot |
| Intent PENDING | Historical reservation candidate | Pair CHECK; no permanent current equality |
| PENDING -> UPLOADING | Reservation attempt | File row lock, current equality, state CAS, active append unique |
| File current changes later | A legitimate new version can replace current | Must not invalidate historical Intents |
| Intent COMPLETED/FAILED/EXPIRED | Historical record | Terminal rows may retain old expected-current or, for legacy terminal rows, NULL expected |
| Two append reservations | Same expected snapshot | File row lock/current check and partial unique index |

The database should **not** maintain a permanent FK from
`expectedCurrentFileVersionId` to `file.currentVersionId`. That would break
legitimate history as soon as a newer version becomes current.

## 6. Reservation Transaction Sequence

The service already follows this general sequence:

```text
load Intent and project ownership
-> begin transaction
-> create/reserve Attempt and Lifecycle/Operation
-> UPDATE Intent PENDING -> UPLOADING
-> SELECT File.currentVersionId FOR UPDATE
-> compare persisted expectedCurrentFileVersionId
-> commit
```

The relevant source is `upload-service.ts:507-548` and
`object-upload-service.ts:371-390`. The current File lock is essential and
must remain.

Recommended database trigger:

```sql
CREATE OR REPLACE FUNCTION "p13_assert_append_current_snapshot"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_version VARCHAR;
BEGIN
  IF NEW."existingFileId" IS NOT NULL
     AND (
       (TG_OP = 'INSERT' AND NEW.status IN ('PENDING', 'UPLOADING'))
       OR (TG_OP = 'UPDATE'
           AND NEW.status = 'UPLOADING'
           AND OLD.status <> 'UPLOADING')
     )
  THEN
    IF TG_OP = 'UPDATE' THEN
      SELECT "currentVersionId" INTO current_version
      FROM "file"
      WHERE id = NEW."existingFileId"
      FOR UPDATE;
    ELSE
      SELECT "currentVersionId" INTO current_version
      FROM "file"
      WHERE id = NEW."existingFileId"
      FOR SHARE;
    END IF;

    IF NOT FOUND OR
       current_version IS DISTINCT FROM NEW."expectedCurrentFileVersionId"
    THEN
      RAISE EXCEPTION
        'append expected-current does not match target File current version'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "p13_append_current_snapshot_guard"
BEFORE INSERT OR UPDATE OF
  "status", "existingFileId", "expectedCurrentFileVersionId"
ON "file_upload_intent"
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_append_current_snapshot"();
```

The trigger:

- checks creation snapshot for a non-NULL existing File;
- rechecks only on entry into `UPLOADING`;
- does not check terminal historical rows;
- takes `FOR SHARE` on Intent INSERT and `FOR UPDATE` on reservation;
- uses no global lock and no table-wide serialization;
- leaves existing app-level File lock and CAS in place as defense in depth.

The app and trigger must run in the same transaction; the database cannot make
an already dispatched Provider operation atomic with this row check.

## 7. Two-Session Competition Analysis

### Same expected-current snapshot

```text
Session A:
  BEGIN
  UPDATE Intent A PENDING -> UPLOADING
    -> trigger locks File and verifies current
    -> active append unique index grants A
  lock File / finalize or leave current
  COMMIT

Session B:
  BEGIN
  UPDATE Intent B PENDING -> UPLOADING
    -> waits on File/row or active unique index
    -> if A finalized current: check fails 23514
    -> if current unchanged: active append unique fails 23505
  COMMIT/ROLLBACK
```

Only one transaction can commit a valid active append. A failed transaction
must roll back its Attempt, Lifecycle, Operation and Intent changes; no partial
reservation is allowed.

### Current version changes after Intent creation

An Intent created while `fv_old` was current remains PENDING with
`expectedCurrentFileVersionId=fv_old`. A later normal version transition to
`fv_new` is allowed and does not mutate the historical Intent. If the old
Intent is then reserved, the trigger compares `fv_old` to `fv_new` and rejects
with `23514`; application maps this to a controlled target-changed conflict.

## 8. Prisma Model Impact

The existing parent unique key is already represented:

```prisma
model FileVersion {
  // ...
  @@unique([id, fileId])
}
```

Proposed relation change:

```prisma
model FileUploadIntent {
  // existingFile relation remains
  existingFile File? @relation(
    "ExistingUploadIntentFile",
    fields: [existingFileId],
    references: [id],
    onDelete: Restrict
  )

  expectedCurrentFileVersion FileVersion? @relation(
    "IntentExpectedCurrentVersion",
    fields: [
      expectedCurrentFileVersionId,
      existingFileId
    ],
    references: [id, fileId],
    onDelete: Restrict,
    onUpdate: Restrict
  )
}
```

A non-database schema probe copied only to the system temporary directory and
run with `prisma validate` accepted this composite relation shape. This is
static schema validation, not an applied Migration.

The existing single-column expected-version FK may remain in Prisma metadata or
be replaced by the composite relation in a subsequent generated migration;
the design requires one authoritative database relation and no divergent
constraint set. Implementation must compare Prisma-generated SQL with the
approved forward SQL before applying it.

## 9. Historical Data Precheck

Before adding the composite FK/CHECK/trigger, a read-only precheck must classify
and stop on unsafe historical rows. No values may be invented.

Required counts:

```text
A. active_pair_missing
   status IN ('PENDING','UPLOADING')
   and exactly one of existingFileId / expectedCurrentFileVersionId is NULL

B. dangling_expected_version
   expectedCurrentFileVersionId IS NOT NULL
   and no matching file_version(id,fileId)

C. cross_file_expected
   existingFileId IS NOT NULL
   and expectedCurrentFileVersionId IS NOT NULL
   and (file_version.id,file_version.fileId)
       <> (expectedCurrentFileVersionId, existingFileId)

D. active_current_mismatch
   status IN ('PENDING','UPLOADING')
   and both IDs are non-NULL
   and currentVersionId IS DISTINCT FROM expectedCurrentFileVersionId

E. active_existing_without_snapshot
   status IN ('PENDING','UPLOADING')
   and existingFileId IS NOT NULL
   and expectedCurrentFileVersionId IS NULL

F. new_file_with_expected
   existingFileId IS NULL
   and expectedCurrentFileVersionId IS NOT NULL
```

Policy:

- A, B, C, D, E, F > 0: fail before any DDL with `23514`.
- Terminal `COMPLETED/FAILED/EXPIRED` rows with `existingFileId` and NULL
  expected may remain as non executable historical records under the
  status-aware CHECK.
- Do not fill NULL historical expected IDs with guessed current versions.
- Do not create or delete historical FileVersions during this migration.
- Do not apply a default current version.

Migration must execute this precheck before the first `ALTER TABLE` or use an
explicit transaction whose atomic rollback behavior has already been proven in
the isolated PostgreSQL clone.

## 10. Migration and Retry Behavior

Proposed forward migration name:

```text
20261126140000_phase39_append_expected_current_integrity
```

It must be a new migration after:

```text
20261126130000_phase38_route_c_minimal_recovery_hardening
```

Do not modify the already-applied R3 migration. The new migration should:

1. run the read-only precheck;
2. stop before DDL on any unsafe row;
3. add the composite FK;
4. replace the existing File FK behavior with RESTRICT;
5. add the status-aware pair CHECK;
6. create the current-snapshot trigger;
7. run postcheck queries for parent FK, CHECK, trigger and data counts.

On a Prisma runner failure, the expected visible behavior is:

```text
nonzero Prisma exit
P3018 or equivalent database failure
_prisma_migrations row for the new migration unfinished
no R3-like future migration marked finished
no partial constraint/schema change
```

R2 already demonstrated P3018/P3009 behavior for the preceding R3 migration;
the new Migration must repeat that evidence on a new isolated database. A
failed migration must not be automatically retried after a data correction;
an explicit, reviewed `migrate resolve` or clean replacement instance is
required.

## 11. Test Matrix

| ID | Case | Expected |
|---|---|---|
| `AI-01` | New File: both IDs NULL, PENDING | commit success |
| `AI-02` | Existing File append: both IDs non-NULL and matching | commit success |
| `AI-03` | Cross-File expected version | composite FK `23503` |
| `AI-04` | Existing File append without expected | pair CHECK `23514` |
| `AI-05` | New File with expected version | pair CHECK `23514` |
| `AI-06` | Old terminal intent with existing File and NULL expected | preserved, query-only |
| `AI-07` | PENDING current changes before reservation | reservation transition `23514`; historical row remains |
| `AI-08` | Same expected-current from two active Intents | one winner; loser `23505` from partial unique index |
| `AI-09` | Two reservations with current version change | one winner; loser current mismatch `23514` |
| `AI-10` | Failed reservation rollback | no Attempt/Lifecycle/Operation partial rows |
| `AI-11` | Direct UPDATE expected version to another File | constraint/trigger rejection or immutable guard |
| `AI-12` | Delete target File/FileVersion | RESTRICT; no orphan Intent |
| `AI-13` | Migration unsafe active missing expected | precheck `23514`, no DDL |
| `AI-14` | Migration unsafe cross-File expected | precheck `23514`, no DDL |
| `AI-15` | Prisma failed migration | P3018/P3009, unfinished history, no DDL |
| `AI-16` | Same-file valid historical current snapshot after new current version | remains historical, non executable |

The test must capture:

- SQL, exit code and SQLSTATE;
- pre/post row states;
- rowcounts for reservation CAS;
- File currentVersionId before/after;
- active append count;
- transaction rollback;
- Prisma history rows.

## 12. Compatibility and Performance

Compatibility:

- Existing FileVersion `(id,fileId)` unique key is reused; no new parent
  index is needed.
- New-file Intents with both NULL remain valid.
- Terminal historical append Intents with missing expected remain readable.
- Existing File current-version changes do not invalidate historical Intents.
- Existing active append unique index remains the slot authority.
- Existing terminal Binding/Lifecycle/Operation/FileVersion deferred guards
  remain unchanged.

Performance:

- Composite FK uses the existing unique parent index.
- The trigger locks one File row only on Intent insertion and the
  `PENDING -> UPLOADING` transition.
- No global advisory lock, table lock or full-table scan is used in normal
  request paths.
- The active append partial unique index remains the primary concurrent
  serialization point.

## 13. Remaining Unverified and Out-of-Scope Items

This design does not prove or implement:

```text
PostgreSQL execution of new DDL
Prisma Migration application
Live Web/Worker + PostgreSQL integration
Real Provider behavior
Windows OS-level storage fencing
IAM/ACL
E2E or deployment
```

Existing open independent items remain:

```text
R5 57 Open Decisions:          OPEN
BV7:                           FAIL
BV8:                           NOT INDEPENDENTLY APPROVED
Historical governance R8:      BLOCKED
P2-05 business retention:      OPEN
```

The objectKey binding-index test, orphan/multiple FileVersion matrix and
live application integration from the prior report remain independent gaps.
They are not repaired by this design.

## 14. Git and Worktree

### Before design review preparation

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  73
Untracked files:        74
```

### After this report

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  74
Untracked files:        75
New report:             docs/architecture/wp-2a-cm1-append-intent-relational-integrity-remediation-design-r1.md
```

Only this design report was added. No source, Schema, Migration, test,
configuration, database or existing report was modified.

## 15. Final Design Decision

```text
DESIGN COMPLETE — READY FOR INDEPENDENT REVIEW
```

The recommended solution is the smallest database-authoritative correction:

- reuse the existing `file_version(id,fileId)` unique parent key;
- add `(expectedCurrentFileVersionId,existingFileId)` composite FK with
  `MATCH SIMPLE` and RESTRICT actions;
- add a status-aware pair CHECK that preserves terminal historical NULLs;
- add a narrow row-locking current-snapshot trigger for creation and
  `PENDING -> UPLOADING`;
- retain the application lock/CAS and active append unique index;
- precheck all unsafe historical rows before any DDL;
- reject unsafe migration state without guessing or deleting history.

The design cannot be implemented or declared database-verified until a
separate source/Migration/test authorization and isolated PostgreSQL execution
are granted.
