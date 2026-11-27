# WP-1G — Final Protocol Closure and Verification Boundary R8

## 0. Document Control

```text
Stage: WP-1G
Mode: READ-ONLY INVESTIGATION / FINAL PROTOCOL DESIGN
Date: 2026-11-25
Repository: D:\thinkbook\Desktop\jieya
Branch at start: codex/public-github-sync
HEAD at start: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main at start: 101e8a362e430f4fa7b31b67c56823cb702eb1e6

Final design result:
  PASS WITH WARNINGS — FINAL PROTOCOL DESIGN COMPLETE

Implementation gate:
  BLOCKED — ISOLATED WINDOWS/DB/STORAGE VERIFICATION NOT AVAILABLE
```

This document is the final design boundary, not source implementation. No
SQL, migration, Windows service, ACL, Storage, Build, Native RPC or Worker
Drain was executed.

Evidence categories:

```text
DESIGN VERIFIED
  The protocol is logically specified and internally consistent.

PLATFORM GUARANTEE DOCUMENTED
  A Windows/PostgreSQL/OS API behavior has an official basis, but was not
  measured on the target environment.

ISOLATED ENVIRONMENT VERIFIED
  A real disposable DB/Windows/Storage test produced evidence.
  NOT EXECUTED IN THIS TASK.

PRODUCTION VERIFIED
  An authorized production test produced evidence.
  NOT EXECUTED IN THIS TASK.
```

Skills applied:

- `$project-architecture`
- `$prisma-db-safety`
- `$security-audit`
- `$testing-and-verification`
- `$file-lifecycle`

## 1. Executive Summary

R7 identified six implementation blockers:

1. Broker process identity/credential custody.
2. Single active Broker and old-handle fencing.
3. Recovery DB/OS handoff.
4. Evidence trust boundary.
5. Active FileVersion → Legacy/v2 migration.
6. D0–D10 executable evidence.

The final protocol below chooses one path for each:

```text
Broker identity:
  Windows Service SID + protected CNG key + PostgreSQL mTLS DB role

Single active Broker:
  SCM singleton + global mutex + Job/process/handle fence

Recovery:
  DB CAS/revoke -> PENDING_OS_FENCE -> OS proof -> ISSUED

Evidence:
  Broker OS probe -> restricted SECURITY DEFINER ingestion
  -> append-only Evidence -> FileVersion evidence FK

Legacy:
  preserve old table -> new active v2 table -> separate legacy API

Drain:
  D0-D10 evidence gate
```

The protocol is internally coherent at design level. The current environment
does not have the required Broker service, protected CNG key, isolated
PostgreSQL roles, native probes, historical archive or drain evidence. The
implementation gate therefore remains blocked.

## 2. WP-1F-R Finding Resolution

| R7 finding | Final disposition | Evidence state |
|---|---|---|
| Broker process authenticity | Design defines service SID/CNG/mTLS/DB role and declares same-SID compromise as TCB failure | `DESIGN VERIFIED`; platform/isolated not verified |
| Single Broker/old handle fencing | Design defines mutex/Job/process/handle proof | `DESIGN VERIFIED`; OS not verified |
| Recovery DB/OS handoff | Design defines revoke/claim/PENDING_OS_FENCE/ISSUED | `DESIGN VERIFIED`; DB/OS not verified |
| Evidence trust | Design declares Broker TCB and restricted ingestion; no independent OS witness | `DESIGN VERIFIED`; isolated not verified |
| Legacy/v2 migration | Design preserves old table and creates active v2/archive mapping | `DESIGN VERIFIED`; data not verified |
| D0–D10 | Design defines exact evidence categories and stop conditions | `DESIGN VERIFIED`; commands not executed |

## 3. Six Final Protocol Decisions

### WP1G-A — Broker Identity

```text
Service SID
  -> CNG non-exportable private key, service-SID-protected
  -> mTLS certificate
  -> PostgreSQL client-certificate authentication
  -> dedicated Broker DB role
```

The DB authenticates a certificate/role. PID, SID, creation time and boot
epoch are evidence fields, not DB authentication substitutes. Same-SID
injection or a compromised Broker process is `TRUST_BOUNDARY_FAILED`, not a
new valid Broker. No Administrator interactive fallback is allowed.

### WP1G-B — Single Broker / OS Fencing

```text
SCM single-service instance
-> global named mutex with explicit DACL
-> Broker-only Job Object
-> no breakaway, no child handle inheritance
-> old process/child/handle/section/mmap fence
-> v2 root only after fence proof
```

New Broker cannot enter `PUBLISH_ENABLED` until old process and handles are
proven terminated/released. DB session revocation alone is insufficient.

### WP1G-C — Recovery DB/OS Two-Phase Protocol

```text
DB phase:
  lock storage key/Intent/Lifecycle/Operation/Attempt
  revoke old Authority Session
  increment owner and recovery generation
  create PENDING_OS_FENCE session

OS phase:
  terminate/verify old Broker process/tree
  verify old handles/section/mmap/children
  verify v2 ACL old identities denied
  mark session ISSUED
  enable publish
```

If OS phase is unknown, PENDING session remains revoked/blocked; no FileVersion
or APPLIED state.

### WP1G-D — Evidence Boundary

```text
Windows Probe
  -> Broker TCB validation
  -> canonical Evidence
  -> restricted SECURITY DEFINER ingestion
  -> append-only Evidence
  -> FileVersion evidence FK
  -> verified read
```

Evidence is Broker-attested; digest is not OS proof. Broker compromise
invalidates the boot epoch and all evidence from it. No signature/digest is
claimed to repair a compromised TCB.

### WP1G-E — Legacy/v2 Data Model

Keep the existing old table as immutable legacy history. Create a separate
active v2 FileVersion table and a legacy mapping. New active rows require
Evidence; unmappable rows remain legacy read-only and are never served by
normal download/list APIs. No row is deleted or rewritten to hide missing
evidence.

### WP1G-F — D0–D10

Each D0–D10 step must have:

```text
actor, permission, precondition, command/programmatic check,
expected output, evidence path, failure stop and rollback transcript
```

Queue states, service/process trees, inherited/duplicate/mmap handles,
effective ACL and old-runtime references are separate evidence. File presence
is not process evidence.

## 4. Complete Operation State Machine

Current Trigger-compatible operation states:

```text
PREPARED  -> EXECUTING | FAILED | ABANDONED
EXECUTING -> APPLIED | UNKNOWN | FAILED
UNKNOWN   -> APPLIED | FAILED | ABANDONED
APPLIED / FAILED / ABANDONED -> terminal
```

Final authority rules:

| State | Who owns execution | OS effect | Recovery |
|---|---|---|---|
| `PREPARED` | upload owner, no capability | no | only no-authority ABANDONED/FAILED |
| `EXECUTING` | owner + Authority Session | may have started | UNKNOWN after loss |
| `UNKNOWN` | recovery owner after CAS | possible | one broker/fence owner |
| `APPLIED` | terminal evidence | no mutation | no |
| `FAILED` | terminal retained | no mutation | no |
| `ABANDONED` | terminal no-effect | no | no |

`PREPARED -> UNKNOWN` is prohibited. `UNKNOWN -> ABANDONED` is allowed only
with proof that no OS request was issued.

### 4.1 Recovery CAS

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;
SELECT pg_advisory_xact_lock(hashtextextended($storage_key, 0));
SELECT * FROM "file_upload_intent" WHERE id=$intent_id FOR UPDATE;
SELECT * FROM "storage_object_lifecycle" WHERE id=$lifecycle_id FOR UPDATE;
SELECT * FROM "storage_object_operation" WHERE id=$operation_id FOR UPDATE;
SELECT * FROM "file_upload_attempt" WHERE id=$attempt_id FOR UPDATE;

UPDATE "storage_authority_session"
SET state='REVOKED', revokedAt=now()
WHERE operationId=$operation_id AND state IN ('ISSUED','CONSUMED');

UPDATE "storage_object_operation"
SET ownerToken=$new_owner_digest,
    ownerPrincipalId=$new_owner,
    fencingGeneration=fencingGeneration+1,
    recoveryGeneration=recoveryGeneration+1,
    leaseExpiresAt=$new_lease,
    authoritySessionId=$new_session
WHERE id=$operation_id
  AND state IN ('EXECUTING','UNKNOWN')
  AND fencingGeneration=$expected_generation
  AND leaseExpiresAt <= now();

UPDATE "storage_object_lifecycle"
SET ownerToken=$new_owner_digest,
    fencingGeneration=$expected_generation+1,
    recoveryGeneration=recoveryGeneration+1,
    leaseExpiresAt=$new_lease,
    authoritySessionId=$new_session
WHERE id=$lifecycle_id
  AND fencingGeneration=$expected_generation;

-- rowcount must be exactly one for each mutation
INSERT INTO "storage_authority_session"
  (... state='PENDING_OS_FENCE', operationId=$operation_id, ...);
COMMIT;
```

No OS operation is atomic with this commit. After commit, the new Broker must
complete process/handle/ACL fence before `PENDING_OS_FENCE -> ISSUED`.

## 5. Legacy / v2 Data Model

### 5.1 Non-Destructive Table Model

```text
legacy_file_version
  id / originalFileVersionId
  original File/Intent references
  original metadata, checksum, storageKey
  sourceSnapshotDigest
  legacyReason
  legacyState: READ_ONLY | BLOCKED
  archivedAt
  immutable archive Trigger

file_version_v2
  active P1-3 FileVersion
  publicationEvidenceId NOT NULL
  uploadIntentId/uploadAttemptId/creationOperationAttemptId
  ACTIVE canonical Lifecycle relation
  immutable identity Trigger
```

The old table is preserved. New active queries use `file_version_v2`; the
legacy table is not converted with nullable fields or default Evidence.

### 5.2 Reference Handling

```text
File.currentVersionId
  -> active v2 for new/migrated active records
  -> legacy view only for legacy read-only metadata

FileExtraction/ExtractionField/Review/Audit
  -> preserve original references in legacy history
  -> new v2 records use new immutable history
```

No old immutable row is updated or deleted to fit v2. If an existing old
FileVersion cannot be represented without modifying its identity, it remains
legacy/blocked.

### 5.3 API

```text
normal list/detail/download/references:
  file_version_v2 + ACTIVE lifecycle + VERIFIED evidence

legacy:
  separate legacy.read metadata only
  no normal download/preview
  no new upload reference
  no cleanup without separate authority
```

## 6. Publication Evidence

Append-only Evidence must bind:

```text
Attempt, Intent, Operation, canonical Lifecycle, storageKey
Authority Session, Boot Epoch, Broker Service SID
staging/target Volume Serial and File ID
target parent File ID/namespace
target size/SHA-256
Reparse result
writerClosed
target seal and ACL digest
old-SID access denial
```

The SECURITY DEFINER ingestion function:

- is callable only by the Broker DB role;
- has a dedicated owner and fixed `search_path`;
- has no PUBLIC EXECUTE;
- validates operation/session/boot/attempt/lifecycle/storage binding;
- rejects duplicate, stale, cross-object and old-epoch rows;
- APPENDS Broker evidence and recovery evidence separately;
- does not claim to prove the Broker’s OS API results.

The FileVersion v2 insert Trigger requires the referenced Evidence to be
`VERIFIED`, current boot/session-bound and target-identity-bound.

## 7. D0–D10 Verification Protocol

Every step records actor, permission, preconditions, exact command or
programmatic check, expected output, evidence path, failure stop and rollback.

| Step | Required evidence |
|---|---|
| D0 | admission/queue/scheduler freeze state |
| D1 | process/service/task/version inventory |
| D2 | queue consumers, retries, delayed, dead-letter and recreated jobs |
| D3 | active job IDs and terminal/retained state |
| D4 | restart/watchdog/scheduler disabled state |
| D5 | service/process exit, PID+creation, child tree |
| D6 | file/section/mmap/inherited/duplicate handle proof |
| D7 | `.next`/`dist` identity and runtime references, without treating presence as process state |
| D8 | v2 root/parent/target ACL and Effective Access |
| D9 | canary publish/read/Evidence transcript |
| D10 | continuous old-process/cleanup/v2-access monitoring |

Exact commands and tool identities remain `NOT VERIFIABLE` until an authorized
isolated Windows environment is provided. No service name, queue name or tool
is invented.

Rollback:

```text
D9 failure -> stop admission; revoke new capabilities; retain v2 objects;
keep old cleanup without v2 access; do not delete v2 objects.

If old cleanup isolation is unknown -> BLOCKED.

Before re-switch -> repeat D0-D8.
```

## 8. Evidence Boundary Matrix

| Capability | DESIGN VERIFIED | PLATFORM GUARANTEE | ISOLATED VERIFIED | PRODUCTION VERIFIED |
|---|---:|---:|---:|---:|
| Service SID/CNG/mTLS | yes | documented, not measured | no | no |
| DB role/function boundaries | yes | PostgreSQL documented | no | no |
| mutex/Job/process fence | yes | Windows documented | no | no |
| handle/mmap/section release | yes | Windows APIs documented | no | no |
| File ID/Volume/Reparse | yes | Windows APIs documented | no | no |
| target seal/ACL | yes | Windows ACL documented | no | no |
| Recovery CAS | yes | PostgreSQL design only | no | no |
| Evidence ingestion | yes | DB permission design only | no | no |
| Legacy/v2 migration | yes | DB design only | no | no |
| D0-D10 drain | yes | operational design only | no | no |

## 9. Failure Matrix

| Scenario | Expected final state | Forbidden |
|---|---|---|
| PREPARED crash | ABANDONED/FAILED, no target | PREPARED→UNKNOWN |
| EXECUTING crash | UNKNOWN, target retained | APPLIED without evidence |
| two Recovery Workers | one CAS/session owner | two terminalizations |
| old Broker resumes | old generation/session denied; OS fence required | assume DB revocation closed handles |
| Broker restart | old epoch invalid | reuse old capability |
| DB unavailable | Broker PUBLISH disabled/UNKNOWN | continue publication |
| Evidence insert fail | Operation EXECUTING/UNKNOWN | active FileVersion |
| Target replaced | integrity failed/retained | serve bytes |
| Legacy queue replay | blocked/stopped | old Worker runs |
| inherited handle | blocked/unknown | ACL-only success claim |
| rollback cleanup | v2 retained, old access denied | broad old permissions |

## 10. User Decision Register

### A. Derived From Existing Invariants

- A-01: PREPARED timeout cannot become UNKNOWN.
- A-02: DB lease/owner generation does not close Windows handles.
- A-03: no active v2 FileVersion without accepted Evidence.
- A-04: no historical record is guessed into a complete v2 chain.
- A-05: no source, Migration, Broker, Drain or deployment execution here.
- A-06: R5/BV7/BV8/R8 statuses are unchanged.

### B. Recommended, Needs User Approval

| ID | Decision |
|---|---|
| B-01 | Native Storage Authority Broker as TCB |
| B-02 | Service SID + protected CNG key + mTLS/DB Role |
| B-03 | SCM singleton + global mutex + Job/process fence |
| B-04 | DB-authoritative Authority Session and `PENDING_OS_FENCE` |
| B-05 | SECURITY DEFINER Evidence ingestion with Broker TCB boundary |
| B-06 | same local NTFS volume |
| B-07 | preserve old table and create active v2 table |
| B-08 | separate legacy read-only API/permission |
| B-09 | 30s heartbeat / 120s lease |
| B-10 | D0–D10 isolated Windows drain and ACL proof |
| B-11 | separate Web/Worker/Broker/Maintenance/Definer/Recovery roles |

### C. Evidence Missing — Must Investigate

- Windows Service SID, CNG private key ACL, mTLS and PostgreSQL role mapping.
- mutex/Job/process-tree termination, section/mmap/inherited/duplicate handles.
- File ID, Volume Serial, Reparse, handle close, target seal and Effective ACL.
- actual Broker restart and old-process recovery.
- actual historical data and legacy/v2 mapping.
- actual queue/job/scheduler/cleanup inventory.
- PostgreSQL Trigger/COMMIT/lock behavior.
- v2 root/parent/target ACL and isolated environment results.

## 11. R5 / BV7 / BV8 / R8 Status

```text
R5 independent review:
  FAIL — DESIGN CORRECTIONS REQUIRED
R5 Open Decisions:
  57/57 OPEN; 0 approved
BV7:
  FAIL — BLOCKING DESIGN CORRECTIONS REQUIRED
BV8:
  READY FOR INDEPENDENT REVIEW; NOT APPROVED
R8:
  BLOCKED — REQUIRED DESIGN EVIDENCE MISSING
```

No status is changed by WP-1G.

## 12. Unresolved Implementation Blockers

```text
BLOCK-01: Protected Broker service/CNG/mTLS/DB role not implemented.
BLOCK-02: Single-Broker mutex/Job/process/handle fence not implemented.
BLOCK-03: Recovery PENDING_OS_FENCE and old-handle proof not tested.
BLOCK-04: Evidence ingestion and FileVersion v2 FK not implemented.
BLOCK-05: Legacy/v2 table migration and historical references not implemented.
BLOCK-06: D0-D10 commands/ACL/handle/queue evidence not executed.
BLOCK-07: PostgreSQL Trigger/COMMIT/concurrency tests not executed.
BLOCK-08: Isolated Windows/DB/Storage environment not authorized.
```

## 13. Next Phase Admission

The next phase must be:

```text
INDEPENDENT REVIEW
-> USER DECISION ON B ITEMS
-> ISOLATED WINDOWS/DB/STORAGE ENVIRONMENT AUTHORIZATION
-> READ-ONLY NATIVE PROBES
-> SCHEMA/MIGRATION DESIGN REVIEW
-> LIMITED IMPLEMENTATION AND FAULT TESTING
-> PRODUCTION AUTHORIZATION ONLY AFTER EVIDENCE
```

No automatic WP-1H or other design round is authorized. WP-1G is the final
design boundary; the next operation is separate review/approval.

## 14. Git and Non-Action Record

At start:

```text
Branch: codex/public-github-sync
HEAD: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified: 0
Staged: 0
Deleted: 0
Untracked: 14
```

The final state is recorded in the delivery message. This report adds one
untracked file. Existing `$null`, `UNKNOWN'`, prior reports, `__pycache__/`
and the baseline report remain untouched.

No source, Schema, Migration, Trigger, configuration or test was modified.
No database, Storage, Windows ACL, Service, E2E, Build, Native RPC or drain
was executed. `$null`, `UNKNOWN'`, `.next` and `.dist` were not read,
modified, moved or deleted.

## 15. Final Design Verdict

```text
Final protocol design:
  PASS WITH WARNINGS — FINAL PROTOCOL DESIGN COMPLETE

Broker identity/trust boundary:
  DESIGN VERIFIED / PLATFORM AND ISOLATED EVIDENCE ABSENT

Single active Broker/OS fencing:
  DESIGN VERIFIED / OS EVIDENCE ABSENT

Recovery DB/OS handoff:
  DESIGN VERIFIED / DB AND OS TESTS ABSENT

Publication Evidence:
  DESIGN VERIFIED / BROKER TCB AND EVIDENCE TRUST UNVERIFIED

Legacy/v2:
  DESIGN VERIFIED / HISTORICAL DATA MIGRATION ABSENT

D0-D10:
  DESIGN VERIFIED / EXECUTION ABSENT

Source implementation:
  BLOCKED

Final stop:
  Wait for independent review and explicit user authorization.
```

This is the final design report. It does not authorize source implementation,
database migration, Windows service/ACL/CNG changes, Storage access, Build,
Native RPC, Worker Drain or deployment.

