# P1-3 C-6.2-L1 Legacy Worker 部署排空与删除权限验证报告

## 文档信息

- 阶段：`C-6.2-L1`
- 日期：`2026-11-18`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 结论：`BLOCKED`

## 1. 最终结论

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

结论为 BLOCKED 的原因不是源码止损失败，而是部署侧仍缺少实际运行实例、运行版本、Scheduler、Storage 身份和生产权限证据；此外，本机发现 L 之前生成的旧 Worker/Next 构建产物仍包含旧物理删除代码。

## 2. 检查范围

本轮只读检查：

- Git Branch、HEAD、完整工作树；
- K/L 文档和 L 修改后代码；
- root/Web/Worker package scripts；
- Worker 启动入口、队列和 PgBoss schedule；
- Worker 启动版本日志；
- Web/Worker 与 Storage/数据库配置边界；
- Docker、Compose、CI/CD、Kubernetes、PM2、systemd、Windows Service、Task Scheduler、Cron 配置；
- 本地 Node/Web/Worker/容器进程；
- 本地 Windows Service；
- 当前用户 Task Scheduler；
- Docker/PM2/kubectl/WSL 工具；
- Git 历史中的部署文件；
- 本地 Storage 目录聚合规模与 ACL；
- 本地 Worker `dist` 和 Web `.next` 构建产物。

未读取 `.env`、`.env.test` 或其他真实秘密配置。

### 2.1 本轮开始时的 K/L 文档哈希

```text
K 设计
040A5DEFB677A0C8C1C63E136489988A2A0563ED4963D726CD4D9D9AF4A2FB15

K 报告
EE1D67CDF4AC0CA993DCC44ACDC01672DB2AE7ABE5A290675D857477DCAF49F2

L 设计
7C24F911A7018577975FD7BA65BCE0E1E5F9AF02D3A9845D1AD1F8E6FE111227

L 报告
2F5B0366ABED2F4F0A401937760EEA36915F616D74FA99AB14F5C9999092B6CD

测试计划（L1 更新前）
3F9F79C343E363E1038009E2AF6D76A3C04B46EB6895EA0875AEC6BA5F7980A7

实现状态（L1 更新前）
666C3E27D7119797A0783BA1B81B7AAA97A87C317128A88ED3C0D6A4265A84CC
```

K/L 设计与报告在本轮未修改；测试计划和实现状态仅做 L1 状态同步。

## 3. Git 与工作树

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

工作树保留 L 阶段全部修改，以及此前已有的未提交文件和 K 文档。

本阶段只新增：

```text
docs/architecture/file-lifecycle-p13-c6-2-l1-design.md
docs/architecture/file-lifecycle-p13-c6-2-l1-report.md
```

并更新：

```text
docs/architecture/file-lifecycle-p13-implementation-status.md
docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md
```

未修改业务代码、Worker 配置、环境配置、Schema、Migration、ACL、角色或部署配置。

## 4. Deployment Entry Inventory

| Instance ID | Type | Start / Entry | Trigger | Actual Runtime Evidence | Status |
|---|---|---|---|---|---|
| DEP-ENTRY-01 | Web dev | `pnpm dev:web` -> Next dev | manual | 当前无项目 Web 进程 | PARTIALLY VERIFIED |
| DEP-ENTRY-02 | Web start | `next start` using `apps/web/.next` | service unknown | 本地 `.next` 存在且含旧删除代码 | UNVERIFIED / HIGH RISK |
| DEP-ENTRY-03 | Worker dev | `pnpm dev:worker` / `tsx watch src/index.ts` | manual | 当前无项目 Worker 进程 | PARTIALLY VERIFIED |
| DEP-ENTRY-04 | Worker built start | `node dist/index.js` | service unknown | 本地旧 `dist` 存在且含旧删除代码 | UNVERIFIED / HIGH RISK |
| DEP-ENTRY-05 | Worker build | `tsc -p tsconfig.build.json` | on demand | 本阶段未执行 build | VERIFIED |
| DEP-ENTRY-06 | PgBoss schedule | Worker startup | `*/15 * * * *` + startup immediate | 当前无项目 Worker | PARTIALLY VERIFIED |
| DEP-ENTRY-07 | E2E Worker | test global setup -> source Worker | test run | 本轮未运行 | VERIFIED TEST-ONLY |
| DEP-ENTRY-08 | test-db reset | test CLI | explicit test command | 本轮未运行 | VERIFIED TEST-ONLY |

### 仓库内未发现

- Dockerfile；
- Docker Compose；
- CI/CD Workflow；
- Kubernetes / Helm / CronJob；
- systemd；
- PM2；
- Windows Service 配置；
- Windows Task Scheduler XML；
- Procfile、Vercel/Render/Fly 或 Terraform/Ansible 配置。

这只说明当前工作树没有配置，不说明外部环境不存在。

## 5. 实际运行环境

### 5.1 当前本机

| 检查 | 结果 |
|---|---|
| Node 进程 | 只有 Codex Runtime 的 Node PID 23656 |
| `tsx` / `next` / PM2 / dockerd / containerd / kubelet | 未发现 |
| Windows Service 名称过滤 | 未发现 elevator/jieya/worker/p13 |
| `schtasks` 名称过滤 | 未发现匹配任务 |
| `Get-ScheduledTask` | `CimException`，全量读取失败 |
| Docker / PM2 / kubectl / podman / nerdctl / systemctl | 未安装 |
| WSL | 无发行版 |

结论：

```text
Local current host:
NO PROJECT WORKER OBSERVED
```

这不是所有部署环境已排空的证据。

### 5.2 未知环境

以下全部未知：

- 测试服务器；
- 生产服务器；
- 容器平台；
- Windows Service；
- 其他用户/管理员计划任务；
- systemd / PM2 / Kubernetes CronJob；
- 云调度；
- 外部任务平台；
- 多区域或多主机 Worker。

## 6. 运行版本识别

### 6.1 已确认

Worker 启动日志仅包含：

```text
service = elevator-advisor-worker
queues = system job / file-recognition / file-maintenance
event = worker.started
```

没有：

- Git SHA；
- Build ID；
- Image Digest；
- Deployment Revision；
- Package build hash；
- startup version health endpoint。

Package version 固定为 `0.1.0`，不足以区分 L 前后版本。

### 6.2 结论

```text
Git HEAD = SOURCE PROVENANCE ONLY
Git HEAD != ACTUAL RUNTIME VERSION
```

`DEP-02` 为 `UNVERIFIED`。

## 7. 旧 Worker 与旧构建产物风险

### 7.1 Worker `dist`

本地存在：

```text
apps/worker/dist/file-maintenance.js
LastWriteTime: 2026-11-17 01:17:13
SHA256: C6B5B0EBD2AD047CF32AE447470B19D2AB02F413DDB33BABF80828A6FEFCABE3
```

该文件仍包含：

```text
removeStaging
removeObject
cleanupOrphanObjects
cleanupTemp
```

当前 workspace 的 `packages/file-storage/dist` 已是 fail-closed，因此“旧 Worker dist + 当前依赖包”在本地会拒绝删除。但若与旧 `file-storage` 快照一起运行，风险恢复。

### 7.2 Web `.next`

本地存在：

```text
BUILD_ID = LULjk7Rp3QcYPDlFEyycy
LastWriteTime = 2026-11-17 01:17:29
```

`.next` server chunks 仍包含旧过期 Intent 清理和旧 Storage 删除实现。

如果直接执行 `next start` 使用该旧 `.next`，仅修改 TypeScript 源码不会自动使旧构建产物安全。

### 7.3 风险等级

```text
Local stale worker dist:
HIGH

Local stale web .next:
HIGH

Actual external old image/artifact:
UNKNOWN
```

## 8. Web / Worker 独立性

已确认：

- Web 与 Worker 使用不同 package scripts；
- 两者是独立进程；
- 两者可独立构建和更新；
- Worker 有独立 PgBoss queue/schedule；
- 无统一 Docker Image 证据；
- 无 Worker 独立部署流水线证据；
- Web 和 Worker 都可能使用同一 Storage root；
- 两者可产生版本错配。

```text
same repository
  -> Web process -> Storage root + DB
  -> Worker process -> pg-boss + Storage root + DB
```

生产拓扑仍未知。

## 9. Storage 删除权限

当前代码使用本地文件系统，不使用云对象存储 SDK。

本地 `storage/private` ACL 摘要：

```text
Owner: LAPTOP-34H6Q1OD\CodexSandboxOffline
CodexSandboxUsers: Modify
thinkbook: FullControl
SYSTEM: FullControl
Administrators: FullControl
```

当前本地没有：

- Web 专用身份；
- Worker 专用身份；
- Maintenance 专用身份；
- Storage 路径级 delete ACL；
- quarantine-only 权限。

因此本地无法通过 OS 权限区分“普通 Worker”和“Maintenance delete owner”。

生产权限为 `BLOCKED`，因为没有实际身份/ACL/凭据证据。未读取任何凭据。

## 10. 排空方案

### Phase A：冻结旧 Worker

- 从 Service/容器/进程管理器移除旧 Worker；
- 禁止自动重启旧版本；
- 撤销旧 Worker 队列/DB 登录；
- 记录 PID/容器 ID/启动时间。

### Phase B：停止危险调度

- 停用 PgBoss `file-maintenance` schedule；
- 停用启动时 maintenance；
- 检查数据库持久 schedule/queue；
- 检查所有外部 Scheduler；
- 保留 file-recognition/recovery。

### Phase C：等待在途任务

- 只读盘点 active jobs；
- 检查 maintenance start/end 日志；
- 等待 PgBoss `expireInSeconds=120`、优雅停止 10 秒及部署平台宽限；
- 未知任务保持保留和人工复核。

### Phase D：逐实例排空

- 每实例记录 Build/SHA/Digest；
- 确认进程、子任务和 queue claim 均结束；
- 禁止自动重启；
- 不能只看主进程退出。

### Phase E：撤销删除权限

- 旧实例撤销 DB/queue 登录；
- 旧 OS/Storage 身份撤销 Write/Delete；
- 新 Maintenance 只访问未来 quarantine/temp；
- Web/普通 Worker 永远无 canonical delete；
- 不复用旧凭据。

### Phase F：独立验证

- 旧实例清单为零；
- 旧 scheduler 零派发；
- 旧进程不可自动恢复；
- 旧身份删除被拒绝；
- 正常上传/下载/完成通过；
- 新 Cleanup 仍关闭。

本阶段未执行任何 Phase A-F 的运行变更。

## 11. 证据矩阵

| Evidence ID | 状态 | 证据 / 缺口 |
|---|---|---|
| DEP-01 | PARTIALLY VERIFIED | 仓库入口已知；外部实例未知 |
| DEP-02 | UNVERIFIED | 无运行时 Git SHA/Build ID/Digest |
| DEP-03 | UNVERIFIED | 本机无 Worker；外部排空未知 |
| DEP-04 | UNVERIFIED | 仓库无外部 Scheduler；Task Scheduler 全量读取失败 |
| DEP-05 | UNVERIFIED | 无部署管理器策略 |
| DEP-06 | BLOCKED | 本地 ACL 共享；生产权限未知 |
| DEP-07 | BLOCKED | 旧实例和旧产物未完成排空 |
| DEP-08 | PARTIALLY VERIFIED | L 单元测试通过；生产业务未验证 |
| DEP-09 | PARTIALLY VERIFIED | 当前源码无 New Cleanup；运行配置未知 |
| DEP-10 | BLOCKED | 本地旧 dist/.next 已发现；镜像仓库未知 |

## 12. 历史文件积累

当前本机：

```text
storage/private:
  file count = 1
  total bytes = 1
  staging = absent
  objects = absent
  temp = absent

storage/private-test:
  file count = 7
  total bytes = 2876

D drive free:
  233707724800 bytes
```

仓库没有磁盘容量指标、Storage quota、容量告警或 Prometheus endpoint。

风险：

- staging/partial 增长；
- canonical orphan 增长；
- temp 增长；
- 磁盘耗尽；
- 备份和上传受影响。

本地数值不能代表生产。

## 13. 独立自审

| 自审问题 | 结果 |
|---|---|
| 是否遗漏独立 Worker | 外部实例 UNKNOWN |
| 是否遗漏 Cron/Scheduler | PgBoss 已知；外部 Scheduler UNKNOWN |
| 是否遗漏容器外任务 | 无法从本地证明不存在 |
| 是否遗漏旧镜像 | 无法访问镜像仓库；本地旧产物已发现 |
| 是否遗漏自动重启 | 无部署配置证据 |
| 是否遗漏滚动部署旧实例 | UNKNOWN |
| 是否遗漏多区域 | UNKNOWN |
| 是否遗漏 Storage 凭据共享 | 本地 ACL 共享；生产 UNKNOWN |
| 是否遗漏 SDK/API 删除 | 当前源码未发现云 SDK；外部工具 UNKNOWN |
| 是否误把 HEAD 当运行版本 | 未这样做 |
| 是否误把配置存在当运行 | 未这样做 |
| 是否误把无配置当无外部调度 | 未这样做 |
| 是否遗漏在途删除 | 未连接 DB，UNVERIFIED |
| 是否遗漏队列重试 | 存在，未运行验证 |
| 旧 Worker 是否能领新任务 | 排空前可能 |
| 旧凭据是否有效 | UNVERIFIED |
| 回滚是否可能启动旧版 | 有风险，必须禁止旧 delete artifact |
| 新旧是否可能同时删除 | 排空前存在风险 |
| Web 是否仍有删除权 | 当前源码无；旧 `.next` 有旧代码 |
| 正常业务是否受影响 | L 单元测试通过；真实环境未验证 |

## 14. 未解决风险

### Critical / High

1. 旧 `.next` 构建产物包含旧 Web cleanup 和文件删除实现；
2. 旧 Worker `dist` 包含旧物理删除调用；
3. 实际部署实例和版本 UNKNOWN；
4. 外部 Scheduler UNKNOWN；
5. 旧实例自动重启策略 UNKNOWN；
6. 生产 Storage 删除身份/ACL BLOCKED；
7. 旧 queue/schedule/in-flight jobs 未核验；
8. Task Scheduler 全量读取因 CimException 未完成。

本阶段已形成可靠控制方案，但不能执行，因此不能宣称排空完成。

## 15. 文件 SHA-256

### 15.1 L1 文档

```text
L1 设计
FD5F2D7C8A014487246ADA06F1A626513D55EA074CF27BFFA4A6AA2F2E4F3FD2

数据库行为测试计划
E3FF9D138DCA5769B0DFFC003D14FC1272D14C5F76F5DCA36C1A7C8A120A8442

实现状态
EB8EC1A0EB38C8B9BE23E3C3850D446D8A6345BF155CF29BAD13011ED428462D
```

L1 报告自身哈希在最终消息外部计算，避免自引用改变文件。

### 15.2 L 源码保护

```text
apps/web/src/modules/files/upload-service.ts
D4DB6FF4DB253E3D00C92DFB4707A58DC12F068C3AD9A17FDB37C90559FDB292

apps/worker/src/index.ts
3713E8292456CE3C8731863A39A762FC0D9711F56F0DB97D4215E50A3E704C20

apps/worker/src/file-maintenance.ts
4FBC8C09FEE153BF6CDA7F649100F199460F9720B25088F1E97EA0CC25159166

packages/file-storage/src/local-private-storage.ts
985D91DB9A0826F9E815C141FCE9596CD6924760BA8F3DF9D1A1EE018911DCF8
```

### 15.3 旧构建产物

```text
apps/worker/dist/file-maintenance.js
C6B5B0EBD2AD047CF32AE447470B19D2AB02F413DDB33BABF80828A6FEFCABE3

apps/worker/dist/index.js
D7DF17BC2CF23A7923527648A98FC5AABB8FD36A21D6A0B24EA92F8C1DE5BBB9

apps/web/.next/BUILD_ID
LULjk7Rp3QcYPDlFEyycy
```

### 15.4 受保护文件

```text
prisma/schema.prisma
78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299

apps/web/next-env.d.ts
0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC
```

## 16. 修改文件清单

新增：

```text
docs/architecture/file-lifecycle-p13-c6-2-l1-design.md
docs/architecture/file-lifecycle-p13-c6-2-l1-report.md
```

更新：

```text
docs/architecture/file-lifecycle-p13-implementation-status.md
docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md
```

未修改：

- Worker 源码；
- Web 源码；
- Storage Adapter；
- package scripts；
- 环境文件；
- Prisma Schema；
- Migration；
- 数据库对象、角色或 ACL；
- 构建产物；
- Git。

## 17. 未执行操作

```text
No Worker stop
No process kill
No service restart
No container operation
No deployment
No Docker/Compose change
No CI/CD change
No Windows Service change
No Task Scheduler change
No PM2/systemd/Cron change
No Feature Flag change
No environment variable change
No Storage credential change
No Bucket/IAM/ACL change
No PostgreSQL connection
No SQL
No Prisma database command
No Migration
No Cleanup Worker
No physical file deletion
No Git write
```

## 18. 下一步

必须由项目负责人和运维提供非敏感证据并授权独立变更窗口：

1. 实际部署实例清单；
2. Build ID / Git SHA / Image Digest；
3. Service/PM2/K8s/Cron/Task Scheduler 配置；
4. Worker 自动重启和 rollout 策略；
5. Storage 身份与路径级权限；
6. PgBoss schedule/queue 的只读状态；
7. 旧镜像/Release/构建产物清单；
8. 正常 Upload/Complete/Download 验证；
9. 完成排空和旧删除权限拒绝测试。

在证据补齐前：

```text
Legacy Worker Drain:
NOT EXECUTED

New Cleanup:
NOT ENABLED

M Phase / Next Phase:
NOT AUTHORIZED
```

## 最终状态

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

Database:
NOT CONNECTED

SQL:
NOT EXECUTED

Runtime Changes:
NOT EXECUTED

Prisma Schema / Migration:
NOT MODIFIED

Business Code:
NOT MODIFIED

Git Commit:
NOT CREATED

Next Phase:
NOT AUTHORIZED
```
