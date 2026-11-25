# Root Principal Binding R3-C8 R2

## Identity Chain

```text
bootstrap_state_r3
  root_principal_id
  root_role_name
  root_operator_kind = ROOT
  bootstrap_generation
       -> bootstrap_generation_r2
       -> bootstrap_operator_r3(role_name, ROOT, principal_id)
       -> bootstrap_lifecycle_r2
       -> bootstrap_approval_r2
       -> bootstrap_root_session_r2
       -> trusted_session(session_id, principal_id, db_auth_role)
       -> authority_grant(id, session_id, principal_id)
       -> bootstrap_root_grant_r2
       -> bootstrap_event_r2
```

## Enforced Equality

`bootstrap_complete_root_r3` rejects unless:

```text
state.root_role_name = root_operator.role_name = session_user
state.root_principal_id = root_operator.principal_id
state.root_principal_id = root_session.principal_id
state.root_principal_id = root_grant.principal_id
root_grant.session_id = root_session.session_id
root_grant.issuer_principal_id = root_session.principal_id
state.bootstrap_generation = lifecycle/approval/grant generation
```

The two approvals must be present, distinct and different from the Root
Principal.

## Composite Controls

- `bootstrap_operator_identity_unique_r2` establishes the role/kind/Principal
  identity key.
- `bootstrap_state_root_operator_fk_r2` binds state to that operation.
- `trusted_session_id_principal_unique_r2` makes the Session identity exact.
- `bootstrap_root_session_identity_unique_r2` binds Session, Principal and
  Generation.
- `authority_grant_id_session_principal_unique_r2` binds Grant, Session and
  recipient.
- `bootstrap_root_grant_r2` checks recipient equals issuer and links the Grant
  to the Root Session.
- Deferred composite FKs resolve the intentional lifecycle/session/grant cycle
  in one transaction.

## Rejected Counterexamples

1. Root Role A completes Principal B's Bootstrap.
2. Root Operator A is paired with state Principal B.
3. Root Session B is paired with Root Operator A.
4. Grant recipient differs from the state Principal.
5. Grant session differs from the Root Session.
6. Grant issuer differs from the Root Session Principal.
7. Initiator and Approver use the same Principal.
8. An Approval Principal equals the Root Principal.
9. Session Epoch or Bootstrap Generation differs.
10. Completed request retries with another Principal.

Static SQL evidence does not prove PostgreSQL behavior; database validation
remains unauthorized.
