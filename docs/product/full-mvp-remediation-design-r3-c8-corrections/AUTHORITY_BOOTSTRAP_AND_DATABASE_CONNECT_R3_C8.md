# Authority Bootstrap and Database CONNECT R3-C8 Corrections

## Trust Boundary

The initial trust root is the database deployment boundary:

1. database owner creates the reviewed DDL and dedicated bootstrap login roles;
2. only the deployment/security boundary writes the one-time seed credentials;
3. Runtime capability roles cannot call bootstrap functions;
4. the seed operation is allowed only from the fixed seed login role;
5. two distinct bootstrap operators must approve before root activation;
6. the root issuer session is bound to its backend PID/start time;
7. the first `AUTHORITY_ISSUE` Grant is inserted in the same transaction as
   the root Session and bootstrap completion event;
8. the state changes to `COMPLETE` and a second completion fails.

## Required Operators

```text
elevator_session_bootstrap_seed
elevator_session_bootstrap_initiator
elevator_session_bootstrap_approver
elevator_session_root_issuer
```

Each fixed login role has direct database `CONNECT` and one direct capability
membership; bootstrap approval functions are executable only by their matching
capability. The first root Grant is session-bound and global only because it is
the narrowly scoped bootstrap exception.

## CONNECT Distinction

Database `CONNECT` is checked on the login role at connection establishment.
Schema USAGE and function EXECUTE are checked after `SET ROLE` on the
corresponding capability. The two grants are deliberately independent.

## Failure and Rotation

- A failed bootstrap transaction rolls back to `PREPARED`.
- Repeating completion after `COMPLETE` fails by state check.
- The root Session and root Grant expire after a bounded interval.
- The root issuer can use the root Grant to issue a replacement
  `AUTHORITY_ISSUE` Grant to a newly activated root session; after the root
  session is revoked, deployment must perform a separately authorized recovery.
- Bootstrap approvals are append-only and record role, Principal, backend PID,
  backend start time and database time.

## Residual Boundary

The initial credential delivery, role creation time and root recovery approval
remain deployment operations, not Runtime actions. PostgreSQL execution is
`NOT VERIFIED`.
