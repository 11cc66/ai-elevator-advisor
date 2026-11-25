# P1-3 C-6.2-L8-A7.20-R4-A1-R2-R2 Reappeared Root File Investigation

## 0. Status

```text
Stage:
C-6.2-L8-A7.20-R4-A1-R2-R2

Mode:
READ-ONLY FORENSIC INVESTIGATION

Result:
PASS WITH WARNINGS

Target file deleted or modified:
NO

Git write / install / build / test / RPC:
NOT EXECUTED
```

The evidence supports a high-confidence conclusion that the current
`$null)` is a new NTFS directory entry created later than the object recorded
by R4-A1-R1, not proof that the earlier object survived deletion. Identical
bytes do not prove identical filesystem identity.

## 1. Skills and Scope

The following Skills were loaded and applied in read-only mode:

```text
$security-audit
$testing-and-verification
```

Reviewed evidence:

- R4-A1-R1 native RPC toolchain assessment;
- R4-A1-R1 feasibility report, which records the original `$null` and
  `$null)` observations and hashes;
- R4-A1-R2-R1 installation manifest;
- R4-A1-R2-R1 final readiness report;
- current NTFS, Git, process, history and event-log metadata.

No separate R4-A1-R1-C1 or R4-A1-R1-C2 report file exists in the repository.
Those exact report bodies are therefore `NOT AVAILABLE` in project evidence.
Their authorization facts are used only as user-supplied historical context,
not as a substitute for a readable source report.

## 2. Starting Baseline

```text
Current directory:
D:\thinkbook\Desktop\jieya

Normalized Git root:
D:/thinkbook/Desktop/jieya

Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

Tracked modified:
26

Untracked files:
181

Staged:
0

Deleted:
0
```

The count matches the expected stage baseline. The 181 untracked entries
include the previously delivered R4-A1-R2-R1 documents.

## 3. Current File Identity

Only the literal path was used:

```text
D:\thinkbook\Desktop\jieya\$null)
```

Observed properties:

```text
Object type:            regular file, not a directory
Length:                 65 bytes
Attributes:             0x20 (Archive)
LinkType:               null
Target:                 null
Exact-name matches:     1
Parent:                 D:\thinkbook\Desktop\jieya
CreationTimeUtc:        2026-11-20T10:02:38.5812097Z
LastWriteTimeUtc:       2026-11-20T10:02:38.5890117Z
LastAccessTimeUtc:      2026-11-20T10:11:36.7161921Z
SHA-256:                8AD444F42168AB885CB04D8E5446BF899E7F4B5B35068A91020F415BF661BC49
```

NTFS observations:

```text
Volume:                 D:
File system:            NTFS
Volume serial:          B46C803A
File ID:                0x0000000000000000003b000000030085
Parent file reference:  0x0000000000000000000e00000001d84a
Hard-link paths:        one path only
```

The literal sibling `$null` does not currently exist. The target is not a
symlink, Junction or Reparse Point, and no second directory entry with the same
exact name was found in the project root.

## 4. Content Evidence

The 65 bytes are:

```text
27 24 6E 61 6D 65 73 27 20 B2 BB CA C7 C4 DA B2 BF
BB F2 CD E2 B2 BF C3 FC C1 EE A3 AC D2 B2 B2 BB CA C7
BF C9 D4 CB D0 D0 B5 C4 B3 CC D0 F2 0D 0A BB F2 C5 FA
B4 A6 C0 ED CE C4 BC FE A1 A3 0D 0A
```

Decoded using Windows code page 936:

```text
'$names' 不是内部或外部命令，也不是可运行的程序
或批处理文件。
```

The content contains no credential, token, private key, connection string or
other detected secret. It is the standard Chinese `cmd.exe` error text emitted
when the literal command `$names` cannot be resolved.

## 5. Timeline

```text
2026-11-20T09:06:53.7722777Z
R4-A1-R1 feasibility report file creation.

2026-11-20T09:08:18.5943476Z
R4-A1-R1 feasibility report last write; it records that `$null` and `$null)`
already existed and had the same 65-byte SHA-256.

2026-11-20T09:20:16.3870651Z
R4-A1-R2 provisioning readiness report creation.

2026-11-20T10:02:38.5812097Z
Current `$null)` creation.

2026-11-20T10:02:38.5890117Z
Current `$null)` last write, 8 ms after creation.

2026-11-20T10:04:44.3245831Z
R4-A1-R2-R1 installation manifest file creation.

2026-11-20T10:04:44.3271282Z
R4-A1-R2-R1 final readiness report file creation.
```

The project root's `LastWriteTimeUtc` changed to exactly
`2026-11-20T10:02:38.5812097Z`, matching the target's creation time and
providing additional evidence of a new directory entry at that moment.

The authorized read-only content inspections advanced `LastAccessTimeUtc` from
`2026-11-20T10:06:26.2103408Z` to
`2026-11-20T10:11:36.7161921Z`. No write command, content write,
rename, move, creation-time change or last-write change was performed.

## 6. Comparison with the Historical Object

| Property | Historical evidence | Current object | Result |
|---|---|---|---|
| Exact path | Same project-root path | Same project-root path | MATCH |
| Name | `$null)` | `$null)` | MATCH |
| Size | 65 bytes | 65 bytes | MATCH |
| SHA-256 | `8AD444...BC49` | `8AD444...BC49` | MATCH |
| Object type | regular file | regular file | MATCH |
| Creation time | not preserved in readable repository report | `2026-11-20T10:02:38.5812097Z` | NOT COMPARABLE |
| File ID | not preserved in readable repository report | `...030085` | NOT COMPARABLE |

The current CreationTime is more than 53 minutes later than the R4-A1-R1 report
that already recorded the path. Unless timestamps were deliberately rewritten,
which no available evidence suggests, the current object cannot be the original
object observed by R4-A1-R1. It is best classified as the same payload template
written to a newly created path instance.

## 7. Repository and Path Identity

```text
Current directory and Git root:
D:/thinkbook/Desktop/jieya

Git directory:
.git

Common Git directory:
.git

Git worktrees:
one worktree only

Worktree path:
D:/thinkbook/Desktop/jieya

Target Git state:
untracked

Target ignored:
no

Target tracked:
no
```

The scenarios "current worktree is a different checkout" and "the path resolves
to a different repository root" are contradicted by the current path and Git
metadata.

## 8. Provenance Assessment

### Confirmed facts

1. The target is a standalone 65-byte regular file at the exact approved root
   path.
2. Its bytes contain a `cmd.exe` command-not-found error naming `$names`.
3. Its creation and last-write timestamps are separated by 8 ms, consistent
   with one redirected command error output.
4. Its creation timestamp is later than the R4-A1-R1 report that recorded an
   object at the same path.
5. The project root directory timestamp changed to the current target's
   creation timestamp.
6. It has one hard-link path, no link target and no coexisting `$null` sibling.
7. Git has one worktree, and the target is untracked and not ignored.

### High-confidence inference

The current object was created by a command execution layer that ran the
literal text `$names` as a command, produced a `cmd.exe` error, and redirected
stderr to the literal filename `$null)` because the surrounding command syntax
was not interpreted as native PowerShell redirection to the automatic `$null`
variable.

This is consistent with the previously recorded execution-wrapper failure mode
where commands beginning with PowerShell variable assignments or containing
special redirection syntax were passed through the wrong command layer.

### Not established

- The exact command text is not available.
- The exact process invocation that created the directory entry is not
  available.
- C1/C2 report files and their recorded file IDs/creation times are not present
  in the repository.
- The file-system audit policy could not be read without elevated privilege.
- The Security event log and USN read-journal require privileges not held by the
  current non-administrator shell.
- USN metadata for the current file reported timestamp and reason values of
  zero, so it did not provide historical create/delete attribution.

## 9. Available and Unavailable Audit Sources

| Source | Result |
|---|---|
| Interactive PowerShell history | available, last write `2026-11-17T13:01:40Z`; no `$names`, `$null)` or `2>$null` match; does not cover event time |
| Classic Windows PowerShell operational log | enabled; no event in the 60-second creation window |
| PowerShell 7 Core operational log | channel not present on this host |
| Security event log | inaccessible without elevation |
| File-system audit policy | inaccessible without elevation |
| USN read-journal | access denied without elevation |
| Current process metadata | only `node.exe` (Codex primary runtime) and the current `pwsh.exe` were relevant |
| Historical process tree | `NOT AVAILABLE` |

The surviving Codex runtime Node process began at
`2026-11-20T16:31:26.011455+08:00`, before the target was created. This proves
that the execution environment existed at the relevant time, but it does not
prove which command it executed.

## 10. Recurrence Risk

No background writer has been observed:

- the target's creation and last-write timestamps remained unchanged throughout
  this investigation;
- there is no second hard link;
- no periodic task, watcher or scheduled recreation evidence was found.

The residual risk is command-triggered, not demonstrated persistent
recreation. Any future tool invocation that repeats the malformed
`$...`/redirection pattern can create the file again. The source command pattern
must therefore be avoided before and after cleanup.

## 11. Cleanup Recommendation

Do not delete the file in this stage.

After explicit human approval for a new exact-path cleanup stage:

1. Recheck that the path is still one ordinary file with 65 bytes and SHA-256
   `8AD444F42168AB885CB04D8E5446BF899E7F4B5B35068A91020F415BF661BC49`.
2. Recheck that no `$null` sibling, link target or additional hard-link path
   exists.
3. Capture the NTFS file ID and current Git baseline.
4. Use only `Remove-Item -LiteralPath` for the exact absolute path; do not use a
   wildcard, recursion, `git clean` or broad cleanup.
5. Use a cleanup command form that does not contain a leading `$variable =`
   assignment or an ambiguous `2>$null` expression.
6. Recheck exact path absence and Git counts immediately, then again after a
   bounded observation interval without executing commands that can trigger the
   malformed redirection.
7. If the file reappears, stop and preserve the new file for another
   provenance review.

This recommendation is not deletion authorization.

## 12. Source Evidence Hashes

| Evidence file | SHA-256 |
|---|---|
| R4-A1-R1 feasibility report | `BD46AC47E9891F0B0DF1CFFB969A0977AC91D07888AC66524C6C197DD7270096` |
| R4-A1-R1 toolchain assessment | `3E2987D2D815E64D3E642977D0E8D06C61D756F4D5E817444065ADAAD1F042BE` |
| R4-A1-R2-R1 installation manifest | `6083F8DA5BDBB84ED02E2F9B2D88BC95151607B3F478717AC69C0A4E28D4B15E` |
| R4-A1-R2-R1 final readiness report | `F0BAA3472BDB8B3CD21140F5E8B1914EB87811B8905265A05D180F8E09F3C754` |

The target SHA-256 is recorded in section 3. This report cannot contain its own
stable SHA-256 without changing it; its final SHA-256 is reported externally
after the file is frozen.

## 13. Final Disposition

```text
R4-A1-R2-R2:
PASS WITH WARNINGS

Current target identity:
MATCHES HISTORICAL NAME / SIZE / SHA-256
DIFFERS BY CREATION TIME FROM READABLE HISTORICAL REPORT

Original object survived deletion:
NOT SUPPORTED

High-confidence provenance:
NEW FILE CREATED BY A MIS-PARSED COMMAND REDIRECTION

Exact command and process:
NOT AVAILABLE

Persistent autonomous recreation:
NOT OBSERVED

Command-triggered recurrence risk:
REMAINS

Deletion performed:
NO

Next stage authorization:
NOT GRANTED
```
