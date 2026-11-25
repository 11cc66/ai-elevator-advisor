# P1-3 C-6.2-L8-A7.20-R4-A1-R5-R2-R2-R7 Independent Design Review

## 0. Executive Result

```text
Stage:
C-6.2-L8-A7.20-R4-A1-R5-R2-R2-R7

Date:
2026-11-22

Mode:
INDEPENDENT / READ-ONLY / ADVERSARIAL

Design Review:
FAIL — BLOCKING DESIGN CORRECTIONS REQUIRED

Review Independence:
PASS

Input Integrity:
PASS

P0:
0

P1:
4

P2:
3

P3:
2

Native RPC Build:
NOT EXECUTED

Native RPC Runtime:
NOT EXECUTED
```

R6 closes several prior design gaps:

- Host/Worker process responsibilities are separated;
- Host owns the durable transaction journal;
- Worker is intended to be the only terminator;
- TrustedKeySetManifest is now represented in the exact R5-R3A scope;
- Bundle IDs are 32 bytes and no longer carry raw Handle values;
- Challenge uses an anonymous pipe instead of command line/environment;
- Bootstrap timeout now has explicit timeout and termination states.

Four blocking issues remain:

1. Host and Worker still share the Host service SID, and the design does not
   define a separate Worker Service Object or an executable access path for the
   Worker's restricting SID.
2. Host may terminate the Worker, whose final Job Handle close may kill the
   Helper. This is an unmodeled second OS termination-trigger path.
3. The Bundle canonical record does not bind Key Set Generation or the two
   signing Key IDs.
4. The Challenge read Handle can be included in a handle list, but the design
   does not require the pipe Handle itself to be created inheritable with
   `SECURITY_ATTRIBUTES.bInheritHandle = TRUE`.

## 1. Scope and Independence

Reviewed:

- R6 design and open decisions;
- R5/R4 predecessor reviews;
- current v1.0 RPC/IDL and native Harness source;
- BV1/BV2 forensic and disposition reports;
- current Git, PFR, process and protected-object state;
- Microsoft documented semantics for restricted tokens, process access,
  anonymous pipes, handle inheritance and service access rights.

This review does not modify R6, source, IDL, tests, build configuration,
services, ACLs, PFR or Storage. Native Runtime is not authorized or executed.

## 2. Skills and Inputs

Root `AGENTS.md` was applied.

Skills actually read and used:

- `$project-architecture`;
- `$security-audit`;
- `$testing-and-verification`;
- `$file-lifecycle`;
- `$prisma-db-safety`.

`$prisma-db-safety` confirms that a PostgreSQL transaction cannot atomically
cover Windows Handle or process termination and that a test-only filesystem
Ledger can be reviewed as a separate durable state boundary, provided its
rollback and ownership limitations are explicit.

Input hashes:

| Input | Expected | Actual | Result |
|---|---|---|---|
| R6 main | `5C608DC6A3F51B3A029B70601B6A8FCD771CA56EF032F82E8EB482E4396732CD` | same | PASS |
| R6 decisions | `6A08221433471FB7743A3063355626A2D359B0E27E5512A3957E027756BE3C2B` | same | PASS |
| BV1 | `AAF113E8399D3F11A234AE0DF00E718AA5B0F0989801FDC0FC2B66C81C0F2A53` | same | PASS |
| BV2 | `53706B12D6AA51922A6933C07D9B85EEFC70F1A5B7486DEAF803A466C043A588` | same | PASS |
| R5 review | `458EAB1AB4B5E13E0AECA63663537D8FFD3E621417B7F8440C516AA18635D1A7` | same | PASS |
| R4 main | `11654ADEB83EF116267C70D1F9AD9015A308FA24D27DE7DEC9510FB4907100BB` | same | PASS |
| R4 decisions | `3F13F125667F53D26C4DADA178B2518402D4470686EF7E231555AC135F25B158` | same | PASS |

Current source and build evidence:

- `tools/native-rpc/p13-a1-r2/idl/p13_authority.idl`
- `tools/native-rpc/p13-a1-r2/include/common/p13_types.h`
- `tools/native-rpc/p13-a1-r2/src/common/p13_types.cpp`
- `tools/native-rpc/p13-a1-r2/include/identity/p13_identity_adapter.h`
- `tools/native-rpc/p13-a1-r2/src/identity/windows_identity_adapter.cpp`
- `tools/native-rpc/p13-a1-r2/src/authority/p13_*`
- `tools/native-rpc/p13-a1-r2/src/launch/p13_launch_components.cpp`
- `tools/native-rpc/p13-a1-r2/src/lifecycle/job_lifecycle_adapter.cpp`
- `tools/native-rpc/p13-a1-r2/src/lifecycle/sealed_adapter.cpp`
- `tools/native-rpc/p13-a1-r2/src/server/p13_managers.cpp`
- `tools/native-rpc/p13-a1-r2/build-b4.ps1`
- `tools/native-rpc/p13-a1-r2/verify-static-b4.ps1`
- `tools/native-rpc/p13-a1-r2/tests/b4/native_test_sources.cpp`

## 3. Microsoft API Controls

The review used these official semantics:

- `CreatePipe`: the returned handles are inheritable only when the supplied
  `SECURITY_ATTRIBUTES` permits inheritance.
- `CreateProcess`: `PROC_THREAD_ATTRIBUTE_HANDLE_LIST` restricts inheritance to
  selected handles; it does not make a non-inheritable handle inheritable.
- `CreateRestrictedToken`: a restricted token has a list of restricting SIDs,
  and access is granted only if both the normal access check and restricted
  access check allow it.
- Process Security and Access Rights: `PROCESS_TERMINATE`,
  `PROCESS_DUP_HANDLE`, `PROCESS_VM_*`, `PROCESS_CREATE_THREAD` and
  `PROCESS_SUSPEND_RESUME` are distinct rights.
- Service Security and Access Rights: `SERVICE_CHANGE_CONFIG` permits changing
  the executable and service configuration and must be restricted.

## 4. Host / Worker TCB Review

### 4.1 Responsibilities

R6 separates:

```text
Host: state, ledger, SCM, singleton, permit issuance
Worker: restricted-token/process creation and process/Job termination
```

This is a meaningful improvement. The Host does not hold Helper
`PROCESS_TERMINATE` or the Helper Job Handle in the intended steady-state
model. The Worker does not own the authoritative Ledger.

### 4.2 Host identity and worker identity

The design states:

```text
Host keeps the virtual service SID.
Worker derives from Host token.
service SID remains for Worker.
Worker adds a Worker-specific restricting SID.
```

It does not define a separate Worker Service Object, Worker service account or
distinct Worker user SID. The Worker is solely a child process under the Host
service identity.

The Host Process DACL grants the Host service SID full access. Because the
Worker token retains that service SID, the Worker's effective access still
depends on both the normal and restricted access checks. The design does not
list the Worker restricting SID in the Host Process DACL, which may deny Worker
access to Host, but it also does not prove the intended access matrix.

More importantly, the file ACL table grants read/execute and Worker spool access
to a “Worker service SID,” while no distinct Worker service SID is defined.
The Worker restricting SID is not shown in the executable/helper file DACLs.
Under the documented restricted-token double access check, a listing that only
grants the inherited Host service SID is insufficient unless the same DACL
also grants the Worker restricting SID.

Impact:

- the Worker may not be able to open the Helper image or its own state spool
  under the intended restricted token;
- Host/Worker separation is not a complete OS security boundary;
- “independent identity” is asserted by role naming but not established by the
  matrix.

Finding: P1-01.

### 4.3 Host indirect termination path

R6 grants Host:

```text
PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE | PROCESS_TERMINATE
```

over the Worker.

R6 also says:

```text
Host may terminate a hung Worker only as lifecycle recovery.
That may close the Worker's last Job Handle.
KILL_ON_JOB_CLOSE may terminate the Helper.
The resulting state must become UNKNOWN.
```

This is an OS termination trigger that does not pass through:

- a C30 request;
- a Host Effect Permit for Helper termination;
- Worker execution of that Permit;
- independent termination evidence.

It is outside Worker termination ownership and outside C01-C33. The recorded
`WORKER_RESTART_INTENT` is not a defined command/revision/evidence transition.

Marking the result UNKNOWN prevents false success, but does not prevent the
Helper from being terminated by the Host's action. This is a second effective
OS termination path.

Finding: P1-02.

## 5. SCM, Process and File ACL Matrix

| Object | Intended writer/controller | Review |
|---|---|---|
| Host Service Object | installer/Admin; Coordinator start only | design acceptable |
| Worker Service Object | not defined | FAIL |
| Host Process | Host SID full, verifier query | Worker restricted check incomplete |
| Worker Process | Host query/sync/terminate | overbroad but lifecycle-only; indirect path real |
| Helper Process | Worker terminate; observers query | Worker restrict SID absent |
| Worker files | install-time write only | Worker read path not proven |
| Ledger | Host write; verifier read | accepted with Host-compromise boundary |
| Worker spool | Worker write; Host read | Worker SID/restrict SID mapping missing |

No process DACL grants termination to Launch Authority or Supervisor.

## 6. Transaction Ledger Review

### 6.1 Authoritative source

The selected source is a test-only append-only file ledger under:

```text
C:\ProgramData\P13\R5\Termination\State\v1\ledger
```

Host is the sole writer. Runtime Verifier is read-only. The design does not use
the project database.

The choice is consistent with the rule that filesystem and Windows OS effects
are not a single transaction.

### 6.2 Sequence and Intent

The intended ordering is:

```text
authenticate caller
validate Operation/Grant/transaction/revision
persist Intent
persist Effect Permit
Worker executes
Worker signs Effect Evidence
Observer submits independent evidence
Host persists and CAS-finalizes
```

No irreversible OS effect is permitted before the Intent record is flushed.

This ordering is sound at design level.

### 6.3 Append-only limitation

Individual record files, sequence numbers, previous-record hashes, a head
pointer and Host-only write ACL are defined. This is stronger than a filename
convention.

However, the Host owns all write and HEAD authority. A compromised Host can
rewrite the ledger consistently, and there is no independent Ledger-head anchor
in R6. Full-host backup/restore can restore both Ledger and trust state.

This limitation is disclosed as compromise of Host TCB and full-host restore
outside the threat model in the decisions report. It is a P2 warning, not a
contradiction, provided R5-A cannot claim detection of a malicious Host.

### 6.4 Crash model

The 12 crash states cover the important non-atomic gaps:

- Intent before effect;
- effect before response;
- effect evidence before final CAS;
- final CAS before response;
- stale epoch/revision;
- ledger rollback;
- OS/ledger disagreement.

States with unknown effect remain `UNKNOWN/QUARANTINED`. No failure path
promotes an uncertain outcome to `CLOSED`.

The timeout/recovery implementation remains unverified.

## 7. P13TerminationInvoke Test-only RPC

Proposed identity:

```text
P13Termination
UUID: 290671B9-D13F-4449-A87E-DDBBD8A46A32
Version: 1.0
Manager: P13TerminationInvoke
Endpoint: p13-r5-termination-v1
IDL: tools/native-rpc/p13-a1-r2/idl/test/p13_termination.idl
```

The UUID occurs only in R6 design documents in the reviewed repository and
historical design corpus. It is not a production interface.

The design provides:

- separate test-only IDL path;
- separate Host/Worker binaries and output directories;
- production Manager, Release Manifest, install and endpoint exclusions;
- static checks for Manager/name/UUID/endpoint leakage.

The current repository has no `P13TerminationInvoke` source, endpoint,
registration or test binary. All are unapproved.

The separation is adequate at design level with a P3 approval warning. No
current production leak was found.

## 8. TrustedKeySetManifest

### 8.1 Trust composition

The design separates:

- `KEY_TRUST_ROOT`;
- `KEY_APPROVAL_ROOT`;
- manifest issuer;
- authorization issuer;
- revocation authority;
- anchor custodian;
- runtime verifier;
- transaction permit signer;
- bundle signer;
- evidence signer.

The root and approval keys are pinned in `RootTrustPin`, whose digest is
user-approved in the release build. No signer can self-approve.

### 8.2 Schema and encoding

The design defines:

- exact schema version;
- key set generation;
- previous manifest digest;
- Key ID as full SHA-256 of SPKI DER;
- ECDSA P-256 / SHA-256 only;
- deterministic JSON/JCS;
- sorted arrays;
- duplicate and unknown-field rejection;
- UTC whole-second timestamps;
- strict DER signature encoding;
- explicit key usages and authority scope;
- revocation status/generation;
- approval evidence;
- root rotation via a new user-approved build.

This is sufficiently complete at design level.

### 8.3 R5-R3A inclusion

R6 adds exact proposed files:

```text
include/runtime/p13_canonical_json.h
src/runtime/p13_canonical_json.cpp
include/runtime/p13_trusted_key_set.h
src/runtime/p13_trusted_key_set.cpp
manifest/r5-r3a/trusted-key-set.schema.json
manifest/r5-r3a/root-trust-pin.schema.json
tests/r5a/trusted_key_set_tests.cpp
```

It also adds exact test IDs TKS-01 through TKS-24, object names and build paths.

The actual `root-trust-pin.json` is correctly marked external/user-approved and
not created in this stage. R5-A Runtime must not proceed without it.

## 9. Bundle ID and Attestation

### 9.1 Passing pieces

R6 correctly separates:

```text
Host Authorization Signature
Worker Handle Ownership Attestation
```

Bundle ID is 32-byte SHA-256 and not an erasure of the underlying signer or
transaction. The design binds transaction, request, grant, session, generation,
revision, executor/boot epochs, PID/creation time, Helper type, authority,
image digest and access masks. It uses canonical encoding, domain separation,
a nonce and a 15-second lifecycle.

Worker restart invalidates in-memory Handle references. A signature or Bundle
ID cannot reconstruct a lost Handle.

### 9.2 Missing key-set binding

The Bundle canonical record contains:

```text
verifiedSignerIdentity
handleBundleGeneration
```

but not:

```text
keySetGeneration
hostSigningKeyId
workerAttestationKeyId
```

The TrustedKeySet has a generation and each Key ID is distinct, but the Bundle
does not explicitly bind the exact approved key generation and key IDs used to
sign it. The HBC-01 through HBC-16 test list also lacks an old-key-set or
wrong-key-ID Bundle test.

Without that binding, a Bundle signed under an older accepted key set can be
accepted by a verifier that validates the signature but does not compare the
key set generation/key usage at the Bundle boundary.

Finding: P1-03.

## 10. Challenge and Anonymous Pipe

### 10.1 Intended path

R6 intends:

```text
Launch Authority -> Host -> Worker -> Helper -> Control Server
```

Challenge is 32 random bytes and is not allowed in argv, environment, logs or
persistence. Host retains a digest and the raw value only in memory.

### 10.2 Inheritance gap

R6 states that Worker creates an anonymous challenge pipe and that
`PROC_THREAD_ATTRIBUTE_HANDLE_LIST` includes the Helper challenge-read Handle.

Microsoft's `CreatePipe` contract says the returned handles are inheritable
only when the pipe's `SECURITY_ATTRIBUTES` permits inheritance. A handle list
only narrows inheritance of handles that are already inheritable; it does not
make a non-inheritable Handle inheritable.

R6 does not explicitly require:

```text
CreatePipe(
  SECURITY_ATTRIBUTES{
    nLength = sizeof(SECURITY_ATTRIBUTES),
    lpSecurityDescriptor = protected SD,
    bInheritHandle = TRUE
  })
```

for the read endpoint, nor does it require the write endpoint to remain
non-inheritable.

Therefore the Challenge delivery path is not closed at the API-contract level.

Finding: P1-04.

### 10.3 Pipe inventory

The R6 inventory lists:

- Host control pipes;
- Helper challenge read pipe;
- Helper challenge write pipe;
- Worker control pipe.

It does not uniquely identify both endpoints of every anonymous pipe, their
inheritable flags, their ACL, or whether the Worker control channel is one-way
or duplex. The phrase “two anonymous one-way pipes” is ambiguous because a
Host<->Worker bidirectional channel needs two one-way pipes, while the
Helper-facing path is a third direction.

This is P2-02 even after the inheritability issue is corrected.

## 11. Control Server Identity

The design correctly requires:

- PID from the current local RPC caller, not client input;
- `OpenProcess` with `PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE`;
- creation time from the opened Handle;
- TokenUser, Logon SID, Integrity, Session and Helper type checks;
- no `PROCESS_TERMINATE` or `PROCESS_DUP_HANDLE`;
- fail-closed handling for PID reuse and all query failures.

This part passes at design level.

## 12. State and Command Matrix

### 12.1 Bootstrap timeout

R6 now defines:

```text
HELPER_BOOTSTRAPPING
  -> BOOTSTRAP_TIMEOUT_DETECTED
  -> TERMINATION_REQUESTED
  -> TERMINATION_PENDING
  -> TERMINATED / TERMINATION_UNKNOWN
```

C29 detects deadline, C30 requests termination, C31 is Worker effect, C32 is
independent verification, and C33 stores final result.

Ready and timeout use the same expected revision/CAS. The first winner excludes
the other. A late Ready cannot become RUNNING after timeout.

The P1-07 state mismatch from R5 is closed.

### 12.2 Matrix traceability

The C01-C33 table records:

- actor;
- precondition;
- durable transition/evidence;
- failure.

It does not expose per-row Grant, Generation and Revision columns, even though
the user requires each transition to identify those bindings. The protocol
narrative states Host validates them, but the command matrix is not itself
complete for C01-C33 traceability.

This is P2-01, not a claim that the current implementation is exploitable.

### 12.3 R4-S7

The production R4-S7 matrix remains 13 Authority and 6 Launch Operations.
C29-C33 are test-only and do not add production operations. This boundary is
consistent.

## 13. R5-R3A Scope

R6 includes exact working files, new headers/source, schemas, tests, object
names, EXE paths, build commands, hash method and failure stops.

It explicitly excludes:

- R5-R3B;
- Coordinator endpoint implementation;
- Termination Host/Worker implementation;
- P13TerminationInvoke implementation;
- D1 v2.0;
- Native Runtime.

The exact test count and object mapping are materially improved.

One remaining warning is that `p13_handle_bundle_contract.cpp` and
`p13_helper_ready_contract.cpp` are test-only in R5-R3A; the actual production
adapters remain later work. This is intentional and must not be reported as
implemented production behavior.

## 14. NDR and Wire Budget

R6 supersedes R4's 280-byte Launch result with a 296-byte design layout due the
32-byte Bundle ID.

The design estimate remains:

```text
Request / response / alignment reserves:
DESIGN ESTIMATE ONLY
```

No MIDL was run. The exact NDR referent, alignment and wire size remain
Build-only verification. The estimate must not be written as verified.

## 15. Adversarial Matrix

| ID | Trigger | Relevant identity/operation | Design control | Prevented? | Evidence | Result | Blocks R5-R3A |
|---|---|---|---|---|---|---|---|
| 01 | unauthorized Host start | Service DACL | SCM ACL | yes at design | service audit | deny | no |
| 02 | unauthorized Worker start | Worker bootstrap | private Host pipe + nonce | partial | pipe/bootstrap | deny standalone | no |
| 03 | Host changes Worker config | Host SCM identity | no SERVICE_CHANGE_CONFIG | design pass | service ACL | deny | no |
| 04 | Host kills Worker to kill Helper | Host Worker terminate + Job close | none beyond UNKNOWN | NO | Job close/Worker evidence | unmodeled termination | yes |
| 05 | two Workers start | Host singleton | one child, epoch | design pass | epoch/lock | one worker | no |
| 06 | old Worker survives new start | Host restart | wait/old process fail closed | design partial | Wait/epoch | no second kill handle | no |
| 07 | Ledger truncated/restored | Host storage | record chain/head | only within non-Host threat | hash chain | quarantine | no |
| 08 | Intent committed, Worker not run | Host/Worker | Permit + spool | yes | ledger | retry/UNKNOWN | no |
| 09 | Worker effect, Evidence lost | Worker | observer/spool | partial | process-Signaled | UNKNOWN | no |
| 10 | Host/Worker revision disagreement | Host CAS | expected revision | yes at design | CAS record | Conflict | no |
| 11 | old Permit after Worker restart | Worker | epoch/boot | yes at design | epoch evidence | reject | no |
| 12 | test RPC enters production | release build | separate IDL/target scan | design pass | static scan | build fail | no |
| 13 | KeySet rollback | Runtime Verifier | generation + anchor | yes within threat model | keyset/authority | deny | no |
| 14 | revoked key signs data | verifier | revocation generation | yes at design | revocation record | deny | no |
| 15 | Host Bundle signature replay | Supervisor | nonce/transaction/expiry | design pass | bundle ledger | reject | no |
| 16 | Worker attestation object mismatch | Worker | live handle table + creation time | partial | attestation | UNKNOWN | no |
| 17 | Bundle Handle closed | Worker | local table | yes | object lookup | reject | no |
| 18 | Bundle object replaced | Worker | image/time/identity | design partial | object evidence | reject/UNKNOWN | no |
| 19 | other child inherits Challenge pipe | CreateProcess | handle list only; pipe inheritable unspecified | NO | pipe handle inventory | missing path | yes |
| 20 | old Helper replays Challenge | Host | one-time digest/txn | yes at design | consume record | deny | no |
| 21 | Helper self-reports wrong PID | Control Server | RPC PID + query handle | yes at design | identity evidence | deny | no |
| 22 | PID reuse | Control Server | creation time | yes at design | handle evidence | deny | no |
| 23 | Process Handle open fails | Control Server | fail closed | yes | denial evidence | DENY | no |
| 24 | Token query fails | Control Server | fail closed | yes | identity evidence | DENY | no |
| 25 | Ready/timeout race | Host CAS | one revision winner | yes at design | transition record | one state | no |
| 26 | late Ready after timeout | Host | CAS state check | yes at design | late evidence | deny RUNNING | no |
| 27 | Worker terminates then crashes | Worker/Host | intent/evidence/spool | partial | observer | UNKNOWN/TERMINATED | no |
| 28 | Host crashes before final CAS | Host | durable records | partial | ledger replay | UNKNOWN/reconcile | no |
| 29 | UNKNOWN advanced to CLOSED | Host | final state guard | design pass | state table | reject | no |
| 30 | R5-R3A depends on D1 v2/TCB | build gate | exact source list | partial | scope inspection | no dependency found | no |

## 16. P0/P1/P2/P3 Findings

### P0

None.

### P1-01 — Host/Worker identity and restricted-SID ACLs are incomplete

Location:

```text
R6 report:456-486
R6 report:400-435
```

Identity:

- Host service SID;
- Worker restricting SID;
- Worker file/process access.

Trigger:

Worker attempts to open a Helper image, its Worker spool, or another approved
resource after being created with the restricted token.

Impact:

The design cannot prove the Worker can perform its assigned operations, and
the claimed Host/Worker identity boundary is not complete.

Why the design fails:

The Worker inherits the Host service SID and adds a restricting SID. Windows
checks both normal and restricted access. The file/process DACL table does not
include the Worker restricting SID, and no independent Worker Service Object
exists.

Required correction:

Define a distinct Worker service/process identity or explicitly add the Worker
restricting SID to every required object DACL, define access checks for Worker
files, spool and Helper process, and prove denied access to Host/other TCB
objects.

### P1-02 — Host can trigger Helper termination through Worker termination

Location:

```text
R6 report:397-406
R6 report:633-638
```

Trigger:

Host detects a hung Worker, appends `WORKER_RESTART_INTENT`, terminates the
Worker, its last Job Handle closes, and `KILL_ON_JOB_CLOSE` terminates the
Helper.

Impact:

An OS Helper termination occurs without a C30 command, Helper Effect Permit,
Worker execution, or independent C32 evidence. `UNKNOWN` prevents false
success but not the side effect.

Required correction:

Remove Host-directed Worker termination while Helper custody may exist, or
define a fully authorized Host recovery operation with explicit prohibition
from satisfying termination and a fail-closed quarantine rule. The design must
state which OS termination authority is actually used.

### P1-03 — Bundle does not bind Key Set Generation or signing Key IDs

Location:

```text
R6 report:1243-1282
R6 report:1774
```

Trigger:

A Bundle signed under an older accepted key set or an unexpected key is
presented after key rotation.

Impact:

Signature verification alone does not prove which Key Set Generation and key
usage authorized the Bundle.

Required correction:

Add `keySetGeneration`, `hostSigningKeyId` and
`workerAttestationKeyId` to the canonical Bundle preimage, require exact
matches to the current TrustedKeySet and active key usage, and add
old-generation/wrong-key test cases.

### P1-04 — Challenge pipe inheritance is not explicitly enabled

Location:

```text
R6 report:1300-1328
Microsoft CreatePipe semantics
```

Trigger:

Worker creates a non-inheritable anonymous pipe read Handle and includes it in
`PROC_THREAD_ATTRIBUTE_HANDLE_LIST`.

Impact:

The Helper does not receive the Challenge because a handle list cannot make a
non-inheritable Handle inheritable.

Required correction:

Use a protected `SECURITY_ATTRIBUTES` with `bInheritHandle = TRUE` for exactly
the challenge-read endpoint, keep the write endpoint non-inheritable, include
only the read Handle in the handle list, and add an inheritance test that
creates an unrelated child and proves it cannot receive the pipe.

### P2 Findings

#### P2-01 — C01-C33 rows omit per-transition Grant/Generation/Revision columns

The global Host checks are stated, but each C01-C33 row does not expose the
exact Grant, Generation and Revision preconditions and output bindings. Add
those columns or an equivalent per-row table before an implementation is
authorized.

#### P2-02 — Pipe inventory is not exact

The report says “two anonymous one-way pipes” while describing a
bidirectional Host/Worker control relation and a Worker/Helper challenge
relation. The exact pipe count, endpoints, access, inheritable flags, security
descriptors and close order must be enumerated for both Worker and Helper.

#### P2-03 — Ledger anti-tamper is Host-confined

The Ledger has a chain and head, but no independent external Ledger-head
anchor. A compromised Host can rewrite a coherent history. This is outside the
declared Host-compromise threat model but must remain an explicit warning and
must not be described as administrator-resistant.

### P3 Findings

- P3-01: The proposed P13TerminationInvoke UUID is still user-approval pending.
- P3-02: Current R5-R3A source files are not present; this is expected and is
  not runtime evidence.

## 17. Native API and Runtime Status

```text
Current production IDL:
P13Invoke
P13LaunchInvoke

P13TerminationInvoke current source:
ABSENT

Host/Worker current source:
ABSENT

TrustedKeySet current implementation:
ABSENT

Build:
NOT EXECUTED

Runtime:
NOT EXECUTED
```

The design cannot be called Build Verified or Runtime Verified.

## 18. Final Design Status

```text
Design Review:
FAIL — BLOCKING DESIGN CORRECTIONS REQUIRED

Review Independence:
PASS

Input Hashes:
PASS

Seven R5 P1 Findings:
PARTIALLY CLOSED

Host/Worker Identity:
FAIL — P1-01

Unique OS Termination Authority:
FAIL — P1-02

Transaction Ledger:
PASS AT DESIGN WITH HOST-COMPROMISE WARNING

P13TerminationInvoke Isolation:
PASS AT DESIGN / USER APPROVAL PENDING

TrustedKeySetManifest:
PASS AT DESIGN / ROOT CONFIG NOT PRESENT

Bundle Binding:
FAIL — P1-03

Challenge Pipe:
FAIL — P1-04

C01-C33 Traceability:
PARTIAL — P2-01

D1 v1.0:
FROZEN

D1 v2.0:
NOT APPROVED

R5-R3A Build-only:
NOT AUTHORIZED

R5-R3A Source:
NOT IMPLEMENTED

Native RPC Runtime:
NOT EXECUTED
```

## 19. Side Effects and Report Integrity

Only this report and the companion baseline exception report were added.
No source, IDL, tests, build configuration, services, ACLs, PFR, database,
Storage or Git index was changed. `$null` was metadata-read only; its content
was not read and its SHA-256 was not recalculated in R7.

This report cannot contain its own final digest without changing its bytes. The
external SHA-256 is calculated after the final write.
