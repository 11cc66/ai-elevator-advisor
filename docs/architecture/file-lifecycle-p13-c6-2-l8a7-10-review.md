# P1-3 C-6.2-L8-A7.10 Independent Adversarial Scanner & Build Preflight Security Review

## 1. 最终结论

- 阶段：`C-6.2-L8-A7.10`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 总体结论：`FAIL`
- Commit Authorization：`NOT GRANTED`
- Next Phase：`NOT AUTHORIZED`

A7.8 已知 P1 样例在当前工作树中确实已经修复。A7.3 Build
Preflight、A4 Web/Worker Gate、A6 Build Integrity、Signed Manifest、
Legacy Artifact reuse 防护和 Storage delete capability 也未发现回归。

但独立组合测试确认 A7.9 仍有多条真实危险执行路径被判定为 `SAFE`：

- JavaScript logical selection、条件赋值、数组/对象属性重赋值和
  `Reflect.apply` 方法别名；
- Shell `env -S`、`sudo --chdir` 和 Here-doc → `xargs -I` → Shell；
- PowerShell 静态字符串/变量传播、Get-Content → ScriptBlock、
  ScriptBlock 返回后 `.Invoke()`、自定义 `gc` function 和 encoded command；
- 超过数组分析深度后，危险值被静默降级为 SAFE；16 层嵌套输入耗时约
  18.5 秒，存在明显复杂度放大。

任意真实危险执行路径返回 SAFE 已满足本阶段 FAIL 条件。

## 2. 审查范围与基线

### 2.1 Git 基线

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

工作树继续保持 A7.9 的大量跨阶段未提交修改。本轮没有覆盖、恢复、
暂存或提交任何文件。

### 2.2 A7.9 文档与关键文件哈希

```text
docs/architecture/file-lifecycle-p13-c6-2-l8a7-9-design.md
61FB756935DE3C16F44A0F15963C680194B800C4C86AA1EE96553F9260534D14

docs/architecture/file-lifecycle-p13-c6-2-l8a7-9-report.md
24A82327BC4345004752C38B47F36087387DBBBB5937B7D82696B581A64533C3

docs/architecture/file-lifecycle-p13-implementation-status.md
3884649A195F502C6BB24DF2758B9BAB3FDC1A9A1A16AD149B8D5141D5B3A702

packages/build-integrity/src/script-security.mjs
CBBEB3DA335240F044623F363F83307C5402669F8E40149903CD0403D7DF37A8

packages/build-integrity/src/startup-security.mjs
B6F4DC33B50CF755DC74D47B8FC819C40964A9553D44D420DEE1A62AAF137DB4

apps/web/tests/p13-startup-preflight.test.ts
854E3F76A5C947A4C65E93B358CCBC035FA4C5BA6288D25E12A39A80C85381C6
```

三项 A7.9 文档哈希与 A7.9 交付时一致，当前 Scanner 文件和测试文件
哈希也与 A7.9 报告一致。

### 2.3 实际调用入口

为了让本轮直接读取当前源码而不是依赖旧构建产物，独立样例直接导入：

```text
packages/build-integrity/src/script-security.mjs
  -> scanAuxiliaryScript()
```

该入口就是 `startup-security.mjs` 扫描 Worktree/HEAD 脚本时使用的正式
Scanner 入口。测试没有执行被扫描代码。

## 3. A7.8 已知 P1 复测

| ID | 输入类别 | 预期 | 实际 |
| -- | -- | -- | -- |
| A78-JS-reassign | `run=cp.spawn` 后调用 | DANGEROUS | DANGEROUS |
| A78-JS-array | 数组解构 `[cp.spawn]` | DANGEROUS | DANGEROUS |
| A78-JS-nested-array | 两层 `[[cp.spawn]]` | DANGEROUS | DANGEROUS |
| A78-JS-conditional | ConditionalExpression 选 `cp.spawn` | DANGEROUS | DANGEROUS |
| A78-JS-reflect | 直接 `Reflect.apply(cp.spawn,...)` | DANGEROUS | DANGEROUS |
| A78-SH-command | `command -p bash -c ...` | DANGEROUS | DANGEROUS |
| A78-SH-exec | `exec -a app bash -c ...` | DANGEROUS | DANGEROUS |
| A78-SH-nice | `nice -n 5 bash -c ...` | DANGEROUS | DANGEROUS |
| A78-SH-stdbuf | `stdbuf -oL bash -c ...` | DANGEROUS | DANGEROUS |
| A78-SH-heredoc | `cat` → nested `cat \| sh` | DANGEROUS | DANGEROUS |
| A78-PS-herestring | 双引号 Here-string `$()` | DANGEROUS | DANGEROUS |
| A78-PS-gc | `gc` → Invoke-Expression | UNKNOWN | UNKNOWN |

结论：

```text
A7.8 已知 P1 样例:
PASS / FIXED
```

这只是对 A7.8 样例的回归通过，不能抵消本轮组合缺陷。

## 4. JavaScript / TypeScript 独立对抗矩阵

### 4.1 语法与数据流结果

| ID | 输入类别 | 预期 | 实际 |
| -- | -- | -- | -- |
| JS-01 | `safe \|\| cp.spawn` | DANGEROUS/UNKNOWN | **SAFE** |
| JS-02 | `safe ?? cp.spawn` | DANGEROUS/UNKNOWN | **SAFE** |
| JS-03 | `arr[0]=cp.spawn; arr[0](...)` | DANGEROUS/UNKNOWN | **SAFE** |
| JS-04 | `obj.run=cp.spawn; obj.run(...)` | DANGEROUS/UNKNOWN | **SAFE** |
| JS-05 | `({run}={run:cp.spawn})` | DANGEROUS | DANGEROUS |
| JS-06 | `const invoke=Reflect.apply; invoke(cp.spawn,...)` | DANGEROUS/UNKNOWN | **SAFE** |
| JS-07 | `cp.spawn?.(...)` | DANGEROUS | DANGEROUS |
| JS-08 | loop 后调用已赋值 `cp.spawn` | DANGEROUS | DANGEROUS |
| JS-09 | 条件赋值 `flag ? run=cp.spawn : run=safe` | DANGEROUS/UNKNOWN | **SAFE** |
| JS-10 | 逻辑赋值 `run \|\|= cp.spawn` | DANGEROUS/UNKNOWN | **SAFE** |
| JS-11 | `[cp.spawn].at(0)(...)` | DANGEROUS/UNKNOWN | **SAFE** |
| JS-12 | object/array 混合属性重赋值 | DANGEROUS/UNKNOWN | **SAFE** |
| JS-13 | wrapper 返回 `safe \|\| cp.spawn` | DANGEROUS/UNKNOWN | **SAFE** |
| JS-14 | 安全 logical selection | SAFE | SAFE |
| JS-15 | 安全 array property `.map()` | SAFE | SAFE |
| JS-16 | 安全对象方法 `Reflect.apply` | SAFE | SAFE |
| JS-17 | parse error | ERROR | ERROR |

### 4.2 根因证据

`directAliasForExpression()` 只处理逗号 BinaryExpression，不处理
`LogicalExpression` / `LogicalAssignment`：

```text
script-security.mjs:2963
```

赋值状态只接受 Identifier、ArrayLiteralExpression 和
ObjectLiteralExpression；ElementAccessExpression 与
PropertyAccessExpression 的后续 mutation 不进入环境：

```text
script-security.mjs:3315
script-security.mjs:3384
```

Reflect 分析只接受 callee 的直接 Reflect namespace：

```text
script-security.mjs:3591
```

因此 `const invoke=Reflect.apply` 不会被当作高阶调用入口。

### 4.3 分析与资源边界

| 深度 | 输入 | 预期 | 实际 |
| -- | -- | -- | -- |
| 7 | 7 层数组含 `cp.spawn` | DANGEROUS | DANGEROUS |
| 8 | 8 层数组含 `cp.spawn` | DANGEROUS | DANGEROUS |
| 9 | 9 层数组含 `cp.spawn` | UNKNOWN/ERROR | **SAFE** |
| 10 | 10 层数组含 `cp.spawn` | UNKNOWN/ERROR | **SAFE** |
| 12 | 12 层数组含 `cp.spawn` | UNKNOWN/ERROR | **SAFE** |
| 16 | 16 层数组含 `cp.spawn` | UNKNOWN/ERROR | **SAFE** |

耗时：

```text
depth 9:   11.67 ms
depth 10:  35.76 ms
depth 12: 230.73 ms
depth 16: 18520.14 ms
```

深度超过静态传播上限后，抽象值变成 null，变量随后被记为 SAFE；没有
产生 UNKNOWN。16 层输入约 200 bytes，却出现明显超线性增长，存在
资源消耗和错误降级问题。

其他资源样例：

```text
20,000-element safe array:
108,933 bytes / 113.57 ms / no finding

500,022-byte safe text/comment:
6.90 ms / no finding

12-level wrapper function chain:
DANGEROUS + UNKNOWN / 6.68 ms

20-level array literal:
TypeScript parse ERROR / fail-closed
```

未观察到 Scanner 抛异常或无限递归，但深度边界与复杂度放大本身是 P1。

## 5. Shell 独立对抗矩阵

### 5.1 结果

| ID | 输入类别 | 预期 | 实际 |
| -- | -- | -- | -- |
| SH-01 | `env -S 'bash -c ...'` | DANGEROUS/UNKNOWN | **SAFE** |
| SH-02 | `env --split-string='bash -c ...'` | DANGEROUS/UNKNOWN | **SAFE** |
| SH-03 | `sudo --chdir /tmp bash -c ...` | DANGEROUS/UNKNOWN | **SAFE** |
| SH-04 | Here-doc → `xargs -I{} bash -c '{}'` | DANGEROUS/UNKNOWN | **SAFE** |
| SH-05 | multi-wrapper command→exec→env→nice→stdbuf→bash | DANGEROUS | DANGEROUS |
| SH-06 | `bash -c` 缺少 payload | UNKNOWN/ERROR | **SAFE** |
| SH-07 | nested command substitution + eval | UNKNOWN | UNKNOWN |
| SH-08 | 安全 echo wrapper 字符串 | SAFE | SAFE |
| SH-09 | 安全 Here-doc → xargs → printf | SAFE | UNKNOWN |
| SH-10 | powershell `-Command "next start"` | DANGEROUS | DANGEROUS |
| SH-11 | `pwsh -EncodedCommand ...` | UNKNOWN/DANGEROUS | **SAFE** |

### 5.2 根因证据

`wrapperExecutableFromTokens()` 只处理已知 option 和 value 数量：

```text
script-security.mjs:496
```

`env -S` / `--split-string` 被普通 `env` option 跳过，但其参数包含需要
再次 token/quote 解析的实际命令，当前实现没有展开。

`sudo --chdir` 未在 `takeOptionValue` 中，当前实现跳过 `--chdir` 后把
目录当成 executable，真正的 `bash` 不再分析。

Here-doc pipeline 中 xargs 被标记为不转发 stdin：

```text
script-security.mjs:833
script-security.mjs:851
```

对 `xargs -I{} bash -c '{}'`，stdin 内容经 placeholder 替换后进入
`bash -c`，实际发生代码执行，但当前被判定为 data。

`bash -c` 缺少 payload 时没有生成 UNKNOWN；不完整语法被报告为 SAFE。

## 6. PowerShell 独立对抗矩阵

### 6.1 结果

| ID | 输入类别 | 预期 | 实际 |
| -- | -- | -- | -- |
| PS-01 | `$code='next start'; & ([scriptblock]::Create($code))` | DANGEROUS | DANGEROUS |
| PS-02 | `$code='next '+'start'; ...Create($code)` | DANGEROUS/UNKNOWN | **SAFE** |
| PS-03 | direct `Invoke-Expression ('next '+'start')` | DANGEROUS/UNKNOWN | **SAFE** |
| PS-04 | `& ([scriptblock]::Create((gc file -Raw)))` | UNKNOWN/DANGEROUS | **SAFE** |
| PS-05 | `Invoke-Command -ScriptBlock ([scriptblock]::Create((gc file -Raw)))` | UNKNOWN/DANGEROUS | **SAFE** |
| PS-06 | double-quoted Here-string 内 `.Create((gc file -Raw)).Invoke()` | UNKNOWN/DANGEROUS | **SAFE** |
| PS-07 | `gc file \| ForEach-Object { [scriptblock]::Create($_).Invoke() }` | UNKNOWN/DANGEROUS | UNKNOWN |
| PS-08 | `$cmd='next'; $arg='start'; & $cmd $arg` | DANGEROUS | **SAFE** |
| PS-09 | custom `function gc { 'next start' }; gc \| iex` | DANGEROUS/UNKNOWN | **SAFE** |
| PS-10 | `Set-Item Alias:gc ...; gc \| Invoke-Expression` | UNKNOWN 可接受 | UNKNOWN |
| PS-11 | `Invoke-Command -ScriptBlock ([scriptblock]::Create('next '+'start'))` | DANGEROUS/UNKNOWN | **SAFE** |
| PS-12 | unclosed function syntax | UNKNOWN/ERROR | **SAFE** |
| PS-13 | `Write-Host 'next start'` | SAFE | SAFE |
| PS-14 | 单引号 Here-string 内 `$()` | SAFE | SAFE |
| PS-15 | scriptblock literal 仅 Create、不 Invoke | SAFE | SAFE |

### 6.2 根因证据

PowerShell 主要仍是逐行正则与有限变量替换：

```text
script-security.mjs:1194
script-security.mjs:1233
script-security.mjs:1343
script-security.mjs:1366
```

当前只识别 `[scriptblock]::Create(...)` 的直接静态参数，没有建立：

- Create 返回值到 call operator / `.Invoke()` 的结果传播；
- Get-Content / gc 输出到 Create 参数的数据流；
- PowerShell 字符串 `+`、`-f`、`[string]::Concat` 常量传播；
- 自定义 function 调用与调用参数绑定；
- `-EncodedCommand` / `-ec` 缩写形式的 fail-closed。

`PS-08` 直接由已静态赋值的 `$cmd` 和 `$arg` 组成 `& next start`，实际
未产生任何 finding，是基础变量传播缺口。

`PS-12` 的不完整 function 没有 parser diagnostics，因为 PowerShell
Scanner 没有语法完整性检查，因此错误返回 SAFE。

## 7. 漏报、误报、UNKNOWN、ERROR 分类

### 7.1 P1 漏报

| 编号 | 类别 | 影响 |
| -- | -- | -- |
| P1-1 | JS LogicalExpression / logical assignment | 危险函数来源被 SAFE 覆盖 |
| P1-2 | JS condition / array / object mutation | 后续赋值不进入抽象环境 |
| P1-3 | JS Reflect method alias | 高阶动态调用不被识别 |
| P1-4 | JS depth limit | 9 层以上危险数组静默变成 SAFE |
| P1-5 | JS complexity amplification | 16 层约 18.5 秒，可造成扫描阻塞 |
| P1-6 | Shell env -S / sudo option | valid Wrapper 被错误当作数据 |
| P1-7 | Here-doc xargs replacement | stdin 进入 Shell 代码执行但 SAFE |
| P1-8 | PowerShell string/constant propagation | 静态拼接的禁止入口 SAFE |
| P1-9 | PowerShell ScriptBlock source flow | file/Get-Content 到 Create/Invoke SAFE |
| P1-10 | PowerShell custom gc function | 自定义输出进入 iex 但 SAFE |
| P1-11 | Incomplete syntax | Shell/PowerShell 无效语法错误返回 SAFE |
| P1-12 | PowerShell encoded command | encoded dynamic source SAFE |

### 7.2 P2 非阻断问题

- 安全 Here-doc → `xargs ... printf` 被标记 UNKNOWN；虽 fail-closed，
  但说明 xargs stdin 语义覆盖仍不精细。
- `Set-Item Alias:gc` 会按内置 Get-Content 处理并产生 UNKNOWN；安全
  场景出现不必要阻断。
- 当前工作树的 A7.x 测试文件为 untracked，无法通过 Git 提供 A7.8
  到 A7.9 的逐行历史 diff；只能确认当前 55 个测试、无 skip/only/todo，
  且阶段名称与数量与 A7.9 报告一致。

### 7.3 结论

```text
Dangerous -> SAFE:
FOUND

Unknown -> SAFE:
FOUND

Safe -> DANGEROUS:
NOT FOUND

Scanner crash:
NOT FOUND

Scanner timeout:
NOT OBSERVED

Resource amplification:
FOUND
```

## 8. 历史测试回归

本轮未修改测试，直接运行当前工作树：

```text
Web:
24 files / 205 tests PASS

Startup Preflight/Scanner:
55 tests PASS

p13-release-security:
30 tests PASS

Worker:
6 files / 19 tests PASS

file-storage:
2 files / 19 tests PASS
```

检查结果：

```text
skip / only / todo:
NONE FOUND

A7.2 Shell / PowerShell / CMD / JS:
PRESENT

A7.4 / A7.5 / A7.6 / A7.7:
PRESENT

A7.9:
PRESENT

HEAD-only / HEAD read / HEAD parse:
PRESENT

Builder zero-call:
PRESENT

Manifest / Runtime Dependency / Reparse:
PRESENT
```

现有测试和 A7.8 已知 P1 均通过，但未覆盖本轮组合输入。

## 9. TypeScript / Syntax 回归

```text
Web TypeScript:
PASS

Worker TypeScript:
PASS

file-storage TypeScript:
PASS

Build Integrity MJS:
3 files PASS
```

## 10. Build Preflight 与 Gate 回归

### 10.1 测试回归

当前测试继续覆盖：

| 场景 | 结果 |
| -- | -- |
| HEAD required file missing | blocked |
| HEAD required file read fail | blocked |
| HEAD required file parse fail | blocked |
| HEAD inventory fail | blocked |
| Worktree startup gate fail | builder blocked |
| Manifest identity fail | builder 0 calls |
| signing boundary fail | builder 0 calls |
| existing/reparse target | builder 0 calls |
| builder failure | success continuation 0 |

当前实现没有被 A7.9 Scanner 修改破坏，相关测试全部通过。

### 10.2 真实 Startup Security 扫描

```text
Worktree Startup Gate: PASS
HEAD Startup Gate: FAIL
headVsWorktree: DIFFERENT
worktreeComplete: true
headComplete: false
worktreeScriptsEnumerated: 29
headScriptsEnumerated: 8
additionalWorktreeScriptsScanned: 25
worktreeFindings: 0
worktreeUnknowns: 0
```

HEAD FAIL 是当前安全源码尚未提交的预期结果；但 `headComplete=false`
仍会阻止正式 Build。

A4 / A6：

```text
A4 Web Gate: PASS
A4 Worker Gate: PASS
A6 Build Integrity: PASS
Manifest: PASS
Legacy Artifact Reuse Protection: PASS
Storage Delete Capability: UNAVAILABLE
```

没有创建：

```text
apps/web/.p13-releases: ABSENT
apps/web/.p13-build: ABSENT
```

## 11. 受保护文件哈希

```text
apps/web/next-env.d.ts
0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC

apps/web/tsconfig.tsbuildinfo
018C24B24976726C8837E6C70B57DA982DAE635E98C62BC721F3F63AEF7FF777

apps/web/.next/BUILD_ID
06955B147BD0009CD09B566531E3D2BC93B77142582145564E219C1530F9F5A1

apps/worker/dist/index.js
D7DF17BC2CF23A7923527648A98FC5AABB8FD36A21D6A0B24EA92F8C1DE5BBB9

apps/worker/dist/file-maintenance.js
C6B5B0EBD2AD047CF32AE447470B19D2AB02F413DDB33BABF80828A6FEFCABE3

prisma/schema.prisma
78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299

P1-3 Migration
187D82A00DB73CB6F5D79C97DCD6B4FF2E01BD7E5F78BB9E1273D54D8A141479
```

受保护文件未被本轮测试刷新。

## 12. 未解决问题

### P1

- JS logical selection / conditional assignment / object-array mutation；
- JS Reflect method alias；
- JS 深度超限后危险值降级为 SAFE；
- JS 嵌套数组复杂度放大；
- Shell `env -S` / `sudo --chdir` Wrapper；
- Here-doc → xargs placeholder → Shell；
- PowerShell 字符串和变量传播；
- PowerShell Get-Content → ScriptBlock → Invoke；
- PowerShell custom function 输出 → iex；
- Shell/PowerShell 不完整语法返回 SAFE；
- PowerShell encoded command 返回 SAFE。

### P2

- 安全 xargs Here-doc 数据管道返回 UNKNOWN；
- `Set-Item Alias:` 覆盖未进入内置 alias override 表；
- untracked 测试文件无法提供字节级历史 diff。

### 非阻断限制

- PowerShell 文件正文仍未读取；
- 生产 Trust Root、Runtime Identity、Windows ACL 和生产 Evidence 未验证；
- HEAD 安全源码未提交；
- Legacy `.next` / Worker `dist` 仍存在。

## 13. 最终验收字段

```yaml
A7.8 Known P1 Regression: PASS
A7.9 Adversarial Combination Coverage: FAIL
JavaScript/TypeScript Scanner: FAIL
JavaScript Data Flow Boundary: FAIL
JavaScript Resource Complexity: FAIL
Shell Scanner: FAIL
Shell Here-doc Data Flow: FAIL
PowerShell Scanner: FAIL
PowerShell Dynamic Script Source: FAIL
CMD/BAT Regression: PASS
UNKNOWN Fail-Closed: FAIL
Syntax Error Fail-Closed: FAIL
Dangerous Path -> SAFE: FOUND
Scanner Crash: NOT FOUND
Scanner Timeout: NOT OBSERVED
Historical Test Suite: PASS
Skipped/Only/Todo Tests: NONE FOUND
TypeScript: PASS
MJS Syntax: PASS
A7.3 P1-2 Regression: PASS
HEAD Required File Integrity: PASS
Build Preflight: PASS
Builder Zero-Call on Failure: PASS
A4 Web Security: PASS
A4 Worker Security: PASS
A6 Build Integrity: PASS
Manifest Integrity: PASS
Legacy Artifact Reuse: PASS
Storage Delete Capability: PASS / UNAVAILABLE
Worktree Startup Gate: PASS
HEAD Startup Gate: FAIL / EXPECTED BEFORE COMMIT
Database: NOT CONNECTED
Storage: NOT ACCESSED
Real Build: NOT EXECUTED
Legacy Artifact: NOT MOVED / NOT DELETED / NOT EXECUTED
Git Write Operations: NOT EXECUTED
Production Deployment: NOT DEPLOYED
Production Security: NOT VERIFIED
New Cleanup: NOT ENABLED
Commit Authorization: NOT GRANTED
Next Phase: NOT AUTHORIZED
```

## 14. 审查后状态

```text
C-6.2-L8-A7.10:
FAIL

Implementation Status:
NOT UPDATED / PENDING HUMAN REVIEW

Recommended Next Action:
FIX ALL P1 FINDINGS, THEN RUN A NEW INDEPENDENT REVIEW

Git Write:
NOT EXECUTED

Next Phase:
NOT AUTHORIZED
```

本报告 SHA-256 在最终交付消息中提供。
