# P1-3 C-6.2-L8-A7.17 PowerShell Invocation Resolution Remediation Design

## 1. 文档信息

- 阶段：`C-6.2-L8-A7.17`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- A7.16 报告：`docs/architecture/file-lifecycle-p13-c6-2-l8a7-16-review.md`
- A7.16 Report SHA-256：
  `EDD14B68D965F22A34ACD56AA0DE370A2EE7F5E6F5C8DD41DCE07A61205930CA`
- 设计状态：`READY FOR REVIEW`
- 本阶段性质：只读分析 + 设计文档，不实施代码修复

## 2. 审查基线

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

Scanner:
45D112E83AE55891C34DD49ADF2A657DFA9348BF2C9B12D24C3D3E3529FDDED7

Test:
1CC9A16268C9F8C66F926E073A4BEE632052E617D4C29A1C6A0DD804B1582B7F

Implementation Status:
F62415A33AE50B705F6B7B6A7A229C671F739C8ADAA696EE6EA2512376EBBAD9
```

全部与任务基线一致。

## 3. Skills 使用

实际读取并应用：

- `$project-architecture`
- `$security-audit`
- `$testing-and-verification`
- `$file-lifecycle`

没有调用 `$prisma-db-safety`，本轮不涉及数据库、Schema、Migration、
事务或 ACL。

## 4. A7.16 三个 P1

### 4.1 P1-1：危险 ScriptBlock 的 dotted/global/function-result `.Invoke()`

漏报输入：

```powershell
$obj = @{
  target = [scriptblock]::Create('next start')
}
$obj.target.Invoke()
```

```powershell
$global:script = [scriptblock]::Create('next start')
$global:script.Invoke()
```

```powershell
function Get-Target {
  return [scriptblock]::Create('next start')
}
(Get-Target).Invoke()
```

实际结果：

```text
SAFE
```

预期：

```text
DANGEROUS
```

### 4.2 P1-2：未知来源 dotted `.Invoke()` 与 Invoke-Command

漏报输入：

```powershell
$obj = @{ target = Get-RemoteScript }
$obj.target.Invoke()
```

```powershell
$script = Get-RemoteScript
$script.GetNewClosure().Invoke()
```

```powershell
$script = Get-RemoteScript
Invoke-Command -ScriptBlock $script
```

实际结果：

```text
SAFE
```

预期：

```text
UNKNOWN
```

### 4.3 P1-3：Build Preflight 绕过

A7.16 使用隔离临时 fixture 得到：

```text
dangerous dotted Invoke -> Preflight PASS / builder 1
unknown dotted Invoke   -> Preflight PASS / builder 1
direct DANGEROUS        -> BUILD_SOURCE_SECURITY_FAILED / builder 0
```

## 5. 因果关系

三个 P1 的因果链：

```text
PowerShell expression resolver 缺失
  -> dotted/global/function-result receiver 身份丢失
  -> invocation resolver 没有可用 target
  -> Scanner 不产生 finding
  -> Worktree status PASS
  -> Preflight 正确消费 PASS
  -> Builder 被调用
```

必须明确区分：

1. Scanner 没识别执行目标：根因。
2. Scanner 把未识别结果视为 SAFE：结果错误。
3. Preflight 是否正确消费 Scanner 结果：是。
4. Preflight 是否存在独立状态降级：本轮没有证据证明存在。

因此修复应位于 Scanner invocation resolution，不应通过修改 Preflight 的
fail-closed 规则绕过。

## 6. 当前 PowerShell 调用解析架构

当前 `scanPowerShell()` 采用逐行文本分析：

1. 提取 Here-string；
2. 静态字符串/变量赋值；
3. 识别内置 alias 和用户 alias；
4. 建立 `scriptBlockVariables` identity Map；
5. 识别 call operator `&`；
6. 识别有限 `.Invoke()` 正则；
7. 识别 ScriptBlock::Create、Invoke-Expression 和 -FilePath；
8. 对每一行执行 command segmentation。

当前 identity 值：

```text
next-start
worker-dist
safe
unknown
```

当前主要缺口：

- identity key 主要来自简单 variable assignment；
- variable name regex 不接受 scope-qualified/global path；
- `.Invoke()` 主要匹配 `$name.Invoke()` 和 `$name[index].Invoke()`；
- object property path 没有 receiver resolver；
- function call expression 和 method chain 没有 expression resolver；
- property/method 的返回身份没有抽象值；
- `Invoke-Command -ScriptBlock` 没有变量 target 分析；
- unknown method 没有统一 UNKNOWN fallback。

## 7. 候选架构比较

### 7.1 方案 A：增加更多正则

为 dotted property、global、function result 分别增加正则。

优点：

- 改动小；
- 不引入新 parser。

缺点：

- receiver 组合数量快速膨胀；
- 方法链和作用域仍易漏报；
- 容易把显示字符串误当执行；
- 无法给出统一 abstract value 和 merge；
- 不满足“不得局部特判”的设计要求。

结论：

```text
REJECT
```

### 7.2 方案 B：完整 PowerShell AST interop

调用 PowerShell 官方 parser 获得完整 AST。

优点：

- 语法覆盖最完整；
- receiver 和 command 参数绑定语义更准确。

缺点：

- 需要启动/调用 PowerShell runtime，或引入新的跨平台 parser；
- 与本轮“不得执行或启动 PowerShell”和现有 Node-only Scanner 边界冲突；
- 增加外部依赖、平台和供应链风险；
- 本轮没有新增依赖授权。

结论：

```text
NOT SELECTED
```

### 7.3 方案 C：有限 PowerShell Expression Resolver

在现有 Node-only Scanner 内增加保守的 expression parser 和 abstract value
resolver。

覆盖：

- variable / scoped variable；
- hashtable/object property；
- array index；
- parenthesized expression；
- function call result；
- known identity-preserving method；
- invocation target extraction；
- named parameter binding for Invoke-Command。

无法解析的 receiver 或 method：

```text
UNKNOWN
```

优点：

- 与现有架构兼容；
- 不需要外部服务、PowerShell runtime 或新依赖；
- 能把 dotted/global/function/method-chain 统一到一个语义模型；
- 可显式限制递归和预算。

缺点：

- 不是完整 PowerShell grammar；
- 仍需保守 UNKNOWN；
- 实际实现量大于局部正则。

结论：

```text
RECOMMENDED
```

## 8. 推荐的抽象值模型

### 8.1 Value kinds

```text
SCALAR          string / number / boolean / null
SCRIPTBLOCK     { mode: safe|dangerous|unknown, origin }
COMMAND         { kind: safe-known|unknown, text }
OBJECT          { properties: Map<string, Value>, unknownProperties }
ARRAY           { elements: Value[], partial }
FUNCTION        { parameters, returns }
CALLABLE_REF    { target: Value, methodChain }
UNKNOWN
ERROR
```

PowerShell identity mode：

```text
SAFE
NEXT_START
WORKER_DIST
UNKNOWN
ERROR
```

### 8.2 Domain merge

多个可能 value 使用 union：

```text
ERROR > DANGEROUS > UNKNOWN > SAFE
```

说明：

- ERROR 优先保持阻断；
- 任一危险候选不能让安全候选覆盖；
- 任一 unknown 候选不能被安全值删除；
- 全安全候选才得到 SAFE。

### 8.3 Value invariants

- 不可识别的 value kind -> UNKNOWN；
- 属性不存在 -> undefined candidate，不自动 SAFE；
- 对 unknown value 的属性读取 -> UNKNOWN；
- Array 越界/动态索引 -> UNKNOWN 或所有 candidate union；
- 方法未知 -> UNKNOWN；
- method chain 超深/预算耗尽 -> ERROR。

## 9. 变量与作用域

### 9.1 Variable keys

统一 normalized key：

```text
$name
$global:name
$script:name
$local:name
$object.property
$array[index]
```

身份传播不能只靠 name 后缀，必须保留 scope component。

### 9.2 Assignment

- `$x = value`：kill/gen；
- `$x += value`：对受支持静态值可合并；
- `$obj.prop = value`：更新 object property；
- `$array[index] = value`：更新 array element；
- 未知属性/动态 index：unknownProperties/partial；
- 明确 safe assignment 可以 kill 旧危险；
- unknown assignment 必须 kill 旧 safe 并写 UNKNOWN。

### 9.3 Scope

第一阶段支持：

- global；
- script；
- local；
- 普通 unqualified variable 解析顺序：

```text
function local -> script -> global
```

如果该顺序无法可靠求解：

```text
UNKNOWN
```

## 10. Object / Array

### 10.1 Hashtable/object

必须表示：

```text
@{ target = value }
[pscustomobject]@{ target = value }
$obj.target = value
```

支持嵌套 object property：

```powershell
$obj = @{
  nested = @{
    target = [scriptblock]::Create('next start')
  }
}
$obj.nested.target.Invoke()
```

读取：

- exact property -> value；
- missing property -> undefined；
- dynamic property -> all properties + unknown；
- nested path -> recursive resolver。

### 10.2 Array

支持：

- literal；
- `@(...)`；
- static index；
- dynamic index -> all elements union；
- nested object/array；
- partial/unknown elements。

## 11. Function Resolution

### 11.1 Function table

记录：

```text
name
parameters
parameter aliases/defaults
return expressions
scope
```

### 11.2 Calls

支持：

- function parameter binding；
- nested function calls；
- multiple return paths；
- return union；
- function result used directly by `.Invoke()` or `&`；
- function result stored in object/array then invoked。

未知函数：

```text
UNKNOWN
```

递归函数：

- active function set；
- depth budget；
- 超限 -> UNKNOWN/ERROR。

## 12. Method Resolution

### 12.1 Known methods

第一阶段只允许明确 identity-preserving 方法：

```text
ScriptBlock.GetNewClosure() -> same ScriptBlock identity
```

可考虑但必须由测试冻结：

```text
[scriptblock]::Create(...)
传入 Safe 字符串 -> SAFE ScriptBlock
传入危险字符串 -> DANGEROUS
传入 unknown -> UNKNOWN
```

### 12.2 `.Invoke()`

规则：

```text
receiver ScriptBlock safe      -> SAFE
receiver ScriptBlock dangerous -> DANGEROUS
receiver ScriptBlock unknown   -> UNKNOWN
receiver UNKNOWN               -> UNKNOWN
receiver non-callable          -> SAFE only if type is statically proven and not
                                  convertible to executable script
unknown receiver/method        -> UNKNOWN
```

### 12.3 Method chains

示例：

```powershell
$script.GetNewClosure().Invoke()
(Get-Target).Invoke()
$obj.target.GetNewClosure().Invoke()
```

链中每一步：

1. resolve receiver：
2. apply method return semantics；
3. 把结果传给下一段；
4. 到达 `.Invoke()` 时按 ScriptBlock identity 判定。

未知方法：

```text
UNKNOWN
```

## 13. Invocation Entrypoints

### 13.1 `&`

统一调用 resolver：

```text
resolveReceiver(expr)
  -> applyInvocation(value)
```

### 13.2 `.Invoke()`

同一个 resolver，不另写关键字黑名单。

### 13.3 Invoke-Command

解析命名参数：

```powershell
Invoke-Command -ScriptBlock $script
Invoke-Command -ScriptBlock: $script
Invoke-Command $script
```

至少支持 A7.16 范围内：

- `-ScriptBlock value`；
- positional ScriptBlock。

参数别名和变量重新赋值必须进入参数绑定 resolver。

未知/不完整参数绑定：

```text
UNKNOWN
```

## 14. 四态语义

### SAFE

- 完整解析；
- receiver 明确为安全 ScriptBlock 或明确非 callable；
- 没有危险/unknown candidate。

### DANGEROUS

- identity 或动态 body 明确进入 next start、Worker dist 或等价禁止入口。

### UNKNOWN

- receiver 来源未知；
- object property 不存在但可能由外部逻辑填充；
- unknown function/method；
- unknown script/file/input；
- 参数绑定不完整；
- 超出支持语法但观察到执行入口。

### ERROR

- PowerShell structure incomplete；
- parser failure；
- internal scanner exception；
- expression/method/function/budget exhaustion。

任何 UNKNOWN/ERROR 必须使 Worktree Gate FAIL。

## 15. Build Preflight 安全边界

Preflight 不需要新增第二套 PowerShell 分析逻辑。

职责：

- Worktree Scanner 将 danger/unknown/error 转成 worktree findings；
- Worktree Gate 必须 FAIL；
- HEAD completeness 独立 fail closed；
- Builder 只在前置检查通过后调用；
- scanner 内部异常只能成为 ERROR；
- 不允许 catch 后返回空 findings。

新增 resolver 后必须验证：

| Input | Builder calls |
| -- | --: |
| dangerous dotted `.Invoke()` | 0 |
| unknown dotted `.Invoke()` | 0 |
| dangerous `Invoke-Command -ScriptBlock` | 0 |
| parser/budget ERROR | 0 |
| safe ScriptBlock | 1 |
| HEAD incomplete | 0 |

## 16. 测试矩阵

### 16.1 Object / Scope

| Case | Expected |
| -- | -- |
| nested hashtable dangerous | DANGEROUS |
| nested hashtable unknown | UNKNOWN |
| global dangerous | DANGEROUS |
| script/local dangerous | DANGEROUS |
| property reassigned safe | SAFE |
| property unknown overwrites safe | UNKNOWN |

### 16.2 Function

| Case | Expected |
| -- | -- |
| function returns dangerous ScriptBlock | DANGEROUS |
| function returns unknown | UNKNOWN |
| function parameter dangerous | DANGEROUS |
| parameter unknown | UNKNOWN |
| multiple returns union | DANGEROUS/UNKNOWN |
| return stored in object then invoked | DANGEROUS |

### 16.3 Method chain

| Case | Expected |
| -- | -- |
| `$script.Invoke()` | identity mode |
| `$obj.target.Invoke()` | identity mode |
| `$obj.target.GetNewClosure().Invoke()` | identity mode |
| `(Get-Target).Invoke()` | identity mode |
| unknown method chain | UNKNOWN |
| safe chain | SAFE |

### 16.4 Invocation

| Case | Expected |
| -- | -- |
| `& $variable` | identity mode |
| `& $object.property` | identity mode |
| `& $array[0]` | identity mode |
| `Invoke-Command -ScriptBlock $script` | identity mode |
| parameter alias | identity mode |

### 16.5 Mixed identity

| Candidate set | Expected |
| -- | -- |
| SAFE + DANGEROUS | DANGEROUS |
| SAFE + UNKNOWN | UNKNOWN |
| UNKNOWN + DANGEROUS | DANGEROUS |
| all SAFE | SAFE |
| order reversed | same result |

### 16.6 Resource

- deep property path；
- deep method chain；
- large object；
- large array；
- cyclic object aliases；
- many aliases；
- recursive functions；
- budget exhaustion。

预期：

```text
normal input -> deterministic state
budget exceeded -> ERROR
cycle exceeded -> UNKNOWN/ERROR
never SAFE
```

## 17. 性能预算设计

建议使用独立 PowerShell analysis budget：

```text
maxExpressionDepth: 32
maxPropertyChainDepth: 32
maxMethodChainDepth: 16
maxAliases: 2,000
maxObjectProperties: 2,000
maxFunctionDepth: 16
maxAbstractStates: 50,000
maxMilliseconds: 1,500
```

共享预算：

- expression resolver；
- object/array property；
- function parameter/return；
- method chain；
- recursive call。

耗尽：

```text
SCRIPT_ANALYSIS_BUDGET_EXHAUSTED / ERROR
```

如果有语法但无法完整解析：

```text
SCRIPT_UNKNOWN_DYNAMIC_INVOCATION / UNKNOWN
```

## 18. 兼容性

必须保留：

- A7.13 strict EncodedCommand；
- A7.15 unknown `& $variable`；
- existing safe ScriptBlock；
- existing dangerous ScriptBlock；
- custom function/alias；
- Here-string；
- parameter/return identity；
- JS/Shell/CMD scanners 不变。

迁移策略：

1. 先建立新 abstract value 与 resolver 单元；
2. 接管 PowerShell `.Invoke()` 和 `&`；
3. 接管 Invoke-Command；
4. 回归 A7.15/A7.16；
5. 运行 A7.8-A7.16 全历史矩阵；
6. 只有在没有 P1/P2 后再进入独立审查。

## 19. 修改文件白名单

后续实施阶段仅允许：

```text
packages/build-integrity/src/script-security.mjs
apps/web/tests/p13-startup-preflight.test.ts
本次必要的 Scanner 专项测试文件
docs/architecture/file-lifecycle-p13-c6-2-l8a7-18-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-18-report.md
docs/architecture/file-lifecycle-p13-implementation-status.md
```

本轮 A7.17 只允许新增本文档。

## 20. 实施顺序

1. Value/union merge；
2. Variable/scope resolver；
3. Object/array property resolver；
4. Function parameter/return resolver；
5. Method chain resolver；
6. Invocation adapter：
   - `&`
   - `.Invoke()`
   - `Invoke-Command -ScriptBlock`
7. Resource budget；
8. Negative safe cases；
9. Preflight temporary fixture；
10. Historical regression；
11. Internal adversarial self-review。

每一步失败都不得进入下一步。

## 21. 风险和未解决问题

### 已明确风险

- PowerShell method semantics 很大；
- 只允许 identity-preserving 方法会漏掉部分 PowerShell 表达式；
- 只支持第一阶段方法链可能导致 UNKNOWN 增多；
- Cross-file functions 不在解析范围；
- Scope resolution 可能与真实 PowerShell 动态作用域不同；
- Object property getter/setter 行为无法完整解释。

### NEEDS DECISION

- 是否允许引入 PowerShell parser 作为新依赖；
- 是否支持 `[pscustomobject]` 之外的 .NET object；
- 是否允许读取静态同文件外部 PowerShell module/function；
- 是否支持 module-qualified commands；
- 是否支持 `ScriptBlock` 数组/对象作为合法构建输入；
- 是否将未知方法统一 UNKNOWN，还是维护小规模方法 allowlist。

### 明确禁止外推

- 当前 A7.17 不是修复完成；
- 不能提交；
- 不能进入 A8；
- 不能把设计文档视为 Scanner PASS；
- 不能以 Preflight 代码未变推断 Scanner 安全。

## 22. 实施门禁

```text
A7.16 P1:
DESIGNED / NOT IMPLEMENTED

A7.17 Design:
READY FOR REVIEW

Source Modification:
NOT AUTHORIZED

Git Write:
NOT EXECUTED

Next Phase:
NOT AUTHORIZED
```
