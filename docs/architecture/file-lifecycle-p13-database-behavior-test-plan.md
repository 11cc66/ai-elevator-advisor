# P1-3 数据库行为测试方案（C-6.2-L8-A4 Startup Entry 版）

## 文档信息

- 方案版本：`C-6.2-L8-A4`
- 更新日期：`2026-11-18`
- 状态：`A/B EXECUTED / STORAGE DELETE ISOLATED / STARTUP ENTRIES HARDENED`
- 代码基线：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- P1-3 Migration：`prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql`
- 原始设计：`docs/architecture/file-lifecycle-p13-design-freeze.md`
- C-5.1 修订：`docs/architecture/file-lifecycle-p13-c5-1-revision.md`
- C-6.2-C2 决策：`docs/architecture/file-lifecycle-p13-c6-2-c2-decisions.md`
- C-6.2-F 实施报告：`docs/architecture/file-lifecycle-p13-c6-2-f-report.md`
- C-6.2-G B 设计：`docs/architecture/file-lifecycle-p13-c6-2-g-design.md`
- C-6.2-H 实施验收：`docs/architecture/file-lifecycle-p13-c6-2-h-report.md`
- C-6.2-J 特殊协议设计：`docs/architecture/file-lifecycle-p13-c6-2-j-design.md`
- C-6.2-J 设计报告：`docs/architecture/file-lifecycle-p13-c6-2-j-report.md`
- C-6.2-K Cleanup 审计与设计：`docs/architecture/file-lifecycle-p13-c6-2-k-design.md`
- C-6.2-K Cleanup 报告：`docs/architecture/file-lifecycle-p13-c6-2-k-report.md`
- C-6.2-L 止损设计：`docs/architecture/file-lifecycle-p13-c6-2-l-design.md`
- C-6.2-L 验收报告：`docs/architecture/file-lifecycle-p13-c6-2-l-report.md`
- C-6.2-L1 部署审计：`docs/architecture/file-lifecycle-p13-c6-2-l1-design.md`
- C-6.2-L1 部署报告：`docs/architecture/file-lifecycle-p13-c6-2-l1-report.md`
- C-6.2-L2 制品审计：`docs/architecture/file-lifecycle-p13-c6-2-l2-design.md`
- C-6.2-L2 制品报告：`docs/architecture/file-lifecycle-p13-c6-2-l2-report.md`
- C-6.2-L3 构建身份设计：`docs/architecture/file-lifecycle-p13-c6-2-l3-design.md`
- C-6.2-L3 构建身份报告：`docs/architecture/file-lifecycle-p13-c6-2-l3-report.md`
- C-6.2-L4 依赖/Web Build 设计：`docs/architecture/file-lifecycle-p13-c6-2-l4-design.md`
- C-6.2-L4 依赖/Web Build 报告：`docs/architecture/file-lifecycle-p13-c6-2-l4-report.md`
- C-6.2-L5 部署基线设计：`docs/architecture/file-lifecycle-p13-c6-2-l5-design.md`
- C-6.2-L5 部署基线报告：`docs/architecture/file-lifecycle-p13-c6-2-l5-report.md`
- C-6.2-L6 Maintenance/Storage 设计：`docs/architecture/file-lifecycle-p13-c6-2-l6-design.md`
- C-6.2-L6 Maintenance/Storage 报告：`docs/architecture/file-lifecycle-p13-c6-2-l6-report.md`
- C-6.2-L7 Deployment Trust 设计：`docs/architecture/file-lifecycle-p13-c6-2-l7-design.md`
- C-6.2-L7 Deployment Trust 报告：`docs/architecture/file-lifecycle-p13-c6-2-l7-report.md`
- C-6.2-L8-A Evidence Intake 设计：`docs/architecture/file-lifecycle-p13-c6-2-l8a-design.md`
- C-6.2-L8-A Evidence Intake 报告：`docs/architecture/file-lifecycle-p13-c6-2-l8a-report.md`
- C-6.2-L8-A 管理员指南：`docs/architecture/file-lifecycle-p13-c6-2-l8a-admin-evidence-guide.md`
- C-6.2-L8-A3 Legacy 可达性复核：`docs/architecture/file-lifecycle-p13-c6-2-l8a3-risk-review.md`
- C-6.2-L8-A4 启动入口设计：`docs/architecture/file-lifecycle-p13-c6-2-l8a4-design.md`
- C-6.2-L8-A4 启动入口报告：`docs/architecture/file-lifecycle-p13-c6-2-l8a4-report.md`
- 实现状态：`docs/architecture/file-lifecycle-p13-implementation-status.md`

本文件只定义测试，不代表测试已执行，也不授予数据库写入、Migration、Runtime 或文件系统操作权限。

C-6.2-C2 冻结了普通初始状态：

```text
普通 STAGING   -> 只能以 STAGING_RESERVED 创建
普通 CANONICAL -> 只能以 FINALIZING 创建
```

CANONICAL orphan 的技术协议已由 C-6.2-J 设计冻结，但实现仍为 `BLOCKED`。空 STAGING 直接进入 `DELETED` 仍为 `SCHEMA GAP / BLOCKED`。依赖这些特殊协议的 Fixture 不得通过直接 INSERT 最终状态规避流程。

## 1. 第二轮修订内容

1. 逐条核对 Migration 中相关 `RAISE EXCEPTION` 和 `ERRCODE`。
2. 将数据库 owner/generation 一致性、应用 CAS、旧 Worker 写入、OS fencing 和文件句柄关闭拆分。
3. 将固定锁顺序和反向锁顺序测试归入并发应用集成测试。
4. 明确当前应用层没有 P1-3 CAS、锁顺序、close attestation 或文件生命周期实现。
5. 为每个 Fixture 补充依赖、构造顺序、中间状态、Deferred 检查点、COMMIT 结果和停止条件。
6. 修正 DF-05：不得通过同一 Intent 的两个 open Attempt 测试 OLD/NEW。
7. 将 RB-05 文件系统回滚测试移出纯数据库测试。
8. 统一覆盖矩阵与详细测试编号。

## 2. 当前代码证据

在 `apps/` 和 `packages/` 中搜索以下标识，结果为空：

```text
fencingGeneration
currentOperationId
closeAttestationId
storage_object_lifecycle
storage_object_operation
file_upload_attempt
```

因此当前状态：

| 能力 | 状态 |
|---|---|
| P1-3 应用写入链 | `NOT_IMPLEMENTED` |
| close attestation 应用提交 | `NOT_IMPLEMENTED` |
| generation CAS | `NOT_IMPLEMENTED` |
| storageKey 排序锁 | `NOT_IMPLEMENTED` |
| advisory lock | `NOT_IMPLEMENTED` |
| finalize/quarantine/restore/purge 运行时 | `NOT_IMPLEMENTED` |
| Recovery scanner | `NOT_IMPLEMENTED` |
| P1-3 行为测试 | `NOT_IMPLEMENTED` |

P1-3 Migration 中只有以下显式行锁：

```text
p13_assert_attempt_canonical_owner:
  storage_object_lifecycle FOR UPDATE
  storage_object_operation FOR UPDATE

p13_assert_file_version_storage_active:
  storage_object_lifecycle FOR SHARE
```

没有多 storageKey `ORDER BY` 锁，也没有 advisory lock。

现有双连接死锁和 lease 测试位于 Phase 35/37 的 Extraction/Review 测试中，可用于参考 harness 结构，但不能复用到 P1-3 测试数据库。

## 3. 测试分层

| 层级 | 范围 |
|---|---|
| 纯数据库 | Constraint、Trigger、Deferred、唯一索引、事务回滚、数据库 owner/generation 一致性 |
| 并发数据库 | 两个连接连接同一一次性数据库 clone |
| 应用集成 | generation CAS、锁顺序、heartbeat、lease、完整工作流 |
| 文件系统集成 | `FileHandle.close()`、hard-link、Reparse Point、quarantine/restore/purge、进程 fencing |

## 4. SQLSTATE 证据

### 4.1 自定义函数

P1-3 Migration 中所有相关 `RAISE EXCEPTION` 均有显式 `ERRCODE`，但不全是 `23514`。

| 函数 | 显式 SQLSTATE |
|---|---|
| `p13_protect_upload_attempt` | `42501` DELETE；`23514` 状态/身份 |
| `p13_assert_staging_cleanup_attestation` | `23514` |
| `p13_assert_attempt_staging_owner` | `23514` |
| `p13_assert_attempt_canonical_owner` | `23514` |
| `p13_protect_storage_lifecycle` | `42501` DELETE；`23514` 状态/身份/证明 |
| `p13_protect_storage_operation` | `42501` DELETE；`23514` 状态/身份 |
| `p13_assert_operation_lifecycle_relation` | `23514` |
| `p13_assert_upload_chain` | `23503` Intent 不存在；`23514` 链错误 |
| `p13_collect_lifecycle_intent_ids` | `23503` Lifecycle 不存在；`23514` 归属/状态 |
| `p13_collect_lifecycle_intent_ids_snapshot` | `23514` |
| `p13_assert_lifecycle_file_version` | `23514` |
| `p13_assert_file_version_lifecycle` | `23514` |
| `p13_assert_file_version_storage_active` | `23514` |
| `p13_protect_file_version_identity` | `42501` DELETE；`23514` 身份 |
| `p13_protect_upload_intent` | `42501` DELETE；`23514` 状态/身份 |
| `p13_reject_chain_delete` | `42501` |
| `p13_reject_chain_truncate` | `42501` |

`p13_assert_chain_from_*` 本身通常不直接 RAISE，其错误码由被调用的链函数决定。

### 4.2 原生约束

| 场景 | SQLSTATE |
|---|---|
| CHECK | `23514` |
| UNIQUE | `23505` |
| FK | `23503` |
| NOT NULL | `23502` |

### 4.3 NOT_VERIFIED 错误码

不得断言单一 SQLSTATE 的情况：

- CHECK、Deferred FK、Deferred Trigger 同时失败；
- 并发时 UNIQUE 与状态 Trigger 同时可能失败；
- close attestation 竞争时 UNIQUE 与不可变 Trigger 的优先级；
- 反向锁顺序是否稳定产生 `40P01`；
- COMMIT 已发送后连接中断的客户端错误码。

## 5. Fixture Builder

### 5.1 通用规则

- 使用专用数据库 clone。
- 不使用 `session_replication_role=replica`。
- 不禁用 Trigger。
- 不修改 `_prisma_migrations`。
- 不使用 seed、reset 或 `test:db:init`。
- Fixture Builder 本身必须先通过基线测试。
- 普通 DML 无法构造 Fixture 时停止，不能绕过约束。
- 普通 STAGING 只能从 `STAGING_RESERVED` 创建。
- 普通 CANONICAL 只能从 `FINALIZING` 创建。
- 不得直接 INSERT `QUARANTINED`、`PURGE_PENDING`、`DELETED` 或 `FAILED_RETAINED` 作为 Fixture 捷径。
- 特殊协议未冻结时，相关 Fixture 保持 `BLOCKED`。

### 5.2 基础依赖

Fixture 可按需建立：

```text
User
Customer
Project
Building
InstallationUnit
File
FileVersion
FileUploadIntent
FileUploadAttempt
StorageObjectLifecycle
StorageObjectOperation
```

### 5.3 FX-SR：STAGING_RESERVED

必要依赖：User、Customer、Project、Intent I、Attempt A、Staging Lifecycle LS。

构造顺序：

1. INSERT Intent I，状态 `PENDING`，`currentAttemptId=NULL`。
2. INSERT Attempt A，状态 `RESERVED`，`intentId=I`，`stagingKey=staging/<fx>`，`canonicalStorageKey=NULL`。
3. INSERT Lifecycle LS：`STAGING`、`STAGING_RESERVED`、reserved A/I、generation 0、无 close 字段。
4. UPDATE Intent 为 `UPLOADING`，`currentAttemptId=A`。

中间状态：步骤 2–3 后 Deferred 链仍不完整，只有步骤 4 后最终合法。

检查点：

```text
p13_upload_intent_chain_guard
p13_upload_attempt_chain_guard
p13_lifecycle_upload_chain_guard
```

预期 COMMIT：成功。最终 Attempt/Intent/Lifecycle/stagingKey 归属一致。

停止条件：Attempt 初始状态非 RESERVED、namespace/owner 字段错误、open Attempt 数不是 1。

### 5.4 FX-SW：STAGING / WRITING

依赖：FX-SR。

顺序：

1. 建立 FX-SR。
2. Lifecycle 更新为 `STAGING`，设置 ownerToken、未来 lease、generation > 0。
3. Attempt 更新为 `WRITING`。

中间状态：Attempt 与 Lifecycle 可暂时不一致，由 Deferred Trigger 在 COMMIT 验证。

预期 COMMIT：成功，无 close attestation，无 FileVersion。

停止条件：owner-state CHECK 失败或 Attempt/Lifecycle 最终状态不匹配。

### 5.5 FX-SRdy：STAGING_READY / READY

依赖：FX-SW。

顺序：

1. Lifecycle 更新为 `STAGING_READY`，写 size/checksum。
2. 写完整且 identity-verified 的 close attestation，并使其与 owner/generation/size/checksum/attempt 快照一致。
3. Attempt 更新为 `READY`。

检查点：

```text
close_attestation_complete_check
close_attestation_lifecycle_snapshot_check
p13_assert_attempt_staging_owner
p13_assert_staging_cleanup_attestation
```

预期 COMMIT：成功，无 FileVersion。

停止条件：证明缺字段、dev/ino 不一致、快照不一致、Attempt READY 但无证明。

### 5.6 FX-FZ：CANONICAL FINALIZING

依赖：FX-SRdy。

顺序：

1. INSERT Canonical Lifecycle LC：`FINALIZING`、`objects/<fx>`、owner/generation/lease 完整、reserved 字段为 NULL、content 完整。
2. INSERT FINALIZE Operation O：sourceAttempt=A、objectLifecycle=LC、EXECUTING、owner/generation/lease 一致、sourcePath=A.stagingKey、targetPath=LC.storageKey。
3. UPDATE LC.currentOperationId=O。
4. UPDATE A：`READY -> FINALIZING`，同时设置 canonicalStorageKey。

中间状态：LC 可暂时引用尚未插入的 O，依赖 Deferred FK；Attempt canonical key 最后设置。

检查点：

```text
p13_assert_attempt_canonical_owner
p13_assert_operation_lifecycle_relation
p13_operation_lifecycle_guard
p13_lifecycle_operation_guard
p13_assert_upload_chain
```

预期 COMMIT：成功，无 FileVersion。

停止条件：Operation 类型/来源/路径/owner/generation/lease 错误，或 Attempt 不是 READY→FINALIZING。

### 5.7 FX-ACT：ACTIVE + FileVersion

依赖：FX-FZ。

顺序：

1. O：`EXECUTING -> APPLIED`，lease 改为 NULL。
2. LC：`FINALIZING -> ACTIVE`，lease NULL。
3. A：`FINALIZING -> COMPLETED`。
4. Staging Lifecycle：`STAGING_READY -> DELETED`，保留完整证明。
5. INSERT FileVersion FV，关联 ACTIVE LC、COMPLETED A、APPLIED O。
6. Intent：`UPLOADING -> COMPLETED`，currentAttempt=NULL，completedFileVersionId=FV。

中间状态依赖 Deferred Trigger，包括 APPLIED+LC FINALIZING、ACTIVE+无 FV、A COMPLETED+Lifecycle 未 DELETED。

预期 COMMIT：成功，ACTIVE LC 恰好一条 FileVersion。

停止条件：FileVersion 关联不完整、ACTIVE 无 FV、Attempt/Intent 完成后数量不匹配。

### 5.8 FX-QN：QUARANTINED

状态：`BLOCKED`

目标：通过合法隔离流程从允许的前态转换到 `QUARANTINED`，不得直接 INSERT 最终状态。

当前设计状态：

- CANONICAL orphan 的技术创建协议已由 C-6.2-J 冻结；
- 必须经 NOLOGIN Definer 的受控函数创建；
- 需要 QUARANTINE Operation、AuditLog evidence 和对象级锁；
- 专用角色、函数和 evidence 结构尚未实施。

解除阻断前不得生成可执行 Fixture SQL。

### 5.9 FX-PP：PURGE_PENDING

状态：`BLOCKED`

目标：从合法 `QUARANTINED` Fixture 转换到 `PURGE_PENDING`，不得直接 INSERT 最终状态。

依赖 FX-QN 解除阻断。J 已设计 approval、grace period、PURGE Operation、currentOperation 切换和 lease 一致性；实现仍为 `BLOCKED`。

### 5.10 FX-DE：DELETED

状态：`BLOCKED`

目标：通过合法 CANONICAL Purge 流程从 `PURGE_PENDING` 转换到 `DELETED`，不得直接 INSERT 最终状态。

空 STAGING 直接进入 `DELETED` 仍为 `SCHEMA GAP / BLOCKED`，不得作为 Fixture 例外或绕过上传链、close attestation 的依据。

依赖 FX-PP 或另行批准的空 STAGING 特殊协议。

### 5.11 FX-FR：FAILED_RETAINED

目标：从合法前态通过真实 Operation 失败转换到 `FAILED_RETAINED`，不得直接 INSERT 终态。

目标构造：

1. 建立合法 FX-FZ；
2. FINALIZE Operation 从 `EXECUTING` 转为 `FAILED`，lease 置 NULL；
3. CANONICAL Lifecycle 从 `FINALIZING` 转为 `FAILED_RETAINED`，lease 置 NULL；
4. 不创建 FileVersion；
5. 在 COMMIT 阶段验证 Operation/Lifecycle 和上传链一致性。

状态：`TARGET DEFINED / NOT VERIFIED`。

## 6. 覆盖矩阵

| 类别 | 编号 |
|---|---|
| Lifecycle | `DB-LC-01` 至 `DB-LC-10` |
| Deferred Trigger | `DB-DF-01` 至 `DB-DF-08` |
| Attempt/FileVersion | `DB-CH-01` 至 `DB-CH-10` |
| Operation/Lifecycle | `DB-OP-01` 至 `DB-OP-10` |
| Close Attestation | `DB-CA-01` 至 `DB-CA-10` |
| DELETE/TRUNCATE | `DB-DT-01` 至 `DB-DT-03` |
| 并发数据库 | `DB-CC-01` 至 `DB-CC-06` |
| 事务/回滚 | `DB-RB-01` 至 `DB-RB-04` |
| 应用 CAS | `INT-GEN-01`、`INT-GEN-02` |
| 应用锁顺序 | `INT-LOCK-01`、`INT-LOCK-02` |
| 文件系统 | `FS-01` 至 `FS-06` |

## 7. 详细纯数据库测试

### 7.1 Lifecycle

| ID | 初始状态 | 操作 | 预期 | SQLSTATE | 连接/事务 | 清理 | Deferred |
|---|---|---|---|---|---|---|---|
| `DB-LC-01` | 各未阻断合法源 Fixture | 参数化执行允许状态边 | COMMIT 成功 | N/A | 单连接；含 Commit | clone 丢弃 | 是 |
| `DB-LC-02` | 各状态 Fixture | 对状态矩阵中所有非白名单边逐一更新 | 失败 | `23514` | 单事务 | rollback | 否；BEFORE 状态 Trigger 先失败 |
| `DB-LC-03` | `FX-SR` | `STAGING_RESERVED -> DELETED` | 失败 | `23514` | 单事务 | rollback | 否 |
| `DB-LC-04` | `FX-ACT` | ACTIVE + FileVersion 离开 ACTIVE | 失败 | `23514` | 单事务 | rollback | 否；BEFORE Trigger 先失败 |
| `DB-LC-05` | `FX-FR` | 终态转换到其他状态 | 失败 | `23514` | 单事务 | rollback | 否；BEFORE Trigger 先失败 |
| `DB-LC-06` | `FX0` + 合法上传链 | 直接 INSERT 普通 STAGING 非法初始状态 | B 修复后语句失败 | `23514` | 单事务 | rollback | 否；BEFORE INSERT 先失败 |
| `DB-LC-07` | `FX0` + 合法上传链 | 合法 INSERT `STAGING_RESERVED` | COMMIT 成功 | N/A | 单事务 | clone | 是 |
| `DB-LC-08` | `FX0` + 合法 Finalize 链 | 直接 INSERT 普通 CANONICAL 非法初始状态 | B 修复后语句失败 | `23514` | 单事务 | rollback | 否；BEFORE INSERT 先失败 |
| `DB-LC-09` | 合法 FX-FZ 依赖 | 合法 INSERT `CANONICAL FINALIZING` | COMMIT 成功 | N/A | 单事务 | clone | 是 |
| `DB-LC-10` | 特殊协议临时链 | CANONICAL orphan 或空 STAGING DELETED | `BLOCKED` | `NOT_VERIFIED` | 待定 | 待定 | 待定 |

`FX-QN`、`FX-PP`、`FX-DE` 解除阻断前不得进入可执行测试集合。终态保护测试先由未阻断的 `FX-FR` 覆盖；FX-DE 解除阻断后再补充 `DELETED` 专属终态测试。

初始状态测试必须区分：

```text
BEFORE INSERT Trigger 语句阶段失败
CHECK/FK 语句阶段失败
Deferred Constraint Trigger COMMIT 阶段失败
最终事务终态
```

合法边：

```text
STAGING_RESERVED -> STAGING
STAGING -> STAGING_READY
STAGING -> STAGING_ABANDONED
STAGING_READY -> DELETED
STAGING_READY -> QUARANTINING
STAGING_READY -> STAGING_ABANDONED
STAGING_ABANDONED -> QUARANTINING
STAGING_ABANDONED -> DELETED
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

### 7.2 Deferred Trigger

| ID | 初始状态 | 操作 | 预期 | SQLSTATE | 连接/事务 | 清理 | Deferred |
|---|---|---|---|---|---|---|---|
| `DB-DF-01` | `FX-SW` | 部分链暂不完整，最终补齐为 FX-SRdy 后 COMMIT | 成功 | N/A | 单事务 | clone | 是 |
| `DB-DF-02` | `FX-SR` | 最终 Intent/currentAttempt/Attempt 数不一致 | COMMIT 失败 | `23514` | 1 writer + 1 observer | rollback | 是 |
| `DB-DF-03` | `FX-FZ` | 多次更新 Operation/Lifecycle，最终合法 | 成功 | N/A | 单事务 | clone | 是 |
| `DB-DF-04` | `FX-FZ` | 多次更新后最终关系非法 | COMMIT 失败 | `23514` | 1 writer + 1 observer | rollback | 是 |
| `DB-DF-05` | `FX-SR` | A `RESERVED -> ABANDONED`；创建唯一 open B；Intent current A→B | 成功 | N/A | 单事务 | clone | 是 |
| `DB-DF-06` | A 终态、B open | Intent 最终仍指向 A | COMMIT 失败 | `23514` | 1 writer + 1 observer | rollback | 是 |
| `DB-DF-07` | `FX-FZ` + 两个 Operation | OLD current O1 terminal；NEW current O2 active；最终切换 | 成功 | N/A | 单事务 | clone | 是 |
| `DB-DF-08` | `FX-FZ` + 两个 Operation | OLD current O1 仍 active 时切换 O2 | COMMIT 失败 | `23514` | 1 writer + 1 observer | rollback | 是 |

DF-05 特别说明：

```text
one_open_upload_attempt_per_intent
```

禁止两个同时 open 的 Attempt。因此必须先让 A 终态，再创建 B。若同时存在两个 open Attempt，测试会先得到 `23505`，不能用于 OLD/NEW 链检查。

### 7.3 Attempt/FileVersion

| ID | 初始状态 | 操作 | 预期 | SQLSTATE | 连接/事务 | 清理 | Deferred |
|---|---|---|---|---|---|---|---|
| `DB-CH-01` | `FX-SR` | 修改 Attempt.intentId | 失败 | `23514` | 单连接 | clone | 否 |
| `DB-CH-02` | `FX-SR` | 修改 Attempt.stagingKey | 失败 | `23514` | 单连接 | clone | 否 |
| `DB-CH-03` | `FX-SRdy` | 在错误状态设置 canonicalStorageKey | 失败 | `23514` | 单连接 | clone | 否；BEFORE UPDATE Trigger 先失败 |
| `DB-CH-04` | `FX-FZ` | 完成合法 ACTIVE/FileVersion 链 | 成功 | N/A | 单事务 | clone | 是 |
| `DB-CH-05` | `FX-FZ` | ACTIVE 但无 FileVersion | COMMIT 失败 | `23514` | 1 writer + 1 observer | rollback | 是 |
| `DB-CH-06` | `FX-ACT` | 插入第二条 FileVersion | 失败 | `23505` 或 NOT_VERIFIED | 单事务 | rollback | 否；唯一索引先失败 |
| `DB-CH-07` | `FX-FZ` | 非 ACTIVE 插入 FileVersion | 失败 | `23514` | 单事务 | rollback | 否；BEFORE INSERT Trigger 先失败 |
| `DB-CH-08` | `FX-ACT` | 修改 FileVersion 链字段 | 失败 | `23514` | 单连接 | clone | 否 |
| `DB-CH-09` | `FX-SRdy` | Intent 改 COMPLETED 但 FileVersion/Attempt 不足 | COMMIT 失败 | `23514` | 1 writer + 1 observer | rollback | 是 |
| `DB-CH-10` | `FX-SW` | Attempt COMPLETED，但 Staging Lifecycle 非 DELETED | COMMIT 失败 | `23514` | 1 writer + 1 observer | rollback | 是 |

### 7.4 Operation/Lifecycle

| ID | 初始状态 | 操作 | 预期 | SQLSTATE | 连接/事务 | 清理 | Deferred |
|---|---|---|---|---|---|---|---|
| `DB-OP-01` | `FX-FZ` | PREPARED 不再是 currentOperation | 失败 | `23514` | 单事务 | rollback | 是 |
| `DB-OP-02` | `FX-FZ` | EXECUTING 不再是 currentOperation | 失败 | `23514` | 单事务 | rollback | 是 |
| `DB-OP-03` | `FX-FZ` | UNKNOWN 不再是 currentOperation | 失败 | `23514` | 单事务 | rollback | 是 |
| `DB-OP-04` | `FX-FZ` | 单侧 ownerToken 不一致 | 失败 | `23514` | 单事务 | rollback | 是 |
| `DB-OP-05` | `FX-FZ` | 单侧 generation 不一致 | 失败 | `23514` | 单事务 | rollback | 是 |
| `DB-OP-06` | `FX-FZ` | 单侧 lease 不一致或 active lease 为 NULL | 失败 | `23514` | 单事务 | rollback | 是 |
| `DB-OP-07` | 各类型 Fixture | Operation type 与 Lifecycle state 错误配对 | 失败 | `23514` | 单事务 | rollback | 是 |
| `DB-OP-08` | `FX-ACT` | 合法 historical terminal Operation | 成功 | N/A | 单事务 | clone | 是 |
| `DB-OP-09` | `FX-FZ` | 修改 Operation 身份字段 | 失败 | `23514` | 单连接 | clone | 否 |
| `DB-OP-10` | `FX-ACT` | 修改 terminal Operation 结果字段 | 失败 | `23514` | 单连接 | clone | 否 |

### 7.5 Close Attestation

| ID | 初始状态 | 操作 | 预期 | SQLSTATE | 连接/事务 | 清理 | Deferred |
|---|---|---|---|---|---|---|---|
| `DB-CA-01` | `FX-SW` | 所有证明字段 NULL、verified=false | 成功 | N/A | 单事务 | clone | 是 |
| `DB-CA-02` | `FX-SW` | 部分 attestation 字段 | 失败 | `23514` | 单事务 | rollback | 否 |
| `DB-CA-03` | `FX-SRdy` | verified=true 但 dev/ino 缺失 | 失败 | `23514` | 单事务 | rollback | 否；CHECK 在语句阶段失败 |
| `DB-CA-04` | `FX-SRdy` | verified=false 但 dev/ino 非空 | 失败 | `23514` | 单事务 | rollback | 否；CHECK 在语句阶段失败 |
| `DB-CA-05` | `FX-SRdy` | 参数化修改 attempt/owner/generation/size/checksum 快照 | 失败 | `23514` | 单事务 | rollback | 否；快照 CHECK/Trigger 在语句阶段失败 |
| `DB-CA-06` | `FX-SRdy` | 建立证明后修改/清空任一证明或快照字段 | 失败 | `23514` | 单事务 | clone | 否 |
| `DB-CA-07` | `FX-SW` | Attempt 升级 READY 但无证明 | COMMIT 失败 | `23514` | 1 writer + 1 observer | rollback | 是 |
| `DB-CA-08` | `FX-SRdy` | 无完整证明进入 cleanup | 失败 | `23514` | 单事务 | rollback | 否；BEFORE 状态 Trigger 先失败，另有 Deferred guard |
| `DB-CA-09` | `FX-SW` | lease 过期后尝试自动 cleanup | 失败 | `23514` | 单事务 | rollback | 否；BEFORE 状态 Trigger 先失败 |
| `DB-CA-10` | `FX0` + STAGING 清理依赖 | 直接 INSERT STAGING `QUARANTINING`、`QUARANTINED`、`PURGE_PENDING` 或 `DELETED` 且无证明 | 失败 | `23514` | 单事务 | rollback | 否；A 修复后 BEFORE INSERT 先失败，另有 Deferred guard |

`DB-CA-10` 用于验证“仅 A 已实施”的阶段。A+B 均已实施后，同一直接 INSERT 会先被合法初始状态白名单拒绝；此时 close attestation 仍需通过合法前态 UPDATE、Deferred Trigger 和 CLEANUP 流程分别验证。

### 7.6 DELETE / TRUNCATE

| ID | 初始状态 | 操作 | 预期 | SQLSTATE | 连接/事务 | 清理 | Deferred |
|---|---|---|---|---|---|---|---|
| `DB-DT-01` | 五表均有真实行 | 逐表 DELETE | 失败 | `42501` | 单事务 | rollback | 否 |
| `DB-DT-02` | 空表或真实数据 | 五表逐一 TRUNCATE | 失败 | `42501` | 单事务 | rollback | 否 |
| `DB-DT-03` | 空表 | 多表 TRUNCATE 和 TRUNCATE CASCADE | 失败 | `42501` | 单事务 | rollback | 否 |

DELETE 测试必须使用真实行，否则 Row Trigger 不会执行。

### 7.7 并发数据库行为

| ID | 初始状态 | 操作 | 预期 | SQLSTATE | 连接 | 清理 | Deferred |
|---|---|---|---|---|---|---|---|
| `DB-CC-01` | 同 Intent 无 open Attempt | 并发创建 open Attempt | 一成功，一失败 | `23505` | 2 | clone | 是 |
| `DB-CC-02` | 同 storageKey 无 active Operation | 并发创建 active Operation | 一成功，一失败 | `23505` | 2 | clone | 是 |
| `DB-CC-03` | `FX-FZ` | 竞争 currentOperation | 仅一个一致 owner | 可能 `23505`/`23514` | 2 | clone | 是 |
| `DB-CC-04` | 两个 close proof 候选 | 并发写不同 attestation | 仅一个成功 | 可能 `23514`/`23505` | 2 | clone | 是 |
| `DB-CC-05` | Finalize/Purge 或 Quarantine/Restore 候选 | 竞争 current active Operation | 仅一个 active | 可能 `23505`/`23514` | 2 | clone | 是 |
| `DB-CC-06` | `FX-FZ` | 旧连接使用旧 generation 条件 UPDATE | 旧连接影响 0 行 | N/A | 2 | clone | 是 |

### 7.8 事务与回滚

| ID | 初始状态 | 操作 | 预期 | SQLSTATE | 连接 | 清理 |
|---|---|---|---|---|---|---|
| `DB-RB-01` | clone | 最终非法 Deferred 链 COMMIT | 整事务回滚 | `23514` 或 NOT_VERIFIED | 1 writer + 1 observer | rollback |
| `DB-RB-02` | clone Fixture | SAVEPOINT 内非法 UPDATE，随后 rollback to savepoint | 原事务继续 | 具体 Trigger 码 | 1 | clone |
| `DB-RB-03` | 两连接竞争 | 一提交、一失败/ROLLBACK | 只保留赢家 | 可能 `23505`/`23514` | 2 | clone |
| `DB-RB-04` | clone | COMMIT 已发送后断开连接 | 只能由新连接核实数据库状态 | NOT_VERIFIED | 2 + fault injection | 保留取证 |

## 8. Generation / Fencing 分层

| ID | 测试 | 当前状态 |
|---|---|---|
| `DB-OP-04/05/06` | 数据库 owner/generation/lease 相等与非空 | 可进行纯 DB 测试 |
| `INT-GEN-01` | 应用层 generation CAS | `NOT_IMPLEMENTED` |
| `INT-GEN-02` | 旧 Worker 使用过期 generation 更新 | `NOT_IMPLEMENTED` |
| `FS-01` | `FileHandle.close()` 成功后提交证明 | `NOT_IMPLEMENTED` |
| `FS-02` | 旧 Worker 仍可写，禁止自动清理 | `NOT_IMPLEMENTED` |

数据库能检查字段一致性和部分状态，但不能：

- 保证 generation 单调递增；
- 按当前时间拒绝 lease 过期；
- 终止旧 Worker；
- 证明文件句柄关闭；
- 阻止旧进程继续 hard-link/unlink。

## 9. 锁顺序边界

当前事实：

- 没有 advisory lock；
- 没有 storageKey 排序规则；
- 没有应用层 P1-3 锁代码；
- 数据库仅在 canonical owner 检查中使用两处 `FOR UPDATE`，在 FileVersion active 校验中使用一处 `FOR SHARE`。

| ID | 测试 | 当前状态 |
|---|---|---|
| `INT-LOCK-01` | 多 storageKey 固定字典序锁定、无死锁 | `NOT_IMPLEMENTED` |
| `INT-LOCK-02` | 反向锁序诊断和 `40P01` 记录 | `NOT_IMPLEMENTED` |

专项执行前必须明确：

- 锁定代码位置；
- storageKey 规范化和排序 collation；
- 锁粒度；
- 重试策略；
- 如何记录 `pg_stat_activity.wait_event_type`、`pg_locks` 和应用日志。

## 10. 文件系统集成边界

| ID | 测试 | 当前状态 |
|---|---|---|
| `FS-01` | FileHandle.close 后提交 attestation | `NOT_IMPLEMENTED` |
| `FS-02` | 旧 Worker 仍运行时禁止清理 | `NOT_IMPLEMENTED` |
| `FS-03` | hard-link no-overwrite、size/hash/identity | `NOT_IMPLEMENTED` |
| `FS-04` | symlink/Junction/Reparse Point/跨卷 fail closed | `PARTIAL`：Inventory/read path tested；cleanup/跨卷集成未实现 |
| `FS-05` | 数据库 rollback 后保留物理文件 | `NOT_IMPLEMENTED` |
| `FS-06` | quarantine/restore/purge 与 unknown COMMIT | `NOT_IMPLEMENTED` |

这些不能由纯数据库测试代替。

## 11. 测试数据隔离和清理

- 失败用例使用单事务并 ROLLBACK。
- Deferred COMMIT 失败使用写连接和独立观察连接。
- 成功 COMMIT 和并发测试使用一次性数据库 clone。
- 不使用 DELETE、TRUNCATE、禁用 Trigger 或 `session_replication_role` 清理。
- 不使用 `test:db:init/reset`。
- clone 的创建和 DROP 需要独立授权。
- 全程禁止访问 `elevator_advisor` 和 `elevator_advisor_test`。

## 12. 执行权限

管理员：

- 建立/销毁明确命名的临时 clone；
- 临时启用/关闭 Migrator；
- 读取 `pg_stat_activity`、`pg_locks`；
- 不得绕过 Trigger 修数据。

数据库测试角色使用 Migrator：

- CONNECT 专用 clone；
- public Schema USAGE；
- 对相关表 SELECT/INSERT/UPDATE/DELETE/TRUNCATE；
- 无 SUPERUSER、CREATEDB、CREATEROLE；
- 不继承现有应用角色。

Runtime 不创建、不用于本轮纯 DB 测试。

## 13. C-6.2 执行前准备

1. 重新只读核对当前数据库 Migration、函数、Trigger 和索引未漂移。
2. 完成 C-6.2-C2 审核，并关闭或被正式排除特殊创建协议。
3. 分别设计、实施和复核 A 与 B；C 仅在证明必要时另行设计。
4. 按冻结规则调整并自测 Fixture Builder。
5. 实现一次数据库 clone 流程和命名白名单。
6. 实现 SQLSTATE 捕获、多连接 barrier、lock/deadlock 诊断。
7. 验证每个未阻断 Fixture 能合法 COMMIT。
8. 保持 generation CAS、锁顺序和文件系统测试为 `NOT_IMPLEMENTED`，除非应用代码另行实现并审查。
9. 分离数据库行为测试、应用集成测试和文件系统集成测试。
10. 测试环境不得读取仓库 `.env` 或 `.env.test`。
11. 在执行前取得独立授权。

## 14. B 专项数据库测试方案

本矩阵仅定义 B 实施后的验证方案，不代表 B 已实施或测试已执行。

| ID | Fixture / 构造 | 操作 | 预期 | 失败阶段 | SQLSTATE | Deferred / 事务 |
|---|---|---|---|---|---|---|
| `B-DB-01` | 合法 Intent + RESERVED Attempt + STAGING_RESERVED | INSERT Lifecycle -> 激活 Intent | 允许 | N/A | N/A | Deferred 上传链通过；最终 ROLLBACK |
| `B-DB-02` | 合法 STAGING 依赖 | 直接 INSERT STAGING `STAGING` | 拒绝 | BEFORE INSERT | `23514` | SAVEPOINT + ROLLBACK |
| `B-DB-03` | 合法 STAGING 依赖 | 直接 INSERT `STAGING_READY` | 拒绝 | BEFORE INSERT | `23514` | SAVEPOINT + ROLLBACK |
| `B-DB-04` | 合法 STAGING 依赖 | 直接 INSERT `STAGING_ABANDONED` | 拒绝 | BEFORE INSERT | `23514` | SAVEPOINT + ROLLBACK |
| `B-DB-05` | FX-FZ 目标依赖 | INSERT CANONICAL FINALIZING | 允许 | N/A | N/A | FINALIZE / Attempt / Operation Deferred 检查 |
| `B-DB-06` | CANONICAL FINALIZE 依赖 | 直接 INSERT CANONICAL ACTIVE | 拒绝 | BEFORE INSERT | `23514` | SAVEPOINT + ROLLBACK |
| `B-DB-07` | QUARANTINE 依赖 | 普通直接 INSERT CANONICAL QUARANTINED | 拒绝 | BEFORE INSERT | `23514` | 特殊协议 BLOCKED；SAVEPOINT + ROLLBACK |
| `B-DB-08` | PURGE 依赖 | 直接 INSERT CANONICAL PURGE_PENDING | 拒绝 | BEFORE INSERT | `23514` | 特殊协议 BLOCKED；SAVEPOINT + ROLLBACK |
| `B-DB-09` | PURGE APPLIED 依赖 | 普通直接 INSERT CANONICAL DELETED | 拒绝 | BEFORE INSERT | `23514` | 特殊协议 BLOCKED；SAVEPOINT + ROLLBACK |
| `B-DB-10` | FAILED Operation 依赖 | 直接 INSERT CANONICAL FAILED_RETAINED | 拒绝 | BEFORE INSERT | `23514` | 必须改为 FX-FZ 失败转换 |
| `B-DB-11` | FX-SR | UPDATE 到 STAGING / WRITING | 允许 | N/A | N/A | B 不影响 UPDATE；最终 ROLLBACK |
| `B-DB-12` | FX-SR | 非法 `STAGING_RESERVED -> DELETED` | 拒绝 | BEFORE UPDATE | `23514` | 原 UPDATE 白名单 |
| `B-DB-13` | FX-FZ 完整链 | Lifecycle + FINALIZE Operation + Attempt | 允许 | N/A | N/A | Deferred 关系通过 |
| `B-DB-14` | 非法/NULL kind/state 组合 | 直接 INSERT 未列入白名单组合或 NULL | 拒绝 | BEFORE INSERT；非法 enum literal 可能在解析阶段失败 | NULL/合法枚举组合为 `23514`；非法 enum literal 为 `22P02` | SAVEPOINT + ROLLBACK |
| `B-DB-15` | 特殊协议候选 | 普通调用者 INSERT CANONICAL QNING / STAGING DELETED | 拒绝 | BEFORE INSERT | `23514` | 特殊协议 BLOCKED |
| `B-DB-16` | STAGING cleanup 缺或不完整证明 | 直接 INSERT STAGING cleanup | 拒绝 | BEFORE INSERT | `23514` | 应保留 A cleanup attestation 错误来源 |

补充：

- B-DB-08 和 B-DB-09 不表示这些状态永远不能创建，只表示普通 INSERT 被拒绝；
- B-DB-15 用于证明普通调用者不能利用尚未冻结的特殊协议；
- B-DB-16 的 INSERT 分支顺序必须先执行 A cleanup attestation，再执行 B 普通初始状态检查；
- `REAL COMMIT` 测试的数据隔离策略必须在 B 执行授权中单独确认。

## 15. 当前结论

- 本文件是完整测试方案，不是测试结果。
- 数据库 Trigger/Fixture/并发行为均未执行。
- Lifecycle 普通初始状态已冻结，特殊创建协议设计已冻结但实现仍为 `BLOCKED`。
- FX-QN、FX-PP、FX-DE 仍为 `BLOCKED`。
- B Migration 已创建、应用并通过 Catalog 验证。
- B-DB-01 至 B-DB-16 已执行；成功型事务因无安全清理协议未执行真实 COMMIT。
- C-6.2-B2 未获授权且不得执行。
- 应用层 P1-3 implementation 不存在。
- 文件系统协议尚未测试。
- 不得据本文件声称 P1-3 运行时安全已经验收。

## 16. C-6.2-H 实际执行结果

| ID | 状态 | SQLSTATE | 阶段 | 事务结果 |
|---|---|---|---|---|
| B-DB-01 | PARTIAL | N/A | INSERT + SET CONSTRAINTS 通过 | ROLLBACK；真实 COMMIT 未验证 |
| B-DB-02 | PASS | `23514` | BEFORE INSERT | ROLLBACK TO SAVEPOINT + ROLLBACK |
| B-DB-03 | PASS | `23514` | BEFORE INSERT | ROLLBACK TO SAVEPOINT + ROLLBACK |
| B-DB-04 | PASS | `23514` | BEFORE INSERT | ROLLBACK TO SAVEPOINT + ROLLBACK |
| B-DB-05 | PARTIAL | N/A | B 初始检查通过 | ROLLBACK；Deferred/COMMIT 未执行 |
| B-DB-06 | PASS | `23514` | BEFORE INSERT | ROLLBACK TO SAVEPOINT + ROLLBACK |
| B-DB-07 | PASS | `23514` | BEFORE INSERT | ROLLBACK TO SAVEPOINT + ROLLBACK |
| B-DB-08 | PASS | `23514` | BEFORE INSERT | ROLLBACK TO SAVEPOINT + ROLLBACK |
| B-DB-09 | PASS | `23514` | BEFORE INSERT | ROLLBACK TO SAVEPOINT + ROLLBACK |
| B-DB-10 | PASS | `23514` | BEFORE INSERT | ROLLBACK TO SAVEPOINT + ROLLBACK |
| B-DB-11 | PARTIAL | N/A | UPDATE + SET CONSTRAINTS 通过 | ROLLBACK；真实 COMMIT 未验证 |
| B-DB-12 | PASS | `23514` | BEFORE UPDATE | ROLLBACK TO SAVEPOINT + ROLLBACK |
| B-DB-13 | PARTIAL | N/A | 完整 FZ 链 + SET CONSTRAINTS 通过 | ROLLBACK；真实 COMMIT 未验证 |
| B-DB-14 | PASS | NULL/组合 `23514`；未知 enum `22P02` | BEFORE INSERT/解析 | ROLLBACK TO SAVEPOINT + ROLLBACK |
| B-DB-15 | PASS | `23514` | BEFORE INSERT | ROLLBACK TO SAVEPOINT + ROLLBACK |
| B-DB-16 | PASS | `23514` | BEFORE INSERT / A attestation | ROLLBACK TO SAVEPOINT + ROLLBACK |

统计：

```text
PASS    = 12
PARTIAL = 4
FAIL    = 0
BLOCKED = 0
```

## 17. C-6.2-J 特殊协议测试设计

本节只定义未来测试，未执行。

| ID | 场景 | 预期 | 特殊协议状态 |
|---|---|---|---|
| J-QN-01 | orphan 扫描后经专用函数创建 QNING | Lifecycle、Operation、AuditLog 原子成功 | 需后续实施 |
| J-QN-02 | Runtime 直接 INSERT QNING | 拒绝 | B 保持 |
| J-QN-03 | 已有 Lifecycle 的 key | 拒绝 orphan 创建 | 需函数检查 |
| J-QN-04 | 已有 FileVersion 的 key | 拒绝 | 需函数检查 |
| J-QN-05 | Intent/Attempt 引用该 key | 拒绝 | 需函数检查 |
| J-QN-06 | QNING 缺 QUARANTINE Operation | Deferred 检查失败 | 已有关系 Trigger |
| J-QN-07 | 错误 sourceAttemptId | 拒绝 | 需函数/Trigger |
| J-QN-08 | 重复 requestId | 幂等返回已有记录 | 需函数/审计 |
| J-QN-09 | 并发两个 orphan 创建 | 一个成功、一个等待/拒绝 | 需 advisory lock |
| J-QN-10 | QNING 非法状态跳转 | `23514` | 已有 UPDATE 白名单 |
| J-QN-11 | 物理 hash/size 与证据不符 | 拒绝/隔离失败 | 需文件系统验证 |
| J-QN-12 | AuditLog 插入失败 | 整事务回滚 | 需函数原子性 |
| J-PP-01 | QN 到期、审批、创建 PURGE Operation | 进入 PP | 需后续 |
| J-PP-02 | 无审批 | 拒绝 | 需后续 |
| J-PP-03 | grace 未到期 | 拒绝 | 需后续 |
| J-PP-04 | 存在 FileVersion | 拒绝 | 需后续 |
| J-PP-05 | currentOperation 不匹配 | 拒绝 | 已有 Deferred |
| J-PP-06 | 并发两个 PURGE Operation | 只允许一个 active | 已有唯一索引 |
| J-PP-07 | PP 后取消 | 当前 Schema 拒绝/FR | 取消协议 OPEN |
| J-PP-08 | 物理删除成功并最终数据库化 | DELETED | 需文件系统集成 |
| J-PP-09 | 物理文件仍存在 | FR/UNKNOWN | 需文件系统集成 |
| J-PP-10 | 删除后 DB COMMIT 未知 | 新连接核验 | 需独立观察连接 |
| J-DE-01 | canonical QN -> PP -> DELETED | 合法 DELETED | 需 Clone COMMIT |
| J-DE-02 | empty STAGING 直接 DELETED | 拒绝 | BLOCKED / SCHEMA GAP |
| J-DE-03 | STAGING_ABANDONED 无 close proof | 保留，不 DE | A 保持 |
| J-DE-04 | 伪造 size/checksum/attestation | 拒绝 | A 保持 |
| J-FR-01 | FINALIZE FAILED -> FAILED_RETAINED | 成功 | 现有状态机 |
| J-FR-02 | 写入前失败 | FR，无 FileVersion | 现有状态机 |
| J-FR-03 | 部分写入失败 | FR/UNKNOWN | 需文件系统集成 |
| J-FR-04 | 物理完成后 DB 失败 | EXECUTING/UNKNOWN | 需独立观察 |
| J-FR-05 | DB 成功后通知失败 | 保持 ACTIVE | 通知重试 |
| J-FR-06 | Worker 崩溃/lease 过期 | UNKNOWN | 需真实 DB/进程 |
| J-FR-07 | 同 Operation 重放 | 不产生第二 FileVersion | 已有唯一约束 |
| J-FR-08 | 多 Worker 并发 | 一个成功 | 需多连接 |
| J-PERM-01 | PUBLIC EXECUTE 撤销后 Trigger 回归 | Trigger 正常 | 需 ACL 阶段 |
| J-PERM-02 | Runtime 调用特殊函数 | 拒绝 | 需角色阶段 |
| J-PERM-03 | Migrator 越权 Runtime/Definer | 拒绝 | 需 Clone |
| J-AUD-01 | AuditLog UPDATE/DELETE/TRUNCATE | UPDATE/DELETE 拒绝；TRUNCATE 需 ACL/Guard 防住 | SCHEMA GAP |
| J-CL-01 | Clone 内真实成功 COMMIT | 允许 | 主清理方案 |
| J-CL-02 | Clone 销毁后无物理/DB 残留 | 通过 | 主清理方案 |

主清理方案：

```text
一次性隔离数据库/Clone
```

备用：

```text
SAVEPOINT + SET CONSTRAINTS + ROLLBACK
```

禁止：

```text
在共享验证库增加生产可见的 Cleanup 函数
放宽 DELETE / TRUNCATE
```

## 18. C-6.2-J 当前结论

- 特殊协议设计已形成；
- 未实施特殊函数或角色；
- FX-QN、FX-PP 设计完成但实施 BLOCKED；
- 空 STAGING DELETED 为 `SCHEMA GAP`；
- FX-FR 可沿用现有终态路径，真实故障窗口仍需文件系统与多连接测试；
- B-DB 四项 PARTIAL 仍保留，不能用 Rollback 冒充真实 COMMIT。

## 19. C-6.2-K Storage Cleanup 测试扩展

本节只扩展测试设计，不代表任何测试已执行。完整威胁模型、Schema Gap 和测试说明见：

```text
docs/architecture/file-lifecycle-p13-c6-2-k-design.md
```

### 19.1 新测试编号

| 类别 | 编号范围 | 覆盖 |
|---|---|---|
| Orphan Cleanup | `K-ORPH-01` 至 `K-ORPH-10` | 真实 orphan、活动引用、并发新增引用、错误 identity、重复扫描、崩溃、Reparse Point |
| Expired Intent | `K-INT-01` 至 `K-INT-10` | 未创建、active writer、READY、续期、Operation 冲突、双 Worker、rollback |
| Physical Delete | `K-PHYS-01` 至 `K-PHYS-10` | 存在/不存在/失败/超时/未知、DB 失败、lease 丢失、路径变化、Temp link |
| Recovery | `K-REC-01` 至 `K-REC-08` | 旧 Worker、Operation 重放、EXECUTING 超时、evidence 缺失、对象重现 |
| AuditLog | `K-AUD-01` 至 `K-AUD-06` | UPDATE/DELETE/TRUNCATE、actor FK、审计失败回滚 |
| Permission | `K-SEC-01` 至 `K-SEC-07` | Runtime、Maintenance、Definer、跨 scope、路径注入 |
| Clone / Commit | `K-CL-01` 至 `K-CL-04` | 真实 COMMIT、Deferred 失败、clone 销毁、错误数据库阻断 |

### 19.2 强制分层

每个 Cleanup 测试必须标记至少一种：

```text
STATIC
UNIT
INTEGRATION
DATABASE
REAL COMMIT
FAILURE INJECTION
SECURITY
FS
```

以下事实必须分开断言：

```text
database intent
physical creation
physical presence
physical delete request
physical delete result
database finalization
```

禁止用以下任一单一事实替代整个链路：

- `remove()` resolve；
- 文件路径不存在；
- Operation `APPLIED`；
- Lifecycle `DELETED`；
- Worker 日志；
- 全局 maintenance lease。

### 19.3 并发与锁测试

Orphan 测试必须使用两个真实 PostgreSQL 连接：

```text
Connection A: scanner 获取 key lock，完成 eligibility snapshot
Connection B: pre-finalize writer 尝试建立同一 key 的 canonical 引用
```

预期只能是以下两种结果之一：

```text
writer 先提交 -> scanner recheck 失败并保留对象
scanner 先提交 claim -> writer 的引用创建失败
```

不允许：

```text
scanner 基于旧 snapshot 删除对象
writer 成功提交指向已删除对象的引用
```

当前数据库没有统一 storageKey advisory lock，故该测试在执行前必须实现相应受控函数或证明等价机制；当前状态为 `IMPLEMENTATION BLOCKER / NOT_VERIFIED`。

### 19.4 Intent cleanup 测试边界

- 不得把“Intent 已过期”直接作为物理删除条件；
- 必须同时核验 Attempt、Lifecycle、Operation、close attestation 和 physical evidence；
- Intent 状态更新与物理删除必须分开记录；
- Web Runtime 不获得物理删除 capability；
- `PENDING`、`UPLOADING`、`FAILED`、`COMPLETED` 的清理行为分别测试；
- `UPLOADING` 的 active、stale、renewed、active Operation 状态分别测试；
- 任何 `UNKNOWN` 结果不得自动转为 `rolled_back` 或 `DELETED`。

### 19.5 Never-created / empty STAGING

必须区分：

```text
never created + absence verified
create started + unknown
created empty
partial write
complete closed
unknown
```

当前 Schema 没有这些强类型事实，以下测试保持 `BLOCKED / SCHEMA GAP`：

- 无物理文件、无 lifecycle 的 Intent 直接 `DELETED`；
- `sizeBytes=0` 表示为 empty；
- 以 `closeAttestationId=NULL` 证明 never-created；
- `UPLOADING` 的 RECOVERY_REQUIRED Attempt 自动删除。

### 19.6 Worker 双轨迁移测试

测试必须证明：

1. Discovery/Shadow 不执行物理删除；
2. 同一时刻只有一个 Worker 版本拥有物理删除能力；
3. 旧 Worker 在失去 DB lease 后不能提交新的状态转换；
4. 旧 Worker 已发出的 OS 操作不能被虚假描述为已被 generation fencing；
5. 旧代码下线后不存在隐藏的请求内 cleanup 路径；
6. 回滚只会减少删除能力，不会重新启用旧删除路径。

### 19.7 AuditLog 完整性

在真实 clone 中测试：

```text
UPDATE audit_log -> 42501
DELETE audit_log -> 42501
TRUNCATE audit_log -> 当前 NOT_VERIFIED；目标为 42501
TRUNCATE audit_log CASCADE -> 当前 NOT_VERIFIED；目标为 42501
```

当前只有 UPDATE/DELETE Row Trigger。TRUNCATE Guard、ACL 和 actor FK 删除行为必须在独立授权阶段设计、实施并由真实数据库验证。

### 19.8 当前结论

```text
C-6.2-K tests:
DESIGN ONLY

Legacy cleanup:
IMPLEMENTATION BLOCKER

P13 cleanup integration:
NOT IMPLEMENTED

Real PostgreSQL:
NOT CONNECTED

Real COMMIT:
NOT EXECUTED

Fixture execution:
NOT EXECUTED
```

## 20. C-6.2-L Legacy Cleanup 止损测试结果

### 20.1 已实施止损

- Web `createUploadIntent()` 不再调用旧过期 Intent 清理；
- Web `cleanupExpiredUploadIntents()` 显式 fail closed；
- Web `completeUpload()` 异常路径不再删除 Staging 或 Canonical；
- Worker Maintenance 不再查询/更新过期 Intent，也不再执行 orphan/temp 删除；
- Storage Adapter 的四个旧业务删除方法显式拒绝；
- 失败的部分 Staging 写入保留，不再在 catch 中删除；
- 未引入可重新启用旧删除的 Feature Flag。

### 20.2 已执行的不连接数据库测试

| 测试组 | 文件 | 结果 |
|---|---|---|
| Storage Adapter fail-closed | `packages/file-storage/tests/local-private-storage.test.ts` | 15/15 PASS |
| Web Legacy Cleanup 与上传异常 | `apps/web/tests/legacy-cleanup-shutdown.test.ts` | 5/5 PASS |
| Web 下载回归 | 既有 download-* 单元测试 | 17/17 PASS |
| Worker Legacy Cleanup | `apps/worker/tests/legacy-cleanup-shutdown.test.ts` | 2/2 PASS |

### 20.3 测试边界

- 未连接 PostgreSQL；
- 未执行集成或 E2E 测试；
- 未运行真实 Worker；
- 未读取 `.env` 或 `.env.test`；
- file-storage 测试只删除测试自身创建的 mkdtemp 目录；
- 未删除任何业务 Staging/Canonical object。

### 20.4 K 测试状态更新

K 阶段数据库 Cleanup 测试仍为 `DESIGN ONLY`。L 阶段没有执行：

- P13 Cleanup Operation；
- Orphan Quarantine；
- Purge；
- Reconciliation；
- 真实 COMMIT；
- 多连接并发；
- 数据库权限测试。

### 20.5 当前结论

```text
Legacy Web Cleanup:
DISABLED AND UNIT TESTED

Legacy Worker Cleanup:
DISABLED AND UNIT TESTED

Adapter Legacy Delete:
FAIL-CLOSED AND UNIT TESTED

Canonical Commit-Unknown Protection:
IMPLEMENTED AND UNIT TESTED

Database-backed regression:
NOT EXECUTED BY PHASE CONSTRAINT

P13 Cleanup:
NOT ENABLED
```

## 21. C-6.2-L1 部署证据与测试边界

### 21.1 本轮没有新增数据库行为测试

L1 是部署侧只读审计。按授权：

- 不连接 PostgreSQL；
- 不执行 SQL；
- 不执行 Prisma 数据库命令；
- 不运行 Worker；
- 不运行 Cleanup；
- 不修改 Scheduler、Service、ACL 或凭据。

因此第五张表的 queue/schedule、active jobs、旧 Worker 会话等均保持 `UNVERIFIED`。

### 21.2 Deployment Evidence Matrix

| Evidence ID | 状态 | 说明 |
|---|---|---|
| DEP-01 Worker 实例清单 | PARTIALLY VERIFIED | 仓库入口已知；外部实例未知 |
| DEP-02 实际运行版本 | UNVERIFIED | 无 Build ID/SHA/Digest 运行证据 |
| DEP-03 旧 Worker 排空 | UNVERIFIED | 本机无项目进程；外部未知 |
| DEP-04 外部 Scheduler | UNVERIFIED | 仓库无外部配置；平台未知 |
| DEP-05 自动重启检查 | UNVERIFIED | 无部署管理器证据 |
| DEP-06 Storage 删除权限收敛 | BLOCKED | 无生产身份/ACL |
| DEP-07 单 delete owner | BLOCKED | 旧实例未验证排空 |
| DEP-08 正常业务验证 | PARTIALLY VERIFIED | 仅 L 单元测试 |
| DEP-09 New Cleanup 关闭 | PARTIALLY VERIFIED | 源码确认；运行配置未知 |
| DEP-10 旧镜像/构建产物 | BLOCKED | 本地旧 dist/.next 已发现 |

### 21.3 旧构建产物证据

本地发现：

```text
apps/worker/dist/file-maintenance.js
  LastWriteTime: 2026-11-17 01:17:13
  Contains: removeStaging/removeObject/cleanupOrphanObjects/cleanupTemp

apps/web/.next
  BUILD_ID: LULjk7Rp3QcYPDlFEyycy
  Contains old upload cleanup and Storage delete implementations
```

旧产物不得作为正常测试环境或部署候选启动。其清理/隔离需要后续独立授权。

### 21.4 当前状态

```text
C-6.2-L1:
BLOCKED

Legacy Worker Drain:
NOT EXECUTED

New Cleanup:
NOT ENABLED
```

## 27. C-6.2-L7 Deployment Trust 与 Legacy Drain 测试

### 27.1 已执行

- Web/Worker package scripts 的受支持启动入口静态测试；
- Worker package start 指向 secure launcher 的测试；
- Web secure launcher 和 Next instrumentation 双重 Gate 静态测试；
- Manifest 缺失、Trust Root 缺失与公钥替换测试；
- 旧 Lifecycle Safety Version 和过期 Build 的重新签名攻击测试；
- Artifact/Runtime Dependency/Legacy marker 篡改测试；
- Artifact Root 最终 Junction、父路径 Junction、Trust Root 父路径 Junction 测试；
- 离线 Deployment Evidence READY/BLOCKED/INVALID 规则测试；
- Evidence secret、过期、摘要篡改、unknown ACL、legacy scheduler/auto restart/queue 测试；
- L6 Storage capability、Maintenance、Delete Scanner、Storage Inventory 回归。

### 27.2 当前测试边界

```text
Web:
22 files / 134 tests PASS

Worker:
6 files / 19 tests PASS

file-storage:
2 files / 19 tests PASS
```

未执行：

- 真实 Web/Worker；
- 真实 Release launch；
- 真实 PostgreSQL/PgBoss；
- 真实 Windows Service/Task Scheduler；
- 生产 Storage ACL；
- 真实 Cleanup；
- Production Deployment。

### 27.3 外部证据门禁

外部管理员必须通过：

```powershell
pnpm --filter @elevator/web p13:evidence:validate -- <evidence.json>
```

只有 Validator 输出 `READY` 才能进入后续人工排空审批。当前无生产 Evidence，因此：

```text
External Evidence:
NOT PROVIDED

Legacy Worker Drain:
NOT EXECUTED

Production Trust Root:
NOT CONFIGURED

Production Storage ACL:
NOT VERIFIED

Next Phase:
NOT AUTHORIZED
```

## 29. C-6.2-L8-A4 Startup Entry 安全测试

### 29.1 已执行

- Web/Worker production package scripts；
- no direct `next start` / `node dist/index.js`；
- Web Secure Launcher Gate 早于 child server；
- Worker Secure Launcher Gate 早于 release index；
- Worker Gate-first Bootstrap；
- Gate 失败不调用 business loader；
- Gate 成功顺序：Gate -> dynamic import -> startWorker；
- Web Next production server 缺少 isolated dist 时拒绝；
- Manifest/Artifact/Trust/Runtime Dependency 回归；
- Web Upload failure retention；
- Storage capability isolation；
- Maintenance no-delete；
- test-only Worker entry 隔离。

### 29.2 测试结果

```text
Web:
23 files / 150 tests PASS

Worker:
6 files / 19 tests PASS
with explicit --testTimeout 15000

file-storage:
2 files / 19 tests PASS

Web TypeScript:
PASS

Worker TypeScript:
PASS
```

最终标准 Worker 测试命令为 `6 files / 19 tests PASS`。此前并行执行多个包测试时，既有 PDF 测试曾达到默认 5s timeout；显式 15s 和最终标准命令均通过，未修改测试阈值。

### 29.3 保留风险

```text
Legacy Web Artifact:
PRESENT / NOT REMOVED

Legacy Worker Artifact:
PRESENT / NOT REMOVED

HEAD Historical Direct Start Scripts:
PRESENT

Current Worktree Secure Start Scripts:
UNCOMMITTED

Production Security:
NOT VERIFIED

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```

## 28. C-6.2-L8-A Production Evidence Intake 测试

### 28.1 已执行

- Evidence Schema v2 严格字段测试；
- Host/Process/Instance cross-reference；
- Duplicate Evidence/Process/Instance ID；
- Unknown Host/Process/Artifact；
- Manifest Ed25519 独立验证；
- Trust Key fingerprint、状态和有效期；
- Release Root ACL/Atomic/Reparse；
- Runtime Account 分离；
- Storage ACL delete/ACL/owner/permission；
- Scheduler/Watchdog/Service Unknown；
- Legacy Artifact/Scheduler/Watchdog/Auto Restart；
- Queue/Job/Retry/Upload/Operation；
- Network legacy reachability；
- Evidence freshness/future/cross-host skew；
- Bundle digest tampering；
- Evidence Signer untrusted/signature invalid；
- Low trust collector；
- Double approval；
- Evidence Requirement Matrix coverage。

### 28.2 结果

```text
Web:
23 files / 146 tests PASS

Worker:
6 files / 19 tests PASS

file-storage:
2 files / 19 tests PASS

Web TypeScript:
PASS

Worker TypeScript:
PASS
```

### 28.3 生产状态

```text
Production Evidence Bundle:
NOT PROVIDED

Host/Worker/Scheduler/ACL/Queue Evidence:
UNKNOWN

Drain Readiness:
BLOCKED

Production Drain:
NOT EXECUTED

Legacy Artifact Removal:
NOT EXECUTED

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```

## 26. C-6.2-L6 Maintenance 与 Storage Capability 测试

### 26.1 本阶段已执行

- Worker Maintenance 输入不含 Storage 的 Mock 测试；
- PgBoss startup immediate 与 schedule registration 共用同一 runner 的 Mock 测试；
- Maintenance lease lost 后停止后续 DB 操作；
- Worker read-only capability 的 type/runtime 测试；
- Web upload capability、Legacy quarantine 和 capability wrapper 冻结测试；
- AST static import、literal dynamic import 和 delete call 静态扫描测试；
- Storage Inventory root junction/symlink、link 非跟随和扫描期间变化测试。

### 26.2 当前结果

```text
Web:
21 files / 122 tests PASS

Worker:
6 files / 19 tests PASS

file-storage:
2 files / 19 tests PASS

Web TypeScript:
PASS

Worker TypeScript:
PASS

Unallowlisted production physical-delete calls:
0
```

### 26.3 仍需真实环境验证

- PgBoss duplicate schedule key 行为；
- Retry、timeout、worker restart；
- 多 Worker 同时消费 Maintenance；
- 多 Worker 全局 lease 竞争；
- DB/queue backlog、worker heartbeat；
- 真实 Windows 低权限 ACL；
- Junction/Reparse Point 在目标部署盘的实测；
- 文件句柄 fencing 与 OS 删除竞态；
- 真实 Upload/Download smoke test。

### 26.4 测试边界

源码 capability 隔离通过，不代表生产 Storage 删除权限已撤销。Legacy Worker drain、服务停止、Scheduler 修改、ACL/IAM 变更和生产 Deployment 均未执行。

```text
Maintenance Delete Capability:
UNAVAILABLE

Worker Delete Capability:
UNAVAILABLE

Legacy Cleanup:
FAIL-CLOSED

Production Storage Delete Permissions:
NOT VERIFIED

Future Cleanup:
DESIGNED / NOT IMPLEMENTED

New Cleanup:
NOT ENABLED
```

## 22. C-6.2-L2 Build Artifact 静态测试

### 22.1 已实现

`apps/web/tests/p13-build-audit.test.ts` 验证：

- Legacy deletion marker 扫描；
- safe fail-closed error 不误报；
- Worker/Web/Package bundle 分类；
- cache/test artifact/archive 发现；
- 缺 Manifest、Build ID、SHA、Digest、安全版本和 capability 时拒绝；
- 未知字段不会掩盖缺失安全字段。

结果：

```text
4/4 PASS
```

### 22.2 当前仓库扫描

```text
artifactRootCount = 8
dangerousFindingCount = 49
exitCode = 1
```

危险 root：

```text
apps/web/.next
apps/worker/dist
```

该失败是预期的阻断证据。

### 22.3 未实现测试

- signed Manifest/attestation；
- startup launcher；
- Web/Worker compatibility；
- build failure no-fallback；
- artifact replacement TOCTOU；
- read-only release directory；
- Worker restart gate；
- rollback gate。

### 22.4 测试安全边界

- 不 import/require/执行旧业务 artifact；
- 不启动 Web/Worker；
- 不执行 build；
- 不删除/移动/覆盖旧产物；
- 单元测试只使用自身创建并清理的临时目录；
- 不连接数据库；
- 不读取 secret。

### 22.5 已披露副作用

Web `typecheck` 的 incremental 模式刷新了：

```text
apps/web/tsconfig.tsbuildinfo
```

该文件是非启动缓存：

```text
Length = 394709
LastWriteTime = 2026-11-18 01:50:18
SHA256 = 018C24B24976726C8837E6C70B57DA982DAE635E98C62BC721F3F63AEF7FF777
```

危险运行时产物 `apps/web/.next` 和 `apps/worker/dist` 未被修改。

### 22.6 当前门禁

```text
C-6.2-L2:
BLOCKED

Legacy Build Artifacts:
PRESENT / STARTUP-REACHABLE

Startup Gate:
NOT IMPLEMENTED

Production Artifact Status:
UNKNOWN

New Cleanup:
NOT ENABLED
```

## 23. C-6.2-L3 Build Identity 与 Gate 测试

### 23.1 已实现测试

- Source Tree Digest 稳定性和排除规则；
- 关键源码变化导致 digest 变化；
- Artifact 内容变化导致 digest 变化；
- symlink/Junction 拒绝；
- Canonical JSON；
- 重复 JSON 字段拒绝；
- Ed25519 签名和验证；
- 错误 keyId 拒绝；
- Manifest 篡改拒绝；
- 未知字段拒绝；
- unsafe cleanupCapability 拒绝；
- Release ID mismatch；
- 新增 Artifact 文件拒绝；
- Web/Worker Startup Gate；
- Worker minimal bootstrap 静态导入检查；
- Web instrumentation 业务模块隔离；
- build/start scripts 指向安全入口；
- Next build secret 配置检查。

### 23.2 测试结果

```text
Web 全量纯单元测试：
19 files / 105 tests PASS

Worker 全量纯单元测试：
5 files / 16 tests PASS

file-storage：
15 tests PASS

Web TypeScript：
PASS（--incremental false）

Worker TypeScript：
PASS（--incremental false）
```

### 23.3 隔离构建

Worker：

```text
Signed Manifest verification = PASS
Artifact files = 36
Legacy findings = 0
```

Web：

```text
NOT EXECUTED
```

### 23.4 构建失败保护

缺少 `P13_RELEASE_ID`：

```text
Web build exit = 1
Worker build exit = 1
旧 Web BUILD_ID hash = unchanged
旧 Worker file-maintenance hash = unchanged
```

### 23.5 未验证

- 生产签名密钥；
- 生产 Trust Root；
- Web production build；
- Runtime 依赖完整 Artifact Digest；
- release directory 只读 ACL；
- OS 级 TOCTOU；
- 真实部署；
- 外部 `next start` 绕过控制；
- 真实 Web/Worker 版本组合。

### 23.6 当前状态

```text
C-6.2-L3:
PASS WITH WARNINGS

Build Identity:
IMPLEMENTED

Signed Manifest:
TEST-KEY VERIFIED

Web Gate:
IMPLEMENTED / BUILD NOT EXECUTED

Worker Gate:
IMPLEMENTED / ISOLATED BUILD VERIFIED

Production Signing Key:
NOT CONFIGURED

Production Trust Root:
NOT CONFIGURED

Legacy Artifact Removal:
NOT EXECUTED

New Cleanup:
NOT ENABLED
```

## 24. C-6.2-L4 Runtime Dependency 与 Web Build 测试结果

### 24.1 已实现

- 完整 Runtime Dependency Closure；
- Manifest `runtimeDependencyDigest` / count / platform；
- 依赖文件修改、删除、新增检测；
- Native Addons 识别；
- 受信依赖 symlink/Junction 范围；
- Web isolated production build；
- Web secret probe；
- Web/Worker signed Gate 验证；
- dependency/artifact tamper detection；
- TOCTOU 连续复核。

### 24.2 自动化测试

```text
Web:
19 files / 110 tests PASS

Worker:
5 files / 16 tests PASS

file-storage:
15 tests PASS

TypeScript:
Web PASS（--incremental false）
Worker PASS（--incremental false）
```

### 24.3 Web Build

```text
artifactFiles = 1031
artifactBytes = 190175594
artifactDigest =
983c9db7c68ed596e3cd1943e36f8776729052ae956931b3a438098c581a0da8
runtimePackages = 189
legacyFindings = 0
Secret probe found = false
Manifest/Gate = PASS
```

### 24.4 Worker Build

```text
artifactFiles = 36
artifactBytes = 131855
artifactDigest =
b251ad29dec99c963acb8a445be1c7c5176af95fd17938c511424c97dd5f2f86
runtimePackages = 93
legacyFindings = 0
Manifest/Gate = PASS
```

### 24.5 未验证

- Production Trust Root/Signing Key；
- Production Release Root ACL；
- Windows 独立身份写入拒绝；
- 父目录 Reparse Point TOCTOU；
- 外部 direct next start；
- 真实部署/服务启动；
- Prisma Client clean-install generation 可复现性；
- Production Artifact Status。

### 24.6 当前状态

```text
C-6.2-L4:
PASS WITH WARNINGS

Runtime Dependency Closure:
VERIFIED IN ISOLATION

Web Production Build:
VERIFIED IN ISOLATION

Web Startup Gate:
VERIFIED IN ISOLATION

Worker Runtime Dependency:
VERIFIED IN ISOLATION

Worker Startup Gate:
VERIFIED IN ISOLATION

TOCTOU:
PARTIAL

Secret Isolation:
VERIFIED IN ISOLATED WEB BUILD

Production Release Root:
NOT VERIFIED

New Cleanup:
NOT ENABLED
```

## 25. C-6.2-L5 部署与 Storage Inventory 测试

### 25.1 新增测试

- Storage Inventory 只读临时目录测试；
- E2E 仅使用 test-only Worker entry 的静态测试；
- production Worker `index.ts` 最小 Bootstrap 检查；
- Web secure launcher/instrumentation 静态检查。

### 25.2 本机调查

```text
Project Worker/Web process:
NOT FOUND ON CURRENT HOST

Project Windows Service:
NOT FOUND

schtasks name match:
NO MATCH

Get-ScheduledTask:
CimException / PARTIAL

Docker / PM2 / K8s tools:
NOT INSTALLED

WSL:
NO DISTRO
```

### 25.3 Storage

```text
storage/private:
  staging absent
  objects absent
  temp absent

D drive available:
≈233.6 GB
```

数据库/队列 backlog 指标未实现，因为没有 DB 连接授权。

### 25.4 未执行

- Legacy Worker drain；
- Service/Scheduler 停用；
- ACL/IAM 修改；
- Trust Root 配置；
- Deployment；
- 真实 Upload/Download smoke test；
- DB queue metrics。

### 25.5 当前状态

```text
C-6.2-L5:
PASS WITH WARNINGS

Deployment Topology:
PARTIAL

Local Runtime Inventory:
PARTIAL

Production Runtime Inventory:
UNKNOWN

Legacy Drain Protocol:
COMPLETE

Legacy Drain Execution:
NOT EXECUTED

Storage Delete Permissions:
BLOCKED

Production ACL:
NOT VERIFIED

Production Trust Root:
NOT CONFIGURED

New Cleanup:
NOT ENABLED
```
