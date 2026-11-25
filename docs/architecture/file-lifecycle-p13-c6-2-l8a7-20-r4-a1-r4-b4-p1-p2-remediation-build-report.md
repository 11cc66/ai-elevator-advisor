# P1-3 C-6.2-L8-A7.20-R4-A1-R4-B4 Native RPC P1/P2 Remediation & Build Report

## 0. Final Result

```text
Stage:
C-6.2-L8-A7.20-R4-A1-R4-B4

Date:
2026-11-22

Mode:
BUILD-ONLY REMEDIATION

Overall:
PASS WITH WARNINGS

Authorization Scope:
BUILD-ONLY / WITHIN B4 BOUNDARY

P1-01:
SOURCE IMPLEMENTED / BUILD VERIFIED / RUNTIME NOT VERIFIED

P1-02:
SOURCE IMPLEMENTED / BUILD VERIFIED / RUNTIME NOT VERIFIED

P1-03:
SOURCE IMPLEMENTED / BUILD VERIFIED / RUNTIME NOT VERIFIED

P1-04:
SOURCE IMPLEMENTED / BUILD VERIFIED / RUNTIME NOT VERIFIED

P1-05:
SOURCE IMPLEMENTED / BUILD VERIFIED / RUNTIME NOT VERIFIED

P2-01 through P2-13:
SOURCE / BUILD CLOSURE IMPLEMENTED / RUNTIME PROOF PENDING WHERE APPLICABLE

OperationPolicy:
IMPLEMENTED / IMMUTABLE 13 + 6 MATRIX

AuthorizedCallToken:
IMPLEMENTED / PRIVATE CONSTRUCTION / REQUEST-BOUND

13 Authority Operations:
SOURCE IMPLEMENTED / COMPILE VERIFIED

6 Launch Operations:
SOURCE IMPLEMENTED / COMPILE VERIFIED

Grant / Ticket Binding:
SOURCE IMPLEMENTED / COMPILE VERIFIED / RUNTIME NOT VERIFIED

Caller Identity:
SOURCE IMPLEMENTED / COMPILE VERIFIED / RUNTIME NOT VERIFIED

RPC Authz Context:
IMPLEMENTED / RUNTIME NOT VERIFIED

Process TokenUser:
IMPLEMENTED / RUNTIME NOT VERIFIED

Integrity Level:
IMPLEMENTED / RUNTIME NOT VERIFIED

Session ID:
IMPLEMENTED / RUNTIME NOT VERIFIED

SID Attributes:
IMPLEMENTED / RUNTIME NOT VERIFIED

Session / Launch State Machine:
SOURCE IMPLEMENTED / COMPILE VERIFIED

Revoke Orchestrator:
SOURCE IMPLEMENTED / RUNTIME NOT VERIFIED

Restricted Token:
SOURCE IMPLEMENTED / COMPILE VERIFIED / RUNTIME NOT VERIFIED

Job Lifecycle:
SOURCE IMPLEMENTED / COMPILE VERIFIED / RUNTIME NOT VERIFIED

Cross-process Handle:
SOURCE IMPLEMENTED / DUPLICATEHANDLE PATH COMPILED / RUNTIME NOT VERIFIED

SEALED:
SOURCE IMPLEMENTED / COMPILE VERIFIED / RUNTIME NOT VERIFIED

RPC Server Lifecycle:
SOURCE IMPLEMENTED / BLOCKING LISTEN PATH COMPILED

NDR Bounds:
VARIABLE PAYLOAD / 24576-BYTE WIRE BUDGET

Sha256Outcome:
FAIL-CLOSED IMPLEMENTED / COMPILE VERIFIED

Native Test Source:
30 SOURCES IMPLEMENTED / COMPILE VERIFIED

Native Test Execution:
NOT EXECUTED — BUILD-ONLY

MIDL:
COMPILE PASSED / 0 ERRORS / 0 WARNINGS

MSVC Compile:
COMPILE PASSED / 0 ERRORS / 0 WARNINGS

Link:
LINK PASSED

Static Binary Verification:
STATIC VERIFICATION PASSED

Build Manifest:
PRESENT / SOURCE AND ARTIFACT HASHES RECORDED

Build Artifact Hashes:
RECORDED

B1 Original Artifact Integrity:
UNCHANGED

PFR Queue Integrity:
PASS — 46 STRINGS / 23 DELETE / HASH UNCHANGED

Protected Object Integrity:
PASS

Repository Integrity:
PASS WITH EXISTING DIRTY WORKTREE

Native RPC Server Execution:
NOT EXECUTED

Native RPC Client Execution:
NOT EXECUTED

Native RPC Runtime:
NOT EXECUTED

R4-A2:
NOT AUTHORIZED

Git Commit:
NOT AUTHORIZED

Deployment:
NOT AUTHORIZED
```

## 1. Authorization and Scope

User-authorized B4 scope:

- remediate all five B2 P1 findings;
- remediate all thirteen B2 P2 findings;
- implement the canonical operation policy;
- implement Caller identity, Grant/Ticket, replay, sequence and expiry;
- implement separate lifecycle state records and revoke orchestration;
- implement Restricted Token, Job, cross-process Handle transfer and SEALED
  adapters;
- implement 30 native test sources;
- run MIDL, MSVC compile, Link and static PE inspection;
- perform self-review and repeat Build-only verification.

Not authorized and not performed:

- any generated executable;
- Native RPC Server/Client;
- RPC binding, call or endpoint registration;
- process or Job creation;
- real Token/User/SID creation;
- `TerminateProcess`;
- ACL/Owner/DACL mutation;
- Database/SQL/Migration;
- real Storage access;
- Git commit;
- deployment;
- R4-A2.

## 2. Skills and Baseline Inputs

Actually read and applied:

- `$project-architecture`
- `$prisma-db-safety`
- `$security-audit`
- `$testing-and-verification`
- `$file-lifecycle`

Reviewed:

- R4-S5 through R4-S11 original designs/reports;
- R4-A1 design/report;
- D1 Build Plan;
- B1 Build Report;
- B2 Independent Review;
- B3 Remediation Design;
- all current Harness source, IDL, generated stubs, scripts, manifests and tests.

Input hashes:

| Input | SHA-256 | Result |
|---|---|---|
| B2 | `53A97D6973CD9BE65C048F2522E9D9899930154CB263E7E020BCC08809FBDD18` | MATCH |
| B3 | `085D5D9DCC074C76394455D9883E33F7DD125F0569C0C751E58AD4A706F6AB97` | MATCH |
| B1 | `FC55B8A0E24419D5DE9AB0C2CC3FDA258B1EB4C56FA62B165F3B4D26B3B8F434` | MATCH |
| D1 | `5A9A5E0659C6DA8228836D024C66E12B0A424E9E6D6663AFFF42B9F065149ADE` | MATCH |

## 3. Preflight and Working Tree

```text
Repository: D:\thinkbook\Desktop\jieya
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 26
Untracked before B4 source changes: 222
Staged: 0
Deleted: 0
```

B4 output paths:

```text
generated/r4-b4/x64
obj/r4-b4/x64
bin/r4-b4/x64
logs/r4-b4
manifest/r4-b4
evidence/r4-b4
```

All six planned paths were absent at preflight and had no PFR path
exact/parent/child/case/Reparse conflict.

## 4. B1 Original Evidence Preservation

The following B1 artifacts remained byte-for-byte unchanged:

| Artifact | SHA-256 |
|---|---|
| B1 Server EXE | `A1169E2F6882BE5CA6F7D18C435DDA77E0F78A15467DE3C3A3271ABE241E38A5` |
| B1 Client EXE | `C86BE3839F414A8CE95DFC4312878EA598BE1FEC4A53AE254E943573897B4C6A` |
| B1 Build Manifest | `DC164B09C1D16C7CAEB46B3785CA3806C703300C2535A39B471F7D08039FE2FF` |
| B1 Static Verification | `D10DE78D2B1736542AB3B4879ADABEA11A216CFEE6E535012A61D71F7218251D` |
| B1 MIDL log | `4ECD6983151475141EB3ABCAB5186FA2E85A5BE1CD0C804535E24BD50D0776A7` |
| B1 Compile log | `4E8336A0279F6E39AC15CEDB7647A928687AAAFCE1713E875062EC31124C5194` |
| B1 Link log | `E4B83D04D3ED679B86E194E6A44B6B920F3CBC99DCBD1DFA49792EC3056B8BF3` |
| B1 Build log | `285DE59A592D895D0A14FD4365FE9F23E2AFB59A755FF697A357FD23780FE083` |

## 5. Canonical Operation Policy

The source now has one immutable policy table in:

```text
include/authority/p13_operation_policy.h
src/authority/p13_operation_policy.cpp
```

Policy fields include:

```text
canonical ID / name
manager
principal mask
authority mask
session requirement
binding mode
generation requirement
action
effect category
failure status
```

The manager obtains policy before identity/session/Grant evaluation. An
`AuthorizedCallToken` is only constructible by `AuthorizationEngine`; its
constructor is private and the dispatcher requires the token.

### 5.1 Authority operation mapping

| ID | Operation | Allowed principals | Binding |
|---:|---|---|---|
| `0x0001` | `SESSION_REGISTER` | Web, Worker, four Helpers | no Grant |
| `0x0002` | `SESSION_HEARTBEAT` | Web, Worker, four Helpers | no Grant |
| `0x0003` | `SESSION_CLOSE` | Web, Worker, four Helpers | no Grant; Helper enters revoke |
| `0x0004` | `OPERATION_REQUEST_GRANT` | Web, Worker | no Grant; generation required |
| `0x0005` | `OPERATION_STATUS_READ` | Web, Worker | operation owner |
| `0x0006` | `OPERATION_CANCEL_BEFORE_GRANT` | Web, Worker | operation owner + CAS |
| `0x0007` | `HELPER_REGISTER` | matching Helper | launch ticket + Grant reserve |
| `0x0008` | `HELPER_HEARTBEAT` | matching Helper | match Grant |
| `0x0009` | `HELPER_EFFECT_COMMITTED` | matching Helper | match Grant |
| `0x000A` | `HELPER_EXIT_NOTICE` | matching Helper | match Grant; advisory |
| `0x000B` | `GRANT_STATUS_READ` | matching Helper | match Grant |
| `0x000C` | `AUTHORITY_EPOCH_READ` | all control principals | no Grant |
| `0x000D` | `PROCESS_STATE_READ` | matching Helper | match Grant |

### 5.2 Launch operation mapping

| ID | Operation | Principal | Binding |
|---:|---|---|---|
| `0x1000` | `LAUNCH_SESSION_REGISTER` | Supervisor | trusted launch ticket |
| `0x1001` | `LAUNCH_PREPARE` | Supervisor | ticket consume + generation |
| `0x1002` | `LAUNCH_COMMIT` | Supervisor | prepared handle-transfer state |
| `0x1003` | `LAUNCH_ABORT` | Supervisor | pre-commit state |
| `0x1004` | `LAUNCH_STATUS_READ` | Supervisor | launch session |
| `0x1005` | `LAUNCH_SESSION_CLOSE` | Supervisor | complete evidence/proof state |

## 6. P1 Remediation Results

### P1-01 — Operation allowlist

Implemented:

- immutable central policy table;
- exact principal mask check;
- authority type/endpoint check;
- session requirement;
- binding mode;
- unknown/empty policy deny;
- `AuthorizedCallToken` private constructor;
- dispatcher token-to-request equality check.

Result:

```text
SOURCE IMPLEMENTED
BUILD VERIFIED
RUNTIME NOT VERIFIED
```

### P1-02 — Grant/action/generation/audience

Implemented:

- per-operation `GrantRequirement` mode;
- exact Grant ID, operation, audience, session, helper type, action,
  generation, expiry and state checks;
- one active Grant per operation/generation;
- CAS reserve/effect/consume/revoke transitions;
- client fields are only locators; trusted ticket/Grant stores decide authority.

Result:

```text
SOURCE IMPLEMENTED
BUILD VERIFIED
RUNTIME NOT VERIFIED
```

### P1-03 / P1-04 — State and revoke

Implemented:

- separate Session, Launch, Process, Job, Grant and Evidence state records;
- duplicate Launch session registration rejected;
- `UNKNOWN`/`QUARANTINED` cannot be passed to normal close;
- Helper `SESSION_CLOSE` requests revoke and returns unknown/pending rather than
  final CLOSED;
- revoke orchestrator source covers Job close, process wait, approved
  termination fallback, handle closure and evidence reconciliation;
- no unconditional `Close` assignment from request handler.

Result:

```text
SOURCE IMPLEMENTED
BUILD VERIFIED
RUNTIME NOT VERIFIED
```

### P1-05 — Caller identity

Implemented:

- per-call `RpcServerInqCallAttributesW`;
- held process handle and creation time;
- `RpcGetAuthorizationContextForClient`;
- `AuthzGetInformationFromContext` for user/groups/restricted SIDs;
- process token User/Groups/Restricted/Integrity/Session;
- Authz User SID vs process TokenUser binary comparison;
- enabled/deny-only/restricted SID rules;
- integrity and Windows Session allowlists;
- no principal string-only authorization.

Result:

```text
SOURCE IMPLEMENTED
BUILD VERIFIED
RUNTIME NOT VERIFIED
```

## 7. P2 Closure Results

| ID | Implemented closure | Build evidence | Remaining runtime evidence |
|---|---|---|---|
| P2-01 | blocking `RpcServerListen`; stop/wait/unregister sequence | source check | Server start/stop |
| P2-02 | variable payload; measured NDR base sizes; 24576-byte budget | generated stub + source | boundary RPC calls |
| P2-03 | Restricted Token, `ResumeThread`, Job preassociation source | API/source check | real token/process/Job |
| P2-04 | distinct principal/authority descriptors; credential/ticket fields validated | source check | four real OS identities |
| P2-05 | enabled/deny-only/disabled SID handling; empty expected SID denied | source/unit source | token negative runtime |
| P2-06 | Authz-context primary path; no main-path impersonation; fail-stop revert guard | source check | revert failure injection |
| P2-07 | trusted in-memory Ticket Store; no client-defined release authority | source/unit source | expired/replayed ticket |
| P2-08 | sequence, expiry, unique Grant, owner-only cancel | source/unit source | concurrent CAS/replay |
| P2-09 | terminal handle reset; cross-process `DuplicateHandle` source | source/PE imports | handle count/crash tests |
| P2-10 | protected DACL, Owner Rights deny, separate evidence records | source check | isolated NTFS ACL tests |
| P2-11 | `Sha256Outcome` failure is DENY/UNKNOWN | source/unit source | crypto failure injection |
| P2-12 | 30 native test sources compiled into test EXE | compile/link | native test execution |
| P2-13 | fixed tool versions, source hashes, env allowlist, semantic verifier | manifest/check | none in Build-only |

All P2 source/build closures are marked complete for B4. Runtime-only claims
remain explicitly unverified.

## 8. NDR and RPC Wire Bound

The B4 IDL changed payload fields from fixed arrays to:

```text
[size_is(payloadLength)] byte *payload
```

Generated base sizes:

```text
Authority request base: 200 bytes
Launch request base:    216 bytes
Response:               576 bytes
```

Budget:

```text
payload maximum:       16384
transport/header reserve: 4096
max request base:       216
max response:           576
required budget:       21272
configured wire limit: 24576
```

`RpcServerRegisterIf3` uses `P13_MAX_RPC_WIRE_BYTES = 24576`; payload length
above 16384 is rejected before policy dispatch.

## 9. RPC Server Lifecycle

Source now uses:

```text
RpcServerListen(1, 32, FALSE)
RpcMgmtStopServerListening
RpcMgmtWaitServerListen
RpcServerUnregisterIf
```

The launch descriptor and endpoint are wired through the server configuration.
`RpcServerListen` was not executed.

## 10. Restricted Token, Job and Handle Transfer

Source implements:

- restricted primary token creation with `CreateRestrictedToken` and
  `DISABLE_MAX_PRIVILEGE`;
- `IsTokenRestricted` verification in the identity path;
- `CREATE_SUSPENDED`;
- `PROC_THREAD_ATTRIBUTE_JOB_LIST`;
- `IsProcessInJob`;
- cross-process `DuplicateHandle` into a pinned Supervisor process;
- non-inheritable process/Job/thread handles;
- `ResumeThread` only after transfer/commit;
- `WaitForSingleObject` and approved `TerminateProcess` fallback.

No process, token handle, Job or termination was executed.

## 11. SEALED and Evidence

Source implements:

- protected Security Descriptor with `SE_DACL_PROTECTED`;
- Canonical Owner SID;
- `S-1-3-4` OWNER RIGHTS deny ACE;
- Guardian/Supervisor read ACEs;
- ACE construction and self-relative descriptor;
- `AccessCheck` adapter;
- separate Helper Effect and Supervisor Verification records;
- exact Grant/Operation/Session/object/owner/DACL/size/hash comparisons.

`EvaluateSealedEvidence` returns match only when both records have distinct
sources and all required observations agree. No real ACL API was called.

## 12. Identity and Hash Fail-Closed Behavior

`Sha256Outcome` has explicit success/failure status. BCrypt initialization,
creation, update and finalization failures return `CryptoFailed`; no zero
digest is accepted.

The identity adapter uses Authz-context SID data and process-token data as
separate evidence and requires binary equality. RPC principal is not treated as
a substitute for process TokenUser.

## 13. Native Test Sources

`tests/b4/native_test_sources.cpp` contains a registry of T01–T30. The test
executable compiles and links; it was not run.

```text
Native Test Source: IMPLEMENTED
Compile: PASS
Link: PASS
Native Test Execution: NOT EXECUTED — BUILD-ONLY
```

Runtime-gated tests fail closed unless
`P13_ALLOW_NATIVE_RUNTIME_TESTS=1` is explicitly supplied in a separately
authorized runtime phase.

## 14. Build Results

Toolchain:

```text
Visual Studio Build Tools: 17.14.45 / 17.14.37906.3
MSVC: 14.44
Compiler: 19.44.35230.0
Linker: 14.44.35230.0
Windows SDK: 10.0.26100.0
Classic MIDL: 8.01.0628
Target: x64
```

Commands were executed through `build-b4.ps1` with a fixed executable
environment allowlist (`ProcessStartInfo.Environment.Clear()`).

Results:

```text
MIDL:      PASS / 0 errors / 0 warnings
MSVC:      PASS / 0 errors / 0 warnings
Link:      PASS
Static:    PASS
Runtime:   NOT EXECUTED
```

Build-only artifacts:

| Artifact | Length | SHA-256 |
|---|---:|---|
| `bin/r4-b4/x64/p13_native_rpc_server.exe` | 465920 | `324D1C06BB5452FCE982119E3985AE5AB5B5A41A2D06013A709ECCD2266EEFB3` |
| `bin/r4-b4/x64/p13_native_rpc_client.exe` | 194560 | `D7BFF66F519B3B3544D8D0CC3858567B1B4CE64BCEFC1C5DFB7DFFEC6BEBCD49` |
| `bin/r4-b4/x64/p13_native_tests.exe` | 591872 | `AA2636BE8B53E26E79131E2C17FC863A6792D99976C01ED3A76EA7B5AF7EF3FA` |
| `generated/r4-b4/x64/p13_authority.h` | 5646 | `93A9A20AF3228F648D47B7CD8E56A33A09FAABE1ABEB26B9B513D8B35BB0D0CD` |
| `generated/r4-b4/x64/p13_authority_c.c` | 17801 | `CBD6EE7323010C378928A8F376D8EDC0EEC33DF6402D88DC45785DAA68BFC8E5` |
| `generated/r4-b4/x64/p13_authority_s.c` | 18102 | `DB704D304CF37F7CC526720AF27B2A82CC86694B2020C57B67CBD7F15B8E7ECE` |
| `manifest/r4-b4/build-manifest.json` | 12447 | `58ED3EAFF2498AFA44D4E1D92FD2CA43DD86CBA57E5E7B93B4B97204E8B79774` |
| `manifest/r4-b4/operation-policy.json` | 3870 | `0E2466B2CE9D2138B16AD9F51CD3CE7C96F18E4306BBEEAFDF0434C6FB9D4A53` |
| `manifest/r4-b4/test-traceability.json` | 3980 | `5F3D314132F19B70D336B16BC109E22924D6235B885C3C78819C73624CD6EAD5` |
| Static verification | 21623 | `DEDA51B673CFA57CC653F02112C5C1322686F9B01424A80E69E6D5BEC4EB362E` |

The B4 Manifest records 28 source hash records and 35 artifact hash records.

PE inspection:

```text
All three binaries:
  x64
  EXECUTABLE IMAGE
  Dynamic base
  NX compatible
  High Entropy Virtual Addresses
  Control Flow Guard

Server/Test dependencies:
  RPCRT4.dll
  bcrypt.dll
  AUTHZ.dll
  ADVAPI32.dll
  KERNEL32.dll

Client dependencies:
  RPCRT4.dll
  bcrypt.dll
  ADVAPI32.dll
  KERNEL32.dll
```

## 15. B1 Original Artifact and Repository Integrity

B1 artifacts remained unchanged (see section 4).

Protected objects:

| Object | SHA-256 | Result |
|---|---|---|
| FZ | `E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705` | MATCH |
| ST | `5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586` | MATCH |
| DBTP | `FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7` | MATCH |
| Prisma Schema | `78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299` | MATCH |
| `next-env.d.ts` | `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC` | MATCH |
| `tsconfig.tsbuildinfo` | `21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520` | MATCH |

`$null` and `$null)` are absent. `.next` and Worker `dist` remain
`WHOLE-TREE HISTORY: NOT VERIFIED`.

## 16. PFR

B4 preflight and post-build:

```text
REG_MULTI_SZ
46 strings
23 pairs
23 DELETE operations
SHA-256: 0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC
```

PFR-020 through PFR-023 remain:

```text
UNAPPROVED / NOT INCLUDED IN ANY EXCEPTION
```

## 17. Git and File Inventory

Before B4 source implementation:

```text
Tracked modified: 26
Untracked: 222
Staged: 0
Deleted: 0
```

New B4 source/control files:

```text
tools/native-rpc/p13-a1-r2/include/authority/p13_operation_policy.h
tools/native-rpc/p13-a1-r2/src/authority/p13_operation_policy.cpp
tools/native-rpc/p13-a1-r2/tests/b4/native_test_sources.cpp
tools/native-rpc/p13-a1-r2/build-b4.ps1
tools/native-rpc/p13-a1-r2/verify-static-b4.ps1
tools/native-rpc/p13-a1-r2/README-B4.md
tools/native-rpc/p13-a1-r2/manifest/r4-b4/operation-policy.json
tools/native-rpc/p13-a1-r2/manifest/r4-b4/test-traceability.json
```

Existing Harness files modified in place:

```text
idl/p13_authority.idl
include/common/p13_types.h
include/authority/p13_authority_components.h
include/authority/p13_authority_service.h
include/identity/p13_identity_adapter.h
include/launch/p13_launch_components.h
include/lifecycle/p13_lifecycle_adapters.h
include/server/p13_server_runtime.h
src/common/p13_types.cpp
src/identity/windows_identity_adapter.cpp
src/authority/p13_authority_components.cpp
src/authority/p13_authority_service.cpp
src/launch/p13_launch_components.cpp
src/lifecycle/job_lifecycle_adapter.cpp
src/lifecycle/sealed_adapter.cpp
src/server/p13_managers.cpp
src/server/p13_server_runtime.cpp
src/server/p13_server_main.cpp
src/client/p13_client_runtime.cpp
```

The final report adds one Git-visible file, expected final untracked count 232.

## 18. UNKNOWN / NOT VERIFIED

```text
RPC runtime ClientPID/auth behavior: NOT VERIFIED
Authz context runtime SID extraction: NOT VERIFIED
RPC principal = process TokenUser runtime equality: NOT VERIFIED
real token SID attributes: NOT VERIFIED
integrity/session behavior on target accounts: NOT VERIFIED
restricted token and double AccessCheck runtime: NOT VERIFIED
CreateProcessAsUser/Job/JOB_LIST: NOT VERIFIED
cross-process DuplicateHandle runtime: NOT VERIFIED
ResumeThread runtime: NOT VERIFIED
TerminateProcess/Wait fallback: NOT VERIFIED
supervisor/helper crash recovery: NOT VERIFIED
protected DACL/OWNER RIGHTS on real NTFS object: NOT VERIFIED
old write-handle closure: NOT VERIFIED
FileId/reparse/hard-link/durability: NOT VERIFIED
COMMIT-unknown durable recovery: NOT IMPLEMENTED IN HARNESS DB LAYER
Native test execution: NOT EXECUTED
production Web/Worker integration: NOT IMPLEMENTED
```

## 19. Side-effect Declaration

No generated executable, test executable or Native RPC program was run. No
RPC endpoint was registered. No process, token, Job, ACL, Owner, DACL, Service,
Task, Registry, PFR, database, Storage, network or deployment operation was
performed. No Git write command was used.

## 20. Report Integrity

This report was frozen without embedding its own hash because inserting it
would change the file. Its SHA-256 is returned externally after read-only
verification.

