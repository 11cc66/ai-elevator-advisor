# Expiry Transaction Persistence Review R4

## Verdict

```text
REV-R3-R3-P2-01:
RESOLVED — INDEPENDENT STATIC REVIEW
```

The final definitions no longer contain:

```text
UPDATE Recovery/Lifecycle -> LOCKED
RAISE EXCEPTION
```

## Final Call Path

Approve:

```text
activate role check
-> lock Recovery
-> lock/verify ACTIVE Approver Principal
-> claim original Approve request
-> return replay result if already committed
-> detect expiry
-> lock_expired_root_change_r4
-> complete BOOTSTRAP_APPROVE_ROOT_CHANGE_R4 Ledger
-> return LOCKED
-> normal transaction commit
```

Execute:

```text
fixed seed role check
-> lock Recovery
-> claim original Execute request
-> return replay result if already committed
-> detect expiry
-> lock_expired_root_change_r4
-> complete BOOTSTRAP_EXECUTE_ROOT_CHANGE_R4 Ledger
-> return LOCKED
-> normal transaction commit
```

The helper at Complete DDL lines 15723-15758:

- locks Recovery;
- treats repeated LOCKED as idempotent;
- rejects DENIED/EXECUTED terminal conflict;
- updates Recovery and Lifecycle to LOCKED;
- appends the LOCKED Event;
- performs no Ledger completion;
- contains no exception block or expiry RAISE.

## Transaction Matrix

| Scenario | State | Ledger | Event | Commit/Replay |
|---|---|---|---|---|
| Valid approval | APPROVED | Approve operation completed | Approval Event | Normal commit |
| Expiry found by Approve | Recovery/Lifecycle LOCKED | Approve operation completed with LOCKED | LOCKED Event | Normal commit |
| Expiry found by Execute | Recovery/Lifecycle LOCKED | Execute operation completed with LOCKED | One LOCKED Event | Normal commit |
| Lost Approve response | Same committed result | Replay-first | No duplicate mutation | LOCKED/APPROVED replay |
| Lost Execute response | LOCKED or new Generation | Replay-first | No duplicate mutation | Stored result |
| Database error before commit | All rollback | Claim rollback | Rollback | Retryable |
| Event error | All rollback | Claim rollback | Rollback | Retryable |
| Ledger completion error | All rollback | No completion | Rollback | Retryable |
| Concurrent Approve/Execute | Recovery row serialization | Each request completes its own row | One state-transition Event | LOCKED/terminal conflict |

## Positive Evidence

- No autonomous transaction assumption.
- No `WHEN OTHERS` exception swallowing in the expiry helper.
- Ledger operation names are distinct and match each caller.
- Replay precedes terminal-state rejection in both callers.
- Approve and Execute row-lock the same Recovery before claim.

## Remaining Boundary

PostgreSQL COMMIT visibility, connection loss after COMMIT dispatch, SQLSTATE,
and concurrent lock timing remain `NOT VERIFIED`.
