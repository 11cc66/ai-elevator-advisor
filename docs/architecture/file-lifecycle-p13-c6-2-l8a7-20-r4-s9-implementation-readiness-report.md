# P1-3 C-6.2-L8-A7.20-R4-S9 Implementation Readiness Report

## 1. Executive Summary

```text
A7.20-R4-S9:
PASS WITH WARNINGS

W1 Restricted Token / Double Access Check:
DESIGN CLOSED / WINDOWS RUNTIME NOT VERIFIED

W2 Session / Job Lifecycle:
DESIGN CLOSED / WINDOWS RUNTIME NOT VERIFIED

W3 Credential Isolation:
DESIGN CLOSED / PER-TYPE LAUNCH AUTHORITY SELECTED

R4-S7/S8 three P1:
NO REGRESSION

New unresolved P1:
0

R4 Design Freeze:
MAINTAINED APPROVED FROM R4-S8

High-risk risk acceptance:
NOT REQUIRED

Human decision required:
YES — approve four-service Launch Authority topology before implementation
```

本轮完成三项警告设计整改和 Track A–E 的实施准备计划。没有修改源码、
Schema、Migration、配置、ACL、Owner、Windows Service、Job Object 或
Storage。

## 2. Baseline

```text
Repository: D:\thinkbook\Desktop\jieya
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 26
Untracked files: 158
Staged: 0
Deleted: 0
```

开始前两份 R4-S9 目标文件均不存在。R4-S8 报告 SHA-256 为：

```text
4BEA7796B84F7EB286E096FED7901E266287ED18EA30E5DDC5EC9447F1114F7B
```

## 3. Skills and Inputs

实际读取并应用：

| Skill | 实际用途 |
|---|---|
| `$project-architecture` | 四个 Launch Authority 的服务边界和 R4-A/R4-B 拆分 |
| `$prisma-db-safety` | Grant/Evidence 的 DB Gate 和隔离测试顺序 |
| `$security-audit` | restricted token、session revoke、credential isolation 和攻击路径 |
| `$testing-and-verification` | Runtime Verification Gate 和隔离环境 |
| `$file-lifecycle` | Staging/Canonical/SEALED/Recovery/DELETED 生命周期 |

复核：

- R4-S7 Design/Report
- R4-S8 Review
- R4-S1 至 R4-S6 历史材料
- FZ、ST、DBTP
- 当前 Schema/Migration/Storage/Worker/Capability 只读材料
- Implementation Status 中 P1-3 与 R4 状态

## 4. R4-S8 Warning Baseline

| Warning | Original issue | Result |
|---|---|---|
| W1 | restricted token 的 normal/restricting 双重 access check | 已定义 Token Identity Matrix、Resource ACL Matrix、AccessCheck 失败规则 |
| W2 | Helper Session close/revoke 与 Job termination 未绑定 | 已定义 Session state machine、revoke sequence、termination confirmation |
| W3 | 单一 Launch Authority 集中全部 helper credential | 已比较 A/B/C/D，选择 per-helper-type authorities |

## 5. W1 Result

### 5.1 Decision

Helper 使用：

```text
dedicated normal logon user SID
+ normal helper group
+ unique restricting SID
+ DISABLE_MAX_PRIVILEGE
+ Medium integrity
```

Each resource Allow ACE must match both:

```text
normal enabled SID access check
restricting SID access check
```

No resource receives a broad allow to make the second check pass.

### 5.2 Identity matrix

| Helper | Normal identity | Normal group | Restricting SID | Scope |
|---|---|---|---|---|
| Staging Writer | `N_ST` | `G_ST` | `R_ST` | staging only |
| Publisher | `N_PUB` | `G_PUB` | `R_PUB` | staging read/new target |
| Sealer | `N_SEAL` | `G_SEAL` | `R_SEAL` | exact target DACL/owner |
| Cleanup | `N_CLN` | `G_CLN` | `R_CLN` | exact staging cleanup |

Important distinction: the Helper is launched by a batch/logon token, not
directly by SCM, so an `NT SERVICE\...` SID is not assumed. If implementation
uses Helper service accounts directly, it must redesign the preassigned-Job
protocol.

### 5.3 Resource ACL matrix

The complete matrix covers:

- Storage Root;
- staging roots;
- parent shard;
- per-object directory;
- canonical file initial/final;
- helper executable/dependencies;
- helper configuration;
- IPC endpoint;
- logs/state;
- credential secret;
- process and Job objects.

Each allowed resource entry must include both normal and restricting capability;
each denied entry has no fallback.

### 5.4 Fail-closed conditions

- missing normal user/group SID;
- missing restricting SID;
- unexpected deny-only SID;
- ACL with only normal or only restricting match;
- inherited broad ACE;
- wrong owner/DACL/protected flag;
- unexpected write/delete/DAC/owner access;
- inability to open exact resource with least rights.

All produce `TOKEN_IDENTITY_MISMATCH`, `ACCESS_CHECK_MISMATCH`,
`CREATE_HELPER_DENIED` or `ACL_INHERITANCE_REJECTED`; no fallback.

## 6. W2 Result

### 6.1 Session/Job binding

One Helper Session binds:

```text
sessionId + authorityEpoch + helperType + normal/restricting SIDs
+ PID + process creation time + held process handle
+ Job identity + held Job handle
+ operationId + grantId + launchId
```

The Supervisor's Job/process handles are the lifetime authority. PID and names
are never the long-lived binding.

### 6.2 State machine

Supported states:

```text
CREATED
ACTIVE
REVOKE_REQUESTED
REVOKING
JOB_CLOSE_REQUESTED
JOB_TERMINATION_PENDING
TERMINATION_CONFIRMED
EVIDENCE_RECONCILIATION
CLOSED
UNKNOWN
QUARANTINED
```

`CLOSED` requires all applicable process, Job, handle and Evidence reconciliation
facts.

### 6.3 Revoke sequence

1. CAS `ACTIVE -> REVOKE_REQUESTED`.
2. Deny all new RPC operations for the Session.
3. Revoke/mark unconsumed Grants and affected reserved Grants.
4. Mark the Operation `UNKNOWN`/`RECONCILING`, never APPLIED.
5. Close the final Supervisor Job handle.
6. Wait for the held process handle to become signaled.
7. For timeout, use `TerminateProcess` with `PROCESS_TERMINATE`.
8. Confirm Helper process exit and close handles.
9. Reconcile old Storage handles and Evidence.
10. Only then enter `CLOSED`; otherwise `UNKNOWN/QUARANTINED`.

Web/Worker session close has no Job. LaunchAuthority close aborts before COMMIT;
after COMMIT it does not own the Helper Job.

### 6.4 Concurrent revoke

All revokes use one session CAS and a per-session serialization mutex. Repeated
requests observe the same state and never perform a second unsafe Job close.

### 6.5 Unfinished Operation matrix

| Phase | Revoke | Grant | Target | Evidence | Final |
|---|---|---|---|---|---|
| No Grant | discard | none | untouched | none | REVOKED |
| Grant issued | revoke | REVOKED | untouched | none | REVOKED |
| Reserved/no syscall | terminate | UNKNOWN | retain | reconcile | UNKNOWN |
| Active write | terminate | UNKNOWN | retain | reconcile | UNKNOWN |
| Effect/no supervisor proof | terminate/verify | EFFECT_REPORTED | retain | reconcile | EVIDENCE_RECONCILING |
| DB incomplete | query | no auto-apply | retain | new connection | UNKNOWN |
| DB APPLIED | no rollback | consumed | lifecycle applies | existing | CLOSED/ACTIVE |

### 6.6 Termination confirmation

The design distinguishes:

```text
Job close requested
Job handle closed
Job termination started
Helper process signaled
Helper process exited
Supervisor handles closed
Evidence reconciled
```

No single state implies CLOSED or SEALED.

## 7. W3 Result

### 7.1 Credential asset decision

The design rejects a single broad Launch Authority for all helper credentials.

Selected:

```text
Four per-helper-type Launch Authorities
+ four OS service identities
+ four credential scopes
+ four DB launch-ticket roles
+ four RPC endpoints
+ fixed one-type launch tables
```

Each authority:

- can read only its own protected helper credential;
- can launch only its fixed Helper type/release;
- has no Storage access;
- creates one anonymous Job and transfers handles to Supervisor;
- cannot access another type's credential;
- cannot write canonical or Evidence finalization.

The Supervisor routes a DB-bound launch ticket to the correct type-specific
endpoint. The Supervisor remains a TCB but cannot read Helper credentials.

### 7.2 Comparison result

| Option | Result |
|---|---|
| A Single authority | rejected: all credentials in one blast radius |
| B Per-type authorities | selected: one credential/type, four endpoints |
| C Central broker | rejected for V1: broker still holds all credentials |
| D Split broker | deferred: high protocol/recovery complexity without V1 benefit |

### 7.3 Human decision

No high-risk residual acceptance is requested; splitting removes the
concentration. However, implementing four new Windows services/identities
requires explicit human approval of the service topology before source work.

## 8. R4-S8 Six NOT VERIFIED P2

| ID | Original issue | S9 disposition | Status |
|---|---|---|---|
| P2-03 | RPC/process DACL rights | complete identity/resource/process matrix | `READY FOR ISOLATED RUNTIME VALIDATION` |
| P2-04 | Named Job issues | anonymous Job + preassociation + transfer/timeout protocol | `READY FOR ISOLATED RUNTIME VALIDATION` |
| P2-05 | WMI/out-of-Job paths | restricted token second check + WDAC plan; no runtime evidence | `NOT VERIFIED` |
| P2-06 | Existing file handles | one-shot Helper + exit/no-child/no-dup + UNKNOWN gate | `READY FOR ISOLATED RUNTIME VALIDATION` |
| P2-08 | SCM own-process/status | per-type own-process LaunchAuthority; process handle is authority | `READY FOR ISOLATED RUNTIME VALIDATION` |
| P2-09 | Grant/Evidence Schema | schema/role/trigger/DB implementation absent | `NOT VERIFIED` |

## 9. R4-S4 Historical P2

| ID | Status | Regression |
|---|---|---|
| P2-01 Linux socket | `OUT OF SCOPE` | no Linux V1 claim |
| P2-02 Named Pipe DACL | `OUT OF SCOPE` | replaced by ncalrpc; RPC ACL remains runtime validation |
| P2-03 Grant SECURITY DEFINER | `DESIGN CLOSED` | DB not implemented |
| P2-04 HMAC lifecycle | `OUT OF SCOPE` | HMAC not identity proof |
| P2-05 WDAC/Code Integrity | `NOT VERIFIED` | runtime policy absent |
| P2-06 Helper DB credential | `DESIGN CLOSED` | provisioning not verified |
| P2-07 Delete Pending/durability | `NOT VERIFIED` | NTFS real test absent |
| P2-08 v1/v2 Drain | `NOT VERIFIED` | process/ACL evidence absent |

## 10. Windows V1 Implementation Roadmap

No item below is authorized by this report.

### 10.1 Preconditions

```text
G0: R4-S8 Design Freeze maintained
G1: R4-S9 W1/W2/W3 design accepted
G2: Per-type LaunchAuthority topology approved
G3: isolated Windows test host/accounts/creds approved
```

### 10.2 Track A — RPC / Authority

Scope:

- two public managers;
- 13 Authority operations;
- 6 operations per launch authority instance;
- `AuthorizeCurrentCall`;
- ClientPID/process/token/session/epoch binding;
- RPC/process DACL probes.

Acceptance:

- IDL export inventory has no unregistered manager;
- invalid/unknown operation has zero DB/FS/Evidence side effects;
- identity failures are denied before dispatch;
- concurrency tests isolate call contexts.

No Storage write or business DB is required for A1.

### 10.3 Track B — Process Launch / Job

Scope:

- four per-type Launch Authorities;
- helper identities and credential scopes;
- restricted token creation;
- JOB_LIST/assign/transfer/commit;
- Session revoke and termination confirmation;
- Supervisor crash/paused Helper tests.

Acceptance:

- helper never holds Job handle;
- supervisor is last Job handle owner after commit;
- session revoke reaches process signaled;
- unknown never enters CLOSED;
- restricted-token negative tests pass.

### 10.4 Track C — Storage / Sealing

Scope:

- staging/canonical namespaces;
- FileId/volume/parent identity;
- Owner Rights/protected DACL;
- Publisher/Sealer lifecycle;
- existing handle tests;
- SEALED evidence.

Acceptance:

- Guardian/Supervisor cannot write;
- parent cannot replace sealed target;
- old handles are either proven closed or operation UNKNOWN;
- no FileVersion before OS verification.

### 10.5 Track D — DB / Grant / Evidence

Scope:

- Grant tables/roles/functions/triggers;
- launch ticket and process lifetime binding;
- Helper Effect and Supervisor Verification;
- DB APPLIED / DELETED;
- commit-unknown/recovery.

Acceptance:

- duplicate/concurrent Grant consume fails closed;
- DB commits are not inferred from memory;
- Evidence is append-only and dual-source;
- terminal states cannot be forged by a single non-TCB role.

### 10.6 Track E — Independent Validation

Scope:

- RPC handle/PID/principal attacks;
- Job/handle crash injection;
- restricted token and ACL AccessCheck;
- WMI/SCM/Task Scheduler/COM outside-Job attempts;
- Owner Rights and old handles;
- DB concurrency/commit-unknown;
- recovery and cleanup;
- A4/A6/A7.18 regression.

Acceptance:

- independent adversarial test matrix passes or is explicitly failed;
- no test is skipped to obtain a green result;
- Windows runtime not verified remains visible in the release gate.

## 11. Isolated Environment Requirements

```text
Host: disposable Windows test VM/host
Test repository: disposable worktree/clone or isolated copy
DB: dedicated database name not elevator_advisor / elevator_advisor_test
DB roles: dedicated least-privilege test roles
Storage: new isolated NTFS test root
Helpers: dedicated test logon identities/groups
Launch Authorities: dedicated test service identities
Credentials: one-time test-only secrets, never production
Build output: temporary isolated root, never historical .next/dist
Cleanup: isolated fixtures only, explicit per-test teardown approval
```

No real customer files, production Storage, production DB, production secrets,
ACL/IAM, or deployment environment may be used.

## 12. Stage Gates

| Gate | Required evidence | Blocks |
|---|---|---|
| Design Gate | S8 freeze + S9 W1/W2/W3 accepted | implementation |
| Namespace Gate | exact public manager/operation inventory | RPC implementation |
| Identity Gate | token normal/restricted SID proof | Helper launch |
| Job Gate | JOB_LIST/fallback + handle transfer + crash tests | process model |
| ACL Gate | double access check + owner rights + parent tests | storage |
| DB Gate | Grant/Evidence schema and role tests | DB integration |
| Runtime Gate | isolated Windows failure tests | production enablement |
| Independent Review Gate | new adversarial review | release |
| Release Gate | all runtime and operational evidence | deployment |

No gate may be skipped because a previous report says `PASS`.

## 13. R4-A / R4-B Suggested Boundaries

These are proposed boundaries only; neither phase is authorized.

### R4-A — Isolated Authority / Process Foundation

Allowed scope after separate authorization:

- RPC IDL and two-manager authorization harness;
- per-type Launch Authority skeleton in test-only service identities;
- restricted token + SID construction;
- JOB_LIST/assign/handle transfer;
- Session close/revoke;
- local temp Isolation fixtures;
- no business DB migrations;
- no canonical Storage publication;
- no production credentials;
- no Web/Worker production integration.

Exit:

- Runtime verification gates A/B pass;
- independent review confirms no P1;
- no production enablement.

### R4-B — Integrated Lifecycle / Storage Implementation

Only after R4-A exit and separate authorization:

- Schema/Grant/Evidence migration;
- staging/Canonical Helper integration;
- signed release and LaunchAuthority deployment plan;
- real isolated DB/storage tests;
- Web/Worker integration;
- recovery and cleanup design/implementation.

Exit:

- full isolated P13 acceptance;
- independent adversarial review;
- release gate remains separate.

## 14. Remaining Risks / Human Decisions

### Human decision required

- Approve the four per-helper-type LaunchAuthority service topology before
  implementation.
- Approve each implementation phase and environment scope separately.

### Not a high-risk acceptance

The W3 split removes the concentrated credential risk; this report does not
ask the user to accept a single-authority credential concentration.

### Still NOT VERIFIED

- actual restricted token normal/restricting AccessCheck;
- WMI/SCM/Task Scheduler/COM Job-outside containment;
- Job handle transfer/crash timing;
- old file handle closure;
- NTFS owner/DACL/AccessCheck;
- WDAC/Code Integrity;
- Grant/Evidence Schema/roles/triggers;
- A4/A6/A7.18 regression.

## 15. Attack and Regression Result

R4-S7/S8 attack baseline remains:

- 20 original attack paths;
- 24 R4-S7 paths;
- 3 S8 warnings/X-paths.

S9 adds the W1/W2/W3 remediations:

- ACL only-normal/only-restrict denial;
- missing/disabled restricting SID denial;
- session close/revoke -> Job close -> process exit -> evidence reconciliation;
- concurrent revoke CAS;
- per-type credential isolation;
- four authority endpoint/session separation.

The 44 existing attack paths are not reported as runtime PASS; only their
design controls are retained. Windows runtime tests remain mandatory.

## 16. Worktree Before / After

Before:

```text
Tracked modified: 26
Untracked files: 158
Staged: 0
Deleted: 0
```

After（仅新增两份 R4-S9 Markdown）:

```text
Tracked modified: 26
Untracked files: 160
Staged: 0
Deleted: 0
```

New files:

| File | SHA-256 |
|---|---|
| R4-S9 Design | `196F192CD9AE0496A4CDB0D0CA9CD4F2CA3B89778CEB4CF009FB8668D5AA059A` |
| R4-S9 Readiness Report | 报告冻结后外部计算，不能写入自身哈希 |

No source, test, Schema, Migration, config, ACL, Owner, Job, Service, Storage,
build artifact or Git index was modified.

## 17. Final Result

```text
A7.20-R4-S9:
PASS WITH WARNINGS

W1 Restricted Token Double Access Check:
DESIGN CLOSED / RUNTIME NOT VERIFIED

W2 Session / Job Revoke:
DESIGN CLOSED / RUNTIME NOT VERIFIED

W3 Credential Isolation:
DESIGN CLOSED / OPTION B PER-TYPE LAUNCH AUTHORITY

R4-S8 P2-03/P2-04/P2-06/P2-08:
READY FOR ISOLATED RUNTIME VALIDATION

R4-S8 P2-05/P2-09:
NOT VERIFIED

R4-S7/S8 P1:
NO REGRESSION

New unresolved P1:
0

High-risk acceptance:
NOT REQUESTED

Human decision required:
YES — per-type Launch Authority topology and implementation authorization

Windows Runtime:
NOT VERIFIED

R4 Design Freeze:
MAINTAINED APPROVED FROM R4-S8

R4-A / R4-B:
NOT AUTHORIZED

Implementation / DB / Storage / ACL / Cleanup / Git Commit / Deployment:
NOT AUTHORIZED

NEXT PHASE:
NOT AUTHORIZED
```
