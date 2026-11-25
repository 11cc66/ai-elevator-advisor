# P1-3 C-6.2-L8-A7.20-R4-A1-R6-BV1 Baseline Violation Forensic Review

## 0. Executive Result

```text
Stage:
C-6.2-L8-A7.20-R4-A1-R6-BV1

Date:
2026-11-22

Mode:
READ-ONLY FORENSIC REVIEW

Overall:
FAIL — ADDITIONAL PROTECTED BASELINE CHANGE DETECTED

Original `$null` Write Source:
ATTRIBUTED — WRITE SOURCE CONFIRMED

P0:
0

P1:
0

P2:
2

P3:
1

Content Inspection:
NOT PERFORMED

Target Restoration/Deletion:
NOT PERFORMED

Git Writes:
NOT EXECUTED

Native Build/Runtime:
NOT EXECUTED
```

The 65-byte write to
`D:\thinkbook\Desktop\jieya\$null` is attributed to an R6 Codex
`exec_command` invocation that requested `shell: "bash"` while its command
contained a PowerShell-style `2>$null` redirection.

The unified executor launched the command as:

```text
cmd.exe /c ... 2>$null
```

Under CMD, `$null` is a literal filename, not PowerShell's null sink. The
command exited with code 1. The target file's `LastWriteTimeUtc` is in the same
second as that invocation.

The original zero-byte file was created by an earlier R6 Codex invocation with
the same shell/redirection mistake:

```text
cmd.exe /c rg ... 2>$null
```

That command also exited with code 1 and created the literal `$null` file at
`21:30:32.1057744Z`.

## 1. Scope and Read-only Boundary

Target:

```text
D:\thinkbook\Desktop\jieya\$null
```

Secondary path:

```text
D:\thinkbook\Desktop\jieya\$null)
```

Allowed actions performed:

- PowerShell metadata reads with `-LiteralPath`;
- SHA-256 calculation without displaying content;
- ACL and ADS-name/length inspection;
- NTFS File ID and hard-link metadata query;
- existing USN Journal queries;
- read-only Event Log queries;
- read-only Codex session-log parsing;
- Git status/hash checks.

Not performed:

- file content read, print, parse or format detection;
- delete, truncate, write, rename, move or copy;
- ACL, owner, timestamp or ADS modification;
- USN Journal create/enable/delete/rebuild;
- audit policy change;
- service/process control;
- Git write;
- source, build or PFR change.

The target path was never passed to CMD or through a shell-expanded `$null`
variable.

## 2. Skills and Inputs

The root `AGENTS.md` route was applied.

Skills used:

- `$security-audit`;
- `$testing-and-verification`;
- `$project-architecture`.

The security-audit and verification references were applied to preserve
read-only handling, separate confirmed evidence from inference, and distinguish
metadata reads from content access.

Inputs:

- `docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r5-r2-r2-r5-independent-design-review.md`
- `docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r5-r2-r2-r6-third-blocking-design-corrections.md`
- `docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r5-r2-r2-r6-design-decisions-and-open-items.md`
- `C:\Users\thinkbook\.codex\sessions\2026\11\15\rollout-2026-11-15T04-03-27-01a1dba8-5f2b-7ac0-b79a-9fd77cb3066c.jsonl`
- existing Windows Event Logs;
- current Git and volume metadata.

Input hashes:

| Input | Expected | Actual | Result |
|---|---|---|---|
| R5 independent review | `458EAB1AB4B5E13E0AECA63663537D8FFD3E621417B7F8440C516AA18635D1A7` | same | PASS |
| R6 main correction | `5C608DC6A3F51B3A029B70601B6A8FCD771CA56EF032F82E8EB482E4396732CD` | same | PASS |
| R6 decisions | `6A08221433471FB7743A3063355626A2D359B0E27E5512A3957E027756BE3C2B` | same | PASS |

## 3. Original Zero-byte State

R5 review evidence:

```text
File:
D:\thinkbook\Desktop\jieya\$null

Length:
0

SHA-256:
E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855
```

The R5 independent review recorded the file as a zero-length untracked file at
lines 180-184. At that snapshot:

- `$null)` was absent;
- the file was already an unintended baseline anomaly;
- no restore/delete authorization existed.

The current Creation Time of the object is:

```text
2026-11-21T21:30:32.1057744Z
```

This matches the first Codex redirection event described in Section 9.

## 4. Current 65-byte State

Observed at BV1 start:

```text
Path:
D:\thinkbook\Desktop\jieya\$null

Exists:
YES

Type:
regular file

Length:
65 bytes

SHA-256:
42BD6E835C6EC8DCCE7454BCCA9C4F3AD94AF783BFE7D2D2CAA7609B0AEF77BB

Attributes:
Archive

Git:
untracked
```

The file content was not read or displayed. The 65-byte value above is the
recorded size, not content.

### 4.1 Additional BV1-created artifact

During BV1 evidence retrieval, one session-search command was also accidentally
routed through `shell: "bash"` while containing `2>$null`. It created a second
zero-byte repository-root file:

```text
D:\thinkbook\Desktop\jieya\$null'
```

Metadata:

```text
CreationTimeUtc:
2026-11-21T22:10:59.2306850Z

LastWriteTimeUtc:
2026-11-21T22:10:59.2306850Z

LastAccessTimeUtc:
2026-11-21T22:10:59.2306850Z

Length:
0

SHA-256:
E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855

Attributes:
Archive

Git:
untracked
```

The LastAccessTime above was sampled before the initial SHA-256 read of the
newly discovered artifact. That read may advance its access time in the same
manner as the primary target; no before/after access-time comparison was made
for this secondary empty file.

No content was read. The file was not deleted, renamed, moved or added to Git.
It is a new baseline change caused by the same shell-routing class.

## 5. Metadata

### 5.1 Stable object metadata

```text
CreationTimeUtc:
2026-11-21T21:30:32.1057744Z

LastWriteTimeUtc:
2026-11-21T21:59:26.7885272Z

LastAccessTimeUtc:
22:02:50.7941340Z before BV1 hash
22:06:50.1649452Z after BV1 hash

File Attributes:
Archive

Owner:
LAPTOP-34H6Q1OD\thinkbook
```

The authorized SHA-256 read advanced LastAccessTime by approximately four
minutes. File length, LastWriteTime and content hash did not change during that
hash operation. No further content/hash access was performed.

### 5.2 DACL

```text
O:S-1-5-21-1861005943-12376289-3718241203-1001
G:S-1-5-21-1861005943-12376289-3718241203-513
D:AI
  (A;ID;0x1301bf;;;S-1-5-21-652459337-344731690-428846000-3930787116)
  (A;ID;0x1301bf;;;S-1-5-21-1861005943-12376289-3718241203-1008)
  (A;ID;0x1301bf;;;S-1-5-21-3814418237-1796301655-2125238568-1544361098)
  (A;ID;FA;;;SY)
  (A;ID;FA;;;BA)
  (A;ID;FA;;;S-1-5-21-1861005943-12376289-3718241203-1001)
```

The DACL is inherited. The current user SID has full access.

### 5.3 Alternate Data Streams

Only:

```text
:$DATA   65 bytes
```

No named ADS was found. No stream content was read.

## 6. File Identity and Volume

```text
NTFS File ID:
0x000000000000000000210000000209cc

Parent File Reference:
0x0000000000000000000e00000001d84a

Volume:
D:

File System:
NTFS

Volume Serial Number:
B46C803A

Hard-link listing:
one path
```

The hard-link output contained only:

```text
\thinkbook\Desktop\jieya\$null
```

No evidence of a hard-link fan-out was found.

## 7. USN Journal

### 7.1 Journal state

```text
Journal ID:
0x01dafce9716883d3

First Usn:
0x0000000024800000

Next Usn:
0x0000000026a58be8

Lowest Valid Usn:
0x0000000000000000

Maximum Size:
32 MiB

Allocation Delta:
8 MiB

Minimum record version:
2

Maximum record version:
4

Write range tracking:
Disabled
```

The file's current USN from `fsutil usn readData`:

```text
FileRef#:
0x000000000000000000210000000209cc

Usn:
0x0000000026a4ee38

Reason:
0x0

Source Info:
0x0

Security Id:
0x0

File Attributes:
0x20 (Archive)

FileName:
$null
```

`fsutil usn readData` reported a zero timestamp/reason summary; it did not
provide a usable event history.

### 7.2 Exact record enumeration

Attempted:

```text
fsutil usn enumData <FileRef> 0x24800000 0x26a58be8 D:
```

Result:

```text
Error 5: Access is denied.
```

Journal read attempts with the available syntax did not produce a valid
target-specific slice.

Conclusion:

```text
USN historical reason/timestamp:
NOT AVAILABLE — ACCESS DENIED

USN journal current state:
AVAILABLE AND COVERS THE FILE'S CURRENT USN RANGE
```

The absence of a readable USN event is not treated as evidence that no write
occurred.

## 8. Codex Session Evidence

Session log:

```text
C:\Users\thinkbook\.codex\sessions\2026\11\15\rollout-2026-11-15T04-03-27-01a1dba8-5f2b-7ac0-b79a-9fd77cb3066c.jsonl
```

Only lines around matching timestamps and `2>$null` were parsed. The full
session was not reproduced in the report because it contains unrelated project
conversation.

### 8.1 Original zero-byte creation event

Function call:

```text
timestamp:
2026-11-21T21:30:31Z (session field)

tool:
exec_command

requested shell:
bash

cwd:
D:\thinkbook\Desktop\jieya

command:
rg -n -i -e 'P13TerminationInvoke' ... apps 2>$null
```

Unified-exec item:

```text
started_utc:
2026-11-21T21:30:32.216Z

completed_utc:
2026-11-21T21:30:32.257Z

wrapper:
cmd.exe /c rg ... 2>$null

process_id:
14988

status:
failed

exit_code:
1

captured output length:
0
```

File system:

```text
CreationTimeUtc:
2026-11-21T21:30:32.1057744Z

Initial content:
0 bytes
```

The process is no longer running. PID reuse is not relevant to the attribution
because the exact Codex item record and target creation second agree.

### 8.2 R6 65-byte write event

Function call:

```text
timestamp:
2026-11-21T21:59:26Z (session field)

tool:
exec_command

requested shell:
bash

cwd:
D:\thinkbook\Desktop\jieya

command:
$files=@('...R6-main...','...R6-decisions...');
$stale=@(...);
foreach($s in $stale){
  $hits=rg -n -F $s $files 2>$null;
  ...
}

completion:
2026-11-21T21:59:26.821Z

wrapper:
cmd.exe /c $files=@(...); ... rg ... 2>$null

process_id:
24091

status:
failed

exit_code:
1

captured output length:
0
```

File system:

```text
LastWriteTimeUtc:
2026-11-21T21:59:26.7885272Z

Post-write length:
65 bytes
```

The process is no longer running.

### 8.3 Subsequent control event

At approximately `21:59:33`, the same stale-string check was retried with:

```text
shell: "powershell"
```

The target LastWriteTime remained `21:59:26.7885272Z`.

This is consistent with:

- the Bash/CMD invocation creating/modifying the literal `$null` file;
- the PowerShell invocation treating `$null` as the null sink.

## 9. Causal Reconstruction

### 9.1 Creation

At `21:30:32`, Codex launched a Bash-profile command containing:

```text
rg ... 2>$null
```

with cwd `D:\thinkbook\Desktop\jieya`.

The executor routed it to:

```text
cmd.exe /c ... 2>$null
```

CMD interpreted the final token as redirection to a file named `$null`,
creating a zero-byte file. `rg` exited with code 1 and emitted no captured
stdout.

### 9.2 R6 modification

At `21:59:26`, a similar Codex command again requested Bash while containing a
PowerShell-style `2>$null`.

The executor routed it through `cmd.exe /c`. CMD parsed the line as a batch
command, not a PowerShell script. The redirection target remained the literal
file:

```text
D:\thinkbook\Desktop\jieya\$null
```

The underlying process reported failure and no captured output because stderr
was redirected to the literal file. The file's LastWriteTime is in the same
second, before the executor recorded process completion.

### 9.3 Object replacement

Evidence indicates in-place modification/truncation/write, not a new file:

- CreationTime remained `21:30:32.1057744Z`;
- the R6 write did not change CreationTime;
- only one hard link exists;
- the file was already present at R6 start.

A prior File ID for the zero-byte state was not recorded, so an earlier
delete/recreate in the same second cannot be mathematically excluded from
metadata alone. The combination of unchanged CreationTime and the exact
redirection command makes in-place overwrite **high confidence**.

## 10. System Audit Evidence

| Source | Availability/result | Interpretation |
|---|---|---|
| Codex session JSONL | available and exact command/time | authoritative execution record |
| Security Event 4663 | no matching events in 21:30-22:01 window | file auditing may be disabled or SACL not configured |
| `auditpol` File System policy | `Access denied` (`1314`) | NOT AVAILABLE — PRIVILEGE REQUIRED |
| Sysmon logs | absent | NOT AVAILABLE — SYSMON NOT INSTALLED/LOGGING |
| PowerShell Transcription | log absent | NOT AVAILABLE — TRANSCRIPTION NOT ENABLED |
| Windows PowerShell classic log | enabled; zero events in 21:55-22:01 | no event-level evidence |
| PowerShell Operational log | zero events in 21:55-22:01 for selected window | no event-level evidence |
| Defender Operational | no matching events | not proof of no write |
| PSReadLine history | modified 2026-11-17; no target-like entries | does not cover R6 execution |

No audit setting, ETW provider, SYSMON channel or transcription policy was
changed.

## 11. Timeline

| UTC time | Event | Evidence | Confidence |
|---|---|---|---|
| 2026-11-21T21:30:31Z | Codex `exec_command`, `shell: bash`, `rg ... 2>$null` | session function_call | CONFIRMED |
| 2026-11-21T21:30:32.1057744Z | `$null` object created, 0 bytes | CreationTime + FS length | CONFIRMED |
| 2026-11-21T21:30:32.216-257Z | `cmd.exe /c ... 2>$null`, PID 14988, exit 1 | unified-exec item | CONFIRMED |
| After 21:30 | R5 review records 0 bytes and empty SHA-256 | R5 report | CONFIRMED |
| 2026-11-21T21:59:26.7885272Z | LastWriteTime changes with 65-byte length | FS metadata | CONFIRMED |
| 2026-11-21T21:59:26.821Z | `cmd.exe /c $files...2>$null`, PID 24091, exit 1 | session item | CONFIRMED |
| 2026-11-21T22:02:50.7941340Z | R6 first target hash/LastAccess snapshot | session item | CONFIRMED |
| 2026-11-21T22:06:50.1649452Z | BV1 authorized hash updates LastAccess | current metadata | CONFIRMED |

## 12. Attribution

### 12.1 What is proven

- The R6 65-byte write occurred during the same second as a Codex Bash-mode
  command whose CMD wrapper contained a literal `$null` redirection.
- The prior zero-byte object was created by the same class of shell-routing
  mistake.
- The file is one hard-linked NTFS object with a stable CreationTime.
- The target was not changed by any explicitly allowed BV1 metadata query
  except LastAccessTime during the authorized hash.

### 12.2 What is not proven

- The exact 65 bytes of content were not read and cannot be classified.
- The exact internal CMD tokenization and OS write offset cannot be shown
  without USN reason data and content inspection.
- The exact sub-second ordering at object creation differs by ~111 ms between
  file CreationTime and executor `started_utc`; both remain in the same second.
- A coincident external writer cannot be absolutely excluded without file
  auditing, but no such process/source evidence exists.

### 12.3 Final attribution

```text
ATTRIBUTED — WRITE SOURCE CONFIRMED
```

Confidence:

```text
HIGH
```

The write source category is confirmed as **Codex exec_command Bash routing
into `cmd.exe /c`, where PowerShell-style `2>$null` became a literal filename
redirection in the repository root**.

## 13. Risk Impact

### 13.1 Confirmed

- `$null` became 65 bytes.
- The write was local, deterministic and related to a tool invocation bug.
- The file remains untracked and outside Git.
- R6 reports accurately recorded the observed 0-to-65 transition.
- Six other protected objects and B1/B4 hashes remain unchanged.

### 13.2 Not established

- Whether the 65 bytes contain sensitive information.
- Whether the file poses a malware or execution risk.
- Whether any other untracked file was created by the same shell pattern.
- Whether historical R5 or earlier stages used the same pattern outside the
  two identified commands.

No conclusion is made that the file is safe to open, execute, delete or ignore.
No evidence supports a claim that general project source or all protected
objects are compromised.

## 14. Git and Protected Baseline

At BV1 start:

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

Tracked modified:
26

Untracked:
247

Staged:
0

Deleted:
0
```

This report plus the newly created `$null'` artifact produce an observed
untracked count of 249.

PFR:

```text
46 strings
23 DELETE
0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC
```

B1/B4 hashes and the six protected objects remained at their recorded values.

`$null)` remains absent.

No `p13_native*` process was running.

## 15. Recommended Disposition Options

No option is executed by this stage.

| Option | Evidence retained | Git effect | Risk/control |
|---|---|---|---|
| Preserve both `$null` and `$null'` files and record Baseline Exceptions | current metadata/content remains available only to future authorized examiner | count stays 249 | safest immediate option; repository remains non-clean |
| Authorized forensic copy outside repository, then restore `$null` to zero and remove the empty `$null'` artifact | both artifacts evidence is preserved externally | count returns to 247 | requires explicit copy/restore/delete authority |
| Authorized forensic copy, then exact deletion of both artifacts | copy preserves evidence; original paths are removed | count decreases to 246 | requires exact deletion authority and new baseline record |
| Authorized exact move of both artifacts to quarantine | content and object identity preserved outside repo | count decreases to 246 | best evidence preservation if repo must be clean, but requires move authority |
| Leave untracked indefinitely without exception records | content remains | count stays 249 | not recommended; baseline ambiguity persists |

Recommended immediate option:

```text
Preserve current 65-byte file
+ record a Baseline Exception
+ do not read content until separately authorized
```

If a clean repository root is required, the next safest option is an
explicitly authorized move to a quarantine location outside the repository,
after recording the source and destination identities. Deletion and truncation
must remain separately authorized.

## 16. Read-only Status

The investigation changed no file content. It did change LastAccessTime while
performing the explicitly authorized SHA-256 calculation. No second hash was
performed after that metadata change.

No further target content or time-modifying operation was performed.

## 17. Findings

### P2-01 — Bash/CMD shell routing converted PowerShell null redirection into a file write

Location:

```text
Codex session log line 49561-49562
```

Trigger:

```text
exec_command(shell="bash", cmd contains "2>$null", cwd=project root)
```

The unified executor used `cmd.exe /c`. CMD interpreted `$null` as a literal
file. The same defect created the original zero-byte file and later produced
the 65-byte write.

Impact:

- baseline contamination;
- a failed diagnostic command silently leaves an untracked artifact;
- subsequent PowerShell retries do not repair the artifact.

Suggested future control:

- reject Bash shell requests for PowerShell syntax containing `$` redirection;
- require PowerShell for PowerShell scripts;
- detect and block literal redirection targets named `$null`;
- use `/dev/null` for Bash and `$null` only under PowerShell.

### P2-02 — Same defect recurred during BV1 evidence collection

At `22:10:59.2306850Z`, a BV1 session-log query accidentally requested Bash
and contained `2>$null`. The CMD wrapper created:

```text
D:\thinkbook\Desktop\jieya\$null'
```

The file is zero bytes and untracked. This is an additional root baseline
change and sets the final stage result to:

```text
FAIL — ADDITIONAL PROTECTED BASELINE CHANGE DETECTED
```

No remediation was attempted.

### P3-01 — Authorized forensic hash advanced LastAccessTime

The allowed SHA-256 read advanced LastAccessTime from
`22:02:50.7941340Z` to `22:06:50.1649452Z`. Size, LastWriteTime and digest did
not change. No further content/hash access was performed.

## 18. Final Status

```text
Overall:
FAIL — ADDITIONAL PROTECTED BASELINE CHANGE DETECTED

Original `$null` Write Source:
ATTRIBUTED — WRITE SOURCE CONFIRMED

Write Source:
Codex exec_command Bash routing -> cmd.exe /c -> literal 2>$null redirection

Original 0-byte creation:
CONFIRMED BY SAME CMD REDIRECTION PATTERN

R6 65-byte write:
CONFIRMED BY SESSION TIMESTAMP AND FS LastWriteTime

File Replacement:
NOT INDICATED / HIGH CONFIDENCE IN-PLACE WRITE

USN Historical Records:
NOT AVAILABLE — ACCESS DENIED

Content Sensitivity:
UNKNOWN — CONTENT NOT READ

Other Protected Objects:
UNCHANGED

Repository:
ADDITIONAL UNTRACKED BASELINE CHANGE DETECTED

Target Disposition:
NOT PERFORMED / USER AUTHORIZATION REQUIRED

Additional `$null'` Disposition:
NOT PERFORMED / USER AUTHORIZATION REQUIRED
```

## 19. Report Integrity

This report cannot contain its own digest without changing its bytes. The final
external SHA-256 is calculated after the last write.
