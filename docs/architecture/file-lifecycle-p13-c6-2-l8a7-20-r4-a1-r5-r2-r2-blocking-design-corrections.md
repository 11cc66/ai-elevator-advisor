# P1-3 C-6.2-L8-A7.20-R4-A1-R5-R2-R2 Blocking Design Corrections

## 0. Executive Result

```text
Stage:
C-6.2-L8-A7.20-R4-A1-R5-R2-R2

Date:
2026-11-22

Mode:
READ-ONLY DESIGN CORRECTION

Overall:
PASS WITH WARNINGS — READY FOR INDEPENDENT REVIEW

R5-R2-R1 Report Integrity:
PASS — SHA-256 MATCH

DR-01 Manifest Trust Root:
CORRECTED

DR-02 Test Coordinator Authority/Confinement:
CORRECTED

DR-03 Launch PREPARE Custody/Recovery:
CORRECTED

DR-04 Launch v2 Contract:
FROZEN BY DESIGN

DR-05 R5-R3 Scope:
CORRECTED AND SPLIT

Source / Build / Runtime Changes:
NONE

R5-R3 Authorization:
NOT GRANTED

R5-A Authorization:
NOT GRANTED
```

This correction keeps the strong parts of R5-R2 and closes the five blocking
design gaps. It also redefines the next implementation stage as R5-R3A only:
Identity, trusted Runtime configuration and the minimal R5-A driver.

R5-R3B/C/D remain separate future Build-only scopes. This report does not
authorize them.

## 1. Authorization and Non-actions

This stage created only this design correction document.

It did not:

- modify source, IDL, generated files, Build Script, tests or manifests;
- execute MIDL, MSVC, Linker, Build Script or MSBuild;
- run any Native RPC executable;
- register or bind an RPC endpoint;
- create, terminate or manipulate a process, Token, Job or Handle;
- create or modify Windows accounts, SIDs, Sessions, ACLs, DACLs or Owners;
- modify Registry or PendingFileRenameOperations;
- access a database, SQL, Migration or real Storage;
- read `.env`, `.env.test`, credentials or secrets;
- perform a Git write.

## 2. Skills and Authoritative Inputs

The following Skills were actually read and applied:

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

The complete review also used:

- R5-R1;
- R5-R2;
- R5-R2-R1;
- B3, B4 and B5;
- D1;
- applicable R4-S5 through R4-S11 design sections;
- current IDL, current source, tests and build manifests.

## 3. Baseline and Integrity

### 3.1 Repository baseline

```text
Repository:
D:\thinkbook\Desktop\jieya

Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

Tracked modified:
26

Untracked before this correction:
236

Staged:
0

Deleted:
0
```

### 3.2 Required report hash

| Report | Expected | Actual | Result |
|---|---|---|---|
| R5-R2-R1 | `575FCF2037C15A8F1C10A290787430156B49DC480910F4B20F4E379CEF9D7B93` | `575FCF2037C15A8F1C10A290787430156B49DC480910F4B20F4E379CEF9D7B93` | PASS |
| R5-R2 | `66800DA25E21C954E00BD36A86F2989C56FAB2856DB506D99F258C58BA722B3D` | `66800DA25E21C954E00BD36A86F2989C56FAB2856DB506D99F258C58BA722B3D` | PASS |
| R5-R1 | `B09A3696F4E4E27C9A2F3CD9C5741E14388553C3AD4F174BB992268EC8DEDAEF` | `B09A3696F4E4E27C9A2F3CD9C5741E14388553C3AD4F174BB992268EC8DEDAEF` | PASS |

### 3.3 B1/B4 preservation

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
| Native Tests | 591872 | `AA2636BE8B53E26E79131E2C17FC863A6792D99976C01ED3A76EA7B5AF7EF3FA` | MATCH |
| Build Manifest | 12447 | `58ED3EAFF2498AFA44D4E1D92FD2CA43DD86CBA57E5E7B93B4B97204E8B79774` | MATCH |
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
REG_MULTI_SZ
46 strings
23 DELETE
SHA-256:
0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC
```

PFR-020 through PFR-023 remain `UNAPPROVED / NOT INCLUDED IN ANY EXCEPTION`.

`$null` and `$null)` are absent. No `p13_native*` process is running.

## 4. Blocking Correction Summary

| Review finding | Correction | Result |
|---|---|---|
| DR-01 Manifest trust | Fixed-hash approval plus protected independent authorization/version baseline | CLOSED AT DESIGN |
| DR-02 Coordinator authority | Exact command/actor/phase/object matrix; internal-only terminal operations | CLOSED AT DESIGN |
| DR-02 NTFS confinement | Shared safe-root contract enforced independently by Coordinator and Helper | CLOSED AT DESIGN |
| DR-03 PREPARE custody | PREPARING record before spawn; dual timeout watchdogs; explicit Handle ownership | CLOSED AT DESIGN |
| DR-04 Launch v2 | Same UUID, Version 2.0, one Manager, fixed typed result and wire budget | CLOSED AT DESIGN |
| DR-05 R5-R3 scope | Next stage narrowed to R5-R3A; B/C/D split with exact future scopes | CLOSED AT DESIGN |

## 5. Runtime Identity Manifest Trust Root

### 5.1 Options

| Option | Strengths | Problems | Decision |
|---|---|---|---|
| User-approved fixed SHA-256 plus independent authorization record | simple; explicitly user-approved; no self-approval; aligns with staged approvals | requires protection of the authorization record and regeneration on Session changes | SELECTED |
| Independent signed Manifest | strongest offline authenticity | requires test signing key, certificate lifecycle and signature verification infrastructure not yet approved | deferred |
| Protected independent config/version baseline | can be integrated with deployment ACLs | insufficient alone unless the approval hash is separated and approved | USED AS STORAGE/ACL COMPONENT |

Selected combination:

```text
user-approved fixed SHA-256
+ protected independent authorization record
+ immutable version/revision baseline
```

### 5.2 Artifacts

#### Identity Manifest

`runtime-identity-manifest.json` contains only configuration:

```json
{
  "schemaVersion": 1,
  "runId": "opaque-uuid",
  "identities": [
    {
      "logicalName": "R5T_WEB",
      "authorityId": "guid",
      "principalClass": "WEB_SERVICE",
      "tokenUserSid": "S-1-...",
      "normalGroupSid": "S-1-...",
      "restrictingSid": null,
      "requiredIntegrityRid": 8192,
      "allowedLogonSids": ["S-1-5-5-X-Y-Z"],
      "allowedWindowsSessionIds": [1],
      "authorityEpoch": 1
    }
  ],
  "endpoints": {
    "authority": "p13-authority-v1",
    "launchStaging": "p13-launch-staging-v1",
    "launchPublisher": "p13-launch-publisher-v1",
    "launchSealer": "p13-launch-sealer-v1",
    "launchCleanup": "p13-launch-cleanup-v1",
    "testCoordinator": "p13-r5-test-coordinator-v1"
  },
  "interfaceSddl": "..."
}
```

The manifest contains no digest field.

#### Runtime Authorization

`runtime-authorization.json` is a different file:

```json
{
  "schemaVersion": 1,
  "authorizationId": "opaque-uuid",
  "approvalReference": "user-approval-record-id",
  "runId": "same-run-id",
  "phase": "R5-A",
  "manifestSha256": "64-hex",
  "serverExeSha256": "64-hex",
  "clientExeSha256": "64-hex",
  "testRunnerSha256": "64-hex",
  "runRootBinding": {
    "volumeSerialNumber": "hex",
    "rootFileId": "hex",
    "rootDaclDigest": "64-hex",
    "rootOwnerSid": "S-1-...",
    "canonicalPath": "absolute-test-only-path"
  },
  "allowedWindowsSessionIds": [1],
  "issuedAtUtc": "timestamp",
  "expiresAtUtc": "timestamp",
  "revocationGeneration": 0
}
```

The authorization file also contains no self-hash.

#### User approval record

The user's phase authorization records:

```text
authorizationId
SHA-256(runtime-authorization.json)
approved phase
approved expiry
approval revision
```

### 5.3 Trust chain

```text
controlled test-host provisioning
  -> identity manifest
  -> compute Manifest SHA-256

user reviews exact Manifest and binary hashes
  -> creates explicit Runtime authorization
  -> computes Runtime authorization SHA-256

Runtime command
  -> receives expected authorization SHA-256 from user approval
  -> reads authorization from protected directory
  -> verifies authorization hash before parsing
  -> verifies Manifest SHA-256 and binary hashes
  -> verifies actual TokenUser/group/restricted/integrity/Session/SDDL
```

### 5.4 Protection and trust assumptions

- The manifest and authorization directory are read-only to `R5T_RUNNER`,
  `R5T_WEB`, `R5T_WORKER`, Helpers and Launch Authorities.
- Only the separately approved test provisioner can write a new version.
- The Test Runner cannot write either file.
- The Server/Client compare the authorization SHA before parsing it.
- The user approval record is outside the two JSON files.
- The Test Runner is still test TCB for the exact command it launches. It may
  withhold, alter or replace the command before OS startup. The design does not
  claim OS protection from a malicious Runner; preflight and post-run evidence
  must detect command substitution.
- A fully compromised test administrator/host is outside the guarantee.

### 5.5 Update and revocation

- Update is append-only: a new `authorizationId` and file version are created.
- Existing manifest/authorization files are not overwritten.
- Any identity, binary, Session or run-root change invalidates the old
  authorization.
- `revocationGeneration` increases on revocation; old generations are refused.
- Expired authorization fails before endpoint registration.
- A changed Windows Session requires a regenerated manifest and new user hash
  approval.

### 5.6 Token checks

The runtime must independently verify:

- actual TokenUser binary SID equals Manifest;
- required normal group is enabled and not deny-only;
- restricted Helper has the expected restricting SID;
- integrity RID equals Manifest;
- Windows Session is allowed by the authorization;
- Logon SID is allowed by the identity record when bound to a Session;
- Authz User/Groups/Restricted SIDs agree with the process-token evidence.

None of the placeholder SIDs or `{0,1,2}` remain authoritative.

### 5.7 Fail-closed matrix

| Failure | Result |
|---|---|
| missing manifest/authorization | no endpoint |
| expected authorization hash mismatch | no endpoint |
| manifest hash mismatch | no endpoint |
| executable hash mismatch | no endpoint |
| duplicate logical identity | no endpoint |
| duplicate Authority/endpoint | no endpoint |
| empty/inexact Session rule | no endpoint |
| root binding mismatch at a later phase | no file operation |
| authorization expired/revoked | no endpoint |
| actual Token/Session mismatch | RPC DENY |

## 6. Test Coordinator Command and Identity Matrix

### 6.1 Identity notation

Actual SIDs are resolved from the approved Manifest:

```text
SID(R5T_RUNNER)
SID(R5T_COORDINATOR)
SID(R5T_CONTROL_SERVER)
SID(R5T_WEB)
SID(R5T_WORKER)
SID(R5T_SUPERVISOR)
SID(R5T_LAUNCH_STAGING)
SID(R5T_LAUNCH_PUBLISHER)
SID(R5T_LAUNCH_SEALER)
SID(R5T_LAUNCH_CLEANUP)
SID(R5T_HELPER_STAGING)
SID(R5T_HELPER_PUBLISHER)
SID(R5T_HELPER_SEALER)
SID(R5T_HELPER_CLEANUP)
```

The Coordinator validates the current RPC call PID, held Process Handle,
creation time, TokenUser SID, groups, integrity and Windows Session before
resolving any logical identity.

### 6.2 Common command checks

Every command:

```text
requires local authenticated ncalrpc and PKT_PRIVACY
requires exact Run authorization and active phase
requires known command ID
requires exact caller identity and SID
requires expectedRevision
requires requestIdHash and canonical body hash
requires idempotency key
requires exact Authority and Session
requires exact Operation/Generation/Grant/Ticket object where applicable
requires the object to belong to the approved Run
requires no contradictory terminal state
```

Unknown command, role mismatch, phase mismatch, stale revision, body-hash
conflict, cross-Run object, cross-Authority object or malformed field => DENY.

Mutations append an audit record containing:

```text
runId
commandId
callerLogicalIdentity
callerTokenUserSid
callerProcessId
callerCreationTime
authorityId
sessionId
requestIdHash
bodyHash
expectedRevision
resultingRevision
oldState/newState
objectBindings
resultStatus
```

### 6.3 Command matrix

`ROOT` means the command may reference only exact objects proven under the
approved run-root binding. `NONE` means no filesystem object is accepted.

| ID | RPC Command | Caller and SID | Authority / Operation | Phase | Session / Object / Root | Allowed transition | Dual identity | Rejected calls | Audit |
|---|---|---|---|---|---|---|---|---|---|
| C01 | `INSTALL_SCENARIO` | Runner / `SID(R5T_RUNNER)` | test scenario only | UNOPENED or READY | Run-only fixture; ROOT; exact operation/generation/action/object | creates immutable scenario revision | YES: Runner identity + approved authorization hash | post-RUNNING, second different scenario, any out-of-root object | full scenario digest |
| C02 | `OPEN_RUN` | Runner / `SID(R5T_RUNNER)` | run phase | READY | exact run, NONE | READY -> RUNNING | YES: Runner + authorization hash | missing scenario, expired auth, extra scenario mutation | scenario/root/auth digests |
| C03 | `SNAPSHOT` | Runner or registered server | read-only run snapshot | READY/RUNNING/STOPPING | exact run, NONE | no mutation | no | cross-Run, secret fields, post-COMPLETED if purged | snapshot digest |
| C04 | `SESSION_REGISTER` | Control server / `SID(R5T_CONTROL_SERVER)` | Session register | RUNNING | exact caller process, authority/session | OPENING -> ACTIVE | YES: control + original caller evidence | Helper/Web direct, cross-authority, nonexistent caller | caller identity tuple |
| C05 | `SESSION_ACCEPT` | Control server | Session/sequence/replay | RUNNING | exact active session/process | ACTIVE unchanged; replay journal append | YES | closed/expired, identity mismatch, stale sequence | request digest |
| C06 | `GRANT_ISSUE` | Control server | Operation request | RUNNING | exact Operation/Generation/Session/target; ROOT object identifier | creates ISSUED Grant + ISSUED Ticket atomically | YES | duplicate Grant ID, active operation key, unmatching action/object | Grant/ticket digests |
| C07 | `GRANT_MATCH` | Control server | Helper matching check | RUNNING | exact Grant/Operation/Generation/Audience/Session | read-only | no | terminal/expired Grant, cross-helper, action mismatch | match conditions |
| C08 | `GRANT_RESERVE` | Control server | Helper register | RUNNING | exact Grant/session/launch session | ISSUED -> RESERVED | YES: Grant audience + current Helper | second consumer, mismatched session | old/new revision |
| C09 | `GRANT_EFFECT` | Control server | Helper effect signal | RUNNING | exact reserved Grant | RESERVED -> EFFECT_REPORTED | YES: current Helper + session/Grant | Consumed/Revoked/Unknown, duplicate effect | effect request digest |
| C10 | `TICKET_BIND` | Matching Launch Authority | Launch Session Register | RUNNING | exact ticket/launch session/Authority | ISSUED -> BOUND | YES: Launch Authority + Supervisor identity | second launch session, wrong type/release | ticket/launch digests |
| C11 | `PREPARE_BEGIN` | Matching Launch Authority | Launch Prepare | RUNNING | exact BOUND ticket/transaction/object/Root binding | BOUND -> CLAIMED; transaction PREPARING | YES: Launch Authority + Supervisor | retry with different body, second claim, expired | transaction revision/deadline |
| C12 | `PREPARE_PREPARED` | Matching Launch Authority | Launch Prepare result | RUNNING | exact PREPARING transaction/process/Job/integrity | PREPARING -> PREPARED; Ticket -> REDEEMED | YES | wrong transaction, missing transfer proof, source-Handle loss | Handle-transfer evidence |
| C13 | `PREPARE_ABORT_PROVEN` | Matching Launch Authority | Prepare cleanup | RUNNING/STOPPING | exact transaction/process/Job | PREPARING/PREPARED -> ABORTED | YES | unproven termination, wrong owner | termination proof |
| C14 | `PREPARE_UNKNOWN` | Matching Launch Authority or watchdog | uncertain Prepare | RUNNING/STOPPING | exact transaction | PREPARING/PREPARED -> UNKNOWN only | YES | attempted direct CLOSED/ABORTED | uncertainty evidence |
| C15 | `COMMIT_INTENT` | Matching Launch Authority | Launch Commit | RUNNING | exact PREPARED transaction/nonce | PREPARED -> COMMIT_PENDING | YES: Launch Authority + Supervisor | ABORT winner, stale revision, missing transfer | commit intent |
| C16 | `SOURCE_HANDLES_CLOSED` | Matching Launch Authority | Commit completion | RUNNING | exact COMMIT_PENDING transaction | COMMIT_PENDING -> COMMITTED only with close proof | YES | unknown/transferred handles, close failure | close transcript |
| C17 | `ABORT_INTENT` | Matching Launch Authority | Launch Abort | RUNNING/STOPPING | exact PREPARING/PREPARED transaction | -> ABORT_PENDING | YES | COMMIT winner, stale revision | abort intent |
| C18 | `ABORT_PROVEN` | Matching Launch Authority or watchdog | Abort completion | RUNNING/STOPPING | exact ABORT_PENDING transaction | ABORT_PENDING -> ABORTED only with process/Handle proof | YES | still active, unknown Handle ownership | termination/close evidence |
| C19 | `LAUNCH_EVIDENCE` | Matching Launch Authority | Launch evidence | RUNNING/STOPPING | exact transaction/process/Job | immutable append | YES: Authority + transaction | duplicate conflicting evidence, wrong transaction | evidence digest |
| C20 | `HELPER_EVIDENCE` | Matching Helper / `SID(R5T_HELPER_*)` | Helper Effect Evidence | RUNNING | exact Helper session/Grant/Operation/object; ROOT | append Helper source only | YES: TokenUser + restricting SID + Grant audience | Supervisor/LA/Control source, wrong Grant/object | immutable evidence digest |
| C21 | `SUPERVISOR_EVIDENCE` | Supervisor verifier / `SID(R5T_SUPERVISOR)` | Supervisor Verification | RUNNING/STOPPING | exact Launch/Grant/Operation/object; ROOT | append Supervisor source only | YES: Supervisor process + Launch Session identity | Helper/LA source, mismatched observation/object | immutable evidence digest |
| C22 | `SESSION_REVOKE` | Control server or Supervisor | Session revoke | RUNNING | exact active session/process | ACTIVE -> REVOKE_REQUESTED | YES | stale/closed/unknown session | revoke CAS evidence |
| C23 | `REVOKE_PROVEN` | Supervisor verifier | Revoke reconciliation | STOPPING | exact revoke transaction/Evidence | REVOKE_REQUESTED/RECONCILING -> RECONCILED only with all proof | YES | missing process/Handle/Evidence proof | close/evidence transcript |
| C24 | `CLOSE_RUN` | Runner / `SID(R5T_RUNNER)` | terminal run audit | STOPPING | exact run, NONE | RUNNING/STOPPING -> COMPLETED or QUARANTINED | YES: Runner + authorization hash | active children or unknown Handles | final run digest |

### 6.4 Internal-only operations

The following are C++ private methods, not members of the RPC command
discriminator:

```text
GRANT_CONSUME
GRANT_REVOKE
EVIDENCE_RECONCILE
OPERATION_FINALIZE
STATE_RECOVERY
```

They may execute only inside already-authenticated command flows and can never
be selected by an RPC caller.

No command accepts `Matched`, `CLOSED`, `SEALED`, `APPLIED` or `DELETED`.

### 6.5 Evidence append CAS

```text
same evidenceId + same digest -> idempotent response
same evidenceId + different digest -> Conflict
same (run, launch, sourceType) already exists -> Conflict
different sourceType -> separate record, never overwrite
reconcile requires exact revisions of Helper + Supervisor records
reconcile result immutable for that transaction revision
Mismatch cannot be resubmitted as Matched
```

## 7. NTFS Test Root Dual Enforcement

### 7.1 Root binding

The user-approved Runtime authorization binds:

```text
canonical root path
volume serial number
root FileId
root type = directory
root owner SID
root DACL digest
root protected-DACL status
approved namespace set
runId
```

The root must be an isolated local NTFS directory outside:

```text
repository
Desktop
user profile
Windows
Program Files
PFR targets
network shares
removable/unknown volumes
```

### 7.2 Shared contract, independent enforcement

Both Coordinator and Helper compile the same test-only `SafeNtfsRoot` adapter,
but each:

- opens its own root Handle;
- independently checks root identity and attributes;
- independently walks the target;
- never trusts a root/object/path assertion supplied by the other process.

### 7.3 Handle-relative algorithm

For every operation:

1. Open the approved root with `FILE_FLAG_BACKUP_SEMANTICS` and
   `FILE_FLAG_OPEN_REPARSE_POINT`.
2. Read `FILE_ID_INFO`, volume serial, attributes and reparse tag.
3. Reject any reparse point, junction or symbolic link.
4. Compare root identity to the Runtime authorization.
5. Reconstruct the relative path from a strict allowlist.
6. Reject absolute paths, drive/device prefixes, `..`, alternate data streams,
   trailing dots/spaces, reserved device names and non-canonical separators.
7. Open each existing component relative to the held parent/root Handle with
   reparse-point semantics.
8. Confirm every component FileId and parent identity.
9. Create/open the final object with a handle-relative operation using
   `RootDirectory`/parent Handle semantics; do not perform a check-then-open
   full-string path operation.
10. Re-read final FileId, volume, parent FileId and LinkCount from the opened
    Handle.
11. Reject `deletePending`, unexpected hard links or a changed parent.
12. Perform the operation only through the opened Handle.

Windows `NtCreateFile`/`NtOpenFile` handle-relative operations are the selected
test-only mechanism. If the implementation cannot provide this safely, R5-D/E
remains blocked; a prefix check or `GetFullPathNameW` comparison is not an
acceptable fallback.

### 7.4 Coordinator enforcement

Coordinator accepts only:

```text
runId
root binding digest
relative namespace
FileId/volume/parent identity
exact operation object identity
```

It rejects:

- any raw absolute target supplied by a business RPC;
- canonical cleanup;
- repository/profile/Windows paths;
- target with unapproved LinkCount;
- object whose root/parent identity differs.

### 7.5 Helper enforcement

Before any file operation, the Helper independently:

- opens the approved root;
- validates the run binding;
- opens the exact source/target by handle-relative traversal;
- verifies expected FileId/volume/parent/size/hash/link count;
- keeps exact Handles and does not re-resolve the target by name.

If the Helper cannot reproduce the identity chain, it returns DENY/UNKNOWN and
performs no mutation.

### 7.6 Required negative tests

- junction/symlink/mount-point replacement;
- directory swap between validation and open;
- hard-link alias;
- case-only path alias;
- trailing-dot/space alias;
- alternate data stream;
- volume-root change;
- parent directory replacement;
- object delete-pending;
- root ACL/owner mismatch;
- target FileId reuse/change.

## 8. Launch Transaction, Handle Custody and Recovery

### 8.1 Transaction states

```text
NONE
  -> PREPARING
       -> PREPARED
            -> COMMIT_PENDING
                 -> COMMITTED
                      -> RUNNING
                      -> REVOKE_REQUESTED
                      -> RECONCILING
                      -> CLOSED
            -> ABORT_PENDING
                 -> ABORTED
       -> ABORT_PENDING
       -> UNKNOWN
       -> QUARANTINED
```

Additional legal terminal/failure paths:

```text
PREPARING -> UNKNOWN
PREPARED -> UNKNOWN
COMMIT_PENDING -> UNKNOWN
ABORT_PENDING -> UNKNOWN
UNKNOWN -> QUARANTINED
```

No `UNKNOWN` or `QUARANTINED` returns to an active state.

### 8.2 Ticket relation

```text
Ticket ISSUED
  -> BOUND
  -> CLAIMED (same atomic operation creates PREPARING Transaction)
  -> REDEEMED (same atomic operation moves PREPARED)
```

Ticket never returns to `ISSUED`.

A unique key prevents two Transactions per Ticket and two Tickets per
Operation/Generation.

### 8.3 PREPARE phases

#### Atomic Begin

Before process creation:

```text
CAS Ticket BOUND -> CLAIMED
AND
insert LaunchTransaction PREPARING
```

The record contains:

```text
transactionId
runId
ticketId
launchSessionId
operationId
grantId
generation
requestIdHash
bodyHash
launchAuthorityId/SID
supervisorAuthorityId/SID/PID/creationTime
deadlineUtc
bootId
revision
state
sourceHandleNonce
```

The Test Coordinator/Durable Metadata Store commits this record before any
process is created.

#### Process and transfer

```text
PREPARING
  -> create restricted token
  -> create anonymous Job
  -> create suspended Helper in Job
  -> pin Helper PID/creation time
  -> duplicate Job/process/thread to pinned Supervisor
  -> duplicate-back verify
  -> CAS PREPARING -> PREPARED
  -> CAS Ticket CLAIMED -> REDEEMED
```

The final two records are one atomic metadata transaction in the durable
backend. If the backend is unavailable, no process may be started.

### 8.4 Handle ownership

| Phase | Source Job/Process/Thread | Supervisor duplicate |
|---|---|---|
| PREPARING | Launch Authority owns; closes on failure | may exist after transfer, but no resume |
| PREPARED before COMMIT | Launch Authority owns source copy | Supervisor owns duplicate copy |
| COMMIT_PENDING | Launch Authority must close source | Supervisor retains duplicate |
| COMMITTED | source closed and invalid | Supervisor sole owner |
| RUNNING | none | Supervisor sole owner |
| ABORT | Launch Authority closes/terminates source | Supervisor closes duplicate |
| Server crash | OS closes source; no recoverable kernel Handle | duplicate remains until Supervisor watchdog closes |
| Supervisor crash | source remains until Launch Authority watchdog | OS closes duplicate |
| Both crash | OS closes all owned Handles | Job last-handle termination may occur |

No durable record reconstructs a lost kernel Handle.

### 8.5 Dual watchdog

Watchdog ownership is intentionally split:

| Watchdog | Process | Responsibility |
|---|---|---|
| Launch Authority watchdog | each Launch Authority | at deadline, if not COMMITTED, CAS abort and close/terminate source Handles |
| Supervisor watchdog | Supervisor client process | at deadline, if no stored successful COMMIT/nonce, close all duplicate Handles and do not resume |
| Test Coordinator watchdog | test state service | records deadline expiry and prevents new transitions; does not own process Handles |

If the Coordinator is unavailable, both process owners use the absolute
deadline carried in the prepared transfer response and fail closed.

No watchdog may resume a Helper.

### 8.6 COMMIT

```text
1. Supervisor calls COMMIT for exact transaction/revision/nonce.
2. Launch Authority verifies current Supervisor process identity.
3. Coordinator CAS PREPARED -> COMMIT_PENDING.
4. Launch Authority closes and verifies source Handles.
5. Coordinator CAS COMMIT_PENDING -> COMMITTED.
6. Response returns stored result.
7. Supervisor verifies local duplicate Handles and resumes.
```

If the response is lost:

- repeat with the same Request ID/body => stored result;
- different body => Conflict;
- no result and no durable COMMITTED proof => close/terminate and UNKNOWN.

### 8.7 ABORT

```text
1. Supervisor or timeout owner requests abort with expected revision.
2. CAS current nonterminal state -> ABORT_PENDING.
3. Close/terminate exact source Handles.
4. Supervisor closes exact duplicate Handles.
5. Wait for process signaling.
6. Record ABORTED only with termination and close proof.
7. Otherwise record UNKNOWN.
```

COMMIT and ABORT use the same revision and are mutually exclusive.

### 8.8 Idempotency

Key:

```text
(runId, launchSessionId, commandId, requestIdHash)
```

Rules:

- same key + same canonical body digest => same stored result;
- same key + different digest => Conflict;
- different key cannot claim the same Ticket or create a second Transaction;
- a retry never starts another process;
- the stored result includes status, resulting revision and transfer digest.

### 8.9 Crash recovery

| Failure | Required result |
|---|---|
| Launch Authority crash before `PREPARED` | durable PREPARING remains; source Handles close in OS; no resume; UNKNOWN |
| Launch Authority crash after `PREPARED` | Supervisor does not resume without COMMITTED; watchdog closes duplicates; UNKNOWN |
| Supervisor crash before COMMIT | duplicate Handles close; Launch watchdog closes source; no resume |
| Supervisor crash after COMMIT but before resume | no committed process execution; close/terminate; UNKNOWN/QUARANTINED |
| Helper crash after resume | normal revoke/evidence path |
| Coordinator crash | no new transitions; process watchdogs close by deadline; whole Run QUARANTINED unless durable evidence proves otherwise |
| Handle lost | UNKNOWN; never term by PID |
| Process state unprovable | UNKNOWN/QUARANTINED |

### 8.10 Persistent backend

R5-C may use an in-memory Coordinator only for Mock LaunchEffect transaction
tests. It must not claim crash recovery.

R5-D/E must use a separately authorized isolated test metadata backend with:

```text
unique transactionId
unique ticketId per transaction
unique launchSessionId per transaction
unique idempotency key
conditional UPDATE ... WHERE revision=@expected AND state=@expected
transactional Ticket+Transaction state updates
append-only evidence and audit
```

The backend is not production PostgreSQL and must not use business schemas,
roles or data.

## 9. P13_PROCESS_LAUNCH_V2 Frozen Contract

### 9.1 Interface identity

```text
Interface name:
P13_PROCESS_LAUNCH_V2

Interface UUID:
B2D9E41C-34D5-4046-96B6-9E14AA9D533E

Interface version:
2.0

Endpoint:
ncalrpc::p13-launch-staging-v1
ncalrpc::p13-launch-publisher-v1
ncalrpc::p13-launch-sealer-v1
ncalrpc::p13-launch-cleanup-v1

Public Manager:
P13LaunchInvoke, opnum 0

Procedure UUID:
not used by this MIDL opnum interface
```

This is a major incompatible interface-version change from v1.0.

### 9.2 Registration policy

```text
R5-D/E test build:
register v2 only

same endpoint:
one v2 registration

v1:
not registered in the v2 test process

B4 v1:
preserved as historical build artifact, never relabeled as v2
```

An old v1 client must not be able to select v2 semantics.

### 9.3 IDL contract

```text
typedef struct _P13LaunchTransferResult
{
    unsigned long resultPresent;          // 1 only for PREPARE success
    unsigned long contractVersion;        // 1
    GUID transferId;
    GUID launchSessionId;
    GUID operationId;
    GUID grantId;
    hyper generation;
    hyper transactionRevision;
    unsigned long supervisorPid;
    unsigned long helperPid;
    hyper supervisorCreationTime;
    hyper helperCreationTime;
    hyper jobHandleValue;
    hyper processHandleValue;
    hyper threadHandleValue;
    GUID transferNonce;
    byte transferDigest[32];
} P13LaunchTransferResult;

error_status_t P13LaunchInvoke(
    [in] const P13LaunchEnvelope *request,
    [out] P13Response *response,
    [out] P13LaunchTransferResult *transfer);
```

Expected fixed size:

```text
P13LaunchTransferResult: 184 bytes
P13Response:             576 bytes
P13LaunchEnvelope base:  216 bytes
```

MIDL-generated size must be independently recorded during Build-only; the
184-byte value is the design expectation, not a Build PASS.

### 9.4 Transfer digest

`transferDigest` is SHA-256 over the canonical encoding of every preceding field
in `P13LaunchTransferResult`.

The client rejects:

- RPC status failure;
- non-zero `P13Response.status`;
- `resultPresent != 1` on a successful Prepare;
- wrong `contractVersion`;
- wrong Transaction/Session/Operation/Grant/Generation/Revision;
- wrong Supervisor PID or creation time;
- zero/mismatched nonce;
- transfer digest mismatch.

### 9.5 Handle-value semantics

- `jobHandleValue`, `processHandleValue` and `threadHandleValue` are valid only
  in the authenticated Supervisor process.
- They are not portable PIDs, object IDs or reusable cross-process integers.
- The Supervisor verifies the returned process/thread/Job identities before
  accepting them.
- A mismatch closes the returned Handles and returns UNKNOWN.
- No untyped `P13Response.message` or arbitrary payload may carry Handle values.

### 9.6 Error behavior

For any non-Prepare operation or failed Prepare:

```text
transfer.resultPresent = 0
all other fields = 0
transferDigest = 0
```

Application errors remain in `P13Response.status`; malformed NDR/RPC input is
rejected by RPC.

### 9.7 Wire budget

```text
Maximum request payload: 16384
Launch request base: 216
Response base: 576
Typed transfer result: 184
Reserved transport/header budget: 4096

Design maximum before transport framing:
216 + 16384 + 576 + 184 + 4096 = 21456

Configured wire ceiling:
24576
```

Build-only verification must record generated NDR sizes and ensure the full
request/response budget stays below 24576.

### 9.8 Frozen-boundary approval

This design explicitly changes the D1 v1.0 Launch interface to v2.0. R5-R3C
cannot implement it until the independent design review and a separate user
decision accept this major-version change.

## 10. R5-R3 Exact Authorization Scope

### 10.1 Stage reduction

The next Build-only stage is redefined as:

```text
R5-R3A — Identity, Trusted Runtime Configuration and R5-A Driver
```

R5-R3B, R5-R3C and R5-R3D are separate future phases and are not authorized by
this design.

### 10.2 R5-R3A exact file/symbol scope

| File | Symbol | Change | Depends on | Test | Build target | Output | Protected |
|---|---|---|---|---|---|---|---|
| `tools/native-rpc/p13-a1-r2/include/identity/p13_identity_adapter.h` | `IIdentityProvider::Inspect`, `WindowsRpcIdentityProvider` | typed identity/provider result; manifest expectation | Trust Root | identity-negative tests | server/client/tests | `bin/r5-r3a/x64` | no |
| `tools/native-rpc/p13-a1-r2/src/identity/windows_identity_adapter.cpp` | `QueryTokenBytes`, `QueryAuthzBuffer`, `ReadTokenIdentity`, `WindowsRpcIdentityProvider::Inspect`, `ImpersonationGuard::Leave` | fail-closed field parsing/error propagation | Trust Root | malformed/truncated queries | server/client/tests | `obj/r5-r3a/x64` | no |
| `tools/native-rpc/p13-a1-r2/include/runtime/p13_runtime_manifest.h` | `RuntimeIdentityManifest`, `RuntimeIdentityRecord`, `RuntimeRootBinding`, manifest loader | new immutable types/API | Manifest design | schema/negative tests | server/client/tests | `manifest/r5-r3a` | no |
| `tools/native-rpc/p13-a1-r2/src/runtime/p13_runtime_manifest.cpp` | schema parser, SID validation, endpoint uniqueness, exact Session validation | load/validate manifest | Manifest design | parser tests | server/client/tests | `obj/r5-r3a/x64` | no |
| `tools/native-rpc/p13-a1-r2/include/runtime/p13_runtime_authorization.h` | `RuntimeAuthorization`, expected digest types | independent approval record types | Trust Root | hash/expiry/revocation tests | server/client/tests | `manifest/r5-r3a` | no |
| `tools/native-rpc/p13-a1-r2/src/runtime/p13_runtime_authorization.cpp` | authorization hash verification, binary hash verification, expiry/revocation | fail-closed startup gate | Trust Root | mismatch tests | server/client/tests | `obj/r5-r3a/x64` | no |
| `tools/native-rpc/p13-a1-r2/include/authority/p13_authority_components.h` | `AuthorityDescriptor` | remove authoritative compile-time SID/Session fields | Manifest design | descriptor negative tests | server/tests | `obj/r5-r3a/x64` | no |
| `tools/native-rpc/p13-a1-r2/src/authority/p13_authority_components.cpp` | placeholder constants, `DescriptorForId`, `LaunchDescriptorForEndpoint`, `SupervisorDescriptor` | remove placeholder authority source; resolve identity policy from manifest | Manifest design | no-placeholder static test | server/tests | `obj/r5-r3a/x64` | no |
| `tools/native-rpc/p13-a1-r2/include/authority/p13_authority_service.h` | `AuthorizationEngine`, `HarnessState` | accept manifest-backed expectation; keep state local to R5-A | Trust Root | unit compile | server/tests | `obj/r5-r3a/x64` | no |
| `tools/native-rpc/p13-a1-r2/src/authority/p13_authority_service.cpp` | `ExpectationFor`, `SupervisorExpectation`, `AuthorizeAuthority`, `AuthorizeLaunch` | use manifest identity, fail closed on missing manifest | Trust Root/P2-02 | authorization tests | server/tests | `obj/r5-r3a/x64` | no |
| `tools/native-rpc/p13-a1-r2/include/server/p13_server_runtime.h` | `ServerRuntimeConfiguration` | include immutable manifest/authorization handles | Trust Root | startup gate tests | server | `obj/r5-r3a/x64` | no |
| `tools/native-rpc/p13-a1-r2/src/server/p13_server_runtime.cpp` | `RunNativeServer` | validate authorization before endpoint registration | Trust Root | source/static test | server | `obj/r5-r3a/x64` | no |
| `tools/native-rpc/p13-a1-r2/src/server/p13_server_main.cpp` | `wmain` | exact R5-A args and protected config paths | Trust Root | CLI negative tests | server | `bin/r5-r3a/x64/p13_native_rpc_server_r5a.exe` | no |
| `tools/native-rpc/p13-a1-r2/src/server/p13_managers.cpp` | `P13Invoke`, `P13LaunchInvoke` | fixed provider/manifest context; no Test Coordinator | Trust Root | Manager source check | server | `obj/r5-r3a/x64` | no |
| `tools/native-rpc/p13-a1-r2/include/client/p13_client_runtime.h` | `ClientRuntimeConfiguration`, `BuildAuthorityEnvelope` | exact Web test role, one EPOCH request | R5-A | client contract tests | client | `obj/r5-r3a/x64` | no |
| `tools/native-rpc/p13-a1-r2/src/client/p13_client_runtime.cpp` | `RunNativeClientProbe` | replace staging default with Web test authority; one request/no retry | R5-A | assertion matrix | client | `obj/r5-r3a/x64` | no |
| `tools/native-rpc/p13-a1-r2/src/client/p13_client_main.cpp` | `wmain` | exact R5-A CLI | R5-A | CLI tests | client | `bin/r5-r3a/x64/p13_native_rpc_client_r5a.exe` | no |
| `tools/native-rpc/p13-a1-r2/tests/r5a/identity_fail_closed_tests.cpp` | test entry functions | query failure/truncation/SID/Session tests | P2-02 | compile only in R5-R3A | tests | `bin/r5-r3a/x64/p13_r5a_tests.exe` | no |
| `tools/native-rpc/p13-a1-r2/tests/r5a/runtime_trust_tests.cpp` | test entry functions | manifest/auth hash/binary/Session tests | Trust Root | compile only | tests | same | no |
| `tools/native-rpc/p13-a1-r2/tests/r5a/transport_rejection_tests.cpp` | test entry functions | malformed/unknown operation/principal denial | R5-A | compile only | tests | same | no |
| `tools/native-rpc/p13-a1-r2/manifest/r5-r3a/identity-manifest.schema.json` | schema | non-secret schema only | Manifest design | schema verifier | static | exact file | no |
| `tools/native-rpc/p13-a1-r2/manifest/r5-r3a/runtime-authorization.schema.json` | schema | non-secret schema only | Trust Root | schema verifier | static | exact file | no |
| `tools/native-rpc/p13-a1-r2/build-r5-r3a.ps1` | build functions | build R5-R3A only | all above | static command allowlist | build driver | logs/r5-r3a/build | no |
| `tools/native-rpc/p13-a1-r2/verify-static-r5-r3a.ps1` | verifier | source/artifact/semantic checks | all above | can run in Build-only | verifier | logs/r5-r3a/static-review | no |

### 10.3 R5-R3A explicit non-modification set

The following exist outside R5-R3A and are protected as complete trees or exact
files:

```text
idl/p13_authority.idl
generated/r4-b4/x64                  [entire directory tree]
generated/x64                        [entire directory tree]
obj/r4-b4/x64                        [entire directory tree]
bin/r4-b4/x64                        [entire directory tree]
bin/x64                              [entire directory tree]
manifest/build-manifest.json
manifest/r4-b4                      [entire directory tree]
logs/r4-b4                          [entire directory tree]
logs/build                          [entire directory tree]
logs/static-review                  [entire directory tree]
include/authority/p13_operation_policy.h
src/authority/p13_operation_policy.cpp
include/launch/p13_launch_components.h
src/launch/p13_launch_components.cpp
include/lifecycle/p13_lifecycle_adapters.h
src/lifecycle/job_lifecycle_adapter.cpp
src/lifecycle/sealed_adapter.cpp
tests/b4/native_test_sources.cpp
build-b4.ps1
verify-static-b4.ps1
apps/web                             [entire directory tree]
apps/worker                          [entire directory tree]
packages/file-storage               [entire directory tree]
prisma                              [entire directory tree]
.env
.env.test
```

Within the allowed `src/authority/p13_authority_components.cpp`, only
descriptor/identity-manifest symbols may change. Session, Grant, Operation and
launch store implementations are protected in R5-R3A.

### 10.4 R5-R3A output

Exact directory roots:

```text
tools/native-rpc/p13-a1-r2/generated/r5-r3a/x64
tools/native-rpc/p13-a1-r2/obj/r5-r3a/x64
tools/native-rpc/p13-a1-r2/bin/r5-r3a/x64
tools/native-rpc/p13-a1-r2/logs/r5-r3a/build
tools/native-rpc/p13-a1-r2/logs/r5-r3a/static-review
tools/native-rpc/p13-a1-r2/manifest/r5-r3a
tools/native-rpc/p13-a1-r2/evidence/r5-r3a/temp
```

Exact executables/tests:

```text
p13_native_rpc_server_r5a.exe
p13_native_rpc_client_r5a.exe
p13_r5a_tests.exe
```

Exact generated and evidence files:

```text
generated/r5-r3a/x64/p13_authority.h
generated/r5-r3a/x64/p13_authority_c.c
generated/r5-r3a/x64/p13_authority_s.c
logs/r5-r3a/build/build.log
logs/r5-r3a/build/midl.log
logs/r5-r3a/build/compile.log
logs/r5-r3a/build/link.log
logs/r5-r3a/static-review/binary-inspection.log
logs/r5-r3a/static-review/static-verification.json
manifest/r5-r3a/build-manifest.json
manifest/r5-r3a/identity-manifest.schema.json
manifest/r5-r3a/runtime-authorization.schema.json
```

### 10.5 R5-R3A build commands

The following are future authorized commands only:

```powershell
pwsh -NoLogo -NoProfile -File .\tools\native-rpc\p13-a1-r2\build-r5-r3a.ps1 -BuildOnly
pwsh -NoLogo -NoProfile -File .\tools\native-rpc\p13-a1-r2\verify-static-r5-r3a.ps1
```

Neither command may execute any produced EXE.

### 10.6 Future R5-R3B

```text
Purpose:
Test Coordinator, safe NTFS root, Grant, Ticket, Launch Transaction,
MockLaunchEffect

Required exact output root:
generated/r5-r3b/x64
obj/r5-r3b/x64
bin/r5-r3b/x64
logs/r5-r3b/build
logs/r5-r3b/static-review
manifest/r5-r3b
evidence/r5-r3b

Runtime:
NOT AUTHORIZED
```

No R5-R3B file may be included in R5-R3A authorization.

### 10.7 Future R5-R3C

```text
Purpose:
Launch v2, PinnedProcessIdentity, process/Job/Handle adapters,
dual watchdog, Revoke process path

Required exact output root:
generated/r5-r3c/x64
obj/r5-r3c/x64
bin/r5-r3c/x64
logs/r5-r3c/build
logs/r5-r3c/static-review
manifest/r5-r3c
evidence/r5-r3c

Runtime:
NOT AUTHORIZED
```

Interface v2 requires separate user approval.

### 10.8 Future R5-R3D

```text
Purpose:
Evidence Coordinator, protected DACL, Owner Rights, AccessCheck,
SEALED/Revoke test contract

Required exact output root:
generated/r5-r3d/x64
obj/r5-r3d/x64
bin/r5-r3d/x64
logs/r5-r3d/build
logs/r5-r3d/static-review
manifest/r5-r3d
evidence/r5-r3d

Runtime:
NOT AUTHORIZED
```

## 11. R5-A Exact Minimal Plan

### 11.1 Required operation

```text
P13Invoke
  -> AUTHORITY_EPOCH_READ
  -> exact R5T_WEB authority descriptor
```

Existing policy:

- operation ID `0x000C`;
- all control principal classes;
- no Session;
- no Grant;
- read-only;
- no business Effect.

### 11.2 Exact assertions

1. Endpoint is the test-only instance of `p13-authority-v1`.
2. Server starts only after Manifest/authorization checks.
3. Client uses `R5T_WEB`, not `kStagingAuthorityId`.
4. One signed request is made and no automatic retry occurs.
5. Request ID is non-zero.
6. Response protocol is valid.
7. Status is `Ok`.
8. `serverEpoch` is the only returned internal field.
9. Session/Evidence IDs remain zero.
10. Message length/content contains no path, SID, token, credential or Grant.
11. `TestEffectSink` remains empty.
12. No Session/Grant/Ticket/Launch/Evidence record is created.
13. Server stop/unregister completes.
14. Client and server processes exit.
15. PFR and executable hashes remain unchanged.

Epoch information rule:

```text
serverEpoch is approved non-secret control metadata for this single test.
No repeated polling or arbitrary epoch read matrix is authorized in R5-A.
```

### 11.3 Forbidden in R5-A

- real Helper;
- real Grant or Ticket;
- Test Coordinator;
- Process/Token/Job/Handle Transfer;
- ACL or SEALED;
- Evidence APPLIED/DELETED;
- production Storage/DB;
- more than one successful EPOCH read.

### 11.4 R5-A prerequisites

```text
R5-R3A source implemented
R5-R3A Build-only verification PASS
R5-R2-R3 independent Build-only review PASS
user-approved Runtime authorization and exact hashes
separate R5-A Runtime authorization
```

This report satisfies none of those approvals automatically.

## 12. Integrated Consistency Review

### 12.1 Manifest and Coordinator

- Coordinator receives Manifest only through the authorization-checked startup
  context.
- Coordinator cannot write Manifest or authorization.
- Runner can install only a scenario under the approved run root.
- Helper validates the same root independently.

### 12.2 Helper and Supervisor evidence

- Coordinator authenticates Helper and Supervisor directly on its test-only
  endpoint.
- Helper cannot write Supervisor source type.
- Supervisor cannot write Helper source type.
- Control server cannot supply either source on their behalf.

### 12.3 Launch and Revoke

- Launch Transaction uses the same Supervisor identity and Session recorded by
  authorization.
- Revoke CAS uses the same Launch Transaction revision and exact process/Job
  Handles.
- `UNKNOWN` is terminal until evidence reconciliation or quarantine.
- No process Handle is reconstructed from a record.

### 12.4 R5-A isolation

- R5-R3A does not link Test Coordinator.
- R5-A does not create Session/Grant/Ticket/Launch/Evidence state.
- R5-A uses P2-02 and trusted configuration only.
- P2-03/04/05/08 and RR-01/02 remain out of the R5-A Runtime path.

## 13. Unresolved Risks

```text
Initial PID-to-process binding race:
RUNTIME TEST REQUIRED IN R5-B

Authz Group/Restricted runtime output:
NOT VERIFIED

SafeNtfsRoot native handle-relative implementation:
DESIGN ONLY

Durable isolated metadata backend:
REQUIRED BEFORE R5-D/E RUNTIME

Launch v2 MIDL/NDR generated sizes:
BUILD VERIFICATION REQUIRED

Launch v2 major-version change:
SEPARATE USER APPROVAL REQUIRED

Exact Windows identities/SIDs/Sessions:
NOT CREATED / NOT APPROVED BY THIS STAGE

Endpoint collision:
NOT VERIFIED

Job/Token/Handle/ACL/Evidence behavior:
NOT EXECUTED

Production DB roles/constraints:
OUT OF SCOPE
```

## 14. Final Decision

```text
Overall:
PASS WITH WARNINGS — READY FOR INDEPENDENT REVIEW

R5-R2-R1 DR-01:
CORRECTED AT DESIGN

R5-R2-R1 DR-02:
CORRECTED AT DESIGN

R5-R2-R1 DR-03:
CORRECTED AT DESIGN

R5-R2-R1 DR-04:
FROZEN AT DESIGN / USER APPROVAL STILL REQUIRED

R5-R2-R1 DR-05:
CORRECTED — R5-R3A EXACTLY SCOPED

Manifest Trust Root:
USER-APPROVED AUTHORIZATION HASH + PROTECTED VERSION BASELINE

Test Coordinator:
COMMAND/ACTOR/PHASE/ROOT MATRIX COMPLETE

NTFS Dual Enforcement:
HANDLE-RELATIVE COORDINATOR + HELPER CHECKS

Launch Transaction:
PREPARING + DUAL WATCHDOG + CAS + UNKNOWN/QUARANTINE

Launch v2:
SAME UUID / VERSION 2.0 / ONE MANAGER / 184-BYTE TYPED RESULT

R5-R3:
REDEFINED AS R5-R3A ONLY

R5-R3A:
IDENTITY + TRUSTED CONFIG + R5-A DRIVER

R5-R3B/C/D:
NOT AUTHORIZED / SEPARATE PHASES

R5-A:
ONE EPOCH READ / NO BUSINESS EFFECT / SEPARATE AUTHORIZATION

Native RPC Build:
NOT EXECUTED

Native RPC Runtime:
NOT EXECUTED

Git Writes:
NOT EXECUTED
```

## 15. Side-Effect Declaration

No source, IDL, generated file, Build Script, test, manifest, binary, endpoint,
process, Token, Job, Handle, account, group, ACL, DACL, Owner, Service,
Registry, PFR, database, Storage or Git state was changed.

## 16. Report Integrity

This report cannot contain its own final SHA-256 without changing its content.
The external SHA-256 is calculated after the final write and returned in the
stage completion message.
