# TrustedSession Revocation Adversarial Tests R3-C7

Artifact: `TRUSTED_SESSION_REVOCATION_ADVERSARIAL_TESTS_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. Status

```text
TEST DESIGN: COMPLETE
TEST EXECUTION: NOT EXECUTED — DATABASE NOT AUTHORIZED
```

## 2. Race Matrix

| ID | Interleaving | Required final behavior |
|---|---|---|
| `RACE-01` | Transition obtains shared locks, then revocation starts | Transition commits; revocation waits and commits after |
| `RACE-02` | Revocation commits, then transition starts | Transition rejects, no event |
| `RACE-03` | Epoch advances before Session read | Epoch mismatch rejects |
| `RACE-04` | Logout races Policy APPROVE | Exactly one serial order; no post-revoke approval |
| `RACE-05` | Old DB connection continues after logout | ACTIVE gate rejects every new sensitive request |
| `RACE-06` | Existing transaction snapshot started before revoke | Share lock orders or final recheck rejects |
| `RACE-07` | Session expires during long transaction | Final validity check rejects |
| `RACE-08` | Same request ID and hash | Original event returned once |
| `RACE-09` | Same request ID, different hash | Conflict |
| `RACE-10` | Original request ID replayed after sequence advanced | Replay returned, not stale-sequence error |
| `RACE-11` | Wrong lock order injected | Detected deadlock; design fails conformance |
| `RACE-12` | AuthorityGrant revoked concurrently | Transition commits first or rejects |

## 3. Setup

Use two or more independent PostgreSQL connections with distinct authenticated
session roles:

- reviewer A session;
- broker session;
- security-admin session;
- auditor session.

Use barriers or `pg_sleep` between explicit lock and event insert so the
interleaving is deterministic. Do not rely on random timing.

## 4. Assertions

For every rejected path:

- SQLSTATE is authorization/stale/conflict, not generic success;
- no immutable Event row was inserted;
- no `policy_current` or review state advanced;
- audit contains the revocation fact;
- replay by a revoked identity returns authorization failure, not old event
  content;
- transaction retry never duplicates event sequence.

For an accepted transition-first path:

- transition event and state commit are atomic;
- revocation audit starts after transition commit;
- old connection fails the next request.

## 5. Runtime Boundary

No live role, database, transaction or connection was created. This matrix is
ready for the future isolated DB test gate only.
