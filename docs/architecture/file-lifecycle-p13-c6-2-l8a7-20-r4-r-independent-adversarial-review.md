# P1-3 C-6.2-L8-A7.20-R4-R Independent OS Authority Adversarial Review

## 1. Executive Summary

```text
A7.20-R4-R:
FAIL
```

R4 的总体方向正确：Broker-only filesystem access、Copy-on-Publish、
独立 OS identity、protocol v2 namespace，以及显式的 target writer session，
都比 R3 更接近可证明的安全模型。

但 R4 仍存在四个冻结阻断问题：

1. Broker IPC 只有“authenticated IPC”概念，没有可执行的 capability、
   replay、restart 和 revocation 协议。
2. Native Broker 返回的 Evidence 由谁写入 DB、Application 是否能篡改，
   尚未形成可信链。
3. `SEALED` 仍主要是 Broker 流程状态；R4 没有完整说明如何撤销 Broker
   自身对 canonical 的写、删除和 ACL 修改能力。
4. `DELETED` 仍被用于表达 namespace 名称移除，但没有区分
   `NO_LINKS_OBSERVED`、其他进程句柄、filesystem 回收和介质擦除。

因此 R4 不能冻结为实施设计，Schema v2 仍被阻断。

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
145

Staged:
0

Deleted:
0
```

本轮只允许新增本审查报告。实现状态文档不得更新。

开始哈希：

```text
FZ:
E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705

ST:
5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586

DBTP:
FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7

Schema:
78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299

next-env.d.ts:
0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC

tsconfig.tsbuildinfo:
21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520

R4 Design:
10B3E19135C6CE1EB65B52EA4B0E991954D90F3882A28A78F37748A461A000C7

R4 Report:
65847B6628E6E7F29BDCC5798821BFC1CF26E2A22BA78AC4DC66FDA0C714F08D
```

## 3. Skills Applied

实际读取并应用：

- `$project-architecture`
- `$security-audit`
- `$file-lifecycle`
- `$testing-and-verification`
- `$prisma-db-safety`

## 4. Documents Reviewed

已核对：

- 根 `AGENTS.md`
- 蓝图 `AGENTS.md`
- A7.19、A7.20、A7.20-R、A7.20-R2、A7.20-R3 报告
- A7.20-R4 Design
- A7.20-R4 Report
- 当前 `ST`
- `FZ`
- `DBTP`
- 当前 Schema、P1-3 Migration 和 Trigger
- 当前 Storage Adapter、Upload Service、Worker Processing
- A7.18 waiver/disposition

仓库中不存在：

- Native Storage Authority Broker
- OS-native helper
- Private Storage Evidence v2
- Protocol v2 Schema
- 独立 Publisher/Cleanup OS 身份配置

## 5. Official API Sources

Windows：

- `CreateFileW`
  <https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew>
- `SetFileInformationByHandle`
  <https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-setfileinformationbyhandle>
- `FILE_DISPOSITION_INFORMATION_EX`
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
- Named Pipe Security
  <https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipe-security-and-access-rights>
- Job Objects
  <https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects>

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
- `unix(7)`
  <https://man7.org/linux/man-pages/man7/unix.7.html>

## 6. R4-R-01: Cleanup 与 DELETED 语义

### A. NAME_REMOVED

可证明的是：

```text
在指定的受验证父目录和受控 namespace 中，
指定名称在观察时刻不存在。
```

不能自动证明 inode、文件内容或存储介质已被回收。

### B. NO_LINKS_OBSERVED

Windows 可从 `FILE_STANDARD_INFO.NumberOfLinks` 观察 link count。
Linux 可从 `fstat().st_nlink` 观察 link count。

但：

- 删除后通常无法从已删除的普通句柄可靠观察 `nlink == 0`；
- hard-link 可在检查前后变化；
- 需要目录写权限隔离才能信任 link-count 观察；
- 不得将一次 `nlink == 1` 视作永久无其他链接。

### C. NO_BROKER_HANDLES

Broker 必须证明：

- 当前 Broker 没有其他重复或继承写句柄；
- 没有 helper 或子进程持有相关句柄；
- 没有第二个 Broker Session；
- 没有异步 write/unlink 请求；
- 没有外部进程句柄。

R4 只描述了目标，没有给出完整证据来源。

### D. RECLAMATION_PENDING

名称已移除但仍有旧句柄、内存映射、AV/Backup 引用或文件系统延迟回收时，
必须保持独立状态，例如：

```text
NAME_REMOVED
NO_LINKS_OBSERVED
RECLAMATION_PENDING
UNKNOWN
```

### E. PHYSICAL_RECLAMATION_CONFIRMED

普通文件 API 不能普遍证明：

- 存储块已释放；
- SSD 物理页已擦除；
- 虚拟磁盘快照副本已清除；
- 数据不可恢复。

### F. 推荐 `DELETED` 业务语义

建议：

```text
DELETED =
  受控 namespace 名称已移除
  ∧ 删除时没有观察到非预期 hard-link
  ∧ 当前受信 Broker Session 不再持有对象句柄
  ∧ 相关 canonical 引用完整性不受影响
```

不包含：

- 物理介质擦除；
- 所有外部 AP/Indexer/Backup 句柄关闭；
- 所有文件系统延迟回收完成。

结论：`PARTIAL`。R4 需要拆分 Cleanup state 和明确规定 `DELETED` 语义。

## 7. R4-R-02: Windows Cleanup

R4 已正确识别：

- `dwShareMode` 不撤销已有句柄；
- `FILE_DISPOSITION_POSIX_SEMANTICS` 允许旧句柄继续访问；
- `FILE_ID_INFO` 用于对象身份；
- `FILE_STANDARD_INFO` 可观察 links/delete 状态；
- `FILE_ATTRIBUTE_TAG_INFO` 可观察 ReparseTag。

仍不足：

1. 没有明确 source 必须以 `DELETE|FILE_READ_ATTRIBUTES`、零共享模式打开。
2. 没有明确已有 AV/Backup/Indexer 或 memory-mapped view 时如何持久记录
   `RECLAMATION_PENDING`。
3. 没有定义 Delete Pending 的可观察字段和恢复表。
4. 没有定义 `STATUS_CANNOT_DELETE` 后的 Operation 状态。
5. 没有证明目录 handle 与 namespace identity 的双向绑定。
6. 没有定义目录 flush 失败是否阻止 Cleanup APPLIED。
7. 没有证明 Broker 自己关闭删除 handle 后仍可读取/验证目标。

推荐修订：

- 打开 source 时使用独占 share mode；
- 记录 FileStandardInfo 的 `NumberOfLinks` 和 `DeletePending`；
- 记录 VolumeSerial + FileId；
- 记录 `SetFileInformationByHandle` 请求和结果；
- 关闭 handle 后通过同一父目录 handle 验证名称；
- `POSIX_SEMANTICS` 只能写入 `NAME_REMOVED`，不能写
  `PHYSICAL_RECLAMATION_CONFIRMED`。

结论：`PARTIAL / NOT VERIFIED`。

## 8. R4-R-03: Linux Cleanup

R4 正确依赖：

- `openat2` 的 `RESOLVE_BENEATH`、`RESOLVE_IN_ROOT`、
  `RESOLVE_NO_SYMLINKS`；
- dirfd；
- `O_EXCL` / `O_NOFOLLOW`；
- dev/ino；
- `unlinkat`；
- directory fsync。

但：

1. `unlinkat(parentfd, name, 0)` 仍是名称删除，不是 inode 删除。
2. 需要独占的目录项修改权限，不能只依赖 Broker 的应用层 Session。
3. 其他进程持有的 source FD 可以令 inode 延迟回收。
4. `nlink` 的竞态需要受控目录 authority。
5. `RESOLVE_BENEATH`/`RESOLVE_IN_ROOT` 不能替代 mount identity 检查。
6. `flock` 是 advisory，旧进程可忽略。
7. `fsync(parentfd)` 失败时，名称变化和持久化状态必须标记 UNKNOWN。

推荐修订：

- 在同一受控目录 authority 下完成身份检查和 unlink；
- 将 source 路径名和 parent directory identity 写入 Evidence；
- 记录 before-check link count；
- 其他写者不能修改 staging parent entry；
- 如果无法证明独占目录 authority，Cleanup 不得 APPLIED。

结论：`PARTIAL`。

## 9. R4-R-04: 旧进程和旧句柄隔离

R4 已规定 Worker 不应直接访问 Storage Root，这是正确方向。

仍需补充：

- 旧 Web/Worker/Broker/Helper/Scheduler 的完整 Inventory；
- 旧进程是否仍继承或复制文件句柄；
- 旧 Service 是否与 Broker 共享 OS identity；
- v1/v2 namespace 的 ACL 是否真正隔离；
- 旧进程的 DB client 是否仍可写 v2 Operation；
- Broker 会话是否在进程暂停时保持，重启时如何失效；
- 确认 process exit 与 handle close 是否分开记录。

当前 v1/v2 只存在设计路径，不存在实际 ACL 或 namespace 验证。

结论：`NOT VERIFIED`。

## 10. R4-R-05: Broker IPC

这是 R4 的核心缺口。

当前只有：

```text
authenticated IPC
```

没有完整定义：

- Windows Named Pipe DACL；
- Windows pipe client token/impersonation；
- Linux Unix Domain Socket 的 `SO_PEERCRED`/SCM_CREDENTIALS；
- caller OS identity 与 PID 的绑定；
- request capability 的签发方；
- 签名或 MAC 方式；
- token 的生命周期和撤销；
- requestId 的持久幂等记录；
- Broker 重启后的旧 token 拒绝；
- old generation 请求重放；
- client timeout 后的结果查询。

最小攻击路径：

1. 旧 Publisher 保留有效旧 session 或伪造 request 字段。
2. Broker 只验证字段表面一致。
3. 旧 Publisher 请求写入已发布 target 或执行 Cleanup。
4. 如果 Broker 未重新绑定当前 DB generation 和 OS identity，则可能执行。

推荐修订：

- Broker 使用受限 Named Pipe DACL / Unix socket ACL；
- 从 OS peer credentials 获取 SID 或 UID/GID；
- Broker 不接受客户端提供身份作为事实；
- 所有操作绑定 sessionId、operationId、generation、storageKey、
  protocolVersion、action、requestId；
- Broker 自身或受信 Authority Service 验证当前 DB lease；
- 每个 requestId 有持久幂等状态；
- Broker 重启后拒绝旧 session，直到 DB/OS 重新核验完成；
- 校验失败统一返回 `AUTHORITY_DENIED` 或 `BUSY`，绝不回退 SAFE。

结论：`FAIL / P1`。

## 11. R4-R-06: Broker 与 Helper

R4 同时出现：

- “Broker 是唯一拥有 Storage Root 文件系统权限的进程”；
- Windows “Job Object 中一次性任务”；
- Linux “一次性 Publication/Cleanup helper”。

这是架构歧义。

若 helper 直接执行 FS：

- helper 是否也拥有 Storage Root 权限；
- helper 的句柄是否可继承；
- supervisor 是否能证明 helper 退出；
- Broker crash 后 helper 是否仍存活；
- generation 是否绑定 helper。

推荐 V1 采用：

```text
单 Broker 进程
  + 只在该进程内部持有 root/parent/file handles
  + 不创建持有 FS 权限的子进程
```

如果必须使用 helper：

- helper 必须没有独立 Storage Root 权限；
- helper 只能执行无句柄的纯计算；
- 文件写入/删除只能在 Broker 内完成；
- 由单独 Supervisor 记录 Job Object/cgroup 终态。

结论：`FAIL / P1 design ambiguity`。

## 12. R4-R-07: Target Sealing 闭环

R4 的 SEALED 条件方向正确，但仍是逻辑声明：

- Broker 是唯一可写者；
- Broker 关闭自己的写句柄；
- Broker 生成 `SEALED` evidence。

如果 Broker 之后仍能以自身权限重新打开 target，则：

```text
Broker close -> SEALED -> Broker reopen -> write
```

是未闭合的循环。

必须新增以下之一：

1. Broker 将 canonical 文件 owner/ACL 移交给只读 Canonical Guardian，
   自身失去写权。
2. Broker 自身运行在无 `WRITE_DAC/WRITE_OWNER/WRITE_DATA/DELETE` 的
   canonical 保护策略下。
3. 专用 Sealer 完成后立即关闭全部写通道，Broker 后续只能读。

`SEALED` 不是 OS 通用状态；它是设计定义的状态，必须附带：

- writer handle closed；
- duplicate/inherited handle 不存在；
- new write opens denied；
- delete/rename denied；
- ACL/Owner 修改 denied；
- broker 自身也被限制；
- parent directory entry 受保护。

结论：`FAIL / P1`。

## 13. R4-R-08: Broker Fencing 与 Recovery

R4 已规定：

- 旧 Session 未释放时新 generation 只得到 BUSY；
- lease 过期不等于 OS session 失效；
- Broker crash 可能留下 DB EXECUTING/UNKNOWN。

仍需补充：

- Broker 崩溃后由谁确认所有句柄关闭；
- Broker 重启后如何读取已存在的 FS 事实；
- 旧 token 是否自动失效；
- 旧 request 是否会被重放；
- 新 Broker 是否必须先查询 DB；
- Evidence 与 DB 不一致时哪一个优先；
- 多个 Recovery Worker 如何互斥。

推荐：Broker 启动必须持有独立 boot epoch；所有旧 token 与新 boot epoch
不兼容；恢复请求在 DB 和 FS 都复核前只能为 UNKNOWN。

结论：`PARTIAL`。

## 14. R4-R-09: Evidence 身份与时间

FileId/dev/ino 只证明机器/namespace 中的某一时段对象身份，不是永久
业务身份。

必须记录：

- volume identity；
- namespace/root identity；
- parent directory identity；
- object identity；
- size/hash；
- observedAt；
- adapter/witness version；
- operation/generation/session；
- protocolVersion；
- evidence type；
- evidence digest。

Evidence 读取后仍必须重新验证 canonical 当前身份、size 和 hash。

`FileId`/`inode` 可能在删除后复用；旧 Evidence 不得单独用于识别新对象。

结论：`PARTIAL`，需要定义 Evidence validity window 和 canonical revalidation。

## 15. R4-R-10: Protocol v1/v2 Namespace

R4 已提出：

```text
storage/private/p13-v1/
storage/private/p13-v2/
```

但尚未给出：

- v2 root 创建前的 ACL 验证；
- v1 旧 Worker drain 证据；
- v1 未完成 Operation 处置；
- v1 Old Handle 是否访问 v2；
- v2 Broker 是否读取 v1；
- rollback 时 v1 是否被禁止访问 v2；
- root/namespace identity 的实际测量。

结论：`PARTIAL / NOT IMPLEMENTED`。

## 16. R01–R24 Attack Matrix

| ID | Attack | R4 Defense | Result |
|---|---|---|---|
| R01 | unlink 后仍有 FD | Broker/old session 规则 | `PARTIAL`；缺 handles/reclamation 状态 |
| R02 | Windows POSIX delete 后旧句柄 | 明确不把 POSIX delete 当物理证明 | `PASS / NOT IMPLEMENTED` |
| R03 | Windows Delete Pending | 设计识别 | `PARTIAL`；缺持久状态 |
| R04 | Memory-mapped view | 未具体定义 | `FAIL / P2` |
| R05 | Hard-link | link count 规划 | `PARTIAL`；缺原子验证 |
| R06 | 同名替换 | 目录 authority | `PARTIAL`；缺 IPC/session 证明 |
| R07 | 父目录替换 | dirfd/FileId | `PARTIAL`；需实机 |
| R08 | Mount/Reparse 替换 | Root identity | `PARTIAL`；缺 mount identity |
| R09 | 旧 Publisher 写句柄 | Broker-only handle | `PASS in design`；未实现 |
| R10 | 旧进程暂停 | Authority session | `PASS in design`；需 Supervisor |
| R11 | 子进程继承句柄 | Job Object/cgroup 规划 | `FAIL / P2`；模型歧义 |
| R12 | Broker 重开 sealed target | 逻辑条件 | `FAIL / P1`；Broker 仍可写 |
| R13 | IPC 伪造身份 | OS peer auth 方向 | `FAIL / P1`；协议未定义 |
| R14 | IPC 重放旧请求 | 未定义 | `FAIL / P1` |
| R15 | Broker 重启旧 Token | 未定义 | `FAIL / P1` |
| R16 | Client timeout | 未定义完整幂等 | `FAIL / P2` |
| R17 | syscall 成功但 DB fail | UNKNOWN 规划 | `PARTIAL` |
| R18 | Evidence 缺失 | fail closed 方向 | `PASS in design`；未实现 |
| R19 | Lease 过期但 Broker 活着 | OS Session 独立 | `PASS in design` |
| R20 | 两个 Recovery Worker | single session | `PARTIAL`；无 IPC fencing |
| R21 | FileId/inode 复用 | revalidate 方向 | `PARTIAL` |
| R22 | v1 旧进程访问 v2 | Physical namespace 方向 | `PARTIAL`；无 ACL |
| R23 | Helper 仍持有句柄 | Process model | `FAIL / P1` |
| R24 | Directory fsync 失败 | Cleanup 应 fail closed | `PARTIAL`；缺状态 |

## 17. Findings

### P1

| ID | Finding |
|---|---|
| `R4R-P1-01` | Broker IPC 缺少完整 peer auth、capability、replay、restart、revocation 协议 |
| `R4R-P1-02` | Evidence 提交者未固定为 Broker；应用可伪造 OS observed facts |
| `R4R-P1-03` | `SEALED` 未定义 Broker 自身永久失去 canonical 写/删/ACL 修改权限 |
| `R4R-P1-04` | Broker/helper 模型不自洽；helper 可能重新引入多点文件句柄 authority |
| `R4R-P1-05` | `DELETED` 语义未区分 NAME_REMOVED、NO_LINKS_OBSERVED、RECLAMATION_PENDING 和物理回收 |

### P2

| ID | Finding |
|---|---|
| `R4R-P2-01` | Windows Delete Pending / memory-map / AV 持有句柄状态未定义 |
| `R4R-P2-02` | Linux unlinkat 的目录 authority 依赖尚未可验证 |
| `R4R-P2-03` | Broker 重启 recovery 与 Evidence 优先级未定义 |
| `R4R-P2-04` | FileId/dev/ino 复用和 Evidence 时间有效性未定义 |
| `R4R-P2-05` | v1/v2 namespace ACL、Drain 和回滚门禁未完成 |
| `R4R-P2-06` | Directory fsync 失败与名称消失后的持久状态未定义 |

### P3

- 官方 API 引用尚需扩展至 Named Pipe、Unix Socket peer credentials 和
  Windows process-token 细节。
- R4 的 Broker/Helper 术语需要统一。

## 18. Recommended Architecture Decisions

### D1 R4 是否足以冻结

```text
NOT APPROVED
```

### D2 R4-A

```text
NOT AUTHORIZED
```

R4-A 只读 capability probe 可以用于解决平台证据缺口，但当前没有新的用户授权，
且应先关闭 Broker IPC 和 DELETED 语义 P1。

### D3 R4-B

```text
NOT AUTHORIZED
```

### D4 Schema v2

```text
NOT AUTHORIZED / BLOCKED
```

### D5 Broker 模型

推荐 V1：

```text
单 Native Broker 进程
```

Broker 自身持有全部 Storage Root 权限和句柄。若需要 helper，helper 只能
执行无文件句柄的计算，不得访问 Storage Root。

### D6 DELETED 语义

推荐：

```text
DELETED =
  NAME_REMOVED
  + NO_UNEXPECTED_LINKS_OBSERVED
  + NO_CURRENT_BROKER_HANDLE
  + canonical integrity unaffected
```

不得宣称：

```text
PHYSICAL_MEDIA_ERASED
DATA_UNRECOVERABLE
ALL_EXTERNAL_HANDLES_CLOSED
```

### D7 Broker 恢复条件

仅允许在：

- Broker/Supervisor 证明旧 Session 已终止；
- 新 Broker boot epoch 与旧请求不同；
- DB generation 与 current operation 重新验证；
- OS root/ns/object identity 重新验证；
- Evidence 足以解释已有 FS 事实；

时进入 Recovery。否则保持 UNKNOWN。

### D8 v2 启用条件

- v2 root 和 ACL 已独立验证；
- v1 Worker/Broker/Scheduler 已排空；
- v1/v2 namespace 互不可写；
- v2 Broker identity 和 evidence signer 已配置；
- Windows/POSIX 实机通过；
- 用户单独授权。

### D9 仅实机可证明

- Windows DACL 与已有句柄；
- Delete Pending 与 memory-map；
- Linux dirfd/unlinkat 的竞态；
- cgroup/Job Object 进程终止；
- Named Pipe / Unix Socket 对端；
- FileId/dev/ino 稳定性；
- directory fsync 语义。

### D10 新 P1

已发现：

```text
R4R-P1-01
R4R-P1-02
R4R-P1-03
R4R-P1-04
R4R-P1-05
```

## 19. File Hashes

| File | Before | After | Result |
|---|---|---|---|
| `FZ` | `E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705` | `E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705` | UNCHANGED |
| `ST` | `5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586` | `5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586` | UNCHANGED |
| `DBTP` | `FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7` | `FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7` | UNCHANGED |
| `prisma/schema.prisma` | `78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299` | `78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299` | UNCHANGED |
| `apps/web/next-env.d.ts` | `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC` | `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC` | UNCHANGED |
| `apps/web/tsconfig.tsbuildinfo` | `21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520` | `21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520` | UNCHANGED |
| R4 Design | `10B3E19135C6CE1EB65B52EA4B0E991954D90F3882A28A78F37748A461A000C7` | `10B3E19135C6CE1EB65B52EA4B0E991954D90F3882A28A78F37748A461A000C7` | UNCHANGED |
| R4 Report | `65847B6628E6E7F29BDCC5798821BFC1CF26E2A22BA78AC4DC66FDA0C714F08D` | `65847B6628E6E7F29BDCC5798821BFC1CF26E2A22BA78AC4DC66FDA0C714F08D` | UNCHANGED |

本审查报告自身哈希在文件冻结后由交付消息报告，不写回文件以避免自引用。

## 20. Git Worktree Before/After

```text
Before:
  Tracked modified: 26
  Untracked:       145
  Staged:            0
  Deleted:           0

After:
  Tracked modified: 26
  Untracked:       146
  Staged:            0
  Deleted:           0
```

唯一新增文件：

```text
docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-r-independent-adversarial-review.md
```

未更新 Implementation Status。

## 21. Final Disposition

```text
A7.20-R4-R:
FAIL

R4 DESIGN FREEZE:
NOT APPROVED

R4-A:
NOT AUTHORIZED

R4-B:
NOT AUTHORIZED

SCHEMA V2:
NOT AUTHORIZED

IMPLEMENTATION:
NOT AUTHORIZED

DATABASE:
NOT AUTHORIZED

STORAGE:
NOT AUTHORIZED

CLEANUP / RECOVERY:
NOT AUTHORIZED

GIT COMMIT:
NOT AUTHORIZED

DEPLOYMENT:
NOT AUTHORIZED
```
