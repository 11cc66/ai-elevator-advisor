# P1-3 C-6.2-L8-A7.16 Independent Adversarial Scanner & Build Preflight Review

## 1. 最终结论

- 阶段：`C-6.2-L8-A7.16`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 总体结论：`FAIL`
- Commit Authorization：`NOT GRANTED`
- Next Phase：`NOT AUTHORIZED`

A7.14 的两个原始 P1 已独立验证修复：

- nested computed destructuring -> DANGEROUS；
- unknown PowerShell command/file/input/function source via `& $variable`
  -> UNKNOWN。

但新的 PowerShell invocation 组合仍存在 P1：

- `$object.property.Invoke()`；
- `$global:script.Invoke()`；
- `(Get-Target).Invoke()`；
- `$script.GetNewClosure().Invoke()`；
- 未知 `Invoke-Command -ScriptBlock $script`。

其中明确危险的 ScriptBlock 通过 object property、global variable 或函数返回
后 `.Invoke()`，实际仍返回 SAFE。

真实 Build Preflight 临时 fixture 已确认：这些漏报会使 Builder 被调用一次，
构成 Preflight 绕过。

## 2. Skills 与基线

### 2.1 Skills

已实际读取并应用：

- `$project-architecture`
- `$security-audit`
- `$testing-and-verification`
- `$file-lifecycle`

未调用 `$prisma-db-safety`，本轮没有数据库变化。

### 2.2 Git

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

工作树保持 A4-A7.15 的既有未提交修改。本轮未修改源码、测试、配置、
Migration 或历史报告。

### 2.3 哈希

```text
A7.15 Design:
B205CD08130D6E7EED824DD8C3B955CC52928640DFFDB56C4DC06A0FA6DF3B03

A7.15 Report:
A3FEAA951931F85C4A362BDE4E40276A26FAB38A383C4FD70E8A41485A580DD7

Implementation Status:
F62415A33AE50B705F6B7B6A7A229C671F739C8ADAA696EE6EA2512376EBBAD9

Scanner:
45D112E83AE55891C34DD49ADF2A657DFA9348BF2C9B12D24C3D3E3529FDDED7

Test:
1CC9A16268C9F8C66F926E073A4BEE632052E617D4C29A1C6A0DD804B1582B7F

A7.14 Review:
36FBEB9C7E5284D84CF5F1300DBBD929A6A39E447FDCF1A95034D95A7FE65456
```

全部与本次最新基线一致。

## 3. A7.15 两个 P1 原始复核

| Case | Expected | Actual |
| -- | -- | -- |
| nested computed destructuring | DANGEROUS/UNKNOWN | DANGEROUS |
| `Get-RemoteScript; & $script` | UNKNOWN | UNKNOWN |
| `Get-Content; & $script` | UNKNOWN | UNKNOWN |
| `Read-Host; & $script` | UNKNOWN | UNKNOWN |
| unknown function return; `& $script` | UNKNOWN | UNKNOWN |

```text
A7.14 P1-1:
PASS

A7.14 P1-2 original call-operator samples:
PASS
```

这只证明 A7.14 原始样例关闭，不代表 PowerShell invocation identity 的全部
调用形式已关闭。

## 4. JavaScript / TypeScript 独立对抗

### 4.1 Nested computed destructuring

| Case | Expected | Actual |
| -- | -- | -- |
| object -> nested object | DANGEROUS | DANGEROUS |
| object -> nested array -> object | DANGEROUS | DANGEROUS |
| double dynamic key | DANGEROUS | DANGEROUS |
| safe + dangerous candidate | DANGEROUS | DANGEROUS |
| unknown + dangerous candidate | DANGEROUS | DANGEROUS |
| alias | DANGEROUS | DANGEROUS |
| default dangerous | DANGEROUS | DANGEROUS |
| all-safe candidate | SAFE | SAFE |
| danger overwritten by safe function | SAFE | SAFE |

示例：

```javascript
const src = {
  nested: [{ run: cp.spawn }]
};
const key = process.env.KEY;
const { [key]: [{ run }] } = src;
run("next", ["start"]);
```

结果：

```text
SCRIPT_DIRECT_NEXT_START / DANGEROUS
```

### 4.2 Default semantics

```javascript
const src = { a: {} };
const { [key]: { run = cp.spawn } } = src;
```

结果：

```text
DANGEROUS
```

outer object 存在但 inner property 缺失时 default 正确生效。

### 4.3 Safe reassignment

```javascript
let { [key]: { run } } = sourceWithSpawn;
run = () => {};
run("next", ["start"]);
```

结果：

```text
SAFE
```

旧危险状态被 kill。

### 4.4 JavaScript 结论

```text
Nested Computed Destructuring: PASS
Recursive Candidate Merge: PASS
Default / Alias / Kill-Gen: PASS
JavaScript No New P1/P2: PASS
```

## 5. PowerShell 独立对抗

### 5.1 Call operator 原路径

以下继续保持正确：

```text
& $unknown -> UNKNOWN
& $obj.target -> UNKNOWN
& $items[0] -> UNKNOWN
```

安全 ScriptBlock call operator：

```text
& $safeScript -> SAFE
```

危险 ScriptBlock call operator：

```text
& $dangerScript -> DANGEROUS
```

### 5.2 新发现 P1：dotted/global/function `.Invoke()`

#### Object property

```powershell
$obj = @{
  target = [scriptblock]::Create('next start')
}
$obj.target.Invoke()
```

预期：

```text
DANGEROUS
```

实际：

```text
SAFE
```

未知来源同类：

```powershell
$obj = @{ target = Get-RemoteScript }
$obj.target.Invoke()
```

预期 UNKNOWN，实际 SAFE。

#### Array element

```powershell
$items = @(Get-RemoteScript)
$items[0].Invoke()
```

实际 UNKNOWN，因为数组 identity 被识别；这条路通过。

但当 array 只由未知原始 source 产生且没有 identity map 时，仍有遗漏风险。

#### Global variable

```powershell
$global:script = [scriptblock]::Create('next start')
$global:script.Invoke()
```

预期 DANGEROUS，实际 SAFE。

#### Function result

```powershell
function Get-Target {
  return [scriptblock]::Create('next start')
}
(Get-Target).Invoke()
```

预期 DANGEROUS，实际 SAFE。

#### Method chain

```powershell
$script = Get-RemoteScript
$script.GetNewClosure().Invoke()
```

预期 UNKNOWN，实际 SAFE。

#### Invoke-Command

```powershell
$script = Get-RemoteScript
Invoke-Command -ScriptBlock $script
```

预期 UNKNOWN，实际 SAFE。

### 5.3 根因

当前 `.Invoke()` identity matching 主要覆盖：

```text
$name.Invoke()
$name[index].Invoke()
```

没有覆盖：

- dotted property path；
- scope-qualified variable path；
- invocation expression return；
- method-chain return；
- `Invoke-Command -ScriptBlock` 变量参数。

对象/全局/函数结果的 identity 没有统一到“可取 `.Invoke()` 的目标”模型。

### 5.4 PowerShell 结论

```text
Original A7.14 samples: PASS
Extended `.Invoke()` semantics: FAIL
Invoke-Command ScriptBlock variable semantics: FAIL
UNKNOWN Fail-Closed: FAIL
```

## 6. Build Preflight 绕过

### 6.1 已知正常路径

```text
direct DANGEROUS -> BUILD_SOURCE_SECURITY_FAILED / builder 0
```

### 6.2 实际绕过

使用隔离临时 fixture，将以下文件加入 Worktree scripts：

```powershell
$obj = @{
  target = [scriptblock]::Create('next start')
}
$obj.target.Invoke()
```

Preflight 结果：

```text
BUILD RESULT: built
Builder calls: 1
Target created: No (builder did not create it in Mock)
```

未知对象来源：

```powershell
$obj = @{ target = Get-RemoteScript }
$obj.target.Invoke()
```

同样：

```text
BUILD RESULT: built
Builder calls: 1
```

这确认 Scanner SAFE 误判实际穿透 Build Preflight。

### 6.3 HEAD 完整性

HEAD 缺失、读取失败、解析失败和 inventory failure 仍正确阻断：

```text
BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE
Builder calls: 0
```

HEAD completeness 没有回归，但 Worktree Scanner 漏报可以绕过 Preflight。

```text
Build Preflight:
FAIL / scanner false-negative bypass
```

## 7. 四态语义

```text
Known nested JS danger:
DANGEROUS

Known PowerShell unknown source via `&`:
UNKNOWN

Known dangerous ScriptBlock via object/global/function `.Invoke()`:
INCORRECT SAFE

Unknown source via dotted `.Invoke()`:
INCORRECT SAFE

Parser failure:
ERROR

Budget exhaustion:
ERROR
```

判定：

```text
SAFE / DANGEROUS / UNKNOWN / ERROR Separation:
FAIL
```

## 8. 历史回归

```text
Web:
24 files / 214 tests PASS

Startup Scanner:
64 tests PASS

Worker:
6 files / 19 tests PASS

file-storage:
2 files / 19 tests PASS
```

Worker 本轮并发全量运行：

```text
6 files / 19 tests PASS
PDF tests 4.377s / 1.170s / 0.972s
```

未触发 5 秒 timeout。

历史：

```text
A7.8 known P1: PASS
A7.10 JS/Shell/PowerShell: PASS for existing tests
A7.12 six P1: PASS
A7.13 dynamic identity: PASS
A7.14 two original P1: PASS
A7.15 nested/unknown original: PASS
skip / only / todo: NONE FOUND
```

现有测试通过不能抵消新的 `.Invoke()` 漏报。

## 9. 资源与性能

三次运行：

```text
500-candidate dynamic object:
45.76 / 18.73 / 12.32 ms
DANGEROUS

JS depth 16:
37.23 / 31.00 / 26.32 ms
BUDGET_EXHAUSTED ERROR

100-level unknown PowerShell chain:
823 bytes
21.75 / 7.04 / 7.11 ms
UNKNOWN

Malformed PowerShell:
17 bytes
0.27 / 0.07 / 0.03 ms
ERROR
```

未发现无限递归、超时或预算耗尽后 SAFE。

## 10. A4 / A6 / Manifest / Storage

```text
A4 Web Security: PASS
A4 Worker Security: PASS
A6 Build Integrity: PASS
Signed Manifest: PASS
Source Tree Digest: PASS
Runtime Dependency Digest: PASS
Legacy Artifact Reuse Protection: PASS
Storage Delete Capability: UNAVAILABLE
```

真实 Worktree/HEAD：

```text
Worktree Startup Gate: PASS
HEAD Startup Gate: FAIL / expected before commit
worktreeFindings: 0
worktreeUnknowns: 0
worktreeScriptsEnumerated: 29
headScriptsEnumerated: 8
```

## 11. 受保护文件

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

## 12. 问题清单

### P1-1 PowerShell dotted `.Invoke()`

Object property 和 scope-qualified/global ScriptBlock 没有进入 identity
invocation 分析。

### P1-2 PowerShell expression `.Invoke()`

函数返回和方法链结果没有 identity 传播。

### P1-3 Invoke-Command unknown ScriptBlock

`Invoke-Command -ScriptBlock $unknown` 未产生 UNKNOWN。

### P1-4 Preflight bypass

上述 false-negative 使 Builder 被调用一次，属于实际 fail-closed 绕过。

### P3-1 Worker timing

A7.14 记录过并发 PDF 超时；本轮并发测试通过，未复发。

## 13. 未验证事项与限制

- 未执行真实 Build；
- 未连接 PostgreSQL；
- 未访问真实 Storage；
- Production Trust Root/ACL/Runtime Identity 未验证；
- PowerShell 仍是有限文本/identity 模型；
- 跨文件函数体未解析。

## 14. 核心文件哈希

```text
script-security.mjs
45D112E83AE55891C34DD49ADF2A657DFA9348BF2C9B12D24C3D3E3529FDDED7

p13-startup-preflight.test.ts
1CC9A16268C9F8C66F926E073A4BEE632052E617D4C29A1C6A0DD804B1582B7F

startup-security.mjs
B6F4DC33B50CF755DC74D47B8FC819C40964A9553D44D420DEE1A62AAF137DB4

Implementation Status
F62415A33AE50B705F6B7B6A7A229C671F739C8ADAA696EE6EA2512376EBBAD9
```

## 15. 建议

1. 将 PowerShell invocation identity 扩展为通用 callable path：
   - scope-qualified variable；
   - object property；
   - array element；
   - method chain；
   - function call result。
2. `.Invoke()` 与 `&` 共用同一个 target resolver。
3. 为 `Invoke-Command -ScriptBlock $target` 增加 identity 分析。
4. 增加已知危险、未知和安全 ScriptBlock 的 dotted invocation 测试。
5. 重新验证 Preflight 在 Scanner 命中这些路径时 Builder 为 0。

## 16. 最终验收字段

```yaml
A7.15 Baseline Hash: PASS
A7.14 Original P1-1: PASS
A7.14 Original P1-2: PASS
Nested Destructuring Extended Cases: PASS
PowerShell `& $variable` Unknown: PASS
PowerShell `.Invoke()` Identity: FAIL
PowerShell Dotted Property Invoke: FAIL
PowerShell Global Invoke: FAIL
PowerShell Function Result Invoke: FAIL
Invoke-Command ScriptBlock Variable: FAIL
SAFE/DANGEROUS/UNKNOWN/ERROR Semantics: FAIL
Resource Budget: PASS
Scanner Crash: NOT FOUND
Scanner Timeout: NOT OBSERVED
Build Preflight: FAIL / SCANNER BYPASS
Historical Tests: PASS
Skipped/Only/Todo: NONE
Worker Concurrent Test: PASS
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
C-6.2-L8-A7.16:
FAIL

Implementation Status:
NOT MODIFIED

Required Next Action:
FIX POWERSHELL IDENTITY/INVOKE PROPAGATION, THEN RUN A NEW INDEPENDENT REVIEW

Git Write:
NOT EXECUTED

Next Phase:
NOT AUTHORIZED
```

本报告 SHA-256 在最终交付消息中提供。
