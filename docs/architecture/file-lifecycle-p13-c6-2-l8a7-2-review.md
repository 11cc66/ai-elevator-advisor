# P1-3 C-6.2-L8-A7.2 Final Source Baseline Promotion Review

## 1. 文档信息与总体结论

- 阶段：`C-6.2-L8-A7.2`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 审查性质：独立只读复核
- 总体结论：`FAIL`
- Commit Authorization：`NOT GRANTED`

当前工作树中的 A4 Web / Worker Startup Gate、A6 Signed Release 和构建
预检主机制未发现回归。

但 A7.1 的两个 P1 不能判定为完整修复：

1. 多类型扫描仍漏掉静态可读的可执行语法，包括 Shell 条件/子 shell/
   command substitution/字面 `eval`、PowerShell 条件与 ScriptBlock、
   CMD 条件/`for`、JavaScript 动态 require、括号属性 child_process
   调用和 `path.join` 构造的 Worker Entry。
2. HEAD 必选文件读取失败不会把 `head.complete` 设为 false；Build
   Preflight 在注入该失败后仍返回 PASS。

因此当前工作树不能作为最终安全源码基线提交。必须先获得独立修复授权，
再重新执行 A7.2 或后续独立验收。

## 2. 基线确认

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

工作树仍包含 A4-A7.1 及更早安全整改，未提交。

历史产物：

```text
apps/web/.next:
PRESENT

apps/worker/dist:
PRESENT
```

本轮没有移动、删除或执行历史产物。

## 3. P1-1 独立复核：多类型脚本扫描

### 3.1 已通过的正向覆盖

现有 `p13-startup-preflight.test.ts` 中直接基础形式通过：

- 简单 Shell 直接命令和变量命令；
- PowerShell `Start-Process`、`&` 和变量；
- CMD `CALL` 和变量；
- JavaScript spawn/alias/require/import/fork；
- 注释和显示字符串负向样例；
- alias 声明 UNKNOWN；
- HEAD-only 和工作树-only 脚本；
- 同名内容变化、删除、重命名；
- HEAD 枚举/额外脚本读取失败；
- worktree Junction。

独立执行：

```text
apps/web/tests/p13-startup-preflight.test.ts
30 tests PASS
```

### 3.2 独立内存输入验证

使用扫描器真实导出函数 `scanAuxiliaryScript()` 对静态字符串进行只读验证，
没有创建或执行脚本文件。

结果：

| 类型 | 输入 | 预期 | 实际 findings |
| -- | -- | -- | -- |
| Shell | `if [ -f .next ]; then next start; fi` | DANGEROUS | `[]` |
| Shell | `(next start)` | DANGEROUS | `[]` |
| Shell | `echo "$(next start)"` | DANGEROUS | `[]` |
| Shell | `eval "next start"` | DANGEROUS | `[]` |
| PowerShell | `if (Test-Path .next) { next start }` | DANGEROUS | `[]` |
| PowerShell | `Invoke-Command -ScriptBlock { next start }` | DANGEROUS | `[]` |
| CMD | `if exist .next next start` | DANGEROUS | `[]` |
| CMD | `for %%x in (a) do next start` | DANGEROUS | `[]` |
| JavaScript | `const name = process.env.MODULE; require(name);` | UNKNOWN | `[]` |
| JavaScript | `const cp = require("node:child_process"); cp["spawn"]("next", ["start"]);` | DANGEROUS | `[]` |
| JavaScript | `path.join("dist", "index.js")` 后传给 `spawn(process.execPath, [entry])` | UNKNOWN/DANGEROUS | `[]` |

这些输入是静态可读文本，不是只能运行时确定的代码。

### 3.3 根因

Shell / CMD：

- `commandSegments()` 只按 `&&`、`||`、`;`、`|`、`&` 分割；
- 不处理 `if ... then`、subshell、command substitution 或 `for do`
  的语法边界；
- `eval` 只在存在无法展开变量时可能产生 UNKNOWN，字面
  `eval "next start"` 不会被识别。

PowerShell：

- ScriptBlock 内容未递归扫描；
- 条件块中的裸命令没有进入 direct command 判定。

JavaScript：

- 只检查动态 `import()`，未检查非字面量 `require()`；
- child_process namespace 只覆盖点属性 `cp.spawn`，未覆盖
  `cp["spawn"]`；
- 参数展开只支持字符串和数组字面量，不支持 `path.join` 等确定性路径
  组合。

### 3.4 P1-1 结论

```text
A7.1 P1-1 Independent Review: FAIL
Shell Scanner Review: FAIL
PowerShell Scanner Review: FAIL
CMD/BAT Scanner Review: FAIL
JavaScript Scanner Review: FAIL
```

## 4. P1-2 独立复核：HEAD / 工作树完整性

### 4.1 当前真实扫描

独立执行：

```powershell
pnpm security:startup
```

结果：

```text
worktreeStatus: PASS
headStatus: FAIL
headVsWorktree: DIFFERENT
worktreeComplete: true
headComplete: true
worktreeScriptsEnumerated: 29
headScriptsEnumerated: 8
additionalWorktreeScriptsScanned: 25
additionalHeadScriptsScanned: 8
unknowns: 0
worktreeFindings: 0
```

HEAD 差异仍由未提交安全入口导致，结果符合预期。

### 4.2 已成立的部分

- HEAD 使用只读 `git ls-tree -r -z` 枚举；
- 工作树递归枚举；
- 两边使用相同脚本分类；
- HEAD-only / worktree-only / changed / removed 都进入 inventory；
- 额外 HEAD 脚本读取失败会将 `head.complete` 设为 false；
- HEAD 枚举失败会 fail closed。

因此结构性对称扫描成立。

### 4.3 新发现：HEAD 必选文件读取失败没有传播

注入：

```text
readRevision("apps/web/scripts/build-secure.ts") -> null
```

该文件属于固定 `REQUIRED_FILES`，模拟 Git 内容读取失败。

实际：

```text
worktreeStatus: PASS
headStatus: FAIL
headComplete: true
headFindingCodes:
  REQUIRED_FILE_MISSING
```

原因：

- `readVersion()` 对 HEAD 必选文件直接保存 `null`；
- `head.complete` 只由额外脚本 inventory 和 `scanScriptSet()` 决定；
- Build Preflight 只检查 `!report.head.complete`；
- HEAD 普通 FAIL 因“安全修改尚未提交”被允许，因此必选文件读取失败被
  当成普通旧 HEAD findings。

### 4.4 Build Preflight 仍通过的实证

使用同一注入调用真实 `runBuildSecurityPreflight()`，目标目录保持不存在：

```text
result: PREFLIGHT_PASS
headComplete: true
headStatus: FAIL
target created: false
```

这违反了任务要求：HEAD 内容无法完整读取时必须 fail closed。

### 4.5 P1-2 结论

```text
A7.1 P1-2 Independent Review: FAIL
HEAD/Worktree Scan Symmetry: PASS
Build Preflight Head Completeness: FAIL
```

结构性枚举对称已完成，但完整性错误传播仍不完整。

## 5. 扫描器边界独立审查

### 5.1 UNKNOWN

已发射 UNKNOWN 时：

- 会加入 worktree findings；
- 会使 worktree status 为 FAIL；
- 不会被计入 PASS。

```text
UNKNOWN Fail-Closed: PASS FOR EMITTED UNKNOWN
```

但 P1-1 漏掉的形式可能根本不产生 UNKNOWN，因此不能用该字段证明扫描覆盖
完整。

### 5.2 命令分隔符 / 条件块

```text
Shell separator/conditional bypass: CONFIRMED
PowerShell ScriptBlock bypass: CONFIRMED
CMD IF/FOR bypass: CONFIRMED
```

### 5.3 JavaScript 动态调用

```text
Dynamic require bypass: CONFIRMED
Bracket child_process call bypass: CONFIRMED
Path composition bypass: CONFIRMED
```

### 5.4 Package scripts

当前 root/Web/Worker package scripts：

```text
Web build = tsx scripts/build-secure.ts
Web start = node scripts/start-secure.mjs
Worker build = tsx scripts/build-secure.ts
Worker start = node scripts/start-secure.mjs
```

当前工作树没有发现正式 package script 直接使用旧入口。

Package script 的本地 Wrapper 目标检查存在且测试通过，但 Wrapper 的内容
扫描仍受上述 P1-1 缺陷影响。

### 5.5 注释和展示字符串

现有测试已覆盖：

- Shell comment / echo；
- PowerShell comment / `Write-Host`；
- CMD `REM` / `echo`；
- JavaScript comment / 普通字符串；
- `RegExp.prototype.exec()` 不误判。

未发现这类基础误报问题。

## 6. A4 / A6 安全机制复核

### 6.1 Web

事实：

- `apps/web/scripts/start-secure.mjs` 在 spawn Next 前调用
  `verifyStartupRelease()`；
- instrumentation 在 Node production runtime 再执行 Web Gate；
- `next.config.ts` 对 production build/server 强制隔离 dist；
- package build/start 使用 secure scripts；
- Web Storage runtime capability 不包含 delete；
- upload failure 保留 canonical/staging artifact。

结果：

```text
A4 Web Security Review: PASS
Web Gate Order: PASS
```

### 6.2 Worker

事实：

- Secure Launcher 先验证 Signed Release，后 spawn Release `index.js`；
- `bootstrap.ts` 先 Gate，后动态加载 `worker-entry.js`；
- `index.ts` 不静态导入 Prisma/PgBoss/业务入口；
- Gate 失败测试确认 business loader 调用次数为 0；
- Worker Storage capability 只读；
- Maintenance 不接收 Storage，不执行物理删除。

结果：

```text
A4 Worker Security Review: PASS
Worker Gate Order: PASS
```

### 6.3 Build Integrity / Manifest

已确认：

- preflight 在 builder 前；
- signing/Git identity 在 builder 前；
- target 必须不存在；
- Web target 必须为 `.p13-releases/<id>`；
- Worker target 不得为 `apps/worker/dist`；
- Signed Manifest、Source Tree、Dependency Lock、Runtime Dependency、
  Artifact Digest 仍复用统一体系；
- Artifact/Manifest/Runtime Dependency 篡改 fail closed；
- signing private key 不得位于 source/artifact tree；
- Reparse/Junction 前置检查在 builder 前；
- builder 失败无旧 Artifact fallback；
- build failure 后 success continuation 不执行。

结果：

```text
A6 Build Integrity Review: PASS
Manifest Review: PASS
Legacy Artifact Reuse Review: PASS
```

Build Preflight 的上述主路径通过，但因 HEAD 必选文件读取失败未传播：

```text
Build Preflight Review: FAIL
```

## 7. 独立测试结果

本轮实际执行：

```text
Web targeted:
3 files / 65 tests PASS

  p13-startup-preflight.test.ts: 30 PASS
  p13-release-security.test.ts: 30 PASS
  legacy-cleanup-shutdown.test.ts: 5 PASS

Worker:
6 files / 19 tests PASS

file-storage:
2 files / 19 tests PASS

Web TypeScript:
PASS

Worker TypeScript:
PASS

file-storage TypeScript:
PASS
```

这些测试证明已声明的测试用例通过，但不能覆盖本轮独立内存输入发现的
绕过形式。

## 8. 最终未提交文件分类

### 8.1 A：必须提交的安全修复源码

以下清单是修复 P1-1/P1-2 后的候选提交集合，不代表本轮授权提交。

#### A4/A6/A7.1 核心

| 文件 | 当前状态 | 目的 | 阶段 |
| -- | -- | -- | -- |
| `package.json` | MODIFIED | `security:startup` | A6 |
| `pnpm-lock.yaml` | MODIFIED | build-integrity workspace link | A6 |
| `apps/web/package.json` | MODIFIED | secure build/start | A4/A6 |
| `apps/worker/package.json` | MODIFIED | secure build/start | A4 |
| `apps/web/next.config.ts` | MODIFIED | production dist guard | A4 |
| `apps/worker/src/index.ts` | MODIFIED | Gate-first Bootstrap 入口 | A4 |
| `apps/worker/tsconfig.json` | MODIFIED | 纳入 build scripts | A6 |
| `packages/build-integrity/package.json` | UNTRACKED | 共享完整性包 | A6 |
| `packages/build-integrity/src/index.mjs` | UNTRACKED | Manifest/Digest/Gate | A6 |
| `packages/build-integrity/src/index.d.ts` | UNTRACKED | 类型契约 | A6 |
| `packages/build-integrity/src/startup-security.mjs` | UNTRACKED | 启动扫描/preflight | A6/A7.1 |
| `packages/build-integrity/src/script-security.mjs` | UNTRACKED | 类型化脚本扫描 | A7.1 |
| `apps/web/scripts/build-secure.ts` | UNTRACKED | Web secure build | A4/A6 |
| `apps/web/scripts/start-secure.mjs` | UNTRACKED | Web secure start | A4 |
| `apps/web/scripts/p13-startup-security/cli.ts` | UNTRACKED | 扫描 CLI | A6 |
| `apps/web/src/instrumentation.ts` | UNTRACKED | Web runtime Gate | A4 |
| `apps/web/src/server/security/startup-gate.ts` | UNTRACKED | Web Gate | A4 |
| `apps/worker/scripts/build-secure.ts` | UNTRACKED | Worker secure build | A4/A6 |
| `apps/worker/scripts/start-secure.mjs` | UNTRACKED | Worker secure start | A4 |
| `apps/worker/src/bootstrap.ts` | UNTRACKED | Gate-first Bootstrap | A4 |
| `apps/worker/src/security/startup-gate.ts` | UNTRACKED | Worker Gate | A4 |
| `apps/worker/src/worker-entry.ts` | UNTRACKED | Gate 后业务入口 | A4 |

#### 必要前置 Storage / Legacy cleanup 安全闭包

| 文件 | 当前状态 | 目的 | 阶段 |
| -- | -- | -- | -- |
| `apps/web/src/modules/files/download-service.ts` | MODIFIED | read capability | L6 |
| `apps/web/src/modules/files/upload-service.ts` | MODIFIED | Legacy delete fail-closed | L |
| `apps/web/src/server/files/storage.ts` | MODIFIED | Web runtime 无 delete | L6 |
| `apps/worker/src/config.ts` | MODIFIED | 测试环境 env 隔离 | L |
| `apps/worker/src/file-maintenance.ts` | MODIFIED | Maintenance 无 Storage | L6 |
| `apps/worker/src/file-processing.ts` | MODIFIED | read capability | L6 |
| `apps/worker/src/storage.ts` | MODIFIED | Worker read-only | L6 |
| `packages/file-storage/src/errors.ts` | MODIFIED | cleanup disabled error | L |
| `packages/file-storage/src/index.ts` | MODIFIED | capability exports | L6 |
| `packages/file-storage/src/local-private-storage.ts` | MODIFIED | 移除普通 delete | L6 |
| `packages/file-storage/src/capabilities.ts` | UNTRACKED | 最小 capability | L6 |
| `packages/file-storage/src/legacy-cleanup.ts` | UNTRACKED | quarantine delete API | L |

### 8.2 B：必须提交的测试

| 文件 | 状态 | 目的 |
| -- | -- | -- |
| `apps/web/tests/p13-release-security.test.ts` | UNTRACKED | Manifest/Gate/Worker Bootstrap |
| `apps/web/tests/p13-startup-preflight.test.ts` | UNTRACKED | Scanner/Preflight |
| `apps/web/tests/legacy-cleanup-shutdown.test.ts` | UNTRACKED | Web delete/commit-unknown |
| `apps/web/tests/e2e/global-setup.ts` | MODIFIED | test-only Worker entry |
| `apps/web/tests/integration/phase32-upload-service.test.ts` | MODIFIED | capability 契约 |
| `apps/web/tests/integration/phase34-file-processing.test.ts` | MODIFIED | capability 契约 |
| `apps/web/tests/integration/phase35-lease-renewal.test.ts` | MODIFIED | capability 契约 |
| `apps/web/tests/integration/phase35-processing-reliability.test.ts` | MODIFIED | capability 契约 |
| `apps/worker/tests/legacy-cleanup-shutdown.test.ts` | UNTRACKED | Worker non-delete |
| `apps/worker/tests/storage-capability.test.ts` | UNTRACKED | Worker read-only |
| `apps/worker/tests/test-worker-entry.ts` | UNTRACKED | E2E-only entry |
| `packages/file-storage/tests/local-private-storage.test.ts` | MODIFIED | storage capability |
| `packages/file-storage/tests/capabilities.test.ts` | UNTRACKED | capability tests |

### 8.3 C：应提交的架构设计和实施报告

| 文件 | 状态 | 阶段 |
| -- | -- | -- |
| `docs/architecture/file-lifecycle-p13-c6-2-l8a4-design.md` | UNTRACKED | A4 |
| `docs/architecture/file-lifecycle-p13-c6-2-l8a4-report.md` | UNTRACKED | A4 |
| `docs/architecture/file-lifecycle-p13-c6-2-l8a5-design.md` | UNTRACKED | A5 |
| `docs/architecture/file-lifecycle-p13-c6-2-l8a5-report.md` | UNTRACKED | A5 |
| `docs/architecture/file-lifecycle-p13-c6-2-l8a6-design.md` | UNTRACKED | A6 |
| `docs/architecture/file-lifecycle-p13-c6-2-l8a6-report.md` | UNTRACKED | A6 |
| `docs/architecture/file-lifecycle-p13-c6-2-l8a7-review.md` | UNTRACKED | A7 |
| `docs/architecture/file-lifecycle-p13-c6-2-l8a7-1-design.md` | UNTRACKED | A7.1 |
| `docs/architecture/file-lifecycle-p13-c6-2-l8a7-1-report.md` | UNTRACKED | A7.1 |
| `docs/architecture/file-lifecycle-p13-c6-2-l8a7-2-review.md` | UNTRACKED | A7.2 |
| `docs/architecture/file-lifecycle-p13-implementation-status.md` | UNTRACKED | 状态总览 |

注意：Implementation Status 引用了更早的 L/C 系列架构文档。若只提交
上述 C 列表，链接会指向未提交文件。因此文档提交必须选择：

- 一并提交被引用的完整 `docs/architecture/` 文档基线；或
- 在后续授权中做一个只保留已提交链接的精简状态文档。

### 8.4 D：暂不纳入本安全源码提交的辅助文档

以下文件属于更早 C-6.2/L 阶段设计或证据记录，当前工作树中是
UNTRACKED。它们不是 A4-A7.1 运行时代码依赖，但若提交完整
Implementation Status，需要统一决定：

```text
docs/architecture/file-lifecycle-p13-c5-1-revision.md
docs/architecture/file-lifecycle-p13-c6-2-c2-decisions.md
docs/architecture/file-lifecycle-p13-c6-2-f-report.md
docs/architecture/file-lifecycle-p13-c6-2-g-design.md
docs/architecture/file-lifecycle-p13-c6-2-g-report.md
docs/architecture/file-lifecycle-p13-c6-2-h-report.md
docs/architecture/file-lifecycle-p13-c6-2-i-report.md
docs/architecture/file-lifecycle-p13-c6-2-j-design.md
docs/architecture/file-lifecycle-p13-c6-2-j-report.md
docs/architecture/file-lifecycle-p13-c6-2-k-design.md
docs/architecture/file-lifecycle-p13-c6-2-k-report.md
docs/architecture/file-lifecycle-p13-c6-2-l-design.md
docs/architecture/file-lifecycle-p13-c6-2-l-report.md
docs/architecture/file-lifecycle-p13-c6-2-l1-design.md
docs/architecture/file-lifecycle-p13-c6-2-l1-report.md
docs/architecture/file-lifecycle-p13-c6-2-l2-design.md
docs/architecture/file-lifecycle-p13-c6-2-l2-report.md
docs/architecture/file-lifecycle-p13-c6-2-l3-design.md
docs/architecture/file-lifecycle-p13-c6-2-l3-report.md
docs/architecture/file-lifecycle-p13-c6-2-l4-design.md
docs/architecture/file-lifecycle-p13-c6-2-l4-report.md
docs/architecture/file-lifecycle-p13-c6-2-l5-design.md
docs/architecture/file-lifecycle-p13-c6-2-l5-report.md
docs/architecture/file-lifecycle-p13-c6-2-l6-design.md
docs/architecture/file-lifecycle-p13-c6-2-l6-report.md
docs/architecture/file-lifecycle-p13-c6-2-l7-design.md
docs/architecture/file-lifecycle-p13-c6-2-l7-report.md
docs/architecture/file-lifecycle-p13-c6-2-l8a-admin-evidence-guide.md
docs/architecture/file-lifecycle-p13-c6-2-l8a-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a-report.md
docs/architecture/file-lifecycle-p13-c6-2-l8a2-local-inventory-report.md
docs/architecture/file-lifecycle-p13-c6-2-l8a3-risk-review.md
docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md
docs/architecture/file-lifecycle-p13-design-freeze.md
```

### 8.5 E：必须排除

| 路径 | 状态 | 排除理由 |
| -- | -- | -- |
| `apps/web/next-env.d.ts` | MODIFIED | Next 生成文件，受保护 |
| `apps/web/tsconfig.tsbuildinfo` | PRESENT / IGNORED | TypeScript 缓存 |
| `apps/web/.next` | PRESENT / IGNORED | 历史构建产物 |
| `apps/worker/dist` | PRESENT / IGNORED | 历史构建产物 |
| `prisma/schema.prisma` | MODIFIED | 数据库结构变更，不属于本安全源码提交 |
| `prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/` | UNTRACKED | P1-3 Schema Migration |
| `prisma/migrations/20261117130000_phase37_p13_lifecycle_insert_guard/` | UNTRACKED | Trigger A Migration |
| `prisma/migrations/20261117140000_phase37_p13_lifecycle_initial_state_guard/` | UNTRACKED | Trigger B Migration |
| `apps/web/scripts/p13-build-audit/` | UNTRACKED | L2 辅助审计工具 |
| `apps/web/scripts/p13-db-tests/` | UNTRACKED | DB 测试工具 |
| `apps/web/scripts/p13-deployment-evidence/` | UNTRACKED | L8-A Evidence 工具 |
| `apps/web/scripts/p13-storage-delete-audit/` | UNTRACKED | Storage 删除审计 |
| `apps/web/scripts/p13-storage-inventory/` | UNTRACKED | Storage 盘点 |
| `apps/web/tests/p13-a-migration.test.ts` | UNTRACKED | Migration 测试 |
| `apps/web/tests/p13-b-migration.test.ts` | UNTRACKED | Migration 测试 |
| `apps/web/tests/p13-build-audit.test.ts` | UNTRACKED | L2 工具测试 |
| `apps/web/tests/p13-db-tooling.test.ts` | UNTRACKED | DB 工具测试 |
| `apps/web/tests/p13-deployment-evidence.test.ts` | UNTRACKED | Evidence 工具测试 |
| `apps/web/tests/p13-deployment-evidence-bundle.test.ts` | UNTRACKED | Evidence bundle 测试 |
| `apps/web/tests/p13-storage-delete-audit.test.ts` | UNTRACKED | Storage 审计测试 |
| `apps/web/tests/p13-storage-inventory.test.ts` | UNTRACKED | Storage 盘点测试 |
| `.env`、`.env.test` | PRESENT / NOT READ | 禁止读取或提交 |
| `node_modules` | IGNORED | 依赖 |
| coverage / test-results / `.p13-build` / `.p13-releases` | IGNORED / ABSENT | 生成物 |

## 9. 提交清单一致性问题

### 9.1 `apps/web/package.json` 与排除项冲突

当前 package 文件包含：

```text
p13:evidence:validate =
  tsx scripts/p13-deployment-evidence/cli.ts
```

但本报告建议排除 `apps/web/scripts/p13-deployment-evidence/`。

如果整文件提交而不提交该目录，干净 checkout 会留下不可执行的 package
script。

提交前必须二选一：

- 将该 Evidence 工具作为同一文档/工具提交包含；
- 或在后续授权中只暂存 A6/A7.1 所需的 package JSON hunk。

当前不允许用 `git add .` 或整文件盲目提交。

### 9.2 Implementation Status 文档引用

Implementation Status 引用大量 D 类文档。若只提交 C 类文档，状态文档
会出现未提交的引用目标。

建议把文档作为独立 commit，并一次性解决完整架构文档引用闭包。

## 10. 推荐后续顺序

1. 独立授权修复 A7.2 的 P1-1 和 P1-2。
2. 新增负向测试覆盖本报告列出的静态绕过。
3. 重新执行 A7.2 独立复核。
4. 复核通过后，再按精确文件清单提交；不得使用 `git add .`。
5. 文档单独提交，并解决 Implementation Status 引用闭包。

在 P1-1/P1-2 修复前，不得把当前工作树称为最终安全源码基线。

## 11. 最终验收字段

```yaml
A7.1 P1-1 Independent Review: FAIL
A7.1 P1-2 Independent Review: FAIL
Shell Scanner Review: FAIL
PowerShell Scanner Review: FAIL
CMD/BAT Scanner Review: FAIL
JavaScript Scanner Review: FAIL
HEAD/Worktree Symmetry: PASS
UNKNOWN Fail-Closed: PASS
A4 Web Security Review: PASS
A4 Worker Security Review: PASS
A6 Build Integrity Review: PASS
Manifest Review: PASS
Build Preflight Review: FAIL
Legacy Artifact Reuse Review: PASS
Commit Inventory: COMPLETE
Protected File Integrity: PASS
Working Tree Startup Gate: PASS
HEAD Startup Gate: FAIL
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

本报告 SHA-256 在最终交付消息中提供。
