# WP-2A-CM1 R26 `tgtype` and Assertion-Removal Validation

## 0. Final conclusion

```text
PASS WITH RESTRICTIONS — R25 EVIDENCE GAPS CLOSED WITH EXPLICIT LIMITATIONS
```

R26 closes the two R25 evidence gaps:

- `R26-FI-04` now removes the expected UPDATE event bit using a valid
  PostgreSQL DDL mutation;
- OID, exact `tgtype`, and UPDATE OF assertion-removal variants are generated
  as temporary source copies, actually executed, and retained as failing
  evidence.

R21-P2-03 can be closed with the previously disclosed OID-only in-memory
limitation.

The restrictions remain:

- OID-only fault is based on an actual catalog row but changes only
  `triggerFunctionOid` in memory, not `pg_trigger`;
- phase-41 Migration itself remains narrower than the independent catalog
  test;
- production Provider, Windows fencing, IAM/ACL, E2E and deployment remain
  unverified.

## 1. Git baseline

Before changes:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      117
Untracked files:        123
```

R24 and R25 reports and evidence were not modified.

R25 report hash:

```text
86F7CB03378EDAD862132D7CF8B9B5EC153BD6C0AF5B499162B02D4CA3E3FF85
```

R24 report hash:

```text
1150A2361BBBE0355B6C7FAC525C9A8D8C2E01C4A82DA9C6BC00CFDAAA94838C
```

## 2. R25 gap mapping

| R25 finding | R26 correction |
|---|---|
| R25-P2-01 `17 -> 19` adds BEFORE; it is not bit reduction | Replaced with valid `AFTER INSERT ROW` constraint trigger, `tgtype=5` |
| R25-P2-02 assertion-removal not actually executed | Three temporary variants generated and executed; each failed for its specific missing finding |

## 3. Isolated PostgreSQL instance

```text
Root:             D:\AI-Elevator-Advisor-CM1-R26
Data:             D:\AI-Elevator-Advisor-CM1-R26\pgdata
Evidence:         D:\AI-Elevator-Advisor-CM1-R26\evidence
Logs:             D:\AI-Elevator-Advisor-CM1-R26\logs
Host:             127.0.0.1
Port:             55442
PostgreSQL:       18.7
Admin role:       cm1_r26_admin
Migration role:   cm1_r26_migrator
App role:         cm1_r26_app
```

Databases:

```text
cm1_r26_catalog
cm1_r26_catalog_fault
```

Roles:

```text
cm1_r26_migrator:
  LOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE

cm1_r26_app:
  LOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE
```

App role DDL attempt:

```text
CREATE TABLE public.r26_should_not_exist(...)
SQLSTATE 42501
permission denied for schema public
```

## 4. Migration baseline

Both databases executed the complete chain from empty schema:

```text
cm1_r26_catalog:       19/19
cm1_r26_catalog_fault: 19/19
```

The source/harness directory names and all 19 file hashes match.

Prisma metadata:

```text
migration rows:       19
finished:             19
missing:              0
checksums matching:   19
```

The checksum algorithm remains confirmed as exact SHA-256 of
`migration.sql` bytes.

Phase-40 and phase-41 files were not changed:

```text
phase40: 6C6D857B735F7CA130C319ECBDABB2E1BE5D123023B101425D7EAAE9897AFAC6
phase41: 42170616E40BB8DB4F9E1970525CB167C0B7CCE7465460996AB2552EA4A746FE
```

Evidence:

```text
D:\AI-Elevator-Advisor-CM1-R26\logs\migration-cm1_r26_catalog.log
D:\AI-Elevator-Advisor-CM1-R26\logs\migration-cm1_r26_catalog_fault.log
D:\AI-Elevator-Advisor-CM1-R26\logs\migration-checksums.log
D:\AI-Elevator-Advisor-CM1-R26\evidence\migration-harness-hashes.json
```

## 5. Corrected event-bit fault

### 5.1 Baseline

The completion guard baseline:

```text
Trigger:       p13_completed_intent_final_guard
Relation:      public.file_upload_intent
Function:      public.p13_assert_completed_intent_final
Function OID:  18267
tgfoid:        18267
tgtype:        17
enabled:       O
deferrable:    true
initially deferred: true
constraint trigger: true
```

Bit decode:

```text
17 = ROW(1) + UPDATE(16)
   = AFTER, ROW, UPDATE
```

### 5.2 Mutation

R26 replaces only the event/mode declaration:

```sql
CREATE CONSTRAINT TRIGGER "p13_completed_intent_final_guard"
AFTER INSERT ON "file_upload_intent"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_completed_intent_final"();
```

The mutation preserves relation, function schema/name/OID, enabled state,
ROW, AFTER, deferrability, initially-deferred state and constraint-trigger
status. It changes the event set from UPDATE to INSERT.

Observed:

```text
actual tgtype = 5
5 = ROW(1) + INSERT(4)
```

Compared with baseline:

```text
missing expected bit: UPDATE(16)
unexpected added bit: INSERT(4)
```

The test requires both:

```text
TRIGGER_TYPE_MISMATCH
TRIGGER_EVENT_MASK_MISMATCH
```

Observed findings:

```text
expected tgtype=17 actual=5
expected update=true actual update=false
expected insert=false actual insert=true
all other event/mode flags unchanged
```

The fault transaction rolls back and baseline `tgtype=17` is revalidated.

Scenario:

```text
R26-FI-04 missing_expected_event_bit
mutationKind = POSTGRESQL_DDL_TRANSACTION
```

Evidence:

```text
D:\AI-Elevator-Advisor-CM1-R26\logs\r26-catalog-faults-post-reverse.log
```

## 6. UPDATE OF column matrix

The expected ordered set remains:

```text
customerId
projectId
buildingId
installationUnitId
createdById
createdByUploadIntentId
```

`R26-FI-03` changes the scope Trigger to:

```sql
BEFORE UPDATE OF "customerId" ON "file"
```

Observed:

```text
expected = six fields
actual   = ["customerId"]
```

The validator compares the entire ordered string array. Exact `tgtype` and
UPDATE OF columns are separate checks.

## 7. Seven-scenario positive matrix

Final canonical source run:

```text
R26-FI-01 wrong_function
R26-FI-02 wrong_function_oid_only
R26-FI-03 reduced_update_columns
R26-FI-04 missing_expected_event_bit
R26-FI-05 replica_only_enabled
R26-FI-06 wrong_relation
R26-FI-07 completion_not_deferrable
```

All seven passed their required finding assertions.

Evidence class:

```text
six PostgreSQL DDL transactions
one in-memory actual-catalog-row OID mutation
```

Evidence:

```text
D:\AI-Elevator-Advisor-CM1-R26\logs\r26-catalog-faults-post-reverse.log
```

## 8. Assertion-removal reverse validation

Harness:

```text
apps/web/scripts/cm1-r26/run-assertion-removal.ts
```

For each variant it:

1. reads the canonical validator and fault runner;
2. creates a temporary source directory under the test scripts tree;
3. removes exactly one compare block from the validator copy;
4. copies the fault runner with only its helper import redirected;
5. runs the full fault matrix with `tsx`;
6. captures output and exit code;
7. rejects compilation, identity and other unrelated errors;
8. copies the variant source/log/metadata to retained evidence;
9. removes the temporary source directory.

### 8.1 OID assertion removal

Canonical helper SHA-256:

```text
AC350B7D0E782365C3458D7E69D9129963CF0E676CB235309279BEDD969BEDAF
```

Variant helper SHA-256:

```text
6150921DDC90FA07FDC3389FD94A5AEE7CB6378A4BC02F50228284B3622B065A
```

Removed exactly:

```text
compare(
  "TRIGGER_FUNCTION_OID_MISMATCH",
  actual.expectedFunctionOid,
  actual.triggerFunctionOid,
)
```

Result:

```text
exit code 1
EXPECTED_FINDING_MISSING code=TRIGGER_FUNCTION_OID_MISMATCH
unrelatedFailureObserved=false
```

### 8.2 exact `tgtype` assertion removal

Variant helper SHA-256:

```text
096D7F3E0D260DD16F0AA99C7DEE1B669753283D70E14106CC0985FCB544C4A5
```

Removed exactly:

```text
compare(
  "TRIGGER_TYPE_MISMATCH",
  expected.triggerType,
  actual.triggerType,
)
```

Result:

```text
exit code 1
EXPECTED_FINDING_MISSING code=TRIGGER_TYPE_MISMATCH
unrelatedFailureObserved=false
```

The event-mask finding remained available but did not satisfy the required
exact type finding.

### 8.3 UPDATE OF assertion removal

Variant helper SHA-256:

```text
CE51A123EFC1C79E1A48C7050071E7B2A8A474435060C882FB4530E9A931C859
```

Removed exactly:

```text
compare(
  "TRIGGER_UPDATE_COLUMNS_MISMATCH",
  expected.updateColumns,
  actual.updateColumns,
)
```

Result:

```text
exit code 1
EXPECTED_FINDING_MISSING code=TRIGGER_UPDATE_COLUMNS_MISMATCH
unrelatedFailureObserved=false
```

### 8.4 Cleanup

Final temporary variant directories in the scripts tree:

```text
0
```

Retained evidence includes each variant source, run log and metadata:

```text
D:\AI-Elevator-Advisor-CM1-R26\evidence\assertion-removal\
  oid\
  type\
  update_columns\
```

## 9. Identity and catalog test

Positive identity:

```text
cm1_r26_catalog
cm1_r26_app
127.0.0.1
55442
```

Catalog baseline:

```text
completion function OID: 18267
scope function OID:      18270
completion tgtype:       17
scope tgtype:            19
enabled:                 O / O
legacy Trigger:          absent
```

Identity Fail-Closed:

```text
intentional database: cm1_r26_catalog_fault
result: POSTGRES_IDENTITY_MISMATCH
catalog test skipped
exit code 1
```

Final positive catalog test:

```text
1 file passed
1 test passed
```

Evidence:

```text
D:\AI-Elevator-Advisor-CM1-R26\logs\r26-catalog-test-final.log
D:\AI-Elevator-Advisor-CM1-R26\logs\r26-catalog-identity-failclosed.log
```

## 10. Regression results

```text
Fault scenarios:        7/7 passed
Assertion removal:      3/3 expected failures
Catalog integration:    1/1 passed
Web tests:              39 files / 377 tests passed
Typecheck:              all 8 applicable projects passed
```

The static evidence test now also verifies:

- seven R26 scenario IDs;
- OID mutation isolation;
- `AFTER INSERT` bit-removal mutation;
- temporary cleanup;
- only one replica fault mutation;
- no `session_replication_role`.

## 11. Source changes

Modified:

```text
apps/web/scripts/cm1-r24/phase41-catalog-faults.ts
apps/web/tests/catalog-fault-injection-evidence.test.ts
apps/web/tests/helpers/postgres-identity.ts
apps/web/tests/integration/phase41-trigger-catalog.test.ts
```

Added:

```text
apps/web/scripts/cm1-r26/run-assertion-removal.ts
apps/web/vitest.r26.config.ts
```

No Migration, Prisma Schema, business service, Provider, IAM/ACL or deployment
source was modified.

## 12. Limitations

- OID-only case remains an in-memory single-field catalog-row mutation;
- phase-41 Migration itself remains narrower than the independent catalog
  test;
- real Provider, Windows OS fencing, production IAM/ACL, Web/Worker E2E,
  Build, Startup Gate and deployment remain unverified;
- P2-05, R5 57 decisions, BV7, BV8 and historical R8 remain unresolved;
- Binding-parent-chain, orphan FileVersion and multiple terminal matrix remain
  outside this round.

## 13. Instance shutdown

```text
pg_ctl stop -m fast: server stopped
R26 processes: 0
Port 55442: FREE
Port 55441: FREE
Data/logs/evidence: retained
```

## 14. Evidence hashes

```text
428438A71E00CD6527D819932842979628C331AED8C3E27DC30480155A747AE5
  logs\migration-cm1_r26_catalog.log

FEFF9D0248EC0D29400BD8BA2B3009DD2827D8B0C788A948D5FFDF68462FBE91
  logs\migration-cm1_r26_catalog_fault.log

FAB14757CDCA813B6A0508F7108D1DAA65E0A4EF95763DA051E8A48378BCF752
  logs\migration-checksums.log

7250B78D90EF720D947C5FC86C0227DAA8C63E8418CE3468106F058E5ACE4E27
  logs\r26-catalog-test-final.log

B1FCEA6471A425225251F2A961C800F05E77E168BDA5400999633172CB2FC421
  logs\r26-catalog-faults-post-reverse.log

02181469036206FE88386865ABC71E03001E734595BED40AD725A823D2B46E38
  logs\assertion-removal.log

850F9DA6493685024A49ECB90954B6ED874DCE374C3A9864385679D716CB4A5B
  logs\r26-catalog-identity-failclosed.log

92919B057BDF97A6F83212F62C60FFED830B9DDB14CB4820F912DA460DB87E5
  logs\web-tests-final.log

78550FF9F309A9295729A83B6207C9F105451863720242D3CE9345C92A6957B3
  logs\typecheck-final.log

179DA4716595BFB0399FA327A8E565932162D12F736889C31A759EB26BBD9E75
  logs\pg_ctl-stop.log

EA7D6D8188198AF4BF4F0CB6781685DF9798580B81A784B67FD319C0FAB4B4BC
  evidence\server-identity.log
```

Assertion-removal evidence hashes:

```text
61525AA2F73914870F4348FF5D139B833EB88D0890FB415FD7AE07A36CA3F0D1
  evidence\assertion-removal\oid\run.log

D4BA68113301331BB75CB4C9365574E5E631A1B4C0C31D17EC2AD7303A810AD9
  evidence\assertion-removal\type\run.log

1E83BD3BC66B093C7B6AB826C5787E9F4381D89CBEB1BA9BD596CC71CC6053E6
  evidence\assertion-removal\update_columns\run.log
```

All relative paths are under:

```text
D:\AI-Elevator-Advisor-CM1-R26\
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
Untracked entries:      118
Untracked files:        124
```

After report:

```text
Untracked entries:      119
Untracked files:        125
```

## 16. R21-P2-03 disposition

```text
R21-P2-03: CLOSED WITH EXPLICIT OID-ONLY IN-MEMORY LIMITATION
```

The corrected event-bit DDL, strict required-finding assertions and actual
assertion-removal failures satisfy the R25 evidence requirements.

## 17. Report hash, bytes and lines

Final report SHA-256 (hash line canonicalized to 64 zero bytes):

```text
B1DE584EB9A2F566E592988D687820FAFCF8C3A31CB0FEF206195B3068F3A2E2
```

Byte count: `13268`

Line count: `450`
