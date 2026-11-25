# Immutable Selection Result Provenance R3-C6

## 1. Entities

```text
SelectionRun
  id
  project/conversation/requirement/version/scenario
  ruleSetRevisionId
  ruleSetContentDigest
  status RUNNING | SEALED
  sealedAt

SelectionCandidateResult
  id
  selectionRunId
  candidateId
  project/conversation/requirement/version/scenario
  productId/productRevisionId/productRevisionDigest
  specificationRevisionId/specificationRevisionDigest
  priceHasValue/priceRevisionId
  ruleSetRevisionId
  technical/commercial/trust/professional/overall statuses
```

## 2. Immutability

- A SelectionResult row is writable only while its run is `RUNNING`.
- `SEALED` requires a nonempty result set and all exact revision dependencies.
- After `SEALED`, ordinary roles cannot INSERT/UPDATE/DELETE candidate results.
- Snapshot creation accepts only a sealed run.
- Historical SelectionResults are never replaced to reflect later catalog data.

## 3. Exact Candidate Key

```text
UNIQUE(
  id, selectionRunId, candidateId,
  projectId, conversationId, requirementId, requirementVersionId,
  installationScenario, ruleSetRevisionId,
  productId, productRevisionId, productRevisionDigest,
  specificationRevisionId, specificationRevisionDigest,
  priceHasValue, priceRevisionKey
)
```

`SnapshotCandidate` uses an exact FK to this complete key. It cannot mix a
candidate ID with another product, specification, price, run or rule set.

## 4. Product/Specification/Price Parents

- Product revision FK includes `productId` and immutable revision digest.
- Specification revision FK includes its exact catalog target.
- Price revision FK includes product revision and price revision key.
- RuleSet revision FK includes RuleSet ID and content digest.

No revision ID is trusted as a standalone text field.

## 5. Sealing Transaction

```text
lock SelectionRun
verify RUNNING
lock all candidate results
verify exact revision parents
set run SEALED + seal digest
commit
```

Snapshot creation locks the sealed run `FOR SHARE`.

## 6. Counterexamples

| Counterexample | Rejection |
|---|---|
| Result Product A, Snapshot Product B | full candidate key FK |
| Result Run R1, Snapshot Run R2 | full run/context FK |
| Result spec S1, Snapshot spec S2 | full specification FK |
| Result price P1, Snapshot P2 | price link FK |
| Result ruleset Q1, Snapshot Q2 | rule-set FK |
| Finalized data replaced | sealed append-only guard |

