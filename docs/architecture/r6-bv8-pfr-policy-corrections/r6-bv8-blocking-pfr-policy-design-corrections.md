# P1-3 R6-BV8 — Blocking PFR Policy Design Corrections

## 0. Executive Summary

```text
Stage: R6-BV8
Mode: DESIGN CORRECTION ONLY

Conclusion:
READY FOR INDEPENDENT REVIEW

Policy C Implementation:
NOT AUTHORIZED

Build Gate:
UNCHANGED / FAIL-CLOSED

Current 38/19:
CANDIDATE ONLY — NOT APPROVED

Live PFR Registry Read:
NOT PERFORMED

Native Build / Runtime:
NOT EXECUTED

Git Writes:
NOT EXECUTED
```

BV8 replaces the incomplete BV6 design with five explicit control planes:

1. A strict raw-byte parser whose canonical grammar rejects every ambiguous or
   unknown form.
2. A prefix policy that rejects every unverified modifier, including the
   observed `*1\??\` and `*2\??\`.
3. An independently rooted, signed and rollback-resistant PFR policy bundle.
4. An immutable-path architecture that binds PFR path strings to ACL-protected
   namespaces through the deferred execution window.
5. A unique Native Build Broker that owns fixed Build Plans, PFR monitoring,
   toolchain closure verification and artifact publication.

These changes close BV7 P1-01 through P1-06 and P2-01/P2-02 at design level.
They do not assert that the required OS ACLs, trust keys, toolchain inventory,
or Build Broker exist. Until those prerequisites are implemented and
independently verified, Policy C remains non-operational and the existing Build
Gate remains fail-closed.

Because the semantics of `*1` and `*2` remain unproven, Policy C v2 rejects the
observed historical 46/23 and current 38/19 values. That is an intentional
fail-closed outcome, not a candidate-baseline approval.

## 1. Authorization, Scope and Baseline

Authorized:

- design-only correction of six BV7 P1 and the required two P2;
- reading project rules, Skills, BV6, BV7, history and current source;
- read-only use of the verified PowerShell 7.6.9 path;
- adding two files under `docs/architecture/r6-bv8-pfr-policy-corrections/`.

Not performed:

- live PFR read or write;
- Policy C implementation;
- Build Gate or source modification;
- MIDL, CL, LINK, DUMPBIN, Native Build, Native Test or Runtime;
- file-system, ACL, Owner, Service, Task Scheduler or audit changes;
- database, SQL, Migration or Storage access;
- reading, hashing or modifying `$null`;
- approval of 38/19 or any PFR exception;
- Git write.

Baseline before adding BV8 files:

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 26
Untracked files: 261
Staged: 0
Deleted: 0
```

The two BV8 files are expected to raise the untracked-file count to 263.

## 2. Skills and Shell Identity

Skills read and applied:

- `$project-architecture`: separated the Build Broker, PFR policy, Runtime TCB,
  Build Integrity and File Lifecycle boundaries.
- `$security-audit`: drove explicit trust roots, least privilege, replay
  resistance and false-PASS analysis.
- `$testing-and-verification`: converted every design claim into future
  executable evidence and kept all tests NOT EXECUTED.
- `$file-lifecycle`: applied exact object identity, Reparse Point rejection and
  immutable namespace reasoning.

### 2.1 Verified shell

Exactly one PowerShell candidate was discovered:

```text
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe
```

Direct launch evidence:

```text
Parent PID: 640
Child PID: 19196
Child parent PID: 640
Creation UTC: 2026-11-23T11:48:53.5329467Z
External CIM image: exact candidate path
FileVersion: 7.6.9.500
ProductVersion: 7.6.9
Child PSVersion: 7.6.9
Child PSEdition: Core
Child CWD: D:\thinkbook\Desktop\jieya
Exit code: 0
Standard error: empty
```

No CMD, Bash or unverified wrapper was used.

## 3. Input Integrity

| Input | Expected | Actual | Result |
|---|---|---|---|
| BV6 main | `6B23D81A99A34F5DD46CA06D2B1B9C4B310E4DAEA269BFFBED3610EA07700996` | same | PASS |
| BV6 decisions | `DA1083B7E845D556DD21B5B09C3512673B850B63210045E4A7756BAF10F79A0D` | same | PASS |
| BV7 review | `DEBE62222C03A07E3C430860013A173B1A62CEE446593C646895BFCB2A1FE480` | same | PASS |

Input lengths:

```text
BV6 main: 65,205 bytes
BV6 decisions: 30,560 bytes
BV7 review: 55,098 bytes
```

Current source hashes:

| Source | SHA-256 |
|---|---|
| root `package.json` | `C9CB1A9F52D4DDC37272C94CE6E657114332F70F100ACC4CADC06ABE43479F45` |
| Web `package.json` | `F98A95DEE79D978F9A2F7F9855D033794370CF8F70BAC0B911EDB35E71B501A3` |
| Worker `package.json` | `5852D4F37B9C1AA253C134DC6FBC59644C1C7FA0456FDF7AF07CF921AE0ECDBF` |
| `build.ps1` | `B9761321CA0DB920968DC30BF9B7FEDB26B55727FB566DD6F5D710AC2BAC60C3` |
| `build-b4.ps1` | `FCAF8812D4DA12C13085CFC0313139C98C09648FC632D1C7097DA8C402180677` |
| `verify-static.ps1` | `AA273D2E4463D9B1717888FD433825E830690A2CAD98182A34698BF5AE2B522C` |
| `verify-static-b4.ps1` | `6EE65CFB2D722BA7AE457E15C19734FBDF6825CE8EBEED32C2B2BA4CEDE62D5B` |

## 4. Corrected Architecture

```text
Offline root / approver
          |
          v
External Trust Anchor (admin-write, broker-read-only)
          |
          v
Signed Policy Bundle
  parser profile + prefix profile + protected manifest
  immutable namespaces + toolchain closure + approvals
          |
          v
P13 Native Build Broker
  1. authenticate request and resolve fixed Build Plan
  2. arm watcher
  3. read and parse exact PFR bytes
  4. reject unknown prefix/path/manifest/toolchain state
  5. launch owned build Job
  6. monitor PFR and runtime dependency closure
  7. capture post-snapshot
  8. publish artifacts only after full PASS
```

The Build Broker is a build-infrastructure role. It is not the R4/R5 Runtime
Host, Worker, Supervisor, Helper, Launch Authority or File Lifecycle Authority.
It owns only the build children and temporary Job it creates.

## 5. P1-01 — Formal Raw PFR Parser

### 5.1 Input model

`ParsePfrRawV1(rawBytes, parserProfile)` is a pure function over:

- exact bytes returned by `RegQueryValueExW`;
- exact byte length;
- registry type;
- approved parser profile hash.

It never appends terminators, clears registry data or repairs input.

### 5.2 Character notation

```text
U16    = one little-endian 16-bit code unit
NUL    = U16 0x0000
NonNUL = any U16 other than 0x0000
```

Reject odd byte length before decoding.

### 5.3 Canonical grammar

Policy profile `PFR-MULTISZ-CANONICAL-V1`:

```text
Value         := EmptyValue | NonEmptyValue
EmptyValue    := NUL NUL
NonEmptyValue := Body NUL
Body          := Element NUL (Element NUL)*
Element       := NonNUL*
```

Consequences:

- Empty list is exactly two NUL code units.
- One final list-terminator NUL is removed from every non-empty value.
- Remaining `Body` must end in a NUL.
- Elements are preserved between NUL delimiters without trimming.
- Empty elements are preserved.
- Accepted non-empty values contain a positive even number of elements.
- Elements pair as `(source, destination)` in order.
- Empty source is malformed.
- Empty destination means DELETE.
- Non-empty destination means RENAME.
- Any extra/missing/ambiguous terminator or unconsumed bytes are malformed.

This is deliberately narrower than any generic multi-string helper.

### 5.4 Algorithm

```text
1. Require even byte length and a complete little-endian U16 buffer.
2. If unit count == 2 and both units are NUL: return zero operations.
3. Require final unit == NUL; remove exactly one final list terminator.
4. Require remaining Body non-empty and ending in NUL.
5. Scan Body into empty-preserving NUL-terminated elements.
6. Require element count positive and even.
7. Pair elements.
8. Reject empty source.
9. Classify empty destination as DELETE; otherwise RENAME.
10. Run Prefix Profile parsing on source and destination.
11. Reject any unknown prefix.
12. Require every raw byte offset to belong to exactly one parsed element or
    the single list terminator.
```

### 5.5 Encoding rules

- UTF-16LE only.
- Unpaired surrogates are rejected as invalid Unicode.
- No Unicode normalization.
- NUL is a delimiter and cannot be part of a path element.
- Raw code units and decoded elements are both retained as evidence.

### 5.6 Snapshot and read requirements

The parser is called only after:

- value type is `REG_MULTI_SZ`;
- value exists;
- two complete reads have equal type, length and bytes;
- the watcher was armed before the first read;
- no change event is signaled;
- actual buffer length equals the declared length;
- the policy byte limit is respected;
- exact raw evidence is reserved for durable persistence.

`ERROR_MORE_DATA` buffers are undefined and must be discarded. Retries use a
new buffer. No old hash may substitute for a failed read.

### 5.7 Recovery policy

Allowed:

- discard an incomplete read;
- retry a complete read within the configured limit;
- start a new gate invocation after the previous one is BLOCKED.

Forbidden:

- append missing NULs;
- trim/add empty pairs;
- resynchronize after a malformed record;
- skip one unknown record;
- continue with other safe-looking operations;
- reuse a previous snapshot.

### 5.8 Byte vectors

`A = 41 00`, `B = 42 00`.

| ID | Raw bytes | Expected |
|---|---|---|
| PV-01 | `00 00 00 00` | zero operations |
| PV-02 | `41 00 00 00 00 00 00 00` | DELETE `A` |
| PV-03 | `41 00 00 00 42 00 00 00 00 00` | RENAME `A -> B` |
| PV-04 | `41 00 00 00 00 00 42 00 00 00 00 00 00 00` | DELETE `A`, DELETE `B` |
| PV-05 | `41 00 00 00 00 00` | MALFORMED: missing final list terminator |
| PV-06 | `41 00 00 00 00 00 00 00 00 00` | MALFORMED: extra terminator |
| PV-07 | `41 00 00 00 42 00 00 00` | MALFORMED: missing final terminator |
| PV-08 | `41 00 00 00 42 00` | MALFORMED: destination not terminated |
| PV-09 | `00 00 41 00 00 00 00 00` | MALFORMED: empty source |
| PV-10 | `41` | MALFORMED: odd length |
| PV-11 | `00 00` | MALFORMED: truncated non-canonical empty |
| PV-12 | `00 00 00 00 00 00` | MALFORMED: no source/destination pair |
| PV-13 | `00 D8 00 00 00 00 00 00` | MALFORMED: unpaired surrogate |

The eventual implementation must emit consumed-byte ranges and prove no byte is
silently omitted.

### 5.9 Closure

```text
BV7 P1-01:
CLOSED AT DESIGN

Implementation:
NOT AUTHORIZED

Parser evidence:
NOT EXECUTED

Default for non-canonical or unknown data:
BLOCKED
```

## 6. P1-02 — Prefix Policy

No authoritative definition of `*1` or `*2` exists in the reviewed Microsoft
pages, installed Windows SDK headers, installed MSVC files or project reports.
They are not cosmetic.

```text
Profile: PFR-PREFIX-V1
Known prefixes: NONE
Unknown-modifier detector: ^[*][0-9]+[\\].*$
Result: BLOCKED_UNKNOWN_PREFIX
```

The detector does not authorize stripping. On an apparently prefixed source:

1. preserve source bytes and offsets;
2. mark `UNKNOWN_MODIFIER`;
3. block the entire snapshot;
4. do not pass the suffix into path resolution;
5. do not compare the suffix with the protected manifest;
6. do not allow operator bypass.

A future prefix profile must document:

- authoritative source and applicable Windows versions;
- modifier/namespace/operation semantics;
- effect on source and destination;
- path conversion;
- positive and negative raw vectors;
- policy version and independent approval.

### 6.1 Current-state effect

All observed values containing `*1\??\` or `*2\??\` are rejected:

```text
historical 46/23: BLOCKED
old exact 38/19: BLOCKED
BV5 current 38/19: BLOCKED
```

This does not approve any baseline. It makes the unknown semantics incapable of
producing a false PASS.

### 6.2 Closure

```text
BV7 P1-02:
CLOSED AT DESIGN BY HARD REJECTION

Prefix semantics:
UNKNOWN
```

## 7. P1-03 — Signed Policy and Manifest Trust Architecture

### 7.1 Trust chain

```text
Offline PFR root key
  -> signed Key Set
      -> proposer key
      -> policy signer key
      -> approval authority key
      -> revocation key
  -> signed Policy Bundle
      -> parser profile
      -> prefix profile
      -> Protected Path Manifest
      -> Immutable Namespace definitions
      -> mandatory coverage
      -> Toolchain Closure reference
      -> approvals, generation and expiry
  -> external Trust Anchor
  -> read-only Build Broker consumer
```

Proposed canonical encoding is RFC 8785 JSON with SHA-256 and purpose-separated
Ed25519 signatures. Any equivalent format requires independent review.

### 7.2 External Trust Anchor

Design-only path:

```text
C:\ProgramData\P13\PfrPolicy\trust-anchor.json
```

Contents:

```text
TrustAnchorVersion
RootKeyFingerprints[]
PolicyGenerationFloor
AdmittedBundleGeneration
AdmittedBundleSha256
KeySetGenerationFloor
RevocationGeneration
NotAfterUtc
ApprovalAuditReference
```

ACL:

- Administrators/System may provision/update through the approved ceremony.
- Build Broker is read-only.
- Developer/project identities have no write, delete or ACL permission.
- The Gate never writes the anchor.

Missing, expired, malformed, rolled-back or inaccessible anchor blocks.

### 7.3 Role separation

| Role | Create draft | Sign policy | Approve | Install anchor | Consume |
|---|---:|---:|---:|---:|---:|
| Proposer | yes | no | no | no | no |
| Independent reviewer | review | no | recommendation | no | read-only |
| Approval authority | no | approval key | yes | no | read-only |
| Policy signer | no | signer key | no | no | no |
| Provisioning admin | no | root operations | no | yes | read-only |
| Build Broker | no | no | no | no | read-only |
| Developer | source request | no | no | no | via broker |

If the same person/process must fill proposer, signer and approver roles because
no separation exists:

```text
BLOCKED — APPROVAL SEPARATION NOT AVAILABLE
```

### 7.4 Generation, replay, rollback and revocation

- Generation is a nonzero unsigned integer.
- A new bundle is greater than the admitted generation.
- A new bundle contains the prior admitted bundle hash.
- Same generation with different bytes is rejected.
- A lower generation is rejected.
- Old valid signatures are rejected after revocation generation advances.
- Expired bundles and keys are rejected.
- Build Evidence is bound to one Build ID and cannot be replayed.
- The Gate never advances generation or revocation.

### 7.5 Rotation and compromise

Key rotation requires a root-signed Key Set and Trust Anchor update by the
provisioning authority.

Compromise response:

1. revoke the affected key generation;
2. reject all affected bundles;
3. block all builds;
4. provision a new root/key set out of band;
5. require independent re-approval.

If the root is compromised, automatic recovery is forbidden.

### 7.6 Mandatory coverage

The signed policy may not remove these mandatory categories:

```text
MANDATORY_PROJECT_ROOT
MANDATORY_SIX_PROTECTED_OBJECTS
MANDATORY_NULL_HISTORICAL_OBJECT
MANDATORY_NATIVE_HARNESS_SOURCE_AND_OUTPUT
MANDATORY_BUILD_BROKER_AND_CONFIG
MANDATORY_TOOLCHAIN_CLOSURE
MANDATORY_POLICY_EVIDENCE
```

The Gate cross-checks category identifiers against its approved structural
rules. A manifest that omits a mandatory category is invalid even if correctly
signed.

The project-root entry covers all descendants. Excluding a descendant requires
a new Gate-supported policy version and independent review.

### 7.7 Trust boundary

This chain protects against non-privileged mutation and accidental
configuration drift. It does not resist a compromised Administrator, SYSTEM,
kernel, Trust Anchor writer, Build Broker or root signer.

### 7.8 Closure

```text
BV7 P1-03:
CLOSED AT DESIGN

Physical trust material:
NOT CONFIGURED

Implementation:
NOT AUTHORIZED
```

## 8. P1-04 — Immutable Path Boundary for Deferred Execution

A Gate-time File ID and open handle do not survive reboot. BV8 therefore selects
an ACL-backed namespace-binding architecture instead of claiming cross-reboot
handle identity.

### 8.1 Eligibility predicate

A PFR path may proceed only if:

1. it is a local fixed-volume path;
2. its volume identity matches a signed manifest entry;
3. it is not UNC, extended UNC, ADS, relative, environment-variable or an
   unknown device namespace;
4. every existing component is checked for Reparse/Junction/Mount Point state;
5. the nearest existing parent and all existing ancestors are in an approved
   Immutable Path Boundary;
6. untrusted identities cannot create, replace, delete, rename, hard-link,
   create reparse data or change ACLs in those directories;
7. the existing source identity is captured and matches any expected manifest
   object;
8. the destination parent identity is fixed to the approved boundary;
9. an absent source is rejected;
10. all volume, object and ACL facts are current and complete.

### 8.2 Rejected namespace forms

Always blocked:

- UNC and `\\?\UNC\`;
- ADS;
- relative paths;
- unexpanded environment variables;
- unresolved NT/device names;
- unresolved drive mapping;
- Reparse/Junction/Mount Point component not explicitly approved;
- missing source;
- path outside all immutable boundaries;
- ACL that permits untrusted namespace replacement;
- ACL/identity read failure.

### 8.3 ACL proof

The signed policy specifies the untrusted SID set. For every accepted existing
directory component, effective rights are checked for:

```text
DELETE
FILE_WRITE_DATA / FILE_ADD_FILE
FILE_APPEND_DATA / FILE_ADD_SUBDIRECTORY
DELETE_CHILD
WRITE_DAC
WRITE_OWNER
create-reparse-object
```

If an untrusted identity can exercise any of them, the path is not immutable
and the attempt blocks.

The trusted set is limited to explicitly named system/provisioning identities
inside the threat boundary. Administrators/System are excluded from resistance
claims.

### 8.4 Existing objects

Existing paths are opened with:

```text
FILE_READ_ATTRIBUTES
FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE
OPEN_EXISTING
FILE_FLAG_OPEN_REPARSE_POINT
FILE_FLAG_BACKUP_SEMANTICS for directories
```

Record:

- volume GUID and serial;
- File ID;
- final normalized path;
- object type;
- Reparse tag/state;
- all ancestor identities and ACL hashes;
- current drive-letter mapping.

### 8.5 Missing destinations

For RENAME, source must exist. A missing destination is accepted only when its
nearest existing parent and complete ancestor chain satisfy the immutable
boundary. The missing tail remains constrained by those parent ACLs.

For DELETE, a missing source is rejected.

### 8.6 Deferred window

```text
Gate object identity
  + immutable parent ACL
  + no reparse path
  + approved volume mapping
  = path mapping cannot be changed by in-scope untrusted identities
```

No Windows handle is assumed to survive reboot. Administrator/System namespace
changes remain out of scope.

### 8.7 Closure

```text
BV7 P1-04:
CLOSED AT DESIGN

ACL/path evidence:
NOT PRODUCED

Unanchored or mutable path:
BLOCKED
```

## 9. P1-05 — Complete Build Toolchain Dependency Closure

### 9.1 Closure manifest

```text
ToolchainClosureManifestV1
  ClosureId
  ClosureVersion
  ClosureGeneration
  PolicyBundleHash
  WindowsBuildIdentity
  ToolRoots[]
  Executables[]
  PrivateModules[]
  SystemModules[]
  IncludeFiles[]
  LibraryFiles[]
  Scripts[]
  ResponseFileRules[]
  EnvironmentDefinition
  SearchPathPolicy
  SideBySideEvidence[]
  Unknown[]
  ClosureSha256
```

Every entry records:

```text
absolute path
object type
volume identity
File ID where supportable
length
SHA-256
component/provider
build role
```

The closure covers MIDL, CL, LINK, DUMPBIN, compiler helpers, preprocessors,
ordinary and delayed-load DLLs, CRT, SDK/MSVC components, generated scripts,
response files, working directory, environment and child processes.

### 9.2 Discovery

The approved inventory method is:

1. Enumerate PE imports and delay imports for all direct tools.
2. Enumerate exact include/library files required by the build plan.
3. Enumerate every script/code generator invoked by the plan.
4. Execute a future, separately authorized inventory run in a disposable
   Windows test VM with no network, database or real Storage.
5. Capture process creation, image load, file open and environment evidence
   using an approved ETW/audit method.
6. Record SxS activation contexts and conditional/plugin loads.
7. Compare static and observed sets; require explicit evidence for every
   difference.
8. Mark anything not covered as UNKNOWN and block.
9. Sign the resulting closure manifest.

BV8 does not execute this inventory.

### 9.3 Environment and search order

The Build Broker clears the inherited environment and supplies only:

```text
SystemRoot
WINDIR
TEMP
TMP
INCLUDE
LIB
PATH
```

Rules:

- PATH contains only fixed approved absolute directories;
- no current-directory search;
- no user-writable directory;
- no inherited CL/_CL_/LINK/preprocessor/loader injection variables;
- working directory is a fresh build staging root;
- TEMP/TMP are outside source and final output roots;
- response files are Broker-generated and hash-recorded;
- only exact approved tools and scripts may execute.

### 9.4 Runtime closure observation

The build runs inside a Broker-owned Job with process and image-load observation.
Every:

- child process;
- loaded module;
- executed script/generator;
- response file;
- toolchain file read from a protected root;

must match the signed closure.

Unknown process/module/script/response/search path or observation loss:

```text
INVALIDATED / UNKNOWN — TOOLCHAIN CLOSURE NOT PROVEN
```

No PASS.

If the observation mechanism requires a privilege not granted to the dedicated
Build Broker identity, implementation is blocked. No broad administrator
fallback is permitted in this design.

### 9.5 Pre/during/post checks

Before build:

- verify closure hash/generation/expiry;
- verify tool objects and immutable ACLs;
- verify no Reparse Point;
- bind closure to Policy Bundle and Build Plan.

During build:

- observe processes, images and scripts;
- compare environment and search roots;
- detect unknown modules and toolchain file changes.

After build:

- re-hash used closure entries;
- re-check roots and identity;
- record additions/removals/changes;
- bind the final closure evidence to Build ID.

### 9.6 Closure

```text
BV7 P1-05:
CLOSED AT DESIGN

Complete inventory evidence:
NOT PRODUCED

Missing/unknown dependency:
BLOCKED
```

## 10. P1-06 — Unique Native Build Entry

### 10.1 Selected architecture

The only controlled Native RPC entry is:

```text
P13 Native Build Broker
```

The Broker:

- runs under a dedicated build-service identity;
- accepts fixed Build Plan IDs, not arbitrary commands;
- authenticates the caller and validates the source/plan digest;
- creates Build ID and Gate Invocation ID internally;
- arms the PFR watcher;
- verifies Policy Bundle, Manifest, Immutable Paths and Toolchain Closure;
- launches the approved build in an owned Job;
- monitors PFR and dependency closure through completion;
- captures post-snapshot;
- publishes artifacts only after final PASS.

### 10.2 OS ACL enforcement

```text
Developer/requester:
  read source
  no execute on MIDL/CL/LINK/DUMPBIN
  no write on toolchain roots
  no write on final publication roots

Build Broker:
  execute approved tools
  write isolated staging
  read source
  KEY_QUERY_VALUE | KEY_NOTIFY on PFR key
  no KEY_SET_VALUE or Registry write
  no ACL/Service modification
  no Runtime Host/Worker/Helper/Job/Handle access
```

These ACLs are future implementation evidence. Without them, direct compiler
execution remains possible and Policy C cannot be claimed non-bypassable.

### 10.3 Request and plan model

```text
BuildRequest
  RequestId
  CallerSid
  CallerRole
  BuildPlanId
  SourceDigest
  PolicyBundleHash
  RequestedBuildGeneration
```

Caller cannot provide arbitrary:

- executable path;
- compiler switches;
- environment;
- working directory;
- output/evidence path;
- PFR parser or policy mode.

### 10.4 Entry matrix

| Surface | Decision |
|---|---|
| Root `pnpm build` | Web/Worker only; no Native tool execution |
| `build-r5-r3a.ps1` | Future thin Broker request only |
| `build.ps1` / `build-b4.ps1` | Historical standalone scripts; not Policy C |
| Direct MIDL/CL/LINK/DUMPBIN | OS ACL denial for untrusted identities |
| Copied build script | No Broker Build ID/evidence; not accepted |
| CI | Broker identity/API and fixed plan |
| Local developer | Source editing only |
| Administrator direct run | Not a controlled Build Evidence result |

### 10.5 Build ID and evidence binding

Build ID and Gate Invocation ID are random 256-bit values generated by the
Broker. Bound evidence includes:

- caller SID and role;
- Build Plan and source digest;
- Policy Bundle hash;
- Manifest generation/hash;
- Toolchain Closure generation/hash;
- PFR snapshots and watcher state;
- child process identities;
- staging root identity;
- artifact digest;
- final evidence digest.

No caller may supply or reuse a Build ID.

### 10.6 Artifact publication

Artifacts are produced in a private staging root. Final publication occurs only
after:

- Build exit code 0;
- no PFR notification;
- post-snapshot exact match;
- valid closure;
- complete evidence persistence.

On failure, staging is retained and never represented as PFR-gate-admitted.
Deletion requires separate cleanup authority.

### 10.7 Direct-use limitation

If a developer has OS permission to execute the compiler tools directly, the
design is:

```text
NOT READY FOR IMPLEMENTATION
```

Procedural instructions are not a technical bypass control.

### 10.8 Closure

```text
BV7 P1-06:
CLOSED AT DESIGN

Broker and ACL enforcement:
NOT IMPLEMENTED

Direct current build paths:
OUTSIDE POLICY C UNTIL AUTHORIZED
```

## 11. P2-B — Watcher Thread Lifecycle

BV8 makes the BV6 one-shot model normative:

```text
Dedicated persistent OS thread
Manual-reset non-inheritable event
KEY_NOTIFY local key handle
REG_NOTIFY_CHANGE_LAST_SET
bWatchSubtree = FALSE
fAsynchronous = TRUE
No re-registration or event reset
```

`REG_NOTIFY_THREAD_AGNOSTIC` is prohibited in Policy 2.0 because the default
thread-exit signaling is useful fail-closed evidence. Any future use requires a
separate design and independent liveness proof.

Thread/event lifecycle:

1. create manual-reset event;
2. open notify key;
3. call `RegNotifyChangeKeyValue`;
4. report ready only on `ERROR_SUCCESS`;
5. wait while the Gate is active;
6. first event sets a monotonic `changeObserved` flag;
7. never reset or rearm;
8. remain active through post-snapshot;
9. close handles only after evidence records the window close.

Failure mapping:

| Condition | Result |
|---|---|
| Notification | INVALIDATED |
| Registration failure | BLOCKED |
| Wait error | UNKNOWN |
| Thread exits before window close | UNKNOWN |
| Key/event handle closes early | UNKNOWN |
| Host exits | Evidence incomplete / UNKNOWN |
| Attempted reset/rearm | INVALIDATED / implementation defect |

No failure can become PASS.

```text
BV7 P2-02:
CLOSED AT DESIGN
```

## 12. P2-A — RegRestoreKey Boundary

`RegNotifyChangeKeyValue` cannot detect `RegRestoreKey`. That API requires
`SE_BACKUP_NAME` and `SE_RESTORE_NAME`.

Policy 2.0 boundary:

```text
In scope:
normal Registry value writes, ordinary build processes and non-privileged
project identities

Out of scope:
Local Administrators, SYSTEM, kernel code, holders of Backup/Restore privileges,
a compromised Build Broker, Trust Anchor writer or root signer
```

The Build Broker identity must not hold Backup/Restore privileges. If that
condition cannot be proven, Policy C blocks.

The design does not claim that the watcher detects every Registry mutation.

```text
BV7 P2-01:
CLOSED AT DESIGN BY EXPLICIT BOUNDARY
```

## 13. Corrected Build Transaction State Machine

```text
NOT_STARTED
 -> REQUEST_AUTHENTICATED
 -> PLAN_RESOLVED
 -> WATCHER_ARMED
 -> PRE_SNAPSHOT_CAPTURED
 -> RAW_PROFILE_VALIDATED
 -> OPERATIONS_PARSED
 -> PREFIX_VALIDATED
 -> POLICY_BUNDLE_VALIDATED
 -> PROTECTED_PATHS_LOADED
 -> PATHS_CLASSIFIED
 -> TOOLCHAIN_CLOSURE_VALIDATED
 -> READY_FOR_BUILD
 -> BUILD_WINDOW_ACTIVE
 -> BUILD_EXITED
 -> POST_SNAPSHOT_CAPTURED
 -> EXACT_BYTES_COMPARED
 -> EVIDENCE_FINALIZED
 -> PASSED
```

Failure terminals:

```text
BLOCKED
INVALIDATED
UNKNOWN
BUILD_FAILED
```

Rules:

- watcher is armed before first PFR read;
- no compiler starts before all prebuild controls pass;
- any event/UNKNOWN prevents PASS;
- post-snapshot precedes artifact publication;
- output from an invalidated build cannot be gate-admitted;
- PASS is bound to one Build ID and expires with the transaction.

## 14. Cross-Problem Consistency

```text
Raw parser
 -> Prefix profile (unknown blocks before path parse)
 -> Policy Bundle and Manifest
 -> Immutable Path classification
 -> Toolchain Closure verification
 -> Broker fixed Build Plan
 -> Watcher over complete build window
 -> Post snapshot + evidence + artifact publication
```

Consistency assertions:

- Parser output preserves operation order and offsets.
- Unknown prefix prevents path resolution.
- Manifest includes every protected path, ancestor boundary and toolchain
  closure reference.
- Path ACL and object identities are validated before build.
- Toolchain closure is enforced by the Broker launch path.
- Watcher event makes the Build transaction non-publishable.
- Policy/Manifest/Closure generations are bound to Build Evidence.
- Missing evidence cannot be converted to a successful state.

## 15. R4/R5 and P1-3 Consistency

Preserved:

- Windows-only Native RPC;
- Host/Worker identity separation;
- Supervisor/Helper/Termination authority;
- Job Handle custody;
- Launch Authority independence;
- evidence trust;
- D1 v1 freeze and D1 v2 non-authorization;
- R5-R3A Build-only scope;
- UNKNOWN/QUARANTINED cannot imply CLOSED;
- Linux remains out of scope.

The P13 Build Broker is a separate build-infrastructure component. It receives
no Runtime Helper, Ledger, Supervisor, Worker, Launch or Handle-transfer
authority. It may own only the build child processes/Job that it creates.

The PFR Gate:

- never writes Registry/PFR;
- never changes ACLs;
- never deletes protected files;
- never impersonates a caller;
- never attaches to Runtime processes;
- never grants a new termination or file-write right to R4/R5 roles.

## 16. Historical Baseline Boundaries

```text
Historical 46/23:
HISTORICAL ONLY

Old 38/19:
54CC89DA4697363393AE7A956AF3FD689B8B3D10926955849995CD44CC286E84
EXPIRED EXACT EXCEPTION

Current 38/19:
8EE40F3606C888B3A0C93E2256D572595339785E99EF0F51EC85B36594097F3F
CANDIDATE ONLY — NOT APPROVED

BV5 mechanism:
STRONGLY SUPPORTED

BV5 direct writer attribution:
NOT CONFIRMED
```

Policy C v2 does not approve any of these values. The unknown prefixes cause all
observed values to be rejected until a separate authoritative Prefix Profile is
approved.

## 17. Decision Changes From BV6/BV7

| Area | BV6/BV7 | BV8 |
|---|---|---|
| Raw parser | Open blocker | Canonical grammar with global rejection |
| Prefix | Open blocker | All observed `*N` blocked |
| Manifest trust | Open | Root, Key Set, signed bundle, external anchor |
| Path binding | Point-in-time resolver | Immutable ACL boundary; absent source blocked |
| Toolchain closure | Open | Signed closure + isolated inventory + runtime observation |
| Build entry | Advisory/open | Broker-only fixed plans + OS ACL enforcement |
| Watcher thread | Ambiguous | Persistent non-thread-agnostic one-shot thread |
| RegRestoreKey | Undocumented | Explicit privileged out-of-scope boundary |
| Current 38/19 | Candidate | Candidate; cannot PASS under current prefix profile |

## 18. Remaining UNKNOWN / BLOCKED Before Implementation

```text
BLOCKED-01: Parser implementation and fixture execution.
BLOCKED-02: Authoritative `*1`/`*2` semantics.
BLOCKED-03: Physical root/signing/approval keys.
BLOCKED-04: External Trust Anchor path and provisioning.
BLOCKED-05: Immutable Path Boundary ACL evidence.
BLOCKED-06: Approved volumes and ACL-safe namespaces.
BLOCKED-07: Complete toolchain dependency inventory.
BLOCKED-08: P13 Native Build Broker binary/service identity.
BLOCKED-09: OS ACL proving direct compiler execution is denied.
BLOCKED-10: Process/image/file closure observation implementation.
BLOCKED-11: PFR Gate source, tests and evidence schema.
BLOCKED-12: Target-version watcher/restore evidence.
```

These are evidence/deployment prerequisites. They are not permission to weaken
the design or use a manual override.

## 19. Required Future Verification

1. Approve and execute the canonical parser vectors.
2. Resolve or permanently block all observed prefixes.
3. Provision and test the Policy trust chain.
4. Prove manifest generation, rollback, revocation and expiry.
5. Prove immutable namespace ACLs and path identity.
6. Generate and review the full toolchain closure.
7. Implement and review Broker request/ACL controls.
8. Prove watcher thread/handle failure behavior.
9. Prove `RegRestoreKey` remains outside the trust boundary.
10. Prove invalidated artifacts cannot be published.
11. Keep the existing Build Gate fail-closed until the corrected policy is
    separately authorized, implemented and reviewed.

No test is executed in BV8.

## 20. Final Verdict

```text
Conclusion:
READY FOR INDEPENDENT REVIEW

BV7 P1-01 through P1-06:
CLOSED AT DESIGN

BV7 P2-01/P2-02:
CLOSED AT DESIGN

Policy C implementation:
NOT AUTHORIZED

Build Gate:
UNCHANGED / FAIL-CLOSED

Current 38/19:
CANDIDATE ONLY — NOT APPROVED

Live PFR Registry Read:
NOT PERFORMED

Native Build / Runtime:
NOT EXECUTED

Database / Storage:
NOT ACCESSED

Git Writes:
NOT EXECUTED

Next Gate:
R6-BV9 — INDEPENDENT REVIEW OF BV8 CORRECTIONS
```

This conclusion means the corrected design is ready to be independently
attacked. It does not mean ready for implementation.

## 21. Side Effects and Integrity

Only the two files in the dedicated BV8 directory are added. No source, IDL,
test, build script, PFR value, registry setting, ACL, service, database, Storage
or protected object is modified.

The own final SHA-256 cannot be embedded without changing the bytes. It is
calculated after the final write and reported externally with the traceability
document digest.

## Appendix A — Sources and Version Applicability

Official Microsoft references checked during BV7/BV8:

| Source | URL | Applicability |
|---|---|---|
| MoveFileExW | `https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw` | delayed delete/rename representation and ordering |
| RegQueryValueExW | `https://learn.microsoft.com/en-us/windows/win32/api/winreg/nf-winreg-regqueryvalueexw` | exact buffer, `ERROR_MORE_DATA`, termination limits |
| RegNotifyChangeKeyValue | `https://learn.microsoft.com/en-us/windows/win32/api/winreg/nf-winreg-regnotifychangekeyvalue` | one-shot notification, key scope, thread/handle behavior, `RegRestoreKey` limitation |
| RegRestoreKeyW | `https://learn.microsoft.com/en-us/windows/win32/api/winreg/nf-winreg-regrestorekeyw` | Backup/Restore privileges and restoration semantics |
| Naming Files, Paths, and Namespaces | `https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file` | DOS/UNC/device/extended namespace constraints |
| GetFinalPathNameByHandleW | `https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfinalpathnamebyhandlew` | final path resolution evidence |
| GetFileInformationByHandle | `https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfileinformationbyhandle` | volume serial and file identity |
| GetFileInformationByHandleEx | `https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfileinformationbyhandleex` | attribute-tag/Reparse evidence |

Reviewed local tool identities:

```text
PowerShell: 7.6.9
Windows SDK: 10.0.26100.0
MSVC: 14.44.35207
Classic MIDL: 8.01.0628 / 10.0.26100.9457
```

The API pages are not version-pinned documents. A future implementation must
run the parser, Path Resolver, watcher and toolchain inventory vectors on every
supported Windows build and block any profile not explicitly approved for that
build.
