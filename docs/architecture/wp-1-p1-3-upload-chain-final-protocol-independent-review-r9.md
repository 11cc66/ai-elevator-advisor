# WP-1G-R — Final Protocol Independent Review R9

## 0. Review Control

```text
Stage: WP-1G-R
Mode: INDEPENDENT / READ-ONLY / ADVERSARIAL REVIEW
Date: 2026-11-25
Repository: D:\thinkbook\Desktop\jieya
Reviewed report:
  docs/architecture/wp-1-p1-3-upload-chain-final-protocol-closure-r8.md
Reviewed report SHA-256:
  3E4ECBCFE4678752171890F2769693713FA60DFD7F12EC38275EDA3C69987AF8
Reviewed baseline:
  codex/public-github-sync
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

Final result:
  FAIL — DESIGN CORRECTIONS REQUIRED BEFORE ISOLATED VERIFICATION

Source implementation:
  NOT AUTHORIZED

Database / Windows / ACL / Storage / Runtime:
  NOT ACCESSED
```

This review treats WP-1G’s `PASS WITH WARNINGS` as a claim to verify. It does
not accept a protocol merely because it contains state tables, field names or
a test plan.

## 1. Scope, Method and Evidence Levels

### 1.1 Scope

The review covers:

- WP-1G R8, complete;
- WP-1F R6 and WP-1F-R R7;
- WP-1E, WP-1D, WP-1C and WP-1 baseline reports;
- current upload/download services and Storage Adapter;
- current Prisma Schema, P1-3 Migration and Trigger;
- R5/BV7/BV8/R8 status evidence.

### 1.2 Method

1. Reconstruct actual state and fields from the current source and Migration.
2. Trace the Windows Probe → Broker → DB Evidence → FileVersion → Read chain.
3. Attack Broker credential/process identity, duplicate Broker, old handle,
   Recovery CAS, Evidence replay and legacy API bypass.
4. Verify that every claimed state has a unique authority and fail-closed
   failure path.
5. Treat all Windows, database, ACL and Storage behavior as `NOT VERIFIED`
   unless directly source-proven.

### 1.3 Evidence Levels

| Level | Meaning |
|---|---|
| `SOURCE FACT` | Visible in current source/Schema/Migration |
| `DESIGN` | Normative statement in R8 |
| `PLATFORM ASSUMPTION` | API behavior not measured on this host |
| `NOT VERIFIED` | No execution or native proof |
| `BLOCKED` | A safe implementation path requires absent evidence/authority |

Skills applied:

- `$project-architecture`
- `$prisma-db-safety`
- `$security-audit`
- `$testing-and-verification`
- `$file-lifecycle`

## 2. Baseline and Evidence

### 2.1 Git

At review start:

```text
Branch: codex/public-github-sync
HEAD: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified: 0
Staged: 0
Deleted: 0
Untracked: 15
```

All existing untracked reports, `$null`, `UNKNOWN'` and `__pycache__/` are
preserved. `$null` and `UNKNOWN'` were not read, hashed, modified, moved or
deleted.

### 2.2 Current Source Facts

| Source | Fact |
|---|---|
| `apps/web/src/modules/files/upload-service.ts:155-236` | Legacy Intent stagingKey. |
| `apps/web/src/modules/files/upload-service.ts:267-441` | Current stream/finalize path. |
| `apps/web/src/modules/files/upload-service.ts:443-575` | FileVersion without P1-3 chain. |
| `packages/file-storage/src/local-private-storage.ts:108-191` | Current `wx`/close and `access`/`rename` finalize. |
| `packages/file-storage/src/capabilities.ts` | Raw `openReadStream` remains exposed. |
| `apps/web/src/modules/files/download-service.ts:242-495` | No explicit ACTIVE lifecycle/evidence join. |

### 2.3 Current Schema/Trigger Facts

| Source | Fact |
|---|---|
| `prisma/schema.prisma:398-443` | FileVersion requires three chain fields. |
| `prisma/schema.prisma:501-655` | Intent/Attempt/Lifecycle/Operation. |
| `prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:992-1004` | Actual Operation transitions. |
| Same Migration, lines 603-825 | Attempt and ownership guards. |
| Same Migration, lines 1194-1357 | Upload chain assertions. |
| Same Migration, lines 1797-1947 | FileVersion/lifecycle/finalize checks. |
| Same Migration, lines 1949-2005 | Intent guard; legacy fields not protected. |

## 3. WP-1F-R Six-Blocker Mapping

| R7 blocker | R8 response | Independent status |
|---|---|---|
| Broker identity/credential | Service SID + CNG + mTLS + DB role | `PARTIALLY RESOLVED` |
| Single Broker/OS fence | SCM/mutex/Job/process/handle direction | `PARTIALLY RESOLVED` |
| Recovery DB/OS handoff | CAS/revoke/PENDING_OS_FENCE | `PARTIALLY RESOLVED` |
| Evidence trust | Broker TCB + restricted ingestion | `PARTIALLY RESOLVED` |
| Legacy/v2 migration | Preserve old table/new active table | `PARTIALLY RESOLVED` |
| D0–D10 evidence | Gate table and evidence categories | `PARTIALLY RESOLVED` |

No item is `RESOLVED WITH EVIDENCE`; no Windows, DB, ACL or Storage proof has
been executed.

## 4. A — Broker Identity

### 4.1 What R8 Defines

R8 selects:

```text
Service SID
  -> CNG non-exportable private key
  -> mTLS certificate
  -> PostgreSQL client-certificate authentication
  -> dedicated Broker DB role
```

It correctly distinguishes certificate/DB-role authentication from PID/SID.
It also declares Broker compromise a TCB failure.

### 4.2 Remaining Gap

R8 does not define:

- certificate CN/SAN and PostgreSQL mapping/revocation;
- CNG KSP, key ACL and service account protection;
- Broker binary/config code integrity and DLL loading policy;
- a protection against another process under the same service SID using the
  key/DB credential;
- a detection mechanism that turns a compromised Broker into
  `TRUST_BOUNDARY_FAILED`.

The design says a compromised Broker invalidates evidence and publication, but
does not specify who detects the compromise or how the system stops claims.

**Finding `WP1GPR-P1-01`** — Broker process authenticity and compromise
detection are not closed. A same-SID/injected process can still use the
credential chain unless an explicit OS protection and negative test prove
otherwise.

## 5. B — Single Active Broker and OS Fencing

### 5.1 Direction

R8 correctly states:

- SCM singleton;
- global mutex;
- Job Object/process tree;
- handle/mmap/section checks;
- old process must be terminated before new Broker publishes.

### 5.2 Missing Details

R8 still lacks:

- mutex namespace/DACL/owner and abandoned-mutex behavior;
- exact SCM stop/restart and timeout behavior;
- Job breakaway/nested Job and child inheritance policy;
- section object and mmap enumeration;
- duplicate/inherited handle discovery;
- external AV/index/backup handles;
- an exact invariant that the new Broker cannot open v2 root before old
  handles are proven unreachable.

`PID`, boot epoch, lease and heartbeat are not handle-fencing evidence. R8
acknowledges this but does not provide the concrete OS evidence.

**Finding `WP1GPR-P1-02`** — single-Broker and old-handle fencing remains a
protocol outline, not an executable fail-closed fence.

## 6. C — Recovery DB/OS Two-Phase Protocol

### 6.1 Positive Direction

R8 correctly separates:

```text
DB revoke/claim
-> PENDING_OS_FENCE
-> OS proof
-> ISSUED
```

and does not claim DB and OS are one atomic transaction.

### 6.2 Remaining Races

1. DB CAS revokes old session, but the old Broker may still hold a Windows
   handle and execute a late publish.
2. A new Broker may acquire `PENDING_OS_FENCE` but crash before OS proof.
3. R8 does not define how PENDING session is revoked/retried or who owns it.
4. R8 does not define exact rowcount/CAS behavior for Attempt, Intent,
   Lifecycle and Operation together.
5. R8 does not define a durable old-process observation record tied to the
   new generation.

**Finding `WP1GPR-P1-03`** — Recovery DB/OS handoff still has ambiguous
failure ownership and a late-old-Broker window.

## 7. D — Publication Evidence Trust Boundary

### 7.1 Positive Direction

R8 correctly states:

- Broker is the OS fact producer and TCB;
- SECURITY DEFINER only constrains database writes;
- digest/hash is not OS truth;
- Broker compromise invalidates boot epoch/evidence/publication.

### 7.2 Missing Boundary

R8 does not prove how a compromised Broker is detected, nor how another
process under the same SID is prevented from calling ingestion with valid DB
credentials. It also does not specify exact:

- evidence sequence and accepted-evidence uniqueness;
- old-boot/old-session rejection query;
- target replacement/recovery verification;
- FileVersion binding trigger behavior.

**Finding `WP1GPR-P1-04`** — Evidence trust is explicitly Broker-attested but
the Broker process boundary and expiry/replay controls are still partial.

## 8. E — Legacy/v2 Data Model

R8 proposes preserving old tables and adding active `file_version_v2` plus
legacy archive. This is the correct non-destructive direction.

However, R8 does not provide:

- exact table/PK/FK/unique definitions for the old-to-v2 relationship;
- how `File.currentVersionId` references old vs v2;
- how Extraction/Field/Review/SecurityEvent/Audit foreign keys are preserved;
- whether old FileVersion IDs may be duplicated into v2;
- how existing route/service queries distinguish active v2 from legacy;
- migration interruption/repeat/rollback behavior;
- `publicationEvidenceId` NOT NULL enforcement for v2 and absence for legacy.

**Finding `WP1GPR-P1-05`** — legacy/v2 data model is not sufficiently defined
to implement or test without risking a historical reference bypass.

## 9. F — D0–D10

R8 has the right gate categories and correctly states that process, directory,
queue and handle state are different facts.

It still does not provide exact, repository-grounded:

- pg-boss queue names and state queries for retry/delayed/dead-letter;
- service/task/scheduler/process inventory commands;
- handle/section/mmap enumeration and evidence schema;
- ACL Effective Access evaluation;
- rollback transcript and re-switch evidence;
- evidence file location, actor, timestamp and signature/digest.

The report labels these as future verification; that is correct, but it means
the current baseline cannot be admitted to isolated verification as an
executable protocol.

**Finding `WP1GPR-P2-01`** — D0–D10 remains a verification outline, not a
reproducible test protocol.

## 10. P2/P3 Findings

### P2

1. **WP1GPR-P2-02** — Exact DB state/CAS/lock SQL is still pseudo-code without
   rowcount, deferred Trigger ordering and rollback assertions.
2. **WP1GPR-P2-03** — Evidence unique/accepted sequence and old-epoch rejection
   are not fully specified.
3. **WP1GPR-P2-04** — T7 graph, sourcePath and heartbeat contracts need exact
   schema/Trigger changes.
4. **WP1GPR-P2-05** — Fixture SQL and fault hooks are not implemented.
5. **WP1GPR-P2-06** — Legacy route/Worker/download/preview deny behavior is
   not fully enumerated.

### P3

1. **WP1GPR-P3-01** — Environment-specific evidence hashes/ownership labels
   are not attached.
2. **WP1GPR-P3-02** — Canonical naming/version registry for authority/evidence
   tables is absent.

## 11. Internal Consistency and State Checks

Positive:

- `PREPARED -> UNKNOWN` is removed;
- `UNKNOWN` follows only execution authority;
- `PENDING_OS_FENCE` is separate from `ISSUED`;
- DB and OS atomicity are explicitly distinguished;
- R5/BV7/BV8/R8 statuses remain recorded as external statuses.

Remaining contradictions/gaps:

- R8 says a compromised Broker invalidates Evidence, but no detector/witness
  exists;
- R8 says old session revoked, but no OS mechanism guarantees old handles
  gone;
- R8 says legacy old table preserved/new v2, but no full cross-table model;
- R8 says D0–D10 exact evidence, but no exact commands/data schema exists.

## 12. Fault Matrix

| Scenario | Required result | Current R8 evidence |
|---|---|---|
| two Broker starts | one publisher, one BLOCKED | DESIGN ONLY |
| old Broker paused/resumes | old session/handle denied | DESIGN ONLY |
| DB response loss | re-read exact owner/session | DESIGN ONLY |
| new Broker crashes after fence | PENDING session bounded/fail-closed | DESIGN INCOMPLETE |
| Evidence ingestion fail | target retained/no FileVersion | DESIGN ONLY |
| target replaced | integrity failure/no read | DESIGN ONLY |
| Legacy queue replay | old task remains blocked | DESIGN ONLY |
| inherited/duplicate handle | v2 access blocked | DESIGN ONLY |
| rollback old cleanup | no v2 permission | DESIGN ONLY |
| normal legacy read bypass | route denies legacy | DESIGN INCOMPLETE |

## 13. Isolation-Admission Decision

### A. Blocking P0/P1 defects

Yes:

- `WP1GPR-P1-01`
- `WP1GPR-P1-02`
- `WP1GPR-P1-03`
- `WP1GPR-P1-04`
- `WP1GPR-P1-05`

### B. Matters suitable for isolated verification after design correction

- exact CNG/mTLS/DB role behavior;
- mutex/Job/process/handle behavior;
- File ID/Volume/Reparse/target seal;
- PostgreSQL Trigger/COMMIT/deadlock;
- queue/drain/handle/ACL evidence;
- historical archive mapping.

### C. Current trust-model limits

A fully compromised Broker/DB credential cannot be independently detected by
the proposed SECURITY DEFINER protocol. R8 must either explicitly accept that
TCB failure or add an independent witness.

### D. Can an isolated environment be authorized?

Not yet. The design has blocking defects and lacks exact test contracts.

### E. What must be verified in real Windows/PostgreSQL?

All Windows service/SID/CNG/mTLS, Job/mutex/handle/mmap, File ID/Reparse/ACL,
Broker restart, DB Trigger/COMMIT/concurrency and Storage behavior.

### F. Architecture vs more documents?

The remaining issues include architecture/trust-boundary decisions, not merely
more explanatory text. A new independent OS witness or an explicit accepted
Broker TCB boundary is required.

## 14. Evidence-Level Classification

| Capability | DESIGN VERIFIED | PLATFORM DOCUMENTED | ISOLATED VERIFIED | PRODUCTION VERIFIED |
|---|---:|---:|---:|---:|
| Broker service identity | yes | partial | no | no |
| CNG/mTLS/DB role | yes | documented, unmeasured | no | no |
| single Broker/mutex/Job | yes | partial | no | no |
| handle/mmap/section fence | yes | partial | no | no |
| Recovery CAS | yes | DB design only | no | no |
| Evidence ingestion | yes | DB design only | no | no |
| Legacy/v2 | yes | DB design only | no | no |
| D0–D10 | yes | operational outline | no | no |

## 15. User Decision and Next Authorization

### B. Needs User Approval

- Native Broker TCB and service identity.
- CNG/mTLS/DB role topology.
- Single active Broker mutex/Job/process policy.
- Broker compromise boundary versus independent OS witness.
- Legacy/v2 table model and user-facing legacy policy.
- D0–D10 drain, downtime, ACL and rollback policy.

### C. Missing Evidence

- exact CNG key ACL/KSP, certificate mapping and process-integrity evidence;
- mutex/Job/handle/mmap/section observations;
- Broker restart/old-process recovery;
- actual legacy data mapping and API behavior;
- actual queue/worker/cleanup inventory;
- PostgreSQL and Windows tests.

## 16. R5 / BV7 / BV8 / R8

```text
R5: FAIL — DESIGN CORRECTIONS REQUIRED
R5 Open Decisions: 57/57 OPEN; 0 approved
BV7: FAIL
BV8: READY FOR INDEPENDENT REVIEW; NOT APPROVED
R8: BLOCKED — REQUIRED DESIGN EVIDENCE MISSING
```

No historical status is changed.

## 17. Git and Final Verdict

At review start:

```text
Branch: codex/public-github-sync
HEAD: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified: 0
Staged: 0
Deleted: 0
Untracked: 15
```

The final state is recorded in the delivery message. This report adds one
untracked file. Existing `$null`, `UNKNOWN'`, prior reports, `__pycache__/`
and the baseline report remain untouched.

```text
Review independence:
  PASS

WP-1G readability:
  PASS

Broker identity:
  PARTIAL — process authenticity/compromise detection incomplete

Single Broker/OS fence:
  PARTIAL — policy direction, no executable proof

Recovery:
  PARTIAL — DB/OS handoff and failure ownership incomplete

Evidence:
  PARTIAL — Broker TCB boundary declared, sequence/expiry incomplete

Legacy/v2:
  PARTIAL — table direction, cross-table relations/API bypass incomplete

D0-D10:
  PARTIAL — gates only, not executable evidence

Overall:
  FAIL — DESIGN CORRECTIONS REQUIRED BEFORE ISOLATED VERIFICATION

Source implementation:
  NOT AUTHORIZED

Database / Windows / ACL / Storage / Runtime:
  NOT VERIFIED
```

No source, Schema, Migration, Trigger, configuration or test was modified.
No database, Storage, Windows ACL/Service, E2E, Build, Native RPC or drain was
executed. `$null`, `UNKNOWN'`, `.next` and `.dist` were not read, hashed,
modified, moved or deleted.

