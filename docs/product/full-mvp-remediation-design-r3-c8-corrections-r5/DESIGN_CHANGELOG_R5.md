# Design Changelog R5

## R4 Input Integrity

- Verified all 25 R4 design Manifest records.
- Verified all 16 R4 independent review records.
- Verified key hashes for Complete DDL, Overlay, Registry, Validation Evidence,
  main review and review evidence.
- Recorded one authorization-text hash transcription inconsistency while
  preserving the Manifest-verified file.

## ROTATION Execute

- Added one transaction-scoped Bootstrap identity advisory lock.
- Added statement-level lock Triggers to every identity-revoking table.
- Added shared current-Root authority gate.
- Added R5 Execute gate before any Root/Generation mutation.
- Added final Generation `BEFORE INSERT` ROTATION revalidation.
- Distinguished ROTATION from RECOVERY semantics.

## Expired Attempt

- Added immutable terminalization evidence table.
- Added atomic terminalize helper.
- Begin detects/locks an expired active Attempt and creates the next Attempt.
- Added Event, Actor pair, expiry evidence and unique terminal proof.

## Candidate Backfill

- Removed R4 uncontrolled direct UPDATE from the R5 complete final source.
- Added controlled batch function with request idempotency.
- Added expected/applied count proof and source-table freeze.
- Added per-row old/new, provenance, row-digest, sealed-digest and correction
  digest evidence.
- Added review Audit linkage and append-only guards.

## Validator

- Preserved 29 R3 formal, 12 R2 historical and 46 R4 semantic mutations.
- Added 22 independent negative rules.
- Replaced `None == None` with a non-NULL durable replay result.
- Added final-tail ACL and Generation Trigger checks.
- Added ID/docs/open-decision checks.

## Frozen

No Prisma, migration, application/Worker source, build artifact, database,
Storage, PFR, service, ACL, Git index or historical report was modified.

