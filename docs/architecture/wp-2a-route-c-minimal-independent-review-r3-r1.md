# WP-2A-CM1-R3-R1 — Independent Adversarial Source Review

## 0. Final Conclusion

```text
FAIL — SOURCE CORRECTIONS REQUIRED
```

本结论不是对 R3 报告格式或测试数量的否定。R3 的核心对象存储整改在源码层面有
明显改进，但独立审查确认 Local P1-3 上传链仍存在两个未闭合的 COMMIT-unknown
恢复窗口。它们会使 `UPLOADING` Intent 永久停在开放状态，且无法由现有
`recoverLocalUpload()` 安全接管。

因此本轮不允许把 R3 直接作为下一阶段受控 PostgreSQL 验证的完整源码基线。
PostgreSQL clone 可以验证已明确的对象路径和数据库约束，但必须同时先修正本报告
的 P1 恢复缺陷。

## 1. Document Control

```text
Stage:
  WP-2A-CM1-R3-R1

Mode:
  READ-ONLY INDEPENDENT ADVERSARIAL SOURCE REVIEW

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

Reviewed R3:
  docs/architecture/wp-2a-route-c-minimal-controlled-remediation-r3.md

Reviewed R3 SHA-256:
  F8C06EAB69ED0FD1DA5A9809C74FFDCFD1AF5CC27A63C461F8EC708122D555F5

Reviewed R3 bytes/lines:
  29452 / 708
```

输入哈希：

| 输入 | SHA-256 |
|---|---|
| R2-R1 独立审查 | `30D85D2D3CDCF1B5316C25B71D2BA3BC68303FA6E1749698E22E26488E847FD5` |
| R3 报告 | `F8C06EAB69ED0FD1DA5A9809C74FFDCFD1AF5CC27A63C461F8EC708122D555F5` |
| R3 Migration | `EE4128E7D7712DB425643A7790EBAF31E16317CD2D555D79AAE8ABE09B34485D` |
| Prisma Schema | `96C2B3C1F89A07FC1A79D57C3AC0563CACC5EE43AA93293B09ED4F3ED662CE77` |

## 2. Scope and Evidence Levels

本轮实际读取并交叉核对：

- `docs/architecture/wp-2a-route-c-minimal-controlled-remediation-r3.md`
- `docs/architecture/wp-2a-route-c-minimal-independent-review-r2.md`
- `docs/architecture/wp-2a-route-c-minimal-controlled-remediation-r2.md`
- `docs/architecture/wp-2a-route-c-minimal-controlled-implementation-cm1.md`
- `docs/architecture/wp-2a-route-c-minimal-independent-review-r1.md`
- `prisma/schema.prisma`
- `prisma/migrations/20261126120000_phase38_route_c_minimal_object_binding/migration.sql`
- `prisma/migrations/20261126130000_phase38_route_c_minimal_recovery_hardening/migration.sql`
- `apps/web/src/modules/files/object-upload-service.ts`
- `apps/web/src/modules/files/object-upload-protocol.ts`
- `apps/web/src/modules/files/object-upload-lease.ts`
- `apps/web/src/modules/files/upload-service.ts`
- `apps/web/src/modules/files/download-service.ts`
- `apps/worker/src/file-processing.ts`
- `apps/web/src/server/files/storage.ts`
- `apps/worker/src/storage.ts`
- `packages/file-storage/src/local-private-storage.ts`
- `packages/file-storage/src/local-object-storage-adapter.ts`
- `packages/file-storage/src/object-storage-adapter.ts`
- `packages/file-storage/src/object-storage-environment.ts`
- `packages/file-storage/src/object-storage-errors.ts`
- `packages/file-storage/src/object-storage-failure.ts`
- 相关 Service、Migration、Local storage、Adapter、环境门禁测试文件。

证据标签：

| 标签 | 含义 |
|---|---|
| `SOURCE VERIFIED` | 当前源码或测试文本直接可见 |
| `STATIC SQL` | 仅依据 PostgreSQL DDL/PLpgSQL 语义推导，未执行 |
| `LOCAL TEST` | 允许的本地纯文件系统、Mock/Repository 或单元测试 |
| `NOT VERIFIED` | 需要真实 PostgreSQL、Provider、Windows ACL 或运行时 |

本轮没有：

- 修改源码、测试、Migration、Trigger 或既有报告；
- 连接 PostgreSQL 或执行 SQL/Migration；
- 连接 Provider、Storage、IAM 或 ACL；
- 执行 Build、E2E、Native RPC、服务启动、部署或重启；
- 读取或输出 `.env`、密钥、密码、Token 或连接串；
- 读取、哈希、修改或删除 `$null`、`UNKNOWN'`、`.next` 或
  `apps/worker/dist`。

## 3. R2-R1 Finding Final Trace

R2-R1 原始分级为 `P0=0, P1=1, P2=5, P3=2`。

| Finding | 独立结果 | 证据与限制 |
|---|---|---|
| `CM1-R2-R1-P1-01` 写入/发现幂等身份不一致 | `RESOLVED — SOURCE` | `object-upload-protocol.ts:15-38`; `object-upload-service.ts:318-320,421-432,1185-1187,1319-1325,1514-1527`; strict Service fake Adapter |
| `CM1-R2-R1-P2-01` Adapter 故障被写成完整性失败 | `RESOLVED — SOURCE/LOCAL TEST` | `object-storage-failure.ts:4-85`; `download-service.ts:122-147,623-661`; Worker `:579-637` |
| `CM1-R2-R1-P2-02` close 前生成 close attestation | `RESOLVED — SOURCE/LOCAL TEST` | `local-private-storage.ts:158-194,595-692`; post-close replacement/symlink tests |
| `CM1-R2-R1-P2-03` Local Object Adapter 父目录 TOCTOU | `PARTIALLY RESOLVED` | 快照复核存在，但 Node core 无跨平台 handle-relative authority；production object adapter 仍不存在 |
| `CM1-R2-R1-P2-04` 非空历史数据 Migration | `PARTIALLY RESOLVED` | 有 fail-closed precheck；但 precheck 位于新增列 DDL 之后，脚本没有显式事务边界，真实 Migration 行为未验证 |
| `CM1-R2-R1-P2-05` VERIFIED Binding 终态关系 | `RESOLVED — STATIC SQL ONLY` | Migration `:461-617` 四个 deferred triggers 静态关系成立；未执行 PostgreSQL |
| `CM1-R2-R1-P3-01` 未来 Migration 时间戳 | `RESOLVED` | 目录为 `20261126130000_...`，排序晚于 `20261126120000_...` |
| `CM1-R2-R1-P3-02` R2 执行未授权 Build | `RESOLVED — HISTORY RECORDED` | R2 原文保留；R3 和本轮均未执行 Build |

## 4. R1 Twelve-Finding Final Trace

| R1 Finding | 最终结果 | 独立说明 |
|---|---|---|
| `CM1-R1-P1-01` Operation 跳步 | `RESOLVED — SOURCE` | dispatch 前执行 `PREPARED -> EXECUTING`，最终事务只接受合法前态 |
| `CM1-R1-P1-02` Completed/staging 冲突 | `PARTIALLY RESOLVED` | object/local 逻辑终态分支已存在；Local COMMIT-unknown 恢复仍有 P1 |
| `CM1-R1-P1-03` Binding 归属 | `RESOLVED — STATIC SQL` | 复合 FK、父唯一键、FileVersion pointer guard 存在 |
| `CM1-R1-P1-04` object key 复用 | `RESOLVED — SOURCE/STATIC SQL` | namespace/objectKey 非空唯一索引 |
| `CM1-R1-P1-05` exact version 恢复 | `PARTIALLY RESOLVED` | 对象路径（OBJECT_STORE）持久化幂等键已闭合；Local 路径不产生该对象恢复链 |
| `CM1-R1-P1-06` UPLOADING 永久悬挂 | `PARTIALLY RESOLVED` | 对象路径有 takeover，Local pre-canonical 路径没有安全接管 |
| `CM1-R1-P1-07` Local Adapter 环境 | `RESOLVED — SOURCE/LOCAL TEST` | Web、Worker、Service 均拒绝非 development/test 的 Local Object Adapter |
| `CM1-R1-P2-01` 同 File 并发 | `RESOLVED — SOURCE` | expected-current、活动 Intent 唯一索引、最终 CAS；DB 并发未验证 |
| `CM1-R1-P2-02` 对象读取错误证据 | `RESOLVED — SOURCE/LOCAL TEST` | 运行故障与完整性失败已分离 |
| `CM1-R1-P2-03` 测试覆盖 | `PARTIALLY RESOLVED` | 448 项本地测试通过；Local COMMIT unknown、真实 PostgreSQL、真实 Provider 未验证 |
| `CM1-R1-P2-04` Local 文件身份 | `PARTIALLY RESOLVED` | close/目标验证已补；Local Adapter 仍是 snapshot 检查，不是 OS 句柄保证 |
| `CM1-R1-P3-01` 报告过度表述 | `PARTIALLY RESOLVED` | R3 已承认限制，但仍将 Local 恢复描述为完整；见 P1-01/P1-02 |

## 5. A–H Findings

### A. Durable Idempotency and Recovery

对象路径的幂等身份是闭合的：

```text
makeObjectWriteIdempotencyKey({
  attemptId,
  operationId
}) = object-write:v1:<attemptId>:<operationId>
```

reservation 事务在 Provider dispatch 前把该值写入
`storage_object_operation.writeIdempotencyKey`。正常写入使用
`input.chain.writeIdempotencyKey`，恢复 discovery 也使用
`input.chain.writeIdempotencyKey`，不存在按 recovery 重新拼接的出路径。

数据库 CHECK 要求该值等于
`object-write:v1:||sourceAttemptId||:||id`，UPDATE Trigger 禁止替换。
严格测试 Adapter 在 discovery 收到不同 key 时抛
`OBJECT_STORAGE_BINDING_INVALID`，且 Service test 捕获了实际写入和 discovery
参数。

结论：

```text
OBJECT_STORE idempotency:
RESOLVED — SOURCE

Local Adapter idempotency receipt:
NOT VERIFIED

Real Provider idempotency:
NOT VERIFIED
```

本地 Adapter 只检查 idempotency key 非空，并未把 key 持久化为本地对象收据；
它通过 objectKey + 内容摘要发现对象。由于 Local Adapter 只允许 development/test，
这不是当前 production 对象存储证据，但不能描述为“所有 Adapter 都验证了
持久化身份”。

### B. Transient Failure vs Integrity Failure

`classifyObjectStorageFailure()` 将运行故障与完整性故障分开：

```text
ADAPTER_UNAVAILABLE                 -> no integrity failure
PROVIDER_CONFIGURATION_UNAVAILABLE  -> no integrity failure
PROVIDER_TEMPORARY_FAILURE           -> no integrity failure
OBJECT_NOT_FOUND/VERSION/SIZE/HASH   -> integrity failure
BINDING_INVALID                      -> integrity failure
```

Web 下载在 `download-service.ts:122-147` 使用该分类；只有完整性失败会更新
`integrityStatus=FAILED`。Worker 在 `file-processing.ts:579-637` 使用相同分类，
临时故障保持可重试，不写永久数据损坏。

本地测试确认 Adapter 缺失后文件仍可恢复，临时故障不会永久写 `FAILED`，真实
校验和不一致仍会 Fail Closed。

### C. Local Private Staging

`LocalPrivateStorage.writeToStaging()` 的关键顺序为：

```text
sync -> close -> re-lstat -> open no-follow -> stat identity/size
-> read bytes -> SHA-256 -> close verification handle
```

`finalize()` 使用 `fs.link(staging, target)`，不是 `access -> rename`。目标已存在
时只有 dev/ino 与 staging 相同才接受重放；否则拒绝。目标身份、大小和摘要
验证失败时不会进入 DB ACTIVE，并且 staging hard link 保留。

该部分源码和本地负向测试成立。可是它与 Local 上传链的 COMMIT-unknown 处理不是
同一问题；本报告 P1-01/P1-02 是调用层的恢复缺陷。

### D. Local Object Adapter Path Boundary

`LocalObjectStorageAdapter` 在路径准备、open 前、open 后和 read 后检查 root 与
父目录 dev/ino，并拒绝 symlink/Junction、路径逃逸和 identity 变化。相关测试
覆盖：

```text
parent replacement before open
parent replacement after open
parent replacement during exact read
existing object key
linked parent directory
```

但 Node core 的字符串路径 API 没有可移植的 handle-relative `openat` 语义，
攻击者快速替换并恢复父目录的窗口不能被源码证明消除。源码和报告都正确地把
Local Object Adapter 限制为 development/test；生产对象存储没有 Local fallback。

这不是 production Object Storage 的通过证据；本地 snapshot 检查不能称为
Windows handle fencing。

### E. Migration Non-Empty History

Migration 增加了四个 precheck 计数：

```text
VERIFIED Binding without writeObservedAt
OBJECT_STORE FINALIZE Operation without writeIdempotencyKey
PENDING/UPLOADING append Intent without expectedCurrentFileVersionId
incomplete Binding/Lifecycle/Operation/key chain
```

任一计数非零时 `RAISE EXCEPTION ... ERRCODE='23514'`，不伪造历史 Version、
观察时间或 expected-current。这个 fail-closed 方向正确。

独立发现两个未闭合点：

1. 三个 `ADD COLUMN` 位于 precheck 之前（Migration `:4-12` 在 `:14-66` 前）。
   如果 Migration runner 不把整个 migration 作为单一事务执行，precheck 失败会
   留下新列和未记录的部分 DDL。
2. 新 `writeIdempotencyKey` 列由本 Migration 才引入，因此已有 OBJECT_STORE
   FINALIZE Operation 的历史行天然为 NULL；当前没有本仓库内的 pre-migration
   backfill 迁移。结果是含有历史对象操作的数据库会稳定阻断，而不是“有证明即可
   自动升级”。阻断本身安全，但报告中的 non-empty with proof 路径没有实际脚本
   支撑。

### F. VERIFIED Binding Terminal Invariant

Migration `:461-617` 增加四个 deferred constraint triggers：

```text
Binding VERIFIED + Operation APPLIED + Lifecycle ACTIVE
+ exactly one matching FileVersion
```

并从 Operation、Lifecycle、FileVersion 反向触发检查。静态 SQL 中的父键和
trigger 目标关系成立；已有 FileVersion DELETE/TRUNCATE、Binding DELETE/TRUNCATE
保护仍在。

但以下仍是 `NOT VERIFIED`：

```text
deferred trigger execution
OLD/NEW behavior
transaction commit failure SQLSTATE
concurrent insert/update/lock interaction
RLS/SECURITY DEFINER/direct DML bypass
```

本轮不能把它描述为真实 PostgreSQL 已保证。

### G. Migration Timestamp and Ordering

当前目录：

```text
20261123130000_full_mvp_domain
20261126120000_phase38_route_c_minimal_object_binding
20261126130000_phase38_route_c_minimal_recovery_hardening
```

没有重复时间戳或逆序。R3 只重命名本轮新增且未应用的 Migration；历史 Migration
未被改写。历史 R2/R2-R1 报告仍保留旧名称，这是审计历史而非活动迁移引用。

### H. Build Authorization History

R2 的未授权 `pnpm --filter @elevator/file-storage build` 记录仍存在于
R2 和 R2-R1 输入报告中，没有被删除或重写。R3 报告明确说明本轮没有执行
Build；本轮独立审查也没有执行 Build。

## 6. New Findings

### CM1-R3-R1-P1-01 — Local pre-canonical COMMIT unknown permanently blocks the Intent

| 字段 | 内容 |
|---|---|
| 严重级别 | `P1` |
| 位置 | `upload-service.ts:1175-1185,1201,1491-1509`; `recoverLocalUpload():799-844`; `loadLocalRecoveryChain():531-572` |
| 触发条件 | `prepareLocalStagingChain()` 的 reservation transaction 已提交，但调用方丢失响应或进程在 `writeToStaging()` 前退出 |
| 持久状态 | Intent `UPLOADING`、Attempt `WRITING`、Staging Lifecycle `STAGING`、没有 canonical Lifecycle/FINALIZE Operation |
| 攻击/故障路径 | 重试进入 `recoverLocalUpload()`；`loadLocalRecoveryChain()` 要求 canonical Lifecycle 和 FINALIZE Operation，因缺失抛 `UPLOAD_RECOVERY_CHAIN_INVALID` |
| 影响 | 同一 Intent 永久不可完成、不可新建 Attempt；没有状态 API 或受控清理路径 |
| 违反不变量 | reservation 后中断必须可证明 Fail Closed，不能制造永久开放的 `UPLOADING` Intent |
| 必需修正 | 增加 pre-canonical Local recovery 分支：重验 staging/闭证明，安全接管或明确失败；或者把 reservation 和恢复状态设计成一个可重入状态 |
| 阻断实施 | `YES` for controlled Local validation; PostgreSQL clone can still test this state, but source recovery is incomplete |

### CM1-R3-R1-P1-02 — Local canonical preparation COMMIT unknown is treated as pre-canonical failure

| 字段 | 内容 |
|---|---|
| 严重级别 | `P1` |
| 位置 | `upload-service.ts:1239-1246` (`canonicalPrepared = true` 在 await 之后); `:1491-1509`; `prepareLocalCanonicalChain():433-528` |
| 触发条件 | `prepareLocalCanonicalChain()` 的事务已提交 canonical Lifecycle、FINALIZE Operation 和 `FINALIZING` Attempt，但调用方收到连接/COMMIT 响应错误 |
| 故障路径 | 调用者仍看到 `canonicalPrepared=false`，catch 走 `failLocalStagingChain()`；该函数只匹配 WRITING/STAGING 前态，无法重新检查已提交 canonical 链 |
| 影响 | 可能把 Intent 终态化而保留 EXECUTING canonical 链，或在链 Trigger 拒绝补偿后留下无明确恢复分支的开放链 |
| 违反不变量 | 任何 DB COMMIT 未知都必须先重新读取持久状态，再决定补偿或接管；不得按内存布尔值判断事务未提交 |
| 必需修正 | 捕获 `prepareLocalCanonicalChain()` 后先以新查询读取 Intent/Attempt/Lifecycle/Operation；已提交则进入 canonical recovery，未提交才走 staging failure |
| 阻断实施 | `YES` |

### CM1-R3-R1-P2-01 — Legacy LocalPrivateStorage remains a production-reachable path without OS guarantee

| 字段 | 内容 |
|---|---|
| 严重级别 | `P2` |
| 位置 | `apps/web/src/server/files/storage.ts:17-38`; `apps/worker/src/storage.ts:14-25`; `packages/file-storage/src/local-private-storage.ts:591-592` |
| 触发条件 | 生产环境读取 `LEGACY_LOCAL` FileVersion；或本地进程可替换中间父目录/Junction |
| 故障路径 | Worker 的 `readObjectBytes()` 使用 `openReadStream()`；该入口未复用 `readVerifiedObject()` 的 root/父目录快照检查。内容最终有 SHA-256 检查，但不是路径身份保证 |
| 影响 | 可造成读取路径重定向、读取不可信对象、资源消耗或本地文件系统身份绕过；内容摘要不一致时通常 Fail Closed |
| 违反不变量 | 生产本地文件读取仍应有受控路径/文件系统身份；“Local Object Adapter 只允许 test”不覆盖 legacy LocalPrivateStorage |
| 必需修正 | 明确 legacy local 文件的 production 范围，统一所有读取入口使用受控 handle/snapshot 检查，或禁止 production 读取该 backend |
| 阻断实施 | `NO` for PostgreSQL schema validation; `YES` for production Local path |

### CM1-R3-R1-P2-02 — Migration precheck is not proven to be a single atomic preflight

| 字段 | 内容 |
|---|---|
| 严重级别 | `P2` |
| 位置 | `prisma/migrations/20261126130000_phase38_route_c_minimal_recovery_hardening/migration.sql:4-66` |
| 触发条件 | 非空数据库上 precheck 失败，或 Migration runner 逐语句执行 |
| 故障路径 | `ADD COLUMN` 执行后才运行计数 `DO`；文件没有显式 `BEGIN/COMMIT`，源码不能证明失败时所有 DDL 回滚 |
| 影响 | 失败后可能留下部分 Schema，下一次 Migration 重跑会因重复列/约束失败，需要人工修复 |
| 违反不变量 | fail-closed precheck 不应自身制造部分 DDL |
| 必需修正 | 把 precheck 放入 Migration 前的只读预检脚本，或在已证明的事务包裹中执行；增加 precheck 失败后 schema 不变的测试 |
| 阻断实施 | `NO` for source smoke analysis; `YES` before claiming safe non-empty production migration |

### CM1-R3-R1-P2-03 — Service-level matrix does not cover dispatch COMMIT unknown or a real old executor

| 字段 | 内容 |
|---|---|
| 严重级别 | `P2` |
| 位置 | `apps/web/tests/object-upload-service.test.ts`; `apps/web/tests/helpers/object-upload-prisma-harness.ts` |
| 触发条件 | `advanceChainForDispatch()` 的 COMMIT 响应丢失；或旧执行者在 takeover 后真正调用服务 |
| 故障路径 | 没有 `DISPATCH` commit-response-loss 注入；旧 executor 测试直接调用 `storageObjectOperation.updateMany()`，没有执行 `completeObjectUpload()` 的旧执行者路径 |
| 影响 | 最关键的服务恢复时序之一只能靠静态推断；测试不能证明 `failBeforeDispatch()` 在 dispatch 已提交时的行为 |
| 违反不变量 | 服务级故障矩阵必须覆盖真实入口、持久状态和 Adapter 调用 |
| 必需修正 | 增加 dispatch COMMIT unknown test，并让 stale executor 通过实际服务入口重入；真实 PostgreSQL 双 Session 另列为下一阶段 |
| 阻断实施 | `NO` for local source review; `YES` for claiming the complete service fault matrix |

### CM1-R3-R1-P3-01 — Migration static test only proves marker presence

`object-upload-migration.test.ts` 主要断言 Migration 中出现了 precheck marker、
一个 trigger 名称和排序字符串；它没有逐类构造四类历史阻断记录，也没有验证
precheck 失败不会留下部分 DDL。该测试不能替代 PostgreSQL 行为测试。

## 7. Service Fault Matrix Truth Table

| 要求场景 | 实际证据 | 独立结论 |
|---|---|---|
| reservation 前失败 | expected-current reservation transaction failure test | `PARTIAL — MOCK`; no direct generic pre-reservation fault |
| reservation 后、dispatch 前中断 | reservation COMMIT response loss test | `PASS — MOCK` for OBJECT_STORE; Local equivalent missing |
| dispatch 后、Provider 写入前中断 | Provider temporary failure before source read | `PARTIAL — MOCK`; Provider method was invoked, no process death |
| Provider 成功、响应丢失 | strict fake write response loss + discovery | `PASS — MOCK` |
| Provider 结果已产生、Observation DB 失败 | observation failure test | `PASS — MOCK` |
| DB COMMIT 响应丢失 | reservation, binding observation, finalization | `PARTIAL`; dispatch COMMIT branch absent |
| FileVersion finalization COMMIT 丢失 | explicit test | `PASS — MOCK` |
| 两个恢复者并发 | two `Promise`s enter service; harness serializes transaction tail | `PARTIAL`; service concurrency yes, DB concurrency no |
| 旧执行者迟到完成 | direct `updateMany` after takeover | `PARTIAL`; not a real service entry |
| heartbeat 失败 | delay + lease lookup failure | `PASS — MOCK` |
| expected-current 改变 | reservation test | `PASS — MOCK` |
| Adapter 暂时不可用后恢复 | Web download tests | `PASS — LOCAL`; upload Local recovery not equivalent |
| Provider exact version mismatch | write/read tests | `PASS — LOCAL/MOCK` |

Strict fake Adapter verifies write/discovery key equality and rejects mismatch. This
is valuable. It does not prove a real Provider honors the contract.

## 8. Test Commands and Results

本轮独立重新执行：

```text
pnpm db:validate
PASS

pnpm db:generate
PASS — Prisma Client 6.19.0

pnpm typecheck
PASS — 8 workspace projects

pnpm --filter @elevator/file-storage test
PASS — 6 files / 51 tests

pnpm --filter @elevator/web test
PASS — 35 files / 341 tests

pnpm --filter @elevator/worker test
PASS — 8 files / 32 tests

pnpm --filter @elevator/contracts test
PASS — 4 files / 15 tests

pnpm --filter @elevator/selection-engine test
PASS — 2 files / 9 tests

git diff --check
PASS — existing LF/CRLF advisory only
```

合计：

```text
Test files: 55
Tests:      448 PASS
```

测试通过不等于 Local COMMIT-unknown 或真实 PostgreSQL 恢复通过。上述 P1
没有对应测试。

## 9. Migration Ordering and Historical Data Assessment

实际排序：

```text
20261123130000_full_mvp_domain
20261126120000_phase38_route_c_minimal_object_binding
20261126130000_phase38_route_c_minimal_recovery_hardening
```

无重复时间戳，R3 只使用新的 forward Migration；已应用 Migration 内容未变。
历史报告中的旧目录名保留为历史证据。

历史数据安全性：

- VERIFIED 无 `writeObservedAt`：阻断。
- Object FINALIZE Operation 无写身份：阻断。
- PENDING/UPLOADING append Intent 无 expected-current：阻断。
- Binding/Lifecycle/Operation/key 断链：阻断。
- 不伪造历史 Provider Version、观察时间或成功状态。
- 未执行历史 inventory、backfill、删除或发布。

但 precheck 的 DDL 前置位置和 Migration runner 事务语义仍未证明；不能将
`STATIC SQL` 写成 PostgreSQL safety。

## 10. Unverified Items

```text
PostgreSQL connection:                    NOT EXECUTED
Migration application:                    NOT EXECUTED
Trigger/FK/CHECK execution:               NOT VERIFIED
Deferred constraint behavior:             NOT VERIFIED
Two-session concurrency:                  NOT VERIFIED
Real COMMIT response-loss:                NOT VERIFIED
Process kill/restart:                     NOT VERIFIED
Real Provider write/discovery:            NOT IMPLEMENTED / NOT VERIFIED
Windows Junction/Reparse Point test:      NOT VERIFIED
Windows ACL / Effective Access:            NOT VERIFIED
Legacy Worker drain:                      NOT EXECUTED
Historical object inventory/backfill:     NOT EXECUTED
E2E/Browser Runtime:                      NOT EXECUTED
Build/Startup Gate:                       NOT EXECUTED
Production deployment:                    NOT AUTHORIZED
```

R5 的 57 项 Open Decisions 仍为 `OPEN`；BV7 仍为 `FAIL`；BV8 仍未被独立批准；
历史治理状态 R8 仍为 `BLOCKED`；P2-05 业务政策仍为 `OPEN`。

## 11. Git and Worktree

### 11.1 Review start

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  67
Untracked files:        68
R3-R1 report:           ABSENT
```

### 11.2 Review end

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  68
Untracked files:        69
New report:             docs/architecture/wp-2a-route-c-minimal-independent-review-r3-r1.md
```

除本报告外没有修改任何 source、Schema、Migration、Trigger、测试、配置或既有
报告。没有使用 Git 写操作，没有删除、移动、重命名受保护对象或用户工作。

## 12. Required Corrections Before Controlled PostgreSQL Validation

1. 为 Local pre-canonical reservation 增加可重入恢复状态，或把 Local staging
   reservation 与 canonical preparation 合并为可验证的恢复协议。
2. 对 `prepareLocalCanonicalChain()` 的 COMMIT unknown 先重新读取 durable
   Intent/Attempt/Lifecycle/Operation，再决定失败补偿。
3. 明确 legacy `LocalPrivateStorage` 在 production 是否可读；如果可读，所有
   Worker/Download 读取入口必须使用同一受控验证路径。
4. 把 Migration precheck 移到不会产生部分 DDL 的执行位置，或证明 Migration
   runner 的原子事务语义并提供失败后 schema 不变测试。
5. 增加 dispatch COMMIT-response-loss 服务测试，及通过真实服务入口执行的
   stale executor 测试。
6. 在隔离 PostgreSQL clone 中验证 deferred terminal invariants、precheck、
   trigger SQLSTATE、双 Session 和回滚行为。

## 13. Final Decision

```text
FAIL — SOURCE CORRECTIONS REQUIRED

Controlled PostgreSQL validation:
  NOT ADMITTED as a complete R3 baseline

Primary blockers:
  Local reservation COMMIT unknown permanently opens Intent
  Local canonical preparation COMMIT unknown is misclassified

Additional restrictions:
  Local Node path snapshots are not OS handle fencing
  Migration precheck atomicity is not proven
  dispatch COMMIT-unknown and real stale-executor service coverage is incomplete

PostgreSQL, Provider, Windows OS, ACL and runtime:
  NOT VERIFIED
```

本报告完成后停止。不得自行修改源码、执行 Migration、连接 PostgreSQL/Provider、
运行 Build/E2E 或进入部署阶段。
