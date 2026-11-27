# WP-2A-CM1 Append Intent Relational Integrity Independent Review R15

## 0. Final conclusion

```text
PASS WITH RESTRICTIONS — SOURCE REVIEW APPROVED WITH EXPLICIT LIMITATIONS
```

R14 correctly implements the two R11 P1 corrections at source level:

- the unified N/N/Append completion guard;
- immutable File provenance scope and creator fields;
- additional fail-closed handling for legacy-unverified Files.

No new P1 was found. Several P2 test/migration gaps remain, and all
PostgreSQL behavior remains `NOT VERIFIED`.

## 1. Scope and workspace

Verified R14:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-controlled-implementation-r14.md
SHA-256 ADF1C8FEEBDE04EBDF4C55EE90C0A9B23A505A5765BA03C94EA23D39B352981A
```

Verified design/review inputs:

```text
R12 SHA-256 56C2A47F352BC0889ADE64600E71B7F003B0BFB7815676D7A6710DDC29070032
R13 SHA-256 33900BEDD6A65C5B7EDC59A4A72F23568274E611F43B7103AEBDEA1C4C311BF9
```

Git before review:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      95
Untracked files:        96
```

## 2. Reviewed source

```text
prisma/schema.prisma
prisma/migrations/20261126140000_phase39_append_intent_relational_integrity/migration.sql
prisma/migrations/20261126150000_phase40_append_intent_finalization_hardening/migration.sql
prisma/migrations/20261115233000_phase32_upload_intents/migration.sql
prisma/migrations/20261115213000_phase31_file_data_model/migration.sql
prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql
apps/web/src/modules/files/upload-service.ts
apps/web/src/modules/files/object-upload-service.ts
apps/web/tests/helpers/p13-file-version.ts
apps/web/tests/fixtures/phase40-append-intent-history-vectors.ts
apps/web/tests/phase40-append-intent-finalization.test.ts
apps/web/tests/integration/phase40-append-intent-finalization.test.ts
```

R15 was read-only. No database, SQL, Migration, Build, E2E, Provider or
runtime operation was executed.

## 3. R11-P1-01 independent verification

### 3.1 Immediate N/N provenance

R14 replaces `validate_upload_intent_completion()` and rejects an N/N
completion unless:

```text
target FileVersion.uploadIntentId = Intent.id
target File.createdByUploadIntentId = Intent.id
target File creator matches Intent uploader
target File project/building/unit matches Intent
```

This closes the R11 immediate path. The guard is attached to the existing
BEFORE UPDATE completion trigger and re-queries the target rows.

Result: `IMPLEMENTED IN SOURCE`.

### 3.2 Deferred unified completion

R14 creates `p13_assert_completed_intent_final()` and
`p13_completed_intent_final_guard`.

The final function:

- re-reads the final Intent;
- re-reads the target FileVersion;
- re-reads the target File;
- re-reads the expected-current FileVersion for Append;
- computes final max versionNumber;
- checks N/N origin or Append target;
- checks current pointer equals completed target;
- checks target version is max version.

It covers both legal orders:

```text
current -> Intent completion
Intent completion -> current
```

It also rejects:

```text
N/N target under an unrelated File
N/N target under another origin File
missing completed target
target from another Intent
higher unapplied FileVersion
multiple completion events with a mismatched final current
```

The old R10 Append-only completion trigger and function are removed in the
forward phase-40 Migration after the replacement is created.

Result: `IMPLEMENTED IN SOURCE`; PostgreSQL `NOT VERIFIED`.

### 3.3 Relevant source risks found

No N/N early-return path remains in the new unified guard.

The R14 test helper supports both completion orders and an immediate
constraint-forcing mode. The test source is designed to distinguish the
unified guard from the broader P1-3 chain.

## 4. R11-P1-02 independent verification

R14 adds:

```text
p13_protect_file_provenance_scope()
p13_file_provenance_scope_immutable
BEFORE UPDATE OF
  customerId, projectId, buildingId, installationUnitId,
  createdById, createdByUploadIntentId
```

The guard uses `IS DISTINCT FROM` for all six fields and raises `42501`.

The current File INSERT paths provide all fields at creation:

- upload-service File creation sets customer/project/building/unit,
  createdById and createdByUploadIntentId;
- object-upload-service does the equivalent;
- no current service path requires later scope completion.

Service-level Append creation also rejects a legacy File before dispatch:

```text
LEGACY_FILE_APPEND_FORBIDDEN
```

Result: `IMPLEMENTED IN SOURCE`; PostgreSQL `NOT VERIFIED`.

### 4.1 Remaining role limitation

The current `elevator_app` role is still the database owner. A role that can
disable triggers or issue DDL can bypass these controls. R15 does not mark
that as production-safe. IAM/ACL remains `NOT VERIFIED`.

## 5. Legacy-unverified Files

R14 precheck classifies completed N/N records with no proven origin as
`legacy_unverified`. The phase-40 precheck excludes only those historical
current-owner rows from the generic `file_current_unowned` failure when an N/N
completed Intent actually points at the current version.

Runtime source rules:

- new Append target with NULL File origin is rejected by Trigger;
- upload service rejects the same target earlier;
- current pointer change on legacy File is rejected by
  `p13_assert_file_current_latest_completed`;
- no automatic backfill or pointer mutation exists;
- new N/N completion cannot omit origin.

Existing read paths still use their existing authorization checks; no source
read was broadened.

Legacy historical rows are not structurally marked in a separate durable
status column. Their status is inferred from NULL origin and the storage
chain. This is a documented restriction, not a new P1.

Result: `IMPLEMENTED IN SOURCE`; historical inventory `NOT VERIFIED`.

## 6. phase-40 Migration review

The new Migration is:

```text
prisma/migrations/20261126150000_phase40_append_intent_finalization_hardening/migration.sql
```

It does not modify phase-39.

### 6.1 Precheck before DDL

The file contains:

1. local lock/statement timeouts;
2. ACCESS EXCLUSIVE NOWAIT locks on project, file_version, file and
   file_upload_intent;
3. the historical precheck;
4. function/trigger DDL;
5. catalog postchecks.

Precheck is textually and structurally before the first function/trigger DDL.
PostgreSQL parsing and execution remain `NOT VERIFIED`.

### 6.2 Categories present

The source contains categories including:

```text
invalid_pair
dangling_expected
cross_file_expected
uploading_current_mismatch
completed_target_missing_or_wrong_intent
append_completed_target_wrong_file
append_expected_not_before_target
new_file_origin_conflict
new_file_target_not_origin
origin_scope_mismatch
versioned_file_null_current
file_current_not_max
file_current_unowned
active_append_legacy_origin
legacy_unverified
```

The source also contains corresponding structured vectors and expected
categories. This is source/test metadata, not executed migration evidence.

### 6.3 New P2: historical Append scope not fully checked

Migration precheck checks Append target File identity, expected-current
ordering and completed target/current relations. It does not explicitly
compare the historical Append Intent's `projectId`, `buildingId` and
`installationUnitId` against the target File's scope in a dedicated
precheck predicate.

Current write-time guards and composite FKs reduce this risk, but a
non-empty historical clone could contain a legacy row created by a bypass.
R14 should add an explicit Append scope category to the precheck and a
corresponding vector before relying on the precheck as a complete historical
audit.

Severity: `P2`.

## 7. Trigger event matrix

Source-derived matrix:

| Object/event | Trigger/mechanism | Timing | R14 test source |
|---|---|---|---|
| File INSERT | `p13_file_creation_origin_guard`; deferred terminal/current guards | BEFORE/deferred | yes |
| File UPDATE scope | `p13_file_provenance_scope_immutable` | BEFORE ROW | yes |
| File UPDATE current | active/latest deferred guards | deferred | yes |
| File DELETE | FK restrictions and chain guards | statement/row | partial |
| FileVersion INSERT/UPDATE | P1-3 storage/lifecycle chain | BEFORE/deferred | existing tests |
| FileVersion UPDATE/DELETE | `file_version_identity_guard` / P1-3 guards | BEFORE ROW | yes |
| FileVersion TRUNCATE | `p13_file_version_truncate_guard` | BEFORE STATEMENT | yes |
| Intent INSERT | PENDING-only guard | BEFORE ROW | existing tests |
| Intent UPDATE | phase-3.2 completion, phase-3.7 state, history, unified final | BEFORE/deferred | yes |
| Intent completion | `p13_completed_intent_final_guard` | deferred | yes |
| Intent DELETE | identity/delete guard | BEFORE ROW | existing tests |
| Intent TRUNCATE | `p13_upload_intent_truncate_guard` | BEFORE STATEMENT | yes |

The source test includes event-bit assertions for:

```text
p13_completed_intent_final_guard
p13_file_provenance_scope_immutable
p13_created_file_terminal_guard
p13_append_current_file_commit_guard
p13_upload_intent_truncate_guard
```

Actual PostgreSQL catalog/timing behavior is `NOT VERIFIED`.

## 8. First-control review

The following expectations match source-level trigger ordering:

| Scenario | Expected first control | Status |
|---|---|---|
| N/N under existing File | phase-3.2 completion provenance | source/test |
| N/N under another origin | phase-3.2 completion provenance | source/test |
| NULL completed target | unified final guard when forced immediate | source/test |
| different-File target | completion provenance | source/test |
| same-File other Intent target | completion provenance | source/test |
| File scope update | scope immutability | source/test |
| FileVersion identity update | phase-3.1 identity | source/test |
| completed target DELETE | FileVersion delete guard | source/test |
| COMPLETED -> UPLOADING | phase-3.2 completion guard may fire before phase-3.7 state guard | source/test corrected |
| legacy Append target | service/DB fail-closed | source/test |
| legacy current advance | latest-current legacy guard | source/test |
| TRUNCATE | P1-3 truncate guard | source/test |

The `COMPLETED -> UPLOADING` case is no longer incorrectly attributed to the
later state guard; the test expects the earlier phase-3.2 completion guard.

## 9. Two-client concurrency source

R14 source test uses:

- `PrismaClient` A;
- `PrismaClient` B;
- a barrier before the active-slot transition;
- explicit `ReadCommitted`;
- final state assertions.

### 9.1 Active slot

The active-slot test creates two PENDING Appends and attempts PENDING ->
UPLOADING from separate clients. It accepts either `23505` active-slot or
`23514` stale-current as the loser.

Result: source test exists; exact first-control isolation is `PARTIAL`.

### 9.2 Stale current

The source contains a two-client test where client A holds a File current
update and client B attempts the stale reservation after A commits. It
expects the stale-current `23514`.

Result: source test exists; PostgreSQL `NOT VERIFIED`.

### 9.3 Stale ownership

The source test performs two-client generation/owner CAS updates on a
STAGING lifecycle and asserts one `updateMany` count is 1 and the other is 0.

Result: source test exists; actual PostgreSQL lock/CAS behavior `NOT VERIFIED`.

### 9.4 Version-number uniqueness

The source test named “version-number unique index separate from active-slot
protocol” currently:

- verifies the named unique index exists;
- attempts an UPDATE setting a version to its existing same value.

That second action does not generate a unique conflict. It therefore proves
the index is present, not that a conflicting `(fileId, versionNumber)` insert
is rejected at the first control.

Severity: `P2` test-source gap. A controlled PostgreSQL test must insert
conflicting rows with valid prerequisite fixtures and record `23505` and the
index name separately from active-slot rejection.

## 10. Test matrix assessment

R14 source includes:

```text
static tests:                 9
database integration cases:   21
database integration executed: 0
```

Positive and negative source coverage includes:

- N/N and Append legal completion;
- N/N under existing/foreign File;
- completion/current order;
- File scope and creator changes;
- FileVersion identity/delete/truncate;
- first-control state reversal;
- migration history vector metadata;
- active slot, stale current and stale ownership source tests.

Static tests verify SQL text, trigger names, event bits and source wiring.
They do not prove `MATCH SIMPLE`, deferred trigger behavior, FK cascades or
actual SQLSTATE.

## 11. R10 regression checks

R14 retains:

- File origin relation and service writes;
- expected-current same-File compound FK;
- completed target same-File FK;
- completed target immutability;
- latest-current guard;
- active Append partial unique index;
- explicit `ReadCommitted` in all 12 upload interaction call sites.

The R14 migration source does not weaken the R10 relations. It replaces only
the completion behavior and adds File scope immutability.

## 12. R13 P2/P3 status

| R13 item | R15 status |
|---|---|
| Legacy read/Append policy | `IMPLEMENTED IN SOURCE`; historical inventory `NOT VERIFIED` |
| COMPLETED -> UPLOADING first control | `PARTIALLY RESOLVED`; corrected expectation in source test |
| Migration vectors | `IMPLEMENTED IN TEST SOURCE`; not executed |
| Finalization race clarity | `PARTIALLY RESOLVED`; active/stale/ownership separated, version unique still weak |
| Trigger event matrix | `PARTIALLY RESOLVED`; source assertions exist, PostgreSQL not verified |
| DB Owner boundary | `NOT VERIFIED`; explicitly retained as production blocker |
| Postcheck completeness | `PARTIALLY RESOLVED`; source catalog checks exist |

## 13. New findings

### R15-P2-01 — Version-number uniqueness test is not a conflict test

Severity: `P2`

Evidence:

```text
apps/web/tests/integration/phase40-append-intent-finalization.test.ts:490
```

The test reads the unique index and updates the same version value, which is
a no-op for uniqueness. It does not attempt two conflicting FileVersion rows.

Impact: R14 cannot claim the `(fileId, versionNumber)` unique constraint has
been behaviorally tested. It is correctly a backstop, not a complete
active-slot protocol, but the insertion conflict still needs a dedicated
controlled test.

Blocks PostgreSQL validation: no; blocks any claim of complete unique-index
behavior: yes.

### R15-P2-02 — Historical Append scope precheck is incomplete

Severity: `P2`

Evidence:

```text
phase40 Migration precheck: append_completed_target_wrong_file
phase40 Migration precheck: origin_scope_mismatch
```

The precheck verifies target File identity and origin File scope, but not every
historical Append Intent's building/unit scope against its target File.

Impact: a non-empty historical clone with a bypass-created inconsistent
Append could pass the precheck even though the new write-time guard would
reject new data.

Blocks isolated PostgreSQL validation: no; blocks final non-empty migration
acceptance: yes.

### R15-P3-01 — Active-slot loser SQLSTATE is broad

Severity: `P3`

Evidence:

```text
apps/web/tests/integration/phase40-append-intent-finalization.test.ts:458
```

The active-slot test accepts `23505` or `23514`. It should separate active
unique rejection from stale-current rejection in a dedicated fixture.

## 14. NOT VERIFIED / BLOCKED

```text
phase-40 SQL execution and PL/pgSQL compilation:       NOT VERIFIED
deferred trigger order:                                 NOT VERIFIED
FK cascade behavior against scope immutability:         NOT VERIFIED
historical precheck on safe/unsafe clones:              NOT VERIFIED
Prisma migration failure/retry history:                 NOT VERIFIED
actual Read Committed server value:                     NOT VERIFIED
two-client database behavior:                           NOT VERIFIED
version-number unique insertion conflict:               NOT VERIFIED
legacy-unverified inventory:                            NOT VERIFIED
live Web/Worker PostgreSQL integration:                 NOT VERIFIED
real Provider:                                          NOT VERIFIED
Windows OS-level fencing:                               NOT VERIFIED
IAM/ACL:                                                NOT VERIFIED
production deployment:                                  BLOCKED
```

## 15. Controlled PostgreSQL validation prerequisites

Before claiming database behavior:

1. Apply the full migration chain to a disposable PostgreSQL 18 database.
2. Execute the safe/unsafe historical vectors and capture category/sample IDs.
3. Verify trigger event bits, deferrability and actual SQLSTATE.
4. Run two-client active-slot, stale-current, stale-ownership and version
   conflict tests with exact first controls.
5. Verify FK cascade/scope immutability behavior.
6. Verify the source service against real PostgreSQL.
7. Verify Prisma runner failure, retry and `_prisma_migrations` state.
8. Keep Provider, Windows fencing, ACL, E2E and production deployment
   outside the source-validation claim.

## 16. Git state after review

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      96
Untracked files:        97
New review report:      docs/architecture/wp-2a-cm1-append-intent-relational-integrity-independent-review-r15.md
```

No source, Schema, Migration, test or existing report was modified.

## 17. Report metadata

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

## 18. Final decision

```text
PASS WITH RESTRICTIONS — SOURCE REVIEW APPROVED WITH EXPLICIT LIMITATIONS
```

No unresolved P1 was found. R14 is eligible for controlled isolated
PostgreSQL validation after the P2 precheck and unique-index test corrections
are addressed.
