# P1-3 C-6.2-L8-A5 Legacy Artifact Isolation 设计与报告

## 1. 基线

- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 工作树：继续保留全部既有未提交变更
- 结论：`DESIGN COMPLETE / FILE ACTIONS NOT EXECUTED`

相关前序文档：

```text
L8-A2:
docs/architecture/file-lifecycle-p13-c6-2-l8a2-local-inventory-report.md
SHA256 FF84050850D4B1EF126A381CEB5C6EE48C8765FCB9AF04F82D15F25917C11475

L8-A3:
docs/architecture/file-lifecycle-p13-c6-2-l8a3-risk-review.md
SHA256 26F4C5271C594406E7AA9AB2CFDAAC2DF032036BF8AB7DE89EEC966BB89C0B57

L8-A4:
docs/architecture/file-lifecycle-p13-c6-2-l8a4-report.md
SHA256 09E43FA470ABF8FDF9C5000E20073F12168AA0A910481C9877048FD93502BC23
```

本轮没有执行测试、Build、Web、Worker、数据库、Migration、Storage 或 Cleanup。

## 2. Artifact 现状

### 2.1 Web

```text
Path:
apps/web/.next

Exists:
YES

Files:
1,413

Bytes:
446,890,260

Reparse Entries:
6

BUILD_ID:
LULjk7Rp3QcYPDlFEyycy
```

关键哈希：

```text
apps/web/.next/BUILD_ID
06955B147BD0009CD09B566531E3D2BC93B77142582145564E219C1530F9F5A1

apps/web/package.json
BE62811C9769F5E4D8D56CFEF62B3EF412910B585A3E2BB1B14F24F6A5ABD778

apps/web/next.config.ts
DCAABA0805CC04C8D797CB52FA7FD875C9B888C1B2BDBCC8FFA03E7679CB8B92
```

### 2.2 Worker

```text
Path:
apps/worker/dist

Exists:
YES

Files:
32

Bytes:
135,078

Reparse Entries:
0
```

关键哈希：

```text
apps/worker/dist/index.js
D7DF17BC2CF23A7923527648A98FC5AABB8FD36A21D6A0B24EA92F8C1DE5BBB9

apps/worker/dist/file-maintenance.js
C6B5B0EBD2AD047CF32AE447470B19D2AB02F413DDB33BABF80828A6FEFCABE3

apps/worker/package.json
5852D4F37B9C1AA253C134DC6FBC59644C1C7FA0456FDF7AF07CF921AE0ECDBF
```

### 2.3 新 Release 目录

```text
apps/web/.p13-releases:
ABSENT

apps/web/.p13-build:
ABSENT

workspace/.p13-quarantine:
ABSENT

workspace/.legacy-artifacts:
ABSENT
```

## 3. Web Legacy 风险

### 3.1 直接执行

`git show HEAD:apps/web/package.json`：

```text
build = next build
start = next start
```

历史 `.next` 没有：

- P13 signed Manifest；
- Trust Root；
- Web Startup Gate marker；
- `server/instrumentation.js`。

结论：

```text
Web Legacy Direct Execution Risk:
CONFIRMED
```

### 3.2 删除副作用

旧 production chunk 可通过 upload routes 到达：

```text
createUploadIntent
  -> cleanupExpiredUploadIntents
  -> removeStaging/removeObject

completeUpload failure
  -> removeObject/removeStaging
```

另有 orphan/temp delete 方法定义。

如果没有正在运行的旧 Web，当前无活动副作用；但 Artifact 仍可被执行。

### 3.3 默认 `.next` 冲突

当前 worktree：

- production build/server phase 强制 P13 isolated dist；
- package start 使用 secure launcher；
- `next dev` 仍使用 `.next`。

HEAD：

- Next 默认输出和读取 `.next`；
- package start 直接 `next start`；
- 没有 P13 dist 约束。

因此：

```text
Current worktree supported production collision:
NOT CONFIRMED

HEAD/default legacy collision:
CONFIRMED

Overall Web Default Output Directory Collision:
CONFIRMED
```

## 4. Worker Legacy 风险

旧 `dist/index.js`：

- 无 Gate；
- 创建 Prisma/PgBoss；
- 注册 Maintenance；
- 设置 `*/15` schedule；
- 立即调用旧 Maintenance。

```text
Worker Legacy Direct Execution Risk:
CONFIRMED

Worker Gate Bypass:
CONFIRMED
```

当前依赖缓解：

- 旧 dist 通过 Junction 引用当前 `packages/file-storage`；
- 当前 `LocalPrivateStorage` 没有四个删除方法；
- 物理删除预计失败；
- Gate bypass 和 DB/PgBoss effects 不因此消失。

HEAD：

- build 输出 `dist`；
- start 直接 `node dist/index.js`。

当前工作树：

- secure build 输出 P13 release root；
- secure start 只启动 verified release index；
- package scripts 不引用 dist。

```text
Worker Stale Dist Reuse Risk:
CONFIRMED FOR HEAD / MANUAL DIRECT EXECUTION
NOT FOUND IN CURRENT SUPPORTED PACKAGE SCRIPTS
```

## 5. 启动入口矩阵

| Entry | Current path | Gate | Legacy artifact possible | Risk |
|---|---|---|---|---|
| Web package start | secure launcher | YES + instrumentation | NO | LOW |
| Web dev | `next dev` | NO | YES `.next` | DEVELOPMENT ONLY |
| Web direct `next start`, current tree | isolated dist required | config + instrumentation | NO without P13 dist | BLOCKED / SAFE RELEASE |
| Web direct `next start`, HEAD | default `.next` | NO | YES | CRITICAL |
| Worker package start | secure launcher | YES + Gate | NO | LOW |
| Worker `src/index.ts` | Gate-first Bootstrap | YES | NO | LOW |
| Worker release index | signed release | YES | NO | LOW |
| Direct `worker-entry` | source direct | NO external Gate | NO legacy | PROHIBITED |
| Worker `node dist/index.js` | old dist | NO | YES | CRITICAL |
| Direct `tsc -p tsconfig.build.json` | dist | release Gate not used | can write unapproved dist | PROHIBITED |
| Test Worker Entry | test-only | test only | test DB/Storage | TEST ONLY |
| Root `pnpm build` current | package secure builds | config required | new Release only | MEDIUM |

```text
Startup Entry Matrix:
COMPLETE
```

## 6. HEAD 与工作树

### HEAD

```text
Web start = next start
Worker start = node dist/index.js
Web build = next build
Worker build = tsc -p tsconfig.build.json -> dist
next.config = no production P13 dist requirement
Worker index = direct startup
```

从 HEAD-only checkout 构建会重新出现：

- default `.next` production；
- Worker `dist` production；
- direct startup bypass；
- no Gate before business。

### 当前工作树

```text
Web build/start = secure scripts
Worker build/start = secure scripts
Next production build/server = isolated P13 dist
Worker index = Gate-first Bootstrap
Worker secure launcher = NODE_ENV=production
```

```text
HEAD Startup Bypass:
PRESENT

Working Tree Startup Bypass:
NOT FOUND IN SUPPORTED SCRIPTS
```

## 7. 隔离方案比较

### Web

| Scheme | Security | Complexity | Rollback | Dev impact | ACL | File operation |
|---|---|---|---|---|---|---|
| In-place guard + release-only packaging | MEDIUM | LOW | EASY | LOW | NO | NO |
| Move `.next` to quarantine | HIGH | MEDIUM | rename/move back | MEDIUM | NO | YES |
| ACL deny runtime read/execute | HIGH | HIGH | ACL restore | HIGH | YES | NO |
| Archive then delete | HIGHEST | MEDIUM/HIGH | only Archive | HIGH | optional | YES |

### Worker

| Scheme | Security | Complexity | Rollback | Dev impact | ACL | File operation |
|---|---|---|---|---|---|---|
| In-place guard + release-only packaging | MEDIUM | LOW | EASY | LOW | NO | NO |
| Move `dist` to quarantine | HIGH | LOW/MEDIUM | rename/move back | LOW | NO | YES |
| ACL deny read/execute | HIGH | HIGH | ACL restore | HIGH | YES | NO |
| Archive then delete | HIGHEST | MEDIUM | only Archive | HIGH | optional | YES |

## 8. 推荐架构

推荐分阶段：

```text
Phase I:
In-place guard, release-only formal start, no file changes

Phase II:
Commit worktree security changes and add CI/package allowlist

Phase III:
Move legacy artifacts to a controlled quarantine root

Phase IV:
Separate runtime identities and deny ACL on quarantine/release

Phase V:
Archive retirement with hashes and independent approval
```

推荐的路径关系：

```text
Development:
apps/web/.next [DEV ONLY]

Web Release:
apps/web/.p13-releases/<releaseId>

Worker Release:
<P13_WORKER_RELEASE_ROOT>/<releaseId>

Historical Quarantine:
<admin-controlled root>/<artifact-id>/
```

生产启动只允许 signed Release。

## 9. 立即低风险措施

不移动文件、不修改 ACL：

1. 只通过 package `start` 启动 production；
2. 禁止 direct `next start`；
3. 禁止 `node apps/worker/dist/index.js`；
4. 禁止 direct worker-entry；
5. 禁止从 HEAD-only checkout 部署；
6. 禁止手工 `tsc` 写入 `dist` 作为发布；
7. 保持 P13 dist/release root 必填；
8. 启动失败不 fallback；
9. 记录旧 Build ID/hash；
10. 任何旧 Artifact 启动尝试按安全事件处理。

## 10. 后续源码/发布措施

- 在独立授权下提交当前 secure launcher/config/bootstrap；
- CI/package scan 拒绝 `.next`/Worker dist 作为 release；
- 发布包 allowlist；
- Build manifest roots 只包含 signed release；
- 构建前验证旧目录不在目标；
- Build 失败不引用旧 Release；
- Scheduler/Auto Restart 只指向 secure entry；
- 发布前检查 `cleanupCapability=DISABLED`。

## 11. 后续文件处置

需要独立文件操作授权：

1. 确认没有进程 or file handle；
2. 生成 artifact file manifest；
3. 计算关键 SHA；
4. 同卷 rename 到 quarantine；
5. 不跟随 `.next` 中 Junction；
6. 验证原路径不存在；
7. 验证 secure scripts 不依赖 quarantine；
8. 保留逆操作记录。

本轮未执行。

## 12. 后续 ACL 处置

需要独立 ACL/身份授权：

- Web/Worker/Maintenance 独立低权限身份；
- Runtime 对 Legacy Quarantine 无读/执行；
- Runtime 对 Release Root 只读；
- Runtime 无 Trust Root 写；
- Runtime 无 Storage delete；
- parent/Reparse 防护；
- ACL evidence bundle。

本轮未执行。

## 13. 后续删除

只有：

- Quarantine 观察期完成；
- 无回滚需求；
- Hash/审计归档；
- 独立删除审批；

才可删除旧 Archive。

不得把源码测试通过作为删除授权。

## 14. 未验证事项

```text
P13 Web signed Release:
NOT BUILT

P13 Worker signed Release:
NOT BUILT

Production Trust Root:
NOT CONFIGURED

Separate Runtime Identity:
NOT VERIFIED

Quarantine Root:
NOT CREATED

Quarantine ACL:
NOT CONFIGURED

Production Environment:
NOT DEPLOYED

Production Security:
NOT VERIFIED
```

## 15. 本轮未执行

```text
No .next move/delete/rename
No Worker dist move/delete/rename
No Legacy artifact execution
No Web/Worker start
No Build
No tests
No TypeScript
No database connection
No SQL/Migration
No Storage access
No Cleanup
No ACL/owner/SID/registry/service/task change
No deployment
No Git write
```

## 16. 最终门禁

```yaml
Legacy Web Artifact: PRESENT / NOT REMOVED
Legacy Worker Artifact: PRESENT / NOT REMOVED
Web Legacy Direct Execution Risk: CONFIRMED
Worker Legacy Direct Execution Risk: CONFIRMED
Web Default Output Directory Collision: CONFIRMED
Worker Stale Dist Reuse Risk: CONFIRMED
HEAD Startup Bypass: PRESENT
Working Tree Startup Bypass: NOT FOUND
Build Output Isolation: PARTIAL
Startup Entry Matrix: COMPLETE
Recommended Isolation Strategy: DEFINED
Windows ACL: NOT MODIFIED
Legacy Artifact: NOT EXECUTED
Database: NOT CONNECTED
Storage: NOT ACCESSED
Production Environment: NOT DEPLOYED
Production Security: NOT VERIFIED
New Cleanup: NOT ENABLED
Next Phase: NOT AUTHORIZED
```

报告 SHA-256：

```text
Provided in the final delivery message after file finalization.
```
