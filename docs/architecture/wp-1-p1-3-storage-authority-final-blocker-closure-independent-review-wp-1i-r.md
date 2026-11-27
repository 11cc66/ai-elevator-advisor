# WP-1I-R — Final Architecture Independent Adversarial Review

## 0. Review Control

```text
Stage: WP-1I-R
Mode: INDEPENDENT / READ-ONLY / ADVERSARIAL REVIEW
Date: 2026-11-25
Repository: D:\thinkbook\Desktop\jieya
Reviewed report:
  docs/architecture/wp-1-p1-3-storage-authority-final-blocker-closure-wp-1i.md
Reviewed report SHA-256:
  95C1F3D2A707427DC54005CE494ABE1667A31976D79F324AA234F2C0E0CA82AB
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

This review treats WP-1I’s `PASS WITH WARNINGS — ARCHITECTURE BLOCKERS
CLOSED` as a claim to verify. It does not accept a design merely because the
report contains a state machine, a TCB table or a D0–D10 checklist.

## 1. Scope and Independence

### 1.1 Scope

The review covers:

- WP-1I complete report;
- WP-1H and WP-1H-R;
- WP-1G/R8 and R9;
- current upload/download services;
- current Storage Adapter;
- current Prisma Schema, P1-3 Migration and Trigger;
- current Worker queue, scheduler and maintenance lease code;
- R5/BV7/BV8/R8 baseline statuses.

No independent external reviewer or subagent was available in this task
context. This is an independent review context in the same Codex session, not
a third-party human audit. That limitation is disclosed and is not claimed as
external independence.

### 1.2 Method

1. Reconstructed the actual Storage-access paths from source.
2. Re-read the actual Operation state whitelist from the Migration.
3. Challenged Route A with same-SID process reuse, credential theft, old
   handles, DB/OS response loss and namespace migration scenarios.
4. Checked whether the proposed active-v2 and legacy model preserves every
   existing reference.
5. Separated source facts, design decisions and unverified platform behavior.

### 1.3 Evidence Levels

| Level | Meaning |
|---|---|
| `SOURCE VERIFIED` | Visible in current source/Schema/Migration |
| `SCHEMA VERIFIED` | Directly verified in current Prisma/Migration |
| `OFFICIAL CONTRACT DOCUMENTED` | Supported by an official platform document |
| `DESIGN ONLY` | Proposed protocol, not implemented |
| `ISOLATED TEST REQUIRED` | Must be measured in disposable Windows/DB/Storage |
| `NOT VERIFIABLE` | No accessible evidence |

## 2. Baseline and Current Facts

### 2.1 Git

At review start:

```text
Branch: codex/public-github-sync
HEAD: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified: 0
Staged: 0
Deleted: 0
Untracked: 19
```

Existing `$null`, `UNKNOWN'`, all prior reports, `__pycache__/` and the
baseline report are preserved.

### 2.2 Current Source Facts

| Location | Fact |
|---|---|
| `apps/web/src/modules/files/upload-service.ts:155-236` | Legacy Intent stagingKey. |
| `apps/web/src/modules/files/upload-service.ts:267-599` | Current stream/finalize path. |
| `packages/file-storage/src/local-private-storage.ts:108-191` | Current `wx`/close and `access`/`rename`. |
| `packages/file-storage/src/capabilities.ts` | Raw `openReadStream` remains exposed. |
| `apps/web/src/modules/files/download-service.ts:242-495` | No explicit ACTIVE lifecycle/evidence join. |
| `apps/worker/src/worker-entry.ts:60-211` | Recognition/maintenance queues and schedule. |
| `apps/worker/src/maintenance-lease.ts` | `system_metadata.file_maintenance_lease`. |
| `packages/file-storage/src/legacy-cleanup.ts` | Legacy cleanup calls fail closed. |

The repository contains no Storage Authority Broker, v2 namespace, dedicated
Broker DB role or real drain implementation.

### 2.3 Current Schema Facts

- `prisma/schema.prisma:398-443`: FileVersion requires three P1-3 chain fields.
- `prisma/schema.prisma:501-655`: Intent/Attempt/Lifecycle/Operation.
- `prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:992-1004`:
  actual Operation transitions.
- `prisma/migrations/.../migration.sql:1949-2005`: Intent guard; legacy fields
  are not protected.

## 3. WP-1H-R Findings Mapping

| WP-1H-R finding | WP-1I response | Independent result |
|---|---|---|
| External recovery authority undefined | Names `StorageRecoveryOperator` and recovery sequence | `PARTIALLY RESOLVED` |
| Broker TCB process authenticity | Service SID/CNG/mTLS/DB role/WDAC direction | `PARTIALLY RESOLVED` |
| Storage ownership and OS fencing | Broker-only target and old-handle categories | `PARTIALLY RESOLVED` |
| Recovery state machine | Adds active/revoked/pending/verified states | `PARTIALLY RESOLVED` |
| Evidence boundary | Declares Broker-attested TCB | `PARTIALLY RESOLVED` |
| Legacy/v2 model | Parallel legacy/active-v2 direction | `PARTIALLY RESOLVED` |

No item is `RESOLVED WITH EVIDENCE`. No Windows, PostgreSQL, ACL or Storage
test has been executed.

## 4. Route A Final Judgment

### 4.1 Direction

Route A is the most plausible current architecture:

- it avoids an unapproved external object-store dependency;
- it concentrates v2 Storage ownership in one process;
- it explicitly rejects a same-host Witness as automatically independent;
- it accepts that a fully compromised Broker is a trust-boundary failure.

### 4.2 Final Decision

```text
Route A:
  CONDITIONALLY ACCEPTABLE AS THE DESIGN DIRECTION
  NOT ACCEPTED FOR ISOLATED PREFLIGHT YET
```

The report has not yet specified the external recovery identity, actual
Storage-owner enforcement, cross-table Legacy/v2 semantics and executable
D0–D10 evidence sufficiently for an implementation team to proceed.

## 5. External Management Recovery Review

WP-1I names a `StorageRecoveryOperator`, which is the correct conceptual
separation. It does not define:

- its actual OS account/group/SID and credential source;
- how it is protected from Broker service access;
- exact stop/disable/restart-prevention control APIs;
- CNG key/certificate revocation steps;
- DB role/session revocation and boot-epoch invalidation;
- v2 namespace isolation without deleting objects;
- how it distinguishes old Evidence from new Evidence;
- what happens when the operator itself is compromised or unavailable.

The report cannot yet prove that the external authority is independent in a
real deployment. A role name is not a containment mechanism.

**Finding `WP1IR-P1-01`:** external management recovery remains a design role
without a verifiable identity, permission and containment protocol.

## 6. Broker TCB Identity Review

WP-1I correctly distinguishes Service SID, CNG key, mTLS, DB role, binary
signature and code integrity. It does not specify:

- CNG KSP/private-key ACL and certificate mapping;
- whether a same-SID process can use the key/DB credential;
- DLL search/load restrictions and code-integrity policy implementation;
- how Broker updates, rollback and binary replacement are authorized;
- how a compromised Broker is detected and enters `TRUST_BOUNDARY_FAILED`.

Authenticode signing alone is not runtime integrity proof. The TCB must state
which residual same-SID/administrator risks are accepted; otherwise the
security claim is broader than the evidence.

**Finding `WP1IR-P1-02`:** Broker TCB is named but process integrity and
credential-custody boundaries are not closed.

## 7. Storage Ownership and OS Fencing

The report correctly targets Broker-only v2 ownership and lists Web, Worker,
Maintenance, Recovery and Legacy cleanup as non-owners.

Current source still has:

- Web direct `getPrivateStorage()` paths;
- Worker direct read capability;
- raw `openReadStream`;
- current local adapter direct write/rename;
- legacy cleanup APIs.

WP-1I does not define how all these paths are removed or denied, nor how
`v2 root`/parent ACLs and Reparse checks are provisioned.

It also does not give a concrete method for:

- inherited/duplicate handles;
- section objects and mmap;
- Job breakaway/nested jobs;
- external process handles;
- Broker pause/resume;
- proving old access ended before publish.

**Finding `WP1IR-P1-03`:** Broker-only ownership is a target, not an enforced
OS namespace boundary.

## 8. Recovery State Machine

WP-1I introduces the right high-level states:

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

It does not provide a complete executable transition contract:

- exact current-Schema field additions and Trigger changes;
- owner/generation CAS rowcount for Attempt/Intent/Lifecycle/Operation;
- exact lock order and deadlock assertions;
- old Broker pause/resume;
- old capability replay after revoke;
- Broker crash in `OS_FENCE_PENDING`;
- DB unavailable or response loss;
- external management unavailable;
- repeated recovery and re-entry.

DB CAS and OS fence are correctly not claimed atomic, but the handoff remains
incomplete.

**Finding `WP1IR-P1-04`:** Recovery state names exist, but the state-to-DB/OS
evidence contract is not executable.

## 9. Evidence Trust Boundary

WP-1I correctly says:

- Broker is the OS fact producer and TCB;
- SECURITY DEFINER only controls DB permissions;
- digest/hash does not prove OS truth;
- full Broker compromise invalidates current-boot Evidence;
- old Evidence must not be reaccepted.

The report still lacks exact:

- evidence sequence and accepted-evidence selection;
- old-session/boot-epoch rejection SQL/Trigger;
- target replacement detection at read time;
- FileVersion v2 evidence FK/Trigger behavior;
- isolation and read-denial behavior for affected objects.

**Finding `WP1IR-P2-01`:** Evidence trust is conceptually clear but not yet
database-enforced or runtime-verified.

## 10. Legacy/v2 Data Model

WP-1I chooses a parallel model:

```text
legacy_file_version (old immutable/history)
file_version_v2 (new active)
legacy_file_version_map
```

This is a sound direction. It still lacks:

- exact PK/FK/unique definitions;
- File.currentVersionId across old and v2 models;
- Extraction/ExtractionField/Review/Audit references;
- old UploadIntent/Attempt/Lifecycle/Operation mappings;
- evidence-missing, duplicate, orphan, damaged and unmappable disposition;
- normal route and Worker read denial;
- migration interruption, repeat, rollback and revalidation.

**Finding `WP1IR-P1-05`:** the parallel Legacy/v2 model is not sufficiently
defined to preserve all historical references or prevent normal access bypass.

## 11. D0–D10 Review

WP-1I correctly distinguishes static, Windows, PostgreSQL, Storage and external
management evidence. It does not provide exact executable:

- worker/scheduler/service inventory;
- pg-boss queue state queries for retry/delayed/dead-letter;
- process/tree and inherited/duplicate handle checks;
- section/mmap detection;
- ACL Effective Access;
- rollback transcript and post-rollback isolation.

The report correctly labels many items NOT VERIFIED; that honesty does not make
the protocol executable.

**Finding `WP1IR-P1-06`:** D0–D10 is still a verification outline, not a
reproducible evidence protocol.

## 12. P0/P1/P2/P3 Register

### P1

1. **WP1IR-P1-01** — External Recovery Authority lacks concrete identity,
   credential, stop/revoke and namespace-isolation protocol.
2. **WP1IR-P1-02** — Broker TCB process integrity/code credential boundary
   remains unverified.
3. **WP1IR-P1-03** — Broker-only Storage ownership is not enforced over current
   direct paths and old handles.
4. **WP1IR-P1-04** — Recovery DB/OS transition contract lacks exact fields,
   CAS, rowcount, locks and failure ownership.
5. **WP1IR-P1-05** — Legacy/v2 cross-table and API isolation model is incomplete.
6. **WP1IR-P1-06** — D0–D10 evidence cannot yet be executed.

### P2

1. **WP1IR-P2-01** — Evidence sequence/old-epoch enforcement is not exact.
2. **WP1IR-P2-02** — Windows ancestor Reparse, target seal and AccessCheck
   evidence fields need exact implementation.
3. **WP1IR-P2-03** — Route C object-store evaluation lacks concrete provider
   and migration semantics.
4. **WP1IR-P2-04** — Test fixtures and fault hooks are not implemented.

### P3

1. **WP1IR-P3-01** — Official platform citations need target-version evidence.
2. **WP1IR-P3-02** — Naming/version registry across legacy/v2/evidence needs
   consolidation.

## 13. Official Platform Boundary

WP-1I cites the relevant official API families. The correct interpretation is:

```text
OFFICIAL CONTRACT DOCUMENTED:
  identity, handle, Job, File ID, mapping, AccessCheck, PostgreSQL auth,
  SECURITY DEFINER and transaction semantics are documented platform topics.

NOT VERIFIED:
  actual Windows DACL/KSP/WDAC behavior, handle/mmap release, target seal,
  Effective Access, DB Trigger/COMMIT behavior and Storage results.
```

No official document proves that Service SID equals code integrity, that a
digest proves OS truth, that a Job Object closes external/duplicate handles, or
that PostgreSQL transaction locking covers filesystem operations.

## 14. Final Architecture Decision

Route A remains the selected direction. The report is not yet ready for
isolated preflight because the six P1 blockers are only partially specified.

```text
Route A:
  CONDITIONALLY ACCEPTED AS DIRECTION

Route B:
  NOT CURRENTLY SELECTED — independent Witness not proven

Route C:
  FUTURE CANDIDATE — provider/migration not authorized
```

## 15. Authorization Boundary

```text
Architecture acceptance for isolated preflight:
  NO

Permission to create isolated environment:
  NOT GRANTED

Permission to execute Windows tests:
  NOT GRANTED

Permission to execute PostgreSQL tests:
  NOT GRANTED

Permission to execute Storage tests:
  NOT GRANTED

Permission for source implementation:
  NOT GRANTED

Permission for Migration:
  NOT GRANTED

Permission for production deployment:
  NOT GRANTED
```

## 16. Git and Integrity

At review start:

```text
Branch: codex/public-github-sync
HEAD: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified: 0
Staged: 0
Deleted: 0
Untracked: 19
```

This review adds one untracked report. Existing `$null`, `UNKNOWN'`, all
historical reports, `__pycache__/` and the baseline report remain untouched.

No source, Schema, Migration, Trigger, configuration or test was modified.
No database, Storage, Windows ACL/Service, E2E, Build, Native RPC or drain was
executed. `$null`, `UNKNOWN'`, `.next` and `.dist` were not read, hashed,
modified, moved or deleted.

## 17. Final Verdict

```text
Review independence:
  PASS

WP-1I readability:
  PASS

Route A direction:
  CONDITIONALLY ACCEPTED

External management recovery:
  PARTIAL / P1

Broker TCB identity:
  PARTIAL / P1

Storage ownership and OS fencing:
  PARTIAL / P1

Recovery state machine:
  PARTIAL / P1

Evidence trust:
  PARTIAL / P2

Legacy/v2 model:
  PARTIAL / P1

D0–D10:
  PARTIAL / P1

Overall:
  FAIL — ARCHITECTURE CORRECTIONS REQUIRED

Source implementation / Migration / Windows Storage / Deployment:
  NOT AUTHORIZED
```

