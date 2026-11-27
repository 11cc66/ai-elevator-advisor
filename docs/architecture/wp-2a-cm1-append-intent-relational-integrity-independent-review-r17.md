# WP-2A-CM1 Append Intent Relational Integrity Independent Review R17

## 0. Final conclusion

```text
FAIL — DESIGN OR IMPLEMENTATION CORRECTIONS REQUIRED
```

R16 resolved the three reported source/test gaps at source level, but the
phase-40/phase-41 composition introduces a blocking migration-order defect.

The phase-41 historical Append building/unit precheck runs only after phase-40
has passed its own precheck and committed its DDL. A non-empty database with
an unsafe Append scope can therefore:

```text
pass phase-40 precheck
-> commit phase-40 functions/triggers/constraints
-> fail phase-41 scope precheck
```

This is not fail-before-DDL for the migration chain and leaves a partially
advanced, retry-dependent database state.

No PostgreSQL, SQL, Migration, Build, E2E, Provider or runtime operation was
performed.

## 1. Scope and workspace

Verified R16:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-targeted-corrections-r16.md
SHA-256 CD428BD6FB85F756CF07C1302A8EF8B32302518C0D21DD2F4FBD9AAE314EBFFE
```

Verified R15 and R14:

```text
R15 CE9F3E7DE99AD1BC1086ADFFA8798B416B345DECCADF417B2FC37F580898F980
R14 ADF1C8FEEBDE04EBDF4C55EE90C0A9B23A505A5765BA03C94EA23D39B352981A
```

Git before review:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      98
Untracked files:        99
```

## 2. Reviewed evidence

```text
prisma/schema.prisma
prisma/migrations/20261126140000_phase39_append_intent_relational_integrity/migration.sql
prisma/migrations/20261126150000_phase40_append_intent_finalization_hardening/migration.sql
prisma/migrations/20261126160000_phase41_append_scope_precheck/migration.sql
apps/web/src/modules/files/upload-service.ts
apps/web/src/modules/files/object-upload-service.ts
apps/web/tests/fixtures/phase40-append-intent-history-vectors.ts
apps/web/tests/phase40-append-intent-finalization.test.ts
apps/web/tests/integration/phase40-append-intent-finalization.test.ts
apps/web/tests/helpers/p13-file-version.ts
R10-R16 reports
P30-P37, FZ, ST, DBTP
```

R17 is read-only. No existing source, Schema, Migration, test or report was
modified.

## 3. R15 Finding recheck

### R15-P2-01 — duplicate FileVersion insert

R16 adds `insertDuplicateVersion()` in:

```text
apps/web/tests/integration/phase40-append-intent-finalization.test.ts:846
```

It constructs a valid base FileVersion, a separate valid storage chain, and
then attempts a second FileVersion with:

```text
same fileId
same versionNumber
different id/uploadAttemptId/creationOperationAttemptId/storageKey
```

The source test expects Prisma `P2002` and checks that only one matching
FileVersion remains.

This is materially stronger than the previous no-op UPDATE. It is still
`NOT VERIFIED` because PostgreSQL is not executed. The exact PostgreSQL
`23505` and lower-level constraint name remain unverified; Prisma `P2002`
must not be presented as an executed SQLSTATE.

Status: `IMPLEMENTED IN TEST SOURCE`; runtime `NOT VERIFIED`.

### R15-P2-02 — Append scope precheck

R16 adds:

```text
prisma/migrations/20261126160000_phase41_append_scope_precheck/migration.sql
```

It contains explicit categories:

```text
append_target_missing
append_building_scope_mismatch
append_installation_unit_scope_mismatch
append_scope_combination_mismatch
append_expected_current_wrong_file
append_expected_not_before_target
legacy_append_unverified
```

The SQL conditions are:

| Category | Condition |
|---|---|
| target missing | `existingFileId` has no File row |
| building mismatch | `Intent.buildingId` differs from target File and unit matches |
| installation-unit mismatch | `Intent.installationUnitId` differs while building matches |
| combined mismatch | both building and unit differ |
| expected wrong File | expected FileVersion.fileId differs from existing File |
| expected/target order | expected versionNumber is not below completed version |
| legacy Append | target File origin is NULL; notice-only |

The categories are dispatched before phase-41 has any DDL. The phase-41 file
itself is correctly precheck-only and contains no `CREATE`, `ALTER`, `DROP`,
or `TRUNCATE`.

However, this does not make the **combined migration chain** fail before DDL.
See R17-P1-01.

Status: `PARTIAL`; SQL source covers the requested scope, but ordering is
unsafe.

### R15-P3-01 — active-slot control

The active-slot source test now asserts Prisma `P2002` for the loser and
separates stale-current `23514`.

The test still does not assert `meta.target` or the active-slot index name.
It therefore could theoretically accept a different Prisma unique violation
if another unique constraint were hit. The barrier and two-client structure
are present.

Status: `PARTIALLY RESOLVED`.

## 4. R11 P1 regression

### R11-P1-01

Phase-40 source still contains:

- immediate completion provenance;
- unified final completion guard;
- N/N origin proof;
- Append target/current/latest proof;
- final row re-reads.

No early N/N return exists in the phase-40 unified function.

Status: `IMPLEMENTED IN SOURCE`; PostgreSQL `NOT VERIFIED`.

### R11-P1-02

Phase-40 source still contains the six-field File immutability trigger.
R16 did not weaken it. The service-level legacy Append rejection remains.

Status: `IMPLEMENTED IN SOURCE`; PostgreSQL `NOT VERIFIED`.

## 5. P1-01 — Migration order violates fail-before-DDL

Severity: `P1`

Evidence:

```text
prisma/migrations/20261126150000_phase40_append_intent_finalization_hardening/migration.sql
prisma/migrations/20261126160000_phase41_append_scope_precheck/migration.sql
```

Phase-40 performs its historical precheck and then commits DDL:

```text
precheck
-> create/replace functions
-> drop old completion trigger/function
-> create unified completion and File scope triggers
-> postcheck
```

Phase-41 runs later because its timestamp sorts after phase-40. Its precheck
is the first place that catches a historical Append building/unit mismatch
that phase-40 does not classify.

Attack/failure sequence:

```text
1. Non-empty clone contains Append Intent I whose buildingId differs from
   target File F.
2. phase-40 precheck does not classify that building/unit mismatch.
3. phase-40 DDL commits.
4. phase-41 precheck raises 23514.
5. The database is left after a successful phase-40 migration and a failed
   phase-41 migration.
```

Failed phase-41 does not roll back phase-40. Services must remain drained and
the operator must reconcile data before retry; an all-or-nothing
fail-before-DDL property has not been established for the migration chain.

Impact:

- the migration sequence is not atomic across the two files;
- a pre-existing unsafe Append can cause schema advancement before rejection;
- `_prisma_migrations` can contain a successful phase-40 and failed phase-41
  state;
- retry behavior depends on external migration-runner semantics that have not
  been verified.

This blocks acceptance of the R16 migration chain as fail-before-DDL.

Recommended minimal correction:

- move the phase-41 Append scope predicates into phase-40 before its first
  DDL, or
- create a single new precheck migration whose ordering precedes phase-40 and
  whose failure prevents phase-40 from starting, or
- explicitly make phase-40/phase-41 a controlled two-phase runbook with a
  proven transactional runner and operational rollback gate.

Do not add phase-41 as a post-phase-40 cleanup and claim the chain is
fail-before-DDL.

## 6. Phase-41 classification details

### 6.1 Building and unit nullability

`IS DISTINCT FROM` correctly treats NULL vs non-NULL as a mismatch. The
separate categories are:

```text
building only mismatch
unit only mismatch
building + unit mismatch
```

The combined category prevents a row with both differences from relying on
only one independent category. This part is source-correct.

### 6.2 Target and expectation joins

The target-missing category is a table-not-found guard, but normal FK
integrity should make it unreachable in a committed database. It is still
useful for a defensive clone audit.

The expected-current category joins `file_version` by ID. A missing
FileVersion is not returned by that join and is handled by phase-40's
dangling/cross-file categories, not by phase-41. This is an intentional
dependency, but must remain documented in the migration runbook.

### 6.3 Legacy classification

`legacy_append_unverified` is notice-only and can overlap with an unsafe
building/unit category for the same Intent. Counts are category-specific and
may not sum to the number of unique Intent IDs. Evidence must preserve both
the category and object ID, not report only a total.

The current phase-41 source does not automatically repair or backfill a
legacy Append. It also does not establish whether a future Append to that
legacy File is permitted; phase-40's write guards do.

## 7. Migration dependency and failure state

```text
phase-39:
  precheck
  -> completion/current/File-origin DDL
  -> postcheck

phase-40:
  precheck
  -> unified completion + File scope DDL
  -> postcheck

phase-41:
  precheck-only
  -> no DDL
```

Failure analysis:

| Failure point | State |
|---|---|
| phase-40 precheck | phase-39 remains; phase-40 DDL absent |
| phase-40 DDL/postcheck | phase-40 should roll back within runner; not PostgreSQL-verified |
| phase-41 precheck | phase-40 remains committed; phase-41 absent |
| phase-41 retry | must rerun after data repair; migration history behavior not verified |

The phase-41 file itself has no DDL, but the combined chain does not satisfy
the stronger claim that all historical safety checks precede all DDL.

## 8. Trigger and source regression

Source retains:

- File origin guard;
- expected-current same-File FK;
- completed-target same-File FK;
- completed-target immutability;
- latest-current guard;
- active Append partial unique index;
- File six-field scope guard;
- unified completion guard;
- explicit `ReadCommitted` in all upload interaction transactions.

No R10/R14 guard was removed by R16.

## 9. Test source assessment

R16 static suite:

```text
9 tests in phase40-append-intent-finalization.test.ts before R16 additions
10 static tests after phase41 additions
```

Database integration source contains:

```text
21 test cases
```

The duplicate FileVersion source is now a real duplicate-insert design, but
it is still source-only. The active-slot test uses two clients and a barrier,
but does not assert the unique index target metadata. The phase-41 history
vectors are structured specifications, not executed evidence.

No source test was executed in R17.

## 10. R16/R13 issue status

| Finding | R17 status |
|---|---|
| R15-P2-01 duplicate insert | `IMPLEMENTED IN TEST SOURCE`; SQLSTATE/index conflict `NOT VERIFIED` |
| R15-P2-02 scope precheck | `PARTIAL`; SQL exists, migration ordering P1 |
| R15-P3-01 active-slot | `PARTIALLY RESOLVED`; P2002 no target metadata assertion |
| R13 legacy policy | `PARTIAL`; historical inventory and write policy source-only |
| R13 migration vectors | `IMPLEMENTED IN TEST SOURCE`; not executed |
| R13 event matrix | `PARTIAL`; source assertions only |
| R13 owner boundary | `NOT VERIFIED` |

External restrictions remain unchanged:

```text
P2-05:                                OPEN
R5 57 Open Decisions:                 OPEN
BV7:                                  FAIL
BV8:                                  NOT VERIFIED
historical R8:                        BLOCKED
binding-parent-chain:                 NOT VERIFIED
orphan FileVersion:                   NOT VERIFIED
multiple FileVersion terminal:        NOT VERIFIED
real Provider/Windows/IAM/ACL:        NOT VERIFIED
live Web/Worker PostgreSQL:           NOT VERIFIED
production deployment:                BLOCKED
```

## 11. Findings

### R17-P1-01 — phase-41 cannot provide fail-before-DDL for the chain

Severity: `P1`

Files:

```text
prisma/migrations/20261126150000_phase40_append_intent_finalization_hardening/migration.sql
prisma/migrations/20261126160000_phase41_append_scope_precheck/migration.sql
```

Trigger: a non-empty historical database contains an Append building/unit
scope mismatch that phase-40 does not classify.

Expected: no phase-40 DDL is applied before that conflict is rejected.

Actual possible: phase-40 DDL commits, then phase-41 raises `23514`.

Impact: partial migration-chain advancement, retry dependency and
`_prisma_migrations` ambiguity.

Blocks isolated PostgreSQL validation of the full chain: yes, until ordering
is corrected or a validated transactional two-phase runbook is provided.

Minimal fix: move the scope precheck before phase-40 DDL or make phase-40/41
an explicitly atomic controlled operation.

### R17-P2-01 — active-slot P2002 target is not identified

Severity: `P2`

File:

```text
apps/web/tests/integration/phase40-append-intent-finalization.test.ts:458
```

The test asserts only `code: "P2002"`. It does not assert
`one_active_append_intent_per_file` or target `existingFileId`. This can hide
another unique constraint failure.

Minimal fix: assert Prisma `meta.target` and the active-slot index/constraint
diagnostic, and keep the stale-current test separate.

### R17-P2-02 — phase-41 categories overlap without an explicit evidence rule

Severity: `P2`

`legacy_append_unverified` can overlap with an unsafe scope category for the
same Intent. The precheck emits category counts and sample IDs but does not
state whether counts are unique-object counts or category rows.

Minimal fix: document overlap semantics and preserve category-specific
evidence; do not interpret the sum as distinct Intent count.

### R17-P2-03 — duplicate-insert test is not executed

Severity: `P2`

The source is improved, but no PostgreSQL execution proves:

```text
23505
constraint name
pre-insert trigger ordering
transaction rollback
```

This remains a validation gap, not a source defect.

### R17-P3-01 — phase-41 has no postcheck

Severity: `P3`

Because phase-41 is precheck-only, no postcheck is required for its own DDL.
It should still record an explicit no-op completion/evidence artifact so
operators can distinguish a successful precheck from a skipped migration.

## 12. PostgreSQL validation qualification

R17 does not authorize PostgreSQL execution. The source can enter a future
controlled validation only after R17-P1-01 is resolved or a transactionally
proven runbook is accepted.

The following must remain separate:

1. source static validity;
2. unit/static test pass;
3. safe/unsafe Migration fixtures;
4. actual PostgreSQL DDL/Trigger/FK behavior;
5. two-client concurrency;
6. real Web/Worker integration;
7. Provider/IAM/ACL/Windows/deployment.

## 13. Git state after review

At review start:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      98
Untracked files:        99
```

After adding this report:

```text
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      99
Untracked files:        100
New review report:      docs/architecture/wp-2a-cm1-append-intent-relational-integrity-independent-review-r17.md
```

No source, Schema, Migration, test or existing report was modified.

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
FAIL — DESIGN OR IMPLEMENTATION CORRECTIONS REQUIRED
```

R16 fixes the three local test/precheck gaps in source, but the phase-40 then
phase-41 execution order violates the migration chain's fail-before-DDL
requirement. Until that ordering is corrected, the source is not eligible for
a controlled PostgreSQL migration validation.
