# P1-3 C-6.2-L8-A6 Source & Build Release Security Hardening 设计

## 文档信息

- 阶段：`C-6.2-L8-A6`
- 日期：`2026-11-19`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 设计状态：`IMPLEMENTED / TESTED / REAL BUILD NOT EXECUTED`

## 1. 目标

在 L8-A4/A5 的基础上增加统一门禁：

- 当前工作树正式启动入口必须安全；
- Git HEAD 与工作树安全差异必须显式可见；
- Web/Worker 构建前必须完成源码安全 preflight；
- 构建目标不得是历史 `.next` 或 Worker `dist`；
- 已存在目标、签名缺失、身份不一致必须 fail closed；
- 构建失败不得 fallback 到旧 Artifact。

## 2. 基线

```text
HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

Worktree:
contains uncommitted secure startup/build changes

Legacy Web:
apps/web/.next present

Legacy Worker:
apps/worker/dist present
```

当前 HEAD 仍是旧 build/start 脚本。工作树已安全但尚未提交。

## 3. 统一 Startup Source Scanner

模块：

```text
packages/build-integrity/src/startup-security.mjs
```

CLI：

```text
apps/web/scripts/p13-startup-security/cli.ts
pnpm security:startup
```

### 3.1 扫描目标

必需文件：

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

另扫描：

```text
apps/**/*.ts|js|mjs|cjs|cmd|bat|ps1|sh
scripts/**/*
```

排除：

```text
node_modules
.git
.next
.p13-releases
.p13-build
dist
build
out
coverage
tests
docs
```

### 3.2 包脚本规则

正式脚本必须精确匹配：

```text
Web build:
tsx scripts/build-secure.ts

Web start:
node scripts/start-secure.mjs

Worker build:
tsx scripts/build-secure.ts

Worker start:
node scripts/start-secure.mjs
```

所有 package scripts 拒绝：

```text
next start
node ... dist/index.js
test-worker-entry
```

Wrapper/alias 若改变正式 `start` 或 `build` 命令会失败。

### 3.3 Web 源码规则

`next.config.ts` 必须：

- 处理 `PHASE_PRODUCTION_BUILD`；
- 处理 `PHASE_PRODUCTION_SERVER`；
- 缺失 P13 dist 时失败。

`start-secure.mjs` 必须：

- `verifyStartupRelease` 早于 spawn；
- 不导入 Prisma/PgBoss/Storage。

`instrumentation.ts` 必须：

- dynamic import Startup Gate；
- 仅 Node runtime 执行；
- 不导入业务依赖。

`build-secure.ts` 必须：

- 输出 `.p13-releases/<releaseId>`；
- 拒绝其他 Web release root；
- 调用 signed manifest；
- 在 Next build 前调用 build preflight。

### 3.4 Worker 源码规则

`start-secure.mjs`：

- verify 早于 spawn；
- child `NODE_ENV=production`；
- 不导入业务依赖。

`index.ts`：

- 只调用 Gate-first Bootstrap；
- 不静态导入 Worker business、Prisma、PgBoss、Storage。

`bootstrap.ts`：

- `runStartupGate()` 早于 `loadBusinessEntry()`；
- dynamic import `worker-entry.js`；
- 不静态导入 business/runtime modules。

`build-secure.ts`：

- 拒绝已存在 Release Root；
- 使用 `--outDir <releaseRoot>`；
- 调用 signed manifest；
- 在 TypeScript build 前调用 build preflight。

### 3.5 其他脚本规则

通用扫描区分普通策略字符串和真实进程调用：

- 只识别 `exec/spawn/execFile` 等实际命令调用；
- 不按文档/策略中的 `"next start"` 文本误报；
- 发现未知 wrapper 中的 direct entry 时失败。

动态字符串拼接仍可能无法静态证明，报告 `UNKNOWN` 限制。

## 4. 工作树与 Git HEAD

Scanner 同时读取：

```text
WORKTREE files
git show HEAD:<path>
```

输出：

```text
worktree.status
worktree.findings
head.status
head.findings
headVsWorktree
differences
legacyArtifacts
additionalWorktreeScriptsScanned
```

构建 preflight 要求：

```text
worktree.status == PASS
```

HEAD 可以因尚未提交安全修改而 FAIL，但必须被记录。若在 clean HEAD checkout 中运行，worktree 与 HEAD 相同，preflight 会失败，因此不可能从旧 HEAD 静默构建。

## 5. Build Preflight

API：

```text
runBuildSecurityPreflight({
  application,
  workspaceRoot,
  appDirectory,
  targetRoot
})
```

顺序：

```text
source security audit
  -> target overlap checks
  -> application-specific isolation check
  -> target nonexistence check
  -> return report
```

失败 codes：

```text
BUILD_SOURCE_SECURITY_FAILED
BUILD_TARGET_IS_LEGACY_ARTIFACT
WEB_BUILD_TARGET_NOT_ISOLATED
WORKER_BUILD_TARGET_IS_LEGACY_DIST
BUILD_TARGET_ALREADY_EXISTS
BUILD_APPLICATION_INVALID
```

抛出发生在任何 build output write 之前。

## 6. Web Build Integration

`apps/web/scripts/build-secure.ts`：

```text
validate release ID
validate exact .p13-releases/<id> target
runBuildSecurityPreflight
log preflight HEAD status and diff count
check target absence
create isolated build config
Next build
signed manifest
```

不修改历史 `.next`。

## 7. Worker Build Integration

`apps/worker/scripts/build-secure.ts`：

```text
validate release ID
resolve configured Release Root
runBuildSecurityPreflight
log preflight
check target absence
tsc -> explicit Release Root
signed manifest
```

目标为 `apps/worker/dist` 时拒绝。

## 8. Build Identity 与 Manifest

不新增第二种身份系统。复用：

- Git SHA / dirty；
- Source Tree Digest；
- Dependency Lock Digest；
- Runtime Dependency Digest；
- Artifact Digest；
- Build Timestamp；
- Lifecycle Safety Version；
- `cleanupCapability=DISABLED`；
- Ed25519 signed Manifest；
- Release ID / Build ID。

历史 `.next`/dist 没有 P13 Manifest，因此：

- 不能通过 Startup Gate；
- 不会被认作新 Build；
- 目录存在本身不构成身份；
- Build ID/time stamp 不被作为信任替代品。

## 9. Failure Matrix

| 场景 | 行为 |
|---|---|
| Worktree source unsafe | Preflight fail，不 build |
| HEAD unsafe but worktree safe | Build allowed with difference logged；clean HEAD checkout will fail |
| Target `.next`/dist | Preflight fail |
| Web target not `.p13-releases/*` | Preflight fail |
| Target already exists | Preflight fail |
| Manifest missing | Startup Gate fail |
| Signature invalid | Startup Gate fail |
| Artifact digest mismatch | Startup Gate fail |
| Runtime Dependency mismatch | Startup Gate fail |
| Build failed after partial output | No fallback；manifest likely absent，Gate rejects |
| Worker bootstrap Gate fails | Business entry not loaded |
| Worker secure launcher invalid | Releases not spawned |

## 10. 测试设计

测试文件：

```text
apps/web/tests/p13-startup-preflight.test.ts
apps/web/tests/p13-release-security.test.ts
apps/worker/tests/legacy-cleanup-shutdown.test.ts
```

覆盖：

- secure worktree + HEAD；
- direct next start；
- wrapper/alias；
- direct Worker dist；
- Gate before business；
- Prisma/PgBoss static import before Gate；
- Gate failure no loader；
- Gate success order；
- unsafe HEAD with secure worktree；
- unknown wrapper command；
- legacy/non-isolated/existing build target；
- Web/Worker preflight before build；
- signed Manifest missing/invalid；
- Legacy cleanup/storage capability；
- Maintenance no-delete。

所有新增测试只使用 Mock 和 mkdtemp。

## 11. 已知限制

- 静态扫描无法证明任意动态生成命令；
- HEAD 内容通过 `git show` 读取，Git 不可用时标记为缺失/失败；
- 脏工作树构建会记录 `gitDirty=true`，生产是否接受由 Evidence/发布策略决定；
- 本阶段不执行真实 Build；
- 旧 Artifact 仍存在；
- Windows ACL 未修改；
- Production Trust Root/ACL 未验证。

## 12. 门禁

```text
Source Scanner:
IMPLEMENTED

Build Preflight:
IMPLEMENTED

Build Identity:
REUSES SIGNED MANIFEST

Legacy Reuse Protection:
FAIL-CLOSED

Real Build:
NOT EXECUTED

Next Phase:
NOT AUTHORIZED
```
