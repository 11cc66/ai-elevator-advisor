# Request Ledger Revocation and Recovery R3-C8 R2

## Session Termination Classes

`trusted_session.termination_class` distinguishes:

```text
NONE
NORMAL_CLOSE
NATURAL_EXPIRY
CREDENTIAL_ROTATION
EPOCH_ADVANCE
ADMIN_REVOKE
SECURITY_REVOKE
PRINCIPAL_DISABLED
GRANT_REVOKED
```

The value is written by the controlled termination function and immutable
termination audit.

## Ordinary Replay

The Request Ledger key remains `(operation,request_id)`.

Ordinary cross-Session replay is allowed only when:

```text
same Principal
same current Epoch
same operation scope
same request hash
same result type
original termination class = NORMAL_CLOSE or NATURAL_EXPIRY
```

Every successful replay writes `command_request_replay_audit_r3` with the
original Session, new Session, original termination class, replay policy and
whether result data was disclosed.

The following deny ordinary replay and do not return the old result:

```text
ADMIN_REVOKE
CREDENTIAL_ROTATION
EPOCH_ADVANCE
SECURITY_REVOKE
PRINCIPAL_DISABLED
GRANT_REVOKED
```

## Controlled Recovery

`command_result_recovery_r2` and its approval table provide a separate,
two-approver path:

1. the original Principal requests recovery from a new active Session;
2. the request must still be on the current Epoch;
3. Security Admin approvers must be distinct from the requester and original
   business Principal;
4. two approvals are required;
5. the current same-Principal Session executes a result-only recovery;
6. the recovery is marked `CONSUMED` after one disclosure;
7. replay of the recovery operation is idempotent through the Request Ledger.

`SECURITY_REVOKE` and `PRINCIPAL_DISABLED` are permanently non-recoverable.

## Duplicate Execution Prevention

The original business request remains `COMPLETED`. Recovery returns its stored
`result_id`; it never calls the original business command. The one-time recovery
state plus the normal Request Ledger unique key prevent duplicate effects.

## Unverified

Concurrent sessions, row-lock timing, revocation races and PostgreSQL constraint
behavior are `NOT VERIFIED — DATABASE/RUNTIME NOT AUTHORIZED`.

