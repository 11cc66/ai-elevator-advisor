# P1-3 C-6.2-L8-A7.20-R4-A1-R3-R6 Post-Install Reconciliation Report

## 0. Final Result

```text
Overall:
PASS WITH WARNINGS

PFR Queue Stability:
STABLE DURING AUDIT

Original 19 Operations:
UNCHANGED

New 4 Operations:
UNAPPROVED — PENDING SEPARATE REVIEW

New PFR Provenance:
ONE HIGH CONFIDENCE INSTALLER CONFIG; THREE POSSIBLE INSTALLER TEMP CLEANUPS

Installer Integrity:
VERIFIED

Build Tools Integrity:
PASS

MSVC v143:
PASS

Windows SDK 26100:
PASS

Classic MIDL:
PASS

RPC Headers / Libraries:
PASS

Windows RPC Runtime:
PASS — FILE/SIGNATURE ONLY

System Reboot State:
PENDING OPERATIONS PRESENT

Native RPC Build Readiness:
READY FOR SEPARATE AUTHORIZATION

Native RPC Build:
NOT AUTHORIZED

Native RPC Runtime:
NOT AUTHORIZED

Repository Integrity:
PASS WITH WARNINGS
```

The installed Visual Studio Build Tools toolchain is complete and usable. The
only significant warning is that installation appended four cleanup DELETE
operations to PFR; they are outside the expired one-time exception.

## 1. Inputs and Scope

```text
Stage:
C-6.2-L8-A7.20-R4-A1-R3-R6

Date:
2026-11-21

Repository:
D:\thinkbook\Desktop\jieya

Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

Skills actually loaded and applied:

```text
$project-architecture
$security-audit
$testing-and-verification
$file-lifecycle
```

The complete R4-A1-R3 through R4-A1-R3-R5 history, R4-A1-R1 toolchain
assessment, and R4-S11 readiness report were reviewed. This phase is read-only
and does not rerun or modify the installer.

## 2. R5 Installation Summary

```text
Product:             Visual Studio Build Tools 2022
Version:             17.14.45
Build:               17.14.37906.3
Instance ID:         67e8d6b7
Installer exit:      0
Signature:           Valid, Microsoft Corporation
Installer SHA-256:   310C13B8238876AFB4E823A91112230EE2D2C5A45C431D4062AF7AADEDFF9C4C
Installer ProductVersion: 17.14.45
Installer FileVersion:    17.14.37906.3
Installation path:
C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools
```

Current recheck of the downloaded Bootstrapper produced the same length, hash,
version and valid Microsoft signature.

## 3. PFR Before and After Installation

Preinstall, approved exception state:

```text
Value type:             REG_MULTI_SZ
Raw strings:            38
Pairs:                  19
DELETE operations:      19
SHA-256:                54CC89DA4697363393AE7A956AF3FD689B8B3D10926955849995CD44CC286E84
```

Current post-install state:

```text
Value type:             REG_MULTI_SZ
Raw strings:            46
Non-empty strings:      23
Pairs:                  23
DELETE operations:      23
RENAME/MOVE/REPLACE:     0
MALFORMED:               0
SHA-256:                0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC
```

The first 38 strings were hashed independently:

```text
Preinstall-prefix SHA-256:
54CC89DA4697363393AE7A956AF3FD689B8B3D10926955849995CD44CC286E84

Approved-prefix match:
YES
```

This proves the original 19 pairs, their order and their delete semantics were
preserved while 8 new strings / 4 delete pairs were appended.

PFR was re-read during the audit and remained at:

```text
46 strings / 23 pairs / 0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC
```

## 4. Original 19 Operations

The preserved prefix consists of:

| Range | Component | Operations | Result |
|---|---|---:|---|
| PFR-001 | Gaming Services `gamingservicesproxy_17.dll.0` | 1 | unchanged |
| PFR-002–PFR-019 | Microsoft CrossDevice cache cleanup | 18 | unchanged |

Their paths, order, empty destinations and DELETE semantics are unchanged.
The old one-time Scoped PFR Exception has expired and is not reused for the
new suffix.

## 5. New Operations

The four post-install additions are append-only, use `*1\??\` and have empty
destinations.

| ID | Source | Exists | Type | Size | Creation UTC | Last write UTC | SHA-256 |
|---|---|---|---:|---:|---|---|---|
| NEW-PFR-001 / PFR-020 | `C:\ProgramData\Microsoft\VisualStudio\Packages\_bootstrapper\vs_setup_bootstrapper_202611212157011555.json` | YES | file | 246 | 2026-11-21T13:57:01.1600505Z | 2026-11-07T02:56:28Z | `D018F5E3CF6CD6D98B55060857882856A4EC24C86C8F658823AFFD2768B0B0E9` |
| NEW-PFR-002 / PFR-021 | `%USERPROFILE%\AppData\Local\Temp\DEL7D6C.tmp` | YES | file | 98040 | 2024-03-19T05:27:52Z | 2024-03-19T05:27:52Z | `NOT VERIFIED — ACCESS DENIED` |
| NEW-PFR-003 / PFR-022 | `%USERPROFILE%\AppData\Local\Temp\DEL7D7D.tmp` | YES | file | 176056 | 2026-09-12T13:12:06Z | 2026-09-12T13:12:06Z | `NOT VERIFIED — ACCESS DENIED` |
| NEW-PFR-004 / PFR-023 | `%USERPROFILE%\AppData\Local\Temp\DEL7D7E.tmp` | YES | file | 170800 | 2026-09-12T13:12:06Z | 2026-09-12T13:12:06Z | `NOT VERIFIED — ACCESS DENIED` |

All four:

- are regular files;
- have Archive attribute;
- have no Reparse Point, LinkType or Target;
- each have exactly one hard-link path;
- remain present after installation;
- remain scheduled for delete-at-reboot;
- are not covered by the expired exception.

The temporary files' ACLs and contents were not read further after access was
denied. No deletion or timestamp modification was attempted.

## 6. New-operation Provenance

### NEW-PFR-001

```text
Confidence:
HIGH CONFIDENCE — INSTALLER-OWNED CONFIGURATION
```

Evidence:

- the complete path appears in the Bootstrapper logs as the `/in` file passed
  to the `/finalizeInstall install` command;
- the installer log records the same path at 21:57:20 and 22:04:47;
- the file was created at 21:57:01;
- its JSON content contains only Visual Studio channel/product identifiers and
  official channel URLs.

The content is:

```json
{
  "installChannelUri": "https://aka.ms/vs/17/release/106028994_582560814/channel",
  "productId": "Microsoft.VisualStudio.Product.BuildTools",
  "channelId": "VisualStudio.17.Release",
  "channelUri": "https://aka.ms/vs/17/release/channel"
}
```

This proves installer ownership and use. It does not prove that the installer
explicitly logged its PFR registration call.

### NEW-PFR-002 through NEW-PFR-004

```text
Confidence:
POSSIBLE — INSTALLER TEMP CLEANUP
```

Evidence:

- they are under the standard user Temp directory;
- all three use the same `*1\??\` modifier as the installer JSON;
- all four entries were appended together after the installation;
- the names follow the temporary deletion naming pattern.

Counter-evidence / missing evidence:

- the copied installation logs contain zero exact matches for any of the three
  `DEL*.tmp` names;
- their creation times predate this installation;
- file content and ACL metadata are access denied;
- exact PFR registration time is not available from normal registry reads.

They are not marked CONFIRMED as installer-created files or as specifically
registered by a named installer component.

## 7. Installer Log Evidence

External evidence root:

```text
C:\Users\thinkbook\AppData\Local\P13-RPC-Toolchain\R4-A1-R3-R5
```

Log directory:

```text
C:\Users\thinkbook\AppData\Local\P13-RPC-Toolchain\R4-A1-R3-R5\logs
```

The log directory contains 370 copied files totaling 28043595 bytes.

| Log | Evidence |
|---|---|
| `dd_bootstrapper_20261121215700.log` | setup process exited 0; Bootstrapper completed successfully |
| `dd_setup_20261121215732_errors.log` | 0-byte error log |
| `dd_setup_20261121215732.log` | successful package setup session |
| `dd_installer_elevated_20261121215730.log` | elevated installer exit code 0 |

Timeline:

```text
21:56:59  Bootstrapper started
21:57:01  Installer configuration JSON created
21:57:18  Installer setup.exe launched
22:04:49  Installer process exited with code 0
22:04:49  Bootstrapper completed successfully
22:15:03  R6 first PFR snapshot: 46 strings / 23 delete pairs
```

## 8. Build Tools Integrity

```text
Product:
Visual Studio Build Tools 2022

Product ID:
Microsoft.VisualStudio.Product.BuildTools

Version:
17.14.37906.3

Display version:
17.14.45

Channel:
VisualStudio.17.Release

Installation path:
C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools

Instance ID:
67e8d6b7

Complete:
true

Launchable:
true

Reboot required:
false

includeRecommended:
0
```

The current installer process set is empty.

All three explicitly authorized components are installed:

```text
Microsoft.VisualStudio.Workload.VCTools
Microsoft.VisualStudio.Component.VC.14.44.17.14.x86.x64
Microsoft.VisualStudio.Component.Windows11SDK.26100
```

The selected-package manifest contains 14 product/dependency entries. No full
Visual Studio IDE was installed.

## 9. MSVC v143

```text
MSVC root:
C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207
```

| Tool | Version | Location |
|---|---|---|
| `cl.exe` Host x64 / Target x64 | 19.44.35230.0 | `bin\Hostx64\x64\cl.exe` |
| `cl.exe` Host x64 / Target x86 | present | `bin\Hostx64\x86\cl.exe` |
| `link.exe` | 14.44.35230.0 | `bin\Hostx64\x64\link.exe` |
| `dumpbin.exe` | 14.44.35230.0 | `bin\Hostx64\x64\dumpbin.exe` |
| x64 target libraries | present | `lib\x64` |
| x86 target libraries | present | `lib\x86` |
| `VsDevCmd.bat` | present | `Common7\Tools\VsDevCmd.bat` |
| MSBuild | present | `MSBuild\Current\Bin\MSBuild.exe` |

All three PE tools have Valid Microsoft Authenticode signatures.

`VsDevCmd.bat -arch=x64` initialized successfully. `cl.exe /Bv` emitted:

```text
Microsoft C/C++ Optimizing Compiler 19.44.35230 for x64
cl.exe 19.44.35230.0
c1.dll 19.44.35230.0
c1xx.dll 19.44.35230.0
c2.dll 19.44.35230.0
link.exe 14.44.35230.0
```

The helper returned code 2 because `/Bv` was invoked without a source file.
No source was provided and no compilation occurred.

## 10. Windows SDK 26100 and RPC Assets

```text
SDK root:
C:\Program Files (x86)\Windows Kits\10

SDK version:
10.0.26100.0
```

| Asset | Location | Length |
|---|---|---:|
| `rpc.h` | `Include\10.0.26100.0\shared\rpc.h` | 5189 |
| `rpcndr.h` | `Include\10.0.26100.0\shared\rpcndr.h` | 82121 |
| `rpcdce.h` | `Include\10.0.26100.0\shared\rpcdce.h` | 89430 |
| `rpcasync.h` | `Include\10.0.26100.0\shared\rpcasync.h` | 19693 |
| `rpcproxy.h` | `Include\10.0.26100.0\um\rpcproxy.h` | 32086 |
| x64 `Rpcrt4.lib` | `Lib\10.0.26100.0\um\x64\Rpcrt4.lib` | 133054 |
| x86 `Rpcrt4.lib` | `Lib\10.0.26100.0\um\x86\Rpcrt4.lib` | 140064 |

The SDK's actual layout places base RPC headers under `shared` and
`rpcproxy.h` under `um`.

## 11. Classic MIDL

| Tool | Version | Signature |
|---|---|---|
| x86 `midl.exe` | 10.0.26100.9457 | Valid, Microsoft |
| x64 `midl.exe` | 10.0.26100.9457 | Valid, Microsoft |
| `midlc.exe` | 10.0.26100.9457 | Valid, Microsoft |

`midl.exe /?` exited `0` and identified itself as:

```text
Microsoft (R) 32b/64b MIDL Compiler Version 8.01.0628
```

No IDL compilation occurred.

## 12. Windows RPC Runtime

| File | Version | Signature |
|---|---|---|
| `C:\Windows\System32\rpcrt4.dll` | `10.0.26100.9949` | Valid, Microsoft Windows |
| `C:\Windows\SysWOW64\rpcrt4.dll` | `10.0.26100.9974` | Valid, Microsoft Windows |

No runtime client or server was launched.

## 13. Installation and Reboot State

```text
Visual Studio installer isComplete:
true

Visual Studio installer isLaunchable:
true

Visual Studio isRebootRequired:
false

CBS RebootPending:
false

CBS PackagesPending:
false

CBS incomplete sessions:
0

Windows Update RebootRequired:
false

MSI InProgress:
false

Current Visual Studio installer process:
none
```

Classification:

```text
System Reboot State:
PENDING OPERATIONS PRESENT
```

No reboot is required to use the installed compiler according to Visual
Studio. However, four newly appended PFR cleanup operations remain. They are
not interpreted as a successful clean reboot queue.

## 14. Native RPC Build Readiness

Toolchain prerequisites:

```text
MSVC v143 x86/x64:       PRESENT / VERIFIED
Windows SDK 26100:       PRESENT / VERIFIED
RPC headers:             PRESENT / VERIFIED
x86/x64 Rpcrt4.lib:      PRESENT / VERIFIED
Classic MIDL x86/x64:    PRESENT / VERIFIED
Windows RPC runtime:     PRESENT / SIGNATURE VERIFIED
```

Project prerequisites:

```text
packages/authority-core:              present
Authority logical tests:              present
Native RPC design:                    present in architecture documents
tools/native-rpc/p13-a1-r2:           absent
P13Authority.idl:                     absent
Native server/client source:          absent
Isolated native build target:         absent
```

Root/Web/Worker package scripts contain no Native RPC harness build command.
The planned native output path remains isolated from Next.js and Worker
production builds.

Assessment:

```text
Native RPC Build Readiness:
READY FOR SEPARATE AUTHORIZATION

Native RPC Build:
NOT AUTHORIZED

Native RPC Runtime:
NOT AUTHORIZED
```

The absent harness files are an intentional implementation gap, not a
toolchain defect. Creating them, generating MIDL stubs, compiling and running
the harness each still require future explicit authorization.

## 15. NOT VERIFIED / ACCESS DENIED

```text
SHA-256 of DEL7D6C.tmp:
NOT VERIFIED — ACCESS DENIED

SHA-256 of DEL7D7D.tmp:
NOT VERIFIED — ACCESS DENIED

SHA-256 of DEL7D7E.tmp:
NOT VERIFIED — ACCESS DENIED

ACL details for the three temporary files:
NOT VERIFIED — ACCESS DENIED

Exact registry mutation time for each new PFR pair:
NOT VERIFIED

Exact process that registered DEL7D6C/DEL7D7D/DEL7D7E:
NOT VERIFIED

PFR-001 deletion-failure cause:
UNKNOWN from prior read-only investigation

Late Native RPC runtime compliance:
NOT EXECUTED

Native RPC build:
NOT EXECUTED

.next and Worker dist whole-tree historical integrity:
NOT VERIFIED
```

## 16. Repository Integrity

Before this report:

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 26
Untracked: 189
Staged: 0
Deleted: 0
```

Six protected objects:

| Object | SHA-256 | Result |
|---|---|---|
| FZ | `E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705` | MATCH |
| ST | `5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586` | MATCH |
| DBTP | `FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7` | MATCH |
| Prisma Schema | `78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299` | MATCH |
| `apps/web/next-env.d.ts` | `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC` | MATCH |
| `apps/web/tsconfig.tsbuildinfo` | `21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520` | MATCH |

The root files `$null` and `$null)` do not exist. The existing dirty worktree,
untracked source/docs and prior security repairs were preserved.

## 17. Side Effects and Non-actions

Allowed read operations incremented LastAccessTime on inspected files. No file
content or LastWriteTime was deliberately modified.

```text
PFR cleanup/edit:
NOT EXECUTED

Delete/move/rename of PFR targets:
NOT EXECUTED

Installer rerun/repair/modify/uninstall:
NOT EXECUTED

Additional download:
NOT EXECUTED

Service/driver/ACL/Owner/Task changes:
NOT EXECUTED

Reboot/shutdown:
NOT EXECUTED

Native RPC Build/Runtime:
NOT EXECUTED

MIDL compilation:
NOT EXECUTED

Database/SQL/Migration/Storage:
NOT ACCESSED

Git write:
NOT EXECUTED
```

## 18. Document Integrity

This report cannot contain its own stable SHA-256 without changing the file.
The SHA-256 is computed after the report is frozen and returned externally.
