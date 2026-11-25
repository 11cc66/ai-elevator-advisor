# P1-3 C-6.2-L8-A7.20-R4-S11 R4-A Final Readiness Report

## 1. Executive Summary

```text
A7.20-R4-S11:
PASS WITH WARNINGS

P2-01 Restricted Token Scope:
DESIGN CLOSED

P2-02 Process Terminate Fallback:
DESIGN CLOSED

P2-03 Operation Side-effect / Revoke:
DESIGN CLOSED

P2-04 R4-A Test Metadata / DB Mock:
DESIGN CLOSED

Four per-helper-type Launch Authorities:
APPROVED V1 TARGET ARCHITECTURE

R4-A:
READY FOR AUTHORIZATION

R4-B:
NOT READY / NOT AUTHORIZED

Windows Runtime:
NOT VERIFIED
```

本阶段只完成设计整改和实施准入计划，不创建四个 Windows Service、不创建
Windows 用户/组、不连接数据库、不创建 Schema/Role/Migration、不访问
Storage、不修改 ACL、不创建 Job，也不实施源码。

## 2. Baseline

```text
Repository: D:\thinkbook\Desktop\jieya
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 26
Untracked files: 161
Staged: 0
Deleted: 0
```

R4-S10 输入 SHA-256：

```text
7A2EE422F53E4B59C76502469375DA114F0EF26F65266EC8C7FB9FA35CCB7CBE
```

R4-S9 输入 SHA-256：

```text
Design: 196F192CD9AE0496A4CDB0D0CA9CD4F2CA3B89778CEB4CF009FB8668D5AA059A
Report: FC369C2532A7C49C7C4D5829007B98FFA198F5CA6FDDB1A572957B5D66B92F90
```

## 3. Skills and Reviewed Materials

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
- R4-S10 Review
- FZ、ST、DBTP
- 当前 Schema/Migration/Storage/Worker/Capability 只读状态

## 4. Option B Approval

用户正式批准：

```text
Option B — Four Per-Helper-Type Launch Authorities
```

四个 Authority：

1. Staging Writer Launch Authority
2. Publisher Launch Authority
3. Sealer Launch Authority
4. Cleanup Launch Authority

每个 Authority 具有独立 service identity、credential scope、DB launch-ticket
role、RPC endpoint、helper release scope、Session/Epoch 和 process handle
scope。该批准不等于实现授权。

## 5. Four P2 Remediation

### 5.1 Restricted Token Double AccessCheck

Final rules:

```text
Restricted Helper:
  normal enabled SID check + restricting SID check

Web / Worker / Supervisor / LaunchAuthority normal token:
  normal token check only

No non-restricted service may use a helper restricting SID as an authorization
substitute.
```

Final Token Class Matrix and Resource Access Matrix are in the S11 design.

### 5.2 Process Handle / TerminateProcess

Supervisor process handle after COMMIT:

```text
PROCESS_QUERY_LIMITED_INFORMATION
+ SYNCHRONIZE
+ PROCESS_TERMINATE
```

The handle is non-inheritable, held by the Supervisor, and is not shared with
other Authorities or Helpers. PID alone is never used. Termination requires:

```text
TerminateProcess(held original handle)
-> WaitForSingleObject
-> signaled process
-> Evidence reconciliation
```

`TerminateProcess` return success alone is not process-exit proof.

### 5.3 Session/Operation Matrix

Every operation phase now has a revoke policy and recovery outcome:

- no operation;
- operation created;
- Grant issued/reserved;
- staging write;
- Publisher target effect;
- Sealer DACL effect;
- Cleanup deletion effect;
- Helper exit without Evidence;
- Evidence before DB APPLIED;
- DB APPLIED.

Invariants:

```text
Revoke != file rollback
Job close != Evidence reconciled
Lease expiration != OS termination
File effect != DB APPLIED
Name removed != physical erasure
UNKNOWN remains QUARANTINED until durable reconciliation
```

### 5.4 R4-A Test Infrastructure

Selected hybrid:

```text
A1: Mock + local test metadata
A2: Mock + temporary NTFS ACL fixtures
A3: Dedicated isolated metadata PostgreSQL + test Windows process/Job
A4: Dedicated metadata PostgreSQL + test credentials/identities + temp root
```

Forbidden:

```text
elevator_advisor
elevator_advisor_test
any real business DB/schema/role
any real Storage Root
any production credential
```

R4-A test schema contains only isolated session/launch-ticket/CAS metadata;
no business lifecycle data.

## 6. R4-A Work Packages

### R4-A1 — Authority / RPC Identity

Scope:

- single public manager per authority endpoint;
- `AuthorizeCurrentCall`;
- process identity and Session/Epoch;
- endpoint/process DACL;
- invalid/unknown operation tests.

No business DB; no real Storage.

### R4-A2 — Restricted Token / ACL

Scope:

- normal and unique restricting SID creation;
- `DISABLE_MAX_PRIVILEGE`;
- double access check;
- positive/negative ACL fixtures;
- release/dependency/config ACLs;
- parent/child boundary.

Only temporary isolated NTFS fixture.

### R4-A3 — Process Launch / Job / Revoke

Scope:

- four per-type Launch Authorities;
- `CREATE_SUSPENDED`;
- JOB_LIST/Assign/IsProcessInJob;
- handle transfer;
- Supervisor final handle;
- process termination fallback;
- Session revoke and recovery.

No real Helper/business file operation.

### R4-A4 — Authority Isolation / Recovery

Scope:

- four credential scopes;
- cross-authority negative tests;
- Authority crash/restart;
- Supervisor crash;
- credential rotation/revocation;
- stale ticket/session;
- termination reconciliation.

Only test credentials and isolated metadata DB/Storage fixtures.

## 7. Gate Matrix

| Work Package | Design Gate | Implementation Gate | Runtime Gate | Independent Review Gate | Release Gate |
|---|---|---|---|---|---|
| A1 Authority/RPC | S11 accepted | separately authorized source scope | manager/identity/DACL | adversarial review | no release |
| A2 Token/ACL | A1 contract frozen | separately authorized identity scope | double access check/ACL negatives | adversarial review | no release |
| A3 Job/Revoke | A2 accepted | separate process/service scope | Job/handle/terminate/session | adversarial review | no release |
| A4 Isolation/Recovery | A3 accepted | separate credential scope | four-authority isolation | adversarial review | no release |
| R4-B | A1-A4 exit + A10 review | DB/Storage separately authorized | isolated DB/Storage integration | independent review | separate release authorization |

No Gate is automatically passed by this report.

## 8. R4-A Test Topology

```text
Disposable Windows test VM/host
  - test Supervisor identity
  - four test LaunchAuthority identities
  - four test Helper identities/groups/restricting SIDs
  - test-only protected credential records
  - test-only RPC endpoints
  - test-only anonymous Job/process handles
  - dedicated metadata PostgreSQL
  - temporary NTFS test root
  - test-only Evidence files
```

The actual names/SIDs/credentials must be fixed in the R4-A implementation
authorization. No production identity is reused.

## 9. R4-A Dependency and Bounds

```text
A1 -> A2 -> A3 -> A4
```

- A2 cannot start until A1 manager/identity inventory is frozen.
- A3 cannot start until A2 positive/negative ACL suites pass.
- A4 cannot start until A3 Job/process/session termination is independently
  reviewed.
- R4-A cannot touch real Canonical Storage or business DB.
- R4-A may use the dedicated metadata PG only after separate DB/environment
  authorization.
- R4-A must not create the real production four services as a test shortcut.

## 10. R4-B Preconditions

R4-B is not ready or authorized. Before R4-B:

1. R4-A runtime and independent review pass.
2. Exact Windows identities/service SIDs are approved.
3. Dedicated test metadata DB behavior is verified.
4. Schema/Grant/Evidence design is separately reviewed.
5. Business DB migration/role environment is separately authorized.
6. Isolated Canonical Storage fixtures are separately authorized.
7. Web/Worker integration boundaries are reviewed.

## 11. Human Decisions

```text
Architecture decision:
Option B — APPROVED BY USER

High-risk risk acceptance:
NONE REQUESTED

Implementation authorization:
STILL REQUIRED
```

No four-service implementation, credential creation, DB role creation, Storage
access, or deployment is implied.

## 12. Unresolved Items

```text
Windows restricted-token/ACL behavior: NOT VERIFIED
four-Authority credential isolation: NOT VERIFIED
Job/JOB_LIST/handle transfer: NOT VERIFIED
TerminateProcess/Wait/reconciliation: NOT VERIFIED
WMI/SCM/Task Scheduler/COM outside-Job behavior: NOT VERIFIED
Owner Rights/protected DACL/old handles: NOT VERIFIED
WDAC/Code Integrity: NOT VERIFIED
Grant/Evidence Schema/roles/transactions: NOT VERIFIED
A4/A6/A7.18 runtime regression: NOT EXECUTED
```

## 13. Two-pass Self Review

### Pass 1 — Architecture/threat

- non-restricted and restricted token classes separated;
- four authorities have independent credentials/endpoints/roles;
- process handle ownership and termination fallback explicit;
- operation revoke matrix covers all lifecycle phases;
- R4-A mock/metadata/test DB boundaries explicit.

Result: `PASS WITH WARNINGS`.

### Pass 2 — Concurrency/recovery/cross-component

- Revoke CAS and Job/process/Evidence sequence coherent;
- process handle uses original creation time and held handle;
- DB lease cannot imply OS termination;
- Owner/ACL and file effects are reconciled, not rolled back;
- four authority common TCB explicitly includes Supervisor/kernel/RPC/SCM/DB;
- R4-A/R4-B gates prevent accidental business DB or Storage access.

Result: `INTERNAL CONSISTENCY PASS`.

## 14. Worktree Before / After

Before:

```text
Tracked modified: 26
Untracked files: 161
Staged: 0
Deleted: 0
```

After（仅新增两份 S11 Markdown）:

```text
Tracked modified: 26
Untracked files: 163
Staged: 0
Deleted: 0
```

New files:

| File | SHA-256 |
|---|---|
| S11 Design | `B454D3584845ABEADFF49CB1BD9D00360BDB4445EDC01B97214744480C75C226` |
| S11 Readiness Report | 报告冻结后外部计算 |

No source, tests, Schema, Migration, config, ACL, Owner, Job, Service, Storage,
build artifact or Git index modified.

## 15. Final Fields

```text
A7.20-R4-S11:
PASS WITH WARNINGS

P2-01 Restricted Token Scope:
DESIGN CLOSED

P2-02 Process Terminate Fallback:
DESIGN CLOSED

P2-03 Operation Side-effect / Revoke:
DESIGN CLOSED

P2-04 R4-A Test Infrastructure:
DESIGN CLOSED

Option B Four Launch Authorities:
APPROVED V1 TARGET ARCHITECTURE

R4-S8 P2-03/P2-04/P2-06/P2-08:
READY FOR ISOLATED RUNTIME VALIDATION

R4-S8 P2-05/P2-09:
NOT VERIFIED

Four R4-S10 P2:
DESIGN CLOSED

R4-A:
READY FOR AUTHORIZATION

R4-A1..A4:
SEQUENTIAL / SEPARATELY AUTHORIZED

R4-B:
NOT READY / NOT AUTHORIZED

New unresolved P1:
0

Windows Runtime:
NOT VERIFIED

R4 Design Freeze:
MAINTAINED APPROVED FROM R4-S8

High-risk acceptance:
NOT REQUESTED

Implementation / DB / Storage / ACL / Cleanup / Git Commit / Deployment:
NOT AUTHORIZED

NEXT PHASE:
NOT AUTHORIZED
```
