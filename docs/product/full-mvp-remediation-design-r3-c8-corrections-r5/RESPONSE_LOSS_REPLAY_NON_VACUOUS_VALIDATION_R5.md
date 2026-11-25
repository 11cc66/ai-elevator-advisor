# Response-Loss Replay Non-Vacuous Validation R5

## Invalid R4 Vector

R4 contained:

```text
None == None
```

That comparison is removed. It proved neither Ledger presence nor single
execution.

## R5 Durable Replay Model

The R5 offline model performs:

```text
request_id = req-response-loss-001
first execution commits GENERATION:2
Ledger row count becomes 1
business transition count becomes 1
Event count becomes 1
client is marked as response-lost
same request ID replay reads the existing Ledger result
```

Observed non-NULL result:

```text
request_id:          req-response-loss-001
first_result:        GENERATION:2
replay_result:       GENERATION:2
ledger_rows:         1
business_transitions:1
event_count:         1
```

The vector passes only when all values are non-NULL, results match, and counts
remain exactly one.

## Public SQL Replay Order

Approve and Execute claim/lock the Request Ledger before current-state rejection.
A completed Ledger row is returned before attempting a second state transition.
The Ledger identity includes operation, request ID, request hash, bootstrap
Generation, Actor role and Actor Principal.

## Cases Distinguished

| Case | Required behavior |
|---|---|
| First execution fails before COMMIT | Ledger claim and mutations roll back; retry may execute |
| First execution commits, response lost | same request returns stored result; no second Effect |
| Same request, changed hash/actor | conflict |
| Different request ID | cannot read the first request's result |
| Old Attempt delayed retry | rejected by current state/Generation |
| Revoked ordinary Session | follows separately approved replay policy; not silently treated as success |

Cross-session recovery is not approved by R5 and remains governed by the Open
Decision and existing restricted recovery protocol.

## Scope

This is an offline state model, not a two-connection PostgreSQL execution. COMMIT
dispatch loss, connection loss, lock timeout and SQLSTATE remain `NOT VERIFIED`.

