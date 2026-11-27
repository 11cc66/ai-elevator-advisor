# WP-2A-CM1 — Controlled Validation Completion Batch R2

## 0. Final Conclusion

```text
FAIL — VALIDATION DEFECTS REMAIN
```

本轮建立了新的独立 PostgreSQL 18.7 实例和可复现脚本，补齐了旧证据包中的
objectKey、append、Prisma Migration failure、双 Session 和提交故障验证。

实际验证发现一个阻断性数据库缺陷：

```text
file_upload_intent.expectedCurrentFileVersionId
  -> only generic FK to file_version(id)
  -> PostgreSQL accepted a UPLOADING append intent on f_stale
     whose expectedCurrentFileVersionId = fv_r2
     belonging to a different File.
```

正常应用服务在 reservation 时会再次锁住目标 File 并比较 currentVersionId，
但数据库本身没有保证 expected-current 与 existingFileId/当前版本属于同一
File。因此不能把“过期 expected-current 的数据库拒绝路径”标为 PASS。

## 1. Authorization and Inputs

授权：`WP-2A-CM1 — Controlled Validation Completion Batch R2`。

审查输入：

```text
docs/architecture/wp-2a-cm1-postgresql-controlled-validation.md
docs/architecture/wp-2a-cm1-postgresql-independent-review-r1.md
```

输入报告 SHA-256:

```text
PostgreSQL validation: 572381B31D4376BB96F5D5588CE7EE7442C9C8237F6A99852EF61F18ADF6B010
Evidence audit:        697D04857D3F2CA0E63553F3108B0DC2949A63400EAA48257EDDCD43E00E8373
```

历史独立状态保持：

```text
R5 57 Open Decisions:          OPEN
BV7:                           FAIL
BV8:                           NOT INDEPENDENTLY APPROVED
Historical governance R8:      BLOCKED
P2-05 business retention:      OPEN
```

## 2. Pre-Validation Git State

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  72
Untracked files:        73
```

The prior temporary PostgreSQL data/evidence directory was present and was not
deleted or reused.

## 3. New Isolated Instance

```text
Version:              PostgreSQL 18.7
Host:                 127.0.0.1
Port:                 55441
Role:                 wp2a_admin
Root:                 C:/Users/thinkbook/AppData/Local/Temp/
                      wp2a-cm1-r2-f3179197a8fc447693f6b84b3d59622f
Data directory:       <Root>/data
Evidence directory:   <Root>/evidence
Scripts:              <Root>/scripts
Fixtures:             <Root>/fixtures
```

Instance identity output:

```text
postgres|wp2a_admin|18.7|.../wp2a-cm1-r2-f3179197a8fc447693f6b84b3d59622f/data|55441|127.0.0.1
```

The instance was a newly initialized cluster, not a database created inside the
existing `postgresql-x64-18` service. The existing service and port 5432 were
not used.

## 4. Reproducible Evidence Package

The new temporary directory contains:

```text
scripts/01-start-instance.ps1
scripts/02-create-databases.ps1
scripts/03-migrate.ps1
scripts/04-run-sql-case.ps1
scripts/05-postgres-proxy.js
scripts/06-run-cases.ps1
scripts/07-stop-instance.ps1
fixtures/01-object-base.sql
fixtures/02-object-finalize.sql
fixtures/03-append-legal.sql
fixtures/04-append-duplicate-expected-fail.sql
fixtures/05-append-stale.sql
fixtures/06-duplicate-objectkey-expected-fail.sql
fixtures/07-duplicate-fileversion-expected-fail.sql
fixtures/08b-append-race-pending.sql
fixtures/08c-append-session-a.sql
fixtures/08d-append-session-b.sql
fixtures/09-history-cm1.sql
README.md
```

Raw outputs retained include:

```text
evidence/instance-identity.log
evidence/r2_clean-migrations.log
evidence/r2-clean-object-base.log
evidence/r2-clean-object-finalize.log
evidence/r2-clean-append-legal.log
evidence/r2-clean-append-duplicate.log
evidence/r2-clean-append-stale.log
evidence/r2-clean-duplicate-objectkey.log
evidence/r2-clean-duplicate-fileversion.log
evidence/r2-append-two-session.log
evidence/r2-prisma-clean-deploy.log
evidence/r2-prisma-history-before.log
evidence/r2-prisma-failed-deploy.log
evidence/r2-prisma-history-after.log
evidence/r2-prisma-repeat-deploy.log
evidence/r2-prisma-post-summary.log
evidence/r2-final-db-summary.log
```

The scripts/evidence were created outside the repository and are not secrets.

## 5. objectKey and Append Verification

### 5.1 Legal object chain

`fixtures/01-object-base.sql` followed by `fixtures/02-object-finalize.sql`
created a legal OBJECT_STORE chain in `r2_clean`.

Observed final state:

```text
Intent COMPLETED
Attempt COMPLETED
Operation APPLIED
Canonical Lifecycle ACTIVE
Staging Lifecycle STAGING_READY
Binding VERIFIED
FileVersion exactly 1
```

### 5.2 Duplicate objectKey

`fixtures/06-duplicate-objectkey-expected-fail.sql` was executed as a real
PostgreSQL transaction and rejected:

```text
SQLSTATE: 23505
constraint: storage_object_lifecycle_storageKey_key
```

The test demonstrates that an object storage key cannot be duplicated through
the lifecycle key path. The binding namespace unique index also exists, but a
genuinely independent legal parent chain with the same objectKey cannot be
constructed without violating the lifecycle key uniqueness first. The binding
index itself therefore remains `PARTIAL` as a legal-chain test.

`fixtures/07-duplicate-fileversion-expected-fail.sql` attempted a second
FileVersion for the same object storage key and was rejected:

```text
SQLSTATE: 23505
constraint: file_version_storageKey_key
```

This supports the object-to-FileVersion uniqueness boundary, although the
rejection occurred at FileVersion storageKey uniqueness rather than the binding
index.

### 5.3 Append with correct expected current

`fixtures/03-append-legal.sql` inserted an append Intent for `f_r2` with
`expectedCurrentFileVersionId=fv_r2` and completed reservation:

```text
exit: 0
final Intent status: UPLOADING
```

### 5.4 Duplicate active append

`fixtures/04-append-duplicate-expected-fail.sql` attempted a second UPLOADING
append Intent for the same File. PostgreSQL rejected it:

```text
SQLSTATE: 23505
constraint: one_active_append_intent_per_file
```

### 5.5 Two-session append race

`fixtures/08b-append-race-pending.sql` created two PENDING append Intents for
`f_race`; `08c-append-session-a.sql` and `08d-append-session-b.sql` ran in two
independent PowerShell jobs, each using its own psql process.

Observed result:

```text
Session A: UPDATE 1, COMMIT, Intent ic_a UPLOADING
Session B: ERROR 23505, duplicate key one_active_append_intent_per_file
Final: ic_a UPLOADING with ac_a; ic_b PENDING
```

Only one session won. The loser left no committed active append chain.

### 5.6 Stale/cross-File expected-current — FAIL

`fixtures/05-append-stale.sql` created `f_stale` with no current version and an
Intent with `existingFileId=f_stale` and
`expectedCurrentFileVersionId=fv_r2`, where `fv_r2` belongs to `f_r2`.

PostgreSQL accepted the transaction:

```text
stale_intent|ia_stale|f_stale|fv_r2||UPLOADING
```

The final database query shows the Intent is `UPLOADING` and the expected
version is not the target File's current version. The application code performs
a `FOR UPDATE` current-version check in `upload-service.ts` around lines
528-547, but the database constraint is only:

```sql
FOREIGN KEY ("expectedCurrentFileVersionId")
REFERENCE "file_version"("id")
```

It does not constrain `(existingFileId, expectedCurrentFileVersionId)` to the
same File or to `file.currentVersionId`. This is a real database-level gap,
not merely an unverified branch.

### Finding CM1-R2-VAL-P1-01

| Field | Content |
|---|---|
| Severity | `P1` |
| Location | `prisma/migrations/20261126130000_phase38_route_c_minimal_recovery_hardening/migration.sql:103-107`; `apps/web/src/modules/files/upload-service.ts:528-547` |
| Trigger | Direct/alternate repository DML creates or mutates an append Intent with a stale/cross-File expected version |
| Reproduction | `fixtures/05-append-stale.sql` committed with `ia_stale|f_stale|fv_r2||UPLOADING` |
| Impact | A stale append reservation can exist at DB level; normal service path later rejects via application CAS, but any direct DML or missing application path can use it |
| Required correction | Add a database-enforced same-File/current-version relationship, or a deferred trigger validating the target File's current version at Commit/reservation |
| Blocks isolated validation | `YES` until the expected-current database invariant is explicitly resolved or scoped |

## 6. Prisma Non-Empty Failure History

A temporary Prisma migration project was created under:

```text
<Root>/prisma-cm1/prisma
```

It copied the real schema and the 15 existing migrations through CM1. The first
Prisma deploy created a real non-empty `r2_prisma` database:

```text
prisma migrate deploy: exit 0
migrations before R3:  15 completed
```

Synthetic dangerous OBJECT_STORE history was inserted. Then the actual R3
Migration was copied into the temporary migration directory and the project
Prisma runner was executed:

```text
pnpm exec prisma migrate deploy --schema <temp>/prisma/schema.prisma
exit: 1
P3018
Database error code: 23514
CM1-R3 precheck blocked before DDL: any_object_lifecycle=1
```

After failure:

```text
new R3 columns:        0
object lifecycles:     1
_prisma_migrations:    16 rows
finished migrations:   15
unfinished R3 row:     1
rolled_back R3:        0
```

The failed R3 history row has `finished_at IS NULL`; it is not marked complete.
A second deploy returned:

```text
exit: 1
P3009
migrate found failed migrations in the target database
```

Thus Prisma did not falsely mark the failed migration as completed, and did not
apply a later migration. The schema had no R3 columns after failure.

## 7. Web / Worker + PostgreSQL Integration

Status: `BLOCKED — no safe isolated app test entry was established`.

The current repository has integration tests that use real Prisma and service
functions, but the existing integration config reads `TEST_DATABASE_URL`,
`TEST_DATABASE_MARKER`, and test credentials from its test environment setup.
This validation authorization prohibits reading `.env`/`.env.test` and using
the existing `elevator_advisor_test` database. No dedicated isolated Web/Worker
runtime entry was present to launch the service against the new temporary
instance without either:

- reading prohibited test environment files, or
- modifying product/test infrastructure outside this validation batch.

Therefore the following remain `NOT VERIFIED`, not PASS:

```text
Web HTTP create-upload-intent:                  NOT VERIFIED
Web service upload/finalize against PG:         NOT VERIFIED
Worker live read through PG + Local adapter:    NOT VERIFIED
Live COMMIT-unknown service recovery:           NOT VERIFIED
Live stale Worker fencing:                      NOT VERIFIED
Live invalid binding read rejection:            NOT VERIFIED
Service restart/reconnect recovery:             NOT VERIFIED
```

The service-level harness tests from R3-R2 are useful source evidence but are
not a substitute for a live Web/Worker + PostgreSQL integration test.

## 8. P2/P3 Disposition

| Prior finding | Status | Evidence |
|---|---|---|
| objectKey duplicate | `PARTIAL` | lifecycle/FileVersion duplicate writes rejected by `23505`; independent binding-parent-chain duplicate not isolated |
| append expected-current legal path | `PASS` | `03-append-legal.sql` committed |
| append stale expected-current | `FAIL` | `05-append-stale.sql` accepted cross-File `fv_r2` |
| append two-session race | `PASS` | `r2-append-two-session.log`: A wins, B `23505` |
| Prisma failed-Migration history | `PASS — REPRODUCED` | P3018 then P3009; 15 finished, failed R3 row unfinished |
| Web/Worker live integration | `BLOCKED` | no safe isolated runtime entry under current authorization |
| P2-05 full terminal invariant | `PARTIAL` | core constraints and terminal negatives pass; orphan/multiple/append/role paths incomplete |
| evidence retention | `PASS — this batch` | scripts, fixtures, raw outputs, README and isolation log retained in new temp directory |

## 9. Evidence and Isolation Proof

The new instance identity was captured before tests:

```text
postgres|wp2a_admin|18.7|.../wp2a-cm1-r2-f3179197a8fc447693f6b84b3d59622f/data|55441|127.0.0.1
```

Database names:

```text
r2_clean
r2_prisma
r2_concurrency
```

No existing PostgreSQL service was stopped or modified. The new instance was
stopped with `pg_ctl -m fast`; `pg_isready` for port 55441 returned no response
and the port was free.

## 10. Test Commands and Exit Codes

Executed setup and migration commands:

```text
scripts/01-start-instance.ps1                    exit 0
scripts/02-create-databases.ps1                  exit 0
scripts/03-migrate.ps1 r2_clean                  exit 0
prisma migrate deploy (15 CM1 migrations)        exit 0
```

Executed clean/append/objectKey cases:

```text
01-object-base.sql                              exit 0
02-object-finalize.sql                          exit 0
03-append-legal.sql                             exit 0
04-append-duplicate-expected-fail.sql           exit 3 / SQLSTATE 23505
05-append-stale.sql                             exit 0 / FAIL (unexpected acceptance)
06-duplicate-objectkey-expected-fail.sql        exit 3 / SQLSTATE 23505
07-duplicate-fileversion-expected-fail.sql      exit 3 / SQLSTATE 23505
08b-append-race-pending.sql                     exit 0
08c/08d append race sessions                    A UPDATE 1; B 23505
```

Prisma failure:

```text
first R3 deploy:  exit 1 / P3018 / 23514
repeat R3 deploy: exit 1 / P3009
```

The raw logs are in `<Root>/evidence`; the executable fixtures are in
`<Root>/fixtures` and the reusable proxy is
`<Root>/scripts/05-postgres-proxy.js`.

## 11. Not Verified / Blocked

```text
Web HTTP/service + PostgreSQL                        BLOCKED
Worker live processing + PostgreSQL                  BLOCKED
Live app commit-response-loss recovery               NOT VERIFIED
Live Worker stale-fencing integration                NOT VERIFIED
Independent binding-parent-chain duplicate           NOT VERIFIED
Orphan/multiple FileVersion terminal matrix          NOT VERIFIED
Direct/indirect DML role/RLS matrix                  NOT VERIFIED
Real Provider                                        NOT VERIFIED
Windows OS-level storage fencing                     NOT VERIFIED
IAM/ACL                                              NOT VERIFIED
E2E / deployment                                     NOT VERIFIED
```

## 12. New Findings

### CM1-R2-VAL-P1-01 — cross-File stale expected-current accepted by PostgreSQL

See §5.6. This is a database-level integrity gap. The normal service current
version CAS must remain, and a database relation or deferred consistency check
must be designed before the expected-current claim can be considered closed.

### CM1-R2-VAL-P2-01 — live Web/Worker integration blocked

The environment has no safe isolated service entry that avoids reading
prohibited environment files or touching the existing test database. This is
an environment/test-infrastructure blocker, not evidence that the database
constraints are wrong.

### CM1-R2-VAL-P3-01 — objectKey duplicate test is not fully isolated

The lifecycle storageKey uniqueness rejects the initial duplicate before the
binding namespace index can be independently exercised with a legal parent
chain. The namespace index remains static/source-verified and the full legal
duplicate matrix remains `NOT VERIFIED`.

## 13. Git State

### Before this validation batch

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  72
Untracked files:        73
```

### After this report

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  73
Untracked files:        74
New report:             docs/architecture/wp-2a-cm1-controlled-validation-completion-r2.md
```

No Git reset, restore, clean, checkout, stash, add, commit or push occurred.
No source, Schema, Migration, existing report, protected artifact, `.env` or
`.env.test` was modified.

## 14. Instance Shutdown

The new instance was stopped with fast shutdown. `pg_isready` for port 55441
reported no response and port 55441 was free. The temporary data and evidence
directories were retained for audit.

## 15. Final Decision

```text
FAIL — VALIDATION DEFECTS REMAIN
```

The evidence package now contains real scripts and current raw logs, and the
Prisma P3018/P3009 and two-session append race results are reproducible. The
acceptance of a cross-File stale expected-current append Intent is a direct
validation defect and blocks a PASS. Live Web/Worker integration also remains
blocked.

This report is not authorization to alter Schema, Migration, triggers, roles,
Provider, Windows ACL or deployment. The next step requires a focused
remediation/validation decision.
