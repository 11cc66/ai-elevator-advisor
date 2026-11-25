# P1-3 C-6.2-L8-A7.14 Independent Adversarial Scanner & Build Preflight Review

## 1. 最终结论

- 阶段：`C-6.2-L8-A7.14`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 总体结论：`FAIL`
- Commit Authorization：`NOT GRANTED`
- Next Phase：`NOT AUTHORIZED`

A7.12 六项 P1 已独立复测通过，A7.13 已知测试、资源预算、
Build Preflight、A4/A6、Manifest 和 Storage capability 未发现回归。

但独立组合测试发现新的 P1：

- PowerShell 中，来源未知的 ScriptBlock/command variable 在 `& $variable`
  下返回 SAFE；
- 嵌套 computed destructuring 丢失内层危险属性并返回 SAFE。

按 A7.14 判定规则，结论为 FAIL。

## 2. 审查基线

### 2.1 Git

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

工作树保留 A4-A7.13 的既有未提交修改。本轮未修改源码、测试、配置、
Migration 或 Implementation Status。

### 2.2 哈希

```text
A7.13 Design:
25A59506EF59CF5CE3F723C1F6BD3CE3D413BEB5922DC0DA346D3BD86DF33472

A7.13 Report:
52FAE0096C49773171791C0A9F4DFC02BE5A188513352EC24BD0E169580E3340

Implementation Status:
6E2EA8FC721C366B4BC10E1F0E0CB89EAD592EED90882517A61CA16FA5540024

Scanner:
8C175B7FB29E49B6927BEFBCFEED1F116F9AACE64E87BEAC56094A683B8A9AF7

Test:
952025066CE0CF9B898ADA42D478E473379F6BE35965E9C08E8542B94A3689E5
```

全部与 A7.13 基线一致。

## 3. A7.12 六项 P1 复核

| P1 | Expected | Actual |
| -- | -- | -- |
| dynamic object read | DANGEROUS/UNKNOWN | DANGEROUS |
| dynamic destructuring | DANGEROUS/UNKNOWN | DANGEROUS |
| dynamic array index | no crash + DANGEROUS | DANGEROUS |
| factory unknown callable | UNKNOWN | UNKNOWN |
| ScriptBlock call operator | DANGEROUS | DANGEROUS |
| invalid EncodedCommand | UNKNOWN | UNKNOWN |

```text
A7.12 Six P1:
PASS
```

## 4. JavaScript / TypeScript 独立对抗

### 4.1 已通过

| Case | Expected | Actual |
| -- | -- | -- |
| dynamic object mixed safe/danger | DANGEROUS | DANGEROUS |
| dynamic object all safe | SAFE | SAFE |
| dynamic source unknown | UNKNOWN | UNKNOWN |
| dynamic destructuring flat | DANGEROUS | DANGEROUS |
| dynamic destructuring default danger | DANGEROUS | DANGEROUS |
| dynamic array mixed candidate | DANGEROUS | DANGEROUS |
| negative index candidate merge | DANGEROUS | DANGEROUS |
| unknown callable factory | UNKNOWN | UNKNOWN |
| object alias mutation | DANGEROUS | DANGEROUS |
| function parameter mutation | DANGEROUS | DANGEROUS |
| closure reassignment | DANGEROUS | DANGEROUS |
| Reflect method alias / destructuring | DANGEROUS | DANGEROUS |
| safe dynamic object / array | SAFE | SAFE |

### 4.2 新发现 P1：nested computed destructuring

```javascript
const src = {
  nested: { run: cp.spawn }
};
const key = process.env.KEY;
const { [key]: { run } } = src;
run("next", ["start"]);
```

预期：

```text
DANGEROUS 或 UNKNOWN
```

实际：

```text
SAFE
```

根因：

- computed property candidate 只合并第一层 object properties；
- candidate 为 nested object 时，没有继续将 recursive binding pattern
  与该 object 结合；
- inner `run` 从未进入 alias environment。

同类风险：

```javascript
const { [key]: [run] } = src;
const { [key1]: { [key2]: run } } = src;
```

### 4.3 数组和异常

```text
dynamic array index:
no TypeError

float index:
UNKNOWN / fail closed

negative index:
DANGEROUS candidate merge

empty/unknown array:
UNKNOWN
```

A7.12 的 `candidates is not iterable` 未再复现。

### 4.4 JavaScript 结论

```text
Dynamic object/array propagation: PASS
Unknown callable: PASS
Internal exception mapping: PASS
Nested computed destructuring: FAIL
```

## 5. Shell 对抗

| Case | Expected | Actual |
| -- | -- | -- |
| env -S nested wrapper | DANGEROUS | DANGEROUS |
| Here-doc -> xargs -> shell | DANGEROUS | DANGEROUS |
| unknown filter -> sh | UNKNOWN | UNKNOWN |
| safe xargs printf | SAFE | SAFE |
| incomplete shell payload | UNKNOWN | UNKNOWN |

没有发现新的 Shell P1/P2。

## 6. PowerShell 对抗

### 6.1 已通过

| Case | Expected | Actual |
| -- | -- | -- |
| Create -> variable -> `&` | DANGEROUS | DANGEROUS |
| Create -> alias chain -> `&` | DANGEROUS | DANGEROUS |
| function return ScriptBlock | DANGEROUS | DANGEROUS |
| ScriptBlock function parameter | DANGEROUS | DANGEROUS |
| ScriptBlock array element | DANGEROUS | DANGEROUS |
| ScriptBlock object property | DANGEROUS | DANGEROUS |
| global captured ScriptBlock | DANGEROUS | DANGEROUS |
| ScriptBlock reassign danger -> safe | SAFE | SAFE |
| safe ScriptBlock call | SAFE | SAFE |
| invalid encoded chars/padding/truncation/UTF | UNKNOWN | UNKNOWN |
| valid safe encoded | SAFE | SAFE |
| valid dangerous encoded | DANGEROUS | DANGEROUS |

### 6.2 新发现 P1：unknown ScriptBlock/command source

以下输入实际均返回 SAFE：

```powershell
$script = Get-RemoteScript
& $script
```

```powershell
$script = Get-Content .\release.ps1
& $script
```

```powershell
$script = Read-Host 'Command'
& $script
```

```powershell
function Get-Remote { return Get-Random }
$script = Get-Remote
& $script
```

这些来源无法静态确定，最低应返回 UNKNOWN。

根因：

- ScriptBlock identity 只记录明确 Create 和已知 identity；
- unknown command assignment 没有产生 `unknown` identity；
- call operator 最终仍依赖变量展开和有限危险文本匹配；
- unknown function result 被删除出 identity map 后没有通用 call-target
  UNKNOWN 规则。

`New-Object ScriptBlock` 能返回 UNKNOWN，但上述命令/函数返回路径不能。

### 6.3 PowerShell 结论

```text
Known ScriptBlock identity: PASS
EncodedCommand strict validation: PASS
Unknown ScriptBlock source: FAIL
Unknown call-target fail-closed: FAIL
```

## 7. SAFE / DANGEROUS / UNKNOWN / ERROR 判定

```text
Known DANGEROUS paths:
mapped correctly in tested language matrices

Known SAFE negative paths:
remain SAFE

Unknown callable JavaScript:
UNKNOWN

Unknown ScriptBlock PowerShell:
FAIL / some return SAFE

Parser ERROR:
ERROR

Resource budget:
ERROR

Internal exception mapping:
implemented for public Scanner entry
```

## 8. 资源与性能

每项重复 3 次：

```text
JS depth 16:
65.17 / 51.90 / 38.86 ms
SCRIPT_ANALYSIS_BUDGET_EXHAUSTED / ERROR

20,000-element safe array:
108,932 bytes
223.18 / 177.98 / 173.55 ms
SAFE

100-deep ScriptBlock alias chain:
842 bytes
19.40 / 7.43 / 6.92 ms
DANGEROUS

66,705-byte safe EncodedCommand:
13.98 / 9.94 / 7.78 ms
SAFE
```

未发现超时、无限递归或预算后 SAFE。

## 9. Build Preflight fail-closed

独立临时 fixture 结果：

| Worktree failure | Error | Builder calls | Target created |
| -- | -- | --: | -- |
| DANGEROUS | `BUILD_SOURCE_SECURITY_FAILED` | 0 | No |
| UNKNOWN | `BUILD_SOURCE_SECURITY_FAILED` | 0 | No |
| Parser ERROR | `BUILD_SOURCE_SECURITY_FAILED` | 0 | No |
| Budget ERROR | `BUILD_SOURCE_SECURITY_FAILED` | 0 | No |

安全正例：

```text
Preflight: PASS
Builder calls: 1
Result: built
```

HEAD 缺失、读取失败、解析失败和 inventory failure：

```text
BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE
Builder calls: 0
```

Build Preflight fail-closed 未发现绕过。

## 10. 历史回归

```text
Web:
24 files / 212 tests PASS

Scanner:
62 tests PASS

Worker concurrent run:
17/19 PASS
2 PDF tests timed out at existing 5s default

Worker isolated rerun:
vitest run --testTimeout 15000
6 files / 19 tests PASS

file-storage:
2 files / 19 tests PASS
```

超时处理：

- 未修改测试配置；
- 未删除或跳过测试；
- 命令级 15 秒超时隔离复跑通过；
- 记录为环境/并发时序 P3，而非安全功能回归。

历史 A7.4-A7.13 断言均存在；无 skip/only/todo。

## 11. TypeScript / Syntax / Gate

```text
Web TypeScript: PASS
Worker TypeScript: PASS
file-storage TypeScript: PASS
Build Integrity MJS: 3 files PASS
```

真实 Startup：

```text
Worktree Startup Gate: PASS
HEAD Startup Gate: FAIL / expected before commit
worktreeFindings: 0
worktreeUnknowns: 0
worktreeScriptsEnumerated: 29
headScriptsEnumerated: 8
```

A4 / A6：

```text
A4 Web Security: PASS
A4 Worker Security: PASS
A6 Build Integrity: PASS
Manifest: PASS
Legacy Artifact Reuse: PASS
Storage Delete Capability: UNAVAILABLE
```

## 12. 问题清单

### P1-1 Nested computed destructuring

内层危险 object property 在 dynamic recursive destructuring 中丢失，返回 SAFE。

### P1-2 Unknown PowerShell ScriptBlock/command source

Get-Content、Read-Host、unknown command 和 unknown function result 进入
`& $variable` 时返回 SAFE。

### P3-1 Worker PDF timing

并发全量运行时两个 PDF 测试超过既有 5 秒默认值；隔离 15 秒复跑全部通过。

## 13. 受保护文件哈希

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

## 14. 未验证与限制

- 本轮不执行真实 Web/Worker Build；
- 不连接 PostgreSQL；
- 不访问真实 Storage；
- Production Trust Root / ACL / Runtime Identity 未验证；
- PowerShell 是有限静态模型；
- Worker PDF timing 属于环境并发波动，已隔离复跑。

## 15. 建议

在进入下一阶段前应修复：

1. recursive computed destructuring 将 inner binding pattern 与候选 object
   继续合并；
2. PowerShell unknown command/function/content source 在 call operator 前
   转为 UNKNOWN identity；
3. 对 `& $variable` 建立与 JavaScript unknown callable 一致的通用 unknown
   call-target fail-closed；
4. 增加对应负例和安全 ScriptBlock 正例。

## 16. 最终验收字段

```yaml
A7.13 Baseline Hash: PASS
A7.12 Six P1: PASS
JavaScript Dynamic Object/Array: PASS
JavaScript Unknown Callable: PASS
JavaScript Nested Computed Destructuring: FAIL
PowerShell Known ScriptBlock Identity: PASS
PowerShell Unknown ScriptBlock Source: FAIL
PowerShell EncodedCommand Strictness: PASS
Shell Regression: PASS
SAFE/DANGEROUS/UNKNOWN/ERROR Semantics: FAIL
Resource Budget: PASS
Scanner Crash: NOT FOUND
Scanner Timeout: NOT OBSERVED
Preflight DANGEROUS Block: PASS
Preflight UNKNOWN Block: PASS
Preflight ERROR Block: PASS
Builder Zero-Call: PASS
Safe Preflight Positive: PASS
A7.3 Regression: PASS
A4 Web Security: PASS
A4 Worker Security: PASS
A6 Build Integrity: PASS
Manifest Integrity: PASS
Legacy Artifact Reuse: PASS
Storage Delete Capability: PASS / UNAVAILABLE
Historical Tests: PASS
Worker Isolated Timeout Rerun: PASS
Skipped/Only/Todo: NONE
TypeScript: PASS
MJS Syntax: PASS
Worktree Startup Gate: PASS
HEAD Startup Gate: FAIL / EXPECTED BEFORE COMMIT
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

## 17. 审查后状态

```text
C-6.2-L8-A7.14:
FAIL

Implementation Status:
NOT MODIFIED

Required Next Action:
FIX BOTH P1 FINDINGS AND RUN A NEW INDEPENDENT REVIEW

Git Write:
NOT EXECUTED

Next Phase:
NOT AUTHORIZED
```

本报告 SHA-256 在最终交付消息中提供。
