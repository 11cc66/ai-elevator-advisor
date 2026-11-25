# P1-3 C-6.2-L8-A7.8 Independent Adversarial Scanner & Build Preflight Review

## 1. 结论

- 阶段：`C-6.2-L8-A7.8`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 总体结论：`FAIL`
- Git 提交建议：`NOT READY`

### 1.1 摘要

A7.7 报告中的测试全部通过，A7.3 HEAD 完整性与 Build Preflight、A4
Web/Worker Gate、A6 Build Integrity、Storage capability 未发现回归。

但独立攻击输入发现新的 P1 Scanner 漏报：

- JS 变量重新赋值、数组持有函数、数组 destructuring、
  conditional function selection、Reflect.apply 可返回 SAFE；
- Shell `command -p`、`exec -a`、`nice -n`、`stdbuf` wrapper 可返回 SAFE；
- PowerShell double-quoted Here-string 的 `$()` 子表达式和 `gc` alias
  管道可返回 SAFE；
- Shell Here-doc 经 `bash -c 'cat | sh'` 二次解释时被漏报。

因此当前工作树不能进入受控 Git 提交阶段，也不能进入 A8。

## 2. 审查基线

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

### 2.1 A7.7 文档哈希

```text
Design:
3F45F8C052928B6F8CB1444AF11E26349639480DCB4F49805007AF655AC7BA3F

Report:
BC503F6D2278C6AC24E71E5B08122B9F662DDB1951A3778AA06FAE4CC0B8E097

Implementation Status:
35775927D86234BBC516B44D4CE536579E462C23DA3309A87D4ED5FE8D3CA8EF
```

三项均与任务基线一致。

## 3. 实际源码调用链

### 3.1 Scanner

```text
pnpm security:startup
  -> apps/web/scripts/p13-startup-security/cli.ts
  -> @elevator/build-integrity
  -> startup-security.mjs#inspectStartupEntrySecurity
  -> script-security.mjs#scanAuxiliaryScript
```

### 3.2 Build

```text
Web/Worker secure build
  -> executeGuardedBuild
  -> runBuildSecurityPreflight
  -> HEAD complete
  -> worktree security
  -> target / reparse
  -> builder
```

## 4. JavaScript / TypeScript 对抗审查

### 4.1 已通过

- namespace destructuring；
- comma alias；
- double bind；
- object-held eval；
- global element eval；
- bound eval；
- tagged eval；
- higher-order function return；
- multi-level alias / wrapper；
- scope shadowing；
- safe ordinary bind/object；
- parse error。

### 4.2 新发现漏报

以下输入均返回 SAFE：

| Input type | Example | Expected |
| -- | -- | -- |
| variable reassignment | `let run=()=>{}; run=cp.spawn; run("next",["start"])` | DANGEROUS |
| array-held function | `[cp.spawn][0]("next",["start"])` | DANGEROUS |
| array destructuring | `const [run]=[cp.spawn]; run(...)` | DANGEROUS |
| conditional function | `(true ? eval : safe)(code)` | DANGEROUS/UNKNOWN |
| Reflect.apply | `Reflect.apply(cp.spawn,null,["next",["start"]])` | DANGEROUS |

### 4.3 根因

- 抽象值传播只处理 declaration initializer，不处理 AssignmentExpression；
- 数组字面量和数组 destructuring 不进入 alias 传播；
- ConditionalExpression 和 Conditional function selection 未抽象；
- Reflect.apply 等高阶调用 API 未建模；
- 对变量重新赋值没有 kill/gen 语义，也没有对未知重赋值 fail-closed。

### 4.4 结论

```text
JavaScript/TypeScript Scanner: FAIL
Dynamic Execution Detection: FAIL
bind() Alias Tracking: FAIL
Computed Property Tracking: PARTIAL
```

## 5. Shell 对抗审查

### 5.1 已通过

- `bash -lc`；
- timeout；
- sudo options；
- xargs；
- find `-exec`；
- env / assignment wrapper；
- 多层 `-c`；
- command substitution；
- Here-doc 基础数据/执行区分；
- echo 展示字符串。

### 5.2 新发现漏报

| Input | Expected | Actual |
| -- | -- | -- |
| `command -p bash -c 'next start'` | DANGEROUS | SAFE |
| `exec -a app bash -c 'next start'` | DANGEROUS | SAFE |
| `nice -n 5 bash -c 'next start'` | DANGEROUS | SAFE |
| `stdbuf -oL bash -c 'next start'` | DANGEROUS | SAFE |

### 5.3 Here-doc 数据流缺陷

```sh
cat <<EOF | bash -c 'cat | sh'
next start
EOF
```

body 经 `cat` 输出后被内层 `sh` 解释为代码，当前返回 SAFE。

```text
Shell Dynamic Execution: FAIL
Nested Shell Execution: FAIL
Shell Here-doc Data Separation: FAIL
```

根因：

- wrapper 解析只跳过已知 option，不处理 `command -p`、`exec -a`、
  nice/nohup/stdbuf 等复合前缀；
- Here-doc 只判断 wrapper payload 的第一命令是否为数据消费者，没有分析
  管道后续是否将数据传给 shell。

## 6. PowerShell 对抗审查

### 6.1 已通过

- direct Invoke-Expression；
- Get-Content direct source；
- ScriptBlock::Create；
- Invoke-Command -FilePath；
- Invoke-Expression Get-Command alias；
- Here-string Write-Host；
- Here-string Invoke-Expression；
- nested ScriptBlock；
- unclosed Here-string。

### 6.2 新发现漏报

a. Double-quoted Here-string subexpression：

```powershell
@"
$(next start)
"@ | Write-Host
```

PowerShell 会在 Here-string 展开阶段执行 `$()`，但当前扫描器返回 SAFE。

b. `gc` alias pipe：

```powershell
gc .\release.ps1 | Invoke-Expression
```

`gc` 是 `Get-Content` alias；当前扫描器返回 SAFE。

### 6.3 结论

```text
PowerShell Scanner: FAIL
PowerShell Dynamic Script Source: FAIL
PowerShell Here-string Data Separation: FAIL
```

## 7. Here-doc 专项矩阵

| 输入 | 预期 | 实际 |
| -- | -- | -- |
| cat Here-doc data | SAFE | SAFE |
| quoted Here-doc data | SAFE | SAFE |
| double-quoted delimiter | SAFE | SAFE |
| `<<-` data | SAFE | SAFE |
| Here-doc → bash stdin | DANGEROUS | DANGEROUS |
| Here-doc → sh stdin | DANGEROUS | DANGEROUS |
| Here-doc → bash -c cat | SAFE | SAFE |
| Here-doc → bash -c 'cat \| sh' | DANGEROUS | SAFE |
| unclosed Here-doc | UNKNOWN | UNKNOWN |

## 8. CMD/BAT 回归

| 能力 | 结果 |
| -- | -- |
| IF / FOR DO | PASS |
| CALL / START | PASS |
| cmd /c | PASS |
| `%VAR%` / `!VAR!` | PASS |
| `%1` / `%*` | PASS |
| nested block | PASS |
| goto label | PASS |
| echo data | PASS |

```text
CMD/BAT Scanner: PASS
```

## 9. Build Preflight 独立验证

| Scenario | head.complete | Preflight | Builder |
| -- | -- | -- | -- |
| required missing | false | blocked | 0 |
| required read null/throw | false | blocked | 0 |
| required parse fail | false | blocked | 0 |
| HEAD inventory fail | false | blocked | 0 |
| extra script read fail | false | blocked | 0 |
| HEAD complete but Gate FAIL | true | worktree allowed | 1 |
| worktree security FAIL | true | blocked | 0 |
| manifest/signing/reparse fail | true | blocked | 0 |
| builder fail | true | builder ran | continuation 0 |

真实当前 Preflight：

```text
BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE
```

未创建 `.p13-releases` 或 `.p13-build`。

```text
A7.3 P1-2 Regression: PASS
HEAD Required File Integrity: PASS
Build Preflight: PASS
Builder Zero-Call on Failure: PASS
```

## 10. A4 / A6 / Manifest / Storage

```text
A4 Web Security: PASS
A4 Worker Security: PASS
A6 Build Integrity: PASS
Manifest Integrity: PASS
Legacy Artifact Reuse: PASS
Storage Delete Capability: PASS / UNAVAILABLE
```

## 11. 现有测试

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
```

现有测试通过，但不覆盖本轮新增的攻击组合。

## 12. 缺陷清单

### P1-1 JavaScript deep data-flow gaps

变量重新赋值、数组持有函数、数组 destructuring、conditional call、
Reflect.apply 均可绕过正式扫描器。

### P1-2 Shell wrapper/data-flow gaps

command -p、exec -a、nice、stdbuf 和 Here-doc 管道二次解释可漏报。

### P1-3 PowerShell dynamic source / Here-string expansion gaps

double-quoted Here-string subexpression 和 `gc` alias pipe 可漏报。

## 13. 受保护文件

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

## 14. 未执行事项

```text
No Git write
No real Build
No Web/Worker start
No DB/SQL/Migration
No real Storage
No Cleanup
No ACL/IAM change
No legacy Artifact operation
```

## 15. 最终提交建议

当前不得提交。修复上述 P1 后必须重新执行独立审查。

修复后的候选提交闭包沿用 A7.7，并继续注意：

- `apps/web/package.json` 的 Evidence script 必须精确 hunk 或同时提交
  对应 CLI；
- Implementation Status 与完整文档闭包一致；
- 排除 `.next`、`dist`、Schema、Migration、秘密配置；
- 不得使用 `git add .`。

## 16. 最终验收字段

```yaml
JS/TS Scanner: FAIL
Dynamic Execution Detection: FAIL
bind() Alias Tracking: PARTIAL
Computed Property Tracking: PASS
Shell Scanner: FAIL
Shell Dynamic Execution: FAIL
Nested Shell Execution: FAIL
Shell Here-doc Data Separation: FAIL
PowerShell Scanner: FAIL
PowerShell Here-string Data Separation: FAIL
PowerShell Nested ScriptBlock: PASS
CMD/BAT Scanner: PASS
Adversarial Tests: PASS BUT FOUND P1
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
