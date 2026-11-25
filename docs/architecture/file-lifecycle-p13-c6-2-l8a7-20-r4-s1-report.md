# P1-3 C-6.2-L8-A7.20-R4-S1 Report

## 1. Executive Summary

```text
A7.20-R4-S1:
PASS WITH WARNINGS
```

本阶段针对 R4-R 的五项 P1 完成了设计整改：

1. Broker IPC authority 改为 Supervisor 认证连接 + server-side opaque
   capability + DB operation/generation 绑定。
2. Evidence 改为只能由 Authority Supervisor 通过受限 DB role 写入。
3. SEALED 改为 Publisher/Sealer Helper 退出后的 OS authority 移交，
   不再声称普通写句柄关闭即可。
4. V1 进程模型冻结为 Authority Supervisor + 受控一次性 Helper。
5. `DELETED` 明确定义为 Controlled Namespace Removal Completed，
   不表示介质擦除。

设计整改已内部一致，但尚未经过 R4-S2 独立审查、OS Capability Probe、
真实 Windows/Linux 验证或数据库验证。

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
146

Staged:
0

Deleted:
0
```

开始前受保护文件：

| 文件 | SHA-256 |
|---|---|
| FZ | `E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705` |
| ST | `5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586` |
| DBTP | `FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7` |
| `prisma/schema.prisma` | `78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299` |
| `apps/web/next-env.d.ts` | `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC` |
| `apps/web/tsconfig.tsbuildinfo` | `21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520` |
| R4 Design | `10B3E19135C6CE1EB65B52EA4B0E991954D90F3882A28A78F37748A461A000C7` |
| R4 Report | `65847B6628E6E7F29BDCC5798821BFC1CF26E2A22BA78AC4DC66FDA0C714F08D` |
| R4-R Review | `2C73DCD3ED287041E81A71695617171E5AE3D391C4E069954BEF1F2BAE69346B` |

## 3. Skills Applied

实际读取并应用：

- `$project-architecture`
- `$security-audit`
- `$file-lifecycle`
- `$testing-and-verification`
- `$prisma-db-safety`

## 4. Documents Reviewed

- 根 `AGENTS.md`
- 蓝图 `AGENTS.md`
- FZ、ST、DBTP
- A7.18 waiver/disposition
- A7.19、A7.20、A7.20-R、A7.20-R2、A7.20-R3
- A7.20-R4 Design
- A7.20-R4 Report
- A7.20-R4-R Review
- 当前 Prisma Schema、Migration、Trigger
- 当前 Storage、Upload、Worker、Capability 和 AuditLog 源码

## 5. Official API Verification

```text
OFFICIAL API VERIFIED
```

- Windows Named Pipe security DACL：
  <https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipe-security-and-access-rights>
- Windows `ImpersonateNamedPipeClient`：
  <https://learn.microsoft.com/en-us/windows/win32/api/namedpipeapi/nf-namedpipeapi-impersonatenamedpipeclient>
- Windows Job Objects：
  <https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects>
- Windows `CreateFileW`：
  <https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew>
- Windows `SetFileInformationByHandle`：
  <https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-setfileinformationbyhandle>
- `FILE_DISPOSITION_INFORMATION_EX`：
  <https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntddk/ns-ntddk-_file_disposition_information_ex>
- `FILE_ID_INFO`：
  <https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_id_info>
- `FILE_STANDARD_INFO`：
  <https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_standard_info>
- `FILE_ATTRIBUTE_TAG_INFO`：
  <https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_attribute_tag_info>
- `GetFileInformationByHandleEx`：
  <https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-getfileinformationbyhandleex>
- `GetFinalPathNameByHandleW`：
  <https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfinalpathnamebyhandlew>
- `FlushFileBuffers`：
  <https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers>
- Unix Domain Socket `SO_PEERCRED`：
  <https://man7.org/linux/man-pages/man7/unix.7.html>
- Linux `open(2)`：
  <https://man7.org/linux/man-pages/man2/open.2.html>
- Linux `openat2(2)`：
  <https://man7.org/linux/man-pages/man2/openat2.2.html>
- Linux `unlinkat(2)`：
  <https://man7.org/linux/man-pages/man2/unlinkat.2.html>
- Linux `flock(2)`：
  <https://man7.org/linux/man-pages/man2/flock.2.html>
- Linux `fsync(2)`：
  <https://man7.org/linux/man-pages/man2/fsync.2.html>

验证结论：

- Windows Named Pipe 默认 ACL 不能作为生产安全配置。
- Windows share mode 不撤销已有写句柄。
- Windows POSIX delete 不证明其他句柄关闭。
- Linux `SO_PEERCRED` 提供连接时对端凭据，但 PID 不能作为永久身份。
- Linux `unlinkat` 是名称操作，不是 inode handle delete。
- Linux `flock` 是 advisory lock。
- 文件 `fsync` 不自动保证目录项持久化。

## 6. Five P1 Remediation Results

### P1-1 Broker IPC

```text
DESIGN CLOSED
```

整改：

- Named Pipe/UDS peer authentication；
- caller OS identity 来自 OS，不来自客户端字段；
- server-side opaque 256-bit capability；
- capability 绑定 broker epoch、session、operation、generation、storageKey、
  action、requestId；
- publish/cleanup/inspect 能力分离；
- Supervisor 重启后 epoch 变化，旧 capability 全部失效；
- request journal 与 operation 状态实现幂等。

### P1-2 Evidence Trust Chain

```text
DESIGN CLOSED
```

整改：

- Web/Worker 无 Evidence INSERT；
- Supervisor 使用受限 DB role 写入；
- Helper 只返回执行结果，不写 Evidence；
- Supervisor 独立重新验证 target/source；
- Evidence 与 Operation APPLIED/DELETED 同事务；
- sequence + previousEvidenceHash + evidenceDigest；
- append-only、UPDATE/DELETE/TRUNCATE Guard 作为 Schema v2 要求。

限制：

- Supervisor/OS 内核被攻陷时，本地系统不能证明诚实；
- 未引入 TPM/HSM，因为 V1 不声称能证明恶意 Broker 自身。

### P1-3 SEALED

```text
DESIGN CLOSED
```

整改：

- 长期 Supervisor 不直接拥有 canonical 写权限；
- Publisher Helper 一次性写入并退出；
- Sealer Helper 一次性完成 Owner/DACL 或 UID/GID/mode 移交；
- Supervisor 只保留 read/verify；
- 旧 Publisher 身份不能写、删、替换或修改 ACL/Owner；
- Helper 退出后才允许 DB APPLIED；
- 不满足时只能标记 `BROKER_LOGICALLY_SEALED`，不得发布。

### P1-4 Broker / Helper Model

```text
DESIGN CLOSED
```

V1 唯一模型：

```text
长期 Authority Supervisor
+ 单用途一次性 Helper
```

Supervisor：

- IPC；
- DB session/authorization；
- 只读验证；
- 进程监督；
- 不直接写/删 Storage Root。

Helper：

- 单次任务；
- 无 DB 权限；
- 无子进程；
- 不可继承句柄；
- 任务完成或失败后必须退出；
- 退出是 DB APPLIED 的前置条件。

### P1-5 DELETED Semantics

```text
DESIGN CLOSED
```

唯一业务语义：

```text
DELETED = Controlled Namespace Removal Completed
```

不代表：

- 所有外部句柄关闭；
- 内存映射解除；
- 文件系统对象已回收；
- 存储块释放；
- 介质数据不可恢复。

Cleanup Evidence 单独记录：

- `NAME_REMOVED`
- `NO_UNEXPECTED_LINKS_OBSERVED`
- `BROKER_HANDLES_CLOSED`
- `RECLAMATION_PENDING`
- `OBJECT_RECLAIMED_IF_VERIFIABLE`
- `MEDIA_ERASURE_NOT_GUARANTEED`

## 7. P2 Handling

| P2 | 处理 |
|---|---|
| Windows Delete Pending | 记录为 `RECLAMATION_PENDING`，不自动证明物理回收 |
| Memory-mapped View | 保持 UNKNOWN/retained，禁止宣称物理删除 |
| Linux unlinkat namespace | 只在独占目录 authority 和名称缺失证据下进入 DELETED |
| FileId/inode reuse | Evidence 仅在时间窗口及 namespace 内有效，读取时重新验证 |
| v1/v2 drain | 独立 v1/v2 roots、ACL 和 Drain Protocol |
| Broker crash/restart | 新 epoch，旧 token/session 全部失效 |
| Evidence time validity | 记录 observedAt，canonical 读取重新核验 |
| Directory fsync failure | 不进入 DELETED，保持 UNKNOWN |
| syscall/DB 不一致 | 新连接 + OS 复核，不补写成功 |

## 8. Internal Consistency Check

```text
IPC capability -> Broker epoch/session
Broker epoch/session -> DB operation/generation
DB operation -> storageKey/protocol v2 namespace
storageKey -> helper role/path
Helper exit -> OS handles closed
Supervisor verification -> Evidence
Evidence + Operation state -> same DB transaction
SEALED -> Canonical Guardian permission
Cleanup -> exact staging namespace
DELETED -> controlled namespace removal only
v1/v2 namespace -> independent ACL
```

结果：

```text
INTERNAL CONSISTENCY:
PASS / DESIGN ONLY
```

## 9. Unresolved Items

- Native Helper 尚未实现。
- Windows/Linux OS capability 尚未实机验证。
- 独立 OS identities、ACL、Service 配置尚未创建。
- Protocol v2 Schema/Trigger/Evidence v2 尚未实现。
- v1 Drain 尚未执行。
- R4-S2 独立对抗审查尚未进行。

## 10. Design Freeze Recommendation

```text
R4 DESIGN FREEZE:
RECOMMENDED AFTER R4-S2

R4-S2 INDEPENDENT REVIEW:
RECOMMENDED
```

当前设计已对五个 P1 形成内部一致方案，但仍不能直接冻结为实施基线；
必须先通过 R4-S2 的独立对抗审查。

## 11. Next Phase

只建议：

```text
R4-S2 Independent Adversarial Design Review
```

不建议直接进入任何 implementation、OS probe、native helper、Schema v2 或
Storage 操作阶段。

## 12. Git Before / After

```text
Before:
  Tracked modified: 26
  Untracked:       146
  Staged:            0
  Deleted:           0

After:
  Tracked modified: 26
  Untracked:       148
  Staged:            0
  Deleted:           0
```

新增文件仅：

```text
docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s1-p1-remediation-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s1-report.md
```

未更新 Implementation Status。

## 13. File Hashes

```text
R4-S1 Design:
3286A6C53D9D1449BE00D5B441F188490289799B003D4FC3BC7B686E29907F8E
```

本报告 SHA-256 在文档冻结后计算，由交付消息报告，不写回自身。

## 14. Final Result

```text
A7.20-R4-S1:
PASS WITH WARNINGS

P1-1 IPC:
DESIGN CLOSED

P1-2 Evidence:
DESIGN CLOSED

P1-3 SEALED:
DESIGN CLOSED

P1-4 Broker Process Model:
DESIGN CLOSED

P1-5 DELETED Semantics:
DESIGN CLOSED

INTERNAL CONSISTENCY:
PASS

R4 DESIGN FREEZE:
RECOMMENDED AFTER R4-S2

R4-S2 INDEPENDENT REVIEW:
RECOMMENDED

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
