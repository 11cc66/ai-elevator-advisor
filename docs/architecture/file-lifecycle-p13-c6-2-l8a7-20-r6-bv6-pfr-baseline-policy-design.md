# P1-3 C-6.2-L8-A7.20-R6-BV6
# PFR Baseline Policy Design and Threat Model

## 0. Executive Summary

```text
Stage:
C-6.2-L8-A7.20-R6-BV6

Date:
2026-11-23

Mode:
READ-ONLY POLICY DESIGN AND THREAT MODEL

Overall:
PASS WITH WARNINGS — POLICY DESIGN COMPLETE; INDEPENDENT REVIEW REQUIRED

Recommended Policy:
CONTROLLED DYNAMIC PFR BASELINE — CONDITIONALLY RECOMMENDED

Current Build Gate:
UNCHANGED / STILL FAIL-CLOSED

Current Candidate 38/19:
CANDIDATE ONLY — NOT APPROVED

BV6 PFR Registry Read:
NOT PERFORMED

Native Build / Runtime:
NOT EXECUTED

Implementation Authorization:
NONE
```

Policy A, fixed global SHA-256 equality, is useful for recognizing a known
historical state but is unsuitable as the permanent build policy. Normal
Windows boot, servicing and application activity changes PFR for reasons
unrelated to the Native RPC source. A fixed global digest therefore creates
predictable false blocking and encourages unsafe exception proliferation.

Policy B, an explicitly approved exact snapshot, is stronger than a count-only
exception but remains brittle. It proves only that the approved raw value was
present at its approved observation point. It does not prove stability during a
future build, does not adapt to unrelated normal activity, and creates replay,
expiry and scope-widening risks.

Policy C, the proposed Controlled Dynamic PFR Baseline, is recommended with
conditions. It treats PFR as a transient system input:

1. arm a key change notification before reading;
2. capture the exact `REG_MULTI_SZ` bytes twice and require stability;
3. parse every operation without discarding unknown data;
4. resolve every source and rename destination to object/namespace identity;
5. reject any possible conflict with the approved protected-path manifest;
6. keep the watcher armed through the complete build and post-build snapshot;
7. require exact before/after raw-byte equality and no notification;
8. bind the evidence to Build ID, policy generation and manifest hash;
9. fail closed on any unavailable or ambiguous evidence;
10. never clear, rewrite or repair PFR.

Policy C is not recommended as an unconditional replacement. Several design
facts are not currently proven:

- the exact raw `REG_MULTI_SZ` boundary/terminator rules for all legal PFR
  delete/rename sequences;
- the meaning of the observed `*1\??\` and `*2\??\` prefixes;
- the authoritative trust root and approval workflow for the protected-path
  manifest;
- the complete runtime module closure of the approved compiler and linker.

The safe v1 behavior is to BLOCK when any of these facts is unknown. Therefore
the design is complete, but implementation is not ready until the independent
BV7 review closes or explicitly accepts the open items.

The dynamic policy does not approve the BV5 current candidate:

```text
38 strings / 19 DELETE
8EE40F3606C888B3A0C93E2256D572595339785E99EF0F51EC85B36594097F3F
```

It also does not revive the expired historical exception:

```text
38 strings / 19 DELETE
54CC89DA4697363393AE7A956AF3FD689B8B3D10926955849995CD44CC286E84
```

BV6 did not read the live registry value, create a PFR exception, alter a Build
Gate, or execute any build/runtime operation.

## 1. Authorization and Scope

Authorized:

- read design, source, manifests and historical evidence;
- compare Policy A, B and C;
- design snapshot, parser, notification, path-resolution, manifest, state
  machine, decision-table and test structures;
- inspect current build entry points and protected baselines;
- add the two requested design documents.

Not authorized or performed:

- reading the current live PFR registry value;
- writing, clearing, restoring, rebuilding or reprioritizing PFR;
- approving the BV5 candidate or creating a PFR Exception;
- changing Build Gate source, tests, manifests or artifacts;
- MIDL, MSVC compilation, linking or Native test execution;
- Native RPC server/client execution;
- database, Storage, Service, ACL, IAM or audit-policy changes;
- changing `$null` or any protected object;
- Git write operations.

The current `build.ps1`, `build-b4.ps1` and static verifiers remain unchanged.
Because they still require the historical 46-string digest, the current Build
Gate remains fail-closed against the BV5 candidate.

## 2. Skills Invoked

The root `AGENTS.md` routing and high-risk rules were applied.

Skills actually read and used:

- `$project-architecture`
  - separated the Windows transient state, repository evidence, Build Gate,
    Harness artifacts and protected baselines;
  - kept D1 v1 and R5-R3A ownership boundaries explicit.
- `$security-audit`
  - modeled untrusted PFR data, path confusion, monitor failure, evidence
    replay and local-administrator limits;
  - required fail-closed behavior rather than trust in normal operation.
- `$testing-and-verification`
  - designed negative, race, malformed-input and evidence tests without
    claiming any were executed;
  - separated design verification from future Runtime verification.
- `$file-lifecycle`
  - applied object identity, non-following handle inspection, Reparse Point
    rejection, exact evidence, UNKNOWN preservation and no-delete principles.

## 3. Historical PFR Evidence

### 3.1 Historical fixed baseline

```text
Historical count:
46 strings / 23 DELETE

Historical SHA-256:
0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC

Status:
HISTORICAL RECORD ONLY
```

This digest identifies the historical ordered logical array. It is not a
current live-registry claim and does not define an approved permanent system
state.

### 3.2 Expired exact exception

```text
Historical exception state:
38 strings / 19 DELETE

SHA-256:
54CC89DA4697363393AE7A956AF3FD689B8B3D10926955849995CD44CC286E84

Status:
EXPIRED / EXACT CONTENT ONLY
```

That exception authorized only the exact 19 operations it reviewed. It cannot
be transferred to another value merely because the count is also 38/19.

### 3.3 BV5 current candidate

```text
38 strings / 19 DELETE
8EE40F3606C888B3A0C93E2256D572595339785E99EF0F51EC85B36594097F3F

Status:
CANDIDATE ONLY — NOT APPROVED
```

BV5 established:

```text
22 historical operations disappeared
18 new CrossDevice operations appeared
1 operation remained unchanged

Net:
-8 strings
-4 DELETE operations

Change mechanism:
STRONGLY SUPPORTED

Direct registry writer attribution:
NOT CONFIRMED
```

The new CrossDevice GUID recorded by BV5 is:

```text
44B834FC-A6CF-4291-8C5F-EB8D2E164039
```

The current and expired 38/19 values have different content and different
digests. Count equality has no authorization meaning.

### 3.4 Input integrity

| Input | SHA-256 |
|---|---|
| R3-R1 pending-operations readiness | `CB70731258A49259DD3308517F54A32BCF8B84BEAC479A298B04FF04AA7203E4` |
| R3-R2 post-reboot preflight | `52D7A3DAC199E39E594A81B4EA74E2506993DB0E34AA34E4CAE9098ED20FC870` |
| R3-R3 CrossDevice investigation | `4C4B4674A4382C585189B4D6899855F0A5A083E4A10AEF751595B923160EAA62` |
| R3-R4 installation risk reassessment | `33DBED2042DC6F089DCD986B9AA5B351409A79A9D23CADD5A8D516E52AD05949` |
| R3-R5 controlled installation | `1909BBA2D325EC4D719F177B699BEAA44C1526554B31B0DE8197D1BC0EE33178` |
| R3-R6 post-install reconciliation | `39092C6CA607086B716009B8F529CFD0472499C6A6472DFD37F608F6F12A0DA1` |
| D1 v1.0 | `5A9A5E0659C6DA8228836D024C66E12B0A424E9E6D6663AFFF42B9F065149ADE` |
| B1 build report | `FC55B8A0E24419D5DE9AB0C2CC3FDA258B1EB4C56FA62B165F3B4D26B3B8F434` |
| B4 build report | `63A4A0CE15FDE7E1EA299200B1C3EBF77D1457CD538F59094998162AB2895A6A` |
| R7 independent review | `A9951A0455AF3AC6D85DBA327271CB326192E5CA61BFC6FA62830786C84170BF` |
| R8 design corrections | `6FAF4AF2638A9D6D41727049703DF3B0F240D0233A04AD7466679F84A44A27DA` |
| R8 decisions | `F2A539A6E8E2F35C82C7D040F8D98F0E5BB604FABD18BEF41ED5DE95F4FC4C40` |
| BV1 forensic review | `AAF113E8399D3F11A234AE0DF00E718AA5B0F0989801FDC0FC2B66C81C0F2A53` |
| BV2 disposition | `53706B12D6AA51922A6933C07D9B85EEFC70F1A5B7486DEAF803A466C043A588` |
| BV3 forensic review | `33BDAFEFA4254D86787B547DFBCA531300D7E6A64F6D5F74E415D285F3A868F0` |
| BV3-A1 disposition | `5E4FD7AB24D1B54CD133F36D5563B316E736650D6334ABE0DC732C3BC82FE674` |
| BV4 original | `562848495D6DE3864CE35C0CA9449611B42CFB253F3A5692074A2A688FAACB1F` |
| BV4-R1 | `0ABDA4FDFE469F43B7431B14AF1C235EBE1C6E6B6D0E8148963402CF8728F17B` |
| BV5 | `8D5EB4959E4F820806DF71940E95266B09C6CFCF844E28872C2B5EE90BFF40AF` |

### 3.5 Historical lessons

- PFR changes during ordinary shutdown/boot and CrossDevice activity.
- PFR can contain already-absent sources.
- A planned delete can remain queued when its underlying operation fails.
- API registration success would not prove boot-time completion.
- A change/restore sequence can be invisible to before/after comparison.
- Shell/routing mistakes have created project-root baseline artifacts; PFR
  policy must not reproduce those command-redirection defects.

## 4. Windows API Semantics

### 4.1 Official MoveFileEx semantics

Source:

```text
Microsoft Learn — MoveFileExW
https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw
```

Relevant official semantics:

- `MOVEFILE_DELAY_UNTIL_REBOOT` stores the operation for restart.
- Delayed operations cannot use a remote share because they run before the
  network is available.
- `MoveFileEx` stores delayed operations in:

```text
HKLM\SYSTEM\CurrentControlSet\Control\Session Manager
PendingFileRenameOperations
```

- The registry value is `REG_MULTI_SZ`.
- A null destination denotes deletion; a non-empty destination denotes rename.
- Session Manager executes operations at restart in registration order.

Scope of this evidence:

- it defines the documented producer representation and boot-time ordering;
- it does not prove that only `MoveFileEx` can write the registry value;
- it does not prove that a later boot successfully completed every queued
  operation;
- it does not define all possible writer identities.

### 4.2 Official PendMoves semantics

Source:

```text
Microsoft Sysinternals — PendMoves
https://learn.microsoft.com/en-us/sysinternals/downloads/pendmoves
```

Relevant semantics:

- Session Manager reads pending rename/delete commands from
  `PendingFileRenameOperations`;
- the operations occur at the next boot before files are referenced;
- `PendMoves` reports when a source is inaccessible;
- MoveFile accepts an empty destination as a schedule-for-delete operation.

Scope:

- useful for interpreting the queue and investigation;
- it does not provide a privileged writer-attribution log;
- it does not turn source inaccessibility into proof of policy safety.

### 4.3 Official registry query semantics

Source:

```text
Microsoft Learn — RegQueryValueExW
https://learn.microsoft.com/en-us/windows/win32/api/winreg/nf-winreg-regqueryvalueexw
```

Relevant semantics:

- the key must be opened with `KEY_QUERY_VALUE`;
- the value type is returned separately;
- if the buffer is too small, the function returns `ERROR_MORE_DATA`, writes the
  required size, and the supplied data buffer is undefined;
- for `REG_SZ`, `REG_MULTI_SZ` and `REG_EXPAND_SZ`, reported size includes
  terminating null characters unless data was stored without them;
- generic registry APIs may not guarantee null termination.

Design consequence:

```text
The exact bytes returned with their exact length are authoritative.
SHA-256 alone is an index, not the stored evidence.
A partially filled ERROR_MORE_DATA buffer must never be parsed.
```

### 4.4 Official notification semantics

Source:

```text
Microsoft Learn — RegNotifyChangeKeyValue
https://learn.microsoft.com/en-us/windows/win32/api/winreg/nf-winreg-regnotifychangekeyvalue
```

Relevant semantics:

- the key must be opened with `KEY_NOTIFY`;
- `REG_NOTIFY_CHANGE_LAST_SET` reports additions, deletions or changes to any
  value in the watched key;
- the API reports changes to a key, not the identity of the writer;
- the notification event can be delivered asynchronously.

Design consequence:

```text
A notification is conservative evidence that the Key changed.
It is not proof that PendingFileRenameOperations itself changed.
It is not proof of the writer's process identity.
```

### 4.5 Prefix limitation

The historical values contain prefixes such as:

```text
*1\??\C:\...
*2\??\C:\...
```

The reviewed Microsoft pages do not define `*1` or `*2`. Treating them as
ignorable decoration without independent evidence would violate fail-closed
parsing.

Status:

```text
OPEN DESIGN BLOCKER — PFR MODIFIER SEMANTICS NOT VERIFIED
```

Policy v1 must therefore block any operation whose prefix semantics are not in
an approved parser table. No fallback may strip the prefix and continue.

## 5. Policy A/B/C Comparison

| Criterion | A — Fixed Global Exact Hash | B — Explicit Snapshot Exception | C — Controlled Dynamic Baseline |
|---|---|---|---|
| Primary proof | Entire global value equals a known historical digest | Entire global value equals one explicitly approved snapshot | This build window starts from a complete parsed snapshot with no protected conflict and no observed change |
| Detect any unrelated Windows activity | Yes | Yes | Allowed before the window if fully parsed and non-conflicting |
| Normal boot/install availability | Poor; frequent false blocking | Poor; exception churn | Better, but parser/resolver must be complete |
| Exact reorder/byte mutation detection | Yes | Yes | Yes, for pre/post and window evidence |
| Change-and-restore during build | Not detected by only before/after reads | Not detected by explicit snapshot alone | Detected as INVALIDATED if watcher is valid |
| Replay resistance | Historical digest is easy to recognize but not bound to this build | Requires snapshot/Build ID/generation binding | Requires snapshot/Build ID/policy generation/evidence binding |
| Scope widening risk | Low semantic scope, high operational pressure to update hash | High exception-inheritance risk | Medium; mitigated by exact manifest and no overrides |
| Unknown PFR format | Rejected indirectly because hash differs | Rejected indirectly | Must be directly rejected by parser |
| Path-conflict protection | None beyond known-hash assumption | Approves whole snapshot; not per-build dynamic | Explicit source/destination tree and object checks |
| Who may permit unrelated changes | A new exact baseline approval | A new exact snapshot approval | Policy defines unrelated, non-conflicting operations as eligible at snapshot time |
| Operator burden | High after every unrelated update | High and exception-heavy | Medium recurring; high one-time implementation assurance |
| Best use | Historical recognition and forensics | Emergency exact-state authorization or regression fixture | Recommended long-term build policy, conditional on BV7 closure |

### 5.1 Policy A

Security strengths:

- detects every logical byte, ordering or count change;
- trivial to audit against one digest;
- has no parser or path-resolution attack surface for unrelated entries;
- excellent for historical regression and forensic comparison.

Limitations:

- a normal reboot can consume PFR entries;
- CrossDevice or installer activity can add new entries without touching the
  project;
- every unrelated change blocks a legitimate build;
- baseline updates can be mistaken for general permission;
- carrying an old hash across machine/Windows identities creates replay and
  stale-evidence risk.

Conclusion:

```text
RETAIN AS HISTORICAL IDENTITY AND DIFFERENCE CHECK
DO NOT USE AS THE PERMANENT BUILD POLICY
```

### 5.2 Policy B

An exact snapshot exception can prove:

- the exact raw value and type;
- its ordered operations;
- that a human/authority approved that exact state;
- that a later observation is identical to that approved state.

It cannot prove:

- that no PFR writer can change it later;
- that a build is protected throughout its execution;
- that parsers/path resolvers would recognize a protected conflict;
- that the snapshot was used once and belongs to this Build ID;
- that a future boot will do nothing harmful if PFR changes after approval.

Major risks:

- count-only or hash-only inheritance;
- snapshot replay into a different build or machine;
- exceptions becoming the normal operating mode;
- broad exception language turning a point-state approval into general PFR
  modification authority;
- same count with different bytes being mistakenly accepted.

Conclusion:

```text
MAY BE USED ONLY FOR A NARROW, EXACT, EXPIRING EMERGENCY STATE
NOT RECOMMENDED AS THE DEFAULT
CURRENT 38/19 DOES NOT AUTOMATICALLY QUALIFY
```

### 5.3 Policy C

Policy C replaces global permanence with a per-build proof obligation:

```text
Complete current-state capture
+ complete parse
+ trustworthy protected-path manifest
+ no protected path conflict
+ continuous notification from before the snapshot through the post-snapshot
+ exact pre/post equality
+ durable evidence binding
= PASS FOR THIS BUILD WINDOW ONLY
```

It is stronger than Policy B during the build because it detects transient
change-and-restore. It is weaker than Policy A in simplicity because the parser,
resolver and evidence path are new trusted components.

Therefore the recommendation is conditional:

```text
CONDITIONALLY RECOMMENDED FOR INDEPENDENT REVIEW
IMPLEMENTATION MUST REMAIN BLOCKED UNTIL OPEN BLOCKERS ARE CLOSED
```

## 6. Recommended Policy

### 6.1 Normative policy identity

```text
Policy ID:
PFR-DYNAMIC-BASELINE

Proposed Policy Version:
1.0-design

Applicability:
Windows-only local NTFS build host

Default Decision:
DENY

Manual Override:
FORBIDDEN
```

### 6.2 Security objectives

```text
OBJ-01 — PFR_GATE_READ_ONLY
The gate never writes or clears PFR.

OBJ-02 — COMPLETE_PRE_STATE
No build begins without a complete, typed, limited-size raw pre-snapshot.

OBJ-03 — COMPLETE_PARSE
Every operation is parsed and classified; unknown data stops the attempt.

OBJ-04 — PROTECTED_PATH_INTEGRITY
No operation may delete, rename or expose a possible ancestor/descendant,
file-identity or volume-alias relationship with a protected path.

OBJ-05 — CONTINUOUS_WINDOW
Key-level notification is armed before the pre-snapshot and remains valid
through the post-snapshot.

OBJ-06 — EXACT_RAW_EQUALITY
Pre/post type, exact byte length and exact bytes must match.

OBJ-07 — EVIDENCE_BINDING
Snapshots, policy generation and manifest hash are bound to one Build ID and
one gate invocation.

OBJ-08 — UNCERTAINTY_DENIES
Missing, truncated, inaccessible, replayable, ambiguous or unmonitored state
cannot become PASS.

OBJ-09 — INDEPENDENT_CONTROLS
PFR PASS does not replace source, IDL, manifest, artifact, protected-object,
Native RPC or Runtime controls.
```

### 6.3 Non-goals

- proving a future reboot is globally safe for all machine state;
- identifying the process that wrote PFR;
- resisting a compromised administrator, SYSTEM account, kernel or Codex host;
- cleaning or repairing PFR;
- proving that all queued Windows deletes will succeed;
- replacing file-system identity or ACL controls in the Build outputs;
- authorizing current candidate 38/19;
- enabling Native RPC Runtime.

## 7. PFR Snapshot Model

### 7.1 `PfrSnapshotV1`

Canonical schema fields:

```text
SnapshotVersion
SnapshotId
BuildId
GateInvocationId
CaptureTimestampUtc
CaptureProcessIdentity
MachineIdentity
WindowsBuildIdentity
RegistryKeyPath
RegistryValueName
RegistryView
RegistryValueType
ValuePresence
ReadAttemptCount
RawByteLength
RawDataSHA256
RawDataExactBytesReference
RawTerminatorForm
LogicalStringCount
ParsedOperationCount
ParserVersion
ParserVerdict
ProtectedPathManifestId
ProtectedPathManifestVersion
ProtectedPathManifestGeneration
ProtectedPathManifestHash
ClassifierVersion
OperationResults
ClassificationVerdict
EvidenceSchemaVersion
```

### 7.2 Distinctions

| State | Required representation |
|---|---|
| Key unavailable | `READ_ERROR / BLOCKED` |
| Value absent | `VALUE_ABSENT / BLOCKED` |
| Value present, invalid zero length | `INVALID_ZERO_LENGTH / BLOCKED` |
| Present, canonical empty multi-string | zero operations, eligible only after parser confirmation |
| Present, wrong type | `WRONG_TYPE / BLOCKED` |
| Present, truncated/undefined buffer | `INCOMPLETE / BLOCKED` |
| Present, complete raw bytes | capture exact bytes and exact `RawByteLength` |
| Present but unstable during stable-read check | `UNSTABLE / INVALIDATED` |

Absence cannot be converted into an empty queue.

### 7.3 Raw evidence

`RawDataExactBytesReference` identifies an immutable evidence object. It is not
the digest and must not be silently regenerated from repair code.

Requirements:

- store the exact registry value bytes returned by the final stable read;
- store the exact byte length;
- record the type;
- keep the raw bytes only in a protected build-evidence directory;
- restrict access to the build evidence owner and review authority;
- ordinary logs contain counts, verdicts and digest, not every full system path;
- evidence persistence must complete before `READY_FOR_BUILD`;
- evidence write failure is `BLOCKED`;
- no temporary raw snapshot may be created in the repository root.

`RawDataSHA256` is an evidence index and fast equality check. It is not the
authority for PASS because exact bytes and length remain mandatory.

### 7.4 Machine and Build binding

`MachineIdentity` should be a stable one-way identity derived from an approved
machine identifier and system-volume identity, not a raw credential.

`WindowsBuildIdentity` includes at minimum:

- major/minor/build/revision;
- UBR;
- architecture;
- 64-bit registry view.

A snapshot from another machine, policy generation, manifest or Build ID is
non-replayable:

```text
REPLAY DETECTED -> BLOCKED
```

## 8. Registry Read and Notification Design

### 8.1 Permissions

Proposed native handles:

```text
Snapshot key handle:
RegOpenKeyExW(..., KEY_QUERY_VALUE | KEY_READ_CONTROL, ...)

Notification key handle:
RegOpenKeyExW(..., KEY_NOTIFY, ...)

Registry view:
KEY_WOW64_64KEY persistently present in sampled access
```

The implementation must not request:

```text
KEY_SET_VALUE
KEY_CREATE_SUB_KEY
KEY_ENUMERATE_SUB_KEYS unless separately needed
WRITE_DAC / WRITE_OWNER
```

The exact access mask is an implementation-review item because `KEY_NOTIFY`
must be preserved in the sampled access while retaining least privilege.

The gate must not require or request Local Administrator merely to elevate
beyond the ACL already granted to the approved build host. If the account
cannot obtain the required read/notify access:

```text
BLOCKED — REGISTRY ACCESS DENIED
```

No impersonation, token theft, service creation, ACL modification or ownership
change is allowed.

### 8.2 Watcher ordering

Required order:

```text
create manual-reset notification event, initially non-signaled
-> open notify handle
-> RegNotifyChangeKeyValue(
     notifyHandle,
     bWatchSubtree = FALSE,
     REG_NOTIFY_CHANGE_LAST_SET,
     event,
     fAsynchronous = TRUE)
-> confirm registration returned ERROR_SUCCESS
-> begin pre-snapshot read
```

The notification covers the entire Session Manager key. A change to any other
value in that key may invalidate the build. This false-positive behavior is
accepted because the API does not provide a value-specific guarantee.

### 8.3 Stable pre-snapshot read

Proposed algorithm:

```text
1. Query value type and required byte size with lpData = NULL.
2. Require REG_MULTI_SZ and a supported nonzero size within the policy limit.
3. Allocate a new buffer of exactly the returned size.
4. Query data and final size.
5. On ERROR_MORE_DATA, discard the whole buffer, update size and retry.
6. Retry at most three times total.
7. After a successful read, take a second independent complete read.
8. Require type, byte length and exact bytes to match between reads.
9. Check the event with zero timeout after each read and again before READY.
10. If the event is signaled at any point, invalidate this gate invocation.
11. Persist exact raw evidence and record the evidence reference.
```

The two-read comparison is not an atomic snapshot. It is a bounded consistency
check backed by the armed key notification.

### 8.4 Size, truncation and type handling

Proposed initial maximum:

```text
Maximum raw PFR bytes:
1048576
```

This is a policy resource limit, not an API guarantee. Exceeding it yields:

```text
BLOCKED — SNAPSHOT SIZE LIMIT EXCEEDED
```

Required reject conditions:

- odd byte length;
- missing required terminator structure;
- `ERROR_MORE_DATA` after three complete retries;
- data bytes change between successful reads;
- registry type changes;
- value size changes without a complete retry;
- zero-length present value;
- wrong type;
- inaccessible key;
- watcher registration failure;
- notification already signaled before the build.

### 8.5 Monitor health

The watcher is one-shot for the gate invocation:

- once the event signals, it remains signaled;
- the gate must not reset it and continue;
- no re-arm may erase evidence of an earlier change;
- closing or losing the event handle is monitor loss;
- a watcher thread exiting unexpectedly is monitor loss;
- an invalid wait result is monitor loss;
- a host restart destroys the only proof and is `UNKNOWN`.

Monitor loss result:

```text
UNKNOWN — BUILD WINDOW NOT CONTINUOUSLY MONITORED
```

PASS is forbidden.

## 9. PFR Parser Design

### 9.1 `PfrOperationV1`

```text
OperationIndex
RawSource
RawDestination
OperationType
RawSourceByteOffset
RawSourceByteLength
RawDestinationByteOffset
RawDestinationByteLength
RawEntryLength
RawEntryDigest
PrefixClass
ParseVerdict
SourcePathClassification
DestinationPathClassification
ProtectedPathConflict
```

Types:

```text
DELETE
RENAME
UNKNOWN
MALFORMED
```

### 9.2 Required parse properties

- Preserve exact order.
- Preserve duplicate operations.
- Preserve repeated empty destinations.
- Do not trim, coalesce or de-duplicate strings.
- Do not repair terminators.
- Do not substitute an inferred prefix.
- Do not parse an `ERROR_MORE_DATA` buffer.
- Do not use shell string splitting.
- Do not stop after the first recognized operation.
- Do not PASS leftover bytes.
- Do not treat an unknown operation as ignored but otherwise successful.
- Record every operation exactly once.

### 9.3 UTF-16LE and pair model

The parser operates on the raw byte buffer:

```text
All decoding is little-endian UTF-16.
Every path is re-encoded only for comparisons; raw bytes remain authoritative.
The source is the first logical element of an operation.
An empty destination element denotes DELETE.
A non-empty destination element denotes RENAME.
Operations are considered in queue order.
```

### 9.4 Raw terminator and boundary blocker

The reviewed official MoveFileEx documentation describes the conceptual forms:

```text
szSrcFile \0 \0
szSrcFile \0 szDstFile \0
```

and says PFR is `REG_MULTI_SZ`, which itself has registry list-termination and
optional `ERROR_MORE_DATA` size semantics. The official documentation does not
provide a complete byte-level parser contract covering every combination of:

- final DELETE;
- final RENAME;
- adjacent DELETE operations;
- an empty logical value;
- optional registry buffer terminators;
- values stored without expected null characters.

Status:

```text
OPEN DESIGN BLOCKER — RAW REG_MULTI_SZ TERMINATOR FORM NOT FULLY PROVEN
```

No implementation may guess by calling a generic multi-string helper and
silently truncating consecutive NUL elements. Policy v1 may use the following
safe acceptance strategy once independent fixtures prove it:

```text
Only a recognized canonical raw terminator form may be parsed.
Any extra, missing or ambiguous terminator form is MALFORMED/BLOCKED.
```

Until that fixture matrix is approved:

```text
ParserVerdict = BLOCKED_SPEC_UNDERSPECIFIED
```

### 9.5 Prefix handling

Recognized parser-model prefixes must be explicit and versioned. Because `*1`
and `*2` are not defined by the reviewed official API pages:

```text
PrefixClass = UNKNOWN_MODIFIER
ParseVerdict = BLOCKED_UNKNOWN_PREFIX
```

No string prefix from PFR may be removed solely by pattern matching.

### 9.6 Parse rejection

Any of the following blocks the whole attempt:

- unsupported format;
- incomplete data;
- impossible operation boundary;
- unknown special prefix;
- maximum operation count exceeded;
- invalid UTF-16 representation that cannot be compared safely;
- empty source;
- missing destination field;
- trailing unparsed bytes;
- parser exception;
- parser version mismatch;
- raw digest mismatch to the retained exact bytes.

Parse failure:

```text
BLOCKED — PFR OPERATION PARSING NOT FULLY VERIFIED
```

There is no “skip the unknown operation” mode.

## 10. Protected Path Manifest

### 10.1 `PfrProtectedPathManifestV1`

```text
ManifestId
ManifestVersion
Generation
PolicyId
PolicyVersion
CreatedAtUtc
NotBeforeUtc
ExpiresAtUtc
ApprovalAuthority
ApprovedManifestSha256
CanonicalEncoding
TrustRootId
Signature/AttestationReference
Entries[]
DenyUnknownPaths
ManualOverrideAllowed
```

Policy default:

```text
DenyUnknownPaths = true
ManualOverrideAllowed = false
```

Each manifest entry includes:

```text
EntryId
Purpose
Path
PathKind
IncludeDescendants
ExpectedObjectType
IdentityMode
VolumeIdentity
FileIdentity
ToolchainRole
ApprovalEvidence
```

### 10.2 Protected path categories

Initial candidate categories for independent review:

| Category | Candidate root/object | Treatment |
|---|---|---|
| Project tree | `D:\thinkbook\Desktop\jieya` | all descendants protected |
| Six protected objects | FZ, ST, DBTP, Prisma Schema, `next-env.d.ts`, `tsconfig.tsbuildinfo` | exact identity/hash protected, in addition to project tree |
| Protected `$null` | `D:\thinkbook\Desktop\jieya\$null` | exact path and object identity protected; content not read |
| PFR evidence | Harness PFR policy evidence directory | protected build input/output |
| Native Harness | `tools\native-rpc\p13-a1-r2` | source, IDL, manifest, outputs and logs protected |
| MSVC root | approved Build Tools MSVC root | toolchain tree protected |
| Windows SDK | approved SDK include/lib/bin roots | toolchain tree protected |
| MIDL/CL/LINK/DUMPBIN | exact approved executable paths | exact identity and pinned hash |
| System build dependencies | approved resolved DLL identity list | exact volume/file identity |
| Build temporary root | approved Harness-local temporary directory | output tree protected |

The manifest may not silently add a discovered path. A newly discovered
dependency requires a reviewed manifest-generation increment.

### 10.3 Trust and rollback

Required properties:

- canonical JSON or another deterministic encoding;
- duplicate-key and unknown-field rejection;
- `ManifestId + Version + Generation` correlation;
- approved SHA-256 recorded outside the manifest itself;
- trust root and approval authority identified by the independent review;
- no self-issued signature accepted as authority;
- `ExpiresAtUtc` enforced;
- lower generation than the last approved generation is rejected;
- snapshot/manifest version mismatch is rejected;
- manifest changed during the build invalidates the gate;
- missing or untrusted manifest:

```text
BLOCKED — PROTECTED PATH MANIFEST NOT VERIFIED
```

The current repository has no approved PFR protected-path manifest. Reusing the
existing signed release manifest without an explicit design decision would
confuse release-artifact trust with transient-system-path policy.

Status:

```text
OPEN — REQUIRES INDEPENDENT REVIEW
```

### 10.4 Toolchain closure blocker

The current build scripts identify exact MIDL, CL, LINK and DUMPBIN paths and
pin their hashes. They also identify SDK/MSVC include and library roots. That
is sufficient to list known inputs, but not to prove the complete set of
system DLLs or delayed modules loaded by the compiler/linker host.

Until an approved runtime-inventory method exists:

```text
Toolchain closure = OPEN DESIGN BLOCKER
```

Policy v1 may only include exact reviewed paths and must block if a required
dependency identity is unknown. It may not infer that all other System32 files
are safe or that an unlisted dependency is irrelevant.

## 11. Windows Path Resolution

### 11.1 `PfrPathResolver`

No protected-path decision may be based on substring or plain textual prefix.

Resolver output:

```text
InputPath
NamespaceClass
NormalizedDisplayPath
VolumeIdentity
ExistingObjectIdentity
NearestExistingAncestorIdentity
UnresolvedTailComponents
ReparseEvidence
ResolutionVerdict
```

Resolution verdicts:

```text
RESOLVED_LOCAL
RESOLVED_NONEXISTENT_LOCAL
UNSUPPORTED_NAMESPACE
UNKNOWN_NAMESPACE
AMBIGUOUS_PATH
MALFORMED_PATH
```

Only the first two may proceed to non-conflict classification.

### 11.2 Approved API direction

The future native implementation should evaluate:

- `GetFullPathNameW`
- `GetLongPathNameW`
- `GetVolumePathNameW`
- `GetVolumeNameForVolumeMountPointW`
- `CreateFileW`
- `GetFinalPathNameByHandleW`
- `GetFileInformationByHandle`
- `GetFileInformationByHandleEx`

These APIs are resolution evidence, not a proof that a path will stay unchanged
until the next reboot.

### 11.3 Existing paths

Open with read-only attribute access and non-following final-component flags as
appropriate:

```text
Desired access:
FILE_READ_ATTRIBUTES

Share mode:
FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE

Creation:
OPEN_EXISTING

Final component:
FILE_FLAG_OPEN_REPARSE_POINT

Directories:
FILE_FLAG_BACKUP_SEMANTICS
```

Record:

- volume GUID and serial;
- File ID / file index;
- final normalized name;
- object type;
- Reparse tag/state;
- hard-link count;
- reparse-free parent chain.

Any Reparse Point, Junction or mount-point alias in the path chain is:

```text
UNKNOWN — PATH CONFLICT CANNOT BE EXCLUDED
```

unless a later approved resolver explicitly resolves and compares both
identities. The current safe default is to block.

### 11.4 Non-existent paths

For a missing source or target:

1. find the nearest existing ancestor;
2. open it without following a final reparse point;
3. verify every existing component is a normal directory;
4. resolve the existing ancestor's volume identity and canonical name;
5. canonicalize and case-fold only the non-existent tail according to Windows
   path rules;
6. reject unresolved aliases, relative paths or device ambiguities;
7. record the exact unresolved tail.

If any step is ambiguous:

```text
UNKNOWN — PATH CONFLICT CANNOT BE EXCLUDED
```

### 11.5 Namespace table

| Form | Policy v1 direction |
|---|---|
| DOS drive path | Resolve by volume and object identity |
| `\\?\` extended path | Canonicalize, then resolve; reject if unresolved |
| `\??\` NT path | Resolve only through approved conversion and identity checks |
| UNC path | BLOCK — delayed operation is local-only by documented API contract |
| `\\?\UNC\` | BLOCK |
| Volume GUID path | Resolve volume GUID and object identity |
| `\Device\HarddiskVolumeX` | Resolve through handle/volume mapping; unknown mapping blocks |
| Case variation | Compare with Windows case-insensitive semantics |
| 8.3 name | Resolve to final/long identity |
| Junction | BLOCK unless later specifically proven |
| Symbolic link | BLOCK unless later specifically proven |
| Mount Point | BLOCK unless later specifically proven |
| Hard link | Compare `(volume identity, File ID)` |
| Trailing dot/space | BLOCK when normalization is ambiguous |
| ADS | BLOCK |
| Relative path | BLOCK |
| Environment variable | BLOCK; do not expand |
| Unknown device namespace | BLOCK |

### 11.6 No textual shortcut

Forbidden:

```text
String.StartsWith("D:\thinkbook\Desktop\jieya")
Contains("jieya")
case-sensitive slash replacement as the only normalization
using path text without volume/object identity
```

## 12. Protected Path Conflict Matrix

For every parsed operation, evaluate all applicable relations.

| Operation | Source check | Destination check | Conflict authority |
|---|---|---|---|
| DELETE | exact protected object | N/A | FAIL |
| DELETE | source inside protected tree | N/A | FAIL |
| DELETE | source is ancestor of protected tree/object | N/A | FAIL |
| DELETE | same volume/File ID as protected object through another path | N/A | FAIL |
| RENAME | source protected/inside/ancestor | any destination | FAIL |
| RENAME | any source | destination protected/inside/ancestor | FAIL |
| RENAME | destination overwrites protected object identity | exact identity check | FAIL |
| Any | different volume but identical suffix text | no conflict solely from text | PASS only after both volumes resolved |
| Any | path has unresolved Reparse/alias/device semantics | any result | BLOCK |
| Any | parser unknown or malformed | any result | BLOCK |
| Any | operation targets build temp/input/output root | N/A | FAIL |
| Any | parent directory delete encloses a protected entry | N/A | FAIL |

Conflict verdict precedence:

```text
BLOCKED/UNKNOWN parser or resolver uncertainty
> FAIL protected conflict
> PASS no conflict
```

Operational rule:

- one protected conflict fails the whole build;
- no “review and continue” override;
- no per-path operator checkbox;
- a new snapshot invocation is required after the system state changes.

## 13. Build Window State Machine

### 13.1 States

```text
NOT_STARTED
WATCHER_ARMED
PRE_SNAPSHOT_CAPTURED
PRE_SNAPSHOT_VALIDATED
OPERATIONS_PARSED
PATH_CLASSIFICATION_COMPLETE
READY_FOR_BUILD
BUILD_WINDOW_ACTIVE
BUILD_EXITED
POST_SNAPSHOT_CAPTURED
VALIDATED
PASSED
BUILD_FAILED
BLOCKED
INVALIDATED
UNKNOWN
```

### 13.2 Transitions

| Current state | Event | Next state | Required condition/evidence |
|---|---|---|---|
| NOT_STARTED | arm watcher succeeds | WATCHER_ARMED | event, notify handle and registration metadata recorded |
| NOT_STARTED | access/registration fails | BLOCKED | exact error and no fallback |
| WATCHER_ARMED | complete stable pre-read | PRE_SNAPSHOT_CAPTURED | every snapshot field present |
| WATCHER_ARMED | event signaled/read fails | INVALIDATED / BLOCKED | no build launch |
| PRE_SNAPSHOT_CAPTURED | type/length/terminator validation | PRE_SNAPSHOT_VALIDATED | exact raw evidence persisted |
| PRE_SNAPSHOT_CAPTURED | malformed/truncated/wrong type | BLOCKED | preserve raw evidence if it exists |
| PRE_SNAPSHOT_VALIDATED | full parser PASS | OPERATIONS_PARSED | every operation classified |
| PRE_SNAPSHOT_VALIDATED | parser unknown | BLOCKED | no build launch |
| OPERATIONS_PARSED | manifest verified + all paths classified | PATH_CLASSIFICATION_COMPLETE | manifest generation/hash valid |
| OPERATIONS_PARSED | missing/untrusted manifest | BLOCKED | no build launch |
| PATH_CLASSIFICATION_COMPLETE | all no-conflict and event non-signaled | READY_FOR_BUILD | final event check passed |
| PATH_CLASSIFICATION_COMPLETE | conflict | BLOCKED | no build launch |
| READY_FOR_BUILD | Build Start Intent allocated, spawn requested | BUILD_WINDOW_ACTIVE | Build ID and process launch evidence |
| READY_FOR_BUILD | event signaled/start aborted | INVALIDATED | current attempt cannot PASS |
| BUILD_WINDOW_ACTIVE | event signaled | INVALIDATED | request safe cancellation; no PASS |
| BUILD_WINDOW_ACTIVE | monitor loss | UNKNOWN | no PASS |
| BUILD_WINDOW_ACTIVE | child exits | BUILD_EXITED | exit code and process identity recorded |
| BUILD_EXITED | complete post-read | POST_SNAPSHOT_CAPTURED | watcher still armed |
| BUILD_EXITED | post-read failure | UNKNOWN | no PASS |
| POST_SNAPSHOT_CAPTURED | exact pre/post match and no event | VALIDATED | retain until all evidence persisted |
| POST_SNAPSHOT_CAPTURED | raw difference or event | INVALIDATED | build output is not gate-admitted |
| VALIDATED | Build exit code 0 and evidence persistence completes | PASSED | full evidence bundle closes |
| VALIDATED | Build exit code nonzero | BUILD_FAILED | PFR stability alone is not build success |
| Any post-arm state | host restarts before evidence closes | UNKNOWN | no reconstructed PASS |

### 13.3 Build-start TOCTOU

Windows registry notification does not provide an atomic lock over:

```text
last no-event check -> process creation -> notification delivery
```

Design response:

- watcher is armed before the first read;
- one final zero-time event check occurs immediately before spawn;
- exact watcher state and Build Start Intent are recorded;
- a notification at any time from arming until post-snapshot completion
  invalidates the attempt;
- no claim is made that this prevents all side effects after an undetected
  administrator action.

The policy protects the gate decision, not the entire operating system.

### 13.4 Cancellation boundary

If a notification occurs after build launch:

- mark `INVALIDATED` immediately;
- request cooperative cancellation through the existing build process/Job
  architecture;
- do not grant new termination rights in this design;
- do not claim the process stopped unless independently proven;
- do not allow a later verification stage to consume the output as
  PFR-gate-admitted.

## 14. Fail-Closed Decision Table

| Scenario | State | Verdict |
|---|---|---|
| Registry access denied | BLOCKED | BLOCKED |
| Value missing | BLOCKED | BLOCKED |
| Wrong registry type | BLOCKED | BLOCKED |
| Present zero-length value | BLOCKED | BLOCKED |
| Invalid or truncated raw data | BLOCKED | BLOCKED |
| Raw terminator form unresolved | BLOCKED | BLOCKED |
| Malformed REG_MULTI_SZ | BLOCKED | BLOCKED |
| Parser unknown | BLOCKED | BLOCKED |
| Unknown `*N` prefix | BLOCKED | BLOCKED |
| Unknown path namespace | BLOCKED | BLOCKED |
| Path resolution ambiguous | BLOCKED | BLOCKED |
| Manifest missing/untrusted | BLOCKED | BLOCKED |
| Manifest rollback/expiry | BLOCKED | BLOCKED |
| Toolchain dependency identity missing | BLOCKED | BLOCKED |
| Protected DELETE source | BLOCKED | FAIL |
| Rename source conflict | BLOCKED | FAIL |
| Rename destination conflict | BLOCKED | FAIL |
| Delete protected object | BLOCKED | FAIL |
| Watcher registration failure | BLOCKED | BLOCKED |
| Key change notification before build | INVALIDATED | INVALIDATED |
| Key change notification during build | INVALIDATED | INVALIDATED |
| Key change notification before post-snapshot | INVALIDATED | INVALIDATED |
| Change and restore during build | INVALIDATED | INVALIDATED |
| Pre/post raw data differ | INVALIDATED | INVALIDATED |
| Same hash but different byte length | BLOCKED | BLOCKED |
| Monitor thread/handle loss | UNKNOWN | UNKNOWN |
| Host crash/restart during build | UNKNOWN | UNKNOWN |
| Build exit nonzero | BUILD_FAILED | FAIL |
| Snapshot size limit exceeded | BLOCKED | BLOCKED |
| Evidence persistence failure | BLOCKED | BLOCKED |
| Build ID/policy/manifest replay | BLOCKED | BLOCKED |
| Snapshot A used as proof for Build B | BLOCKED | BLOCKED |

Manual override matrix:

| Condition | Operator may continue? |
|---|---|
| Unrelated normal PFR operation present in a valid snapshot | Only by starting a complete new gate attempt; no override |
| Protected path conflict | NO |
| Parser uncertainty | NO |
| Manifest uncertainty | NO |
| Monitor loss | NO |
| Change notification | NO |
| Wrong type/access failure | NO |
| Build failure | No PFR PASS; build result is separately failed |

## 15. Threat Model

| ID | Threat | Capability/precondition | Asset | Required control | Residual risk |
|---|---|---|---|---|---|
| T1 | Normal Windows/install activity changes PFR | OS servicing or application runs before/during build | Build availability and integrity | Complete snapshot, conflict analysis, watcher, conservative Key invalidation | Unrelated changes can block |
| T2 | Other process changes PFR during build | Same host user/admin can write HKLM | Build integrity | Arm before snapshot, one-shot notification, exact post read | Notification lacks writer identity |
| T3 | Malicious/erroneous delete or rename of project/toolchain | Queue contains dangerous operation | Source, protected files, tools, build outputs | Structured parse plus identity-aware conflict matrix | A compromised admin can hide behavior |
| T4 | Path resolution evasion | Device paths, aliases, links, hard links, case, ADS | Conflict decision | Volume/file identity and non-following handles | Unresolved paths must block |
| T5 | Parser confusion | Empty elements, terminators, truncation, unknown prefixes | Parser correctness | Raw-byte state machine; no truncation; unknown blocks | Exact format remains open blocker |
| T6 | Monitor failure | Thread crash, handle closure, host failure, notification loss | Window proof | Health evidence and UNKNOWN fail-closed | Cannot prove a dead host's build window |
| T7 | Local Administrator/SYSTEM/Kernel compromise | Full control of registry, handles, process memory, logs | Entire local trust basis | Explicitly out of scope | Dynamic PFR proof is not system-integrity attestation |
| T8 | Policy/manifest/snapshot rollback | Old approved generation or evidence reused | Policy authority | Generation, expiry, trust root and Build ID binding | Offline malicious admin out of scope |
| T9 | Path state TOCTOU | Path/reparse target changes after classification | Protected-path classification | Non-following handles and watcher only for PFR; unresolved alias blocks | Path can change between gate and next reboot |
| T10 | Build evidence substitution | Tampered snapshot, manifest or Build ID | Evidence trust | Content-addressed evidence, signatures/hash pin, append-only audit | No implemented trust root in BV6 |
| T11 | Post-build reboot hazard | PFR changes after PASS but before reboot and later deletes project data | Future environment | Build gate does not promise future reboot safety; separate monitored startup policy would be required | Out of current scope |

### 15.1 T7 boundary

The policy must not claim protection from:

- a Local Administrator who modifies PFR after validation;
- SYSTEM-level malicious code;
- kernel tampering;
- process-memory tampering;
- manipulation of the Codex host, policy binary, trust root or evidence store.

For those actors:

```text
PFR DYNAMIC SNAPSHOT IS NOT A HOST INTEGRITY ATTESTATION
```

### 15.2 Future reboot boundary

PFR operations execute at the next boot. A successful build-window check cannot
prove that an administrator or compromised process will not add a dangerous
entry after the build and before the next reboot.

This policy protects the build decision. A future reboot-time policy would be a
separate control and is not authorized here.

## 16. Test Design Matrix

No test is executed in BV6. Test names identify future test-only registry keys,
fixtures and paths; they must never alter the real PFR value.

### 16.1 Registry snapshot tests

| Test ID | Threat | Precondition | Input | Expected State | Expected Verdict | Evidence Required |
|---|---|---|---|---|---|---|
| PFR-SNAP-01 | T5 | Test key; watcher armed | Valid REG_MULTI_SZ delete fixture | PRE_SNAPSHOT_VALIDATED | PASS TO PARSE | raw bytes, length, type, hashes, event state |
| PFR-SNAP-02 | T5 | Test key; valid fixture | Value absent | BLOCKED | BLOCKED | error code, no synthetic bytes |
| PFR-SNAP-03 | T5 | Test key | Present zero-length value | BLOCKED | BLOCKED | length/type/error |
| PFR-SNAP-04 | T5 | Test key | REG_SZ instead of REG_MULTI_SZ | BLOCKED | BLOCKED | observed type |
| PFR-SNAP-05 | T5 | Query size underreports | ERROR_MORE_DATA then stable retry | PRE_SNAPSHOT_CAPTURED | PASS TO VALIDATE | each attempt buffer discarded, final bytes |
| PFR-SNAP-06 | T6 | Size keeps changing | ERROR_MORE_DATA beyond limit | BLOCKED | BLOCKED | attempt count and sizes |
| PFR-SNAP-07 | T5 | Test key | Odd raw byte length | BLOCKED | BLOCKED | exact length |
| PFR-SNAP-08 | T5 | Test key | Final terminator form unknown | BLOCKED | BLOCKED | parser diagnostic |
| PFR-SNAP-09 | T2 | Watcher armed | Value changes before first read completes | INVALIDATED | INVALIDATED | event signaled and read instability |
| PFR-SNAP-10 | T2 | Watcher armed | First complete read A; second read B | INVALIDATED | INVALIDATED | hashes/lengths and notification |
| PFR-SNAP-11 | T2 | Watcher armed | Value changes then returns before second read | INVALIDATED | INVALIDATED | event remains signaled |
| PFR-SNAP-12 | T6 | Restricted test token | KEY_QUERY_VALUE access denied | BLOCKED | BLOCKED | Win32 error |
| PFR-SNAP-13 | T6 | Restricted test token | KEY_NOTIFY access denied | BLOCKED | BLOCKED | Win32 error |
| PFR-SNAP-14 | T5 | Test limit configured | Raw bytes exceed limit | BLOCKED | BLOCKED | length |
| PFR-SNAP-15 | T10 | Evidence directory unavailable | Valid read but evidence write fails | BLOCKED | BLOCKED | read hash and write error |
| PFR-SNAP-16 | T10 | Test key | Same bytes, manipulated length field in evidence | BLOCKED | BLOCKED | cross-field mismatch |
| PFR-SNAP-17 | T6 | Cancelled wait/timed-out helper | Monitor status unprovable | UNKNOWN | UNKNOWN | wait result, thread state |

### 16.2 Parser tests

| Test ID | Threat | Precondition | Input | Expected State | Expected Verdict | Evidence Required |
|---|---|---|---|---|---|---|
| PFR-PARSE-01 | T5 | Approved test vectors | One DELETE | OPERATIONS_PARSED | PASS | raw offsets and operation record |
| PFR-PARSE-02 | T5 | Approved test vectors | One RENAME | OPERATIONS_PARSED | PASS | source/destination records |
| PFR-PARSE-03 | T5 | Mixed vector | Multiple DELETE/RENAME | OPERATIONS_PARSED | PASS | ordered records |
| PFR-PARSE-04 | T5 | Duplicate sources | Repeated operation | OPERATIONS_PARSED | PASS TO CLASSIFY | duplicates retained |
| PFR-PARSE-05 | T5 | Reordered unrelated operations | Same set, different order | OPERATIONS_PARSED | PASS TO CLASSIFY | order digest and indexes |
| PFR-PARSE-06 | T5 | Delete fixture | Empty destination element | OPERATIONS_PARSED | DELETE | destination offset/class |
| PFR-PARSE-07 | T5 | Interior empty element | Empty between operations | Parser-defined | PASS OR BLOCKED by approved vector | exact boundaries |
| PFR-PARSE-08 | T5 | Rename fixture | Missing destination field | BLOCKED | MALFORMED | consumed/unconsumed bytes |
| PFR-PARSE-09 | T5 | Invalid surrogate encoding | Unpaired/unsupported UTF-16 | BLOCKED | MALFORMED | code-unit offset |
| PFR-PARSE-10 | T5 | Truncated vector | Odd length or missing terminator | BLOCKED | MALFORMED | byte length |
| PFR-PARSE-11 | T5 | `*1` test vector | Undocumented modifier | BLOCKED | UNKNOWN PREFIX | prefix bytes |
| PFR-PARSE-12 | T5 | `*9` test vector | Unrecognized modifier | BLOCKED | UNKNOWN PREFIX | prefix bytes |
| PFR-PARSE-13 | T5 | Extra final NUL vector | Ambiguous terminator | BLOCKED until approved | BLOCKED | boundary trace |
| PFR-PARSE-14 | T5 | Empty canonical vector | Only valid list terminator | OPERATIONS_PARSED | ZERO OPERATIONS | exact bytes |
| PFR-PARSE-15 | T5 | Max within limit | Max operation count | OPERATIONS_PARSED | PASS TO CLASSIFY | count/time/memory |
| PFR-PARSE-16 | T6 | Parser deadline test | Budget exceeded | BLOCKED | ERROR | budget evidence |
| PFR-PARSE-17 | T10 | Evidence byte mutation | Raw digest mismatch | BLOCKED | INTEGRITY FAIL | stored and observed hash |

### 16.3 Path resolver tests

| Test ID | Threat | Precondition | Input | Expected State | Expected Verdict | Evidence Required |
|---|---|---|---|---|---|---|
| PFR-PATH-01 | T4 | Isolated fixture directory | Ordinary DOS path | Path classified | RESOLVED_LOCAL | final path, volume, File ID |
| PFR-PATH-02 | T4 | Isolated fixture directory | Non-existent DOS leaf | Path classified | RESOLVED_NONEXISTENT_LOCAL | ancestor identity and tail |
| PFR-PATH-03 | T4 | Extended-length fixture | `\\?\...` path | Path classified | RESOLVED_LOCAL | canonical path |
| PFR-PATH-04 | T4 | NT-path fixture | Supported `\??\...` mapping | Path classified | RESOLVED_LOCAL | conversion evidence |
| PFR-PATH-05 | T4 | UNC input | UNC or `\\?\UNC\` | BLOCKED | UNSUPPORTED_NAMESPACE | namespace class |
| PFR-PATH-06 | T4 | Volume GUID fixture | Volume GUID path | Path classified | RESOLVED_LOCAL | volume GUID/serial |
| PFR-PATH-07 | T4 | Device path fixture | `\Device\HarddiskVolumeX` | Resolve or block | RESOLVED_LOCAL or UNKNOWN | mapping evidence |
| PFR-PATH-08 | T4 | 8.3 fixture | Short name | Path classified | RESOLVED_LOCAL | long/final path |
| PFR-PATH-09 | T4 | Case fixture | Different case | Same identity | RESOLVED_LOCAL | case-insensitive comparison evidence |
| PFR-PATH-10 | T4 | Trailing-dot fixture | Ambiguous Win32 normalization | BLOCKED | AMBIGUOUS_PATH | raw and normalized forms |
| PFR-PATH-11 | T4 | Trailing-space fixture | Ambiguous name | BLOCKED | AMBIGUOUS_PATH | raw and normalized forms |
| PFR-PATH-12 | T4 | Junction fixture | Junction in path chain | BLOCKED | UNKNOWN_NAMESPACE | reparse tag/path |
| PFR-PATH-13 | T4 | Symlink fixture | Symbolic link | BLOCKED | UNKNOWN_NAMESPACE | reparse tag/target identity |
| PFR-PATH-14 | T4 | Mount-point fixture | Mount point alias | BLOCKED | UNKNOWN_NAMESPACE | reparse volume relation |
| PFR-PATH-15 | T4 | Hard-link fixture | Same File ID via second path | Identity matched | CONFLICT if protected | volume/File ID pair |
| PFR-PATH-16 | T4 | ADS fixture | Named stream path | BLOCKED | UNSUPPORTED_NAMESPACE | ADS classification |
| PFR-PATH-17 | T4 | Relative input | Relative path | BLOCKED | MALFORMED_PATH | input bytes |
| PFR-PATH-18 | T4 | Env-var input | `%VAR%`/`$env` | BLOCKED | UNEXPANDED_PATH | unexpanded bytes |
| PFR-PATH-19 | T4 | Missing parent | No existing ancestor except volume root | Path classified safely or blocked | RESOLVED_NONEXISTENT_LOCAL or UNKNOWN | ancestor identity |
| PFR-PATH-20 | T4 | Two volumes same suffix | Different volumes | No identity equality | RESOLVED_LOCAL | two volume identities |
| PFR-PATH-21 | T4 | Path changes between checks | Reparse retarget race | BLOCKED | AMBIGUOUS_PATH | before/after handles |
| PFR-PATH-22 | T4 | Unknown filesystem/volume | Unresolvable volume | BLOCKED | UNKNOWN_NAMESPACE | API error |

### 16.4 Protected-conflict tests

| Test ID | Threat | Precondition | Input | Expected State | Expected Verdict | Evidence Required |
|---|---|---|---|---|---|---|
| PFR-CONFLICT-01 | T3 | Protected project root manifest | DELETE project root | BLOCKED | FAIL | operation/path/conflict pair |
| PFR-CONFLICT-02 | T3 | Protected project root manifest | DELETE project child | BLOCKED | FAIL | operation/path/conflict pair |
| PFR-CONFLICT-03 | T3 | Exact protected object fixture | DELETE protected file | BLOCKED | FAIL | object identity |
| PFR-CONFLICT-04 | T3 | Isolated project tree | RENAME source inside to outside | BLOCKED | FAIL | source relation |
| PFR-CONFLICT-05 | T3 | Isolated project tree | RENAME source outside to destination inside | BLOCKED | FAIL | destination relation |
| PFR-CONFLICT-06 | T3 | Protected child | Rename/delete ancestor directory | BLOCKED | FAIL | ancestor relation |
| PFR-CONFLICT-07 | T3 | Toolchain manifest | DELETE CL/LINK/MIDL input | BLOCKED | FAIL | toolchain entry conflict |
| PFR-CONFLICT-08 | T3 | Build output manifest | DELETE generated/object/output root | BLOCKED | FAIL | output relation |
| PFR-CONFLICT-09 | T4 | Hard-link fixture | Different path, same File ID | BLOCKED | FAIL | volume/File ID |
| PFR-CONFLICT-10 | T4 | Two-volume fixture | Same suffix, different volume | Classification complete | PASS NON-CONFLICT | both volume identities |
| PFR-CONFLICT-11 | T4 | Unknown path fixture | Unresolved path | BLOCKED | UNKNOWN | resolver diagnostic |
| PFR-CONFLICT-12 | T3 | Multi-operation vector | One safe and one conflict | BLOCKED | FAIL | only conflicting operation required to fail all |

### 16.5 Build-window tests

| Test ID | Threat | Precondition | Input | Expected State | Expected Verdict | Evidence Required |
|---|---|---|---|---|---|---|
| PFR-WATCH-01 | T1 | Test key, no changes | Stable test build | PASSED | PASS FOR WINDOW | before/after bytes, no event |
| PFR-WATCH-02 | T2 | Watcher armed | Change before pre-snapshot completes | INVALIDATED | INVALIDATED | event/read timing |
| PFR-WATCH-03 | T2 | Valid pre-snapshot | Change during parsing | INVALIDATED | INVALIDATED | event timestamp |
| PFR-WATCH-04 | T2 | READY_FOR_BUILD | Change just before spawn | INVALIDATED | INVALIDATED | final check and event |
| PFR-WATCH-05 | T2 | BUILD_WINDOW_ACTIVE | Change during build | INVALIDATED | INVALIDATED | event and cancellation evidence |
| PFR-WATCH-06 | T2 | Build exited | Change before post-snapshot | INVALIDATED | INVALIDATED | event and snapshot ordering |
| PFR-WATCH-07 | T1 | Other value changed in key | Unrelated key value update | INVALIDATED | INVALIDATED | conservative Key-level event |
| PFR-WATCH-08 | T2 | Value changes and returns | Before/after bytes equal | INVALIDATED | INVALIDATED | event remains signaled |
| PFR-WATCH-09 | T6 | Test watcher thread | Inject thread crash | UNKNOWN | UNKNOWN | thread termination evidence |
| PFR-WATCH-10 | T6 | Test gate process | Close event/notify handle | UNKNOWN | UNKNOWN | handle state |
| PFR-WATCH-11 | T6 | Kill host during build | No post evidence | UNKNOWN | UNKNOWN | incomplete evidence bundle |
| PFR-WATCH-12 | T2 | Event signaled | Pre/post same | INVALIDATED | INVALIDATED | hash equality cannot override |
| PFR-WATCH-13 | T2 | No event delivered | Pre/post differ | INVALIDATED | INVALIDATED | raw difference |
| PFR-WATCH-14 | T2 | Build exit 0, event signaled | Outputs created | INVALIDATED | INVALIDATED | Build ID and event |
| PFR-WATCH-15 | T2 | Build exit nonzero, no event | Stable PFR | BUILD_FAILED | BUILD FAIL; PFR STABLE | exit code plus snapshots |
| PFR-WATCH-16 | T6 | Post snapshot read error | Build exit 0 | UNKNOWN | UNKNOWN | error evidence |
| PFR-WATCH-17 | T6 | Evidence finalization fails | Build exit 0 | BLOCKED | BLOCKED | write error |
| PFR-WATCH-18 | T2 | Two notifications coalesce | Change multiple times | INVALIDATED | INVALIDATED | one event is sufficient |

### 16.6 Policy/evidence binding tests

| Test ID | Threat | Precondition | Input | Expected State | Expected Verdict | Evidence Required |
|---|---|---|---|---|---|---|
| PFR-EVID-01 | T10 | Build A evidence | Replay for Build B | BLOCKED | REPLAY REJECTED | Build ID mismatch |
| PFR-EVID-02 | T10 | Valid snapshot | Machine identity differs | BLOCKED | REPLAY REJECTED | machine binding mismatch |
| PFR-EVID-03 | T10 | Valid snapshot | Windows build identity differs | BLOCKED | REPLAY REJECTED | build identity mismatch |
| PFR-EVID-04 | T8 | Manifest generation 7 approved | Generation 6 supplied | BLOCKED | ROLLBACK | generation ledger |
| PFR-EVID-05 | T8 | Expired manifest | Date after expiry | BLOCKED | EXPIRED | timestamps |
| PFR-EVID-06 | T10 | Manifest hash pinned | One manifest byte modified | BLOCKED | HASH MISMATCH | expected/actual |
| PFR-EVID-07 | T10 | Snapshot evidence | Raw bytes omitted | BLOCKED | INCOMPLETE EVIDENCE | missing reference |
| PFR-EVID-08 | T10 | Snapshot evidence | Hash/length inconsistent | BLOCKED | INTEGRITY FAIL | fields |
| PFR-EVID-09 | T10 | Ordinary log output | Full paths present without need | Diagnostic failure | REDACTION FAILURE | log schema |
| PFR-EVID-10 | T10 | Evidence directory ACL | Unauthorized reader/writer | BLOCKED | ACL FAIL | access test |

## 17. Existing Architecture Consistency

### 17.1 Current PFR call sites

Current files:

```text
tools/native-rpc/p13-a1-r2/build.ps1
tools/native-rpc/p13-a1-r2/build-b4.ps1
tools/native-rpc/p13-a1-r2/verify-static.ps1
tools/native-rpc/p13-a1-r2/verify-static-b4.ps1
```

Current behavior:

- reads the PFR logical string array;
- computes SHA-256 over UTF-16LE/NUL joined strings;
- requires exactly 46 strings and the historical digest before proceeding;
- re-reads after build;
- fails if the pre/post digest or count changes;
- records only count and SHA-256 in current manifests/evidence.

Current behavior is:

```text
READ-ONLY
GLOBAL-EXACT
BEFORE/AFTER ONLY
FAIL-CLOSED
NO CONTINUOUS WATCH
NO STRUCTURED OPERATION PARSE
NO VOLUME/FILE-ID PATH CONFLICT ENGINE
```

Because the live state is not the historical digest, no existing build path can
proceed. BV6 does not change that.

### 17.2 Protected objects

The six current protected hashes match:

```text
FZ        E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705
ST        5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586
DBTP      FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7
Prisma    78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299
next-env  0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC
tsbuild   21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520
```

The dynamic policy must supplement, not replace, these checks.

### 17.3 R5-R3A boundary

R8 reserves only a Build-only scope for R5-R3A:

- exact pure KeySet/Bundle/Ready contract sources;
- compile only;
- no Host/Worker service implementation;
- no Ledger/Anchor/test-only RPC implementation;
- no Native execution.

No R5-R3A source or build script currently exists. The future PFR policy may be
a prerequisite to that Build-only phase, but it cannot expand R5-R3A scope or
grant Runtime.

### 17.4 D1 and Windows-only scope

```text
D1 v1:
FROZEN / UNCHANGED

D1 v2:
NOT AUTHORIZED

Windows-only policy:
IN SCOPE

Linux v1:
OUT OF SCOPE / NOT IMPLEMENTED / NOT VERIFIED
```

### 17.5 Build-output side effects

Current build scripts create output directories, compile objects, link binaries
and write logs before the post-build PFR comparison. A change during the build
can therefore leave artifacts already on disk even when the final PFR check
fails.

Policy C must prevent those outputs from being treated as gate-admitted. It
does not retroactively prevent every file-system side effect.

### 17.6 PFR policy version in the authorization chain

Future Build authorization should include:

```text
Policy ID
Policy Version
Policy Source Hash
Protected Manifest ID/Hash/Generation
Build ID
Gate Invocation ID
```

A Build authorization that omits these fields does not authorize the dynamic
policy path.

### 17.7 Git baseline

Before adding either BV6 document:

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

Tracked modified:
26

Untracked files:
258

Staged:
0

Deleted:
0
```

This stage adds only the two requested design documents. The expected
post-write untracked-file count is 260. No Git write was performed.

## 18. Remaining Risks

```text
RISK-01:
Exact raw PFR terminator parsing is not fully proven.

RISK-02:
Observed `*1`/`*2` prefix meaning is not defined by the reviewed official
documentation.

RISK-03:
The protected-path manifest trust root and generation ledger are not yet
approved.

RISK-04:
The complete compiler/linker runtime module closure is not yet inventoried.

RISK-05:
Windows notification is key-wide and has no writer identity.

RISK-06:
No registry operation is atomic with build-process creation.

RISK-07:
A compromised Administrator/SYSTEM/kernel/host is outside the trust model.

RISK-08:
A PFR operation added after the build and before the next reboot is outside
this build-window policy.

RISK-09:
Current build scripts leave artifacts on disk before the post-build decision.

RISK-10:
No implementation or test execution exists in BV6.
```

These risks do not permit amending the verdict to unconditional PASS.

## 19. Decision Summary

The companion document contains the full decision register.

Headline decisions:

```text
DD-01:
Fixed global hash retained for history/forensics only.

DD-02:
Exact snapshot exception retained only as an emergency/manual mechanism.

DD-03:
Controlled Dynamic PFR Baseline conditionally recommended.

DD-04:
Exact raw bytes, type and length are authoritative.

DD-05:
Watcher must precede the first snapshot and run through post-snapshot.

DD-06:
Unknown parser/path/manifest state blocks.

DD-07:
Manual conflict/monitor override is forbidden.

DD-08:
Current 38/19 remains a candidate, not an approved baseline.

DD-09:
No Build Gate implementation is authorized by BV6.

DD-10:
BV7 independent adversarial review is the required next gate.
```

## 20. Final Verdict

```text
Overall:
PASS WITH WARNINGS — POLICY DESIGN COMPLETE; INDEPENDENT REVIEW REQUIRED

Policy A:
HISTORICAL/FORENSIC USE ONLY

Policy B:
EXACT EMERGENCY USE ONLY

Policy C:
CONDITIONALLY RECOMMENDED

Current Build Gate:
UNCHANGED / FAIL-CLOSED

Current 38/19:
CANDIDATE ONLY — NOT APPROVED

PFR Exception Created:
NO

Live PFR Read In BV6:
NO

Build Gate Modified:
NO

Native Build:
NOT EXECUTED

Native Runtime:
NOT EXECUTED

Database / Storage:
NOT ACCESSED

Git Write:
NOT EXECUTED

Implementation:
NOT AUTHORIZED

Next Gate:
R6-BV7 — INDEPENDENT ADVERSARIAL PFR POLICY REVIEW
```

The conditional recommendation is not a replacement for the independent
review, an implementation authorization or a Runtime authorization.

## 21. Report Integrity

This report is one of two new BV6 design documents. It cannot contain its own
final SHA-256 without changing its bytes. The external digest is calculated
after the final write and reported with the companion document digest.
