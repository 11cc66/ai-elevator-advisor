# P1-3 C-6.2-L8-A7.20-R4 OS-Native Filesystem Authority Report

## 1. 最终结论

```text
A7.20-R4 Design:
PASS WITH WARNINGS
```

本阶段完成了 OS-native Filesystem Authority 设计，但没有实施任何源码、
Schema、Migration、Native Helper、ACL、Service Identity 或生产配置。

推荐方向：

```text
Native Storage Authority Broker
+ Copy-on-Publish
+ Independent OS identities
+ protocol v2 physical namespace
+ Target Writer Session
+ Handle-bound Cleanup
```

该方向解决 A7.20-R3 的设计缺口，但只有在 Native Helper、Process Supervisor、
独立 OS Identity、目录 ACL 和真实故障注入均通过后，才能进入生产
`IDENTITY_VERIFIED`。

## 2. Baseline

```text
Repository:
D:\thinkbook\Desktop\jieya

Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

Tracked modified:
26

Untracked:
143

Staged:
0

Deleted:
0
```

受保护文件在 R4 开始前的哈希：

```text
FZ:
E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705

ST:
EBEF740ABB9606B2CAB74BAB5E2742A4BD6FFB736DA8A12922D5AD8443771137

DBTP:
FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7

Schema:
78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299

next-env.d.ts:
0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC

tsconfig.tsbuildinfo:
21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520
```

A7.18 的单文件历史豁免没有扩展到 R4。

## 3. 读取与核实范围

已重新应用：

- `$project-architecture`
- `$file-lifecycle`
- `$security-audit`
- `$testing-and-verification`
- `$prisma-db-safety`

已核对：

- 根与蓝图 `AGENTS.md`
- `FZ`、`ST`、`DBTP`
- A7.19、A7.20、A7.20-R、A7.20-R2、A7.20-R3 报告
- 当前 Schema、P1-3 Migration、Trigger、Index、Constraint
- Storage Lifecycle、Operation、FileVersion、Upload Chain Trigger
- Storage Adapter、Upload Service、Worker Processing、Capability、AuditLog
- 相关测试源码

官方 API 资料：

- Microsoft Learn `CreateFileW`
- Microsoft Learn `SetFileInformationByHandle`
- Microsoft Learn `FILE_DISPOSITION_INFORMATION_EX`
- Microsoft Learn `FILE_ID_INFO`
- Microsoft Learn `FILE_STANDARD_INFO`
- Microsoft Learn `FILE_ATTRIBUTE_TAG_INFO`
- Microsoft Learn `GetFileInformationByHandleEx`
- Microsoft Learn `GetFinalPathNameByHandleW`
- Microsoft Learn `FlushFileBuffers`
- man7.org `open(2)`
- man7.org `openat2(2)`
- man7.org `unlinkat(2)`
- man7.org `flock(2)`
- man7.org `fsync(2)`

关键官方语义：

1. Windows `dwShareMode` 控制后续打开，不能撤销已有写句柄。
2. `FILE_DISPOSITION_POSIX_SEMANTICS` 可以移除名称，但已有句柄仍可访问数据。
3. `FILE_ID_INFO` 使用 volume serial + 128-bit file ID 标识文件。
4. Linux `openat2` 支持 `RESOLVE_BENEATH`、`RESOLVE_IN_ROOT` 和
   `RESOLVE_NO_SYMLINKS`。
5. `unlinkat` 是目录 FD 相对的名称删除，不是通用的 inode 删除。
6. `flock` 是 advisory lock，不能替代强制权限隔离。
7. POSIX 文件 `fsync` 不自动保证目录项持久化。

## 4. 当前实现事实

```text
Native Storage Authority Broker:
NOT FOUND

Independent Publisher/Cleanup OS Identities:
NOT FOUND

Private Storage Root ACL evidence:
NOT FOUND

StorageLifecycleEvidence:
NOT FOUND

protocolVersion v2:
NOT FOUND

PUBLISH / STAGING_CLEANUP Operation:
NOT FOUND

STAGING_CLEANUP_PENDING:
NOT FOUND

Target seal implementation:
NOT FOUND

Handle-bound cleanup:
NOT FOUND
```

当前 `LocalPrivateStorage` 仍是路径式 Node API：

- `writeToStaging()` 使用 `open("wx")`；
- `finalize()` 使用 `access -> rename`；
- `openReadStream()` 直接打开路径；
- `readVerifiedObject()` 有身份复检，但没有 target seal 和 delete handle。

## 5. Publisher 对抗场景

### P01：A 持有写句柄后暂停，B 接管

- DB generation 只能阻止 A 后续数据库提交。
- 若 A 直接持有 target 写句柄，B 不能证明 A 已停止写入。
- Broker 设计中 A 不直接持有 target handle；Broker Session 保持占用，
  B 不能获得同一 storageKey 的 authority。
- 结论：B 不得发布 canonical，必须 `FAIL CLOSED`。

### P02：A 创建 partial target 后暂停，B 继续写

- Partial target 必须保留。
- B 不得继续写同一 target，也不得同名覆盖。
- Publication 状态保持 `UNKNOWN`，等待旧 authority 释放或人工处理。

### P03：A 请求 Seal 前后崩溃

- Seal 前崩溃：target 只能视为 partial/unknown。
- Seal ACL 已设置但写句柄未关闭：不能进入 `SEALED`。
- 写句柄关闭但 Evidence 未记录：不能自动创建 FileVersion。
- 需要 Broker/Supervisor 证据或人工恢复。

### P04：主 Handle 已关闭，但仍有 Duplicate/Inherit Handle

- ACL、只读属性、DACL 和 DB lease 不会撤销旧句柄。
- Publication Worker 不得直接持有 target handle。
- Broker 必须禁用句柄继承，不创建保留写句柄的子进程。
- 无法证明全部写句柄释放时不得 `SEALED`。

### P05：A 在 `SEALED` 后恢复

- A 若仍有旧写句柄，则 Seal 前提不成立。
- A 若使用旧 identity 新开写句柄，必须被 OS ACL 拒绝。
- A 不得具有 target 删除、替换、`WRITE_DAC` 或 `WRITE_OWNER` 权限。
- 只凭应用布尔值不能证明这些条件。

### P06/P07：相同 OS Identity／不同 Service 名称

- 相同 OS Identity 无法形成强隔离。
- 不同 Service 名称但相同 OS Identity 仍共享权限。
- 不同 Node Worker 名称不构成安全边界。
- `IDENTITY_VERIFIED` 需要独立 OS identity 或 Broker-only 文件系统访问。

### P08：APPLIED 后旧 Publisher 重新打开 canonical

- DB generation 不阻止 OS 打开。
- 必须由 DACL/ACL、owner 和 Broker authority 阻止。
- 当前 Node core 没有可证明的实现。

### P09：旧 Publisher 修改 ACL、Owner、属性或目录项

- Seal 必须移除旧角色对 `WRITE_DAC`、`WRITE_OWNER`、
  `FILE_WRITE_ATTRIBUTES`、`DELETE` 和目录替换的权限。
- 当前设计只是要求，尚未实现或验证。

### P10：子进程或异步回调在 APPLIED 后写入

- 不得把写句柄交给可继承子进程。
- 不得保留未 await 的异步 FS 操作。
- Broker 必须在 Session 终止时关闭所有句柄并拒绝旧 Session 请求。

## 6. Cleanup 对抗场景

### C01：身份检查后同名文件替换

`lstat -> unlink(path)` 不能防止同名替换。  
必须由目录 authority、受保护目录项和对象身份复核共同约束。

### C02：父目录被 Symlink/Junction/Reparse Point 替换

- Windows 需要目录 handle、FileIdInfo、ReparseTag 检查。
- Linux 需要 dirfd、openat2 和 no-symlink resolve。
- 不能仅靠 realpath 后再次 open 路径。

### C03：Cleanup A 暂停，B generation 接管，A 恢复

- DB fencing 阻止 A 提交 APPLIED。
- 若 A 仍能直接 unlink，DB fencing 不足。
- Broker 设计中 A 没有直接删除权，且同一 key 只允许一个 OS Session。
- 旧 Session 未释放时 B 禁止接管。

### C04：A 持有旧目录 FD/Handle

- 旧句柄可能继续允许访问旧目录项。
- 必须由 Broker-only FS access 和独占 Session 阻止新 authority。
- 无法撤销旧句柄时不得自动接管。

### C05：源文件存在额外 hard-link

- 必须检查 link count。
- 非预期 hard-link 时 `FAILED_RETAINED`。
- 删除一个名称不等于所有链接或物理数据消失。

### C06：原文件移动后原路径 ENOENT

- `ENOENT` 不能自动转为 Cleanup APPLIED。
- 必须结合父目录身份、先前 Evidence、canonical 状态和 Session 记录。
- 无法确认时保持 UNKNOWN。

### C07：父目录替换但路径字符串相同

- 路径字符串相同不代表目录对象相同。
- 必须比较目录 dev/ino 或 VolumeSerial/FileID。

### C08：unlink 已发出但 DB commit 前崩溃

- Operation 保持 `EXECUTING/UNKNOWN`。
- 新 Broker/新连接必须复核实际 namespace。
- 不得根据内存状态补写 APPLIED。

### C09：删除成功但 post-delete verification 失败

- Cleanup 不能 APPLIED。
- 保持 UNKNOWN/FAILED_RETAINED。
- 不自动二次删除。

### C10：删除结果不确定后重复 Cleanup

- 仅允许同一 Operation 在完整证据下幂等恢复。
- Terminal Operation 不得重开。

### C11：旧 Worker 恢复并执行已排队 unlink

- Broker 必须拒绝旧 Session/generation。
- 旧 Worker 不得直接拥有目录删除权限。
- 无法证明旧请求已失效时禁止自动 Recovery。

### C12：StorageRoot 被 mount/bind mount/reparse 替换

- 每次 authority acquisition 都重新验证 root identity。
- Root identity 变化时停止并保持 UNKNOWN。
- 不自动 Quarantine/Purge。

## 7. Filesystem Authority 矩阵

| 身份 | Direct FS Read | Direct FS Write | Direct Delete | Broker Capability |
|---|---|---|---|---|
| Staging Writer | 无 | 无 | 无 | `staging_write` |
| Publication Worker | 无 | 无 | 无 | `publish` |
| Cleanup Worker | 无 | 无 | 无 | `cleanup` |
| Recovery Worker | 无 | 无 | 无 | `inspect` |
| Maintenance Worker | 无 | 无 | 无 | future maintenance |
| Native Storage Broker | 有 | 有 | 有 | authority owner |

结论：

- 仅命名不同不代表权限不同。
- Worker 不直接挂载或访问 Storage Root。
- Broker 是唯一文件系统责任主体。
- DB lease 过期不能终止已存在的 Broker Handle；Broker 必须主动停止并在
  不能证明结果时返回 UNKNOWN。

## 8. Schema / Evidence 约束缺口

当前 Schema 没有 R4 所需字段。后续需要新增：

```text
protocolVersion
StorageLifecycleEvidence
PUBLISH Operation
STAGING_CLEANUP Operation
STAGING_CLEANUP_PENDING
writerSessionId
publisherOSIdentity
targetObjectIdentity
targetParentDirectoryIdentity
targetSealMethod
targetWriterClosedAt
targetExclusiveHandleReleasedAt
targetAclOrModeDigest
targetDeleteProtected
targetSyncEvidence
cleanupSessionId
cleanupOSIdentity
sourceObjectIdentity
sourceParentDirectoryIdentity
sourceLinkCount
cleanupHandleBound
cleanupObservedState
deleteMethod
postDeleteVerification
authorityTransferEvidenceId
```

数据库可以强制：

- 字段完整性；
- Evidence 类型与 Operation 类型；
- target/source identity 不同；
- Append-only；
- 状态转换；
- close/publication/cleanup 与 Operation、Attempt、FileVersion 关系。

数据库不能强制：

- 写句柄已经关闭；
- 旧 OS Identity 已失去写权；
- Reparse 已被拒绝；
- `unlinkat` 删除的正是已检查 inode；
- 目录 fsync 实际成功。

这些必须由 Native Adapter、Broker 和 OS ACL 证明。

## 9. 平台能力结论

### Windows Node core

`IDENTITY_DEGRADED`：

- 可使用普通 `CreateFile` 语义；
- 不能设置完整 share mode；
- 不能获得可靠 FileIdInfo；
- 不能做 handle-bound delete；
- 不能完整拒绝 Reparse/Junction；
- 不能证明目录项替换竞态。

### Windows Native

目标能力：

- `CreateFileW` + 独占 share mode；
- `GetFileInformationByHandleEx(FileIdInfo)`;
- `FILE_STANDARD_INFO`;
- `FILE_ATTRIBUTE_TAG_INFO`;
- `GetFinalPathNameByHandleW`;
- `SetFileInformationByHandle(FileDispositionInfoEx)`;
- `FlushFileBuffers`;
- 目录 Handle；
- Job Object / Service Identity / DACL。

仍未验证：

- 目录 FlushFileBuffers 的持久化保证；
- Reparse/Junction 全类型识别；
- 旧进程句柄撤销；
- Windows ACL 在目标机器上的实际行为；
- Antivirus 和文件锁干扰。

### Linux Node core

`IDENTITY_DEGRADED`：

- 只能路径式 open/unlink；
- 无 openat2 安全解析；
- 无稳定 handle-bound delete；
- 不能证明目录项和 inode 绑定。

### Linux Native

目标能力：

- `openat2`：
  - `RESOLVE_BENEATH`
  - `RESOLVE_IN_ROOT`
  - `RESOLVE_NO_SYMLINKS`
- dirfd + `O_DIRECTORY`
- `O_PATH`
- `O_EXCL`
- `O_NOFOLLOW`
- dev/ino
- `unlinkat`
- `fsync` file 和 directory
- 独立 UID/GID、ACL
- 一次性 process/cgroup

限制：

- `unlinkat` 仍是名称操作；
- 需要独占目录 authority；
- `flock` 是 advisory；
- 旧 FD 不因 DB lease 失效而关闭；
- 跨平台 POSIX 行为可能不同。

## 10. 推荐架构决策

1. **采用 Native Storage Authority Broker。**
2. **Copy-on-Publish 仍是推荐方案。**
3. **Publication/Cleanup Worker 不直接接触 Storage Root。**
4. **Target 写句柄只存在于 Broker。**
5. **每个 storageKey 同时只允许一个 OS authority session。**
6. **DB generation 与 OS session 双层绑定。**
7. **Windows 使用独占 share mode、FileIdInfo、DACL 和 handle delete。**
8. **Linux 使用 openat2、dirfd、受控目录 ownership 和 unlinkat。**
9. **Node core-only 一律 `IDENTITY_DEGRADED`。**
10. **Protocol v1/v2 使用独立物理 namespace 和独立 OS ACL。**
11. **没有 OS authority 证据时不得自动 Recovery。**
12. **没有完整 seal evidence 时不得创建 FileVersion。**
13. **没有完整 Cleanup evidence 时不得进入 `DELETED`。**

## 11. 后续实施阶段

### R4-A：OS Capability Probe

- 前置：无。
- 范围：只读探测 root、Filesystem、FileId、Reparse、openat2、handle delete。
- 环境：隔离测试目录。
- 禁止：真实业务 Storage、清理。
- 完成：能力报告和 `IDENTITY_*` 分级。

### R4-B：Native Broker 原型

- 前置：R4-A。
- 范围：本地 IPC、OS 身份认证、session、handle 管理。
- 测试：Mock 和临时目录。
- 禁止：生产服务、ACL 修改。
- 完成：无法访问 Storage Root 的 Worker 只能通过 Broker 操作。

### R4-C：Copy-on-Publish

- 前置：R4-B。
- 范围：独立 target、seal、publication evidence。
- 测试：partial target、旧句柄、并发、崩溃。
- 禁止：FileVersion 接入。
- 完成：无 seal evidence 时无法发布。

### R4-D：Cleanup Broker

- 前置：R4-C、publication evidence。
- 范围：handle-bound delete、parent identity、link count。
- 测试：同名替换、父目录替换、ENOENT、旧 generation。
- 禁止：Quarantine/Purge。
- 完成：Cleanup Evidence 完整且不可伪造为名称存在。

### R4-E：Schema v2

- 前置：R4-A 至 D 设计冻结。
- 范围：Operation、State、Evidence、Trigger。
- 测试：一次性 clone。
- 禁止：真实开发库、生产库。
- 完成：静态和 clone 验证通过。

### R4-F：Windows 实机验证

- 前置：Windows Native Helper。
- 环境：隔离 NTFS 测试目录和独立测试身份。
- 禁止：生产 ACL、真实对象。
- 完成：T1-T5、C1-C4 全部有实测证据。

### R4-G：独立安全复审

- 前置：全部上述阶段。
- 范围：源码、Schema、Evidence、OS authority、故障注入。
- 结论：只有无 P1/P2 才可进入实施。

## 12. 未解决及阻断项

### P1

```text
Native Broker:
NOT IMPLEMENTED

Target Seal:
DESIGN ONLY

Old Publisher Handle Isolation:
DESIGN ONLY

Cleanup OS Authority:
DESIGN ONLY

OS Identity / ACL:
NOT CONFIGURED
```

### P2

```text
StorageLifecycleEvidence:
NOT IMPLEMENTED

protocol v2:
NOT IMPLEMENTED

PUBLISH / STAGING_CLEANUP:
NOT IMPLEMENTED

STAGING_CLEANUP_PENDING:
NOT IMPLEMENTED

Append-only Evidence Guard:
NOT IMPLEMENTED

Windows Native Helper:
NOT VERIFIED

Linux Native Helper:
NOT VERIFIED
```

## 13. 最终验收

```text
A7.20-R4 Design:
PASS WITH WARNINGS

Native Broker Architecture:
DESIGN ONLY / RECOMMENDED

Target Sealing:
DESIGN ONLY

Old Publisher Handle Safety:
DESIGN ONLY / NORMAL APP HANDLES PROHIBITED

Publication Fencing:
DESIGN ONLY / BROKER SESSION REQUIRED

Cleanup Identity Binding:
DESIGN ONLY / HANDLE-BOUND OR EXCLUSIVE DIRECTORY AUTHORITY REQUIRED

Filesystem Authority:
DESIGN ONLY / INDEPENDENT OS IDENTITIES REQUIRED

Schema/Evidence Consistency:
NOT IMPLEMENTED

POSIX Node core:
IDENTITY_DEGRADED

POSIX Native:
DESIGN ONLY / NOT VERIFIED

Windows Node core:
IDENTITY_DEGRADED

Windows Native:
DESIGN ONLY / NOT VERIFIED

Database:
NOT CONNECTED

Storage:
NOT ACCESSED

Real Build:
NOT EXECUTED

Real Tests:
NOT EXECUTED

Code Remediation:
NOT AUTHORIZED

Schema/Migration Changes:
NOT AUTHORIZED

Database Operations:
NOT AUTHORIZED

Storage Lifecycle Operations:
NOT AUTHORIZED

Recovery/Cleanup:
NOT AUTHORIZED

Artifact Retirement:
NOT AUTHORIZED

Git Commit:
NOT AUTHORIZED

Deployment:
NOT AUTHORIZED
```

## 14. 交付文档哈希

```text
file-lifecycle-p13-c6-2-l8a7-20-r4-os-authority-design.md
10B3E19135C6CE1EB65B52EA4B0E991954D90F3882A28A78F37748A461A000C7

file-lifecycle-p13-implementation-status.md
5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586
```

Report 自身 SHA-256 在冻结后计算，并由交付消息报告；不把自身哈希写回文件，
避免自引用导致哈希再次变化。
