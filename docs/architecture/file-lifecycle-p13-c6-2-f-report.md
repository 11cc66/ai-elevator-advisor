# P1-3 C-6.2-F Lifecycle INSERT Trigger 实施与验收报告

## 文档信息

- 阶段：`C-6.2-F`
- 日期：`2026-11-18`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 数据库：`elevator_advisor_p13_validation`
- PostgreSQL：`18.7`
- Prisma CLI：`6.19.0`
- 结论：`PASS WITH WARNINGS`

## 1. 阶段结论

A 项修复已实施并成功应用到专用验证数据库：

```text
p13_storage_lifecycle_guard
BEFORE UPDATE OR DELETE
-> BEFORE INSERT OR UPDATE OR DELETE
```

目标 Trigger 的实际 Catalog 结果：

```text
tgtype       = 31
tgenabled    = O
tgdeferrable = false
tginitdeferred = false
```

现有 `p13_protect_storage_lifecycle()` INSERT 分支已实际执行。函数、其他五个 Lifecycle Trigger、CHECK、FK、ACL 和其他数据库对象未修改。

A 不等同于 B：

- A 不禁止 CANONICAL 非 FINALIZING 初始状态；
- A 不禁止 STAGING 非 cleanup 普通非法初始状态；
- B 的普通初始状态白名单仍未实施。

## 2. Migration 文件

路径：

```text
prisma/migrations/20261117130000_phase37_p13_lifecycle_insert_guard/migration.sql
```

完整 SQL：

```sql
-- Restore INSERT coverage for the existing lifecycle protection function.
CREATE OR REPLACE TRIGGER "p13_storage_lifecycle_guard"
BEFORE INSERT OR UPDATE OR DELETE
ON "storage_object_lifecycle"
FOR EACH ROW
EXECUTE FUNCTION "p13_protect_storage_lifecycle"();
```

SHA-256：

```text
CA1E3B737F1CC44B3FC40911634CDBC18A41B239073BB56D53F0432B11D6BFDB
```

PostgreSQL 18 本地官方文档确认：

- `CREATE OR REPLACE TRIGGER` 可以替换同名、同父表的现有普通 Trigger；
- 替换时全部 Trigger 属性按新定义生效；
- 该方案是单条 DDL，不依赖多语句 DROP/CREATE 的原子性。

Migration 符合 Prisma Migration 文件约定。执行通过仓库外临时工作区完成：

- 临时工作区包含全部 12 条 Migration；
- 12 条复制文件 SHA-256 与仓库源文件完全一致；
- 临时工作区没有 `.env`、`.env.test` 或 `package.json`；
- Prisma 输出没有 `Environment variables loaded from .env`。

## 3. 修改文件清单

新增：

| 文件 | 用途 | SHA-256 |
|---|---|---|
| `prisma/migrations/20261117130000_phase37_p13_lifecycle_insert_guard/migration.sql` | A 前向 Migration | `CA1E3B737F1CC44B3FC40911634CDBC18A41B239073BB56D53F0432B11D6BFDB` |
| `apps/web/tests/p13-a-migration.test.ts` | A Migration 静态保护测试 | `6F3D92D8C547F1AE7FD5D7AC01E29CFB8B68AA1477A4706C08FD60847ACA08F5` |
| `docs/architecture/file-lifecycle-p13-c6-2-f-report.md` | 本阶段验收报告 | 文件自身哈希不内嵌 |

修改：

| 文件 | 原因 |
|---|---|
| `docs/architecture/file-lifecycle-p13-implementation-status.md` | 记录 A 已实施并应用，保留 B/C/特殊协议未完成状态 |

未修改：

- `prisma/schema.prisma`
- 原始 P1-3 Migration
- 25 个 PostgreSQL 函数
- 其他 Lifecycle Trigger
- CHECK、FK、索引
- Fixture Builder
- Harness、Types 和现有 P13 工具测试
- ACL、角色、HBA
- `.env`、`.env.test`

## 4. Migration 执行结果

执行前：

```text
Migration 数量 = 11
成功            = 11
未完成          = 0
回滚            = 0
```

Prisma `migrate status` 基线：

```text
12 migrations found
11 applied
1 pending
pending = 20261117130000_phase37_p13_lifecycle_insert_guard
```

执行命令语义：

```text
prisma migrate deploy --schema <external-workspace>/prisma/schema.prisma
```

实际结果：

```text
Applying migration 20261117130000_phase37_p13_lifecycle_insert_guard
All migrations have been successfully applied.
Exit code = 0
```

数据库记录：

```text
migration_name = 20261117130000_phase37_p13_lifecycle_insert_guard
finished_at    = 2026-11-18 00:09:59.043027+08
applied_steps_count = 1
checksum       = ca1e3b737f1cc44b3fc40911634cdbc18a41b239073bb56d53f0432b11d6bfdb
rolled_back_at = NULL
logs           = NULL
```

执行后：

```text
Migration 总数 = 12
成功            = 12
未完成          = 0
回滚            = 0
重复记录        = 0
```

## 5. Trigger Catalog 验收

执行前：

```sql
CREATE TRIGGER p13_storage_lifecycle_guard
BEFORE DELETE OR UPDATE
ON storage_object_lifecycle
FOR EACH ROW
EXECUTE FUNCTION p13_protect_storage_lifecycle()
```

```text
tgtype = 27
tgenabled = O
tgdeferrable = false
tginitdeferred = false
```

执行后：

```sql
CREATE TRIGGER p13_storage_lifecycle_guard
BEFORE INSERT OR DELETE OR UPDATE
ON storage_object_lifecycle
FOR EACH ROW
EXECUTE FUNCTION p13_protect_storage_lifecycle()
```

```text
tgtype = 31
tgenabled = O
tgdeferrable = false
tginitdeferred = false
```

Catalog 的显示顺序为 `INSERT OR DELETE OR UPDATE`，语义为 INSERT、UPDATE、DELETE 三个事件。

其他五个 Lifecycle Trigger 执行前后保持一致：

| Trigger | 执行后状态 |
|---|---|
| `p13_lifecycle_file_version_bijection_guard` | `AFTER INSERT OR UPDATE`，Deferred，`tgtype=21`，启用 |
| `p13_lifecycle_operation_guard` | `AFTER INSERT OR UPDATE`，Deferred，`tgtype=21`，启用 |
| `p13_lifecycle_upload_chain_guard` | `AFTER INSERT OR UPDATE`，Deferred，`tgtype=21`，启用 |
| `p13_staging_cleanup_attestation_guard` | `AFTER INSERT OR UPDATE`，Deferred，`tgtype=21`，启用 |
| `p13_storage_lifecycle_truncate_guard` | `BEFORE TRUNCATE`，Statement，`tgtype=34`，启用 |

## 6. 函数和其他 Trigger 完整性

执行前后函数摘要一致：

```text
function_count = 25
body_digest    = 6076896783e9aa742fcc432a9e4ba542
```

25 个函数的实际属性保持：

```text
Owner                    = elevator_p13_validation_migrator
SECURITY DEFINER count   = 0
VOLATILE count           = 25
STRICT count             = 0
proconfig NULL count     = 25
proacl NULL count        = 25
PUBLIC EXECUTE count     = 25
```

这说明 A Migration 没有修改函数体、函数 Owner 或函数 ACL。

`p13_protect_storage_lifecycle()` 仍保留 INSERT 分支：

```sql
IF TG_OP = 'INSERT' THEN
  PERFORM "p13_assert_staging_cleanup_attestation"(NEW);
  RETURN NEW;
END IF;
```

PUBLIC EXECUTE 仍存在，是既有阶段 D 警告，本阶段没有执行 GRANT 或 REVOKE。

## 7. 数据库行为测试

所有测试均在显式事务中执行，预期失败使用 SAVEPOINT；测试完成后全部 ROLLBACK。

### A-DB-01

```text
Status: PASS
Actual SQLSTATE: N/A
Failure stage: N/A
Transaction result: ROLLBACK SUCCESS
Evidence: 合法 Intent -> RESERVED Attempt -> STAGING_RESERVED Lifecycle ->
          UPLOADING/currentAttempt；SET CONSTRAINTS ALL IMMEDIATE 成功。
```

### A-DB-02

```text
Status: PASS
Actual SQLSTATE: 23514
Error: STAGING cleanup requires complete identity-verified close attestation
Failure stage: BEFORE INSERT Trigger / INSERT statement
Transaction result: statement aborted; ROLLBACK TO SAVEPOINT succeeded; final ROLLBACK succeeded
Evidence: STAGING DELETED 无 close attestation 被 p13_protect_storage_lifecycle INSERT 分支拒绝。
```

### A-DB-03

```text
Status: PASS
Actual SQLSTATE: 23514
Error: close attestation does not match lifecycle ownership/content snapshot
Failure stage: BEFORE INSERT Trigger / INSERT statement
Transaction result: statement aborted; ROLLBACK TO SAVEPOINT succeeded; final ROLLBACK succeeded
Evidence: closedSizeBytes 与 Lifecycle sizeBytes 不一致，被 attestation 快照检查拒绝。
```

### A-DB-04

```text
Status: PASS（A 机制探针）/ COMMIT NOT VERIFIED
Actual SQLSTATE: N/A
Failure stage: NONE for INSERT and SET CONSTRAINTS
Transaction result: ROLLBACK SUCCESS
Evidence: 完整 identity-verified、快照一致的 STAGING DELETED 通过 BEFORE INSERT 和
          SET CONSTRAINTS ALL IMMEDIATE；为遵守无测试数据残留要求，未执行真实 COMMIT。
```

该结果只证明 A 函数会接受完整证明。空 STAGING 直接 DELETED 的业务协议仍为
`NEEDS DECISION`，不得据此认定该初始状态合法。

### A-DB-05

```text
Status: PASS
Actual SQLSTATE: N/A
Failure stage: NONE
Transaction result: ROLLBACK SUCCESS
Evidence: 合法 CANONICAL FINALIZING + FINALIZE Operation + source Attempt；
          CANONICAL 未触发 STAGING attestation；SET CONSTRAINTS ALL IMMEDIATE 成功。
```

### A-DB-06

```text
Status: PASS
Actual SQLSTATE: N/A
Failure stage: NONE
Transaction result: ROLLBACK SUCCESS
Evidence: 合法 INSERT STAGING_RESERVED 后 UPDATE 为 STAGING，Attempt UPDATE 为 WRITING；
          INSERT 和 UPDATE 两个 Trigger 路径均正常。
```

### A-DB-07

```text
Status: PASS
Actual SQLSTATE: 23514
Error: invalid storage lifecycle state transition
Failure stage: BEFORE UPDATE Trigger / UPDATE statement
Transaction result: statement aborted; ROLLBACK TO SAVEPOINT succeeded; final ROLLBACK succeeded
Evidence: STAGING_RESERVED -> DELETED 被原 UPDATE 状态白名单拒绝，状态保持 STAGING_RESERVED。
```

### A-DB-08

```text
Status: PASS
Actual SQLSTATE: 42501
Error: storage_object_lifecycle cannot be deleted
Failure stage: BEFORE DELETE Trigger / DELETE statement
Transaction result: statement aborted; ROLLBACK TO SAVEPOINT succeeded; final ROLLBACK succeeded
Evidence: DELETE 后 Lifecycle 行仍存在，随后整事务 ROLLBACK。
```

### A-DB-09

```text
Status: PASS
Actual SQLSTATE: 23514
Error: invalid PENDING upload chain
Failure stage: SET CONSTRAINTS ALL IMMEDIATE（Deferred 最终检查阶段）
Transaction result: deferred check aborted; ROLLBACK TO SAVEPOINT succeeded; final ROLLBACK succeeded
Evidence: Intent 仍为 PENDING 且存在一个 RESERVED Attempt；Deferred chain 正确拒绝最终关系。
```

### A-DB-10

```text
Status: PASS
Actual SQLSTATE: 23514
Error: STAGING cleanup requires complete identity-verified close attestation
Failure stage: BEFORE INSERT Trigger / INSERT statement
Transaction result: ROLLBACK SUCCESS
Evidence: 失败后 user/intent/attempt/lifecycle 查询计数均为 0；后续新事务可正常执行。
```

## 8. 数据库最终状态

最终独立只读审计：

```text
file                     = 0
file_upload_intent       = 0
file_upload_attempt      = 0
file_version             = 0
storage_object_lifecycle = 0
storage_object_operation = 0
user                     = 0
customer                 = 0
project                  = 0
```

测试数据全部回滚，没有残留。

```text
其他活动会话 = 0
其他锁等待   = 0
目标 Trigger = 启用，tgtype=31
Migration    = 12/12 成功
```

## 9. 测试结果

| 检查 | 结果 |
|---|---|
| A Migration 静态测试 | 2/2 passed |
| P1-3 工具测试 | 26/26 passed |
| Web 单元测试 | 77/77 passed |
| Web TypeScript | passed |
| Migration status | 1 pending before deploy |
| Prisma migrate deploy | exit code 0 |
| Migration 后 Catalog | passed |
| A-DB-01 至 A-DB-10 | 10 项完成；A-DB-04 实际 COMMIT 未执行 |

## 10. 未解决警告

1. B 的普通初始状态白名单未实施。
2. CANONICAL orphan `QUARANTINING` 协议未冻结。
3. 空 STAGING 直接 `DELETED` 协议未冻结。
4. FX-QN、FX-PP、FX-DE、FX-FR 的完整合法创建路径仍未完成。
5. PUBLIC 对 25 个 P1-3 函数仍有默认 EXECUTE，阶段 D 待收敛。
6. A-DB-04 的真实成功 COMMIT 未执行，因为不能在保留型验证库留下无法通过 DELETE 清理的测试数据。

## 11. 最终授权状态

```text
A Migration:
IMPLEMENTED

A Migration Database Execution:
SUCCESS

B:
NOT AUTHORIZED

C:
NOT AUTHORIZED

B2:
NOT AUTHORIZED

Next Phase:
NOT AUTHORIZED
```
