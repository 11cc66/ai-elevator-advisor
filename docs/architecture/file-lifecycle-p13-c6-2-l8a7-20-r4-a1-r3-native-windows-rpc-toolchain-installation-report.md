# P1-3 C-6.2-L8-A7.20-R4-A1-R3 Native Windows RPC Toolchain Installation Report

## 0. Final Result

```text
Stage:
C-6.2-L8-A7.20-R4-A1-R3

Date:
2026-11-21

Overall:
BLOCKED — PENDING SYSTEM FILE-RENAME OPERATIONS

Installer Authenticity:
NOT VERIFIED — INSTALLER NOT DOWNLOADED

Build Tools Installation:
BLOCKED / NOT EXECUTED

MSVC v143 Verification:
NOT VERIFIED

Windows SDK Verification:
NOT VERIFIED

Classic MIDL Verification:
NOT VERIFIED

RPC Headers / Libraries Verification:
NOT VERIFIED

Native RPC Build Readiness:
BLOCKED

Native RPC Runtime Verification:
NOT AUTHORIZED / NOT EXECUTED

R4-A1 Status:
BLOCKED
```

The installation preflight found non-empty
`HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\PendingFileRenameOperations`
with 62 array entries and 31 non-empty rename operations. This is an unfinished
system update/installation state and matches the authorized stop condition.
The installer was not downloaded or executed.

No automatic reboot, cleanup, repair, rollback or removal was attempted.

## 1. Stage Scope and Skills

Repository:

```text
D:\thinkbook\Desktop\jieya
```

Skills actually loaded and applied:

```text
$project-architecture
$security-audit
$testing-and-verification
```

Documents fully read:

1. R4-A1-R2 Native RPC Toolchain Provisioning Design.
2. R4-A1-R2 Provisioning Readiness Report.
3. R4-A1-R2-R1 Installation Manifest.
4. R4-A1-R2-R1 Final Readiness Report.
5. R4-A1-R2-R2 Reappeared Root File Investigation.
6. R4-A1-R2-R3 Exact Root File Deletion Report.
7. R4-A1-R2-R4 Post-cleanup Reconciliation Report.
8. R4-A1 Implementation and Validation Report.

## 2. Git Baseline

Before this report:

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

Tracked modified:
26

Untracked:
183

Staged:
0

Deleted:
0
```

The baseline matches the authorized history. No Git write command was
executed. Adding this required report accounts for the only expected new
project path.

## 3. Windows and Permission Preflight

```text
OS:
Microsoft Windows 11 家庭版 中文版

Version:
10.0.26300

Build:
26300

Architecture:
x64

Current user:
LAPTOP-34H6Q1OD\thinkbook

Current process administrator:
false

System disk:
C: NTFS, 314313404416 bytes free
```

Administrator elevation is required for the future installation, but normal
UAC was not requested because an earlier mandatory stop condition had already
failed. Elevation remains `NOT ATTEMPTED`.

## 4. Existing Toolchain and Installer State

```text
Windows Kits 10 root:
ABSENT

Visual Studio Installer directory:
ABSENT

Visual Studio 2022 Build Tools directory:
ABSENT

vswhere.exe:
NOT FOUND

midl.exe:
NOT FOUND

cl.exe:
NOT FOUND

link.exe:
NOT FOUND

dumpbin.exe:
NOT FOUND

DevEnvDir / VCINSTALLDIR / VSINSTALLDIR / WindowsSdkDir:
empty

PATH entries containing Visual Studio / Windows Kits / MSVC:
0

INCLUDE entries:
0

LIB entries:
0

Windows Installer service:
Stopped / Manual
```

No active Visual Studio installer or setup process was observed.

## 5. Pending System Operations

Read-only reboot indicators:

```text
CBS RebootPending:
false

Windows Update RebootRequired:
false

PendingFileRenameOperations property:
present and non-empty

Array entries:
62

Non-empty operations:
31
```

The pending operations affect operating-system component, Office ClickToRun,
font and print-spool areas. They are evidence of incomplete file replacement
or removal pending a restart. This stage does not attribute them to a
particular product and does not expose their local paths in this report.

Because the authorized installation rules prohibit proceeding with an
unfinished system installation/update state, installation is blocked. This
state must be resolved and the machine restarted by the user before a new
installation attempt is authorized.

## 6. Official Version and Component Verification

Microsoft Visual Studio 2022 release history:

```text
URL:
https://learn.microsoft.com/en-us/visualstudio/releases/2022/release-history

HTTP status:
200

Contains 17.14:
true

Contains 17.14.44:
true

Contains 17.14.37827.9:
true
```

Microsoft Visual Studio Build Tools component IDs:

```text
URL:
https://learn.microsoft.com/en-us/visualstudio/install/workload-component-id-vs-build-tools

HTTP status:
200

Microsoft.VisualStudio.Workload.VCTools:
present

Microsoft.VisualStudio.Component.VC.14.44.17.14.x86.x64:
present

Microsoft.VisualStudio.Component.Windows11SDK.26100:
present
```

The requested 17.14/MSVC 14.44/Windows SDK 26100 component identity is
therefore still supported by the current official documentation.

## 7. Installer Source and Redirect

Requested official source:

```text
https://aka.ms/vs/17/release/vs_buildtools.exe
```

HEAD request result:

```text
HTTP status:
200

Final host:
download.visualstudio.microsoft.com

Final URL:
https://download.visualstudio.microsoft.com/download/pr/95995f57-8355-4ff5-8d90-a7e1669fb3b3/8aaf70d164808d313ee6226af5d1e3b2db43c60be551bfeb2b70ce139d792c37/vs_BuildTools.exe

HEAD Content-Length:
4474072
```

The final URL is on the expected Microsoft download domain. The hash-like path
segment is not a computed file hash and is not treated as verification.

The current redirect differs from the historical R2-R1 manifest record:

```text
R2-R1 URL hash segment:
310c13b8238876afb4e823a91112230ee2d2c5a45c431d4062af7aadedff9c4c

Current redirect URL hash segment:
8aaf70d164808d313ee6226af5d1e3b2db43c60be551bfeb2b70ce139d792c37
```

This is consistent with an updated servicing bootstrapper and is not evidence
of tampering by itself. No installer bytes were downloaded, so the current
file version, file SHA-256 and Authenticode signature remain unverified.

## 8. Installer Integrity Status

Download directory:

```text
%LOCALAPPDATA%\P13-RPC-Toolchain\downloads
Created: no
Exists: no

Downloaded Build Tools installers:
0
```

| Evidence state | Result |
|---|---|
| Official source identified | PASS |
| Redirect destination is Microsoft HTTPS | PASS |
| Installer downloaded | NO |
| Local file size recorded | NOT VERIFIED |
| Computed SHA-256 | NOT VERIFIED |
| Independent expected SHA-256 | NOT VERIFIED |
| Hash match | NOT VERIFIED |
| Authenticode status | NOT VERIFIED |
| Publisher verified | NOT VERIFIED |
| Certificate chain and timestamp verified | NOT VERIFIED |

No installer was run because source availability alone is insufficient and the
system preflight had already failed.

## 9. Installation Result

```text
Visual Studio 2022 Build Tools installed by this stage:
NO

Channel:
NOT VERIFIED

Installed product version:
NOT VERIFIED

Installed component IDs:
NOT VERIFIED

Installation log:
NONE — INSTALLER NOT RUN

Installer exit code:
NOT AVAILABLE

Reboot required by installer:
NOT APPLICABLE — INSTALLER NOT RUN
```

No `.exe`, installer cache, installer log or temporary toolchain artifact was
written into the project.

## 10. MSVC, SDK and MIDL Verification

Because no installation occurred, the following remain `NOT VERIFIED`:

- `vswhere.exe` path and version;
- Visual Studio Installer instance and product identity;
- installed component list;
- MSVC v143 compiler, linker and dumpbin paths;
- `cl.exe /Bv`, `link.exe /?` and `dumpbin.exe /?`;
- host x64 and target x86/x64 libraries;
- `VsDevCmd.bat`;
- Windows SDK version and actual install root;
- classic `midl.exe` and `midlc.exe`;
- MIDL binary signature and SDK association;
- RPC headers;
- x86 and x64 `Rpcrt4.lib`.

`CLASSIC MIDL NOT VERIFIED`.

No source or IDL file was compiled and no help command for an unavailable
tool was simulated.

## 11. Windows RPC Runtime

```text
Path:
C:\Windows\System32\rpcrt4.dll

File version:
10.0.26100.9949 (WinBuild.160101.0800)

Authenticode status:
Valid

Signer subject:
CN=Microsoft Windows, O=Microsoft Corporation, L=Redmond,
S=Washington, C=US

Issuer:
CN=Microsoft Windows Production PCA 2026 RSA2048-SHA256,
O=Microsoft Corporation, C=US

Signer thumbprint:
667BBA1E1F478221AA65DE4F75187A751B03A453

Certificate validity:
2026-08-07 through 2027-08-06

Timestamp signer:
Microsoft Time-Stamp Service
```

The current RPC runtime version matches the earlier recorded system runtime
version. This does not verify any SDK header or import library.

## 12. Protected Object Hashes

Before installation was rejected:

| Object | Exact path | Baseline / current SHA-256 | Result |
|---|---|---|---|
| FZ | `docs/architecture/file-lifecycle-p13-design-freeze.md` | `E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705` | MATCH |
| ST | `docs/architecture/file-lifecycle-p13-implementation-status.md` | `5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586` | MATCH |
| DBTP | `docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md` | `FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7` | MATCH |
| Prisma Schema | `prisma/schema.prisma` | `78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299` | MATCH |
| Next environment declaration | `apps/web/next-env.d.ts` | `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC` | MATCH |
| TypeScript incremental cache | `apps/web/tsconfig.tsbuildinfo` | `21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520` | MATCH |

No protected object was rebuilt or modified. The A7.18 narrow waiver remains
limited to the single approved historical `tsconfig.tsbuildinfo` transition.
Whole `.next`, Worker `dist` and all build artifacts remain `NOT VERIFIED`.

## 13. Unverified Items and Warnings

- Current Build Tools bootstrapper file identity and signature are unverified
  because the binary was not downloaded.
- The installer version behind the current `aka.ms` redirect is not proven by
  the URL or HEAD response.
- SDL/RPC payloads under the Windows 11 SDK component remain unknown until an
  authorized installation can be inspected.
- Normal UAC/elevation has not been exercised.
- Pending file-rename operations require user-controlled restart and a fresh
  preflight before another installation attempt.
- Historical C1-C2 full untracked-path membership remains not fully verified,
  as recorded by R4-A1-R2-R4.
- No claim is made for whole-repository, `.next` or `dist` historical
  integrity.

## 14. Execution Boundary

```text
Installer download:
NOT EXECUTED

Installer execution:
NOT EXECUTED

UAC elevation:
NOT ATTEMPTED

Windows SDK / Build Tools / MSVC / MIDL installation:
NOT EXECUTED

Native source creation:
NOT EXECUTED

C / C++ compilation:
NOT EXECUTED

MIDL compilation:
NOT EXECUTED

ncalrpc server/client/runtime test:
NOT EXECUTED

Database / SQL / Migration:
NOT ACCESSED

Storage / Cleanup:
NOT ACCESSED

ACL / IAM / Service / Job:
NOT MODIFIED

Git write / commit:
NOT EXECUTED

R4-A1-R4 / R4-A2 / R4-B:
NOT AUTHORIZED / NOT ENTERED
```

## 15. Document Integrity

This report cannot contain its own stable SHA-256 without changing the file.
Its final SHA-256 is computed after freezing the report and reported externally.

## 16. Required Next Action

The user must resolve the pending Windows file-renaming operations through the
normal operating-system update/restart process. This report does not authorize
or perform system rollback, repair, cleanup or reboot.

After a successful restart, a fresh R4-A1-R3 attempt must re-run all preflight
checks before any installer download or UAC request.
