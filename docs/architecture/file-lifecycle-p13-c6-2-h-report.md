# P1-3 C-6.2-H Lifecycle 初始状态白名单实施报告

## 文档信息

- 阶段：`C-6.2-H`
- 日期：`2026-11-18`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 结论：`PASS WITH WARNINGS`

## 1. Git 分支、HEAD 和工作树

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD:   b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

现有未提交文件全部保留。未执行 Git add、commit、reset、restore、clean 或 checkout。

## 2. 数据库身份

```text
current_database = elevator_advisor_p13_validation
current_user     = postgres
session_user     = postgres
server_addr      = 127.0.0.1
server_port      = 5432
server_version   = 18.7
```

只连接了专用验证数据库。Migration 通过仓库外临时 Prisma 工作区执行，未加载项目 `.env`。

## 3. Migration 前数据库状态

Migration 前：

```text
Migration 总数 = 12
成功            = 12
未完成          = 0
回滚            = 0
```

A Migration：

```text
20261117130000_phase37_p13_lifecycle_insert_guard
checksum = ca1e3b737f1cc44b3fc40911634cdbc18a41b239073bb56d53f0432b11d6bfdb
```

Lifecycle Trigger：

```text
p13_storage_lifecycle_guard
BEFORE INSERT OR DELETE OR UPDATE
FOR EACH ROW
tgtype = 31
```

`p13_protect_storage_lifecycle()`：

```text
prosrc MD5 = a07498524d0f6b88514d7226d456bd32
A attestation position > 0
B initial-state guard position = 0
```

25 个函数、约束、索引和 ACL 已固定基线。相关表均为 0 行，无其他会话或锁等待。

## 4. B Migration 名称和完整 SQL

路径：

```text
prisma/migrations/20261117140000_phase37_p13_lifecycle_initial_state_guard/migration.sql
```

完整 SQL：

```sql
-- Restrict ordinary Lifecycle INSERTs to their approved initial states.
CREATE OR REPLACE FUNCTION "p13_protect_storage_lifecycle"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'storage_object_lifecycle cannot be deleted'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM "p13_assert_staging_cleanup_attestation"(NEW);

    IF NEW."objectKind" IS NULL
       OR NEW.state IS NULL
       OR NOT (
         (NEW."objectKind" = 'STAGING'
          AND NEW.state = 'STAGING_RESERVED')
         OR
         (NEW."objectKind" = 'CANONICAL'
          AND NEW.state = 'FINALIZING')
       )
    THEN
      RAISE EXCEPTION 'invalid storage lifecycle initial state'
        USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW."objectKind" IS DISTINCT FROM OLD."objectKind"
     OR NEW."storageKey" IS DISTINCT FROM OLD."storageKey"
     OR NEW."reservedAttemptId" IS DISTINCT FROM OLD."reservedAttemptId"
     OR NEW."reservedIntentId" IS DISTINCT FROM OLD."reservedIntentId"
  THEN
    RAISE EXCEPTION 'storage lifecycle identity is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD."closeAttestationId" IS NOT NULL
     AND (
       NEW."closeAttestationId" IS DISTINCT FROM OLD."closeAttestationId"
       OR NEW."closedByAttemptId" IS DISTINCT FROM OLD."closedByAttemptId"
       OR NEW."closedOwnerToken" IS DISTINCT FROM OLD."closedOwnerToken"
       OR NEW."closedGeneration" IS DISTINCT FROM OLD."closedGeneration"
       OR NEW."writerClosedAt" IS DISTINCT FROM OLD."writerClosedAt"
       OR NEW."closedDev" IS DISTINCT FROM OLD."closedDev"
       OR NEW."closedIno" IS DISTINCT FROM OLD."closedIno"
       OR NEW."closedSizeBytes" IS DISTINCT FROM OLD."closedSizeBytes"
       OR NEW."closedChecksumSha256" IS DISTINCT FROM OLD."closedChecksumSha256"
       OR NEW."closedIdentityVerified" IS DISTINCT FROM OLD."closedIdentityVerified"
       OR NEW."ownerToken" IS DISTINCT FROM OLD."ownerToken"
       OR NEW."fencingGeneration" IS DISTINCT FROM OLD."fencingGeneration"
       OR NEW."sizeBytes" IS DISTINCT FROM OLD."sizeBytes"
       OR NEW."checksumSha256" IS DISTINCT FROM OLD."checksumSha256"
     )
  THEN
    RAISE EXCEPTION 'close attestation and lifecycle snapshot are immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.state IS DISTINCT FROM OLD.state
     AND NOT (
       (OLD.state = 'STAGING_RESERVED'
        AND NEW.state = 'STAGING')
       OR
       (OLD.state = 'STAGING'
        AND NEW.state IN ('STAGING_READY', 'STAGING_ABANDONED'))
       OR
       (OLD.state = 'STAGING_READY'
        AND NEW.state IN ('DELETED', 'QUARANTINING', 'STAGING_ABANDONED'))
       OR
       (OLD.state = 'STAGING_ABANDONED'
        AND NEW.state IN ('QUARANTINING', 'DELETED'))
       OR
       (OLD.state = 'FINALIZING'
        AND NEW.state IN ('ACTIVE', 'QUARANTINING', 'FAILED_RETAINED'))
       OR
       (OLD.state = 'QUARANTINING'
        AND NEW.state IN ('QUARANTINED', 'FAILED_RETAINED'))
       OR
       (OLD.state = 'QUARANTINED'
        AND NEW.state IN ('PURGE_PENDING', 'RESTORING', 'FAILED_RETAINED'))
       OR
       (OLD.state = 'RESTORING'
        AND NEW.state IN ('ACTIVE', 'FAILED_RETAINED'))
       OR
       (OLD.state = 'PURGE_PENDING'
        AND NEW.state IN ('DELETED', 'FAILED_RETAINED'))
     )
  THEN
    RAISE EXCEPTION 'invalid storage lifecycle state transition'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.state = 'ACTIVE'
     AND NEW.state IS DISTINCT FROM 'ACTIVE'
     AND EXISTS (
       SELECT 1 FROM "file_version"
       WHERE "storageKey" = OLD."storageKey"
     )
  THEN
    RAISE EXCEPTION 'ACTIVE lifecycle with FileVersion cannot leave ACTIVE'
      USING ERRCODE = '23514';
  END IF;

  PERFORM "p13_assert_staging_cleanup_attestation"(NEW);

  RETURN NEW;
END;
$$;
```

## 5. Migration checksum

```text
SHA-256:
3AC99E01D98D4C125BED5F3AC1CE2769B0B780E45F0E51B4FEECC2FB408ABB2C

_prisma_migrations.checksum:
3ac99e01d98d4c125bed5f3ac1ce2769b0b780e45f0e51b4feecc2fb408abb2c
```

## 6. Migration 执行结果

```text
Applying migration 20261117140000_phase37_p13_lifecycle_initial_state_guard
All migrations have been successfully applied.
Exit code = 0
finished_at = 2026-11-18 00:35:17.569508+08
applied_steps_count = 1
```

Migration 后：

```text
Migration 总数 = 13
成功            = 13
未完成          = 0
回滚            = 0
重复记录        = 0
```

## 7. Migration 后 Catalog

Lifecycle Trigger：

```text
Count = 6

p13_storage_lifecycle_guard:
  BEFORE INSERT OR DELETE OR UPDATE
  FOR EACH ROW
  tgtype = 31
  tgenabled = O
  tgdeferrable = false
  tginitdeferred = false
```

四个 Deferred Constraint Trigger 和一个 TRUNCATE Trigger 保持不变，全部启用。

函数：

```text
function_count = 25
all_body_digest = 645535d18a6c95e8c406eaa1d49ba915
other_24_body_digest = 64bc8c0ab10750d5787a2bbc26b1415c
```

`p13_protect_storage_lifecycle()`：

```text
Owner           = elevator_p13_validation_migrator
prosecdef        = false
provolatile      = v
proisstrict      = false
proconfig        = NULL
proacl           = NULL
prosrc MD5       = ce3fd9222f74c2c0dc9bc2d7c1039e60
A attestation     position = 173
B guard           position = 524
UPDATE guard      position = 3254
DELETE guard      position = 56
```

约束摘要和索引摘要执行前后一致：

```text
constraint_digest = 09bc1b0a0d174e33ea8c7bc5d75a453a
constraint_count  = 327

index_digest      = 5c87b72a1e2fa87966c38768459fd41c
index_count       = 47
```

## 8. 关键分支验证

```text
DELETE:
  storage_object_lifecycle cannot be deleted / 42501

INSERT:
  A cleanup attestation
  -> B whitelist
     STAGING   + STAGING_RESERVED
     CANONICAL + FINALIZING
  -> RETURN NEW

UPDATE:
  原 identity / immutability / transition / ACTIVE 保护
  -> A cleanup attestation
  -> RETURN NEW
```

## 9. A 保护回归

B-DB-16 使用 STAGING DELETED 且缺少完整 close attestation：

```text
SQLSTATE = 23514
Error = STAGING cleanup requires complete identity-verified close attestation
Source = p13_assert_staging_cleanup_attestation
Stage = BEFORE INSERT
```

证明 A attestation 在 B 普通初始状态检查之前继续执行。

## 10. B-DB-01 至 B-DB-16 结果

| ID | 实际 SQL / 操作 | 状态 | SQLSTATE | 失败阶段 | 事务结果 |
|---|---|---|---|---|---|
| B-DB-01 | 合法 Intent/Attempt/SR INSERT 后激活 Intent；`SET CONSTRAINTS ALL IMMEDIATE` | PARTIAL | N/A | N/A | ROLLBACK；真实 COMMIT 未验证 |
| B-DB-02 | 直接 INSERT STAGING `STAGING` | PASS | `23514` | BEFORE INSERT | SAVEPOINT 回滚 + ROLLBACK |
| B-DB-03 | 直接 INSERT `STAGING_READY` | PASS | `23514` | BEFORE INSERT | SAVEPOINT 回滚 + ROLLBACK |
| B-DB-04 | 直接 INSERT `STAGING_ABANDONED` | PASS | `23514` | BEFORE INSERT | SAVEPOINT 回滚 + ROLLBACK |
| B-DB-05 | 直接 INSERT CANONICAL `FINALIZING` | PARTIAL | N/A | N/A | ROLLBACK；Deferred/COMMIT 未执行 |
| B-DB-06 | 直接 INSERT CANONICAL `ACTIVE` | PASS | `23514` | BEFORE INSERT | SAVEPOINT 回滚 + ROLLBACK |
| B-DB-07 | 直接 INSERT CANONICAL `QUARANTINED` | PASS | `23514` | BEFORE INSERT | SAVEPOINT 回滚 + ROLLBACK |
| B-DB-08 | 直接 INSERT CANONICAL `PURGE_PENDING` | PASS | `23514` | BEFORE INSERT | SAVEPOINT 回滚 + ROLLBACK |
| B-DB-09 | 直接 INSERT CANONICAL `DELETED` | PASS | `23514` | BEFORE INSERT | SAVEPOINT 回滚 + ROLLBACK |
| B-DB-10 | 直接 INSERT CANONICAL `FAILED_RETAINED` | PASS | `23514` | BEFORE INSERT | SAVEPOINT 回滚 + ROLLBACK |
| B-DB-11 | STAGING_RESERVED -> STAGING；Attempt WRITING；SET CONSTRAINTS | PARTIAL | N/A | N/A | ROLLBACK；真实 COMMIT 未验证 |
| B-DB-12 | STAGING_RESERVED -> DELETED | PASS | `23514` | BEFORE UPDATE | SAVEPOINT 回滚 + ROLLBACK |
| B-DB-13 | 完整 FZ Lifecycle + Operation + Attempt + SET CONSTRAINTS | PARTIAL | N/A | N/A | ROLLBACK；真实 COMMIT 未验证 |
| B-DB-14 | STAGING/FINALIZING、CANONICAL/STAGING_RESERVED、NULL objectKind | PASS | `23514` | BEFORE INSERT | SAVEPOINT 回滚 + ROLLBACK |
| B-DB-14 | 未知 enum literal `NOT_A_STATE` | PASS | `22P02` | 参数解析 | SAVEPOINT 回滚 + ROLLBACK |
| B-DB-15 | CANONICAL QUARANTINING；带完整 A proof 的 STAGING DELETED | PASS | `23514` | BEFORE INSERT | SAVEPOINT 回滚 + ROLLBACK |
| B-DB-16 | STAGING DELETED 缺 close attestation | PASS | `23514` | A cleanup attestation | SAVEPOINT 回滚 + ROLLBACK |

统计：

```text
PASS    = 12
PARTIAL = 4
FAIL    = 0
BLOCKED = 0
NOT RUN = 0
```

## 11. Fixture 创建顺序

- B-DB-01/11：User -> Customer -> Project -> Intent -> Attempt -> STAGING_RESERVED，然后合法 UPDATE。
- B-DB-05：建立完整 STAGING 上传链，再 INSERT CANONICAL FINALIZING。
- B-DB-13：FX-FZ 完整流程，INSERT FINALIZE Operation 并设置 currentOperation，Attempt READY -> FINALIZING。
- B-DB-02/03/04：先建立合法上传依赖，再直接 INSERT 非初始 STAGING 状态。
- B-DB-06/07/08/09/10：直接 INSERT 非 FINALIZING CANONICAL 状态，由 B 在 CHECK/FK 前拒绝。
- B-DB-14：使用非法 kind/state 组合、NULL 和未知 enum。
- B-DB-15：测试 orphan QNING 与带完整 proof 的空 STAGING DELETED 普通入口。
- B-DB-16：测试 A cleanup attestation 的原有错误路径。

## 12. Deferred Trigger 验证

以下测试成功执行 `SET CONSTRAINTS ALL IMMEDIATE`：

- B-DB-01：上传链成功；
- B-DB-11：Lifecycle/Attempt UPDATE 最终关系成功；
- B-DB-13：FINALIZING/Operation/Attempt 完整链成功。

这些测试随后均执行 `ROLLBACK`。

B-DB-05 只验证 B 初始状态检查允许 FINALIZING，不执行 Deferred/COMMIT，因此标记 PARTIAL。

## 13. COMMIT / ROLLBACK

Migration 本身：

```text
Prisma migrate deploy COMMIT = SUCCESS
```

成功型 Fixture：

```text
Statement               = SUCCESS
Deferred constraints    = SUCCESS（B-DB-01/11/13）
Final transaction action = ROLLBACK
Real fixture COMMIT     = NOT VERIFIED
```

未执行真实 Fixture COMMIT，是因为当前没有已批准的安全清理协议，而 DELETE/TRUNCATE 受保护。对应测试标记 PARTIAL，不标记 PASS。

拒绝型测试：

```text
SAVEPOINT isolation + ROLLBACK SUCCESS
```

## 14. 测试数据清理结果

最终：

```text
file_upload_intent       = 0
file_version             = 0
storage_object_lifecycle = 0
storage_object_operation = 0
file_upload_attempt      = 0
file                     = 0
user                     = 0
customer                 = 0
project                  = 0
```

没有本阶段测试数据残留。

## 15. 角色和 ACL 对比

角色属性未变化：

```text
elevator_p13_validation_owner:
  NOLOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE,
  NOREPLICATION, NOBYPASSRLS, NOINHERIT

elevator_p13_validation_migrator:
  NOLOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE,
  NOREPLICATION, NOBYPASSRLS, NOINHERIT

elevator_p13_validation_runtime:
  does not exist
```

数据库 Owner、Database ACL、public Schema Owner/ACL 不变。

25 个函数：

```text
Owner                 = elevator_p13_validation_migrator
SECURITY DEFINER      = 0
VOLATILE              = 25
STRICT                = 0
proconfig NULL        = 25
proacl NULL           = 25
PUBLIC EXECUTE        = 25
```

PUBLIC EXECUTE 是既有阶段 D 待处理项，本阶段未修改。

## 16. 受保护文件哈希

```text
prisma/schema.prisma
78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299

原始 P1-3 Migration
187D82A00DB73CB6F5D79C97DCD6B4FF2E01BD7E5F78BB9E1273D54D8A141479

A Migration
CA1E3B737F1CC44B3FC40911634CDBC18A41B239073BB56D53F0432B11D6BFDB

Fixture Builder
EB69AD1825F926482D481EE46F08C34700B2B24B69216C02386D0EE269B5888B

Harness
2B1503B8A535E1B38D80C928C2D292F89BF3803E3D56C1A61C7B92B8B47E681B

Tooling Types
75A6B8DE2D16A5154A9D073F70DAB42260342308EAF569744AED06475AE01FD1

C-6.2-G 设计
DD091AE5395B0E5A96CFB7D3B8FFC74091DD0F2B968A4F261920246E0991A0CB
```

## 17. 新增和修改文件

新增：

```text
prisma/migrations/20261117140000_phase37_p13_lifecycle_initial_state_guard/migration.sql
3AC99E01D98D4C125BED5F3AC1CE2769B0B780E45F0E51B4FEECC2FB408ABB2C

apps/web/tests/p13-b-migration.test.ts
1180D80892C13BCCD0C367D2810F0F4DA89DA0D0F62115BAD5308A4BFC7AB6C1

docs/architecture/file-lifecycle-p13-c6-2-h-report.md
（报告哈希由最终交付消息提供，避免自引用）
```

修改：

```text
docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md
72741FCB0A7B24626DCBC0D21E135DA97D3EDD551F80D439D4E676812CD45CAF

docs/architecture/file-lifecycle-p13-implementation-status.md
AB263470F49C35480C1FE6E54E47D3AF7EA1B287B392DE555F8650B7133EFBB5
```

## 18. 失败、警告和 BLOCKED

失败：

```text
无
```

警告：

- B-DB-01、05、11、13 未执行真实 Fixture COMMIT，标记 PARTIAL；
- 没有安全清理协议，不能在保留型验证库留下成功 Fixture 数据；
- PUBLIC EXECUTE 仍存在；
- CANONICAL orphan QUARANTINING 和空 STAGING DELETED 仍未实现；
- FX-QN、FX-PP、FX-DE、FX-FR 仍不能按直接终态方式构造。

BLOCKED：

- 特殊协议成功路径；
- 需真实 COMMIT 且无法安全清理的测试。

## 19. 未完成的真实成功 COMMIT 验证

未验证：

- 合法 STAGING_RESERVED 的真实 Fixture COMMIT；
- 合法 STAGING UPDATE 的真实 COMMIT；
- 完整 CANONICAL FINALIZING 链的真实 FINAL COMMIT；
- COMMIT 后新事务观察 Fixture 持久化。

这些测试需要独立的数据库 Clone 或经验证的可回滚清理协议。

## 20. 下一阶段建议

1. 审核 B 函数和 Migration。
2. 为成功型测试确定一次性 Clone 或安全清理协议。
3. 完成真实 COMMIT 测试。
4. 按 B 规则调整 Fixture Builder。
5. 单独设计与实施 orphan/空 STAGING 特殊协议。
6. 继续保留 C 和 Runtime/ACL 收敛为独立授权事项。

## 最终状态

```text
C-6.2-H:
PASS WITH WARNINGS

B Design:
FROZEN

B Migration:
CREATED / APPLIED

Database:
elevator_advisor_p13_validation ONLY

A Migration:
UNCHANGED

Original P1-3 Migration:
UNCHANGED

Prisma Schema:
UNCHANGED

Business Code:
UNCHANGED

ACL:
UNCHANGED

Roles:
UNCHANGED

C:
NOT AUTHORIZED

Special Protocols:
NOT IMPLEMENTED

Git Commit:
NOT CREATED

Git Cleanup:
NOT EXECUTED

Test Data:
CLEAN

Next Phase:
NOT AUTHORIZED
```
