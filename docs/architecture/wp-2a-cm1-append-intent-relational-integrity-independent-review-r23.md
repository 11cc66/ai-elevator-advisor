# WP-2A-CM1 Append Intent Relational Integrity Independent Review R23

## 0. Final conclusion

```text
PARTIAL — ADDITIONAL EVIDENCE REQUIRED
```

R22 proves the repaired 19-Migration chain, the two real two-session races,
test-owned database identity, baseline Trigger identity and Migration
checksums. No new database invariant defect or production-source defect was
found.

The R21 P2-03 fault matrix is not fully closed. R22 reports six fault
injections, but the executable script contains five `runFault` calls. The
wrong-function mutation produces both a function-name mismatch and an OID
mismatch, but the test only requires the function-name finding. It would still
pass if the OID assertion were removed. There is also no negative injection
that requires `TRIGGER_TYPE_MISMATCH` or `TRIGGER_EVENT_MASK_MISMATCH`; the
event-related fault reduces `UPDATE OF` columns, not `tgtype` bits.

CM1 Append Intent Relational Integrity is therefore not yet ready for the next
admission decision. Additional fault-specific evidence is required for
R21-P2-03.

## 1. Review independence and Git baseline

This review is read-only and was performed in the same local workspace and
machine as R22. No PostgreSQL process was started or connected, and no SQL,
Migration, test or fault injection was executed.

Independence limitation:

```text
Same repository/worktree/host as R22
Different review pass
No independent operator or separate execution host
```

The conclusions below are based on retained raw logs, evidence files, actual
source and independently recomputed hashes.

Initial Git state:

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

No PostgreSQL listener was present on port 55440, and no R22 postmaster was
found. The retained stop log reports a graceful shutdown.

## 2. R22 report integrity

Physical report hash:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-r22-targeted-evidence-completion.md
SHA-256 5F89BAE48B9BF352A7825380FBD0AEEF213E630B38B1CFD1B5A2F0FCF0364AEE
20,246 bytes
513 lines
```

This matches the R22-declared hash.

The report's self-excluding canonical hash also verifies:

```text
7B7EE46E65DCDBE5CEFDC9DFCE4DB11FA6FFD64CA713BF41D86511793EA3A588
```

Historical reports remain unchanged:

```text
R20:    2595BCE8CC95942D006C91F71104F83831E07B2A916A4F1CE07E888537892A18
R20-C1: 8581443861EE3617B2A6DD5A39E3BDC808F007DE9E178DC93B51D7C90EF51B84
R21:    3FFC8A6D0CDA2C43C2667C04D79FEE58C861CE14B08D64F9B4B0080CF50FB5EE
```

## 3. A — current-pointer versus reservation competition

### 3.1 Source-level timing

The new tests are in:

```text
apps/web/tests/integration/phase40-append-intent-finalization.test.ts:692-933
```

The fixture hook support is in:

```text
apps/web/tests/helpers/p13-file-version.ts
```

The reservation helper is in:

```text
apps/web/tests/integration/phase40-append-intent-finalization.test.ts:1138-1215
```

Three distinct clients are used per scenario for A, B and lock observation.
`pg_backend_pid()` is captured inside each competing transaction.

### 3.2 Scenario A — current advancement first

Evidence chain:

1. PENDING Intent remains valid against base current before competition.
2. Session A builds the candidate Append chain and acquires `file ... FOR
   UPDATE` before changing current.
3. Session B starts reservation while that File transaction remains open.
4. The test observes B in `pg_stat_activity` with:

```text
wait_event_type = Lock
wait_event = transactionid
query = UPDATE file_upload_intent ... status = UPLOADING
```

5. The PostgreSQL log for B backend `4324` records:

```text
process 4324 still waiting for ShareLock on transaction 1306
process 4324 acquired ShareLock on transaction 1306
ERROR 23514: append reservation expected-current is stale or missing
CONTEXT: p13_assert_append_reservation_snapshot() line 30
```

6. Final assertions verify:

   - A FileVersion becomes File.currentVersionId;
   - A Intent is COMPLETED;
   - candidate canonical Lifecycle is ACTIVE;
   - candidate FINALIZE Operation is APPLIED;
   - B Intent remains PENDING;
   - B Attempt count is zero;
   - no UPLOADING Append remains for the File.

Evidence:

```text
D:\AI-Elevator-Advisor-CM1-R22\logs\v4v7-integration-test-final3.log
D:\AI-Elevator-Advisor-CM1-R22\evidence\current-pointer-wins-postgres.log
```

Verdict: `PASS`.

### 3.3 Scenario B — reservation first

This is a real overlapping transaction order, although the active-slot/File
lock prevents the later current-pointer write from being reached.

Evidence chain:

1. Session B reserves the PENDING Intent into UPLOADING and holds the
   transaction at `afterUploading`.
2. Session A starts the real candidate Append chain.
3. A is observed waiting on the File transaction lock during:

```text
INSERT INTO file_upload_intent
```

4. PostgreSQL log for A backend `22620` records:

```text
process 22620 still waiting for ShareLock on transaction 1310
process 22620 acquired ShareLock on transaction 1310
ERROR 23505: duplicate key violates one_active_append_intent_per_file
```

5. The test asserts Prisma `P2002`, target `existingFileId`, current remains
   the base version, B Intent is UPLOADING, B Attempt is WRITING, only one
   FileVersion remains, and exactly one active Append exists.

The report correctly discloses that A never reaches the current-pointer write
because the active-slot/File lock blocks the operation earlier.

Evidence:

```text
D:\AI-Elevator-Advisor-CM1-R22\logs\v4v7-integration-test-final3.log
D:\AI-Elevator-Advisor-CM1-R22\evidence\reservation-wins-postgres.log
```

Verdict: `PASS` for the actual state-machine order.

### 3.4 Residual test coverage limitation

Scenario B asserts rollback of the candidate FileVersion by counting File
versions, but it does not explicitly query the candidate Lifecycle,
Operation, Attempt or staging object after rollback. This is low risk because
the P2002 aborts the entire PostgreSQL transaction, but it is an evidence
completeness limitation.

R21-P2-01 status: `CLOSED`.

## 4. B — test-owned database identity

The phase-40 test queries actual connection identity before `beforeAll` loads
the admin fixture:

```text
apps/web/tests/integration/phase40-append-intent-finalization.test.ts:239-257
```

The query is performed through the same module-level `PrismaClient` later used
by the tests:

```text
apps/web/tests/helpers/postgres-identity.ts:38-67
```

Verified fields:

```text
current_database()
current_user
host(inet_server_addr())
inet_server_port()
current_setting('port')
```

Final expected/actual values:

```text
cm1_r22_v4v7
cm1_r22_app
127.0.0.1
55440
55440
```

The catalog test independently performs the same check before its query.

### 4.1 Fail-closed evidence

The first run failed at identity assertion:

```text
POSTGRES_IDENTITY_MISMATCH
25 tests skipped
exit code 1
```

The host normalization issue (`127.0.0.1/32` vs `127.0.0.1`) caused the
failure. Because suite setup failed, none of the 25 tests ran and no test
mutation occurred.

Evidence:

```text
D:\AI-Elevator-Advisor-CM1-R22\logs\v4v7-integration-test.log
D:\AI-Elevator-Advisor-CM1-R22\logs\v4v7-integration-test-retry1.log
```

### 4.2 Separate test clients

The global identity check covers the global client. The race and observer
clients are separate `PrismaClient` instances. Their backend PID, user and
database are independently present in the PostgreSQL log:

```text
user=cm1_r22_app database=cm1_r22_v4v7
```

No later connection recreation or datasource switching exists in the test.

R21-P2-02 status: `CLOSED`.

## 5. C — phase-41 Trigger catalog

### 5.1 Baseline catalog result

The independent test joins `pg_trigger`, `pg_proc`, `pg_class`,
`pg_namespace` and `pg_attribute`.

Verified baseline:

| Property | Completion guard | Scope guard |
|---|---|---|
| Trigger | `p13_completed_intent_final_guard` | `p13_file_provenance_scope_immutable` |
| Relation | `public.file_upload_intent` | `public.file` |
| Function | `public.p13_assert_completed_intent_final` | `public.p13_protect_file_provenance_scope` |
| Function OID | 20157 | 20160 |
| `tgfoid` | 20157 | 20160 |
| `tgtype` | 17 | 19 |
| Mode | AFTER UPDATE ROW | BEFORE UPDATE ROW |
| `tgenabled` | O | O |
| Deferrable / initially deferred | true / true | false / false |
| Constraint Trigger | true | false |
| UPDATE OF columns | none | exact six fields |

The six scope columns match the Migration definition in order.

The legacy `p13_completed_append_current_guard` is absent.

Evidence:

```text
D:\AI-Elevator-Advisor-CM1-R22\logs\v4v7-integration-test-final3.log
apps/web/tests/helpers/phase41-trigger-catalog.ts:108-274
```

### 5.2 Fault-injection audit

Executable `runFault` cases in
`apps/web/scripts/cm1-r22/phase41-catalog-faults.ts`:

```text
wrong_function
reduced_update_columns
replica_only_enabled
wrong_relation
completion_not_deferrable
```

That is five executable fault cases.

The retained log contains six finding classes:

```text
TRIGGER_FUNCTION_MISMATCH
TRIGGER_FUNCTION_OID_MISMATCH
TRIGGER_UPDATE_COLUMNS_MISMATCH
TRIGGER_ENABLED_MISMATCH
TRIGGER_RELATION_MISMATCH
TRIGGER_DEFERRABLE_MISMATCH
```

The wrong-function mutation produces both name and OID mismatch findings.
However, `runFault` requires only:

```text
expectedCode = TRIGGER_FUNCTION_MISMATCH
```

It does not independently require
`TRIGGER_FUNCTION_OID_MISMATCH`. The test would still pass if the OID
comparison were removed and the name mismatch remained.

Likewise, `reduced_update_columns` requires only
`TRIGGER_UPDATE_COLUMNS_MISMATCH`. It does not produce or require
`TRIGGER_TYPE_MISMATCH` or `TRIGGER_EVENT_MASK_MISMATCH`.

### 5.3 Rollback and isolation

Each fault transaction throws a rollback marker after collecting findings.
The script then re-runs baseline validation before the next fault. This
correctly isolates the catalog-fault database. No Trigger was disabled by the
regular tests.

### 5.4 R21-P2-03 assessment

The current baseline catalog identity is independently verified. The fault
suite also demonstrates most negative cases.

But the required six-fault matrix is not fully enforced:

- wrong function name: enforced;
- wrong function OID: observed, but not independently required;
- event/type reduction: `UPDATE OF` column reduction is enforced, exact
  `tgtype` reduction is not;
- replica-only: enforced;
- wrong relation: enforced;
- non-deferrable completion: enforced.

R21-P2-03 status: `PARTIALLY CLOSED`.

The R22 explicit limitation that phase-41 Migration itself remains narrower is
accurate. The independent test can supplement current validation, but the
fault-specific assertion gap must be closed before the test can claim the
complete negative matrix.

## 6. D — Migration checksum

### 6.1 Migration file identity

Independent count and hash comparison:

```text
Repository migration directories: 19
R22 harness migration directories: 19
Directory-name order: identical
All 19 migration.sql hashes: identical
```

The phase-40 and phase-41 reconstruction remains the R20-C1 approved source:

```text
phase40: 6C6D857B735F7CA130C319ECBDABB2E1BE5D123023B101425D7EAAE9897AFAC6
phase41: 42170616E40BB8DB4F9E1970525CB167C0B7CCE7465460996AB2552EA4A746FE
```

### 6.2 Prisma metadata

`migration-checksums.log` contains exactly 19 records, all finished, with no
missing migration names. Every database checksum equals the SHA-256 of the
exact `migration.sql` bytes.

This empirically confirms the algorithm mapping used by the R22 script:

```text
_prisma_migrations.checksum
= lowercase SHA-256 of exact migration file bytes
```

Evidence:

```text
D:\AI-Elevator-Advisor-CM1-R22\logs\migration-checksums.log
D:\AI-Elevator-Advisor-CM1-R22\evidence\migration-harness-hashes.json
```

R21-P3-02 status: `CLOSED`.

One minor limitation remains in the script itself: its `missing` calculation
derives from `byName`, which is created from the same rows used to build
`results`. It therefore cannot detect a Migration file absent from the
database by itself. R23 independently verified the directory count/name set,
so this did not affect the current conclusion.

## 7. E — Test counts and identity logs

Independent source count:

```text
phase40 integration cases: 24
phase41 catalog cases:      1
total Vitest cases:        25
static-only cases:          2
database-backed cases:     23
```

The two static-only cases are:

```text
records legacy-unverified Append target as a migration vector
records legacy-unverified current advance as a migration vector
```

Final execution log:

```text
2 files passed
25 tests passed
0 failed
0 skipped in the final run
```

The first identity-failure run skipped all 25 and was not counted as a final
PASS.

Accounted new database-backed cases:

```text
current advancement before reservation
reservation before current advancement
database identity Fail-Closed
full phase-41 Trigger catalog identity
```

Identity output comes from the executing test connections, not a separate seed
process. The separate seed log is corroborating evidence only.

R21-P3-01 status: `CLOSED`.

## 8. F — Migration and stage boundary

All three R22 databases report the full chain and up-to-date state:

```text
cm1_r22_migration:      19/19
cm1_r22_v4v7:           19/19
cm1_r22_catalog_fault:  19/19
```

The original R20 `42703` remains repaired:

```text
ranked.record_kind
FROM classified
```

Phase-40 historical precheck still precedes its first Trigger/function DDL.
The prior R20-C1 fail-before-DDL evidence remains intact and the current
phase-40 file hash is unchanged.

Phase-41 postcheck remains intentionally narrow:

```text
name + relation + tgenabled <> 'D'
completion deferrable/initially deferred
legacy Trigger absence
```

It does not perform function OID, exact event type or UPDATE column checks.
The independent catalog test supplies those checks. This is an explicit
restriction, not a claim that the Migration contains the stronger checks.

No new Migration or business-service source was introduced by R22.

## 9. Findings

### R23-P2-01 — phase-41 fault-specific assertions are incomplete

Severity: `P2`

Location:

```text
apps/web/scripts/cm1-r22/phase41-catalog-faults.ts:103-191
```

Problem:

- only five executable fault mutations exist;
- wrong-function mutation does not independently require the OID finding;
- no negative mutation requires exact `tgtype` or event-mask mismatch.

Impact:

The baseline catalog check works, but the claimed complete negative matrix is
not self-enforcing. Removing the OID/type assertions could leave the fault
script green.

Minimal correction:

- add a wrong-function fault with required
  `TRIGGER_FUNCTION_OID_MISMATCH`;
- add a same-trigger mutation with an incorrect event type/mask and require
  `TRIGGER_TYPE_MISMATCH` or `TRIGGER_EVENT_MASK_MISMATCH`;
- retain rollback and baseline revalidation after each case.

### R23-P3-01 — R22 fault count wording is inconsistent

Severity: `P3`

Locations:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-r22-targeted-evidence-completion.md:65
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-r22-targeted-evidence-completion.md:524
```

The report says “six fault injections” in one place and “5 fault families /
6 findings” later. The executable evidence supports the latter wording.

### R23-P3-02 — Scenario B rollback assertions omit candidate lifecycle tables

Severity: `P3`

Scenario B explicitly counts FileVersion rows and active Intents, but it does
not directly query the candidate Lifecycle, Operation, Attempt and staging
rows after rollback. PostgreSQL transaction rollback makes the result highly
likely, but direct assertions would make the final-state evidence complete.

### R23-P3-03 — checksum script missing-file calculation is weak

Severity: `P3`

The script's `missing` collection is derived from the same DB rows as
`results`. It cannot independently detect a source Migration file that was
never recorded in the database. R23's independent directory/hash comparison
closes this particular run, but the helper should compare DB names with the
actual directory set.

## 10. R21 issue disposition

| R21 issue | R23 status | Basis |
|---|---|---|
| R21-P2-01 true current-pointer/reservation competition | `CLOSED` | Two real lock-wait races with correct SQLSTATE and final state |
| R21-P2-02 test database identity Fail-Closed | `CLOSED` | Same test client actual identity plus pre-mutation fail-closed run |
| R21-P2-03 full Trigger catalog and fault matrix | `PARTIALLY CLOSED` | Baseline complete; OID/type fault assertions not independently enforced |
| R21-P3-01 test count | `CLOSED` | 23 database-backed / 2 static / 25 total |
| R21-P3-02 checksum | `CLOSED` | 19/19 DB checksums equal exact SQL SHA-256 |
| R21-P3-03 stale identity evidence | `CLOSED` | New valid identity record and test-owned identity |

## 11. CM1 admission impact

The current CM1 relational-integrity implementation remains eligible for a
future admission decision after the P2 fault-specific evidence gap is closed.

This review does not approve final CM1 admission yet because R21-P2-03 remains
partially closed.

The explicit phase-41 Migration limitation is acceptable only if the stronger
independent catalog test remains mandatory and the missing negative assertions
are added.

## 12. Not verified

- real Provider operations;
- Windows OS-level storage fencing and Junction/Reparse Point behavior;
- production IAM/ACL;
- real Web/Worker process integration with PostgreSQL;
- E2E and Browser Runtime;
- Build and Startup Gate;
- production Migration and deployment;
- P2-05;
- R5 57 Open Decisions;
- BV7 remains FAIL;
- BV8 remains unapproved;
- historical R8 remains BLOCKED;
- Binding-parent-chain, orphan FileVersion and multiple-FileVersion terminal
  matrix remain outside this targeted round.

R23 did not restart R22 PostgreSQL and did not execute any new database test.

## 13. Git state

Git state immediately before adding this report:

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

Final state after this report is recorded in section 15.

## 14. Review conclusion

```text
PARTIAL — ADDITIONAL EVIDENCE REQUIRED
```

R22's database behavior, identity and checksum evidence is substantially
credible. The remaining gap is narrowly scoped to the phase-41 fault-specific
assertions and does not require a new database design.

## 15. Final Git state

After adding this report:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      111
Untracked files:        117
```

## 16. Report hash, bytes and lines

Final report SHA-256 (hash line canonicalized to 64 zero bytes):

```text
953927782AEDFD5741D10623C6EFC0EBB2607BF7C71DA9AA2EE7B6BD700B6D2A
```

Byte count: `19568`

Line count: `483`
