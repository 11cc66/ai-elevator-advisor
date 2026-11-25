# P1-3 C-6.2-L8-A6 Source & Build Release Security Hardening 报告

## 1. 最终结论

- 日期：`2026-11-19`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 结论：`PASS WITH WARNINGS`

```text
Working Tree Startup Gate:
PASS

HEAD Startup Gate:
FAIL

HEAD vs Working Tree Difference:
IDENTIFIED

Web Build Preflight Gate:
PASS

Worker Build Preflight Gate:
PASS

Web Gate Order:
PASS

Worker Gate Order:
PASS

Build Identity:
PASS FOR MECHANISM / PRODUCTION IDENTITY NOT VERIFIED

Artifact Manifest Verification:
PASS FOR IMPLEMENTATION / PRODUCTION ARTIFACTS NOT VERIFIED

Legacy Artifact Reuse Protection:
PASS

Build Failure Fallback Protection:
PASS

Automated Security Tests:
PASS

TypeScript:
PASS

Real Build:
NOT EXECUTED

Legacy Artifact:
NOT MOVED / NOT DELETED / NOT EXECUTED

Database:
NOT CONNECTED

Storage:
NOT ACCESSED

Windows ACL:
NOT MODIFIED

Git Write Operations:
NOT EXECUTED

Production Environment:
NOT DEPLOYED

Production Security:
NOT VERIFIED

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```

## 2. Git 与工作树

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

工作树保留所有此前未提交修改，并新增 A6 文件。

HEAD 仍是：

```text
Web start = next start
Worker start = node dist/index.js
Web build = next build
Worker build = tsc -p tsconfig.build.json
```

当前工作树已改为 secure build/start。

## 3. 修改文件

新增：

```text
packages/build-integrity/src/startup-security.mjs
apps/web/scripts/p13-startup-security/cli.ts
apps/web/tests/p13-startup-preflight.test.ts
apps/worker/src/bootstrap.ts
docs/architecture/file-lifecycle-p13-c6-2-l8a6-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a6-report.md
```

更新：

```text
apps/web/next.config.ts
apps/web/package.json
apps/web/scripts/build-secure.ts
apps/worker/package.json
apps/worker/scripts/start-secure.mjs
apps/worker/scripts/build-secure.ts
apps/worker/src/index.ts
apps/web/tests/p13-release-security.test.ts
apps/worker/tests/legacy-cleanup-shutdown.test.ts
packages/build-integrity/src/index.mjs
packages/build-integrity/src/index.d.ts
package.json
docs/architecture/file-lifecycle-p13-implementation-status.md
```

历史 `.next`、Worker `dist`、Schema、Migration、数据库和 ACL 未修改。

## 4. Source Security Scanner

### 4.1 命令

```powershell
pnpm security:startup
```

实际结果：

```text
worktreeStatus:
PASS

headStatus:
FAIL

headVsWorktree:
DIFFERENT

additionalWorktreeScriptsScanned:
95

legacyArtifacts:
apps/web/.next PRESENT
apps/worker/dist PRESENT

worktreeFindings:
0
```

### 4.2 HEAD findings

当前 HEAD 仍被识别为旧入口：

```text
PRODUCTION_SCRIPT_UNSAFE
  Web build/start
  Worker build/start

DIRECT_NEXT_START_FORBIDDEN
  apps/web/package.json#scripts.start

DIRECT_WORKER_DIST_FORBIDDEN
  apps/worker/package.json#scripts.start

WEB_PRODUCTION_DIST_GUARD_MISSING
  HEAD next.config
```

HEAD 缺少：

```text
Web secure build/start
Web instrumentation
Worker secure build/start
Worker Gate-first Bootstrap
```

### 4.3 HEAD vs Worktree

动态差异：

```text
package.json
apps/web/package.json
apps/worker/package.json
apps/web/next.config.ts
apps/web/scripts/build-secure.ts
apps/web/scripts/start-secure.mjs
apps/web/src/instrumentation.ts
apps/worker/scripts/build-secure.ts
apps/worker/scripts/start-secure.mjs
apps/worker/src/bootstrap.ts
apps/worker/src/index.ts
```

结论：

```text
Clean HEAD checkout:
will FAIL worktree preflight

Current dirty secure worktree:
passes

HEAD-only deployment:
must be blocked
```

## 5. Scanner 检查范围

Scanner 检查：

- root/Web/Worker package scripts；
- exact secure build/start command；
- all scripts for direct next/node dist；
- test-only Worker entry absence；
- Web `next.config` production build/server guard；
- Web secure build isolated `.p13-releases` path；
- Web secure launcher Gate-before-spawn；
- Web instrumentation Gate；
- Worker secure build output；
- Worker secure launcher Gate-before-spawn and production env；
- Worker index static imports；
- Worker Bootstrap Gate-before-business-load；
- unknown executable wrappers using actual child process calls。

扫描排除：

- node_modules；
- `.next` / `dist`；
- `.p13-releases` / `.p13-build`；
- tests/docs；
- build/out/coverage。

## 6. Build Preflight

### 6.1 Web

`apps/web/scripts/build-secure.ts` 在 Next build 前：

```text
validate release ID
validate exact .p13-releases/<id>
runBuildSecurityPreflight
target must not exist
```

输出 preflight event：

```text
web.build_preflight_passed
headStatus
headVsWorktree
changedSecurityFiles
```

失败：

- 非零退出；
- 不创建/调用 Next build；
- 不 fallback 到 `.next`。

### 6.2 Worker

`apps/worker/scripts/build-secure.ts` 在 tsc 前：

```text
validate release ID
resolve Release Root
runBuildSecurityPreflight
target must not exist
```

输出：

```text
worker.build_preflight_passed
headStatus
headVsWorktree
changedSecurityFiles
```

目标等于 `apps/worker/dist`、位于历史 `.next`/dist 或已经存在时拒绝。

## 7. Artifact Identity

本阶段没有创建第二套身份系统，继续使用：

```text
Git SHA + dirty
Source Tree Digest
Dependency Lock Digest
Runtime Dependency Digest
Artifact Digest
Build Timestamp
Lifecycle Safety Version
cleanupCapability=DISABLED
Ed25519 signed Manifest
Release ID / Build ID
```

旧 `.next` / Worker `dist`：

- 无 P13 Manifest；
- 无 Trust Root 验证材料；
- 无法通过 Startup Gate；
- 目录名或时间戳不被当作新 Build identity。

构建目标检查只接受不存在的受控 Release root。

## 8. Build Failure / Fallback Protection

| 场景 | 结果 |
|---|---|
| Worktree unsafe | preflight fail |
| Clean HEAD checkout | worktree=HEAD unsafe => fail |
| Web target `.next` | fail |
| Web target outside `.p13-releases/<id>` | fail |
| Worker target dist | fail |
| Target exists | fail |
| Build partial leaves target | no manifest => Gate rejects |
| Manifest missing | Gate rejects |
| Signature invalid | Gate rejects |
| Digest mismatch | Gate rejects |
| Runtime Dependency mismatch | Gate rejects |
| Gate fails before Worker business | Prisma/PgBoss/jobs not loaded |

任何不确定状态都失败关闭。

## 9. Tests

### Web

```text
24 files / 158 tests PASS
```

A6 新增 `p13-startup-preflight` 8 tests：

- secure worktree + HEAD；
- direct next start；
- direct/wrapper legacy entry；
- Worker static business import；
- Worker Gate order；
- unsafe HEAD / safe worktree；
- unknown wrapper direct invocation；
- Build target isolation/existence。

既有 `p13-release-security`：

```text
30 tests PASS
```

### Worker

```text
6 files / 19 tests PASS
```

### file-storage

```text
2 files / 19 tests PASS
```

### TypeScript

```text
Web:
PASS (--noEmit --incremental false)

Worker:
PASS (--noEmit --incremental false)
```

## 10. Protected Artifact

测试/检查前后一致：

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
```

## 11. Source Hashes

```text
packages/build-integrity/src/startup-security.mjs
A79E81A9CF2789C23B7DEE8A8008E196252B04DD87C9FA2A4C0A1377251E97BE

packages/build-integrity/src/index.mjs
CB8080AF1BA802FF4482B543A13F2ABF066AC5FA83D169F7D93BCCA21CAAEE3A

packages/build-integrity/src/index.d.ts
51C7C7A3897ABBAF1B766A8225A2664D1409DB2A5D5099A1FEF0CDCEA8A0B8D7

apps/web/scripts/p13-startup-security/cli.ts
B18F837B9565CBC42F80F5E6EA65CC1B37A96FCC3CB92BCDCF8FBD82BB7DC1DF

apps/web/scripts/build-secure.ts
2B65A0B57E7B7A714E78666F8113B9BF2CE7AD973195D8F9A09A95BE191D1425

apps/worker/scripts/build-secure.ts
ED58C95FF3A2875D911A2E4D55966EC79E05A136F45640055CCE4E6F8BDB9DF1

apps/web/tests/p13-startup-preflight.test.ts
BC9D9166F997F199E28556C7F099FC9353608E916DCEE86609DAB8437C4F7666
```

## 12. 尚未解决

- 当前安全修改仍在工作树，尚未提交；
- 从 HEAD-only checkout 会重新出现旧入口；
- 动态生成的命令无法完全静态证明；
- 旧 `.next`/dist 仍保留；
- 尚未执行真实 signed Web/Worker Build；
- 生产 Trust Root/ACL/Runtime Identity 未配置；
- Windows ACL 未修改；
- 生产环境未部署。

## 13. 后续独立授权

1. 提交当前安全 worktree；
2. 运行隔离 signed Web/Worker Build；
3. 复核真实 Manifest/Runtime Dependency；
4. Legacy Artifact quarantine；
5. Windows ACL/Runtime Identity；
6. Production deployment/evidence。

## 14. 最终验收字段

```yaml
Working Tree Startup Gate: PASS
HEAD Startup Gate: FAIL
HEAD vs Working Tree Difference: IDENTIFIED
Web Build Preflight Gate: PASS
Worker Build Preflight Gate: PASS
Web Gate Order: PASS
Worker Gate Order: PASS
Build Identity: PASS
Artifact Manifest Verification: PASS
Legacy Artifact Reuse Protection: PASS
Build Failure Fallback Protection: PASS
Automated Security Tests: PASS
TypeScript: PASS
Real Build: NOT EXECUTED
Legacy Artifact: NOT MOVED / NOT DELETED / NOT EXECUTED
Database: NOT CONNECTED
Storage: NOT ACCESSED
Windows ACL: NOT MODIFIED
Git Write Operations: NOT EXECUTED
Production Environment: NOT DEPLOYED
Production Security: NOT VERIFIED
New Cleanup: NOT ENABLED
Next Phase: NOT AUTHORIZED
```

本报告 SHA-256 在最终交付消息中提供。
