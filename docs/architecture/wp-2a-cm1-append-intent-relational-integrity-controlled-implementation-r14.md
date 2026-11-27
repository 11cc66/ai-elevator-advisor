# WP-2A-CM1 Append Intent Relational Integrity Controlled Implementation R14

## 0. Final conclusion

```text
PASS WITH RESTRICTIONS
```

R12 was implemented in a new forward-only phase-40 Migration, upload service
guard code, test fixtures and test source. All permitted offline validation
commands passed. PostgreSQL execution, Migration application, database
integration tests and production behavior remain `NOT VERIFIED`.

The R11 P1 defects are implemented at source level:

```text
R14-P1-01  unified N/N and Append completion final guard
R14-P1-02  immutable File provenance scope and creator
```

They are not claimed as PostgreSQL-verified.

## 1. Baselines and workspace

Verified design inputs:

```text
R12 SHA-256 56C2A47F352BC0889ADE64600E71B7F003B0BFB7815676D7A6710DDC29070032
R13 SHA-256 33900BEDD6A65C5B7EDC59A4A72F23568274E611F43B7103AEBDEA1C4C311BF9
```

Git at task start, as recorded by R13/R14 authorization:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      90
Untracked files:        91
```

The worktree was dirty before R14. Existing uncommitted and untracked user
work was preserved.

## 2. Files changed

New:

```text
prisma/migrations/20261126150000_phase40_append_intent_finalization_hardening/migration.sql
apps/web/tests/fixtures/phase40-append-intent-history-vectors.ts
apps/web/tests/phase40-append-intent-finalization.test.ts
apps/web/tests/integration/phase40-append-intent-finalization.test.ts
```

Modified:

```text
apps/web/src/modules/files/upload-service.ts
apps/web/tests/helpers/p13-file-version.ts
```

No semantic Prisma Schema change was required. `prisma/schema.prisma` was
formatted and validated as part of the existing R10 worktree.

## 3. R12 implementation

### 3.1 Immediate completion provenance

The phase-40 Migration replaces `validate_upload_intent_completion()`.

It now re-reads the completed FileVersion and File and requires:

- target FileVersion.uploadIntentId equals the completing Intent;
- target FileVersion file belongs to the target Intent/File path;
- File project/building/unit matches the Intent;
- File customer matches its project customer;
- Append target File equals `existingFileId`;
- N/N target File has `createdByUploadIntentId = Intent.id`;
- N/N target File creator equals the Intent uploader;
- N/N has no expected-current value.

Failure SQLSTATE is `42501` with a provenance-specific message.

### 3.2 Unified deferred completion

New:

```text
p13_assert_completed_intent_final()
p13_completed_intent_final_guard
AFTER UPDATE ON file_upload_intent
DEFERRABLE INITIALLY DEFERRED
```

The guard re-reads final:

```text
Intent
completed FileVersion
target File
expected FileVersion
max FileVersion versionNumber
```

It checks both paths:

```text
N/N:
  File.createdByUploadIntentId = Intent.id
  expectedCurrentFileVersionId IS NULL

Append:
  File.id = Intent.existingFileId
  expected current belongs to File
  expected versionNumber < completed versionNumber

Both:
  FileVersion.uploadIntentId = Intent.id
  File.currentVersionId = completedFileVersionId
  completed versionNumber = max versionNumber
```

The R10 Append-only completion trigger/function is removed from the active
schema after the unified replacement is created.

### 3.3 File provenance immutability

New:

```text
p13_protect_file_provenance_scope()
p13_file_provenance_scope_immutable
BEFORE UPDATE OF
  customerId, projectId, buildingId, installationUnitId,
  createdById, createdByUploadIntentId
```

The guard uses `IS DISTINCT FROM`, rejecting:

- NULL to non-NULL;
- non-NULL to NULL;
- different non-NULL values;
- combined scope changes;
- batch updates;
- direct DML;
- update/cascade paths that attempt to change a scope field.

SQLSTATE is `42501`.

Existing File INSERT origin validation remains in force. The service also
rejects a legacy File as a new Append target before database dispatch:

```text
LEGACY_FILE_APPEND_FORBIDDEN
```

### 3.4 Legacy-unverified behavior

Historical N/N completed records with a NULL File origin are classified as
`legacy_unverified` by precheck only when no proven origin File exists.

The Migration does not backfill or modify them. The runtime rules are:

- existing authorized reads remain unchanged;
- new Append target creation is rejected;
- legacy current pointer advancement is rejected;
- new N/N completion cannot omit origin;
- no runtime GUC or bypass flag exists.

The phase-40 precheck excludes legacy current ownership from
`file_current_unowned` only when the row is an actual N/N legacy record; it
still records the row in the `legacy_unverified` inventory.

## 4. R13 P2 disposition

| R13 finding | R14 disposition |
|---|---|
| Legacy runtime policy incomplete | `IMPLEMENTED IN SOURCE/TEST SOURCE`; legacy Append and current advance are blocked |
| COMPLETED -> UPLOADING first control | `IMPLEMENTED IN TEST SOURCE`; expected first control is phase-3.2 completion guard |
| Migration vectors not concrete | 16 structured vectors added; no database execution |
| Finalization race ambiguous | active-slot, stale-current and stale-ownership tests separated; version uniqueness remains a catalog/identity backstop test |
| Trigger matrix incomplete | event-bit assertions added in integration source |
| Postcheck name-only | postcheck now checks relation, event bits, deferrability and enabled state |

### 4.1 Important limitation: version-number race semantics

The active partial unique index and File locking prevent two complete valid
Append finalizations from reaching a committed two-winner state. The
`(fileId, versionNumber)` unique index is a separate backstop, not a replacement
for the active-slot protocol. The current integration test source verifies the
index and identity guard separately; a future controlled PostgreSQL test must
record the exact insertion conflict without claiming active-slot validation.

## 5. Phase-40 Migration

Path:

```text
prisma/migrations/20261126150000_phase40_append_intent_finalization_hardening/migration.sql
```

It does not modify the R10 phase-39 Migration.

### 5.1 Precheck ordering and locks

The Migration:

1. sets local timeouts;
2. locks `project`, `file_version`, `file`, and
   `file_upload_intent` in fixed order;
3. runs the historical precheck;
4. only then creates/replaces functions and triggers;
5. runs catalog postchecks.

The precheck runs before the first DDL.

### 5.2 Categories

Implemented categories:

```text
invalid_pair
dangling_expected
cross_file_expected
uploading_current_mismatch
completed_target_missing_or_wrong_intent
append_completed_target_wrong_file
append_expected_not_before_target
new_file_origin_conflict
new_file_target_not_origin
origin_scope_mismatch
versioned_file_null_current
file_current_not_max
file_current_unowned
active_append_legacy_origin
legacy_unverified
```

All non-legacy conflicts raise `23514` with bounded category counts and sample
IDs. `legacy_unverified` is emitted as a notice/inventory and remains
unmodified.

No record is automatically repaired, backfilled, deleted or re-pointed.

### 5.3 Historical vectors

`phase40-append-intent-history-vectors.ts` contains 16 concrete vector
specifications with:

- object set;
- input state;
- expected category;
- continuation decision;
- expected SQLSTATE;
- expected rejection location;
- evidence path.

The evidence paths are reserved locations for controlled execution; no files
were generated because PostgreSQL was not authorized.

### 5.4 Failure and retry

The source assumes Prisma executes the Migration in its normal transactional
runner boundary. A precheck or DDL failure must roll back the phase-40 changes.
Actual `P3018`, `_prisma_migrations`, and rerun behavior remain `NOT VERIFIED`.

## 6. Trigger event coverage

| Object/event | Control | Timing |
|---|---|---|
| File INSERT | origin/current and terminal checks | BEFORE/deferred |
| File UPDATE | provenance-scope immutable | BEFORE ROW |
| File UPDATE | current/latest and active Append checks | deferred |
| File DELETE | FK/restrict/chain guards | database constraints/triggers |
| File TRUNCATE | applicable chain guards/FKs | statement/FK behavior |
| FileVersion INSERT | storage/lifecycle chain | BEFORE/deferred |
| FileVersion UPDATE | identity/storage guards | BEFORE |
| FileVersion DELETE | identity guard | BEFORE |
| FileVersion TRUNCATE | `p13_file_version_truncate_guard` | BEFORE STATEMENT |
| Intent INSERT | PENDING-only guard | BEFORE |
| Intent UPDATE | target/state/history guards | BEFORE |
| Intent completion | unified final guard | deferred |
| Intent DELETE | intent identity guard | BEFORE |
| Intent TRUNCATE | `p13_upload_intent_truncate_guard` | BEFORE STATEMENT |

Integration test source asserts key catalog event bits:

```text
p13_completed_intent_final_guard    17 / deferrable / initially deferred
p13_file_provenance_scope_immutable 19 / immediate
p13_created_file_terminal_guard      5 / deferred
p13_append_current_file_commit_guard 29 / deferred
p13_upload_intent_truncate_guard     34 / statement
```

PostgreSQL catalog execution remains unverified.

## 7. Transaction and concurrency review

All 12 upload interaction transaction call sites retain explicit:

```text
Prisma.TransactionIsolationLevel.ReadCommitted
```

The design and source continue to rely on:

- File row locks in reservation/finalization paths;
- one-active-Append partial unique index;
- Intent CAS/PENDING state transitions;
- deferred final completion checks;
- latest-current guard;
- operation owner/generation/lease fencing.

### 7.1 Test source separation

`phase40-append-intent-finalization.test.ts` contains separate source cases for:

- active-slot competition with two `PrismaClient` instances and a barrier;
- stale-current exclusion with two independent clients;
- stale execution ownership takeover with two clients and generation CAS;
- version-number unique index inspection separately from active-slot.

The version-number test is intentionally catalog/identity-level because two
fully valid committed Append winners cannot coexist under the active-slot
protocol. PostgreSQL execution of this test is `NOT VERIFIED`.

## 8. First controls and test source

Static test:

```text
apps/web/tests/phase40-append-intent-finalization.test.ts
9 tests
```

Database integration source:

```text
apps/web/tests/integration/phase40-append-intent-finalization.test.ts
21 test cases in source
```

Expected first controls:

| Scenario | First control |
|---|---|
| N/N under unrelated File | immediate completion provenance `42501` |
| N/N under another origin | immediate completion provenance `42501` |
| NULL completed target | unified final guard `23514` |
| different-File target | immediate provenance `42501` |
| same-File other Intent | immediate provenance `42501` |
| File scope update | File provenance scope guard `42501` |
| FileVersion identity mutation | phase-3.1 identity guard `42501` |
| completed target DELETE | FileVersion delete guard `42501` |
| completed -> UPLOADING | phase-3.2 completion guard `23514` before phase-3.7 |
| legacy Append target | database/service fail closed `42501` |
| legacy current advance | latest-current guard `42501` |
| TRUNCATE | P1-3 truncate guard `42501` |

The first-control expectation for `COMPLETED -> UPLOADING` now accounts for
the existing phase-3.2 completion guard and is not attributed to the later
state guard.

## 9. Prisma and schema consistency

No new Prisma column or relation was required for R14:

- `createdByUploadIntentId` already exists;
- `completedFileVersionId` already exists;
- File scope columns already exist;
- all new controls are PostgreSQL functions/triggers.

Executed:

```text
pnpm exec prisma format --schema prisma/schema.prisma
pnpm db:validate
pnpm db:generate
```

All passed. This does not validate PL/pgSQL or trigger behavior.

## 10. Verification commands

Executed:

| Command | Result |
|---|---|
| `pnpm exec prisma format --schema prisma/schema.prisma` | PASS |
| `pnpm db:validate` | PASS |
| `pnpm db:generate` | PASS |
| `pnpm --filter @elevator/web test` | PASS, 38 files / 368 tests |
| `pnpm --filter @elevator/worker test` | PASS, 8 files / 33 tests |
| `pnpm --filter @elevator/file-storage test` | PASS, 6 files / 51 tests |
| `pnpm --filter @elevator/contracts test` | PASS, 4 files / 15 tests |
| `pnpm --filter @elevator/selection-engine test` | PASS, 2 files / 9 tests |
| `pnpm --filter @elevator/web typecheck` | PASS |
| `pnpm typecheck` | PASS, 8 typecheck-capable workspace projects |
| `git diff --check` | PASS; expected LF/CRLF warnings only |

One initial static assertion failed because a Migration field was line-wrapped;
the assertion was normalized without changing SQL semantics. Final tests
passed.

Not executed:

- PostgreSQL connection, SQL, Migration, Migration reset or database reset;
- `pnpm test:db:*` or database integration tests;
- Build;
- E2E/Browser Runtime;
- Provider, IAM/ACL, Windows OS fencing;
- service start/restart, Scheduler or deployment.

## 11. NOT VERIFIED / BLOCKED

```text
phase-40 SQL parse and execution:                 NOT VERIFIED
PL/pgSQL function compilation:                    NOT VERIFIED
trigger firing order and event bits:              NOT VERIFIED
FK cascade versus File immutability:              NOT VERIFIED
precheck safe/unsafe clone execution:             NOT VERIFIED
Prisma _prisma_migrations failure state:           NOT VERIFIED
real READ COMMITTED server observation:           NOT VERIFIED
two-client database behaviors:                    NOT VERIFIED
version-number insertion conflict execution:      NOT VERIFIED
live Web/Worker PostgreSQL integration:           NOT VERIFIED
real Provider:                                    NOT VERIFIED
Windows OS fencing:                               NOT VERIFIED
IAM/ACL:                                          NOT VERIFIED
production deployment:                            BLOCKED
```

## 12. Permission boundary

The new triggers block normal DML, but the current `elevator_app` database
owner can still alter tables, disable triggers, or change schema if credentials
or a privileged SQL path are compromised.

This is not claimed as production-grade isolation. Independent
Web/Worker/Maintenance/Definer/Recovery roles and ACL proof remain required.

## 13. Git state

Before R14 implementation:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      90
Untracked files:        91
```

After implementation before this report:

```text
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      94
Untracked files:        95
```

After adding this report:

```text
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      95
Untracked files:        96
```

No Git add, commit, push, reset, restore, clean, checkout or stash was used.

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
PASS WITH RESTRICTIONS
```

The source implementation and permitted offline tests are complete for R14.
Controlled PostgreSQL validation, database integration execution and
production security remain unverified.
