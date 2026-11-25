# P1-3 C-6.2-L8-A7.20-R4-A1-R5-R2-R2-R8 Design Decisions and Open Items

## 1. Document Status

```text
Stage:
C-6.2-L8-A7.20-R4-A1-R5-R2-R2-R8

Status:
DESIGN CORRECTION COMPLETE / STAGE BLOCKED BY BASELINE DRIFT / IMPLEMENTATION NOT AUTHORIZED

Companion:
file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r5-r2-r2-r8-fourth-blocking-design-corrections.md
```

## 2. Closed Decisions

| ID | Decision |
|---|---|
| DD-01 | Host and Worker are two separate SCM services |
| DD-02 | Host and Worker have separate virtual service accounts and Service SIDs |
| DD-03 | Host cannot stop, pause, reconfigure, delete or terminate Worker |
| DD-04 | Host cannot close a Helper Job Handle |
| DD-05 | Worker is the only Helper/Job termination executor |
| DD-06 | Worker retrieves Host Permits through an authenticated pull protocol |
| DD-07 | Host remains the sole Ledger writer |
| DD-08 | A separate Anchor Custodian signs and owns the Ledger Head anchor |
| DD-09 | Host cannot CLOSED without Anchor confirmation |
| DD-10 | Bundle preimage includes Key Set Generation and both signing Key IDs |
| DD-11 | Host and Worker sign Bundle facts with separate key usages |
| DD-12 | One anonymous pipe carries the Challenge |
| DD-13 | Only Challenge read endpoint is inheritable |
| DD-14 | Challenge write endpoint remains non-inheritable |
| DD-15 | Control Server uses RPC PID plus query-only Process Handle |
| DD-16 | C01-C33 matrix records Grant, Generation, Revision and all side effects |
| DD-17 | R5-R3A contains pure KeySet/Bundle/Ready contracts only |
| DD-18 | R5-R3A does not implement Host/Worker, Ledger, Anchor or test RPC |
| DD-19 | D1 v1.0 remains frozen |
| DD-20 | D1 v2.0 remains unapproved |
| DD-21 | `$null` remains an exact metadata-only baseline exception |
| DD-22 | C34 records Worker-observed Host custody loss without termination |

## 3. Rejected Alternatives

| Alternative | Reason |
|---|---|
| Host-created Worker child | shared Host SID and required Host process control |
| Host `PROCESS_TERMINATE` on Worker | creates indirect Helper termination via Job close |
| Host-held Helper Job Handle | violates unique termination executor |
| Worker read/write Ledger | lets termination executor rewrite state |
| Host-only unanchored Ledger | cannot detect coherent Host rollback |
| `KILL_ON_JOB_CLOSE` as normal termination | lacks transaction/permit/evidence chain |
| Mutable or named anonymous pipe | ownership and inheritance ambiguity |
| String concatenation Bundle preimage | non-canonical signature ambiguity |
| Bundle without Key Set Generation | old-key replay across rotation |
| New production RPC Manager | expands frozen D1 v1.0 surface |

## 4. Proposed Test-only IDs

```text
Interface:
P13Termination

UUID:
290671B9-D13F-4449-A87E-DDBBD8A46A32

Version:
1.0

Manager:
P13TerminationInvoke

Endpoint:
p13-r5-termination-v1

IDL:
tools/native-rpc/p13-a1-r2/idl/test/p13_termination.idl
```

User approval is required before creating or compiling this interface.

## 5. User Approvals Required

| Approval | Scope |
|---|---|
| Host/Worker independent service identities | install/SCM/service ACL design |
| P13TerminationInvoke UUID/version | test-only interface |
| Ledger Head Anchor identity/key | test TCB |
| TrustedKeySet root/key material and usages | R5-A Runtime |
| Bundle signing/attestation keys | test TCB |
| R5-R3A Build-only exact source/schema set | compile-only |
| D1-FREEZE-EXCEPTION-R5-LAUNCH-V2 | typed Launch result only |
| Any Runtime execution | after Build-only review |
| `$null` disposition | separately retained exception |

## 6. Unresolved Items

| Item | State | Required before |
|---|---|---|
| Host/Worker service installation | NOT CREATED | TCB Runtime |
| Exact service SDDL and account SIDs | NOT CONFIGURED | TCB Runtime |
| Ledger Head Anchor service/key | NOT CONFIGURED | TCB Runtime |
| Worker pull protocol implementation | NOT IMPLEMENTED | TCB Runtime |
| Bundle canonical encoder | NOT IMPLEMENTED | R5-R3A Build-only |
| Challenge pipe implementation | NOT IMPLEMENTED | Coordinator Runtime |
| Control Server Process Handle adapter | NOT IMPLEMENTED | R5-C |
| Launch v2 IDL | NOT IMPLEMENTED | D1 approval |
| R5-R3A source | NOT IMPLEMENTED | Build-only |

## 7. Awaiting Independent Review

- Separate Host/Worker service/process/file DACL model.
- Termination Authority matrix.
- Ledger Head Anchor design.
- Complete C01-C33 authorization matrix.
- Bundle canonical preimage and key rotation.
- Anonymous Challenge pipe inheritance.
- Exact R5-R3A source/object/output scope.
- D1 v1/v2 boundary.

## 8. Build-only Verification Requirements

```text
All R5-R3A source hashes
Canonical JSON vectors
TrustedKeySet signature/usage vectors
Bundle key-set generation/key-ID vectors
Helper Ready transaction/process binding vectors
Exact object/EXE/manifest inventory
No P13TerminationInvoke in production objects/binaries
No D1 v2 symbols in R5-R3A
NDR size measurement
PFR/B1/B4/protected baselines
```

Build-only tests must not launch any EXE.

## 9. Runtime Verification Requirements

```text
Service Object and Process DACL enforcement
Separate service SIDs and token groups
Host cannot terminate Worker
Worker can create restricted Helper
Only Worker has Helper/Job termination
Intent before Effect
Ledger append and Anchor recovery
Host/Worker crash windows
Bundle rotation/revocation
Challenge pipe inheritance/no unrelated inheritance
Control Server RPC PID + Handle identity
Ready/timeout CAS
KILL_ON_JOB_CLOSE fallback
```

All remain `NOT EXECUTED`.

## 10. Threat Model Exclusions

The design does not claim protection against:

- local or domain Administrator;
- kernel or hypervisor compromise;
- installed Host/Worker binary replacement by Administrator;
- service configuration or DACL changes by Administrator;
- full-host backup restoring both Ledger and Anchor;
- compromise of signing private keys that are still anchored as valid;
- compromise of Host or Worker TCB;
- unauthorized external process termination by a higher-privileged actor.

The independent Ledger Head Anchor detects Host history rollback within the
non-Administrator threat model; it cannot make a compromised Host truthful
about future actions.

## 11. Not Implemented

```text
Host service
Worker service
Service identities and DACLs
Process/restricted token changes
Transaction Ledger
Ledger Head Anchor
P13TerminationInvoke IDL
Bundle encoder/verifier
Challenge pipe
Control Server identity adapter
R5-R3A source
R5-R3A Build
D1 v2.0
Native Runtime
```

## 12. Not Verified

```text
Windows AccessCheck behavior for final DACLs
Service SCM AC1/SACL behavior
Host-can-start-worker-only behavior
No-Host-Worker-terminate behavior
Restricted Helper token behavior
Anonymous pipe inheritance
Process Creation Time and PID reuse
Bundle rotation enforcement
Ledger/Anchor durability and rollback
RPC caller identity
NDR sizes
Runtime failure paths
```

## 13. Baseline Exception

```text
ID:
APPROVED-BASELINE-EXCEPTION-R6-NULL-001

Path:
D:\thinkbook\Desktop\jieya\$null

Size:
65 bytes

CreationTimeUtc:
2026-11-21T21:30:32.1057744Z

LastWriteTimeUtc:
2026-11-21T22:36:19.4167564Z

Contents:
NOT READ IN R8

Hash:
HISTORICAL BV1 VALUE ONLY / NOT RECALCULATED

Disposition:
KEEP

Status:
PENDING NEW FORENSIC REVIEW — LASTWRITE SCOPE INVALIDATED
```

`$null'` and `$null()` are absent.

An R8 stale-text command was accidentally routed through Bash to
`cmd.exe /c ... 2>$null`, changing LastWriteTime at
`22:36:19.4167564Z`. No repair was attempted.

## 14. Final Checklist

- [x] Host/Worker service identities separated
- [x] Host indirect termination removed
- [x] Worker-only Termination Authority matrix complete
- [x] Ledger Head Anchor added
- [x] Bundle key-set generation/key IDs added
- [x] Challenge pipe inheritance fixed
- [x] One-pipe resource table defined
- [x] C01-C33 authorization matrix completed
- [x] R5-R3A exact scope revised
- [x] D1 v1.0 frozen
- [ ] Protected `$null` remained unchanged — FAILED
- [ ] User approval of test TCB
- [ ] Build-only verification
- [ ] Runtime verification
- [ ] Independent `$null` disposition review
