# WP-2A-CM1 Append Intent Relational Integrity Independent Review R13

## 0. Final conclusion

```text
PASS WITH RESTRICTIONS — ELIGIBLE FOR CONTROLLED POSTGRESQL VALIDATION
```

No unresolved P1 was found in R12.

R12 closes both R11 P1 findings at design level:

- N/N and Append completion now share one final-state invariant;
- completion provenance is checked immediately for both paths;
- File business scope and creator fields become immutable after INSERT.

Several non-P1 restrictions remain around legacy rows, test first controls,
historical Migration vectors, owner-role trigger bypass and actual PostgreSQL
behavior. They do not block an isolated PostgreSQL validation of the new
invariants, but they must remain explicit during implementation.

No SQL, Migration, database connection, Build, E2E, Provider or runtime
operation was performed.

## 1. Inputs and workspace

Verified:

```text
R12 SHA-256 56C2A47F352BC0889ADE64600E71B7F003B0BFB7815676D7A6710DDC29070032
R11 SHA-256 D1136571FB17D399250F4C365AAC73C722650EA6C90C3D407A406D950339BAF9
R8  SHA-256 1D5331C62553A2B3C38466B6D6FFC0B10FA25735147E61CA58470CD539502FCC
R10 SHA-256 29EE0315E5CBDCD64FAC8AF5F55A897B63B2A44AC27642B7B2F6CAAD708F08E4
```

Git before review:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      89
Untracked files:        90
```

## 2. Reviewed evidence

Reports and designs:

```text
R1-R12 CM1 design/review chain
R8 finalized design
R9 independent design review
R10 implementation report
R11 independent source review
R12 targeted correction design
P30-P37, FZ, ST, DBTP
```

Current source and Migration:

```text
prisma/schema.prisma
prisma/migrations/20261115213000_phase31_file_data_model/migration.sql
prisma/migrations/20261115233000_phase32_upload_intents/migration.sql
prisma/migrations/20261126130000_phase38_route_c_minimal_recovery_hardening/migration.sql
prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql
prisma/migrations/20261126140000_phase39_append_intent_relational_integrity/migration.sql
apps/web/src/modules/files/upload-service.ts
apps/web/src/modules/files/object-upload-service.ts
apps/web/src/modules/files/object-upload-lease.ts
apps/web/tests/append-intent-relational-integrity.test.ts
apps/web/tests/integration/phase39-append-intent-integrity.test.ts
apps/web/tests/helpers/p13-file-version.ts
```

## 3. R11-P1-01 revalidation

### 3.1 Root cause remains correctly identified

R12 correctly identifies that:

- R10 completion guard returns for N/N;
- created-File terminal guard only runs on File INSERT;
- P1-3 chain does not prove the File belongs to the N/N Intent.

The previously demonstrated bypass is therefore real.

### 3.2 Immediate provenance guard

R12 extends completion provenance for N/N:

```text
target FileVersion.uploadIntentId = Intent.id
target File.createdByUploadIntentId = Intent.id
target File scope = Intent scope
```

For Append it retains:

```text
target File.id = Intent.existingFileId
target File scope = Intent scope
```

The target FileVersion and File are re-read rather than trusted from the
client or stale event fields.

This closes the N/N-under-existing-File case before current-pointer timing is
considered and preserves the legal completion-first order.

Status: `RESOLVED BY DESIGN`.

### 3.3 Unified deferred guard

The proposed shared invariant is:

```text
Intent COMPLETED
FileVersion.uploadIntentId = Intent.id
FileVersion.fileId = File.id
File.currentVersionId = completedFileVersionId
completed version has max versionNumber for File
File ownership:
  N/N: File.createdByUploadIntentId = Intent.id
  Append: File.id = Intent.existingFileId
```

This is complete for the identified completion relationship.

The guard re-reads final:

```text
Intent
FileVersion
File
max(FileVersion.versionNumber)
```

using stable primary keys. Event OLD/NEW values only classify the
`UPLOADING -> COMPLETED` transition.

Status: `RESOLVED BY DESIGN`.

### 3.4 Attack matrix

| Attack | Result | Control |
|---|---|---|
| legal N/N | pass | unified final guard |
| N/N under unrelated File | reject | immediate provenance |
| N/N under another Intent File | reject | immediate provenance |
| N/N target without current advance | reject | unified final guard |
| target belongs another Intent | reject | P1-3 plus unified guard |
| higher version inserted, current unchanged | reject | max/current check |
| current first, then completion | pass | deferred final read |
| completion first, then current | pass | deferred final read |
| higher version inserted after completion in same tx | final mismatch | unified guard |
| multiple completions final mismatch | rollback | unified guard |
| SAVEPOINT rollback | event discarded | PostgreSQL semantics |
| `SET CONSTRAINTS IMMEDIATE` | final-state check at that point | named guard |

No remaining early-return path for normal completion was found.

### 3.5 Event coverage concern

The unified guard is `AFTER UPDATE` only.

This is sufficient because:

- Intent INSERT must be PENDING;
- Intent DELETE is blocked;
- COMPLETED is terminal;
- FileVersion and File side effects are covered by their own guards.

No P1 gap was found. Actual trigger ordering and event queue behavior remain
`NOT VERIFIED`.

## 4. R11-P1-02 revalidation

### 4.1 Current-service compatibility

Current source creates Files with the business scope and creator already
present:

- `upload-service.ts` assigns customer/project/building/unit and
  `createdById` during `tx.file.create`;
- both new-File finalization paths assign `createdByUploadIntentId` in the same
  create;
- `object-upload-service.ts` behaves equivalently;
- current application File updates are current-pointer or metadata operations,
  not ownership moves.

No legitimate current code path requires post-INSERT scope assignment.

### 4.2 Immutable rule

R12 freezes:

```text
customerId
projectId
buildingId
installationUnitId
createdById
createdByUploadIntentId
```

The guard uses `IS DISTINCT FROM`, so:

- same values pass;
- any NULL transition fails;
- combined moves fail atomically;
- batch UPDATE checks each row;
- direct SQL triggers the same rule.

No Session GUC or runtime bypass is introduced.

Status: `RESOLVED BY DESIGN`.

### 4.3 Residual role limitation

The current `elevator_app` identity is still database owner. A role with table
DDL/trigger-disable authority can bypass any Trigger.

This is not a new R12 defect; it is the existing unverified IAM/ACL boundary.
The immutability rule can only be claimed for roles without DDL or
`ALTER TABLE ... DISABLE TRIGGER`.

Status: `NOT VERIFIED` outside the approved controlled database role model.

## 5. Unified N/N and Append invariant assessment

R12 correctly preserves separate ownership proof:

```text
N/N    -> origin File created by the same Intent
Append -> target File named by existingFileId
```

Both require:

```text
exact target FileVersion
current pointer equals target
latest version number equals target
```

This is the minimum coherent synthesis of R4 provenance and R8 completion
currentness.

The historical meaning remains clear:

- old completed target may cease to be current after later Append;
- the invariant applies at the completion transaction's final state;
- later current movement must have its own completed Intent.

The design does not make historical completed targets permanently equal to the
current pointer.

Status: `DESIGN VERIFIED`; PostgreSQL behavior `NOT VERIFIED`.

## 6. Trigger and constraint event matrix

| Object | INSERT | UPDATE | DELETE | TRUNCATE |
|---|---|---|---|---|
| File | origin guard; terminal/current deferred | scope immutable; Append/current/latest deferred | FK/delete restrictions; OLD/NEW deferred identities | chain guard/FK run as applicable |
| FileVersion | P1-3 storage chain | original identity plus P1-3 chain | identity/delete guard | P1-3 truncate guard |
| FileUploadIntent | PENDING-only guard | provenance/state/history immediate; unified deferred | identity/delete guard | P1-3 truncate guard |

Relevant design conclusions:

- FileVersion INSERT does not independently call the completion guard, but the
  Intent completion event always occurs in the completing transaction.
- File current UPDATE is checked by the existing latest-completed guard.
- Intent DELETE cannot remove a completed target.
- FileVersion DELETE cannot remove the completed target.
- TRUNCATE guards prevent bulk bypass.

Residual test requirement:

- complete the matrix with actual constraint names, event bits and catalog
  assertions in controlled PostgreSQL.

## 7. Concurrency and deferred ordering

R12 correctly retains:

- explicit Read Committed;
- File and Intent row locks;
- active Append unique index;
- deferred final-state checks;
- upload fencing/CAS.

It does not claim isolation level alone is sufficient.

Important scenarios:

### 7.1 Two Append reservations

The File lock and active partial unique index serialize reservation.
Only one transaction may own the Append slot.

### 7.2 Completion versus next Append

Completion holds File update authority. An Append based on the previous current
becomes stale after winner commit and cannot reserve.

### 7.3 Concurrent scope update

File row locking serializes updates. The immutability guard rejects any
distinct change.

### 7.4 Deferred execution

The design requires final-row re-read and does not trust `NEW.currentVersionId`.
This is correct.

No new lock-order P1 was found.

## 8. Phase-40 Migration review

### 8.1 Positives

R12:

- preserves phase 3.9 and adds a new forward Migration;
- runs precheck under fixed `ACCESS EXCLUSIVE NOWAIT` locks;
- adds `project` to the lock set for customer/scope checks;
- keeps the original three-table order relative to each other;
- performs all prechecks before function/trigger DDL;
- rejects provably inconsistent history;
- does not guess or backfill historical origin;
- replaces the old completion trigger after the unified function exists;
- requires catalog postchecks;
- keeps services drained.

### 8.2 Legacy-unverified rows

R12 classifies completed N/N records with NULL origin as
`legacy-unverified` and proceeds without guessing or rewriting.

This is consistent with R4's historical policy, but two questions remain
restricted:

- whether such a legacy File may be the `existingFileId` of a future Append;
- how its unverified status is durably recorded for operations beyond the
  Migration log/evidence.

R12 correctly prevents new N/N completion without origin. It does not silently
invent provenance.

Status: `PARTIAL`; not a new P1 because R4 explicitly allowed unprovable legacy
Files, but the runtime/append policy must be explicit before a non-empty
production Migration.

### 8.3 Migration test evidence

R12 defines historical categories, but its test matrix does not yet provide
concrete positive/negative non-empty Migration vectors or evidence paths for:

- each precheck category;
- precheck-before-first-DDL proof;
- Prisma failure history;
- schema before/after;
- retry behavior.

This is a P2 design/test-evidence gap, not a structural blocker to isolated
PostgreSQL testing.

## 9. Two-client concurrency design

R12 correctly replaces the one-client design with:

```text
two PrismaClient instances
two independent PostgreSQL sessions
explicit barrier
inside-transaction allocation
separate winner/loser assertions
separate unique-index and stale-current controls
```

The reservation race is valid:

- both Intents are PENDING with the same expected-current;
- both reach the barrier;
- winner commits UPLOADING without advancing current;
- loser can only be rejected by active-slot or stale-current control.

The stale-current race is also valid when the winner advances current before
the loser's reservation is evaluated.

### Residual P2

The “finalization race” remains under-specified:

- two Append finalizations on one File cannot both own the active slot;
- “distinct version numbers inside each transaction” may still hit
  `(fileId, versionNumber)` uniqueness before the intended guard;
- the test must name whether it targets unique slot, expected-current CAS,
  old execution ownership, or deferred current consistency.

Each race needs a separate deterministic barrier point and expected first
control.

## 10. Test matrix credibility

### 10.1 Strong coverage

R12 includes targeted tests for:

- legal N/N and Append completion;
- N/N under unrelated or foreign-origin File;
- completion/current order both ways;
- multiple completions;
- File scope transitions;
- existing identity/delete/truncate controls;
- SAVEPOINT and `SET CONSTRAINTS`;
- two-client reservation/current races.

### 10.2 Test-first-control issue

`R12-T-22` attributes `COMPLETED -> UPLOADING` to the phase 3.7 state guard.

Current trigger order indicates the phase 3.2
`file_upload_intent_completion_guard` can fire first because a completed target
is non-null while NEW status is not COMPLETED. It also returns `23514`.

The test must either:

- record that earlier control as the first rejection; or
- construct a fixture that isolates the state-transition guard.

This is `P2` for test credibility, not a security bypass.

### 10.3 Missing explicit vectors

R12 does not yet list exact test cases for:

- uncompleted max version;
- current NULL while versions exist;
- historical precheck categories;
- legacy-unverified read/Append eligibility;
- repeated Migration failure/retry;
- `createdByUploadIntentId` NULL-to-non-NULL and non-NULL-to-NULL separately.

These should be added before execution evidence is accepted.

## 11. New findings

### R13-P2-01 — Legacy-unverified runtime policy is incomplete

R12 classifies unprovable historical N/N origin but does not define whether
those Files:

- remain readable;
- may be targeted by new Append Intents;
- may have their current pointer advanced;
- require a durable operator-visible inventory.

R12 prevents new N/N provenance bypass and does not fabricate history.
A restrictive legacy policy must be documented before non-empty production use.

### R13-P2-02 — One first-control expectation is wrong

`COMPLETED -> UPLOADING` can be rejected by
`file_upload_intent_completion_guard` before the phase 3.7 state guard.
The test must assert the actual first control or isolate it.

### R13-P2-03 — Migration test vectors are not yet concrete

The precheck categories are good, but there are no explicit safe/unsafe clone
fixtures, expected category counts, sample IDs and before/after schema evidence.

### R13-P2-04 — Finalization race target is ambiguous

The two-client finalization test does not clearly distinguish an active-slot
failure from version-number uniqueness or stale-current rejection.

### R13-P3-01 — Trigger matrix is not fully operationalized

The matrix does not list exact trigger/constraint names, event bits and
deferrability assertions for all File/FileVersion/Intent events.

## 12. Historical finding disposition

| Finding | R13 status |
|---|---|
| `R11-P1-01` | `RESOLVED BY DESIGN` |
| `R11-P1-02` | `RESOLVED BY DESIGN` |
| R11 P2 negative-test coverage | design improved; not implemented |
| R11 P2 two-client test | design substantially corrected; finalization case ambiguous |
| R11 P2 first controls | partial; one control misclassified |
| R9-P2-01 | test design improved; source unchanged |
| R9-P2-02 | source retains Read Committed; runtime not verified |
| R9-P2-03 | `NOT VERIFIED` |
| R8 completed/current P1 | `RESOLVED BY DESIGN` for N/N and Append |
| R7-P2-02 | partial; exact first controls remain |
| R7-P2-03 | `NOT VERIFIED` |
| R5-P2-01 | design complete; not executed |
| R5-P2-02 | evidence plan retained; no evidence |
| R3-P1-02 | `RESOLVED BY DESIGN` |
| R3-P2-01 | offline design retained; execution absent |
| R3-P2-02 | matrix expanded; SQLSTATE not executed |
| `CM1-R2-IReview-P2-02` | `NOT VERIFIED` |
| `CM1-R2-IReview-P2-03` | design complete; source/execution absent |

Unchanged out-of-scope restrictions:

```text
binding-parent-chain duplicate:        NOT VERIFIED
orphan FileVersion:                    NOT VERIFIED
multiple FileVersion terminal matrix:  NOT VERIFIED
P2-05:                                OPEN
R5 57 decisions:                      OPEN
BV7:                                  FAIL
BV8:                                  NOT VERIFIED
historical R8:                        BLOCKED
real Provider:                        NOT VERIFIED
Windows OS fencing:                   NOT VERIFIED
IAM/ACL:                              NOT VERIFIED
live Web/Worker PostgreSQL:           NOT VERIFIED
real drain:                           NOT VERIFIED
production Migration:                 BLOCKED
```

## 13. NOT VERIFIED / BLOCKED

```text
PL/pgSQL compilation:                        NOT VERIFIED
deferred trigger ordering:                   NOT VERIFIED
FK cascade versus scope immutability guard:  NOT VERIFIED
actual Read Committed server value:           NOT VERIFIED
two-client concurrency:                       NOT VERIFIED
Migration precheck SQL:                       NOT VERIFIED
Migration rollback:                           NOT VERIFIED
Prisma P3018/P3009 behavior:                  NOT VERIFIED
historical safe/unsafe clone inventory:       NOT VERIFIED
legacy-unverified runtime policy:             PARTIAL
PostgreSQL owner-role trigger bypass:         BLOCKED by unverified ACL
live Web/Worker PostgreSQL:                   NOT VERIFIED
Provider/Windows/E2E/deployment:              NOT VERIFIED
production enablement:                        BLOCKED
```

## 14. Conditions before controlled PostgreSQL validation

The test plan must first be amended with:

1. exact legacy-unverified read/Append/current-advance policy;
2. corrected first control for COMPLETED state regression;
3. concrete safe/unsafe non-empty Migration fixtures;
4. exact precheck category counts and sample IDs;
5. separate concurrency cases for active slot, stale current, version-number
   uniqueness and stale execution ownership;
6. full trigger/constraint name/event/deferrability assertions.

Then isolated PostgreSQL validation must verify:

- both P1 attack sequences;
- both completion ordering orders;
- multi-event/SAVEPOINT/SET CONSTRAINTS;
- scope immutability and FK cascades;
- two independent client races;
- Migration fail-before-DDL and rollback/history;
- Prisma-generated DML behavior.

## 15. Git state after review

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked entries:      90
Untracked files:        91
New review report:      docs/architecture/wp-2a-cm1-append-intent-relational-integrity-independent-review-r13.md
```

No source, Schema, Migration, test or existing report was modified.

## 16. Report metadata

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

## 17. Final decision

```text
PASS WITH RESTRICTIONS — ELIGIBLE FOR CONTROLLED POSTGRESQL VALIDATION
```

R12 resolves both R11 P1 defects at design level. The remaining issues are
test-design, legacy-policy and database-behavior restrictions; they must be
resolved or explicitly evidenced during controlled PostgreSQL validation, but
they do not require another R8-level redesign.
