# WP-2A-CM1 Append Intent Relational Integrity Independent Review R19

## 0. Final conclusion

```text
PASS WITH RESTRICTIONS — SOURCE REVIEW APPROVED WITH EXPLICIT LIMITATIONS
```

No unresolved P1 was found in the R18 migration ordering correction.

Phase-40 now performs the complete known Append scope precheck before its first
function/trigger DDL. Phase-41 remains a defensive post-phase-40 verification
with no DDL.

The remaining limitations are cross-migration transactional boundaries,
incomplete identity-level defensive catalog checks, and the fact that all
PostgreSQL behavior remains unexecuted.

## 1. Scope and workspace

Verified:

```text
R18 SHA-256 94D3FBAF328BDE784BABF8564DEADCA6D3E19F610D5A18A5F6632DA58C3B9751
R17 SHA-256 E04821D41AC4A75FDF9A4719480EF18FBC3DC7E3D814AC3D00135FB2FC747A79
```

Git before review:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      100
Untracked files:        101
```

## 2. Reviewed source and evidence

Migration and schema:

```text
prisma/migrations/20261126150000_phase40_append_intent_finalization_hardening/migration.sql
prisma/migrations/20261126160000_phase41_append_scope_precheck/migration.sql
prisma/schema.prisma
```

Related source and tests:

```text
apps/web/src/modules/files/upload-service.ts
apps/web/src/modules/files/object-upload-service.ts
apps/web/tests/fixtures/phase40-append-intent-history-vectors.ts
apps/web/tests/phase40-append-intent-finalization.test.ts
apps/web/tests/integration/phase40-append-intent-finalization.test.ts
apps/web/tests/helpers/p13-file-version.ts
R10-R18 reports
P30-P37, FZ, ST, DBTP
```

R19 was read-only. No source, Schema, Migration, test, database, Build, E2E,
Provider or runtime operation was performed.

## 3. R17-P1-01 final recheck

### 3.1 Phase-40 real order

The phase-40 Migration now visibly orders:

```text
SET LOCAL timeouts
-> LOCK project, file_version, file, file_upload_intent
   ACCESS EXCLUSIVE NOWAIT
-> complete historical precheck DO block
-> first function/trigger DDL
-> remaining DDL
-> catalog postcheck
```

The first function DDL is after the precheck DO block. No auxiliary table,
function, trigger, constraint or index is created before the precheck.

### 3.2 Historical categories before DDL

The phase-40 precheck source includes:

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

The safety categories are evaluated in the first DO block. They are not
deferred to phase-41.

### 3.3 Result

R17-P1-01 is resolved at source level:

```text
known unsafe historical data
-> phase-40 precheck raises 23514
-> phase-40 function/trigger DDL does not begin
```

Actual Prisma runner transaction behavior and PostgreSQL execution remain
`NOT VERIFIED`.

## 4. Precheck-to-DDL concurrency analysis

Phase-40 takes `ACCESS EXCLUSIVE NOWAIT` locks on:

```text
project
file_version
file
file_upload_intent
```

The locks cover:

- File scope and current pointer changes;
- FileVersion identity/creation/current-related changes;
- Intent target/state/completion changes;
- project/customer relation changes used by the historical scope checks.

Within the phase-40 transaction, a concurrent writer touching these tables is
blocked or fails; the precheck and DDL share the lock window.

Important boundary:

- phase-40 and phase-41 are separate Migration files;
- no cross-migration atomicity is claimed;
- phase-41 reacquires its own locks and performs a defensive recheck;
- Web, Worker, Scheduler and retry writers must be drained through both
  migration phases.

The source does not prove a transaction boundary across phase-40 and phase-41.
Prisma runner transaction semantics remain `NOT VERIFIED`.

Lock-order assessment:

```text
project -> file_version -> file -> file_upload_intent
```

No source-level lock-order inversion was found. PostgreSQL deadlock behavior
is not executed.

## 5. Migration failure and retry matrix

| Failure point | Expected source/runner outcome | R19 status |
|---|---|---|
| phase-40 historical precheck | `23514`, no phase-40 DDL | source design; runner `NOT VERIFIED` |
| phase-40 function/trigger DDL | transaction rollback | `NOT VERIFIED` |
| phase-40 catalog postcheck | transaction rollback | `NOT VERIFIED` |
| phase-40 success, phase-41 precheck failure | phase-40 remains; phase-41 not committed | source structure understood; runner `NOT VERIFIED` |
| phase-40 success, phase-41 postcheck failure | phase-40 remains; phase-41 failed | source structure understood; runner `NOT VERIFIED` |
| phase-41 retry | requires repaired data and fresh runner state | `NOT VERIFIED` |

No claim is made that Prisma provides atomicity across separate Migration
files.

## 6. Phase-41 defensive review

Phase-41 contains:

- no `CREATE`, `ALTER`, `DROP` or `TRUNCATE`;
- the same scope categories and unsafe/legacy distinction;
- a post-phase-40 check for the unified completion trigger;
- a post-phase-40 check for the File provenance trigger;
- a check that the old Append-only completion trigger is absent.

The phase-41 source does not reclassify a phase-40 legacy record as safe; it
reports the legacy category as non-unsafe inventory only.

### Residual P2

Phase-41 catalog checks verify:

- trigger name;
- relation name;
- enabled state;
- deferrability/initial timing for the completion trigger.

They do not fully verify:

- event-bit equality;
- exact trigger function identity;
- exact function body/signature;
- exact column list for the File scope trigger.

Because phase-40 creates these objects and phase-41 follows immediately under
drain, this is defense-in-depth, not a source P1. A same-named object inserted
or changed by a privileged actor between migrations could evade the name-level
defensive check; actual controlled PostgreSQL validation must inspect full
catalog identity.

## 7. Legacy classification and counts

Phase-40 and phase-41 now expose:

```text
categoryCount
uniqueUnsafeRecords
details
```

`categoryCount` is a sum of category occurrences and may overlap.

`uniqueUnsafeRecords` uses:

```text
record_kind + ':' + object_id
```

with File-level conditions mapped to `file` and Intent-level conditions mapped
to `intent`.

The source excludes `legacy_unverified` and `legacy_append_unverified` from
unsafe totals while retaining them in details. No unsafe category is
excluded.

Category overlap is explicit:

- a legacy row can also carry an unsafe scope mismatch;
- expected-current and target/completion categories can overlap;
- categoryCount is not a unique record count;
- uniqueUnsafeRecords is the distinct record identity count.

No auto-repair, backfill, pointer rewrite or target reassignment exists.

## 8. Active-slot and FileVersion tests

### Active slot

The source test:

- uses two independent `PrismaClient` instances;
- has a barrier before the reservation transition;
- expects one fulfilled transaction;
- requires `P2002` for the loser;
- requires target metadata containing `existingFileId`;
- explicitly rejects stale-current `23514` from this test.

Status: source test exists; actual Prisma `meta.target` and PostgreSQL
active-slot constraint behavior remain `NOT VERIFIED`.

### FileVersion uniqueness

The source test creates a valid base FileVersion and a separate storage chain,
then inserts a second FileVersion with the same `fileId` and `versionNumber`.
It expects `P2002` and target metadata for both fields, then checks that only
one row remains.

Status: source test exists; actual PostgreSQL `23505`, pre-insert Trigger
order and transaction rollback remain `NOT VERIFIED`.

## 9. R10/R14/R16 regression

Retained:

- File origin and compound expected/completed relations;
- unified N/N and Append completion guard;
- File six-field provenance immutability;
- completed target immutability;
- latest-current guard;
- active Append partial unique index;
- 12 explicit upload `ReadCommitted` transaction sites;
- Legacy-unverified new Append/current fail-closed behavior;
- R16 history vectors and duplicate FileVersion test source.

No source-level weakening was found.

## 10. Test evidence level

Static tests in the worktree are source-text assertions and do not prove SQL
semantics. The database integration source has not been executed.

Evidence levels:

```text
source review:                  PASS
static/unit tests:              PASS per R18 run
database integration source:    PRESENT / NOT EXECUTED
PostgreSQL behavior:            NOT VERIFIED
```

## 11. Findings

### R19-P2-01 — Cross-migration atomicity is not established

Severity: `P2`

Phase-40 and phase-41 are separate Migration files. Phase-40 locks protect its
precheck-to-DDL window, but phase-41 begins after phase-40 commits. A direct
writer outside the drained process boundary could change precheck-relevant
state between the files. Phase-41 detects it only after phase-40 DDL has
committed.

Impact: a failed phase-41 leaves phase-40 structural changes in place.

Does it block isolated PostgreSQL validation: no; it must be verified in the
drained controlled environment, and the runbook must keep writers stopped.

Minimal fix if cross-file atomicity is required: combine the checks and DDL
into one migration transaction or provide an explicitly validated
two-migration runner procedure.

### R19-P2-02 — Phase-41 defensive identity check is name-level

Severity: `P2`

The phase-41 postcheck does not verify full trigger event bits, exact function
identity or File trigger column list. It is useful but not a complete
independent proof of phase-40 installation.

Minimal fix: add catalog assertions for trigger `tgtype`, `tgfoid`/function
identity and column attributes, then verify them in PostgreSQL.

### R19-P3-01 — Test source remains unexecuted

Severity: `P3`

Active-slot, duplicate version, scope, SAVEPOINT, SET CONSTRAINTS and failure
vectors are not PostgreSQL-executed in this round.

## 12. NOT VERIFIED / BLOCKED

```text
phase-40 SQL and PL/pgSQL compilation:            NOT VERIFIED
phase-41 SQL execution:                            NOT VERIFIED
Migration runner transaction boundaries:           NOT VERIFIED
_prisma_migrations failure/retry state:            NOT VERIFIED
real trigger event bits/function identities:       NOT VERIFIED
FK cascade behavior:                               NOT VERIFIED
real active-slot P2002/meta.target:                NOT VERIFIED
real duplicate FileVersion 23505:                  NOT VERIFIED
real stale-current and ownership races:            NOT VERIFIED
historical safe/unsafe vector execution:           NOT VERIFIED
live Web/Worker PostgreSQL integration:            NOT VERIFIED
real Provider:                                     NOT VERIFIED
Windows OS fencing:                               NOT VERIFIED
IAM/ACL:                                           NOT VERIFIED
production deployment:                             BLOCKED
```

## 13. PostgreSQL qualification

R19 source review does not authorize PostgreSQL execution. Controlled
validation must:

1. apply the complete migration chain to disposable clones;
2. verify phase-40 precheck before DDL;
3. verify phase-40 failure rollback and phase-41 failure state;
4. execute all history vectors;
5. inspect trigger event bits and function identities;
6. execute duplicate FileVersion and active-slot races with two clients;
7. verify exact Prisma/SQLSTATE metadata;
8. keep Provider, Windows, ACL and production out of scope.

## 14. Git state after review

At review start:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      100
Untracked files:        101
```

After adding this report:

```text
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      101
Untracked files:        102
New review report:      docs/architecture/wp-2a-cm1-append-intent-relational-integrity-independent-review-r19.md
```

No source, Schema, Migration, test or existing report was modified.

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
PASS WITH RESTRICTIONS — SOURCE REVIEW APPROVED WITH EXPLICIT LIMITATIONS
```

R18 fixes the fail-before-phase-40-DDL ordering at source level. Cross-file
transaction atomicity, full catalog identity and all PostgreSQL behavior remain
restrictions for the next controlled validation stage.
