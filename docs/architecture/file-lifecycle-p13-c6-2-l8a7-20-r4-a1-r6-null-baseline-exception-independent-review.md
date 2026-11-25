# P1-3 R6 Null Baseline Exception Independent Review

## 0. Executive Result

```text
Exception ID:
APPROVED-BASELINE-EXCEPTION-R6-NULL-001

Review:
INDEPENDENT / READ-ONLY

Final Status:
ACCEPTED — DOCUMENTED HISTORICAL BASELINE EXCEPTION

Contents Re-verified in R7:
NO — CONTENTS NOT RE-VERIFIED DURING R7 BY DESIGN

Additional Protected Baseline Change:
NONE OBSERVED
```

The exception is accepted only for the exact file and metadata scope in this
report. It is not a general permission to create literal `$null` files or to
ignore future root-directory drift.

## 1. Scope

Exact protected path:

```text
D:\thinkbook\Desktop\jieya\$null
```

Exact absent paths:

```text
D:\thinkbook\Desktop\jieya\$null'
D:\thinkbook\Desktop\jieya\$null()
```

The review verifies:

- BV1/BV2 evidence integrity;
- current path metadata;
- historical write attribution;
- BV2 exact deletion of `$null'`;
- Git and protected-object state.

The review does not:

- read `$null` content;
- calculate a new `$null` SHA-256;
- open its data stream;
- change content, ACL, owner, timestamps or path;
- recreate, truncate, move or delete `$null`;
- hash or inspect `$null'`.

## 2. Input Hashes

| Input | Expected | Actual | Result |
|---|---|---|---|
| BV1 | `AAF113E8399D3F11A234AE0DF00E718AA5B0F0989801FDC0FC2B66C81C0F2A53` | same | PASS |
| BV2 | `53706B12D6AA51922A6933C07D9B85EEFC70F1A5B7486DEAF803A466C043A588` | same | PASS |
| R6 main | `5C608DC6A3F51B3A029B70601B6A8FCD771CA56EF032F82E8EB482E4396732CD` | same | PASS |
| R6 decisions | `6A08221433471FB7743A3063355626A2D359B0E27E5512A3957E027756BE3C2B` | same | PASS |

## 3. Evidence Chain

### 3.1 Original creation

BV1 identified:

```text
UTC:
2026-11-21T21:30:32

Codex command:
exec_command with shell="bash"

Actual wrapper:
cmd.exe /c rg ... 2>$null

Process ID:
14988

Exit:
1

File result:
0-byte literal `$null` in repository root
```

The creation timestamp and command execution share the same second. The root
cause is confirmed by the Codex execution record and the file metadata.

### 3.2 R6 write

BV1 identified:

```text
UTC:
2026-11-21T21:59:26

Codex command:
exec_command with shell="bash"

Actual wrapper:
cmd.exe /c ... 2>$null

Process ID:
24091

Exit:
1

File result:
65 bytes
```

The file LastWriteTime is:

```text
2026-11-21T21:59:26.7885272Z
```

This is mutually corroborating with the Codex item completion at
`2026-11-21T21:59:26.821Z`.

### 3.3 Historical content hash

BV1 recorded:

```text
42BD6E835C6EC8DCCE7454BCCA9C4F3AD94AF783BFE7D2D2CAA7609B0AEF77BB
```

This remains historical evidence only. R7 did not recalculate it.

### 3.4 BV2 disposition

BV2:

- preserved `$null`;
- deleted `$null'` exactly once;
- confirmed `$null'` absent;
- did not read the target content;
- did not modify `$null`.

The BV2 report hash matches.

## 4. Current Metadata

Metadata-only check:

```text
Path:
D:\thinkbook\Desktop\jieya\$null

Exists:
YES

Type:
regular file

Length:
65 bytes

CreationTimeUtc:
2026-11-21T21:30:32.1057744Z

LastWriteTimeUtc:
2026-11-21T21:59:26.7885272Z

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

The File ID, Volume Serial, Creation Time, Last Write Time and size match the
BV1/BV2 evidence.

The known BV1 LastAccessTime behavior remains historical:

```text
Hash before: 22:02:50.7941340Z
Hash after:  22:06:50.1649452Z
```

No timestamp was restored or normalized.

## 5. Exception Scope

Accepted only for:

```text
Path:
D:\thinkbook\Desktop\jieya\$null

Volume Serial:
B46C803A

File ID:
0x000000000000000000210000000209cc

Size:
65 bytes

CreationTimeUtc:
2026-11-21T21:30:32.1057744Z

LastWriteTimeUtc:
2026-11-21T21:59:26.7885272Z

Historical SHA-256:
42BD6E835C6EC8DCCE7454BCCA9C4F3AD94AF783BFE7D2D2CAA7609B0AEF77BB
```

The exception does not cover:

- any other filename;
- any other repository-root artifact;
- future writes to `$null`;
- contents revalidated in R7;
- Git tracking of the file;
- deletion or truncation authorization.

## 6. Reasons for Acceptance

The exception is accepted because:

1. The write origin is independently corroborated by Codex command records,
   the wrapper `cmd.exe /c`, PIDs, timestamps and File metadata.
2. The file is confined to a single exact path and one File ID on one volume.
3. The file is untracked and not part of source/build inputs.
4. The file's current size and stable times match the historical record.
5. BV2 preserved the target and removed the additional artifact exactly.
6. Other protected objects and historical build artifacts remain unchanged.
7. The content-hash limitation is explicitly recorded rather than overstated.

This is an evidence-supported historical exception, not a claim that the file
is safe to execute or that its current content has been re-verified.

## 7. `$null'` and `$null()`

Exact path:

```text
D:\thinkbook\Desktop\jieya\$null'
```

Current result:

```text
ABSENT
```

Exact path:

```text
D:\thinkbook\Desktop\jieya\$null()
```

Current result:

```text
ABSENT
```

No wildcard or directory search was used to make these checks.

## 8. Git and Protected Baseline

Before adding the two R7 reports:

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

Root untracked:
$null
```

The two R7 reports bring the expected untracked count to 251.

PFR:

```text
46 strings
23 DELETE
0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC
```

B1/B4 and six protected objects remain unchanged.

No `p13_native*` process was running.

## 9. Risk and Conditions

Accepted residual risks:

- the unread 65-byte content remains unknown;
- LastAccessTime reflects historical investigation;
- full-host backups can restore both artifact and historical evidence state;
- the file is an approved baseline exception, not a clean baseline.

Conditions:

- no future `2>$null`/CMD/Bash syntax mixing;
- no file execution;
- no Git add;
- no content inspection without separate authorization;
- no changes to the exact file object without a new exception review;
- independently re-evaluate if size, File ID, Volume Serial, Creation Time or
  LastWriteTime changes.

## 10. Final Status

```text
Baseline Exception:
ACCEPTED — DOCUMENTED HISTORICAL BASELINE EXCEPTION

Scope:
EXACT PATH / FILE ID / VOLUME / SIZE / TIMES / HISTORICAL HASH

Contents Re-verified During R7:
NOT VERIFIED — CONTENTS NOT RE-VERIFIED DURING R7 BY DESIGN

Additional Baseline Drift:
NONE OBSERVED

Target Disposition:
KEEP
```

## 11. Report Integrity

This report cannot contain its own final digest without changing its bytes. The
external SHA-256 is calculated after the final write.
