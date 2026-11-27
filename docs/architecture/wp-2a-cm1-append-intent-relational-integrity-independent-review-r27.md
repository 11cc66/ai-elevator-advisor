# WP-2A-CM1 Append Intent Relational Integrity Independent Review R27

## 0. Final conclusion

```text
PASS WITH RESTRICTIONS — R26 EVIDENCE VERIFIED WITH EXPLICIT LIMITATIONS
```

R26 independently closes the two evidence gaps identified by R25:

- `R26-FI-04` now performs a valid PostgreSQL Trigger replacement from
  `AFTER UPDATE ROW` (`tgtype=17`) to `AFTER INSERT ROW` (`tgtype=5`) and
  independently requires both exact-type and event-mask findings;
- the OID, exact `tgtype`, and UPDATE OF assertion-removal variants are real
  source copies, differ from the canonical helper by one assertion block, were
  executed with the fault matrix, and each failed for its specific missing
  finding.

The retained evidence therefore supports:

```text
R25-P2-01: CLOSED
R25-P2-02: CLOSED
R21-P2-03: CLOSED WITH EXPLICIT OID-ONLY IN-MEMORY AND NARROWER-MIGRATION-POSTCHECK LIMITATIONS
```

The restrictions are material to future execution and reporting, but not to
the validity of the R26 observations:

- the destructive catalog fault runner logs its connected identity but does not
  fail closed if that identity differs from the intended R26 fault database;
- R26's printed SHA-256 for `web-tests-final.log` is malformed;
- R26's stated line count is the non-empty-line count rather than the physical
  line count, without stating that convention;
- the assertion-removal harness is bound to the current absolute workspace path
  and installed `tsx` path.

R27 recommends that CM1 Append Intent Relational Integrity proceed to stage
admission evaluation. This is not an approval of the complete file lifecycle,
Route C-Full, real Provider operation, Windows OS fencing, IAM/ACL isolation,
Web/Worker E2E, production Build/Startup Gate, or production deployment.

## 1. Review independence and limitations

This was a separate read-only review pass performed on the same Windows host
and workspace used for R26. It is not a separate execution host.

No PostgreSQL process was started or connected. No SQL, Migration, Vitest,
fault injection, Build, service, Provider, IAM/ACL, Git write or cleanup
operation was executed. Existing reports, logs, evidence, databases and user
worktree changes were not modified.

The two protected untracked entries `$null` and `UNKNOWN'` were not opened,
hashed, modified, moved or deleted. `apps/web/.next` and `apps/worker/dist`
were not accessed.

## 2. Live Git baseline

Initial state:

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:                  101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:             23
Staged:                       0
Deleted:                      0
Untracked status entries:     119
Untracked files, recursive:   125
```

The R26 historical final state was 119 default untracked entries and 125
untracked files. The live state matches that record before R27.

`git diff --check` completed with no whitespace errors. Git emitted only
existing line-ending conversion warnings for tracked worktree files.

R27 is the only file added by this review.

## 3. R26 report integrity

### 3.1 Requested full-file digest

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-r26-tgtype-and-assertion-removal-validation.md
SHA-256: 6CCAC83F2ACFAEA022B1D57EB367A094F156A45E19346C6C206BB346126BD954
```

This exactly matches the authorized R26 digest.

### 3.2 Size and self-excluding digest

```text
Bytes:                         13268
Physical lines:                616
Non-empty lines:               450
Self-excluding SHA-256:        B1DE584EB9A2F566E592988D687820FAFCF8C3A31CB0FEF206195B3068F3A2E2
```

The self-excluding digest was independently recomputed by replacing the final
64-hex digest token with 64 zero characters and hashing the UTF-8 bytes. It
matches R26.

The byte count matches. R26 says `Line count: 450`; 450 is the line count after
excluding 166 blank lines. The physical file has 616 lines.

### 3.3 Prior report immutability

```text
R25:
86F7CB03378EDAD862132D7CF8B9B5EC153BD6C0AF5B499162B02D4CA3E3FF85

R24:
1150A2361BBBE0355B6C7FAC525C9A8D8C2E01C4A82DA9C6BC00CFDAAA94838C
```

Both match the values carried by R25/R26.

### 3.4 One evidence-digest transcription error

R26 lists:

```text
92919B057BDF97A6F83212F62C60FFED830B9DDB14CB4820F912DA460DB87E5
  logs\web-tests-final.log
```

That listed value has 63 characters. The retained file's actual SHA-256 is:

```text
92919B057BDF97A6F83212F62C60FFED830B9DDB14CB482F0F912DA460DB87E5
```

The valid digest contains `...B482F0F...`; the listed value contains
`...B4820F...`, having lost the `F` after `482`. The log content and its
successful 39-file / 377-test result remain independently verifiable, so this
is a `P3` transcription defect rather than a false test result.

## 4. Source and evidence files inspected

Source:

```text
prisma/migrations/20261126150000_phase40_append_intent_finalization_hardening/migration.sql
prisma/migrations/20261126160000_phase41_append_scope_precheck/migration.sql
apps/web/tests/helpers/phase41-trigger-catalog.ts
apps/web/tests/helpers/postgres-identity.ts
apps/web/scripts/cm1-r24/phase41-catalog-faults.ts
apps/web/scripts/cm1-r26/run-assertion-removal.ts
apps/web/tests/integration/phase41-trigger-catalog.test.ts
apps/web/tests/catalog-fault-injection-evidence.test.ts
apps/web/tests/integration/phase40-append-intent-finalization.test.ts
apps/web/vitest.r26.config.ts
```

Historical reports:

```text
R21 independent evidence review
R22 targeted evidence completion
R23 independent evidence review
R24 catalog fault-injection correction
R25 independent evidence review
R26 tgtype and assertion-removal validation
```

Primary R26 evidence:

```text
D:\AI-Elevator-Advisor-CM1-R26\logs\migration-cm1_r26_catalog.log
D:\AI-Elevator-Advisor-CM1-R26\logs\migration-cm1_r26_catalog_fault.log
D:\AI-Elevator-Advisor-CM1-R26\logs\migration-checksums.log
D:\AI-Elevator-Advisor-CM1-R26\logs\r26-catalog-test-final.log
D:\AI-Elevator-Advisor-CM1-R26\logs\r26-catalog-faults-post-reverse.log
D:\AI-Elevator-Advisor-CM1-R26\logs\assertion-removal.log
D:\AI-Elevator-Advisor-CM1-R26\logs\r26-catalog-identity-failclosed.log
D:\AI-Elevator-Advisor-CM1-R26\logs\web-tests-final.log
D:\AI-Elevator-Advisor-CM1-R26\logs\typecheck-final.log
D:\AI-Elevator-Advisor-CM1-R26\logs\pg_ctl-stop.log
D:\AI-Elevator-Advisor-CM1-R26\evidence\server-identity.log
D:\AI-Elevator-Advisor-CM1-R26\evidence\roles-databases.log
D:\AI-Elevator-Advisor-CM1-R26\evidence\app-role-ddl-denial.log
D:\AI-Elevator-Advisor-CM1-R26\evidence\migration-harness-hashes.json
D:\AI-Elevator-Advisor-CM1-R26\evidence\assertion-removal\oid\
D:\AI-Elevator-Advisor-CM1-R26\evidence\assertion-removal\type\
D:\AI-Elevator-Advisor-CM1-R26\evidence\assertion-removal\update_columns\
```

Historical R21/R22 evidence reverified:

```text
D:\AI-Elevator-Advisor-CM1-R22\evidence\current-pointer-wins-postgres.log
D:\AI-Elevator-Advisor-CM1-R22\evidence\reservation-wins-postgres.log
D:\AI-Elevator-Advisor-CM1-R22\evidence\server-identity.log
D:\AI-Elevator-Advisor-CM1-R22\evidence\test-counts.json
D:\AI-Elevator-Advisor-CM1-R22\logs\v4v7-integration-test.log
D:\AI-Elevator-Advisor-CM1-R22\logs\v4v7-integration-test-retry1.log
D:\AI-Elevator-Advisor-CM1-R22\logs\v4v7-integration-test-final3.log
D:\AI-Elevator-Advisor-CM1-R22\logs\migration-checksums.log
```

## 5. A — `tgtype` event-bit fault

### 5.1 PostgreSQL bits

```text
ROW       = 1
BEFORE    = 2
INSERT    = 4
DELETE    = 8
UPDATE    = 16
TRUNCATE  = 32
INSTEAD   = 64
```

For row-level Triggers, `AFTER` is represented by the absence of both `BEFORE`
and `INSTEAD`.

The canonical expectation is defined at
`apps/web/tests/helpers/phase41-trigger-catalog.ts:61`:

```text
completion triggerType = 17
```

The phase-40 definition at
`prisma/migrations/20261126150000_phase40_append_intent_finalization_hardening/migration.sql:640`
is:

```sql
CREATE CONSTRAINT TRIGGER "p13_completed_intent_final_guard"
AFTER UPDATE ON "file_upload_intent"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_completed_intent_final"();
```

Therefore:

```text
17 = ROW(1) + UPDATE(16)
   = AFTER UPDATE FOR EACH ROW
```

### 5.2 Mutation

`apps/web/scripts/cm1-r24/phase41-catalog-faults.ts:230` defines
`R26-FI-04`, and lines 238-249 replace the Trigger with:

```sql
CREATE CONSTRAINT TRIGGER "p13_completed_intent_final_guard"
AFTER INSERT ON "file_upload_intent"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_completed_intent_final"();
```

This is a supported PostgreSQL DDL transaction. It preserves:

- relation `file_upload_intent`;
- function schema and name;
- function OID;
- enabled state;
- `AFTER`;
- `ROW`;
- constraint-trigger status;
- deferrability;
- initially-deferred status.

It changes the event set from UPDATE to INSERT:

```text
5 = ROW(1) + INSERT(4)
17 XOR 5 = 20 = UPDATE(16) + INSERT(4)
```

The retained PostgreSQL log reports:

```text
expected tgtype = 17
actual tgtype   = 5
expected update = true, actual update = false
expected insert = false, actual insert = true
before          = false
row             = true
```

The scenario requires both independent codes at
`apps/web/scripts/cm1-r24/phase41-catalog-faults.ts:234`:

```text
TRIGGER_TYPE_MISMATCH
TRIGGER_EVENT_MASK_MISMATCH
```

The validator implements them separately:

```text
apps/web/tests/helpers/phase41-trigger-catalog.ts:223
apps/web/tests/helpers/phase41-trigger-catalog.ts:254
```

Only those two findings were emitted. Because function name/OID, relation,
enabled, deferrable, initially-deferred and constraint-trigger fields were
unchanged, no collateral findings appeared.

The fault transaction throws the rollback marker after reading and validating
the mutated catalog row at
`apps/web/scripts/cm1-r24/phase41-catalog-faults.ts:66-82`. The runner validates
the baseline again after the rollback at line 112. The canonical run continued
through scenarios 05-07 and exited 0, proving `tgtype=17` was restored.

Verdict: `PASS`.

## 6. B — assertion-removal reverse tests

### 6.1 Harness behavior

`apps/web/scripts/cm1-r26/run-assertion-removal.ts`:

1. reads the canonical helper and fault runner at lines 27-34;
2. defines exactly three assertion blocks at lines 36-67;
3. rejects a missing or unchanged block at lines 78-84;
4. creates a unique temporary source directory at lines 86-91;
5. copies the fault runner and redirects only its helper import at lines
   102-105;
6. executes the variant with `tsx` at lines 111-131;
7. records the expected and unrelated-failure flags at lines 133-150;
8. retains source, log and metadata at lines 152-169;
9. requires exit code 1, the exact expected failure and no recognized
   unrelated failure at lines 171-179;
10. removes the temporary source directory in `finally` at lines 181-183.

The canonical helper SHA-256 is:

```text
AC350B7D0E782365C3458D7E69D9129963CF0E676CB235309279BEDD969BEDAF
```

### 6.2 OID assertion removal

Independent `git diff --no-index` comparison showed exactly this removed block
and no other source change:

```ts
compare(
  "TRIGGER_FUNCTION_OID_MISMATCH",
  actual.expectedFunctionOid,
  actual.triggerFunctionOid,
);
```

Variant SHA-256:

```text
6150921DDC90FA07FDC3389FD94A5AEE7CB6378A4BC02F50228284B3622B065A
```

The retained run first completed the wrong-function scenario, then failed at
the OID-only scenario:

```text
Error: EXPECTED_FINDING_MISSING code=TRIGGER_FUNCTION_OID_MISMATCH
EXIT_CODE=1
```

Metadata independently matches:

```text
expectedFailureObserved = true
unrelatedFailureObserved = false
```

The wrong-function scenario's collateral OID finding disappeared from its
`allFindings` after removal, proving the variant helper was active. The
OID-only mutation still existed in the copied fault runner.

Verdict: `PASS`.

### 6.3 Exact `tgtype` assertion removal

Independent comparison showed exactly this removed block:

```ts
compare(
  "TRIGGER_TYPE_MISMATCH",
  expected.triggerType,
  actual.triggerType,
);
```

Variant SHA-256:

```text
096D7F3E0D260DD16F0AA99C7DEE1B669753283D70E14106CC0985FCB544C4A5
```

The retained run completed scenarios 01-03 and failed at scenario 04:

```text
Error: EXPECTED_FINDING_MISSING code=TRIGGER_TYPE_MISMATCH
EXIT_CODE=1
```

The event-mask finding remained available, but the runner explicitly required
the exact-type code. Metadata records:

```text
expectedFailureObserved = true
unrelatedFailureObserved = false
```

Verdict: `PASS`.

### 6.4 UPDATE OF assertion removal

Independent comparison showed exactly this removed block:

```ts
compare(
  "TRIGGER_UPDATE_COLUMNS_MISMATCH",
  expected.updateColumns,
  actual.updateColumns,
);
```

Variant SHA-256:

```text
CE51A123EFC1C79E1A48C7050071E7B2A8A474435060C882FB4530E9A931C859
```

The retained run completed scenarios 01-02 and failed at scenario 03:

```text
Error: EXPECTED_FINDING_MISSING code=TRIGGER_UPDATE_COLUMNS_MISMATCH
EXIT_CODE=1
```

Metadata records:

```text
expectedFailureObserved = true
unrelatedFailureObserved = false
```

Verdict: `PASS`.

### 6.5 Variant isolation

All three retained fault-runner copies have the same SHA-256:

```text
8D04066E77190CB5B11EDBA491A5905F12D745D4B279175FA93FDBFB8BD85717
```

Their only difference from the canonical fault runner is:

```diff
-} from "../../tests/helpers/phase41-trigger-catalog.js";
+} from "./phase41-trigger-catalog.variant.js";
```

The cached canonical fault-runner digest is:

```text
685BFE74E37838894A6C9BD09FC07407CAEAB12A9104190D701B782B3C52704A
```

All three variant helper and fault-runner hashes match their metadata. Each
`run.log` contains its exact expected missing-finding failure. No log contains
`PrismaClientInitializationError`, `SyntaxError`, identity mismatch or a
different assertion failure.

No `.assertion-removal-*` temporary directories remain under:

```text
apps/web/scripts/cm1-r24/
apps/web/scripts/cm1-r26/
```

Verdict: `PASS`.

## 7. C — OID-only limitation

`apps/web/scripts/cm1-r24/phase41-catalog-faults.ts:115-179`:

- starts from `readTriggerCatalog(prisma)`, so the input is an actual catalog
  row;
- selects the real completion-guard row;
- constructs a cloned row and changes only `triggerFunctionOid`;
- checks that function schema, function name, relation and `tgtype` remain
  unchanged;
- passes the mutated row set through the same `validateTriggerCatalog()`;
- requires `TRIGGER_FUNCTION_OID_MISMATCH`;
- rejects any additional finding.

Retained result:

```text
expectedFunctionOid        = 20151
mutatedTriggerFunctionOid  = 20152
allFindings                = [TRIGGER_FUNCTION_OID_MISMATCH]
mutationKind               = IN_MEMORY_CATALOG_ROW
databaseMutation           = false
```

This is acceptable because it tests comparator logic over a real catalog row
while avoiding unsafe direct writes to PostgreSQL system catalogs. R26 labels
the boundary accurately.

It does not prove PostgreSQL accepts a corrupt `pg_trigger.tgfoid` write. It
does not cover catalog join behavior when `tgfoid` points to a missing
function. Those remain outside the OID-only case.

Verdict: `PASS WITH EXPLICIT LIMITATION`.

## 8. D — seven-scenario matrix

The canonical log contains seven records and exits 0:

| Scenario | Mutation | Evidence class | Required primary code | Result |
|---|---|---|---|---|
| `R26-FI-01` | wrong Trigger function | PostgreSQL DDL transaction | `TRIGGER_FUNCTION_MISMATCH` | PASS |
| `R26-FI-02` | only `triggerFunctionOid` changed on an actual catalog row | in-memory catalog row | `TRIGGER_FUNCTION_OID_MISMATCH` | PASS WITH LIMITATION |
| `R26-FI-03` | scope Trigger reduced to `UPDATE OF customerId` | PostgreSQL DDL transaction | `TRIGGER_UPDATE_COLUMNS_MISMATCH` | PASS |
| `R26-FI-04` | completion Trigger changed from AFTER UPDATE to AFTER INSERT | PostgreSQL DDL transaction | `TRIGGER_TYPE_MISMATCH` and event-mask | PASS |
| `R26-FI-05` | scope Trigger enabled only on replicas | PostgreSQL DDL transaction | `TRIGGER_ENABLED_MISMATCH` | PASS |
| `R26-FI-06` | scope Trigger installed on `project` | PostgreSQL DDL transaction | `TRIGGER_RELATION_MISMATCH` | PASS |
| `R26-FI-07` | completion guard changed to a non-deferrable regular Trigger | PostgreSQL DDL transaction | `TRIGGER_DEFERRABLE_MISMATCH` | PASS |

The scenarios are distinct. Some DDL mutations necessarily produce collateral
findings, such as OID/deferrability changes when replacing a constraint
Trigger. R26 requires the named primary finding; it does not count collateral
findings as additional scenarios.

Each scenario:

- asserts the canonical baseline before mutation;
- sets `mutationCompleted=true` only after the mutation finishes;
- reads the mutated catalog through the transaction client;
- validates it inside the transaction;
- throws the rollback marker;
- revalidates the baseline after rollback.

There is no `session_replication_role`, no `DISABLE TRIGGER`, and exactly one
`ENABLE REPLICA TRIGGER` mutation.

Verdict: `PASS`.

## 9. E — positive validation and isolation

### 9.1 PostgreSQL and migrations

Retained server identity:

```text
PostgreSQL 18.7
127.0.0.1:55442
data directory D:/AI-Elevator-Advisor-CM1-R26/pgdata
```

The repository has exactly 19 migration directories. The retained checksum
log has exactly the same 19 names, with no missing or extra names. Recomputing
all current `migration.sql` bytes yields 19/19 agreement with the retained
checksum evidence.

Both R26 databases report the complete chain as 19/19 applied.

Current Phase-40 and Phase-41 hashes remain:

```text
phase40:
6C6D857B735F7CA130C319ECBDABB2E1BE5D123023B101425D7EAAE9897AFAC6

phase41:
42170616E40BB8DB4F9E1970525CB167C0B7CCE7465460996AB2552EA4A746FE
```

They match R24, R25 and R26. Their filesystem modification times also precede
the R26 execution window.

### 9.2 Positive catalog test

The final catalog test reports:

```text
database = cm1_r26_catalog
role     = cm1_r26_app
host     = 127.0.0.1
port     = 55442
1 test passed
exit code 0
```

The actual catalog row confirms:

```text
completion function OID/tgfoid: 18267 / 18267
completion tgtype:              17
scope function OID/tgfoid:      18270 / 18270
scope tgtype:                   19
enabled:                        O / O
scope UPDATE OF columns:        six expected fields
legacy completion Trigger:      absent
```

The test asserts identity through the same `PrismaClient` used for the catalog
read at
`apps/web/tests/integration/phase41-trigger-catalog.test.ts:16-28`.

### 9.3 Identity mismatch

The retained negative run points at `cm1_r26_catalog_fault` while expecting
`cm1_r26_catalog`. It fails before the catalog test body:

```text
POSTGRES_IDENTITY_MISMATCH
1 test skipped
exit code 1
```

This supports fail-closed behavior for the catalog integration test. It does
not apply to the separate migrator fault runner addressed in finding
`R27-P2-01`.

### 9.4 Regression counts

```text
Copied checksum log:
migration rows 19, finished 19, matches 19, exit 0, SHA-256
FAB14757CDCA813B6A0508F7108D1DAA65E0A4EF95763DA051E8A48378BCF752

Catalog integration:
1 test passed, exit 0, SHA-256
7250B78D90EF720D947C5FC86C0227DAA8C63E8418CE3468106F058E5ACE4E27

Fault matrix:
7 scenarios, exit 0, SHA-256
B1FCEA6471A425225251F2A961C800F05E77E168BDA5400999633172CB2FC421

Assertion summaries:
3 expected failures, summary exit 0, SHA-256
02181469036206FE88386865ABC71E03001E734595BED40AD725A823D2B46E38

Web tests:
39 files / 377 tests passed, exit 0
actual file SHA-256:
92919B057BDF97A6F83212F62C60FFED830B9DDB14CB482F0F912DA460DB87E5

Typecheck:
8 workspace projects, exit 0, SHA-256
78550FF9F309A9295729A83B6207C9F105451863720242D3CE9345C92A6957B3
```

The Web log contains no failed, skipped or todo tests. The catalog negative
run is not counted as a pass.

### 9.5 Instance shutdown

Live R27 checks:

```text
Ports 55441 and 55442: FREE
R26 PostgreSQL processes: 0
R26 temporary assertion directories: 0
```

The retained stop log reports `server stopped` and exit 0.

Verdict: `PASS WITH P3 EVIDENCE-METADATA CORRECTIONS`.

## 10. F — historical finding disposition

### R21-P2-01 — real current-pointer/reservation competition

```text
CLOSED
```

The retained R22 PostgreSQL logs still match their recorded hashes:

```text
current-pointer-wins-postgres.log
B64B5F4D0DBE02964A98E27F141EA9817B7A83630FF320515BD1FD92E546C669

reservation-wins-postgres.log
D563458186EB572F90C4B56D6B17587C4641E0A054F2DC488A2AE8CD8E835932
```

They identify two distinct backend PIDs, transaction lock waits, SQLSTATE
`23514` from `p13_assert_append_reservation_snapshot()` in the first order, and
SQLSTATE `23505` on `one_active_append_intent_per_file` in the second order.
The final Vitest run passes 25/25 with exit 0.

The current source still asserts the R22 test identity before fixture loading
at
`apps/web/tests/integration/phase40-append-intent-finalization.test.ts:239-257`.
The negative identity log shows 25 tests skipped before mutation.

### R21-P2-02 — test database identity Fail-Closed

```text
CLOSED
```

The identity is queried through the same test `PrismaClient` before fixture
lookup. A deliberate mismatch produced `POSTGRES_IDENTITY_MISMATCH`, 25 skipped
tests and exit 1. The corrected run logged the expected database, role, host
and configured port and passed.

### R21-P2-03 — Trigger catalog and fault matrix

```text
CLOSED WITH EXPLICIT LIMITATIONS
```

Closed portions:

- baseline function schema/name/OID and `tgfoid` agree;
- exact completion and scope `tgtype` values are checked;
- `tgenabled='O'`, relation, deferrability, initially-deferred and
  constraint-Trigger fields are checked;
- the six-field UPDATE OF matrix is checked;
- the legacy completion Trigger must be absent;
- six real PostgreSQL DDL mutations and one disclosed in-memory OID-only case
  each require their specific finding;
- OID, exact-type and UPDATE-column assertions have executable negative
  controls.

Retained limitations:

- the corrupt `pg_trigger.tgfoid` relation is not produced by a database write;
- the Phase-40/41 Migration postchecks are narrower than the independent
  catalog test.

Phase-40's postcheck at
`prisma/migrations/20261126150000_phase40_append_intent_finalization_hardening/migration.sql:763`
uses bit-mask checks `(tgtype & 17)=17` and `(tgtype & 19)=19`. Phase-41's
postcheck at
`prisma/migrations/20261126160000_phase41_append_scope_precheck/migration.sql:165`
checks relation, enabled, deferrability and initially-deferred state, but not
function OID, exact `tgtype`, full event mask or the UPDATE OF column set.

The independent catalog integration test is therefore a required companion to
Migration execution and must not be described as a property already enforced
inside the Migration postcheck.

### R21-P3-01 — test accounting

```text
CLOSED
```

The retained count file records:

```text
Database-backed: 23
Static-only:      2
Total:           25
```

The final log reports `Test Files 2 passed` and `Tests 25 passed`; skipped and
negative runs are separately retained and not counted as final passes.

### R21-P3-02 — Migration checksums

```text
CLOSED
```

The R22 and R26 checksum logs match byte-for-byte, 19/19 database checksums
match exact Migration SQL SHA-256 values, and the current repository names and
file hashes still match all 19 entries.

### R21-P3-03 — retained database identity

```text
CLOSED
```

The R22 positive identity evidence reports PostgreSQL 18.7, the dedicated R22
data directory and port 55440, and its retained SHA-256 matches the R22 report:

```text
90E96C7D591ECA26A585D0CE93CFFDB9DFBAE37648CAFDE97B559093B0A8C1D8
```

The stale R20 identity file is not used as positive evidence.

## 11. New findings

### R27-P2-01 — destructive fault runner does not fail closed on connected identity

Severity: `P2`, evidence/test-infrastructure safety.

Location:

```text
apps/web/scripts/cm1-r24/phase41-catalog-faults.ts:326-348
```

The runner queries and prints `current_database()`, `current_user`,
`inet_server_addr()` and `inet_server_port()`, but does not compare them with
an expected R26 fault identity before executing DROP/CREATE/ALTER Trigger
statements.

The current R26 evidence is valid because the retained fault log identifies:

```text
database = cm1_r26_catalog_fault
role     = cm1_r26_migrator
host     = 127.0.0.1
port     = 55442
```

However, a future rerun with a mistakenly configured
`CM1_R26_MIGRATOR_DATABASE_URL` could apply destructive DDL to another
database. The assertion-removal harness inherits the same runner.

Minimal correction before any future execution:

- define the expected R26 fault database, role, host and port;
- query identity through the same `PrismaClient` before the first mutation;
- call the existing identity assertion or equivalent local check;
- exit nonzero before any DDL if identity differs;
- record the expected and actual identity in the run log.

This finding does not reopen R21-P2-03 or invalidate the retained R26 run.

### R27-P3-01 — Web-test evidence digest is malformed in R26

Severity: `P3`, evidence transcription.

Location:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-r26-tgtype-and-assertion-removal-validation.md:543
```

The displayed digest has 63 characters. The retained file has the valid
64-character digest shown in section 3.4. The underlying test result is not
affected.

Minimal correction:

- correct the digest transcription in a future controlled report or evidence
  index;
- add a report-validation check that every claimed SHA-256 has exactly 64
  hexadecimal characters and matches the target file.

### R27-P3-02 — line-count convention is not disclosed

Severity: `P3`, report metadata clarity.

Location:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-r26-tgtype-and-assertion-removal-validation.md:615
```

R26 reports 450 lines. The file has 450 non-empty lines and 616 physical lines
with 166 blank lines. The number is reproducible only under the unstated
non-empty-line convention.

Minimal correction:

- label future values as `physical lines` or `non-empty lines`;
- preferably report both when blank lines are present.

### R27-P3-03 — assertion-removal harness is workstation-path-bound

Severity: `P3`, reproducibility.

Location:

```text
apps/web/scripts/cm1-r26/run-assertion-removal.ts:12-25
```

The harness hard-codes `D:\thinkbook\Desktop\jieya` and a concrete pnpm store
path for `tsx@4.23.15`. It ran successfully in this workspace, but it is not
directly repeatable from another checkout or installation layout without source
edits.

Minimal correction:

- derive the repository root from `import.meta.dirname` or the workspace
  package root;
- invoke the package-manager-provided `tsx` command or resolve it from the
  repository;
- keep evidence location overridable through the existing environment variable.

### R27-P3-04 — app-role denial evidence does not emit SQLSTATE

Severity: `P3`, evidence completeness.

Location:

```text
D:\AI-Elevator-Advisor-CM1-R26\evidence\app-role-ddl-denial.log
```

The log clearly shows:

```text
ERROR: permission denied for schema public
EXIT_CODE=1
```

It does not print explicitly:

```text
SQLSTATE 42501
```

`42501` is the correct PostgreSQL SQLSTATE for this message, but R26 should
either retain verbose SQLSTATE output or label it as inferred from the error
message. This does not affect R21-P2-03.

## 12. NOT VERIFIED / retained limitations

The following remain `NOT VERIFIED` or `BLOCKED`:

- a manually corrupted `pg_trigger.tgfoid` database state;
- full Phase-40/Phase-41 Migration-internal catalog equality;
- a fault runner identity Fail-Closed run for the destructive matrix;
- PostgreSQL process activity during R27, because R27 did not connect or start
  the instance;
- real Provider integration;
- Windows OS-level storage fencing;
- production IAM/ACL and independent database roles;
- real Web/Worker PostgreSQL E2E and service restart behavior;
- real COMMIT-response-loss recovery through the actual Web/Worker entry points;
- Build and production Startup Gate for this complete worktree;
- production Migration and deployment;
- `P2-05`;
- R5's 57 open decisions;
- BV7, which remains `FAIL`;
- BV8, which remains unapproved;
- historical R8, which remains `BLOCKED`;
- binding-parent-chain duplicate coverage;
- orphan FileVersion coverage;
- multiple-FileVersion terminal-state matrix;
- real drain and legacy artifact retirement.

These limitations do not reopen the verified R26 catalog assertions, but they
prevent any product-wide or production-readiness conclusion.

## 13. Admission effect

```text
R25-P2-01:                         CLOSED
R25-P2-02:                         CLOSED
R21-P2-01:                         CLOSED
R21-P2-02:                         CLOSED
R21-P2-03:                         CLOSED WITH EXPLICIT LIMITATIONS
R21-P3-01:                         CLOSED
R21-P3-02:                         CLOSED
R21-P3-03:                         CLOSED
```

CM1 Append Intent Relational Integrity may proceed to a stage-admission
evaluation. Before any future destructive catalog rerun,
`R27-P2-01` must be corrected. The P3 corrections should be applied in the next
controlled reporting or harness-maintenance batch, but they do not invalidate
the retained R26 evidence.

## 14. Git state after review

After adding only this report:

```text
Branch:                       codex/public-github-sync
HEAD:                         101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:                  101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:             23
Staged:                       0
Deleted:                      0
Untracked status entries:     120
Untracked files, recursive:   126
```

No staged change, deletion, source edit, existing-report edit, evidence edit or
Git write was performed.

## 15. Report digest, bytes and lines

```text
Self-excluding SHA-256:
D2D6CF00B7EE05C79CE496BE4812774D4684A015D4A4DF99C9E1F489B8AEAE06

Bytes:       30355
Physical lines: 0999
```

The self-excluding digest is computed by replacing the 64-zero digest token
above with 64 zero characters before hashing the UTF-8 file. This follows the
retained-report convention used by R22-R26.
