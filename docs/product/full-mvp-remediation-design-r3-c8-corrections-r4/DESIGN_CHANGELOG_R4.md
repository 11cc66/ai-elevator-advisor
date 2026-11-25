# Design Changelog R4

## R3 P2-01

- Added committing expiry helper.
- Removed invalid `BOOTSTRAP_LOCK_EXPIRED_ATTEMPT` Ledger completion.
- Approve/Execute now complete their own Request Ledger rows.
- Added LOCKED/Lifecycle/Event persistence before structured return.
- Added transaction mutations `R4-TX-01` through `R4-TX-08`.
- Recorded the immutable Attempt Initiator role/Principal pair on system expiry
  Events instead of pairing the current caller role with another Principal.
- Added transaction mutation `R4-TX-09`.

## R3 P2-02

- Added terminal-preserving Recovery Attempt history.
- Added deterministic `attempt_sequence` migration.
- Added atomic sequence counter.
- Added exact sequence uniqueness and PENDING/APPROVED partial uniqueness.
- Removed the old one-per-Generation role path.
- Preserved old function signatures as non-callable compatibility wrappers.
- Added Attempt mutations `R4-ATT-01` through `R4-ATT-10`.
- Restored and hardened ROTATION root-authority, new Principal/Role,
  backend-identity, Deny separation and Execute identity checks.
- Enforced ACTIVE Initiator/Approver/Deny Principals and fresh target Root
  Principal/Role identity.
- Required the target Principal to be ACTIVE with initial Epoch 1 before
  Generation advancement.
- Removed Execute-side Principal/Epoch auto-provisioning; target identity must
  come from the separately governed identity-provisioning path.
- Rechecked both approval Operator rows as enabled at Execute.
- Added Recovery mutations `R4-REC-01` through `R4-REC-12`.

## R3 P2-03

- Replaced whole-file marker checks with final-definition analysis.
- Added final ACL computation from ordered GRANT/REVOKE events.
- Added transaction persistence model.
- Added ordered Attempt concurrency model.
- Preserved 29 R3 formal and 12 R2 historical mutations.
- Added 46 R4 negative mutations.

## R3 P3-01

- Added exact Event backfill for Selection Professional Review.
- Added exact Selection-result backfill for Snapshot Review.
- Added a Candidate-only migration exception inside the existing sealed and
  finalized guards, without disabling or deleting any Trigger.
- Assigned that helper to the Trigger Owner and revoked PUBLIC before guarded
  backfill.
- Froze Event, Selection and Snapshot source tables for the backfill window.
- Added NULL preflight with SQLSTATE `23502`.
- Added two real NOT NULL constraints.
- Added Candidate mutations `R4-CAND-01` through `R4-CAND-11`.

## Additional Hardening

- Added terminal Attempt timestamp/reason check.
- Added legacy terminal observation labeling.
- Added nonblank denial reason.
- Added new sequence-table PUBLIC revoke.
- Added minimum `SELECT/INSERT/UPDATE` sequence-table privilege for the
  Security Definer review function owner.
- Reasserted complete approved function capability set after final PUBLIC
  revoke.
- Added ACL mutations `R4-ACL-01` through `R4-ACL-04`.

## Frozen

- No Prisma Schema or Migration change.
- No SQL execution or database connection.
- No Storage or Runtime action.
- No source or historical report modification.
- No Git write.

## Result

```text
DESIGN COMPLETE — READY FOR SEPARATE INDEPENDENT REVIEW
```

This does not authorize implementation.
