# WP-1H-R — Independent Adversarial Architecture Review

## 0. Review Control

```text
Stage: WP-1H-R
Mode: INDEPENDENT / READ-ONLY / ADVERSARIAL REVIEW
Date: 2026-11-25
Repository: D:\thinkbook\Desktop\jieya
Reviewed report:
  docs/architecture/wp-1-p1-3-storage-authority-architecture-reset-wp-1h.md
Reviewed report SHA-256:
  9F2D831B3D288FC00A9FFB7DC2352BABF7F1F61BB2CB8CF7299327D4A868C8B4
Reviewed baseline:
  codex/public-github-sync
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

Final result:
  FAIL — ARCHITECTURE CORRECTIONS REQUIRED

Source implementation:
  NOT AUTHORIZED

Database / Windows / ACL / Storage / Runtime:
  NOT ACCESSED
```

WP-1H’s recommendation of Route A is reviewed as a proposal, not accepted as
an implementation or runtime guarantee.

## 1. Scope, Method and Evidence Levels

### 1.1 Scope

The review covers:

- WP-1H complete report;
- WP-1G/R8 and R9;
- current upload/download services;
- current Storage Adapter;
- current Prisma Schema, P1-3 Migration and Trigger;
- actual worker queue/scheduler/lease code;
- R5/BV7/BV8/R8 historical status records.

### 1.2 Method

1. Reconstruct current storage access paths from source.
2. Evaluate Route A/B/C against actual deployment boundaries.
3. Attack Broker/DB identity, old handle, Recovery and Evidence paths.
4. Check whether the proposed Legacy/v2 model preserves every existing
   relation.
5. Separate static repository facts from Windows/Postgres runtime facts.

### 1.3 Evidence Levels

| Level | Meaning |
|---|---|
| `SOURCE FACT` | Current source/Schema/Migration |
| `DESIGN` | WP-1H normative statement |
| `PLATFORM GUARANTEE` | Official platform semantics, not measured |
| `ISOLATED VERIFIED` | Real isolated test evidence; not executed |
| `PRODUCTION VERIFIED` | Real production evidence; not executed |
| `NOT VERIFIED` | No execution/native evidence |

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
Untracked: 17
```

All existing reports, `$null`, `UNKNOWN'` and `__pycache__/` are preserved.

### 2.2 Current Storage Chain

| Location | Fact |
|---|---|
| `apps/web/src/modules/files/upload-service.ts:155-599` | Current upload uses legacy Intent staging and `storage.finalize`. |
| `packages/file-storage/src/local-private-storage.ts:108-191` | Current local adapter uses `wx` plus `access`/`rename`. |
| `packages/file-storage/src/capabilities.ts` | Raw `openReadStream` remains exposed. |
| `apps/worker/src/worker-entry.ts:60-211` | Worker starts recognition/maintenance queues and uses `FILE_RECOGNITION_QUEUE`, `FILE_MAINTENANCE_QUEUE`, `WORKER_QUEUE_NAME`. |
| `apps/worker/src/maintenance-lease.ts` | Maintenance lease stored under `system_metadata.file_maintenance_lease`. |
| `apps/worker/src/file-maintenance.ts` | Maintenance handles extraction leases; no physical cleanup. |
| `packages/file-storage/src/legacy-cleanup.ts` | Legacy remove/cleanup calls fail closed. |

The repository contains no Native Storage Authority Broker service, no v2
namespace, no dedicated Broker DB role and no actual drain implementation.

### 2.3 Current Schema

- `prisma/schema.prisma:398-443`: FileVersion chain fields.
- `prisma/schema.prisma:501-655`: Intent/Attempt/Lifecycle/Operation.
- `prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:992-1004`:
  actual Operation transitions.
- `prisma/migrations/.../migration.sql:1949-2005`: Intent guard; legacy fields
  are not protected.

## 3. WP-1H Recommendation Review

WP-1H recommends:

```text
Route A — Narrow Storage Authority Broker TCB
         + external management recovery boundary
```

The direction is reasonable for the current local NTFS/PostgreSQL MVP:

- it avoids adding an external object-store provider;
- it keeps v2 Storage under one process;
- it explicitly declines to claim that same-host Witness is independent;
- it marks Broker compromise as a trust-boundary failure.

It is not yet an accepted architecture baseline because the external recovery
authority, Broker process authenticity, Legacy/v2 references and executable
preflight evidence are incomplete.

## 4. Route A/B/C Assessment

### Route A — Narrow Broker TCB

Acceptance status:

```text
CONDITIONAL / NOT READY FOR ISOLATED PREFLIGHT
```

Strengths:

- one Storage owner is the simplest feasible local architecture;
- no direct Web/Worker Storage write is the right target;
- outside-TCB containment is the correct boundary for compromised Broker;
- no unsupported cloud dependency is introduced.

Blocking gaps:

- external recovery authority has no identity, credentials, stop/revoke
  protocol or evidence record;
- Service SID/CNG/mTLS/DB Role does not prove code integrity or protect against
  an injected same-SID process;
- single Broker mutex/Job/process/handle proof is not defined;
- old handle/section/mmap release is not proven;
- D0–D10 is still a category matrix, not an executable evidence protocol.

### Route B — Broker + Independent Witness

WP-1H correctly says a same-host Witness is not automatically independent. It
is reasonable not to select Route B for the current MVP. However, its cost and
security comparison is incomplete:

- no concrete independent Witness topology;
- no challenge/attestation protocol;
- no witness compromise/failure model;
- no separate trust-root/key custody.

Route B is `NOT SELECTED — NOT VERIFIABLE` for current deployment, not a
security solution.

### Route C — Managed/Object Storage

WP-1H identifies the attractive future option: conditional writes, versioning,
immutable retention and service-enforced access. It correctly notes the absence
of a provider/migration and does not recommend it prematurely.

However, it does not yet prove that a specific managed store would reduce the
TCB or meet immutable FileVersion/Evidence requirements in this project. Route C
is a `FUTURE DESIGN CANDIDATE`, not an implemented alternative.

## 5. Storage Exclusive Access

### 5.1 Static Finding

The current repository still has direct local Storage access through
`apps/web/src/server/files/storage.ts` and `packages/file-storage/src/...`.
WP-1H proposes Broker-only ownership but has not changed these paths.

Therefore:

```text
DESIGN: one Broker owner
CURRENT IMPLEMENTATION: multiple Web/Worker paths
```

### 5.2 Missing Proof

The report does not establish:

- v2 root ACL denies Web/Worker/Maintenance/Legacy cleanup;
- parent directory inheritance cannot re-grant rights;
- no reparse path can reach v2;
- inherited/duplicated handles cannot survive Broker restart;
- section/mmap access cannot continue after process exit;
- external management can isolate the namespace without deleting objects.

Existing `openReadStream` is a bypass candidate for normal read if exposed.

## 6. External Management Recovery

WP-1H names an external management authority but does not define it:

- OS identity and credential;
- ability/permission to stop Broker;
- ability to prevent restart/watchdog;
- certificate/CNG/DB credential revocation;
- v2 namespace isolation;
- invalidating old Evidence;
- recovery authorization and rollback.

Without that identity, “external management recovery” is only a role name. A
Broker cannot prove its own compromise; the external containment path must be
testable independently.

**Finding `WP1HR-P1-01`:** external Management Recovery Boundary is not
implemented or sufficiently specified to support the claimed TCB containment.

## 7. Recovery State Machine

WP-1H correctly distinguishes DB authority and OS operation, and mentions
`PENDING_OS_FENCE`. It does not provide a complete recovery state model:

- DB revoke and owner CAS;
- old Broker process/session/lease;
- old capability revocation;
- old handle/section/mmap release;
- new session `PENDING_OS_FENCE`;
- OS fence success/failure;
- new session activation;
- response loss and Broker crash.

Any state where old access is unknown permits neither publish nor read. The
report says this direction but does not define exact owner/rowcount/lock rules.

## 8. Evidence Trust Boundary

WP-1H correctly chooses:

```text
Broker-attested OS facts + SECURITY DEFINER database ingestion
```

and correctly says a digest/signature does not prove Windows facts. It must
also state:

- full Broker compromise invalidates current boot Evidence;
- affected objects become unreadable until external containment;
- old Evidence cannot be reaccepted;
- recovery Evidence is a new record;
- PostgreSQL cannot independently validate OS facts.

The report states the boundary but does not define exact evidence sequence,
old-boot rejection, FileVersion binding or object isolation.

## 9. Legacy/v2 Data Model

WP-1H recommends preserving old immutable tables and adding a new active v2
model. This is non-destructive and directionally correct.

It does not define the exact model for:

- old FileVersion to v2 mapping;
- File.currentVersionId across old/v2;
- Extraction/Field/Review/Audit references;
- old Intent/Attempt/Lifecycle/Operation references;
- Evidence missing/duplicate/orphan records;
- normal list/download/reference denial;
- migration transaction, interruption, retry and rollback.

This is an architecture/data-model blocker until the exact cross-table graph is
specified.

## 10. D0–D10

WP-1H correctly separates static inventory from Windows, PostgreSQL and Storage
verification. It does not provide:

- exact pg-boss queue state queries and schedule registrations;
- actual service/task/process inventory commands;
- inherited/duplicate/section/mmap handle evidence;
- Effective Access evidence;
- rollback transcripts and post-rollback isolation.

These are `REQUIRES ISOLATED VERIFICATION`, not completed controls.

## 11. P0/P1/P2 Findings

### P1

1. **WP1HR-P1-01** — External management recovery boundary is not an
   implementable identity/permission protocol.
2. **WP1HR-P1-02** — Broker TCB process authenticity and same-SID injection
   handling remain unproven.
3. **WP1HR-P1-03** — Storage exclusive ownership is proposed but current direct
   Web/Worker paths and old cleanup bypass remain unmodified.
4. **WP1HR-P1-04** — Recovery DB/OS handoff lacks exact state/CAS/rowcount.
5. **WP1HR-P1-05** — Legacy/v2 cross-table model is incomplete.
6. **WP1HR-P1-06** — D0–D10 evidence is insufficient for safe preflight.

### P2

1. **WP1HR-P2-01** — Route B/cost comparison lacks a concrete independent
   Witness topology.
2. **WP1HR-P2-02** — Managed object-store alternative is not evaluated against
   immutable FileVersion/Evidence requirements.
3. **WP1HR-P2-03** — Official Windows/Postgres claims need per-target-version
   evidence.
4. **WP1HR-P2-04** — Test fixtures, command formats and evidence paths are not
   executable.

### P3

1. **WP1HR-P3-01** — Report lacks formal input hashes for every cited platform
   document and historical state.
2. **WP1HR-P3-02** — Canonical architecture nomenclature should be fixed across
   v1/v2/legacy tables.

## 12. Official Platform Boundary Review

WP-1H cites the correct API families, including Service SID, CNG/KSP, Job
Objects, handle inheritance/duplication, File ID, mapping, AccessCheck,
PostgreSQL mTLS, SECURITY DEFINER and transaction isolation.

Classification:

```text
Platform guarantee documented: PARTIAL
Target platform verified: NOT VERIFIED
```

Notably:

- Service SID identifies a service identity; it does not prove current code
  integrity.
- CNG private-key ACLs control key access; they do not prevent a process with
  the same service identity from using the key.
- Job Objects can manage/terminate process trees only when the process tree is
  inside the Job and breakaway is disabled; they do not prove external or
  duplicated handles absent.
- Handle duplication/inheritance means process exit alone does not prove all
  handles closed.
- `FILE_ID_INFO` binds a handle to volume/File ID, not a path or a claim of
  future immutability.
- `AccessCheck` evaluates a token/descriptor/rights tuple, not an existing open
  handle.
- PostgreSQL client-certificate auth proves a DB connection role, not Windows
  process identity.
- `SECURITY DEFINER` changes DB privilege execution, not OS truth.
- PostgreSQL transactions/locks do not provide filesystem atomicity.

## 13. Final Architecture Decision

Route A is the most plausible current architecture, but **not accepted for
isolated preflight yet**.

The architecture should remain:

```text
Single narrow Storage Authority Broker
  + external management/containment authority
  + Broker-attested evidence
  + separate legacy/v2 model
```

It must not:

- claim TCB compromise is detectable without an independent witness;
- use Service SID/mTLS as code-integrity proof;
- treat DB revoke as OS handle closure;
- treat an old `FileVersion` table rename as a complete migration without
  cross-FK/API proof;
- use generic D0–D10 labels as executable evidence.

## 14. Preflight Admission Questions

### A. P0/P1 blockers?

Yes: WP1HR-P1-01 through P1-06.

### B. Items suitable for isolated verification after correction?

Yes: CNG/mTLS/DB, mutex/Job/handle/mmap, File ID/Reparse/ACL, PostgreSQL
Trigger/COMMIT/locking, Storage publication and legacy migration.

### C. Trust-model limitation?

Yes: a fully compromised Broker/DB credential is outside the “trusted Broker”
guarantee. It needs external containment or an independent witness.

### D. Can isolated environment be authorized now?

No. Architecture and data-model corrections are still required.

### E. What must be verified in real Windows/PostgreSQL/Storage?

All native identity, handle, section/mmap, ACL, target seal, restart, DB
transaction and object-migration behavior.

### F. Architecture or more documents?

Architecture and trust-boundary decisions, not more prose. In particular,
define external management identity/containment and Legacy/v2 cross-table
relations.

## 15. R5 / BV7 / BV8 / R8

```text
R5 independent review: FAIL — DESIGN CORRECTIONS REQUIRED
R5 Open Decisions: 57/57 OPEN; 0 approved
BV7: FAIL
BV8: READY FOR INDEPENDENT REVIEW; NOT APPROVED
R8 governance status: BLOCKED
```

No status is changed.

## 16. Final Verdict

```text
Review independence:
  PASS

WP-1H readability:
  PASS

Route A:
  CONDITIONAL — DIRECTION VALID / ARCHITECTURE NOT READY

Route B:
  NOT SELECTED — INDEPENDENCE NOT PROVEN

Route C:
  FUTURE CANDIDATE — PROVIDER/MIGRATION NOT AUTHORIZED

Storage ownership:
  DESIGN DIRECTION ONLY

External recovery:
  INCOMPLETE P1

Recovery DB/OS:
  INCOMPLETE P1

Evidence trust:
  BROKER TCB BOUNDARY CLEAR / ENFORCEMENT NOT VERIFIED

Legacy/v2:
  INCOMPLETE P1

D0-D10:
  INCOMPLETE / NOT VERIFIED

Overall:
  FAIL — ARCHITECTURE CORRECTIONS REQUIRED

Isolated preflight:
  NOT AUTHORIZED

Source implementation:
  NOT AUTHORIZED
```

## 17. Git and Integrity

At review start:

```text
Branch: codex/public-github-sync
HEAD: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified: 0
Staged: 0
Deleted: 0
Untracked: 17
```

This review adds one untracked report. Existing `$null`, `UNKNOWN'`, all prior
reports, `__pycache__/` and the baseline report remain untouched.

No source, Schema, Migration, Trigger, configuration or test was modified.
No database, Storage, Windows ACL/Service, E2E, Build, Native RPC or drain was
executed. `$null`, `UNKNOWN'`, `.next` and `.dist` were not read, hashed,
modified, moved or deleted.

