# P1-3 C-6.2-L8-A7.13 Dynamic Value Propagation & Strict Execution Input Validation Design

## 1. 文档信息

- 阶段：`C-6.2-L8-A7.13`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- A7.12 报告：`docs/architecture/file-lifecycle-p13-c6-2-l8a7-12-review.md`
- A7.12 Report SHA-256：
  `62EB708B834B2EEDF986C125B6FCE33113323AB719A33E6A267F9B968551C204`
- 设计状态：`IMPLEMENTED / TESTED`

## 2. A7.12 六项 P1 根因

### 2.1 Dynamic computed object read

对象 abstract value 已有 `properties Map`，但 dynamic key 为 null 时直接返回
null。调用方随后把结果解释为 SAFE，丢失对象内 `cp.spawn` 候选。

### 2.2 Dynamic object destructuring

Binding pattern 和 assignment pattern 只处理 identifier/string property。
ComputedPropertyName 不含可直接读取的静态属性名时被跳过，导致目标变量
没有危险来源。

### 2.3 Dynamic array index crash

部分 array abstract value 只有 `values` 或结构不完整；process API 遍历直接
假定 `elements` 可迭代，触发 `TypeError: candidates is not iterable`。

同时所有 collection candidate 遍历缺少统一结构不变量。

### 2.4 Unknown call target

未知 runtime expression 被存为 SAFE/data，调用时没有形成 UNKNOWN。
`process.env`、unknown function return 和 unresolved assignment 没有统一
的 unknown 值传播。

### 2.5 PowerShell ScriptBlock identity

ScriptBlock 只跟踪直接 Create assignment。调用检测在变量展开后执行：

```powershell
& $script
```

被展开为 `& [scriptblock]::Create(...)`，丢失 `$script` 身份。Alias、函数返回、
数组、对象、参数和全局作用域没有统一 identity 模型。

### 2.6 Loose Base64

`Buffer.from(value, "base64")` 接受非法输入并返回非空数据。只要解码文本没有
命中危险关键词，就会错误返回 SAFE。

## 3. JavaScript 动态值模型

### 3.1 Candidate merging

动态 object read：

1. 静态 property key -> 精确属性读取；
2. dynamic key -> 合并所有 properties；
3. process / dynamic / reflect 候选优先返回；
4. 任一候选 UNKNOWN -> UNKNOWN；
5. 仅有安全 callable 候选 -> 保留安全函数；
6. 无可调用安全候选 -> 交给未知值规则。

动态 array read：

1. 静态 index -> 对应元素；
2. dynamic index -> 合并所有 elements；
3. dangerous candidate 优先；
4. elementsUnknown -> UNKNOWN；
5. elements 非数组 -> UNKNOWN/ERROR，不能抛异常。

### 3.2 Destructuring

支持：

- object binding pattern；
- computed property；
- nested destructuring；
- default initializer；
- multiple properties；
- destructuring assignment；
- alias / parameter / return propagation。

Computed key 无法静态求值时使用 object candidate merge。

### 3.3 Unknown callable

新增 unresolved runtime value 识别：

- CallExpression；
- NewExpression；
- PropertyAccessExpression；
- ElementAccessExpression；
- AwaitExpression；
- YieldExpression。

变量声明、重新赋值和函数参数在无法形成 alias/constant 时传播 UNKNOWN。
`process.env` 明确产生 UNKNOWN。

调用 UNKNOWN target 产生：

```text
SCRIPT_UNKNOWN_DYNAMIC_INVOCATION
classification = UNKNOWN
```

### 3.4 Exception safety

所有 candidate 集合先经过 array/Map 校验。

公开入口 `scanAuxiliaryScript()` 捕获内部异常并产生：

```text
SCRIPT_SCANNER_INTERNAL_ERROR
classification = ERROR
```

异常不会变成 SAFE，也不会逃逸为未处理异常。

## 4. PowerShell ScriptBlock Identity

新增 ScriptBlock identity map：

```text
variable/object/array path -> next-start | worker-dist | safe | unknown
```

支持：

- direct Create；
- variable assignment；
- re-assignment kill/gen；
- alias assignment；
- function return；
- function parameter；
- global captured ScriptBlock；
- array element；
- object property；
- call operator；
- `.Invoke()`。

调用检测在变量展开前保留原始 `$name` 路径。

安全 ScriptBlock 保持 SAFE；未知 identity 产生 UNKNOWN。

## 5. Strict EncodedCommand

### 5.1 Syntax

支持：

```text
-EncodedCommand
-ec
-e
```

### 5.2 Validation

Base64 必须满足：

- 非空；
- 长度为 4 的倍数；
- 仅允许 Base64 alphabet；
- `=` 只出现在末尾且最多两个；
- canonical re-encode 与输入完全一致；
- 解码结果非空；
- UTF-16LE 长度必须为偶数；
- UTF-8 必须通过 fatal decoder；
- 拒绝 replacement character 和非预期控制内容。

### 5.3 Analysis

静态解码后递归进入 PowerShell Scanner。

```text
DANGEROUS body -> DANGEROUS
UNKNOWN body -> UNKNOWN
Incomplete body -> ERROR
Safe body -> SAFE
Invalid encoding -> UNKNOWN
```

不启动 PowerShell、不执行解码内容。

## 6. 跨语言判定

```text
SAFE
  已完整分析，没有危险或未知路径

DANGEROUS
  确认存在禁止执行路径

UNKNOWN
  候选、身份或执行语义无法完整确定

ERROR
  解析失败、内部异常或资源预算耗尽
```

UNKNOWN / ERROR 继续由 Preflight fail-closed。

## 7. 资源预算

保留：

```text
maxAstNodes:       100,000
maxAbstractStates: 100,000
maxDepth:          32
maxMilliseconds:   1,500
```

新增测试：

- dynamic object merge；
- dynamic array index；
- nested unknown propagation；
- long ScriptBlock alias chain；
- strict encoded command；
- malformed inputs；
- internal exception mapping。

## 8. 测试要求

必须覆盖：

- A7.12 六项 P1；
- A7.8 已知 P1；
- A7.11 资源预算；
- dynamic object safe/dangerous mixed；
- dynamic destructuring safe/dangerous；
- unknown call target；
- ScriptBlock variable/alias/function/array/object/parameter；
- valid/invalid/safe/dangerous encoded commands；
- Builder zero-call for UNKNOWN, ERROR and internal exception；
- A7.3/A4/A6/Manifest/Storage 回归。

## 9. 完成边界

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
