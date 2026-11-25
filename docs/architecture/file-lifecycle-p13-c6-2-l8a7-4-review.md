# P1-3 C-6.2-L8-A7.4 Independent Scanner & Build Preflight Security Review

## 1. 文档信息与总体结论

- 阶段：`C-6.2-L8-A7.4`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 审查性质：独立只读复核 + 只写审查文档/状态
- 总体结论：`FAIL`
- 可控 Git 提交：`NOT READY`
- A8：`NOT AUTHORIZED`

### 1.1 结论摘要

A7.3 的 P1-2（HEAD 完整性/Preflight）通过独立复审。

A7.3 的 P1-1（多语言 Scanner）未通过独立复审。现有回归全部通过，
但额外内存对抗输入发现：

- JavaScript `eval`、`new Function`、child_process `.bind()` 和常量
  computed alias 可漏报；
- Shell 动态 `exec`、多层 `sh -c` 和 `eval "$(...)"` 可漏报；
- Shell echo / here-doc 中的显示文本会被误报；
- PowerShell here-string 中的显示文本会被误报。

因此当前工作树仍不具备进入受控 Git 提交阶段的条件。

## 2. 基线

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

工作树继续保留全部既有未提交修改。本轮未执行 Git 写操作。

历史 Artifact：

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

两者未移动、删除、重命名或执行。

A7.3 报告 SHA-256：

```text
9D7984FFF90EE546B469584B1CD47F02898B7BAF6FBCB0CE3771FAC58765851D
```

A7.3 设计 SHA-256：

```text
DD25EB8655A17C9904A099B3FA263BF5DF7FB4DBB62DCB999FBB43D2472E411A
```

## 3. A7.3 P1-1 独立审查

### 3.1 已通过的既有能力

直接调用正式导出：

```text
scanAuxiliaryScript()
```

A7.3 声明的以下样例通过：

- 直接 Shell 条件/subshell/command substitution/`eval`；
- PowerShell if/ScriptBlock；
- CMD IF/FOR；
- JS dynamic require；
- JS `cp["spawn"]`；
- JS `path.join` Worker entry；
- JS parse diagnostics；
- 已知安全 `execFile("git", ["status"])`。

### 3.2 新增对抗输入

以下输入均通过真实扫描器纯函数在内存中执行，没有创建或执行脚本文件。

#### 漏报

| Case | Input type | Expected | Actual | 结论 |
| -- | -- | -- | -- | -- |
| JS `eval` | `eval('require("child_process").spawn("next",["start"])')` | DANGEROUS/UNKNOWN | `[]` | FAIL |
| JS `new Function` | `new Function('...next...')` | DANGEROUS/UNKNOWN | `[]` | FAIL |
| JS `.bind` alias | `const run=cp["spawn"].bind(cp); run("next",["start"])` | DANGEROUS | `[]` | FAIL |
| JS computed alias | `const method="spawn"; const run=cp[method]; run(...)` | DANGEROUS | `[]` | FAIL |
| Shell dynamic exec | `exec "$UNRESOLVED_COMMAND"` | UNKNOWN | `[]` | FAIL |
| Shell nested `-c` | `bash -c 'bash -c "next start"'` | DANGEROUS | `[]` | FAIL |
| Shell eval substitution | `eval "$(printf 'next start')"` | DANGEROUS/UNKNOWN | `[]` | FAIL |

#### 误报

| Case | Input type | Expected | Actual | 结论 |
| -- | -- | -- | -- | -- |
| Shell display wrapper string | `echo 'bash -c "next start"'` | SAFE | DANGEROUS | FAIL |
| Shell here-doc data | `cat <<EOF` 后正文 `next start` | SAFE | DANGEROUS | FAIL |
| PowerShell here-string | `@'` 后正文 `next start` | SAFE | DANGEROUS | FAIL |

### 3.3 通过项

| Case | Result |
| -- | -- |
| JS multi-level process alias | DANGEROUS |
| JS multi-level wrapper | DANGEROUS |
| JS recursive function | 无无限递归/无异常 |
| JS string concatenation | DANGEROUS |
| JS template constant | DANGEROUS |
| JS `path.resolve` Worker entry | DANGEROUS |
| PowerShell nested ScriptBlock | DANGEROUS |
| CMD nested block | DANGEROUS |
| CMD goto label body | DANGEROUS |
| CMD echo display string | SAFE |
| JS ordinary string | SAFE |

## 4. Scanner 分语言结论

### 4.1 JavaScript / TypeScript

事实：

- TypeScript Compiler API 已实际使用；
- bindings、constant propagation、wrapper、path combination 已实现；
- A7.2 基础样例通过。

仍未覆盖：

- global `eval`；
- `new Function`；
- child_process API 的 `.bind()`；
- computed alias 在 alias table 构建时的二次传播；
- 部分动态 API 访问。

结论：

```text
JavaScript/TypeScript Scanner: FAIL
```

### 4.2 Shell

事实：

- A7.2 四个基础绕过样例已修复；
- 条件块、subshell、command substitution 和 literal eval 样例通过。

仍未覆盖：

- 多层 wrapper 的递归执行内容；
- `eval` 内的 command substitution 推导；
- 动态 `exec` / `command` 目标的 UNKNOWN；
- here-doc 数据区；
- 引号内 wrapper 文本与真实 wrapper 调用的区分。

结论：

```text
Shell Scanner: FAIL
```

### 4.3 PowerShell

事实：

- 条件 ScriptBlock 和嵌套 Invoke-Command 可识别；
- `&`、Start-Process、Invoke-Expression 和变量 command 有覆盖。

问题：

- here-string 被逐行当作命令；
- 显示内容可能误报 DANGEROUS。

结论：

```text
PowerShell Scanner: FAIL
```

### 4.4 CMD / BAT

事实：

- IF、FOR、CALL、START、cmd /c、变量、DOSKEY、嵌套括号和 label
  的基本测试通过；
- 未在补充对抗样例中出现漏报或误报。

该 PASS 仅覆盖当前审查输入，不是形式语法证明。

结论：

```text
CMD/BAT Scanner: PASS
```

## 5. UNKNOWN 语义

已发射的 UNKNOWN 会使 worktree FAIL，不会被降级为 SAFE：

```text
UNKNOWN fail-closed: PASS FOR EMITTED UNKNOWN
```

但 P1-1 发现的部分动态执行没有产生 UNKNOWN，因此整体多语言覆盖仍
不能 PASS。

## 6. A7.3 P1-2 独立审查

### 6.1 HEAD 完整性

当前真实扫描：

```text
worktreeStatus: PASS
headStatus: FAIL
worktreeComplete: true
headComplete: false
worktreeScriptsEnumerated: 29
headScriptsEnumerated: 8
unknowns: 0
worktreeFindings: 0
```

HEAD 缺少：

- Web secure build/start；
- Web instrumentation；
- Worker secure build/start；
- Worker Bootstrap。

这些缺口产生：

```text
HEAD_REQUIRED_FILE_MISSING
```

并使 `head.complete=false`。

### 6.2 Fault Injection

独立测试覆盖：

| 场景 | head.complete | Preflight | Builder |
| -- | -- | -- | -- |
| required file 缺失 | false | BLOCKED | 0 |
| required reader null | false | BLOCKED | 0 |
| required reader throw | false | BLOCKED | 0 |
| required parse failure | false | BLOCKED | 0 |
| HEAD path enumeration fail | false | BLOCKED | 0 |
| HEAD extra script read fail | false | BLOCKED | 0 |
| HEAD complete but security FAIL | true | allowed | 1 |
| worktree security FAIL | true | BLOCKED | 0 |
| manifest identity fail | true | BLOCKED | 0 |
| signing key fail | true | BLOCKED | 0 |
| existing/reparse target | true | BLOCKED | 0 |
| builder failure | true | builder ran | success continuation 0 |

真实当前 Preflight：

```text
result: REJECTED
code: BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE
```

构建目标未被创建：

```text
apps/web/.p13-releases: ABSENT
apps/web/.p13-build: ABSENT
```

未发现异常被吞掉后继续执行 builder 的路径。

结论：

```text
A7.3 P1-2 Independent Review: PASS
HEAD Required File Integrity: PASS
Build Preflight: PASS
Builder Zero-Call on Failure: PASS
```

## 7. HEAD / Worktree 对称性

事实：

- 两边都从完整 path inventory 派生脚本；
- 两边使用相同 `isRelevantExecutableScript()`；
- 两边使用相同语言扫描器；
- 新增、删除、重命名和同名内容变化进入 inventory；
- required file completeness 单独检查 HEAD。

结果：

```text
HEAD/Worktree Scan Symmetry: PASS
```

但扫描器本身仍有 P1-1 漏报，因此对称扫描不能提升 P1-1 结论。

## 8. A4 / A6 回归

### Web

```text
A4 Web Security: PASS
Signed Release before Next: PASS
Instrumentation Gate: PASS
P13_NEXT_DIST_DIR isolation: PASS
Legacy .next fallback: NOT FOUND
```

### Worker

```text
A4 Worker Security: PASS
Secure Launcher before spawn: PASS
Gate -> load worker-entry -> startWorker: PASS
Prisma/PgBoss before Gate: NOT FOUND
Job/Maintenance before Gate: NOT FOUND
Legacy dist direct package entry: NOT FOUND
```

### Build Integrity

```text
A6 Build Integrity: PASS
Manifest Integrity: PASS
Source Tree Digest: PASS
Dependency Lock Digest: PASS
Runtime Dependency Digest: PASS
Artifact Digest: PASS
Signing key boundary: PASS
Target/ancestor Reparse: PASS
Legacy Artifact Reuse: PASS
```

### Storage

```text
Web delete capability: UNAVAILABLE
Worker delete capability: UNAVAILABLE
Maintenance delete storage: NOT PRESENT
Physical deletion regression: NOT FOUND
```

## 9. 测试结果

本轮实际执行：

```text
Web:
24 files / 195 tests PASS

  p13-startup-preflight.test.ts:
  45 tests PASS

Worker:
6 files / 19 tests PASS

file-storage:
2 files / 19 tests PASS

Web TypeScript: PASS
Worker TypeScript: PASS
file-storage TypeScript: PASS
```

所有既有测试通过，但新增内存对抗输入仍发现 P1/P2 扫描问题。

## 10. 受保护文件

本轮前后一致：

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

## 11. 提交闭包

由于 A7.3 P1-1 仍需修复，本轮不批准提交。修复后的候选闭包如下。

### 11.1 必须提交的安全源码

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

### 11.2 前置 Storage / Legacy cleanup 闭包

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

### 11.3 必须提交的测试

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

### 11.4 文档

必须提交：

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
docs/architecture/file-lifecycle-p13-c6-2-l8a7-4-review.md
docs/architecture/file-lifecycle-p13-implementation-status.md
```

### 11.5 必须精确 hunk 暂存

`apps/web/package.json` 当前同时包含：

```text
p13:evidence:validate -> scripts/p13-deployment-evidence/cli.ts
p13:startup-security  -> scripts/p13-startup-security/cli.ts
```

若不提交 Deployment Evidence，只允许暂存：

- `build`
- `start`
- `p13:startup-security`
- `@elevator/build-integrity`

不得整文件暂存后留下无效命令。

### 11.6 可不提交的辅助文档

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
docs/architecture/file-lifecycle-p13-c6-2-l*.md
docs/architecture/file-lifecycle-p13-c6-2-l8a*.md
docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md
docs/architecture/file-lifecycle-p13-design-freeze.md
```

Implementation Status 引用了这些文档。最终文档提交必须解决引用闭包，
不能留下未提交链接目标。

### 11.7 必须排除

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

## 12. 剩余风险与限制

- Scanner 不是完整 interprocedural data-flow；
- JS dynamic eval/new Function 尚未覆盖；
- Shell heredoc 和字符串内 wrapper 上下文尚未正确处理；
- PowerShell here-string 尚未正确处理；
- scanner 运行时异常尚未被结构化捕获为 ERROR；
- 真实 Build 未执行；
- Production Trust Root/ACL/Runtime Identity 未验证。

## 13. 最终验收字段

```yaml
A7.3 P1-1 Independent Review: FAIL
JavaScript/TypeScript Scanner: FAIL
Shell Scanner: FAIL
PowerShell Scanner: FAIL
CMD/BAT Scanner: PASS
Adversarial Test Coverage: PASS
UNKNOWN Fail-Closed: PASS
A7.3 P1-2 Independent Review: PASS
HEAD Required File Integrity: PASS
Build Preflight: PASS
Builder Zero-Call on Failure: PASS
HEAD/Worktree Symmetry: PASS
A4 Web Security: PASS
A4 Worker Security: PASS
A6 Build Integrity: PASS
Manifest Integrity: PASS
Legacy Artifact Reuse: PASS
Storage Delete Capability: PASS / UNAVAILABLE
Commit Inventory: COMPLETE
Protected File Integrity: PASS
Database: NOT CONNECTED
Storage: NOT ACCESSED
Real Build: NOT EXECUTED
Git Write Operations: NOT EXECUTED
Production Deployment: NOT DEPLOYED
Commit Authorization: NOT GRANTED
Next Phase: NOT AUTHORIZED
```

本报告 SHA-256 在最终交付消息中提供。
