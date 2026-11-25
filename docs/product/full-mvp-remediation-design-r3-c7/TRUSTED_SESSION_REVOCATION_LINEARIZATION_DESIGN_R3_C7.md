# Trusted Session Revocation Linearization Design R3-C7

Artifact: `TRUSTED_SESSION_REVOCATION_LINEARIZATION_DESIGN_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. Result

```text
TRUSTEDSESSION REVOCATION RACE: PASS (static protocol)
RUNTIME CONCURRENCY: NOT VERIFIED
```

The race is closed by locking the same durable rows in one global order and
rechecking before the transition commits.

## 2. Global Lock Order

```text
PrincipalEpoch
  -> TrustedSession
  -> AuthorityGrant
  -> policy_current / professional_review / selection owner
  -> event sequence / Snapshot or sealed business rows
```

There is no `UPDATE ... WHERE active` shortcut before these locks.

## 3. Sensitive Transition

`app_private.lock_active_session(text,text)` is `VOLATILE SECURITY DEFINER`. It:

1. selects the TrustedSession joined to PrincipalEpoch;
2. locks both `FOR SHARE`;
3. requires `ts.login_epoch = pe.current_epoch`;
4. requires state ACTIVE, no revocation and current time inside validity;
5. locks one matching AuthorityGrant `FOR SHARE`;
6. returns Session, Principal, Epoch and Grant IDs.

Caller functions then lock their business owner row. Before return/commit they
call `assert_active_session(session_id,principal_id,login_epoch)`.

## 4. Revocation

`app.revoke_trusted_session`:

1. resolves target principal;
2. locks PrincipalEpoch `FOR UPDATE`;
3. locks TrustedSession `FOR UPDATE`;
4. CAS ACTIVE -> REVOKED and writes audit.

`app.advance_principal_epoch`:

1. locks PrincipalEpoch `FOR UPDATE`;
2. locks all principal session rows in session-id order `FOR UPDATE`;
3. revokes active sessions with audit;
4. increments epoch.

`app.revoke_authority_grant` locks the target principal epoch then target grant
row before revocation.

## 5. Four Linear Orders

### Transition acquires shared locks first

The transition may commit first. Revoke waits. This is approved semantics: the
operation became committed before logout.

### Revoke acquires update locks first

The transition blocks and, under READ COMMITTED, its next read sees the new
REVOKED row. It must reject and insert no event.

### Epoch changes first

Old Session remains auditable but fails active-session lookup because the epoch
does not match.

### Old transaction after revocation

An already-held shared lock prevents the new revoke update; if no shared lock
was held, the revoke wins and the final recheck rejects. Time expiry is checked
again at the end, so a long transaction cannot rely only on its initial
timestamp.

## 6. Idempotency

Replay lookup occurs only after active Session/Epoch/Grant locks. The lookup
compares:

- request ID;
- canonical request hash;
- actor principal;
- owner row and decision.

Same request/hash by the same current principal returns the original event.
Different hash, principal or owner conflicts. A revoked session cannot replay
to learn an old event because it fails the initial active-session gate.

## 7. Isolation

The design uses READ COMMITTED plus explicit row locks. It does not claim
serializable isolation. A deadlock caused by an independently coded lock order
is a defect; only `40P01`/`40001` may trigger a bounded retry, and authorization
or validation errors are never retried.

## 8. Boundary

No real PostgreSQL lock, transaction, role, pool or old connection was used.
