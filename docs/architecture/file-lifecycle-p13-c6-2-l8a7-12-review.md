# P1-3 C-6.2-L8-A7.12 Independent Adversarial Abstract Interpretation & Fail-Closed Review

## 1. 最终结论

- 阶段：`C-6.2-L8-A7.12`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 总体结论：`FAIL`
- Commit Authorization：`NOT GRANTED`
- Next Phase：`NOT AUTHORIZED`

A7.11 已知测试和大多数历史能力保持通过，Build Preflight fail-closed
调用链也没有回归。

但独立对抗测试发现新的 P1：

- JavaScript dynamic computed object read 可能选择 `cp.spawn`，但返回 SAFE；
- dynamic object destructuring 丢失危险来源并返回 SAFE；
- dynamic array index 触发未捕获 `TypeError`，Scanner 崩溃；
- 未知 call target 仍可能被当作 SAFE；
- PowerShell 静态构造的危险 ScriptBlock 通过变量 call operator 调用时返回
  SAFE；
- 无效 `-EncodedCommand` Base64 被宽松解码后返回 SAFE。

以上均满足 A7.12 的 FAIL 条件。

## 2. 审查基线

### 2.1 Git

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

工作树保留 A4-A7.11 的既有未提交修改。本轮没有修改源码、测试、配置、
Migration 或 Implementation Status。

### 2.2 哈希核验

```text
A7.11 Design:
1DE469E3DF9E317A198928457BEDF4C2A109B5F4A91353931703A138B28A40C2

A7.11 Report:
5882D5012E3ADCC73180286A9515BD95A66FA2E83C8D41596714236B04E9384D

Scanner:
D992A4AAFB844EC79E3A48DAB932D39128680985318ADA6BFE830925A900E604

Test:
E485571AFD373BBAB9DD8FE7BD31C73F5184E9B930E28D7531327173D080BBFE
```

四项均与任务基线一致。

辅助基线：

```text
startup-security.mjs:
B6F4DC33B50CF755DC74D47B8FC819C40964A9553D44D420DEE1A62AAF137DB4

Implementation Status:
19D4FE9D02A90B4C7BEBB34FA3DB18AB789D4D747C38677244FD8B34ABE87D55
```

## 3. 实际审查入口

所有语言样例直接导入：

```text
packages/build-integrity/src/script-security.mjs
  -> scanAuxiliaryScript()
```

这是 Worktree/HEAD Startup 扫描使用的正式入口。输入通过 Node 标准输入
构造，不执行被扫描代码。

Build Preflight 使用：

```text
packages/build-integrity/src/startup-security.mjs
  -> runBuildSecurityPreflight()
  -> executeGuardedBuild()
```

## 4. A7.8 已知 P1 回归

| Case | Expected | Actual |
| -- | -- | -- |
| JS reassignment | DANGEROUS | DANGEROUS |
| JS array destructuring | DANGEROUS | DANGEROUS |
| JS nested array | DANGEROUS | DANGEROUS |
| JS conditional source | DANGEROUS | DANGEROUS |
| JS direct Reflect | DANGEROUS | DANGEROUS |
| Shell command -p | DANGEROUS | DANGEROUS |
| Shell exec -a | DANGEROUS | DANGEROUS |
| Shell nice -n | DANGEROUS | DANGEROUS |
| Shell stdbuf | DANGEROUS | DANGEROUS |
| Here-doc nested cat/sh | DANGEROUS | DANGEROUS |
| PowerShell Here-string `$()` | DANGEROUS | DANGEROUS |
| PowerShell gc -> iex | UNKNOWN | UNKNOWN |

```text
A7.8 Known P1:
PASS
```

## 5. JavaScript / TypeScript 对抗矩阵

### 5.1 已知 A7.11 能力

| Case | Expected | Actual |
| -- | -- | -- |
| logical OR / nullish | DANGEROUS | DANGEROUS |
| conditional assignment | DANGEROUS | DANGEROUS |
| logical assignment | DANGEROUS | DANGEROUS |
| array element write | DANGEROUS | DANGEROUS |
| object property write | DANGEROUS | DANGEROUS |
| computed property static key | DANGEROUS | DANGEROUS |
| nested mixed object/array | DANGEROUS | DANGEROUS |
| `.at()` static index | DANGEROUS | DANGEROUS |
| Reflect method alias | DANGEROUS | DANGEROUS |
| Reflect destructuring | DANGEROUS | DANGEROUS |
| function parameter mutation | DANGEROUS | DANGEROUS |
| closure reassignment | DANGEROUS | DANGEROUS |
| safe logical / mutation | SAFE | SAFE |

### 5.2 新发现

| ID | Input | Expected | Actual |
| -- | -- | -- | -- |
| JS-N1 | `source[process.env.KEY]`，source 含 cp.spawn | DANGEROUS/UNKNOWN | **SAFE** |
| JS-N2 | dynamic object destructuring `[key]` | DANGEROUS/UNKNOWN | **SAFE** |
| JS-N3 | `values[Number(env.KEY)]` | DANGEROUS/UNKNOWN | **THROWN** |
| JS-N4 | factory 返回 `process.env.RUN` 后调用 | UNKNOWN/ERROR | **SAFE** |

#### JS-N1 / JS-N2

```javascript
const source = { safe: () => {}, run: cp.spawn };
const key = process.env.KEY;
const run = source[key];
run("next", ["start"]);
```

dynamic property key 无法静态确定。source 包含 `cp.spawn`，因此最低应
返回 UNKNOWN；当前直接返回 SAFE。

同类 destructuring：

```javascript
const key = process.env.KEY;
const { [key]: run } = source;
run("next", ["start"]);
```

也返回 SAFE。

#### JS-N3

```javascript
const values = [() => {}, cp.spawn];
const key = process.env.KEY;
const run = values[Number(key)];
run("next", ["start"]);
```

正式 Scanner 抛出：

```text
TypeError: candidates is not iterable
script-security.mjs:3712
```

该路径发生在 `collectJavaScriptBindings()` 的 initializer alias 分析阶段。
Scanner 崩溃本身即为 P1。

#### JS-N4

未知函数来源：

```javascript
function make() { return process.env.RUN; }
const run = make();
run("next", ["start"]);
```

无法证明 call target 安全，当前返回 SAFE。按 A7.12 统一规则应为
UNKNOWN。

### 5.3 JavaScript 结论

```text
Abstract Interpretation: FAIL
Dynamic Object Read: FAIL
Dynamic Destructuring: FAIL
Scanner Exception Handling: FAIL
UNKNOWN Fail-Closed: FAIL
```

## 6. Shell 对抗矩阵

### 6.1 结果

| ID | Input | Expected | Actual |
| -- | -- | -- | -- |
| SH-01 | command -> env -S -> nice -> bash | DANGEROUS | DANGEROUS |
| SH-02 | xargs replace -> command -> env -S -> bash | DANGEROUS | DANGEROUS |
| SH-03 | incomplete env -S bash -c | UNKNOWN | UNKNOWN |
| SH-04 | Here-doc -> tee -> grep | SAFE | SAFE |
| SH-05 | Here-doc -> xargs printf | SAFE | SAFE |
| SH-06 | Here-doc -> unknown filter -> sh | UNKNOWN | UNKNOWN |
| SH-07 | Here-doc -> cat -> xargs -> bash | DANGEROUS | DANGEROUS |
| SH-08 | safe echo wrapper string | SAFE | SAFE |

Shell 组合没有发现新的 P1/P2。A7.10 的 env/sudo/xargs/incomplete 问题
保持修复：

```text
Shell Wrapper Semantics: PASS
Here-doc xargs Flow: PASS
Safe Data Pipeline: PASS
Incomplete Shell Syntax: PASS
```

## 7. PowerShell 对抗矩阵

### 7.1 已通过

| Case | Expected | Actual |
| -- | -- | -- |
| static `& $cmd $arg` | DANGEROUS | DANGEROUS |
| `+` concat -> iex | DANGEROUS | DANGEROUS |
| ScriptBlock concat `.Invoke()` | DANGEROUS | DANGEROUS |
| Get-Content -> ScriptBlock | UNKNOWN | UNKNOWN |
| multi-line ScriptBlock pipeline | UNKNOWN | UNKNOWN |
| custom function -> iex | DANGEROUS/UNKNOWN | DANGEROUS/UNKNOWN |
| Alias provider Get-Content | UNKNOWN | UNKNOWN |
| safe literal iex | SAFE | SAFE |
| safe encoded command | SAFE | SAFE |
| incomplete function | ERROR | ERROR |

### 7.2 新发现

| ID | Input | Expected | Actual |
| -- | -- | -- | -- |
| PS-N1 | `$script=Create('next start'); & $script` | DANGEROUS/UNKNOWN | **SAFE** |
| PS-N2 | invalid `-EncodedCommand not_base64!` | UNKNOWN | **SAFE** |
| PS-N3 | invalid `-ec bad!` | UNKNOWN | **SAFE** |
| PS-N4 | empty `-EncodedCommand ====` | UNKNOWN | UNKNOWN |

#### PS-N1

```powershell
$script = [scriptblock]::Create('next start')
& $script
```

`$script.Invoke()` 被正确识别为 DANGEROUS，但 call operator 版本在变量展开
后丢失 `$script` 名称，没有匹配 ScriptBlock variable invocation，返回 SAFE。

#### PS-N2 / PS-N3

```powershell
pwsh -EncodedCommand not_base64!
powershell -ec bad!
```

当前 regex 截取宽松 Base64 子串，`Buffer.from(..., "base64")` 返回非空但
无效的内容。递归扫描未发现危险后返回 SAFE。

不符合“不支持或不能解析的编码内容返回 UNKNOWN”的要求。

### 7.3 PowerShell 结论

```text
PowerShell Static Flow: PARTIAL
ScriptBlock Call Operator: FAIL
Encoded Command Validation: FAIL
UNKNOWN Fail-Closed: FAIL
```

## 8. 资源与复杂度

### 8.1 深度测试

每项重复 3 次：

| Depth | Result | Time |
| -- | -- | -- |
| 9 | DANGEROUS | 38.00 / 21.44 / 18.82 ms |
| 12 | BUDGET ERROR | 27.79 / 25.14 / 21.25 ms |
| 16 | BUDGET ERROR | 22.67 / 20.38 / 19.75 ms |
| 24 | BUDGET ERROR | 19.87 / 20.44 / 20.70 ms |

A7.10 的 16 层：

```text
18,520.14 ms / SAFE
```

A7.12 的 16 层：

```text
约 20 ms / ERROR
```

资源修复有效。

### 8.2 大型安全输入

```text
20,000-element safe array:
108,932 bytes
140.75 ms
no finding
```

### 8.3 异常与预算

```text
Depth budget:
PASS

Time budget:
PASS / OBSERVED

Large safe data:
PASS

No hang:
PASS

No memory failure:
NOT OBSERVED

Scanner exception on dynamic array index:
FOUND
```

单项资源预算通过，但动态数组 index 的运行时异常是独立 P1。

## 9. Fail-closed 端到端验证

使用系统临时目录和隔离 Mock 构造安全 HEAD/source fixture，分别加入：

```text
UNKNOWN Shell worktree file
Parser ERROR JavaScript worktree file
Budget ERROR deep array worktree file
```

真实调用：

```text
executeGuardedBuild()
  -> runBuildSecurityPreflight()
  -> inspectStartupEntrySecurity()
  -> scanAuxiliaryScript()
```

结果：

| Worktree failure | Error code | Builder calls | Target created |
| -- | -- | --: | -- |
| UNKNOWN execution | `BUILD_SOURCE_SECURITY_FAILED` | 0 | No |
| Parser ERROR | `BUILD_SOURCE_SECURITY_FAILED` | 0 | No |
| Budget ERROR | `BUILD_SOURCE_SECURITY_FAILED` | 0 | No |

HEAD 完整性：

```text
required file missing -> BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE
required file read failure -> blocked
required file parse failure -> blocked
HEAD inventory failure -> blocked
Builder calls -> 0
```

现有调用级测试全部通过。

```text
Scanner UNKNOWN -> Preflight: PASS / BLOCKED
Scanner ERROR -> Preflight: PASS / BLOCKED
Parser ERROR -> Preflight: PASS / BLOCKED
Budget ERROR -> Preflight: PASS / BLOCKED
HEAD incomplete -> Preflight: PASS / BLOCKED
Builder zero-call: PASS
```

这不消除 Scanner 自身崩溃和误判 SAFE 的问题。

## 10. 历史测试回归

```text
Web:
24 files / 209 tests PASS

Startup Scanner:
59 tests PASS

Worker:
6 files / 19 tests PASS

file-storage:
2 files / 19 tests PASS
```

检查：

```text
skip / only / todo:
NONE FOUND

A7.4:
PRESENT

A7.8:
PRESENT / PASS

A7.9:
PRESENT / PASS

A7.10 combination tests:
PRESENT / PASS

A7.11:
PRESENT / PASS

A7.3 HEAD / Builder:
PRESENT / PASS

Manifest / Reparse / Runtime Dependency:
PRESENT / PASS
```

历史断言没有被删除或跳过。

## 11. TypeScript / Syntax

```text
Web TypeScript: PASS
Worker TypeScript: PASS
file-storage TypeScript: PASS
Build Integrity MJS: 3 files PASS
```

## 12. Build / Gate / Storage 回归

真实 Startup 扫描：

```text
Worktree Startup Gate: PASS
HEAD Startup Gate: FAIL / expected before commit
worktreeComplete: true
headComplete: false
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

## 14. 缺陷清单

### P1-1 dynamic computed object read

包含 `cp.spawn` 的对象通过 runtime key 读取时返回 SAFE。

### P1-2 dynamic object destructuring

computed destructuring 丢失危险来源。

### P1-3 JavaScript Scanner crash

dynamic array index 触发未捕获 TypeError。

### P1-4 unknown callable source

无法确定来源的 call target 仍可能返回 SAFE。

### P1-5 PowerShell ScriptBlock call operator

静态危险 ScriptBlock 通过变量 call operator 调用返回 SAFE。

### P1-6 invalid encoded command

无效 Base64 被宽松解析，随后返回 SAFE。

### 非阻断

- Reflect bind 会产生额外 UNKNOWN，但仍保留 DANGEROUS；
- 静态分析仍是有限模型；
- HEAD 安全源码尚未提交；
- 生产 Trust Root/ACL/Runtime 未验证。

## 15. 未解决问题

必须整改以上 P1 后才能重新审查：

1. dynamic object property read 必须在危险候选存在时返回 DANGEROUS，
   否则 UNKNOWN。
2. dynamic object destructuring 使用同样规则。
3. array dynamic index 的 `candidates` 必须容忍缺失 elements，并返回
   UNKNOWN/ERROR，不能抛异常。
4. unknown callable 必须 fail closed。
5. ScriptBlock variable call operator 必须在变量展开前或保留变量身份后
   识别。
6. EncodedCommand 必须严格验证 Base64 和解码文本；无效输入返回 UNKNOWN。

## 16. 最终验收字段

```yaml
A7.11 Baseline Hash: PASS
A7.8 Known P1 Regression: PASS
JavaScript Logical/Assignment Flow: PASS
JavaScript Static Computed Property: PASS
JavaScript Dynamic Computed Property: FAIL
JavaScript Dynamic Destructuring: FAIL
JavaScript Scanner Exception Handling: FAIL
Unknown Callable Fail-Closed: FAIL
Shell Wrapper / Here-doc: PASS
Shell Safe Data Pipeline: PASS
PowerShell Static Flow: PARTIAL
PowerShell ScriptBlock Invoke: PARTIAL
PowerShell ScriptBlock Call Operator: FAIL
PowerShell Invalid Encoded Command: FAIL
PowerShell Syntax Completeness: PASS
Resource Depth Budget: PASS
Resource Time Budget: PASS
Large Safe Data: PASS
Scanner Crash: FOUND
Scanner Timeout: NOT OBSERVED
UNKNOWN -> Preflight Block: PASS
ERROR -> Preflight Block: PASS
Builder Zero-Call: PASS
A7.3 P1-2 Regression: PASS
A4 Web Security: PASS
A4 Worker Security: PASS
A6 Build Integrity: PASS
Manifest Integrity: PASS
Legacy Artifact Reuse: PASS
Storage Delete Capability: PASS / UNAVAILABLE
Historical Tests: PASS
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
C-6.2-L8-A7.12:
FAIL

Implementation Status:
NOT MODIFIED

Required Next Action:
FIX ALL P1 FINDINGS, THEN RUN A NEW INDEPENDENT REVIEW

Git Write:
NOT EXECUTED

Next Phase:
NOT AUTHORIZED
```

本报告 SHA-256 在最终交付消息中提供。
