# WP-2A-CM1 Append Intent Relational Integrity Isolated PostgreSQL Validation R20

## 0. Final conclusion

```text
FAIL — DATABASE INVARIANTS OR MIGRATION BEHAVIOR FAILED
```

The fresh isolated PostgreSQL 18.7 migration run failed at phase-40 with
PostgreSQL error `42703`:

```text
column "record_kind" does not exist
```

The failure occurred in the phase-40 historical precheck. Catalog evidence
shows that phase-40 did not install its functions or triggers; the phase-39
objects remain present, and phase-41 was not executed.

No source, Schema, Migration, test, Provider, IAM/ACL or production state was
modified.

## 1. Inputs and baseline

Verified:

```text
R19 report SHA-256 F810C40109709C1A236EB7D028F20933223D14318FA5C067D38989FBB23C77D7
R18 report SHA-256 94D3FBAF328BDE784BABF8564DEADCA6D3E19F610D5A18A5F6632DA58C3B9751
```

Git before validation:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      101
Untracked files:        102
```

## 2. Isolated instance

```text
Root directory:         D:\AI-Elevator-Advisor-CM1-R20
Data directory:         D:\AI-Elevator-Advisor-CM1-R20\pgdata
Evidence directory:     D:\AI-Elevator-Advisor-CM1-R20\evidence
Logs directory:         D:\AI-Elevator-Advisor-CM1-R20\logs
Bind address:           127.0.0.1
Port:                   55439
PostgreSQL version:     18.7
Test database:          cm1_r20_validation
Test role (no secret):  cm1_r20_app
```

The test database was created with `cm1_r20_app` as owner. No password,
connection string, secret or environment file content is included in this
report.

The instance was stopped with `pg_ctl -m fast`; port 55439 was verified free
after shutdown. The data directory and evidence were retained.

## 3. Migration execution

The project's actual Prisma Migration Runner was invoked with an
ID-only local datasource override:

```text
prisma migrate deploy --schema prisma/schema.prisma
```

Migrations 1 through 17 applied successfully. The following migrations were
attempted:

| Migration | Result |
|---|---|
| phase1 baseline through phase39 append integrity | PASS |
| `20261126150000_phase40_append_intent_finalization_hardening` | **FAIL — PostgreSQL 42703** |
| `20261126160000_phase41_append_scope_precheck` | **NOT APPLIED** |

The reported phase-40 error was:

```text
Database error code: 42703
column "record_kind" does not exist
PL/pgSQL function inline_code_block line 7 at SQL statement
```

The source-level cause is visible in:

```text
prisma/migrations/20261126150000_phase40_append_intent_finalization_hardening/migration.sql:331-343
```

`classified` introduces `record_kind`, but `ranked` selects `record_kind`
from `conflicts`, which does not expose that column. The precheck therefore
does not compile, despite static text tests passing.

## 4. Migration history and schema evidence

Evidence files:

```text
D:\AI-Elevator-Advisor-CM1-R20\logs\prisma-migrate-deploy.log
D:\AI-Elevator-Advisor-CM1-R20\logs\prisma-migrate-status.log
D:\AI-Elevator-Advisor-CM1-R20\evidence\prisma-migrations-postfailure.log
D:\AI-Elevator-Advisor-CM1-R20\evidence\phase40-catalog-postfailure.log
D:\AI-Elevator-Advisor-CM1-R20\evidence\phase40-constraints-postfailure.log
D:\AI-Elevator-Advisor-CM1-R20\logs\pg_ctl-stop.log
```

`_prisma_migrations` contained completed rows through phase39 and an
unfinished phase40 row with:

```text
finished_at:       NULL
rolled_back_at:    NULL
applied_steps_count: 0
```

Post-failure catalog values:

```text
phase40 p13_assert_completed_intent_final():        absent
phase40 p13_protect_file_provenance_scope():        absent
phase40 p13_completed_intent_final_guard:           absent
phase40 p13_file_provenance_scope_immutable:        absent
phase39 p13_completed_append_current_guard:          present
phase39 File.createdByUploadIntentId column:         present
phase39 compound expected/completed FKs and CHECK:   present
```

This is evidence that the phase-40 failure occurred before its function and
trigger DDL. It does not make the migration PASS; the migration itself is
non-runnable.

## 5. V1–V7 execution status

### V1 — fresh database migration

`FAIL`:

- fresh cluster and database created successfully;
- phase-1 through phase-39 applied;
- phase-40 failed at precheck with `42703`;
- phase-41 did not run;
- no complete final schema.

### V2 — historical precheck vectors

`BLOCKED` after the phase-40 compile failure. No historical fixture vectors
were executed because the Migration cannot reach a valid execution path.

### V3 — failure and retry

Observed:

- phase-40 precheck failure without phase-40 DDL;
- unfinished phase-40 migration row;
- phase-41 absent.

Not tested:

- phase-40 DDL failure;
- phase-40 postcheck failure;
- phase-40 success then phase-41 failure;
- phase-41 retry;
- full-chain rerun.

### V4 — constraints and Trigger behavior

`NOT VERIFIED`. The initial chain did not reach phase-40, so the new
completion and File scope controls could not be executed.

### V5 — uniqueness and concurrency

`NOT VERIFIED`. No valid phase-40 schema existed, so FileVersion uniqueness,
active-slot, stale-current and stale ownership tests were not run.

### V6 — READ COMMITTED behavior

`NOT VERIFIED`. No service or valid upload transaction was started.

### V7 — phase-41 defensive checks

`BLOCKED`. Phase-41 was not applied because phase-40 failed first.

## 6. Isolated environment safety

The following boundaries were maintained:

- only the new `cm1_r20_validation` database was used;
- only the new `cm1_r20_app` role was used;
- no existing development or test database was connected;
- no existing PostgreSQL service was stopped or modified;
- no Provider, IAM, ACL, production service or environment secret was used;
- the new instance was stopped and port 55439 is free.

## 7. Git state

Before validation:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      101
Untracked files:        102
```

After validation and this report:

```text
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      102
Untracked files:        103
New report:             docs/architecture/wp-2a-cm1-append-intent-relational-integrity-isolated-postgresql-validation-r20.md
```

No Git write, commit, push, reset, restore, clean, checkout or stash was used.

## 8. Evidence hashes

Recorded during the run:

```text
prisma-migrate-deploy.log
SHA-256 40D059218BA5ADEAFE6D8A297F6E18B26A29EDFD668672A1D3026F6B41DFA293

prisma-migrations-postfailure.log
SHA-256 C48D71022FD09205517FB7F645CA0E3B8D06B43A9FBD464052352A62141BCE53

phase40-catalog-postfailure.log
SHA-256 4CBE94501108B6123DE1B8F12C03EDBD48FD1479DF0177B0E8A6D7149F5798DE

phase40-constraints-postfailure.log
SHA-256 1B6EDB04C0090A281C0E7BF49DED31244D197E9E19157EA6FFC03AA0BB4FEAFB

pg_ctl-stop.log
SHA-256 3A6747065DE8C2DBC66A6BAA73D5AB09C2C03EB8851704F973AC4B886E6805F2
```

## 9. Findings

### R20-P1-01 — phase-40 precheck SQL does not compile

Severity: `P1`

File:

```text
prisma/migrations/20261126150000_phase40_append_intent_finalization_hardening/migration.sql:331-343
```

Trigger: any fresh database migration run.

Expected: phase-40 precheck executes and either passes or raises a controlled
category error.

Actual: PostgreSQL raises `42703` before any phase-40 DDL.

Impact: phase-40 and phase-41 cannot be applied; all downstream database
validation, concurrency validation and runtime readiness are blocked.

Recommendation: make `ranked` select from `classified` (or carry
`record_kind` in `conflicts`), then re-run all static tests and the isolated
Migration.

## 10. Not verified / blocked

```text
phase-40 executable SQL:                         FAIL / 42703
phase-41 execution:                              NOT REACHED
historical precheck vectors:                     BLOCKED
phase-40 DDL/trigger behavior:                   BLOCKED
phase-40 postcheck behavior:                     BLOCKED
phase-40/41 failure/retry matrix:                BLOCKED
_prisma_migrations completed final state:        NOT VERIFIED
constraint and Trigger negative tests:           NOT VERIFIED
FileVersion uniqueness runtime:                  NOT VERIFIED
active-slot/stale-current/stale ownership:       NOT VERIFIED
READ COMMITTED behavior:                         NOT VERIFIED
Web/Worker PostgreSQL integration:               NOT VERIFIED
real Provider:                                   NOT VERIFIED
Windows OS fencing:                              NOT VERIFIED
IAM/ACL:                                         NOT VERIFIED
production deployment:                           BLOCKED
```

## 11. Metadata

```text
Database instance:       PostgreSQL 18.7, loopback 127.0.0.1:55439
Instance status:         stopped
Port 55439 after stop:   free
Source changes:          none
Schema changes:          none
Migration changes:       none during R20
Provider access:         none
Build/E2E:               none
```

The final report SHA-256, byte count and line count are reported in the
delivery response because a file cannot contain its own stable final SHA-256.

## 12. Final decision

```text
FAIL — DATABASE INVARIANTS OR MIGRATION BEHAVIOR FAILED
```

The fresh isolated PostgreSQL run found a real phase-40 precheck compilation
defect. A source remediation and a new isolated validation run are required
before this database path can proceed.
