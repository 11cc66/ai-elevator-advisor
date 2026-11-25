# Expired Active Attempt Auto-Terminalization R5

## Finding

```text
REV-R4-IND-P2-02
Status: RESOLVED — DESIGN
```

An expired PENDING/APPROVED Attempt could continue to occupy the active
partial unique index until an unrelated old request happened to trigger LOCKED.

## Begin Transaction

R5 Begin performs one atomic transaction:

1. Validate Initiator Session role and ACTIVE Principal.
2. Acquire the Bootstrap identity mutex.
3. Lock the current Lifecycle row.
4. Validate target identity and the command-specific Lifecycle state.
5. Lock the current PENDING/APPROVED Attempt, if present.
6. Read authoritative DB time once.
7. If expired, update the old Attempt to LOCKED with
   `APPROVAL_EXPIRED`.
8. Update Lifecycle to LOCKED and append the LOCKED Event.
9. Insert immutable `bootstrap_recovery_terminalization_r5` evidence with the
   previous state, Attempt sequence, expiry time, DB time, Actor pair, request
   evidence and Event ID.
10. Re-read the locked Lifecycle row.
11. Allocate the next sequence through one atomic upsert.
12. Insert the new PENDING Attempt, INITIATOR approval, Lifecycle transition,
    Event and Begin Ledger completion.
13. COMMIT once.

There is no autonomous transaction and no update-before-RAISE path.

## Retry and Failure

| Case | Result |
|---|---|
| Old Attempt is still valid | Begin rejects with active conflict |
| Old Attempt is expired | Old LOCKED + terminal evidence + new Attempt, one commit |
| Old denial/lock already exists | New Attempt may be created under the terminal-preserving model |
| Event insert fails | Entire Begin rolls back, including terminalization |
| Terminal evidence insert fails | Entire Begin rolls back |
| New sequence or Attempt insert fails | Entire Begin rolls back |
| COMMIT succeeds but response is lost | Same request ID returns the committed Begin result |
| Concurrent Begin | Identity mutex and Lifecycle lock serialize; partial unique is backstop |
| Concurrent Execute/Approve/Deny | Same identity mutex and ordered row locks serialize |

`bootstrap_recovery_terminalization_r5.recovery_id` is UNIQUE, its rows are
append-only, and its Event is required by FK. A second expiry path cannot append
duplicate terminal evidence.

## Policy Boundary

R5 does not approve:

- maximum attempt count;
- retry cooldown;
- break-glass authority;
- emergency single-approver recovery;
- audit retention.

Until those decisions are approved, normal two-approval recovery remains
mandatory and Fail Closed.

## Evidence

`R4-ATT-01..10`, `R4-TX-01..09`, `IND-MUT-03/04/20`, and
`expired_active_attempt_replaced` pass in the offline suite. Actual partial-index
locking, conflict waiting and commit visibility remain `NOT VERIFIED`.

