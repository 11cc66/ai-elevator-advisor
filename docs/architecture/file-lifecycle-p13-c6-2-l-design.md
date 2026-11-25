# P1-3 C-6.2-L Legacy Cleanup 紧急止损设计

## 文档信息

- 阶段：`C-6.2-L`
- 日期：`2026-11-18`
- 代码基线：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- 状态：`IMPLEMENTED / FAIL-CLOSED`
- 新 Cleanup：`NOT ENABLED`

本文记录旧 Storage Cleanup 的紧急止损设计。止损不代替 P13 Cleanup Case、Write Evidence、对象级锁、Operation 或 Reconciliation。

## 1. 目标与边界

### 1.1 目标

在 P13 新 Cleanup 架构尚未实现时，阻止以下路径继续删除业务物理文件：

- Web 普通请求触发的过期 Intent 清理；
- Upload 异常处理中的 Canonical/Staging 删除；
- Worker 过期 Intent 清理；
- Worker Orphan 扫描删除；
- Worker Temp 递归删除；
- 通过 Storage Adapter 公共删除方法执行的其他旧调用。

### 1.2 非目标

- 不实现 P13 Cleanup；
- 不创建 Cleanup Case/Evidence；
- 不接入 Attempt、Lifecycle、Operation；
- 不连接数据库；
- 不修改 Schema、Migration、角色或 ACL；
- 不删除或迁移现有历史对象；
- 不实现 Reconciliation；
- 不恢复旧清理能力。

## 2. 原始危险入口

| Entry ID | 文件 / 函数 | Caller / Trigger | 对象类型 | 原行为 | 原风险 |
|---|---|---|---|---|---|
| L-DEL-01 | `apps/web/src/modules/files/upload-service.ts` `cleanupExpiredUploadIntents()` | `createUploadIntent()`，HTTP 请求 | STAGING + CANONICAL | 先删除物理文件，再尝试更新 Intent | 请求内删除、并发写入、无 P13 proof |
| L-DEL-02 | `upload-service.ts` `completeUpload()` catch | Upload HTTP 请求 | CANONICAL + STAGING | 任意异常后删除 object/staging | COMMIT 未知或实际成功时误删 |
| L-DEL-03 | `apps/worker/src/file-maintenance.ts` expired Intent block | Maintenance Cron/Queue/启动 | STAGING + CANONICAL | 删除后更新 Intent/AuditLog | 全局 lease 不是对象 lease；存在旧 Worker FS 窗口 |
| L-DEL-04 | `file-maintenance.ts` orphan block | Maintenance Cron/Queue/启动 | CANONICAL | 查询引用后直接调用 orphan cleanup | 查询后新增引用可被误删 |
| L-DEL-05 | `packages/file-storage/src/local-private-storage.ts` `cleanupOrphanObjects()` | 旧 Worker/direct callers | CANONICAL | 按 mtime 和引用快照 `fs.rm()` | 无数据库二次证明 |
| L-DEL-06 | `local-private-storage.ts` `cleanupTemp()` | 旧 Worker/direct callers | UNKNOWN temp entry | 递归 `fs.rm()` | 未区分普通文件、目录和 Reparse Point |
| L-DEL-07 | `local-private-storage.ts` `removeStaging()` | 旧 Web/Worker/direct callers | STAGING | 直接 `fs.rm()` | 任意 root 内 staging key |
| L-DEL-08 | `local-private-storage.ts` `removeObject()` | 旧 Web/Worker/direct callers | CANONICAL | 直接 `fs.rm()` | 任意 root 内 object key |
| L-DEL-09 | `local-private-storage.ts` `writeToStaging()` catch | 写入异常 | 本次创建的部分 STAGING | 直接 `fs.rm(filePath)` | 失败准备阶段产生额外删除副作用 |
| L-DEL-10 | `apps/web/scripts/test-db/cli.ts` reset | 测试命令 | 仅验证测试 root | reset 测试目录 | 测试专用，不属于业务 Cleanup |
| L-DEL-11 | `packages/file-storage/tests/local-private-storage.test.ts` teardown | 单元测试 | mkdtemp 测试 root | 清理自身临时根目录 | 测试专用 |
| L-DEL-12 | `apps/web/tests/integration/phase33-file-access.test.ts` | 集成测试 | 测试 object | 模拟对象丢失 | 测试专用；本轮未运行 |

## 3. Web Legacy Cleanup 止损

### 3.1 原调用链

```text
POST Upload Intent
  -> createUploadIntent()
  -> cleanupExpiredUploadIntents(storage)
  -> query expired PENDING/FAILED/UPLOADING
  -> storage.removeStaging()
  -> storage.removeObject()
  -> update Intent EXPIRED
```

### 3.2 新行为

```text
POST Upload Intent
  -> createUploadIntent()
  -> no cleanup invocation
```

导出的 `cleanupExpiredUploadIntents()` 保留为显式拒绝入口：

```text
throw LegacyStorageCleanupDisabledError
```

该函数在抛出前不查询数据库、不读取 Storage、不更新 Intent、不记录伪造清理成功日志。

### 3.3 原因

- Web Runtime 不应拥有业务物理对象删除能力；
- Intent 过期不等于 writer 已停止；
- 过期时间不等于文件已关闭；
- 上传路径没有对象级 lease/generation；
- 请求内清理与 Upload/Complete 可并发；
- 物理删除与 Intent 更新不是原子事务。

### 3.4 保留的功能

- 创建 Upload Intent；
- 幂等检查；
- 上传 claim；
- 正常写入和 finalize；
- 失败时 Intent 标记；
- 未经改变的下载逻辑。

未提供可由配置重新开启的旧删除开关。

## 4. Worker Legacy Cleanup 止损

### 4.1 保留

`runFileMaintenance()` 继续执行与文件物理删除无关的维护：

- stale processing recovery；
- queued extraction requeue；
- exhausted attempt 状态终结；
- Maintenance global lease。

### 4.2 移除

`runFileMaintenanceUnlocked()` 不再：

- 查询过期 Intent 以执行物理清理；
- 更新过期 Intent 为 `EXPIRED`；
- 调用 `removeStaging()`；
- 调用 `removeObject()`；
- 查询 FileVersion/Intent 引用后执行 orphan delete；
- 调用 `cleanupOrphanObjects()`；
- 调用 `cleanupTemp()`。

### 4.3 调度入口

Worker 存在两个 Maintenance 触发点：

1. PgBoss `FILE_MAINTENANCE_QUEUE` 每 15 分钟；
2. Worker 启动时立即执行一次。

两者都调用同一个已止损的 `runFileMaintenance()`。Queue retry 同样不会进入任何 Storage 删除方法。

### 4.4 结果字段

为保持现有调用方兼容，返回结构保留：

```text
expiredIntents = 0
removedOrphanObjects = 0
removedTempEntries = 0
cleanupFailures = 0
```

这些零值不表示“没有候选对象”，只表示旧 Cleanup 已禁用。

## 5. Upload 异常和 COMMIT Unknown 保护

### 5.1 新规则

```text
上传处理异常
-> 不删除 STAGING
-> 不删除 CANONICAL
-> 尽力把可确认的 Intent 标记为 FAILED
-> 保留物理对象和错误上下文
-> 等待后续 Reconciliation / Recovery
```

### 5.2 覆盖场景

- `writeToStaging()` 明确失败；
- 文件类型/大小检查失败；
- `finalize()` 成功但数据库事务失败；
- COMMIT 明确失败；
- COMMIT 返回异常；
- COMMIT 已发送但连接中断、结果未知；
- COMMIT 明确成功但队列通知失败；
- 事务提交后客户端收到错误。

由于本阶段不实现事务结果分类器，最安全的统一规则是：

> 任何无法证明“数据库没有引用该对象”的异常，都保留物理对象。

### 5.3 失败日志

失败路径记录：

```text
event = file.upload_failed_artifacts_retained
canonicalObjectFinalized = true|false
recoveryRequired = true
```

记录不含 storageKey、绝对路径、密码或连接串。

### 5.4 不清除 Staging

`writeToStaging()` 失败时也保留本次部分 staging 文件，供后续受控 Recovery 核验。该残留不再由旧 Adapter path-delete 自行清理。

## 6. Storage Adapter 权限收敛

### 6.1 显式拒绝的方法

以下方法保留签名以兼容现有调用方，但立即抛 `LegacyStorageCleanupDisabledError`：

```text
removeStaging()
removeObject()
cleanupOrphanObjects()
cleanupTemp()
```

拒绝发生在 key resolution 和文件系统访问之前。

### 6.2 允许的操作

本阶段仍允许：

- `writeToStaging()`；
- `finalize()`；
- `verifyObjectChecksum()`；
- `readVerifiedObject()`；
- `openReadStream()`。

这些操作不是业务对象清理能力。

### 6.3 测试临时目录

仅以下测试代码仍可删除文件：

- 测试自身 `mkdtemp()` 根目录的 teardown；
- `test-db` reset 对受严格身份校验的 `storage/private-test` root 的清理；
- 现有集成测试对测试 Storage Root 中模拟对象的操作。

本轮未执行这些测试删除路径中的任何真实业务对象删除。

## 7. Feature Flag 决策

本阶段不引入可重新启用旧删除的 Feature Flag。

理由：

- 默认关闭的开关仍可能因误配置重新开放危险能力；
- 本阶段目标是永久收敛旧入口，而不是运营开关；
- 新 Cleanup 尚未实现，不存在需要继续运行旧删除的合法业务；
- 物理删除能力应只通过未来受控 P13 Maintenance capability 重新引入。

代码中不存在：

```text
LEGACY_CLEANUP_ENABLED
ALLOW_LEGACY_DELETE
```

或任何等价的“缺失即启用”配置。

## 8. 测试设计

### 8.1 Web

- 过期 Intent 清理函数显式拒绝；
- 清理函数不调用 storage 删除方法；
- 创建 Intent 不再调用 `findMany` cleanup；
- Commit 明确失败时保留 Canonical；
- Commit 未知时保留 Canonical；
- Commit 成功但通知失败时保留 Canonical；
- 正常 Complete Upload 成功路径仍工作。

### 8.2 Worker

- common `runFileMaintenance()` 不调用任何 storage delete；
- Queue、启动和 retry 都经过共同函数；
- Worker 源码不再引用 orphan/temp/staging/object delete 调用；
- 结果中的旧清理计数为 0。

### 8.3 Storage Adapter

- 四个旧删除方法均拒绝；
- 拒绝前不解析危险 key；
- staging/object 在拒绝后仍存在；
- 失败的超大 staging 写入保留文件；
- 其他读取、finalize、hash 测试继续通过。

### 8.4 数据库与文件边界

- 单元测试使用 Mock；
- file-storage 测试只使用测试自身创建的 mkdtemp 目录；
- 测试不得设置或读取数据库连接；
- 不运行 integration/e2e；
- 不运行 Worker 调度；
- 不执行真实业务文件删除。

## 9. 残留风险

- 旧代码版本部署在外部环境中时，本仓库修改不能自动撤回已部署进程；需要部署侧排空/撤权；
- 历史 staging/object 会积累，本阶段有意不删除；
- 没有对象级锁、Operation 或 Reconciliation；
- 正常上传链仍与 P13 必填字段不兼容；
- 没有数据库级真实回归；
- 测试专用 reset 仍使用递归删除，但其目标必须继续由身份 guard 保护；
- 外部运维脚本不在仓库搜索范围内。

这些风险在 M 及后续阶段处理。

## 10. M 阶段依赖

- 上传链 P13 兼容改造；
- Attempt write phase / write evidence；
- 对象级 storageKey 协调锁；
- Cleanup Case / Operation / physical evidence；
- Definer/Maintenance/Recovery 角色；
- Clone-based real-commit 测试；
- Reconciliation；
- 经独立安全审查后重新引入受控物理删除能力。

## 11. 当前状态

```text
L Design:
IMPLEMENTED

Legacy Web Cleanup:
DISABLED

Legacy Worker Cleanup:
DISABLED

Adapter Legacy Delete APIs:
FAIL-CLOSED

Canonical Commit-Unknown Protection:
IMPLEMENTED

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```
