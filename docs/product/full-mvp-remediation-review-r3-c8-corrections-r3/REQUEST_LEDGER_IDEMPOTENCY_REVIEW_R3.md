# Request Ledger Idempotency Review

## Positive Evidence

- `command_result_recovery_single_request_r3` enforces one Recovery per original
  Request.
- Approval and Execute perform Request Ledger replay before terminal-state
  checks.
- Ordinary cross-Session replay is limited to NORMAL_CLOSE/NATURAL_EXPIRY.
- Security revocation and disabled Principal remain permanently blocked.
- R3 result recovery consumes one stored result and does not execute the
  original business command.

## Remaining Boundary

No PostgreSQL Runtime evidence exists for concurrent approval/execute, unique
constraint races, row-lock ordering or replay after rollback.
