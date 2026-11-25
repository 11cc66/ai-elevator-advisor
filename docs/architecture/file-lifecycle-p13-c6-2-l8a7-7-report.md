# P1-3 C-6.2-L8-A7.7 Scanner Execution Semantics Remediation Report

## 1. 最终结论

- 阶段：`C-6.2-L8-A7.7`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 总体结论：`PASS`

A7.6 的问题均已修复：

- P1-1：JS/TS 深层间接调用；
- P1-2：Shell 常见 Wrapper 变体；
- P1-3：PowerShell 动态脚本来源；
- P2：Shell Here-doc 执行语义误报。

当前真实扫描：

```text
Working Tree Startup Gate: PASS
HEAD Startup Gate: FAIL / expected before authorized commit
worktreeComplete: true
headComplete: false / required secure files absent in HEAD
Current worktree UNKNOWN: 0
Current worktree findings: 0
```

## 2. 基线

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

A7.6 报告 SHA-256 与任务提供的基线一致：

```text
81414BC82676F58C5CCD76B98ED758D372417DAD433BD5AD92235975CCD81DFA
```

## 3. 修改文件

```text
packages/build-integrity/src/script-security.mjs
apps/web/tests/p13-startup-preflight.test.ts
docs/architecture/file-lifecycle-p13-c6-2-l8a7-7-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-7-report.md
docs/architecture/file-lifecycle-p13-implementation-status.md
```

未修改：

- Build Preflight 语义；
- Prisma Schema / Migration；
- Web/Worker Runtime Startup Gate；
- 生产业务代码；
- 历史 `.next` / Worker `dist`。

## 4. A7.6 根因

1. JS 别名传播只覆盖 identifier、单层 property 和单层 bind，没有对象属性、namespace 解构、comma expression、bind chain、函数参数与返回值。
2. Dynamic execution 只覆盖直接 eval/Function alias，没有 object/element/bind/tagged template。
3. Shell wrapper 只识别少量前缀和 `-c`，未建立 token 级 wrapper 参数解析。
4. Here-doc 执行判定只看是否出现 shell wrapper，没有区分 stdin 数据消费者与 stdin 代码执行器。
5. PowerShell 未识别 Get-Content、ScriptBlock::Create、Invoke-Command -FilePath 和 Invoke-Expression alias。

## 5. JavaScript / TypeScript

### 5.1 抽象值与传播

新增有限抽象值：

```text
process API
dynamic execution
object alias map
function reference
constant
```

固定点最多 8 轮，覆盖：

- namespace destructuring；
- object destructuring；
- comma alias；
- single / multi bind；
- object property；
- element property；
- function parameter；
- function return；
- closure capture；
- higher-order wrapper；
- multi-level alias；
- multi-level wrapper。

### 5.2 Dynamic execution

支持：

- eval / Function；
- indirect eval；
- globalThis / globalThis["eval"]；
- eval.bind；
- object-held eval；
- tagged-template eval/Function；
- call/apply；
- static body 递归分析；
- 不可推导 body -> UNKNOWN；
- depth/循环限制。

### 5.3 A7.6 样例结果

| Case | Result |
| -- | -- |
| namespace destructuring | DANGEROUS |
| comma alias | DANGEROUS |
| double bind | DANGEROUS |
| object-held eval | DANGEROUS |
| globalThis computed eval | DANGEROUS |
| bound eval | DANGEROUS |
| tagged-template eval | DANGEROUS |
| higher-order wrapper | DANGEROUS + UNKNOWN |

### 5.4 防误报

- 局部同名 `eval` / `Function` / `spawn` 保持 SAFE；
- 普通对象方法；
- 普通 bind；
- 普通同名函数；
- 不相关计算属性。

## 6. Shell

### 6.1 Wrapper 参数解析

新增 token 级解析，不按关键字搜索：

- `bash -lc`；
- `timeout ... bash -c`；
- `sudo -u app bash -c`；
- `xargs ... bash -c`；
- `find ... -exec/-execdir ...`；
- env、assignment、多层 wrapper；
- `-c` / `--command` / `/c` 参数位置。

无法解析的执行链 -> UNKNOWN。

### 6.2 A7.6 样例

| Case | Result |
| -- | -- |
| `bash -lc 'next start'` | DANGEROUS |
| `timeout 10 bash -c 'next start'` | DANGEROUS |
| `sudo -u app bash -c 'next start'` | DANGEROUS |
| `xargs bash -c 'next start'` | DANGEROUS |
| `find ... -exec bash -c ...` | DANGEROUS |

### 6.3 Here-doc 数据流

Here-doc 现在区分：

- 普通数据输出：body 不扫描；
- shell 从 stdin 执行代码：body 递归扫描；
- Here-doc 后 shell payload 为 `cat` 等数据消费者：body 保持数据；
- 无法确定：UNKNOWN；
- 未闭合：UNKNOWN。

`cat <<EOF | bash -c 'cat'` 返回 SAFE。

`cat <<EOF | sh` 且 body 包含 `next start` 返回 DANGEROUS。

## 7. PowerShell

新增：

- `Invoke-Expression (Get-Content ...)` -> UNKNOWN；
- piped Get-Content -> Invoke-Expression -> UNKNOWN；
- `[scriptblock]::Create("next start")` -> DANGEROUS；
- 动态 ScriptBlock source -> UNKNOWN；
- `Invoke-Command -FilePath` -> UNKNOWN；
- `$runner = Get-Command Invoke-Expression; & $runner ...`；
- 静态危险 alias 参数 -> DANGEROUS；
- 动态 alias 参数 -> UNKNOWN。

保留：

- nested ScriptBlock；
- Here-string Write-Host 数据；
- Here-string Invoke-Expression；
- unclosed Here-string。

## 8. CMD / BAT

未修改 CMD 实现。回归通过：

```text
IF / FOR DO
CALL / START
cmd /c
%VAR% / !VAR!
%1 / %*
nested block
goto label
echo data
```

## 9. Here-doc 数据流验证

```text
cat Here-doc data: SAFE
quoted Here-doc data: SAFE
double-quoted delimiter: SAFE
strip-tab Here-doc data: SAFE
Here-doc -> bash stdin: DANGEROUS
Here-doc -> sh stdin: DANGEROUS
Here-doc -> bash -c cat: SAFE
unclosed Here-doc: UNKNOWN
```

## 10. UNKNOWN 规则

```text
DANGEROUS
UNKNOWN
ERROR
SAFE
```

动态执行无法推导、动态文件来源、未知脚本类型、未闭合数据区、读取或枚举失败
均为非 SAFE。当前真实工作树 `unknown=0`。

## 11. A7.5 完整回归

```text
eval / Function: PASS
indirect eval: PASS
globalThis eval / Function: PASS
bind / call / apply: PASS
computed property: PASS
multi-level alias/wrapper: PASS
scope shadowing: PASS
parse diagnostics: PASS
dynamic body recursion: PASS
loop protection: PASS
Shell wrapper / Here-doc: PASS
PowerShell Here-string / ScriptBlock: PASS
CMD/BAT: PASS
```

## 12. A7.3 P1-2 回归

```text
HEAD required file missing/read/parse: BLOCKED
HEAD inventory incomplete: BLOCKED
HEAD complete + Gate FAIL: worktree evaluation allowed
worktree security FAIL: blocked
Manifest/signing/reparse failure: blocked
Builder calls on preflight failure: 0
Builder failure success continuation: 0
Legacy Artifact fallback: NONE
target directories created: NO
```

真实当前 Preflight：

```text
BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE
```

## 13. A4 / A6 / Storage 回归

```text
A4 Web Security: PASS
A4 Worker Security: PASS
A6 Build Integrity: PASS
Manifest Integrity: PASS
Legacy Artifact Reuse: PASS
Storage Delete Capability: UNAVAILABLE
```

## 14. 测试结果

```text
Web:
24 files / 202 tests PASS

Startup Scanner:
52 tests PASS

Worker:
6 files / 19 tests PASS

file-storage:
2 files / 19 tests PASS

Web TypeScript: PASS
Worker TypeScript: PASS
file-storage TypeScript: PASS
MJS syntax: PASS
```

## 15. 受保护文件

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

## 16. 源码哈希

```text
packages/build-integrity/src/script-security.mjs
214E7A3B896EB4984D47DD866179F629A9EF0784465F53DBF69112519B2ADC24

packages/build-integrity/src/startup-security.mjs
B6F4DC33B50CF755DC74D47B8FC819C40964A9553D44D420DEE1A62AAF137DB4

apps/web/tests/p13-startup-preflight.test.ts
1D0A519DAEE71850A4B61C845DA6A06E44221A4723F0A33421DEDC45BBA02D58
```

## 17. 提交闭包

当前候选文件仍沿用 A7.5：

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

测试和文档闭包沿用 A7.5；新增 A7.7 设计和报告。

`apps/web/package.json` 仍必须精确 hunk 暂存，避免 Evidence script 指向
未提交 CLI。

## 18. 未执行

```text
No Git write
No real Build
No Web/Worker start
No DB/SQL/Migration
No real Storage
No Cleanup
No ACL/IAM change
No legacy Artifact move/delete/execute
```

## 19. 剩余风险

- 静态数据流不是完整程序语义；
- 跨文件高阶函数与运行时生成代码只能保守 UNKNOWN；
- PowerShell 文件来源当前保守返回 UNKNOWN，不执行文件内容；
- 生产 Trust Root/ACL/Runtime Identity 未验证。

## 20. 最终验收字段

```yaml
JavaScript/TypeScript Scanner: PASS
Dynamic Execution Detection: PASS
bind() Alias Tracking: PASS
Computed Property Tracking: PASS
Shell Dynamic Execution: PASS
Nested Shell Execution: PASS
Shell Here-doc Data Separation: PASS
PowerShell Dynamic Script Source: PASS
PowerShell Here-string Data Separation: PASS
PowerShell Nested ScriptBlock: PASS
CMD/BAT Regression: PASS
A7.6 Failure Samples: PASS
Adversarial Tests: PASS
UNKNOWN Fail-Closed: PASS
A7.3 P1-2 Regression: PASS
HEAD Required File Integrity: PASS
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
Git Write Operations: NOT EXECUTED
Production Deployment: NOT DEPLOYED
New Cleanup: NOT ENABLED
Commit Authorization: NOT GRANTED
Next Phase: NOT AUTHORIZED
```

本报告 SHA-256 在最终交付消息中提供。
