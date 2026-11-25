# P1-3 C-6.2-L8-A7.20-R4-A1-R3-R2 Post-Reboot Fresh Preflight Report

## 0. Final Result

```text
Overall:
PASS WITH WARNINGS

Boot Verification:
CONFIRMED

Pending Operations:
PRESENT — 19 DELETE operations

Pending Operations Parsing:
PASS

System Reboot State:
PENDING OPERATIONS PRESENT

System Warnings:
WARNINGS RECURRED

MSVC v143:
NOT INSTALLED

Windows SDK:
NOT INSTALLED

Classic MIDL:
NOT INSTALLED

RPC Headers / Libraries:
NOT INSTALLED

R4-A1-R3 Installation Readiness:
BLOCKED

Installer Authenticity:
NOT VERIFIED

Native RPC Build:
NOT AUTHORIZED

Native RPC Runtime:
NOT AUTHORIZED

Repository Integrity:
PASS WITH WARNINGS
```

The restart was real and processed most of the previous queue, but the system is
not clean. The previous Gaming Services backup file remains and is still
represented by PendingFileRenameOperations. A new set of Microsoft CrossDevice
cache deletions was also registered after this boot.

No install, cleanup, repair, service change, registry write, download or Git
write was performed.

## 1. Stage and Inputs

```text
Stage:
C-6.2-L8-A7.20-R4-A1-R3-R2

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

Historical documents fully read:

| Document | Current SHA-256 |
|---|---|
| R4-A1-R3 installation report | `E3EEAA497F9E9C5EB2B44236EB2A01B9859A302048EF9E75EC081ACE3DCAC415` |
| R4-A1-R3-R1 pending-operations audit | `CB70731258A49259DD3308517F54A32BCF8B84BEAC479A298B04FF04AA7203E4` |
| R4-A1-R2-R4 post-cleanup reconciliation | `8F4C2A20C4A486CA4B8EFD27F9846E886F6DD32EF4A479380CEC3AA8599840B3` |
| R4-A1-R1 feasibility report | `BD46AC47E9891F0B0DF1CFFB969A0977AC91D07888AC66524C6C197DD7270096` |
| R4-S11 R4-A final readiness report | `400D761CB129501BE9F31F3601BA89C116568A28C81E6470B9753AB829D70525` |

There is no repository file named
`file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r3-r4-final-reconciliation-report.md`.
The actual related file is
`file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r2-r4-post-cleanup-installation-manifest-reconciliation.md`,
which was read and is recorded above.

## 2. Boot Verification

Current boot evidence:

```text
Windows LastBootUpTime:
2026-11-21 21:26:45.5 +08:00

Audit observation time:
2026-11-21 21:35:48 +08:00

Approximate uptime:
9 minutes

Previous audit observation:
2026-11-21 approximately 18:45 +08:00
```

System event evidence:

```text
21:26:02  User32 / Event ID 1074
StartMenuExperienceHost requested a restart for user LAPTOP-34H6Q1OD\thinkbook

21:26:10  EventLog / ID 6006
Event Log service stopped

21:27:06  EventLog / ID 6005
Event Log service started
```

The event sequence, current boot time and uptime all independently support a
real restart:

```text
Boot Verification:
CONFIRMED
```

## 3. PendingFileRenameOperations After Reboot

Read-only registry query:

```text
HKLM\SYSTEM\CurrentControlSet\Control\Session Manager
PendingFileRenameOperations

Value type:             REG_MULTI_SZ
Raw string count:       38
Non-empty strings:      19
Pair count:             19
DELETE:                 19
RENAME / MOVE / REPLACE: 0
UNKNOWN operation type: 0
MALFORMED:              0
Ordered-array SHA-256:  54CC89DA4697363393AE7A956AF3FD689B8B3D10926955849995CD44CC286E84
```

The value was read in original order. Every pair has a non-empty source and an
empty destination.

Comparison with the pre-reboot queue:

```text
Pre-reboot:
  62 strings
  31 DELETE operations
  19C5E50505E65EC005FF84ADFAA7CD49FD8A08A9652454FEC240CEE2E00ECCCB

Post-reboot:
  38 strings
  19 DELETE operations
  54CC89DA4697363393AE7A956AF3FD689B8B3D10926955849995CD44CC286E84

Previous paths no longer present in the new queue:
  30

Previous paths still present:
  PFR-001: C:\Windows\System32\gamingservicesproxy_17.dll.0

New paths in the current queue:
  18 DeviceCenter cache paths
```

The `*1\??\` and `*2\??\` prefix semantics remain undocumented on the
Microsoft `MoveFileExW` reference and remain `UNKNOWN` modifiers. They do not
change the delete classification, which follows from the empty destination.

## 4. Current 19 Operations

The account-home segment is represented as `%USERPROFILE%`.

| ID | Source | Destination | Type | Source exists |
|---|---|---|---|---|
| PFR-001 | `*1\??\C:\Windows\System32\gamingservicesproxy_17.dll.0` | empty | DELETE | yes, file |
| PFR-002 | `*2\??\%USERPROFILE%\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\blob_storage\6cd4d849-6aff-49ec-aa55-b95de5392320` | empty | DELETE | no |
| PFR-003 | `*2\??\%USERPROFILE%\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\blob_storage` | empty | DELETE | no |
| PFR-004 | `*2\??\%USERPROFILE%\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Cache\Cache_Data` | empty | DELETE | no |
| PFR-005 | `*2\??\%USERPROFILE%\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Cache` | empty | DELETE | no |
| PFR-006 | `*2\??\%USERPROFILE%\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Code Cache\js\index-dir` | empty | DELETE | no |
| PFR-007 | `*2\??\%USERPROFILE%\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Code Cache\js` | empty | DELETE | no |
| PFR-008 | `*2\??\%USERPROFILE%\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Code Cache\wasm\index-dir` | empty | DELETE | no |
| PFR-009 | `*2\??\%USERPROFILE%\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Code Cache\wasm` | empty | DELETE | no |
| PFR-010 | `*2\??\%USERPROFILE%\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Code Cache` | empty | DELETE | no |
| PFR-011 | `*2\??\%USERPROFILE%\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Dictionaries` | empty | DELETE | no |
| PFR-012 | `*2\??\%USERPROFILE%\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Local Storage\leveldb` | empty | DELETE | no |
| PFR-013 | `*2\??\%USERPROFILE%\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Local Storage` | empty | DELETE | no |
| PFR-014 | `*2\??\%USERPROFILE%\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Network` | empty | DELETE | no |
| PFR-015 | `*2\??\%USERPROFILE%\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Session Storage` | empty | DELETE | no |
| PFR-016 | `*2\??\%USERPROFILE%\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Shared Dictionary\cache\index-dir` | empty | DELETE | no |
| PFR-017 | `*2\??\%USERPROFILE%\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Shared Dictionary\cache` | empty | DELETE | no |
| PFR-018 | `*2\??\%USERPROFILE%\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Shared Dictionary` | empty | DELETE | no |
| PFR-019 | `*2\??\%USERPROFILE%\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\WidevineCdm` | empty | DELETE | no |

Only PFR-001 currently resolves to an existing object. The other 18 sources are
already absent.

## 5. Previous Five Objects

| Previous object | Current result |
|---|---|
| `C:\Windows\System32\gamingservicesproxy_17.dll.0` | STILL EXISTS |
| `C:\Program Files\Common Files\microsoft shared\ClickToRun\Updates\16.0.20625.20108` | ABSENT |
| `C:\Program Files\Common Files\microsoft shared\ClickToRun\Updates` | ABSENT |
| `C:\Windows\System32\spool\V4Dirs\82910F3A-E5F4-46ED-9D9C-146A51E9C5B2\94766af2.BUD` | ABSENT |
| `C:\Windows\System32\spool\V4Dirs\82910F3A-E5F4-46ED-9D9C-146A51E9C5B2` | ABSENT |

Current PFR-001 identity:

```text
Type:             regular file
Size:             530888 bytes
Creation UTC:     2026-11-11T09:07:52.7034948Z
Last write UTC:   2026-11-11T09:07:07.0197840Z
Owner:            NT AUTHORITY\SYSTEM
Attributes:       Archive
Link type:        none
Reparse point:    false
Hard-link paths:  1
File version:     10.0.26100.9656
SHA-256:          13A63A6A4C628786F99C443901B5C6E3B656EB9E982DA0D95CDB1855EB18099C
Authenticode:     Valid, Microsoft Corporation
```

Its identity is unchanged from the previous audit. It was neither deleted nor
recreated with a new creation timestamp. The reason the queued deletion did
not complete across the restart is `UNKNOWN`; no direct failure event was
found.

## 6. New DeviceCenter Operations

Current-boot evidence:

```text
CrossDeviceService:
started 2026-11-21 21:27:19 local

New cache GUID directory:
951524D9-92E3-43B3-B19E-3DF3B63EB513

Created UTC:
2026-11-21T13:27:27.1760736Z

Immediate root files:
first_party_sets.db
first_party_sets.db-journal
Visited Links
```

The 18 current DeviceCenter PFR entries target cache subdirectories under this
new GUID. None of those subdirectory sources is currently present.

The path family, component installation, new GUID creation and process start
support:

```text
Provenance:
HIGH CONFIDENCE — Microsoft CrossDevice/Phone component family

Exact MoveFileEx caller:
NOT VERIFIED
```

No DeviceCenter or CrossDevice user file content was read.

## 7. Persistence and Queue Interpretation

Restart outcome:

```text
Previous Office Click-to-Run delete operations:
PROCESSED — paths absent

Previous print-spool V4 delete operations:
PROCESSED — paths absent

Previous DeviceCenter GUID cache operations:
REMOVED FROM QUEUE — old source paths absent

Previous Gaming Services backup deletion:
NOT COMPLETED — source still exists and remains in queue

New CrossDevice cache operations:
CREATED AFTER BOOT
```

The queue hash changed and the old queue cannot be assumed unprocessed. It is
also unsafe to call the result CLEAN because one old operation remains and new
operations were registered after boot.

## 8. Reboot-related System State

| Check | Current result |
|---|---|
| PendingFileRenameOperations | present, 38 strings / 19 DELETE pairs |
| CBS RebootPending | absent |
| CBS PackagesPending | absent |
| CBS SessionsPending | 15 retained sessions; incomplete sessions = 0 |
| Windows Update RebootRequired | absent |
| Windows Update Services Pending | key present, no subkeys |
| Windows Update Orchestrator | Running / Automatic |
| Windows Installer InProgress | absent |
| msiserver | Stopped / Manual |
| TrustedInstaller service | Stopped |
| Visual Studio Installer | absent |
| Current Office Click-to-Run transaction | none observed after boot |
| Current reboot prompt UI | `NOT VERIFIED` |
| Security event log | `NOT VERIFIED / ACCESS DENIED` for non-admin shell |

Windows Update history still reports 490 entries. The latest successful entry
is Defender intelligence update `1.463.398.0`; no new OS update was installed
by this audit.

Classification:

```text
System Reboot State:
PENDING OPERATIONS PRESENT
```

## 9. Previous System Warnings

The following warnings recurred in the current boot:

```text
WUDFRd driver load failures:
RECURRED — multiple Kernel-PnP event ID 219, status 0xC0000365

Lenovo Windows Security Center:
RECURRED — Service Control Manager ID 7000 reported Windows could not verify
the file signature at 21:27:19

RTCore64:
RECURRED — service was registered at 21:27:19
Driver path: D:\OSD\MSI Afterburner\RTCore64.sys
Signature: Valid, MICRO-STAR INTERNATIONAL CO., LTD.

Office Click-to-Run service:
RUNNING / AUTOMATIC

Lenovo VCamera Installer service:
RUNNING / AUTOMATIC

Gaming Services:
RUNNING / AUTOMATIC
```

The Lenovo security-center service path resolves to a validly signed Huorong
binary, yet the Windows service startup event still reports a signature
verification failure. The cause is `NOT VERIFIED` and no remediation was
attempted.

Other current-boot warnings included WSearch termination, QQLive/Intel service
timeouts, DistributedCOM permission warnings and BitLocker key-retrieval
errors. They are recorded as system warnings and were not changed.

No warning was repaired, suppressed or dismissed.

## 10. Windows and Permission Inventory

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

Current token elevated:
false

UAC EnableLUA:
1

ConsentPromptBehaviorAdmin:
5

C: free space:
312197423104 bytes

npm/pnpm-managed toolchain:
not installed
```

Normal UAC exists but has not been exercised:

```text
Interactive UAC availability:
NOT VERIFIED UNTIL A FUTURE AUTHORIZED INSTALL
```

## 11. Native RPC Toolchain Inventory

```text
Visual Studio Installer:
ABSENT

Visual Studio 2022 Build Tools:
ABSENT

Windows SDK 26100:
ABSENT

cl.exe:
NOT FOUND

link.exe:
NOT FOUND

dumpbin.exe:
NOT FOUND

midl.exe:
NOT FOUND

vswhere.exe:
NOT FOUND

RPC SDK headers:
NOT INSTALLED

x64 Rpcrt4.lib:
NOT INSTALLED

x86 Rpcrt4.lib:
NOT INSTALLED

%LOCALAPPDATA%\P13-RPC-Toolchain:
ABSENT

rpcrt4.dll:
PRESENT

rpcrt4.dll version:
10.0.26100.9949

rpcrt4.dll Authenticode:
VALID

rpcrt4.dll signer:
Microsoft Windows / Microsoft Corporation
```

Official Microsoft release history and component pages were queried read-only.
They returned HTTP 200 and contained the 17.14.44 release, 17.14.37827.9 build,
VCTools workload, MSVC 14.44 component ID and Windows 11 SDK 26100 component ID.
The `aka.ms` bootstrapper HEAD still redirects to Microsoft's HTTPS CDN.

No installer was downloaded.

## 12. Installation Readiness

```text
SYSTEM REBOOT REQUIRED:
YES — PFR-001 persisted and new CrossDevice operations appeared

ADMINISTRATOR ELEVATION REQUIRED:
YES — CURRENT PROCESS IS NON-ADMIN

INSTALLER AUTHENTICITY NOT VERIFIED:
YES — MORE THAN A HEAD REQUEST HAS NOT BEEN PERFORMED

TOOLCHAIN NOT INSTALLED:
YES

MISSING TOOLCHAIN:
Visual Studio Build Tools, Windows SDK, MSVC, Classic MIDL,
RPC headers/libraries, vswhere

NATIVE RPC BUILD:
NOT AUTHORIZED

NATIVE RPC RUNTIME:
NOT AUTHORIZED

R4-A1-R3 Installation Readiness:
BLOCKED
```

The former pre-reboot PFR queue is not simply gone; one old entry remains and
new entries were registered during the current boot. Another blind reboot is
not recommended as a validated remediation because the same services are
configured to start automatically and have already regenerated cleanup work.
Installation must remain blocked until the PFR condition is understood or a
clean interval after reboot is independently demonstrated.

## 13. Repository Integrity

Before this report:

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 26
Untracked: 185
Staged: 0
Deleted: 0
```

Six protected objects:

| Object | Exact path | Baseline / current SHA-256 | Result |
|---|---|---|---|
| FZ | `docs/architecture/file-lifecycle-p13-design-freeze.md` | `E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705` | MATCH |
| ST | `docs/architecture/file-lifecycle-p13-implementation-status.md` | `5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586` | MATCH |
| DBTP | `docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md` | `FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7` | MATCH |
| Prisma Schema | `prisma/schema.prisma` | `78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299` | MATCH |
| `apps/web/next-env.d.ts` | `apps/web/next-env.d.ts` | `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC` | MATCH |
| `apps/web/tsconfig.tsbuildinfo` | `apps/web/tsconfig.tsbuildinfo` | `21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520` | MATCH |

The two exact anomalous root files `$null` and `$null)` were checked through
Node.js filesystem APIs and do not exist.

The complete `.next` and Worker `dist` historical trees remain
`NOT VERIFIED`, as no complete baseline digest exists.

## 14. Unverified Items

```text
Security event log:
NOT VERIFIED / ACCESS DENIED

Runtime reboot prompt UI:
NOT VERIFIED

Exact caller that keeps or re-adds PFR-001:
UNKNOWN

Exact caller for new DeviceCenter entries:
NOT VERIFIED

UAC interactive elevation:
NOT VERIFIED

Installer download/hash/signature:
NOT VERIFIED

Installed component manifest:
NOT VERIFIED — NOT INSTALLED

.next and Worker dist whole-tree integrity:
NOT VERIFIED
```

## 15. Explicit Non-actions

```text
Registry write:
NOT EXECUTED

PendingFileRenameOperations cleanup:
NOT EXECUTED

File delete/move/rename:
NOT EXECUTED

Installer download:
NOT EXECUTED

Visual Studio/SDK/MSVC/MIDL install/update/repair:
NOT EXECUTED

Windows Update / DISM / SFC:
NOT EXECUTED

Service or driver changes:
NOT EXECUTED

ACL/DACL/Owner/IAM changes:
NOT EXECUTED

Reboot/shutdown:
NOT EXECUTED

Native RPC Build/Runtime:
NOT EXECUTED

Database / SQL / Migration / Storage:
NOT ACCESSED

Git write:
NOT EXECUTED
```

Authorized metadata/hash reads advanced LastAccessTime on the remaining
Gaming Services file. No content or last-write timestamp was changed.

## 16. Document Integrity

This report cannot contain its own stable SHA-256 without changing the file.
The SHA-256 is computed after the report is frozen and returned externally.
