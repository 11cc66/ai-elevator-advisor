# P1-3 R6-BV3-A1 Controlled Artifact Disposition

## 0. Executive Result

```text
Stage:
R6-BV3-A1

Date:
2026-11-22

Mode:
CONTROLLED EXACT DELETION

Final Status:
PASS — EXACT AUTHORIZED ARTIFACT DELETED

Target:
D:\thinkbook\Desktop\jieya\$null'

Deletion Calls:
1

Target After Deletion:
ABSENT

`$null` Original:
NOT READ, NOT HASHED, NOT MODIFIED, NOT DELETED

`$null()`:
ABSENT

Git Writes:
NOT EXECUTED

Native Build/Runtime:
NOT EXECUTED
```

## 1. Authorization Scope

Authorized:

- verify `$null'` identity against BV3;
- delete the exact `$null'` file once;
- add this disposition report.

Not authorized or performed:

- read, hash or modify `$null`;
- use wildcard or recursive deletion;
- delete another file;
- modify source, IDL, tests or build configuration;
- modify ACLs, PFR, services, database or Storage;
- Git write;
- Build or Native Runtime.

## 2. Input Evidence

BV3 report:

```text
docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r6-bv3-null-protected-baseline-drift-forensic-review.md
```

Expected SHA-256:

```text
33BDAFEFA4254D86787B547DFBCA531300D7E6A64F6D5F74E415D285F3A868F0
```

Actual SHA-256:

```text
33BDAFEFA4254D86787B547DFBCA531300D7E6A64F6D5F74E415D285F3A868F0
```

Result:

```text
PASS
```

## 3. Verified PowerShell Execution

The deletion preflight and deletion were executed through an explicitly
started `pwsh.exe` child process with `-NoProfile -NonInteractive
-EncodedCommand`.

Successful preflight process:

```text
PID:
25108

PowerShell version:
7.6.9

Process name:
pwsh

Process image:
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1116-1220-0_26.1116.1220.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe

Working directory:
D:\thinkbook\Desktop\jieya
```

Deletion process:

```text
PID:
34736

PowerShell version:
7.6.9

Process image:
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1116-1220-0_26.1116.1220.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe

Working directory:
D:\thinkbook\Desktop\jieya
```

No CMD or Bash wrapper executed the deletion.

## 4. Exact Target Path

Construction:

```powershell
$repo = 'D:\thinkbook\Desktop\jieya'
$targetRel = '$null' + [char]39
$p = [IO.Path]::Combine($repo, $targetRel)
```

Resolved:

```text
D:\thinkbook\Desktop\jieya\$null'
```

The normalized path matched the authorized literal path exactly.

## 5. Pre-delete Identity Verification

| Check | Required | Observed | Result |
|---|---|---|---|
| target exists | yes | yes | PASS |
| target is leaf | yes | yes | PASS |
| target is directory | no | no | PASS |
| Reparse Point | no | no | PASS |
| length | 0 | 0 | PASS |
| CreationTimeUtc | `2026-11-21T22:40:56.5319416Z` | same | PASS |
| File ID | `0x000000000000000000050000000209e9` | same | PASS |
| Volume Serial | `B46C803A` | same | PASS |
| Git state | exact untracked | `?? $null'` | PASS |

Identity result:

```text
EXACT TARGET IDENTITY MATCHED
```

No content read, hashing, stream access or metadata modification occurred.

## 6. Git Pre-delete State

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

Tracked modified:
26

Untracked:
255

Staged:
0

Deleted:
0
```

The exact target line was:

```text
?? $null'
```

It was not tracked, staged or modified.

## 7. Unique Deletion

The deletion child repeated every precondition immediately before the API call:

- process image is `pwsh.exe`;
- version is 7.6.9;
- cwd is the repository root;
- normalized path is exact;
- target is an existing leaf;
- no directory attributes;
- no Reparse Point;
- length is zero;
- CreationTime and File ID match;
- Volume Serial matches;
- Git target is exact untracked.

Then exactly one call was made:

```powershell
[IO.File]::Delete($p)
```

```text
Delete calls:
1

Child exit code:
0

Retry:
NO
```

No `Remove-Item`, CMD delete, wildcard, recursion or parent-directory
operation was used.

## 8. Post-delete Verification

```text
targetB_leaf_exists:
FALSE

targetB_container_exists:
FALSE

targetB_present_in_git:
FALSE

nullparen_exists:
FALSE
```

Git after deletion and before adding this report:

```text
Tracked modified:
26

Untracked:
254

Staged:
0

Deleted:
0

Root untracked:
$null
```

Adding this report returns the expected untracked count to 255.

## 9. Protected `$null`

No command in this stage:

- opened `$null`;
- read its content;
- read its data stream;
- calculated its hash;
- changed its times or attributes;
- deleted, truncated, moved or renamed it.

The deletion command's only file path was the exact `$null'` path.

The historical `$null` evidence remains a separate unresolved baseline
exception and is not re-approved by this deletion.

## 10. PFR and Protected Objects

PFR:

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

No `p13_native*` process was running.

## 11. Execution Deviations

One initial preflight attempt successfully checked target identity but failed
at Git status because `Get-Command git.exe` returned multiple executable
paths. It did not execute deletion.

The preflight was repeated in a new verified PowerShell 7.6.9 child with the
first application Git path selected explicitly. It passed all checks. No
target state changed during the failed attempt.

No other execution deviation occurred.

## 12. Final Decision

```text
PASS — EXACT AUTHORIZED ARTIFACT DELETED

Target identity:
MATCHED

Deletion:
ONE EXACT [IO.File]::Delete CALL

Post-delete:
ABSENT

Other protected objects:
UNCHANGED

`$null`:
KEPT / NOT READ / NOT HASHED / NOT MODIFIED

Git writes:
NONE
```

## 13. Report Integrity

This report cannot contain its own digest without changing its bytes. The
external SHA-256 is calculated after the final write.
