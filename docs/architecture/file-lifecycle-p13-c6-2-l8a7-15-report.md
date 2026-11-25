# P1-3 C-6.2-L8-A7.15 Nested Destructuring & PowerShell Unknown Invocation Remediation Report

## 1. 最终结论

- 阶段：`C-6.2-L8-A7.15`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 总体结论：`PASS`
- Commit Authorization：`NOT GRANTED`
- Next Phase：`NOT AUTHORIZED`

A7.14 两项 P1 已修复：

1. nested computed destructuring；
2. PowerShell unknown ScriptBlock/command invocation。

原始样例：

```text
nested computed destructuring:
DANGEROUS

Get-RemoteScript; & $script:
UNKNOWN

Get-Content; & $script:
UNKNOWN

Read-Host; & $script:
UNKNOWN

unknown function result; & $script:
UNKNOWN
```

没有原始 P1 再返回 SAFE。

## 2. 基线

```text
A7.14 Report:
36FBEB9C7E5284D84CF5F1300DBBD929A6A39E447FDCF1A95034D95A7FE65456

A7.13 Design:
25A59506EF59CF5CE3F723C1F6BD3CE3D413BEB5922DC0DA346D3BD86DF33472

A7.13 Report:
52FAE0096C49773171791C0A9F4DFC02BE5A188513352EC24BD0E169580E3340

Implementation Status before:
6E2EA8FC721C366B4BC10E1F0E0CB89EAD592EED90882517A61CA16FA5540024

Scanner before:
8C175B7FB29E49B6927BEFBCFEED1F116F9AACE64E87BEAC56094A683B8A9AF7

Test before:
952025066CE0CF9B898ADA42D478E473379F6BE35965E9C08E8542B94A3689E5
```

全部与 A7.14 基线一致。工作树既有未提交修改全部保留。

## 3. P1-1 根因

旧 computed binding：

```text
outer object
  -> dynamic property candidate helper
  -> single dangerous/safe callable
  -> inner pattern
```

若 outer candidate 是 nested object：

```text
{ nested: { run: cp.spawn } }
```

helper 只检查 nested object 自身是否是 callable，没有继续把 inner
`{ run }` 应用于 nested object，导致 inner alias 为空。

## 4. P1-1 修复

新增：

```text
bindingsForPattern(pattern, candidate)
  -> Map<name, abstract value>
```

规则：

1. Identifier -> binding Map；
2. Array -> 逐元素 recursive binding；
3. Object -> property candidate recursive binding；
4. dynamic computed key -> all candidate properties；
5. 每个 candidate 独立生成 binding Map；
6. Maps 按变量名递归 merge；
7. process / dynamic / reflect 优先；
8. unknown 不被安全候选覆盖；
9. null/primitive/type mismatch -> leaf variables UNKNOWN；
10. depth budget -> leaf variables UNKNOWN/ERROR。

### 4.1 安全与危险混合

```javascript
const src = {
  safe: { run: () => {} },
  danger: { run: cp.spawn }
};
const { [key]: { run } } = src;
```

所有 candidate 分别绑定，最终 `run` merge 为 DANGEROUS。

### 4.2 SAFE 负例

```javascript
const src = {
  a: { run: () => {} },
  b: { run: () => {} }
};
```

全部 candidate 安全，最终 SAFE。

## 5. P1-2 根因

旧 PowerShell ScriptBlock identity 只记录可确认的 Create/alias/function
结果。以下 RHS 无法解析时被从 identity map 删除：

```powershell
$script = Get-RemoteScript
$script = Get-Content .\release.ps1
$script = Read-Host 'Command'
function Get-Remote { return Get-Random }
$script = Get-Remote
```

`& $script` 随后既无危险文本，也无 unknown identity，最终 SAFE。

## 6. P1-2 修复

### 6.1 Invocation identity

```text
next-start
worker-dist
safe
unknown
```

未知 command/function/file/input 赋值现在产生 `unknown`，而不是删除 identity。

### 6.2 传播

支持：

- variable；
- alias；
- function parameter；
- function return；
- array；
- object property；
- global capture；
- reassignment kill/gen。

### 6.3 调用

支持：

```powershell
& $variable
& $object.Property
& $array[0]
$variable.Invoke()
```

规则：

- known dangerous -> DANGEROUS；
- known safe -> SAFE；
- unknown -> UNKNOWN；
- variable path 没有任何可信 identity -> UNKNOWN；
- unknown 被 safe ScriptBlock 覆盖 -> SAFE；
- safe 被 unknown 覆盖 -> UNKNOWN。

## 7. 异常与四态语义

```text
SAFE:
完整分析且无危险/未知

DANGEROUS:
确认禁止执行路径

UNKNOWN:
动态值、ScriptBlock identity 或 call target 无法确定

ERROR:
Parser/Structure/Internal/Budget failure
```

保留：

```text
SCRIPT_SCANNER_INTERNAL_ERROR / ERROR
SCRIPT_ANALYSIS_BUDGET_EXHAUSTED / ERROR
```

UNKNOWN 和 ERROR 继续由 Preflight fail closed。

## 8. 对抗测试矩阵

### 8.1 A7.14 P1

| Case | Expected | Actual |
| -- | -- | -- |
| nested computed destructuring | DANGEROUS/UNKNOWN | DANGEROUS |
| unknown command source | UNKNOWN | UNKNOWN |
| unknown file source | UNKNOWN | UNKNOWN |
| unknown external input | UNKNOWN | UNKNOWN |
| unknown function return | UNKNOWN | UNKNOWN |

### 8.2 JavaScript combinations

| Case | Expected | Actual |
| -- | -- | -- |
| multi-level nested computed | DANGEROUS | DANGEROUS |
| safe+danger candidate | DANGEROUS | DANGEROUS |
| default dangerous | DANGEROUS | DANGEROUS |
| all-safe candidates | SAFE | SAFE |
| unknown source | UNKNOWN | UNKNOWN |
| null/primitive nested pattern | UNKNOWN | UNKNOWN |

### 8.3 PowerShell combinations

| Case | Expected | Actual |
| -- | -- | -- |
| unknown alias chain | UNKNOWN | UNKNOWN |
| unknown function return | UNKNOWN | UNKNOWN |
| unknown function parameter | UNKNOWN | UNKNOWN |
| unknown array element | UNKNOWN | UNKNOWN |
| unknown object property | UNKNOWN | UNKNOWN |
| global unknown capture | UNKNOWN | UNKNOWN |
| unknown overwritten by safe ScriptBlock | SAFE | SAFE |
| known safe ScriptBlock | SAFE | SAFE |
| known dangerous ScriptBlock | DANGEROUS | DANGEROUS |

## 9. 安全负样例

```text
dynamic nested pattern with safe callables: SAFE
known safe ScriptBlock variable: SAFE
unknown identity overwritten by safe ScriptBlock: SAFE
known safe callable in safe object: SAFE
safe output strings: SAFE
```

没有通过把所有动态值升级为 DANGEROUS 来消除漏报。

## 10. Build Preflight

隔离临时 fixture 的真实调用链：

| Input | Result | Builder calls |
| -- | -- | --: |
| DANGEROUS | `BUILD_SOURCE_SECURITY_FAILED` | 0 |
| UNKNOWN | `BUILD_SOURCE_SECURITY_FAILED` | 0 |
| Parser ERROR | `BUILD_SOURCE_SECURITY_FAILED` | 0 |
| Budget ERROR | `BUILD_SOURCE_SECURITY_FAILED` | 0 |
| SAFE | Preflight PASS | 1 |

HEAD 缺失、读取失败、解析失败、inventory failure：

```text
BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE
Builder calls: 0
```

没有创建 Release target，也没有旧 Artifact fallback。

## 11. 历史回归

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

保留：

- A7.8 12 类 P1；
- A7.10 JS/Shell/PowerShell P1/P2；
- A7.11 resource budget；
- A7.12 six P1；
- A7.13 dynamic value/ScriptBlock/EncodedCommand；
- A7.14 two P1；
- A7.3 HEAD completeness / Preflight；
- A4/A6/Manifest/Storage。

未发现 skip、only 或 todo。

### Worker PDF

本轮并发全量运行：

```text
6 files / 19 tests PASS
PDF tests 4.233s / 1.217s / 1.018s
```

未再次触发 5 秒 timeout，无需隔离复跑。

## 12. 性能与预算

三次运行：

```text
Large dynamic object / 500 candidates:
9,017 bytes
40.64 / 18.88 / 13.93 ms
DANGEROUS

JS depth 16:
43.94 / 32.53 / 25.35 ms
BUDGET_EXHAUSTED ERROR

100-level unknown PowerShell chain:
816 bytes
20.96 / 7.33 / 20.67 ms
UNKNOWN

Malformed PowerShell:
17 bytes
0.36 / 0.13 / 0.06 ms
ERROR
```

没有无限递归、超时或预算耗尽后 SAFE。

## 13. TypeScript / Syntax

```text
Web TypeScript: PASS
Worker TypeScript: PASS
file-storage TypeScript: PASS
Build Integrity MJS: 3 files PASS
```

## 14. 真实 Startup

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

## 15. 修改文件

```text
packages/build-integrity/src/script-security.mjs
apps/web/tests/p13-startup-preflight.test.ts
docs/architecture/file-lifecycle-p13-c6-2-l8a7-15-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-15-report.md
docs/architecture/file-lifecycle-p13-implementation-status.md
```

未修改：

- `startup-security.mjs`；
- Build Preflight；
- Web/Worker Startup Gate；
- Prisma Schema；
- Migration；
- Fixture Builder；
- 业务代码；
- 历史 `.next` / Worker `dist`。

## 16. 源码哈希

```text
packages/build-integrity/src/script-security.mjs
45D112E83AE55891C34DD49ADF2A657DFA9348BF2C9B12D24C3D3E3529FDDED7

packages/build-integrity/src/startup-security.mjs
B6F4DC33B50CF755DC74D47B8FC819C40964A9553D44D420DEE1A62AAF137DB4

apps/web/tests/p13-startup-preflight.test.ts
1CC9A16268C9F8C66F926E073A4BEE632052E617D4C29A1C6A0DD804B1582B7F
```

## 17. 受保护文件哈希

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

## 18. 文档哈希

```text
A7.15 Design:
B205CD08130D6E7EED824DD8C3B955CC52928640DFFDB56C4DC06A0FA6DF3B03

Implementation Status:
F62415A33AE50B705F6B7B6A7A229C671F739C8ADAA696EE6EA2512376EBBAD9
```

A7.15 Report SHA-256 在最终交付消息中提供。

## 19. 未解决问题与限制

没有已知 P1/P2。

剩余非阻断边界：

- 有限静态解释器；
- 跨文件 PowerShell function body 不解析；
- 外部二进制和运行时生成内容无法完整证明；
- unknown 保持 fail closed；
- HEAD 安全源码未提交；
- Production Trust Root / ACL / Runtime Identity / Evidence 未验证；
- Legacy Artifact 未处置。

## 20. 工作树

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

## 21. 最终验收字段

```yaml
A7.14 P1-1: PASS
A7.14 P1-2: PASS
Nested Computed Destructuring: PASS
Recursive Candidate Binding: PASS
PowerShell Unknown Invocation: PASS
ScriptBlock Identity Kill/Gen: PASS
SAFE / DANGEROUS / UNKNOWN / ERROR: PASS
UNKNOWN Fail-Closed: PASS
ERROR Fail-Closed: PASS
Build Preflight: PASS
Builder Zero-Call: PASS
Safe Preflight Positive: PASS
A7.8 Known P1: PASS
A7.10-A7.14 Regression: PASS
Resource Budget: PASS
Scanner Crash: NOT FOUND
Scanner Timeout: NOT OBSERVED
A7.3 P1-2 Regression: PASS
A4 Web Security: PASS
A4 Worker Security: PASS
A6 Build Integrity: PASS
Manifest Integrity: PASS
Legacy Artifact Reuse: PASS
Storage Delete Capability: PASS / UNAVAILABLE
Worker Concurrent Test: PASS
Worker Isolated Test: NOT REQUIRED
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

阶段在报告和自审后停止，等待 A7.16/A8 单独授权。
