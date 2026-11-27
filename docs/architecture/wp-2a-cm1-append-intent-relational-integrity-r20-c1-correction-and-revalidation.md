# WP-2A-CM1 R20-C1 Phase-40 CTE Defect Correction and Isolated Revalidation

## 0. Final conclusion

```text
PASS WITH RESTRICTIONS — CORRECTION AND ISOLATED VALIDATION APPROVED WITH EXPLICIT LIMITATIONS
```

R20 的 phase-40 `42703` 缺陷已在源码中修复，并在全新的 PostgreSQL 18.7
隔离数据库中通过真实 Prisma Migration Runner 重新执行。重建的完整链为
19/19 Migration，phase-40 与 phase-41 均成功。核心 phase-40/phase-41
数据库行为测试在专用隔离库中实际执行，21/21 通过。

本轮仍保留明确限制：phase-39 之后的既有复合 FK、状态 Trigger 和 lifecycle
Trigger 已经阻止了部分更早历史类别的合法构造；未通过禁用 Trigger、修改
`_prisma_migrations` 或其他绕过方式伪造这些向量。真实 Provider、Windows
OS-level fencing、IAM/ACL、Web/Worker 真实 PostgreSQL E2E、生产 Migration
和部署仍未验证。

## 1. Authorization and baseline

R20 report was preserved without modification:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-isolated-postgresql-validation-r20.md
SHA-256 2595BCE8CC95942D006C91F71104F83831E07B2A916A4F1CE07E888537892A18
```

Initial Git state rechecked at execution start:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      102
Untracked files:        103
```

No commit, push, reset, restore, clean, checkout, stash or `git add` was used.

## 2. Original R20 failure

The original R20 database `cm1_r20_validation` failed phase-40 before its first
DDL with:

```text
Prisma error: P3018
PostgreSQL SQLSTATE: 42703
ERROR: column "record_kind" does not exist
```

Evidence:

```text
D:\AI-Elevator-Advisor-CM1-R20\logs\prisma-migrate-deploy.log
D:\AI-Elevator-Advisor-CM1-R20\evidence\prisma-migrations-postfailure.log
D:\AI-Elevator-Advisor-CM1-R20\evidence\phase40-catalog-postfailure.log
D:\AI-Elevator-Advisor-CM1-R20\evidence\phase40-constraints-postfailure.log
```

The original `_prisma_migrations` phase-40 row had `finished_at=NULL`,
`rolled_back_at=NULL` and `applied_steps_count=0`. Phase-40 functions and
triggers were absent; the phase-39 completion Trigger remained present;
phase-41 was not executed.

## 3. Root cause and correction

### 3.1 CTE data flow

The precheck data flow is:

```text
conflicts:
  category, object_id
classified:
  category, object_id, record_kind
ranked:
  category, object_id, record_kind, row_number
grouped:
  category, row_count, sample_ids
```

The broken `ranked` CTE consumed `FROM conflicts` while selecting
`record_kind`, a column declared only by `classified`. PostgreSQL therefore
failed during SQL compilation with `42703`.

### 3.2 Before and after

Phase-40 before:

```sql
ranked AS (
  SELECT category, object_id, record_kind, ...
  FROM conflicts
)
```

Phase-40 after:

```sql
ranked AS (
  SELECT category, object_id, record_kind, ...
  FROM classified
)
```

The same incorrect dependency existed in phase-41 and was corrected in the
same way. No classification category, DDL ordering, blocking condition,
category count or `record_kind + object_id` uniqueness rule was removed.

Modified migrations:

```text
prisma/migrations/20261126150000_phase40_append_intent_finalization_hardening/migration.sql
SHA-256 6C6D857B735F7CA130C319ECBDABB2E1BE5D123023B101425D7EAAE9897AFAC6

prisma/migrations/20261126160000_phase41_append_scope_precheck/migration.sql
SHA-256 42170616E40BB8DB4F9E1970525CB167C0B7CCE7465460996AB2552EA4A746FE
```

### 3.3 Targeted regression tests

The source-level regression test verifies that:

- `classified` declares `record_kind`;
- phase-40 `ranked` reads `FROM classified`;
- phase-40 `ranked` does not read `FROM conflicts`;
- the unique-record expression remains
  `count(DISTINCT record_kind || ':' || object_id)`;
- all Append scope categories remain before the first phase-40 function DDL;
- phase-41 has the same corrected CTE dependency.

The test would fail against the original `FROM conflicts` source because its
direct-input assertion and negative `FROM conflicts` assertion would both fail.

This review is a **self-review**, not an independent reviewer conclusion.

## 4. Isolated PostgreSQL identity

```text
Root:             D:\AI-Elevator-Advisor-CM1-R20
Data directory:   D:\AI-Elevator-Advisor-CM1-R20\pgdata
Bind address:     127.0.0.1
Port:             55439
PostgreSQL:       18.7
Admin role:       cm1r20
App role:         cm1_r20_app
Authentication:   local loopback only
```

Relevant databases:

| Database | Purpose |
|---|---|
| `cm1_r20_validation` | preserved original R20 phase-40 `42703` failure |
| `cm1_r20c1_validation` | intermediate phase-40 success / phase-41 `42703` failure |
| `cm1_r20c1b_validation` | earlier successful 19/19 full chain |
| `cm1_r20c1_hist` | phase-39-only baseline, 17/17 |
| `cm1_r20c1_scope_safe_owner` | legal Append; phase-40/41 success |
| `cm1_r20c1_scope_building` | building scope mismatch |
| `cm1_r20c1_scope_unit` | installation-unit scope mismatch |
| `cm1_r20c1_scope_combo` | combined scope mismatch |
| `cm1_r20c1_v4v7` | V4/V5 integration and V6 runtime isolation checks |
| `cm1_r20c1_phase41_failure` | controlled phase-41 postcheck failure |

No existing development/test database or Windows PostgreSQL service was used.

## 5. Migration execution

### 5.1 Full successful chain

`cm1_r20c1b_validation` executed:

```text
19 migrations found
19/19 applied
phase-40 PASS
phase-41 PASS
prisma migrate status: Database schema is up to date
```

Evidence:

```text
D:\AI-Elevator-Advisor-CM1-R20\logs\r20c1b-prisma-migrate-deploy.log
D:\AI-Elevator-Advisor-CM1-R20\logs\r20c1b-prisma-migrate-status.log
D:\AI-Elevator-Advisor-CM1-R20\evidence\r20c1b-migrations.log
D:\AI-Elevator-Advisor-CM1-R20\evidence\r20c1b-catalog.log
D:\AI-Elevator-Advisor-CM1-R20\evidence\r20c1b-constraints.log
```

### 5.2 Legal Append and scope precheck

`cm1_r20c1_scope_safe_owner` executed phase-40 and phase-41 successfully:

```text
phase-40: PASS
phase-41: PASS
_prisma_migrations: 19 finished, 0 unfinished
legal PENDING Append row: 1 retained
```

### 5.3 DDL-stage failure

An earlier clone owned by `cm1r20` passed the phase-40 precheck but failed at
the first function DDL with:

```text
SQLSTATE 42501
ERROR: permission denied for schema public
Prisma error: P3018
```

This was an isolated database ownership setup issue, not a source defect. The
failure is retained as DDL-stage evidence. It also demonstrates that a phase-40
DDL failure leaves an unfinished migration history row and is not silently
marked complete.

## 6. Historical precheck vectors

Each scope vector was constructed in its own phase-39 baseline database using
ordinary DML and active Triggers. No Trigger was disabled and
`_prisma_migrations` was not edited.

| Vector | Phase-40 result | Category evidence | Post-failure state |
|---|---|---|---|
| Safe matching Append | PASS | phase-40 and phase-41 both applied | 19/19 finished |
| Building mismatch | `23514` / P3018 | `append_building_scope_mismatch`, count 1 | no phase-40 DDL; phase-40 row unfinished |
| Installation-unit mismatch | `23514` / P3018 | `append_installation_unit_scope_mismatch`, count 1 | no phase-40 DDL; phase-40 row unfinished |
| Building+unit mismatch | `23514` / P3018 | `append_scope_combination_mismatch`, count 1 | no phase-40 DDL; phase-40 row unfinished |

For every unsafe vector:

```text
phase40_function:           false
phase40_scope_function:     false
phase40_trigger:            false
phase39 old completion:     true (retained)
phase40 applied_steps_count: 0
phase40 finished_at:        NULL
phase40 rolled_back_at:     NULL
```

Re-running `prisma migrate deploy` returned `P3009`; Prisma refused to skip or
overwrite the failed migration history.

The following phase-40 defense-in-depth categories could not be made to exist
in a database that had already passed phase-39 without forbidden bypass:

- Append target missing;
- dangling/cross-file expected-current;
- malformed active NULL pair;
- completed target owned by another Intent or File;
- variant current/latest provenance conflicts.

Those states are already rejected by phase-39 FKs, CHECKs and Triggers. They
therefore remain `NOT VERIFIED` as phase-40 executable historical vectors;
the phase-40 predicates remain source-reviewed but were not turned into PASS
evidence by disabling prior protections.

Evidence:

```text
D:\AI-Elevator-Advisor-CM1-R20\logs\r20c1-scope-building-migrate.log
D:\AI-Elevator-Advisor-CM1-R20\logs\r20c1-scope-unit-migrate.log
D:\AI-Elevator-Advisor-CM1-R20\logs\r20c1-scope-combo-migrate.log
D:\AI-Elevator-Advisor-CM1-R20\evidence\r20c1-scope-building-postfailure.log
D:\AI-Elevator-Advisor-CM1-R20\evidence\r20c1-scope-unit-postfailure.log
D:\AI-Elevator-Advisor-CM1-R20\evidence\r20c1-scope-combo-postfailure.log
D:\AI-Elevator-Advisor-CM1-R20\logs\r20c1-scope-building-migrate-retry.log
D:\AI-Elevator-Advisor-CM1-R20\logs\r20c1-scope-unit-migrate-retry.log
D:\AI-Elevator-Advisor-CM1-R20\logs\r20c1-scope-combo-migrate-retry.log
```

## 7. V4/V5 PostgreSQL behavior

The phase-40 integration test was executed against `cm1_r20c1_v4v7`, an
isolated full-schema database:

```text
Test Files  1 passed
Tests       21 passed
Exit code   0
```

Actual executed coverage includes:

- new-file N/N completion with pointer-before-completion;
- new-file N/N completion with completion-before-pointer;
- rejection under an unrelated existing File;
- rejection under another Intent's File;
- File creation/provenance validation;
- File six-field provenance immutability;
- completed target deletion protection;
- FileVersion identity mutation protection;
- completed-to-UPLOADING state reversal control;
- NULL completed target rejection;
- cross-File completed target rejection;
- real duplicate `(fileId, versionNumber)` insert mapped to Prisma `P2002`;
- two-client active-slot winner/loser with `P2002` on `existingFileId`;
- stale-current rejection;
- two-client stale-current blocking and final state check;
- two-client stale execution ownership CAS (`[0,1]`);
- required Trigger event/deferrable matrix;
- TRUNCATE protection after FK preemption was bypassed with `CASCADE` so the
  target P1-3 Trigger itself was exercised.

Some deferred Trigger errors arrive through Prisma as
`PrismaClientUnknownRequestError` and the wrapper omits a separate SQLSTATE
field. Those tests assert the exact first-control message rather than
silently accepting multiple error mechanisms. PostgreSQL phase-40/phase-41
precheck failures do expose `Database error code: 23514`.

Evidence:

```text
D:\AI-Elevator-Advisor-CM1-R20\logs\r20c1-v4v7-integration-test-retry2.log
D:\AI-Elevator-Advisor-CM1-R20\evidence\r20c1-v4-constraint-trigger-catalog.log
```

## 8. V6 READ COMMITTED

The repository contains 12 upload interactive transaction sites:

```text
upload-service.ts:          5
object-upload-service.ts:   7
Total:                     12
```

All 12 consume an explicit transaction-options constant containing:

```text
isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
```

An actual isolated Prisma transaction executed in
`cm1_r20c1_v4v7` and returned:

```json
{
  "requested": "ReadCommitted",
  "actual": "read committed"
}
```

This verifies the requested isolation level is effective in PostgreSQL. It does
not replace the existing source check that all 12 service entry sites pass the
options object.

## 9. V7 phase-41 catalog checks

Post-success catalog:

```text
completion function:          present
scope function:               present
completion constraint trigger: present, deferrable, initially deferred
scope trigger:                present
phase-39 old completion:      absent
migrations finished:          19/19
```

Phase-41 contains precheck and catalog postcheck `DO` blocks but no schema DDL.
It validates trigger names on their expected tables, deferrability/initially
deferred state for the completion guard, presence of the scope Trigger, and
absence of the legacy completion Trigger.

## 10. Migration failure and retry matrix

| Scenario | Result |
|---|---|
| phase-40 precheck failure | PASS as expected: `23514`, no phase-40 DDL, unfinished history |
| phase-40 precheck `42703` original defect | repaired and no longer reproduced |
| phase-40 first-DDL permission failure | observed `42501`, unfinished history |
| phase-40 success | observed in multiple fresh databases |
| phase-41 postcheck failure | induced isolated trigger absence produced `23514`; phase-40 finished, phase-41 unfinished |
| failed migration retry | `P3009`; no automatic overwrite |
| full successful chain | 19/19, status up to date |

Phase-40 postcheck failure and a naturally occurring phase-41 precheck data
failure were not independently constructed. They remain `NOT VERIFIED`.

Phase-41 induced failure evidence:

```text
D:\AI-Elevator-Advisor-CM1-R20\logs\r20c1-phase41-failure-phase40-deploy.log
D:\AI-Elevator-Advisor-CM1-R20\evidence\r20c1-phase41-failure-trigger-removed.log
D:\AI-Elevator-Advisor-CM1-R20\logs\r20c1-phase41-failure-migrate.log
D:\AI-Elevator-Advisor-CM1-R20\evidence\r20c1-phase41-failure-postfailure.log
```

## 11. Test-infrastructure findings and corrections

These were exposed by real database execution and corrected in the test
harness, without weakening production Triggers:

1. The checksum helper repeated strings instead of computing SHA-256.
   Corrected to `createHash("sha256")`.
2. A canonical lifecycle inserted as `FINALIZING` and later updated to
   `ACTIVE` accumulated deferred events with intermediate row snapshots. The
   fixture now settles the valid intermediate bijection event with
   `SET CONSTRAINTS ... IMMEDIATE`, then restores `DEFERRED`. No constraint was
   disabled.
3. Single-table `TRUNCATE file_version` was preempted by an FK dependency
   (`0A000`). The test now uses `TRUNCATE ... CASCADE` so the P1-3 Trigger is
   the first control under test.
4. The two-client stale-current test created the PENDING Intent after the
   expected-current had already become unreachable. It now creates the Intent
   first, uses a real second-session File row lock, and verifies blocking,
   rejection and final current state.
5. Database clones created by the admin role lacked DDL rights in `public`.
   A separate app-owned database was used for the successful path; the
   `42501` result is retained rather than hidden.

## 12. Source and regression verification

| Command | Result |
|---|---|
| `pnpm db:validate` | PASS |
| `pnpm db:generate` | PASS |
| `pnpm typecheck` | PASS, all 8 applicable workspace projects |
| `pnpm --filter @elevator/web test` | PASS, 38 files / 371 tests |
| `pnpm --filter @elevator/worker test` | PASS, 8 files / 33 tests |
| `pnpm --filter @elevator/file-storage test` | PASS, 6 files / 51 tests |
| `pnpm --filter @elevator/contracts test` | PASS, 4 files / 15 tests |
| `pnpm --filter @elevator/selection-engine test` | PASS, 2 files / 9 tests |
| isolated phase-40 PostgreSQL integration | PASS, 1 file / 21 tests |
| `git diff --check` | PASS; only pre-existing CRLF notices |

No Build, production Build, E2E, Browser Runtime, service start,
`security:startup`, Provider connection, IAM/ACL change or production
deployment was executed.

## 13. Files changed in this correction

Migrations:

```text
prisma/migrations/20261126150000_phase40_append_intent_finalization_hardening/migration.sql
prisma/migrations/20261126160000_phase41_append_scope_precheck/migration.sql
```

Tests and isolated validation harness:

```text
apps/web/tests/phase40-append-intent-finalization.test.ts
apps/web/tests/integration/phase40-append-intent-finalization.test.ts
apps/web/tests/helpers/p13-file-version.ts
apps/web/scripts/cm1-r20c1/seed-history-scope.ts
apps/web/scripts/cm1-r20c1/seed-phase40-integration.ts
apps/web/scripts/cm1-r20c1/verify-read-committed.ts
apps/web/vitest.r20c1.config.ts
```

Report:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-r20-c1-correction-and-revalidation.md
```

## 14. Evidence hashes

```text
FB1D3C8F89C265E07B02E84ADAD9791BDB7123630F1EA23B6B3D3A19029180B4
  logs\r20c1-hist-phase39-deploy.log

6BBE17AB7C3EB7BE3BEFC0AC361FB3DF258F3D274331C6A5DCF39FA8E68474DB
  logs\r20c1-scope-building-migrate.log

03826AC64782CC9ABFE606979594780BFC2CB21526FA61ED6EFE76AA223CE3FA
  logs\r20c1-scope-unit-migrate.log

0826C2C087C39D454DF23FCA8FEF13E4904E4ADBECB194F6DE6A9C1F3A5717AD
  logs\r20c1-scope-combo-migrate.log

7576CDB82F96BAEEA03E017C6713B623F3C7B23495D18543E2FE11709F2AEC50
  evidence\r20c1-scope-building-postfailure.log

7576CDB82F96BAEEA03E017C6713B623F3C7B23495D18543E2FE11709F2AEC50
  evidence\r20c1-scope-unit-postfailure.log

7576CDB82F96BAEEA03E017C6713B623F3C7B23495D18543E2FE11709F2AEC50
  evidence\r20c1-scope-combo-postfailure.log

A4890815752016478B1AA3FCA0C3B6F0E19E8A1597CD2E24233AAFAFFAB056B4
  logs\r20c1-scope-safe-owner-migrate.log

858A237BE274AE3FEAA32B54D755CB15FBA68070731169B0894295F42AB6A985
  logs\r20c1-v4v7-integration-test-retry2.log

2D5427EAA0A368F7B23F766A156448265783C97F67F02B706DD9EE1F7A2D2FE7
  evidence\r20c1-v4-constraint-trigger-catalog.log

5FA478033C98B057B2E51EF471BFFB86FA9B6FF7727682E9E09996B657AF6F30
  logs\r20c1-v6-read-committed.log

EB3CC762DE15B167BBC5EABE2272372628EB33004E0B0BC7D1D54C03B2E23F61
  evidence\r20c1-v7-phase41-catalog.log

BE4E2EBF3823EAAF3FB1ACC10178FD6E351E84440A4B60F0CECD0A1826028BBB
  logs\r20c1-phase41-failure-migrate.log

22E764EAE697CEFDB34BBCE476ADE09C60B0BB2E5C7E4DAD10AFD869A94740C0
  evidence\r20c1-phase41-failure-postfailure.log
```

All paths above are under:

```text
D:\AI-Elevator-Advisor-CM1-R20\
```

## 15. Git state and report metadata

Git state immediately before writing this report:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      104
Untracked files:        107
```

After adding this report, the final live Git state is recorded in section 17.

## 16. Unresolved and not verified

The following remain unresolved or not verified and are not made PASS by this
round:

- full phase-40 executable historical categories that phase-39 already makes
  impossible without a forbidden Trigger bypass;
- phase-40 postcheck failure injection;
- naturally occurring phase-41 precheck data failure;
- real Provider conditional write and exact-version discovery;
- Windows OS-level storage fencing and Junction/Reparse Point behavior;
- independent Web/Worker processes connected to PostgreSQL;
- E2E, Browser Runtime, production Build and Startup Gate;
- IAM/ACL and independent database runtime roles;
- production Migration and deployment;
- P2-05;
- R5 57 Open Decisions;
- BV7 remains FAIL;
- BV8 remains unapproved;
- historical R8 remains BLOCKED;
- Binding-parent-chain, orphan FileVersion and multiple-FileVersion terminal
  matrix remain outside this targeted correction.

The Local/Test database evidence is not a real object-storage Provider proof.

## 17. Final live Git state

The dedicated PostgreSQL instance was stopped with `pg_ctl -m fast`.

```text
pg_ctl result:             server stopped
R20 postgres processes:    0
Port 55439 listeners:      0
Port 55439:                FREE
Databases/logs/evidence:   retained
```

Final Git state after adding this report:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      105
Untracked files:        108
```

The tracked modifications and all pre-existing untracked work remain in the
worktree. No cleanup was performed.

Stop-log evidence:

```text
D:\AI-Elevator-Advisor-CM1-R20\logs\r20c1-pg-stop.log
SHA-256 57DBED937CA33407E81885AD9AABDB3553BE12BCE19F3D857B65D7BE0F22FE36
Bytes 89
Lines 3
```

## 18. Report hash, bytes and lines

Final report SHA-256 (hash line canonicalized to 64 zero bytes):

```text
A33EF00E3603852890CD6686AAFCB8DC257C2FDBFD8DCB815D9C74FBF7562754
```

Byte count: `20537`

Line count: `466`
