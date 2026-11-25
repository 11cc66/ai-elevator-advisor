# Database-Verifiable Session Assertion Design R3-C6

## 1. Assertion

Minimum signed claims:

```text
iss
aud
sub
principal_id
session_id
login_epoch
iat
nbf
exp
jti
database_auth_role
key_id
```

Required checks:

- trusted issuer/key;
- exact audience;
- signature valid;
- current time within nbf/exp;
- session ID/principal/login epoch matching persistent rows;
- assertion ID and digest not replayed;
- DB role claim matches actual session_user;
- assertion issuer/jti not revoked.

## 2. Key Management

Broker signing keys:

- asymmetric preferred;
- private key outside database/application source;
- key ID/version included;
- rotation with overlap;
- revoked key list;
- expired assertion rejected.

The database does not verify external signatures directly. The trusted broker
verifies them, then performs a narrow SECURITY DEFINER `open_trusted_session`
call. The database independently verifies the created TrustedSession/role/epoch
record for every transition.

## 3. Replay Defense

```text
UNIQUE (issuer, assertion_id)
UNIQUE (principal_id, login_epoch)
UNIQUE (db_auth_role)
```

The broker also keeps a nonce replay cache until `exp`.

Copied assertion on a new connection cannot match the expected active
session-bound DB role and session row.

## 4. Dynamic Role Provisioning

A broker-only function may create a random login role:

```sql
CREATE ROLE <session_role> LOGIN NOINHERIT NOSUPERUSER
  NOCREATEDB NOCREATEROLE NOBYPASSRLS
  CONNECTION LIMIT 1;
GRANT CONNECT ON DATABASE <approved_database> TO <session_role>;
GRANT USAGE ON SCHEMA app TO <session_role>;
GRANT elevator_professional_reviewer TO <session_role>
  WITH INHERIT FALSE, SET TRUE;
```

The exact authentication credential/certificate delivery remains
`OD-R3-C6-01`.

## 5. Session Bootstrap Transaction

```text
broker verifies assertion
lock principal/epoch
increment/check login epoch
create role
insert TrustedSession
grant only selected capability
commit
application connects as session role
```

Failure rolls back the DB session row and broker revokes/removes the role.

## 6. Logout

```text
lock session
CAS ACTIVE -> REVOKED
append audit
drop login capability / REVOKE CONNECT
close client connection
commit
```

The transition function checks DB session state before every command, so stale
connections fail even if close is delayed.

