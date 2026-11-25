# P1-3 C-6.2-L8-A7.20-R4-A1-R6 Controlled Artifact Disposition

## 0. Executive Result

```text
Stage:
C-6.2-L8-A7.20-R4-A1-R6-BV2

Date:
2026-11-22

Mode:
CONTROLLED EXACT DISPOSITION

Overall:
PASS WITH APPROVED BASELINE EXCEPTION

Target A `$null`:
KEEP AS FORENSIC EVIDENCE

Target B `$null'`:
DELETED EXACTLY ONCE

Shell Guard:
RECORDED

`$null)`:
ABSENT

Git Writes:
NOT EXECUTED
```

BV1 established that a Bash-labelled Codex command was executed through
`cmd.exe /c`, where PowerShell's `2>$null` became a literal file redirect.
BV2 uses a verified PowerShell process and exact path construction, preserves
`$null`, deletes only `$null'`, and records reusable shell-invocation rules.

## 1. Authorization and Scope

Authorized:

- metadata-only inspection of the two exact targets;
- keeping `D:\thinkbook\Desktop\jieya\$null`;
- one exact deletion of `D:\thinkbook\Desktop\jieya\$null'`;
- adding this report;
- recording a project-level shell invocation guard.

Not performed:

- reading either target's content;
- hashing `$null` again during BV2;
- modifying, truncating, restoring or deleting `$null`;
- deleting any other path;
- wildcard, recursive or directory deletion;
- Git write;
- source, IDL, build, ACL, PFR, service, database or Storage change;
- Native build or Runtime.

## 2. Input Evidence

BV1 report:

```text
docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r6-baseline-violation-forensic-review.md
```

Expected SHA-256:

```text
AAF113E8399D3F11A234AE0DF00E718AA5B0F0989801FDC0FC2B66C81C0F2A53
```

Actual SHA-256:

```text
AAF113E8399D3F11A234AE0DF00E718AA5B0F0989801FDC0FC2B66C81C0F2A53
```

Result:

```text
PASS
```

## 3. Actual Shell Execution

The deletion and post-delete checks did not rely on the `shell` tool label.

The current process was verified from OS process metadata:

```text
Process:
pwsh

Executable:
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1116-1220-0_26.1116.1220.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe

PowerShell version:
7.6.9

CMD wrapper:
NO
Bash:
NO
```

The delete operation used an explicitly initialized PowerShell process and
PowerShell file APIs. The path was constructed as:

```powershell
$p = 'D:\thinkbook\Desktop\jieya\' + '$null' + [char]39
```

No `$null` variable expansion, string interpolation, wildcard or output
redirection was used in the deletion command.

## 4. Protected Target A

Path:

```text
D:\thinkbook\Desktop\jieya\$null
```

Decision:

```text
KEEP AS FORENSIC EVIDENCE
```

BV1 evidence retained:

```text
Length:
65 bytes

SHA-256 from BV1:
42BD6E835C6EC8DCCE7454BCCA9C4F3AD94AF783BFE7D2D2CAA7609B0AEF77BB

CreationTimeUtc:
2026-11-21T21:30:32.1057744Z

LastWriteTimeUtc:
2026-11-21T21:59:26.7885272Z

Attributes:
Archive

Git:
untracked
```

BV2 did not:

- read its content;
- calculate another content hash;
- truncate or restore it;
- change its timestamps, ACL or owner;
- delete, move, rename or copy it.

Pre-delete length:

```text
65
```

Post-delete length:

```text
65
```

Creation and LastWrite times were unchanged.

Status:

```text
APPROVED BASELINE EXCEPTION PENDING INDEPENDENT REVIEW
```

## 5. Exact Target B Precondition

Path:

```text
D:\thinkbook\Desktop\jieya\$null'
```

Parsed absolute path:

```text
D:\thinkbook\Desktop\jieya\$null'
```

Checks:

| Check | Required | Observed | Result |
|---|---:|---:|---|
| exact normalized path | exact expected path | exact | PASS |
| leaf exists | yes | yes | PASS |
| directory | no | no | PASS |
| regular-file attributes | yes | Archive | PASS |
| Reparse Point | no | no | PASS |
| length | 0 | 0 | PASS |
| Git untracked | yes | yes | PASS |
| path ambiguity | none | none | PASS |

Times:

```text
CreationTimeUtc:
2026-11-21T22:10:59.2306850Z

LastWriteTimeUtc:
2026-11-21T22:10:59.2306850Z
```

No content was read.

## 6. Exact Deletion

Only after all preconditions passed, the command rechecked:

- actual process name was `pwsh`;
- normalized path equals the exact literal target;
- path is an existing leaf;
- path is not a directory;
- attributes do not contain `Directory` or `ReparsePoint`;
- target length is exactly 0;
- protected `$null` remains exactly 65 bytes.

Deletion operation:

```powershell
[IO.File]::Delete($p)
```

Invocation count:

```text
1
```

Result:

```text
SUCCESS
```

No retry was performed. No wildcard, recursive, directory or bulk deletion was
used.

## 7. Post-delete Verification

Target B:

```text
Leaf exists:
FALSE

Container exists:
FALSE

Git untracked:
FALSE
```

Target A:

```text
Exists:
YES

Length:
65

CreationTimeUtc:
2026-11-21T21:30:32.1057744Z

LastWriteTimeUtc:
2026-11-21T21:59:26.7885272Z

Attributes:
Archive
```

Secondary path:

```text
D:\thinkbook\Desktop\jieya\$null()

Exists:
FALSE
```

After exact deletion and before adding this report, root untracked entries were:

```text
$null
```

No second abnormal root artifact was found.

## 8. Shell Invocation Guard

### 8.1 Syntax by actual shell

| Actual shell | Correct stderr discard | Prohibited cross-shell use |
|---|---|---|
| PowerShell | `2>$null` | `2>NUL`, `2>/dev/null` |
| CMD | `2>NUL` | `2>$null`, `2>/dev/null` |
| Bash | `2>/dev/null` | `2>$null`, `2>NUL` |

The tool's requested `shell` value is not sufficient evidence. Actual execution
must be checked from the running executable or wrapper.

### 8.2 Project rules

1. Do not use stderr redirection for commands operating in the project root.
2. Do not issue `$`-containing redirection until the actual shell is verified.
3. Use `-LiteralPath` for exact PowerShell file paths.
4. Use exact quoted literal paths in CMD and avoid variable expansion.
5. Never use `$null` as a filename variable.
6. Never treat `2>$null` as portable shell syntax.
7. Do not redirect `rg`, `git`, PowerShell or CMD errors into an unspecified
   project-root path.
8. Declare an exact output path before any command that can write a file.
9. If shell identity and redirection syntax do not match, stop; do not switch
   syntax automatically and continue.
10. For temporary output, use an approved path outside the project root and
    state it explicitly.
11. Use `/dev/null` only with verified Bash, `2>NUL` only with verified CMD,
    and `2>$null` only with verified PowerShell.
12. Exact destructive PowerShell operations must verify the running process,
    literal path, object type, link attributes and operation-specific
    preconditions immediately before the one authorized API call.

## 9. Git Baseline

Before deletion:

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

Tracked modified:
26

Untracked:
249

Staged:
0

Deleted:
0
```

After deletion, before adding this report:

```text
Tracked modified:
26

Untracked:
248

Staged:
0

Deleted:
0

Root untracked:
$null
```

Expected after adding this report:

```text
Tracked modified:
26

Untracked:
249

Staged:
0

Deleted:
0

Root untracked:
$null
```

The untracked count returns to its pre-BV2 number because one authorized file
was deleted and one authorized report was added.

## 10. PFR and Protected Objects

PFR remained:

```text
46 strings
23 DELETE
0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC
```

B1:

```text
Server:   A1169E2F6882BE5CA6F7D18C435DDA77E0F78A15467DE3C3A3271ABE241E38A5
Client:   C86BE3839F414A8CE95DFC4312878EA598BE1FEC4A53AE254E943573897B4C6A
Manifest: DC164B09C1D16C7CAEB46B3785CA3806C703300C2535A39B471F7D08039FE2FF
Static:   D10DE78D2B1736542AB3B4879ADABEA11A216CFEE6E535012A61D71F7218251D
```

B4:

```text
Server:   324D1C06BB5452FCE982119E3985AE5AB5B5A41A2D06013A709ECCD2266EEFB3
Client:   D7BFF66F519B3B3544D8D0CC3858567B1B4CE64BCEFC1C5DFB7DFFEC6BEBCD49
Tests:    AA2636BE8B53E26E79131E2C17FC863A6792D99976C01ED3A76EA7B5AF7EF3FA
Manifest: 58ED3EAFF2498AFA44D4E1D92FD2CA43DD86CBA57E5E7B93B4B97204E8B79774
Static:   DEDA51B673CFA57CC653F02112C5C1322686F9B01424A80E69E6D5BEC4EB362E
```

Six protected objects:

```text
FZ:
E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705

ST:
5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586

DBTP:
FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7

Prisma:
78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299

next-env.d.ts:
0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC

tsconfig.tsbuildinfo:
21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520
```

All matched. No `p13_native*` process was running.

## 11. Baseline Exception

Target A remains:

```text
D:\thinkbook\Desktop\jieya\$null
65 bytes
untracked
```

Exception ID:

```text
APPROVED-BASELINE-EXCEPTION-R6-NULL-001
```

Status:

```text
PENDING INDEPENDENT REVIEW
```

The exception preserves the artifact and BV1 evidence. It does not approve
future deletion or content inspection.

## 12. Authorization Compliance

```text
Exact target B deleted:
YES

Target A preserved:
YES

Target A content read:
NO

Target A hash recalculated by BV2:
NO

Other files deleted:
NO

Wildcard/recursive/directory delete:
NO

Git writes:
NO

Source/build/PFR/ACL changes:
NO

Additional root artifact after delete:
NO

Shell guard recorded:
YES
```

## 13. Final Status

```text
Overall:
PASS WITH APPROVED BASELINE EXCEPTION

Target A:
KEPT / PENDING INDEPENDENT REVIEW

Target B:
DELETED EXACTLY ONCE / VERIFIED ABSENT

Shell Invocation Guard:
RECORDED

Additional Baseline Drift:
NONE OBSERVED DURING DISPOSITION

PFR / B1 / B4 / Six Protected Objects:
PASS

Native Runtime:
NOT EXECUTED
```

## 14. Report Integrity

This report cannot contain its own final hash without changing its bytes. The
external SHA-256 is reported after the final write.
