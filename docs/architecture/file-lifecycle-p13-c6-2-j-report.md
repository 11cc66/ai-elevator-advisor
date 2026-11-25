# P1-3 C-6.2-J 特殊 Lifecycle 协议设计验收报告

## 文档信息

- 阶段：`C-6.2-J`
- 日期：`2026-11-18`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 结论：`PASS WITH WARNINGS`

## 1. 阶段总体结论

四类特殊协议均完成设计决策：

- FX-QN：专用 orphan 受控入口设计完成；
- FX-PP：审批、grace period、PURGE Operation 和物理删除证据设计完成；
- FX-DE：canonical Purge 路径完成；空 STAGING DELETED 明确为 `SCHEMA GAP / BLOCKED`；
- FX-FR：沿用现有 FINALIZE 失败状态机并完成故障窗口分析。

测试清理主方案确定为一次性隔离数据库/Clone；事务回滚保留为备用。

普通 A/B 保护保持不变，本轮没有创建 Migration、SQL 函数、角色或 ACL。

## 2. Git 基线

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD:   b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

工作树中的既有未提交文件全部保留。没有 Git add、commit、reset、restore、clean 或 checkout。

## 3. 修改文件清单

新增：

```text
docs/architecture/file-lifecycle-p13-c6-2-j-design.md
docs/architecture/file-lifecycle-p13-c6-2-j-report.md
```

更新：

```text
docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md
docs/architecture/file-lifecycle-p13-implementation-status.md
```

未修改：

- `prisma/schema.prisma`
- `prisma/migrations/**`
- `apps/web/scripts/p13-db-tests/**`
- `apps/web/tests/**`
- 业务代码
- 数据库对象、角色或 ACL

预期参考名 `file-lifecycle-p13-c6-2-c2-design.md` 实际不存在；仓库中的实际文件为：

```text
docs/architecture/file-lifecycle-p13-c6-2-c2-decisions.md
```

## 4. 文件 SHA-256

```text
J 设计
973BFEC858C5B7C23855293B435858976C6F56072343E3E0916D8C751724B793

数据库行为测试计划
BB2F481CD92B8B2C47D660F0F329533B24D89FA991658B9649FA9563DD02ECD0

实现状态
CEDC7442312723AF907A15282683D09E71B5DB6A92D4E053CC5B5609E88D09EB

prisma/schema.prisma
78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299

原始 P1-3 Migration
187D82A00DB73CB6F5D79C97DCD6B4FF2E01BD7E5F78BB9E1273D54D8A141479

A Migration
CA1E3B737F1CC44B3FC40911634CDBC18A41B239073BB56D53F0432B11D6BFDB

B Migration
3AC99E01D98D4C125BED5F3AC1CE2769B0B780E45F0E51B4FEECC2FB408ABB2C

Fixture Builder
EB69AD1825F926482D481EE46F08C34700B2B24B69216C02386D0EE269B5888B

Harness
2B1503B8A535E1B38D80C928C2D292F89BF3803E3D56C1A61C7B92B8B47E681B

Tooling Types
75A6B8DE2D16A5154A9D073F70DAB42260342308EAF569744AED06475AE01FD1
```

J 报告自身哈希由最终交付消息提供，避免自引用。

## 5. 当前系统事实基线

- Prisma Schema 含三张 P13 表和五个枚举；
- B Migration 已应用；
- 普通 INSERT 白名单为 `STAGING_RESERVED` / `FINALIZING`；
- A cleanup attestation 已执行且先于 B；
- 四个 Deferred Lifecycle Trigger 和 TRUNCATE Guard 存在；
- `AuditLog` 对行级 UPDATE/DELETE 为 append-only；当前没有独立 TRUNCATE Guard；
- Worker 已有全局 `file_maintenance_lease`；
- P13 应用写入链和 Recovery Scanner 为 `NOT_IMPLEMENTED`；
- 当前角色中没有 Definer/Maintenance/Recovery；
- PUBLIC EXECUTE 仍存在；
- B-DB-01、05、11、13 为 PARTIAL。

## 6. FX-QN 设计结论

orphan 定义为：

> CANONICAL `objects/` 物理对象存在，但无 Lifecycle、FileVersion、Intent.objectStorageKey 或 Attempt.canonicalStorageKey 引用。

不把任何受管异常记录自动视为 orphan。

推荐入口：

```text
elevator_lifecycle_definer
  -> SECURITY DEFINER function
  -> CANONICAL QUARANTINING
  -> QUARANTINE Operation sourceAttemptId=NULL
  -> 行级不可变 AuditLog evidence
```

并发和幂等：

- storageKey advisory xact lock；
- Lifecycle.storageKey UNIQUE；
- `one_active_storage_operation`；
- 重复 requestId 返回已有相同记录；
- 证据或所有权不一致时拒绝。

普通 Runtime 无法：

- 直接 INSERT QNING；
- SET ROLE 到 Definer；
- 执行专用函数。

状态：

```text
orphan -> QUARANTINING -> QUARANTINED -> PURGE_PENDING -> DELETED
```

## 7. FX-PP 设计结论

进入 `PURGE_PENDING` 必须满足：

- 当前状态 `QUARANTINED`；
- 当前 Operation APPLIED QUARANTINE；
- 无 FileVersion；
- `purgeAfter` 已到期；
- 有唯一审批；
- 创建 active PURGE Operation；
- owner/generation/lease 一致。

状态映射：

```text
PURGE_PENDING + PREPARED
  -> 已批准，未开始物理删除

Operation EXECUTING
  -> PHYSICAL_DELETE_IN_PROGRESS

文件删除证据
  -> PHYSICAL_DELETE_SUCCEEDED

Operation APPLIED + Lifecycle DELETED
  -> DATABASE_FINALIZATION
```

数据库 `DELETED` 不证明物理文件已删除。

创建 `PURGE_PENDING` 后，当前 Schema 没有安全取消路径；取消/回退需要独立 Recovery 设计。

## 8. FX-DE 设计结论

canonical 路径：

```text
QUARANTINED -> PURGE_PENDING -> DELETED
```

空 STAGING 直接 `DELETED`：

```text
BLOCKED / SCHEMA GAP
```

原因：

- STAGING 必须有 reserved Attempt/Intent；
- STAGING DELETED 必须有完整 identity-verified close attestation；
- closed size 必须 > 0；
- checksum 必须存在；
- 当前模型无法表达 never-created/empty staging。

当前安全处理：

- 无文件且无法证明 close：保留 `STAGING_ABANDONED`；
- 有文件且无法证明安全删除：保留或 Quarantine；
- 禁止伪造 size/checksum/attestation。

## 9. FX-FR 设计结论

路径：

```text
FINALIZING
-> FINALIZE Operation FAILED
-> Lifecycle FAILED_RETAINED
-> Attempt FINALIZING 或 RECOVERY_REQUIRED
-> 无 FileVersion
```

失败窗口已覆盖：

- 写入前失败；
- 部分写入；
- 物理完成、DB 失败；
- DB 成功、通知失败；
- Worker 崩溃/lease 过期；
- 同 Operation 重放；
- 多 Worker 并发。

关键规则：

- lease 过期不能直接推定为失败；
- terminal Operation 不得原地重开；
- terminal 失败不自动重试；
- FileVersion 只能在 Operation APPLIED + Lifecycle ACTIVE 时创建；
- COMMIT 未知时由新连接核对。

## 10. 测试清理方案对比

| 方案 | 真实 COMMIT | 保留完整保护 | 永久数据风险 | 结论 |
|---|---:|---:|---:|---|
| 事务 + SAVEPOINT + ROLLBACK | 否 | 是 | 低 | 备用 |
| 一次性 Clone | 是 | 是 | 低 | 主方案 |
| 受控 Cleanup 函数 | 可 | 可但增加旁路 | 中/高 | 不推荐共享库 |
| 独立 Schema | 可 | 难保证一致 | 中 | 不采用 |

主方案：

```text
一次性隔离数据库/Clone
```

要求：

- 唯一 `p13_test_*` 名称；
- 从同一 Migrations 建库；
- 独立测试角色；
- 真实 COMMIT 后直接销毁 Clone；
- 不放宽 DELETE/TRUNCATE。

## 11. PUBLIC EXECUTE 权限设计

当前 25 个 P13 函数：

```text
SECURITY INVOKER
proacl NULL
PUBLIC EXECUTE
```

目标：

- REVOKE PUBLIC EXECUTE；
- Owner/Migrator保留管理和测试权限；
- Trigger 函数不直接授予 Runtime；
- Runtime 只获得业务 DML 或明确业务函数；
- assert/collect/reject 函数不向 Runtime 开放；
- Trigger 在 PUBLIC EXECUTE 撤销后必须进行真实回归测试。

ACL 修改未获 J 阶段授权。

## 12. Migrator 身份设计

未来在一次性 Clone 中：

1. 临时启用 Migrator LOGIN；
2. 生成随机密码；
3. 连接只指向 Clone；
4. 确认 current_user/session_user；
5. 验证 CONNECT、Schema USAGE/CREATE；
6. 验证 Migration DDL；
7. 验证无 SUPERUSER/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS；
8. 验证不能 SET ROLE 到 Owner/Definer/Maintenance；
9. 恢复 NOLOGIN/PASSWORD NULL；
10. 确认无活动会话和密码残留。

Runtime 验证应确认：

- 只能连接指定验证库/Clone；
- 无 DDL、TRUNCATE、system_metadata/_prisma_migrations 写权限；
- 无特殊函数 EXECUTE；
- 不能进入开发库或测试库。

## 13. 统一状态机

完整 Mermaid 状态图位于设计文档第 8 节。

核心路径：

```text
STAGING_RESERVED -> STAGING -> STAGING_READY -> DELETED
STAGING_RESERVED -> STAGING -> STAGING_ABANDONED
STAGING_RESERVED -> STAGING -> STAGING_ABANDONED -> QUARANTINING

CANONICAL FINALIZING -> ACTIVE
CANONICAL FINALIZING -> QUARANTINING
CANONICAL FINALIZING -> FAILED_RETAINED

special orphan -> QUARANTINING -> QUARANTINED
QUARANTINED -> PURGE_PENDING -> DELETED

empty STAGING -> DELETED: BLOCKED / SCHEMA GAP
```

FileVersion 只在 CANONICAL ACTIVE 且 FINALIZE APPLIED 的最终事务中创建。

## 14. 测试矩阵

测试计划新增：

```text
J-QN-01 至 J-QN-12
J-PP-01 至 J-PP-10
J-DE-01 至 J-DE-04
J-FR-01 至 J-FR-08
J-PERM-01 至 J-PERM-03
J-AUD-01
J-CL-01 至 J-CL-02
```

覆盖：

- 正常路径；
- 缺 Operation；
- 错误 Attempt/Owner；
- 非法初始和转换状态；
- 并发/幂等；
- Deferred 失败；
- 物理对象存在/不存在/Hash 不符；
- 权限不足；
- Worker 崩溃；
- Clone 清理。

所有测试当前均为设计状态，未执行。

## 15. Decision Register

设计文档第 15 节包含 J-D01 至 J-D16，并逐项记录：

- 问题；
- 推荐方案；
- 备选/拒绝方案；
- 原因与安全影响；
- 数据库/代码/测试影响；
- 是否需要 Migration；
- 是否需要人工审批；
- 当前状态。

补充冻结项：

- B 普通白名单不变；
- 特殊创建只接受 Definer 函数上下文；
- QNING orphan 的 sourceAttemptId 为 NULL；
- PP 必须审批、到期和 PURGE Operation；
- 物理删除与 DELETED 数据库终态分开；
- 真实 COMMIT 测试用 Clone；
- PUBLIC EXECUTE 应撤销；
- Migrator 在 Clone 中独立验证。

## 16. Schema Gap

```text
SG-01 强类型 orphan evidence
SG-02 强类型 purge approval
SG-03 独立 physical-delete phase
SG-04 never-created STAGING
SG-05 Definer/Maintenance/Recovery 角色
SG-06 AuditLog TRUNCATE Guard
```

空 STAGING DELETED 是明确阻断项。

## 17. Implementation Blocker

### IB-01

现有 Worker Maintenance 直接：

```text
cleanupOrphanObjects()
```

删除未被 FileVersion/Intent 引用的对象，不经过 P13 Lifecycle。

### IB-02

现有过期 Intent 清理直接删除 staging/object，再更新 Intent，没有 P13 Operation/Attestation。

### IB-03

没有 empty/never-created STAGING 的数据模型。

在 IB-01 和 IB-02 修复前，不得启用 QNING/Purge 特殊协议。

## 18. 独立自审结果

| 检查项 | 结论 |
|---|---|
| FX-QN 是否绕过 B | 否；仅 definer 函数入口 |
| FX-DE 是否绕过 A | 否；拒绝空 STAGING direct DE |
| FX-PP 是否可无审批进入 | 否；需审批和 PURGE Operation |
| FX-FR 是否可能误激活 FileVersion | 否；ACTIVE+APPLIED 双条件 |
| 物理删除与 DB 状态是否混淆 | 否；显式分离 |
| 清理方案是否产生永久数据 | 主方案使用临时 Clone |
| 测试角色是否可能进入生产 | 设计要求限制连接目标 |
| PUBLIC EXECUTE 是否扩大 | 设计为收紧 |
| Migrator 是否获得 Runtime 权限 | 设计要求最小化 |
| Operation/Attempt 所有权漏洞 | 由 currentOperation、generation/lease、唯一索引约束 |
| 并发竞态 | advisory/row lock + partial unique index |
| 幂等设计 | storageKey + requestId + active operation |
| Deferred Constraint | 继续作为 COMMIT 最终边界 |
| 无法恢复的故障窗口 | 保持 UNKNOWN/FAILED_RETAINED |
| 特殊状态审计 | 行级不可变 AuditLog 要求；TRUNCATE 风险列为 Gap |

## 19. 是否满足后续实施条件

已满足：

- 四类协议有设计决策；
- 普通 A/B 不变；
- 清理方案完成比较；
- 权限角色方向完成；
- 测试矩阵完成；
- Decision Register 完成；
- 文档已更新；
- 无越权执行。

仍需人工决策：

- purge grace period；
- approver 角色和审批窗口；
- orphan evidence 是否升级为专用表；
- PP 后取消/恢复是否需要；
- 空 STAGING never-created 的 C 方案。

## 20. 下一阶段建议

1. 项目负责人审核 Decision Register。
2. 先修复现有 Maintenance 的物理清理旁路。
3. 单独设计 Definer/Maintenance/Runtime ACL。
4. 在一次性 Clone 中验证真实 COMMIT、权限和并发。
5. 设计强类型 orphan/purge evidence 表。
6. 对空 STAGING never-created 单独进行 C 级设计。
7. 特殊协议功能在本设计审核前保持未实现。

## 最终状态

```text
C-6.2-J:
PASS WITH WARNINGS

Database:
NOT CONNECTED

SQL:
NOT EXECUTED

Database Writes:
NOT EXECUTED

Prisma Schema:
NOT MODIFIED

Migration:
NOT MODIFIED

Business Code:
NOT MODIFIED

Fixture Builder:
NOT MODIFIED

Harness:
NOT MODIFIED

ACL:
NOT MODIFIED

Roles:
NOT MODIFIED

Git Commit:
NOT CREATED

Git Cleanup:
NOT EXECUTED

Next Phase:
NOT AUTHORIZED
```
