# Bootstrap Recovery Attempt Sequence R4

## Entity Model

| Entity | Identity | Responsibility |
|---|---|---|
| Bootstrap Generation | `(bootstrap_id, bootstrap_generation)` | Immutable root-generation history |
| Recovery Attempt | `recovery_id` plus `(bootstrap_id, from_generation, attempt_sequence)` | One approval/issuance attempt |
| Sequence Counter | `(bootstrap_id, bootstrap_generation)` | Allocates monotonic Attempt sequence |
| Recovery Approval | `(recovery_id, operator_kind)` | Binds approvals to the exact Attempt |
| Active Attempt | Partial unique index | At most one PENDING/APPROVED Attempt per Generation |
| Issuance Attempt | `(bootstrap_id, bootstrap_generation)` | Tracks root issuance for the resulting Generation |

Historical Attempts are append-only from the perspective of normal flow.
Creating a new Attempt does not update a DENIED, LOCKED or EXECUTED Attempt.

## Sequence Algorithm

`next_bootstrap_recovery_sequence_r4` uses one SQL statement:

```sql
INSERT ... VALUES (..., 2, ...)
ON CONFLICT (bootstrap_id,bootstrap_generation) DO UPDATE
SET next_sequence = next_sequence + 1
RETURNING next_sequence - 1;
```

Properties:

- first Attempt is 1;
- the counter row remains at next value 2 after the first allocation;
- concurrent conflicting allocators serialize on the primary key upsert;
- rollback also rolls back the counter increment, preventing unexplained gaps;
- caller cannot provide the sequence;
- a sequence is not reset when an Attempt becomes terminal;
- Generation advancement creates a separate counter identity.

## Active Attempt Rule

```sql
CREATE UNIQUE INDEX bootstrap_recovery_one_active_attempt_r4
ON app.bootstrap_recovery_r2 (bootstrap_id,from_generation)
WHERE state IN ('PENDING','APPROVED');
```

TERMINAL history is intentionally outside the predicate. DENIED, LOCKED and
EXECUTED Attempts do not block a later valid Attempt for the same Generation
when the current Lifecycle state permits it.

For ROTATION, Begin revalidates the currently issued Root Session, Root Grant,
Expiry and Grant revocation state. Both target Principal and target role must
differ from the current root identity. The current backend identity must be
present in `pg_stat_activity`; missing identity aborts the transaction.
Initiators and Approvers must be ACTIVE at the Principal layer. A target
Principal must not be inactive or reuse any existing Bootstrap Operator
Principal/role identity.
Execute inserts or locks the target Principal, requires `ACTIVE`, and requires
initial Principal Epoch 1 before superseding the old Generation.
It does not create `trusted_principal` or `principal_epoch` rows; target
identity provisioning remains an external, separately governed operation.
Execute also rechecks that both approval Operator rows remain enabled.

Deny excludes the initiating Principal, current root and target root. Execute
rechecks that Lifecycle belongs to the same current root identity and rejects a
target role equal to the current role.

## State Matrix

| Current Lifecycle/Attempt | Begin allowed | Required outcome |
|---|---|---|
| No active Attempt | Yes | New PENDING Attempt, next sequence |
| PENDING Attempt exists | No | Concurrency conflict |
| APPROVED Attempt exists | No | Must Execute or terminate the current object first |
| DENIED Attempt | Yes | New Attempt and two-approval cycle |
| LOCKED Attempt | Yes | New Attempt and two-approval cycle |
| ROOT_ISSUANCE_PENDING, no active Attempt | Yes | Recovery from interrupted issuance |
| EXECUTED old Attempt | No reuse | New Generation controls the next action |
| Old Generation after rotation | No | Generation/stale-state rejection |

## Concurrency Vectors

### Two concurrent Begin

Both lock the same Lifecycle row. The first inserts PENDING and commits. The
second sees the active Attempt and rejects. The partial unique index is the
database backstop if the state check is bypassed.

### Denied then concurrent new Begin

The denied Attempt is terminal. The first new Begin allocates the next sequence
and creates PENDING. The second sees that active Attempt and rejects.

### Two concurrent Approve

Approval rows are bound to `recovery_id` and `operator_kind`. The exact Attempt
row lock and unique keys prevent the same operator or backend from counting as
two approvals.

### Two concurrent Execute

The Attempt row is locked. Exactly one transaction can change APPROVED to
EXECUTED and advance the Generation. The other observes stale/completed state
or a completed Request Ledger replay.

### Response loss

Ledger replay occurs before current state checks and returns the stored
APPROVED, LOCKED or Generation result without executing a second business
operation.

### Delayed old Attempt

An old APPROVED Attempt is always the current active Attempt, so a newer same-
Generation Attempt cannot exist concurrently. After the old Attempt EXECUTED or
became terminal, a new request against it is rejected by state/generation
checks or returns its original Ledger result.

## Open Recovery Decisions

No maximum Attempt count, emergency override, break-glass authority or
credential-custody policy is approved by this design. Those decisions remain
OPEN. Until approved, the design continues to require normal two-approval flow
and Fail Closed behavior.

## Runtime Boundary

Actual PostgreSQL lock ordering, unique-index behavior, deadlock selection and
concurrent commit visibility remain `NOT VERIFIED`.
