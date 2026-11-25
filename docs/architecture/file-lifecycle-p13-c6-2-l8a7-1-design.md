# P1-3 C-6.2-L8-A7.1 Startup Security Scanner Coverage Remediation Design

## 1. 文档信息

- 阶段：`C-6.2-L8-A7.1`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 性质：扫描器覆盖修复、构建预检调用级测试与文档
- 设计状态：`IMPLEMENTED / TESTED / NO REAL BUILD`

## 2. 目标与边界

本设计修复 A7 发现的两个 P1 覆盖问题：

1. Shell、PowerShell、CMD/BAT 不能继续只依赖 JavaScript
   `spawn/exec` 正则。
2. Git HEAD 不能只检查固定必需文件，必须与工作树使用同一套脚本枚举
   和扫描规则。

同时补强：

- JavaScript 间接调用和 import 形式；
- UNKNOWN fail-closed；
- 构建预检调用级 Mock；
- 构建前置 Reparse/Junction 检查。

本设计不改变已通过的 Web / Worker 运行时信任模型，不执行真实 Build，
不启动服务，不处置历史产物。

## 3. 扫描器结构

### 3.1 脚本分类

新增：

```text
packages/build-integrity/src/script-security.mjs
```

按扩展名分类：

| 类型 | 扩展名 |
| -- | -- |
| Shell | `.sh` |
| PowerShell | `.ps1` |
| CMD/BAT | `.cmd`、`.bat` |
| JavaScript/TypeScript 脚本 | `.js`、`.mjs`、`.cjs`、`.ts`、`.tsx` |

扫描范围：

- `scripts/**/*`；
- `apps/*/scripts/**/*`；
- `apps/**` 下任何 `.sh`、`.ps1`、`.cmd`、`.bat`；
- 固定必需启动文件继续由专用安全审计处理。

排除：

```text
node_modules
.git
.next
.p13-build
.p13-releases
dist
build
out
coverage
test-results
tests
docs
```

### 3.2 类型专用扫描

#### Shell

轻量扫描：

- 去除注释；
- 展开简单变量赋值；
- 合并反斜杠续行；
- 识别命令分隔符；
- 识别直接 `next start`；
- 识别 `node ... dist/index.js`；
- 递归检查 `sh/bash/zsh/dash -c`；
- 对无法解析的变量命令标记 UNKNOWN。

#### PowerShell

轻量扫描：

- 去除行注释和 block comment；
- 展开简单变量；
- 处理反引号续行；
- 识别直接命令；
- 识别 `&` 调用运算符；
- 识别 `Start-Process`；
- 识别 `Invoke-Expression` / `iex`；
- 识别 `cmd /c` 和 PowerShell `-Command`；
- 无法解析的动态执行标记 UNKNOWN。

#### CMD/BAT

轻量扫描：

- 去除 `REM` 和 `::`；
- 展开简单 `%VAR%`；
- 处理 `^` 续行；
- 识别 `next start`；
- 识别 `node ... dist\index.js`；
- 识别 `call`、`start` 和 `cmd /c`；
- 无法解析的动态命令标记 UNKNOWN。

#### JavaScript

保留并扩展：

- `spawn`、`spawnSync`；
- `exec`、`execSync`；
- `execFile`、`execFileSync`；
- `fork`；
- static import；
- re-export；
- require；
- dynamic import；
- import alias；
- `child_process` namespace alias；
- `require("node:child_process").exec(...)`。

调用中的简单字符串和数组变量会进行本地展开。存在无法确定的第一参数时
标记 UNKNOWN。

## 4. UNKNOWN 策略

### 4.1 分类

```text
DANGEROUS
  已确认会启动 next、Worker dist 或 Worker runtime entry。

UNKNOWN
  观察到进程执行、动态导入或未扫描本地 Wrapper，但静态分析不能确定
  最终命令。

ERROR
  枚举、读取或 Git 查询失败。
```

### 4.2 门禁

- 当前工作树存在 DANGEROUS、UNKNOWN 或 ERROR 时，worktree status 为
  `FAIL`。
- HEAD 读取或枚举失败时，head complete 为 `false`，build preflight
  以 `BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE` fail closed。
- 当前 HEAD 因旧正式入口产生的普通 findings 仍允许工作树安全构建，但
  必须进入差异报告；这区别于“HEAD 无法读取”。

该策略是保守的静态门禁，不宣称完成通用程序语义分析。

## 5. HEAD / 工作树对称枚举

生产模式使用：

```text
git ls-tree -r -z HEAD -- apps scripts
```

读取 HEAD 脚本清单；工作树使用递归文件系统枚举。

两边：

- 使用相同 `isRelevantExecutableScript()`；
- 使用相同类型扫描器；
- 拒绝脚本根中的 Symlink/Junction；
- 分别记录完整脚本清单和扫描状态。

输出：

```text
scriptInventory.worktree
scriptInventory.head
scriptInventory.added
scriptInventory.removed
scriptInventory.changed
differences
unknowns
```

HEAD 独有、工作树独有、同名内容变化、删除和重命名均进入差异。

## 6. Package Script 间接入口

统一扫描 root/Web/Worker package scripts：

- Web/Worker `build`/`start` 必须精确使用 secure scripts；
- 任何脚本不得包含直接 `next start` 或 `node ... dist/index.js`；
- 引用本地 Wrapper 时，目标必须存在于对应 revision 的脚本清单；
- 未纳入扫描清单的本地 Wrapper 标记
  `PACKAGE_SCRIPT_TARGET_UNSCANNED` / UNKNOWN；
- 已知历史 Worker dist 直接启动继续由 DANGEROUS 规则处理。

## 7. Guarded Build

新增：

```text
executeGuardedBuild({
  runPreflight,
  verifyBuildIdentity,
  build,
  afterSuccessfulBuild
})
```

顺序固定：

```text
preflight
  -> build identity / signing configuration
  -> builder
  -> optional success continuation
```

任一前置步骤失败时：

- builder 不被调用；
- success continuation 不被调用；
- 不存在旧 Artifact fallback。

Web/Worker secure build 均改用该执行器。

构建前还完成：

- Git SHA / dirty identity；
- signing key ID；
- signing private key path 边界检查；
- 私钥必须是普通文件；
- 私钥不得位于 source 或 artifact tree。

## 8. Reparse / Junction 前置检查

`runBuildSecurityPreflight()` 在 builder 前检查：

- target root；
- Web `.p13-build/<releaseId>`；
- 传入的其他 `newWritePaths`；
- 所有已存在的祖先目录。

规则：

- 不存在的后续路径可以停止检查；
- 已存在祖先不得是 Symlink/Junction/Reparse Point；
- 已存在祖先不得是普通文件；
- target 或其他新写路径已存在时拒绝；
- 检查失败时 builder 调用次数必须为 0。

Manifest 阶段的路径检查继续保留，作为 defense-in-depth。

## 9. 测试策略

使用：

- Vitest；
- `mkdtemp` 临时工作区；
- temporary Junction；
- Mock `child_process`；
- Mock preflight/identity/builder；
- HEAD content injection；
- Git 实仓库只读扫描 CLI。

不执行：

- 真实 Web/Worker Build；
- Web/Worker 启动；
- DB；
- SQL/Migration；
- 真实 Storage；
- Cleanup。

## 10. 能力边界

本实现不是完整 AST、shell parser 或跨程序调用图分析器。

仍无法证明：

- 运行时 eval 生成的任意命令；
- 操作系统中被改写的命令解析结果；
- 脚本之外由外部工具执行的非文件命令；
- 所有跨文件高阶函数和动态属性访问。

对于可观测但无法确定的执行，扫描器必须标记 UNKNOWN 并使正式工作树/
构建门禁失败，而不是当作文档字符串忽略。

## 11. 设计门禁

```text
Shell Scanner:
IMPLEMENTED

PowerShell Scanner:
IMPLEMENTED

CMD/BAT Scanner:
IMPLEMENTED

HEAD/Worktree Symmetry:
IMPLEMENTED

UNKNOWN Fail-Closed:
IMPLEMENTED

Guarded Build:
IMPLEMENTED / MOCK TESTED

Reparse Preflight:
IMPLEMENTED / MOCK TESTED

Real Build:
NOT EXECUTED

Next Phase:
NOT AUTHORIZED
```
