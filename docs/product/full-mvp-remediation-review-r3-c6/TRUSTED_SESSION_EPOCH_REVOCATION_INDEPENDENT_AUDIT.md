# Trusted Session / Epoch / Revocation Independent Audit R3-C6

Date: 2026-11-24

## 1. Result

```text
TrustedSession: FAIL
Session Expiry / Revocation: FAIL
Old Connection Protection: FAIL
Finding: REV-R3-C6-P1-03
```

The design separates the correct security concepts and defines a useful normal
path, but it does not serialize a transition against revocation. The original
old-connection attack remains possible at design level.

## 2. Identity Separation

`TRUSTED_SESSION_INSTANCE_EPOCH_REVOCATION_DESIGN_R3_C6.md:7-18` distinguishes:

- database connection `session_user` and its session-bound login role;
- TrustedSession instance;
- business Principal;
- application request;
- principal login epoch.

This is the required separation. It prevents a caller-supplied actor ID from
being the authority source and gives the database a durable session instance to
check.

## 3. Durable State

`TRUSTED_SESSION_INSTANCE_EPOCH_REVOCATION_DESIGN_R3_C6.md:29-68` defines:

- `trusted_session` with principal, login epoch, unique DB auth role, audience,
  issuer, assertion ID/digest, validity, revocation and state;
- `principal_epoch` with one current epoch per principal;
- `session_audit` as an event record.

The database-side check at lines 90-100 includes ACTIVE state, time validity,
absence of revocation, matching DB role and matching current principal epoch.

## 4. Revocation Race

`TRUSTED_SESSION_DDL_R3_C6.md:127-154` implements
`require_active_session` as a `STABLE` function containing a plain `SELECT` of
TrustedSession and PrincipalEpoch. It obtains no row lock.

`TRUSTED_SESSION_DDL_R3_C6.md:71-93` revokes by updating the session row.
The update can commit while another transition transaction still owns the
earlier ACTIVE snapshot.

Atomic interleaving:

```text
T1 transition: require_active_session reads ACTIVE
T2 revoke:     UPDATE ... state='REVOKED'; COMMIT
T1 transition: authorizes, inserts sensitive event; COMMIT
```

Both `transition_policy_review` and
`transition_professional_review` call the unlocked helper
(`POLICY_TRANSITION_DDL_R3_C6.md:76-79`;
`PROFESSIONAL_REVIEW_TRANSITION_DDL_R3_C6.md:36-47`). Their later policy/review
locks do not lock the TrustedSession or PrincipalEpoch rows.

This contradicts the requirement in
`TRUSTED_SESSION_INSTANCE_EPOCH_REVOCATION_DESIGN_R3_C6.md:117-121` that future
transitions be rejected after revocation, including when connection closure is
delayed.

## 5. Expiry and Old Connections

Expiry is checked with `now() < expires_at`, but the same missing lock permits:

- a transition to read a not-yet-expired value and commit after the session is
  expired or revoked;
- epoch advancement to commit between the guard read and event insertion;
- a reused pool connection to authorize using an earlier row version.

The design's claim that old connections fail after logout is correct only if
the guard row is held against a concurrent state change, or state is rechecked
after acquiring a lock. That condition is absent.

No live connection, database role, pool or old-connection behavior was tested.
Those controls remain `NOT VERIFIED`.

## 6. Required Correction

1. In each sensitive transition transaction, lock the exact TrustedSession row
   and its PrincipalEpoch row `FOR SHARE` before authorization.
2. Revocation and epoch advancement must lock the same rows `FOR UPDATE`.
3. Do not place the only lock inside a `STABLE` helper. Either inline it in the
   transition or make a controlled locking helper whose volatility and
   transaction semantics are valid.
4. Recheck ACTIVE, revocation, expiry and epoch after any authority/review lock
   and immediately before event insertion.
5. Return no event and commit no state if the session changed.
6. Define a serial result for concurrent logout versus transition.

Acceptance requires an isolated database concurrency test proving exactly one
serial order: either the transition completes before revocation or it is
rejected after revocation; no event may commit after revocation wins.

## 7. Required Test Coverage

`TRUSTED_SESSION_THREAT_MODEL_AND_REPLAY_TESTS_R3_C6.md:24-37` appropriately
lists SESS-01..12. None was executed. Priority cases are SESS-03 (revoked
session over an open connection), SESS-04 (old epoch), SESS-06 (shared role),
SESS-09 (cross-user pool reuse) and SESS-10 (concurrent logout/transition).

## 8. Runtime Boundary

This audit is static. No PostgreSQL connection, role creation, login,
trusted-session creation, revocation, expiry, transaction, pool or Runtime test
was performed. Deployment of the identity broker remains an open decision and
cannot be claimed verified.
