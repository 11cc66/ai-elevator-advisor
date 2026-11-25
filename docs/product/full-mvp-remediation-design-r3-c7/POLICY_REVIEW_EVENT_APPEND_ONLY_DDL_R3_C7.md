# Policy Review Event Append-Only DDL R3-C7

Artifact: `POLICY_REVIEW_EVENT_APPEND_ONLY_DDL_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. Event Columns

`app.policy_review_event` stores:

```text
id, policy_id, policy_revision_id, event_sequence, state_version,
previous_state, command, next_state,
actor_principal_id, actor_session_id, actor_authority_grant_id,
request_id, request_hash, evidence_reference, occurred_at
```

It has unique keys:

```text
(policy_revision_id,event_sequence)
(policy_revision_id,state_version)
(policy_revision_id,request_id)
```

## 2. Closed State Matrix

| Current | Command | Next |
|---|---|---|
| none | CREATE | DRAFT |
| DRAFT | SUBMIT | IN_REVIEW |
| IN_REVIEW | APPROVE | APPROVED |
| IN_REVIEW | REJECT | REJECTED |
| APPROVED | INVALIDATE | INVALIDATED |
| APPROVED | EXPIRE | EXPIRED |
| APPROVED | SUPERSEDE | SUPERSEDED |

The command is an enum. No requested target-state parameter exists.

## 3. Replay Order

Within the locked revision/current context:

1. compute canonical request hash;
2. search Request ID;
3. same principal + same hash -> return original event;
4. same ID + different principal/hash -> conflict;
5. new request -> compare latest event sequence;
6. new request -> validate command/state/authority;
7. append event;
8. CAS current pointer;
9. recheck Session and commit.

An old expected sequence never preempts a valid idempotent replay.

## 4. Authority

The actor principal/Session come from `lock_active_session`; the concrete grant
is locked and recorded. `APPROVE` rejects when actor principal equals the
revision author.

The request hash covers operation, revision, expected sequence, command, request
key, and reason. Reusing the same request ID with changed semantics conflicts.

## 5. Append-Only

`guard_policy_review_event_r3` rejects UPDATE/DELETE. The Event TRUNCATE trigger
raises `42501`. Runtime roles receive no table DML.

`review_audit` and `professional_review_event` use the same append-only/truncate
pattern.

## 6. Effective Pointer CAS

`policy_current.generation` advances only in the transition transaction. The
pointer records the exact approval Event ID. Unique indexes permit at most one
APPROVED global policy per kind and one APPROVED policy per project/kind.

Creating a new draft does not overwrite the approved pointer. The pointer moves
only when a new revision is APPROVED, and becomes non-effective only when a
terminal event applies to the currently pointed revision.

## 7. Runtime Boundary

No event, trigger or lock was executed.
