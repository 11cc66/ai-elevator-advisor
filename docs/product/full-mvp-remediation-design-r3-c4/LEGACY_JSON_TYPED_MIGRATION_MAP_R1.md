# Legacy JSON → Typed FieldValue Migration Map R1

Status:

```text
MIGRATION DESIGN
NO DATA IMPORT AUTHORIZED
```

## 1. Legacy Shape

The current `BuildingRequirement.fields` is a JSON object containing:

```text
installationScenario
buildingUse
buildingType
floorCount
floorHeight
buildingHeight
budgetMin
budgetMax
externalInstallationAllowed
buildingDescription
siteConditions
drawingStatus
existingElevatorDescription
renovationGoal
fieldSources
missingFields
professionalReviewRequired
```

`fieldSources` and `missingFields` are metadata/projections; they are not
independent authoritative values.

## 2. Mapping Matrix

| Legacy path | Historical type | Target | Conversion | Null/unknown | Loss class |
|---|---|---|---|---|---|
| `$.installationScenario` | string enum | `installationScenario` | exact enum | missing -> quarantine | lossless |
| `$.buildingUse` | string | `buildingUse` | trim, UTF-8 NFC | empty -> null/review | lossless |
| `$.buildingType` | string | `buildingType` | trim, UTF-8 NFC | empty -> null/review | lossless |
| `$.floorCount` | number/string | `floorCount` | integer parse only | blank/range fail <- quarantine | lossless if exact |
| `$.floorHeight` | number/string | `floorHeight` | decimal parse + unit m | unknown/negative -> quarantine | lossless if exact |
| `$.buildingHeight` | number/string | `buildingHeight` | decimal parse + unit m | unknown/range -> quarantine | lossless if exact |
| `$.budgetMin` | number/string | `budgetMin` | integer CNY parse | absent -> null | lossless if exact |
| `$.budgetMax` | number/string | `budgetMax` | integer CNY parse | absent -> null | lossless if exact |
| `$.externalInstallationAllowed` | boolean/string | `externalInstallationAllowed` | true/false only | ambiguous string -> quarantine | lossy if coercion guessed |
| `$.buildingDescription` | string | `buildingDescription` | NFC/text cap | overlong -> quarantine | lossless if within cap |
| `$.siteConditions` | string | `siteConditions` | NFC/text cap | overlong -> quarantine | lossless if within cap |
| `$.drawingStatus` | string enum | `drawingStatus` | exact enum | unknown -> quarantine | lossless if enum |
| `$.existingElevatorDescription` | string | `existingElevatorDescription` | NFC/text cap | overlong -> quarantine | lossless if within cap |
| `$.renovationGoal` | string | `renovationGoal` | NFC/text cap | overlong -> quarantine | lossless if within cap |
| `$.missingFields` | array | missing-field quarantine/projection | validate known field keys | unknown key -> quarantine | lossless only as metadata |
| `$.fieldSources` | object | no trusted authority | legacy source only | unknown source -> quarantine | not authoritative |
| `$.professionalReviewRequired` | boolean | derived policy flag | must match policy | conflicting -> quarantine | not authoritative |

## 3. Conflict Rules

The migration does not choose one value when:

- duplicate/renamed fields conflict;
- JSON says a value is confirmed but no source evidence exists;
- scenario differs from parent Project/Conversation;
- numeric strings are ambiguous (`"1,000"` / locale forms);
- boolean strings are not exactly `true`/`false`;
- unknown units/enums/field names appear;
- a source is absent or inaccessible;
- raw JSON and typed value disagree after conversion.

Such rows produce `RequirementLegacyQuarantine` with an evidence snapshot
reference, never a guessed typed value.

## 4. Quarantine Reasons

```text
LEGACY_FIELD_UNKNOWN
LEGACY_FIELD_TYPE_AMBIGUOUS
LEGACY_FIELD_VALUE_INVALID
LEGACY_SOURCE_UNKNOWN
LEGACY_SOURCE_UNAVAILABLE
LEGACY_SCENARIO_MISMATCH
LEGACY_CONFLICT
LEGACY_OVERLONG_TEXT
LEGACY_RESOLUTION_REQUIRED
```

## 5. Atomic Rules

- The raw legacy JSON remains read-only evidence.
- Typed FieldValues are inserted and the migration result is recorded in one
  controlled transaction per requirement.
- A failure leaves no partially mapped requirement.
- No default values are invented.
- A row cannot be both MAPPED and QUARANTINED.
- A quarantine resolution requires explicit evidence and a separately
  approved workflow.
