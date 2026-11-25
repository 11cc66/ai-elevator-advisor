# P1-3 C-6.2-L8-A7.20-R4-A1-R5-R2-R2-R5 Independent Design Review

## 0. Executive Result

```text
Stage:
C-6.2-L8-A7.20-R4-A1-R5-R2-R2-R5

Date:
2026-11-22

Review Mode:
INDEPENDENT / READ-ONLY / ADVERSARIAL

Overall:
FAIL — BLOCKING DESIGN CORRECTIONS REQUIRED

Review Independence:
PASS

R5-R2-R2-R4 Integrity:
PASS — BOTH HASHES MATCH

P0:
0

P1:
7

P2:
6

P3:
2

R5-R3A Build-only Authorization:
NOT READY

Native RPC Build:
NOT EXECUTED

Native RPC Runtime:
NOT EXECUTED

Git Writes:
NOT EXECUTED
```

The R5-R2-R2-R4 design materially improves the previous revision. Trust
material authorship, approval, revocation and verification are separated;
raw Handle numbers were removed from Launch v2; Resume result is distinct from
Helper Ready; and the direct Launch Authority to Executor
`PROCESS_DUP_HANDLE` route was removed.

The design is not ready for a PASS. The remaining blockers are concentrated in
the new Termination Executor TCB and exact implementation boundaries:

1. The Executor's own service identity, startup chain, binary verification,
   DACL and replacement controls are not defined.
2. The Executor's authoritative transaction/lease/CAS state and replay journal
   have no owner or storage model.
3. `P13TerminationInvoke` lacks a concrete test-only interface UUID/version,
   build target and production-exclusion mechanism.
4. `TrustedKeySetManifest`, required for key pinning and directly named as an
   R5-R3A input, is missing from the exact R5-R3A source/schema/test scope.
5. The signed Handle Bundle has no identified signer, key, canonical encoding,
   creation/consume/expiry protocol or object replacement defense.
6. Helper Ready's challenge path and Control Server Process-Handle custody are
   inconsistent or missing.
7. Helper Bootstrapping timeout/Ready failure permits an OS termination action
   in the side-effect table but has no corresponding state transition.

These are design blockers, not claims that production code has already been
compromised. The current source still contains the old broad Handle transfer,
but R5-R3A explicitly excludes that implementation. The blocker is that the
replacement TCB cannot yet be proven safe or safely scoped.

## 1. Scope and Independence

This review evaluates the design documents, authoritative prior designs,
current v1.0 IDL and current native Harness source. It does not accept the
R5-R2-R2-R4 self-review as evidence and does not modify that correction.

Reviewed security assets:

- trust material and key selection;
- revocation chain and current-head anchor;
- Helper process, primary thread and Job;
- Resume and Helper Ready evidence;
- launch transaction transitions and replay state;
- test-only Termination Executor and RPC surface;
- R5-R3A Build-only source and artifact scope.

No implementation or Runtime claim is made for any planned R5 component.

## 2. Skills and Authoritative Inputs

The root `AGENTS.md` route was applied. The following Skills and their
task-relevant references were actually read:

- `$project-architecture` and `references/architecture-review.md`;
- `$security-audit` and `references/adversarial-review.md`;
- `$testing-and-verification` and `references/verification-matrix.md`;
- `$file-lifecycle` and `references/lifecycle-review.md`.

The following documents were read as review inputs:

- `docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r5-r2-r2-r4-second-blocking-design-corrections.md`
- `docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r5-r2-r2-r4-design-decisions-and-open-items.md`
- `docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r5-r2-r2-r3-independent-design-review.md`
- `docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r5-r2-r2-r2-blocking-design-corrections.md`
- `docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r5-r2-r2-r2-design-decisions-and-open-items.md`
- `docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r5-r2-r2-r1-independent-blocking-design-review.md`
- `docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r5-r2-r1-independent-design-review.md`
- `docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r5-r1-native-rpc-runtime-readiness-review.md`
- `docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r4-b3-p1-remediation-design-p2-closure-plan.md`
- `docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r4-b4-p1-p2-remediation-build-report.md`
- `docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r4-b5-independent-post-remediation-adversarial-review.md`
- `docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s7-report.md`
- `docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r4-d1-native-rpc-harness-architecture-build-plan.md`

Current source reviewed:

- `tools/native-rpc/p13-a1-r2/idl/p13_authority.idl`
- `tools/native-rpc/p13-a1-r2/include/common/p13_types.h`
- `tools/native-rpc/p13-a1-r2/src/common/p13_types.cpp`
- `tools/native-rpc/p13-a1-r2/include/identity/p13_identity_adapter.h`
- `tools/native-rpc/p13-a1-r2/src/identity/windows_identity_adapter.cpp`
- `tools/native-rpc/p13-a1-r2/include/authority/p13_*`
- `tools/native-rpc/p13-a1-r2/src/authority/p13_*`
- `tools/native-rpc/p13-a1-r2/include/launch/p13_launch_components.h`
- `tools/native-rpc/p13-a1-r2/src/launch/p13_launch_components.cpp`
- `tools/native-rpc/p13-a1-r2/include/lifecycle/p13_lifecycle_adapters.h`
- `tools/native-rpc/p13-a1-r2/src/lifecycle/job_lifecycle_adapter.cpp`
- `tools/native-rpc/p13-a1-r2/src/lifecycle/sealed_adapter.cpp`
- `tools/native-rpc/p13-a1-r2/src/server/p13_managers.cpp`
- `tools/native-rpc/p13-a1-r2/src/server/p13_server_runtime.cpp`
- `tools/native-rpc/p13-a1-r2/src/client/p13_client_runtime.cpp`
- `tools/native-rpc/p13-a1-r2/build-b4.ps1`
- `tools/native-rpc/p13-a1-r2/verify-static-b4.ps1`
- `tools/native-rpc/p13-a1-r2/tests/b4/native_test_sources.cpp`
- `packages/authority-core/src` and `packages/authority-core/tests`

## 3. Hash and Baseline Verification

### 3.1 Input hashes

| Input | Expected | Actual | Result |
|---|---|---|---|
| R5-R2-R2-R4 main | `11654ADEB83EF116267C70D1F9AD9015A308FA24D27DE7DEC9510FB4907100BB` | same | PASS |
| R5-R2-R2-R4 decisions | `3F13F125667F53D26C4DADA178B2518402D4470686EF7E231555AC135F25B158` | same | PASS |
| R5-R2-R2-R3 review | `387CEC395879504828D1B2FD7713EC275B920B8133EEEB7BB6F43147E0A6B8C9` | same | PASS |

### 3.2 Start repository state

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

Tracked modified:
26

Untracked before this review report:
244

Untracked after this report was added:
245

Staged:
0

Deleted:
0
```

The untracked count is one greater than R5-R2-R2-R4's final count of 243. The
difference is a zero-length root file `D:\thinkbook\Desktop\jieya\$null`.

- `$null)` remains absent.
- `$null` is now present, length 0, SHA-256
  `E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855`.
- This review did not delete, move or truncate it.
- Because prior stages required `$null` absent and this review is read-only,
  the repository baseline cannot be marked PASS.

### 3.3 PFR and historical build integrity

PFR remained:

```text
46 strings
23 DELETE
SHA-256:
0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC
```

All B1 and B4 artifact hashes and the six protected-object hashes matched.
No `p13_native*` process was running at review start.

## 4. Trust Authority Independence

### 4.1 Role separation

| Role | Independent key/identity | Write authority | Conflicting authority | Result |
|---|---|---|---|---|
| Manifest Issuer | design: distinct | manifest only | cannot approve | PASS AT DESIGN |
| Authorization Issuer | design: distinct | authorization only | cannot approve | PASS AT DESIGN |
| Approval Authority | design: offline, distinct | approval only | cannot issue manifest/auth/revoke | PASS AT DESIGN |
| Revocation Authority | design: distinct | signed revocation event submission | cannot write anchor | PASS AT DESIGN |
| Anchor Custodian | design: distinct | revocation event append + anchor | cannot create approvals/authorizations | PASS AT DESIGN |
| Runtime Verifier | no signing key | runtime evidence only | no trusted-input write | PASS AT DESIGN |
| Test Runner | no signing key | none in trust root | no baseline mutation | PASS AT DESIGN |
| Test Coordinator | no signing key | coordination only | no approval role | PASS AT DESIGN |
| Supervisor | no signing key | launch process control | no trust approval | PASS AT DESIGN |
| Termination Executor | not fully defined | process creation/termination | trust role unspecified | FAIL / P1-01 |
| Helper | no signing key | helper RPC operations | no trust approval | PASS AT DESIGN |

The role table and directory ACL model prevent the named non-administrator
roles from both authoring and approving the same trust material. The design
also prohibits key delegation, shared signing brokers and alias identities.

### 4.2 Critical gap: pinned key-set material

R5-R2-R2-R4 states that trusted public keys are pinned by
`TrustedKeySetManifest`, included in the R5-R3A Build Manifest
(`...r5-r2-r2-r4-second-blocking-design-corrections.md:308`).

The exact R5-R3A inventory contains no `TrustedKeySetManifest` source,
header, JSON schema, fixture or test symbol. It lists identity,
authorization, approval and revocation schemas, but not the key-set manifest
or its user-approved digest. The future failure condition requires a trusted
key-set digest without defining where it comes from.

Impact: signature verification can compile while having no approved key
selection source. A Build-only implementation could use an ad hoc key table
outside the approved scope.

This directly blocks R5-R3A and is finding P1-04.

### 4.3 Threat-model consistency

The documents consistently exclude local/domain administrator, backup
operator restoring the whole host, kernel compromise, compromised signing
keys, Host Administrator replacement of binaries/ACLs and compromised TCBs.
Those exclusions are explicit and are not overstated within the reviewed
software boundary.

## 5. Revocation Anchor Review

The design distinguishes:

```text
Revocation Event Chain
Chain Head Digest
Current Revocation Generation
Independent Current-Head Anchor
Approval Record
Trust Snapshot
```

For ordinary users and the defined role identities, the selected local signed
checkpoint provides the intended non-administrator anti-rollback control:

- Revocation Authority cannot write anchor state.
- Anchor Custodian validates the event signature and previous head.
- Missing, discontinuous, signed-by-wrong-key or older snapshots fail closed.
- A concurrent writer is serialized by one Anchor Custodian.
- Event append followed by checkpoint failure blocks authorization.
- Full-host restore by an administrator remains outside the guarantee.

This part is acceptable within its declared threat model.

P2-03 remains because the document does not define the durable file protocol:
canonical serialization, file locking, temp-file plus atomic rename, flush
before checkpoint publication, recovery of torn writes, or the exact evidence
produced when one half commits. The design outcome is fail-closed, but the
implementation boundary is not yet reproducible.

## 6. R5T_TERMINATION_EXECUTOR TCB Review

### 6.1 Startup and identity

R5-R2-R2-R4 selects `R5T_TERMINATION_EXECUTOR` as a test-only TCB
(`:619-645`) but does not define:

- who starts the Executor;
- whether it runs as a Windows service, a coordinator child, or another
  process;
- its service SID and service DACL;
- who can stop, restart, reconfigure or replace it;
- its fixed image path, working directory, environment and command line;
- how it verifies its own signed release identity before accepting RPC;
- how DLL search/side-loading and writable-directory dependencies are
  excluded;
- how old and new instances are prevented from coexisting;
- what happens to an existing Helper if the Executor is restarted.

The companion explicitly leaves `Termination Executor SID/DACL` open until
R5-D (`...r5-r2-r2-r4-design-decisions-and-open-items.md:58`) and lists
`Termination Executor handle-bind protocol` as open (`:59`).

Impact: the reviewer cannot establish a trust root from SCM/startup through the
Executor binary, its process token and its RPC endpoint. Any caller allowed to
replace or reconfigure the Executor could become a second termination
authority or execute the Helper under another policy.

Finding: P1-01.

### 6.2 Process creation authority

The report correctly requires:

- fixed Helper plan;
- restricted primary token creation inside the Executor;
- `DISABLE_MAX_PRIVILEGE` and a unique restricting SID;
- `CREATE_SUSPENDED`;
- Job association through `PROC_THREAD_ATTRIBUTE_JOB_LIST`;
- `bInheritHandles=FALSE`;
- Job membership and creation-time verification;
- narrowing the all-access handles returned by `CreateProcessAsUser` and
  `CreateJobObject`.

The design does not specify cryptographically how the Executor independently
verifies the Helper image hash/signature and its canonical path before creation.
It states "fixed plan" and "manifest-approved", but the plan's trusted loader,
release hash and failure behavior are absent.

This is part of P1-01's TCB self-trust gap.

### 6.3 Unique termination authority

The intended OS model is sound:

```text
Launch Authority: no Token/Process/Job handle
Supervisor: query/synchronize Process + THREAD_SUSPEND_RESUME Handle only
Termination Executor: PROCESS_TERMINATE + JOB_OBJECT_TERMINATE + Job Handle
```

The current source still contains the opposite behavior:

- `src/lifecycle/job_lifecycle_adapter.cpp:204-227` duplicates
  `PROCESS_TERMINATE` and `JOB_OBJECT_TERMINATE` to Supervisor.
- Current `RevokeAndWait` and `WindowsProcessControl::TerminateProcessSafe`
  call `TerminateProcess`.

That current implementation is intentionally excluded from R5-R3A, so it is not
silently approved. However, until the Executor startup/DACL/state design is
complete, the planned uniqueness remains an architectural intention rather
than a reviewable OS boundary.

## 7. Handle and PROCESS_DUP_HANDLE Review

### 7.1 Direct path removed

The final R4 text no longer gives Launch Authority a handle to the Executor.
Restricted-token creation moved inside the Executor. The Executor, not Launch
Authority, creates the Process/Thread/Job objects.

This closes the prior direct chain:

```text
Launch Authority
  -> OpenProcess(Executor, PROCESS_DUP_HANDLE)
  -> duplicate Executor's kill-capable Handle
```

### 7.2 Remaining indirect exposure

The design still depends on an uncreated Executor DACL to deny:

- `PROCESS_DUP_HANDLE`;
- `PROCESS_VM_WRITE`;
- `PROCESS_VM_OPERATION`;
- `PROCESS_CREATE_THREAD`;
- `PROCESS_SUSPEND_RESUME`;
- `PROCESS_TERMINATE`;
- `PROCESS_SET_INFORMATION`;
- debug and handle-table access.

No exact SDDL, service SID, protected-DACL flag, inheritance policy or
`SeDebugPrivilege` exclusion is specified. Therefore scenarios 5-8 below
cannot be proven closed.

### 7.3 Handle inventory

| Object | Creator | Holder | Access | Transfer | Re-duplicate | Close/evidence | Review |
|---|---|---|---|---|---|---|---|
| Executor token source | Executor | Executor transient | query/duplicate token | no | only within Executor | token creation proof | PARTIAL |
| Restricted Helper token | Executor | Executor transient | assign-primary/duplicate/query | no | no RPC Handle | create-process result + close | PARTIAL |
| Create-time Process Handle | Executor | Executor transient | all access returned | no | Executor only | narrowed + original close | DESIGN OK |
| Create-time Thread Handle | Executor | Executor transient | all access returned | no | Executor only | narrowed + original close | DESIGN OK |
| Create-time Job Handle | Executor | Executor transient | all access returned | no | Executor only | narrowed + original close | DESIGN OK |
| Helper terminate Process Handle | Executor | Executor | query/sync/terminate | no | no external DACL | original close after bundle proof | PARTIAL |
| Helper Job Handle | Executor | Executor | query/terminate/set attrs | no | no external DACL | final close + KILL fallback | PARTIAL |
| Helper primary Thread Handle | Executor | Executor until commit; Supervisor after | suspend/resume/query | allowed | yes | handoff/close evidence | PARTIAL / P2-01 |
| Supervisor target Process Handle | Executor | Executor transient | `PROCESS_DUP_HANDLE` | transient | yes while open | close proof | DESIGN OK |
| Control Server Helper Process Handle | not specified | not specified | query/synchronize required | not specified | unknown | creation-time proof unclear | FAIL / P1-06 |
| Executor Process target Handle | none | none | none | no | no | DACL not configured | NOT PROVEN |
| Helper Job duplicate | none | none | none | no | no | Runtime proof required | NOT VERIFIED |
| inherited handles | none | none | none | no | no | `bInheritHandles=FALSE` | DESIGN OK |

The inventory is materially better than the prior version but remains
incomplete because Helper Ready requires a trusted server-side Process Handle
that is not assigned to the Control Server.

## 8. Supervisor Resume Handle

Supervisor receives a duplicate with:

```text
THREAD_SUSPEND_RESUME | THREAD_QUERY_INFORMATION
```

`THREAD_SUSPEND_RESUME` permits both `ResumeThread` and `SuspendThread`.
The design consistently prevents this Handle from terminating the process, but
does not define:

- why the ability to suspend is required;
- how repeated SuspendThread calls are prevented;
- whether Supervisor can starve Ready or Revoke;
- what evidence records suspend/resume counts;
- how watchdog deadlines react to a Supervisor-created suspended state.

This is P2-01. It is not a second termination authority, but it is another
process-control capability and must not be described as read-only.

## 9. Bundle ID and Signed Digest

The removal of raw numeric Handle fields from `P13LaunchTransferResult` is
correct. The design now says only `handleBundleId` and `transferDigest` remain
and explicitly states that numeric Handles do not cross RPC, logs, evidence or
persistence.

However, the report does not define:

- who signs the bundle (`Launch Authority`, `Termination Executor`, or another
  trusted role);
- which key and signature algorithm authenticate that signer;
- the canonical byte representation covered by `transferDigest`;
- whether the digest is merely `SHA-256` or is signed with a public/private
  key pair;
- a Bundle creation/consume/expire/destroy state machine;
- how a Bundle ID is bound to the current Handle objects rather than only
  metadata;
- how replays after an Executor restart are rejected;
- what prevents a valid signed metadata bundle from referring to a replaced
  Process/Job object with the same numeric IDs.

The report correctly says a digest is not proof of current Handle custody, but
it does not provide the additional object-identity proof needed to make that
boundary implementable.

Finding: P1-05.

## 10. Helper Authenticated Ready

The state names correctly distinguish:

```text
COMMITTED
RESUME_DISPATCHED
RESUME_API_RESULT
HELPER_BOOTSTRAPPING
RUNNING
```

`ResumeThread` is not treated as execution proof. `P13_AUTH_HELPER_REGISTER`
remains the only public operation and no third public Manager is claimed.

Two implementation-level contracts are still incomplete:

1. Launch Authority generates the 128-bit challenge and sends it through a
   "fixed helper argv allowlist" (`...r5-r2-r2-r4-second-blocking-design-corrections.md:894-899`),
   but Launch Authority no longer creates the Helper. The report does not
   define how the raw challenge reaches the Executor that constructs argv or
   how it is excluded from logs/evidence.
2. Ready requires a "server-held Process Handle" (`:880`), but the Handle
   inventory has no Control Server Helper query/synchronize Handle. The
   Executor has the process Handle and Supervisor has only a duplicate; the
   Control Server cannot validate creation time from a PID alone.

The READY payload also needs an exact canonical schema, one-time consume rule
and durable challenge/replay evidence. The report gives the field list but not
the serialization or transaction-store atomics.

Finding: P1-06.

## 11. C17 and State-Machine Consistency

The main Launch transitions are consistent for:

- `COMMITTED -> ABORT_PENDING` only before C26;
- `RESUME_DISPATCHED -> TERMINATING` on C27 failure;
- `UNKNOWN` and `QUARANTINED` never becoming `CLOSED`;
- `RUNNING` requiring C28;
- termination evidence before `CLOSED`.

One inconsistency remains:

- The state diagram has
  `HELPER_BOOTSTRAPPING -> UNKNOWN: Ready absent/timeout` (`:958`).
- The C17 table has the same destination (`:1007`).
- Section 12.1 nevertheless says `HELPER_BOOTSTRAPPING | request termination;
  retain target | UNKNOWN/QUARANTINED` (`:1032`).
- The diagram contains no `HELPER_BOOTSTRAPPING -> TERMINATING` edge or
  explicitly defined UNKNOWN-state termination action.

The matrix therefore permits an OS action that has no connected transition.
This violates the requirement that every allowed action have a precondition,
actor, evidence, success state and failure state.

Finding: P1-07.

The report also only reconstructs the launch portion. It does not provide a
complete C01-C25 command matrix in this R4 report; C26-C28 are defined, but
the earlier session/operation commands are only referenced through prior
documents. The final design should carry one consolidated matrix with
identity, Grant, Generation, Revision, side effect and evidence per command.
This is P2-04, not a reason to claim the old operation contracts changed.

## 12. Terminator Request and Recovery Protocol

The report lists request fields:

```text
transactionId
transactionRevision
generation
bootEpochId
watchdogGeneration
terminationRequester
terminationLeaseToken
processId/creationTime
```

and says the Executor performs CAS. It does not define:

- who creates the authoritative transaction record;
- who issues the termination lease and its generation;
- where the expected revision is stored;
- how concurrent requests are serialized;
- how a repeated request is recognized after a response is lost;
- how an old request is rejected after Executor restart;
- what durable evidence exists if the Executor dies after
  `TerminateProcess` but before recording the result;
- whether the Executor has any storage at all; R4 says it has no
  Storage/DB/Control Manager permissions.

The companion explicitly leaves the handle-bind protocol open
(`...r4-design-decisions-and-open-items.md:59`). Without a separate
authoritative state source, caller-supplied transaction/lease values cannot
prove ownership or replay protection.

Finding: P1-02.

## 13. Job Object and KILL_ON_JOB_CLOSE

The design correctly treats `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` as a candidate
fallback, not as proof:

- anonymous Job;
- no breakaway;
- `ActiveProcessLimit=1`;
- no inherited Job Handle;
- no external `PROCESS_DUP_HANDLE` on Executor;
- final Job Handle owned by Executor;
- Runtime verification required.

`KILL_ON_JOB_CLOSE` is not proven until the actual Executor DACL and Handle
inventory exist. It also cannot produce durable evidence after the Executor
has died; the resulting state must remain `UNKNOWN/QUARANTINED` until an
independent observer resolves the process/Job state.

## 14. NDR and Wire Budget

The report's calculation is:

```text
P13LaunchEnvelope x64 in-memory base:       216
Maximum request payload:                   16384
P13Response:                                 576
P13LaunchTransferResult x64 in-memory:       280
Pointer/alignment reserve:                    64
Transport/header reserve:                   4096

Design upper bound:
216 + 16384 + 576 + 280 + 64 + 4096 = 21616
```

This is arithmetically conservative for the current fixed field layout, but it
is not an NDR measurement. It does not establish:

- actual NDR pointer widths and referent tables;
- maximum conformant array encoding;
- MIDL alignment of the 280-byte result;
- whether the request and response are subject to one or two transport
  limits;
- the actual wire size after the v2 result is generated.

The future Build-only verifier must record exact request and response sizes
from generated stubs and reject any combination above 24576. This remains
P2-06.

## 15. R5-R3A Build-only Conditions

The exact source/symbol/object list is substantially improved. It identifies:

- `CallerExpectation`, `CallerIdentityRecord`, `SidEvidence`;
- `SameIdentity`, `DescriptorForId`, `ExpectationFor`;
- Authz groups/restricted/Logon comparisons;
- exact failure cases and object paths;
- B1/B4/PFR/protected stop checks;
- no Coordinator, Termination Executor or Launch v2 source in R5-R3A.

It is not yet independently authorizable because P1-04 leaves the trusted
public-key set outside the exact source set. The `TrustedKeySetManifest`,
its user-approved digest and its verifier symbol must be added as exact R5-R3A
inputs or the key-pinning requirement must be moved out of R5-R3A.

The current R5-R3A source files are absent, which is expected and is not a
source defect. Their absence means all runtime behavior remains unverified.

## 16. Test-only RPC Boundary

Current v1.0 IDL contains exactly:

```text
interface P13Authority -> P13Invoke
interface P13Launch    -> P13LaunchInvoke
```

No `P13TerminationInvoke` source or registration exists under
`tools/native-rpc/p13-a1-r2`.

R5-R2-R2-R4 gives a symbolic interface name and endpoint for
`P13TerminationInvoke`, but not its UUID, version, IDL file, generated stub
symbols, binary target, service registration target, output path, manifest
entry or Release-exclusion rule. A comment saying "test-only" is not an
enforceable boundary.

Finding: P1-03. This is separate from R5-R3A's current source list, which
already excludes Termination Executor code.

## 17. R5-R3B Identity Dependency

The R5-R3A design uses role identities but does not require the Termination
Executor or Coordinator to be running. Its Build-only compile can remain
independent of the unbounded R5-R3B runtime identities.

However, the following must be frozen before the corresponding runtime stage:

- Coordinator UUID/version/Manager contract;
- Termination Executor service SID/DACL;
- test-only Termination Manager UUID/version;
- bundle signer/key;
- Control Server Helper Process-Handle custody;
- termination transaction/lease store;
- helper challenge transport.

These are not valid reasons to delay a pure R5-R3A compile-only source review,
but they are reasons not to promote the overall R5 design to an implementation
authorization.

## 18. D1 v1.0 Freeze Exception

Current `P13_PROCESS_LAUNCH_V1` remains:

```text
UUID: B2D9E41C-34D5-4046-96B6-9E14AA9D533E
Version: 1.0
Manager: P13LaunchInvoke
```

Current IDL still has only `P13LaunchEnvelope`, `P13Response` and
`P13LaunchInvoke`.

R5-R2-R2-R4 correctly keeps D1 v2.0 unapproved. The proposed typed result
changes the ABI and must remain in
`D1-FREEZE-EXCEPTION-R5-LAUNCH-V2`.

Helper Ready using the existing `P13_AUTH_HELPER_REGISTER` operation avoids a
new public Manager but still needs an exact canonical payload schema and
compatibility rule. If that payload schema changes the frozen operation
contract, it must be separately approved; a field list in a design report is
not a D1 amendment.

The test-only `P13TerminationInvoke` must not be registered in v1 or v2
production launch interfaces.

## 19. Adversarial Design Matrix

Legend:

- `PASS`: design or current boundary prevents the scenario within the stated
  threat model.
- `FAIL`: design cannot block the scenario as written.
- `BLOCKED`: the necessary identity, source or state evidence is absent.
- `N/A`: only reachable after a future separately authorized stage.

| ID | Precondition and attack/failure steps | Expected control | Result | Evidence/final state | Blocks R5-R3A |
|---|---|---|---|---|---|
| 01 | Manifest Issuer creates manifest and tries to sign approval | independent Approval signature | PASS | wrong key ID, DENY | no |
| 02 | Revocation Authority appends valid revocation then replaces anchor with old head | Anchor Custodian monotonic CAS | PASS within non-admin threat model | generation/head mismatch, fail closed | no |
| 03 | Anchor Custodian unavailable | no authorization | PASS | no Trust Snapshot, fail closed | no |
| 04 | Anchor checkpoint updated but event append fails | atomic recovery or fail closed | PARTIAL | ordering must become UNKNOWN until scan; P2-03 | no |
| 05 | Executor binary is replaced or injected at startup | signed image, fixed path and protected service DACL | FAIL | no startup/identity chain; P1-01 | no, but blocks overall design |
| 06 | Launch Authority requests Executor `PROCESS_DUP_HANDLE` | Executor DACL denies | BLOCKED | DACL not defined; P1-01/C | no |
| 07 | Supervisor requests Executor `PROCESS_DUP_HANDLE` | Executor DACL denies | BLOCKED | same | no |
| 08 | Test Runner tries to obtain a termination Handle | no Handle/lease path | BLOCKED | TCB DACL/state absent | no |
| 09 | Helper tries to obtain Job Handle | child restriction/Job DACL | BLOCKED | no exact Job DACL; Runtime proof absent | no |
| 10 | CreateProcess inherits an unexpected Handle | `bInheritHandles=FALSE` and handle-list audit | PASS AT DESIGN | inventory empty inheritance; runtime not verified | no |
| 11 | DuplicateHandle uses `DUPLICATE_SAME_ACCESS` | explicit masks only | PASS AT DESIGN | current source uses explicit masks; planned design forbids SAME_ACCESS | no |
| 12 | Executor creates Helper but Job assignment fails | terminate before Resume and record UNKNOWN | PASS AT DESIGN | suspended process, terminate/wait, no commit | no |
| 13 | Helper exits before Resume | process-Signaled path | PASS | RECONCILING/UNKNOWN, no RUNNING | no |
| 14 | ResumeThread returns 0 | do not infer RUNNING | PARTIAL | UNKNOWN; no explicit immediate termination request | no |
| 15 | ResumeThread returns 1 | transition to bootstrapping | PASS | HELPER_BOOTSTRAPPING | no |
| 16 | ResumeThread returns greater than 1 | do not resume again | PASS | UNKNOWN/fail closed | no |
| 17 | ResumeThread fails | terminate | PASS AT DESIGN | TERMINATING -> UNKNOWN/TERMINATED | no |
| 18 | API success but no Helper Ready | timeout/reconcile/terminate | PARTIAL | state says UNKNOWN, termination action missing transition; P1-07 | no |
| 19 | Old Challenge is replayed | digest one-time consume | DESIGN ONLY | exact transaction store absent; P1-06 | no |
| 20 | Ready uses old generation | transaction/generation/revision binding | DESIGN ONLY | schema/store absent | no |
| 21 | Another process claims Helper PID/session | RPC caller PID + Process Creation + Token binding | PARTIAL | Control Server Process Handle not inventoried; P1-06 | no |
| 22 | Supervisor indefinitely suspends Helper | bounded/audited suspend state | FAIL | Supervisor has `THREAD_SUSPEND_RESUME`; P2-01 | no |
| 23 | Both watchdogs request termination concurrently | lease/revision CAS | PARTIAL | authoritative CAS store absent; P1-02 | no |
| 24 | Executor crashes after request before Terminate | Job close fallback or UNKNOWN | PARTIAL | KILL fallback not verified; no second authority | no |
| 25 | Executor calls Terminate then crashes before Evidence | durable evidence or UNKNOWN | PARTIAL | no evidence store; preserve target, P1-02 | no |
| 26 | Executor hangs indefinitely | no second executor; quarantine | PASS AT DESIGN | UNKNOWN/QUARANTINED; liveness sacrificed | no |
| 27 | Last Job Handle remains live | no inherited/duplicate/root-external Handle | BLOCKED | exact DACL/inventory/runtime evidence absent | no |
| 28 | Job Handle leaks | explicit close proof | BLOCKED | no implementation or Runtime evidence | no |
| 29 | Bundle ID replay | one-time creation/consume/expiry and transaction binding | FAIL | no lifecycle protocol; P1-05 | no |
| 30 | Signed metadata points to replaced Process/Job | live object identity evidence independent of digest | FAIL | no object replacement proof; P1-05 | no |
| 31 | C17/state graph diverges | exact one-to-one transition matrix | FAIL | Helper Bootstrapping termination mismatch; P1-07 | no |
| 32 | COMMIT/RESUME/REVOKE/TERMINATE race | revision/generation CAS and terminal exclusivity | PARTIAL | only design-level; state source absent; P1-02 | no |
| 33 | Production build includes P13TerminationInvoke | separate IDL/target and Release exclusion | FAIL | no UUID/target/output/SCM exclusion; P1-03 | no, but blocks overall |
| 34 | New TCB enters production Manifest | signed production manifest exclusion | FAIL | no exact TCB artifact/manifest boundary; P1-03 | no |
| 35 | R5-R3A depends on unapproved R5-R3B identity | exact input set and no runtime dependency | PARTIAL | R5-R3A avoids TCB but misses TrustedKeySetManifest; P1-04 | YES |

## 20. Findings

### P0

None confirmed.

### P1-01 — Termination Executor TCB is not self-authenticated or startup-bounded

Files/lines:

- `...r5-r2-r2-r4-second-blocking-design-corrections.md:619-645`
- `...r5-r2-r2-r4-design-decisions-and-open-items.md:58-59`

Identity/functions:

- `R5T_TERMINATION_EXECUTOR`
- `P13TerminationInvoke`
- service startup, image verification and Executor process DACL

Attack condition:

A non-authorized process or service operator replaces, reconfigures or starts
an alternate Executor with a writable path, broad DACL or incomplete release
verification, then obtains/creates termination-capable objects.

Impact:

The claimed unique OS termination authority is not proven at the process/TCB
boundary. A valid design cannot rely on the Executor's own string identity.

Why current design fails:

It names the TCB but leaves SID/DACL and service/startup details open. It does
not define image hash/signature verification, fixed executable path/environment,
replacement prevention, old/new instance exclusion or restart behavior.

Fix direction:

Freeze one test-only Executor artifact and service identity; specify SCM/DACL,
protected ACL, image hash/signature validation, no-writable-path DLL loading,
single-instance boot epoch, restart policy and old-instance quarantine. Make
the TCB startup independently verifiable before Runtime.

Blocks R5-R3A:

No direct source dependency. It blocks the overall design and every later TCB
stage; it cannot be waived for a PASS.

### P1-02 — Termination transaction authority and CAS source are absent

Files/lines:

- `...r5-r2-r2-r4-second-blocking-design-corrections.md:678-735`
- `...r5-r2-r2-r4-design-decisions-and-open-items.md:59`

Fields:

- `transactionRevision`
- `terminationLeaseToken`
- `watchdogGeneration`
- `bootEpochId`

Attack/failure condition:

A stale or duplicate request supplies transaction metadata; or the Executor
crashes after accepting a request but before recording the result. The design
says CAS but does not identify the authoritative record or persistence layer.

Impact:

Stale, duplicate, lost-response and restart behavior cannot be proven. The
caller could become the source of the metadata the Executor claims to validate.

Why current design fails:

The Executor is declared to have no Storage/DB/Control-Manager permission, yet
no in-memory/durable state owner, request journal, lease issuer or idempotency
key is defined.

Fix direction:

Define the authoritative transaction state as a separately owned test store,
with revision CAS, lease issuance, request ID, consume/expiry, crash recovery
and explicit UNKNOWN/quarantine behavior.

Blocks R5-R3A:

No; blocks R5-D and the overall PASS.

### P1-03 — P13TerminationInvoke is not yet an enforceable test-only boundary

Files/lines:

- `...r5-r2-r2-r4-second-blocking-design-corrections.md:627-645`

Identity/interfaces:

- `P13_R5_TERMINATION_EXECUTOR_V1`
- endpoint `p13-r5-termination-v1`
- Manager `P13TerminationInvoke`

Attack condition:

A source/build target or registration path accidentally includes the manager
in a production binary or signed release because only a naming convention
marks it test-only.

Impact:

The production RPC surface could gain a third termination-capable Manager.

Why current design fails:

No UUID/version, separate IDL file, generated symbols, exact EXE output,
service registration target, manifest entry or Release-exclusion check is
specified.

Fix direction:

Freeze an independent test-only IDL and Manager UUID/version, binary path,
registration owner, manifest exclusion and static negative test proving the
production Server has no import/export/registration symbol.

Blocks R5-R3A:

No if the exact R5-R3A files remain unchanged; blocks overall design and
release integrity.

### P1-04 — TrustedKeySetManifest is required but absent from R5-R3A scope

Files/lines:

- `...r5-r2-r2-r4-second-blocking-design-corrections.md:308`
- `...r5-r2-r2-r4-second-blocking-design-corrections.md:1094-1268`

Symbols:

- `TrustedKeySetManifest`
- `KEY_MANIFEST`
- `KEY_AUTHORIZATION`
- `KEY_APPROVAL`
- `KEY_REVOCATION`
- `KEY_ANCHOR`

Attack condition:

The Build uses compiled or environment-local public keys not covered by the
user-approved key-set digest, or fails to compile because no key-set loader or
source is in the exact scope.

Impact:

Signature verification cannot establish that the expected signer is user
approved. A manifest/auth/approval key substitution can survive a superficially
valid signature test.

Why current design fails:

The trusted key set exists only in prose. The exact file/schema/test inventory
does not include its path, structure, digest, loader, verifier or positive
test.

Fix direction:

Add exact `TrustedKeySetManifest` schema/source/fixture/loader and user-approved
digest verification to R5-R3A, or remove key-pinning claims from R5-R3A and
mark the entire trust path BLOCKED until supplied.

Blocks R5-R3A:

YES.

### P1-05 — Bundle signature and live-object binding are incomplete

Files/lines:

- `...r5-r2-r2-r4-second-blocking-design-corrections.md:745-765`
- `...r5-r2-r2-r4-second-blocking-design-corrections.md:1088-1096`

Fields:

- `handleBundleId`
- `transferId`
- `transferNonce`
- `handleBundlePresent`
- `transferDigest`

Attack/failure condition:

A bundle is replayed, stale, signed by an unspecified party, or names a
replaced Process/Job after restart. A digest can be valid for metadata while
the actual Handle object is gone or different.

Impact:

The service cannot prove which local Handle objects the Supervisor/Executor
actually own.

Fix direction:

Define a signer identity and key, canonical serialization, signature algorithm,
transaction/revision/process-creation binding, creation/consume/expiry state,
and a live object-identity proof from the Handle owner. State explicitly that
the digest alone never proves Handle custody.

Blocks R5-R3A:

No; blocks R5-D/Launch v2.

### P1-06 — Helper Ready lacks a complete challenge and Process-Handle chain

Files/lines:

- `...r5-r2-r2-r4-second-blocking-design-corrections.md:577-602`
- `...r5-r2-r2-r4-second-blocking-design-corrections.md:873-921`

Fields/classes:

- `P13_AUTH_HELPER_REGISTER`
- `READY`
- `readyChallenge`
- `server-held Process Handle`
- `R5T_TERMINATION_EXECUTOR`

Attack/failure condition:

Launch Authority generates a raw challenge but no longer creates the Helper;
the path to the Executor's argv is undefined. The Control Server receives a
Ready payload but has no process Handle inventory entry to verify caller PID
and Creation Time against the launched object.

Impact:

Helper Ready can be ambiguous or incorrectly bound; a same-SID process with a
wrong process object cannot be rejected with the stated evidence chain.

Fix direction:

Specify challenge generation and handoff to the Executor, exclude it from
logs/persistence, define the exact canonical Ready payload schema, and add a
Control Server query/synchronize Handle created from the authenticated RPC
caller with the exact expected PID/creation time comparison.

Blocks R5-R3A:

No; blocks Helper Ready/Runtime.

### P1-07 — Helper Bootstrapping termination has no state transition

Files/lines:

- `...r5-r2-r2-r4-second-blocking-design-corrections.md:952-958`
- `...r5-r2-r2-r4-second-blocking-design-corrections.md:1001-1032`

States:

- `HELPER_BOOTSTRAPPING`
- `UNKNOWN`
- `TERMINATING`

Attack/failure condition:

Ready never arrives. The graph moves directly to UNKNOWN, while the side-effect
table says to request termination. The resulting state/action pair has no
actor, revision, evidence or success/failure transition.

Impact:

An active Helper can remain in an UNKNOWN state while an unmodeled kernel
termination is allowed; C17 and the graph are not one-to-one.

Fix direction:

Add an explicit `HELPER_BOOTSTRAPPING -> TERMINATING` transition on watchdog
timeout/failure, or define a legal UNKNOWN-state termination action with the
same actor/CAS/evidence fields. Keep `ABORTED` forbidden after Resume.

Blocks R5-R3A:

No; blocks the design consistency gate.

### P2 Findings

#### P2-01 — Supervisor suspend capability is unconstrained

Supervisor receives `THREAD_SUSPEND_RESUME`, which permits SuspendThread as
well as ResumeThread. No suspend counter, timeout or audit rule is specified.
This is not termination authority but is a DoS/process-control risk.

#### P2-02 — Executor image/path/environment/DACL details are not exact

The design states fixed plan and no client executable path but does not freeze
the exact loader, executable hash/signature policy, working directory,
environment allowlist, DLL search restrictions or service DACL SDDL.

#### P2-03 — Anchor file durability protocol is incomplete

The chain/anchor recovery is fail-closed conceptually, but atomic file
publication, flush, locking, torn-write recovery and durable evidence are not
specified.

#### P2-04 — C01-C25 consolidated operation matrix is absent

The report defines C17 and C26-C28 but does not carry a complete consolidated
C01-C25 matrix with actor, Grant, revision, side effect, evidence and failure
state in this correction document.

#### P2-05 — Repository baseline drift: `$null`

`D:\thinkbook\Desktop\jieya\$null` reappeared as an untracked zero-byte file.
The report's required absence check now fails. It is not a privileged file and
was not removed by this review, but the Builder must not infer that the
historical baseline is unchanged.

#### P2-06 — NDR 21616 remains an estimate

The formula is conservative for the described layout but has no measured NDR
encoding. It must remain Build-only verification.

### P3 Findings

- `P3-01`: The R4 report calls its current state `DESIGN CLOSED` while the
  companion still leaves the Executor SID/DACL and handle-bind protocol open.
- `P3-02`: The R5-R3A narrative says no other authored header is a compile
  input but does not enumerate all standard Windows headers; clarify "authored
  project header" to avoid an impossible interpretation.

## 21. Final Status Matrix

```text
Overall:
FAIL — BLOCKING DESIGN CORRECTIONS REQUIRED

Review Independence:
PASS

R5-R2-R2-R4 Main Integrity:
PASS

R5-R2-R2-R4 Decisions Integrity:
PASS

Trust Authority Role Separation:
PASS AT DESIGN

Trusted Key-Set Material:
FAIL — MISSING FROM R5-R3A EXACT SCOPE

Revocation Anchor:
PASS WITH WARNINGS WITHIN NON-ADMIN THREAT MODEL

Termination Executor TCB Startup:
FAIL — NOT DEFINED

Unique OS Termination Authority:
INTENT ONLY / NOT PROVEN

PROCESS_DUP_HANDLE Direct Path:
REMOVED AT DESIGN

PROCESS_DUP_HANDLE Indirect Paths:
NOT PROVEN UNTIL TCB DACL EXISTS

Handle Inventory:
PARTIAL — CONTROL SERVER HANDLE MISSING

Bundle Signature/Object Binding:
BLOCKED — SIGNER AND LIFECYCLE ABSENT

Helper Ready:
PARTIAL — CHALLENGE AND PROCESS-HANDLE CHAIN ABSENT

C17 / State Graph:
FAIL — HELPER_BOOTSTRAPPING TERMINATION EDGE MISSING

NDR 21616:
DESIGN ESTIMATE / NOT BUILD VERIFIED

R5-R3A Build-only:
NOT READY — TRUSTEDKEY SET GAP

P13TerminationInvoke Test Boundary:
NOT ENFORCEABLE YET

D1 v1.0:
FROZEN

D1 v2.0:
NOT APPROVED

Native RPC Runtime:
NOT EXECUTED

Repository Integrity:
FAIL — `$null` PRESENT
```

## 22. Required Corrections Before R5-R3A

At minimum:

1. Add exact TCB startup, service identity/DACL, image verification and
   release-exclusion design.
2. Add the authoritative termination transaction/lease/CAS store and replay
   recovery protocol.
3. Freeze a separate `P13TerminationInvoke` IDL/UUID/build target and prove
   production binaries cannot link/register it.
4. Add `TrustedKeySetManifest` path, schema, loader, user-approved digest and
   tests to the exact R5-R3A scope.
5. Freeze Bundle signer/key/canonicalization/consume/expiry and live object
   evidence.
6. Complete Helper Ready challenge handoff and Control Server Process-Handle
   custody.
7. Reconcile Helper Bootstrapping timeout with a legal termination transition.
8. Reconcile the zero-byte root `$null` baseline under separate authorization;
   do not silently delete it in this review.

Until these are corrected, R5-R3A Build-only authorization is not recommended.
Even if the user separately authorizes a narrow compile-only slice that
excludes all trust-key work, it would not establish Runtime or TCB readiness.

## 23. Not Implemented / Not Verified

```text
Trust role OS accounts and ACLs:
NOT CREATED

Approval key and trusted key-set digest:
NOT CONFIGURED

TrustedKeySetManifest implementation:
NOT IMPLEMENTED

Anchor Custodian:
NOT IMPLEMENTED

Termination Executor:
NOT IMPLEMENTED

P13TerminationInvoke:
NOT IMPLEMENTED / UUID NOT FROZEN

Termination transaction store:
NOT IMPLEMENTED

Helper Ready challenge and control-server Handle:
NOT IMPLEMENTED

Launch v2:
NOT IMPLEMENTED / NOT BUILD VERIFIED

R5-R3A source:
NOT IMPLEMENTED

Windows Token/Process/Job/Handle behavior:
NOT VERIFIED

NDR wire size:
NOT VERIFIED

Native RPC Runtime:
NOT EXECUTED
```

## 24. Side-Effect Declaration

This review added only this report. It did not modify R5-R2-R2-R4, source,
IDL, tests, Build configuration, reports, B1/B4 artifacts, ACL/IAM, Tokens,
Processes, Jobs, services, database, Storage, PFR or Git index.

The root `$null` file was discovered as an existing zero-byte untracked file
during baseline collection. It was not opened beyond metadata/hash inspection
and was not deleted, moved or modified.

## 25. Report Integrity

This report cannot contain its own final SHA-256 without changing its content.
The external SHA-256 is calculated after the final write and returned to the
user.
