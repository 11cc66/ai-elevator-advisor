# P1-3 C-6.2-L8-A7.3 Startup Scanner & Build Preflight Security Remediation Design

## 1. 文档信息

- 阶段：`C-6.2-L8-A7.3`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 设计状态：`IMPLEMENTED / TESTED`

## 2. 目标

修复 A7.2 的两个 P1：

1. 多类型脚本扫描仍漏报条件块、嵌套块、动态 require、计算属性和
   可推导路径组合。
2. HEAD 固定必选文件读取失败没有使 `head.complete=false`，Build
   Preflight 仍可能通过。

## 3. 扫描结果模型

脚本扫描结果使用：

```text
DANGEROUS
  明确发现禁止的启动或执行行为。

UNKNOWN
  存在无法可靠静态分析的执行路径。

ERROR
  解析、读取、枚举或必要步骤失败。

SAFE
  仅表示已执行全部必要分析，且未发现上述问题。
```

以下情况不能为 SAFE：

- 文件读取失败；
- AST / 轻量语法分析失败；
- 动态执行无法推导；
- 枚举不完整；
- 必需扫描步骤没有执行。

## 4. JavaScript / TypeScript AST

### 4.1 技术选择

复用项目已有：

```text
typescript@5.9.3
```

`@elevator/build-integrity` 将其声明为依赖。

JavaScript / TypeScript 使用 TypeScript Compiler API：

```text
ts.createSourceFile
ts.forEachChild
```

不再使用旧的 JavaScript 文本正则作为正式判定路径。

### 4.2 绑定分析

识别：

- named import；
- namespace import；
- default import；
- CommonJS require；
- destructured require；
- import alias；
- require alias；
- process function alias；
- child_process namespace；
- `await import(...)` async binding；
- `.then(({ exec }) => ...)` callback binding；
- path namespace。

### 4.3 值分析

支持推导：

- string literal；
- no-substitution template literal；
- template with constant interpolation；
- constant `+`；
- array literal；
- spread 后的部分数组；
- identifier constant；
- `path.join(...)`；
- `path.resolve(...)`；
- `path["join"]` / `path["resolve"]`；
- `process.execPath` identity。

不能推导的值保持 unknown，不得伪装为安全字符串。

### 4.4 执行 API

识别：

- spawn；
- spawnSync；
- exec；
- execSync；
- execFile；
- execFileSync；
- fork；
- 点属性；
- 括号属性；
- require 返回值的属性；
- namespace alias；
- function alias。

对已知 child-process API：

- 已知 `next start`、Worker dist、Worker entry 返回 DANGEROUS；
- 命令或必要参数无法推导时返回 UNKNOWN；
- 完全可推导的无关命令保持 SAFE。

### 4.5 包装函数

函数声明、函数表达式和箭头函数建立静态调用表。

调用包装函数时：

- 将调用参数推导结果注入函数环境；
- 递归扫描函数体；
- 设置活动函数集合防止递归失控；
- 未调用的动态包装函数仍以 UNKNOWN 处理。

### 4.6 动态模块

- 非字面量 `import(expr)` -> UNKNOWN；
- 非字面量 `require(expr)` -> UNKNOWN；
- literal Worker entry import/require -> DANGEROUS；
- static import / export / re-export Worker entry -> DANGEROUS。

## 5. Shell 结构扫描

Shell 使用轻量结构扫描：

- 引号感知的分段；
- 命令分隔符；
- `then` / `do` / `else` 命令块；
- `()` subshell；
- `{}` group；
- `$(...)` command substitution；
- backtick command substitution；
- `sh/bash/zsh/dash -c`；
- literal `eval`；
- 变量；
- alias；
- 无法解析的动态命令。

以下 A7.2 输入必须返回 DANGEROUS：

```sh
if [ -f .next ]; then next start; fi
(next start)
echo "$(next start)"
eval "next start"
```

## 6. PowerShell 结构扫描

扫描：

- if / elseif / else；
- 嵌套 ScriptBlock；
- `Invoke-Command -ScriptBlock`；
- `Start-Process`；
- `Invoke-Expression` / `iex`；
- `&`；
- `cmd /c`；
- 变量；
- alias；
- 动态脚本块。

ScriptBlock 和条件块边界通过引号感知命令分段递归处理。

## 7. CMD / BAT 结构扫描

扫描：

- `if`；
- `for ... do`；
- `CALL`；
- `START`；
- `cmd /c`；
- `%VAR%`；
- `!VAR!`；
- DOSKEY alias；
- 括号块；
- 动态命令。

## 8. HEAD 完整性

### 8.1 HEAD 路径清单

使用只读：

```text
git ls-tree -r -z HEAD
```

获取完整 tracked path inventory。

从完整 inventory：

- 检查固定 `REQUIRED_FILES` 是否存在；
- 派生额外脚本清单；
- 拒绝脚本根中的 Symlink/Junction。

### 8.2 Required File 状态

| 状态 | head.complete | Build |
| -- | -- | -- |
| HEAD 普通安全 FAIL，但全部必选文件存在且可读 | true | 可以继续评估工作树 |
| HEAD 必选文件缺失 | false | BLOCKED |
| HEAD 必选文件读取失败 | false | BLOCKED |
| HEAD 必选文件解析失败 | false | BLOCKED |
| HEAD 额外脚本读取/枚举失败 | false | BLOCKED |

### 8.3 解析失败

- package JSON parse error；
- required JS/TS source parse error；

均添加：

```text
HEAD_REQUIRED_FILE_PARSE_FAILED
```

并设置 `head.complete=false`。

## 9. Build Preflight

`runBuildSecurityPreflight()` 顺序：

```text
inspect worktree + HEAD
  -> require head.complete
  -> require worktree.status=PASS
  -> validate write paths and ancestors
  -> reject legacy/existing targets
  -> return report
```

任何 HEAD completeness failure：

```text
BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE
```

builder 调用次数必须为 0。

HEAD 普通安全 FAIL 但 complete=true 时，仍允许安全 worktree 评估，以支持
提交前验证。

## 10. 测试设计

新增/扩展：

- A7.2 全部失败样例；
- Shell/PowerShell/CMD 嵌套块；
- JS AST import/require/alias/bracket/path.join/fork/wrapper；
- parse error；
- known safe child-process；
- HEAD 必选文件 missing/null/throw/parse；
- HEAD 完整但旧入口 FAIL；
- worktree gate FAIL；
- builder zero-call；
- reparse；
- builder failure no continuation。

测试使用 Mock、内存输入和 `mkdtemp`。

## 11. 能力边界

AST 仍不是完整 interprocedural data-flow 证明；Shell/PowerShell/CMD
使用轻量结构扫描，不是语言完整 parser。

对于无法确定的执行：

- 输出 UNKNOWN；
- UNKNOWN 使正式有效扫描为 FAIL；
- 不降低门禁来消除误报。

## 12. 设计门禁

```text
P1-1:
IMPLEMENTED / TESTED

P1-2:
IMPLEMENTED / TESTED

Real Build:
NOT EXECUTED

Next Phase:
NOT AUTHORIZED
```
