# P1-3 C-6.2-L8-A7.20-R4-A1-R3-R5 Controlled Toolchain Installation Report

## 0. Final Result

```text
Overall:
PASS WITH WARNINGS

Scoped PFR Exception:
VALID AT INSTALL START / EXPIRED AFTER INSTALL

Preinstall PFR Verification:
PASS

Installer Source:
MICROSOFT OFFICIAL

Installer Authenticity:
VERIFIED

Installer Version:
17.14.45 / 17.14.37906.3

UAC:
PASS — NORMAL WINDOWS ELEVATION ACCEPTED

Build Tools Installation:
PASS — EXIT CODE 0

MSVC v143:
PASS

Windows SDK 26100:
PASS

Classic MIDL:
PASS

RPC Headers / Libraries:
PASS

vswhere:
PASS

Windows RPC Runtime:
PASS

Postinstall PFR:
CHANGED — 23 DELETE operations; 4 NEW ITEMS NOT COVERED BY THE EXCEPTION

Reboot Required:
NO — INSTALLER REPORTS FALSE; PENDING CLEANUP REMAINS

Repository Integrity:
PASS WITH WARNINGS

Native RPC Build:
NOT AUTHORIZED

Native RPC Runtime:
NOT AUTHORIZED
```

Visual Studio 2022 Build Tools 17.14.45 installed successfully under the
user-approved one-time scoped PFR exception. No automatic restart, compilation
or Native RPC runtime test was performed.

## 1. Authorization

The user approved:

```text
Strategy B — Scoped PFR Exception
```

Scope:

- only the exact 19 PFR DELETE operations present at install start;
- only the exact 38-string ordered array whose SHA-256 is
  `54CC89DA4697363393AE7A956AF3FD689B8B3D10926955849995CD44CC286E84`;
- no modification or cleanup of PFR;
- no deletion or modification of Gaming Services or CrossDevice objects;
- no extension to future PFR operations;
- only the original Visual Studio Build Tools installation scope.

Approval was one-time and covered installation only. It did not authorize
Native RPC Harness build/runtime or R4-A2.

## 2. Evidence Read

Skills applied:

```text
$project-architecture
$security-audit
$testing-and-verification
$file-lifecycle
```

Historical evidence read:

- R4-A1-R3 installation authorization and blocked report.
- R4-A1-R3-R1 pending-operation audit.
- R4-A1-R3-R2 post-reboot preflight.
- R4-A1-R3-R3 Gaming Services / CrossDevice investigation.
- R4-A1-R3-R4 scoped-exception risk reassessment.
- R4-A1-R1 toolchain feasibility/assessment.
- R4-S11 R4-A readiness report.

## 3. Preinstall PFR Verification

Registry:

```text
HKLM\SYSTEM\CurrentControlSet\Control\Session Manager
PendingFileRenameOperations
```

Observed before download and again immediately before installer launch:

```text
Value type:             REG_MULTI_SZ
Raw strings:            38
Non-empty strings:      19
Complete pairs:         19
DELETE operations:      19
Other operation types:   0
Ordered-array SHA-256:  54CC89DA4697363393AE7A956AF3FD689B8B3D10926955849995CD44CC286E84
```

The ordered array matched the approved exception. The first 19 pairs were:

- 18 CrossDevice absent-source cache deletions;
- one Gaming Services `.dll.0` deletion.

Result:

```text
Scoped PFR Exception:
VALID AT INSTALL START

Preinstall PFR Verification:
PASS
```

## 4. Windows Preflight

```text
Edition:
Microsoft Windows 11 家庭版 中文版

Version:
10.0.26300

Build:
26300

Architecture:
x64

Current user:
LAPTOP-34H6Q1OD\thinkbook

Administrator token:
false

UAC:
enabled

C: free before install:
312203612160 bytes

CBS RebootPending:
false

CBS PackagesPending:
false

CBS incomplete sessions:
0

Windows Update RebootRequired:
false

Windows Installer InProgress:
false

Visual Studio Installer before install:
absent

Build Tools before install:
absent
```

Office Click-to-Run and Lenovo VCamera service processes were running but no
MSI/setup/TrustedInstaller transaction was active. No existing Visual Studio or
Build Tools instance existed.

## 5. Official Version and Component Validation

Microsoft Visual Studio 2022 release history:

<https://learn.microsoft.com/en-us/visualstudio/releases/2022/release-history>

Observed:

```text
Channel:         Current
Version:         17.14.45
Release date:    November 10, 2026
Build number:    17.14.37906.3
Newer 17.14:     none found
HTTP status:     200
```

Microsoft Build Tools component IDs:

<https://learn.microsoft.com/en-us/visualstudio/install/workload-component-id-vs-build-tools?view=vs-2022>

Observed:

```text
Microsoft.VisualStudio.Workload.VCTools:                        present
Microsoft.VisualStudio.Component.VC.14.44.17.14.x86.x64:        present
Microsoft.VisualStudio.Component.Windows11SDK.26100:            present
HTTP status:                                                    200
```

## 6. Installer Download and Integrity

Fixed Microsoft download URL:

```text
https://download.visualstudio.microsoft.com/download/pr/95995f57-8355-4ff5-8d90-a7e1669fb3b3/310c13b8238876afb4e823a91112230ee2d2c5a45c431d4062af7aadedff9c4c/vs_BuildTools.exe
```

Download:

```text
HTTP status:        200
Final domain:       download.visualstudio.microsoft.com
Start UTC:          2026-11-21T13:56:08.1625962Z
Finish UTC:         2026-11-21T13:56:09.5865368Z
Local path:
C:\Users\thinkbook\AppData\Local\P13-RPC-Toolchain\R4-A1-R3-R5\vs_BuildTools.exe
Length:             4480304 bytes
SHA-256:            310C13B8238876AFB4E823A91112230EE2D2C5A45C431D4062AF7AADEDFF9C4C
FileVersion:        17.14.37906.3
ProductVersion:     17.14.45
```

The computed SHA-256 matches the hash-like component in the Microsoft fixed
download URL.

```text
Microsoft Published SHA-256:
NOT AVAILABLE AS A SEPARATELY PUBLISHED CHECKSUM FILE
```

The URL hash is supporting evidence, not represented as an independent
Microsoft checksum publication.

## 7. Authenticode Verification

```text
Signature status:       Valid
Status message:         Signature verified.
Signer subject:         Microsoft Corporation
Signer issuer:          Microsoft Code Signing PCA 2024
Signer thumbprint:      AB172913A2960A224809EE8A0C371CD47A079B72
Signer validity:        2026-04-17 through 2027-04-16
Signer EKU:             Microsoft Publisher; Code Signing
Online chain result:    Valid
Chain status:           no errors
Chain:
  Microsoft Corporation
  Microsoft Code Signing PCA 2024
  Microsoft Root Certificate Authority 2011

Timestamp present:      yes
Timestamp signer:       Microsoft Time-Stamp Service
Timestamp issuer:       Microsoft Time-Stamp PCA 2010
Timestamp thumbprint:   33F04A3FCFC249738C2406353E1446013E34AAFD
Timestamp chain:        Valid
Timestamp chain status: no errors
```

The hash and signature were recomputed immediately before launch and still
matched.

## 8. UAC and Installation Command

Normal Windows UAC elevation was requested through `Start-Process -Verb RunAs`.
The user accepted the Windows elevation prompt. No password was requested or
captured, and no elevation bypass was used.

Installer PID:

```text
vs_BuildTools.exe PID 28308
Started 2026-11-21T21:56:59.2189001+08:00
```

Command:

```text
vs_BuildTools.exe
  --passive
  --norestart
  --wait
  --installPath "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools"
  --add Microsoft.VisualStudio.Workload.VCTools
  --add Microsoft.VisualStudio.Component.VC.14.44.17.14.x86.x64
  --add Microsoft.VisualStudio.Component.Windows11SDK.26100
```

`--includeRecommended`, `--includeOptional`, `--all`, `--allWorkloads` and
`--force` were not used.

Installer child processes observed:

```text
vs_setup_bootstrapper.exe PID 30044
setup.exe PID 21208
elevated setup.exe PID 13916
```

## 9. Installation Result

```text
Started local:     2026-11-21 21:56:59
Completed local:   2026-11-21 22:04:49
Duration:          approximately 7 minutes 50 seconds
Exit code:         0
Bootstrapper log:  VS setup process exited with code 0
                   Bootstrapper Successfully completed
Error log:         dd_setup_20261121215732_errors.log is 0 bytes
```

No install retry was performed.

Installed product:

```text
Product:
Visual Studio Build Tools 2022

Product ID:
Microsoft.VisualStudio.Product.BuildTools

Instance ID:
67e8d6b7

Installation version:
17.14.37906.3

Product version:
17.14.45

Channel:
VisualStudio.17.Release

Installation path:
C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools

Complete:
true

Launchable:
true

Reboot required:
false

includeRecommended:
0
```

The selected package set contains the requested VCTools workload, MSVC 14.44
component, Windows 11 SDK 26100 component and their required dependency
components. No full IDE or additional workload was installed.

## 10. vswhere

```text
Path:
C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe

Length:
469456 bytes

Product version:
3.1.7+f39851e70f

Signature:
Valid, Microsoft Corporation
```

`vswhere -products * -requires <component>` found the Build Tools instance for
all three authorized component IDs.

Installer package inventory:

```text
Microsoft.VisualStudio.Workload.VCTools:
  17.14.36331.10

Microsoft.VisualStudio.Component.VC.14.44.17.14.x86.x64:
  17.14.36510.44

Microsoft.VisualStudio.Component.Windows11SDK.26100:
  17.14.37902.18
```

## 11. MSVC v143

Toolset:

```text
C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\
  VC\Tools\MSVC\14.44.35207
```

| Tool | Path | File/test version | Signature |
|---|---|---|---|
| `cl.exe` | `bin\Hostx64\x64\cl.exe` | 19.44.35230.0 | Valid, Microsoft |
| `link.exe` | `bin\Hostx64\x64\link.exe` | 14.44.35230.0 | Valid, Microsoft |
| `dumpbin.exe` | `bin\Hostx64\x64\dumpbin.exe` | 14.44.35230.0 | Valid, Microsoft |

Additional verification:

```text
Hostx64\x86\cl.exe: present
lib\x64:           present
lib\x86:           present
VsDevCmd.bat:      present
MSBuild.exe:       present
```

`VsDevCmd.bat -arch=x64` initialized the environment and `cl.exe /Bv` emitted:

```text
Microsoft (R) C/C++ Optimizing Compiler Version 19.44.35230 for x64
cl.exe version 19.44.35230.0
c1.dll version 19.44.35230.0
c1xx.dll version 19.44.35230.0
c2.dll version 19.44.35230.0
link.exe version 14.44.35230.0
```

The helper command exited with code `2` because `/Bv` was run without a source
file (`D8003`). It did not compile anything. Tool version evidence was emitted
successfully.

`link.exe /?` and `dumpbin.exe /?` emitted their version/help banners and wrote
evidence files under the external log directory.

## 12. Windows SDK 26100

```text
SDK root:
C:\Program Files (x86)\Windows Kits\10

Include version:
10.0.26100.0

Lib version:
10.0.26100.0

Bin version:
10.0.26100.0
```

Verified files:

| File | Length | SHA-256 |
|---|---:|---|
| `Include\10.0.26100.0\shared\rpc.h` | 5189 | `063BD35DF91C85B029064ABE19D635D985E414C9733C60EE8CA8CE937C98D6D5` |
| `Include\10.0.26100.0\shared\rpcndr.h` | 82121 | `2E77AD831F8300436D86D7D1A90CCBA470F9FE7F09F59B4BDE8C60EECE41339A` |
| `Include\10.0.26100.0\shared\rpcdce.h` | 89430 | `991883893134C8ECBE6AF8335DF0781BFB779C11684B3367DEF514136241B866` |
| `Include\10.0.26100.0\shared\rpcasync.h` | 19693 | `5E91801CEE17B175A397CC56FF08790783D4FCDBC8D52FE7BB7461CCFA369A85` |
| `Include\10.0.26100.0\um\rpcproxy.h` | 32086 | `96AE2185D9A8A688DAFA8EEF99686D07777549E8809891B8D977D258872F1B3C` |
| `Lib\10.0.26100.0\um\x64\Rpcrt4.lib` | 133054 | `BFE69184C180BF6ADE840AC5279B53AA67B0EDA43C82BCD86596DB0309FAEEF3` |
| `Lib\10.0.26100.0\um\x86\Rpcrt4.lib` | 140064 | `261B6AA16F20DC88E24E27CCD72CDEA69EFE96D4FC06FC81155B643B43DD9134` |

The SDK places base RPC headers in `shared`; `rpcproxy.h` is under `um`.

## 13. Classic MIDL

Files:

```text
C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x86\midl.exe
C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\midl.exe
C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x86\midlc.exe
```

Versions/signatures:

```text
x86 midl.exe:  117672 bytes, 10.0.26100.9457, Valid Microsoft
x64 midl.exe:  154024 bytes, 10.0.26100.9457, Valid Microsoft
midlc.exe:     993192 bytes, 10.0.26100.9457, Valid Microsoft
```

`midl.exe /?` exited `0` and reported:

```text
Microsoft (R) 32b/64b MIDL Compiler Version 8.01.0628
```

No IDL was compiled.

## 14. Windows RPC Runtime

| File | Version | Signature | SHA-256 |
|---|---|---|---|
| `C:\Windows\System32\rpcrt4.dll` | `10.0.26100.9949` | Valid, Microsoft Windows | `35FA5F92F985CBA9B33BC5F17968211D84EBB910D639BA2DB8F35596BEFCA6A6` |
| `C:\Windows\SysWOW64\rpcrt4.dll` | `10.0.26100.9974` | Valid, Microsoft Windows | `C073CE66E63624F71DF59A2B1151D3B45EE2ABAF371ECA3062554092929C2DFA` |

No native RPC program was run.

## 15. Postinstall PFR

Current value:

```text
Value type:             REG_MULTI_SZ
Raw strings:            46
Non-empty strings:      23
Pairs:                  23
DELETE operations:      23
Other operation types:   0
Ordered-array SHA-256:  0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC
```

The first 38 preinstall strings remain byte-for-byte consistent:

```text
Approved-prefix SHA-256:
54CC89DA4697363393AE7A956AF3FD689B8B3D10926955849995CD44CC286E84
MATCH
```

Four new DELETE pairs were appended:

| ID | Source | Exists | Size | Provenance |
|---|---|---:|---:|---|
| PFR-020 | `C:\ProgramData\Microsoft\VisualStudio\Packages\_bootstrapper\vs_setup_bootstrapper_202611212157011555.json` | yes, file | 246 | HIGH CONFIDENCE — Visual Studio installer bootstrap metadata |
| PFR-021 | `%USERPROFILE%\AppData\Local\Temp\DEL7D6C.tmp` | yes, file | 98040 | POSSIBLE — installer cleanup temp |
| PFR-022 | `%USERPROFILE%\AppData\Local\Temp\DEL7D7D.tmp` | yes, file | 176056 | POSSIBLE — installer cleanup temp |
| PFR-023 | `%USERPROFILE%\AppData\Local\Temp\DEL7D7E.tmp` | yes, file | 170800 | POSSIBLE — installer cleanup temp |

These 4 operations are **not approved** by the scoped exception. They were not
cleaned, moved, deleted or added to a new waiver.

## 16. Reboot Status

```text
Build Tools exit code:
0

vswhere isRebootRequired:
false

CBS RebootPending:
false

CBS PackagesPending:
false

Windows Update RebootRequired:
false

Windows Installer InProgress:
false

Windows automatic restart:
NOT OBSERVED
```

Tool installation is usable without a reboot according to the installer and
instance metadata, but four new pending cleanup deletions remain for a future
boot. No restart was initiated or authorized by this stage.

## 17. Logs and Evidence

External evidence root:

```text
C:\Users\thinkbook\AppData\Local\P13-RPC-Toolchain\R4-A1-R3-R5
```

Installer:

```text
C:\Users\thinkbook\AppData\Local\P13-RPC-Toolchain\R4-A1-R3-R5\vs_BuildTools.exe
```

Installer logs:

```text
C:\Users\thinkbook\AppData\Local\P13-RPC-Toolchain\R4-A1-R3-R5\logs
```

Installer log evidence:

```text
Log files copied:                 370
Total copied bytes:               28043595
Bootstrapper log:
  dd_bootstrapper_20261121215700.log
  SHA-256 40B7C36F80FCD4C3F25AEF2B378D00B44E87464712E72C89B5B85251B47993F0

Main setup log:
  dd_setup_20261121215732.log
  SHA-256 6D6978EEE04841A370EA07031FF08735B04D3CC5032A5BB53E3C39094D3EA18E

Elevated installer log:
  dd_installer_elevated_20261121215730.log
  SHA-256 1ADB3FC5A95D013BC25677E51E14D5710CB01E7395248648E4064D2B6119B5D7

Error log:
  dd_setup_20261121215732_errors.log
  Length 0
  SHA-256 E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855
```

Tool version/help evidence files are also stored in the external log directory.
No installer or log file was written into the repository.

## 18. Repository Integrity

Before this report:

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 26
Untracked: 188
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

The root paths `$null` and `$null)` remain absent. `.next` and Worker `dist`
whole-tree historical integrity remains `NOT VERIFIED`.

## 19. Warnings and Limitations

- PFR changed after installation; four new cleanup operations are not covered
  by the one-time exception.
- The Visual Studio installer added required dependency packages in addition to
  the three explicitly selected components. No recommended/optional switch was
  used.
- `cl.exe /Bv` returned code 2 only because no source filename was supplied; it
  emitted valid compiler and pass versions and compiled nothing.
- `link.exe /?` and `dumpbin.exe /?` use non-zero help return codes while
  emitting valid version/help text.
- No independent Microsoft checksum file was available; integrity relies on
  official HTTPS source, fixed URL hash segment, local SHA-256, Authenticode,
  trusted chain and timestamp.
- Windows resource/configuration warnings from prior audits remain separate and
  were not repaired.
- Native RPC build/runtime remains unverified and unauthorized.

## 20. Explicit Boundaries

```text
Native RPC Harness Build:
NOT EXECUTED

Native C/C++ Build:
NOT EXECUTED

MIDL Compilation:
NOT EXECUTED

ncalrpc Server/Client/Runtime:
NOT EXECUTED

Database / SQL / Migration / Storage:
NOT ACCESSED

ACL / Owner / Service / Driver / Task Changes:
NOT EXECUTED

PFR cleanup or edit:
NOT EXECUTED

Automatic reboot:
NOT EXECUTED

Git write:
NOT EXECUTED

R4-A2 / R4-B:
NOT AUTHORIZED / NOT ENTERED
```

## 21. Document Integrity

This report cannot contain its own stable SHA-256 without changing the file.
Its final SHA-256 is computed after the report is frozen and returned
externally.
