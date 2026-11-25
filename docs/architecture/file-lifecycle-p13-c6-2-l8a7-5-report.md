# P1-3 C-6.2-L8-A7.5 Multi-Language Scanner Semantic Analysis Remediation Report

## 1. 最终结论

- 阶段：`C-6.2-L8-A7.5`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 总体结论：`PASS`

A7.4 的全部 Scanner 漏报/误报已修复：

- JS `eval` / `new Function`；
- JS process `.bind()`；
- JS 常量 computed alias；
- Shell unresolved exec；
- Shell 多层 `sh/bash -c`；
- Shell `eval "$(...)"`；
- Shell echo / Here-doc 数据误报；
- PowerShell Here-string 数据误报。

A7.3 P1-2 未修改，并通过回归。

当前真实扫描：

```text
worktreeStatus: PASS
headStatus: FAIL / expected before authorized commit
worktreeComplete: true
headComplete: false / required secure files absent in HEAD
worktree unknown: 0
worktree findings: 0
```

## 2. 修改文件

新增：

```text
docs/architecture/file-lifecycle-p13-c6-2-l8a7-5-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-5-report.md
```

修改：

```text
packages/build-integrity/src/script-security.mjs
apps/web/tests/p13-startup-preflight.test.ts
docs/architecture/file-lifecycle-p13-implementation-status.md
```

未修改：

- HEAD 完整性与 Build Preflight 语义；
- Prisma Schema / Migration；
- Web/Worker Runtime Startup Gate；
- 生产业务代码；
- 历史 `.next` / Worker `dist`。

## 3. A7.4 问题根因

1. JS AST 未处理 global `eval` / `Function`。
2. `.bind()` 生成的函数没有继续继承 child_process API 语义。
3. 第二遍常量传播未完整处理 computed alias。
4. Shell wrapper 搜索未限定命令起始位置，导致 echo 字符串误报。
5. Shell 没有 Here-doc 数据区状态。
6. Shell 嵌套 payload 只分析一层，且动态 exec 未输出 UNKNOWN。
7. PowerShell 没有 Here-string 数据区状态。

## 4. JavaScript / TypeScript

### 4.1 Dynamic Execution

支持：

- `eval(...)`；
- `new Function(...)`；
- `Function(...)`；
- `globalThis.eval` / `Function`；
- indirect eval `(0, eval)`；
- eval / Function alias；
- `.call()` / `.apply()`。

规则：

- 静态字符串 body 递归进入正式 AST 扫描；
- body 不可推导 -> UNKNOWN；
- body 内发现危险调用 -> DANGEROUS；
- 最大递归深度 8；
- 相同 body 防循环；
- 超出深度 -> UNKNOWN。

### 4.2 Scope shadowing

检查 parameter、function declaration、variable binding、object/array
binding pattern。局部 `eval` / `Function` / `spawn` 不会被误认为 global
或 child_process API。

### 4.3 bind / call / apply

支持：

```javascript
const run = cp["spawn"].bind(cp);
run("next", ["start"]);

cp.spawn.call(cp, "next", ["start"]);
cp.spawn.apply(cp, ["next", ["start"]]);
```

### 4.4 Alias / constant propagation

固定点最多 8 轮：

- process alias；
- method alias；
- computed alias；
- nested constant；
- string/template；
- array flatten；
- partial spread；
- path.join / path.resolve。

无法可靠确定 -> UNKNOWN。

## 5. Shell

### 5.1 Dynamic / nested

支持：

- `exec "$UNRESOLVED_COMMAND"` -> UNKNOWN；
- 多层 `bash/sh -c` 递归；
- eval 内 command substitution 不可确定 -> UNKNOWN；
- variable assignment wrapper；
- xargs / command / source；
- 函数定义和调用；
- 条件块、subshell、block。

### 5.2 Here-doc

支持：

- `<<EOF`；
- `<<'EOF'`；
- `<<"EOF"`；
- `<<-EOF`；
- 多行正文；
- 结束 delimiter；
- unclosed -> UNKNOWN；
- 普通 cat/echo body 作为数据；
- body 传给 bash/sh 时进入执行扫描。

### 5.3 误报修复

以下不再误报：

```sh
echo 'bash -c "next start"'
cat <<EOF
next start
EOF
```

## 6. PowerShell

支持：

- `@' ... '@`；
- `@" ... "@`；
- here-string assignment；
- pipeline；
- Write-Host；
- ordinary function；
- Invoke-Expression / Invoke-Command；
- scriptblock create；
- unclosed -> UNKNOWN。

Here-string 普通数据不扫描为命令；传入执行入口时再分析内容。

嵌套 ScriptBlock 能力保留。

## 7. CMD/BAT 回归

本轮未重写 CMD 解析，以下回归通过：

- IF；
- FOR DO；
- CALL / START；
- cmd /c；
- `%VAR%` / `!VAR!`；
- `%1` / `%*`；
- nested parentheses；
- goto label；
- echo。

## 8. A7.4 失败样例复测

| 样例 | 结果 |
| -- | -- |
| JS eval literal | DANGEROUS |
| JS new Function | DANGEROUS |
| JS `cp["spawn"].bind(cp)` | DANGEROUS |
| JS constant computed alias | DANGEROUS |
| Shell `exec "$UNRESOLVED_COMMAND"` | UNKNOWN |
| Shell nested `bash -c` | DANGEROUS |
| Shell `eval "$(...)"` | UNKNOWN |
| Shell echo wrapper string | SAFE |
| Shell Here-doc data | SAFE |
| Shell Here-doc executed by bash | DANGEROUS |
| PowerShell Here-string Write-Host | SAFE |
| PowerShell Here-string Invoke-Expression | DANGEROUS |

没有失败样例保持 SAFE。

## 9. 额外对抗测试

通过：

- JS multi-level process alias；
- JS multi-level wrapper；
- recursive wrapper：不挂起；
- safe local `eval` / `Function` / `spawn`；
- safe ordinary `.bind()`；
- call/apply；
- Shell assignment wrapper；
- Shell `<<-`；
- unclosed Here-doc；
- PS nested ScriptBlock；
- PS unclosed Here-string；
- CMD nested block / label。

## 10. UNKNOWN 语义

```text
DANGEROUS
UNKNOWN
ERROR
SAFE
```

动态执行不可推导、解析/读取/枚举失败、未知脚本类型、未闭合数据区均为
非 SAFE。当前真实工作树：

```text
unknowns: 0
findings: 0
```

## 11. A7.3 P1-2 回归

```text
HEAD required missing/read null/throw/parse:
head.complete=false

HEAD enumeration failure:
head.complete=false

HEAD complete but security FAIL:
complete=true, worktree evaluation allowed

Worktree security FAIL:
Preflight blocked

Manifest / Signing / Reparse failure:
Preflight blocked

Builder calls on preflight failure:
0

Builder failure:
success continuation 0
```

真实当前 Preflight：

```text
BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE
```

`.p13-releases` / `.p13-build` 未创建。

## 12. A4 / A6 / Storage 回归

```text
A4 Web Security: PASS
A4 Worker Security: PASS
A6 Build Integrity: PASS
Manifest Integrity: PASS
Legacy Artifact Reuse: PASS
Storage Delete Capability: UNAVAILABLE
```

## 13. 测试结果

```text
Web:
24 files / 200 tests PASS

Startup scanner:
50 tests PASS

Worker:
6 files / 19 tests PASS

file-storage:
2 files / 19 tests PASS

Web TypeScript: PASS
Worker TypeScript: PASS
file-storage TypeScript: PASS
MJS syntax: PASS
```

## 14. 受保护文件

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

## 15. 源码哈希

```text
packages/build-integrity/package.json
94F91628BC9E5B687DF4857F7FDA7A3D09A1FE14753D363B5B8A8CA92BEFF39F

packages/build-integrity/src/index.mjs
89A88FB7F190AEEAC02F191040DB72617F32459FA5D24AF04576A35563E08945

packages/build-integrity/src/index.d.ts
8387E9E1660570F224CE640F7FE48593EC5E1AB770774F9AC1F8CA63C1325B00

packages/build-integrity/src/script-security.mjs
D7346B602F570783973ABA22B6A66469330393466B4E2AE72E5F420C3B11DD34

packages/build-integrity/src/startup-security.mjs
B6F4DC33B50CF755DC74D47B8FC819C40964A9553D44D420DEE1A62AAF137DB4

apps/web/tests/p13-startup-preflight.test.ts
1186254C8F1F780A4C2E5094CC90CCDA4F8D4AB386F5F468DE802E7773157BE4
```

## 16. 提交闭包

### 必须提交

```text
package.json
pnpm-lock.yaml
apps/web/package.json
apps/worker/package.json
apps/web/next.config.ts
apps/worker/src/index.ts
apps/worker/tsconfig.json
packages/build-integrity/package.json
packages/build-integrity/src/index.mjs
packages/build-integrity/src/index.d.ts
packages/build-integrity/src/script-security.mjs
packages/build-integrity/src/startup-security.mjs
apps/web/scripts/build-secure.ts
apps/web/scripts/start-secure.mjs
apps/web/scripts/p13-startup-security/cli.ts
apps/web/src/instrumentation.ts
apps/web/src/server/security/startup-gate.ts
apps/worker/scripts/build-secure.ts
apps/worker/scripts/start-secure.mjs
apps/worker/src/bootstrap.ts
apps/worker/src/security/startup-gate.ts
apps/worker/src/worker-entry.ts
apps/web/src/modules/files/download-service.ts
apps/web/src/modules/files/upload-service.ts
apps/web/src/server/files/storage.ts
apps/worker/src/config.ts
apps/worker/src/file-maintenance.ts
apps/worker/src/file-processing.ts
apps/worker/src/storage.ts
packages/file-storage/src/errors.ts
packages/file-storage/src/index.ts
packages/file-storage/src/local-private-storage.ts
packages/file-storage/src/capabilities.ts
packages/file-storage/src/legacy-cleanup.ts
```

### 必须提交的测试

```text
apps/web/tests/p13-release-security.test.ts
apps/web/tests/p13-startup-preflight.test.ts
apps/web/tests/legacy-cleanup-shutdown.test.ts
apps/web/tests/e2e/global-setup.ts
apps/web/tests/integration/phase32-upload-service.test.ts
apps/web/tests/integration/phase34-file-processing.test.ts
apps/web/tests/integration/phase35-lease-renewal.test.ts
apps/web/tests/integration/phase35-processing-reliability.test.ts
apps/worker/tests/legacy-cleanup-shutdown.test.ts
apps/worker/tests/storage-capability.test.ts
apps/worker/tests/test-worker-entry.ts
packages/file-storage/tests/local-private-storage.test.ts
packages/file-storage/tests/capabilities.test.ts
```

### 文档

```text
docs/architecture/file-lifecycle-p13-c6-2-l8a4-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a4-report.md
docs/architecture/file-lifecycle-p13-c6-2-l8a5-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a5-report.md
docs/architecture/file-lifecycle-p13-c6-2-l8a6-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a6-report.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-review.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-1-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-1-report.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-2-review.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-3-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-3-report.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-4-review.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-5-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-5-report.md
docs/architecture/file-lifecycle-p13-implementation-status.md
```

### 精确 hunk

`apps/web/package.json` 若不提交 Deployment Evidence，仅暂存：

- `build`
- `start`
- `p13:startup-security`
- `@elevator/build-integrity`

`p13:evidence:validate` 不得指向未提交 CLI。

### 不提交

```text
apps/web/next-env.d.ts
apps/web/tsconfig.tsbuildinfo
apps/web/.next/
apps/worker/dist/
prisma/schema.prisma
prisma/migrations/
apps/web/scripts/p13-build-audit/
apps/web/scripts/p13-db-tests/
apps/web/scripts/p13-deployment-evidence/
apps/web/scripts/p13-storage-delete-audit/
apps/web/scripts/p13-storage-inventory/
apps/web/tests/p13-a-migration.test.ts
apps/web/tests/p13-b-migration.test.ts
apps/web/tests/p13-build-audit.test.ts
apps/web/tests/p13-db-tooling.test.ts
apps/web/tests/p13-deployment-evidence*.test.ts
apps/web/tests/p13-storage-delete-audit.test.ts
apps/web/tests/p13-storage-inventory.test.ts
.env
.env.test
node_modules/
coverage/
test-results/
```

## 17. 未执行

```text
No Git write
No real Build
No Web/Worker start
No DB/SQL/Migration
No real Storage
No Cleanup
No ACL/IAM change
No legacy Artifact move/delete/execute
```

## 18. 剩余风险

- Scanner 不是完整 interprocedural 数据流；
- Shell/PowerShell/CMD 仍是轻量结构扫描；
- 跨文件高阶函数和运行时生成的代码只能保守 UNKNOWN；
- 生产 Trust Root/ACL/Runtime Identity 未验证。

## 19. 最终验收字段

```yaml
JavaScript/TypeScript Scanner: PASS
Dynamic Execution Detection: PASS
bind() Alias Tracking: PASS
Computed Property Tracking: PASS
Shell Dynamic Execution: PASS
Nested Shell Execution: PASS
Shell Here-doc Data Separation: PASS
Shell False Positive Regression: PASS
PowerShell Here-string Data Separation: PASS
PowerShell Nested ScriptBlock: PASS
CMD/BAT Regression: PASS
A7.4 Failure Samples: PASS
Adversarial Tests: PASS
UNKNOWN Fail-Closed: PASS
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
TypeScript: PASS
Unit Tests: PASS
Protected File Integrity: PASS
Database: NOT CONNECTED
Storage: NOT ACCESSED
Real Build: NOT EXECUTED
Git Write Operations: NOT EXECUTED
Production Deployment: NOT DEPLOYED
New Cleanup: NOT ENABLED
Commit Authorization: NOT GRANTED
Next Phase: NOT AUTHORIZED
```

本报告 SHA-256 在最终交付消息中提供。
