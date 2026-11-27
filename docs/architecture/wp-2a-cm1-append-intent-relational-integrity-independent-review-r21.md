# WP-2A-CM1 Append Intent Relational Integrity Independent Review R21

## 0. Final conclusion

```text
PARTIAL — ADDITIONAL EVIDENCE REQUIRED
```

R21 independently confirms that the R20 `42703` defect is correctly repaired
in both phase-40 and phase-41. A real Prisma Migration Runner applied the
repaired full chain as 19/19 in an isolated PostgreSQL database, and the
retained logs support that result.

R21 does **not** approve CM1 Append Intent Relational Integrity as a whole for
the next admission/production-preparation stage. The specific CTE correction
is approved for continuation, but the following required evidence remains
incomplete:

1. the two-session stale-current test does not create a real
   current-pointer-versus-reservation competition;
2. the V4/V5 test process does not assert or log its target database and role;
3. phase-41 catalog defense does not verify the Trigger function OID, exact
   event mask, or origin-enabled state.

No new P0 or P1 source defect was found in the `42703` correction.

## 1. Baseline and hash verification

Reviewed reports:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-r20-c1-correction-and-revalidation.md
SHA-256 8581443861EE3617B2A6DD5A39E3BDC808F007DE9E178DC93B51D7C90EF51B84

docs/architecture/wp-2a-cm1-append-intent-relational-integrity-isolated-postgresql-validation-r20.md
SHA-256 2595BCE8CC95942D006C91F71104F83831E07B2A916A4F1CE07E888537892A18
```

Both on-disk hashes match the authorized values. R20-C1 is 20,537 bytes and
466 lines.

Initial Git state for this review:

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

No PostgreSQL connection, SQL, Migration, test, Build, E2E or Git write was
performed for this review.

## 2. Phase-40 and phase-41 source review

### 2.1 Authoritative column name

The review request refers to `column_kind`. Neither repaired migration defines
or uses `column_kind`.

The authoritative column introduced by `classified` is:

```sql
record_kind
```

This matches the original R20 `42703` error and the downstream unique-record
expression. The request terminology is imprecise; the implementation uses the
correct existing field.

### 2.2 Verified CTE data flow

Phase-40:

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

Current source:

```sql
ranked AS (
  SELECT category, object_id, record_kind, ...
  FROM classified
)
```

The old R20 error log contains the broken form:

```sql
ranked AS (
  SELECT category, object_id, record_kind, ...
  FROM conflicts
)
```

The only relevant dependency change is `conflicts` -> `classified`. The
`classified` CTE still derives `record_kind` from the category groups:

- File records:
  `origin_scope_mismatch`, `versioned_file_null_current`,
  `file_current_not_max`, `file_current_unowned`;
- all other categories: intent records.

Phase-41 correctly uses the same corrected dependency and assigns `intent` as
its record kind for all phase-41 categories.

Source:

```text
prisma/migrations/20261126150000_phase40_append_intent_finalization_hardening/migration.sql:319-370
prisma/migrations/20261126160000_phase41_append_scope_precheck/migration.sql:98-133
```

### 2.3 Count and identity semantics

The correction preserves:

```sql
sum(row_count)
```

for category count, and:

```sql
count(DISTINCT record_kind || ':' || object_id)
```

for unique unsafe records. This keeps the intended distinction between:

- multiple categories on one object;
- same text ID belonging to different record kinds;
- legacy inventory categories excluded from unsafe admission;
- category-level sample IDs limited to 20.

The `UNION ALL` category list and the blocking condition
`v_unique_unsafe_count > 0` remain unchanged. No category was removed and no
NULL/cross-table predicate was relaxed.

### 2.4 DDL ordering

Phase-40 retains:

1. offline lock;
2. historical precheck;
3. function/Trigger replacement DDL;
4. postcheck.

Phase-41 contains no `CREATE`, `ALTER`, `DROP` or `TRUNCATE` statement. It
contains one precheck `DO` block and one catalog postcheck `DO` block.

The CTE correction did not weaken these orderings.

### 2.5 Source verdict

```text
R20 42703 root cause:        CONFIRMED
phase-40 repair:             CORRECT
phase-41 repair:             CORRECT
constraint/check weakening:  NONE FOUND
```

## 3. Migration evidence review

### 3.1 Full successful chain

`r20c1b-prisma-migrate-deploy.log` identifies:

```text
database: cm1_r20c1b_validation
role/datasource: cm1_r20_app through the logged Prisma datasource
endpoint: 127.0.0.1:55439
migrations found: 19
phase-40 applied: yes
phase-41 applied: yes
final result: all migrations successfully applied
```

`r20c1b-prisma-migrate-status.log` independently reports:

```text
Database schema is up to date!
```

`r20c1b-migrations.log` has 19 rows, each with non-NULL `finished_at` and
`applied_steps_count=1`.

This is sufficient to confirm the repaired phase-40 and phase-41 Migration
scripts execute successfully from an empty database through the real Prisma
Migration Runner.

### 3.2 SQL file identity

Current source hashes:

```text
phase-40:
6C6D857B735F7CA130C319ECBDABB2E1BE5D123023B101425D7EAAE9897AFAC6

phase-41:
42170616E40BB8DB4F9E1970525CB167C0B7CCE7465460996AB2552EA4A746FE
```

The phase-40 file was last modified before the successful 19/19 migration log,
and phase-41 was last modified before the fresh successful databases were
created. No later source mutation was found.

The retained `_prisma_migrations` table dump does not include the Prisma
checksum column. Current source identity is therefore supported by hashes,
timestamps and migration success logs, but not by a retained DB checksum
cross-check.

### 3.3 Unsafe historical precheck

Three isolated phase-39 baseline databases produced:

| Vector | Raw PostgreSQL result | Post-failure state |
|---|---|---|
| Building mismatch | `23514`, exact category | phase-40 unfinished; no phase-40 DDL |
| Installation-unit mismatch | `23514`, exact category | phase-40 unfinished; no phase-40 DDL |
| Combined mismatch | `23514`, exact category | phase-40 unfinished; no phase-40 DDL |

Every post-failure catalog shows:

```text
phase-40 completion function:  absent
phase-40 scope function:       absent
phase-40 completion Trigger:   absent
phase-39 old completion:       present
applied_steps_count:           0
finished_at:                   NULL
rolled_back_at:                NULL
```

The retry logs return `P3009`, so Prisma does not silently rerun or mark the
failed phase-40 Migration complete.

### 3.4 DDL failure

The app-owned schema permission experiment produced:

```text
SQLSTATE 42501
permission denied for schema public
P3018
```

This is correctly disclosed as a database ownership setup issue rather than a
source defect. It is valid evidence that a phase-40 DDL-stage failure leaves
an unfinished history row.

### 3.5 Phase-41 postcheck failure

R20-C1 constructed a phase-40-only database, removed the completion Trigger,
then ran the real phase-41 Migration. The result was:

```text
phase-41 SQLSTATE 23514
phase41 completion guard postcheck failed
phase-40 history row: finished
phase-41 history row: unfinished, applied_steps_count=0
```

The Trigger removal was an intentional fault injection in the isolated
database and is disclosed by the retained command output.

No naturally occurring phase-41 data-precheck failure and no phase-40
postcheck failure were tested.

## 4. Twenty-one test evidence matrix

The final Vitest log reports:

```text
Test Files 1 passed
Tests      21 passed
Exit code  0
```

The test file contains 21 `it()` cases. Nineteen execute database operations;
the final two inspect the in-memory history-vector fixture and do not touch
PostgreSQL.

| # | Test | Evidence classification | R21 result |
|---:|---|---|---|
| 1 | N/N pointer update before completion | PostgreSQL | PASS |
| 2 | N/N completion before pointer update | PostgreSQL | PASS |
| 3 | N/N under unrelated existing File | PostgreSQL | PASS |
| 4 | N/N under another Intent's File | PostgreSQL | PASS |
| 5 | N/N completed target without current advance | PostgreSQL, message assertion | PASS with SQLSTATE gap |
| 6 | Same-File target owned by another Intent | PostgreSQL | PASS |
| 7 | File provenance scope update | PostgreSQL | PASS |
| 8 | File creator and NULL scope transitions | PostgreSQL | PASS |
| 9 | Completed target deletion | PostgreSQL | PASS |
| 10 | COMPLETED -> UPLOADING first control | PostgreSQL | PASS |
| 11 | FileVersion identity and TRUNCATE | PostgreSQL | PASS |
| 12 | NULL completed target final guard | PostgreSQL | PASS |
| 13 | Different-File completed target | PostgreSQL | PASS |
| 14 | Two-client active-slot competition | PostgreSQL, barrier | PASS |
| 15 | Duplicate `(fileId, versionNumber)` insert | PostgreSQL | PASS |
| 16 | Sequential stale-current rejection | PostgreSQL, not concurrent | PASS for sequential only |
| 17 | Two-client stale-current exclusion | PostgreSQL, pre-staled | **PARTIAL** |
| 18 | Trigger event matrix | PostgreSQL catalog | PASS |
| 19 | Two-client stale ownership CAS | PostgreSQL, barrier | PASS |
| 20 | Legacy Append target vector | Static array assertion | PASS as static only |
| 21 | Legacy-unverified current-advance vector | Static array assertion | PASS as static only |

Therefore the correct classification is:

```text
19 PostgreSQL behavior tests
2 static vector assertions
21 total Vitest cases
```

Calling all 21 "PostgreSQL integration tests" overstates the evidence. The
functional pass count itself is supported by the final log.

Other evidence limitations:

- deferred Trigger errors wrapped by Prisma often contain no separate
  SQLSTATE field; tests correctly assert the exact first-control message;
- P2002 is a Prisma mapping, while the PostgreSQL server log separately proves
  the underlying `file_version_fileId_versionNumber_key` and
  `one_active_append_intent_per_file` unique violations;
- `r20c1-v4v7-integration-test-retry.log` retains the earlier 18 PASS / 3 FAIL
  run and confirms the final 21-pass result was not the first attempt.

## 5. Two-session concurrency review

### 5.1 Active-slot competition — PASS

Two independent `PrismaClient` instances each create a distinct staging chain,
then both wait at a shared barrier before updating separate PENDING Intents
targeting the same File.

Observed assertions:

```text
exactly one fulfilled transaction
loser: Prisma P2002
loser target: existingFileId
loser is not the 23514 stale-current path
```

The PostgreSQL server log independently records a unique violation on
`one_active_append_intent_per_file`. This is a real concurrent competition.

### 5.2 Stale execution ownership — PASS for CAS scope

Two independent clients use the same old owner token and fencing generation
against the same lifecycle row.

Observed:

```text
update counts = [0, 1]
final generation = old generation + 1
```

This is a real two-session single-winner CAS race.

It verifies database CAS behavior. It does not by itself prove that a stale
upload service executor cannot complete a full object-upload workflow.

### 5.3 Stale-current competition — PARTIAL

The test at:

```text
apps/web/tests/integration/phase40-append-intent-finalization.test.ts:551
```

does this in order:

1. create base current version;
2. create PENDING Intent based on base;
3. commit a next version and advance File.currentVersionId to it;
4. open client A and lock the already-stale File row with `FOR UPDATE`;
5. open client B and attempt reservation of the already-stale Intent;
6. release client A;
7. assert client B rejects.

Client A performs no current-version write in the concurrent phase. The
current pointer is already `next` before either concurrent operation starts.
Client B would reject even if client A did not run. The test is a genuine
two-session lock-wait/rejection test, but not the required
current-pointer-versus-reservation race.

Consequences:

- write-skew/TOCTOU between current advancement and reservation is not
  independently verified;
- the test name and R20-C1 summary are broader than the evidence;
- the sequential test at line 533 also does not replace the missing race.

Required directed evidence:

- start with a valid PENDING Append whose expected-current equals the current
  pointer;
- have one session atomically advance the File current pointer and finish its
  append chain;
- have the second session reserve the old PENDING Intent without first forcing
  the File stale;
- use a barrier or lock-wait observation so both sides actually enter the
  competition;
- cover both winner orders and assert final Intent/FileVersion/Lifecycle/
  Operation state plus the exact first rejection mechanism.

## 6. Test-database isolation evidence

The migration runs are strongly identified because each Prisma log prints the
target database and `127.0.0.1:55439`.

The V4/V5 test log itself does not print:

```text
current_database()
current_user
server port
```

The test opens a default `PrismaClient()`, and the custom Vitest config does
not inject a datasource. The separate seed log identifies
`cm1_r20c1_v4v7|cm1_r20_app`, but the later test process has no retained
test-level identity assertion or logged command environment.

Thus:

```text
seed target:                    cm1_r20c1_v4v7
integration test target:        INFERRED, NOT DIRECTLY ASSERTED
```

This is an evidence-chain gap, not proof that another database was used. A
test must assert its own database, role and port in `beforeAll` and emit those
values in the test log.

## 7. Fixture safety review

### 7.1 No production control disablement

Read-only source search found no:

```text
session_replication_role
DISABLE TRIGGER
ALTER TABLE ... DISABLE
ENABLE REPLICA:
```

The test negative mode uses only test-only values and expected failures.

### 7.2 Deferred lifecycle event settlement

The helper uses:

```sql
SET CONSTRAINTS "p13_lifecycle_file_version_bijection_guard" IMMEDIATE;
SET CONSTRAINTS "p13_lifecycle_file_version_bijection_guard" DEFERRED;
```

after valid intermediate lifecycle states. This executes the named check
instead of disabling it, then restores deferred behavior. The later
`FINALIZING -> ACTIVE` event remains deferred and sees the final FileVersion at
commit.

The PostgreSQL test log proves the actual final guards still fired, including:

- `new File terminal provenance chain is incomplete`;
- `completed Intent has no target FileVersion`;
- `File provenance scope is immutable`;
- `file_version identity is immutable`;
- `file_version rows cannot be truncated in P1-3`.

### 7.3 Checksum

The helper now computes actual SHA-256 with:

```text
createHash("sha256").update(value).digest("hex")
```

The earlier invalid repeated-string digest was rejected by
`close_attestation_complete_check`; the corrected run passed through the
expected lifecycle checks.

### 7.4 TRUNCATE

`TRUNCATE ... CASCADE` is used to pass the unrelated FK preemption and reach
the target `p13_file_version_truncate_guard`. The final test still receives
`42501` and the exact `file_version rows cannot be truncated in P1-3` message.
This does not weaken the Trigger.

### 7.5 Fixture verdict

```text
production Trigger disablement:  none
FK/CHECK/UNIQUE bypass:          none found
test-only data classification:   explicit DEMO_MOCK / TEST_* values
checksum realism:                corrected to SHA-256
```

The fixtures are database invariant fixtures, not physical filesystem or
Provider evidence.

## 8. Phase-41 catalog defense review

The repaired CTE dependency does not weaken phase-41. However, the existing
catalog postcheck remains narrower than the original V7 acceptance language.

It verifies:

- expected Trigger names;
- expected relation names;
- `tgenabled <> 'D'`;
- deferrable and initially deferred for the completion guard;
- absence of `p13_completed_append_current_guard`.

It does not verify:

- `tgfoid` maps the Trigger to the expected function OID;
- exact `tgtype` event mask;
- `tgenabled = 'O'` rather than merely "not disabled";
- Trigger function body/source identity.

A same-named Trigger attached to a wrong function or reduced event set could
pass this phase-41 postcheck. Phase-40's own postcheck is stronger for event
bits but still does not prove Trigger-to-function identity.

This is a defense-in-depth/evidence gap. The actual successful catalog happens
to show the expected function names and Triggers, but the Migration postcheck
does not prove their attachment mapping.

## 9. Historical limitations

The following R20-C1 limitations are confirmed and remain unresolved:

- older historical categories prevented by phase-39 constraints without a
  forbidden bypass are not executable phase-40 vectors;
- phase-40 postcheck failure is not tested;
- natural phase-41 data failure is not tested;
- real Provider write/discovery is not tested;
- Windows OS-level fencing is not tested;
- IAM/ACL is not tested;
- real Web/Worker PostgreSQL E2E is not tested;
- Build and Startup Gate are not tested;
- production Migration/deployment is not tested;
- P2-05 remains open;
- R5 57 Open Decisions remain open;
- BV7 remains FAIL;
- BV8 remains unapproved;
- historical R8 remains BLOCKED;
- Binding-parent-chain, orphan FileVersion and multiple-FileVersion terminal
  matrix remain outside this review.

These limitations do not reopen the successful `42703` correction, but they do
prevent a whole-CM1 approval.

## 10. Findings

### R21-P2-01 — stale-current concurrency evidence is insufficient

Severity: `P2`

Location:

```text
apps/web/tests/integration/phase40-append-intent-finalization.test.ts:551-617
```

Observed:

- current pointer is committed to `next` before the two clients start;
- client A executes only `SELECT ... FOR UPDATE`;
- no concurrent current-version write exists;
- client B would reject in the same way without client A.

Impact:

- R20 V5-C current-pointer-versus-reservation competition remains
  `NOT VERIFIED`;
- TOCTOU/write-skew behavior is not proven by this test;
- R20-C1's phrase "two-client stale-current" is technically narrower than the
  required write competition.

Required correction:

- add the directed transaction race described in section 5.3;
- retain both winner orders and final cross-table state;
- record exact Trigger/SQLSTATE/P2002 first-control evidence.

### R21-P2-02 — V4/V5 test database identity is not self-asserted

Severity: `P2`

Location:

```text
apps/web/tests/integration/phase40-append-intent-finalization.test.ts:15
apps/web/vitest.r20c1.config.ts
```

Observed:

- test uses default `PrismaClient()`;
- test config does not pin the datasource;
- final test log prints no `current_database()` / `current_user` / port;
- database identity exists only in a separate seed log.

Impact:

The isolated target is plausible and externally seeded, but the test execution
itself is not durably bound to `cm1_r20c1_v4v7` or role `cm1_r20_app`.

Required correction:

Assert and print database, role and port in `beforeAll`; fail before any test
mutation if they differ.

### R21-P2-03 — phase-41 catalog postcheck does not prove function/event identity

Severity: `P2`

Location:

```text
prisma/migrations/20261126160000_phase41_append_scope_precheck/migration.sql:165-205
```

Observed:

- function existence is checked separately;
- Trigger rows are not joined to `pg_proc` through `tgfoid`;
- exact `tgtype` is not checked;
- `tgenabled='O'` is not required.

Impact:

A wrong function or reduced event set behind an expected Trigger name could
escape this postcheck. This is defense-in-depth incompleteness, not evidence
that the successful Migration installed the wrong object.

Required correction:

Verify `tgfoid = expected_function::regprocedure`, exact event bits, expected
relation, and `tgenabled='O'` in phase-41 or a dedicated catalog test.

### R21-P3-01 — 21/21 classification is overstated

Severity: `P3`

Two of the 21 Vitest cases only inspect the in-memory history-vector array.
The accurate count is 19 PostgreSQL behavior tests plus 2 static assertions.

### R21-P3-02 — retained migration checksum linkage is absent

Severity: `P3`

The `_prisma_migrations` dump omits the Prisma checksum column. Source hashes
and timestamps support identity, but a retained DB checksum comparison would
make the applied-file linkage directly auditable.

### R21-P3-03 — one retained identity file is unusable

Severity: `P3`

`D:\AI-Elevator-Advisor-CM1-R20\evidence\server-identity.log` contains a stale
connection-refused error. R20-C1 does not cite it, and stronger migration/DB
identity logs exist, so it does not alter the migration conclusion. It should
not be presented as positive identity evidence.

## 11. Git state

Git state immediately before adding this report:

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

Final live Git state after adding this report is recorded in section 13.

No source, Schema, Migration, test, existing report, database or evidence file
was modified.

## 12. R21 admission decision

```text
42703 source correction:                  APPROVED
phase-40/41 successful Migration:         CONFIRMED
full CM1 relational-integrity admission:  NOT YET APPROVED
```

R21 approves only progression to targeted evidence completion for
`R21-P2-01` through `R21-P2-03`. It does not approve Router C-Full,
production readiness, real Provider use, IAM/ACL, Windows fencing, E2E or
deployment.

## 13. Final live Git state

After adding this report:

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

## 14. Report hash, bytes and lines

Final report SHA-256 (hash line canonicalized to 64 zero bytes):

```text
5C35A745D924A5E724F67A037CEC4C5B8A7E64DB50F3C32F954235E9130BD6B0
```

Byte count: `22744`

Line count: `538`
