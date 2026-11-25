# P1-3 C-6.2-L8-A7.20-R4-A1-R3-R4 Pending Operations and Installation Risk Reassessment

## 0. Final Result

```text
Overall:
PASS WITH WARNINGS

Microsoft Mandatory Preinstall Reboot Requirement:
NOT FOUND IN REVIEWED OFFICIAL DOCUMENTATION

PFR Operational Risk:
MODERATE

CrossDevice Install Conflict:
NONE FOUND

Gaming Services Install Conflict:
NONE FOUND FROM AVAILABLE EVIDENCE

Gaming Services File Risk:
MODERATE — DELETE FAILURE CAUSE UNKNOWN

Build Tools Path Conflict:
NONE FOUND FOR KNOWN INSTALL NAMESPACES; FULL INSTALLER PAYLOAD NOT VERIFIED

Project Gate Classification:
PROJECT-IMPOSED CONSERVATIVE STOP RULE

Recommended Strategy:
SCOPED PFR EXCEPTION PROPOSED

R4-A1-R3 Installation Readiness:
BLOCKED PENDING USER DECISION ON SCOPED EXCEPTION

Installer Authenticity:
NOT VERIFIED

Native RPC Build:
NOT AUTHORIZED

Native RPC Runtime:
NOT AUTHORIZED

Repository Integrity:
PASS
```

This report recommends a narrowly scoped, one-time risk-acceptance proposal. It
does not approve that exception, modify the prior BLOCKED decision, clear the
PFR queue or authorize installation.

## 1. Scope and Inputs

```text
Stage:
C-6.2-L8-A7.20-R4-A1-R3-R4

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

Historical evidence:

| Document | SHA-256 |
|---|---|
| R4-A1-R3 installation report | `E3EEAA497F9E9C5EB2B44236EB2A01B9859A302048EF9E75EC081ACE3DCAC415` |
| R4-A1-R3-R1 pending-operations audit | `CB70731258A49259DD3308517F54A32BCF8B84BEAC479A298B04FF04AA7203E4` |
| R4-A1-R3-R2 post-reboot report | `52D7A3DAC199E39E594A81B4EA74E2506993DB0E34AA34E4CAE9098ED20FC870` |
| R4-A1-R3-R3 targeted investigation | `4C4B4674A4382C585189B4D6899855F0A5A083E4A10AEF751595B923160EAA62` |
| R4-A1-R1 toolchain assessment | `3E2987D2D815E64D3E642977D0E8D06C61D756F4D5E817444065ADAAD1F042BE` |
| R4-S11 R4-A final readiness | `400D761CB129501BE9F31F3601BA89C116568A28C81E6470B9753AB829D70525` |

## 2. Current PFR Baseline

Read-only registry snapshot:

```text
Value type:             REG_MULTI_SZ
Raw strings:            38
Non-empty strings:      19
Complete pairs:         19
DELETE:                 19
RENAME:                  0
MOVE:                    0
REPLACE:                 0
MALFORMED:               0
Ordered-array SHA-256:  54CC89DA4697363393AE7A956AF3FD689B8B3D10926955849995CD44CC286E84
```

Composition:

```text
18 × MicrosoftWindows.CrossDevice cache DELETE
 1 × Gaming Services backup DLL DELETE
```

The queue hash is unchanged from the R3-R3 investigation and remained stable
during this review.

## 3. CrossDevice 18-item Risk

The exact 18 paths are those under:

```text
%USERPROFILE%\AppData\Local\Temp\devicecenter\cache\
951524D9-92E3-43B3-B19E-3DF3B63EB513\
```

The detailed path list and ordering are in the R4-A1-R3-R3 report, from which
all 18 were individually rechecked.

| Risk question | Finding |
|---|---|
| Component identity | MicrosoftWindows.CrossDevice 1.26101.77.0, CONFIRMED |
| Current source objects | all 18 absent |
| Operation type | 18 DELETE |
| Destination conflicts | none |
| Repeated same-path recreation | none observed |
| Parent/child order | child before parent |
| Build Tools path overlap | none |
| Current filesystem data loss | none, sources already absent |
| Future queue behavior | new GUID may be created at component startup |
| Exact MoveFileEx caller | NOT VERIFIED |

The 18 entries do not currently identify files that can be deleted again. If
they remain absent until restart, their reboot effect is no-op.

```text
CrossDevice Install Conflict:
NONE FOUND

CrossDevice Risk:
LOW TO MODERATE
```

They should not by themselves be treated as evidence of disk damage, malware,
or a failing Build Tools prerequisite.

## 4. Gaming Services Single-item Risk

Current target:

```text
C:\Windows\System32\gamingservicesproxy_17.dll.0
Volume serial:       949EB069
File ID:             0x000000000000000000ec000000007ebf
Size:                530888
SHA-256:             13A63A6A4C628786F99C443901B5C6E3B656EB9E982DA0D95CDB1855EB18099C
Owner:               NT AUTHORITY\SYSTEM
Signature:           Valid, Microsoft Corporation
Hard links:          1
Reparse point:       false
```

Evidence assessment:

| Question | Finding |
|---|---|
| Known core boot driver? | NO |
| Explicitly proven Windows Resource Protection member? | NOT VERIFIED |
| Used by planned VS/MSVC/SDK/MIDL build? | NO EVIDENCE FOUND |
| Same path as a planned install target? | NO |
| Direct parent conflict with System32? | broad shared namespace only; no same filename |
| Known direct deletion-failure event? | NONE FOUND |
| File handle owner | NOT VERIFIED |

The target is not a substitute for `rpcrt4.dll`, a compiler, MIDL, or an SDK
library. It has the same content as the active non-suffixed Gaming Services
proxy but is a different File ID and a separate single-link file.

The file is not proven to be boot-critical. A signed, System32-hosted Microsoft
file may still be part of a protected servicing package, so neither signature
nor directory location is enough to classify deletion risk as absent.

```text
Gaming Services Install Conflict:
NONE FOUND FROM AVAILABLE EVIDENCE

Gaming Services File Risk:
MODERATE — DELETE FAILURE CAUSE UNKNOWN
```

The risk is primarily environmental/integrity uncertainty, not an identified
Visual Studio dependency.

## 5. Microsoft Official Requirements

The following Microsoft sources were reviewed read-only.

### 5.1 Visual Studio 2022 system requirements

Title:

`Visual Studio 2022 System Requirements`

URL:

<https://learn.microsoft.com/en-us/visualstudio/releases/2022/system-requirements?view=vs-2022>

Observed:

- HTTP 200;
- Windows 11 Home is listed as supported for Visual Studio 2022;
- 64-bit operating system required;
- `PendingFileRenameOperations` is not mentioned;
- no requirement to reboot merely because PFR is non-empty is stated.

`OS build 10.0.26300 specifically`: `NOT VERIFIED` against a static support
matrix; it is not treated as a failure.

### 5.2 Visual Studio command-line installation

Title:

`Use command-line parameters to install Visual Studio`

URL:

<https://learn.microsoft.com/en-us/visualstudio/install/use-command-line-parameters-to-install-visual-studio?view=vs-2022>

Observed:

- `--norestart` delays a necessary reboot during install/update/modify;
- exit `1641` means reboot initiated;
- exit `3010` means success but reboot is required before use;
- `PendingFileRenameOperations` is not listed as a prerequisite;
- Microsoft does not state that a non-empty PFR guarantees a safe install.

### 5.3 Network-based Visual Studio installation exit codes

Title:

`Create a network-based installation - Visual Studio`

URL:

<https://learn.microsoft.com/en-us/visualstudio/install/create-a-network-installation-of-visual-studio?view=vs-2022>

Observed:

- HTTP 200;
- exit code `1641`: operation succeeded and reboot was initiated;
- exit code `3010`: operation succeeded but requires reboot before use;
- no PFR-empty prerequisite was found.

### 5.4 Build Tools component IDs

Title:

`Visual Studio Build Tools component IDs`

URL:

<https://learn.microsoft.com/en-us/visualstudio/install/workload-component-id-vs-build-tools?view=vs-2022>

Observed:

- HTTP 200;
- `Microsoft.VisualStudio.Workload.VCTools` present;
- `Microsoft.VisualStudio.Component.VC.14.44.17.14.x86.x64` present;
- `Microsoft.VisualStudio.Component.Windows11SDK.26100` present;
- no PFR prerequisite is listed.

### 5.5 Classic MIDL

Title:

`Microsoft Interface Definition Language (MIDL)`

URL:

<https://learn.microsoft.com/en-us/windows/win32/midl/midl-start-page>

Observed:

- HTTP 200;
- identifies Microsoft MIDL and its Windows SDK relationship;
- no PFR prerequisite is listed.

### 5.6 Windows MoveFileEx semantics

Title:

`MoveFileExW function (winbase.h)`

URL:

<https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw>

Observed:

- PFR is `REG_MULTI_SZ`;
- a source plus empty destination is delete-at-reboot;
- source plus destination is rename-at-reboot;
- operations execute in registration order;
- directory deletion requires the directory to be empty.

This documents operation semantics, not Visual Studio installation policy.

### 5.7 Official-requirement conclusion

```text
Microsoft explicit preinstall requirement to empty PFR:
NOT FOUND IN REVIEWED OFFICIAL DOCUMENTATION

Microsoft guarantee that arbitrary non-empty PFR is safe for Build Tools:
NOT FOUND AND NOT CLAIMED

Visual Studio Installer may itself need/initiate a reboot:
DOCUMENTED
```

Both a blanket claim that PFR must be empty and a blanket claim that any PFR is
safe would be unsupported.

## 6. Installation Target and PFR Conflict Matrix

The comparison is based on documented/default install namespaces because the
current installer bytes and complete manifest have not been downloaded.

| Planned target namespace | Exact/descendant PFR matches | Assessment |
|---|---:|---|
| `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools` | 0 | no path conflict |
| `C:\Program Files (x86)\Microsoft Visual Studio\Installer` | 0 | no path conflict |
| `C:\Program Files (x86)\Windows Kits\10` | 0 | no SDK/MIDL/lib conflict |
| `C:\ProgramData\Microsoft\VisualStudio\Packages` | 0 | no package-cache conflict |
| `%LOCALAPPDATA%\P13-RPC-Toolchain` | 0 | no staging/download conflict |
| `C:\Windows\System32` | 1 | Gaming Services `.dll.0` only |

MSVC installs below the Build Tools tree; Windows SDK, Classic MIDL, headers and
`Rpcrt4.lib` install below the Windows Kits tree. None of the 18 CrossDevice
temp-cache operations overlaps either namespace.

The single System32 path is not the installed RPC runtime
`C:\Windows\System32\rpcrt4.dll`, compiler, linker, SDK header or import
library. No exact filename or child-path overlap with the authorized component
set was found.

### Important limitation

Because the Bootstrapper has not been downloaded and its complete payload list
has not been inspected, this is a design/default-path preassessment:

```text
Build Tools Path Conflict:
NONE FOUND FOR KNOWN INSTALL NAMESPACES

FULL INSTALLER PAYLOAD CONFLICT:
NOT VERIFIED
```

The installer may create temporary files in other system locations after
download. A future installer phase must recheck the exact payload and fail
closed if it touches a current PFR source or is blocked by an OS servicing
state.

## 7. Original Gate Classification

The non-empty PFR blocker was imposed by the project's own installation
authorization rules:

```text
If an unfinished install/update state exists:
stop.
```

It is not quoted from a Microsoft document that says Build Tools must fail or
must not be installed whenever PFR is non-empty.

```text
Project Gate Classification:
PROJECT-IMPOSED CONSERVATIVE STOP RULE
```

The conservative rule correctly prevented an unexplained system state from
being silently ignored. It should not be rewritten ex post facto.

## 8. Strategy Comparison

### Strategy A — Strict Block

Requirements:

- PFR must become empty before installation.

Advantages:

- strongest integrity posture;
- avoids accepting the unexplained Gaming Services deletion.

Disadvantages:

- CrossDevice can recreate cache-cleanup entries on startup;
- another reboot has not been shown to produce an empty queue;
- installation could remain blocked indefinitely.

When appropriate:

- user requires zero unexplained pending operations; or
- direct conflict/failure evidence is discovered.

### Strategy B — Scoped PFR Exception

Proposed exact scope:

- only the current 19 operations;
- only while the ordered-array SHA-256 remains exactly
  `54CC89DA4697363393AE7A956AF3FD689B8B3D10926955849995CD44CC286E84`;
- no change to the PFR registry;
- no deletion of the Gaming Services file;
- no deletion of CrossDevice caches;
- no expansion to future .NET, VS, SDK, driver or other servicing operations;
- exception expires immediately before the install attempt starts.

Advantages:

- isolates the 18 high-confidence benign cache deletes;
- no current path conflict with documented install namespaces;
- correctly treats the old project gate as a risk threshold rather than a
  Microsoft hard rule.

Residual risk:

- Gaming Services deletion cause remains UNKNOWN;
- handle ownership remains NOT VERIFIED;
- full installer payload remains NOT VERIFIED;
- installer behavior under the exact non-empty PFR state has not been executed.

### Strategy C — Additional Evidence

Suggested only if the user does not accept the Gaming Services residual risk.

- future separately authorized use of a verified Microsoft Sysinternals Handle
  binary or equivalent non-writing diagnostic;
- resolve handle ownership;
- determine whether the target is protected by a servicing/filter mechanism;
- re-evaluate before any installer download.

Advantages:

- strongest evidence.

Disadvantages:

- requires a new tool authorization/download;
- delays installation;
- does not help if handle ownership is transient or already gone.

## 9. Recommendation

```text
Recommended Strategy:
SCOPED PFR EXCEPTION PROPOSED
```

The proposed exception is justifiable because:

- 18 of 19 operations are absent-source CrossDevice cache deletes;
- there is no path overlap with documented Build Tools, Visual Studio Installer,
  Windows Kits, MSVC, MIDL, RPC header or library namespaces;
- the single existing source is a validly signed Microsoft component and has
  no demonstrated dependency on the future build;
- no Microsoft document was found requiring an empty PFR before installation;
- the Build Tools installer documents reboot handling through `--norestart`,
  `3010` and `1641`.

The exception remains a warning, not a Microsoft certification. The user must
explicitly approve the exact PFR state and accept the unresolved Gaming
Services deletion cause.

## 10. Conditions for a Future Scoped Exception

The user would need to explicitly approve all of:

1. The exception applies only to the exact 19 PFR pairs and exact SHA-256 above.
2. Any queue change invalidates the exception.
3. Any new path, rename, move or replacement operation invalidates it.
4. The PFR registry must not be edited or cleared.
5. No unrelated cleanup is permitted.
6. Installer download and hash/signature verification must be repeated.
7. The installer phase must compare its dynamically created/downloaded paths
   with the PFR queue where practical.
8. `--norestart` must be used; no automatic reboot is authorized.
9. Exit codes `1641` or `3010`, if returned, require stop and separate reboot
   review.
10. Native RPC Build and Runtime remain separately unauthorized.

This report does not grant any item above.

## 11. System Warnings

| Existing warning | Version/target | Direct PFR or Build Tools causality |
|---|---|---|
| WUDFRd 219 / `0xC0000365` | Windows kernel PnP stack | NONE FOUND |
| Lenovo Windows Security Center error | Huorong `wsctrlsvc.exe`, valid signature | NONE FOUND |
| RTCore64 registration | MSI Afterburner driver, valid signature | NONE FOUND |

These should remain separate environmental warnings. They do not justify
driver/service repair, and no evidence directly says they block Visual Studio
installation. Their absence of causality is not proof that the host is fully
healthy.

```text
System Warning Install Block:
NO DIRECT BLOCKING EVIDENCE
```

## 12. Installation Readiness

```text
R4-A1-R3 Installation Readiness:
BLOCKED PENDING USER DECISION ON SCOPED EXCEPTION

INSTALLER AUTHENTICITY:
NOT VERIFIED

TOOLCHAIN:
NOT INSTALLED

NATIVE RPC BUILD:
NOT AUTHORIZED

NATIVE RPC RUNTIME:
NOT AUTHORIZED
```

A scoped exception approval would permit a future controlled installer attempt,
not declare installation success or remove the need for hash/signature and
post-install validation.

## 13. Repository Integrity

Before this report:

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 26
Untracked: 187
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

The anomalous root paths `$null` and `$null)` remain absent. The complete
`.next` and Worker `dist` historical trees remain `NOT VERIFIED`.

## 14. Evidence Gaps and NOT VERIFIED Items

```text
Prior Gaming Services NTFS File ID:
NOT VERIFIED

Prior Gaming Services Volume Serial:
NOT VERIFIED

Gaming Services handle owner:
NOT VERIFIED

Gaming Services deletion-failure cause:
UNKNOWN

Windows Resource Protection membership:
NOT VERIFIED

Exact CrossDevice MoveFileEx caller:
NOT VERIFIED

Complete Visual Studio installer payload:
NOT VERIFIED — NOT DOWNLOADED

Current Installer Authenticode/hash:
NOT VERIFIED — NOT DOWNLOADED

OS build 10.0.26300 exact static-support listing:
NOT VERIFIED

Security event log:
NOT VERIFIED / ACCESS DENIED
```

## 15. Side Effects and Non-actions

```text
Installer download or execution:
NOT EXECUTED

PFR modification or cleanup:
NOT EXECUTED

File delete/move/rename:
NOT EXECUTED

Service/task/driver changes:
NOT EXECUTED

ACL/Owner/DACL changes:
NOT EXECUTED

Restart/shutdown:
NOT EXECUTED

Native RPC Build/Runtime:
NOT EXECUTED

Database/SQL/Migration/Storage:
NOT ACCESSED

Git write:
NOT EXECUTED
```

The read-only hash checks can advance LastAccessTime on the Gaming Services
file. No content or LastWriteTime was deliberately changed.

## 16. Document Integrity

This report cannot contain its own stable SHA-256 without changing the file.
The SHA-256 is computed after the report is frozen and returned externally.
