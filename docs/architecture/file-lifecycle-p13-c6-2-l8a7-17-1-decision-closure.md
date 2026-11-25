# P1-3 C-6.2-L8-A7.17.1 PowerShell Invocation Resolution Design Decision Closure

## 1. 文档信息

- 阶段：`C-6.2-L8-A7.17.1`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- A7.17 原始设计：
  `docs/architecture/file-lifecycle-p13-c6-2-l8a7-17-design.md`
- A7.17 Design SHA-256：
  `CCB1546FD8EC0E2FBF270000EDCC92BD997CE6FF414B481C867E09A4E995FCDA`
- A7.16 Review SHA-256：
  `EDD14B68D965F22A34ACD56AA0DE370A2EE7F5E6F5C8DD41DCE07A61205930CA`
- 当前 Scanner：
  `45D112E83AE55891C34DD49ADF2A657DFA9348BF2C9B12D24C3D3E3529FDDED7`
- 当前测试：
  `1CC9A16268C9F8C66F926E073A4BEE632052E617D4C29A1C6A0DD804B1582B7F`
- Implementation Status：
  `F62415A33AE50B705F6B7B6A7A229C671F739C8ADAA696EE6EA2512376EBBAD9`
- 决策状态：`READY FOR IMPLEMENTATION`

## 2. Skills 使用

已实际读取并应用：

- `$project-architecture`
- `$security-audit`
- `$testing-and-verification`
- `$file-lifecycle`

未调用 `$prisma-db-safety`，本轮不涉及 Schema、Migration、事务、
数据库角色或 ACL。

## 3. 决策摘要

| 决策 | 结果 |
| -- | -- |
| D1 PowerShell Parser 依赖 | 不新增，使用 Node-only Finite Expression Resolver |
| D2 .NET 对象 / Module-qualified command | 不推断，默认 UNKNOWN |
| D3 外部函数 / Module 范围 | 只分析当前文件内可静态定位的函数 |
| D4 Method Allowlist | 严格 allowlist；未知方法 UNKNOWN |
| D5 ScriptBlock 数组/对象传播 | 只支持静态可追踪的 array/hashtable/object |
| 资源预算 | 按文件共享确定性预算，ERROR fail closed |
| Preflight | 不修改，继续消费 Scanner 最终四态 |

本轮没有剩余的“安全方向待决策项”。

## 4. D1：PowerShell Parser 依赖

### 4.1 最终结论

第一版不引入 PowerShell runtime、`pwsh` 子进程、跨语言 parser 包或新的
外部依赖。

采用：

```text
Node-only PowerShell Finite Expression Resolver
```

### 4.2 支持范围

明确支持：

- 单/双引号字符串与常量；
- 普通变量；
- `$global:` / `$script:` / `$local:` scope；
- 括号表达式；
- 数组字面量与 `@(...)`；
- hashtable `@{}`；
- 静态属性访问和已知属性名写入；
- 静态数组索引；
- 当前文件函数调用、参数绑定和 return；
- `[scriptblock]::Create()`；
- `ScriptBlock.GetNewClosure()`；
- `&`；
- `.Invoke()`；
- `Invoke-Command -ScriptBlock`；
- 已定义安全 command allowlist。

### 4.3 不支持范围

以下语法不尝试猜测：

- 任意 .NET 反射；
- 任意 module-qualified command；
- 外部文件或 module 内函数；
- 动态 import/dot-source；
- 动态命令名；
- 动态属性/动态索引无法完全解析；
- `Invoke-Expression` 动态文本；
- 运行时生成 ScriptBlock；
- 未知方法或未知对象 getter/setter。

合法但不在支持范围内的表达式：

```text
UNKNOWN
```

语法损坏：

```text
ERROR
```

未识别表达式绝不能降级为 SAFE。

## 5. D2：.NET 对象与 Module-qualified command

最终结论：

- 不对任意 .NET 对象推断反射或动态方法语义。
- 不因 module/command 名称看起来安全而返回 SAFE。
- 除明确 allowlist 外，module-qualified command 返回 UNKNOWN。
- 未支持的 object method 返回 UNKNOWN。
- 动态属性、reflection 和 type conversion 返回 UNKNOWN。
- 表达式语法坏或解析失败返回 ERROR。

允许的安全判断必须来自：

1. 本设计明确列出的 identity-preserving method；
2. 已冻结安全 command allowlist；
3. 明确非 callable 且无法转换为 ScriptBlock 的静态类型；
4. 已经静态重建为 SAFE ScriptBlock 的表达式。

不得仅凭方法名或 command 名判安全。

## 6. D3：外部函数和 Module 分析范围

最终结论：

第一版只分析当前正在扫描文件内可静态识别的 function definition。

以下返回 UNKNOWN：

- 外部文件函数；
- module 导入函数；
- dot-source 函数；
- dynamic import；
- 无法定位定义的函数；
- 动态 command；
- 参数绑定不完整；
- 返回值不可确定。

### 6.1 当前文件函数规则

Function summary 保存：

```text
name
parameters
default values
return expressions
local definitions
```

调用规则：

- 参数按位置和命名绑定；
- 缺少必要参数 -> UNKNOWN；
- 多 return path -> union；
- 递归使用 active-function set；
- 递归深度超限 -> ERROR；
- 未知函数 -> UNKNOWN。

不会通过递归扫描外部 module/file 扩张分析范围。

## 7. D4：Method Allowlist

### 7.1 Identity-preserving methods

第一版允许：

```text
ScriptBlock.GetNewClosure()
  receiver ScriptBlock -> same ScriptBlock abstract value
  receiver UNKNOWN -> UNKNOWN
  receiver non-ScriptBlock -> UNKNOWN
```

### 7.2 Invocation methods

```text
ScriptBlock.Invoke()
```

不是普通安全方法，而是执行入口。

规则：

```text
receivers:
SAFE ScriptBlock       -> SAFE
DANGEROUS ScriptBlock  -> DANGEROUS
UNKNOWN ScriptBlock    -> UNKNOWN
UNKNOWN receiver       -> UNKNOWN
ERROR receiver         -> ERROR
proven non-callable    -> SAFE
```

### 7.3 Invoke-Command

```text
Invoke-Command -ScriptBlock $target
Invoke-Command -ScriptBlock: $target
Invoke-Command $target
```

与 `&`、`.Invoke()` 共用同一个 Invocation Target Resolver。

无法解析参数名称、参数位置、参数值或重复绑定：

```text
UNKNOWN
```

### 7.4 Unknown methods

未列入 allowlist 的方法：

```text
UNKNOWN
```

未知 method chain 不允许回退为 SAFE。

## 8. D5：ScriptBlock 数组和对象传播

### 8.1 支持

- 静态 array literal；
- `@(...)`；
- 静态 hashtable；
- `[pscustomobject]@{}`；
- 已知属性名 set/get；
- 静态 array index；
- nested object/array；
- object alias；
- 属性/元素重新赋值。

### 8.2 动态情况

以下 UNKNOWN：

- 动态 index；
- 动态 property；
- unknown object structure；
- partial array；
- property 可能不存在；
- external .NET object。

### 8.3 Kill/gen

- 属性/元素明确 safe assignment -> kill 旧危险；
- unknown assignment -> 覆盖为 UNKNOWN；
- object/array alias 看到同一 abstract location；
- 多候选 merge 不可丢 danger/unknown。

## 9. Abstract Value 与 Security State

抽象类型和安全状态是两个正交维度。

### 9.1 Abstract Value Kind

```text
SCALAR
SCRIPTBLOCK
COMMAND
OBJECT
ARRAY
FUNCTION
CALLABLE_REF
UNKNOWN
ERROR
```

### 9.2 Security State

```text
SAFE
DANGEROUS
UNKNOWN
ERROR
```

### 9.3 每个 Kind 的信息

#### SCALAR

```text
valueType: string|number|boolean|null
value
securityState
```

#### SCRIPTBLOCK

```text
bodySummary
origin
closureChain
securityState
```

`bodySummary` 只保存静态可分析内容，不执行。

#### COMMAND

```text
commandText
source
securityState
```

#### OBJECT

```text
objectId
properties: Map<string, AbstractValue>
unknownProperties: boolean
securityState
```

#### ARRAY

```text
arrayId
elements: AbstractValue[]
partial: boolean
dynamicElementsUnknown: boolean
securityState
```

#### FUNCTION

```text
definitionNode
parameters
returnSummaries
capturedScope
securityState
```

#### CALLABLE_REF

```text
resolvedTarget: AbstractValue
methodChain
securityState
```

#### UNKNOWN / ERROR

不带 callable identity；security state 分别为 UNKNOWN / ERROR。

### 9.4 Property existence

必须区分：

```text
PRESENT(value)
MISSING
UNKNOWN_PROPERTY
```

- MISSING 按语言语义产生 undefined candidate；
- UNKNOWN_PROPERTY 进入 UNKNOWN；
- 不得把 MISSING 和 UNKNOWN 合并为空或 SAFE。

### 9.5 Merge

候选安全状态 merge：

```text
ERROR > DANGEROUS > UNKNOWN > SAFE
```

每个候选路径先独立解析，再按上述优先级合并。危险或未知路径不会因安全路径
存在而丢失。

### 9.6 Error

ERROR 是 sticky：

- 后续 merge 不得覆盖为 SAFE/UNKNOWN；
- Preflight 必须阻断；
- 不保留可执行的 partial SAFE 结论。

## 10. Variable / Scope

Environment：

```text
Map<ScopedName, AbstractValue[]>
```

支持：

```text
$name
$global:name
$script:name
$local:name
$object.property
$array[index]
```

解析顺序：

```text
local -> script -> global
```

无法确认的 scope：

```text
UNKNOWN
```

Variable assignment：

- 覆盖是 kill/gen；
- safe overwrite 清除旧 danger/unknown；
- unknown overwrite 覆盖旧 safe；
- multi-branch assignment 使用 union。

## 11. Object / Array 传播

### 11.1 Property

```text
read exact property -> value or MISSING
write exact property -> update Map
dynamic property -> union all + unknownProperties
```

### 11.2 Array

```text
static index -> exact candidate
dynamic index -> union all + partial
out of bounds -> undefined
unknown receiver -> UNKNOWN
```

### 11.3 Cycles

Object/array graph 使用：

```text
seen objectId
active objectId set
```

循环引用：

- 不无限展开；
- 立即返回保守 UNKNOWN；
- 预算耗尽可返回 ERROR。

## 12. Function 传播

Function return 结果：

- 每个 return expression 独立 resolve；
- 最终 union；
- 多分支 SAFE + DANGEROUS -> DANGEROUS；
- SAFE + UNKNOWN -> UNKNOWN；
- 无 return -> undefined/non-callable candidate；
- 函数返回 object/array -> 保留完整 abstract structure。

函数参数：

- 参数别名；
- 默认值；
- 缺失/额外参数；
- 递归 active set；
- 深度预算。

## 13. Method Chain

Resolver 逐个处理：

```text
receiver -> method -> return abstract value -> next method
```

允许 chain：

```powershell
$script.GetNewClosure().Invoke()
$obj.nested.target.GetNewClosure().Invoke()
(Get-Target).Invoke()
```

未知 method：

```text
UNKNOWN
```

超过 method chain 深度：

```text
ERROR
```

## 14. Invocation Target Resolver

统一输入：

```text
& expression
expression.Invoke()
Invoke-Command -ScriptBlock expression
```

统一流程：

```text
parse receiver expression
-> resolve abstract value
-> validate callable
-> classify security state
-> emit finding
```

规则：

| Resolved value | Result |
| -- | -- |
| SAFE ScriptBlock | SAFE |
| NEXT_START ScriptBlock | DANGEROUS |
| WORKER_DIST ScriptBlock | DANGEROUS |
| UNKNOWN ScriptBlock | UNKNOWN |
| unknown object/method | UNKNOWN |
| proven non-callable | SAFE |
| ERROR | ERROR |

## 15. Command Allowlist

第一版只允许经过现有历史测试确认的静态安全 command：

```text
Write-Host
Write-Output
Write-Error
```

其他 command/command string：

```text
UNKNOWN
```

若 command 文本明确包含禁止启动入口：

```text
DANGEROUS
```

Command allowlist 不得由“名称看起来安全”自动扩展。

## 16. 外部函数和 Module 边界

默认 deny-by-uncertainty：

- external function -> UNKNOWN；
- module-qualified command -> UNKNOWN；
- dot-source -> UNKNOWN；
- dynamic module import -> UNKNOWN；
- reflection -> UNKNOWN；
- unknown method -> UNKNOWN；
- dynamic property/index -> UNKNOWN；
- unresolved parameter binding -> UNKNOWN。

## 17. 资源预算

### 17.1 正式预算

```text
maxExpressionDepth:       32
maxPropertyChainDepth:    32
maxMethodChainDepth:      16
maxAliases:               2,000
maxObjectProperties:      2,000
maxFunctionDepth:         16
maxAbstractStates:        50,000
maxMilliseconds:          1,500
```

### 17.2 计数范围

- 每个被扫描 PowerShell 文件建立一份 Analysis Budget；
- 所有 expression/function/method/object 解析共享该预算；
- nested resolver 不创建可重置的新预算；
- 每个 function invocation 共享文件预算，只另有 call-stack depth；
- encoded command 解码后的递归扫描共享同一父预算或明确派生预算，不得
  通过重复 encoded layer 重置；
- 缓存命中也计入一次 lookup/state，不恢复已消耗预算；
- 多次别名解析计入预算。

### 17.3 边界

- 达到上限允许当前操作完成；
- 下一次需要增量时超过上限 -> ERROR；
- depth `> max` -> ERROR；
- object properties `> max` -> ERROR；
- time checked at deterministic resolver checkpoints；
- ERROR sticky，不能产生 SAFE。

### 17.4 缓存

缓存只允许：

- 同一 immutable expression；
- 同一 environment generation；
- 同一 object snapshot；
- 同一 parser version；
- 同一 file digest。

Environment mutation 后 generation 变化，旧缓存不得复用。

### 17.5 输入顺序

确定性计数和 fixed traversal 顺序必须确保候选顺序变化不改变最终 security
state。只有时间预算在硬件边界可能提前 ERROR，但绝不能把超时变成 SAFE。

## 18. 四态与异常

```text
SAFE
证据完整，且未发现危险或未知执行路径

DANGEROUS
明确进入 next start / Worker dist / 等价禁止入口

UNKNOWN
来源、receiver、method、parameter 或 object state 无法确定

ERROR
Parser、结构、内部异常、循环/复杂度或预算失败
```

异常处理：

- caught internal exception -> ERROR；
- 不允许 catch -> empty findings；
- 不允许 catch -> SAFE；
- Preflight 对 UNKNOWN/ERROR fail closed。

## 19. Build Preflight

Preflight 不增加第二套 PowerShell Scanner。

保持不变：

```text
Scanner DANGEROUS -> worktree FAIL -> builder 0
Scanner UNKNOWN   -> worktree FAIL -> builder 0
Scanner ERROR     -> worktree FAIL -> builder 0
Scanner SAFE      -> worktree PASS -> builder 1
HEAD incomplete   -> BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE -> builder 0
```

Worktree Gate 负责当前源代码语义；HEAD Gate 负责提交基线的完整性和旧入口
差异。两者不能互相替代。

## 20. A7.18 测试矩阵

### 20.1 Invocation resolution

| ID | Input | Expected abstract | State | Preflight |
| -- | -- | -- | -- | -- |
| PS-IR-01 | `$obj.target.Invoke()` danger | ScriptBlock danger | DANGEROUS | builder 0 |
| PS-IR-02 | `$obj.target.Invoke()` unknown | ScriptBlock unknown | UNKNOWN | builder 0 |
| PS-IR-03 | `$global:script.Invoke()` danger | ScriptBlock danger | DANGEROUS | builder 0 |
| PS-IR-04 | `(Get-Target).Invoke()` danger | ScriptBlock danger | DANGEROUS | builder 0 |
| PS-IR-05 | `GetNewClosure().Invoke()` unknown | ScriptBlock unknown | UNKNOWN | builder 0 |
| PS-IR-06 | `Invoke-Command -ScriptBlock` danger | ScriptBlock danger | DANGEROUS | builder 0 |
| PS-IR-07 | `Invoke-Command -ScriptBlock` unknown | ScriptBlock unknown | UNKNOWN | builder 0 |
| PS-IR-08 | known safe ScriptBlock | ScriptBlock safe | SAFE | builder 1 |

### 20.2 Object / scope

| ID | Case | Expected |
| -- | -- | -- |
| PS-OBJ-01 | nested hashtable danger | DANGEROUS |
| PS-OBJ-02 | nested hashtable unknown | UNKNOWN |
| PS-OBJ-03 | object property reassigned safe | SAFE |
| PS-OBJ-04 | object property overwritten unknown | UNKNOWN |
| PS-SCP-01 | global danger | DANGEROUS |
| PS-SCP-02 | script/local danger | DANGEROUS |

### 20.3 Function

| ID | Case | Expected |
| -- | -- | -- |
| PS-FN-01 | function parameter danger | DANGEROUS |
| PS-FN-02 | function parameter unknown | UNKNOWN |
| PS-FN-03 | multiple return safe+danger | DANGEROUS |
| PS-FN-04 | multiple return safe+unknown | UNKNOWN |
| PS-FN-05 | return stored in object then Invoke | identity mode |
| PS-FN-06 | external/module function | UNKNOWN |

### 20.4 Method

| ID | Case | Expected |
| -- | -- | -- |
| PS-M-01 | GetNewClosure safe chain | SAFE |
| PS-M-02 | GetNewClosure danger chain | DANGEROUS |
| PS-M-03 | GetNewClosure unknown chain | UNKNOWN |
| PS-M-04 | unknown .NET method | UNKNOWN |
| PS-M-05 | method chain depth exceeded | ERROR |

### 20.5 Mixed / resource

| ID | Case | Expected |
| -- | -- | -- |
| PS-MIX-01 | SAFE+DANGEROUS | DANGEROUS |
| PS-MIX-02 | SAFE+UNKNOWN | UNKNOWN |
| PS-MIX-03 | UNKNOWN+DANGEROUS | DANGEROUS |
| PS-MIX-04 | all SAFE | SAFE |
| PS-RES-01 | deep property path | ERROR at exceeded depth |
| PS-RES-02 | deep method chain | ERROR at exceeded depth |
| PS-RES-03 | cyclic object refs | UNKNOWN/ERROR |
| PS-RES-04 | large object/array | deterministic state or ERROR |

### 20.6 Historical

- A7.14 two original P1；
- A7.15 nested/unknown original；
- A7.16 dotted/global/function/Invoke-Command；
- A7.8-A7.15 all existing samples；
- JS/Shell/CMD scans；
- encoded commands；
- Preflight/HEAD；
- A4/A6/Manifest/Storage。

## 21. Implementation file scope

A7.18 预计允许：

```text
packages/build-integrity/src/script-security.mjs
apps/web/tests/p13-startup-preflight.test.ts
docs/architecture/file-lifecycle-p13-c6-2-l8a7-18-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-18-report.md
docs/architecture/file-lifecycle-p13-implementation-status.md
```

不得修改 Preflight、Startup Gate、Schema、Migration、Storage 或业务代码，
除非 A7.18 另行获得明确授权。

## 22. A7.18 实施顺序

1. Abstract Value 与 kind/security 正交模型；
2. Scope environment；
3. Object/array location resolver；
4. Function parameter/return resolver；
5. Method allowlist；
6. Invocation Target Resolver；
7. Resource budget/caching；
8. 新测试；
9. 历史回归；
10. Preflight fixture；
11. 自审与文档。

任何阶段出现未解决 P1/P2，停止进入下一阶段。

## 23. 未解决问题

### 阻塞实施

无。

### 非阻塞但必须记录

- PowerShell 官方 parser 不在第一版；
- cross-file/module function 不分析；
- unknown method 会产生更多 UNKNOWN；
- object getter/setter 和 .NET reflection 不支持；
- 时间预算在极慢环境可能更早 ERROR，但绝不允许 SAFE。

这些均通过 deny-by-uncertainty 和 Preflight fail-closed 处理，不改变产品架构。

## 24. 最终结论

```text
C-6.2-L8-A7.17.1:
READY FOR IMPLEMENTATION

A7.17 open decisions:
CLOSED

Preflight change:
NOT REQUIRED

Implementation scope:
SCANNER + TESTS + A7.18 DOCS

Source Modification:
NOT EXECUTED

Git Write:
NOT EXECUTED

Next Phase:
NOT AUTHORIZED
```
