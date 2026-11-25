# P1-3 C-6.2-L6 Maintenance 全链路安全与 Storage 删除能力隔离设计

## 文档信息

- 阶段：`C-6.2-L6`
- 日期：`2026-11-18`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 设计状态：`IMPLEMENTED / FAIL-CLOSED / TESTED IN ISOLATION`
- 数据库：`NOT CONNECTED`
- 真实 Storage：`NOT ACCESSED`
- New Cleanup：`NOT ENABLED`

## 1. 目标与边界

本阶段解决三个问题：

1. 审计 Worker 启动、PgBoss 调度、Retry、Recovery 和 Requeue 的完整路径；
2. 防止普通 Web、Worker 和 Maintenance 依赖对象暴露物理删除能力；
3. 保持 Legacy Cleanup 永久 fail-closed，并设计未来 Cleanup 的独立身份和两阶段协议。

本设计不修改数据库、Migration、角色、ACL、HBA、生产 IAM、真实 Storage 或部署配置。

## 2. Worker 启动与 Job 调用链

### 2.1 生产启动链

```text
node dist/index.js
  -> runWorkerStartupGate()
  -> signed manifest / artifact / runtime dependency verification
  -> dynamic import("./worker-entry.js")
  -> startWorker()
  -> readWorkerEnv()
  -> new PrismaClient()
  -> createWorkerStorage() [read capability only]
  -> new PgBoss()
  -> boss.start()
  -> createQueue(system / file-recognition / file-maintenance)
  -> register recognition worker
  -> registerFileMaintenanceJob()
       -> boss.work(file-maintenance)
       -> boss.schedule("*/15 * * * *", key="regular-file-maintenance")
       -> immediate runFileMaintenance()
```

`apps/worker/src/index.ts` 仍是唯一生产 Bootstrap，并只通过动态 import 在 Startup Gate 后加载业务入口。`apps/worker/tests/test-worker-entry.ts` 仅供测试，不进入生产构建。

### 2.2 Job 清单

| Job / Queue | 注册位置 | 调度 | 立即执行 | 执行入口 | 数据/Storage 操作 | 最终分类 |
|---|---|---|---|---|---|---|
| `WORKER_QUEUE_NAME` | `worker-entry.ts` | 外部投递 | 否 | inline logging handler | 只记录 Job 元数据 | NON-DESTRUCTIVE |
| `file-recognition` | `worker-entry.ts` | Web/Recovery 投递 | 独立 Job 到达时 | `processFileRecognitionJob()` | DB 状态/审计 + 只读 Storage | NON-DESTRUCTIVE |
| `file-maintenance` | `registerFileMaintenanceJob()` | `*/15 * * * *` | 是 | `runFileMaintenance()` | DB recovery/requeue + queue send | DATABASE-ONLY MUTATION |

全仓库未发现其他生产 Cleanup、Scheduler、Periodic 或 Background Job 注册。

### 2.3 Maintenance 执行路径

```text
registerFileMaintenanceJob()
  -> boss.work handler ----------------------+
  -> immediate runFileMaintenance() ---------+-> runFileMaintenance()
                                                   -> acquire maintenance lease
                                                   -> recover stale PROCESSING
                                                   -> fail exhausted attempts
                                                   -> requeue QUEUED attempts
                                                   -> release lease
```

Cron Job 和启动立即执行使用同一个函数。函数输入不再包含 Storage capability，因此调用方无法通过 Maintenance 依赖注入物理删除对象。

### 2.4 Retry / Recovery / Requeue

- PgBoss Maintenance queue：`retryLimit=1`、`expireInSeconds=120`。
- Maintenance 重试仍进入 `runFileMaintenance()`，没有 Storage 参数。
- `recoverExpiredFileExtraction()` 只做带 processing token 条件的 DB 状态恢复。
- `failExhaustedUnclaimedFileExtraction()` 只做带状态/attempt 条件的 DB 失败终结。
- Requeue 只调用 `boss.send()` 或 `boss.sendAfter()`，目标为 `file-recognition`。
- Maintenance 全局 lease 丢失后立即返回 `skipped=true, leaseLost=true`，不再继续 Requeue。
- 进程重启后 PgBoss schedule 仍存在，新 Worker 再次注册同一 key；启动立即执行仍走同一非删除路径。

数据库级重复 schedule、超时、跨 Worker lease 竞态仍需真实数据库测试，当前只完成 Mock/静态验证。

## 3. Storage 能力模型

### 3.1 能力接口

`packages/file-storage/src/capabilities.ts` 定义：

```text
StorageReadCapability
  - verifyObjectChecksum()
  - readVerifiedObject()
  - openReadStream()

StorageUploadWriteCapability
  - writeToStaging()
  - finalize()

StorageRuntimeCapability
  = StorageReadCapability + StorageUploadWriteCapability

LegacyStorageCleanupCapability
  - removeStaging()
  - removeObject()
  - cleanupOrphanObjects()
  - cleanupTemp()
```

Capability factory 返回冻结对象，只暴露目标方法。普通运行时对象不含四个删除方法。

### 3.2 旧删除 API 隔离

`QuarantinedLegacyStorageCleanup` 是独立的 Legacy-only 类型：

- 不接受 Storage Root；
- 不解析 key；
- 不访问文件系统；
- 四个方法在任何参数校验前直接抛出 `LegacyStorageCleanupDisabledError`；
- 普通工厂不会返回该类型；
- 不存在通过环境变量或 Feature Flag 启用旧删除的路径。

`LocalPrivateStorage` 仅实现 `StorageRuntimeCapability`，不再包含 Legacy 删除方法。

### 3.3 运行时矩阵

| 身份 | Read | Upload Write | Physical Delete | 当前实现 |
|---|---|---|---|---|
| Web Runtime | 按业务需要 | staging/finalize | 不可获得 | runtime capability wrapper，冻结 |
| Worker Runtime | canonical 只读 | 不可获得 | 不可获得 | read-only capability wrapper，冻结 |
| Maintenance | 不需要 | 不需要 | 不可获得 | 输入不含 Storage |
| Legacy Cleanup | 不适用 | 不适用 | 仍拒绝 | quarantined fail-closed class |
| Test Runtime | 隔离目录/Mock | 隔离目录/Mock | 仅测试 teardown | test-only code path |
| Future Cleanup | 限定对象 | 默认禁止 | 独立审批 | 仅设计，未实现 |

源码能力隔离不能证明生产 NTFS/对象存储 ACL 已完成收敛。

## 4. 物理删除入口与间接路径

### 4.1 分类原则

物理删除与数据库记录删除必须分开：

- `fs.rm` / `fs.unlink`：本地文件系统删除；
- `removeStaging` / `removeObject`：Storage 对象删除；
- `cleanupOrphanObjects` / `cleanupTemp`：批量物理清理；
- Prisma `delete` / `deleteMany`：数据库记录删除；
- Cascade：数据库引用动作，不等于物理对象删除。

### 4.2 当前源码入口

| 入口 | 分类 | 当前状态 |
|---|---|---|
| `QuarantinedLegacyStorageCleanup.*` | Legacy Storage delete | FAIL-CLOSED |
| `cleanupExpiredUploadIntents()` | Legacy Web cleanup | 访问 DB/Storage 前 FAIL-CLOSED |
| `completeUpload()` 失败路径 | 物理删除恢复 | DISABLED；对象保留 |
| Maintenance expired-intent/orphan/temp | Worker cleanup | REMOVED |
| `build-secure.ts` `fs.rm` | 自身构建临时目录 | ALLOWLISTED BUILD TEMP |
| `test-db/cli.ts` `fs.rm` | guarded `storage/private-test` | ALLOWLISTED TEST ROOT |
| Test teardown `fs.rm` | `mkdtemp` 目录 | TEST ONLY |
| Static scanners 的删除正则 | marker definitions | NOT EXECUTABLE |

未发现生产 Web Route、Server Action、Prisma 业务删除或云 Storage SDK 删除入口。

### 4.3 静态扫描

新增 `apps/web/scripts/p13-storage-delete-audit/scanner.ts`：

- TypeScript AST 解析；
- static import / export graph；
- literal dynamic import graph；
- 非字面量 dynamic import 显式 unresolved；
- 物理删除 call marker；
- 显式 build/test allowlist；
- 生产未授权删除调用为 blocking finding。

扫描器只读取源码，不执行被扫描代码。

## 5. Fail-Closed 状态原则

以下情况必须保留物理对象：

- Upload 写 Staging 部分失败；
- Upload 数据库事务明确失败；
- COMMIT 结果未知；
- 通知队列失败；
- 对象已 finalize 但 DB 状态不确定；
- Worker Job 失败、超时或 Retry；
- Maintenance lease 丢失；
- Storage Adapter 超时或身份不明确；
- Lifecycle 状态未知；
- 调用方没有独立删除 capability。

只有未来 Cleanup 身份、对象资格、Lifecycle 状态、引用证明、物理对象身份和审计证据全部通过时，才允许进入物理删除。

## 6. Future Cleanup 独立身份

未来 Cleanup 必须使用独立运行时身份，不复用 Web、Worker 或 Maintenance：

```text
Cleanup Identity
  - dedicated process/task entry
  - dedicated storage delete permission
  - scoped root or object prefix
  - no canonical overwrite permission
  - no release/trust-root write permission
  - explicit approval reference
  - append-only audit evidence
```

权限撤销必须独立于普通 Worker。环境变量不能成为删除授权来源。

## 7. 删除前资格验证

未来 Cleanup 必须同时验证：

1. Lifecycle 状态允许删除；
2. canonical key 与 lifecycle 记录一致；
3. 是否存在有效 FileVersion 引用；
4. 是否存在当前下载/有效读取租约；
5. 是否存在 Upload/Finalize/Quarantine/Restore/Purge Operation；
6. 是否存在活动 lease 或过期但未 fencing 的 owner；
7. 是否存在并发引用创建；
8. COMMIT 是否确定；
9. 对象 dev/inode/size/checksum/version 是否仍匹配；
10. 是否存在对象路径复用或同名替换；
11. grace period 是否满足；
12. 审批与审计证据是否完整。

不得仅凭“数据库无引用”“Intent 过期”“文件年龄”直接删除。

## 8. 两阶段删除协议

```text
Candidate Identification
  -> Eligibility Verification
  -> Quarantine / Reservation
  -> Final Revalidation
  -> Authorized Physical Delete
  -> Audit Evidence
```

阶段 A：

- 识别候选；
- 记录 lifecycle/version/key/checksum；
- 不执行删除；
- 输出可审计候选证据。

阶段 B：

- 重新读取状态和引用；
- 获取对象级锁/Reservation；
- 验证 lease、Operation 和 generation；
- 物理删除；
- 将物理结果与 DB 状态分开记录；
- 删除成功但 DB 不确定时保持 `RECOVERY_REQUIRED`；
- 不自动重试为“成功”。

现有 Lifecycle 规则保持不变：

```text
普通 STAGING   initial = STAGING_RESERVED
普通 CANONICAL initial = FINALIZING
CANONICAL orphan / 空 STAGING DELETED = 特殊协议
```

特殊协定未实现前，相关 Cleanup 不得启用。

## 9. Test Storage 隔离

- Web/Worker 单元测试不创建真实业务对象；
- storage 单测使用 `mkdtemp` 自有目录；
- test database reset 只允许固定 `storage/private-test`；
- `resolveVerifiedTestStorageRoot()` 校验 canonical root、symlink 和 realpath；
- E2E 使用显式 test-only Worker Entry；
- 缺少测试隔离条件时 fail-closed；
- Test Worker 仍继承生产 Worker 的非删除 Maintenance 路径；
- 不允许测试为了通过而获得 Legacy delete capability。

Junction、root escape、realpath mismatch 已有隔离测试；真实低权限 Windows ACL 仍未验证。

## 10. Storage Inventory

`inventoryStorageRoot()` 保持只读：

- 不读取文件内容；
- 不删除或修改文件；
- 拒绝 symlink/junction 作为 root；
- 不跟随 area 内链接；
- 统计 file count、bytes、oldest/newest；
- 统计 symlink/Windows reparse point；
- 统计 inaccessible、vanished、changed file；
- 扫描前后比较 root identity；
- 文件 lstat 后再次核对 size/mtime/dev/inode；
- 变化时 `scanComplete=false`，不把结果当作稳定快照。

已知限制：

- 大目录为顺序扫描；
- 无法从 portable Node API 区分所有 Windows reparse tag；
- 权限拒绝会被计数但不会自动修复；
- 计数不是对象删除授权。

## 11. 监控与告警设计

### 文件指标

- staging/objects/temp：count、bytes、oldest age；
- link/inaccessible/vanished/changed；
- inventory scan completeness；
- orphan candidate count（未来只读发现）；
- file version/processing failure counts（需 DB 只读适配器）。

### 队列指标

- queue backlog；
- retry count；
- failed count；
- oldest incomplete job age；
- worker consumption rate；
- last worker consumption time。

### 告警

- free space 低于业务批准阈值；
- abnormal growth；
- staging/temp 长期积压；
- retry backlog 连续增长；
- Worker 超过两个 maintenance windows 无消费；
- Processing 长期不结束；
- inventory `scanComplete=false`。

告警只能通知和记录，不得自动触发删除。

数据库、PgBoss backlog 和 worker heartbeat 指标当前只完成设计，未连接数据库验证。

## 12. 自动化测试矩阵

| 测试 | 层级 | 当前状态 |
|---|---|---|
| Maintenance 启动与 cron 使用同一非删除 runner | Worker Mock | IMPLEMENTED |
| Maintenance 输入不含 Storage | Type/Unit | IMPLEMENTED |
| Lease lost 后停止后续工作 | Worker Mock | IMPLEMENTED |
| Worker Storage 只有 read methods | Unit | IMPLEMENTED |
| Web/Legacy storage 只有 upload methods | Unit | IMPLEMENTED |
| Capability wrapper 冻结且无 delete | Unit | IMPLEMENTED |
| Legacy delete 在任何 key resolution 前拒绝 | file-storage Unit | IMPLEMENTED |
| 失败 Upload 保留对象 | Web Mock | IMPLEMENTED |
| AST static/dynamic import delete scan | Static Unit | IMPLEMENTED |
| 未授权删除调用 blocking | Static Unit | IMPLEMENTED |
| Inventory root symlink/junction 拒绝 | Unit | IMPLEMENTED |
| Inventory 不稳定扫描检测 | Unit | IMPLEMENTED |
| PgBoss duplicate/retry/timeout/restart DB 行为 | DB Integration | NOT VERIFIED |
| 多 Worker Maintenance 并发 | DB Integration | NOT VERIFIED |
| Windows 低权限 ACL/Junction 实际权限 | OS Integration | NOT VERIFIED |
| 真实文件系统 fencing | FS Integration | NOT IMPLEMENTED |

## 13. 未解决风险

- 生产 Worker/Scheduler/Auto Restart 实例仍 `UNKNOWN`；
- 旧 Worker 仍可能绑定宽权限 Storage ACL；
- 生产 Storage 删除权限未验证或撤销；
- 真实 PgBoss schedule/retry/timeout 行为未做 DB 测试；
- Future Cleanup identity 与责任分离未审批；
- Runtime/Maintenance/Definer 角色未创建；
- PUBLIC EXECUTE 仍未收敛；
- Windows ACL、文件句柄 fencing 和真实 NTFS 竞争未验证；
- DB/queue monitoring 未实现；
- 真实 upload/download smoke test 未执行。

## 14. 门禁

```text
Maintenance Delete Capability:
UNAVAILABLE

Worker Delete Capability:
UNAVAILABLE

Legacy Cleanup:
FAIL-CLOSED

New Cleanup:
NOT ENABLED

Production Storage Delete Permissions:
NOT VERIFIED

Next Phase:
NOT AUTHORIZED
```
