# ROTATION Execute Identity Review R5

## Verdict

```text
REV-R4-IND-P2-01:
RESOLVED — INDEPENDENT STATIC REVIEW
```

No remainder of the original stale-Begin-identity path was found in the final
R5 DDL.

## Final Call Path

```text
Execute role check
-> lock_bootstrap_identity_r5()
-> lock Recovery Attempt FOR UPDATE
-> Request Ledger claim/replay
-> approval expiry check
-> lock Lifecycle FOR UPDATE
-> Lifecycle/Recovery identity comparison
-> ROTATION current Root authority gate
-> approval/operator/target checks
-> disable old Root Operator
-> supersede old Generation
-> INSERT new Generation
-> Generation BEFORE INSERT Trigger rechecks ROTATION Root
-> append Event/Ledger
```

The Execute root gate starts at Complete DDL line 17305. The Generation Trigger
starts at line 16750.

## Current Root Gate

The final authority query verifies:

1. Generation exists and is either ACTIVE or explicitly allowed as
   SUPERSEDED-for-transition.
2. Bound Root Session belongs to that Generation.
3. `trusted_session` is ACTIVE and bound to the same Principal and database
   role.
4. `trusted_principal` is ACTIVE.
5. `principal_epoch.current_epoch` equals session login epoch.
6. Bound Root Grant belongs to the same Generation/Session/Principal.
7. `authority_grant` is unrevoked and currently valid.

The same DB time value is used throughout one gate.

## Advisory Lock

`app_private.lock_bootstrap_identity_r5()` takes one transaction-scoped
`pg_advisory_xact_lock(8162026112501)`.

Seven `BEFORE UPDATE OR DELETE ... FOR EACH STATEMENT` Triggers take that lock
for:

- `trusted_principal`;
- `principal_epoch`;
- `trusted_session`;
- `authority_grant`;
- `bootstrap_root_session_r2`;
- `bootstrap_root_grant_r2`;
- `bootstrap_operator_r3`.

Begin, Approve, Execute and Deny also take the same lock before protected row
locks. Therefore public identity-revocation paths and Recovery commands share
one serialization domain.

## Generation Trigger

The Trigger:

- runs `BEFORE INSERT` for every Generation row;
- ignores Generation 1 only;
- locks the same identity mutex;
- loads the previous Lifecycle and exact APPROVED Attempt;
- verifies target Principal, role, token digest and approval expiry;
- invokes the current-Root gate for ROTATION;
- permits the old Generation only when `SUPERSEDED`, with
  `superseded_at` set;
- requires exactly two enabled, ACTIVE non-Root approvals.

It does not trust caller-supplied `NEW` fields as authorization facts; it
requires those fields to match the durable APPROVED Attempt.

## Boundaries

Actual lock waiting, serializable outcomes, Trigger order and PostgreSQL
deadlock selection remain `NOT VERIFIED — DATABASE NOT AUTHORIZED`.

