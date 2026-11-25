# P1-3 C-6.2-L8-A7.6 Independent Adversarial Scanner & Build Preflight Security Review

## 1. 结论

- 阶段：`C-6.2-L8-A7.6`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 审查性质：独立只读对抗性安全复审
- 总体结论：`FAIL`
- Git 提交建议：`NOT READY`
- A7.7 / A8：`NOT AUTHORIZED`

### 1.1 摘要

A7.5 报告中的既有测试全部通过，A7.3 P1-2、A4 Web/Worker Gate、A6
Build Integrity 和 Storage capability 未发现回归。

但独立设计的额外攻击样例发现新的 P1 Scanner 漏报：

- JS/TS：间接 namespace 解构、comma alias、double bind、object-held eval
  alias、element-access global eval、bound eval、tagged-template eval、
  higher-order wrapper 返回函数均返回 SAFE；
- Shell：`bash -lc`、`timeout ... bash -c`、`sudo -u ... bash -c`、
  xargs、find `-exec` 等常见 wrapper 形式返回 SAFE；
- PowerShell：`Invoke-Expression (Get-Content ...)`、
  `[scriptblock]::Create(...)` 后执行、`Invoke-Command -FilePath` 返回
  SAFE；
- Shell Here-doc 数据经 `cat <<EOF | bash -c 'cat'` 输出时被误报为
  DANGEROUS。

由于存在可执行的 P1 漏报，本轮必须 FAIL，不能进入受控 Git 提交或 A8。

## 2. 审查基线

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

工作树保持全部既有未提交内容。本轮没有修改源码、测试或配置，只新增本
审查报告。

### 2.1 A7.5 文档哈希

```text
docs/architecture/file-lifecycle-p13-c6-2-l8a7-5-design.md
42CFAEA8A5190F4208CAAA937FEB9760979CDAAE909B07C699F4016A92C414F6

docs/architecture/file-lifecycle-p13-c6-2-l8a7-5-report.md
DE4EFE08B23B363A32AC1A7BBD12022682221F4CFE356C31BD6CDB4A59B74D34

docs/architecture/file-lifecycle-p13-implementation-status.md
E11581AB5827C7F3F9C34F3854098285EEF18F193C85464C26D4EBD2A898A8FB
```

## 3. 实际调用链

### 3.1 Scanner

```text
pnpm security:startup
  -> apps/web/scripts/p13-startup-security/cli.ts
  -> @elevator/build-integrity
  -> packages/build-integrity/src/startup-security.mjs
  -> inspectStartupEntrySecurity()
  -> scanAuxiliaryScript()
  -> script-security.mjs
       scanJavaScriptAst()
       scanShell()
       scanPowerShell()
       scanCmd()
```

### 3.2 Build Preflight

```text
Web/Worker secure build
  -> executeGuardedBuild()
  -> runBuildSecurityPreflight()
  -> inspectStartupEntrySecurity()
  -> HEAD completeness
  -> worktree security
  -> target / ancestor checks
  -> builder
```

## 4. JavaScript / TypeScript 对抗审查

### 4.1 已有能力通过

- 直接 eval / Function；
- indirect eval `(0, eval)`；
- eval alias；
- `.call()` / `.apply()`；
- 单层 bind alias；
- constant computed property alias；
- two-level process alias；
- two-level wrapper；
- recursive function 不挂起；
- local shadow `eval` / `Function` / `spawn`；
- safe ordinary bind；
- string/template concat；
- path.join / path.resolve；
- parse error -> ERROR。

### 4.2 新发现漏报

真实调用 `scanAuxiliaryScript()`，没有创建或执行输入代码。

| Case | 输入摘要 | 预期 | 实际 |
| -- | -- | -- | -- |
| namespace destructuring | `const {spawn: run}=cp; run("next",["start"])` | DANGEROUS | `[]` |
| comma alias | `const run=(0,cp.spawn); run(...)` | DANGEROUS | `[]` |
| double bind | `cp.spawn.bind(null).bind(null)` 后调用 | DANGEROUS | `[]` |
| object-held eval | `const tools={run:eval}; tools.run(code)` | DANGEROUS | `[]` |
| element global eval | `const run=globalThis["eval"]; run(code)` | DANGEROUS | `[]` |
| bound eval | `const run=eval.bind(globalThis); run(code)` | DANGEROUS | `[]` |
| tagged eval | ``eval`code` `` | DANGEROUS/UNKNOWN | `[]` |
| higher-order wrapper | `make(cp.spawn)` 返回包装函数后调用 | DANGEROUS/UNKNOWN | `[]` |

### 4.3 根因

- namespace 解构只处理直接从 `require(...)` 解构，不处理从 namespace
  变量继续解构；
- process alias 传播只覆盖 identifier / direct property / 单层 bind，
  不覆盖 comma expression、bind chain 和函数返回值；
- dynamic execution alias 只覆盖 identifier / global property，不覆盖
  object property、element access 和 bind；
- TaggedTemplateExpression 未进入 dynamic execution 分析；
- higher-order function 的返回值没有抽象值。

### 4.4 结论

```text
JavaScript/TypeScript Scanner: FAIL
```

## 5. Shell 对抗审查

### 5.1 已通过能力

- 直接 next start / Worker dist；
- 基础条件块、subshell、command substitution；
- literal eval；
- 多层 `bash -c` 基础形式；
- unresolved exec；
- quoted delimiter Here-doc；
- unquoted Here-doc 数据；
- `<<-`；
- Here-doc 传给 bash 的基础执行形式；
- Here-doc 未闭合；
- echo 展示字符串；
- 赋值后 wrapper。

### 5.2 新发现漏报

| Case | 输入摘要 | 预期 | 实际 |
| -- | -- | -- | -- |
| combined login flag | `bash -lc 'next start'` | DANGEROUS | `[]` |
| timeout wrapper | `timeout 10 bash -c 'next start'` | DANGEROUS | `[]` |
| sudo option wrapper | `sudo -u app bash -c 'next start'` | DANGEROUS | `[]` |
| xargs shell | `xargs bash -c 'next start'` | DANGEROUS | `[]` |
| find exec | `find . -exec bash -c 'next start' \;` | DANGEROUS | `[]` |

### 5.3 新发现误报

```sh
cat <<EOF | bash -c 'cat'
next start
EOF
```

Here-doc body 被 `bash -c cat` 作为标准输入读取并输出，不会把 body 的
`next start` 当成新命令执行；当前 scan 返回 DANGEROUS。

### 5.4 根因

- wrapper 语法只识别 `-c` 空格形式，没有覆盖 `-lc` 和其他 shell flags；
- wrapper 前只处理有限 command/env/assignment，没有结构化处理
  `timeout` 参数、sudo options、xargs 和 find `-exec`；
- Here-doc body 的执行判定只要 suffix 含 shell wrapper 就视为执行，
  没有区分“shell 读取 stdin 并输出数据”和“shell 执行 stdin 内容”。

### 5.5 结论

```text
Shell Dynamic Execution: FAIL
Nested Shell Execution: FAIL
Shell False Positive Regression: FAIL
```

## 6. PowerShell 对抗审查

### 6.1 已通过能力

- if/else ScriptBlock；
- nested Invoke-Command ScriptBlock；
- Invoke-Expression 基础形式；
- `&`；
- Start-Process；
- echo/Write-Host 普通字符串；
- Here-string Write-Host 数据；
- Here-string 变量传给 Invoke-Expression；
- unclosed Here-string；
- unknown variable command。

### 6.2 新发现漏报

| Case | 输入摘要 | 预期 | 实际 |
| -- | -- | -- | -- |
| Get-Content execution | `Invoke-Expression (Get-Content .\release.ps1)` | UNKNOWN | `[]` |
| scriptblock create | `Invoke-Expression ([scriptblock]::Create('next start'))` | DANGEROUS | `[]` |
| Invoke-Command file | `Invoke-Command -FilePath .\release.ps1` | UNKNOWN | `[]` |

### 6.3 根因

- 对 `Invoke-Expression` 只检查外层的 literal/variable text，未识别
  `Get-Content` 等动态内容来源；
- `[scriptblock]::Create` 未作为脚本代码构造入口；
- `Invoke-Command -FilePath` 未作为外部脚本执行入口。

### 6.4 结论

```text
PowerShell Scanner: FAIL
```

## 7. CMD/BAT 回归

未重写或新增实现，独立测试当前行为：

| Case | 结果 |
| -- | -- |
| IF | DANGEROUS |
| FOR DO | DANGEROUS |
| CALL / START | DANGEROUS |
| cmd /c | DANGEROUS |
| `%VAR%` / `!VAR!` | UNKNOWN/DANGEROUS |
| `%1` / `%*` | UNKNOWN |
| nested parentheses | DANGEROUS |
| goto label | DANGEROUS |
| echo data | SAFE |

```text
CMD/BAT Regression: PASS
```

## 8. Build Preflight 独立故障注入

独立确认：

```text
HEAD required missing/read null/throw/parse:
head.complete=false

HEAD enumeration failure:
head.complete=false

HEAD extra script read failure:
head.complete=false

HEAD complete but old Startup Gate FAIL:
complete=true; worktree can continue

Worktree Startup Gate FAIL:
Preflight blocked

Manifest identity fail:
Preflight blocked

Signing key fail:
Preflight blocked

Target/Reparse fail:
Preflight blocked

Builder preflight failure calls:
0

Builder failure:
success continuation 0

Legacy Artifact fallback:
NONE
```

真实当前 Preflight：

```text
BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE
```

`apps/web/.p13-releases` 与 `apps/web/.p13-build` 未创建。

```text
A7.3 P1-2 Regression: PASS
HEAD Required File Integrity: PASS
Build Preflight: PASS
Builder Zero-Call on Failure: PASS
```

## 9. A4 / A6 / Storage 回归

```text
A4 Web Security: PASS
A4 Worker Security: PASS
A6 Build Integrity: PASS
Manifest Integrity: PASS
Legacy Artifact Reuse: PASS
Storage Delete Capability: UNAVAILABLE
```

具体：

- Web secure launcher 先于 Next；
- instrumentation Gate 存在；
- production dist 不回落 `.next`；
- Worker Gate-first 顺序未变；
- Gate 前无 Prisma/PgBoss/Job/Maintenance；
- Signed Manifest、Source/Dependency/Runtime/Artifact Digest 未回归；
- signing key、target、祖先 Reparse 检查未回归；
- Web/Worker delete capability 仍不可用。

## 10. 缺陷清单

### P1-1：JavaScript 深层间接调用漏报

多个静态可读形式返回 SAFE。可导致包装后的 child_process API 或动态执行
入口绕过 Scanner。

### P1-2：Shell 常见 wrapper 变体漏报

`-lc`、timeout、sudo options、xargs 和 find `-exec` 可执行危险命令但被
判 SAFE。

### P1-3：PowerShell 动态脚本来源漏报

Get-Content、scriptblock create 和 FilePath 执行返回 SAFE。

### P2-1：Shell Here-doc 管道执行语义误报

`cat <<EOF | bash -c 'cat'` 的数据正文被误判为执行命令。

### P2-2：Scope / dataflow 能力边界未完整披露

当前报告声称多语言 semantic remediation 完成，但未完整披露上述未覆盖
的静态可读形式。

## 11. 测试结果

本轮实际执行：

```text
Web:
24 files / 200 tests PASS

  p13-startup-preflight:
  50 tests PASS

Worker:
6 files / 19 tests PASS

  concurrent run:
  existing PDF test reached 5s timeout

  isolated rerun:
  6 files / 19 tests PASS

file-storage:
2 files / 19 tests PASS

Web TypeScript: PASS
Worker TypeScript: PASS
file-storage TypeScript: PASS
```

全套既有测试通过，但额外对抗输入发现上述 P1/P2，因此不能判定 Scanner
PASS。

## 12. 受保护文件

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

## 13. 执行边界

本轮未执行：

- Git 写操作；
- 真实 Build；
- Web/Worker 启动；
- E2E / Integration；
- PostgreSQL / SQL / Migration；
- 真实 Storage；
- Cleanup；
- 历史 Artifact 移动、删除或执行；
- ACL / IAM / Service / Registry 修改。

所有对抗输入均为内存字符串；仅调用 Scanner 纯函数。

## 14. 最终提交建议

当前不得提交。修复上述 P1/P2 后应重新执行独立审查。

修复后候选提交仍按 A7.5 的依赖闭包处理，并特别注意：

- `apps/web/package.json` 的 `p13:evidence:validate` 必须精确 hunk
  暂存，或同时提交对应 Evidence CLI；
- Implementation Status 必须与完整架构文档闭包一致；
- 不得提交 `.next`、`dist`、Schema、Migration 或秘密配置；
- 不得使用 `git add .`。

## 15. 最终验收字段

```yaml
JS/TS Scanner: FAIL
Dynamic Execution Detection: FAIL
bind() Alias Tracking: FAIL
Computed Property Tracking: FAIL
Shell Scanner: FAIL
Shell Dynamic Execution: FAIL
Nested Shell Execution: FAIL
Shell Here-doc Data Separation: FAIL
PowerShell Scanner: FAIL
PowerShell Here-string Data Separation: PASS
CMD/BAT Scanner: PASS
Adversarial Tests: PASS BUT FOUND P1/P2
UNKNOWN Fail-Closed: PASS FOR EMITTED UNKNOWN
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
Commit Inventory: COMPLETE / BLOCKED
Database: NOT CONNECTED
Storage: NOT ACCESSED
Real Build: NOT EXECUTED
Git Write Operations: NOT EXECUTED
Production Deployment: NOT DEPLOYED
Commit Authorization: NOT GRANTED
Next Phase: NOT AUTHORIZED
```

本报告 SHA-256 在最终交付消息中提供。
