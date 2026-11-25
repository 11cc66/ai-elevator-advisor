# P1-3 C-6.2-L8-A2 本机运行环境与部署前安全基线盘点报告

## 1. 执行摘要

- 执行时间：`2026-11-18T23:41:55+08:00` 起
- 计算机：`LAPTOP-34H6Q1OD`
- 当前身份：`LAPTOP-34H6Q1OD\CodexSandboxOffline`
- 项目目录：`D:\thinkbook\Desktop\jieya`
- 最终结论：`PASS WITH WARNINGS`

```text
Local Runtime Inventory:
PARTIAL

Local Process Inventory:
COMPLETE

Local Startup Inventory:
PARTIAL

Local Artifact Inventory:
COMPLETE

Local Storage Inventory:
PARTIAL

Local Startup Gate Audit:
PASS WITH WARNINGS

Production Environment:
NOT DEPLOYED / NOT APPLICABLE

Production Security:
NOT VERIFIED

Production Drain:
NOT APPLICABLE / NOT EXECUTED

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```

本轮只盘点本机开发环境，不能替代未来生产环境证据验证。

## 2. 机器与工具环境

通过 PowerShell/.NET/Node 只读查询：

```text
Windows:
Microsoft Windows NT 10.0.26300.0

Architecture:
AMD64

PowerShell:
7.6.9 Core

CLR:
10.0.14

Node:
v24.22.1

Declared package manager:
pnpm@11.25.0
```

直接执行 `pnpm --version` 在初始沙箱内因读取
`C:\Users\THINKB~1\AppData` 返回 `EPERM`；该失败属于查询环境限制。
版本结论来自 `package.json` 的 `packageManager` 声明，不来自成功执行
`pnpm --version`。

## 3. Git 基线

通过以下只读命令：

```powershell
git --git-dir=<repo>/.git --work-tree=<repo> status --short --branch
git --git-dir=<repo>/.git --work-tree=<repo> rev-parse HEAD
git --git-dir=<repo>/.git --work-tree=<repo> branch --show-current
```

得到：

```text
Repository:
D:/thinkbook/Desktop/jieya

Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

未执行任何 Git 写操作。

## 4. 已有工作树保护记录

执行前工作树：

```text
M apps/web/next-env.d.ts
M apps/web/next.config.ts
M apps/web/package.json
M apps/web/src/modules/files/download-service.ts
M apps/web/src/modules/files/upload-service.ts
M apps/web/src/server/files/storage.ts
M apps/web/tests/e2e/global-setup.ts
M apps/web/tests/integration/phase32-upload-service.test.ts
M apps/web/tests/integration/phase34-file-processing.test.ts
M apps/web/tests/integration/phase35-lease-renewal.test.ts
M apps/web/tests/integration/phase35-processing-reliability.test.ts
M apps/worker/package.json
M apps/worker/src/config.ts
M apps/worker/src/file-maintenance.ts
M apps/worker/src/file-processing.ts
M apps/worker/src/index.ts
M apps/worker/src/storage.ts
M apps/worker/tsconfig.json
M packages/file-storage/src/errors.ts
M packages/file-storage/src/index.ts
M packages/file-storage/src/local-private-storage.ts
M packages/file-storage/tests/local-private-storage.test.ts
M pnpm-lock.yaml
M prisma/schema.prisma

?? apps/web/scripts/build-secure.ts
?? apps/web/scripts/p13-build-audit/
?? apps/web/scripts/p13-db-tests/
?? apps/web/scripts/p13-deployment-evidence/
?? apps/web/scripts/p13-storage-delete-audit/
?? apps/web/scripts/p13-storage-inventory/
?? apps/web/scripts/start-secure.mjs
?? apps/web/src/instrumentation.ts
?? apps/web/src/server/security/
?? apps/web/tests/legacy-cleanup-shutdown.test.ts
?? apps/web/tests/p13-a-migration.test.ts
?? apps/web/tests/p13-b-migration.test.ts
?? apps/web/tests/p13-build-audit.test.ts
?? apps/web/tests/p13-db-tooling.test.ts
?? apps/web/tests/p13-deployment-evidence-bundle.test.ts
?? apps/web/tests/p13-deployment-evidence.test.ts
?? apps/web/tests/p13-release-security.test.ts
?? apps/web/tests/p13-storage-delete-audit.test.ts
?? apps/web/tests/p13-storage-inventory.test.ts
?? apps/worker/scripts/
?? apps/worker/src/security/
?? apps/worker/src/worker-entry.ts
?? apps/worker/tests/legacy-cleanup-shutdown.test.ts
?? apps/worker/tests/storage-capability.test.ts
?? apps/worker/tests/test-worker-entry.ts
?? docs/architecture/
?? packages/build-integrity/
?? packages/file-storage/src/capabilities.ts
?? packages/file-storage/src/legacy-cleanup.ts
?? packages/file-storage/tests/capabilities.test.ts
?? prisma/migrations/
```

本轮除新增本报告外，没有修改源码、测试、Migration 或既有文档。

## 5. L6 / L7 / L8-A 安全约束复核

重新计算：

```text
docs/architecture/file-lifecycle-p13-c6-2-l8a-design.md
ACEBF1B4AF0D16235FEC616B7908DC55AA044759D8FCDDB841C85E4F3A98FFB3

docs/architecture/file-lifecycle-p13-c6-2-l8a-report.md
50E8E11E9C8E08BFED4DA1D1613DF065062B396A58B8D05C1FDDAF29EAE55A6C

docs/architecture/file-lifecycle-p13-c6-2-l8a-admin-evidence-guide.md
57E8964FE4530B3CC4E2DB8C2E4A03236E58DA119DD8C13E5D5FEE72B0BE6B3E

docs/architecture/file-lifecycle-p13-implementation-status.md
AB3C6B1C10AE90BD049CD37C2C5E01C912C4E3D6FF34E4DB3D74812584CC5E13
```

复核结论：

- L6 Storage capability wrapper 和 fail-closed Legacy delete 源码存在；
- Maintenance 不接收 Storage；
- L7 Web/Worker secure launcher 和 Gate 源码存在；
- L8-A Evidence Bundle v2 和离线 Validator 源码存在；
- 当前 `cleanupCapability` 生成和验证均只允许 `DISABLED`；
- Lifecycle Safety Version 常量为 `1.0.0`；
- 未发现已配置的生产 Trust Root/签名 key。

## 6. 本机进程盘点

### 6.1 查询方法

初始沙箱内 `Get-CimInstance Win32_Process` 失败：

```text
HResult = -2146233088
```

使用只读、沙箱外进程查询重试成功。CommandLine 先做以下脱敏：

- password/pwd/token/secret/API key/connection string；
- URL userinfo；
- 非项目进程命令行不输出。

Win32_Process 不提供 Working Directory；该字段标记 `UNKNOWN`。

### 6.2 可见 Node/Next/进程管理器

| PID | Parent PID | Name | Project Related | Evidence |
|---:|---:|---|---|---|
| 23656 | 15484 | `node.exe` | false | Codex Primary Runtime |
| 30652 | 30432 | `node_repl.exe` | false | Codex CUA runtime |
| 30696 | 30432 | `node_repl.exe` | false | Codex CUA runtime |

项目 Web、Next.js、Worker、PM2、Docker、Kubernetes、Nginx 或 IIS Worker 进程：

```text
NOT FOUND IN VISIBLE PROCESS INVENTORY
```

不存在可见的多项目实例或多个 Worker 版本。

### 6.3 端口

```text
3000 LISTENING:
NOT FOUND

3001 LISTENING:
NOT FOUND

5432 LISTENING:
PRESENT / PostgreSQL service
```

本轮没有连接 PostgreSQL。

## 7. Windows 自动启动机制

### 7.1 Services

只读查询 `Get-CimInstance Win32_Service` 成功：

```text
Total services:
331

Project/elevator/jieya/P13/Node/PM2/Docker/Nginx matching services:
0
```

`postgresql-x64-18` 为 Running/Automatic，但它是数据库服务，不是项目 Web/Worker 启动项。

### 7.2 Task Scheduler

`Get-ScheduledTask` 的 CIM 查询失败：

```text
HResult = -2146233079
```

使用 `schtasks /query /fo LIST /v` 只读回退：

```text
ExitCode:
0

TaskCount:
297

Project name/path matches:
0
```

因此 Task Scheduler：

```text
STANDARD TEXT QUERY:
NO PROJECT MATCH

OBJECT/ACTION DETAIL:
PARTIAL / CIM MODULE FAILED
```

### 7.3 Startup folders

| Folder | Entries |
|---|---|
| User Startup | `desktop.ini` only |
| Common Startup | `desktop.ini` only |

未发现 `.lnk`、脚本或项目路径。

### 7.4 Registry Run / RunOnce

检查：

```text
HKCU Run
HKCU RunOnce
HKLM Run
HKLM RunOnce
HKLM WOW6432Node Run
HKLM WOW6432Node RunOnce
```

普通用户/HKLM Run 项只包含 OneDrive、SecurityHealth、Sunlogin、Autodesk 等非项目项。
项目相关项数量为 `0`。WOW6432Node Run/RunOnce 为空。

### 7.5 其他进程管理器

| Tool/Path | Result |
|---|---|
| PM2 command | NOT FOUND |
| Docker command | NOT FOUND |
| Podman | NOT FOUND |
| kubectl | NOT FOUND |
| Nginx | NOT FOUND |
| supervisord | NOT FOUND |
| `%USERPROFILE%\.pm2` | NOT FOUND |
| `C:\ProgramData\Docker` | NOT FOUND |
| WSL executable | PRESENT |

WSL 配置/发行版未启动或查询，标记 `UNKNOWN`。

“工具未安装/未找到”不证明其他 Watchdog、外部任务或隐藏启动机制不存在。

### 7.6 项目内定时/自动重启逻辑

源码证据：

- `apps/worker/src/worker-entry.ts` 注册 PgBoss `*/15 * * * *` Maintenance schedule；
- Worker 启动时立即执行同一 Maintenance；
- `apps/worker/src/lease-heartbeat.ts` 使用内存 `setInterval` 续租；
- Web timeout 仅用于下载/字段 review 响应，不是进程自动重启。

仓库内未发现：

- Windows Service recovery 配置；
- Task Scheduler XML；
- PM2 ecosystem；
- Docker/Kubernetes restart policy；
- systemd unit；
- Supervisor/Watchdog 配置。

## 8. 本机旧构建产物

### 8.1 主产物

| Artifact | Files | Bytes | Last Write UTC | Reparse Entries | P13 Manifest |
|---|---:|---:|---|---:|---|
| `apps/web/.next` | 1,413 | 446,890,260 | 2026-11-16T17:17:29Z | 6 | 0 |
| `apps/worker/dist` | 32 | 135,078 | 2026-11-15T17:08:16Z | 0 | 0 |

### 8.2 其他项目构建目录

| Artifact | Files | Bytes |
|---|---:|---:|
| `packages/contracts/dist` | 4 | 21,366 |
| `packages/file-storage/dist` | 28 | 45,352 |
| `packages/selection-engine/dist` | 4 | 1,452 |
| `packages/shared-ui/dist` | 12 | 4,813 |

以下目录不存在：

```text
apps/web/.p13-releases
apps/web/.p13-build
```

### 8.3 `.next` Reparse Points

`.next` 中共发现 6 个 Reparse Point，全部位于：

```text
apps/web/.next/node_modules
apps/web/.next/dev/node_modules
```

链接目标：

- 项目根 `node_modules/.pnpm/pg@8.23.1/.../pg`；
- 项目根 `node_modules/.pnpm/pino@10.4.0/.../pino`；
- 项目根 `node_modules/.pnpm/@prisma+client@.../client`。

未指向项目外部的可识别链接。未跟随链接读取目标文件正文。

### 8.4 Legacy 删除逻辑静态扫描

扫描 pattern：

```text
removeStaging(
removeObject(
cleanupOrphanObjects(
cleanupTemp(
fs.rm(
fs.unlink(
deleteObject(
```

| Artifact | Matching Files | Matching Lines |
|---|---:|---:|
| `apps/web/.next` | 14 | 121 |
| `apps/worker/dist` | 1 | 4 |

其中：

- Web 有 2 个 production server chunk 和 12 个 dev server chunk 命中；
- Worker 只有 `dist/file-maintenance.js` 命中。

Worker 旧文件包含：

```text
removeStaging
removeObject
cleanupOrphanObjects
cleanupTemp
```

### 8.5 Build Identity

```text
apps/web/.next/BUILD_ID:
LULjk7Rp3QcYPDlFEyycy

BUILD_ID SHA-256:
06955B147BD0009CD09B566531E3D2BC93B77142582145564E219C1530F9F5A1

apps/worker/dist/file-maintenance.js SHA-256:
C6B5B0EBD2AD047CF32AE447470B19D2AB02F413DDB33BABF80828A6FEFCABE3

apps/worker/dist/index.js SHA-256:
D7DF17BC2CF23A7923527648A98FC5AABB8FD36A21D6A0B24EA92F8C1DE5BBB9
```

旧 Worker `dist/index.js` 直接创建 Prisma/PgBoss 并导入旧 Maintenance；
未发现 `runWorkerStartupGate`、`P13_WORKER_RELEASE_ROOT` 或
`verifyStartupRelease`。

旧 `.next` 中未搜索到 Web Startup Gate 标识：

```text
runWebStartupGate
P13_WEB_RELEASE_ROOT
STARTUP_CONFIGURATION_MISSING
verifyStartupRelease
```

结论：

```text
apps/web/.next:
LEGACY / NO P13 MANIFEST / GATE MARKERS NOT FOUND / DIRECT START RISK

apps/worker/dist:
LEGACY / NO P13 MANIFEST / NO STARTUP GATE / DELETE MARKERS PRESENT
```

旧产物没有被现有 package build/start scripts 引用，但文件仍在磁盘上，可由手工命令启动。

## 9. 启动入口安全矩阵

| 类型 | 入口 | Gate 保护 | 绕过风险 | 证据 |
|---|---|---|---|---|
| 当前源码 Web build | `apps/web/scripts/build-secure.ts` | Signed manifest | 低 | source + tests |
| 当前源码 Web start | `apps/web/scripts/start-secure.mjs` | Release Gate | 低 | package start |
| Next Node production | `apps/web/src/instrumentation.ts` | 第二层 Gate | 低 | source |
| Web dev | `next dev` | 否 | 仅开发 | `apps/web/package.json` |
| Web direct | `next start` 手动 | 旧 `.next` 不保证 | HIGH | old artifact no Gate marker |
| 当前源码 Worker build | `apps/worker/scripts/build-secure.ts` | Signed manifest | 低 | source |
| Worker start | `apps/worker/scripts/start-secure.mjs` | Release Gate | 低 | package start |
| Worker index | `apps/worker/src/index.ts` | Gate + dynamic import | 低 | source |
| Worker business entry | `worker-entry.ts` 直接启动 | 无外部 Gate | HIGH | source |
| 旧 Worker | `node apps/worker/dist/index.js` | 否 | CRITICAL | old dist |
| Test Worker | `tests/test-worker-entry.ts` | Test only | 生产禁止 | E2E setup |

当前本机实际项目入口：

```text
NO RUNNING PROJECT ENTRY
```

## 10. Build Integrity / Manifest / Trust Root

源码已实现：

- Source/Artifact/Runtime Dependency Digest；
- Ed25519 signed manifest；
- Strict JSON / canonical JSON；
- Trusted key ID；
- Lifecycle Safety Version；
- `cleanupCapability=DISABLED`；
- Legacy marker scan；
- Web/Worker Startup Gate；
- Release/Runtime/Trust Root 父路径 Reparse Point 拒绝；
- Trust Root/Manifest 读取身份稳定性检查。

关键源码 SHA-256：

```text
apps/web/scripts/build-secure.ts
4E68CF54C91E0CE6089409FF92C487E574F395FDB6A763B77040EAE55B683051

apps/web/scripts/start-secure.mjs
F7E60F47C9462C6C438AFF102E6155941E0B9949D9D14DC202C4B4C836CA17DF

apps/web/src/instrumentation.ts
034681C379E473CD7438E490BDD6B43124CC4AECB2E59A9FEBD2F95E20B3FCE3

apps/web/src/server/security/startup-gate.ts
0AE7E4D02D1CCF172C935B48663CF2F5A9A4BE3F286410344B865743A6156A86

apps/worker/scripts/build-secure.ts
C05430FC86DFCEFE81F72357DE25011939F8161F6C5611B172E33B770C561D82

apps/worker/scripts/start-secure.mjs
985A2B795206784B48971BCD706B84926F34474E2895DEEFCD620C762CF8B953

apps/worker/src/index.ts
C01A2F6848B29D66C798F7F534C729FA9AB65788FEAB4CD5E892AD58BBC8F48D

apps/worker/src/security/startup-gate.ts
98C4B6CE8BC0FFA30DF871D6D55D5EA036B8CF8FEE7B9F2BB5E695B0C4BADF98

packages/build-integrity/src/index.mjs
34963943ED25155B79CFF504D147B620FA3BD58CC47631189FC6F679812E838D
```

本机状态：

```text
Trust Root production config:
NOT CONFIGURED / NOT FOUND IN REPO

Signing private key:
NOT READ / NOT CREATED

Signed local release:
NOT PRESENT

apps/web/.p13-releases:
NOT FOUND

Installation-specific Trust Root:
NOT FOUND
```

仓库只存在测试/模板：

```text
apps/web/scripts/p13-deployment-evidence/verification-trust.template.json
```

这不构成 Trust Root 配置。

## 11. 本机 Storage

### 11.1 目录与规模

仅检查 `D:\thinkbook\Desktop\jieya\storage`，未读取文件正文。

| Path | Files | Bytes | Reparse | staging/objects/temp |
|---|---:|---:|---|---|
| `storage` | 8 | 2,877 | 0 | N/A |
| `storage/private` | 1 | 1 | 0 | all absent |
| `storage/private-test` | 7 | 2,876 | 0 | all absent |

`storage/private` 当前没有：

```text
staging/
objects/
temp/
```

未发现 Storage Reparse Point。

### 11.2 当前身份

```text
Identity:
LAPTOP-34H6Q1OD\CodexSandboxOffline

User SID:
S-1-5-21-1861005943-12376289-3718241203-1009

Administrator:
NO

NTLM authenticated:
YES
```

当前用户属于：

```text
LAPTOP-34H6Q1OD\CodexSandboxUsers
BUILTIN\Users
```

`CodexSandboxUsers` 成员：

```text
CodexSandboxOffline
CodexSandboxOnline
```

### 11.3 ACL

| Path | Owner | Effective/runtime ACEs |
|---|---|---|
| Project root | `thinkbook` | `CodexSandboxUsers:(OI)(CI)(M)`; 两个未解析 SID `(M)`; thinkbook/Admin/System Full |
| `storage` | `CodexSandboxOffline` | inherited `CodexSandboxUsers:(M)`; 两个未解析 SID `(M)`; thinkbook/Admin/System Full |
| `storage/private` | `CodexSandboxOffline` | inherited `CodexSandboxUsers:(M)`; two unresolved SIDs `(M)`; thinkbook/Admin/System Full |
| `storage/private-test` | `thinkbook` | inherited `CodexSandboxUsers:(M)`; two unresolved SIDs `(M)`; thinkbook/Admin/System Full |

`M / Modify` 包含删除能力。当前用户属于 `CodexSandboxUsers`，因此：

```text
应用 Capability:
DELETE fail-closed

当前 OS ACL:
当前沙箱用户组具有 Modify，可删除
```

这是本机开发环境风险。代码 fail-closed 不等于 OS ACL 已收敛。

### 11.4 父目录继承

```text
D:\:
Authenticated Users Modify

D:\thinkbook:
InheritanceProtected = true
No inherited Authenticated Users Modify

D:\thinkbook\Desktop:
Owner thinkbook
System/Admin/thinkbook Full

Project root:
InheritanceProtected = false
Explicit CodexSandboxUsers and unresolved SID Modify
```

D 盘根的宽 `Authenticated Users:(M)` 没有继续传播到项目路径，因为
`D:\thinkbook` 显式保护了继承。但项目根部重新加入了 `CodexSandboxUsers:(M)`。

两个 Modify SID：

```text
S-1-5-21-652459337-344731690-428846000-3930787116
S-1-5-21-3814418237-1796301655-2125238568-1544361098
```

在当前离线环境中无法解析为本地 NTAccount，标记 `UNKNOWN PRINCIPAL`。

### 11.5 当前权限解释限制

- 未执行创建/重命名/删除测试；
- 只根据 ACE 和组成员关系解释权限；
- 未修改 ACL；
- 未读取文件正文；
- 未访问项目外 Storage。

## 12. 外部部署配置

仓库文件扫描未发现：

- Dockerfile / Compose；
- Kubernetes / Helm；
- Terraform / Pulumi / Ansible；
- GitHub/GitLab/Jenkins/Azure CI；
- PM2 ecosystem；
- systemd unit；
- Windows Service 项目配置。

这类配置在本机标准启动机制中也未发现；不能推断其他用户、WSL、远程主机或未安装工具不存在。

## 13. 风险分类

### A. 本机已验证安全

- 当前无项目 Web/Worker 进程；
- 当前无项目标准 Service；
- 当前无项目 Task Scheduler 匹配；
- 当前无项目 Startup/Run key；
- Web/Worker package start 指向 secure wrapper；
- 当前源码 `cleanupCapability=DISABLED`；
- 当前 Storage 无 Reparse Point；
- 本轮未发现项目外部部署配置。

### B. 本机存在风险

| 风险 | 级别 | 原因 |
|---|---|---|
| 旧 `.next` 保留删除实现 | HIGH | 14 files / 121 marker lines |
| 旧 Worker `dist` 保留删除实现 | CRITICAL | old maintenance delete calls |
| 旧 `.next` direct start 绕过 Gate | HIGH | old artifact 无 Gate marker |
| 旧 Worker `dist` direct start 绕过 Gate | CRITICAL | old index 直接启动 Prisma/PgBoss |
| Storage OS ACL 允许 CodexSandboxUsers Delete | HIGH | Modify ACE |
| 两个未解析 Modify SID | UNKNOWN/HIGH | 无法确认身份 |
| 当前用户是 `storage/private` Owner | MEDIUM | Owner 可影响 DACL |
| 共享沙箱用户组 | MEDIUM | Offline/Online 均 Modify |
| Web dev 使用普通 `.next` | MEDIUM | 开发入口无 production Gate |

### C. 源码已实现但本机未验证

- signed release build；
- Trust Root production config；
- Release Root 独立 immutable ACL；
- Web/Worker secure start injection；
- Runtime Dependency Closure；
- Ed25519 production signature；
- OS account separation；
- Storage delete ACL denial；
- Startup Gate after restart。

本轮未执行 Build、测试或启动。

### D. 本机未知

- WSL 发行版/容器是否配置项目服务；
- 第三方隐藏 Watchdog；
- 两个未解析 SID 的真实身份；
- 项目启动时的实际 Working Directory；
- `CodexSandboxOnline` 是否可用于项目运行；
- 其他用户 Scheduler。

### E. 未来生产环境

```text
Production Environment:
NOT DEPLOYED / NOT APPLICABLE

Production Security:
NOT VERIFIED
```

不能将本机 ACL、进程或启动结果作为生产证据。

## 14. 未来正式部署前必要条件

1. 使用独立 Build/Release Signer/Web/Worker/Maintenance 身份；
2. 配置生产 Trust Root 和 KMS/HSM 签名；
3. Release Root 独立于源码并禁止 Runtime 写/删除/改 ACL；
4. Storage ACL 明确删除 Web/Worker/Maintenance Delete；
5. 禁止共享运行身份；
6. 启动命令只指向 secure launcher；
7. 禁止 direct `next start`、`node dist/index.js`、worker-entry；
8. 自动重启/Scheduler/Watchdog 只引用 CURRENT signed release；
9. 删除或隔离旧 Artifact 前必须获得生产级审批；
10. 生成 L8-A signed Evidence Bundle；
11. 两名独立管理员审批；
12. 完成真实 Windows/Container ACL 验证。

## 15. 未执行项目

```text
No project Web/Worker start
No process kill/stop/restart
No service/task/registry change
No database connection
No SQL/Migration
No test/build/typecheck
No E2E/integration
No Storage content read
No Storage delete
No Cleanup
No ACL/owner change
No file creation/deletion in project
No Git write
No historical artifact removal
```

## 16. 最终验收

```text
Local Runtime Inventory:
PARTIAL

Local Process Inventory:
COMPLETE

Local Startup Inventory:
PARTIAL

Local Artifact Inventory:
COMPLETE

Local Storage Inventory:
PARTIAL

Local Startup Gate Audit:
PASS WITH WARNINGS

Legacy Artifact Risk:
PRESENT / HIGH TO CRITICAL

Production Environment:
NOT DEPLOYED / NOT APPLICABLE

Production Security:
NOT VERIFIED

Production Drain:
NOT APPLICABLE / NOT EXECUTED

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```

本报告只是本机开发环境盘点，不能替代未来生产环境 Evidence Bundle、Trust Root、Runtime Identity、ACL 和启动入口验证。
