# Request Ledger Idempotency and Recovery R3

Ordinary cross-Session replay is allowed only for `NORMAL_CLOSE` and
`NATURAL_EXPIRY`, at the same Principal, Epoch, scope, Request ID and payload.
Security/admin revocation, credential rotation, Epoch advance, Principal disable
and Grant revocation remain denied.

R3 adds `UNIQUE(operation,command_request_id)` to
`command_result_recovery_r2`. Only one recovery record can exist for an original
Request.

Approval and Execution perform Request Ledger replay before checking terminal
Recovery state:

```text
current Session validation
 -> operation authorization
 -> Request Ledger lookup / replay
 -> Recovery state check
 -> approval or one-time result disclosure
 -> audit/consume
 -> commit
```

Therefore:

- lost approval response returns the stored approval result;
- lost execution response returns the stored result;
- duplicate recovery creation is blocked by the Request unique constraint;
- security-revoked or disabled-Principal results remain permanently blocked;
- two independent approvals are still required.

Concurrent approvals serialize on the Recovery row. Actual PostgreSQL locking
and rollback behavior remains `NOT VERIFIED`.
