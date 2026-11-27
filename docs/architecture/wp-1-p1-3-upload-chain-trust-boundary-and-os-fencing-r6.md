# WP-1F — Broker Trust Boundary and OS Fencing Closure R6

## 0. Document Control

```text
Stage: WP-1F
Mode: READ-ONLY INVESTIGATION / DESIGN CORRECTION
Date: 2026-11-25
Repository: D:\thinkbook\Desktop\jieya
Branch at start: codex/public-github-sync
HEAD at start: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main at start: 101e8a362e430f4fa7b31b67c56823cb702eb1e6

Design result:
  PASS WITH WARNINGS — TRUST BOUNDARY DESIGN COMPLETE

Implementation:
  BLOCKED — WINDOWS OS AUTHORITY, DB ROLES/MIGRATIONS, ACCESS EVIDENCE
  AND DRAIN EVIDENCE DO NOT EXIST
```

This report is design-only. It does not modify source, Schema, Migration,
Trigger, configuration or tests; it does not execute SQL, database, Storage,
Windows ACL, service, Build, Native RPC or Worker Drain operations.

Evidence labels:

```text
DESIGN DEFINED
  Normative protocol in this report.

SOURCE VERIFIED
  Current source/Schema/Migration is present and cited.

DB VERIFIED
  Not available in this task; no database connection or SQL.

WINDOWS OS VERIFIED
  Not available in this task; no native probe or ACL mutation.

NOT VERIFIED
  Requires separate implementation and runtime evidence.
```

### 0.1 Skills Applied

- `$project-architecture`
- `$prisma-db-safety`
- `$security-audit`
- `$testing-and-verification`
- `$file-lifecycle`

## 1. Threat Model

### 1.1 Trusted Computing Base

The following is the selected threat model:

```text
Storage Authority Broker = trusted computing base

Broker code, service identity, protected private key, target-seal logic,
native file identity probes and OS session handling are trusted.

Broker full compromise = trust boundary failure.

Inventory evidence and historical status are untrusted inputs until verified.
```

This means:

- a compromised Broker can forge OS facts; the database cannot rescue that
  claim;
- a compromised Broker must invalidate the boot epoch, current evidence and
  publication authority;
- a DB role alone is not proof of a Windows process;
- a digest, path, content hash or DB row is not an OS fact;
- no user may obtain Broker OS/DB capabilities through a normal Web/Worker
  role.

### 1.2 In-Scope Failure Classes

The following are handled by protocol and fail-closed behavior:

- Broker crash, restart, DB disconnect, timeout and temporary unavailability;
- two Broker processes attempting to start;
- an old Broker process paused and later resuming;
- old capability replay;
- DB COMMIT response loss;
- target partial copy, target replacement and stale staging handles;
- Recovery Worker competing with the original owner;
- Legacy queue replay and old cleanup process remnants.

### 1.3 Out-of-Scope Failure Classes

If the Broker service binary, private key, DB credential or OS identity is
fully compromised, the system must enter `TRUST_BOUNDARY_FAILED`; it must not
claim Evidence or publication success. An independent OS witness or hardware
attestation is a separate future design, not silently assumed.

## 2. Source Baseline

### 2.1 Git

At start:

```text
Branch: codex/public-github-sync
HEAD: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified: 0
Staged: 0
Deleted: 0
Untracked: 12
```

The existing untracked files, including `$null`, `UNKNOWN'`, prior reports and
`__pycache__/`, are preserved. `$null` and `UNKNOWN'` were not read, hashed,
modified, moved or deleted.

### 2.2 Current Source Facts

| Location | Fact |
|---|---|
| `apps/web/src/modules/files/upload-service.ts:155-236` | Legacy Intent staging key. |
| `apps/web/src/modules/files/upload-service.ts:267-441` | Current stream and legacy finalize path. |
| `apps/web/src/modules/files/upload-service.ts:443-575` | FileVersion without P1-3 chain fields. |
| `packages/file-storage/src/local-private-storage.ts:108-191` | Current `wx`/close and `access`/`rename` finalize. |
| `packages/file-storage/src/capabilities.ts` | Raw read stream remains exposed. |
| `apps/web/src/modules/files/download-service.ts:242-495` | No explicit ACTIVE lifecycle/evidence join. |

### 2.3 Current Schema

- `prisma/schema.prisma:398-443`: FileVersion chain fields.
- `prisma/schema.prisma:501-655`: Intent/Attempt/Lifecycle/Operation.
- `prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:992-1004`:
  actual Operation transitions:

```text
PREPARED  -> EXECUTING | FAILED | ABANDONED
EXECUTING -> APPLIED | UNKNOWN | FAILED
UNKNOWN   -> APPLIED | FAILED | ABANDONED
```

- Same Migration, lines 603-825: Attempt/ownership guards.
- Same Migration, lines 1194-1357: upload chain assertions.
- Same Migration, lines 1797-1947: FileVersion/lifecycle/finalize checks.
- Same Migration, lines 1949-2005: Intent guard; legacy fields not protected.

## 3. WP-1E-R Findings Closure Map

| WP-1E-R finding | R6 correction | Status |
|---|---|---|
| P1-01 Broker DB credential/OS identity | Service SID + CNG-protected mTLS certificate + DB role chain | `DESIGN DEFINED` |
| P1-02 two/old Broker fencing | Service singleton + global mutex + Job/session + boot epoch + fail-closed | `DESIGN DEFINED` |
| P1-03 Recovery CAS/session atomicity | DB CAS revokes old session and issues `PENDING_OS_FENCE` new session | `DESIGN DEFINED` |
| P1-04 Evidence OS trust gap | Broker TCB declaration + boot-bound ingestion + invalidate on compromise | `DESIGN DEFINED` |
| P1-05 Active FileVersion to legacy archive | Preserve old table, create new active table and archive mapping | `DESIGN DEFINED` |
| P1-06 D0–D10 executive evidence | Exact command/evidence catalog and rollback transcript | `DESIGN DEFINED` |

No P1 is `DB VERIFIED`, `WINDOWS OS VERIFIED` or `RUNTIME VERIFIED`.

## 4. Broker Identity and DB Credential

### 4.1 Unique Identity Chain

Selected chain:

```text
Windows Service Object
  -> dedicated Service SID
  -> protected Broker binary/config/private-key ACL
  -> CNG non-exportable broker client certificate/private key
  -> PostgreSQL TLS client-certificate authentication
  -> dedicated Broker DB role
```

The Broker service SID is the only principal allowed to read the broker
certificate/private key and service configuration. The DB role is not a
general application role and cannot be used by Web, Worker, Maintenance or
Recovery processes.

### 4.2 What Each Fact Proves

| Fact | Proves | Does not prove |
|---|---|---|
| Service SID | Windows service identity owns broker files/private key | The currently executing broker code is uncompromised |
| mTLS certificate/DB role | DB connection is authenticated to Broker role | Windows PID or current process image |
| PID/creation time | Diagnostic/session correlation | That a new process is the same trusted broker |
| Boot epoch | Which broker boot registered authority | That old handles are closed |
| DB session revocation | DB authority is withdrawn | Old OS handles are closed |
| target seal/ACL | old identities cannot obtain new write/delete access | Existing handles are revoked |

### 4.3 DB Authentication

The selected transport is not trust a client-supplied PID or SID. PostgreSQL
authenticates the Broker certificate and maps it to the dedicated role.

The Broker uses a narrow DB interface:

```text
register_boot_epoch()
acquire_authority_session()
verify_authority_session()
consume_authority_capability()
revoke_authority_session()
append_publication_evidence()
append_recovery_verification()
```

The DB role has no arbitrary table write/DDL/role/ACL access. Function owners
are separate NOLOGIN roles. `PUBLIC` EXECUTE is revoked.

### 4.4 Credential Rotation

```text
new certificate/key provision
-> broker service restart with old session marked stale
-> prove old handle/process termination
-> revoke old session/boot epoch
-> register new boot epoch
-> resume publish capability
```

If rotation or old-process termination is incomplete, Broker remains
read-only/blocked. No interactive Administrator broker run is allowed as a
fallback.

## 5. Single Active Broker and OS Fencing

### 5.1 Startup Gate

The Broker cannot open v2 Storage Root write authority until it has:

1. acquired the Windows service singleton mutex;
2. registered a new boot epoch and accepted the DB singleton/lease record;
3. verified no old Broker process/child/session is active;
4. verified old file handles/authority are closed or marked unknown;
5. obtained the v2 Root handle under the Broker SID ACL;
6. entered `PUBLISH_ENABLED`.

If any step is unknown:

```text
BROKER_STATE = READ_ONLY / BLOCKED
```

The DB cannot itself verify Windows PID/SID. Windows service/SCM/Job/mutex
evidence is authoritative for the OS side; the DB only records state.

### 5.2 Arbitration State Machine

```text
ABSENT
  -> STARTING
  -> OS_SINGLETON_HELD
  -> DB_BOOT_REGISTERED
  -> OLD_AUTHORITY_CHECK
  -> PUBLISH_ENABLED

STARTING/any -> BLOCKED
  if mutex, DB epoch, process, handle or ACL evidence is unknown

PUBLISH_ENABLED
  -> DRAINING
  -> STOPPED
```

Two Broker A/B:

```text
A holds global mutex and DB boot epoch.
B fails mutex or DB active-boot check.
B cannot open v2 root for write.
```

If A is paused but still holds handles, B must not enter PUBLISH_ENABLED.
SCM/Job termination and handle evidence must be obtained; DB session revocation
alone is insufficient.

### 5.3 Old Broker Process Rules

- Broker does not create children with inherited file handles.
- If a child exists, the Broker owns a Job only for that child and must wait
  for Job termination.
- Service restart must terminate the old process tree before the new process
  receives v2 write capability.
- A paused process is considered live until SCM/Job/session evidence proves
  exit.
- A crashed process is considered unknown until OS handle closure is checked.
- If the old process cannot be terminated or handle release cannot be verified,
  new Broker stays blocked.

### 5.4 Recovery Ownership Transfer

```text
DB recovery CAS
  -> revoke old Authority Session
  -> new session state PENDING_OS_FENCE
  -> old process/session fencing
  -> OS handle/ACL evidence
  -> new session ISSUED
  -> Broker PUBLISH_ENABLED
```

The new owner has DB ownership before OS PUBLISH permission, but cannot
publish until the new Authority Session becomes `ISSUED`. The old session is
`REVOKED` in the same DB transaction as the owner/generation CAS.

If the OS fence fails, Operation remains `UNKNOWN`; no new target, FileVersion
or APPLIED state.

## 6. Recovery CAS and Authority Session Revocation

### 6.1 Normative DB Transaction

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;

SELECT pg_advisory_xact_lock(hashtextextended($storage_key, 0));

SELECT * FROM "file_upload_intent" WHERE id=$intent_id FOR UPDATE;
SELECT * FROM "storage_object_lifecycle" WHERE id=$lifecycle_id FOR UPDATE;
SELECT * FROM "storage_object_operation" WHERE id=$operation_id FOR UPDATE;
SELECT * FROM "file_upload_attempt" WHERE id=$attempt_id FOR UPDATE;

-- Old authority is withdrawn before the new owner can publish.
UPDATE "storage_authority_session"
SET state='REVOKED', revokedAt=now()
WHERE operationId=$operation_id
  AND state IN ('ISSUED','CONSUMED');

UPDATE "storage_object_operation"
SET
  ownerToken=$new_owner_digest,
  ownerPrincipalId=$new_owner_principal,
  fencingGeneration=fencingGeneration+1,
  recoveryGeneration=recoveryGeneration+1,
  heartbeatAt=now(),
  leaseExpiresAt=$new_lease,
  authoritySessionId=$new_session_id
WHERE id=$operation_id
  AND state IN ('EXECUTING','UNKNOWN')
  AND fencingGeneration=$expected_generation
  AND leaseExpiresAt <= now();

-- Rowcount must be 1; otherwise rollback and do not call Broker.

UPDATE "storage_object_lifecycle"
SET
  ownerToken=$new_owner_digest,
  heartbeatAt=now(),
  leaseExpiresAt=$new_lease,
  authoritySessionId=$new_session_id,
  fencingGeneration=$expected_generation+1,
  recoveryGeneration=recoveryGeneration+1
WHERE id=$lifecycle_id
  AND fencingGeneration=$expected_generation;

INSERT INTO "storage_authority_session"
  (... state='PENDING_OS_FENCE', operationId=$operation_id, ...);

COMMIT;
```

This transaction makes old capability rejection and new ownership durable.
It does not close old Windows handles.

### 6.2 OS Fence Step

After commit:

```text
Broker verifies old boot/session is not PUBLISH_ENABLED
-> SCM/Job/process tree proves old process exited or is terminated
-> native handle/mmap inventory proves no old writer/delete handle
-> v2 ACL proves old SID has no create/write/delete/reparse
-> new session PENDING_OS_FENCE -> ISSUED
```

If any OS fact is unknown:

```text
new session remains PENDING_OS_FENCE
Operation remains UNKNOWN
no publish
```

### 6.3 Response Loss

If the DB COMMIT response is lost, a new connection reads:

- Operation owner/generation/recoveryGeneration;
- lifecycle owner/generation/lease;
- old session state;
- new session state.

If committed, recovery can resume only after OS fence. If not committed,
nothing may be retried until the old owner/session state is re-read.

## 7. Publication Evidence Trust Boundary

### 7.1 Unique Trusted Chain

```text
Windows OS Probe
  -> Broker internal validation
  -> canonical Evidence
  -> restricted SECURITY DEFINER ingestion
  -> append-only Evidence
  -> FileVersion evidence FK
  -> verified read
```

The Broker is the only producer of OS facts. SECURITY DEFINER only controls
who may insert a normalized Evidence row. It does not independently prove
Windows File ID, handle closure, Reparse or ACL behavior.

### 7.2 Evidence Fields and Binding

Evidence must bind:

```text
Attempt, Intent, Operation, canonical Lifecycle, storageKey
Authority Session, Boot Epoch, Broker Service SID
staging/target Volume Serial and File ID
target parent File ID / namespace
target size/SHA-256
Reparse verification
writerClosed
target seal/ACL digest
publication timestamps
```

The FileVersion insert guard must require an accepted evidence row whose
operation/attempt/intent/lifecycle/storageKey match and whose session/boot
epoch is current.

### 7.3 Broker Compromise

If Broker code, credential or private key is compromised:

```text
TRUST_BOUNDARY_FAILED
all sessions/evidence from that boot epoch INVALIDATED
new publish disabled
objects retained
no new FileVersion
manual incident review
```

The design does not claim that SECURITY DEFINER or a digest can repair a
compromised Broker. If this guarantee is required, a separate independent OS
witness/hardware attestation design is required.

### 7.4 Evidence Order

```text
T5 EXECUTING
-> Broker CREATE_NEW/copy/close/reopen/verify
-> restricted Evidence ingestion commits
-> T7 APPLIED/ACTIVE/COMPLETED/FileVersion
```

Evidence write failure: target retained, Operation EXECUTING/UNKNOWN, no
FileVersion. Evidence success/T7 failure: evidence retained, same Operation may
retry T7. T7 commit/response loss: same evidence/FileVersion queried.

## 8. Authority Session — One Protocol

### 8.1 Selected Store

The authoritative store is PostgreSQL. Broker local state is an in-memory
cache only and cannot authorize after restart.

```text
StorageAuthoritySession
  id
  operationId
  attemptId
  storageKey
  authorityBootEpoch
  brokerServiceSid
  callerSid
  callerPid
  callerCreationTime
  capabilityDigest
  state: PENDING_OS_FENCE | ISSUED | CONSUMED | RELEASED | REVOKED | EXPIRED
  requestId
  leaseExpiresAt
  publicationEvidenceId
  issuedAt
  consumedAt
  revokedAt
```

Constraints:

```text
one active session per operation
unique (operationId, requestId)
unique capabilityDigest
session bound to operation/generation/namespace
terminal session cannot return to ISSUED/CONSUMED
```

### 8.2 Broker DB Role

The DB role has only EXECUTE on the narrow functions and SELECT on minimized
views:

```text
p13_register_broker_boot_epoch
p13_acquire_authority_session
p13_verify_authority_session
p13_consume_authority_capability
p13_revoke_authority_session
p13_append_publication_evidence
p13_append_recovery_verification
```

Function owners are dedicated NOLOGIN roles. `PUBLIC` EXECUTE is revoked.
The Broker DB credential is readable only by the Broker service SID via
protected CNG/mTLS material. DB authentication proves the credential/DB role,
not Windows PID/SID.

### 8.3 Capability and Boot Epoch

```text
raw capability: Broker memory and authenticated caller only
DB stores: digest
binding: operationId, attemptId, storageKey, namespace, generation, bootEpoch
one-use: ISSUED -> CONSUMED
old boot epoch: all old capabilities invalid
revoked: immediate DB rejection; old OS handle still requires process fence
```

Broker startup:

```text
generate epoch
-> acquire singleton/process fence
-> register epoch
-> revoke old sessions
-> verify old process/handles
-> PUBLISH_ENABLED
```

If DB is unavailable, no new authority, no capability consumption and no
publish.

## 9. Windows Identity / ACL / Target Seal

### 9.1 Required Probe Fields

```text
target Volume Serial
target File ID (128-bit)
target parent File ID
staging Volume Serial/File ID
final path by handle
FILE_STANDARD_INFO
FILE_ATTRIBUTE_TAG_INFO
Reparse tag/state for every component
NumberOfLinks/DeletePending
size/SHA-256
writer close evidence
target seal digest
ACL security descriptor digest
old-SID AccessCheck result
```

The exact native sequence is:

```text
CreateFileW
GetFinalPathNameByHandleW
GetFileInformationByHandleEx(FILE_ID_INFO)
GetFileInformationByHandleEx(FILE_STANDARD_INFO)
GetFileInformationByHandleEx(FILE_ATTRIBUTE_TAG_INFO)
FlushFileBuffers
CloseHandle
read-only reopen
SetSecurityInfo / approved sealer
GetSecurityInfo / AccessCheck
```

### 9.2 Copy-on-Publish

```text
create target with CREATE_NEW
copy exact source bytes
sync
close writer
reopen read-only
verify target/staging distinct object
verify size/hash/File ID/volume/parent/Reparse
seal parent and target ACL
record Evidence
```

`rename`, hard link, same path, same hash and a successful API return are not
sufficient publication proof.

### 9.3 Existing Handles

An ACL change does not revoke an already-open handle. Target seal is useful only
after the old Broker process/session is proven terminated or unable to issue
new file operations. If old handles are unknown, publication is blocked.

### 9.4 Fail-Closed Matrix

| Condition | Result |
|---|---|
| Volume/File ID unavailable | UNKNOWN/BLOCKED |
| Reparse/ancestor reparse unknown | BLOCKED |
| Source and target same object | FAILED_RETAINED |
| Target exists/different content | FAILED_RETAINED |
| Writer close/handles unknown | UNKNOWN |
| Old SID still can write/delete | BLOCKED |
| Target/ACL changes after evidence | integrity FAILED |
| Broker boot/session stale | AUTHORITY_DENIED |

## 10. Legacy FileVersion / Read-only Isolation

### 10.1 Selected Migration Architecture

Do not delete or rewrite immutable historical `file_version` rows. Use a
two-table separation:

```text
legacy_file_version
  original FileVersion ID
  original File/Intent IDs
  original metadata/checksum/storageKey
  source snapshot digest
  legacyReason
  legacyState: READ_ONLY | BLOCKED
  archivedAt
  immutable archive trigger

file_version_v2
  active P1-3 FileVersion only
  publicationEvidenceId NOT NULL
  active Lifecycle/Attempt/Operation chain
```

The existing active `file_version` table is preserved as read-only history; a
forward migration creates the v2 active table and archive mapping. Normal
application queries use `file_version_v2`; the old table is never mass-deleted
or rewritten by an ordinary application path.

If a mapped record can be safely activated, it is copied to v2 with its
original ID and a `HISTORICAL_VERIFIED` evidence record. Unmapped rows remain
in legacy archive only.

### 10.2 Evidence Rule

```text
new active FileVersion:
  publicationEvidenceId NOT NULL

mapped historical FileVersion:
  HISTORICAL_VERIFIED evidence + source provenance

legacy archive:
  no active publicationEvidenceId; no normal download
```

The old active table is not converted in place with nullable/new-default
fields. This avoids hiding missing evidence.

### 10.3 API Contract

```text
normal list/download/file reference:
  file_version_v2 + ACTIVE Lifecycle + accepted Evidence only

legacy history:
  special legacy.read metadata contract only
  no ordinary download/preview
  no new Attempt/Extraction/Review
  no new upload reference
```

### 10.4 Migration/Interruption

```text
read-only inventory
-> archive snapshot/copy
-> verify counts and IDs
-> mapped-row promotion
-> active v2 switch
-> legacy rows remain read-only
```

Any duplicate, orphan, mismatched checksum, missing target identity, failed
archive copy or ambiguous mapping stops before switch. No cleanup is performed
to make migration pass.

## 11. Legacy Drain D0–D10 Evidence

### 11.1 Step Evidence Contract

| Step | Action / check | Identity | Evidence |
|---|---|---|---|
| D0 | Freeze new legacy/v2 upload and cleanup admission | deployment/security | config/API/queue admission snapshot |
| D1 | Inventory old Web/Worker/Cleanup/services/schedulers/artifacts | runtime owner | `Get-CimInstance Win32_Process`, `Get-Process`, service/task list, image hashes, process tree |
| D2 | Disable old queue consumers, retries, delayed/dead-letter/recreated jobs | runtime owner | queue state/count snapshot and consumer config |
| D3 | Drain active jobs to terminal/retained | runtime owner | job IDs, state, timestamps, terminal evidence |
| D4 | Disable restart/watchdog/scheduler | runtime owner | service/task/watchdog control evidence |
| D5 | Stop old processes and prove exit | runtime owner | PID+creation time, exit code, child/restart absence |
| D6 | Prove file handles/mmap/inherited/duplicate handles released | native/security | approved handle/mmap inventory or broker session evidence |
| D7 | Verify `.next`/`dist` identity and runtime references without treating presence as process status | build/runtime | file identity/hash and process/image reference evidence |
| D8 | Prove v2 root/parent/target ACL effective access | security/native | ACL/SDDL + AccessCheck for old SIDs |
| D9 | Switch v2 admission and canary | release | canary upload/read/evidence transcript |
| D10 | Monitor old processes/cleanup/v2 access | operations/security | continuous process/service/audit/queue evidence |

### 11.2 Queue and Handle Gates

The following must all be zero/unknown-free before D9:

```text
retry jobs, delayed jobs, dead-letter jobs
scheduled maintenance/jobs, recreated consumers
old Worker processes/children
inherited/duplicate/mmap/external file handles
active cleanup operations
old SID effective v2 write/delete/reparse access
```

Process exit alone is not handle release. Directory presence is not process
presence. DB `DELETED` is not OS deletion.

### 11.3 Rollback Transcript

```text
D9 failure
-> stop v2 admission
-> revoke all capabilities/new boot epoch
-> retain v2 objects
-> keep old cleanup without v2 access
-> if returning to read-only legacy state, verify old paths/deletes are
   disabled
-> if old cleanup isolation cannot be proven, remain BLOCKED
```

Never rollback by granting old cleanup broad v2 Storage/ACL permission or by
deleting v2 objects.

## 12. P2 Exact Design

### 12.1 Legacy Intent Guard

Future forward Migration:

```sql
ALTER TABLE "file_upload_intent"
  ADD COLUMN "legacyState" "LegacyIntentState" NOT NULL DEFAULT 'NONE';

ALTER TABLE "file_upload_intent"
  ADD CONSTRAINT "intent_legacy_fields_shape_check"
  CHECK (
    ("legacyState" = 'READ_ONLY' AND "stagingKey" IS NOT NULL)
    OR
    ("legacyState" = 'NONE'
      AND "stagingKey" IS NULL AND "objectStorageKey" IS NULL)
  );
```

Trigger rules:

```text
new NONE Intent with legacy fields -> reject
NONE update setting legacy fields -> reject
READ_ONLY only migration role
READ_ONLY cannot create Attempt/FileVersion/currentAttempt
```

### 12.2 T7 Target Ownership

```sql
BEGIN SERIALIZABLE;
SELECT ... FROM "file" WHERE id=$file_id FOR UPDATE;
SELECT ... FROM "project" WHERE id=$project_id FOR SHARE;
SELECT ... FROM "building" WHERE id=$building_id FOR SHARE;
SELECT ... FROM "installation_unit" WHERE id=$unit_id FOR SHARE;
-- require file.projectId=intent.projectId
-- require file.customerId=project.customerId
-- require file.buildingId=intent.buildingId
-- require file.installationUnitId=intent.installationUnitId
-- require file.status=ACTIVE
-- compute version under File lock
```

### 12.3 sourcePath Binding

Future Trigger:

```text
FINALIZE Operation:
sourceAttemptId = Attempt.id
sourcePath = Attempt.stagingKey
targetPath = Canonical Lifecycle.storageKey
objectLifecycleId = Canonical Lifecycle.id
storageKey = Canonical Lifecycle.storageKey
```

### 12.4 Lease/Heartbeat

```text
heartbeat: 30s
lease: 120s
renew CAS:
  ownerToken + fencingGeneration + nonterminal state + lease > now
```

Heartbeat failure stops reading; it does not grant a new handle or revive a
terminal Operation.

### 12.5 Fixture and Fault Hooks

```text
fixture:
User -> Customer -> Project -> Building -> InstallationUnit -> File
-> Intent -> Attempt -> STAGING_RESERVED -> STAGING
-> STAGING_READY + close attestation
-> CANONICAL FINALIZING + FINALIZE PREPARED
-> EXECUTING -> PublicationEvidence -> FileVersion/ACTIVE/COMPLETED

hooks:
afterClaim, afterStagingWrite, before/afterClose, afterPrepare,
afterExecuteCAS, before/afterBrokerCopy, afterBrokerClose,
afterEvidenceInsert, before/afterT7, before/afterCommit,
afterResponseLoss, afterBrokerRestart, afterCapabilityRevocation
```

Tests use a disposable DB clone, isolated test storage, two connections and no
Trigger disabling/production data.

### 12.6 Verified Lifecycle Read

```text
authorize project/customer
-> active FileVersionV2
-> exactly one ACTIVE canonical Lifecycle
-> accepted Evidence
-> Broker verified handle
-> Volume/File ID/parent/size/hash/Reparse
-> download policy
-> body
```

Raw `openReadStream` is not exposed to normal Web/Worker runtime. Missing
evidence/identity blocks access and marks integrity failure.

## 13. Full Cross-Layer Execution Matrix

| Step | Unique actor | Identity/permission | DB state | OS action | Evidence | Failure/recovery | Race |
|---|---|---|---|---|---|---|---|
| Web intent | Web | auth, project file.upload | PENDING Intent | none | fingerprint | idempotent replay | duplicate POST |
| Claim | Web | owner/project | UPLOADING/WRITING/STAGING | none | lifecycle rows | abort/retry | two PUT |
| Stage | Broker | Broker client | WRITING/STAGING | exclusive staging write | close/identity | retain | heartbeat |
| Close | Broker | Broker client | READY/STAGING_READY | sync/close/reopen | close attestation | fail closed | lease |
| Prepare | Web/DB | generation CAS | FINALIZING/PREPARED | none | operation | ABANDONED/FAILED | finalizers |
| Execute | Web/DB | EXECUTING authority | EXECUTING | Broker capability | authority session | UNKNOWN | stale worker |
| Publish | Broker | Broker service | FINALIZING | CREATE_NEW/copy/seal | publication evidence | retain/UNKNOWN | two Broker |
| Evidence | Broker/DB definer | restricted writer | Evidence row | none | immutable evidence | T6E failure | duplicate Evidence |
| T7 | Web/DB | File lock | ACTIVE/COMPLETED | none | FileVersion/audit | COMMIT unknown | recovery |
| Read | Web/Broker | file.read | ACTIVE + one FV | verified read | download audit | block | replacement |
| Drain | Deployment | service/ACL authority | no old v2 writes | no old process | D0-D10 evidence | block/retain | old cleanup |

## 14. Failure Injection Matrix

| ID | Scenario | Wrong possibility | Allowed | Forbidden | Final/acceptance |
|---|---|---|---|---|---|
| F1 | two Recovery Workers | both terminalize | one CAS/session | two effects | one result |
| F2 | old Worker late | writes/publishes | reject generation | apply old result | UNKNOWN/retained |
| F3 | Broker restart | old capability works | revoke/reacquire | reuse old | AUTHORITY_DENIED |
| F4 | DB unavailable | Broker continues | stop/UNKNOWN | APPLIED | target retained |
| F5 | capability replay | second publish | deny/audit | consume twice | no effect |
| F6 | Evidence insert fail | ACTIVE without evidence | retain/reverify | create FileVersion | no active |
| F7 | target replaced | read target B | identity mismatch/fail | overwrite | no read |
| F8 | legacy queue replay | old job runs | block/stop | process old job | no old task |
| F9 | inherited handle | writes v2 | handle probe/drain | ACL-only claim | blocked |
| F10 | rollback cleanup | deletes v2 | deny/retain | restore broad access | blocked/retained |
| F11 | PREPARED crash | tries UNKNOWN | ABANDONED/FAILED | PREPARED→UNKNOWN | no target |
| F12 | EXECUTING crash | assumes no effect | UNKNOWN + session probe | cleanup | retained |
| F13 | Evidence/T7 split | duplicate FV | same T7 retry | rewrite evidence | one evidence/FV |
| F14 | canonical missing | serves empty/other | integrity failed | replace object | blocked |

## 15. User Decision Register

### A. Derived From Security Invariants

- A-01: PREPARED timeout never becomes UNKNOWN.
- A-02: DB lease/session revocation is not OS handle closure.
- A-03: no active FileVersion without accepted Evidence.
- A-04: no old history is guessed into a new chain.
- A-05: no source/Migration/Broker/Drain execution in this task.
- A-06: R5/BV7/BV8/R8 states remain unchanged.

### B. Recommended, User Approval Required

| ID | Recommendation | Tradeoff |
|---|---|---|
| B-01 | Dedicated Windows Service + Service SID + CNG mTLS | High assurance; operational complexity |
| B-02 | Single active Broker with SCM/global mutex/Job | Required for old-process fencing; restart complexity |
| B-03 | DB-authoritative Authority Session | One authoritative store; DB availability dependency |
| B-04 | SECURITY DEFINER Evidence ingestion | Broker remains TCB; no independent witness |
| B-05 | same local NTFS volume | simpler identity proof; deployment limit |
| B-06 | 30s/120s lease | retry/operability tradeoff |
| B-07 | old table preserved; new active FileVersion table | avoids destructive migration; schema/API complexity |
| B-08 | separate legacy read permission/API | user policy and route work |
| B-09 | D0–D10 drain before v2 | downtime and operator effort |
| B-10 | separate DB roles and ACLs | provisioning/maintenance effort |

### C. Evidence Missing — Investigate

- C-01: Windows Service SID/CNG/DB mTLS behavior.
- C-02: SCM/global mutex/Job/process-tree termination and handle enumeration.
- C-03: Windows File ID/Volume/Reparse/handle-close/ACL behavior.
- C-04: actual Broker restart and old-process recovery.
- C-05: actual historical data counts, mapping and archive behavior.
- C-06: actual old Worker/queue/cleanup/artifact inventory.
- C-07: PostgreSQL Trigger/COMMIT/lock behavior.
- C-08: actual v2 root/parent/target ACL and effective access.
- C-09: actual rollback/handle release transcript.

## 16. R5 / BV7 / BV8 / R8 Status

```text
R5 independent review: FAIL — DESIGN CORRECTIONS REQUIRED
R5 Open Decisions: 57/57 OPEN; 0 approved
BV7: FAIL — BLOCKING DESIGN CORRECTIONS REQUIRED
BV8: READY FOR INDEPENDENT REVIEW; NOT APPROVED
R8: BLOCKED — REQUIRED DESIGN EVIDENCE MISSING
```

No baseline state is changed. The Storage Authority Broker is separate from
the R4/R5 Termination Host/Worker/Helper and must not reuse their service,
credential or ACL authority.

## 17. Remaining Risks and Implementation Blockers

| ID | Severity | Status |
|---|---|---|
| R6-P1-01 | P1 | Dedicated Broker identity and credential chain not implemented |
| R6-P1-02 | P1 | Single-active Broker and old-process/handle fence not verified |
| R6-P1-03 | P1 | Recovery CAS/old-session revocation and OS handoff not tested |
| R6-P1-04 | P1 | Evidence trust boundary is Broker TCB and not independently witnessed |
| R6-P1-05 | P1 | Active-to-legacy table migration not implemented |
| R6-P1-06 | P1 | D0–D10 process/queue/handle/ACL evidence not executed |
| R6-P2-01 | P2 | Exact DB role/function/Migration/Trigger implementation absent |
| R6-P2-02 | P2 | Fixture SQL and fault hooks absent |
| R6-P2-03 | P2 | Normal read evidence/lifecycle integration absent |
| R6-P3-01 | P3 | Environment-specific evidence labels/hashes absent |

Hard stop:

```text
NO source implementation
NO Schema/Migration
NO Native Broker Build
NO Windows ACL/Service changes
NO Storage publish/read
NO Worker Drain
NO deployment
```

## 18. Git and Non-Action Record

At start:

```text
Branch: codex/public-github-sync
HEAD: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified: 0
Staged: 0
Deleted: 0
Untracked: 12
```

The final state is recorded in the delivery message. The report adds one
untracked file. Existing `$null`, `UNKNOWN'`, WP-1/WP-1R/WP-1C/WP-1C-R/WP-1D/
WP-1D-R/WP-1E/WP-1E-R reports, `__pycache__/` and the baseline report remain
untouched.

No source, Schema, Migration, Trigger, configuration or test was modified.
No database, Storage, Windows ACL, Service, E2E, Build, Native RPC or drain
was executed. `$null`, `UNKNOWN'`, `.next` and `.dist` were not read,
modified, moved or deleted.

## 19. Final Design Verdict

```text
Protocol design:
  PASS WITH WARNINGS — TRUST BOUNDARY DESIGN COMPLETE

Broker DB credential/OS identity:
  DESIGN DEFINED — service SID + CNG mTLS + DB role

Single active Broker / old handle fence:
  DESIGN DEFINED — SCM/global mutex/Job/process/handle fail-closed

Recovery and session revocation:
  DESIGN DEFINED — CAS + old-session revoke + PENDING_OS_FENCE

Publication Evidence:
  DESIGN DEFINED — Broker TCB + restricted ingestion; OS proof NOT VERIFIED

Legacy archive:
  DESIGN DEFINED — preserve old table + new active table + legacy API

Drain:
  DESIGN DEFINED — D0–D10 evidence gates

Implementation:
  BLOCKED — no source, Database, Windows OS, ACL, Storage or runtime evidence

Independent review:
  REQUIRED
```

This is the mandatory stop point. Do not implement source, apply Schema or
Migration, build/start the Broker, change ACLs, execute drain, access Storage
or deploy without separate authorization.
