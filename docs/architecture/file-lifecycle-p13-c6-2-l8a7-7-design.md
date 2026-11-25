# P1-3 C-6.2-L8-A7.7 Scanner Execution Semantics Remediation Design

## 1. 文档信息

- 阶段：`C-6.2-L8-A7.7`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 设计状态：`IMPLEMENTED / TESTED`

## 2. 目标

修复 A7.6 发现的：

- JS/TS 深层别名、对象属性、bind chain、动态执行和 higher-order wrapper；
- Shell 常见 wrapper 参数形式；
- PowerShell 动态脚本来源；
- Shell Here-doc 数据流误报。

保持 HEAD 完整性、Build Preflight、A4/A6/Storage 安全边界不变。

## 3. JavaScript / TypeScript 数据流

### 3.1 抽象值

正式 Scanner 使用有限抽象值：

```text
PROCESS(api)
DYNAMIC(eval|Function)
OBJECT(properties)
FUNCTION(node, captured aliases)
CONSTANT(string|array|path)
UNKNOWN
```

不使用运行时执行。

### 3.2 传播

固定点最多 8 轮：

- identifier alias；
- object destructuring；
- namespace destructuring；
- object property；
- computed property；
- comma expression；
- bind chain；
- process function alias；
- wrapper function；
- function parameter；
- function return；
- closure capture；
- higher-order function return。

### 3.3 Dynamic execution

识别：

- eval / Function；
- indirect eval；
- globalThis property / element；
- bind / call / apply；
- object-held dynamic function；
- tagged template；
- 动态 body 字符串；
- 动态 body 不可推导。

静态 body 继续进入同一 AST 扫描器，最大递归深度 8，并防止循环 body。

### 3.4 作用域

- 参数、局部 function、variable binding 和 destructuring pattern 参与
  shadow check；
- 局部同名 eval / Function / spawn 不自动识别为 global/process；
- 有限静态分析无法确定的调用保持 UNKNOWN。

## 4. Shell Wrapper

### 4.1 Token 解析

Shell command 先进行引号感知 tokenization，再解析 wrapper 参数，不通过
字符串搜索 `bash` / `-c`。

支持：

- bash/sh/zsh/dash；
- `-c`、`-lc`、combined short flags；
- `--command`；
- command / exec / nohup；
- assignment；
- env；
- sudo options；
- timeout duration/options；
- xargs options；
- find `-exec` / `-execdir`；
- PowerShell / CMD wrapper。

无法解析的 payload -> UNKNOWN。

### 4.2 Here-doc 数据流

Here-doc 建立：

```text
data-only body
executed body
unknown body
```

规则：

- cat/echo 等数据消费者：body 为数据；
- shell 从 stdin 执行：body 进入命令扫描；
- `bash -c 'cat'`：body 作为 stdin 数据，不重新解释；
- unknown shell payload：UNKNOWN；
- unclosed Here-doc：UNKNOWN。

## 5. PowerShell

### 5.1 Dynamic source

识别：

- Invoke-Expression；
- Get-Content / Get-Item；
- pipeline into Invoke-Expression；
- scriptblock::Create；
- Invoke-Command -FilePath；
- Invoke-Expression alias；
- dynamic ScriptBlock source。

静态危险内容 -> DANGEROUS。

文件内容、未知路径、动态命令源 -> UNKNOWN。

本轮不递归读取本地脚本文件；对文件执行源采用 fail-closed UNKNOWN。

### 5.2 Here-string / ScriptBlock

保留：

- 单/双引号 Here-string；
- Write-Host 数据区；
- 执行入口中的 Here-string；
- unclosed Here-string；
- nested ScriptBlock；
- Start-Process / `&` / Invoke-Command。

## 6. CMD/BAT

不重写。保留 IF、FOR DO、CALL、START、cmd /c、变量、nested block、
label 和 echo。

## 7. 分析边界

- 静态分析，不执行输入；
- 不建立完整 JavaScript / Shell / PowerShell 语义；
- 跨文件高阶函数、从磁盘加载的 PowerShell 文件、运行时生成代码可为
  UNKNOWN；
- UNKNOWN 阻止正式门禁；
- 普通字符串、注释和数据流保持 SAFE。

## 8. HEAD / Build Preflight

不修改 A7.3 P1-2：

- required file missing/read/parse -> incomplete；
- path enumeration/extra script failure -> incomplete；
- incomplete -> Preflight blocked；
- builder zero-call；
- builder failure no success continuation；
- no legacy Artifact fallback。

## 9. 测试

新增：

- A7.6 全部 JS/Shell/PowerShell 失败样例；
- multi-level HOF / closure；
- bind/call/apply chain；
- object/element dynamic alias；
- Shell wrapper option variants；
- Here-doc stdin data vs code；
- PowerShell dynamic source；
- safe display/string/object/bind negatives。

全部通过正式 `scanAuxiliaryScript()`。

## 10. 门禁

```text
Scanner:
IMPLEMENTED / TESTED

A7.3 P1-2:
UNCHANGED / REGRESSION TESTED

Real Build:
NOT EXECUTED

Next Phase:
NOT AUTHORIZED
```
