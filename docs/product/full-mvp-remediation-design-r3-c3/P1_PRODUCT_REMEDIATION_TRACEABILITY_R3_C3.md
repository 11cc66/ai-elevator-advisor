# P1 Product Remediation Traceability R3-C3

Status:

```text
R3-C3 DESIGN COMPLETE WITH OPEN BLOCKERS
```

## 1. C3 Corrections

| C2 Finding | C3 design | Database/byte invariant | Negative tests | Acceptance | Status |
|---|---|---|---|---|---|
| `REV-R3-C2-P1-01` R3-BASIS-1 vectors | Revision 3 text/CUID rowId; sorted records/fields; no implicit zero field; regenerated V01–V23 | exact framing and SHA bytes; V22/V23 same canonical basis | `C3-SNP-09`, `C3-BASIS-24..26`, V01–V23 | two independent encoders byte-identical | `DESIGN_ADDRESSED_PENDING_REVIEW` |
| `REV-R3-C2-P1-02` ProfessionalReview source event | six-column event owner key and composite FieldValue FK | same project/conversation/requirement/version/scenario | `C3-PRO-01..04`, `C3-SNP-03` | cross-requirement/version event rejected | `DESIGN_ADDRESSED_PENDING_REVIEW` |
| `REV-R3-C2-P1-03` UUID/CUID source identity | canonical CUID/Text IDs and namespaced text sourceKey | no UUID cast; exact text FKs; rowId text in R3-BASIS-1 | `C3-ID-01..06` | existing CUIDs preserved; sourceKey format exact | `DESIGN_ADDRESSED_PENDING_REVIEW` |

## 2. R3-C2 P2 Findings

| C2 P2 Finding | C3 correction | Tests | Status |
|---|---|---|---|
| `REV-R3-C2-P2-01` typed SQL types/ranges/units | Explicit BOOLEAN/BIGINT/NUMERIC(18,6)/TEXT/ENUM/CANONICAL_ID/TIMESTAMPTZ/BYTEA catalogue; unknown units/thresholds remain business decisions | `C3-SRC-03/04/05/09` | `DESIGN_ADDRESSED_PENDING_REVIEW` |
| `REV-R3-C2-P2-02` multi-record/multi-field vectors | V21 multi-field, V22/V23 multi-record order-invariance; exact bytes/hash | `C3-BASIS-24..26`, V21–V23 | `DESIGN_ADDRESSED_PENDING_REVIEW` |
| `REV-R3-C2-P2-03` historical unsupported sources | explicit quarantine table/reasons and no silent SYSTEM_DERIVED mapping | `C3-ID-03`, `C3-SRC-11` | `DESIGN_ADDRESSED_PENDING_REVIEW` |
| `REV-R3-C2-P2-04` event function permissions | fixed transition owner/search_path/grant rules and direct-DML denial | `C3-PRO-05/06/07`, `C3-RULE-01/04/05` | `DESIGN_ADDRESSED_PENDING_REVIEW` |

## 3. Earlier P1/P2 Preservation

The C3 design retains the R3/R2-approved directions:

- conditional/uncertainty semantics and explicit confirmation;
- conversation versus project requirement pointers;
- Project Scenario mapping and freeze;
- RuleSet event-only approval;
- ProfessionalReview event-only state;
- Catalog evidence archive direction;
- sales ownership and SQL authorization;
- technical/commercial/trust/professional status separation;
- no approved rules → no Operational;
- DEMO immutability;
- P1-3 isolation.

It replaces only the previously failed C2 basis/identity/source-event details.

## 4. Dependencies

All `OD-R2-01`–`OD-R2-20`, `OD-R3-01`–`OD-R3-09`, and
`OD-R3-C2-01`–`OD-R3-C2-04` remain, with C3 decisions added for:

- typed field/unit catalogue;
- CUID/Text identity acceptance;
- transition-function privilege ownership;
- basis parser/verifier deployment.

## 5. Verification

```text
R3-C3 internal consistency: PENDING FINAL CHECK
R3-BASIS valid vectors: 23
R3-BASIS rejection vectors: 3
Independent encoders: PENDING REPORTED RESULT
Database behavior: NOT VERIFIED
Runtime: NOT VERIFIED
Independent R3-C3 review: PENDING
Implementation: NOT AUTHORIZED
```
