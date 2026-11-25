# Bootstrap Generation and Recovery R3

## Immutable vs Current

```text
Immutable history:
  bootstrap_generation_r2
  bootstrap_approval_r2
  bootstrap_root_session_r2
  bootstrap_root_grant_r2
  bootstrap_event_r2
  bootstrap_request_ledger_r2

Mutable current pointers:
  bootstrap_state_r3
  bootstrap_lifecycle_r2
```

All historical rows bind to `bootstrap_generation_r2`, never to a mutable
current Lifecycle row.

## State Machine

```text
SEED_READY
 -> APPROVAL_PENDING
 -> ROOT_ISSUANCE_PENDING
 -> BOOTSTRAP_COMPLETED

BOOTSTRAP_COMPLETED / ROOT_ROTATED / LOCKED / interrupted issuance
 -> RECOVERY_PENDING or ROOT_ROTATION_PENDING
 -> RECOVERY_APPROVED
 -> ROOT_ISSUANCE_PENDING (new immutable generation)
 -> ROOT_ROTATED
```

At most one recovery can start from a given Generation.

## Transaction Order

1. Validate fixed role and actor Principal.
2. Lock Recovery/Lifecycle/Generation.
3. Claim Request Ledger; if completed, return recorded result.
4. Verify approvals, expiry and Generation CAS.
5. Insert the next immutable Generation.
6. Materialize the two approvals for the new Generation.
7. Revoke old Root Session/Grant and disable old Root Operator.
8. Move State and Lifecycle to the new Generation.
9. New Root Issuer completes issuance from a recorded attempt.
10. Record immutable Event and complete the Ledger request.

The Lifecycle-to-State generation FK is deferrable; historical FKs target the
immutable Generation row.

## Failure Matrix

| Failure | State | Next action |
|---|---|---|
| begin response lost | same Generation, RECOVERY_PENDING | Request Ledger replay |
| approve response lost | same Generation | replay returns stored approval result |
| execute response lost | new Generation + attempt PENDING | replay returns new Generation |
| new Root unavailable | attempt PENDING/LOCKED | `bootstrap_mark_issuance_failed_r3`, then new recovery |
| approvals expire | LOCKED | new two-approver recovery from current Generation |
| old Root invalid | old Generation revoked | new recovery issuance |

No more than one recovery starts from one Generation.

## Deferred Constraint

`bootstrap_lifecycle_generation_fk_r3` is deferrable because State and Lifecycle
must move from Generation N to N+1 in one transaction. It is checked at commit.
Historical Approval/Root Session FKs target the immutable Generation row and
remain valid before and after the move.

## Runtime Boundary

Transaction rollback, deadlock, concurrent retry and PostgreSQL constraint
timing remain `NOT VERIFIED`.
