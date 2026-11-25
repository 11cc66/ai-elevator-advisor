# P1-3 C-6.2-L8-A4 Web / Worker 启动入口安全整改报告

## 1. 最终结论

- 日期：`2026-11-19`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 最终结论：`PASS WITH WARNINGS`

```text
Web Production Entry:
SECURE IN CURRENT WORKTREE

Worker Production Entry:
SECURE IN CURRENT WORKTREE

Web Gate Before Business Import:
PASS

Worker Gate Before Prisma/PgBoss:
PASS

Worker Gate Before Job Registration:
PASS

Legacy Cleanup:
FAIL-CLOSED

Web Delete Capability:
UNAVAILABLE

Worker Delete Capability:
UNAVAILABLE

Production Script Bypass:
NONE FOUND

Source Script Consistency:
PASS IN WORKTREE / HEAD STILL OLD

Unit Tests:
PASS

TypeScript:
PASS

Legacy Web Artifact:
PRESENT / NOT REMOVED

Legacy Worker Artifact:
PRESENT / NOT REMOVED

Windows ACL:
NOT MODIFIED

Production Environment:
NOT DEPLOYED

Production Security:
NOT VERIFIED

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```

## 2. 基线

L8-A3 报告哈希复核：

```text
26F4C5271C594406E7AA9AB2CFDAAC2DF032036BF8AB7DE89EEC966BB89C0B57
```

与预期一致。

Git 基线和所有既有未提交文件保持不变。

## 3. 修改文件

新增：

```text
apps/worker/src/bootstrap.ts
docs/architecture/file-lifecycle-p13-c6-2-l8a4-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a4-report.md
```

更新：

```text
apps/web/next.config.ts
apps/worker/src/index.ts
apps/worker/scripts/start-secure.mjs
apps/web/tests/p13-release-security.test.ts
apps/worker/tests/legacy-cleanup-shutdown.test.ts
docs/architecture/file-lifecycle-p13-implementation-status.md
docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md
```

保留但未重复修改：

```text
apps/web/package.json
apps/worker/package.json
apps/web/scripts/start-secure.mjs
```

这些文件此前工作树修改已提供 secure build/start。

## 4. Web Production Entry

### 4.1 Package scripts

当前工作树：

```text
build = tsx scripts/build-secure.ts
start = node scripts/start-secure.mjs
dev   = next dev
```

`next dev` 保留为开发入口。

当前 production package start 不包含 direct `next start`。

HEAD 中仍为：

```text
build = next build
start = next start
```

因此安全修复仍未提交。本轮不能执行 Git 写操作。

### 4.2 新增 production server 配置门禁

`apps/web/next.config.ts` 现在同时检查：

```text
PHASE_PRODUCTION_BUILD
PHASE_PRODUCTION_SERVER
```

两者均要求：

```text
P13_NEXT_DIST_DIR=.p13-releases/<releaseId>
```

缺失或格式非法时 fail closed。

新增测试调用 real Next config function：

- `PHASE_PRODUCTION_SERVER` 无 dist 时抛错；
- 合法隔离 dist 时通过。

该门禁阻止正常 `next start` 在缺少隔离 Release 配置时回退到默认历史 `.next`。

### 4.3 Secure Launcher 顺序

`apps/web/scripts/start-secure.mjs`：

```text
verifyStartupRelease
  -> spawn Next server
  -> instrumentation verifies again
```

测试断言：

```text
verifyStartupRelease source index
  <
spawn source index
```

launcher 不导入：

- Prisma；
- pg-boss；
- file-storage。

### 4.4 Web business import

Next production business routes 只在 secure launcher 子进程和 instrumentation Gate 之后运行。

旧 `.next` 内旧代码仍存在，但不能把历史 Artifact 的 reachability 当作当前源码仍存在 direct entry。

## 5. Worker Production Entry

### 5.1 Package scripts

当前工作树：

```text
build = tsx scripts/build-secure.ts
start = node scripts/start-secure.mjs
dev   = tsx watch src/index.ts
```

production start 不引用 `dist/index.js`。

HEAD 仍为：

```text
build = tsc -p tsconfig.build.json
start = node dist/index.js
```

### 5.2 Secure Launcher

`apps/worker/scripts/start-secure.mjs`：

```text
verifyStartupRelease
  -> verify release index regular file
  -> verify realpath containment
  -> spawn release index
```

本轮新增：

```text
NODE_ENV=production
```

不允许 production child 以 development/test 环境启动。

### 5.3 Gate-first Bootstrap

新文件：

```text
apps/worker/src/bootstrap.ts
```

默认顺序：

```text
runWorkerStartupGate()
  -> dynamic import("./worker-entry.js")
  -> startWorker()
```

可注入接口：

```text
runStartupGate
loadBusinessEntry
```

测试注入证明：

- Gate reject 时 business loader 调用次数为 0；
- Gate success 时顺序为 `gate -> loadBusiness -> startWorker`。

Bootstrap 不静态导入 Prisma、pg-boss 或 Worker business modules。

### 5.4 index.ts

`apps/worker/src/index.ts` 只：

```text
import runWorkerBootstrap
await runWorkerBootstrap()
catch => worker.startup_rejected
```

Gate 前不会创建 Prisma/PgBoss，不会注册 Job，不会 immediate Maintenance。

### 5.5 Worker Maintenance

既有 Gate 通过后的 `worker-entry.ts`：

- 创建 Prisma/PgBoss；
- 注册 recognition/maintenance；
- schedule `*/15`；
- startup immediate Maintenance。

Maintenance：

- input 不含 Storage；
- Retry/Recovery/Requeue 不删除对象；
- 新旧 Startup immediate/Cron 同一无删除路径。

## 6. Script Bypass 扫描

测试解析：

```text
root package.json
apps/web/package.json
apps/worker/package.json
```

所有 scripts 均断言：

```text
no next start
no node dist/index.js
```

结果：

```text
Production Script Bypass:
NONE FOUND
```

Test-only Worker Entry：

```text
apps/worker/tests/test-worker-entry.ts
```

production package scripts 不引用该文件。

## 7. Delete Boundary

Web：

- `cleanupExpiredUploadIntents` fail closed；
- `createUploadIntent` 不调用 cleanup；
- `completeUpload` catch 保留 artifacts；
- runtime Storage capability 不含 delete。

Worker：

- Maintenance 无 Storage 参数；
- Worker Storage 为 read-only capability；
- four legacy delete methods 仅在 quarantine class 中且立即抛错。

file-storage 测试：

```text
2 files / 19 tests PASS
```

## 8. 测试结果

### Web

```text
23 files / 150 tests PASS
```

覆盖：

- production scripts；
- Gate-before-spawn；
- no business imports in launchers；
- Next production server dist guard；
- Worker Gate-first Bootstrap；
- Manifest/Artifact/Trust/Runtime Dependency；
- Upload failure retention；
- Storage delete capability；
- Legacy cleanup；
- Maintenance；
- test-only entry。

### Worker

标准命令：

```text
pnpm --filter @elevator/worker test
```

结果：

```text
6 files / 19 tests PASS
```

说明：

- 在并行执行多个包测试时，既有 PDF 两页解析测试曾达到默认 5,000ms timeout；
- 使用显式 15 秒超时单独复验通过；
- 最终再次以标准 `pnpm --filter @elevator/worker test` 复验，19/19 PASS；
- 未修改 PDF 测试或全局 timeout 配置；
- 该差异是执行性能波动，不是功能失败。

### TypeScript

```text
Web:
PASS

Worker:
PASS
```

两处均使用：

```text
--noEmit --incremental false
```

## 9. 受保护文件

测试后复核与测试前一致：

```text
apps/web/next-env.d.ts
0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC

apps/web/tsconfig.tsbuildinfo
018C24B24976726C8837E6C70B57DA982DAE635E98C62BC721F3F63AEF7FF777

apps/web/.next/BUILD_ID
06955B147BD0009CD09B566531E3D2BC93B77142582145564E219C1530F9F5A1

apps/worker/dist/file-maintenance.js
C6B5B0EBD2AD047CF32AE447470B19D2AB02F413DDB33BABF80828A6FEFCABE3

apps/worker/dist/index.js
D7DF17BC2CF23A7923527648A98FC5AABB8FD36A21D6A0B24EA92F8C1DE5BBB9

prisma/schema.prisma
78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299
```

P1-3 Migration：

```text
187D82A00DB73CB6F5D79C97DCD6B4FF2E01BD7E5F78BB9E1273D54D8A141479
```

## 10. 主要源码哈希

```text
apps/web/next.config.ts
DCAABA0805CC04C8D797CB52FA7FD875C9B888C1B2BDBCC8FFA03E7679CB8B92

apps/worker/scripts/start-secure.mjs
A5E0ED3A6F7190C097B46B82FE8768BFFA50B6E68EF478A23D702258981D93A0

apps/worker/src/bootstrap.ts
F88E9C86300A62E94192196DF4D63975941EDE3B849253310C6507B84617BEFB

apps/worker/src/index.ts
DC216DA857F74F01BB341A82AB749B1DF1735834E9C45E18F30B1442FAD7DF68

apps/web/tests/p13-release-security.test.ts
21C85577DE2632A54F8D2D111F2BC9D4ADEDFE4325B8E8D60F1676C1FA831033

apps/worker/tests/legacy-cleanup-shutdown.test.ts
57DC72D35617D9FC9D46FE41F34A95F9F55A45D030B2C9246FAC4DE584A27927

packages/file-storage/dist/local-private-storage.js
45E41A1B92C0D359A982712EA210FEA890DE9094995B606B49D1588232E0AFA6
```

文档哈希：

```text
docs/architecture/file-lifecycle-p13-c6-2-l8a4-design.md
79D5CED97102EF155B38F8098AFEB95D0CDB89A7DE6DA4AB9C3EBC4C0DC5D701

docs/architecture/file-lifecycle-p13-implementation-status.md
4FCA5A798FD4E8528B4569A436AD49B54A0C2AF5B60BAA6970D8E4EBD6FDC641

docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md
FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7
```

本报告自身 SHA-256 在最终交付消息中提供。

## 11. 未解决风险

- HEAD 仍含旧 package scripts；修复在 uncommitted worktree；
- 旧 Web `.next` 仍含可达旧 delete bundle；
- 旧 Worker `dist` 仍可直接绕过 Gate；
- 当前本地旧 Worker 删除方法已因依赖升级缺失，但不能以依赖巧合为安全边界；
- 手工 direct old entry 仍需 OS/发布层禁止；
- 生产 Trust Root/ACL/Release/Evidence 未验证；
- 生产环境未部署。

## 12. 未执行

```text
No Web/Worker start
No Legacy Artifact execution
No Build
No Integration/E2E
No database connection
No SQL/Migration
No real Storage access
No Cleanup
No ACL/Registry/Service/Task change
No historical Artifact delete/move
No Git write
```

## 13. 最终门禁

```text
C-6.2-L8-A4:
PASS WITH WARNINGS

Web Production Entry:
SECURE IN CURRENT WORKTREE

Worker Production Entry:
SECURE IN CURRENT WORKTREE

Web Gate Before Business Import:
PASS

Worker Gate Before Prisma/PgBoss:
PASS

Worker Gate Before Job Registration:
PASS

Legacy Cleanup:
FAIL-CLOSED

Web Delete Capability:
UNAVAILABLE

Worker Delete Capability:
UNAVAILABLE

Production Script Bypass:
NONE FOUND

Source Script Consistency:
PASS IN WORKTREE / HEAD OLD

Unit Tests:
PASS

TypeScript:
PASS

Legacy Web Artifact:
PRESENT / NOT REMOVED

Legacy Worker Artifact:
PRESENT / NOT REMOVED

Windows ACL:
NOT MODIFIED

Production Environment:
NOT DEPLOYED

Production Security:
NOT VERIFIED

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```
