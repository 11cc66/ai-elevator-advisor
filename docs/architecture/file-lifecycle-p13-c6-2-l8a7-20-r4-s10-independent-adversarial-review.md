# P1-3 C-6.2-L8-A7.20-R4-S10 Independent Adversarial Review

## 0. 审查结论

```text
A7.20-R4-S10:
PASS WITH WARNINGS

W1 Restricted Token / Double Access Check:
DESIGN CLOSED WITH CONDITIONS

W2 Session / Job Revoke:
DESIGN CLOSED WITH CONDITIONS

W3 Per-helper-type Launch Authority:
DESIGN CLOSED WITH CONDITIONS

New unresolved P1:
0

Option B:
RECOMMENDED FOR APPROVAL / HUMAN DECISION REQUIRED

R4 Design Freeze:
MAINTAINED APPROVED FROM R4-S8

Windows Runtime:
NOT VERIFIED
```

本阶段独立审查，不沿用 R4-S9 的 `PASS WITH WARNINGS` 自评。R4-S9 三个警告
的核心设计方向成立，且没有发现新的设计级 P1；但仍有三个实现前必须固定
的 P2 条件：

1. restricted-token 双 access check 必须只适用于使用 restricting SID 的
   Helper；Web/Worker/Supervisor 的非 restricted token 需要明确的单检查
   规则，不能用一条“所有资源都要 normal + restricting”规则造成错误授权
   或错误拒绝。
2. W2 的 `TerminateProcess` fallback 必须显式要求 Supervisor 的 Helper
   process handle 具备 `PROCESS_TERMINATE`，否则 Job close 失败时无法执行
   声明的 fallback；仍然只能进入 UNKNOWN/QUARANTINED。
3. S9 新增 Helper Session close -> Job close 语义后，S7 的 operation
   side-effect matrix 中 `SESSION_CLOSE` 的“无文件系统副作用”描述需要
   在实施前同步为“Helper 分类产生 Job/process termination”，避免实现者
   按旧的 matrix 省略终止动作。

这些是警告级实现/设计一致性问题，不构成新的 P1。

## 1. 基线和输入

```text
Repository: D:\thinkbook\Desktop\jieya
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 26
Untracked files: 160
Staged: 0
Deleted: 0
```

R4-S9 输入哈希核验：

| 文件 | SHA-256 |
|---|---|
| R4-S9 Design | `196F192CD9AE0496A4CDB0D0CA9CD4F2CA3B89778CEB4CF009FB8668D5AA059A` |
| R4-S9 Readiness Report | `FC369C2532A7C49C7C4D5829007B98FFA198F5CA6FDDB1A572957B5D66B92F90` |
| R4-S8 Review | `4BEA7796B84F7EB286E096FED7901E266287ED18EA30E5DDC5EC9447F1114F7B` |
| R4-S7 Design | `6074131D7E8B4EF37B5AE6F9AD1733C012B2062E479EE9395A0EB4212CEECC0A` |
| R4-S7 Report | `C0B26DA00F2F662C77D6A439E8EB8E45D54E1A78B509C0C7234D2CCAD2429BD2` |

R4-S9 两份输入哈希与审查授权提供的预期值一致。目标 R4-S10 报告开始前不存在。

受保护文件：

| 文件 | SHA-256 |
|---|---|
| FZ | `E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705` |
| ST | `5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586` |
| DBTP | `FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7` |
| Schema | `78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299` |
| `next-env.d.ts` | `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC` |
| `tsconfig.tsbuildinfo` | `21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520` |

## 2. Skills 与材料

实际读取并应用：

- `$project-architecture`
- `$prisma-db-safety`
- `$security-audit`
- `$testing-and-verification`
- `$file-lifecycle`

完整复核：

- R4-S7 Design/Report
- R4-S8 Review
- R4-S9 Design/Report
- FZ、ST、DBTP
- 相关 Authority、Helper、RPC、Job、Grant、Evidence、SEALED、DELETED、
  Recovery 设计
- 当前 Schema/Migration/Storage/Worker/Capability 静态状态

## 3. 官方 API 依据

查询日期：`2026-11-20`。

| 官方资料 | 已确认语义 | 未验证边界 |
|---|---|---|
| [Restricted Tokens](https://learn.microsoft.com/en-us/windows/win32/secauthz/restricted-tokens) | 两次 access check；normal enabled SIDs 与 restricting SIDs 均需允许 | 目标 Windows 实际组合行为 |
| [`CreateRestrictedToken`](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-createrestrictedtoken) | 可删除 privileges、设置 restricting SIDs；`DISABLE_MAX_PRIVILEGE` 仅保留 SeChangeNotifyPrivilege | token 创建和进程启动是否成功 |
| [SID Attributes](https://learn.microsoft.com/en-us/windows/win32/secauthz/sid-attributes-in-an-access-token) | deny-only SID 只参与 deny，不能用于 allow | 实际 token groups |
| [`CreateProcessAsUser`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessasusera) | 使用 primary token 创建进程；可能需要 quota/assign token privilege | 四个 Authority 的实际 privilege |
| [`DuplicateTokenEx`](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-duplicatetokenex) | 可产生 primary token | token 访问和 session |
| [Process creation flags](https://learn.microsoft.com/en-us/windows/win32/procthread/process-creation-flags) | `CREATE_SUSPENDED` 在 Resume 前不运行 primary thread | 目标 Windows 的 loader/initialization 细节 |
| [`UpdateProcThreadAttribute`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute) | `JOB_LIST` 支持创建时指定 Job | 版本、nested Job |
| [Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects) | child 默认关联；WMI 创建不默认关联 | 代理启动的实际覆盖 |
| [Job limits](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_limit_information) | `KILL_ON_JOB_CLOSE` 在最后一个 handle 关闭时触发 | final handle 的真实时序 |
| [`TerminateProcess`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-terminateprocess) | 需要 `PROCESS_TERMINATE` | handle 权限未实现时 fallback 无效 |
| [`WaitForSingleObject`](https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-waitforsingleobject) | 可等待 process handle signaled | WAIT_TIMEOUT 必须保持 UNKNOWN |
| [`DuplicateHandle`](https://learn.microsoft.com/en-us/windows/win32/api/handleapi/nf-handleapi-duplicatehandle) | 跨进程复制需要 `PROCESS_DUP_HANDLE` | 四 Authority 的 handle transfer |
| [`LogonUserW`](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-logonuserw) | 使用 credential 建立 logon token | credential store/rotation |
| [`RpcServerInqCallAttributesW`](https://learn.microsoft.com/en-us/windows/win32/api/rpcasync/nf-rpcasync-rpcserverinqcallattributesw) | 获取当前 RPC call 属性 | 实际 ClientPID/principal |
| [`RpcImpersonateClient`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdce/nf-rpcdce-rpcimpersonateclient) | V1 业务路径不使用；fallback 必须安全 revert | fallback 实机 |
| [Owner Rights](https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/understand-special-identities-groups) | `S-1-3-4` 可阻断 owner 隐式 READ_CONTROL/WRITE_DAC | ACL 实际 SDDL |
| [`AccessCheck`](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-accesscheck) | 以 token/SD/access mask 判定 | both-check 组合 |
| [`SetSecurityInfo`](https://learn.microsoft.com/en-us/windows/win32/api/aclapi/nf-aclapi-setsecurityinfo) | owner/DACL/protected DACL | 旧 handle 不会自动撤销 |
| [WDAC](https://learn.microsoft.com/en-us/windows/security/application-security/application-control/windows-defender-application-control/wdac) | 应用控制可限制加载代码 | policy/runtime |
| [PostgreSQL SECURITY DEFINER](https://www.postgresql.org/docs/current/sql-createfunction.html) | 函数以 owner 身份执行，可设定 search_path | Schema/role/DB runtime |

## 4. W1 审查

### 4.1 Token 语义

W1 正确区分：

- normal User/group SIDs；
- enabled SIDs；
- restricting SIDs；
- deny-only SIDs；
- Service SID；
- logon identity；
- privileges。

Restricted token 的系统 access check 是两次：

```text
normal enabled SID check
+ restricting SID check
```

只有两方都允许才授予权限。W1 的 Helper 资源 Allow 必须同时包含 normal
helper group 与 unique restricting SID。仅一个匹配时 fail-closed。

### 4.2 Identity Matrix

| Helper | Normal identity | Normal group | Restricting SID | Scope |
|---|---|---|---|---|
| Staging Writer | `N_ST` | `G_ST` | `R_ST` | staging |
| Publisher | `N_PUB` | `G_PUB` | `R_PUB` | staging read/new canonical |
| Sealer | `N_SEAL` | `G_SEAL` | `R_SEAL` | exact target SD |
| Cleanup | `N_CLN` | `G_CLN` | `R_CLN` | staging removal |

Independent assessment:

- four identities are logically distinct;
- no Helper shares another Helper's normal/restricting SID;
- no Helper receives its own `WRITE_DAC/WRITE_OWNER`;
- Sealer receives only exact-target SD rights;
- Cleanup has no canonical access;
- Publisher has no canonical delete/DAC rights;
- Staging Writer has no canonical access;
- Release/config read ACLs require both capability checks;
- Credential store has no Helper access.

### 4.3 P2 condition: scope of double check

S9's resource matrix includes Web/Worker and Supervisor rows. Double access
check is only meaningful when the caller token has restricting SIDs. Web/Worker
and possibly Supervisor may be normal service tokens without restricting SIDs.

Required clarification:

```text
Restricted Helper resource:
  normal SID check AND restricting SID check

Non-restricted service resource:
  normal token check only
  must never grant Helper resource access merely because it is normal
```

This is a P2 implementation clarification, not a P1 authorization bypass. It
must be fixed before ACL implementation.

### 4.4 W1 verdict

```text
DESIGN CLOSED WITH CONDITIONS
WINDOWS RUNTIME NOT VERIFIED
```

The core double-check model is correct. The implementation must explicitly
scope it by token type and must not make broad ACEs to satisfy the second
check.

## 5. W2 审查

### 5.1 Session / Job binding

The design correctly binds:

```text
sessionId + epoch + Helper identity
+ process handle/creation time
+ Job identity
+ Grant/Operation
+ Evidence
```

The Supervisor owns the final Job/process handles after launch commit. Helper
never holds Job handle.

### 5.2 Revoke ordering

Accepted design:

```text
CAS Revoke
-> stop new RPC operations
-> mark/revoke Grant
-> close Supervisor Job handle
-> wait/terminate
-> process signaled/exit
-> Evidence reconciliation
-> CLOSED or UNKNOWN/QUARANTINED
```

The distinction between RPC close, Job close, process exit and Evidence
reconciliation is correct. DB state or lease expiration cannot imply OS
termination.

### 5.3 P2 condition: terminate fallback

S9 says a timeout can use `TerminateProcess`, but the inherited R4-S7 process
handle matrix only clearly requires query/synchronize for Supervisor. The
implementation must explicitly grant/open the Helper process with
`PROCESS_TERMINATE` and hold the original process handle; otherwise the fallback
is not executable. It must:

- never use a reused PID;
- use the held process handle;
- verify creation time;
- wait for `WAIT_OBJECT_0`;
- keep `UNKNOWN/QUARANTINED` on timeout/failure.

This is P2, not P1, because failure remains fail-closed and no normal success is
claimed without process exit.

### 5.4 P2 condition: operation matrix synchronization

R4-S7's table describes `SESSION_CLOSE` as session update with no filesystem
side effect. S9 adds Job termination for Helper Session Revoke. The final
implementation matrix must mark:

```text
HELPER SESSION_CLOSE/REVOKE -> process/Job termination side effect
WEB/WORKER SESSION_CLOSE -> no Job side effect
LAUNCH_SESSION_CLOSE -> abort only before commit
```

This is a documentation/implementation consistency P2.

### 5.5 Race analysis

| Race | Result |
|---|---|
| Revoke vs new operation | Revoke CAS rejects new calls; active operation must terminate |
| Revoke vs Grant reserve | DB CAS decides; reserved work becomes UNKNOWN if no execution proof |
| Revoke vs Publisher write | Job close/terminate; target retained; no SEALED |
| Revoke vs Sealer DACL | terminate; do not accept self-reported success |
| Helper exited, Evidence missing | exit proof + EVIDENCE_RECONCILIATION, no APPLIED |
| Supervisor crash before Job close | final handle/OS cleanup; new session cannot reuse old |
| Supervisor crash after Job close before wait | no second close; inspect process/launch evidence, UNKNOWN if not provable |
| Concurrent revoke | session CAS single winner; idempotent others |
| Paused/no response | close Job; wait; TerminateProcess fallback |
| DB lease expiry while Helper runs | revoke OS lifecycle; lease alone is not proof |
| RPC disconnect but process alive | treat stale session; close/terminate as policy |
| PID reuse | held process handle/creation time prevents wrong process termination |

### 5.6 W2 verdict

```text
DESIGN CLOSED WITH CONDITIONS
WINDOWS RUNTIME NOT VERIFIED
```

The lifecycle is fail-closed if the process-handle terminate fallback and table
semantics are fixed. Without those P2 fixes, a failed Job close can only remain
UNKNOWN; it must not be reported CLOSED.

## 6. W3 审查

### 6.1 Option B structure

Selected:

```text
Staging Writer Launch Authority
Publisher Launch Authority
Sealer Launch Authority
Cleanup Launch Authority
```

Each has independent:

- OS service identity;
- logon credential;
- protected credential scope;
- DB launch-ticket role;
- RPC endpoint;
- fixed helper release/token creation;
- session/epoch;
- Job creation and source handle transfer.

The Supervisor remains the only common caller and final Job owner.

### 6.2 Identity matrix

| Authority | OS identity | Credential | DB role | Endpoint | Helper | Other credentials |
|---|---|---|---|---|---|---|
| Staging | `L_ST` | `C_ST` | `DB_ST` | `E_ST` | Staging only | no |
| Publisher | `L_PUB` | `C_PUB` | `DB_PUB` | `E_PUB` | Publisher only | no |
| Sealer | `L_SEAL` | `C_SEAL` | `DB_SEAL` | `E_SEAL` | Sealer only | no |
| Cleanup | `L_CLN` | `C_CLN` | `DB_CLN` | `E_CLN` | Cleanup only | no |

The symbolic names must be backed by real SIDs/ACLs and service DACLs in the
future isolated implementation.

### 6.3 Horizontal movement

If Publisher Authority is compromised:

- it can read Publisher credential and request Publisher launch only;
- it cannot call Staging/Sealer/Cleanup authority endpoints;
- it cannot read other credential scopes;
- it cannot modify other Helper releases;
- it cannot close another Session's Job;
- it cannot issue a Grant for another Helper type;
- it can attempt Publisher actions within its own helper/Grant scope.

The same isolation applies to each authority. The Supervisor remains a shared
TCB and can call all four endpoints; this is explicit and does not become a
credential concentration.

### 6.4 Shared TCB

Common TCB:

- Windows Kernel/SRM;
- RPC runtime;
- Supervisor binary/identity;
- shared release verification code;
- Windows SCM/governance;
- deploy administrator.

Per-authority TCB:

- each Launch Authority binary/identity;
- each credential store scope;
- each Helper identity and release.

No common `Shared Process Launcher` is created by Option B. If implementation
introduces one later, it immediately becomes a new common TCB and needs a
separate review.

### 6.5 W3 verdict

```text
DESIGN CLOSED WITH CONDITIONS
OPTION B RECOMMENDED
HUMAN DECISION REQUIRED FOR SERVICE TOPOLOGY
WINDOWS RUNTIME NOT VERIFIED
```

Option B materially reduces single-authority credential blast radius. It adds
four service/endpoint operational surfaces, so human topology approval is
required before implementation, not implied by this review.

## 7. Six NOT VERIFIED P2

| ID | S9 status | Independent status | Decision |
|---|---|---|---|
| P2-03 RPC/process DACL | READY | `READY FOR ISOLATED RUNTIME VALIDATION` | matrix sufficient, Windows ACL still test |
| P2-04 Named Job | READY | `READY FOR ISOLATED RUNTIME VALIDATION` | anonymous Job design sufficient, runtime handle/crash test |
| P2-05 WMI/out-of-Job | NOT VERIFIED | `NOT VERIFIED` | needs Windows negative testing |
| P2-06 old file handles | READY | `READY FOR ISOLATED RUNTIME VALIDATION` | one-shot/exit/unknown gate, actual handle test |
| P2-08 SCM/own-process | READY | `READY FOR ISOLATED RUNTIME VALIDATION` | per-type own-process design, no service PID trust |
| P2-09 Grant/Evidence Schema | NOT VERIFIED | `NOT VERIFIED` | Schema/Trigger/role/DB work absent |

The S9 `READY` label is not upgraded to PASS. P2-05 and P2-09 remain blockers
to the respective runtime/DB phases, not to the warning design itself.

## 8. R4-S4 Historical P2

| ID | Status | Review result |
|---|---|---|
| P2-01 Linux socket | `OUT OF SCOPE` | Windows-only remains |
| P2-02 Named Pipe | `OUT OF SCOPE` | RPC replacement, runtime ACL remains |
| P2-03 Grant SECURITY DEFINER | `DESIGN CLOSED` | no DB implementation proof |
| P2-04 HMAC lifecycle | `OUT OF SCOPE` | no bearer identity |
| P2-05 WDAC | `NOT VERIFIED` | no runtime policy |
| P2-06 Helper DB credential | `DESIGN CLOSED` | provisioning not verified |
| P2-07 Delete Pending/durability | `NOT VERIFIED` | NTFS runtime |
| P2-08 v1/v2 Drain | `NOT VERIFIED` | no process/ACL evidence |

## 9. R4-A / R4-B Readiness Gate Review

### 9.1 R4-A gate

R4-A can be technically scoped to:

- IDL/two public managers;
- `AuthorizeCurrentCall`;
- process/RPC identity probes;
- four per-type Launch Authority skeletons;
- restricted-token construction;
- Job preassociation/handle transfer;
- Session revoke/termination;
- isolated test accounts/groups and temporary local namespaces.

R4-A does not need production DB or real Canonical Storage. It may need a
minimal test metadata mock or isolated test schema for launch tickets/DB role
behavior. That dependency must be declared explicitly; it cannot silently use
the project test DB or production DB.

Required gates:

```text
A-DG: S9 warning design accepted
A-IG: source/service/account scope separately authorized
A-RG: isolated Windows token/ACL/Job/session tests
A-IRG: independent review
```

### 9.2 R4-B gate

R4-B includes:

- Schema/Grant/Evidence;
- Storage publication and sealing;
- Web/Worker integration;
- recovery/cleanup.

Required gates:

```text
B-DG: R4-A Runtime and Independent Review pass
B-DBG: schema/role/trigger design separately reviewed
B-IG: DB/Storage/Service changes separately authorized
B-RG: isolated DB + Storage + Windows integration tests
B-IRG: independent adversarial review
Release Gate: separate human approval
```

R4-B must not start before R4-A's runtime assumptions (restricted token, Job
handle, Session revoke) are independently closed or explicitly accepted as
residual implementation risk.

### 9.3 Gate conclusion

The R4-A/R4-B split is directionally safe but incomplete until the following
P2 clarifications are added:

- non-restricted token rules;
- process `PROCESS_TERMINATE` fallback;
- S7 operation side-effect matrix synchronization;
- explicit R4-A minimal test metadata/DB mock decision.

No R4-A/R4-B authorization is granted.

## 10. New Findings

### P1

None.

### P2

| ID | Finding | Status |
|---|---|---|
| `R4S10-P2-01` | Double AccessCheck scope for non-restricted Web/Worker/Supervisor tokens is ambiguous | `OPEN` |
| `R4S10-P2-02` | W2 `TerminateProcess` fallback requires explicit `PROCESS_TERMINATE` handle rights | `OPEN` |
| `R4S10-P2-03` | S7 operation matrix says `SESSION_CLOSE` has no FS side effect; S9 requires Helper Job termination | `OPEN` |
| `R4S10-P2-04` | R4-A needs an explicitly isolated metadata/DB mock or test schema for launch tickets | `OPEN` |

All four are non-P1 because the current design fails closed or the issue is
implementation clarity. They must be closed before the relevant implementation
gate.

### P3

- four new Launch Authority UUIDs/endpoints must be pinned in IDL;
- test-account/group names need exact CAS/SID fixtures;
- per-type authority failure/restart/reconnect needs operator runbook;
- test DB/Storage fixtures should have unique names and explicit guards.

## 11. TCB Conclusion

```text
Windows Kernel/SRM: TCB
Windows RPC runtime: TCB
Supervisor: shared TCB, no direct Storage write
Four per-type Launch Authorities: four separate TCBs with one credential each
Helper restricted tokens: per-type TCB / not runtime verified
Canonical Owner Rights/DACL: design closed / ACL runtime not verified
Job Object: design closed / handle runtime not verified
DB Grant/Evidence: design only / DB not implemented
Release Trust Root: not configured
Human administrator: outside normal guarantee
```

Option B reduces credential blast radius but does not eliminate a compromised
Supervisor or Host Administrator. Those remain explicit TCB boundaries.

## 12. Windows Runtime Gaps

```text
restricted token normal/restricted AccessCheck: NOT VERIFIED
four Launch Authority credential isolation: NOT VERIFIED
service/helper SID and ACL combinations: NOT VERIFIED
CREATE_SUSPENDED/JOB_LIST/assign/resume: NOT VERIFIED
Job final-handle termination and crash timing: NOT VERIFIED
TerminateProcess fallback and process handle rights: NOT VERIFIED
WMI/SCM/Task Scheduler/COM outside-Job attempts: NOT VERIFIED
Owner Rights/protected DACL/old handles: NOT VERIFIED
WDAC/Code Integrity: NOT VERIFIED
Grant/Evidence schema and transaction behavior: NOT VERIFIED
```

## 13. Two-pass Review

### Pass 1 — Architecture/threat

- W1 normal/restricted identity model independently checked;
- W2 revoke/Job/process/Evidence separation checked;
- W3 four-authority credential isolation checked;
- no new P1;
- four P2 conditions recorded.

Result: `PASS WITH WARNINGS`.

### Pass 2 — Concurrency/OS/cross-component

- Session CAS and Job final handle checked;
- process exit vs Job close vs Evidence reconciliation checked;
- non-restricted token scope identified;
- `PROCESS_TERMINATE` fallback identified;
- S7/S9 operation matrix synchronization identified;
- R4-A dependency on test metadata/DB mock identified;
- no runtime PASS claimed.

Result: `INTERNAL CONSISTENCY PASS WITH WARNINGS`.

## 14. Worktree Before / After

Before:

```text
Tracked modified: 26
Untracked files: 160
Staged: 0
Deleted: 0
```

After（仅新增本报告）:

```text
Tracked modified: 26
Untracked files: 161
Staged: 0
Deleted: 0
```

未修改 R4-S1 至 R4-S9 历史文件、FZ/ST/DBTP、Schema/Migration、源码、配置、
ACL、Storage 或 Git index。

本报告 SHA-256 在冻结后外部计算。

## 15. Final Fields

```text
A7.20-R4-S10:
PASS WITH WARNINGS

W1 Restricted Token / Double Access Check:
DESIGN CLOSED WITH CONDITIONS

W2 Session / Job Revoke:
DESIGN CLOSED WITH CONDITIONS

W3 Credential Isolation:
DESIGN CLOSED WITH CONDITIONS

Option B Per-type Launch Authority:
RECOMMENDED

New unresolved P1:
0

New P2:
4 (R4S10-P2-01..04)

Six R4-S8 NOT VERIFIED P2:
P2-03/P2-04/P2-06/P2-08 READY FOR ISOLATED RUNTIME VALIDATION
P2-05/P2-09 NOT VERIFIED

R4-S7/S8 Core P1:
NO REGRESSION

R4-A:
CONDITIONALLY READY FOR SEPARATE AUTHORIZATION

R4-B:
NOT READY / DEPENDS ON R4-A AND DB/STORAGE AUTHORIZATION

R4 Design Freeze:
MAINTAINED APPROVED FROM R4-S8

Human risk acceptance:
NONE REQUESTED

Human topology decision:
REQUIRED BEFORE FOUR-AUTHORITY IMPLEMENTATION

Windows Runtime:
NOT VERIFIED

R4-A / R4-B:
NOT AUTHORIZED

Implementation / Database / Storage / ACL / Cleanup / Git Commit / Deployment:
NOT AUTHORIZED

NEXT PHASE:
NOT AUTHORIZED
```
