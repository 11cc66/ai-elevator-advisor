# WP-1I — Final Architecture Blocker Closure

## 0. Document Control

```text
Stage: WP-1I
Mode: READ-ONLY INVESTIGATION / FINAL ARCHITECTURE DESIGN
Date: 2026-11-25
Repository: D:\thinkbook\Desktop\jieya
Branch at start: codex/public-github-sync
HEAD at start: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main at start: 101e8a362e430f4fa7b31b67c56823cb702eb1e6

Design result:
  PASS WITH WARNINGS — ARCHITECTURE BLOCKERS CLOSED

Implementation:
  BLOCKED — ISOLATED WINDOWS/POSTGRESQL/STORAGE VERIFICATION AND USER
  APPROVAL NOT AVAILABLE
```

This is a design closure, not source implementation, Migration, Windows
Service/ACL/CNG operation, Storage operation or runtime validation.

Evidence labels:

```text
DESIGN VERIFIED
  The protocol is internally specified.

PLATFORM GUARANTEE DOCUMENTED
  Official platform semantics support the design direction, but no target
  environment measurement exists.

ISOLATED ENVIRONMENT VERIFIED
  Real disposable Windows/PostgreSQL/Storage evidence exists. NOT EXECUTED.

PRODUCTION VERIFIED
  Authorized production evidence exists. NOT EXECUTED.

NOT VERIFIED
  No execution or native evidence.
```

## 1. Threat Model

### 1.1 Trusted Computing Base

Route A is selected as the sole architecture:

```text
One Windows Storage Authority Broker
  + one protected service identity
  + protected CNG/mTLS/DB credential
  + native file identity and target-seal logic
  + external management recovery boundary
```

Trusted:

- Broker binary/config/code-integrity policy;
- Broker service SID and protected private key;
- Broker native probes and target seal;
- Broker DB role through mTLS;
- external management recovery identity, used only for containment.

Not trusted for OS facts:

- Web, Worker, Maintenance, Recovery or user processes;
- PostgreSQL rows, digests or audit records alone;
- any client-supplied PID/SID/token;
- an old Broker process or old capability.

### 1.2 Failure Boundary

```text
Broker crash/restart/DB outage:
  handle by authority/fence protocol.

Broker process or credential fully compromised:
  TRUST_BOUNDARY_FAILED;
  current boot Evidence invalid;
  publication/read disabled;
  external management containment required.

Local Administrator/SYSTEM/kernel compromise:
  outside Route A software guarantee unless a separate external witness/
  hardware trust root is approved.
```

The Broker cannot prove its own code is uncompromised. This is an explicit
Route A limitation, not something hidden by Service SID, mTLS or digest fields.

## 2. Current Repository Facts

### 2.1 Git

At start:

```text
Branch: codex/public-github-sync
HEAD: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified: 0
Staged: 0
Deleted: 0
Untracked: 18
```

Existing untracked files, `$null`, `UNKNOWN'`, prior reports and
`__pycache__/` are preserved.

### 2.2 Current Code and Components

| Location | Fact |
|---|---|
| `apps/web/src/modules/files/upload-service.ts:155-236` | Legacy Intent stagingKey. |
| `apps/web/src/modules/files/upload-service.ts:267-599` | Current stream/finalize path. |
| `packages/file-storage/src/local-private-storage.ts:108-191` | Current `wx`/close and `access`/`rename`. |
| `packages/file-storage/src/capabilities.ts` | Raw `openReadStream` remains exposed. |
| `apps/web/src/modules/files/download-service.ts:242-495` | No explicit ACTIVE lifecycle/evidence join. |
| `apps/worker/src/worker-entry.ts:60-211` | Recognition and maintenance queues; maintenance schedule. |
| `apps/worker/src/maintenance-lease.ts` | `system_metadata.file_maintenance_lease`. |
| `packages/file-storage/src/legacy-cleanup.ts` | Legacy cleanup APIs fail closed. |

No Native Storage Authority Broker service, v2 namespace, dedicated Broker DB
role or real drain evidence exists in the repository.

## 3. External Management Recovery Authority

### 3.1 Identity

The recovery boundary is a separate operational identity/control plane, not
the Broker:

```text
StorageRecoveryOperator
  separate administrative workstation/session
  separate credential source
  no Broker CNG key
  no Broker DB credential
  no Web/Worker/Application DB role
```

The exact account/group names are user/deployment decisions. The operator may
be a human or a separately authorized recovery service; it must not be a
process running under the Broker service SID.

### 3.2 Required Capabilities

| Capability | Responsible identity | Evidence |
|---|---|---|
| Stop Broker | SCM/operator | service stop/exit receipt |
| Prevent restart | SCM/operator | service disabled/restart policy evidence |
| Revoke Broker CNG/key access | OS ACL owner | key ACL/denial proof |
| Revoke/rotate mTLS cert | PKI/operator | cert revocation/DB auth failure |
| Revoke Broker DB role/session | DB administrator | role/session revocation evidence |
| Isolate v2 namespace | Windows ACL owner | Effective Access proof |
| Invalidated old Evidence | DB/administrator + Broker boot epoch | boot/session revocation evidence |
| Rebuild trusted state | recovery operator + new Broker | new epoch/evidence chain |

The operator cannot claim OS handle closure merely from DB revocation.

### 3.3 Recovery Sequence

```text
1. Declare TRUST_BOUNDARY_FAILED.
2. Stop new publication and Authority issuance.
3. Stop/disable Broker and all old Broker processes.
4. Revoke old CNG/certificate/DB capabilities.
5. Isolate/deny v2 namespace to old identities.
6. Preserve objects and evidence without cleanup.
7. Verify old process/child/handle/section/mmap access.
8. Revoke old sessions and increment boot epoch.
9. If old access remains unknown, remain BLOCKED.
10. Only after OS proof, create a new Authority epoch and new Evidence chain.
```

Each step requires a separate evidence record and stop state. External
management unavailability leaves the system BLOCKED; the Broker cannot
self-recover a compromised trust boundary.

## 4. Broker TCB Identity and Integrity

### 4.1 Minimal TCB

```text
Windows Service SID
  -> protected CNG non-exportable key
  -> mTLS client certificate
  -> PostgreSQL dedicated minimum-privilege role

Broker binary/config
  -> signed deployment
  -> Service SID-only ACL
  -> controlled DLL search path
  -> code-integrity policy (WDAC or approved equivalent)
```

Authenticode signing alone is not runtime integrity proof. The TCB includes
the deployed Broker code and its code-integrity boundary; any injected code or
same-SID process is outside normal assurance and must trigger containment.

### 4.2 Service and Credential Boundary

- Broker runs as one dedicated service identity.
- Web/Worker/Maintenance/Recovery have no Broker CNG key or DB credential.
- Broker config/private key ACLs grant only the service SID and protected
  administrators needed for provisioning.
- PID, boot epoch and DB role are diagnostic/session facts, not Windows process
  proof.
- Credential rotation uses a new certificate/key and new boot epoch.
- An old certificate/session cannot authorize a new Broker process.

### 4.3 TCB Failure

```text
Broker compromise:
  stop publication/read;
  invalidate current boot Evidence;
  external recovery operator takes control;
  no automatic self-repair.
```

## 5. Storage Ownership and OS Fencing

### 5.1 Selected Ownership

```text
Broker: sole v2 root create/write/delete/ACL authority
Web: no direct v2 Storage access; Broker client only
Worker: verified read only; no direct write/delete
Maintenance: no canonical delete; Broker-only staging operation
Recovery: Broker operation only; no direct file mutation
Legacy cleanup: no v2 root access
External operator: stop/revoke/ACL isolation, not routine object writes
```

Current direct `LocalPrivateStorage` Web/Worker paths must be removed or
restricted before v2 upload enablement. The current legacy adapter remains a
legacy-only implementation.

### 5.2 Single Active Broker

Startup is allowed only after:

```text
SCM service singleton
-> global mutex with service-only DACL
-> old process/child/Job terminated or proven absent
-> old handle/section/mmap inventory clear or blocked
-> DB boot epoch registered
-> v2 root ACL old identities denied
-> PUBLISH_ENABLED
```

If any predecessor is unknown:

```text
PUBLISH_DISABLED / BLOCKED
```

`PID`, mutex, Job Object, service status or DB lease alone are not a complete
handle fence. They are evidence components.

### 5.3 Handle and Mapping Classes

The design must enumerate and test:

- inherited and duplicated file handles;
- section objects and memory mappings;
- child and external processes;
- Job breakaway/nested Jobs;
- parent directory handles;
- old Broker suspension/resume;
- old Broker service restart.

The new Broker may not open v2 root for write until old access is proven
released or the affected namespace is blocked.

## 6. Recovery State Machine

### 6.1 States

```text
AUTHORITY_ACTIVE
DB_AUTHORITY_REVOKED
OS_FENCE_PENDING
OS_FENCE_VERIFIED
NEW_AUTHORITY_PENDING
NEW_AUTHORITY_ACTIVE
RECOVERY_FAILED
TRUST_BOUNDARY_FAILED
QUARANTINED
MANUAL_RECOVERY_REQUIRED
```

### 6.2 Transitions

| Source | Target | Actor | DB/OS boundary | Failure |
|---|---|---|---|---|
| ACTIVE | DB_REVOKED | recovery/operator | DB transaction revokes old session | rollback |
| DB_REVOKED | OS_FENCE_PENDING | recovery worker | new PENDING session | PENDING retained |
| OS_FENCE_PENDING | OS_FENCE_VERIFIED | recovery/Broker | external process/ACL/handle proof | remain pending |
| OS_FENCE_VERIFIED | NEW_AUTHORITY_PENDING | recovery | new boot/session allocation | blocked |
| NEW_AUTHORITY_PENDING | ACTIVE | new Broker | DB issue + OS activation | active disabled |
| any | TRUST_BOUNDARY_FAILED | external management | compromise isolation | preserve objects |
| any | QUARANTINED | external management | namespace isolation | manual review |
| any | MANUAL_RECOVERY_REQUIRED | recovery | unverified evidence | blocked |

DB commit and OS proof are separate; no common atomicity is claimed.

### 6.3 Recovery CAS

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;
SELECT pg_advisory_xact_lock(hashtextextended($storage_key, 0));
SELECT ... FROM "file_upload_intent" WHERE id=$intent FOR UPDATE;
SELECT ... FROM "storage_object_lifecycle" WHERE id=$lifecycle FOR UPDATE;
SELECT ... FROM "storage_object_operation" WHERE id=$operation FOR UPDATE;
SELECT ... FROM "file_upload_attempt" WHERE id=$attempt FOR UPDATE;

UPDATE authority_session SET state='REVOKED' WHERE operation_id=$operation;
UPDATE operation SET owner=..., fencing_generation=fencing_generation+1,
  recovery_generation=recovery_generation+1
WHERE id=$operation AND fencing_generation=$expected AND lease_expired;
UPDATE lifecycle SET owner=..., fencing_generation=..., recovery_generation=...
WHERE id=$lifecycle AND fencing_generation=$expected;
INSERT session(... state='PENDING_OS_FENCE' ...);
COMMIT;
```

All rowcounts must be exactly one. New session becomes ACTIVE only after OS
fence proof.

## 7. Evidence Trust Boundary

Selected chain:

```text
Windows Probe
  -> Broker verification
  -> canonical Evidence
  -> SECURITY DEFINER ingestion
  -> append-only Evidence
  -> FileVersion v2 binding
  -> verified read
```

Evidence binds:

```text
Attempt, Intent, Operation, Lifecycle, storageKey
Authority Session, Boot Epoch, Broker Service SID
staging/target Volume Serial and File ID
target parent File ID/namespace
size/SHA-256, Reparse, writer close, seal/ACL evidence
```

SECURITY DEFINER is only a database privilege boundary. It does not prove OS
facts. A full Broker compromise invalidates current-boot Evidence; old
Evidence cannot be reaccepted; recovery Evidence is a new record.

## 8. Legacy/v2 Final Data Model

### 8.1 Parallel Model

Use a parallel, non-destructive model:

```text
legacy_file_version
  original FileVersion ID
  old File/Intent references
  old extraction/review/audit references
  source snapshot digest
  READ_ONLY/BLOCKED state

file_version_v2
  new active FileVersion ID
  publicationEvidenceId NOT NULL
  ACTIVE canonical Lifecycle
  uploadIntentId/attemptId/operationId

legacy_file_version_map
  legacyFileVersionId UNIQUE
  activeFileVersionV2Id UNIQUE NULL for unmapped
  mappingState MAPPED | BLOCKED
  mappingEvidenceDigest
```

Old immutable rows/FKs are never updated or deleted. Mapped history may be
copied into a new v2 record only with historical evidence. Unmappable history
remains legacy.

### 8.2 References

```text
old File.currentVersionId -> old legacy table/view
active v2 File current -> v2 currentVersionId
legacy Extraction/Review/Audit -> original legacy FileVersion
v2 Extraction/Review/Audit -> v2 FileVersion
```

Normal API uses v2 only. Legacy read-only API is separate and has no normal
download. New uploads cannot reference legacy records.

### 8.3 Migration

```text
read-only inventory
-> legacy table snapshot/mapping
-> exact mapped only
-> v2 active table
-> normal API switch
-> legacy API remains read-only
```

Duplicate/orphan/damaged/unmappable/missing-evidence records stop before switch
and remain in legacy. No cleanup is performed to make migration pass.

## 9. D0–D10 Executable Evidence Plan

### 9.1 Repository-Verified Components

Static facts:

```text
Worker entry: apps/worker/src/worker-entry.ts
Recognition queue: FILE_RECOGNITION_QUEUE
Maintenance queue: FILE_MAINTENANCE_QUEUE
Maintenance schedule: */15 * * * *
Maintenance lease: system_metadata.file_maintenance_lease
Upload route: apps/web/src/app/api/projects/[projectId]/files/upload-intents
Download route: apps/web/src/app/api/projects/[projectId]/files/[fileId]/versions/[versionId]/content
Storage adapter: packages/file-storage/src/local-private-storage.ts
Legacy cleanup: packages/file-storage/src/legacy-cleanup.ts
```

No Broker service, v2 namespace, production DB Role or Scheduler name is
present in the repository.

### 9.2 Step Evidence

| Step | Static | Isolated Windows | Isolated DB | Isolated Storage | External operator |
|---|---|---|---|---|---|
| D0 admission freeze | config source | service check | queue state | no | yes |
| D1 inventory | entry points | process/service tree | job list | no | yes |
| D2 queue stop | names known | no | state SQL | no | yes |
| D3 drain | code paths | process state | terminal jobs | no | yes |
| D4 restart/watchdog | no | service/task | no | no | yes |
| D5 process exit | no | SCM/process evidence | no | no | yes |
| D6 handle/mmap | no | native inventory | no | possible | yes |
| D7 artifact refs | known presence rule | process image reference | no | no | yes |
| D8 ACL | no | Effective Access | no | no | yes |
| D9 canary | route path | Broker active | DB evidence | target/read | yes |
| D10 monitor | no | process/ACL | job state | missing target | yes |

All cells not statically provable are `NOT VERIFIED` until isolated execution.

## 10. Official Platform Contract Review

| Platform topic | Official contract | Design use | Not guaranteed |
|---|---|---|---|
| Service SID | Service identity/security descriptor | identity/ACL | process code integrity |
| CNG/KSP | key ACL/usage | protected private key access | same-SID process exclusion |
| Job Object | process group/termination | child/process fence | external/duplicate handles |
| Handle inheritance/duplication | handles can outlive process | evidence requirement | automatic release on exit |
| File ID/Volume | handle object identity | target identity | future path immutability |
| File mapping/section | separate mapped access | fence requirement | process exit = mapping gone |
| AccessCheck | token/descriptor/access evaluation | Effective Access | revoking existing handles |
| PostgreSQL mTLS | certificate/role auth | Broker DB role | Windows process identity |
| SECURITY DEFINER | DB privilege/search_path behavior | Evidence write control | OS fact proof |
| Transaction isolation/locking | DB consistency | authority state | filesystem atomicity |

Official docs are `PLATFORM GUARANTEE DOCUMENTED`; isolated tests are not
executed.

## 11. Minimal Isolated Verification Plan

1. Run read-only Windows probes for Service SID, CNG ACL, mTLS/DB mapping,
   code integrity, Job/mutex, process tree, handle/section/mmap and ACL.
2. Run isolated PostgreSQL tests for authority sessions, CAS, deferred Trigger,
   COMMIT response loss, duplicate Recovery and rowcount.
3. Run isolated Storage Copy-on-Publish tests for partial copy, target exists,
   replacement, File ID/volume/Reparse, seal and failure recovery.
4. Run legacy/v2 archive migration dry-run with duplicate/orphan/damaged/missing
   evidence fixtures.
5. Run D0–D10 dry-run with no production Storage/worker mutation.
6. Obtain independent review of evidence before implementation.

## 12. Remaining Risks

```text
Full Broker compromise is outside the Broker's own proof.
No independent Witness is selected for the current MVP.
Windows code integrity/ACL/handle behavior is not measured.
PostgreSQL Trigger/COMMIT/concurrency behavior is not verified.
Actual legacy data and object identities are not inspected.
Legacy cleanup process inventory and drain are not executed.
Deployment topology and service SIDs are not approved.
```

## 13. Final Admission Decision

```text
Architecture blockers:
  DESIGN CLOSED

Isolated preflight:
  NOT AUTHORIZED — user approval and isolated environment required

Source implementation:
  NOT AUTHORIZED

Database/Migration:
  NOT AUTHORIZED

Windows Service/ACL/CNG:
  NOT AUTHORIZED

Storage/Drain:
  NOT AUTHORIZED

Final design result:
  PASS WITH WARNINGS — ARCHITECTURE BLOCKERS CLOSED
```

## 14. Git and Non-Action Record

At start:

```text
Branch: codex/public-github-sync
HEAD: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified: 0
Staged: 0
Deleted: 0
Untracked: 18
```

The final state is recorded in the delivery message. This report adds one
untracked file. Existing `$null`, `UNKNOWN'`, all prior reports,
`__pycache__/` and the baseline report remain untouched.

No source, Schema, Migration, Trigger, configuration or test was modified.
No database, Storage, Windows ACL/Service, E2E, Build, Native RPC or drain was
executed. `$null`, `UNKNOWN'`, `.next` and `.dist` were not read, hashed,
modified, moved or deleted.
