# P1-3 R6-BV4-R1 Shell Identity Correction and `$null` Baseline Reassessment

## 0. Executive Summary

```text
Stage:
R6-BV4-R1

Date:
2026-11-23

Mode:
DIRECT-PROCESS / READ-ONLY METADATA VERIFICATION

Final Verdict:
FAIL — NEW PROTECTED BASELINE DRIFT

Shell Identity Gate:
PASS

Current `$null` Object Identity:
SAME FILE OBJECT — IDENTITY MATCHED

Current `$null` Metadata:
MATCHED

Current Content Integrity:
NOT VERIFIED

Current SHA-256:
NOT COMPUTED BY DESIGN

New Exception Proposal:
WITHHELD
```

The previous fixed Runtime path is absent. Dynamic discovery found one current
PowerShell candidate. It was launched directly with `CreateProcessW` using an
explicit absolute `lpApplicationName`, and both parent-side process inspection
and child-side PowerShell checks passed.

The `$null` object identity, size, creation time, last write time and File ID
match the historical records. No new `$null` drift was observed.

However, PFR changed from:

```text
46 strings / 23 DELETE
```

to:

```text
38 strings / 19 DELETE
```

This is a new protected baseline drift outside the authorized `$null`
reassessment. The new R6-NULL-002 exception is therefore withheld.

## 1. Authorization and Scope

Authorized:

- dynamically discover a current PowerShell 7.6.9 candidate;
- launch it directly through Windows process APIs;
- verify actual shell identity inside and outside the child process;
- read `$null` metadata only;
- propose, but not approve, a new baseline exception;
- create this report.

Not authorized or performed:

- reading or hashing `$null`;
- changing `$null`;
- changing PFR;
- shell redirection;
- Bash or CMD;
- Git writes;
- source, IDL, Build, service, ACL, database or Storage changes;
- Native Runtime.

## 2. Skills and Inputs

Root `AGENTS.md` routing was applied.

Skills actually read:

- `$project-architecture`;
- `$security-audit`;
- `$testing-and-verification`;
- `$file-lifecycle`.

Historical input hashes:

| Input | Expected | Actual | Result |
|---|---|---|---|
| BV1 | `AAF113E8399D3F11A234AE0DF00E718AA5B0F0989801FDC0FC2B66C81C0F2A53` | same | PASS |
| BV2 | `53706B12D6AA51922A6933C07D9B85EEFC70F1A5B7486DEAF803A466C043A588` | same | PASS |
| R7 | `A9951A0455AF3AC6D85DBA327271CB326192E5CA61BFC6FA62830786C84170BF` | same | PASS |
| R8 | `6FAF4AF2638A9D6D41727049703DF3B0F240D0233A04AD7466679F84A44A27DA` | same | PASS |
| R8 decisions | `F2A539A6E8E2F35C82C7D040F8D98F0E5BB604FABD18BEF41ED5DE95F4FC4C40` | same | PASS |
| BV3 | `33BDAFEFA4254D86787B547DFBCA531300D7E6A64F6D5F74E415D285F3A868F0` | same | PASS |
| BV3-A1 | `5E4FD7AB24D1B54CD133F36D5563B316E736650D6334ABE0DC732C3BC82FE674` | same | PASS |
| BV4 | `562848495D6DE3864CE35C0CA9449611B42CFB253F3A5692074A2A688FAACB1F` | same | PASS |

## 3. Candidate Discovery Method

Candidate sources:

- every absolute directory in the current `PATH`;
- common PowerShell installation paths;
- `Get-Command pwsh.exe -All -CommandType Application`;
- `HKLM\SOFTWARE\Microsoft\PowerShellCore\InstalledVersions`;
- installed `Microsoft.PowerShell` AppX package metadata.

All candidates were normalized to absolute paths and deduplicated.

Former fixed path:

```text
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1116-1220-0_26.1116.1220.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe
```

Result:

```text
ABSENT
```

No candidate search was performed through CMD, Bash or shell redirection.

## 4. Candidate Executable Paths

```text
Candidate count:
1

Path:
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe

ProductVersion:
7.6.9 SHA: 3a0b9fb386a321f664ab6dd6a39abaf2313c76bf+3a0b9fb386a321f664ab6dd6a39abaf2313c76bf

FileVersion:
7.6.9.500

Inaccessible candidates:
0
```

The file-resource semantic version prefix is exactly `7.6.9`; the additional
SHA suffix is retained as resource metadata rather than discarded.

## 5. Direct Process Launch Method

The selected candidate was launched by the external launcher process using:

```text
CreateProcessW(
  lpApplicationName = selected absolute pwsh.exe path,
  lpCommandLine = quoted selected path + -NoProfile -NonInteractive
                  -EncodedCommand <UTF-16LE base64 child script>,
  bInheritHandles = FALSE,
  lpCurrentDirectory = D:\thinkbook\Desktop\jieya)
```

Not used:

- ShellExecute;
- CMD;
- Bash;
- `cmd.exe /c`;
- `bash -lc`;
- PowerShell `&` invocation;
- a shell output redirect.

## 6. Process Tree and Parent Identity

```text
Codex host:
PID 32440
C:\Program Files\WindowsApps\OpenAI.Codex_26.1117.4957.0_x64__2p2nqsd0c76g0\app\resources\codex.exe

Verified native PowerShell launcher:
PID 35564
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe

Direct metadata child:
PID 4100
Parent PID 35564
```

No CMD, Bash, WSL or other shell intermediate appears between the Codex host,
the verified launcher and PID 4100.

The child’s parent PID was independently read after `CreateProcessW` returned
and matched the launcher PID.

## 7. Process ID and Creation Time

```text
PID:
4100

CreationTimeUtc:
2026-11-22T21:47:05.5978276Z

Parent PID:
35564
```

These values came from the process handle returned by `CreateProcessW` and
`GetProcessTimes`, not from the child's self-report.

## 8. Actual Executable Path

Parent-side `QueryFullProcessImageNameW` result:

```text
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe
```

It exactly matched the candidate passed as `lpApplicationName`.

## 9. PowerShell 7.6.9 Verification

Child internal values:

```text
PID:
4100

PSVersion:
7.6.9

PSEdition:
Core

Image:
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe

CWD:
D:\thinkbook\Desktop\jieya
```

Parent-side verification:

```text
Process image path:
MATCHED

Process creation time:
CAPTURED FROM PROCESS HANDLE

File ProductVersion semantic version:
7.6.9

FileVersion:
7.6.9.500

Exit code:
0
```

## 10. Shell Identity Gate Verdict

```text
Actual executable path:
VERIFIED

Direct launch:
VERIFIED

Parent-child relation:
VERIFIED

External and child image match:
VERIFIED

PSVersion:
7.6.9

PSEdition:
Core

External file version consistency:
VERIFIED

Exit code:
0

Gate result:
PASS
```

## 11. `$null` Metadata Access Method

The verified child opened the exact target with:

```text
Desired Access:
FILE_READ_ATTRIBUTES

Share Mode:
READ | WRITE | DELETE

Creation Disposition:
OPEN_EXISTING

Flag:
FILE_FLAG_OPEN_REPARSE_POINT
```

It used `GetFileInformationByHandle` for attributes, size and timestamps.
It did not request data access and did not read the data stream.

File ID was obtained through the same `fsutil file queryFileID` representation
used by BV3, inside the verified child process.

## 12. File ID and Volume Serial Comparison

```text
File ID:
0x000000000000000000210000000209cc

Expected:
0x000000000000000000210000000209cc

Result:
MATCH

Volume Serial:
B46C803A

Expected:
B46C803A

Result:
MATCH
```

No truncation, endian conversion or alternate File ID representation was used.

## 13. Metadata Comparison

| Field | Historical | Current | Result |
|---|---|---|---|
| path | `D:\thinkbook\Desktop\jieya\$null` | same | MATCH |
| File ID | `0x000000000000000000210000000209cc` | same | MATCH |
| Volume Serial | `B46C803A` | same | MATCH |
| Length | 65 | 65 | MATCH |
| CreationTimeUtc | `2026-11-21T21:30:32.1057744Z` | same | MATCH |
| LastWriteTimeUtc | `2026-11-21T22:36:19.4167564Z` | same | MATCH |
| file type | disk file | disk file | MATCH |
| directory | no | no | MATCH |
| Reparse Point | no | no | MATCH |

Identity result:

```text
SAME FILE OBJECT — IDENTITY MATCHED
```

No metadata drift of `$null` was observed during BV4-R1.

## 14. Timeline

| UTC time | Event | Source |
|---|---|---|
| 2026-11-21T21:30:32.1057744Z | original `$null` created at 0 bytes | BV1 |
| 2026-11-21T21:59:26.7885272Z | `$null` changed to 65 bytes | BV1 |
| 2026-11-21T22:36:19.4167564Z | R8 CMD redirection changed LastWriteTime | BV3 |
| 2026-11-21T22:40:56.5319416Z | BV3-created `$null'` appeared | BV3 |
| 2026-11-23 | BV4 lacked the named PowerShell path and was blocked | BV4 |
| 2026-11-23 | BV4-R1 dynamically found and verified candidate | this report |
| 2026-11-23 | current `$null` metadata matched historical scope | this report |

## 15. R8 Shell Attribution

Historical evidence remains:

```text
Requested shell:
bash

Actual wrapper:
cmd.exe /c ... 2>$null

PID:
99560

Exit:
1
```

Attribution:

```text
CONFIRMED
```

The current review did not find direct contrary evidence. However, the command
attribution explains provenance and the observed timestamp; it does not prove
current content integrity or historical content equivalence.

## 16. Content Integrity Limitations

```text
HISTORICAL HASH ONLY
NOT RECOMPUTED
CURRENT CONTENT INTEGRITY: NOT VERIFIED
CONTENT EQUIVALENCE TO BV1: NOT ESTABLISHED
```

Historical SHA-256:

```text
42BD6E835C6EC8DCCE7454BCCA9C4F3AD94AF783BFE7D2D2CAA7609B0AEF77BB
```

This remains historical evidence only.

## 17. New Exception Proposal

The `$null`-specific evidence supports a candidate exception, but it cannot be
proposed for approval because a separate protected baseline change exists.

Candidate name:

```text
APPROVED-BASELINE-EXCEPTION-R6-NULL-002
```

Candidate scope:

```text
Path:
D:\thinkbook\Desktop\jieya\$null

File ID:
0x000000000000000000210000000209cc

Volume Serial:
B46C803A

Length:
65 bytes

CreationTimeUtc:
2026-11-21T21:30:32.1057744Z

LastWriteTimeUtc:
2026-11-21T22:36:19.4167564Z

Historical SHA-256:
42BD6E835C6EC8DCCE7454BCCA9C4F3AD94AF783BFE7D2D2CAA7609B0AEF77BB
```

Required limitations:

```text
CURRENT CONTENT INTEGRITY:
NOT VERIFIED

CURRENT SHA-256:
NOT COMPUTED BY DESIGN

HISTORICAL SHA-256:
REFERENCE ONLY — NOT CURRENTLY VERIFIED

CONTENT EQUIVALENCE TO BV1:
NOT ESTABLISHED
```

Status:

```text
WITHHELD — PFR BASELINE DRIFT MUST BE REVIEWED FIRST
```

## 18. Other Protected Baseline Status

Before adding this report:

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

Tracked modified:
26

Untracked:
256

Staged:
0

Deleted:
0

Root untracked:
$null
```

Expected after adding this report:

```text
Untracked:
257
```

PFR:

```text
Current:
38 strings / 19 DELETE

Current SHA-256:
8EE40F3606C888B3A0C93E2256D572595339785E99EF0F51EC85B36594097F3F

Historical:
46 strings / 23 DELETE

Historical SHA-256:
0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC
```

The PFR change is a new protected baseline drift. No PFR change or repair was
attempted.

B1/B4 and the six protected objects match their historical hashes. No
`p13_native*` process was running.

`$null'` and `$null()` were absent during the verified child metadata check.

## 19. Remaining Unknowns

- What caused the eight-string / four-operation reduction in PFR.
- Whether the PFR change occurred through normal reboot/update completion.
- Current `$null` content and whether it differs from BV1.
- Whether any other protected object outside the six checked hashes changed.
- Whether a later independent review will accept the candidate `$null`
  exception after resolving the PFR drift.

## 20. Final Verdict and Recommendation

```text
Overall:
FAIL — NEW PROTECTED BASELINE DRIFT

Shell Identity:
PASS

Current `$null` Object Identity:
SAME FILE OBJECT — IDENTITY MATCHED

Current `$null` Metadata:
MATCHED

Current Content Integrity:
NOT VERIFIED

R6-NULL-002:
WITHHELD / PENDING PFR DRIFT REVIEW

Native RPC Runtime:
NOT EXECUTED

Git Writes:
NOT EXECUTED
```

Recommended next step:

1. Preserve PFR exactly as currently observed.
2. Require a separate read-only review of the PFR delta before accepting any
   new baseline exception.
3. Do not alter `$null`.
4. Do not enter R8 review or R5-R3A Build-only from this report.

## 21. Report Integrity

The external SHA-256 is calculated after the final write.
