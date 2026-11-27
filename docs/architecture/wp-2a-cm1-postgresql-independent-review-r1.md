# WP-2A-CM1-PG-VALIDATION-R1 — Independent PostgreSQL Evidence Audit

## 0. Final Conclusion

```text
PARTIAL — ADDITIONAL VALIDATION REQUIRED
```

本轮实际发现了独立 PostgreSQL 18.7 执行证据：DB-C 的 `23514` precheck、
合法 OBJECT_STORE 链、Operation/Lifecycle/Binding/FileVersion 负向约束、
双 Session CAS、stale executor 和 TCP 连接切断后的提交状态均有日志支持。

但证据包仍不足支持原报告的完整 PASS：

- evidence 目录没有任何 SQL、PowerShell、JavaScript 或 Proxy 脚本；
- DB-A2、DB-B、DB-C 的若干输出只有未标注的数值摘要，没有完整命令转录；
- 对象键/append expected-current、真实 Web/Worker 到 PostgreSQL 恢复仍未执行；
- P2-05 的终态关系只验证了部分路径；
- 伪 SQL setup 错误和中间失败 fixture 出现在 server.log，但原报告没有完整披露。

因此应保留限制，进入下一轮定向验证；不能把本轮宣称为完整 PostgreSQL
验证完成。

## 1. Document Control

```text
Stage:
  WP-2A-CM1-PG-VALIDATION-R1

Mode:
  READ-ONLY INDEPENDENT DATABASE EVIDENCE AUDIT

Date:
  2026-11-26

Repository:
  D:\thinkbook\Desktop\jieya

Branch:
  codex/public-github-sync

HEAD:
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

origin/main:
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

Reviewed report:
  docs/architecture/wp-2a-cm1-postgresql-controlled-validation.md

Verified report SHA-256:
  572381B31D4376BB96F5D5588CE7EE7442C9C8237F6A99852EF61F18ADF6B010

Verified report bytes/lines:
  15557 / 500
```

The reviewed report SHA-256 matches the value supplied by the user.

## 2. Evidence Inventory

The retained temporary evidence directory contains:

```text
instance-identity.log
db-a-migrations.log
db-a-success-chain.log
db-constraint-cases.log
db-a2-summary.log
db-b-up-to-cm1.log
db-b-r3-migration.log
db-b-summary.log
db-c-up-to-cm1.log
db-c-r3-migration.log
db-c-summary.log
db-d-migrations.log
db-d-two-session-cas.log
db-d-stale-executor.log
commit-response-loss.log
commit-before-failure.log
server.log
```

The evidence directory contains **zero** `.sql`, `.ps1`, `.js`, `.ts` or `.json`
test/proxy scripts. The report lists result logs, but not reusable fixtures or
the TCP proxy source.

Instance identity log:

```text
postgres|wp2a_admin|18.7|.../data|55439|127.0.0.1
```

The server log confirms the instance started as PostgreSQL 18.7 on
`127.0.0.1:55439`, used the temporary data directory, and later received a fast
shutdown. No existing service was stopped.

## 3. DB-A to DB-D Evidence Matrix

| Database | Original claim | Independent evidence audit | Result |
|---|---|---|---|
| DB-A | Clean direct migration + constraint tests | `db-a-migrations.log` has 16 `code=0` entries; `db-a-success-chain.log` has legal chain; `db-constraint-cases.log` has six actual SQLSTATE failures | `PARTIAL — core claims supported; table count 39 not separately logged` |
| DB-A2 | Prisma `migrate deploy` 16/16 | `db-a2-summary.log` contains only five unlabeled numbers (`40,46,27,16,16`); no raw Prisma command transcript retained | `PARTIAL — summary supports counts, command evidence not reproducible` |
| DB-B | Non-empty Legacy migration succeeds and preserves history | up-to-CM1 and R3 output logs plus `db-b-summary.log` show 1 Legacy row, 0 binding rows and `ls_hist_b|STAGING_RESERVED` | `PASS — evidence supports preserving a synthetic Legacy row` |
| DB-C | Dangerous historical precheck fails before DDL | `db-c-r3-migration.log` records `23514` with `any_object_lifecycle=1`; `db-c-summary.log` records `0` new columns and `1` lifecycle row | `PARTIAL — failure and row preservation supported; labeled schema BEFORE/AFTER transcript is absent` |
| DB-D | Two-session CAS and stale executor | `db-d-two-session-cas.log` and `db-d-stale-executor.log` show independent session output, `UPDATE 1` vs `UPDATE 0`, final owner/generation | `PASS — executed claims supported; append matrix absent` |

### 3.1 DB-A specifics

The migration log contains the 16 expected directories in order, each with an
explicit `code=0`. The successful chain log shows:

```text
intent|i_a|COMPLETED||fv_a
attempt|a_a|COMPLETED|objects/a
operation|op_a|APPLIED|1
canonical|lc_a|ACTIVE
staging|ls_a|STAGING_READY
binding|b_a|VERIFIED|v-a|t
fileversion|fv_a|objects/a|b_a
deferrable_constraints|27
```

The `39 public tables` figure in the report is plausible because DB-A2 summary
shows `40` including `_prisma_migrations`, but no `db-a-summary.log` directly
contains the DB-A table count.

### 3.2 DB-A2 specifics

`db-a2-summary.log` is only:

```text
40
46
27
16
16
```

The mapping to public tables, triggers, deferrable constraints, migration rows
and finished migration rows is only in the prose report. There is no retained
Prisma command stdout showing the 16 migration names or the final success line.
The clean migration result is credible, but not fully reproducible from the
retained evidence alone.

### 3.3 DB-B specifics

The up-to-CM1 log contains migration outputs without a per-migration `code=`
marker, while the report says this succeeded. The R3 output log likewise lacks
an explicit `MIGRATION_EXIT=0` line. The summary file is small and unlabeled:

```text
1
0
ls_hist_b|STAGING_RESERVED
```

This supports the final state but not the complete command-to-result chain.

### 3.4 DB-C specifics

`db-c-r3-migration.log` is a strong failure record:

```text
ERROR: 23514: CM1-R3 precheck blocked before DDL:
any_binding=0, any_object_lifecycle=1,
object_finalize_operation=0, active_append_intent=0,
incomplete_binding_chain=0
```

`db-c-summary.log` contains:

```text
0
1
0
```

The report interprets these as new R3 columns, lifecycle row count and binding
row count. That interpretation is consistent with the SQL queries used, but the
summary has no column labels and no pre/post schema transcript. The `23514`
failure itself is independently supported.

## 4. Migration and Prisma History Audit

### Supported

- DB-A direct migration: 16 explicit `code=0` entries.
- DB-C precheck: actual PostgreSQL `23514` before the first DDL.
- DB-A2 summary: 16 migration rows and 16 finished rows.
- DB-B/DB-C directories preserve migration source and order.

### Not independently supported

- Raw Prisma `migrate deploy` stdout with migration names and final success.
- Prisma `_prisma_migrations` failure/rolled-back history for DB-C.
- A retained pre/post schema diff for DB-C.
- Retained fixture SQL for DB-B/DB-C.

The report correctly marks the Prisma failure history as `NOT VERIFIED`; this
audit agrees. It should not be upgraded to PASS from the current evidence.

## 5. Trigger and Constraint Audit

### Supported negative cases

`db-constraint-cases.log` records actual PostgreSQL execution:

| Case | SQLSTATE/result | Evidence |
|---|---|---|
| APPLIED Operation changed to FAILED | `23514` | terminal storage operation immutable |
| ACTIVE Lifecycle changed to FINALIZING | `23514` | invalid lifecycle transition |
| FileVersion DELETE | `42501` | append/immutable FileVersion guard |
| VERIFIED Binding changed to PENDING | `23514` | terminal binding immutable |
| FileVersion binding set NULL/repoint | `23514` | object FileVersion requires binding |
| STAGING_READY while Attempt WRITING | `23514` at COMMIT | deferred lifecycle chain trigger |

The last case is actual deferred-trigger evidence, not a trigger-existence
assertion.

### P2-05 terminal invariant

The positive DB-A chain and the six negative cases support part of P2-05:

```text
VERIFIED Binding
  + APPLIED Operation
  + ACTIVE Lifecycle
  + one matching FileVersion
```

The following remains `NOT VERIFIED`:

- objectKey duplicate insert with a genuinely independent legal parent chain;
- an orphan VERIFIED Binding created through a separate legal path;
- multiple FileVersion combinations beyond the tested direct cases;
- append expected-current real negative/concurrent insert;
- all direct/indirect DML entry points under the final roles/RLS policies.

P2-05 must therefore remain `PARTIAL`, not become fully RESOLVED.

## 6. Real Two-Session Concurrency Audit

The evidence supports real separate `psql` sessions:

- `db-d-two-session-cas.log` contains separate A/B outputs;
- A held `SELECT ... FOR UPDATE` and slept;
- B ran the same old owner/generation CAS;
- A returned `UPDATE 1`, B returned `UPDATE 0`;
- final state advanced to `owner-d4|3|STAGING`.

`db-d-stale-executor.log` supports a later takeover:

```text
TAKEOVER UPDATE 1
STALE_OLD UPDATE 0
FINAL owner-d5|4|STAGING
```

This is genuine PostgreSQL two-connection evidence and is not a Promise-only
simulation. It does not cover append expected-current, multiple FileVersion
terminal races, or Web/Worker service transactions.

## 7. TCP Proxy COMMIT Response Loss Audit

### Supported

`commit-response-loss.log` records:

```text
CLIENT_EXIT=2
PROXY_READY
server closed the connection unexpectedly
DB_AFTER: ls_d|STAGING|commit-loss-observed
```

`commit-before-failure.log` records:

```text
CLIENT_EXIT=2
DB_AFTER: ls_d|STAGING|rollback-start
```

`server.log` independently shows a division-by-zero statement in the
before-COMMIT path. The DB-A/DB-D server log also shows the instance was
PostgreSQL 18.7 and the temporary cluster shut down normally.

### Not fully supported

The proxy source and invocation script were not retained in the evidence
directory. Only `PROXY_READY` and client/DB post-state are saved. A third party
cannot reconstruct:

- exact proxy listener/forwarding implementation;
- exact byte boundary at which the client socket was closed;
- whether the proxy was in the path for every experiment;
- exact invocation timestamps/lineage for the commit-loss command.

Therefore the observed DB result is credible, but the claim of a fully
reproducible TCP fault injection should be `PARTIAL`, not `PASS` at the evidence
package level.

Also, this did not run a Web/Worker recovery against the real PostgreSQL
instance. Real app+DB recovery remains `NOT VERIFIED`.

## 8. P2/P3 Finding Review

### CM1-PG-P2-01 — ObjectKey and append negative writes

The original report correctly marks this `NOT VERIFIED`. The migration contains
the relevant unique index and partial index, and source/static tests exist, but
no actual PostgreSQL negative insert or append race is retained. This is an
ongoing test gap, not proof of a schema defect.

### CM1-PG-P2-02 — Live application-to-PostgreSQL recovery

The original report correctly marks this `NOT VERIFIED`. The service harness
tests are local repository simulations; no Web/Worker process connected to the
isolated PostgreSQL instance. This remains an external integration gap.

### CM1-PG-P3-01 — Prisma failed-Migration history

The clean Prisma history has summary evidence, but the dangerous non-empty
DB-C failure was executed through `psql`, not Prisma. The failure history and
partial-execution semantics of the actual Prisma runner remain `NOT VERIFIED`.

### Audit-only findings

The following are evidence-package weaknesses rather than newly discovered
database design defects:

1. No SQL/fixture/proxy scripts were retained in the evidence directory.
2. DB-A2/DB-B/DB-C summaries are unlabeled numeric output and do not include
   full command transcripts.
3. `server.log` contains initial failed fixture attempts and a transient
   `role "thinkbook" does not exist` connection; the report does not disclose
   those setup failures. They did not alter the final isolated data results but
   should be documented for audit reproducibility.

These are `P2` evidence-traceability issues for the validation package and
`P3` reporting-quality issues respectively. They do not establish a new P0/P1
database vulnerability.

## 9. Remaining NOT VERIFIED Items

```text
Object-key duplicate insert with independent parent chain: NOT VERIFIED
Append expected-current concurrent negative:              NOT VERIFIED
Multiple FileVersion terminal combinations:              NOT VERIFIED
All direct/indirect DML privilege paths:                  NOT VERIFIED
Prisma dangerous-Migration failure history:               NOT VERIFIED
Web/Worker live recovery against isolated PostgreSQL:    NOT VERIFIED
Real Provider:                                            NOT VERIFIED
Windows OS-level storage fencing:                         NOT VERIFIED
IAM/ACL:                                                  NOT VERIFIED
E2E:                                                      NOT VERIFIED
Production deployment:                                   NOT AUTHORIZED
```

The report's underlying final statement remains conservative:

```text
PASS WITH RESTRICTIONS — POSTGRESQL VALIDATION PARTIALLY COMPLETE
```

This audit confirms the executed claims but downgrades the evidence package to
`PARTIAL — ADDITIONAL VALIDATION REQUIRED` for a complete validation claim.

## 10. Instance and Git State

### Instance

The temporary instance was stopped. `pg_isready` for `127.0.0.1:55439` returned
no response and port 55439 was free. The data and evidence directories were not
deleted.

### Git at audit start

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  71
Untracked files:        72
```

### Git at audit end

Only this audit report was added:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  72
Untracked files:        73
New report:             docs/architecture/wp-2a-cm1-postgresql-independent-review-r1.md
```

No Git reset, restore, clean, checkout, stash, add, commit or push occurred.
No `$null`, `UNKNOWN'`, `.next`, `apps/worker/dist`, `.env` or `.env.test` was
read, hashed, modified, moved or deleted.

## 11. Final Decision

```text
PARTIAL — ADDITIONAL VALIDATION REQUIRED
```

The executed PostgreSQL evidence is materially useful and supports the
single-instance migration/precheck/core constraint/CAS/commit-loss results.
It does not support a complete PostgreSQL validation claim because the evidence
package lacks reusable proxy/fixture scripts, complete labeled command
transcripts, isolated objectKey/append negative tests, Prisma failure history,
and live application-to-database recovery.

Recommended next stage: targeted supplemental validation in another disposable
PostgreSQL clone, followed by a fresh independent audit. No source, Migration,
Provider, Windows, ACL or deployment change is authorized by this report.
