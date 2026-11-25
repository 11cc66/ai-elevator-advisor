# Bootstrap Recovery and Rotation R3-C8 R2

## State Machine

No lifecycle row means `NOT_STARTED`.

```text
SEED_READY
  -> APPROVAL_PENDING
  -> ROOT_ISSUANCE_PENDING
  -> BOOTSTRAP_COMPLETED

BOOTSTRAP_COMPLETED | ROOT_ROTATED | LOCKED
  -> RECOVERY_PENDING or ROOT_ROTATION_PENDING
  -> RECOVERY_APPROVED
  -> ROOT_ISSUANCE_PENDING (new generation)
  -> ROOT_ROTATED
```

`REVOKED` and `LOCKED` never transition back to Seed or Bootstrap without a new
two-approval root-change request.

## Failure Matrix

| Failure | Result |
|---|---|
| transaction rollback | previous state remains |
| response lost after commit | request ledger returns the existing root Grant |
| root Session naturally expired | controlled RECOVERY |
| root Session actively revoked | controlled RECOVERY |
| root Grant expired or revoked | controlled RECOVERY |
| one approver unavailable | no approval completion; pending or denied |
| credential compromise | new Root identity and generation |
| root issuer unavailable | recovery to a new role/Principal |
| concurrent root changes | row locks and generation CAS |

## Idempotency

`bootstrap_request_ledger_r2` uses `(operation,request_id)` as its key. Replay
requires identical Bootstrap, Generation, actor role, Principal and request
hash. The stored result points to the existing root Grant or generation.
No second Root Grant is inserted.

The two-argument `bootstrap_complete_root_r3` is retained as a compatibility
wrapper. It derives a deterministic request ID and delegates to the four-argument
controlled function.

## Root Rotation / Recovery Protocol

1. Initiator creates a `RECOVERY` or `ROTATION` request.
2. A distinct Approver approves it.
3. Seed execution locks recovery and lifecycle rows.
4. Old Root Operator is disabled.
5. Old Root Session and Grant are revoked.
6. A new immutable Generation row is created.
7. The two approvals are materialized for the new Generation.
8. State moves to `ROOT_ISSUANCE_PENDING`.
9. The new Root Issuer completes issuance with the new token.
10. The lifecycle becomes `ROOT_ROTATED`.

Only one lifecycle row can be current, so concurrent changes serialize on the
same row.

## Security Boundary

Emergency authority, credential custody and the identities authorized for
recovery remain Open Decisions. The design supplies a fail-closed protocol, not
approval of those organizational policies.
