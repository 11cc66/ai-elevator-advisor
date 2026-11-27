# WP-2A-CM1 — Append Intent Relational Integrity Independent Review R2

## 0. Final Conclusion

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

The same-File composite foreign key is a sound relational correction, but the
proposed status-aware pair CHECK rejects the normal new-File upload path. A new
File upload has both `existingFileId` and `expectedCurrentFileVersionId` NULL,
then moves from `PENDING` to `UPLOADING`. The proposed CHECK excludes exactly
that `UPLOADING` state, so the service would be unable to reserve any new-File
upload once the Migration were applied.

The report also leaves one authoritative Prisma relation ambiguous, rejects
legitimate stale `PENDING` history during Migration precheck, and omits the
decisive new-File reservation state from the test matrix. These are design
corrections, not permission to implement around the proposed constraint.

This was a static, read-only review. No PostgreSQL instance was started or
connected, and no SQL, Migration, service, Provider, Build or test was run.

## 1. Document Control and Authorization

Reviewed design:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-remediation-design-r1.md
```

Expected SHA-256:

```text
ACD92DBB21908EBD9D8A40F410EC7572A2673F5BEEBF519A721DDD5A94069F27
```

Actual SHA-256:

```text
ACD92DBB21908EBD9D8A40F410EC7572A2673F5BEEBF519A721DDD5A94069F27
```

Actual size:

```text
20,917 bytes
623 lines
```

The hash matches the supplied review baseline.

Allowed operation in this review:

- Read design, review, source, Schema, Migration, test and Git evidence.
- Perform static SQL/relation analysis.
- Add only this independent review report.

Not performed:

- Source, Schema, Migration, SQL, trigger, test or configuration changes.
- PostgreSQL startup, connection, SQL execution or Migration application.
- Web, Worker, Provider, E2E, Build, deployment or service restart.
- Reads or changes to protected environment files or storage objects.

## 2. Review Inputs

The review independently read or searched:

```text
docs/architecture/wp-2a-cm1-controlled-validation-completion-r2.md
docs/architecture/wp-2a-cm1-postgresql-independent-review-r1.md
docs/architecture/wp-2a-cm1-postgresql-controlled-validation.md
prisma/schema.prisma
prisma/migrations/20261115213000_phase31_file_data_model/migration.sql
prisma/migrations/20261115233000_phase32_upload_intents/migration.sql
prisma/migrations/20261115234500_phase32_upload_recovery_key/migration.sql
prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql
prisma/migrations/20261126130000_phase38_route_c_minimal_recovery_hardening/migration.sql
apps/web/src/modules/files/upload-service.ts
apps/web/src/modules/files/object-upload-service.ts
apps/web/tests/object-upload-service.test.ts
apps/web/tests/integration/phase32-upload-service.test.ts
```

The R2 PostgreSQL evidence remains the only executed source for the original
defect:

```text
stale_intent|ia_stale|f_stale|fv_r2||UPLOADING
```

`fv_r2` belonged to `f_r2`, while `ia_stale.existingFileId` was `f_stale`.
The transaction committed. This establishes the original cross-File defect; it
does not validate the new design, whose DDL has never been applied.

## 3. Findings

### CM1-R2-IReview-P1-01 — Pair CHECK rejects normal new-File uploads

Location:

```text
Design report: lines 161-181
apps/web/src/modules/files/upload-service.ts:121-157, 213-230, 2052-2064
apps/web/src/modules/files/object-upload-service.ts:349-391
```

The proposed CHECK permits both IDs to be NULL only for:

```text
PENDING, COMPLETED, FAILED, EXPIRED
```

It omits `UPLOADING`.

The real service creates a new-File Intent with:

```text
existingFileId = NULL
expectedCurrentFileVersionId = NULL
status = PENDING
```

Both the local and object upload services later execute a conditional
`PENDING -> UPLOADING` update before any File or FileVersion exists. The
reservation occurs while both IDs are still NULL. Under the proposed CHECK,
that update fails with `23514`; the upload chain transaction rolls back and no
new File can ever be uploaded.

This is a direct regression of the primary upload use case, not an unsupported
legacy corner. PostgreSQL state guards explicitly permit new Intents to start
as `PENDING` and permit `PENDING -> UPLOADING`:

```text
prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:1959-1994
```

The upload-chain guard also has a complete `UPLOADING` state requiring one
current Attempt, independent of whether the eventual target File already
exists:

```text
prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:1250-1277
```

Impact:

- Every normal new-File upload fails at reservation.
- Existing tests and E2E paths that start with `existingFileId: undefined`
  are incompatible with the proposed database state machine.
- A database Migration that normalizes to this CHECK would make previously
  valid in-flight new-File uploads impossible to continue.

Minimum correction:

```text
both IDs NULL:
  allow PENDING, UPLOADING, COMPLETED, FAILED and EXPIRED

both IDs non-NULL:
  allow for the composite FK to enforce same-File existence

existingFileId non-NULL, expectedCurrentFileVersionId NULL:
  allow only explicit terminal historical states

existingFileId NULL, expectedCurrentFileVersionId non-NULL:
  reject in every status
```

The new-File `UPLOADING` path must appear in both the positive database test
matrix and the Migration precheck policy.

### CM1-R2-IReview-P2-01 — Migration precheck conflicts with stale PENDING history

Location:

```text
Design report: lines 221-232, 398-447
```

The design correctly says a `PENDING` Intent that captured an older
expected-current remains a historical reservation candidate after the File
current version changes. Reservation, not the permanent row constraint, must
reject it if its snapshot is stale.

The Migration precheck says the opposite:

```text
D. active_current_mismatch
   status IN ('PENDING','UPLOADING')
   currentVersionId IS DISTINCT FROM expectedCurrentFileVersionId

and D > 0 must raise 23514 before DDL.
```

An old but valid `PENDING` Intent with
`expectedCurrentFileVersionId=fv_old` and `File.currentVersionId=fv_new` is
therefore treated as an unsafe historical row. The composite FK does not
require those values to remain equal, and the design's temporal analysis says
they need not remain equal. Blocking the Migration for this legal state
contradicts the intended compatibility model.

Minimum correction:

- Do not classify stale `PENDING` alone as a Migration blocker.
- Apply current equality precheck at least to existing `UPLOADING` rows.
- Preserve stale `PENDING` rows; the reservation trigger must reject only a
  later attempt to enter `UPLOADING`.
- If product policy intentionally wants to purge or resolve all stale
  `PENDING` Intents before Migration, that is a separate data-governance rule
  requiring an evidence source and an explicit retention decision.

### CM1-R2-IReview-P2-02 — Prisma relation authority is not singular

Location:

```text
Design report: lines 352-396
prisma/schema.prisma:441, 549-550
```

The database already has a unique parent key `file_version(id,fileId)`, and the
proposed composite FK has the correct column order:

```text
(expectedCurrentFileVersionId, existingFileId)
 -> file_version(id, fileId)
```

That relation can replace the current single-column expected-version relation.
The design, however, says the old single-column FK "may remain" or "be
replaced." Those choices produce different authoritative constraint sets and
different future Prisma diffs.

The current Prisma relation at `schema.prisma:550` is single-column. The
proposed compound relation is only described as a temporary probe that passed
`prisma validate`; no generated SQL or `prisma migrate diff` result is
provided. Schema validation does not prove which FK Prisma will drop, retain or
generate.

Minimum correction:

- Declare one authoritative Prisma relation.
- Recommended minimal database set: remove the old single-column
  `expectedCurrentFileVersion_fkey`; the composite relation already proves
  version existence whenever both relation columns are non-NULL, while the
  pair CHECK governs NULLs.
- Freeze the exact expected generated SQL before implementation.
- Require a later generated migration to produce no unexplained FK drop,
  recreation or name change.

### CM1-R2-IReview-P2-03 — The test matrix omits the failing normal path

Location:

```text
Design report: lines 489-518
```

`AI-01` tests only new File with both IDs NULL at `PENDING`. There is no test
for the next required transition:

```text
new File, both IDs NULL, PENDING -> UPLOADING
```

That omission allows the central design regression in P1-01 to appear
successful. The matrix also does not enumerate all status/NULL combinations,
and `AI-13`/`AI-14` do not cover the normal new-File `UPLOADING` Migration
state.

Required additions:

```text
AI-01B  New File, both NULL, PENDING -> UPLOADING commits
AI-17   Stale same-File PENDING survives Migration and later rejects reservation
AI-18   Full 20-cell status/NULL matrix
AI-19   Prisma-generated constraint set exactly matches approved SQL
AI-20   Trigger compiles and executes for both INSERT and UPDATE
AI-21   Concurrent lock traces prove no deadlock and expected SQLSTATEs
```

### CM1-R2-IReview-P3-01 — Trigger runtime syntax remains unverified

Location:

```text
Design report: lines 256-313
```

The trigger design combines:

```sql
BEFORE INSERT OR UPDATE OF "status", "existingFileId",
  "expectedCurrentFileVersionId"
```

and references `OLD.status` inside a branch selected using `TG_OP`. The shape
is plausible PostgreSQL trigger syntax, but it was not executed or compiled.
In particular, implementation must prove:

- The mixed `INSERT OR UPDATE OF ...` event form is accepted.
- An INSERT invocation does not evaluate unavailable `OLD` fields.
- The trigger function resolves string/enum comparisons correctly.
- `23514` is observed at the intended service SQL boundary.

This is not the reason for the current FAIL, but it remains `NOT VERIFIED`
until implementation-stage PostgreSQL testing.

## 4. Composite Foreign Key Review

### 4.1 Parent key

Existing parent key:

```text
file_version(id, fileId)
```

Prisma evidence:

```text
prisma/schema.prisma:441
@@unique([id, fileId])
```

PostgreSQL evidence:

```text
prisma/migrations/20261115213000_phase31_file_data_model/migration.sql:213
CREATE UNIQUE INDEX "file_version_id_fileId_key"
  ON "file_version"("id", "fileId");
```

PostgreSQL can reference a non-partial unique index for a foreign key. The
design therefore does not need a redundant parent index.

### 4.2 Existing same-File precedent

The repository already enforces the File current pointer with the same parent
shape:

```text
prisma/migrations/20261115233000_phase32_upload_intents/migration.sql:107-111

FOREIGN KEY ("currentVersionId", "id")
REFERENCES "file_version"("id", "fileId")
DEFERRABLE INITIALLY DEFERRED
```

Reusing that parent shape is internally consistent with existing Schema.

### 4.3 Proposed child relation

The child column order and parent column order match:

```text
(expectedCurrentFileVersionId, existingFileId)
 -> (id, fileId)
```

With `MATCH SIMPLE`, the FK is checked only when both child columns are
non-NULL. This is acceptable only with a complete pair CHECK. The proposed
pair CHECK is not complete because of P1-01.

### 4.4 DELETE and UPDATE actions

`ON DELETE RESTRICT` and `ON UPDATE RESTRICT` are appropriate for this
historical identity relation. Existing FileVersion identity guards already
reject deletion and `fileId` mutation:

```text
prisma/migrations/20261115213000_phase31_file_data_model/migration.sql:375-407
```

Changing the Intent's `existingFileId` FK from `ON DELETE SET NULL` to RESTRICT
also prevents a File deletion from manufacturing:

```text
existingFileId = NULL
expectedCurrentFileVersionId = <historical value>
```

The existing composite project-ownership FK still uses `ON UPDATE CASCADE`:

```text
prisma/migrations/20261115233000_phase32_upload_intents/migration.sql:144-149
```

The new single-column relation proposes `ON UPDATE RESTRICT`. PostgreSQL can
hold both constraints, but a File ID update would be blocked by RESTRICT rather
than cascaded. IDs are expected to be immutable; the exact interaction should
still be included in implementation verification.

## 5. Status/NULL Matrix

Legend:

```text
B/N = both IDs NULL
B/NN = both IDs non-NULL
F/N = existingFileId non-NULL, expected version NULL
N/F = existingFileId NULL, expected version non-NULL
```

Required behavior:

| Status | B/N | B/NN | F/N | N/F |
|---|---|---|---|---|
| PENDING | allow: new File candidate | allow: append snapshot | reject: append missing snapshot | reject |
| UPLOADING | allow: normal new-File upload | allow: append under FK | reject | reject |
| COMPLETED | allow: new File history | allow: append history | allow only legacy history | reject |
| FAILED | allow: new File history | allow: append history | allow only legacy history | reject |
| EXPIRED | allow: new File history | allow: append history | allow only legacy history | reject |

Proposed CHECK behavior:

| Status | B/N | B/NN | F/N | N/F |
|---|---|---|---|---|
| PENDING | allow | allow | reject | reject |
| UPLOADING | **reject — WRONG** | allow | reject | reject |
| COMPLETED | allow | allow | allow | reject |
| FAILED | allow | allow | allow | reject |
| EXPIRED | allow | allow | reject | reject |

The single incorrect cell, `UPLOADING + B/N`, is the normal new-File upload
state and is sufficient to reject the design.

## 6. Trigger and Concurrency Analysis

This section is a design-level lock analysis under PostgreSQL `READ
COMMITTED`, which is the service's effective default assumption unless a
different isolation level is set. It is not PostgreSQL execution evidence.

### 6.1 Existing service order

Local reservation currently does:

```text
BEGIN
create Attempt
UPDATE Intent PENDING -> UPLOADING
  [new trigger would lock File FOR UPDATE and compare current snapshot]
SELECT File FOR UPDATE and compare current snapshot
update Lifecycle/other chain state
COMMIT
```

Evidence:

```text
apps/web/src/modules/files/upload-service.ts:500-555
apps/web/src/modules/files/object-upload-service.ts:340-391
```

The new trigger would therefore make the File lock occur earlier, before the
UPDATE statement returns, while the later application `SELECT ... FOR UPDATE`
re-acquires a lock already held by the same transaction.

### 6.2 Two Intent INSERTs with the same snapshot

```text
Session A                         Session B
BEGIN                             BEGIN
INSERT Intent A PENDING           INSERT Intent B PENDING
trigger: SELECT File FOR SHARE    trigger: SELECT File FOR SHARE
same-File FK deferred             same-File FK deferred
COMMIT                            COMMIT
```

The two share locks are compatible. Both PENDING rows may exist. The active
append partial unique index, not Intent creation, decides the reservation
winner.

This design is coherent for append Intents with both IDs non-NULL. It is
blocked by the pair CHECK defect for new-File Intents entering UPLOADING.

### 6.3 Two reservation Sessions

```text
Session A:
BEGIN
UPDATE Intent A PENDING -> UPLOADING
  trigger locks File FOR UPDATE, compares current
  partial unique index accepts A
COMMIT

Session B:
BEGIN
UPDATE Intent B PENDING -> UPLOADING
  trigger waits for A's File row lock
after A commits:
  current still matches -> trigger passes
  partial unique index sees A and raises 23505
ROLLBACK
```

Expected database result:

```text
A: UPLOADING
B: PENDING
active append count: 1
no committed Attempt/Lifecycle/Operation chain for B
```

The conceptual order is sound. Real PostgreSQL SQLSTATE, lock waits and
rollback behavior remain `NOT VERIFIED`.

### 6.4 Reservation concurrent with current-version advancement

Case A: finalizer obtains the File lock first.

```text
Finalizer:
BEGIN
SELECT File FOR UPDATE
update/insert new FileVersion
UPDATE File.currentVersionId
COMMIT

Reservation:
BEGIN
UPDATE Intent PENDING -> UPLOADING
  trigger waits for File
after finalizer commits:
  trigger observes new current
  expected snapshot differs
  raises 23514
ROLLBACK
```

At `READ COMMITTED`, the blocked lock query is expected to re-evaluate the
updated File row and return the new current version. This must be proven using
two real Sessions.

Case B: reservation obtains the File lock first.

```text
Reservation commits a UPLOADING row with a valid snapshot.
Later current-version advancement is a subsequent event.
Historical expected-current remains unchanged.
```

No design-level write skew is apparent for a single target File. However, the
availability of this interleaving depends on the pre-existing active append
slot protocol and must be tested with real committed rows.

### 6.5 Creation concurrent with finalization

An Intent INSERT trigger using `FOR SHARE` blocks a concurrent File
`currentVersionId` update until the Intent transaction finishes. The Intent is
therefore created against a stable current-version snapshot. A new Intent can
then remain PENDING after a later current advance.

This follows from row-lock compatibility, but it remains a design inference
until tested with two Sessions and the actual deferred FKs present.

### 6.6 File deletion and update

- A File delete racing with Intent INSERT either fails the trigger lookup or
  waits for the INSERT transaction, after which RESTRICT FKs preserve the
  Intent chain.
- `existingFileId` and `expectedCurrentFileVersionId` are already immutable by
  existing triggers:

```text
prisma/migrations/20261115233000_phase32_upload_intents/migration.sql:152-188
prisma/migrations/20261115234500_phase32_upload_recovery_key/migration.sql:83-129
prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:1970-1985
prisma/migrations/20261126130000_phase38_route_c_minimal_recovery_hardening/migration.sql:446-465
```

This closes direct update paths that are not covered by the new creation
trigger.

### 6.7 Remaining lock risks

The proposed trigger locks one File row, but the full reservation transaction
also writes Attempt, Lifecycle, Operation and audit rows. The design does not
provide real lock wait output or deadlock-timeout evidence. No obvious
single-File cycle is present from static inspection, but that is not a
PostgreSQL concurrency proof.

Implementation tests must include:

- two reservations with real independent Sessions;
- reservation versus current-version advancement;
- Intent creation versus finalization;
- File delete versus Intent creation;
- deadlock timeout and `40P01` observation;
- serialization failure and `40001` if a non-default isolation level is used.

## 7. Counterexample Verification Matrix

“Blocked by” identifies the expected layer from the proposed design. It does
not mean the constraint was executed.

| # | Counterexample | Expected result | Blocking layer | Review result |
|---|---|---|---|---|
| 1 | expected-current belongs to another File | reject at deferred commit | composite FK `23503` | Correct in principle |
| 2 | existing File append with expected-current NULL in PENDING/UPLOADING | reject | pair CHECK `23514` | Correct |
| 3 | existingFileId NULL but expected-current non-NULL | reject in every status | pair CHECK `23514` | Correct |
| 4 | current advances after PENDING creation, then reservation | PENDING retained; entry to UPLOADING rejected | trigger `23514` | Correct, but Migration precheck overblocks |
| 5 | two append Intent INSERTs capture same current | both PENDING allowed | PENDING + File share locks | Correct in principle |
| 6 | two Sessions reserve the same File | exactly one winner | File lock + partial unique `23505` | Requires real PostgreSQL proof |
| 7 | current advancement races reservation | one ordering sees stale and rejects | File lock + trigger | Requires real PostgreSQL proof |
| 8 | completed append history after current advances | remains valid | pair CHECK, no permanent current equality | Correct |
| 9 | direct UPDATE of expected/existing target | reject | existing immutability triggers | Correct |
| 10 | new File PENDING -> UPLOADING | must commit | none under proposed CHECK | **FAIL: rejected at `23514`** |
| 11 | Migration failure followed by rerun | fail before DDL; explicit resolve | precheck + Prisma runner | `NOT VERIFIED` |
| 12 | Prisma schema generates a second/different FK set | reject divergence | exact schema/diff approval | Not specified sufficiently |

## 8. Migration Review

### 8.1 Ordering

The proposed directory:

```text
20261126140000_phase39_append_expected_current_integrity
```

sorts after the current latest source Migration:

```text
20261126130000_phase38_route_c_minimal_recovery_hardening
```

This ordering is internally consistent with the repository's current
Migration names.

### 8.2 Precheck coverage

The six proposed categories do not cover all status/NULL combinations:

- Category A covers exactly one NULL in an active status.
- Category E covers active append with existing File and missing expected.
- Category F covers new File with an unexpected expected version.
- No category explicitly recognizes the valid `UPLOADING + both NULL` state.

Under the proposed CHECK, that valid state is rejected later at DDL rather
than classified before DDL. This violates the report's own requirement that
all unsafe or incompatible rows be detected before the first `ALTER TABLE`.

Category D also blocks legitimate stale PENDING history as described in
P2-01.

### 8.3 DDL atomicity

The report says the precheck must run before DDL or that an explicit
transaction's atomic rollback must have been proven. It does not freeze the
Migration transaction boundary or prove which statements Prisma executes in
one transaction.

If Prisma does not provide the assumed transaction boundary, a pair CHECK
failure after adding the composite FK and replacing the File FK could leave a
partially migrated database. That risk is especially relevant because the
design's own CHECK rejects a normal state that precheck misses.

Required implementation-stage proof:

- precheck failure occurs before the first DDL;
- all DDL and constraint creation have an explicit atomic boundary;
- failure leaves no partial constraint or replaced FK;
- `_prisma_migrations` records unfinished failure correctly;
- a second `migrate deploy` produces the expected P3009 block;
- explicit `migrate resolve` is required after reviewed correction.

The prior R2 test demonstrated this behavior for the preceding R3 Migration
only. It is not evidence for the proposed Migration.

## 9. Prisma and Service Impact

### 9.1 Existing model

The current model has:

```prisma
expectedCurrentFileVersion FileVersion?
  @relation(
    "IntentExpectedCurrentVersion",
    fields: [expectedCurrentFileVersionId],
    references: [id],
    onDelete: Restrict
  )
```

at `prisma/schema.prisma:550`.

The underlying database FK is single-column:

```text
prisma/migrations/20261126130000_phase38_route_c_minimal_recovery_hardening/migration.sql:103-107
```

### 9.2 Proposed model

The proposed composite relation uses `existingFileId` in two relations:

1. the existing File relation; and
2. the expected-current FileVersion relation.

A temporary static `prisma validate` probe accepting the shape is useful but
does not establish:

- the generated Migration;
- whether Prisma drops the old FK;
- how relation count and reverse relation naming appear in the final Schema;
- that service selects/creates continue to produce equivalent SQL.

This must be resolved as P2-02 before implementation.

### 9.3 Service state sequence

The relevant real service paths are:

| Operation | Source | Relevant effect |
|---|---|---|
| Create Intent | `upload-service.ts:121-157, 168-232` | new File leaves both target IDs NULL |
| Local reserve | `upload-service.ts:500-555` | Attempt created, `PENDING -> UPLOADING`, File lock/check |
| Object reserve | `object-upload-service.ts:340-391` | same state transition for object backend |
| Local publish | `upload-service.ts:1116-1235` | File/FileVersion create, current CAS, terminal Intent |
| Object publish | `object-upload-service.ts:995-1117` | File/FileVersion create, current CAS, terminal Intent |

The proposed trigger does not alter these application sequences. It only
duplicates the target check at the database boundary. That is appropriate, but
the pair CHECK currently prevents the new-File branches from reaching
completion.

## 10. Test-Specification Review

The 16 proposed cases are not sufficient in their current form.

### Accepted in principle

- Cross-File expected-current rejection through the composite FK.
- Active append with missing expected-current rejection.
- Existing File plus unexpected expected-current rejection.
- Deferred historical retention for terminal rows with both values non-NULL.
- Active append slot uniqueness.
- Failed reservation rollback.
- Direct target mutation rejection through existing immutability triggers.
- File/FileVersion delete restriction.

### Missing or insufficient

- Normal new-File reservation from PENDING to UPLOADING.
- Full status/NULL matrix.
- Legal stale PENDING preservation across Migration.
- Exact generated Prisma SQL and constraint authority.
- Trigger compilation/runtime on both event types.
- Deterministic ordering for current-version-change races.
- Real two-Session lock wait/deadlock evidence.
- Migration precheck behavior with a mix of legal historical rows and one
  unsafe row.
- Prisma transaction boundary and `_prisma_migrations` failure history.

`AI-09` currently says the loser receives current mismatch `23514`, but the
interleaving is not specified precisely enough to distinguish:

- current advancement before reservation;
- a second active slot conflict (`23505`);
- rollback after an earlier chain write;
- a real deadlock (`40P01`).

Each Session script must name its commit barrier and exact order.

## 11. Other Outstanding Issues

This review does not change the following statuses:

```text
binding-parent-chain duplicate test:       NOT VERIFIED
orphan FileVersion terminal matrix:         NOT VERIFIED
multiple FileVersion terminal matrix:       NOT VERIFIED
P2-05 full business retention/terminal:     OPEN
R5 57 Open Decisions:                       OPEN
BV7:                                        FAIL
BV8:                                        NOT INDEPENDENTLY APPROVED
Historical governance R8:                   BLOCKED
Live Web/Worker + PostgreSQL integration:   NOT VERIFIED
Real Provider behavior:                     NOT VERIFIED
Windows OS-level storage fencing:           NOT VERIFIED
IAM/ACL and database-role boundary:         NOT VERIFIED
E2E and deployment:                         NOT VERIFIED
```

The composite FK design does not repair those items and must not be used to
upgrade any of them to PASS.

## 12. Required Corrections Before Re-review

At minimum:

1. Change the pair CHECK so both IDs NULL is valid for `UPLOADING`.
2. Add a positive new-File reservation test to the design and test matrix.
3. Reconcile stale PENDING semantics with Migration precheck.
4. Resolve the single-column versus composite Prisma FK authority.
5. Freeze exact precheck, DDL, postcheck and transaction-boundary SQL.
6. Add the full status/NULL matrix.
7. State exact expected trigger SQLSTATE and timing.
8. Add real two-Session concurrency scripts and lock/deadlock assertions.
9. Preserve all historical/open external items above.

No source or Migration correction should be made until a corrected design is
independently reviewed.

## 13. Git State

Git access used a command-local `safe.directory` override because the
repository ownership metadata differs from the current account. No Git config
was changed.

### Before this review report

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  74
Untracked files:        75
```

The design report under review was already present as an untracked file.

### After this review report

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  75
Untracked files:        76
New report:             docs/architecture/wp-2a-cm1-append-intent-relational-integrity-independent-review-r2.md
```

Only this review report was added. No source, Schema, Migration, SQL, test,
configuration, database or existing report was modified.

## 14. Report Self-Verification

After the report is frozen:

```text
SHA-256:                 recorded in the delivery response
Bytes:                   recorded in the delivery response
Lines:                   recorded in the delivery response
Encoding/format:         UTF-8 Markdown; paths and headings statically checked
Execution scope:         read-only, no PostgreSQL or Provider connection
```

## 15. Final Decision

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

The composite same-File FK is directionally correct. The accompanying pair
CHECK makes the normal new-File `UPLOADING` state impossible, the Migration
precheck rejects legitimate historical PENDING rows, and the Prisma relation
does not yet have one unambiguous authority.

The next action is a corrected design and another independent review. This
report does not authorize source changes, Migration implementation,
PostgreSQL execution, Provider access or deployment.
