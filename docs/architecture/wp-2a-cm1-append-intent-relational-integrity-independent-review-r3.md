# WP-2A-CM1 — Append Intent Relational Integrity Independent Review R3

## 0. Final Conclusion

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

The revised Pair CHECK correctly restores the normal new-File `UPLOADING`
state, and the split INSERT/UPDATE triggers resolve the original `OLD` access
problem. The same-File composite FK is also correctly shaped.

However, the design still does not make the database authoritative over the
full lifecycle:

1. A new-File Intent with both target IDs NULL is not bound by any durable
   database relation to the File that it creates. Existing completion
   constraints allow that Intent to complete against a FileVersion under an
   already-existing File in the same project hierarchy, bypassing Append
   expected-current and the active append slot.
2. The “UPLOADING append has expected-current equal to File current” rule is
   enforced only when entering UPLOADING. No deferred invariant prevents a
   later committed `File.currentVersionId` change from leaving an UPLOADING
   Append stale.
3. The proposed Migration lock set/order omits `file_version` and assumes table
   locks are a sufficient concurrency gate. An in-flight Append finalization
   can create a lock cycle with the Migration.

These are design defects. No PostgreSQL, service, Provider, Build or test was
executed in this review.

## 1. Review Scope and Document Control

Reviewed design:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-remediation-design-r2.md
```

Expected SHA-256:

```text
1D3907D7CE1CE25CC8690F73D253CB52AA721D3BD0E2EB9CB0E13F5AB42DBB9B
```

Actual SHA-256:

```text
1D3907D7CE1CE25CC8690F73D253CB52AA721D3BD0E2EB9CB0E13F5AB42DBB9B
```

Size:

```text
47,360 bytes
1,492 lines
```

Other baselines:

```text
Design R1 SHA-256:
ACD92DBB21908EBD9D8A40F410EC7572A2673F5BEEBF519A721DDD5A94069F27

Independent Review R2 SHA-256:
713F07DF79085C6FB57F147DDCCBBCD935393CDD9AEB49E24FBFDE5128A2AE1B
```

Both hashes match the supplied baselines.

## 2. Review Inputs

Read or independently checked:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-remediation-design-r1.md
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-independent-review-r2.md
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-remediation-design-r2.md
prisma/schema.prisma
prisma/migrations/20261115213000_phase31_file_data_model/migration.sql
prisma/migrations/20261115233000_phase32_upload_intents/migration.sql
prisma/migrations/20261115234500_phase32_upload_recovery_key/migration.sql
prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql
prisma/migrations/20261126120000_phase38_route_c_minimal_object_binding/migration.sql
prisma/migrations/20261126130000_phase38_route_c_minimal_recovery_hardening/migration.sql
apps/web/src/modules/files/upload-service.ts
apps/web/src/modules/files/object-upload-service.ts
apps/web/tests/helpers/p13-file-version.ts
apps/web/tests/helpers/object-upload-prisma-harness.ts
apps/web/tests/object-upload-service.test.ts
apps/web/tests/integration/phase32-upload-service.test.ts
```

Lifecycle and product constraints:

```text
D02 D03 D04 D05 D08 D09 D11
P30 P31 P32 P33 P34 P35 P36 P37
FZ ST DBTP
P1-3 C-5.1 revision
P1-3 C-6.2-C2 creation decisions
```

The root README confirms that the old upload chain and P1-3 chain are not
fully integrated:

```text
README.md:30-41, 220-229
```

That existing limitation is not closed by this design.

## 3. Git State at Review Start

Git was inspected with a command-local `safe.directory` override. No Git
configuration was changed.

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  76
Untracked files:        77
```

## 4. Historical Finding Revalidation

| Finding | Independent result | Evidence | Conclusion |
|---|---|---|---|
| `CM1-R2-IReview-P1-01` | The normal new-File `UPLOADING` cell is fixed, but the full new-File completion path remains uncoupled from a newly-created File | R2 design 373-379; completion guard migration 190-247; test helper 61-79 and 222-253 | **PARTIAL / REOPENED** |
| `CM1-R2-IReview-P2-01` | Stale PENDING is no longer a blocker; relation-invalid and stale UPLOADING are classified separately | R2 design 986-1130 | `DESIGN VERIFIED` |
| `CM1-R2-IReview-P2-02` | One conceptual relation is chosen, but generated Prisma SQL and actual drift are not independently verified | R2 design 510-581; current `schema.prisma:549-550` | `NOT VERIFIED` |
| `CM1-R2-IReview-P2-03` | New tests were added, but the matrix omits the misclassified new-File completion attack and contains inaccurate SQLSTATE attributions | R2 design 1277-1337; existing triggers below | **PARTIAL** |
| `CM1-R2-IReview-P3-01` | The INSERT and UPDATE triggers are separated; INSERT no longer references `OLD` | R2 design 583-705 | `DESIGN VERIFIED`; runtime `NOT VERIFIED` |

No historical severity was reduced.

## 5. Finding R3-P1-01 — New-File Completion Can Be Misbound to an Existing File

### Severity

```text
P1
```

### Locations

```text
R2 design: 282-302, 727-751, 1277-1310
prisma/migrations/20261115233000_phase32_upload_intents/migration.sql:190-247
prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:1194-1357, 1693-1738
apps/web/tests/helpers/p13-file-version.ts:61-79, 222-253
```

### Defect

The design classifies:

```text
existingFileId IS NULL
expectedCurrentFileVersionId IS NULL
```

as a new-File Intent. The Pair CHECK permits this through all lifecycle
states, including COMPLETED. The composite expected-current FK is skipped.

The database has no durable proof that the File in:

```text
Intent.completedFileVersionId
  -> FileVersion.fileId
  -> File.id
```

was created by that Intent. `File` has no creation-Intent provenance field:

```text
prisma/schema.prisma:367-395
```

The existing completion guard checks project/building/unit and only compares
the completed File to `existingFileId` when that field is non-NULL:

```text
prisma/migrations/20261115233000_phase32_upload_intents/migration.sql:227-238
```

The P1-3 upload-chain guard checks Attempt/Lifecycle/FileVersion ownership but
does not prove that an N/N Intent's File was newly created:

```text
prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:1194-1357
```

### Counterexample

Given:

```text
File F
  projectId=P
  buildingId=B
  installationUnitId=U
  currentVersionId=FV1

FileVersion FV1
  fileId=F
```

construct:

```text
1. Create Intent I in P/B/U:
     existingFileId=NULL
     expectedCurrentFileVersionId=NULL
     status=PENDING

2. Create legal Attempt/Lifecycle/Operation chain for I.

3. Move I to UPLOADING.

4. Create a legal active CANONICAL lifecycle and FINALIZE operation for a
   new storage key, but create FileVersion FV2 with:
     fileId=F
     uploadIntentId=I
     uploadAttemptId=A
     creationOperationAttemptId=O

5. CAS File F.currentVersionId: FV1 -> FV2.

6. Set Intent I:
     status=COMPLETED
     completedFileVersionId=FV2
```

None of the current constraints rejects this:

- Pair CHECK: N/N is allowed.
- Composite expected-current FK: skipped on N/N.
- Active append index: Intent has no `existingFileId`.
- Completion guard: File is in the same P/B/U, and `existingFileId` is NULL.
- P1-3 chain guard: Intent/Attempt/Operation/FileVersion chain is internally
  consistent.
- File same-File current FK: FV2 belongs to F.

### Existing Test Helper Confirms the Shape

`apps/web/tests/helpers/p13-file-version.ts:61-79` creates an Intent without
`existingFileId`.

`apps/web/tests/helpers/p13-file-version.ts:222-253` creates a FileVersion for
arbitrary `input.fileId` and completes that Intent.

This is a test helper, not production authorization, but it demonstrates that
the current database accepts an N/N Intent completed against a separately
chosen File.

### Impact

- An alternate repository DML path can append a version to an existing File
  without populating `existingFileId`.
- It bypasses the expected-current composite FK.
- It bypasses the active append slot because the index only applies when
  `existingFileId IS NOT NULL`.
- Two misclassified N/N Intents can target the same existing File.
- The File's current pointer and version history can be modified under
  “new file” semantics.
- The result violates the design claim that NULL combinations cannot bypass
  Append integrity.

### Minimal Correction Direction

The design must persist and enforce File-creation provenance. One viable
minimal shape:

```text
File.createdByUploadIntentId String? @unique
```

with:

- FK to `FileUploadIntent.id`;
- immutable after File INSERT;
- set in the same transaction only for a new-file upload;
- terminal completion rule:

```text
if Intent.existingFileId IS NULL:
  completed FileVersion.fileId must reference a File whose
  createdByUploadIntentId = Intent.id

if Intent.existingFileId IS NOT NULL:
  completed FileVersion.fileId = Intent.existingFileId
```

The check must be deferred or otherwise permit the legal transaction order:

```text
create File
-> create FileVersion
-> update current pointer
-> complete Intent
```

If historical completed N/N rows cannot be proven to have been created by
their Intent, Migration precheck must not guess provenance. They require an
explicit legacy classification/retention decision.

### Required Tests

```text
R3-T-NF-01  Legal new File creates File and FileVersion, completes
R3-T-NF-02  N/N Intent attempts to complete under an existing File: reject
R3-T-NF-03  N/N Intent attempts to complete under a File created by another
            Intent: reject
R3-T-NF-04  Append Intent still must complete under existingFileId
R3-T-NF-05  Two N/N Intents cannot both claim the same existing File
```

Expected rejection:

```text
23514 if enforced by completion CHECK/Trigger
```

The design may choose a different SQLSTATE only if it defines the exact
constraint and maps it consistently.

## 6. Finding R3-P1-02 — UPLOADING Current Snapshot Is Not a Persistent Invariant

### Severity

```text
P1
```

### Locations

```text
R2 design: 650-705, 911-943, 1059-1070
apps/web/src/modules/files/upload-service.ts:507-548, 1202-1229
apps/web/src/modules/files/object-upload-service.ts:349-391, 1082-1110
```

### Defect

R2 correctly checks current equality at:

```text
PENDING -> UPLOADING
```

and blocks Migration when an existing UPLOADING Append's current version has
already changed.

But no constraint or trigger maintains that rule after entry. A committed
transaction can:

```text
1. Have Intent I in UPLOADING with expected=FV1.
2. Update File.currentVersionId from FV1 to FV2.
3. Commit without completing I.
```

The update trigger fires only on `file_upload_intent.status`; it does not fire
on `file.currentVersionId`. The composite FK still passes because FV1 belongs
to the same File. The Pair CHECK still passes.

Result:

```text
Intent I = UPLOADING, expected=FV1
File.currentVersionId = FV2
```

This is the exact state that R2's Migration treats as invalid, but R2 allows it
to be created after Migration.

### Relationship to Normal Service

The normal finalization transaction legitimately changes current while Intent
is still UPLOADING and later sets it COMPLETED in the same transaction. A
correct invariant must check the final transaction state, not reject that
transient sequence.

The current application uses CAS and fenced operations, so the normal service
is defense in depth. That does not prevent an alternate repository DML path
from committing the stale UPLOADING final state.

### Impact

- The database accepts an active Append snapshot that is already stale.
- Migration policy and runtime policy disagree.
- A second executor can observe an UPLOADING slot whose expected version is
  no longer current.
- Recovery logic must infer whether the Intent is active, stale or should be
  failed; the database does not distinguish those states.
- This weakens the claimed database-authoritative reservation protocol.

### Minimal Correction Direction

Choose one policy and enforce it consistently:

Policy A — current equality is a persistent invariant for UPLOADING Append:

- Add a deferred constraint trigger on Intent status/current target and File
  currentVersionId changes.
- At COMMIT, every UPLOADING Append must satisfy:

```text
File.currentVersionId = Intent.expectedCurrentFileVersionId
```

- A same-transaction Intent completion must pass because no UPLOADING Append
  remains at COMMIT.

Policy B — equality is only a reservation-time optimistic check:

- Remove stale UPLOADING from the Migration blocker.
- Define stale UPLOADING as a supported recoverable state.
- Require finalization CAS and recovery to reject it.

The current design mixes Policy A's Migration rule with Policy B's runtime
rule. It must select one.

### Required Tests

```text
R3-T-CUR-01  PENDING -> UPLOADING at current: success
R3-T-CUR-02  current changes before reservation: 23514
R3-T-CUR-03  same-tx current change + COMPLETED: commit success
R3-T-CUR-04  same-tx current change + Intent remains UPLOADING: commit failure
R3-T-CUR-05  direct File current change after committed UPLOADING: reject if
             Policy A; documented recoverable state if Policy B
```

## 7. Finding R3-P2-01 — Migration Lock Set and Lock Order Are Not Safe

### Severity

```text
P2
```

### Locations

```text
R2 design: 1146-1184
apps/web/src/modules/files/object-upload-service.ts:929-1110
apps/web/src/modules/files/upload-service.ts:1078-1229
```

### Defect

The Migration acquires:

```text
file_upload_intent ACCESS EXCLUSIVE
then file SHARE
```

It does not lock `file_version`, although the later FK creation references and
validates that table.

An in-flight Append finalization can hold:

```text
File row lock
file_version ROW EXCLUSIVE from FileVersion INSERT
```

and needs a later:

```text
file_upload_intent row/table access
```

Migration can already hold Intent ACCESS EXCLUSIVE and be waiting on File or
FileVersion. Finalization can be waiting on Intent. That is a lock cycle.

The real finalization code acquires File, creates FileVersion, updates File
current, then updates Intent:

```text
object-upload-service.ts:995-1110
upload-service.ts:1116-1229
```

Therefore the Migration's Intent -> File order is not aligned with normal
finalization's File -> FileVersion -> Intent order.

### Impact

- Migration may deadlock with an active finalization and abort with `40P01`.
- If it aborts under Prisma, the failed Migration requires P3018/P3009
  recovery.
- The assertion that the locks guarantee no concurrent state change before
  triggers are installed is not proven.
- A transaction already holding File/FileVersion can remain in flight while the
  Migration takes its first lock.

This is fail-closed rather than silent corruption, but it makes the Migration
gate non-deterministic.

### Minimal Correction Direction

The design must add an explicit writer-quiescence gate:

```text
stop Web and Worker writers
-> verify no active sessions/transactions using the upload chain
-> acquire the approved migration locks
-> precheck
-> DDL
```

If online Migration is required, define a database-wide maintenance lock
respected by both reservation and finalization before any transaction begins.

At minimum, the lock set must include `file_version`. `lock_timeout`,
`deadlock_timeout`, `40P01` and `40001` handling must be explicit rather than a
placeholder. A retry after a Migration lock failure must also reconcile the
Prisma failed-migration history.

Required test:

```text
R3-T-MIG-LOCK-01
Session F holds File/FV and is between FileVersion INSERT and Intent COMPLETE
Session M starts Migration
Expected under quiescence gate: M is not started
Expected without gate: record actual wait/deadlock; Migration must not proceed
```

## 8. Finding R3-P2-02 — Test Matrix SQLSTATE Expectations Are Not Deterministic

### Severity

```text
P2
```

### Locations

```text
R2 design: 1277-1310
prisma/migrations/20261115213000_phase31_file_data_model/migration.sql:375-407
prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:1868-1888, 2046-2049
prisma/migrations/20261115233000_phase32_upload_intents/migration.sql:152-188
prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:1970-2002
```

Several matrix rows do not identify the actual first rejecting layer:

| R2 case | R2 stated result | Actual first control | Problem |
|---|---|---|---|
| `AI2-06` | pair CHECK `23514` | reservation Trigger also raises `23514` before CHECK | responsibility is ambiguous |
| `AI2-18` | `23503` plus delete guard | BEFORE FileVersion DELETE Trigger raises `42501` | `23503` cannot be asserted |
| `AI2-19` | `23514` or “documented immutability code” | update of `existingFileId` hits `42501`; update of expected hits `23514` | one row conflates different columns |
| `AI2-08B` | deferred compound FK `23503` | fixture plan only says “satisfies snapshot check” | isolation from the File same-File FK is not specified |

The FileVersion row delete triggers are:

```text
file_version_identity_guard
p13_file_version_chain_identity_guard
```

Both raise `42501` before FK processing.

### Minimal Correction Direction

Split cases by exact column and expected control:

```text
AI2-18A  DELETE expected FileVersion -> 42501 before FK
AI2-19A  UPDATE existingFileId -> 42501/identity guard
AI2-19B  UPDATE expectedCurrentFileVersionId -> 23514 target-slot guard
AI2-06A  Reservation entry missing expected -> 23514 reservation trigger
```

For `AI2-08B`, define a deterministic transaction that leaves only the
compound expected-current FK invalid at COMMIT, and assert the failing
constraint name in addition to SQLSTATE.

Static SQLSTATE descriptions are not database execution evidence; future
implementation must prove them.

## 9. CHECK / FK / Trigger Combination Review

### 9.1 Pair CHECK

The revised predicate was independently evaluated over all 20 combinations:

```text
5 statuses × 4 NULL shapes
```

Result:

```text
PENDING:   N/N allow, I/I allow, F/N reject, N/F reject
UPLOADING: N/N allow, I/I allow, F/N reject, N/F reject
COMPLETED: N/N allow, I/I allow, F/N allow, N/F reject
FAILED:    N/N allow, I/I allow, F/N allow, N/F reject
EXPIRED:   N/N allow, I/I allow, F/N allow, N/F reject
```

The Boolean predicate has no SQL three-valued bypass because every tested field
is non-NULL or compared with `IS NULL` / `IS NOT NULL`, and `status` is NOT
NULL.

The matrix itself is correct. Its inability to distinguish a legitimate new
File completion from an existing File completion is the P1-01 defect above.

### 9.2 Composite FK

The child and parent column order is correct:

```text
(expectedCurrentFileVersionId, existingFileId)
  -> file_version(id, fileId)
```

`MATCH SIMPLE` behaves as described:

- both non-NULL: ownership checked;
- any NULL: FK skipped;
- active partial pairs are blocked by the CHECK.

The DDL shape is PostgreSQL-plausible, but execution and deferrable RESTRICT
behavior remain `NOT VERIFIED`.

### 9.3 INSERT Trigger

The INSERT function:

- has no `OLD` reference;
- returns immediately for N/N new-File Intent;
- locks File `FOR SHARE` and checks current for Append;
- rejects missing target/expected before the row CHECK.

No static trigger bypass was found for an Append-created Intent.

### 9.4 UPDATE Trigger

The UPDATE function:

- fires on `UPDATE OF status`;
- reads `OLD.status`;
- returns unless entering UPLOADING;
- allows N/N new-File reservation;
- verifies Append current with File `FOR UPDATE`.

It does not maintain the snapshot after the transition, as P1-02 explains.

### 9.5 Direct SQL paths

Target-column updates are blocked by existing immutability triggers.

The uncovered direct paths are:

```text
N/N Intent completed against an existing File
File.currentVersionId changed while an Append remains UPLOADING
File current/FileVersion state changed concurrently with Migration
```

These are design gaps, not merely missing tests.

## 10. New-File Lifecycle Review

### 10.1 Intended application path

```text
PENDING N/N
-> UPLOADING N/N
-> create new File
-> create FileVersion under new File
-> set File.currentVersionId
-> set Intent COMPLETED N/N with completedFileVersionId
```

The normal application code does choose a new `randomUUID()` when
`existingFileId` is absent:

```text
upload-service.ts:2152-2167
object-upload-service.ts:995-1030
```

Therefore the happy path should finish if:

- the trigger DDL compiles;
- existing P1-3 chain constraints accept the complete transaction;
- the new completion provenance correction is not yet present.

Status:

```text
APPLICATION HAPPY PATH: DESIGN VERIFIED AT SOURCE LEVEL
DATABASE AUTHORITY FOR “NEW FILE”: DESIGN DEFECT
POSTGRESQL EXECUTION: NOT VERIFIED
```

### 10.2 Required full-state table

| Stage | `existingFileId` | `expectedCurrentFileVersionId` | Status | Required result |
|---|---|---|---|---|
| Create new-file Intent | NULL | NULL | PENDING | pass |
| Reserve | NULL | NULL | UPLOADING | pass |
| Create File/FileVersion | N/A | N/A | UPLOADING | no Pair/FK violation, provenance must match |
| Complete | NULL | NULL | COMPLETED | pass only if File provenance is this Intent |
| Fail/expire before File | NULL | NULL | FAILED/EXPIRED | pass, no FileVersion |
| Misclassify existing File | NULL | NULL | COMPLETED | must reject; current design does not |

## 11. Append Lifecycle Review

### 11.1 Intended path

```text
PENDING I/I
-> File current equals expected
-> UPLOADING I/I
-> File current still equals expected
-> FileVersion for existingFileId
-> current CAS to new version
-> Intent COMPLETED I/I
```

The same-File FK and existing completion guard cover the final FileVersion
ownership relation.

### 11.2 Append state table

| Stage | IDs | Status | Required behavior | Review result |
|---|---|---|---|---|
| Create | I/I same File/current | PENDING | pass | design verified |
| Create cross-File | I/I wrong File | PENDING | reject | Trigger normally `23514`; FK backup |
| Create missing expected | F/N | PENDING | reject | `23514` |
| Create missing File target | N/F | PENDING | reject | `23514` |
| Reserve | I/I current matches | UPLOADING | pass once | design verified |
| Reserve stale | I/I current differs | UPLOADING attempt | reject | Trigger `23514` |
| Current advances after PENDING | I/I same File | PENDING | allowed historical | design verified |
| Current advances after UPLOADING | I/I stale | UPLOADING | no persistent DB invariant | **DESIGN DEFECT** |
| Complete | I/I, completed File = existing | COMPLETED | pass | existing guard |
| Fail/expire | I/I | terminal | preserve | design verified |

## 12. Concurrent Session Timelines

These are source-derived expected timelines. They were not executed.

### 12.1 Two new-file uploads

```text
Session A                         Session B
BEGIN                             BEGIN
INSERT N/N PENDING                INSERT N/N PENDING
no File lookup                    no File lookup
UPDATE -> UPLOADING               UPDATE -> UPLOADING
create independent File F_A       create independent File F_B
create FileVersion for F_A        create FileVersion for F_B
complete A                        complete B
COMMIT                            COMMIT
```

Expected normal result:

```text
two separate Files, one Version each, two terminal Intents
```

The Pair CHECK and triggers do not collide. The DB does not prove
`F_A`/`F_B` ownership without the P1-01 correction.

### 12.2 Two Append Intent creations

```text
Session A:
BEGIN
INSERT I/I PENDING
trigger SELECT F FOR SHARE
COMMIT

Session B:
BEGIN
INSERT I/I PENDING
trigger SELECT F FOR SHARE
COMMIT
```

Expected:

```text
both PENDING
no active slot consumed
```

### 12.3 Two Append reservations

```text
Session A:
BEGIN
create Attempt/Lifecycle
UPDATE Intent A -> UPLOADING
  trigger locks F FOR UPDATE, current=FV0
  unique active slot accepts A
COMMIT

Session B:
BEGIN
create Attempt/Lifecycle
UPDATE Intent B -> UPLOADING
  trigger waits for F
after A commits:
  F current still FV0
  active unique index rejects B
ROLLBACK
```

Expected:

```text
A UPLOADING, B PENDING
one active slot
B Attempt/Lifecycle rows rolled back
loser SQLSTATE 23505
```

Remaining `NOT VERIFIED`: actual lock wait, rollback and unique-index timing.

### 12.4 Reservation versus File current advance

Current advance first:

```text
F:
BEGIN
lock File
create/update FileVersion
set current FV1
COMMIT

R:
BEGIN
UPDATE PENDING -> UPLOADING
trigger waits/locks File
current FV1 != expected FV0
23514
ROLLBACK
```

Reservation first:

```text
R commits UPLOADING at FV0.
F later changes current to FV1.
```

Under the current R2 design, the later `F.currentVersionId` update does not
trigger a check against the still-UPLOADING I/I Intent. This is P1-02.

### 12.5 Reservation versus File deletion

```text
DELETE File
```

is stopped by one or more target FKs. Concurrent Append creation either:

```text
23514 creation trigger lookup failure
or
23503 parent FK failure
```

The test must force and record one path. The static design does not prove
which layer wins in every timing.

### 12.6 Commit response lost

```text
Intent reservation/finalization transaction sent COMMIT
-> response lost
-> reconnect on a new Session
-> read Intent/Attempt/Operation/Binding/FileVersion
```

The correct result depends on the durable row state. DB constraints cannot
undo a Provider write. Object retention and exact-idempotency discovery remain
required.

No new relation constraint changes this rule.

### 12.7 Migration versus live Append finalization

The problematic timeline is described in R3-P2-01:

```text
Finalization:
  holds File row
  inserts FileVersion
  needs File UPDATE and later Intent UPDATE

Migration:
  holds Intent ACCESS EXCLUSIVE
  needs File and later FileVersion locks
```

This can form a wait cycle. The Migration must be launched only after writer
quiescence, or the application and Migration must share a single recognized
maintenance-lock protocol.

## 13. Migration Review

### 13.1 Precheck ordering

The proposed `LOCK TABLE` statements precede the precheck in source ordering.
The precheck precedes the first ALTER in the R2 design.

Status:

```text
SQL ORDER: DESIGN VERIFIED
RUNTIME ATOMICITY: NOT VERIFIED
```

### 13.2 Historical behavior

| History | R2 policy | Review |
|---|---|---|
| stale PENDING | preserve | correct |
| stale UPLOADING Append | block | correct only if runtime Policy A is selected |
| cross-File | block | correct |
| dangling | block | correct |
| new-file UPLOADING N/N | preserve | correct |
| terminal F/N | preserve | correct |
| completed N/N attached to pre-existing File | preserve without provenance check | **DEFECT** |

The final row is not addressed by R2's `MIG-*` vectors.

### 13.3 Lock safety

The lock source:

```text
file_upload_intent ACCESS EXCLUSIVE
file SHARE
```

omits:

```text
file_version
```

and does not require stopped application writers. R3-P2-01 applies.

### 13.4 Failure and retry

Expected from prior evidence:

```text
P3018
unfinished migration row
P3009 on retry
```

The prior controlled R2 result substantiates this for the preceding R3
Migration only:

```text
wp-2a-cm1-controlled-validation-completion-r2.md:266-315
```

It does not prove partial-DDL rollback after a mid-migration deadlock for this
new Migration.

### 13.5 Schema authority

The intended single compound Prisma relation is clear in R2. It remains:

```text
NOT VERIFIED
```

until:

- `prisma validate`;
- generated SQL inspection;
- clean migration rebuild;
- non-empty upgrade;
- from-migrations/to-schema diff;
- reverse relation/query tests.

### 13.6 Migration verdict

```text
DESIGN DEFECT
```

The precheck classification is improved, but the write-lock protocol and
new-file provenance precheck are incomplete.

## 14. Prisma Relation Review

The selected semantic model is:

```text
existingFileId -> File.id
(expectedCurrentFileVersionId, existingFileId)
  -> FileVersion(id, fileId)
```

and only one expected-current relation is declared. This is the correct
direction.

Not independently established:

- Prisma accepts the exact final full schema;
- the compound optional relation compiles in generated Client;
- Prisma emits exactly the intended DDL;
- no second FK is recreated;
- existing File relation action changes are represented consistently;
- `migrate diff` is empty.

These are implementation-gate requirements, not current PASS evidence.

## 15. Corrected Test Requirements

All R2 test rows remain required except where SQLSTATE/control attribution must
be corrected.

Add:

| ID | Test | Expected |
|---|---|---|
| `R3-AI-27` | N/N Intent completes under pre-existing File | reject |
| `R3-AI-28` | N/N Intent completes under File created by another Intent | reject |
| `R3-AI-29` | legal N/N Intent completes under File created by same Intent | success |
| `R3-AI-30` | Append UPLOADING then direct File current advance commits | reject under invariant policy |
| `R3-AI-31` | same transaction File current advance + Intent COMPLETED | success |
| `R3-AI-32` | Migration starts while Append finalization is between FileVersion and Intent completion | quiescence gate blocks; otherwise record lock outcome |
| `R3-AI-33` | FileVersion DELETE expected target | `42501` from BEFORE Trigger |
| `R3-AI-34` | UPDATE existingFileId | `42501`/identity trigger |
| `R3-AI-35` | UPDATE expectedCurrentFileVersionId | `23514`/target-slot trigger |
| `R3-AI-36` | Cross-File deferred FK isolated after snapshot check | `23503` and exact constraint name |

Every future test must record:

- actual first rejecting Trigger/constraint;
- SQLSTATE and constraint name;
- transaction commit/rollback result;
- pre/post rows;
- File provenance;
- active-slot count;
- File current and FileVersion count;
- Provider side effects if a service path is involved.

## 16. Historical and External Items Preserved

Still open or not verified:

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

The new R3 findings do not close or downgrade these items.

## 17. New Findings Summary

```text
R3-P1-01  New-file completion lacks durable File-creation provenance
R3-P1-02  UPLOADING append current snapshot is not a persistent invariant
R3-P2-01  Migration lock set/order can deadlock with live finalization
R3-P2-02  Test matrix contains inaccurate/ambiguous SQLSTATE ownership
```

No P0 was found.

## 18. Git State at Review End

Only this review report was added.

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  77
Untracked files:        78
New report:             docs/architecture/wp-2a-cm1-append-intent-relational-integrity-independent-review-r3.md
```

No source, Schema, Migration, SQL, test, configuration, database or existing
report was modified.

## 19. Report Self-Verification

After final freezing:

```text
SHA-256:             reported in the delivery response to avoid self-reference
Bytes:               reported in the delivery response
Lines:               reported in the delivery response
Markdown fences:     statically balanced
Trailing whitespace: statically checked
Execution scope:     read-only; no PostgreSQL, Provider or Build
```

## 20. Final Decision

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

The R2 revision fixes the original UPLOADING CHECK error, preserves stale
PENDING and defines one same-File relation shape. It does not yet establish a
database-authoritative new-File provenance relation, does not make the
UPLOADING current snapshot persistent, and leaves an unsafe Migration lock
protocol.

The next step is another design correction, not implementation or isolated
validation.
