# P1-3 C-6.2-L8-A3 Legacy Artifact 可达性与本机权限专项复核

## 1. 执行摘要

- 执行日期：`2026-11-19`
- 项目目录：`D:\thinkbook\Desktop\jieya`
- 当前分支：`feature/p1-3-storage-lifecycle-schema`
- 当前 HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 结论：`PASS WITH CRITICAL FINDINGS`

```text
Web Legacy Artifact Reachability:
VERIFIED

Worker Legacy Entry:
VERIFIED

Worker Gate Bypass:
CONFIRMED

Windows SID Resolution:
PARTIAL

Effective ACL:
PARTIAL

Startup Inventory:
COMPLETE

Storage Inventory:
PARTIAL

Critical Findings:
2

High Findings:
4

Production Environment:
NOT DEPLOYED

Production Security:
NOT VERIFIED

Production Drain:
NOT APPLICABLE

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```

本轮未运行任何旧 Artifact、Build、测试、数据库、Migration、Cleanup 或物理删除。

## 2. 基线核验

使用只读 Git 命令：

```powershell
git --git-dir=<repo>/.git --work-tree=<repo> status --short --branch
git --git-dir=<repo>/.git --work-tree=<repo> rev-parse HEAD
git --git-dir=<repo>/.git --work-tree=<repo> branch --show-current
```

结果与 L8-A2 一致：

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

L8-A2 报告 SHA-256：

```text
FF84050850D4B1EF126A381CEB5C6EE48C8765FCB9AF04F82D15F25917C11475
```

预期和实际一致。

工作树仍为相同的未提交修改状态，包括：

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
```

以及此前已报告的未跟踪源码、测试、Migration 和架构文档。

本轮除新增本报告外，没有修改任何文件。

## 3. 查询方法

本轮使用：

- 只读 Git 命令；
- PowerShell `Get-Process` / `Get-CimInstance`；
- `Get-Service`；
- 沙箱外只读 `Get-ScheduledTask`；
- `schtasks /query`；
- `wsl --list --verbose`；
- `icacls` / `Get-Acl`；
- `whoami /user`、`whoami /groups`、`whoami /priv`；
- 只读文件元数据；
- Source Map `sources/sourcesContent`；
- `rg` 静态扫描；
- SHA-256。

未执行文件内容上传、命令替换或旧 Artifact。

## 4. Web `.next` 计数复核

### 4.1 计数口径

L8-A2：

```text
14 files
121 matching text lines
```

本轮精确 regex occurrence 复核：

```text
14 files
124 marker occurrences
```

差异原因：

- L8-A2 计数按 `rg -n` 文本行；
- 生产 chunk 经过压缩，同一行包含多个调用/定义；
- 本轮按每个 regex occurrence 计数；
- Artifact 文件未被修改。

### 4.2 生产 chunk

| Chunk | Text Lines | Exact Occurrences |
|---|---:|---:|
| `server/chunks/[root-of-the-server]__0e5-f2rdyijtd._.js` | 2 | 4 |
| `server/chunks/[root-of-the-server]__0jh743w8n5ftu._.js` | 1 | 9 |

### 4.3 Dev chunk

| Chunk | Text Lines | Exact Occurrences |
|---|---:|---:|
| `dev/server/chunks/__01_vjzzhsqqvw` | 9 | 9 |
| `dev/server/chunks/__01j22t-1xujdm` | 8 | 8 |
| `dev/server/chunks/__0awh6iq4j195g` | 8 | 8 |
| `dev/server/chunks/__0kr6co_vdqm_x` | 13 | 13 |
| `dev/server/chunks/__0krg186ya2fdd` | 13 | 13 |
| `dev/server/chunks/__0s9s65ycugfhp` | 9 | 9 |
| `dev/server/chunks/__1468bd-2y75x2` | 9 | 9 |
| `dev/server/chunks/__17vfk3m8dxu6o` | 9 | 9 |
| `dev/server/chunks/__1bed_0sebqhj0` | 9 | 9 |
| `dev/server/chunks/__1n9wn5zdnfmnw` | 13 | 13 |
| `dev/server/chunks/__1rm-3bbo-7ulr` | 9 | 9 |
| `dev/server/chunks/__1s18bfj2183ip` | 9 | 9 |

相对路径前缀：

```text
apps/web/.next/dev/server/chunks/[root-of-the-server]
```

## 5. Web 生产危险代码逐项分析

### 5.1 路由可达性

生产 route loader：

```text
apps/web/.next/server/app/api/projects/[projectId]/files/upload-intents/route.js
apps/web/.next/server/app/api/projects/[projectId]/files/upload-intents/[intentId]/content/route.js
```

两者分别加载：

```text
server/chunks/[root-of-the-server]__0e5-f2rdyijtd._.js
server/chunks/[root-of-the-server]__0jh743w8n5ftu._.js
```

Source Map：

```text
0e5 map:
apps/web/src/modules/files/upload-service.ts
apps/web/src/server/jobs/file-recognition-queue.ts

0jh map:
apps/web/src/server/files/storage.ts
packages/file-storage/src/local-private-storage.ts
packages/file-storage/src/file-type.ts
packages/file-storage/src/filename.ts
```

### 5.2 Upload Intent POST 路径

旧构建 Source Map 中的原始路由：

```text
apps/web/src/app/api/projects/[projectId]/files/upload-intents/route.ts
```

关键行：

```text
22: export async function POST(...)
35: requireProjectPermission(...)
40: assertSameOrigin(request)
55: const intent = await createUploadIntent(...)
```

调用链：

```text
POST /api/projects/{projectId}/files/upload-intents
  -> requireApiActor
  -> requireProjectPermission(FILE_UPLOAD)
  -> assertSameOrigin
  -> createUploadIntent
  -> cleanupExpiredUploadIntents
  -> storage.removeStaging
  -> storage.removeObject
```

旧 `upload-service.ts` Source Map 原始行：

```text
147: cleanupExpiredUploadIntents(...)
176: await storage.removeStaging(intent.stagingKey)
181: await storage
182:   .removeObject(intent.objectStorageKey)
200: createUploadIntent(...)
220: await cleanupExpiredUploadIntents(storage)
```

结论：

```text
STATIC CALL CHAIN:
VERIFIED

REACHABILITY:
Authenticated FILE_UPLOAD user + same-origin POST

CLASSIFICATION:
ACTIVE PHYSICAL DELETE PATH
```

### 5.3 Upload Content PUT 路径

旧构建原始 route：

```text
apps/web/src/app/api/projects/[projectId]/files/upload-intents/[intentId]/content/route.ts
```

关键行：

```text
18: export async function PUT(...)
37: requireProjectPermission(...)
42: assertSameOrigin(request)
60: const completed = await completeUpload({...})
```

旧 `completeUpload()`：

```text
314: completeUpload(...)
428: let stagingCleanup = true
641: catch (error)
643: input.storage.removeObject(objectKey)
646: input.storage
647:   .removeStaging(intent.stagingKey)
```

调用链：

```text
PUT /api/projects/{projectId}/files/upload-intents/{intentId}/content
  -> requireApiActor
  -> requireProjectPermission(FILE_UPLOAD)
  -> assertSameOrigin
  -> completeUpload
  -> catch on upload/DB/queue failure
  -> removeObject
  -> removeStaging
```

结论：

```text
STATIC CALL CHAIN:
VERIFIED

REACHABILITY:
Authenticated FILE_UPLOAD user + same-origin PUT + failure after objectKey

CLASSIFICATION:
ACTIVE FAILURE-PATH PHYSICAL DELETE
```

### 5.4 Storage 删除实现

旧 `packages/file-storage/src/local-private-storage.ts`：

```text
165: writeToStaging
212: fs.rm(filePath, { force: true })       // partial staging write failure
252: removeStaging
253: fs.rm(resolveKey(...), { force: true })
256: removeObject
257: fs.rm(resolveKey(...), { force: true })
547: cleanupOrphanObjects
594: fs.rm(objectPath, { force: true })
605: cleanupTemp
640: fs.rm(entryPath, { recursive: true, force: true })
```

这些不是字符串或死代码，而是旧 Bundle 内实际类实现。

### 5.5 Orphan / Temp 可达性

生产 `server` 目录中：

```text
cleanupOrphanObjects:
definition only in 0jh storage chunk

cleanupTemp:
definition only in 0jh storage chunk
```

生产 route Source Map 中没有 `runFileMaintenance` 或 Worker Maintenance 实现。

分类：

```text
cleanupOrphanObjects:
DEFINED / NO STATIC SERVER-ROUTE CALLER FOUND / UNKNOWN FOR ARBITRARY IN-PROCESS CODE

cleanupTemp:
DEFINED / NO STATIC SERVER-ROUTE CALLER FOUND / UNKNOWN FOR ARBITRARY IN-PROCESS CODE
```

但在同一个 server runtime 内，任何可执行代码仍可取得该类并调用方法，因此不能标记为整体不可达。

### 5.6 Web 与 Worker 代码混入

对 `.next` 全目录只读搜索：

```text
apps/worker/src
worker-entry
runFileMaintenance
```

结果：

```text
NOT FOUND
```

`FILE_MAINTENANCE_QUEUE` 常量存在于部分 chunk，但其来源是 contracts，不代表 Worker Maintenance 实现被打入 Web。

结论：

```text
Web .next bundles old Storage/Upload cleanup.
No Worker Maintenance implementation mixed into Web server bundle.
```

## 6. Web 直接启动与 Gate

当前工作树：

```text
apps/web/package.json start =
node scripts/start-secure.mjs
```

但 `git show HEAD:apps/web/package.json`：

```text
start = next start
build = next build
```

因此：

- 当前 dirty worktree 的受支持 start 已安全；
- HEAD 本身仍含 unsafe direct start；
- 安全修复尚未提交；
- 任何只取 HEAD、不带当前工作树修改的部署会重新暴露 direct start。

旧 `.next` 搜索：

```text
runWebStartupGate
P13_WEB_RELEASE_ROOT
STARTUP_CONFIGURATION_MISSING
verifyStartupRelease
```

均未找到；旧 Build 也没有：

```text
server/instrumentation.js
```

且不存在：

```text
p13-build-manifest.json
trusted-keys.json
.p13-releases
```

分类：

```text
Direct next start against apps/web/.next:
POSSIBLE / NO CURRENT PROCESS / NO GATE IN ARTIFACT
```

## 7. Dev Chunk 分类

12 个 dev chunk 均包含旧 upload/storage code 的副本：

- 4 个文件同时包含 upload cleanup 与 Storage 四个删除方法；
- 其余文件包含 upload cleanup、removeStaging/removeObject 或 Storage 方法的子集；
- 这些文件不是 Web server route 的生产 chunk；
- 当前没有运行 `next dev`；
- Dev 目录没有独立可执行入口；
- 直接加载内部 Turbopack chunk 不是受支持入口；
- 运行 `next dev` 会重新编译，不能证明会直接执行这些旧 chunk。

分类：

```text
DEV CACHE / LATENT OLD CODE / NOT A STANDALONE ENTRY / EXECUTION UNKNOWN IF FORCED
```

## 8. Web 可达性矩阵

| ID | File | Line(s) | Function / Call | Classification |
|---|---|---|---|---|
| W-P-01 | `server/.../__0e5-f2rdyijtd` | 1 | `cleanupExpiredUploadIntents -> removeStaging/removeObject` | ACTIVE / ROUTE REACHABLE |
| W-P-02 | `server/.../__0e5-f2rdyijtd` | 5 | `completeUpload catch -> removeObject/removeStaging` | ACTIVE / FAILURE REACHABLE |
| W-P-03 | `server/.../__0jh743w8n5ftu` | 1 | write failure + four Storage delete methods | ACTIVE IMPLEMENTATION |
| W-D-01 | `dev/.../__01_vjzzhsqqvw` | 1420,1449-1455,1561,1599,1610,1640 | old upload/storage copies | DEV CACHE |
| W-D-02 | `dev/.../__01j22t-1xujdm` | 588,865-868,1389,1418-1424 | old upload/storage copies | DEV CACHE |
| W-D-03 | `dev/.../__0awh6iq4j195g` | 601,878-881,1275,1304-1310 | old upload/storage copies | DEV CACHE |
| W-D-04 | `dev/.../__0kr6co_vdqm_x` | 639-641,988-991,1721,1750-1756,1913-1992 | upload + all storage methods | DEV CACHE |
| W-D-05 | `dev/.../__0krg186ya2fdd` | 654-656,1003-1006,1563-1654 | upload + all storage methods | DEV CACHE |
| W-D-06 | `dev/.../__0s9s65ycugfhp` | 1437-1472,1578-1657 | old upload/storage copies | DEV CACHE |
| W-D-07 | `dev/.../__1468bd-2y75x2` | 597-599,890-893,1273-1308 | old upload/storage copies | DEV CACHE |
| W-D-08 | `dev/.../__17vfk3m8dxu6o` | 1674-1709,1866-1945 | old upload/storage copies | DEV CACHE |
| W-D-09 | `dev/.../__1bed_0sebqhj0` | 1216-1251,1266-1345 | old upload/storage copies | DEV CACHE |
| W-D-10 | `dev/.../__1n9wn5zdnfmnw` | 654-656,1003-1006,1709-1980 | upload + all storage methods | DEV CACHE |
| W-D-11 | `dev/.../__1rm-3bbo-7ulr` | 584-586,877-880,1387-1422 | old upload/storage copies | DEV CACHE |
| W-D-12 | `dev/.../__1s18bfj2183ip` | 1006-1097 | old upload/storage copies | DEV CACHE |

## 9. Worker `dist` 专项

### 9.1 入口与 Gate

`apps/worker/dist/index.js`：

```text
2: import { PrismaClient } from "@prisma/client"
3: import { PgBoss } from "pg-boss"
4: readWorkerEnv
5: runFileMaintenance
11: async function startWorker
140: startWorker().catch(...)
```

不存在：

```text
runWorkerStartupGate
verifyStartupRelease
P13_WORKER_RELEASE_ROOT
worker-entry dynamic import
```

结论：

```text
node apps/worker/dist/index.js
  -> no Gate
  -> readWorkerEnv
  -> PrismaClient
  -> PgBoss
  -> create queues
  -> register Maintenance
  -> schedule */15
  -> immediate runFileMaintenance
```

Worker Gate Bypass：`CONFIRMED`。

### 9.2 旧 Maintenance

`apps/worker/dist/index.js`：

```text
88-95: boss.work(FILE_MAINTENANCE_QUEUE, runFileMaintenance)
97: schedule("*/15 * * * *")
98-103: immediate runFileMaintenance
```

`apps/worker/dist/file-maintenance.js`：

```text
178: fileUploadIntent.findMany(expired/stale)
219-220: storage.removeStaging
224-225: storage.removeObject
271: storage.cleanupOrphanObjects
272: storage.cleanupTemp
```

### 9.3 当前本地依赖解析

`apps/worker/dist/storage.js`：

```text
import { LocalPrivateStorage } from "@elevator/file-storage"
new LocalPrivateStorage(root)
```

`apps/worker/node_modules/@elevator/file-storage` 当前为 Junction：

```text
Target:
D:\thinkbook\Desktop\jieya\packages\file-storage
```

当前包 `dist/local-private-storage.js`：

```text
removeStaging:
NOT PRESENT

removeObject:
NOT PRESENT

cleanupOrphanObjects:
NOT PRESENT

cleanupTemp:
NOT PRESENT
```

当前 `dist/local-private-storage.js` SHA-256：

```text
45E41A1B92C0D359A982712EA210FEA890DE9094995B606B49D1588232E0AFA6
```

因此当前本地静态解析结果：

```text
Old Worker direct start:
Gate bypass CONFIRMED

Physical delete method call:
EXPECTED TO FAIL because current LocalPrivateStorage has no delete methods

Database/PgBoss side effects:
POSSIBLE before failure
```

本轮未执行 Worker，无法确认运行时具体异常点和退出路径，标记：

```text
PHYSICAL DELETE CURRENT RUNTIME RESULT:
FAIL-CLOSED BY DEPENDENCY REMOVAL / NOT EXECUTED
```

若旧 Worker 在另一个仍安装旧 `file-storage` 的环境运行，删除路径会重新成立。

### 9.4 脚本与引用

当前工作树：

```text
apps/worker/package.json start =
node scripts/start-secure.mjs
```

`git show HEAD:apps/worker/package.json`：

```text
start = node dist/index.js
```

仓库脚本、Service、Task Scheduler、Startup、Run key 未发现旧 `dist` 引用。

文档仍明确把旧 `dist` 描述为历史高风险 Artifact；这些是说明，不是执行入口。

### 9.5 Worker 风险矩阵

| 项目 | 结论 |
|---|---|
| `dist/index.js` 可直接启动 | CONFIRMED |
| Signature/Startup Gate | ABSENT |
| 旧 Maintenance 自动 schedule | PRESENT |
| 启动立即 Maintenance | PRESENT |
| 静态调用四个删除 | PRESENT |
| 当前本地依赖存在删除方法 | NO |
| 当前本地物理删除 | FAIL-CLOSED（静态推断，未执行） |
| 旧依赖环境物理删除 | UNKNOWN / 高风险 |
| 当前 package start 引用旧 dist | NO |
| HEAD package start 引用旧 dist | YES |
| OS 自动启动引用旧 dist | NO MATCH |

## 10. Windows SID 与身份

### 10.1 当前身份

```text
Name:
LAPTOP-34H6Q1OD\CodexSandboxOffline

User SID:
S-1-5-21-1861005943-12376289-3718241203-1009

Authentication:
NTLM

Medium Mandatory Level
```

权限：

```text
Administrators:
NO

Enabled privilege:
SeChangeNotifyPrivilege only
```

### 10.2 身份类型

`Get-LocalUser` 显示：

```text
CodexSandboxOffline:
Enabled / Local / SID ...-1009

CodexSandboxOnline:
Enabled / Local / SID ...-1010

thinkbook:
Enabled / Local / SID ...-1001
```

`Get-LocalGroup`：

```text
CodexSandboxUsers:
SID ...-1008

Members:
LAPTOP-34H6Q1OD\CodexSandboxOffline
LAPTOP-34H6Q1OD\CodexSandboxOnline
```

结论：

- `CodexSandboxOffline` 和 `CodexSandboxUsers` 是真实本地账户/组；
- 它们属于 Codex 沙箱专用身份，不等同于用户正常登录身份；
- `CodexSandboxOnline` 是同一沙箱组的另一个已启用账户；
- 如何创建、生命周期和删除策略：`UNKNOWN`。

### 10.3 未解析 SID

项目 ACL：

```text
S-1-5-21-652459337-344731690-428846000-3930787116
S-1-5-21-3814418237-1796301655-2125238568-1544361098
```

只读查询：

- `NTAccount.Translate()`：UNRESOLVED；
- 本地用户 SID 列表：不匹配；
- 本地组 SID 列表：不匹配；
- SID domain 与当前 LAPTOP SID 不同。

不能把它们认定成恶意账户。它们可能是：

- 沙箱虚拟/虚拟化身份；
- 历史机器或域 SID；
- 已删除或不可解析主体；
- 其他安全上下文。

状态：

```text
UNKNOWN PRINCIPALS / MODIFY ACE
```

## 11. ACL 与有效权限

### 11.1 父目录

```text
D:\
  Authenticated Users: Modify
  Authenticated Users: inherit-only Modify

D:\thinkbook
  InheritanceProtected = true
  System / Administrators / thinkbook FullControl
  special Application SID Traverse

D:\thinkbook\Desktop
  inherited System / Administrators / thinkbook FullControl
```

D 盘根宽权限没有传播到 `D:\thinkbook`，因为继承在 `D:\thinkbook` 被保护。

### 11.2 项目与 Storage

| Path | Owner | Inheritance Protected | Relevant rights |
|---|---|---:|---|
| `jieya` | `thinkbook` | false | `CodexSandboxUsers:(OI)(CI)(M)`; unresolved SID M; inherited thinkbook/Admin/System F |
| `storage` | `CodexSandboxOffline` | false | inherited `CodexSandboxUsers:(M)`; unresolved SID M; inherited thinkbook/Admin/System F |
| `storage/private` | `CodexSandboxOffline` | false | inherited `CodexSandboxUsers:(M)`; unresolved SID M; inherited thinkbook/Admin/System F |
| `storage/private-test` | `thinkbook` | false | same inherited M/F set |

当前用户属于 `CodexSandboxUsers`，所以对三个路径至少有：

```text
Read / Write / Create / Rename / Delete / Execute-like Modify
```

ACL 没有直接给 current user `WRITE_DAC`；但 `storage/private` owner 是 current user，Owner 对 DACL 的实际能力需要专门测试。本轮未修改，也未进行写入探测。

### 11.3 Storage 路径

```text
storage/private:
  1 file / 1 byte / 0 reparse
  staging absent
  objects absent
  temp absent

storage/private-test:
  7 files / 2,876 bytes / 0 reparse
  staging absent
  objects absent
  temp absent
```

源码默认值和文档：

```text
apps/web/src/server/env.ts
apps/worker/src/config.ts
docs/PHASE3_2_PRIVATE_UPLOAD.md
```

Web/Worker 默认：

```text
storage/private
```

Test：

```text
storage/private-test
```

实际 `.env` 可以设置绝对路径，但本轮禁止读取 `.env`，所以：

```text
Actual configured PRIVATE_STORAGE_ROOT:
UNKNOWN

Known repo-local default roots:
VERIFIED
```

### 11.4 路径逃逸

当前源码：

- 拒绝绝对 key；
- 拒绝 `..`；
- resolve 后检查 root prefix；
- Test Storage 使用 fixed `storage/private-test` 和 symlink/realpath guard。

旧 Web bundle：

- `#resolveKey` 有字符串边界校验；
- 旧 delete 方法在删除前不做 Reparse Point/identity 检查；
- 旧 `cleanupTemp` 使用 `stat`，然后 `fs.rm(..., recursive:true)`；
- 当前 Storage 目录没有 Reparse Point，因此当前本地不存在已观察到的路径逃逸。

## 12. Startup Inventory 补充

### 12.1 进程

只读 `Win32_Process`：

```text
Node-related processes: 3
Project-related processes: 0
```

详细：

| PID | PPID | Name | Project Related |
|---:|---:|---|---|
| 23656 | 15484 | `node.exe` | false |
| 30696 | 30432 | `node_repl.exe` | false |
| 30652 | 30432 | `node_repl.exe` | false |

### 12.2 Services

```text
Win32_Service total: 331
Project/elevator/jieya/P13 path/name match: 0
```

PostgreSQL service running/automatic，但不是项目启动入口。

### 12.3 Task Scheduler

沙箱内 `Get-ScheduledTask` 曾失败；沙箱外重试成功：

```text
CIM task count: 210
Project match: 0
```

`schtasks /query /fo LIST /v`：

```text
ExitCode: 0
TaskName lines: 297
Project name/path match: 0
```

两者任务总数不同，说明 provider/可见范围或文本格式存在差异；两者均未发现项目匹配。

### 12.4 Startup / Run

```text
User Startup: desktop.ini only
Common Startup: desktop.ini only
HKCU/HKLM Run/RunOnce: no project
WOW6432Node Run/RunOnce: empty
```

### 12.5 WSL 与其他管理器

```text
wsl.exe: PRESENT
wsl --list --verbose: exit 1
Installed Linux distribution: NOT INSTALLED
```

PM2、Docker、Podman、kubectl、Nginx、Supervisor：

```text
NOT FOUND
```

`%USERPROFILE%\.pm2` 和 `ProgramData Docker`：

```text
NOT FOUND
```

### 12.6 项目自身定时逻辑

源码：

```text
apps/worker/src/worker-entry.ts:47
  boss.schedule(FILE_MAINTENANCE_QUEUE, "*/15 * * * *")

apps/worker/src/lease-heartbeat.ts:33
  setInterval
```

前者只在 Worker 启动后注册 PgBoss 调度，不是 OS 启动项；后者只是已运行 Worker 内的租约心跳。

### 12.7 Startup 结论

可发现的本地标准启动机制中：

```text
Project auto start:
NOT FOUND

Project auto restart:
NOT FOUND

External/out-of-band scheduler:
UNKNOWN，不能由本机标准清单排除
```

Startup Inventory：`COMPLETE`（本地可访问标准机制）。

## 13. 风险评级

### Critical Findings: 2

#### C-01：旧 Web 生产 Bundle 存在路由可达的物理删除

证据：

- 生产 route 加载 `0e5` 与 `0jh`；
- `createUploadIntent -> cleanupExpiredUploadIntents -> removeStaging/removeObject`；
- `completeUpload` catch -> removeObject/removeStaging；
- 这些函数直接调用 `fs.rm`；
- 旧 build 无 P13 Manifest、无 Gate marker；
- HEAD Web `start` 仍为 `next start`。

实际触发前提：

```text
手工启动旧 .next
且配置有效 DB/Storage
且执行 authenticated same-origin upload request/failure
```

当前无运行实例。风险级别不因此降低，因为 Artifact 和历史脚本仍可执行。

#### C-02：旧 Worker 可绕过 Startup Gate

证据：

- `dist/index.js` 无 Gate；
- 直接调用 `startWorker()`；
- 创建 Prisma/PgBoss；
- 注册并立即运行旧 Maintenance；
- Maintenance 含四个 delete 调用。

当前 mitigation：

- 当前本地 `@elevator/file-storage` 不含删除方法；
- 旧 Worker 删除调用当前本地预计失败；
- 但 Gate bypass 和 DB/PgBoss side effects 已确认。

### High Findings: 4

#### H-01：安全启动脚本修复只在未提交工作树

HEAD：

```text
web start = next start
worker start = node dist/index.js
```

当前工作树：

```text
web start = start-secure.mjs
worker start = start-secure.mjs
```

任何不带当前 dirty worktree 的 HEAD checkout/deploy 会重新暴露旧入口。

#### H-02：Storage ACL 授予当前沙箱用户组 Modify

`CodexSandboxUsers:(OI)(CI)(M)` 继承到 `storage/private`，包含 Delete。应用代码 fail-closed，但 OS ACL 过宽。

#### H-03：两个未解析 SID 具有 Modify

无法解析，不认定为恶意账户，但身份和当前状态 `UNKNOWN`；在确认前属于高风险 ACL 主体。

#### H-04：旧 Artifact 保留且无签名身份

- `.next` 无 P13 Manifest/Trust Root；
- `dist` 无 Gate；
- 手工执行路径仍存在。

### Medium Findings

- `CodexSandboxOffline` / `CodexSandboxOnline` 共享 `CodexSandboxUsers` Modify；
- `storage/private` Owner 为当前沙箱账户；
- 实际 `PRIVATE_STORAGE_ROOT` 环境覆盖值 UNKNOWN；
- Web dev chunk 保留多份旧删除代码副本；
- 旧 `cleanupOrphanObjects/cleanupTemp` 方法定义仍驻留 Web server chunk。

### Low / Mitigated

- 当前没有项目进程；
- 当前没有项目 Service/Task/Startup/Run；
- WSL 无发行版；
- 当前 Storage 无 Reparse Point；
- 当前工作树 package scripts 使用 secure launcher；
- 当前 `@elevator/file-storage` 已移除删除方法；
- 应用代码 Capability 已隔离。

## 14. 整改建议

### 代码/仓库

1. 在后续获准 Git 阶段提交当前 secure build/start、Capability 和 Evidence 工作树变更。
2. 增加 CI/发布检查：若运行包包含 `apps/web/.next`、`apps/worker/dist` 作为启动目标则拒绝发布。
3. 发布清单排除历史 `.next`/Worker `dist`。
4. 未来可在仓库外增加 artifact quarantine 目录；本轮不移动文件。
5. 不修改已执行 Migration。

### 本机环境

1. 确认两个未解析 SID 的来源；在确认前不要直接删除 ACE。
2. 将项目/Storage 的 `CodexSandboxUsers` Modify 收敛为最小权限。
3. 若需要运行 Web/Worker，拆分专用低权限身份和 Storage ACL。
4. 禁止手工 `next start` 旧 `.next`。
5. 禁止手工 `node apps/worker/dist/index.js`。
6. 不对旧 `.next`/dist 执行 Build、运行或回滚。
7. 旧 Artifact 隔离/清理需独立授权并记录审批。

### 未来部署

- 只部署 signed CURRENT Release；
- Runtime 不写 Release Root/Trust Root；
- Storage Delete 明确 DENIED；
- Scheduler/Auto Restart 只引用 secure entry；
- HEAD 工作树修复必须先进入可审计版本；
- 生产 Evidence Bundle 必须完整通过；
- 旧 Artifact 不得进入部署包。

## 15. 未解决与 UNKNOWN

```text
Actual configured PRIVATE_STORAGE_ROOT:
UNKNOWN (env not read)

Two ACL SID identities:
UNKNOWN

Old Worker current local physical delete outcome:
NOT EXECUTED / static fail-closed due missing methods

Old Worker behavior with older external dependency:
UNKNOWN / potentially CRITICAL

Out-of-band startup/watchdog not registered in standard OS mechanisms:
UNKNOWN

Nonstandard Windows Reparse Point types in external future roots:
UNKNOWN

Production environment:
NOT DEPLOYED

Production security:
NOT VERIFIED
```

## 16. 本轮未执行

```text
No Legacy Artifact execution
No next start
No next dev
No Worker start
No process stop/restart/kill
No Build
No tests
No TypeScript
No formatter
No database connection
No SQL/Migration
No Storage content read
No Storage write/delete
No Cleanup
No ACL/Owner/inheritance change
No Service/Registry/Task change
No Git write
No Artifact move/delete
```

## 17. 最终门禁

```text
C-6.2-L8-A3:
PASS WITH CRITICAL FINDINGS

Web Legacy Artifact Reachability:
VERIFIED

Worker Legacy Entry:
VERIFIED

Worker Gate Bypass:
CONFIRMED

Windows SID Resolution:
PARTIAL

Effective ACL:
PARTIAL

Startup Inventory:
COMPLETE

Storage Inventory:
PARTIAL

Critical Findings:
2

High Findings:
4

Required Remediation:
LISTED / NOT EXECUTED

Production Environment:
NOT DEPLOYED

Production Security:
NOT VERIFIED

Production Drain:
NOT APPLICABLE

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```

本报告仅复核本机旧 Artifact 和权限，不代表生产安全已通过。
