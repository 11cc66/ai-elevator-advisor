# WP-2A-CM1 — Append Intent Relational Integrity Design Remediation R2

## 0. Final Conclusion

```text
DESIGN COMPLETE — READY FOR INDEPENDENT REVIEW
```

This report corrects all five findings from the independent review R2:

```text
CM1-R2-IReview-P1-01   RESOLVED BY DESIGN
CM1-R2-IReview-P2-01   RESOLVED BY DESIGN
CM1-R2-IReview-P2-02   RESOLVED BY DESIGN
CM1-R2-IReview-P2-03   RESOLVED BY DESIGN
CM1-R2-IReview-P3-01   RESOLVED BY DESIGN
```

The corrected design:

- allows the normal new-File `UPLOADING` state with both target IDs NULL;
- still requires every PENDING/UPLOADING append Intent to carry both
  `existingFileId` and `expectedCurrentFileVersionId`;
- uses the existing `file_version(id,fileId)` unique parent key for a
  same-File composite foreign key;
- preserves legitimate stale PENDING history and blocks only relationally
  invalid history or an invalid existing UPLOADING snapshot during Migration;
- declares one authoritative Prisma expected-current relation;
- splits creation and reservation checks into separate PostgreSQL triggers so
  the INSERT trigger never reads `OLD`.

This is a design-only result. No PostgreSQL DDL, Trigger, Migration, service,
Provider, Build, E2E or test was executed in this task.

## 1. Document Control

Original design:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-remediation-design-r1.md
SHA-256 ACD92DBB21908EBD9D8A40F410EC7572A2673F5BEEBF519A721DDD5A94069F27
```

Independent review:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-independent-review-r2.md
```

Expected and actual independent-review SHA-256:

```text
713F07DF79085C6FB57F147DDCCBBCD935393CDD9AEB49E24FBFDE5128A2AE1B
```

The review hash matches the supplied baseline.

## 2. Authorization and Evidence Scope

This task was limited to read-only analysis and this new report.

Read and checked:

- The complete independent review R2, including all five findings.
- The original design R1.
- Current `prisma/schema.prisma`.
- All current upload-intent, FileVersion, lifecycle and recovery Migrations.
- Current local and object upload services.
- Current contracts and relevant service/database tests.
- The applicable root/blueprint product and implementation documents.
- Complete `FZ`, `ST`, `DBTP` and the upload-intent lifecycle decision records.
- The R2 controlled PostgreSQL evidence and Prisma failure-history evidence.
- Current Git state.

Not performed:

- Source, Schema, Migration, SQL, Trigger, test or configuration changes.
- PostgreSQL startup, connection, SQL, Migration or database reads/writes.
- Web, Worker, Provider, Storage, IAM/ACL, Build, E2E or deployment.
- Deletion, move, rename or modification of historical evidence or worktree
  files.

## 3. Current Source and Database Facts

### 3.1 Current Prisma model

`FileVersion` already has the required parent uniqueness:

```prisma
@@unique([id, fileId])
```

Source:

```text
prisma/schema.prisma:441
```

`FileUploadIntent` currently has two nullable target fields:

```text
existingFileId
expectedCurrentFileVersionId
```

and a single-column expected-current relation:

```text
prisma/schema.prisma:524-525, 549-550
```

### 3.2 Current parent index

```sql
CREATE UNIQUE INDEX "file_version_id_fileId_key"
  ON "file_version"("id", "fileId");
```

Source:

```text
prisma/migrations/20261115213000_phase31_file_data_model/migration.sql:213
```

This is the parent key for both the existing File current-version same-File FK
and the revised expected-current FK.

### 3.3 Current target FKs

Existing File target:

```text
prisma/migrations/20261115233000_phase32_upload_intents/migration.sql:81

existingFileId -> file(id)
ON DELETE SET NULL
ON UPDATE CASCADE
```

Existing project-ownership composite:

```text
prisma/migrations/20261115233000_phase32_upload_intents/migration.sql:144-149

(existingFileId, projectId) -> file(id, projectId)
ON DELETE RESTRICT
ON UPDATE CASCADE
```

Current expected-current FK:

```text
prisma/migrations/20261126130000_phase38_route_c_minimal_recovery_hardening/migration.sql:103-107

expectedCurrentFileVersionId -> file_version(id)
ON DELETE RESTRICT
ON UPDATE RESTRICT
```

It proves version existence only and does not prove that the version belongs to
`existingFileId`.

### 3.4 Current active append slot

```sql
CREATE UNIQUE INDEX "one_active_append_intent_per_file"
  ON "file_upload_intent"("existingFileId")
  WHERE "existingFileId" IS NOT NULL
    AND "status" = 'UPLOADING';
```

Source:

```text
prisma/migrations/20261126130000_phase38_route_c_minimal_recovery_hardening/migration.sql:112-116
```

This remains the active append slot authority.

### 3.5 Current Intent state guard

New Intent rows must be PENDING:

```text
prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:1959-1966
```

Allowed status changes:

```text
PENDING -> UPLOADING | EXPIRED
UPLOADING -> PENDING | COMPLETED | FAILED | EXPIRED
FAILED -> EXPIRED
```

Source:

```text
prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:1988-2001
```

The deferred upload-chain guard validates final Intent/Attempt/FileVersion
counts at COMMIT:

```text
prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:1194-1357
```

### 3.6 Current target immutability

`existingFileId` is immutable after INSERT:

```text
prisma/migrations/20261115233000_phase32_upload_intents/migration.sql:152-188
prisma/migrations/20261115234500_phase32_upload_recovery_key/migration.sql:83-129
prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:1970-1985
```

`expectedCurrentFileVersionId` is immutable after INSERT:

```text
prisma/migrations/20261126130000_phase38_route_c_minimal_recovery_hardening/migration.sql:446-465
```

Therefore a normal row cannot be moved between target Files after creation.

### 3.7 Current service paths

Create Intent reads the existing File current version without a File row lock:

```text
apps/web/src/modules/files/upload-service.ts:121-157
```

The resulting Intent is inserted with:

```text
existingFileId = request target or NULL
expectedCurrentFileVersionId = captured target or NULL
status = PENDING
```

Source:

```text
apps/web/src/modules/files/upload-service.ts:168-232
```

Both upload backends create the Attempt/Lifecycle chain and then perform the
conditional `PENDING -> UPLOADING` update before any external object write:

```text
apps/web/src/modules/files/upload-service.ts:484-563
apps/web/src/modules/files/object-upload-service.ts:324-391
```

They then lock and compare the target File current version as application
defense in depth.

Finalization again locks the target File, creates the FileVersion, CAS-updates
`File.currentVersionId`, and finally completes the Intent:

```text
apps/web/src/modules/files/upload-service.ts:1116-1235
apps/web/src/modules/files/object-upload-service.ts:995-1117
```

For a new File, both target Intent IDs remain NULL. The File is created later.

## 4. Complete Finding Disposition

| Finding | Original failure and impact | Root cause | Corrected design | Test additions | Disposition | Remaining limitation |
|---|---|---|---|---|---|---|
| `P1-01` | All normal new-File uploads would fail at reservation | The first CHECK branch conflated “active append” with “any active upload” and omitted UPLOADING | Both IDs NULL allowed in every Intent status; append still requires both | New-File reservation and completion tests; complete 20-cell NULL matrix | Resolved by design | Must be PostgreSQL-executed later |
| `P2-01` | Legal stale PENDING history would make Migration stop unnecessarily | Any active current mismatch was treated as relational invalidity rather than temporal staleness | Stale PENDING is classified and preserved; only invalid relation and existing UPLOADING current mismatch block | Stale PENDING migration vector; stale reservation vector | Resolved by design | Actual non-empty Migration execution remains `NOT VERIFIED` |
| `P2-02` | Future Prisma diffs could retain/drop different expected-current FKs | The design allowed both a single-column relation and a compound relation to remain authoritative | Old single-column expected FK is removed; one compound relation is authoritative | Prisma validate, generated-SQL inspection, from-migrations/to-schema diff | Resolved by design | Prisma Client generation and Migration diff not run |
| `P2-03` | The matrix could pass while breaking the primary new-File use case | Tests covered PENDING new File but omitted its required UPLOADING transition | New-File PENDING, UPLOADING and completed paths are mandatory tests; full matrix added | `AI2` matrix below | Resolved by design | Runtime test execution remains future work |
| `P3-01` | Trigger syntax or unavailable `OLD` fields could fail at runtime | INSERT and UPDATE behaviors were combined in one event declaration/function branch | Separate INSERT and UPDATE trigger functions; INSERT cannot access `OLD` | Compile/runtime tests for both triggers | Resolved by design | PostgreSQL trigger compilation not executed |

## 5. Revised Intent Classification

### 5.1 New-File Intent

Definition:

```text
existingFileId IS NULL
AND expectedCurrentFileVersionId IS NULL
```

Valid states:

```text
PENDING
UPLOADING
COMPLETED
FAILED
EXPIRED
```

The File is not created until finalization. No current-version trigger check
applies because there is no existing target File.

### 5.2 Append Intent

Definition:

```text
existingFileId IS NOT NULL
AND expectedCurrentFileVersionId IS NOT NULL
```

Valid states:

```text
PENDING
UPLOADING
COMPLETED
FAILED
EXPIRED
```

The expected FileVersion must belong to `existingFileId`. Creation and entry
into UPLOADING also require the expected version to equal the File's current
version at that moment.

### 5.3 Legacy terminal append history

Definition:

```text
existingFileId IS NOT NULL
AND expectedCurrentFileVersionId IS NULL
AND status IN ('COMPLETED', 'FAILED', 'EXPIRED')
```

This is preserved only as non-executable historical data. No new row may enter
this classification because:

- target fields are immutable;
- new Intent INSERT must be PENDING;
- active append rows require both target IDs.

### 5.4 Invalid combinations

```text
existingFileId IS NULL
AND expectedCurrentFileVersionId IS NOT NULL
```

Invalid in every status.

```text
existingFileId IS NOT NULL
AND expectedCurrentFileVersionId IS NULL
AND status IN ('PENDING', 'UPLOADING')
```

Invalid. This prevents an append from silently becoming a new-File Intent or
from entering the active append slot without a target snapshot.

## 6. Complete Status/NULL Matrix

Legend:

```text
N/N   both IDs NULL
I/I   both IDs non-NULL
F/N   existingFileId non-NULL, expected version NULL
N/F   existingFileId NULL, expected version non-NULL
```

| Status | N/N | I/I | F/N | N/F |
|---|---|---|---|---|
| `PENDING` | allow: new File candidate | allow: append candidate | reject | reject |
| `UPLOADING` | allow: new File upload | allow: append reservation | reject | reject |
| `COMPLETED` | allow: new File history | allow: append history | allow only legacy history | reject |
| `FAILED` | allow: new File history | allow: append history | allow only legacy history | reject |
| `EXPIRED` | allow: new File history | allow: append history | allow only legacy history | reject |

This is all 20 status/NULL combinations. There are no unclassified cells.

## 7. Authoritative Database Model

### 7.1 Parent key

Reuse:

```text
file_version(id, fileId)
UNIQUE INDEX file_version_id_fileId_key
```

No additional parent key is required.

### 7.2 Pair CHECK

Proposed forward SQL:

```sql
ALTER TABLE "file_upload_intent"
ADD CONSTRAINT "upload_intent_expected_current_pair_check"
CHECK (
  (
    "existingFileId" IS NULL
    AND "expectedCurrentFileVersionId" IS NULL
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

SQLSTATE on violation:

```text
23514 check_violation
```

This CHECK alone cannot prove that the expected FileVersion belongs to the
existing File. The composite FK owns that invariant.

### 7.3 Composite same-File FK

Proposed forward SQL:

```sql
ALTER TABLE "file_upload_intent"
ADD CONSTRAINT
  "file_upload_intent_expectedCurrentFileVersionId_existingFileId_fkey"
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

Semantics:

- both child columns NULL: FK skipped; pair CHECK governs;
- both child columns non-NULL: the expected FileVersion must exist and have
  exactly `fileId = existingFileId`;
- partial NULL: FK skipped, but the pair CHECK rejects all partial NULLs except
  terminal F/N history;
- violation when both are non-NULL:

```text
23503 foreign_key_violation at the deferred constraint check
```

`MATCH FULL` is intentionally not used because terminal F/N history would
otherwise be rejected. `MATCH SIMPLE` plus the complete pair CHECK is the
smallest model that preserves that history without allowing active partial
pairs.

### 7.4 Existing File FK

Replace the current single-column `ON DELETE SET NULL` relation:

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

This prevents deletion or identity mutation from manufacturing a partial target
pair. Existing FileVersion and File lifecycle guards already make these
operations non-ordinary.

The project-ownership composite
`upload_intent_existing_file_project_fkey` remains unchanged. Its
`ON UPDATE CASCADE` can request a File ID cascade, but the new single-column
`ON UPDATE RESTRICT` blocks such a parent-key mutation. That is deliberate:
Intent target identity is immutable and File IDs are not a supported rename
operation.

### 7.5 Complete affected relation list

| Child | Child columns | Parent | Parent key | MATCH | Delete | Update | Timing |
|---|---|---|---|---|---|---|---|
| `file_upload_intent` | `existingFileId` | `file` | PK `(id)` | SIMPLE | RESTRICT | RESTRICT | immediate |
| `file_upload_intent` | `existingFileId, projectId` | `file` | UNIQUE `(id, projectId)` | SIMPLE | RESTRICT | CASCADE | immediate |
| `file_upload_intent` | `expectedCurrentFileVersionId` | `file_version` | PK/unique index `(id)` | SIMPLE | RESTRICT | RESTRICT | current immediate FK, to be removed |
| `file_upload_intent` | `expectedCurrentFileVersionId, existingFileId` | `file_version` | UNIQUE `(id, fileId)` | SIMPLE | RESTRICT | RESTRICT | deferrable initially deferred |
| `file` | `currentVersionId` | `file_version` | unique `(id)` | SIMPLE | SET NULL | CASCADE | immediate |
| `file` | `currentVersionId, id` | `file_version` | UNIQUE `(id, fileId)` | SIMPLE | default | default | deferrable initially deferred |
| `file_version` | `fileId` | `file` | PK `(id)` | SIMPLE | RESTRICT | CASCADE | immediate |

The expected-current compound FK is the sole authoritative expected-version
relation after the forward Migration.

## 8. Prisma Authoritative Relation

### 8.1 Final Prisma model

The single-column expected relation is replaced, not supplemented:

```prisma
model FileUploadIntent {
  // ...

  existingFile File? @relation(
    "ExistingUploadIntentFile",
    fields: [existingFileId],
    references: [id],
    onDelete: Restrict,
    onUpdate: Restrict
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

No second Prisma field for a single-column expected-current relation is kept.

The reverse relations remain:

```prisma
File.uploadIntents
FileVersion.expectedForUploadIntents
```

### 8.2 Database/Client consistency contract

Implementation must prove all of the following:

1. `prisma validate` accepts the complete schema.
2. Generated relation SQL contains exactly one expected-current FK:

```text
(expectedCurrentFileVersionId, existingFileId)
  -> file_version(id, fileId)
```

3. The old
`file_upload_intent_expectedCurrentFileVersion_fkey` is absent.
4. Existing File relation actions are RESTRICT/RESTRICT.
5. Prisma Client relation access does not require a second relation alias.
6. A clean database built from Migrations equals a database built from the
   final schema for Prisma-managed objects.
7. `prisma migrate diff` from the final Migration state to the final schema
   reports no difference.

Prisma cannot encode the pair CHECK, `MATCH SIMPLE`, deferrability or the
lifecycle triggers. Those remain explicit SQL objects and require PostgreSQL
behavior tests.

### 8.3 Relation semantics

- Both child fields NULL: relation is absent.
- Both child fields non-NULL: Prisma relation resolves the FileVersion whose
  composite key is `(id, fileId)`.
- Terminal F/N: relation is absent, and the row is intentionally historical.
- N/F cannot be represented because it is prohibited by CHECK.

## 9. Trigger Design

### 9.1 Separation decision

Two triggers are used:

```text
BEFORE INSERT
BEFORE UPDATE OF status
```

They call separate PL/pgSQL functions. The INSERT function contains no `OLD`
reference. This directly resolves P3-01.

### 9.2 Creation snapshot trigger

Proposed SQL specification:

```sql
CREATE OR REPLACE FUNCTION "p13_assert_append_creation_snapshot"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_version TEXT;
BEGIN
  IF NEW."existingFileId" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW."expectedCurrentFileVersionId" IS NULL THEN
    RAISE EXCEPTION
      'append intent creation requires expected-current'
      USING ERRCODE = '23514';
  END IF;

  SELECT f."currentVersionId"
  INTO v_current_version
  FROM "file" f
  WHERE f.id = NEW."existingFileId"
  FOR SHARE;

  IF NOT FOUND
     OR v_current_version IS DISTINCT FROM
        NEW."expectedCurrentFileVersionId"
  THEN
    RAISE EXCEPTION
      'append creation snapshot does not match target File current version'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "p13_append_creation_snapshot_guard"
BEFORE INSERT ON "file_upload_intent"
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_append_creation_snapshot"();
```

`FOR SHARE`:

- serializes against a concurrent `File.currentVersionId` update;
- permits concurrent Intent creations against the same File;
- keeps the check scoped to one File row.

### 9.3 Reservation snapshot trigger

Proposed SQL specification:

```sql
CREATE OR REPLACE FUNCTION "p13_assert_append_reservation_snapshot"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_version TEXT;
BEGIN
  IF NEW.status <> 'UPLOADING'
     OR OLD.status = 'UPLOADING'
  THEN
    RETURN NEW;
  END IF;

  -- New-File upload: no existing target yet.
  IF NEW."existingFileId" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW."expectedCurrentFileVersionId" IS NULL THEN
    RAISE EXCEPTION
      'append reservation requires expected-current'
      USING ERRCODE = '23514';
  END IF;

  SELECT f."currentVersionId"
  INTO v_current_version
  FROM "file" f
  WHERE f.id = NEW."existingFileId"
  FOR UPDATE;

  IF NOT FOUND
     OR v_current_version IS DISTINCT FROM
        NEW."expectedCurrentFileVersionId"
  THEN
    RAISE EXCEPTION
      'append reservation expected-current is stale or missing'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "p13_append_reservation_snapshot_guard"
BEFORE UPDATE OF "status" ON "file_upload_intent"
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_append_reservation_snapshot"();
```

`FOR UPDATE` serializes two reservations and any target current-version update.
The existing service SELECT remains defense in depth and uses the same File
row and lock mode.

### 9.4 Responsibility split

| Invariant | Authority |
|---|---|
| Active append has both target IDs | pair CHECK |
| Expected version maps to target File | composite FK |
| New-File UPLOADING is valid | pair CHECK |
| Append creation snapshot equals current | INSERT trigger |
| Append reservation snapshot still equals current | UPDATE trigger plus app lock |
| One active append per File | active append partial unique index |
| Current pointer is CAS-updated | application transaction |
| Current pointer belongs to its File | existing File same-File FK |
| Intent/Attempt/FileVersion terminal counts | existing deferred chain trigger |
| Target fields do not change after INSERT | existing immutability triggers |
| No external Provider request is rolled back by DB | application recovery/Fail Closed protocol |

The DB constraints do not replace the active slot protocol. The active slot
protocol does not replace the relational and temporal database checks.

## 10. Lifecycle Revalidation

### 10.1 New File

```text
Intent INSERT:
  existingFileId=NULL
  expectedCurrentFileVersionId=NULL
  status=PENDING
  -> pair CHECK passes
  -> composite FK skipped
  -> creation trigger returns without File lookup

PENDING -> UPLOADING:
  both IDs remain NULL
  -> reservation trigger returns without File lookup
  -> active append partial unique index does not apply

finalization:
  create File
  create FileVersion for that File
  CAS File.currentVersionId
  Intent -> COMPLETED
  both target IDs remain NULL
```

This is the path missed by R1 and is now explicitly valid.

### 10.2 Append creation

```text
read project ownership and target current version
-> INSERT PENDING with both IDs non-NULL
-> FOR SHARE target File
-> require current version equals expected
-> composite FK verifies expected belongs to target File
```

If current changes before INSERT:

```text
trigger blocks with 23514
no Intent is committed
```

If two creation Requests read the same current version:

```text
both may remain PENDING
the active slot decides later
```

### 10.3 Append reservation

```text
create Attempt and staging ownership
-> UPDATE Intent PENDING -> UPLOADING
-> trigger locks File FOR UPDATE
-> trigger compares current with persisted expected
-> pair CHECK and composite FK remain valid
-> active append partial unique index allows one UPLOADING row per File
```

If stale:

```text
UPDATE raises 23514
whole transaction rolls back
Intent remains PENDING
```

The service maps this database failure to the existing
`UPLOAD_TARGET_CHANGED` business conflict/HTTP 409 behavior in a later source
implementation. Until that mapping exists and is tested, it is an
implementation task, not a claim of current behavior.

### 10.4 Current version advancement after creation

```text
Intent PENDING expected=fv_old
File.currentVersionId advances to fv_new
```

This is legal history:

- expected `fv_old` still belongs to the same File;
- pair CHECK passes;
- composite FK passes;
- the row remains PENDING and non-executable against the new current;
- a later reservation transition is rejected by the trigger.

Migration must not manufacture a new expected version.

### 10.5 Failure and expiration

- A PENDING append may become EXPIRED and retain both target IDs.
- A failed/expired append retains immutable target identity.
- A new-File failed/expired Intent retains both NULL.
- Legacy terminal F/N remains queryable but cannot be revived.
- No terminal transition rewrites the target pair.

### 10.6 Completion

- New File remains N/N.
- Append remains I/I.
- Completion does not change expected-current to the newly created version.
- `completedFileVersionId` identifies the new version separately.
- Existing completion ownership plus the new relation ensure that an append
  cannot complete under a different File.

## 11. Concurrent Transaction Analysis

This is static design analysis, not PostgreSQL execution evidence.

### 11.1 New-File reservation and completion

```text
Session N:
BEGIN
INSERT Intent N (NULL, NULL, PENDING)
UPDATE Intent N -> UPLOADING
  trigger detects existingFileId NULL, returns
COMMIT

Later finalization:
BEGIN
create File NF
create FileVersion NV for NF
CAS NF.currentVersionId NULL -> NV
Intent N -> COMPLETED
COMMIT
```

Expected:

```text
Intent N remains (NULL, NULL, COMPLETED)
FileVersion exactly 1
File.currentVersionId = NV
```

No trigger regression.

### 11.2 Two append Intent INSERTs

```text
Session A                         Session B
BEGIN                             BEGIN
INSERT A PENDING (F,FV0)          INSERT B PENDING (F,FV0)
trigger locks F FOR SHARE         trigger locks F FOR SHARE
COMMIT                            COMMIT
```

The share locks are compatible. Both PENDING Intents may commit. They are not
active slots.

### 11.3 Two append reservations

```text
Session A:
BEGIN
UPDATE Intent A PENDING -> UPLOADING
  trigger locks F FOR UPDATE, current=FV0 -> pass
  active append unique index accepts A
COMMIT

Session B:
BEGIN
UPDATE Intent B PENDING -> UPLOADING
  trigger waits for F
after A commits, current still FV0 -> pass
  active append unique index sees A -> 23505
ROLLBACK
```

Expected:

```text
Intent A UPLOADING
Intent B PENDING
active append rows = 1
no committed B Attempt/Lifecycle chain
```

### 11.4 Reservation versus File current advancement

Finalizer first:

```text
Session F:
BEGIN
SELECT F FOR UPDATE
insert FV1
UPDATE F currentVersionId=FV1
COMMIT

Session R:
BEGIN
UPDATE Intent PENDING -> UPLOADING
  trigger waits for F
after F commits, current=FV1 != expected FV0
  23514
ROLLBACK
```

Reservation first:

```text
Session R commits a valid UPLOADING snapshot for FV0.
Its own later finalization must acquire F FOR UPDATE,
create FV1, CAS FV0 -> FV1, and complete the same Intent.
```

No valid reservation is supposed to remain active while an unrelated writer
advances the same File's current version. If such a state appears, finalization
CAS fails and the uploaded object is retained rather than falsely published.

### 11.5 Reservation versus File delete

```text
DELETE F
```

is blocked by target FKs. A concurrent append Intent INSERT:

- waits for the File lock while a compatible transaction is active; or
- fails the creation trigger if the File is absent; or
- is preserved by the immediate/deferred FKs once committed.

Expected SQLSTATE:

```text
23514 creation trigger if target lookup sees no File
23503 at FK enforcement if a later statement exposes a missing parent
```

The test script must force one path at a time and record its exact SQLSTATE.

### 11.6 Deadlock and lock order

Normal operations lock one target File and the Intent row being changed. There
is no multi-File sorted-lock operation in this design.

Remaining implementation tests:

- Service transaction begins.
- Attempt/staging rows are created before the Intent state update.
- The UPDATE trigger locks the target File.
- The service later re-acquires the same File lock.
- Finalization uses File -> FileVersion/current -> Intent completion.
- Two Sessions use independent connections.
- `lock_timeout` records waits; unexpected `40P01` is a failure.

An application `40001` retry remains valid only for a database-classified
serialization failure. A stale snapshot `23514` or active-slot `23505` is not a
generic transient retry.

## 12. Migration Precheck

### 12.1 Historical policy

| Classification | Status/relation | Migration action |
|---|---|---|
| New-File history | N/N in any status | preserve |
| Valid append history | I/I, expected belongs to File | preserve |
| Stale PENDING | I/I and current differs, status PENDING | preserve; later reservation rejects |
| Valid UPLOADING append | I/I, current still equals expected | preserve |
| Stale UPLOADING append | I/I, current differs | fail before DDL |
| New-File UPLOADING | N/N, status UPLOADING | preserve |
| Legacy terminal append | F/N terminal | preserve |
| Active append missing target | F/N or N/F in PENDING/UPLOADING | fail |
| New target with unexpected version | N/F in any status | fail |
| Cross-File expected | I/I but expected belongs elsewhere | fail |
| Dangling expected | expected ID exists nowhere | fail |
| Terminal cross-File expected | I/I relation invalid | fail |

“Current mismatch” does not mean historical invalidity. It is blocking only
for an existing UPLOADING append, where the current active reservation would
otherwise begin in an already invalid state.

### 12.2 Precheck SQL specification

The following is the forward-Migration specification, not executed SQL:

```sql
DO $$
DECLARE
  v_invalid_pair BIGINT;
  v_dangling BIGINT;
  v_cross_file BIGINT;
  v_uploading_current_mismatch BIGINT;
  v_stale_pending BIGINT;
BEGIN
  SELECT count(*) INTO v_invalid_pair
  FROM "file_upload_intent" i
  WHERE NOT (
    (i."existingFileId" IS NULL
      AND i."expectedCurrentFileVersionId" IS NULL)
    OR
    (i."existingFileId" IS NOT NULL
      AND i."expectedCurrentFileVersionId" IS NOT NULL)
    OR
    (i."existingFileId" IS NOT NULL
      AND i."expectedCurrentFileVersionId" IS NULL
      AND i.status IN ('COMPLETED', 'FAILED', 'EXPIRED'))
  );

  SELECT count(*) INTO v_dangling
  FROM "file_upload_intent" i
  WHERE i."expectedCurrentFileVersionId" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "file_version" fv
      WHERE fv.id = i."expectedCurrentFileVersionId"
    );

  SELECT count(*) INTO v_cross_file
  FROM "file_upload_intent" i
  WHERE i."existingFileId" IS NOT NULL
    AND i."expectedCurrentFileVersionId" IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM "file_version" fv
      WHERE fv.id = i."expectedCurrentFileVersionId"
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "file_version" fv
      WHERE fv.id = i."expectedCurrentFileVersionId"
        AND fv."fileId" = i."existingFileId"
    );

  SELECT count(*) INTO v_uploading_current_mismatch
  FROM "file_upload_intent" i
  WHERE i.status = 'UPLOADING'
    AND i."existingFileId" IS NOT NULL
    AND i."expectedCurrentFileVersionId" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "file" f
      WHERE f.id = i."existingFileId"
        AND f."currentVersionId" =
          i."expectedCurrentFileVersionId"
    );

  SELECT count(*) INTO v_stale_pending
  FROM "file_upload_intent" i
  WHERE i.status = 'PENDING'
    AND i."existingFileId" IS NOT NULL
    AND i."expectedCurrentFileVersionId" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "file" f
      WHERE f.id = i."existingFileId"
        AND f."currentVersionId" =
          i."expectedCurrentFileVersionId"
    );

  IF v_invalid_pair > 0
     OR v_dangling > 0
     OR v_cross_file > 0
     OR v_uploading_current_mismatch > 0
  THEN
    RAISE EXCEPTION
      'append intent precheck failed: invalid_pair=%, dangling=%, cross_file=%, uploading_current_mismatch=%, stale_pending_retained=%',
      v_invalid_pair,
      v_dangling,
      v_cross_file,
      v_uploading_current_mismatch,
      v_stale_pending
      USING ERRCODE = '23514';
  END IF;
END;
$$;
```

Expected failure SQLSTATE:

```text
23514
```

The count `v_stale_pending` is diagnostic only and does not block.

### 12.3 Historical vectors

| ID | History state | Precheck | Expected result |
|---|---|---|---|
| `MIG-01` | PENDING N/N | pass | new-File candidate preserved |
| `MIG-02` | PENDING I/I, same File, current matches | pass | append candidate preserved |
| `MIG-03` | PENDING I/I, same File, current differs | pass | stale PENDING preserved |
| `MIG-04` | PENDING F/N | fail `23514` | no DDL |
| `MIG-05` | PENDING N/F | fail `23514` | no DDL |
| `MIG-06` | UPLOADING N/N | pass | new-File upload preserved |
| `MIG-07` | UPLOADING I/I, current matches | pass | active append preserved |
| `MIG-08` | UPLOADING I/I, current differs | fail `23514` | stale active append blocks |
| `MIG-09` | UPLOADING F/N | fail `23514` | active append missing target blocks |
| `MIG-10` | UPLOADING N/F | fail `23514` | invalid target pair blocks |
| `MIG-11` | COMPLETED I/I, same File, current changed | pass | historical append preserved |
| `MIG-12` | COMPLETED F/N | pass | legacy terminal history preserved |
| `MIG-13` | COMPLETED N/N | pass | new-File history preserved |
| `MIG-14` | Terminal I/I cross-File | fail `23514` | invalid history blocks |
| `MIG-15` | Any status with dangling expected ID | fail `23514` | no guessing or backfill |
| `MIG-16` | Any status with N/F | fail `23514` | invalid target pair blocks |

## 13. Forward Migration Contract

Proposed migration directory:

```text
20261126140000_phase39_append_expected_current_integrity
```

It sorts after the current latest:

```text
20261126130000_phase38_route_c_minimal_recovery_hardening
```

### 13.1 Transaction and concurrency gate

The Migration must run in one PostgreSQL transaction. Before the precheck it
must lock out writers that could change the data being checked:

```sql
SET LOCAL lock_timeout = '<approved bounded interval>';

LOCK TABLE "file_upload_intent" IN ACCESS EXCLUSIVE MODE;
LOCK TABLE "file" IN SHARE MODE;
```

`LOCK TABLE` is a transaction lock, not DDL. It must occur before the precheck.
The lock ensures:

- no Intent can be inserted or changed between precheck and Trigger creation;
- no File current pointer can advance during that interval;
- no stale UPLOADING append can appear after the precheck.

The implementation gate must verify that Prisma's actual PostgreSQL runner
executes the full Migration in an atomic unit. If that cannot be proven, the
Migration must not be applied. The prior R2 runner evidence for the preceding
R3 precheck is relevant precedent but does not validate this new migration.

### 13.2 Ordered steps

```text
1. BEGIN atomic migration transaction
2. SET LOCAL lock_timeout
3. Lock Intent writes and File current-version writes
4. Run precheck
5. Drop old single-column expected-current FK
6. Replace existingFileId FK with RESTRICT/RESTRICT
7. Add compound same-File FK
8. Add pair CHECK
9. Create INSERT snapshot function/trigger
10. Create UPDATE reservation function/trigger
11. Run postcheck assertions
12. COMMIT
```

No data backfill, deletion, defaulting or guessed FileVersion is permitted.

### 13.3 Postcheck

The Migration must assert:

- `file_version_id_fileId_key` exists and is valid;
- exactly one expected-current FK remains;
- the old single-column expected FK is absent;
- the compound FK has the expected column order and parent columns;
- `confmatchtype = 's'` for MATCH SIMPLE;
- `confdeltype = 'r'` and `confupdtype = 'r'`;
- `condeferrable = true` and `condeferred = true`;
- pair CHECK validates;
- both expected Triggers exist and are enabled;
- no invalid historical pair/relation count remains;
- `file.currentVersionId` still has its same-File deferred constraint.

Catalog verification must use `pg_constraint`, `pg_attribute`, `pg_trigger`,
and `conkey/confkey`; checking only for a constraint name is insufficient.

### 13.4 Prisma failure and retry

Expected on precheck `23514`:

```text
Prisma exit nonzero
P3018
new migration row unfinished
no later migration applied
no partial new constraint/trigger
```

Expected on an unchanged failed state:

```text
P3009
```

An explicit reviewed `migrate resolve` or replacement isolated database is
required. Automatic retry and automatic rollback marking remain prohibited.

The preceding R3 test reproduced P3018/P3009 behavior:

```text
docs/architecture/wp-2a-cm1-controlled-validation-completion-r2.md:266-315
```

This new Migration still requires its own runner evidence.

## 14. Application Responsibility and External Effects

The application remains responsible for:

- server-side project/File ownership and authorization;
- capturing the initial expected current version;
- File row lock and current-version CAS during reservation/finalization;
- active Attempt/Lifecycle/Operation ownership;
- idempotency and Provider write identity;
- exact object readback and SHA-256 verification;
- mapping database conflicts to stable business errors.

The database remains responsible for:

- relation cardinality and same-File ownership;
- status/NULL legality;
- creation/reservation current snapshot;
- active append uniqueness;
- immutability and terminal chain checks.

No database trigger can:

- prove that an external Provider request was not sent;
- undo a Provider-side successful write;
- prove an OS handle is closed;
- compensate a COMMIT response loss by inference.

For Provider success + DB confirmation uncertainty:

```text
retain the exact object
-> open a new database connection
-> read Intent/Attempt/Operation/Binding/FileVersion
-> discover using the original persisted idempotency identity
-> publish only through the existing fenced finalization transaction
```

The new expected-current constraints do not replace the existing recovery
protocol.

## 15. Complete Test Matrix

### 15.1 Required scenario matrix

| ID | Scenario | Initial state | Expected DB/result | SQLSTATE or business result | Responsibility |
|---|---|---|---|---|---|
| `AI2-01` | New File PENDING | N/N | commit success | none | CHECK allows |
| `AI2-02` | New File enters UPLOADING | N/N | commit success, one active Attempt | none | CHECK/Trigger allow |
| `AI2-03` | New File completes | N/N, active chain | File + one FileVersion + COMPLETED | none | app finalization + existing chain guard |
| `AI2-04` | Append PENDING valid | I/I same File/current | commit success | none | CHECK/FK/Trigger |
| `AI2-05` | Append UPLOADING valid | I/I same File/current | commit success | none | Trigger + unique index |
| `AI2-06` | Append UPLOADING expected NULL | F/N | reject before commit | `23514` | pair CHECK |
| `AI2-07` | Append UPLOADING existing File NULL | N/F | reject before commit | `23514` | pair CHECK |
| `AI2-08A` | Cross-File expected through normal creation | I/I wrong File | creation tx rolls back | `23514` normally; trigger sees current mismatch | INSERT Trigger |
| `AI2-08B` | Cross-File expected isolated at FK | transient test transaction satisfies the snapshot check | deferred commit rejected | `23503` | compound FK |
| `AI2-09A` | Dangling expected through normal creation | I/I nonexistent version | creation tx rolls back | `23514`; current cannot validly equal a missing ID | INSERT Trigger |
| `AI2-09B` | Dangling expected historical precheck | existing malformed row | no DDL | `23514` | Migration precheck |
| `AI2-10` | Stale PENDING remains | I/I current differs | row remains PENDING | none | permanent CHECK/FK |
| `AI2-11` | Stale PENDING reserves | I/I current differs | transaction rollback | `23514`, app 409 target changed | reservation Trigger |
| `AI2-12` | Current advances, then reservation | File lock ordering | loser sees new current | `23514`, app 409 | Trigger + app lock/CAS |
| `AI2-13` | Two PENDING Intents same current | I/I same File | both PENDING allowed | none | active slot only on UPLOADING |
| `AI2-14` | Two reservations same File | two Sessions | one UPLOADING, one PENDING | loser `23505` | File lock + partial unique |
| `AI2-15` | Terminal append preserved after current advances | COMPLETED I/I stale current | row remains valid | none | no permanent current equality |
| `AI2-16` | Legacy terminal append preserved | F/N terminal | row remains valid | none | pair CHECK |
| `AI2-17` | Target File delete | Intent/history exists | delete rejected | `23503` | File FK RESTRICT |
| `AI2-18` | Expected FileVersion delete | referenced by Intent | delete rejected | `23503` plus existing delete guard | FK/Trigger |
| `AI2-19` | Direct target-field update | existing Intent | reject | `23514` or documented existing immutability code | immutability Triggers |
| `AI2-20` | Migration invalid pair | F/N active | no DDL | precheck `23514` | precheck |
| `AI2-21` | Migration cross-File | invalid history | no DDL | precheck `23514` | precheck |
| `AI2-22` | Prisma failed Migration retry | existing failed row | blocked | P3018 then P3009 | Prisma runner |
| `AI2-23` | INSERT Trigger runtime | PENDING append | creation snapshot enforced | `23514` on mismatch | INSERT Trigger |
| `AI2-24` | UPDATE Trigger runtime | PENDING -> UPLOADING | reservation snapshot enforced | `23514` on mismatch | UPDATE Trigger |
| `AI2-25` | Provider response loss | successful provider write, lost response | one FileVersion, one object, no duplicate | business recovery success | app/Provider |
| `AI2-26` | File current update races reservation | two Sessions | one serialized valid result | `23514` if stale; no `40P01` | Trigger/app locks |

### 15.2 Full 20-cell test

`AI2-20CELL` executes all 20 cells from §6:

```text
5 statuses × 4 NULL combinations
```

Each case records:

- initial Intent row;
- target File and FileVersion identity;
- operation and transaction barrier;
- expected pass/fail;
- SQLSTATE;
- final row state;
- active append count;
- FileVersion count.

The normal new-File `UPLOADING` cell is a mandatory positive case.

The compound FK must still be tested directly as `AI2-08B`; otherwise the
earlier snapshot trigger would hide whether the deferred relation itself was
created with the correct child/parent column order. The isolated fixture must
remain inside a transaction that is rolled back and must not be presented as a
valid business state.

### 15.3 Evidence required in future implementation

- Raw SQL and exact scripts.
- PostgreSQL version and isolated instance identity.
- Two-session connection IDs and commit barriers.
- Pre/post row snapshots.
- SQLSTATE and Prisma error code.
- `pg_constraint`/`pg_attribute`/`pg_trigger` catalog output.
- `_prisma_migrations` before/after.
- Provider write/discovery counts where a service test is involved.
- Final database and object state.

Static tests or `prisma validate` must not be described as database behavior
tests.

## 16. Compatibility and Performance

Compatibility:

- The existing unique parent index is reused.
- Existing new-File uploads remain valid.
- Existing append uploads remain valid.
- Stale PENDING history is preserved.
- Legacy terminal F/N is preserved.
- Existing active slot, chain and immutability guards are unchanged.
- Existing File/FileVersion current pointer constraints are unchanged.

Performance:

- One existing two-column parent unique index is reused.
- The creation trigger locks at most one File row FOR SHARE.
- The reservation trigger locks at most one File row FOR UPDATE.
- New-File uploads execute no File lookup in either trigger.
- No global advisory lock or table-wide lock is used by request paths.
- Migration table locks are confined to the reviewed maintenance window.

## 17. Implementation Order Recommendation

After a later explicit implementation authorization:

1. Update only the final Prisma relation fields.
2. Run schema validation and inspect generated relation SQL.
3. Add the forward Migration with precheck, locks, DDL, Triggers and postcheck.
4. Apply to an empty isolated PostgreSQL database.
5. Apply to isolated non-empty databases for every `MIG-*` vector.
6. Run the 20-cell and two-Session matrices.
7. Run service-level tests for new-File and append paths.
8. Run Web/Worker + PostgreSQL integration under separate authorization.
9. Do not enable Provider or production behavior in the same batch.

Implementation must stop if:

- Prisma generates more than one expected-current relation;
- PostgreSQL rejects the DDL;
- any legal new-File UPLOADING case fails;
- stale PENDING is blocked;
- invalid history reaches DDL;
- Trigger compilation or event timing differs;
- two Sessions create two active append slots;
- an unknown Provider/COMMIT result is treated as safe deletion or retry.

## 18. Remaining Unresolved or Not Verified Items

This design does not change:

```text
PostgreSQL execution of the revised DDL:             NOT VERIFIED
Prisma Client generation and Migration diff:          NOT VERIFIED
Live Web/Worker + PostgreSQL integration:             NOT VERIFIED
Real Provider behavior:                               NOT VERIFIED
Provider conditional create / exact discovery:        NOT VERIFIED
Windows OS-level Storage fencing:                     NOT VERIFIED
IAM/ACL and database-role boundary:                   NOT VERIFIED
E2E and deployment:                                   NOT VERIFIED
```

Independent prior items remain:

```text
binding-parent-chain duplicate test:                  NOT VERIFIED
orphan FileVersion terminal matrix:                    NOT VERIFIED
multiple FileVersion terminal matrix:                  NOT VERIFIED
P2-05 full business retention/terminal:                OPEN
R5 57 Open Decisions:                                  OPEN
BV7:                                                   FAIL
BV8:                                                   NOT INDEPENDENTLY APPROVED
Historical governance R8:                              BLOCKED
```

The design does not resolve those items and does not authorize automatic
cleanup, purge, restore, Provider access or production deployment.

## 19. Git State

Git was inspected with a command-local `safe.directory` override because of
directory ownership metadata. No Git configuration was changed.

### Before this report

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  75
Untracked files:        76
```

### After this report

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  76
Untracked files:        77
New report:             docs/architecture/wp-2a-cm1-append-intent-relational-integrity-remediation-design-r2.md
```

Only this report was added. No source, Schema, Migration, SQL, test,
configuration, database or existing report was modified.

## 20. Report Self-Verification

After final freezing:

```text
SHA-256:             reported in the delivery response to avoid self-reference
Bytes:               reported in the delivery response
Lines:               reported in the delivery response
Markdown fences:     statically balanced
Trailing whitespace: statically checked
Execution scope:     read-only; no PostgreSQL, Provider or Build
```

## 21. Final Design Decision

```text
DESIGN COMPLETE — READY FOR INDEPENDENT REVIEW
```

All five review findings are addressed by design. The revised model preserves
normal new-File UPLOADING, requires complete same-File snapshots for append,
preserves stale PENDING and terminal history, establishes one Prisma relation
authority, defines fail-before-DDL Migration checks, and replaces the ambiguous
mixed-event Trigger with separate INSERT and UPDATE guards.

This result authorizes no implementation or database work. The next permitted
step is independent review of this corrected design.
