# Expired Attempt Terminalization Review R5

## Original Finding

```text
REV-R4-IND-P2-02:
RESOLVED — INDEPENDENT STATIC REVIEW
```

The original permanent block is corrected: an active expired Attempt no longer
requires an unrelated old request to call Approve/Execute/Deny.

## Final Begin Flow

```text
validate Initiator
-> identity mutex
-> lock Lifecycle
-> resolve Initiator Operator/Principal
-> Ledger replay check
-> sample v_now
-> command identity checks
-> SELECT active Attempt ... FOR UPDATE
-> terminalize expired Attempt
-> re-read Lifecycle
-> reject any remaining active Attempt
-> allocate next sequence
-> create new PENDING Attempt
-> create INITIATOR approval
-> Lifecycle/Event/Ledger completion
-> COMMIT
```

## Terminalization Evidence

The immutable table records:

- recovery ID and unique terminalization ID;
- bootstrap ID/generation/attempt sequence;
- previous and terminal state;
- expiry reason and authoritative time;
- observation origin;
- original request ID/hash;
- Actor role/Principal;
- LOCKED Event ID;
- content digest.

The terminal row is append-only and `recovery_id` is UNIQUE.

## Attempt Identity

The existing partial unique index remains:

```sql
CREATE UNIQUE INDEX bootstrap_recovery_one_active_attempt_r4
ON app.bootstrap_recovery_r2 (bootstrap_id,from_generation)
WHERE state IN ('PENDING','APPROVED');
```

Sequence allocation is a single `INSERT ... ON CONFLICT ... DO UPDATE
RETURNING` operation. Terminal Attempts leave the active predicate.

## P3 Time-Order Warning

The design document says the active Attempt is locked before authoritative time
is read. The final SQL instead performs:

```text
v_now := clock_timestamp()             -- line 17097
...
SELECT ... FROM bootstrap_recovery ... FOR UPDATE  -- line 17141
```

All current public Recovery writers share the identity mutex, so no concrete
public race was demonstrated. The mismatch is still a portability and
maintenance risk, and a direct owner DML path is not independently proven to be
serialized on `bootstrap_recovery_r2` itself.

## Failure/Concurrency Matrix

| Case | Static expected result |
|---|---|
| expired Attempt | LOCKED + Event + terminal evidence + new Attempt, one commit |
| unexpired active Attempt | new Begin rejected |
| Event/evidence insert failure | entire Begin rolls back |
| sequence/new Attempt failure | entire Begin rolls back |
| two Begin | identity mutex + Lifecycle lock; partial unique backstop |
| Begin vs Execute/Approve/Deny | same mutex serializes |
| response lost after commit | same request ID reads committed Ledger result |

Runtime lock timing and MVCC remain `NOT VERIFIED`.

