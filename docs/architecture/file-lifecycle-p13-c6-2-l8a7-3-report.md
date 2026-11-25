# P1-3 C-6.2-L8-A7.3 Startup Scanner & Build Preflight Security Remediation Report

## 1. 最终结论

- 阶段：`C-6.2-L8-A7.3`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 总体结论：`PASS`
- Git 提交：`NOT EXECUTED`

A7.2 的两个 P1 已修复：

1. JavaScript / TypeScript 改为 TypeScript Compiler API；Shell、
   PowerShell、CMD/BAT 改为按语言结构的命令块扫描。
2. HEAD 固定必选文件缺失、读取失败或解析失败会使
   `head.complete=false`，Build Preflight 返回
   `BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE`，builder 调用次数为 0。

当前结果：

```text
Working Tree Startup Gate: PASS
HEAD Startup Gate: FAIL / expected uncommitted security baseline
worktreeComplete: true
headComplete: false
current worktree unknowns: 0
current worktree findings: 0
```

`headComplete=false` 是预期的：当前 HEAD 中缺少本阶段新增的 secure
start/build、instrumentation 和 bootstrap 文件。提交安全基线后 HEAD
完整性应恢复。

## 2. 修改文件

新增：

```text
packages/build-integrity/src/script-security.mjs
docs/architecture/file-lifecycle-p13-c6-2-l8a7-3-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-3-report.md
```

修改：

```text
packages/build-integrity/package.json
packages/build-integrity/src/startup-security.mjs
packages/build-integrity/src/index.mjs
packages/build-integrity/src/index.d.ts
apps/web/scripts/build-secure.ts
apps/worker/scripts/build-secure.ts
apps/web/scripts/p13-startup-security/cli.ts
apps/web/tests/p13-startup-preflight.test.ts
pnpm-lock.yaml
docs/architecture/file-lifecycle-p13-implementation-status.md
```

## 3. P1-1 根因

### 3.1 Shell / CMD

旧扫描只按少量字符分隔命令，没有把以下结构转换成可检查的命令边界：

- `if ... then ... fi`；
- subshell `( ... )`；
- command substitution `$(...)` / backtick；
- `for ... do ...`；
- group `{ ...; }`；
- FUNCTION 中的嵌套命令。

literal `eval` 也未作为执行内容递归扫描。

### 3.2 PowerShell

旧扫描没有递归解析 `{ ScriptBlock }`，因此：

- if block；
- nested ScriptBlock；
- `Invoke-Command -ScriptBlock`；

中的裸命令没有进入危险命令判定。

### 3.3 JavaScript

旧扫描依赖文本和正则：

- 无法可靠区分执行 API 与同名普通方法；
- 非字面量 require 未产生 UNKNOWN；
- bracket 属性 `cp["spawn"]` 未完整追踪；
- method alias、namespace alias 和 wrapper function 不完整；
- `path.join` / `path.resolve` 常量组合未推导；
- parse error 无法稳定 fail closed。

## 4. P1-1 修复

### 4.1 TypeScript AST

新增：

```text
packages/build-integrity/src/script-security.mjs
```

并将：

```text
typescript@5.9.3
```

声明为 `@elevator/build-integrity` 依赖。

JavaScript / TypeScript 使用：

```text
ts.createSourceFile
ts.forEachChild
TypeScript AST
```

静态分析包括：

- import / export / re-export；
- named / namespace / default import；
- require / destructured require；
- require alias；
- import alias；
- method alias；
- child_process 点属性；
- child_process computed property；
- `require("child_process").exec(...)`；
- `await import(...)` namespace；
- `.then(({ exec }) => ...)`；
- dynamic import；
- dynamic require；
- spawn/exec/execFile/fork；
- wrapper function；
- 参数注入；
- string constant；
- template constant；
- string concatenation；
- array constant；
- partial array；
- path.join / path.resolve；
- `path["join"]` / `path["resolve"]`；
- process.execPath；
- parse diagnostics。

### 4.2 Shell

Shell 使用：

- 引号感知命令分段；
- `then/do/else` block 命令提取；
- `()`、`{}`；
- command substitution；
- backtick；
- sh/bash/zsh/dash `-c`；
- eval；
- xargs；
- variables；
- alias；
- positional dynamic command。

### 4.3 PowerShell

PowerShell 使用：

- 引号感知 block 分段；
- if/else ScriptBlock；
- nested ScriptBlock；
- Invoke-Command / Invoke-Expression；
- Start-Process；
- `&`；
- 变量；
- alias；
- cmd /c。

### 4.4 CMD / BAT

CMD 使用：

- IF；
- FOR ... DO；
- CALL；
- START；
- cmd /c；
- `%VAR%`；
- `!VAR!`；
- `%1` / `%*`；
- DOSKEY；
- 括号 block；
- 无法解析变量。

### 4.5 未知类型与解析错误

- 不支持的脚本扩展名返回 `SCRIPT_UNKNOWN_FILE_TYPE` UNKNOWN；
- 未知 shebang 返回 UNKNOWN；
- JS/TS parse diagnostics 返回 `SCRIPT_PARSE_ERROR` ERROR；
- ERROR/UNKNOWN 都不能产生 SAFE。

## 5. Scanner 覆盖矩阵

| 能力 | Shell | PowerShell | CMD/BAT | JS/TS |
| -- | -- | -- | -- | -- |
| 直接 `next start` | PASS | PASS | PASS | PASS |
| Worker dist | PASS | PASS | PASS | PASS |
| 条件块 | PASS | PASS | PASS | N/A |
| 嵌套块 | PASS | PASS | PASS | PASS |
| 变量 | PASS | PASS | PASS | PASS |
| 命令替换 / ScriptBlock | PASS | PASS | N/A | N/A |
| alias / 方法别名 | UNKNOWN | UNKNOWN | UNKNOWN | PASS/UNKNOWN |
| dynamic require/import | N/A | N/A | N/A | PASS |
| computed child_process API | N/A | N/A | N/A | PASS |
| path.join / resolve | N/A | N/A | N/A | PASS |
| parse error → ERROR | N/A | N/A | N/A | PASS |
| 注释/展示字符串 | PASS | PASS | PASS | PASS |
| 未知结构 → UNKNOWN | PASS | PASS | PASS | PASS |

## 6. A7.2 失败样例复测

使用真实导出 `scanAuxiliaryScript()` 和内存输入，不执行输入内容。

| 样例 | 结果 |
| -- | -- |
| Shell `if ... then next start; fi` | `SCRIPT_DIRECT_NEXT_START` DANGEROUS |
| Shell `(next start)` | `SCRIPT_DIRECT_NEXT_START` DANGEROUS |
| Shell `echo "$(next start)"` | `SCRIPT_DIRECT_NEXT_START` DANGEROUS |
| Shell `eval "next start"` | `SCRIPT_DIRECT_NEXT_START` DANGEROUS |
| PowerShell `if (...) { next start }` | `SCRIPT_DIRECT_NEXT_START` DANGEROUS |
| PowerShell `Invoke-Command -ScriptBlock { next start }` | `SCRIPT_DIRECT_NEXT_START` DANGEROUS |
| CMD `if exist .next next start` | `SCRIPT_DIRECT_NEXT_START` DANGEROUS |
| CMD `for %%x in (a) do next start` | `SCRIPT_DIRECT_NEXT_START` DANGEROUS |
| JS dynamic `require(name)` | `SCRIPT_UNKNOWN_DYNAMIC_REQUIRE` UNKNOWN |
| JS `cp["spawn"]("next", ["start"])` | `SCRIPT_DIRECT_NEXT_START` DANGEROUS |
| JS `path.join("dist", "index.js")` 后 spawn | `SCRIPT_DIRECT_WORKER_DIST` DANGEROUS |

全部不再是 SAFE。

额外覆盖：

- `await import("node:child_process")`；
- computed method name；
- unknown computed method；
- wrapper function + constant arguments；
- fork Worker Entry；
- unknown script type；
- parse failure；
- known safe `execFile("git", ["status"])` 不误报。

## 7. UNKNOWN 语义

```text
DANGEROUS:
  明确危险。

UNKNOWN:
  执行目标或分析步骤无法确定。

ERROR:
  读取、枚举或解析失败。

SAFE:
  仅完成所有必要分析且未发现问题。
```

任何 WORKTREE finding 均使 worktree status 为 FAIL。当前真实工作树：

```text
unknowns: 0
findings: 0
```

UNKNOWN 不会被转换为 SAFE。

## 8. HEAD 完整性语义

HEAD 完整 tracked path inventory 使用：

```text
git ls-tree -r -z HEAD
```

固定必选文件必须同时满足：

- 出现在完整 HEAD inventory；
- 内容读取成功；
- package JSON 可解析；
- JS/TS 可解析。

新增 finding：

```text
HEAD_PATH_ENUMERATION_FAILED
HEAD_REQUIRED_FILE_MISSING
HEAD_REQUIRED_FILE_READ_FAILED
HEAD_REQUIRED_FILE_PARSE_FAILED
HEAD_SCRIPT_READ_FAILED
```

规则：

| 状态 | complete | Preflight |
| -- | -- | -- |
| HEAD 完整，但旧入口安全检查 FAIL | true | 可继续评估安全工作树 |
| 必选文件缺失 | false | BLOCKED |
| 必选文件读取失败 | false | BLOCKED |
| 必选文件解析失败 | false | BLOCKED |
| 额外脚本读取/枚举失败 | false | BLOCKED |

## 9. Build Preflight 故障注入

真实执行：

```text
runBuildSecurityPreflight()
```

并注入：

- required HEAD file missing；
- required HEAD read null；
- required HEAD reader throws；
- required HEAD parse failure；
- HEAD path enumeration failure；
- worktree security failure；
- manifest identity failure；
- signing key boundary failure；
- existing target；
- reparse target；
- builder failure。

结果：

| 场景 | Builder calls | Success continuation |
| -- | -- | -- |
| valid preflight | 1 | not applicable |
| HEAD incomplete | 0 | 0 |
| worktree fail | 0 | 0 |
| manifest identity fail | 0 | 0 |
| signing key fail | 0 | 0 |
| existing/reparse target | 0 | 0 |
| builder failure | 1 | 0 |

HEAD completeness failure 返回：

```text
BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE
```

测试目标目录均保持不存在。

## 10. A4 / A6 回归

### Web

```text
Secure Launcher before Next: PASS
Instrumentation Gate: PASS
Production dist isolation: PASS
Direct next start in supported script: NOT FOUND
Fallback to legacy .next: NOT FOUND
Storage delete capability: UNAVAILABLE
```

### Worker

```text
Secure Launcher before spawn: PASS
Gate -> load worker-entry -> startWorker: PASS
Prisma before Gate: NOT FOUND
PgBoss before Gate: NOT FOUND
Job/Maintenance before Gate: NOT FOUND
Direct node dist/index.js in supported script: NOT FOUND
Storage delete capability: UNAVAILABLE
```

### Build Integrity

```text
Build Identity: PASS
Signed Manifest: PASS
Source Tree Digest: PASS
Dependency Lock Digest: PASS
Runtime Dependency Digest: PASS
Artifact Digest: PASS
Signing Key Boundary: PASS
Target / ancestor Reparse: PASS
Builder failure fallback: NOT FOUND
```

## 11. 测试结果

独立执行：

```text
Web:
24 files / 195 tests PASS

  p13-startup-preflight.test.ts:
  45 tests PASS

Worker:
6 files / 19 tests PASS

file-storage:
2 files / 19 tests PASS
```

TypeScript：

```text
Web: PASS
Worker: PASS
file-storage: PASS
```

均使用：

```text
--noEmit --incremental false
```

MJS syntax：

```text
script-security.mjs: PASS
startup-security.mjs: PASS
index.mjs: PASS
```

## 12. 受保护文件

修改前后一致：

```text
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

prisma/schema.prisma
78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299

P1-3 Migration
187D82A00DB73CB6F5D79C97DCD6B4FF2E01BD7E5F78BB9E1273D54D8A141479
```

历史产物未变化：

```text
apps/web/.next: 1,413 files / 446,890,260 bytes
apps/worker/dist: 32 files / 135,078 bytes
```

`.p13-releases` 与 `.p13-build` 仍不存在。

## 13. 修改源码哈希

```text
packages/build-integrity/package.json
94F91628BC9E5B687DF4857F7FDA7A3D09A1FE14753D363B5B8A8CA92BEFF39F

packages/build-integrity/src/index.mjs
89A88FB7F190AEEAC02F191040DB72617F32459FA5D24AF04576A35563E08945

packages/build-integrity/src/index.d.ts
8387E9E1660570F224CE640F7FE48593EC5E1AB770774F9AC1F8CA63C1325B00

packages/build-integrity/src/script-security.mjs
081D3CC4E2A763A0C62A08793384111C256BB2EB19B74782CBE561B5490F7168

packages/build-integrity/src/startup-security.mjs
B6F4DC33B50CF755DC74D47B8FC819C40964A9553D44D420DEE1A62AAF137DB4

apps/web/scripts/build-secure.ts
4B99402BFE8CE5E5D3D57C41457F98EC24ECD0DEA1EFEA5969299A0070258390

apps/worker/scripts/build-secure.ts
5CFB1E8CF30653A519EABB061E6A1ED5F6FC59B81A8B4097BE1168DF76188425

apps/web/scripts/p13-startup-security/cli.ts
53C56873057651415402AC9AF380562824D75E6BC4960EB7B747257D17502F44

apps/web/tests/p13-startup-preflight.test.ts
D873DDA071C209E9850BD68C3D0AF09C4CAA12FF7D0125FA5D0CCDC2B181BA8C

pnpm-lock.yaml
58A2C86EF17B845A60FA29BD4521B62F41CA86307BDCBD5C9E4EA6CE91264823
```

## 14. 提交依赖闭包

### 14.1 必须提交的安全源码

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
packages/build-integrity/src/script-security.mjs
packages/build-integrity/src/startup-security.mjs
apps/web/scripts/build-secure.ts
apps/web/scripts/start-secure.mjs
apps/web/scripts/p13-startup-security/cli.ts
apps/web/src/instrumentation.ts
apps/web/src/server/security/startup-gate.ts
apps/worker/scripts/build-secure.ts
apps/worker/scripts/start-secure.mjs
apps/worker/src/bootstrap.ts
apps/worker/src/security/startup-gate.ts
apps/worker/src/worker-entry.ts
```

### 14.2 前置 Storage / Legacy cleanup 安全闭包

```text
apps/web/src/modules/files/download-service.ts
apps/web/src/modules/files/upload-service.ts
apps/web/src/server/files/storage.ts
apps/worker/src/config.ts
apps/worker/src/file-maintenance.ts
apps/worker/src/file-processing.ts
apps/worker/src/storage.ts
packages/file-storage/src/errors.ts
packages/file-storage/src/index.ts
packages/file-storage/src/local-private-storage.ts
packages/file-storage/src/capabilities.ts
packages/file-storage/src/legacy-cleanup.ts
```

### 14.3 必须提交的测试

```text
apps/web/tests/p13-release-security.test.ts
apps/web/tests/p13-startup-preflight.test.ts
apps/web/tests/legacy-cleanup-shutdown.test.ts
apps/web/tests/e2e/global-setup.ts
apps/web/tests/integration/phase32-upload-service.test.ts
apps/web/tests/integration/phase34-file-processing.test.ts
apps/web/tests/integration/phase35-lease-renewal.test.ts
apps/web/tests/integration/phase35-processing-reliability.test.ts
apps/worker/tests/legacy-cleanup-shutdown.test.ts
apps/worker/tests/storage-capability.test.ts
apps/worker/tests/test-worker-entry.ts
packages/file-storage/tests/local-private-storage.test.ts
packages/file-storage/tests/capabilities.test.ts
```

### 14.4 文档提交

```text
docs/architecture/file-lifecycle-p13-c6-2-l8a4-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a4-report.md
docs/architecture/file-lifecycle-p13-c6-2-l8a5-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a5-report.md
docs/architecture/file-lifecycle-p13-c6-2-l8a6-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a6-report.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-review.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-1-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-1-report.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-2-review.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-3-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-3-report.md
docs/architecture/file-lifecycle-p13-implementation-status.md
```

### 14.5 package JSON 精确暂存

`apps/web/package.json` 同时包含：

```text
p13:evidence:validate -> scripts/p13-deployment-evidence/cli.ts
p13:startup-security  -> scripts/p13-startup-security/cli.ts
```

如果本安全提交不包含 Deployment Evidence 工具，必须使用
`git add -p` 或等价方式仅暂存：

- `build`
- `start`
- `p13:startup-security`
- `@elevator/build-integrity`

不得整文件暂存后留下无效 `p13:evidence:validate`。

### 14.6 必须排除

```text
apps/web/next-env.d.ts
apps/web/tsconfig.tsbuildinfo
apps/web/.next/
apps/worker/dist/
prisma/schema.prisma
prisma/migrations/
apps/web/scripts/p13-build-audit/
apps/web/scripts/p13-db-tests/
apps/web/scripts/p13-deployment-evidence/
apps/web/scripts/p13-storage-delete-audit/
apps/web/scripts/p13-storage-inventory/
apps/web/tests/p13-a-migration.test.ts
apps/web/tests/p13-b-migration.test.ts
apps/web/tests/p13-build-audit.test.ts
apps/web/tests/p13-db-tooling.test.ts
apps/web/tests/p13-deployment-evidence*.test.ts
apps/web/tests/p13-storage-delete-audit.test.ts
apps/web/tests/p13-storage-inventory.test.ts
.env
.env.test
node_modules/
coverage/
test-results/
```

Implementation Status 引用的更早架构文档应作为独立文档闭包统一处理，
不得只提交状态文档后留下失效引用。

## 15. 未执行的高风险操作

```text
No Git write
No real Web/Worker Build
No Web/Worker start
No E2E
No Integration
No database connection
No SQL/Migration
No real Storage access
No Cleanup
No legacy Artifact move/delete/execute
No ACL/owner/SID/registry/service/task change
```

## 16. 剩余限制

- AST 分析不是完整 interprocedural 数据流证明；
- Shell/PowerShell/CMD 仍是安全导向的轻量结构扫描；
- 运行时 eval 生成的任意命令只能保守地 UNKNOWN；
- 外部二进制或未知解释器不能完全语义分析；
- 当前 HEAD 缺少安全文件，因此真实 Build Preflight 会持续 fail
  closed，直到安全源码被授权提交。

## 17. 最终验收字段

```yaml
P1-1 Scanner Remediation: PASS
Shell Scanner: PASS
PowerShell Scanner: PASS
CMD/BAT Scanner: PASS
JavaScript/TypeScript Scanner: PASS
A7.2 Regression Samples: PASS
UNKNOWN Fail-Closed: PASS
HEAD Required File Integrity: PASS
HEAD/Worktree Scan Symmetry: PASS
Build Preflight: PASS
Builder Zero-Call on Failure: PASS
A4 Web Security: PASS
A4 Worker Security: PASS
A6 Build Integrity: PASS
Manifest Integrity: PASS
Legacy Artifact Reuse: PASS
Storage Delete Capability: PASS / UNAVAILABLE
TypeScript: PASS
Unit Tests: PASS
Protected File Integrity: PASS
Commit Inventory: COMPLETE
Database: NOT CONNECTED
Storage: NOT ACCESSED
Real Build: NOT EXECUTED
Legacy Artifact: NOT MOVED / NOT DELETED / NOT EXECUTED
Git Write Operations: NOT EXECUTED
Production Deployment: NOT DEPLOYED
Production Security: NOT VERIFIED
New Cleanup: NOT ENABLED
Commit Authorization: NOT GRANTED
Next Phase: NOT AUTHORIZED
```

本报告 SHA-256 在最终交付消息中提供。
