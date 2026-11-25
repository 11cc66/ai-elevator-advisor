# P1 Product Remediation Traceability R3-C5

Status:

```text
R3-C4 FINDINGS: 11/11 ADDRESSED
OPEN DECISIONS: 41 HISTORICAL + 5 C5
IMPLEMENTATION: NOT AUTHORIZED
```

## 1. Finding-to-Correction Matrix

| R3-C4 Finding | Severity | Root cause | R3-C5 correction | Evidence |
|---|---|---|---|---|
| `REV-R3-C4-P1-01` | P1 | R1 stableKey used `:` text concatenation | New `SK-R2` binary tuple with record/registry domains and 158-byte bound | `SNAPSHOT_STABLE_KEY_TUPLE_ENCODING_R2.md`; C5 fixture |
| `REV-R3-C4-P1-02` | P1 | Embedded C4 Basis mis-tagged Requirement records and failed hash | New semantic Fixture and two independent encoders; R4 retired for C5 | `C5_SNAPSHOT_VECTOR_01.json`; HEX; reproduction report |
| `REV-R3-C4-P1-03` | P1 | Registry fields absent from rows / Basis | Registry R2 includes full source binding; schema R2 adds missing fields; crosswalk maps every tag | `SNAPSHOT_REGISTRY_R2.md`; `SNAPSHOT_NORMALIZED_CHILD_SCHEMA_R2.md`; crosswalk |
| `REV-R3-C4-P1-04` | P1 | Actor/state/policy provided by caller | `session_user`-bound principal, scoped authority, command matrix, immutable policy | `TRUSTED_PRINCIPAL_AUTHORITY_TRANSITION_DESIGN_R2.md` |
| `REV-R3-C4-P2-01` | P2 | Event policy only `IS NOT NULL` | Policy-inclusive Review UNIQUE + Event FK + policy FK | Main §10; trusted design §8 |
| `REV-R3-C4-P2-02` | P2 | Deferred validation lacked executable coverage | DDL constraint triggers, guards, TRUNCATE handling, verifier checklist, TX matrix | `SNAPSHOT_DEFERRED_VALIDATION_CONTRACT_R2.md` |
| `REV-R3-C4-P2-03` | P2 | Parent/source FKs were prose | Full composite FKs and same-Snapshot child keys | `SNAPSHOT_NORMALIZED_CHILD_SCHEMA_R2.md` |
| `REV-R3-C4-P2-04` | P2 | PG privilege bypass surfaces omitted | Full owner/role/default/sequence/function/trigger/TRUNCATE baseline | `EVENT_ONLY_POSTGRESQL_OWNER_ROLE_PRIVILEGE_BASELINE_R2.md` |
| `REV-R3-C4-P2-05` | P2 | Registry vs protocol field ordering conflict | Semantic input is sorted; encoded wire order is strict | Registry R2 §1; Basis R5 §4 |
| `REV-R3-C4-P2-06` | P2 | ASCII source domain contradicted Unicode tests | ASCII stable/source IDs separated from UTF-8-NFC auxiliary text | `SOURCE_KEY_R3` in Basis R5 §6; stable-key domain table |
| `REV-R3-C4-P3-01` | P3 | “nine record types” wording | C5 consistently says ten types including Header, nine child types | Registry R2; Test Plan §2 |

## 2. Original R3-C3 P1 Status

| Finding | Status | Reason |
|---|---|---|
| `REV-R3-C3-P1-01` ProfessionalReview exact parent | `PRESERVED RESOLVED` | Six-column Event UNIQUE and FK unchanged |
| `REV-R3-C3-P1-02` Registry/stableKey | `R3-C5 CORRECTED` | Real Registry R2, SK-R2 collision-safe encoding, full snapshot vector |

## 3. P1 Acceptance Details

### P1-01

The former `PRICE:a:b:c` collision now yields different complete bytea values.
The encoded vector for both tuples is fixed in the stable-key protocol.
Database uniqueness uses structured component columns, with bytea stableKey as
an independently recomputed guard.

### P1-02

The C5 semantic fixture contains 15 records, 10 record-type definitions and 1
source key derivation per Requirement Field. Node and Python independently
produce 3051 bytes and SHA-256
`83F00E53B7AC21779B2753F0640B3023E2DE6A53AFA405BC0E4C8A2FDC056FB1`.
Full bytes are mechanically generated from the fixture.

### P1-03

Every SNAPSHOT-R2 field tag has one normalized storage or derivation entry.
Absent C4 fields are now explicit:

```text
SalesSnapshotSource.sourceKind
SalesSnapshotCatalogReview.targetRevisionId
SalesSnapshotCatalogReview.policyRevisionId
SalesSnapshotWarning.warningSequence
RequirementField sourceFieldValueId/sourceEntityType/sourceAuxId/sourceKey
```

### P1-04

No function accepts actor ID or arbitrary target state. Actor comes from
`session_user`; authority comes from an active scoped grant; command matrix
derives state; policy equality has a composite FK and immutable revision FK.

## 4. P2 Disposition

- Policy equality: `CLOSED BY DESIGN`.
- Deferred validation: `CLOSED BY DESIGN`, DB behavior not tested.
- Composite FKs: `CLOSED BY DESIGN`.
- PostgreSQL privileges: `CLOSED BY DESIGN`, deployment identity still Open.
- Field order: `CLOSED BY DESIGN`.
- Source Unicode domain: `CLOSED BY DESIGN`.

## 5. Remaining Uncertainty

- exact trusted identity broker and DB login mechanism;
- exact deployment role names/credentials;
- reviewer/approver policy and dual-review requirement;
- source-key generated-column versus stored-and-check implementation;
- Registry R2/Basis R5 rollout;
- database, archive, Runtime and P1-3 integration behavior.

These are recorded as Open Decisions, not claimed as approved implementation.

