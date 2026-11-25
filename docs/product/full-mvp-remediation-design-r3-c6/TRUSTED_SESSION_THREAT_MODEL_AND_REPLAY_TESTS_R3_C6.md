# Trusted Session Threat Model and Replay Tests R3-C6

## 1. Threats

| Threat | Control |
|---|---|
| Caller supplies another actor ID | Function has no actor parameter; actor derived from TrustedSession |
| Shared runtime role impersonates users | Shared role rejected; session-bound role required |
| Stolen assertion replayed | signature, audience, exp, jti, session binding, unique assertions |
| Old connection survives logout | TrustedSession active check on each call |
| Cross-user connection pool reuse | one role per session, connection limit 1, no pool reuse |
| Role inherits owner | NOINHERIT; owner membership prohibited and introspected |
| Login epoch rollback | principal epoch monotonic and locked on session create/revoke |
| Revoked authority remains cached | AuthorityGrant expiry/revocation checked every call |
| Cross-project grant | exact project/object scope |
| Caller chooses target state | closed command matrix |
| Concurrent approval | Review lock + unique sequence/state version |
| Replay request after event | unique request/hash |
| Policy self-approval | author principal differs from approver |
| Policy replaced | immutable content digest/event-only state |

## 2. Required Test Matrix

| ID | Scenario | Expected |
|---|---|---|
| SESS-01 | Active session transition | accept |
| SESS-02 | Expired session | reject |
| SESS-03 | Revoked/logout session over open connection | reject |
| SESS-04 | Old epoch after relogin | reject |
| SESS-05 | Assertion cloned to second DB role | reject |
| SESS-06 | Shared runtime role | reject |
| SESS-07 | Duplicate assertion jti | reject |
| SESS-08 | Wrong audience/issuer | reject |
| SESS-09 | Cross-user pool connection | broker/DB binding reject |
| SESS-10 | Concurrent logout and transition | serialized; no transition after revoke commit |
| SESS-11 | Key rotation overlap | valid old key until revoke, then reject |
| SESS-12 | Principal/session mismatch | reject |

## 3. Policy Tests

| ID | Scenario | Expected |
|---|---|---|
| POL-01 | Author creates draft | accept |
| POL-02 | Author approves own policy | reject |
| POL-03 | Different authorized approver approves | one event |
| POL-04 | Duplicate approval | replay/conflict, one event |
| POL-05 | Stale policy event | CAS reject |
| POL-06 | Policy event UPDATE/DELETE/TRUNCATE | reject |
| POL-07 | Supersede approved policy | new immutable event |
| POL-08 | Effective policy query | exactly one |
| POL-09 | Approval lacks authority | reject |
| POL-10 | Policy digest mismatch | reject |

## 4. Runtime Boundary

Database behavior remains unverified until an authorized isolated DB test.

