# P1-3 C-6.2-L8-A7.20-R4-A1-R4-B1 Native RPC Harness Build Report

## 0. Final Result

```text
Overall:
PASS WITH WARNINGS

Authorization Scope:
BUILD-ONLY / WITHIN APPROVED B1 BOUNDARY

Harness Source:
SOURCE IMPLEMENTED

IDL:
MIDL GENERATED

Interface UUID:
FIXED / NO REPOSITORY COLLISION FOUND

Public RPC Managers:
PASS — EXACTLY TWO

Per-Call Authorization:
IMPLEMENTED / COMPILE-VERIFIED / RUNTIME-NOT-VERIFIED

13 Authority Operations:
SOURCE IMPLEMENTED

6 Launch Operations:
SOURCE IMPLEMENTED

Native Client Identity Adapter:
IMPLEMENTED / COMPILE-VERIFIED / RUNTIME-NOT-VERIFIED

Process Handle:
REAL HANDLE TYPE / RAII / COMPILE-VERIFIED

Token / SID:
IMPLEMENTED / COMPILE-VERIFIED / RUNTIME-NOT-VERIFIED

RPC Principal:
IMPLEMENTED / COMPILE-VERIFIED / RUNTIME-NOT-VERIFIED

Four Launch Authorities:
DESCRIPTORS AND ISOLATION LOGIC IMPLEMENTED / RUNTIME-NOT-VERIFIED

Job Lifecycle:
ADAPTER IMPLEMENTED AND COMPILED / NOT EXECUTED

SEALED Adapter:
IMPLEMENTED AND COMPILED / NOT EXECUTED

Session / Epoch:
TEST-ONLY IN-MEMORY IMPLEMENTATION / COMPILE-VERIFIED

Replay / Evidence:
TEST-ONLY IMPLEMENTATION / COMPILE-VERIFIED

Test-only Effect Isolation:
IMPLEMENTED / UNAUTHORIZED CALLS REJECTED BEFORE EFFECT SINK

Harness Directory Isolation:
PASS

PFR Queue Stability:
PASS — BEFORE AND AFTER IDENTICAL

PFR Path Conflicts:
NONE FOUND

MIDL:
COMPILE PASSED

MSVC Compile:
COMPILE PASSED

Link:
LINK PASSED

Static Binary Inspection:
STATIC INSPECTION PASSED

Build Artifacts:
PRESENT / HASHED / NOT EXECUTED

Build Artifact SHA-256:
RECORDED BELOW AND IN BUILD MANIFEST

Native Test Execution:
NOT EXECUTED — BUILD-ONLY AUTHORIZATION

Native RPC Build:
PASS — BUILD-ONLY

Native RPC Runtime:
NOT EXECUTED

Database:
NOT ACCESSED

Storage:
NOT ACCESSED

Protected Object Integrity:
PASS

Repository Integrity:
PASS WITH ENVIRONMENT WARNING
```

This report records a real x64 Native RPC source implementation and Build-only
verification. It does not claim Native RPC Runtime, process launch, real Job,
ACL, Storage, Database or production integration verification.

## 1. Authorization and Scope

User-approved stage:

```text
C-6.2-L8-A7.20-R4-A1-R4-B1
Native RPC Harness Implementation & Build-Only Verification
```

Authorized and performed:

- isolated Harness source creation;
- IDL creation;
- Classic MIDL execution;
- MSVC compilation;
- Link execution;
- native identity, token, SID, principal and process-handle adapter source;
- Authority and Launch operation contracts;
- four Launch Authority descriptors;
- test-only session, epoch, replay, Grant and effect adapters;
- Job lifecycle and in-memory SEALED/AccessCheck adapter source;
- `dumpbin` headers/imports/symbols/dependents inspection;
- artifact hashing and static review.

Not authorized and not performed:

- generated Server/Client execution;
- `ncalrpc` binding or call;
- endpoint registration/listening;
- process creation;
- Job creation;
- Token creation or assignment;
- helper execution;
- ACL/DACL/Owner modification;
- Database/Storage access;
- R4-A2;
- Git write/commit;
- deployment.

## 2. Skills and Design Inputs

Actually read and applied:

- `$project-architecture`
- `$prisma-db-safety`
- `$security-audit`
- `$testing-and-verification`
- `$file-lifecycle`

Read and used:

- R4-S5 Windows-only IPC Authority Design
- R4-S6 Independent Adversarial Review
- R4-S7 Windows-only Authority and SEALED Design
- R4-S8 Independent Adversarial Review
- R4-S9 Warning Remediation Design
- R4-S10 Independent Adversarial Review
- R4-S11 P2 Remediation Design and R4-A Final Readiness
- R4-A1 Logical Identity Implementation Design and Validation Report
- R4-A1-R1 Toolchain Assessment
- R4-A1-R3-R5 Toolchain Installation Report
- R4-A1-R3-R6 Post-Install Reconciliation
- R4-A1-R4-D1 Native Harness Architecture and Build Plan
- `packages/authority-core` source, types, tests and configuration

Input hashes:

| Input | SHA-256 |
|---|---|
| R4-S5 Design | `8A83D4FD13ED92FEF3C51E902096D08D9B15925F35F8DB9BB238B6E308336B1C` |
| R4-S6 Review | `4843EF780044A404B41C2F8012EA3C7B927FF26ADB4D010DDC480254115CAD01` |
| R4-S7 Design | `6074131D7E8B4EF37B5AE6F9AD1733C012B2062E479EE9395A0EB4212CEECC0A` |
| R4-S8 Review | `4BEA7796B84F7EB286E096FED7901E266287ED18EA30E5DDC5EC9447F1114F7B` |
| R4-S9 Design | `196F192CD9AE0496A4CDB0D0CA9CD4F2CA3B89778CEB4CF009FB8668D5AA059A` |
| R4-S10 Review | `7A2EE422F53E4B59C76502469375DA114F0EF26F65266EC8C7FB9FA35CCB7CBE` |
| R4-S11 Readiness | `400D761CB129501BE9F31F3601BA89C116568A28C81E6470B9753AB829D70525` |
| R4-A1 Design | `692C334C933F4403CE0EBC7D88DB70361F89CAD8E8C55281B35F14432A6DC844` |
| R4-A1 Report | `2E6A0FE21BB958E3488C116FDF6DBCC8E70621F798AFDF9FE84EAA3F60886789` |
| R4-A1-R1 Assessment | `3E2987D2D815E64D3E642977D0E8D06C61D756F4D5E817444065ADAAD1F042BE` |
| R4-A1-R3-R5 Report | `1909BBA2D325EC4D719F177B699BEAA44C1526554B31B0DE8197D1BC0EE33178` |
| R4-A1-R3-R6 Report | `39092C6CA607086B716009B8F529CFD0472499C6A6472DFD37F608F6F12A0DA1` |
| D1 Build Plan | `5A9A5E0659C6DA8228836D024C66E12B0A424E9E6D6663AFFF42B9F065149ADE` |

## 3. Preflight Baseline

```text
Repository:
D:\thinkbook\Desktop\jieya

Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

Tracked modified:
26

Untracked before implementation:
191

Staged:
0

Deleted:
0
```

Harness preflight:

```text
tools/native-rpc/p13-a1-r2:
ABSENT

Planned src/idl/include/generated/obj/bin/logs/evidence paths:
NO PFR exact, parent, child, case-normalized or Reparse-resolved conflict
```

The root is NTFS and is not a Reparse Point. The Harness remained outside the
pnpm workspace and outside `apps/web/.next` and `apps/worker/dist`.

Git metadata has a host ownership mismatch. All Git queries used a per-command
`-c safe.directory=D:\thinkbook\Desktop\jieya`; no global Git configuration was
written.

## 4. PFR Before / Build / After

The source array was read before implementation, before build and after build.

```text
Type:
REG_MULTI_SZ

Raw strings:
46

Pairs:
23

Operations:
23 DELETE

SHA-256:
0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC
```

| ID | Before | After | Difference |
|---|---|---|---|
| PFR-001 | present in ordered array | present in same position | NONE |
| PFR-002 | present | present | NONE |
| PFR-003 | present | present | NONE |
| PFR-004 | present | present | NONE |
| PFR-005 | present | present | NONE |
| PFR-006 | present | present | NONE |
| PFR-007 | present | present | NONE |
| PFR-008 | present | present | NONE |
| PFR-009 | present | present | NONE |
| PFR-010 | present | present | NONE |
| PFR-011 | present | present | NONE |
| PFR-012 | present | present | NONE |
| PFR-013 | present | present | NONE |
| PFR-014 | present | present | NONE |
| PFR-015 | present | present | NONE |
| PFR-016 | present | present | NONE |
| PFR-017 | present | present | NONE |
| PFR-018 | present | present | NONE |
| PFR-019 | present | present | NONE |
| PFR-020 | present | present | NONE |
| PFR-021 | present | present | NONE |
| PFR-022 | present | present | NONE |
| PFR-023 | present | present | NONE |

PFR-020 through PFR-023 remain:

```text
UNAPPROVED / NOT INCLUDED IN ANY EXCEPTION
```

No PFR value, installer file, temporary file or reboot state was changed.

## 5. Isolated Harness Structure

```text
tools/native-rpc/p13-a1-r2/
  README.md
  build.ps1
  verify-static.ps1
  .gitignore
  idl/
    p13_authority.idl
  include/
    authority/
    client/
    common/
    identity/
    launch/
    lifecycle/
    server/
  src/
    authority/
    client/
    common/
    identity/
    launch/
    lifecycle/
    server/
  generated/x64/
  obj/x64/
  bin/x64/
  logs/build/
  logs/static-review/
  manifest/
```

Generated code, objects, binaries and logs are controlled by the Harness-local
`.gitignore`. No root ignore rule was changed.

An early intentionally retained failed-compile intermediate
`p13_authority_s.obj` remains at the Harness root. It is ignored, included in
the build evidence, and was not deleted.

## 6. IDL and Interface Identity

```text
Authority Interface:
P13Authority
UUID: 4F8ED476-EC87-4257-A9DA-589E31FA4BC8
Version: 1.0
Manager: P13Invoke (single manager)
Endpoint: p13-authority-v1

Launch Interface:
P13Launch
UUID: B2D9E41C-34D5-4046-96B6-9E14AA9D533E
Version: 1.0
Manager: P13LaunchInvoke (single manager)
Endpoints:
p13-launch-staging-v1
p13-launch-publisher-v1
p13-launch-sealer-v1
p13-launch-cleanup-v1
```

Pre-implementation UUID search found only the approved S7 design/report uses.
No collision was found in repository source/docs. Runtime endpoint registration
collision remains `NOT VERIFIED` because no endpoint was registered.

The obsolete name `p13-launch-staging-writer-v1` is absent from Harness source,
contracts and generated code. The only static checker source reference is the
negative check string itself.

## 7. Public RPC Manager Surface

Actual IDL public manager definitions:

```text
P13Invoke
P13LaunchInvoke
```

Static verification:

```text
IDL manager count:       2
Server manager count:    2
Additional manager:      NONE
Debug bypass manager:    NONE
```

Both manager methods have an explicit native control path:

```text
P13Invoke
  -> envelope validation
  -> descriptor lookup
  -> AuthorizeCurrentCall
  -> DispatchAuthority

P13LaunchInvoke
  -> envelope validation
  -> configured Launch Authority descriptor
  -> AuthorizeCurrentLaunchCall
  -> DispatchLaunch
```

Authorization failure writes a separate security event and returns before the
Effect Sink or dispatcher. Static verification proves the authorization call
appears before the corresponding dispatch call.

## 8. Thirteen Authority Operations

The complete contract is in
`tools/native-rpc/p13-a1-r2/manifest/operation-contracts.json`.

| ID | Operation | Session/Grant Binding | Harness Implementation |
|---|---|---|---|
| `0x0001` | `SESSION_REGISTER` | per-call identity + epoch | test-only active session |
| `0x0002` | `SESSION_HEARTBEAT` | session + process tuple + epoch | heartbeat record |
| `0x0003` | `SESSION_CLOSE` | session + process tuple | CLOSED test state |
| `0x0004` | `OPERATION_REQUEST_GRANT` | operation + generation | `ISSUED_TEST_ONLY` Grant |
| `0x0005` | `OPERATION_STATUS_READ` | operation + session | read-only status |
| `0x0006` | `OPERATION_CANCEL_BEFORE_GRANT` | operation + session | pre-Grant cancel |
| `0x0007` | `HELPER_REGISTER` | Helper + Grant + session | test-only bind |
| `0x0008` | `HELPER_HEARTBEAT` | Helper + session + Grant | heartbeat |
| `0x0009` | `HELPER_EFFECT_COMMITTED` | Helper + Grant + operation | effect signal only |
| `0x000A` | `HELPER_EXIT_NOTICE` | Helper session + operation | advisory revoke |
| `0x000B` | `GRANT_STATUS_READ` | Helper + Grant + session | read Grant |
| `0x000C` | `AUTHORITY_EPOCH_READ` | per-call identity | epoch response |
| `0x000D` | `PROCESS_STATE_READ` | held process handle + session | liveness observation |

No operation is merged into a generic high-privilege operation. Unknown
opcodes, zero request IDs, zero required operation IDs, oversized payloads and
request-digest mismatches are rejected before dispatch.

## 9. Six Launch Operations

| ID | Operation | Bound Input | Harness Implementation |
|---|---|---|---|
| `0x1000` | `LAUNCH_SESSION_REGISTER` | Supervisor identity, endpoint, ticket | test-only launch record |
| `0x1001` | `LAUNCH_PREPARE` | session + ticket + generation + release | consumes ticket; no OS process |
| `0x1002` | `LAUNCH_COMMIT` | prepared session | Supervisor handle ownership state |
| `0x1003` | `LAUNCH_ABORT` | pre-commit session | aborted/UNKNOWN-safe state |
| `0x1004` | `LAUNCH_STATUS_READ` | launch session | state read |
| `0x1005` | `LAUNCH_SESSION_CLOSE` | termination/evidence proof flags | CLOSED only when proofs present |

`LAUNCH_PREPARE` in this Build-only harness records only a planned suspended
state. It does not call `CreateProcessAsUser`, create a Job or resume a process.

## 10. Four Launch Authority Descriptors

| Authority | Canonical Endpoint | Helpers It May Launch | Credential Reference |
|---|---|---|---|
| Staging Writer | `p13-launch-staging-v1` | Staging Writer only | TEST placeholder only |
| Publisher | `p13-launch-publisher-v1` | Publisher only | TEST placeholder only |
| Sealer | `p13-launch-sealer-v1` | Sealer only | TEST placeholder only |
| Cleanup | `p13-launch-cleanup-v1` | Cleanup only | TEST placeholder only |

Each descriptor has independent authority ID, endpoint, helper type, normal
identity descriptor, unique restricting SID descriptor, credential reference,
launch-ticket permission descriptor and operation allowlist.

No real credential, Windows user, service account, SID or ACL was created.

Web and Worker have separate test-only internal descriptors for exercising the
shared Authority operation contract; they are not launch authorities.

## 11. Per-Call Authorization

Implemented native sequence:

```text
binding handle
-> RpcServerInqCallAttributesW
-> ncalrpc/local/null/kernel/authentication checks
-> ClientPID from RPC call
-> OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE)
-> GetProcessTimes creation time
-> OPEN_PROCESS_TOKEN
-> TokenUser / Groups / Restricted SIDs / Integrity / Session ID
-> RPC principal and process token cross-check
-> expected normal/restricting SID checks
-> session / authority / epoch / process tuple checks
-> immutable AuthorizedCall
-> dispatcher
```

The client request has no trusted PID, SID, token, principal, handle or target
path fields. `ClientPID` is obtained from the current RPC call only.

The implementation includes:

- `processHandleKey` replacement by a real `HANDLE` owned by `UniqueHandle`;
- held process handle for session lifetime;
- creation-time comparison to reject PID reuse;
- `WaitForSingleObject(handle, 0)` liveness check;
- no `PROCESS_TERMINATE` on ordinary caller identity handles;
- token group and restricted-SID validation;
- separate Web/Worker normal-token and Helper restricted-token classes;
- RPC authorization context creation/free adapter;
- impersonation/thread-token fallback adapter with mandatory revert guard.

All native behavior remains:

```text
IMPLEMENTED / BUILD-VERIFIED / RUNTIME-NOT-VERIFIED
```

## 12. Session, Epoch, Replay and Evidence

Implemented test-only in-memory stores:

- active/closed/revoked session state;
- authority, process tuple and epoch binding;
- request journal keyed by session + request ID;
- same digest returns `REPLAY`;
- changed digest returns `CONFLICT`;
- one-time test launch-ticket consumption;
- test Grant state;
- Effect records only after authorization;
- separate denied/rejected security-event records.

These stores explicitly do not provide:

- crash persistence;
- PostgreSQL CAS;
- durable COMMIT-unknown recovery;
- production Evidence;
- production Grant provisioning.

## 13. Job Lifecycle Adapter

Implemented compilation path:

```text
CreateJobObjectW
-> KILL_ON_JOB_CLOSE + ACTIVE_PROCESS=1
-> PROC_THREAD_ATTRIBUTE_JOB_LIST
-> CreateProcessAsUserW + CREATE_SUSPENDED
-> IsProcessInJob
-> GetProcessTimes
-> handle transfer / ownership model
-> ResumeThread (not called in B1)
-> RevokeAndWait
-> WaitForSingleObject
-> TerminateProcess fallback when required
-> final signaled proof
```

The Supervisor handle-transfer helper duplicates with:

```text
PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE | PROCESS_TERMINATE
```

The helper never receives a Job handle. The adapter is compiled and statically
inspectable, but its functions are not invoked by the test dispatcher and no Job
or process was created.

## 14. SEALED / OWNER RIGHTS Adapter

Implemented and compiled:

- Canonical owner input;
- in-memory `S-1-3-4` deny ACE construction;
- protected-DACL in-memory descriptor construction;
- self-relative Security Descriptor generation;
- `AccessCheck` adapter;
- file identity/size/hash/link-count Evidence structure;
- Helper Effect + Supervisor Verification match;
- SEALED evaluation that returns `EvidenceUnknown` when any proof is missing.

No `SetSecurityInfo`, `SetNamedSecurityInfo`, `SetFileSecurity`, real ACL/Owner
modification or real Storage access exists.

## 15. Toolchain

```text
Visual Studio Build Tools:
17.14.45 / 17.14.37906.3

MSVC:
14.44.35207

Compiler:
19.44.35230.0

Linker:
14.44.35230.0

Windows SDK:
10.0.26100.0

Classic MIDL:
8.01.0628 / 10.0.26100.9457

Target:
x64 only
```

Fixed tools:

| Tool | SHA-256 |
|---|---|
| `midl.exe` x64 | `2D5675679D6158790C25391EF8BF3004A695C42BB3B29E340BD6CB4708C8F23D` |
| `cl.exe` | `E87E78B3EF6580B75AEBDA843F8A22E874612D9F766344046551399F898EB226` |
| `link.exe` | `49A5DF25C3182A22684375B1D62A025016DEFFCCEA247894FE5CA2C85610C6A6` |
| `dumpbin.exe` | `E2C0EC987BB904ACFE88C0685CBC836E695CF22007CB17F3CE9F39E785DEC980` |
| `rpcasync.h` | `5E91801CEE17B175A397CC56FF08790783D4FCDBC8D52FE7BB7461CCFA369A85` |
| `Rpcrt4.lib` x64 | `BFE69184C180BF6ADE840AC5279B53AA67B0EDA43C82BCD86596DB0309FAEEF3` |

## 16. MIDL Result

Command:

```text
midl.exe
/nologo /x64 /env x64 /Oicf /robust /W1
/char signed /error allocation
/I SDK\Include\10.0.26100.0\um
/I SDK\Include\10.0.26100.0\shared
/I SDK\Include\10.0.26100.0\ucrt
/out tools\native-rpc\p13-a1-r2\generated\x64
/h p13_authority.h
/cstub p13_authority_c.c
/sstub p13_authority_s.c
idl\p13_authority.idl
```

Result:

```text
Exit code: 0
Errors:    0
Warnings:  0
```

Generated:

| File | Length | SHA-256 |
|---|---:|---|
| `p13_authority.h` | 5533 | `DF5F01CD881BC44CB8A2728898027A99AD50D5557B9D0E9C0CD32F7F7CD437FD` |
| `p13_authority_c.c` | 16969 | `BEE2604A63E67FE02243817808C61DDCCC42CB2124EA77DB84D1E052AE8CB34F` |
| `p13_authority_s.c` | 17270 | `7D76C83A875DED8D0DD264647BCD04FFED3237ED008A25E1219A1D4CF1A276CD` |

## 17. Compile Result

Generated stubs were compiled with `/TC /W3`.

Project C++ was compiled with:

```text
/W4 /WX /permissive- /std:c++20 /MT /GS /guard:cf /EHsc
/D_WIN32_WINNT=0x0A00
/DNTDDI_VERSION=0x0A00000C
```

Result:

```text
Generated Server Stub: PASS
Generated Client Stub: PASS
Server C++ units:       PASS
Client C++ units:       PASS
Compiler diagnostics:   0 warnings / 0 errors in final build
```

## 18. Link Result

```text
Server Link: PASS
Client Link: PASS
Duplicated symbols:       NONE
Unresolved externals:     NONE
Machine:                  x64
PE type:                  EXECUTABLE IMAGE
```

Final binary hashes:

| Binary | Length | SHA-256 |
|---|---:|---|
| `p13_native_rpc_server.exe` | 352768 | `A1169E2F6882BE5CA6F7D18C435DDA77E0F78A15467DE3C3A3271ABE241E38A5` |
| `p13_native_rpc_client.exe` | 184320 | `C86BE3839F414A8CE95DFC4312878EA598BE1FEC4A53AE254E943573897B4C6A` |

Dependencies:

```text
RPCRT4.dll
bcrypt.dll
ADVAPI32.dll
KERNEL32.dll
```

No third-party runtime DLL was introduced.

## 19. Static Binary Inspection

`dumpbin /headers`, `/imports`, `/symbols` and `/dependents` all exited 0.

Server imports observed:

```text
RpcServerRegisterIf3
RpcServerInqCallAttributesW
RpcGetAuthorizationContextForClient
RpcImpersonateClient
RpcRevertToSelf
OpenProcess
OpenProcessToken
GetProcessTimes
GetTokenInformation
CreateProcessAsUserW
CreateJobObjectW
DuplicateHandle
TerminateProcess
AccessCheck
ConvertSidToStringSidW
```

This proves link-time presence only. It does not prove any API was executed.

Static verification output:

```text
tools/native-rpc/p13-a1-r2/logs/static-review/static-verification.json
SHA-256:
D10DE78D2B1736542AB3B4879ADABEA11A216CFEE6E535012A61D71F7218251D
```

Static checks passed:

- exactly two public managers;
- 13 Authority operations;
- 6 Launch operations;
- operation-contract counts 13/6;
- traceability count 30;
- authorization precedes both dispatchers;
- obsolete endpoint absent;
- forbidden security mutation APIs absent;
- build script has no generated executable invocation;
- build manifest records `runtimeExecuted=false`;
- all manifest-listed artifact hashes match;
- all six protected hashes match;
- PFR count/hash match.

## 20. Build Manifest and Artifacts

Primary build manifest:

```text
tools/native-rpc/p13-a1-r2/manifest/build-manifest.json
Length: 6214
SHA-256:
DC164B09C1D16C7CAEB46B3785CA3806C703300C2535A39B471F7D08039FE2FF
```

The manifest records:

- fixed toolchain paths/versions;
- repository and Harness roots;
- `buildOnly=true`;
- `runtimeExecuted=false`;
- PFR before/after count and hash;
- generated/x64, obj/x64, bin/x64 and log artifact hashes.

Additional important evidence:

| Evidence | SHA-256 |
|---|---|
| `operation-contracts.json` | `6077C24242326891B14BF89F1F3BC02C5701F5671A6CA3147394A210824B13CD` |
| `test-traceability.json` | `6E6FB767AF4E82F7A805E05AB61EA119DA9A054FD848B0F4EB2EFD57584F740F` |
| `build.log` | `285DE59A592D895D0A14FD4365FE9F23E2AFB59A755FF697A357FD23780FE083` |
| `compile.log` | `4E8336A0279F6E39AC15CEDB7647A928687AAAFCE1713E875062EC31124C5194` |
| `link.log` | `E4B83D04D3ED679B86E194E6A44B6B920F3CBC99DCBD1DFA49792EC3056B8BF3` |
| `binary-inspection.log` | `79DF6D80A191D46C4568D70B5418CAD8BA77A248DF70853A6802D20602FE6A2B` |

## 21. Thirty-scenario Traceability

| IDs | Scenario Group | B1 Status |
|---|---|---|
| T01–T05 | valid call, PID, creation time, token SID, RPC principal | `NOT EXECUTED — BUILD-ONLY AUTHORIZATION` |
| T06–T09 | expired session, epoch, replay, conflict | `NOT EXECUTED — BUILD-ONLY AUTHORIZATION` |
| T10–T13 | authority injection, client exit, PID reuse, unauthorized caller | `NOT EXECUTED — BUILD-ONLY AUTHORIZATION` |
| T14–T18 | Helper revoke, Job close, termination, stale handle, manager bypass | `NOT EXECUTED — BUILD-ONLY AUTHORIZATION` |
| T19–T23 | in-flight revoke, ticket reuse, restricted/normal SID, credential ref | `NOT EXECUTED — BUILD-ONLY AUTHORIZATION` |
| T24–T27 | Job assignment/resume failure, terminate fallback, wait timeout | `NOT EXECUTED — BUILD-ONLY AUTHORIZATION` |
| T28–T30 | Sealer mismatch, old write handle, UNKNOWN preservation | `NOT EXECUTED — BUILD-ONLY AUTHORIZATION` |

Detailed per-test fields and JSON hash are in
`manifest/test-traceability.json`.

## 22. Self-review Findings and Corrections

| Finding | Correction |
|---|---|
| PowerShell array expression joined `/Fo` and source path | Parenthesized and fixed argument construction |
| MIDL could not find `cl.exe`/`wtypes.idl` | Added fixed MSVC PATH and SDK include paths |
| MIDL rejected interface-level `explicit_handle` | Removed invalid attribute; generated managers still expose binding handle |
| `PSID` conversion type mismatch | Corrected SID conversion signature |
| `ClientPrincipalName` wide-type mismatch | Added explicit RPC buffer cast |
| Missing `LaunchRecord` field name | Corrected to `authorityId` |
| Signed/unsigned epoch warning with `/WX` | Added explicit `uint64_t` conversion |
| Missing `MIDL_user_allocate/free` | Added allocator/free pair |
| Client unresolved `ConvertSidToStringSidW` | Linked `Advapi32.lib` |
| Unknown descriptor fallback could fail open | Changed descriptor lookup to return null and reject unknown classes |
| Security Descriptor had local pointers | Switched to self-relative descriptor generation |
| Denied calls lacked separate evidence | Added test-only Security Event Sink before Effect Sink |
| Link `/OUT:` path was split | Fixed argument construction |

## 23. Not Completed or Not Verified

```text
Native RPC Server execution:
NOT EXECUTED

Native RPC Client execution:
NOT EXECUTED

ncalrpc endpoint registration:
NOT EXECUTED

Real RPC ClientPID acquisition:
NOT VERIFIED

Real RPC principal/token relationship:
NOT VERIFIED

RPC callback invocation behavior:
NOT VERIFIED

Actual object identity of duplicate process handles:
NOT VERIFIED

PID reuse behavior on target Windows:
NOT VERIFIED

Real restricted token creation and double AccessCheck:
NOT VERIFIED

Real test Windows identities/credentials:
NOT CONFIGURED

CreateProcessAsUser/Job/JOB_LIST/handle transfer:
NOT EXECUTED

TerminateProcess/Wait fallback:
NOT EXECUTED

Supervisor/helper crash behavior:
NOT EXECUTED

WMI/SCM/Task Scheduler/COM outside-Job behavior:
NOT VERIFIED

Owner Rights/protected DACL on a real object:
NOT EXECUTED

Real old-write-handle closure:
NOT VERIFIED

FileId/reparse/hard-link/flush/directory durability:
NOT VERIFIED

WDAC/Code Integrity/signing:
NOT VERIFIED

Database Grant/roles/transactions/COMMIT unknown:
NOT IMPLEMENTED / NOT ACCESSED

Production Web/Worker integration:
NOT IMPLEMENTED

Launch endpoint process wiring in main:
COMPILED CONFIGURATION PATH PRESENT / RUNTIME WIRING REQUIRES B2

Runtime test SDDL is empty in fail-closed server main:
EXPECTED FOR B1 / MUST BE CONFIGURED IN B2

apps/web/.next whole-tree history:
NOT VERIFIED

apps/worker/dist whole-tree history:
NOT VERIFIED
```

## 24. Protected Objects and Repository

| Protected object | SHA-256 | Result |
|---|---|---|
| FZ | `E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705` | MATCH |
| ST | `5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586` | MATCH |
| DBTP | `FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7` | MATCH |
| Prisma Schema | `78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299` | MATCH |
| `next-env.d.ts` | `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC` | MATCH |
| `tsconfig.tsbuildinfo` | `21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520` | MATCH |

```text
$null:    ABSENT
$null):   ABSENT
```

Git before implementation:

```text
Tracked modified: 26
Untracked:        191
Staged:           0
Deleted:          0
```

Git immediately before this report:

```text
Tracked modified: 26
Untracked:        219
Staged:           0
Deleted:          0
```

The visible untracked delta is 28 B1 Harness source/manifest files. Generated,
object, binary and log outputs are intentionally ignored by the Harness-local
`.gitignore` but remain present and hashed. This report adds one final untracked
Markdown, for an expected final count of 220.

## 25. Side Effects and Explicit Non-actions

Performed:

- created files only under `tools/native-rpc/p13-a1-r2`;
- created generated MIDL files, objects, binaries and logs there;
- created this report;
- executed fixed MIDL, `cl.exe`, `link.exe` and `dumpbin.exe`;
- read fixed toolchain files, protected files, PFR and Git status.

Not performed:

- no generated EXE execution;
- no `--help`/`--version` probe;
- no `Start-Process` on generated binaries;
- no RPC binding/call/listen/endpoint registration;
- no Windows user, group, service, credential, token or SID creation;
- no Job/process creation or termination;
- no ACL/DACL/Owner modification;
- no Registry or PFR modification;
- no Service, Task Scheduler or startup registration;
- no database connection/SQL/Migration;
- no Storage access;
- no `.env`/secret read;
- no `.next` or Worker `dist` modification;
- no production source/config/Schema/Migration/lockfile modification;
- no Git add/commit/reset/restore/clean/checkout/stash;
- no deployment.

## 26. B2 Recommendation

Recommended next phase:

```text
R4-A1-R4-B2 — Independent Native RPC Harness Adversarial Review
```

B2 should independently verify:

- source-to-design traceability;
- exactly two RPC manager entries in generated server code;
- per-call authorization before all side effects;
- no unintended process/ACL/DB/Storage runtime calls;
- build reproducibility;
- static binary properties;
- all `NOT VERIFIED` runtime items remain unclaimed.

B2 must not inherit Native RPC Runtime authorization from B1.

## 27. Report Integrity

This report cannot contain its own stable SHA-256 without changing itself. The
file was frozen after this sentence; its SHA-256 is returned in the terminal
delivery and verified externally.

