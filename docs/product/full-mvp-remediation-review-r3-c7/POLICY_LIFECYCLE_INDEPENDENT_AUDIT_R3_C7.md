# Policy Lifecycle Independent Audit R3-C7

## Result

```text
Policy canonical content/digest: PASS — static
Policy Revision immutability: PASS — static
Policy Event append-only: PASS — static
Effective policy view: PARTIAL
Policy create idempotency: FAIL
Policy pointer constraints: PARTIAL
```

## Positive

- `policy_digest(text)` computes a domain-separated SHA-256 internally.
- Caller cannot provide a digest.
- Noncanonical JSON and duplicate-key collapse are rejected by comparing
  `input::jsonb::text` with the exact input text.
- Revision UPDATE/DELETE and TRUNCATE are guarded.
- Event UPDATE/DELETE and TRUNCATE are guarded.
- Policy author and approver identities are derived from the locked session and
  self-approval is rejected.
- Effective view requires current-state APPROVED plus an exact Approval Event.

## Findings

### P2-03 — Create retries are not idempotent

`create_policy_revision` accepts `p_request_id` and `p_request_key`, but never
checks whether that request already produced a revision/event. A retry with a
different revision number can create a second draft. `seal_selection_run` also
accepts `p_request_id` and never uses it.

### P2-04 — Locked authority evidence can be the wrong scoped grant

`lock_active_session` returns the lexicographically first matching capability
grant without project/policy filters. The create function then records that
grant ID, while `has_project_authority` may be satisfied by a different grant.
The event can therefore cite a grant that did not authorize the exact object.

### P2-05 — Current pointer/event relationships are not complete

`policy_current` references revision ID and event ID independently. It does not
composite-FK them to the same policy/revision. `policy_review_event.policy_id`
is also not tied to the Revision's `policy_id`. Owner-side or implementation
bugs can create a pointer/event combination that the view must rely on separate
predicates to reject.

## Runtime Boundary

No Policy row, transition, trigger or effective View was executed.
