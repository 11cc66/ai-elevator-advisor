# P1-3 C-6.2-L1 Legacy Worker 部署排空与删除权限验证设计

## 文档信息

- 阶段：`C-6.2-L1`
- 日期：`2026-11-18`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 状态：`READ-ONLY DEPLOYMENT AUDIT / BLOCKED`
- 运行环境变更：`NOT EXECUTED`
- New Cleanup：`NOT ENABLED`

## 1. 总体结论

本地源码已经完成 L 阶段 fail-closed 止损，但无法从仓库证明所有实际部署实例已经运行该版本。当前还发现了 L 之前生成的本地高风险构建产物：

```text
apps/worker/dist/file-maintenance.js
apps/web/.next/server/chunks/**
```

这些产物包含旧 Worker/Web 物理删除逻辑。若被误启动，或者随旧依赖快照一起部署，仍可能恢复删除能力。

本机当前没有发现项目的 Web/Worker 进程、Windows Service 或计划任务，但也不能据此证明其他机器、容器、调度平台或历史镜像不存在。

因此：

```text
C-6.2-L1:
BLOCKED

Deployment Topology:
PARTIALLY VERIFIED

Legacy Worker Instances:
UNKNOWN

Legacy Scheduler:
UNKNOWN

Storage Delete Permissions:
BLOCKED

Legacy Worker Drain:
NOT EXECUTED
```

## 2. 证据边界

### 2.1 本轮可确认

- Git 源码 Branch/HEAD；
- 当前工作树和 L 阶段修改；
- package scripts；
- Worker 启动入口和 PgBoss 调度代码；
- Web `start` 方式；
- 当前本地仓库构建产物；
- 当前本机可见进程、服务、计划任务名称和部分网络状态；
- 本地 Storage 目录的聚合大小与 ACL；
- 仓库中不存在 Docker/Compose/CI/CD/Kubernetes/PM2/systemd 配置。

### 2.2 不能确认

- 生产或测试服务器的实际部署方式；
- 实际运行 Worker 的 Git SHA、Build ID 或镜像 Digest；
- 容器编排平台、Windows 服务、计划任务或外部调度平台上的实例；
- 实际 Storage 根、运行账户和路径级权限；
- 旧队列任务和正在执行的物理删除；
- 历史镜像、构建缓存和可重新启动的 Release；
- 多区域、多主机或独立 Worker 部署。

## 3. Deployment Entry Inventory

### 3.1 已发现的仓库内入口

| Instance ID | Deployment Type | Configuration Path | Start Command | Worker Entry | Schedule | Replicas | Environment | Version Source | Cleanup Capability | Evidence | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DEP-ENTRY-01 | Web local dev | root `package.json` | `pnpm dev:web` | Next.js via `@elevator/web dev` | manual | 1 local | development | source only | 当前源码无旧删除；旧 `.next/dev` 有历史代码 | package scripts/README | PARTIALLY VERIFIED |
| DEP-ENTRY-02 | Web production-style start | `apps/web/package.json` | `next start` | existing `apps/web/.next` | manual/service unknown | unknown | unknown | `.next/BUILD_ID=LULjk7Rp3QcYPDlFEyycy`; no SHA mapping | 旧 `.next` 内含旧 cleanup 和 Storage 删除代码 | package script + local build artifact | UNVERIFIED / HIGH RISK |
| DEP-ENTRY-03 | Worker local dev | root/app worker package | `pnpm dev:worker` or `tsx watch src/index.ts` | `apps/worker/src/index.ts` | manual | 1 local | development | source only | 当前源码无旧删除 | README/package script | PARTIALLY VERIFIED |
| DEP-ENTRY-04 | Worker built start | `apps/worker/package.json` | `node dist/index.js` | `apps/worker/dist/index.js` | manual/service unknown | unknown | unknown | old dist mtime `2026-11-17 01:17`; no SHA | old dist 含 remove/orphan/temp 调用；当前依赖包会 fail closed | package script + dist content | UNVERIFIED / HIGH RISK |
| DEP-ENTRY-05 | Worker build | `apps/worker/package.json` | `tsc -p tsconfig.build.json` | `dist/**` | on demand | N/A | build | source tree | current build has not been refreshed in this phase | package script | VERIFIED |
| DEP-ENTRY-06 | PgBoss internal cron | `apps/worker/src/index.ts` | Worker startup | Worker process | `*/15 * * * *`; startup immediate | follows Worker | unknown | no runtime identifier | current source run is non-deleting; old dist remains dangerous | source | PARTIALLY VERIFIED |
| DEP-ENTRY-07 | E2E Worker | `apps/web/tests/e2e/global-setup.ts` | `tsx src/index.ts` | source Worker | test run | 1 child | test only | test process | source currently non-deleting | test file | VERIFIED TEST-ONLY |
| DEP-ENTRY-08 | test-db reset | `apps/web/scripts/test-db/cli.ts` | pnpm test DB commands | test DB/storage | on demand | 1 | test only | repository test guard | deletes only verified test storage root and resets test DB | test guard code | VERIFIED TEST-ONLY |

### 3.2 未发现的仓库配置

当前工作树未发现：

- Dockerfile；
- Docker Compose；
- CI/CD Workflow；
- Kubernetes / Helm；
- systemd unit/timer；
- PM2 ecosystem 配置；
- Windows Service 配置文件；
- Windows Task Scheduler XML；
- Procfile、Vercel/Render/Fly 配置；
- Terraform/Ansible/CloudFormation。

不能把“仓库未发现”解释为“运行环境不存在”。

### 3.3 当前本机只读探测

| Probe | Result | Interpretation |
|---|---|---|
| Node 进程 | 仅 Codex Runtime Node PID 23656 | 未发现项目 Node Worker/Web |
| `tsx`/`next`/PM2/容器进程 | 未发现 | 当前机器上未观察到对应进程 |
| Windows Service 名称过滤 | 未发现 elevator/jieya/worker/p13 | 当前机器未观察到项目服务 |
| `schtasks` 名称过滤 | 未发现匹配任务 | 当前用户上下文未观察到项目任务 |
| `Get-ScheduledTask` | CimException | 无法完成 Task Scheduler 全量读取 |
| Docker/PM2/kubectl/podman/nerdctl | 未安装 | 当前机器无相应管理器 |
| WSL | 未安装发行版 | 未发现 WSL 内 Worker |
| 仓库内外部 Scheduler 配置 | 未发现 | PgBoss schedule 由 Worker 自身注册 |

该证据只覆盖当前主机与当前执行上下文。

## 4. 运行版本识别审计

### 4.1 当前能力

| 识别项 | 状态 | 证据 |
|---|---|---|
| Git SHA | 只存在于源码工作树 | 不是运行进程证据 |
| Build ID | Web `.next/BUILD_ID` 存在，但未映射 Git SHA | `LULjk7Rp3QcYPDlFEyycy` |
| Image Digest | 不存在 | 无镜像部署配置 |
| Release Version | 无部署版本 | package `0.1.0` |
| Worker Startup Build ID | 未记录 | `worker.started` 仅含 service/queues |
| Deployment Revision | 未记录 | 无部署系统 |
| Startup Time | 可通过进程管理器获取，但应用未记录 | 无启动时间字段 |
| Runtime Config Digest | 未实现 | 不输出配置摘要 |

### 4.2 已知构建产物

```text
apps/worker/dist/file-maintenance.js
LastWriteTime: 2026-11-17 01:17:13
SHA256: C6B5B0EBD2AD047CF32AE447470B19D2AB02F413DDB33BABF80828A6FEFCABE3

apps/worker/dist/index.js
SHA256: D7DF17BC2CF23A7923527648A98FC5AABB8FD36A21D6A0B24EA92F8C1DE5BBB9

apps/web/.next/BUILD_ID
LULjk7Rp3QcYPDlFEyycy
```

Worker 旧 `dist` 包含：

```text
removeStaging
removeObject
cleanupOrphanObjects
cleanupTemp
```

Web `.next` 的 server chunk 同时包含旧上传清理函数和旧 Storage Adapter 删除实现。`.next` 的大小约 `446,890,260` bytes。

### 4.3 结论

缺少运行时 Build/SHA 上报机制，因此不能将源码 HEAD `b224388...` 当作实际部署版本。旧构建产物的存在使“当前源码已止损”与“当前机器可启动的产物已止损”也不是同一结论。

## 5. 旧物理删除能力分析

### 5.1 当前源码

当前 L 源码:

- `cleanupExpiredUploadIntents()` 显式失败；
- Worker 不再调用旧清理；
- `removeStaging`、`removeObject`、`cleanupOrphanObjects`、`cleanupTemp` fail closed；
- `writeToStaging` 失败不删除部分文件。

### 5.2 旧产物

本地旧产物仍包含危险调用。对 `apps/worker/dist` 的保护取决于它加载的 `@elevator/file-storage`：

```text
旧 worker dist + 当前 file-storage dist -> 删除调用会失败
旧 worker dist + 旧 file-storage dist -> 可能恢复删除
```

`apps/web/.next` 将旧 Storage 删除实现打包进 server chunk，风险更高。如果使用 `next start` 直接启动旧 `.next`，源码是否已修改不能阻止旧 chunk 被执行。

### 5.3 间接删除路径

- Web 请求内过期 Intent 清理；
- Worker expired Intent；
- Worker orphan；
- Worker temp；
- 旧构建产物可重新暴露上述入口；
- 测试 reset 只允许测试 root，不属于生产；
- 当前未发现云对象存储 SDK 或 IAM 删除路径。

## 6. Web / Worker 部署依赖

```text
Single repository
  -> Web process
       -> Next.js
       -> local/private storage root
       -> PostgreSQL
  -> Worker process
       -> pg-boss
       -> local/private storage root
       -> PostgreSQL
```

已确认：

- Web 与 Worker 使用不同 package scripts 和不同进程；
- 当前没有共享镜像或统一部署脚本证据；
- Worker 和 Web 都读取 Storage root 配置；
- 两者可独立构建/启动，存在版本错配可能；
- 无外部 Scheduler 配置，调度由 Worker 启动时在 PgBoss 中注册；
- 旧 Worker 可继续领取同一 queue，除非旧进程被停止或 queue handler 被替换；
- PgBoss schedule 是数据库持久状态，停止旧进程不等于自动删除 schedule 记录。

## 7. Storage 权限分析

### 7.1 当前实现

本地 Storage Adapter 使用文件系统路径，不使用云 SDK/IAM/Bucket Policy。

Web 和 Worker 的删除能力由以下共同决定：

- 运行 OS 账户对 Storage root 的文件系统 ACL；
- 进程加载的代码版本；
- 是否能调用 Storage Adapter；
- 是否能操作队列和数据库。

当前本地 `storage/private` ACL:

```text
Owner: LAPTOP-34H6Q1OD\CodexSandboxOffline
CodexSandboxUsers: Modify
thinkbook: FullControl
SYSTEM: FullControl
Administrators: FullControl
```

本地评估：

- 没有 Web/Worker 专用身份；
- 没有路径级 delete-only 或 maintenance-only ACL；
- 多个本地主体具有 Modify 能力；
- 当前业务目录未见实际 staging/objects/temp 文件；
- `private` 仅 1 个文件、1 byte；
- `private-test` 7 个文件、2,876 bytes。

以上只适用于当前机器，不适用于未知部署环境。

### 7.2 目标权限边界

```text
Web identity:
  staging write/read if upload path; no canonical delete

Worker processing identity:
  canonical read; no canonical delete

Maintenance identity:
  operation-controlled quarantine/purge only

Recovery identity:
  explicit manual recovery only
```

在本地文件系统上，未来必须使用独立 OS 身份和 ACL；否则仅靠应用层 capability 无法阻止同一用户启动旧程序。

## 8. 安全排空方案

### Phase A：冻结旧 Worker 新任务领取

必须：

- 从服务管理器/容器编排中移除旧 Worker 启动项；
- 禁止自动重启策略拉回旧版本；
- 撤销旧 Worker 数据库登录能力，或将其指向不可写队列；
- 不允许仅依赖应用内 `LEGACY_CLEANUP_ENABLED` 一类配置；
- 记录旧实例 PID/容器 ID/服务名/进程启动时间。

### Phase B：停止危险任务调度

必须：

- 在获准窗口内停止 PgBoss `file-maintenance` schedule；
- 停止启动时立即执行 maintenance 的旧入口；
- 保持 file-recognition 和 processing recovery 的合法能力；
- 检查数据库 schedule/queue 记录，不只看进程；
- 检查 Windows Task Scheduler、systemd、Cron、PM2、K8s CronJob 或云调度。

当前仓库没有外部 scheduler 配置，因此外部 scheduler 必须由运维另行证明。

### Phase C：等待在途任务

需要：

- 读取 queue active jobs；
- 读取 Worker 日志中的 maintenance start/end；
- 确认没有 `DELETE_IN_PROGRESS` 或等价旧日志；
- 等待超过 PgBoss maintenance job `expireInSeconds=120`、优雅停止 10 秒和外部进程管理窗口；
- 对无法确认的 in-flight job 采用保留和人工复核，不假定已停止。

### Phase D：逐实例排空

每个实例必须有：

- 唯一 instance ID；
- 进程/容器 ID；
- Build ID / SHA / Image Digest；
- 启动时间；
- 所属环境；
- 当前 active jobs；
- 是否有 DDL/DML/FS delete 权限；
- 停止证据。

旧实例不能因“主进程退出”直接视为完成，需验证子 Worker、线程、Promise 和外部任务。

### Phase E：撤销旧删除能力

优先顺序：

1. 撤销旧实例登录/队列领取；
2. 撤销旧 OS 身份对 Storage root 的 Write/Delete；
3. 撤销旧 Storage 凭据；
4. 限制新 Maintenance 身份只访问未来 quarantine/temp 路径；
5. Web/普通 Worker 永不拥有 canonical delete；
6. 不将旧 Worker 凭据复用给新 Cleanup。

### Phase F：独立验证

必须从独立控制面验证：

- 旧实例不存在；
- 旧 scheduler 不再派发；
- 旧进程不会自动重启；
- 旧身份删除测试目标被拒绝；
- 正常 upload/complete/download 成功；
- 新 Cleanup 仍关闭；
- 证据记录不含秘密。

## 9. 单一物理删除责任主体比较

| 方案 | 身份与权限 | Storage 隔离 | DB/租约 | 并发 | 可观测性 | 恢复 | 部署复杂度 | 泄露风险 | 结论 |
|---|---|---|---|---|---|---|---|---|---|
| Web Runtime 直接删除 | Web 进程广泛可达 | 难路径化 | 无对象级 claim | 高 | 请求日志有限 | 差 | 低 | 高 | 拒绝 |
| 普通 Worker 直接删除 | Processing 与 Cleanup 混合 | 共享 root | 可通过 Operation 增强 | 中 | 与处理任务混合 | 中 | 低 | 中/高 | 拒绝 |
| 专用 Maintenance Worker | 独立低权限身份 | 可限制 quarantine/temp | 可完整 claim/evidence | 可控 | 指标清晰 | 可 Reconciliation | 中 | 中 | 推荐 |
| 专用 Cleanup Service | 独立服务身份 | 最强路径/凭据隔离 | 需与 DB 授权协调 | 强 | 最强 | 需独立运维 | 高 | 低 | 备用 |
| DB 授权函数协调的独立执行主体 | DB 只授权，不直接删文件 | 执行者仍需隔离 | 强 | 强 | 强 | 强 | 高 | 中 | 架构原则，不单独作为执行者 |

推荐：

```text
专用 Maintenance Worker
  + 独立 OS/Storage 身份
  + DB Cleanup Operation/Case 授权
  + 路径级 quarantine/temp 权限
  + 独立 lease/generation
```

备用：

```text
专用 Cleanup Service
  + 独立对象存储凭据
  + Prefix/Path-only delete policy
  + DB authorizer/evidence
```

所有方案都必须保持：

- Web 无物理删除；
- 普通 Worker 无物理删除；
- 只有单一 delete owner；
- 新 Cleanup 未批准前不启用。

## 10. Deployment Evidence Matrix

| Evidence ID | 证据 | 当前状态 | 已获证据 | 缺口 |
|---|---|---|---|---|
| DEP-01 | Worker 部署实例清单 | PARTIALLY VERIFIED | 仓库启动入口和本机无项目进程 | 无外部实例清单 |
| DEP-02 | 实际运行版本 | UNVERIFIED | Git HEAD、旧 Build ID/时间 | 无生产实例 Build/SHA/Digest |
| DEP-03 | 旧 Worker 排空证据 | UNVERIFIED | 本机未发现 Worker | 无外部 stop/drain 证据 |
| DEP-04 | 外部 Scheduler 停用 | UNVERIFIED | 仓库无外部配置；本机无匹配 task | Task Scheduler 全量读取失败；外部平台未知 |
| DEP-05 | 自动重启检查 | UNVERIFIED | 本机无服务/任务匹配 | 无部署管理器证据 |
| DEP-06 | Storage 删除权限收敛 | BLOCKED | 本地 ACL 可知 | 无生产身份、ACL/凭据证据 |
| DEP-07 | 新旧 Worker 不并行拥有删除权 | BLOCKED | 当前源码 fail-closed | 无法证明旧实例全部撤权 |
| DEP-08 | 正常业务验证 | PARTIALLY VERIFIED | L 单元测试和下载回归 | 未执行生产/隔离集成 |
| DEP-09 | 新 Cleanup 保持关闭 | PARTIALLY VERIFIED | 当前源码无新 Cleanup | 无生产配置/运行证据 |
| DEP-10 | 旧镜像与构建产物隔离 | BLOCKED | 本地旧 dist 和 `.next` 明确存在 | 未隔离/未验证外部制品库 |

## 11. 历史文件积累风险

本机 `storage/private` 当前：

```text
FileCount = 1
TotalBytes = 1
staging = absent
objects = absent
temp = absent
```

`storage/private-test`：

```text
FileCount = 7
TotalBytes = 2876
```

本机 D 盘当前约 `233,707,724,800` bytes 可用。

仓库没有专用容量指标、配额、磁盘告警、Storage usage metric 或 Prometheus endpoint。现有 maintenance result 只记录旧清理计数，L 后为零，不能作为容量指标。

风险：

- 未来 staging/partial 文件增长；
- canonical orphan 增长；
- 临时目录增长；
- 磁盘耗尽影响上传/处理/备份；
- 仅凭本地盘可用空间不能推断生产风险。

只读盘点可以作为下一独立任务，但不得恢复删除。

## 12. 未知事项与最小证据请求

需要运维/项目负责人提供非敏感证据：

1. 所有环境的部署平台与实例清单；
2. 每个 Worker 的启动命令和 process manager；
3. 实际 Build ID、Git SHA 或 Image Digest；
4. 实例启动/停止时间；
5. Scheduler 配置截图/导出，不含凭据；
6. Storage 根与访问身份名称，不含 Secret；
7. 旧 Worker 自动重启策略；
8. 旧 queue/schedule 记录；
9. 历史镜像/Release 列表；
10. 容量和磁盘告警指标。

不得提供密码、Token、连接串或密钥。

## 13. 独立反向自审

| 反向问题 | 结论 |
|---|---|
| 是否遗漏独立 Worker | 仓库无配置；外部实例 UNKNOWN |
| 是否遗漏 Cron/Scheduler | PgBoss 已知；Task Scheduler 全量 BLOCKED；外部平台 UNKNOWN |
| 是否遗漏容器外任务 | 是，无法从本地证明不存在 |
| 是否遗漏旧镜像 | 是，本地旧 dist/.next 已确认，镜像仓库 UNKNOWN |
| 是否遗漏自动重启 | 是，无部署管理器证据 |
| 是否遗漏滚动部署旧实例 | 是 |
| 是否遗漏多区域 | 是 |
| 是否遗漏 Storage 凭据共享 | 本地 ACL 共享，生产 UNKNOWN |
| 是否遗漏 SDK/API 删除 | 当前未发现云 SDK；插件/外部工具 UNKNOWN |
| 是否把 HEAD 当运行版本 | 没有；DEP-02 明确 UNVERIFIED |
| 是否把配置存在当运行 | 没有；入口与实例分开 |
| 是否把无配置当无外部调度 | 没有；明确 UNKNOWN |
| 是否遗漏在途删除 | 未连接 DB/运行日志，UNVERIFIED |
| 是否遗漏队列重试 | PgBoss retry/expire 仍未运行验证 |
| 是否遗漏旧 Worker 领新任务 | 未撤权前仍可能 |
| 是否遗漏旧凭据有效 | UNVERIFIED |
| 回滚是否会启动旧版 | 存在风险，回滚策略必须禁止旧 delete artifact |
| 新旧是否可能同时有删除权 | 未完成排空前存在风险 |
| Web 是否仍有删除权 | 当前源码无；旧 `.next` 仍有旧代码 |
| 业务是否受影响 | L 单元测试通过；真实业务未验证 |

## 14. 后续依赖

L1 之后的独立授权必须完成：

1. 获取非敏感部署清单和版本证据；
2. 停止旧 Scheduler/Worker，或对新旧 Worker 做严格单 owner 隔离；
3. 冻结旧构建产物，禁止启动；
4. 部署并验证 L 源码/新构建；
5. 对旧身份执行删除拒绝验证；
6. 验证上传、完成、下载；
7. 确认新 Cleanup 继续关闭；
8. 只有全部证据完成后才可重新评估 PASS；
9. 不自动进入 M。

## 15. 当前门禁

```text
C-6.2-L1:
BLOCKED

Deployment Topology:
PARTIALLY VERIFIED

Legacy Worker Instances:
UNKNOWN

Legacy Scheduler:
UNKNOWN

Storage Delete Permissions:
BLOCKED

Legacy Worker Drain:
NOT EXECUTED

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```
