# WP-1E-R — Independent Security Protocol Closure Review

## 0. Review Control

```text
Stage: WP-1E-R
Mode: INDEPENDENT / READ-ONLY / ADVERSARIAL REVIEW
Date: 2026-11-25
Repository: D:\thinkbook\Desktop\jieya
Reviewed report:
  docs/architecture/wp-1-p1-3-upload-chain-security-protocol-closure-r4.md
Reviewed baseline:
  codex/public-github-sync
  101e8a362e430f4fa7b31b67c56823cb702eb1e6

Final result:
  FAIL — SECURITY PROTOCOL DESIGN DEFECTS REMAIN

Source implementation:
  NOT AUTHORIZED

Database / Windows OS / ACL / Storage / Runtime:
  NOT ACCESSED
```

This is an independent design review. The WP-1E report is treated as a
proposal, not as evidence. A proposed field, function, state diagram or test
matrix is not a runtime control.

## 1. Executive Summary

WP-1E makes several important improvements:

- it removes `PREPARED -> UNKNOWN`;
- it selects a DB-authoritative Authority Session model;
- it selects one SECURITY DEFINER Evidence ingestion path;
- it defines a legacy archive/read-only direction;
- it specifies an explicit lock order and a 30s/120s lease baseline.

Those choices materially improve the design. They are not sufficient to pass
an independent security review.

The remaining blockers are trust-boundary and failure-domain defects:

1. The DB role authenticates a connection, not a Windows process. The design
   does not bind the Broker DB credential to the Broker service SID, PID,
   creation time, boot epoch or an authenticated process attestation.
2. Two Broker processes can register new boot epochs or coexist. DB session
   revocation does not close OS handles held by an old Broker.
3. SECURITY DEFINER insertion proves only that a DB role submitted a payload.
   It does not prove the Broker’s Windows FileId, handle-close or ACL claims.
   A compromised Broker/DB credential can forge structurally valid evidence.
4. After a Recovery CAS, the old Broker Authority Session is not explicitly
   revoked before the new owner may act. The old Broker can still hold a
   working handle or issue a late OS operation.
5. The legacy archive design does not specify how an existing non-null
   `FileVersion` chain and immutable FileVersion rows become archive records
   without deletion, nullable defaults or bypassing constraints.
6. D0–D10 has the correct gates but not the exact commands, queue-state
   evidence, inherited-handle detection and rollback evidence required to
   prove a safe switch.

The protocol is still a design draft with material trust assumptions, not a
closed security protocol.

## 2. Scope, Method and Evidence Levels

### 2.1 Scope

The review covers:

- WP-1E R4;
- WP-1D-R review;
- WP-1D R3;
- WP-1C and WP-1C-R;
- WP-1 and WP-1R;
- current Prisma Schema, P1-3 Migration, Trigger and relevant source;
- R5, BV7, BV8 and R8 status evidence.

### 2.2 Method

1. Read the complete reports and current source.
2. Rebuild the actual Operation whitelist from the Migration.
3. Trace the trust path from Windows API to Broker, DB Evidence, FileVersion
   and normal read.
4. Construct multi-Broker, stale-Broker, stale-DB-session, DB-role theft,
   Evidence substitution, Recovery double-claim and legacy archive attacks.
5. Treat all Windows/DB/Storage behavior as `NOT VERIFIED` unless directly
   source-proven.

### 2.3 Evidence Levels

| Level | Meaning |
|---|---|
| `SOURCE FACT` | Current source/Schema/Migration only |
| `DESIGN` | R4 normative statement |
| `HYPOTHESIS` | Proposed Windows/DB behavior |
| `NOT VERIFIED` | No execution or native proof |
| `BLOCKED` | Required evidence/authority absent |
| `FAIL` | Design can permit an invalid security result |

## 3. Baseline

### 3.1 Git

At review start:

```text
Branch: codex/public-github-sync
HEAD: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified: 0
Staged: 0
Deleted: 0
Untracked: 11
```

The existing untracked work includes WP-1, WP-1R, WP-1C, WP-1C-R, WP-1D,
WP-1D-R, WP-1E, `$null`, `UNKNOWN'`, `__pycache__/` and the post-GitHub
baseline report. All are preserved.

### 3.2 Current Source Facts

| Location | Fact |
|---|---|
| `apps/web/src/modules/files/upload-service.ts:155-236` | Legacy Intent-level `stagingKey`. |
| `apps/web/src/modules/files/upload-service.ts:267-441` | Current claim/write/finalize path. |
| `apps/web/src/modules/files/upload-service.ts:443-575` | FileVersion without P1-3 chain. |
| `apps/web/src/modules/files/upload-service.ts:599-605` | Catch marks only Intent failed. |
| `packages/file-storage/src/local-private-storage.ts:108-191` | `wx` staging and `access` + `rename` finalize. |
| `packages/file-storage/src/capabilities.ts` | Raw `openReadStream` remains exposed. |
| `apps/web/src/modules/files/download-service.ts:242-495` | No explicit ACTIVE lifecycle/evidence join in normal download. |

### 3.3 Current Database Facts

| Location | Fact |
|---|---|
| `prisma/schema.prisma:398-443` | FileVersion requires three chain fields. |
| `prisma/schema.prisma:501-655` | Intent/Attempt/Lifecycle/Operation relationships. |
| `prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql:992-1004` | Actual Operation transitions: PREPARED→EXECUTING/FAILED/ABANDONED; EXECUTING→APPLIED/UNKNOWN/FAILED; UNKNOWN→APPLIED/FAILED/ABANDONED. |
| Same Migration, lines 603-825 | Attempt and staging/canonical ownership. |
| Same Migration, lines 1194-1357 | Deferred upload chain checks. |
| Same Migration, lines 1797-1947 | FileVersion/lifecycle/finalize checks. |
| Same Migration, lines 1949-2005 | Intent guard; legacy fields not currently rejected/immutable. |

## 4. WP-1D-R Historical Closure Map

| WP-1D-R finding | WP-1E response | Independent status |
|---|---|---|
| Recovery owner/CAS ambiguity | Added owner/generation/CAS/lock order | `PARTIALLY RESOLVED` |
| Evidence trusted writer ambiguity | SECURITY DEFINER ingestion selected | `PARTIALLY RESOLVED` |
| Authority session store ambiguity | DB session + Broker DB verification selected | `PARTIALLY RESOLVED` |
| Legacy read-only storage gap | Legacy archive/API isolation added | `PARTIALLY RESOLVED` |
| Drain queue/handle/rollback gap | D0–D10 and rollback added | `PARTIALLY RESOLVED` |
| Evidence sequence ambiguity | Unique BROKER_PUBLISH plus recovery evidence | `PARTIALLY RESOLVED` |
| P2 sourcePath/T7/lease/fixtures | Logical contracts added | `PARTIALLY RESOLVED` |

No historical issue is `RESOLVED WITH EVIDENCE`; no real Windows, PostgreSQL
or Storage test has been executed.

## 5. A — Authority Session

### 5.1 Positive Changes

WP-1E correctly selects DB-authoritative session state and removes the
local-journal/database alternative. It defines:

- `StorageAuthoritySession`;
- a Broker DB role with limited EXECUTE functions;
- boot epoch registration;
- one-use capability;
- replay and revocation concepts;
- DB-unavailable fail-closed behavior.

### 5.2 P1 — DB Role Is Not Bound to the Broker OS Process

The design says the Broker authenticates as a DB role. It does not define how
the database proves that the connection belongs to:

```text
Broker service SID
Broker process image
Broker process creation time
current boot epoch
the process that owns the v2 file handles
```

If the Broker DB password/connection credential is copied to another process,
that process can call the restricted functions while presenting a valid DB
role. The DB role authenticates a credential, not the Broker process.

Required change: use a broker-specific OS/DB authentication binding (for
example certificate/credential custody with startup nonce, or a
process-attested boot registration that binds DB role, PID, creation time and
service SID). The exact mechanism is a B/C decision and must be verified.

### 5.3 P1 — Two Broker Boots and Old Broker

R4 says a Broker restart creates a new boot epoch and revokes old sessions. It
does not define a singleton Broker authority or a process fence that prevents:

```text
Broker A starts, acquires target handle/authority
Broker B starts, registers a new boot epoch
DB revokes A's session
A is paused/blocked and later resumes its already-open OS operation
```

DB revocation does not close A's file handles. New sessions in DB do not kill
A. The old broker can still write or publish its target if v2 ACL/service
identity remains the same.

Required change: a single active Broker process per boot/namespace, with
independent supervisor/Job/process termination evidence, or an OS authority
mechanism that prevents a second Broker from receiving the same v2 capability
while A's handles are unclosed. If this cannot be proven, normal upload remains
BLOCKED.

### 5.4 P1 — Recovery CAS Does Not Revoke Old Authority Atomically

R4's Recovery pseudo SQL updates the Operation/Lifecycle owner and generation,
then acquires Broker authority. It does not explicitly revoke the old session
in the same transaction or before the new owner can act:

```text
old owner/session still ISSUED/CONSUMED
owner generation changes
new recovery session is acquired
old Broker sends a late publish request
```

The DB session table must enforce a single active session per Operation and
atomically revoke/expire the old session as part of the CAS. The Broker must
reject the old session even if its local cache still holds it.

## 6. B — Publication Evidence Trust Chain

### 6.1 What SECURITY DEFINER Proves

The chosen SECURITY DEFINER function can prove:

- a function was called;
- the calling DB role was the Broker role;
- the payload matched the function’s structural checks;
- the row was inserted append-only.

It cannot prove:

- that a Windows handle was actually opened;
- that the target File ID was observed;
- that the source writer was closed;
- that the target ACL denied old writers;
- that the target was not replaced after the probe.

Those facts are produced by the Broker. If the Broker process or its DB
credential is compromised, the function accepts forged but well-formed
evidence. R4 states that digest is not OS truth, which is correct, but it does
not close a compromised-Broker boundary or provide an independent witness.

**Finding `WP1ER-P1-01`: Evidence trust chain ends at the Broker process, not
an independently verifiable OS fact.**

Required correction:

- explicitly document Broker compromise as outside the software guarantee, or
  add an independent Broker attestation/witness;
- bind the Broker DB role to the authenticated Broker process;
- require a native evidence probe that emits signed/structured OS facts;
- define whether the DB function trusts the role alone or verifies a
  boot/session attestation;
- make the FileVersion guard reject evidence whose Broker boot/session is not
  current.

### 6.2 Evidence Timing and Duplicate Rows

WP-1E defines one `BROKER_PUBLISH` per Operation and append-only recovery
evidence. It still needs exact constraints/Triggers:

- `BROKER_PUBLISH` uniqueness;
- recovery sequence monotonicity;
- accepted evidence selection;
- old boot epoch rejection;
- cross-Attempt and cross-Operation rejection;
- target replacement detection;
- FileVersion evidence FK enforcement.

These are design requirements, not current DB constraints.

### 6.3 Evidence Ingestion Failure

The design says retain target and Operation unknown when evidence insert fails.
It must also define:

```text
the target and evidence must not be considered ACTIVE
the same Operation may append one recovery evidence only
the recovery evidence must contain new target identity/ACL facts
old Broker evidence cannot be reused after boot epoch change
```

Without these, two valid-looking evidence rows could point to different target
objects.

## 7. C — Recovery, Locking and Attempt Finalization

### 7.1 Positive Changes

The R4 state matrix is compatible with the actual Trigger:

```text
PREPARED -> EXECUTING/FAILED/ABANDONED
EXECUTING -> APPLIED/UNKNOWN/FAILED
UNKNOWN -> APPLIED/FAILED/ABANDONED
```

The proposed lock order is a good direction:

```text
advisory storageKey -> Intent -> Lifecycle -> Operation -> Attempt
-> Evidence -> FileVersion
```

### 7.2 Remaining P1/P2

1. The pseudo SQL updates Operation before Lifecycle; the Trigger relation and
   deferred checks require the exact owner/generation/lease values on both
   rows. R4 does not define the complete update sequence and rowcount
   assertions.
2. Recovery acquisition happens after CAS; if Broker acquisition fails, the
   Operation has a new owner/generation but no valid session. A second worker
   must not take over until that state is reconciled.
3. The design does not define how an old worker's database connection is
   invalidated before it can update owner fields.
4. It does not define how an `UNKNOWN` Operation with an old Broker session is
   prevented from being closed by an old worker after new generation.
5. It does not specify exact result when `PREPARED -> ABANDONED` and
   `FINALIZING Attempt -> RECOVERY_REQUIRED -> FAILED` occur in one
   transaction under deferred Triggers.

### 7.3 Permanent Open Attempt

The design says a new Attempt is allowed only after old Attempt terminal and
Intent PENDING. It does not show the exact transaction order that satisfies:

```text
FileUploadIntent.currentAttemptId
FileUploadAttempt.status
storage_object_lifecycle.state
storage_object_operation.state
deferred p13_assert_upload_chain
```

A test fixture must prove no `FINALIZING`/`RECOVERY_REQUIRED` Attempt remains
when a new upload is admitted.

## 8. D — Windows Identity and Target Seal

WP-1E correctly names Volume Serial, File ID, parent File ID, Reparse,
`FILE_ATTRIBUTE_TAG_INFO`, handle close and ACL readback. It still has
unverified and incomplete properties:

- ancestor Reparse checks are implied but not specified for every path
  component;
- `writerClosed` is an attestation from the Broker; the design must show the
  exact handles/process identities whose closure was observed;
- duplicate/inherited/child handles are not proven unless the old process is
  drained and no v2 access remains;
- target seal changes ACL after a write handle is closed but cannot revoke an
  already-open handle; the design handles this only through drain/ACL
  assumptions;
- `targetWriteDeniedForOld` is a boolean; its exact SID set, access mask and
  readback are not defined;
- a Broker restart does not inherently close a child or inherited handle;
- a target being different from staging is necessary but not sufficient to
  prove that no old writer can modify the target.

These are `NOT VERIFIED` until a native probe and fault injection exist.

## 9. E — Legacy Read-only and Backfill

### 9.1 Positive Changes

R4 correctly separates unmappable records from active FileVersions and refuses
to fabricate evidence. It proposes separate legacy archive tables and an API
denial contract.

### 9.2 P1 — Archive Migration Boundary Is Still Unspecified

The current P1-3 active `file_version` table has non-null chain fields and
FileVersions are append-only. R4 says unmappable rows live in
`LegacyFileVersion`, but does not specify:

- how an existing active FileVersion row is copied to the archive without
  deleting or mutating immutable history;
- whether old rows remain in `file_version` with a legacy marker;
- how `publicationEvidenceId` is null for archive rows without violating the
  new FK/NOT NULL;
- how File/Intent/Extraction/Review references are handled;
- how normal list/download/preview are denied for archived records;
- whether any migration may remove an active FileVersion row and under what
  separate authority.

This is a design blocker (`WP1ER-P1-03`).

### 9.3 Evidence and Residual Data

`HISTORICAL_VERIFIED` is described as migration-only evidence, but R4 does not
define:

- evidence ingestion function and caller role;
- source snapshot and object identity verification;
- canonical target identity after historical verification;
- whether old FileVersion can be linked to an ACTIVE Lifecycle;
- permanent retention/lifecycle of the archive.

No actual historical data has been read; no backfill is verified.

## 10. F — Legacy Drain and Rollback

R4’s D0–D10 sequence is a sound gate, but it still lacks exact operational
commands and evidence formats required by the task:

| Gap | Why it matters |
|---|---|
| No exact process/service/scheduler inventory commands | An unlisted old process can retain v2 authority |
| No exact queue state query | Retry/dead-letter/recreated jobs may re-enter after D2 |
| No inherited/duplicate handle probe | Process exit is not handle release |
| No exact ACL evaluation command | Old SID may retain inherited rights |
| No switch/rollback command transcript | A failed canary can be mishandled |
| No post-switch alert thresholds | Old process/cleanup can reappear |

The design correctly says process exit is not enough, but it has not produced
the concrete control evidence yet. This is `PARTIALLY RESOLVED`.

## 11. Attack Paths and Timing

### 11.1 Two Broker Epochs

```text
Broker A: old boot epoch, active target handle
Broker B: new boot epoch, DB revokes A sessions
Broker A: paused, then resumes copy/write
DB: A is stale
FS: A still owns a handle
```

If both processes share the Broker service SID and v2 ACL, DB revocation does
not stop A. The design needs process/session fencing independent of DB state.

### 11.2 DB Role Credential Theft

```text
attacker obtains Broker DB role credential
attacker calls p13_append_publication_evidence
payload has structurally valid File ID/ACL values
DB accepts evidence
FileVersion references forged evidence
```

The DB role check passes because the credential is valid. The design must bind
the DB connection to the Broker process/SID or state this as an accepted
trust compromise.

### 11.3 Recovery CAS vs Old Broker

```text
Recovery CAS sets new owner/generation
old Broker still holds a v2 handle
Recovery calls Broker acquire
old Broker sends a late publish
new owner also attempts publish
```

The DB state must atomically revoke the old session and require the Broker to
reject the old capability before any new owner path. The current design only
describes this in prose.

### 11.4 Legacy Archive Read Bypass

```text
LegacyFileVersion contains old object metadata
a normal list route queries file_version
or an old FileVersion row remains active
normal download receives a storageKey
```

R4 says normal routes reject legacy records but does not define the exact
query/route/API boundary or active-row migration.

## 12. P1/P2/P3 Finding Register

### P1

1. **WP1ER-P1-01** — Broker DB role identity is not bound to the Broker OS
   process; two Broker processes and DB credential reuse remain possible.
2. **WP1ER-P1-02** — Evidence SECURITY DEFINER ingestion authenticates a DB
   role, not the Windows OS facts; compromised Broker can forge structurally
   valid evidence.
3. **WP1ER-P1-03** — Recovery CAS and old Authority Session revocation are not
   one atomic, OS-fenced takeover.
4. **WP1ER-P1-04** — Legacy archive migration has no safe representation for
   existing immutable FileVersions and their chain references.

### P2

1. **WP1ER-P2-01** — Exact lock/CAS SQL and deferred transaction ordering are
   not fully specified.
2. **WP1ER-P2-02** — Evidence uniqueness/accepted-evidence rules need exact
   DDL/Trigger assertions.
3. **WP1ER-P2-03** — T7 graph/sourcePath/lease rules remain pseudo-design.
4. **WP1ER-P2-04** — D0–D10 lacks exact commands, output schemas and queue
   state evidence.
5. **WP1ER-P2-05** — Fixture SQL/fault hooks are not executable yet.
6. **WP1ER-P2-06** — Normal read evidence/lifecycle binding is still a future
   implementation contract.

### P3

1. **WP1ER-P3-01** — Historical status hashes and live environment evidence
   are not attached to the design.
2. **WP1ER-P3-02** — Evidence/authority field naming and ownership need one
   canonical type registry.

## 13. Database Permissions and Trust Chain

### 13.1 Desired Trust Chain

```text
Windows Broker process
  -> OS peer SID/process identity
  -> Broker DB role/session
  -> restricted SECURITY DEFINER function
  -> immutable Evidence
  -> FileVersion FK
  -> normal verified read
```

### 13.2 Actual Gap

The middle link is not proven: a DB role is not a Windows process. The design
must define how the Broker’s DB credential is uniquely bound to the Broker
service identity and current boot/epoch, and how a second process using the
same service SID is denied. If this cannot be proven, the Evidence chain is
only a role-asserted claim.

No `PUBLIC` EXECUTE, owner, `search_path`, parameter validation, direct table
grant, or DDL ownership is currently specified in enough detail to call the
function chain secure.

## 14. Design Parts Ready for Further Work

The following are sufficiently clear to carry into a later implementation
design, subject to the blockers:

- PREPARED/EXECUTING/UNKNOWN/ABANDONED state semantics;
- advisory lock order direction;
- 30s heartbeat / 120s lease baseline;
- separate legacy archive direction;
- Namespaced local IPC and one-use capability shape;
- target File ID/Volume/Reparse/seal evidence field set;
- D0–D10 gate categories;
- fail-closed response to missing evidence and unknown OS outcome.

They are not implementation authorization.

## 15. Decisions Requiring User Approval

### A. Derivable

- A-01: PREPARED cannot become UNKNOWN.
- A-02: DB lease is not OS fencing.
- A-03: no active FileVersion without accepted evidence.
- A-04: no legacy row is inferred into a complete chain.
- A-05: no source implementation or Migration in this review.

### B. Recommended, Needs Approval

- B-01: Native Storage Authority Broker and service SID.
- B-02: DB-authoritative Authority Session with a process-bound Broker
  credential.
- B-03: SECURITY DEFINER Evidence ingestion, or an explicitly reviewed
  independent attestation.
- B-04: same local NTFS volume.
- B-05: 30s/120s lease.
- B-06: new Attempt for known failure; exact same-Operation recovery for
  UNKNOWN.
- B-07: separate legacy archive/read-only API.
- B-08: D0–D10 drain and v2 ACL isolation.
- B-09: separate DB roles and ACLs.

### C. Evidence Missing

- Windows process/handle/ACL/Reparse/File ID behavior.
- Broker process-to-DB-role binding.
- Two-Broker/old-Broker termination behavior.
- Actual historical data and archive migration.
- Actual old Worker/queue/cleanup inventory.
- PostgreSQL Trigger/COMMIT/lock behavior.
- Real v2 root/parent/target ACL and target seal behavior.

## 16. Mandatory Implementation Blockers

```text
BLOCK-01: Bind Broker DB role to Broker OS process/boot/service identity.
BLOCK-02: Define single-active-Broker fencing and old-handle termination.
BLOCK-03: Make Recovery CAS revoke old session atomically.
BLOCK-04: Select an evidence trust boundary that addresses Broker compromise.
BLOCK-05: Specify legacy active-FileVersion migration/archive rules without
          deleting or mutating immutable history.
BLOCK-06: Specify exact D0-D10 commands, queue states, handle evidence and
          rollback transcripts.
BLOCK-07: Implement and execute native Windows identity/ACL probes.
BLOCK-08: Implement and execute DB Trigger/COMMIT/concurrency tests.
```

## 17. R5 / BV7 / BV8 / R8

```text
R5 independent review: FAIL — DESIGN CORRECTIONS REQUIRED
R5 Open Decisions: 57/57 OPEN; 0 user-approved
BV7: FAIL — BLOCKING DESIGN CORRECTIONS REQUIRED
BV8: READY FOR INDEPENDENT REVIEW; NOT APPROVED
R8: BLOCKED — REQUIRED DESIGN EVIDENCE MISSING
```

This review does not change any baseline status. The Storage Authority Broker
is not the R4/R5 Termination Host/Worker and cannot inherit its service,
credential or ACL authority.

## 18. Final Verdict

```text
Review independence:
  PASS

WP-1E protocol readability:
  PASS

Authority Session:
  PARTIAL — unique store chosen, process/DB identity binding incomplete

Publication Evidence:
  PARTIAL — unique ingestion chosen, OS fact trust chain incomplete

Recovery:
  PARTIAL — state/CAS direction correct, old-session revocation race remains

Windows Identity:
  NOT VERIFIED — native probe/ACL/handle evidence absent

Legacy Read-only:
  PARTIAL — archive direction present, immutable active-row migration absent

Legacy Drain:
  PARTIAL — gates present, exact command/queue/handle evidence absent

P2:
  PARTIAL — pseudo-design and test contracts still need implementation detail

Overall:
  FAIL — SECURITY PROTOCOL DESIGN DEFECTS REMAIN

Source implementation:
  NOT AUTHORIZED

Database / Windows OS / ACL / Storage / Runtime:
  NOT VERIFIED
```

This is a design-review failure. It does not claim that the current
application has been exploited; it states that the proposed protocol cannot
yet prove the required trust and fencing invariants.

## 19. Git and Integrity

At review start:

```text
Branch: codex/public-github-sync
HEAD: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified: 0
Staged: 0
Deleted: 0
Untracked: 11
```

At review end:

```text
Branch: codex/public-github-sync
HEAD: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified: 0
Staged: 0
Deleted: 0
Untracked: 12
```

This review adds one untracked file. Existing `$null`, `UNKNOWN'`,
WP-1/WP-1R/WP-1C/WP-1C-R/WP-1D/WP-1D-R/WP-1E reports, `__pycache__/` and the
baseline report remain untouched.

No source, Schema, Migration, Trigger, configuration or test was modified.
No database, Storage, Windows ACL, Service, E2E, Build, Native RPC or drain
operation was executed. `$null`, `.next`, `.dist` and `UNKNOWN'` were not
read, modified, moved or deleted.

