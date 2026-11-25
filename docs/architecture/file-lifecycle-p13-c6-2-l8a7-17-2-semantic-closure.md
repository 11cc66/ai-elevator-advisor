# P1-3 C-6.2-L8-A7.17.2 PowerShell Semantic Completeness Closure

## 1. 文档信息

- 阶段：`C-6.2-L8-A7.17.2`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 本阶段性质：只读分析 + 单份设计补充文档
- 实施状态：`NOT IMPLEMENTED`
- Git 写操作：`NOT EXECUTED`
- Next Phase：`NOT AUTHORIZED`

本文件补齐 A7.17/A7.17.1 仍未闭合的 PowerShell 语言语义。A7.18 实施前，
以下决策优先于 A7.17.1 中较窄的规则，尤其是
`local -> script -> global` 的单一路径作用域解释。

## 2. 基线与哈希

| 对象 | 路径或 revision | SHA-256 / revision |
| -- | -- | -- |
| Git HEAD | repository | `b224388bc6160eb4a66ad8db7cecd4d23aa75fb8` |
| A7.17 Design | `docs/architecture/file-lifecycle-p13-c6-2-l8a7-17-design.md` | `CCB1546FD8EC0E2FBF270000EDCC92BD997CE6FF414B481C867E09A4E995FCDA` |
| A7.17.1 Decision Closure | `docs/architecture/file-lifecycle-p13-c6-2-l8a7-17-1-decision-closure.md` | `9BECFAF75D6B141E019010FA24A9F9CEA7429EC17EEDDE0D3DB27F2A1C7AFB49` |
| A7.16 Review | `docs/architecture/file-lifecycle-p13-c6-2-l8a7-16-review.md` | `EDD14B68D965F22A34ACD56AA0DE370A2EE7F5E6F5C8DD41DCE07A61205930CA` |
| A7.15 Report | `docs/architecture/file-lifecycle-p13-c6-2-l8a7-15-report.md` | `A3FEAA951931F85C4A362BDE4E40276A26FAB38A383C4FD70E8A41485A580DD7` |
| Implementation Status | `docs/architecture/file-lifecycle-p13-implementation-status.md` | `F62415A33AE50B705F6B7B6A7A229C671F739C8ADAA696EE6EA2512376EBBAD9` |
| PowerShell Scanner | `packages/build-integrity/src/script-security.mjs` | `45D112E83AE55891C34DD49ADF2A657DFA9348BF2C9B12D24C3D3E3529FDDED7` |
| Preflight Test | `apps/web/tests/p13-startup-preflight.test.ts` | `1CC9A16268C9F8C66F926E073A4BEE632052E617D4C29A1C6A0DD804B1582B7F` |
| Startup/Preflight Orchestrator | `packages/build-integrity/src/startup-security.mjs` | `B6F4DC33B50CF755DC74D47B8FC819C40964A9553D44D420DEE1A62AAF137DB4` |

上述哈希与用户给定基线一致。工作树中原有未提交修改全部保留，本阶段没有
读取 `.env`、`.env.test`、秘密配置或用户文件正文。

## 3. Skills 与安全边界

实际读取并应用：

- `$project-architecture`
- `$security-audit`
- `$testing-and-verification`
- `$file-lifecycle`

未调用 `$prisma-db-safety`，本阶段不涉及 Schema、Migration、SQL、事务或
数据库角色。

本阶段只新增本文档。没有修改源码、测试、Implementation Status、历史报告、
构建产物、权限、服务、任务计划或 Git 状态；没有执行 PowerShell、Build、
数据库或 Storage 操作。

## 4. 当前实现事实与缺口

当前 PowerShell Scanner 以行和正则为主，并包含有限字符串展开：

- `extractPowerShellFunctionBodies()` 只保存函数原始 body，没有语句级成功输出
  流摘要，见 `packages/build-integrity/src/script-security.mjs:1775`。
- `scriptBlockModeFromText()` 对整个函数 body 递归寻找 ScriptBlock/Create
  模式，未区分 `return`、普通表达式、赋值、输出重定向和空输出，见同文件
  `:2024`。
- 每个 PowerShell 行分别维护 `scriptBlockVariables`，没有调用敏感的 scope
  frame、caller chain、函数输出序列或对象 location，见同文件 `:2023` 起。
- 名称大多直接转为小写，没有定义折叠冲突、自定义 comparer 或候选合并，见
  同文件 `:2149`。
- `evaluatePowerShellStringExpression()` 只覆盖有限字面量、`+` 拼接和普通
  变量，无法完整重建时返回 `null`，见同文件 `:1609`。
- `[scriptblock]::Create()` 已有平衡括号提取，但输入安全判断仍主要依赖直接
  forbidden-token 检测，尚未统一为递归内容扫描结果，见同文件 `:1651`、
  `:2475`。
- 当前对象/ScriptBlock identity 主要由单一模式 Map 表示，不具备 object
  location、snapshot version、alias mutation 和 branch merge 语义。
- 当前 A7.15 测试覆盖 unknown source、数组、对象和安全覆盖，但没有
  `Get-Target` 成功输出流、动态 caller scope、名称折叠冲突和可变对象快照
  的完整矩阵，见 `apps/web/tests/p13-startup-preflight.test.ts:1905`。

因此，A7.17.1 的 `READY FOR IMPLEMENTATION` 只能作为架构方向，不能直接
视为语义完整。A7.18 必须先落实本文规则，再由独立阶段验证。

## 5. 总体抽象模型

### 5.1 正交维度

抽象类型和安全状态必须分开：

```text
Abstract value kind:
SCALAR
SCRIPTBLOCK
OBJECT_REF
ARRAY_REF
FUNCTION
CALLABLE_REF
EMPTY_SUCCESS_STREAM
UNKNOWN
ERROR

Security state:
SAFE
DANGEROUS
UNKNOWN
ERROR
```

候选状态合并固定为：

```text
ERROR > DANGEROUS > UNKNOWN > SAFE
```

`ERROR` stickiness 不得被后续安全候选覆盖。任何无法完整解释、但可能进入
执行入口的值，不得降级为 `SAFE`。

### 5.2 有限解释器边界

A7.18 继续采用 Node-only finite resolver，不启动 `pwsh`，不引入 PowerShell
runtime。只支持本文定义的 PowerShell 子集；子集外语法沿执行依赖链传播
`UNKNOWN`，语法结构失败传播 `ERROR`。

## 6. D1：PowerShell 函数成功输出流

### 6.1 输出摘要

每个函数和 ScriptBlock 都建立：

```text
SuccessOutputSummary {
  candidates: finite set of abstract values
  complete: boolean
  mayBeEmpty: boolean
  unknownOutput: boolean
}
```

规则：

| 语句形式 | 成功输出 |
| -- | -- |
| `return expression` | expression 的可能结果进入成功流，当前分支终止 |
| `return` | 不增加候选，当前分支以空结果终止 |
| 普通表达式 / 裸变量引用 | 表达式结果进入成功流 |
| `Write-Output expression` | expression 进入成功流 |
| `Write-Host` | 不进入成功流 |
| `Write-Error` | 不进入成功流；其错误流语义不作为启动证据 |
| `$x = expression` / `$null = expression` | 右侧成功输出被捕获，赋值语句本身不输出 |
| `Out-Null` 或明确重定向到文件/null | 被消费的输出不进入函数成功流 |
| `if` / `switch` / `try` / `catch` / loop | 对所有静态或有限可识别分支的 body 输出取并集 |
| 未知 command | 输出语义为 `unknownOutput=true`；函数输出涉及执行入口时为 `UNKNOWN` |
| 仅赋值或仅 `Write-Host` 的函数 | `candidates=∅`、`mayBeEmpty=true`、`complete=true` |

赋值只抑制成功输出，不证明 RHS command 没有其他副作用。RHS 是否安全仍由
command/invocation 分析独立判断。

### 6.2 多输出与分支

- 多分支输出按 `ERROR > DANGEROUS > UNKNOWN > SAFE` 合并。
- 循环体可能执行零次、一次或多次，因此结果保留 `mayBeEmpty=true` 和所有
  body 候选。
- `break`/`continue` 只改变控制流，不隐式产生输出。
- `return` 后续语句在“该分支已返回”的状态下不可达；其他分支仍参与合并。
- 同一路径可能输出多个值时，不得简单把它们当成一个可调用 ScriptBlock。
  若 invocation 语义无法证明，结果为 `UNKNOWN`；只要其中任一可达执行路径
  能输出危险 ScriptBlock，结果至少为 `DANGEROUS`。
- 空成功流是显式值 `EMPTY_SUCCESS_STREAM`，不能当作“没有分析结果”。

### 6.3 调用结果

当函数调用结果作为 `&`、`.Invoke()` 或 `Invoke-Command -ScriptBlock` 的
receiver 时：

1. 解析函数成功输出摘要；
2. 枚举所有可能的调用路径；
3. 对每个候选执行 invocation resolution；
4. 合并最终安全状态。

函数 body 中存在某个危险字面量，但该字面量被明确捕获、重定向或丢弃，且不
进入成功流时，不得仅因文本命中判 `DANGEROUS`。反过来，只有完整证明全部
可达输出不进入执行入口时，才允许 `SAFE`。

### 6.4 强制样例

| 样例 | 成功输出摘要 | 最终状态 |
| -- | -- | -- |
| body 仅 `[scriptblock]::Create('next start')` | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` |
| body 使用 `Write-Output ([scriptblock]::Create('next start'))` | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` |
| body 仅赋值 `$value = [scriptblock]::Create('next start')` | `EMPTY_SUCCESS_STREAM` | 调用目标为 `$null`，`SAFE` |
| 首分支 `return dangerous`，后分支输出 safe | 两候选并集 | 保留危险路径，`DANGEROUS` |

## 7. D2：动态作用域与变量解析

### 7.1 作用域帧

分析环境使用显式调用栈：

```text
ScopeFrame[] = [global, script, functionFrame1, functionFrame2, ... current]
```

函数调用创建新的 current frame。帧保留：

```text
frameId
kind: global | script | function | unknown
callerFrameId
bindings: Map<CanonicalName, AbstractValue>
generation
```

### 7.2 解析规则

| 语法 | 规则 | 不能证明时 |
| -- | -- | -- |
| `$name` read | current local -> nearest caller function frames -> script -> global | `UNKNOWN` |
| `$name` write | 写入 current local frame | `ERROR` 或 `UNKNOWN` |
| `$local:name` | 只查/写 current frame | 当前帧不明确则 `UNKNOWN` |
| `$script:name` | 只查/写当前文件 script frame | script frame 可能被外部 dot-source/预置且未建模则 `UNKNOWN` |
| `$global:name` | 只查/写 process/global frame | 外部环境可能预置且未建模则 `UNKNOWN` |
| `$private:name` 或其他 scope qualifier | 不在首版支持范围 | `UNKNOWN` |

**明确废止** A7.17.1 中“未限定变量只按
`local -> script -> global`”的规则。函数调用者的 parent frame 可能位于
local 与 script 之间，并随调用点变化。

### 7.3 函数调用与 caller

- 当前文件内静态可定位函数，按参数绑定后以实际 caller chain 建立新 frame。
- 同一函数有多个静态 caller 时，分别分析并合并结果。
- 外部 caller、module caller、dot-source 或动态 caller 不可证明时，任何依赖
  该 caller 的未限定变量读取都是 `UNKNOWN`。
- 当前 local 中找不到变量时，不得直接判“不存在”或 `SAFE`。
- 未限定写不修改 parent binding；不得把动态作用域误建模成共享全局变量。

### 7.4 强制样例

```powershell
function Invoke-Target {
    $target.Invoke()
}

function Start-Wrapper {
    $target = [scriptblock]::Create('next start')
    Invoke-Target
}

Start-Wrapper
```

当 `Invoke-Target` 被 `Start-Wrapper` 调用，其未限定 `$target` 沿 caller
frame 解析到危险 ScriptBlock，最终必须为 `DANGEROUS`。

## 8. D3：大小写与名称解析

### 8.1 名称域规则

| 名称域 | 首版规则 |
| -- | -- |
| 变量名 | PowerShell 语义，case-insensitive |
| 字面量 `@{}` Hashtable key | case-insensitive |
| `[pscustomobject]@{}` 属性 | PowerShell member adapter，case-insensitive |
| 函数名 | case-insensitive |
| command / alias 名 | case-insensitive |
| PowerShell 调用的 method 名 | case-insensitive |

内部键使用固定、确定性的 case fold；原始 token、行号和原始拼写必须保留供
报告使用。不得用 JavaScript 的默认大小写敏感 `Map` 直接模拟 PowerShell。

### 8.2 折叠冲突

- canonical key 相同则保留全部候选，不按声明顺序或“最后一个赋值”任意丢弃。
- 冲突候选进入同一 value union，并按安全优先级合并。
- 若冲突影响 invocation target，危险或 unknown 候选不得被 safe 候选覆盖。
- 自定义 StringComparer、自定义 Hashtable 构造、PSObject adapter 差异或动态
  名称定义无法静态证明时，为 `UNKNOWN`。
- 若语言版本差异会改变实际成员解析，分析结果为 `UNKNOWN`，不得假定较新的
  行为。

### 8.3 强制样例

```powershell
$obj = @{
    Target = [scriptblock]::Create('next start')
}

$obj.target.Invoke()
```

`Target` 与 `target` 解析到同一 key，最终必须为 `DANGEROUS`。变量名、函数名
和 `.invoke()` 方法名的大小写变体执行同一规则。

## 9. D4：`ScriptBlock.Create` 内容分析

### 9.1 输入解析

`[scriptblock]::Create(argument)` 的有效输入摘要为有限字符串候选集：

```text
SBC_INPUT = FINITE_STRING_SET | UNKNOWN | ERROR
```

支持：

- 单个静态字符串字面量；
- 完全静态的 `+` 拼接；
- 有限分支产生的静态字符串候选；
- 经静态变量绑定后仍可完整重建的有限候选。

不支持或无法完整重建：

- 环境变量、Read-Host、Get-Content、网络或外部进程输出；
- 无法静态解析的命令输出；
- 部分重建、动态下标、动态格式运算符或未知字符串转换。

### 9.2 内容分类

每个字符串候选都进入现有统一 PowerShell 内容扫描，不执行正文：

| 候选内容结果 | ScriptBlock 抽象结果 |
| -- | -- |
| 完整分析且安全 | `SCRIPTBLOCK(SAFE)` |
| 明确包含 `next start` 或 Worker dist 启动入口 | `SCRIPTBLOCK(DANGEROUS)` |
| 含无法完整分析的动态执行 | `SCRIPTBLOCK(UNKNOWN)` |
| 解析错误、结构错误或内部错误 | `ERROR` |

多个候选合并：

- 全 SAFE -> `SAFE`；
- SAFE + DANGEROUS -> `DANGEROUS`；
- SAFE + UNKNOWN -> `UNKNOWN`；
- 任一 ERROR -> `ERROR`。

创建成功本身不是安全证据。只有该 ScriptBlock 进入执行入口时，才产生相应
运行执行结论；未执行的数据创建可保持 SAFE，但其正文分类仍保留在抽象值中。

## 10. D5：Identity、Alias 与 Snapshot

### 10.1 抽象对象

```text
ScriptBlock {
  scriptBlockId
  bodyDigest
  bodySummary
  securityState
  closureSnapshotId?
}

ObjectRef {
  locationId
  snapshotVersion
}

ArrayRef {
  locationId
  snapshotVersion
}
```

### 10.2 赋值与别名

| 操作 | 语义 |
| -- | -- |
| `$b = $a`，scalar | 复制 scalar value |
| `$b = $a`，ScriptBlock | 复制不可变 ScriptBlock identity |
| `$b = $a`，object/array | `$a`、`$b` 共享同一 locationId |
| `$obj.prop = $x` | 只更新该 object location 的 property binding |
| `$arr[0] = $x` | 只更新该 array location 的 index 0 |
| 变量重新赋值 | 只改变该变量 binding，不修改已存入 object/array 的 ScriptBlock |
| alias 修改 property/element | 对所有引用同一 location 的 alias 可见 |

因此，`$obj.target` 保存的是创建时的 ScriptBlock identity，不是对变量
`$danger` 的持续指针。

### 10.3 控制流快照

每个分支从独立 environment/location snapshot 开始：

1. 分支写入 object property 或 array element；
2. 分支结束时保留其 location snapshot；
3. merge 时按 alias reference 合并所有可达 snapshot；
4. property/element 的候选取并集；
5. 无法证明两分支仍指向同一位置时，生成 relocation/unknown candidate；
6. 任何危险或 unknown snapshot 不得被 safe snapshot 覆盖。

### 10.4 Closure

- `GetNewClosure()` 创建新的 ScriptBlock closure identity，但 body digest 和
  body security summary 保留。
- closure 捕获在调用时形成 snapshot；如果 body 依赖被捕获的变量，而该变量
  或 object location 不能被完整静态确定，invocation 结果为 `UNKNOWN`。
- closure 不扩大对 cross-file/module 或动态 caller scope 的分析权限。
- 已经静态证明的 immutable ScriptBlock body 不因外层变量重新绑定而改变。

### 10.5 强制快照样例

```powershell
$danger = [scriptblock]::Create('next start')
$obj = @{ target = $danger }

$danger = [scriptblock]::Create('Write-Host safe')
$obj.target.Invoke()
```

`$obj.target` 仍保留原危险 ScriptBlock identity，最终必须为 `DANGEROUS`。

## 11. 缓存与预算

缓存键至少包括：

```text
fileDigest
parserVersion
analysisPolicyVersion
expressionNodeId
callContextDigest
environmentGeneration
objectSnapshotVersion[]
argumentAbstractDigest
activeFunctionSetDigest
```

规则：

- environment mutation 后 generation 改变，相关缓存失效；
- object/array mutation 后只复用与当前 snapshot version 一致的缓存；
- caller scope、参数摘要或 active function set 不同不得复用函数结果缓存；
- 缓存命中仍计入一次 lookup/state 成本；
- 缓存不能恢复已消耗预算，也不能重置嵌套 encoded command 或 closure depth；
- 时间预算检查必须在确定性 resolver checkpoint 执行；
- 缓存失效、预算耗尽或内部异常均不得产生 `SAFE`。

继续使用 A7.17.1 预算：

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

超过深度、状态数、对象属性数或时间预算 -> `ERROR`。

## 12. 全局安全不变量

1. 未识别表达式不得返回 `SAFE`。
2. 不完整函数成功输出流不得返回 `SAFE`。
3. 无法确定变量作用域或 caller 不得返回 `SAFE`。
4. 大小写折叠冲突不得选择性丢弃危险候选。
5. 动态、部分重建或未知来源的 ScriptBlock 内容不得返回 `SAFE`。
6. 变量重新赋值不得修改此前保存的独立 ScriptBlock identity。
7. Object/array alias 必须共享正确的 location 与可见 mutation。
8. 分支 merge 不得丢失危险、未知或错误路径。
9. Parser ERROR、内部异常和预算 ERROR 必须阻断。
10. 缓存、重复引用、嵌套调用或 encoded command 不得重置预算。
11. `SAFE` 必须有完整、可验证的静态证据。
12. 不确定情况统一 deny-by-uncertainty。
13. 空成功流与“输出分析不完整”必须明确区分。
14. 创建危险 ScriptBlock 不等于执行；进入 invocation 后才按执行语义阻断。

## 13. Build Preflight 边界

Preflight 架构和 Builder 调用顺序不变：

| Scanner 最终状态 | Worktree Gate | Preflight | Builder calls |
| -- | -- | -- | --: |
| `DANGEROUS` | `FAIL` | `BUILD_SOURCE_SECURITY_FAILED` | 0 |
| `UNKNOWN` | `FAIL` | `BUILD_SOURCE_SECURITY_FAILED` | 0 |
| `ERROR` | `FAIL` | `BUILD_SOURCE_SECURITY_FAILED` | 0 |
| `SAFE` | `PASS` | `PASS` | 1 |
| HEAD audit incomplete | 与 worktree 状态无关 | `BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE` | 0 |

不增加第二套 PowerShell Scanner，不修改 Builder fallback，不允许旧
`.next`/Worker `dist` 作为失败回退。

## 14. 唯一预期测试矩阵

每行只允许一个确定结果。`Preflight FAIL` 均表示
`BUILD_SOURCE_SECURITY_FAILED`；HEAD incomplete 使用单独错误码。

### 14.1 函数成功输出流

```powershell
# FO-01
function Get-Target { [scriptblock]::Create('next start') }
(Get-Target).Invoke()

# FO-02
function Get-Target {
    Write-Output ([scriptblock]::Create('next start'))
}
(Get-Target).Invoke()

# FO-03
function Get-Target {
    $value = [scriptblock]::Create('next start')
}
(Get-Target).Invoke()

# FO-04
function Get-Target {
    if ($true) {
        return [scriptblock]::Create('next start')
    }
    [scriptblock]::Create('Write-Host safe')
}
(Get-Target).Invoke()

# FO-05
function Get-Target { Write-Host 'next start' }
(Get-Target).Invoke()
```

| ID | Abstract value kind | Security state | Invocation target | Preflight | Builder |
| -- | -- | -- | -- | -- | --: |
| FO-01 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | danger ScriptBlock identity | `FAIL` | 0 |
| FO-02 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | danger ScriptBlock identity | `FAIL` | 0 |
| FO-03 | `EMPTY_SUCCESS_STREAM` | `SAFE` | `null` / proven non-callable | `PASS` | 1 |
| FO-04 | `VALUE_UNION(SCRIPTBLOCK(DANGEROUS), SCRIPTBLOCK(SAFE))` | `DANGEROUS` | danger ScriptBlock candidate | `FAIL` | 0 |
| FO-05 | `EMPTY_SUCCESS_STREAM` | `SAFE` | `null` / proven non-callable | `PASS` | 1 |

### 14.2 动态作用域

```powershell
# SC-01: caller/frame lookup
function Invoke-Target { $target.Invoke() }
function Start-Wrapper {
    $target = [scriptblock]::Create('next start')
    Invoke-Target
}
Start-Wrapper

# SC-02: local safe shadow
function Invoke-Target {
    $target = [scriptblock]::Create('Write-Host safe')
    $target.Invoke()
}
function Start-Wrapper {
    $target = [scriptblock]::Create('next start')
    Invoke-Target
}
Start-Wrapper

# SC-03: explicit global
$global:target = [scriptblock]::Create('next start')
$global:target.Invoke()

# SC-04: unknown external caller/global
function Invoke-Target { $target.Invoke() }
Invoke-Target

# SC-05: explicit script
$script:target = [scriptblock]::Create('next start')
$script:target.Invoke()
```

| ID | Abstract value kind | Security state | Invocation target | Preflight | Builder |
| -- | -- | -- | -- | -- | --: |
| SC-01 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | caller-scope danger identity | `FAIL` | 0 |
| SC-02 | `SCRIPTBLOCK(SAFE)` | `SAFE` | local safe identity | `PASS` | 1 |
| SC-03 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | global danger identity | `FAIL` | 0 |
| SC-04 | `UNKNOWN` | `UNKNOWN` | unresolved external caller value | `FAIL` | 0 |
| SC-05 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | script danger identity | `FAIL` | 0 |

### 14.3 大小写与折叠冲突

```powershell
# CASE-01
$obj = @{ Target = [scriptblock]::Create('next start') }
$obj.target.Invoke()

# CASE-02
$target = [scriptblock]::Create('next start')
$TARGET.Invoke()

# CASE-03
function Get-Target { [scriptblock]::Create('next start') }
(get-target).invoke()

# CASE-04: finite object union with differently cased keys
$obj = if ($condition) {
    @{ Target = [scriptblock]::Create('next start') }
} else {
    @{ target = [scriptblock]::Create('Write-Host safe') }
}
$obj.target.Invoke()
```

| ID | Abstract value kind | Security state | Invocation target | Preflight | Builder |
| -- | -- | -- | -- | -- | --: |
| CASE-01 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | folded `target` property | `FAIL` | 0 |
| CASE-02 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | folded variable binding | `FAIL` | 0 |
| CASE-03 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | folded function + method | `FAIL` | 0 |
| CASE-04 | `VALUE_UNION(SCRIPTBLOCK(DANGEROUS), SCRIPTBLOCK(SAFE))` | `DANGEROUS` | folded collision union | `FAIL` | 0 |

### 14.4 `ScriptBlock.Create`

```powershell
# SBC-01
[scriptblock]::Create('Write-Host safe').Invoke()

# SBC-02
[scriptblock]::Create('next start').Invoke()

# SBC-03
[scriptblock]::Create('next ' + 'start').Invoke()

# SBC-04
$body = if ($condition) { 'next start' } else { 'Write-Host safe' }
[scriptblock]::Create($body).Invoke()

# SBC-05
$body = Get-RemoteScript
[scriptblock]::Create($body).Invoke()

# SBC-06
[scriptblock]::Create('function broken {').Invoke()
```

| ID | Abstract value kind | Security state | Invocation target | Preflight | Builder |
| -- | -- | -- | -- | -- | --: |
| SBC-01 | `SCRIPTBLOCK(SAFE)` | `SAFE` | safe ScriptBlock identity | `PASS` | 1 |
| SBC-02 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | danger ScriptBlock identity | `FAIL` | 0 |
| SBC-03 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | reconstructed danger identity | `FAIL` | 0 |
| SBC-04 | `VALUE_UNION(SCRIPTBLOCK(DANGEROUS), SCRIPTBLOCK(SAFE))` | `DANGEROUS` | finite danger candidate | `FAIL` | 0 |
| SBC-05 | `UNKNOWN` | `UNKNOWN` | unresolved ScriptBlock content | `FAIL` | 0 |
| SBC-06 | `ERROR` | `ERROR` | parser-error ScriptBlock | `FAIL` | 0 |

### 14.5 Identity、Alias 与 Snapshot

```powershell
# SN-01: required identity snapshot
$danger = [scriptblock]::Create('next start')
$obj = @{ target = $danger }
$danger = [scriptblock]::Create('Write-Host safe')
$obj.target.Invoke()

# SN-02: object alias mutates shared property
$obj = @{ target = [scriptblock]::Create('next start') }
$alias = $obj
$alias.target = [scriptblock]::Create('Write-Host safe')
$obj.target.Invoke()

# SN-03: overwrite one property only
$obj = @{
    target = [scriptblock]::Create('next start')
    other = 'unchanged'
}
$obj.other = 'updated'
$obj.target.Invoke()

# SN-04: overwrite one array element only
$items = @(
    [scriptblock]::Create('next start'),
    [scriptblock]::Create('Write-Host safe')
)
$items[1] = [scriptblock]::Create('Write-Host updated')
$items[0].Invoke()

# SN-05: branch merge retains danger
$items = @([scriptblock]::Create('Write-Host safe'))
if ($condition) {
    $items[0] = [scriptblock]::Create('next start')
}
$items[0].Invoke()
```

| ID | Abstract value kind | Security state | Invocation target | Preflight | Builder |
| -- | -- | -- | -- | -- | --: |
| SN-01 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | original property identity | `FAIL` | 0 |
| SN-02 | `SCRIPTBLOCK(SAFE)` | `SAFE` | shared property after alias mutation | `PASS` | 1 |
| SN-03 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | unchanged `target` property | `FAIL` | 0 |
| SN-04 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | array index 0 | `FAIL` | 0 |
| SN-05 | `VALUE_UNION(SCRIPTBLOCK(DANGEROUS), SCRIPTBLOCK(SAFE))` | `DANGEROUS` | merged array index 0 | `FAIL` | 0 |

### 14.6 预算、Parser 与 Preflight

| ID | Abstract value kind | Security state | Invocation target | Preflight | Builder |
| -- | -- | -- | -- | -- | --: |
| RES-01: property chain depth 33 | `ERROR` | `ERROR` | analysis budget exhausted | `FAIL` | 0 |
| RES-02: function recursion depth 17 | `ERROR` | `ERROR` | function depth exhausted | `FAIL` | 0 |
| PRE-01: plain static danger | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | direct danger identity | `FAIL` | 0 |
| PRE-02: unknown source | `UNKNOWN` | `UNKNOWN` | unknown callable | `FAIL` | 0 |
| PRE-03: malformed PowerShell | `ERROR` | `ERROR` | parser error | `FAIL` | 0 |
| PRE-04: known safe ScriptBlock | `SCRIPTBLOCK(SAFE)` | `SAFE` | safe identity | `PASS` | 1 |
| PRE-05: HEAD inventory incomplete | `ERROR` | `ERROR` | HEAD audit unavailable | `FAIL: BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE` | 0 |

矩阵中禁止出现 `DANGEROUS/UNKNOWN`、`SAFE or UNKNOWN` 或其他多义预期。

## 15. A7.18 实施范围

建议 A7.18 仅修改：

```text
packages/build-integrity/src/script-security.mjs
apps/web/tests/p13-startup-preflight.test.ts
必要时新增的 Scanner 专项测试文件
docs/architecture/file-lifecycle-p13-c6-2-l8a7-18-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-18-report.md
docs/architecture/file-lifecycle-p13-implementation-status.md
```

不得修改 Build Preflight、Startup Gate、Manifest、Web/Worker 业务入口、
Schema、Migration、Storage 或历史构建产物，除非 A7.18 另行获得明确授权。

推荐顺序：

1. PowerShell finite statement/control-flow parser；
2. value kind、object/array location 与 snapshot；
3. function success output summary；
4. caller-sensitive scope frame；
5. case-fold canonical index 与冲突 union；
6. `ScriptBlock.Create` 递归内容分析；
7. 统一 invocation target resolver；
8. cache key、预算与 ERROR stickiness；
9. 完整唯一矩阵测试；
10. A7.8-A7.17 历史回归和 Preflight 故障注入。

任一步出现 P1/P2 未解决项，停止后续步骤，不进入独立审查。

## 16. 风险与未解决问题

### 已接受的首版边界

- 不是完整 PowerShell grammar，也不运行官方 PowerShell parser；
- 跨文件、module、dot-source、reflection 和自定义 PSObject adapter 仍为
  `UNKNOWN`；
- 复杂 pipeline、formatting、自定义 comparer 和扩展类型可能产生更多
  `UNKNOWN`；
- Windows PowerShell 5.1 与 PowerShell 7 的行为差异必须保守处理；
- 时间预算在极慢环境可能更早产生 `ERROR`，但这只能是 fail-closed；
- 当前源码尚未修复，A7.16 已确认的 invocation bypass 仍存在。

### 对 SAFE false-negative 的影响

本文没有保留已知会导致危险路径被判 `SAFE` 的设计缺口。上述未支持语法均沿
依赖链返回 `UNKNOWN`，Parser/内部/预算失败返回 `ERROR`，并由 Preflight
阻断。实际是否满足该承诺必须由 A7.18 实施和后续独立审查验证。

## 17. 最终结论

```text
A7.16 P1 semantic closure:
DESIGNED

Function success output stream:
DEFINED

Caller-sensitive dynamic scope:
DEFINED

Case-insensitive name resolution:
DEFINED

ScriptBlock.Create content analysis:
DEFINED

Identity/alias/snapshot semantics:
DEFINED

Unique expected test matrix:
DEFINED

Source modification:
NOT EXECUTED

Git write:
NOT EXECUTED

Database:
NOT CONNECTED

Storage:
NOT ACCESSED

Real Build:
NOT EXECUTED

Next Phase:
NOT AUTHORIZED

Status:
READY FOR IMPLEMENTATION
```
