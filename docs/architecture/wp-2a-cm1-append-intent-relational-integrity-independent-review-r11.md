# WP-2A-CM1 Append Intent Relational Integrity Independent Review R11

## 0. Final conclusion

```text
FAIL
```

The R10 implementation correctly adds the compound expected-current and
completed-target relations, deferred Append current guards, explicit upload
transaction isolation and substantial test source. Independent source review
found two unresolved P1 integrity defects:

```text
R11-P1-01  N/N completion can bind a new FileVersion to an existing File
           without the originating File provenance or current-pointer check.

R11-P1-02  File project/customer/building/unit/creator fields remain mutable
           after creation and after completed upload provenance is recorded,
           allowing the completed Intent/File relationship to become stale.
```

These defects are source-level structural blockers. PostgreSQL execution is not
required to establish them. No database, Migration, Build, E2E, Provider or
runtime operation was performed.

## 1. Reviewed revision and workspace

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      87
Untracked files:        88
```

R10 report hash:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-controlled-implementation-r10.md
SHA-256 29EE0315E5CBDCD64FAC8AF5F55A897B63B2A44AC27642B7B2F6CAAD708F08E4
VERIFIED
```

R8 and R9 hashes:

```text
R8 1D5331C62553A2B3C38466B6D6FFC0B10FA25735147E61CA58470CD539502FCC
R9 587C69BD7B08B4FB4B4284F21A649DEBED3DE3D93666DC19D1669750840AAFB3
```

## 2. Actual files inspected

Primary source:

```text
prisma/schema.prisma
prisma/migrations/20261126140000_phase39_append_intent_relational_integrity/migration.sql
prisma/migrations/20261115213000_phase31_file_data_model/migration.sql
prisma/migrations/20261115233000_phase32_upload_intents/migration.sql
prisma/migrations/20261126130000_phase38_route_c_minimal_recovery_hardening/migration.sql
prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql
apps/web/src/modules/files/upload-service.ts
apps/web/src/modules/files/object-upload-service.ts
apps/web/src/modules/files/object-upload-lease.ts
apps/web/tests/append-intent-relational-integrity.test.ts
apps/web/tests/integration/phase39-append-intent-integrity.test.ts
apps/web/tests/helpers/p13-file-version.ts
apps/web/tests/helpers/object-upload-prisma-harness.ts
apps/web/tests/object-upload-service.test.ts
```

Design and historical evidence:

```text
R1-R10 CM1 designs and reviews
wp-2a-cm1-append-intent-relational-integrity-remediation-design-r4.md
wp-2a-cm1-append-intent-relational-integrity-remediation-design-r6.md
wp-2a-cm1-append-intent-relational-integrity-remediation-design-r8.md
wp-2a-cm1-append-intent-relational-integrity-independent-review-r9.md
P30-P37, FZ, ST, DBTP
```

## 3. R8/R9 implementation assessment

| Design requirement | R11 result |
|---|---|
| expected-current belongs to existing File | Source relation correct |
| completed Append target belongs to existing File | Source relation correct |
| Append completion subject to deferred current check | Source present |
| new-File completion belongs to originating File | **FAIL — P1 bypass** |
| File current is latest completed version | Source present for File updates |
| completed target immutable after completion | Source present |
| explicit `READ COMMITTED` | Source present at 12 upload `$transaction` sites |
| direct DML cannot bypass | **FAIL — two P1 bypasses** |
| R9 negative matrix | Test source improved but incomplete |
| Migration precheck/locks/postchecks | Partial; execution not verified |

## 4. A — File and Intent relational integrity

### 4.1 Correct controls

`File.createdByUploadIntentId` is:

- nullable for legacy Files;
- unique;
- linked to an Intent by FK;
- immutable when its own column is updated;
- checked at File INSERT for UPLOADING N/N Intent state, hierarchy and actor.

The expected-current pair CHECK correctly rejects N/I and active I/N.

The compound expected-current FK is:

```text
MATCH SIMPLE
DEFERRABLE INITIALLY DEFERRED
ON DELETE RESTRICT
ON UPDATE RESTRICT
```

The completed-target same-File FK is configured equivalently and is a valid
database proof for Append I/I completion.

### 4.2 R11-P1-01 — N/N completion can target any existing File

Severity: `P1`

Relevant source:

```text
prisma/migrations/20261126140000_phase39_append_intent_relational_integrity/migration.sql:529-531
prisma/migrations/20261126140000_phase39_append_intent_relational_integrity/migration.sql:300-304
prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:1194-1357
```

`p13_assert_completed_append_current` returns immediately when
`existingFileId IS NULL`:

```sql
IF i."existingFileId" IS NULL THEN
  RETURN NULL;
END IF;
```

The new-File provenance check is attached only to `AFTER INSERT ON "file"`.
It does not fire when a later FileVersion is inserted under a File that already
exists.

The P1-3 upload chain verifies that the completed FileVersion has the same
`uploadIntentId`, Attempt, Lifecycle and Operation, but does not verify that:

```text
FileVersion.fileId points to the File created by the same N/N Intent
File.currentVersionId equals the completed FileVersion
```

Attack sequence using otherwise valid P1-3 rows:

```text
1. Existing File F already has current version FV0.
2. Create N/N Intent I in UPLOADING state.
3. Build a valid Attempt/Lifecycle/FINALIZE Operation chain.
4. Insert FileVersion FV1 with fileId=F and versionNumber > FV0.
5. Set I.completedFileVersionId=FV1 and status=COMPLETED.
6. Do not update F.currentVersionId.
7. COMMIT.
```

Static trigger analysis:

- P1-3 chain sees one completed FileVersion for Intent I and passes.
- R10 completion guard returns at the N/N branch.
- File origin terminal guard does not fire because no File INSERT occurred.
- latest-current guard does not fire because File.currentVersionId did not
  change.

Expected safe result: reject with no completion committed.

Actual source disposition: COMMIT can succeed, leaving F with an uncompleted
higher FileVersion and a COMPLETED N/N Intent unrelated to F.

This directly contradicts R4 `R4-T-02` / `R4-T-03` and R6 `R6-T-03` /
`R6-T-04`, which explicitly require completion-provenance rejection.

### 4.3 R11-P1-02 — File provenance scope/actor can become stale

Severity: `P1`

Relevant source:

```text
prisma/schema.prisma:367-397
prisma/migrations/20261115213000_phase31_file_data_model/migration.sql:266-340
prisma/migrations/20261126140000_phase39_append_intent_relational_integrity/migration.sql:191-241
prisma/migrations/20261126140000_phase39_append_intent_relational_integrity/migration.sql:596-675
```

The File origin Trigger validates the following only during File INSERT:

```text
Intent.projectId        = File.projectId
Intent.buildingId       = File.buildingId
Intent.installationUnit = File.installationUnitId
Intent.uploadedById     = File.createdById
```

After INSERT, only `createdByUploadIntentId` itself is immutable. Existing
constraints allow a direct update that moves the File to another valid
customer/project while preserving an internally valid hierarchy, for example:

```text
UPDATE file
SET customerId = C2,
    projectId = P2,
    buildingId = NULL,
    installationUnitId = NULL,
    createdById = U2
WHERE id = F;
```

The update can satisfy the File customer/project FKs and composite hierarchy
constraints. The completed Intent still records C1/P1 and U1.

File-side guards do not reject this:

- origin immutability fires only when `createdByUploadIntentId` is updated;
- latest-current guard returns when currentVersionId did not change;
- Append active guard concerns only UPLOADING Intents;
- no File field identity guard covers project/customer/building/unit/creator.

Impact:

- completed Intent provenance and File authorization scope can diverge;
- an existing File can be moved to another project/customer through direct DML;
- access code derives ownership from the now-moved File;
- completed upload origin no longer proves actor or scope;
- the database authority goal is not met.

Expected safe result: completed/versioned File provenance scope and creator are
immutable, or a dedicated reviewed transfer protocol exists.

Actual source disposition: ordinary UPDATE is accepted.

## 5. B — Completion and current pointer

The Append I/I branch is materially improved:

- completion target and current mismatch are checked at COMMIT;
- same-transaction event rows are used only to classify completion;
- final Intent, FileVersion and File rows are re-read;
- current regression to an older version is rejected;
- target mutation after COMPLETED is rejected;
- multiple Event rows re-read final primary-key rows.

Remaining defects:

- the N/N branch skips completion provenance/current entirely (`P1`);
- the latest-current guard is attached only to File INSERT/UPDATE, so a
  FileVersion insert without a File current update is not independently caught;
- File scope/actor update after completion is not revalidated (`P1`).

No final source proof was found that covers all four inputs to the new-File
terminal invariant:

```text
Intent
Target File
Target FileVersion
File.currentVersionId
```

## 6. C — concurrency, isolation and locks

### 6.1 Source PASS

All interactive transactions in the two upload services pass:

```text
isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
```

Current call-site evidence:

```text
upload-service.ts:566, 720, 1263, 1597, 2311
object-upload-service.ts:461, 569, 711, 779, 838, 920, 1143
```

Raw SQL inside those callbacks inherits the transaction isolation.

The one-active-Append partial unique index remains:

```text
one_active_append_intent_per_file
ON existingFileId
WHERE existingFileId IS NOT NULL AND status='UPLOADING'
```

The File creation origin Trigger obtains the Intent row lock. Append creation
obtains File `FOR SHARE`; reservation obtains File `FOR UPDATE`. No new
application-level lock inversion was found in the normal upload paths.

### 6.2 Remaining limitations

- Actual server-side isolation is not observed (`SHOW transaction_isolation`
  not executed).
- The test named “two sessions” uses one `PrismaClient` and no explicit
  two-client barrier.
- Both contenders compute `versionNumber` outside their finalization
  transactions, so they commonly collide on
  `(fileId, versionNumber)` first. The test accepts this as success, so it does
  not isolate the intended reservation/current guard.
- The N/N completion bypass can also create a new higher version without a File
  current event, defeating the expectation that File events cover all changes.
- READ COMMITTED is correctly treated as one component; it is not claimed as
  sufficient concurrency proof.

## 7. D — Migration safety

Source-level positives:

- forward-only phase 3.9 Migration;
- fixed lock order:
  `file_version -> file -> file_upload_intent`;
- `ACCESS EXCLUSIVE NOWAIT`;
- precheck textually before first `ALTER TABLE`;
- compound FK, CHECK and guard creation order is reviewable;
- postchecks cover FK deferrability, pair CHECK, index and named trigger count.

Limitations:

- PostgreSQL parsing/execution was not performed.
- The precheck does not identify historical invalid completion provenance or
  current/latest states. This is partly intentional for legacy policy, but
  means passing the precheck does not prove global historical invariants.
- Trigger postchecks count names only; relation/event/timing are not fully
  asserted by the postcheck itself.
- Failure rollback and Prisma `_prisma_migrations` behavior remain unverified.

No Migration execution blocker was found independently of the source P1s.

## 8. E — test credibility

R10 contains:

```text
7 static tests
16 PostgreSQL integration test cases in source
executed PostgreSQL integration tests: 0
```

The source tests genuinely use Prisma raw DML for most negative cases and do
not disable triggers. However:

| R9 case | R10 test source | R11 result |
|---|---|---|
| COMPLETED with NULL target | present | first control not isolated |
| target belongs another Intent | present | likely rejected by P1-3 chain first |
| FileVersion.fileId update | present | yes |
| FileVersion.versionNumber update | present | yes |
| completed target DELETE | present | yes |
| COMPLETED -> UPLOADING | present | yes |
| older completed current | present | yes |
| uncompleted max version | missing | test gap |
| two completed Intents in one tx | missing | test gap |
| TRUNCATE/FK | present | yes |
| current NULL with versions | missing | test gap |
| exact relation names | present | catalog-level only |
| N/N completes under existing File | missing | **P1 contract gap** |
| completion first, pointer later | missing | R8 order not covered |
| true two-client reservation race | weak | one client, no barrier |

The static `isValid` matrix duplicates a subset of intended CHECK semantics; it
does not execute PostgreSQL or prove MATCH SIMPLE behavior.

Test source existence is not execution evidence. All 16 database cases remain
`NOT VERIFIED`.

## 9. F — historical findings

| Finding | R11 status |
|---|---|
| `R9-P2-01` negative matrix | `PARTIAL`; at least three R9 cases remain absent |
| `R9-P2-02` explicit isolation | `RESOLVED AT SOURCE LEVEL`; runtime `NOT VERIFIED` |
| `R9-P2-03` drain evidence | `NOT VERIFIED` |
| R8 completed/current P1 | `PARTIAL`; Append branch improved, N/N/File-mutation bypasses remain |
| `R7-P2-02` first-control tests | `PARTIAL` |
| `R7-P2-03` operational evidence | `NOT VERIFIED` |
| `R5-P2-01` complete matrix | `PARTIAL` |
| `R5-P2-02` evidence classification | `PARTIAL` |
| `R3-P1-02` persistent current invariant | `PARTIAL`; new-File path bypass remains |
| `R3-P2-01` offline runbook | `PARTIAL`; not executed |
| `R3-P2-02` SQLSTATE/control matrix | `PARTIAL` |
| `CM1-R2-IReview-P2-02` Prisma SQL | `NOT VERIFIED` |
| `CM1-R2-IReview-P2-03` tests | `PARTIAL` |

Unchanged external restrictions:

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

## 10. Findings and minimum corrections

### R11-P1-01

Extend completion validation so an N/N completion must prove:

```text
target FileVersion.uploadIntentId = Intent.id
target File.createdByUploadIntentId = Intent.id
target File.currentVersionId = Intent.completedFileVersionId
target FileVersion.fileId = target File.id
```

The check must run for N/N as a deferred final-state guard. A FileVersion-side
deferred guard is also acceptable if it closes the same path.

Required regression tests:

- N/N completes under an unrelated existing File: rejected, no rows committed.
- N/N completes under another Intent's origin File: rejected.
- N/N completion without current update: rejected.
- legal new-File completion remains accepted.
- completion-first then current update remains accepted.

### R11-P1-02

Add a File provenance/scope immutability guard. At minimum, Files with a
non-NULL origin or at least one FileVersion must reject changes to:

```text
customerId
projectId
buildingId
installationUnitId
createdById
createdByUploadIntentId
```

Any future reassignment/transfer must use a separately reviewed protocol.

Required regression tests:

- move origin File to another valid project/customer: rejected;
- change building/unit scope: rejected;
- change creator: rejected;
- unchanged non-scope metadata update remains allowed if intended.

No R8 redesign is required; these are completion/provenance guard
completions.

### R11-P2-01

Add the three missing R9 tests: uncompleted max version, current NULL with
versions, and two completed Intents in one transaction.

### R11-P2-02

Replace the concurrency test with two explicit clients and a deterministic
barrier after both PENDING Intents exist and immediately before reservation.
Use distinct markers but resolve `versionNumber` inside the transactions.
Assert the first loser control.

### R11-P2-03

Separate tests for NULL target and wrong-Intent target must force/assert the
intended guard rather than accepting any `23514`.

### R11-P3-01

Postchecks should assert trigger relation/table/event/timing, not only names.

## 11. PostgreSQL tests still required

1. Compile all functions and create all triggers/FKs.
2. Execute N/N completion attacks under existing and foreign-origin Files.
3. Execute File scope/creator mutation attacks after successful completion.
4. Execute legal new-File completion in both update orders.
5. Execute both orders of Append completion/current update.
6. Execute all FileVersion identity/DELETE/TRUNCATE cases.
7. Execute multi-event, SAVEPOINT and `SET CONSTRAINTS`.
8. Execute two-client reservation/finalization with barriers.
9. Observe `READ COMMITTED` in real service transactions.
10. Apply safe/unsafe non-empty Migrations and inspect history/rollback.
11. Verify Prisma Client DML and generated SQL against manual SQL objects.

## 12. NOT VERIFIED / BLOCKED

```text
PostgreSQL Trigger/FK/CHECK execution:          NOT VERIFIED
PL/pgSQL compilation:                           NOT VERIFIED
actual READ COMMITTED server value:             NOT VERIFIED
Prisma runtime behavior:                        NOT VERIFIED
two-client concurrency:                         NOT VERIFIED
Migration execution/rollback:                   NOT VERIFIED
_prisma_migrations failure state:                NOT VERIFIED
historical non-empty database:                   NOT VERIFIED
live Web/Worker PostgreSQL:                      NOT VERIFIED
real Provider:                                   NOT VERIFIED
Windows OS fencing:                              NOT VERIFIED
IAM/ACL:                                         NOT VERIFIED
E2E/Build/deployment:                            NOT VERIFIED
production enablement:                           BLOCKED
```

## 13. Git state after review

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      88
Untracked files:        89
New review report:      docs/architecture/wp-2a-cm1-append-intent-relational-integrity-independent-review-r11.md
```

No source, Schema, Migration, test or existing report was modified.

## 14. Report metadata

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

## 15. Final decision

```text
FAIL
```

R10 does not yet satisfy the direct-DML and new-File provenance requirements.
The minimum correction is to complete the N/N final-state proof and make
File provenance scope/creator immutable, then add the specific regression
tests above before controlled PostgreSQL validation.
