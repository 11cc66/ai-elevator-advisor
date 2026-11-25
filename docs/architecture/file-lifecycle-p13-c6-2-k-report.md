# P1-3 C-6.2-K Storage Cleanup 全链路审计与设计报告

## 文档信息

- 阶段：`C-6.2-K`
- 日期：`2026-11-18`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 设计文档：`docs/architecture/file-lifecycle-p13-c6-2-k-design.md`
- 结论：`PASS WITH WARNINGS`

本报告只记录本轮只读审计和授权文档编写结果。`PASS WITH WARNINGS` 表示设计交付完整，不表示旧 Cleanup 路径安全、P13 业务链已经接入或可以进入实施。

## 1. Git 基线

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD:   b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

本轮开始前工作树已有的未提交内容全部保留，包括：

```text
M  apps/web/next-env.d.ts
M  prisma/schema.prisma
?? apps/web/scripts/p13-db-tests/
?? apps/web/tests/p13-a-migration.test.ts
?? apps/web/tests/p13-b-migration.test.ts
?? apps/web/tests/p13-db-tooling.test.ts
?? docs/architecture/
?? prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/
?? prisma/migrations/20261117130000_phase37_p13_lifecycle_insert_guard/
?? prisma/migrations/20261117140000_phase37_p13_lifecycle_initial_state_guard/
```

未执行 Git add、commit、reset、restore、clean 或 checkout。

## 2. 修改文件清单

新增：

```text
docs/architecture/file-lifecycle-p13-c6-2-k-design.md
docs/architecture/file-lifecycle-p13-c6-2-k-report.md
```

更新：

```text
docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md
docs/architecture/file-lifecycle-p13-implementation-status.md
```

未修改：

- Prisma Schema；
- 任何 Migration；
- Upload API / Web service；
- Worker；
- Storage Adapter；
- Fixture Builder；
- Harness；
- 现有测试；
- 环境文件；
- 数据库角色或 ACL。

## 3. 文件哈希

### 3.1 本轮授权文档

```text
K 设计
040A5DEFB677A0C8C1C63E136489988A2A0563ED4963D726CD4D9D9AF4A2FB15

数据库行为测试计划
4D23672788DBF38CA6B9AA5552726EA65FC8C5A3F015272B615A00F05C164816

实现状态
0928D90763177EA8EA541D11D2AB1702F2515A455A6BDA10043648762BE15212
```

K 报告不能稳定嵌入自身完整 SHA-256，否则写入哈希会再次改变文件。最终报告正文之外提供外部计算值。

### 3.2 受保护文件

```text
原始设计冻结
E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705

C-5.1 修订
5F9B7A75C2B9C745152515A2353FA3AE41F6E9538687AAE0A26861BD5A593326

J 特殊协议设计
973BFEC858C5B7C23855293B435858976C6F56072343E3E0916D8C751724B793

J 特殊协议报告
FAACE609EEE13641A37CA37812C20DA0DAD6371A3867E3EE79803AA7C940E975

prisma/schema.prisma
78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299

原始 P1-3 Migration
187D82A00DB73CB6F5D79C97DCD6B4FF2E01BD7E5F78BB9E1273D54D8A141479

A Migration
CA1E3B737F1CC44B3FC40911634CDBC18A41B239073BB56D53F0432B11D6BFDB

B Migration
3AC99E01D98D4C125BED5F3AC1CE2769B0B780E45F0E51B4FEECC2FB408ABB2C

apps/web/next-env.d.ts
0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC

Fixture Builder
EB69AD1825F926482D481EE46F08C34700B2B24B69216C02386D0EE269B5888B

Harness
2B1503B8A535E1B38D80C928C2D292F89BF3803E3D56C1A61C7B92B8B47E681B

Tooling Types
75A6B8DE2D16A5154A9D073F70DAB42260342308EAF569744AED06475AE01FD1
```

上述受保护文件在本文档工作前后均未改变。

## 4. Storage Cleanup 全量入口清单

详细代码定位和风险说明见 K 设计第 3 节。摘要如下。

### 4.1 生产物理删除入口

| ID | 入口 | 删除对象 | 当前保护 | 结论 |
|---|---|---|---|---|
| D-K-01 | Web `cleanupExpiredUploadIntents()` | staging/object | 无 P13 Operation/object lease | P1 BLOCKER |
| D-K-02 | Web `completeUpload()` catch | object/staging | 任意异常后直接删除 | P1 BLOCKER |
| D-K-03 | Worker expired Intent block | staging/object | 全局 maintenance lease | P1 BLOCKER |
| D-K-04 | Worker orphan block | `objects/` | 扫描时引用快照 | P1 BLOCKER |
| D-K-05 | `cleanupOrphanObjects()` | top-level object | mtime + 引用集合 | P1 BLOCKER |
| D-K-06 | `cleanupTemp()` | `temp/` | mtime + lease 回调 | 未纳入 P13 |
| D-K-07 | `removeStaging()` | root 内 key | 字符串路径检查 | capability 过宽 |
| D-K-08 | `removeObject()` | root 内 key | 字符串路径检查 | capability 过宽 |

### 4.2 测试/工具删除入口

- `apps/web/scripts/test-db/cli.ts` reset 测试根、测试 DB 和 pgboss schema；
- `packages/file-storage/tests/local-private-storage.test.ts` 删除 mkdtemp 根；
- `apps/web/tests/integration/phase33-file-access.test.ts` 模拟对象缺失；
- 测试 reset 有专用身份/marker guard，不属于生产 Cleanup。

### 4.3 数据库记录删除

未在生产 `apps/`、`packages/` 中发现 File、FileVersion、Intent、Attempt、Lifecycle 或 Operation 的 Prisma delete 路由。

已存在数据库保护：

- Intent/Attempt/Lifecycle/Operation DELETE Trigger；
- FileVersion DELETE Trigger；
- 五张 P1-3 链表的 TRUNCATE Trigger；
- `AuditLog` UPDATE/DELETE Trigger。

仍存在的数据库缺口：

- `AuditLog` 无 TRUNCATE Trigger；
- `File` 元数据没有统一软删除/归档协议；
- Runtime ACL 尚未创建和验证；
- `AuditLog.actorUserId ON DELETE SET NULL` 与 Row Trigger 的交互未验证。

### 4.4 状态写入接入

生产 Upload/Worker/Download/Cleanup 代码没有命中 P13 lifecycle/operation/attempt 标识。生产路径仍使用 legacy `FileUploadIntent` 和直接 storage adapter 操作。

```text
P13 production integration = NOT IMPLEMENTED
```

## 5. IB-01 Orphan Cleanup 深度审查

### 5.1 当前调用链

```text
PgBoss cron every 15 minutes
  -> runFileMaintenance()
  -> global file_maintenance_lease
  -> read FileVersion keys + non-EXPIRED Intent.objectStorageKey
  -> cleanupOrphanObjects()
  -> fs.stat + mtime
  -> fs.rm
```

### 5.2 主要发现

1. 引用查询和删除不在同一事务或同一受锁协议中；
2. 未查询 P13 Lifecycle/Operation/Quarantine；
3. 正在 FINALIZING、RESTORING 或其他 managed in-progress 的对象不在引用快照时可能被当成 orphan；
4. 无 per-storageKey claim/lease/generation；
5. 无数据库二次确认；
6. 无 size/hash/dev/ino/reparse identity 校验；
7. 无逐对象 AuditLog/evidence；
8. `beforeDelete()` 的 lease 检查与 `fs.rm()` 之间存在窗口；
9. 全局 lease 不能 fencing 已进入操作系统的旧 Worker；
10. 现有测试只覆盖“旧 orphan 被删除”和 Maintenance lease，不覆盖上述竞态。

### 5.3 设计结论

Orphan 判定必须有：

```text
storageKey advisory lock
-> re-read all references
-> create Cleanup Case/Operation claim
-> physical quarantine
-> evidence
-> DB finalization
```

所有可能创建相同 key 引用的业务写入必须取得同一把锁。没有该协作协议时，“先查后删”不安全。

## 6. IB-02 Expired Intent Cleanup 深度审查

### 6.1 当前事实

- Intent TTL 为 30 分钟；
- Web 在每次创建 Intent 时清理过期 Intent；
- Worker 每 15 分钟及启动时清理；
- 两条路径都直接删除 staging/object；
- Web 路径吞掉物理删除错误，仍尝试更新 Intent；
- Worker 路径在物理删除后更新 Intent 并写一条终态 AuditLog；
- 生产 Intent 不创建 Attempt/Lifecycle/Operation；
- `UPLOADING` 是否 stale 只依据 `claimedAt`，没有 heartbeat/对象 lease；
- 删除前没有确认 writer 已停止或文件句柄关闭。

### 6.2 新状态机原则

```text
Intent expiry
  -> Discovery
  -> Classification
  -> Attempt/Lifecycle/Operation verification
  -> Cleanup Case claim
  -> physical evidence
  -> Intent terminal + Case finalization
```

以下条件均不能单独授权删除：

- `expiresAt < now()`；
- Intent 为 `FAILED`；
- Attempt 为 `ABANDONED`；
- global maintenance lease 存在；
- Worker timeout；
- 文件不存在一次。

## 7. IB-03 Never-created / Empty STAGING 设计

当前 Schema 能表达 `sizeBytes=NULL`，但不能区分：

```text
从未创建
创建已开始但结果未知
已创建空文件
写入部分内容
已完整关闭
未检查
已验证不存在
```

推荐方案：

1. `FileUploadAttempt` 增加强类型 physical write state；
2. 新增 append-only write evidence，记录 phase、owner/generation、size/hash/identity/absence；
3. 在 `fs.open()` 前记录创建意图；
4. 只在 close、size/hash/identity 完整后进入 STAGING_READY；
5. never-created/empty 不得伪造现有 close attestation 或 `closedSizeBytes > 0`；
6. 当前安全终态优先保持 `STAGING_ABANDONED + absence evidence`，不自动 `DELETED`。

备用方案是扩展 Lifecycle 的 physical presence 字段，但不能替代 append-only evidence。

## 8. 统一 Storage Cleanup 架构

推荐唯一执行链：

```text
Discovery
  -> Classification
  -> Eligibility Verification
  -> Cleanup Operation/Case Creation
  -> Claim / Lease
  -> Physical Cleanup
  -> Evidence Collection
  -> Database Finalization
  -> Reconciliation
```

### 8.1 数据库与物理事实分离

物理 phase：

```text
DELETE_NOT_STARTED
DELETE_IN_PROGRESS
DELETE_SUCCEEDED
DELETE_FAILED
DELETE_UNKNOWN
```

数据库 `DELETED` 必须在物理 evidence 之后 finalization，不能作为删除动作的起点。

### 8.2 能力边界

- Web Runtime：无物理删除 capability；
- Upload Writer：只写随机 staging；
- Maintenance Worker：唯一物理 Cleanup 执行者；
- Definer：NOLOGIN、受控特殊转换；
- Recovery：只处理受控 Recovery，不直接修文件；
- Storage Adapter：按 upload/read/maintenance capability 拆分。

### 8.3 对象级协调

- 所有 writer 和 cleaner 共用规范化 `storageKey` advisory transaction lock；
- claim 内 re-read 全部引用；
- row lock 顺序固定；
- ownerToken + fencingGeneration + lease CAS；
- terminal Operation 不复用；
- Case idempotency key 唯一；
- 旧 Worker 的 DB 更新由 CAS 阻断，但其已发出的 OS 副作用必须通过进程排空/撤权/Reconcile 处理。

## 9. Worker 七阶段双轨迁移

| Phase | 旧删除 | 新删除 | 目标 |
|---|---:|---:|---|
| 0 Containment | OFF | OFF | 立即停止自动物理删除风险 |
| 1 Discovery Only | OFF | OFF | 建立 inventory |
| 2 Shadow Classification | OFF（可 shadow） | OFF | 对比分类，不删除 |
| 3 Legacy Cleanup Freeze | OFF | OFF | 冻结新 legacy cleanup eligibility/operation |
| 4 P13 Cleanup Enabled | OFF | ON | 受控 canary/正式新链 |
| 5 Legacy Path Disable | OFF | ON | 移除旧删除调用 |
| 6 Reconciliation | OFF | 受控 ON | 处理历史/未知/不一致 |
| 7 Old Code Removal | 删除代码 | ON | 完成下线 |

关键门禁：

- 新旧版本不在不同实例上同时拥有实际删除权限；
- Shadow 不删除；
- 回滚只能减少删除，不能重新打开旧删除；
- 旧 Worker 必须 drain、撤权、轮换 secret；
- 任何 generation 设计都不能声称可以终止旧进程已执行的 OS 操作。

## 10. AuditLog 安全设计

### 当前

- UPDATE Trigger：有；
- DELETE Trigger：有；
- TRUNCATE Trigger：无；
- Row-level immutable：部分成立；
- Table-level immutable：未成立；
- actor FK：`ON DELETE SET NULL`，实际交互 `NOT_VERIFIED`。

### 推荐

- 保留 UPDATE/DELETE Guard；
- 增加 TRUNCATE/CASCADE Guard；
- Runtime/Maintenance 无 TRUNCATE、DDL、Owner；
- 用户使用停用/软删除，不物理删除；
- actor 使用 RESTRICT 或不可变快照；
- 历史备份/外部只读 WORM 归档；
- Owner/Migrator 维护需独立审批与审计；
- 分区后每个分区和父表都需相应保护。

数据库 Trigger 不能对表 Owner/Superuser 提供绝对 WORM 保证；需要外部审计存储补强。

## 11. 威胁模型

K 设计第 12 节记录了 T-K-01 至 T-K-20，覆盖：

- Runtime 伪造 Operation/Attestation；
- Worker 越权/旧 lease；
- Operation 重放；
- Storage Key 篡改；
- 跨 scope；
- 正常 FileVersion 删除；
- 并发新引用；
- 伪造 orphan/purge approval；
- Intent 误清理；
- 物理/DB 两侧不一致；
- AuditLog TRUNCATE；
- Maintenance 被攻陷；
- Definer search_path；
- Migrator 权限泄漏；
- Worker 崩溃；
- 对象存储不可用。

每项均给出攻击路径、影响、现有保护、缺口、缓解和测试 ID。

## 12. 测试矩阵

K 设计第 13 节定义：

```text
K-ORPH-01 至 K-ORPH-10
K-INT-01 至 K-INT-10
K-PHYS-01 至 K-PHYS-10
K-REC-01 至 K-REC-08
K-AUD-01 至 K-AUD-06
K-SEC-01 至 K-SEC-07
K-CL-01 至 K-CL-04
```

测试层级分别标记：

```text
STATIC / UNIT / INTEGRATION / DATABASE / REAL COMMIT /
FAILURE INJECTION / SECURITY / FS
```

测试计划文档已同步新增 K 扩展。所有 K 测试当前为 `DESIGN ONLY`，未执行。

## 13. Schema Gap Register

K 设计第 14 节记录 SG-K-01 至 SG-K-16，重点包括：

| 优先级 | Gap |
|---|---|
| P1 | Cleanup Case/Evidence |
| P1 | Physical delete phase |
| P1 | Never-created/write phase |
| P1 | Per-storageKey coordination lock |
| P1 | Operation idempotency |
| P1 | Intent cleanup Case |
| P1 | Maintenance/Definer/Recovery 角色 |
| P1 | AuditLog TRUNCATE |
| P1 | Adapter capability 拆分 |
| P1 | Managed/legacy 全量对账 |
| P2 | Audit actor FK 不可变性 |
| P2 | File metadata archive |

## 14. Decision Register

K 设计第 15 节记录 K-D01 至 K-D18，使用：

```text
FROZEN
RECOMMENDED
PROPOSED
NEEDS DECISION
```

已继承并保持 J 冻结方向：

- special protocol 只能经受控 Definer；
- 物理 evidence 完成前，数据库不得前移到 `DELETED`；
- lease/generation 不能 fencing OS；
- 测试使用一次性 Clone。

本轮新增内容没有被描述为项目负责人已经批准；Policy、grace、approver、Schema 形态仍为待决策。

## 15. 实施路线图

推荐顺序：

1. Legacy Cleanup Containment；
2. 上传链兼容修复设计；
3. Storage Adapter capability 拆分；
4. Cleanup Case/Evidence Schema 冻结；
5. Runtime/Maintenance/Definer/Recovery 角色；
6. Upload/P13 接入；
7. Orphan/Intent Cleanup 接入；
8. AuditLog 完整化；
9. 七阶段 Worker 切换；
10. 历史对账；
11. 文件系统/Runtime 真实验收；
12. 旧代码移除。

每项的前置、代码/DB 范围、回滚和验收要求见 K 设计第 16 节。旧 Cleanup 风险控制必须先于特殊协议启用。

## 16. 独立自审结果

已完成反向审计，覆盖 20 个问题：

- 未发现额外生产 API delete 路由；
- 发现 Web 请求内 cleanup 和 upload catch 删除；
- 发现 Worker 与 Web 双重清理；
- 发现 Intent 续期/active writer 与 stale 判定的风险；
- 发现 managed P13 状态未被旧 scanner 引用；
- 发现 adapter destructive methods 未做 identity/reparse 校验；
- 发现 Temp 递归删除风险；
- 发现 AuditLog 无 TRUNCATE Guard；
- 发现 P13 业务链未接入；
- 发现上传 Schema 兼容断裂。

未能通过代码彻底排除的风险：

- 项目外部运维脚本或人工删除；
- 旧 Worker 在 lease 丢失后的 OS 调用；
- Windows Reparse Point/NTFS 身份行为；
- 真实 PostgreSQL COMMIT unknown；
- AuditLog actor FK 与 Trigger 的真实交互；
- Runtime/Definer 权限。

这些均保持 `NOT_VERIFIED`，没有伪造通过结论。

## 17. 未解决问题

### P0/P1

1. 旧 Web/Worker cleanup 仍可执行物理删除；
2. orphan 查询与删除竞态；
3. expired Intent 清理无 active writer 证明；
4. P13 生产上传链未接入；
5. never-created/empty/partial 无模型；
6. no Cleanup Case/Evidence/key lock；
7. Runtime/Maintenance/Definer/Recovery 未创建；
8. AuditLog TRUNCATE 未防；
9. 物理删除路径身份保护不足；
10. 无真实 clone/commit/并发/fault-injection 验收。

### 需要项目负责人确认

- orphan evidence 是否使用独立强类型表；
- purge approval、grace 和保留期；
- never-created 元数据的最终归档状态；
- 是否增加统一 `CLEANUP` Operation 类型；
- AuditLog 外部只读归档；
- 旧代码停用窗口和部署权限。

## 18. 下一阶段建议

下一阶段不应直接“启用 Cleanup”。建议先获得独立授权完成：

1. Legacy Cleanup containment，停用自动物理删除；
2. 冻结 Cleanup Case/Evidence/Write Phase Schema；
3. 修复上传链与 P13 Schema 的兼容性；
4. 拆分 Storage Adapter destructive capability；
5. 创建最小权限角色并完成 AuditLog/TRUNCATE 设计；
6. 建立一次性 Clone 测试环境；
7. 执行 K-ORPH/K-INT/K-PHYS/K-REC/K-AUD/K-SEC 测试；
8. 再按七阶段迁移启用单一 delete owner。

## 最终状态

```text
C-6.2-K:
PASS WITH WARNINGS

Storage Cleanup implementation:
NOT SAFE FOR ENABLEMENT

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

Worker:
NOT MODIFIED

Storage Adapter:
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
