# P1-3 C-6.2-L8-A7.20-R4-S7 Report

## 1. Executive Summary

```text
A7.20-R4-S7:
PASS WITH WARNINGS

R4S6-P1-01 Per-call RPC Authorization:
DESIGN CLOSED

R4S6-P1-02 Job Object Lifecycle:
DESIGN CLOSED

R4S6-P1-03 Canonical SEALED Owner/DACL:
DESIGN CLOSED

Windows runtime / database / ACL:
NOT VERIFIED

Linux:
OUT OF SCOPE / NOT IMPLEMENTED / NOT VERIFIED
```

本轮完成三个核心整改：

1. RPC interface 只暴露单一 `P13Invoke` manager；它无条件调用
   `AuthorizeCurrentCall`，之后才进入内部 operation dispatcher。Security
   callback 仅作为接口级粗过滤。
2. 新增 `P13 Process Launch Authority`。它使用 restricted token、固定
   release、匿名 Job、`CREATE_SUSPENDED`、`JOB_LIST`/受控 assign 和 handle
   transfer，确保 Helper 不持有 Job handle，Supervisor 在启动完成后是唯一
   Job handle 持有者。
3. Canonical target 与 per-object directory 采用不可登录 group owner、
   protected DACL 和 Owner Rights SID `S-1-3-4` deny ACE，阻断 owner 的隐式
   `WRITE_DAC`。Publisher 退出与写 handle 关闭先于 Sealer；Sealer 退出后才
   允许 Supervisor 双证据验证和 DB APPLIED。

本轮只新增设计与报告。设计逻辑已内部一致，但 Windows RPC、Token、Job、
Process DACL、Restricted Token、WDAC、NTFS、Owner Rights 和 PostgreSQL 行为
均未实机验证。

## 2. Baseline

```text
Repository: D:\thinkbook\Desktop\jieya
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 26
Untracked files: 155
Staged: 0
Deleted: 0
```

开始前两份 R4-S7 目标文件均不存在。

受保护文件：

| 文件 | SHA-256 |
|---|---|
| FZ | `E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705` |
| ST | `5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586` |
| DBTP | `FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7` |
| Schema | `78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299` |
| `next-env.d.ts` | `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC` |
| `tsconfig.tsbuildinfo` | `21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520` |
| R4-S5 Design | `8A83D4FD13ED92FEF3C51E902096D08D9B15925F35F8DB9BB238B6E308336B1C` |
| R4-S5 Report | `D77FDF7AF96C685211590D198CF4D8368C4E6C74486F1E2D1A2E388EA4DB4EC0` |
| R4-S6 Review | `4843EF780044A404B41C2F8012EA3C7B927FF26ADB4D010DDC480254115CAD01` |

## 3. Skills Applied

实际读取并应用：

| Skill | 本轮作用 |
|---|---|
| `$project-architecture` | Supervisor、Process Launch Authority、Helper、DB、Storage 边界 |
| `$prisma-db-safety` | Grant、launch ticket、role、`SECURITY DEFINER` 和事务设计 |
| `$security-audit` | RPC 身份、Job handle、Owner Rights、DACL 和攻击路径 |
| `$testing-and-verification` | Windows/DB/Storage 实机验证矩阵 |
| `$file-lifecycle` | Staging/Publication/SEALED/DELETED/Recovery 语义 |

完整复核：

- 根/蓝图 `AGENTS.md`
- FZ、ST、DBTP
- R4-S1 Design/Report
- R4-S2 Review
- R4-S3 Design/Report
- R4-S4 Review
- R4-S5 Design/Report
- R4-S6 Review
- 当前 Schema/Migration/Storage/Worker/Capability 只读材料

## 4. Official Sources

查询日期：`2026-11-19`。

| 来源 | 用途 |
|---|---|
| [ncalrpc](https://learn.microsoft.com/en-us/windows/win32/rpc/protocol-sequence-constants) | 本机 RPC transport |
| [RPC authentication levels](https://learn.microsoft.com/en-us/windows/win32/rpc/authentication-level-constants) | `PKT_PRIVACY` |
| [`RpcServerRegisterIf3`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdce/nf-rpcdce-rpcserverregisterif3) | interface SD/callback |
| [`RPC_IF_CALLBACK_FN`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdce/nc-rpcdce-rpc_if_callback_fn) | callback 频率限制和粗过滤定位 |
| [`RpcServerInqCallAttributesW`](https://learn.microsoft.com/en-us/windows/win32/api/rpcasync/nf-rpcasync-rpcserverinqcallattributesw) | 当前 call attributes |
| [`RPC_CALL_ATTRIBUTES_V2_W`](https://learn.microsoft.com/en-us/windows/win32/api/rpcasync/ns-rpcasync-rpc_call_attributes_v2_w) | `ClientPID` |
| [`RpcGetAuthorizationContextForClient`](https://learn.microsoft.com/en-us/windows/win32/api/rpcasync/nf-rpcasync-rpcgetauthorizationcontextforclient) | Authz client context |
| [`RpcImpersonateClient`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdce/nf-rpcdce-rpcimpersonateclient) | V1 禁止业务 impersonation 的原因 |
| [`RpcRevertToSelf`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdce/nf-rpcdce-rpcreverttoself) | fallback 清理 |
| [`OpenThreadToken`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-openthreadtoken) | fallback token 检查和关闭 |
| [`OpenProcess`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-openprocess) | ClientPID 进程句柄 |
| [`GetProcessTimes`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes) | PID reuse |
| [`GetTokenInformation`](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-gettokeninformation) | TokenUser/Groups/Integrity/Session/RestrictedSids |
| [`DuplicateHandle`](https://learn.microsoft.com/en-us/windows/win32/api/handleapi/nf-handleapi-duplicatehandle) | Launch Authority 到 Supervisor handle transfer |
| [Process Creation Flags](https://learn.microsoft.com/en-us/windows/win32/procthread/process-creation-flags) | `CREATE_SUSPENDED` |
| [`CreateProcessAsUser`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessasusera) | 固定 Helper token 启动 |
| [`ResumeThread`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-resumethread) | 最后恢复 |
| [`UpdateProcThreadAttribute`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute) | `PROC_THREAD_ATTRIBUTE_JOB_LIST` |
| [Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects) | child/Job 限制边界 |
| [Job limit information](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_limit_information) | last-handle kill |
| [`AssignProcessToJobObject`](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-assignprocesstojobobject) | fallback association |
| [`TerminateJobObject`](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-terminatejobobject) | paused helper termination |
| [`IsProcessInJob`](https://learn.microsoft.com/en-us/windows/win32/api/jobapi/nf-jobapi-isprocessinjob) | resume 前验证 |
| [`CreateRestrictedToken`](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-createrestrictedtoken) | 第二 access check、移除 privilege |
| [Owner of a New Object](https://learn.microsoft.com/en-us/windows/win32/secauthz/owner-of-a-new-object) | owner implicit `WRITE_DAC` |
| [Owner Rights](https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/understand-special-identities-groups) | S-1-3-4 覆盖 owner 隐式权限 |
| [`SetEntriesInAcl`](https://learn.microsoft.com/en-us/windows/win32/api/aclapi/nf-aclapi-setentriesinacla) | deny ACE 顺序 |
| [`SetSecurityInfo`](https://learn.microsoft.com/en-us/windows/win32/api/aclapi/nf-aclapi-setsecurityinfo) | Owner/DACL 设置 |
| [SECURITY_INFORMATION](https://learn.microsoft.com/en-us/windows/win32/secauthz/security-information) | protected DACL |
| [How AccessCheck Works](https://learn.microsoft.com/en-us/windows/win32/secauthz/how-dacls-control-access-to-an-object) | DACL access check |
| [`AccessCheck`](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-accesscheck) | 权限负验证 |
| [File Security and Access Rights](https://learn.microsoft.com/en-us/windows/win32/fileio/file-security-and-access-rights) | 文件/目录 access bits |
| [`GetFileInformationByHandleEx`](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfileinformationbyhandleex) | FileId/LinkCount |
| [WDAC](https://learn.microsoft.com/en-us/windows/security/application-security/application-control/windows-defender-application-control/wdac) | 固定 Release |
| [PostgreSQL CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html) | Grant `SECURITY DEFINER` |

API 存在不等于 Windows 组合行为已验证；报告中的所有 runtime 项保持
`NOT VERIFIED`。

## 5. Problem Tracking

| 问题 | 原始风险 | R4-S7 设计 | 状态 |
|---|---|---|---|
| R4S6-P1-01 | callback 不保证每调用 | 单一 public manager 强制 wrapper | `DESIGN CLOSED` |
| R4S6-P1-02 | Helper Job handle 阻止 kill | Process Authority 预创建、预加入、handle transfer | `DESIGN CLOSED` |
| R4S6-P1-03 | owner implicit WRITE_DAC | group owner + Owner Rights + protected DACL | `DESIGN CLOSED` |

## 6. Manager Coverage

### 6.1 RPC public methods

| Interface | Manager public method | Coverage |
|---|---|---:|
| `P13_AUTHORITY_CONTROL_V1` (`4F8ED476-EC87-4257-A9DA-589E31FA4BC8`) | `P13Invoke` | 100% operation enum |
| `P13_PROCESS_LAUNCH_V1` (`B2D9E41C-34D5-4046-96B6-9E14AA9D533E`) | `P13LaunchInvoke` | 100% launch enum |

### 6.2 Authority operations

| Op | Operation | Authorized classes |
|---:|---|---|
| 0x0001 | SESSION_REGISTER | Web/Worker/4 Helpers |
| 0x0002 | SESSION_HEARTBEAT | Web/Worker/4 Helpers |
| 0x0003 | SESSION_CLOSE | Web/Worker/4 Helpers |
| 0x0004 | OPERATION_REQUEST_GRANT | Web/Worker |
| 0x0005 | OPERATION_STATUS_READ | Web/Worker |
| 0x0006 | OPERATION_CANCEL_BEFORE_GRANT | Web/Worker |
| 0x0007 | HELPER_REGISTER | 4 Helpers |
| 0x0008 | HELPER_HEARTBEAT | 4 Helpers |
| 0x0009 | HELPER_EFFECT_COMMITTED | 4 Helpers |
| 0x000A | HELPER_EXIT_NOTICE | 4 Helpers |
| 0x000B | GRANT_STATUS_READ | 4 Helpers |
| 0x000C | AUTHORITY_EPOCH_READ | Web/Worker/4 Helpers |
| 0x000D | PROCESS_STATE_READ | 4 Helpers |

### 6.3 Launch operations

| Op | Operation | Caller |
|---:|---|---|
| 0x1000 | LAUNCH_SESSION_REGISTER | Supervisor only |
| 0x1001 | LAUNCH_PREPARE | Supervisor only |
| 0x1002 | LAUNCH_COMMIT | Supervisor only |
| 0x1003 | LAUNCH_ABORT | Supervisor only |
| 0x1004 | LAUNCH_STATUS_READ | Supervisor only |
| 0x1005 | LAUNCH_SESSION_CLOSE | Supervisor only |

未覆盖 public manager：`0`。所有 operation 在未认证或 caller class 不匹配时
拒绝；不存在匿名 operation。

## 7. P1-1 Result

```text
DESIGN CLOSED / WINDOWS RUNTIME NOT VERIFIED
```

正向设计：

- IDL public manager 只有 `P13Invoke`；
- `P13Invoke` 无条件调用 `AuthorizeCurrentCall`；
- internal dispatcher 不对 RPC 导出；
- security callback 只做接口粗过滤；
- operation enum 有固定 class table；
- unknown/default deny；
- 授权失败前没有 DB/FS/Evidence 写入。

实机待验：

- RPC callback 次数；
- ClientPID 每调用一致性；
- Authz context/process token 映射；
- process DACL 跨 service SID；
- operation/Session concurrency。

## 8. P1-2 Result

```text
DESIGN CLOSED / WINDOWS RUNTIME NOT VERIFIED
```

正向设计：

- Process Launch Authority 是 fixed own-process service；
- Helper 由 fixed binary + restricted token 创建；
- `CREATE_SUSPENDED` + JOB_LIST，fallback assign；
- Resume 只在 handle transfer、commit、Job membership 验证后；
- Helper 永远没有 Job handle；
- Launch Authority 和 Supervisor 是唯一可能持有者；
- COMMIT 后 Launch Authority 关闭 source handles；
- Supervisor 保留最后一个 Job handle；
- Supervisor crash/resume failure/paused Helper 均走 Job kill 或 UNKNOWN。

实机待验：

- nested Job/JOB_LIST 支持；
- Handle duplication 与 source close；
- crash timing；
- restricted token 对代理启动的实际阻断；
- final handle uniqueness。

## 9. P1-3 Result

```text
DESIGN CLOSED / WINDOWS RUNTIME NOT VERIFIED
```

正向设计：

- Canonical Owner 是不可登录 group；
- target 与 per-object directory 使用 protected DACL；
- `OWNER RIGHTS (S-1-3-4)` deny `WRITE_DAC`/`WRITE_OWNER`/数据写/delete；
- Sealer 只能在 exact-target Grant 中设置 SD，没有数据写权限；
- Supervisor 只读；
- Publisher 先关闭写 handle 并退出；
- Sealer 退出后才做 Supervisor verification；
- DACL 更新不被当作旧 handle 撤销；
- LinkCount/size/hash/FileId/parent identity 全部验证。

实机待验：

- Owner Rights ACE 和 access check；
- protected DACL 继承；
- Guardian 自授权负测试；
- 父目录 delete/replace/hardlink；
- old write handle 与 SD update 时序；
- directory durability。

## 10. R4-S6 New 9 P2

| ID | 状态 | 结果 |
|---|---|---|
| R4S6-P2-01 Impersonation lifecycle | `DESIGN CLOSED` | V1 禁用业务 impersonation；fallback 必须有 revert/quarantine |
| R4S6-P2-02 Principal/token relationship | `DESIGN CLOSED` | principal SID = process user SID；SID class/restricted/session/integrity 同时匹配 |
| R4S6-P2-03 RPC/process DACL rights | `NOT VERIFIED` | rights matrix 已定义，Windows ACL 未验证 |
| R4S6-P2-04 Named Job issues | `DESIGN CLOSED` | anonymous Job、唯一 handle、无 name squatting |
| R4S6-P2-05 WMI/out-of-Job | `NOT VERIFIED` | restricted token + no-child + WDAC 计划，实机待验 |
| R4S6-P2-06 Old file handles | `DESIGN CLOSED` | one-shot/no child/no dup + exit proof；未证明则 UNKNOWN |
| R4S6-P2-07 Method authorization matrix | `DESIGN CLOSED` | 两 interface 各一个 public manager；所有 operation 覆盖 |
| R4S6-P2-08 SCM/own-process/status | `DESIGN CLOSED` | Helper 不再由 SCM 直接启动；process handle 才作退出证明 |
| R4S6-P2-09 Grant/Evidence Schema | `NOT VERIFIED` | Schema/Trigger/role/DB 事务未实现 |

## 11. R4-S4 Historical 8 P2

| ID | 状态 |
|---|---|
| R4S4-P2-01 Linux socket | `OUT OF SCOPE` |
| R4S4-P2-02 Named Pipe DACL | `OUT OF SCOPE` |
| R4S4-P2-03 Grant SECURITY DEFINER | `DESIGN CLOSED` |
| R4S4-P2-04 HMAC lifecycle | `OUT OF SCOPE` |
| R4S4-P2-05 WDAC/Code Integrity | `NOT VERIFIED` |
| R4S4-P2-06 Helper DB credential | `DESIGN CLOSED` |
| R4S4-P2-07 Delete Pending/memory map/fsync | `NOT VERIFIED` |
| R4S4-P2-08 v1/v2 Drain | `NOT VERIFIED` |

## 12. Regression

| 机制 | 结果 |
|---|---|
| Independent Operation Grant | `PASS / DESIGN`；launchTicket/process lifetime 绑定增强，DB 未实现 |
| Signed Helper Release | `PASS / DESIGN`；fixed release 未回退，WDAC runtime 未验证 |
| Evidence dual chain | `PASS / DESIGN`；新增 launch evidence，不替代 Helper/Supervisor 文件事实 |
| SEALED semantics | `PASS / DESIGN`；Owner Rights 修复 R4-S6 P1 |
| DELETED semantics | `PASS / DESIGN`；仍仅 Controlled Namespace Removal |
| Web/Worker no direct Storage | `PASS / DESIGN` |
| Legacy cleanup remains disabled | `NOT TOUCHED` |
| A4 Web/Worker startup gate | `NOT TOUCHED` |
| A6 Build Integrity/Manifest | `NOT TOUCHED` |
| P13 Schema/Trigger | `NOT TOUCHED` |

## 13. Attack Paths

报告分析：

- R4-S6 原 20 条：全部按原编号回归；
- R4-S7 新 24 条：全部有 defence/failure/status；
- 合计 44 条。

新增路径重点结果：

| 区域 | 结果 |
|---|---|
| Manager 漏调用授权 / 内部绕过 | `DESIGN CLOSED` |
| Impersonation/revert/并发 context | `DESIGN CLOSED` |
| Helper before-Job / Job handle / named Job / resume failure | `DESIGN CLOSED` |
| WMI/SCM/Task Scheduler Job 外启动 | `NOT VERIFIED`；生产前实机 gate |
| Guardian owner WRITE_DAC / Owner Rights 错误 | `DESIGN CLOSED` |
| 父目录替换 / 旧写 handle / DACL 更新误解 | `DESIGN CLOSED` |
| Sealer 未完成即 APPLIED / Evidence lifetime 错误 | `DESIGN CLOSED` |
| Cleanup/SEALED 竞争 / old Job recovery | `DESIGN CLOSED` |

第 12/13 条如果不能由真实 Windows 负测试证明，相关 P2 升级为 P1，整个方案
不得进入生产。

## 14. TCB

| 组件 | 结论 |
|---|---|
| Windows Kernel/SRM | TCB |
| RPC runtime | API 契约已核验；runtime NOT VERIFIED |
| Authority Supervisor | TCB；不直接写 Storage |
| Process Launch Authority | 新 TCB；只能启动固定 helper，不写 Storage/文件 |
| Helper OS identity | fixed restricted token 设计；配置 NOT VERIFIED |
| Canonical Owner group | 不可登录、无成员设计；ACL NOT VERIFIED |
| Owner Rights/DACL | 设计已闭合；实机 NOT VERIFIED |
| Job Object | 设计闭合；Windows 实机 NOT VERIFIED |
| SCM | 只运行 fixed own-process Authority services |
| DB Grant/roles | design；DB NOT IMPLEMENTED |
| Evidence persistence | design；Schema NOT IMPLEMENTED |
| Release Trust Root/WDAC | configured/runtime NOT VERIFIED |
| Recovery Coordinator | V1 no direct handle; future separate authorization |

Host Administrator、SYSTEM、恶意内核和 DB Owner 仍是 TCB。管理员可用
SeTakeOwnership/SeRestore 绕过普通 DACL；不得声称防御 Host Administrator。

## 15. Windows Real-Machine Gaps

```text
ncalrpc ClientPID/auth: NOT VERIFIED
RPC process DACL/Authz mapping: NOT VERIFIED
Process Launch Authority Credential Store: NOT VERIFIED
JOB_LIST/fallback/nested Job: NOT VERIFIED
Handle transfer/final handle kill: NOT VERIFIED
Restricted token/WMI/SCM/COM/Task Scheduler: NOT VERIFIED
WDAC/Code Integrity: NOT VERIFIED
Owner Rights/protected DACL/AccessCheck: NOT VERIFIED
FileId/LinkCount/Delete Pending/directory durability: NOT VERIFIED
Global/SYSTEM/Admin ACL: TCB / NOT VERIFIED
PostgreSQL Grant/Evidence Schema: NOT IMPLEMENTED
```

### 15.1 Residual findings

| ID | Residual risk | Status |
|---|---|---|
| `R4S7-P2-01` | Process Launch Authority 的 helper logon credential 存储、轮换和泄露防护尚未实现 | `NOT VERIFIED` |
| `R4S7-P2-02` | restricted token 是否在目标 Windows 上阻断全部 WMI/COM/SCM/Task Scheduler 代理启动路径 | `NOT VERIFIED` |
| `R4S7-P2-03` | Windows directory flush/durability 和 NTFS 版本行为 | `NOT VERIFIED` |
| `R4S7-P3-01` | token/process/job/security-descriptor handle 的 RAII/CloseHandle 实现 | `DESIGN CLOSED / IMPLEMENTATION NOT PRESENT` |

## 16. Linux Scope

```text
Linux:
OUT OF SCOPE / NOT IMPLEMENTED / NOT VERIFIED
```

未来 Linux 重新进入必须单独完成 IPC、UID/GID、process token、Job/cgroup、
owner/permission、file handle、DB role、cleanup/recovery 和真实 Linux 验证。

## 17. Two-pass Self-review

### Pass 1 — Security/attack

- 单一 RPC manager 阻止方法漏网；
- process identity 不采信 payload；
- job handle 不由 Helper 持有；
- restricted token 阻断代理服务访问的设计已明确；
- Owner Rights 与 protected DACL 解决 owner implicit write；
- Publisher/Sealer/old handle 时序明确；
- 任何无法证明的 OS 状态保持 UNKNOWN。

结果：`PASS WITH WINDOWS VERIFICATION WARNINGS`。

### Pass 2 — Protocol/consistency

- operation matrix 与 dispatcher 一致；
- launch ticket/Grant/Release/process lifetime 绑定一致；
- Job/process/thread handle ownership 一致；
- final file/directory DACL matrix 一致；
- DB APPLIED 依赖 dual evidence；
- Linux/out-of-scope、implementation/runtime 分层一致；
- 没有把 runtime 或 DB 标为已验证。

结果：`INTERNAL CONSISTENCY PASS`。

## 18. Worktree Before / After

Before：

```text
Tracked modified: 26
Untracked files: 155
Staged: 0
Deleted: 0
```

After（计划仅新增两份 R4-S7 Markdown）：

```text
Tracked modified: 26
Untracked files: 157
Staged: 0
Deleted: 0
```

新增文件：

| 文件 | SHA-256 |
|---|---|
| R4-S7 Design | `6074131D7E8B4EF37B5AE6F9AD1733C012B2062E479EE9395A0EB4212CEECC0A` |
| R4-S7 Report | 报告冻结后外部计算，不能嵌入自身哈希 |

未修改：

- R4-S1 至 R4-S6 历史文件
- FZ、ST、DBTP
- Prisma Schema/Migration
- Storage/Worker/Web 源码
- `next-env.d.ts`、`tsconfig.tsbuildinfo`
- `.next`、Worker `dist`
- Git index

## 19. Final Fields

```text
A7.20-R4-S7:
PASS WITH WARNINGS

R4S6-P1-01 Per-call RPC Authorization:
DESIGN CLOSED

R4S6-P1-02 Job Object Lifecycle:
DESIGN CLOSED

R4S6-P1-03 Canonical SEALED Owner/DACL:
DESIGN CLOSED

Manager Methods Uncovered:
0

Job Handle In Helper:
NONE BY DESIGN

Canonical Owner Self-restoration:
BLOCKED BY OWNER RIGHTS / DESIGN

Operation Grant Regression:
PASS / DESIGN

Signed Release Regression:
PASS / DESIGN

Evidence Regression:
PASS / DESIGN

DELETED Regression:
PASS / DESIGN

New P1:
0

R4-S6 P2:
6 DESIGN CLOSED / 3 NOT VERIFIED

Windows Runtime:
NOT VERIFIED

Database / Schema / Migration:
NOT EXECUTED / NOT AUTHORIZED

Storage / ACL / Cleanup / Recovery:
NOT EXECUTED / NOT AUTHORIZED

Build / Test / Scanner:
NOT EXECUTED

Git Write:
NOT EXECUTED

R4 Design Freeze:
NOT AUTOMATICALLY APPROVED

R4-S8:
RECOMMENDED INDEPENDENT REVIEW / NOT AUTHORIZED

R4-A / R4-B:
NOT AUTHORIZED

Git Commit / Deployment:
NOT AUTHORIZED

NEXT PHASE:
NOT AUTHORIZED
```
