# P1-3 C-6.2-L8-A7.9 Cross-Language Execution Semantics Remediation Report

## 1. 最终结论

- 阶段：`C-6.2-L8-A7.9`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 总体结论：`PASS`
- Commit Authorization：`NOT GRANTED`

A7.8 确认的 JavaScript、Shell、Here-doc 和 PowerShell P1 执行语义缺陷
均已修复，并通过正式 Scanner、完整 Web/Worker/file-storage 单元测试、
TypeScript 检查和真实 Worktree/HEAD Startup Security 扫描。

当前结果：

```text
Working Tree Startup Gate:
PASS

HEAD Startup Gate:
FAIL / EXPECTED BEFORE AUTHORIZED COMMIT

Worktree Complete:
true

HEAD Complete:
false / REQUIRED SECURE FILES ABSENT IN HEAD

Current Worktree Findings:
0

Current Worktree UNKNOWN:
0
```

## 2. 审查基线

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

A7.8 Report:
docs/architecture/file-lifecycle-p13-c6-2-l8a7-8-review.md

A7.8 Report SHA-256:
2DF3BD28E2528C9B2B6E9AF80D4FD6D0574B07A35E44FC46DF9F4B14F7A27572
```

A7.8 哈希与任务基线一致。开始时工作树已有大量跨阶段未提交安全和业务
文件；本轮保留全部已有修改，没有执行 Git 写操作。

## 3. 修改文件

本阶段修改：

```text
packages/build-integrity/src/script-security.mjs
apps/web/tests/p13-startup-preflight.test.ts
```

本阶段新增：

```text
docs/architecture/file-lifecycle-p13-c6-2-l8a7-9-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-9-report.md
```

本阶段更新：

```text
docs/architecture/file-lifecycle-p13-implementation-status.md
```

未修改：

- Prisma Schema；
- 任意 Migration；
- Build Preflight 源码；
- Web/Worker Runtime Startup Gate；
- 生产业务代码；
- 历史 `.next` 与 Worker `dist`。

## 4. A7.8 四类根因与修复

### 4.1 JavaScript / TypeScript

根因：

- 赋值环境直接复用全局常量 Map，声明时覆盖了原始常量事实；
- 数组 abstract value 没有同时保留 element provenance 和常量元素值；
- 嵌套数组和普通 array property access 未区分；
- function 参数传播时，数组 alias 覆盖了同一参数的常量值；
- `Reflect.apply` 要求目标别名必须存在，造成普通本地函数误报，同时没有
  按 target 类型区分 process、eval、Function 和普通函数。

修复：

- 扫描环境改为常量表副本；
- AssignmentExpression 更新抽象环境；
- 数组同时传播 elements 与 constant values；
- 静态数组索引选择对应元素，嵌套数组继续传播；
- 动态索引保留潜在危险来源；
- ConditionalExpression 合并两个分支；
- function 参数合并 alias 与 constant abstract value；
- `Reflect.apply` / `Reflect.construct` 先要求参数数组完整可解析；
- process target 检查禁止启动入口；
- eval / Function target 递归分析静态 body；
- 普通本地反射调用不产生启动结论；
- 参数数组未知时返回 `UNKNOWN`。

真实 Worktree 扫描还发现并修复了一个普通属性访问崩溃：

```text
arrayAbstractValue.property
  -> 误读 property-access 不存在的 argumentExpression
```

现在仅 ElementAccessExpression 使用数组下标逻辑；普通数组属性访问保持
安全，并由新增 `.map()` 负样例覆盖。

### 4.2 Shell Wrapper

根因：Wrapper 前缀只跳过 executable 名称，没有解析各命令 option 与值。

修复后的语义：

```text
command -p / -v / -V:
无值 option，继续定位实际 executable

exec -a / --argv0:
消耗一个 argument value，继续定位 executable

nice -n / --adjustment:
消耗优先级值，继续定位 executable

stdbuf -oL / -i mode / -o mode / -e mode:
跳过缓冲 option/value，继续定位 executable
```

保留 env、sudo、timeout、xargs、find `-exec` / `-execdir`、assignment
和多层 wrapper。

### 4.3 Here-doc

根因：旧逻辑只检查 `bash -c` payload 的第一个词，看到 `cat` 就判定数据，
没有继续分析 `cat | sh` 是否把 Here-doc stdin 最终交给 Shell。

修复：

- 建立引号感知的 pipeline stage 解析；
- 识别 shell 是否读取 inherited stdin；
- 区分普通 wrapper 与 xargs/find 的 stdin 语义；
- 递归分析 shell `-c` payload；
- 静态禁止入口仍由命令扫描产生 DANGEROUS；
- 已知数据过滤命令保持数据路径；
- 未知下游消费语义返回 `UNKNOWN`；
- 递归深度上限为 8。

### 4.4 PowerShell

根因：

- Here-string 提取器移除正文时没有分析双引号正文中的 `$()`；
- PowerShell command parser 没有可信内置 alias 表。

修复：

- 双引号 Here-string 在建字符串阶段扫描平衡的 `$()`；
- 静态禁止入口 -> DANGEROUS；
- 动态或未闭合表达式 -> UNKNOWN；
- 单引号 Here-string 保持纯数据；
- 增加 `gc`、`cat`、`type`、`gci`、`dir`、`ls`、`iex`、`icm`
  内置 alias 映射；
- `Set-Alias`、`New-Alias` 和 function declaration 会覆盖内置映射；
- Get-Content / alias 输出进入 Invoke-Expression 时返回 UNKNOWN；
- 输出到 Write-Host 时保持数据。

## 5. JavaScript / TypeScript 对抗矩阵

所有样例通过正式 `scanAuxiliaryScript()`，未执行输入代码。

| ID | 输入类型 | 预期 | 实际 |
| -- | -- | -- | -- |
| JS-01 | `let run=()=>{}; run=cp.spawn` 后调用 | DANGEROUS | DANGEROUS |
| JS-02 | `[cp.spawn][0](...)` | DANGEROUS | DANGEROUS |
| JS-03 | `const [run]=[cp.spawn]` | DANGEROUS | DANGEROUS |
| JS-04 | `[[cp.spawn]][0][0](...)` | DANGEROUS | DANGEROUS |
| JS-05 | `condition ? cp.spawn : safe` | DANGEROUS | DANGEROUS |
| JS-06 | `Reflect.apply(cp.spawn, ...)` | DANGEROUS | DANGEROUS |
| JS-07 | `Reflect.apply(eval, ..., [body])` | DANGEROUS | DANGEROUS |
| JS-08 | `Reflect.construct(Function, [body])` | DANGEROUS | DANGEROUS |
| JS-09 | 动态 Reflect 参数数组 | UNKNOWN | UNKNOWN |
| JS-10 | `Reflect.apply(local.method, ...)` | SAFE | SAFE |
| JS-11 | safe conditional local function | SAFE | SAFE |
| JS-12 | 普通 `values.map(...)` | SAFE / NO CRASH | SAFE |

## 6. Shell 对抗矩阵

| ID | 输入 | 预期 | 实际 |
| -- | -- | -- | -- |
| SH-01 | `command -p bash -c 'next start'` | DANGEROUS | DANGEROUS |
| SH-02 | `exec -a app bash -c 'next start'` | DANGEROUS | DANGEROUS |
| SH-03 | `nice -n 5 bash -c 'next start'` | DANGEROUS | DANGEROUS |
| SH-04 | `stdbuf -oL bash -c 'next start'` | DANGEROUS | DANGEROUS |
| SH-05 | command -> nice -> stdbuf -> bash | DANGEROUS | DANGEROUS |
| SH-06 | `cat <<EOF \| sh` | DANGEROUS | DANGEROUS |
| SH-07 | `cat <<EOF \| bash` | DANGEROUS | DANGEROUS |
| SH-08 | `cat <<EOF \| bash -c 'cat \| sh'` | DANGEROUS | DANGEROUS |
| SH-09 | `cat <<EOF \| bash -c 'cat \| cat \| bash'` | DANGEROUS | DANGEROUS |
| SH-10 | `cat <<EOF \| bash -c 'cat'` | SAFE | SAFE |
| SH-11 | echo 展示 `bash -c "next start"` | SAFE | SAFE |
| SH-12 | 动态未知 Here-doc pipeline | UNKNOWN | UNKNOWN |

## 7. PowerShell 对抗矩阵

| ID | 输入 | 预期 | 实际 |
| -- | -- | -- | -- |
| PS-01 | 双引号 Here-string `$(next start)` | DANGEROUS | DANGEROUS |
| PS-02 | 双引号 Here-string `$(& { next start })` | DANGEROUS | DANGEROUS |
| PS-03 | `gc .\release.ps1 \| Invoke-Expression` | UNKNOWN | UNKNOWN |
| PS-04 | `cat .\release.ps1 \| iex` | UNKNOWN | UNKNOWN |
| PS-05 | `gc .\release.ps1 \| Write-Host` | SAFE | SAFE |
| PS-06 | `Get-Content .\release.ps1 \| Write-Host` | SAFE | SAFE |
| PS-07 | 单引号 Here-string 含 `$(next start)` | SAFE | SAFE |
| PS-08 | 用户定义同名 alias/function | 不套用内置映射 | TESTED |

## 8. Here-doc / Here-string 边界矩阵

```text
quoted Here-doc data: SAFE
expanded Here-doc data: SAFE
strip-tab Here-doc data: SAFE
double-quoted delimiter: SAFE
cat-only shell payload: SAFE
cat to outer shell stdin: DANGEROUS
cat through nested shell pipeline: DANGEROUS
unclosed Here-doc: UNKNOWN
unknown pipeline consumer: UNKNOWN

single-quoted PowerShell Here-string: SAFE DATA
double-quoted PowerShell Here-string without $(): SAFE DATA
double-quoted PowerShell Here-string with forbidden $(): DANGEROUS
unresolved PowerShell interpolation: UNKNOWN
```

## 9. CMD / BAT 回归

CMD/BAT 实现未修改。完整回归通过：

```text
IF / condition: PASS
FOR DO / loop: PASS
CALL: PASS
START: PASS
cmd /c: PASS
%VAR% / !VAR!: PASS
%1 / %*: PASS
nested block: PASS
goto label: PASS
echo data: PASS
```

## 10. A7.4 - A7.7 历史能力回归

```text
eval / Function / indirect eval:
PASS

bind / call / apply:
PASS

computed property / object property:
PASS

multi-level alias / wrapper / closure:
PASS

tagged template:
PASS

scope shadowing:
PASS

parse diagnostics / ERROR:
PASS

dynamic body recursion / loop protection:
PASS

Shell timeout/sudo/env/xargs/find:
PASS

PowerShell Get-Content/Invoke-Expression/ScriptBlock:
PASS

CMD/BAT:
PASS
```

完整 Web 单元测试共 `24 files / 205 tests PASS`，其中正式 Startup
Preflight/Scanner 套件 `55 tests PASS`。

## 11. A7.3 P1-2 Build Preflight 回归

保持 A7.3 实现未变，现有 Mock/故障注入继续覆盖：

| 场景 | head.complete | Preflight | Builder calls |
| -- | -- | -- | -- |
| required file missing | false | blocked | 0 |
| required file read null | false | blocked | 0 |
| required file read throw | false | blocked | 0 |
| required file parse fail | false | blocked | 0 |
| HEAD inventory fail | false | blocked | 0 |
| extra HEAD script read fail | false | blocked | 0 |
| required secure file absent in HEAD | false | blocked | 0 |
| worktree gate fail | true | blocked | 0 |
| manifest/identity fail | true | blocked | 0 |
| signing boundary fail | true | blocked | 0 |
| existing/reparse target | true | blocked | 0 |
| builder failure | true | builder ran | success continuation 0 |

HEAD 审计不完整时保持：

```text
BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE
```

`head.complete=false` 与“HEAD 完整但普通 Startup Gate FAIL”保持不同状态，
没有重新混淆。

## 12. A4 / A6 / Manifest / Storage 回归

```text
A4 Web Secure Launcher / Gate: PASS
A4 Worker Secure Launcher / Gate-first Bootstrap: PASS
A4 Gate 前 Prisma/PgBoss/Job/Maintenance 加载: NOT ALLOWED
A6 Build Identity: PASS
A6 Signed Manifest: PASS
A6 Source Tree Digest: PASS
A6 Dependency Lock Digest: PASS
A6 Runtime Dependency Digest: PASS
A6 Artifact Digest: PASS
Reparse/Junction Precheck: PASS
Build Failure Legacy Fallback: NONE
Legacy Artifact Reuse Protection: PASS
Storage Delete Capability: UNAVAILABLE
```

## 13. 测试与 TypeScript

```text
Web:
24 files / 205 tests PASS

Startup Scanner:
55 tests PASS

Worker:
6 files / 19 tests PASS

file-storage:
2 files / 19 tests PASS

Web TypeScript:
PASS

Worker TypeScript:
PASS

file-storage TypeScript:
PASS

Build Integrity MJS Syntax:
3 files PASS
```

所有测试使用现有测试框架、Mock 和临时隔离目录。Web `vitest` 配置明确
排除 `tests/e2e/**` 与 `tests/integration/**`。

## 14. 源码哈希

```text
packages/build-integrity/src/script-security.mjs
CBBEB3DA335240F044623F363F83307C5402669F8E40149903CD0403D7DF37A8

packages/build-integrity/src/startup-security.mjs
B6F4DC33B50CF755DC74D47B8FC819C40964A9553D44D420DEE1A62AAF137DB4

apps/web/tests/p13-startup-preflight.test.ts
854E3F76A5C947A4C65E93B358CCBC035FA4C5BA6288D25E12A39A80C85381C6
```

## 15. 受保护文件哈希

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

哈希与 A7.8 基线一致。测试和类型检查没有刷新 `next-env.d.ts`、
`tsconfig.tsbuildinfo`、历史 `.next` 或 Worker `dist`。

## 16. 文档哈希

```text
A7.9 Design:
61FB756935DE3C16F44A0F15963C680194B800C4C86AA1EE96553F9260534D14

Implementation Status:
3884649A195F502C6BB24DF2758B9BAB3FDC1A9A1A16AD149B8D5141D5B3A702
```

A7.9 Report SHA-256 在最终交付消息中提供，以避免自引用改变报告内容。

## 17. 未解决问题

- Scanner 是有限静态分析，不覆盖完整 JavaScript/Shell/PowerShell
  语义；
- 跨文件高阶函数和运行时生成代码仍只能保守 `UNKNOWN`；
- PowerShell 不读取文件正文；文件源进入执行入口时保持 `UNKNOWN`；
- Shell 未知 pipeline consumer 保持 `UNKNOWN`；
- 生产 Trust Root、Runtime Identity、Windows ACL 和生产 Deployment
  Evidence 仍未验证；
- HEAD 仍缺少本轮尚未提交的安全源码，Clean HEAD Build 继续被阻断；
- `.next` 与 Worker `dist` 仍存在且未隔离/删除。

这些均不是 A7.9 P1 漏报；Scanner 对无法证明的输入保持 fail-closed。

## 18. 提交建议

本轮不授权提交。后续受控提交时应：

1. 精确暂存 `script-security.mjs`、A7.9 测试、A7.9 设计/报告和
   Implementation Status；
2. 连带满足 A4/A6/A7 已有安全源码依赖，不使用 `git add .`；
3. `apps/web/package.json` 使用精确 hunk，避免 Evidence script 与未提交
   CLI 依赖不一致；
4. 排除 `.next`、Worker `dist`、`.p13-build`、`.p13-releases`、
   Schema、Migration、秘密配置和无关业务测试改动；
5. 提交前再次执行受控 Scanner/Preflight 审查。

## 19. 最终验收字段

```yaml
JavaScript/TypeScript Assignment Flow: PASS
JavaScript/TypeScript Array Flow: PASS
JavaScript/TypeScript Conditional Flow: PASS
JavaScript/TypeScript Reflect Flow: PASS
Shell Wrapper Semantics: PASS
Shell Here-doc Nested Pipeline: PASS
PowerShell Here-string Interpolation: PASS
PowerShell Get-Content Alias: PASS
CMD/BAT Regression: PASS
A7.4-A7.7 Regression: PASS
A7.3 P1-2 Regression: PASS
Build Preflight: PASS
Builder Zero-Call on Failure: PASS
A4 Web Security: PASS
A4 Worker Security: PASS
A6 Build Integrity: PASS
Manifest Integrity: PASS
Legacy Artifact Reuse: PASS
Storage Delete Capability: PASS / UNAVAILABLE
UNKNOWN Fail-Closed: PASS
Worktree Startup Gate: PASS
HEAD Startup Gate: FAIL / EXPECTED BEFORE COMMIT
TypeScript: PASS
Unit Tests: PASS
MJS Syntax: PASS
Protected File Integrity: PASS
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

## 20. 只读安全确认

```text
No PostgreSQL connection
No SQL or Migration
No real Storage access
No Cleanup or physical delete
No ACL/IAM change
No Web/Worker start
No real Build
No legacy Artifact move/delete/execute
No .env or .env.test read
No Git add/commit/reset/restore/clean/checkout/stash
```

阶段在报告和自审后停止，不进入 A7.10 或 A8。
