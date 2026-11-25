# TrustedSession Lock Order and CAS R3-C7

Artifact: `TRUSTED_SESSION_LOCK_ORDER_AND_CAS_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. Exact Lock Table

| Object | Transition | Revoke/Epoch | Grant revoke | Hold duration |
|---|---|---|---|---|
| `principal_epoch` | `FOR SHARE` | `FOR UPDATE` | target `FOR UPDATE` | caller transaction |
| `trusted_session` | `FOR SHARE` | `FOR UPDATE` | own active Session through helper | caller transaction |
| `authority_grant` | `FOR SHARE` | n/a | target `FOR UPDATE` | caller transaction |
| policy/review current row | `FOR UPDATE` | n/a | n/a | caller transaction |
| event ledger | append/insert | audit insert | n/a | caller transaction |

## 2. CAS Conditions

Policy:

```text
latest event sequence = expected sequence
current pointer generation unchanged
legal command/state transition
unique (revision, request ID)
```

Professional review:

```text
review state_version = expected derived version
latest event sequence = expected sequence
effective policy ID = expected policy ID
unique (review, request ID)
```

Selection seal:

```text
run state = RUNNING
run mutation_version = expected
one result per candidate
```

Snapshot finalization:

```text
state = DRAFT
mutation_version = expected
deferred final validation succeeds
```

## 3. Event and State Commit

Each transition writes the immutable event and current state in the same
database transaction. A CAS failure rolls back the event insertion. The caller
must re-read using the same request ID rather than inventing a new request.

## 4. Deadline Handling

Recommended deployment settings, subject to `OD-R3-C7-04`:

```text
statement_timeout: bounded per API transaction
lock_timeout: shorter than API deadline
idle_in_transaction_session_timeout: enabled
retry budget: one or two retries only for classified serialization/deadlock
```

No timeout converts a sensitive operation to success. Timeout before commit is
failure; COMMIT unknown requires durable re-read.

## 5. Deadlock Avoidance

- all PrincipalEpoch locks precede Session locks;
- session sets are ordered by `session_id`;
- event/current rows are locked in one order;
- Snapshot creation uses Case -> Seal/Run -> Snapshot row;
- Snapshot child mutation locks Header first;
- no SECURITY DEFINER reads a business row before Session/Epoch/Grant.

Failure to follow this order is a review defect even if a local test happens to
avoid a deadlock.
