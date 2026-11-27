# WP-1H — Storage Authority Architecture Reset and Feasibility Assessment

## 0. Document Control

```text
Stage: WP-1H
Mode: READ-ONLY INVESTIGATION / ARCHITECTURE RESET
Date: 2026-11-25
Repository: D:\thinkbook\Desktop\jieya
Branch at start: codex/public-github-sync
HEAD at start: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main at start: 101e8a362e430f4fa7b31b67c56823cb702eb1e6

Result:
  PASS WITH WARNINGS — ARCHITECTURE RESET COMPLETE

Implementation:
  BLOCKED — isolated Windows/PostgreSQL/Storage verification not authorized
```

This document is an architecture decision and feasibility assessment. It does
not modify source, Schema, Migration, Trigger, configuration or tests; it does
not execute SQL, database, Storage, Windows Service, ACL or Drain operations.

Evidence labels:

```text
DESIGN VERIFIED
  Protocol/architecture is internally specified.

PLATFORM GUARANTEE DOCUMENTED
  Official API semantics support the stated platform property, but no target
  environment measurement exists.

ISOLATED ENVIRONMENT VERIFIED
  Real disposable DB/Windows/Storage evidence exists. NOT EXECUTED.

PRODUCTION VERIFIED
  Authorized production evidence exists. NOT EXECUTED.

NOT VERIFIED
  No execution, native probe or retained evidence.
```

### 0.1 Skills Applied

- `$project-architecture`
- `$prisma-db-safety`
- `$security-audit`
- `$testing-and-verification`
- `$file-lifecycle`

## 1. Current Architecture: Real State

### 1.1 Git Baseline

At start:

```text
Branch: codex/public-github-sync
HEAD: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified: 0
Staged: 0
Deleted: 0
Untracked: 16
```

The existing worktree contains all prior WP-1/WP-1R/WP-1C/WP-1C-R/WP-1D/
WP-1D-R/WP-1E/WP-1E-R/WP-1F/WP-1F-R/WP-1G/WP-1G-R reports, `$null`,
`UNKNOWN'`, `__pycache__/` and the baseline report. These files are preserved.

### 1.2 Actual Source and Runtime Components

| Component | Current fact |
|---|---|
| Upload route/service | `apps/web/src/modules/files/upload-service.ts:155-599` |
| Download service | `apps/web/src/modules/files/download-service.ts:242-525` |
| Storage adapter | `packages/file-storage/src/local-private-storage.ts:108-191` |
| Worker entry | `apps/worker/src/worker-entry.ts:60-211` |
| Queue names | `WORKER_QUEUE_NAME`, `FILE_RECOGNITION_QUEUE`, `FILE_MAINTENANCE_QUEUE` |
| Maintenance schedule | `*/15 * * * *` in `worker-entry.ts` |
| Worker maintenance lease | `apps/worker/src/maintenance-lease.ts` using `system_metadata.file_maintenance_lease` |
| Storage capability | current code has read/write/finalize; no native Broker service |
| Native Broker service | `NOT PRESENT` |
| v2 namespace/ACL | `NOT PRESENT` |
| Cleanup drain evidence | `NOT EXECUTED` |

### 1.3 Current Schema Boundary

- `prisma/schema.prisma:398-443`: FileVersion requires upload chain fields.
- `prisma/schema.prisma:501-655`: Intent, Attempt, Lifecycle, Operation.
- P1-3 Operation Trigger:
  `PREPARED -> EXECUTING/FAILED/ABANDONED`;
  `EXECUTING -> APPLIED/UNKNOWN/FAILED`;
  `UNKNOWN -> APPLIED/FAILED/ABANDONED`.
- Current FileVersion/Intent application integration is absent; the current
  upload service still uses the legacy path.

### 1.4 Baseline Governance

```text
R5 independent review: FAIL — DESIGN CORRECTIONS REQUIRED
R5 Open Decisions: 57/57 OPEN; 0 approved
BV7: FAIL
BV8: READY FOR INDEPENDENT REVIEW; NOT APPROVED
R8 governance status: BLOCKED
```

These statuses are independent of WP-1H and are not changed by this report.

## 2. R9 Six Blockers — Architecture-Level Assessment

| Blocker | Why previous design stalled | Architecture implication |
|---|---|---|
| Broker identity/credential | Service SID/CNG/mTLS does not prove code integrity or same-SID process identity | Broker must be a narrow TCB with explicit compromise boundary |
| Single Broker/OS fencing | Mutex/Job names do not prove all handles/sections/mmap are gone | Broker must be the only Storage opener; old process must be externally fenced |
| Recovery DB/OS handoff | DB CAS and OS handle release are different transactions | Recovery needs an external operator/control boundary |
| Evidence trust | SECURITY DEFINER proves DB write permission only | Evidence must be labeled Broker-attested; full Broker compromise invalidates it |
| Legacy/v2 | Existing immutable references cannot be rewritten safely | Preserve old model and introduce a separate active v2 model |
| D0–D10 | Generic gates were mistaken for executable evidence | Separate static, Windows, DB, Storage and operator evidence |

## 3. Route A — Narrow Broker TCB + External Recovery

### 3.1 Architecture

```text
Web/API
  -> Broker client
  -> single Windows Storage Authority Broker
  -> local NTFS v2 namespace

PostgreSQL
  -> authority/session/evidence records

External management authority
  -> stop/disable Broker
  -> revoke service credentials
  -> isolate namespace
  -> authorize recovery
```

The Broker is the only process directly opening v2 staging/canonical objects.
Web and Worker have no direct Storage Root write/delete capability.

### 3.2 TCB

Trusted:

- Broker binary/config/code integrity;
- Windows Service SID and protected service credential;
- CNG private key/KSP ACL;
- Broker's native File ID/volume/handle/Reparse/ACL probes;
- external SCM/administrator recovery authority (only for containment).

Not trusted for OS facts:

- PostgreSQL;
- Web/Worker;
- a client-supplied PID/SID/token;
- a digest or audit row alone.

Fully compromised Broker:

```text
TRUST_BOUNDARY_FAILED
all current-boot Evidence invalid
publish disabled
affected v2 namespace retained/isolation pending external action
```

The Broker cannot prove its own code is uncompromised. An independent witness
is not included in Route A; this must be an explicit accepted boundary.

### 3.3 Costs

```text
Implementation: high
Windows dependencies: high
PostgreSQL dependencies: medium
External infrastructure: low/medium (management identity)
Operations: medium/high
Security: high against non-TCB compromise; TCB compromise excluded
Testing/maintenance: high
```

### 3.4 Feasibility

Route A is **recommended for the current local-storage MVP**, provided the
project accepts that a fully compromised Broker is a trust-boundary failure
and requires external containment. It does not require a new cloud provider or
object-store migration.

## 4. Route B — Broker + Independent Witness

### 4.1 Architecture

```text
Broker -> Witness
Broker -> PostgreSQL Evidence
Witness -> independent OS observations/attestation
External recovery authority -> containment
```

### 4.2 Critical Questions

A witness only helps if it has an independent execution identity and an
independent observation channel. A process on the same host, sharing the same
service account or administrator domain, is not independent.

Required capabilities:

- separate SID/credential;
- independent process supervision;
- challenge/nonce and replay-resistant protocol;
- independent handle/ACL/File ID observation or trusted external storage;
- witness failure and split-brain policy;
- separate trust root and key custody.

If Witness cannot independently observe the target objects, it adds a second
signature service without adding an independent proof.

### 4.3 Costs

```text
Implementation: very high
Windows dependencies: very high
PostgreSQL dependencies: high
External infrastructure: medium/high
Operations: high
Security: potentially higher only with true independent witness
Testing/maintenance: very high
```

### 4.4 Feasibility

Route B does not solve the problem if the Witness and Broker share the same
host, service identity or administrative trust. A true off-host witness is not
part of the current approved deployment topology. It is **not recommended for
the current MVP**; it may be a future high-assurance upgrade.

## 5. Route C — Alternative Storage Authority

### 5.1 Candidate Families

1. Managed object storage with conditional writes, object versioning,
   immutable retention and service-enforced access control.
2. Dedicated local storage service with only one process opening objects.
3. Split publisher/cleanup services with separate identities.
4. Existing database as a blob store (not suitable for document bytes).

### 5.2 Comparison

| Candidate | Correctness potential | Current fit | Migration | Operations | Verdict |
|---|---|---|---|---|---|
| Managed object store + conditional/versioned writes | High if service semantics prove no overwrite and versioning | Requires external provider and credentials | High | Medium | Future option only |
| Dedicated local storage service | High if it is the only opener and has external containment | Fits local NTFS but same Broker complexity | Medium | Medium/high | Essentially Route A |
| Split publisher/cleanup identities | Better least privilege, but still requires handle fencing | Partial fit | Medium | Medium | Complementary, not a full replacement |
| Database blob/object table | Not acceptable for large immutable files | Bad | High | High | Not recommended |

### 5.3 Verdict

No external object store is currently present or authorized. A managed object
store is a valid future architecture if the product accepts provider/network
and data-location dependencies. It cannot be selected in this task without
provider approval and a separate security/migration design.

## 6. Final Architecture Decision

### Decision 1 — Selected Route

```text
ROUTE A: Narrow Storage Authority Broker TCB + external containment/recovery.
```

Route A is selected as the initial production candidate because:

- local private storage is the current code boundary;
- no external object-store/provider is approved;
- a same-host Witness would not be independent;
- a single Broker can reduce Storage-open authority to one process;
- Broker compromise is explicitly outside the software guarantee and requires
  external containment.

The previous “Broker + many optional session/evidence protocols” architecture
is not retained as multiple alternatives. The required normative rules are:

```text
one Broker service
one v2 namespace
one server-side publication path
one DB authority/session path
one Broker-attested Evidence path
```

### Decision 2 — Minimal TCB

| Role | Trust status |
|---|---|
| Broker service code/config and protected service credential | TCB |
| Broker CNG key and DB role credential | protected TCB |
| Native Probe/ACL/File ID/Reparse implementation | TCB |
| External SCM/administrator containment authority | trusted management boundary, not routine runtime |
| PostgreSQL | records authority/invariants; cannot prove OS facts |
| Web/Worker/Maintenance/Recovery | untrusted for direct Storage access |
| Legacy cleanup | no v2 authority |

### Decision 3 — Storage Ownership

```text
v2 root writer/creator/deleter/ACL owner: Broker only
Web: no direct Storage write/delete; Broker client only
Worker: verified read only; no direct write/delete
Maintenance: no canonical delete; staging broker operation only if separately approved
Recovery: Broker recovery operation only; no direct file mutation
Legacy cleanup: never receives v2 authority
```

### Decision 4 — Recovery Ownership

DB owns authority state and session records. The Broker owns OS operations.
The external management authority owns containment:

```text
stop/disable Broker service
revoke Broker credential/key access
invalidate current boot epoch
preserve v2 objects
authorize a new Broker boot only after handle/ACL proof
```

The DB cannot terminate a Windows process or close a handle. A DB `REVOKED`
state is not proof that old OS access ended.

### Decision 5 — Evidence Trust Boundary

```text
Trusted: Broker-attested OS facts, after normalized Evidence ingestion.
Not proven: PostgreSQL/digest/signature independently proving Windows facts.
Not recoverable automatically: full Broker/TCB compromise.
```

On trust-boundary failure:

- invalidate current boot/session Evidence;
- stop publish/read of affected v2 objects;
- retain objects and Evidence;
- require external operator containment and a new boot epoch;
- never re-accept old Evidence as current.

### Decision 6 — Legacy/v2

The selected model is:

```text
old immutable FileVersion and related history: preserved
new active FileVersion v2: separate table/model
legacy archive/mapping: append-only, read-only
normal API: active v2 only
legacy API: metadata/read-only only, separate permission
```

This avoids deleting or rewriting immutable FileVersion rows. A mapped
historical record can enter v2 only with independent historical evidence and a
complete new chain; unmappable rows remain archived and blocked.

## 7. R9 Six Blockers — Final Resolution Status

| R9 blocker | Resolution |
|---|---|
| Broker process identity/credential | `REQUIRES ISOLATED VERIFICATION` |
| Single Broker/old handle fence | `REQUIRES ISOLATED VERIFICATION` |
| Recovery DB/OS handoff | `REQUIRES ISOLATED VERIFICATION` |
| Evidence trust | `CLOSED BY DESIGN` for the selected Broker-TCB boundary; full compromise explicitly excluded |
| Legacy/v2 data model | `CLOSED BY DESIGN`; implementation/migration verification pending |
| D0–D10 | `REQUIRES ISOLATED VERIFICATION`; static inventory boundaries defined below |

There is no claim that any `REQUIRES ISOLATED VERIFICATION` item has passed.

## 8. D0–D10 Real Repository Boundaries

### 8.1 Static Repository Facts

The following can be identified without executing services:

```text
Worker entry: apps/worker/src/worker-entry.ts
Recognition queue: FILE_RECOGNITION_QUEUE
Maintenance queue: FILE_MAINTENANCE_QUEUE
Maintenance schedule: */15 * * * *
Maintenance lease key: system_metadata.file_maintenance_lease
Web upload route: apps/web/src/app/api/projects/[projectId]/files/upload-intents
Web download route: apps/web/src/app/api/projects/[projectId]/files/[fileId]/versions/[versionId]/content
Storage adapter: packages/file-storage/src/local-private-storage.ts
Legacy cleanup fail-closed: packages/file-storage/src/legacy-cleanup.ts
```

No Native Storage Authority Broker service, v2 namespace, production DB Role,
or actual queue/Scheduler inventory is present in the repository.

### 8.2 Verification Classes

| D steps | Static repository | Windows isolated | PostgreSQL isolated | Storage isolated | External management |
|---|---:|---:|---:|---:|---:|
| D0 admission/queue freeze | partial | no | yes | no | yes |
| D1 process/service inventory | partial | yes | possible | no | yes |
| D2 queue/retry/dead-letter | partial | no | yes | no | yes |
| D3 active task drain | no | yes | yes | maybe | yes |
| D4 scheduler/watchdog disable | partial | yes | no | no | yes |
| D5 process exit | no | yes | no | no | yes |
| D6 handle/section/mmap release | no | yes | no | maybe | yes |
| D7 `.next`/`dist` runtime references | partial metadata | yes | no | no | yes |
| D8 ACL Effective Access | no | yes | no | yes | yes |
| D9 canary publish/read | no | yes | yes | yes | yes |
| D10 continuous monitoring | no | yes | yes | yes | yes |

Any unknown in D0–D8 is a stop condition for D9.

## 9. Official Platform Basis

The following official sources define the API boundaries, not the target
environment’s current behavior:

| Topic | Official source | What it supports |
|---|---|---|
| Service SID | Microsoft Learn: <https://learn.microsoft.com/en-us/windows/win32/services/service-security-and-access-rights> | Service identity/access-check concepts |
| CNG key protection | Microsoft Learn: <https://learn.microsoft.com/en-us/windows/win32/seccng/key-storage-and-retrieval> | Private-key ACL/usage concepts; no same-SID process proof |
| Job Objects | Microsoft Learn: <https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects> | Process groups, child association, breakaway/nested behavior |
| Handle inheritance/duplication | Microsoft Learn: <https://learn.microsoft.com/en-us/windows/win32/sysinfo/handle-inheritance>; <https://learn.microsoft.com/en-us/windows/win32/api/handleapi/nf-handleapi-duplicatehandle> | Handles are inheritable/duplicable; process exit is not proof of release |
| File identity | Microsoft Learn: <https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfileinformationbyhandleex> | Volume/File ID identity for an open handle |
| File mapping | Microsoft Learn: <https://learn.microsoft.com/en-us/windows/win32/api/memoryapi/nf-memoryapi-createfilemappingw> | Section/mmap access is separate from process lifetime |
| AccessCheck | Microsoft Learn: <https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-accesscheck> | Effective access requires a token, descriptor and requested rights |
| PostgreSQL TLS auth | PostgreSQL 18: <https://www.postgresql.org/docs/18/libpq-ssl.html>; <https://www.postgresql.org/docs/18/auth-cert.html> | Client-certificate/DB role authentication |
| PostgreSQL SECURITY DEFINER | PostgreSQL 18: <https://www.postgresql.org/docs/18/sql-createfunction.html> | Privilege execution/search-path constraints, not OS facts |
| PostgreSQL isolation/locking | PostgreSQL 18: <https://www.postgresql.org/docs/18/transaction-iso.html> | Row/MVCC/locking semantics, not filesystem atomicity |

Platform documentation is `PLATFORM GUARANTEE DOCUMENTED`, not
`ISOLATED ENVIRONMENT VERIFIED`.

## 10. Cost and Complexity

| Route | Implementation | Windows | PostgreSQL | External infra | Ops | Security | Migration | Verdict |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| A single Broker TCB | High | High | Medium | Low/medium | High | High outside TCB compromise | Medium | Recommended |
| B Broker + Witness | Very high | Very high | High | High | Very high | Higher only with true independence | High | Future only |
| C managed object store | Medium/high | Low | Medium | High/provider | Medium | High if conditionality/versioning verified | High | Future candidate |

### 10.1 Why Not Keep Expanding Documents

The previous rounds added fields and state layers without reducing the
fundamental Windows handle/full-compromise questions. The architecture reset
must stop at:

```text
one Broker TCB
one external containment authority
one active-v2 data model
one isolated verification matrix
```

More document-only protocol layers do not create OS evidence.

## 11. Minimum Isolated Verification Set

### Windows

- Service SID, CNG key ACL, mTLS certificate and DB role binding.
- Single-service mutex/Job/process restart and hung process.
- Handle inheritance/duplication, section/mmap, child processes and external
  holders.
- File ID/Volume Serial/Reparse/target seal/Effective Access.
- Broker corruption, pause/resume and credential revocation.

### PostgreSQL

- Session/boot/epoch uniqueness and revocation.
- Recovery CAS, owner/generation, deferred Trigger ordering and rowcount.
- COMMIT response loss, serialization/deadlock and duplicate recovery.
- Evidence append-only and FileVersion evidence FK.

### Storage

- Copy-on-Publish partial copy, target exists, target replacement and seal.
- Staging canonical identity and hash verification.
- Legacy/active v2 table migration and API rejection.

### External Management

- Stop/disable Broker and revoke credentials.
- Isolate v2 namespace without deleting objects.
- New boot/recovery approval and monitoring.

### Admission Rule

Isolated verification may begin only after:

1. B decisions are user-approved.
2. A single Broker TCB and external containment owner are assigned.
3. A concrete Legacy/v2 data model and D0–D10 evidence contract are reviewed.
4. No unresolved P1 trust-boundary ambiguity remains.

## 12. Remaining True Limitations

```text
Full Broker compromise cannot be disproven by the Broker itself.
A same-host Witness without an independent identity/observation channel does
not establish independent OS truth.
PostgreSQL cannot directly validate Windows file handles or mmap.
File ID/Volume/ACL evidence is time-bound and must be rechecked at read.
Directory presence and service configuration do not prove handle release.
Historical data with no staging/close evidence cannot become a verified chain
by inference.
```

## 13. Final Recommendation and Answer

### Is the current self-built Broker architecture worth continuing?

**Only after resetting it to the narrow Route A TCB above. The current
accumulated multi-option protocol is not worth continuing as-is.**

Do not add another general-purpose Witness or another layer of abstract
Evidence fields in this phase. Route A is feasible for the current local
NTFS/PostgreSQL MVP only with:

- one Broker service and external containment owner;
- exclusive v2 Storage ownership;
- Broker-attested Evidence with explicit compromise invalidation;
- separate legacy/v2 active data models;
- isolated Windows/DB/Storage verification.

Route B is not justified without a truly independent witness and deployment
topology. Route C is a valid future direction if an approved managed object
store with conditional writes/versioning is selected, but it is not authorized
or present now.

## 14. Git and Final Status

At start:

```text
Branch: codex/public-github-sync
HEAD: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified: 0
Staged: 0
Deleted: 0
Untracked: 16
```

The final state is recorded in the delivery message. This report adds one
untracked file. Existing `$null`, `UNKNOWN'`, all prior reports,
`__pycache__/` and the baseline report remain untouched.

No source, Schema, Migration, Trigger, configuration or test was modified.
No database, Storage, Windows ACL/Service, E2E, Build, Native RPC or drain was
executed. `$null`, `UNKNOWN'`, `.next` and `.dist` were not read, hashed,
modified, moved or deleted.

```text
Final architecture decision:
  PASS WITH WARNINGS — ARCHITECTURE RESET COMPLETE

Recommended route:
  Route A — Narrow Broker TCB + external containment

Implementation:
  BLOCKED — isolated Windows/PostgreSQL/Storage verification and user approval

Production:
  NOT VERIFIED
```

