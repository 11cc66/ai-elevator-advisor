# P1-3 C-6.2-L8-A7.20-R4-S3 Authority Remediation Design

## 1. Executive Summary

本设计针对 R4-S2 的三个 P1 修订 Authority 架构：

```text
P1-A Independent Operation Grant
P1-B Immutable Signed Helper Release
P1-C Per-request IPC Peer Authentication
```

V1 最终模型保持：

```text
P13 Authority Supervisor
+ Staging Writer Helper
+ Publisher Helper
+ Sealer Helper
+ Cleanup Helper
```

但增加：

```text
DB-issued one-time Operation Grant
Helper-local Grant verification through a narrow DB role
Signed Helper Release manifest
Fixed launch template and immutable release directory
Per-request HMAC proof-of-possession
Linux per-message credentials and process-lifetime binding
```

核心结论：

1. Supervisor 不再能仅凭自报参数指定 Helper 的目标。
2. Helper 在执行破坏性 OS 操作前，必须从数据库解析并原子 reserve Grant。
3. Grant 绑定 Operation、generation、storageKey、action、Helper 类型、
   Helper Release digest 和精确对象身份。
4. Supervisor 只能请求数据库当前状态允许的 Grant，不能自行改写目标。
5. Helper executable 与依赖由 Signed Release manifest 和固定 launch template 管理。
6. IPC 请求使用连接绑定 HMAC，复制 socket/pipe handle 不足以复用身份。
7. Evidence 采用 Helper 观察 + Supervisor 独立复核的双证据模型。
8. `SEALED` 继续是 OS 权限边界；`DELETED` 继续仅表示受控 namespace removal。

本设计为：

```text
DESIGN ONLY
```

不构成代码、Schema、Migration、OS 权限、Service 或 Storage 操作授权。

## 2. Trust Model

### 2.1 TCB

V1 显式 TCB：

```text
Authority Supervisor 进程及执行代码
Native Helpers 进程及执行代码
操作系统内核和文件系统
数据库服务器及数据库 Owner
Release Trust Root 管理员
Host Administrator
```

Host Administrator、root/administrator、恶意内核和数据库 Owner 不等同于普通应用
攻击者。它们是部署信任边界的一部分。

### 2.2 Principals

| Principal | Storage direct | DB | 说明 |
|---|---|---|---|
| Web/Worker | 无 | 业务表权限 | 只能访问业务 API |
| Supervisor | 只读 | 仅 grant/evidence/finalization 函数 | 不直接写删 |
| Staging Writer Helper | staging write | grant reserve/report | 一次性 |
| Publisher Helper | target create/write | grant reserve/report | 一次性 |
| Sealer Helper | owner/DACL 移交 | grant reserve/report | 一次性 |
| Cleanup Helper | staging delete | grant reserve/report | 一次性 |
| Canonical Guardian | 无 | 无 | 只读 Owner |

### 2.3 Supervisor 分级

| 场景 | 预期结果 |
|---|---|
| Application logic bug | Grant target 由 DB 固定，Helper 拒绝错误目标 |
| Process memory compromise | 可滥用当前 Session，但不能自行创建任意 target Grant |
| OS identity compromise | 仍受 Helper Release gate、DB Grant、FS ACL 约束 |
| DB credential compromise | 可尝试调用允许函数，但函数只对合法状态签发 Grant |
| Executable replacement | Signed Release/Code Integrity 阻止 |
| Host Administrator compromise | 超出安全保证 |

Supervisor 不是 Helper 目标的最终授权者。

## 3. Supervisor TCB Boundary

Supervisor 可以：

- 接受认证 IPC；
- 请求 DB 签发 Grant；
- 启动固定 Helper；
- 读取和独立验证 Storage；
- 提交 Supervisor Verification Evidence；
- 根据 Grant/Evidence 完成 DB 状态。

Supervisor 不可以：

- 直接写 canonical；
- 直接 delete staging；
- 自行指定 Helper 可执行路径；
- 自行指定任意 Helper target；
- 直接生成 Helper OS observation；
- 绕过 Helper Grant 创建 FileVersion；
- 修改 active Grant 的 storageKey、target identity 或 generation。

## 4. Independent Operation Grant

### 4.1 Chosen Model

V1 选择：

```text
Model B: Database-issued Operation Grant
```

数据库是唯一 Grant issuer。

Supervisor 只能调用受控 DB 函数请求 Grant；Grant 中的 target/action 从 DB
Operation 和已有 Evidence 派生，Supervisor 不能覆盖。

Helper 通过专用 DB role 执行：

```text
p13_reserve_helper_grant(...)
p13_report_helper_effect(...)
```

Helper 不使用 Supervisor 提供的 target path 作为安全依据。

### 4.2 Grant States

```text
ISSUED
  -> RESERVED
  -> EFFECT_REPORTED
  -> CONSUMED

ISSUED/RESERVED
  -> EXPIRED
  -> REVOKED
  -> UNKNOWN
```

终态不可重新激活。

### 4.3 Grant Fields

```text
grantId
grantVersion
issuer
audience
operationId
attemptId
generation
storageKey
protocolVersion
primaryAction
helperType
helperReleaseDigest
brokerEpoch
sessionId
requestId
targetNamespace
sourceObjectIdentity
targetObjectIdentity
expectedSize
expectedChecksum
nonceHash
issuedAt
expiresAt
reservedAt
effectReportedAt
consumedAt
revokedAt
lastErrorCode
```

规则：

- target/source identity 由 DB 从 Operation/Evidence 派生；
- Supervisor 提交的同名字段只用于匹配，不作为授权数据源；
- Helper 类型不匹配则拒绝；
- action 不匹配则拒绝；
- grant 生命周期不超过 60 秒，但 TTL 不是安全证明；
- 一个 operation/action/generation 同时只能有一个 active Grant。

## 5. Grant Issuance / Verification / Consumption

### 5.1 Issue

受控 DB 函数：

```text
p13_issue_helper_grant(
  operation_id,
  helper_type,
  release_digest,
  broker_epoch,
  session_id,
  request_id
)
```

函数内部检查：

- Operation 存在；
- Operation 是当前 generation；
- Operation 状态允许对应 helper；
- storageKey 与 protocol v2 namespace 一致；
- release digest 在 active allowlist；
- 当前没有冲突 active Grant；
- target/source identity 与 DB Evidence 一致；
- Supervisor DB role 只能就当前可执行状态请求。

### 5.2 Reserve

Helper 使用自己的受限 DB role：

```text
p13_reserve_helper_grant(
  grant_id,
  helper_type,
  release_digest,
  helper_session_nonce
)
```

数据库原子执行：

```sql
UPDATE helper_grant
SET state = 'RESERVED',
    reservedAt = now(),
    reservedByHelperSession = :nonce
WHERE id = :grant_id
  AND state = 'ISSUED'
  AND expiresAt > now()
  AND helperType = :helper_type
  AND helperReleaseDigest = :release_digest
RETURNING ...
```

只有唯一调用者成功。Grant 的 target/action 由 DB 返回，Helper 不接受外部路径。

### 5.3 Effect Report

Helper 完成有限 OS 操作后：

```text
p13_report_helper_effect(
  grant_id,
  helper_session_nonce,
  result_code,
  observed_identity,
  observed_size,
  observed_hash,
  observed_name_state
)
```

该调用只写 Helper evidence，不把 Operation 置为 APPLIED。

Supervisor 随后必须独立读取文件事实，写 Supervisor Verification Evidence。
数据库只有同时具有匹配的 Helper Effect Evidence 和 Supervisor Verification
Evidence，才允许 Operation APPLIED/DELETED。

### 5.4 Consume

最终事务消费 Grant：

```text
grant EFFECT_REPORTED -> CONSUMED
operation -> APPLIED/DELETED
evidence -> immutable
audit -> inserted
```

## 6. Grant Replay and Revocation

- `grantId` 只对 operation/action/generation/helperType 有效；
- Reserve 是原子 UPDATE；
- 同一 Grant 不能被两个 Helper 同时 reserve；
- Helper 报告必须携带 session nonce；
- Supervisor epoch 变化使未消费 Grant 标记 `REVOKED` 或 `UNKNOWN`；
- DB 连接断开不表示 Helper 退出；
- Helper crash 后 Grant 保持 `RESERVED`，不得自动重新分配；
- 新 Supervisor 必须取得旧 Helper 进程退出证明后才能请求 recovery grant；
- PB 版本、helper release digest 或 target identity 不匹配时拒绝；
- DB Owner 可绕过，明确属于 TCB。

## 7. Helper Signed Release

每个 Helper 发布包包含：

```text
releaseId
releaseVersion
manifestVersion
helperType
platform
architecture
minimumOSVersion
protocolVersionRange
executableDigest
dependencyDigests
runtimeConfigDigest
allowedArguments
environmentAllowlist
workingDirectoryPolicy
createdAt
expiresAt
signingKeyId
signature
```

Release manifest 使用 Ed25519 签名。私钥只存在于离线签名环境/HSM，
运行时只有公钥。

Supervisor 不能生成、修改或替换 Release manifest。

## 8. Helper Executable Integrity

固定 launch template：

```text
helperType
absoluteExecutablePath
releaseManifestPath
allowedArguments
environmentAllowlist
workingDirectory
assignedOSIdentity
inheritedHandlePolicy
timeout
```

规则：

- executable path 由 Supervisor 静态表决定，客户端无法提供；
- Helper 不接收任意 target/path；
- only grantId/operationId/session nonce 由启动参数传递；
- helper directory 只读，apps 无写权限；
- Supervisor 启动前验证 Signed Release；
- Grant issuance 再次验证 release digest 为 active；
- Windows 采用 Code Integrity/WDAC 或等价加载期验证；
- Linux 固定 ELF + 依赖 digest，read-only release root，必要时使用 fs-verity；
- 禁止 `LD_PRELOAD`、`LD_LIBRARY_PATH`、危险 DLL search path、任意 cwd；
- Helper 不创建子进程、不继承 Storage handles。

## 9. Dependency Integrity

- Release manifest 覆盖所有运行时库和 native helper 依赖；
- Windows 使用系统 DLL search policy、绝对依赖路径、Code Integrity；
- Linux 使用固定 loader 路径、无 RUNPATH 注入、环境清空；
- `node_modules`、包缓存或用户目录不得参与 Helper 加载；
- 验证之后的替换由只读目录/ACL/Code Integrity/fs-verity 防止；
- 若平台不能提供加载期完整性，只能 `IDENTITY_DEGRADED`。

Helper DB credential 边界：

- 每类 Helper 使用独立最小权限 DB role；
- DB credential 只由对应 Helper OS identity 读取；
- Windows 使用 DPAPI-NG/LSA protected secret 或等价受保护存储；
- Linux 使用 root-owned `0400` systemd credential 或等价受保护存储；
- Supervisor 和普通 Web/Worker 不得读取 Helper credential；
- credential 不进入命令行、环境变量、日志或普通配置文件；
- credential 轮换与 Helper Release/OS identity 绑定，旧 credential 立即撤销。

## 10. Startup Parameter Policy

Helper 只接受：

```text
--helper-type
--grant-id
--broker-session
--protocol-version
```

禁止：

- 任意 absolute path；
- arbitrary storageKey；
- arbitrary owner/DACL；
- arbitrary environment；
- child process；
- extra handle inheritance；
- extra runtime arguments。

Working directory 固定为 release root。标准输入输出使用预定义诊断 channel，
不得输出 secret 或完整绝对路径。

## 11. Linux Per-request IPC Authentication

连接建立：

- socket 目录 `0700`，socket 由 Supervisor owner；
- `SO_PEERCRED` 记录 peer pid/uid/gid；
- `pidfd_open` 绑定 peer PID 与 start time；
- 不接收 SCM_RIGHTS；
- socket 使用 CLOEXEC；
- 连接关闭使 Session 失效。

每请求：

- `SO_PASSCRED`；
- 每消息接收 SCM_CREDENTIALS；
- 验证发送进程 UID/GID/PID；
- 与建连 peer 和 pidfd 进行一致性校验；
- 跨 PID namespace 时使用映射后的身份规则；
- 无法取得或验证 credentials 时拒绝；
- Token 经监听连接发送，不落日志。

## 12. Windows Per-request IPC Authentication

连接：

- Named Pipe 私有 namespace；
- 显式 DACL 只允许指定 Service SID；
- `PIPE_REJECT_REMOTE_CLIENTS`；
- `ImpersonateNamedPipeClient` + token SID 验证；
- 完成认证后 `RevertToSelf`；
- 获取客户端进程 handle，保存 process start time；
- 禁止远程连接。

请求：

- 每连接派生 256-bit HMAC key；
- 每个 request 覆盖 payload digest、nonce、sequence、sessionId、
  brokerEpoch、operationId、generation、action；
- 服务端 constant-time verify；
- 重复/过期 nonce 拒绝；
- Pipe handle 被复制但没有 HMAC key 时不能伪造有效请求；
- HMAC key 不落盘、不进日志、不发送给 Helper；
- process handle 关闭时 Session 失效。

## 13. Supervisor Compromise Analysis

### Logic Bug

- 不能构造任意 target Grant；
- Helper reservation 从 DB 取 target；
- Helper 拒绝非当前 operation/action；
- 只能产生 DoS 或错误状态报告，不能任意 canonical 写入。

### Process Memory Compromise

- 可以盗取当前连接 HMAC 和 active capability；
- 仍不能伪造 DB Grant；
- 不能指定 Helper target；
- 可伪造 Supervisor Verification Evidence；
- Helper Effect Evidence 与 Supervisor 独立，不能同时伪造。

### DB Credential Compromise

- 可调用 Supervisor 授权函数；
- 只能为该 role 允许的 Operation 请求 Grant；
- 不能直接写 Grant 的 target/path；
- DB Owner 若被攻陷，属于 TCB 失效。

### OS Identity Compromise

- 可启动固定 Helper，但不能指定任意 binary/path/target；
- 不能绕过 Helper DB Grant；
- 不能直接写 canonical；
- 可造成 DoS 或授权 operation 重放，需 Supervisor restart fencing。

### Executable Replacement

- Signed Release + Code Integrity/read-only dir 阻止；
- Release digest 不匹配时 Grant issuer/Helper 都拒绝。

### Host Administrator

不属于 V1 可防御边界。

## 14. Helper Permission Matrix

| Capability | Staging Writer | Publisher | Sealer | Cleanup |
|---|---|---|---|---|
| Read staging | own attempt | assigned staging | source evidence | assigned staging |
| Write staging | own only | no | no | no |
| Create canonical | no | assigned target only | no | no |
| Modify canonical | no | during write only | no data write | no |
| Owner/DACL | no | no | exact target only | no |
| rename | no | no | no | no |
| unlink | no | no | no | exact staging only |
| Modify parent | no | create entry only | no | exact staging entry |
| Child process | no | no | no | no |
| DB access | grant reserve/report | grant reserve/report | grant reserve/report | grant reserve/report |
| Evidence write | helper effect only | helper effect only | helper effect only | helper effect only |
| Cross-stage handle | no | no | no | no |

所有 Helper 使用独立 OS identity，不继承其他 Helper 的 handle。

## 15. Evidence Provenance

Evidence 类型：

```text
HELPER_EFFECT
SUPERVISOR_VERIFICATION
DB_DURABLE_EVIDENCE
```

Helper Effect Evidence 由 Helper 的受限 DB role 写入：

- 绑定 grantId、helperType、releaseDigest、operationId、generation；
- 记录 OS observation；
- 不能更新 Operation terminal state。

Supervisor Verification Evidence 由 Supervisor 的受限 DB role 写入：

- 独立读取 target/source；
- 绑定同一 Grant 和 object identity；
- 不能伪造 Helper Effect。

DB 最终事务要求：

```text
Helper Effect Evidence
+ Supervisor Verification Evidence
+ matching Operation/Grant
=> APPLIED / DELETED
```

Append-only、UPDATE/DELETE/TRUNCATE Guard 继续作为 Schema v2 要求。

## 16. SEALED Consistency

OS_ENFORCED_SEALED 条件：

1. Publisher Helper 已退出；
2. Sealer Helper 已退出；
3. DB 已消费 Publisher/Sealer Grant；
4. Target 是独立 inode；
5. Target size/hash 已由 Helper 和 Supervisor 分别验证；
6. Publisher identity 无法新开写；
7. Publisher identity 无法改 ACL/Owner/属性；
8. Publisher identity 无法 rename/unlink；
9. Supervisor 只有 read/verify；
10. Canonical parent namespace 阻止替换；
11. Sealer/Lifecycle Evidence 已持久化；
12. DB APPLIED 与 Evidence 同事务。

Supervisor 若仍能通过进程权限重新获得写权，则不能标记 OS_ENFORCED_SEALED。

## 17. DELETED Consistency

保持：

```text
DELETED = Controlled Namespace Removal Completed
```

Cleanup Grant 必须绑定：

- operationId；
- generation；
- storageKey；
- source object identity；
- source parent identity；
- canonical FileVersion identity；
- cleanup action；
- helper release digest；
- broker epoch；
- requestId。

Cleanup Helper 不能使用 grant 之外的目的路径，也不能删除 canonical。

DELETED 不表示：

- 介质擦除；
- 所有外部句柄关闭；
- 文件系统块回收；
- SSD/虚拟盘数据不可恢复。

## 18. Publication / Cleanup Recovery

### Publication

| 故障 | 结果 |
|---|---|
| Publisher Grant issued, Supervisor crash | Grant expires/revoked；无 APPLIED |
| Publisher crash before syscall | Grant RESERVED；UNKNOWN；需旧进程退出证明 |
| Publisher syscall complete, no report | Supervisor re-observe；不自动 APPLIED |
| Sealer crash | target retained；UNKNOWN |
| DB commit unknown | new connection query；未 APPLIED 则保持 UNKNOWN |
| Old Helper remains | AUTHORITY_BUSY；禁止新 grant |

### Cleanup

| 故障 | 结果 |
|---|---|
| Cleanup Grant issued, crash | UNKNOWN；不 DELETED |
| unlink complete, no helper report | Supervisor re-observe；不自动 DELETED |
| Helper exits, name absent, target valid | can finalize DELETED |
| parent/root identity changed | UNKNOWN/FR |
| directory fsync failed | no DELETED |
| old Helper remains | AUTHORITY_BUSY |

## 19. Windows / Linux Capability Matrix

| Capability | Windows Node core | Windows Native | Linux Node core | Linux Native |
|---|---|---|---|---|
| Signed Helper Release | NOT SUPPORTED | SUPPORTED with Authenticode/WDAC | NOT SUPPORTED | SUPPORTED with signed manifest/fs-verity |
| Fixed launch template | PARTIAL | SUPPORTED | PARTIAL | SUPPORTED |
| Per-request IPC identity | NOT SUPPORTED | SUPPORTED with HMAC/token | NOT SUPPORTED | SUPPORTED with SCM_CREDENTIALS/pidfd |
| Anti-FD/handle delegation | NOT SUPPORTED | SUPPORTED with HMAC/session | NOT SUPPORTED | SUPPORTED with per-message credentials |
| DB Grant verification | NOT SUPPORTED | SUPPORTED | NOT SUPPORTED | SUPPORTED |
| Helper OS identity isolation | NOT SUPPORTED | SUPPORTED | NOT SUPPORTED | SUPPORTED |
| File ID | PARTIAL | SUPPORTED | PARTIAL | SUPPORTED |
| Parent identity | PARTIAL | SUPPORTED | PARTIAL | SUPPORTED |
| Reparse/Symlink reject | PARTIAL | SUPPORTED | PARTIAL | SUPPORTED |
| Handle-bound delete | NOT SUPPORTED | SUPPORTED | NOT SUPPORTED | PARTIAL |
| ACL/Owner transfer | NOT SUPPORTED | SUPPORTED | NOT SUPPORTED | SUPPORTED |
| Directory durability | NOT SUPPORTED | PARTIAL | PARTIAL | PARTIAL |

## 20. Failure Matrix

| Failure | State |
|---|---|
| IPC peer invalid | `DENIED` |
| Request HMAC invalid | `DENIED` |
| Grant missing/expired | `GRANT_REJECTED` |
| Grant helper type mismatch | `GRANT_REJECTED` |
| Release digest mismatch | `RELEASE_REJECTED` |
| Helper running | `AUTHORITY_BUSY` |
| Helper exited unconfirmed | `UNKNOWN` |
| Grant reserved but no effect | `UNKNOWN` |
| Effect report without Supervisor verification | no APPLIED |
| Supervisor restart | new epoch; old grants/sessions revoked |
| DB disconnect | no new destructive call; query/recover |
| DB commit unknown | new connection query |
| root/parent/ns mismatch | `FAILED_RETAINED` |
| directory fsync failed | `UNKNOWN` |
| hard-link mismatch | `FAILED_RETAINED` |
| Release revoked | no new helper; running helper completes or UNKNOWN |

## 21. Security Invariants

1. Supervisor cannot specify Helper target.
2. Helper obtains target from DB Grant.
3. Grant unique and one-time.
4. Grant bound to helper release digest.
5. Helper binary/dependency immutable.
6. IPC request bound to per-request HMAC and peer process.
7. Old epoch invalidates old sessions/grants.
8. Helper Effect and Supervisor Verification are distinct.
9. APPLIED requires both evidence sources.
10. SEALED only after both helpers exit and OS permissions are read-only.
11. DELETED only means namespace removal.
12. Canonical reads revalidate identity/size/hash.
13. UNKNOWN never auto-promotes.
14. v1/v2 namespaces cannot cross-write.

## 22. Known Limitations

- No helper implementation or OS capability validation yet.
- Host Administrator, DB Owner and kernel compromise remain TCB failures.
- Signed Release verification depends on Code Integrity/WDAC or read-only/fs-verity.
- Directory fsync behavior is filesystem-dependent.
- FileId/inode reuse prevents permanent OS-object identity.
- Evidence is point-in-time; canonical read must revalidate.
- Production Trust Root, ACL and OS identities are not configured.

## 23. Implementation Prerequisites

- Approve new Grant/Evidence DB model and helper DB roles;
- Approve helper release signing and deployment;
- Approve fixed process identities/ACLs;
- Approve IPC HMAC/per-message credential implementation;
- Approve Windows Code Integrity/WDAC and Linux read-only/fs-verity plan;
- Approve v1/v2 drain protocol;
- Complete R4-S4 independent review;
- Obtain separate implementation authorization.

## 24. Status

```text
DESIGN:
COMPLETE FOR R4-S4 REVIEW

IMPLEMENTATION:
NOT AUTHORIZED

DATABASE:
NOT AUTHORIZED

STORAGE:
NOT AUTHORIZED

CLEANUP / RECOVERY:
NOT AUTHORIZED
```
