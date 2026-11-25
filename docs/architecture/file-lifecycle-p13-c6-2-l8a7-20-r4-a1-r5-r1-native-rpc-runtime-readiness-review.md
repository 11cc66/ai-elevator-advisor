# P1-3 C-6.2-L8-A7.20-R4-A1-R5-R1 Native RPC Runtime Readiness & Residual P2 Gate Review

## 0. Executive Result

```text
Stage:
C-6.2-L8-A7.20-R4-A1-R5-R1

Date:
2026-11-22

Mode:
READ-ONLY RUNTIME READINESS REVIEW

Overall:
PASS WITH WARNINGS

Review Independence:
PASS — B5 CLAIMS RE-CHECKED AGAINST CURRENT SOURCE

B5 Report Integrity:
PASS

B4 Artifact Integrity:
PASS

B5 P2 Findings Reassessed:
8

New Runtime-Readiness Gaps:
2

P0:
0

P1:
0

Native RPC Runtime:
NOT EXECUTED

Runtime Authorization:
NOT GRANTED

Next Gate:
READY AFTER PRE-RUNTIME SOURCE REMEDIATION
```

The current B4 Harness is structurally safer than a permissive prototype: the
public RPC surface remains two managers, authorization precedes dispatch, and
all unexpected identity/state failures observed in the reviewed paths are
fail-closed. It is not yet ready for a meaningful positive Native RPC runtime
test.

The decisive blockers are:

1. positive caller identity cannot currently match the compiled test SIDs;
2. Authz group queries are not uniformly fail-closed;
3. the test evidence store can mark reconciliation without evidence payloads;
4. cross-process Handle transfer does not bind the target Supervisor internally;
5. duplicate Grant IDs can overwrite store metadata;
6. Launch Ticket state is process-local and has no RPC issuance path;
7. `PREPARE` consumes the Launch Ticket that `COMMIT` and `ABORT` still require;
8. lifecycle/Job/SEALED adapters exist in source but are not called from the
   public RPC Manager paths;
9. the 30-test executable is not a deep runtime test suite and several
   runtime-enabled tests would fail by construction.

These are source/readiness blockers, not evidence of a currently exploited
remote authorization bypass. No P0 or P1 was found in this review.

## 1. Scope, Independence and Safety Boundary

This stage evaluated whether the B4 build-only Harness can support a separately
authorized Native RPC Runtime test programme. B5's conclusions were treated as
claims to verify, not evidence to copy.

The review covered:

- B5's eight P2 findings and four P3 findings;
- the current IDL, generated interface declarations, Manager entry points,
  authorization path, identity adapter, Launch stores, Job/Handle adapters,
  SEALED/Evidence adapter and 30-test source;
- the B4 source/artifact manifest;
- read-only PE headers, imports and dependencies;
- PFR and protected project objects.

No server, client, test executable or helper was run. No RPC binding or endpoint
registration occurred. No process, Token, Job, Handle, ACL, Owner, DACL, file,
Registry, PFR, Service, database or Storage operation was performed. No Git
write was performed.

## 2. Skills and Authoritative Inputs

The following Skills and Skill references were actually read in this review:

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

The root `AGENTS.md` was automatically loaded and applied. The high-risk route
for security, Windows runtime, process permissions and file lifecycle was used.

The authoritative design and report set included R4-S5 through R4-S11, the
R4-A1 design/implementation records, R4-A1-R4-D1, B1–B5, the lifecycle design
freeze, implementation status and database behaviour test plan. The current
source was then checked independently.

## 3. Hash, Artifact and Build Verification

### 3.1 Review reports

| Object | Expected | Actual | Result |
|---|---|---|---|
| B5 report | `3A2A1CEE642910D2F75BC05C1EB7DFE202A8B6446202C170E22730C725E618FD` | `3A2A1CEE642910D2F75BC05C1EB7DFE202A8B6446202C170E22730C725E618FD` | PASS |
| B4 report | `63A4A0CE15FDE7E1EA299200B1C3EBF77D1457CD538F59094998162AB2895A6A` | `63A4A0CE15FDE7E1EA299200B1C3EBF77D1457CD538F59094998162AB2895A6A` | PASS |

### 3.2 B4 binaries, manifest and static evidence

| Artifact | Length | SHA-256 | Result |
|---|---:|---|---|
| `bin/r4-b4/x64/p13_native_rpc_server.exe` | 465920 | `324D1C06BB5452FCE982119E3985AE5AB5B5A41A2D06013A709ECCD2266EEFB3` | MATCH |
| `bin/r4-b4/x64/p13_native_rpc_client.exe` | 194560 | `D7BFF66F519B3B3544D8D0CC3858567B1B4CE64BCEFC1C5DFB7DFFEC6BEBCD49` | MATCH |
| `bin/r4-b4/x64/p13_native_tests.exe` | 591872 | `AA2636BE8B53E26E79131E2C17FC863A6792D99976C01ED3A76EA7B5AF7EF3FA` | MATCH |
| `manifest/r4-b4/build-manifest.json` | 12447 | `58ED3EAFF2498AFA44D4E1D92FD2CA43DD86CBA57E5E7B93B4B97204E8B79774` | MATCH |
| `logs/r4-b4/static-review/static-verification.json` | 21623 | `DEDA51B673CFA57CC653F02112C5C1322686F9B01424A80E69E6D5BEC4EB362E` | MATCH |

All 28 declared B4 source records and all 35 declared B4 artifact records
matched their current lengths and SHA-256 values. No file was regenerated or
overwritten during this review.

### 3.3 B1 preservation

| B1 artifact | SHA-256 | Result |
|---|---|---|
| Server | `A1169E2F6882BE5CA6F7D18C435DDA77E0F78A15467DE3C3A3271ABE241E38A5` | UNCHANGED |
| Client | `C86BE3839F414A8CE95DFC4312878EA598BE1FEC4A53AE254E943573897B4C6A` | UNCHANGED |
| Build Manifest | `DC164B09C1D16C7CAEB46B3785CA3806C703300C2535A39B471F7D08039FE2FF` | UNCHANGED |
| Static Verification | `D10DE78D2B1736542AB3B4879ADABEA11A216CFEE6E535012A61D71F7218251D` | UNCHANGED |

### 3.4 Static PE and build security

Read-only `dumpbin` inspection confirmed:

```text
Machine: x64
Dynamic Base: enabled
NX Compatible: enabled
High Entropy VA: enabled
Control Flow Guard: enabled
Runtime dependencies:
  RPCRT4.dll
  bcrypt.dll
  AUTHZ.dll
  ADVAPI32.dll
  KERNEL32.dll
```

The B4 build script uses `/MT`, `/GS`, `/guard:cf`, `/sdl`, `/EHsc`, `/W4/WX`,
and the linker uses `/DYNAMICBASE`, `/NXCOMPAT`, `/HIGHENTROPYVA` and
`/GUARD:CF`.

The server imports `LoadLibraryExW` and `GetProcAddress`. No application source
call site for either API was found; the calls are consistent with runtime/CRT
support, but their exact loader role is `NOT PROVEN BY STATIC REVIEW`. No
configurable plugin path, script loader, debug Manager or application-level
dynamic dispatch entry was found.

The binaries are unsigned. That remains a P3 packaging/supply-chain item for a
future authenticated deployment boundary.

## 4. Current Project and Runtime Baseline

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
233

Staged:
0

Deleted:
0
```

Current environment facts:

```text
OS:
Windows 11 10.0.26300 x64

Current process Windows Session:
1

Current process elevated:
NO

Current process qualified as a P13 test identity:
NO

D: free space:
218.09 GiB

RpcSs:
Running / Automatic

DcomLaunch:
Running / Automatic

rpcrt4.dll:
10.0.26100.9949
SHA-256 35FA5F92F985CBA9B33BC5F17968211D84EBB910D639BA2DB8F35596BEFCA6A6
Microsoft signature VALID
```

The installed build-only toolchain remains available:

```text
MIDL:    10.0.26100.9457
MSVC:    19.44.35230.0
Linker:  14.44.35230.0
SDK:     10.0.26100.0
```

Presence of the toolchain does not authorize a rebuild or Native execution.

No `p13_native_rpc_server`, `p13_native_rpc_client` or `p13_native_tests`
process was running at the reviewed baseline.

## 5. PFR, Protected Objects and Paths

### 5.1 PFR

```text
Value:
REG_MULTI_SZ

Strings:
46

Pairs:
23

DELETE operations:
23

SHA-256:
0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC
```

The original 19 operations and installer-related PFR-020 through PFR-023 retain
their order. The newer four remain:

```text
UNAPPROVED / NOT INCLUDED IN ANY EXCEPTION
```

| ID | Operation | Source | Destination |
|---|---|---|---|
| PFR-020 | DELETE | `*1\??\C:\ProgramData\Microsoft\VisualStudio\Packages\_bootstrapper\vs_setup_bootstrapper_202611212157011555.json` | empty |
| PFR-021 | DELETE | `*1\??\C:\Users\thinkbook\AppData\Local\Temp\DEL7D6C.tmp` | empty |
| PFR-022 | DELETE | `*1\??\C:\Users\thinkbook\AppData\Local\Temp\DEL7D7D.tmp` | empty |
| PFR-023 | DELETE | `*1\??\C:\Users\thinkbook\AppData\Local\Temp\DEL7D7E.tmp` | empty |

### 5.2 Six protected objects

| Object | SHA-256 | Result |
|---|---|---|
| FZ | `E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705` | MATCH |
| ST | `5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586` | MATCH |
| DBTP | `FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7` | MATCH |
| Prisma Schema | `78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299` | MATCH |
| `apps/web/next-env.d.ts` | `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC` | MATCH |
| `apps/web/tsconfig.tsbuildinfo` | `21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520` | MATCH |

### 5.3 Abnormal root files and build trees

```text
D:\thinkbook\Desktop\jieya\$null
ABSENT

D:\thinkbook\Desktop\jieya\$null)
ABSENT

apps/web/.next
PRESENT / WHOLE-TREE NOT VERIFIED

apps/worker/dist
PRESENT / WHOLE-TREE NOT VERIFIED
```

No file lifecycle action was taken.

## 6. Current Public RPC Reachability

The IDL exposes exactly two Manager methods:

```text
P13Invoke         opnum 0, interface 4F8ED476-EC87-4257-A9DA-589E31FA4BC8 v1.0
P13LaunchInvoke   opnum 0, interface B2D9E41C-34D5-4046-96B6-9E14AA9D533E v1.0
```

Current reachable call graph for an application authority call is:

```text
P13Invoke
  -> DescriptorForId(request.authorityId)
  -> AuthorizationEngine::AuthorizeAuthority
     -> ValidateAuthorityRequest
     -> FindAuthorityPolicy
     -> PolicyAllows
     -> WindowsRpcIdentityProvider::Inspect
     -> Session/AcceptRequest when required
     -> Operation Owner / Grant / Ticket checks
     -> private AuthorizedCallToken
  -> DispatchAuthority(token, request)
  -> test state/effect sink only
```

Current reachable call graph for a Launch call is:

```text
P13LaunchInvoke
  -> configured launch descriptor
  -> AuthorizationEngine::AuthorizeLaunch
     -> ValidateLaunchRequest
     -> FindLaunchPolicy
     -> PolicyAllows
     -> WindowsRpcIdentityProvider::Inspect(Supervisor expectation)
     -> Launch Ticket / Grant / Launch state checks
     -> private AuthorizedCallToken
  -> DispatchLaunch(token, request)
  -> in-memory Launch state only
```

The lifecycle adapters are not present in either public Manager call graph:

```text
CreateRestrictedHelperToken
CreateAndAssociateSuspendedHelper
TransferHandlesToSupervisor
ResumeSuspendedHelper
RunRevokeOrchestrator
BuildProtectedCanonicalDescriptor
RunAccessCheckAdapter
EvaluateSealedEvidence
```

They are compiled and linked, but no public RPC operation invokes them.

## 7. B5 Residual P2 Gate Matrix

| B5 ID | B5 finding | Current Runtime classification | Blocks |
|---|---|---|---|
| P2-B5-01 | Public `AuthorizationEngine` and injectable provider | ACCEPTABLE SERVER TCB / NO REMOTE INJECTION PROVEN | no gate if the server binary is trusted and pinned |
| P2-B5-02 | Authz group/restricted query failure | RUNTIME BLOCKER — SOURCE FIX REQUIRED | R5-B through R5-E |
| P2-B5-03 | Evidence state marked without payload | RUNTIME BLOCKER FOR R5-E — COORDINATOR REQUIRED | positive reconfirmation/CLOSED/SEALED |
| P2-B5-04 | Supervisor target not bound by Handle transfer | RUNTIME BLOCKER FOR R5-D — SOURCE FIX REQUIRED | cross-process Handle transfer |
| P2-B5-05 | Duplicate Grant ID overwrite | RUNTIME BLOCKER FOR R5-C — SOURCE FIX REQUIRED | positive Grant uniqueness/replay tests |
| P2-B5-06 | Placeholder SIDs and broad Session allowlists | RUNTIME CONFIGURATION BLOCKER | all positive identity paths, including R5-A |
| P2-B5-07 | Shallow/runtime-gate test coverage | PARTIAL — SUPPLEMENTARY TESTS REQUIRED | reliance on current 30-test EXE as runtime proof |
| P2-B5-08 | Revoke Orchestrator not wired end-to-end | FAIL-CLOSED LIMITATION — CLOSED PATH NOT READY | positive Revoke/CLOSED proof |

## 8. P2-B5-01: AuthorizationEngine TCB Boundary

### Current evidence

- `include/authority/p13_authority_service.h:22-38` publicly exposes
  `AuthorizationEngine::AuthorizeAuthority` and `AuthorizeLaunch`.
- Both functions accept an arbitrary `IIdentityProvider&` and `HarnessState&`.
- `include/identity/p13_identity_adapter.h:7-23` permits other same-process
  classes to implement `IIdentityProvider`.
- `src/server/p13_managers.cpp:9-10` fixes the actual Manager provider to
  `WindowsRpcIdentityProvider`.
- `src/server/p13_managers.cpp:38-40` and `:85-87` pass that fixed provider.
- The private `AuthorizedCallToken` constructor prevents accidental ordinary
  construction, but same-process TCB code can call the public engine with a
  substitute provider and synthesizable state.

### Reachability

No RPC request field selects a provider. No public Manager calls another
identity adapter. No application-level `LoadLibrary` or `GetProcAddress` call
site or plugin registry exists. A remote or ordinary local RPC client cannot
supply an `IIdentityProvider` through the IDL.

### Decision

```text
TCB Boundary:
ACCEPTABLE SERVER TCB / RESIDUAL SAME-PROCESS API WARNING
```

This is acceptable only while the signed/pinned server binary and all of its
linked modules are trusted TCB. It does not constitute an unforgeable boundary
against code injection into the server process. The current unsigned build
therefore requires exact hash pinning at every future Runtime gate.

No pre-runtime source fix is required for P2-B5-01 if that TCB condition is
explicitly accepted. A future production split should make the authorization
engine non-public and inject the provider only through a server-owned factory.

## 9. P2-B5-02: Authz Group and Restricted-SID Failure Handling

### Current evidence

`src/identity/windows_identity_adapter.cpp`:

- `:34-45` treats a failed required token-information query as failure.
- `:68-81` requires a successful TokenGroups query.
- `:83-92` silently continues when TokenRestrictedSids query fails.
- `:239-249` requires the Authz user SID query.
- `:251-272` silently continues when Authz groups or restricted SIDs fail.
- `:275-280` requires Authz user SID to equal the process TokenUser.
- `:291-305` checks normal group and restricted SID using the process token,
  not the Authz group lists.

The primary user-to-process binding remains mandatory. The missing failure
propagation violates the approved fail-closed identity requirement for every
required identity property.

### Required semantics

| Property | Required rule |
|---|---|
| User SID | must exist; query failure is DENY |
| Normal group | must exist and be enabled where required; query failure is DENY |
| Restricting SID | for restricted Helper, must exist and query successfully; missing/error is DENY |
| Empty non-required list | valid only after a successful query returned an empty set |
| Truncated/second query failure | DENY |
| Allocation failure | DENY |
| Unsupported required property | DENY |

`AuthzContextInfoGroupsSids` and `AuthzContextInfoRestrictedSids` failures must
return `IdentityMismatch` or an equivalent non-success. They must not be
interpreted as a valid empty list. No cached identity may be used.

### Decision

```text
P2-B5-02:
RUNTIME BLOCKER — SOURCE FIX REQUIRED
```

This must be fixed before any positive identity or authorization Runtime gate.

## 10. P2-B5-03: Evidence Reconciliation Trust Boundary

### Current evidence

- `src/launch/p13_launch_components.cpp:228-240` accepts
  `EvidenceState::Matched` directly and sets `evidenceReconciled=true`
  without receiving or checking two evidence records.
- `src/launch/p13_launch_components.cpp:243-260` can close a launch once those
  booleans are set.
- `src/lifecycle/sealed_adapter.cpp:166-200` contains the stronger comparison,
  but no call site invokes it.
- No public RPC operation accepts an `EvidenceState` or invokes
  `MarkEvidenceReconciling`.

### Attack and failure analysis

A remote RPC caller cannot directly set `EvidenceState::Matched`; doing so
requires same-process code. The same-process path is therefore inside the
current server TCB, but it is still an unsafe test abstraction: a coordinator
bug or future test-only entry could close or seal without Helper Evidence and
Supervisor Verification.

The following concepts are distinct and must not be collapsed:

```text
Test boolean
Test effect record
Native Helper effect evidence
Supervisor filesystem verification evidence
```

`MarkEvidenceReconciling` must not remain callable as a public state setter. A
single trusted coordinator method must:

1. accept both evidence records;
2. validate operation, Grant, Session, source type and exact object;
3. call the evidence comparison internally;
4. emit `Matched`, `Mismatch` or `Unknown`;
5. permit CLOSED/SEALED only from its result.

### Decision

```text
P2-B5-03:
RUNTIME BLOCKER FOR R5-E — HIDE MUTATION BEHIND TRUSTED COORDINATOR
```

It does not block a no-evidence R5-A transport probe. It blocks all positive
Revoke/SEALED/CLOSED Runtime claims.

## 11. P2-B5-04: Cross-process Supervisor Handle Binding

### Current evidence

- `src/lifecycle/job_lifecycle_adapter.cpp:204-242` accepts a raw
  `supervisorProcess` Handle.
- `:214-227` duplicates the Job, Helper process and Helper thread into that
  target process.
- The function does not query the target PID, creation time, TokenUser,
  integrity, Windows Session or configured Supervisor identity.
- There is currently no call site for `TransferHandlesToSupervisor`.

### Required trusted chain

```text
Pinned Supervisor record
  -> expected TokenUser SID
  -> expected Windows Session and integrity
  -> expected process creation time
  -> server-opened target process Handle
  -> DuplicateHandle into that exact Handle target
  -> duplicate-back verification
```

The target must not be identified by process name, unbound PID, caller-supplied
SID string or the source process' authority ID.

After transfer, the source process should verify observations without trusting
target-relative Handle values:

| Object | Required verification |
|---|---|
| Job | duplicate back/open from target, confirm expected Job identity and Helper membership |
| Helper process | duplicate back, `GetProcessId` equals pinned Helper PID, `GetProcessTimes` equals pinned creation time |
| Suspended thread | duplicate back, `GetProcessIdOfThread` equals pinned Helper PID |

Any identity lookup or duplicate-back failure must clean up transferred entries
and return `UNKNOWN`, not success.

### Decision

```text
P2-B5-04:
RUNTIME BLOCKER FOR R5-D — SOURCE FIX REQUIRED
```

This must be fixed before the first real cross-process Handle transfer.

## 12. P2-B5-05: Grant ID Uniqueness and Concurrency

### Current evidence

- `src/authority/p13_authority_components.cpp:428-441` checks
  operation/generation uniqueness but not `grants_.contains(grantId)`.
- It assigns `grants_[grantId] = grant`, which can overwrite an existing Grant
  record with the same ID but a different operation.
- The mutex protects each individual call, but does not repair the missing
  business uniqueness check.
- `Find`, `Match`, `Reserve`, `MarkEffect`, `Consume`, `Revoke` and `Expire`
  address records only by Grant ID.

### Required behavior

```text
duplicate Grant ID
  -> CONFLICT / DENY

same ID from another Authority
  -> CONFLICT / DENY

historical revoked/expired/consumed ID
  -> CONFLICT / DENY

concurrent same-ID issue
  -> exactly one success at most
```

The store must not overwrite a prior record, leave a stale
`activeByOperation_` mapping, or let a new Grant replace old authorization
metadata.

### Decision

```text
P2-B5-05:
RUNTIME BLOCKER FOR R5-C — SOURCE FIX REQUIRED
```

No persistent or cross-process uniqueness is claimed by the current in-memory
store.

## 13. P2-B5-06: Test SIDs, Groups, Integrity and Windows Session

### Current descriptors

`src/authority/p13_authority_components.cpp:100-181` defines synthetic SIDs:

```text
Web user / group:          ...-1001
Worker user / group:       ...-1002
Supervisor user / group:   ...-5001 / ...-5101
Staging user/group/r:      ...-2001 / ...-3001 / ...-4001
Publisher user/group/r:    ...-2002 / ...-3002 / ...-4002
Sealer user/group/r:       ...-2003 / ...-3003 / ...-4003
Cleanup user/group/r:      ...-2004 / ...-3004 / ...-4004
Required integrity RID:    8192 for all descriptors
Allowed Windows Sessions:  {0,1,2} for all descriptors
```

The four restricted SIDs are distinct, but the suite is not a real identity
fixture. A normal logged-in account cannot supply these SIDs merely by running
a script. The current interactive process is in Session 1 and is not a
qualified P13 test identity.

### Findings

- Positive identity tests cannot reach authorization success with the current
  descriptors.
- `{0,1,2}` is broader than a precise per-test Session policy.
- Integrity RID 8192 is a placeholder/global expectation, not a verified token
  policy for each test identity.
- `logonSid` is collected but no authorization predicate compares an expected
  Logon SID. It must not be claimed as an enforced binding.
- No test identity manifest, account creation plan or exact ACL fixture is
  currently installed.

### Future exact identity design

The following are test-only logical identities. Actual SIDs must be resolved
after a separately authorized fixture-creation step; they must not be invented
in source.

| Logical identity | Token class | Required group | Restricting SID | Intended endpoint |
|---|---|---|---|---|
| Web runtime | normal | dedicated Web test group | none | control |
| Worker runtime | normal | dedicated Worker test group | none | control |
| Authority Supervisor | normal | Supervisor group | none | four launch endpoints |
| Staging launch authority | normal | Staging launcher group | none | Staging launch |
| Publisher launch authority | normal | Publisher launcher group | none | Publisher launch |
| Sealer launch authority | normal | Sealer launcher group | none | Sealer launch |
| Cleanup launch authority | normal | Cleanup launcher group | none | Cleanup launch |
| Staging Writer Helper | restricted | `G_ST_TEST` | `R_ST_TEST` | control |
| Publisher Helper | restricted | `G_PUB_TEST` | `R_PUB_TEST` | control |
| Sealer Helper | restricted | `G_SEAL_TEST` | `R_SEAL_TEST` | control |
| Cleanup Helper | restricted | `G_CLN_TEST` | `R_CLN_TEST` | control |

Future identity configuration must be read-only, hash-pinned, and contain:

```text
authority ID
principal class
expected TokenUser SID
normal group SID
restricting SID when applicable
required integrity RID
exact allowed Windows Session ID for this test run
canonical endpoint
capability/helper type
```

The exact Windows Session must be recorded after fixture launch. A descriptor
must fail startup if the Session, SID format, duplicate identity mapping or
endpoint mapping is invalid.

### Decision

```text
P2-B5-06:
RUNTIME CONFIGURATION BLOCKER — EXACT TEST IDENTITY MANIFEST REQUIRED
```

This blocks even the current positive `AUTHORITY_EPOCH_READ` probe.

## 14. P2-B5-07: Native Test Coverage

### 14.1 Structural findings

`tests/b4/native_test_sources.cpp` compiles 30 IDs, but:

- no test calls `P13Invoke` or `P13LaunchInvoke`;
- no test passes through `P13Managers` and `WindowsRpcIdentityProvider`;
- no test creates a real Token, process, Job or ACL;
- no test uses an RPC binding;
- nine runtime-gated tests assert that runtime authorization is absent, so they
  fail if the gate is enabled;
- multiple pure tests assert only a constant or fixture inequality;
- T30 mutates the test Launch store directly;
- after T05, B4 scenario IDs no longer align with the D1 30-scenario matrix by
  number, which weakens one-to-one traceability.

### 14.2 Complete current 30-test assessment

| ID | Current function | Current assertion/coverage | Class | Runtime readiness |
|---|---|---|---|---|
| T01 | `T01ValidClientAndPolicy` | policy arrays are 13/6 | Pure shallow | Does not make a valid client call |
| T02 | `T02WrongPidGate` | asserts runtime env is absent | Runtime gate failure | Fails when enabled; no PID test |
| T03 | `T03WrongCreationTimeGate` | asserts runtime env is absent | Runtime gate failure | Fails when enabled; no creation-time test |
| T04 | `T04WrongTokenSid` | deny-only fixture comparison | Pure fixture | No Windows Token or authorization call |
| T05 | `T05WrongPrincipal` | two fixture strings differ | Pure fixture | No Manager or identity binding |
| T06 | `T06ExpiredSession` | fixture time is expired | Pure shallow | Does not call `AcceptRequest` |
| T07 | `T07WrongEpoch` | `1 != 2` | Pure shallow | No Session/epoch binding |
| T08 | `T08Replay` | empty Session store lookup | Pure shallow | Does not submit a replay |
| T09 | `T09Conflict` | status constant differs | Pure shallow | No conflict scenario |
| T10 | `T10CrossAuthority` | two GUIDs differ | Pure shallow | No cross-authority call |
| T11 | `T11ClientExitGate` | asserts runtime env is absent | Runtime gate failure | Fails when enabled; no client exit |
| T12 | `T12PidReuseGate` | asserts runtime env is absent | Runtime gate failure | Fails when enabled; no PID reuse |
| T13 | `T13UnauthorizedCaller` | Staging not allowed to request Grant | Pure policy | Useful partial allowlist check only |
| T14 | `T14HelperRevoke` | Running is not Closed | Pure shallow | No revoke orchestration |
| T15 | `T15JobCloseGate` | asserts runtime env is absent | Runtime gate failure | Fails when enabled; no Job |
| T16 | `T16TerminateFallbackGate` | asserts runtime env is absent | Runtime gate failure | Fails when enabled; no process |
| T17 | `T17StaleHandleGate` | asserts runtime env is absent | Runtime gate failure | Fails when enabled; no stale Handle |
| T18 | `T18UnauthorizedManager` | policy count only | Pure shallow | Does not probe an unauthorized Manager |
| T19 | `T19RevokeRaceGate` | RevokeRequested is not Closed | Runtime-gated shallow | Executes only as a state fixture; no race |
| T20 | `T20TicketReuse` | Ticket Issue succeeds once | Pure shallow | Does not attempt reuse/consume |
| T21 | `T21RestrictedSidMismatch` | two SID strings differ | Pure shallow | No restricted Token or AccessCheck |
| T22 | `T22NormalSidMissing` | empty set cannot satisfy group | Pure useful | No Live Token |
| T23 | `T23CredentialReference` | two strings differ | Pure shallow | No credential isolation proof |
| T24 | `T24JobAssignmentGate` | asserts runtime env is absent | Runtime gate failure | Fails when enabled; no Job |
| T25 | `T25ResumeFailureGate` | asserts runtime env is absent | Runtime gate failure | Fails when enabled; no ResumeThread |
| T26 | `T26TerminateFallback` | `EvidenceUnknown != Ok` | Runtime-gated shallow | No termination or wait |
| T27 | `T27WaitTimeout` | `EvidenceUnknown != Ok` | Runtime-gated shallow | No wait timeout |
| T28 | `T28SealerEvidenceMismatch` | Grant mismatch returns mismatch | Pure useful | No real Evidence store |
| T29 | `T29OldWriteHandle` | false write-closed flag blocks match | Pure useful | No duplicate write Handle/NTFS object |
| T30 | `T30UnknownNotClosed` | direct store UNKNOWN cannot Close | Pure state | Does not traverse RPC or coordinator |

### 14.3 Required replacement tests

The current IDs may be retained for continuity, but every runtime row must be
fully implemented and must verify that denied requests produce zero unexpected
Effect. At minimum:

- invalid Manager/opnum and callback denial;
- wrong user SID, group, restricting SID, session and integrity;
- PID reuse and client-exit races;
- duplicate Grant ID, concurrent issue, replay and conflicting body;
- Launch Ticket one-time consumption and post-PREPARE lifecycle;
- four-launch-authority cross-call isolation;
- Job membership before resume;
- target-Supervisor handle binding;
- old write Handle/Evidence mismatch;
- no CLOSED/SEALED from UNKNOWN.

### Decision

```text
P2-B5-07:
PARTIAL — SUPPLEMENTARY TESTS REQUIRED
```

The current EXE cannot serve as positive Runtime evidence for any of the five
R5 stages.

## 15. P2-B5-08: Revoke and EvidenceUnknown

### Current evidence

- `src/authority/p13_authority_service.cpp:467-482`: Helper
  `SESSION_CLOSE` requests revoke but returns `EvidenceUnknown`.
- `src/authority/p13_authority_service.cpp:606-612`: Helper exit notice
  revokes Grant/session metadata and returns `EvidenceUnknown`.
- `src/authority/p13_authority_service.cpp:758-764`: Launch
  `SESSION_CLOSE` calls only the in-memory Launch store `Close`.
- `src/lifecycle/job_lifecycle_adapter.cpp:326-351` contains
  `RunRevokeOrchestrator`, but no RPC or production-style Coordinator calls it.

### Safety assessment

Returning `EvidenceUnknown` is the correct safe result for the current
incomplete wiring. No false CLOSED was found. Closing an in-memory Job Handle
would not by itself prove process exit; process-signaled evidence and
reconciliation remain required.

### Decision

```text
P2-B5-08:
FAIL-CLOSED LIMITATION — POSITIVE CLOSED PATH NOT READY
```

Negative tests may prove that no false CLOSED occurs. They must not be reported
as successful end-to-end Revoke.

## 16. Additional Runtime-Readiness Gaps Found in R5-R1

### RR-01: No executable cross-process Launch/Test state topology

Current facts:

- `src/authority/p13_authority_service.cpp:223-226` returns one function-local
  `HarnessState`.
- Each server process therefore has a separate Session/Grant/Ticket/Launch/
  Evidence store.
- `TestTicketStore::Issue` has no non-test call site; only T20 calls it.
- No public RPC operation issues a Launch Ticket.
- `P13_LAUNCH_PREPARE` only consumes a Ticket and changes in-memory state; it
  does not call `CreateAndAssociateSuspendedHelper`.
- `P13_LAUNCH_COMMIT`, `ABORT`, `STATUS_READ` and `SESSION_CLOSE` only change
  in-memory Launch state.
- `src/server/p13_server_main.cpp:14-35` runs either the control interface or
  one launch interface, not a shared-state multi-authority test fabric.
- The B4 bin directory contains server, client and tests only. There is no
  helper executable or Web/Worker/Supervisor test client matrix.

Consequences:

- a separate Launch endpoint process starts with an empty Ticket/Grant store;
- the existing control server cannot send its in-memory Ticket to that process;
- even if a Ticket existed, the current Launch operations do not create or
  control a real process;
- full four-Authority Runtime topology cannot be exercised with the current
  binaries.

Classification:

```text
RR-01:
RUNTIME BLOCKER — TEST COORDINATION/STATE AND EFFECT ADAPTERS REQUIRED
```

The remediation must be separately designed and authorized. Direct test access
to production state or an unauthenticated coordination endpoint is not
acceptable.

### RR-02: `PREPARE` consumes the Ticket that `COMMIT` and `ABORT` require

Current flow:

```text
P13_LAUNCH_SESSION_REGISTER policy: LAUNCH_TICKET, does not consume
P13_LAUNCH_PREPARE policy:         LAUNCH_TICKET
  AuthorizeLaunch -> ValidateLaunchTicket
  DispatchLaunch  -> TestTicketStore::Consume

P13_LAUNCH_COMMIT policy:          LAUNCH_TICKET
P13_LAUNCH_ABORT policy:           LAUNCH_TICKET
  AuthorizeLaunch -> ValidateLaunchTicket
```

`src/authority/p13_authority_service.cpp:195-219` rejects a consumed Ticket.
Therefore a successful `PREPARE` leaves `COMMIT` and `ABORT` unable to pass
authorization unless another Ticket is introduced. This is a functional and
recovery-path failure:

- preparation cannot be followed by the designed commit;
- a suspended/uncertain helper cannot be aborted through the designed Manager;
- any workaround that reuses a Ticket would violate one-time-consumption rules.

Classification:

```text
RR-02:
RUNTIME BLOCKER — LAUNCH TICKET/SESSION LIFECYCLE SOURCE FIX REQUIRED
```

The fix must bind the consumed Ticket to a Launch Session and authorize
post-PREPARE operations from that Session plus exact Grant/Generation/Release/
object binding, without permitting a second consume or cross-session replay.

## 17. Reassessment of B5 P3 Findings

| B5 P3 | Current result |
|---|---|
| Historical report formatting/hash-transcription inconsistencies | Confirmed historical presentation issue; actual B4 files and hashes match |
| Uneven test depth | Confirmed and expanded in section 14 |
| Unsigned Harness binaries | Confirmed; future Runtime must pin exact SHA-256 and separately decide signing |
| Runtime identity placeholders need replacement | Confirmed; promoted into Runtime blocker P2-B5-06 |

## 18. Runtime Test Topology Design

This section is design only. It creates and executes nothing.

### 18.1 Required logical topology

```text
Isolated test host/VM
  |
  +-- Future test coordinator (separate design/authorization required)
  |     - owns test-only run manifest
  |     - records parent/child PID + creation time
  |     - coordinates shared test Session/Grant/Ticket/Evidence state
  |     - exposes no production authority
  |
  +-- Control RPC server
  |     endpoint: ncalrpc::p13-authority-v1
  |     interface: P13Authority v1.0
  |     manager: P13Invoke only
  |
  +-- Staging launch server
  |     endpoint: ncalrpc::p13-launch-staging-v1
  |     interface: P13Launch v1.0
  |
  +-- Publisher launch server
  |     endpoint: ncalrpc::p13-launch-publisher-v1
  |
  +-- Sealer launch server
  |     endpoint: ncalrpc::p13-launch-sealer-v1
  |
  +-- Cleanup launch server
  |     endpoint: ncalrpc::p13-launch-cleanup-v1
  |
  +-- Web test client
  +-- Worker test client
  +-- Supervisor test client
  +-- Four restricted Helper processes/releases
  +-- Test-only Effect sink and Evidence sink
  +-- Isolated NTFS fixture root
```

The current B4 artifacts do not yet implement the coordinator, shared state,
full client matrix, helper release matrix or lifecycle call wiring. RR-01 must
be resolved before R5-D or R5-E.

### 18.2 Process ownership and identity

| Process | Owner | Required identity | Required observation |
|---|---|---|---|
| Coordinator | test operator | non-production test identity | PID, creation time, run ID |
| Control server | coordinator | approved test server identity or explicitly scoped test account | PID, creation time, TokenUser, integrity, Session |
| Launch server x4 | coordinator | separate test launch identities | independent PID/creation time/SID/Session |
| Web client | coordinator | Web test identity | exact process binding |
| Worker client | coordinator | Worker test identity | exact process binding |
| Supervisor client | coordinator | Supervisor identity | same identity accepted by all four launch endpoints |
| Helpers x4 | Supervisor/configured launcher | restricted token with own normal group and unique restricting SID | PID, creation time, Job membership, Token SIDs |

No process may be identified by image name or unbound PID. Every destructive
Handle operation must use a Handle opened from a pinned identity record.

### 18.3 RPC interface security

All endpoints must use:

```text
protocol sequence: ncalrpc
interface security: exact SID allowlist
client authentication: RPC_C_AUTHN_WINNT
privacy: RPC_C_AUTHN_LEVEL_PKT_PRIVACY or stricter
NullSession: DENY
KernelModeCaller: DENY
remote/non-local client: DENY
RPC_IF_ALLOW_LOCAL_ONLY: enabled
wire budget: 24576 bytes
```

The control interface SDDL should allow only the exact Web, Worker and four
Helper test SIDs required for the test run. Each launch interface should allow
only the exact Supervisor SID. `Everyone`, `Authenticated Users`, Anonymous,
interactive broad groups and production service SIDs must not be admitted by
the test endpoint descriptor.

### 18.4 Fixed endpoints and interface versions

| Purpose | Endpoint | Interface |
|---|---|---|
| Control | `p13-authority-v1` | `4F8ED476-EC87-4257-A9DA-589E31FA4BC8` v1.0 |
| Staging launch | `p13-launch-staging-v1` | `B2D9E41C-34D5-4046-96B6-9E14AA9D533E` v1.0 |
| Publisher launch | `p13-launch-publisher-v1` | same launch interface/version |
| Sealer launch | `p13-launch-sealer-v1` | same launch interface/version |
| Cleanup launch | `p13-launch-cleanup-v1` | same launch interface/version |

No `p13-launch-staging-writer-v1` alias may be used. Endpoint conflict is
`NOT VERIFIED` until a separately authorized controlled bind attempt. A
duplicate endpoint must stop the gate; it must not be worked around by changing
the canonical name.

### 18.5 Environment, files and logging

Future Runtime must use:

- fixed working directories;
- an environment allowlist containing no production secrets;
- a new run ID and new evidence directory;
- isolated test-only logs with no credentials or raw tokens;
- an isolated NTFS fixture root outside production Storage;
- fixed executable paths and pre-run SHA-256 checks;
- no inherited unrelated Handles;
- no database or production Storage connection.

## 19. Runtime Safety Preflight

Before any later authorized runtime command, all of the following must pass:

1. root is `D:\thinkbook\Desktop\jieya`;
2. Branch and HEAD match the authorized baseline or the difference is explained;
3. no `p13_native*` process is running;
4. Server, Client and Tests SHA-256 equal the authorized artifacts;
5. B4/B1 artifacts, protected hashes and PFR baseline match;
6. exact test identity manifest is present and hash-pinned;
7. the Windows Session and integrity in the manifest match the launched clients;
8. control and four launch endpoints are not already owned by an unexpected
   process;
9. interface SDDL contains only exact approved SIDs;
10. Effect sink is test-only and initially empty;
11. all test output paths are inside the approved evidence directory;
12. no production credential, database, Storage or `.env` is in scope;
13. PIDs, creation times, parent ownership and Handle access masks are recorded;
14. a bounded timeout and exact stop sequence are armed;
15. unexpected effect, unknown Handle ownership or PFR change triggers stop.

The current checkout fails the positive identity preflight because the compiled
SIDs are placeholders and the current process is not a P13 test identity.

## 20. Staged Runtime Authorization Plan

### R5-0 — Read-only Preflight

```text
Risk: LOW
Authorization needed: read-only commands only
Purpose: hashes, Git, PFR, protected objects, no residual processes, report review
Stop: any hash/identity/topology mismatch
Cleanup: none
```

This is the only layer that could be performed without a new state-changing
authorization, and it is complete for this stage.

### R5-A — Basic ncalrpc Transport

```text
Risk: MODERATE
Authorization needed:
  - start fixed Server and Client executable
  - register one test ncalrpc endpoint
  - make one authenticated local RPC call
Effects: no Helper, no file Effect, no ACL, no DB
```

Tests:

- controlled endpoint bind and shutdown;
- malformed request/unknown opnum denial;
- authenticated positive `AUTHORITY_EPOCH_READ` using an exact approved test SID;
- Coarse callback denial for an unapproved SID;
- Manager-level authorization still runs when callback passes.

Preconditions:

- P2-B5-02 and P2-B5-06 closed;
- exact interface SDDL and identity manifest;
- no positive path claims for Grant, process or SEALED.

Stop conditions:

- endpoint already exists;
- callback/manager order differs from source;
- unknown caller reaches Dispatcher;
- Effect sink changes;
- PFR or executable hashes change.

Cleanup:

- stop new calls, close RPC bindings, stop server listening, wait for listen
  thread, unregister interfaces, verify process exit and no residual endpoint.

### R5-B — Caller Identity

```text
Risk: HIGH
Authorization needed:
  - process creation under multiple exact test identities
  - cross-session local RPC if the test design requires it
  - Token/SID/Session observation
Effects: identity checks and test Effect records only
```

Tests:

- correct and wrong TokenUser;
- wrong normal group;
- missing/wrong restricted SID;
- deny-only SID;
- wrong integrity;
- wrong Windows Session;
- wrong RPC principal;
- client exit during request;
- PID reuse and creation-time mismatch.

Preconditions:

- P2-B5-02 and P2-B5-06 closed;
- each identity descriptor is hash-pinned;
- no placeholder or fallback identity.

Stop conditions:

- a query failure permits continuation;
- an Authz/User or process/User mismatch succeeds;
- any denied call reaches Dispatcher or changes the Effect sink.

Cleanup:

- close client/server process Handles;
- verify all child processes signaled;
- preserve denial evidence;
- quarantine unknown identity state.

### R5-C — Authorization, Grant and Ticket

```text
Risk: MODERATE
Authorization needed:
  - control endpoint only
  - in-memory test Session/Grant state
Effects: test Session/Grant metadata and Effect sink only
```

Tests:

- 13-operation allowlist matrix;
- Audience/principal/action/generation/session binding;
- duplicate Grant ID issue;
- concurrent same-ID issue;
- expired/revoked/consumed Grant;
- request replay and conflicting request body;
- Launch Ticket one-time behavior;
- cross-authority session injection;
- unknown opcode denial.

Preconditions:

- P2-B5-02, P2-B5-05, P2-B5-06 and RR-02 closed;
- test traceability no longer depends on shallow fixtures.

Stop conditions:

- duplicate ID overwrites;
- replay/conflict causes a second logical Effect;
- a Ticket can be reused or an operation remains impossible after PREPARE.

Cleanup:

- clear/invalidating test stores only by normal process exit;
- no production store or persistent database operation.

### R5-D — Restricted Token, Job and Handle

```text
Risk: HIGH
Authorization needed:
  - create restricted test Token
  - create suspended test process
  - create Job and transfer Handles
  - resume, wait, terminate exact test process
  - close exact test Job/process/thread Handles
Effects: process/Job/Handle state in an isolated test fixture
```

Tests:

- `CreateRestrictedToken` flags and restricting SID;
- `CREATE_SUSPENDED`;
- Job membership before Resume;
- failed Job assignment does not resume;
- source-to-Supervisor transfer target identity;
- duplicate-back Handle identity;
- resume failure cleanup;
- Job close then process signaled;
- terminate fallback only on the pinned Handle;
- stale Handle/PID reuse denial.

Preconditions:

- P2-B5-04, P2-B5-06, P2-B5-08, RR-01 and RR-02 closed;
- exact test helper executable/release exists;
- explicit process-termination authorization;
- no real Storage access by the Helper.

Stop conditions:

- target SID/session/creation time mismatch;
- process outside expected Job;
- process signaled cannot be proven;
- any unknown child process remains;
- generation/session authority mismatch.

Cleanup:

- close exact Job Handle;
- wait for process signaled;
- terminate only the pinned Helper Handle if the approved fallback is needed;
- wait again;
- close process/thread Handles;
- if any step is unknown, quarantine state and stop.

### R5-E — SEALED and Dual Evidence

```text
Risk: CRITICAL
Authorization needed:
  - isolated NTFS fixture creation
  - controlled ACL/Owner/DACL operations on that fixture
  - duplicate write Handle test
  - dual Evidence reconciliation
Effects: security descriptor and fixture metadata only
```

Tests:

- protected DACL;
- Owner identity;
- OWNER RIGHTS deny behavior;
- Publisher exit and all write Handles closed;
- Sealer does not write data;
- Supervisor independent read-only verification;
- Helper Effect and Supervisor Evidence identity match;
- replay/mismatch/unknown behavior;
- no CLOSED/SEALED without both Evidence objects.

Preconditions:

- P2-B5-02, P2-B5-03, P2-B5-06 and P2-B5-08 closed;
- RR-01 resolved;
- isolated NTFS root verified;
- explicit ACL/Owner/DACL authorization;
- no production Storage or business file in scope.

Stop conditions:

- protected DACL or Owner Rights readback differs;
- Evidence object/operation/Grant/Session mismatch;
- write Handle closure is unknown;
- any code maps UNKNOWN or QUARANTINED to CLOSED/SEALED.

Cleanup:

- never auto-delete unknown canonical/fixture objects;
- preserve fixture and Evidence for inspection;
- if access semantics cannot be proven, retain and mark UNKNOWN/QUARANTINED.

## 21. Stop, Cleanup and Recovery Rules

Every Runtime layer must follow:

```text
stop new RPC calls
  -> invalidate/revoke the relevant test Session/Grant
  -> close exact owned Handles
  -> wait on exact process objects
  -> use terminate fallback only if separately authorized and identity-pinned
  -> wait for signaling
  -> close remaining exact Handles
  -> verify no active test process/endpoint
  -> reconcile Evidence
  -> CLOSED only with complete matching proof
  -> otherwise UNKNOWN / QUARANTINED
```

Forbidden cleanups:

- `git clean`;
- wildcard process termination;
- killing by image name;
- deleting a test root without exact path verification;
- clearing PFR;
- treating Job Handle close as proof that all helper work is complete;
- treating process exit as proof of file integrity or SEALED.

## 22. Runtime Authorization Matrix

| Capability | R5-A | R5-B | R5-C | R5-D | R5-E |
|---|---:|---:|---:|---:|---:|
| Start fixed server/client | yes | yes | yes | yes | yes |
| Register ncalrpc endpoint | yes | yes | yes | yes | yes |
| Authenticated RPC call | yes | yes | yes | yes | yes |
| Multiple test identities | no | yes | maybe | yes | yes |
| Create real process/Token/Job | no | process only | no | yes | yes |
| Transfer Handles | no | no | no | yes | yes |
| Terminate exact test process | no | no | no | yes | yes |
| ACL/Owner/DACL change | no | no | no | no | yes |
| Real database/Storage | no | no | no | no | no |
| Git write | no | no | no | no | no |

Each column requires separate explicit user authorization. Passing one column
never authorizes the next.

## 23. Unknown and Not-Verified Items

```text
Positive authenticated RPC call:
NOT EXECUTED

Actual RPC principal/session/integrity behavior:
NOT VERIFIED

Endpoint name collision on current host:
NOT VERIFIED — requires controlled bind and would change runtime state

Negative endpoint eligibility with a prohibited SID:
NOT VERIFIED

Cross-process Job/process/thread transfer:
NOT EXECUTED

Restricted Token creation:
NOT EXECUTED

Job containment and process termination:
NOT EXECUTED

ACL / OWNER RIGHTS / duplicate write Handle:
NOT EXECUTED

Dual Evidence / SEALED:
NOT EXECUTED

Cross-process Eventual CLOSED:
NOT EXECUTED

Production Grant/Evidence persistence:
NOT IMPLEMENTED / OUT OF THIS HARNESS SCOPE

Crash-safe replay:
NOT IMPLEMENTED / NOT VERIFIED

`.next` and Worker `dist` whole-tree identity:
NOT VERIFIED

Exact loader role of server `LoadLibraryExW` / `GetProcAddress` imports:
NOT PROVEN BY STATIC REVIEW
```

## 24. Repository and PFR End-State

The only project file intentionally added in this stage is this report.

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

Tracked modified:
26

Untracked after allowed report:
234

Staged:
0

Deleted:
0
```

PFR end-state:

```text
REG_MULTI_SZ
46 strings
23 pairs
23 DELETE
SHA-256:
0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC
```

The six protected hashes and all B1/B4 artifact hashes remain unchanged. Both
abnormal root files remain absent.

## 25. Final Status

```text
Overall:
PASS WITH WARNINGS

Review Independence:
PASS

B5 Report Integrity:
PASS

B4 Artifact Integrity:
PASS

P2-01 TCB Boundary:
ACCEPTABLE SERVER TCB / NO REMOTE INJECTION PROVEN

P2-02 Authz Failure Deny:
RUNTIME BLOCKER — SOURCE FIX REQUIRED

P2-03 Evidence Coordinator:
RUNTIME BLOCKER FOR R5-E — COORDINATOR REQUIRED

P2-04 Supervisor Handle Binding:
RUNTIME BLOCKER FOR R5-D — SOURCE FIX REQUIRED

P2-05 Grant ID Uniqueness:
RUNTIME BLOCKER FOR R5-C — SOURCE FIX REQUIRED

P2-06 Test Identity Readiness:
RUNTIME CONFIGURATION BLOCKER — EXACT TEST IDENTITIES REQUIRED

P2-07 Native Test Coverage:
PARTIAL — SUPPLEMENTARY TESTS REQUIRED

P2-08 Revoke / Evidence:
FAIL-CLOSED LIMITATION — CLOSED PATH NOT READY

RR-01 Cross-process Runtime Topology:
BLOCKED — TEST COORDINATION/STATE AND EFFECT WIRING REQUIRED

RR-02 Launch Ticket Lifecycle:
BLOCKED — POST-PREPARE COMMIT/ABORT SOURCE FIX REQUIRED

Native Runtime Topology:
SOURCE PRESENT / NOT EXECUTABLE END-TO-END

Runtime Identity:
NOT READY — PLACEHOLDERS AND FIXTURE ABSENT

RPC Transport:
NOT EXECUTED

Caller Identity:
NOT EXECUTED

Grant / Authorization:
NOT EXECUTED

Restricted Token:
NOT EXECUTED

Job / Handle:
NOT EXECUTED

SEALED / Evidence:
NOT EXECUTED

Runtime Cleanup:
DESIGNED / NOT EXECUTED

PFR Integrity:
PASS

Repository Integrity:
PASS WITH EXISTING DIRTY WORKTREE

Native RPC Runtime:
NOT EXECUTED

Runtime Authorization:
NOT GRANTED

Next Gate:
READY AFTER PRE-RUNTIME SOURCE REMEDIATION
```

This gate result is not Runtime authorization and does not authorize R4-A2.

## 26. Side-Effect Declaration

No source, IDL, generated file, binary, build manifest, static evidence, RPC
endpoint, process, Token, Job, Handle, ACL, DACL, Owner, Registry, PFR, Service,
task, database, Storage or Git state was changed.

No program was started. No Build Script, MIDL, compiler, linker, Server, Client,
Native Test EXE or Helper was executed. No Git write occurred.

## 27. Report Integrity

A file cannot contain its own final SHA-256 without changing that hash. The
external SHA-256 for this frozen report is calculated after the final write and
returned in the stage completion message. No claim is made that a
self-referential digest is embedded above.
