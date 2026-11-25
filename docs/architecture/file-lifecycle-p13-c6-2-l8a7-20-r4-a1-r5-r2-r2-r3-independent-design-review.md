# P1-3 C-6.2-L8A7.20-R4-A1-R5-R2-R2-R3 Independent Design Review

## 0. Executive Result

```text
Stage:
C-6.2-L8-A7.20-R4-A1-R5-R2-R2-R3

Date:
2026-11-22

Mode:
INDEPENDENT READ-ONLY DESIGN REVIEW

Overall:
FAIL — BLOCKING DESIGN CORRECTIONS REQUIRED

Review Independence:
PASS

Input Integrity:
PASS

Baseline Integrity:
PASS

P0:
0

P1:
3

P2:
4

P3:
2

R5-R3A Authorization:
NOT READY

R5-A Authorization:
NOT GRANTED

R4-A2 Authorization:
NOT GRANTED
```

R5-R2-R2-R2 closes several previous gaps:

- the trust path is fixed rather than Runner-selected;
- Manifest, Authorization and Approval files are separate;
- C25 `BEGIN_STOP` and C26 `RESUME_RESULT` exist;
- one `terminationOwner` field and lease/generation model is proposed;
- Launch v2 now carries deadline, boot and watchdog fields;
- R5-R3A includes `CallerExpectation`, Logon SID and `SameIdentity`.

The design is still not safe enough for R5-R3A authorization because:

1. a single Trust Authority can still create, approve and revoke its own trust
   state, and no independent revocation-head anchor exists;
2. the Supervisor receives termination-capable Job/process Handles before it is
   the logical termination owner, so DB CAS/Lease cannot fence the kernel
   Handle;
3. `ResumeThread` success is treated as evidence of RUNNING without an
   authenticated Helper signal that the process actually reached user code;
4. the Launch state diagram allows `COMMITTED -> ABORT_PENDING`, while C17 does
   not.

These are design blockers. No source was changed and no Native Runtime was run.

## 1. Scope and Independence

This review independently checked:

- both R5-R2-R2-R2 deliverables;
- R5-R2-R2-R1;
- R5-R2-R2;
- R5-R2 and R5-R1;
- current Native Harness source and IDL;
- D1 v1.0;
- relevant B3/B4/B5 and R4-S5-S11 boundaries.

R5-R2-R2-R2's claimed PASS was not accepted as evidence.

## 2. Skills and Authoritative Inputs

Actually read and applied:

- `$project-architecture`
- `$project-architecture/references/architecture-review.md`
- `$security-audit`
- `$security-audit/references/adversarial-review.md`
- `$testing-and-verification`
- `$testing-and-verification/references/verification-matrix.md`
- `$file-lifecycle`
- `$file-lifecycle/references/lifecycle-review.md`
- `$prisma-db-safety`
- `$prisma-db-safety/references/database-change-review.md`

The root `AGENTS.md` was automatically loaded and applied.

## 3. Baseline and Integrity

### 3.1 Repository

```text
Repository:
D:\thinkbook\Desktop\jieya

Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

Tracked modified:
26

Untracked before this review:
240

Staged:
0

Deleted:
0
```

### 3.2 Input documents

| Input | Expected | Actual | Result |
|---|---|---|---|
| R5-R2-R2-R2 main | `8D331A70ECCC8BB107D2AAF63BCC4DAE49287DC87C3112C344787C74C64B2FAB` | same | PASS |
| R5-R2-R2-R2 decisions | `ACEBBB98A0ED474BC9CF03A75D19059B6B2A4BBD90591526693D0EA4A0CB8F61` | same | PASS |
| R5-R2-R2-R1 | `A87643A1392E92A4FD5E0B61DBA922D0299F3DF444E5890C4A4104FAC7338860` | same | PASS |
| R5-R2-R2 | `B04DD932A40C1E02058DB7932B2A97C941421F4D3F7628255DF8FFC2B564FA0E` | same | PASS |

### 3.3 B1/B4

B1:

```text
Server:   A1169E2F6882BE5CA6F7D18C435DDA77E0F78A15467DE3C3A3271ABE241E38A5
Client:   C86BE3839F414A8CE95DFC4312878EA598BE1FEC4A53AE254E943573897B4C6A
Manifest: DC164B09C1D16C7CAEB46B3785CA3806C703300C2535A39B471F7D08039FE2FF
Static:   D10DE78D2B1736542AB3B4879ADABEA11A216CFEE6E535012A61D71F7218251D
```

B4:

| Artifact | Length | SHA-256 | Result |
|---|---:|---|---|
| Server | 465920 | `324D1C06BB5452FCE982119E3985AE5AB5B5A41A2D06013A709ECCD2266EEFB3` | MATCH |
| Client | 194560 | `D7BFF66F519B3B3544D8D0CC3858567B1B4CE64BCEFC1C5DFB7DFFEC6BEBCD49` | MATCH |
| Tests | 591872 | `AA2636BE8B53E26E79131E2C17FC863A6792D99976C01ED3A76EA7B5AF7EF3FA` | MATCH |
| Manifest | 12447 | `58ED3EAFF2498AFA44D4E1D92FD2CA43DD86CBA57E5E7B93B4B97204E8B79774` | MATCH |
| Static | 21623 | `DEDA51B673CFA57CC653F02112C5C1322686F9B01424A80E69E6D5BEC4EB362E` | MATCH |

### 3.4 Protected objects and PFR

The six protected hashes match:

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

PFR:

```text
46 strings
23 DELETE
SHA-256:
0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC
```

`$null` and `$null)` are absent. No `p13_native*` process is running.

## 4. Final Finding Summary

| ID | Severity | Finding | Blocks R5-R3A? |
|---|---|---|---|
| R3-P1-01 | P1 | Trust Authority can both author and approve trust state; no independent revocation head | YES |
| R3-P1-02 | P1 | Supervisor holds termination-capable Handles before becoming termination owner | no, blocks R5-D/E |
| R3-P1-03 | P1 | ResumeThread return is treated as evidence that Helper is running | no, blocks R5-D/E |
| R3-P2-01 | P2 | C17 cannot perform state-diagram `COMMITTED -> ABORT_PENDING` | no, blocks R5-D/E |
| R3-P2-02 | P2 | R5-R3A exact symbol/target text remains partly generic | YES |
| R3-P2-03 | P2 | Test Coordinator is still unformed/unnamed as a test-only RPC Manager | no, blocks R5-R3B |
| R3-P2-04 | P2 | NDR budget is a conservative estimate, not a component-exact design proof | no, Build-only gate |
| R3-P3-01 | P3 | x86 layout is described but intentionally unsupported | no |
| R3-P3-02 | P3 | some state/evidence conditions remain prose rather than machine-checkable predicates | no |

## 5. Manifest Trust Root Review

### 5.1 Required trust chain

The design requires:

```text
Manifest
  -> Runtime Authorization
  -> Approval Record
  -> Revocation Baseline
  -> Trust Authority
```

### 5.2 Fixed path

R5-R2-R2-R2 fixes:

```text
C:\ProgramData\P13\R5\Trust\v1
```

and explicitly forbids CLI/environment/request redirection.

This closes the previous “Runner selects an arbitrary trust file” issue at
design level, provided:

- the path is a compiled constant;
- no environment expansion is used;
- the server opens it by fixed absolute path;
- parent/root handles and File IDs are validated;
- it rejects reparse points and wrong owners/ACLs;
- trust files are read from the verified root Handle.

### 5.3 Role separation remains incomplete

R5-R2-R2-R2 lines 232-258 define one:

```text
P13 R5 Test Trust Authority
```

with create/write/append permission. It is also the component that writes:

- Manifest;
- Runtime Authorization;
- Approval Record;
- Revocation Baseline.

The user is said to approve externally, but the implementation only reads the
Approval Record written under the same Trust Authority root. No independent
Approval Authority, signature, or user-controlled hash root is machine-verified.

Counterexample:

```text
Trust Authority writes malicious manifest
Trust Authority computes its digest
Trust Authority writes matching authorization and approval record
Runtime accepts all three
```

The fixed path prevents Runner redirection, but not self-approval by the single
authoring role.

### 5.4 Revocation head is not independently anchored

`current\revocation-baseline.json` is inside the same trust root as the history.
The previous digest links history entries, but the latest trusted head is still
the same mutable pointer under the same Trust Authority.

Counterexample:

```text
replace history/revocation-00000010.json and prior history with an older
internally valid chain
replace current/revocation-baseline.json with that older head
all internal hashes and previous hashes match
runtime has no independent expected head and accepts rollback
```

The current design does not specify a separate monotonic anchor such as:

- user-approved fixed latest-head digest;
- a separately protected append-only registry value;
- a signed latest-head statement;
- a TPM/hardware or equivalent monotonic counter.

The Trust Authority ACL alone is not enough for rollback detection if that
authority is compromised or restored from backup.

### 5.5 Required correction

Add explicit, separate roles and anchor:

```text
Manifest Writer
Runtime Authorization Issuer
Independent Approval Authority
Revocation Authority
Runtime Verifier
```

At least one of:

```text
user-provided fixed head digest
independently signed head
protected monotonic counter
```

must bind the current revocation head. The head must be checked independently of
the replaceable baseline file. The runtime must fail closed when the head is
missing or cannot be established.

### 5.6 Result

```text
Manifest fixed path:
PASS AT DESIGN

Trust role separation:
FAIL

Revocation rollback protection:
FAIL

R5-R3A:
BLOCKING
```

## 6. C01-C26 Coordinator Review

### 6.1 Complete matrix

Common checks are accepted if each command binds:

```text
Run ID, Authorization ID/Generation, caller SID/PID/creation time,
authority ID, phase, Session, Epoch, Operation, Generation, Object,
Root, Request ID, body digest, expected Revision, transaction/nonce,
and immutable audit evidence.
```

| ID | Independent result | Issue |
|---|---|---|
| C01 | PASS AT DESIGN | scenario remains limited to pre-run approved root |
| C02 | PASS AT DESIGN | one-way READY -> RUNNING |
| C03 | WARNING | “registered server” must resolve to exact per-server SIDs |
| C04 | WARNING | Control Server forwards original caller evidence; trust assumption must be explicit |
| C05 | PASS AT DESIGN | exact active Session/process/replay binding |
| C06 | PASS AT DESIGN | Grant/Ticket issue atomically bounded |
| C07 | PASS AT DESIGN | read-only match |
| C08 | PASS AT DESIGN | one-winner reserve |
| C09 | PASS AT DESIGN | effect report bound to Helper/session/Grant |
| C10 | WARNING | Launch Authority forwards Supervisor identity; verify source evidence |
| C11 | PASS AT DESIGN | BOUND -> CLAIMED + PREPARING |
| C12 | PASS AT DESIGN | PREPARING -> PREPARED + Ticket REDEEMED |
| C13 | PARTIAL | termination owner/watchdog instance not explicit enough |
| C14 | PARTIAL | “observer” can request UNKNOWN; exact caller set must be fixed |
| C15 | PASS AT DESIGN | COMMIT CAS |
| C16 | PASS AT DESIGN | source Handle close proof |
| C17 | FAIL | state diagram permits COMMITTED abort; matrix only PREPARING/PREPARED |
| C18 | PARTIAL | termination owner/watchdog proof |
| C19 | PASS AT DESIGN | immutable Launch Evidence |
| C20 | PASS AT DESIGN | Helper Evidence direct and source-bound |
| C21 | PASS AT DESIGN | Supervisor Evidence direct and source-bound |
| C22 | WARNING | dual caller paths need per-Session-class rule |
| C23 | PASS AT DESIGN | proof-gated revoke completion |
| C24 | PASS AT DESIGN | STOPPING-only close |
| C25 | PASS AT DESIGN | unique RUNNING -> STOPPING transition |
| C26 | PARTIAL | result evidence does not prove actual execution; see R3-P1-03 |

### 6.2 C25 BEGIN_STOP

Accepted:

- exact Runner SID;
- RUNNING only;
- CAS/Run Revision;
- one-way STOPPING;
- no RUNNING return;
- idempotency for same Request ID/body;
- stale generation denial;
- blocks new test mutations.

Required additional assertion:

- only one stop-initiation effect is recorded;
- `CLOSE_RUN` cannot be invoked until child shutdown plan reaches STOPPING;
- old BEGIN_STOP retries cannot reopen the run.

No blocking issue here after these explicit conditions.

### 6.3 C24 CLOSE_RUN

Accepted:

- STOPPING only;
- CLOSED only after child/Handle/Evidence/precondition verification;
- QUARANTINED otherwise;
- repeated close idempotency and stale revision.

The design correctly forbids `CLOSE_RUN` from replacing `BEGIN_STOP`.

### 6.4 C26 RESUME_RESULT

Current design answers:

- Supervisor only;
- binds transaction/generation/revision/nonce;
- rejects Runner/Helper/other SID;
- records ResumeThread result;
- idempotent response.

But it still treats:

```text
ResumeThread API success
```

as sufficient for:

```text
RUNNING
```

It does not require an authenticated Helper RPC/heartbeat or registration that
proves the Helper process reached user code under the expected Token/process
identity.

### 6.5 RPC surface

Current production IDL still exposes only:

```text
P13Invoke
P13LaunchInvoke
```

No Test Coordinator method currently exists in IDL or server code. The test-only
Coordinator design must explicitly preserve that distinction in R5-R3B.

## 7. Launch Transaction and Termination Ownership

### 7.1 Strong parts

R5-R2-R2-R2 introduces:

- phase-scoped `terminationOwner`;
- Lease Token;
- Watchdog Generation;
- Transaction Revision;
- CAS.

This is the correct model at metadata level.

### 7.2 Blocking issue: OS Handle grants defeat lease fencing

The current Handle transfer implementation grants the target Supervisor:

```text
Job:
JOB_OBJECT_QUERY | JOB_OBJECT_TERMINATE | JOB_OBJECT_SET_ATTRIBUTES

Process:
PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE | PROCESS_TERMINATE

Thread:
THREAD_SUSPEND_RESUME | THREAD_QUERY_INFORMATION
```

Source: `src/lifecycle/job_lifecycle_adapter.cpp:214-227`.

R5-R2-R2-R2 assigns termination ownership logically to Launch Authority before
COMMITTED, but does not remove those Supervisor rights at Prepare. A Supervisor
that has not won the metadata CAS still has OS rights to call
`TerminateProcess` or `TerminateJobObject`.

Database CAS cannot revoke a Windows Handle. Therefore the claim “only one
termination owner” is not true at the kernel side-effect boundary.

### 7.3 Required correction

Choose and record one OS-enforced scheme:

#### Preferred

```text
Prepare:
  Supervisor receives process/Job query/synchronize handles only,
  no PROCESS_TERMINATE or JOB_OBJECT_TERMINATE

COMMIT handoff:
  source owner relinquishes kill authority
  one termination-capable Handle is transferred to the new owner
  close/verify old owner Handle before activation
```

If Windows cannot atomically transfer Handle rights without overlapping
termination authority, use:

```text
Single Termination Executor
```

which is the only process with terminate-capable Handles. LA/Supervisor submit
requests plus transaction/owner/generation; the executor verifies the CAS
before calling TerminateProcess.

This executor becomes a new TCB and requires separate review.

### 7.4 Competition cases

| Case | Current result | Missing proof |
|---|---|---|
| LA watchdog first pre-COMMIT | LA owner | Supervisor still has PROCESS_TERMINATE |
| Supervisor watchdog first pre-COMMIT | says “close only” | cannot enforce with current Handle rights |
| simultaneous pre-COMMIT | CAS selects LA | Supervisor OS termination remains possible |
| both timeout post-COMMIT | Supervisor owner | LA source Handles should be closed, but must verify |
| lease expires while owner runs | stale owner may close | old owner still owns term Handle |
| old generation after update | metadata DENY | OS can still terminate |
| Supervisor crash pre-COMMIT | duplicate closes | LA source remains; safe |
| LA crash pre-COMMIT | source closes | Supervisor has terminate rights but is not designated owner |
| both crash | OS closes | process result may be UNKNOWN |
| process exited/no evidence | UNKNOWN | no CLOSED |

### 7.5 Result

```text
Logical Termination Owner:
DESIGN PRESENT

OS-level Single Termination Ownership:
NOT PROVEN

R5-R3A:
not directly dependent

R5-D/E:
BLOCKING
```

## 8. COMMITTED and RESUME State Machine

### 8.1 Diagram

The intended states are:

```text
PREPARING
  -> PREPARED
  -> COMMIT_PENDING
  -> COMMITTED
  -> RUNNING
```

`COMMITTED` is not equal to `RUNNING`.

### 8.2 Resume evidence gap

`ResumeThread` returning a suspend count is an API result, not proof that the
primary thread executed user code or that the Helper registered successfully.

Current transition:

```text
RESUME_SUCCEEDED -> RUNNING
```

is therefore too strong.

Required:

```text
COMMITTED
  -> RESUME_DISPATCHED: ResumeThread returned non-error
  -> RUNNING: authenticated Helper RPC/heartbeat verifies expected
              Transaction/Grant/Session/Process identity after resume
  -> RECONCILING: process signaled before authenticated Helper evidence
  -> UNKNOWN: API or evidence outcome unclear
```

The Helper registration/heartbeat must be from the exact Helper process and
Grant audience, not a Supervisor-provided boolean.

### 8.3 Missing COMMITTED abort

The state diagram permits:

```text
COMMITTED -> ABORT_PENDING: abort before resume
```

but C17 at line 607 only allows:

```text
PREPARING/PREPARED -> ABORT_PENDING
```

No command can perform the diagram’s COMMITTED-before-resume abort path.

Required:

- C17 explicitly allow COMMITTED -> ABORT_PENDING only before Resume dispatch;
- if Resume dispatch occurred, require C26/RECONCILING path instead.

### 8.4 Result

```text
COMMITTED/RUNNING separation:
PARTIAL

RESUME API vs ACTUAL RUNNING:
NOT CLOSED

COMMITTED ABORT PATH:
INCONSISTENT
```

## 9. Launch v2 and 256-byte Structure

### 9.1 Independent layout

The declared x64 structure is:

| Offset | Field | Size | End |
|---:|---|---:|---:|
| 0 | resultPresent | 4 | 4 |
| 4 | contractVersion | 4 | 8 |
| 8 | transferId | 16 | 24 |
| 24 | launchSessionId | 16 | 40 |
| 40 | operationId | 16 | 56 |
| 56 | grantId | 16 | 72 |
| 72 | generation | 8 | 80 |
| 80 | transactionRevision | 8 | 88 |
| 88 | supervisorPid | 4 | 92 |
| 92 | helperPid | 4 | 96 |
| 96 | supervisorCreationTime | 8 | 104 |
| 104 | helperCreationTime | 8 | 112 |
| 112 | jobHandleValue | 8 | 120 |
| 120 | processHandleValue | 8 | 128 |
| 128 | threadHandleValue | 8 | 136 |
| 136 | transferNonce | 16 | 152 |
| 152 | transactionState | 4 | 156 |
| 156 | terminationOwner | 4 | 160 |
| 160 | deadlineUtc | 8 | 168 |
| 168 | bootEpochId | 16 | 184 |
| 184 | coordinatorEpochId | 16 | 200 |
| 200 | watchdogGeneration | 8 | 208 |
| 208 | watchdogLeaseExpiresAtUtc | 8 | 216 |
| 216 | deadlineMonotonicMs | 8 | 224 |
| 224 | transferDigest | 32 | 256 |

The x64 C memory layout is 256 bytes under packing 8. This arithmetic is valid.

### 9.2 Boot and deadline

Positive:

- boot epoch identifies one host boot;
- monotonic deadline is not user-wall-clock controlled;
- lease and generation are present;
- owner and transaction state are present.

Residual:

- boot epoch source is not yet implemented;
- monotonic tick must be sampled consistently at Coordinator and process
  owners;
- overflow/frequency checks remain Build-only;
- cross-boot messages must be rejected.

### 9.3 NDR budget

The report computes:

```text
Lifetime request + response estimate: 21592
MaxRpcSize:                           24576
```

This arithmetic is below the ceiling, but remains a `DESIGN ESTIMATE`. It is not
NDR wire size. Exact conformant-array, pointer/referent and alignment overhead
must be generated in Build-only.

### 9.4 v1 compatibility

Same UUID, Version 2.0 is an incompatible ABI change. The design correctly says
that user approval is required and that v1/v2 are never registered together.

This review does not approve the exception.

## 10. NTFS Dual Isolation

The design remains acceptable:

- fixed approved root identity;
- Coordinator and Helper independently open root;
- handle-relative traversal;
- reject reparse/Junction/Symlink/Mount Point;
- reject path aliases and ADS;
- verify FileId/volume/parent;
- hard-link and LinkCount checks;
- revalidate after open;
- fail closed if root identity cannot be proven.

Status:

```text
Design:
ACCEPTED

Implementation:
NOT PRESENT

Runtime:
NOT VERIFIED

R5-R3A:
not implemented
```

## 11. R5-R3A Exact Scope

### 11.1 Correctly added

The corrected scope includes:

- `include/common/p13_types.h`
- `CallerExpectation`
- Logon SID fields
- `SameIdentity`
- `p13_authority_service.cpp`
- `p13_launch_components.cpp`
- positive EPOCH contract test

This closes the previous source-symbol omission at high level.

### 11.2 Remaining precision issues

1. “SID-helper declarations” and “new binary SID-set helpers” are not exact
   function names.
2. Build outputs use `<source-basename>.obj`; it is a deterministic naming rule
   but not a literal per-file object list.
3. The positive EPOCH test source is named, but its exact test functions and
   assertions are not enumerated.
4. `src/server/p13_managers.cpp` is in scope, but the exact authorization
   wrapper/factory change is not named.
5. `ClientRuntimeConfiguration` behavior for trust path and role is not shown
   as exact fields.

These are not as severe as the previous missing-file defect, but the user’s
authorization rule requires exact symbols and output.

### 11.3 Static checks that can proceed without Runtime

The plan correctly includes:

- no Test Coordinator or Launch v2 symbols;
- no placeholder SIDs;
- no `{0,1,2}` authoritative Session;
- fixed trust path;
- no CLI trust-root override;
- `CallerExpectation` Logon fields;
- `SameIdentity` Authz/restricted/Logon comparison;
- no executed EXE;
- B1/B4/PFR/protected unchanged.

### 11.4 Result

```text
R5-R3A conceptual scope:
CLOSED

R5-R3A exact authorization text:
PARTIAL

R5-R3A authorization:
BLOCKED BY TRUST ROOT AND EXACTNESS
```

## 12. D1 Freeze Exception

The design correctly separates:

```text
D1 v1.0 frozen
P13_PROCESS_LAUNCH_V2 proposal
```

Version 2.0 changes the Manager ABI by adding a required out parameter. The same
UUID does not make it compatible.

Required user approval:

- interface UUID/version;
- new signature;
- 256-byte x64 result;
- NDR/wire budget;
- v1 rejection;
- v2-only registration;
- build/test revision;
- rollback plan.

Status:

```text
Design Freeze Exception:
NOT APPROVED

R5-R3A:
not affected

R5-R3C/D/E:
BLOCKED UNTIL APPROVAL
```

## 13. Historical Finding Closure Map

| Previous finding | R5-R2-R2-R2 response | Independent result | Remaining issue |
|---|---|---|---|
| Manifest Trust Root | fixed path and separated files | FAIL | one Trust Authority self-approves; no independent revocation head |
| Coordinator STOP/RUNNING | C25/C26 added | PARTIAL | C17 lacks COMMITTED abort; Resume result not enough |
| NTFS dual isolation | still specified | PASS AT DESIGN | implementation/runtime absent |
| Termination ownership | single Owner/Lease/Generation | FAIL | existing terminate-capable Handles bypass metadata ownership |
| Launch v2 | 256-byte typed result | PARTIAL | Boot/deadline fields added; NDR/Build and OS handle contract need work |
| R5-R3A exact scope | files/symbols expanded | PARTIAL | some exact symbols/outputs still generic |
| D1 v1.0 exception | separated | PASS AT DESIGN | user approval absent; no implementation |

## 14. Findings Detail

### R3-P1-01 — Trust Authority self-approval / no independent revocation head

Evidence:

- R5-R2-R2-R2 lines 232-258: one Trust Authority writes the trust tree.
- Lines 348-380: same flow writes Manifest, Authorization, Approval Record and
  Revocation Baseline.
- Lines 330-346: the current head is inside the same root/history.
- Lines 404-416: only parsing/hash mismatch is fail-closed; there is no outside
  head comparison.

Impact:

- a compromised/restored Trust Authority can construct a self-consistent old or
  malicious snapshot;
- the Runner cannot alter the fixed root, but the authoring role can.

Required fix:

- separate Manifest/Issuer/Approval/Revocation roles at ACL and approval level;
- user-controlled or independently signed current revocation head;
- external expected head/digest checked before accepting the chain;
- rollback, deletion, backup restore and first-root provisioning rules.

Blocks R5-R3A: yes.

### R3-P1-02 — Supervisor retains termination rights before owner handoff

Evidence:

- current `TransferHandlesToSupervisor` duplicates
  `JOB_OBJECT_TERMINATE` and `PROCESS_TERMINATE` to Supervisor at
  `src/lifecycle/job_lifecycle_adapter.cpp:214-227`;
- R5-R2-R2-R2 says Supervisor is not termination owner before COMMITTED, but
  does not revoke/withhold those kernel rights;
- metadata CAS/Lease cannot revoke an already duplicated Handle.

Impact:

- Supervisor can terminate before it wins `terminationOwner`;
- two processes can have termination authority;
- old generation/lease rules do not provide OS fencing.

Required fix:

- Prepare only transfers non-terminating query/sync Handles;
- perform a separate termination-authority transfer after COMMITTED;
- close/verify the old owner’s termination Handle before enabling the new one;
- or designate a single termination executor as the only holder.

Blocks R5-D/E: yes; not R5-R3A.

### R3-P1-03 — Resume API success is not proof of RUNNING

Evidence:

- C26 transitions `COMMITTED -> RUNNING` on `RESUME_SUCCEEDED`;
- `ResumeThread` return only reports the previous suspend count, not execution
  of user-mode Helper code;
- no authenticated Helper heartbeat/register is required.

Impact:

- Supervisor can report success while the Helper never reaches user code or
  exits immediately;
- RUNNING state may be false;
- revoke/evidence policy may classify an unstarted process incorrectly.

Required fix:

- C26 records `RESUME_DISPATCHED` or equivalent;
- RUNNING requires authenticated Helper heartbeat bound to transaction,
  Grant/session, process ID/creation time and nonce;
- process signaled before that -> RECONCILING/UNKNOWN.

Blocks R5-D/E: yes; not R5-R3A.

### R3-P2-01 — COMMITTED abort path is absent from C17

Evidence:

- state diagram line 630 permits `COMMITTED -> ABORT_PENDING`;
- command matrix line 607 allows only `PREPARING/PREPARED`.

Impact:

- abort before resume has no legal command;
- implementer may add ad-hoc transition or leave process suspended.

Required fix:

- explicitly allow C17 from COMMITTED until Resume dispatch;
- after Resume dispatch use the applicable resume/reconcile path.

### R3-P2-02 — R5-R3A exactness remains partial

Evidence:

- `SID-helper declarations` and `new binary SID-set helpers` are not literal
  function names;
- `<source-basename>.obj` is a naming rule rather than a literal output table;
- positive test function names are not enumerated.

Impact:

- Build-only source authorization still requires interpretation.

Required fix:

List each exact function and each exact object path, not only its naming rule.

### R3-P2-03 — Test Coordinator Manager contract absent

R5-R2-R2-R2 says test-only Coordinator commands but does not name the exact
interface UUID, version, Manager method or generated stub in this correction.

Current source correctly has no such RPC surface, so this is not a present
production issue.

R5-R3B must freeze:

```text
test-only interface UUID/version
one Manager method
generated stub names
static check that production binaries do not link it
```

### R3-P2-04 — NDR Budget remains an estimate

The arithmetic `21592 < 24576` is conservative and useful. It is not an NDR
width calculation. The fixed structure has no variable arrays beyond the
existing request payload, but NDR pointer/referent and alignment overhead must
be measured in Build-only.

## 15. Baseline and Non-verification

PASS at start and end:

- Branch `feature/p1-3-storage-lifecycle-schema`;
- HEAD `b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`;
- B1/B4 hashes unchanged;
- PFR unchanged;
- six protected objects unchanged;
- no `p13_native*` process.

Not verified:

- actual Manifest/Trust Authority creation;
- ACL/reparse behavior of the fixed root;
- revocation head against rollback;
- Coordinator RPC IDL and implementation;
- Launch v2 IDL/generated structures;
- exact NDR sizes;
- Windows Token/Job/Handle/ACL behavior;
- actual `ResumeThread`/Helper heartbeat behavior;
- all Runtime tests.

## 16. Required Corrections Before Any PASS Recommendation

1. Separate Manifest Writer, Authorization Issuer, Approval Authority,
   Revocation Authority and Runtime Verifier into explicit roles.
2. Add an independent trusted latest revocation-head anchor.
3. Replace Supervisor’s pre-COMMIT terminate-capable Handles with query/sync
   Handles, or introduce one termination executor.
4. Make `COMMITTED -> ABORT_PENDING` legal in C17 only before Resume dispatch.
5. Change C26 to record Resume dispatch, then require authenticated Helper
   evidence before RUNNING.
6. Replace generic R5-R3A file symbols and object naming rules with literal
   lists.
7. Freeze the Test Coordinator interface identity in R5-R3B.
8. Keep NDR size as BUILD VERIFICATION REQUIRED.
9. Preserve D1 v2 as an unapproved exception.

## 17. Final Decision

```text
Overall:
FAIL — BLOCKING DESIGN CORRECTIONS REQUIRED

Review Independence:
PASS

R5-R2-R2-R2 Integrity:
PASS — BOTH HASHES MATCH

Baseline Integrity:
PASS

Manifest Trust Root:
PARTIAL — FIXED PATH YES / ROLE SEPARATION AND REVOCATION HEAD NO

Coordinator C01-C26:
PARTIAL — C25 IMPLEMENTED / C26 RUNNING PROOF / C17 COMMITTED ABORT GAP

NTFS Dual Isolation:
DESIGN ACCEPTED / NOT IMPLEMENTED / NOT RUNTIME VERIFIED

Single Termination Authority:
FAIL — METADATA OWNER DOES NOT REMOVE OS TERMINATION RIGHTS

COMMITTED / RESUME_RESULT:
PARTIAL — RESUME API IS NOT RUNNING PROOF

Launch v2 Layout:
256 BYTES AT DESIGN ESTIMATE / NDR NOT EXECUTED

D1 Freeze Exception:
NOT APPROVED

R5-R3A Exact Scope:
PARTIAL

R5-R3A Authorization:
NOT READY

R5-A:
NOT AUTHORIZED

R5-R3B/C/D:
NOT AUTHORIZED

Native RPC Build:
NOT EXECUTED

Native RPC Runtime:
NOT EXECUTED

Git Writes:
NOT EXECUTED
```

## 18. Side-Effect Declaration

No source, IDL, Header, test, Build Script, existing design, build artifact,
endpoint, process, Token, Job, Handle, account, group, ACL, DACL, Owner,
identity, Session, Service, Registry, PFR, database, Storage or Git state was
changed.

## 19. Report Integrity

This report cannot contain its own final SHA-256 without changing its content.
The external SHA-256 is calculated after the final write and returned in the
stage completion message.
