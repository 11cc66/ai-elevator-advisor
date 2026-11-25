# P1-3 C-6.2-L8-A7.17.3 PowerShell Semantic Final Closure

## 1. 文档信息

- 阶段：`C-6.2-L8-A7.17.3`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 本阶段性质：只读设计复核 + 单份最终补充文档
- 实施状态：`NOT IMPLEMENTED`
- Git 写操作：`NOT EXECUTED`
- Next Phase：`NOT AUTHORIZED`

本文件是 A7.18 实施前的最终设计基线。若与 A7.17、A7.17.1 或 A7.17.2
存在冲突，以本文件为准。它修正设计语义，不表示 Scanner 已修复。

## 2. 基线与哈希

| 对象 | 路径或 revision | SHA-256 / revision |
| -- | -- | -- |
| Git HEAD | repository | `b224388bc6160eb4a66ad8db7cecd4d23aa75fb8` |
| A7.17.2 Design | `docs/architecture/file-lifecycle-p13-c6-2-l8a7-17-2-semantic-closure.md` | `B82E91FB17DEEF7805658C42561A0524941080DE6B9F766BB42FF7F8E9C104CA` |
| A7.17.1 Decision Closure | `docs/architecture/file-lifecycle-p13-c6-2-l8a7-17-1-decision-closure.md` | `9BECFAF75D6B141E019010FA24A9F9CEA7429EC17EEDDE0D3DB27F2A1C7AFB49` |
| A7.17 Design | `docs/architecture/file-lifecycle-p13-c6-2-l8a7-17-design.md` | `CCB1546FD8EC0E2FBF270000EDCC92BD997CE6FF414B481C867E09A4E995FCDA` |
| A7.16 Review | `docs/architecture/file-lifecycle-p13-c6-2-l8a7-16-review.md` | `EDD14B68D965F22A34ACD56AA0DE370A2EE7F5E6F5C8DD41DCE07A61205930CA` |
| A7.15 Report | `docs/architecture/file-lifecycle-p13-c6-2-l8a7-15-report.md` | `A3FEAA951931F85C4A362BDE4E40276A26FAB38A383C4FD70E8A41485A580DD7` |
| Implementation Status | `docs/architecture/file-lifecycle-p13-implementation-status.md` | `F62415A33AE50B705F6B7B6A7A229C671F739C8ADAA696EE6EA2512376EBBAD9` |
| PowerShell Scanner | `packages/build-integrity/src/script-security.mjs` | `45D112E83AE55891C34DD49ADF2A657DFA9348BF2C9B12D24C3D3E3529FDDED7` |
| Preflight Test | `apps/web/tests/p13-startup-preflight.test.ts` | `1CC9A16268C9F8C66F926E073A4BEE632052E617D4C29A1C6A0DD804B1582B7F` |
| Startup/Preflight Orchestrator | `packages/build-integrity/src/startup-security.mjs` | `B6F4DC33B50CF755DC74D47B8FC819C40964A9553D44D420DEE1A62AAF137DB4` |

全部哈希与当前文件一致。Git HEAD 和工作树基线未变化，既有未提交修改全部
保留。

## 3. Skills 与安全边界

实际加载并应用：

- `$project-architecture`
- `$security-audit`
- `$testing-and-verification`
- `$file-lifecycle`

未调用 `$prisma-db-safety`，本阶段不涉及 Schema、Migration、SQL、事务或
数据库角色。

本阶段只新增本文档。没有修改 Scanner、测试、Build Preflight、Startup Gate、
Manifest、Implementation Status、历史报告或构建产物；没有执行 PowerShell、
Build、数据库、Storage、ACL 或 Git 写操作。

## 4. 本轮发现

### 4.1 P1：A7.17.2 的 assign 与 merge 混淆

A7.17.2 将“canonical key 相同”直接解释成永久 union，导致以下输入错误地
保留已经被覆盖的危险值：

```powershell
$target = [scriptblock]::Create('next start')
$TARGET = [scriptblock]::Create('Write-Host safe')
$target.Invoke()
```

PowerShell 变量名大小写不敏感，第二个赋值与第一个赋值写入同一个 binding。
同一执行路径上的后续确定性赋值必须执行 `kill(old); bind(new)`，最终为
`SAFE`，不能保留旧危险值。

但同一规则不能用于不同控制流分支。以下危险候选仍然可达：

```powershell
if ($condition) {
    $target = [scriptblock]::Create('next start')
} else {
    $target = [scriptblock]::Create('Write-Host safe')
}
$target.Invoke()
```

分支 join 时必须 union，最终为 `DANGEROUS`。

### 4.2 P2：A7.17.2 的 closure 捕获时点错误

A7.17.2 写成 closure “捕获在调用时形成 snapshot”。正确规则是：

```text
GetNewClosure() 调用时捕获
不是 ScriptBlock 正文执行时捕获
```

闭包创建后，外部变量重新绑定不能改变已经捕获的 scalar 或 ScriptBlock
binding；但捕获的 ObjectRef/ArrayRef 仍指向原 location，因此该 location
内部后续 mutation 对闭包可见。

### 4.3 P3：FO-04 包含静态不可达分支

A7.17.2 的 FO-04：

```powershell
if ($true) {
    return [scriptblock]::Create('next start')
}
[scriptblock]::Create('Write-Host safe')
```

`$true` 使 safe 输出永远不可达，不能作为“danger + safe union”样例。最终
矩阵将改用 `$condition`。其他矩阵未发现需要静态 union 的 `$true`/`$false`
分支。

### 4.4 P4：仍需消除的模糊状态

以下状态必须唯一化：

| 情况 | 唯一状态 |
| -- | -- |
| 语法损坏、token/结构无法解析 | `ERROR` |
| Parser 内部异常、Scanner 内部异常 | `ERROR` |
| 深度、状态数、属性数或时间预算耗尽 | `ERROR` |
| 合法但不在支持子集内 | `UNKNOWN` |
| 来源、scope、caller 或 comparer 无法确定 | `UNKNOWN` |
| 字符串候选无法完整重建 | `UNKNOWN` |
| 有完整静态证据且全部可达候选安全 | `SAFE` |
| 有完整静态证据且任一可达候选危险 | `DANGEROUS` |

合法但不支持的 assignment target 不能同时写成 `ERROR/UNKNOWN`。例如
`Set-Variable -Scope` 语义未建模时是 `UNKNOWN`；赋值 token 本身损坏才是
`ERROR`。

状态合并固定为：

```text
ERROR > DANGEROUS > UNKNOWN > SAFE
```

## 5. 状态与覆盖总规则

### 5.1 两类状态必须分开

```text
Value state:
SCALAR
SCRIPTBLOCK
OBJECT_REF
ARRAY_REF
FUNCTION
CALLABLE_REF
EMPTY_SUCCESS_STREAM
UNKNOWN_VALUE

Analysis state:
SAFE
DANGEROUS
UNKNOWN
ERROR
```

`UNKNOWN_VALUE` 是某个 binding/expression 的抽象值；`UNKNOWN` 是当前
expression/function/invocation 无法完成安全证明。二者相关但不等同。

### 5.2 覆盖规则

- 同一具体执行路径上的确定性变量、property 或 element 写是 kill/gen。
- safe 写入可以在实际执行到该写入且旧值尚未用于危险调用时，覆盖旧危险
  value。
- 已经执行的危险调用不能被后续 safe assignment 撤销，已有 DANGEROUS
  finding 保留。
- value 级 UNKNOWN 可以在同一路径被后续确定性 safe 写入覆盖。
- 因控制流、输出流、scope 或候选集合不完整产生的 UNKNOWN 是分析完整性
  状态，不因无关 safe 写入消失。
- `ERROR` 和预算耗尽为 sticky，不能被后续 SAFE 覆盖。
- 分支 merge 时，一个分支的 safe 写入不能删除另一个可达分支的危险或
  unknown 候选。

## 6. P1 最终决策：名称等价与赋值覆盖

### 6.1 Binding key

变量、property、element 和表项均使用绑定位置，而不是仅使用显示文本：

```text
VariableBindingKey {
  frameId
  canonicalName
}

PropertyBindingKey {
  objectLocationId
  snapshotVersion
  canonicalMemberName
}

ArrayElementBindingKey {
  arrayLocationId
  snapshotVersion
  staticIndex
}
```

PowerShell 名称按固定 case fold 生成 `canonicalName`，同时保留原始 token
用于 finding。case fold 只是把 `$target` 和 `$TARGET` 指向同一逻辑键；它
本身不产生候选 union。

### 6.2 同一路径 assignment

| 操作 | 结果 |
| -- | -- |
| `$name = value` | current frame 的 canonical binding 被完整替换 |
| `$TARGET = safe` after `$target = danger` | danger 被 kill，只保留 safe |
| `$name += value` | 先读旧值；受支持运算才计算，否则结果为 `UNKNOWN_VALUE` |
| `$obj.name = value` | 已知 object location 的 canonical member 被替换 |
| `$arr[index] = value` | 只替换该 array location 的静态 index |
| 未限定 assignment | 永远写 current local frame，不写 parent/caller binding |

同一路径上重复定义同名函数、alias 或已知 command binding 时，后续确定性
定义同样替换当前可见定义。不同 scope/caller 中的定义不能相互覆盖，应在
相应 caller 上下文中分别求值后 union。

### 6.3 控制流 merge

1. 每个分支从同一输入 state 克隆。
2. 分支内 assignment 按 kill/gen 更新自己的 state。
3. `return`、`throw`、`break`、`continue` 不进入正常 join 的路径。
4. 如果分支没有写入，其输入候选仍进入 join。
5. join 时按 binding key 合并所有可达候选。
6. merge 之后的确定性 assignment 再 kill 当前所有可达候选。
7. `$condition` 不可静态决定时，两个分支都视为可达。
8. `$true`/`$false` 字面条件只保留静态可达分支。

因此：

```text
straight-line overwrite -> kill/gen
control-flow join       -> candidate union
later overwrite         -> kill all merged candidates on that path
```

### 6.4 Hashtable

PowerShell 字面量 `@{}` 使用默认的大小写不敏感 key 比较行为：

- `$h.Target` 与 `$h.target` 指向同一默认 key。
- 同一路径 `$h.Target = danger` 后执行 `$h.target = safe`，后者覆盖前者。
- 字面量中出现两个仅大小写不同的 key，可静态证明为重复 key 构造失败，
  结果 `ERROR`。
- 仅在运行时才出现的重复 key 导致失败，但失败语义无法完整证明时，
  结果 `UNKNOWN`。

自定义 Hashtable comparer：

- 已知精确 comparer 且实现已支持时，按其大小写语义建模；
- 自定义、外部或无法确定 comparer 时，任何依赖该 key 的 invocation 为
  `UNKNOWN`；
- 不得默认所有 Hashtable 都大小写不敏感，也不得默认都大小写敏感。

### 6.5 PSCustomObject

- `[pscustomobject]@{}` 的正常 PowerShell member access 按
  case-insensitive 处理。
- 只有一个等价成员时，`$obj.target` 与 `$obj.Target` 读取同一成员。
- 同一路径确定性 property assignment 覆盖该成员。
- 静态或动态扩展产生多个仅大小写等价的成员时，PowerShell member adapter
  的具体选择可能依赖对象内部顺序或版本；结果为 `UNKNOWN`。
- `Add-Member`、动态 property provider 或自定义 adapter 未完整静态建模时，
  依赖该成员的 invocation 为 `UNKNOWN`。

### 6.6 不同分支对象

```powershell
$obj = if ($condition) {
    @{ Target = [scriptblock]::Create('next start') }
} else {
    @{ target = [scriptblock]::Create('Write-Host safe') }
}
$obj.target.Invoke()
```

每个分支产生一个独立 object candidate。属性读取在每个候选上分别执行，
最终 union 为 danger+safe，Security State 为 `DANGEROUS`。

### 6.7 强制覆盖样例

```powershell
# ASN-01
$target = [scriptblock]::Create('next start')
$TARGET = [scriptblock]::Create('Write-Host safe')
$target.Invoke()

# ASN-02
$target = [scriptblock]::Create('Write-Host safe')
$TARGET = [scriptblock]::Create('next start')
$target.Invoke()

# ASN-03
if ($condition) {
    $target = [scriptblock]::Create('next start')
} else {
    $target = [scriptblock]::Create('Write-Host safe')
}
$target.Invoke()

# ASN-04
if ($condition) {
    $target = [scriptblock]::Create('next start')
} else {
    $target = [scriptblock]::Create('Write-Host safe')
}
$target = [scriptblock]::Create('Write-Host final')
$target.Invoke()
```

唯一预期见第 12 节矩阵。

## 7. P2 最终决策：GetNewClosure 捕获

### 7.1 捕获时点

`$closure = $body.GetNewClosure()` 在方法调用发生的时刻创建：

```text
ClosureSnapshot {
  closureId
  bodyDigest
  capturedBindings
  capturedObjectRefs
  captureGeneration
}
```

捕获完成后，closure binding 与外部变量重新赋值分离。

### 7.2 捕获类型

| 捕获值 | 捕获语义 | closure 创建后的可见效果 |
| -- | -- | -- |
| scalar | 复制 value | 外部 scalar 重新赋值不可见 |
| ScriptBlock | 复制不可变 identity | 外部变量重绑定不可见 |
| ObjectRef | 复制 reference，保留同一 locationId | 原对象 property mutation 可见 |
| ArrayRef | 复制 reference，保留同一 locationId | 原 array element mutation 可见 |
| UNKNOWN_VALUE | 只保存 unknown | invocation 依赖它时为 `UNKNOWN` |

外层变量重新指向新 object 时，closure 仍指向创建时捕获的旧 ObjectRef。

### 7.3 解析与缓存

- closure 调用先查 captured bindings，再用已建模的 script/global scope。
- 未捕获、且只能依赖动态 caller 的变量读取为 `UNKNOWN`。
- 捕获集合不完整、存在外部 scope、或捕获过程中预算耗尽时：
  - 依赖捕获值的 invocation -> `UNKNOWN`；
  - 捕获分析本身发生结构/内部/预算错误 -> `ERROR`。
- 每次 `GetNewClosure()` 产生独立 `closureId`，不得把不同 capture snapshot
  的缓存结果混用。
- 缓存键必须包含 `closureSnapshotId`、captured binding digest、捕获的
  object/array locationId 及当前 snapshot version。

### 7.4 强制闭包样例

```powershell
# CL-01: 创建时捕获危险 ScriptBlock
$target = [scriptblock]::Create('next start')
$closure = { $target.Invoke() }.GetNewClosure()
$target = [scriptblock]::Create('Write-Host safe')
& $closure

# CL-02: 创建时捕获安全 ScriptBlock
$target = [scriptblock]::Create('Write-Host safe')
$closure = { $target.Invoke() }.GetNewClosure()
$target = [scriptblock]::Create('next start')
& $closure

# CL-03: 捕获 ObjectRef，之后 mutation 可见
$obj = @{ target = [scriptblock]::Create('Write-Host safe') }
$closure = { $obj.target.Invoke() }.GetNewClosure()
$obj.target = [scriptblock]::Create('next start')
& $closure

# CL-04: 外部 object 变量重绑定不改变旧 ref
$obj = @{ target = [scriptblock]::Create('next start') }
$closure = { $obj.target.Invoke() }.GetNewClosure()
$obj = @{ target = [scriptblock]::Create('Write-Host safe') }
& $closure

# CL-05: 捕获 ArrayRef，之后 element mutation 可见
$items = @([scriptblock]::Create('Write-Host safe'))
$closure = { $items[0].Invoke() }.GetNewClosure()
$items[0] = [scriptblock]::Create('next start')
& $closure

# CL-06: 捕获来源未知
$target = Get-RemoteScript
$closure = { & $target }.GetNewClosure()
& $closure
```

## 8. P3 最终决策：静态可达性与 FO-04

FO-04 最终输入：

本节及第 12 节所有 `$condition` 样例均假定文件或函数显式声明未知外部输入，
例如顶层 `param([bool]$condition)`。不得依赖未初始化变量在某个 PowerShell
版本中的隐式 `$null` 行为。

```powershell
function Get-Target {
    if ($condition) {
        return [scriptblock]::Create('next start')
    }
    [scriptblock]::Create('Write-Host safe')
}
(Get-Target).Invoke()
```

分析：

- `$condition` 不可静态确定，两个分支都可达；
- true 分支输出 dangerous ScriptBlock 并终止；
- false 分支继续执行 bare expression，输出 safe ScriptBlock；
- 函数结果为 danger+safe union；
- invocation 合并为 `DANGEROUS`。

另设静态条件对照：

```powershell
function Get-Target {
    if ($true) {
        return [scriptblock]::Create('next start')
    }
    [scriptblock]::Create('Write-Host safe')
}
(Get-Target).Invoke()
```

此例只有 danger 分支可达，Abstract Value 不得写成 union。

其他矩阵复核结论：

- CASE-04、SBC-04、SN-05 使用 `$condition`，union 预期成立；
- `return` 后续同分支语句不可达；
- 分支前的赋值只作为未写分支的 incoming candidate；
- join 后无条件赋值会 kill 全部 merged candidates；
- 未发现其他静态不可达分支或重复赋值与预期不一致。

## 9. P4 最终决策：唯一状态规则

| 场景 | 唯一终态 |
| -- | -- |
| 合法、完整分析、所有可达候选 SAFE | `SAFE` |
| 任一可达候选明确禁止启动入口 | `DANGEROUS` |
| 合法但不支持、scope/caller/comparer/source 不确定 | `UNKNOWN` |
| Parser、结构、内部异常、预算耗尽 | `ERROR` |
| 多候选含 DANGEROUS+UNKNOWN | `DANGEROUS` |
| 多候选含 ERROR 和任何其他状态 | `ERROR` |
| 被 statically unreachable 的代码 | 不进入候选集合 |
| 证明为空成功流或确定 non-callable | `SAFE` |

禁止把多个状态合并成非唯一预期，也禁止使用依赖具体实现的 fallback。
每个测试的 Security State 必须直接引用上表中的一个值。

任何测试若不能形成唯一终态，必须先拆分样例或修正设计，不得进入矩阵。

## 10. 额外交叉复核

### 10.1 函数输出流与 Pipeline

函数成功流和 pipeline data flow 使用同一 `SuccessOutputSummary`：

| 结构 | 输出规则 |
| -- | -- |
| bare expression / bare variable | 结果进入成功流 |
| `Write-Output x` | x 进入成功流 |
| `Write-Host x` | 只写 host 流，不进入成功流 |
| `Write-Error x` | 只写 error 流，不进入成功流 |
| `Write-Error x 2>&1` 或其他 error-to-success 重定向 | 首版不推断转换结果；若结果进入 invocation，则为 `UNKNOWN` |
| `return x` | x 进入成功流并终止当前分支 |
| `$x = pipeline` / `$null = pipeline` | pipeline 成功输出被捕获，assignment 不向外部输出 |
| `pipeline | Out-Null` | pipeline 成功输出被消费 |
| `pipeline | Write-Host` | 成功流终止为 host 展示数据 |
| 未知 pipeline transformer | 若结果进入 invocation，后续为 `UNKNOWN` |

已经执行的危险 pipeline 仍产生 DANGEROUS finding；后续捕获或 `Out-Null`
不能撤销该 finding。

### 10.2 Caller chain 与遮蔽

- 未限定读取从 current local 开始。
- current local 存在 binding 时停止，即使值为 `$null`、UNKNOWN 或 non-callable。
- local 缺失时查 nearest caller function frame，再向外。
- caller frame 中找到 binding 时停止，不再继续查更外层同名 binding。
- 多个静态 caller 分别求值后 union。
- `$local:` 不向 caller fallback；`$script:`/`$global:` 不经过 caller chain。
- caller 不确定且本地/显式 scope 不足时为 `UNKNOWN`。

### 10.3 ScriptBlock.Create

所有有限字符串候选必须逐个调用同一 PowerShell 内容扫描器：

```text
FINITE_STRING_SET -> scan each candidate -> state merge
```

部分候选未分析、动态候选或来源不明时，不得忽略该候选；整体至少为
`UNKNOWN`。任一候选语法/内部/预算错误时，按优先级可上升为 `ERROR`。

### 10.4 Alias 与快照

- Object/array assignment 共享 locationId。
- Scalar/ScriptBlock 复制 value/identity。
- property mutation 只更新一个 location 的一个 canonical member。
- array element mutation 只更新一个静态 index。
- branch merge 保留每个可达 branch snapshot。
- join 后的确定性覆盖只 kill 当前所有可达候选。

### 10.5 Cache

缓存键至少包含：

```text
fileDigest
parserVersion
analysisPolicyVersion
expressionNodeId
callContextDigest
callerFrameChainDigest
closureSnapshotId
capturedBindingDigest
environmentGeneration
objectSnapshotVersion[]
argumentAbstractDigest
activeFunctionSetDigest
```

缓存不得跨 caller、closure 或 object snapshot 复用。缓存命中不能恢复已消耗
预算，也不能把 analysis completeness 从 `UNKNOWN` 或 `ERROR` 降为 `SAFE`。

### 10.6 State precedence

- ERROR、预算耗尽和内部异常是 sticky。
- analysis completeness UNKNOWN 只能由完整重新分析解除，安全写入本身不能
  解除。
- value-level `DANGEROUS` 或 `UNKNOWN` 可按实际 assignment kill/gen 被覆盖。
- branch merge 不删除任何可达候选。
- 已经执行的危险入口 finding 不会被后续状态 mutation 删除。

### 10.7 Build Preflight

Preflight 继续只消费唯一 Scanner 的最终四态：

| Scanner 终态 | Worktree Gate | Builder calls |
| -- | -- | --: |
| `DANGEROUS` | `FAIL` | 0 |
| `UNKNOWN` | `FAIL` | 0 |
| `ERROR` | `FAIL` | 0 |
| `SAFE` | `PASS` | 1 |
| HEAD audit incomplete | 单独 fail closed | 0 |

不新增第二套 PowerShell Scanner，不改变 Manifest、Startup Gate 或历史
Artifact fallback。

## 11. 全局安全不变量

1. 同一路径的 canonical binding assignment 是 kill/gen，不是 union。
2. 不同可达分支的候选必须在 join 处 union。
3. 一个分支的 `SAFE` 不能覆盖另一个分支的 `DANGEROUS` 或 `UNKNOWN`。
4. join 后的确定性 assignment 可以覆盖所有当前可达旧 value。
5. 已执行危险调用产生的 finding 不可被后续 assignment 撤销。
6. Hashtable/PSCustomObject comparer 或 member resolution 不确定时为
   `UNKNOWN`。
7. 不同 canonical 候选的 union 只发生在真实路径、object alternative 或
   caller alternative 汇合处。
8. `GetNewClosure()` 在创建时捕获，不在执行时捕获。
9. 捕获的 scalar/ScriptBlock binding 不受外部重绑定影响。
10. 捕获的 ObjectRef/ArrayRef 与原 location 共享后续 mutation。
11. closure 捕获集合不完整且影响执行时为 `UNKNOWN`。
12. 静态不可达分支不进入函数输出或安全状态候选。
13. Parser、内部和预算失败必须为 `ERROR` 并阻断。
14. 合法但不支持或证据不足必须为 `UNKNOWN` 并阻断。
15. `SAFE` 要求所有可达候选完整分析且全部安全。
16. 唯一状态优先级固定为 `ERROR > DANGEROUS > UNKNOWN > SAFE`。
17. Cache 不得绕过 caller、closure、environment、object snapshot 或预算。
18. Preflight 只能消费一套 Scanner 结果。

## 12. 最终唯一预期测试矩阵

`FAIL` 均表示 `BUILD_SOURCE_SECURITY_FAILED`；PRE-05 使用
`BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE`。每个 Builder 数值都是唯一预期。

本矩阵所有 `$condition` 都由显式未知输入声明提供，例如
`param([bool]$condition)`；不存在依赖未初始化变量静态值的样例。

### 12.1 函数输出与 Pipeline

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
    if ($condition) {
        return [scriptblock]::Create('next start')
    }
    [scriptblock]::Create('Write-Host safe')
}
(Get-Target).Invoke()

# FO-05
function Get-Target { Write-Host 'next start' }
(Get-Target).Invoke()

# FO-06
function Get-Target { Write-Error 'next start' }
(Get-Target).Invoke()

# FO-07
function Get-Target {
    return [scriptblock]::Create('next start')
    [scriptblock]::Create('Write-Host safe')
}
(Get-Target).Invoke()

# FO-08
function Get-Target {
    [scriptblock]::Create('next start') | Out-Null
}
(Get-Target).Invoke()
```

| ID | Abstract value kind | Security state | Invocation target | Preflight | Builder |
| -- | -- | -- | -- | -- | --: |
| FO-01 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | danger ScriptBlock | `FAIL` | 0 |
| FO-02 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | danger ScriptBlock | `FAIL` | 0 |
| FO-03 | `EMPTY_SUCCESS_STREAM` | `SAFE` | `null` / non-callable | `PASS` | 1 |
| FO-04 | `VALUE_UNION(SCRIPTBLOCK(DANGEROUS), SCRIPTBLOCK(SAFE))` | `DANGEROUS` | danger candidate | `FAIL` | 0 |
| FO-05 | `EMPTY_SUCCESS_STREAM` | `SAFE` | `null` / non-callable | `PASS` | 1 |
| FO-06 | `EMPTY_SUCCESS_STREAM` | `SAFE` | `null` / non-callable | `PASS` | 1 |
| FO-07 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | danger ScriptBlock | `FAIL` | 0 |
| FO-08 | `EMPTY_SUCCESS_STREAM` | `SAFE` | `null` / non-callable | `PASS` | 1 |

### 12.2 名称等价、赋值与 merge

```powershell
# ASN-01
$target = [scriptblock]::Create('next start')
$TARGET = [scriptblock]::Create('Write-Host safe')
$target.Invoke()

# ASN-02
$target = [scriptblock]::Create('Write-Host safe')
$TARGET = [scriptblock]::Create('next start')
$target.Invoke()

# ASN-03
if ($condition) {
    $target = [scriptblock]::Create('next start')
} else {
    $target = [scriptblock]::Create('Write-Host safe')
}
$target.Invoke()

# ASN-04
if ($condition) {
    $target = [scriptblock]::Create('next start')
} else {
    $target = [scriptblock]::Create('Write-Host safe')
}
$target = [scriptblock]::Create('Write-Host final')
$target.Invoke()

# ASN-05
$obj = @{ Target = [scriptblock]::Create('next start') }
$obj.target = [scriptblock]::Create('Write-Host safe')
$obj.Target.Invoke()

# ASN-06
$obj = @{
    Target = [scriptblock]::Create('next start')
    target = [scriptblock]::Create('Write-Host safe')
}
$obj.target.Invoke()

# ASN-07
$obj = Get-ObjectWithUnknownComparer
$obj.target.Invoke()

# ASN-08
$obj = if ($condition) {
    @{ Target = [scriptblock]::Create('next start') }
} else {
    @{ target = [scriptblock]::Create('Write-Host safe') }
}
$obj.target.Invoke()

# ASN-09
$obj = [pscustomobject]@{
    Target = [scriptblock]::Create('next start')
}
$obj.target.Invoke()

# ASN-10
$obj = Get-PsObjectWithCaseCollidingMembers
$obj.target.Invoke()
```

| ID | Abstract value kind | Security state | Invocation target | Preflight | Builder |
| -- | -- | -- | -- | -- | --: |
| ASN-01 | `BINDING(SCRIPTBLOCK(SAFE))` | `SAFE` | safe final binding | `PASS` | 1 |
| ASN-02 | `BINDING(SCRIPTBLOCK(DANGEROUS))` | `DANGEROUS` | danger final binding | `FAIL` | 0 |
| ASN-03 | `VALUE_UNION(SCRIPTBLOCK(DANGEROUS), SCRIPTBLOCK(SAFE))` | `DANGEROUS` | danger branch candidate | `FAIL` | 0 |
| ASN-04 | `BINDING(SCRIPTBLOCK(SAFE))` | `SAFE` | safe post-merge overwrite | `PASS` | 1 |
| ASN-05 | `PROPERTY(SCRIPTBLOCK(SAFE))` | `SAFE` | safe `target` table value | `PASS` | 1 |
| ASN-06 | `ERROR` | `ERROR` | duplicate case-fold key | `FAIL` | 0 |
| ASN-07 | `UNKNOWN` | `UNKNOWN` | unknown comparer/member | `FAIL` | 0 |
| ASN-08 | `VALUE_UNION(SCRIPTBLOCK(DANGEROUS), SCRIPTBLOCK(SAFE))` | `DANGEROUS` | branch object alternatives | `FAIL` | 0 |
| ASN-09 | `PROPERTY(SCRIPTBLOCK(DANGEROUS))` | `DANGEROUS` | case-folded PSObject member | `FAIL` | 0 |
| ASN-10 | `UNKNOWN` | `UNKNOWN` | ambiguous PSObject member | `FAIL` | 0 |

### 12.3 动态作用域

```powershell
# SC-01
function Invoke-Target { $target.Invoke() }
function Start-Wrapper {
    $target = [scriptblock]::Create('next start')
    Invoke-Target
}
Start-Wrapper

# SC-02
function Invoke-Target {
    $target = [scriptblock]::Create('Write-Host safe')
    $target.Invoke()
}
function Start-Wrapper {
    $target = [scriptblock]::Create('next start')
    Invoke-Target
}
Start-Wrapper

# SC-03
$global:target = [scriptblock]::Create('next start')
$global:target.Invoke()

# SC-04
function Invoke-Target { $target.Invoke() }
Invoke-Target

# SC-05
$script:target = [scriptblock]::Create('next start')
$script:target.Invoke()
```

| ID | Abstract value kind | Security state | Invocation target | Preflight | Builder |
| -- | -- | -- | -- | -- | --: |
| SC-01 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | caller-frame danger | `FAIL` | 0 |
| SC-02 | `SCRIPTBLOCK(SAFE)` | `SAFE` | local shadow | `PASS` | 1 |
| SC-03 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | global danger | `FAIL` | 0 |
| SC-04 | `UNKNOWN` | `UNKNOWN` | unresolved external caller | `FAIL` | 0 |
| SC-05 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | script danger | `FAIL` | 0 |

### 12.4 ScriptBlock.Create

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
| SBC-01 | `SCRIPTBLOCK(SAFE)` | `SAFE` | safe ScriptBlock | `PASS` | 1 |
| SBC-02 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | danger ScriptBlock | `FAIL` | 0 |
| SBC-03 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | reconstructed danger body | `FAIL` | 0 |
| SBC-04 | `VALUE_UNION(SCRIPTBLOCK(DANGEROUS), SCRIPTBLOCK(SAFE))` | `DANGEROUS` | finite body candidates | `FAIL` | 0 |
| SBC-05 | `UNKNOWN` | `UNKNOWN` | unresolved body | `FAIL` | 0 |
| SBC-06 | `ERROR` | `ERROR` | parser-error body | `FAIL` | 0 |

### 12.5 Closure

输入见 7.4 节 CL-01 至 CL-06。

| ID | Abstract value kind | Security state | Invocation target | Preflight | Builder |
| -- | -- | -- | -- | -- | --: |
| CL-01 | `CLOSURE(SCRIPTBLOCK(DANGEROUS))` | `DANGEROUS` | captured danger identity | `FAIL` | 0 |
| CL-02 | `CLOSURE(SCRIPTBLOCK(SAFE))` | `SAFE` | captured safe identity | `PASS` | 1 |
| CL-03 | `CLOSURE(OBJECT_REF(properties=DANGEROUS))` | `DANGEROUS` | captured object current mutation | `FAIL` | 0 |
| CL-04 | `CLOSURE(OBJECT_REF(properties=DANGEROUS))` | `DANGEROUS` | captured old object reference | `FAIL` | 0 |
| CL-05 | `CLOSURE(ARRAY_REF(index0=DANGEROUS))` | `DANGEROUS` | captured array current mutation | `FAIL` | 0 |
| CL-06 | `UNKNOWN` | `UNKNOWN` | incomplete captured binding | `FAIL` | 0 |

### 12.6 Identity、Alias 与 Snapshot

```powershell
# SN-01
$danger = [scriptblock]::Create('next start')
$obj = @{ target = $danger }
$danger = [scriptblock]::Create('Write-Host safe')
$obj.target.Invoke()

# SN-02
$obj = @{ target = [scriptblock]::Create('next start') }
$alias = $obj
$alias.target = [scriptblock]::Create('Write-Host safe')
$obj.target.Invoke()

# SN-03
$obj = @{
    target = [scriptblock]::Create('next start')
    other = 'unchanged'
}
$obj.other = 'updated'
$obj.target.Invoke()

# SN-04
$items = @(
    [scriptblock]::Create('next start'),
    [scriptblock]::Create('Write-Host safe')
)
$items[1] = [scriptblock]::Create('Write-Host updated')
$items[0].Invoke()

# SN-05
$items = @([scriptblock]::Create('Write-Host safe'))
if ($condition) {
    $items[0] = [scriptblock]::Create('next start')
}
$items[0].Invoke()
```

| ID | Abstract value kind | Security state | Invocation target | Preflight | Builder |
| -- | -- | -- | -- | -- | --: |
| SN-01 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | original property identity | `FAIL` | 0 |
| SN-02 | `SCRIPTBLOCK(SAFE)` | `SAFE` | shared property after alias write | `PASS` | 1 |
| SN-03 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | unchanged `target` property | `FAIL` | 0 |
| SN-04 | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | array index 0 | `FAIL` | 0 |
| SN-05 | `VALUE_UNION(SCRIPTBLOCK(DANGEROUS), SCRIPTBLOCK(SAFE))` | `DANGEROUS` | merged index 0 snapshots | `FAIL` | 0 |

### 12.7 资源、Parser 与 Preflight

| ID | Abstract value kind | Security state | Invocation target | Preflight | Builder |
| -- | -- | -- | -- | -- | --: |
| RES-01: property chain depth 33 | `ERROR` | `ERROR` | depth budget | `FAIL` | 0 |
| RES-02: function recursion depth 17 | `ERROR` | `ERROR` | function depth budget | `FAIL` | 0 |
| RES-03: abstract state budget 50,001 | `ERROR` | `ERROR` | state budget | `FAIL` | 0 |
| PRE-01: plain static danger | `SCRIPTBLOCK(DANGEROUS)` | `DANGEROUS` | direct danger | `FAIL` | 0 |
| PRE-02: unknown source | `UNKNOWN` | `UNKNOWN` | unknown callable | `FAIL` | 0 |
| PRE-03: malformed PowerShell | `ERROR` | `ERROR` | parser error | `FAIL` | 0 |
| PRE-04: known safe ScriptBlock | `SCRIPTBLOCK(SAFE)` | `SAFE` | safe identity | `PASS` | 1 |
| PRE-05: HEAD inventory incomplete | `ERROR` | `ERROR` | HEAD audit unavailable | `FAIL: BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE` | 0 |

## 13. A7.18 实施范围与顺序

建议实施文件：

```text
packages/build-integrity/src/script-security.mjs
apps/web/tests/p13-startup-preflight.test.ts
必要时新增的 Scanner 专项测试文件
docs/architecture/file-lifecycle-p13-c6-2-l8a7-18-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-18-report.md
docs/architecture/file-lifecycle-p13-implementation-status.md
```

实施顺序：

1. Path-aware environment 与 canonical binding key；
2. branch clone/join 与 kill/gen；
3. Hashtable/PSCustomObject comparer 与 member resolution；
4. object/array location 与 snapshot；
5. function/pipeline `SuccessOutputSummary`；
6. caller-sensitive scope frame 与遮蔽；
7. `GetNewClosure()` 创建时捕获；
8. ScriptBlock.Create 有限候选统一扫描；
9. invocation target resolver；
10. cache、scope/closure/snapshot 维度与预算；
11. 完整矩阵测试；
12. A7.8-A7.17 历史回归与 Preflight 故障注入。

A7.18 不得修改 Build Preflight、Startup Gate、Manifest、业务入口、Schema、
Migration 或 Storage，除非另行获得明确授权。

## 14. 剩余限制与 UNKNOWN 边界

- 仍不实现完整 PowerShell grammar 或官方 runtime parser；
- 跨文件、module、dot-source、反射和自定义 PSObject adapter 为 `UNKNOWN`；
- 未建模的 pipeline transformer 在影响 invocation 时为 `UNKNOWN`；
- 未知 Hashtable comparer 和多重大小写等价 PSObject 成员为 `UNKNOWN`；
- closure 捕获集合不完整且影响执行时为 `UNKNOWN`；
- Windows PowerShell 5.1 与 PowerShell 7 差异不得猜测，未覆盖处为
  `UNKNOWN`；
- 时间预算在慢环境下可能提前触发 `ERROR`，但不得降为 SAFE；
- 当前 Scanner 中 A7.16 已确认的 PowerShell invocation bypass 仍然存在。

这些边界均 fail closed。当前文档只证明设计语义已闭合，不证明源码已修复。

## 15. 最终结论

```text
A7.17.2 P1 assignment/case semantics:
CORRECTED IN DESIGN

A7.17.2 P2 closure capture timing:
CORRECTED IN DESIGN

A7.17.2 P3 FO-04 reachability:
CORRECTED IN DESIGN

A7.17.2 P4 ambiguous states:
ELIMINATED IN DESIGN

Updated unique test matrix:
DEFINED

Global security invariants:
DEFINED

A7.18 scope and order:
DEFINED

Source modification:
NOT EXECUTED

Test modification:
NOT EXECUTED

Database:
NOT CONNECTED

Storage:
NOT ACCESSED

Real Build:
NOT EXECUTED

Git write:
NOT EXECUTED

Next Phase:
NOT AUTHORIZED

Status:
READY FOR IMPLEMENTATION
```
