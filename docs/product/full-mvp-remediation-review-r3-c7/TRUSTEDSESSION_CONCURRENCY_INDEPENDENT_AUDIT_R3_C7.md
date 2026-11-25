# TrustedSession Concurrency Independent Audit R3-C7

## Result

```text
Lock-order race closure: IMPROVED / PARTIALLY VERIFIED STATICALLY
Session instance binding: FAIL
Shared-role rejection: FAIL
Old-connection protection: NOT VERIFIED
```

## Positive Static Findings

- `lock_active_session` locks PrincipalEpoch and TrustedSession in that order.
- It locks a matching AuthorityGrant `FOR SHARE`.
- Revocation locks PrincipalEpoch then TrustedSession `FOR UPDATE`.
- Epoch advancement orders sessions by `session_id`.
- Transition functions recheck the active session before return.
- Policy/ProfessionalReview replay appears before stale sequence rejection.

The specific C6 revoke-vs-transition interleaving that did not lock the session
row is materially improved.

## P1-03 Finding

`open_trusted_session` validates only:

```text
rolcanlogin
NOT rolsuper
NOT rolbypassrls
```

It accepts `elevator_runtime_web`, `elevator_runtime_worker`, or any other
shared login role. It does not require a per-session role marker, connection
limit, capability membership, absence of owner membership, or backend/session
nonce. `lock_active_session` therefore cannot distinguish two connections using
the same role.

Consequences:

- SESS-06 shared runtime role is not rejected.
- A copied session-bound role credential can be used by another backend.
- The View predicates compare `session_user` to `db_auth_role`, so they cannot
  distinguish two backends with that role.

## Concurrency Matrix

| Order | Analysis |
|---|---|
| Transition share locks first | Revoke waits; transition may commit first |
| Revoke update locks first | Transition waits and must observe revoked state |
| Epoch change first | Old session fails epoch comparison |
| Two writes through one shared role | Not serialized as distinct sessions |
| Cross-principal revokes | Potential deadlock path; no live test performed |

The lock design is a good start, but the identity subject is a role rather than
a unique connection/session instance.

## Required Acceptance

Add a broker-created session-role registry with at least:

- role ID and TrustedSession ID;
- role connection limit 1;
- one backend identity and session nonce;
- no owner/migrator membership;
- exact capability membership;
- role marked session-ephemeral;
- protected broker-only provisioning and cleanup.

Then execute RACE-01..12 against an authorized isolated PostgreSQL instance.
