# FULL-MVP-REMEDIATION-REVIEW-R3-C3 Independent Design Review

Date: 2026-11-24

Project root: `D:\thinkbook\Desktop\jieya`

Review mode: independent, read-only, adversarial design review.

Overall result:

```text
FAIL — DESIGN CORRECTIONS REQUIRED
```

R3-C3 successfully repairs the C2 R3-BASIS vector mismatch and the CUID/Text
identity direction. It still has two P1 design defects:

1. the ProfessionalReviewEvent six-column source FK does not have an exactly
   matching parent UNIQUE;
2. the generic Basis protocol lacks a complete actual Snapshot record/field
   registry and stableKey mapping.

## 1. Input Integrity

R3-C3 inputs were read and rehashed:

| File | Bytes | Lines | SHA-256 | Result |
|---|---:|---:|---|---|
| `P1_PRODUCT_REMEDIATION_DESIGN_R3_C3.md` | 18021 | 510 | `006A6A1A1039EF109E88ADC5955FAB9CE36B2906EB4C95237E0F112B11D48B13` | MATCH |
| `P1_PRODUCT_REMEDIATION_TRACEABILITY_R3_C3.md` | 3246 | 65 | `DD73C92FEC906454195EB318BE8C4DAEE9F790E4B4BF49C3BD654A62CC8B2666` | MATCH |
| `P1_PRODUCT_REMEDIATION_TEST_PLAN_R3_C3.md` | 9756 | 163 | `8DC626DB5D5F475902BAF9A89CF92C570DC011F6C895CFAF0416408AE9343670` | MATCH |
| `P1_PRODUCT_REMEDIATION_OPEN_DECISIONS_R3_C3.md` | 2970 | 80 | `D6E3616513B76ED9EC4ADE6F78783348791CE04CED2354A037C11071AA002E96` | MATCH |
| `P1_PRODUCT_REMEDIATION_R3_C3_CHANGELOG.md` | 2678 | 76 | `2D4CA645CB7A4586A8DCFF436FB4DA2557BAE19E688FB4D2F0DF79326A7FD643` | MATCH |
| `R3_BASIS_V3_PROTOCOL_AND_VECTOR_SPEC.md` | 5670 | 149 | `E25B11509AE5C88B437BEB28871068187F82280E0EBE7B0D7676F7C1D5812455` | MATCH |
| `R3_BASIS_V3_FIXED_VECTORS.md` | 11102 | 51 | `CF018F4AC79B1F03A768A0E9079CBD74646315D6D8618C4E78F4A6968EFF4D23` | MATCH |
| `R3_BASIS_V3_INDEPENDENT_REPRODUCTION.md` | 4002 | 88 | `FC7097EC515E632BADDA041C0B7B45A7A7085B0BAE5FDDCA1CFD7D9187546DBD` | MATCH |
| `R3_C3_IDENTITY_AND_MIGRATION_DESIGN.md` | 5075 | 143 | `32ADA35A187DF747201217608F900A932084B4B992F1CB33C898CC2F2BD9186C` | MATCH |
| `R3_C3_PROFESSIONAL_REVIEW_SOURCE_BINDING.md` | 5663 | 183 | `460165EA5A05ED3F544608FF8AD95F666A9EDDB899C7466DE4A62BFEF31A8FC2` | MATCH |

`SHA256SUMS_R3_C3.txt`:

```text
9BE6164A4D0088C03B2A951D2F293A3EACC299DE31C9FD2138B387B8932A2A7D
```

All manifest entries matched. R3-C2 and R3-C2 review inputs also matched their
historical manifests.

## 2. Shell and Worktree

Verified actual shell:

```text
ExecutablePath:
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe

FileVersion: 7.6.9.500
PSEdition: Core
Internal PSVersion: 7.6.9
Parent executable: Codex app resources\codex.exe
```

Worktree baseline/end:

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 41
Untracked entries: 71
Staged: 0
Deleted: 0
```

Only this review directory was added inside the existing `?? docs/product/`
aggregate entry. No source, Schema, Migration, tests or existing design file
was changed.

## 3. Scope and Limitations

Read:

- all ten R3-C3 deliverable files and manifest;
- R3-C3 protocol/vector/reproduction files;
- R3-C3 identity migration and ProfessionalReview binding appendix;
- R3-C3 traceability, test plan and Open Decisions;
- R3/R3-C2/R2/R1 design and review history;
- current Prisma schema and related advisor/selection/MVP source.

Not performed:

- source, Schema, Migration or test changes;
- database connection, SQL, migration, seed or reset;
- Build, Worker, E2E, Native RPC, Storage or Runtime execution;
- Git writes;
- ACL, Registry, Service, PFR or `$null` operations.

The Node/Python protocol check was in-memory only.

## 4. C3 P1 Conclusions

| R3-C3 P1 | Result | Reason |
|---|---|---|
| `P1-01` R3-BASIS-1 | `APPROVED WITH DEPENDENCY` | Generic revision 3 vectors reproduce, but actual Snapshot registry and entity stableKey mapping remain missing (`REV-R3-C3-P1-02`). |
| `P1-02` ProfessionalReview source binding | `CORRECTION REQUIRED` | `ProfessionalReviewEvent` has a seven-column UNIQUE while the FieldValue source FK references six columns; no exact parent key exists (`REV-R3-C3-P1-01`). |
| `P1-03` CUID/Text identity | `APPROVED WITH DEPENDENCY` | CUID/Text is coherent with current IDs; canonical sourceKey and migration/quarantine direction are sound. Identity approval remains an Open Decision. |

## 5. R3-BASIS-1 Independent Result

The fixed vector set is materially corrected:

```text
23 valid vectors
3 rejection vectors
Node.js implementation A vs Python implementation B
all valid vectors byte-identical
all rejection vectors rejected
```

Exact expected/actual SHA results are in
`R3_BASIS_V3_INDEPENDENT_VECTOR_VERIFICATION.md`.

However, this proves the synthetic framing vectors, not the actual Snapshot
record/field registry. The protocol says tags come from an approved registry
but does not provide that registry or stableKey mapping for real Snapshot
entities. This remains a P1 protocol-completeness issue.

## 6. ProfessionalReview Composite Verification

The intended ownership chain is correct:

```text
Project
  -> Conversation
  -> Requirement
  -> RequirementVersion
  -> ProfessionalReview
  -> ProfessionalReviewEvent
  -> FieldValue
  -> SnapshotField
```

But the proposed FK is not executable:

```text
Event UNIQUE:
  (id, reviewId, projectId, conversationId, requirementId,
   requirementVersionId, installationScenario)

FieldValue source FK:
  (sourceProfessionalReviewEventId, projectId, conversationId,
   requirementId, requirementVersionId, installationScenario)
```

The parent key has an extra `reviewId`. PostgreSQL must return a missing
unique-key error when the migration tries to create the FK. This is not a
documentation nicety; it is a direct failure of the P1-02 remedy.

## 7. Identity and Event-only Findings

CUID/Text identity is the correct practical direction:

- current Prisma primary/foreign keys are CUID/Text;
- no UUID conversion is necessary;
- sourceKey namespacing is explicit;
- rowId in the Basis is text and matches the selected identity;
- migration/quarantine/rollback limits are documented.

RuleSet and ProfessionalReview event-only state design is preserved. Exact
transition owner, fixed `search_path`, grants and policy-authoring authority
remain Open Decisions and are not a substitute for the non-matching FK above.

## 8. P2 Assessment

| P2 | Result |
|---|---|
| `REV-R3-C3-P2-01` complete Snapshot child schema | `CORRECTION REQUIRED`: main file describes sourceKey but does not contain complete normalized child tables/FK/deferred contracts |
| `REV-R3-C3-P2-02` typed SQL catalogue | `APPROVED WITH DEPENDENCY`: types are defined; units/ranges/catalogue remain `OD-R3-C3-02` |
| `REV-R3-C3-P2-03` legacy mapping | `APPROVED WITH DEPENDENCY`: quarantine and phases exist; deterministic field mapping remains open |
| `REV-R3-C3-P2-04` transition permissions | `APPROVED WITH DEPENDENCY`: mechanism is named; exact Owner/grants are `OD-R3-C3-03` |
| `REV-R3-C3-P2-05` sourceKey parsing | `CORRECTION REQUIRED`: colon-delimited sourceKey is ambiguous if IDs may contain `:` |

## 9. Open Decisions

R2 `OD-R2-01`–`OD-R2-20`, R3 `OD-R3-01`–`OD-R3-09`, C2
`OD-R3-C2-01`–`OD-R3-C2-04`, and C3 `OD-R3-C3-01`–`OD-R3-C3-04` remain
accounted for. They block Schema, Migration, data import, Demo, production and
security approval in the scoped areas. None removes the P1 FK or registry
requirements.

## 10. Final Assessment

```text
P0: 0
P1: 2
P2: 5
P3: 1
Overall: FAIL — DESIGN CORRECTIONS REQUIRED
```

The next step is solely to repair:

1. the exact ProfessionalReviewEvent parent key used by FieldValue/Assertion;
2. the actual Snapshot record/field registry and stableKey construction;
3. the incomplete C3 Snapshot child schema and registry-driven vector coverage.

No implementation or Runtime authorization is granted.
