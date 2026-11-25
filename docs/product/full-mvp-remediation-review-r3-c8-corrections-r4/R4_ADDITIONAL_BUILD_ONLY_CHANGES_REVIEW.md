# R4 Additional Build-only Changes Review

## Expiry Ledger Names

`PASS — INDEPENDENT STATIC REVIEW`

- Helper completes no Ledger.
- Approve completes `BOOTSTRAP_APPROVE_ROOT_CHANGE_R4`.
- Execute completes `BOOTSTRAP_EXECUTE_ROOT_CHANGE_R4`.
- Replay reads the original operation row before terminal-state checks.

## Sequence Function Owner DML

`PASS — INDEPENDENT STATIC REVIEW`

`bootstrap_recovery_sequence_r4`:

- Owner: `elevator_table_owner`;
- PUBLIC table access: revoked;
- `elevator_review_function_owner`: exact `SELECT/INSERT/UPDATE`;
- allocator is SECURITY DEFINER and owned by the same function owner.

Actual ACL Catalog remains unverified.

## ROTATION Current Identity

```text
Begin:
PASS — current Session, Grant, Principal, Epoch, expiry and generation checks

Execute:
FAIL — REV-R4-IND-P2-01
```

Execute does not re-query Root Session/Grant/Principal/Epoch. A revoke or expiry
between Begin and Execute does not force transition from `ROTATION` to
`RECOVERY` semantics.

Required correction: add a locked current-Root revalidation inside Execute for
`kind='ROTATION'`, immediately before disabling the old Root and advancing the
Generation.

## Initiator / Approver / Deny / Execute ACTIVE Checks

`PASS WITH STATIC BOUNDARY`

- Begin requires ACTIVE initiator Principal.
- Approve and Deny require ACTIVE approver/deny Principal.
- Execute locks both approval Operator rows and both Principal rows.
- Execute requires exactly two enabled Operators and two ACTIVE Principals.
- Current ROTATION Root is not rechecked at Execute, as above.

Deadlock behavior under real connections remains unverified.

## Execute Identity Provisioning

`PASS — INDEPENDENT STATIC REVIEW`

Final Execute contains no INSERT into:

```text
app.trusted_principal
app.principal_epoch
```

It fails if the target identity is absent, inactive, or not at Epoch 1.
`bootstrap_prepare_r3` still provisions initial bootstrap identities, which is
a separate OPEN identity-broker/provisioning decision.

## Candidate Table Freeze

`PASS — INDEPENDENT STATIC REVIEW`

The migration takes `SHARE ROW EXCLUSIVE` on all four relevant tables before
reading sources or updating targets. The write transaction must be under an
external single transaction wrapper, which is documented but not executable in
this stage.

## Candidate Backfill Audit

`FAIL — REV-R4-IND-P2-03`

The table freeze and Candidate-only guard are present, but no durable audit or
per-row evidence is produced.
