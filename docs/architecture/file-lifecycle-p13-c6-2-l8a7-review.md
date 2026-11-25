# P1-3 C-6.2-L8-A7 Source Baseline Promotion Review

## 1. 文档信息与总体结论

- 阶段：`C-6.2-L8-A7`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 审查性质：只读代码与测试审查，外加本文和实施状态文档更新
- 总体结论：`PASS WITH WARNINGS`
- 提交授权：`NOT GRANTED`

当前工作树中的 Web / Worker 正式入口、Gate-first Bootstrap、隔离构建目标和
Signed Release 验证逻辑成立，未发现当前受支持 package script 直接绕过 Gate。

但统一扫描器仍有两个会影响正式安全基线可信度的问题：

1. 额外脚本扫描只识别 JavaScript `exec/spawn` 形式，shell / PowerShell /
   CMD 中的原始命令可以绕过；部分参数别名和动态调用也只能标记为
   `UNKNOWN`。
2. 额外可执行脚本只在工作树扫描；Git HEAD 只扫描 11 个必需文件，
   HEAD 专属 Wrapper 不会被扫描，也不会进入 `differences`。

因此：

- A4 的运行入口整改可判定为通过；
- A6 的启动/构建强制逻辑可工作，但统一扫描器覆盖率只能判定为
  `PARTIAL`；
- 不建议在未接受该限制或未另行授权修复的情况下，把全部脏工作树
  一次性提交为正式安全基线。

## 2. 重新确认的基线

### 2.1 Git

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

工作树保持原有未提交内容，并包含 A4、A5、A6 及更早安全整改。
本轮没有执行任何 Git 写操作。

### 2.2 构建产物

```text
apps/web/.next:
PRESENT
1,413 files
446,890,260 bytes

apps/worker/dist:
PRESENT
32 files
135,078 bytes
```

两者均未移动、删除、重命名或执行。

### 2.3 当前工作树安全检查

实际执行：

```powershell
pnpm security:startup
```

结果：

```text
worktreeStatus: PASS
headStatus: FAIL
headVsWorktree: DIFFERENT
additionalWorktreeScriptsScanned: 95
worktreeFindings: 0
```

HEAD 与工作树的安全文件差异为：

```text
package.json
apps/web/package.json
apps/worker/package.json
apps/web/next.config.ts
apps/web/scripts/build-secure.ts
apps/web/scripts/start-secure.mjs
apps/web/src/instrumentation.ts
apps/worker/scripts/build-secure.ts
apps/worker/scripts/start-secure.mjs
apps/worker/src/bootstrap.ts
apps/worker/src/index.ts
```

HEAD 仍包含旧 build/start 入口和旧 Worker 直接业务启动逻辑，因此
`HEAD Startup Gate: FAIL` 是预期结果，不是本轮测试失败。

## 3. A4 / A6 安全整改复核

### 3.1 Web Secure Startup Gate

事实依据：

- `apps/web/scripts/start-secure.mjs`
  - 第 41 行：调用 `verifyStartupRelease()`；
  - 第 59 行：Gate 通过后才 `spawn` Next；
  - 第 64 行：向 Next 注入隔离的 `P13_NEXT_DIST_DIR`。
- `apps/web/src/instrumentation.ts`
  - 第 11-14 行：动态加载并执行 `runWebStartupGate()`；
  - 未静态导入 Prisma、PgBoss 或 Storage。
- `apps/web/next.config.ts`
  - 第 6-7 行：处理 production build/server phase；
  - 第 45-50 行：无隔离 dist 时 fail closed。
- `apps/web/package.json`
  - `build = tsx scripts/build-secure.ts`
  - `start = node scripts/start-secure.mjs`

结论：

```text
Web Gate Order: PASS
Web Production Dist Isolation: PASS
Web Gate Failure Fallback: NONE FOUND
Web Supported Package Entry: SECURE
Web Delete Capability: UNAVAILABLE
```

说明：`next dev` 仍使用默认 `.next`，仅用于开发，不是 production
supported entry。

### 3.2 Worker Gate-first Bootstrap

事实依据：

- `apps/worker/scripts/start-secure.mjs`
  - 第 40 行：验证 Signed Release；
  - 第 71 行：Gate 通过后才 spawn Release `index.js`；
  - 第 75 行：强制 `NODE_ENV=production`。
- `apps/worker/src/bootstrap.ts`
  - 第 33 行：先 `await runStartupGate()`；
  - 第 34 行：Gate 通过后才调用 `loadBusinessEntry()`；
  - 第 31 行：业务入口通过动态 `import("./worker-entry.js")` 加载。
- `apps/worker/src/index.ts`
  - 只调用 `runWorkerBootstrap()`；
  - 不静态导入 Worker 业务入口、Prisma、PgBoss 或 Storage。
- `apps/worker/src/worker-entry.ts`
  - 业务依赖只在该文件被 Gate 后动态加载时初始化。

结论：

```text
Worker Gate Order: PASS
Worker Prisma/PgBoss Before Gate: NOT FOUND
Worker Job Registration Before Gate: NOT FOUND
Worker Maintenance Before Gate: NOT FOUND
Worker Supported Package Entry: SECURE
Worker Delete Capability: UNAVAILABLE
```

### 3.3 构建预检

Web：

- `apps/web/scripts/build-secure.ts`
  - 第 83 行：调用 build security preflight；
  - 第 144 行：之后才启动 Next build；
  - 第 165 行：构建后生成 Signed Manifest。

Worker：

- `apps/worker/scripts/build-secure.ts`
  - 第 73 行：调用 build security preflight；
  - 第 107 行：之后才启动 TypeScript build；
  - 第 129 行：构建后生成 Signed Manifest。

结论：

```text
Web Build Preflight Before Build: PASS
Worker Build Preflight Before Build: PASS
Preflight Failure Blocks Build: PASS BY CONTROL FLOW
Legacy Target Reuse: FAIL-CLOSED
Existing Target Reuse: FAIL-CLOSED
```

### 3.4 Build Identity、Manifest 与 Runtime Dependency

当前实现继续使用已有统一身份体系，没有发明第二套并行信任体系。

事实依据：

- `packages/build-integrity/src/index.mjs`
  - 第 23 行起：严格 Manifest 字段；
  - 第 586 行：Artifact Digest；
  - 第 1072 行：生成 Signed Manifest；
  - 第 1409 行：启动验证；
  - 第 1485-1492 行：启动时重新计算 Artifact Digest 并拒绝不匹配；
  - 第 1294 行：`cleanupCapability` 必须为 `DISABLED`。

Manifest 绑定：

```text
application
buildId
releaseId
gitSha
gitDirty
sourceTreeDigest
dependencyLockDigest
runtimeDependencyDigest
runtimeDependencyCount
runtimePlatform
artifactDigest
buildTimestamp
lifecycleSafetyVersion
cleanupCapability
artifactRoots
```

Artifact Digest 覆盖 Release Root 下全部普通文件，并拒绝启动时新增、
删除或替换文件。Manifest 没有逐项列出一个文件数组，但完整内容由
SHA-256 Artifact Digest 和 Runtime Dependency Digest 绑定。

结论：

```text
Build Identity Review: PASS
Manifest Review: PASS
Runtime Dependency Review: PASS
Missing/Invalid Manifest Startup: FAIL-CLOSED
```

### 3.5 构建失败与旧产物复用

事实依据：

- Web 只能写入 `.p13-releases/<releaseId>`；
- Worker 不得写入 `apps/worker/dist`；
- 目标路径已经存在时 preflight 失败；
- 构建失败不会生成有效 Signed Manifest；
- 无有效 Manifest 时 Web/Worker Startup Gate 均拒绝；
- 构建脚本没有 fallback 到 `.next` 或 `dist`。

结论：

```text
Legacy Artifact Reuse Review: PASS
Build Failure Fallback Protection: PASS
```

限制：构建失败后可能留下不完整 Release 目录。后续同 ID 构建仍会因
目标已存在而失败，因此不会形成自动复用，但需要人工隔离/处置。

## 4. A6 统一扫描器独立审查

### 4.1 已成立的部分

`packages/build-integrity/src/startup-security.mjs` 实际具备：

- 第 429 行：通过 `git show HEAD:<path>` 读取 HEAD 内容；
- 第 606-623 行：分别构造 worktree 和 HEAD 审查结果；
- 第 632-635 行：比较两个版本的差异；
- 第 661 行起：构建目标安全检查；
- Web/Worker exact production script allowlist；
- production `next start` 与 `node dist/index.js` 拒绝；
- Web Gate、Worker Gate-first Bootstrap 和 preflight 顺序检查；
- 工作树额外脚本扫描计数。

实际工作树扫描得到 `0 findings`，与当前受支持入口一致。

### 4.2 P1：shell / PowerShell / CMD 原始命令扫描缺口

第 26-29 行只识别 JavaScript 风格的：

```text
exec
execSync
execFile
execFileSync
spawn
spawnSync
```

第 515-559 行虽然扫描 `.sh`、`.ps1`、`.bat` 和 `.cmd`，但实际仍只使用
上述 JavaScript 调用正则。

因此，以下静态可读形式不会被当前扫描器识别：

```powershell
next start
node .\apps\worker\dist\index.js
```

```sh
exec next start
```

```bat
next start
```

只要 root/release script 调用这些 Wrapper，而 Wrapper 自身不是 Web/Worker
exact `start`，当前扫描就可能遗漏。

### 4.3 P1：HEAD 额外脚本没有扫描和差异比较

第 624-629 行只对当前工作树执行额外脚本扫描。

第 632-635 行只比较 `REQUIRED_FILES` 中的 11 个文件。

因此，如果 HEAD 中存在一个额外 Wrapper，而工作树已删除或修改它：

- HEAD Wrapper 不会被扫描；
- 该路径不会出现在 `differences`；
- 旧 package script 若通过文件名间接调用它，当前扫描器可能只看到
  “调用未知 Wrapper”，而不是 HEAD 中的危险命令。

### 4.4 P2：导入和动态调用仍是启发式

第 19-22 行只识别精确的静态 `import ... from` 和 side-effect import。
以下形式没有完整语义覆盖：

- `require()`;
- re-export；
- 函数别名；
- 参数数组别名；
- 变量拼接命令；
- shell 解析后的命令；
- 通过其他模块间接执行。

其中动态形式本就只能标记 `UNKNOWN`；但 shell 原始命令和 HEAD 额外脚本
属于可以静态发现的内容，不应完全依赖 `UNKNOWN`。

### 4.5 P2：扫描器自身负向测试不足

`apps/web/tests/p13-startup-preflight.test.ts` 当前有 8 项测试，覆盖：

- 安全 worktree/HEAD；
- 直接 package entry；
- Worker 静态业务 import；
- Worker Gate 顺序；
- 一个 JavaScript `exec("next start")` Wrapper；
- HEAD/worktree 差异；
- 旧、非隔离和已存在构建目标；
- Worker dist 目标。

尚缺少：

- `.ps1` / `.cmd` / `.bat` / `.sh` 原始 `next start`；
- `.ps1` / shell 直接执行 Worker `dist/index.js`；
- `spawn("pnpm", ["exec", "next", "start"])` 一类参数别名；
- HEAD 专属 Wrapper 扫描；
- Wrapper 符号链接/Reparse 行为；
- 对扫描器伪 marker、注释和 re-export 的负向测试。

## 5. HEAD 与工作树差异审查

### 5.1 A4 / A6 核心安全文件

| 文件 | HEAD 状态 | 工作树状态 | 修改原因 | 是否必须进入安全提交 |
| -- | -- | -- | -- | -- |
| `package.json` | PRESENT / 旧安全脚本缺失 | MODIFIED | 增加启动安全命令 | 是 |
| `pnpm-lock.yaml` | PRESENT / 无共享包 | MODIFIED | 绑定 build-integrity workspace | 是 |
| `apps/web/package.json` | PRESENT / `next start` | MODIFIED | secure build/start | 是 |
| `apps/worker/package.json` | PRESENT / `node dist/index.js` | MODIFIED | secure build/start | 是 |
| `apps/web/next.config.ts` | PRESENT / 无 production dist guard | MODIFIED | 禁止默认 `.next` production | 是 |
| `apps/worker/src/index.ts` | PRESENT / 直接业务启动 | MODIFIED | Gate-first Bootstrap | 是 |
| `apps/worker/tsconfig.json` | PRESENT | MODIFIED | 纳入 build scripts typecheck | 是 |
| `packages/build-integrity/package.json` | ABSENT | UNTRACKED | 共享完整性包元数据 | 是 |
| `packages/build-integrity/src/index.mjs` | ABSENT | UNTRACKED | Manifest、Digest、Gate | 是 |
| `packages/build-integrity/src/index.d.ts` | ABSENT | UNTRACKED | 类型契约 | 是 |
| `packages/build-integrity/src/startup-security.mjs` | ABSENT | UNTRACKED | A6 扫描与 build preflight | 是 |
| `apps/web/scripts/build-secure.ts` | ABSENT | UNTRACKED | Web secure build | 是 |
| `apps/web/scripts/start-secure.mjs` | ABSENT | UNTRACKED | Web secure start | 是 |
| `apps/web/scripts/p13-startup-security/cli.ts` | ABSENT | UNTRACKED | 统一扫描 CLI | 是 |
| `apps/web/src/instrumentation.ts` | ABSENT | UNTRACKED | Web runtime Gate | 是 |
| `apps/web/src/server/security/startup-gate.ts` | ABSENT | UNTRACKED | Web Gate 实现 | 是 |
| `apps/web/tests/p13-startup-preflight.test.ts` | ABSENT | UNTRACKED | A6 扫描/preflight 测试 | 是 |
| `apps/web/tests/p13-release-security.test.ts` | ABSENT | UNTRACKED | Manifest/Gate/Bootstrap 测试 | 是 |
| `apps/worker/scripts/build-secure.ts` | ABSENT | UNTRACKED | Worker secure build | 是 |
| `apps/worker/scripts/start-secure.mjs` | ABSENT | UNTRACKED | Worker secure start | 是 |
| `apps/worker/src/bootstrap.ts` | ABSENT | UNTRACKED | Gate-first Bootstrap | 是 |
| `apps/worker/src/security/startup-gate.ts` | ABSENT | UNTRACKED | Worker Gate 实现 | 是 |
| `apps/worker/src/worker-entry.ts` | ABSENT | UNTRACKED | Gate 后业务入口 | 是 |

### 5.2 A4/A6 的必要前置安全依赖

以下文件来自更早的 Legacy cleanup / Storage capability 安全整改。A4/A6
当前工作树依赖它们；不能把它们随意排除后仍声称干净 checkout 可构建、
测试通过。

| 文件 | HEAD 状态 | 工作树状态 | 与 A4/A6 的关系 | 提交判断 |
| -- | -- | -- | -- | -- |
| `apps/web/src/modules/files/download-service.ts` | PRESENT | MODIFIED | 使用 read capability | 前置安全提交 |
| `apps/web/src/modules/files/upload-service.ts` | PRESENT | MODIFIED | 禁止 Legacy 删除 | 前置安全提交 |
| `apps/web/src/server/files/storage.ts` | PRESENT | MODIFIED | Web runtime 无 delete | 前置安全提交 |
| `apps/web/tests/legacy-cleanup-shutdown.test.ts` | ABSENT | UNTRACKED | Web 删除止损回归 | 前置安全提交 |
| `apps/web/tests/e2e/global-setup.ts` | PRESENT | MODIFIED | 仅测试入口 | 前置安全提交 |
| `apps/web/tests/integration/phase32-upload-service.test.ts` | PRESENT | MODIFIED | Storage capability 适配 | 前置安全提交 |
| `apps/web/tests/integration/phase34-file-processing.test.ts` | PRESENT | MODIFIED | 不再传递 delete storage | 前置安全提交 |
| `apps/web/tests/integration/phase35-lease-renewal.test.ts` | PRESENT | MODIFIED | 测试契约适配 | 前置安全提交 |
| `apps/web/tests/integration/phase35-processing-reliability.test.ts` | PRESENT | MODIFIED | 测试契约适配 | 前置安全提交 |
| `apps/worker/src/config.ts` | PRESENT | MODIFIED | 测试环境不读取开发 env | 前置安全提交 |
| `apps/worker/src/file-maintenance.ts` | PRESENT | MODIFIED | Maintenance 无 Storage | 前置安全提交 |
| `apps/worker/src/file-processing.ts` | PRESENT | MODIFIED | 使用 read capability | 前置安全提交 |
| `apps/worker/src/storage.ts` | PRESENT | MODIFIED | Worker runtime 只读 | 前置安全提交 |
| `apps/worker/tests/legacy-cleanup-shutdown.test.ts` | ABSENT | UNTRACKED | Worker 删除止损回归 | 前置安全提交 |
| `apps/worker/tests/storage-capability.test.ts` | ABSENT | UNTRACKED | Worker 无删除能力 | 前置安全提交 |
| `apps/worker/tests/test-worker-entry.ts` | ABSENT | UNTRACKED | E2E 专用非生产入口 | 前置安全提交 |
| `packages/file-storage/src/errors.ts` | PRESENT | MODIFIED | Legacy cleanup disabled 错误 | 前置安全提交 |
| `packages/file-storage/src/index.ts` | PRESENT | MODIFIED | capability 导出 | 前置安全提交 |
| `packages/file-storage/src/local-private-storage.ts` | PRESENT | MODIFIED | 移除普通实例 delete 方法 | 前置安全提交 |
| `packages/file-storage/src/capabilities.ts` | ABSENT | UNTRACKED | 最小权限接口 | 前置安全提交 |
| `packages/file-storage/src/legacy-cleanup.ts` | ABSENT | UNTRACKED | 隔离 Legacy 删除实现 | 前置安全提交 |
| `packages/file-storage/tests/local-private-storage.test.ts` | PRESENT | MODIFIED | 新 capability 契约 | 前置安全提交 |
| `packages/file-storage/tests/capabilities.test.ts` | ABSENT | UNTRACKED | capability 回归 | 前置安全提交 |

### 5.3 必须排除的现有变更

| 路径 | 状态 | 原因 |
| -- | -- | -- |
| `apps/web/next-env.d.ts` | MODIFIED | Next 生成文件，受保护，不由 A4/A6 授权修改 |
| `prisma/schema.prisma` | MODIFIED | P1-3 Schema 基线，不属于 A4/A6 |
| `prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/` | UNTRACKED | P1-3 Migration |
| `prisma/migrations/20261117130000_phase37_p13_lifecycle_insert_guard/` | UNTRACKED | A Trigger 修订 |
| `prisma/migrations/20261117140000_phase37_p13_lifecycle_initial_state_guard/` | UNTRACKED | B Trigger 修订 |
| `apps/web/scripts/p13-build-audit/` | UNTRACKED | L2 只读审计工具，不在 A4/A6 范围 |
| `apps/web/scripts/p13-db-tests/` | UNTRACKED | 数据库行为测试工具，不在 A4/A6 范围 |
| `apps/web/scripts/p13-deployment-evidence/` | UNTRACKED | L8-A Evidence 工具，不在 A4/A6 范围 |
| `apps/web/scripts/p13-storage-delete-audit/` | UNTRACKED | Storage AST 审计，不在 A4/A6 范围 |
| `apps/web/scripts/p13-storage-inventory/` | UNTRACKED | Storage inventory，不在 A4/A6 范围 |
| `apps/web/tests/p13-a-migration.test.ts` | UNTRACKED | Migration 测试 |
| `apps/web/tests/p13-b-migration.test.ts` | UNTRACKED | Migration 测试 |
| `apps/web/tests/p13-build-audit.test.ts` | UNTRACKED | L2 工具测试 |
| `apps/web/tests/p13-db-tooling.test.ts` | UNTRACKED | DB 工具测试 |
| `apps/web/tests/p13-deployment-evidence*.test.ts` | UNTRACKED | Evidence 工具测试 |
| `apps/web/tests/p13-storage-delete-audit.test.ts` | UNTRACKED | Storage 审计测试 |
| `apps/web/tests/p13-storage-inventory.test.ts` | UNTRACKED | Storage inventory 测试 |
| `docs/architecture/*` 除 A4/A5/A6/A7 文档和 Implementation Status 外 | UNTRACKED | 其他阶段文档 |
| `apps/web/.next` | PRESENT / IGNORED | 历史构建产物，禁止提交 |
| `apps/worker/dist` | PRESENT / IGNORED | 历史构建产物，禁止提交 |

不得直接使用 `git add .`。

## 6. 测试与验证结果

### 6.1 定向测试

```text
Web:
3 files / 43 tests PASS

  p13-startup-preflight.test.ts: 8 PASS
  p13-release-security.test.ts: 30 PASS
  legacy-cleanup-shutdown.test.ts: 5 PASS

Worker:
2 files / 5 tests PASS

  legacy-cleanup-shutdown.test.ts: 4 PASS
  storage-capability.test.ts: 1 PASS

file-storage:
2 files / 19 tests PASS
```

测试使用 Mock 或 `mkdtemp` 临时目录；未连接数据库、未启动 Web/Worker、
未执行真实 Build、未访问真实 Storage。

### 6.2 TypeScript

```text
Web:
PASS

Worker:
PASS
```

两处均使用 `--noEmit --incremental false`。

### 6.3 测试真实性结论

已真实覆盖：

- Gate 失败时 Worker business loader 不被调用；
- Gate 成功时顺序为 `gate -> loadBusiness -> startWorker`；
- Message 中不存在的 Signed Manifest/Trust Root 被拒绝；
- Artifact Digest、Runtime Dependency 篡改被拒绝；
- 旧、非隔离和已存在构建目标被拒绝；
- Legacy Storage 删除能力不可用；
- Maintenance 不接受 Storage 删除依赖；
- Web `next.config` production server 无 dist 时失败。

仍属于静态控制流检查：

- build script 中 preflight 必须先于 spawn；
- production package script 精确匹配；
- Worker index/Bootstrap 源码 marker 和 import 形式；
- 不能证明真实 Next/tsc Build 一定成功。

本轮没有执行真实 Build，因此这些限制不能表述为生产构建已验证。

## 7. 密钥、受保护文件与安全边界

### 7.1 Secret Scan

对 `apps` 与 `packages` 的源码、测试和脚本执行了文件名/模式扫描，排除
`node_modules`、`.next`、`dist`、coverage 和 test-results。

结果：

```text
PEM private key: NOT FOUND
AWS access key pattern: NOT FOUND
GitHub token pattern: NOT FOUND
OpenAI-style key pattern: NOT FOUND
Literal DATABASE_URL value: NOT FOUND
Literal TOKEN value: NOT FOUND
```

发现一个 PostgreSQL URL 模式位于排除范围中的
`apps/web/tests/p13-deployment-evidence.test.ts`，内容明确为
`example.invalid` 测试占位符，不是真实连接串。

未读取 `.env` 或 `.env.test`。

### 7.2 受保护文件哈希

本轮测试前后一致：

```text
prisma/schema.prisma
78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299

prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql
187D82A00DB73CB6F5D79C97DCD6B4FF2E01BD7E5F78BB9E1273D54D8A141479

apps/web/next-env.d.ts
0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC

apps/web/tsconfig.tsbuildinfo
018C24B24976726C8837E6C70B57DA982DAE635E98C62BC721F3F63AEF7FF777

apps/web/.next/BUILD_ID
06955B147BD0009CD09B566531E3D2BC93B77142582145564E219C1530F9F5A1

apps/worker/dist/index.js
D7DF17BC2CF23A7923527648A98FC5AABB8FD36A21D6A0B24EA92F8C1DE5BBB9

apps/worker/dist/file-maintenance.js
C6B5B0EBD2AD047CF32AE447470B19D2AB02F413DDB33BABF80828A6FEFCABE3
```

### 7.3 关键源码哈希

```text
packages/build-integrity/src/startup-security.mjs
A79E81A9CF2789C23B7DEE8A8008E196252B04DD87C9FA2A4C0A1377251E97BE

packages/build-integrity/src/index.mjs
CB8080AF1BA802FF4482B543A13F2ABF066AC5FA83D169F7D93BCCA21CAAEE3A

apps/web/scripts/build-secure.ts
2B65A0B57E7B7A714E78666F8113B9BF2CE7AD973195D8F9A09A95BE191D1425

apps/web/scripts/start-secure.mjs
F7E60F47C9462C6C438AFF102E6155941E0B9949D9D14DC202C4B4C836CA17DF

apps/worker/scripts/build-secure.ts
ED58C95FF3A2875D911A2E4D55966EC79E05A136F45640055CCE4E6F8BDB9DF1

apps/worker/scripts/start-secure.mjs
A5E0ED3A6F7190C097B46B82FE8768BFFA50B6E68EF478A23D702258981D93A0

apps/worker/src/bootstrap.ts
F88E9C86300A62E94192196DF4D63975941EDE3B849253310C6507B84617BEFB

apps/worker/src/index.ts
DC216DA857F74F01BB341A82AB749B1DF1735834E9C45E18F30B1442FAD7DF68
```

### 7.4 被审查文档哈希

```text
docs/architecture/file-lifecycle-p13-c6-2-l8a4-design.md
79D5CED97102EF155B38F8098AFEB95D0CDB89A7DE6DA4AB9C3EBC4C0DC5D701

docs/architecture/file-lifecycle-p13-c6-2-l8a4-report.md
09E43FA470ABF8FDF9C5000E20073F12168AA0A910481C9877048FD93502BC23

docs/architecture/file-lifecycle-p13-c6-2-l8a5-design.md
CD1871BB7345D4CD2DCCCED5B6E6196092059FA6167CD22748693227D7F83104

docs/architecture/file-lifecycle-p13-c6-2-l8a5-report.md
FC8118D64F1932DD293E5BA19E77B60624D10EBBE6796AF5438BA26AE43373D9

docs/architecture/file-lifecycle-p13-c6-2-l8a6-design.md
E82CE9D7C7F68D6D73409D13CE005F15863B040DB99A649383683B85A027F0CE

docs/architecture/file-lifecycle-p13-c6-2-l8a6-report.md
D1031F1AFAD8C151197F163BD1B2CED0AD084C4BBF44290B1A028F28D4C86F34
```

## 8. 发现的问题与严重程度

### P1-1：统一扫描器不能识别 shell/Wrapper 原始命令

当前代码可以扫描 `.sh`、`.ps1`、`.cmd`、`.bat`，但只应用 JavaScript
`spawn/exec` 正则。直接 shell 命令不会命中。

影响：

- Release Wrapper 可能逃避 A6 检查；
- 仍可能通过人工支持的“安全脚本”路径间接启动旧入口；
- 与“检查所有可能启动 Web/Worker 的脚本”目标不完全一致。

建议：

- 对 shell/CMD/PowerShell 分别使用命令级解析或保守的静态规则；
- 拒绝无法解析的 Wrapper；
- 增加上述负向测试；
- 不得在修复前把 A6 扫描器描述为完整覆盖。

### P1-2：HEAD 额外脚本未正式扫描

影响：

- `HEAD Startup Gate: FAIL` 只证明 11 个必需文件不安全；
- 不能证明 HEAD 额外 Wrapper 全部安全；
- `differences` 对额外脚本不完整。

建议：

- 枚举 `git ls-tree -r --name-only HEAD` 中同类可执行路径；
- 对 HEAD 执行与 worktree 相同的额外脚本审计；
- 将新增/删除/修改的可执行脚本全部纳入差异结果。

### P2-1：扫描器和 import 检查是启发式

静态 `indexOf` marker、精确 import 正则和命令正则都可被注释、别名、
re-export 或拼接绕过。当前实际门禁仍有关键运行时验证，但这不证明扫描器
是完备证明。

建议保持 `UNKNOWN` 语义，并在正式验收中明确扫描器是 defense-in-depth，
Signed Manifest、Runtime Digest 和隔离目录仍是主信任边界。

### P2-2：构建 Wrapper 没有独立执行级 Mock 测试

现有测试验证 preflight 的函数行为和源码顺序，没有通过 Mock
`child_process` 真实调用 Web/Worker build script 证明 builder 在失败时
零调用。

该项不否定当前控制流，但自动化证据仍是 `PARTIAL`。

### P2-3：构建目标父目录 Reparse/Junction 检查发生较晚

Preflight 对目标本身和已知旧目录做检查，但父目录 Junction 主要会在
后续 Manifest 生成阶段被 `assertNoReparsePathComponents` 拒绝。该路径
不会获得可信 Manifest，但可能在拒绝前产生非预期文件写入。

建议在 preflight 阶段就验证目标父目录链。

## 9. 建议提交清单

### 9.1 推荐提交拆分

当前变更跨越多个未提交阶段，且源文件互相依赖。推荐在解决/明确接受
P1-1、P1-2 后，采用以下顺序：

1. `security: freeze non-destructive storage capabilities`
   - 前置 Legacy cleanup / Storage capability 闭包；
   - 仅在项目负责人明确授权这批更早安全修改时执行。

2. `security: enforce gated startup and isolated release builds`
   - A4/A6 核心启动、Gate、Scanner、Preflight、Manifest 测试。

3. `docs(p13): record L8-A4 through L8-A7 promotion review`
   - A4/A5/A6/A7 文档和 Implementation Status。

不建议将 source 与 docs 混在一个无法解释的大型提交中。
不建议在 P1-1/P1-2 未处理或未明确接受时，将当前 A6 扫描器标记为
最终正式验收。

### 9.2 必须提交的 A4/A6 核心文件

```text
package.json
pnpm-lock.yaml
apps/web/package.json
apps/worker/package.json
apps/web/next.config.ts
apps/worker/src/index.ts
apps/worker/tsconfig.json
packages/build-integrity/package.json
packages/build-integrity/src/index.mjs
packages/build-integrity/src/index.d.ts
packages/build-integrity/src/startup-security.mjs
apps/web/scripts/build-secure.ts
apps/web/scripts/start-secure.mjs
apps/web/scripts/p13-startup-security/cli.ts
apps/web/src/instrumentation.ts
apps/web/src/server/security/startup-gate.ts
apps/web/tests/p13-startup-preflight.test.ts
apps/web/tests/p13-release-security.test.ts
apps/worker/scripts/build-secure.ts
apps/worker/scripts/start-secure.mjs
apps/worker/src/bootstrap.ts
apps/worker/src/security/startup-gate.ts
apps/worker/src/worker-entry.ts
```

### 9.3 必须在前置安全提交中的依赖文件

```text
apps/web/src/modules/files/download-service.ts
apps/web/src/modules/files/upload-service.ts
apps/web/src/server/files/storage.ts
apps/web/tests/legacy-cleanup-shutdown.test.ts
apps/web/tests/e2e/global-setup.ts
apps/web/tests/integration/phase32-upload-service.test.ts
apps/web/tests/integration/phase34-file-processing.test.ts
apps/web/tests/integration/phase35-lease-renewal.test.ts
apps/web/tests/integration/phase35-processing-reliability.test.ts
apps/worker/src/config.ts
apps/worker/src/file-maintenance.ts
apps/worker/src/file-processing.ts
apps/worker/src/storage.ts
apps/worker/tests/legacy-cleanup-shutdown.test.ts
apps/worker/tests/storage-capability.test.ts
apps/worker/tests/test-worker-entry.ts
packages/file-storage/src/errors.ts
packages/file-storage/src/index.ts
packages/file-storage/src/local-private-storage.ts
packages/file-storage/src/capabilities.ts
packages/file-storage/src/legacy-cleanup.ts
packages/file-storage/tests/local-private-storage.test.ts
packages/file-storage/tests/capabilities.test.ts
```

### 9.4 文档提交

```text
docs/architecture/file-lifecycle-p13-c6-2-l8a4-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a4-report.md
docs/architecture/file-lifecycle-p13-c6-2-l8a5-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a5-report.md
docs/architecture/file-lifecycle-p13-c6-2-l8a6-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a6-report.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-review.md
docs/architecture/file-lifecycle-p13-implementation-status.md
```

### 9.5 必须排除

- `.env`、`.env.test` 或任何真实秘密；
- `apps/web/next-env.d.ts`；
- `apps/web/tsconfig.tsbuildinfo`；
- `apps/web/.next`；
- `apps/worker/dist`；
- `node_modules`；
- 测试生成物、coverage 和临时目录；
- `prisma/schema.prisma`；
- 三个 P1-3 Migration；
- A4/A6 范围外的 DB、Build Audit、Deployment Evidence、Storage Inventory
  脚本和测试；
- 未经授权的其他 `docs/architecture` 文档。

## 10. 提交前仍需解决的问题

1. 决定是否先修复 P1-1 和 P1-2；若暂不修复，必须由项目负责人明确接受
   扫描器 `PARTIAL` 覆盖并保留后续整改阶段。
2. 明确前置 Legacy cleanup / Storage capability 源码的独立授权边界。
3. 在暂存后再次运行 `git diff --cached --name-only`，确认没有 `.env`、
   `.next`、`dist`、Schema 或 Migration 误入。
4. 在暂存后对精确 staged 文件运行 secret scan。
5. 保持 HEAD 提交前 `Commit Authorization: NOT GRANTED`。

## 11. 最终验收字段

```yaml
A4 Startup Remediation Review: PASS
A6 Startup Security Review: PARTIAL
Web Gate Review: PASS
Worker Gate Review: PASS
Build Preflight Review: PASS
Build Identity Review: PASS
Manifest Review: PASS
Legacy Artifact Reuse Review: PASS
HEAD vs Worktree Review: COMPLETE
Scanner Coverage Review: PARTIAL
Commit File Inventory: COMPLETE
Secret Scan: PASS
Protected File Integrity: PASS
Database: NOT CONNECTED
Storage: NOT ACCESSED
Real Build: NOT EXECUTED
Legacy Artifact: NOT MOVED / NOT DELETED / NOT EXECUTED
Git Write Operations: NOT EXECUTED
Production Environment: NOT DEPLOYED
Production Security: NOT VERIFIED
New Cleanup: NOT ENABLED
Commit Authorization: NOT GRANTED
Next Phase: NOT AUTHORIZED
```

本报告 SHA-256 在文件最终写入后的交付消息中提供。
