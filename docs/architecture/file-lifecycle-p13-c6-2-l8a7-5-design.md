# P1-3 C-6.2-L8-A7.5 Multi-Language Scanner Semantic Analysis Remediation Design

## 1. 文档信息

- 阶段：`C-6.2-L8-A7.5`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 设计状态：`IMPLEMENTED / TESTED`

## 2. 目标

修复 A7.4 独立复审发现的问题：

- JS `eval` / `Function` 动态执行漏报；
- process method `.bind()` 和计算属性别名漏报；
- Shell unresolved exec、嵌套 `-c`、eval substitution 漏报；
- Shell echo / Here-doc 普通数据误报；
- PowerShell Here-string 普通数据误报。

保持 A7.3 已通过的 HEAD 完整性与 Build Preflight 语义不变。

## 3. JavaScript / TypeScript 语义分析

### 3.1 动态执行入口

新增解析：

- global `eval`；
- global `Function`；
- `globalThis.eval` / `Function`；
- indirect eval `(0, eval)`；
- eval / Function alias；
- `.call()` / `.apply()`。

规则：

- 静态字符串 body 递归进入 TypeScript AST 扫描；
- body 不可推导 -> UNKNOWN；
- body 可推导但包含禁止调用 -> DANGEROUS；
- 递归深度上限 8；
- 相同动态 body 防止循环；
- 超出深度 -> UNKNOWN。

### 3.2 Scope shadowing

扫描器在判定 global `eval` / `Function` 前，检查当前节点到 SourceFile 的
作用域：

- parameter；
- function declaration；
- variable binding；
- object/array binding pattern。

本地同名函数或变量不会被误认为 global dynamic API。

### 3.3 bind / call / apply

process API alias 计算支持：

```javascript
const run = cp["spawn"];
const bound = cp["spawn"].bind(cp);
cp.spawn.call(cp, "next", ["start"]);
cp.spawn.apply(cp, ["next", ["start"]]);
```

bind 保留原 process API 语义。call/apply 根据其参数位置恢复真实调用参数。

### 3.4 常量与别名传播

固定迭代最多 8 轮，直到 alias / constant map 稳定。

支持：

- string；
- template；
- nested array flatten；
- spread 的 partial array；
- path.join/resolve；
- process alias；
- method alias；
- computed alias。

无法静态确定时产生 UNKNOWN，不返回 SAFE。

## 4. Shell Scanner

### 4.1 命令上下文

Shell wrapper 只从命令开始位置识别：

```sh
bash -c '...'
sh -c '...'
eval '...'
```

`echo 'bash -c "next start"'` 中的字符串不进入执行内容。

### 4.2 嵌套执行

执行内容递归分析：

- `bash -c 'bash -c "next start"'`；
- command substitution；
- backtick；
- eval；
- 多层 wrapper。

无法解析的 exec/command/source/xargs 目标 -> UNKNOWN。

### 4.3 Here-doc

新增行级词法状态：

- `<<EOF`；
- `<<'EOF'`；
- `<<"EOF"`；
- `<<-EOF`；
- 多行 body；
- 结束 delimiter；
- 未闭合 Here-doc。

普通命令：

```sh
cat <<EOF
next start
EOF
```

body 作为数据，不扫描为命令。

执行入口：

```sh
bash <<EOF
next start
EOF
```

body 进入实际执行扫描。

未闭合或无法确定 Here-doc delimiter -> UNKNOWN。

## 5. PowerShell Scanner

### 5.1 Here-string

新增：

- `@' ... '@`；
- `@" ... "@`；
- assignment；
- standalone pipeline；
- Write-Host；
- 普通函数；
- Invoke-Expression / Invoke-Command；
- 未闭合。

规则：

- 数据正文默认不扫描；
- Here-string 绑定到变量并在后续执行入口使用，则分析静态内容；
- double-quoted Here-string 含动态变量时 -> UNKNOWN；
- unclosed -> UNKNOWN。

### 5.2 ScriptBlock

保留并回归：

- if/else block；
- nested ScriptBlock；
- Invoke-Command；
- Invoke-Expression；
- `&`；
- Start-Process。

## 6. CMD / BAT

本轮不重写 CMD 结构扫描，仅执行回归：

- IF；
- FOR DO；
- CALL；
- START；
- cmd /c；
- `%VAR%` / `!VAR!`；
- `%1` / `%*`；
- nested block；
- goto label；
- echo。

## 7. 结果语义

```text
DANGEROUS
UNKNOWN
ERROR
SAFE
```

下列情况不能 SAFE：

- dynamic body 未知；
- parse error；
- Here-doc/Here-string 未闭合；
- 不支持脚本类型；
- 必要读取或枚举失败。

## 8. P1-2 保持不变

本轮不修改：

- HEAD required file completeness；
- `head.complete`；
- `BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE`；
- Build target / Reparse 检查；
- builder zero-call 顺序。

## 9. 测试策略

所有测试调用正式 `scanAuxiliaryScript()`，覆盖：

- A7.4 四项 JS 漏报；
- A7.4 三项 Shell 漏报；
- A7.4 三项数据误报；
- multi-level alias/wrapper；
- call/apply；
- scope shadowing；
- nested Here-doc/Here-string；
- unclosed data regions；
- parse error；
- unknown script type。

Build Preflight 使用真实正式入口和故障注入。

## 10. 边界

Scanner 仍不是完整语言运行时：

- 不执行输入代码；
- 不做跨文件完整数据流；
- 不做 OS 命令解析器级模拟；
- 不可证明的路径只能 UNKNOWN。

## 11. 门禁

```text
A7.4 Scanner Findings:
REMEDIATED / TESTED

P1-2:
UNCHANGED / REGRESSION TESTED

Real Build:
NOT EXECUTED

Next Phase:
NOT AUTHORIZED
```
