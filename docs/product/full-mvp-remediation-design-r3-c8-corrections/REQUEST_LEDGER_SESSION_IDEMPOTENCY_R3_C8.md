# Request Ledger Session Idempotency R3-C8 Corrections

The ledger key remains:

```text
(operation, request_id)
```

Each row stores operation, request hash, scope, Principal, original Trusted
Session, original PrincipalEpoch, result type/id, claim and completion time.

## Semantics

| Case | Result |
|---|---|
| same Session, same payload | return result |
| same Session, different payload | conflict |
| new Session, same Principal/scope/payload/current epoch | return committed result and append replay audit |
| new Session, same Principal/scope/payload/old epoch | conflict |
| different Principal | conflict; never disclose result |
| different Project/scope | conflict |
| different Operation | different ledger key |
| committed request, client lost response | safe replay by same Principal and current epoch |
| concurrent duplicate | one claim; other reports in-progress or returns committed result |
| revoked current Session | rejected before ledger access |

The `command_request_replay_audit_r3` table records original Session, replay
Session, Principal, epoch, request hash and database time. Replay always
revalidates the current Session and AuthorityGrant before returning the prior
result.

The old behavior of silently replaying across Sessions without recording the
new Session is removed.
