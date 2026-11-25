# P1-3 C-6.2-L8-A7.20-R4-S8 Independent Adversarial Review

## 0. 审查结论

```text
A7.20-R4-S8:
PASS WITH WARNINGS

P1-1 RPC Per-call Authorization:
DESIGN CLOSED

P1-2 Job Object Lifecycle:
DESIGN CLOSED

P1-3 Canonical SEALED Owner/DACL:
DESIGN CLOSED

New unresolved P1:
0

R4 Design Freeze:
APPROVED

Windows Runtime / DB / ACL:
NOT VERIFIED
```

本结论不是沿用 R4-S7 自评。独立复核确认：

1. `P13Invoke` 和 `P13LaunchInvoke` 的单一 manager 结构能在设计层面阻止
   manager 方法遗漏 `AuthorizeCurrentCall`；callback 仅作接口粗过滤。
2. Anonymous Job、suspended process、预关联和 handle transfer 解决了
   R4-S6 的 Job last-handle 缺口；Helper 不持有 Job handle，Supervisor
   crash 后由最后一个 handle 关闭触发终止。
3. Owner Rights SID `S-1-3-4` + protected DACL + 不可登录 group owner
   解决了 owner 隐式 `WRITE_DAC`；旧 handle 不得被 DACL 更新误认为撤销，
   未证明关闭时必须保持 `UNKNOWN`。

但仍有 Windows API runtime、ACL 配置、DB Schema 和 helper credential
provisioning 缺口，必须保留为 `NOT VERIFIED`。这些缺口不应被解释为生产
安全已验证，也不构成本轮批准源码或部署的依据。

## 1. 独立审查声明

```text
Mode: READ-ONLY ADVERSARIAL DESIGN REVIEW
Platform: Windows V1 only
Source changes: NOT AUTHORIZED
Build/Test/Scanner: NOT EXECUTED
Database/SQL/Migration: NOT EXECUTED
Storage/ACL/Service/Job: NOT EXECUTED
Git writes: NOT EXECUTED
R4-S9: NOT AUTHORIZED
```

本轮不把 API 存在当成系统安全保证。只有当设计逻辑有官方契约支持，且所有
runtime 未验证项继续标记 `NOT VERIFIED` 时，才给出设计层结论。

## 2. Baseline

```text
Repository: D:\thinkbook\Desktop\jieya
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 26
Untracked files: 157
Staged: 0
Deleted: 0
```

开始前目标报告不存在：

```text
docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s8-independent-adversarial-review.md
```

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
| R4-S7 Design | `6074131D7E8B4EF37B5AE6F9AD1733C012B2062E479EE9395A0EB4212CEECC0A` |
| R4-S7 Report | `C0B26DA00F2F662C77D6A439E8EB8E45D54E1A78B509C0C7234D2CCAD2429BD2` |

## 3. Skills 和审查材料

实际读取并应用：

- `$project-architecture`
- `$prisma-db-safety`
- `$security-audit`
- `$testing-and-verification`
- `$file-lifecycle`

完整读取/复核：

- 根/蓝图 `AGENTS.md`
- FZ、ST、DBTP
- R4-S1 Design/Report
- R4-S2 Review
- R4-S3 Design/Report
- R4-S4 Review
- R4-S5 Design/Report
- R4-S6 Review
- R4-S7 Design/Report
- 当前 Schema、Migration、Storage、Worker、Capability 和 Implementation Status
  相关只读材料

## 4. 官方依据核验

查询日期：`2026-11-20`（API 语义查证于本阶段只读执行；无运行时验证）。

| 官方资料 | 明确保证 | 未保证 / 本轮处理 |
|---|---|---|
| [ncalrpc](https://learn.microsoft.com/en-us/windows/win32/rpc/protocol-sequence-constants) | 本机 RPC；`RPC_C_AUTHN_WINNT` | 不代表每调用进程身份，必须结合 ClientPID/Process |
| [Authentication levels](https://learn.microsoft.com/en-us/windows/win32/rpc/authentication-level-constants) | `ncalrpc` 使用 `PKT_PRIVACY` | 认证连接不等同业务 Grant |
| [`RpcServerRegisterIf3`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdce/nf-rpcdce-rpcserverregisterif3) | interface SecurityDescriptor/callback | callback 不是逐调用保证 |
| [`RPC_IF_CALLBACK_FN`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdce/nc-rpcdce-rpc_if_callback_fn) | callback 可多次发生 | 不能作为唯一 `AuthorizeCurrentCall` |
| [`RpcServerInqCallAttributesW`](https://learn.microsoft.com/en-us/windows/win32/api/rpcasync/nf-rpcasync-rpcserverinqcallattributesw) | 查询当前调用属性 | 失败字段不可用，必须 deny |
| [`RPC_CALL_ATTRIBUTES_V2_W`](https://learn.microsoft.com/en-us/windows/win32/api/rpcasync/ns-rpcasync-rpc_call_attributes_v2_w) | `ncalrpc` 可返回 ClientPID | PID 只是 process object locator |
| [`RpcGetAuthorizationContextForClient`](https://learn.microsoft.com/en-us/windows/win32/api/rpcasync/nf-rpcasync-rpcgetauthorizationcontextforclient) | RPC Authz client context | 不能替代 process token/Grant |
| [`RpcImpersonateClient`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdce/nf-rpcdce-rpcimpersonateclient) | 模拟当前 client；失败可能保持 server identity | S7 设计将业务路径改为不依赖 impersonation |
| [`RpcRevertToSelf`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdce/nf-rpcdce-rpcreverttoself) | 结束线程模拟 | fallback 必须异常安全，实际未验证 |
| [`OpenProcess`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-openprocess) | DACL/access rights 控制进程 handle | Process DACL 跨 SID 未验证 |
| [`GetProcessTimes`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes) | creation time | 需要持有原 process handle 排除 PID reuse |
| [`GetTokenInformation`](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-gettokeninformation) | User/Groups/Integrity/Session/RestrictedSids | 实际 token 组合未验证 |
| [`DuplicateHandle`](https://learn.microsoft.com/en-us/windows/win32/api/handleapi/nf-handleapi-duplicatehandle) | 跨进程复制需 `PROCESS_DUP_HANDLE` | 转移时序需实机故障注入 |
| [Process Creation Flags](https://learn.microsoft.com/en-us/windows/win32/procthread/process-creation-flags) | `CREATE_SUSPENDED` 在 resume 前 primary thread 不运行；breakaway 必须显式 | 需验证目标 Windows |
| [`CreateProcessAsUser`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessasusera) | 指定 token 创建进程 | 需要 token/privilege；credential provisioning 未实现 |
| [`ResumeThread`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-resumethread) | 将 suspended primary thread 恢复 | Resume 必须在 Job/Handle 验证后 |
| [`UpdateProcThreadAttribute`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute) | `JOB_LIST` 在创建时指定 Job | 版本、nested Job 未验证 |
| [Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects) | child 默认关联；WMI `Win32_Process.Create` 不默认关联 | 不能把 Job 当成所有代理启动边界 |
| [Job limits](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_limit_information) | `KILL_ON_JOB_CLOSE` 依赖最后一个 handle | Helper 不持 Job handle 是关键 |
| [`AssignProcessToJobObject`](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-assignprocesstojobobject) | assign 权限和 nested 条件 | fallback 需实机验证 |
| [`CreateRestrictedToken`](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-createrestrictedtoken) | restricting SIDs 参与二次 access check；移除 privileges | 需要每类 helper 的独立 restricting SID 和 ACL |
| [Owner Rights](https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/understand-special-identities-groups) | `S-1-3-4` ACE 可忽略 owner 隐式 READ_CONTROL/WRITE_DAC | 必须与 protected DACL 一起验证 |
| [`SetSecurityInfo`](https://learn.microsoft.com/en-us/windows/win32/api/aclapi/nf-aclapi-setsecurityinfo) | Owner/DACL 设置；可配合 protected DACL | 现有 handle 不会因 DACL 变化自动撤销 |
| [`SetEntriesInAcl`](https://learn.microsoft.com/en-us/windows/win32/api/aclapi/nf-aclapi-setentriesinacla) | deny ACE 排序和 ACL 合并 | 实际 SDDL/ACE 顺序需验证 |
| [`AccessCheck`](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-accesscheck) | 对指定 token/SD/access mask 做检查 | 需对全部主体和 parent 做负测试 |
| [`FILE_STANDARD_INFO`](https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_standard_info) | LinkCount | hard-link 判定需实际 NTFS |
| [WDAC](https://learn.microsoft.com/en-us/windows/security/application-security/application-control/windows-defender-application-control/wdac) | 应用控制可限制代码加载 | 策略和目标环境未验证 |
| [PostgreSQL CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html) | `SECURITY DEFINER` owner/search_path 语义 | Schema/role/DB runtime 未实现 |

## 5. R4-S7 原结论复核

| 项 | S7 声明 | 独立复核 |
|---|---|---|
| P1-1 | 单一 manager + wrapper | 设计路径成立；实际实现 NOT VERIFIED |
| P1-2 | Helper 无 Job handle，Supervisor 最后持有 | 设计路径成立；handle transfer/runtime NOT VERIFIED |
| P1-3 | Owner Rights + protected DACL | 设计路径成立；ACL/old handle/runtime NOT VERIFIED |

## 6. P1-1：RPC Per-call Authorization

### 6.1 Public entry inventory

设计层 inventory：

```text
P13_AUTHORITY_CONTROL_V1
  P13Invoke (opnum 0) -- only public manager

P13_PROCESS_LAUNCH_V1
  P13LaunchInvoke (opnum 0) -- only public manager
```

没有设计的第三 public manager、legacy manager、diagnostic manager 或 COM/WMI
authority entry。实际代码不存在，因此实现期仍必须通过 MIDL export/static
scanner 证明；不能把文档 inventory 当作已实现 inventory。

### 6.2 Structural gate

`P13Invoke` 和 `P13LaunchInvoke` 都在 dispatch 前无条件调用
`AuthorizeCurrentCall`。内部 dispatcher 不导出为 RPC manager，未知 opcode
默认拒绝。S7 的设计比“开发人员记得调用”更强。

独立结论：

```text
P1-1 DESIGN: PASS
P1-1 IMPLEMENTATION: NOT PRESENT
P1-1 WINDOWS RUNTIME: NOT VERIFIED
```

### 6.3 Identity semantics

S7 不再依赖 `RpcImpersonateClient` 执行业务或 DB/FS 操作，改用 RPC principal、
Authz context、ClientPID process handle/process token 和 Session tuple。该选择
避免了线程 impersonation 泄漏的常见路径。

仍需实机确认：

- current call `ClientPID`；
- process DACL 允许最小 query/synchronize；
- principal SID 与 process TokenUser 一致；
- process creation time 与 held handle 一致；
- restricted SID 正确出现在 helper token；
- 并发 RPC 不共享 mutable authorization context。

### 6.4 Callback boundary

callback 仅做接口级粗过滤。独立复核同意该职责划分；不存在 callback 通过后
manager 跳过 wrapper 的设计路径。

### 6.5 Operation mapping

13 个 Authority op 和 6 个 Launch op 均有 caller class、DB/FS side effect、
Grant 条件或 Supervisor-only 约束。未知 opcode/未知 caller class 拒绝。
设计层无未覆盖 operation；实现层仍要扫描实际 IDL 和 dispatcher table。

### 6.6 P1-1 verdict

```text
DESIGN CLOSED
```

理由不是测试通过，而是单 public manager 的结构使“漏调用 wrapper”不可由
正常 RPC 入口发生。运行时 API 组合仍未验证。

## 7. P1-2：Job Object Lifecycle

### 7.1 设计关键路径

```text
Launch Authority
  -> consume DB launch ticket
  -> create anonymous Job
  -> CreateProcessAsUser(CREATE_SUSPENDED)
  -> JOB_LIST or AssignProcessToJobObject
  -> IsProcessInJob
  -> duplicate Job/process/thread to Supervisor
  -> COMMIT closes LaunchAuthority source handles
  -> Supervisor ResumeThread
```

Helper never receives Job handle. This closes R4-S6's last-handle design flaw.

### 7.2 Handle ownership

| Holder | Job handle | Scope |
|---|---:|---|
| Launch Authority | temporary before COMMIT | source handles, closes on commit/abort |
| Supervisor | final | only surviving Job handle after commit |
| Helper | none | cannot block `KILL_ON_JOB_CLOSE` |
| Web/Worker/other Helpers | none | no Job DACL access |

The ownership graph is internally consistent if implementation actually uses
anonymous Job + non-inheritable DuplicateHandle + source close. These are
runtime prerequisites, not proven by this design.

### 7.3 Crash timeline

| Point | Suspended/Helper state | Expected result |
|---|---|---|
| before Job | no helper or no job | no execution |
| after Job before process | no helper | close Job |
| after process before associate | suspended only | terminate + no resume |
| associative failure | suspended | abort |
| after handle transfer before commit | suspended | source disconnect/close kills |
| commit lost | suspended/confirmed | close or terminate; no resume |
| after resume, Supervisor crash | running | final Job handle closes; helper killed |
| helper paused | running in Job | Supervisor/Job close terminates |
| helper exit unproven | unknown | no new authority; UNKNOWN |

The conceptual ordering is fail-closed. Actual handle counts and crash timing
remain Windows runtime tests.

### 7.4 Job-outside creation

Job alone does not cover `Win32_Process.Create`, WMI, SCM, Task Scheduler or
other proxies. S7 adds a restricted token and unique restricting SID, plus
no-child and WDAC. The design does not claim that this has been proven on a
real Windows version. It correctly leaves this as `NOT VERIFIED`.

If real testing shows a helper can cause a Job-outside process with storage
access, P1-2 must reopen and the design must fail closed.

### 7.5 P1-2 verdict

```text
DESIGN CLOSED
WINDOWS HANDLE/JOB RUNTIME: NOT VERIFIED
```

The core last-handle ownership flaw is removed at design level. Runtime
containment remains a mandatory implementation gate.

## 8. P1-3：Canonical SEALED

### 8.1 Owner model

Final owner is an unlogonable local group:

```text
P13 Canonical Owner
members: none
```

Target and per-object directory contain an explicit Owner Rights ACE
`S-1-3-4` denying `WRITE_DAC`, `WRITE_OWNER`, data writes and delete.
This is the correct response to the official owner implicit `WRITE_DAC`
semantics.

### 8.2 Protected DACL

The final DACL is protected, prevents inherited broad ACEs, and gives:

- Guardian/Supervisor read only;
- Publisher/Sealer/Cleanup no new canonical write;
- owner rights denial for owner;
- Administrator/SYSTEM explicitly classified as TCB.

The design must still verify actual ACE flags, owner SID, inherited bits and
AccessCheck on the target Windows build. `SetSecurityInfo` success alone is not
proof.

### 8.3 Existing handles

The design explicitly states DACL changes do not revoke existing handles.
Publisher is one-shot; Job membership, no child, restricted token and process
DACL are used to prevent external write-handle transfer. If old handle closure
cannot be proven, the design requires `UNKNOWN`/`FAILED_RETAINED`.

This is fail-closed and matches the file-lifecycle safety rule.

### 8.4 Sealer and Supervisor

Sealer has exact-target `WRITE_DAC/WRITE_OWNER` but no data write. It writes
owner + protected DACL, reads back the SD, performs AccessCheck, closes, and
exits. Supervisor then independently reads the target and checks:

- FileId/volume identity;
- parent identity;
- size/SHA-256;
- LinkCount;
- Owner/DACL/Owner Rights;
- write access denial for all prohibited subjects.

Only then can dual Evidence and DB APPLIED proceed.

### 8.5 P1-3 verdict

```text
DESIGN CLOSED
WINDOWS OWNER/DACL/HANDLE RUNTIME: NOT VERIFIED
```

The design no longer relies on a “read-only owner”; it explicitly removes the
owner implicit DACL path. ACL correctness and old handle behavior still require
real-machine evidence.

## 9. R4-S6 P2 Independent Matrix

| ID | Original issue | Independent status | Reason |
|---|---|---|---|
| R4S6-P2-01 | Impersonation/revert lifecycle | `DESIGN CLOSED` | V1 removes impersonation from business path; fallback is explicitly quarantined |
| R4S6-P2-02 | Principal/token/ClientPID relationship | `DESIGN CLOSED` | exact class/User/restricted SID/session/integrity relationship defined |
| R4S6-P2-03 | RPC/process DACL rights | `NOT VERIFIED` | ACL rights matrix exists; Windows ACL behavior untested |
| R4S6-P2-04 | Named Job issues | `NOT VERIFIED` | anonymous Job and handle design are sound; JOB_LIST/assign/terminate runtime unverified |
| R4S6-P2-05 | WMI/Job outside paths | `NOT VERIFIED` | restricted token + Job + WDAC plan exists; no Windows negative proof |
| R4S6-P2-06 | Existing write handles | `NOT VERIFIED` | design uses exit/one-shot proof; actual old-handle absence unproven |
| R4S6-P2-07 | RPC method authorization matrix | `DESIGN CLOSED` | two single-manager interfaces and 19 total operations map fully |
| R4S6-P2-08 | SCM own-process/status | `NOT VERIFIED` | helper launch is moved to Launch Authority; actual service/token behavior unverified |
| R4S6-P2-09 | Grant/Evidence Schema | `NOT VERIFIED` | no Schema/Trigger/role/DB execution |

The six/three split claimed by S7 is not accepted verbatim. Independent review
keeps runtime-dependent P2-03/04/05/06/08/09 as `NOT VERIFIED`; this is a
warning, not a new P1.

## 10. R4-S4 Historical P2 Regression

| ID | Original issue | Status | Regression |
|---|---|---|---|
| R4S4-P2-01 | Linux socket directory | `OUT OF SCOPE` | no Linux V1 claim |
| R4S4-P2-02 | Named Pipe DACL | `OUT OF SCOPE` | replaced by ncalrpc, but RPC ACL remains P2-03 |
| R4S4-P2-03 | Grant SECURITY DEFINER | `DESIGN CLOSED` | design contract retained; DB not implemented |
| R4S4-P2-04 | HMAC lifecycle | `OUT OF SCOPE` | HMAC no longer identity proof |
| R4S4-P2-05 | WDAC/Code Integrity | `NOT VERIFIED` | no policy/runtime evidence |
| R4S4-P2-06 | Helper DB credential | `DESIGN CLOSED` | design retained; provisioning not verified |
| R4S4-P2-07 | Delete Pending/durability | `NOT VERIFIED` | not run on NTFS |
| R4S4-P2-08 | v1/v2 Drain | `NOT VERIFIED` | no process/ACL evidence |

## 11. Operation Grant / Signed Release / Evidence / DELETED

### 11.1 Operation Grant

```text
Independent regression: PASS / DESIGN
```

The independent operation Grant remains DB-derived and bound to operation,
generation, storageKey, action, helper type, release digest, launch ticket and
process/session lifetime. IPC does not replace Grant. Runtime DB constraints
remain `NOT VERIFIED`.

### 11.2 Signed Release

```text
Independent regression: PASS / DESIGN
Runtime: NOT VERIFIED
```

Fixed release/path/arguments/environment/cwd, manifest, signature/digest and
WDAC remain. Process Launch Authority does not make arbitrary executable
selection part of its RPC contract.

### 11.3 Evidence

```text
Independent regression: PASS / DESIGN
DB persistence: NOT IMPLEMENTED
```

Launch evidence, Helper Effect and Supervisor Verification are separate.
Supervisor still independently observes OS facts; Helper self-report is not
accepted as the sole proof. Finalization requires matching Operation/Grant and
dual business evidence.

### 11.4 DELETED

```text
Independent regression: PASS / DESIGN
```

`DELETED` remains `Controlled Namespace Removal Completed` and does not imply
physical media erasure or external handle closure.

## 12. 44 Attack Paths

### 12.1 R4-S6 original 20

| ID | Independent outcome |
|---:|---|
| 1 | Binding handle copy: single Invoke + per-call process tuple; design closed, runtime pending |
| 2 | Process handle copy: does not change later ClientPID; process object mismatch; design closed |
| 3 | Credential delegation: same SID/new PID fails; same-process injection is TCB |
| 4 | Reused binding: manager wrapper rechecks; design closed |
| 5 | Forged payload PID/SID: payload identity ignored; design closed |
| 6 | Client exit/old handle: held handle signaled, session revoked; design closed |
| 7 | PID reuse: generation/creation/process handle; design closed |
| 8 | Creation mismatch: deny; design closed |
| 9 | Token/SID/principal mismatch: exact class check; design closed |
| 10 | Wrong impersonation token: V1 no business impersonation; fallback quarantine; design closed |
| 11 | Supervisor restart replay: epoch/session/Grant invalidation; design closed |
| 12 | Helper pause + lease expiry: preassigned anonymous Job + helper no Job handle; design closed, runtime pending |
| 13 | Helper exit but external write handle: no child/no dup/exit proof/unknown gate; design closed, runtime pending |
| 14 | Release replacement: signed release/WDAC/digest; design closed, runtime pending |
| 15 | Grant duplicate consume: DB CAS/unique; design closed, DB pending |
| 16 | Wrong storageKey: DB target/ownership; design closed |
| 17 | Supervisor direct Storage: no write rights; Owner Rights; design closed, ACL pending |
| 18 | Publisher/Sealer overlap: Publisher exit before Sealer Grant; design closed, runtime pending |
| 19 | Cleanup/new generation race: generation/parent identity/separate namespace; design closed |
| 20 | Evidence mismatch: dual evidence and no early APPLIED; design closed, DB pending |

### 12.2 R4-S7 additional 24

| ID | Attack | Independent conclusion |
|---:|---|---|
| 1 | Manager omits authorization | structural single manager; `DESIGN CLOSED` |
| 2 | Internal manager call bypass | internal dispatcher non-RPC; `DESIGN CLOSED` |
| 3 | Identity context replacement | immutable call evidence/held handles; `DESIGN CLOSED` |
| 4 | Impersonation failure continues | V1 no business impersonation; fallback denies; `DESIGN CLOSED` |
| 5 | Revert failure leaks thread token | quarantine rule; `DESIGN CLOSED`, runtime pending |
| 6 | Concurrent context contamination | per-call synchronous context; `DESIGN CLOSED` |
| 7 | Helper runs before Job | suspended + JOB_LIST/assign + resume gate; `DESIGN CLOSED`, runtime pending |
| 8 | Helper retains Job handle | Helper no Job handle; `DESIGN CLOSED`, transfer pending |
| 9 | Helper copies Job handle | no Job DACL/name access; `DESIGN CLOSED`, runtime pending |
| 10 | Named Job squat | anonymous Job; `DESIGN CLOSED` |
| 11 | Assign failure still resumes | commit/IsProcessInJob gate; `DESIGN CLOSED`, runtime pending |
| 12 | WMI Job-outside process | restricted SID/no-child/WDAC; `NOT VERIFIED` |
| 13 | SCM/other proxy creates process | restricted access check; `NOT VERIFIED` |
| 14 | Guardian implicit WRITE_DAC | Owner Rights deny; `DESIGN CLOSED`, ACL pending |
| 15 | Owner Rights misconfiguration | readback/AccessCheck; `DESIGN CLOSED`, runtime pending |
| 16 | Parent replacement | per-object parent deny/FileId; `DESIGN CLOSED`, runtime pending |
| 17 | Existing write handle | exit/no child/no dup/UNKNOWN; `DESIGN CLOSED`, runtime pending |
| 18 | Sealer handoff incomplete | state machine/exit proof; `DESIGN CLOSED`, runtime pending |
| 19 | Supervisor re-grants write | no write/DAC rights; `DESIGN CLOSED`, ACL pending |
| 20 | DB SEALED before OS proof | dual Evidence/finalization gate; `DESIGN CLOSED`, DB pending |
| 21 | Cleanup/SEALED concurrency | separate operations/generation; `DESIGN CLOSED` |
| 22 | DACL failure but Evidence success | Supervisor readback/evidence mismatch; `DESIGN CLOSED`, DB pending |
| 23 | Wrong process lifetime in Evidence | session/epoch/launch/process binding; `DESIGN CLOSED` |
| 24 | Recovery trusts old Job/Session | held handle/epoch/exit proof/UNKNOWN; `DESIGN CLOSED`, runtime pending |

### 12.3 Additional adversarial paths

#### X1 Restricting SID omitted from a file ACL

If a helper uses `CreateRestrictedToken` but a granted file ACL lists only the
normal helper account SID, Windows performs a second access check against the
restricting SID. The helper's operation is denied. This is fail-closed, not an
authorization bypass, but it means the ACL design must explicitly add the
unique restricting SID as an authorized trustee wherever the helper is
legitimately allowed. S7 references the restricting SID requirement; the
implementation matrix must make it explicit for every Storage/Release/RPC ACL.

Status: `NOT VERIFIED / HARDENING REQUIREMENT`, not P1.

#### X2 Helper session loss while process remains alive

S7 defines `SESSION_CLOSE` and Session states, but does not explicitly state
that closing/revoking a Helper Authority Session closes the Supervisor's Job
handle. A helper may have local file work after the RPC call. The design must
state the policy:

```text
normal helper exit -> Supervisor observes process exit -> close Job handle
unexpected session loss -> close/terminate Job -> no local work continuation
```

Without this, a Helper whose session is marked stale but whose process is still
running can continue until it chooses to exit. This is a lifecycle ambiguity,
not a new identity bypass; currently `NOT VERIFIED`.

#### X3 Process Launch Authority credential concentration

One Launch Authority can read/provision all four helper logon credentials and
can create all four helper identities. This is an explicit new TCB. A
compromise is not defended by the helper restriction itself. It must be
documented as TCB-wide impact and minimized (separate credential scopes or
per-helper launchers considered in a later authorization review).

Status: `NOT VERIFIED / TCB RISK`, not P1 until a concrete bypass is
implemented and reproduced.

## 13. P2 / P3 Final Independent Findings

### S7 P2

| ID | Independent status |
|---|---|
| R4S6-P2-01 | `DESIGN CLOSED` |
| R4S6-P2-02 | `DESIGN CLOSED` |
| R4S6-P2-03 | `NOT VERIFIED` |
| R4S6-P2-04 | `NOT VERIFIED` |
| R4S6-P2-05 | `NOT VERIFIED` |
| R4S6-P2-06 | `NOT VERIFIED` |
| R4S6-P2-07 | `DESIGN CLOSED` |
| R4S6-P2-08 | `NOT VERIFIED` |
| R4S6-P2-09 | `NOT VERIFIED` |

### Additional warnings

| ID | Finding | Status |
|---|---|---|
| `R4S8-P2-01` | Every helper allowed ACL must explicitly include both normal and restricting SID; implementation matrix not yet realized | `NOT VERIFIED` |
| `R4S8-P2-02` | Helper session loss/close does not explicitly mandate Supervisor Job closure | `NOT VERIFIED` |
| `R4S8-P2-03` | One Launch Authority holds all helper logon credentials (TCB concentration) | `NOT VERIFIED` |
| `R4S7-P3-01` | RAII/CloseHandle for all token/process/Job/SD handles | `DESIGN CLOSED / IMPLEMENTATION NOT PRESENT` |

## 14. TCB Independent Review

| Component | Trust / risk | Conclusion |
|---|---|---|
| Windows Kernel/SRM | all object/token/ACL semantics | TCB; runtime not verified |
| RPC runtime | ncalrpc/call attributes/auth | TCB; API contract documented |
| Authority Supervisor | RPC, Grant coordination, read verification, final Job holder | TCB; no direct Storage write |
| Process Launch Authority | helper credentials, fixed launch, Job creation | new TCB concentration; no direct Storage, but can launch restricted helpers |
| Helper restricted token | unique restrict SID, no privileges | TCB per helper; provisioning/runtime not verified |
| Canonical Owner group | non-login group owner | owner implicit rights blocked by Owner Rights by design |
| Owner Rights/DACL | exact ACL and AccessCheck | runtime not verified |
| Job Object | final-handle kill | design closed; runtime not verified |
| SCM | fixed own-process services | config/runtime not verified |
| Signed Release/WDAC | executable/dependency integrity | runtime not verified |
| DB Grant | target/action authority | Schema/roles not implemented |
| Evidence | launch/helper/supervisor evidence | DB persistence not implemented |
| Release Trust Root | signing/revocation | not configured |
| Recovery Coordinator | no Job handle in V1 | human/authorized recovery only |

The Launch Authority is a real TCB concentration but does not directly receive
Storage write rights. Any compromise of the authority is outside the design
guarantee and must be treated as a security incident, not as a hidden bypass.

## 15. Windows Runtime Verification Gaps

Not executed:

```text
RPC call frequency/ClientPID: NOT VERIFIED
Authz context/process token/principal mapping: NOT VERIFIED
Process DACL and OpenProcess cross-SID: NOT VERIFIED
CreateProcessAsUser + restricted token provisioning: NOT VERIFIED
JOB_LIST/Assign/Resume/handle transfer/crash timing: NOT VERIFIED
KILL_ON_JOB_CLOSE final-handle behavior: NOT VERIFIED
WMI/SCM/Task Scheduler/COM Job-outside paths: NOT VERIFIED
WDAC/Code Integrity: NOT VERIFIED
Owner Rights/protected DACL/AccessCheck: NOT VERIFIED
Existing file handle closure and share mode: NOT VERIFIED
NTFS FileId/link count/delete pending/directory durability: NOT VERIFIED
PostgreSQL Grant/Evidence/role/Trigger behavior: NOT VERIFIED
A4/A6 startup/build/manifest regression: NOT EXECUTED
```

These are implementation blockers to production, not permission to weaken the
design.

## 16. Linux Scope

```text
Linux V1:
OUT OF SCOPE / NOT IMPLEMENTED / NOT VERIFIED
```

Windows-only design does not establish a Windows deployment topology and does
not authorize Linux assumptions. Linux re-entry requires a separate design,
implementation, review and real-machine verification.

## 17. R4 Design Freeze Recommendation

```text
DESIGN FREEZE RECOMMENDATION:
APPROVED
```

Conditions:

- P1-1/P1-2/P1-3 remain design-closed as above;
- all 19 operations must be generated/registered exactly as one manager per
  interface;
- every runtime claim remains gated on Windows real-machine proof;
- every allowed helper ACL must include the unique restricting SID;
- helper session loss must close the Supervisor Job handle;
- P2-03/04/05/06/08/09 and R4S8-P2-01..03 remain `NOT VERIFIED` until
  implementation/validation.

This is a design-freeze recommendation only. It is not R4-A/R4-B, Schema v2,
source implementation, Git commit or deployment authorization.

## 18. Worktree Before / After

Before:

```text
Tracked modified: 26
Untracked files: 157
Staged: 0
Deleted: 0
```

After（仅新增本报告）:

```text
Tracked modified: 26
Untracked files: 158
Staged: 0
Deleted: 0
```

本阶段未修改：

- R4-S1 至 R4-S7 历史文件
- FZ、ST、DBTP
- Prisma Schema/Migration
- Web/Worker/Storage 源码
- `next-env.d.ts` / `tsconfig.tsbuildinfo`
- `.next` / Worker `dist`
- Git index

本报告 SHA-256 在冻结后外部计算并交付；不把自身哈希写回自身。

## 19. Final Fields

```text
A7.20-R4-S8:
PASS WITH WARNINGS

R4S7 P1-1 RPC Per-call Authorization:
DESIGN CLOSED / RUNTIME NOT VERIFIED

R4S7 P1-2 Job Object Lifecycle:
DESIGN CLOSED / RUNTIME NOT VERIFIED

R4S7 P1-3 Canonical SEALED:
DESIGN CLOSED / RUNTIME NOT VERIFIED

RPC Public Managers:
2 / COVERED

Authority Operations:
13 / 13 COVERED

Launch Operations:
6 / 6 COVERED

New unresolved P1:
0

R4-S6 P2:
DESIGN CLOSED: 01,02,07
NOT VERIFIED: 03,04,05,06,08,09

R4-S4 P2:
PRESERVED / NO SILENT PASS

Grant Regression:
PASS / DESIGN

Signed Release Regression:
PASS / DESIGN / RUNTIME NOT VERIFIED

Evidence Regression:
PASS / DESIGN / DB NOT IMPLEMENTED

DELETED Regression:
PASS / DESIGN

44 Attack Paths:
REVIEWED

Windows Runtime:
NOT VERIFIED

Linux:
OUT OF SCOPE / NOT IMPLEMENTED / NOT VERIFIED

R4 Design Freeze:
APPROVED

R4-S9 / R4-A / R4-B:
NOT AUTHORIZED

SCHEMA V2 / DB / STORAGE / ACL / CLEANUP / RECOVERY:
NOT EXECUTED / NOT AUTHORIZED

GIT WRITE / COMMIT / DEPLOYMENT:
NOT EXECUTED / NOT AUTHORIZED

NEXT PHASE:
NOT AUTHORIZED
```
