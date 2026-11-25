# Policy Lifecycle and Idempotency R3-C8

## 1. Content and Digest

Policy text must equal PostgreSQL's deterministic `jsonb::text` rendering.
`policy_digest` computes:

```text
SHA-256("AIEA-POLICY\0v1\0" || UTF8(canonical content))
```

No caller digest is accepted. Revision content/digest is immutable; INSERT,
UPDATE and DELETE trigger checks protect content; TRUNCATE has a separate
guard.

## 2. Event and Pointer

`policy_review_event` is append-only. TRUNCATE is denied. The event policy ID,
revision ID and digest-bearing revision are checked by trigger and composite
relationships.

`policy_current` uses:

```text
(policy_id, revision_id, effective_event_id)
```

with:

- FK to `(policy_id, revision_id)` on PolicyRevision;
- FK to `(policy_id, revision_id, effective_event_id)` on PolicyReviewEvent;
- trigger verification of policy kind and project scope.

A caller cannot point the effective policy at an event from another revision
or policy.

## 3. Request Idempotency

`command_request` is a persistent request ledger with:

- operation + request ID primary key;
- canonical request hash;
- scope key;
- principal/session;
- result type/result ID;
- CLAIMED/COMPLETED state.

The operation order is:

```text
active bound Session
  -> exact AuthorityGrant
  -> business/owner lock
  -> claim request
  -> same hash/scope: return prior result
  -> different hash/scope: conflict
  -> new request: perform mutation
  -> complete request in same transaction
```

A retry after a lost response returns the committed result ID. Concurrent
claims are serialized by the unique primary key and ledger row lock. Request
content cannot be silently changed by using a new sequence number.

## 4. Create and Seal

- `create_policy_revision` uses the ledger and returns the original Revision ID
  on identical replay.
- `seal_selection_run` uses the ledger and returns the original digest on
  identical replay.
- Policy and ProfessionalReview transition replay checks remain before stale
  sequence checks.

## 5. Approval Separation

The actor comes from the active bound Session. A concrete Grant is locked and
recorded. The author principal cannot approve its own revision. Effective policy
requires an APPROVED event and the current pointer.

## 6. Boundary

No SQL, Policy row, Event, pointer or trigger was executed in this design phase.
