# P1-3 Lifecycle 初始状态白名单机制设计

## 文档信息

- 设计版本：`C-6.2-G`
- 日期：`2026-11-18`
- 代码基线：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 设计状态：`FROZEN`
- 特殊协议：`OPEN DECISIONS`
- B Migration：`NOT CREATED`
- 数据库：`NOT CONNECTED`

相关文档：

- `docs/architecture/file-lifecycle-p13-design-freeze.md`
- `docs/architecture/file-lifecycle-p13-c5-1-revision.md`
- `docs/architecture/file-lifecycle-p13-c6-2-c2-decisions.md`
- `docs/architecture/file-lifecycle-p13-c6-2-f-report.md`
- `docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md`

## 1. 设计背景

C-6.2-F 已恢复：

```sql
p13_storage_lifecycle_guard
BEFORE INSERT OR UPDATE OR DELETE
FOR EACH ROW
```

现有 `p13_protect_storage_lifecycle()` INSERT 分支已经能够执行 STAGING cleanup attestation，但尚未限制普通 Lifecycle 的初始 `objectKind` / `state`。

因此当前存在两个不同问题：

```text
字段结构合法
生命周期创建路径合法
```

A 解决 cleanup 证明执行问题；B 只解决普通初始状态白名单问题。

## 2. 当前保护机制

### 2.1 BEFORE Trigger

唯一的 Lifecycle BEFORE ROW Trigger 是：

```text
p13_storage_lifecycle_guard
```

当前覆盖 INSERT、UPDATE、DELETE。

INSERT 当前执行：

```sql
PERFORM "p13_assert_staging_cleanup_attestation"(NEW);
RETURN NEW;
```

该逻辑：

- 对 CANONICAL 立即返回；
- 不限制 STAGING/CANONICAL 的初始状态；
- 只检查 STAGING cleanup proof 和快照一致性；
- 不读取 OLD；
- 不写表。

### 2.2 CHECK / FK

现有 CHECK 和 FK 限制字段形状，例如：

- STAGING reserved ownership 非空；
- CANONICAL reserved ownership 为空；
- `staging/` 与 `objects/` 路径命名空间；
- owner、generation、lease 与状态组合；
- content 与状态组合；
- quarantine 字段组合；
- close attestation 完整性和快照；
- Lifecycle 与 Attempt、Operation、FileVersion 的关系。

这些约束不能证明记录是从哪个初始状态开始生命周期。

### 2.3 Deferred Constraint Trigger

Lifecycle 上四个 Deferred Constraint Trigger：

```text
p13_lifecycle_upload_chain_guard
p13_lifecycle_operation_guard
p13_lifecycle_file_version_bijection_guard
p13_staging_cleanup_attestation_guard
```

它们在 INSERT/UPDATE 后排队，并在事务最终检查阶段验证：

- Intent / Attempt / Lifecycle 上传链；
- Operation 与 Lifecycle 的双向关系；
- ACTIVE 与非 ACTIVE 的 FileVersion 基数；
- STAGING cleanup attestation。

这些检查可以拒绝最终关系不完整的记录，但不能单独证明直接 INSERT 的状态来源合法。

### 2.4 TRUNCATE / DELETE

```text
DELETE -> 42501
TRUNCATE -> 42501
```

不属于 B 的修改范围。

### 2.5 当前可直接 INSERT 的状态

A 后，B 前，BEFORE INSERT Trigger 不会因为状态来源拒绝：

```text
STAGING   -> STAGING、STAGING_READY、STAGING_ABANDONED、QUARANTINING 等
CANONICAL -> ACTIVE、QUARANTINED、PURGE_PENDING、DELETED、FAILED_RETAINED 等
```

但字段形状、FK 或 Deferred Trigger 仍可能拒绝其中某些组合。

结论：

- “数据库可能拒绝某个字段形状”不证明“该初始创建路径合法”；
- B 必须显式限制普通 INSERT 的 kind/state 组合。

## 3. 普通初始状态白名单

### 3.1 允许规则

```text
STAGING   -> STAGING_RESERVED
CANONICAL -> FINALIZING
```

### 3.2 完整矩阵

| Object Kind | 直接 INSERT 状态 | 是否允许 | 说明 |
|---|---|---:|---|
| STAGING | `STAGING_RESERVED` | 允许 | 普通上传生命周期唯一入口 |
| STAGING | `STAGING` | 拒绝 | 只能从 `STAGING_RESERVED` UPDATE |
| STAGING | `STAGING_READY` | 拒绝 | 只能从 `STAGING` UPDATE |
| STAGING | `STAGING_ABANDONED` | 拒绝 | 只能从 `STAGING` UPDATE |
| STAGING | `FINALIZING` | 拒绝 | CANONICAL 状态 |
| STAGING | `ACTIVE` | 拒绝 | CANONICAL 状态 |
| STAGING | `QUARANTINING` | 拒绝 | 特殊 orphan/清理协议待冻结 |
| STAGING | `QUARANTINED` | 拒绝 | 只能从合法前态转换 |
| STAGING | `RESTORING` | 拒绝 | 独立恢复流程 |
| STAGING | `PURGE_PENDING` | 拒绝 | 只能从 `QUARANTINED` UPDATE |
| STAGING | `DELETED` | 拒绝 | 空 STAGING 特殊协议待冻结 |
| STAGING | `FAILED_RETAINED` | 拒绝 | 安全失败转换 |
| CANONICAL | `STAGING_RESERVED` | 拒绝 | STAGING 专用状态 |
| CANONICAL | `STAGING` | 拒绝 | STAGING 专用状态 |
| CANONICAL | `STAGING_READY` | 拒绝 | STAGING 专用状态 |
| CANONICAL | `STAGING_ABANDONED` | 拒绝 | STAGING 专用状态 |
| CANONICAL | `FINALIZING` | 允许 | 普通 CANONICAL 唯一入口 |
| CANONICAL | `ACTIVE` | 拒绝 | 只能从 `FINALIZING` UPDATE |
| CANONICAL | `QUARANTINING` | 拒绝 | orphan 特殊协议待冻结 |
| CANONICAL | `QUARANTINED` | 拒绝 | 只能从 `QUARANTINING` UPDATE |
| CANONICAL | `RESTORING` | 拒绝 | 独立恢复流程 |
| CANONICAL | `PURGE_PENDING` | 拒绝 | 只能从 `QUARANTINED` UPDATE |
| CANONICAL | `DELETED` | 拒绝 | 只能从合法 `PURGE_PENDING` UPDATE |
| CANONICAL | `FAILED_RETAINED` | 拒绝 | 真实失败转换 |

### 3.3 Fail-closed

以下情况全部拒绝：

- `objectKind` 为 NULL；
- `state` 为 NULL；
- 未列入白名单的合法枚举组合；
- 未来新增但尚未纳入普通白名单的枚举值；
- STAGING 与 CANONICAL 状态交叉组合。

未知组合不能默认为允许。

## 4. 实施机制比较

### 4.1 方案 A：扩展现有 BEFORE INSERT 函数

在 `p13_protect_storage_lifecycle()` 的 INSERT 分支中增加普通初始状态检查。

| 维度 | 评价 |
|---|---|
| 正确性 | 高；所有 INSERT 已由现有 Trigger 调用 |
| 特殊协议 | 当前全部拒绝，未来需独立扩展 |
| UPDATE 兼容性 | 不改变 UPDATE 分支 |
| Deferred 兼容性 | 不改变四个约束 Trigger |
| SQLSTATE | 可由函数统一抛出 `23514` |
| 复杂度 | 低；不新增 Trigger 或函数 |
| Migration 风险 | 仅替换一个函数体 |
| 可测试性 | 可直接复用现有生命周期触发路径 |
| 可维护性 | 白名单集中在一个 INSERT 分支 |

风险：

- A cleanup attestation 和 B 初始状态检查位于同一函数；
- 必须保持 INSERT 分支提前 RETURN NEW；
- 特殊协议未来需要单独受控扩展，不能直接放宽普通白名单。

### 4.2 方案 B：新增独立 BEFORE INSERT Trigger

优点：

- 初始状态逻辑独立命名；
- cleanup attestation 与白名单职责分离。

缺点：

- Lifecycle 将出现两个 BEFORE INSERT ROW Trigger；
- PostgreSQL 对同事件 Trigger 有名称排序行为；
- 错误优先级依赖 Trigger 名称；
- 一个 Trigger 失败后，另一个不会继续执行；
- 需要新增函数和 Trigger，数据库对象更多；
- 未来白名单与 cleanup 的统一审计更复杂；
- 无法从结构上降低 SQLSTATE 或 Deferred 风险。

该方案不是最小变更。

### 4.3 方案 C：CHECK 约束

CHECK 约束不能可靠区分：

```text
INSERT 普通初始状态
UPDATE 后续状态转换
```

如果直接加入：

```sql
CHECK (state IN ('STAGING_RESERVED', 'FINALIZING'))
```

会拒绝后续合法 UPDATE。

如果引入初始状态布尔字段，则需要 Schema/数据回填/C 结构调整，超出 B 范围。

因此 CHECK 不适合作为本阶段普通 INSERT 白名单机制。

### 4.4 方案 D：RLS、受控写入函数或新状态列

可能方案：

- RLS INSERT policy；
- 撤销直接 INSERT，仅允许受控 SECURITY DEFINER 函数写入；
- 新增 creationProtocol/authorization 字段；
- 独立 orphan 证据表。

这些方案可能提供更强的特殊协议隔离，但涉及：

- ACL、角色或 RLS；
- 新列/表；
- 数据回填；
- 更广泛的 C 级结构修改。

不属于最小 B 方案。

### 4.5 推荐

推荐 **方案 A：扩展现有 `p13_protect_storage_lifecycle()` INSERT 分支**。

理由：

- A 已确保该 Trigger 覆盖全部 Lifecycle INSERT；
- 不需要新增 Trigger 或函数；
- 可以保留 A cleanup attestation 检查且不改变 UPDATE/DELETE；
- SQLSTATE、测试边界和回滚范围最小；
- 当前特殊协议尚未冻结，B 应 fail closed，而不是预先加入未经批准的特殊入口。

## 5. 函数修改设计

### 5.1 INSERT 分支顺序

```text
DELETE 检查
-> INSERT 分支
   -> A cleanup attestation
   -> B 普通初始状态白名单
   -> RETURN NEW
-> 原 UPDATE 逻辑
```

先执行 A cleanup attestation 的原因：

- 保持 A 的现有保护与错误信息；
- 对非法 STAGING cleanup 缺证明仍由 A 函数拒绝；
- B 只负责“状态来源”规则，不替代 attestation。

### 5.2 完整函数草案

```sql
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

该草案仅增加 INSERT 白名单检查。UPDATE/DELETE 部分与当前实现一致。

## 6. B Migration 草案

建议名称：

```text
20261118110000_phase37_p13_lifecycle_initial_state_guard
```

涉及对象：

```text
public.p13_protect_storage_lifecycle()
```

预计 DDL：

```text
CREATE OR REPLACE FUNCTION
```

不修改：

- Schema；
- Trigger 注册；
- `p13_assert_staging_cleanup_attestation()`；
- 其他 24 个 P1-3 函数；
- CHECK、FK、索引；
- ACL 或角色。

锁与数据：

- 不需要表级显式锁；
- 不执行数据回填；
- 历史行不受 INSERT 分支影响；
- 当前六张相关表为 0 行，不涉及历史兼容。

失败恢复：

- PostgreSQL 函数 DDL 是事务性的；
- 单条 `CREATE OR REPLACE FUNCTION` 失败时保留旧函数；
- 成功后如需撤销，应建立新的前向恢复 Migration；
- COMMIT 结果未知时，新连接只读检查函数签名、`prosrc` 摘要、Owner/ACL 和 Migration 历史。

Migration 后 Catalog 预期：

```text
函数数量              = 25
Lifecycle Trigger 数量 = 6
p13_storage_lifecycle_guard.tgtype = 31
函数 INSERT 白名单    = STAGING_RESERVED / CANONICAL FINALIZING
函数 Owner            = elevator_p13_validation_migrator
prosecdef             = false
provolatile           = v
proisstrict           = false
```

## 7. 特殊协议设计边界

### 7.1 CANONICAL orphan QUARANTINING

普通 `FINALIZING` 白名单不覆盖 orphan，因为 orphan 没有正常 FINALIZE 生命周期来源。

但 B 不能直接允许所有 `CANONICAL QUARANTINING`：

- 普通上传业务可伪造 QUARANTINE Operation；
- 无法证明对象确实是无合法来源的孤儿；
- 可能绕过 FINALIZE 和 FileVersion 规则。

当前决定：

```text
B 直接拒绝 CANONICAL QUARANTINING INSERT。
```

未来协议必须单独回答：

- orphan 证据来源；
- 是否允许 `sourceAttemptId IS NULL`；
- QUARANTINE Operation 的必需状态和创建顺序；
- 对象路径、size、checksum 和文件系统身份证明；
- 专用权限或受控函数；
- 审计记录；
- 失败恢复；
- 如何拒绝未授权调用者。

在这些条件冻结前：

- 不新增 orphan 白名单；
- 不新增特殊函数；
- 不允许 Fixture 直接构造；
- FX-QN、FX-PP、FX-DE 的 orphan 路径保持 `BLOCKED`。

### 7.2 空 STAGING 直接 DELETED

当前数据库对 STAGING 的既有要求：

- 必须有 reserved Attempt/Intent；
- STAGING `DELETED` 必须具有完整、identity-verified close attestation；
- closed size 必须大于 0；
- checksum 必须存在；
- 上传链必须一致。

因此“没有上传链、没有实际文件内容”的空 STAGING 当前无法在不修改 C 范围结构的情况下表达。

当前决定：

```text
B 直接拒绝 STAGING DELETED INSERT。
```

未来协议至少需要决定：

- 空 STAGING 的准确含义；
- 是否仍关联 Intent/Attempt；
- 如何证明文件不存在；
- 是否需要不同 attestation；
- 是否需要新列、新表或专用受控入口；
- 是否必须修改现有 CHECK/FK。

这些问题很可能需要 C 级结构调整，不能并入 B。

## 8. 九类 Fixture 路径复核

| Fixture | 当前直接 INSERT | 后续 UPDATE | Operation / Attempt / FileVersion | B 兼容性 | 结论 |
|---|---|---|---|---|---|
| FX-SR | STAGING_RESERVED | 激活 Intent | Attempt RESERVED | 兼容 | PASS |
| FX-SW | STAGING_RESERVED | STAGING / WRITING | Attempt WRITING | 兼容 | PASS |
| FX-SRdy | STAGING_RESERVED | STAGING -> STAGING_READY | 完整 proof / Attempt READY | 兼容 | PASS |
| FX-FZ | CANONICAL FINALIZING | Attempt FINALIZING | FINALIZE Operation，currentOperation Deferred FK | 兼容 | PASS |
| FX-ACT | CANONICAL FINALIZING | FINALIZING -> ACTIVE | FINALIZE APPLIED + FileVersion | 兼容 | PASS |
| FX-QN | 当前直接 CANONICAL QUARANTINED | 无真实隔离前态 | QUARANTINE APPLIED | B 拒绝直接 INSERT | BLOCKED |
| FX-PP | 当前直接 CANONICAL PURGE_PENDING | 无真实 QN 前态 | PURGE EXECUTING | B 拒绝直接 INSERT | BLOCKED |
| FX-DE | 当前直接 CANONICAL DELETED | 无真实 PP 前态 | PURGE APPLIED | B 拒绝直接 INSERT | BLOCKED |
| FX-FR | 当前直接 CANONICAL FAILED_RETAINED | 无真实失败流程 | PURGE ABANDONED | B 拒绝直接 INSERT | INCOMPATIBLE，须改为 FX-FZ 失败路径 |

### 8.1 FX-SR / FX-FZ 的约束顺序

FX-SR 保持：

```text
Intent
-> RESERVED Attempt
-> STAGING_RESERVED Lifecycle
-> UPDATE Intent to UPLOADING/currentAttempt
```

FX-FZ 可以继续：

```text
FX-SRdy
-> INSERT CANONICAL FINALIZING
-> INSERT FINALIZE Operation
-> establish currentOperation
-> UPDATE Attempt to FINALIZING
```

`currentOperationId` 的复合 Deferred FK 允许在同一事务内稍后补齐 Operation。

### 8.2 当前 Fixture Builder 状态

当前 Fixture Builder 仍直接 INSERT：

```text
CANONICAL QUARANTINED
CANONICAL PURGE_PENDING
CANONICAL DELETED
CANONICAL FAILED_RETAINED
```

B 实施后这些 Fixture 会被 BEFORE INSERT 白名单拒绝。

本阶段不修改 Fixture Builder；后续必须单独调整并通过复核。

## 9. B 测试方案摘要

完整测试矩阵见数据库行为测试方案。

核心预期：

- 合法 `STAGING_RESERVED`：允许；
- 合法 `CANONICAL FINALIZING`：允许；
- 其他普通初始状态：`23514`；
- A cleanup attestation 错误保持不变；
- 合法 UPDATE 不受 B 影响；
- 非法 UPDATE 继续由原状态白名单拒绝；
- Deferred Trigger 继续在最终检查阶段运行；
- 特殊协议直接 INSERT 全部拒绝。

## 10. 风险

| 风险 | 影响 | 控制 |
|---|---|---|
| 把字段合法误认为路径合法 | 非法初始状态进入数据库 | B 在 INSERT 阶段显式检查 |
| 白名单放在 UPDATE 分支 | 合法状态转换失败 | 仅修改 `TG_OP='INSERT'` 分支 |
| 新增第二 Trigger | 名称排序和错误优先级 | 不采用方案 B |
| 使用 CHECK | 后续 UPDATE 被错误拒绝 | 不采用方案 C |
| 特殊 orphan 被普通入口放行 | 绕过 FINALIZE | B 全部拒绝，待独立协议 |
| 空 STAGING DELETED 被放宽 | 绕过文件关闭证明 | B 全部拒绝，待 C/协议 |
| 修改函数丢失 A 检查 | cleanup 证明失效 | INSERT 分支先保留 attestation |
| 未来新增枚举默认放行 | fail-open | 白名单只接受两个明确组合 |

## 11. OPEN DECISIONS

1. CANONICAL orphan QUARANTINING 的完整创建协议。
2. 空 STAGING DELETED 的完整创建协议。
3. 特殊协议是否必须引入新列、新表、角色或受控 SECURITY DEFINER 函数。
4. FX-QN 是否存在非 orphan 的合法隔离前态。
5. Fixture Builder 调整的具体实施阶段。

这些问题不阻塞普通 B 白名单设计；B 在特殊协议关闭前必须保持 fail closed。

## 12. 推荐实施顺序

```text
1. 项目负责人审核本设计
2. 创建 B Migration
3. 静态测试和 TypeScript/Web 回归
4. 数据库只读前置审计
5. 在专用验证数据库执行 B Migration
6. B-DB-01 至 B-DB-16 行为验证
7. Migration 后独立 Catalog 验收
8. 单独授权调整 Fixture Builder
9. 特殊协议独立设计与授权
```

本阶段只完成第 1 步前的设计，不创建 B Migration。
