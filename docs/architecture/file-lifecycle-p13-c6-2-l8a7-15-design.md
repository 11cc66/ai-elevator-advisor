# P1-3 C-6.2-L8-A7.15 Nested Destructuring & PowerShell Unknown Invocation Remediation Design

## 1. 文档信息

- 阶段：`C-6.2-L8-A7.15`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- A7.14 报告：`docs/architecture/file-lifecycle-p13-c6-2-l8a7-14-review.md`
- A7.14 Report SHA-256：
  `36FBEB9C7E5284D84CF5F1300DBBD929A6A39E447FDCF1A95034D95A7FE65456`
- 设计状态：`IMPLEMENTED / TESTED`

## 2. 根因

### 2.1 Nested computed destructuring

A7.13 对 computed property 实现了第一层 candidate merge，但 recursive
binding pattern 仍只接收一个 candidate：

```text
ObjectBindingPattern
  -> dynamic property
  -> dangerousCandidateFromObject / safeCallableCandidateFromObject
  -> bindAliasPattern(innerPattern, single alias)
```

当 outer candidate 是 nested object 时，上述 helper 只检查 object 自身是否
直接为 dangerous callable，不会继续把 inner `{ run }` 应用到 nested object。

因此 inner alias environment 为空，后续调用落为 SAFE。

### 2.2 PowerShell unknown invocation

ScriptBlock identity map 只保存可通过以下形式确认的来源：

- `[scriptblock]::Create()`；
- 已知 ScriptBlock alias；
- 已知 ScriptBlock 函数返回；
- 已知数组/对象传播。

以下未知来源被删除出 identity map，而不是成为 UNKNOWN：

```powershell
$script = Get-RemoteScript
$script = Get-Content .\release.ps1
$script = Read-Host 'Command'
function Get-Remote { return Get-Random }
$script = Get-Remote
```

call operator 随后只根据已知危险文本判定，因此返回 SAFE。

## 3. JavaScript Recursive Binding 模型

### 3.1 Candidate cartesian application

新模型不再先压成单值，再将 inner pattern 绑定到单值，而是：

```text
bindingsForPattern(pattern, candidate)
  -> Map<name, abstract value>
```

对 object computed property：

1. 静态 key -> exact property；
2. dynamic key -> all candidate properties；
3. 每个 candidate 独立应用完整 inner pattern；
4. 每个 candidate 生成自己的 binding Map；
5. 所有 Map 按变量名递归合并。

合并优先级：

```text
process / dynamic / reflect
  > unknown
  > same-kind recursive
  > unknown
```

### 3.2 Nested patterns

支持：

- `{ [key]: { run } }`；
- `{ [k1]: { [k2]: { third: run } } }`；
- object/array mixed pattern；
- default initializer；
- multiple properties；
- alias and repeated assignment；
- safe candidate + dangerous candidate；
- null / primitive / type mismatch。

类型不匹配时，所有未解析 leaf 变量获得 UNKNOWN，不允许静默 SAFE。

### 3.3 Resource and exception

recursive binding 使用现有：

```text
maxDepth = 32
maxAstNodes = 100,000
maxAbstractStates = 100,000
maxMilliseconds = 1,500
```

超过深度：

```text
leaf aliases -> UNKNOWN
```

公开 Scanner 入口仍将内部异常映射为：

```text
SCRIPT_SCANNER_INTERNAL_ERROR / ERROR
```

## 4. PowerShell Invocation Identity

### 4.1 Identity states

```text
next-start
worker-dist
safe
unknown
```

来源分类：

| Source | Identity |
| -- | -- |
| dangerous known ScriptBlock | next-start |
| safe known ScriptBlock | safe |
| unknown command/function/file/input | unknown |
| unknown overwritten by safe ScriptBlock | safe |
| safe overwritten by unknown source | unknown |

### 4.2 Assignment

支持：

- direct Create；
- alias；
- function return；
- array element；
- object property；
- parameter；
- global captured variable；
- reassignment kill/gen。

无法确认的 command/file/input 赋值转换为 UNKNOWN identity，不得删除后
按 SAFE 处理。

### 4.3 Invocation

以下形式共享 identity：

```powershell
& $variable
& $object.Property
& $array[0]
$variable.Invoke()
$object.Property.Invoke()
```

若 call operator 使用变量路径且没有任何可信 identity：

```text
SCRIPT_UNKNOWN_DYNAMIC_INVOCATION / UNKNOWN
```

若明确 safe identity：

```text
SAFE
```

若明确危险 identity：

```text
DANGEROUS
```

### 4.4 Safe overwrites

危险或未知 identity 被明确安全 ScriptBlock/静态安全值覆盖后，旧状态
必须 kill。

## 5. EncodedCommand

A7.13 strict Base64 验证保持不变：

- alphabet；
- length；
- padding；
- canonical re-encode；
- UTF-8 fatal；
- UTF-16LE；
- recursive PowerShell scan。

本阶段只回归，不降低严格性。

## 6. UNKNOWN / ERROR

```text
SAFE
  已完成分析，未发现危险或未知来源。

DANGEROUS
  确认存在禁止执行路径。

UNKNOWN
  调用目标、ScriptBlock 身份或数据来源无法可靠确定。

ERROR
  解析、结构或分析预算失败。
```

UNKNOWN / ERROR 继续使 Build Preflight fail closed。

## 7. 测试矩阵

### JavaScript

- original nested computed destructuring；
- multi-level nested computed；
- safe+dangerous candidate；
- default；
- alias；
- unknown source；
- safe candidate；
- budget。

### PowerShell

- unknown command；
- unknown file；
- unknown input；
- unknown function return；
- function parameter；
- array；
- object；
- alias；
- safe ScriptBlock overwrite；
- dangerous known ScriptBlock。

### Build

- DANGEROUS -> blocked；
- UNKNOWN -> blocked；
- Parser ERROR -> blocked；
- Budget ERROR -> blocked；
- safe positive -> builder once。

## 8. 完成边界

```text
Scanner:
IMPLEMENTED / TESTED

Real Build:
NOT EXECUTED

Database / Storage:
NOT CONNECTED / NOT ACCESSED

Git Write:
NOT EXECUTED

Next Phase:
NOT AUTHORIZED
```
