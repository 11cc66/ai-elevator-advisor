# Trusted Session and Authority Protocol R3-C8

## 1. Connection Binding

Session login roles are unique, broker-registered roles with connection limit
one. A role is not accepted merely because it can log in.

The `session_role_registry` stores:

- role name;
- role kind;
- exact capability role;
- one-use activation token digest;
- lifecycle state;
- assigned Session ID.

The registry is written only by the identity broker through a SECURITY DEFINER
function.

## 2. Session Creation

```text
signed broker assertion
  -> session_role_registry AVAILABLE row
  -> one-time activation token digest
  -> open_trusted_session
  -> TrustedSession PROVISIONED
  -> registry ASSIGNED
```

The broker must validate the signed assertion before invoking the database
function. The database validates the registered role's attributes, connection
limit, capability membership, exact registry row and PrincipalEpoch.

## 3. Activation

The session-bound role calls `activate_trusted_session(session_id,token)`:

1. `session_user` must equal the role assigned to the Session.
2. The registry must be ASSIGNED to that Session.
3. The activation token digest must match.
4. The Session must not be expired.
5. The database records `pg_backend_pid()` and `pg_stat_activity.backend_start`.
6. It sets `aiea.session_binding` to the Session ID.
7. `TrustedSession.binding_state` becomes ACTIVE.

The activation token is one-use at the state-transition level. A copied role
credential cannot activate a second backend after the first successful
activation. Role connection limit one is an additional control, never the sole
proof.

## 4. Request Gate

Every controlled function calls `lock_current_session`:

- session role is `session_user`;
- binding state ACTIVE;
- backend PID matches;
- backend start time matches;
- session GUC matches;
- Epoch matches;
- expiry and revocation are current.

It then locks an exact AuthorityGrant by:

- `session_id`;
- principal;
- capability;
- project scope;
- policy/revision scope;
- subject-principal scope when required.

The grant is `FOR SHARE`; revocation and epoch changes lock the same session and
grant rows with update locks in the global order.

Grant identity deliberately separates two Principals:

- `principal_id` is the Session principal that receives the capability;
- `subject_principal_id` is present only for `SESSION_AUDIT` and
  `AUTHORITY_AUDIT`, where it names the Principal whose data may be audited.

`object_scope` is one of `GLOBAL`, `PROJECT`, `POLICY` or `PRINCIPAL`.
Ordinary business grants are `PROJECT`, `POLICY` or explicitly `GLOBAL`;
ordinary capabilities cannot carry a subject Principal. A project-scoped grant
matches only that project. A policy-scoped grant must name the policy and, when
revision-bound, the exact revision. A global grant is created only by an
explicit security decision and is still bound to the recipient Session and
Principal.

## 5. Logout / Revocation

The broker locks:

```text
PrincipalEpoch FOR UPDATE
  -> TrustedSession FOR UPDATE
  -> AuthorityGrant rows FOR UPDATE
  -> session_role_registry FOR UPDATE
```

It sets Session state REVOKED, retires the role, revokes grants and appends
audit. The client connection is closed after commit. An already-open backend
fails the next request because its bound Session/role/grant is no longer active.

## 6. Epoch Change

Epoch advancement locks the PrincipalEpoch first, then all Sessions and their
grants, revokes/retires them, increments the epoch and audits the change.

## 7. Linearization

| Order | Result |
|---|---|
| Transition gets Session/Grant share locks first | transition may commit; revoke waits |
| Revoke gets update locks first | transition waits, sees revoked state and rejects |
| Epoch advances first | stale epoch rejects |
| Request replays after first commit | same request/hash returns prior result |
| Request ID reused with different hash/scope | conflict |

Connection identity and request identity are separate:

- the role/registry/backend binding proves the caller instance;
- the Request Ledger proves idempotent operation identity.
