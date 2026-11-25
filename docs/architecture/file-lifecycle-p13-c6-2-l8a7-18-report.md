# P1-3 C-6.2-L8-A7.18 PowerShell Finite Semantic Resolver Report

## 1. 最终结论

- 阶段：`C-6.2-L8-A7.18`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 实现与安全测试结论：`PASS`
- Protected File Integrity：`FAIL`
- 阶段总体结论：`FAIL`
- 独立审查：`A7.19 NOT AUTHORIZED`
- Commit Authorization：`NOT GRANTED`
- Next Phase：`NOT AUTHORIZED`

A7.16 三组 PowerShell invocation false-negative 已在本工作树修复。语义完整
路径不再把危险 `.Invoke()`、scope-qualified variable、function result、
method chain 或 `Invoke-Command` target 判为 SAFE；危险、未知和错误均使
Build Preflight 阻断 Builder。

阶段总体 FAIL 的唯一原因是：执行 TypeScript incremental 检查刷新了受保护
的 `apps/web/tsconfig.tsbuildinfo`，且原缓存无法从 Git、编辑器历史或当前
源码确定性重建。该缓存不是源码安全回归，但违反本阶段“不得修改受保护
文件”的完成标准，因此不报告 PASS。

本结论只覆盖 A7.18 实现和当前测试，不取代 A7.19 独立对抗审查。

## 2. 基线与工作树

开始和结束时：

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

A7.17.3 最终设计 SHA-256：

```text
552ADE9CB955FDA5A3CE4BD15824EFC01B9F43BE9E196D0CB960EB0C4F13A20E
```

A7.17、A7.17.1、A7.17.2、A7.17.3、A7.16 Review、A7.15 Report 和
Implementation Status 开始哈希均与授权基线一致。

工作树原有未提交修改的源码内容全部保留。本阶段没有 Git 写操作，没有删除、
移动或覆盖历史 `.next`、Worker `dist`、Schema 或 Migration。唯一非预期
副作用是 TypeScript 刷新了受保护的 `apps/web/tsconfig.tsbuildinfo`，详见
第 4 节和最终验收字段。

## 3. Skills

实际加载并应用：

- `$project-architecture`
- `$security-audit`
- `$testing-and-verification`
- `$file-lifecycle`

未调用 `$prisma-db-safety`。

## 4. 修改文件

| 文件 | SHA-256 | 状态 |
| -- | -- | -- |
| `packages/build-integrity/src/script-security.mjs` | `D17C16BF2A1596FED0919E0184B89BE097078E507D9E82AB05F4CDDFBCDF48DF` | 修改 |
| `apps/web/tests/p13-startup-powershell-resolver.test.ts` | `A77D5D8E5C5BDE6321068D21ECC26D440A079B2597AB174322D4CC79364EC0F4` | 新增 |
| `apps/web/tests/p13-startup-preflight.test.ts` | `1CC9A16268C9F8C66F926E073A4BEE632052E617D4C29A1C6A0DD804B1582B7F` | 未修改 |
| `packages/build-integrity/src/startup-security.mjs` | `B6F4DC33B50CF755DC74D47B8FC819C40964A9553D44D420DEE1A62AAF137DB4` | 未修改 |
| `docs/architecture/file-lifecycle-p13-c6-2-l8a7-18-design.md` | `BE3D76AC22CE55A3EC36CD16E4AA912047ED0E0DBF8C1F407CEAAB95740BA4A9` | 新增 |
| `apps/web/tsconfig.tsbuildinfo` | `21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520` | 非授权刷新 |

Implementation Status 在本报告完成后更新，最终哈希见交付消息。

`apps/web/tsconfig.tsbuildinfo` 初始哈希：

```text
018C24B24976726C8837E6C70B57DA982DAE635E98C62BC721F3F63AEF7FF777
```

当前哈希：

```text
21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520
```

已尝试排除本轮新增测试并重建缓存，但结果不等于原哈希。临时配置与临时缓存
已删除，`apps/web/tsconfig.json` 已恢复为无 Git 差异状态。

## 5. A7.16 P1 基线

修改前，以下样例通过 `scanAuxiliaryScript()` 均没有 finding：

```text
$obj.target.Invoke()
$global:script.Invoke()
(Get-Target).Invoke()
unknown dotted Invoke
unknown GetNewClosure().Invoke()
unknown Invoke-Command -ScriptBlock
```

安全隔离 Preflight Mock：

```text
dangerous dotted Invoke:
result = built
builderCalls = 1
```

这确认 A7.16 false-negative 会穿透旧 Preflight。

## 6. A7.16 P1 修复结果

实施后同一组样例：

| 样例 | Semantic State | Scanner Finding |
| -- | -- | -- |
| dangerous object property `.Invoke()` | `DANGEROUS` | DANGEROUS |
| dangerous global variable `.Invoke()` | `DANGEROUS` | DANGEROUS |
| dangerous function result `.Invoke()` | `DANGEROUS` | DANGEROUS |
| unknown dotted `.Invoke()` | `UNKNOWN` | UNKNOWN |
| unknown `GetNewClosure().Invoke()` | `UNKNOWN` | UNKNOWN |
| unknown `Invoke-Command -ScriptBlock` | `UNKNOWN` | UNKNOWN |

这些样例同时进入 Build Preflight。全部非 SAFE 样例：

```text
Preflight = BUILD_SOURCE_SECURITY_FAILED
Builder calls = 0
```

## 7. 实现架构

### 7.1 Tokenizer 与 Parser

`script-security.mjs` 新增有限 PowerShell tokenizer 和 statement/expression
parser，覆盖 assignment、scope variable、function、return、if/switch/try/loop、
Hashtable、PSCustomObject、Array、property/index/method、Pipeline、
ScriptBlock.Create、call operator、Invoke-Command 和 GetNewClosure。

关键位置：

```text
psSemanticTokenize                    :1927
PowerShellSemanticParser              :2163
```

### 7.2 Abstract Runtime

新增 frame/binding、object/array location、snapshot、branch clone/join、
function table、alias、budget 和 cache：

```text
psCreateRuntime                       :3214
psExecuteIf                           :3733
psWriteAssignmentTarget               :3898
psEvalStaticCall                      :4186
psEvalCommand                         :4300
psEvalMethod                          :4561
psInvokeValues                        :4615
```

Security merge 固定为：

```text
ERROR > DANGEROUS > UNKNOWN > SAFE
```

### 7.3 Invocation Resolver

`& expression`、`.Invoke()` 和 `Invoke-Command -ScriptBlock` 统一进入
`psInvokeValues()`。Resolver 处理 variable、property/index、function result、
method chain、Closure、object/array alias、branch union、scalar command 和
Unknown/Error。

### 7.4 ScriptBlock 与 Closure

- ScriptBlock.Create 的有限字符串候选逐个进入同内容 Scanner；
- 危险 body 只有在 invocation 时产生执行 finding；
- GetNewClosure 在创建时捕获 scalar/ScriptBlock/ObjectRef/ArrayRef；
- 外部 variable 重绑定不改变 capture；
- captured object/array 后续 mutation 可见。

### 7.5 Semantic/Legacy 集成

生产入口：

```text
scanPowerShell                        :4907
scanPowerShellLegacy                  :4946
```

语义完整时只使用 semantic findings。语义不完整时运行 legacy Scanner 并合并
结果；legacy fallback 只能增加阻断，不能把 DANGEROUS/UNKNOWN/ERROR 降为
SAFE。Preflight 和 `startup-security.mjs` 未修改。

## 8. A7.17.3 专项矩阵

新增：

```text
apps/web/tests/p13-startup-powershell-resolver.test.ts
```

结果：

```text
Test Files: 1 passed
Tests: 54 passed
Skipped/Only/Todo: none
Duration: 4.92s
```

54 项由 A7.17.3 的 48 项矩阵加 A7.16 六个历史对抗样例组成。

分组结果：

| 组 | Cases | Result |
| -- | --: | -- |
| FO-01–FO-08 | 8 | PASS |
| ASN-01–ASN-10 | 10 | PASS |
| SC-01–SC-05 | 5 | PASS |
| SBC-01–SBC-06 | 6 | PASS |
| CL-01–CL-06 | 6 | PASS |
| SN-01–SN-05 | 5 | PASS |
| RES-01–RES-03 | 3 | PASS |
| PRE-01–PRE-05 | 5 | PASS |
| A716-01–A716-06 | 6 | PASS |

每项均验证：

- Abstract Value Kind；
- Security State；
- Invocation Target；
- Preflight 结果；
- Builder 调用次数。

SAFE 对照 Builder 为 1；DANGEROUS、UNKNOWN、ERROR 和 HEAD incomplete 均为 0。

## 9. 历史回归

### 9.1 Preflight 专项

```text
tests/p13-startup-preflight.test.ts
Test Files: 1 passed
Tests: 64 passed
Skipped/Only/Todo: none
Duration: 5.06s
```

覆盖 A7.4–A7.15 已有 PowerShell、Shell、CMD、JavaScript、HEAD symmetry、
Builder zero-call、Manifest/Reparse 和 SAFE positive。

### 9.2 Web

```text
Test Files: 25 passed
Tests: 268 passed
```

完成后恢复运行，覆盖新增 54 项专项测试及原有 Web 安全测试。

### 9.3 Worker

```text
Test Files: 6 passed
Tests: 19 passed
Duration: 6.71s
```

Worker 测试并发全量运行通过。PDF tests：

```text
2.102s / 0.971s / 1.635s
```

未触发 5 秒 timeout，不需要 isolated rerun，也不把 isolated pass 描述为
concurrent pass。

### 9.4 file-storage

```text
Test Files: 2 passed
Tests: 19 passed
```

## 10. TypeScript 与 MJS

全 workspace TypeScript：

```text
pnpm typecheck
web, worker, contracts, file-storage, selection-engine, shared-ui: PASS
```

Build Integrity MJS：

```text
index.mjs: node --check PASS
script-security.mjs: node --check PASS
startup-security.mjs: node --check PASS
```

## 11. Worktree 与 HEAD Startup Audit

只读 `pnpm security:startup`：

```text
worktreeStatus: PASS
worktreeComplete: true
worktreeFindings: 0
worktreeUnknowns: 0
worktreeScriptsEnumerated: 29

headStatus: FAIL
headComplete: false
headScriptsEnumerated: 8
headVsWorktree: DIFFERENT
```

HEAD FAIL 是安全源码尚未提交的预期基线差异，不通过修改 HEAD 或回滚工作树
消除。

Legacy artifact 状态：

```text
apps/web/.next: PRESENT
apps/worker/dist: PRESENT
```

本阶段未移动、删除或执行历史 Artifact。

## 12. 资源与性能

三次只读运行：

```text
50,100 assignment states / 551,099 bytes:
105.53 / 65.06 / 53.92 ms
ERROR / fail closed

16-level unknown property chain:
0.17 / 0.04 / 0.05 ms
UNKNOWN

32-level unknown property chain:
0.12 / 0.06 / 0.05 ms
UNKNOWN

33-level property chain:
0.63 / 0.07 / 0.08 ms
ERROR

malformed ScriptBlock body:
0.45 / 0.41 / 0.06 ms
ERROR
```

结果符合：

- 16/32 level 未提前失败；
- 33 level depth 耗尽为 ERROR；
- 抽象状态耗尽为 ERROR；
- malformed/parser 错误为 ERROR；
- 没有预算耗尽后 SAFE。

## 13. Storage Delete Capability 回归

新增测试最初因 variable dynamic import 被 Storage Delete Audit 判为 unresolved。
测试文件已改为静态、测试专用的 deep import，未修改生产 public package export。

复跑：

```text
tests/p13-storage-delete-audit.test.ts
6 tests PASS
repository storage delete audit: PASS
unresolvedDynamicImports: 0
productionBlockingFindings: 0
```

Web/Worker Storage Delete Capability 保持不可用。

## 14. 剩余 UNKNOWN 边界

- module、dot-source、跨文件 function 和 reflection；
- 非预期 Pipeline transformer；
- 自定义 comparer、PSObject adapter；
- 未完整定点迭代的 loop state；
- Windows PowerShell 5.1 与 PowerShell 7 运行时差异；
- encoded/Here-string 的旧兼容扫描仍由 legacy path 提供；
- protected incremental cache 已刷新且无法恢复原始内容；
- 真实生产 Trust Root、ACL、Runtime Identity 和 Production Evidence 未验证。

上述边界均 fail closed，不对应已验证生产能力。

## 15. 未执行操作

```text
Real Web/Worker Build: NOT EXECUTED
Web/Worker Service Start: NOT EXECUTED
PowerShell Execution: NOT EXECUTED
Database Connection/SQL/Migration: NOT EXECUTED
Real Storage Access/Cleanup/Delete: NOT EXECUTED
ACL/IAM/Service/Task Scheduler Change: NOT EXECUTED
Deployment: NOT EXECUTED
Git Write: NOT EXECUTED
A7.19: NOT AUTHORIZED
```

## 16. 风险与后续建议

主要剩余风险是 finite resolver 与真实 PowerShell 完整 grammar 的差异。当前
通过保守 UNKNOWN、legacy additive fallback 和预算 ERROR 避免 false-negative
降级为 SAFE，但仍必须经过 A7.19 独立对抗审查。

后续建议：

1. 由 A7.19 独立构造新的跨 scope、closure、alias 和 pipeline 组合；
2. 审查测试专用 semantic inspection 是否保持非 public 边界；
3. 完成独立通过后再授予 Git commit；
4. 不把实现测试 PASS 解释为阶段总体 PASS、生产部署或 Trust Root 验证通过。

## 17. 最终验收字段

```yaml
A7.16 P1-1: PASS
A7.16 P1-2: PASS
A7.16 P1-3 Preflight Bypass: PASS
A7.17.3 Matrix: PASS 54/54
FO: PASS
ASN: PASS
SC: PASS
SBC: PASS
CL: PASS
SN: PASS
RES: PASS
PRE: PASS
SAFE Builder Positive: PASS / 1
DANGEROUS Builder Zero: PASS
UNKNOWN Builder Zero: PASS
ERROR Builder Zero: PASS
HEAD Incomplete Builder Zero: PASS
Historical Preflight Tests: PASS 64/64
Web Tests: PASS 268/268
Worker Tests: PASS 19/19
file-storage Tests: PASS 19/19
TypeScript: PASS
MJS Syntax: PASS
Worktree Startup Gate: PASS
HEAD Startup Gate: FAIL / EXPECTED BEFORE COMMIT
Storage Delete Capability: PASS / UNAVAILABLE
Protected File Integrity: FAIL / TSCACHE REFRESHED
Overall Stage Result: FAIL / PROTECTED FILE INTEGRITY
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
