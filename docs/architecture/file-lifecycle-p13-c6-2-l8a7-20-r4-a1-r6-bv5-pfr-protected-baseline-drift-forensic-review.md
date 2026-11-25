# P1-3 C-6.2-L8-A7.20-R4-A1-R6-BV5
# PFR Protected Baseline Drift Forensic Review

## 0. Executive Summary

```text
Stage:
C-6.2-L8-A7.20-R4-A1-R6-BV5

Review mode:
INDEPENDENT / READ-ONLY FORENSIC REVIEW

Date:
2026-11-23

Overall:
PASS WITH WARNINGS — PFR DIFF EXPLAINED, APPROVAL EVIDENCE INCOMPLETE

Historical PFR:
46 strings / 23 DELETE / 0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC

Current PFR:
38 strings / 19 DELETE / 8EE40F3606C888B3A0C93E2256D572595339785E99EF0F51EC85B36594097F3F

Exact entry-level diff:
ESTABLISHED

PFR change authorization:
NOT FOUND IN REVIEWED EVIDENCE

Current 38/19 baseline:
CANDIDATE ONLY — NOT APPROVED

P0:
0

P1:
0

P2:
1

P3:
2

Native RPC Runtime:
NOT EXECUTED

Git writes:
NOT EXECUTED
```

The PFR is not a repository file. It is the system registry value:

```text
HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Session Manager
Value name: PendingFileRenameOperations
Value type: REG_MULTI_SZ / MultiString
```

The current value was independently read inside a directly launched,
PowerShell 7.6.9 child process. It contains 38 strings, 19 empty destinations,
19 pairs and 19 DELETE operations. Its ordered-array digest matches the BV4-R1
value exactly.

The historical 46-string ordered list is embedded completely in D1. Rebuilding
the 23 source/empty-destination pairs from that table and applying the
repository's established UTF-16LE/NUL ordered-array encoding reproduces the
historical SHA-256 exactly.

The reduction from 46 to 38 is not an exact deletion of eight strings and four
operations. The exact operation-level change is:

```text
Historical-only operations: 22
Current-only operations:     18
Exact common operations:      1
Net operation difference:    -4
```

The historical-only set consists of the 18 prior CrossDevice cache paths under
GUID `951524D9-92E3-43B3-B19E-3DF3B63EB513` plus the four Visual Studio
installer cleanup paths appended after installation. The current-only set
consists of 18 CrossDevice cache paths under a new GUID,
`44B834FC-A6CF-4291-8C5F-EB8D2E164039`. PFR-001 for
`gamingservicesproxy_17.dll.0` is the sole exact common operation.

The strongest evidence-backed explanation is normal Windows boot processing of
the old deletion queue followed by CrossDevice recreation of its cache and
registration of a new deletion batch:

```text
R8 last recorded 46-string state:
No later than 2026-11-21T22:37:59Z

Successful power-off:
2026-11-21T22:52:21Z

Next successful boot:
2026-11-22T19:40:24.500Z

CrossDeviceResume started:
2026-11-23T03:40:52 local = 2026-11-22T19:40:52Z

CrossDeviceService started:
2026-11-23T03:40:54 local = 2026-11-22T19:40:54Z

BV4-R1 observed 38/19:
Before its report write at 2026-11-22T20:01:33Z
```

All four Visual Studio PFR targets that existed before the boot are now absent.
This corroborates that the pending deletes were consumed rather than merely
rewritten out of the registry. There is no direct Windows registry-write audit
event proving the exact CrossDevice write call, so process attribution remains
`STRONGLY SUPPORTED`, not `CONFIRMED`.

No reviewed authorization permits a PFR clearing, rebuild, reduction or new
38-string baseline. The one-time scoped exception authorized only the then
current 38 strings / 19 DELETE queue and expressly prohibited modifying or
clearing PFR. The later four installer entries were explicitly unapproved. The
current 18 CrossDevice entries also have a different GUID and different complete
digest from the formerly exception-covered queue. The current state therefore
cannot inherit that exception.

## 1. Authorization and Scope

Allowed:

- read project rules, reports, source, manifests and relevant Codex records;
- inspect the canonical PFR registry value;
- compute the current PFR logical digest;
- reconstruct the complete historical ordered inventory from D1;
- inspect existing OS event logs and process metadata;
- perform read-only Git queries;
- verify protected object hashes;
- add this one report.

Not performed:

- PFR write, clear, restore, import, export or regeneration;
- creation of a PFR snapshot file;
- Native build, MIDL, compiler, linker or test execution;
- Native RPC server, client or test execution;
- database, Storage, service, ACL, IAM or audit-policy changes;
- Git add, commit, reset, restore, clean, checkout or stash;
- reading, hashing or modifying the protected `$null` file;
- creation, deletion or modification of `$null'` or `$null()`.

Only this report was added. No historical report was modified.

## 2. Skills Invoked

The root `AGENTS.md` routing and safety rules were applied.

The following skills were read and used:

- `$project-architecture`
- `$security-audit`
- `$testing-and-verification`
- `$file-lifecycle`

Their use affected the review in the following ways:

- `$project-architecture`: separated the canonical registry object from
  repository artifacts and report-embedded representations;
- `$security-audit`: treated PFR data as untrusted evidence, required a
  read-only trust boundary, and separated confirmed from inferred attribution;
- `$testing-and-verification`: independently recomputed counts and hashes,
  recorded exact commands/results, and preserved failed or unverified checks;
- `$file-lifecycle`: required exact object identity and fail-closed treatment of
  filesystem/system cleanup evidence rather than accepting counters alone.

## 3. Materials Reviewed

PFR-specific or directly relevant materials reviewed:

- R4-A1-R3-R1 pending-operations readiness audit;
- R4-A1-R3-R2 post-reboot preflight;
- R4-A1-R3-R3 CrossDevice/Gaming Services investigation;
- R4-A1-R3-R4 installation-risk reassessment;
- R4-A1-R3-R5 controlled toolchain installation report;
- R4-A1-R3-R6 post-install reconciliation;
- R4-A1-R4-D1 architecture/build plan, including the complete PFR table;
- R4-A1-R4-B1 build report;
- R4-A1-R4-B4 remediation/build report;
- R4-A1-R4-B5 independent review;
- R5-R1 readiness review;
- R5-R2 through R8 design/review reports;
- R6-BV1, BV2, BV3, BV3-A1, BV4 and BV4-R1;
- current build guards and manifests containing the historical PFR digest;
- currently available Codex session JSONL records and the user-provided stage
  attachments containing PFR constraints or dispositions.

No standalone PFR snapshot file or Git blob was found. The only complete
historical ordered representation found is the D1 table.

## 4. Actual Shell Identity Verification

### 4.1 Candidate discovery

Candidate discovery was performed without Bash or CMD. One PowerShell 7.6.9
candidate was found:

```text
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe
```

The obsolete fixed runtime path from the earlier BV4 attempt was not used.

External file metadata:

```text
FileVersion:    7.6.9.500
ProductVersion: 7.6.9
```

### 4.2 Direct launch and external gate

The gate launch used `CreateProcessW` semantics with the absolute executable as
the explicit application image. It did not use CMD, Bash, WSL or
`ShellExecute`.

Verified gate data:

```text
Parent launcher PID:       34848
Child PID:                 33400
Child parent PID:          34848
Actual image path:         exact candidate path
Child creation UTC:        2026-11-22T20:04:52.2766921Z
PSVersion:                 7.6.9
PSEdition:                 Core
Exit code:                 0
```

Shell identity gate:

```text
PASS
```

### 4.3 Final current-value re-read

The final PFR re-read used direct `System.Diagnostics.ProcessStartInfo` launch
with:

- `UseShellExecute = false`;
- absolute `FileName`;
- `-NoProfile -NonInteractive`;
- no CMD, Bash or shell command wrapper.

Observed:

```text
Parent PID:          36776
Child PID:           14408
Child parent PID:    36776
Creation UTC:        2026-11-22T20:09:34.0287497Z
Child image:         exact candidate path
Child PSVersion:     7.6.9
Child PSEdition:     Core
Exit code:           0
Standard error:      empty
```

The child's self-report of image path and version matches the externally
verified gate executable and version. This is the process that read and hashed
the current PFR value.

After this report was written, a second direct child re-read at
`2026-11-22T20:12:02Z` returned PID `36404`, exact candidate image path,
PSVersion `7.6.9`, PSEdition `Core`, exit code `0`, 38 strings, 19 empty
destinations and the identical digest `8EE40F3606C888B3A0C93E2256D572595339785E99EF0F51EC85B36594097F3F`.
This confirms that the PFR value remained stable across report creation.

### 4.4 Shell-discipline deviation during the review

Three read-only analysis commands were accidentally submitted with a
`shell: "bash"` request even though their payload contained PowerShell syntax.
The actual wrapper was not Bash; each invocation failed before the intended
command ran and returned exit code `255`. None contained a redirection, none
accessed PFR, and none created or modified a file.

This is recorded as `P3-02`. It did not invalidate the separately verified
PowerShell child used for all canonical PFR reads, but reinforces that tool
shell labels must not be treated as process identity evidence.

## 5. PFR Canonical File/Object Identity

There is no canonical PFR file path. The canonical object is the registry value:

```text
Registry key:
HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Session Manager

Value name:
PendingFileRenameOperations

Value type:
REG_MULTI_SZ / MultiString
```

Consequences:

```text
File ID:                   NOT APPLICABLE — REGISTRY VALUE
Volume serial:             NOT APPLICABLE — REGISTRY VALUE
File length:               NOT APPLICABLE — REGISTRY VALUE
CreationTimeUtc:           NOT EXPOSED BY STANDARD REGISTRY API
LastWriteTimeUtc:          NOT EXPOSED BY STANDARD REGISTRY API
Reparse-point state:       NOT APPLICABLE — REGISTRY VALUE
Git tracking:              NO
NTFS USN Journal match:    NOT APPLICABLE — PFR IS NOT AN NTFS FILE RECORD
```

The object's stable identity for this review is the exact registry key plus
value name and value type. No file-based identity claim is made.

## 6. Current PFR Raw SHA-256 and Count Verification

The current value was read in original order. Every pair was preserved.

```text
Value type:              REG_MULTI_SZ
Strings:                 38
Empty destination strings: 19
Pairs:                   19
DELETE operations:       19
Rename/move/replace:      0
Malformed pairs:          0

Ordered-array SHA-256:
8EE40F3606C888B3A0C93E2256D572595339785E99EF0F51EC85B36594097F3F

Expected BV4-R1 SHA-256:
8EE40F3606C888B3A0C93E2256D572595339785E99EF0F51EC85B36594097F3F

Result:
MATCH
```

Digest definition:

```text
SHA-256 over:
UTF-16LE / PowerShell Unicode encoding of
(strings in original order joined by one NUL character)
```

This is the logical PFR digest historically used by the project. It is not the
raw registry-value byte stream and does not add the terminating NUL characters
that a native `REG_MULTI_SZ` buffer contains.

```text
RAW FILE BYTE SHA-256:
NOT APPLICABLE — PFR IS A REGISTRY VALUE

RAW NATIVE REGISTRY BUFFER SHA-256:
NOT COMPUTED
```

No claim is made that the logical digest is a raw registry binary digest.

### 6.1 Current ordered inventory

All destinations are empty, so each pair is DELETE.

| ID | Source |
|---|---|
| CUR-001 | `*1\??\C:\Windows\System32\gamingservicesproxy_17.dll.0` |
| CUR-002 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\44B834FC-A6CF-4291-8C5F-EB8D2E164039\blob_storage\621cad11-4b83-4c75-b56b-e701b0d5e63e` |
| CUR-003 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\44B834FC-A6CF-4291-8C5F-EB8D2E164039\blob_storage` |
| CUR-004 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\44B834FC-A6CF-4291-8C5F-EB8D2E164039\Cache\Cache_Data` |
| CUR-005 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\44B834FC-A6CF-4291-8C5F-EB8D2E164039\Cache` |
| CUR-006 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\44B834FC-A6CF-4291-8C5F-EB8D2E164039\Code Cache\js\index-dir` |
| CUR-007 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\44B834FC-A6CF-4291-8C5F-EB8D2E164039\Code Cache\js` |
| CUR-008 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\44B834FC-A6CF-4291-8C5F-EB8D2E164039\Code Cache\wasm\index-dir` |
| CUR-009 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\44B834FC-A6CF-4291-8C5F-EB8D2E164039\Code Cache\wasm` |
| CUR-010 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\44B834FC-A6CF-4291-8C5F-EB8D2E164039\Code Cache` |
| CUR-011 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\44B834FC-A6CF-4291-8C5F-EB8D2E164039\Dictionaries` |
| CUR-012 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\44B834FC-A6CF-4291-8C5F-EB8D2E164039\Local Storage\leveldb` |
| CUR-013 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\44B834FC-A6CF-4291-8C5F-EB8D2E164039\Local Storage` |
| CUR-014 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\44B834FC-A6CF-4291-8C5F-EB8D2E164039\Network` |
| CUR-015 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\44B834FC-A6CF-4291-8C5F-EB8D2E164039\Session Storage` |
| CUR-016 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\44B834FC-A6CF-4291-8C5F-EB8D2E164039\Shared Dictionary\cache\index-dir` |
| CUR-017 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\44B834FC-A6CF-4291-8C5F-EB8D2E164039\Shared Dictionary\cache` |
| CUR-018 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\44B834FC-A6CF-4291-8C5F-EB8D2E164039\Shared Dictionary` |
| CUR-019 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\44B834FC-A6CF-4291-8C5F-EB8D2E164039\WidevineCdm` |

Existence-only follow-up:

```text
CUR-001 source: EXISTS
CUR-002 through CUR-019 sources: ABSENT
```

Absence does not remove a queued delete; it means the eventual boot operation
would be a no-op for those paths.

## 7. Historical PFR Evidence and Provenance

### 7.1 Raw snapshot availability

```text
Standalone historical PFR file:       NOT FOUND
Historical Git blob:                  NOT FOUND
Exported native registry buffer:      NOT FOUND
Complete report-embedded operation table: FOUND — R4-A1-R4-D1
```

D1 lines 1015–1080 define the historical 46-string queue, its pair semantics,
the digest algorithm, the expected digest and the complete ordered table.

### 7.2 Independent historical digest reconstruction

The 23 D1 table rows were parsed in memory without creating a snapshot file.
Every source was paired with an empty destination in original order. The exact
same UTF-16LE/NUL ordered-array encoding was applied.

```text
Parsed operations:       23
Parsed strings:          46
Empty destinations:      23
Recomputed SHA-256:
0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC

Expected:
0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC

Result:
MATCH
```

This proves that D1's complete table is sufficient to reconstruct the exact
historical logical string array represented by the historical digest. It does
not create or prove availability of a raw registry-buffer snapshot.

### 7.3 Historical install transition

R3-R2 documented the post-reboot state before Build Tools installation:

```text
38 strings / 19 DELETE
54CC89DA4697363393AE7A956AF3FD689B8B3D10926955849995CD44CC286E84
```

R3-R5 and R3-R6 documented the post-install state:

```text
46 strings / 23 DELETE
0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC
```

The first 38 strings retained the former digest
`54CC89DA4697363393AE7A956AF3FD689B8B3D10926955849995CD44CC286E84`.
The installer appended exactly four DELETE pairs:

- PFR-020 — Visual Studio bootstrap metadata;
- PFR-021 — `DEL7D6C.tmp`;
- PFR-022 — `DEL7D7D.tmp`;
- PFR-023 — `DEL7D7E.tmp`.

Those four were explicitly recorded as:

```text
UNAPPROVED / NOT INCLUDED IN ANY EXCEPTION
```

### 7.4 Historical ordered inventory

| ID | Source | Destination |
|---|---|---|
| PFR-001 | `*1\??\C:\Windows\System32\gamingservicesproxy_17.dll.0` | empty |
| PFR-002 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\blob_storage\6cd4d849-6aff-49ec-aa55-b95de5392320` | empty |
| PFR-003 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\blob_storage` | empty |
| PFR-004 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Cache\Cache_Data` | empty |
| PFR-005 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Cache` | empty |
| PFR-006 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Code Cache\js\index-dir` | empty |
| PFR-007 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Code Cache\js` | empty |
| PFR-008 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Code Cache\wasm\index-dir` | empty |
| PFR-009 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Code Cache\wasm` | empty |
| PFR-010 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Code Cache` | empty |
| PFR-011 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Dictionaries` | empty |
| PFR-012 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Local Storage\leveldb` | empty |
| PFR-013 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Local Storage` | empty |
| PFR-014 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Network` | empty |
| PFR-015 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Session Storage` | empty |
| PFR-016 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Shared Dictionary\cache\index-dir` | empty |
| PFR-017 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Shared Dictionary\cache` | empty |
| PFR-018 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\Shared Dictionary` | empty |
| PFR-019 | `*2\??\C:\Users\THINKB~1\AppData\Local\Temp\devicecenter\cache\951524D9-92E3-43B3-B19E-3DF3B63EB513\WidevineCdm` | empty |
| PFR-020 | `*1\??\C:\ProgramData\Microsoft\VisualStudio\Packages\_bootstrapper\vs_setup_bootstrapper_202611212157011555.json` | empty |
| PFR-021 | `*1\??\C:\Users\thinkbook\AppData\Local\Temp\DEL7D6C.tmp` | empty |
| PFR-022 | `*1\??\C:\Users\thinkbook\AppData\Local\Temp\DEL7D7D.tmp` | empty |
| PFR-023 | `*1\??\C:\Users\thinkbook\AppData\Local\Temp\DEL7D7E.tmp` | empty |

## 8. Historical vs Current Semantic Diff

### 8.1 String multiset

```text
Historical strings:       46
Current strings:          38
Net string difference:    -8

Historical-only strings:  26
Current-only strings:     18
Common string multiset:   20
```

The 20 common strings are:

- the one exact `gamingservicesproxy_17.dll.0` source; and
- 19 empty destination strings.

The repeated empty destination is intentionally counted as a multiset. Treating
strings as a unique set would produce the wrong result.

### 8.2 Operations

```text
Historical operations:      23
Current operations:         19
Net operation difference:   -4

Historical-only operations: 22
Current-only operations:    18
Exact common operations:     1
```

Therefore:

```text
"EXACTLY 8 STRINGS AND 4 OPERATIONS WERE DELETED"
IS FALSE.

"THE MULTISET/RECORD COUNTS NET DECREASED BY 8 STRINGS AND 4 OPERATIONS"
IS TRUE.
```

There were both removals and additions. The counts alone do not describe the
change.

### 8.3 Ordering and replacement

- PFR-001 remains in first position and has the same source and empty
  destination.
- The 18 historical CrossDevice paths under GUID
  `951524D9-92E3-43B3-B19E-3DF3B63EB513` are absent.
- The 18 current CrossDevice paths use the same relative cache layout,
  but GUID `44B834FC-A6CF-4291-8C5F-EB8D2E164039`.
- Those 18 paths are therefore changed/replaced operations rather than 18
  wholly unrelated filesystem objects.
- The four Visual Studio operations formerly at the tail are absent.
- No non-empty destination, rename, move or replace operation exists in either
  observed state.

Exact entry-level diff:

```text
ESTABLISHED
```

## 9. Missing Strings Inventory

Historical-only strings:

- PFR-002 through PFR-019: 18 source strings;
- PFR-020 through PFR-023: four source strings;
- four excess empty destination strings associated with those removed
  operations.

Total:

```text
26 historical-only strings
```

Current-only strings:

- CUR-002 through CUR-019: 18 new GUID-specific source strings.

Total:

```text
18 current-only strings
```

There are no order-only changes among exact common operations.

## 10. DELETE Inventory and Difference

All 23 historical and all 19 current operations are DELETE because each
destination is the empty string.

| Class | Historical | Current | Difference |
|---|---:|---:|---:|
| Gaming Services proxy delete | 1 | 1 | exact match |
| Old-GUID CrossDevice cache deletes | 18 | 0 | removed |
| New-GUID CrossDevice cache deletes | 0 | 18 | added |
| Visual Studio installer cleanup deletes | 4 | 0 | removed |
| Other DELETE | 0 | 0 | none |
| Non-DELETE | 0 | 0 | none |
| Total DELETE | 23 | 19 | net −4 |

Current filesystem follow-up:

| Operation family | Existing sources |
|---|---:|
| Gaming Services proxy | 1 |
| New-GUID CrossDevice cache | 0 |
| Visual Studio installer cleanup | 0 |

The absence of the four Visual Studio files that existed before the successful
boot is consistent with boot-time completion of PFR-020 through PFR-023.

## 11. PFR Change Timeline

All timestamps below are UTC unless explicitly marked local.

| Time | Evidence | Observation |
|---|---|---|
| 2026-11-21T13:26:02Z | System event 1074, record 145832 | Restart initiated by Start Menu Experience Host |
| 2026-11-21T13:26:10Z | System event 6006, record 145838 | Event Log service stopped |
| 2026-11-21T13:27:06Z | System events 6005/6013, records 145847/145848 | Boot completed |
| 2026-11-21 post-boot | R3-R2 | PFR 38/19, hash `54CC89DA...` |
| 2026-11-21T13:57–14:04Z | MsiInstaller/Restart Manager logs; R3-R5/R3-R6 | Visual Studio Build Tools installation |
| 2026-11-21T14:10:27Z | R3-R5 report metadata | PFR 46/23, hash `0FF69EDF...` |
| 2026-11-21T14:17:01Z | R3-R6 report metadata | PFR 46/23 stable during reconciliation |
| 2026-11-21T15:54:50Z | B1 report metadata | PFR remained 46/23 through B1 |
| 2026-11-21T16:40:14Z | B4 report metadata | PFR remained 46/23 through B4 |
| 2026-11-21T16:46:36Z | B5 report metadata | PFR remained 46/23 through B5 |
| 2026-11-21T21:34:13Z | R5-R2-R2-R5 report metadata | No PFR write; historical baseline retained |
| 2026-11-21T21:57:46Z | R6 design report metadata | No PFR change; 46/23 recorded |
| 2026-11-21T22:28:49Z | R7 and companion baseline reports | Last reviewed report set that records 46/23 |
| 2026-11-21T22:34–22:37Z | R8 report metadata | No intentional PFR change; 46/23 inherited/retained |
| 2026-11-21T22:52:21Z | System event 1074, record 146256 | Successful power-off initiated by Start Menu Experience Host |
| 2026-11-21T22:52:26Z | System event 6006, record 146262 | Event Log service stopped |
| 2026-11-22T19:40:24.500Z | Kernel-General event 12, record 146285 | Next operating-system boot |
| 2026-11-22T19:40:25Z | Kernel-Boot event 20, record 146290 | Prior shutdown and this boot both successful |
| 2026-11-22T19:40:52Z | Process metadata | `CrossDeviceResume.exe` started |
| 2026-11-22T19:40:54Z | Process metadata | `CrossDeviceService.exe` started |
| 2026-11-22T19:44:48Z | BV4 report metadata | Shell gate blocked before PFR reassessment |
| By 2026-11-22T20:01:33Z | BV4-R1 | Current PFR observed as 38/19, hash `8EE40F...` |
| 2026-11-22T20:09:34Z | BV5 direct child | Current PFR independently reproduced as 38/19, hash `8EE40F...` |

The bounded change window is therefore after the last reviewed 46/23
observation and before BV4-R1. The concrete shutdown/boot boundary inside that
window is directly evidenced.

## 12. Shell / Process / Command Attribution

### 12.1 Boot-time consumption

Evidence:

- successful power-off and next boot events;
- historical PFR consists entirely of deferred DELETEs;
- all four Visual Studio source files present at installation are now absent;
- PFR-001 remains, matching its long-standing delete-failure behavior;
- exactly 18 new CrossDevice cache deletes are present from the new boot.

Attribution:

```text
STRONGLY SUPPORTED
```

There is no per-entry Windows event stating "PFR executed this delete", so this
is not marked `CONFIRMED`.

### 12.2 CrossDevice recreation

Evidence:

- `CrossDeviceResume.exe` and `CrossDeviceService.exe` start after the boot;
- current paths are under the CrossDevice temporary cache;
- the relative cache layout matches the 18 historical CrossDevice operations;
- the GUID changed, consistent with recreation of a session-specific cache;
- the new cache root exists.

Attribution:

```text
STRONGLY SUPPORTED
```

No registry-write audit event directly identifies the process performing the
write, so direct process attribution is not `CONFIRMED`.

### 12.3 Visual Studio installer

The installer is confirmed as the source of the four operations appended on
2026-11-21; R3-R5/R3-R6 documented that transition and explicitly marked the
four entries unapproved.

For the current disappearance of those four operations:

```text
STRONGLY SUPPORTED — CONSUMED BY THE LATER BOOT
```

### 12.4 BV4-R1

```text
NOT SUPPORTED
```

BV4-R1 first observed the new state. The reviewed report explicitly records no
PFR repair or change. Detection time is not causation.

### 12.5 Reviewed Codex commands

```text
PFR MODIFICATION BY REVIEWED CODEX COMMAND:
NOT SUPPORTED
```

The available historical session JSONL did not contain a PFR registry-write
command for the later stage. The attachments and reports consistently forbid
PFR modification. Current coverage is incomplete because not every historical
interactive execution stream is present as durable session JSONL.

### 12.6 Manual registry edit or external process

```text
UNKNOWN
```

No direct command, registry-write security event, or process-creation audit
links a manual editor or other external program to the exact write.

### 12.7 OS evidence availability

Read-only OS evidence:

- System reboot/shutdown/boot records: AVAILABLE;
- process metadata: AVAILABLE;
- Application/AppModel events: AVAILABLE;
- Windows Security event log: `NOT AVAILABLE — ACCESS DENIED`;
- registry object-write audit: `NOT AVAILABLE — AUDITING NOT ENABLED OR ACCESS DENIED`;
- USN Journal: `NOT APPLICABLE — REGISTRY VALUE`;
- registry value LastWriteTime: `NOT EXPOSED BY STANDARD REGISTRY API`.

Absence of a registry-write audit event is not evidence that no write occurred.

## 13. Authorization Chain Review

### 13.1 Reviewed scoped exception

The one-time scoped PFR exception authorized the existing 19 DELETE operations
with exact ordered digest:

```text
54CC89DA4697363393AE7A956AF3FD689B8B3D10926955849995CD44CC286E84
```

It expressly stated:

- do not clean or modify the current PFR;
- do not delete or modify the Gaming Services file;
- do not delete or modify CrossDevice cache;
- do not extend the exception to future PFR operations;
- the exception becomes invalid if PFR changes.

### 13.2 Later installer additions

PFR-020 through PFR-023 were appended after installation and were treated as:

```text
UNAPPROVED / NOT INCLUDED IN ANY EXCEPTION
```

No reviewed instruction authorized them retroactively.

### 13.3 Current state

The current value:

- does not have the formerly approved ordered digest;
- contains a new CrossDevice GUID;
- contains 18 new current-only operations;
- no longer contains the four appended installer operations;
- is a new protected system state.

The old scoped exception cannot be inherited by the current value.

```text
PFR CHANGE AUTHORIZATION:
NOT FOUND IN REVIEWED EVIDENCE
```

This statement is limited to the reviewed repository reports, available Codex
records and user-provided instructions. It is not a claim that all historical
activity on the host has been exhausted.

No direct evidence establishes an unauthorized human registry edit. Therefore:

```text
FAIL — UNAUTHORIZED PFR MODIFICATION CONFIRMED
```

is not selected.

## 14. Git Read-only Evidence

Git was invoked through an absolute native executable:

```text
C:\Program Files\Git\cmd\git.exe
```

All queries used:

```text
-C D:\thinkbook\Desktop\jieya
-c safe.directory=D:\thinkbook\Desktop\jieya
--no-optional-locks
```

Before this report:

```text
Branch:             feature/p1-3-storage-lifecycle-schema
HEAD:               b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified:   26
Untracked files:    257
Staged:             0
Deleted:            0
```

PFR:

```text
Git tracked:        NO
Git historical blob: NOT FOUND
Git diff:           NOT APPLICABLE
```

No Git write command was run.

After adding this report, the expected untracked-file count is 258.

## 15. Other Protected Baseline Status

### 15.1 B1 artifacts

| Artifact | Length | SHA-256 | Result |
|---|---:|---|---|
| `bin/x64/p13_native_rpc_server.exe` | 352768 | `A1169E2F6882BE5CA6F7D18C435DDA77E0F78A15467DE3C3A3271ABE241E38A5` | MATCH |
| `bin/x64/p13_native_rpc_client.exe` | 184320 | `C86BE3839F414A8CE95DFC4312878EA598BE1FEC4A53AE254E943573897B4C6A` | MATCH |
| `manifest/build-manifest.json` | 6214 | `DC164B09C1D16C7CAEB46B3785CA3806C703300C2535A39B471F7D08039FE2FF` | MATCH |
| `logs/static-review/static-verification.json` | 9054 | `D10DE78D2B1736542AB3B4879ADABEA11A216CFEE6E535012A61D71F7218251D` | MATCH |

### 15.2 B4 artifacts

| Artifact | Length | SHA-256 | Result |
|---|---:|---|---|
| `bin/r4-b4/x64/p13_native_rpc_server.exe` | 465920 | `324D1C06BB5452FCE982119E3985AE5AB5B5A41A2D06013A709ECCD2266EEFB3` | MATCH |
| `bin/r4-b4/x64/p13_native_rpc_client.exe` | 194560 | `D7BFF66F519B3B3544D8D0CC3858567B1B4CE64BCEFC1C5DFB7DFFEC6BEBCD49` | MATCH |
| `bin/r4-b4/x64/p13_native_tests.exe` | 591872 | `AA2636BE8B53E26E79131E2C17FC863A6792D99976C01ED3A76EA7B5AF7EF3FA` | MATCH |
| `manifest/r4-b4/build-manifest.json` | 12447 | `58ED3EAFF2498AFA44D4E1D92FD2CA43DD86CBA57E5E7B93B4B97204E8B79774` | MATCH |
| `logs/r4-b4/static-review/static-verification.json` | 21623 | `DEDA51B673CFA57CC653F02112C5C1322686F9B01424A80E69E6D5BEC4EB362E` | MATCH |

### 15.3 Six protected objects

| Object | SHA-256 | Result |
|---|---|---|
| FZ | `E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705` | MATCH |
| ST | `5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586` | MATCH |
| DBTP | `FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7` | MATCH |
| `prisma/schema.prisma` | `78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299` | MATCH |
| `apps/web/next-env.d.ts` | `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC` | MATCH |
| `apps/web/tsconfig.tsbuildinfo` | `21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520` | MATCH |

### 15.4 Other state

```text
D:\thinkbook\Desktop\jieya\$null'   ABSENT
D:\thinkbook\Desktop\jieya\$null()  ABSENT
p13_native* processes               NONE
apps/web/.next                     PRESENT / WHOLE-TREE NOT VERIFIED
apps/worker/dist                   PRESENT / WHOLE-TREE NOT VERIFIED
```

No content or hash operation was performed on `$null`.

### 15.5 Build-gate consequence

The current build scripts and static verifiers hard-code the historical
46-string digest, for example:

- `tools/native-rpc/p13-a1-r2/build.ps1:96–99`;
- `tools/native-rpc/p13-a1-r2/build-b4.ps1:110–113`;
- `tools/native-rpc/p13-a1-r2/verify-static.ps1:57,95`;
- `tools/native-rpc/p13-a1-r2/verify-static-b4.ps1:34,93`.

They will fail closed against the current value. This is not a bypass. It means
no build may proceed until a separately approved baseline policy is established.

## 16. Evidence Integrity Matrix

| Evidence ID | Source | Acquisition | Timestamp | Read-only | Integrity | Supports | Does not support | Confidence |
|---|---|---|---|---|---|---|---|---|
| E01 | Canonical PFR registry value | Direct PowerShell 7.6.9 child, original order | 2026-11-22T20:09:34Z | YES | 38/19, hash `8EE40F...` | Current PFR state | How the value was written | CONFIRMED |
| E02 | D1 lines 1015–1080 | File read and in-memory array reconstruction | 2026-11-23 review | YES | Recomputed hash equals `0FF69E...` | Complete historical logical inventory | Existence of a raw snapshot | CONFIRMED |
| E03 | R3-R2 | Historical report | 2026-11-21 | Historical | Hash `54CC89...` | Prior post-reboot pattern | Later install delta | CONFIRMED AS HISTORICAL EVIDENCE |
| E04 | R3-R5/R3-R6 | Historical reports and installer events | 2026-11-21 | Historical | Prefix hash preserved; four appended | Installer appended PFR-020–023 | Installer caused later boot consumption | CONFIRMED AS HISTORICAL EVIDENCE |
| E05 | R7 baseline report | Historical report | 2026-11-21T22:28:49Z | Historical | States 46/23 and `0FF69E...` | Last reviewed report set showing 46/23 | Exact final live read time | STRONGLY SUPPORTED |
| E06 | System event 1074/6006, records 145832/145838 | Existing System log | 2026-11-21T13:26Z | YES | Native event records | Earlier controlled reboot boundary | Current drift by itself | CONFIRMED |
| E07 | System event 1074/6006, records 146256/146262 | Existing System log | 2026-11-21T22:52Z | YES | Native event records | Successful power-off after historical state | Exact PFR write | CONFIRMED |
| E08 | Kernel-General event 12, record 146285 | Existing System log | 2026-11-22T19:40:24.500Z | YES | Native event record | Next boot | Which software rewrote new queue | CONFIRMED |
| E09 | Kernel-Boot event 20, record 146290 | Existing System log | 2026-11-22T19:40:25Z | YES | Native event record | Prior shutdown and boot successful | Per-entry PFR execution | CONFIRMED |
| E10 | CrossDevice process metadata | Process object query | 2026-11-23T03:40:52–54 local | YES | Exact executable paths and start times | CrossDevice started after boot | Direct registry write event | CONFIRMED PROCESS START |
| E11 | Four VS targets absent | Existence-only checks | 2026-11-23T04:10 local | YES | Exact literal paths | Later boot likely consumed the deletes | Exact deleting actor | STRONGLY SUPPORTED |
| E12 | Security event log query | Existing OS log | Review time | YES | Access denied | Windows audit evidence unavailable | No-write conclusion | NOT AVAILABLE |
| E13 | Git status/hash queries | `git.exe --no-optional-locks` | 2026-11-23T04:09–04:10 local | YES | Branch, HEAD, counts, object hashes | Repository/protected baseline | PFR write source | CONFIRMED |
| E14 | Available Codex session JSONL and attachments | Targeted text search | Review time | YES | No PFR write command found; instructions prohibit modification | Reviewed authorization absence | Proof that no unlogged action exists | PARTIAL |

## 17. Findings and Remaining Unknowns

### 17.1 Findings

```text
P0:
NONE

P1:
NONE

P2-01:
CURRENT PFR 38/19 IS NOT AN APPROVED BASELINE

The current queue contains 18 new CrossDevice operations and one long-retained
Gaming Services delete. It is a newly observed transient system state. Existing
build gates will fail closed. A separate decision is required before any new
baseline is recognized.

P3-01:
EXACT GLOBAL PFR HASH IS COUPLED TO UNRELATED TRANSIENT WINDOWS STATE

The build gate's global digest is secure-by-failure but predictably invalidated
by unrelated reboots and CrossDevice activity. A future authorized design review
should consider whether the gate should combine:

- a stable before/after snapshot during each build;
- prohibition on project/Harness path overlap;
- explicit recording of unrelated system-state deltas;
- fail-closed behavior for missing, malformed or project-related changes.

This recommendation does not authorize changing the current gate.

P3-02:
THREE SHELL-LABEL MISMATCH ATTEMPTS OCCURRED DURING THE REVIEW

Each failed before executing its intended PowerShell payload. No redirection,
PFR access or file operation occurred. Canonical PFR reads used the independently
verified direct PowerShell child.
```

### 17.2 Remaining unknowns

- The exact process call that updated the PFR registry value is not present in
  an available registry-write audit record.
- The exact registry value LastWriteTime cannot be obtained through the standard
  registry API used for this review.
- Available Codex durable session records do not cover every historical
  interactive execution stream.
- A raw native `REG_MULTI_SZ` buffer snapshot for either state is unavailable.
- Whether another unrelated application will add or remove PFR entries after
  this report is inherently open.
- The current 38/19 value is transient and must not be assumed indefinitely
  stable.

## 18. Final Verdict

```text
Overall:
PASS WITH WARNINGS — PFR DIFF EXPLAINED, APPROVAL EVIDENCE INCOMPLETE

Canonical PFR path:
REGISTRY VALUE — HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Session Manager\PendingFileRenameOperations

Current PFR:
38 strings / 19 DELETE
8EE40F3606C888B3A0C93E2256D572595339785E99EF0F51EC85B36594097F3F

Historical PFR:
46 strings / 23 DELETE
0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC

Exact entry-level diff:
ESTABLISHED

Net difference:
−8 strings / −4 DELETE operations

Actual operation-level delta:
22 removed / 18 added / 1 exact common

Primary change mechanism:
NORMAL BOOT DRAIN PLUS CROSSDEVICE REPOPULATION — STRONGLY SUPPORTED

PFR change authorization:
NOT FOUND IN REVIEWED EVIDENCE

Current baseline status:
CANDIDATE ONLY — NOT APPROVED

P0:
0

P1:
0

P2:
1

P3:
2

Native RPC Runtime:
NOT EXECUTED

Git writes:
NOT EXECUTED
```

This verdict does not approve the 38/19 state, does not restore 46/23, and does
not authorize a build.

## 19. Recommended Next Step

1. Preserve both the current PFR value and the D1-derived historical inventory
   without modifying the registry or creating a temporary PFR file.
2. Perform a separately authorized baseline-policy review that decides whether
   to:
   - accept the current 38/19 state as a strictly scoped historical exception;
   - retain the 46/23 hard gate and keep builds blocked; or
   - replace the global exact-digest policy with a safer transient-state gate.
3. If an exact-current-state exception is considered, include:
   - the full 38-string ordered digest;
   - explicit handling of the new CrossDevice GUID;
   - one existing Gaming Services source;
   - a rule that any later reboot or queue change invalidates the exception;
   - no authority to clear or edit PFR.
4. Do not resume Native RPC build or runtime from this report.
5. Keep `$null`, `$null'`, `$null()`, PFR, Git and all protected objects
   untouched pending separate authorization.

## 20. Report Integrity

This report is the only file added by BV5.

No report can contain its own final digest without changing its bytes. The
external SHA-256 is calculated after the final write and reported to the user.
