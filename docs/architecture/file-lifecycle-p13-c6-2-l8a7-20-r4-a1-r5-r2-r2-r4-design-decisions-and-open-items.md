# P1-3 C-6.2-L8-A7.20-R4-A1-R5-R2-R2-R4 Design Decisions and Open Items

## 1. Document Status

```text
Stage:
C-6.2-L8-A7.20-R4-A1-R5-R2-R2-R4

Companion to:
file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r5-r2-r2-r4-second-blocking-design-corrections.md

Status:
DESIGN DECISIONS RECORDED / IMPLEMENTATION NOT AUTHORIZED
```

## 2. Closed Decisions

| ID | Decision |
|---|---|
| DD-01 | Manifest, Authorization, Approval, Revocation and Anchor roles use distinct identities/keys |
| DD-02 | Approval Authority is independent of Manifest and Authorization issuers |
| DD-03 | Revocation generation is anchored through a separate Anchor Custodian |
| DD-04 | Runner has no trust-root write or approval capability |
| DD-05 | A dedicated `R5T_TERMINATION_EXECUTOR` is the only OS termination executor |
| DD-06 | Timeout watchdogs can only request termination; they cannot own kill handles |
| DD-07 | Supervisor receives no Job or Process termination Handle before/after commit |
| DD-08 | Termination Executor creates the restricted token, suspended Helper/Job and is the sole Job Handle holder; Launch Authority never receives Token/Process/Job Handle authority |
| DD-09 | Resume API result and Helper RUNNING are distinct states |
| DD-10 | Helper READY uses existing `P13_AUTH_HELPER_REGISTER` operation |
| DD-11 | C26 is Resume Intent; C27 is Resume API Result; C28 is internal Helper Ready |
| DD-12 | C17 permits COMMITTED abort only before Resume/Ready progression |
| DD-13 | R5-R3A remains identity/trust/R5-A driver only |
| DD-14 | D1 v2.0 remains a separate unapproved freeze exception |
| DD-15 | Production remains limited to `P13Invoke` and `P13LaunchInvoke`; `P13TerminationInvoke` is test-only and separately approvable |

## 3. Design Candidates

| Candidate | State | Reason |
|---|---|---|
| Supervisor-only termination | rejected | pre-COMMIT Supervisor lacks safe Handle custody; sharing kill Handles reintroduces dual authority |
| Phase handoff of kill Handles | deferred | possible but has crash/response-loss ownership complexity |
| Dedicated Termination Executor | selected for test design | one process owns all kill-capable Resources; easier to verify |
| TPM monotonic trust anchor | optional future | stronger anti-rollback, not assumed present |
| Independent ECDSA trust keys | selected | separates manifest/auth/approval/revocation/checkpoint roles |
| Dual human approval | deferred | stronger than current test need; no approval infrastructure exists |

## 4. Open Items

| ID | Item | Owner | Required before |
|---|---|---|---|
| OQ-01 | Exact role SIDs and accounts | test provisioning | R5-A |
| OQ-02 | Manifest Issuer public/private key lifecycle | user/security provisioning | R5-R3A Runtime |
| OQ-03 | Authorization Issuer key lifecycle | user/security provisioning | R5-A |
| OQ-04 | Offline Approval Authority key and public-key pin | user/security provisioning | R5-A |
| OQ-05 | Revocation Authority key lifecycle | user/security provisioning | R5-A |
| OQ-06 | Anchor Custodian key and store ACL | user/security provisioning | R5-A |
| OQ-07 | Anchor history backup/restore policy | user/ops | Runtime |
| OQ-08 | Termination Executor SID/DACL | user/security provisioning | R5-D |
| OQ-09 | Termination Executor handle-bind protocol | R5-R3C implementer | R5-D |
| OQ-10 | Helper Ready challenge delivery | R5-R3C implementer | R5-D |
| OQ-11 | Launch v2 final IDL fields and names | R5-R3C designer | D1 approval |
| OQ-12 | Exact MIDL/NDR wire sizes | R5-R3C Build-only | Runtime |
| OQ-13 | Windows Job/Terminate/Resume behavior | R5-D/E Runtime | production |
| OQ-14 | Coordinator endpoint identity | R5-R3B implementer | R5-C |

## 5. User Approvals Required

| Approval | Scope |
|---|---|
| Trust role identities and key custody | R5-A |
| Runtime Authorization/Approval hashes | R5-A |
| Anchor Custodian ACL and rollback limitations | R5-A |
| Termination Executor test-only architecture | R5-D |
| D1-FREEZE-EXCEPTION-R5-LAUNCH-V2 | R5-R3C/D/E |
| R5-R3A Build-only source scope | before implementation |
| Any Native Runtime execution | after Build-only review |

## 6. Not Implemented

```text
Trusted role signing
Approval signature verification
Anchor Custodian
Termination Executor
Helper Ready handshake
C25-C28
Launch v2 IDL/result
Process/Job/Handle runtime changes
Evidence Coordinator
ACL/SEALED runtime changes
R5-R3A source/build
R5-A Runtime
```

## 7. Not Verified

```text
CNG ECDSA verification behavior:
NOT VERIFIED

Trust root ACL/read-only behavior:
NOT VERIFIED

Revocation backup rollback resistance:
NOT VERIFIED — administrator outside guarantee

KILL_ON_JOB_CLOSE last-handle behavior:
NOT VERIFIED

Job handle uniqueness:
NOT VERIFIED

Termination executor crash/hang:
NOT VERIFIED

ResumeThread result and Helper Ready:
NOT VERIFIED

NDR/wire size:
NOT VERIFIED

Windows Process/Token/SID/Session behavior:
NOT VERIFIED
```

## 8. Threat Model Boundary

The following can invalidate the design's guarantees:

- local/domain administrator;
- kernel compromise;
- backup/restore operator restoring an older complete trust tree;
- compromised trust private keys;
- malicious replacement of the Runtime binary before hash verification;
- malicious host device or test storage;
- compromise of the Termination Executor or Supervisor TCB.

The design does not claim protection against those actors.

## 9. Not Part of R5-R3A

- Trust Authority runtime services;
- Anchor Custodian;
- Termination Executor;
- Coordinator C25-C28;
- Helper Ready handshake;
- Launch v2;
- Process/Job/Handle lifecycle;
- NTFS test operations;
- ACL/SEALED;
- Evidence/Revoke runtime.

## 10. Final Checklist

- [x] Trust authorship/approval/revocation/anchor separated by design
- [x] Independent revocation anchor specified
- [x] Single OS termination executor specified
- [x] Dual watchdog request-only boundary specified
- [x] Resume API vs Helper RUNNING separated
- [x] C17 and state diagram reconciled
- [x] R5-R3A exact scope expanded and annotated
- [x] D1 v2 remains unapproved
- [ ] Trust roles configured
- [ ] Anchor Custodian implemented
- [ ] Termination Executor implemented
- [ ] R5-R3A implemented
- [ ] Runtime verified

## 11. Side Effects

Only this companion file and the main R5-R2-R2-R4 correction report were added.
No source, build, Windows identity, ACL, PFR, database, Storage, process or Git
state was changed.
