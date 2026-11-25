# P1-3 C-6.2-L8-A7.20-R4-A1-R5-R2-R2-R2 Design Decisions and Open Items

## 1. Document Status

```text
Stage:
C-6.2-L8-A7.20-R4-A1-R5-R2-R2-R2

Companion to:
file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r5-r2-r2-r2-blocking-design-corrections.md

Status:
DESIGN DECISIONS RECORDED / IMPLEMENTATION NOT AUTHORIZED
```

This document separates:

- closed design questions;
- remaining open questions;
- trust assumptions;
- decisions requiring separate user approval;
- items intentionally outside R5-R3A;
- capabilities not implemented or verified.

## 2. Closed Design Questions

| ID | Decision | Status |
|---|---|---|
| DD-01 | Fixed trust root is `C:\ProgramData\P13\R5\Trust\v1` | CLOSED AT DESIGN |
| DD-02 | Trust root cannot be overridden by Runner CLI/environment | CLOSED AT DESIGN |
| DD-03 | Manifest has no self-digest | CLOSED AT DESIGN |
| DD-04 | Approval record is separate from Manifest and Authorization | CLOSED AT DESIGN |
| DD-05 | Revocation generation uses separate append-only baseline history | CLOSED AT DESIGN |
| DD-06 | Coordinator adds C25 `BEGIN_STOP` | CLOSED AT DESIGN |
| DD-07 | `CLOSE_RUN` is STOPPING-only | CLOSED AT DESIGN |
| DD-08 | Coordinator adds C26 `RESUME_RESULT` | CLOSED AT DESIGN |
| DD-09 | `COMMITTED` does not imply `RUNNING` | CLOSED AT DESIGN |
| DD-10 | One termination owner per launch phase | CLOSED AT DESIGN |
| DD-11 | Stale watchdog generation cannot terminate | CLOSED AT DESIGN |
| DD-12 | Kernel Handles are never reconstructed from records | CLOSED AT DESIGN |
| DD-13 | Launch v2 result includes deadline, epoch, owner and watchdog fields | CLOSED AT DESIGN |
| DD-14 | Launch v2 x64 memory layout is 256 bytes | CLOSED AT DESIGN |
| DD-15 | Conservative wire budget is 21592, below 24576 | CLOSED AT DESIGN |
| DD-16 | R5-R3A includes `CallerExpectation` and `SameIdentity` changes | CLOSED AT DESIGN |
| DD-17 | R5-R3A excludes Coordinator, Launch v2, process, ACL and Evidence | CLOSED AT DESIGN |
| DD-18 | D1 v2 is a separate unapproved freeze exception | CLOSED AT DESIGN |

## 3. Open Questions

| ID | Question | Current state | Required owner/action |
|---|---|---|---|
| OQ-01 | Exact Windows SIDs for all R5 test identities | not available | future identity provisioning + user approval |
| OQ-02 | Exact Windows Session IDs and Logon SIDs | not available | future controlled test-session creation + approval |
| OQ-03 | Exact Trust Authority account/group SIDs and ACL | design only | future ACL fixture authorization |
| OQ-04 | Exact Runtime Authorization hash | not generated | after identities/binaries are provisioned |
| OQ-05 | Initial revocation baseline revision and digest | not generated | Trust Authority + user approval |
| OQ-06 | Exact real `sizeof`/offsetof and MIDL NDR sizes | design estimate only | R5-R3C Build-only |
| OQ-07 | SafeNtfsRoot `NtCreateFile`/Handle-relative implementation details | design only | R5-R3B implementation + review |
| OQ-08 | Durable test metadata backend schema and role | design only | separate DB/test infrastructure authorization |
| OQ-09 | R5-R3A build script content and hashes | not created | R5-R3A Build-only |
| OQ-10 | Exact executable hashes after R5-R3A | not produced | R5-R3A Build-only |
| OQ-11 | Runtime behavior of Authz/Tokens/Jobs/Handles/ACLs | not verified | later Runtime stages |
| OQ-12 | Initial PID-to-process-open race behavior | design warning | R5-B Runtime fault tests |
| OQ-13 | R5-D/E Coordinator/Helper function evidence | not implemented | R5-R3B/C/D |
| OQ-14 | Production PostgreSQL Grant/Evidence behavior | out of harness | future separately reviewed phase |

## 4. Design Assumptions

1. Windows x64 is the only Native RPC target.
2. Local `ncalrpc` provides the RPC call PID/principal facts relied upon by the
   design.
3. `C:\ProgramData\P13\R5\Trust\v1` can be provisioned as a non-reparse,
   protected local NTFS trust root outside Runner write access.
4. The user explicitly approves the exact Manifest, Runtime Authorization,
   binary hashes and revocation generation before R5-A.
5. The Test Runner is part of the test TCB for the exact command it launches;
   this design prevents accidental path selection, not a malicious host
   administrator.
6. R5-C mock tests may use an in-memory Coordinator only for state-machine
   semantics; crash recovery requires the future durable backend.
7. R5-D/E real process/ACL/Evidence tests require separately approved Windows
   identities and isolated NTFS fixtures.
8. D1 v1.0 remains frozen until a user-approved exception is recorded.

## 5. User Approvals Required

| Approval | Required before |
|---|---|
| R5-R2-R2-R2 independent design acceptance | R5-R3A authorization |
| Exact R5-R3A file/output scope | R5-R3A Build-only |
| Test identity/provisioning plan | R5-R3A Runtime config |
| Exact Runtime Authorization hashes | R5-A Runtime |
| D1-FREEZE-EXCEPTION-R5-LAUNCH-V2 | R5-R3C source/IDL changes |
| Isolated metadata backend | R5-D/E Runtime recovery |
| Isolated NTFS fixture/ACL plan | R5-E |
| Any R5-A Native execution | separate Runtime authorization |

## 6. Not Part of R5-R3A

The following are explicitly excluded:

- Test State Coordinator;
- SafeNtfsRoot implementation;
- Grant/Ticket/Launch transaction implementation;
- Launch v2 IDL or generated stubs;
- PinnedProcessIdentity;
- Process/Token/Job/Handle APIs;
- Revoke Orchestrator;
- Evidence Coordinator;
- DACL/Owner Rights/AccessCheck;
- real Storage/DB;
- Helper process creation;
- Native Runtime tests.

## 7. Not Implemented

```text
Runtime Identity Manifest loader:
NOT IMPLEMENTED

Runtime Authorization/Revocation verifier:
NOT IMPLEMENTED

Identity fail-closed source changes:
NOT IMPLEMENTED

Coordinator C25/C26:
NOT IMPLEMENTED

Single Termination Authority persistence:
NOT IMPLEMENTED

Launch v2:
NOT IMPLEMENTED

R5-R3A build outputs:
NOT PRODUCED
```

## 8. Not Verified

```text
Token/Authz runtime behavior:
NOT VERIFIED

Windows Session/Logon SID binding:
NOT VERIFIED

Fixed trust-root ACL/reparse behavior:
NOT VERIFIED

Launch v2 NDR/wire size:
NOT VERIFIED

SafeNtfsRoot TOCTOU/reparse/hard-link behavior:
NOT VERIFIED

Process/Job/Handle termination:
NOT VERIFIED

Protected DACL/SEALED:
NOT VERIFIED

Cross-process Evidence/Revoke:
NOT VERIFIED

PFR/protected-object read-only baseline:
PASS AT STAGE START
```

## 9. Final Checklist

- [x] Manifest trust root separated from Runner command input
- [x] Revocation generation has an independent append-only baseline
- [x] Coordinator RUNNING/STOPPING transition defined
- [x] Coordinator resume result defined
- [x] Single phase-scoped termination owner defined
- [x] Watchdog lease/generation/CAS defined
- [x] v2 result includes required recovery fields
- [x] x64 memory layout recalculated
- [x] conservative wire budget recalculated
- [x] R5-R3A includes `CallerExpectation`, Logon SID and `SameIdentity`
- [x] D1 v2 remains a separate unapproved exception
- [ ] R5-R3A source implemented
- [ ] R5-R3A Build verified
- [ ] Runtime approved

## 10. Side Effects

Only this companion document and the main R5-R2-R2-R2 report were added. No
source, build artifact, system identity, ACL, process, RPC endpoint, PFR,
database, Storage or Git index was changed.
