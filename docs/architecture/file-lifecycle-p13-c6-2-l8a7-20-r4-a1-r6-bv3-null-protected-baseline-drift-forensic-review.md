# P1-3 R6-BV3 `$null` Protected Baseline Drift Forensic Review

## 0. Executive Summary

```text
Stage:
R6-BV3

Date:
2026-11-22

Mode:
READ-ONLY FORENSIC REVIEW

Final Verdict:
FAIL — FORENSIC BASELINE OR EVIDENCE INTEGRITY VIOLATION

Original `$null` Object Identity:
SAME FILE OBJECT — IDENTITY MATCHED

R8 `$null` Timestamp Drift:
ATTRIBUTED

BV3-Created `$null'` Artifact:
CONFIRMED ADDITIONAL BASELINE CHANGE

Contents Read:
NO

`$null` Hash Recalculated:
NO

Target Disposition:
NONE
```

The R8 change to `$null` LastWriteTime is attributed to an R8 Codex command
that requested Bash but was wrapped as `cmd.exe /c` and contained `2>$null`.
The file object identity remains the same.

However, BV3 itself repeated the same shell mistake during an investigation
command. That command created a new zero-byte `$null'` in the project root.
This violates the read-only stage boundary and prevents a clean forensic PASS,
even though the original R8 drift is attributed.

## 1. Scope and Restrictions

Investigated:

- current metadata of `D:\thinkbook\Desktop\jieya\$null`;
- historical BV1/BV2/R7/R8 evidence;
- Codex execution records for R8 and BV3;
- available PowerShell, Windows Event and USN evidence;
- exact absence/presence of `$null'` and `$null()`.

Not performed on either `$null` artifact:

- content read;
- content print;
- data-stream read;
- SHA-256 calculation;
- create/copy/export;
- truncate/delete/move/rename;
- ACL, owner or timestamp modification.

No Build, Runtime, database, Storage, service, PFR or Git write was performed.
No audit or logging policy was changed.

## 2. Input Integrity

| Input | Expected | Actual | Result |
|---|---|---|---|
| R6-BV1 | `AAF113E8399D3F11A234AE0DF00E718AA5B0F0989801FDC0FC2B66C81C0F2A53` | same | PASS |
| R6-BV2 | `53706B12D6AA51922A6933C07D9B85EEFC70F1A5B7486DEAF803A466C043A588` | same | PASS |
| R7 design review | `A9951A0455AF3AC6D85DBA327271CB326192E5CA61BFC6FA62830786C84170BF` | same | PASS |
| R8 main | `6FAF4AF2638A9D6D41727049703DF3B0F240D0233A04AD7466679F84A44A27DA` | same | PASS |
| R8 decisions | `F2A539A6E8E2F35C82C7D040F8D98F0E5BB604FABD18BEF41ED5DE95F4FC4C40` | same | PASS |

## 3. File Object Identity Comparison

### 3.1 `$null`

Current metadata-only result:

```text
Path:
D:\thinkbook\Desktop\jieya\$null

Exists:
YES

Length:
65 bytes

CreationTimeUtc:
2026-11-21T21:30:32.1057744Z

LastWriteTimeUtc:
2026-11-21T21:59:26.7885272Z -> 2026-11-21T22:36:19.4167564Z

LastAccessTimeUtc:
2026-11-21T22:36:19.4167564Z at metadata collection

Attributes:
Archive

Volume:
D:

File System:
NTFS

Volume Serial:
B46C803A

File ID:
0x000000000000000000210000000209cc
```

Comparison with BV1/BV2/R7:

```text
SAME FILE OBJECT — IDENTITY MATCHED
```

The File ID, Volume Serial, CreationTime and 65-byte size match. Only
LastWriteTime and LastAccessTime changed. This is not a filename-only match.

The historical SHA-256 remains:

```text
42BD6E835C6EC8DCCE7454BCCA9C4F3AD94AF783BFE7D2D2CAA7609B0AEF77BB
```

It was not recalculated in BV3 and is not a current content-verification result.

### 3.2 `$null'`

```text
Path:
D:\thinkbook\Desktop\jieya\$null'

Exists:
YES

Length:
0 bytes

CreationTimeUtc:
2026-11-21T22:40:56.5319416Z

LastWriteTimeUtc:
2026-11-21T22:40:56.5319416Z

File ID:
0x000000000000000000050000000209e9

Git:
untracked
```

This is a new file object created after BV2 had deleted the earlier `$null'`
artifact. Its content was not read.

### 3.3 `$null()`

```text
Exists:
NO
```

## 4. Timestamp Timeline

| UTC time | Event | Evidence | Confidence |
|---|---|---|---|
| 2026-11-21T21:30:31Z | Codex Bash request with `2>$null`; actual `cmd.exe /c` | Codex session | CONFIRMED |
| 2026-11-21T21:30:32.1057744Z | `$null` created as 0 bytes | File metadata + Codex item | CONFIRMED |
| 2026-11-21T21:59:26.7885272Z | `$null` changed to 65 bytes | File metadata + Codex PID 24091 | CONFIRMED |
| 2026-11-21T22:02:50Z | R6/BV1 metadata and hash observation | BV1 | CONFIRMED |
| 2026-11-21T22:12:05Z | BV1 report created | Report metadata | CONFIRMED |
| 2026-11-21T22:20:33Z | BV2 report created; `$null'` deletion recorded | BV2 | CONFIRMED |
| 2026-11-21T22:28:49Z | R7 review created | Report metadata | CONFIRMED |
| 2026-11-21T22:34:10Z | R8 main created | Report metadata | CONFIRMED |
| 2026-11-21T22:36:19.4167564Z | `$null` LastWriteTime changed again | File metadata | CONFIRMED |
| 2026-11-21T22:36:19.446Z-447Z | R8 `cmd.exe /c ... 2>$null`, PID 99560, exit 1 | Codex item | CONFIRMED |
| 2026-11-21T22:37:59Z | R8 reports updated with drift record | Report metadata | CONFIRMED |
| 2026-11-21T22:40:56.5319416Z | BV3-created `$null'` file appears | New file metadata | CONFIRMED |
| 2026-11-21T22:40:56.569Z | BV3 `cmd.exe /c ... 2>$null`, PID 62690, exit 1 | Codex item | CONFIRMED |

The LastWriteTime marks the recorded metadata transition. The corresponding
Codex command evidence is in the same second. This supports the command-write
association; it does not establish a byte-level content comparison.

## 5. Shell and Command Attribution

### 5.1 R8 modification of `$null`

Codex call:

```text
timestamp:
2026-11-21T22:36:19Z

tool:
exec_command

requested shell:
bash

cwd:
D:\thinkbook\Desktop\jieya

wrapper:
cmd.exe /c ... 2>$null

PID:
99560

exit:
1

captured output length:
0
```

The wrapper contains PowerShell-style redirection `2>$null`. CMD interprets
`$null` as a literal filename relative to the cwd.

Attribution:

```text
CONFIRMED
```

The command record and file LastWriteTime agree at second-level precision.

### 5.2 BV3 creation of `$null'`

Codex call:

```text
timestamp:
2026-11-21T22:40:56Z

requested shell:
bash

cwd:
D:\thinkbook\Desktop\jieya

wrapper:
cmd.exe /c ... PSReadLine-history-query ... 2>$null

PID:
62690

exit:
1
```

File:

```text
CreationTimeUtc:
2026-11-21T22:40:56.5319416Z
```

Attribution:

```text
CONFIRMED
```

This is an additional baseline change caused by the same shell-mixing defect.
The new file is not the earlier deleted `$null'` object; it has a new File ID.

## 6. Available OS Evidence

| Source | Result | Limitation |
|---|---|---|
| USN Journal | present; current range `0x24800000` to `0x26a84560` | exact FileRef enumeration returned Access Denied |
| `fsutil usn readData` | current `$null` FileRef/USN visible | record reason/time unavailable |
| Security Event 4663 | no matching event in R8/BV3 windows | audit policy unavailable or SACL not configured |
| `auditpol File System` | Access Denied | NOT VERIFIED / privilege required |
| Sysmon | absent | NOT AVAILABLE |
| PowerShell Transcription | absent | NOT AVAILABLE |
| PowerShell Operational | no events in tested windows | no corroborating event |
| Windows PowerShell classic | no events in tested windows | no corroborating event |
| Defender Operational | no matching events | not proof of no write |
| PSReadLine history | last modified 2026-11-17; no matching target patterns | does not cover R8/BV3 |

No audit setting, event channel, ETW provider or logging configuration was
modified.

## 7. Evidence Integrity Matrix

| Evidence | Source | Read-only? | State-changing side effect | Supports | Does not support |
|---|---|---:|---|---|---|
| R8 command call | Codex JSONL | yes | none | shell, wrapper, time, PID | file bytes |
| `$null` metadata | NTFS metadata | yes | no content access | identity, size, times | content |
| `$null'` metadata | NTFS metadata | yes | no content access | new object identity | content |
| USN current record | `fsutil readData` | yes | no content access | FileRef and current USN | historical reason |
| USN exact enumeration | `fsutil enumData` | yes | none | attempted correlation | failed Access Denied |
| Security 4663 | Event Log | yes | none | audit absence | proof of no write |
| Sysmon | no channel | yes | none | source unavailable | no conclusion |
| PowerShell logs | Event Log | yes | none | no matching event | proof of no execution |
| Git status | repository metadata | yes | none | untracked state | historical operation |

## 8. R6/R7 Historical Exception Impact

The BV1 attribution remains consistent:

```text
original 0-byte creation:
CONFIRMED CMD REDIRECTION

21:59 65-byte write:
CONFIRMED CMD REDIRECTION
```

The R7 exception remains historically valid for the state it reviewed, but it
does not cover the later R8 LastWriteTime or the newly created `$null'`.

Current status:

```text
APPROVED-BASELINE-EXCEPTION-R6-NULL-001:
SUPERSEDED FOR CURRENT METADATA STATE
```

A new exception revision is required. The historical SHA-256 remains a
historical value only:

```text
CONTENTS NOT RE-VERIFIED DURING BV3
```

## 9. R8 Design Artifact Impact

The R8 main and decisions hashes match:

```text
R8 main:
6FAF4AF2638A9D6D41727049703DF3B0F240D0233A04AD7466679F84A44A27DA

R8 decisions:
F2A539A6E8E2F35C82C7D040F8D98F0E5BB604FABD18BEF41ED5DE95F4FC4C40
```

The R8 report content already records the `$null` LastWriteTime drift and the
overall baseline BLOCKED state. The new `$null'` file was created after those
reports and does not change their file hashes.

The design analysis and source/build non-actions remain intact. The new file
does not validate or invalidate the R8 TCB, Ledger, Bundle, Challenge or
R5-R3A design content. It prevents treating the R8 baseline package as clean.

## 10. Remaining Unknowns

- The 65 bytes of `$null` were not read and their current content is unknown.
- The empty `$null'` content is not sensitive, but it was not read.
- Exact USN Reason flags for the 22:36 write are inaccessible.
- No Security/Sysmon event provides a second process-level record of the write.
- The File system write and Codex command are strongly aligned in time; the
  missing USN reason prevents a full kernel-level reconstruction.
- The original 0-byte content hash remains historically known but was not
  revalidated after later writes.

## 11. Final Verdict

```text
FAIL — FORENSIC BASELINE OR EVIDENCE INTEGRITY VIOLATION
```

Reason:

```text
R8 drift itself is attributed,
but BV3 created a new protected-root artifact during the forensic review.
```

Identity:

```text
$null = SAME FILE OBJECT — IDENTITY MATCHED
$null' = NEW FILE OBJECT CREATED DURING BV3
```

## 12. Next-Step Recommendation

Do not proceed to R8 independent review or R5-R3A until a new baseline
disposition is authorized.

Recommended:

1. Preserve `$null` and the newly created `$null'` unchanged.
2. Prepare a new exact exception for `$null` using the new LastWriteTime and
   historical hash only.
3. Separately authorize exact deletion of the new zero-byte `$null'`, following
   BV2's exact-path deletion procedure.
4. Recheck that `$null()` remains absent.
5. Run no more shell commands containing `$null` redirection patterns in
   Bash/CMD contexts.

This recommendation is not authorization to delete or modify either file.

## 13. Report Integrity

This report cannot contain its own digest. The external SHA-256 is calculated
after the final write.
