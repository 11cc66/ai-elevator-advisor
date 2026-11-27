# WP-1F-R — Independent Trust Boundary and OS Fencing Review

## 0. Review Control

```text
Stage: WP-1F-R
Mode: INDEPENDENT / READ-ONLY / ADVERSARIAL REVIEW
Date: 2026-11-25
Repository: D:\thinkbook\Desktop\jieya
Reviewed report:
  docs/architecture/wp-1-p1-3-upload-chain-trust-boundary-and-os-fencing-r6.md
Reviewed report SHA-256:
  37D7A8E9EDE744A87FB0FE5092EB119C80967C3ACBD6B3046971500F958D6FB6
Reviewed baseline:
  codex/public-github-sync
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

Final result:
  FAIL — TRUST BOUNDARY DESIGN CORRECTIONS REQUIRED

Source implementation:
  NOT AUTHORIZED

Database / Windows OS / ACL / Storage / Runtime:
  NOT ACCESSED
```

This is an independent design review. WP-1F’s `PASS WITH WARNINGS` is not
accepted as proof of its security claims.

## 1. Scope, Method and Evidence Levels

### 1.1 Scope

The review covers:

- WP-1F R6, complete;
- WP-1E-R, WP-1D-R, WP-1D, WP-1C-R, WP-1C, WP-1R and WP-1;
- current upload/download services and Storage Adapter;
- current Prisma Schema, P1-3 Migration and Trigger;
- the R5/BV7/BV8/R8 status boundary.

### 1.2 Method

1. Re-read the source and actual Trigger whitelist.
2. Trace the Windows service/CNG/DB role trust path.
3. Attack the single-Broker, old-Broker, stale-session, Recovery and
   Evidence-ingestion paths.
4. Check whether old immutable data can actually be represented in the
   proposed legacy/v2 model.
5. Treat all unexecuted Windows, DB and Storage controls as `NOT VERIFIED`.

### 1.3 Evidence Levels

| Level | Meaning |
|---|---|
| `SOURCE FACT` | Current source/Schema/Migration |
| `DESIGN` | R6 normative statement |
| `PLATFORM ASSUMPTION` | Official/expected Windows behavior, not measured |
| `NOT VERIFIED` | No execution or native proof |
| `BLOCKED` | No safe implementation path without new evidence/authority |

Skills applied:

- `$project-architecture`
- `$prisma-db-safety`
- `$security-audit`
- `$testing-and-verification`
- `$file-lifecycle`

## 2. Baseline and Evidence

### 2.1 Git Baseline

At review start:

```text
Branch: codex/public-github-sync
HEAD: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified: 0
Staged: 0
Deleted: 0
Untracked: 13
```

At final checkout, the review adds exactly one untracked report; all existing
work and artifacts are preserved. `$null`, `UNKNOWN'`, `.next` and `dist` are
not read, hashed, modified, moved or deleted.

### 2.2 Current Source Facts

| Source | Fact |
|---|---|
| `apps/web/src/modules/files/upload-service.ts:155-236` | Legacy Intent stagingKey. |
| `apps/web/src/modules/files/upload-service.ts:267-441` | Current claim/write/finalize path. |
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

### 2.4 WP-1F Input

WP-1F R6 file length: `34,032` bytes; line count: `1,027`; SHA-256:
`37D7A8E9EDE744A87FB0FE5092EB119C80967C3ACBD6B3046971500F958D6FB6`.

It declares:

```text
PASS WITH WARNINGS — TRUST BOUNDARY DESIGN COMPLETE
Implementation BLOCKED
```

The first line is a design claim; the second correctly acknowledges missing
runtime evidence.

## 3. WP-1E-R Six Blocking Findings

| WP-1E-R finding | WP-1F response | Independent result |
|---|---|---|
| Broker DB credential/OS identity | Service SID + CNG mTLS + DB role | `PARTIALLY RESOLVED` |
| Two/old Broker fencing | Service singleton + mutex + Job + boot epoch | `PARTIALLY RESOLVED` |
| Recovery CAS/session atomicity | revoke old session + PENDING_OS_FENCE | `PARTIALLY RESOLVED` |
| Evidence trust | Broker TCB declared, SECURITY DEFINER ingestion | `PARTIALLY RESOLVED` |
| Active FileVersion to legacy archive | preserve old table/new active table | `PARTIALLY RESOLVED` |
| D0–D10 evidence | command/evidence matrix added | `PARTIALLY RESOLVED` |

No item is `RESOLVED WITH EVIDENCE`; no Windows, DB or Storage control was
executed.

## 4. A — Broker Identity and Credential Binding

### 4.1 What R6 Defines

R6 defines a strong direction:

```text
Windows Service SID
  -> protected CNG private key
  -> PostgreSQL TLS client certificate
  -> dedicated Broker DB role
```

It also correctly states that the DB role authenticates a credential, not a
Windows PID/SID.

### 4.2 Missing Identity Details

R6 does not specify:

- the actual certificate subject/SAN/CN and PostgreSQL `pg_hba` mapping;
- certificate/key KSP/CNG provider, key ACL owner and access masks;
- whether the private key is machine-scoped or service-scoped;
- how Broker binary/config file ACLs prevent another service from using the
  key;
- code-integrity/signature checks before opening the private key;
- certificate revocation, rotation and stale connection behavior;
- how a stolen DB connection/credential is distinguished from a valid Broker
  process;
- whether an Administrator/SYSTEM process is explicitly outside or inside the
  guarantee.

The design says “Broker TCB,” which is a valid threat-boundary choice, but it
does not yet establish that only the intended Broker process can use the TCB
credential. A process injected into the Broker or a process sharing its
service identity remains capable unless OS process protection is proven.

**Finding `WP1FR-P1-01`** — Broker identity chain stops at service credential;
process authenticity and credential custody are not independently proven.

Required correction:

- specify CNG KSP/key ACL and owner;
- specify certificate/DB role mapping and rotation;
- define code-integrity/protected-process or explicitly accept same-SID
  injection as a TCB compromise;
- bind boot registration to a process identity/nonce and service lifetime;
- fail closed if certificate/process/boot evidence is unavailable.

## 5. B — Single Active Broker and OS Fencing

### 5.1 What R6 Defines

R6 proposes:

- Windows service singleton;
- global mutex;
- Job Object/process tree;
- boot epoch;
- old process exit and handle checks;
- fail-closed `BLOCKED` state.

This is directionally correct.

### 5.2 Missing OS Mechanics

R6 does not define:

- mutex namespace, DACL, creator identity, ownership, abandonment semantics or
  squatting prevention;
- Job Object breakaway, nested Job, child-process assignment and kill-on-close
  policy;
- duplicated/inherited handle creation and section object/mmap inventory;
- handle enumeration privilege and exact evidence format;
- service stop timeout, hung process behavior or process termination failure;
- whether a new Broker can open v2 root before old handle closure is proven;
- handling of external AV/indexer/backup handles;
- how a Broker process can be distinguished from a child process sharing its
  SID.

The design says “single active Broker” but does not make mutex/Job ownership a
verifiable OS state.

**Finding `WP1FR-P1-02`** — single-Broker arbitration and old-handle fencing
are not demonstrably closed.

Required correction:

- define exact mutex DACL/namespace/ownership and service instance behavior;
- specify Job breakaway/nested/child policy;
- specify native handle/mmap/section inventory and evidence;
- prove new Broker cannot open v2 root before old process/handle release;
- treat mutex loss/unknown as `BLOCKED`, never as takeover permission.

## 6. C — Recovery CAS and Authority Session

### 6.1 Positive Properties

R6 now explicitly revokes old sessions and creates a `PENDING_OS_FENCE` session
in the DB transaction. It correctly distinguishes:

```text
DB ownership transferred
OS authority not yet enabled
```

### 6.2 Remaining Races

1. **Old process holds handle:** old session is `REVOKED`, but the old Broker
   process may still have a target/staging handle. R6 requires OS fence, but
   does not define the mechanism that terminates that Broker.
2. **DB commit response loss:** the design says read back; it does not define
   exact read query/owner/generation/session predicate or a reconciliation
   state for an in-flight old owner.
3. **New Broker crash after PENDING_OS_FENCE:** the design does not define
   whether another Broker may reacquire, and how the lost PENDING session is
   revoked.
4. **CAS and rowcount:** no exact `Attempt`/`Intent` terminalization and
   deferred Trigger ordering is given.
5. **Old owner late DB update:** owner token/generation rejects it only if the
   old process cannot bypass the Broker client; the old Broker itself is not
   OS-fenced.

**Finding `WP1FR-P1-03`** — DB recovery and OS recovery remain separate
protocols with an unclosed handoff window.

## 7. D — Publication Evidence Trust Chain

### 7.1 What R6 Gets Right

R6 correctly states:

```text
Broker is the OS fact producer and trusted computing base.
SECURITY DEFINER controls DB write authority only.
Evidence digest is not OS truth.
Full Broker compromise invalidates evidence and must stop publication.
```

That is an honest trust-boundary statement.

### 7.2 Remaining Trust Gap

The protocol cannot distinguish:

```text
trusted Broker produced a valid Evidence row
malicious/injected process using the Broker service identity produced the row
```

The selected security guarantee therefore depends on Broker process integrity
and protected credential custody, not merely on the SECURITY DEFINER function.
R6 does not define a code-integrity boundary, protected process, or an
independent witness.

It also does not specify:

- exact accepted-evidence uniqueness and recovery-sequence rules;
- how an old boot/session Evidence is rejected after a new epoch;
- how a target replacement after Evidence is detected by the read path;
- how the FileVersion trigger validates target File ID and parent identity
  without a native probe.

**Finding `WP1FR-P1-04`** — Evidence is correctly labeled as Broker-attested,
but the Broker process identity boundary and evidence sequence constraints are
not closed.

## 8. E — Legacy Active FileVersion / v2 Migration

### 8.1 What R6 Proposes

R6 preserves an old `file_version`-like table and introduces active
`file_version_v2`; it prevents nullable evidence from entering normal access.
This is a better direction than modifying immutable rows.

### 8.2 Missing Data Model

R6 does not define:

- exact table names, primary keys and old-to-v2 mapping keys;
- how `File.currentVersionId`, `FileExtraction`, `ExtractionField`,
  `ExtractionTextBlock`, Review, SecurityEvent and AuditLog references are
  repointed or represented;
- whether old FileVersion IDs remain queryable or are copied;
- how active v2 `publicationEvidenceId NOT NULL` is enforced by Prisma and
  Trigger;
- how legacy Intent/FileVersion rows are prevented from being returned by
  existing list/detail/download/preview routes;
- what happens if an old active table has foreign keys from new v2 rows;
- transaction/rollback and partial migration behavior.

The phrase “preserve old table/new active table” is an architectural direction,
not a complete safe migration design.

**Finding `WP1FR-P1-05`** — legacy/v2 table migration has unresolved schema and
cross-table reference semantics.

## 9. F — D0–D10 Evidence

R6 provides a useful step table and correctly distinguishes process existence,
directory presence and queue state.

It still does not provide the task’s required exact operational evidence:

- exact queue queries and state distributions for retries, delayed, dead-letter
  and scheduler jobs;
- exact service/task/process inventory commands with their real names;
- native handle/section/mmap enumeration commands and output schemas;
- ACL Effective Access verification, not merely `Get-Acl`/`icacls` output;
- rollback transcript format and re-switch evidence;
- evidence storage location, responsibility and timestamp/identity proof.

**Finding `WP1FR-P2-01`** — D0–D10 is a gate outline, not an executable drain
acceptance protocol.

## 10. Attack and Failure Scenarios

### 10.1 Broker Credential Reuse

```text
Broker TCB is expected to hold CNG key + DB certificate.
A process injected into Broker or running under the same service SID obtains
access to the protected service context.
It calls Evidence ingestion with a structurally valid payload.
DB sees the valid Broker certificate/role.
FileVersion accepts evidence.
```

Without protected-process/code-integrity evidence, the DB-role check cannot
distinguish the intended Broker from an injected process.

### 10.2 Old Broker Resumes

```text
A has PUBLISH_ENABLED and an open target handle.
B starts, obtains a new DB epoch and revokes A's session.
A was paused and later resumes.
A performs write/close/publish using its existing OS handle.
B has a new session; DB is unaware of A's syscall.
```

DB revocation does not close A's handles. The design needs an OS stop/Job/
process fence and a target handle capability that A cannot reuse.

### 10.3 Recovery PENDING Session

```text
Recovery CAS revokes A, sets B PENDING_OS_FENCE.
B crashes before OS fence.
A resumes or another recovery starts.
```

R6 does not define whether PENDING session is revoked/expired and whether A
can continue after B’s failure. A two-phase status machine with explicit
`PENDING_OS_FENCE -> REVOKED/FAILED` behavior is required.

### 10.4 Legacy Read Bypass

```text
An old FileVersion row remains in the old table.
An old page/API queries the old table directly.
A user downloads the legacy object without v2 lifecycle/evidence checks.
```

R6’s normal API contract is not an exact route/query implementation or an
Authorization denial test.

## 11. Findings Register

### P1

1. **WP1FR-P1-01** — Broker process authenticity and credential custody
   incomplete; same-SID/injected process can reuse Broker credential.
2. **WP1FR-P1-02** — Single Broker/mutex/Job/handle fencing not closed.
3. **WP1FR-P1-03** — Recovery CAS/OS handoff and old-session fence incomplete.
4. **WP1FR-P1-04** — Evidence trust chain is Broker-TCB but lacks process
   integrity/sequence proof and independent witness.
5. **WP1FR-P1-05** — Active FileVersion/legacy v2 migration model is incomplete.
6. **WP1FR-P1-06** — D0–D10 evidence cannot yet prove queue/handle/ACL
   isolation in the target environment.

### P2

1. **WP1FR-P2-01** — exact SQL/CAS/Trigger ordering and rowcount assertions.
2. **WP1FR-P2-02** — target File ID/parent/ancestor Reparse and ACL readback
   field semantics.
3. **WP1FR-P2-03** — evidence uniqueness, accepted-evidence and old-epoch
   rejection rules.
4. **WP1FR-P2-04** — fixture SQL, fault hook implementation and two-connection
   evidence.
5. **WP1FR-P2-05** — old route/Worker/download/preview/list deny tests.

### P3

1. **WP1FR-P3-01** — full environment evidence hashes and traceability.
2. **WP1FR-P3-02** — canonical naming/version registry for evidence and
   authority tables.

## 12. Windows Guarantees vs Unverified Facts

| Property | Design | Windows proof |
|---|---|---|
| Service SID boundary | `DESIGN DEFINED` | `NOT VERIFIED` |
| CNG key custody | `DESIGN DEFINED` | `NOT VERIFIED` |
| mTLS/DB role mapping | `DESIGN DEFINED` | `NOT VERIFIED` |
| mutex/Job/SCM singleton | `DESIGN DEFINED` | `NOT VERIFIED` |
| handle/mmap release | `DESIGN DEFINED` | `NOT VERIFIED` |
| File ID/Volume/Reparse | `DESIGN DEFINED` | `NOT VERIFIED` |
| target seal/ACL effect | `DESIGN DEFINED` | `NOT VERIFIED` |

Official API semantics are a design basis, not runtime evidence.

## 13. Implementation Blockers

```text
BLOCK-01: prove only the intended Broker process can use CNG/DB credentials.
BLOCK-02: prove singleton/mutex/Job ownership and old-process termination.
BLOCK-03: prove old file/section/mmap handles cannot modify v2.
BLOCK-04: close the DB-to-OS Recovery handoff and PENDING_OS_FENCE failure.
BLOCK-05: define and enforce active-v2 evidence uniqueness and epoch rejection.
BLOCK-06: define complete legacy archive/v2 relation migration and route denial.
BLOCK-07: produce exact D0-D10 commands, queue states, handle/ACL evidence and
          rollback transcript.
BLOCK-08: execute native Windows and PostgreSQL tests in isolated environments.
```

## 14. What Is Ready for Further Work

The following design directions are sufficiently clear for a later
implementation design:

- Broker-only write authority and Copy-on-Publish;
- `PREPARED/EXECUTING/UNKNOWN/ABANDONED` semantics;
- DB-authoritative session table direction;
- boot epoch and one-use capability concepts;
- advisory lock and row-lock order direction;
- separate legacy read-only direction;
- D0–D10 gate categories.

They are not implementation authorization.

## 15. User Decisions A/B/C

### A. Derivable

- A-01: DB lease/owner generation is not OS handle closure.
- A-02: no active FileVersion without accepted evidence.
- A-03: no legacy record is inferred into a new active chain.
- A-04: no source implementation/Migration in this review.

### B. Recommended, Needs Approval

- B-01: native Broker service and protected CNG/mTLS identity.
- B-02: single active Broker with SCM/mutex/Job.
- B-03: DB-authoritative Authority Session.
- B-04: Broker TCB evidence boundary with SECURITY DEFINER ingestion.
- B-05: same local NTFS volume.
- B-06: 30s/120s lease.
- B-07: old table preservation plus active v2 table.
- B-08: D0–D10 drain.
- B-09: separate DB roles/ACL.

### C. Evidence Missing

- C-01: code integrity/process-injection resistance.
- C-02: CNG key/certificate/DB mapping and rotation.
- C-03: mutex/Job/old-handle/mmap behavior.
- C-04: exact File ID/volume/Reparse/ACL behavior.
- C-05: historical data/object mapping and archive migration.
- C-06: queue replay/drain/handle evidence.
- C-07: PostgreSQL Trigger/COMMIT/deadlock behavior.

## 16. Final Verdict

```text
Review independence:
  PASS

WP-1F readability:
  PASS

Broker identity:
  PARTIALLY RESOLVED — credential chain direction, process authenticity not proven

Single-Broker/OS fencing:
  PARTIALLY RESOLVED — arbitration outlined, old handles not proven

Recovery:
  PARTIALLY RESOLVED — DB/OS handoff still requires a precise fence

Evidence:
  PARTIALLY RESOLVED — Broker TCB declared, sequence/process boundary incomplete

Legacy v2:
  PARTIALLY RESOLVED — table direction present, references/API migration missing

D0–D10:
  PARTIALLY RESOLVED — gates present, executable evidence absent

Overall:
  FAIL — TRUST BOUNDARY DESIGN CORRECTIONS REQUIRED

Source implementation:
  NOT AUTHORIZED

Database / Windows / ACL / Storage / Runtime:
  NOT VERIFIED
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
Untracked: 13
```

The review adds one untracked report. Existing `$null`, `UNKNOWN'`, WP-1/
WP-1R/WP-1C/WP-1C-R/WP-1D/WP-1D-R/WP-1E/WP-1E-R/WP-1F reports,
`__pycache__/` and the baseline report remain untouched.

No source, Schema, Migration, Trigger, configuration or test was modified.
No database, Storage, Windows ACL, Service, E2E, Build, Native RPC or drain
operation was executed. `$null`, `UNKNOWN'`, `.next` and `.dist` were not
read, hashed, modified, moved or deleted. The final Git state is recorded in
the delivery message.

