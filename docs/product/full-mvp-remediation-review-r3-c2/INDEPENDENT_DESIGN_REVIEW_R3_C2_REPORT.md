# FULL-MVP-REMEDIATION-REVIEW-R3-C2 Independent Design Review

Date: 2026-11-24

Project root: `D:\thinkbook\Desktop\jieya`

Review mode: independent, read-only, adversarial design review.

Overall result:

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

R3-C2 substantially improves the proposed ownership, typed-value and
event-only models. It is not yet independently approvable because one
published fixed-vector suite is not reproducible, professional-review source
events can cross Requirement ownership, and the new UUID source-key model
conflicts with current CUID/text identifiers.

No source, Schema, Migration, database, Storage, Build, Native RPC or Runtime
operation was performed.

## 1. Input Integrity

All R3-C2 inputs and the manifest were independently rehashed:

| File | Bytes | Lines | SHA-256 | Result |
|---|---:|---:|---|---|
| `P1_PRODUCT_REMEDIATION_DESIGN_R3_C2.md` | 47973 | 1431 | `18504FFB170D8E868E1BAF032A180EEBC2F6726FBD3171D2A4967F4F8B006B18` | MATCH |
| `P1_PRODUCT_REMEDIATION_TRACEABILITY_R3_C2.md` | 6194 | 102 | `1D14AD502742C6FF0483C63898B2FD9AE154782744DB9161C8BF88DBF76379EB` | MATCH |
| `P1_PRODUCT_REMEDIATION_TEST_PLAN_R3_C2.md` | 20937 | 183 | `EE59D7A689DE1F7B01A5795C52192D4C8CF9AED1968F72C592DD4D0DF43557AE` | MATCH |
| `P1_PRODUCT_REMEDIATION_OPEN_DECISIONS_R3_C2.md` | 6192 | 137 | `5BC402D7A59C716DA391345324E6C092B63146401D0246835AC1C2D0163C231B` | MATCH |
| `P1_PRODUCT_REMEDIATION_R3_C2_CHANGELOG.md` | 4951 | 146 | `65AC6DCE8F65050F71590ADD70AB4E7FAD16AB030889BF8B04E0DBD3888EAF9C` | MATCH |
| `SHA256SUMS_R3_C2.txt` | 808 | 5 | `FDE251B0C004E41548113B11A20638142F7BF1A4DF6A1F5F4C069A094A3F0EA7` | MATCH |

R3/R2 design and review manifests, R1 design/review, MVP build/review
evidence and current source status were also checked. No input file was
modified.

## 2. Shell and Worktree

The actual execution process is:

```text
ExecutablePath:
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe

FileVersion: 7.6.9.500
PSEdition: Core
Internal PSVersion: 7.6.9
Parent executable: Codex app resources\codex.exe
```

Initial and final worktree:

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 41
Untracked entries: 71
Staged: 0
Deleted: 0
```

The complete status list is unchanged from the prior baseline except for the
new review directory under the existing `?? docs/product/` aggregate entry.
No source, Schema, Migration, test, configuration or existing R3-C2 document
was changed.

## 3. Review Scope and Limitations

Reviewed:

- all six R3-C2 design inputs;
- R3 independent review and findings;
- R2/R1 accepted design decisions and Open Decisions;
- current advisor, selection, MVP store, contracts and selection-engine code;
- current `prisma/schema.prisma` and MVP migration;
- relevant P1-3 boundary/status material.

Not performed:

- source, Schema, Migration or test modification;
- database connection, SQL, migration, seed or reset;
- test, E2E, browser, Build, Storage, Native RPC or Runtime execution;
- Git write operation;
- ACL, Owner, Service, Registry, PFR or `$null` operation.

The vector verification used an in-memory second implementation only. It wrote
no project file, database row or external artifact.

## 4. Six P1 Conclusions

| P1 | Result | Reason |
|---|---|---|
| `REV-R3-P1-01` Requirement parent key | `APPROVED WITH DEPENDENCY` | C2 now declares exact four/five-column keys and the child FKs. Source-key UUID type needs the CUID compatibility decision below, so implementation remains blocked. |
| `REV-R3-P1-02` typed Assertion/FieldValue | `APPROVED WITH DEPENDENCY` | Typed columns, status/source checks and exact ownership are present. Exact SQL types, decimal scale, ranges and unit catalogue remain under `OD-R3-C2-01`. |
| `REV-R3-P1-03` RuleSet event-only | `APPROVED WITH DEPENDENCY` | Current status is event-derived and direct status truth is removed. Exact transition-function owner/grants and policy approval remain `OD-R3-C2-03`. |
| `REV-R3-P1-04` ProfessionalReview event-only | `CORRECTION REQUIRED` | Current state is event-derived, but `sourceProfessionalReviewEventId` can point to a professional review from another Requirement/Production scope. See `REV-R3-C2-P1-02`. |
| `REV-R3-P1-05` R3-BASIS-1 | `CORRECTION REQUIRED` | The fixed-vector suite is not reproducible: V01–V20 have an unstated two-byte frame and V21 does not encode INTEGER with the required 8-byte value. See `REV-R3-C2-P1-01`. |
| `REV-R3-P1-06` Snapshot source consistency | `CORRECTION REQUIRED` | `sourceFieldValueId + sourceKind + sourceKey` is correct for the field value, but the professional source event lacks the same requirement/version ownership check. |

## 5. P2-A through P2-E

| Group | Result | Reason |
|---|---|---|
| P2-A `REV-R2-P2-01` | `APPROVED WITH DEPENDENCY` | Scenario NOT NULL, backfill, freeze, quarantine, row lock and race tests are specified. Historical mapping remains `OD-R3-06`. |
| P2-B `REV-R2-P2-02` | `APPROVED WITH DEPENDENCY` | RuleSet event-only status and exact Revision/Policy/Basis binding are designed; function owner/grant policy remains open. |
| P2-C `REV-R2-P2-03` | `APPROVED WITH DEPENDENCY` | Conversation/actor/message/version and success/failure/COMMIT-unknown semantics remain precise. Failure retention remains `OD-R3-08`. |
| P2-D `REV-R2-P2-04` | `APPROVED WITH DEPENDENCY` | Catalog/Professional policy revisions are exact-bound; policy continuity and function authority remain undecided. |
| P2-E `REV-R2-P2-05` | `CORRECTION REQUIRED` | The plan has the intended direct tests but the fixed-vector result fails and multi-record/multi-field coverage is incomplete. |

The previously accepted conditional semantics, conversation/project
separation, no-approved-rule → no Operational, DEMO immutability,
technical/commercial/trust/professional separation, sales main ownership chain,
SQL-scoped sales filtering and P1-3 isolation are preserved.

## 6. R3-BASIS-1 Independent Reconstruction

Independent result:

```text
V01–V20: NOT REPRODUCIBLE
V21: NOT REPRODUCIBLE
V22–V23: REPRODUCIBLE
V24–V26: REJECTION CONFIRMED
```

The exact V01 byte comparison shows an extra `0000` after the 16-byte row ID
and before `stableKeyLength` in the published vector. The protocol does not
define that field. V21 declares an INTEGER but carries one byte `31` instead
of an eight-byte signed integer.

The detailed expected/actual hashes and rejection checks are in
`R3_BASIS_V2_INDEPENDENT_VECTOR_VERIFICATION.md`.

## 7. New Findings

| ID | Severity | Summary |
|---|---|---|
| `REV-R3-C2-P1-01` | P1 | Published R3-BASIS-1 vectors are inconsistent with the protocol and not reproducible. |
| `REV-R3-C2-P1-02` | P1 | ProfessionalReview event source can cross Requirement/version ownership. |
| `REV-R3-C2-P1-03` | P1 | UUID source identity conflicts with current CUID/text identifiers and has no migration path. |
| `REV-R3-C2-P2-01` | P2 | Typed SQL widths/ranges/scale/unit catalogue remain under-specified. |
| `REV-R3-C2-P2-02` | P2 | Valid vectors cover only one record and one field; no multi-record ordering/completeness vector. |
| `REV-R3-C2-P2-03` | P2 | Unsupported source kinds have no explicit quarantine path. |
| `REV-R3-C2-P2-04` | P2 | Event function ownership/grant details and policy authoring constraints remain incomplete. |
| `REV-R3-C2-P3-01` | P3 | Traceability marks R3-BASIS-1 addressed despite failed vector reproduction. |

## 8. Open Decisions

All `OD-R2-01`–`OD-R2-20`, `OD-R3-01`–`OD-R3-09`, and
`OD-R3-C2-01`–`OD-R3-C2-04` remain open. The R3-C2 file correctly retains
responsibility and block scope for:

- source archive provider/ACL/retention/encryption/Legal Hold;
- raw versus canonical evidence basis;
- professional review retention/resubmission and policy continuity;
- snapshot retention/export and canonical format;
- legacy scenario/JSON migration;
- RuleSet creator/approver authority;
- idempotency failed-record retention;
- evidence loss/recovery;
- typed field/unit catalogue and transition-function ownership.

No Open Decision is being treated as an exemption from the C2 ownership,
event, type or encoding mechanics.

## 9. Test Plan Assessment

The test plan improves materially:

- exact parent-key and NULL tests;
- typed-value/status tests;
- direct no-event RuleSet approval tests;
- ProfessionalReview state/event tampering tests;
- Snapshot source and completeness tests;
- 23 valid basis vectors plus 3 rejection vectors;
- idempotency and commit-unknown cases.

It still fails the strongest claim because the valid-vector set is not
reproducible and does not include a full multi-record/multi-field snapshot.
The independent test result must be added as a correction before a future
review.

## 10. P1-3 Isolation

R3-C2 does not modify Upload Intent, Upload Attempt, Lifecycle, FileVersion,
Operation Attempts, P1-3 migration or triggers. `CatalogEvidenceArchive` is a
separate evidence capability. No P1-3 storage or runtime was accessed.

## 11. Final Assessment

```text
P0: 0
P1: 3
P2: 4
P3: 1
Overall: FAIL — DESIGN CORRECTIONS REQUIRED
```

R3-C2 is directionally sound but cannot enter future staged implementation
authorization. The next correction must regenerate the basis vectors, bind
professional source events to the exact Requirement/version chain, resolve
the UUID/CUID source-key type, and add multi-record codec coverage. No
implementation is authorized.
