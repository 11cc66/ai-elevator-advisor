# P1-3 C-6.2-L8-A7.9 Cross-Language Execution Semantics Remediation Design

## 1. 文档信息

- 阶段：`C-6.2-L8-A7.9`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- A7.8 报告：`docs/architecture/file-lifecycle-p13-c6-2-l8a7-8-review.md`
- A7.8 Report SHA-256：
  `2DF3BD28E2528C9B2B6E9AF80D4FD6D0574B07A35E44FC46DF9F4B14F7A27572`
- 设计状态：`IMPLEMENTED / TESTED`

## 2. 目标与边界

本阶段只修复 A7.8 确认的跨语言 Startup Security Scanner 执行语义缺陷：

- JavaScript / TypeScript 变量重新赋值、数组传播、条件表达式和
  `Reflect.apply` / `Reflect.construct`；
- Shell `command -p`、`exec -a`、`nice`、`stdbuf` Wrapper；
- Shell Here-doc 经嵌套管道进入 Shell stdin 的二次解释；
- PowerShell 双引号 Here-string `$()` 插值和 `Get-Content` 内置别名。

本阶段不修改 Build Preflight 的失败语义、Prisma Schema、Migration、
Web/Worker Runtime Gate、生产业务代码或历史构建产物。

Scanner 是有限静态分析器，不执行输入，不读取 PowerShell 脚本正文，也不
建立完整程序语义。无法可靠证明安全时必须返回 `UNKNOWN`，并沿现有
fail-closed 路径阻止正式门禁。

## 3. JavaScript / TypeScript 分析模型

### 3.1 抽象值

正式 Scanner 使用以下有限抽象值：

```text
PROCESS(api)
DYNAMIC(eval|Function)
OBJECT(properties)
FUNCTION(node, captured aliases)
ARRAY(elements, constant values, partial)
STRING / EXECUTABLE_PATH
SAFE
UNKNOWN
```

危险来源只来自 `child_process` API、`eval`、`Function` 和已识别的
executable path；普通对象方法、局部同名函数和纯字符串保持安全。

### 3.2 状态更新

- 每个扫描环境从只读常量表的副本建立，避免变量声明覆盖全局常量事实；
- `let` / `var` 和 AssignmentExpression 执行 kill/gen 更新；
- 数组初始化同时保留 element provenance 与常量元素值；
- 解构、数组索引、对象属性、`bind`、`call`、`apply` 和多层 alias 继续
  通过同一抽象值函数传播；
- 静态常量索引直接选择元素；动态索引则保留所有可能元素，来源不明时
  不得降级为 SAFE；
- `if` / `else` 分别在环境副本中执行，再合并潜在来源；危险来源不会被
  安全分支覆盖；
- 函数参数和返回值传播受固定遍历、深度上限和活动函数集合限制，避免
  无限递归。

### 3.3 条件表达式与反射调用

`ConditionalExpression` 分析两个分支。只要任一分支来自危险 API 或动态
执行入口，该表达式不得被单一路径覆盖为 SAFE。

`Reflect.apply` 与 `Reflect.construct` 使用以下规则：

- 参数数组必须可静态解析且非部分未知，否则返回 `UNKNOWN`；
- 目标为 `child_process` API 且参数命中禁止入口时返回 `DANGEROUS`；
- 目标为 `eval` / `Function` 时递归分析参数中的静态 body；
- 普通本地函数不使用禁止启动参数作为启动证据；
- `Reflect` namespace alias 继续生效。

## 4. Shell Wrapper 参数语义

Wrapper 解析按 command token 和参数位置执行，不按关键字存在性判断。
A7.9 新增语义：

| Wrapper | Option semantics | Executable selection |
| -- | -- | -- |
| `command` | `-p`、`-v`、`-V` 为无值 option | 跳过 option 后执行后续命令 |
| `exec` | `-a` / `--argv0` 消耗一个值 | 继续解析实际 executable |
| `nice` | `-n` / `--adjustment` 消耗优先级值 | 继续解析实际 executable |
| `stdbuf` | `-i`、`-o`、`-e` 及 attached form | 跳过缓冲参数后继续解析 |

保留 timeout、sudo、env、xargs、find `-exec` / `-execdir`、assignment、
多层 Shell wrapper 和引号边界。无法解析 payload 时返回 `UNKNOWN`。

## 5. Here-doc stdin 数据流

Here-doc 不再只根据 `bash -c` payload 的第一个词判断数据或代码。分析器将
opening command 与 suffix pipeline 合并为有限 stdin pipeline：

- `cat <<EOF`：数据；
- `bash <<EOF`：Shell 从 stdin 读取代码，执行 body；
- `cat | sh` / `cat | bash`：数据进入 Shell stdin，执行 body；
- `bash -c 'cat'`：cat 将 stdin 复制到 stdout，但不执行，保持数据；
- `bash -c 'cat | sh'`：嵌套 Shell 最终读取 stdin，执行 body；
- 多层 `cat` 后接 Shell：继续追踪；
- 已知数据过滤/消费命令：保持数据路径；
- 未知 pipeline stage：`UNKNOWN`；
- Here-doc 未闭合或同时存在多个 Here-doc：`UNKNOWN`。

分析深度上限为 8，防止递归数据流无限展开。

## 6. PowerShell 语义

### 6.1 双引号 Here-string

单引号 Here-string 保持纯数据。双引号 Here-string 在字符串构造阶段处理
`$()` 子表达式：

- 静态禁止启动入口 -> `DANGEROUS`；
- 动态执行源、未闭合或不可解析子表达式 -> `UNKNOWN`；
- 普通变量插值和普通 pwsh/powershell 表达式不自动升级为危险；
- 输出目标为 `Write-Host` 不取消字符串构造阶段已经发生的执行。

### 6.2 Get-Content 别名

内置别名表至少包括：

```text
gc, cat, type -> Get-Content
gci, dir, ls -> Get-ChildItem
iex -> Invoke-Expression
icm -> Invoke-Command
```

如果脚本通过 `Set-Alias` / `New-Alias` 或函数声明覆盖同名命令，不应用
内置映射。文件内容进入 `Invoke-Expression`、`iex` 或等价执行入口时，
因为 Scanner 不读取文件正文，返回 `UNKNOWN`；普通 `Get-Content` /
别名到 `Write-Host` 保持数据。

## 7. CMD / BAT

本阶段不重写 CMD/BAT Scanner。保留 IF、FOR DO、CALL、START、`cmd /c`、
变量、参数、嵌套块、goto 和 echo 数据回归。

## 8. Build Preflight 与既有安全机制

A7.3 P1-2 语义保持不变：

- HEAD required file missing/read/parse failure -> incomplete；
- HEAD/Worktree inventory failure -> fail closed；
- incomplete HEAD -> `BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE`；
- Preflight failure 时 Builder 调用次数为 0；
- Builder failure 不调用 success continuation；
- Manifest、signature、identity、reparse 检查失败均阻止 Builder；
- 不 fallback 到历史 `.next` / Worker `dist`。

A4 Web/Worker Gate、A6 Build Integrity、Runtime Dependency Digest、
Signed Manifest 和 Storage delete capability `UNAVAILABLE` 均为本阶段的
回归条件。

## 9. 验证策略

新增 A7.9 专属测试，直接通过正式 `scanAuxiliaryScript()` 入口：

- A7.8 全部失败样例；
- JS 数组、嵌套数组、动态索引、重赋值、条件和 Reflect 变体；
- Shell Wrapper option 组合和嵌套；
- Here-doc 数据、嵌套 Shell 与未知 pipeline；
- PowerShell Here-string 插值、别名与覆盖边界；
- 安全对象方法、数组属性、普通 `Reflect` 调用和数据输出负样例。

测试只使用内存输入、Mock 和隔离临时目录，不执行被扫描脚本。

## 10. 完成边界

```text
Scanner:
IMPLEMENTED / TESTED

Build Preflight:
UNCHANGED / REGRESSION TESTED

Real Build:
NOT EXECUTED

Database / Storage:
NOT CONNECTED / NOT ACCESSED

Git Write:
NOT EXECUTED

Next Phase:
NOT AUTHORIZED
```
