# Bootstrap Recovery Transaction Persistence R4

## Decision

R4 uses the controlled structured-result pattern:

```text
validate identity
-> lock the recovery attempt
-> claim request
-> perform all state/Event/Ledger writes
-> complete original operation
-> return structured result
-> COMMIT
```

An expected business expiry is a committed outcome, not an exception used to
pretend that state persisted.

## Ownership of Writes

| Write | Owner |
|---|---|
| Claim original request | Approve or Execute caller |
| Recovery LOCKED | `lock_expired_root_change_r4` |
| Lifecycle LOCKED | `lock_expired_root_change_r4` |
| LOCKED Event | `lock_expired_root_change_r4` |
| Complete Approve Ledger | `bootstrap_approve_root_change_r4` |
| Complete Execute Ledger | `bootstrap_execute_root_change_r4` |
| Structured result | Original caller |

The helper never guesses the caller's Ledger operation name. It completes no
Ledger row. This removes the prior `BOOTSTRAP_LOCK_EXPIRED_ATTEMPT` mismatch.

## Transaction Timeline

| Case | Durable outcome | Commit | Replay |
|---|---|---|---|
| Approval valid | Recovery APPROVED; Lifecycle RECOVERY_APPROVED/ROTATION_PENDING; approval Event; Ledger APPROVED | Yes | Stored approval |
| Approval already expired | Recovery LOCKED; Lifecycle LOCKED; LOCKED Event; Approve Ledger LOCKED | Yes | LOCKED |
| Approval expires before Execute | Recovery LOCKED; Lifecycle LOCKED; LOCKED Event; Execute Ledger LOCKED | Yes | LOCKED |
| Response lost after Approve commit | Same durable outcome | Already committed | Ledger replay first |
| Response lost after Execute commit | Recovery EXECUTED; new Generation; Execute Ledger stores `GENERATION:N+1` | Already committed | Same generation result |
| DB error before COMMIT | Entire transaction rolls back | No | Original request may retry |
| Audit Event fails | Entire transaction rolls back | No | Retry, no invented success |
| Ledger completion fails | Entire transaction rolls back | No | Retry |
| Reader during uncommitted work | PostgreSQL MVCC sees prior state | N/A | Must not infer success |
| Reader after LOCKED commit | Recovery and Lifecycle both LOCKED | Yes | Query/replay structured result |

## Failure Classification

Expected approval expiry:

- SQLSTATE is not invented by raising a business exception.
- Recovery and Lifecycle become LOCKED in the normal transaction.
- Audit Event and original Ledger completion are required.
- Caller receives `LOCKED`.

Authorization, stale state and concurrency conflicts:

- Raise a real SQLSTATE and roll back.
- Never substitute a LOCKED response for a permission or database failure.

Database, Audit or Ledger error:

- Bubble the error and roll back all state.
- Never use `EXCEPTION WHEN OTHERS` to return LOCKED or success.

## Idempotency and Concurrency

The Request Ledger remains the source of replay identity. Approve and Execute
claim it before inspecting terminal state:

```text
Request ID + request hash + actor + operation
```

The recovery row is locked with `FOR UPDATE` before the claim. A concurrent
Approve or Execute therefore observes either the pre-transaction state or the
committed result. The LOCKED Event is appended only by the transaction that
transitions PENDING/APPROVED to LOCKED.

## Anti-Patterns Rejected

- UPDATE LOCKED followed by uncaught `RAISE`.
- `EXCEPTION WHEN OTHERS THEN RETURN`.
- Completing a fabricated helper operation in the Ledger.
- Returning LOCKED before COMMIT.
- Treating a failed Audit or Ledger write as an acceptable warning.
- Claiming that PL/pgSQL is an autonomous-transaction facility.

## Runtime Boundary

The SQLSTATE emitted by PostgreSQL, actual COMMIT visibility, constraint
timing, lock wait, deadlock and connection-loss behavior remain
`NOT VERIFIED — DATABASE/RUNTIME NOT AUTHORIZED`.
