# P1-3 C-6.2-L6 Maintenance 全链路安全与 Storage 删除能力隔离报告

## 文档信息

- 阶段：`C-6.2-L6`
- 日期：`2026-11-18`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 最终结论：`PASS WITH WARNINGS`

## 1. 最终结论

```text
C-6.2-L6:
PASS WITH WARNINGS

Maintenance Job Inventory:
COMPLETE IN REPOSITORY

Immediate Startup Execution:
NON-DESTRUCTIVE / MOCK TESTED

15-Minute Schedule:
NON-DESTRUCTIVE / MOCK TESTED

Retry / Recovery / Requeue:
NON-DESTRUCTIVE / CODE AND MOCK VERIFIED

Physical Delete Entry Inventory:
COMPLETE IN REPOSITORY

Indirect Delete Call Paths:
FAIL-CLOSED / STATIC SCAN TESTED

Storage Capability Isolation:
IMPLEMENTED

Worker Delete Capability:
UNAVAILABLE

Maintenance Delete Capability:
UNAVAILABLE

Legacy Cleanup Fail-Closed:
PRESERVED / TESTED

Test Storage Isolation:
VERIFIED IN ISOLATION

Storage Inventory:
READ-ONLY / PARTIAL METRICS

Queue / Storage Monitoring:
DESIGNED / DB METRICS NOT IMPLEMENTED

Future Cleanup Architecture:
DESIGNED / NOT IMPLEMENTED

Production Storage Delete Permissions:
NOT VERIFIED

Legacy Worker Drain:
NOT EXECUTED

Legacy Artifact Removal:
NOT EXECUTED

Production Deployment:
NOT EXECUTED

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```

源码层面的普通运行时删除能力已经隔离；这不等于生产 Storage 删除 ACL 已经撤销。

## 2. Git 基线和工作树

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

工作树保留了 L、L1-L5、本轮 L6 以及本轮之前所有未提交文件。未执行 Git add、commit、reset、restore、clean、checkout 或 stash。

## 3. 修改文件清单

新增：

```text
packages/file-storage/src/capabilities.ts
packages/file-storage/src/legacy-cleanup.ts
packages/file-storage/tests/capabilities.test.ts
apps/worker/tests/storage-capability.test.ts
apps/web/scripts/p13-storage-delete-audit/scanner.ts
apps/web/scripts/p13-storage-delete-audit/cli.ts
apps/web/tests/p13-storage-delete-audit.test.ts
docs/architecture/file-lifecycle-p13-c6-2-l6-design.md
docs/architecture/file-lifecycle-p13-c6-2-l6-report.md
```

更新：

```text
packages/file-storage/src/local-private-storage.ts
packages/file-storage/src/index.ts
packages/file-storage/tests/local-private-storage.test.ts

apps/worker/src/storage.ts
apps/worker/src/file-processing.ts
apps/worker/src/file-maintenance.ts
apps/worker/src/worker-entry.ts
apps/worker/tests/legacy-cleanup-shutdown.test.ts

apps/web/src/server/files/storage.ts
apps/web/src/modules/files/upload-service.ts
apps/web/src/modules/files/download-service.ts
apps/web/tests/legacy-cleanup-shutdown.test.ts
apps/web/tests/p13-storage-inventory.test.ts
apps/web/scripts/p13-storage-inventory/inventory.ts
apps/web/tests/integration/phase32-upload-service.test.ts
apps/web/tests/integration/phase34-file-processing.test.ts
apps/web/tests/integration/phase35-lease-renewal.test.ts
apps/web/tests/integration/phase35-processing-reliability.test.ts

docs/architecture/file-lifecycle-p13-implementation-status.md
docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md
```

未修改：

- `prisma/schema.prisma`；
- 任何 Migration SQL；
- 数据库角色、ACL、HBA 或数据；
- 历史 `apps/web/.next`；
- 历史 `apps/worker/dist`；
- 真实 Storage；
- 部署、Service、Task Scheduler、CI/CD 或生产密钥。

共享包 `packages/file-storage/dist` 已通过该包的正常 `tsc` build 刷新，以便 Web/Worker 读取新的 capability 声明。它不是历史 Web `.next` 或 Worker `dist`，未启动，也未参与生产部署。

## 4. Maintenance Job 清单

| Job | 注册 | 调用 | 调度/立即执行 | Retry | Storage delete |
|---|---|---|---|---|---|
| 普通 Worker Queue | `worker-entry.ts` | inline logging handler | 由 Job 到达触发 | PgBoss 默认 | 不可达 |
| `file-recognition` | `worker-entry.ts` | `processFileRecognitionJob()` | `batchSize=1` | Web/L3 retry options | 不可达 |
| `file-maintenance` | `registerFileMaintenanceJob()` | `runFileMaintenance()` | cron + startup immediate | queue retryLimit=1 | 不可达 |

仓库内未发现第二套 Upload Intent、Orphan、Temp、Version、Reconciliation 或 Cleanup Scheduler。

## 5. Worker 启动时立即执行链

```text
index.ts
  -> runWorkerStartupGate()
  -> import("./worker-entry.js")
  -> startWorker()
  -> PgBoss start/createQueue
  -> registerFileMaintenanceJob()
       -> boss.work(maintenance handler)
       -> boss.schedule("*/15 * * * *")
       -> immediate runFileMaintenance({ prisma, boss, env })
```

立即执行不再创建或传入 Storage capability。若立即执行抛错，现有 `startWorker()` 错误路径会停止 PgBoss 并断开 Prisma。

## 6. 每 15 分钟调度链

```text
PgBoss schedule
  queue = file-maintenance
  cron  = */15 * * * *
  key   = regular-file-maintenance
  -> registered maintenance worker
  -> runFileMaintenance({ prisma, boss, env })
  -> lease
  -> stale PROCESSING recovery
  -> exhausted failure transition
  -> QUEUED requeue
```

启动立即执行和 queue handler 都调用同一函数。Mock 测试验证两次调用均没有 `storage` 输入。

## 7. Retry / Recovery / Requeue

### Retry

- Maintenance queue 自身：`retryLimit=1`、`expireInSeconds=120`；
- Retry 重新进入同一个无 Storage 参数的 handler；
- Recognition 的 retry 由 `file-recognition` queue 和文件处理状态机负责；
- 没有重试分支构造 Legacy cleanup capability。

### Recovery

- 只读取过期 `PROCESSING` 记录；
- 更新条件包含 extraction ID、state、processing token 和 lease expiry；
- 不读取或删除 Storage 对象；
- Attempt 已耗尽时只更新 DB 和 AuditLog。

### Requeue

- 只查询 `QUEUED` FileExtraction；
- `boss.send()` / `boss.sendAfter()` 目标固定为 `file-recognition`；
- 不查询 FileUploadIntent；
- 不查询 orphan candidate；
- 不清理 temp。

真实 PgBoss duplicate、timeout、restart 和跨 Worker 竞争未执行 DB 验证。

## 8. Storage 删除入口清单

| 入口 | 类型 | 当前分类 |
|---|---|---|
| `QuarantinedLegacyStorageCleanup.removeStaging/removeObject` | Storage object | FAIL-CLOSED |
| `QuarantinedLegacyStorageCleanup.cleanupOrphanObjects/cleanupTemp` | Batch FS cleanup | FAIL-CLOSED |
| `cleanupExpiredUploadIntents()` | Legacy Web path | 访问 DB/Storage 前 FAIL-CLOSED |
| `completeUpload()` 失败分支 | Upload rollback | 禁止物理删除 |
| Worker Maintenance | Background cleanup | 已移除 Storage 依赖 |
| `build-secure.ts` `fs.rm` | build-owned temp | ALLOWLISTED |
| `test-db/cli.ts` `fs.rm` | guarded `storage/private-test` | ALLOWLISTED TEST ROOT |
| Unit/integration teardown `fs.rm` | test-owned paths | TEST ONLY |
| `pdf page.cleanup()` | PDF library memory/resource | NOT FILESYSTEM DELETE |

未发现：

- 云 Storage SDK 删除；
- Web Route / Server Action 物理删除；
- 生产 Prisma `delete` / `deleteMany`；
- Production Dynamic Import 清理入口；
- Feature Flag 重新启用 Legacy cleanup。

Prisma Schema 中存在 `onDelete: Cascade/Restrict/SetNull`。本轮没有执行任何数据库删除，也没有把 Cascade 配置当作已发生的物理文件删除。

## 9. 间接删除调用路径

静态扫描结果：

```text
Scanned files:
169

Production-reachable files:
94

Unresolved dynamic import / require:
0

Delete-like calls:
15

Unallowlisted production physical-delete calls:
0

Classifications:
BUILD_TEMP = 1
TEST_ROOT  = 1
TEST_ONLY  = 13
```

扫描器覆盖：

- TypeScript AST；
- static import/export graph；
- literal dynamic `import()`；
- literal/non-literal `require()`；
- 生产入口可达性；
- Storage delete 方法名；
- `fs.rm`、`fs.unlink`、`fs.rmdir`；
- 显式 allowlist，不隐藏未知调用。

扫描零 finding 仅适用于当前源码和已配置扫描根；不代表构建产物、外部服务或生产 ACL 安全。

## 10. Storage Capability Matrix

| 身份 | Read | Upload Write | Processing Write | Physical Delete | 当前状态 |
|---|---|---|---|---|---|
| Web Runtime | YES | YES | NO | NO | 冻结 wrapper |
| Worker Runtime | YES | NO | NO | NO | 冻结 read-only wrapper |
| Maintenance | NO | NO | NO | NO | 无 Storage 参数 |
| Legacy Cleanup | NO | NO | NO | FAIL-CLOSED API | quarantine |
| Test Runtime | isolated | isolated | isolated | test teardown only | test-only |
| Future Cleanup | scoped | NO | NO | separate approval | NOT IMPLEMENTED |

`LocalPrivateStorage` 不再暴露四个删除方法。普通 factory 和所有业务依赖只看到目标 capability 子集。

## 11. Fail-Closed 测试结果

- Legacy 四个删除方法在 key 校验和路径解析前抛出；
- 普通 Web upload capability 不含删除方法；
- 普通 Worker capability 仅含 read 方法；
- capability wrapper 为 frozen；
- Maintenance 输入无 Storage；
- Lease lost 后不执行 Fixture/DB recovery 查询；
- Upload DB 失败和 COMMIT unknown 均保留已 finalize 对象；
- Notification 失败不回滚物理对象；
- Integration test 不再尝试 spy 不存在的删除方法。

## 12. Test Storage 隔离结果

- Unit tests使用 `mkdtemp` 自建目录；
- Storage Inventory 测试的 root、junction 和变化文件均在测试临时根内；
- test database reset 只能解析固定 `storage/private-test`；
- `resolveVerifiedTestStorageRoot()` 拒绝 symlink/junction component 和 realpath escape；
- E2E 使用 test-only Worker Entry，不使用生产 `index.ts`；
- 本轮未启动 E2E，也未运行真实 Integration。

真实 Windows 低权限 ACL、跨账户删除和文件句柄 fencing 仍未验证。

## 13. Storage Inventory 结果

新增指标：

```text
fileCount
totalBytes
oldestMtime / newestMtime
symlinkCount
reparsePointCount (Windows link detection)
inaccessibleEntryCount
vanishedEntryCount
changedFileCount
scanComplete
capacity totals/free/available
```

保护：

- root 先 `lstat`，拒绝 symlink/junction；
- realpath 后再次核对目录身份；
- area link 不跟随；
- 每个文件 stat 前后核对 dev/inode/size/mtime；
- 扫描前后核对 root identity；
- 异常只计数并标记 scan incomplete；
- 不读取文件内容，不删除、不修改。

本轮没有扫描真实业务 `storage/private`，只使用隔离临时目录测试。大目录性能和所有 Windows reparse tag 的区分仍为 `PARTIAL`。

## 14. 队列与文件监控

已实现：

- 文件数、字节、oldest/newest；
- 容量；
- link/inaccessible/vanished/changed；
- scan completeness。

已设计但未实现：

- PgBoss backlog/retry/failed/oldest job；
- Worker consumption rate；
- Worker stopped consuming；
- FileVersion/Processing 长期未结束；
- upload failure / orphan candidate DB 指标；
- Prometheus/Alertmanager 或等价告警接入。

告警设计禁止自动删除。

## 15. 自动化测试结果

```text
Web:
21 files / 122 tests PASS

Worker:
6 files / 19 tests PASS

file-storage:
2 files / 19 tests PASS

Web TypeScript:
PASS (--noEmit --incremental false)

Worker TypeScript:
PASS (--noEmit --incremental false)
```

未运行：

- PostgreSQL；
- Integration；
- E2E；
- 真实 Worker/Web/Scheduler；
- 真实 Fixture；
- 真实 Storage 操作；
- 真实 Cleanup；
- Production Build；
- Production Deployment。

## 16. 独立攻击性审计

| 攻击问题 | 结果 |
|---|---|
| 是否遗漏 Maintenance Job | 仓库内 3 类 queue 已盘点；外部 Scheduler UNKNOWN |
| 是否遗漏启动立即执行 | 已追踪并 Mock 验证 |
| 是否遗漏 15 分钟调度 | 已追踪 schedule key 和 handler |
| Retry 是否获得删除能力 | 否；handler 无 Storage |
| Recovery/Requeue 是否删除 | 否；仅 DB/queue |
| Worker restart 是否绕过 | 启动重新进入 Gate 和无删除 maintenance |
| 是否可注入删除 capability | 普通接口不接收；quarantine 只会抛错 |
| 是否可动态 import 旧删除模块 | 当前源码无生产删除模块；扫描 unresolved=0 |
| 是否依赖 cleanup Feature Flag | 否；无启停 Flag |
| 是否存在测试回退真实 Storage | 无真实 Storage 测试路径；生产根未访问 |
| 是否可 symlink/junction 逃逸 Inventory | root 拒绝、entry 不跟随、realpath 检查 |
| 是否可测试路径逃逸删除 | test root guard + symlink/realpath tests |
| 是否发现生产 Prisma delete | 否 |
| Cascade 是否等于物理删除 | 否，单独报告 |
| 是否修改旧 `.next` / Worker `dist` | 否，哈希不变 |
| 是否破坏 L3/L4 Startup Gate | 未修改相关入口或摘要 |
| 是否修改数据库/ACL/服务 | 否 |

残留高风险不在源码能力层：

1. 生产旧 Worker 和 Scheduler 仍 `UNKNOWN`；
2. 旧 Worker 可能仍拥有宽 Storage ACL；
3. Production Storage delete permission 未撤销证明；
4. 真实 PgBoss 行为、Windows ACL、OS fencing 未执行；
5. Future Cleanup 尚未实现。

## 17. Future Cleanup 设计结果

已冻结原则：

- 独立身份、独立任务入口、独立删除权限；
- Web/Worker/Maintenance 默认无物理删除；
- Candidate Identification 与物理删除分离；
- Quarantine/Reservation；
- Final Revalidation；
- 检查 Version、Download、Upload、Lease、Operation、generation、路径复用和 COMMIT 状态；
- 物理结果与数据库状态分别记录；
- 告警不得自动删除；
- 回滚只能减少删除能力。

Future Cleanup 为 `DESIGNED / NOT IMPLEMENTED`。

## 18. 未执行操作

```text
No PostgreSQL connection
No SQL
No Prisma Migration
No Integration/E2E
No real Fixture
No real Storage access
No physical file deletion
No real Cleanup
No ACL/role/IAM/HBA change
No Runtime creation
No service start/stop/restart
No Scheduler/PgBoss external job start
No production deployment
No historical artifact delete/move/overwrite
No Git write
No .env or .env.test content read
```

## 19. 保护文件哈希

```text
apps/web/.next/BUILD_ID
06955B147BD0009CD09B566531E3D2BC93B77142582145564E219C1530F9F5A1

apps/worker/dist/file-maintenance.js
C6B5B0EBD2AD047CF32AE447470B19D2AB02F413DDB33BABF80828A6FEFCABE3

apps/web/tsconfig.tsbuildinfo
018C24B24976726C8837E6C70B57DA982DAE635E98C62BC721F3F63AEF7FF777

apps/web/next-env.d.ts
0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC

prisma/schema.prisma
78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299

P1-3 Migration
187D82A00DB73CB6F5D79C97DCD6B4FF2E01BD7E5F78BB9E1273D54D8A141479
```

## 20. L6 SHA-256

```text
packages/file-storage/src/capabilities.ts
07A0B074DBCD740CD8A1FDCAA8F7D9DC08E3E47EA2EE995D8268DDDC0BE54FC8

packages/file-storage/src/legacy-cleanup.ts
83B3F3D744C842C15873D58E2E0F765341D4EB6C905E1CDEEC0C26A17F73627E

packages/file-storage/src/local-private-storage.ts
E357C68CE605D9A601D343351F4C6412A840ACEE02D0C8FF7CAF7603555C4F24

packages/file-storage/src/index.ts
0158AAC873C5E3D31E8F76179A7B423B46E4403CC356A96A94844DB8CA62E92C

packages/file-storage/tests/capabilities.test.ts
B8968A6398A49497758A51D99ADD5A4F9153C8F37F29E555777CD14A3133D132

packages/file-storage/tests/local-private-storage.test.ts
BFF81287CEEE42B078FFB151C4D90C928EE146906030A99F9CBF9A09C8B13D26

apps/worker/src/storage.ts
A0717B341F55F58BFDDFCC1BF01F673F0A31A6525697B2486E570EA6C84BF3A7

apps/worker/src/file-processing.ts
4F7DE1D11E79B118CC6922E3B7D1EE230E06AF23BF550CD7E876B1EBCEDCB993

apps/worker/src/file-maintenance.ts
C19A4FBD2A9822CAB11809DC24672B5467B80F7835ED6E4BBBBDA4A0F9A0E81C

apps/worker/src/worker-entry.ts
180D1FB88161D9029F5DDFF373D6ED0EDA8155351BF8DDC30D7C49EA3EDC73D5

apps/worker/tests/legacy-cleanup-shutdown.test.ts
3EDB6F658E8899B5925601C08D25DD8A20C224D17026305F380BE4F6E6A28104

apps/worker/tests/storage-capability.test.ts
8B7158BC1BD48F58221EB56EBAAF0E480836FE9590417991BEE65FA1164753C8

apps/web/src/server/files/storage.ts
3544195A2635087C750674D735C86F5EB5A1C5688D2D56EBC69728813336487B

apps/web/src/modules/files/upload-service.ts
2A8F8880F038285D5B025E70688EF9DC1474BDB82F006D3D8B4A3B49BC948DF3

apps/web/src/modules/files/download-service.ts
A7CAB3DB6652879D1269650524BDACA761842A5BB037F57FC531864646AF297E

apps/web/scripts/p13-storage-delete-audit/scanner.ts
95D5D68D6ECAE53DF46A373B31D0A26A1751A1D10A3E341E038B81F8D22ED82D

apps/web/scripts/p13-storage-delete-audit/cli.ts
F7CF473E9F7402D121EDCFB1682332CACFF03B4A9308CC747A9291591A9A4854

apps/web/scripts/p13-storage-inventory/inventory.ts
EDBD064396A5637D60990B848F85EB162A1B24BE1773A1E88EA9C869BDED2046

apps/web/tests/p13-storage-inventory.test.ts
B2A525C8276FFB38C27B602A4734662DB76A9F4685A0BC2416373A3B979B8C03

apps/web/tests/p13-storage-delete-audit.test.ts
22AF6310A8F7BFB6D0AFDBBD5B55572899174D5A4529CA1F03E80463E7104C86

apps/web/tests/legacy-cleanup-shutdown.test.ts
02F38168AEAD89CC8A86B0A49B3B7763D76143D40F7E8CC926DCD759BDD65C8A

apps/web/tests/integration/phase32-upload-service.test.ts
95BEC37BEBC494188070233F809B49896151B88280A8B6756DDB86FEF847FFC7

apps/web/tests/integration/phase34-file-processing.test.ts
2847E575D73B7D3AAB084200CC99E39DB42CE74BD766828BDD7BD0961F281620

apps/web/tests/integration/phase35-lease-renewal.test.ts
D7FD3D0D79A2B9BA22CD7270B3E6B5AF06BA6972CFACCB8825B0891F16569FC0

apps/web/tests/integration/phase35-processing-reliability.test.ts
67552F81068D70C05DAA4A0A06E5537CEB613CB7CEE0F2A0B49E0944FA936B47

docs/architecture/file-lifecycle-p13-c6-2-l6-design.md
17C435C07FD2E084BB936AA0DD61FC3B26F0A33BD6E4CB19115D869F041CC96E

docs/architecture/file-lifecycle-p13-implementation-status.md
F0AC39099503E01687E0BF864DEAF200172438381966BED43F1A5BF040A7C23D

docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md
FE8088C9CF3F97032D9A78D6D1CCECE30D7593724CB161AF95534888DFC7C392
```

报告自身 SHA-256 在最终交付消息中提供。

## 21. 阶段门禁

```text
C-6.2-L6:
PASS WITH WARNINGS

Maintenance Job Inventory:
COMPLETE IN REPOSITORY

Immediate Startup Execution:
NON-DESTRUCTIVE / MOCK TESTED

15-Minute Schedule:
NON-DESTRUCTIVE / MOCK TESTED

Retry / Recovery / Requeue:
NON-DESTRUCTIVE

Physical Delete Entry Inventory:
COMPLETE IN REPOSITORY

Indirect Delete Call Paths:
FAIL-CLOSED / STATIC SCAN TESTED

Storage Capability Isolation:
IMPLEMENTED

Worker Delete Capability:
UNAVAILABLE

Maintenance Delete Capability:
UNAVAILABLE

Legacy Cleanup Fail-Closed:
PRESERVED

Test Storage Isolation:
VERIFIED IN ISOLATION

Storage Inventory:
READ-ONLY / PARTIAL METRICS

Queue / Storage Monitoring:
DESIGNED / DB METRICS NOT IMPLEMENTED

Future Cleanup Architecture:
DESIGNED / NOT IMPLEMENTED

Production Storage Delete Permissions:
NOT VERIFIED

Legacy Worker Drain:
NOT EXECUTED

Legacy Artifact Removal:
NOT EXECUTED

Production Deployment:
NOT EXECUTED

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```
