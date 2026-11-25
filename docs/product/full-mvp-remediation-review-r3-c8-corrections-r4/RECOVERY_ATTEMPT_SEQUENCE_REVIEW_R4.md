# Recovery Attempt Sequence Review R4

## Original Finding

```text
REV-R3-R3-P2-02:
RESOLVED — INDEPENDENT STATIC REVIEW
```

The original R3 unique `(bootstrap_id,from_generation)` block is removed.

## Attempt Model

| Property | Independent result |
|---|---|
| Permanent Attempt identity | `recovery_id` plus unique `(bootstrap_id,from_generation,attempt_sequence)` |
| Sequence source | `next_bootstrap_recovery_sequence_r4` atomic upsert |
| First sequence | 1 |
| Sequence reset on terminal state | No |
| Active uniqueness | PENDING/APPROVED partial unique |
| Terminal history | DENIED/LOCKED/EXECUTED remain outside active predicate |
| Approval binding | `recovery_id` |
| Issuance binding | `(bootstrap_id,bootstrap_generation)` |
| Generation CAS | Lifecycle row lock plus old Generation checks |

All 46 submitted R4 mutations reproduce. Attempt-specific mutations
`R4-ATT-01` through `R4-ATT-10` and Recovery mutations
`R4-REC-01` through `R4-REC-12` were independently replayed.

## Original Denied/Locked Scenarios

```text
A1 PENDING -> DENIED, Lifecycle LOCKED
A2 Begin -> sequence 2, PENDING
PASS

A1 PENDING/APPROVED -> LOCKED, Lifecycle LOCKED
A2 Begin -> sequence 2, PENDING
PASS
```

The partial unique predicate admits terminal rows and rejects two active rows.

## New Finding — Expired Active Attempt

```text
REV-R4-IND-P2-02
Severity: P2
```

At Complete DDL lines 15985-15992, Begin checks:

```text
PENDING/APPROVED Attempt exists -> raise
```

without evaluating `approval_expires_at`. Therefore an already-expired Attempt
that has not yet been touched by an old Approve/Execute/Deny request prevents
the immediate next Recovery.

Required correction:

1. detect and lock an expired active Attempt in Begin;
2. persist its LOCKED/Event transition atomically;
3. apply a defined Ledger policy for the stale active request;
4. allocate the next sequence and insert the new Attempt;
5. preserve the historical row unchanged except its terminal transition.

## Rotation Authorization Gap

Begin performs strong current Root checks at lines 15922-15951. Execute does
not repeat them. See `R4_ADDITIONAL_BUILD_ONLY_CHANGES_REVIEW.md` finding
`REV-R4-IND-P2-01`.

## Verification Boundary

Actual concurrent upsert behavior, partial-index locking, deadlock selection
and transaction visibility remain `NOT VERIFIED`.
