# Typed Field Catalogue R2

Status:

```text
TECHNICAL TYPE CONTRACT
ENGINEERING AUTHORITY AND THRESHOLDS REMAIN OPEN
NOT IMPLEMENTED
```

## 1. Retained R1 Technical Rows

The field keys, scalar families, SQL storage widths, units and basic syntax
from `TYPED_FIELD_CATALOGUE_R1.md` remain the technical baseline.

R2 corrections:

- exact source-kind codes are the five C4/C5 enum values;
- source ID domain is printable ASCII, 1..64 bytes;
- `sourceAuxId` is bounded UTF-8 NFC, 1..128 bytes when present;
- `sourceKey` is binary `SOURCE_KEY_R3`, not display text;
- normalizing `trim`/NFC is explicitly semantic normalization, not byte-level
  preservation; the raw evidence must remain retained;
- field/unit/range authority remains `OD-R3-C3-02` / `OD-R3-C4-02`.

## 2. Source Kind Enum

```text
USER_ASSERTION
PROFESSIONAL_REVIEW
CATALOG_EVIDENCE
SYSTEM_DERIVED
OTHER_AUTHORIZED_SOURCE
```

Unknown source kinds reject.

## 3. Field-to-Source Constraints

| Field family | Allowed source kinds |
|---|---|
| user/professional advisory fields | `USER_ASSERTION`, `PROFESSIONAL_REVIEW` |
| installationScenario | `SYSTEM_DERIVED`, `OTHER_AUTHORIZED_SOURCE` |
| product-only parameters | `CATALOG_EVIDENCE`, `PROFESSIONAL_REVIEW` |
| budget fields | `USER_ASSERTION` unless a separately approved rule adds professional/legal sourcing |
| system-derived values | `SYSTEM_DERIVED` plus exact rule revision/assertion |

These are technical source-class rules. They do not approve whether a value is
mandatory or authoritative.

## 4. Cross-Field Syntax Rules

These are safe type-level invariants and do not invent engineering policy:

| Rule | Behavior |
|---|---|
| both budgets present | `budgetMin <= budgetMax`; otherwise conflict/quarantine |
| `valueType='NULL'` or explicit null | all typed columns null and `null_value=true` |
| non-null field | exactly one typed column non-null and `null_value=false` |
| text | NFC, valid Unicode scalar sequence, catalogue code-point limit |
| decimal | finite NUMERIC(18,6); no NaN/Infinity/exponent |
| canonical ID | printable ASCII, 1..64 bytes, no case folding |
| unit | required for dimensional values; empty/none synonyms rejected |
| enum | exact approved code; no locale/display-label mapping |

Scenario-specific thresholds, mandatory-field policy and professional
authority remain unresolved Open Decisions.

## 5. Units

Allowed unit codes remain:

```text
floor m mm kg m/s person CNY unitless
```

Conversion between units is explicit and versioned. Display labels are not
accepted as stored units.

## 6. Validation

Reject or quarantine:

- unknown field key or enum;
- value type/column mismatch;
- two typed values in one FieldValue;
- explicit null plus a typed value;
- zero substituted for unknown;
- empty required unit;
- overlong/non-NFC text;
- conflicting `budgetMin > budgetMax`;
- source kind not allowed for the field;
- source identity not matching the exact typed source FK.

