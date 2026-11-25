# P1-3 C-6.2-L8-A7.18 PowerShell Finite Semantic Resolver Design

## 1. 文档信息

- 阶段：`C-6.2-L8-A7.18`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 最终设计基线：
  `docs/architecture/file-lifecycle-p13-c6-2-l8a7-17-3-final-closure.md`
- 最终设计 SHA-256：
  `552ADE9CB955FDA5A3CE4BD15824EFC01B9F43BE9E196D0CB960EB0C4F13A20E`
- 实现状态：`IMPLEMENTED / TESTED`
- 独立安全审查：`A7.19 NOT AUTHORIZED`

## 2. 目标与边界

A7.18 在一个 Node-only、有限、保守的 PowerShell 语义解释器中统一处理：

- 变量、scope、函数和 caller chain；
- assignment、分支、return、循环与结构化语句；
- Hashtable、PSCustomObject、Array、property/index mutation；
- ScriptBlock.Create、ScriptBlock literal、Closure；
- 成功输出流、Pipeline 与输出捕获；
- `&`、`.Invoke()`、`Invoke-Command -ScriptBlock` 的统一 invocation
  target resolution；
- 四态安全结果和文件级资源预算。

不启动 PowerShell runtime，不引入第二套 Preflight Scanner，不执行被扫描
代码。完整 PowerShell grammar、module、dot-source、反射和自定义 PSObject
adapter 不在首版范围内；合法但不支持的输入必须为 `UNKNOWN`。

## 3. 模块边界

实现位于：

```text
packages/build-integrity/src/script-security.mjs
```

内部结构：

```text
PowerShell tokenizer
  -> finite statement/expression parser
  -> canonical binding and abstract runtime
  -> path-aware statement interpreter
  -> success-output summary
  -> unified invocation resolver
  -> semantic findings/evaluations
  -> existing Startup Scanner result
  -> existing Build Preflight
```

`startup-security.mjs`、Startup Gate、Manifest、Web/Worker 启动入口和业务代码
均未修改。

## 4. Token 与 Parser

### 4.1 Tokenizer

Tokenizer 识别：

- variable 及 `$global:`、`$script:`、`$local:`；
- string、number、identifier、parameter；
- function/if/switch/try/loop 关键字；
- assignment、`&`、`|`、`::`、property/index/method 标点；
- comment 与结构分隔；
- Here-string、encoded/未支持 token 的显式 unsupported 状态。

Tokenizer 不静默丢弃 unknown token。出现未支持结构时，语义结果标记为
不完整，由兼容回退继续分析。

### 4.2 Parser

Parser 生成有限 AST：

- Program / Block；
- Function / Param / Return / Break / Continue；
- Assignment / Expression；
- If / Switch / Try-Catch-Finally / Loop；
- Variable / Literal / Array / Hashtable / PSCustomObject；
- Member / Index / Method / StaticCall；
- Command / Pipeline / Call Operator / If Expression。

缺失 delimiter、非法 expression 和结构错误为 `ERROR`。合法但未建模的语义为
`UNKNOWN`。

## 5. Abstract Value

### 5.1 Value kinds

```text
SCALAR
SCRIPTBLOCK
OBJECT_REF
ARRAY_REF
CLOSURE
UNKNOWN_VALUE
ERROR
```

`CALLABLE_REF` 在执行期统一解析为 ScriptBlock/Closure/Unknown，不保留可绕过
统一 invocation resolver 的旁路。

### 5.2 Security states

```text
SAFE
DANGEROUS
UNKNOWN
ERROR
```

合并顺序：

```text
ERROR > DANGEROUS > UNKNOWN > SAFE
```

`ERROR` 为 sticky。Value-level UNKNOWN 可以沿同一路径被确定性 safe assignment
覆盖；分析完整性 UNKNOWN 和已经发生的 finding 不会因为后续无关赋值消失。

## 6. Binding、Scope 与分支

### 6.1 Canonical binding

变量和 member 使用固定 case fold。原始拼写保留在 AST/finding 中。

未限定读取顺序：

```text
current local
-> nearest caller function frame
-> outer caller frames
-> script
-> global
```

命中 binding 即停止，即使值为 null、Unknown 或 non-callable。未限定 assignment
只写 current frame。缺失 external/global binding 为 `UNKNOWN_VALUE`。

### 6.2 Kill/gen 与 join

- 同路径确定性 assignment：kill/gen；
- `$target` 与 `$TARGET` 指向同一 binding；
- `if/else/switch`：从 clone state 执行，join 时按 binding union；
- merge 后的 assignment：kill 所有当前可达旧 candidates；
- return/break/continue 路径与原状态分开；
- 已执行 invocation finding 不被后续 assignment 删除。

### 6.3 Runtime clone

Branch clone 保留 frame/binding、object/array location、function table 和共享
预算。Join 对同 locationId 的 property/element 取候选 union，从而保留不同
分支 snapshot。

## 7. Object、Array 与 Comparer

### 7.1 Location

Object/Array 使用 locationId 和 snapshotVersion。`$alias = $obj` 复制同一
objectRef；property/element mutation 对所有 alias 可见。

### 7.2 Hashtable

- 字面量 `@{}` 使用 case-insensitive canonical key；
- 同路径 key 写入为 kill/gen；
- 重复 case-fold key 产生 `ERROR`；
- 未知 comparer/object source 的 member read 为 `UNKNOWN`。

### 7.3 PSCustomObject

- 正常单 member 按 case-insensitive 解析；
- property overwrite 更新同一 location；
- 多个 case 等价 member 或自定义 adapter 无法证明时为 `UNKNOWN`。

## 8. Function Success Output

执行路径维护：

```text
{
  runtime,
  successOutputs,
  flow: normal | return | break | continue | error
}
```

规则：

- bare expression/variable 产生成功输出；
- `return expression` 产生输出并终止当前路径；
- assignment capture 不向外部产生成功输出；
- `Write-Output` 透传；
- `Write-Host`、`Write-Error` 不进入成功流；
- error-to-success 重定向不推断转换，影响 invocation 时为 `UNKNOWN`；
- `Out-Null` 消费成功输出；
- 未知 pipeline transformer 不得返回 SAFE；
- 多路径输出 union，函数返回值为所有正常/return 路径成功输出 union。

## 9. ScriptBlock 与 Closure

### 9.1 ScriptBlock.Create

输入先解析为有限字符串候选集。每个候选进入同一 PowerShell 内容 Scanner：

```text
FINITE_STRING_SET
-> classify each candidate
-> state merge
```

全 SAFE 才得到 SAFE；任何危险候选使整体 DANGEROUS；无法重建为 UNKNOWN；
语法/内部错误为 ERROR。创建本身不产生执行 finding，只有进入 invocation
入口后才记录。

### 9.2 GetNewClosure

`GetNewClosure()` 创建时捕获：

- scalar value；
- ScriptBlock identity；
- ObjectRef/ArrayRef；
- 当前 binding map 与 capture generation。

外部变量重绑定不改变 captured scalar/ScriptBlock；captured ObjectRef/ArrayRef
继续指向原 location，因此后续 property/element mutation 可见。Closure identity
和 capture snapshot 参与后续求值，不复用错误状态。

## 10. Unified Invocation Resolver

以下入口统一调用同一 resolver：

```powershell
& expression
expression.Invoke()
Invoke-Command -ScriptBlock expression
```

Resolver 覆盖：

- variable 和 scope-qualified variable；
- property/index/member path；
- function result 和 parenthesized expression；
- method chain、GetNewClosure；
- object/array alias、branch union；
- scalar command target（仅 call operator）；
- Unknown/Error candidate。

ScriptBlock/Closure 的 body 在独立执行 state 中分析；其成功输出可继续作为
外层 invocation target。任意 DANGEROUS/UNKNOWN/ERROR candidate 不被 safe
candidate 掩盖。

## 11. Cache 与 Resource Budget

### 11.1 Cache

ScriptBlock 静态内容 classification 使用 bounded cache，key 包含：

```text
body digest
expression depth
analysis policy version
```

该缓存只存储与 caller/object state 无关的纯内容分类。Caller-sensitive function、
Closure、environment 和 object snapshot 不使用跨上下文结果缓存，因此不会
错误复用不同 caller、capture generation 或 snapshotVersion。

缓存命中不恢复预算；预算耗尽不能通过缓存或嵌套 body 重置。

### 11.2 Budget

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

每个 PowerShell 文件共享 abstract-state/time budget。深度、状态数、函数深度
或时间耗尽为 `ERROR`。

## 12. Semantic Result 与 Legacy Compatibility

生产 `scanPowerShell()`：

1. 先执行有限语义解释器；
2. 语义完整时，只使用语义 findings；
3. 语义不完整但产生 ERROR finding 时，将其作为 terminal ERROR；
4. 语义不完整且不是 terminal ERROR 时，运行既有 legacy Scanner；
5. legacy findings 与已有 semantic findings 合并，任何一方都不能把
   DANGEROUS/UNKNOWN/ERROR 降级为 SAFE。

这保留旧格式、Here-string 和 encoded command 覆盖，同时确保语义完整的
新路径不再受旧启发式误报影响。Preflight 仍只消费一个最终 Scanner 结果。

## 13. Test-only Semantic Inspection

为验证 Abstract Kind、state 和 target，`script-security.mjs` 提供未通过 package
public export 暴露的：

```text
inspectPowerShellSemantics(relativePath, content, options?)
```

生产 Preflight 不调用该测试接口。专项测试直接进入真实 Scanner 和 Preflight
调用链，并额外读取该纯分析结果。

## 14. 验证设计

专项文件：

```text
apps/web/tests/p13-startup-powershell-resolver.test.ts
```

覆盖：

- FO-01–FO-08；
- ASN-01–ASN-10；
- SC-01–SC-05；
- SBC-01–SBC-06；
- CL-01–CL-06；
- SN-01–SN-05；
- RES-01–RES-03；
- PRE-01–PRE-05；
- A7.16 六个历史和对抗入口。

每项验证 Abstract Kind、Security State、Invocation Target、Preflight 错误码
和 Builder 调用次数。

## 15. 已知边界

- 不运行 PowerShell，不读取真实执行结果；
- module、dot-source、跨文件 function 和反射仍为 UNKNOWN；
- 非预期 pipeline transformer、自定义 comparer/adapter 为 UNKNOWN；
- 循环的重复迭代 state 使用保守 fail-closed，不做完整定点迭代；
- Windows PowerShell 5.1 与 PowerShell 7 差异不做运行时探测；
- A7.18 实现通过不替代 A7.19 独立审查。
