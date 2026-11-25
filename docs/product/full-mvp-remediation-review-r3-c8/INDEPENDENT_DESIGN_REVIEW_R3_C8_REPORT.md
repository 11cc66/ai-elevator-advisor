# FULL-MVP-REMEDIATION-REVIEW-R3-C8

Date: 2026-11-24

Review mode: independent, read-only, adversarial.

## 1. Overall Result

```text
Overall: FAIL — DESIGN CORRECTIONS REQUIRED
P0: 0
P1: 4
P2: 4
P3: 3
```

C8 materially improves candidate binding, source-row digests, Session backend
binding, policy lifecycle and Snapshot deferred validation. It is still not
ready for an implementation or Runtime-readiness gate because:

- Snapshot Price business content is outside the source digest;
- Requirement, CatalogReview and ProfessionalReview source identity/content can
  still be forged while the Snapshot remains internally consistent;
- session-role validation does not enforce the claimed role/privilege closure;
- the clean-database CONNECT and initial AuthorityGrant path cannot execute.

## 2. Skills Actually Used

The following local skill instructions and their referenced checklists were read
in this review session:

- `$project-architecture`;
- `$prisma-db-safety`;
- `$security-audit`;
- `$testing-and-verification`;
- `$file-lifecycle`.

Application:

- architecture boundaries prevented treating design completeness as implemented
  behavior;
- database safety drove FK, privilege, transaction and trigger review;
- security audit drove the untrusted-caller and replay counterexamples;
- testing verification constrained offline evidence and distinguished parser,
  compilation and runtime claims;
- file lifecycle was checked for boundary preservation and contributed the
  fail-closed treatment of unverifiable lifecycle state.

No file-lifecycle implementation change was authorized or made.

## 3. Input Integrity

C8:

```text
Manifest: SHA256SUMS_R3_C8.txt
SHA-256: 672D6206D06E4282F7C8684A3811654EEDDA72E52C55B6EDF2C324B5C131E853
Bytes: 3530
Lines: 22
Records: 22
Unique paths: 22
SHA/byte/line mismatches: 0
Coverage differences: 0
Actual C8 files including manifest: 23
```

All 23 C8 files were present. The manifest correctly excludes itself as a record
and covers every other file.

C7 inputs:

```text
Design manifest SHA-256:
160A2BB8F93F473063225A2DBE04C8F807E456E1B50C4DF0D82B861B84BF3094
Records: 64; mismatches: 0

Review manifest SHA-256:
5254758B8B47AEBB8E591CBB380F371398EE59035D48D239D02331E09FFCC118
Records: 19; mismatches: 0

C7 Findings SHA-256:
B9E16C01B5950931AF92455F484F5CAC0E56EC60C12D05F0CE32FDB2EACE0BF0
```

## 4. Independently Reproduced Evidence

### C6-SNAP-01

Independent Python reconstruction, without importing C8 tools:

```text
Records: 15
Types: 0,1,1,2,2,3,3,4,4,5,5,6,7,8,9
Bytes: 4036
SHA-256: 7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB
Result: PASS
```

The C7 Node encoder independently produced the same length, record sequence and
SHA-256.

### R6 offline vectors

```text
Scalar vectors: 23/23 PASS
Resource-limit vectors: 14/14 PASS
SourceKey NFC static SQL path: PASS
Decimal 18-digit static SQL path: PASS
Exact Header Tag/Type static SQL dispatch: PASS
StableKey arity static SQL dispatch: PASS
```

This is not PostgreSQL execution.

### Object/DDL scan

```text
Tables: 50
Unique views: 9
Unique functions: 78
Parsed FKs: 64
Required digest FKs: 9
Function owner assignments: 78
Roles: 16
Triggers: 103
Deferred constraint triggers: 12
Tables with named TRUNCATE guards: 35
Unique function call targets: 32
FK target-key/source-column findings: 0
Registry signature/owner mismatches: 0
Unsafe Security-Definer search paths: 0
```

## 5. R3-C7 Findings

```text
INDEPENDENTLY RESOLVED: 6/13
PARTIAL:                 4/13
NOT RESOLVED:            3/13
```

- `RESOLVED`: P1-01, P1-06, P2-01, P2-02, P2-05, P3-01.
- `PARTIAL`: P1-03, P2-03, P2-04, P2-06.
- `NOT RESOLVED`: P1-02, P1-04, P1-05.

The detailed mapping is in
`HISTORICAL_FINDING_CLOSURE_MATRIX_R3_C8.md`.

## 6. Historical Findings

```text
R3-C4:
RESOLVED 7/11
PARTIAL 1/11
NOT RESOLVED 3/11

R3-C5:
RESOLVED 1/5
PARTIAL 2/5
NOT RESOLVED 2/5

R3-C6 P1:
RESOLVED 3/4
PARTIAL 0/4
NOT RESOLVED 1/4

R3-C6 P2:
RESOLVED 6/6
PARTIAL 0/6
NOT RESOLVED 0/6
```

## 7. Open Decisions

```text
Original Open Decisions: 57
Independently Reviewed: 57/57
Approved by User: 0
Still OPEN: 57
Implementation blockers: 57 remain OPEN
```

No identifier was lost, renamed or combined. No open decision was treated as an
approval. The following areas remain deployment/implementation blockers:
identity broker and topology, initial privilege provisioning, price validity,
function ownership, lock limits, retention/export and break-glass.

## 8. Positive Findings

- C8 fixes the direct Snapshot Candidate result key with a complete row digest
  and an exact FK to the sealed result.
- All 64 parsed FKs have matching source/target arity and an exact referenced
  PRIMARY KEY/UNIQUE target key.
- The C8-added product/specification/SelectionRun uniqueness repair is correct at
  static design level.
- Requirement/source/warning/missing/parameter child digests and set comparisons
  materially improve Snapshot integrity for the fields they cover.
- Snapshot state tables have deferred final-state triggers and named TRUNCATE
  guards.
- Policy revision digests are computed inside the database, Policy events and
  revisions are append-only, and Policy pointer composite relations are present.
- `trusted_session_status_v` now uses the active caller context and scoped audit
  authority rather than testing whether the target Principal has an audit grant.
- Recipient and audit-subject Principal are now separate AuthorityGrant fields.

## 9. Blocking Findings

1. Price values and validity are not covered by the Snapshot source digest.
2. Requirement/CatalogReview/ProfessionalReview source identities and
   ProfessionalReview decision/basis/time can be forged before sealing.
3. Session role validation checks only direct memberships and a subset of role
   attributes.
4. Clean database cannot issue the first AuthorityGrant; session login roles
   lack a specified direct `CONNECT` path.

Detailed evidence, counterexamples and acceptance criteria are in
`INDEPENDENT_REVIEW_R3_C8_FINDINGS.md`.

## 10. Main DDL / Overlay and PostgreSQL Boundary

The complete DDL contains the frozen C7 base followed by marked C8 final-state
corrections. The overlay is not a standalone complete DDL; it depends on the C7
base, and C8 documents that ordering. No function return-type conflicts or
duplicate overlay trigger/table/role declarations were found in the independent
static comparison.

```text
PostgreSQL SQL Grammar:
NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER

PostgreSQL Compilation:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Catalog Introspection:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Runtime Concurrency:
NOT VERIFIED — RUNTIME NOT AUTHORIZED

Database:
NOT ACCESSED

Storage:
NOT ACCESSED

Runtime:
NOT EXECUTED

Production:
NOT AUTHORIZED

Git Writes:
NONE
```

No C8 generator or evidence tool was executed during this review.

## 11. Shell and Side Effects

The final/current PowerShell process was independently verified as:

```text
PowerShell: 7.6.9
PSEdition: Core
ExecutablePath:
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe
FileVersion: 7.6.9.500
Parent: codex.exe
WorkingDirectory: D:\thinkbook\Desktop\jieya
```

Several read-only commands were accidentally dispatched under Bash during this
review. They failed at Bash command lookup before executing PowerShell syntax.
No Bash output is used as evidence. The exact commands and outcomes are recorded
in `evidence/SHELL_AND_EXECUTION_EVIDENCE_R3_C8.md`.

Initial and final Git snapshots:

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified entries: 41
Untracked entries: 71
Staged: 0
Deleted: 0
Status lines: 112

Initial untracked files with -uall: 622
Final untracked files with -uall:   636
New review files:                    14
```

Only files under the new R3-C8 review directory were added by this review.

## 12. Stop State

This review does not authorize R3-C9, design edits, source changes, Prisma,
Schema, Migration, PostgreSQL execution, Storage, Runtime, deployment or Git
writes. A separately authorized R3-C8 correction phase is required.
