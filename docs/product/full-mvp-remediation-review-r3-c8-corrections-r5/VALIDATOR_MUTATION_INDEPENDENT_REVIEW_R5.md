# Validator and Mutation Independent Review R5

## Literal Target Replay

The historical mutation definitions were extracted without invoking the R5
Validator:

```text
R3 formal mutations:       29/29 targets changed final DDL
R2 historical mutations:   12/12 targets changed final DDL
R4 semantic mutations:     46/46 targets changed final DDL
```

This proves the mutation text targets the current final document. It does not
prove each semantic property unless the independent check below detects the
change.

## Independent Negative Suite

```text
Rules:   22
Passed:  21
Failed:   1
```

Failure:

```text
IND-MUT-22
Response-loss replay is not independently derived.
```

The complete per-rule result is in `VALIDATION_EVIDENCE_REVIEW_R5.json`.

## Positive Independent Checks

- seven identity statement Triggers use the same fixed advisory key;
- ROTATION Execute calls the current-Root gate before operator/Generation
  mutation;
- Generation `BEFORE INSERT` repeats the ROTATION current-Root gate;
- Begin contains expired-Attempt lock, terminal evidence, next sequence and new
  Attempt;
- Candidate audit inserts precede exact Candidate-only updates;
- valid audit row counts and expected/applied row counts are enforced;
- ACL effective map matches the Capability Registry;
- 57 Open Decision IDs are unique and OPEN.

## R5 Validator Defects

1. Registry contract does not compare security mode or `search_path`.
2. The Open Decisions check accepts at least 57 regex matches rather than
   requiring exactly 57 unique OPEN IDs and zero approvals.
3. Independent negative evidence does not contain mutation target, before/after
   result, or observed flip data.
4. The response-loss model injects `"GENERATION:2"` directly.
5. Documented state vector IDs are not checked against evidence IDs.

## Runtime Boundary

No R5 or review mutation was executed as SQL. PostgreSQL grammar, compilation,
constraint behavior, Trigger order, ACL Catalog and concurrent transactions
remain unverified.

