# WP-2A-CM1 — Append Intent Relational Integrity Design R6

## 0. Final Conclusion

```text
DESIGN COMPLETE — READY FOR INDEPENDENT REVIEW
```

R6 is a targeted correction of R5. It preserves the accepted R4 new-File
provenance model and corrects:

```text
R5-P1-01  File-side deferred guard stale NEW   RESOLVED BY DESIGN
R5-P2-01  Deferred lifecycle test matrix       RESOLVED BY DESIGN
R5-P2-02  Offline Migration operational proof  RESOLVED BY DESIGN
```

No PostgreSQL or Prisma runtime behavior is claimed as verified.

## 1. Inputs and Document Control

Reviewed R5:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-independent-review-r5.md
SHA-256 0FB9E2B709954C2478D2517608ECC1B7B6DA9FF5BBAD318441BAE4AD82AD6C99
22,443 bytes
770 lines
```

R5 hash matches the supplied baseline.

Base design:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-remediation-design-r4.md
SHA-256 929B40685EBC784E8FC22947959DD2E8416AB3727E1AC6834BD57D6D9FDC3DE1
31,038 bytes
1,101 lines
```

Also rechecked:

```text
R3 independent review
R2/R1 design and review chain
prisma/schema.prisma
all CM1 upload-related Migrations
local and object upload services
Increment/finalization/recovery/retry source
relevant Triggers, Constraints, FKs, indexes and tests
controlled PostgreSQL and independent evidence reports
```

R4's durable `File.createdByUploadIntentId` provenance model is retained.

## 2. Executive Summary

### 2.1 Corrected deferred guard

The deferred File event now supplies only:

```text
file identity: OLD.id or NEW.id
```

The deferred function re-reads the final `file` row by that stable primary key.
It does not use `NEW.currentVersionId`.

It then checks every associated active Append against the final File current
version.

### 2.2 Event coverage

The File guard covers:

```text
AFTER INSERT OR UPDATE OR DELETE ON file
DEFERRABLE INITIALLY DEFERRED
```

The Intent guard covers:

```text
AFTER INSERT OR UPDATE OR DELETE ON file_upload_intent
DEFERRABLE INITIALLY DEFERRED
```

Existing delete/identity protections remain the first controls for forbidden
DELETE/UPDATE paths.

### 2.3 Concurrency proof

Deferred functions perform plain final-state reads without taking new locks.
The locks needed for correctness are acquired before the deferred check:

- creation/reservation entry Trigger: File `FOR SHARE` / `FOR UPDATE`;
- application finalization: File `FOR UPDATE` and CAS;
- active append unique index: one active slot.

Concurrent writers either wait for the File row lock or fail the deferred
final-state check in their own transaction.

### 2.4 Migration Runbook

R6 adds a fully sequenced offline runbook with:

- release, operations and DBA actors;
- service/scheduler drain evidence;
- session and prepared-transaction checks;
- three-table `ACCESS EXCLUSIVE ... NOWAIT`;
- pre/post schema and data checks;
- Prisma Migration history verification;
- failure rollback verification;
- no-restart and recovery gates;
- automated, manual and non-provable evidence classification.

## 3. Current Source Facts

Current File creation paths:

```text
apps/web/src/modules/files/upload-service.ts:1137-1150, 2154-2167
apps/web/src/modules/files/object-upload-service.ts:1016-1030
```

Current Append/current finalization:

```text
apps/web/src/modules/files/upload-service.ts:1116-1235, 2246-2273
apps/web/src/modules/files/object-upload-service.ts:995-1110
```

Current File current-pointer update occurs before Intent completion in both
normal paths.

Existing deferred P1-3 triggers prove that PostgreSQL in this repository
already uses Constraint Triggers, but their behavior remains historically
`NOT VERIFIED` where no raw isolated test exists:

```text
prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:2013-2105
prisma/migrations/20261126130000_phase38_route_c_minimal_recovery_hardening/migration.sql:601-623
```

The repository's current isolation/test status confirms that Trigger existence
is not behavioral proof:

```text
docs/architecture/file-lifecycle-p13-implementation-status.md:91-100
docs/architecture/file-lifecycle-p13-implementation-status.md:954-978
```

## 4. R5 Finding Disposition

| Finding | R6 correction | Design status | Runtime status |
|---|---|---|---|
| `R5-P1-01` stale event-local NEW | re-read final File by stable ID in deferred function | `RESOLVED` | `NOT VERIFIED` |
| `R5-P2-01` incomplete Deferred matrix | full event/timing/lifecycle/concurrency/deletion matrix | `RESOLVED` | `NOT VERIFIED` |
| `R5-P2-02` drain protocol | executable offline Runbook and evidence gates | `RESOLVED` | operational evidence `NOT VERIFIED` |

## 5. Revised Deferred Guard

### 5.1 Shared helper

Use one helper so File-side and Intent-side checks cannot diverge:

```sql
CREATE OR REPLACE FUNCTION "p13_assert_append_current_for_file"(
  p_file_id TEXT
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  f "file"%ROWTYPE;
BEGIN
  SELECT * INTO f
  FROM "file"
  WHERE id = p_file_id;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1
      FROM "file_upload_intent" i
      WHERE i."existingFileId" = p_file_id
        AND i.status = 'UPLOADING'
    )
    THEN
      RAISE EXCEPTION
        'active Append target File is missing'
        USING ERRCODE = '23514';
    END IF;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "file_upload_intent" i
    WHERE i."existingFileId" = f.id
      AND i.status = 'UPLOADING'
      AND i."expectedCurrentFileVersionId"
          IS DISTINCT FROM f."currentVersionId"
  )
  THEN
    RAISE EXCEPTION
      'UPLOADING append lost its expected-current invariant'
      USING ERRCODE = '23514';
  END IF;
END;
$$;
```

The helper:

- uses final committed-visible table rows;
- does not trust event current-version values;
- handles an absent File;
- does not acquire new locks.

### 5.2 File-side deferred function

```sql
CREATE OR REPLACE FUNCTION "p13_assert_append_current_from_file"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_id TEXT;
  v_new_id TEXT;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old_id := OLD.id;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new_id := NEW.id;
  END IF;

  IF v_old_id IS NOT NULL THEN
    PERFORM "p13_assert_append_current_for_file"(v_old_id);
  END IF;

  IF v_new_id IS NOT NULL
     AND v_new_id IS DISTINCT FROM v_old_id
  THEN
    PERFORM "p13_assert_append_current_for_file"(v_new_id);
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER
  "p13_append_current_file_commit_guard"
AFTER INSERT OR UPDATE OR DELETE ON "file"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_append_current_from_file"();
```

The event image is used only for File identity. `NEW.currentVersionId` is not
used.

The OLD/NEW branch also makes the design complete if a future path changes
File.id. Current `existingFileId` RESTRICT/immutability constraints normally
prevent that path.

### 5.3 Intent-side deferred function

```sql
CREATE OR REPLACE FUNCTION "p13_assert_append_current_from_intent"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_file_id TEXT;
  v_new_file_id TEXT;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old_file_id := OLD."existingFileId";
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new_file_id := NEW."existingFileId";
  END IF;

  IF v_old_file_id IS NOT NULL THEN
    PERFORM "p13_assert_append_current_for_file"(v_old_file_id);
  END IF;

  IF v_new_file_id IS NOT NULL
     AND v_new_file_id IS DISTINCT FROM v_old_file_id
  THEN
    PERFORM "p13_assert_append_current_for_file"(v_new_file_id);
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER
  "p13_append_current_intent_commit_guard"
AFTER INSERT OR UPDATE OR DELETE ON "file_upload_intent"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "p13_assert_append_current_from_intent"();
```

The helper re-reads the final Intent/Files. An Intent that is terminal at COMMIT
does not remain an active invariant.

### 5.4 Why use OLD and NEW identities

Although `existingFileId` and expected-current are immutable today, deferred
coverage remains complete:

- if an old File relationship existed, its final state is checked;
- if a new File relationship exists, its final state is checked;
- if a File id changes in a future authorized protocol, both sides are checked;
- duplicate events are idempotent because they re-read final state.

### 5.5 General rule for every deferred guard

Every deferred Constraint Trigger added by R4/R6 follows this rule:

```text
event OLD/NEW supplies stable identity only
-> re-read the final row(s) by primary/composite key
-> validate the final transaction state
```

No deferred function may use a mutable business value copied from `OLD` or
`NEW`.

This includes R4's deferred consumed-File guard. Its proposed function must:

1. take `NEW.id` as the originating File identity;
2. re-read final `file` with that ID;
3. re-read final `FileUploadIntent` by `createdByUploadIntentId`;
4. re-read final completed `FileVersion`;
5. compare final `currentVersionId`, version ownership and Intent status;
6. reject `23514` when the final chain is incomplete or inconsistent.

No `NEW.currentVersionId`, `NEW.completedFileVersionId` or other mutable event
snapshot may decide the final check.

The same rule applies to:

- `p13_assert_append_current_for_file`;
- `p13_assert_append_current_from_file`;
- `p13_assert_append_current_from_intent`;
- the deferred consumed-File chain guard;
- any later deferred guard introduced by this family.

R6's test matrix explicitly covers final re-read behavior for both the Append
and File-origin guards.

## 6. Multiple-Update and Event Analysis

### 6.1 Current A -> B -> A, final valid

```text
Initial:
  File F current = FV_A
  Intent I UPLOADING expected = FV_A

Transaction:
  UPDATE F current = FV_B       -- event F1, identity F
  UPDATE F current = FV_A       -- event F2, identity F
  COMMIT
```

At COMMIT:

```text
F1 and F2 both invoke helper(F)
helper re-reads current FV_A
I still expected FV_A
=> pass
```

R4's event-local implementation would have rejected F1. R6 does not.

### 6.2 A -> B -> C and complete

```text
F current A -> B -> C
create completed version C
Intent UPLOADING -> COMPLETED C
COMMIT
```

At COMMIT:

```text
all File events re-read current C
Intent is terminal
=> no active invariant; pass
```

### 6.3 File update first, Intent terminal later

Same transaction:

```text
UPDATE File current
UPDATE Intent COMPLETED
COMMIT
```

All File events and the Intent event execute at COMMIT. Intent is terminal, so
no active snapshot remains.

### 6.4 Intent terminal first, File update later

Same transaction:

```text
UPDATE Intent COMPLETED
UPDATE File current
COMMIT
```

At COMMIT the Intent is terminal. File final-state checks do not require an
active snapshot. The extended completion guard and FileVersion chain validate
the final relation.

### 6.5 Multiple Intent updates

```text
PENDING -> UPLOADING -> PENDING -> UPLOADING
```

Each deferred event re-reads final Intent and File. If final status is
UPLOADING, expected must equal final current. Intermediate transitions do not
control the final result.

### 6.6 Savepoint

```text
SAVEPOINT s
UPDATE File current = invalid
ROLLBACK TO SAVEPOINT s
UPDATE File current = valid
COMMIT
```

The invalid event belongs to the rolled-back subtransaction and should be
discarded. Only committed subtransaction events remain. This is a PostgreSQL
behavior requirement to verify, not claimed as executed.

### 6.7 `SET CONSTRAINTS`

Application rule:

```text
normal upload/finalization transactions keep INITIALLY DEFERRED semantics
```

If a caller promotes constraints to IMMEDIATE before the transaction has
reached a legal final state, rejection is expected.

If it promotes constraints after the complete chain is present, the final-state
reader should pass.

The application must not use `SET CONSTRAINTS` to bypass or suppress an error.
Tests cover immediate before/after completion and restore-to-deferred.

## 7. Concurrency and Isolation Proof

### 7.1 No lock acquisition in the deferred function

The deferred helper uses plain `SELECT` only. Adding `FOR UPDATE` at COMMIT
would introduce a new lock order and is not needed.

### 7.2 File current mutation

An `UPDATE file SET currentVersionId=...` holds the File row lock until
transaction end. The deferred helper therefore reads a row that cannot be
changed concurrently until this transaction finishes.

### 7.3 Intent reservation

The existing entry Trigger locks File `FOR UPDATE` when entering UPLOADING and
holds it until the transaction ends. A concurrent File current update cannot
pass the lock.

### 7.4 Intent creation

Append creation holds File `FOR SHARE`. A current-version update waits for the
Intent transaction; after it commits, the later update evaluates the active
Intent at its own commit.

### 7.5 Race where one transaction only touches Intent

If a transaction updates an unrelated Intent field without a File lock while
another transaction updates File current:

- the Intent transaction's deferred check sees current committed before its
  commit snapshot, or
- the File transaction's deferred File check sees the active Intent at its
  commit.

The File update holds a row lock; the Intent check cannot create a valid result
that bypasses the final File-side check.

### 7.6 Read Committed

Project application transactions use PostgreSQL's default `READ COMMITTED`
unless a transaction explicitly selects otherwise.

At COMMIT, own writes are visible. Concurrent uncommitted updates of the same
File cannot commit concurrently because of row locks. The competing writer's
own deferred check catches the final combination.

### 7.7 Repeatable Read / Serializable

Under stronger isolation, concurrent write conflicts produce `40001` rather
than a silently mixed result. The application retries only classified
serialization failures from a fresh read.

### 7.8 TOCTOU after the check

There is no unprotected window after the check:

- active Append status can change only by an Intent update whose own deferred
  event checks;
- File current can change only by a File update whose own deferred event checks;
- File and Intent deletes remain blocked by FK/identity guards.

## 8. Deferred Trigger Semantics Contract

### 8.1 Mechanism distinction

| Mechanism | R6 use |
|---|---|
| BEFORE ROW trigger | entry checks, immutability, state/hierarchy validation |
| AFTER ROW Constraint Trigger | final-state deferred invariants |
| Deferred FK | target relationship at COMMIT |
| CHECK | permanent row shape |
| Unique index | one origin File, one active Append |

### 8.2 Event types

- File: INSERT, UPDATE, DELETE Constraint Trigger;
- Intent: INSERT, UPDATE, DELETE Constraint Trigger;
- all event functions re-read by stable IDs where a row may still exist;
- delete events require no active relation after the deletion; an active
  relation plus missing File is invalid.

### 8.3 Multiple events

Multiple events are intentionally not deduplicated. Every event re-reads the
same final state and is idempotent:

```text
event 1 -> final check
event 2 -> same final check
```

This is correct but may duplicate work. File/Intent terminal changes are
low-volume.

### 8.4 Trigger/FK ordering

The first SQLSTATE may be from an FK or from a custom Constraint Trigger when
both are invalid. Tests isolate the target control and record the actual
first error; they do not assume custom Trigger always wins.

### 8.5 Recursion

Deferred functions only read. They do not update File or Intent and therefore
do not recurse.

### 8.6 Visibility

Final-state `SELECT` in the same transaction sees that transaction's own
writes. The write-phase row locks protect the selected File/Intent state from
concurrent mutation before commit.

## 9. Complete State Matrix

### 9.1 New File

| State/event | Expected | Check |
|---|---|---|
| N/N PENDING | pass | Pair CHECK |
| N/N UPLOADING | pass | entry trigger no File lookup |
| File INSERT origin I | File trigger requires I UPLOADING N/N/hierarchy/actor |
| File only commit | reject | deferred consumed-chain guard `23514` |
| Complete with origin I | pass | completion provenance + File chain |
| Complete under existing File | reject | completion provenance `42501` |
| Second File for I | reject | unique `23505` |
| Mutate File origin | reject | immutable trigger `42501` |

### 9.2 Append

| State/event | Expected | Check |
|---|---|---|
| Append PENDING valid | pass | Pair/creation/current |
| Append UPLOADING valid | pass | File FOR UPDATE entry check |
| Current advances, Intent pending | pass | stale PENDING allowed |
| Current advances, Intent UPLOADING at COMMIT | reject | final File/Intent guard `23514` |
| Current advances, Intent COMPLETED same tx | pass | deferred checks see terminal |
| Two active Appends | reject one | active partial unique `23505` |
| Failed/expired terminal | pass with history | pair/chain |
| Expected-current update | reject | target slot immutability `23514` |
| ExistingFileId update | reject | phase32 identity guard `42501` |

### 9.3 Delete/truncate

| Operation | First control |
|---|---|
| FileVersion DELETE | BEFORE identity Trigger `42501` |
| Intent DELETE | BEFORE identity/state Trigger `42501` |
| File DELETE with history | FK restrict `23503` |
| TRUNCATE protected chain tables | existing TRUNCATE guards `42501` |

## 10. Full Deferred Test Matrix

Legend:

```text
PASS = must commit
REJECT = must fail
N/A = mechanism not applicable
PG = requires real PostgreSQL execution
```

| ID | Event/timing/state | Expected | Target first control | SQLSTATE | Final assertion |
|---|---|---|---|---|---|
| `R6-T-01` | File INSERT origin I, legal full chain | PASS/PG | all guards | none | one File/Version/current/Intent |
| `R6-T-02` | File INSERT origin for Append Intent | REJECT/PG | File origin Trigger | `23514` | no File |
| `R6-T-03` | N/N completes under existing File | REJECT/PG | completion provenance | `42501` | no completion |
| `R6-T-04` | N/N completes under another Intent File | REJECT/PG | completion provenance | `42501` | no completion |
| `R6-T-05` | two origin Files for one Intent | REJECT/PG | unique index | `23505` | one File max |
| `R6-T-06` | UPDATE File origin | REJECT/PG | immutability Trigger | `42501` | origin unchanged |
| `R6-T-07` | File-only commit | REJECT/PG | deferred consumed chain | `23514` | File rolled back |
| `R6-T-08` | Intent INSERT valid Append | PASS/PG | final guard | none | PENDING retained |
| `R6-T-09` | PENDING -> UPLOADING valid | PASS/PG | entry/final guard | none | current=expected |
| `R6-T-10` | PENDING -> UPLOADING stale | REJECT/PG | entry Trigger | `23514` | PENDING remains |
| `R6-T-11` | A -> B -> A final active valid | PASS/PG | final-state helper | none | current=expected=A |
| `R6-T-12` | A -> B -> C and Intent completed | PASS/PG | final helper | none | COMPLETED C/current C |
| `R6-T-13` | current B, Intent remains UPLOADING expected A | REJECT/PG | final File helper | `23514` | rollback |
| `R6-T-14` | File current then Intent terminal same tx | PASS/PG | deferred final | none | terminal current |
| `R6-T-15` | Intent terminal then File current same tx | PASS/PG | deferred final | none | terminal current |
| `R6-T-16` | multiple Intent PENDING/UPLOADING/PENDING/UPLOADING | PASS/PG | final Intent helper | none | final current equality |
| `R6-T-17` | multiple File and Intent updates final invalid | REJECT/PG | final helper | `23514` | rollback |
| `R6-T-18` | SAVEPOINT invalid update rolled back | PASS/PG | deferred event discard | none | final valid |
| `R6-T-19` | subtransaction commit valid update | PASS/PG | deferred event retained | none | final valid |
| `R6-T-20` | `SET CONSTRAINTS IMMEDIATE` before completion | REJECT/PG | deferred guard | `23514` | rollback |
| `R6-T-21` | `SET CONSTRAINTS IMMEDIATE` after valid final | PASS/PG | final helper | none | terminal valid |
| `R6-T-22` | restore DEFERRED after immediate pass | PASS/PG | normal commit | none | terminal valid |
| `R6-T-23` | two Append reservations | one PASS/one REJECT | File lock/unique | `23505` | one active |
| `R6-T-24` | two finalizations same Intent | one PASS/one fenced | row/lease/CAS | none/application | one FileVersion |
| `R6-T-25` | File update vs finalization | one serialized | File lock/final guards | `23514` if stale | one valid terminal |
| `R6-T-26` | old executor retry after winner | PASS idempotent/reject | fencing/CAS | application | no second version |
| `R6-T-27` | COMMIT success response lost | new connection PASS | durable rows | none | matches committed state |
| `R6-T-28` | transaction rollback | PASS | rollback | none | no partial state |
| `R6-T-29` | deadlock victim retry | PASS from fresh read | lock protocol | `40P01` first | no duplicate |
| `R6-T-30` | File DELETE with active Append | REJECT | FK/identity | `23503`/`42501` | File remains |
| `R6-T-31` | FileVersion DELETE referenced | REJECT | BEFORE Trigger | `42501` | version remains |
| `R6-T-32` | Intent DELETE active | REJECT | BEFORE identity/state | `42501` | Intent remains |
| `R6-T-33` | related File field changes | PASS/REJECT | final helper | `23514` if active mismatch | final relation |
| `R6-T-34` | direct DML bypass attempts | REJECT | named Trigger/constraint | exact expected | no illegal row |
| `R6-T-35` | TRUNCATE chain tables | REJECT | truncate Trigger | `42501` | rows remain |
| `R6-T-36` | FK CASCADE/RESTRICT path | N/A/PG | existing action | per action | no hidden rewrite |

`N/A` means the new guard does not own that mechanism; a separate existing
constraint/Trigger is the target.

## 11. Migration Offline Runbook

### 11.1 Actors

| Role | Responsibility |
|---|---|
| Release manager | declares maintenance window, freezes deployment |
| Operations | stops Web/Worker, schedulers, retries, auto-restart |
| DBA/Migration operator | drains sessions, locks tables, executes Migration |
| Verifier | independently checks schema/data/history evidence |

One person may hold multiple roles only if the deployment policy permits it.

### 11.2 Stage 0 — Preflight

Preconditions:

- approved immutable Migration and report hashes;
- isolated target identity recorded;
- source implementation ready but not started;
- rollback/old-schema verification procedure ready;
- no production/shared target without explicit authorization.

Evidence:

```text
branch, HEAD, origin/main
Migration directory and SHA-256
Prisma schema SHA-256
target database name/server/version
```

Failure:

```text
do not continue
```

### 11.3 Stage 1 — Stop new writes

Operations:

1. remove/disable incoming Web traffic;
2. stop accepting new upload requests;
3. set maintenance mode if available;
4. retain existing sessions long enough to drain normally.

Evidence:

- ingress/load balancer state;
- maintenance page/health state;
- zero new request/audit entries during a bounded observation window.

Database-only evidence cannot prove ingress shutdown.

### 11.4 Stage 2 — Stop Worker/Scheduler/retry

Operations:

- stop Worker processes;
- pause pg-boss schedules/jobs;
- disable external cron/Watchdog/job runners;
- disable service auto-restart.

Evidence:

- process inventory before/after;
- scheduler pause state;
- no active worker sessions in DB;
- operations confirmation that no host/container/service restarts the process.

No DB query can prove a future auto-restart policy is disabled.

### 11.5 Stage 3 — Writer inventory

Enumerate:

```text
Web instances
Worker instances
legacy services
migration/admin scripts
interactive DBA sessions
connection pool clients
prepared transactions
```

Automated evidence:

```sql
SELECT
  datname,
  usename,
  application_name,
  client_addr,
  state,
  xact_start,
  query_start
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
ORDER BY xact_start NULLS LAST, pid;

SELECT *
FROM pg_prepared_xacts
WHERE database = current_database();
```

Do not print connection strings or secrets.

### 11.6 Stage 4 — Drain gate

Success:

- no non-migration open transaction on the target DB;
- no prepared transaction retaining conflicting state;
- no active old Web/Worker process;
- no enabled scheduler/auto-restart;
- bounded observation period remains quiet.

Failure:

- do not start the Migration;
- identify owner/process;
- do not terminate a session unless separately authorized.

### 11.7 Stage 5 — Lock gate

Inside one migration transaction:

```sql
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '15min';

LOCK TABLE
  "file_version",
  "file",
  "file_upload_intent"
IN ACCESS EXCLUSIVE MODE NOWAIT;
```

Success:

- all three locks acquired.

Failure:

- SQLSTATE `55P03`;
- transaction aborts before precheck/DDL;
- services remain stopped;
- inspect `pg_locks`/`pg_stat_activity`;
- re-drain and rerun from Stage 0.

### 11.8 Stage 6 — Precheck and DDL

Run R4 precheck plus R6 conditions, then DDL in the approved order.

Failure:

- `23514` or DDL SQLSTATE;
- transaction rollback;
- no partial schema;
- no service restart.

### 11.9 Stage 7 — Postcheck

Automated checks:

- columns/defaults/nullability;
- unique index;
- FK columns/order/parent/actions/MATCH/deferrability;
- CHECK definitions and validation;
- Trigger events/functions/deferrability/enabled state;
- no old expected-current FK;
- invalid historical counts remain zero;
- `_prisma_migrations` exactly one finished R6 row.

Manual verifier:

- compares schema snapshot before/after;
- confirms only approved objects changed.

### 11.10 Stage 8 — Commit

Success:

- Migration transaction COMMIT succeeds;
- `_prisma_migrations.finished_at` non-NULL;
- no later migration was applied;
- schema/data postcheck still passes.

Failure:

- P3018 / unfinished row;
- keep services stopped;
- verify old schema restored after transaction rollback;
- explicit reviewed `migrate resolve` or replacement clone;
- a rerun without resolution must fail P3009.

### 11.11 Stage 9 — Restore

Only after verification:

1. start one updated Web instance;
2. start one updated Worker/scheduler only after Web canary;
3. run approved safe lifecycle smoke checks on isolated/test data;
4. observe no constraint violations or stuck UPLOADING;
5. restore full traffic.

Do not enable cleanup, Provider or production behavior in this design task.

### 11.12 Failure recovery decision table

| Failure | Services | Schema action | Retry condition |
|---|---|---|---|
| drain incomplete | stopped | none | re-drain, new lock attempt |
| lock `55P03` | stopped | none | inspect locks/prepared transactions |
| precheck `23514` | stopped | none | correct data only with approval |
| DDL error | stopped | verify rollback | resolve failed migration |
| postcheck failure | stopped | investigate/rollback | no restart |
| COMMIT unknown | stopped | new connection verifies | only verified schema |

## 12. Evidence Classification

### 12.1 Automated

- Git branch/HEAD/status.
- File hashes.
- Database identity/version.
- `pg_stat_activity`, `pg_prepared_xacts`, `pg_locks`.
- Prisma Migration command/output/exit code.
- `_prisma_migrations` state.
- schema/constraint/index/trigger catalog snapshots.
- raw SQL results and SQLSTATE.
- rowcount/final state assertions.

### 12.2 Manual

- ingress/maintenance mode;
- all host/container/service instances;
- schedulers/Watchdogs/cron;
- disabled auto-restart;
- external pool clients/admin scripts;
- release/rollback approval.

### 12.3 Not provable by DB alone

- absence of an external scheduler;
- future auto-restart behavior;
- a connection that has not yet been made;
- correctness of Provider-side effect;
- Windows OS file-handle fencing.

## 13. Prisma and PostgreSQL Consistency

R4's provenance and compound expected relation remain the design authority.
R6 adds only manual PostgreSQL functions/Triggers.

Required implementation gate:

- Prisma relation additions are generated and inspected;
- clean Migration rebuild;
- non-empty Migration;
- `migrate diff` from final DB to schema is empty;
- Client create/update/delete smoke tests;
- manual SQL/Trigger catalog exact match.

Current:

```text
NOT VERIFIED
```

## 14. Historical Finding Tracker

| Finding | Status | R6 disposition |
|---|---|---|
| `CM1-R2-IReview-P1-01` | `RESOLVED` | R4 origin + R6 final guard |
| `CM1-R2-IReview-P2-01` | `RESOLVED` | stale PENDING classification retained |
| `CM1-R2-IReview-P2-02` | `NOT VERIFIED` | generated Prisma SQL not executed |
| `CM1-R2-IReview-P2-03` | `PARTIALLY RESOLVED` | matrix now complete in design; PostgreSQL not run |
| `CM1-R2-IReview-P3-01` | `RESOLVED` | split Trigger design |
| `R3-P1-01` | `RESOLVED` | durable new-File provenance |
| `R3-P1-02` | `PARTIALLY RESOLVED` | stale NEW corrected; final-state behavior still needs PostgreSQL |
| `R3-P2-01` | `PARTIALLY RESOLVED` | offline Runbook complete; operational evidence not executed |
| `R3-P2-02` | `PARTIALLY RESOLVED` | full matrix complete; SQLSTATE runtime not verified |
| `R5-P1-01` | `RESOLVED` | stable identity + final-row re-read |
| `R5-P2-01` | `RESOLVED` | complete Deferred matrix |
| `R5-P2-02` | `RESOLVED` | runbook and evidence classification |
| binding-parent-chain duplicate | `NOT VERIFIED` | unchanged |
| orphan FileVersion | `NOT VERIFIED` | unchanged |
| multiple FileVersion terminal | `NOT VERIFIED` | unchanged |
| `P2-05` | `OPEN` | unchanged |
| R5 57 Open Decisions | `OPEN` | unchanged |
| BV7 | `FAIL` | unchanged |
| BV8 | `NOT VERIFIED` | unchanged |
| historical R8 | `BLOCKED` | unchanged |
| live Web/Worker + PostgreSQL | `NOT VERIFIED` | unchanged |
| real Provider | `NOT VERIFIED` | unchanged |
| Windows OS fencing | `NOT VERIFIED` | unchanged |
| IAM/ACL | `NOT VERIFIED` | unchanged |
| production migration/deployment | `BLOCKED` | no authorization |

`RESOLVED` remains design-level where marked. Runtime-dependent findings stay
partial or not verified.

## 15. Remaining Unresolved / Not Verified

```text
PostgreSQL Trigger/FK execution:                 NOT VERIFIED
Prisma generated SQL/Client behavior:            NOT VERIFIED
Deferred event ordering/savepoint/SET CONSTRAINTS: NOT VERIFIED
Multi-update behavior:                           NOT VERIFIED
Migration post-DDL rollback:                     NOT VERIFIED
Prisma P3018/P3009 for R6 Migration:             NOT VERIFIED
operational drain evidence:                      NOT VERIFIED
old workers/schedulers/auto restart:             NOT VERIFIED
historical new-File provenance on real DB:       NOT VERIFIED
live Web/Worker PostgreSQL integration:          NOT VERIFIED
real Provider:                                   NOT VERIFIED
Windows OS fencing:                              NOT VERIFIED
IAM/ACL:                                         NOT VERIFIED
E2E/deployment:                                  NOT VERIFIED
production migration:                            BLOCKED
```

## 16. Controlled PostgreSQL Validation Plan

After separate authorization:

1. Isolated PostgreSQL 18 instance.
2. Compile functions and constraints.
3. Run `R6-T-01` through `R6-T-36`.
4. Capture raw SQL, exit code, SQLSTATE and constraint/trigger name.
5. Test multiple updates, SAVEPOINT, immediate/deferred constraints.
6. Test two-session Append/finalization races.
7. Test provenance attacks and misbinding.
8. Test file/version/intent DELETE and truncate paths.
9. Test COMMIT response-loss recovery.
10. Apply R6 Migration to empty and non-empty clones.
11. Verify `_prisma_migrations` and failure P3018/P3009.
12. Keep Provider, Windows, IAM/ACL and production out of scope.

## 17. Git State

### Before this report

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  79
Untracked files:        80
```

### After this report

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  80
Untracked files:        81
New report:             docs/architecture/wp-2a-cm1-append-intent-relational-integrity-remediation-design-r6.md
```

Only this R6 report is added.

## 18. Report Metadata

Final SHA-256, byte count and line count are recorded in the delivery response.

Static assurance:

```text
Markdown fences:      balanced
Trailing whitespace: none
PostgreSQL execution: none
Build/E2E execution:  none
Provider access:      none
```

## 19. Final Design Decision

```text
DESIGN COMPLETE — READY FOR INDEPENDENT REVIEW
```

R5-P1-01 is corrected by final-row re-reading. R5-P2-01 is corrected by the
full Deferred matrix. R5-P2-02 is corrected by the offline Migration Runbook.

No implementation or PostgreSQL claim is made.
