# P1-3 C-6.2-L5 部署环境安全基线与 Legacy Worker 排空准备报告

## 文档信息

- 阶段：`C-6.2-L5`
- 日期：`2026-11-18`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 结论：`PASS WITH WARNINGS`

## 1. 最终结论

```text
C-6.2-L5:
PASS WITH WARNINGS

Deployment Topology:
PARTIAL

Local Runtime Inventory:
PARTIAL

Production Runtime Inventory:
UNKNOWN

Web Startup Entry Audit:
PARTIALLY VERIFIED

Worker Startup Entry Audit:
PARTIALLY VERIFIED

Legacy Worker:
UNKNOWN

Legacy Scheduler:
UNKNOWN

Legacy Auto Restart:
UNKNOWN

Legacy Drain Protocol:
COMPLETE

Legacy Drain Execution:
NOT EXECUTED

Storage Delete Permissions:
BLOCKED

Runtime Identity Design:
COMPLETE

Release Root Design:
COMPLETE

Production ACL:
NOT VERIFIED

Startup Gate Deployment Enforcement:
DESIGNED / PRODUCTION NOT VERIFIED

Production Trust Root:
NOT CONFIGURED

Production Signing Key:
NOT CONFIGURED

Storage Monitoring Design:
COMPLETE / DB METRICS NOT IMPLEMENTED

Legacy Artifact Removal:
NOT EXECUTED

Production Deployment:
NOT EXECUTED

Production Artifact Status:
UNKNOWN

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```

## 2. Git 基线与工作树

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

工作树保留 L、L1-L4 和本轮全部未提交文件。未执行 Git 写操作。

## 3. 修改文件清单

新增：

```text
apps/web/scripts/p13-storage-inventory/inventory.ts
apps/web/scripts/p13-storage-inventory/cli.ts
apps/web/tests/p13-storage-inventory.test.ts
apps/worker/tests/test-worker-entry.ts
docs/architecture/file-lifecycle-p13-c6-2-l5-design.md
docs/architecture/file-lifecycle-p13-c6-2-l5-report.md
```

更新：

```text
apps/web/tests/e2e/global-setup.ts
apps/web/tests/p13-release-security.test.ts
docs/architecture/file-lifecycle-p13-implementation-status.md
docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md
```

未修改：

- Prisma Schema / Migration；
- 历史 `.next` / Worker `dist`；
- 数据库、Storage、ACL、角色；
- 实际 Service/Scheduler/CI/CD；
- Git 历史。

## 4. 部署拓扑调查

已确认仓库内：

```text
Web build:
  scripts/build-secure.ts

Web start:
  scripts/start-secure.mjs

Web instrumentation:
  Node-only Startup Gate

Worker build:
  scripts/build-secure.ts

Worker start:
  node dist/index.js -> Gate -> worker-entry.js

Scheduler:
  PgBoss */15 * * * *
  + Worker 启动立即执行
```

未发现：

- Docker/Compose；
- Kubernetes/Helm；
- Terraform/Pulumi/Ansible；
- GitHub/GitLab/Jenkins/Azure CI；
- PM2/systemd；
- Windows Service 配置；
- Task Scheduler XML；
- 外部 Cron/Watchdog/Supervisor。

不能由此推断外部生产环境不存在。

## 5. 本机运行环境

### 5.1 版本

```text
Node = v24.22.1
pnpm = 11.25.0
User = laptop-34h6q1od\codexsandboxoffline
```

### 5.2 进程

仅发现 Codex Runtime Node 进程：

```text
PID 23656
```

未发现项目 Web/Worker、PM2、Docker daemon、containerd 或 kubelet。

### 5.3 Services

未发现项目 Windows Service。

### 5.4 Scheduled Tasks

```text
schtasks name filter:
NO MATCH

Get-ScheduledTask:
CimException
```

Task Scheduler 全量读取为 `PARTIAL / BLOCKED`，不能声明所有任务不存在。

### 5.5 Other Runtime Managers

```text
Docker: NOT INSTALLED
PM2: NOT INSTALLED
kubectl: NOT INSTALLED
podman: NOT INSTALLED
nerdctl: NOT INSTALLED
systemctl: NOT INSTALLED
WSL: NO DISTRIBUTION
```

### 5.6 Ports

当前只读端口查询未发现项目 `3000` 监听证据。PostgreSQL 服务 `postgresql-x64-18` 为系统运行状态，但本轮未连接。

## 6. 本机 Storage

```text
storage/private:
  FileCount = 1
  TotalBytes = 1
  staging = absent
  objects = absent
  temp = absent

storage/private-test:
  FileCount = 7
  TotalBytes = 2876

D Drive:
  Total ≈ 484.95 GB
  Available ≈ 233.62 GB
```

本地 `storage/private` ACL 过宽：

```text
CodexSandboxUsers: Modify
thinkbook: FullControl
SYSTEM: FullControl
Administrators: FullControl
```

没有独立 Web/Worker/Maintenance 身份。

## 7. 外部部署证据缺口

| 信息 | 状态 | 下一步 |
|---|---|---|
| 生产服务器清单 | UNKNOWN | 管理员提供 |
| Web 部署方式 | UNKNOWN | 确认 Service/容器/平台 |
| Worker 实例数量 | UNKNOWN | 实例清单 |
| Worker 部署方式 | UNKNOWN | 进程管理器 |
| External Scheduler/Cron | UNKNOWN | 全用户/平台核验 |
| Auto Restart | UNKNOWN | Service/容器/PM2 配置 |
| Storage 类型 | UNKNOWN | 对象/本地磁盘确认 |
| Storage Delete ACL | BLOCKED | 生产只读核验 |
| Production ACL | NOT VERIFIED | ACL 导出 |
| Old Images/Releases | UNKNOWN | 镜像/发布库清单 |
| Trust Root | NOT CONFIGURED | 后续授权 |

## 8. Web 启动入口矩阵

| 入口 | Gate | 风险 | 状态 |
|---|---|---|---|
| package `start` | Secure Launcher | MEDIUM | 已 Gate |
| Next instrumentation | Web Startup Gate | LOW | Secure build 中已存在 |
| direct `next start` | 无仓库强制 | HIGH | 部署层必须禁止 |
| `next dev` | development 不 Gate | MEDIUM | 仅开发 |
| Custom Server | 不存在 | UNKNOWN | 若新增必须 Gate |
| Standalone Server | 未使用 | NOT IMPLEMENTED | 当前不可作为入口 |
| PM2/Service/Container | 外部未知 | UNKNOWN | 必须配置 wrapper |

Direct `next start` 的绕过风险仍未在部署层消除。

## 9. Worker 启动入口矩阵

| 入口 | Gate | 风险 |
|---|---|---|
| 新 `node dist/index.js` | Minimal Bootstrap | LOW |
| Worker `index.ts` | Gate + dynamic import | LOW |
| Worker `worker-entry.ts` | business entry，无 Gate | HIGH，直接启动禁止 |
| Legacy dist | 旧代码可能无 Gate/含 Delete | CRITICAL |
| `tsx watch src/index.ts` | 当前 index Gate | MEDIUM |
| `tests/test-worker-entry.ts` | 显式 test-only | TEST ONLY |
| PDF Worker Thread | 业务派生线程 | 不是外部入口 |

E2E global setup 已改为：

```text
tests/test-worker-entry.ts
```

避免 production index Gate 阻断测试，同时生产脚本不引用该入口。

## 10. Legacy Worker 与 Scheduler 状态

### 已确认本地风险

- 旧 `.next` 存在；
- 旧 Worker `dist` 存在；
- 旧 Worker `file-maintenance.js` 含 Legacy delete 调用；
- 旧 `.next` 含旧 Cleanup/Storage delete 代码；
- direct start 可绕过新 wrapper。

### 无法确认

- 外部旧 Web/Worker 实例；
- 外部 Scheduler；
- Auto Restart；
- 旧镜像；
- 其他机器旧构建；
- 旧 Storage Delete 权限。

```text
Legacy Worker: UNKNOWN
Legacy Scheduler: UNKNOWN
Legacy Auto Restart: UNKNOWN
Legacy Drain: NOT EXECUTED
```

## 11. Legacy Worker Drain Protocol

已设计完整流程：

```text
Freeze Release
  -> Inventory
  -> Stop New Task Production
  -> Scheduler Off
  -> Active Job Drain
  -> Worker Stop
  -> Auto Restart Disable
  -> Process Verify
  -> DB/Queue Access Revoke
  -> Storage Delete Revoke
  -> New Release Start
  -> Smoke/Reconciliation
```

关键判据：

- 所有实例版本已知；
- 所有 Scheduler 所有者已知；
- 旧实例 0；
- 旧 Scheduler 0；
- Auto Restart 0；
- 旧 cleanup entrypoint 0；
- 旧 Storage delete 权限撤销；
- 新 Gate PASS；
- New Cleanup 仍 DISABLED。

本轮未执行任何 Drain 操作。

## 12. Runtime Identity 与 Storage 最小权限

已设计：

| 身份 | 主要职责 | Storage Delete | Release Root |
|---|---|---|---|
| Web Runtime | Web/API/Upload | NO | READ ONLY |
| Worker Runtime | Processing | NO | READ ONLY |
| Maintenance | Controlled cleanup | Restricted | READ ONLY |
| Release Builder | Build | NO | write unpublished |
| Release Signer | Sign | NO | read digest |
| Deploy Operator | Switch release | NO | deployment write |
| Recovery Operator | Recovery | Controlled | READ ONLY |

Web/普通 Worker 不应拥有 canonical delete。

当前本地仍只有一个宽权限用户环境，生产身份为 UNKNOWN / NOT VERIFIED。

## 13. Release Root 与 ACL

推荐结构：

```text
release-root/
  trust/
    trusted-keys.json
  releases/
    release-A/
      manifest.json
      artifact/
  current.json
```

权限原则：

- Builder 写未发布 staging；
- Signer 通过 KMS/HSM 签名；
- Deploy Operator 创建新 Release、原子切换 pointer；
- Web/Worker Runtime 只读；
- Runtime 不可修改 Manifest/Trust Root/Release；
- Administrator 管理 ACL；
- 父目录同样禁止 Runtime 写。

Windows ACL 设计覆盖：

- inheritance；
- Owner；
- explicit deny；
- Junction/Reparse；
- delete-child；
- handle replacement；
- parent directory replacement。

状态：

```text
Code-Level Design: COMPLETE
Isolated NTFS ACL Test: NOT EXECUTED
Production ACL: NOT VERIFIED
```

## 14. Startup Gate 部署强制

### Web

- Service/PM2/Container command 必须指向 `start-secure.mjs`；
- direct next start 必须由部署层阻止；
- 自动重启必须再次执行 wrapper；
- 新 Next build 的 Node instrumentation 二次验证。

### Worker

- 只允许 `node <release>/dist/index.js`；
- index Gate 后动态导入业务；
- 禁止直接 `worker-entry.js`；
- 自动重启必须重新 Gate；
- 旧 dist 不可执行。

本仓库代码已支持；生产 Service/CI/容器配置尚未验证。

## 15. Production Trust Root 与密钥生命周期

推荐：

```text
Ed25519 KMS/HSM-backed signing
  -> signed Manifest
  -> read-only Trusted Public Key Registry
```

流程：

- keyId / fingerprint / validity / revocation；
- 新 key 双有效期窗口；
- 旧 key 撤销；
- Release 重签；
- Gate 重新验证。

私钥泄露流程：

```text
Stop Release
-> Revoke keyId
-> Reject impacted releases
-> Re-sign
-> Update Trust Root
-> Restart Gate
-> Audit Evidence
```

当前：

```text
Production Signing Key: NOT CONFIGURED
Production Trust Root: NOT CONFIGURED
```

## 16. Storage Inventory 与监控

### 已实现

新增只读 Storage Inventory：

```text
apps/web/scripts/p13-storage-inventory/inventory.ts
apps/web/scripts/p13-storage-inventory/cli.ts
apps/web/tests/p13-storage-inventory.test.ts
```

统计：

- staging/objects/temp 文件数量；
- 字节数；
- oldest/newest mtime；
- symlink 数量；
- 磁盘总容量/可用容量。

不读取内容、不删除、不连接数据库。

本地结果：

```text
staging absent
objects absent
temp absent
D available ≈ 233.62 GB
```

### 尚未实现

- DB 中过期 Intent；
- Orphan candidate；
- Processing retry backlog；
- 最老 pending job；
- Upload failure daily；
- Worker heartbeat/consume rate；
- Alert manager/Prometheus integration。

建议初始阈值只作为建议，需业务/运维确认。告警只能通知，不能自动删除。

## 17. 自动化测试

```text
Web:
20 files / 112 tests PASS

Worker:
5 files / 16 tests PASS

file-storage:
15/15 PASS

Web TypeScript:
PASS（--incremental false）

Worker TypeScript:
PASS（--incremental false）

Storage Inventory test:
1/1 PASS

E2E test-only entry static test:
PASS
```

未运行：

- integration；
- E2E；
- 真实 Worker/Web；
- PostgreSQL；
- Cleanup；
- 真实部署。

## 18. 独立攻击性审计

| 检查 | 结果 |
|---|---|
| 未调查 Web 入口 | 仓库已知入口已覆盖；外部 UNKNOWN |
| 未调查 Worker 入口 | 已知入口已覆盖；旧 dist HIGH |
| 旧 Worker 自动重启 | UNKNOWN |
| Scheduler | PgBoss 已知；外部 UNKNOWN |
| 外部 Cron | UNKNOWN |
| 旧容器镜像 | UNKNOWN |
| 其他机器旧产物 | UNKNOWN |
| Secure Launcher 绕过 | direct next start HIGH |
| Worker business direct | 文件存在，生产必须禁止 |
| 旧 Worker Storage delete | 代码存在，权限 UNKNOWN |
| Storage 权限过宽 | 本地 ACL 宽 |
| 发布/运行身份混用 | 本地单用户；设计分离 |
| Runtime 修改 Release | 设计禁止；生产 ACL NO VERIFIED |
| 父目录/Junction/Reparse | 代码测试覆盖，OS 未验证 |
| Trust Root 替换 | 外部 Trust Root 设计；生产未配置 |
| 私钥权限 | 未配置 |
| 撤销后旧 Release | 设计要求拒绝 |
| Build Failure fallback | L4 verified fail closed |
| Auto Restart旧版本 | 部署证据缺失 |
| Capacity 失控 | FS Inventory 已有；DB metrics 未实现 |
| Backlog 不可发现 | DB/queue metrics 未实现 |
| Alert 自动删除 | 设计明确禁止 |
| L fail-closed | 保持 |
| Legacy Cleanup | 仍 DISABLED |
| 未提交文件 | 保留 |

## 19. 未解决风险

1. Production Runtime Inventory UNKNOWN；
2. Legacy Worker/Scheduler/Auto Restart UNKNOWN；
3. Production Storage delete permissions BLOCKED；
4. Production ACL NOT VERIFIED；
5. Release Root 未实施；
6. Production Trust Root/Signing Key 未配置；
7. Direct `next start` 未在部署层禁止；
8. 旧 Web `.next`/Worker `dist` 仍存在；
9. DB queue/backlog monitoring 未实现；
10. Windows ACL/低权限身份测试未执行；
11. Prisma Client clean generation PARTIAL；
12. 动态未声明依赖风险；
13. Production Artifact Status UNKNOWN；
14. 真实 Upload/Download smoke test 未执行。

## 20. 生产环境未执行操作

```text
No service stop/restart
No Worker stop
No process kill
No Scheduler disable/delete
No Task Scheduler change
No PM2/systemd/Docker/K8s change
No deployment/rollback
No production ACL change
No Storage ACL/Bucket/IAM change
No production identity change
No Trust Root configuration
No production signing key
No PostgreSQL connection
No SQL
No Migration
No real Cleanup
No Storage file deletion
No historical artifact delete/move/rename/overwrite
No Git write
```

## 21. SHA-256

### L5 工具

```text
apps/web/scripts/p13-storage-inventory/inventory.ts
33C8C521D256CB2FEBB6F10FDAFF1535B35F4D7503DCF2523FEAD2A6EB8351A2

apps/web/scripts/p13-storage-inventory/cli.ts
ED4586793E44F6060E6069D6495A389625493B4909097BDAF47061DD28CE7F15

apps/web/tests/p13-storage-inventory.test.ts
8F3B1B4A538076935497851C2EDCB6F170D0C248B3DC3A04A3374EE07CA7DCE7

apps/worker/tests/test-worker-entry.ts
4C4E529AAD53A905B7EC1227778F3662E8AE8641819C3D9DE351159B3B15C025

apps/web/tests/e2e/global-setup.ts
12F37CBA796866910B671917CDFB763BC8D505CF499DEC6A2B120AA3B3B15E40

apps/web/tests/p13-release-security.test.ts
756DA67444F9AD9CB1F2EE0E843381353610771D9749AF505DF439B3E7A9B28E
```

### 文档

```text
L5 设计
EABEA77711A5D20A32022E9A21BB22155C5EEDFC9001634E2DC3F53AE426CED7

数据库行为测试计划
BC0C92358ED831062B5AE3F99DE45A3456E8142EF3E1728E41A1A53781F63A84

实现状态
2B523516F49AC3EDD58FC2647C12B5A1967620666D9A5396E6DDA37E04DB4638
```

L5 报告自身 SHA-256 在最终消息外部提供。

### 保护文件

```text
apps/web/.next/BUILD_ID
06955B147BD0009CD09B566531E3D2BC93B77142582145564E219C1530F9F5A1

apps/worker/dist/file-maintenance.js
C6B5B0EBD2AD047CF32AE447470B19D2AB02F413DDB33BABF80828A6FEFCABE3

apps/web/tsconfig.tsbuildinfo
018C24B24976726C8837E6C70B57DA982DAE635E98C62BC721F3F63AEF7FF777

apps/web/next-env.d.ts
0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC

prisma/schema.prisma
78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299
```

## 最终门禁

```text
C-6.2-L5:
PASS WITH WARNINGS

Deployment Topology:
PARTIAL

Local Runtime Inventory:
PARTIAL

Production Runtime Inventory:
UNKNOWN

Web Startup Entry Audit:
PARTIALLY VERIFIED

Worker Startup Entry Audit:
PARTIALLY VERIFIED

Legacy Worker:
UNKNOWN

Legacy Scheduler:
UNKNOWN

Legacy Auto Restart:
UNKNOWN

Legacy Drain Protocol:
COMPLETE

Legacy Drain Execution:
NOT EXECUTED

Storage Delete Permissions:
BLOCKED

Runtime Identity Design:
COMPLETE

Release Root Design:
COMPLETE

Production ACL:
NOT VERIFIED

Startup Gate Deployment Enforcement:
DESIGNED / PRODUCTION NOT VERIFIED

Production Trust Root:
NOT CONFIGURED

Production Signing Key:
NOT CONFIGURED

Storage Monitoring Design:
COMPLETE / DB METRICS NOT IMPLEMENTED

Legacy Artifact Removal:
NOT EXECUTED

Production Deployment:
NOT EXECUTED

Production Artifact Status:
UNKNOWN

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```
