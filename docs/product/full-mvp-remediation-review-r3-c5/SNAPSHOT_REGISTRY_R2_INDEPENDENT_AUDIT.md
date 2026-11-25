# SNAPSHOT-R2 Independent Audit

Date: 2026-11-24

Result:

```text
SNAPSHOT-R2: FAIL
```

## 1. Record-Type Inventory

| Type | Entity | Fields | Result |
|---:|---|---:|---|
| 0 | Header | 9 | PASS with scope caveat |
| 1 | Requirement Field | 11 | PASS for source binding |
| 2 | Candidate | 9 | FAIL provenance binding |
| 3 | Parameter | 6 | FAIL revision omitted from Basis |
| 4 | Price | 6 | FAIL validity/source semantics incomplete |
| 5 | Source Revision | 4 | PASS |
| 6 | Catalog Review | 5 | PASS |
| 7 | Professional Review | 5 | PASS structurally |
| 8 | Warning | 4 | FAIL ordering key not stored |
| 9 | Missing Field | 3 | PASS for current scope |

All field tags are unique within record type. Unknown tags and missing required
tags are rejected.

## 2. Header

The Header contains snapshot/case/project/requirement/version/run/registry/
protocol/encoding.

It omits:

- `ruleSetRevisionId`;
- `conversationId`;
- `installationScenario`.

`conversationId` and scenario may be derivable from RequirementVersion, but the
Registry does not state and constrain that derivation. `ruleSetRevisionId` is
stored in the normalized envelope and Candidate FK but is not serialized. The
Crosswalk simultaneously says selected rules enter the Basis (line 40), which
is false for the actual tags.

## 3. Requirement Field

The C4 omission is fixed:

```text
sourceFieldValueId
sourceKind
sourceEntityType
sourceEntityId
sourceAuxId
sourceKey
```

The source-key size failure is recorded separately as P1.

## 4. Candidate

The record includes product/specification/price revision IDs and four separated
statuses. Field tags and ordering are deterministic.

DEFECT: the Schema does not bind those revision IDs to the immutable Selection
Candidate. A Snapshot Candidate can carry a different product or specification
revision while satisfying the shown FK.

## 5. Parameter

Stable identity uses `(candidateId,parameterKey)`, which is well-defined.

DEFECT: `catalogParameterRevisionId` exists in the normalized table but has no
Registry/Basis tag and no Crosswalk entry. Its effect on the business fact is
therefore not committed by the Snapshot digest.

## 6. Price

Current tags:

```text
candidateId
priceRevisionId
amountMinor
currency
taxBasis
applicability
```

Missing business facts include:

- source revision;
- validity start/end;
- effective date basis;
- exact price scope/type beyond a broad applicability code;
- immutable Price Revision FK.

The Candidate's `commercialStatus` records a derived state but does not preserve
the underlying price validity/evidence needed to audit that state.

## 7. Source Revision

Source ID, evidence object, digest and source kind are present. The immutable
parent FK is explicit. This closes the specific C4 Source `sourceKind` omission.

## 8. Catalog Review

Target revision and policy revision are present, and all five fields participate
in the immutable parent FK. A mutable status-only shortcut is not used.

## 9. Professional Review

Event ID, Review ID, policy, decision and basis digest are present. The
six-column source ownership key remains separate from the policy-inclusive
Review key.

## 10. Warning

Sequence is an integer tag and participates in the stable tuple. This fixes the
C4 field omission.

DEFECT: the sequence algorithm sorts by `sourceWarningId`, but no Registry or
Schema field stores it. For identical code/text warnings, the final order and
association are not independently reconstructible.

Additional semantic fields that may affect presentation/risk, such as severity
and source classification, are not defined. Whether they must enter Basis is
still an open product decision, so this is secondary to the missing tie-break.

## 11. Missing Field

Candidate, field key and reason are present. `reasonCode` must enumerate at
least unknown, not-applicable, not-provided and unrecognized semantics; the C5
file does not provide that enum. This is an implementation ambiguity.

## 12. Registry Versioning

SNAPSHOT-R1 is preserved. SNAPSHOT-R2 is a new registry. R2/R5 vectors do not
reinterpret R1/R4 bytes.

## 13. Conclusion

The Registry is no longer a generic example-and `stableKey` collision is
closed. It is still not a complete protected representation of selection
provenance and price meaning.

