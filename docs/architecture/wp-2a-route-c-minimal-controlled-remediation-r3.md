# WP-2A-CM1-R3 — Route C-Minimal Consolidated Source Remediation

## 0. Document Control

```text
Stage:
  WP-2A-CM1-R3

Mode:
  CONTROLLED SOURCE REMEDIATION AND LOCAL SERVICE-LEVEL VERIFICATION

Date:
  2026-11-26

Repository:
  D:\thinkbook\Desktop\jieya

Input R2-R1:
  docs/architecture/wp-2a-route-c-minimal-independent-review-r2.md

Input R2-R1 SHA-256:
  30D85D2D3CDCF1B5316C25B71D2BA3BC68303FA6E1749698E22E26488E847FD5

Final conclusion:
  CM1-R3 PASS WITH RESTRICTIONS — READY FOR INDEPENDENT REVIEW
```

本结论只表示 Route C-Minimal 的源码整改和允许执行的本地测试已经完成，可以进入
下一轮独立审查。它不表示 PostgreSQL Migration、Trigger、双 Session 并发、
真实 Provider、Windows Junction/Reparse Point、IAM/ACL、E2E、生产 Build、
启动门禁或部署已经通过。

## 1. Scope and Method

本轮执行以下工作：

- 修复 R2-R1 的 P1 幂等身份不一致；
- 分离 Adapter/Provider 运行故障与对象完整性失败；
- 完成 Local private staging 关闭后身份、大小和摘要验证；
- 使用同文件系统 hard link 实现 atomically exclusive、no-overwrite 的本地发布；
- 为 Local Object Adapter 增加 root/父目录身份快照及 open/read 前后复核；
- 为非空数据库 Migration 增加 fail-closed precheck；
- 增加 Binding/Operation/Lifecycle/FileVersion 的 deferred 终态约束；
- 将未来时间戳 Migration 重命名为当前时间线内的顺序；
- 增加 Service/Repository 层的 `completeObjectUpload()` 故障注入测试；
- 在服务层重复检查 Local Adapter 的环境边界。

没有修改已有报告，没有使用 Git 写操作，没有连接 PostgreSQL/Provider/Storage，
没有执行 SQL、Migration、数据库测试、E2E、Native RPC、服务重启、部署或 Build。

证据等级：

| 等级 | 含义 |
|---|---|
| `SOURCE VERIFIED` | 当前源码、Schema、Migration、Trigger 或测试可直接证明 |
| `STATIC SQL` | 依据 PostgreSQL DDL/Trigger 文本和已知语义推导，尚未执行 |
| `LOCAL TEST` | 本机纯文件系统、纯函数、Mock/Repository 测试 |
| `NOT VERIFIED` | 需要 PostgreSQL、Provider、Windows ACL、E2E 或运行时 |

## 2. R2-R1 Findings Disposition

R2-R1 共报告：

```text
P0: 0
P1: 1
P2: 5
P3: 2
```

| Finding | R3 处置 | 当前状态 | 证据与边界 |
|---|---|---|---|
| `CM1-R2-R1-P1-01` 写入与发现幂等身份不同 | Operation 在 reservation 中持久化同一 `writeIdempotencyKey`；正常写入和所有恢复发现读取该字段 | `RESOLVED` | `object-upload-service.ts:318-320,421-432,1185-1187,1319-1325,1514-1527`; Migration `:68-95`; service test |
| `CM1-R2-R1-P2-01` Adapter 缺失被写成完整性失败 | 统一 failure taxonomy；运行/配置故障不更新 `integrityStatus=FAILED` | `RESOLVED` | `object-storage-failure.ts`; `download-service.ts:122-147,623-661`; Worker `:579-637`; 对应测试 |
| `CM1-R2-R1-P2-02` close attestation 在关闭前生成 | 写入句柄 close 成功后重新打开、复核身份/大小/SHA-256/普通文件属性，再记录 attestation | `RESOLVED` | `local-private-storage.ts:158-194,595-692`; post-close replacement/symlink tests |
| `CM1-R2-R1-P2-03` Local Adapter 父目录 check-to-open TOCTOU | 增加 root/每一级父目录身份快照，在 open 前后和 read 后复核；任何变化 Fail Closed | `PARTIALLY RESOLVED` | 源码和本地故障测试已覆盖，但 Node core 未提供跨平台 handle-relative `openat` 不可撤销保证；见 `CM1-R3-NEW-P2-01` |
| `CM1-R2-R1-P2-04` 非空历史状态没有 precheck/backfill | 对 VERIFIED 无观察、object Operation 无写身份、活动 append Intent 无 expected-current、Binding 链不完整执行确定性计数并在 DDL 前 `23514` 中止 | `RESOLVED` | Migration `:14-66`; 静态 Migration test |
| `CM1-R2-R1-P2-05` VERIFIED Binding 无跨表终态约束 | 增加四个 deferred constraint trigger，覆盖 Binding、Operation、Lifecycle、FileVersion 正反向变化 | `RESOLVED — STATIC SQL` | Migration `:461-617`; `NOT VERIFIED` in PostgreSQL |
| `CM1-R2-R1-P3-01` Migration 时间戳在未来 | 重命名为 `20261126130000_...` | `RESOLVED` | 当前迁移排序正确 |
| `CM1-R2-R1-P3-02` R2 执行被禁止的 package Build | 保留为历史流程违规；R3 没有执行任何 Build | `RESOLVED — GOVERNANCE RECORD` | R2 原文未改写；本报告 §13 明确记录 |

`PARTIALLY RESOLVED` 只用于 Local Object Adapter 的平台级路径竞态。该缺口不允许
任何 production/staging 选择 Local Adapter；不阻断源码独立复审，但阻断对
Windows handle-level TOCTOU 或生产本地对象存储安全性的任何声明。

## 3. R1 Twelve-Finding Final Trace

| R1 Finding | 最终状态 | 说明 |
|---|---|---|
| `CM1-R1-P1-01` Operation 跳步 | `RESOLVED` | `PREPARED -> EXECUTING` 独立提交后才调用 Provider；最终仅允许 `EXECUTING/UNKNOWN -> APPLIED` |
| `CM1-R1-P1-02` Completed/staging 冲突 | `RESOLVED` | object 和 local 成功链均使用 `COMPLETED + STAGING_READY` 的逻辑保留语义；物理清理保持关闭 |
| `CM1-R1-P1-03` Binding 归属 | `RESOLVED` | 复合 FK、父 UNIQUE、FileVersion 指针不可变和 terminal chain guard 已补齐 |
| `CM1-R1-P1-04` object key 唯一性 | `RESOLVED` | namespace + objectKey 非空唯一索引不依赖 Provider Version |
| `CM1-R1-P1-05` exact version 恢复 | `RESOLVED` | durable Provider observation、`discoverExact` 和同一持久化幂等键形成恢复链 |
| `CM1-R1-P1-06` UPLOADING 永久悬挂 | `RESOLVED — SOURCE` | lease/takeover/discovery/fail-closed 重入路径存在；真实进程重启和 DB 行为未验证 |
| `CM1-R1-P1-07` Local Adapter 环境 | `RESOLVED` | 仅显式 `development/test`；Web、Worker 和服务层均拒绝 Local Adapter |
| `CM1-R1-P2-01` 同 File append 竞争 | `RESOLVED — SOURCE` | expected-current、活动 append 唯一索引和最终 CAS；双 Session 未验证 |
| `CM1-R1-P2-02` 对象错误证据链 | `RESOLVED` | 完整性失败与运行故障分离；Web/Worker 均记录安全事件后阻断 |
| `CM1-R1-P2-03` 对象路径测试不足 | `PARTIALLY RESOLVED` | 已新增真实 `completeObjectUpload()` 服务级故障注入，共 15 项；真实 PostgreSQL/Provider 仍禁止 |
| `CM1-R1-P2-04` Local Adapter 文件身份 | `PARTIALLY RESOLVED` | 快照前后复核和 Fail Closed 已实现；Node core 路径竞态仍有平台限制 |
| `CM1-R1-P3-01` 文档过度表述 | `RESOLVED` | 本报告明确区分源码、静态 SQL、本地测试和真实环境验证 |

## 4. Durable Idempotency Identity

### 4.1 Canonical value

唯一生成函数：

```text
object-write:v1:<attemptId>:<operationId>
```

实现位于 `object-upload-protocol.ts:15-38`。Attempt 与 Operation 都由服务端生成，
不属于客户端可复用输入。

### 4.2 Persistence before dispatch

顺序如下：

```text
reservation transaction
  -> create Attempt
  -> create FINALIZE Operation
  -> persist writeIdempotencyKey
  -> create PENDING Binding
  -> commit

dispatch transaction
  -> PREPARED -> EXECUTING
  -> WRITING -> READY -> FINALIZING
  -> STAGING -> STAGING_READY
  -> commit

Provider writeImmutable(idempotencyKey = persisted value)
```

数据库保护：

```sql
writeIdempotencyKey IS NULL
OR writeIdempotencyKey =
  'object-write:v1:' || sourceAttemptId || ':' || id
```

另有 BEFORE UPDATE Trigger 禁止修改已持久化值。terminal-chain guard 还会再次验证
Operation、Binding 和 FileVersion 的同一关系。

### 4.3 Recovery

正常写入、Provider 响应丢失、Observation 写失败、Observation COMMIT 未知、
Finalization 失败和进程重建恢复都读取同一字段：

```text
Operation.writeIdempotencyKey
  -> writeImmutable
  -> discoverExact
  -> exact read
  -> durable observation
  -> finalization
```

恢复时不重新生成该值。缺失、空值或与 Attempt/Operation 不一致时返回
`UPLOAD_RECOVERY_WRITE_IDENTITY_MISSING`，且不调用 Provider 写入。

Strict test Adapter 会拒绝 discovery key 与 write key 不一致，因此测试不是“同值
字符串检查”，而是 Adapter 可见的调用参数断言。

## 5. Failure Taxonomy

| Failure kind | 完整性失败 | 暂态 | 处置 |
|---|---:|---:|---|
| `ADAPTER_UNAVAILABLE` | 否 | 是 | `503`，记录运行事件，保留可恢复状态 |
| `PROVIDER_CONFIGURATION_UNAVAILABLE` | 否 | 否 | `503` 或受控阻断，不污染 FileVersion 完整性 |
| `PROVIDER_TEMPORARY_FAILURE` | 否 | 是 | 重试/恢复，不把有效文件永久锁死 |
| `OBJECT_NOT_FOUND` | 是 | 否 | `integrityStatus=FAILED`，安全事件，阻断读取 |
| `OBJECT_VERSION_MISMATCH` | 是 | 否 | `integrityStatus=FAILED`，阻断读取 |
| `OBJECT_SIZE_MISMATCH` | 是 | 否 | `integrityStatus=FAILED`，阻断读取 |
| `OBJECT_HASH_MISMATCH` | 是 | 否 | `integrityStatus=FAILED`，阻断读取 |
| `BINDING_INVALID` | 是 | 否 | 阻断并记录关键安全事件 |
| `WRITE_RESULT_UNCERTAIN` | 否 | 否 | 保留链，只允许精确发现/读回 |

Web 和 Worker 使用同一个 `classifyObjectStorageFailure()`。Adapter 不存在、权限
配置错误、能力未验证等运行故障不会把有效文件永久写为 `FAILED`。恢复 Adapter
后，只有 exact read、大小和 SHA-256 全部通过才会重新记录 `VERIFIED`。

## 6. Local Private Staging and Publication

### 6.1 Post-close attestation

`LocalPrivateStorage.writeToStaging()` 现在执行：

```text
write
-> sync
-> close
-> re-lstat
-> compare dev/ino, regular-file and size
-> reopen with O_NOFOLLOW when available
-> compare opened dev/ino and size
-> read bytes
-> recompute SHA-256
-> close verification handle
-> only then return writable close attestation
```

close 前 stat 仅用于定位候选 inode，不再作为最终证明。关闭后的
`verifiedIdentity` 才是 `closedIdentityVerified=true` 的依据。

### 6.2 Atomic no-overwrite publication

本地发布不再使用 `access -> rename`。当前机制为：

```text
verify staging is a trusted regular file
-> fs.link(staging, canonicalTarget)
-> EEXIST:
     accept only when target dev/ino equals verified staging identity
     otherwise reject
-> verify target regular-file identity, size and SHA-256
-> retain staging hard link
-> DB may enter ACTIVE
```

同文件系统 hard link 的 `EEXIST` 语义提供 exclusive no-overwrite；`EXDEV`、无
hard-link 能力、reparse identity 变化或验证失败都在 DB `ACTIVE` 前 Fail Closed。

物理 unlink 仍保持关闭。成功上传后的 staging Lifecycle 逻辑上保留为
`STAGING_READY`，不是“已物理删除”。这与 Route C-Minimal 的保守保留策略一致。

### 6.3 Verified negative cases

已覆盖：

- close 后替换 staging；
- close 后修改内容；
- close 后替换为 symlink/Junction；
- finalize 前目标已被创建；
- finalize 后目标内容被替换；
- target 不是普通文件；
- SHA-256、大小和文件身份不一致；
- 失败后原 staging hard link 仍保留。

## 7. Local Object Adapter Path Boundary

Local Object Adapter 在每次操作前建立 root 与全部父目录的 dev/ino 快照，并在：

```text
路径准备后
open 前
open 后
read 后
```

复核快照。直接 symlink、Windows Junction、父目录替换和读取期间父目录替换均在
本地测试中 Fail Closed。object key 只允许受控命名空间，拒绝绝对路径、NUL、
`..` 和 root escape。

本轮不能把该机制称为 Windows handle fencing。Node core 没有统一的
handle-relative `openat`/目录句柄模型，攻击者“打开期间替换、随后恢复原路径”的
极窄窗口无法由当前代码在全部支持平台 Formally 排除。

因此安全边界明确缩小为：

```text
LocalObjectStorageAdapter:
  development/test only

production object storage:
  real Provider adapter required
  currently NOT IMPLEMENTED / NOT VERIFIED
```

服务入口、Web factory、Worker factory 都复查环境。不能以“已经写 snapshot 检查”
代替 Windows OS Authority 或生产 TOCTOU 证明。

## 8. Migration Precheck, Backfill and Ordering

### 8.1 Non-empty precheck

Migration 在修改关键约束前统计以下对象，任一大于零即 `RAISE EXCEPTION`：

```text
VERIFIED Binding without writeObservedAt
OBJECT_STORE FINALIZE Operation without writeIdempotencyKey
PENDING/UPLOADING append Intent without expectedCurrentFileVersionId
Binding whose Lifecycle/Operation/key chain is incomplete or inconsistent
```

既有 `FAILED_RETAINED` 不会自动发布；它可以继续保留，且新 CHECK 禁止其被改写为
可发布状态。既有 `PENDING` 对象链如果没有 durable write identity，会由
“object Operation without key” precheck 阻断。

### 8.2 Backfill policy

本轮不伪造历史 `writeObservedAt`、Provider Version、expected-current 或
idempotency key。

```text
clean database:
  forward DDL can proceed

non-empty database without proof:
  abort with 23514 and classified counts

non-empty database with proof:
  pass precheck and apply forward DDL
```

历史对象 inventory、分类处置和实际 backfill 仍需单独授权，不在本轮执行。

### 8.3 Migration ordering

调整前：

```text
prisma/migrations/20261127120000_phase38_route_c_minimal_recovery_hardening/
```

调整后：

```text
prisma/migrations/20261126130000_phase38_route_c_minimal_recovery_hardening/
```

该目录现在排在：

```text
20261126120000_phase38_route_c_minimal_object_binding
```

之后，日期不再晚于当前日期。历史 R2/R2-R1 报告保留旧名称，作为历史记录；当前
Migration test 使用新目录名。

## 9. Cross-Table Terminal Invariant

新增四个约束触发器：

| Trigger | 检查对象 |
|---|---|
| `p13_binding_terminal_guard` | Binding INSERT/UPDATE |
| `p13_operation_binding_terminal_guard` | Operation UPDATE |
| `p13_lifecycle_binding_terminal_guard` | Lifecycle UPDATE |
| `p13_file_version_binding_terminal_guard` | FileVersion INSERT/UPDATE |

事务提交时要求：

```text
Binding VERIFIED
-> Operation APPLIED
-> canonical Lifecycle ACTIVE
-> exactly one FileVersion
-> FileVersion/binding Operation, key, size and SHA-256 match
```

事务中间阶段不被立即拒绝，允许同一事务先更新多个对象再提交。反向路径也被检查：

- Operation 离开 `APPLIED`；
- canonical Lifecycle 离开 `ACTIVE`；
- Binding 离开 `VERIFIED` 或观察字段改变；
- 缺失 FileVersion；
- 一个 Binding 对应多个 FileVersion；
- FileVersion 改指另一个 Binding。

已有 `protect_file_version_identity()` 仍拒绝 FileVersion DELETE；storage Binding
和 Operation 的 DELETE/TRUNCATE 保护继续存在。

以上是 `STATIC SQL`。Deferred Trigger 的真实 PostgreSQL 行为、`OLD/NEW` 行为和
锁交互仍为 `NOT VERIFIED`。

## 10. Service-Layer Adapter Gate

Local Adapter 不只由 Web/Worker factory 排除。三个关键服务入口都再次检查：

```text
completeObjectUpload()
prepareFileDownload()
Worker file processing
```

只在 `NODE_ENV` 精确等于 `development` 或 `test` 时允许
`providerKind=LOCAL_DEVELOPMENT`。缺失、空串、`staging`、`production`、大小写
差异和未知值均返回 Fail Closed。

未配置 Adapter 不触发本地 fallback；未知对象错误也不被解释为本地成功。

## 11. Service-Level Fault Injection

新增 `apps/web/tests/object-upload-service.test.ts`，直接执行真实
`completeObjectUpload()`，使用受控 Prisma/Repository harness 模拟事务、CAS、
COMMIT response loss 和租约接管。它不是源码字符串顺序测试。

| 场景 | 实际断言 | 结果 |
|---|---|---|
| 正常精确上传 | `writeImmutable=1`，无 discovery，Operation/Attempt/Binding/FileVersion 终态正确 | `PASS` |
| Provider 写入成功但响应丢失 | `writeImmutable=1`，`discoverExact=1`，key 字节级相同，只发布一个 FileVersion | `PASS` |
| Observation DB 写入失败 | 保留 `RECOVERY_REQUIRED/UNKNOWN`，重入后 discovery + read，仍只写一次 | `PASS` |
| Observation COMMIT response loss | 从已提交 observation 恢复，不重写、不重复发现 | `PASS` |
| Finalization pre-commit failure | 从 durable observation 恢复，不重写 | `PASS` |
| Finalization COMMIT response loss | 新事务确认已有完成结果，不重复发布 | `PASS` |
| Reservation COMMIT response loss | Provider 写入为零；租约过期后安全接管 | `PASS` |
| 两个恢复者并发 | 两个真实 Promise 同时进入服务；Repository 事务边界串行化；只产生一个 FileVersion | `PASS — MOCK` |
| 旧 generation 晚到 | 旧 owner/generation 条件更新 rowcount 为 0 | `PASS — MOCK` |
| Heartbeat 失败 | Provider signal 被终止，不发布 FileVersion | `PASS` |
| expected-current 已变化 | Provider 调用前拒绝，零副作用 | `PASS` |
| Provider 暂时故障 | 保持 UNKNOWN/RECOVERY_REQUIRED，不发布、不写永久完整性失败 | `PASS` |
| Provider exact version 无效 | 拒绝并保持未发布 | `PASS` |
| durable write identity 缺失 | 恢复前失败，Provider 写入为零 | `PASS` |
| 直接注入 Local Adapter 到 production | 服务层拒绝，Intent 保持 PENDING | `PASS` |

另有 Web 下载与 Worker 完整性测试验证：

- Adapter 缺失返回 `503`，不修改完整性；
- Adapter 恢复后 exact read 和多字段校验成功；
- 临时 Provider 故障不永久阻断文件；
- 真实哈希不一致仍写 `FAILED`；
- Worker 不把配置故障写成数据损坏。

harness 的事务尾部会把并发 Repository 事务串行化，因此它证明服务和 CAS 分支，
不证明 PostgreSQL 两个真实 Session 的隔离、锁等待、死锁或 COMMIT 行为。

## 12. Test Commands and Results

本轮重新执行：

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
PASS — 仅既有 LF/CRLF advisory
```

合计：

```text
Test files: 55
Tests:      448 PASS
```

Prisma 命令自动报告 “Environment variables loaded from .env”；未读取、显示或
记录任何环境值、密钥、密码、Token 或连接串。

本轮没有执行：

```text
pnpm build
pnpm --filter ... build
pnpm security:startup
pnpm test:db:verify
pnpm test:db:constraints
pnpm test:e2e
SQL / Migration application
PostgreSQL connection
Provider/Storage access
Web/Worker start or restart
```

## 13. Historical Build-Authorization Violation

R2-R1 的 `CM1-R2-R1-P3-02` 记录：R2 执行了
`pnpm --filter @elevator/file-storage build`，违反当时“不执行 Build”的授权。

该历史事实保留在 R2 报告中，未通过修改旧报告抹去。R3 没有执行任何 package、
Web 或 Worker Build；本轮测试没有依赖 Build 刷新类型声明。

## 14. New Findings

### CM1-R3-NEW-P2-01 — Local Adapter 仍不是 OS handle-relative authority

| 字段 | 内容 |
|---|---|
| 严重级别 | `P2` |
| 对应章节 | §7；R2-R1-P2-03 |
| 触发条件 | 开发/测试环境存在能够并发替换父目录并迅速恢复路径的攻击者 |
| 故障路径 | snapshot 检查完成后，路径组件极短时间内被替换并恢复；Node core 路径操作仍以字符串重新解析 |
| 违反不变量 | 不能仅凭当前 Node API 证明所有中间路径组件始终绑定到同一受信任父目录句柄 |
| 影响 | Local development/test 路径身份可能无法达到 production OS fencing 强度 |
| 必需修正 | production 禁用 Local Adapter；若未来要求生产本地存储，必须引入经证明的目录句柄/平台专用 API |
| 阻断实施 | `NO` for source review；`YES` for production use of Local Object Adapter |

本 Finding 不是隐藏缺陷。服务、Web、Worker 都已把该 Adapter 限制为显式
development/test，且每次检测到身份变化均 Fail Closed。

### CM1-R3-NEW-P3-01 — Repository harness 不能替代真实进程/数据库证据

| 字段 | 内容 |
|---|---|
| 严重级别 | `P3` |
| 对应章节 | §11 |
| 触发条件 | 需要证明 PostgreSQL `40001/40P01`、真实 COMMIT unknown、进程被强杀后的连接行为 |
| 故障路径 | 当前 harness 在单 Node 进程中模拟持久状态与事务串行化 |
| 违反不变量 | 不违反源码不变量，但不能证明数据库和 OS 层最终保证 |
| 影响 | 结果可能被过度解读为真实 PostgreSQL/进程恢复通过 |
| 必需修正 | 后续隔离 PostgreSQL clone 和受控进程故障测试 |
| 阻断实施 | `NO` for independent source review；database/runtime remain `NOT VERIFIED` |

## 15. Unexecuted and External Blockers

```text
PostgreSQL Migration application:                 NOT EXECUTED
Trigger/FK/Deferred constraint behavior:          NOT VERIFIED
Two-session row-lock/CAS behavior:                NOT VERIFIED
DB COMMIT response loss on real connection:       NOT VERIFIED
Process kill and restart recovery:                NOT VERIFIED
Real Provider conditional create:                 NOT IMPLEMENTED / NOT VERIFIED
Real Provider exact discovery/readback:           NOT VERIFIED
Provider IAM read/write separation:               NOT VERIFIED
Windows Junction/Reparse Point adversarial test:  NOT VERIFIED
Windows ACL / Effective Access:                   NOT VERIFIED
PostgreSQL production roles/ACL:                  NOT IMPLEMENTED
Historical object inventory and backfill:         NOT EXECUTED
Legacy Worker drain:                              NOT EXECUTED
E2E / Browser Runtime:                            NOT EXECUTED
Production Build / Startup Gate:                  NOT EXECUTED
Production deployment:                            NOT AUTHORIZED
```

历史独立状态不变：

```text
R5 57 Open Decisions:          OPEN
BV7:                           FAIL
BV8:                           NOT INDEPENDENTLY APPROVED
Historical governance R8:      BLOCKED
P1-3 legacy/upload chain:      NOT FULLY INTEGRATED
P2-05 business retention:      OPEN
```

## 16. Files and Integrity

### 16.1 Tracked files modified in the current worktree

```text
apps/web/src/app/api/projects/[projectId]/files/[fileId]/versions/[versionId]/content/route.ts
apps/web/src/app/api/projects/[projectId]/files/upload-intents/[intentId]/content/route.ts
apps/web/src/modules/files/download-service.ts
apps/web/src/modules/files/upload-service.ts
apps/web/src/server/files/storage.ts
apps/web/tests/download-route.test.ts
apps/web/tests/e2e/phase32-upload.spec.ts
apps/web/tests/integration/phase31-schema.test.ts
apps/web/tests/integration/phase33-file-access.test.ts
apps/web/tests/integration/phase36-field-review.test.ts
apps/web/tests/integration/phase37-review-invariants.test.ts
apps/web/tests/legacy-cleanup-shutdown.test.ts
apps/web/tsconfig.json
apps/web/vitest.config.ts
apps/worker/src/file-processing.ts
apps/worker/src/storage.ts
apps/worker/tsconfig.json
packages/file-storage/src/capabilities.ts
packages/file-storage/src/index.ts
packages/file-storage/src/local-private-storage.ts
packages/file-storage/tests/capabilities.test.ts
packages/file-storage/tests/local-private-storage.test.ts
prisma/schema.prisma
```

### 16.2 Route C-Minimal new source, test, Schema and Migration files

```text
apps/web/src/modules/files/object-upload-lease.ts
apps/web/src/modules/files/object-upload-protocol.ts
apps/web/src/modules/files/object-upload-service.ts
apps/web/tests/download-object-storage-failure.test.ts
apps/web/tests/helpers/object-upload-prisma-harness.ts
apps/web/tests/helpers/p13-file-version.ts
apps/web/tests/object-storage-environment-factory.test.ts
apps/web/tests/object-storage-integrity.test.ts
apps/web/tests/object-upload-migration.test.ts
apps/web/tests/object-upload-protocol.test.ts
apps/web/tests/object-upload-service.test.ts
apps/web/tests/object-upload-source-order.test.ts
apps/worker/tests/object-storage-environment.test.ts
apps/worker/tests/object-storage-integrity.test.ts
apps/worker/vitest.config.ts
packages/file-storage/src/local-object-storage-adapter.ts
packages/file-storage/src/object-storage-adapter.ts
packages/file-storage/src/object-storage-environment.ts
packages/file-storage/src/object-storage-errors.ts
packages/file-storage/src/object-storage-failure.ts
packages/file-storage/tests/local-object-storage-adapter.test.ts
packages/file-storage/tests/object-storage-adapter.test.ts
packages/file-storage/tests/object-storage-environment.test.ts
packages/file-storage/tests/object-storage-failure.test.ts
prisma/migrations/20261126120000_phase38_route_c_minimal_object_binding/migration.sql
prisma/migrations/20261126130000_phase38_route_c_minimal_recovery_hardening/migration.sql
```

其余 untracked 文件主要是前序 WP-1/WP-2A 报告和已存在的异常 artifact。它们未被
读取、覆盖、移动或删除。受保护入口和构建产物保持原状，不在本报告中读取或哈希。

### 16.3 Current key file hashes

| File | SHA-256 | Bytes | Lines |
|---|---|---:|---:|
| `prisma/schema.prisma` | `96C2B3C1F89A07FC1A79D57C3AC0563CACC5EE43AA93293B09ED4F3ED662CE77` | 45100 | 1165 |
| R3 Migration | `EE4128E7D7712DB425643A7790EBAF31E16317CD2D555D79AAE8ABE09B34485D` | 26222 | 860 |
| Object upload service | `B108BAF62A558D4E983E26CC59EF28AA2BAF56EE3C2EDD3F25F06DFAD89A36F2` | 52606 | 1817 |
| Upload service | `E45ADE6177260E2BBC90885D65ACFEB7805D1787C94F1BE8DBBEDAD825179649` | 43193 | 1564 |
| Download service | `E9930446B7BAE12B14E897360892532ADCAB9206845A110D2DFD7FE90122BE05` | 18412 | 667 |
| Local private storage | `C6275363E9A443978A15415EB96219AAE34427DCACA672A29A2FAE4F1BE14D4F` | 23458 | 771 |
| Local object adapter | `C074640368A2B8E749C05F6B5BA02A92D5F1EA763F080937607A6AC4BED00C3F` | 23144 | 748 |
| Failure taxonomy | `62178A04FDEDE87512259BA3F66D1A26BED9A52360E9893290A111BE7CB3E57E` | 2538 | 91 |
| Service fault test | `6AE826EC377682EF809EEE7B664A7B024FB26877FD5C2098669B0401C5BDEA67` | 18031 | 559 |
| Prisma harness | `DA5DF7BA01167C9499B236277DC2C7C53FAFBC564398F6A73183208BF134E707` | 19293 | 678 |

文件不能在自身字节中稳定嵌入自己的 SHA-256。报告冻结后的 SHA-256、字节数和
行数在交付消息中提供，不伪造自引用哈希。

## 17. Git State

### 17.1 At R3 start

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       19
Staged:                 0
Deleted:                0
Untracked files:        60
```

### 17.2 Before this report was created

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  66
Untracked files:        67
```

### 17.3 Final state

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       23
Staged:                 0
Deleted:                0
Untracked Git entries:  67
Untracked files:        68
New report:             docs/architecture/wp-2a-route-c-minimal-controlled-remediation-r3.md
```

相对本轮开始，Git 计数增加来自 Route C-Minimal 源码、测试、Migration 和前序
报告；本报告本身只新增一个 untracked Markdown 文件。除本报告外，本轮冻结阶段
没有再修改源码、Schema、Migration、测试、配置或既有报告。

本轮没有执行 `git reset`、`restore`、`clean`、`checkout`、`stash`、`add`、
commit 或 push。没有删除、移动或重命名用户文件和前序报告。

## 18. Final Verdict

```text
CM1-R3 PASS WITH RESTRICTIONS
— READY FOR INDEPENDENT REVIEW
```

理由：

- R2-R1 的唯一 P1 已由 durable idempotency identity 修复并覆盖 Service test；
- Adapter/Provider 运行故障不再污染永久完整性状态；
- local close、target identity、SHA-256 和 no-overwrite publication 已补齐；
- Migration 对未来时间戳和非空历史状态采用明确 Fail Closed 策略；
- Binding/Operation/Lifecycle/FileVersion 终态关系已有 deferred 数据库守卫；
- Local Adapter 在服务层也有环境门禁；
- 本地服务级故障注入已真实执行，测试总计 448 项通过；
- 没有新增 P0/P1，没有残余阻断源码独立审查的缺陷。

限制：

- Local Object Adapter 的路径安全仍受 Node core 平台竞态限制，只能用于显式
  development/test；
- PostgreSQL Migration、Trigger、Deferred Constraint 和双 Session 并发未执行；
- 真实 Provider、Windows OS Authority、ACL、E2E、Build、Startup Gate 和部署
  未验证；
- R5、BV7、BV8、历史 R8 和 P2-05 状态没有改变。

完成本报告后停止。不得自行进入 PostgreSQL、真实 Provider、源码进一步实施、
Build、E2E 或部署阶段。
