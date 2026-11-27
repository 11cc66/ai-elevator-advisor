# WP-2A-CM1 R22 Targeted Evidence Completion

## 0. Final conclusion

```text
PASS WITH RESTRICTIONS — R21 TARGETED EVIDENCE GAPS CLOSED WITH EXPLICIT LIMITATIONS
```

All three R21 P2 evidence gaps and all three P3 evidence-quality gaps are
closed by new source, real isolated PostgreSQL execution and retained
evidence.

R22 approves CM1 Append Intent Relational Integrity for the next independent
review/admission stage. This does not approve production deployment, a real
Provider, Windows OS-level fencing, IAM/ACL, E2E or Router C-Full.

The main remaining restriction is explicit:

```text
phase-41 Migration postcheck itself remains narrower;
the independent R22 catalog integration test supplies the additional
Trigger function OID, exact event mask, update-column and origin-enabled
verification.
```

## 1. Baseline and historical evidence preservation

Verified report hashes:

```text
R20:
2595BCE8CC95942D006C91F71104F83831E07B2A916A4F1CE07E888537892A18

R20-C1:
8581443861EE3617B2A6DD5A39E3BDC808F007DE9E178DC93B51D7C90EF51B84

R21:
3FFC8A6D0CDA2C43C2667C04D79FEE58C861CE14B08D64F9B4B0080CF50FB5EE
```

The hashes are unchanged from their authorized versions.

Initial Git state:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      106
Untracked files:        109
```

No R20/R20-C1 database, report, log or evidence was removed or modified.
Port 55439 remained unused for R22.

## 2. R21 finding disposition

| Finding | R22 disposition | Evidence |
|---|---|---|
| R21-P2-01 current-pointer/reservation real competition | `RESOLVED` | Two true two-session test orders with observed lock waits and final state |
| R21-P2-02 V4/V5 database identity | `RESOLVED` | Same Prisma connection asserts database, role, host and port before mutation |
| R21-P2-03 complete Trigger catalog identity | `RESOLVED WITH RESTRICTION` | Independent catalog test plus six fault injections; phase-41 Migration remains narrower |
| R21-P3-01 test count classification | `RESOLVED` | 23 database-backed / 2 static-only / 25 total |
| R21-P3-02 Migration checksum evidence | `RESOLVED` | All 19 DB checksums equal SQL-file SHA-256 |
| R21-P3-03 stale identity evidence | `RESOLVED` | New valid R22 identity record; old R20 file is not used |

## 3. R22 isolated PostgreSQL environment

```text
Root:             D:\AI-Elevator-Advisor-CM1-R22
Data directory:   D:\AI-Elevator-Advisor-CM1-R22\pgdata
Evidence:         D:\AI-Elevator-Advisor-CM1-R22\evidence
Logs:             D:\AI-Elevator-Advisor-CM1-R22\logs
Bind address:     127.0.0.1
Port:             55440
PostgreSQL:       18.7
Admin role:       cm1_r22_admin
Migration role:   cm1_r22_migrator
App test role:    cm1_r22_app
```

Roles:

```text
cm1_r22_migrator:
  LOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE

cm1_r22_app:
  LOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE
```

The app role received only schema usage, table DML/TRUNCATE and sequence
privileges required by the isolated tests. Its attempted `CREATE TABLE`
failed with:

```text
permission denied for schema public
SQLSTATE 42501
```

Databases:

```text
cm1_r22_migration
cm1_r22_v4v7
cm1_r22_catalog_fault
```

Valid identity evidence:

```text
D:\AI-Elevator-Advisor-CM1-R22\evidence\server-identity.log
D:\AI-Elevator-Advisor-CM1-R22\evidence\roles.log
D:\AI-Elevator-Advisor-CM1-R22\evidence\app-role-ddl-denial.log
```

The stale R20 `server-identity.log` is neither cited nor used as R22 proof.

## 4. R21-P2-01: real current-pointer versus reservation competition

### 4.1 Invariant and lock order

Actual source behavior:

- Append reservation updates Intent `PENDING -> UPLOADING`.
- `p13_append_reservation_snapshot_guard` locks the target File row
  `FOR UPDATE` and compares File current with expected-current.
- Append completion locks the target File row before creating/publishing its
  version and updating the current pointer.
- `one_active_append_intent_per_file` prevents two UPLOADING Append Intents for
  the same File.
- Deferred completion/latest guards validate the final File, Intent,
  FileVersion and current-pointer state at commit.

### 4.2 Scenario A — current advancement obtains the first chance

Actual order:

1. Base File current is version `v1`.
2. PENDING Append A expects `v1`.
3. Session A creates a complete candidate Append chain in its transaction,
   including a new FileVersion, but holds the File row before changing current.
4. Session B starts reservation of PENDING Append A.
5. B was observed with:

```text
wait_event_type = Lock
wait_event = transactionid
operation = UPDATE file_upload_intent ... status = UPLOADING
```

6. PostgreSQL also logged B waiting for and then acquiring a ShareLock.
7. A committed File current `v1 -> v2`, completed its Intent and published
   its FileVersion.
8. B resumed and failed at the reservation snapshot check.

Result:

```text
winner: Session A
loser: Session B
PostgreSQL SQLSTATE: 23514
first control: p13_assert_append_reservation_snapshot()
message: append reservation expected-current is stale or missing
Prisma: PrismaClientUnknownRequestError with exact message
```

Final database state:

- File.currentVersionId = A's new FileVersion;
- A Intent = COMPLETED;
- A FileVersion exists;
- A canonical Lifecycle = ACTIVE;
- A FINALIZE Operation = APPLIED;
- B Intent remains PENDING;
- no B Attempt remains;
- no UPLOADING Append Intent remains for the File.

Test:

```text
competes current advancement before reservation against a live Append
```

### 4.3 Scenario B — reservation obtains the first chance

The active-slot/File-lock invariant prevents the later pointer write from
being reached:

1. Base File current is `v1`.
2. Session B reserves Its PENDING Append and enters UPLOADING while holding
   its transaction open.
3. Session A starts the real Append completion chain and attempts to create
   its candidate Append.
4. A was observed waiting on the File transaction lock during
   `INSERT file_upload_intent`.
5. PostgreSQL logged A waiting for and acquiring the ShareLock.
6. B committed its reservation.
7. A resumed, attempted candidate `PENDING -> UPLOADING`, and was rejected by
   the active-slot unique index before any current-pointer write.

Result:

```text
winner: Session B reservation
loser: Session A completion chain
PostgreSQL SQLSTATE: 23505
constraint: one_active_append_intent_per_file
Prisma: P2002
target: existingFileId
current pointer write reached: NO — correctly blocked earlier
```

Final database state:

- File.currentVersionId remains the base FileVersion;
- B Intent = UPLOADING;
- B Attempt = WRITING;
- B staging Lifecycle = STAGING;
- exactly one active Append Intent exists;
- A candidate FileVersion and lifecycle rows rolled back completely.

This is the actual safe order for the current state machine. R22 does not
pretend that a pointer write occurred after the earlier active-slot/File lock
had already rejected the competing transaction.

### 4.4 Concurrency evidence

The final test log records:

- two distinct backend PIDs for each scenario;
- both clients connected as `cm1_r22_app` to `cm1_r22_v4v7`;
- `pg_stat_activity` Lock observations;
- A/B completion order;
- final cross-table assertions.

PostgreSQL evidence:

```text
D:\AI-Elevator-Advisor-CM1-R22\evidence\current-pointer-wins-postgres.log
D:\AI-Elevator-Advisor-CM1-R22\evidence\reservation-wins-postgres.log
```

The PostgreSQL log confirms:

- Process 4324 waited for and acquired a transaction ShareLock, then failed
  reservation with `23514`;
- Process 22620 waited for and acquired a transaction ShareLock, then failed
  candidate reservation with `23505` on
  `one_active_append_intent_per_file`.

## 5. R21-P2-02: test-owned database identity

The phase-40 test now queries identity through the same `PrismaClient` used
for all mutations, before the first mutation:

```text
current_database()
current_user
host(inet_server_addr())
inet_server_port()
current_setting('port')
```

Expected and actual:

```json
{
  "expected": {
    "database": "cm1_r22_v4v7",
    "role": "cm1_r22_app",
    "host": "127.0.0.1",
    "port": 55440
  },
  "actual": {
    "database": "cm1_r22_v4v7",
    "role": "cm1_r22_app",
    "host": "127.0.0.1",
    "port": 55440,
    "configuredPort": "55440"
  }
}
```

The same identity assertion is independently run by the phase-41 catalog
test.

### 5.1 Fail-closed proof

The first execution returned:

```text
POSTGRES_IDENTITY_MISMATCH
25 tests skipped before mutation
exit code 1
```

The initial mismatch was caused by PostgreSQL returning
`inet_server_addr()::text = 127.0.0.1/32`; the guard correctly stopped the
suite before any test mutation. The helper was then normalized to
`host(inet_server_addr()) = 127.0.0.1`.

Evidence:

```text
D:\AI-Elevator-Advisor-CM1-R22\logs\v4v7-integration-test.log
D:\AI-Elevator-Advisor-CM1-R22\logs\v4v7-integration-test-retry1.log
D:\AI-Elevator-Advisor-CM1-R22\logs\v4v7-integration-test-final3.log
```

## 6. R21-P2-03: phase-41 Trigger catalog identity

The independent catalog query joins:

```text
pg_trigger
pg_proc
pg_class
pg_namespace
pg_attribute
```

Actual verified objects:

| Item | Completion guard | Scope guard |
|---|---|---|
| Trigger | `p13_completed_intent_final_guard` | `p13_file_provenance_scope_immutable` |
| Schema | `public` | `public` |
| Relation | `file_upload_intent` | `file` |
| Function | `p13_assert_completed_intent_final` | `p13_protect_file_provenance_scope` |
| Function OID | `20157` | `20160` |
| `tgfoid` | `20157` | `20160` |
| `tgtype` | `17` | `19` |
| Event decode | AFTER UPDATE, ROW | BEFORE UPDATE, ROW |
| `tgenabled` | `O` | `O` |
| Deferrable | true | false |
| Initially deferred | true | false |
| Constraint Trigger | true | false |
| UPDATE OF columns | none | six immutable File columns |

Scope UPDATE columns are exactly:

```text
customerId
projectId
buildingId
installationUnitId
createdById
createdByUploadIntentId
```

The legacy completion Trigger is absent.

### 6.1 Fault injection

All injection transactions were rolled back and baseline revalidated:

| Fault | Detected finding |
|---|---|
| Same Trigger name points to wrong function | `TRIGGER_FUNCTION_MISMATCH` |
| Wrong function OID | `TRIGGER_FUNCTION_OID_MISMATCH` |
| UPDATE column set reduced to `customerId` | `TRIGGER_UPDATE_COLUMNS_MISMATCH` |
| Trigger enabled replica-only | `TRIGGER_ENABLED_MISMATCH`, expected O actual R |
| Trigger moved to `project` | `TRIGGER_RELATION_MISMATCH` |
| Completion guard recreated non-deferrable | `TRIGGER_DEFERRABLE_MISMATCH` |

Evidence:

```text
D:\AI-Elevator-Advisor-CM1-R22\logs\phase41-catalog-faults-final.log
```

No production or regular R22 test Trigger was disabled.

### 6.2 Explicit limitation

The phase-41 Migration postcheck itself still checks Trigger names, expected
relations, non-disabled state, completion deferrability and legacy absence.
It does not itself join `tgfoid` or require exact event bits. The additional
verification is supplied by the R22 catalog integration test and is not
claimed to be inside the Migration SQL.

## 7. Fresh Migration and checksum evidence

The R22 Migration harness copies the project Schema and all 19 Migration files
without modification. Every copy hash matches its repository source.

Full chain in each R22 database:

```text
cm1_r22_migration:      19/19 applied, status up to date
cm1_r22_v4v7:           19/19 applied, status up to date
cm1_r22_catalog_fault:  19/19 applied, status up to date
```

Prisma checksum algorithm was verified empirically, not assumed:

```text
Prisma _prisma_migrations.checksum
= lowercase SHA-256 of exact migration.sql bytes
```

All 19 rows are finished and all checksums match:

| Migration | DB checksum = file SHA-256 |
|---|---|
| phase1 baseline | `e3a4c89c079c5f6cf26b88db8e22288ca91850e572cd71d60654892573571cef` |
| phase2 auth/rbac/projects | `bcef26a19e343092f0e23228b2e3b72e0bee02212c6e186f2bbb076371492e0e` |
| phase31 file model | `7567ec1203954fa668dcc593b4538c056fc4df15813755b5e0463c4374939d76` |
| phase32 upload intents | `8c45264210fef86e9fc5c1b4036915e17617231f302ddcc9017e3e3656c7fffb` |
| phase32 recovery key | `f693d9a8b6a444d9ad491669cac46c937c25c48677694242faca16afc7ad8d0f` |
| phase34 processing metadata | `6ec8d519a1409cd860849e52173f9f3dd12aaaccdc72e3b943099f09176374a8` |
| phase34 extraction guard | `f8d6e64b3345d3866d7618eb468df0c9dc91a5d027590d10db72df51754f39ac` |
| phase35 reliability | `a64bec8e949de2b0174613e1c17dacfdb40cf059e3c58946da3770467ce2ea77` |
| phase37 review invariants | `c036868db930a4a371386a0c73bee80ec232c1b2c89a8a2efefab1ed7b5383ff` |
| phase37 validate review | `e75c3a97dc9281a615406523e5f173122392c11babd50724dd69d5756b03f1f9` |
| phase37 P1-3 schema | `187d82a00db73cb6f5d79c97dcd6b4ff2e01bd7e5f78bb9e1273d54d8a141479` |
| phase37 lifecycle insert | `ca1e3b737f1cc44b3fc40911634cdbc18a41b239073bb56d53f0432b11d6bfdb` |
| phase37 initial state | `3ac99e01d98d4c125bed5f3ac1ce2769b0b780e45f0e51b4feecc2fb408abb2c` |
| full MVP domain | `29942a06cf35a61557c958397237db78eeccfb4eea52062b70455cb8e1c737e3` |
| phase38 object binding | `bce7a6a26e6d9ccabcf1474866ce543db935c5cd2406d22d138224f8ff16fe60` |
| phase38 recovery hardening | `6b195258cab5df4d2d22b33792e5b253a9e7f27fe382babd231093ba1f1d4955` |
| phase39 append integrity | `4ea8be1687626843e1961ebfc64708db994012304c2cfc30f3b408d30c5fb826` |
| phase40 finalization | `6c6d857b735f7ca130c319ecbdabb2e1be5d123023b101425d7eaae9897afac6` |
| phase41 scope precheck | `42170616e40bb8db4f9e1970525cb167c0b7cce7465460996ab2552ea4a746fe` |

Evidence:

```text
D:\AI-Elevator-Advisor-CM1-R22\logs\migration-deploy.log
D:\AI-Elevator-Advisor-CM1-R22\logs\migration-cm1_r22_v4v7.log
D:\AI-Elevator-Advisor-CM1-R22\logs\migration-cm1_r22_catalog_fault.log
D:\AI-Elevator-Advisor-CM1-R22\logs\migration-checksums.log
D:\AI-Elevator-Advisor-CM1-R22\evidence\migration-harness-hashes.json
```

## 8. Test accounting

```text
Database-backed tests:  23
Static-only assertions:  2
Total Vitest cases:      25
```

Original R20-C1 cases:

```text
19 database-backed
2 static-only
21 total
```

New R22 database-backed cases:

```text
current advancement before reservation
reservation before current advancement
database identity Fail-Closed
full phase-41 Trigger catalog identity
```

The final R22 log is:

```text
Test Files 2 passed
Tests      25 passed
Exit code  0
```

Evidence:

```text
D:\AI-Elevator-Advisor-CM1-R22\logs\v4v7-integration-test-final3.log
D:\AI-Elevator-Advisor-CM1-R22\evidence\test-counts.json
```

## 9. Source changes

New files:

```text
apps/web/tests/helpers/postgres-identity.ts
apps/web/tests/helpers/phase41-trigger-catalog.ts
apps/web/tests/integration/phase41-trigger-catalog.test.ts
apps/web/scripts/cm1-r22/verify-migration-checksums.ts
apps/web/scripts/cm1-r22/phase41-catalog-faults.ts
apps/web/vitest.r22.config.ts
```

Modified existing untracked implementation/test files:

```text
apps/web/tests/integration/phase40-append-intent-finalization.test.ts
apps/web/tests/helpers/p13-file-version.ts
apps/web/tests/phase40-append-intent-finalization.test.ts
```

No Prisma Schema, production Migration, application business service,
Provider, IAM/ACL or deployment source was modified.

Current source hashes:

```text
phase40 Migration: 6C6D857B735F7CA130C319ECBDABB2E1BE5D123023B101425D7EAAE9897AFAC6
phase41 Migration: 42170616E40BB8DB4F9E1970525CB167C0B7CCE7465460996AB2552EA4A746FE
```

## 10. Regression verification

| Command | Result |
|---|---|
| Prisma validate on R22 harness | PASS |
| Prisma generate on isolated R22 harness | PASS |
| `pnpm typecheck` | PASS, all 8 applicable projects |
| Web tests | PASS, 38 files / 371 tests |
| Worker tests | PASS, 8 files / 33 tests |
| file-storage tests | PASS, 6 files / 51 tests |
| contracts tests | PASS, 4 files / 15 tests |
| selection-engine tests | PASS, 2 files / 9 tests |
| R22 PostgreSQL tests | PASS, 2 files / 25 tests |
| catalog fault injection | PASS, 5 fault families / 6 findings |
| `git diff --check` | PASS |

The first Web test run was blocked because non-sensitive static environment
inputs were absent. It was rerun with command-local test-only values and
passed 371/371. No repository `.env` or `.env.test` was read for database
configuration.

No Build, E2E, Provider, real IAM/ACL, Windows fencing or deployment test was
executed.

## 11. Limitations and not verified

- phase-41 Migration SQL itself remains narrower than the independent
  catalog validator;
- Provider conditional write and exact discovery remain unverified;
- Windows Junction/Reparse Point and OS-level storage fencing remain
  unverified;
- IAM/ACL production roles remain unverified;
- real Web/Worker processes connected to PostgreSQL remain unverified;
- E2E, Browser Runtime, Build and Startup Gate remain unverified;
- production Migration and deployment remain unverified;
- P2-05 remains open;
- R5 57 Open Decisions remain open;
- BV7 remains FAIL;
- BV8 remains unapproved;
- historical R8 remains BLOCKED;
- Binding-parent-chain, orphan FileVersion and multiple-FileVersion terminal
  matrix remain outside this targeted round.

## 12. Final instance state

The R22 postmaster was stopped with:

```text
pg_ctl -D D:\AI-Elevator-Advisor-CM1-R22\pgdata stop -m fast
```

Verified:

```text
R22 PostgreSQL processes: 0
Port 55440:                FREE
Port 55439:                FREE
R20/R20-C1 data/evidence:  retained
R22 data/logs/evidence:    retained
```

## 13. Evidence hashes

```text
58A351835C484577AA4027ABBD22FF50B8B1AA6BF68CAF9E334EBD6CEF259EC4
  logs\migration-deploy.log

FAB14757CDCA813B6A0508F7108D1DAA65E0A4EF95763DA051E8A48378BCF752
  logs\migration-checksums.log

5A3D941113B43AB72C234EFEF45F660EBBF8E35688297A41B75C4BA310BC0323
  logs\v4v7-integration-test-final3.log

B6929330C9CE6E32F718586BAFC12D15FDD80ACAD920B1745631FB07ECB37B4F
  logs\phase41-catalog-faults-final.log

B64B5F4D0DBE02964A98E27F141EA9817B7A83630FF320515BD1FD92E546C669
  evidence\current-pointer-wins-postgres.log

D563458186EB572F90C4B56D6B17587C4641E0A054F2DC488A2AE8CD8E835932
  evidence\reservation-wins-postgres.log

4ADFF4CBD9756587DD7E9774BF8F150517E61E62397B09870E416C164181A943
  logs\web-tests-retry.log

DC0B71B51008B7E26C53CD9FA1A58C49EC2BE53C643BFEEE6C662344AACA2A42
  logs\typecheck.log

90E96C7D591ECA26A585D0CE93CFFDB9DFBAE37648CAFDE97B559093B0A8C1D8
  evidence\server-identity.log
```

All relative evidence paths above are under:

```text
D:\AI-Elevator-Advisor-CM1-R22\
```

## 14. Git state

Git state after all source and test modifications, before adding this report:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      109
Untracked files:        115
```

After adding this report, the final live state is recorded in section 16.

No commit, push, reset, restore, clean, checkout, stash or `git add` was used.

## 15. R22 admission decision

```text
R21-P2-01:  CLOSED
R21-P2-02:  CLOSED
R21-P2-03:  CLOSED WITH EXPLICIT PHASE-41-MIGRATION LIMITATION
R21-P3-01:  CLOSED
R21-P3-02:  CLOSED
R21-P3-03:  CLOSED
```

CM1 Append Intent Relational Integrity satisfies the targeted source and
isolated PostgreSQL evidence conditions for the next independent review.

## 16. Final Git state

After adding this report:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      110
Untracked files:        116
```

## 17. Report hash, bytes and lines

Final report SHA-256 (hash line canonicalized to 64 zero bytes):

```text
7B7EE46E65DCDBE5CEFDC9DFCE4DB11FA6FFD64CA713BF41D86511793EA3A588
```

Byte count: `20246`

Line count: `513`
