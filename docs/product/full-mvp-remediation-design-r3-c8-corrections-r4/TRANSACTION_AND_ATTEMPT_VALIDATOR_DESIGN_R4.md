# Transaction and Attempt Validator Design R4

## Purpose

The R4 Validator must reject the exact R3 defects rather than finding arbitrary
text markers. It combines static final-definition analysis, structural FK/key
checks, offline state models and negative mutations.

## Final Definition Resolution

The complete DDL contains frozen R3 function bodies followed by R4 replacements.
Scanning the whole text would still see the unsafe historical `UPDATE -> RAISE`
body and could produce a false failure.

The Validator therefore:

1. parses every function header and body;
2. normalizes argument types into a signature;
3. retains only the last definition for each signature;
4. runs semantic checks against that final definition map.

It also extracts the final effective grant set by replaying GRANT/REVOKE events
in source order.

## Transaction Checks

The final helper must:

- update Recovery to LOCKED;
- update Lifecycle to LOCKED;
- append an Event;
- complete no Ledger row;
- contain no unhandled expiry RAISE;
- contain no `WHEN OTHERS` swallow.

The final Approve/Execute callers must:

- claim Request Ledger before state rejection;
- call the helper on expiry;
- complete their own Ledger operation;
- return structured LOCKED;
- contain a replay branch before current-state checks.

## Attempt Checks

The Validator asserts:

- old one-per-Generation unique is dropped;
- `attempt_sequence` is backfilled and NOT NULL;
- `(bootstrap_id, from_generation, attempt_sequence)` is unique;
- active PENDING/APPROVED partial unique exists;
- the counter upsert is atomic;
- Begin locks Lifecycle;
- Begin has no caller sequence parameter;
- DENIED/LOCKED lifecycle can start a new attempt;
- terminal Attempts cannot be updated back to PENDING;
- approvals are keyed by the exact recovery ID;
- Execute requires APPROVED;
- replay precedes state rejection.

## Candidate Checks

The Validator asserts:

- authoritative Event/Selection backfills exist;
- remaining NULL aborts migration;
- no default/random Candidate is invented;
- both `candidate_id` columns are NOT NULL;
- the composite Candidate FKs remain valid.

## ACL Checks

The final capability map is compared with the frozen R3 effective map:

```text
R3 capabilities
  - unsafe bootstrap begin/approve/deny/execute
  + R4 bootstrap begin/approve/deny/execute
```

Every expected capability must be explicitly present after the final PUBLIC
revoke. No old Recovery role grant or post-revoke PUBLIC grant is allowed.

## Offline State Models

The Validator includes two independent models:

- transaction persistence model: commit, rollback, Audit/Ledger failure,
  response loss and visibility;
- ordered Attempt model: sequence, active uniqueness, deny/lock/recovery,
  stale execute and lost-response replay.

These models validate the written design contract. They are not PostgreSQL
execution and cannot prove MVCC, lock order, deadlock or Catalog behavior.

## Evidence Output

`VALIDATION_EVIDENCE_R4.json` records each check, mutation, vector, input
Manifest, hash, object count and unavailable-runtime boundary.
