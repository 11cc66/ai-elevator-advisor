# Phase 3.5 文件处理可靠性

本阶段只增强文件处理系统的幂等、并发、失败恢复和清理安全，不增加客户业务功能。

## 幂等与执行权

- 每次处理通过 PostgreSQL 条件更新从 `QUEUED` 抢占为 `PROCESSING`。
- 抢占成功时生成随机 `processingToken`，并写入有限期的 `leaseExpiresAt`。
- 完成、失败、重试释放和旧 Worker 回写均必须匹配当前 `processingToken`。
- 处理期间按 `FILE_PROCESSING_LEASE_RENEW_INTERVAL_MS` 定期续租，
  每次续租都校验令牌、处理状态和原租约尚未过期。
- 续租失败会触发 AbortSignal 终止 PDF Worker Thread，旧 Worker 不再提交结果。
- 终态事务同时要求令牌匹配且租约在执行时刻仍有效。
- 两个 Worker 同时消费同一 Extraction 时，只有一个能够取得执行权。
- 已完成 Extraction 再次投递时直接返回 `IGNORED`，不会重复创建文字块或完成审计。
- 旧任务只更新自身 Extraction；只有最新 Extraction 才能修改 FileVersion 的当前识别状态。

## 状态与重试

```text
QUEUED -> PROCESSING -> COMPLETED
                     -> QUEUED (临时错误)
                     -> FAILED (永久错误或重试耗尽)
                     -> FAILED + recognitionStatus=BLOCKED (安全策略拒绝)
```

- `attempt` 从 0 开始，成功抢占一次增加 1。
- 默认最多处理 3 次，可通过 `FILE_PROCESSING_MAX_ATTEMPTS` 调整。
- 临时错误释放任务为 `QUEUED`，记录错误码和下一次可重试时间。
- pg-boss 使用有上限的指数退避：默认基数为 5 秒，上限 60 秒。
- 永久文件错误、完整性失败和安全策略拒绝不进入自动重试。
- 达到最大次数后进入 `FAILED`，错误码保留最后一次失败原因。
- 每次临时失败写入 `file.extraction.retry_scheduled` 审计；
  重试耗尽写入 `file.extraction.retry_exhausted` 审计。

## Worker 崩溃恢复

- 处理租约默认 120 秒，大于 PDF 默认解析超时 60 秒。
- 处理租约默认每 30 秒续租；续租不会增加 `attempt`。
- Worker 在抢占后任一阶段退出时，数据库仍保留 `PROCESSING` 和租约令牌。
- 另一 Worker 或维护任务只有在租约过期后才能重新抢占。
- 恢复后的任务重新执行账号、项目权限、病毒扫描、完整性、MIME 和 SHA-256 检查。
- 已达到最大尝试次数的过期任务直接进入 `FAILED`，不会无限循环。
- 数据库事务提交后、pg-boss 确认前退出时，重复消息会看到 `COMPLETED` 并忽略。

## 文件清理

- 维护任务使用 `system_metadata` 中的短期数据库租约，多个 Worker 不会同时清理。
- 维护租约的随机 owner/UUID 同时作为 fencing token。
- 维护期间默认每 60 秒 CAS 续租；旧 owner 不能续租、释放或覆盖新 owner。
- 删除每个对象前再次校验租约，失租实例立即停止后续清理和数据库副作用。
- 租约持有者异常退出后，租约到期允许后续维护任务接管。
- 删除孤儿对象前重新读取 FileVersion 和未过期上传意图的引用集合。
- 有效 FileVersion 引用的原始对象不会因清理或活跃任务而删除。
- 孤儿对象仍需超过 `TEMP_RETENTION_MS`，避免删除正在提交的上传对象。
- staging、temp、孤儿对象和过期上传意图中的单项清理错误会记录结构化日志，
  不会因单个对象失败而误删其他对象。

## 主要配置

```text
FILE_PROCESSING_MAX_ATTEMPTS=3
FILE_PROCESSING_RETRY_DELAY_SECONDS=5
FILE_PROCESSING_RETRY_MAX_SECONDS=60
FILE_PROCESSING_JOB_EXPIRE_SECONDS=180
FILE_PROCESSING_LEASE_MS=120000
FILE_PROCESSING_LEASE_RENEW_INTERVAL_MS=30000
FILE_MAINTENANCE_LEASE_MS=300000
FILE_MAINTENANCE_RENEW_INTERVAL_MS=60000
```

## 测试

```powershell
pnpm test
pnpm test:db:constraints
pnpm test:e2e
pnpm typecheck
pnpm build
```

可靠性测试覆盖真实 PostgreSQL 并发抢占、旧令牌回写、真实 pg-boss 重试、
永久失败、重试上限、五个 Worker 崩溃节点、恢复时安全复检、并发清理互斥、
活跃文件对象保留和数据库租约约束。补强测试还覆盖维护/处理任务超过初始
租约后的正常续租、续租失败中止、旧 owner 不能续租或删除，以及旧 Worker
不能提交结果或释放新 Worker 租约。
