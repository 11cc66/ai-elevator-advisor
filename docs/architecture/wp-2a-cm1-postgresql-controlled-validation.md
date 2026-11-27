# WP-2A-CM1 — Controlled PostgreSQL Validation

## 0. Final Conclusion

```text
PASS WITH RESTRICTIONS — POSTGRESQL VALIDATION PARTIALLY COMPLETE
```

本轮在独立 PostgreSQL 18.7 实例中完成了 clean migration、非空 Legacy 历史
migration、危险历史 precheck、合法对象链、主要终态约束、真实双 Session CAS、
stale executor 和真实 COMMIT-response-loss 验证。

没有发现新的 P0/P1 数据库缺陷。仍有一个对象唯一性/append 并发矩阵项和一个
真实 app-service+PostgreSQL 组合项未执行，因此不能使用
`PASS — CONTROLLED POSTGRESQL VALIDATION COMPLETE`。

## 1. Authorization and Inputs

授权：

```text
WP-2A-CM1-PG-VALIDATION — CONTROLLED POSTGRESQL VALIDATION
```

审查基线：

| Input | SHA-256 |
|---|---|
| R3-R2 implementation report | `5E61AFC0ABE8DD55E1750AA340E28D5E680C883EBEE7AE4ADB013867C3AD048F` |
| R3-R2 independent review | `65C3EB45834B3919F808773B32AF418C2EA7DDFF428DDDA5D3EF756EA5C469EE` |

历史独立状态保持：

```text
R5 57 Open Decisions:          OPEN
BV7:                           FAIL
BV8:                           NOT INDEPENDENTLY APPROVED
Historical governance R8:      BLOCKED
P2-05 business retention:      OPEN
```

## 2. Isolated Instance

使用安装目录中的 PostgreSQL 18.7 二进制创建新实例，没有连接或修改现有
`postgresql-x64-18` 服务、`elevator_advisor` 或 `elevator_advisor_test`。

```text
PostgreSQL version:  18.7
Host:                127.0.0.1
Port:                55439
Dedicated role:      wp2a_admin
Data directory:      C:/Users/thinkbook/AppData/Local/Temp/
                     wp2a-pg-validation-3d63525135ea40f78d35c719ba6efe50/data
Server log:          .../server.log
Evidence directory:  .../evidence
```

隔离证明：

```text
current_database() = postgres
current_user()     = wp2a_admin
server_version     = 18.7
data_directory     = the new temporary directory above
listen port        = 55439
server address     = 127.0.0.1
```

现有服务仍监听 5432；本轮实例使用独立端口、独立数据目录、独立进程和独立
`wp2a_admin` 集群超级用户。实例结束后 `pg_isready` 对 55439 返回 no response，
端口 55439 已释放。

## 3. Test Database Matrix

| Database | Purpose | State |
|---|---|---|
| `wp2a_db_a` | Direct clean Migration + SQL constraint tests | `PASS` |
| `wp2a_db_a2` | Clean database through Prisma `migrate deploy` | `PASS` |
| `wp2a_db_b` | Non-empty historical Legacy Local state | `PASS` |
| `wp2a_db_c` | Historical OBJECT_STORE state that must fail precheck | `PASS — EXPECTED FAILURE` |
| `wp2a_db_d` | Real two-session concurrency, lease and stale executor | `PASS — PARTIAL MATRIX` |

所有数据均为人工构造的 `DEMO_MOCK` 测试数据。没有从开发或生产数据库导出数据。

## 4. Migration Results

### 4.1 DB-A — Direct clean migration

按目录时间顺序执行全部 16 个 Migration：

```text
20261115120000_phase1_baseline
20261115193000_phase2_auth_rbac_projects
20261115213000_phase31_file_data_model
20261115233000_phase32_upload_intents
20261115234500_phase32_upload_recovery_key
20261116001000_phase34_processing_metadata
20261116002000_phase34_extraction_terminal_guard
20261116090000_phase35_processing_reliability
20261116110000_phase37_field_review_invariants
20261116110500_phase37_validate_field_review_invariants
20261117120000_phase37_p13_storage_lifecycle_schema
20261117130000_phase37_p13_lifecycle_insert_guard
20261117140000_phase37_p13_lifecycle_initial_state_guard
20261123130000_full_mvp_domain
20261126120000_phase38_route_c_minimal_object_binding
20261126130000_phase38_route_c_minimal_recovery_hardening
```

结果：

```text
All 16 migration files: exit 0
public tables:           39
non-internal triggers:   46
deferrable constraints:  27
```

### 4.2 DB-A2 — Prisma migrate deploy

创建新的空数据库 `wp2a_db_a2`，使用隔离连接和真实 Prisma
`migrate deploy` 执行同一组 16 个 Migration。

```text
Prisma Client:          6.19.0
migrations found:       16
migrations applied:     16
_prisma_migrations:     16 rows
finished migrations:    16
rolled_back migrations: 0
```

Migration history、排序和 Prisma Schema 到实际数据库的基本创建均成功。

### 4.3 DB-B — non-empty historical database

在迁移到 R3-R2 之前的真实 schema 中构造合法的 Legacy Local synthetic chain：

```text
User/Customer/Project
Intent UPLOADING
Attempt RESERVED -> WRITING
StorageObjectLifecycle
  storageBackend = LEGACY_LOCAL
  state = STAGING_RESERVED
```

执行 R3-R2 Migration：

```text
migration exit:          0
new columns present:      4
legacy lifecycle rows:    1
object binding rows:      0
historical lifecycle:     STAGING_RESERVED (preserved)
```

结果为 `PASS`：非空 Legacy 历史没有被删除、覆盖或伪造为 object binding。

### 4.4 DB-C — dangerous historical database

在 R3-R2 前 schema 中构造一个真实、可提交的 historical OBJECT_STORE staging
chain，然后执行 R3-R2 Migration。

实际错误：

```text
SQLSTATE: 23514
message:
  CM1-R3 precheck blocked before DDL:
  any_binding=0,
  any_object_lifecycle=1,
  object_finalize_operation=0,
  active_append_intent=0,
  incomplete_binding_chain=0
```

失败后：

```text
new R3 columns:           0
object lifecycle rows:    1
object binding rows:      0
_prisma_migrations:       not created by direct psql execution
```

precheck 位于第一个 DDL 前，实际数据库 schema 未出现 R3 列。

### 4.5 Migration limitation

DB-C 使用真实 `psql` 执行 Migration 文件，未使用 Prisma Migrate，因此
Prisma 的失败 history 记录不在该次失败上验证。DB-A2 只验证了 Prisma clean
success history。非空危险历史经 Prisma runner 的失败 history 行为为
`NOT VERIFIED`。

## 5. Trigger and Constraint Validation

### 5.1 Positive legal chain

在 DB-A 中分两个真实事务构造并提交合法 OBJECT_STORE 链：

```text
Intent COMPLETED, currentAttemptId NULL
Attempt COMPLETED
Operation APPLIED
Canonical Lifecycle ACTIVE
Staging Lifecycle STAGING_READY
Binding VERIFIED
FileVersion exactly 1
```

最终查询：

```text
intent|i_a|COMPLETED||fv_a
attempt|a_a|COMPLETED|objects/a
operation|op_a|APPLIED|1
canonical|lc_a|ACTIVE
staging|ls_a|STAGING_READY
binding|b_a|VERIFIED|v-a|observed=true
fileversion|fv_a|objects/a|b_a
deferrable_constraints|27
```

### 5.2 Negative constraint matrix

| Case | SQLSTATE / result | Final state |
|---|---|---|
| Change APPLIED Operation to FAILED | `23514`, terminal storage operation immutable | unchanged |
| Change ACTIVE Lifecycle to FINALIZING | `23514`, invalid lifecycle transition | unchanged |
| Delete FileVersion | `42501`, file_version rows cannot be deleted | unchanged |
| Change VERIFIED Binding to PENDING | `23514`, terminal binding immutable | unchanged |
| Set FileVersion binding to NULL/repoint | `23514`, object FileVersion requires binding | unchanged |
| Make STAGING_READY while Attempt is WRITING | `23514`, deferred `p13_collect...` at COMMIT | lifecycle remained STAGING |

The last case proves a deferred final-state rejection, not merely a trigger
declaration.

### 5.3 Constraint gaps

These were not executed as isolated illegal writes:

```text
object namespace/objectKey duplicate insert
VERIFIED Binding with a different legal parent chain
append expected-current concurrent insert
all combinations of multiple FileVersion rows
```

They are `NOT VERIFIED`; existing unique indexes/constraints and static tests
remain source evidence only.

## 6. Real Two-Session Concurrency

DB-D was migrated fully and a synthetic STAGING chain was created.

### 6.1 Concurrent CAS

Session A:

```text
BEGIN
SELECT ... FOR UPDATE
pg_sleep(2)
UPDATE ... WHERE ownerToken='owner-d2'
              AND fencingGeneration=2
              AND leaseExpiresAt < now()
COMMIT
```

Session B began while A held the row lock and used the same old owner/generation.

Actual result:

```text
A: UPDATE 1, COMMIT
B: UPDATE 0, COMMIT
final ownerToken: owner-d2 -> owner-d4
final generation: 2 -> 3
```

Only one session acquired authority; the losing session could not overwrite it.

### 6.2 Stale executor after takeover

After a separate takeover:

```text
winner: owner-d5 / generation 4 -> UPDATE 1
stale old executor: owner-d4 / generation 3 -> UPDATE 0
```

This is real PostgreSQL session behavior, not `Promise.all` or a serial mock.

### 6.3 Heartbeat/lease behavior

The same test expired the lease in a separate SQL transaction, then attempted
takeover using the old owner/generation. The takeover succeeded only once and
the stale session rowcount was zero. This validates the database CAS behavior;
it does not validate application heartbeat scheduling or process death.

## 7. Real COMMIT Response Loss

### 7.1 Committed transaction, response lost

A local TCP proxy forwarded PostgreSQL protocol traffic. It detected the
client's `COMMIT` request, allowed the server to process it, discarded the
server response, and closed the client socket.

Actual result:

```text
client exit:       2
client observation: server closed the connection unexpectedly
client result:     unknown / connection lost
database re-query: owner snapshot changed
row state:         ls_d STAGING, lastErrorCode=commit-loss-observed
```

The row change was visible through a separate direct PostgreSQL connection.
This proves the server committed while the client did not receive the response.

### 7.2 Transaction error before COMMIT

The same proxy was used with:

```text
BEGIN
UPDATE ... lastErrorCode='rollback-should-not-persist'
SELECT 1/0
COMMIT
```

The client also lost the connection. A separate query showed the previous
`rollback-start` value, proving PostgreSQL rolled back rather than committing
the attempted update.

### 7.3 Recovery limitation

No actual Web/Worker process was started. The real PostgreSQL commit-loss
experiments prove database behavior and response uncertainty; they do not prove
the application recovery path against this database. The application recovery
logic remains covered by the R3-R2 service harness tests, not by a live
app-connected PostgreSQL service.

## 8. Staging / Canonical / Finalization Results

| Stage | PostgreSQL result | Application/service result |
|---|---|---|
| Staging chain insertion | `PASS` in DB-A/DB-B fixtures | Source/service harness `PASS`; live app+DB `NOT VERIFIED` |
| Canonical chain preparation | `PASS` in DB-A two-transaction fixture | Source/service harness `PASS`; live app+DB `NOT VERIFIED` |
| Finalization | `PASS` in DB-A | Source/service harness `PASS`; live app+DB `NOT VERIFIED` |
| COMMIT success but response lost | `PASS` with proxy and separate re-query | Application recovery not connected to this DB |
| COMMIT before failure | `PASS` rollback observed | Application behavior remains service-test evidence |
| Duplicate FileVersion | `PASS` as negative DB constraint in DB-A | Live app+DB not executed |

No duplicate FileVersion or duplicate canonical object was created by the
database positive/negative cases.

## 9. SQLSTATE Summary

```text
23514  terminal/invalid lifecycle, operation and binding constraints
42501  FileVersion deletion rejected
23514  deferred WRITING-attempt/lifecycle mismatch at COMMIT
23514  R3 precheck dangerous historical object state
2      client connection lost after real proxy fault injection
```

## 10. Evidence Files

Evidence was written outside the repository under the temporary instance
directory:

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
```

No password or connection string is included in these files.

## 11. Unverified Items and Findings

### CM1-PG-P2-01 — objectKey and append concurrency negative writes not executed

Isolated duplicate object-key and expected-current append inserts were not
constructed. The indexes and static tests exist, but this runtime matrix is
`NOT VERIFIED`.

### CM1-PG-P3-01 — failed Prisma Migration history not tested on non-empty state

Prisma clean history is PASS. DB-C's failure was executed through `psql`, so
Prisma's behavior for a failed non-empty Migration (including history status) is
`NOT VERIFIED`.

### CM1-PG-P2-02 — live application-to-PostgreSQL recovery not executed

No Web/Worker service was started. Service-level recovery remains local
harness evidence, and real app+DB commit-loss recovery is `NOT VERIFIED`.

No P0/P1 database defect was found in the executed matrix.

### Broader unverified boundaries

```text
Real Provider:                  NOT VERIFIED
Provider conditional create:   NOT VERIFIED
Provider exact discovery:      NOT VERIFIED
Windows OS-level storage:      NOT VERIFIED
IAM/ACL:                       NOT VERIFIED
Legacy Worker drain:           NOT EXECUTED
Production deployment:         NOT AUTHORIZED
Build/E2E:                     NOT EXECUTED
```

## 12. Instance Shutdown

The dedicated instance was stopped with:

```text
pg_ctl -D <temporary-data-directory> -m fast -w stop
exit 0
pg_isready 127.0.0.1:55439 -> no response
port 55439 -> FREE
```

The temporary data directory and evidence directory were retained for audit.
No existing PostgreSQL service or database was stopped, modified or removed.

## 13. Git State

### 13.1 At validation start

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  70
Untracked files:        71
```

### 13.2 After validation and report creation

The validation itself did not modify repository source, tests, Schema or
Migration. The report is the only new repository file.

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  71
Untracked files:        72
New report:             docs/architecture/wp-2a-cm1-postgresql-controlled-validation.md
```

No Git reset, restore, clean, checkout, stash, add, commit or push was used.
No `$null`, `UNKNOWN'`, `.next`, `apps/worker/dist`, `.env` or `.env.test` was
read, modified, moved, hashed or deleted.

## 14. Final Verdict

```text
PASS WITH RESTRICTIONS — POSTGRESQL VALIDATION PARTIALLY COMPLETE
```

The isolated instance, clean migration, non-empty Legacy migration, fail-before-
DDL precheck, legal object chain, core terminal constraints, real two-session
CAS, stale executor fencing and real PostgreSQL COMMIT-response loss all
produced expected results.

Remaining restrictions are explicit and must be closed before claiming complete
database validation:

- isolated objectKey duplicate and append-race writes;
- Prisma failure history for dangerous non-empty Migration;
- live application service recovery against the isolated database;
- Provider, Windows OS, ACL/IAM, E2E and production boundaries.

This report is not production authorization and does not resolve R5, BV7, BV8,
historical R8 or P2-05.
