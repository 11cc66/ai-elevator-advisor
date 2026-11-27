# WP-2A-CM1 Append Intent Relational Integrity Independent Review R25

## 0. Final conclusion

```text
PARTIAL — ADDITIONAL EVIDENCE REQUIRED
```

R24 materially improves the catalog evidence:

- seven distinct scenario IDs are present;
- OID-only comparison is exercised through the real validator;
- UPDATE OF and `tgtype` checks are separate code paths;
- six PostgreSQL DDL faults execute and roll back;
- PostgreSQL catalog baseline and identity Fail-Closed are valid;
- Migration and regression evidence is credible.

However, two R23 requirements remain incomplete:

1. `tgtype 17 -> 19` does not remove an event bit. It **adds the BEFORE mode
   bit** (`17 = ROW + UPDATE`, `19 = ROW + BEFORE + UPDATE`). R24 therefore
   verifies exact `tgtype` mismatch, but not the claimed event-bit reduction.
2. Reverse validity was inferred from control flow (`requireExpectedFinding`)
   rather than executed with temporary assertion-removal variants. No retained
   failure log proves that removing the OID, `tgtype` or UPDATE-column
   assertion causes the intended test failure.

R21-P2-03 remains `PARTIALLY CLOSED`.

## 1. Review environment and Git

This review was read-only and performed in the same local workspace/host as
R24. No PostgreSQL process was started or connected; no SQL, migration, test
or fault injection was executed.

Initial Git:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      115
Untracked files:        121
```

Port 55441 was free and no R24 PostgreSQL process was running.

## 2. R24 report integrity

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-r24-catalog-fault-injection-correction.md
SHA-256 1150A2361BBBE0355B6C7FAC525C9A8D8C2E01C4A82DA9C6BC00CFDAAA94838C
15,908 bytes
474 lines
```

The report's self-excluding hash also verifies:

```text
A17936DBB8E801B790554CAD5C56CEA68E29C52B75991DCCA495F4BA40DFE21E
```

All R24 evidence hashes listed in the report match the retained files.

## 3. A — seven fault scenarios

| Scenario | Mutation | Evidence class | Required code | R25 result |
|---|---|---|---|---|
| R24-FI-01 wrong function | wrong Trigger function | PostgreSQL DDL transaction | `TRIGGER_FUNCTION_MISMATCH` | PASS |
| R24-FI-02 wrong OID only | actual catalog row with only `triggerFunctionOid` changed | in-memory catalog row | `TRIGGER_FUNCTION_OID_MISMATCH` | PASS WITH LIMITATION |
| R24-FI-03 UPDATE OF columns | six columns reduced to `customerId` | PostgreSQL DDL transaction | `TRIGGER_UPDATE_COLUMNS_MISMATCH` | PASS |
| R24-FI-04 event mode | AFTER UPDATE changed to BEFORE UPDATE | PostgreSQL DDL transaction | `TRIGGER_TYPE_MISMATCH` | PARTIAL — exact mismatch yes, “bit reduction” no |
| R24-FI-05 replica only | `tgenabled` O -> R | PostgreSQL DDL transaction | `TRIGGER_ENABLED_MISMATCH` | PASS |
| R24-FI-06 wrong relation | `file` -> `project` | PostgreSQL DDL transaction | `TRIGGER_RELATION_MISMATCH` | PASS |
| R24-FI-07 non-deferrable | constraint Trigger -> regular Trigger | PostgreSQL DDL transaction | `TRIGGER_DEFERRABLE_MISMATCH` | PASS |

Source:

```text
apps/web/scripts/cm1-r24/phase41-catalog-faults.ts
```

Original execution:

```text
D:\AI-Elevator-Advisor-CM1-R24\logs\r24-catalog-faults.log
```

The log contains seven distinct `r24.catalog_fault` records with scenario IDs,
expected code, actual finding, all findings and rollback/baseline metadata.

### 3.1 Independence assessment

`R24-FI-04`, `R24-FI-01` and `R24-FI-07` produce multiple findings because
their DDL mutations necessarily change several catalog properties. R24 does
not count those collateral findings as separate scenarios; each scenario
requires one named primary finding. This avoids the R23 error of treating one
mutation’s multiple findings as independent scenarios.

The primary-coded assertion is therefore effective, although mutation
isolation is not complete for these DDL scenarios.

## 4. B — OID-only restriction

### 4.1 Real data source

`runOidCatalogRowFault()` starts from:

```text
readTriggerCatalog(prisma)
```

and selects the actual completion guard row. It does not hand-build an
unrelated object.

The mutation is:

```text
triggerFunctionOid = expectedFunctionOid + 1
```

The implementation asserts that function schema, function name, relation and
`tgtype` remain unchanged from the actual row.

### 4.2 Same validator path

The mutated row is passed into the same exported:

```text
validateTriggerCatalog
```

used by the catalog integration test. The OID comparison is:

```text
expectedFunctionOid vs triggerFunctionOid
```

and produces `TRIGGER_FUNCTION_OID_MISMATCH`.

Final OID evidence:

```text
baseline row:
  schema = public
  function = p13_assert_completed_intent_final
  expected OID = 22037

mutated row:
  only triggerFunctionOid = 22038
  all findings = [TRIGGER_FUNCTION_OID_MISMATCH]
```

This validates the comparator independently of function name/schema changes.

### 4.3 What is not proven

It does not prove that PostgreSQL accepts a corrupt `pg_trigger.tgfoid` write,
because R24 does not perform one.

The attempted DDL:

```text
CREATE FUNCTION public.p13_assert_completed_intent_final(text)
RETURNS trigger
```

failed with:

```text
ERROR: trigger functions cannot have declared arguments
```

That restriction is genuine and correctly retained.

R24 classifies the OID scenario as `IN_MEMORY_CATALOG_ROW` and
`databaseMutation=false`. This is accurate and acceptable for validator-logic
coverage.

Evidence:

```text
D:\AI-Elevator-Advisor-CM1-R24\evidence\oid-binding-probe.log
D:\AI-Elevator-Advisor-CM1-R24\logs\r24-catalog-faults.log
```

Verdict: `PASS WITH EXPLICIT LIMITATION`.

## 5. C — exact `tgtype` and event-bit semantics

PostgreSQL Trigger type bits:

```text
ROW      = 1
BEFORE   = 2
INSERT   = 4
DELETE   = 8
UPDATE   = 16
TRUNCATE = 32
INSTEAD  = 64
```

Expected completion Trigger:

```text
17 = 16 + 1 = UPDATE + ROW
AFTER is represented by BEFORE=0.
```

R24 mutation:

```text
BEFORE UPDATE
19 = 16 + 2 + 1 = UPDATE + BEFORE + ROW
```

Therefore:

```text
17 -> 19 adds the BEFORE bit.
It does not remove an event bit.
```

The mutation changes AFTER UPDATE ROW to BEFORE UPDATE ROW. It correctly
causes exact `TRIGGER_TYPE_MISMATCH` and also
`TRIGGER_EVENT_MASK_MISMATCH`, but the label
`tgtype_event_bits_reduced` is inaccurate.

The baseline is correct at 17; there is no baseline error. The defect is the
test/report description and missing true bit-reduction case.

To satisfy R23’s “event bits reduced” evidence, a separate mutation should
remove a bit from the baseline while retaining a valid Trigger declaration.
One possible direction is a row-level event-set change such as AFTER INSERT
(`5 = 4 + 1`), which removes UPDATE and adds INSERT and explicitly proves the
UPDATE event bit/event-set assertion. If only exact type mismatch was intended,
the test and report must be renamed accordingly and not claim bit reduction.

Verdict: `PARTIAL`.

## 6. D — UPDATE OF six-column matrix

The expected set remains exactly:

```text
customerId
projectId
buildingId
installationUnitId
createdById
createdByUploadIntentId
```

The catalog query expands `tgattr` through `unnest(... WITH ORDINALITY)`,
joins `pg_attribute`, and returns ordered names.

`R24-FI-03` changes the Trigger to `BEFORE UPDATE OF customerId`, yielding:

```text
expected = six fields
actual   = ["customerId"]
```

The validator compares the entire string array by canonical JSON, not only
count. Order, field names and missing/extra fields are covered by that
comparison.

This check is independent from exact `tgtype`: the mutation leaves
`tgtype = 19` unchanged.

Verdict: `PASS`.

## 7. E — reverse validity

R24 does not remove assertion code in a temporary source or execute a failure
variant. It relies on:

```text
requireExpectedFinding(findings, expectedCode)
```

and records hardcoded:

```text
expectedCodeWouldBeAbsentIfGuardRemoved: true
```

This is a valid structural dependency: if the expected finding is absent, the
runner throws. It is not the same as a reverse test that removes the assertion
and captures the failing run.

For OID-only and UPDATE OF, the required finding is the sole finding, so a
missing guard would leave no qualifying finding. For exact `tgtype`, missing
type detection would leave event-mask/deferrable findings but the required
`TRIGGER_TYPE_MISMATCH` would still be absent and would fail.

That reasoning is sound, but R23 specifically requested reverse evidence
through temporary copies, variants or comparable executable evidence.

Verdict: `PARTIALLY VERIFIED`.

## 8. F — isolated validation and test evidence

Verified:

```text
three databases: 19/19 migrations and up-to-date
19/19 Prisma checksums match SQL SHA-256
R24 catalog integration: 1/1 PASS
fault scenarios: 7 records
identity mismatch: 1 skipped, no catalog assertion executed
Web tests: 39 files / 375 tests PASS
typecheck: all applicable projects PASS
app role DDL: 42501
R24 instance stopped; port 55441 free; process count 0
```

Input/harness Migration hashes and names match all 19 repository Migrations.

No test was counted as passed after the identity-mismatch run; that run is
retained as a negative test only.

## 9. R21-P2-03 final status

```text
R21-P2-03: PARTIALLY CLOSED
```

Closed portions:

- seven scenario IDs and independent primary-code assertions;
- OID-only validator logic over an actual catalog row;
- UPDATE OF full six-field set check;
- exact `tgtype` mismatch detection;
- enabled/deferrable/relation checks;
- isolated PostgreSQL execution and rollback.

Open portions:

- R24-FI-04 is mislabeled as bit reduction; `17 -> 19` adds BEFORE;
- no executable reverse assertion-removal test;
- event-bit reduction evidence as required by R23 is missing.

## 10. Findings

### R25-P2-01 — event-bit test direction and scope are incorrect

Severity: `P2`

Location:

```text
apps/web/scripts/cm1-r24/phase41-catalog-faults.ts:R24-FI-04
```

`17 -> 19` adds the BEFORE bit. It tests exact type mismatch and mode change,
not bit/event-set reduction.

Required correction:

- either rename/reframe the test as exact type mismatch and remove the
  “event bits reduced” claim;
- or add a true event-set reduction scenario with a separate finding assertion.

### R25-P2-02 — reverse validity was not executed

Severity: `P2`

Location:

```text
D:\AI-Elevator-Advisor-CM1-R24\logs\r24-catalog-faults.log
```

The expected-code runner is structurally correct, but no temporary removal of
the OID/type/column checks produced a retained failing run.

Required correction:

- execute isolated temporary variants with each key assertion omitted;
- record expected failing output and restore the canonical test source.

### R25-P3-01 — DDL mutations produce collateral findings

Severity: `P3`

`R24-FI-01`, `R24-FI-04` and `R24-FI-07` produce multiple findings. They do
not count collateral findings as separate scenarios, but their primary finding
requires a forced assertion on the expected code.

### R25-P3-02 — in-memory catalog row is valid but not DB catalog write

Severity: `P3`

The OID row is based on actual catalog data and enters the common validator.
It does not prove PostgreSQL accepts a corrupt `tgfoid` binding. R24 discloses
this correctly.

## 11. Boundaries and not verified

- real Provider;
- Windows OS-level fencing;
- production IAM/ACL;
- real Web/Worker PostgreSQL E2E;
- E2E/Browser Runtime;
- Build and Startup Gate;
- production Migration/deployment;
- P2-05;
- R5 57 open decisions;
- BV7 remains FAIL;
- BV8 unapproved;
- historical R8 BLOCKED;
- Binding-parent-chain, orphan FileVersion and multiple terminal matrix remain
  outside this review.

No PostgreSQL instance was restarted and no database was modified by R25.

## 12. Git state

Before report:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      115
Untracked files:        121
```

After report:

```text
Untracked entries:      116
Untracked files:        122
```

## 13. Report hash, bytes and lines

Final report SHA-256 (hash line canonicalized to 64 zero bytes):

```text
A05A926F6905B232C6D0DBB8FE10ED5ABE50964A83913251500432D465356FFD
```

Byte count: `12673`

Line count: `321`
