# Snapshot Normalized Child Schema R1

## 1. Authority

The canonical child rows below are the sole Snapshot fact authority. No
canonical JSON payload is writable. A read-only JCS document is reconstructed
from these rows with `SNAPSHOT-R1` and `R3-BASIS-1-R4`.

## 2. Header and Metadata

```text
SalesHandoffSnapshot
  id TEXT PRIMARY KEY
  caseId TEXT NOT NULL
  projectId TEXT NOT NULL
  conversationId TEXT NOT NULL
  requirementId TEXT NOT NULL
  requirementVersionId TEXT NOT NULL
  installationScenario TEXT NOT NULL
  selectionRunId TEXT NOT NULL
  ruleSetRevisionId TEXT NOT NULL
  versionNumber INTEGER NOT NULL
  registryRevision TEXT NOT NULL
  protocolRevision TEXT NOT NULL
  basisDigest TEXT NOT NULL
  createdByUserId TEXT NOT NULL
  createdAt TIMESTAMPTZ(6) NOT NULL
  state DRAFT | FINALIZED
  UNIQUE(id, caseId, projectId)
  UNIQUE(caseId, versionNumber)
  UNIQUE(id, projectId, conversationId, requirementId,
         requirementVersionId, installationScenario)

SnapshotBasisMetadata
  snapshotId TEXT PRIMARY KEY
  registryRevision TEXT NOT NULL
  protocolRevision TEXT NOT NULL
  basisDigest TEXT NOT NULL
  basisByteLength INTEGER NOT NULL
  recordCount INTEGER NOT NULL
  generatedAt TIMESTAMPTZ(6) NOT NULL

SnapshotValidationResult
  id TEXT PRIMARY KEY
  snapshotId TEXT NOT NULL
  validationPhase TEXT NOT NULL
  result PASS | FAIL
  reasonCode TEXT NULL
  validatedAt TIMESTAMPTZ(6) NOT NULL
```

## 3. Canonical Child Rows

```text
SalesSnapshotHeaderRecord
  snapshotId TEXT PRIMARY KEY
  caseId TEXT NOT NULL
  projectId TEXT NOT NULL
  requirementVersionId TEXT NOT NULL
  selectionRunId TEXT NOT NULL
  registryRevision TEXT NOT NULL
  protocolRevision TEXT NOT NULL
  stableKey TEXT NOT NULL
  rowId TEXT NOT NULL

SalesSnapshotRequirementField
  id TEXT PRIMARY KEY
  snapshotId TEXT NOT NULL
  requirementVersionId TEXT NOT NULL
  requirementId TEXT NOT NULL
  projectId TEXT NOT NULL
  conversationId TEXT NOT NULL
  installationScenario TEXT NOT NULL
  fieldKey TEXT NOT NULL
  sourceFieldValueId TEXT NOT NULL
  sourceKind TEXT NOT NULL
  sourceEntityType TEXT NOT NULL
  sourceEntityId TEXT NOT NULL
  sourceAuxId TEXT NULL
  sourceKey TEXT NOT NULL
  valueType TEXT NOT NULL
  typedValueText TEXT NOT NULL
  unit TEXT NULL
  fieldStatus TEXT NOT NULL
  stableKey TEXT NOT NULL
  rowId TEXT NOT NULL
  UNIQUE(snapshotId, stableKey)
  UNIQUE(snapshotId, fieldKey)

SalesSnapshotCandidate
  id TEXT PRIMARY KEY
  snapshotId TEXT NOT NULL
  candidateId TEXT NOT NULL
  selectionRunId TEXT NOT NULL
  productRevisionId TEXT NOT NULL
  specificationRevisionId TEXT NOT NULL
  priceRevisionId TEXT NULL
  technicalStatus TEXT NOT NULL
  commercialStatus TEXT NOT NULL
  trustStatus TEXT NOT NULL
  professionalReviewStatus TEXT NOT NULL
  overallStatus TEXT NOT NULL
  stableKey TEXT NOT NULL
  rowId TEXT NOT NULL
  UNIQUE(snapshotId, candidateId)
  UNIQUE(snapshotId, stableKey)

SalesSnapshotParameter
  id TEXT PRIMARY KEY
  snapshotId TEXT NOT NULL
  candidateRowId TEXT NOT NULL
  catalogParameterRevisionId TEXT NOT NULL
  parameterKey TEXT NOT NULL
  valueType TEXT NOT NULL
  valueText TEXT NOT NULL
  unit TEXT NULL
  sourceRevisionId TEXT NOT NULL
  stableKey TEXT NOT NULL
  rowId TEXT NOT NULL
  UNIQUE(snapshotId, stableKey)
  FK(candidateRowId) -> SalesSnapshotCandidate(id)

SalesSnapshotPrice
  id TEXT PRIMARY KEY
  snapshotId TEXT NOT NULL
  candidateRowId TEXT NOT NULL
  priceRevisionId TEXT NOT NULL
  amountMinor BIGINT NOT NULL
  currency TEXT NOT NULL
  taxBasis TEXT NOT NULL
  applicability TEXT NOT NULL
  stableKey TEXT NOT NULL
  rowId TEXT NOT NULL
  UNIQUE(snapshotId, stableKey)
  FK(candidateRowId) -> SalesSnapshotCandidate(id)

SalesSnapshotSource
  id TEXT PRIMARY KEY
  snapshotId TEXT NOT NULL
  candidateRowId TEXT NOT NULL
  sourceRevisionId TEXT NOT NULL
  evidenceObjectId TEXT NOT NULL
  rawContentDigest TEXT NOT NULL
  stableKey TEXT NOT NULL
  rowId TEXT NOT NULL
  UNIQUE(snapshotId, stableKey)
  FK(candidateRowId) -> SalesSnapshotCandidate(id)

SalesSnapshotCatalogReview
  id TEXT PRIMARY KEY
  snapshotId TEXT NOT NULL
  catalogReviewId TEXT NOT NULL
  decision TEXT NOT NULL
  reviewedAt TIMESTAMPTZ(6) NOT NULL
  stableKey TEXT NOT NULL
  rowId TEXT NOT NULL
  UNIQUE(snapshotId, stableKey)

SalesSnapshotProfessionalReview
  id TEXT PRIMARY KEY
  snapshotId TEXT NOT NULL
  professionalReviewId TEXT NOT NULL
  professionalReviewEventId TEXT NOT NULL
  policyRevisionId TEXT NOT NULL
  decision TEXT NOT NULL
  basisDigest TEXT NOT NULL
  stableKey TEXT NOT NULL
  rowId TEXT NOT NULL
  UNIQUE(snapshotId, stableKey)

SalesSnapshotWarning
  id TEXT PRIMARY KEY
  snapshotId TEXT NOT NULL
  candidateRowId TEXT NOT NULL
  warningCode TEXT NOT NULL
  warningText TEXT NOT NULL
  stableKey TEXT NOT NULL
  rowId TEXT NOT NULL
  UNIQUE(snapshotId, stableKey)
  FK(candidateRowId) -> SalesSnapshotCandidate(id)

SalesSnapshotMissingField
  id TEXT PRIMARY KEY
  snapshotId TEXT NOT NULL
  candidateRowId TEXT NOT NULL
  fieldKey TEXT NOT NULL
  reasonCode TEXT NOT NULL
  stableKey TEXT NOT NULL
  rowId TEXT NOT NULL
  UNIQUE(snapshotId, stableKey)
  FK(candidateRowId) -> SalesSnapshotCandidate(id)
```

All child tables use `(snapshotId, stableKey)` uniqueness and immutable rows.
Snapshot creation is a single controlled transaction. Updates and deletes are
denied by roles/triggers.

## 4. Deferred Validation

The detailed contract is in
`SNAPSHOT_DEFERRED_VALIDATION_CONTRACT_R1.md`. At COMMIT, the validation checks:

- Header Registry/Protocol revision;
- complete expected record set;
- all child rows belong to the same Snapshot/Case/Project/run;
- every candidate appears once;
- required fields, parameters, prices, sources and reviews;
- sourceFieldValue/sourceKey identity;
- exact revision FKs;
- immutable Basis digest and row byte lengths;
- no duplicate stableKey/rowId or unconsumed record bytes.

If any check fails, the Snapshot remains `DRAFT`/transaction rolls back and no
case pointer advances.
