# P1-3 C-6.2-L8-A7.20-R4-A1-R3-R3 Gaming Services and CrossDevice Targeted Investigation

## 0. Final Result

```text
Overall:
PASS WITH WARNINGS

Gaming Services File Identity:
CONTENT/METADATA CONSISTENT; HISTORICAL FILE ID NOT VERIFIED

Gaming Services Delete Failure Cause:
UNKNOWN

Gaming Services Process/Handle Evidence:
NO TARGET MODULE MATCH; HANDLE OWNERSHIP NOT VERIFIED

CrossDevice Component Identity:
CONFIRMED

CrossDevice Cache Lifecycle:
HIGH CONFIDENCE — NORMAL CACHE ROTATION

CrossDevice PFR Provenance:
HIGH CONFIDENCE COMPONENT FAMILY; EXACT CALLER NOT VERIFIED

PFR Queue Stability:
STABLE DURING AUDIT

System Warning Causal Link:
NO DIRECT CAUSAL LINK VERIFIED

Need Another Reboot:
NOT RECOMMENDED AS SOLE REMEDIATION

R4-A1-R3 Installation Readiness:
REMAIN BLOCKED

Installer Authenticity:
NOT VERIFIED

Native RPC Build:
NOT AUTHORIZED

Native RPC Runtime:
NOT AUTHORIZED

Repository Integrity:
PASS
```

The post-boot queue contains 19 delete operations: one old Gaming Services
backup deletion that survived the restart, and 18 new CrossDevice cache
deletions. No repair, cleanup, reboot, service operation or install was
attempted.

## 1. Scope and Inputs

```text
Stage:
C-6.2-L8-A7.20-R4-A1-R3-R3

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

Historical evidence read:

| Document | SHA-256 |
|---|---|
| R4-A1-R3 installation report | `E3EEAA497F9E9C5EB2B44236EB2A01B9859A302048EF9E75EC081ACE3DCAC415` |
| R4-A1-R3-R1 pending-operations audit | `CB70731258A49259DD3308517F54A32BCF8B84BEAC479A298B04FF04AA7203E4` |
| R4-A1-R3-R2 post-reboot report | `52D7A3DAC199E39E594A81B4EA74E2506993DB0E34AA34E4CAE9098ED20FC870` |
| R4-A1-R1 native RPC toolchain assessment | Current project file; see repository hash verification below |
| R4-S11 R4-A final readiness report | `400D761CB129501BE9F31F3601BA89C116568A28C81E6470B9753AB829D70525` |

The R4-A1-R1 feasibility/assessment reports confirm that the historical
toolchain state was no SDK, MSVC, MIDL or `vswhere`, while the Windows RPC
runtime was present. The R4-S11 report confirms that Windows native runtime
verification remains a separate gated phase.

## 2. PFR Queue: Start and End Snapshots

Registry location:

```text
HKLM\SYSTEM\CurrentControlSet\Control\Session Manager
PendingFileRenameOperations
```

Start snapshot:

```text
Value type:             REG_MULTI_SZ
Raw strings:            38
Non-empty strings:      19
Pairs:                  19
DELETE operations:      19
MALFORMED pairs:         0
Ordered-array SHA-256:  54CC89DA4697363393AE7A956AF3FD689B8B3D10926955849995CD44CC286E84
```

End snapshot:

```text
Value type:             REG_MULTI_SZ
Raw strings:            38
Non-empty strings:      19
Ordered-array SHA-256:  54CC89DA4697363393AE7A956AF3FD689B8B3D10926955849995CD44CC286E84
```

The queue was unchanged during the investigation:

```text
PFR Queue Stability:
STABLE DURING AUDIT
```

The preceding pre-reboot audit recorded:

```text
Raw strings:   62
Pairs:         31
SHA-256:       19C5E50505E65EC005FF84ADFAA7CD49FD8A08A9652454FEC240CEE2E00ECCCB
```

The current queue is not empty. The hash changed because most old entries were
processed, one old entry remained and 18 new entries were added.

## 3. Current PFR Operation Inventory

All 19 operations are DELETE with empty destinations. Paths retain stable IDs
and original order. `%USERPROFILE%` replaces the local account-home component.

| ID | Source | Destination | Type | Source exists |
|---|---|---|---|---|
| PFR-001 | `*1\??\C:\Windows\System32\gamingservicesproxy_17.dll.0` | empty | DELETE | YES |
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

The exact `*1`/`*2` modifier meaning remains `UNKNOWN`; only the documented
empty-destination delete behavior was applied.

## 4. Gaming Services Target File

Path:

```text
C:\Windows\System32\gamingservicesproxy_17.dll.0
```

Current NTFS and file identity:

```text
Volume serial:       949EB069
File ID:             0x000000000000000000ec000000007ebf
Hard-link paths:     1
Hard-link path:      \Windows\System32\gamingservicesproxy_17.dll.0
Type:                regular file
Size:                530888 bytes
Creation UTC:        2026-11-11T09:07:52.7034948Z
Last write UTC:      2026-11-11T09:07:07.0197840Z
Attributes:          Archive
Reparse point:       false
LinkType / Target:   null / null
Owner:               NT AUTHORITY\SYSTEM
Group:               NT AUTHORITY\SYSTEM
File version:        10.0.26100.9656
SHA-256:             13A63A6A4C628786F99C443901B5C6E3B656EB9E982DA0D95CDB1855EB18099C
Authenticode:        Valid
Signer:              Microsoft Corporation
Timestamp signer:    Microsoft Time-Stamp Service
```

### Historical identity limitation

The R4-A1-R3-R2 report recorded path, size, timestamps, SHA-256, owner and
signature, but it did **not** record the NTFS File ID or Volume Serial.
Therefore:

```text
Gaming Services File Identity:
CONTENT/METADATA CONSISTENT
HISTORICAL FILE ID NOT VERIFIED
```

It is not defensible to claim a completed File ID-level cross-restart identity
comparison from the available reports. Future reports must carry File ID and
Volume Serial.

The active non-suffixed file was also checked:

```text
C:\Windows\System32\gamingservicesproxy_17.dll
Size:        530888
SHA-256:     13A63A6A4C628786F99C443901B5C6E3B656EB9E982DA0D95CDB1855EB18099C
File ID:     0x00000000000000000036000000017a87
Hard links:  1
```

The active file and `.0` file have identical contents but different File IDs;
they are not hard-link aliases.

## 5. Gaming Services Component Mapping

Installed package:

```text
Name:               Microsoft.GamingServices
PackageFullName:    Microsoft.GamingServices_39.118.30001.0_x64__8wekyb3d8bbwe
PackageFamilyName:  Microsoft.GamingServices_8wekyb3d8bbwe
Version:            39.118.30001.0
Architecture:       x64
Publisher:          Microsoft Corporation
SignatureKind:      3
Status:             0
InstallLocation:    C:\Program Files\WindowsApps\Microsoft.GamingServices_39.118.30001.0_x64__8wekyb3d8bbwe
```

Service:

```text
Name:        GamingServices
DisplayName: Gaming Services
State:       Running
StartMode:   Automatic
PID:         7984
Binary:      Microsoft GamingServices.exe in the installed package
```

Processes:

```text
gamingservices.exe      PID 7984
gamingservicesnet.exe   PID 7372
```

No scheduled task whose name/action referenced Gaming or Xbox was found.

No readable process module in the inspected Gaming/Xbox processes resolved to
`gamingservicesproxy_17.dll.0`. The non-suffixed `gamingservicesproxy_17.dll`
was also not observed in that module set.

## 6. Gaming Services Handle and Protection Review

### Handle evidence

```text
handle.exe:
NOT AVAILABLE — NOT DOWNLOADED

openfiles.exe:
AVAILABLE

openfiles query:
FAILED — system global maintain-objects-list flag is not enabled

Target module loaded by Gaming processes:
NO MATCH OBSERVED

File Handle Ownership:
NOT VERIFIED
```

No conclusion that Gaming Services holds the file is supported.

### ACL and protection evidence

`icacls` reports:

```text
SYSTEM:                         Full control
BUILTIN\Administrators:         Full control
BUILTIN\Users:                  Read/execute
ALL APPLICATION PACKAGES:       Read/execute
```

No explicit deny ACE was displayed. The file is owned by SYSTEM and is not
ReadOnly or a Reparse Point.

```text
Windows Resource Protection evidence:
NOT VERIFIED

File-system filter driver enumeration:
NOT VERIFIED / ACCESS DENIED from fltmc

Direct filter-driver relation to this file:
NO DIRECT CAUSAL LINK VERIFIED
```

### Event/log evidence

The current System and Application logs contain no readable event naming
`gamingservicesproxy_17.dll.0` or `PendingFileRenameOperations`.

```text
Current CBS.log filename/PFR matches:
0

Current Kernel-Boot operational PendingFileRename/delete matches:
0

Current AppXDeploymentServer filename/PFR matches:
0

Security event log:
NOT VERIFIED / ACCESS DENIED
```

This establishes only that no direct failure record was found. It does not
prove deletion succeeded or that the file was unused.

## 7. Gaming Services Cause Candidates

### UPDATE / PACKAGE SERVICING

```text
Confidence for creation origin:
HIGH CONFIDENCE

Confidence as deletion-failure cause:
POSSIBLE
```

Supporting evidence:

- the file name and package are Gaming Services components;
- the `.0` and active DLL have identical size, timestamp and content hash;
- Gaming Services 39.118.30001.0 is installed and running.

Contrary evidence:

- no current AppX or CBS event directly names the target or records a deletion
  attempt.

### FILE LOCK / OPEN HANDLE

```text
Confidence:
POSSIBLE
```

Supporting evidence:

- Gaming Services is running;
- no reliable handle table is available.

Contrary evidence:

- no inspected Gaming process module resolved to the target;
- handle ownership is not verified.

### BOOT-TIME ACCESS CONFLICT

```text
Confidence:
POSSIBLE
```

Supporting evidence:

- the file survived an actual reboot while other queued operations completed.

Contrary evidence:

- no Session Manager/Kernel Boot failure event names the target.

### PERMISSION / ACCESS DENIED

```text
Confidence:
POSSIBLE, LOWER THAN BOOT/LOCK CANDIDATES
```

Supporting evidence:

- the target is in `System32`.

Contrary evidence:

- owner and group are SYSTEM;
- SYSTEM and Administrators have Full Control;
- no explicit deny was observed;
- the operation is expected to run at boot under highly privileged context.

### PROTECTED SYSTEM COMPONENT

```text
Confidence:
POSSIBLE
```

Supporting evidence:

- signed file under `System32`.

Contrary evidence:

- no WRP/catalog/service-protection event was found.

### DRIVER / FILTER INTERFERENCE

```text
Confidence:
UNKNOWN
```

Filter enumeration was access denied; no direct driver relation exists.

### INVALID / STALE PATH

```text
Confidence:
LOW
```

The source path currently exists and resolves to a normal filesystem object.

Final deletion-failure classification:

```text
Gaming Services Delete Failure Cause:
UNKNOWN
```

No candidate receives `CONFIRMED`. Confirming a cause would require a reliable
handle/session-manager diagnostic that is not available under this read-only
non-admin phase.

## 8. CrossDevice Component Identity

Installed package:

```text
Name:               MicrosoftWindows.CrossDevice
PackageFullName:    MicrosoftWindows.CrossDevice_1.26101.77.0_x64__cw5n1h2txyewy
PackageFamilyName:  MicrosoftWindows.CrossDevice_cw5n1h2txyewy
Version:            1.26101.77.0
Architecture:       x64
Publisher:          Microsoft Windows / Microsoft Corporation
SignatureKind:      3
Status:             0
InstallLocation:    C:\Program Files\WindowsApps\MicrosoftWindows.CrossDevice_1.26101.77.0_x64__cw5n1h2txyewy
```

Related processes:

```text
CrossDeviceResume.exe
Signed by Microsoft Windows
Started 2026-11-21 21:27:17 local

CrossDeviceService.exe
Signed by Microsoft Corporation
Started 2026-11-21 21:27:19 local

PhoneExperienceHost.exe
Microsoft.YourPhone 1.26092.119.0
Signed by Microsoft Corporation
Started 2026-11-21 21:27:43 local
```

Related service:

```text
PhoneSvc
Running / Manual
```

No matching CrossDevice-specific scheduled task was found.

```text
CrossDevice Component Identity:
CONFIRMED
```

## 9. CrossDevice 18-operation Inventory

All 18 operations use `*2\??\` modifiers, have empty destinations and currently
have absent sources. The IDs below map one-to-one from current PFR-002 through
PFR-019.

| ID | PFR ID | Relative path under `%USERPROFILE%\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513` | Exists |
|---|---|---|---|
| XD-001 | PFR-002 | `blob_storage\6cd4d849-6aff-49ec-aa55-b95de5392320` | no |
| XD-002 | PFR-003 | `blob_storage` | no |
| XD-003 | PFR-004 | `Cache\Cache_Data` | no |
| XD-004 | PFR-005 | `Cache` | no |
| XD-005 | PFR-006 | `Code Cache\js\index-dir` | no |
| XD-006 | PFR-007 | `Code Cache\js` | no |
| XD-007 | PFR-008 | `Code Cache\wasm\index-dir` | no |
| XD-008 | PFR-009 | `Code Cache\wasm` | no |
| XD-009 | PFR-010 | `Code Cache` | no |
| XD-010 | PFR-011 | `Dictionaries` | no |
| XD-011 | PFR-012 | `Local Storage\leveldb` | no |
| XD-012 | PFR-013 | `Local Storage` | no |
| XD-013 | PFR-014 | `Network` | no |
| XD-014 | PFR-015 | `Session Storage` | no |
| XD-015 | PFR-016 | `Shared Dictionary\cache\index-dir` | no |
| XD-016 | PFR-017 | `Shared Dictionary\cache` | no |
| XD-017 | PFR-018 | `Shared Dictionary` | no |
| XD-018 | PFR-019 | `WidevineCdm` | no |

Because all 18 sources are absent, no per-file size, timestamp or SHA-256 is
available for the scheduled sources.

### Parent/child ordering

```text
XD-001 child before XD-002 parent
XD-003 child before XD-004 parent
XD-005 child before XD-006 parent
XD-005/XD-006 before XD-009 Code Cache parent
XD-007/XD-008 before XD-009 Code Cache parent
XD-011 child before XD-012 parent
XD-015 child before XD-016 parent
XD-015/XD-016 before XD-017 Shared Dictionary parent
```

The remaining XD items are independent leaves. There are no duplicate source
paths and no target-overwrite operations.

## 10. CrossDevice Cache Timeline

```text
21:26:45 local
Windows boot completed.

21:27:17 local
CrossDeviceResume.exe started.

21:27:19 local
CrossDeviceService.exe started.

21:27:27 local / 13:27:27 UTC
New cache GUID directory 951524D9-92E3-43B3-B19E-3DF3B63EB513 created.

21:27:27-21:27:31 local
Three immediate cache files created:
  first_party_sets.db
  first_party_sets.db-journal
  Visited Links

21:27:43 local
PhoneExperienceHost.exe started.

21:33:23 UTC
First investigation snapshot observed 19 current PFR operations.

21:42:11 UTC
Final snapshot had the same 38 strings and same `54CC...E84` queue hash.
```

The previous 18 DeviceCenter paths, under GUID
`2954CD19-0AD6-4ED6-8A68-F232839E7C1A`, are all absent. The new 18 paths use a
new GUID and are also currently absent.

Observed lifecycle characteristics:

- startup creates a new cache session GUID;
- cache root files remain while the queued subdirectories are absent;
- the previous GUID's queued subdirectories are absent;
- the same individual paths are not repeatedly re-created;
- the queue is stable during the audit.

Assessment:

```text
CrossDevice Cache Lifecycle:
HIGH CONFIDENCE — NORMAL CACHE ROTATION / STARTUP CLEANUP

Exact MoveFileEx caller:
NOT VERIFIED
```

There is no direct event proving which process called `MoveFileEx`. The
component identity, new GUID timing and process start sequence strongly support
the Microsoft CrossDevice family, but not the exact caller.

## 11. CrossDevice PFR Provenance

```text
Cache creator component:
HIGH CONFIDENCE — Microsoft CrossDevice

Delete-request registrant:
UNKNOWN / NOT VERIFIED

Normal cache lifecycle:
HIGH CONFIDENCE

Evidence of an abnormal infinite same-path loop:
NOT OBSERVED
```

Each boot/lifecycle uses a different GUID rather than recreating the exact old
path. This supports normal rotation rather than repeated deletion failure for
the same cache path.

## 12. System Warning Causal Link

| Existing warning | Current-boot state | Direct link to Gaming or CrossDevice |
|---|---|---|
| WUDFRd / Kernel-PnP 219 / `0xC0000365` | recurred | none verified |
| Lenovo Windows Security Center signature error | recurred | none verified |
| RTCore64 service registration | recurred | none verified |

RTCore64 points to `D:\OSD\MSI Afterburner\RTCore64.sys`; the Lenovo security
service points to a Huorong binary; neither path overlaps a PFR target.

```text
System Warning Causal Link:
NO DIRECT CAUSAL LINK VERIFIED
```

No driver, service, security product or Lenovo component was changed.

## 13. Need for Another Reboot

The previous reboot demonstrably processed 30 of 31 old operations, but:

- one Gaming Services deletion remained;
- CrossDevice registered a new 18-entry cache queue after startup.

A second blind reboot is not supported as a remedy:

- Gaming Services is already configured to start automatically;
- CrossDevice is already configured to start automatically;
- a new cache GUID was created after the last successful boot;
- no evidence states that another reboot will clear the unchanged Gaming
  Services operation or avoid a new CrossDevice queue.

```text
Need Another Reboot:
NOT RECOMMENDED AS SOLE REMEDIATION
```

Any future restart must be separately authorized and followed by another fresh
snapshot. A clean installation window must be demonstrated, not assumed.

## 14. Installation Readiness

```text
R4-A1-R3 Installation Readiness:
REMAIN BLOCKED

INSTALLER AUTHENTICITY:
NOT VERIFIED

TOOLCHAIN:
NOT INSTALLED

NATIVE RPC BUILD:
NOT AUTHORIZED

NATIVE RPC RUNTIME:
NOT AUTHORIZED
```

The CrossDevice entries are high-confidence benign cache deletions with absent
current sources. That does not authorize removing them or waiving the PFR gate.
The Gaming Services deletion remains unexplained and provides a stronger reason
to keep installation blocked.

No manual PFR cleanup is authorized. No claim is made that the existing gate
can be bypassed because 18 entries are benign.

## 15. Repository Baseline and Integrity

Before this report:

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 26
Untracked: 186
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

The exact root paths `$null` and `$null)` were checked with Node.js and do not
exist. The complete `.next` and Worker `dist` historical trees remain
`NOT VERIFIED` because no complete baseline digest exists.

Adding this report is the only expected project change.

## 16. NOT VERIFIED / ACCESS DENIED

```text
Gaming Services historical NTFS File ID:
NOT VERIFIED — NOT RECORDED BY R3-R2

Gaming Services historical Volume Serial:
NOT VERIFIED — NOT RECORDED BY R3-R2

File handle ownership:
NOT VERIFIED — openfiles global tracking disabled; handle.exe unavailable

File-system filter relation:
NOT VERIFIED / ACCESS DENIED — fltmc enumeration rejected

Windows Resource Protection status:
NOT VERIFIED

Direct Session Manager deletion failure:
NOT VERIFIED — no readable event named the target

Security event log:
NOT VERIFIED / ACCESS DENIED

Exact CrossDevice MoveFileEx caller:
NOT VERIFIED

Exact Gaming Services deletion-failure mechanism:
UNKNOWN
```

## 17. Side Effects and Non-actions

Read-only operations queried registry state, process metadata, AppX metadata,
event logs, ACLs, signatures and file hashes. The hash/metadata reads advanced
LastAccessTime on the Gaming Services target.

No content or LastWriteTime was deliberately changed.

```text
Registry write:
NOT EXECUTED

PFR cleanup:
NOT EXECUTED

File delete/move/rename:
NOT EXECUTED

Service/process control:
NOT EXECUTED

Task/ACL/Owner changes:
NOT EXECUTED

Reboot/shutdown:
NOT EXECUTED

Installer download/execution:
NOT EXECUTED

Toolchain installation:
NOT EXECUTED

Native RPC Build/Runtime:
NOT EXECUTED

Database/SQL/Migration/Storage:
NOT ACCESSED

Git write:
NOT EXECUTED
```

## 18. Document Integrity

This report cannot contain its own stable SHA-256 without changing the file.
Its SHA-256 is computed after the report is frozen and reported externally.
