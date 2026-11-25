# Finding, Mutation and Document Drift Review R5

## Finding IDs

The five canonical R5 Finding IDs are present and unique in the design
traceability:

```text
REV-R4-IND-P2-01
REV-R4-IND-P2-02
REV-R4-IND-P2-03
REV-R3-R3-P2-03
REV-R4-IND-P3-01
```

The historical duplicate `R4-DESIGN-P3-01` is explicitly mapped to
`R4-HIST-P3-01A` and `R4-HIST-P3-01B`.

## Mutation Range

The R4 Candidate range is complete:

```text
R4-CAND-01 through R4-CAND-11
```

`R4-TX-09` is present. The literal R4 mutation target replay is 46/46.

## State-Vector Drift

The traceability document defines:

```text
R5-STATE-REVOKED-APPROVAL
R5-STATE-REVOKED-ROOT
R5-STATE-EXPIRED-REPLACED
R5-STATE-SINGLE-ACTIVE
R5-STATE-RESPONSE-LOSS
```

Validation Evidence uses:

```text
revoked_approval_cannot_execute
revoked_root_cannot_execute
expired_active_attempt_replaced
single_active_attempt
response_loss_replay_non_vacuous
```

Those five pairs have no canonical mapping in the design package. A consumer
cannot resolve the documented IDs to evidence by exact match.

## Independent Mutation Evidence Gap

The 22 `IND-MUT-*` results contain only:

```text
id
basis
pass
```

They do not contain the required mutation target, mutation operation, expected
before/after result, or observed flip. Several checks are only static presence
predicates. This does not meet the authorization's per-test evidence standard.

## Open Decisions Validator

The R5 Validator checks the Open Decisions document with at least 57 regex
matches. It does not itself require exactly 57 unique IDs, the `OPEN` state, or
zero approvals, although the current document happens to satisfy all three.

## Verdict

```text
REV-R4-IND-P3-01:
PARTIALLY RESOLVED
```

The original Candidate/TX-09 omissions are repaired; exact vector resolution and
fail-closed Validator coverage remain incomplete.

