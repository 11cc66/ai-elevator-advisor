# P1-3 Storage Cleanup 全链路审计与统一生命周期整改设计

## 文档信息

- 设计版本：`C-6.2-K`
- 日期：`2026-11-18`
- 代码基线：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- 设计状态：`FROZEN FOR REVIEW WITH OPEN IMPLEMENTATION AND POLICY DECISIONS`
- 数据库：`NOT CONNECTED`
- SQL：`NOT EXECUTED`
- 实现授权：`NOT GRANTED`

本文形成 Storage Cleanup 的统一整改基线。文中“FROZEN”只表示 J 阶段已经冻结的前置决策；本文新增的架构建议标为 `RECOMMENDED`，需要产品或安全负责人确认的事项标为 `NEEDS DECISION`，需要代码或数据库实施才能消除的风险标为 `IMPLEMENTATION BLOCKER`。这些标签不代表功能已经实现或验收。

## 1. 结论摘要

当前仓储、上传、清理和审计链路存在以下实质性风险：

1. Web 请求在创建 Upload Intent 时同步执行物理文件清理，绕过 P13 Lifecycle、Operation、Attestation、对象级 lease 和 generation fencing。
2. Worker 每 15 分钟直接删除过期 Intent 的 staging/object，并调用 `cleanupOrphanObjects()` 删除未被当前查询引用的对象。
3. Orphan 扫描使用“先查引用、后删文件”的非原子协议；查询后新建的引用无法阻止旧扫描结果删除文件。
4. 现有上传业务链仍为 legacy 路径，不创建 `FileUploadAttempt`、`StorageObjectLifecycle` 或 `StorageObjectOperation`；`FileVersion.create()` 未提供当前 Prisma Schema 的三个 P1-3 必填关联字段。
5. Upload 失败处理会在任意异常后删除 object/staging，包括数据库 COMMIT 结果未知或服务端实际已经提交的情况。
6. 物理删除能力未经过与 `readVerifiedObject()` 同等级别的 root、reparse point、file identity、size、hash 和 namespace 校验。
7. `AuditLog` 只具备行级 UPDATE/DELETE 防护，不具备独立 TRUNCATE Trigger，且 `actorUserId -> user ON DELETE SET NULL` 与行级不可变性之间存在待实测冲突。
8. 当前没有可表达 never-created、created-empty、partial-write、closed-complete 和 physical-unknown 的统一写入证据模型。

因此当前旧清理链不能视为安全实现，也不得在新路径启用前与新路径并行执行物理删除。

## 2. 审计范围与证据等级

### 2.1 已执行

- 只读检查 Git 分支、HEAD 和工作树；
- 只读检查 Prisma Schema、原始 P1-3 Migration、A Migration、B Migration；
- 只读检查 Upload API、Web upload service、Worker maintenance、storage adapter、download service、maintenance lease；
- 只读搜索全部 `fs.*`、`remove*`、`delete*`、`rm`、`rename`、`TRUNCATE`、Prisma delete 调用；
- 只读检查相关集成测试和 package scripts；
- 只读检查原始设计冻结、C-5.1、J 设计、测试计划和实现状态。

### 2.2 证据等级

| 等级 | 含义 |
|---|---|
| CODE FACT | 直接由当前源码或 Migration 确认 |
| DOC FACT | 由已审核设计文档确认 |
| INFERENCE | 由代码路径推导，但未进行运行时验证 |
| RECOMMENDATION | 本文建议，尚未批准或实现 |
| NOT_VERIFIED | 必须通过真实 PostgreSQL、进程或文件系统测试确认 |

### 2.3 未执行

- 未连接 PostgreSQL；
- 未执行 SQL；
- 未运行 Prisma 数据库命令；
- 未执行 Fixture；
- 未执行文件系统删除；
- 未修改 Schema、Migration、业务代码、测试工具、测试或 Git。

## 3. Storage Cleanup 全量资产盘点

### 3.1 物理对象创建、写入与读取

| ID | 代码入口 | 调用者 | 对象 | 当前行为 | P13 接入 | 主要风险 |
|---|---|---|---|---|---|---|
| C-K-01 | `packages/file-storage/src/local-private-storage.ts:165` `writeToStaging()` | Web `completeUpload()`、测试 | STAGING | 以 `wx` 创建文件、流式 hash、成功后关闭；异常时 `fs.rm` 部分文件 | 否 | 创建前没有数据库 write-intent 证据；`rm` 是清理旁路 |
| C-K-02 | `local-private-storage.ts:226` `finalize()` | Web `completeUpload()`、测试 | STAGING -> CANONICAL | `access` 后 `rename` | 否 | 存在检查/移动 TOCTOU；未校验 staging/object identity、hash、namespace |
| C-K-03 | `local-private-storage.ts:277` `readVerifiedObject()` | Web download | CANONICAL | lstat 路径组件、realpath、`O_NOFOLLOW`、identity/size/hash 校验 | 否 | 读取侧保护较强，但与清理 claim 没有共享引用锁 |
| C-K-04 | `local-private-storage.ts:651` `openReadStream()` | Worker PDF processing | CANONICAL | 只做字符串级 `#resolveKey()` 后 `createReadStream()` | 否 | 不具备 `readVerifiedObject()` 的 symlink/reparse/identity/hash 保护 |

未发现云对象存储 SDK 删除接口；当前物理对象能力集中在本地文件系统 adapter。

### 3.2 物理删除入口

| ID | 代码入口 | 调用者 | 对象类型 | 当前行为 | Operation / Attestation | 风险 |
|---|---|---|---|---|---|---|
| D-K-01 | `apps/web/src/modules/files/upload-service.ts:147` `cleanupExpiredUploadIntents()` | 每次 `createUploadIntent()`，`upload-service.ts:220` | STAGING + CANONICAL | 查过期 Intent，先物理删除，再更新 Intent | 无 / 无 | Web 可删除；查询与删除非原子；写入可继续；重复 Worker 清理 |
| D-K-02 | `upload-service.ts:641` upload catch | `completeUpload()` | CANONICAL + STAGING | 任意异常后删除 object/staging，然后尝试标记 FAILED | 无 / 无 | COMMIT 未知或已成功时可能误删 canonical object |
| D-K-03 | `apps/worker/src/file-maintenance.ts:268` expired Intent block | 15 分钟维护任务及 Worker 启动任务 | STAGING + CANONICAL | 直接 `removeStaging()`、必要时 `removeObject()`，随后更新 Intent/AuditLog | 无 / 无 | 全局 lease 不等于对象 lease；旧 Worker 可继续删除 |
| D-K-04 | `file-maintenance.ts:360` orphan block | `runFileMaintenance()` | CANONICAL `objects/` | 查询 FileVersion 和非 EXPIRED Intent 引用，调用 `cleanupOrphanObjects()` | 无 / 无 | 引用查询后新增引用可被误删；FINALIZING/QNING 等 P13 状态未纳入 |
| D-K-05 | `local-private-storage.ts:547` `cleanupOrphanObjects()` | Worker only | CANONICAL top-level regular file | 按 filename、mtime 和传入引用集合删除 | 无 / 无 | 无 DB 二次确认、hash、identity、AuditLog、Operation |
| D-K-06 | `local-private-storage.ts:605` `cleanupTemp()` | Worker only | `temp/` 任意项 | 递归 `fs.rm(..., {recursive:true})` | 无 / 无 | 无 P13 记录；`stat` 跟随链接；Reparse Point 行为未验证 |
| D-K-07 | `local-private-storage.ts:252` `removeStaging()` | Web/Worker | 任意 `staging/` key 或合法 root 内 key | `fs.rm(..., {force:true})` | 无 / 无 | 无 namespace、identity、hash 或 claim 校验 |
| D-K-08 | `local-private-storage.ts:256` `removeObject()` | Web/Worker | 任意 `objects/` key 或合法 root 内 key | `fs.rm(..., {force:true})` | 无 / 无 | 同上；可能删除 ACTIVE/恢复中对象 |
| D-K-09 | `apps/web/scripts/test-db/cli.ts:88` reset | 测试脚本 | 测试 storage root、测试 DB、pgboss schema | 校验测试身份后删除测试根并 reset DB | 不适用 | 测试专用；不属于生产路径 |
| D-K-10 | `packages/file-storage/tests/local-private-storage.test.ts:36` | 测试 teardown | 临时 storage root | 递归删除 mkdtemp 目录 | 不适用 | 测试专用 |
| D-K-11 | `apps/web/tests/integration/phase33-file-access.test.ts:189` | 测试 | test object | `fs.rm(objectPath)` 模拟对象丢失 | 不适用 | 测试专用 |

### 3.3 数据库记录删除与状态修改

| ID | 入口 | 当前事实 | 结论 |
|---|---|---|---|
| DB-K-01 | 生产 `apps/`、`packages/` Prisma delete 搜索 | 未发现 File、FileVersion、UploadIntent、Attempt、Lifecycle、Operation 的生产 delete 路由 | CODE FACT；不等于 Runtime ACL 已阻止 |
| DB-K-02 | `p13_protect_upload_intent()` | 拒绝 DELETE；限制状态转换 | 已实现 |
| DB-K-03 | `p13_protect_upload_attempt()` | 拒绝 DELETE；限制身份与状态 | 已实现 |
| DB-K-04 | `p13_protect_storage_lifecycle()` | 拒绝 DELETE；限制状态 | 已实现 |
| DB-K-05 | `p13_protect_storage_operation()` | 拒绝 DELETE；限制状态 | 已实现 |
| DB-K-06 | `p13_protect_file_version_identity()` | 拒绝 FileVersion DELETE | 已实现 |
| DB-K-07 | `File` 模型 | 只有 `status`，没有删除 Guard | 尚无统一软删除/归档协议 |
| DB-K-08 | 测试 `phase31-schema.test.ts:225` | 尝试 FileVersion delete 并断言拒绝 | 测试专用 |
| DB-K-09 | `test-db/cli.ts:102` | DROP 测试 `pgboss` schema 后 migrate reset | 测试专用，受身份 Guard 约束 |

### 3.4 Application lifecycle 状态接入

在 `apps/` 和 `packages/` 中搜索 `fencingGeneration`、`currentOperationId`、`closeAttestationId`、`storage_object_lifecycle`、`FileUploadAttempt`、`StorageObjectOperation`，只命中 Fixture Builder 和静态 Migration 测试，没有命中生产上传、Worker、download 或 cleanup 代码。

结论：

```text
P13 数据库结构：已实现
P13 生产业务接入：NOT IMPLEMENTED
现有上传：LEGACY PATH
现有清理：LEGACY PATH
```

## 4. IB-01：Orphan Scanner 深度审查

### 4.1 调用链与调度

```text
apps/worker/src/index.ts
  -> PgBoss FILE_MAINTENANCE_QUEUE
  -> cron "*/15 * * * *"
  -> Worker 启动时额外立即执行一次
  -> runFileMaintenance()
  -> acquireMaintenanceLease()
  -> runFileMaintenanceUnlocked()
  -> query FileVersion.storageKey
  -> query Intent.objectStorageKey where status != EXPIRED
  -> cleanupOrphanObjects(referencedObjectKeys, TEMP_RETENTION_MS)
```

### 4.2 逐项结论

| 审查项 | 事实 |
|---|---|
| 并发维护 Session | 全局 `file_maintenance_lease` 串行化普通 Maintenance |
| 对象级并发 | 无 Object Operation claim、无 per-storageKey lease |
| 引用快照 | 两个普通查询，不在同一可串行化事务中 |
| P13 引用 | 不查询 Lifecycle、Attempt、Operation、Quarantine |
| 分页 | 扫描全部 `objects/` 目录项，无分页上限 |
| orphan 判定 | 当前引用集合中不存在，且 mtime 足够旧 |
| 二次确认 | 无数据库二次确认 |
| 物理身份 | `fs.stat()` 后使用 mtime，无 dev/ino/hash/reparse 校验 |
| 正在 FINALIZE | canonical 尚未形成 FileVersion/legacy Intent 引用时可能被误删 |
| 正在 RESTORE/PURGE | 不查询 P13 状态，无法区分 managed in-progress |
| 删除后数据库更新 | 无；删除成功本身不记录 AuditLog/evidence |
| 失败重试 | 下一轮重新扫描；失败细节只进入应用日志和计数 |
| Worker 崩溃 | 无 case、phase、evidence；无法判断某个对象是否已经删除 |
| 重复删除 | `force:true` 使重复路径通常幂等，但不证明原删除由谁完成 |
| 多 Worker | 全局 lease 减少普通竞争；lease 丢失后旧 Worker 仍可能完成已开始的 FS 操作 |
| 审计 | 无逐对象不可变审计 |
| 自动化测试 | 覆盖“旧 orphan 被删”和 lease 接管，不覆盖并发新增引用、managed in-progress、旧 Worker FS 操作 |

### 4.3 已确认竞态

```text
Scanner 查询 referencedObjectKeys
  -> 结果不包含 key K
公司正常上传/Finalize 在新事务中创建对 K 的引用
Scanner 使用旧快照调用 cleanupOrphanObjects()
  -> 删除 K
数据库中的新引用指向已删除对象
```

`beforeDelete()` 仅调用当前 Worker 的 `lease.assertHeld()`。它不能重新确认对象级引用，也不能阻止 lease 在断言后、`fs.rm()` 前失效。

### 4.4 设计不变量

任何真正删除 `objects/` 对象的流程必须满足：

1. 在数据库事务内持有规范化 `storageKey` 的同一把协调锁；
2. 所有可能创建该 key 引用的业务写入也持有同一把锁；
3. 获得锁后重新查询全部引用，而不是使用扫描阶段快照；
4. 先建立不可删除的 Cleanup Case / Operation claim；
5. 物理操作只针对 claim 中固定的 source identity 和 target；
6. 删除成功必须采集独立 evidence；
7. 只有 evidence 满足条件后才允许数据库进入终态；
8. 无法确认时必须进入 `UNKNOWN` 或 `FAILED_RETAINED`，不得靠重试猜测。

### 4.5 推荐协调协议

推荐新增数据库受控函数 `p13_lock_storage_key(storage_key)`，基于规范化 key 的 advisory transaction lock。所有以下事务必须首先调用：

- 创建普通 CANONICAL `FINALIZING`；
- 创建可能引用 canonical key 的 FileVersion；
- Finalize 完成并将其变为 ACTIVE；
- Orphan quarantine claim；
- Quarantine、Restore、Purge；
- 任何将对象纳入或移出 maintenance 管辖的转换。

锁内顺序固定为：

```text
advisory storageKey lock
  -> re-read reference set
  -> row locks in declared order
  -> insert/update Operation and Lifecycle
  -> commit
```

Advisory lock 是协作机制。任何绕过约定锁的写入口都会破坏不变量，因此还需要：

- Runtime 不直接写 Lifecycle/Operation；
- 关键写入只经受控数据库函数；
- CI 静态检查禁止业务代码直接更新 P13 状态；
- Clone 中做双连接真实并发测试。

### 4.6 旧 Worker 的真实边界

数据库 generation 只能阻止旧 Worker 更新数据库，不能终止已经进入操作系统的 `unlink`、rename 或文件句柄写入。因此：

- 不能声称 generation/lease 可以 fencing OS 操作；
- 旧 Worker 的删除权限必须在切换阶段先被撤销或禁用；
- 新旧删除路径绝不能同时具备实际删除能力；
- 对无法抢占的 OS 侧风险，使用单写入 Maintenance 部署、凭据轮换、进程排空、不可变对象路径和 Reconciliation 降低窗口；
- 必须通过故障注入验证旧进程在 lease 丢失后的行为。

## 5. IB-02：过期 Upload Intent 清理深度审查

### 5.1 当前路径

Web：

```text
createUploadIntent()
  -> cleanupExpiredUploadIntents()
  -> query PENDING/FAILED expired OR UPLOADING stale
  -> removeStaging()
  -> maybe removeObject()
  -> updateMany(status=EXPIRED)
```

Worker：

```text
runFileMaintenance()
  -> same eligibility surface
  -> removeStaging()
  -> maybe removeObject()
  -> transaction update Intent=EXPIRED + AuditLog
```

### 5.2 逐项结论

| 审查项 | 当前事实 |
|---|---|
| Intent 创建 | 只创建 legacy `FileUploadIntent` 和 legacy `stagingKey` |
| 过期时间 | 创建时 30 分钟；当前字段被 Trigger 视为不可修改 |
| 续期 | 当前无实现 |
| Attempt | 生产路径不创建 Attempt |
| Lifecycle | 生产路径不创建 Lifecycle |
| Operation | 生产路径不创建 Operation |
| 激活 | `PENDING -> UPLOADING` 通过 `updateMany` claim |
| 写入中判断 | `UPLOADING` + `claimedAt` 超过 15 分钟 |
| 心跳 | upload claim 后无 heartbeat，无对象级 lease |
| 物理删除顺序 | 先删除文件，后更新 Intent |
| 失败处理 | Web 静默吞掉删除错误；Worker 计数并记录日志，但仍更新 Intent |
| 并发 | `updateMany` 仅对最终 DB 更新提供条件，不保护此前物理删除 |
| 幂等 | 无 Operation/evidence idempotency key |
| 恢复证据 | 无 |
| 审计 | Web 路径无 AuditLog；Worker 仅记录 Intent 终态，不记录物理结果 |

### 5.3 核心不变量

```text
Intent 过期
!= Attempt 已停止
!= 文件句柄已关闭
!= 物理内容可删除
!= 文件已经不存在
!= Lifecycle 可以进入 DELETED
```

### 5.4 推荐 Intent Cleanup 状态机

Cleanup Case 与 Intent 状态分离，避免继续扩张单一 `EXPIRED` 字段：

```text
ACTIVE
  -> DISCOVERED
  -> CLASSIFIED
  -> ELIGIBLE
  -> CLAIMED
  -> PHYSICAL_DELETE_IN_PROGRESS
  -> PHYSICAL_DELETE_SUCCEEDED
  -> DATABASE_FINALIZED
  -> RECONCILED

任意阶段可进入：
  INELIGIBLE
  RETAINED
  DELETE_FAILED
  DELETE_UNKNOWN
  RECONCILIATION_REQUIRED
```

Intent 最终进入 `EXPIRED` 的条件：

- 已持有 Case claim；
- 关联 Attempt 均已终结且不再是 current；
- 没有 active Operation；
- 物理文件已验证不存在，或已经完成受控删除及 evidence；
- 没有 FileVersion；
- 最终事务通过 P13 Deferred Trigger。

### 5.5 条件矩阵

| Intent / Attempt / 物理状态 | 自动清理 | 目标处理 |
|---|---|---|
| PENDING，无 Attempt，staging 不存在已验证 | 允许 | Case -> EXPIRED |
| PENDING，无 Attempt，staging 存在 | 可进入受控 staging cleanup | 不得直接标记 EXPIRED 后遗留文件 |
| UPLOADING，Attempt RESERVED，证明从未创建 | 仅在 C 结构批准后允许 | terminal attempt + no-object evidence |
| UPLOADING，Attempt WRITING / FINALIZING | 禁止直接删除 | claim、fence、核验 close 或 Recovery |
| UPLOADING，Attempt RECOVERY_REQUIRED | 禁止自动删除 | Recovery |
| UPLOADING，Attempt READY，有完整 close proof | 可进入 Quarantine/Purge 清理 | 保留 close evidence |
| Intent 已续期 | 不满足 eligibility | 重新调度 |
| Intent 已 COMPLETED | 永不自动清理 | 正常保留策略 |
| 物理状态 UNKNOWN | 禁止自动删除 | 新连接/独立文件证据核验 |

### 5.6 Upload 失败路径

`completeUpload()` 的 catch 不得把客户端异常解释为数据库未提交。目标协议：

1. 将 upload completion 拆成明确阶段；
2. 对 DB transaction outcome 使用 `committed / rolled_back / commit_unknown / rollback_failed`；
3. `commit_unknown` 时禁止直接删除 canonical object；
4. 使用新连接按 Intent/Attempt/Operation 核验；
5. 物理对象由 Cleanup Case/Operation 回收，不在请求 catch 中直接 `removeObject()`；
6. Web Runtime 不拥有物理删除能力。

## 6. IB-03：Never-created / Empty STAGING 数据模型

### 6.1 必须区分的状态

| 状态 | 含义 |
|---|---|
| NOT_CREATED_PROVEN | 有创建前证据和后续不存在核验，能够证明从未创建 |
| CREATE_STARTED | 已提交物理创建意图，可能已经调用 `open()` |
| CREATED_EMPTY | 路径曾被创建并关闭，大小为 0 |
| PARTIAL | 已写入部分内容，未完成 close attestation |
| COMPLETE_CLOSED | 完整写入、close、size/hash/identity 已验证 |
| ABSENT_VERIFIED | 在指定时间和身份上下文中核验路径不存在 |
| UNKNOWN | 无法确认是否存在、是否创建或是否关闭 |

`sizeBytes IS NULL` 只能表示未完成内容快照，不能自动证明 never-created。当前 `DELETED` 的 close attestation 要求 `closedSizeBytes > 0`，因此不能把空文件或从未创建对象伪装成现有 DELETED。

### 6.2 方案比较

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| A. 扩展 Lifecycle 字段 | 查询集中 | Lifecycle 同时承担对象登记、删除证明和工作流；容易把“对象记录存在”误当成物理对象存在；需要修改大量状态约束 | 备选 |
| B. 扩展 Attempt write phase | 与上传所有权一致；能在物理调用前记录意图；适合 CAS | 单靠枚举仍缺少不可变证据 | 推荐的一部分 |
| C. 独立 Creation/Write Evidence | 强审计、可追加、可记录每次观察 | 新增表和清理/保留策略 | 推荐的一部分 |
| D. 用 `size=0`/不存在直接推断 | 无需新结构 | 混淆 never-created、empty、partial、未检查，不可接受 | 拒绝 |

### 6.3 推荐方案

推荐组合 B + C：

1. `FileUploadAttempt` 增加强类型 `physicalWriteState`：

```text
NOT_STARTED
CREATE_INTENT_RECORDED
CREATE_STARTED
CREATED_EMPTY
WRITE_IN_PROGRESS
CLOSED
ABSENT_VERIFIED
DELETE_IN_PROGRESS
DELETED_VERIFIED
UNKNOWN
```

2. 新增 append-only `StorageWriteEvidence`，至少记录：

- attemptId；
- storageKey；
- phase；
- ownerToken；
- fencingGeneration；
- operation/case id；
- 观测时间；
- size；
- SHA-256；
- dev/ino 或平台等价 identity；
- 路径为 regular file / absent / unknown；
- reparse/symlink 检查结果；
- 本地安全错误码；
- 唯一 sequence/idempotency key。

3. 创建顺序：

```text
Attempt RESERVED + STAGING_RESERVED 事务提交
  -> 记录 CREATE_INTENT
  -> ownerToken/generation claim
  -> CREATE_STARTED evidence
  -> fs.open(..., "wx")
  -> 写入
  -> fsync（平台支持时）
  -> close
  -> CLOSED evidence + size/hash/identity
  -> STAGING_READY + close attestation
```

4. 如果进程在 `CREATE_STARTED` 前崩溃，后续可通过 `ABSENT_VERIFIED` 证明没有创建；如果已经 `CREATE_STARTED`，只能进入 `UNKNOWN` 或隔离，不得声称从未创建。

5. 空文件记录 `CREATED_EMPTY`，上传业务拒绝为有效文件；数据库不得伪造 close attestation。

6. 当前 P13 状态机下，never-created/empty 的安全终态建议为 `STAGING_ABANDONED + physicalWriteState=ABSENT_VERIFIED`，而不是 `DELETED`。如果业务要求清理元数据，应新增受控 metadata archive 状态，不改变物理删除证明。

### 6.4 备用方案

在 `StorageObjectLifecycle` 增加：

```text
physicalPresenceState
writeStartedAt
writeClosedAt
physicalEvidenceId
```

该方案可查询集中，但需要重构现有 `STAGING_RESERVED`、close attestation 和清理状态约束，且不能替代 append-only evidence 表，因此仅作为备选。

### 6.5 待决策

- never-created Lifecycle 是否允许从 `STAGING_RESERVED -> STAGING_ABANDONED`；
- empty file 的元数据保留期；
- 是否引入独立 metadata archive 状态；
- “证明从未创建”的允许时间窗口与观测次数。

## 7. 统一 Storage Cleanup 架构

### 7.1 信任区

```text
Request Runtime
  -> 只可创建/推进业务记录；无物理删除能力

Upload Writer
  -> 仅写随机 staging key；不删除 canonical

Maintenance Worker
  -> 唯一物理 cleanup 执行者

Recovery Operator
  -> 处理 UNKNOWN/FAILED_RETAINED；不直接绕过 Operation

Database Definer
  -> NOLOGIN；只实现受控状态转换

Storage Adapter
  -> 按 capability 拆分；maintenance capability 只注入 Maintenance Worker
```

### 7.2 新统一流程

#### Step 1: Discovery

Discovery 只读，不删除：

- 扫描 `objects/`、`staging/`、`quarantine/`、`temp/`；
- 查询 Lifecycle、Attempt、Intent、Operation、FileVersion、Approval/Case；
- 生成稳定 `inventorySnapshotId`、路径快照、mtime、size、identity 和缺失项；
- 对数据库期望存在但物理缺失、或物理存在但数据库未知的对象分别登记；
- 没有分页上限的老化对象必须分批，any batch loss 不改变“未检查”与“不存在”的区别。

#### Step 2: Classification

分类值：

```text
REFERENCED_ACTIVE
REFERENCED_READ_ONLY
ELIGIBLE_STAGING
ELIGIBLE_CANONICAL_ORPHAN
MANAGED_IN_PROGRESS
MANAGED_TERMINAL
CORRUPT_REFERENCE
PARTIAL_WRITE
TEMP_ONLY
UNKNOWN
UNSAFE
```

`UNKNOWN`、`UNSAFE`、`CORRUPT_REFERENCE` 只能隔离或人工审查，不能删除。

#### Step 3: Eligibility Verification

数据库必须保证：

- Lifecycle/key/state 身份；
- currentOperation；
- Operation type/state/path；
- ownerToken/generation/lease；
- FileVersion 双向关系；
- Upload chain；
- close attestation；
- Deferred 最终关系；
- backup/purge approval 的唯一性（新 Schema 后）。

Worker 必须保证：

- storage root identity；
- path namespace；
- 每一级目录不是 reparse/symlink；
- source 是 regular file；
- size/hash/identity；
- target 不存在；
- 当前 claim 仍由本 Worker 持有。

#### Step 4: Cleanup Operation Creation

统一概念记录：

```text
StorageCleanupCase
  - id
  - idempotencyKey UNIQUE
  - kind: STAGING_INTENT | ORPHAN_CANONICAL | MANAGED_PURGE | TEMP
  - objectLifecycleId?
  - uploadIntentId?
  - uploadAttemptId?
  - storageKey?
  - state
  - ownerToken?
  - fencingGeneration?
  - leaseExpiresAt?
  - operationId?
  - eligibilitySnapshot
  - createdAt / updatedAt / terminalAt
```

已有 `StorageObjectOperation` 继续表示 P13 对象状态转换；`StorageCleanupCase` 表示一次物理清理工作。二者通过 operationId 关联。TEMP 或 legacy metadata 没有 Lifecycle 时，Case 仍是强制记录。

每个重复扫描必须有稳定 idempotency key，例如：

```text
kind + normalized storageKey + lifecycleId/attemptId + source generation
```

相同 key + 相同证据返回原 Case；证据不一致时拒绝并转人工。

#### Step 5: Claim / Lease

Claim 事务必须：

1. 获取 storageKey advisory lock；
2. re-read eligibility；
3. 确认没有其他 active Case/Operation；
4. `fencingGeneration += 1`；
5. 生成随机 ownerToken；
6. 设置有限 lease；
7. 写入 AuditLog；
8. commit。

执行期间：

- heartbeat 使用 `WHERE ownerToken = :owner AND generation = :generation AND lease > now()`；
- 每次 CAS 失败立即停止后续 DB 和 FS 操作；
- 任何 DB 更新都带 owner/generation/lease；
- 旧进程即使继续运行，也不能更新新 claim。

数据库不能终止旧进程已发出的 FS 调用；部署和 Recovery 必须承认该边界。

#### Step 6: Physical Cleanup

强制状态：

```text
DELETE_NOT_STARTED
DELETE_IN_PROGRESS
DELETE_SUCCEEDED
DELETE_FAILED
DELETE_UNKNOWN
```

执行规则：

- 先写 `DELETE_IN_PROGRESS`，再发出破坏性调用；
- 只能操作 Case 固定的 source 和 target；
- 禁止按目录模式猜测或递归删除客户对象；
- 目标不覆盖；rename/link 必须使用原子 no-overwrite 语义；
- 删除前后都验证 root/path identity；
- Provider 超时、连接中断、权限错误和非法路径分别分类；
- 失败或未知保留文件，不自动 `DELETED`。

#### Step 7: Evidence Collection

新增 append-only `StorageCleanupEvidence`：

```text
caseId
operationId?
sequence
evidenceType
storageKey
sourcePath
targetPath?
observedExists
observedRegularFile
observedSymlinkOrReparse
observedSizeBytes
observedChecksumSha256
observedDev
observedIno
workerIdentity
ownerTokenDigest
fencingGeneration
providerRequestId?
safeResultCode
observedAt
```

`remove()` 返回 success 不等于独立 evidence。至少需要“目标路径不存在”或“quarantine target 存在且 source 不存在”的受控核验。

#### Step 8: Database Finalization

顺序必须为：

```text
claim committed
-> physical action
-> evidence committed
-> CAS finalization transaction
-> Operation APPLIED
-> Lifecycle DELETED
-> Intent/Attempt terminal as applicable
-> Case DATABASE_FINALIZED
```

禁止：

```text
Lifecycle DELETED -> 稍后删除文件
```

物理删除成功但 DB finalization 失败时，文件已不存在；Operation 保持 `EXECUTING/UNKNOWN`，由独立连接和 evidence 完成幂等 finalization。数据库 finalization 成功但物理文件仍存在，在正确顺序下不应发生；如果发生，视为 integrity incident，不得简单再次 `DELETED`。

#### Step 9: Reconciliation

对账扫描至少输出：

| 对账项 | 处理 |
|---|---|
| DELETED 但文件仍存在 | 安全事件；不自动复用对象 |
| PURGE_PENDING 但文件不存在 | 查找 evidence；无证据转 Recovery |
| QUARANTINED 但目标不存在 | 不得推断成功；查 source/evidence |
| Operation EXECUTING 超时 | 先重验 claim/path，不直接 FAILED |
| Operation APPLIED 但 evidence 缺失 | P1 integrity incident |
| Case active 且 lease 过期 | 新 owner CAS 接管；旧 owner 禁用 |
| 状态与文件未知 | RETAINED，人工审核 |

## 8. STAGING、CANONICAL 与 TEMP 的差异化策略

### 8.1 STAGING

- 普通创建只能 `STAGING_RESERVED`；
- 写入 owner 必须与 Attempt 一致；
- 非空 cleanup 必须有完整 close attestation；
- 推荐先 quarantine 再 purge，而不是直接 staging unlink；
- never-created 只用 write evidence 表达，不伪造 close attestation；
- active writer、recovery-required 和 physical-unknown 不自动清理。

### 8.2 CANONICAL

- ACTIVE + FileVersion 永不进入普通 cleanup；
- FINALIZING 仅由 Recovery 处理；
- orphan 只能按 J 定义的窄条件进入特殊 QNING；
- PURGE 必须有 approval、grace、无 FileVersion 和完全一致的 lifecycle/operation；
- DELETED 与物理 evidence 绑定，但数据库仍不能证明 OS 操作，需要独立 evidence。

### 8.3 TEMP

- `temp/` 不承载客户文件，不得被当作 canonical 或 staging 的存放位置；
- Cleanup Case 仍需记录 path、mtime、size、identity、worker 和结果；
- 对目录项使用 lstat，不跟随 symlink/reparse；
- 对目录的递归清理必须验证每一项仍是存储服务创建的普通目录/文件，不能直接 `rm -r` 任意 reparse point；
- 未知类型保留并告警。

## 9. Storage Adapter 安全改造要求

### 9.1 能力拆分

当前 `PrivateStorageAdapter` 同时向 Web 暴露 `removeObject()`/`removeStaging()`。建议拆成：

```text
UploadWriteAdapter
  - reserveStaging
  - writeStaging
  - closeAndAttest
  - finalizeNoOverwrite

ObjectReadAdapter
  - readVerified

MaintenanceAdapter
  - inspect
  - quarantineMove
  - purgeQuarantine
  - cleanupTemp
  - observeAbsence
```

Web Runtime 只获得前两类。`MaintenanceAdapter` 只注入 Maintenance Worker 和受控测试 Harness。

### 9.2 路径和身份

所有 destructive capability 必须：

- 对 namespace 做精确 allowlist；
- 拒绝绝对路径、分隔符变体、`..`、空字节和大小写别名；
- lstat root 和每一级组件；
- 拒绝 symlink、junction 和其他 reparse point；
- 在操作前后校验 root/path identity；
- 对源文件做 regular-file、size、hash 和 dev/ino 比对；
- 对目标做 no-overwrite；
- 对失败/未知保留，不盲目重试删除。

`#resolveKey()` 的字符串检查只用于前置防御，不能替代物理身份检查。

## 10. Worker 双轨迁移与下线

| Phase | 目标行为 | 物理删除权限 | 进入条件 | 监控/回滚 |
|---|---|---|---|---|
| 0. Containment | 停止所有自动 orphan/Intent 物理删除 | Legacy OFF / P13 OFF | 立即生产风险控制 | 若需要恢复旧路径，仅限明确安全窗口 |
| 1. Discovery Only | 新 Scanner 只生成 inventory/Case 候选 | 两者 OFF | Schema/Adapter 具备只读能力 | 异常率/未知比例高则继续观察 |
| 2. Shadow Classification | 新旧分类结果只比较，不执行删除 | 两者 OFF | Discovery 基线稳定 | 差异列入人工队列 |
| 3. New Operation Creation Disabled（Legacy Cleanup Freeze） | 禁止创建新的 legacy cleanup 资格/Operation；旧删除保持 OFF | OFF | 上传链已切换或 legacy 写入已冻结 | 遗留 case 进入冻结清单 |
| 4. P13 Cleanup Enabled | 新 Case/Operation 执行物理清理 | P13 ON / Legacy OFF | Clone、权限、Recovery、审计均通过 | 任何 unknown/failed 立即降级到 reconcile |
| 5. Legacy Path Disable | 移除旧路径的调用和配置入口 | Legacy OFF | 新路径连续稳定并通过积压审计 | 不启用旧删除回滚 |
| 6. Reconciliation | 清理 Unknown/不一致/历史对象 | 仅 P13 controlled | 历史数据盘点完成 | 人工队列不自动绕过 |
| 7. Old Code Removal | 删除旧代码和无用功能开关 | P13 ONLY | 独立审计通过 | 代码级回滚，不回退数据协议 |

关键约束：

- Phase 2 的 shadow 仍是只读，不能“比较后自动删除”；
- Phase 3 的“New Operation Creation Disabled”解释为冻结新的 legacy cleanup eligibility，不关闭已经批准的 P13 Case 设计；
- Phase 4 与 Phase 5 不能在两个 Worker 实例上同时授予物理删除；
- 旧 Worker 部署必须排空、撤权、撤销 secret；
- 不允许用“新旧结果一致”替代并发和安全测试。

## 11. AuditLog 完整不可变性

### 11.1 当前事实

`audit_log` 有 `BEFORE UPDATE OR DELETE` Trigger，返回 `42501`。当前没有 `BEFORE TRUNCATE` Trigger。`actorUserId` 有 `ON DELETE SET NULL`。

### 11.2 两类不可变性

| 类型 | 含义 | 当前状态 |
|---|---|---|
| Row-level immutable | 行级 UPDATE/DELETE 被阻止 | Trigger 存在；TRUNCATE 不受其保护 |
| Table-level immutable | TRUNCATE、CASCADE、批量重建都不能移除历史 | 未实现 |

### 11.3 推荐分层

1. 保留 UPDATE/DELETE Trigger；
2. 增加 `BEFORE TRUNCATE` Guard，返回 `42501`；
3. Runtime/Worker 不拥有 TRUNCATE、DDL、Owner、SET ROLE；
4. `TRUNCATE ... CASCADE` 也纳入测试；
5. 用户不物理删除，只停用/归档；
6. 将 `actorUserId` FK 的删除行为改为 `RESTRICT/NO ACTION`，或在 AuditLog 中保存不可变 actor 快照；
7. 审计保留/归档通过只读、追加式外部存储或 WORM；不得由 Runtime 删除；
8. Owner/Migrator 的维护必须独立审批、记录和备份；
9. 如果未来分区，必须阻止 Runtime DROP/TRUNCATE 分区，并在每个分区上保留 Guard；
10. 只有“Runtime 不能改写”不等于“Owner/Superuser 不可能改写”；对 Owner 的强证明需要外部审计存储。

后两项属于 `NOT_VERIFIED`，必须通过真实 clone/权限测试。

## 12. 威胁模型

| ID | 攻击路径 | 影响 | 现有保护 | 缺失保护 | 推荐缓解 | 测试 |
|---|---|---|---|---|---|---|
| T-K-01 | Runtime 伪造 Cleanup Operation | 误删 | P13 Trigger | Runtime 角色/Operation 写限制未完成 | Runtime 不直接写 P13 表；专用受控函数 | K-SEC-01 |
| T-K-02 | Runtime 伪造 Attestation | 误删 | close checks | 生产无 P13 接入，Attestation 写入路径未实现 | Attestation 只由受控 writer 写；APPEND-only evidence | K-SEC-02 |
| T-K-03 | Worker 越权删除 | 数据丢失 | 全局 lease | 无 capability 分层、无 Operation | maintenance-only adapter；最小角色 | K-SEC-03 |
| T-K-04 | Worker 使用旧 Lease | 删除新对象 | owner/generation/lease CAS（数据库设计） | 旧 Worker 的 OS 操作不可 fencing | 排空旧进程、撤权、同一时间仅一条 delete path | K-REC-01 |
| T-K-05 | 重放旧 Operation | 重复删除/覆盖 | terminal Operation immutable | 无 Case idempotency/evidence | request/case idempotency key；terminal 不复用 | K-REC-02 |
| T-K-06 | 篡改 Storage Key | 路径逃逸 | `#resolveKey`、namespace check | `remove*()` 无 identity/ns 强制 | capability + exact namespace + reparse check | K-SEC-04 |
| T-K-07 | 跨项目/客户删除 | 越权数据丢失 | 业务查询有 project scope | cleanup 引用查询无 project/tenant 防御 | key 绑定项目/客户快照；清理入口只接受 case 生成的 key | K-SEC-05 |
| T-K-08 | 删除正常 FileVersion | 文件与 DB 不一致 | FileVersion delete Trigger | 旧 scanner 依据引用快照 | 锁内复验、ACTIVE 永不清理 | K-ORPH-03 |
| T-K-09 | 并发创建引用 | 删除新引用对象 | DB FK | 无统一 key lock | writer/cleaner 共用 advisory lock | K-ORPH-04 |
| T-K-10 | 伪造 orphan 证据 | 隔离/删除正常对象 | 无 | 证据模型缺失 | 专用 evidence、命中率、二次扫描和人工复核 | K-ORPH-05 |
| T-K-11 | 伪造审批 | 进入 Purge | 无 | approval 表/身份缺失 | 独立审批记录 + separation of duties | K-PURGE-01 |
| T-K-12 | 过期 Intent 误清理 | staging/object 丢失 | 状态查询 | 过期时间不等于物理完成 | Attempt/close/physical state 联合 eligibility | K-INT-01 |
| T-K-13 | 物理删除成功 DB 更新失败 | 状态遗留 | 无 | 无 evidence/reconcile | `UNKNOWN` + evidence + idempotent finalize | K-REC-03 |
| T-K-14 | DB 状态成功但文件仍在 | 误以为已删 | 无 | 无 before/after proof | DB finalization 只接受 evidence | K-REC-04 |
| T-K-15 | AuditLog 被 TRUNCATE | 审计链断裂 | UPDATE/DELETE Trigger | 无 TRUNCATE Trigger/ACL | TRUNCATE Guard + 角色分离 + 外部副本 | K-AUD-01 |
| T-K-16 | Maintenance Worker 被攻陷 | 批量删除 | 全局 lease | 无对象级能力、无审批 | 受限凭证/网络/FS path、双人审批、budget/rate limit | K-SEC-06 |
| T-K-17 | Definer search_path 劫持 | 调用恶意对象 | J 设计建议 | 函数尚不存在 | `SET search_path=pg_catalog`，对象全限定，Runtime 无 Schema CREATE | K-SEC-07 |
| T-K-18 | Migrator 权限泄漏 | DDL/数据破坏 | Migrator NOLOGIN/密码 NULL | Runtime/Definer 角色未实现 | 临时启用、临时密码、clone、恢复 NOLOGIN/NULL | K-PERM-01 |
| T-K-19 | Worker 崩溃 | 状态未知/重复删除 | 全局 lease | 无 case/evidence | discovery/reconcile；未知保留 | K-REC-05 |
| T-K-20 | 对象存储不可用 | 清理卡住/误报 | 基础错误处理 | 无可用性状态机 | `DELETE_UNKNOWN` + backoff + 人工队列 | K-REC-06 |

## 13. 完整测试矩阵

测试层级标记：

```text
STATIC
UNIT
INTEGRATION
DATABASE
REAL COMMIT
FAILURE INJECTION
SECURITY
FS
```

### 13.1 Orphan Cleanup

| ID | 场景 | 类型 | 预期 |
|---|---|---|---|
| K-ORPH-01 | 真正 orphan，claim 成功，移动 quarantine，evidence 完整 | DB + FS + REAL COMMIT | 成功且 Lifecycle/Operation/Case/Audit 一致 |
| K-ORPH-02 | 有 FileVersion 引用 | DB | 不进入清理 |
| K-ORPH-03 | FINALIZING 或 RESTORING 对象 | DB + FS | `MANAGED_IN_PROGRESS`，不删除 |
| K-ORPH-04 | 扫描后并发新建引用 | INTEGRATION + REAL COMMIT | 新引用成功则扫描失败；扫描成功则引用失败 |
| K-ORPH-05 | 错误 Hash/Identity | FS | 拒绝删除，进入 UNKNOWN/retained |
| K-ORPH-06 | 错误 generation | DB | 旧 claim 的 UPDATE 影响 0 行 |
| K-ORPH-07 | 同一 key 重复扫描 | UNIT + DB | 返回同一 Case，不产生第二 active Case |
| K-ORPH-08 | Scanner 崩溃后重跑 | FAILURE INJECTION | 由 evidence 决定继续或人工审查 |
| K-ORPH-09 | 目录/symlink/reparse 项 | FS | 不删除，标记 unsafe |
| K-ORPH-10 | 目标已存在 | FS | no-overwrite，保留源和目标 |

### 13.2 Expired Intent Cleanup

| ID | 场景 | 类型 | 预期 |
|---|---|---|---|
| K-INT-01 | PENDING、尚未创建文件、ABSENT_VERIFIED | DB + FS | 安全进入 EXPIRED，仅当 C 结构批准 |
| K-INT-02 | UPLOADING、active writer | DB + FS | 不清理 |
| K-INT-03 | UPLOADING、close 完成、READY | DB + FS | 经 quarantine/purge 清理 |
| K-INT-04 | Intent 已续期 | DB | 不清理 |
| K-INT-05 | Failed Attempt 但无 close proof | DB | retained/UNKNOWN |
| K-INT-06 | Lifecycle 存在但 Attempt 缺失 | DB | integrity incident，不推断 |
| K-INT-07 | Operation EXECUTING | DB | 不并行创建清理 |
| K-INT-08 | 两个 worker 同时 claim | DB + REAL COMMIT | 一个赢，一个不删除 |
| K-INT-09 | 物理删除失败后重新运行 | FAILURE INJECTION | 新 Case 或 UNKNOWN，不自动 `DELETED` |
| K-INT-10 | FileVersion 已存在 | DB | 永不清理 |

### 13.3 Physical Delete

| ID | 场景 | 类型 | 预期 |
|---|---|---|---|
| K-PHYS-01 | 对象存在、regular、identity/hash 匹配 | FS | DELETE_SUCCEEDED + absence evidence |
| K-PHYS-02 | 对象不存在 | FS | ABSENT_VERIFIED；不伪造 close |
| K-PHYS-03 | 删除权限拒绝 | FS | DELETE_FAILED，保留 DB 非终态 |
| K-PHYS-04 | Provider/OS 超时 | FS + FAILURE INJECTION | DELETE_UNKNOWN |
| K-PHYS-05 | 删除后 DB commit 失败 | DB + FAILURE INJECTION | 新连接核验 evidence 后 finalize |
| K-PHYS-06 | 删除前 lease 丢失 | DB + FS | 停止，不继续 destructive call |
| K-PHYS-07 | 重复删除同一 Case | UNIT + FS | 不产生第二次副作用 |
| K-PHYS-08 | 删除后对象重新出现 | FS + RECONCILE | integrity incident，不覆盖 |
| K-PHYS-09 | 路径 identity 变化 | FS | fail closed |
| K-PHYS-10 | Temp 目录项为 symlink/junction | FS | 不递归删除目标 |

### 13.4 Recovery / Reconciliation

| ID | 场景 | 类型 | 预期 |
|---|---|---|---|
| K-REC-01 | lease 过期后旧 Worker 继续 | FAILURE INJECTION | DB CAS 拒绝；FS 风险明确记录 |
| K-REC-02 | 旧 Operation 重放 | DB | terminal 不复用 |
| K-REC-03 | EXECUTING 超时 | DB + RECONCILE | 新连接核验，不直接 FAILED |
| K-REC-04 | APPLIED 但 evidence 缺失 | STATIC + RECONCILE | 告警，不自动补造 |
| K-REC-05 | Worker 崩溃后重启 | FAILURE INJECTION | 从 Case/evidence 恢复 |
| K-REC-06 | 对象存储不可用 | FS | 保留/retry policy，不删除 DB 终态 |
| K-REC-07 | DELETED + 对象存在 | FS + RECONCILE | 安全事件 |
| K-REC-08 | PURGE_PENDING + 对象不存在 | FS + RECONCILE | 查证据或人工 |

### 13.5 AuditLog

| ID | 场景 | 类型 | 预期 |
|---|---|---|---|
| K-AUD-01 | UPDATE/DELETE/TRUNCATE AuditLog | SECURITY + REAL COMMIT | 全部失败；TRUNCATE 需新 Guard |
| K-AUD-02 | Runtime 无 AuditLog TRUNCATE | SECURITY | 失败 |
| K-AUD-03 | Owner/Migrator 维护 | SECURITY | 独立审批/记录；不可当 Runtime 成功 |
| K-AUD-04 | actor User 删除 | SECURITY + REAL COMMIT | 不改变或阻断历史；待决策 |
| K-AUD-05 | cleanup 每个对象写入审计 | INTEGRATION | Case/Operation/Audit 原子关联 |
| K-AUD-06 | Audit append 失败 | FAILURE INJECTION | 清理事务整体回滚 |

### 13.6 Security / Permission

| ID | 场景 | 类型 | 预期 |
|---|---|---|---|
| K-SEC-01 | Runtime 写 Lifecycle/Operation | SECURITY | 拒绝 |
| K-SEC-02 | Runtime 调用 Definer 特殊函数 | SECURITY | 拒绝 |
| K-SEC-03 | Web 调用 Maintenance capability | STATIC | 无能力注入 |
| K-SEC-04 | key 包含 `..`、绝对路径、替代分隔符 | UNIT + FS | 拒绝 |
| K-SEC-05 | 跨项目 key/Intent | INTEGRATION | 拒绝 |
| K-SEC-06 | compromised Maintenance | SECURITY | 只能操作 Case path，不能任意 key |
| K-SEC-07 | Definer search_path 劫持 | SECURITY + DB | 失败/只调用限定对象 |

### 13.7 Clone 与真实 COMMIT

| ID | 场景 | 类型 | 预期 |
|---|---|---|---|
| K-CL-01 | 每个成功 Fixture/Cleanup 真实 COMMIT | REAL COMMIT | clone 内通过 |
| K-CL-02 | Deferred Trigger 最终失败 | DATABASE | 整事务回滚 |
| K-CL-03 | clone 丢弃后无残留 | INTEGRATION | storage root/DB/角色无残留 |
| K-CL-04 | 禁止访问开发/测试库 | SECURITY | 连接目标验证失败即停 |

## 14. Schema Gap Register

| Gap ID | 问题 | 当前结构 | 建议结构 | 影响 | 优先级 |
|---|---|---|---|---|---|
| SG-K-01 | orphan evidence 非强类型 | AuditLog JSON | `StorageCleanupEvidence` / orphan evidence 表 | 证据查询、唯一性弱 | P1 |
| SG-K-02 | purge approval 不强制 | AuditLog JSON 约定 | 独立 approval 表/唯一 key | 可能伪造/竞争 | P1 |
| SG-K-03 | 无 physical delete phase | Operation state | Case + Evidence state | 无法区分成功/失败/未知 | P1 |
| SG-K-04 | never-created/empty 不可表达 | Lifecycle size/close | Attempt physicalWriteState + Evidence | IB-03 误删/误判 | P1 |
| SG-K-05 | Maintenance/Definer/Recovery 角色缺失 | 文档设计 | NOLOGIN 角色、最小 ACL | 权限边界不可证明 | P1 |
| SG-K-06 | Operation idempotency 弱 | 无 request key | Case idempotency UNIQUE | 重放/重复删除 | P1 |
| SG-K-07 | Intent cleanup 无 Case | 只有 Intent status | CleanupCase 关联 Intent/Attempt/Lifecycle | 物理与 DB 双轨 | P1 |
| SG-K-08 | staging direct purge 无统一 Operation | lifecycle state 允许 DELETED，PURGE path 只接受 quarantine | `CLEANUP` operation 或先 quarantine | 旧路径无法统一 | P1 |
| SG-K-09 | 无统一 key coordination | 只有部分 FOR UPDATE | advisory xact lock + writer gatekeeper | Scanner 竞态 | P1 |
| SG-K-10 | 无独立 claim/lease/evidence | 全局 lease | per-object Case claim + generation | 旧 Worker 竞争 | P1 |
| SG-K-11 | AuditLog 无 TRUNCATE Guard | UPDATE/DELETE only | BEFORE TRUNCATE Trigger + ACL | 表级可破坏 | P1 |
| SG-K-12 | Audit actor FK SET NULL | user FK | RESTRICT 或 actor snapshot | 历史可能被Mutation | P2 |
| SG-K-13 | File metadata 无删除协议 | File status only | archive/soft-delete policy | 元数据孤儿 | P2 |
| SG-K-14 | Storage adapter 能力过宽 | remove methods on generic interface | capability interfaces | Web 越权删除 | P1 |
| SG-K-15 | Managed vs legacy object inventory 不完整 | filesystem scan only | DB/FS reconciliation inventory | 历史对象不可追踪 | P1 |
| SG-K-16 | 多租户扩展预留 | 单企业 V1 | project/owner/scope snapshot | 未来跨 scope | P3 / RESERVED |

## 15. Decision Register

| Decision ID | 问题 | 推荐 | 备选/拒绝 | 状态 |
|---|---|---|---|---|
| K-D01 | 物理删除唯一入口 | Maintenance Cleanup Gateway | 拒绝 Web/一般 Worker 直接删除 | RECOMMENDED |
| K-D02 | Web 请求 cleanup | Web 只创建候选/Intent，不删除 | 拒绝同步请求内清理 | RECOMMENDED |
| K-D03 | Orphan 并发 | 所有 writer/cleaner 共用 key advisory lock + 二次引用 | 拒绝先查后删 | RECOMMENDED |
| K-D04 | DB DELETED 时机 | 物理 evidence 后 finalization | 拒绝 DB 先 DELETED | FROZEN / J |
| K-D05 | Physical state | Case/Evidence 显式 phase | 拒绝用 Operation state 冒充文件事实 | RECOMMENDED |
| K-D06 | 清理 Case | 独立 Case + Operation link | 拒绝仅 AuditLog JSON | RECOMMENDED |
| K-D07 | Intent cleanup | 独立状态机 | 拒绝只凭 expiresAt | RECOMMENDED |
| K-D08 | never-created | Attempt write phase + evidence | 拒绝 size=0/不存在互推 | RECOMMENDED |
| K-D09 | 新旧 Worker | 单 delete owner 七阶段切换 | 拒绝双轨并行删除 | RECOMMENDED |
| K-D10 | Audit immutability | Trigger + ACL + external copy | 拒绝只靠应用层 | RECOMMENDED |
| K-D11 | generation fencing | DB CAS + process drain | 拒绝声称 DB 可终止 OS 操作 | FROZEN / J |
| K-D12 | 特殊协议角色 | NOLOGIN Definer + Maintenance | 拒绝 Runtime 直接特殊 INSERT | FROZEN / J |
| K-D13 | staging cleanup | 优先 quarantine 后 purge | 评估直接受控 staging purge | PROPOSED |
| K-D14 | grace/审批/保留期 | 参数化并有默认失败关闭 | 拒绝隐式 0 | NEEDS DECISION |
| K-D15 | Audit external sink | 后续独立 WORM/只读归档 | 暂不接真实服务 | PROPOSED |
| K-D16 | Runtime scope | 无 DDL/TRUNCATE/P13 special writes | 拒绝通用 DB owner 账号 | RECOMMENDED |
| K-D17 | File metadata deletion | 软归档优先 | 拒绝物理删除业务文件记录 | RECOMMENDED |
| K-D18 | orphan evidence table | 强类型表 | Audit JSON 长期替代 | NEEDS DECISION |

## 16. 实施路线图

| 顺序 | 路线项 | 前置 | 交付 | 代码范围 | DB 范围 | 测试/回滚 |
|---|---|---|---|---|---|---|
| 1 | Legacy cleanup containment | 风险评估 | 禁用旧定时/请求删除，保留只读扫描 | Worker/Web 配置 | 无 | 回滚只回配置，不回退已执行删除 |
| 2 | 上传链兼容修复设计 | P13 Schema 事实 | Attempt/Lifecycle/Operation 接入方案 | Web/Worker | 需要后续 Migration | 先静态/Clone，按功能开关 |
| 3 | Storage Adapter capability 拆分 | 安全设计 | Maintenance-only adapter | packages | 无 | 单测 + FS 失败注入 |
| 4 | Cleanup Case/Evidence Schema 设计 | K 审核 | 冻结字段、状态和唯一键 | 无 | 新 Migration 设计 | clone 迁移验证 |
| 5 | Roles/ACL/Definer | Schema 审核 | Runtime/Maintenance/Recovery 分离 | 无 | 角色/ACL 变更 | 身份隔离测试 |
| 6 | Intent/Lifecycle 接入 | upload chain | write phase + lock + close | Web | 可能新增字段 | clone + 真实 COMMIT |
| 7 | Orphan/Operation 接入 | key lock | Discovery/Claim/Quarantine | Worker | 函数/Trigger | 并发/崩溃注入 |
| 8 | AuditLog 完整化 | ACL | TRUNCATE Guard/actor 策略 | 审计写入方 | Trigger/ACL | 攻击用例 |
| 9 | 七阶段 Worker 切换 | 所有前序 | 单 delete owner | Worker | Reconciliation | 监控、降级到只读 |
| 10 | 历史对账与旧代码下线 | 稳定运行 | 差异清单、人工队列 | Worker | 只读 | 不回退旧删除路径 |
| 11 | 文件系统与 Runtime 验收 | clone | reparse/hardlink/lease 证据 | Storage/Worker | 无 | FS fault injection |

每一步都不能以“文档完成”替代代码、Migration、真实 clone 或权限验证。

## 17. 独立反向审计

本节刻意尝试推翻前面的设计。

| 反向问题 | 结果 | 处理 |
|---|---|---|
| 是否有遗漏删除入口 | 搜索覆盖 `fs.rm`、adapter、Worker、测试脚本；仍可能有外部运维工具 | 增加外部运维工具清单和启动前禁删清单 |
| 是否遗漏定时任务 | 找到 PgBoss 15 分钟与启动立即执行 | 写入旧路径阻断清单 |
| 是否遗漏 API 清理 | 找到 Web createUploadIntent 同步 cleanup | 禁止 Web cleanup capability |
| 是否遗漏 test cleanup | reset、global setup、tests 已分类 | 测试工具不得进入生产入口 |
| 是否遗漏异常删除 | catch 中 removeObject/Staging 已发现 | 改为 Case/Operation 回收 |
| 是否绕过 Operation | 旧 Web/Worker 都绕过 | 统一 Gateway 后仍可能绕过，需要静态门禁 |
| 双 Worker 竞争 | 全局 lease 不足以证明 OS 侧安全 | phase 3/4/5 只允许一个 delete owner |
| DB 引用与物理竞态 | 先查后删已确认 | advisory lock + 二次核验 |
| 旧 lease 删除新对象 | 可能发生在断连/恢复窗口 | 旧进程排空、独立 path、reconcile |
| 跨 scope 删除 | 当前单企业，但 key/project 关联需强约束 | Case evidence 记录 scope；Runtime 不接受任意 key |
| Intent 激活后误清理 | 当前按 stale claimedAt；新协议禁止 | 状态+lease+attempt 联合判断 |
| 零字节与不存在混淆 | 当前 Schema 无表达 | write evidence 方案 |
| 物理成功 DB 失败 | 有窗口 | UNKNOWN + 独立 observe + idempotent finalize |
| DB 成功物理失败 | 错误顺序可造成 | DB finalization 只在 evidence 后 |
| Audit TRUNCATE | 未防 | 新 Guard/ACL 作为 P1 |
| Runtime 越权 | 角色未创建 | 权限矩阵和 Clone 测试 |
| Definer search_path | 函数尚未实现 | 只允许 `pg_catalog` + 全限定对象 |
| 无法恢复故障窗口 | UNKNOWN/FAILED_RETAINED 保留并在 reconciliation 中处理 | 设置人工处理 SLA |
| 回滚不安全 | 旧删除不能作为回滚开关 | 只回滚到更少删除，不回滚到更多删除 |

## 18. 当前未解决问题与实施阻断

### P0/P1 阻断

1. `IB-01`：Worker orphan 物理删除绕过 P13 Lifecycle/Operation；
2. `IB-02`：过期 Intent 物理删除没有 Operation/Attestation/对象 claim；
3. `IB-03`：never-created/empty/partial/unknown 无法可靠区分；
4. 上传业务链与当前 P13 Schema 不兼容；
5. Web/Worker 双重清理；
6. 物理删除未经过 adapter 能力分层和安全路径校验；
7. Runtime、Maintenance、Definer、Recovery 角色尚未建立；
8. AuditLog TRUNCATE/完整不可变性未完成；
9. 无统一 key lock、Case、physical evidence；
10. 没有真实 Clone、并发、故障注入和真实 COMMIT 测试。

### 必须由项目负责人决策

- orphan evidence 是否独立强类型表；
- purge grace period、审批角色和审批窗口；
- never-created STAGING 的 metadata 归档形态；
- 是否允许正式引入 `CLEANUP` operation type；
- AuditLog 外部只读归档/保留方案；
- 旧代码下线的部署权限和时间窗口。

## 19. 当前阶段结论

```text
C-6.2-K design:
PASS WITH WARNINGS / REVIEW BASELINE

Storage Cleanup implementation:
NOT SAFE FOR ENABLEMENT

P13 production integration:
NOT IMPLEMENTED

Old cleanup paths:
IMPLEMENTATION BLOCKER

Database:
NOT CONNECTED

SQL:
NOT EXECUTED

Database Writes:
NOT EXECUTED
```
