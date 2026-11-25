# P1-3 C-6.2-L8-A7.13 Dynamic Value Propagation & Strict Execution Input Validation Report

## 1. 最终结论

- 阶段：`C-6.2-L8-A7.13`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 总体结论：`PASS`
- Commit Authorization：`NOT GRANTED`
- Next Phase：`NOT AUTHORIZED`

A7.12 六项 P1 已全部整改：

1. dynamic computed object read；
2. dynamic computed destructuring；
3. dynamic array index Scanner 异常；
4. unknown callable 传播；
5. ScriptBlock variable call operator；
6. invalid EncodedCommand Base64。

最终真实扫描：

```text
Worktree Startup Gate: PASS
HEAD Startup Gate: FAIL / expected before authorized commit
worktreeComplete: true
headComplete: false
worktreeFindings: 0
worktreeUnknowns: 0
```

## 2. 基线

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

A7.12 Review:
62EB708B834B2EEDF986C125B6FCE33113323AB719A33E6A267F9B968551C204

A7.11 Design:
1DE469E3DF9E317A198928457BEDF4C2A109B5F4A91353931703A138B28A40C2

A7.11 Report:
5882D5012E3ADCC73180286A9515BD95A66FA2E83C8D41596714236B04E9384D
```

所有哈希与任务基线一致。工作树已有跨阶段修改全部保留。

## 3. A7.12 根因与修复

### 3.1 Dynamic computed object read

根因：

- object 已有 properties Map；
- dynamic key 为 null 时直接返回 null；
- 调用方把 null 解释为 SAFE。

修复：

- dynamic key 合并全部 properties；
- process / dynamic / reflect candidate 优先；
- UNKNOWN candidate 传播 UNKNOWN；
- 仅安全 callable candidate 返回安全函数；
- 不存在 callable 时继续由 unresolved value 规则处理。

结果：

```text
source 含 cp.spawn + runtime key:
DANGEROUS

source 只含安全 callable:
SAFE

source 本身 UNKNOWN:
UNKNOWN
```

### 3.2 Dynamic computed destructuring

修复：

- BindingPattern ComputedPropertyName；
- assignment pattern computed property；
- nested destructuring；
- default initializer；
- multiple properties；
- alias/parameter/return propagation。

动态 key 无法求值时使用 object candidate merge。

结果：

```text
dangerous candidate -> DANGEROUS
safe candidate -> SAFE
unknown source -> UNKNOWN
```

### 3.3 Dynamic array index

根因：

- array abstract value 结构不完整时直接遍历 `elements`；
- `candidates` 可能不是数组，触发 TypeError。

修复：

- 所有 candidate collection 进行 `Array.isArray()` / Map 校验；
- array binding、read、write、`.at()` 和 destructuring 统一防护；
- elementsUnknown -> UNKNOWN；
- 危险元素 -> DANGEROUS；
- 仅安全元素 -> SAFE；
- 无法识别结构 -> ERROR。

结果：

```text
dynamic array dangerous candidate:
DANGEROUS

no Scanner exception:
PASS
```

### 3.4 Unknown callable

新增 unresolved runtime expression：

```text
CallExpression
NewExpression
PropertyAccessExpression
ElementAccessExpression
AwaitExpression
YieldExpression
```

变量声明、赋值、函数参数无法形成 alias/constant 时传播 UNKNOWN。

`process.env.*` 显式产生 UNKNOWN。

结果：

```text
const run = process.env.RUN; run(...)
-> UNKNOWN

function factory(){ return process.env.RUN }
const run=factory(); run(...)
-> UNKNOWN
```

### 3.5 ScriptBlock identity

根因：

- 调用检查在变量展开后执行；
- `& $script` 被替换成 Create 文本，丢失变量身份。

修复：

- ScriptBlock identity Map；
- direct Create；
- variable assignment；
- alias chain；
- function return；
- function parameter；
- global captured variable；
- array element；
- object property；
- call operator；
- `.Invoke()`；
- reassignment kill/gen。

结果：

```text
$script=Create('next start'); & $script
-> DANGEROUS

$alias=$script; & $alias
-> DANGEROUS

function Get-Script { return Create(...) }
$script=Get-Script; & $script
-> DANGEROUS

$scripts=@(Create(...)); & $scripts[0]
-> DANGEROUS

function Run-Script($s){ & $s }
Run-Script $script
-> DANGEROUS

safe ScriptBlock
-> SAFE

unknown identity
-> UNKNOWN
```

### 3.6 EncodedCommand

根因：

`Buffer.from(value, "base64")` 宽松接受非法内容。

修复：

- 识别 `-EncodedCommand` / `-ec` / `-e`；
- 完整 token capture；
- Base64 alphabet；
- 长度 4 倍数；
- padding 合法性；
- canonical re-encode；
- UTF-16LE 偶数长度；
- UTF-8 fatal decode；
- 空内容拒绝；
- decoded PowerShell 递归扫描。

结果：

```text
valid dangerous encoded -> DANGEROUS
valid safe encoded -> SAFE
invalid alphabet -> UNKNOWN
invalid padding -> UNKNOWN
truncated -> UNKNOWN
invalid UTF -> UNKNOWN
decoded incomplete function -> ERROR
decoded dynamic execution -> UNKNOWN
```

## 4. 异常与 fail-closed

公开入口：

```text
scanAuxiliaryScript()
```

现在捕获未预期内部异常并返回：

```text
SCRIPT_SCANNER_INTERNAL_ERROR
classification = ERROR
```

诊断包含 Scanner path 和 exception 类型/消息；不会返回 SAFE，也不会把异常
直接泄漏到调用方。

对 Dynamic array 的原崩溃样例现在返回 DANGEROUS，并由新增结构不变量防止
同类 TypeError。

## 5. A7.12 P1 测试映射

| A7.12 P1 | Expected | Actual |
| -- | -- | -- |
| dynamic object read | DANGEROUS/UNKNOWN | DANGEROUS |
| dynamic destructuring | DANGEROUS/UNKNOWN | DANGEROUS |
| dynamic array index | no crash + DANGEROUS | DANGEROUS |
| factory unknown callable | UNKNOWN | UNKNOWN |
| ScriptBlock call operator | DANGEROUS/UNKNOWN | DANGEROUS |
| invalid EncodedCommand | UNKNOWN | UNKNOWN |

## 6. 安全负样例

```text
dynamic object with safe callable properties: SAFE
dynamic array with safe callables: SAFE
dynamic safe destructuring with default: SAFE
unknown dynamic object source: UNKNOWN

safe ScriptBlock variable call: SAFE
safe ScriptBlock array call: SAFE
ScriptBlock danger -> safe reassignment: SAFE

valid safe EncodedCommand: SAFE
safe PowerShell literal execution input: SAFE
```

没有通过扩大危险关键词集合来制造 PASS。

## 7. 历史回归

```text
Web:
24 files / 212 tests PASS

Startup Scanner:
62 tests PASS

Worker:
6 files / 19 tests PASS

file-storage:
2 files / 19 tests PASS
```

保留：

- A7.4 dynamic execution/alias；
- A7.5 Here-string / Here-doc；
- A7.6 deep alias；
- A7.7 higher-order / object / bind；
- A7.8 twelve P1；
- A7.9 assignment/array/Reflect/Wrapper/PowerShell；
- A7.10 adversarial combinations；
- A7.11 abstract interpretation/resource budget；
- A7.12 dynamic value regressions。

未发现测试 skip、only 或 todo。

## 8. 性能与资源

```text
JS depth 9:
DANGEROUS

JS depth 12 / 16:
SCRIPT_ANALYSIS_BUDGET_EXHAUSTED / ERROR

16-layer three-run:
43.53 / 28.39 / 22.51 ms

20,000-element safe array:
108,932 bytes
134.33 / 124.51 / 109.06 ms
SAFE

100-deep ScriptBlock alias chain:
1,044 bytes
17.30 / 6.01 / 6.92 ms
DANGEROUS

66,705-byte safe EncodedCommand:
12.04 / 7.62 / 6.65 ms
SAFE
```

没有无限递归、未捕获异常或预算后 SAFE。

## 9. Builder fail-closed

隔离临时 fixture 的真实调用链：

```text
executeGuardedBuild()
  -> runBuildSecurityPreflight()
  -> inspectStartupEntrySecurity()
  -> scanAuxiliaryScript()
```

结果：

| Worktree failure | Error | Builder calls |
| -- | -- | --: |
| UNKNOWN | `BUILD_SOURCE_SECURITY_FAILED` | 0 |
| Parser ERROR | `BUILD_SOURCE_SECURITY_FAILED` | 0 |
| Budget ERROR | `BUILD_SOURCE_SECURITY_FAILED` | 0 |

HEAD 缺失、读取失败、解析失败、inventory failure：

```text
BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE
Builder calls: 0
```

## 10. A4 / A6 / Storage

```text
A4 Web Security: PASS
A4 Worker Security: PASS
A6 Build Integrity: PASS
Manifest Integrity: PASS
Legacy Artifact Reuse: PASS
Storage Delete Capability: UNAVAILABLE
```

真实扫描：

```text
Worktree Startup Gate: PASS
HEAD Startup Gate: FAIL / expected before commit
worktreeFindings: 0
worktreeUnknowns: 0
worktreeScriptsEnumerated: 29
headScriptsEnumerated: 8
```

## 11. TypeScript / Syntax

```text
Web TypeScript: PASS
Worker TypeScript: PASS
file-storage TypeScript: PASS
Build Integrity MJS: 3 files PASS
```

## 12. 修改文件

```text
packages/build-integrity/src/script-security.mjs
apps/web/tests/p13-startup-preflight.test.ts
docs/architecture/file-lifecycle-p13-c6-2-l8a7-13-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-13-report.md
docs/architecture/file-lifecycle-p13-implementation-status.md
```

未修改：

- `startup-security.mjs`；
- Build Preflight；
- Web/Worker Startup Gate；
- Prisma Schema；
- Migration；
- Fixture Builder；
- 生产业务代码；
- 历史 `.next` / Worker `dist`。

## 13. 源码哈希

```text
packages/build-integrity/src/script-security.mjs
8C175B7FB29E49B6927BEFBCFEED1F116F9AACE64E87BEAC56094A683B8A9AF7

packages/build-integrity/src/startup-security.mjs
B6F4DC33B50CF755DC74D47B8FC819C40964A9553D44D420DEE1A62AAF137DB4

apps/web/tests/p13-startup-preflight.test.ts
952025066CE0CF9B898ADA42D478E473379F6BE35965E9C08E8542B94A3689E5
```

## 14. 受保护文件哈希

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

## 15. 文档哈希

```text
A7.13 Design:
25A59506EF59CF5CE3F723C1F6BD3CE3D413BEB5922DC0DA346D3BD86DF33472

Implementation Status:
6E2EA8FC721C366B4BC10E1F0E0CB89EAD592EED90882517A61CA16FA5540024
```

A7.13 Report SHA-256 在最终交付消息中提供。

## 16. 未解决问题

没有已知 P1。

剩余非阻断边界：

- 有限静态解释器；
- 跨文件 PowerShell function 不解析；
- 无法读取的 file source 保持 UNKNOWN；
- 超过资源预算返回 ERROR；
- HEAD 安全源码未提交；
- 生产 Trust Root / ACL / Runtime Identity / Evidence 未验证；
- Legacy Artifact 未处置。

## 17. 工作树

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

apps/web/.p13-releases:
ABSENT

apps/web/.p13-build:
ABSENT
```

既有未提交修改全部保留；本轮没有 Git 写操作。

## 18. 最终验收字段

```yaml
A7.12 Dynamic Object Read: PASS
A7.12 Dynamic Destructuring: PASS
A7.12 Dynamic Array Index: PASS
A7.12 Unknown Callable: PASS
A7.12 ScriptBlock Call Operator: PASS
A7.12 Strict EncodedCommand: PASS
JavaScript Candidate Integrity: PASS
JavaScript Internal Exception Mapping: PASS
PowerShell ScriptBlock Identity: PASS
PowerShell EncodedCommand Strictness: PASS
Safe Negative Cases: PASS
A7.8 Known P1: PASS
A7.4-A7.11 Regression: PASS
UNKNOWN Fail-Closed: PASS
ERROR Fail-Closed: PASS
Scanner Crash: NOT FOUND IN CORRECTED PATHS
Scanner Timeout: NOT OBSERVED
A7.3 P1-2 Regression: PASS
Build Preflight: PASS
Builder Zero-Call: PASS
A4 Web Security: PASS
A4 Worker Security: PASS
A6 Build Integrity: PASS
Manifest Integrity: PASS
Legacy Artifact Reuse: PASS
Storage Delete Capability: PASS / UNAVAILABLE
Worktree Startup Gate: PASS
HEAD Startup Gate: FAIL / EXPECTED BEFORE COMMIT
TypeScript: PASS
Unit Tests: PASS
MJS Syntax: PASS
Protected File Integrity: PASS
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

阶段在报告和自审后停止，等待 A7.14/A8 单独授权。
