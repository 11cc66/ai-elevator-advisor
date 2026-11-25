# Bootstrap Recovery / Rotation Review

## Passed Static Elements

- Historical Approval and Root Session FKs target immutable Generation.
- Root Session uses actual `session_id`.
- Lifecycle Generation relation is deferrable.
- Issuance Attempt is created for every Generation.
- Request Ledger replay precedes old-Generation selection.
- Root/Approver Principals are rechecked ACTIVE.
- Deny and Issuance Failed functions exist.

## Failed Semantics

### Approval Expiry

Approval and Execute update Recovery/Lifecycle to `LOCKED` and then raise. The
exception rolls back the same transaction, so the state is not durably changed.

### Locked Recovery

One recovery per `(bootstrap_id,from_generation)` means a denied recovery
occupies that Generation. A later two-approval Begin for the same Generation
cannot insert a new recovery despite the stated LOCKED recovery path.

## Required Correction

- Persist expiry/locked state through a non-exceptional controlled transaction.
- Permit a new recovery epoch after DENIED/LOCKED without allowing concurrent
  duplicate active recoveries. Use a recovery attempt ordinal or partial unique
  index over active states.
- Add state-machine mutation tests for both cases.

PostgreSQL rollback and concurrency behavior remain unverified.
