# P1-3 Lifecycle 初始状态与创建协议设计决策

## 文档信息

- 决策版本：`C-6.2-C2`
- 更新日期：`2026-11-17`
- 设计状态：`FROZEN WITH OPEN DECISIONS`
- 代码基线：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 审查状态：项目负责人已确认普通初始状态方向；特殊协议和最终 Fixture 路径仍待后续审查
- 原始设计：`docs/architecture/file-lifecycle-p13-design-freeze.md`
- C-5.1 修订：`docs/architecture/file-lifecycle-p13-c5-1-revision.md`
- 数据库行为测试方案：`docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md`
- P1-3 Migration：`prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql`

本文档冻结 Lifecycle 的普通初始状态和 Fixture 创建原则，不修改原始设计冻结文档，不改变 Prisma Schema、Migration、数据库、Fixture Builder、业务代码或权限。

## 1. 决策背景

C-6.2-C 已确认：

- `p13_protect_storage_lifecycle()` 存在 INSERT 分支；
- `p13_storage_lifecycle_guard` 当前仅注册为 `BEFORE UPDATE OR DELETE`；
- 因此函数的 INSERT 分支目前无法由该 Trigger 执行；
- 现有 `AFTER INSERT ... DEFERRABLE INITIALLY DEFERRED` 约束 Trigger 只提供 COMMIT 阶段的一致性检查，不能替代缺失的 BEFORE INSERT 保护。

C-6.2-C1 进一步确认：

- 普通 STAGING 和普通 CANONICAL 的创建入口需要正式冻结；
- CANONICAL orphan 和空 STAGING 直接进入 `DELETED` 的协议不完整；
- FX-QN、FX-PP、FX-DE 直接插入最终状态属于 Fixture 捷径，不是已经批准的普通业务创建路径；
- 仅恢复 INSERT Trigger 不能自动阻止所有非法初始状态。

本决策把上述问题拆成三项独立修改：

```text
A. 恢复现有 INSERT 分支执行
B. 增加合法初始状态白名单
C. 修改 CHECK/FK/Deferred Constraint Trigger
```

A、B、C 不得合并为一次未经区分的数据库修改。

## 2. 普通 STAGING 初始状态

### 2.1 冻结决策

普通 STAGING Lifecycle 的合法初始状态只有：

```text
STAGING_RESERVED
```

以下状态不得作为普通直接创建入口：

```text
STAGING
STAGING_READY
STAGING_ABANDONED
QUARANTINING
QUARANTINED
PURGE_PENDING
DELETED
```

### 2.2 冻结状态路径

```text
STAGING_RESERVED
    |
    v
  STAGING
   /   \
  v     v
STAGING_READY
STAGING_ABANDONED
```

后续清理状态继续受既有状态白名单和 close attestation 规则约束。

### 2.3 创建前提

普通 STAGING 创建至少需要：

1. 已存在的 `FileUploadIntent`；
2. 已存在的 `FileUploadAttempt`；
3. Attempt 初始状态为 `RESERVED`；
4. Lifecycle `objectKind=STAGING`；
5. `storageKey` 位于 `staging/` 命名空间；
6. `reservedAttemptId` 和 `reservedIntentId` 指向同一上传链；
7. `ownerToken` 和 `leaseExpiresAt` 为 NULL；
8. `fencingGeneration=0`；
9. 无 close attestation。

Intent 可以在同一事务中先以 `PENDING` 创建，再在 Lifecycle 和 Attempt 建立后转换为 `UPLOADING` 并设置 `currentAttemptId`；最终 COMMIT 必须满足 Deferred 上传链检查。

## 3. 普通 CANONICAL 初始状态

### 3.1 冻结决策

普通 CANONICAL Lifecycle 的合法初始状态只有：

```text
FINALIZING
```

以下状态不得作为普通直接创建入口：

```text
ACTIVE
QUARANTINING
QUARANTINED
RESTORING
PURGE_PENDING
DELETED
FAILED_RETAINED
```

CANONICAL 不得使用任何 `STAGING_*` 状态作为初始状态。

### 3.2 FINALIZING 创建前提

普通 CANONICAL `FINALIZING` 最终必须满足：

1. `storageKey` 位于 `objects/` 命名空间；
2. reserved owner 字段为 NULL；
3. owner、generation 和 lease 完整；
4. size 和 checksum 完整；
5. 具有与 Lifecycle 一致的 `currentOperationId`；
6. Operation 类型为 `FINALIZE`；
7. Operation 状态为 `PREPARED`、`EXECUTING` 或 `UNKNOWN`；
8. Operation 具有非空 `sourceAttemptId`；
9. Operation 与 Lifecycle 的 owner、generation 和 lease 一致；
10. 不存在 FileVersion。

`currentOperationId`、复合 FK 和 Operation/Lifecycle 一致性由 Deferred Constraint Trigger 在 COMMIT 时最终检查。允许在同一事务中按约束要求调整创建顺序，但不得禁用或绕过 Trigger。

## 4. CANONICAL orphan 特殊创建协议

### 4.1 已确认边界

既有设计只确认：

- Lifecycle 矩阵允许 `QUARANTINING` 具有 `orphan` 来源；
- 无 Attempt 归属的 CANONICAL 只允许进入人工 Quarantine/Purge 处理路径；
- 不允许自动 Restore；
- 不得创建伪造 UploadAttempt 或 Intent 来伪装来源。

因此，“CANONICAL orphan 可能允许没有 source Attempt”具有方向性依据，但完整创建协议尚未冻结。

### 4.2 尚未解决的问题

以下项目全部标记 `NEEDS DECISION`：

| 问题 | 状态 | 当前结论 |
|---|---|---|
| orphan 的确定性判定条件 | `NEEDS DECISION` | 尚未定义以什么文件系统证据、数据库记录或审计记录证明对象无合法来源 |
| 是否允许 `sourceAttemptId IS NULL` | `NEEDS DECISION` | 设计方向允许无 Attempt 对象进入 Quarantine/Purge，但精确适用范围未定 |
| 是否必须存在 QUARANTINE Operation | `NEEDS DECISION` | 最终进入 `QUARANTINED` 时按现有关系应有 QUARANTINE Operation，但 orphan 初始阶段的要求未定 |
| Lifecycle 与 Operation 创建顺序 | `NEEDS DECISION` | 是否先创建 `QUARANTINING` Lifecycle，再创建 Operation，或采用受控函数一次建立 |
| 是否允许直接 INSERT `QUARANTINING` | `NEEDS DECISION` | 不得仅凭矩阵中的 `orphan` 字样认定为已批准 |
| 如何防止普通业务伪装 orphan | `NEEDS DECISION` | 需要独立的调用入口、权限、证据和审计设计 |
| 所需数据库角色 | `NEEDS DECISION` | 是否只允许未来 Maintenance/Recovery 角色创建尚未决定 |
| 所需审计字段和审批记录 | `NEEDS DECISION` | 当前 Schema 中没有专门的 orphan 证据表 |
| 是否创建上传链替代记录 | **禁止** | 不得创建伪造 Attempt/Intent |

### 4.3 暂定实施门禁

在上述问题关闭前：

- 普通 Runtime 不得创建 orphan Lifecycle；
- Fixture 不得直接 INSERT `CANONICAL QUARANTINING`；
- 不得通过 `session_replication_role`、禁用 Trigger 或后台修数构造 orphan；
- 不得把 orphan 创建合并进 A 或普通 B 的状态白名单；
- FX-QN、FX-PP、FX-DE 的 orphan 路径保持 `BLOCKED`。

## 5. 空 STAGING 直接进入 DELETED 的特殊协议

### 5.1 已确认边界

原始矩阵包含“空 staging”作为 `DELETED` 的来源，但该短语没有定义完整协议。

C-5.1 已确认：

- STAGING 的 cleanup 状态必须具备完整、identity-verified close attestation；
- 直接 INSERT STAGING/DELETED 不得绕过完整性、快照一致性和上传链检查；
- 无法证明 writer 已关闭时，不得推断文件可删除。

### 5.2 尚未解决的问题

以下项目全部标记 `NEEDS DECISION`：

| 问题 | 状态 | 当前结论 |
|---|---|---|
| “空 STAGING”的准确定义 | `NEEDS DECISION` | 是物理文件不存在、从未创建、已安全移除，还是仅数据库未记录内容，尚未定义 |
| 是否允许没有实际文件内容 | `NEEDS DECISION` | 与当前 `DELETED` 必须满足 size/checksum 和 STAGING close attestation 的约束存在潜在冲突 |
| 是否仍必须关联 Intent/Attempt | `NEEDS DECISION` | 不得绕过上传链，但空对象是否允许例外尚未批准 |
| 是否必须具有 close attestation | `NEEDS DECISION` | 当前 STAGING `DELETED` 要求完整 identity-verified close attestation |
| 直接 INSERT 还是专用转换 | `NEEDS DECISION` | 原矩阵只说明来源，没有批准直接 INSERT |
| 如何证明文件不存在且无未关闭 writer | `NEEDS DECISION` | 当前数据库没有独立的“从未创建”证明协议 |
| 所需角色和审计 | `NEEDS DECISION` | 是否仅 Maintenance 角色、是否需要人工审批均未定义 |

### 5.3 暂定实施门禁

在上述问题关闭前：

- 不得直接 INSERT STAGING `DELETED` 作为空对象修复手段；
- 不得通过放宽 `close_attestation_complete_check` 解决该问题；
- 不得把“空 staging”解释为无需上传链或无需证明；
- FX-DE 的空 STAGING 分支保持 `BLOCKED`。

## 6. Lifecycle 状态转换规则

普通创建入口与后续转换必须分开解释。

### 6.1 STAGING

```text
STAGING_RESERVED -> STAGING
STAGING -> STAGING_READY
STAGING -> STAGING_ABANDONED
STAGING_READY -> DELETED
STAGING_READY -> QUARANTINING
STAGING_READY -> STAGING_ABANDONED
STAGING_ABANDONED -> QUARANTINING
STAGING_ABANDONED -> DELETED
```

`STAGING_RESERVED -> DELETED` 不在普通转换白名单中。

### 6.2 CANONICAL

```text
FINALIZING -> ACTIVE
FINALIZING -> QUARANTINING
FINALIZING -> FAILED_RETAINED
QUARANTINING -> QUARANTINED
QUARANTINING -> FAILED_RETAINED
QUARANTINED -> PURGE_PENDING
QUARANTINED -> RESTORING
QUARANTINED -> FAILED_RETAINED
RESTORING -> ACTIVE
RESTORING -> FAILED_RETAINED
PURGE_PENDING -> DELETED
PURGE_PENDING -> FAILED_RETAINED
```

这些转换仍须同时满足 Operation、FileVersion、close attestation、owner/generation/lease 和条件唯一索引要求。State 白名单通过不等于整个事务合法。

## 7. 九类 Fixture 的目标创建方式

| Fixture | 目标状态 | 冻结后的目标创建方式 | 当前状态 |
|---|---|---|---|
| FX-SR | STAGING `STAGING_RESERVED` | Intent -> RESERVED Attempt -> insert STAGING_RESERVED -> 激活 Intent | `TARGET DEFINED` |
| FX-SW | STAGING `STAGING` | FX-SR 后 UPDATE Lifecycle 和 Attempt 到 WRITING | `TARGET DEFINED` |
| FX-SRdy | STAGING `STAGING_READY` | FX-SW -> 写完整 attestation/size/checksum -> Attempt READY | `TARGET DEFINED` |
| FX-FZ | CANONICAL `FINALIZING` | FX-SRdy -> insert FINALIZING -> insert FINALIZE Operation -> 设置 currentOperation -> Attempt FINALIZING | `TARGET DEFINED` |
| FX-ACT | CANONICAL `ACTIVE` + FileVersion | FX-FZ -> Operation APPLIED -> Lifecycle ACTIVE -> Attempt COMPLETED -> Staging DELETED -> FileVersion -> Intent COMPLETED | `TARGET DEFINED` |
| FX-QN | CANONICAL `QUARANTINED` | 必须从合法 `QUARANTINING` 来源转换；不得直接 INSERT `QUARANTINED` | `BLOCKED` |
| FX-PP | CANONICAL `PURGE_PENDING` | 必须从合法 `QUARANTINED` 转换；不得直接 INSERT `PURGE_PENDING` | `BLOCKED`，依赖 FX-QN |
| FX-DE | CANONICAL `DELETED` | 必须从合法 `PURGE_PENDING` 或已批准空 STAGING 协议产生；不得直接 INSERT 最终状态 | `BLOCKED`，依赖 FX-PP/特殊协议 |
| FX-FR | CANONICAL `FAILED_RETAINED` | 从合法前态通过真实 Operation 失败产生，不得直接 INSERT 终态 | `TARGET DEFINED / NOT VERIFIED` |

### 7.1 FX-FR 目标流程

在不引入 orphan 协议的前提下，建议以合法 FX-FZ 为前态：

1. FINALIZE Operation 从 EXECUTING 转为 FAILED，lease 置 NULL；
2. CANONICAL Lifecycle 从 FINALIZING 转为 FAILED_RETAINED，lease 置 NULL；
3. 不创建 FileVersion；
4. COMMIT 时由 Operation/Lifecycle 和上传链 Deferred Trigger 验证最终一致性。

该流程符合既有状态转换和 Operation 关系设计，但尚未在真实 PostgreSQL 中执行，因此不能标记为已验证。

### 7.2 BLOCKED Fixture 的禁止事项

FX-QN、FX-PP、FX-DE 在解除阻断前：

- 不得直接把最终状态作为初始 INSERT；
- 不得为了满足 FK 伪造 Attempt/Intent；
- 不得禁用 Trigger 或使用 `session_replication_role`；
- 不得把缺少 orphan/空 STAGING 决策的步骤写成既定 Fixture；
- 不得执行真实 Fixture。

## 8. A/B/C 后续修订范围

### A. 恢复 INSERT Trigger

范围仅限：

```text
将 p13_storage_lifecycle_guard 的事件
从 BEFORE UPDATE OR DELETE
恢复为 BEFORE INSERT OR UPDATE OR DELETE
```

用途：

- 执行函数中已经存在的 INSERT 分支；
- 对 STAGING cleanup INSERT 执行 close attestation 检查；
- 不增加普通初始状态白名单。

实施方式：

- 不修改已经执行的原始 P1-3 Migration；
- 未来通过独立前向 Migration 实施；
- 需要独立审查、独立数据库执行授权和真实 PostgreSQL 验证。

### B. 增加普通初始状态白名单

B 是独立设计变更，至少限制：

```text
普通 STAGING 初始状态 = STAGING_RESERVED
普通 CANONICAL 初始状态 = FINALIZING
```

B 还必须明确：

- orphan 是否走独立受控创建入口；
- 空 STAGING `DELETED` 是否存在独立受控入口；
- 普通调用方不得利用特殊入口伪装原因。

B 不得自动包含在 A 的实施授权中。

### C. 修改 CHECK/FK/Deferred Constraint Trigger

当前没有证据证明必须修改 C。

只有在 A/B 无法正确实现冻结规则，或真实 PostgreSQL 测试证明现有约束无法表达该规则时，才提交 C 的独立设计和授权。

## 9. 数据库行为测试要求

### 9.1 初始状态测试

必须覆盖：

| 类别 | 预期 |
|---|---|
| 合法 STAGING_RESERVED INSERT | COMMIT 成功 |
| 普通 STAGING 非法初始状态 | B 修复后在语句阶段失败 |
| 合法 CANONICAL FINALIZING | Deferred 检查后 COMMIT 成功 |
| 普通 CANONICAL 非法初始状态 | B 修复后在语句阶段失败 |
| orphan 特殊创建 | `BLOCKED`，协议冻结后另行测试 |
| 空 STAGING DELETED 特殊创建 | `BLOCKED`，协议冻结后另行测试 |

### 9.2 阶段和终态断言

测试必须分别记录：

```text
BEFORE Trigger 语句阶段失败
CHECK/FK 语句阶段失败
Deferred Constraint Trigger COMMIT 阶段失败
COMMIT 未知
ROLLBACK 成功或失败
最终行是否存在
```

不得把上述情况统一写成“INSERT 失败”。

### 9.3 状态转换测试

必须覆盖：

- 每个合法转换；
- 每个非法跳转；
- 终态不可离开；
- ACTIVE 有 FileVersion 时不得离开；
- STAGING cleanup 的 close attestation；
- Operation 与 Lifecycle 的双向一致性；
- FileVersion 与 ACTIVE CANONICAL 的双向一致性。

### 9.4 Fixture 合法性

- FX-SR、FX-SW、FX-SRdy、FX-FZ、FX-ACT、FX-FR 的最终 SQL 必须由合法状态转换构造；
- FX-QN、FX-PP、FX-DE 在特殊协议关闭前不得执行；
- 任何 Fixture COMMIT 失败都必须保留失败阶段、SQLSTATE、约束/Trigger 上下文和事务终态。

## 10. 尚未解决的决策

1. CANONICAL orphan 的判定证据、创建入口、Operation 顺序、权限和审计。
2. 空 STAGING DELETED 的定义、来源关联、close attestation 和受控路径。
3. FX-QN 是否必须依赖 orphan，还是可以通过其他已批准的正常隔离流程构造。
4. FX-PP、FX-DE 的完整前置 Fixture。
5. B 的实现形式：函数白名单、CHECK、受控函数或其他数据库机制。
6. A/B 前向 Migration 的编号、拆分方式和执行授权。

## 11. 当前门禁

```text
C-6.2-C2 设计状态：
FROZEN WITH OPEN DECISIONS

Schema/Migration：
NOT MODIFIED

Database：
NOT CONNECTED

Fixture Builder：
NOT MODIFIED

B2：
NOT AUTHORIZED
```

只有下列条件全部满足后，才能重新评估 B2：

1. C-6.2-C2 文档经项目负责人审核；
2. orphan 和空 STAGING 特殊协议有明确决策，或相关 Fixture 被正式排除；
3. A、B 分别形成独立前向修订方案；
4. A、B 分别获得实施授权并完成独立复核；
5. 合法与非法 INSERT 已在真实 PostgreSQL 验证；
6. Fixture Builder 已按冻结规则调整并重新复核。
