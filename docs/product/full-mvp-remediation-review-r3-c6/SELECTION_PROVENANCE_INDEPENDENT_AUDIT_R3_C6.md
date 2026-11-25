# Selection Provenance Independent Audit R3-C6

Result:

```text
SELECTION PROVENANCE: FAIL
CANDIDATE BINDING: FAIL
PARAMETER PROVENANCE: FAIL
PRICE PROVENANCE: FAIL
RULESET BASIS BINDING: PASS
```

## 1. Schema Reality

`SNAPSHOT_NORMALIZED_SCHEMA_R3_C6.md:13-120` defines:

```text
sales_handoff_snapshot_r3
selection_run
selection_candidate_result
```

It contains UNIQUE keys but no foreign keys:

- Header -> Case/RequirementVersion/SelectionRun;
- SelectionRun -> RequirementVersion/RuleSetRevision;
- SelectionCandidateResult -> SelectionRun/ProductRevision/
  SpecificationRevision/PriceRevision/RuleSetRevision.

The candidate/parameter/price child tables are column/prose summaries at lines
176-217, not executable table/FK DDL.

## 2. Snapshot Creation Counterexample

`create_snapshot_r3` receives `p_case_id` and
`p_requirement_version_id` from the caller. It loads a valid sealed run but
never compares either caller value with the run.

An attacker/priv-function caller can provide a valid run from requirement V1
and a different RequirementVersion V2. Because the Header has no FK to the run
or RequirementVersion, the insert can pass; the run's project/conversation/
requirement are mixed with V2.

## 3. Candidate

The proposed SelectionCandidateResult exact key includes product/spec/price
identity, but the table itself has no FKs to the immutable Product,
Specification or Price Revision tables. The claim at lines 123–124 is therefore
not enforced by DDL.

The Snapshot Candidate table is not defined with the advertised exact FK.

## 4. Parameter

The Registry/Basis includes CatalogParameterRevision. The exact FK is only prose:

```text
(catalogParameterRevisionId,parameterKey,valueType,sourceRevisionId)
```

No DDL creates the immutable parent or the FK.

## 5. Price

Price fields are now rich and Basis-visible, but the normalized table DDL is
absent. The claimed immutable PriceRevision FK and price validity check cannot
be verified from the submitted DDL.

## 6. RuleSet

Header tags 9–10 contain RuleSet ID and digest in the C6 vector. This part is
correct. The remaining missing root FK from Snapshot to SelectionRun is covered
by P1-01.

## 7. Required Acceptance

- full CREATE TABLE DDL for every provenance/child table;
- exact composite FKs named in the design;
- case/requirement values derived from the sealed run;
- tests proving every C6-PROV/PRICE/RULE mismatch rejects.

