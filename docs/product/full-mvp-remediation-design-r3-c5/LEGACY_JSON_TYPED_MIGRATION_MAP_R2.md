# Legacy JSON to Typed FieldValue Migration Map R2

Status:

```text
MIGRATION DESIGN
NO DATA IMPORT AUTHORIZED
OPEN DECISIONS: OD-R2-12, OD-R2-15, OD-R3-06
```

## 1. Raw Evidence

The original `BuildingRequirement.fields` JSON is retained byte-for-byte as
read-only evidence in the evidence archive or immutable legacy snapshot created
by an approved migration. The normalized values are a new typed projection.

## 2. Loss Classification

`trim` and Unicode NFC normalization are semantic normalizations, not
byte-lossless conversion. Therefore:

- raw JSON remains evidence;
- the normalized value is reproducible from the mapping version plus raw
  evidence;
- if trimming/NFC changes the content and no approved normalization rule
  covers the field, quarantine;
- no issue is labelled “lossless” unless raw bytes and typed value can both be
  reconstructed.

## 3. Mapping Matrix

| Legacy path | Target FieldValue | Transformation | Failure disposition |
|---|---|---|---|
| `$.installationScenario` | `installationScenario` | exact enum | quarantine |
| `$.buildingUse` | `buildingUse` | literal trim + UTF-8 NFC | quarantine if empty/overlong/ambiguous |
| `$.buildingType` | `buildingType` | literal trim + NFC | quarantine as above |
| `$.floorCount` | `floorCount` | exact integer string/number parse | quarantine on locale/exponent/range |
| `$.floorHeight` | `floorHeight` | exact decimal + explicit `m` | quarantine on unit/range ambiguity |
| `$.buildingHeight` | `buildingHeight` | exact decimal + explicit `m` | quarantine on unit/range ambiguity |
| `$.budgetMin` | `budgetMin` | exact integer + explicit `CNY` | absent -> null; ambiguous -> quarantine |
| `$.budgetMax` | `budgetMax` | exact integer + explicit `CNY` | absent -> null; ambiguous -> quarantine |
| `$.externalInstallationAllowed` | `externalInstallationAllowed` | exact JSON boolean only | any string coercion -> quarantine |
| `$.buildingDescription` | `buildingDescription` | UTF-8 NFC + code-point cap | overlong/non-NFC ambiguity -> quarantine |
| `$.siteConditions` | `siteConditions` | UTF-8 NFC + cap | quarantine on ambiguity |
| `$.drawingStatus` | `drawingStatus` | exact enum | quarantine |
| `$.existingElevatorDescription` | `existingElevatorDescription` | UTF-8 NFC + cap | quarantine |
| `$.renovationGoal` | `renovationGoal` | UTF-8 NFC + cap | quarantine |
| `$.missingFields` | migration projection | validate known keys | unknown key -> quarantine |
| `$.fieldSources` | source evidence candidate | no trusted authority by itself | unknown source -> quarantine |
| `$.professionalReviewRequired` | derived policy comparison | must match approved policy | conflict -> quarantine |

## 4. Conflict and Quarantine

Quarantine, never guess, when:

- multiple JSON paths imply the same field with different values;
- a value claims confirmation but lacks a source/evidence object;
- a project/conversation scenario differs;
- numeric spelling is locale-ambiguous or contains grouping separators;
- boolean value is not an exact JSON boolean;
- unit, enum or field key is unknown;
- normalized value conflicts with raw evidence under the mapping rules;
- source event cannot be recovered exactly;
- text normalization would change evidence without an approved rule.

## 5. Quarantine Record

```text
RequirementLegacyQuarantine
  id
  legacyRequirementId
  projectId
  sourceKind = LEGACY_JSON
  evidenceObjectId
  evidenceDigest
  mappingVersion = LEGACY-MAP-R2
  reasonCode
  rawFieldPath
  rawValueType
  status OPEN | RESOLVED
  resolutionEvidenceId
  resolvedAt
```

`rawValue` is referenced through the immutable evidence snapshot; sensitive
payload is not duplicated into logs.

## 6. Atomicity

- one controlled transaction per requirement;
- no partially mapped requirement commits;
- a requirement cannot be both MAPPED and OPEN-quarantined for the same field;
- no default value is invented;
- resolution requires explicit evidence and a separately approved workflow;
- replay uses deterministic mapping version and evidence digest.

## 7. R1-to-R2 Compatibility

R1 mappings may be re-evaluated under R2 when:

- raw JSON evidence is still available;
- R2 only clarifies normalization/loss labels;
- no previously mapped value changes meaning.

If a value would change, preserve the R1 mapping as historical and create an
R2 migration decision/quarantine; do not silently overwrite.

