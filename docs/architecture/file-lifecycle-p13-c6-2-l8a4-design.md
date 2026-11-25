# P1-3 C-6.2-L8-A4 Web / Worker 启动入口安全整改设计

## 文档信息

- 阶段：`C-6.2-L8-A4`
- 日期：`2026-11-19`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 设计状态：`IMPLEMENTED / TESTED / LEGACY ARTIFACTS RETAINED`

## 1. 目标和边界

本阶段只整改源码中的正式启动路径：

- production Web 必须经过 Secure Launcher 和 instrumentation Gate；
- production Worker 必须经过 secure launcher、Gate-first Bootstrap 后才加载业务；
- package scripts 不得引用旧 direct entry；
- 旧 `.next` 和 Worker `dist` 保留、不执行、不移动、不删除。

## 2. 基线

L8-A3 已确认：

- HEAD 中 Web `start=next start`；
- HEAD 中 Worker `start=node dist/index.js`；
- 当前 dirty worktree 已将两者改为 secure launcher；
- 旧 Web `.next` 和 Worker `dist` 仍含旧代码；
- 当前依赖包已移除 Storage delete methods。

本轮不覆盖其他未提交修改。

## 3. Web Production Entry

### 3.1 Package Scripts

当前工作树：

```text
apps/web/package.json
  build = tsx scripts/build-secure.ts
  start = node scripts/start-secure.mjs
  dev   = next dev
```

`dev` 仅用于开发；production build/start 使用 secure scripts。

### 3.2 Secure Launcher 顺序

```text
start-secure.mjs
  -> require P13 release/runtime/manifest/trust/Git/release ID
  -> verifyStartupRelease
  -> spawn Next production server
  -> Next production instrumentation
  -> verifyStartupRelease again
  -> business routes
```

Launcher 不导入 Prisma、PgBoss 或 file-storage。

### 3.3 Production Server 配置防火墙

`next.config.ts` 现在对以下 phase 都要求隔离的 `P13_NEXT_DIST_DIR`：

```text
PHASE_PRODUCTION_BUILD
PHASE_PRODUCTION_SERVER
```

缺失时 fail closed。

该配置阻止 `next start` 无隔离 Release 配置时回退到默认历史 `.next`。

## 4. Worker Production Entry

### 4.1 Package Scripts

```text
apps/worker/package.json
  build = tsx scripts/build-secure.ts
  start = node scripts/start-secure.mjs
  dev   = tsx watch src/index.ts
```

生产 start 不引用 `dist/index.js`。

### 4.2 Secure Launcher

```text
start-secure.mjs
  -> require P13 release/runtime/manifest/trust/Git/release ID
  -> verifyStartupRelease
  -> verify release index regular file and realpath containment
  -> spawn node <release>/index.js with NODE_ENV=production
  -> Gate-first Bootstrap
```

### 4.3 Gate-first Bootstrap

新增 `apps/worker/src/bootstrap.ts`：

```text
runWorkerStartupGate()
  -> on failure: reject
  -> dynamic import("./worker-entry.js")
  -> startWorker()
```

`bootstrap.ts` 静态只依赖 Build Integrity 和 Startup Gate，不静态导入：

- Prisma Client；
- pg-boss；
- Worker business entry；
- Storage。

因此 Gate 失败时：

- Prisma 不初始化；
- PgBoss 不初始化；
- Queue 不创建；
- Job 不注册；
- Immediate Maintenance 不运行；
- Storage 不访问。

### 4.4 Worker Business Entry

`worker-entry.ts` 只在 Gate 通过并动态加载后创建 Prisma/PgBoss。

Maintenance 仍：

- 输入不包含 Storage；
- Startup immediate 与 cron 共用无删除函数；
- Retry/Recovery/Requeue 不执行物理删除。

## 5. 启动入口矩阵

| Entry | Environment | Gate | Business Import Before Gate | Status |
|---|---|---|---|---|
| Web package `start` | Production | Secure Launcher + instrumentation | No | SECURE |
| Web `next dev` | Development | No production Gate | N/A | DEV ONLY |
| Direct `next start` | Manual/legacy | `next.config` now requires isolated dist | No if config missing | BLOCKED WITHOUT ISOLATED RELEASE |
| Web secure build | Build | Signed manifest | N/A | SECURE |
| Worker package `start` | Production | Secure Launcher + Gate | No | SECURE |
| Worker `src/index.ts` | Production/dev | Gate-first Bootstrap | No | SECURE |
| Direct release index | Production release | Worker Gate | No | SECURE |
| `worker-entry.ts` direct | Manual | No independent Gate | Yes if forced | PROHIBITED |
| Test Worker Entry | Test only | Test-only bypass | Test code | ISOLATED |
| Historical `node dist/index.js` | Legacy | No Gate | Yes | PROHIBITED / ARTIFACT RETAINED |

## 6. Web Delete Boundary

当前源码：

- `cleanupExpiredUploadIntents()` 访问 DB/Storage 前 fail closed；
- `createUploadIntent()` 不再调用 Legacy cleanup；
- `completeUpload()` failure/COMMIT unknown 不删除对象；
- Web runtime capability 不含 delete；
- Legacy delete 在 quarantine type 中直接拒绝。

旧 `.next` 内的旧调用链不会因源码整改而改变；该 Artifact 必须继续禁止启动。

## 7. Tests

新增/强化：

- Web launcher Gate before spawn；
- Worker launcher Gate before spawn；
- Both launchers no business dependencies；
- Worker Gate failure does not call business loader；
- Worker success order：gate -> load -> start；
- Worker release index dynamic import；
- Next production server requires isolated dist；
- All package scripts reject direct `next start` / `node dist/index.js`；
- Existing Manifest/Artifact/Trust/Runtime Dependency tests；
- Upload failure retention；
- Storage capability and Legacy fail-closed；
- Maintenance no-delete tests。

## 8. 风险和未变更项

- HEAD 仍保存旧 package scripts；安全修改仍是 uncommitted worktree；
- 旧 `.next` 和 Worker `dist` 仍存在；
- direct manual startup 旧 Artifact 仍可能，需要 OS/发布层隔离；
- Worker direct old `dist` bypasses Gate；当前依赖包使物理删除方法缺失，但不能依赖该事实；
- 生产环境未部署；
- 真实 ACL、Trust Root 和生产证据未验证。

## 9. 门禁

```text
Production Web Entry:
SECURE IN CURRENT WORKTREE

Production Worker Entry:
SECURE IN CURRENT WORKTREE

Historical Artifacts:
PRESENT / NOT REMOVED

New Cleanup:
NOT ENABLED

Production Deployment:
NOT EXECUTED

Next Phase:
NOT AUTHORIZED
```
