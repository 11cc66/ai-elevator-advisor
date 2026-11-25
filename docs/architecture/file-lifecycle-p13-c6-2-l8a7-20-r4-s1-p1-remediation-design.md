# P1-3 C-6.2-L8-A7.20-R4-S1 P1 Remediation Design

## 1. Executive Summary

本设计针对 A7.20-R4-R 确认的五个 P1 修订 OS Authority 架构。

最终选择：

```text
P13 Authority Supervisor
+ 一次性 Staging Writer Helper
+ 一次性 Publisher Helper
+ 一次性 Sealer Helper
+ 一次性 Cleanup Helper
+ 独立 OS identities
+ Copy-on-Publish
+ DB-owned Evidence
+ Protocol v2 physical namespaces
```

关键结论：

1. Web/Worker 不直接访问 Storage Root。
2. Supervisor 不执行文件写入或删除，只负责 IPC、DB authority、会话和流程协调。
3. Publisher 与 Cleanup 使用一次性 Helper；Helper 退出后，其所有 OS 句柄由进程终止保证关闭。
4. Sealer 在 Publisher 退出后把 canonical 权限移交给只读 Canonical Guardian；Supervisor 不再拥有 canonical 写权限。
5. Supervisor 是唯一 Evidence 提交者，普通 Web/Worker 没有 Evidence INSERT 权限。
6. Broker 重启必须更换 authority epoch；旧 capability、旧 session、旧请求一律失效。
7. `DELETED` 定义为“受控 Namespace Removal Completed”，不代表介质擦除。

本设计为：

```text
DESIGN ONLY
```

不构成代码、Schema、ACL、Service 或生产运行授权。

## 2. Trust Model

### 2.1 Principals

```text
Web Runtime
Worker Runtime
Authority Supervisor
Staging Writer Helper
Publisher Helper
Sealer Helper
Cleanup Helper
Canonical Guardian
OS Administrator
Storage Owner
```

### 2.2 权限原则

| Principal | Storage Root Direct Write | Delete | Evidence Write | 说明 |
|---|---:|---:|---:|---|
| Web | 否 | 否 | 否 | 仅业务 API |
| Worker | 否 | 否 | 否 | 仅业务 API |
| Supervisor | 否 | 否 | 是 | IPC/DB/session |
| Staging Writer Helper | 仅自己 staging | 否 | 否 | 一次性 |
| Publisher Helper | 仅新建 target | 否 | 否 | 一次性 |
| Sealer Helper | 仅权限移交 | 否 | 否 | 一次性 |
| Cleanup Helper | 否 | 仅指定 staging | 否 | 一次性 |
| Canonical Guardian | 否 | 否 | 否 | 只读保护主体 |
| OS Administrator | 有 | 有 | 否 | 破坏可信边界 |
| Storage Owner | 受部署 ACL | 受部署 ACL | 否 | 必须在受控主体 |

OS Administrator 与恶意内核不属于系统能防御的边界。

## 3. Broker IPC Protocol

### 3.1 Transport

Windows：

- Named Pipe；
- 私有 pipe namespace；
- `PIPE_REJECT_REMOTE_CLIENTS`；
- 显式 SECURITY_DESCRIPTOR；
- DACL 只允许预注册的应用 Service SID 和 Broker 服务 SID；
- 不使用默认 Named Pipe ACL。

Linux：

- Unix Domain Socket；
- socket 位于 broker-owned `0700` 目录；
- socket 文件由 Broker own，group 仅授权允许的服务组；
- 不接受路径重定向或符号链接；
- `SOCK_CLOEXEC`；
- 不通过 socket 传递任意文件。

### 3.2 Peer Authentication

Windows：

- `ImpersonateNamedPipeClient`；
- `OpenThreadToken`；
- `GetTokenInformation(TokenUser/TokenGroups)`；
- 用实际 SID 映射 caller role；
- 绝不信任客户端提供的 `callerOSIdentity` 字符串；
- 完成认证后 `RevertToSelf`，再执行 Broker 事务。

Linux：

- accept 后读取 `SO_PEERCRED`；
- 可同时启用 per-message credentials；
- 使用实际 UID/GID 映射 caller role；
- 不信任客户端自报 UID/PID；
- PID 仅作为诊断，不作为稳定安全身份。

### 3.3 Request Schema

客户端只发送：

```json
{
  "protocolVersion": 2,
  "requestId": "opaque-client-request-id",
  "operationId": "db-operation-id",
  "action": "publish",
  "clientNonce": "opaque-random-value"
}
```

客户端不得发送：

- 绝对路径；
- 任意 parent directory；
- 任意 canonical path；
- caller OS identity；
- ownerToken；
- generation；
- Broker epoch；
- Evidence 字段；
- 成功状态。

Broker 从 DB Operation 查询并固定：

```text
storageKey
generation
protocolVersion
operationType
expected size/hash
namespace
```

### 3.4 Response Schema

```json
{
  "requestId": "same-id",
  "operationId": "db-operation-id",
  "state": "EXECUTING|OS_EFFECT_OBSERVED|DB_APPLIED|UNKNOWN|FAILED_RETAINED",
  "code": "OK|DENIED|BUSY|STALE|UNKNOWN|RETRY_WITH_SAME_REQUEST",
  "brokerEpoch": "epoch-id",
  "sessionId": "session-id",
  "evidenceIds": []
}
```

不返回文件系统绝对路径、句柄、密钥或敏感证据内容。

## 4. Capability Model

### 4.1 不采用自包含签名 Token

V1 采用：

```text
server-side opaque capability
```

而不是客户端携带自签名 JWT。

理由：

- IPC 仅本机；
- peer identity 已由 OS 提供；
- Broker 是唯一 capability issuer/verifier；
- 不需要在应用侧保存签名私钥；
- Broker 直接连接受限 DB 并读取当前 Operation；
- 把签名密钥管理交给未来跨主机场景，而不是当前单机 V1。

Capability 是 256-bit 随机 nonce，只在 Supervisor 和已认证连接间使用，
并由 Supervisor 在内存和受限 DB session 表中保存其 hash。

### 4.2 Binding

Capability 绑定：

```text
capabilityId
brokerEpoch
brokerSessionId
authenticatedOSIdentity
applicationActorId
operationId
storageKey
generation
protocolVersion
action
requestId
issuedAt
expiresAt
```

`applicationActorId` 来自 DB Operation/Audit 关联，不作为 OS 认证依据。

### 4.3 校验规则

- peer OS identity 必须匹配 session；
- Broker epoch 必须匹配当前进程；
- operationId/storageKey/generation 必须匹配 DB Operation；
- action 必须在 capability scope；
- `publish` 不可用于 cleanup；
- `cleanup` 不可用于 canonical write；
- storageKey 不可跨对象替换；
- requestId 必须绑定 payload；
- token/session 过期后拒绝；
- 旧 Broker epoch 全部失效。

## 5. Broker Epoch / Session

### 5.1 Epoch

每次 Supervisor 启动创建新的：

```text
brokerEpoch = OS boot nonce + process start nonce + random
```

Epoch 不持久化为“可继续使用”；重启后不可恢复旧 capability。

### 5.2 Session

```text
sessionId
brokerEpoch
callerOSIdentity
operationId
storageKey
generation
action
state
helperProcessHandle
leaseDeadline
requestJournal
```

同一 `storageKey` 同时只有一个破坏性 Session。

### 5.3 重启

Broker 重启后：

- 所有旧 capability 失效；
- 所有旧 Session 进入 `EPOCH_STALE`；
- 不自动重启旧 helper；
- 新请求必须重新读取 DB；
- 若旧 OS 状态未证明，Operation 保持 `UNKNOWN`。

## 6. Replay Protection

### 6.1 Request States

```text
REQUEST_RECEIVED
AUTHENTICATED
AUTHORIZED
EXECUTING
OS_EFFECT_OBSERVED
EVIDENCE_DURABLE
DB_APPLIED
RESPONSE_DELIVERED
```

### 6.2 Idempotency

- 相同 requestId + 相同 payload：返回已记录状态；
- 相同 requestId + 不同 payload：`REQUEST_CONFLICT`；
- 不同 requestId + 同一 operation/action：
  - 若 operation 已 EXECUTING/terminal，拒绝重复启动；
  - 只能查询或继续恢复。
- request journal 持久化在 Supervisor DB role 可写表。
- OS syscall 完成但响应丢失时，不能重复破坏动作。

## 7. Evidence Trust Chain

### 7.1 Producer

只有 Supervisor 可写 Evidence。

Web/Worker：

- 无 Evidence INSERT/UPDATE 权限；
- 只能读取公开业务状态；
- 不能提交 OS observed facts。

Helper：

- 只向 Supervisor 返回一次性执行结果；
- 不写 DB；
- 不直接构造最终 Evidence。

Supervisor：

- 重新打开并验证 target/source；
- 独立取得身份、size、hash、namespace；
- 写 Evidence 与 Operation 状态。

### 7.2 Integrity

Evidence 表采用：

- append-only；
- UPDATE/DELETE/TRUNCATE Guard；
- operation sequence；
- previousEvidenceHash；
- evidenceDigest；
- brokerEpoch；
- brokerSessionId；
- adapterBuildDigest。

不采用堆叠数字签名，因为 Data Owner/Broker 本身仍在可信计算基内。

### 7.3 Durability

```text
OS syscall
-> Supervisor independent observation
-> Evidence row INSERT
-> DB Operation state UPDATE
-> same transaction COMMIT
```

Evidence 与业务状态在同一 DB transaction 中提交：

- `APPLIED` 存在 ⇒ Evidence 存在；
- Evidence 存在但 DB 未提交 ⇒ 事务回滚；
- OS effect 存在但 Evidence 未提交 ⇒ Recovery 复核。

不得在 Evidence 缺失时补写成功事实。

## 8. Object Identity

最小结构：

```text
filesystemType
volumeIdentity
namespaceId
rootIdentity
parentDirectoryIdentity
objectIdentity
storageKey
sizeBytes
checksumSha256
generation
operationId
brokerEpoch
brokerSessionId
protocolVersion
observedAt
adapterVersion
adapterBuildDigest
```

Windows：

- VolumeSerialNumber + 128-bit FileId；
- FileStandardInfo；
- FileAttributeTagInfo。

Linux：

- st_dev + st_ino；
- st_nlink；
- mount/namespace identity；
- parent dir identity。

身份只在观察时刻有效。读取 canonical 时仍需重新验证当前对象、size 和 hash。

## 9. SEALED Permission Model

### 9.1 定义

```text
OS_ENFORCED_SEALED
```

要求：

1. Publisher Helper 已退出；
2. Publisher 的句柄随进程退出关闭；
3. Sealer Helper 已退出；
4. Publisher identity 无法新开写句柄；
5. Publisher identity 无法修改 ACL/Owner/属性；
6. Publisher identity 无法 rename/unlink/replace；
7. Supervisor 只有 canonical read/verify 权限；
8. Cleanup 只能处理 staging；
9. Canonical target identity/size/hash 已重新验证；
10. Evidence 已进入 DB transaction。

如果任一条件不能证明：

```text
BROKER_LOGICALLY_SEALED
```

不得写 Publication Evidence 或创建 FileVersion。

### 9.2 Windows

- Publisher Helper 在独立 service token 下创建 target；
- 使用 `CREATE_NEW`，不继承 handle；
- 写入、sync、关闭后退出；
- Sealer Helper 独立运行，设置 Owner/DACL；
- DACL 拒绝 Publisher 的 WRITE_DATA、APPEND_DATA、
  WRITE_ATTRIBUTES、WRITE_DAC、WRITE_OWNER、DELETE；
- Parent DACL 拒绝 Publisher 的 FILE_DELETE_CHILD 和创建同名替换；
- Supervisor 仅获 read/read attributes；
- Cleanup 不得获得 canonical delete。

### 9.3 Linux

- Publisher Helper 在 publication UID 下创建 target；
- `O_EXCL`、no-follow、close-on-exec；
- 退出后 Sealer Helper 将 target 转移给 Canonical Guardian；
- canonical owner/group/mode 置为只读；
- Parent directory 使用 ownership/ACL/sticky 机制阻止 Publisher 删除或替换；
- Supervisor 不是 canonical owner，也不持有 CAP_DAC_OVERRIDE/CAP_FOWNER；
- CAP_CHOWN/CAP_FOWNER 只存在于 Sealer Helper 的短生命周期中；
- Sealer 退出后 capability 不再存在。

## 10. Single Authority Process Decision

V1 选择：

```text
长期 Supervisor
+ 单用途一次性 Helper
```

不采用“长期 Broker 自身持有全部文件写/删权限”的单进程模型。

原因：

- 单长期进程无法在 DB_APPLIED 后证明自己永久失去 canonical 写权；
- Linux 无 Windows deny-write 等价语义；
- 一次性 Helper 退出可由 Process Supervisor 明确证明所有句柄关闭；
- Sealer 可以把 Owner/DACL 移交给只读 Canonical Guardian；
- Supervisor 继续存在但不再拥有 canonical 写权限。

### 进程约束

- Helper 不创建子进程；
- Helper 无 DB 权限；
- Helper 不接收任意路径；
- Helper 不继承其他 cap；
- Windows Job Object 禁止 breakaway，Supervisor 退出时终止 Helper；
- Linux 使用独立 cgroup/process group，Supervisor 崩溃时终止全部 Helper；
- Helper 退出是进入 Evidence/DB_APPLIED 的前置条件。

## 11. Publication 状态机

```text
ABSENT
  -> STAGING_VERIFIED
  -> PUBLISHER_STARTED
  -> TARGET_EXCLUSIVE
  -> TARGET_WRITTEN
  -> PUBLISHER_EXITED
  -> SEALER_STARTED
  -> CANONICAL_ACL_SEALED
  -> SEALER_EXITED
  -> PUBLICATION_VERIFIED
  -> EVIDENCE_RECORDED
  -> DB_APPLIED
```

失败状态：

```text
UNKNOWN
FAILED_RETAINED
```

关键规则：

- Publisher Helper 未退出 ⇒ 不进入 SEALER。
- Sealer Helper 未退出 ⇒ 不进入 PUBLICATION_VERIFIED。
- target FileId 与 source 不同。
- target size/hash 不匹配 ⇒ FAILED_RETAINED。
- DB APPLIED 前不得创建 FileVersion。

## 12. Cleanup 状态机

```text
PUBLISHED
  -> CLEANUP_PENDING
  -> CLEANUP_SESSION_ACQUIRED
  -> CLEANUP_HELPER_STARTED
  -> NAME_REMOVED
  -> HELPER_EXITED
  -> NAME_ABSENCE_VERIFIED
  -> CLEANUP_EVIDENCE_RECORDED
  -> DB_DELETED
```

独立事实：

```text
NAME_REMOVED
NO_UNEXPECTED_LINKS_OBSERVED
BROKER_HANDLES_CLOSED
RECLAMATION_PENDING
OBJECT_RECLAIMED_IF_VERIFIABLE
MEDIA_ERASURE_NOT_GUARANTEED
```

如果无法确认 helper 退出：

```text
UNKNOWN
```

如果 parent/namespace identity 不一致：

```text
FAILED_RETAINED
```

## 13. DELETED 业务语义

推荐唯一语义：

```text
DELETED = Controlled Namespace Removal Completed
```

进入条件：

1. Source object identity 已核验；
2. Parent/namespace identity 已核验；
3. Canonical FileVersion 完整性已核验；
4. Source name 已移除；
5. 删除后名称不存在；
6. 未观察到非预期 hard-link；
7. Cleanup Helper 已退出；
8. Broker 自有相关 handles 已关闭；
9. Evidence 已与 DB 状态同事务持久化；
10. Operation 状态一致。

`DELETED` 明确不表示：

- 所有外部进程句柄关闭；
- 内存映射已解除；
- 文件系统对象立即回收；
- 存储块已释放；
- SSD/虚拟盘数据不可恢复。

若需要物理回收确认，必须新增独立证据，不得复用 `DELETED`。

## 14. Publication Recovery

| 观察 | 允许动作 | 禁止动作 |
|---|---|---|
| Publisher helper 仍运行 | 等待、终止、记录 | 创建 FileVersion |
| Publisher 已退出，target partial | UNKNOWN/人工 | 覆盖 target |
| Target sealed，Sealer 已退出，无 Evidence | 重新只读核验 | 猜测 APPLIED |
| Evidence 已写，DB COMMIT 失败 | 回滚后重新观察 | 删除 canonical |
| DB APPLIED，客户端超时 | 查询并返回已有结果 | 重复 publish |
| 旧 epoch/session 恢复 | 拒绝 | 自动复用旧 token |

## 15. Cleanup Recovery

| 观察 | 允许动作 | 禁止动作 |
|---|---|---|
| Cleanup helper 仍运行 | 等待/受控终止 | DB DELETED |
| Name 已消失，helper 未退出 | UNKNOWN | 重复 unlink |
| Helpers 退出，name absent，target valid | 复核并完成 | 覆盖 canonical |
| Name 存在，但 identity 改变 | FAILED_RETAINED | unlink 新对象 |
| Parent/root identity 改变 | UNKNOWN | 继续删除 |
| DB commit 未知 | 新连接查询 | 内存补写成功 |

## 16. v1/v2 Namespace Drain

```text
storage/private/p13-v1/{staging,objects,quarantine,temp}
storage/private/p13-v2/{staging,objects,quarantine,temp}
```

启用 v2 前：

1. 停止新 v1 authority acquisition；
2. 停止旧 Web/Worker/Broker/Scheduler；
3. 等待旧 Session 结束；
4. 验证旧句柄已关闭；
5. 处理 v1 未完成 Operation；
6. 验证 v1 identity 无 v2 ACL；
7. 验证 v2 Supervisor 无 v1 写权限；
8. 应用 v2 namespace 与 ACL；
9. 记录 Drain evidence；
10. 经人工批准启用。

DB `protocolVersion=2` 不等于物理隔离完成。

回滚不得让 v1 写 v2 namespace；已进入 v2 的数据只能前向修复或保留。

## 17. Platform Capability Matrix

| Capability | Windows Node core | Windows Native | Linux Node core | Linux Native |
|---|---|---|---|---|
| Exclusive create | PARTIAL | SUPPORTED | PARTIAL | SUPPORTED |
| Peer identity auth | NOT SUPPORTED | SUPPORTED | NOT SUPPORTED | SUPPORTED |
| Existing writer handle control | NOT SUPPORTED | PARTIAL | NOT SUPPORTED | PARTIAL |
| New writer denial | NOT SUPPORTED | SUPPORTED | NOT SUPPORTED | SUPPORTED WITH ACL |
| File identity | PARTIAL | SUPPORTED | PARTIAL | SUPPORTED |
| Parent directory identity | PARTIAL | SUPPORTED | PARTIAL | SUPPORTED |
| Directory-relative open | NOT SUPPORTED | SUPPORTED | NOT SUPPORTED | SUPPORTED |
| Reparse/Symlink rejection | PARTIAL | SUPPORTED | PARTIAL | SUPPORTED |
| Handle-bound delete | NOT SUPPORTED | SUPPORTED | NOT SUPPORTED | PARTIAL |
| Same-name replacement resistance | NOT SUPPORTED | SUPPORTED WITH DACL | NOT SUPPORTED | REQUIRES ONE-SHOT AUTHORITY |
| Hard-link count | PARTIAL | SUPPORTED | PARTIAL | SUPPORTED |
| OS identity separation | NOT SUPPORTED | SUPPORTED | NOT SUPPORTED | SUPPORTED |
| Process-tree termination proof | NOT SUPPORTED | SUPPORTED WITH JOB OBJECT | NOT SUPPORTED | REQUIRES CGROUP/PROCESS GROUP |
| Crash recovery | NOT SUPPORTED | PARTIAL | NOT SUPPORTED | PARTIAL |
| Directory durability | NOT SUPPORTED | PARTIAL | PARTIAL | PARTIAL |

## 18. Security Invariants

1. Web/Worker 不拥有 Storage Root 直接写权限。
2. Supervisor 不写 canonical 数据。
3. Publisher Helper 不删除对象。
4. Cleanup Helper 不写 canonical。
5. Helper 不继承 Storage handle。
6. Helper 不写 DB Evidence。
7. Supervisor 只使用绝对固定的 Operation 路径。
8. Capability 绑定 OS identity、operation、generation、action。
9. Broker epoch 变化使旧 capability 失效。
10. Evidence 与 APPLIED/DELETED 同事务。
11. `SEALED` 要求 Publisher/Sealer helper 已退出。
12. `DELETED` 只表示受控 namespace removal。
13. canonical 读取重新验证身份/size/hash。
14. 未知 OS 状态永不自动转成功。
15. v1/v2 namespaces 不发生跨版本写。

## 19. Failure Matrix

| Failure | Result |
|---|---|
| Publisher helper 暂停 | Publish `EXECUTING/UNKNOWN`，不得 APPLIED |
| Publisher helper 崩溃 | 重新观察 partial/sealed target，禁止覆盖 |
| Sealer helper 崩溃 | 保持 UNKNOWN，禁止 FileVersion |
| Cleanup helper 暂停 | Cleanup `EXECUTING/UNKNOWN`，禁止 DELETED |
| Supervisor 崩溃 | Job/cgroup 终止 helper；新 epoch；重新核验 |
| DB lease 过期 | 不转移 OS authority |
| DB commit unknown | 新连接查询 |
| Evidence 缺失 | 不补写 APPLIED |
| target identity 改变 | FAILED_RETAINED |
| root/namespace identity 改变 | UNKNOWN，禁止 cleanup |
| directory fsync 失败 | namespace removal 未确认，不得 DELETED |
| hard-link 异常 | FAILED_RETAINED |
| IPC token 重放 | 返回原 request 状态或拒绝 |
| 旧 epoch token | `EPOCH_STALE` |
| 子进程句柄不确定 | 不进入 SEALED |

## 20. Implementation Prerequisites

- 独立 OS identity/ACL 设计获批；
- Native Helper 构建与签名范围获批；
- 独立 DB Role/Function 设计获批；
- protocol v2 Schema/Trigger/Evidence v2 设计获批；
- v1/v2 Drain Plan 获批；
- 隔离测试目录和一次性 clone 可用；
- Windows NTFS 与 Linux 实机测试计划获批；
- 用户明确授权 R4-S2 独立审查；
- 后续实施阶段单独授权。

## 21. Known Limitations

- 真实 Windows/Linux OS 行为尚未验证。
- TPM/HSM/remote attestation 不在 V1。
- Supervisor/OS 内核被攻陷时，本设计不能证明系统诚实。
- Physical media erasure 不在文件生命周期保证内。
- FileId/dev/ino 只在受限时间/namespace 内作为对象身份。
- 目录持久化因文件系统差异仍为 `PARTIAL`。
- Native Helper、OS 服务身份、ACL 和 protocol v2 尚未实现。

## 22. Status

```text
DESIGN:
COMPLETE FOR INDEPENDENT REVIEW

IMPLEMENTATION:
NOT AUTHORIZED

DATABASE:
NOT AUTHORIZED

STORAGE:
NOT AUTHORIZED

CLEANUP / RECOVERY:
NOT AUTHORIZED
```
