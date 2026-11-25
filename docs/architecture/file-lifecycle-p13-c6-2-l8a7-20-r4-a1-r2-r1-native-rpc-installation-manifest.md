# P1-3 C-6.2-L8-A7.20-R4-A1-R2-R1 Native RPC Installation Manifest

## 0. Status

```text
Stage: C-6.2-L8-A7.20-R4-A1-R2-R1
Mode: READ-ONLY INSTALLATION MANIFEST REVIEW
Installation: NOT EXECUTED / NOT AUTHORIZED
Download: NOT EXECUTED
Native build/runtime: NOT EXECUTED
Final R4-A1-R2-R1: BLOCKED BY WORKTREE INCIDENT
```

本清单供下一阶段人工批准，不构成安装授权。

## 1. Environment Inventory

Read-only observations:

```text
OS: Windows 11 Home (Chinese)
Version: 10.0.26300
Build: 26300
Architecture: x64
PowerShell: 7.6.9
Current user: thinkbook
Administrator: No
System C: free ~315,890,499,584 bytes; used ~220,980,408,320 bytes
Node.js: 24.22.1
pnpm: 11.25.0
TypeScript: project toolchain present
Python: present (path recorded, version not separately selected)
VS Code: present
```

Toolchain:

| Item | Observation |
|---|---|
| Windows SDK | not installed |
| SDK Include/Lib/Bin | absent |
| MIDL | unavailable |
| MSVC `cl.exe` / `link.exe` | unavailable |
| `dumpbin.exe` / `vswhere.exe` | unavailable |
| Visual Studio/Build Tools | not found |
| `.NET SDK` | not installed |
| .NET Framework csc | present, `14.8.10001.0` |
| `rpcrt4.dll` | present, `10.0.26100.9949` |
| RPC headers/import library | not found in installed roots |

This means:

```text
RPC Runtime: PRESENT
Native RPC Build Toolchain: ABSENT
```

## 2. Official Sources

Query date: `2026-11-20`.

| Source | URL | Relevant fact |
|---|---|---|
| Visual Studio Build Tools component IDs | <https://learn.microsoft.com/en-us/visualstudio/install/workload-component-id-vs-build-tools?view=vs-2022> | current VS 2022 Build Tools workload and component IDs |
| Visual Studio installer command line | <https://learn.microsoft.com/en-us/visualstudio/install/use-command-line-parameters-to-install-visual-studio?view=vs-2022> | `--add`, `--includeRecommended`, `--passive`, `--wait` installation controls |
| Windows SDK download | <https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/> | official SDK entry point |
| Classic MIDL | <https://learn.microsoft.com/en-us/windows/win32/midl/midl-start-page> | classic RPC/COM MIDL compiler documentation |
| ncalrpc protocol sequence | <https://learn.microsoft.com/en-us/windows/win32/rpc/protocol-sequence-constants> | local RPC transport |
| RPC call attributes | <https://learn.microsoft.com/en-us/windows/win32/api/rpcasync/f-rpcasync-rpcserverinqcallattributesw> | per-call security attributes |

The VS component page currently lists:

```text
Microsoft.VisualStudio.Workload.VCTools
Microsoft.VisualStudio.Component.VC.Tools.x86.x64
Microsoft.VisualStudio.Component.Windows11SDK.26100
```

The page labels the Windows SDK component Recommended, but this does not by
itself prove the exact classic MIDL and RPC header/library payload. Those must
be verified after installation.

## 3. Installation Manifest

### A. Required

| Product / component | Candidate ID | Purpose | Necessity | Evidence |
|---|---|---|---|---|
| Visual Studio 2022 Build Tools | `Microsoft.VisualStudio.2022.BuildTools` | native build host | required | winget package metadata; official VS installer |
| C++ desktop workload | `Microsoft.VisualStudio.Workload.VCTools` | C++ compiler/linker ecosystem | required | Microsoft component page |
| MSVC v143 x64/x86 | `Microsoft.VisualStudio.Component.VC.Tools.x86.x64` | `cl.exe`, `link.exe`, x64 native build | required | Microsoft component page |
| Windows 11 SDK component | `Microsoft.VisualStudio.Component.Windows11SDK.26100` | SDK headers/libs, MIDL and RPC development assets | required candidate; exact MIDL payload must be verified | Microsoft component page |
| MSBuild | `Microsoft.Component.MSBuild` | C++ build target execution if MSBuild path is used | required by workload / direct compile alternative | Microsoft component page |

Potential version identity observed read-only through winget:

```text
Build Tools package: 17.14.45
Windows SDK package: 10.0.26100.7705
VS 2022 component page snapshot: 17.14.36015.10 generation
```

These numbers are different metadata layers. Do not assume they are identical
until the installed instance reports its exact component manifest.

### B. Conditional

| Component | Decision |
|---|---|
| CMake / Ninja | not required if direct `cl.exe`/`link.exe` or MSBuild is used; do not install by default |
| Windows SDK Debugging Tools | not required for RPC identity compile; defer |
| Visual Studio debugger | not required for command-line harness; defer |
| SDK standalone installer | only if the Build Tools SDK component cannot provide classic MIDL/RPC assets; no installation now |

### C. Explicitly not required

- Visual Studio full IDE;
- .NET SDK;
- ATL/MFC;
- Clang/LLVM;
- ARM/ARM64/ARM64EC compiler tools;
- vcpkg;
- UWP, WinUI and Universal Windows workloads;
- Windows Performance Toolkit;
- unrelated .NET targeting packs;
- Azure/cloud workloads;
- Unity/Game/Node workloads.

### D. Not verified

- Exact component payload size for the selected workload;
- Exact `midl.exe` presence under `Microsoft.VisualStudio.Component.Windows11SDK.26100`;
- Exact RPC header/import-library payload of the SDK component;
- Compatibility of component manifest version with the OS build and the chosen
  SDK.

Do not install the optional components merely because the installer preselects
them.

## 4. Download and Installer Integrity

Installer URLs and hashes observed read-only from winget metadata:

```text
Build Tools installer:
https://download.visualstudio.microsoft.com/download/pr/95995f57-8355-4ff5-8d90-a7e1669fb3b3/310c13b8238876afb4e823a91112230ee2d2c5a45c431d4062af7aadedff9c4c/vs_BuildTools.exe
SHA-256: 310c13b8238876afb4e823a91112230ee2d2c5a45c431d4062af7aadedff9c4c

Windows SDK installer:
https://download.microsoft.com/download/f4b30f2a-4fc3-430e-9b03-c842b5f5f9f1/KIT_BUNDLE_WINDOWSSDK_MEDIACREATION/winsdksetup.exe
SHA-256: 6fa0fa27db77a909f5ecb35183cb26a969a6775936780936fe239e4f9c66b458
```

These are metadata observations, not download or installation. A future
installer phase must re-verify HTTPS origin, Authenticode signer, and hash.

## 5. Harness Isolation Directory

Future directory (not created):

```text
tools/native-rpc/p13-a1-r2/
  P13Authority.idl
  P13Authority.acf
  generated/
  server/
  client/
  build/
  evidence/
```

Rules:

- no Next.js/Worker production build integration;
- no pnpm lockfile change;
- no existing TypeScript tsconfig changes;
- no writes to `apps/web/.next` or `apps/worker/dist`;
- no historical binary reuse;
- every run records SDK/MIDL/MSVC version, executable paths, binary digest and
  toolchain identity.

The Node test driver must launch fixed server/client paths with fixed argv/env/
cwd, bounded timeout, JSON stdout, and explicit exit codes.

## 6. Native Harness Design

### Server

```text
ncalrpc endpoint p13-authority-a1-r2
one RPC manager P13Invoke
AuthorizeCurrentCall
  RpcServerInqCallAttributes
  ClientPID
  OpenProcess
  GetProcessTimes
  OpenProcessToken
  GetTokenInformation
  RPC principal / Authority / Session / Epoch
then no-side-effect test dispatcher
```

The server must hold a real process handle for the call/session lifetime. The
TS `processHandleKey` is a logical test key, not a kernel handle.

### Client

Independent process invoking the test operation. It sends only operation and
request metadata, never PID/SID/token/principal claims.

### Evidence

JSON output contains:

```text
testId, phase, endpoint, clientPid, creationTime, principal,
identityMatch, authorization, sideEffects, errorCode
```

No secrets or raw credentials.

## 7. Test Matrix

| Test | Level | Admin | Persistent identity | Expected |
|---|---|---:|---:|---|
| valid client/server | NATIVE RPC RUNTIME | likely no | no | ALLOW |
| unauthenticated client | NATIVE RPC | likely no | no | DENY |
| different Windows user | NATIVE IDENTITY | likely | yes, future test user | DENY |
| different logon session | NATIVE IDENTITY | likely | yes, future test user | DENY |
| wrong RPC principal | NATIVE IDENTITY | maybe | no | DENY |
| missing PID | NATIVE RPC | no | no | DENY |
| PID exited | NATIVE RPC | no | no | DENY |
| PID reuse | NATIVE IDENTITY | maybe | no | DENY |
| creation-time mismatch | NATIVE IDENTITY | maybe | no | DENY |
| token/SID mismatch | NATIVE IDENTITY | likely | future test user | DENY |
| wrong auth level/service | NATIVE RPC | no | no | DENY |
| missing/closed session | LOGICAL | no | no | DENY |
| stale epoch | LOGICAL | no | no | DENY |
| cross-Authority | LOGICAL/NATIVE | no | no | DENY |
| replay | LOGICAL/NATIVE | no | no | DENY |
| concurrent calls | NATIVE RPC | no | no | isolated |
| manager wrapper | NATIVE RPC | no | no | deny before effect |
| authorization failure effect count | LOGICAL/NATIVE | no | no | zero |
| server/client crash | NATIVE RPC | no | no | no success |
| endpoint close | NATIVE RPC | no | no | no binding |
| timeout | NATIVE RPC | no | no | deny/unknown |

`LOGICAL TEST`, `NATIVE BUILD TEST`, `NATIVE RPC RUNTIME TEST`, and
`WINDOWS IDENTITY SECURITY TEST` are separate evidence levels.

## 8. Installation Impact and Rollback

Installation is not performed.

Before:

- record OS/build, free space, SDK/MSVC/MIDL inventory, Path/INCLUDE/LIB
  toolchain entries, Visual Studio Installer instances, Node/pnpm/Python/VS Code
  versions, Git state and protected hashes.

After:

- query `vswhere` installation instances;
- verify product/component list;
- verify SDK/MIDL/MSVC paths and versions;
- verify `rpc.h`, `rpcndr.h`, `rpcdce.h`, `rpcasync.h`, `Rpcrt4.lib`;
- record any environment delta;
- verify protected hashes and existing Node/pnpm/VS Code/Python behavior.

Rollback:

- use Visual Studio Installer to remove only newly added components;
- restore only recorded environment changes;
- do not recurse-delete Visual Studio, Windows Kits or system directories;
- if an existing instance/default toolchain changes and cannot be restored,
  stop and report BLOCKED.

## 9. Approval Checklist

The future installer phase requires separate human approval for:

- VS 2022 Build Tools product;
- `Microsoft.VisualStudio.Workload.VCTools`;
- `Microsoft.VisualStudio.Component.VC.Tools.x86.x64`;
- `Microsoft.VisualStudio.Component.Windows11SDK.26100`;
- exact install directory and whether standalone Windows SDK is needed;
- administrator elevation;
- Authenticode/hash verification;
- environment delta and rollback procedure.

No installation is authorized by this manifest.

## 10. Worktree Incident

Actual baseline at this stage was 26 tracked modified and **179 untracked**,
not the expected 178. The extra object is:

```text
D:\thinkbook\Desktop\jieya\$null)
```

It is a 65-byte regular Archive file, SHA-256
`8AD444F42168AB885CB04D8E5446BF899E7F4B5B35068A91020F415BF661BC49`, created
`2026-11-20T10:02:38.5812097Z`, with no symlink target. It was left untouched.

This is a worktree-protection incident. It is not a project source, SDK, or
native artifact.

The two required stage documents bring the final untracked count to **181**
when counted with `--untracked-files=all`. No other file was added by this
stage. The incident file was neither deleted nor modified.

Protected-file hashes rechecked read-only at stage end:

| Protected file | SHA-256 |
|---|---|
| FZ | `E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705` |
| ST | `5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586` |
| DBTP | `FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7` |
| Prisma Schema | `78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299` |
| `apps/web/next-env.d.ts` | `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC` |
| `apps/web/tsconfig.tsbuildinfo` | `21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520` |

## 11. Document Integrity

The manifest is frozen before the final readiness report is sealed. A
self-referential manifest hash is intentionally not embedded here; the
authoritative SHA-256 of this file is recorded in the final readiness report
after this document is frozen. The readiness report's own final SHA-256 is
reported externally for the same reason.

Installer artifact hashes are recorded in section 4. Component IDs and
installer metadata remain design evidence only and do not authorize download
or installation.

## 12. Final Manifest Status

```text
R4-A1-R2-R1 Installation Manifest:
BLOCKED BY WORKTREE INCIDENT

Recommended toolchain:
VS 2022 Build Tools
+ VCTools workload
+ VC.Tools.x86.x64
+ Windows11SDK.26100
with post-install verification of classic MIDL/RPC assets

Installation / download / compile / RPC runtime:
NOT EXECUTED

R4-A1-R2 implementation:
NOT AUTHORIZED
```
