# SNAPSHOT-R3 Registry / Schema / Basis Independent Audit

Result:

```text
SK-R2 / Registry Code 3: PASS
SNAPSHOT-R3: FAIL
REGISTRY / SCHEMA / BASIS: FAIL
Warning Identity / Ordering: PASS
```

## 1. Registry

SNAPSHOT-R3 has 10 record types and all field tags used by C6-SNAP-01.

Positive additions:

- Header includes context, RuleSet ID/digest and `basisAsOf`;
- Candidate includes SelectionResult and revision provenance;
- Parameter includes CatalogParameterRevision;
- Price includes source/validity/basis fields;
- Warning includes sourceWarningId/severity;
- Missing Field includes impactScope.

StableKey registry code 3 passes all 17 byte vectors.

## 2. Schema

The Registry maps to C6 JSON and Crosswalk names, but the normalized schema is
not a complete executable schema:

- Candidate/Parameter/Price/Requirement/Review child tables are prose summaries.
- Exact FKs can be described yet absent from SQL.
- Snapshot Header has no FK to the provenance tables.
- `selection_run`/`selection_candidate_result` have no FKs to parent catalog
  revisions.

## 3. Basis

The C6 vector fields correspond to the C6 Registry and Crosswalk. The full
snapshot vector is deterministic and passes independent reconstruction.

This does not compensate for missing database constraints.

## 4. Warning

Warning sequence sorting uses fields that are present in Registry, Schema
summary and Basis:

```text
warningCode
warningText
sourceWarningId
```

The ordering concept is closed at design level.

## 5. Conclusion

The Registry/Basis relationship is coherent as a data-format design. The
Registry-to-database authority claim is not yet fully executable.

