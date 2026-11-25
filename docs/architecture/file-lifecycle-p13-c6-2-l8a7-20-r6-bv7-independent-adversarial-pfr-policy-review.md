# P1-3 C-6.2-L8-A7.20-R6-BV7
# Independent Adversarial PFR Policy Review

## 0. Executive Summary

```text
Stage:
C-6.2-L8-A7.20-R6-BV7

Date:
2026-11-23

Mode:
INDEPENDENT / READ-ONLY / ADVERSARIAL

Input:
R6-BV6 Controlled Dynamic PFR Baseline Policy Design

Final Verdict:
FAIL — BLOCKING DESIGN CORRECTIONS REQUIRED

Review Independence:
PASS

BV6 Input Integrity:
PASS

Policy C Recommendation:
NOT READY FOR IMPLEMENTATION

Current Build Gate:
UNCHANGED / FAIL-CLOSED

Current 38/19:
CANDIDATE ONLY — NOT APPROVED

Live PFR Registry Read:
NOT PERFORMED

Native Build / Runtime:
NOT EXECUTED

P0:
0

P1:
6

P2:
5

P3:
2
```

BV6 performs a useful and substantially more rigorous redesign than the old
global fixed-hash check. Its one-shot notification design also avoids the
common re-arm gap: because any notification invalidates the entire attempt and
the watcher is not reset or re-armed, a normal `REG_NOTIFY_CHANGE_LAST_SET`
event cannot be hidden by restoring the value before the post-snapshot.

That specific change-and-restore attack is therefore not a P1 in the ordinary
API path. However, Policy C is not safe to implement because six core security
properties remain unresolved:

1. The raw `REG_MULTI_SZ` operation-boundary grammar is not defined.
2. The observed `*1\??\` and `*2\??\` prefixes have no authoritative meaning.
3. The Protected Path Manifest has no established trust root, approval
   authority or rollback ledger.
4. Non-existent and mutable path namespaces can become aliases of protected
   paths after the gate check and before the deferred PFR operation executes.
5. The build toolchain dependency closure is incomplete.
6. The unique Build Entry and non-bypass property do not exist.

Each can prevent a P1 security property or can make a dangerous deferred
operation appear safe. BV6 labels several of these as open design blockers, but
then recommends Policy C conditionally. Under this review's required standard,
an open blocker that can lead to a false PASS is a P1 finding, not merely a
warning.

The current fixed-hash gate remains fail-closed and was not changed. BV6 did not
read the live PFR, approve the 38/19 candidate, create an exception, compile
Native RPC code or execute Runtime.

## 1. Authorization and Scope

Authorized:

- independently review both BV6 design documents;
- verify their sizes and SHA-256 values;
- read historical PFR evidence and current architecture/source;
- inspect official Microsoft API documentation;
- trace current Build Gate call sites;
- construct theoretical attacks and a verification matrix;
- add this review report.

Not authorized or performed:

- reading the current PFR registry value;
- modifying PFR or any registry data;
- approving an exception or the current 38/19 state;
- changing BV6 or other historical reports;
- modifying Build Gate, source, IDL, tests, manifests or build configuration;
- changing `$null` or calculating its hash;
- database, Storage, Service, ACL, IAM or audit-policy operations;
- MIDL, MSVC, Build or Native RPC Runtime;
- Git write operations.

Only this review file was added.

## 2. Independent Review Method

Method:

1. Verified the BV6 document identity against the requested historical hashes.
2. Re-read each security objective and rejected the BV6 self-conclusion as
   evidence.
3. Reconstructed the actual current PFR call sites and Build Entries.
4. Retrieved the relevant official Microsoft API semantics.
5. Tested each claimed control against a false-PASS attack.
6. Distinguished:
   - confirmed source-level integration absence;
   - design-level counterexamples;
   - unproven but security-critical properties;
   - acceptable out-of-scope administrator threats.
7. Required every unresolved state to map to BLOCKED, INVALIDATED or UNKNOWN.
8. Assigned P0/P1/P2/P3 without treating the design test matrix as executed
   evidence.

Independence limitation:

- The review is a separate static design review inside the same Codex product
  session, not a separate human assessor or external laboratory.
- No real PFR, compiler or Runtime test was authorized.
- Current live PFR was not read; only BV5 historical evidence was used.

This is sufficient for the present document-level adversarial review because
the blocking parser, prefix, manifest, toolchain, path-lifetime and Build Entry
properties are unresolved in the design/source themselves.

## 3. Skills Invoked

The root `AGENTS.md` route was applied.

Skills actually read and used:

- `$project-architecture`
  - traced Build Entry ownership and separated Web/Worker build integrity from
    Native RPC Harness PFR preflight;
  - preserved D1 v1 and R5-R3A boundaries.
- `$security-audit`
  - attacked authorization, trust root, evidence, path and process boundaries;
  - separated false-PASS candidates from lower-severity implementation risks.
- `$testing-and-verification`
  - evaluated whether each security claim had executable evidence;
  - converted unverified properties into required future verification rather
    than assuming them.
- `$file-lifecycle`
  - applied object identity, non-following path checks, Reparse Point
    rejection, exact evidence and UNKNOWN preservation.

## 4. Input Document Integrity

| Input | Expected SHA-256 | Actual SHA-256 | Result |
|---|---|---|---|
| BV6 main design | `6B23D81A99A34F5DD46CA06D2B1B9C4B310E4DAEA269BFFBED3610EA07700996` | same | PASS |
| BV6 decisions | `DA1083B7E845D556DD21B5B09C3512673B850B63210045E4A7756BAF10F79A0D` | same | PASS |

Observed lengths:

```text
BV6 main design: 65,205 bytes
BV6 decisions:   30,560 bytes
```

Cross-input hashes used:

| Input | SHA-256 |
|---|---|
| BV5 forensic review | `8D5EB4959E4F820806DF71940E95266B09C6CFCF844E28872C2B5EE90BFF40AF` |
| BV4-R1 | `0ABDA4FDFE469F43B7431B14AF1C235EBE1C6E6B6D0E8148963402CF8728F17B` |
| BV3 | `33BDAFEFA4254D86787B547DFBCA531300D7E6A64F6D5F74E415D285F3A868F0` |
| R7 | `A9951A0455AF3AC6D85DBA327271CB326192E5CA61BFC6FA62830786C84170BF` |
| R8 | `6FAF4AF2638A9D6D41727049703DF3B0F240D0233A04AD7466679F84A44A27DA` |
| R8 decisions | `F2A539A6E8E2F35C82C7D040F8D98F0E5BB604FABD18BEF41ED5DE95F4FC4C40` |
| R3-R5 installation | `1909BBA2D325EC4D719F177B699BEAA44C1526554B31B0DE8197D1BC0EE33178` |
| D1 v1.0 | `5A9A5E0659C6DA8228836D024C66E12B0A424E9E6D6663AFFF42B9F065149ADE` |
| B1 report | `FC55B8A0E24419D5DE9AB0C2CC3FDA258B1EB4C56FA62B165F3B4D26B3B8F434` |
| B4 report | `63A4A0CE15FDE7E1EA299200B1C3EBF77D1457CD538F59094998162AB2895A6A` |

Git baseline before adding this report:

```text
Branch:           feature/p1-3-storage-lifecycle-schema
HEAD:             b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 26
Untracked files:  260
Staged:           0
Deleted:          0
```

Expected untracked count after adding this report:

```text
261
```

## 5. Microsoft API Semantics

### 5.1 MoveFileExW

Source:

```text
https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw
```

Verified statements:

- `MOVEFILE_DELAY_UNTIL_REBOOT` stores the operation for restart.
- Delayed operations cannot target a remote share because they run before the
  network is available.
- The value is `REG_MULTI_SZ`.
- The documented forms are:

```text
szSrcFile \0\0
szSrcFile \0 szDstFile \0
```

- Empty destination means deletion.
- Operations are completed at restart in issue order.
- MoveFileEx success proves registration success, not future delete/rename
  success.
- A directory marked for deletion is removed only if empty.

### 5.2 RegQueryValueExW

Source:

```text
https://learn.microsoft.com/en-us/windows/win32/api/winreg/nf-winreg-regqueryvalueexw
```

Verified statements:

- `KEY_QUERY_VALUE` is required.
- If the buffer is too small, `ERROR_MORE_DATA` is returned and the data buffer
  contents are undefined.
- String values returned by `RegQueryValueEx` are not guaranteed to be
  null-terminated.
- `REG_MULTI_SZ` should have two terminating null characters.
- The size may include null terminators unless the value was stored without
  them.

BV6 correctly treats exact returned bytes and length as authoritative and
prohibits parsing a partially filled `ERROR_MORE_DATA` buffer.

### 5.3 RegNotifyChangeKeyValue

Source:

```text
https://learn.microsoft.com/en-us/windows/win32/api/winreg/nf-winreg-regnotifychangekeyvalue
```

Verified statements:

- `KEY_NOTIFY` is required.
- The function detects a single change notification.
- `REG_NOTIFY_CHANGE_LAST_SET` reports adding/deleting/changing a value in the
  key.
- Notification is key-level, not value-name-specific.
- Asynchronous mode signals the event.
- If the key handle is closed, the event is signaled.
- If the registering thread exits, the event is signaled unless
  `REG_NOTIFY_THREAD_AGNOSTIC` is used.
- The function must normally be called on a persistent thread.
- `REG_NOTIFY_THREAD_AGNOSTIC`, supported on Windows 8+, decouples registration
  lifetime from the thread.
- `RegNotifyChangeKeyValue` cannot detect changes caused by `RegRestoreKey`.

### 5.4 RegRestoreKeyW

Source:

```text
https://learn.microsoft.com/en-us/windows/win32/api/winreg/nf-winreg-regrestorekeyw
```

Verified statements:

- the calling process needs `SE_RESTORE_NAME` and `SE_BACKUP_NAME`;
- restore replaces values/subkeys beneath the target key from a hive file;
- `RegNotifyChangeKeyValue` does not report this API's changes.

This places the blind spot inside BV6's excluded Administrator/SYSTEM/kernel
threat boundary, but the blind spot still needs explicit disclosure and a
reviewed disposition because the build host may be operated under an elevated
administrator account.

## 6. RegNotifyChangeKeyValue Adversarial Review

### 6.1 Registration lifecycle

BV6 requires:

```text
manual-reset event
-> open KEY_NOTIFY handle
-> RegNotifyChangeKeyValue
-> confirm registration success
-> read pre-snapshot
-> keep event armed
-> read post-snapshot
-> check no event
-> close handles only after the window closes
```

### 6.2 Re-registration attack from the review brief

The requested attack sequence assumes that the watcher:

1. receives an event;
2. processes it;
3. re-registers;
4. then another change happens.

BV6 does not re-register after an event:

```text
First event -> INVALIDATED
```

Because the event is manual-reset and the attempt is not allowed to continue,
the change between event processing and re-registration cannot be hidden. The
safe design is to end monitoring of that attempt rather than create a new
coverage interval.

Conclusion:

```text
NO RE-ARM GAP IN THE PROPOSED ONE-SHOT CONTROL
```

### 6.3 Thread lifetime

The official API signals the event when the calling thread exits unless
`REG_NOTIFY_THREAD_AGNOSTIC` is used. BV6 says watcher-thread exit is monitor
loss but does not state whether the implementation must:

- omit `REG_NOTIFY_THREAD_AGNOSTIC`;
- use a dedicated persistent thread;
- or use the flag and add a separate heartbeat/health proof.

If an implementation uses the flag without an independent liveness proof, a
watcher-thread death could leave the event unsignaled while the host and build
continue. That can become a false PASS.

This is a required design correction, but the current BV6 default concept is
close to the safe behavior.

### 6.4 Event coalescing

Multiple value changes may coalesce into one signaled manual-reset event. That
is safe for this policy because one signal is sufficient to invalidate the
attempt.

### 6.5 Key-level false positives

Any other value beneath `Session Manager` can signal the event. BV6 correctly
records this as conservative INVALIDATED behavior and does not attribute the
event to the PFR value.

### 6.6 Handle closure and parent exit

Official semantics say closing the key signals the event. Parent/host exit
destroys the evidence chain and cannot produce PASS. BV6's state machine maps
that case to UNKNOWN/incomplete evidence.

### 6.7 Verdict

For normal `REG_NOTIFY_CHANGE_LAST_SET` changes, BV6's one-shot conservative
model is directionally sound. Continuous monitoring is not accepted as proven
until the persistent-thread/thread-agnostic behavior is normative and tested.

## 7. RegRestoreKey Coverage

BV6 does not mention `RegRestoreKey`.

Attack:

```text
T0: watcher armed
T1: privileged process restores Session Manager registry content
T2: no normal RegNotifyChangeKeyValue event is delivered
T3: build executes
T4: post-snapshot
```

If the restored final PFR differs, the post-snapshot catches the difference.
If the value is restored to the original bytes, the final PFR may be safe even
though the intermediate change was invisible.

The inability to observe `RegRestoreKey` is nevertheless a limitation of any
claim that the Registry Key remained unchanged continuously.

Required applicability:

```text
Trusted administrator/system behavior:
OUT OF SCOPE

Continuous-monitoring claim:
MUST EXPLICITLY EXCLUDE RegRestoreKey
```

If build users operate as administrators and are considered untrusted, the
policy cannot claim resistance to this path.

## 8. REG_MULTI_SZ Parser Adversarial Review

### 8.1 BV6 state

BV6 correctly rejects:

- generic split-only parsing;
- duplicate removal;
- string trimming;
- terminator repair;
- ignoring unknown operations;
- hashing without exact bytes.

It also identifies:

```text
OPEN DESIGN BLOCKER — RAW REG_MULTI_SZ TERMINATOR FORM NOT FULLY PROVEN
```

### 8.2 Attack A — Final delete/list terminator conflation

Raw bytes near the end of a value can contain multiple consecutive NUL code
units. One may delimit the empty destination of DELETE; another may terminate
the registry multi-string.

A parser that removes the list terminator in the wrong order can:

- consume the DELETE destination as the list terminator;
- merge or drop the final operation;
- shift subsequent source/destination pairing;
- treat an empty source as data completion;
- report fewer operations than actually remain.

Because PFR operations execute in order and delete/rename semantics depend on
pairing, a pair-shift can change the protected-path classification.

### 8.3 Attack B — Interior empty item

An empty destination between two operations can be interpreted as:

- valid DELETE destination;
- malformed interior empty string;
- an early list terminator;
- padding inserted by a non-MoveFileEx writer.

The reviewed official documentation does not provide a complete parser
state-machine for every combination.

### 8.4 Attack C — Missing or extra terminator

`RegQueryValueExW` may return a string without the expected terminating nulls.
BV6 prohibits automatic repair, but its exact grammar is not specified. A
parser implementation has no approved mapping from each malformed raw form to
MALFORMED versus a valid internal empty operation.

### 8.5 Attack D — Non-MoveFileEx writer

The official documentation describes MoveFileEx's representation. It does not
prove that every writer of the registry value preserves the same canonical
form. A third-party installer or privileged utility may write a logically
similar but byte-different value.

BV6 must either:

- define accepted raw PFR forms with evidence; or
- block all forms not proven.

### 8.6 Finding

The parser open blocker is security-critical because the current design cannot
demonstrate that every source/destination pair is recovered exactly.

```text
P1-01 — RAW PFR OPERATION BOUNDARY GRAMMAR NOT ESTABLISHED
```

## 9. Special Prefix Evidence

### 9.1 Observed prefixes

Historical evidence contains:

```text
*1\??\C:\...
*2\??\C:\...
```

The current source tree and installed Windows SDK/MSVC search produced no
definition of `*1` or `*2`. The reviewed Microsoft MoveFileEx page does not
define them.

### 9.2 Attack

A parser could assume:

```text
*1 or *2 = ignorable operation metadata
```

then strip it and resolve the remaining `\??\C:\...`.

If the modifier changes namespace interpretation, operation type, target
selection or path processing, the stripped result can point to a different
object. That could cause a protected path to be classified as safe.

### 9.3 Current historical values use the prefixes

The real historical queue is dominated by these prefixes. Blocking them means
Policy C cannot currently reach PASS for the observed state. Allowing them
without semantics would create an unproven false-PASS path.

### 9.4 Finding

```text
P1-02 — PFR SPECIAL PREFIX SEMANTICS UNVERIFIED
```

BV6 correctly labeled the issue open, but an implementation blocker of this
class prevents Policy C from being accepted.

## 10. Protected Manifest Trust Root

### 10.1 What BV6 provides

BV6 proposes:

- Manifest ID, version and generation;
- exact approved hash;
- trust root ID;
- approval authority;
- expiry;
- rollback denial;
- signature/attestation reference;
- protected path entries.

### 10.2 What is still absent

- no concrete trust root;
- no key owner;
- no approval authority;
- no separation between proposer, signer and approver;
- no monotonic-generation source;
- no revocation mechanism;
- no approved complete path list;
- no policy for emergency changes;
- no described Build Gate implementation that validates the manifest.

BV6 explicitly records:

```text
OPEN — REQUIRES INDEPENDENT REVIEW
```

### 10.3 Attack A — Omit protected path

If the manifest is mutable or self-approved, an attacker can publish a valid
manifest that omits:

- the project root;
- one of the six protected objects;
- a compiler DLL;
- the build output root.

PFR path classification then sees no conflict and may PASS.

### 10.4 Attack B — Rollback

Generation 10 is stricter than generation 9. The gate is given a validly signed
generation 9 manifest and accepts it because no external monotonic state is
defined.

### 10.5 Attack C — Same generation replacement

Two different manifest bodies claim generation 10. Without a trusted
generation ledger or monotonic anchor, the gate cannot determine which is
authoritative.

### 10.6 Attack D — Revoked signer

A correctly signed old manifest remains accepted after its signer is revoked.

### 10.7 Finding

```text
P1-03 — PROTECTED MANIFEST TRUST ROOT NOT ESTABLISHED
```

Without a trusted protected-path set, the dynamic policy's core conflict
control has no root of trust.

## 11. Windows Path Resolver Attacks

### 11.1 Positive design properties

BV6 correctly proposes:

- volume and File ID;
- final normalized path;
- handle-based existing-object checks;
- non-following final components;
- rejection of UNC, ADS, relative and unknown namespaces;
- handling hard links by identity;
- checking ancestors and descendants;
- blocking ambiguous paths.

### 11.2 Attack A — Missing source becomes a protected alias later

At gate time:

```text
PFR operation:
DELETE D:\scratch\victim

Current state:
D:\scratch\victim does not exist
D:\scratch is a normal non-protected directory

BV6 classification:
RESOLVED_NONEXISTENT_LOCAL / NO_CONFLICT
```

After the gate passes but before the next reboot:

```text
an attacker/user changes D:\scratch or a component below it into a
Junction/Symlink/Mount Point relationship to the protected project tree
```

At boot:

```text
D:\scratch\victim may resolve into the protected namespace
```

The PFR Registry watcher does not observe filesystem reparse changes. The Build
Gate already accepted the path classification.

### 11.3 Attack B — Existing non-protected object is replaced after resolution

At gate time, the DELETE source is a non-protected ordinary file. After the gate
but before reboot, the directory entry or parent path can be replaced.

BV6 retains only a point-in-time identity for the object it opened. PFR stores
a path string, not the object File ID. There is no mechanism that guarantees
the boot-time path resolves to the same checked object.

### 11.4 Attack C — Drive-letter remapping across reboot

The PFR string may use a drive letter. The gate resolves it to a volume and
File ID in the current boot. After reboot, the same drive letter can map to a
different volume or mount-point namespace.

BV6's `VolumeIdentity` improves current-path comparison, but it does not bind
the future boot-time drive-letter mapping.

### 11.5 Attack D — Path becomes protected after build

The snapshot may contain a DELETE of an ordinary temporary file. A protected
file can be moved to that exact path after the build, and the reboot operation
can then remove it. This is not a PFR Registry change and does not signal the
registry watcher.

### 11.6 Why the existing mitigations fail

- PFR watcher monitors the Registry, not the filesystem.
- Non-following handles protect only the object opened during the check.
- Missing-path canonicalization proves only the current namespace.
- The design explicitly allows `RESOLVED_NONEXISTENT_LOCAL`.
- It defines no pre-reboot filesystem revalidation.
- It defines no immutable namespace for unrelated PFR targets.

### 11.7 Finding

```text
P1-04 — PATH-TO-OBJECT BINDING DOES NOT SURVIVE TO DEFERRED EXECUTION
```

BV6's T9 risk says the path can change before reboot but does not convert that
risk into a blocking decision. Under the required fail-closed standard,
non-existent or mutable path namespaces cannot be treated as no-conflict
without an additional proof.

## 12. Build Toolchain Dependency Closure

### 12.1 Current evidence

The current native build scripts pin:

- MIDL;
- CL;
- LINK;
- DUMPBIN;
- selected SDK headers;
- selected import libraries.

They also set or inherit:

- include roots;
- library roots;
- PATH;
- temporary/output roots.

### 12.2 What is missing

BV6 does not provide:

- the complete runtime DLL closure of CL/LINK/MIDL/DUMPBIN;
- helper processes launched by the compiler/linker;
- loader search-order evidence;
- all response files;
- all include/library files actually opened;
- all delayed-loaded compiler plug-ins;
- the exact resolved system DLL set.

BV6 correctly labels this open, but the protected-path classification can still
PASS a DELETE/RENAME of an unlisted dependency.

### 12.3 Attack

```text
A PFR operation deletes or renames a compiler helper DLL that is not listed in
the manifest.

The path resolver finds no protected conflict because the dependency is absent
from the manifest.

The Build Gate passes.

The next build after reboot fails or loads a replacement from another search
path.
```

The exact impact may be availability, toolchain substitution or both depending
on write permissions and loader behavior.

### 12.4 Finding

```text
P1-05 — BUILD TOOLCHAIN DEPENDENCY CLOSURE NOT VERIFIED
```

Protecting only executable names or installation roots does not prove all
critical build inputs are represented.

## 13. Build Gate Integration and Bypass Analysis

### 13.1 Current Build Entries

Current Web/Worker build:

```text
package.json
  build -> pnpm -r build

apps/web/package.json
apps/worker/package.json
  build -> tsx scripts/build-secure.ts
```

These run `runBuildSecurityPreflight` and `executeGuardedBuild` from
`@elevator/build-integrity`. Their current source-security gate does not inspect
PFR.

Native RPC build:

```text
tools/native-rpc/p13-a1-r2/build.ps1
tools/native-rpc/p13-a1-r2/build-b4.ps1
```

These are standalone PowerShell entry scripts. The root package build does not
invoke them.

No `build-r5-r3a.ps1` currently exists. R8 defines it only as a future Build-only
path.

### 13.2 Current PFR check location

In `build.ps1`:

```text
line 27:  creates output/log directories
line 96:  reads PFR
line 99:  compares the fixed 46/23 historical digest
line 229: reads PFR after build
```

In `build-b4.ps1`:

```text
line 29:  creates output directories
line 110: reads PFR
line 113: compares the fixed 46/23 historical digest
line 237: reads PFR after build
```

The static verifiers also re-read PFR at:

```text
verify-static.ps1:57,95
verify-static-b4.ps1:34,93
```

### 13.3 Bypass attacks

1. Invoke `midl.exe`, `cl.exe` or `link.exe` directly with the same source and
   output paths. No current wrapper prevents it.
2. Copy or create a different build script without the PFR check.
3. Run only the compile/link steps from an IDE or ad hoc terminal.
4. Use the root/Web/Worker build path and assume its Startup/Release Gate covers
   Native RPC; it does not inspect PFR.
5. Future R5-R3A implementation may be invoked through an unlisted script path
   if a unique entry is not enforced.

### 13.4 Current BV6 behavior

BV6 states that an implementation should be integrated into the approved Harness
build entry and that a separate advisory script can be bypassed. It leaves the
actual integration point open:

```text
D-PFR-31:
OPEN — REQUIRES INDEPENDENT REVIEW
```

That is a core, not secondary, gate property.

### 13.5 Finding

```text
P1-06 — UNIQUE, UNBYPASSABLE BUILD ENTRY NOT ESTABLISHED
```

No proof currently exists that a Native RPC build cannot be produced outside a
PFR-gated entry and then presented as a controlled Build-only result.

## 14. Fail-Closed State Machine Review

BV6's decision table is generally conservative:

- parser/path/manifest uncertainty blocks;
- notification invalidates;
- monitor loss is UNKNOWN;
- build failure cannot become PFR PASS;
- manual override is forbidden.

Adversarial transition tests:

| Attack | BV6 result | Review result |
|---|---|---|
| `READY_FOR_BUILD` with dead watcher | `UNKNOWN`, no PASS | Correct if health is provable |
| `BUILD_WINDOW_ACTIVE` after monitor loss | `UNKNOWN`, no PASS | Correct |
| `INVALIDATED` retried with same snapshot | no PASS for same attempt | Correct |
| `UNKNOWN` converted to `VALIDATED` | forbidden | Correct |
| Build exit 0 with notification | `INVALIDATED` | Correct |
| Build exit nonzero with no notification | `BUILD_FAILED` | Correct |
| Pre/post changed with no notification | `INVALIDATED` | Correct |
| Pre/post same after standard change | event remains signaled | Correct one-shot behavior |
| Evidence write fails before build | `BLOCKED` | Correct |
| Evidence write fails after build | no PASS | Correct |
| Missing parser/path/manifest fact | `BLOCKED` | Correct |
| `RegRestoreKey` change/restore | no normal event | LIMITATION |
| Filesystem path alias changes after gate | no event | NOT COVERED |

The state machine's decision precedence is acceptable. The remaining failures
are missing data/time binding and inputs whose correct classification is not
proven.

## 15. Change-and-Restore Attack

Sequence:

```text
T0: PRE snapshot A
T1: PFR A -> B
T2: B -> A
T3: POST snapshot A
```

### 15.1 Standard registry write path

`REG_NOTIFY_CHANGE_LAST_SET` is registered before T0. A standard registry value
write at T1 signals the manual-reset event. The build cannot PASS even though
pre/post bytes equal.

Result:

```text
INVALIDATED
```

### 15.2 Event processing delay

If the watcher thread is delayed until after T2, the event remains signaled.
The T3 value equality cannot erase that signal.

Result:

```text
INVALIDATED
```

### 15.3 Repeated rapid changes

Multiple changes can be coalesced into a single notification. One notification
is sufficient to invalidate.

Result:

```text
INVALIDATED
```

### 15.4 RegRestoreKey

An administrator/System actor uses `RegRestoreKey` to replace the key and then
restore it. No normal LastSet event is delivered.

Result under BV6:

```text
CANNOT DETECT
```

Because this actor holds Backup/Restore privilege and is inside BV6's excluded
high-privilege boundary, this is documented as a scope limitation rather than
an independent P1.

### 15.5 Filesystem equivalent

The more important analogous attack is not a Registry change/restore. It is a
path namespace change:

```text
PFR value remains byte-identical
but an outside source path later resolves to a protected object
```

The Registry watcher cannot detect it.

Result:

```text
NOT COVERED — P1-04
```

## 16. R4/R5 Architecture Consistency

### 16.1 Windows-only scope

BV6 remains Windows-only. Linux is out of scope. No kernel driver or new
service is proposed.

### 16.2 Privilege boundary

BV6 proposes read-only registry access and no PFR mutation. It does not expand
Supervisor, Worker or Termination Executor authority.

However, `RegRestoreKey` requires Backup/Restore privileges, and no design claims
to resist that actor. This must remain explicit.

### 16.3 D1 and R5-R3A

BV6 preserves:

- D1 v1 frozen;
- D1 v2 not authorized;
- R5-R3A Build-only scope;
- no Host/Worker implementation;
- no Native Runtime.

The absence of a current `build-r5-r3a.ps1` confirms the future integration path
does not yet exist.

### 16.4 PFR Gate is not File Lifecycle Authority

BV6 keeps PFR policy separate from P13 File Lifecycle Authority. The gate has no
file deletion or cleanup authority.

### 16.5 Build outputs and post-check

Current build scripts can produce artifacts before the post-build PFR check.
BV6 states that invalidated outputs must not be treated as gate-admitted but
does not define quarantine, rename, deletion or downstream enforcement.

This is consistent with no destructive authority, but it creates a P2 evidence
and handoff risk.

## 17. Historical PFR Baseline and Exception Boundaries

```text
Historical 46/23:
HISTORICAL ONLY

Old 38/19:
54CC89DA4697363393AE7A956AF3FD689B8B3D10926955849995CD44CC286E84
EXPIRED EXACT EXCEPTION

Current 38/19:
8EE40F3606C888B3A0C93E2256D572595339785E99EF0F51EC85B36594097F3F
CANDIDATE ONLY — NOT APPROVED
```

BV5 change mechanism remains:

```text
STRONGLY SUPPORTED
```

It was not upgraded to `CONFIRMED`.

BV7 did not read the live PFR, accept 38/19, revive the old exception, modify a
PFR Build Gate or approve `$null`.

## 18. Findings

### P1-01 — Raw PFR Operation Boundary Grammar Not Established

```text
Finding ID:
P1-01

Severity:
P1

Affected BV6 Section:
§4.3, §8.3–8.4, §9.3–9.6

Affected Decision ID:
D-PFR-06, D-PFR-07, D-PFR-11, D-PFR-12, D-PFR-14

Security Property:
Every operation source/destination pair is decoded exactly from the returned
raw bytes, with no ambiguity, repair or skipped data.

Attack Preconditions:
The raw REG_MULTI_SZ ends with a DELETE or contains ambiguous consecutive NUL
code units/internal empty elements; the parser applies a generic multi-string
or incomplete boundary rule.

Attack Sequence:
1. Gate reads exact bytes.
2. Parser treats an empty destination as the list terminator or vice versa.
3. Source/destination pairing shifts or a final operation disappears.
4. Path classification sees a safe path rather than the actual operation.
5. Gate can reach PASS.

Expected Behavior:
Only independently proven canonical forms are parsed. All other forms are
MALFORMED/BLOCKED.

Actual Design Behavior:
BV6 explicitly leaves the raw grammar as an open design blocker and gives no
normative parsing state machine or approved fixture set.

Security Impact:
Potential false PASS through operation omission/mis-pairing; alternatively,
all current values remain blocked.

Evidence:
- Microsoft MoveFileExW delete/rename representation.
- RegQueryValueExW warning that string values may lack terminators.
- BV6 §9.4 "OPEN DESIGN BLOCKER".

Why Existing Mitigation Fails:
Exact raw bytes and SHA-256 preserve input but do not prove semantic parsing.
A double read and watcher preserve stability but not correctness.

Required Correction:
Define a byte-level parser grammar and state machine, enumerate all accepted
terminator forms, require an approved Windows-version fixture corpus, and map
every unconsumed or ambiguous byte to BLOCKED.

Verification Criteria:
Approved fixtures for final/interior DELETE and RENAME sequences; malformed,
extra and missing terminators; bijection between consumed raw bytes and parsed
operations; independent parser differential review.
```

### P1-02 — PFR Special Prefix Semantics Unverified

```text
Finding ID:
P1-02

Severity:
P1

Affected BV6 Section:
§4.5, §9.5

Affected Decision ID:
D-PFR-13

Security Property:
No operation is interpreted without an authoritative meaning for every prefix.

Attack Preconditions:
PFR source starts with `*1\??\` or `*2\??\`.

Attack Sequence:
1. Parser strips the prefix as if it were decorative.
2. The actual Windows path/operation semantic differs from the stripped path.
3. A protected path or operation type is classified incorrectly.
4. Gate may PASS.

Expected Behavior:
Only prefixes with approved semantics are accepted; otherwise BLOCKED.

Actual Design Behavior:
BV6 labels semantics unverified. Historical real-world values use the prefixes.

Security Impact:
The policy cannot parse the actual historical queue safely; stripping by
pattern could produce a false PASS.

Evidence:
- Microsoft MoveFileExW page does not define the prefixes.
- SDK/MSVC static search found no local definition.
- BV6 code block at line 376 labels it an open blocker.

Why Existing Mitigation Fails:
The proposal to block unknown prefixes is safe but means the policy is not
implementable until all observed prefixes are resolved. BV6 nevertheless calls
the design conditionally complete.

Required Correction:
Resolve from authoritative source/version-specific evidence or keep every
prefixed value blocked indefinitely.

Verification Criteria:
Approved prefix-to-namespace conversion table and positive/negative tests for
`*1`, `*2`, unknown `*N`, malformed prefix and path operation.
```

### P1-03 — Protected Manifest Trust Root Not Established

```text
Finding ID:
P1-03

Severity:
P1

Affected BV6 Section:
§10.1–10.3

Affected Decision ID:
D-PFR-15, D-PFR-16

Security Property:
The protected-path set is complete, authentic, non-replayable and enforceable.

Attack Preconditions:
Manifest is mutable, self-signed/self-approved, or lacks a trusted generation
ledger.

Attack Sequence:
1. Publish a manifest omitting project root or a compiler dependency.
2. Sign it with an accepted key or replay generation 9 after generation 10.
3. Gate accepts manifest.
4. Path classifier approves a PFR operation that affects the omitted object.
5. Gate PASS.

Expected Behavior:
Missing/untrusted/rolled-back manifest and any unknown protected path block.

Actual Design Behavior:
Only a proposed schema exists. Trust root, signer, approval authority, ledger,
revocation and key custody are all unresolved.

Security Impact:
Core protected-path control can be defeated by configuration rather than PFR
content.

Evidence:
- BV6 §10.3 "OPEN — REQUIRES INDEPENDENT REVIEW".
- No approved PFR manifest exists in the Harness tree.
- Current verifiers embed an inline six-file map without policy manifest trust.

Why Existing Mitigation Fails:
An approved SHA-256 field has no meaning without an independent trust source.
The same mutable workspace cannot approve itself.

Required Correction:
Define trust root, separation of duties, canonical signature/digest, external
monotonic generation, revocation and expiry revocation; bind to Build ID.

Verification Criteria:
Manifest omission, same-generation replacement, rollback, expired manifest,
revoked key, self-approval and tampered entry tests all fail closed.
```

### P1-04 — Path-to-Object Binding Does Not Survive Deferred Execution

```text
Finding ID:
P1-04

Severity:
P1

Affected BV6 Section:
§11.3–11.5, §12, §15 T9/T11

Affected Decision ID:
D-PFR-18, D-PFR-19, D-PFR-20, D-PFR-22

Security Property:
A path classified as no-conflict cannot later resolve to a protected object
when the deferred PFR operation executes.

Attack Preconditions:
A PFR source/destination is non-existent or in a mutable parent namespace;
filesystem path/reparse/drive mapping changes after gate pass but before reboot.

Attack Sequence:
1. Gate classifies `resolved non-existent local / no conflict`.
2. Build obtains a PFR PASS.
3. Before reboot, an outside parent becomes a Junction/Symlink/Mount Point to a
   protected tree, or drive-letter mapping changes.
4. Windows resolves the stored PFR path string at boot.
5. Deferred DELETE/RENAME affects the protected object.

Expected Behavior:
No point-in-time path fact may authorize later PFR execution unless namespace
immutability or end-to-end object binding is proven.

Actual Design Behavior:
`RESOLVED_NONEXISTENT_LOCAL` is eligible to proceed; only the Registry is
monitored during the build. Filesystem namespace changes are not observed.

Security Impact:
Protected project/toolchain files can be affected by an operation that passed
the gate.

Evidence:
- BV6 line 1051 defines `RESOLVED_NONEXISTENT_LOCAL`.
- BV6 §11.4 accepts a resolved nearest existing ancestor.
- BV6 T9 acknowledges path TOCTOU but leaves it as residual.
- Windows PFR stores deferred path strings.

Why Existing Mitigation Fails:
Non-following handles prove only the current object/open; the PFR stores a path,
not the checked File ID. Registry watcher does not monitor filesystem names.

Required Correction:
Define a proof that survives until deferred execution. At minimum:
- reject non-existent DELETE/RENAME sources;
- prohibit mutable/reparse-capable ancestors for accepted sources;
- bind all accepted paths to current object identity and prove boot-time mapping;
- or explicitly reduce the policy promise to build-time availability and block
  safety claims for deferred execution.

Verification Criteria:
Adversarial fixture changes parent junction, symlink, mount point, drive
mapping and hard-link topology after gate; no scenario may retain PASS.
```

### P1-05 — Build Toolchain Dependency Closure Not Verified

```text
Finding ID:
P1-05

Severity:
P1

Affected BV6 Section:
§10.4, §17

Affected Decision ID:
D-PFR-15, D-PFR-17

Security Property:
Every file required to execute and load the approved build toolchain is either
protected or proven unable to be affected by an accepted PFR operation.

Attack Preconditions:
PFR names a compiler/linker helper DLL, loaded module, response file or search
path that is omitted from the manifest.

Attack Sequence:
1. Manifest includes executable paths/roots but not complete dependency closure.
2. PFR DELETE/RENAME targets an unlisted helper/dependency.
3. Resolver reports no protected conflict.
4. Gate PASS.
5. Subsequent reboot damages/build-substitutes the toolchain.

Expected Behavior:
Unknown dependency identity or incomplete closure blocks the build.

Actual Design Behavior:
BV6 acknowledges the closure is incomplete and leaves it open.

Security Impact:
Build availability and binary-tool trust can be affected despite PFR PASS.

Evidence:
- BV6 line 1020 "Toolchain closure = OPEN DESIGN BLOCKER".
- Current scripts pin only selected executables/headers/libraries and do not
  enumerate all process-loaded dependencies.

Why Existing Mitigation Fails:
Protecting the MSVC/SDK root may cover many files but does not prove the
complete loader/subprocess closure or dynamically resolved paths.

Required Correction:
Create an approved recursive dependency/process-module inventory, exact
identity set and search-order policy. Unknown module blocks.

Verification Criteria:
Static import plus approved runtime module inventory for MIDL, CL, LINK,
DUMPBIN and helpers; tamper/delete/rename each dependency test; no omitted path.
```

### P1-06 — Unique, Unbypassable Build Entry Not Established

```text
Finding ID:
P1-06

Severity:
P1

Affected BV6 Section:
§13, §17.5–17.6

Affected Decision ID:
D-PFR-26, D-PFR-29, D-PFR-30, D-PFR-31, D-PFR-32

Security Property:
No controlled Native RPC build can start or be accepted without this exact PFR
snapshot/watcher invocation bound to its Build ID.

Attack Preconditions:
Caller can invoke compiler/linker or a copied build script directly.

Attack Sequence:
1. Run `midl.exe`, `cl.exe`, `link.exe` or a copied sequence without gate.
2. Produce binaries and manifests.
3. Present them as a controlled Build-only result.
4. Existing independent integrity checks may verify hashes but cannot prove PFR
   gate ran.

Expected Behavior:
Only one approved Build Entry exists; missing gate evidence makes downstream
build acceptance impossible.

Actual Design Behavior:
The gate exists only inside standalone historical scripts. No root package build
invokes Native build. `build-r5-r3a.ps1` does not exist. BV6 leaves integration
open.

Security Impact:
The entire dynamic policy is bypassable; PFR PASS is not a necessary condition
for producing a purported build result.

Evidence:
- `package.json:14` root build is `pnpm -r build`.
- Web/Worker build scripts use build-integrity but no PFR.
- `build.ps1:96` and `build-b4.ps1:110` are standalone.
- `Test-Path tools/native-rpc/p13-a1-r2/build-r5-r3a.ps1` = false.

Why Existing Mitigation Fails:
Procedural authorization statements do not create an executable enforcement
path.

Required Correction:
Define and eventually implement a single approved Native Build launcher that
binds Policy/Manifest/Snapshot/Build IDs and rejects missing or invalid gate
evidence. Direct compiler use must be explicitly classified as non-gated and
not accepted as controlled Build-only output.

Verification Criteria:
Gate failure -> builder zero-call; direct compilation -> cannot produce accepted
evidence; cross-build evidence replay rejected; post-snapshot failure prevents
downstream acceptance.
```

### P2-01 — RegRestoreKey Blind Spot Not Explicitly Disclosed in BV6

```text
Finding ID:
P2-01

Severity:
P2

Affected BV6 Section:
§4.4, §8, §15 T2/T7

Affected Decision ID:
D-PFR-23, D-PFR-24, D-PFR-25, D-PFR-35

Security Property:
All excluded monitoring limitations are explicit.

Attack Preconditions:
A process with SE_BACKUP_NAME and SE_RESTORE_NAME restores the key.

Attack Sequence:
Restore key during monitored window; RegNotifyChangeKeyValue does not report it.

Expected Behavior:
The limitation is explicitly outside trust scope and documented.

Actual Design Behavior:
BV6 does not mention RegRestoreKey.

Security Impact:
The continuous-monitoring claim can be interpreted too broadly.

Evidence:
Microsoft RegNotifyChangeKeyValue and RegRestoreKeyW pages.

Why Existing Mitigation Fails:
T7 excludes administrator/SYSTEM compromise but does not enumerate this API
limitation.

Required Correction:
Add a normative statement that RegRestoreKey and equivalent privileged restore
mechanisms are out of scope, plus required operator privilege proof.

Verification Criteria:
Independent review accepts trust-boundary statement; tests confirm configured
build identity has no Backup/Restore privileges.
```

### P2-02 — Watcher Thread Lifetime/Thread-Agnostic Choice Not Normative

```text
Finding ID:
P2-02

Severity:
P2

Affected BV6 Section:
§8.2, §8.5

Affected Decision ID:
D-PFR-23, D-PFR-24, D-PFR-25

Security Property:
Thread/handle failure always produces INVALIDATED/UNKNOWN.

Attack Preconditions:
Implementation uses REG_NOTIFY_THREAD_AGNOSTIC and watcher thread exits while
another process/thread continues.

Attack Sequence:
Watcher thread dies; no event signals because registration is thread-agnostic;
host continues and can miss later changes.

Expected Behavior:
Dedicated persistent non-thread-agnostic watcher or independent liveness proof.

Actual Design Behavior:
BV6 mentions thread crash but not the flag/thread contract.

Security Impact:
Potential monitor blind spot depending on implementation.

Evidence:
Official RegNotifyChangeKeyValue thread semantics.

Why Existing Mitigation Fails:
The design text is ambiguous; implementation choice can invalidate safety.

Required Correction:
Specify persistent thread/no thread-agnostic flag or prove equivalent health.

Verification Criteria:
Thread exit, handle closure, thread-pool reuse, suspend and process-exit tests.
```

### P2-03 — Raw Evidence Store Trust Not Defined

```text
Finding ID:
P2-03

Severity:
P2

Affected BV6 Section:
§7.3

Affected Decision ID:
D-PFR-10, D-PFR-29, D-PFR-30

Security Property:
Exact raw snapshot, policy, manifest and verdict cannot be replaced or replayed.

Attack Preconditions:
Build evidence is mutable by the same account or workspace.

Attack Sequence:
Replace raw evidence file and update recorded hash/verdict, or replay a valid
bundle with changed Build metadata.

Expected Behavior:
Evidence authenticated and bound to one Build/Policy.

Actual Design Behavior:
Field/path model proposed; trust root and append-only store not defined.

Security Impact:
Reviewer may see incomplete or substituted evidence.

Evidence:
BV6 D-PFR-10 and D-PFR-30 remain proposed/open.

Why Existing Mitigation Fails:
Hash fields are not independent unless protected and bound.

Required Correction:
Define immutable evidence location, ACLs, signer/trust root and Build binding.

Verification Criteria:
Tamper, deletion, substitution, cross-build replay and ACL tests fail closed.
```

### P2-04 — Invalidated Build Artifacts Remain Usable/Unquarantined

```text
Finding ID:
P2-04

Severity:
P2

Affected BV6 Section:
§13.3–13.4, §17.5

Affected Decision ID:
D-PFR-26, D-PFR-27, D-PFR-31

Security Property:
Only PFR-validated build outputs can enter downstream verification.

Attack Preconditions:
Build writes artifacts, then PFR notification or post-check failure occurs.

Attack Sequence:
Compile/link output already exists; gate returns INVALIDATED/UNKNOWN; another
process skips or misreads the gate verdict and uses the binaries.

Expected Behavior:
Downstream tooling rejects missing/invalid PFR evidence; artifacts remain
quarantined or explicitly not accepted.

Actual Design Behavior:
BV6 says not to call them passed but defines neither quarantine nor downstream
enforcement.

Security Impact:
Unvalidated artifacts may be consumed as if valid.

Evidence:
Current build scripts execute compiler/linker before post-build PFR check.

Why Existing Mitigation Fails:
`stable = false` or a thrown script is not a downstream artifact-control
mechanism.

Required Correction:
Bind artifact publication to final gate PASS or ensure downstream rejects
unversioned/invalidated outputs.

Verification Criteria:
Notification and post-failure tests demonstrate artifact non-publication or
rejection.
```

### P2-05 — PFR Changes After Post-Snapshot Remain Outside the Promise

```text
Finding ID:
P2-05

Severity:
P2

Affected BV6 Section:
§6.3, §15 T11

Affected Decision ID:
D-PFR-34

Security Property:
The scope of the PFR guarantee is unambiguous.

Attack Preconditions:
A privileged writer changes PFR after the build PASS and before reboot.

Attack Sequence:
Gate PASS -> PFR gains project-targeting operation -> reboot executes it.

Expected Behavior:
No claim that Build PASS proves next-reboot safety.

Actual Design Behavior:
BV6 acknowledges this in T11 and future-boundary design, but the proposed
policy name and objective could be misread as reboot protection.

Security Impact:
Operators may rely on a guarantee that ends at post-snapshot.

Evidence:
BV6 T11 and §15 future-reboot boundary.

Why Existing Mitigation Fails:
The watcher is closed after post-snapshot; it cannot monitor until reboot.

Required Correction:
Make build-window-only scope normative in the public status/verdict text and
require a warning against reboot-safety interpretation.

Verification Criteria:
Independent review confirms the verdict wording and downstream policy cannot
consume PASS as persistent system attestation.
```

### P3-01 — 1 MiB Snapshot Limit Is Arbitrary and Not Justified

```text
Finding ID:
P3-01

Severity:
P3

Affected BV6 Section:
§8.4

Affected Decision ID:
D-PFR-09

Security Property:
Resource bounds are safe and operationally justified.

Attack Preconditions:
Legitimate PFR grows over 1 MiB or malicious data approaches the limit.

Attack Sequence:
Build is conservatively blocked or resource usage reaches policy boundary.

Expected Behavior:
Limit is approved from measured host data and parser budgets.

Actual Design Behavior:
Limit is proposed without evidence and is fair as a conservative default.

Security Impact:
Low; primarily availability.

Evidence:
BV6 §8.4.

Why Existing Mitigation Fails:
No measurement is provided.

Required Correction:
Record rationale and test under known maximum observed queue.

Verification Criteria:
Approved size-budget analysis and boundary tests.
```

### P3-02 — Test Matrix Is Design Only

```text
Finding ID:
P3-02

Severity:
P3

Affected BV6 Section:
§16

Affected Decision ID:
D-PFR-38

Security Property:
Security claims in a design phase are not mistaken for verified behavior.

Attack Preconditions:
Reader treats listed tests as passed.

Attack Sequence:
Review or approval cites a planned test ID as if it had produced an execution
result.

Expected Behavior:
Every test remains DESIGN ONLY/NOT EXECUTED until implementation authorization.

Actual Design Behavior:
BV6 states tests are not executed, but the large matrix can appear authoritative.

Security Impact:
Documentation/assurance risk.

Evidence:
BV6 §16 states that no test is executed; no implementation test evidence exists
in the current Harness source tree.

Why Existing Mitigation Fails:
No independent results exist.

Required Correction:
Carry an explicit NOT EXECUTED status and future evidence matrix into BV8 or
implementation authorization.

Verification Criteria:
No design statement claims test PASS.
```

## 19. Required Design Corrections

Blocking corrections:

1. **Close PFR raw grammar.**
   Define every accepted byte form, parser state transition, terminator rule
   and operation pairing invariant. No generic splitter or inference.
2. **Resolve `*1`/`*2` or keep them blocked.**
   Obtain reliable target-version semantics or state that Policy C cannot pass
   current values.
3. **Establish Manifest authority.**
   Name trust root, signer, approver, generation anchor, expiry/revocation and
   rollback rules. Prove complete protected path list.
4. **Close toolchain dependency set.**
   Include exact executable, DLL, helper, response/include/library and search
   path closure. Unknown identity blocks.
5. **Create a unique Build Entry.**
   Bind PFR Snapshot, Policy, Manifest, Build ID and post-snapshot to the only
   accepted Native Build path. Define direct compiler use as ungated.
6. **Close path-to-deferred-object binding.**
   Reject non-existent or mutable path sources, or provide a verified boot-time
   revalidation/binding mechanism. A point-in-time path handle is insufficient.

Required but potentially lower-severity corrections:

- explicitly exclude `RegRestoreKey`;
- normatively require persistent non-thread-agnostic watcher behavior;
- authenticate/immutably store evidence;
- prevent/clearly quarantine invalidated outputs;
- reinforce build-window-only scope;
- justify the snapshot size limit.

No correction is implemented by BV7.

## 20. Remaining Unknowns

```text
UNKNOWN-01:
Correct byte-level parser algorithm for all legal PFR forms.

UNKNOWN-02:
Meaning of `*1\??\` and `*2\??\` on target Windows versions.

UNKNOWN-03:
Approved Manifest trust root, keys and approval authority.

UNKNOWN-04:
Complete runtime dependency/module closure of build tools.

UNKNOWN-05:
Future unique Build Entry and its bypass-resistance implementation.

UNKNOWN-06:
Whether/boot-time how MoveFileEx resolves a changed Junction/Mount Point/
drive-letter namespace.

UNKNOWN-07:
How to bind a path string to the object present at deferred execution.

UNKNOWN-08:
Watcher persistent-thread/thread-agnostic implementation.

UNKNOWN-09:
Independent evidence-store authenticity and replay controls.

UNKNOWN-10:
Downstream enforcement when the build produced artifacts before PFR failure.
```

## 21. Verification Matrix for the Next Independent Gate

| ID | Required verification | Evidence | Pass criterion |
|---|---|---|---|
| BV7-V-01 | PFR raw parser grammar | Approved byte fixtures and parser proof | Every legal operation paired exactly; malformed bytes block |
| BV7-V-02 | Prefix semantics | Authoritative source/version evidence | `*1`/`*2` mapping proven or explicitly always blocked |
| BV7-V-03 | Manifest trust | Signed/pinned manifest, trust root, generation anchor | Omission/rollback/revocation/expiry all fail closed |
| BV7-V-04 | Path resolver | Windows API identity vectors | Alias/hardlink/reparse/volume/case behavior matches design |
| BV7-V-05 | Deferred path TOCTOU | Fixture-driven namespace mutation tests | No post-gate alias change can retain PASS |
| BV7-V-06 | Toolchain closure | Static imports and approved runtime module inventory | Every required binary/dependency protected or proven irrelevant |
| BV7-V-07 | Build Entry bypass | Entry-point source and negative tests | No controlled build can start or be accepted without valid gate verdict |
| BV7-V-08 | Watcher lifecycle | Event/thread/handle failure injection | Any lost monitoring yields INVALIDATED/UNKNOWN, never PASS |
| BV7-V-09 | Change-and-restore | Standard and RegRestoreKey scenarios | Standard write invalidates; privileged restore limitation documented |
| BV7-V-10 | Evidence integrity | Tamper/replay/ACL tests | Evidence bound to one Build/Policy/Manifest and non-replayable |
| BV7-V-11 | Downstream artifact acceptance | Failure injection after compile/link | Invalidated artifacts cannot be accepted as PFR-gated outputs |
| BV7-V-12 | No test-result inflation | Independent execution report | Design tests remain NOT EXECUTED until separately authorized |

## 22. Final Verdict

```text
Overall:
FAIL — BLOCKING DESIGN CORRECTIONS REQUIRED

Review Independence:
PASS

BV6 Input Integrity:
PASS

Policy A:
HISTORICAL/FORENSIC USE ONLY

Policy B:
NOT APPROVED FOR CURRENT STATE

Policy C:
NOT READY FOR IMPLEMENTATION

RegNotifyChangeKeyValue one-shot/no-rearm property:
DIRECTIONALLY SOUND / THREAD CONTRACT MUST BE NORMATIVE

RegRestoreKey:
EXPLICIT ADMIN/SYSTEM BLIND SPOT — MUST BE DISCLOSED

Raw PFR parser:
NOT PROVEN

`*1`/`*2` prefixes:
NOT PROVEN

Protected Manifest:
NO TRUST ROOT

Path-to-deferred-object binding:
NOT PROVEN

Toolchain dependency closure:
NOT PROVEN

Unique Build Entry:
NOT PROVEN

P0:
0

P1:
6

P2:
5

P3:
2

Current 38/19:
CANDIDATE ONLY — NOT APPROVED

Current Build Gate:
UNCHANGED / FAIL-CLOSED

Native Build / Runtime:
NOT EXECUTED

Git Writes:
NOT EXECUTED
```

## 23. Next-Stage Recommendation

Do not implement Policy C or resume Native RPC Build from BV6.

The next separately authorized phase should be a design correction phase that:

1. closes the raw parser grammar and prefix semantics;
2. defines the Manifest trust root and rollback ledger;
3. produces the complete toolchain dependency closure;
4. defines a unique, non-bypassable Native Build Entry;
5. resolves deferred path-to-object binding or narrows the policy so it cannot
   claim next-reboot protection;
6. makes watcher thread and evidence trust rules normative;
7. explicitly records the `RegRestoreKey` and post-snapshot privilege limits.

Recommended next phase:

```text
R6-BV8 — BLOCKING PFR POLICY DESIGN CORRECTIONS
```

No BV8 work is started by this report.

## 24. Report Integrity

This report is the only file added by BV7. It cannot contain its own final
SHA-256 without changing its bytes. The external digest is calculated after the
final write and reported to the user.
