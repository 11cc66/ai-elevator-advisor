# WP-2A-CM1 Append Intent Relational Integrity Controlled Implementation R10

## 0. Final conclusion

```text
PASS WITH RESTRICTIONS
```

R8 was implemented in Prisma Schema, a new forward-only Migration, upload
transactions and test source. All verification permitted by R10 passed.
PostgreSQL execution, Migration execution, real Web/Worker database integration,
Provider/ACL/Windows fencing and production deployment remain `NOT VERIFIED`.

## 1. Baselines and authority

Authorized task:

```text
WP-2A-CM1 — Append Intent Relational Integrity Controlled Implementation R10
```

Verified design baseline:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-remediation-design-r8.md
SHA-256 1D5331C62553A2B3C38466B6D6FFC0B10FA25735147E61CA58470CD539502FCC
```

Verified independent review baseline:

```text
docs/architecture/wp-2a-cm1-append-intent-relational-integrity-independent-review-r9.md
SHA-256 587C69BD7B08B4FB4B4284F21A649DEBED3DE3D93666DC19D1669750840AAFB3
```

R9 decision:

```text
PASS WITH RESTRICTIONS — DESIGN APPROVED WITH EXPLICIT LIMITATIONS
```

Reviewed the relevant R1-R9 material, P30-P37, FZ, ST, DBTP, current Prisma
Schema/Migrations, upload services, transaction boundaries, P1-3 lifecycle
guards, tests and test infrastructure.

## 2. Git state before implementation

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  81
Untracked files:        82
```

Existing dirty and untracked work was preserved. No reset, restore, clean,
checkout, stash or Git add was used.

## 3. Implemented source changes

### 3.1 Prisma Schema

`prisma/schema.prisma` now defines:

- `File.createdByUploadIntentId`, unique, with the `UploadIntentCreatedFile`
  relation and `RESTRICT/RESTRICT` behavior;
- `existingFile` with `RESTRICT/RESTRICT`;
- compound
  `(expectedCurrentFileVersionId, existingFileId) ->
  file_version(id, fileId)` relation with `RESTRICT/RESTRICT`.

Prisma format, validate and generate all pass.

### 3.2 Forward-only Migration

New file:

```text
prisma/migrations/20261126140000_phase39_append_intent_relational_integrity/migration.sql
```

The Migration has not been executed. It contains:

- fixed `ACCESS EXCLUSIVE NOWAIT` lock order:
  `file_version -> file -> file_upload_intent`;
- precheck before the first DDL, failing with `23514` on unsafe history;
- File creation provenance column, unique index and FK;
- explicit `RESTRICT/RESTRICT` existing-File FK;
- replacement of the old expected-current FK with a same-File compound FK;
- compound completed-target same-File FK;
- expected-current NULL-pair CHECK;
- File creation-origin and new-File terminal-chain guards;
- Append creation and reservation snapshot guards;
- deferred old/new File current guards;
- deferred Append completion/current guard;
- completed Intent history immutability guard;
- deferred latest-completed File current guard;
- catalog postchecks for indexes, CHECK/FKs, trigger presence and deferrability.

Self-review found that the new-File terminal guard used `FOUND` after a later
`count(*)`, so it could observe the wrong statement. Explicit
`v_intent_found`, `v_version_found` and `v_file_found` flags now capture each
lookup. The final source contains no instance of that faulty pattern.

### 3.3 Upload transactions

`apps/web/src/modules/files/upload-service.ts`

- all five interactive transactions explicitly use
  `Prisma.TransactionIsolationLevel.ReadCommitted`;
- both new-File creation sites set `createdByUploadIntentId`;
- existing row locks, fencing, CAS and deferred database checks remain.

`apps/web/src/modules/files/object-upload-service.ts`

- all seven interactive transactions explicitly use `ReadCommitted`;
- new object-backed File creation sets `createdByUploadIntentId`;
- exact-version, recovery and fencing behavior remains unchanged.

Isolation options do not replace row locks, CAS, fencing or database guards.

### 3.4 Test source and fixtures

Added or changed:

```text
apps/web/tests/append-intent-relational-integrity.test.ts
apps/web/tests/integration/phase39-append-intent-integrity.test.ts
apps/web/tests/helpers/p13-file-version.ts
apps/web/tests/helpers/object-upload-prisma-harness.ts
apps/web/tests/object-upload-service.test.ts
apps/web/tests/integration/phase31-schema.test.ts
apps/web/tests/integration/phase36-field-review.test.ts
apps/web/tests/integration/phase37-review-invariants.test.ts
```

The P1-3 helper supports normal new-File and Append paths plus explicit NULL
and foreign completed-target negative fixtures. Existing integration fixtures
that need a first version now create it through the valid new-File chain,
avoiding an impossible zero-version bootstrap under the new guards.

## 4. R8 requirement disposition

| R8 requirement | Implementation | Status |
|---|---|---|
| COMPLETED target required | pair/chain/completion guards | source complete; DB `NOT VERIFIED` |
| completed target belongs to existing File | compound FK | source complete; DB `NOT VERIFIED` |
| completed target equals final current | deferred completion guard | source complete; DB `NOT VERIFIED` |
| completed target immutable | history guard | source complete; DB `NOT VERIFIED` |
| current is latest completed version | deferred latest-current guard | source complete; DB `NOT VERIFIED` |
| new-File N/N remains valid | origin/terminal guards | unit/static PASS; DB `NOT VERIFIED` |
| Append I/I remains valid | creation/reservation/current/completion guards | unit/static PASS; DB `NOT VERIFIED` |
| direct DML cannot bypass | deferred INSERT/UPDATE/DELETE guards | test source; DB `NOT VERIFIED` |
| READ COMMITTED | every upload interactive transaction | source/unit PASS; runtime `NOT VERIFIED` |
| offline Migration | lock, precheck, ordered DDL, postcheck | static PASS; execution `NOT VERIFIED` |
| drain evidence | requirements retained | operational evidence absent |
| R9 test gaps | 16 PostgreSQL cases + 7 static tests | execution `NOT VERIFIED` |

## 5. R9 and historical findings

| Finding | R10 disposition |
|---|---|
| `R9-P2-01` incomplete negative matrix | `RESOLVED AT SOURCE/TEST-SOURCE LEVEL` |
| `R9-P2-02` missing explicit isolation | `RESOLVED AT SOURCE LEVEL` |
| `R9-P2-03` checklist-only drain evidence | `NOT VERIFIED` |
| R8 completion/current P1 | `RESOLVED AT SOURCE LEVEL` |
| R8 matrix unimplemented | `PARTIALLY RESOLVED`; source exists, DB not executed |
| `CM1-R2-IReview-P1-01` | `RESOLVED AT SOURCE LEVEL` |
| `CM1-R2-IReview-P2-01` | `RESOLVED AT SOURCE LEVEL`; runtime pending |
| `CM1-R2-IReview-P2-02` | `PARTIALLY RESOLVED` |
| `CM1-R2-IReview-P2-03` | `PARTIALLY RESOLVED` |
| `CM1-R2-IReview-P3-01` | `RESOLVED AT SOURCE LEVEL` |
| `R3-P1-01`, `R5-P1-01`, `R7-P1-01`, `R7-P2-01` | source complete; DB `NOT VERIFIED` |
| `R3-P1-02`, `R3-P2-01`, `R3-P2-02` | `PARTIALLY RESOLVED` |
| `R5-P2-01`, `R5-P2-02`, `R7-P2-02`, `R7-P2-03` | `PARTIALLY RESOLVED` |

Unchanged restrictions:

```text
binding-parent-chain duplicate:        NOT VERIFIED
orphan FileVersion:                    NOT VERIFIED
multiple FileVersion terminal matrix:  NOT VERIFIED
P2-05:                                OPEN
R5 57 Open Decisions:                 OPEN
BV7:                                  FAIL
BV8:                                  NOT VERIFIED
historical R8:                        BLOCKED
real Provider:                        NOT VERIFIED
Windows OS-level storage fencing:     NOT VERIFIED
IAM/ACL:                              NOT VERIFIED
live Web/Worker PostgreSQL:           NOT VERIFIED
production deployment:                BLOCKED
```

## 6. Database model and guard responsibilities

Expected-current:

```text
(expectedCurrentFileVersionId, existingFileId)
  -> file_version(id, fileId)
MATCH SIMPLE
DEFERRABLE INITIALLY DEFERRED
ON DELETE RESTRICT
ON UPDATE RESTRICT
```

The pair CHECK allows:

- N/N for new-File history and active work;
- I/I for Append history and active work;
- I/N only for terminal `COMPLETED`, `FAILED` or `EXPIRED`;
- no N/I and no active I/N.

Completed-target:

```text
single completedFileVersionId FK = existence
(completedFileVersionId, existingFileId) -> file_version(id, fileId)
  = same-File proof for Append
```

The new deferred guards re-read final rows for:

- UPLOADING Append expected-current equals File current;
- COMPLETED Append target belongs to the Intent and equals File current;
- File current is the latest version and has a completed Intent;
- completed target/history fields cannot change;
- File creation provenance cannot change.

## 7. Executable test matrix added

PostgreSQL integration test source contains 16 cases:

| ID | Case | Expected first result |
|---|---|---|
| `R10-DB-01` | new-File completion then same-File Append | normal commit |
| `R10-DB-02` | catalog relations/triggers | definitions present |
| `R10-DB-03` | stale Append reservation | `23514` |
| `R10-DB-04` | COMPLETED with NULL target | `23514`, no partial rows |
| `R10-DB-05` | target owned by another Intent | `23514`, no partial rows |
| `R10-DB-06` | `FileVersion.fileId` mutation | `42501` |
| `R10-DB-07` | `FileVersion.versionNumber` mutation | `42501` |
| `R10-DB-08` | completed target DELETE | `42501` |
| `R10-DB-09` | COMPLETED to UPLOADING | `23514` |
| `R10-DB-10` | regression to older version | `23514` |
| `R10-DB-11` | multiple current updates in one transaction | commit-time `23514` |
| `R10-DB-12` | `SET CONSTRAINTS ... IMMEDIATE` | immediate `23514` |
| `R10-DB-13` | SAVEPOINT rollback | deferred event discarded |
| `R10-DB-14` | FileVersion TRUNCATE | `42501` |
| `R10-DB-15` | parent File DELETE | `23503` |
| `R10-DB-16` | two sessions append from one current | exactly one winner |

The static suite verifies lock/DDL order, prechecks, compound FK shape,
deferrability, pair-CHECK semantics, File origin wiring, all transaction
isolation options, trigger postchecks, the `FOUND` correction and R9 case
mapping.

## 8. Commands and results

| Command | Result |
|---|---|
| `pnpm exec prisma format --schema prisma/schema.prisma` | PASS |
| `pnpm db:validate` | PASS |
| `pnpm db:generate` | PASS |
| `pnpm --filter @elevator/web typecheck` | PASS |
| `pnpm typecheck` | PASS, all 8 typecheck-capable workspace projects |
| `pnpm --filter @elevator/web test` | PASS, 37 files / 359 tests |
| `pnpm --filter @elevator/worker test` | PASS, 8 files / 33 tests |
| `pnpm --filter @elevator/file-storage test` | PASS, 6 files / 51 tests |
| `pnpm --filter @elevator/contracts test` | PASS, 4 files / 15 tests |
| `pnpm --filter @elevator/selection-engine test` | PASS, 2 files / 9 tests |
| `git diff --check` | PASS; expected LF/CRLF warnings only |

One initial Web run failed because a static assertion spanned past its target
function and matched a legal later `IF NOT FOUND`. The assertion was narrowed
without weakening a control; the final Web run passed.

Not executed: any PostgreSQL connection, SQL, Migration, `test:db:*`, database
integration test, Build, E2E, Browser Runtime, service start/restart,
Scheduler, Native RPC, real Provider/Storage/IAM/ACL/Trust Root operation.

## 9. NOT VERIFIED / BLOCKED

```text
PostgreSQL parses and creates the Migration:       NOT VERIFIED
PL/pgSQL functions compile:                       NOT VERIFIED
compound FK and pair CHECK behavior:              NOT VERIFIED
deferred trigger firing order:                    NOT VERIFIED
first SQLSTATE in every negative case:            NOT VERIFIED
actual transaction isolation:                     NOT VERIFIED
Prisma-generated SQL and Client behavior:         NOT VERIFIED
two independent PostgreSQL sessions:              NOT VERIFIED
SAVEPOINT and SET CONSTRAINTS behavior:           NOT VERIFIED
Migration rollback and _prisma_migrations state:   NOT VERIFIED
failure/retry behavior:                            NOT VERIFIED
offline Web/Worker drain evidence:                 NOT VERIFIED
historical non-empty database precheck:            NOT VERIFIED
live Web/Worker PostgreSQL integration:            NOT VERIFIED
real Provider:                                     NOT VERIFIED
Windows OS-level fencing:                          NOT VERIFIED
IAM/ACL:                                           NOT VERIFIED
production Migration/deployment:                   BLOCKED
```

## 10. PostgreSQL validation prerequisites

1. Apply the full chain to disposable PostgreSQL 18 and compile every function.
2. Apply to safe and unsafe non-empty clones and verify fail-before-DDL rollback.
3. Inspect `pg_constraint`, `pg_trigger`, `pg_indexes` and `_prisma_migrations`.
4. Execute all 16 cases, using independent connections for concurrency.
5. Observe `SHOW transaction_isolation` through actual service transactions.
6. Verify Prisma Client/DML cannot bypass the manual SQL objects.
7. Verify Migration failure/retry semantics.
8. Run isolated Web/Worker database integration.
9. Supply separate drain, ACL, Provider and production evidence.

## 11. Git state after implementation

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  87
Untracked files:        88
New R10 report:         docs/architecture/wp-2a-cm1-append-intent-relational-integrity-controlled-implementation-r10.md
```

No Git write, commit, push, reset, restore, clean, checkout or stash occurred.

## 12. Report metadata

```text
PostgreSQL execution:    none
SQL/Migration execution: none
Database access:         none
Provider access:         none
Build/E2E execution:     none
Git write:               none
```

The final SHA-256, byte count and line count are reported in the delivery
response because a file cannot contain its own stable final SHA-256.

## 13. Final decision

```text
PASS WITH RESTRICTIONS
```

The source implementation and permitted tests are complete and ready for
independent review and controlled PostgreSQL validation. This is not a claim
of database, Provider, Windows fencing, IAM/ACL, E2E or production completion.
