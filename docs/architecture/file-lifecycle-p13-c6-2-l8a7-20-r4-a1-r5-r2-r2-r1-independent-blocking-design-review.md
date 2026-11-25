# P1-3 C-6.2-L8-A7.20-R4-A1-R5-R2-R2-R1 Independent Blocking Design Review

## 0. Executive Result

```text
Stage:
C-6.2-L8-A7.20-R4-A1-R5-R2-R2-R1

Date:
2026-11-22

Mode:
INDEPENDENT READ-ONLY DESIGN REVIEW

Overall:
FAIL — BLOCKING DESIGN CORRECTIONS REQUIRED

R5-R2-R2 Report Integrity:
PASS — SHA-256 MATCH

R5-R2-R1 Report Integrity:
PASS — SHA-256 MATCH

Baseline Integrity:
PASS

Source / Build / Runtime Changes:
NONE

P0:
0

Blocking Design Findings:
4

Warnings:
4

R5-R3A Authorization:
NOT READY

R5-A Authorization:
NOT GRANTED
```

R5-R2-R2 substantially improves the previous design. The following parts are
acceptable at design level:

- Coordinator C01-C23 command ownership mostly follows actor/phase/object
  boundaries;
- derived final operations are internal-only by design;
- Coordinator and Helper independently validate the test root;
- PREPARE creates a transaction before process creation;
- Ticket, transaction, request digest and revision are separated;
- Grant/Ticket uniqueness is assigned to one test state authority;
- Launch v2 uses a typed result rather than `P13Response.message`;
- R5-R3 is reduced to R5-R3A.

Four blocking gaps remain:

1. Runtime Authorization can still be selected by the Test Runner, and no
   independent current-revocation anchor is defined.
2. Launch state lacks an authoritative transition from COMMITTED to RUNNING and
   a separate RUNNING to STOPPING command.
3. The dual watchdog design does not name one atomic Termination Authority; the
   v2 transfer result also lacks the deadline/boot/watchdog generation that the
   design says the Supervisor uses after Coordinator loss.
4. R5-R3A is not exact enough and omits required identity/session symbols,
   notably `CallerExpectation` and `SameIdentity`.

These are design blockers. No current source file was changed and no Native RPC
was executed.

## 1. Scope and Independence

This review treats R5-R2-R2 as a set of claims. It re-checked:

- current IDL and Server Manager exports;
- current Session/Grant/Ticket/Launch state stores;
- current identity adapter and descriptor source;
- R5-R1, R5-R2, R5-R2-R1 and R5-R2-R2;
- D1's frozen v1.0 interface;
- B3/B4/B5 and applicable R4-S5-S11 constraints.

No existing source, report, IDL, script, test, binary, ACL or system state was
modified.

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

Untracked before this report:
237

Staged:
0

Deleted:
0
```

### 3.2 Required report hashes

| Report | Expected | Actual | Result |
|---|---|---|---|
| R5-R2-R2 | `B04DD932A40C1E02058DB7932B2A97C941421F4D3F7628255DF8FFC2B564FA0E` | `B04DD932A40C1E02058DB7932B2A97C941421F4D3F7628255DF8FFC2B564FA0E` | PASS |
| R5-R2-R1 | `575FCF2037C15A8F1C10A290787430156B49DC480910F4B20F4E379CEF9D7B93` | `575FCF2037C15A8F1C10A290787430156B49DC480910F4B20F4E379CEF9D7B93` | PASS |

### 3.3 B1/B4 artifacts

B1:

```text
Server:  A1169E2F6882BE5CA6F7D18C435DDA77E0F78A15467DE3C3A3271ABE241E38A5
Client:  C86BE3839F414A8CE95DFC4312878EA598BE1FEC4A53AE254E943573897B4C6A
Manifest: DC164B09C1D16C7CAEB46B3785CA3806C703300C2535A39B471F7D08039FE2FF
Static:  D10DE78D2B1736542AB3B4879ADABEA11A216CFEE6E535012A61D71F7218251D
```

B4:

| Artifact | Length | SHA-256 | Result |
|---|---:|---|---|
| Server | 465920 | `324D1C06BB5452FCE982119E3985AE5AB5B5A41A2D06013A709ECCD2266EEFB3` | MATCH |
| Client | 194560 | `D7BFF66F519B3B3544D8D0CC3858567B1B4CE64BCEFC1C5DFB7DFFEC6BEBCD49` | MATCH |
| Tests | 591872 | `AA2636BE8B53E26E79131E2C17FC863A6792D99976C01ED3A76EA7B5AF7EF3FA` | MATCH |
| Manifest | 12447 | `58ED3EAFF2498AFA44D4E1D92FD2CA43DD86CBA57E5E7B93B4B97204E8B79774` | MATCH |
| Static Verification | 21623 | `DEDA51B673CFA57CC653F02112C5C1322686F9B01424A80E69E6D5BEC4EB362E` | MATCH |

### 3.4 Protected files and PFR

| Object | SHA-256 | Result |
|---|---|---|
| FZ | `E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705` | MATCH |
| ST | `5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586` | MATCH |
| DBTP | `FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7` | MATCH |
| Prisma Schema | `78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299` | MATCH |
| `next-env.d.ts` | `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC` | MATCH |
| `tsconfig.tsbuildinfo` | `21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520` | MATCH |

PFR:

```text
46 strings
23 DELETE
SHA-256:
0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC
```

`$null` and `$null)` are absent. No `p13_native*` process is running.

## 4. Original Five Blockers: Independent Result

| Original blocker | R5-R2-R2 correction | Independent result | Reason |
|---|---|---|---|
| Manifest Trust Root | user hash + protected authorization/version baseline | FAIL | authorization path selection and current revocation baseline remain undefined |
| Coordinator Authority/Confinement | C01-C24 + internal-only methods + dual root checks | PARTIAL | C01-C23 mostly closed; run stop and resume transitions incomplete |
| Launch PREPARE Custody/Recovery | PREPARING record + dual watchdog | FAIL | no single termination-authority lease; no resume outcome; v2 lacks carried deadline |
| Launch v2 Contract | same UUID/version 2.0/typed result | PARTIAL | typed result is good; watchdog fields and D1 approval remain unresolved |
| R5-R3 exact scope | reduced to R5-R3A | FAIL | missing exact source/symbol entries and several output/build cells are not precise |

NTFS dual enforcement is separately assessed as design-acceptable for a future
R5-R3B, but no source exists yet.

## 5. Finding M-DR-01: Manifest Trust Selection Still Has a Runner Path

### Evidence

R5-R2-R2 lines 297-302 say:

```text
Runtime command
  -> receives expected authorization SHA-256 from user approval
  -> reads authorization from protected directory
```

Lines 305-317 say the directory is not writable by the Runner and that the
Runner remains test TCB.

They do not define:

- the exact protected directory;
- who chooses that directory;
- whether the path is fixed or command-line selectable;
- how the server proves the path is the approved one;
- what immutable artifact stores the current revocation generation.

### Counterexample

```text
Runner places a self-authored authorization in another readable directory
Runner passes that path and its matching SHA-256
Server reads a "protected directory" path supplied by the Runner
Server verifies only that file against the hash supplied by the Runner
Result: self-consistent authorization, not user-approved authorization
```

Read-only ACL on a directory does not help if the Runner can choose a different
directory/file.

### Revocation issue

`revocationGeneration` is inside each Runtime Authorization. The design says old
generations are refused, but it does not define a trusted current-generation
source. Without a separate revocation baseline:

```text
old valid authorization + internally matching old generation
  -> server can continue to accept it until expiry
```

### Required correction

1. Freeze the exact protected authorization root and path-discovery rule.
2. The path must not be freely selected by the Runner.
3. Bind the expected authorization SHA in the Build-only artifact or in an
   independently approved Runtime bootstrap record.
4. Add a separate append-only current-revocation baseline containing:

```text
promotionId
currentAuthorizationId
currentGeneration
retiredAuthorizationIds
effectiveAt
```

5. Verify the revocation baseline independently of the candidate authorization.
6. Define first initialization with the user/provisioner as the external root
   of trust.
7. Explicitly state that malicious Runner/host compromise is outside the
   guarantee.

### Impact

R5-R3A can pass a self-authored identity/authorization set and misstate the
actual test identity.

### Gate

```text
R5-R2-R2 DR-01:
NOT CLOSED

R5-R3A:
BLOCKING

R5-A:
BLOCKING
```

## 6. Coordinator C01-C24 Independent Matrix

### 6.1 Common conclusion

The current production IDL has no Test Coordinator command:

```text
Search of current IDL/Server source:
no TestStateInvoke
no GRANT_CONSUME
no GRANT_REVOKE
no EVIDENCE_RECONCILE
no SET_STATE
```

The only current `Matched` occurrence is the Evidence enum in
`include/common/p13_types.h:216`.

Therefore the current source does not expose the designed internal commands.
This is `SOURCE NOT IMPLEMENTED`, not Runtime proof.

### 6.2 Command matrix

`Common` below means the R5-R2-R2 common checks are accepted: local
authenticated call, exact manifest-resolved SID, phase, revision, request/body
digest, object/Run binding and unknown-command deny.

| ID | Independent caller/binding check | Transition | Replay / concurrency | Result |
|---|---|---|---|---|
| C01 | Runner SID + authorization hash; pre-run only | immutable scenario create | same scenario/digest idempotent; different scenario Conflict | PASS AT DESIGN |
| C02 | Runner + auth; exact scenario/root | READY -> RUNNING | one-way; repeated same request returns stored result | PASS AT DESIGN |
| C03 | Runner or registered server; read-only | none | snapshot versioned | WARNING: “registered server” needs exact per-server SID/role table |
| C04 | Control server + forwarded caller evidence | OPENING -> ACTIVE | duplicate caller/session Conflict | WARNING: forwarded caller evidence trust must be explicit |
| C05 | Control server; exact active session/process | no state mutation + replay journal | sequence/replay | PASS AT DESIGN |
| C06 | Control server; exact operation/generation/session/root object | Grant + Ticket ISSUED atomically | Grant ID + operation key unique | PASS AT DESIGN |
| C07 | Control server; exact Grant audience | read-only | terminal Grant denied | PASS AT DESIGN |
| C08 | Control server + Helper/Grant audience | ISSUED -> RESERVED | one winner | PASS AT DESIGN |
| C09 | Control server + Helper/Grant | RESERVED -> EFFECT_REPORTED | duplicate effect Conflict | PASS AT DESIGN |
| C10 | Launch Authority + Supervisor identity | ISSUED -> BOUND | one launch session | WARNING: Coordinator cannot authenticate forwarded Supervisor identity |
| C11 | Matching Launch Authority + Supervisor identity | BOUND -> CLAIMED; PREPARING created | request/body hash + revision | PASS AT DESIGN |
| C12 | Matching Launch Authority | PREPARING -> PREPARED; Ticket REDEEMED | transfer proof required | PASS AT DESIGN |
| C13 | Launch Authority or watchdog | PREPARING/PREPARED -> ABORTED | proof required | FAIL: watchdog identity/termination authority not single |
| C14 | Launch Authority or watchdog | uncertain -> UNKNOWN | no CLOSED | WARNING: exact watchdog instance not bound |
| C15 | Launch Authority + Supervisor | PREPARED -> COMMIT_PENDING | CAS, one winner | PASS AT DESIGN |
| C16 | Launch Authority | COMMIT_PENDING -> COMMITTED | close proof | PARTIAL: no Supervisor resume outcome |
| C17 | Launch Authority | PREPARING/PREPARED -> ABORT_PENDING | CAS vs COMMIT | PARTIAL: timeout owner not uniquely identified |
| C18 | Launch Authority or watchdog | ABORT_PENDING -> ABORTED | process/Handle proof | FAIL: two potential termination actors |
| C19 | Matching Launch Authority | append LAUNCH_EVIDENCE | digest/idempotency | PASS AT DESIGN |
| C20 | Exact Helper Token/restricted SID/Grant/object | append HELPER_EFFECT | immutable one-source | PASS AT DESIGN |
| C21 | Exact Supervisor + Launch identity | append SUPERVISOR_VERIFICATION | immutable one-source | PASS AT DESIGN |
| C22 | Control Server or Supervisor | ACTIVE -> REVOKE_REQUESTED | one CAS winner | WARNING: dual actor paths need exact session-class rule |
| C23 | Supervisor verifier | REVOKE_REQUESTED/RECONCILING -> RECONCILED | all proof required | PASS AT DESIGN |
| C24 | Runner | RUNNING/STOPPING -> COMPLETED/QUARANTINED | no active child/unknown Handle | FAIL: phase says STOPPING but no command transitions RUNNING to STOPPING |

### 6.3 New Coordinator findings

#### C-DR-01: No `BEGIN_STOP` transition

C24 declares phase `STOPPING` but allows a transition from `RUNNING` or
`STOPPING`. There is no C01-C24 command that changes run state from `RUNNING`
to `STOPPING`.

Required:

```text
BEGIN_STOP:
  Runner, while RUNNING
  CAS RUNNING -> STOPPING
  verifies authorization still valid
  records child-stop plan

CLOSE_RUN:
  only STOPPING -> COMPLETED or QUARANTINED
```

#### C-DR-02: No `RESUME_ACK`

The Launch state diagram includes `COMMITTED -> RUNNING`, but C16 stops at
COMMITTED. Supervisor ResumeThread occurs after the RPC response and has no
Coordinator command/evidence operation.

Required:

```text
RESUME_RESULT:
  Supervisor SID + transaction revision/nonce
  SUCCESS -> RUNNING only after exact thread/process observations
  FAILURE -> UNKNOWN/QUARANTINED
  idempotent by request/body digest
```

Without this, a committed launch can be neither reliably known as running nor
correctly revoked as running.

## 7. NTFS Dual Enforcement Review

### 7.1 Accepted elements

The design correctly requires:

- Coordinator and Helper to open independent root Handles;
- exact volume/file/root/parent identity;
- no string-prefix-only validation;
- component-by-component reparse rejection;
- handle-relative creation/open/delete;
- hard-link and LinkCount checks;
- delete-pending and parent replacement checks;
- fail-closed on unknown ownership;
- negative tests for junction, symlink, hard-link alias, case alias, ADS and
  directory swap.

No fallback to a normal full-path API is allowed.

### 7.2 Residual warning

`SafeNtfsRoot` using `NtCreateFile`/`NtOpenFile` is a new test-only dependency
and must be independently implemented/reviewed in R5-R3B. A design statement
that “handle-relative semantics are required” is not source proof.

### 7.3 Result

```text
Design:
ACCEPTED WITH IMPLEMENTATION REVIEW REQUIRED

Source:
NOT IMPLEMENTED

Runtime:
NOT EXECUTED

R5-R3A:
NOT REQUIRED

R5-R3B/D:
BLOCKING REQUIREMENT
```

## 8. Launch Transaction Correction Review

### 8.1 Correctly separated

- Durable Transaction State;
- kernel source/duplicate Handles;
- process identity;
- watchdog process;
- recovery evidence.

The design correctly refuses to reconstruct a lost kernel Handle from a record.

### 8.2 Blocking issue L-DR-01: no single Termination Authority

R5-R2-R2 lines 721-734 assign:

- Launch Authority watchdog: CAS abort and close/terminate source Handles;
- Supervisor watchdog: close duplicate Handles;
- Coordinator watchdog: no process Handles.

C13/C14/C17/C18 then allow “Launch Authority or watchdog” without identifying a
specific authenticated watchdog or a single CAS-owned termination authority.

Counterexample:

```text
deadline expires
Launch Authority watchdog calls TerminateProcess
Supervisor watchdog independently enters its close/abort path
both have valid transaction IDs
no ownerLease/terminationGeneration proves which participant won
```

Even if one operation is idempotent, the authority graph is ambiguous.

Required:

```text
terminationOwner
terminationOwnerToken
terminationGeneration
terminationDeadline
expectedRevision
```

Only the winner of `CAS terminationOwner=NONE -> <caller-token>` may initiate
TerminateProcess. Other parties may observe/close their own Handles but cannot
issue a second termination request.

### 8.3 Blocking issue L-DR-02: deadline not carried by v2

Line 731 says if the Coordinator is unavailable, both process owners use the
absolute deadline carried in the prepared transfer response.

The designed v2 result at lines 864-892 does not contain:

- deadline UTC/monotonic deadline;
- boot ID;
- watchdog generation;
- termination owner;
- transaction state.

The Supervisor cannot execute the claimed fail-closed path from the v2 result
alone.

Required fields or a separate authenticated transaction record retrieved before
the process transfer:

```text
deadlineUtc
bootId
watchdogGeneration
terminationOwner
transactionRevisionAtTransfer
```

The 184-byte size is therefore not final.

### 8.4 Blocking issue L-DR-03: RUNNING/resume not authoritative

See C-DR-02. Until a Supervisor resume acknowledgment exists, the transaction
cannot distinguish:

```text
COMMITTED but never resumed
COMMITTED and resumed
COMMITTED and ResumeThread failed
COMMITTED and Helper crashed immediately
```

These have different revoke/evidence outcomes.

### 8.5 Timeout / crash assessment

| Case | Independent result |
|---|---|
| LA crash before PREPARED | UNKNOWN is safe; source Handles close in OS |
| LA crash after PREPARED | target duplicates need supervisor watchdog; no single termination owner |
| Supervisor crash before COMMIT | LA source watchdog closes; okay if generation/ownership fixed |
| Supervisor crash after COMMIT before resume | UNKNOWN; no committed-process execution |
| Coordinator crash | durable record required; in-memory design not enough |
| old watchdog attempt on new transaction | generation not defined |
| Handle lost | UNKNOWN; design correctly does not reconstruct |
| QUARANTINED | no return path shown; must be terminal |

## 9. P13_PROCESS_LAUNCH_V2 Review

### 9.1 Contract identity

```text
UUID:
B2D9E41C-34D5-4046-96B6-9E14AA9D533E

Version:
2.0

Manager:
P13LaunchInvoke, opnum 0

Registration:
v2 only in R5-D/E test process
```

D1 currently freezes v1.0 in:

- `docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r4-d1-native-rpc-harness-architecture-build-plan.md:349-352`;
- `idl/p13_authority.idl:113-121`;
- generated `P13Launch_v1_0_s_ifspec`.

This is a major incompatible change. It requires an explicit design-freeze
exception and user approval. This review does not grant it.

### 9.2 Field layout

Independent arithmetic for the declared x64 C memory layout:

| Field | Offset | Size |
|---|---:|---:|
| resultPresent | 0 | 4 |
| contractVersion | 4 | 4 |
| transferId | 8 | 16 |
| launchSessionId | 24 | 16 |
| operationId | 40 | 16 |
| grantId | 56 | 16 |
| generation | 72 | 8 |
| transactionRevision | 80 | 8 |
| supervisorPid | 88 | 4 |
| helperPid | 92 | 4 |
| supervisorCreationTime | 96 | 8 |
| helperCreationTime | 104 | 8 |
| jobHandleValue | 112 | 8 |
| processHandleValue | 120 | 8 |
| threadHandleValue | 128 | 8 |
| transferNonce | 136 | 16 |
| transferDigest | 152 | 32 |
| total | 0 | 184 |

The 184-byte **memory layout** is internally consistent for x64 with natural
alignment.

It is not a proof of NDR wire size. NDR may encode fixed structures without
embedding padding in the same way, and the top-level out pointer has its own
referent semantics. Build-only must record:

- compiler `sizeof`;
- offsetof;
- MIDL-generated format;
- observed request/response wire size;
- fragment budget.

### 9.3 Typed result assessment

Positive:

- fixed fields;
- no arbitrary payload;
- handle values clearly process-local;
- transfer digest;
- error present/absent flag;
- one Manager.

Blocking deficiency:

- missing deadline/boot/watchdog generation as identified in L-DR-02;
- no explicit `transactionState`;
- no explicit `terminationOwner`/generation;
- therefore the result cannot implement the stated fail-closed watchdog path
  after Coordinator loss.

### 9.4 D1 decision status

```text
Design Freeze Exception:
REQUIRED

User Approval:
NOT GRANTED

R5-R3A:
NOT AFFECTED because it does not implement Launch v2

R5-R3C/D/E:
BLOCKED UNTIL APPROVED
```

## 10. R5-R3A Exact Scope Review

### 10.1 Existing paths

All files marked as existing modifications in R5-R2-R2 were found:

```text
include/identity/p13_identity_adapter.h
src/identity/windows_identity_adapter.cpp
include/authority/p13_authority_components.h
src/authority/p13_authority_components.cpp
include/authority/p13_authority_service.h
src/authority/p13_authority_service.cpp
include/server/p13_server_runtime.h
src/server/p13_server_runtime.cpp
src/server/p13_server_main.cpp
src/server/p13_managers.cpp
include/client/p13_client_runtime.h
src/client/p13_client_runtime.cpp
src/client/p13_client_main.cpp
```

The new R5-R3A scripts and source files do not exist yet, as expected.

### 10.2 Blocking issue S-DR-01: missing common identity types

`include/common/p13_types.h:262-290` defines:

- `CallerIdentityRecord`;
- `CallerExpectation`;
- `allowedWindowsSessionIds`.

R5-R2-R2 adds `allowedLogonSids` and requires Logon SID binding, but does not
list `include/common/p13_types.h` in the R5-R3A modification set.

Without changing `CallerExpectation` or introducing a replacement expectation
type, the identity adapter cannot receive the approved Logon SID rule.

### 10.3 Blocking issue S-DR-02: missing `SameIdentity`

`src/authority/p13_authority_components.cpp:44-59` defines `SameIdentity`.

It currently compares:

- PID;
- creation time;
- RPC principal;
- Authz and TokenUser SIDs;
- process group/restricted sets;
- integrity and Windows Session.

It does not compare:

- `rpcAuthzGroupSids`;
- `rpcAuthzRestrictedSids`;
- `logonSid`.

R5-R2-R2 requires Authz/process group agreement and Logon SID binding, but the
R5-R3A file table only allows “descriptor/identity-manifest symbols” and does
not list `SameIdentity`.

This is a concrete source-scope omission.

### 10.4 Blocking issue S-DR-03: Build/Output columns are not exact

Examples:

- `Build target` says `server/client/tests`, not exact target names.
- Header/source rows show `bin/r5-r3a/x64` or `manifest/r5-r3a` as output.
- `p13_r5a_tests.exe` is listed, but its exact source file/symbol ownership is
  split across three test files without a target rule.
- No exact generated copy of `p13_authority.h` is named in the R5-R3A source
  dependency table.

Required correction:

```text
each row:
exact source path
exact symbol/function/type
exact allowed diff
exact compile source list
exact include path
exact object output
exact binary/test output
exact generated output
exact test command
exact verifier assertion
```

### 10.5 R5-A positive contract test absent

The listed tests cover:

- identity failure;
- runtime trust;
- transport rejection.

There is no named source/test for the one positive `AUTHORITY_EPOCH_READ`
contract. Add an exact test target that verifies:

- Web authority ID;
- no Session;
- no Grant;
- response only includes serverEpoch;
- Effect sink unchanged;
- one request/no retry.

### 10.6 R5-R3A result

```text
File list existence:
PASS for existing files

Exact scope:
FAIL

R5-R3A authorization:
NOT READY
```

## 11. D1 v1.0 Freeze Boundary Review

The original frozen contract is:

```text
P13_PROCESS_LAUNCH_V1
UUID B2D9E41C-34D5-4046-96B6-9E14AA9D533E
Version 1.0
one P13LaunchInvoke Manager
```

The proposed contract is:

```text
same UUID
Version 2.0
same Manager name
new out parameter
```

This is a major incompatible interface change. It is not compatible merely
because it uses the same UUID. The current generated symbol is
`P13Launch_v1_0_s_ifspec`; v2 must generate a different registration symbol.

R5-R2-R2 correctly recognizes the need for a separate decision, but does not
supply:

- an explicit design-freeze exception ID;
- user approval record;
- v1/v2 coexistence policy beyond “v2 only”;
- exact generated symbol names;
- exact v1 error behavior on a v2 endpoint;
- ABI test that an old v1 client cannot misbind.

The change cannot be implemented under R5-R3A; it belongs to a later separately
approved R5-R3C.

## 12. Additional Findings

| ID | Severity | Finding | Impact | Required correction |
|---|---|---|---|---|
| M-DR-01 | P2 Blocking | Manifest authorization path can be Runner-selected; revocation baseline absent | self-consistent but unapproved Runtime config | fixed protected root + independent current revocation record |
| M-DR-02 | P1 Blocking | No single termination authority/lease among watchdogs | duplicate termination paths and ambiguous recovery | add owner token/generation/CAS |
| M-DR-03 | P1 Blocking | COMMITTED/RUNNING transition lacks resume acknowledgement | running vs committed-unsuccessful cannot be distinguished | add Supervisor resume result transition |
| M-DR-04 | P2 Blocking | RUNNING cannot enter STOPPING through a defined command | C24 unreachable / run state inconsistent | add BEGIN_STOP and restrict C24 |
| M-DR-05 | P2 Blocking | v2 result lacks deadline/boot/watchdog/termination fields | Coordinator-loss watchdog plan impossible | extend contract and recalculate NDR |
| M-DR-06 | P2 Blocking | R5-R3A misses `CallerExpectation`, Logon SID, `SameIdentity` | identity requirements not implementable within scope | add exact files/symbols |
| M-DR-07 | P2 | R5-R3A output/build columns not exact | Build-only authorization ambiguous | exact target/output/source mapping |
| M-DR-08 | P3 | No positive EPOCH contract test | positive path not traceable | add exact test source |
| M-DR-09 | Warning | Forwarded Supervisor/Helper identity to Coordinator is not independently authenticated for C10/C04 | server TCB trust assumption must be explicit | document and test trust chain |
| M-DR-10 | Warning | NDR size remains unverified | 184 bytes are only x64 memory-layout expectation | build-only MIDL/wire measurement |

## 13. Final Review Matrix

| Area | Design Accepted | Source Implemented | Build Verified | Runtime Verified | Configuration Approved | R5-R3A Dependency |
|---|---:|---:|---:|---:|---:|---|
| Manifest trust | NO | NO | NO | NO | NO | BLOCKING |
| Coordinator C01-C23 | PARTIAL | NO | NO | NO | NO | not in R5-R3A |
| Coordinator run STOP/RUNNING | NO | NO | NO | NO | NO | future |
| NTFS dual root | YES WITH IMPLEMENTATION WARNING | NO | NO | NO | NO | future |
| Launch transaction PREPARING | YES | NO | NO | NO | NO | future |
| Launch termination authority | NO | NO | NO | NO | NO | future |
| Launch v2 typed result | PARTIAL | NO | NO | NO | NO | R5-R3C gate |
| D1 v1.0 exception | NOT APPROVED | NO | NO | NO | NO | before R5-R3C |
| R5-R3A scope | NO | NO | NO | NO | NO | BLOCKING |
| R5-A minimal plan | YES WITH SCOPE CORRECTION | NO | NO | NO | NO | BLOCKED |
| PFR | PASS | N/A | N/A | N/A | N/A | no |
| Repository integrity | PASS | N/A | N/A | N/A | N/A | no |

## 14. Required Corrections Before R5-R3A

1. Fix the protected Runtime Authorization path and current revocation baseline.
2. Add exact `CallerExpectation`/Logon SID changes and `SameIdentity` comparison
   scope to R5-R3A.
3. Replace generic Build/Output cells with exact file/symbol/target/output
   matrices.
4. Add a positive EPOCH contract test source.
5. Clarify forwarded identity evidence trust for C04/C10.
6. Add `RESUME_RESULT`, `BEGIN_STOP`, and restrict C24 to STOPPING.
7. Add single `terminationOwner`/generation/CAS and extend Launch v2 with
   deadline/boot/watchdog fields.
8. Keep R5-R3B/C/D separate.
9. Record the D1 v2 exception as a separate user approval item before R5-R3C.

## 15. Unresolved / Not Verified

```text
Exact protected Runtime config path:
NOT DEFINED

Current revocation generation source:
NOT DEFINED

Coordinator source/IDL:
NOT IMPLEMENTED

Forwarded caller identity integrity:
NOT DEFINED

Single Termination Authority:
NOT DEFINED

Supervisor resume acknowledgement:
NOT DEFINED

BEGIN_STOP transition:
NOT DEFINED

Launch v2 deadline/watchdog fields:
NOT DEFINED

Launch v2 NDR/wire size:
NOT VERIFIED

D1 v1.0 exception:
NOT APPROVED

R5-R3A exact scope:
INCOMPLETE

Native RPC Build:
NOT EXECUTED

Native RPC Runtime:
NOT EXECUTED
```

## 16. Side-Effect Declaration

No source, IDL, generated file, Build Script, test, manifest, binary, endpoint,
process, Token, Job, Handle, account, group, ACL, DACL, Owner, Service,
Registry, PFR, database, Storage or Git state was changed.

## 17. Final Decision

```text
Overall:
FAIL — BLOCKING DESIGN CORRECTIONS REQUIRED

R5-R2-R2 Integrity:
PASS

Baseline Integrity:
PASS

Manifest Trust Root:
NOT CLOSED

Coordinator C01-C23:
MOSTLY ACCEPTABLE

Coordinator RUNNING/STOPPING:
NOT CLOSED

NTFS Dual Enforcement:
DESIGN ACCEPTED / IMPLEMENTATION NOT VERIFIED

Launch PREPARE:
PARTIAL

Launch Termination Authority:
NOT CLOSED

Launch v2:
TYPED CONTRACT PRESENT / WATCHDOG FIELDS MISSING / D1 EXCEPTION NOT APPROVED

R5-R3A:
NOT READY

R5-R3B/C/D:
NOT AUTHORIZED

R5-A:
NOT AUTHORIZED

Native RPC Build:
NOT EXECUTED

Native RPC Runtime:
NOT EXECUTED

Git Writes:
NOT EXECUTED
```

## 18. Report Integrity

A report cannot contain its own final SHA-256 without changing that hash. The
external SHA-256 is calculated after the final write and returned in the stage
completion message.
