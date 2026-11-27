# WP-2A-CM1-R2 — Route C-Minimal Controlled Remediation

## 0. Document Control

```text
Stage:
  WP-2A-CM1-R2

Mode:
  CONTROLLED SOURCE REMEDIATION

Date:
  2026-11-26

Repository:
  D:\thinkbook\Desktop\jieya

Branch:
  codex/public-github-sync

HEAD:
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

origin/main:
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

Input R1 SHA-256:
  C923ACBF5F3D7DE7F93D0E8CDD92402FDAEEC9FC6791ECED53AE9BABC77FDFB3

Final result:
  CM1-R2 PASS WITH RESTRICTIONS — READY FOR LIMITED INDEPENDENT REVIEW
```

这次整改没有降低 P1-3 的权威状态机，也没有引入 Route C-Full 的
Permit、Authority Session、复杂 Evidence 或自动清理协议。它把 Route
C-Minimal 的对象发布接入既有 `FileUploadIntent`、`FileUploadAttempt`、
`StorageObjectLifecycle`、`StorageObjectOperation` 和 `FileVersion` 链。

本结论只表示源码和静态协议已经形成可复审基线。Migration 未应用，
PostgreSQL Trigger、并发、E2E、真实 Provider、Windows 文件系统、ACL 和运行时
仍未验证。

## 1. R1 Finding 逐项处置

R1 共 12 个 Finding：

```text
P1 = 7
P2 = 4
P3 = 1
```

| Finding | R2 状态 | 处置证据 |
|---|---|---|
| `CM1-R1-P1-01` Operation 跳步 | `RESOLVED` | 上传在新的派发事务中执行 `PREPARED -> EXECUTING`；最终事务只允许 `EXECUTING/UNKNOWN -> APPLIED`，并有静态/协议测试 |
| `CM1-R1-P1-02` Attempt/staging 终态冲突 | `RESOLVED` | object backend 使用 `COMPLETED + STAGING_READY` 的逻辑保留分支；本地成功路径用 identity-verified close proof 进入 `DELETED`；Migration 替换 Deferred 检查 |
| `CM1-R1-P1-03` Binding 归属和不可变性 | `RESOLVED` | 新增 binding/lifecycle/operation/FileVersion 复合 FK、binding 版本观察不可变 Trigger、FileVersion storage pointer 不可变 Trigger |
| `CM1-R1-P1-04` Object Key 唯一性 | `RESOLVED` | 新增 provider namespace/account/region/container/objectKey 唯一索引，覆盖 PENDING 和所有历史行 |
| `CM1-R1-P1-05` Provider exact version 恢复 | `RESOLVED — SOURCE` | Adapter 新增 Provider-neutral `discoverExact`；写后立即单独持久化 exact version/metadata；恢复只发现/读回 exact version，不重写 |
| `CM1-R1-P1-06` UPLOADING 永久悬挂 | `RESOLVED — SOURCE` | 新增加锁租约与 owner/generation takeover；支持 pre-dispatch resume、post-dispatch discover/finalize、旧执行者 CAS fencing |
| `CM1-R1-P1-07` Local Adapter 环境隔离 | `RESOLVED` | Web/Worker 只接受显式 `development` 或 `test`；缺失、`staging`、未知、拼写差异和 `production` 全部 fail closed，矩阵测试通过 |
| `CM1-R1-P2-01` 同 File 并发语义 | `RESOLVED` | Intent 记录 expected current version；数据库限制每个 File 最多一个 `UPLOADING` append Intent；发布使用 currentVersion CAS；E2E 期望改为一个 201、一个 409 |
| `CM1-R1-P2-02` Object 错误证据链 | `RESOLVED` | Web/Worker 将 missing/version/checksum/size/binding failure 映射到 integrity FAILED、SecurityEvent 和 blocked response；分类测试通过 |
| `CM1-R1-P2-03` 测试覆盖不足 | `PARTIALLY RESOLVED` | 已增加协议、恢复、错误分类、环境、Local Adapter、Migration 静态测试；真实 PostgreSQL 并发/COMMIT-loss 和真实 Provider 仍禁止执行 |
| `CM1-R1-P2-04` Local Adapter 文件身份/父路径 | `RESOLVED — LOCAL SOURCE` | root 全部路径组件、父目录、reparse/Junction、final identity、sync/close 均 fail closed；临时目录测试通过 |
| `CM1-R1-P3-01` CM1 报告过度表述 | `RESOLVED` | 本报告明确取代 CM1 §7 的旧表述：R1 时只有设计意图，R2 才实现持久化观察与恢复路径；运行时仍未验证 |

`RESOLVED` 在本报告中表示源码、静态协议或允许的本地测试已经覆盖该 Finding。
它不表示 PostgreSQL 或真实 Provider 已验证。

## 2. 根因与修复

### 2.1 R2-A：FINALIZE Operation

旧流程：

```text
create Operation PREPARED
Provider write
final DB transaction PREPARED -> APPLIED
```

新流程：

```text
reservation transaction:
  PREPARED

dispatch transaction before Provider call:
  PREPARED -> EXECUTING
  Operation expected size/hash persisted
  Attempt WRITING -> READY -> FINALIZING
  staging STAGING -> STAGING_READY

Provider call

final transaction:
  EXECUTING or UNKNOWN -> APPLIED
```

只有 `PREPARED -> EXECUTING` 后才会调用 Provider。最终事务带
`ownerToken + fencingGeneration + state + leaseExpiresAt > now` CAS。

### 2.2 R2-B：Attempt 与 staging

```text
Object store:
  STAGING_RESERVED -> STAGING -> STAGING_READY
  Attempt WRITING -> READY -> FINALIZING -> COMPLETED
  staging remains STAGING_READY as a logical retained record

Local:
  same staged chain with close identity proof
  STAGING_READY -> DELETED after validated finalize/rename
  Attempt FINALIZING -> COMPLETED
```

Migration 替换 `p13_collect_lifecycle_intent_ids`，只对 object backend 接受：

```text
Attempt COMPLETED + staging STAGING_READY
```

本地仍要求：

```text
Attempt COMPLETED + staging DELETED
```

本地 `WrittenUpload` 现在携带 `writerClosedAt` 和可选 `dev/ino`；不能在缺少
可靠 identity 时伪造 `closedIdentityVerified=true`。

### 2.3 R2-C：Binding 归属

新 Migration 新增：

```text
Binding(objectLifecycleId, objectKey)
  -> Lifecycle(id, storageKey)

Binding(operationId, objectLifecycleId, objectKey)
  -> Operation(id, objectLifecycleId, storageKey)

FileVersion(storageObjectBindingId, creationOperationAttemptId, storageKey)
  -> Binding(id, operationId, objectKey)
```

因此数据库本身拒绝：

- Binding 指向另一个 Lifecycle；
- Binding 使用另一个 Operation 的 storage key；
- FileVersion 绑定不在其 creation Operation 下的 Binding。

同时：

- `storageBackend` 和 `storageObjectBindingId` 发布后不可更新；
- lifecycle backend 必须与 FileVersion backend 一致；
- `writeObservedAt` 后 Provider exact identity 不可修改；
- Binding 不可删除或截断。

### 2.4 R2-D：Object Key

新增非空唯一索引：

```text
UNIQUE(
  providerKind,
  accountScopeRef,
  region,
  bucketOrContainer,
  objectKey
)
```

它不再依赖可空 `providerVersionId`，因此：

- 两个 PENDING binding 不能占用同一 key；
- 同一 key 的不同版本也不能被新上传复用；
- 事务回滚后 key 可重新进入未占用状态；
- 已提交失败/历史记录仍占用该 key，后续不能复用。

应用仍生成随机 UUID，但唯一性是数据库最终保证。

### 2.5 R2-E：精确版本持久化与恢复

Adapter 新增：

```text
discoverExact({
  objectKey,
  idempotencyKey,
  expectedSizeBytes,
  expectedChecksumSha256,
  maxBytes,
  signal
})
```

恢复顺序：

```text
reload durable Attempt/Operation/Lifecycle/Binding
-> require operation lease expired
-> CAS takeover ownerToken/generation
-> compare request SHA-256 with persisted operation snapshot
-> if exact observation exists: read exact version
-> else discover exact version by reserved key/idempotency identity
-> read exact bytes and verify size/SHA-256
-> only then CAS binding PENDING -> VERIFIED and publish FileVersion
```

恢复不会调用 `writeImmutable`。如果无法发现精确版本：

```text
keep UPLOADING / FINALIZING/RECOVERY_REQUIRED / Operation UNKNOWN
retain object
return controlled 409
```

不得把 latest object、ETag、时间戳或空字符串当作 exact version。

### 2.6 R2-F：租约与旧执行者

新增 `ObjectUploadLeaseController`：

- lease 默认 120 秒，续租间隔默认 30 秒；
- 每次续租同时检查 Operation、staging Lifecycle、canonical Lifecycle；
- owner、generation、lease 不一致时立即 abort Provider signal；
- finalization 使用 owner/generation/live-lease CAS；
- takeover 单调增加 generation；
- 旧执行者在 takeover 后只能得到 rowcount 0，不能创建 FileVersion。

中断恢复：

| 持久状态 | 决策 |
|---|---|
| `WRITING + PREPARED` | 仅可恢复 pre-dispatch 路径，重新验证内容后进入 EXECUTING |
| `FINALIZING + EXECUTING` | 不得重写，必须发现 exact version |
| `FINALIZING/RECOVERY_REQUIRED + UNKNOWN` | 只读发现/读回，可转 APPLIED |
| `COMPLETED` 或 FileVersion 已存在 | 返回既有结果 |
| exact version 无法证明 | 保留并 fail closed |

### 2.7 R2-G：Local Adapter

Web/Worker 环境选择只接受：

```text
development
test
```

以下全部返回 `undefined` / fail closed：

```text
undefined
""
staging
production
unknown
Test
"test "
```

Local Adapter 的路径处理现在：

- 拒绝 root 中任意 reparse/symlink path component；
- 拒绝 parent namespace 被替换；
- open 前后核对 dev/ino 与 size；
- write 使用 exclusive create；
- write `sync` 和 close 失败不会被视为成功；
- read 只在关闭成功后返回结果。

这仍是 Local development/test Adapter，不是生产对象存储实现。

## 3. 上传状态机

### 3.1 正常对象上传

```text
Intent PENDING
-> validate actor/project/content/MIME
-> compute expected SHA-256
-> reserve Intent/Attempt/Lifecycle/Operation/Binding
-> Intent UPLOADING
-> Operation PREPARED
-> dispatch transaction
   -> Operation EXECUTING
   -> Attempt FINALIZING
   -> staging logical STAGING_READY
-> Provider write
-> exact readback
-> persist providerVersionId / size / SHA-256 / requestId
-> final CAS transaction
   -> Binding VERIFIED
   -> Operation APPLIED
   -> canonical Lifecycle ACTIVE
   -> Attempt COMPLETED
   -> FileVersion/Extraction/current pointer
   -> Intent COMPLETED
```

Object staging remains `STAGING_READY` as logical retained authority. No physical
delete is inferred from this state.

### 3.2 本地开发上传

```text
Intent PENDING
-> local write with close identity
-> local chain STAGING_READY + close attestation
-> FILE FINALIZE operation EXECUTING
-> local finalize/rename
-> staging DELETED with identity proof
-> canonical ACTIVE
-> Attempt COMPLETED
-> FileVersion / current pointer / Intent COMPLETED
```

如果本地物理 rename 成功而 DB 事务失败，恢复通过 canonical key
重新读取和校验对象，然后完成数据库发布；不会删除 canonical object。

### 3.3 同 File 并发上传

创建 Intent 时记录：

```text
expectedCurrentFileVersionId
```

claim 时数据库只允许每个 File 一个 `UPLOADING` append Intent。最终发布再次
锁定 File 并比较 currentVersion。并发结果只能是一个赢家；另一个在 Provider
调用前或最终 CAS 前被拒绝。

## 4. Schema、Migration 和数据库不变量

### 4.1 Schema changes

`FileUploadIntent`:

```text
expectedCurrentFileVersionId
```

`StorageObjectBinding`:

```text
providerRequestId
writeObservedAt
UNIQUE(provider namespace + objectKey)
UNIQUE(id, operationId, objectKey)
```

### 4.2 New forward Migration

```text
prisma/migrations/20261127120000_phase38_route_c_minimal_recovery_hardening/migration.sql
SHA-256 620AB1452B87D0BD9E77B221745BE92E47363DF281CBE01AD317CE01190BF9C1
```

保护的不变量：

| 不变量 | 数据库机制 |
|---|---|
| binding 属于同一条 Operation/Lifecycle/key | 两个复合 FK + deferred check |
| FileVersion 只引用其 creation Operation 的 Binding | FileVersion 复合 FK + Trigger |
| 发布后 storage identity 不可改 | FileVersion storage pointer Trigger |
| exact version 一旦观察不可改 | Binding observation immutability Trigger |
| PENDING object key 不复用 | namespace/objectKey UNIQUE |
| 每个 File 只有一个活动 append | partial UNIQUE index |
| object Completed 可保留 staging | p13 lifecycle chain function branch |
| local Completed 必须物理 staging terminal | DELETED + close identity requirement |

Migration 没有被执行。以上是静态 SQL 结论，不是 PostgreSQL 实际行为证明。

## 5. 修改文件

### 5.1 Source

```text
prisma/schema.prisma
packages/file-storage/src/object-storage-adapter.ts
packages/file-storage/src/object-storage-environment.ts
packages/file-storage/src/local-object-storage-adapter.ts
packages/file-storage/src/capabilities.ts
packages/file-storage/src/local-private-storage.ts
packages/file-storage/src/index.ts
apps/web/src/modules/files/object-upload-service.ts
apps/web/src/modules/files/object-upload-protocol.ts
apps/web/src/modules/files/object-upload-lease.ts
apps/web/src/modules/files/upload-service.ts
apps/web/src/modules/files/download-service.ts
apps/web/src/server/files/storage.ts
apps/worker/src/storage.ts
apps/worker/src/file-processing.ts
```

### 5.2 Migration

```text
prisma/migrations/20261127120000_phase38_route_c_minimal_recovery_hardening/migration.sql
```

### 5.3 Tests updated

```text
packages/file-storage/tests/capabilities.test.ts
packages/file-storage/tests/object-storage-adapter.test.ts
apps/web/tests/legacy-cleanup-shutdown.test.ts
apps/web/tests/e2e/phase32-upload.spec.ts
```

### 5.4 Tests added

```text
packages/file-storage/tests/local-object-storage-adapter.test.ts
packages/file-storage/tests/object-storage-environment.test.ts
apps/web/tests/object-storage-environment-factory.test.ts
apps/web/tests/object-storage-integrity.test.ts
apps/web/tests/object-upload-migration.test.ts
apps/web/tests/object-upload-protocol.test.ts
apps/web/tests/object-upload-source-order.test.ts
apps/worker/tests/object-storage-environment.test.ts
apps/worker/tests/object-storage-integrity.test.ts
```

### 5.5 Report

```text
docs/architecture/wp-2a-route-c-minimal-controlled-remediation-r2.md
```

## 6. 测试与验证结果

### 6.1 Executed

```text
pnpm db:validate
PASS

pnpm db:generate
PASS

pnpm typecheck
PASS — 8 workspace projects

pnpm --filter @elevator/file-storage test
PASS — 5 files / 35 tests

pnpm --filter @elevator/web test
PASS — 33 files / 315 tests

pnpm --filter @elevator/worker test
PASS — 8 files / 29 tests

pnpm --filter @elevator/contracts test
PASS — 4 files / 15 tests

pnpm --filter @elevator/selection-engine test
PASS — 2 files / 9 tests

pnpm --filter @elevator/file-storage build
PASS — package TypeScript declaration build only
```

`@elevator/file-storage build` 是为刷新 workspace 本地类型声明而执行的 package
TypeScript 编译，不是 Web/Worker production Build，也没有启动应用、访问外部
Provider 或部署。

### 6.2 Test-to-invariant mapping

| 要求 | 证据 | 是否真实并发/故障 |
|---|---|---|
| Operation 合法/非法转换 | `object-upload-protocol.test.ts`、source-order | 逻辑/静态，否 DB |
| Attempt/Lifecycle 成功/失败/恢复 | protocol tests、source-order、Migration static | 逻辑/静态，否 DB |
| Binding 跨链/重绑攻击 | Migration static tests | SQL 静态，否 PostgreSQL |
| Object key 冲突 | Local Adapter duplicate test、Migration unique | 本地真实 FS + SQL 静态 |
| Provider 成功但 DB 失败 | source ordering/recovery planner | 未进行真实 Provider/DB fault |
| Provider response loss/进程中断 | discovery tests + recovery planner | 本地逻辑，否真实 Provider |
| 旧执行者与恢复者竞争 | owner/generation/lease source assertions | 否真实双连接 |
| 环境矩阵 | common + Web + Worker matrices | 真实函数执行，否部署 |
| Web/Worker exact version | source-binding checks + adapter exact read tests | 否真实 Provider/DB |
| Legacy delete/cleanup | existing shutdown/static tests | 真实纯本地测试，否 Storage |

### 6.3 Not executed

```text
PostgreSQL connection
Migration application
TRIGGER/Deferred/FK behavior in PostgreSQL
two-session concurrency
real COMMIT response-loss injection
E2E service/browser runtime
real Provider adapter
real object I/O
Windows ACL/Effective Access
Web/Worker production build
security:startup
deployment/service restart
```

## 7. 外部依赖与剩余阻断

### 7.1 Source-level remaining

`CM1-R1-P2-03` remains `PARTIALLY RESOLVED`：源码测试已补齐，但“真实数据库两
session 竞态”和“真实 Provider side-effect count”只能由后续隔离环境验证。

### 7.2 External blockers

```text
Provider account/region/API version:
  NOT SELECTED

Provider conditional create:
  NOT VERIFIED

Provider exact-version discovery:
  CONTRACT IMPLEMENTED / REAL PROVIDER NOT VERIFIED

Provider IAM read/write separation:
  NOT VERIFIED

PostgreSQL isolated migration:
  NOT EXECUTED

PostgreSQL Trigger and constraint behavior:
  NOT VERIFIED

Historical object inventory:
  NOT EXECUTED

Windows ACL and filesystem identity:
  NOT VERIFIED

PostgreSQL production roles/ACL:
  NOT IMPLEMENTED

Legacy Worker drain:
  NOT EXECUTED

Production deployment:
  NOT AUTHORIZED
```

历史治理状态不变：

```text
R5 57 Open Decisions: OPEN
BV7: FAIL
BV8: NOT INDEPENDENTLY APPROVED
Historical R8: BLOCKED
```

### 7.3 Safety restrictions

- Production UI cannot use Local Object Adapter.
- No real Provider adapter exists, so production object upload remains fail-closed.
- No automatic delete, purge, restore, quarantine or orphan cleanup was enabled.
- Unverified exact versions remain retained and fail-closed.
- This implementation does not authorize PostgreSQL clone or deployment.

## 8. Git 状态与文件完整性

### 8.1 At R2 start

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       15
Staged:                 0
Deleted:                0
Untracked:              46
```

### 8.2 At R2 end

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       19
Staged:                 0
Deleted:                0
Untracked:              60
```

除授权的 Route C-Minimal 源码、Schema、Migration、测试和本报告外，没有修改
其他业务模块。没有使用 Git 写操作，没有删除或移动既有报告和未跟踪工作。

未读取或操作：

```text
$null
UNKNOWN'
apps/web/.next
apps/worker/dist
.env
.env.test
```

`git diff --check` 通过，仅有既有 CRLF 转换提示。

### 8.3 File integrity

```text
Schema:
  88C25F8C243B0C23A51778AA6434BF253A011FFBF17FAB253D16E1B756E942CD

R2 Migration:
  620AB1452B87D0BD9E77B221745BE92E47363DF281CBE01AD317CE01190BF9C1

Object upload service:
  40B2AD57E05CE6CB644C0323A0E7542E5E5E388FD44BBE58EF703BA60E277276

Upload service:
  D98DF756B3B80942B60BD49ACC8D8C37016BA55F131C2DC869E3262896F9795E

Download service:
  52785E80F3CC3EA4C1B839AB5E9AE4B6B03DC9F003BC6DA467947962EB5B7646

Local object adapter:
  9E85BADD1E5CF96E3D4E0CD217E051A1780C29AC5774ED8BD09D3337EE04388D
```

报告不能在不改变自身字节的情况下嵌入自己的 SHA-256。最终 SHA-256、字节数和
行数在文件冻结后的交付消息中提供，不使用自引用或旧哈希。

## 9. Final Verdict

```text
CM1-R2 PASS WITH RESTRICTIONS
— READY FOR LIMITED INDEPENDENT REVIEW

Resolved at source/static/local-test level:
  all seven R1 P1 findings
  P2-01, P2-02, P2-04, P3-01

Partially resolved:
  P2-03 real PostgreSQL concurrency and real Provider fault tests

Not verified:
  PostgreSQL Execution
  Migration Application
  Trigger Behavior
  Real Provider
  OS/ACL
  E2E
  Runtime Recovery

Next:
  independent review only
```

