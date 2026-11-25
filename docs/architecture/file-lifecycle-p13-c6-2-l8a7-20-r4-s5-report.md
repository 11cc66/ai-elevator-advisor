# P1-3 C-6.2-L8-A7.20-R4-S5 Report

## 1. Executive Summary

```text
A7.20-R4-S5:
PASS WITH WARNINGS

R4S4-P1-C Per-request IPC Authentication:
DESIGN CLOSED

R4S4-P1-4 Helper Process Model:
DESIGN CLOSED

Windows V1 platform scope:
WINDOWS-ONLY

Linux:
OUT OF SCOPE / NOT IMPLEMENTED / NOT VERIFIED

Windows real-machine validation:
NOT EXECUTED / NOT VERIFIED
```

本轮针对 A7.20-R4-S4 的 Windows 失败完成设计整改。最终 IPC 方案改为
Windows RPC over `ncalrpc`，在使用受控 RPC authentication、interface
security descriptor 和 security callback 的基础上，每次调用读取
`RPC_CALL_ATTRIBUTES_V2.ClientPID`，并绑定 Token/SID、进程创建时间和持有的
process handle。

旧的 Named Pipe + HMAC 不再被当作实际发送进程身份。HMAC 证明 key 持有，
不能证明后续请求来自原 OS 认证进程，因此不进入 Windows V1 identity chain。

本轮只新增两份文档。未修改任何源码、测试、Schema、Migration、配置或历史
报告；未连接数据库、未访问 Storage、未执行 Build/Test/Scanner、未执行 Git
写操作。

## 2. Baseline

```text
Repository: D:\thinkbook\Desktop\jieya
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 26
Untracked files: 152
Staged: 0
Deleted: 0
```

开始前受保护文件：

| 文件 | SHA-256 |
|---|---|
| `docs/architecture/file-lifecycle-p13-design-freeze.md` | `E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705` |
| `docs/architecture/file-lifecycle-p13-implementation-status.md` | `5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586` |
| `docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md` | `FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7` |
| `prisma/schema.prisma` | `78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299` |
| `apps/web/next-env.d.ts` | `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC` |
| `apps/web/tsconfig.tsbuildinfo` | `21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520` |

开始前两份 R4-S5 目标文件均不存在：

```text
docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s5-windows-only-ipc-authority-remediation-design.md
docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s5-report.md
```

A7.18 单文件、单次历史缓存豁免没有扩展，也不适用于本阶段任何文件。

## 3. Skills Applied

实际读取并应用：

| Skill | 本轮实际作用 |
|---|---|
| `$project-architecture` | 确认 Windows-only 边界、Supervisor/Helper/Web/Worker 所有权、RPC 和 SCM 是否改变已确认模块边界 |
| `$prisma-db-safety` | 约束 DB-issued Grant、独立 login role、`SECURITY DEFINER`、search_path、原子 reserve 和事务边界 |
| `$security-audit` | 建立 per-call process identity、handle delegation、PID reuse、credential delegation 和 20 条攻击路径 |
| `$testing-and-verification` | 设计真实 Windows/DB/Storage 的后续隔离验证矩阵并明确未执行 |
| `$file-lifecycle` | 保持 Staging/canonical、Operation、Evidence、SEALED、DELETED、Cleanup/Recovery 语义 |

同时完整读取了根/蓝图 `AGENTS.md`、FZ、ST、DBTP、R4-S1 至 R4-S4 原文件、
R4-S5 授权文件、当前 Schema、Migration、Storage/Upload/Worker/Capability
实现和测试清单。

## 4. Historical Evidence

| 历史文件 | 本轮核验 SHA-256 |
|---|---|
| R4-S1 Design | `3286A6C53D9D1449BE00D5B441F188490289799B003D4FC3BC7B686E29907F8E` |
| R4-S1 Report | `A9DAC3709AA74F671484536FEDF2DF06E8E9BA7BFED8D7ACF29965FFEDFD3444` |
| R4-S2 Review | `1CEE7A3E986F3AB1196109D19D7EC0F6434967390ABC3CD2252728FD7C7B6D36` |
| R4-S3 Design | `197E37793292CEFB9E60B2F31509F123DCE18F6BFAF2662F58342E4DB6430019` |
| R4-S3 Report | `B169817C8FA32CE8AC405E5797E482D379D6BB60334339089804054AE2C258AD` |
| R4-S4 Review | `C43D33F6FF95EE66AEE6238BEB171FF78DB5E1667D1CD52F7092ED6718F92C8E` |

R4-S4 的核心失败被原样保留：

```text
Named Pipe 连接建立时认证 Client A
+ 后续请求使用同一连接/HMAC key
!= 后续请求一定由 Client A 发出
```

因此本轮没有把 HMAC 加长、key 放 TPM、增加 nonce/timestamp 或提高 replay
cache 当作修复。修复点是取得每次 RPC 调用实际发送进程的 OS/RPC 身份。

## 5. Official Source Verification

查询日期：`2026-11-19`。仅使用 Microsoft Learn 官方资料。

| Source | 已验证语义 | 设计结论 |
|---|---|---|
| [Security (RPC)](https://learn.microsoft.com/en-us/windows/win32/rpc/security) | authenticated RPC 可确认调用来自授权客户端 | 不依赖应用层 bearer |
| [ncalrpc](https://learn.microsoft.com/en-us/windows/win32/rpc/protocol-sequence-constants) | local procedure call；只支持 `RPC_C_AUTHN_WINNT` | Windows 本机 RPC 选择 |
| [Authentication levels](https://learn.microsoft.com/en-us/windows/win32/rpc/authentication-level-constants) | `ncalrpc` 始终使用 `PKT_PRIVACY` | 不把未认证本地调用当成等价 |
| [`RpcServerRegisterIf3`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdce/nf-rpcdce-rpcserverregisterif3) | 支持 `IfCallback` 和 interface Security Descriptor | dispatch 前强制 ACL/callback |
| [`RPC_IF_CALLBACK_FN`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdce/nc-rpcdce-rpc_if_callback_fn) | callback 收到 client binding，可获取 client 信息；非 OK 拒绝 | 每调用身份 gate |
| [`RPC_CALL_ATTRIBUTES_V2_W`](https://learn.microsoft.com/en-us/windows/win32/api/rpcasync/ns-rpcasync-rpc_call_attributes_v2_w) | `RPC_QUERY_CLIENT_PID` 可按次取得 `ClientPID`；仅支持 `ncalrpc` | 每调用实际发送 PID |
| [`RpcServerInqCallAttributesW`](https://learn.microsoft.com/en-us/windows/win32/api/rpcasync/nf-rpcasync-rpcserverinqcallattributesw) | 查询当前 call attributes | 不使用 payload/PID 自报 |
| [`I_RpcBindingInqLocalClientPID`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdcep/nf-rpcdcep-i_rpcbindinginqlocalclientpid) | 旧 API，官方建议改用 `RpcServerInqCallAttributes` | 禁止依赖旧接口 |
| [`RpcGetAuthorizationContextForClient`](https://learn.microsoft.com/en-us/windows/win32/api/rpcasync/nf-rpcasync-rpcgetauthorizationcontextforclient) | 返回 RPC client Authz context，支持 ncalrpc | Token/SID/Authz 验证 |
| [`RpcServerRegisterAuthInfo`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdce/nf-rpcdce-rpcserverregisterauthinfo) | 注册 server authentication service | 固定 WINNT auth |
| [Access Tokens](https://learn.microsoft.com/en-us/windows/win32/secauthz/access-tokens) | Token 含 user/group/logon SID 与 privileges | 进程身份依据 |
| [`OpenProcess`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-openprocess) | 打开进程需申请并满足访问权限 | 查询/同步句柄 |
| [`GetProcessTimes`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes) | 可取得 process creation time | PID reuse 防护 |
| [`GetTokenInformation`](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-gettokeninformation) | 可读取 user/groups/integrity/session 等信息 | Token/SID 验证 |
| [Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects) | 管理进程组/树，association 不可随意解除 | Helper/进程树约束 |
| [`AssignProcessToJobObject`](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-assignprocesstojobobject) | 关联进程到 Job | Helper 自加入受限 Job |
| [`IsProcessInJob`](https://learn.microsoft.com/en-us/windows/win32/api/jobapi/nf-jobapi-isprocessinjob) | 查询进程与 Job 的 association | Server 验证 Helper Job |
| [`SetProcessMitigationPolicy`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-setprocessmitigationpolicy) | 设置进程 mitigation | child-process policy 待实机验证 |
| [Service Control Manager](https://learn.microsoft.com/en-us/windows/win32/services/service-control-manager) | SCM 按需启动固定服务 | 不任意启动 executable |
| [Service Security and Access Rights](https://learn.microsoft.com/en-us/windows/win32/services/service-security-and-access-rights) | SCM/service object 有独立访问权限 | Supervisor 仅 start/query/stop |
| [WDAC](https://learn.microsoft.com/en-us/windows/security/application-security/application-control/windows-defender-application-control/wdac) | 应用控制限制可执行代码 | Signed Release 加载期边界，未验证 |

### 5.1 选型结论

选定：

```text
ncalrpc RPC
+ RPC authentication
+ interface SD + security callback
+ V2 call attributes ClientPID
+ process handle + creation time + Token/SID + Authz principal
+ session/epoch binding
```

淘汰：

- Named Pipe + connection token + per-message HMAC；
- Named Pipe + connection PID 查询；
- 直接 native ALPC（公开支持/维护边界过宽）；
- COM local server（没有新增必要身份保证）；
- Windows AF_UNIX、shared memory、TPM-bound HMAC；
- loopback TCP/TLS 与 remote RPC。

## 6. Completed Design Work

完整设计位于：

`docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s5-windows-only-ipc-authority-remediation-design.md`

设计 SHA-256：

```text
8A83D4FD13ED92FEF3C51E902096D08D9B15925F35F8DB9BB238B6E308336B1C
```

主要新增/修订内容：

1. Windows-only V1 平台边界；
2. R4-S4 per-request identity 根因；
3. 10 个 IPC 候选比较矩阵；
4. `ncalrpc` 选择和 Named Pipe/HMAC 淘汰理由；
5. 每请求 OS 身份算法；
6. Session/process handle/PID reuse 绑定；
7. Supervisor/Helper/SCM/Job Object 进程模型；
8. 独立 service SID、Storage ACL 和 DB role；
9. DB Grant 签发/reserve/consume 与 `SECURITY DEFINER` 规则；
10. Signed Release 和 WDAC/Code Integrity 边界；
11. Helper Effect + Supervisor Verification 双证据；
12. SEALED/DELETED 回归；
13. IPC、Publication、Cleanup 状态机；
14. Recovery/UNKNOWN 规则；
15. TCB 表；
16. 20 条攻击路径；
17. 8 个 P2 处置；
18. Windows 实机验证计划；
19. Linux 退出 V1 的条件；
20. 两轮整体自审。

## 7. P1 Status

| 项 | 状态 | 设计依据 |
|---|---|---|
| R4S4-P1-C Per-request IPC Authentication | `DESIGN CLOSED` | 每次 `ncalrpc` 调用由 RPC runtime 返回 `ClientPID`；进程 handle、creation time、Token/SID、Authz principal 和 Session 绑定；HMAC 退出身份链 |
| R4S4-P1-4 Helper Process Model | `DESIGN CLOSED` | SCM 固定服务、独立 service SID/DB role、Grant、Signed Release、单活动进程 Job、无任意 path/binary/child |
| R4S4-P1-A Independent Operation Grant | `PASS / DESIGN` | DB issuer、Helper 原子 reserve、target 从 DB 派生；IPC 不替代 Grant |
| R4S4-P1-B Signed Helper Release | `PASS / DESIGN` | fixed service/path/args/env/cwd、manifest digest、WDAC/ACL 计划保留 |
| R4S4-P1-2 Evidence | `PASS / DESIGN` | 双证据和 operation finalization 未降级 |
| R4S4-P1-3 SEALED | `PASS / DESIGN` | Publisher/Sealer exit、DACL、Supervisor read-only、双证据仍保留 |
| R4S4-P1-5 DELETED | `PASS / DESIGN` | 仍严格定义为 Controlled Namespace Removal Completed |

`DESIGN CLOSED` 不是实现或实机 PASS。目标 Windows API 的行为、RPC ACL、Token/
process DACL、SCM、Job、WDAC 和 NTFS 仍需后续隔离主机验证。

## 8. Per-request Identity Result

每条请求必须同时满足：

```text
RPC request is ncalrpc
+ RPC authentication is WINNT
+ effective authentication level is PKT_PRIVACY
+ call is local and not null/kernel
+ ClientPID is present
+ current process handle maps to registered process identity
+ creation time matches registered Session
+ token User SID / allowed service SID / integrity / Windows session match
+ RPC principal matches expected client class
+ held process handle is not signaled
+ Supervisor epoch and request sequence valid
+ DB Operation/Grant/Generation/Action valid
```

其中 IPC 身份和 Operation Grant 不能相互替代：

```text
Authenticated process != authorized file operation
Valid Operation Grant != matching sender process
```

## 9. P2 Matrix

| ID | Windows V1 适用 | 本轮状态 | 剩余证据 |
|---|---|---|---|
| R4S4-P2-01 Linux socket directory | 否 | `OUT OF SCOPE` | Linux 返回 V1 前重新设计 UDS/client ACL |
| R4S4-P2-02 Named Pipe DACL rights | 否 | `OUT OF SCOPE` | Pipe 被 `ncalrpc` 取代；RPC SD 仍需 Windows 实机测试 |
| R4S4-P2-03 Grant `SECURITY DEFINER` | 是 | `DESIGN CLOSED` | owner/search_path/PUBLIC revoke/role/SQL 草案已定义；DB 实现和约束测试未执行 |
| R4S4-P2-04 HMAC key lifecycle | 否 | `OUT OF SCOPE` | HMAC 已退出 identity chain；未来只可作非授权完整性标记 |
| R4S4-P2-05 Code Integrity/WDAC | 是（Windows 部分） | `NOT VERIFIED` | policy、签名、替换窗口、依赖加载均未验证 |
| R4S4-P2-06 Helper DB credential | 是 | `DESIGN CLOSED` | integrated login 或 service-SID-scoped secret 已定义；provisioning/rotation 未实现 |
| R4S4-P2-07 Delete Pending/memory map/dir durability | 是（Windows 部分） | `NOT VERIFIED` | 只能保留 `RECLAMATION_PENDING/UNKNOWN` |
| R4S4-P2-08 v1/v2 namespace Drain | 是 | `NOT VERIFIED` | 停写、Session/Helper exit、ACL/identity evidence 未执行 |

没有把 Windows 适用 P2 因平台收敛自动标成 PASS。

## 10. Attack-path Summary

设计文档逐一分析了以下 20 类攻击：

1. A 的 IPC Handle 被 B 复制；
2. A 的 HMAC key 被 B 获取；
3. B 使用复制 Handle；
4. B 使用委托 Credential；
5. 客户端退出后旧 Handle 被持有；
6. PID 重用；
7. Helper 暂停后 DB Lease 过期；
8. Supervisor 重启后旧 Session 重放；
9. Helper 退出但文件句柄仍被其他进程持有；
10. Release/依赖被替换；
11. Grant 重复消费；
12. Helper 访问其他 storageKey；
13. Supervisor 绕过 Helper；
14. Sealer/Publisher 生命周期交叠；
15. Cleanup 迟到；
16. Cleanup 与新一代对象竞争；
17. 双 Evidence 不匹配；
18. IPC 通过但 Grant 无效；
19. Grant 有效但 IPC 身份不匹配；
20. Supervisor TCB 被攻陷。

设计结论：

- Handle duplication、credential delegation、PID reuse、Supervisor restart 和
  identity/grant 组合攻击都有 fail-closed 设计；
- 进程内代码注入、Host Administrator、kernel/SRM、DB Owner、Release Trust
  Root 或 Supervisor 与 Helper/DB 同时失陷属于 TCB，不能声称完全防御；
- 涉及真实 RPC/SCM/Job/WDAC/NTFS 的路径保持 `NOT VERIFIED`。

## 11. Regression Review

| 机制 | 结果 | 说明 |
|---|---|---|
| A4 Web secure launcher/startup gate | `NOT TOUCHED` | 本阶段未修改源码/配置，无回归实现风险 |
| A4 Worker secure launcher/gate-first | `NOT TOUCHED` | 同上 |
| A6 Build Integrity/Manifest/legacy artifact isolation | `NOT TOUCHED` | 未执行 Build，未移动历史 `.next`/`dist` |
| P13 Lifecycle schema/triggers | `NOT TOUCHED` | 未执行 Schema/Migration/DB |
| Storage delete capability | `NOT TOUCHED` | 未访问 Storage/Cleanup；仍不可启用普通 Web/Worker 物理删除 |
| Signed Release design | `PASS / DESIGN` | 被 R4-S5 保留并加强启动身份 |
| Evidence design | `PASS / DESIGN` | 双证据未回退 |
| SEALED design | `PASS / DESIGN` | 进程退出、DACL、只读边界未回退 |
| DELETED semantics | `PASS / DESIGN` | 仍不代表物理介质擦除 |

“NOT TOUCHED”只表示本设计文档阶段没有改变实现；不能替代未来 Windows 实机
回归。

## 12. Linux Scope Exclusion

```text
Linux:
OUT OF SCOPE / NOT IMPLEMENTED / NOT VERIFIED
```

本轮不实现、不验证、不宣称 Linux UDS、`SO_PEERCRED`、`SCM_CREDENTIALS`、
`pidfd`、UID/GID、cgroup、fs-verity、directory fsync 或 Linux Helper。

Linux 返回 V1 前必须独立完成：

1. Linux IPC 每请求身份设计；
2. Linux Helper OS identity；
3. 文件 handle/directory authority；
4. DB credential role 隔离；
5. Linux adversarial review；
6. 真实 Linux 环境验证；
7. 故障注入和恢复测试。

## 13. Not Verified Items

```text
Windows RPC ncalrpc behavior on target OS: NOT VERIFIED
RPC interface SD/ACL exact rights: NOT VERIFIED
RPC_C_AUTHN_WINNT/PRIVACY target behavior: NOT VERIFIED
ClientPID/process handle across service SIDs: NOT VERIFIED
Process DACL/OpenProcess access: NOT VERIFIED
SCM fixed service launch: NOT VERIFIED
Job Object single-process/kill-on-close: NOT VERIFIED
Process mitigation child policy: NOT VERIFIED
WDAC/Code Integrity dependencies: NOT VERIFIED
Helper DB credential provisioning/rotation: NOT VERIFIED
PostgreSQL Grant functions/roles/Schema v2: NOT IMPLEMENTED
NTFS reparse/hard-link/FileId: NOT VERIFIED
Delete Pending/memory-map/directory durability: NOT VERIFIED
v1/v2 namespace Drain: NOT EXECUTED
A4/A6 runtime regression: NOT EXECUTED
Production deployment: NOT VERIFIED
```

这些缺口没有以测试、代码或运行结果伪装成 PASS。

## 14. Two-pass Self-review

### Pass 1 — Security / identity

- 每次调用读取 RPC call attributes；
- `ClientPID` 只来自 RPC runtime；
- process handle/creation time 绑定 PID 生命周期；
- 同 SID 不同进程不能复用 Session；
- handle/credential delegation 不能通过进程 object 比较；
- HMAC 不再作为身份；
- UNKNOWN/identity mismatch 一律 fail-closed；
- Supervisor TCB 被攻陷的限制明确。

结果：`PASS WITH WARNINGS`。

### Pass 2 — Protocol / permissions / state

- Supervisor 不写/不删 Storage；
- SCM 只启动固定 service；
- Helper target 来自 DB Grant；
- Publisher/Sealer/Cleanup 权限矩阵一致；
- State machine 以 Helper exit、DACL 和双 Evidence 为门槛；
- `SEALED`/`DELETED` 语义未回退；
- Linux 明确退出 V1；
- 八项 P2 全部有状态；
- Windows 运行时缺口全部保留为 NOT VERIFIED。

结果：`INTERNAL CONSISTENCY PASS`。

## 15. Worktree Before / After

Before：

```text
Tracked modified: 26
Untracked files: 152
Staged: 0
Deleted: 0
```

After（仅新增两份授权 Markdown）：

```text
Tracked modified: 26
Untracked files: 154
Staged: 0
Deleted: 0
```

本阶段没有修改：

- `docs/architecture/file-lifecycle-p13-design-freeze.md`
- `docs/architecture/file-lifecycle-p13-implementation-status.md`
- `docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md`
- R4-S1/R4-S2/R4-S3/R4-S4 历史文件
- `prisma/schema.prisma`
- `apps/web/next-env.d.ts`
- `apps/web/tsconfig.tsbuildinfo`
- 现有未提交源码/测试/配置

R4-S5 design 自身 SHA-256：

```text
8A83D4FD13ED92FEF3C51E902096D08D9B15925F35F8DB9BB238B6E308336B1C
```

本报告 SHA-256 在报告冻结后计算，由最终交付消息提供；报告不能包含会改变自身
哈希的内部自引用值。

## 16. Final Result

```text
A7.20-R4-S5:
PASS WITH WARNINGS

R4S4-P1-C Per-request IPC Authentication:
DESIGN CLOSED

R4S4-P1-4 Helper Process Model:
DESIGN CLOSED

WINDOWS IPC FINAL SELECTION:
ncalrpc + per-call ClientPID + process handle/lifetime + Token/SID + RPC auth

HANDLE DUPLICATION:
DESIGN FAIL-CLOSED

CREDENTIAL DELEGATION:
DESIGN FAIL-CLOSED (same-process injection/TBC excluded)

PID REUSE:
DESIGN FAIL-CLOSED USING HELD HANDLE + CREATION TIME

P1-A OPERATION GRANT:
PASS / DESIGN

P1-B SIGNED HELPER RELEASE:
PASS / DESIGN

P1-2 EVIDENCE:
PASS / DESIGN

P1-3 SEALED:
PASS / DESIGN

P1-5 DELETED:
PASS / DESIGN

LINUX:
OUT OF SCOPE / NOT IMPLEMENTED / NOT VERIFIED

WINDOWS REAL-MACHINE VERIFICATION:
NOT VERIFIED

R4 DESIGN FREEZE:
NOT APPROVED BEFORE R4-S6

R4-S6 INDEPENDENT ADVERSARIAL REVIEW:
RECOMMENDED

IMPLEMENTATION:
NOT AUTHORIZED

DATABASE:
NOT AUTHORIZED

STORAGE:
NOT AUTHORIZED

CLEANUP / RECOVERY:
NOT AUTHORIZED

SCHEMA V2:
NOT AUTHORIZED

BUILD / TEST / SCANNER:
NOT EXECUTED

GIT WRITE OPERATIONS:
NOT EXECUTED

GIT COMMIT:
NOT AUTHORIZED

DEPLOYMENT:
NOT AUTHORIZED

NEXT PHASE:
NOT AUTHORIZED
```
