# P1-3 R6-BV4 `$null` Protected Baseline Exception Reassessment

## 0. Executive Summary

```text
Stage:
R6-BV4

Date:
2026-11-23

Mode:
READ-ONLY BASELINE REVIEW

Final Verdict:
BLOCKED — ACTUAL SHELL IDENTITY NOT VERIFIED

Current `$null` Metadata Verification:
NOT PERFORMED

Current `$null` Object Identity:
IDENTITY NOT VERIFIED

Current Content Integrity:
NOT VERIFIED

Current Hash:
NOT COMPUTED BY DESIGN

New Exception:
NOT ISSUED / PENDING EVIDENCE
```

The authorized shell gate names one exact executable:

```text
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1116-1220-0_26.1116.1220.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe
```

That exact path is no longer present. The authorization explicitly requires
this condition to stop the review and forbids fallback to another shell.

No `$null` metadata was read after this failure. No content was accessed and no
hash was calculated.

## 1. Authorization and Scope

Authorized:

- read historical BV1/BV2/R7/R8/BV3/BV3-A1 evidence;
- verify input hashes;
- verify current `$null` metadata through the named PowerShell 7.6.9 process;
- propose, but not approve, a new strictly scoped baseline exception.

Not authorized or performed:

- content read/hash/copy/export;
- timestamp, ACL or owner change;
- delete/move/rename/restore;
- shell fallback;
- PFR, Git, database, Storage or service changes;
- Build or Native Runtime.

## 2. Skills and Safety Route

The root `AGENTS.md` route was applied.

Skills actually read:

- `$security-audit`;
- `$testing-and-verification`;
- `$file-lifecycle`.

Their fail-closed, metadata-only and evidence-preservation rules were applied.

## 3. Actual Shell Identity Verification

Required executable:

```text
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1116-1220-0_26.1116.1220.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe
```

Existence check:

```text
Present:
NO
```

Because the explicitly approved executable path is absent, it was impossible
to start and verify a process meeting all required properties:

```text
exact executable path
PowerShell 7.6.9
actual PID
actual process image
actual cwd
```

The task explicitly forbids falling back to another PowerShell, Bash or CMD.
No fallback was attempted.

Gate result:

```text
BLOCKED — ACTUAL SHELL IDENTITY NOT VERIFIED
```

## 4. Input Evidence Reviewed

| Input | Expected | Actual | Result |
|---|---|---|---|
| R6-BV1 | `AAF113E8399D3F11A234AE0DF00E718AA5B0F0989801FDC0FC2B66C81C0F2A53` | same | PASS |
| R6-BV2 | `53706B12D6AA51922A6933C07D9B85EEFC70F1A5B7486DEAF803A466C043A588` | same | PASS |
| R7 design review | `A9951A0455AF3AC6D85DBA327271CB326192E5CA61BFC6FA62830786C84170BF` | same | PASS |
| R8 main | `6FAF4AF2638A9D6D41727049703DF3B0F240D0233A04AD7466679F84A44A27DA` | same | PASS |
| R8 decisions | `F2A539A6E8E2F35C82C7D040F8D98F0E5BB604FABD18BEF41ED5DE95F4FC4C40` | same | PASS |
| BV3 | `33BDAFEFA4254D86787B547DFBCA531300D7E6A64F6D5F74E415D285F3A868F0` | same | PASS |
| BV3-A1 | `5E4FD7AB24D1B54CD133F36D5563B316E736650D6334ABE0DC732C3BC82FE674` | same | PASS |

The historical evidence remains intact.

## 5. Historical Timeline

| UTC time | Event | Source |
|---|---|---|
| 2026-11-21T21:30:32.1057744Z | original `$null` object created at 0 bytes | BV1 |
| 2026-11-21T21:59:26.7885272Z | `$null` changed to 65 bytes | BV1 |
| 2026-11-21T22:12-22:20Z | BV1/BV2 review and `$null'` disposition | BV1/BV2 |
| 2026-11-21T22:28:49Z | R7 independent review recorded | R7 |
| 2026-11-21T22:34-22:37Z | R8 work and reports | R8 |
| 2026-11-21T22:36:19.4167564Z | second R8 `$null` LastWriteTime drift | BV3 |
| 2026-11-21T22:40:56.5319416Z | BV3-created `$null'` appeared | BV3 |
| 2026-11-23 | required pwsh path absent; BV4 shell gate blocked | BV4 |

The R8 timestamp change remains historically attributed to the `cmd.exe /c`
`2>$null` wrapper with PID 99560 in BV3. It is not re-attested as a current
identity or content-integrity fact because BV4 could not run the required
metadata check.

## 6. Current File Object Identity

```text
Current File ID:
IDENTITY NOT VERIFIED

Current Volume Serial:
IDENTITY NOT VERIFIED

Current Length:
NOT CHECKED IN BV4

Current CreationTimeUtc:
NOT CHECKED IN BV4

Current LastWriteTimeUtc:
NOT CHECKED IN BV4

Current LastAccessTimeUtc:
NOT QUERIED
```

No filesystem metadata API was run against `$null` after the shell gate failed.

Historical expected values remain:

```text
Length: 65 bytes
CreationTimeUtc: 2026-11-21T21:30:32.1057744Z
LastWriteTimeUtc: 2026-11-21T22:36:19.4167564Z
File ID: 0x000000000000000000210000000209cc
Volume Serial: B46C803A
```

These are historical references, not current assertions.

## 7. Content Integrity

```text
CURRENT CONTENT INTEGRITY:
NOT VERIFIED

CURRENT SHA-256:
NOT COMPUTED BY DESIGN

HISTORICAL SHA-256:
HISTORICAL HASH ONLY — NOT RECOMPUTED — CURRENT CONTENT INTEGRITY NOT VERIFIED

CONTENT EQUIVALENCE TO BV1:
NOT ESTABLISHED
```

BV1's value remains:

```text
42BD6E835C6EC8DCCE7454BCCA9C4F3AD94AF783BFE7D2D2CAA7609B0AEF77BB
```

It is not a current hash.

## 8. Previous Exception Validity

`APPROVED-BASELINE-EXCEPTION-R6-NULL-001` was accepted by R7 for the state it
reviewed.

BV3 then recorded a new LastWriteTime. R7's exact timestamp scope cannot cover
the later R8 write.

BV4 cannot determine whether the current object still matches BV3's expected
File ID, volume, creation time and LastWriteTime because the mandatory shell
identity gate failed.

Therefore:

```text
PREVIOUS EXCEPTION:
SUPERSEDED FOR CURRENT STATE

NEW EXCEPTION:
NOT ISSUED
```

## 9. Proposed Exception Status

`APPROVED-BASELINE-EXCEPTION-R6-NULL-002` cannot be recommended yet.

Its required exact scope would include:

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

Status:

```text
NOT PROPOSED FOR APPROVAL
BLOCKED PENDING SHELL AND METADATA REVERIFICATION
```

Even if later verified, a new exception could not claim current content
integrity or content equivalence to BV1.

## 10. Other Baseline Status

Because the shell gate failed before the permitted metadata process could
start, BV4 does not claim current:

- Git counts;
- PFR state;
- B1/B4 hashes;
- six protected-object hashes;
- `$null'` and `$null()` existence;
- `p13_native*` process state.

Those values must be re-acquired in a separately authorized retry using an
approved, replaced PowerShell executable path or an explicitly amended shell
verification instruction.

## 11. Remaining Unknowns

- Whether the current `$null` File ID and Volume Serial still match BV3.
- Whether current Length remains 65.
- Whether current CreationTime and LastWriteTime match BV3.
- Whether the file content changed after the BV1 hash.
- Whether the new LastWriteTime change is the only subsequent metadata change.
- Current Git/PFR/protected-object state.

## 12. Final Verdict

```text
BLOCKED — ACTUAL SHELL IDENTITY NOT VERIFIED
```

This is a shell-identity gate failure, not evidence that the current file
identity or content changed.

## 13. Next-Step Recommendation

1. The user/operator should confirm a new approved PowerShell executable path
   and version.
2. Rerun BV4 with that exact executable path and no shell fallback.
3. Use metadata-only access for File ID, volume, size, CreationTime and
   LastWriteTime.
4. Do not read LastAccessTime, content or a content hash.
5. If metadata matches BV3, recommend
   `APPROVED-BASELINE-EXCEPTION-R6-NULL-002` with content integrity explicitly
   unverified.

No exception is approved by this report.

## 14. Report Integrity

The external SHA-256 of this report is calculated after the final write.
