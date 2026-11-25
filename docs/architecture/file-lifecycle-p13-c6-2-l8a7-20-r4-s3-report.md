# P1-3 C-6.2-L8-A7.20-R4-S3 Report

## 1. Executive Summary

```text
A7.20-R4-S3:
PASS WITH WARNINGS
```

R4-S3 完成了 R4-S2 三项 P1 的设计整改：

1. DB-issued one-time Operation Grant，Helper 独立校验。
2. Immutable Signed Helper Release 与固定启动模板。
3. 每请求 IPC identity / proof-of-possession。

原有 P1-2 Evidence 和 P1-5 DELETED 语义未被削弱。

当前状态：

```text
P1-A Independent Operation Grant:
DESIGN CLOSED

P1-B Immutable Signed Helper Release:
DESIGN CLOSED

P1-C Per-request IPC Authentication:
DESIGN CLOSED

INTERNAL CONSISTENCY:
PASS
```

仍不能进入实施。Windows/Linux 原生行为、独立 OS 身份、ACL、Signed
Release、DB Grants 和真实故障注入均未验证。

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
149

Staged:
0

Deleted:
0
```

开始前受保护文件：

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

R4-S2 Review:
1CEE7A3E986F3AB1196109D19D7EC0F6434967390ABC3CD2252728FD7C7B6D36
```

## 3. Skills Applied

实际读取并应用：

- `$project-architecture`
- `$security-audit`
- `$file-lifecycle`
- `$testing-and-verification`
- `$prisma-db-safety`

## 4. Documents Reviewed

- 根与蓝图 `AGENTS.md`
- FZ、ST、DBTP
- A7.18 waiver/disposition
- A7.19、A7.20、A7.20-R、A7.20-R2、A7.20-R3
- A7.20-R4 Design/Report
- A7.20-R4-R Review
- A7.20-R4-S1 Design/Report
- A7.20-R4-S2 Review
- 当前 Prisma Schema、P1-3 Migration、Trigger
- 当前 Storage、Upload、Worker、Capability、AuditLog 和测试源码

## 5. Official API Verification

```text
OFFICIAL API VERIFIED
```

已验证：

| Claim | Source | Result |
|---|---|---|
| Named Pipe DACL controls clients | Microsoft Learn | 显式 DACL 必需 |
| Impersonation obtains client token | Microsoft Learn | 需 RevertToSelf |
| Job Object process tree | Microsoft Learn | 可管理/终止关联进程，但 breakaway/外句柄需约束 |
| File handle share mode | Microsoft Learn | 不撤销已存在句柄 |
| FileDispositionEx POSIX semantics | Microsoft Learn | 名称移除不关闭旧句柄 |
| FileIdInfo | Microsoft Learn | VolumeSerial + FileId 为时点身份 |
| UDS SO_PEERCRED | `unix(7)` | 连接时对端凭据 |
| openat2 flags | man7 | 支持 beneath/root/no-symlink 解析 |
| unlinkat | man7 | 相对目录 FD 的名称操作 |
| flock | man7 | advisory |
| fsync | man7 | 文件 fsync 不保证目录项持久化 |

来源：

- <https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipe-security-and-access-rights>
- <https://learn.microsoft.com/en-us/windows/win32/api/namedpipeapi/nf-namedpipeapi-impersonatenamedpipeclient>
- <https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects>
- <https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew>
- <https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-setfileinformationbyhandle>
- <https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntddk/ns-ntddk-_file_disposition_information_ex>
- <https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_id_info>
- <https://man7.org/linux/man-pages/man7/unix.7.html>
- <https://man7.org/linux/man-pages/man2/openat2.2.html>
- <https://man7.org/linux/man-pages/man2/unlinkat.2.html>
- <https://man7.org/linux/man-pages/man2/flock.2.html>
- <https://man7.org/linux/man-pages/man2/fsync.2.html>

## 6. R4-S2 P1 Remediation Results

### P1-A Independent Operation Grant

```text
DESIGN CLOSED
```

方案：

- 数据库是唯一 Grant issuer；
- Supervisor 只能请求 DB 函数；
- Grant target/action 从 DB Operation/Evidence 派生；
- Helper 使用专用 DB role reserve Grant；
- Grant 绑定 operation、attempt、generation、storageKey、helper type、
  release digest、target identity、action；
- 数据库原子 `UPDATE` reserve；
- Helper effect evidence 与 Supervisor verification evidence 分离；
- APPLIED/DELETED 要求双证据。

优势：

- Supervisor 不能通过参数指定任意 target；
- Helper 不信任 Supervisor 传入路径；
- 同一 Grant 不能并发使用；
- 旧 generation 不能取得新 Grant。

### P1-B Immutable Signed Helper Release

```text
DESIGN CLOSED
```

方案：

- Signed Release manifest；
- executable/dependency digest；
- fixed executable path；
- fixed argument schema；
- environment allowlist；
- fixed working directory；
- no child process；
- Windows Code Integrity/WDAC 或等价；
- Linux read-only release root、固定 loader、fs-verity 可选；
- Grant 绑定 helper release digest；
- revoked release 不能获得新 Grant；
- 每类 Helper 的 DB credential 只由对应 Helper identity 读取，
  Supervisor 不得读取或注入。

### P1-C Per-request IPC Authentication

```text
DESIGN CLOSED
```

方案：

- 连接建立时验证 OS peer；
- Linux `SO_PASSCRED` + SCM_CREDENTIALS + pidfd/start-time；
- Windows pipe token SID + 每连接 HMAC proof-of-possession；
- HMAC 覆盖 payloadDigest、nonce、sequence、session、operation、generation、
  action、storageKey；
- socket/pipe handle 被转发但没有 HMAC key 时不能伪造请求；
- `SCM_RIGHTS` 不用于传递 Storage handle；
- 连接关闭/PID 结束使 Session 失效；
- request nonce/sequence 防重放。

## 7. P1-2 / P1-5 Regression

### P1-2 Evidence

```text
PASS
```

R4-S3 强化为：

- Helper Effect Evidence：由 Helper 受限 DB role 写入；
- Supervisor Verification Evidence：由 Supervisor 受限 DB role 独立写入；
- Operation APPLIED/DELETED 必须同时具备两类 Evidence；
- Evidence binding 加入 grantId、helperType、releaseDigest、brokerEpoch、
  operation/generation/object identity；
- Evidence append-only 和同事务规则保持不变。

限制：

- DB Owner、Supervisor 和 Helper 同时被攻陷仍属于 TCB 失效；
- Evidence 只证明观察时点，canonical 读取仍需重新验证。

### P1-5 DELETED

```text
PASS
```

保持：

```text
DELETED = Controlled Namespace Removal Completed
```

Cleanup Grant 绑定 source object/parent/canonical/operation/generation、
helper release 和 broker epoch。Cleanup Helper 不能删除 canonical。

## 8. Differences from R4-S1

1. Grant 从 Supervisor 内存 capability 变为 DB-issued one-time Grant。
2. Helper 从完全信任 Supervisor 改为独立 DB Grant 校验。
3. Helper Effect 与 Supervisor Verification 变成双证据。
4. Supervisor 不再可任意指定 Helper target。
5. Helper executable/dependency/launch template 成为 Signed Release 的一部分。
6. IPC 从连接级身份增加每请求 proof-of-possession。
7. `SEALED` 不再依赖 Supervisor 自觉只调用只读接口。
8. `DELETED` 语义保持不变，但 Cleanup Grant 增加精确 source binding。

## 9. Internal Consistency Check

```text
Authenticated IPC Peer
  -> Request HMAC / per-message credentials
  -> Supervisor epoch/session
  -> DB Operation
  -> DB-issued one-time Grant
  -> Signed Helper Release verification
  -> Helper OS identity
  -> precise FS operation
  -> Helper Effect Evidence
  -> Supervisor independent verification
  -> DB finalization
```

一致性结果：

```text
INTERNAL CONSISTENCY:
PASS / DESIGN ONLY
```

## 10. Remaining Risks

### P2

- Windows Code Integrity/WDAC deployment not verified.
- Linux read-only release / fs-verity not verified.
- IPC HMAC key lifecycle and crash behavior require implementation tests.
- DB Grant schema and Trigger not yet implemented.
- Helper DB roles and least-privilege grants not implemented.
- Windows Delete Pending / memory-mapped view remain platform-dependent.
- Linux directory fsync and inode reuse remain platform-dependent.
- v1/v2 namespace Drain not executed.

### TCB

- Host Administrator, kernel and DB Owner compromise remain outside V1 proof.
- Supervisor+Helper+DB simultaneous compromise invalidates Evidence trust.

## 11. Design Freeze Recommendation

```text
R4-S4 INDEPENDENT REVIEW:
RECOMMENDED

R4 DESIGN FREEZE:
NOT RECOMMENDED BEFORE R4-S4
```

R4-S3 内部一致，但必须由 R4-S4 对抗审查确认 Grant 独立性和 Release/IPC
防委托机制没有新绕过。

## 12. Git Before / After

```text
Before:
  Tracked modified: 26
  Untracked:       149
  Staged:            0
  Deleted:           0

After:
  Tracked modified: 26
  Untracked:       151
  Staged:            0
  Deleted:           0
```

新增文件仅：

```text
docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s3-authority-remediation-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s3-report.md
```

未更新 Implementation Status。

## 13. File Hashes

```text
R4-S3 Design:
197E37793292CEFB9E60B2F31509F123DCE18F6BFAF2662F58342E4DB6430019
```

本报告自身 SHA-256 在冻结后计算并由交付消息报告，不写回文件。

## 14. Final Result

```text
A7.20-R4-S3:
PASS WITH WARNINGS

P1-A Independent Operation Grant:
DESIGN CLOSED

P1-B Immutable Signed Helper Release:
DESIGN CLOSED

P1-C Per-request IPC Authentication:
DESIGN CLOSED

P1-2 Evidence Regression:
PASS

P1-3 SEALED Regression:
PASS

P1-4 Helper Process Model:
DESIGN CLOSED

P1-5 DELETED Regression:
PASS

NEW P1 FINDINGS:
0

NEW P2 FINDINGS:
8

INTERNAL CONSISTENCY:
PASS

WINDOWS DESIGN:
PASS WITH WARNINGS

LINUX DESIGN:
PASS WITH WARNINGS

R4-S4 INDEPENDENT REVIEW:
RECOMMENDED

R4 DESIGN FREEZE:
NOT RECOMMENDED BEFORE R4-S4

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
