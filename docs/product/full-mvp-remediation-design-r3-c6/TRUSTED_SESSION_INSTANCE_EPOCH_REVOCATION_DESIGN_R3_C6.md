# Trusted Session Instance, Epoch and Revocation R3-C6

Status:

```text
SECURITY DESIGN
NOT IMPLEMENTED
```

## 1. Identity Separation

```text
Database connection session_user
  identifies a per-session PostgreSQL login role

TrustedSession
  binds that role to one Principal/session instance

Business Principal
  identifies the natural person/service authority

Application Request
  is authorized only while the TrustedSession is ACTIVE
```

## 2. Session Schema

```sql
CREATE TABLE app.trusted_session (
  session_id text PRIMARY KEY,
  principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  login_epoch bigint NOT NULL,
  db_auth_role text NOT NULL UNIQUE,
  audience text NOT NULL,
  issuer text NOT NULL,
  assertion_id text NOT NULL,
  assertion_digest text NOT NULL,
  issued_at timestamptz(6) NOT NULL,
  not_before timestamptz(6) NOT NULL,
  expires_at timestamptz(6) NOT NULL,
  revoked_at timestamptz(6),
  revocation_reason text,
  state text NOT NULL CHECK (state IN ('ACTIVE','REVOKED','EXPIRED')),
  configured_peer text,
  created_at timestamptz(6) NOT NULL,
  UNIQUE (principal_id, login_epoch),
  UNIQUE (issuer, assertion_id),
  CHECK (expires_at > issued_at),
  CHECK (not_before >= issued_at)
);

CREATE TABLE app.principal_epoch (
  principal_id text PRIMARY KEY REFERENCES app.trusted_principal(id),
  current_epoch bigint NOT NULL CHECK (current_epoch > 0),
  updated_at timestamptz(6) NOT NULL
);

CREATE TABLE app.session_audit (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES app.trusted_session(session_id),
  action text NOT NULL,
  actor_role text NOT NULL,
  reason text,
  occurred_at timestamptz(6) NOT NULL
);
```

Session IDs are random 256-bit values encoded as lowercase UUID/opaque text.
`db_auth_role` is random and unique.

## 3. Broker Authentication

The external trusted identity broker:

1. authenticates the user and audience;
2. verifies the signed assertion and its nonce/replay cache;
3. obtains the current login epoch;
4. creates one session-bound PostgreSQL login role;
5. calls `open_trusted_session` under a broker-only function;
6. gives only that role credential to the chosen connection;
7. forbids cross-user connection reuse.

The transition function never trusts an actor ID supplied by the caller.

## 4. Transition Gate

Inside the Review function:

```text
session = trusted_session
WHERE db_auth_role = session_user
  AND state='ACTIVE'
  AND now() >= not_before
  AND now() < expires_at
  AND revoked_at IS NULL
  AND login_epoch = principal_epoch.current_epoch
```

Missing/ambiguous/revoked/stale row -> reject.

The matching role also must be the only active role for that session. Existing
old connections fail after logout because their session row is revoked; the
check is DB-side and independent of pool cleanup.

## 5. Logout and Revocation

`revoke_trusted_session(session_id,reason)` is callable only by the broker
function:

- locks session row;
- CAS `ACTIVE -> REVOKED`;
- sets `revoked_at/reason`;
- appends an audit event;
- optionally increments epoch.

The broker closes the client connection. Even if closure is delayed, the
DB-level state check rejects future transitions.

## 6. Expiry

`expire_trusted_sessions()` may be a maintenance function owned by a dedicated
non-login role:

- sets `ACTIVE -> EXPIRED` after `expires_at`;
- never touches policy/content;
- writes audit evidence.

Runtime cannot execute it unless separately approved.

## 7. Open Decision

`OD-R3-C6-01` selects the actual broker, assertion signature/algorithm,
credential delivery and HA topology. These must be approved before
implementation.

