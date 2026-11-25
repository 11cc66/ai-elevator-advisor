# P1-3 C-6.2-L8-A7.20-R4-A1-R5-R2-R1 Independent Pre-Runtime Remediation Design Review

## 0. Executive Result

```text
Stage:
C-6.2-L8-A7.20-R4-A1-R5-R2-R1

Date:
2026-11-22

Mode:
INDEPENDENT READ-ONLY DESIGN REVIEW

Overall:
FAIL — DESIGN CORRECTIONS REQUIRED BEFORE R5-R3

R5-R2 Report Integrity:
PASS — SHA-256 MATCH

R5-R1 Report Integrity:
PASS — SHA-256 MATCH

Baseline Integrity:
PASS

Source / Build / Runtime Changes:
NONE

P0:
0

Blocking Design Findings:
5

Non-blocking Design Findings:
3

R5-R3 Authorization:
NOT READY

R5-A Authorization:
NOT GRANTED
```

R5-R2 correctly identifies the eight B5 P2 findings and adds the necessary
multi-process and Launch Transaction direction. Its fail-closed Evidence model,
PinnedProcessIdentity, Grant CAS model, typed identity outcome and stage split
are materially better than the current source.

It is not yet a safe basis for a single R5-R3 Build-only authorization because:

1. the Runtime Identity Manifest has no externally approved hash trust anchor;
2. the Test Coordinator lacks a complete command-to-actor and fixture-root
   security matrix;
3. the Launch PREPARE custody/timeout path is incomplete and the claimed
   crash-preserved transaction record is not durable;
4. the proposed Launch v2 contract is not frozen against the D1 v1.0 boundary;
5. the proposed R5-R3 scope still groups all high-risk remediation layers under
   “likely modified” files and placeholder output paths.

These are design blockers, not confirmed current Runtime vulnerabilities. No
Native executable was run.

## 1. Scope and Independence

This review treats every R5-R2 assertion as a claim to verify. It independently
read:

- the current source and call graph;
- B3, B4 and B5;
- R5-R1 and R5-R2;
- relevant R4-S5 through R4-S11 rules;
- the current IDL, Build Script, manifests and tests.

No source, design or build file was modified. This report is the only new file.

## 2. Skills and Authoritative Inputs

Actually read and applied:

- `$project-architecture`
- `$project-architecture/references/architecture-review.md`
- `$prisma-db-safety`
- `$prisma-db-safety/references/database-change-review.md`
- `$security-audit`
- `$security-audit/references/adversarial-review.md`
- `$testing-and-verification`
- `$testing-and-verification/references/verification-matrix.md`
- `$file-lifecycle`
- `$file-lifecycle/references/lifecycle-review.md`

The root `AGENTS.md` was automatically loaded and applied.

## 3. Baseline and Integrity

```text
Repository:
D:\thinkbook\Desktop\jieya

Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

Tracked modified:
26

Untracked before this review report:
235

Staged:
0

Deleted:
0
```

### 3.1 Required report hashes

| Input | Expected | Actual | Result |
|---|---|---|---|
| R5-R2 | `66800DA25E21C954E00BD36A86F2989C56FAB2856DB506D99F258C58BA722B3D` | `66800DA25E21C954E00BD36A86F2989C56FAB2856DB506D99F258C58BA722B3D` | PASS |
| R5-R1 | `B09A3696F4E4E27C9A2F3CD9C5741E14388553C3AD4F174BB992268EC8DEDAEF` | `B09A3696F4E4E27C9A2F3CD9C5741E14388553C3AD4F174BB992268EC8DEDAEF` | PASS |
| B5 | `3A2A1CEE642910D2F75BC05C1EB7DFE202A8B6446202C170E22730C725E618FD` | `3A2A1CEE642910D2F75BC05C1EB7DFE202A8B6446202C170E22730C725E618FD` | PASS |
| B4 | `63A4A0CE15FDE7E1EA299200B1C3EBF77D1457CD538F59094998162AB2895A6A` | `63A4A0CE15FDE7E1EA299200B1C3EBF77D1457CD538F59094998162AB2895A6A` | PASS |
| B3 | `085D5D9DCC074C76394455D9883E33F7DD125F0569C0C751E58AD4A706F6AB97` | `085D5D9DCC074C76394455D9883E33F7DD125F0569C0C751E58AD4A706F6AB97` | PASS |

### 3.2 B4 artifacts

| Artifact | Length | SHA-256 | Result |
|---|---:|---|---|
| Server | 465920 | `324D1C06BB5452FCE982119E3985AE5AB5B5A41A2D06013A709ECCD2266EEFB3` | MATCH |
| Client | 194560 | `D7BFF66F519B3B3544D8D0CC3858567B1B4CE64BCEFC1C5DFB7DFFEC6BEBCD49` | MATCH |
| Native Tests | 591872 | `AA2636BE8B53E26E79131E2C17FC863A6792D99976C01ED3A76EA7B5AF7EF3FA` | MATCH |
| Build Manifest | 12447 | `58ED3EAFF2498AFA44D4E1D92FD2CA43DD86CBA57E5E7B93B4B97204E8B79774` | MATCH |
| Static Verification | 21623 | `DEDA51B673CFA57CC653F02112C5C1322686F9B01424A80E69E6D5BEC4EB362E` | MATCH |

### 3.3 Protected files

| Object | SHA-256 | Result |
|---|---|---|
| FZ | `E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705` | MATCH |
| ST | `5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586` | MATCH |
| DBTP | `FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7` | MATCH |
| Prisma Schema | `78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299` | MATCH |
| `next-env.d.ts` | `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC` | MATCH |
| `tsconfig.tsbuildinfo` | `21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520` | MATCH |

### 3.4 PFR and paths

```text
REG_MULTI_SZ
46 strings
23 DELETE
SHA-256:
0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC
```

PFR-020 through PFR-023 remain `UNAPPROVED / NOT INCLUDED IN ANY EXCEPTION`.

`$null` and `$null)` are absent. No `p13_native*` process is running.

## 4. Independent Source Findings Retained

The current source behavior supports R5-R1's source findings:

- one process-local `HarnessState` at
  `src/authority/p13_authority_service.cpp:223-226`;
- ticket consumption at `:681-704`;
- commit/abort still use Launch Ticket binding at
  `src/authority/p13_operation_policy.cpp:86-93`;
- commit/abort therefore conflict with `ValidateLaunchTicket` at
  `src/authority/p13_authority_service.cpp:195-219`;
- lifecycle adapters have no non-test caller;
- the only public Launch response is `P13Response`, so target-relative Handle
  values have no typed result contract;
- `MarkEvidenceReconciling` accepts a final Matched state;
- Grant issue lacks duplicate Grant-ID rejection;
- identity Authz group/restricted failures can be ignored;
- descriptors compile placeholder SIDs and `{0,1,2}`.

R5-R2 correctly identifies these as remediation targets.

## 5. Review Matrix

### 5.1 B5 P2 findings

| Finding | R5-R2 coverage | Independent result | Reason |
|---|---|---|---|
| P2-B5-01 TCB | Accepts same-process TCB; optional private API hardening | PASS WITH WARNING | Trust boundary is stated; no OS-boundary claim is made |
| P2-B5-02 Identity fail-closed | Typed outcomes and full algorithm | PASS WITH WARNING | Covers every current query site; exact implementation remains to verify |
| P2-B5-03 Evidence Coordinator | Private raw-evidence reconciliation | PARTIAL | State-setter removal is sound; Evidence append/concurrency/actor matrix is incomplete |
| P2-B5-04 PinnedProcessIdentity | Kernel Handle + identity + duplicate-back | PASS WITH WARNING | Same held target Handle is used; initial PID-open race is correctly left to Runtime |
| P2-B5-05 Grant uniqueness | Global ID + operation key + revision/CAS | PASS WITH WARNING | Adequate for the test Coordinator if its command authority is corrected |
| P2-B5-06 Identity manifest | Exact identities, no placeholders | FAIL | Manifest lacks an independently approved expected hash/trust root |
| P2-B5-07 Test matrix | D1 vs B4 drift exposed; R5 classifications | PASS WITH WARNING | Design classification is honest; tests remain unimplemented |
| P2-B5-08 Revoke closure | Full ordered Revoke/Evidence path | PARTIAL | State order is sound; crash custody depends on unresolved durable Coordinator semantics |

### 5.2 R5-R1 readiness gaps

| Finding | R5-R2 coverage | Independent result | Reason |
|---|---|---|---|
| RR-01 multi-process state | Test-only Coordinator design | FAIL | Command allowlist lacks an exact actor/command matrix and fixture-root confinement |
| RR-02 Ticket transaction | ISSUED/BOUND/CLAIMED/REDEEMED model | FAIL | No explicit PREPARE deadline/custodian; in-memory record cannot support claimed crash preservation |

## 6. Blocking Finding DR-01: Runtime Identity Manifest Has No Trust Anchor

### Design requirement

The manifest must not approve itself.

The expected hash must come from a user-approved authorization record separated
from the mutable manifest and from the Test Runner's computed value.

Current R5-R2 design:

- `RuntimeIdentityManifest` contains `manifestDigest`;
- the loader verifies a hash;
- the report says the digest must match “Runtime authorization”;
- the report does not define who creates that authorization, where it is stored,
  or how the Runner cannot modify both the manifest and expected hash.

Relevant R5-R2 evidence:

- lines 963-1010 define the manifest and checks;
- line 972 places a digest inside the same manifest;
- line 1008 refers to a Runtime authorization whose trust source is undefined.

### Counterexample

```text
Runner creates identities.json
Runner computes its SHA-256
Runner launches server with both values
server reports "manifest hash matches"
```

This proves self-consistency, not approved identity configuration.

### Required design correction

Use three distinct artifacts:

```text
1. identity-manifest.json
   contains identities, endpoints and SDDL

2. runtime-authorization.json
   contains runId, exact manifest SHA-256, exact binary hashes, approved phase,
   approved Session IDs, expiry, user approval ID

3. build/runtime approval evidence
   records the authorization hash and the operator-approved command
```

Rules:

- the manifest has no trusted `manifestDigest` field of its own;
- `runtime-authorization.json` is created outside the Runner's write scope or
  in an operator-approved directory;
- the start command receives the expected authorization digest from the
  separate review/authorization record;
- server/client fail if manifest hash or binary hash differs;
- changing a Windows Session or identity requires a new manifest and a new
  approval hash;
- the Test Runner cannot generate or amend the authorization after launch.

If the Runner is fully compromised, it belongs to the test TCB. The design must
state that explicitly; it must not claim OS isolation from a compromised Runner.

### Impact

Without correction, R5-A can pass a self-authored identity configuration and
misstate “exact test identity” readiness.

### R5-R3 / gate

```text
R5-R3:
MUST CORRECT BEFORE IMPLEMENTATION

R5-A:
BLOCKING
```

## 7. Blocking Finding DR-02: Test Coordinator Authority Matrix Is Incomplete

### Design requirement

A test-only Coordinator is acceptable only if every command has:

- a fixed immutable actor class;
- a fixed run phase;
- an exact object/scope;
- expected-state revisions;
- no way to set a derived terminal state;
- no arbitrary root/path/action supplied by the Runner or a business Server.

R5-R2 lists typed commands at lines 1164-1189 but provides no command-to-actor
matrix. The list includes:

```text
GRANT_CONSUME
GRANT_REVOKE
RECONCILE
LAUNCH_CAS
```

and says some belong to “trusted coordinator”, but does not state whether those
commands are RPC-callable, which authenticated process may call them, or how the
Coordinator distinguishes an internal transition from a remote command.

### Attack/failure examples

1. A compromised control server invokes `RECONCILE` directly on arbitrary
   launch IDs.
2. A launch server invokes `GRANT_CONSUME` after an Effect signal but before
   process/Evidence proof.
3. The Runner uses `OPEN_SCENARIO` to install a target outside the approved
   `<run-root>`.
4. The Runner installs a `CLEANUP_STAGING` action over a repository directory;
   later a real test Helper is asked to remove it.
5. A Helper submits a Supervisor-shaped record because only sourceType is
   checked locally.

The design says no RPC client provides final state, but that does not by itself
prevent command-level state-machine abuse.

### Required command/actor matrix

| Command | Allowed caller | Phase | Internal only |
|---|---|---:|---:|
| `OPEN_SCENARIO` | `R5T_RUNNER` | UNOPENED/READY | no |
| `OPEN_RUN` | `R5T_RUNNER` | READY | no |
| `SNAPSHOT` | runner and registered servers | READY/RUNNING/STOPPING | no |
| `SESSION_REGISTER/ACCEPT` | `R5T_CONTROL_SERVER` | RUNNING | no |
| `GRANT_ISSUE/MATCH/RESERVE/EFFECT` | `R5T_CONTROL_SERVER` | RUNNING | no |
| `TICKET_BIND/CLAIM/REDEEM` | matching `R5T_LAUNCH_*` | RUNNING | no |
| `LAUNCH_CREATE/CAS` | matching `R5T_LAUNCH_*` | RUNNING | no |
| `HELPER_EVIDENCE` | only control server after authenticated Helper call | RUNNING | no |
| `SUPERVISOR_EVIDENCE` | `R5T_SUPERVISOR` verifier | RUNNING | no |
| `GRANT_CONSUME/REVOKE` | no RPC caller | RUNNING | yes |
| `RECONCILE` | no RPC caller | RUNNING | yes |
| `CLOSE_RUN` | `R5T_RUNNER` | STOPPING | no |

The implementation must not expose internal-only commands in
`P13TestStateInvoke` merely because it uses the same interface source file.
Preferred design:

```text
RPC command table
  contains only external actor commands

Coordinator private C++ methods
  implement consume/revoke/reconcile
```

### Fixture-root confinement

Before RUN_OPEN, the Coordinator must validate:

- target is under one pre-approved isolated NTFS run root;
- source and target use approved staging/canonical subnamespaces;
- parent is not a Repository, Desktop, home, Windows, Program Files or PFR
  path;
- for Cleanup, only staging/quarantine names are accepted;
- canonical deletion is rejected;
- expected volume serial and root FileId match the approved fixture;
- all target/source path strings are normalized and reparse/symlink checked.

The Helper must independently repeat the root and namespace validation before
any file operation. The Coordinator alone cannot prove filesystem safety.

### Impact

If implemented as written, the Coordinator can become a test-only universal
transition authority, and its pre-run fixture interface can direct real
Windows effects outside the intended fixture.

### R5-R3 / gates

```text
R5-R3:
CORRECT DESIGN BEFORE IMPLEMENTATION

R5-A:
not required if R5-A excludes the Coordinator

R5-C/D/E:
BLOCKING
```

## 8. Blocking Finding DR-03: PREPARE Has No Uncommitted Custody/Timeout State

### Current design

R5-R2 PREPARE flow at lines 1408-1435:

1. CAS Ticket `BOUND -> CLAIMED`;
2. create process/Job;
3. duplicate Handles;
4. atomically create Launch Transaction `PREPARED` and Ticket `REDEEMED`.

The Launch Authority source Job/process Handles remain alive until COMMIT/ABORT.

### Failure scenario

```text
1. PREPARE claims Ticket.
2. Creates suspended Helper and anonymous Job.
3. Transfers Handles to Supervisor.
4. Launch Transaction becomes PREPARED.
5. Supervisor crashes before COMMIT.
6. Supervisor duplicate Handle closes.
7. Launch Authority still owns the source Job Handle.
8. KILL_ON_JOB_CLOSE does not execute because a handle remains.
9. Suspended Helper may remain indefinitely.
```

R5-R2 line 1278 says “Supervisor crash -> final duplicate Handles close -> Job
last-handle kill may execute”, which is conditional and not sufficient as the
primary custody rule.

### Additional failure

If the process crashes after Handle transfer but before the Coordinator atomically
records `PREPARED/REDEEMED`, no authoritative transaction may exist. R5-R2 says
this becomes UNKNOWN, but does not specify:

- who owns the launched resources after the Launch Authority thread unwinds;
- when the source Handles are closed;
- who records UNKNOWN if the in-memory Coordinator also dies;
- how a retry distinguishes a new process from the previous unknown process.

### Required state

Create the Launch Transaction before spawning:

```text
CLAIMED
  -> PREPARING
       -> PREPARED
       -> ABORTING
       -> UNKNOWN
```

The Coordinator must commit a `PREPARING` record before process creation.
That record contains:

```text
prepareRequestDigest
launchAuthorityIdentity
supervisorIdentity
ticketId
operation/grant/generation/release
deadline
sourceHandleNonce
revision
state
```

Timeout behavior:

```text
PREPARING/PREPARED without COMMIT/ABORT by deadline
  -> Launch Authority CAS conditionally owns abort
  -> close/terminate exact source process/Job Handles
  -> wait for signaling
  -> ABORTED if proven
  -> UNKNOWN/QUARANTINED otherwise
```

Idempotency:

- same Request ID and same body returns stored result;
- same Request ID with a different body is `Conflict`;
- a different Request ID cannot claim the same Ticket/Transaction;
- only one watchdog may perform source-Handle cleanup.

Crash durability:

- R5-C mock mode may use the test Coordinator only for transaction state.
- R5-D/E real process/Handle tests require either a separately authorized
  durable test metadata store or an explicit rule that any Coordinator crash
  aborts the entire Run and external operator evidence proves all exact child
  processes terminated.
- “Preserves the transaction record” cannot be claimed for a process-local
  in-memory store.

### R5-R3 / gates

```text
R5-R3:
CORRECT TRANSACTION/CUSTODY DESIGN BEFORE IMPLEMENTATION

R5-C:
BLOCKING for Ticket-positive tests

R5-D/E:
BLOCKING
```

## 9. Blocking Finding DR-04: Launch v2 Contract Is Not Frozen

### Design requirement

R5-R2 correctly observes that `P13LaunchInvoke` has no typed output for
target-relative Handle values. This is a real contract defect.

However, D1 froze:

```text
P13_PROCESS_LAUNCH_V1
UUID B2D9E41C-34D5-4046-96B6-9E14AA9D533E
Version 1.0
one P13LaunchInvoke Manager
```

See `R4-A1-R4-D1:349-352`.

R5-R2 lines 740-778 propose:

```text
P13_PROCESS_LAUNCH_V2
same endpoint
same one Manager name
explicit transfer out parameter
```

but does not define:

- whether the UUID changes or stays with version 2.0;
- exact IDL struct size and NDR/budget;
- client/server compatibility policy;
- whether v1 remains registered;
- whether v1 and v2 both count as public Managers;
- build output revision and migration of generated stubs;
- user approval of this frozen-interface change.

### Risk

R5-R3 could implement a new interface without a binding architecture decision,
or preserve v1 and still fail to transfer Handle values. Both outcomes would
invalidate R5-D readiness.

### Required correction

Record one exact approved contract before implementation:

```text
candidate A:
same interface UUID, version 2.0, same Manager name,
new P13LaunchInvoke signature with typed transfer result

candidate B:
new interface UUID/version and deprecate v1 in the test build
```

Only one may be registered. The IDL, generated stubs, server registration,
client binding, wire budget and Build Manifest must identify the same choice.
The interface version change requires explicit user approval because it changes
the frozen D1 contract.

### R5-R3 / gates

```text
R5-R3:
CAN IMPLEMENT AUTHORITY-ONLY SCOPE ONLY AFTER R5-R3 SCOPE IS SPLIT

R5-D/E:
BLOCKING UNTIL CONTRACT APPROVED
```

## 10. Blocking Finding DR-05: R5-R3 Scope Is Still Unbounded

R5-R2 sections 20-21 use the phrase:

```text
Files likely modified/added
generated/<new-revision>/x64/*
production binaries
test-only coordinator binary
runtime test runner and test clients/helpers
```

at lines 1982-2160.

This is not an exact implementation authorization boundary.

Missing:

- exact file path list;
- exact functions/classes to add or remove;
- exact interface/UUID choices;
- exact source-revision directory;
- exact generated/object/bin/log/manifest/evidence output directories;
- exact command list permitted in Build-only;
- exact files that must remain byte-for-byte unchanged;
- whether all nine Steps are authorized in one stage.

The review requirement explicitly prohibits placing all high-risk changes into
one unbounded Build-only stage.

### Required correction

Split at least:

```text
R5-R3A — Identity / Manifest / R5-A Test Driver
R5-R3B — State Coordinator / Grant / Ticket / Launch Transaction
R5-R3C — Pinned Process / Handle Transfer / Revoke Process Path
R5-R3D — Evidence Coordinator / ACL-SEALED Test Contract
```

Each must have:

- exact allowed source list;
- exact forbidden source list;
- exact symbols and interface changes;
- exact output root, e.g. `generated/r5-r3a/x64`,
  `obj/r5-r3a/x64`, `bin/r5-r3a/x64`, `logs/r5-r3a`;
- Build-only commands;
- test-source ownership;
- expected artifact hashes;
- stop conditions;
- separate independent review.

No later sub-stage starts automatically.

### R5-R3 gate

```text
BLOCKING
```

## 11. Finding DR-06: Evidence Append/Reconcile Concurrency Is Incomplete

R5-R2 correctly removes direct `Matched` state setters and defines raw evidence
records. It does not fully define:

- uniqueness of `(runId, launchSessionId, sourceType)`;
- duplicate Evidence ID behavior;
- same idempotency key with different Evidence body;
- concurrent Helper and Supervisor Evidence append;
- reconciliation while a writer is in progress;
- retry after a stored mismatch;
- quarantine transition ownership.

Required:

```text
same Evidence ID + same digest -> idempotent
same Evidence ID + different digest -> Conflict
same sourceType twice -> Conflict unless exact retry
second source type cannot overwrite first source
reconcile requires both stored records + expected revisions
reconcile result is immutable for that revision
mismatch cannot be replayed as matched
```

This is not a new bypass in the current source, but it is needed before an
Evidence Coordinator can be called complete.

Classification:

```text
Design Correction Required
R5-R3C/D boundary
R5-E blocking if unresolved
```

## 12. Finding DR-07: R5-A Epoch Response and Replay Behavior Are Not Explicit

Current source:

- policy `AUTHORITY_EPOCH_READ` is a no-session, no-Grant read-only operation
  (`src/authority/p13_operation_policy.cpp:67-70`);
- dispatch returns `state.epoch` in `P13Response.serverEpoch`
  (`src/authority/p13_authority_service.cpp:456-460`);
- client currently sends `kStagingAuthorityId` for the probe
  (`src/client/p13_client_runtime.cpp:127-133`).

R5-R2's R5-A section says a Web test authority may make the call and it has no
business Effect, but it does not specify:

- the exact returned fields;
- whether Epoch is considered non-secret control metadata;
- that replaying the same read request returns the same read-only result and
  creates no Session;
- the replacement of the current staging-authority client default with the
  exact Web test descriptor;
- that one positive call is bounded and no general epoch polling is allowed.

This is a P3 design clarification, not a blocker by itself. It should be
included in the R5-R3A test driver and R5-A authorization text.

## 13. Finding DR-08: Initial PID-to-Process Binding Race Remains Runtime-Only

R5-R2 correctly uses:

```text
ClientPID from the current RPC call
  -> server-opened Process Handle
  -> creation time
  -> TokenUser/groups/integrity/Session
  -> held Handle
```

and explicitly leaves the initial PID-open race to R5-B.

No static Windows RPC contract in the reviewed material returns a process Handle
directly from the caller. The design can bind a held kernel object after
opening the current PID, but cannot statically prove that the OS did not reuse
the PID between call-attribute retrieval and `OpenProcess`.

This is acceptable only as an explicitly tested residual:

- R5-B must attempt PID reuse/client-exit races.
- Failure or ambiguous identity is DENY.
- A Session stores creation time and held Handle immediately.
- Subsequent calls compare the process object/creation time.
- No claim of absolute initial race elimination is allowed.

Classification:

```text
Runtime Warning
NOT a design failure if R5-B tests it
```

## 14. P2-01 TCB Review

R5-R2 keeps the Server process and Test Coordinator in test TCB and does not
pretend source visibility is an OS boundary.

It correctly states:

- remote clients cannot choose `IIdentityProvider`;
- same-process code can synthesize authorization if it is already TCB;
- exact Server hash pinning is required.

Decision:

```text
PASS WITH WARNING
```

The optional private-header hardening is appropriate but must not be described
as a security boundary against process compromise.

## 15. P2-02 Identity Review

R5-R2's fail-closed matrix covers:

- Token User/Groups/Restricted/Integrity/Session;
- Authz User/Groups/Restricted;
- buffer/size/truncation/structure;
- SID attributes;
- AccessCheck input and result.

The design is adequate for implementation, subject to the following exact test
requirements:

- `GetTokenInformation` sizing-call error handling;
- second-call returned-length equality;
- Authz query false/zero-length/malformed structure;
- SID conversion failure;
- deny-only and disabled group cases;
- Authz/process group mismatch;
- expected restricted SID in both evidence sources;
- malformed self-relative Security Descriptor;
- `AccessCheck` API failure versus access denial.

Decision:

```text
DESIGN ACCEPTABLE WITH TESTS
```

## 16. P2-04 PinnedProcessIdentity Review

Positive aspects:

- uses a server-opened process Handle;
- binds creation time and TokenUser;
- uses the exact Handle for DuplicateHandle target;
- duplicates back to verify Job/process/thread identity;
- requires non-inheritable Handles;
- failure yields UNKNOWN and no resume.

R5-R3 must also implement:

- `PROCESS_DUP_HANDLE` only on the Launch Authority's exact target process;
- process DACL test fixtures;
- re-query RPC ClientPID immediately around `OpenProcess`;
- no termination by PID;
- cleanup on partial transfer;
- close each target-relative Handle exactly once.

Decision:

```text
PASS WITH RUNTIME/PID-RACE WARNING
```

## 17. P2-05 Grant Review

The design's Grant model is sufficient only when:

- global Grant-ID uniqueness and `(operationId, generation)` uniqueness are
  both enforced at the same single Coordinator atomic operation;
- failed Ticket creation rolls back or defers the Grant record;
- the request-ID/digest idempotency result is stored with the Grant;
- a revision/CAS conflict cannot retry as a fresh issue under a new request ID.

The current process-local `TestGrantStore` cannot establish cross-process
uniqueness. R5-R2 states this correctly.

Decision:

```text
DESIGN ACCEPTABLE AFTER DR-02/DR-03 CORRECTIONS
```

## 18. P2-08 Revoke Review

The ordered transition is correct:

```text
Session revoke CAS
  -> block new calls
  -> Grant revoke
  -> Job close
  -> process wait
  -> approved terminate fallback
  -> wait signaled
  -> Handle close
  -> Evidence reconcile
  -> CLOSED/UNKNOWN/QUARANTINED
```

The design does not authorize CLOSED from Session close or any test boolean.

Remaining design correction:

- specify exact timeout values per gate;
- define one watchdog/revoke owner;
- define close/terminate retry limits;
- define process Handle close failure behavior;
- define when `QUARANTINED` becomes final;
- ensure a state-store crash cannot erase the only UNKNOWN record needed for
  recovery.

Decision:

```text
PARTIAL — BLOCKED BY DR-03/DR-05 SCOPE
```

## 19. R5-A Minimum Runtime Re-Review

R5-A must be limited to one test-only instance of the control endpoint:

```text
P13Invoke
  -> exact Web test identity
  -> AUTHORITY_EPOCH_READ
  -> P13Response.serverEpoch
  -> no Session/Grant/Ticket/Evidence mutation
```

Required before R5-A:

- P2-02 fail-closed identity implementation;
- trusted Runtime Identity Manifest per DR-01;
- exact Web identity and Session;
- minimal Client test driver;
- Build-only verification;
- separate Runtime authorization.

Not required for R5-A:

- Test Coordinator;
- RR-01 cross-process state;
- RR-02 Ticket consumption;
- P2-B5-03 Evidence;
- P2-B5-04 Handle transfer;
- P2-B5-05 Grant;
- P2-B5-08 Revoke;
- Helper/process/Job/ACL/SEALED.

Decision:

```text
R5-A SCOPE CORRECT IN CONCEPT
R5-A ENTRY BLOCKED BY DR-01 AND R5-R3 SCOPE CORRECTION
```

## 20. Required R5-R3 Boundary Correction

The current R5-R2 file list is indicative only. A future authorization must
provide exact paths and output directories, not wildcards or “likely” language.

Minimum split:

### R5-R3A — Identity, Manifest and R5-A Test Driver

Must include:

- identity typed outcomes and fail-closed parsing;
- runtime manifest loader and external authorization hash;
- exact Web test descriptor;
- one control endpoint client driver;
- Build-only output under a new revision.

Must not include:

- Grant/Ticket;
- process/Job/Handle;
- ACL/Evidence;
- Test Coordinator.

### R5-R3B — Test State Coordinator, Grant and Ticket

Must include:

- typed Coordinator RPC;
- exact command actor matrix;
- fixture-root enforcement;
- Grant/Ticket/Launch Transaction CAS;
- mock LaunchEffect adapter for R5-C;
- crash/timeout/quarantine tests.

Must not include:

- real process creation/termination;
- ACL mutation;
- production DB.

### R5-R3C — Process / Job / Handle / Revoke

Must include:

- Launch v2 approved interface;
- PinnedProcessIdentity and duplicate-back checks;
- real process/Job/Handle adapters;
- source-Handle custody and PREPARE watchdog;
- revoke process path and UNKNOWN/QUARANTINED state.

Must not include:

- ACL/SEALED;
- real business Storage;
- production service accounts without separate approval.

### R5-R3D — Evidence and ACL Test Contract

Must include:

- private Evidence Coordinator;
- append/reconcile concurrency semantics;
- isolated NTFS fixture contract;
- protected DACL/Owner Rights/AccessCheck adapters;
- SEALED/Revoke test sources;
- no real storage root.

### Required output convention

Each sub-stage needs exact paths, for example:

```text
tools/native-rpc/p13-a1-r2/generated/r5-r3a/x64
tools/native-rpc/p13-a1-r2/obj/r5-r3a/x64
tools/native-rpc/p13-a1-r2/bin/r5-r3a/x64
tools/native-rpc/p13-a1-r2/logs/r5-r3a
tools/native-rpc/p13-a1-r2/manifest/r5-r3a
```

The actual paths must be frozen in the separate authorization. The example does
not authorize their creation.

## 21. Final Finding Matrices

### 21.1 Required design checks

| Area | Design requirement | Source evidence | R5-R2 coverage | Counterexample / failure | Unresolved risk | R5-R3 | R5-A | Later gate | Final |
|---|---|---|---|---|---|---|---|---|---|
| P2-01 TCB | explicit same-process TCB | `p13_managers.cpp:9-10,38-40`; current public engine header | yes | code injection is TCB compromise | provider API remains source-visible | no functional fix required | no | all | PASS WARNING |
| P2-02 identity | fail-closed all queries | `windows_identity_adapter.cpp:84-92,251-272` | yes, sufficient concept | truncated Authz groups silently empty in current code | runtime structures must be validated | yes | blocking | B-E | PASS WITH TEST |
| P2-03 evidence | derived Matched only | `p13_launch_components.cpp:228-240`; `sealed_adapter.cpp:166-200` | partial | `RECONCILE` exposed without actor matrix | append/concurrency not fully specified | yes | no | E | CORRECTION |
| P2-04 handle | pinned object and duplicate-back | `job_lifecycle_adapter.cpp:204-242` | yes | initial PID-open race | no direct RPC process Handle | yes | no | D | PASS WARNING |
| P2-05 grant | global unique + CAS | `p13_authority_components.cpp:428-441` | yes in Coordinator | process-local Map is insufficient | depends on corrected Coordinator | yes | no | C | PASS WITH CONDITION |
| P2-06 manifest | trusted identity source | `p13_authority_components.cpp:100-181` | no trust anchor | Runner signs its own manifest hash | exact identity/session approval | yes | blocking | A-E | FAIL |
| P2-07 tests | correct classifications | `tests/b4/native_test_sources.cpp:248-302` | yes | Runtime rows remain unimplemented | test depth must be verified later | yes | A subset | all | PARTIAL |
| P2-08 revoke | complete proof chain | `p13_authority_service.cpp:467-482,606-612`; `job_lifecycle_adapter.cpp:326-351` | partial | crash can lose the only unknown record | durable custody | yes | no | D/E | PARTIAL |
| RR-01 topology | constrained Coordinator | `p13_authority_service.cpp:223-226`; `p13_server_main.cpp:14-35` | partial | arbitrary scenario/root or internal command | command actor matrix/root guard | yes | no | C-E | FAIL |
| RR-02 ticket | durable transaction and custody | `p13_operation_policy.cpp:86-93`; `p13_authority_service.cpp:195-219,681-704` | partial | PREPARED without timeout leaves Job handle | durable unknown/recovery | yes | no | C-E | FAIL |
| R5-A | exact one-read scope | `p13_operation_policy.cpp:67-70`; `p13_authority_service.cpp:456-460` | concept yes | replay/field explanation missing | epoch disclosure and one-call bound | driver | yes | no | WARNING |
| R5-R3 scope | exact bounded scope | R5-R2 lines 1982-2160 | no | all steps grouped and paths approximate | authorization scope | blocking | yes | all | FAIL |

### 21.2 Severity summary

| ID | Severity | Finding | Blocks |
|---|---|---|---|
| DR-01 | P2 Blocking | Manifest self-approval/trust anchor missing | R5-R3A, R5-A |
| DR-02 | P1 Test-only Containment | Coordinator command/root authority matrix missing | R5-R3B, C/D/E |
| DR-03 | P2 Blocking | PREPARE uncommitted custody/timeout/durability missing | R5-R3B/C, C/D/E |
| DR-04 | P2 Blocking | Launch v2 interface not frozen/approved | R5-R3C, D/E |
| DR-05 | P2 Blocking | R5-R3 scope unbounded, files/outputs not exact | all R5-R3 |
| DR-06 | P2 | Evidence append/reconcile concurrency omitted | R5-R3D, R5-E |
| DR-07 | P3 | R5-A response/replay detail incomplete | R5-R3A, R5-A |
| DR-08 | Runtime Warning | Initial PID-open race remains | R5-B |

## 22. Required Corrections Before R5-R3

1. Define a separate user-approved Runtime authorization artifact carrying the
   expected manifest hash and binary hashes.
2. Add a command-to-actor-phase matrix and remove `GRANT_CONSUME`, `GRANT_REVOKE`
   and `RECONCILE` from any remotely callable test Coordinator surface.
3. Enforce a single approved isolated NTFS run root in both Coordinator and
   Helper before any test Effect.
4. Add `PREPARING`, deadline, watchdog owner and source-Handle custody to the
   Launch Transaction.
5. State that process-local Coordinator state cannot satisfy crash recovery;
   require explicit durable metadata or a whole-Run quarantine procedure.
6. Freeze one exact Launch v2 contract, including UUID/version, IDL shape,
   wire budget and user approval.
7. Define duplicate Evidence ID/digest, concurrent append and reconciliation
   CAS rules.
8. Split R5-R3 into exact independently authorized sub-scopes with exact file,
   symbol, command and output-directory lists.
9. Add exact R5-A response/replay/one-call assertions and replace the current
   staging-authority client default with the approved Web test authority.

## 23. Unresolved / Not Verified

```text
Runtime Identity Manifest trust source:
NOT DEFINED

Test Coordinator command authorization:
NOT DEFINED AT COMMAND LEVEL

Test fixture root confinement:
DESCRIBED AS A DIRECTORY BUT NOT ENFORCED BY DESIGN

PREPARE uncommitted timeout:
NOT DEFINED

Durable Launch Transaction:
NOT AVAILABLE IN MEMORY COORDINATOR

Launch v2 UUID/version/NDR:
NOT DEFINED

Exact R5-R3 file/output scope:
NOT DEFINED

Evidence append duplicate semantics:
NOT DEFINED

R5-A Epoch information/replay behavior:
NOT EXPLICIT

Initial PID-open race:
RUNTIME TEST REQUIRED

All Windows Token/Job/ACL/Evidence behavior:
NOT EXECUTED
```

## 24. Side-Effect Declaration

No source, IDL, generated file, Build Script, test, manifest, binary, endpoint,
process, Token, Job, Handle, account, group, ACL, DACL, Owner, Service,
Registry, PFR, database, Storage or Git state was changed.

No Native RPC program was executed.

## 25. Final Decision

```text
Overall:
FAIL — DESIGN CORRECTIONS REQUIRED BEFORE R5-R3

R5-R2 Integrity:
PASS

Baseline Integrity:
PASS

P2-B5-01:
PASS WITH TCB WARNING

P2-B5-02:
DESIGN ACCEPTABLE WITH REQUIRED TESTS

P2-B5-03:
PARTIAL — COMMAND/CONCURRENCY CORRECTION REQUIRED

P2-B5-04:
PASS WITH RUNTIME/PID-RACE WARNING

P2-B5-05:
CONDITIONAL PASS — DEPENDS ON RR-01 CORRECTION

P2-B5-06:
FAIL — MANIFEST TRUST ANCHOR MISSING

P2-B5-07:
PARTIAL — CLASSIFICATION ACCEPTABLE / TESTS NOT IMPLEMENTED

P2-B5-08:
PARTIAL — REVOKE CUSTODY/DURABILITY CORRECTION REQUIRED

RR-01:
FAIL — COORDINATOR AUTHORITY MATRIX AND ROOT CONFINEMENT MISSING

RR-02:
FAIL — PREPARE TIMEOUT/CUSTODY AND DURABLE UNKNOWN PATH MISSING

R5-A:
CONCEPT CORRECT / BLOCKED BY DR-01 AND SCOPE CORRECTION

R5-R3:
NOT AUTHORIZABLE AS CURRENTLY SCOPED

R5-R3 Build-only:
NOT EXECUTED

Native RPC Runtime:
NOT EXECUTED

R5-A Authorization:
NOT GRANTED

Git Writes:
NOT EXECUTED
```

## 26. Report Integrity

A report cannot contain its own final SHA-256 without changing that hash. The
external SHA-256 is calculated after the final write and returned in the stage
completion message.
