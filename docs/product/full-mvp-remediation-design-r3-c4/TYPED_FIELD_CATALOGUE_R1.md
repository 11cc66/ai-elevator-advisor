# Typed Field Catalogue R1

Status:

```text
TECHNICAL TYPE CONTRACT
ENGINEERING AUTHORITY AND THRESHOLDS REMAIN OPEN
```

The catalogue defines storage shape and basic syntax. It does not approve
engineering limits, mandatory field policy or professional authority.

## Common Rules

- `fieldKey` is immutable registry text.
- Each value is exactly one scalar type; no JSON value is authoritative.
- `unit` is explicit for dimensional values.
- Unknown field keys, units and enum values are rejected.
- `NULL` means unknown/missing, never numeric zero or empty text.
- Text uses UTF-8 NFC and maximum 4,000 code points.
- Decimal uses `NUMERIC(18,6)` and canonical decimal text.
- IDs use canonical CUID/Text and are not coerced to UUID.

## R1 Field Rows

| fieldKey | semantic kind | value type | SQL type | unit/range | nullable | source kinds |
|---|---|---|---|---|---|---|
| `buildingUse` | `TEXT` | text | `TEXT` | ≤80 code points; approved enum-like vocabulary or free text | yes | user/professional |
| `buildingType` | `TEXT` | text | `TEXT` | ≤80 code points | yes | user/professional |
| `installationScenario` | `ENUM` | enum | `VARCHAR(64)` | `OLD_BUILDING_ADDITION`, `EXISTING_ELEVATOR_RENOVATION`, `NEW_BUILDING_INSTALLATION` | no | system/service-derived |
| `floorCount` | `INTEGER` | integer | `BIGINT` | 1..200; unit `floor` | yes | user/professional |
| `floorHeight` | `DECIMAL` | decimal | `NUMERIC(18,6)` | >0..20; unit `m` | yes | user/professional |
| `buildingHeight` | `DECIMAL` | decimal | `NUMERIC(18,6)` | >0..1000; unit `m` | yes | user/professional |
| `budgetMin` | `INTEGER` | integer | `BIGINT` | 0..1,000,000,000; unit `CNY` | yes | user |
| `budgetMax` | `INTEGER` | integer | `BIGINT` | 0..1,000,000,000; unit `CNY` | yes | user |
| `externalInstallationAllowed` | `BOOLEAN` | boolean | `BOOLEAN` | unitless | yes | user/professional |
| `buildingDescription` | `TEXT` | text | `TEXT` | ≤4,000 code points | yes | user/professional |
| `siteConditions` | `TEXT` | text | `TEXT` | ≤4,000 code points | yes | user/professional |
| `drawingStatus` | `ENUM` | enum | `VARCHAR(64)` | `NONE`, `AVAILABLE_NOT_ANALYZED`, `ANALYSIS_UNAVAILABLE` | yes | user/system |
| `existingElevatorDescription` | `TEXT` | text | `TEXT` | ≤4,000 code points | yes | user/professional |
| `renovationGoal` | `TEXT` | text | `TEXT` | ≤2,000 code points | yes | user/professional |
| `capacityKg` | `INTEGER` | integer | `BIGINT` | >0..100,000; unit `kg` | product-only | catalog/professional |
| `speedMps` | `DECIMAL` | decimal | `NUMERIC(18,6)` | >0..20; unit `m/s` | product-only | catalog/professional |
| `ratedPersons` | `INTEGER` | integer | `BIGINT` | >0..10,000; unit `person` | product-only | catalog/professional |
| `doorWidthMm` | `INTEGER` | integer | `BIGINT` | >0..20,000; unit `mm` | product-only | catalog/professional |
| `doorHeightMm` | `INTEGER` | integer | `BIGINT` | >0..20,000; unit `mm` | product-only | catalog/professional |
| `shaftWidthMm` | `INTEGER` | integer | `BIGINT` | >0..20,000; unit `mm` | product/requirement | catalog/professional |
| `shaftDepthMm` | `INTEGER` | integer | `BIGINT` | >0..20,000; unit `mm` | product/requirement | catalog/professional |
| `pitDepthMm` | `INTEGER` | integer | `BIGINT` | >0..20,000; unit `mm` | product/requirement | catalog/professional |
| `overheadMm` | `INTEGER` | integer | `BIGINT` | >0..20,000; unit `mm` | product/requirement | catalog/professional |

## Unit Registry

Allowed units are `floor`, `m`, `mm`, `kg`, `m/s`, `person`, `CNY` and
unitless. Unit conversion is explicit and versioned; no automatic unit
inference is permitted. Engineering thresholds remain `OD-R3-C3-02` until the
technical authority approves the scenario/usage-specific rules.

## Validation

```text
valueType/typed column mismatch -> reject
unknown fieldKey -> reject
unknown unit -> reject
range overflow -> reject
empty unit when required -> reject
null/zero substitution -> reject
```
