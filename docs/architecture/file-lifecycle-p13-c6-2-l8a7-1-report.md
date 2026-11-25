# P1-3 C-6.2-L8-A7.1 Startup Security Scanner Coverage Remediation Report

## 1. 最终结论

- 阶段：`C-6.2-L8-A7.1`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 总体结论：`PASS`

A7 指出的两个 P1 覆盖缺口已修复：

1. Shell、PowerShell、CMD/BAT 现在使用各自的轻量扫描规则，不再依赖
   JavaScript `spawn/exec` 正则。
2. HEAD 与工作树现在分别枚举同类脚本集合，使用同一分类和扫描规则，
   并完整记录新增、删除、重命名和内容变化。

同时完成：

- JavaScript require/import/re-export/alias/dynamic import 补强；
- UNKNOWN 阻断安全门禁；
- Package script 本地 Wrapper 目标检查；
- Build Preflight 调用级 Mock；
- Build target/父目录 Reparse 前置检查；
- Signing key 路径边界前置检查。

当前工作树扫描结果：

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

HEAD 仍为 `FAIL`，因为安全源码尚未提交，HEAD 仍包含旧
`next start`、`node dist/index.js` 和旧 Worker 直接启动逻辑。这是预期
差异，不是本轮失败。

## 2. 修改文件

新增：

```text
packages/build-integrity/src/script-security.mjs
docs/architecture/file-lifecycle-p13-c6-2-l8a7-1-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-1-report.md
```

修改：

```text
packages/build-integrity/src/startup-security.mjs
packages/build-integrity/src/index.mjs
packages/build-integrity/src/index.d.ts
apps/web/scripts/build-secure.ts
apps/worker/scripts/build-secure.ts
apps/web/scripts/p13-startup-security/cli.ts
apps/web/tests/p13-startup-preflight.test.ts
docs/architecture/file-lifecycle-p13-implementation-status.md
```

未修改：

- Prisma Schema；
- 任何 Migration；
- Web/Worker Startup Gate 的信任判定逻辑；
- 生产业务写入链；
- `.next`；
- Worker `dist`；
- Windows ACL、角色、Service 或 Task Scheduler。

## 3. P1 修复：脚本类型专用扫描

### 3.1 Shell

实现位置：

```text
packages/build-integrity/src/script-security.mjs
  scanShell()
```

覆盖：

- 注释移除；
- 反斜杠续行；
- 简单变量赋值与 `$VAR` / `${VAR}` 展开；
- 命令分隔符；
- 直接 `next start`；
- `node dist/index.js`；
- `node ./dist/index.js`；
- `node ../apps/worker/dist/index.js`；
- `command`、`exec`、`nohup`、`sudo`、`time`、`env`；
- `pnpm/npm/yarn/bunx/npx/corepack` Wrapper；
- `sh/bash/zsh/dash -c`；
- alias 声明；
- 无法解析的变量命令。

结果：

```text
Shell Raw Command Scan: PASS
```

### 3.2 PowerShell

实现位置：

```text
scanPowerShell()
```

覆盖：

- 行注释和 block comment；
- 续行；
- `$VAR` / `${VAR}`；
- 直接命令；
- `&` 调用运算符；
- `Start-Process`；
- `Invoke-Expression` / `iex`；
- `cmd /c`；
- `Set-Alias` / `New-Alias`；
- 无法解析的动态执行。

结果：

```text
PowerShell Raw Command Scan: PASS
```

### 3.3 CMD / BAT

实现位置：

```text
scanCmd()
```

覆盖：

- `REM`、`::`；
- `^` 续行；
- `%VAR%`；
- delayed expansion `!VAR!`；
- 直接命令；
- `call` / `start`；
- `cmd /c`；
- DOSKEY alias；
- 无法解析的动态命令。

结果：

```text
CMD/BAT Raw Command Scan: PASS
```

### 3.4 JavaScript

实现位置：

```text
scanJavaScript()
```

覆盖：

- `spawn`；
- `spawnSync`；
- `exec`；
- `execSync`；
- `execFile`；
- `execFileSync`；
- `fork`；
- static import；
- re-export；
- require；
- dynamic import；
- destructured import/require；
- namespace import；
- `require("node:child_process").exec(...)`；
- 简单字符串和数组参数展开；
- process function alias；
- require alias；
- Worker Entry fork/import；
- 无法解析的动态调用和 import。

同时避免把以下普通对象方法误判成子进程执行：

```text
RegExp.prototype.exec()
```

结果：

```text
JavaScript Wrapper Scan: PASS
```

## 4. 覆盖矩阵

| 形式 | Shell | PowerShell | CMD/BAT | JavaScript |
| -- | -- | -- | -- | -- |
| 直接 `next start` | YES | YES | YES | YES |
| Worker dist 直接执行 | YES | YES | YES | YES |
| 简单变量展开 | YES | YES | YES | YES |
| 命令包装器 | YES | YES | YES | YES |
| alias | UNKNOWN | UNKNOWN | UNKNOWN | YES/UNKNOWN |
| 注释忽略 | YES | YES | YES | YES |
| 显示字符串不误报 | YES | YES | YES | YES |
| 无法确定时 UNKNOWN | YES | YES | YES | YES |

“YES/UNKNOWN”表示静态可解析时追踪，不能解析时 fail closed。

## 5. HEAD 与工作树对称扫描

### 5.1 HEAD 枚举

实现使用只读 Git：

```text
git ls-tree -r -z HEAD -- apps scripts
```

处理：

- 文件 mode；
- symlink / junction mode；
- 路径过滤；
- 扩展名分类；
- shebang 识别的无扩展名脚本。

### 5.2 工作树枚举

递归扫描：

```text
apps/**
scripts/**
```

并：

- 排除依赖、历史构建、tests、docs；
- 拒绝脚本根中的 Symlink/Junction；
- 记录读取失败；
- 对相同分类使用相同扫描器。

### 5.3 完整差异

当前扫描输出：

```text
HEAD scripts: 8
Worktree scripts: 29
Added:
  apps/web/scripts/build-secure.ts
  apps/web/scripts/p13-build-audit/cli.ts
  apps/web/scripts/p13-build-audit/scanner.ts
  apps/web/scripts/p13-db-tests/barrier.ts
  apps/web/scripts/p13-db-tests/capabilities.ts
  apps/web/scripts/p13-db-tests/fixture-builder.ts
  apps/web/scripts/p13-db-tests/harness.ts
  apps/web/scripts/p13-db-tests/index.ts
  apps/web/scripts/p13-db-tests/types.ts
  apps/web/scripts/p13-deployment-evidence/cli.ts
  apps/web/scripts/p13-deployment-evidence/evidence-bundle.ts
  apps/web/scripts/p13-deployment-evidence/evidence.ts
  apps/web/scripts/p13-deployment-evidence/requirements.ts
  apps/web/scripts/p13-startup-security/cli.ts
  apps/web/scripts/p13-storage-delete-audit/cli.ts
  apps/web/scripts/p13-storage-delete-audit/scanner.ts
  apps/web/scripts/p13-storage-inventory/cli.ts
  apps/web/scripts/p13-storage-inventory/inventory.ts
  apps/web/scripts/start-secure.mjs
  apps/worker/scripts/build-secure.ts
  apps/worker/scripts/start-secure.mjs

Removed: 0
Changed same-name scripts: 0
```

固定 11 个安全文件仍参与专用内容比较，因此 `differences` 同时包含
entry/config 差异和完整脚本清单差异。

结果：

```text
HEAD Full Script Enumeration: PASS
Worktree Full Script Enumeration: PASS
HEAD/Worktree Scan Symmetry: PASS
HEAD-Only Wrapper Detection: PASS
Worktree-Only Wrapper Detection: PASS
```

## 6. UNKNOWN 语义

当前 findings 分类：

```text
DANGEROUS:
  明确启动 forbidden entry。

UNKNOWN:
  观察到无法静态解析的进程执行、alias、动态 import 或未扫描 Wrapper。

ERROR:
  枚举、读取或 Git 查询失败。
```

规则：

- 任一分类均使当前工作树 status 为 `FAIL`；
- UNKNOWN 不计入 PASS；
- HEAD 无法完整枚举/读取时 build preflight 失败；
- 当前实际工作树 `unknowns = 0`；
- 测试已覆盖 Shell、JS、PowerShell、CMD 的 UNKNOWN 和
  alias 场景。

结果：

```text
UNKNOWN Fail-Closed: PASS
```

## 7. Package Script 间接入口

检查 root/Web/Worker package scripts 中的本地 Wrapper 目标。

规则：

- Web/Worker build/start 必须精确使用 secure scripts；
- 直接 forbidden entry 失败；
- 本地 Wrapper 必须在对应 revision 的脚本清单中；
- 未扫描本地 Wrapper 标记
  `PACKAGE_SCRIPT_TARGET_UNSCANNED` / UNKNOWN；
- 测试历史 Worker `dist/index.js` 仍由 DANGEROUS 检查处理。

测试覆盖：

- 未知本地 Wrapper；
- HEAD 独有 Wrapper；
- 工作树独有 Wrapper；
- 同名内容变化；
- 删除和重命名。

结果：

```text
Indirect Invocation Analysis: PASS
```

该结论限于已定义的静态脚本和 Package script 入口，不代表完整程序语义
分析。

## 8. Guarded Build 调用级测试

新增：

```text
executeGuardedBuild()
```

Web/Worker secure build 均使用该执行器。

执行顺序：

```text
preflight
  -> signing/Git build identity
  -> builder
  -> optional success continuation
```

调用级测试验证：

| 场景 | Builder 调用 |
| -- | -- |
| Preflight 成功 | 1 |
| Preflight 失败 | 0 |
| HEAD 审计不完整 | 0 |
| Manifest identity 缺失 | 0 |
| Build identity mismatch | 0 |
| Signing key 跨界 | 0 |
| Target 已存在 | 0 |
| Reparse/Junction 失败 | 0 |
| Builder 失败后的 success continuation | 0 |

Builder 被调用后若失败，不会调用 success continuation，也没有旧
`.next` / Worker `dist` fallback 分支。

结果：

```text
Build Preflight Call-Order Tests: PASS
Build Failure Fallback Tests: PASS
```

## 9. Reparse / Junction 前置检查

`runBuildSecurityPreflight()` 在 builder 前对：

- target root；
- Web `.p13-build/<releaseId>`；
- 其他 `newWritePaths`；
- 所有已存在祖先目录；

逐级执行 `lstat`。

拒绝：

- Symlink；
- Junction；
- Reparse Point；
- 非目录祖先；
- 已存在的 target；
- 已存在的辅助写目录。

不存在的后续路径允许当前层停止，但不会跳过已存在祖先检查。

Signing private key 也使用统一边界检查：

- 不得位于 source tree；
- 不得位于 artifact tree；
- 不得经过 Reparse；
- 必须是普通文件。

结果：

```text
Reparse Preflight Ordering: PASS
```

## 10. 测试结果

### Web

```text
24 files / 180 tests PASS
```

新增扫描与 Guarded Build 测试：

```text
apps/web/tests/p13-startup-preflight.test.ts
30 tests PASS
```

覆盖：

- Shell 直接与变量命令；
- PowerShell Start-Process、`&` 和变量；
- CMD CALL 和变量；
- JavaScript spawn/alias/require/import/fork/dynamic import；
- 注释和显示字符串不误报；
- HEAD-only Shell/PowerShell/CMD/shebang 脚本；
- worktree-only；
- 同名内容变化；
- 删除和重命名；
- HEAD 读取失败；
- HEAD 枚举失败；
- 工作树 Junction；
- UNKNOWN；
- package script 未扫描 Wrapper；
- script-type alias；
- Guarded Build 全部调用顺序；
- 已存在 target 和 Reparse target；
- builder failure no continuation。

### Worker

```text
6 files / 19 tests PASS
```

### file-storage

```text
2 files / 19 tests PASS
```

### TypeScript

```text
Web: PASS
Worker: PASS
file-storage: PASS
```

均使用 `--noEmit --incremental false`。

### JavaScript Syntax

```text
script-security.mjs: PASS
startup-security.mjs: PASS
index.mjs: PASS
```

结果：

```text
Regression Tests: PASS
TypeScript: PASS
```

## 11. 安全边界与未执行项

本轮未执行：

- 真实 Web Build；
- 真实 Worker Build；
- Web / Worker 启动；
- E2E；
- Integration；
- PostgreSQL；
- SQL / Migration；
- 真实 Storage；
- Cleanup；
- 历史 Artifact 移动、删除或执行；
- Windows ACL / Registry / Service / Task Scheduler 修改；
- Git 写操作。

扫描器不是完整 AST、shell parser 或跨程序调用图分析器。

仍需承认：

- 运行时生成的任意命令无法完全静态证明；
- 外部二进制或未知解释器不在可读文本扫描范围；
- Node 之外的语言级动态反射不在当前范围；
- 只能保证对已枚举可读脚本采用保守 fail-closed 规则。

这些限制没有重新打开 A7 的两个 P1：

- Shell/PowerShell/CMD 原始命令现在有类型专用扫描；
- HEAD 与工作树现在完整枚举同类脚本并对称比较。

## 12. 受保护文件

测试前后一致：

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

历史产物仍在：

```text
apps/web/.next:
PRESENT / 1,413 files / 446,890,260 bytes

apps/worker/dist:
PRESENT / 32 files / 135,078 bytes
```

## 13. 修改源码哈希

```text
packages/build-integrity/src/script-security.mjs
BAC310834EEE984238D114F95FEF16DCE492170FE386B27826C957AAEBDA7783

packages/build-integrity/src/startup-security.mjs
08C1BCF69AEEC9E22CE4E3E7EBF1DB385A2CFDD6CFE9E010CF93F69B439DCE18

packages/build-integrity/src/index.mjs
89A88FB7F190AEEAC02F191040DB72617F32459FA5D24AF04576A35563E08945

packages/build-integrity/src/index.d.ts
7CED89567838D5C064FBE1FF2AE9DAE6739ACDB8698C6C78DF8738E1A46B62E6

apps/web/scripts/build-secure.ts
4B99402BFE8CE5E5D3D57C41457F98EC24ECD0DEA1EFEA5969299A0070258390

apps/worker/scripts/build-secure.ts
5CFB1E8CF30653A519EABB061E6A1ED5F6FC59B81A8B4097BE1168DF76188425

apps/web/scripts/p13-startup-security/cli.ts
53C56873057651415402AC9AF380562824D75E6BC4960EB7B747257D17502F44

apps/web/tests/p13-startup-preflight.test.ts
F047A1FF5A712C73B85BEC004203E0E2477344D20D3D9894ED4D9FEFA49DF123

docs/architecture/file-lifecycle-p13-c6-2-l8a7-1-design.md
8479068C22805A79BE0D5D89B077308499412C0E9E5ACD224B2BBF966E42A371
```

## 14. A6 重新评估

```text
A6 Scanner Coverage:
PARTIAL -> PASS

A6 Runtime Startup Gate:
PASS / UNCHANGED

A6 Build Preflight:
PASS / CALL-LEVEL MOCK TESTED

A6 Legacy Artifact Reuse Protection:
PASS

A6 Real Build Verification:
NOT EXECUTED

A6 Production Security:
NOT VERIFIED
```

A6 可以结束“扫描器覆盖不足导致的 PARTIAL”，但真实构建、生产 Trust
Root、Runtime Identity 和生产 ACL 仍需未来独立授权验证。

## 15. 最终验收字段

```yaml
Shell Raw Command Scan: PASS
PowerShell Raw Command Scan: PASS
CMD/BAT Raw Command Scan: PASS
JavaScript Wrapper Scan: PASS
HEAD Full Script Enumeration: PASS
Worktree Full Script Enumeration: PASS
HEAD/Worktree Scan Symmetry: PASS
HEAD-Only Wrapper Detection: PASS
Worktree-Only Wrapper Detection: PASS
Indirect Invocation Analysis: PASS
UNKNOWN Fail-Closed: PASS
Build Preflight Call-Order Tests: PASS
Build Failure Fallback Tests: PASS
Reparse Preflight Ordering: PASS
Legacy Artifact Reuse Protection: PASS
Regression Tests: PASS
TypeScript: PASS
Real Build: NOT EXECUTED
Legacy Artifact: NOT MOVED / NOT DELETED / NOT EXECUTED
Database: NOT CONNECTED
Storage: NOT ACCESSED
Windows ACL: NOT MODIFIED
Git Write Operations: NOT EXECUTED
Production Environment: NOT DEPLOYED
Production Security: NOT VERIFIED
New Cleanup: NOT ENABLED
Commit Authorization: NOT GRANTED
Next Phase: NOT AUTHORIZED
```

本报告 SHA-256 在最终文件写入后的交付消息中提供。
