# P1-3 C-6.2-L8-A7.20-R4-S4 Independent Adversarial Review

## 1. Executive Summary

```text
A7.20-R4-S4:
FAIL
```

R4-S3 已显著加强 Authority 架构：

- DB-issued one-time Operation Grant；
- Helper 通过独立 DB role 校验目标；
- Signed Helper Release；
- Helper Effect 与 Supervisor Verification 双证据；
- `DELETED` 仅表示受控 namespace removal。

独立攻击确认：

```text
P1-A Independent Operation Grant: CLOSED
P1-B Immutable Signed Helper Release: CLOSED
P1-C Per-request IPC Authentication: OPEN
P1-2 Evidence Regression: PASS
P1-3 SEALED Regression: PASS
P1-5 DELETED Regression: PASS
```

P1-C 未闭合的关键反例：

> Windows 上每连接 HMAC 只能证明请求方持有 HMAC key，不能证明请求来自最初
> 经过 OS Token 验证的同一进程。已认证客户端一旦将 pipe handle 和 HMAC key
> 同时委托给另一个进程，Supervisor 无法从请求本身证明实际发送进程身份。

因此 R4 DESigin Freeze 仍不能批准。

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
151

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

R4-S3 Design:
197E37793292CEFB9E60B2F31509F123DCE18F6BFAF2662F58342E4DB6430019

R4-S3 Report:
B169817C8FA32CE8AC405E5797E482D379D6BB60334339089804054AE2C258AD
```

A7.18 waiver 未扩展。

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
- R4 Design/Report
- R4-R Review
- R4-S1 Design/Report
- R4-S2 Review
- R4-S3 Design/Report
- 当前 Schema、Migration、Trigger
- Storage、Upload、Worker、Capability、AuditLog 源码和测试

## 5. Official API Verification

官方资料：

- Microsoft Named Pipe Security：
  <https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipe-security-and-access-rights>
- `ImpersonateNamedPipeClient`：
  <https://learn.microsoft.com/en-us/windows/win32/api/namedpipeapi/nf-namedpipeapi-impersonatenamedpipeclient>
- Windows Access Tokens：
  <https://learn.microsoft.com/en-us/windows/win32/secauthz/access-tokens>
- Job Objects：
  <https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects>
- `CreateFileW`：
  <https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew>
- `SetFileInformationByHandle`：
  <https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-setfileinformationbyhandle>
- `FILE_DISPOSITION_INFORMATION_EX`：
  <https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntddk/ns-ntddk-_file_disposition_information_ex>
- `FILE_ID_INFO`：
  <https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_id_info>
- `unix(7)`：
  <https://man7.org/linux/man-pages/man7/unix.7.html>
- `openat2(2)`：
  <https://man7.org/linux/man-pages/man2/openat2.2.html>
- `unlinkat(2)`：
  <https://man7.org/linux/man-pages/man2/unlinkat.2.html>
- `flock(2)`：
  <https://man7.org/linux/man-pages/man2/flock.2.html>
- `fsync(2)`：
  <https://man7.org/linux/man-pages/man2/fsync.2.html>

关键结论：

- Windows Named Pipe 的客户端 SID 可在连接阶段验证。
- `ImpersonateNamedPipeClient` 只提供连接客户端的 impersonation token。
- Job Object 可管理关联进程，但不能自动证明任意复制到其他进程的 handle 已关闭。
- Linux `SO_PEERCRED` 是连接时凭据；`SCM_CREDENTIALS` 可按消息取得发送者凭据。
- HMAC 证明密钥持有，不证明请求来自最初 OS-authenticated process。

## 6. Threat Model

### TCB

R4-S3 明确包含：

- Supervisor process/code；
- Native Helpers；
- OS kernel/filesystem；
- DB server/owner；
- Release Trust Root admin；
- Host administrator。

Web/Worker 是受认证业务客户端，不是自动值得信任的 TCB。

## 7. P1-A Grant Review

```text
CLOSED
```

正向证据：

- Grant 由 DB 签发；
- Supervisor 不能覆盖 target/storageKey；
- Helper 通过独立最小权限 DB role reserve；
- grantId/action/helperType/generation/release digest 绑定；
- unique active Grant + atomic UPDATE；
- Helper Effect Evidence 与 Supervisor Verification Evidence 分离；
- terminal state 不可重入。

需要未来 Schema 实现的约束：

- Grant 表 owner、FK、unique partial index；
- SECURITY DEFINER function 的 owner、`search_path`、EXECUTE 权限；
- Helper DB role 只可执行自己的 grant 函数；
- DB Owner 仍在 TCB 中。

结论：`CLOSED`，但 Schema v2 必须按上述边界实施。

## 8. P1-B Signed Release Review

```text
CLOSED
```

正向证据：

- Signed manifest 覆盖 executable/dependency/config；
- 固定 executable path 和启动模板；
- argument/environment/cwd 白名单；
- Release digest 绑定 Grant；
- Windows Code Integrity/WDAC、Linux read-only root/fs-verity 作为加载期边界；
- Helper DB credential 与 Supervisor 隔离。

限制：

- Code Integrity/WDAC、fs-verity、签名密钥和 Trust Root 尚未验证；
- 需要真实 OS 测试确认验证后无替换窗口。

## 9. P1-C IPC Review

```text
OPEN
```

### Linux

方向正确：

- SO_PASSCRED；
- SCM_CREDENTIALS 每消息；
- pidfd/process start-time；
- refuse SCM_RIGHTS；
- connection close 使 session 失效。

仍有设计问题：

- socket 父目录描述为 Broker-owned `0700`，不同 UID 的 Web/Worker 无法
  traverse，和独立客户端身份冲突；
- PID namespace 映射和 process credentials 的最终规则尚未固定；
- `SCM_CREDENTIALS` 与实际 sendmsg 的绑定需实现测试。

### Windows

R4-S3 使用：

- 连接时 token/SID 验证；
- 每连接 HMAC key；
- process handle/start time。

反例：

1. 已认证 Client A 持有 pipe handle 和 HMAC key。
2. 恶意/被攻陷进程 B 通过共享内存、注入或显式委托取得两者。
3. B 发送合法 HMAC 请求。
4. Supervisor 看到相同 pipe instance、有效 HMAC 和原 session。
5. Supervisor 无法从 Named Pipe 请求中获得 B 的每请求 token。

HMAC 证明“持有密钥”，不证明“当前请求进程仍是 A”。

如果 Web/Worker process compromise 属于攻击模型，则 P1-C 未闭合。

## 10. Supervisor Compromise Review

| 场景 | 结果 |
|---|---|
| Logic bug | DB Grant 限制 target，不能任意指定路径 |
| Process memory compromise | 可盗取 active IPC/HMAC；不能直接伪造 Helper DB Effect |
| OS identity compromise | 可启动固定 Helper；受 DB Grant/Release/FS ACL 限制 |
| DB credential compromise | 可调用允许函数，但 target 由 DB 决定；DB Owner 仍为 TCB |
| Executable replacement | Signed Release/Code Integrity |
| Host admin | 超出防护范围 |

Supervisor TCB 模型：

```text
ACCEPTABLE FOR V1 IF EXPLICITLY ACCEPTED
```

但 P1-C 的 Windows process-delegation 问题仍独立存在。

## 11. P1-2 Evidence Regression

```text
PASS
```

双证据设计没有退化：

- Helper Effect 由 Helper DB role 写入；
- Supervisor Verification 独立写入；
- Terminal state 需要两者匹配；
- Evidence 绑定 Grant/Release/Epoch/Operation/object identity；
- append-only 仍为 Schema v2 要求。

## 12. P1-3 SEALED Regression

```text
PASS / DESIGN
```

- Publisher 和 Sealer Helper 均使用 Grant；
- Sealer 只能操作 Grant 绑定的 canonical target；
- Publisher/Sealer 退出后才允许 APPLIED；
- Supervisor 只有 read/verify；
- Canonical Guardian 权限移交保留。

真实 DACL/UID/GID 移交和进程退出证明仍 `REQUIRES FUTURE ISOLATED OS VALIDATION`。

## 13. P1-4 Helper Process Model Regression

```text
OPEN
```

问题不在 Helper 权限矩阵本身，而在 IPC 身份可被合法 capability 委托：

- Helper 的 DB Grant 独立；
- Helper 的 Release 固定；
- 但入口请求可能在 Windows 上被另一进程借用 pipe+HMAC；
- 旧 process/session 和 delegated process 无法由 Named Pipe 请求本身区分。

因此 P1-4 的进程生命周期边界尚未完全闭合。

## 14. P1-5 DELETED Regression

```text
PASS
```

保持：

```text
DELETED = Controlled Namespace Removal Completed
```

Cleanup Grant 绑定 source/parent/namespace/canonical/operation/generation、
Release、epoch 和 request。DELETED 不声称物理介质擦除。

## 15. Crash / Recovery Matrix

| 场景 | 结果 |
|---|---|
| Grant issued，Supervisor crash | 旧 epoch Grant revoked/UNKNOWN |
| Grant reserve，DB response lost | Helper 查询同一 Grant |
| 两个 Helper 同时 reserve | 仅一个成功 |
| Helper reserve 后暂停 | Grant RESERVED，禁止新 authority |
| Supervisor restart | 新 epoch，旧 Session/HMAC 失效 |
| 旧 Helper 仍存活 | AUTHORITY_BUSY，禁止新破坏性 Helper |
| syscall 完成，Helper crash | Supervisor 重新观测；不得自动 APPLIED |
| Evidence 已写，DB fail | rollback/reobserve |
| DB commit unknown | 新连接查询 |
| Release revoked | 新 Grant 拒绝；运行中 Helper 终止或 UNKNOWN |
| IPC handle delegated | Linux credentials/pidfd 可识别；Windows HMAC 不足 |
| PID reuse | pidfd/start time；Windows process handle |

## 16. New P1 Findings

### R4S4-P1-01: Windows IPC process delegation

```text
Severity: P1
Affected: R4-S3 §12, §13, P1-C
```

攻击者：

- 已认证 Web/Worker 进程；
- 可复制 pipe handle 或取得进程共享凭据。

前提：

- 攻击者取得 HMAC key 或合法客户端主动代理请求。

攻击：

1. Client A 建立并认证 Named Pipe。
2. B 获得同一 pipe handle + HMAC key。
3. B 发送经过认证的 publish/cleanup 请求。
4. Supervisor 只看到连接、HMAC 和 session，无法证明 B 是 A。

影响：

- 请求身份可被委托到非原先认证进程；
- 若客户端角色拥有 grant 请求能力，可造成越权请求或伪造审计来源。

当前防御：

- connection token SID；
- pipe instance process handle；
- HMAC。

不足：

- HMAC 是 bearer capability，不是 process identity proof；
- Named Pipe 请求没有 per-message OS token；
- process handle/start time 只绑定连接，不绑定实际发送者。

最小修复：

- 使用 Windows ALPC/LPC 等具备每消息安全上下文的 IPC；或
- 使用不可导出的进程绑定密钥/Tpm-backed attestation；
- 或将已认证客户端进程被攻陷/主动委托明确列入 TCB，并禁止声称
  “per-request process identity”。

验收：

- 另一进程获得 pipe handle+HMAC 后请求必须被拒绝；
- 同 UID/SID 的不同进程不能共享 session；
- 旧连接在 client process exit 后立即失效。

## 17. New P2 Findings

| ID | Finding |
|---|---|
| `R4S4-P2-01` | Linux socket 父目录 `0700` 与不同 UID 客户端连接不一致 |
| `R4S4-P2-02` | Named Pipe DACL 未明确 FILE_CREATE_PIPE_INSTANCE、DELETE 等精确 rights |
| `R4S4-P2-03` | Grant SECURITY DEFINER 函数 owner/search_path/EXECUTE 规则尚未落为 SQL 草案 |
| `R4S4-P2-04` | HMAC key handshake、rotation、memory protection 和 crash cleanup 未定义 |
| `R4S4-P2-05` | Windows Code Integrity/WDAC 与 Linux fs-verity/read-only release 未验证 |
| `R4S4-P2-06` | Helper DB credential provisioning/rotation 未实现 |
| `R4S4-P2-07` | Delete Pending、memory-map、directory fsync、inode reuse 仍平台未验证 |
| `R4S4-P2-08` | v1/v2 namespace Drain 尚无实际 ACL/process evidence |

## 18. Internal Consistency

```text
IPC Peer
  -> Capability
  -> DB Operation
  -> DB Grant
  -> Signed Helper
  -> Helper OS Identity
  -> Effect Evidence
  -> Supervisor Verification
  -> DB Finalization
```

链路在 Linux 设计上基本闭合；Windows 的 IPC Peer→实际请求进程边仍断开。

```text
INTERNAL CONSISTENCY:
FAIL
```

## 19. Windows Design Verdict

```text
FAIL
```

原因：

- HMAC bearer 不足以证明实际发送进程；
- pipe handle 与 HMAC key 可被同一受信客户端委托；
- IPC session 的生命周期和实际请求进程之间没有 OS 强制绑定。

## 20. Linux Design Verdict

```text
PASS WITH WARNINGS
```

原因：

- 每消息 SCM_CREDENTIALS + pidfd 方向正确；
- 但 socket 目录 0700 与独立客户端 UID/GID 连接相冲突；
- namespace/PID mapping 仍需真实环境验证。

## 21. Required Remediation

1. 重新设计 Windows per-request IPC，使请求与真实发送进程绑定：
   - ALPC/每消息安全上下文；或
   - 非导出、进程绑定、OS-attested key。
2. 明确 HMAC key 握手、内存保护、轮换、session 失效和进程退出清理。
3. 修复 Linux socket parent directory 与客户端组权限矛盾。
4. 明确 Named Pipe DACL 的精确 access rights。
5. 在 Schema v2 前提交 Grant SECURITY DEFINER 函数的 owner、
   `search_path`、EXECUTE 和角色隔离草案。
6. 完成 Helper Release、Code Integrity/WDAC、fs-verity、DB credential
   和 v1/v2 Drain 的后续验证计划。

## 22. R4 Design Freeze Recommendation

```text
R4 DESIGN FREEZE:
NOT APPROVED
```

## 23. Authorization Status

```text
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

## 24. Git Before / After

```text
Before:
  Tracked modified: 26
  Untracked:       151
  Staged:            0
  Deleted:           0

After:
  Tracked modified: 26
  Untracked:       152
  Staged:            0
  Deleted:           0
```

唯一新增文件：

```text
docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s4-independent-adversarial-review.md
```

## 25. Final Result

```text
A7.20-R4-S4:
FAIL

P1-A Independent Operation Grant:
CLOSED

P1-B Immutable Signed Helper Release:
CLOSED

P1-C Per-request IPC Authentication:
OPEN

SUPERVISOR TCB MODEL:
ACCEPTABLE WITH LIMITATIONS / NOT VERIFIED

P1-2 Evidence Regression:
PASS

P1-3 SEALED Regression:
PASS

P1-4 Helper Process Model:
OPEN

P1-5 DELETED Regression:
PASS

NEW P1 FINDINGS:
1

NEW P2 FINDINGS:
8

INTERNAL CONSISTENCY:
FAIL

WINDOWS DESIGN:
FAIL

LINUX DESIGN:
PASS WITH WARNINGS

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
