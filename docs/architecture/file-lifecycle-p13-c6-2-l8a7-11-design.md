# P1-3 C-6.2-L8-A7.11 Cross-Language Abstract Interpretation & Execution Semantics Remediation Design

## 1. 文档信息

- 阶段：`C-6.2-L8-A7.11`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- A7.10 报告：`docs/architecture/file-lifecycle-p13-c6-2-l8a7-10-review.md`
- A7.10 Report SHA-256：
  `255D95BC7E89CCDD6852382329553498D7A57C40575288DA35CF897F486AB004`
- 设计状态：`IMPLEMENTED / TESTED`

## 2. 整改前架构分析

### 2.1 JavaScript / TypeScript

A7.10 前的 Scanner 使用单一抽象值：

```text
SAFE
PROCESS(api)
DYNAMIC(eval|Function)
OBJECT(properties)
FUNCTION(node, captured)
ARRAY(elements, constant values)
REFLECT(namespace)
STRING / EXECUTABLE_PATH
```

环境是 `Map<string, abstract value>`。变量声明和普通 `=` 会 kill/gen 当前值；
`if` 分支使用环境副本合并。函数参数、返回值和 bind 有有限传播。

主要缺口：

- LogicalExpression 和逻辑赋值没有进入抽象值合并；
- ConditionalExpression 中发生 AssignmentExpression 时，两个分支共用一个
  可变环境；
- Array/ObjectLiteral destructuring 有处理，但 ElementAccess/PropertyAccess
  的后续 mutation 没有更新抽象状态；
- `.at()` 没有作为数组读取入口；
- Reflect namespace 有别名，但 `Reflect.apply` 方法本身没有抽象值；
- 数据传播深度上限耗尽后返回 null，调用方将其解释为 SAFE；
- 数组嵌套传播可能重复展开，缺少统一资源预算。

### 2.2 Shell

A7.9 后已有 token 级 wrapper 解析、已知 option/value 表、shell `-c`
payload 分析和 Here-doc stdin pipeline。主要缺口：

- `env -S` / `--split-string` 的 value 需要二次 tokenization；
- `sudo --chdir` 的 value 没有进入 option/value 表；
- Here-doc 遇到 xargs 时被统一视为不转发 stdin；
- xargs `-I` replacement 进入 shell `-c` payload 的情况没有分析；
- 识别到 shell command flag 但 payload 缺失时没有 UNKNOWN。

### 2.3 PowerShell

A7.9 后主要采用逐行正则、Here-string 提取、内置 alias 表和 ScriptBlock
局部匹配。主要缺口：

- 静态变量和字符串拼接只在简单赋值正则中体现；
- `& $cmd $arg` 被 command segmentation 拆开，丢失调用语义；
- `[scriptblock]::Create(...)` 参数只取到第一个 `)`；
- Get-Content/alias 输出到 ScriptBlock 的多行数据流没有建模；
- 自定义 function 输出进入 `iex` 没有执行上下文分析；
- Alias provider 覆盖没有进入 override 状态；
- encoded command 没有解码分析；
- 没有括号/花括号/字符串完整性检查。

### 2.4 UNKNOWN / ERROR / SAFE

目标判定：

```text
SAFE
  已完成受支持分析，且未发现禁止执行路径

DANGEROUS
  已确认进入 next start、Worker dist 或等价禁止执行入口

UNKNOWN
  执行目标、数据源或语义无法可靠解析

ERROR
  解析失败、结构损坏或资源预算耗尽
```

UNKNOWN 和 ERROR 都沿现有 Startup Gate fail-closed 路径处理。

## 3. JavaScript / TypeScript 新数据流模型

### 3.1 抽象值

新增 `UNKNOWN` 和 `REFLECT(operation)`，并允许抽象值携带非致命 partial
标记。关键区别：

```text
partial
  array 中部分元素不是静态字符串，但元素 provenance 仍有效

elementsUnknown
  动态下标写入导致指定状态下标内容不可确定
```

`partial` 本身不使已知元素传播失效；`elementsUnknown` 才使后续读取
fail-closed。

### 3.2 表达式合并

统一 potential-source 合并：

- `||`；
- `&&`；
- `??`；
- ConditionalExpression；
- comma / SequenceExpression；
- nested combination。

合并规则优先级：

```text
process / dynamic / reflect
  > unknown
  > same-kind recursive merge
  > unknown
```

安全分支不能覆盖另一分支的危险来源。

### 3.3 赋值状态

支持：

- `=`；
- `||=`；
- `&&=`；
- `??=`；
- ConditionalExpression 内部分支赋值；
- if/else 环境合并；
- 变量重新赋值；
- 解构后再次赋值。

ConditionalExpression 的两个分支分别在深复制环境中分析，再递归合并数组、
对象与函数捕获。

### 3.4 数组和对象状态

新增 target update：

- Identifier；
- ElementAccess；
- PropertyAccess；
- ArrayLiteral / ObjectLiteral destructuring；
- nested array/object；
- computed property；
- dynamic index。

读取支持：

- array 固定索引；
- 动态索引 potential candidates；
- `.at(index)`；
- object/array 混合嵌套；
- alias 访问同一抽象容器。

动态写入将 `elementsUnknown=true`，后续元素读取返回 UNKNOWN，而不是沿用
写入前的 SAFE 元素。

### 3.5 Reflect 与高阶调用

`Reflect.apply` / `Reflect.construct` 表示为 `REFLECT(operation)`。

支持：

- 直接 namespace；
- Reflect namespace alias；
- `const apply = Reflect.apply`；
- Reflect object destructuring；
- bind chain；
- call/apply 参数数组传播。

调用目标为 process API、eval、Function 或普通本地函数时使用对应语义。

## 4. JavaScript 资源预算

每个 JavaScript 文件独立预算：

```text
maxAstNodes:       100,000
maxAbstractStates: 100,000
maxDepth:          32
maxMilliseconds:   1,500
```

预算由共享 `analysisBudget` 对象在 AST 扫描、alias 传播、process API、
dynamic target 和嵌套 dynamic body 之间共享。

预算耗尽：

```text
SCRIPT_ANALYSIS_BUDGET_EXHAUSTED
classification = ERROR
```

预算只报告一次，后续分析停止。深度超过上限返回 `UNKNOWN` 抽象值，调用点
产生 UNKNOWN，不能落为 SAFE。

## 5. Shell 语义

### 5.1 Wrapper

Wrapper 解析继续使用 token 和 option/value 语义表。

新增：

```text
env -S value
env --split-string[=]value
  -> value 二次 tokenization 后重新进入 wrapper 解析

sudo -D / --chdir value
sudo --user / --group / --role / --type value
  -> value 消耗后继续定位真实 executable
```

嵌套 wrapper、路径形式 executable、assignment 和引号边界继续使用同一
resolver。

### 5.2 Here-doc 和 xargs

Here-doc pipeline 增加 xargs 语义：

```text
xargs command
  普通 xargs 参数追加不得自动视为 shell stdin code

xargs -I replacement shell -c payload
  replacement 出现在 shell payload
  -> Here-doc data 可进入代码执行
```

xargs 后的多层 wrapper 通过同一 resolver 定位实际 executable，包括：

```text
xargs -I{} command bash -c '{}'
xargs -I{} env -S 'bash -c "{}"'
```

安全数据消费者如 `xargs ... printf` 保持 data，不产生无理由 UNKNOWN。

### 5.3 不完整语法

Shell 已识别到 `-c` / `/c` / `--command`，但 payload 缺失时：

```text
SCRIPT_UNKNOWN_DYNAMIC_INVOCATION
classification = UNKNOWN
```

## 6. PowerShell 语义

### 6.1 静态值和调用

新增有限静态字符串 evaluator：

- quoted string；
- variable；
- `+` 拼接；
- nested parentheses；
- assignment 顺序更新。

支持：

```powershell
$cmd = 'next'
$arg = 'start'
& $cmd $arg
```

未解析的 Invoke-Expression 参数不再默认 SAFE，而是 UNKNOWN。

### 6.2 ScriptBlock

`[scriptblock]::Create(...)` 使用平衡括号提取，不使用第一个 `)`。

支持：

- static body；
- variable body；
- concatenated body；
- Get-Content / alias source；
- call operator invocation；
- `.Invoke()`；
- ScriptBlock variable 后续 `.Invoke()`。

只构造、不调用的 ScriptBlock 视为数据创建；一旦进入调用入口，则按
DANGEROUS / UNKNOWN 分析。

### 6.3 Custom function / alias

自定义 function body 使用平衡花括号提取。自定义 function 输出进入
`Invoke-Expression` / `iex` 时：

- 已知禁止入口 -> DANGEROUS；
- 文件/动态来源 -> UNKNOWN；
- 无法证明安全 -> UNKNOWN。

Alias provider 支持：

```text
Set-Alias
New-Alias
Set-Item -Path Alias:name
New-Item -Path Alias:name
```

内置 alias、用户 override 和 custom alias target 分开维护。

### 6.4 Encoded command

支持：

```text
pwsh -EncodedCommand <base64>
powershell -ec <base64>
```

解码不执行：

- UTF-16LE PowerShell payload；
- UTF-8 静态 payload。

解码结果递归进入 Scanner。无效、空或超过嵌套上限的 payload -> UNKNOWN。

### 6.5 完整性

PowerShell structure scanner 检查：

- `()`；
- `{}`；
- 单/双引号；
- 反引号；
- 行注释；
- Here-string body 排除。

结构不完整：

```text
SCRIPT_POWERSHELL_SYNTAX_INCOMPLETE
classification = ERROR
```

## 7. CMD / BAT

CMD/BAT 实现不变，继续回归：

```text
IF / FOR DO
CALL / START
cmd /c
%VAR% / !VAR!
%1 / %*
nested block
goto label
echo data
```

## 8. A7.10 整改映射

| A7.10 Finding | A7.11 Control |
| -- | -- |
| JS LogicalExpression | potential-source merge |
| JS conditional assignment | branch state clone/merge |
| JS logical assignment | compound assignment merge |
| JS array/object mutation | target state update |
| JS `.at()` | array read abstract operation |
| JS Reflect method alias | REFLECT abstract value |
| JS depth SAFE | depth -> UNKNOWN |
| JS complexity | shared budget -> ERROR |
| Shell `env -S` | split-string token expansion |
| Shell sudo option | option/value table |
| Here-doc xargs | replacement-aware stdin semantics |
| Shell incomplete | UNKNOWN |
| PowerShell static call | static string/operator propagation |
| PowerShell ScriptBlock flow | balanced extraction + invocation state |
| PowerShell custom function | body/context analysis |
| Alias provider | override/target state |
| Encoded command | safe decode + recursive scan |
| PowerShell incomplete | ERROR |
| xargs safe false positive | data-consumer preservation |
| Set-Item safe false positive | alias override state |

## 9. 测试与安全回归

新增测试必须覆盖：

- A7.8 十二类已知 P1；
- A7.10 全部 P1/P2；
- expression / mutation / Reflect；
- 预算耗尽 -> ERROR；
- Shell split-string / xargs / incomplete；
- PowerShell static flow / ScriptBlock / alias / encoded / syntax；
- 各语言安全负样例；
- 历史 A7.4-A7.9 测试。

Build Preflight、Builder zero-call、A4、A6、Manifest、Legacy Artifact reuse
和 Storage capability 保持不变。

## 10. 完成边界

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
