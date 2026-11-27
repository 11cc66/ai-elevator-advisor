# WP-2A-CM1 Append Intent Relational Integrity Targeted Corrections R16

## 0. Final conclusion

```text
PASS WITH RESTRICTIONS
```

The three R15 findings were addressed in source/test scope:

- a real duplicate FileVersion INSERT fixture now targets
  `(fileId, versionNumber)`;
- phase-41 adds explicit historical Append building/unit scope prechecks;
- active-slot source test now expects the unique-slot `P2002` path instead of
  accepting either `P2002` or stale-current `23514`.

No PostgreSQL, Migration or database integration test was executed.

## 1. Inputs and Git baseline

Verified:

```text
R15 SHA-256 CE9F3E7DE99AD1BC1086ADFFA8798B416B345DECCADF417B2FC37F580898F980
R14 SHA-256 ADF1C8FEEBDE04EBDF4C55EE90C0A9B23A505A5765BA03C94EA23D39B352981A
```

Git at R16 start:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      96
Untracked files:        97
```

The existing dirty worktree was preserved.

## 2. Files changed by R16

Added:

```text
prisma/migrations/20261126160000_phase41_append_scope_precheck/migration.sql
apps/web/tests/fixtures/phase40-append-intent-history-vectors.ts (extended to phase-41 vectors)
apps/web/tests/phase40-append-intent-finalization.test.ts
apps/web/tests/integration/phase40-append-intent-finalization.test.ts (extended duplicate-insert source)
```

No production upload service, Prisma Schema, R10 Migration or phase-40
Migration was changed in R16.

## 3. R15-P2-01 — real version-number uniqueness test

The previous source test only inspected the index or performed an update to
the same value. R16 adds `insertDuplicateVersion()` to the PostgreSQL
integration test source.

The test:

1. creates a valid base FileVersion;
2. creates a separate valid Attempt/Lifecycle/FINALIZE chain with a fresh
   storage key;
3. attempts to insert a FileVersion with the base `fileId` and identical
   `versionNumber`;
4. expects Prisma `P2002` with target metadata identifying `fileId` and
   `versionNumber`;
5. verifies only the original `(fileId, versionNumber)` row remains.

Prisma `P2002` corresponds to the underlying PostgreSQL unique violation;
the exact PostgreSQL SQLSTATE `23505` remains `NOT VERIFIED` until database
execution.

The test no longer uses a no-op UPDATE or index catalog lookup as its
behavioral proof.

## 4. R15-P2-02 — phase-41 historical Append scope precheck

New forward-only Migration:

```text
prisma/migrations/20261126160000_phase41_append_scope_precheck/migration.sql
```

It performs no DDL. It acquires the same fixed offline locks and executes a
precheck-only transaction block.

New categories:

```text
append_target_missing
append_building_scope_mismatch
append_installation_unit_scope_mismatch
append_scope_combination_mismatch
append_expected_current_wrong_file
append_expected_not_before_target
legacy_append_unverified
```

Semantics:

- building mismatch with matching unit is separately classified;
- unit mismatch with matching building is separately classified;
- both differing is a combined mismatch category;
- an Append target File missing from the table is unsafe;
- expected-current from another File is unsafe;
- expected-current at or after completed target is unsafe;
- an existing historical Append to a NULL-origin File is reported as
  `legacy_append_unverified` and is not automatically treated as proven safe.

All unsafe categories fail with `23514` before any phase-41 DDL. The Migration
does not modify, backfill, delete or re-point historical rows.

The precheck is additive after phase-40. If phase-40 has already rejected a
row, phase-41 is not reached; if phase-40 succeeds, phase-41 supplies the
deeper building/unit scope audit.

## 5. R15-P3-01 — active-slot precision

The two-client active-slot source test now expects:

```text
Prisma P2002
```

for the concurrent active-slot loser. The stale-current test separately
expects `23514` with the stale-suppression message.

The source distinguishes:

- active-slot unique conflict (`P2002`, underlying PostgreSQL unique
  constraint);
- stale-current trigger rejection (`23514`);
- stale execution ownership CAS count 0.

The tests are source-only until isolated PostgreSQL execution.

## 6. R15/R14 regression checks

Retained without weakening:

- N/N and Append unified completion guard;
- File six-field provenance immutability;
- Legacy Append/current fail-closed guards;
- File origin provenance;
- compound expected-current and completed-target relations;
- completed target immutability;
- latest-current guard;
- active Append partial unique index;
- 12 explicit upload `ReadCommitted` transaction sites;
- no automatic cleanup, purge, restore or destructive fallback.

The phase-41 precheck does not replace the phase-40 completion or File
immutability guards.

## 7. Test vectors

The history vector source now contains 22 vectors, including:

- safe historical data;
- Legacy-unverified N/N;
- Legacy Append;
- invalid pair and dangling expected version;
- cross-File expected-current;
- Append building mismatch;
- Append installation-unit mismatch;
- combined Append scope mismatch;
- wrong expected-current File;
- missing target File;
- current/latest and origin conflicts.

Each vector records object set, input state, category, continuation decision,
expected rejection location, expected SQLSTATE and evidence path.

The files are specifications only until the controlled Migration runner
executes them.

## 8. Validation results

Executed:

| Command | Result |
|---|---|
| `pnpm exec prisma format --schema prisma/schema.prisma` | PASS |
| `pnpm db:validate` | PASS |
| `pnpm db:generate` | PASS |
| `pnpm --filter @elevator/web test` | PASS, 38 files / 369 tests |
| `pnpm --filter @elevator/worker test` | PASS, 8 files / 33 tests |
| `pnpm --filter @elevator/file-storage test` | PASS, 6 files / 51 tests |
| `pnpm --filter @elevator/contracts test` | PASS, 4 files / 15 tests |
| `pnpm --filter @elevator/selection-engine test` | PASS, 2 files / 9 tests |
| `pnpm typecheck` | PASS, 8 typecheck-capable workspace projects |
| `pnpm --filter @elevator/web typecheck` | PASS |
| `git diff --check` | PASS; existing LF/CRLF warnings only |

One combined shell invocation of contracts and selection tests failed because
the shell treated the concatenated command as an npm script name. Both
packages were rerun individually and passed.

Not executed:

- PostgreSQL connection or SQL;
- Migration or database integration tests;
- Build, E2E or Browser Runtime;
- Provider, IAM/ACL, Windows fencing, Scheduler or deployment.

## 9. NOT VERIFIED / BLOCKED

```text
phase-41 SQL parse/execution:                    NOT VERIFIED
phase-40/phase-41 rollback and Prisma history:   NOT VERIFIED
real duplicate FileVersion INSERT SQLSTATE:      NOT VERIFIED
real active-slot P2002 behavior:                 NOT VERIFIED
real stale-current PostgreSQL race:              NOT VERIFIED
real stale ownership CAS behavior:               NOT VERIFIED
deferred trigger ordering:                       NOT VERIFIED
FK cascade versus File immutability:             NOT VERIFIED
historical safe/unsafe Migration vectors:        NOT VERIFIED
actual Read Committed server value:              NOT VERIFIED
live Web/Worker PostgreSQL integration:          NOT VERIFIED
real Provider:                                   NOT VERIFIED
Windows OS fencing:                              NOT VERIFIED
IAM/ACL:                                         NOT VERIFIED
production deployment:                           BLOCKED
```

## 10. Permission boundary

Ordinary DML is covered by the source Trigger definitions. The current
`elevator_app` database owner can disable triggers or alter schema. R16 does
not change IAM/ACL and does not claim production-grade protection.

## 11. Git state

Before R16 implementation:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      96
Untracked files:        97
```

After R16 source before this report:

```text
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      97
Untracked files:        98
```

After adding this report:

```text
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      98
Untracked files:        99
```

No Git add, commit, push, reset, restore, clean, checkout or stash was used.

## 12. Report metadata

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

## 13. Final decision

```text
PASS WITH RESTRICTIONS
```

R16 addresses the three R15 source/test findings without changing the R10 or
phase-40 Migration. The remaining restrictions are PostgreSQL execution
evidence, real concurrent-session evidence, Migration rollback/history and
production role isolation.
