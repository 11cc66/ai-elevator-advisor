# WP-2A-CM1 R24 Catalog Fault-Injection Evidence Correction and Isolated Revalidation

## 0. Final conclusion

```text
PASS WITH RESTRICTIONS — R23 CATALOG EVIDENCE GAP CLOSED WITH EXPLICIT LIMITATIONS
```

R24 closes the R23-P2-01 catalog fault-matrix gap:

- seven fault scenarios have distinct IDs, mutations and required finding codes;
- wrong function and wrong OID are separate scenarios;
- UPDATE OF column reduction and `tgtype` event-bit reduction are separate;
- the existing five cases plus the two new cases execute independently;
- every scenario requires its expected finding; absence causes failure;
- all PostgreSQL DDL faults execute in an isolated fault database and roll
  back before baseline validation.

R21-P2-03 now has sufficient evidence to be closed for the current isolated
validation scope.

One explicit restriction remains:

```text
OID-only fault is an IN_MEMORY_CATALOG_ROW mutation over an actual catalog
row. It is not a PostgreSQL catalog write.
```

PostgreSQL does not allow declared arguments on Trigger functions, so a
safe real-DDL construction with the same trigger relation, function schema,
function name and exact event mode but only a different `tgfoid` is not
available. R24 records that actual server error rather than fabricating a
database event.

The phase-41 Migration itself was not modified and remains narrower than the
independent catalog integration test.

## 1. Baseline and evidence preservation

Initial Git state:

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

R20, R20-C1, R21, R22 and R23 reports/evidence were not modified.

R23 report:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-independent-review-r23.md
SHA-256 64C57A49F1804D5179F615AFD40237CEF532CBDB3A04FFC99C74B71BED7C06A2
19,568 bytes
483 lines
```

R22 report:

```text
SHA-256 5F89BAE48B9BF352A7825380FBD0AEEF213E630B38B1CFD1B5A2F0FCF0364AEE
```

## 2. R23 gaps addressed

| R23 finding | R24 correction |
|---|---|
| P2-01 wrong function and wrong OID were not independently enforced | Seven scenario matrix; OID-only scenario requires `TRIGGER_FUNCTION_OID_MISMATCH` |
| P2-01 UPDATE OF columns and event bits were conflated | Separate `R24-FI-03` and `R24-FI-04` |
| P3-01 report said six injections but only five mutations existed | Seven distinct scenario IDs and seven executed logs |
| P3-02 Scenario B rollback lacked direct lifecycle queries | Out of scope for R24; remains disclosed |
| P3-03 checksum helper’s missing-file calculation was weak | R24 independently compares source/harness directory sets; helper unchanged |

## 3. Isolated PostgreSQL environment

```text
Root:             D:\AI-Elevator-Advisor-CM1-R24
Data directory:   D:\AI-Elevator-Advisor-CM1-R24\pgdata
Evidence:         D:\AI-Elevator-Advisor-CM1-R24\evidence
Logs:             D:\AI-Elevator-Advisor-CM1-R24\logs
Host:             127.0.0.1
Port:             55441
PostgreSQL:       18.7
Admin role:       cm1_r24_admin
Migration role:   cm1_r24_migrator
App test role:    cm1_r24_app
```

Roles:

```text
cm1_r24_migrator:
  LOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE

cm1_r24_app:
  LOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE
```

Databases:

```text
cm1_r24_migration
cm1_r24_catalog
cm1_r24_catalog_fault
```

App role DDL attempt:

```text
CREATE TABLE public.r24_should_not_exist(...)
SQLSTATE 42501
permission denied for schema public
```

Evidence:

```text
D:\AI-Elevator-Advisor-CM1-R24\evidence\server-identity.log
D:\AI-Elevator-Advisor-CM1-R24\evidence\roles-databases.log
D:\AI-Elevator-Advisor-CM1-R24\evidence\app-role-ddl-denial.log
```

## 4. Migration execution

The R24 harness copies the current Schema and all 19 Migration files. Source
and harness directory sets and per-file SHA-256 values are identical.

Execution:

```text
cm1_r24_migration:      19/19 up to date
cm1_r24_catalog:        19/19 up to date
cm1_r24_catalog_fault:  19/19 up to date
```

`_prisma_migrations` checksum audit:

```text
rows:                  19
finished:              19
missing:               0
checksums matching:    19
```

The Prisma checksum remains confirmed as lowercase SHA-256 of exact
`migration.sql` bytes.

Phase-40 and phase-41 file hashes remain:

```text
phase40: 6C6D857B735F7CA130C319ECBDABB2E1BE5D123023B101425D7EAAE9897AFAC6
phase41: 42170616E40BB8DB4F9E1970525CB167C0B7CCE7465460996AB2552EA4A746FE
```

Evidence:

```text
D:\AI-Elevator-Advisor-CM1-R24\logs\migration-cm1_r24_migration.log
D:\AI-Elevator-Advisor-CM1-R24\logs\migration-cm1_r24_catalog.log
D:\AI-Elevator-Advisor-CM1-R24\logs\migration-cm1_r24_catalog_fault.log
D:\AI-Elevator-Advisor-CM1-R24\logs\migration-checksums.log
D:\AI-Elevator-Advisor-CM1-R24\evidence\migration-harness-hashes.json
```

## 5. Catalog baseline

Database identity:

```text
cm1_r24_catalog
cm1_r24_app
127.0.0.1
55441
```

Verified Trigger catalog:

| Property | Completion guard | Scope guard |
|---|---|---|
| Relation | `public.file_upload_intent` | `public.file` |
| Function | `public.p13_assert_completed_intent_final` | `public.p13_protect_file_provenance_scope` |
| Function OID | 20153 | 20156 |
| `tgfoid` | 20153 | 20156 |
| `tgtype` | 17 | 19 |
| Mode | AFTER UPDATE ROW | BEFORE UPDATE ROW |
| `tgenabled` | O | O |
| Deferrable / initially deferred | true / true | false / false |
| Constraint Trigger | true | false |
| UPDATE OF columns | none | exact six columns |

The six scope columns:

```text
customerId
projectId
buildingId
installationUnitId
createdById
createdByUploadIntentId
```

Old `p13_completed_append_current_guard` is absent.

Catalog test:

```text
1 file passed
1 test passed
```

Evidence:

```text
D:\AI-Elevator-Advisor-CM1-R24\logs\r24-catalog-test-final.log
```

## 6. Seven independent fault scenarios

### R24-FI-01 — wrong function

Mutation kind: PostgreSQL DDL transaction.

Mutation:

- replace completion Trigger binding with
  `p13_r24_wrong_trigger`.

Required finding:

```text
TRIGGER_FUNCTION_MISMATCH
```

Observed:

```text
expected function = p13_assert_completed_intent_final
actual function   = p13_r24_wrong_trigger
```

Rollback: baseline revalidated.

### R24-FI-02 — wrong function OID only

Mutation kind: `IN_MEMORY_CATALOG_ROW`.

The mutation is over an actual catalog row and changes only:

```text
triggerFunctionOid
```

It explicitly asserts that function schema, function name, relation and
`tgtype` remain unchanged.

Required finding:

```text
TRIGGER_FUNCTION_OID_MISMATCH
```

Observed:

```text
expected OID = 22037
actual OID   = 22038
all findings = only TRIGGER_FUNCTION_OID_MISMATCH
```

### R24-FI-03 — UPDATE OF column set reduced

Mutation kind: PostgreSQL DDL transaction.

Mutation:

- scope Trigger changed from six-column `BEFORE UPDATE OF` to only
  `customerId`.

Required finding:

```text
TRIGGER_UPDATE_COLUMNS_MISMATCH
```

Observed exact arrays:

```text
expected = six File provenance columns
actual   = ["customerId"]
```

This scenario does not rely on `tgtype` mismatch.

### R24-FI-04 — `tgtype` event bits reduced

Mutation kind: PostgreSQL DDL transaction.

Mutation:

- completion guard changed from AFTER UPDATE to BEFORE UPDATE;
- same relation, same function schema/name, same function OID;
- UPDATE OF columns are not involved.

Required finding:

```text
TRIGGER_TYPE_MISMATCH
```

Observed:

```text
expected tgtype = 17
actual tgtype   = 19
event-mask finding = actual BEFORE=true, expected BEFORE=false
```

The scenario requires `TRIGGER_TYPE_MISMATCH` specifically; the additional
event-mask finding does not substitute for it.

### R24-FI-05 — replica-only enabled state

Mutation kind: PostgreSQL DDL transaction.

Mutation:

```text
ALTER TABLE file ENABLE REPLICA TRIGGER
  p13_file_provenance_scope_immutable
```

Required finding:

```text
TRIGGER_ENABLED_MISMATCH
```

Observed: expected `O`, actual `R`.

### R24-FI-06 — wrong relation

Mutation kind: PostgreSQL DDL transaction.

Mutation:

- move same-named scope Trigger to `project`.

Required finding:

```text
TRIGGER_RELATION_MISMATCH
```

Observed: expected `file`, actual `project`.

### R24-FI-07 — completion Trigger not deferrable

Mutation kind: PostgreSQL DDL transaction.

Mutation:

- recreate completion Trigger as a regular `AFTER UPDATE` Trigger.

Required finding:

```text
TRIGGER_DEFERRABLE_MISMATCH
```

Observed:

```text
expected deferrable = true
actual deferrable   = false
```

### 6.1 Seven-scenario evidence

The final fault log contains seven distinct `r24.catalog_fault` records:

```text
R24-FI-01 wrong_function
R24-FI-02 wrong_function_oid_only
R24-FI-03 reduced_update_columns
R24-FI-04 tgtype_event_bits_reduced
R24-FI-05 replica_only_enabled
R24-FI-06 wrong_relation
R24-FI-07 completion_not_deferrable
```

Each record contains:

- scenario ID;
- mutation kind;
- expected finding code;
- actual finding;
- all findings;
- reverse-dependency information.

The five PostgreSQL DDL scenarios execute inside transactions, roll back, and
revalidate baseline before continuing.

## 7. OID mechanism limitation

R24 attempted a real DDL OID-only construction using a same-name overloaded
Trigger function with a declared argument.

PostgreSQL returned:

```text
ERROR: trigger functions cannot have declared arguments
HINT: The arguments of the trigger can be accessed through TG_NARGS and TG_ARGV
```

Therefore a real-DDL Trigger binding that preserves the exact zero-argument
function schema/name while changing only `tgfoid` cannot be constructed
without directly mutating PostgreSQL system catalogs, which R24 did not do.

R24 uses the actual catalog row and changes only its `triggerFunctionOid`
field in memory. The log explicitly records:

```text
mutationKind = IN_MEMORY_CATALOG_ROW
databaseMutation = false
```

No claim is made that PostgreSQL accepted a wrong `tgfoid` write.

This is the explicit restriction on the final conclusion.

## 8. Reverse dependency

`runDatabaseFault` and the OID-only scenario obtain their findings and call:

```text
requireExpectedFinding(findings, expectedCode)
```

The function throws before a scenario can pass when the expected finding is
absent. Thus:

- removing OID detection causes R24-FI-02 to fail;
- removing UPDATE OF column detection causes R24-FI-03 to fail;
- removing exact `tgtype` detection causes R24-FI-04 to fail because the
  required `TRIGGER_TYPE_MISMATCH` is absent even if collateral findings
  remain;
- each other scenario similarly requires its own exact code.

The fault log records the remaining finding codes after excluding the required
code. R24-FI-02 and R24-FI-03 have no alternate finding that could satisfy
their assertions.

No source deletion was performed. The reverse validity is enforced by the
exact-code requirement and verified from the retained finding sets.

## 9. Test results

```text
R24 catalog PostgreSQL test:
  1 file passed
  1 test passed

R24 fault matrix:
  7 independent scenarios passed
  6 PostgreSQL DDL mutations
  1 in-memory OID-only mutation

Web regression:
  39 files passed
  375 tests passed

Typecheck:
  all 8 applicable workspace projects passed
```

The new static-only evidence test adds four cases:

```text
seven scenario IDs present
OID mutation isolated from name/schema
UPDATE OF and tgtype tests separate
no Trigger disable or session_replication_role bypass
```

Evidence:

```text
D:\AI-Elevator-Advisor-CM1-R24\logs\r24-catalog-test-final.log
D:\AI-Elevator-Advisor-CM1-R24\logs\r24-catalog-faults.log
D:\AI-Elevator-Advisor-CM1-R24\logs\web-tests-retry.log
D:\AI-Elevator-Advisor-CM1-R24\logs\typecheck-final.log
```

## 10. Identity Fail-Closed

Positive catalog test identity:

```text
expected = actual = cm1_r24_catalog / cm1_r24_app /
                    127.0.0.1 / 55441
```

Negative identity run intentionally pointed at:

```text
cm1_r24_catalog_fault
```

Result:

```text
POSTGRES_IDENTITY_MISMATCH
1 catalog test skipped
exit code 1
```

The catalog assertion query never ran.

Evidence:

```text
D:\AI-Elevator-Advisor-CM1-R24\logs\r24-catalog-test-final.log
D:\AI-Elevator-Advisor-CM1-R24\logs\r24-catalog-identity-failclosed.log
```

## 11. Source changes

New:

```text
apps/web/scripts/cm1-r24/phase41-catalog-faults.ts
apps/web/tests/catalog-fault-injection-evidence.test.ts
apps/web/vitest.r24.config.ts
```

Modified:

```text
apps/web/tests/helpers/postgres-identity.ts
apps/web/tests/integration/phase41-trigger-catalog.test.ts
```

No Migration, Prisma Schema, business service, Provider, IAM/ACL or deployment
source was modified.

## 12. Remaining limitations

- OID-only fault is an in-memory catalog-row mutation, not PostgreSQL DDL;
- phase-41 Migration postcheck itself remains narrower than the independent
  test;
- real Provider remains unverified;
- Windows OS-level fencing remains unverified;
- production IAM/ACL remains unverified;
- real Web/Worker E2E remains unverified;
- Build, Startup Gate and production deployment remain unverified;
- P2-05, R5 open decisions, BV7, BV8 and historical R8 remain unresolved;
- Binding-parent-chain, orphan FileVersion and multiple terminal matrix remain
  outside this round.

## 13. Instance shutdown

```text
pg_ctl -D D:\AI-Elevator-Advisor-CM1-R24\pgdata stop -m fast
server stopped
R24 processes: 0
Port 55441: FREE
Port 55440: FREE
Data/logs/evidence: retained
```

## 14. Evidence hashes

```text
0289F6CE8EA3B566A325F5FA3202D7A44CD777A456A24CD3A61A17F2496428D3
  logs\migration-cm1_r24_migration.log

BB45C3F9677C67EB6A6DA4B5DAC2C0E63BF4635F1EF828DD55E4030E88EE969D
  logs\migration-cm1_r24_catalog.log

EAD6F732B5C24D77EE43E816B1BD3B7BC3DAAACBCD800BF8027E2F805A29BDE9
  logs\migration-cm1_r24_catalog_fault.log

FAB14757CDCA813B6A0508F7108D1DAA65E0A4EF95763DA051E8A48378BCF752
  logs\migration-checksums.log

74A957EEEF5951AF80A552BAD47D653BA7A4BEF69C5FEC68C0590B96F9724368
  logs\r24-catalog-test-final.log

5CD2001A069B8B0C61F24519FCA924534F4B51282C52A28303D80E5B9E7AE0AF
  logs\r24-catalog-faults.log

FFAA3C44D4E385024361117937A65BE4C28770D7D4345BF6F3511D5C9037098B
  logs\r24-catalog-identity-failclosed.log

0165B79118F3062FC54A0667741DC613DDB2923FF7A94C6DCF9CC2321CB9FF32
  logs\web-tests-retry.log

04EC230535287A1F50A784B000D14AD5E77C37D1FD2D4DFA2B8DF1A040DBD7A3
  logs\typecheck-final.log

357580F879E635C1069605BF273C23C1CA66AA7E6F07E4119F78D2D4B8B05ADE
  evidence\server-identity.log

75C18E6010D4AF286C9D67F12101FE99D2EB62F83B58BC3BACA6466BCDF7F3F0
  evidence\oid-binding-probe.log
```

All relative evidence paths are under:

```text
D:\AI-Elevator-Advisor-CM1-R24\
```

## 15. Git state

Before report:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      114
Untracked files:        120
```

After report:

```text
Untracked entries:      115
Untracked files:        121
```

No commit, push, reset, restore, clean, checkout, stash or `git add` was used.

## 16. R21-P2-03 disposition

```text
R21-P2-03: CLOSED WITH EXPLICIT OID-FAULT LIMITATION
```

The seven scenarios are independently identifiable and individually required
by the fault runner. The OID-only evidence is transparently classified as an
in-memory catalog-row mutation because PostgreSQL cannot safely construct the
equivalent DDL fault.

## 17. Report hash, bytes and lines

Final report SHA-256 (hash line canonicalized to 64 zero bytes):

```text
A17936DBB8E801B790554CAD5C56CEA68E29C52B75991DCCA495F4BA40DFE21E
```

Byte count: `15908`

Line count: `474`
