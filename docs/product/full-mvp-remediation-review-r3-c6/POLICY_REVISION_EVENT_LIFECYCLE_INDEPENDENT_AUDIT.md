# Policy Revision / Review Event Lifecycle Independent Audit R3-C6

Date: 2026-11-24

## 1. Result

```text
PolicyRevision: FAIL
PolicyReviewEvent: FAIL
Policy Author / Approver Separation: PASS
Findings: REV-R3-C6-P1-04, REV-R3-C6-P2-01, REV-R3-C6-P2-02, REV-R3-C6-P2-03
```

The event-only lifecycle model and self-approval prohibition are directionally
correct. The immutable approval evidence and effective-policy claim are not
cryptographically or database-enforced by the submitted DDL.

## 2. Positive Design Elements

`POLICY_REVISION_LIFECYCLE_DESIGN_R3_C6.md:6-40` introduces:

- `policy_revision` with policy kind, JSON content, content digest and author;
- `policy_review_event` with event/state sequence, actor principal, concrete
  AuthorityGrant, request ID/hash and immutable transition evidence;
- uniqueness for event sequence, state version and request.

`POLICY_REVISION_LIFECYCLE_DESIGN_R3_C6.md:44-62` defines a closed command
matrix and requires new events for invalidation, expiry and supersession.

`POLICY_TRANSITION_DDL_R3_C6.md:117-145` derives the actor from the active
TrustedSession and explicitly rejects self-approval at lines 120-123. This
separation passes at design level.

## 3. Content/Digest Is Not Bound

`create_policy_revision` accepts both `p_content` and `p_content_digest`
(`POLICY_TRANSITION_DDL_R3_C6.md:8-14`) and inserts both without proving that
the digest is the canonical digest of the content (lines 22-34).

Counterexample:

```text
content      = approved-looking policy A
content_digest = digest of policy B
```

The revision is accepted, and an approver later compares only
`p.content_digest` with another caller-supplied digest
(`POLICY_TRANSITION_DDL_R3_C6.md:79-83`). The event therefore binds an
identifier and arbitrary digest, not verified content.

The design must compute the digest inside the trusted function from canonical
immutable content, or verify a caller digest against a trusted immutable hash
function before insertion.

## 4. Missing Append-Only/Immutable Enforcement

`POLICY_REVISION_LIFECYCLE_DESIGN_R3_C6.md:17-19` states that content and
digest are immutable, and line 45 states events are insert-only. No complete
trigger DDL is supplied for either assertion:

- no PolicyRevision UPDATE/DELETE content-immutability trigger;
- no PolicyReviewEvent UPDATE/DELETE append-only trigger;
- no TRUNCATE guard DDL for either table;
- no exact owner/privilege attachment for those triggers.

Merely revoking runtime DML is not equivalent to an append-only invariant:
owner, migrator and SECURITY DEFINER paths must also be analyzed and tested.

## 5. Effective Policy and Audit Objects

`POSTGRESQL_OBJECT_GRANT_AND_VIEW_MATRIX_R3_C6.md:64-77` defines
`current_policy_revision_v` so that it returns the latest event for every
revision regardless of whether that state is APPROVED, INVALIDATED, EXPIRED or
REJECTED. It also lacks a policy authority/project predicate.

`PROFESSIONAL_REVIEW_TRANSITION_DDL_R3_C6.md:44-47` calls
`app.policy_is_effective(pr.id)`, but that function is not defined. The
professional transition also inserts into `app.review_audit`
(`PROFESSIONAL_REVIEW_TRANSITION_DDL_R3_C6.md:153-155`) without reviewed table
DDL for all referenced columns.

The Normalized Schema creates a Snapshot review row with
`created_by_principal_id`, while the ProfessionalReview Event transition writes
`actor_principal_id`, `actor_authority_grant_id`, `request_id` and `request_key`.
Those columns are either absent from the reviewed parent DDL or not shown with
exact constraints.

## 6. Replay and Function-Signature Defects

`POLICY_TRANSITION_DDL_R3_C6.md:84-99` checks stale sequence before looking up
the request ID. An idempotent retry carrying the original expected sequence is
therefore rejected after the first event advances the sequence; it never
reaches replay return.

The policy transition function is declared with seven arguments
(`POLICY_TRANSITION_DDL_R3_C6.md:53-61`) but the runtime grant lists six
(`POSTGRESQL_OWNER_ROLE_PRIVILEGE_BASELINE_R3_C6.md:177-179`). The professional
transition is declared with eight arguments including the enum
(`PROFESSIONAL_REVIEW_TRANSITION_DDL_R3_C6.md:12-22`) but granted with seven
text-shaped arguments (`POSTGRESQL_OWNER_ROLE_PRIVILEGE_BASELINE_R3_C6.md:174-176`).

These DDL fragments cannot be applied as a coherent privilege baseline.

## 7. Required Correction and Acceptance

1. Compute and verify canonical content digest in the trusted create path.
2. Add immutable-content and append-only event triggers, including DELETE and
   TRUNCATE protections, with exact DDL, owner and grants.
3. Define `policy_is_effective`, complete `review_audit`, and every review/event
   column referenced by transition functions.
4. Redefine effective-policy views to return only APPROVED policies without a
   later terminal event and apply exact policy/project authority.
5. Place request replay lookup and request-key comparison before stale-sequence
   rejection for retries, under the same owner lock.
6. Make every `GRANT`/`REVOKE` signature identical to the declared function,
   including enums and argument order.

Acceptance requires a changed content byte to invalidate approval evidence;
event UPDATE/DELETE/TRUNCATE to fail; idempotent retries to return the original
event; and a mismatched or unauthorized policy to be absent from the effective
view.

## 8. Runtime Boundary

No SQL, DDL, trigger, policy event, effective view, authorization function or
replay scenario was executed. PostgreSQL behavior remains `NOT VERIFIED`.
