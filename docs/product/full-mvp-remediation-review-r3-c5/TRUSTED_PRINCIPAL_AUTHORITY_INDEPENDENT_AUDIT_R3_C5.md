# Trusted Principal and Authority Independent Audit

Date: 2026-11-24

Results:

```text
Trusted Principal: BLOCKED
AuthorityGrant: PASS
Closed Transition Matrix: PASS
Policy Revision Binding: FAIL
```

## 1. Caller Inputs

The function no longer accepts:

```text
p_actor_id
p_new_state
```

This materially improves the C4 design.

The command and expected policy are still caller inputs but are treated as a
command/CAS expectation, not as trusted identity or final state.

## 2. session_user

The function derives:

```text
session_role = session_user
principal = trusted_principal WHERE db_login_role = session_user
```

This works only if all of the following external properties are true:

- login roles are genuinely per-principal;
- credentials are available only to the trusted broker;
- the broker binds user authentication to that role;
- no cross-user connection pooling occurs;
- logout revokes/closes the principal session immediately.

The database schema verifies none of these session-instance facts. There is no
session/assertion table, backend session ID, login epoch, audience, revocation
epoch or request-to-session binding.

## 3. Stale Session Counterexample

```text
1. Principal A authenticates and opens DB connection C.
2. A logs out of the application session.
3. C is returned to a stale/incorrect pool or remains open.
4. A stale client calls the transition function with a new request_id.
5. TrustedPrincipal A is still ACTIVE and AuthorityGrant A is still valid.
6. The function accepts the event.
```

Without a database-visible session instance, the design cannot reject step 6.
Opening credentials only in broker is an implementation promise and remains
`OD-R3-C5-01`.

## 4. AuthorityGrant

Positive design:

- principal FK;
- authority code;
- project/object/policy scope;
- valid-from/until;
- revocation;
- issuer/evidence text;
- function selects a concrete grant and stores its ID.

Remaining gaps:

- `issued_by_principal_id` has no FK;
- revocation through UPDATE conflicts with “append-only” claims;
- no exact table owner/DML grants;
- no defined grant provisioning/approval workflow;
- `valid_until NULL` means indefinite grants; whether allowed is not explicit.

These are P2 privilege/authority constraints, not a direct privilege bypass in
the static design.

## 5. Closed Transition Matrix

The matrix is complete and closed for the listed commands:

```text
SUBMIT
APPROVE
REJECT
RETURN
RESUBMIT
INVALIDATE
EXPIRE
```

Unlisted state/command pairs reject. Terminal states require a new Review.
Self-approval is denied. Reviewer/policy-author separation is explicit.

## 6. Policy Revision Binding

The event FK to the exact Review policy is structurally sound, but approval
evidence is not:

- no PolicyReviewEvent table DDL;
- no state/sequence/unique/CAS constraints;
- no author/approver principal FKs;
- no immutable policy content digest;
- no effective-policy view;
- no append-only trigger or grants;
- no exact query proving APPROVED derives from a real Event.

Therefore `policy_revision_id -> policy_revision(id)` is only an identifier
link, not proof that the policy was approved.

## 7. Replay

`(review_id,request_id)` plus request hash provides idempotency after the
principal/authority checks. It does not solve stale sessions or cross-user
connection reuse.

## 8. Required Acceptance

- authenticated-session table with expiry/revocation/audience/login epoch;
- database binding of function invocation to live session;
- immediate stale-session rejection;
- current authority and object scope;
- complete PolicyReviewEvent schema and effective-policy proof;
- DB tests for all AG-01 through AG-12 and replay cases.

