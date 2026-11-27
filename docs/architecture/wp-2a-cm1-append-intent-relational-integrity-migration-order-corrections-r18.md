# WP-2A-CM1 Append Intent Relational Integrity Migration Order Corrections R18

## 0. Final conclusion

```text
PASS WITH RESTRICTIONS
```

R18 moves the historical Append building/unit scope checks into phase-40
before its first function/trigger DDL, converts phase-41 into a defensive
post-phase-40 verification, defines unique unsafe-record counting, and
strengthens the active-slot loser assertion to inspect Prisma target metadata.

All source checks pass. PostgreSQL and Migration execution remain
`NOT VERIFIED`.

## 1. Authorization and baseline

Verified R17:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-independent-review-r17.md
SHA-256 E04821D41AC4A75FDF9A4719480EF18FBC3DC7E3D814AC3D00135FB2FC747A79
```

R17 final conclusion:

```text
FAIL — DESIGN OR IMPLEMENTATION CORRECTIONS REQUIRED
```

Git before R18:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      99
Untracked files:        100
```

The phase-40 and phase-41 migration directories were already untracked
worktree files. R14/R15/R16/R17 reports consistently record that PostgreSQL,
SQL and Migration execution were not performed. No `_prisma_migrations`
evidence or applied phase-40 record exists in the repository evidence. R18
therefore treated phase-40 as not executed and eligible for the authorized
pre-application correction.

## 2. Modified files

```text
prisma/migrations/20261126150000_phase40_append_intent_finalization_hardening/migration.sql
prisma/migrations/20261126160000_phase41_append_scope_precheck/migration.sql
apps/web/tests/fixtures/phase40-append-intent-history-vectors.ts
apps/web/tests/phase40-append-intent-finalization.test.ts
apps/web/tests/integration/phase40-append-intent-finalization.test.ts
```

No production service, Prisma Schema, role, ACL or existing report was
modified.

## 3. R17-P1-01 correction

### Before

The phase-40 precheck did not classify Append building/unit scope. Those
checks lived in phase-41 after phase-40 DDL.

### After

Phase-40 now performs one precheck before:

```text
CREATE OR REPLACE FUNCTION
CREATE FUNCTION
DROP TRIGGER
CREATE TRIGGER
```

The precheck categories now include:

```text
invalid_pair
dangling_expected
cross_file_expected
uploading_current_mismatch
completed_target_missing_or_wrong_intent
append_completed_target_wrong_file
append_expected_not_before_target
append_target_missing
append_building_scope_mismatch
append_installation_unit_scope_mismatch
append_scope_combination_mismatch
append_expected_current_wrong_file
new_file_origin_conflict
new_file_target_not_origin
origin_scope_mismatch
versioned_file_null_current
file_current_not_max
file_current_unowned
active_append_legacy_origin
legacy_unverified
legacy_append_unverified
```

All non-legacy categories are unsafe and raise `23514`. Phase-40's precheck
is before the first DDL in the file. The phase-40 transaction should roll
back if the precheck raises; actual Prisma runner behavior remains
`NOT VERIFIED`.

Result: `R17-P1-01` is resolved at source level.

## 4. Phase-40 precheck order and locking

The actual source order is:

```text
SET LOCAL timeouts
-> LOCK project, file_version, file, file_upload_intent
   ACCESS EXCLUSIVE NOWAIT
-> historical precheck DO block
-> function/trigger DDL
-> catalog postchecks
```

The historical precheck uses final locked table state. Service, Worker,
scheduler and retry processes must be drained for the Migration window.

The lock order is fixed:

```text
project
-> file_version
-> file
-> file_upload_intent
```

TOCTOU analysis:

- during the phase-40 transaction, the ACCESS EXCLUSIVE locks prevent
  concurrent writes to the checked tables;
- phase-40 and phase-41 are separate Migration files and do not provide
  cross-migration atomicity;
- phase-41 reacquires the same locks and performs a defensive recheck;
- the operational drain remains mandatory until both migrations complete.

## 5. Phase-41 responsibility

Phase-41 remains a precheck-only Migration and now has a clear defensive
role:

1. revalidate Append target scope after phase-40;
2. detect unsafe building, unit and combined scope data;
3. recheck expected-current File and ordering;
4. report legacy Append inventory;
5. verify phase-40 unified completion and File provenance triggers exist,
   are enabled and are not duplicated by the old completion guard;
6. provide retry evidence without introducing DDL.

The first detection of a known unsafe historical scope is now phase-40, not
phase-41.

## 6. Migration failure and retry state

| Failure | Structural state | Retry implication |
|---|---|---|
| phase-40 precheck | phase-39 remains; phase-40 DDL should not execute | rerun after data repair |
| phase-40 DDL/postcheck | phase-40 should roll back within its runner transaction | rerun after correction |
| phase-40 success, phase-41 precheck | phase-40 remains committed; phase-41 not committed | repair/review then retry phase-41 |
| phase-40 success, phase-41 postcheck | phase-40 remains; phase-41 failed | retry after catalog investigation |

The statement that phase-40 commits before phase-41 is based on Prisma
per-migration transaction behavior and is not claimed as verified by this
task. No PostgreSQL connection or `_prisma_migrations` query was performed.

## 7. Category counting semantics

Phase-40 and phase-41 now report:

```text
categoryCount
uniqueUnsafeRecords
details
```

`categoryCount` is the sum of category occurrences and may count the same
logical record more than once when categories overlap.

`uniqueUnsafeRecords` uses a stable record identity:

```text
record_kind + ':' + object_id
```

The record kind is `file` for File-level conditions and `intent` for
Intent-level conditions. Legacy categories are excluded from the unsafe
totals and are emitted as inventory notices.

The details object retains category-specific counts and bounded sample IDs.
No total is presented as a unique-row count unless it comes from the distinct
identity set.

Category overlap is allowed and documented:

- `legacy_append_unverified` may overlap a scope mismatch; the mismatch still
  blocks;
- expected-current categories may overlap target/completion categories;
- `categoryCount` is not a primary key or unique record count.

## 8. Active-slot P2002 assertion

The active-slot source test now:

- uses two independent `PrismaClient` instances;
- uses a barrier before the reservation transition;
- expects exactly one fulfilled transaction;
- requires the loser to be Prisma `P2002`;
- requires error target metadata to contain `existingFileId`;
- rejects a stale-current `23514` in this test;
- keeps stale-current and stale execution ownership in separate tests.

The actual Prisma `meta.target` format and underlying PostgreSQL active-slot
constraint name remain `NOT VERIFIED` until database execution.

## 9. Version-number duplicate INSERT

The version uniqueness test now constructs:

- a valid base FileVersion;
- a separate valid storage/lifecycle/attempt chain;
- a new FileVersion row with the base `fileId` and identical
  `versionNumber`;
- a fresh storage key, attempt and operation identity.

It expects Prisma `P2002` with target metadata containing `fileId` and
`versionNumber`, then verifies the original row remains and the duplicate
does not exist.

The test source does not execute PostgreSQL. The exact `23505`, constraint
name and before/after transaction behavior remain `NOT VERIFIED`.

## 10. Regression status

Retained:

- R11-P1-01 unified N/N and Append completion guard;
- R11-P1-02 six-file-field provenance immutability;
- Legacy-unverified service and database fail-closed behavior;
- R10 File origin, compound expected/current, completed-target immutability
  and latest-current guard;
- active Append partial unique index;
- 12 explicit upload `ReadCommitted` transactions;
- R16 history vectors and duplicate-version test source.

R18 does not relax any existing constraint or service permission.

## 11. Verification results

Executed:

| Command | Result |
|---|---|
| `pnpm exec prisma format --schema prisma/schema.prisma` | PASS |
| `pnpm db:validate` | PASS |
| `pnpm db:generate` | PASS |
| `pnpm --filter @elevator/web test` | PASS, 38 files / 370 tests |
| `pnpm --filter @elevator/worker test` | PASS, 8 files / 33 tests |
| `pnpm --filter @elevator/file-storage test` | PASS, 6 files / 51 tests |
| `pnpm --filter @elevator/contracts test` | PASS, 4 files / 15 tests |
| `pnpm --filter @elevator/selection-engine test` | PASS, 2 files / 9 tests |
| `pnpm typecheck` | PASS, 8 typecheck-capable workspace projects |
| `git diff --check` | PASS; expected LF/CRLF warnings only |

The phase-40/41 source changes are static/source-validated only. No database
integration test was executed.

## 12. NOT VERIFIED / BLOCKED

```text
phase-40 SQL execution:                         NOT VERIFIED
phase-41 SQL execution:                         NOT VERIFIED
PL/pgSQL compilation:                            NOT VERIFIED
Migration runner transaction boundaries:         NOT VERIFIED
phase-40/41 partial failure and retry state:     NOT VERIFIED
_prisma_migrations history:                      NOT VERIFIED
trigger event bits and firing order:              NOT VERIFIED
FK cascade versus scope immutability:            NOT VERIFIED
real active-slot P2002/meta.target:              NOT VERIFIED
real duplicate FileVersion 23505:                NOT VERIFIED
real stale-current race:                         NOT VERIFIED
real stale ownership CAS:                        NOT VERIFIED
historical safe/unsafe vector execution:         NOT VERIFIED
live Web/Worker PostgreSQL integration:          NOT VERIFIED
real Provider:                                    NOT VERIFIED
Windows OS fencing:                               NOT VERIFIED
IAM/ACL:                                          NOT VERIFIED
production deployment:                            BLOCKED
```

## 13. Permission boundary

Ordinary DML remains protected by the source triggers. The current
`elevator_app` owner can disable triggers or perform DDL. R18 does not modify
IAM/ACL and does not claim production-grade permission isolation.

## 14. Git state

Before R18:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      99
Untracked files:        100
```

After R18 source before this report:

```text
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      99
Untracked files:        100
```

After adding this report:

```text
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      100
Untracked files:        101
```

No Git add, commit, push, reset, restore, clean, checkout or stash was used.

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

## 16. Final decision

```text
PASS WITH RESTRICTIONS
```

R18 moves all known historical scope prechecks before phase-40 DDL, preserves
phase-41 as defensive verification, defines distinct category/evidence
counting, and improves the active-slot diagnostic assertion. PostgreSQL
execution and migration-failure semantics remain unverified.
