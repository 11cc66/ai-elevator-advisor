# P1-3 C-6.2-L8-A7.20-R4-A1-R4-B2 Independent Native RPC Harness Adversarial Review

## 0. Executive Result

```text
Stage:
C-6.2-L8-A7.20-R4-A1-R4-B2

Date:
2026-11-22

Mode:
INDEPENDENT READ-ONLY ADVERSARIAL REVIEW

Overall:
FAIL

Review Independence:
PASS — B1 CLAIMS RE-CHECKED FROM SOURCE

B1 Report Integrity:
HASH PASS / CONTROL-CLAIM ACCURACY PARTIAL

P0:
0

P1:
5

P2:
13

P3:
5

Native RPC Build Re-execution:
NOT EXECUTED

Native RPC Runtime:
NOT EXECUTED

Runtime Readiness:
BLOCKED BY P1 AND P2

Next Gate:
INDEPENDENT REMEDIATION REQUIRED BEFORE RUNTIME READINESS
```

The Harness is genuinely buildable and has exactly two public RPC manager
functions, but its source does not yet enforce several mandatory security
invariants from R4-S7 through R4-S11. The most serious defects are missing
caller-class operation allowlists, missing Grant/Generation/action binding,
unsafe launch/session close transitions, and an incomplete RPC
principal/process-token identity chain.

This is a source-level adversarial review. No native binary was executed and no
Runtime claim is made.

## 1. Review Independence and Boundary

The B1 report was treated as a claim set, not as evidence of correctness. The
review independently:

- hashed B1, D1 and protected inputs;
- inventoried every Harness file;
- read the IDL, generated MIDL output, all C++ source and build scripts;
- traced both RPC manager call paths;
- traced every operation to dispatcher and Effect path;
- searched dangerous Windows API call sites and reachability;
- inspected PE headers, imports, exports and dependencies;
- compared operation contracts with R4-S7 through R4-S11;
- compared all 30 designed tests with actual executable test source.

No source, generated file, build output, PFR, ACL, Job, Database, Storage or Git
state was modified. The only intended new file is this review report.

## 2. Skills and Authoritative Inputs

Actually read and applied:

- `$project-architecture`
- `$prisma-db-safety`
- `$security-audit`
- `$testing-and-verification`
- `$file-lifecycle`

Read and used:

- R4-S5 Windows-only ncalrpc design
- R4-S6 independent review and remediation
- R4-S7 RPC Manager, per-call authorization, Job and SEALED design
- R4-S8 independent adversarial review
- R4-S9 P2 warning remediation design
- R4-S10 independent review
- R4-S11 R4-A readiness report
- R4-A1 logical Authority implementation and validation
- R4-A1-R1 toolchain assessment
- R4-A1-R3-R5 installation report
- R4-A1-R3-R6 post-install reconciliation
- R4-A1-R4-D1 architecture/build plan
- R4-A1-R4-B1 implementation/build report
- `packages/authority-core` source, types, tests and package configuration

Authoritative design hashes:

| Input | SHA-256 |
|---|---|
| R4-S5 Design | `8A83D4FD13ED92FEF3C51E902096D08D9B15925F35F8DB9BB238B6E308336B1C` |
| R4-S6 Review | `4843EF780044A404B41C2F8012EA3C7B927FF26ADB4D010DDC480254115CAD01` |
| R4-S7 Design | `6074131D7E8B4EF37B5AE6F9AD1733C012B2062E479EE9395A0EB4212CEECC0A` |
| R4-S8 Review | `4BEA7796B84F7EB286E096FED7901E266287ED18EA30E5DDC5EC9447F1114F7B` |
| R4-S9 Design | `196F192CD9AE0496A4CDB0D0CA9CD4F2CA3B89778CEB4CF009FB8668D5AA059A` |
| R4-S10 Review | `7A2EE422F53E4B59C76502469375DA114F0EF26F65266EC8C7FB9FA35CCB7CBE` |
| R4-S11 Readiness | `400D761CB129501BE9F31F3601BA89C116568A28C81E6470B9753AB829D70525` |
| D1 Build Plan | `5A9A5E0659C6DA8228836D024C66E12B0A424E9E6D6663AFFF42B9F065149ADE` |
| B1 Build Report | `FC55B8A0E24419D5DE9AB0C2CC3FDA258B1EB4C56FA62B165F3B4D26B3B8F434` |

## 3. Current Repository and B1 Artifact Baseline

```text
Repository:
D:\thinkbook\Desktop\jieya

Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

Tracked modified:
26

Untracked before B2 report:
220

Staged:
0

Deleted:
0
```

Independently verified B1 artifacts:

| Artifact | Length | SHA-256 | Result |
|---|---:|---|---|
| Server EXE | 352768 | `A1169E2F6882BE5CA6F7D18C435DDA77E0F78A15467DE3C3A3271ABE241E38A5` | MATCH |
| Client EXE | 184320 | `C86BE3839F414A8CE95DFC4312878EA598BE1FEC4A53AE254E943573897B4C6A` | MATCH |
| Build Manifest | 6214 | `DC164B09C1D16C7CAEB46B3785CA3806C703300C2535A39B471F7D08039FE2FF` | MATCH |
| Static Verification | 9054 | `D10DE78D2B1736542AB3B4879ADABEA11A216CFEE6E535012A61D71F7218251D` | MATCH |
| MIDL Header | 5533 | `DF5F01CD881BC44CB8A2728898027A99AD50D5557B9D0E9C0CD32F7F7CD437FD` | MATCH |
| Client Stub | 16969 | `BEE2604A63E67FE02243817808C61DDCCC42CB2124EA77DB84D1E052AE8CB34F` | MATCH |
| Server Stub | 17270 | `7D76C83A875DED8D0DD264647BCD04FFED3237ED008A25E1219A1D4CF1A276CD` | MATCH |

All 25 artifacts listed in the Build Manifest independently matched both file
length and SHA-256.

## 4. Harness Inventory

The Harness contains:

- 28 Git-visible source/manifest files;
- 1 B1 architecture report;
- 3 MIDL-generated files;
- 2 PE binaries;
- 14 `obj/x64` files plus one retained early failed-compile root object;
- build/static-review logs and Build Manifest.

Visible B1 delta:

```text
28 Harness files
+ 1 B1 report
= 29 Git-visible files
```

The Harness-local `.gitignore` hides only generated, object, binary and log
outputs. It does not hide source, IDL, manifests or the negative static-check
script.

## 5. IDL, MIDL and Public RPC Surface

IDL interface identities:

```text
P13Authority
UUID: 4F8ED476-EC87-4257-A9DA-589E31FA4BC8
Version: 1.0
Manager: P13Invoke

P13Launch
UUID: B2D9E41C-34D5-4046-96B6-9E14AA9D533E
Version: 1.0
Manager: P13LaunchInvoke
```

Generated server routine tables contain exactly one entry each:

```text
P13Authority_v1_0_DispatchTable:
  entry count = 1
  routine = P13Invoke

P13Launch_v1_0_DispatchTable:
  entry count = 1
  routine = P13LaunchInvoke
```

No third public manager, debug manager or direct RPC dispatcher was found.
Dependencies have no exported application API.

### 5.1 IDL/NDR observations

Positive:

- fixed-size request and response arrays;
- no nullable variable-sized client pointer in the manager methods;
- protocol version and payload length are validated;
- unknown operation enums are rejected by range checks;
- MIDL ran with `/robust` and allocation checks;
- `MIDL_user_allocate` / `MIDL_user_free` are present;
- generated interface UUID/version/manager names match the IDL.

Negative:

- RPC maximum size is set to `16384`, while generated NDR type sizes include
  `16544` and `16592`. See B2-P2-03.
- SHA-256 helper failure returns an all-zero digest which can be accepted if the
  caller also submits zeros. See B2-P2-11.

## 6. Manager Call Graph

### 6.1 `P13Invoke`

```text
P13Invoke
D:\...\src\server\p13_managers.cpp:18
  -> null parameter check :22
  -> DescriptorForId(request.authorityId) :27
  -> AuthorizeCurrentCall :37
       -> ValidateAuthorityRequest :125
       -> descriptor ID/epoch check :132
       -> CaptureAndAuthorizeCaller :156
       -> Session Validate :173
  -> DispatchAuthority :48
```

The manager does call authorization before dispatch. This part passes static
call-order review.

### 6.2 `P13LaunchInvoke`

```text
P13LaunchInvoke
D:\...\src\server\p13_managers.cpp:56
  -> null parameter check :60
  -> load launch descriptor :65
  -> AuthorizeCurrentLaunchCall :75
       -> ValidateLaunchRequest :195
       -> descriptor ID/epoch check :202
       -> CaptureAndAuthorizeCaller :221
  -> DispatchLaunch :86
```

Authorization also occurs before launch dispatch. This does not cure the
operation-allowlist, Grant, or state-machine findings below.

### 6.3 Security callback

`CoarseInterfaceCallback` is at
`src/server/p13_server_runtime.cpp:10`. It checks local/authenticated RPC state
and is not used as the per-call business authorization gate. This design choice
is correct.

## 7. Caller Identity Chain

Static identity acquisition path:

```text
current RPC call
-> RpcServerInqCallAttributesW
-> ClientPID
-> server OpenProcess(QUERY_LIMITED_INFORMATION | SYNCHRONIZE)
-> GetProcessTimes
-> WaitForSingleObject(active check)
-> OpenProcessToken(TOKEN_QUERY)
-> TokenUser / TokenGroups / TokenRestrictedSids
-> TokenIntegrityLevel / TokenSessionId
-> expected principal/group/restricting SID checks
-> session process tuple
```

Positive:

- PID comes from the current RPC call, not payload;
- real `HANDLE` replaces string `processHandleKey`;
- creation time is read from the opened process;
- ordinary caller handles do not request `PROCESS_TERMINATE`;
- null/kernel/non-local RPC callers are rejected;
- WINNT + `PKT_PRIVACY` is required;
- process exit before authorization is rejected;
- token and process handles are RAII-managed.

Critical gap:

- RPC principal is not mapped to `TokenUser`.
- Integrity and Windows Session ID are collected but not compared with an
  expected allowlist.
- Group and restricted-SID attributes are ignored, including deny-only state.

These are B2-P1-05 and B2-P2-05.

## 8. Operation Contract Matrix

All 13 Authority and 6 Launch names/IDs are present. Contract presence does not
mean semantic enforcement.

| Contract | Source | Dispatcher | Security enforcement |
|---|---|---|---|
| 13 Authority operations | `idl/p13_authority.idl:9-24` | `p13_authority_service.cpp:283-392` | Caller allowlist absent |
| 6 Launch operations | `idl/p13_authority.idl:26-34` | `p13_authority_service.cpp:446-521` | State proof incomplete |

### 8.1 Authority operation enforcement

| ID | Operation | Design caller classes | Grant required by design | Actual pre-dispatch enforcement |
|---:|---|---|---|---|
| `0x0001` | `SESSION_REGISTER` | Web/Worker/Helpers | no | identity + descriptor |
| `0x0002` | `SESSION_HEARTBEAT` | Web/Worker/Helpers | no | session only |
| `0x0003` | `SESSION_CLOSE` | Web/Worker/Helpers | no | session only; no Helper revoke proof |
| `0x0004` | `OPERATION_REQUEST_GRANT` | Web/Worker | no | caller-class allowlist absent |
| `0x0005` | `OPERATION_STATUS_READ` | Web/Worker | no | ownership absent |
| `0x0006` | `OPERATION_CANCEL_BEFORE_GRANT` | Web/Worker | no | operation ownership absent |
| `0x0007` | `HELPER_REGISTER` | matching Helper | launch ticket | ticket/Grant absent |
| `0x0008` | `HELPER_HEARTBEAT` | matching Helper | yes | Grant absent |
| `0x0009` | `HELPER_EFFECT_COMMITTED` | matching Helper | yes | Grant/action/generation absent |
| `0x000A` | `HELPER_EXIT_NOTICE` | matching Helper | yes | Grant absent; no process proof |
| `0x000B` | `GRANT_STATUS_READ` | matching Helper | yes | only grant-ID existence |
| `0x000C` | `AUTHORITY_EPOCH_READ` | all | no | identity only |
| `0x000D` | `PROCESS_STATE_READ` | matching Helper | yes | Grant absent |

### 8.2 Launch operation enforcement

| ID | Operation | Main issue |
|---:|---|---|
| `0x1000` | `LAUNCH_SESSION_REGISTER` | duplicate session ID overwrites existing state |
| `0x1001` | `LAUNCH_PREPARE` | trusted ticket/release source absent |
| `0x1002` | `LAUNCH_COMMIT` | in-memory ownership flag only |
| `0x1003` | `LAUNCH_ABORT` | in-memory state only |
| `0x1004` | `LAUNCH_STATUS_READ` | in-memory read |
| `0x1005` | `LAUNCH_SESSION_CLOSE` | UNKNOWN/QUARANTINED can become CLOSED |

## 9. Four Launch Authority Isolation

Canonical endpoint names are correct:

```text
p13-launch-staging-v1
p13-launch-publisher-v1
p13-launch-sealer-v1
p13-launch-cleanup-v1
```

The obsolete `p13-launch-staging-writer-v1` is absent except in the negative
static-check search string.

| Authority | Distinct descriptor | Distinct helper type | Distinct credential |
|---|---:|---:|---:|
| Staging Writer | yes | yes | placeholder string only |
| Publisher | yes | yes | placeholder string only |
| Sealer | yes | yes | placeholder string only |
| Cleanup | yes | yes | placeholder string only |

Partial findings:

- `credentialReferenceDescriptor` and `launchTicketPermissionDescriptor` are
  stored but never read by authorization or dispatcher code.
- The grant/action/generation path does not bind a launch to a helper type or
  credential scope.
- Separate service/credential runtime instances are not implemented.

The four structures are not merely one shared numeric object, but operational
isolation is not proven and is incomplete. See B2-P2-04 and B2-P2-07.

## 10. Restricted Token / AccessCheck Review

R4-S9/R4-S10 require:

```text
restricted Helper:
  normal access check AND restricting access check

Web/Worker/Supervisor:
  normal access check only
```

Current implementation:

- checks expected group and restricting SIDs for presence;
- does not call `IsTokenRestricted`;
- does not inspect `SE_GROUP_USE_FOR_DENY_ONLY`;
- does not inspect disabled/deny-only attributes;
- does not perform a resource `AccessCheck` in authorization;
- does not use `CreateRestrictedToken`;
- accepts a pre-built `helperPrimaryToken` in the Job adapter without proving it
  is restricted.

Therefore:

```text
Restricted-token SID presence checks:
IMPLEMENTED

Double AccessCheck enforcement:
NOT IMPLEMENTED / RUNTIME-NOT-VERIFIED
```

## 11. Job Lifecycle and Revoke

Compiled adapter path:

```text
CreateJobObjectW
-> KILL_ON_JOB_CLOSE + ACTIVE_PROCESS=1
-> PROC_THREAD_ATTRIBUTE_JOB_LIST
-> CreateProcessAsUserW + CREATE_SUSPENDED
-> IsProcessInJob
-> GetProcessTimes
```

Positive:

- anonymous Job;
- no breakaway flag;
- suspended create;
- Job membership checked;
- process handle has query/synchronize before promotion;
- `PromoteSupervisorHandleRights` duplicates with `PROCESS_TERMINATE` and wait
  rights;
- Revoke waits and uses `TerminateProcess` only after timeout.

Incomplete:

- `ResumeThread` is absent completely, not merely “not called”;
- `CreateRestrictedToken` / restricted SID setup is absent;
- `PromoteSupervisorHandleRights` duplicates from and to
  `GetCurrentProcess()`, not from Launch Authority to Supervisor;
- runtime `UNKNOWN`/`QUARANTINED` transitions are not used by dispatcher;
- helper `SESSION_CLOSE` does not call the Job adapter.

These are B2-P1-04, B2-P2-03 and B2-P2-09.

## 12. SEALED / OWNER RIGHTS

Implemented:

- converts owner and `S-1-3-4` strings to SIDs;
- creates an in-memory deny ACE for write/delete/DAC/owner rights;
- creates a self-relative Security Descriptor;
- exposes `AccessCheck`;
- evaluates Publisher/Sealer exit booleans and file identity fields.

Missing or incomplete:

- `SE_DACL_PROTECTED` is never set;
- no final allow ACL is constructed;
- no ACE-order/readback verification;
- only one `FileIdentityEvidence` exists; helper and supervisor observations are
  collapsed into trusted booleans;
- `EvaluateSealedEvidence` trusts externally supplied
  `helperEffectMatches`, `supervisorVerificationMatches`, `ownerIsCanonicalGroup`
  and `daclProtected`.

The B1 statement “protected-DACL in-memory descriptor construction” is not
supported by source.

## 13. Session / Epoch / Replay / Evidence

Implemented:

- authority/process/session tuple;
- epoch equality;
- per-session request-ID replay/conflict journal;
- one-time in-memory ticket map;
- in-memory Grant record;
- test-only Effect and security-event sinks.

Missing:

- `clientSequence` is never compared or advanced;
- `lastAcceptedSequence` is never updated;
- no session expiry field or enforcement;
- no generation monotonicity;
- no durable replay journal;
- Grant action/helper/release/operation binding absent;
- cancel/status use a caller-supplied `operationId` without ownership test;
- sessions and journals are never erased.

These are B2-P1-02 and B2-P2-08/B2-P2-09.

## 14. Side-effect Reachability

Current dispatcher reachable effects:

```text
P13Invoke/P13LaunchInvoke
-> in-memory session/Grant/launch state
-> TestEffectSink record
```

No reachable file, ACL, process, Job, Registry, Service, Database, Storage or
network effect was found.

Dangerous API reachability:

| API group | Definition | Caller from dispatcher | Current effect |
|---|---|---|---|
| `CreateProcessAsUserW` | Job adapter | none | no process |
| `CreateJobObjectW` | Job adapter | none | no Job |
| `TerminateProcess` | Job adapter | none | no termination |
| `SetEntriesInAclW` | SEALED adapter | none | memory only |
| `SetSecurityDescriptorDacl` | SEALED adapter | none | memory only |
| `AccessCheck` | SEALED adapter | none | no runtime check |
| ACL mutation APIs | none | none | none |
| Database/Storage/network | none | none | none |

Thus current Build-only binaries are source-safe at reachability level, but this
does not cure the authorization and lifecycle defects that would become
security-critical when connected to real effects.

## 15. Build Script and Manifest

Positive:

- fixed absolute `midl.exe`, `cl.exe`, `link.exe`, `dumpbin.exe`;
- fixed hashes for toolchain binaries and key headers/library;
- fixed SDK/MSVC versions;
- explicit include/lib paths;
- no download, installer, MSBuild target, `Invoke-Expression` or generated EXE
  execution;
- build script performs only MIDL, compile, link and `dumpbin`;
- PFR is checked before/after build;
- artifacts are hashed;
- Build Manifest sets `runtimeExecuted=false`.

Negative:

- `PATH` inherits the ambient environment after prepending the compiler
  directory, rather than enforcing a strict environment allowlist;
- source files are not hashed into the Build Manifest;
- static verifier checks textual order/count, not semantic authorization or
  state-transition correctness;
- Build Manifest omits `build.log`, `static-verification.json` and source hashes;
- binaries are unsigned;
- `/sdl` is not enabled (not a D1 hard requirement, but a hardening gap).

No evidence was found that `build.ps1` runs a generated binary.

## 16. Generated Code and PE Inspection

Generated output:

- two server dispatch tables, one routine each;
- two interface UUID/version pairs matching IDL;
- NDR fixed structures;
- server/client stubs compile and link.

PE facts:

```text
Architecture:              x64
Type:                      EXECUTABLE IMAGE
Subsystem:                 Windows CUI
High Entropy VA:           yes
Dynamic base:              yes
NX compatible:             yes
Control Flow Guard:        yes
Exports:                   none
```

Dependencies:

```text
RPCRT4.dll
bcrypt.dll
ADVAPI32.dll
KERNEL32.dll
```

No third-party DLL, network DLL or unexpected external dependency was found.

Important runtime mismatch:

- generated NDR reports serialized sizes `16544` and `16592`;
- `RpcServerRegisterIf3` sets `MaxRpcSize=16384`;
- the server would reject normal full-envelope calls before the manager.

## 17. 30-Test Reconciliation

There are no native test-source files. The only test description is
`manifest/test-traceability.json`, and every test is marked
`allowedInB1=false`.

| ID | Designed behavior | Executable native test source | Execution |
|---|---|---|---|
| T01 | valid call | none | `NOT EXECUTED` |
| T02 | wrong PID | none | `NOT EXECUTED` |
| T03 | wrong creation time | none | `NOT EXECUTED` |
| T04 | wrong token SID | none | `NOT EXECUTED` |
| T05 | wrong RPC principal | none | `NOT EXECUTED` |
| T06 | expired session | none | `NOT EXECUTED` |
| T07 | wrong epoch | none | `NOT EXECUTED` |
| T08 | replay | none | `NOT EXECUTED` |
| T09 | conflict | none | `NOT EXECUTED` |
| T10 | cross-authority injection | none | `NOT EXECUTED` |
| T11 | client exit during request | none | `NOT EXECUTED` |
| T12 | PID reuse | none | `NOT EXECUTED` |
| T13 | unauthorized caller | none | `NOT EXECUTED` |
| T14 | Helper revoke | none | `NOT EXECUTED` |
| T15 | Supervisor Job close | none | `NOT EXECUTED` |
| T16 | termination fallback | none | `NOT EXECUTED` |
| T17 | stale process handle | none | `NOT EXECUTED` |
| T18 | unauthorized Manager | none | `NOT EXECUTED` |
| T19 | revoke race | none | `NOT EXECUTED` |
| T20 | ticket reuse | none | `NOT EXECUTED` |
| T21 | restricted SID mismatch | none | `NOT EXECUTED` |
| T22 | normal SID missing | none | `NOT EXECUTED` |
| T23 | credential reference mismatch | none | `NOT EXECUTED` |
| T24 | Job assignment failure | none | `NOT EXECUTED` |
| T25 | resume failure | none | `NOT EXECUTED` |
| T26 | terminate fallback | none | `NOT EXECUTED` |
| T27 | wait timeout | none | `NOT EXECUTED` |
| T28 | Sealer evidence mismatch | none | `NOT EXECUTED` |
| T29 | old write handle open | none | `NOT EXECUTED` |
| T30 | UNKNOWN preservation | none | `NOT EXECUTED` |

MIDL compile, C++ compile, Link and static binary inspection are separate
evidence categories and do not execute these tests.

## 18. Findings

### P0 — Critical

None confirmed.

### P1-01 — Caller-class operation allowlists are never enforced

Evidence:

- `include/common/p13_types.h:154-165` declares per-descriptor operation lists.
- `src/authority/p13_authority_components.cpp:29-64,67-140` populates different
  Web/Worker and Helper operation vectors.
- `src/authority/p13_authority_service.cpp:116-183` authorizes identity,
  session, epoch and authority ID but never checks
  `descriptor.authorityOperations`.
- `src/authority/p13_authority_service.cpp:283-392` dispatches every known
  operation without a caller-class gate.
- `src/authority/p13_authority_service.cpp:398-526` likewise does not consult
  `descriptor.launchOperations`.
- `manifest/operation-contracts.json:25-350` claims caller-class restrictions
  and `grantRequired`, but these are not enforced.

Attack precondition:

- caller has a valid Staging Writer identity and active session.

Attack:

1. Send `P13Invoke` with Staging Writer `authorityId`.
2. Set `operation=0x0004` (`OPERATION_REQUEST_GRANT`), which R4-S7 allows only
   for Web/Worker.
3. Provide valid epoch, operation ID and request digest.
4. Authorization passes on identity/session/epoch.
5. Dispatcher enters the Web/Worker Grant branch at line 306 and records an
   authorized Effect.

Impact:

- helper-to-Web/Worker operation expansion;
- unauthorized operation reaching the dispatcher;
- future production wiring would create a direct authorization bypass.

Status:

`CONFIRMED STATIC P1 / BLOCKS RUNTIME`

### P1-02 — Helper operations do not enforce Grant/action/generation binding

Evidence:

- `src/authority/p13_authority_service.cpp:71-89` only requires a session for
  Helper operations and does not require `grantId`, `action` or generation.
- `src/authority/p13_authority_service.cpp:146-183` never checks a Grant.
- `src/authority/p13_authority_service.cpp:338-359` returns success for
  `HELPER_REGISTER`, `HELPER_HEARTBEAT` and `HELPER_EFFECT_COMMITTED` without
  checking `request.grantId`, action or helper type.
- `src/authority/p13_authority_service.cpp:361-371` checks only that some Grant
  ID exists; it does not compare Grant authority/operation/generation/action.
- `src/authority/p13_authority_components.cpp:309-321` can issue multiple
  Grants for the same operation.

Attack precondition:

- valid Helper RPC identity and active session.

Attack:

- invoke Helper register/effect/heartbeat with zero or unrelated `grantId`;
- use arbitrary generation/action;
- the dispatcher records authorized effect/evidence state without a valid
  one-time Grant.

Impact:

- Helper operation scope is not tied to the DB-issued launch/effect authority;
- stale or reused Helper capability can perform stateful operations;
- violates R4-S7 one-time Grant and request audience requirements.

Status:

`CONFIRMED STATIC P1 / BLOCKS RUNTIME`

### P1-03 — Launch state can be overwritten and UNKNOWN can become CLOSED

Evidence:

- `src/launch/p13_launch_components.cpp:5-13` uses
  `records_[launchSessionId] = record`, silently replacing an existing record.
- `src/authority/p13_authority_service.cpp:421-437` calls this on every
  `LAUNCH_SESSION_REGISTER`; request replay is keyed by request ID, so a fresh
  request ID can re-register the same launch session.
- `src/launch/p13_launch_components.cpp:75-88` only blocks CLOSED for
  `LaunchState::Running`; from `UNKNOWN`, `QUARANTINED`, `COMMITTED`,
  `PREPARED_SUSPENDED` or other states it directly assigns `Closed`.
- `src/authority/p13_authority_service.cpp:505-517` returns success for that
  close.

Attack:

1. Register launch session `S`.
2. Advance it to `UNKNOWN` or `QUARANTINED`.
3. Send `LAUNCH_SESSION_CLOSE`; `Close` sees state != Running and returns CLOSED.
4. Alternatively, register `S` again with a new request ID and reset its state.

Impact:

- explicit violation of “UNKNOWN shall not become CLOSED”;
- lost quarantine state;
- possible reuse of a live/unknown Helper process in a later implementation.

Status:

`CONFIRMED STATIC P1 / BLOCKS RUNTIME`

### P1-04 — Helper `SESSION_CLOSE` becomes CLOSED without Job/process proof

Evidence:

- `src/authority/p13_authority_service.cpp:291-303` directly calls
  `TestSessionStore::Close` for both Web/Worker and Helper classes.
- `src/authority/p13_authority_components.cpp:274-287` only changes enum state.
- No Job, process-signaled, handle-close, or Evidence reconciliation is checked.
- R4-S9 lines 270-297 explicitly requires the full Helper revoke sequence
  before `CLOSED`.

Attack:

- valid Helper sends `SESSION_CLOSE`;
- server changes the session to CLOSED while Helper process/Job could still be
  alive;
- B1 report lines 413-414 describe this as a “CLOSED test state”.

Impact:

- false termination evidence;
- permission for a future implementation to start a replacement Helper while
  old handles remain;
- violates the core revoke invariant.

Status:

`CONFIRMED STATIC P1 / BLOCKS RUNTIME`

### P1-05 — RPC principal is not mapped to process TokenUser

Evidence:

- `src/identity/windows_identity_adapter.cpp:52-105` reads `TokenUser`,
  `TokenGroups`, `TokenRestrictedSids`, `TokenIntegrityLevel` and
  `TokenSessionId`.
- `src/identity/windows_identity_adapter.cpp:229-245` compares RPC principal
  only to expected principal, then checks group SID presence and restricting SID
  presence.
- It never maps RPC principal name to a SID or compares that SID to
  `TokenUser`.
- It never compares `integrityLevel` or `windowsSessionId` to an expected
  allowlist.
- R4-S7 lines 387-393 requires exact mapping:

```text
RPC principal SID = process TokenUser
+ allowed service/restricting SID
+ allowed integrity/session
```

Impact:

- static proof cannot establish that the RPC-authenticated identity is the same
  Windows user as the process token;
- UPN/account-name aliases, delegated/impersonated contexts or token group
  manipulation are not cross-bound;
- current identity chain is incomplete for Runtime authorization.

Status:

`CONFIRMED STATIC P1 / RUNTIME AUTHORIZATION NOT PROVEN`

### P2-01 — `RpcServerListen` is invoked in nonblocking mode

Evidence:

- `src/server/p13_server_runtime.cpp:88` calls:

```cpp
RpcServerListen(1, RPC_C_LISTEN_MAX_CALLS_DEFAULT, TRUE);
```

- SDK signature at `rpcdce.h:935-939` names the third argument `DontWait`.
- `p13_server_runtime.cpp:90-97` immediately stops listening and unregisters
  both interfaces.

Impact:

- a configured runtime server would return immediately and unregister before
  serving requests;
- Runtime readiness is structurally blocked.

Status:

`CONFIRMED STATIC P2 / BLOCKS RUNTIME`

### P2-02 — RPC maximum size is smaller than generated request envelopes

Evidence:

- `src/server/p13_server_runtime.cpp:65-69` and `:79-83` pass
  `P13_MAX_PAYLOAD_BYTES` (`16384`) as `MaxRpcSize`.
- Generated NDR type sizes include `16544` and `16592` at
  `generated/x64/p13_authority_s.c:307,319,389`.
- Each request contains a fixed 16 KiB payload array plus headers and digests.

Impact:

- normal full-envelope calls are rejected before the manager;
- MaxRpcSize and payload limit are conflated.

Status:

`CONFIRMED STATIC P2 / BLOCKS RUNTIME`

### P2-03 — Restricted Token creation and ResumeThread are absent

Evidence:

- no source reference to `CreateRestrictedToken`, `DISABLE_MAX_PRIVILEGE`,
  `TokenRestrictedSids` creation, or `ResumeThread`;
- `include/lifecycle/p13_lifecycle_adapters.h:10-16` accepts a pre-built
  `helperPrimaryToken`;
- `src/lifecycle/job_lifecycle_adapter.cpp:43-52` treats it as trusted input;
- B1 report line 537 says `ResumeThread (not called)`, but the API/function is
  not implemented at all.

Impact:

- Restricted Helper construction is not implemented;
- suspended process can never be resumed by this adapter;
- Runtime requirements remain contract-only.

Status:

`CONFIRMED STATIC P2 / IMPLEMENTATION ABSENT`

### P2-04 — Authority descriptor security fields are inert

Evidence:

- `src/authority/p13_authority_components.cpp:67-140` stores helper type,
  credential reference and launch-ticket permission.
- Only `authorityId`, `callerClass`, `canonicalEndpoint`, identity strings and
  operation-vector construction are referenced.
- Search confirms `credentialReferenceDescriptor` and
  `launchTicketPermissionDescriptor` have no use beyond declaration/creation.
- `src/authority/p13_authority_components.cpp:144-150` maps both Web and Worker
  to the first `WebWorker` descriptor, so Worker session registration collapses
  into the Web descriptor at `p13_authority_service.cpp:249-258`.

Impact:

- credential/ticket scope is descriptive, not enforced;
- Worker authority identity is not preserved in the session record.

Status:

`CONFIRMED STATIC P2`

### P2-05 — Token SID attributes and empty expectations are fail-open

Evidence:

- `src/identity/windows_identity_adapter.cpp:73-84` copies SID strings without
  checking `SE_GROUP_ENABLED`, `SE_GROUP_USE_FOR_DENY_ONLY` or restricted-SID
  attributes.
- `src/identity/windows_identity_adapter.cpp:109-117` returns true when the
  expected SID string is empty.
- `src/identity/windows_identity_adapter.cpp:229-245` therefore can skip the
  principal/normal-group check if descriptor configuration is empty.
- R4-S9/S10 explicitly requires deny-only SIDs not to serve as allow
  capabilities.

Impact:

- a misconfigured descriptor can lose an authorization check;
- deny-only/disabled helper groups can satisfy a presence-only check.

Status:

`CONFIRMED STATIC P2 / FAIL-CLOSED CONFIGURATION REQUIRED`

### P2-06 — Impersonation fallback can report success before proving revert

Evidence:

- `src/identity/windows_identity_adapter.cpp:255-281` creates
  `ImpersonationGuard`, captures the thread token, then returns `Status::Ok`.
- `guard.reverted()` is evaluated while the guard is still alive, before its
  destructor calls `RpcRevertToSelf`.
- If `RpcRevertToSelf` later fails, no caller receives failure and no
  `QUARANTINED_THREAD` path exists.

Impact:

- any future use of the fallback can leak caller impersonation into a thread;
- violates the R4-S7 revert/quarantine requirement.

Status:

`CONFIRMED STATIC P2 / FALLBACK MUST NOT BE ENABLED`

### P2-07 — Launch ticket and release are client-described test data

Evidence:

- `src/authority/p13_authority_service.cpp:106-113` validates only non-zero
  launch/session/ticket IDs.
- `src/authority/p13_authority_service.cpp:421-430` stores release digest and
  Grant from the request.
- `src/launch/p13_launch_components.cpp:27-39` compares `Prepare` values with
  the same client-supplied record.

Impact:

- LAUNCH_PREPARE cannot prove DB-issued ticket, helper type, release or Grant;
- isolation depends on untrusted request fields.

Status:

`CONFIRMED STATIC P2 / TEST-ONLY SCOPE`

### P2-08 — Session sequencing, expiry, grant uniqueness and cancel ownership are incomplete

Evidence:

- `clientSequence` is never read in `src/authority/p13_authority_service.cpp`.
- `SessionRecord::lastAcceptedSequence` at `include/common/p13_types.h:144` is
  never updated.
- no session expiry field or check exists.
- `src/authority/p13_authority_service.cpp:323-325` cancels by caller-provided
  `operationId` without proving the operation belongs to the session.
- `src/authority/p13_authority_components.cpp:309-321` overwrites operation
  state and can issue multiple Grants.

Impact:

- request ordering and stale capability rejection are incomplete;
- cross-operation cancellation and duplicate Grant issuance are possible in the
  test metadata model.

Status:

`CONFIRMED STATIC P2`

### P2-09 — Session handle retention and cross-process transfer are incomplete

Evidence:

- `IdentityEvidence` holds a shared process handle at
  `include/common/p13_types.h:121-136`.
- `TestSessionStore` maps are never erased after CLOSE/REVOKE.
- `src/lifecycle/job_lifecycle_adapter.cpp:195-209` duplicates a handle from
  `GetCurrentProcess()` back into `GetCurrentProcess()`.

Impact:

- closed session handles remain alive until process exit;
- the claimed Launch Authority → Supervisor cross-process handle transfer is not
  implemented.

Status:

`CONFIRMED STATIC P2`

### P2-10 — SEALED DACL and dual evidence are not complete

Evidence:

- `src/lifecycle/sealed_adapter.cpp:90-111` builds an in-memory descriptor and
  self-relative SD but never sets `SE_DACL_PROTECTED`.
- no allow ACL, inheritance check, ACE-order readback or per-subject
  `AccessCheck` matrix is implemented.
- `src/lifecycle/sealed_adapter.cpp:19-50` trusts caller-supplied boolean
  proofs for Publisher/Sealer exit, owner/DACL correctness and evidence match.
- only one file identity record exists.

Impact:

- “protected DACL” claim is false;
- no independent dual-observation comparison exists;
- future integration can produce false SEALED evidence.

Status:

`CONFIRMED STATIC P2 / NO REAL ACL MUTATION OCCURRED`

### P2-11 — SHA-256 failure is fail-open

Evidence:

- `src/common/p13_types.cpp:66-105` returns all-zero digest on BCrypt failure.
- `src/authority/p13_authority_service.cpp:31-34` compares the computed digest
  with the client's `requestDigest`.
- A client that submits zero digest passes when hashing fails.

Impact:

- request-digest integrity check can be bypassed under crypto/resource failure.

Status:

`CONFIRMED STATIC P2`

### P2-12 — 30 test scenarios have no executable native test source

Evidence:

- only `manifest/test-traceability.json` and static logs match a test-name
  search;
- all 30 entries are `allowedInB1=false`;
- no C/C++ test runner or runtime harness source exists;
- build-only compile/link cannot validate identity, Job, revoke, ACL or
  concurrency.

Impact:

- Runtime readiness has no executable negative-test foundation;
- test matrix is documentation only.

Status:

`CONFIRMED STATIC P2`

### P2-13 — Build environment and source provenance are not fully pinned

Evidence:

- `build.ps1:104` prepends the fixed compiler path but retains the inherited
  `PATH`.
- `build.ps1:151-156` uses fixed flags but not an environment allowlist.
- Build Manifest at `build-manifest.json` lists artifacts/toolchain but no source
  file hashes.
- `verify-static.ps1:27-30,79-98` checks textual count/order and file hash
  existence, but not operation allowlist semantics, Grant enforcement, state
  transitions, or API reachability.

Impact:

- build reproducibility is partial;
- static verification can report green while the P1 defects above exist.

Status:

`CONFIRMED STATIC P2`

### P3-01 — Generated/B1 report claims exceed source evidence

Examples:

- B1 report line 475 says RPC principal and process token cross-check, but no
  cross-check exists.
- B1 report line 537 implies `ResumeThread` is implemented but merely not called;
  it is absent.
- B1 report line 560 says protected-DACL construction; `SE_DACL_PROTECTED` is
  absent.

Status:

`P3 DOCUMENTATION ACCURACY`

### P3-02 — Binary signing absent

Both PE binaries are `NotSigned`. This is expected for the local Harness, but
they are not release artifacts.

### P3-03 — `/sdl` not enabled

Build uses `/GS /guard:cf`, PE has NX/ASLR/CFG, but `/sdl` is absent. This is a
hardening choice, not a current D1 hard failure.

### P3-04 — Identity tuple vector comparison is order-sensitive

`src/authority/p13_authority_components.cpp:18-27` compares group/restricted SID
vectors in order. A harmless token group order variation can deny a valid
session; this is fail-closed but operationally brittle.

### P3-05 — Retained stray object

`tools/native-rpc/p13-a1-r2/p13_authority_s.obj` is an early build artifact
outside the normal `obj/x64` tree. It is ignored and hashed, but adds
reproducibility clutter.

## 19. Side Effect and Runtime Non-actions

No generated EXE was executed. No:

- RPC Server/Client launch;
- endpoint registration;
- RPC binding/call;
- Helper launch;
- process/Job/Token creation;
- `TerminateProcess`;
- ACL/DACL/Owner modification;
- Registry/PFR write;
- Service/Task Scheduler operation;
- Database/SQL/Migration;
- Storage read/write/delete;
- `.env` or secret read;
- Git write;
- deployment.

Current source reachability of dangerous APIs remains confined to compiled
adapters that are not invoked by the dispatchers.

## 20. PFR and Protected Object Reconciliation

Start and end baseline:

```text
REG_MULTI_SZ
46 strings
23 pairs
23 DELETE operations
SHA-256:
0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC
```

Original 19 items and installer-related PFR-020–PFR-023 retain the same order.
PFR-020–PFR-023 remain:

```text
UNAPPROVED / NOT INCLUDED IN ANY EXCEPTION
```

Protected hashes:

| Object | SHA-256 | Result |
|---|---|---|
| FZ | `E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705` | MATCH |
| ST | `5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586` | MATCH |
| DBTP | `FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7` | MATCH |
| Prisma Schema | `78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299` | MATCH |
| `next-env.d.ts` | `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC` | MATCH |
| `tsconfig.tsbuildinfo` | `21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520` | MATCH |

`$null` and `$null)` are absent. `.next` and Worker `dist` remain:

```text
WHOLE-TREE HISTORY: NOT VERIFIED
```

## 21. Git Before / After

Before B2:

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 26
Untracked: 220
Staged: 0
Deleted: 0
```

Expected after this report:

```text
Tracked modified: 26
Untracked: 221
Staged: 0
Deleted: 0
```

The only intended new visible file is:

```text
docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r4-b2-independent-native-rpc-adversarial-review.md
```

## 22. NOT VERIFIED / UNKNOWN

```text
RPC Runtime identity acquisition:
NOT VERIFIED

Real process token / RPC principal equality:
NOT VERIFIED

PID reuse behavior:
NOT VERIFIED

Process exit cancellation:
NOT VERIFIED

Restricted token creation and double AccessCheck:
NOT IMPLEMENTED / NOT VERIFIED

Job JOB_LIST / handle transfer / Resume:
NOT EXECUTED

Terminate/Wait/reconciliation:
NOT EXECUTED

Owner Rights / protected DACL on real object:
NOT EXECUTED

Old write-handle proof:
NOT VERIFIED

WMI/SCM/Task Scheduler/COM outside-Job:
NOT VERIFIED

Crash-safe replay:
NOT IMPLEMENTED

Durable Grant/COMMIT unknown:
NOT IMPLEMENTED

Runtime Evidence persistence:
NOT IMPLEMENTED

30 native tests:
NOT EXECUTED

Production integration:
NOT IMPLEMENTED

Build artifact signing:
NOT PRESENT
```

## 23. Final Security Gate

```text
Overall:
FAIL

Review Independence:
PASS

B1 Report Integrity:
HASH PASS / CONTROL CLAIMS PARTIAL

Harness Inventory:
PASS

IDL / MIDL:
PASS WITH P2 MAX-RPC MISMATCH

RPC Public Managers:
PASS — EXACTLY TWO

Per-Call Authorization:
FAIL — OPERATION ALLOWLIST AND GRANT BINDING INCOMPLETE

Caller PID:
PASS STATIC

Process Handle Identity:
PARTIAL

Process Creation Time:
PASS STATIC

Token / SID:
PARTIAL — PRESENCE ONLY / ATTRIBUTES NOT ENFORCED

RPC Principal:
FAIL — NO TOKEN USER BINDING

13 Authority Operations:
CONTRACT PRESENT / ENFORCEMENT FAIL

6 Launch Operations:
CONTRACT PRESENT / STATE SAFETY FAIL

Four Launch Authorities:
PARTIAL — DESCRIPTORS ONLY / CREDENTIAL SCOPE INERT

Restricted Token:
PARTIAL — PRECONDITIONS ONLY

Job Lifecycle:
PARTIAL — NO RESTRICTED TOKEN / RESUME / CROSS-PROCESS TRANSFER

Revoke:
FAIL — FALSE CLOSED POSSIBLE

SEALED / OWNER RIGHTS:
PARTIAL — NO PROTECTED DACL OR DUAL OBSERVATION

Session / Epoch:
PARTIAL

Replay / Evidence:
PARTIAL — IN-MEMORY ONLY

Test-only Effect Isolation:
FAIL FOR CALLER-CLASS AUTHORIZATION / NO REAL OS EFFECT FOUND

Build Script:
PASS WITH WARNINGS

Build Manifest:
PASS WITH WARNINGS

PE Static Inspection:
PASS

Build Security Flags:
PASS WITH WARNINGS

30-Test Traceability:
DESIGNED / 0 EXECUTED

PFR Queue Stability:
PASS

PFR Exception Status:
NEW FOUR STILL UNAPPROVED

Repository Integrity:
PASS

P0:
0

P1:
5

P2:
13

P3:
5

Native RPC Runtime:
NOT EXECUTED

Next Gate:
INDEPENDENT REMEDIATION REQUIRED
```

## 24. Required Next Action

Do not grant Runtime authorization from this review.

An independently authorized remediation phase must first address:

1. enforce exact caller-class operation allowlists before dispatch;
2. bind Helper operations to one valid Grant/action/generation/release/object
   audience;
3. enforce monotonic client sequence and session expiry;
4. implement a fail-closed operation ownership model for cancel/status;
5. prevent LaunchSession overwrite and forbid UNKNOWN/QUARANTINED → CLOSED;
6. implement the full Helper Session revoke sequence;
7. map RPC principal SID to process TokenUser and enforce integrity/session
   allowlists;
8. inspect SID attributes and reject deny-only/disabled allow capabilities;
9. implement restricted-token creation and `ResumeThread`;
10. implement cross-process handle transfer;
11. implement a true protected DACL and dual observed SEALED evidence;
12. fix `RpcServerListen`, `MaxRpcSize`, launch endpoint wiring and runtime SDDL
    configuration;
13. make SHA-256 failure produce an explicit deny;
14. add executable test source for the 30 scenarios;
15. strengthen build provenance and static verification.

After remediation, a new independent B3 review is required. Runtime remains
`NOT AUTHORIZED`.

## 25. Report Integrity

This report was frozen without embedding its own hash because inserting the hash
would change the file. Its SHA-256 is returned externally after final read-only
verification.

