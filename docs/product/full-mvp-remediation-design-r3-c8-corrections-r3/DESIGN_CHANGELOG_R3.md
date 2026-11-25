# Design Changelog R3

## P1

- Historical Bootstrap FK targets moved from mutable Lifecycle to immutable
  Generation.
- Invalid Root Session source column corrected.
- Generation advance FK made deferrable.
- Catalog Source/Event FKs use real primary keys with binding-copy triggers.
- Missing ProfessionalReview `candidate_id` columns restored and populated by
  trigger.
- Final post-definition PUBLIC function/routine revoke added.

## P2

- Result Recovery restricted to one record per Request.
- Result Recovery approval/execution replay moved before terminal-state checks.
- Bootstrap Begin/Approve/Execute replay moved before state/old-Generation
  checks.
- Approval expiry, denial, failed-issuance marker and LOCKED recovery path added.
- Owner transaction advisory lock implemented.
- Root/Approver ACTIVE state rechecked under lock.
- Catalog Binding actor Grant composite FK added.
- Structural Validator and 29 formal mutation classes added.

## P3

- State/timestamp CHECK constraints added.
- R3 Guard records child exit code and finish time.

## Frozen Compatibility

- C6-SNAP-01 unchanged.
- SourceKey 362 bytes, Basis 512 bytes, SK-R2 code 3.
- 57 Open Decision IDs unchanged.

## Boundary

No SQL, DB, Migration, Runtime, Storage, source or production action performed.
