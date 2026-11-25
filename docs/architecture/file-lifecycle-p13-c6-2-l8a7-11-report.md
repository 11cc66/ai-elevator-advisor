# P1-3 C-6.2-L8-A7.11 Cross-Language Abstract Interpretation & Execution Semantics Remediation Report

## 1. 最终结论

- 阶段：`C-6.2-L8-A7.11`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 总体结论：`PASS`
- Commit Authorization：`NOT GRANTED`
- Next Phase：`NOT AUTHORIZED`

A7.10 确认的全部 P1 和两个 P2 已整改。A7.8 十二类已知 P1 继续通过，
A7.10 组合样例、安全负样例、预算耗尽样例和 PowerShell 编码/ScriptBlock
样例全部得到预期 DANGEROUS、UNKNOWN、ERROR 或 SAFE 结果。

最终实际扫描：

```text
Worktree Startup Gate: PASS
HEAD Startup Gate: FAIL / expected before authorized commit
worktreeComplete: true
headComplete: false
worktreeFindings: 0
worktreeUnknowns: 0
worktreeScriptsEnumerated: 29
headScriptsEnumerated: 8
```

## 2. 基线

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

A7.10 Report:
docs/architecture/file-lifecycle-p13-c6-2-l8a7-10-review.md

A7.10 Report SHA-256:
255D95BC7E89CCDD6852382329553498D7A57C40575288DA35CF897F486AB004
```

A7.10 报告哈希与任务基线一致。工作树已有跨阶段未提交修改全部保留。

## 3. 整改前架构分析

### 3.1 JavaScript / TypeScript

既有模型：

- `Map<string, abstract value>` 环境；
- PROCESS / DYNAMIC / OBJECT / FUNCTION / ARRAY / STRING；
- 固定点 alias 收集；
- if 分支环境复制；
- process API、bind、call/apply 和 dynamic body 递归。

缺陷：

- LogicalExpression 和 logical assignment 不产生 potential-source 合并；
- ConditionalExpression 中的 assignment 共用环境；
- ElementAccess/PropertyAccess mutation 不更新状态；
- `.at()` 不进入数组读取语义；
- Reflect.apply 方法本身没有抽象值；
- 深度超过 8 后返回 null，被调用方解释为 SAFE；
- 嵌套数组传播没有共享预算。

### 3.2 Shell

既有模型：

- shell tokenizer；
- wrapper option/value 表；
- shell `-c` payload；
- Here-doc data/execute 模式；
- stdin pipeline。

缺陷：

- `env -S` value 未二次 tokenization；
- `sudo --chdir` 未消耗 value；
- xargs 被统一视为不转发 stdin；
- xargs replacement 进入 shell payload 未分析；
- 不完整 `-c` 未产生 UNKNOWN。

### 3.3 PowerShell

既有模型：

- 逐行 command segmentation；
- 有限变量替换；
- Here-string 提取；
- 内置 alias 表；
- ScriptBlock 非平衡正则；
- 文件 source 的 UNKNOWN 规则。

缺陷：

- 静态变量和 `+` 拼接缺失；
- call operator 变量参数丢失；
- Get-Content → ScriptBlock 多行流缺失；
- 自定义 function / alias provider 上下文缺失；
- encoded command 缺失；
- 语法完整性缺失。

## 4. 新数据流模型

### 4.1 Abstract values

```text
SAFE
STRING / EXECUTABLE_PATH
PROCESS(api)
DYNAMIC(eval|Function)
REFLECT(apply|construct)
OBJECT(properties)
FUNCTION(node, captured)
ARRAY(elements, values, partial, elementsUnknown)
UNKNOWN
```

`partial` 表示部分元素不是静态常量，但 element provenance 仍有效。
`elementsUnknown` 只表示动态写使后续元素内容不可确定。

### 4.2 State merge

- 危险来源优先保留；
- unknown 不会被安全分支覆盖；
- array 按元素位置递归合并；
- object 按属性名递归合并；
- branch 使用深复制环境，避免一个分支的 mutation 污染另一个分支；
- 函数 captured alias 随对象/数组状态克隆。

### 4.3 Mutation

支持：

- identifier overwrite；
- `arr[index] = value`；
- `obj.property = value`；
- `obj[computed] = value`；
- nested `obj.items[0].run = value`；
- destructuring assignment；
- compound assignment。

动态下标写入后，后续元素读取返回 UNKNOWN。

## 5. JavaScript 实现变化

### 5.1 表达式

支持：

```text
LogicalExpression: || / && / ??
ConditionalExpression
Comma / SequenceExpression
AssignmentExpression
Logical assignment: ||= / &&= / ??=
```

任意分支存在 process / dynamic / reflect 来源时，潜在值保留危险来源。

### 5.2 数组与对象

支持：

- 固定和动态索引；
- nested arrays；
- array destructuring；
- object property；
- computed property；
- `.at(index)`；
- mixed object/array state；
- alias mutation；
- function return propagation。

### 5.3 Reflect

`REFLECT(operation)` 支持：

- `Reflect.apply`；
- `Reflect.construct`；
- Reflect namespace alias；
- method alias；
- object destructuring；
- bind chain。

### 5.4 预算

```text
maxAstNodes:       100_000
maxAbstractStates: 100_000
maxDepth:          32
maxMilliseconds:   1_500
```

预算在 AST、process API、dynamic target、alias 和 nested dynamic body 间共享。

```text
Budget exhausted
  -> SCRIPT_ANALYSIS_BUDGET_EXHAUSTED
  -> ERROR
  -> fail closed
```

深度超限返回 UNKNOWN，不返回 SAFE。

## 6. Shell 实现变化

### 6.1 Wrapper

新增：

- `env -S value`；
- `env --split-string=value`；
- value 二次 shell tokenization；
- `sudo -D`；
- `sudo --chdir`；
- sudo long option value 集合。

Wrapper resolver 现在返回扩展后的 token 流，payload 解析不再错误复用未扩展
token 下标。

### 6.2 Here-doc / xargs

xargs 记录 replacement：

```text
xargs -I{}
xargs -I {}
xargs --replace={}
xargs --replace {}
```

如果 replacement 出现在后续 Shell `-c` payload：

```text
Here-doc data -> xargs replacement -> shell code
-> DANGEROUS
```

支持 xargs 后继续经过 command/env/nice 等 Wrapper。

安全数据消费者：

```text
xargs ... printf
xargs ... grep
```

保持 data，不产生无理由 UNKNOWN。

### 6.3 不完整语法

已识别 command flag 但 payload 缺失时：

```text
SCRIPT_UNKNOWN_DYNAMIC_INVOCATION
UNKNOWN
```

## 7. PowerShell 实现变化

### 7.1 静态值

有限 evaluator 支持：

- single/double quoted literal；
- variable；
- `+` 拼接；
- nested parentheses；
- sequential assignment。

`& $cmd $arg` 在变量静态解析为 `& next start` 后产生 DANGEROUS。

未知 `Invoke-Expression` 表达式不默认 SAFE；无法推导时为 UNKNOWN。

### 7.2 ScriptBlock

支持：

- balanced parentheses extraction；
- static body；
- variable body；
- concatenated body；
- call operator；
- `.Invoke()`；
- ScriptBlock variable 后续 Invoke；
- Get-Content/alias source。

只构造、不调用：

```text
SAFE DATA
```

构造后执行：

```text
DANGEROUS / UNKNOWN
```

### 7.3 Function / Alias

自定义 function body 使用平衡花括号提取，支持 nested block。

Function output 进入 `Invoke-Expression` / `iex`：

- known forbidden -> DANGEROUS；
- file/dynamic source -> UNKNOWN；
- 无法证明安全 -> UNKNOWN。

Alias parser 支持：

- Set-Alias；
- New-Alias；
- Set-Item Alias:；
- New-Item Alias:。

### 7.4 Encoded command

支持：

- `-EncodedCommand`；
- `-ec`；
- UTF-16LE；
- UTF-8。

解码后的文本递归进入 Scanner。无效、空、嵌套过深 -> UNKNOWN。

### 7.5 Syntax

检查：

- parentheses；
- braces；
- quote；
- backtick；
- line comment；
- Here-string exclusion。

不完整 -> `SCRIPT_POWERSHELL_SYNTAX_INCOMPLETE / ERROR`。

## 8. A7.10 P1/P2 整改映射

| Finding | Result |
| -- | -- |
| JS `||` / `&&` / `??` | DANGEROUS |
| JS conditional assignment | DANGEROUS |
| JS `||=` / `&&=` / `??=` | DANGEROUS |
| JS array element write | DANGEROUS |
| JS object property write | DANGEROUS |
| JS computed property write | DANGEROUS |
| JS `.at()` | DANGEROUS |
| JS Reflect method alias | DANGEROUS |
| JS Reflect destructuring | DANGEROUS |
| JS dynamic write | UNKNOWN |
| JS depth 9 | DANGEROUS |
| JS depth 12/16 | BUDGET_EXHAUSTED ERROR |
| Shell env -S | DANGEROUS |
| Shell env --split-string | DANGEROUS |
| Shell sudo --chdir | DANGEROUS |
| Here-doc xargs replacement | DANGEROUS |
| Here-doc xargs env wrapper | DANGEROUS |
| Shell incomplete -c | UNKNOWN |
| xargs printf data | SAFE |
| PowerShell static variables | DANGEROUS |
| PowerShell `+` concat | DANGEROUS |
| PowerShell ScriptBlock variable Invoke | DANGEROUS |
| PowerShell Create(Get-Content) | UNKNOWN |
| PowerShell multi-line pipeline | UNKNOWN |
| Custom function -> iex | DANGEROUS / UNKNOWN |
| Alias provider Get-Content | UNKNOWN |
| Alias provider Write-Host | SAFE |
| PowerShell format expression unresolved | UNKNOWN |
| Encoded command | DANGEROUS |
| Safe encoded command | SAFE |
| Incomplete PowerShell | ERROR |

## 9. 完整测试矩阵

### 9.1 JavaScript

| Case | Expected | Actual |
| -- | -- | -- |
| logical OR / nullish | DANGEROUS | DANGEROUS |
| conditional assignment | DANGEROUS | DANGEROUS |
| logical assignment | DANGEROUS | DANGEROUS |
| array write | DANGEROUS | DANGEROUS |
| object write | DANGEROUS | DANGEROUS |
| computed property | DANGEROUS | DANGEROUS |
| nested mixed state | DANGEROUS | DANGEROUS |
| `.at()` | DANGEROUS | DANGEROUS |
| Reflect method alias | DANGEROUS | DANGEROUS |
| Reflect destructuring | DANGEROUS | DANGEROUS |
| dynamic array write | UNKNOWN | UNKNOWN |
| safe logical/mutation/Reflect | SAFE | SAFE |
| depth 9 | DANGEROUS | DANGEROUS |
| depth 12 / 16 | ERROR | ERROR |

### 9.2 Shell

| Case | Expected | Actual |
| -- | -- | -- |
| env -S | DANGEROUS | DANGEROUS |
| env --split-string | DANGEROUS | DANGEROUS |
| sudo --chdir | DANGEROUS | DANGEROUS |
| xargs bash -c '{}' | DANGEROUS | DANGEROUS |
| xargs env -S shell | DANGEROUS | DANGEROUS |
| xargs printf data | SAFE | SAFE |
| grep xargs data | SAFE | SAFE |
| incomplete bash -c | UNKNOWN | UNKNOWN |
| echo wrapper string | SAFE | SAFE |

### 9.3 PowerShell

| Case | Expected | Actual |
| -- | -- | -- |
| static `& $cmd $arg` | DANGEROUS | DANGEROUS |
| `+` concat -> iex | DANGEROUS | DANGEROUS |
| Create concat -> Invoke | DANGEROUS | DANGEROUS |
| Create variable -> Invoke | DANGEROUS | DANGEROUS |
| Get-Content -> Create | UNKNOWN | UNKNOWN |
| multi-line ScriptBlock pipeline | UNKNOWN | UNKNOWN |
| custom function gc -> iex | DANGEROUS / UNKNOWN | DANGEROUS / UNKNOWN |
| Alias:gc -> Get-Content | UNKNOWN | UNKNOWN |
| Alias:gc -> Write-Host | SAFE | SAFE |
| static encoded command | DANGEROUS | DANGEROUS |
| safe encoded command | SAFE | SAFE |
| safe literal iex | SAFE | SAFE |
| Create without Invoke | SAFE | SAFE |
| unresolved format expression | UNKNOWN | UNKNOWN |
| incomplete function | ERROR | ERROR |

### 9.4 CMD/BAT

未修改实现。历史测试继续通过。

## 10. 性能结果

A7.10：

```text
depth 16:
18,520.14 ms
SAFE
```

A7.11 三次运行：

```text
depth 8:
18.85 / 10.43 / 7.14 ms
DANGEROUS

depth 9:
24.85 / 19.07 / 21.94 ms
DANGEROUS

depth 12:
29.32 / 26.49 / 24.81 ms
BUDGET_EXHAUSTED ERROR

depth 16:
22.44 / 21.83 / 20.19 ms
BUDGET_EXHAUSTED ERROR

20,000-element safe array:
108,932 bytes / 127.91 ms / SAFE
```

结果：

- 深度 9 不再静默丢失危险值；
- 深度 12/16 在数十毫秒内 fail closed；
- 没有无限递归、超时或异常；
- 大量安全数据仍可分析。

## 11. 历史回归

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

保留：

- A7.4 JS dynamic execution / alias；
- A7.5 Here-string / Here-doc；
- A7.6 deep alias；
- A7.7 high-order / object / bind；
- A7.8 twelve P1；
- A7.9 assignment/array/Reflect/Wrapper/PowerShell；
- A7.10 adversarial combinations；
- A7.3 HEAD 完整性；
- Builder zero-call；
- Manifest / runtime dependency / reparse。

未发现测试 skip、only 或 todo。

## 12. Build Preflight / Gate 回归

```text
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
```

测试继续覆盖：

- required file missing/read/parse；
- HEAD inventory incomplete；
- worktree security FAIL；
- Manifest / identity fail；
- signing boundary fail；
- existing / reparse target；
- builder failure no success continuation。

## 13. TypeScript / Syntax

```text
Web TypeScript: PASS
Worker TypeScript: PASS
file-storage TypeScript: PASS
Build Integrity MJS: 3 files PASS
```

## 14. 修改文件

```text
packages/build-integrity/src/script-security.mjs
apps/web/tests/p13-startup-preflight.test.ts
docs/architecture/file-lifecycle-p13-c6-2-l8a7-11-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-11-report.md
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

## 15. 源码哈希

```text
packages/build-integrity/src/script-security.mjs
D992A4AAFB844EC79E3A48DAB932D39128680985318ADA6BFE830925A900E604

packages/build-integrity/src/startup-security.mjs
B6F4DC33B50CF755DC74D47B8FC819C40964A9553D44D420DEE1A62AAF137DB4

apps/web/tests/p13-startup-preflight.test.ts
E485571AFD373BBAB9DD8FE7BD31C73F5184E9B930E28D7531327173D080BBFE
```

## 16. 受保护文件哈希

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

## 17. 文档哈希

```text
A7.11 Design:
1DE469E3DF9E317A198928457BEDF4C2A109B5F4A91353931703A138B28A40C2

Implementation Status:
19D4FE9D02A90B4C7BEBB34FA3DB18AB789D4D747C38677244FD8B34ABE87D55
```

A7.11 Report SHA-256 在最终交付消息中提供，以避免自引用改变内容。

## 18. 未解决问题

没有已知 P1。

剩余非阻断边界：

- 静态分析不是完整 JavaScript/Shell/PowerShell 解释器；
- 跨文件高阶函数、运行时生成代码和不可读文件源保持 UNKNOWN；
- PowerShell encoded payload 只支持可解析静态内容；
- 复杂 AST 超过预算时返回 ERROR；
- HEAD 安全源码仍未提交；
- 生产 Trust Root、ACL、Runtime Identity、Deployment Evidence 未验证；
- Legacy `.next` / Worker `dist` 仍存在。

## 19. 工作树状态

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

工作树保留 A4-A7.10 的既有修改、缺失文件和已修改文件，没有恢复、清理或
暂存。本轮新增 A7.11 设计/报告并更新 Implementation Status。

```text
apps/web/.p13-releases: ABSENT
apps/web/.p13-build: ABSENT
```

## 20. 最终验收字段

```yaml
A7.10 P1 Remediation: PASS
A7.10 P2 Remediation: PASS
JavaScript Logical Flow: PASS
JavaScript Assignment Flow: PASS
JavaScript Array/Object State: PASS
JavaScript Reflect Alias: PASS
JavaScript Resource Budget: PASS
Shell Wrapper Semantics: PASS
Shell xargs/Here-doc Data Flow: PASS
Shell Incomplete Syntax: PASS
PowerShell Static Flow: PASS
PowerShell ScriptBlock Flow: PASS
PowerShell Function/Alias Flow: PASS
PowerShell Encoded Command: PASS
PowerShell Syntax Completeness: PASS
CMD/BAT Regression: PASS
A7.8 Known P1: PASS
A7.4-A7.9 Regression: PASS
UNKNOWN Fail-Closed: PASS
Dangerous Path -> SAFE: NOT FOUND
Scanner Crash: NOT FOUND
Scanner Timeout: NOT OBSERVED
A7.3 P1-2 Regression: PASS
Build Preflight: PASS
Builder Zero-Call on Failure: PASS
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

阶段在报告和自审后停止，等待人工审核及 A7.12/A8 单独授权。
