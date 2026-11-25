# P1-3 C-6.2-L8-A7.20-R4-A1-R2 Native RPC Toolchain Provisioning Design

## 0. Status

```text
Stage: C-6.2-L8-A7.20-R4-A1-R2
Mode: TOOLCHAIN PROVISIONING DESIGN ONLY
Windows SDK / MIDL / MSVC installation: NOT EXECUTED
Native RPC compilation: NOT EXECUTED
Native RPC Server / Client: NOT EXECUTED
Source / project modifications: NONE
```

This document specifies the minimal toolchain and isolated native RPC validation
harness for a later separately authorized implementation phase. It does not
install tools, build binaries, start RPC, or modify `authority-core`.

## 1. Current Environment

Read-only inventory:

| Item | Result |
|---|---|
| OS | Windows 11 Home, 10.0.26300, x64 |
| PowerShell | 7.6.9 |
| Current user | non-administrator |
| Developer Command Prompt | not initialized |
| DevEnvDir / VCINSTALLDIR / VSINSTALLDIR / WindowsSdkDir | empty |
| Windows SDK roots | absent |
| MIDL | unavailable |
| MSVC `cl.exe` / `link.exe` / `dumpbin.exe` | unavailable |
| Visual Studio / Build Tools | not found |
| `vswhere.exe` | unavailable |
| .NET Framework csc | present (`14.8.10001.0`) |
| .NET SDK | absent |
| `C:\Windows\System32\rpcrt4.dll` | present, `10.0.26100.9949` |
| `C:\Windows\System32\RpcPing.exe` | present, `10.0.26100.9949` |
| RPC headers / import library | not found in installed toolchain roots |

Distinction:

```text
RPC Runtime: PRESENT
Windows SDK: MISSING
MIDL: MISSING
MSVC C++: MISSING
Native RPC Build: BLOCKED
```

## 2. Official API References

Query date: `2026-11-20`.

| Microsoft Source | API / Concept | Relevant guarantee | Boundary |
|---|---|---|---|
| [ncalrpc](https://learn.microsoft.com/en-us/windows/win32/rpc/protocol-sequence-constants) | local RPC sequence | local client/server transport | endpoint/identity behavior requires real test |
| [RPC authentication levels](https://learn.microsoft.com/en-us/windows/win32/rpc/authentication-level-constants) | `RPC_C_AUTHN_LEVEL_PKT_PRIVACY` | ncalrpc uses privacy | principal/token consistency remains to be tested |
| [`RpcServerInqCallAttributesW`](https://learn.microsoft.com/en-us/windows/win32/api/rpcasync/nf-rpcasync-rpcserverinqcallattributesw) | call attributes | current call security context | failures/incomplete data must deny |
| [`RPC_CALL_ATTRIBUTES_V2_W`](https://learn.microsoft.com/en-us/windows/win32/api/rpcasync/ns-rpcasync-rpc_call_attributes_v2_w) | ClientPID | ncalrpc local PID field | PID alone is not a process object proof |
| [`RpcServerRegisterIf3`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdce/nf-rpcdce-rpcserverregisterif3) | interface registration | security callback/SD support | callback frequency is not a per-call guarantee |
| [`RpcImpersonateClient`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdce/nf-rpcdce-rpcimpersonateclient) | client impersonation | active RPC client context | failure/identify/revert handling must be tested |
| [`RpcBindingInqAuthClient`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdce/nf-rpcdce-rpcbindinginqauthclient) | auth client data | authentication/principal fields | principal is not process token |
| [`OpenProcess`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-openprocess) | process object | access rights/DACL | cross-SID access remains runtime-specific |
| [`GetProcessTimes`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes) | creation time | timestamp for process object | held process handle needed for PID reuse protection |
| [`OpenProcessToken`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-openprocesstoken) | token access | token handle | token access requires rights |
| [`GetTokenInformation`](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-gettokeninformation) | User/Groups/Integrity | token SID/integrity fields | field sizing/version handling needed |

## 3. Toolchain Options

### Option A — Minimal Windows SDK + MSVC Build Tools

Recommended base:

```text
Windows SDK
  - MIDL
  - RPC headers: rpc.h, rpcndr.h, rpcdce.h, rpcasync.h
  - import library: Rpcrt4.lib
Visual Studio 2022 Build Tools
  - MSVC v143 x64
  - Desktop development with C++ / Windows SDK component
```

No CMake/Ninja is required for a small fixed harness; use MSBuild or direct
compiler/linker commands after the toolchain is verified.

Advantages:

- smallest practical install for this task;
- MIDL and MSVC versions can be pinned and verified;
- no need to integrate native code into Next/Worker.

Limitations:

- likely requires administrator approval;
- SDK/MSVC compatibility must be measured;
- installation changes system-wide components.

### Option B — Full Visual Studio IDE

Not necessary for R4-A1-R2. The IDE adds debugging and editor components that do
not improve the security proof. It may be useful later for native diagnostics,
but is not the minimal requirement.

### Option C — Independent Native Harness

Recommended architecture:

```text
tools/native-rpc/p13-a1-r2/     (future, not created)
  P13Authority.idl
  generated/
  server/
  client/
  build/
```

The native product is not linked into Web, Worker, contracts or production
packages. A Node test driver launches fixed server/client executables with:

- fixed argv allowlist;
- fixed environment allowlist;
- fixed cwd;
- bounded timeout;
- JSON evidence on stdout;
- explicit exit code;
- no real DB/Storage/Job/ACL/Service access.

Recommendation:

```text
Option A + Option C
```

## 4. Native RPC Harness

### 4.1 Components

```text
P13NativeRpcServer
  - ncalrpc endpoint
  - one RPC manager
  - AuthorizeCurrentCall before test dispatcher

P13NativeRpcClient
  - independent client process
  - one no-side-effect test operation
  - no target/storage/database payload
```

No real Helper, Job, Storage, DB, Windows Service, ACL, credential or cleanup
is created.

### 4.2 Per-call authorization

Each manager call:

1. `RpcServerInqCallAttributes`;
2. validate ncalrpc/WINNT/PKT_PRIVACY;
3. obtain current `ClientPID`;
4. `OpenProcess` query/synchronize;
5. `GetProcessTimes` creation time;
6. `OpenProcessToken` + token User/Groups/Integrity/Session;
7. validate RPC principal and process token relation;
8. validate Authority binding, Session, Epoch and request ID;
9. only then invoke a no-side-effect dispatcher.

Security callback is only a coarse filter. It is not the sole authorization
gate.

### 4.3 JSON evidence

Server/client output is test-only JSON:

```text
{
  "testId": "...",
  "phase": "NATIVE_RPC_RUNTIME",
  "endpoint": "p13-authority-a1-r2",
  "clientPid": 1234,
  "processCreationTime": "...",
  "rpcPrincipal": "...",
  "identityMatch": true,
  "authorization": "ALLOW|DENY",
  "sideEffects": 0,
  "errorCode": null
}
```

No raw credentials, tokens, private keys or production paths are emitted.

## 5. TypeScript Integration

The existing `AuthorityServer.invoke` and `RpcCallEvidence` remain the trusted
logic boundary. `processHandleKey` is currently a logical test identifier, not
a Windows handle. The native adapter must supply an opaque server-owned process
reference and real creation-time/token evidence.

For R4-A1-R2, the native harness may first validate identity primitives and
emit JSON. A later staged integration must use a reviewed native adapter or
N-API bridge; ordinary application code must not construct `RpcCallEvidence`
from client data.

## 6. Validation Matrix

| Test | Level | Needs | Expected |
|---|---|---|---|
| valid server/client | NATIVE RPC RUNTIME | SDK/toolchain | ALLOW |
| wrong Authority | NATIVE RPC / LOGICAL | fixed fixtures | DENY, 0 effects |
| wrong RPC principal | WINDOWS IDENTITY | token fixture | DENY |
| missing/wrong PID | WINDOWS IDENTITY | process fixture | DENY |
| PID exited | WINDOWS IDENTITY | process lifecycle | DENY |
| PID reuse | WINDOWS IDENTITY | process fixture | DENY |
| creation-time mismatch | WINDOWS IDENTITY | held handle | DENY |
| token SID mismatch | WINDOWS IDENTITY | test account/fixture | DENY |
| auth level/service mismatch | NATIVE RPC | call fixture | DENY |
| missing/closed Session | LOGICAL | TS test | DENY |
| stale Epoch | LOGICAL | TS test | DENY |
| cross-Authority Session | LOGICAL | TS test | DENY |
| replay | LOGICAL / NATIVE | request journal | DENY |
| concurrent calls | NATIVE / LOGICAL | two clients | isolated |
| authorization failure | NATIVE / LOGICAL | negative fixture | 0 effects |
| callback absent | NATIVE RPC | manager wrapper | still auth |
| server crash | NATIVE RPC | process harness | no CLOSED |
| client crash | NATIVE RPC | process harness | session stale |
| endpoint close | NATIVE RPC | cleanup | no binding |
| timeout | NATIVE RPC | bounded driver | UNKNOWN/deny |

Tests requiring two Windows users/logon sessions or administrator rights are
not available in the current non-admin shell and are future authorization
items.

## 7. Installation and Rollback

Installation is not authorized in this phase.

Before installation:

1. record OS, PowerShell, SDK/MIDL/MSVC absence, PATH/INCLUDE/LIB;
2. record current Node/pnpm/TypeScript versions;
3. record protected hashes and `.next`/Worker `dist` state;
4. record installer component list;
5. confirm no existing project build uses native code.

After installation:

1. verify `vswhere.exe`, `midl.exe`, `cl.exe`, `link.exe`, `dumpbin.exe`;
2. verify RPC headers and `Rpcrt4.lib` under the selected SDK;
3. verify exact versions and x64 architecture;
4. run no compile until a separate implementation authorization.

Rollback:

- use the SDK/Build Tools installer only to remove the exact components added;
- restore PATH/INCLUDE/LIB only from the recorded pre-install values;
- never delete the entire Visual Studio or Windows Kits directory by default;
- verify Node/pnpm/Next/Worker and protected hashes were unchanged;
- if exact rollback cannot be proven, stop and report BLOCKED.

## 8. Final Design Decision

```text
Recommended toolchain:
Windows SDK (MIDL + RPC headers/libs)
+ Visual Studio 2022 Build Tools with MSVC v143 x64
+ independent Native RPC test harness

Installation:
NOT PERFORMED

Native build/runtime:
BLOCKED UNTIL TOOLS INSTALLED

Source changes:
NONE
```
