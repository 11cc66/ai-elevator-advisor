# P1-3 C-6.2-L8-A7.20-R4-A1-R5-R2-R2-R6 Design Decisions and Open Items

## 1. Status

```text
Status:
DESIGN DECISIONS RECORDED / IMPLEMENTATION NOT AUTHORIZED

Companion:
file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r5-r2-r2-r6-third-blocking-design-corrections.md
```

## 2. Closed Decisions

| ID | Decision |
|---|---|
| DD-01 | One SCM-managed test TCB service is split into Host and Executor Worker |
| DD-02 | Only Worker may hold Helper termination Handles or call terminate APIs |
| DD-03 | Host owns one append-only durable Transaction Ledger |
| DD-04 | Host persists Intent and Permit before OS effects |
| DD-05 | Worker supplies signed Effect/Handle evidence; independent Observer supplies process evidence |
| DD-06 | Transaction Ledger is test-only and does not use the project database |
| DD-07 | P13TerminationInvoke is a separate test-only interface, never production RPC |
| DD-08 | TrustedKeySet has separate pinned Trust Root and Approval Root |
| DD-09 | TrustedKeySet, canonical JSON, Bundle and Ready validators are in R5-R3A |
| DD-10 | Bundle requires Host authorization and Worker local Handle attestation |
| DD-11 | Bundle IDs never encode or restore raw Handle numbers |
| DD-12 | Challenge uses inherited private pipes, never argv/environment/logs |
| DD-13 | Control Server uses RPC PID plus query-only Process Handle and creation time |
| DD-14 | C29/C30 provide an explicit Bootstrapping timeout termination path |
| DD-15 | After Resume dispatch, ABORT_PENDING is forbidden |
| DD-16 | R5-R3A does not include Host, Worker, Coordinator, challenge runtime or P13TerminationInvoke implementation |
| DD-17 | D1 v1.0 remains frozen and D1 v2.0 remains unapproved |

## 3. Proposed Test-only IDs

```text
P13Termination interface UUID:
290671B9-D13F-4449-A87E-DDBBD8A46A32

Version:
1.0

Manager:
P13TerminationInvoke

Endpoint:
p13-r5-termination-v1

IDL path:
tools/native-rpc/p13-a1-r2/idl/test/p13_termination.idl
```

This value was not found in the repository or reviewed historical inputs. It
is a proposal and requires user approval.

## 4. User Approvals Required

| Approval | Scope |
|---|---|
| Test TCB service architecture | Host/Worker/service identity and DACLs |
| P13TerminationInvoke UUID/version | separate test-only IDL |
| TrustedKeySet RootTrustPin | root public keys and fingerprints |
| TrustedKeySet production key set | operational keys and approval |
| Launch v2 D1 exception | typed result only |
| R5-R3A Build-only source scope | compile-only source/objects |
| Any service or Runtime execution | after separate review |
| Any `$null` disposition | exact file deletion or quarantine |

## 5. Future Build-only

| Item | Required evidence |
|---|---|
| TrustedKeySet parser/signatures | TKS tests + schema hashes |
| Canonical JSON | CJ vectors and strict duplicate/unknown-field tests |
| Bundle contract | HBC signature/replay/object-binding tests |
| Helper Ready contract | HRC challenge/PID/session tests |
| Identity fail-closed | IFC tests |
| R5-R3A static scope | source/object/EXE/manifest exact map |
| Production separation | scan for P13TerminationInvoke absence |
| NDR budget | MIDL-generated request/response measurements |

No Build is executed in this stage.

## 6. Future Runtime Verification

```text
Service DACL and SCM rights
Service SID token contents
Host image Authenticode + approved signer + exact hash
Worker image verification
DLL dependency and search-order hardening
Host/Worker singleton and restart
Ledger fsync/rename/CAS/crash recovery
Intent before effect
Worker-only termination authority
Process/Job handle masks and closure
Observer Process-Signaled evidence
Bundle live object binding
Challenge pipe inheritance and consumption
Control Server RPC PID / creation time / token binding
Ready versus timeout CAS race
KILL_ON_JOB_CLOSE last-Handle behavior
```

All remain `NOT VERIFIED`.

## 7. Future R5-R3B Dependencies

- Coordinator endpoint UUID/version/Manager.
- Final Coordinator identity and endpoint DACL.
- Exact production approval of R5-R3A trust data.
- Host/Worker service installation identity.
- Challenge delivery implementation.
- Control Server-to-Host private operation.
- D1 exception decision for Launch v2.
- Runtime authorization and Native test orchestration.

These are not required to compile the pure R5-R3A validators.

## 8. Unresolved Items

| Item | State | Required before |
|---|---|---|
| Exact Service SID/SDDL provisioning | NOT CONFIGURED | Test TCB Runtime |
| RootTrustPin real public keys | NOT APPROVED | R5-A Runtime |
| P13TerminationInvoke UUID | PROPOSED / NOT APPROVED | Test IDL implementation |
| Host transaction Ledger implementation | NOT IMPLEMENTED | Test TCB Runtime |
| Bundle signing private keys | NOT CONFIGURED | Bundle Runtime |
| Challenge pipe implementation | NOT IMPLEMENTED | Ready Runtime |
| Control Server Process Handle adapter | NOT IMPLEMENTED | R5-C |
| Launch v2 D1 exception | NOT APPROVED | R5-R3C/D/E |
| R5-R3A source/build | NOT IMPLEMENTED | Build-only |

## 9. Awaiting Independent Review

- Host/Worker split and Service/Process/File ACL model.
- Host-only Ledger and Permit/Evidence protocol.
- P13TerminationInvoke UUID/build isolation proposal.
- TrustedKeySet roots/schema and generation model.
- Bundle dual-signature and live-object attestation.
- Challenge pipe and Control Server Process Handle flow.
- Complete C01-C33 and C17 transition matrix.
- R5-R3A source-to-object mapping.

## 10. Threat Model Exclusions

The design does not claim protection against:

- Host Administrator replacing the service or its ACL;
- local/domain administrator with equivalent access;
- kernel compromise;
- revocation of the pinned Root/Approval keys without a new approved build;
- compromise of Host or Worker TCB;
- full-host backup restoring both Ledger and Anchor;
- malicious hardware or hypervisor;
- compromise of a signing key accepted as currently valid until revocation is
  anchored.

## 11. Not Implemented

```text
Host/Worker service and binaries
Service SID/DACL/installation
Transaction Ledger
P13TerminationInvoke IDL
TrustedKeySet parser and production data
Bundle signer/object table
Challenge pipe
Control Server Process Handle
R5-R3A source
Launch v2
Native tests
Runtime
```

## 12. Not Verified

```text
Windows service security
Authenticode verification and revocation
WinVerifyTrust availability
Service SID token composition
Handle inheritance list
PROCESS_DUP_HANDLE denial
Job last-handle fallback
Delete-on-close/atomic Ledger behavior
Process Creation Time and PID reuse
NDR sizes
Runtime failure paths
```

## 13. `$null` Baseline

```text
D:\thinkbook\Desktop\jieya\$null
PRESENT / regular / 65 bytes at final check / untracked / CHANGED

Review-start length:
0

Final SHA-256:
42BD6E835C6EC8DCCE7454BCCA9C4F3AD94AF783BFE7D2D2CAA7609B0AEF77BB

D:\thinkbook\Desktop\jieya\$null)
ABSENT
```

The content was not inspected. No restoration, deletion, move, rename or Git
add is authorized. The baseline gate fails until the user separately reviews
this drift.

## 14. Final Checklist

- [x] Host/Worker TCB split designed
- [x] Service/Process/File ACL matrix designed
- [x] Worker unique termination authority designed
- [x] Durable Intent/Permit/Effect/Evidence protocol designed
- [x] Crash-recovery table designed
- [x] Test-only RPC identity and build isolation proposed
- [x] TrustedKeySet schema and lifecycle designed
- [x] Bundle protocol designed
- [x] Challenge and Control Server identity designed
- [x] Bootstrap timeout state fixed
- [x] C01-C33 / C17 matrix reconciled
- [x] R5-R3A exact source list expanded
- [x] D1 v1 frozen
- [ ] Protected `$null` remained unchanged — FAILED
- [ ] User approval of TCB
- [ ] User approval of TrustedKeySet roots
- [ ] Build-only execution
- [ ] Runtime verification
