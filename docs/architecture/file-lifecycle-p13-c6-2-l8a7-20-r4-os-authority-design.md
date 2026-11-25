# P1-3 C-6.2-L8-A7.20-R4 OS-Native Filesystem Authority Design

## 1. Executive

本设计重新定义 P1-3 文件写入、Publication、Recovery 和 Staging Cleanup
所依赖的文件系统权限边界。

核心结论：

1. Node.js 文件 API 不能独立提供 `IDENTITY_VERIFIED` 所需的目录句柄、
   文件身份、独占写句柄、句柄绑定删除和旧句柄隔离。
2. 仅依赖 PostgreSQL lease、generation、进程名、Service 名称或应用布尔值，
   不能阻止旧进程继续使用已打开的文件句柄。
3. 推荐建立一个唯一拥有 Private Storage Root 文件系统权限的原生
   Storage Authority Broker。业务 Web/Worker 只能通过受认证的本地 IPC
   请求 Broker 执行受限操作。
4. Target 必须使用 Copy-on-Publish 创建独立 inode，并由 Broker 独占写入、
   关闭、重新验证、封存和记录 Evidence。
5. Staging Cleanup 也必须经过 Broker。旧 Cleanup 请求不能直接调用
   `unlink()`；Broker 必须持有唯一 Cleanup Authority，并在已绑定父目录和
   文件身份的条件下完成删除或 fail closed。
6. Windows 与 POSIX/Linux 分别采用不同的原生 API 实现，不得通过共同抽象
   掩盖平台能力差异。
7. 当前仓库没有 Native Broker、OS 服务身份、目录 ACL、target seal、
   Evidence v2 或 protocol v2 Schema，因此本设计不得描述为已实现。

设计结论：

```text
A7.20-R4:
PASS WITH WARNINGS
```

警告条件是：平台原生能力、独立 OS 身份、目录 ACL、协议 v2 Schema 和
真实故障注入均尚未实施或验证。

## 2. 基线

```text
Repository:
D:\thinkbook\Desktop\jieya

Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

工作树：

```text
Tracked modified: 26
Untracked:       143
Staged:            0
Deleted:           0
```

受保护文件在 R4 开始前的哈希：

```text
file-lifecycle-p13-design-freeze.md
E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705

file-lifecycle-p13-implementation-status.md
EBEF740ABB9606B2CAB74BAB5E2742A4BD6FFB736DA8A12922D5AD8443771137

file-lifecycle-p13-database-behavior-test-plan.md
FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7

prisma/schema.prisma
78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299

apps/web/next-env.d.ts
0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC

apps/web/tsconfig.tsbuildinfo
21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520
```

## 3. 现有实现边界

当前 `LocalPrivateStorage`：

- `writeToStaging()` 使用路径 `open("wx")`。
- `finalize()` 使用 `access -> rename`。
- `openReadStream()` 直接使用路径 `createReadStream()`。
- `readVerifiedObject()` 有较强的路径、dev/ino、大小和哈希复检。
- 没有目录句柄、FileIdInfo、exclusive share mode、handle-bound delete、
  target seal 或 OS authority session。

当前 Upload：

- 未创建 `FileUploadAttempt`、`StorageObjectLifecycle`、
  `StorageObjectOperation`。
- 上传成功后直接创建 FileVersion，与当前 P13 必填字段不兼容。

当前 Schema：

- 没有 `StorageLifecycleEvidence`。
- 没有 protocol v2。
- 没有 `PUBLISH` 或 `STAGING_CLEANUP` Operation。
- 没有 `STAGING_CLEANUP_PENDING`。
- `Attempt COMPLETED` 仍要求 Staging Lifecycle 为 `DELETED`。

当前运行身份：

- 仓库没有独立 Web、Worker、Publisher、Cleanup、Recovery、Broker
  OS 身份配置。
- 没有 Private Storage Root 的正式 ACL 证据。
- 旧 `.next` 和 Worker `dist` 仍存在。

## 4. 官方 API 语义依据

本设计依据以下官方资料：

Windows：

- `CreateFileW`
  <https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew>
- `SetFileInformationByHandle`
  <https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-setfileinformationbyhandle>
- `_FILE_DISPOSITION_INFORMATION_EX`
  <https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntddk/ns-ntddk-_file_disposition_information_ex>
- `FILE_ID_INFO`
  <https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_id_info>
- `FILE_STANDARD_INFO`
  <https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_standard_info>
- `FILE_ATTRIBUTE_TAG_INFO`
  <https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_attribute_tag_info>
- `GetFileInformationByHandleEx`
  <https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-getfileinformationbyhandleex>
- `GetFinalPathNameByHandleW`
  <https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfinalpathnamebyhandlew>
- `FlushFileBuffers`
  <https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers>

Linux：

- `open(2)`
  <https://man7.org/linux/man-pages/man2/open.2.html>
- `openat2(2)`
  <https://man7.org/linux/man-pages/man2/openat2.2.html>
- `unlinkat(2)`
  <https://man7.org/linux/man-pages/man2/unlinkat.2.html>
- `flock(2)`
  <https://man7.org/linux/man-pages/man2/flock.2.html>
- `fsync(2)`
  <https://man7.org/linux/man-pages/man2/fsync.2.html>

关键语义：

1. Windows `dwShareMode` 控制后续打开请求，不能撤销已存在的写句柄。
2. Windows `FILE_SHARE_WRITE` 关闭后，后续写打开可被拒绝；已打开写句柄仍需
   由持有者关闭。
3. `FILE_DISPOSITION_POSIX_SEMANTICS` 可以移除可见名称，但已有句柄仍可继续
   访问数据，直到最后一个句柄关闭。
4. `FILE_ID_INFO` 以 Volume Serial Number + 128-bit File ID 标识同一台机器上
   的文件对象。
5. Linux `openat2()` 的 `RESOLVE_BENEATH`、`RESOLVE_IN_ROOT`、
   `RESOLVE_NO_SYMLINKS` 能约束相对目录解析。
6. `unlinkat(dirfd, name, ...)` 是相对目录 FD 的名称删除，但不是
   “删除 FD 所表示的 inode”的通用接口；如果其他主体能修改同一目录项，
   检查与 unlink 之间仍存在替换竞态。
7. `flock()` 是 advisory lock；不能替代 OS 权限隔离，也不能阻止忽略锁的写。
8. POSIX `fsync(file)` 不自动保证目录项已经落盘；目录持久化需要目录 FS 同步
   或等价机制。

## 5. 目标架构

### 5.1 唯一文件系统责任主体

推荐：

```text
P13 Native Storage Authority Broker
```

Broker 是唯一拥有 `p13-v2` Storage Root 直接文件系统权限的 OS 进程。

业务进程：

```text
Staging Writer
Publication Worker
Recovery Worker
Staging Cleanup Worker
Maintenance Worker
```

只持有：

- 本地 IPC 客户端能力；
- 对应 operation/session 的短期授权；
- 无直接 staging/objects/quarantine 写权限。

### 5.2 Broker 职责

Broker 负责：

- 认证本地 IPC 对端 OS 身份；
- 校验 operation/generation/session；
- 打开并持有 root、父目录和文件句柄；
- 执行 Staging write；
- 执行 Copy-on-Publish；
- 执行 target seal；
- 执行 verified read；
- 执行 handle-bound 或受独占目录保护的 Cleanup；
- 返回结构化 OS evidence；
- 在 lease/session 失效时停止后续系统调用并关闭句柄。

Broker 不负责：

- 业务授权；
- FileVersion 业务规则；
- 项目权限；
- AI 处理；
- 自动决定何时 Purge；
- 伪造 DB 状态。

### 5.3 唯一 Authority Session

每个 `storageKey` 同时最多一个 Broker Authority Session：

```text
sessionId
operationId
generation
protocolVersion
callerOSIdentity
capability
state
heldHandles
leaseDeadline
```

若旧 Session 仍存在，包括调用进程暂停但 IPC 尚未断开的情况，Broker 不得向
新 generation 发放同 key 的破坏性 authority。

新 generation 只有在以下任一条件成立后才能获得 authority：

- 旧 Session 正常释放；
- Broker 确认旧 IPC 对端已终止并关闭所有句柄；
- 受信 supervisor 终止旧进程/进程组且 Broker 观察到会话关闭；
- 人工恢复流程明确终止旧 authority。

DB generation 增加本身不够。

## 6. Target Writer Session

### 6.1 身份与句柄

```text
writerSessionId
publisherProcessId
publisherOSIdentity
targetObjectIdentity
targetParentDirectoryIdentity
targetNamespaceId
targetCreationGeneration
exclusiveCreateEvidence
writerHandleOwnership
writerHandleCloseEvidence
sealRequestId
sealerIdentity
sealResult
sealFailureReason
```

规则：

- Target 由 Broker 创建。
- 写句柄只存在于 Broker。
- Publication Worker 不直接获得 target 写句柄。
- Broker 创建的 target 句柄不可继承。
- Broker 不启动可继承写句柄的子进程。
- Broker 必须拒绝或追踪内部重复句柄。
- 进程暂停时，Session 继续占用 authority。
- 进程崩溃/连接断开时，Broker 关闭该 Session 的所有句柄。
- 无法确认全部写句柄释放时，不得进入 SEALED。

`publisherProcessId` 仅作为诊断属性，不作为安全身份；安全身份使用
OS SID/UID、sessionId、boot identity 和 operation/generation。

### 6.2 防止重复/继承/子进程句柄

Windows：

- `CreateFileW`/原生相对打开时不使用可继承 security attributes；
- 必要时清除 `HANDLE_FLAG_INHERIT`；
- Publisher Helper 不创建子进程；
- Broker 在 Job Object 中运行一次性任务；
- Broker 退出或 Job 被终止时，任务进程组被一起终止。

Linux：

- 使用 close-on-exec FD；
- 不 fork/exec 持有写 FD 的 helper；
- 一次性任务运行在独立 process group/cgroup；
- Broker 仅在任务进程组终止后接受新 generation。

## 7. Target Seal 精确协议

### 7.1 状态

| 状态 | 唯一 Owner | 写权限 | Recovery 接管 | 说明 |
|---|---|---|---|---|
| `ABSENT` | Broker | 无 | 允许在无旧 session 时 claim | target 不存在 |
| `EXCLUSIVELY_CREATED` | Broker | Broker 独占 | 禁止 | `CREATE_NEW` / `O_EXCL` |
| `WRITING` | Broker | Broker 独占 | 禁止 | copy 进行中 |
| `SYNCED` | Broker | Broker 独占 | 禁止 | 数据已 flush |
| `SEAL_REQUESTED` | Broker/Sealer | Broker 仍持写句柄 | 禁止 | ACL/权限移交开始 |
| `WRITER_CLOSED` | Broker | 无写句柄 | 条件性 | 关闭证明已记录 |
| `REOPEN_VERIFIED` | Broker | 只读验证 | 条件性 | FileId/size/hash 复核 |
| `SEALED` | Broker/OS ACL | Broker 也无写权 | 条件性 | 新写打开被拒绝 |
| `PUBLICATION_EVIDENCE_RECORDED` | DB | 无 | 读取 | 证据已持久化 |
| `DB_APPLIED` | DB + Broker | 无 | 重新验证 | canonical 已发布 |

### 7.2 SEALED 必要条件

全部满足才允许：

1. Target 由 Broker 独占创建。
2. Target 是普通文件。
3. Target identity、父目录 identity 已记录。
4. Target 与 source identity 不同。
5. Size 和 SHA-256 匹配 Close Evidence。
6. Broker 写句柄已 `sync` 并关闭。
7. 不存在已知 duplicate/inherited/子进程句柄。
8. Broker 重新打开只读句柄并验证内容。
9. 旧 Publisher/Staging Writer identities 不能新开写句柄。
10. 旧 Publisher/Staging Writer identities 不能修改 ACL、owner 或属性。
11. 旧 Publisher/Staging Writer identities 不能 rename、unlink 或替换 target。
12. 父目录已拒绝普通角色的新增、删除和替换权限。
13. Target Evidence 已记录 seal method 和权限 digest。

任一条件不成立：

```text
PUBLISH -> UNKNOWN / FAILED_RETAINED
Recovery -> 人工处理
DB FileVersion -> 禁止创建
```

### 7.3 Windows 顺序

1. 打开并验证 v2 root directory handle。
2. 通过受验证目录句柄/等价原生相对打开创建 target：
   - `CREATE_NEW`
   - 不允许 Reparse
   - 不设置继承
   - `dwShareMode` 不授予后续写/删除共享。
3. 写入、统计大小、计算 SHA-256。
4. `FlushFileBuffers`。
5. 在写句柄仍独占时设置 seal ACL：
   - 旧 Publisher/Writer SID 拒绝 `FILE_WRITE_DATA`、
     `FILE_APPEND_DATA`、`FILE_WRITE_ATTRIBUTES`、`FILE_WRITE_ACL`、
     `FILE_WRITE_OWNER`、`DELETE`；
   - 目录 ACL 拒绝 `FILE_DELETE_CHILD` 和替换目录项。
6. 关闭 Broker 写句柄。
7. 使用只读句柄重新打开，验证：
   - `FILE_ID_INFO`
   - `FILE_STANDARD_INFO`
   - `FILE_ATTRIBUTE_TAG_INFO`
   - `GetFinalPathNameByHandleW`
   - size/hash
8. 尝试以旧 Publisher 身份打开写句柄，必须被 OS 拒绝；该测试结果只作为
   capability evidence，不得由应用伪造。
9. 记录 Publication Evidence。
10. DB 事务 APPLIED/ACTIVE/FileVersion。

Windows ACL/mode 修改不会撤销已经存在的写句柄，因此步骤 5 的 ACL 必须在
步骤 6 关闭写句柄之前完成，且在步骤 7 后才能进入 SEALED。

### 7.4 Linux 顺序

1. `openat2(rootfd, ".", O_DIRECTORY|O_CLOEXEC, RESOLVE_BENEATH|
   RESOLVE_NO_SYMLINKS)`。
2. 通过目录 FD 和 `O_EXCL` 创建 target，`O_NOFOLLOW|O_CLOEXEC`。
3. 写入并计算 size/hash。
4. `fsync(targetfd)`。
5. 将写权限限制在 Broker session；撤销 Staging Writer/Publisher 目录写权限。
6. 关闭 target 写 FD。
7. 通过目录 FD 重新打开只读 target，验证 dev/ino、普通文件、size/hash。
8. 尝试以非 Broker 身份新增写打开，必须被权限系统拒绝。
9. `fsync(parentfd)`。
10. 记录 Publication Evidence。
11. DB 事务 APPLIED/ACTIVE/FileVersion。

Linux 没有通用“打开共享模式”等价机制，因此必须依靠：

- Broker 是唯一直接文件系统操作者；
- 独立 OS 身份；
- 受控目录 ACL/ownership；
- 可信 process supervisor；
- 不在 helper 中保留写 FD；
- 无法确认旧 authority 时禁止自动接管。

## 8. Publication APPLIED 后保护边界

| 角色 | Canonical 新写打开 | Canonical 写句柄 | ACL/Owner 修改 | Rename/Unlink | 结论 |
|---|---|---|---|---|---|
| Staging Writer | 拒绝 | 不应存在 | 拒绝 | 拒绝 | 无 canonical 权限 |
| Publication Worker | 拒绝 | 不应存在 | 拒绝 | 拒绝 | 仅通过 Broker |
| Cleanup Worker | 拒绝 | 不应存在 | 拒绝 | 拒绝 canonical | 仅 staging |
| Recovery Worker | 拒绝 | 不应存在 | 拒绝 | 拒绝 | 只读 |
| Maintenance Worker | 单独授权 | 单独授权 | 单独授权 | 只能 Operation | 当前禁用 |
| Native Broker | 只读/验证 | 不应保持写句柄 | 受控 seal | 受控 cleanup | 唯一 authority |

不同 Service 名称、不同进程名、不同 Node Worker 名不构成权限隔离。

## 9. Handle-Bound Cleanup

### 9.1 Windows

1. Broker 获取 Cleanup Session。
2. 打开并验证 v2 root directory handle。
3. 通过受验证目录句柄打开 staging 父目录。
4. 验证父目录 FileId/VolumeSerial。
5. 打开 source，要求 `DELETE|FILE_READ_ATTRIBUTES`，拒绝 Reparse。
6. 验证 source FileId/VolumeSerial、size、hash、`NumberOfLinks`。
7. 验证 canonical target 仍属于同一 FileVersion 且内容一致。
8. 使用 `SetFileInformationByHandle` 和 `FILE_DISPOSITION_FLAG_DELETE`；
   只有在没有其他句柄时才可完成物理删除。
9. `FILE_DISPOSITION_POSIX_SEMANTICS` 不作为物理删除证明，因为它允许既有
   句柄在名称移除后继续读写。
10. 关闭删除句柄后，通过同一父目录 handle 确认名称不存在。
11. 记录 Cleanup Evidence。
12. DB APPLIED -> Staging DELETED。

如果 source 的旧写句柄仍存在，Broker 必须得到 sharing violation 并保持
`UNKNOWN`，不得将名称消失描述为物理删除完成。

### 9.2 Linux

1. `openat2` 验证 root，`RESOLVE_BENEATH|RESOLVE_NO_SYMLINKS`。
2. 打开并持有 staging 父目录 FD，验证 dev/ino。
3. `openat` 打开 source，`O_NOFOLLOW|O_CLOEXEC`，验证 dev/ino、size/hash、
   hard-link count。
4. 重新验证 target canonical。
5. 通过 Broker 的独占对象 authority 阻止其他 Broker session 修改同一目录项。
6. `unlinkat(parentfd, name, 0)`。
7. 在同一 parentfd 上确认名称不存在。
8. `fsync(parentfd)`。
9. 记录 Cleanup Evidence。
10. DB APPLIED -> Staging DELETED。

`unlinkat(dirfd, name)` 只绑定目录和名称，不自动绑定此前检查的 inode。
安全证明依赖：

- 独立目录 authority；
- 其他角色没有目录写/删除权限；
- 同一 key 只有一个 Cleanup Session；
- 检查后无其他进程能够替换该目录项。

这些条件无法满足时：

```text
Cleanup -> UNKNOWN / FAILED_RETAINED
不允许自动 APPLIED
```

## 10. OS Cleanup Authority 与 DB Generation

建议形成双层 authority：

```text
DB Operation:
  ownerToken / generation / lease

OS Broker Session:
  sessionId / generation / caller identity / held handles
```

规则：

- DB generation 增加不自动获得 OS authority。
- Broker 必须为同一 storageKey 先取得独占 Session。
- 旧 Session 未释放时，新 generation 只能得到 `AUTHORITY_BUSY`。
- DB lease 过期不终止旧 Broker Session。
- lease 过期只允许 Broker 标记 `STALE` 并停止继续系统调用。
- 旧进程暂停但仍持有旧 Session 时，不自动 Recovery。
- Broker 崩溃会关闭其所有句柄；数据库记录仍可能需要新 Session 重新核验。
- 旧进程恢复后只能通过 Broker 发起新请求；Broker 必须拒绝旧 session/generation。
- Broker 不可接受旧 operationId 的新 unlink，除非 DB Operation 仍为当前、
  session 重新匹配且 FS Evidence 完整。

任何无法确认旧 authority 释放的场景：

```text
Operation = UNKNOWN
Lifecycle = FINALIZING / STAGING_CLEANUP_PENDING
自动 Recovery = 禁止
```

## 11. Protocol v1 / v2 Namespace 隔离

推荐物理命名空间：

```text
storage/private/p13-v1/
  staging/
  objects/
  quarantine/
  temp/

storage/private/p13-v2/
  staging/
  objects/
  quarantine/
  temp/
```

规则：

- v2 对象只允许 v2 Broker 访问。
- v1 Worker 没有 v2 root ACL。
- v2 Worker 默认不处理 v1 未完成上传，只进入只读 Legacy Inventory。
- protocolVersion 必须同时存在于 DB 和 Evidence。
- StorageRoot identity、namespace identity 和对象 identity 独立记录。
- 回滚时关闭 v2 Writer/Publisher/Cleanup，不得让 v1 直接写 v2 namespace。
- 旧 Artifact 即使被外部服务启动，也不得拥有 v2 OS 权限。

DB protocolVersion 只约束 DB 状态，不替代 OS ACL 和物理 namespace 隔离。

## 12. Evidence 设计

### 12.1 Publication Evidence

```text
operationId
generation
protocolVersion
writerSessionId
publisherOSIdentity
targetObjectIdentity
targetParentDirectoryIdentity
targetSealMethod
targetWriterClosedAt
targetExclusiveHandleReleasedAt
targetAclOrModeDigest
targetDeleteProtected
targetSize
targetHash
targetSyncEvidence
canonicalVerificationEvidenceId
adapterVersion
adapterBuildDigest
identityAssuranceLevel
verifiedAt
evidenceDigest
```

### 12.2 Cleanup Evidence

```text
operationId
generation
protocolVersion
cleanupSessionId
cleanupOSIdentity
sourceObjectIdentity
sourceParentDirectoryIdentity
sourceLinkCount
cleanupHandleBound
cleanupObservedState
deleteMethod
deletionResult
postDeleteVerification
canonicalTargetIdentity
canonicalFileVersionId
authorityTransferEvidenceId
adapterVersion
adapterBuildDigest
identityAssuranceLevel
verifiedAt
evidenceDigest
```

### 12.3 证据等级

```text
OS_OBSERVED_FACT
PROCESS_ATTESTATION
DB_RECORDED_FACT
INDEPENDENTLY_VERIFIABLE_EVIDENCE
```

注意：

- Evidence 只证明特定时间点的事实。
- Canonical 读取仍必须重新验证 FileVersion、size、SHA-256 和对象身份。
- `evidenceDigest` 不能替代签名、OS 证明或当前内容复核。
- AuditLog 不能替代可执行状态约束。
- 后续 Schema 必须有 UPDATE/DELETE/TRUNCATE Guard。

## 13. Windows / POSIX 平台矩阵

| Capability | Windows Node core | Windows Native | POSIX Node core | POSIX Native |
|---|---|---|---|---|
| Exclusive create | PARTIAL | SUPPORTED | PARTIAL | SUPPORTED |
| Existing writer handle control | NOT SUPPORTED | PARTIAL | NOT SUPPORTED | PARTIAL |
| New writer open denial | NOT SUPPORTED | SUPPORTED | NOT SUPPORTED | REQUIRES NATIVE HELPER |
| Duplicate/inherited handle handling | NOT SUPPORTED | SUPPORTED WITH BROKER | NOT SUPPORTED | REQUIRES NATIVE HELPER |
| Object identity | PARTIAL | SUPPORTED | PARTIAL | SUPPORTED |
| Parent directory identity | PARTIAL | SUPPORTED | PARTIAL | SUPPORTED |
| No-symlink/no-reparse traversal | PARTIAL | SUPPORTED | PARTIAL | SUPPORTED |
| Directory-relative open | NOT SUPPORTED | SUPPORTED | NOT SUPPORTED | SUPPORTED |
| Handle-bound delete | NOT SUPPORTED | SUPPORTED | NOT SUPPORTED | PARTIAL |
| Same-name replacement resistance | NOT SUPPORTED | SUPPORTED WITH ACL | NOT SUPPORTED | REQUIRES EXCLUSIVE DIRECTORY AUTHORITY |
| Parent-directory replacement resistance | NOT SUPPORTED | SUPPORTED | NOT SUPPORTED | SUPPORTED WITH DIRFD |
| Hard-link handling | PARTIAL | SUPPORTED | PARTIAL | SUPPORTED |
| OS identity isolation | NOT SUPPORTED | SUPPORTED | NOT SUPPORTED | SUPPORTED |
| ACL/permission transfer | NOT SUPPORTED | SUPPORTED | NOT SUPPORTED | REQUIRES NATIVE HELPER |
| Crash recovery | NOT SUPPORTED | PARTIAL / BROKER RECONCILE | NOT SUPPORTED | PARTIAL / BROKER RECONCILE |
| Stale process fencing | NOT SUPPORTED | PARTIAL / BROKER SESSION | NOT SUPPORTED | PARTIAL / BROKER SESSION |
| Post-delete verification | PARTIAL | SUPPORTED WITH HANDLE | PARTIAL | SUPPORTED UNDER DIRECTORY AUTHORITY |
| Directory durability | NOT SUPPORTED | PARTIAL | PARTIAL | PARTIAL / FS DEPENDENT |

状态说明：

- `SUPPORTED` 表示设计存在明确的官方 API 路径，仍须真实实现和测试。
- `PARTIAL` 表示存在 API，但单独使用不足以满足本设计不变量。
- `REQUIRES NATIVE HELPER` 表示 Node core 不足。
- `NOT VERIFIED` 表示当前机器未实测。

## 14. 推荐生产方案

### Windows

- Windows Service `P13 Storage Authority Broker`，独立低权限服务 SID；
- Private Storage Root 只授予 Broker 服务 SID；
- Web、Publisher、Cleanup、Recovery 通过本地命名管道连接 Broker；
- Broker 创建不可继承 target handle，独占 share mode；
- 写完后设置 DACL、关闭写 handle、重新以只读 handle 验证；
- 使用 FileIdInfo/VolumeSerialNumber/FileStandardInfo/ReparseTag 验证；
- Cleanup 使用 DELETE handle + `FileDispositionInfoEx`；
- Broker 由 Job Object 管理一次性请求进程，崩溃时终止整个请求树。

### POSIX / Linux

- 独立 UID Broker；
- Private Storage Root 只可由 Broker 写；
- Broker 使用 openat2/dirfd/O_EXCL/O_NOFOLLOW；
- 一次性 Publication/Cleanup helper 在独立 cgroup/process group；
- Broker 持有 root/parent FD；
- 写/发布/删除只通过 Broker；
- 目录权限/ownership 在阶段转换时由受信管理员/ sealer 更新；
- `flock` 只用于协作序列化，不作为强制安全边界。

## 15. 必须 Fail Closed 的操作

- Target writer session 未关闭。
- Target 写句柄状态不明。
- 无法验证 target 与 source 是不同文件对象。
- Target ACL/mode 无法证明旧 writer 无写权。
- 新写入打开无法被验证为拒绝。
- 父目录或 Storage Root identity 不一致。
- Reparse/Junction/Symlink/未知 reparse tag。
- Hard-link count 异常。
- 旧 Cleanup Session 未释放。
- Cleanup 父目录句柄与 source 检查不一致。
- `unlinkat` 前 target name 可能被替换。
- `ENOENT` 无法与历史证据关联。
- Broker/DB 断连后无法确认操作结果。
- Windows Node core-only、POSIX 无原生目录能力。

## 16. 永远禁止自动 Recovery 的场景

- 旧 Publisher 仍可能持有 target 写句柄。
- Target 处于 partial 或 seal 未完成。
- Publication APPLIED 但 target identity 不再匹配。
- 旧 Cleanup Session 可能仍持有目录/文件删除能力。
- Cleanup 结果 UNKNOWN。
- Storage Root 或 namespace identity 发生变化。
- 旧进程/Service/Scheduler/Watchdog 状态未知。
- 旧 v1 Artifact 可能访问 v2 namespace。

## 17. 后续实施依赖

顺序必须为：

1. 完成本 R4 设计审查并批准 Native Broker 边界。
2. 确定 Windows/POSIX 生产身份和 ACL。
3. 设计 protocolVersion=2 Schema/Trigger。
4. 设计 Evidence v2 Schema 和 append-only Guard。
5. 实现只读 Native Identity Probe。
6. 实现 Native Publication/Seal Helper。
7. 实现 Native Cleanup Helper。
8. 实现 DB/OS authority 协同。
9. 在隔离临时 Storage 做 adversarial fault injection。
10. 在 Windows NTFS 实机和 POSIX/Linux 实机验证。
11. 接入 Upload/Publication/Cleanup。
12. 独立安全复审。

## 18. 当前状态

```text
OS-Native Authority Design:
DESIGN ONLY

Native Storage Authority Broker:
NOT IMPLEMENTED

Windows Native Helper:
NOT IMPLEMENTED

Linux Native Helper:
NOT IMPLEMENTED

Independent OS Identities:
NOT CONFIGURED

Private Storage Root ACL:
NOT VERIFIED

Protocol v2:
NOT IMPLEMENTED

Evidence v2:
NOT IMPLEMENTED

Real File-System Fault Injection:
NOT EXECUTED

Production IDENTITY_VERIFIED:
NOT AUTHORIZED
```
