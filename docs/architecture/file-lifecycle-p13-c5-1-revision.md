# P1-3 C-5.1 设计一致性修订记录

## 文档信息

- 修订版本：`C-5.1`
- 记录日期：`2026-11-17`
- 文档状态：`POST-IMPLEMENTATION CONSISTENCY RECORD`
- 代码基线：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 原始冻结文档：`docs/architecture/file-lifecycle-p13-design-freeze.md`
- 原始冻结文档 SHA256：`E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705`
- P1-3 Migration：`20261117120000_phase37_p13_storage_lifecycle_schema`
- P1-3 Migration SHA256：`187D82A00DB73CB6F5D79C97DCD6B4FF2E01BD7E5F78BB9E1273D54D8A141479`

本文件是原始设计冻结文档的独立修订记录。它不替换、重写或删除原始文档，也不改变任何 Prisma Schema、Migration、数据库对象、Trigger、函数、角色或 ACL。

## 1. `STAGING_RESERVED -> DELETED` 的修订

### 1.1 原始设计

原始冻结文档的生命周期矩阵允许：

```text
STAGING_RESERVED -> DELETED
```

并描述为“仅在文件不存在时可 DELETED”。

### 1.2 当前实现

当前 Migration 的普通 Lifecycle 状态转换白名单不再包含：

```text
STAGING_RESERVED -> DELETED
```

当前普通转换中与 STAGING 相关的关键路径为：

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

因此，`STAGING_RESERVED` 不能通过普通状态更新直接进入 `DELETED`。

### 1.3 删除该路径的原因

数据库记录仍处于 `STAGING_RESERVED`，不能证明以下任一事实：

- Worker 尚未创建物理文件；
- Worker 已停止；
- 文件句柄已经关闭；
- 物理文件内容与数据库快照一致；
- 物理文件可以安全删除。

尝试、租约、Worker 超时、FAILED 或 ABANDONED 状态都不能替代对文件句柄关闭和文件身份的证明。

如果允许 `STAGING_RESERVED -> DELETED`，已有 Worker 可能在数据库完成状态转换后继续写入、替换或移动对象，导致误删仍被使用的文件，或掩盖无法解释的文件系统状态。

### 1.4 当前数据库保护

当前数据库通过以下机制保护 STAGING 清理：

- `p13_protect_storage_lifecycle()` 的状态转换白名单；
- `p13_assert_staging_cleanup_attestation()`；
- `p13_assert_attempt_staging_owner()`；
- `close_attestation_complete_check`；
- `close_attestation_lifecycle_snapshot_check`；
- `p13_staging_cleanup_attestation_guard`；
- Lifecycle、Attempt、FileVersion、Operation 之间的 Deferred Chain Triggers。

STAGING Lifecycle 进入以下清理状态时，必须具有完整且已经验证文件身份的 close attestation：

```text
QUARANTINING
QUARANTINED
PURGE_PENDING
DELETED
```

该 attestation 必须与当前 Lifecycle 快照一致：

```text
closedByAttemptId = reservedAttemptId
closedOwnerToken = ownerToken
closedGeneration = fencingGeneration
closedSizeBytes = sizeBytes
closedChecksumSha256 = checksumSha256
```

`closedIdentityVerified=true` 时，`closedDev` 与 `closedIno` 必须同时存在。

直接 INSERT 一个 STAGING/DELETED Lifecycle 也不能绕过上述完整性、快照一致性和上传链检查。

### 1.5 无法提供 close attestation 时

无法提供可信 close attestation 时：

- 不进入自动清理状态；
- 不根据 lease 过期、Worker timeout、Attempt FAILED 或 Attempt ABANDONED 推断文件已关闭；
- 保留对象并进入人工恢复或后续独立 Recovery 流程；
- 不自动删除、移动或覆盖文件。

### 1.6 变更分类

这是 Migration 实施和后续安全审计中的**后期安全强化**。

它不是：

- Migration 执行失败；
- Schema 回滚；
- 历史数据回填失败；
- 对原始 Migration 的事后改写。

原始冻结文档保留为历史设计基线；当前实际规则以已审核的 Prisma Schema、P1-3 Migration 和隔离 PostgreSQL 数据库结构为准。

## 2. 原始实现状态描述的替换

原始文档开头和“当前实现差距”章节曾记录：

- `NOT IMPLEMENTED`；
- P1-3 表、Enum、Migration、Trigger 和 SQL 函数尚未实现；
- 尚未执行 `prisma validate`；
- 尚未在隔离验证数据库执行 Migration。

这些描述在 C-5.1 时已经过期，但不直接改写原始冻结文档。

当前状态应通过独立文档追踪：

`docs/architecture/file-lifecycle-p13-implementation-status.md`

### 2.1 已实现

- 当前 Prisma Schema 包含 P1-3 数据模型；
- P1-3 Migration 文件已存在并通过 SHA256 校验；
- 三张 P1-3 表；
- 五个 P1-3 枚举；
- 关键外键、CHECK、唯一索引和部分唯一索引；
- 24 个 P1-3 Trigger；
- 25 个 P1-3 SQL/PLpgSQL 函数；
- `schema.prisma` 已通过 `prisma validate`。

### 2.2 已在隔离验证数据库验证

- P1-3 Migration 成功应用；
- `_prisma_migrations` 为 11/11 成功；
- P1-3 表和基础表均存在；
- 实际 PostgreSQL 结构与 Migration 和 Prisma Schema 完成静态对照；
- 字段、枚举、约束、索引、Trigger 和函数定义已核对；
- 数据库对象 Owner 为 `elevator_p13_validation_migrator`；
- Migrator 已恢复为 `NOLOGIN`，密码为空；
- Runtime 角色尚未创建；
- 基础业务表没有发生数据回填。

### 2.3 尚未完成

- Trigger 的实际 INSERT/UPDATE/DELETE/Old-New 行为测试；
- Deferred Constraint Trigger 的提交时行为测试；
- 并发、死锁、rollback 和 fencing generation 行为测试；
- Windows 文件系统和 Reparse Point 安全测试；
- hard-link、quarantine、restore 和 purge 文件操作测试；
- Runtime 角色和最小权限配置；
- PUBLIC 函数 EXECUTE 权限收敛；
- Marker 自动化验证；
- 历史数据回填执行；
- 真实业务文件生命周期集成测试。

结构存在或 Migration 成功不等于运行时协议已经通过验收。

## 3. PUBLIC EXECUTE 权限问题

C-5 审计确认：

- `public` Schema 中一共存在 32 个函数；
- 包括 7 个基础函数和 25 个 P1-3 函数；
- 所有函数 `proacl` 为 `NULL`；
- 因此 PostgreSQL 使用默认函数 ACL；
- Owner `elevator_p13_validation_migrator` 拥有 EXECUTE；
- `PUBLIC` 当前也拥有 EXECUTE。

当前风险受到以下限制：

- PUBLIC 对验证数据库没有 CONNECT；
- PUBLIC 对 `public` Schema 没有 USAGE；
- Runtime 角色尚不存在；
- 当前无法从普通调用方直接执行这些函数。

但默认 PUBLIC EXECUTE 尚未收敛，必须在阶段 D 单独处理：

- 对现有函数执行最小范围 REVOKE；
- 配置后续由 Migrator 创建函数的默认权限；
- 仅向受信角色或受控函数入口授予必要 EXECUTE；
- 保持 `SECURITY DEFINER` 禁用，除非另有独立安全设计。

本修订不执行任何 `GRANT`、`REVOKE` 或权限变更。

## 4. 权威来源与解释顺序

发生文档与实现差异时，应按以下用途解释：

1. Prisma Schema：数据模型和关系声明；
2. P1-3 Migration SQL：实际数据库结构、约束、Trigger 和函数来源；
3. 隔离 PostgreSQL 系统目录：实际部署结构证据；
4. 原始设计冻结文档：原始安全意图和历史设计；
5. 本修订记录：对过期描述和后期安全强化的补充说明；
6. 实现状态追踪文档：当前完成度、验证覆盖和未完成项。

本修订记录不授予开发数据库迁移、Runtime 启用、文件清理或生产启用权限。
