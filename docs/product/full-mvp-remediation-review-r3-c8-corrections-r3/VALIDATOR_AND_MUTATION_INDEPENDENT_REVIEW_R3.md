# Validator and Mutation Independent Review

## Submitted Results

```text
Formal R3 mutations: 29/29
Historical R2 mutations: 12/12
FK errors: 0
```

These results are reproducible from the submitted evidence, but the 29 fixtures
remain mostly marker-driven and do not evaluate transaction persistence after
exceptions.

## Independent Findings

- FK target and source-column validation is materially improved.
- The five R2 FK structure defects are removed.
- Final PUBLIC revoke ordering is checked.
- Replay-order markers are checked.
- The Validator does not detect approval-expiry updates being rolled back by a
  subsequent exception.
- It does not detect that one Recovery per Generation prevents a new recovery
  after DENIED/LOCKED.
- It does not enforce `NOT NULL` for ProfessionalReview candidate identity.

## Status

`PARTIALLY RESOLVED`

The Validator is useful as a structural regression checker, but its PASS is not
sufficient for state-machine closure.
