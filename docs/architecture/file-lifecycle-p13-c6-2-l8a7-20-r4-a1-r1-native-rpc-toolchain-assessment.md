# P1-3 C-6.2-L8-A7.20-R4-A1-R1 Native RPC Toolchain Assessment

## 0. Assessment Status

```text
Stage: C-6.2-L8-A7.20-R4-A1-R1
Mode: READ-ONLY ENVIRONMENT INVENTORY + FEASIBILITY DESIGN
Toolchain inventory: COMPLETE
Native RPC build: BLOCKED
Native RPC runtime: NOT EXECUTED
Stage worktree protection: BLOCKED
Source / system changes: NONE BY THIS ASSESSMENT
```

The assessment found two unexpected root files, `$null` and `$null)`, that are
not part of the project. They are recorded as an execution/process incident
under the mandatory worktree protection rule. They were not deleted or
restored.

## 1. Environment Inventory

Read-only observations:

```text
Edition: Windows 11 Home (Chinese)
Version: 10.0.26300
Build: 26300
Architecture: x64
PowerShell: 7.6.9
User: thinkbook
Administrator: No
Developer environment initialized: No
DevEnvDir / VCINSTALLDIR / VSINSTALLDIR / WindowsSdkDir: empty
```

No system setting, PATH, registry, environment variable, service or account was
changed.

## 2. Toolchain Inventory

### 2.1 Windows SDK

```text
WINDOWS SDK: NOT INSTALLED
```

Observed:

- `C:\Program Files\Windows Kits` missing;
- `C:\Program Files (x86)\Windows Kits` missing;
- Windows Kits SDK registry roots missing in the inspected hives;
- no SDK Include/Lib/Bin tree;
- no inspected RPC headers (`rpc.h`, `rpcndr.h`, `rpcdce.h`, `rpcasync.h`,
  `rpcproxy.h`);
- no inspected `Rpcrt4.lib`.

### 2.2 MIDL

```text
MIDL: NOT AVAILABLE
```

`midl.exe` was not resolved by `where.exe`, `Get-Command`, or inspected SDK /
Visual Studio roots. No MIDL compilation was attempted.

### 2.3 MSVC / Visual Studio

```text
MSVC C++ TOOLCHAIN: NOT AVAILABLE
```

Observed:

- no Visual Studio installation root;
- no Visual Studio Build Tools root;
- no `vswhere.exe`;
- `cl.exe`, `link.exe`, and `dumpbin.exe` not found;
- no C++ Windows Desktop workload verified.

The presence of ordinary .NET Framework MSBuild directories is not a C++
Native RPC toolchain.

### 2.4 .NET

```text
dotnet runtime: 6.0.8
dotnet SDK: NOT INSTALLED
C# compiler: C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe
C# compiler version: 14.8.10001.0
```

C# is available, but it does not replace MIDL/MSVC for the intended native RPC
harness unless a separate supported managed design is approved.

### 2.5 RPC Runtime

```text
RPC RUNTIME: PRESENT
```

Observed:

| File | Version | Size |
|---|---|---:|
| `C:\Windows\System32\rpcrt4.dll` | `10.0.26100.9949` | 1,182,928 |
| `C:\Windows\System32\RpcPing.exe` | `10.0.26100.9949` | 57,344 |

This proves the runtime component exists, not that a native RPC program can be
built or that `ncalrpc` identity behavior is verified on this host.

## 3. Development vs Runtime Distinction

```text
RPC Runtime Availability: PRESENT
Windows SDK Availability: MISSING
RPC Headers/Import Libraries: MISSING
MIDL Availability: MISSING
MSVC Compiler/Linker: MISSING
Native RPC Build Feasibility: BLOCKED
Native ncalrpc Runtime Feasibility: NOT EXECUTED
```

## 4. Official API Semantics

Query date: `2026-11-20`.

| Official Source | API / Structure | Guaranteed behavior | Not guaranteed / test needed |
|---|---|---|---|
| [ncalrpc protocol sequence](https://learn.microsoft.com/en-us/windows/win32/rpc/protocol-sequence-constants) | `ncalrpc` | local RPC protocol | actual endpoint registration and call behavior |
| [Authentication levels](https://learn.microsoft.com/en-us/windows/win32/rpc/authentication-level-constants) | `RPC_C_AUTHN_LEVEL_PKT_PRIVACY` | ncalrpc uses privacy | principal/token consistency |
| [`RpcServerInqCallAttributesW`](https://learn.microsoft.com/en-us/windows/win32/api/rpcasync/nf-rpcasync-rpcserverinqcallattributesw) | call attributes | current call security attributes | failure/incomplete fields must be rejected |
| [`RPC_CALL_ATTRIBUTES_V2_W`](https://learn.microsoft.com/en-us/windows/win32/api/rpcasync/ns-rpcasync-rpc_call_attributes_v2_w) | `ClientPID` | local-client PID field for ncalrpc | PID is not sufficient; real process handle needed |
| [`RpcServerRegisterIf3`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdce/nf-rpcdce-rpcserverregisterif3) | interface registration | interface security descriptor/callback | callback frequency is not a per-call guarantee |
| [`RpcImpersonateClient`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdce/nf-rpcdce-rpcimpersonateclient) | impersonation | client thread impersonation | exception/revert behavior requires runtime test |
| [`RpcBindingInqAuthClient`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdce/nf-rpcdce-rpcbindinginqauthclient) | auth client info | principal/auth fields | principal and process token remain distinct |
| [`OpenProcess`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-openprocess) | process handle | DACL/access check | cross-service-SID access and handle rights |
| [`GetProcessTimes`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes) | creation time | process creation timestamp | requires held handle for PID reuse protection |
| [`OpenProcessToken`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-openprocesstoken) | process token | opens process token | token access rights/runtime behavior |
| [`GetTokenInformation`](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-gettokeninformation) | User/Groups/Integrity | token fields | field sizing and failure behavior |
| [Restricted Tokens](https://learn.microsoft.com/en-us/windows/win32/secauthz/restricted-tokens) | restricting SIDs | two access checks | belongs to R4-A2, not this phase |

## 5. Minimal Native Harness Design

Future R4-A1-R2 should use a standalone test harness:

```text
P13NativeRpcServer.exe
  ncalrpc endpoint p13-authority-a1-r2
  one test manager P13Invoke
  RpcServerInqCallAttributes
  ClientPID
  OpenProcess + GetProcessTimes
  process token/SID
  AuthorizeCurrentCall before dispatcher

P13NativeRpcClient.exe
  independent client process
  ncalrpc binding
  one no-side-effect operation
```

The server must not touch Storage, DB, Helper, Job, ACL, Restricted Token or
production services. Test output is structured JSON with redacted evidence.

## 6. Integration Options

### Option A — independent C/C++ test project

- maximum build isolation;
- no Next/Worker build impact;
- requires SDK/MIDL/MSVC.

### Option B — standalone native test package/harness

- Node test driver launches server/client with fixed argv/env/cwd/timeout;
- JSON stdout and exit status are evidence;
- no application runtime linkage;
- recommended for R4-A1-R2.

### Option C — application/monorepo build integration

- risks pnpm lockfile, Next/Worker build, protected caches and CI;
- rejected for this phase.

Recommendation: **Option B**, standalone native harness under a separately
authorized isolated output directory.

## 7. Runtime Test Matrix

| # | Test | R4-A1 | Need | Execution status |
|---:|---|---|---|---|
| 1 | valid client/server | yes | native harness | not executed |
| 2 | unauthenticated client | yes | native harness | not executed |
| 3 | different Windows user | later | second test user | not available |
| 4 | different logon session | later | test session | not available |
| 5 | RPC principal mismatch | yes | native/token fixture | not executed |
| 6 | PID missing | yes | native harness | not executed |
| 7 | process exited | yes | process fixture | not executed |
| 8 | PID reuse | yes | process fixture/time control | not executed |
| 9 | creation-time mismatch | yes | process fixture | not executed |
| 10 | token SID mismatch | yes | test identity | not executed |
| 11 | auth level mismatch | yes | native harness | not executed |
| 12 | auth service mismatch | yes | native harness | not executed |
| 13 | missing session | yes | TS adapter | logical only |
| 14 | closed session | yes | TS adapter | logical only |
| 15 | stale epoch | yes | TS adapter | logical only |
| 16 | Authority mismatch | yes | TS adapter | logical only |
| 17 | replay | yes | TS adapter | logical only |
| 18 | concurrent calls | yes | native/TS | not executed |
| 19 | revoke race | boundary | R4-A3/Job design | not authorized |
| 20 | server crash | yes | native harness | not executed |
| 21 | client crash | yes | native harness | not executed |
| 22 | server restart | yes | native harness | not executed |
| 23 | binding invalid | yes | native harness | not executed |
| 24 | call timeout | yes | native harness | not executed |
| 25 | identity API exception | yes | native harness | not executed |

## 8. Current Authority Core Reuse

Reusable as transport-neutral logic:

- `Authorities` and `AuthorityBinding`;
- expected principal/service/restricting SID checks;
- `RpcCallEvidence`;
- `StrictRpcIdentityProvider`;
- `AuthorityServer.invoke`;
- session/epoch/replay and logical isolation tests.

Need native adapter:

- `ncalrpc` server/client and MIDL stubs;
- trusted identity provider from Windows APIs;
- real process handle ownership;
- callback-absent and native concurrency tests.

`processHandleKey` in the current core is a logical test key, not a Windows
handle. It must not be represented as a kernel handle.

## 9. Toolchain Installation Recommendation

Do not install in R4-A1-R1. A separately authorized R4-A1-R2 would need:

1. Windows SDK with RPC headers/import libraries and MIDL.
2. Visual Studio 2022 Build Tools with Desktop development with C++ /
   MSVC v143 x64.
3. A compatible Windows SDK/MSVC pair.

Official pages:

- Windows SDK: <https://developer.microsoft.com/windows/downloads/windows-sdk/>
- Visual Studio downloads: <https://visualstudio.microsoft.com/downloads/>

After installation, verify with read-only:

```text
vswhere.exe -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64
where.exe midl.exe
where.exe cl.exe
where.exe link.exe
where.exe dumpbin.exe
```

Installation requires separate approval and may require administrator rights.

## 10. Worktree Incident

Two unexpected files appeared in repository root:

```text
$null   65 bytes  SHA-256 8AD444F42168AB885CB04D8E5446BF899E7F4B5B35068A91020F415BF661BC49
$null)  65 bytes  SHA-256 8AD444F42168AB885CB04D8E5446BF899E7F4B5B35068A91020F415BF661BC49
```

They were created by command redirection during read-only inspection. The
assessment did not delete, restore, move or edit them. This is a
worktree-protection incident and blocks normal R4-A1-R1 completion.

## 11. Final Assessment Status

```text
Toolchain Assessment:
COMPLETE

RPC Runtime:
PRESENT

Windows SDK / MIDL / MSVC:
NOT AVAILABLE

Native ncalrpc Build:
BLOCKED

Native ncalrpc Runtime:
NOT EXECUTED

Worktree Protection:
BLOCKED — unexpected $null files

Final R4-A1-R1:
BLOCKED
```
