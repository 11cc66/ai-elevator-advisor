# P1-3 C-6.2-L8-A7.20-R4-A1-R4-B5 Independent Post-Remediation Adversarial Review

## 0. Executive Result

```text
Stage:
C-6.2-L8-A7.20-R4-A1-R4-B5

Date:
2026-11-22

Mode:
INDEPENDENT READ-ONLY ADVERSARIAL REVIEW

Overall:
PASS WITH WARNINGS

Review Independence:
PASS — B4 CLAIMS RE-CHECKED FROM SOURCE

B2 Original Findings:
5 P1 / 13 P2 — HISTORICAL BASELINE PRESERVED

B4 Report Integrity:
PASS — SHA-256 MATCH

B4 Artifact Hashes:
PASS — SERVER / CLIENT / TESTS / MANIFEST / STATIC ALL MATCH

B1 Artifact Integrity:
PASS — UNCHANGED

OperationPolicy:
PASS — CENTRAL 13 + 6 POLICY TABLE

AuthorizedCallToken:
SOURCE IMPLEMENTED / PRIVATE CONSTRUCTION / SAME-PROCESS API WARNING

P1-01:
CLOSED AT SOURCE / RUNTIME NOT VERIFIED

P1-02:
CLOSED AT SOURCE / RUNTIME NOT VERIFIED

P1-03:
CLOSED AT SOURCE / RUNTIME NOT VERIFIED

P1-04:
CLOSED AT SOURCE / RUNTIME NOT VERIFIED

P1-05:
CLOSED AT SOURCE / RUNTIME NOT VERIFIED

Grant / Ticket Binding:
SOURCE PRESENT / TEST-STORE LIMITS REMAIN

Caller Identity Binding:
SOURCE PRESENT / RUNTIME NOT VERIFIED

RPC Authz Context:
SOURCE PRESENT / RUNTIME NOT VERIFIED

Process TokenUser:
SOURCE PRESENT / RUNTIME NOT VERIFIED

Integrity Level:
SOURCE PRESENT / RUNTIME NOT VERIFIED

Windows Session ID:
SOURCE PRESENT / DESCRIPTOR ALLOWLIST IS TEST-CONFIG

SID Attributes:
SOURCE PRESENT / RUNTIME NOT VERIFIED

13 Authority Operations:
SOURCE + POLICY MATRIX PRESENT

6 Launch Operations:
SOURCE + POLICY MATRIX PRESENT

Session / Launch State Machine:
PASS AT SOURCE BOUNDARY

Revoke Orchestrator:
SOURCE PRESENT / INTEGRATION AND RUNTIME NOT VERIFIED

UNKNOWN / QUARANTINED Safety:
PASS AT SOURCE BOUNDARY

Restricted Token:
SOURCE PRESENT / RUNTIME NOT VERIFIED

Job Lifecycle:
SOURCE PRESENT / RUNTIME NOT VERIFIED

Cross-process Handle:
SOURCE PRESENT / TARGET-IDENTITY HARDENING REQUIRED

SEALED:
SOURCE PRESENT / RUNTIME NOT VERIFIED

NDR Bounds:
PASS FOR STATIC 24576-BYTE BUDGET / RUNTIME BOUNDARY NOT VERIFIED

RPC Server Lifecycle:
SOURCE PASS / NOT EXECUTED

Sha256Outcome:
PASS AT SOURCE / RUNTIME NOT VERIFIED

P2-01 through P2-13:
SOURCE/BUILD CLOSURE CONFIRMED WITH WARNINGS

Native Test Source:
30 COMPILED / SEVERAL SOURCES ARE RUNTIME-GATED OR SHALLOW

Native Test Execution:
NOT EXECUTED

Build Manifest:
PASS — 28 SOURCE + 35 ARTIFACT RECORDS

Build Script:
PASS WITH WARNINGS

PE Static Inspection:
PASS

PFR Queue Integrity:
PASS — 46 STRINGS / 23 DELETE

Repository Integrity:
PASS WITH EXISTING DIRTY WORKTREE

P0:
0

P1:
0

P2:
8

P3:
4

Native RPC Runtime:
NOT EXECUTED

Next Gate:
READY FOR SEPARATE NATIVE RPC RUNTIME READINESS REVIEW
```

No new P0/P1 was found in the source boundary. Runtime behavior and several
test-only safety assumptions remain unverified.

## 1. Scope and Independence

This review was performed independently from the B4 implementation pass. B4
claims were re-checked against:

- current source and headers;
- IDL and generated MIDL stubs;
- `build-b4.ps1` and `verify-static-b4.ps1`;
- Build Manifest;
- static verification output;
- PE metadata/imports/dependencies;
- PFR and Git state.

No source, build output, test executable, ACL, process, Job, database, Storage
or Git state was modified.

## 2. Skills and Authoritative Inputs

Actually read and applied:

- `$project-architecture`
- `$prisma-db-safety`
- `$security-audit`
- `$testing-and-verification`
- `$file-lifecycle`

Reviewed:

- R4-S5, R4-S6, R4-S7, R4-S8, R4-S9, R4-S10, R4-S11;
- R4-A1 design/report;
- D1 Build Plan;
- B1 Build Report;
- B2 Independent Review;
- B3 Remediation Design;
- B4 Remediation Build Report;
- complete Harness source, IDL, generated files, tests and manifests.

## 3. Hash and Artifact Verification

```text
B2: 53A97D6973CD9BE65C048F2522E9D9899930154CB263E7E020BCC08809FBDD18
    MATCH

B3: 085D5D9DCC074C76394455D9883E33F7DD125F0569C0C751E58AD4A706F6AB97
    MATCH

B4: 63A4A0CE15FDE7E1EA299200B1C3EBF77D1457CD538F59094998162AB2895A6A
    MATCH
```

B4 artifacts:

| Artifact | Length | SHA-256 | Result |
|---|---:|---|---|
| Server | 465920 | `324D1C06BB5452FCE982119E3985AE5AB5B5A41A2D06013A709ECCD2266EEFB3` | MATCH |
| Client | 194560 | `D7BFF66F519B3B3544D8D0CC3858567B1B4CE64BCEFC1C5DFB7DFFEC6BEBCD49` | MATCH |
| Native Tests | 591872 | `AA2636BE8B53E26E79131E2C17FC863A6792D99976C01ED3A76EA7B5AF7EF3FA` | MATCH |
| Build Manifest | 12447 | `58ED3EAFF2498AFA44D4E1D92FD2CA43DD86CBA57E5E7B93B4B97204E8B79774` | MATCH |
| Static Verification | 21623 | `DEDA51B673CFA57CC653F02112C5C1322686F9B01424A80E69E6D5BEC4EB362E` | MATCH |

The artifact hash and length matched the current B4 file and manifest.

B1 artifacts remained unchanged:

```text
Server: A1169E2F6882BE5CA6F7D18C435DDA77E0F78A15467DE3C3A3271ABE241E38A5
Client: C86BE3839F414A8CE95DFC4312878EA598BE1FEC4A53AE254E943573897B4C6A
Manifest: DC164B09C1D16C7CAEB46B3785CA3806C703300C2535A39B471F7D08039FE2FF
Static: D10DE78D2B1736542AB3B4879ADABEA11A216CFEE6E535012A61D71F7218251D
B1 logs: unchanged
```

## 4. Current Baseline and PFR

```text
Repository: D:\thinkbook\Desktop\jieya
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 26
Untracked before B5 report: 232
Staged: 0
Deleted: 0
```

PFR:

```text
REG_MULTI_SZ
46 strings
23 pairs
23 DELETE
SHA-256: 0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC
```

PFR-020–PFR-023 remain `UNAPPROVED / NOT INCLUDED IN ANY EXCEPTION`.

## 5. Harness Inventory

Current B4 tree contains:

- policy/source headers under `include/**`;
- source under `src/**`;
- B4 native test source;
- `build-b4.ps1`;
- `verify-static-b4.ps1`;
- `manifest/r4-b4`;
- generated r4-b4 MIDL files;
- r4-b4 server/client/tests binaries;
- r4-b4 build/static logs;
- preserved B1 and B3 artifacts.

The B4 outputs are in the independent `r4-b4` revision directories. B1 output
directories were not overwritten.

## 6. OperationPolicy and AuthorizedCallToken

`src/authority/p13_operation_policy.cpp` contains a 13-entry Authority array and
a 6-entry Launch array. The policy row carries principal mask, authority mask,
session requirement, binding mode, generation requirement and effect/failure
metadata.

`AuthorizationEngine::AuthorizeAuthority` and `AuthorizeLaunch` construct the
`AuthorizedCallToken`; its constructor is private and the dispatcher requires a
token.

Positive:

- empty/unknown operation policy is rejected;
- Web/Worker and helper classes are separate;
- helper-only operations are not allowed for Web/Worker;
- Web/Worker grant/cancel/status operations are not allowed for helpers;
- token carries request, operation, generation, principal/session and matched
  Grant references;
- dispatcher checks token policy operation and request ID.

Warning:

- `AuthorizationEngine` and `IIdentityProvider` are public same-process APIs.
  A same-process component can supply a fake identity provider and call the
  engine. This is not remotely reachable through the two RPC managers, but it
  weakens the “unforgeable token” defense-in-depth claim. See P2-B5-01.

## 7. P1-01 Closure

Original attack:

```text
valid Staging Helper session
-> operation_id = OPERATION_REQUEST_GRANT
-> dispatcher
```

Current source:

```text
manager
-> policy lookup
-> PolicyAllows(principal mask + authority type)
-> identity/session/epoch
-> AuthorizedCallToken
-> dispatcher
```

`PolicyAllows` rejects `OPERATION_REQUEST_GRANT` for Helper principals. No
dispatcher path bypasses the token. Original P1-01 attack is closed at source
level.

Runtime remains unverified.

## 8. P1-02 Grant / Ticket Closure

Current source enforces:

- non-zero Grant ID for `MATCH_GRANT`;
- exact operation, action, generation, authority, helper type and session;
- expiry/terminal Grant state;
- one active Grant per operation/generation;
- Ticket Store with one-time consumption and authority/helper/release/generation
  comparison;
- helper registration binds the session to launch session;
- state-changing Grant operations use CAS-like mutex transitions.

Warning:

- Grant and Ticket stores are in-memory test stores; no durable DB CAS,
  process-crash recovery or cross-process atomicity is claimed.
- `TestGrantStore::Issue` overwrites a duplicate ID if the operation key
  differs; service-generated IDs make this low impact, but the store should
  reject duplicate IDs. P2.

Original P1-02 attack path is closed at source level.

## 9. P1-03 / P1-04 Lifecycle Closure

Current source:

- Launch sessions are inserted only when the ID is absent;
- UNKNOWN/QUARANTINED states are not accepted by the normal close path;
- `Close` requires `EvidenceReconciling`, process signaled, handles closed and
  matched evidence;
- helper `SESSION_CLOSE` moves to revoke/pending and returns
  `EvidenceUnknown` rather than `CLOSED`;
- Revoke orchestrator source exists for job close, wait, terminate fallback,
  handle closure and evidence reconciliation.

Warnings:

- The Revoke Orchestrator is not invoked by `SessionClose` in this Build-only
  harness; it returns unknown pending proof.
- `MarkEvidenceReconciling` is a public test-store operation that can be called
  with `EvidenceState::Matched` without carrying the two Evidence records.
  See P2-B5-03.

Original P1-03/P1-04 false-close paths are closed at source boundary.

## 10. P1-05 Identity Closure

Source now:

- obtains RPC call attributes for the current call;
- obtains a server-side process handle and creation time;
- obtains RPC Authz context;
- extracts Authz User/Groups/Restricted SIDs;
- obtains process TokenUser/Groups/Restricted/Integrity/Session;
- compares Authz User SID with process TokenUser using binary SID comparison;
- rejects missing expected SID, restricted-token failure, integrity mismatch and
  disallowed Session ID;
- records enabled/deny-only attributes.

Warning:

- Authz group/restricted lookup failures are currently ignored for the Authz
  side; the process-token side remains authoritative, but every identity field
  failure should deny under the B3 statement. See P2-B5-02.
- Descriptor Session IDs are broad test values `{0,1,2}` and are not production
  identity configuration.

Original P1-05 security chain is materially improved and no source-only bypass
was found. Runtime remains unverified.

## 11. P2 Reconciliation

| ID | B5 result | Evidence |
|---|---|---|
| P2-01 blocking listen | SOURCE PASS / RUNTIME NOT EXECUTED | `RpcServerListen(...,FALSE)`, Stop/Wait/Unregister source |
| P2-02 NDR bound | STATIC PASS / RUNTIME UNVERIFIED | variable payload, 200/216 base, 24576 budget |
| P2-03 restricted token/resume | SOURCE PASS / RUNTIME UNVERIFIED | API calls and imports present |
| P2-04 descriptor fields | SOURCE PASS WITH TEST-PLACEHOLDER LIMIT | helper type, credential/ticket checks wired |
| P2-05 SID attributes | SOURCE PASS / RUNTIME UNVERIFIED | enabled/deny-only checks |
| P2-06 revert | FAIL-CLOSED SOURCE PRESENT / RUNTIME UNVERIFIED | Authz primary path; destructor fail-stop |
| P2-07 ticket | SOURCE PASS; in-memory only | trusted Ticket Store, one-time consume |
| P2-08 sequence/expiry/cancel | SOURCE PASS; in-memory only | sequence/expiry/owner checks |
| P2-09 cross-process handle | SOURCE PRESENT; TARGET IDENTITY WARNING | `TransferHandlesToSupervisor` |
| P2-10 SEALED | SOURCE PASS / RUNTIME UNVERIFIED | protected DACL, Owner Rights, separate evidence |
| P2-11 SHA | PASS AT SOURCE | `Sha256Outcome` failure status |
| P2-12 tests | COMPILE PASS / RUNTIME NOT EXECUTED / COVERAGE WARNING | 30 source entries |
| P2-13 build provenance | PASS WITH WARNINGS | source/artifact hashes and env allowlist |

## 12. Restricted Token, Job and Handle

Source/import evidence confirms:

- `CreateRestrictedToken`;
- `IsTokenRestricted`;
- `CREATE_SUSPENDED`;
- `PROC_THREAD_ATTRIBUTE_JOB_LIST`;
- `CreateProcessAsUserW`;
- `IsProcessInJob`;
- cross-process `DuplicateHandle`;
- `ResumeThread`;
- `WaitForSingleObject`;
- `TerminateProcess`.

`TransferHandlesToSupervisor` takes a caller-supplied `HANDLE supervisorProcess`
and does not itself prove that handle belongs to the configured Supervisor SID
or a pinned process. The caller is expected to be the trusted Launch Authority,
but this should be enforced by a private transfer API before Runtime. P2-B5-04.

## 13. SEALED

Source constructs:

- Owner SID;
- Guardian/Supervisor read ACEs;
- `S-1-3-4` deny ACE;
- `SE_DACL_PROTECTED`;
- self-relative SD;
- `AccessCheck` adapter.

`EvaluateSealedEvidence` compares separate Helper Effect and Supervisor
Verification records, including object/size/hash/owner/DACL and lifecycle flags.

Warnings:

- records still carry booleans for Publisher/Sealer/old-handle proof; the
  boolean source is not cryptographically or independently bound.
- no real ACL/owner/handle test was executed.

## 14. RPC Server and NDR

Source has:

```text
RpcServerListen(1, 32, FALSE)
RpcMgmtStopServerListening
RpcMgmtWaitServerListen
RpcServerUnregisterIf
```

No `DontWait=TRUE` lifecycle error remains.

NDR base sizes from generated r4-b4 stub are `200` and `216`; payload is
variable up to 16384 with 4096 reserve, below the 24576 `MaxRpcSize` budget.
No integer conversion or oversized fixed payload is present in the IDL.

## 15. Sha256Outcome

All BCrypt failure branches return `CryptoFailed` and leave no accepted digest.
No zero digest fallback remains. Digest mismatch and policy errors deny before
Effect dispatch.

## 16. Native Tests

30 test IDs are present and the test executable compiles/links. Runtime tests
are gated and were not executed.

Warnings:

- Several T02/T03/T11/T12/T15/T16/T17/T19/T24/T25/T26/T27 entries are
  authorization-gate stubs and do not exercise every Windows API failure path.
- T06/T07/T08 contain shallow fixture checks rather than a complete
  dispatcher/effect path.
- T30 directly manipulates the launch store and does not prove an end-to-end
  RPC close path.

This is a test-coverage warning, not a Runtime PASS.

## 17. Build and PE

Build-only results:

```text
MIDL: PASS
MSVC: PASS
Link: PASS
Static source/artifact checks: PASS
Native runtime: NOT EXECUTED
```

PE inspection:

```text
Server, Client, Native Tests:
x64 / executable / ASLR / NX / High Entropy / CFG
```

The server imports include RPC, Authz, token, process, Job, ACL and
cryptographic APIs. Imports prove linkage only.

## 18. P2 Findings

### P2-B5-01 — Public authorization engine permits same-process provider injection

Evidence:

- `include/authority/p13_authority_service.h:22-39` exposes
  `AuthorizationEngine::AuthorizeAuthority/AuthorizeLaunch`.
- The methods accept any `IIdentityProvider&` and `HarnessState&`.
- The private constructor of `AuthorizedCallToken` prevents ordinary accidental
  construction, but does not prevent a same-process component from supplying a
  fake provider to the public engine.

Impact:

- defense-in-depth and test-interface isolation are weaker than the B4 report’s
  “unforgeable” claim;
- a compromised in-process module could synthesize a token.

Runtime reachability from an untrusted remote RPC caller:

```text
NOT PROVEN
```

This is P2 because the native RPC Manager uses the fixed Windows provider and
the same-process binary is part of TCB.

### P2-B5-02 — Authz group/restricted query failures are ignored

Evidence:

- `src/identity/windows_identity_adapter.cpp:252-278` attempts Authz group and
  restricted-SID queries, but failure paths are not checked before continuing.
- Process-token user comparison remains mandatory.

Impact:

- incomplete Authz evidence can be silently treated as empty rather than
  DENY; the primary user/token binding still remains, but the B3 statement
  requires every identity failure to be fail-closed.

### P2-B5-03 — Test store permits evidence state marking without evidence payload

Evidence:

- `src/launch/p13_launch_components.cpp:228-240` accepts an
  `EvidenceState::Matched` argument and sets `evidenceReconciled=true` without
  carrying or validating the Helper/Supervisor evidence records.
- `src/lifecycle/sealed_adapter.cpp` has the real comparison function, but the
  state store can be called independently.

Impact:

- an in-process/test coordinator can mark reconciliation matched without the
  dual-evidence transition. This must be hidden behind the Revoke/Evidence
  coordinator before Runtime.

### P2-B5-04 — Cross-process handle transfer target identity is not bound

Evidence:

- `src/lifecycle/job_lifecycle_adapter.cpp:204-239` accepts a caller-supplied
  `supervisorProcess` handle.
- It calls `DuplicateHandle` without verifying that the target process is the
  configured Supervisor SID, session or pinned process.

Impact:

- a compromised in-process Launch Authority adapter can transfer handles to a
  different process that accepts the handle.

### P2-B5-05 — Grant store duplicate ID behavior is not fail-closed

Evidence:

- `src/authority/p13_authority_components.cpp:428-441` assigns by
  `grants_[grantId]` after checking only operation/generation uniqueness.
- A duplicate grant ID with a different operation can overwrite a prior record.

Impact:

- test metadata integrity can be confused by duplicate IDs; service generation
  makes this low likelihood but not a valid invariant.

### P2-B5-06 — Session/identity descriptor suite uses broad test allowlists

Evidence:

- `src/authority/p13_authority_components.cpp` descriptors use test SIDs and
  `{0,1,2}` Session IDs.
- These are intentional placeholders, but they do not prove real caller
  session/integrity policy.

Impact:

- no production identity mapping is verified;
- runtime review must replace test descriptors with exact test identities.

### P2-B5-07 — Test source contains runtime-gate and shallow logical tests

Evidence:

- T02/T03/T11/T12/T15/T16/T17/T19/T24/T25/T26/T27 only check that runtime
  authorization is absent.
- T06/T07/T08 are fixture-level checks.
- T30 mutates the test store directly rather than traversing the RPC manager.

Impact:

- the 30-test source is compilable but not yet a complete adversarial coverage
  proof.

### P2-B5-08 — Revoke orchestrator is source present but not wired end-to-end

Evidence:

- `RunRevokeOrchestrator` exists in
  `src/lifecycle/job_lifecycle_adapter.cpp:326`, but the authority dispatcher’s
  helper session close returns `EvidenceUnknown` and does not invoke it.
- Full close remains fail-safe but the final coordinator wiring is not proven.

Impact:

- no false CLOSED was found;
- end-to-end CLOSED remains Runtime-not-verified.

## 19. P3 Findings

1. `B4` report has user-facing transcription/formatting inconsistencies in the
   artifact hash section; actual files and manifests match.
2. Actual test source covers 30 IDs but not 30 equally deep test implementations.
3. Binary signing is not present; local Harness binaries are unsigned.
4. A fresh runtime identity configuration must replace test SID/session
   placeholders.

## 20. Side Effects and Non-actions

No source, IDL, generated file, build artifact, Build Manifest, test binary,
RPC endpoint, process, token, Job, ACL, Registry, Service, database, Storage or
Git state was modified.

No generated EXE was executed.

## 21. Final Gate

```text
Overall:
PASS WITH WARNINGS

Review Independence:
PASS

B2 Original Findings:
5 P1 / 13 P2 PRESERVED

B4 Report Integrity:
PASS

B4 Artifact Hashes:
PASS

B1 Artifact Integrity:
PASS

OperationPolicy:
PASS AT SOURCE

AuthorizedCallToken:
PASS AT SOURCE / SAME-PROCESS INJECTION WARNING

P1-01:
CLOSED AT SOURCE / RUNTIME NOT VERIFIED

P1-02:
CLOSED AT SOURCE / RUNTIME NOT VERIFIED

P1-03:
CLOSED AT SOURCE / RUNTIME NOT VERIFIED

P1-04:
CLOSED AT SOURCE / RUNTIME NOT VERIFIED

P1-05:
CLOSED AT SOURCE / RUNTIME NOT VERIFIED

Grant / Ticket Binding:
SOURCE PASS / IN-MEMORY LIMIT

Caller Identity Binding:
SOURCE PASS / RUNTIME NOT VERIFIED

RPC Authz Context:
SOURCE PASS / RUNTIME NOT VERIFIED

Process TokenUser:
SOURCE PASS / RUNTIME NOT VERIFIED

Integrity Level:
SOURCE PASS / RUNTIME NOT VERIFIED

Windows Session ID:
SOURCE PASS / TEST ALLOWLIST ONLY

SID Attributes:
SOURCE PASS / RUNTIME NOT VERIFIED

13 Authority Operations:
SOURCE PASS

6 Launch Operations:
SOURCE PASS

Session / Launch State Machine:
SOURCE PASS

Revoke Orchestrator:
SOURCE PRESENT / END-TO-END NOT EXECUTED

UNKNOWN / QUARANTINED Safety:
PASS AT SOURCE BOUNDARY

Restricted Token:
SOURCE PASS / RUNTIME NOT VERIFIED

Job Lifecycle:
SOURCE PASS / RUNTIME NOT VERIFIED

Cross-process Handle:
SOURCE PRESENT / TARGET IDENTITY WARNING

SEALED:
SOURCE PASS / RUNTIME NOT VERIFIED

NDR Bounds:
STATIC PASS / RUNTIME BOUNDARY NOT EXECUTED

RPC Server Lifecycle:
SOURCE PASS / NOT EXECUTED

Sha256Outcome:
SOURCE PASS

P2-01 through P2-13:
SOURCE/BUILD CLOSED WITH WARNINGS

Native Test Source:
30 COMPILED / COVERAGE WARNINGS

Native Test Execution:
NOT EXECUTED

Build Manifest:
PASS

Build Script:
PASS WITH WARNINGS

PE Static Inspection:
PASS

PFR Queue Integrity:
PASS

Repository Integrity:
PASS WITH EXISTING DIRTY WORKTREE

P0:
0

P1:
0

P2:
8

P3:
4

Native RPC Runtime:
NOT EXECUTED

Next Gate:
READY FOR SEPARATE NATIVE RPC RUNTIME READINESS REVIEW
```

This result is not Runtime authorization and does not authorize R4-A2 or Git
commit.

## 22. Report Integrity

This report was frozen without embedding its own hash because inserting it
would change the file. Its SHA-256 is returned externally after read-only
verification.
