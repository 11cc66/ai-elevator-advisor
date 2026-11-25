# Independent Review R3-C6 Findings

## Counts

```text
P0: 0
P1: 4
P2: 6
P3: 0
```

## P1

### REV-R3-C6-P1-01 — Snapshot root and Selection provenance are not database-bound

- Related: `REV-R3-C4-P1-03`, `REV-R3-C5-P1-02`
- Files:
  - `SNAPSHOT_NORMALIZED_SCHEMA_R3_C6.md:13-48,71-120`
  - `SNAPSHOT_NORMALIZED_SCHEMA_R3_C6.md:141-265`
  - `SNAPSHOT_TRIGGER_AND_FUNCTION_DDL_PROPOSAL_R3_C6.md:149-177`
- Problem:
  - Snapshot Header has no FK to Case/RequirementVersion/SelectionRun.
  - SelectionRun has no FK to RequirementVersion or RuleSetRevision.
  - SelectionCandidateResult has no FK to SelectionRun, Product Revision,
    Specification Revision, Price Revision or RuleSet Revision.
  - Candidate/Parameter/Price child tables are columns and prose, not complete
    executable table/FK DDL.
- Counterexample: `create_snapshot_r3` accepts `p_case_id` and
  `p_requirement_version_id`; it reads a run but never checks either against the
  run. It can insert a Snapshot Header using a valid run with another
  RequirementVersion.
- Required correction: add exact root FKs and complete child DDL; derive case,
  requirement version and scenario from the sealed run.
- Acceptance: every provenance mismatch in the C6 test plan is rejected by a
  named DB constraint, not only by prose.

### REV-R3-C6-P1-02 — Snapshot creation and validation call undefined functions

- Related: `REV-R3-C4-P2-02`, `REV-R3-C5-P2-02`
- File:
  - `SNAPSHOT_TRIGGER_AND_FUNCTION_DDL_PROPOSAL_R3_C6.md:114-177`
- Problem:
  - `build_snapshot_basis_r6`, `verify_snapshot_basis_r6`,
    `snapshot_record_count`, `current_principal_id`, all materializer functions,
    and `require_no_active_snapshot_children_r3` are invoked but never defined.
- Counterexample: the proposed validator/create function cannot compile, so
  commit-time validation and Snapshot finalization have no executable body.
- Required correction: publish complete function definitions (or replace calls
  with inline SQL) and attach every trigger.
- Acceptance: a clean DDL parse/introspection review finds every referenced
  function defined with matching signature and owner.

### REV-R3-C6-P1-03 — Session revocation can race a transition

- Related: `REV-R3-C5-P1-03`
- Files:
  - `TRUSTED_SESSION_DDL_R3_C6.md:99-138`
  - `PROFESSIONAL_REVIEW_TRANSITION_DDL_R3_C6.md:35-56`
  - `POLICY_TRANSITION_DDL_R3_C6.md:69-100`
- Problem: `require_active_session` reads TrustedSession/epoch without a lock.
  `revoke_trusted_session` updates the session row. A transition can observe
  ACTIVE, revocation can commit, and the transition can then insert an event.
- Counterexample: two transactions race; the transition uses the old ACTIVE row
  and commits after revocation, violating logout/revocation safety.
- Required correction: lock the TrustedSession and PrincipalEpoch `FOR SHARE`
  throughout the transaction; revocation/epoch change must lock `FOR UPDATE`.
  Recheck session state immediately before event insert/commit.
- Acceptance: concurrent logout/transition test has a serial result and no
  event commits after revocation.

### REV-R3-C6-P1-04 — Policy content/digest and Event/Transition DDL are not trustworthy

- Related: `REV-R3-C5-P1-04`
- Files:
  - `POLICY_REVISION_LIFECYCLE_DESIGN_R3_C6.md:5-42`
  - `POLICY_TRANSITION_DDL_R3_C6.md:8-47`
  - `PROFESSIONAL_REVIEW_TRANSITION_DDL_R3_C6.md:44-47,138-155`
- Problem:
  - `p_content_digest` is caller-supplied and never compared with `p_content`.
  - PolicyRevision content has no immutable trigger.
  - PolicyReviewEvent has no append-only trigger.
  - `policy_is_effective` and `review_audit` are referenced but undefined.
  - The ProfessionalReview event/Review DDL is not updated to include
    `actor_principal_id`, `actor_authority_grant_id`, `created_by_principal_id`
    and `request_key`.
- Counterexample: a policy author supplies valid-looking content with an
  arbitrary digest. An approver can approve that ID/digest without proving the
  digest covers the content.
- Required correction: compute/validate canonical content digest in a trusted
  immutable function; define complete Review/Event tables and append-only
  triggers; define effective-policy and audit functions.
- Acceptance: changing one policy byte changes the digest and blocks approval;
  no Event can exist without a real approved-policy event.

## P2

### REV-R3-C6-P2-01 — Policy and audit views are incomplete

- File: `POSTGRESQL_OBJECT_GRANT_AND_VIEW_MATRIX_R3_C6.md:36-110`
- Problem: `current_policy_revision_v` returns the latest event even when it is
  INVALIDATED/EXPIRED/REJECTED and has no authority/project filter. The other
  named snapshot/audit views are only described, not defined.
- Correction: define each view with exact columns, security semantics,
  project/authority filter and effective-state predicate.

### REV-R3-C6-P2-02 — Runtime function grant signatures do not match declared functions

- File: `POSTGRESQL_OWNER_ROLE_PRIVILEGE_BASELINE_R3_C6.md:169-182`
- Problem: policy transition grant has six arguments versus seven in its
  definition; ProfessionalReview grant has seven versus eight and the command
  type is represented as text. `ALTER FUNCTION` signatures must exactly match.
- Correction: derive signatures from the function DDL and verify with
  introspection.

### REV-R3-C6-P2-03 — Transition replay is checked after stale-sequence rejection

- Files:
  - `POLICY_TRANSITION_DDL_R3_C6.md:80-100`
  - `PROFESSIONAL_REVIEW_TRANSITION_DDL_R3_C6.md:52-68`
- Problem: a retry with the original expected sequence sees the new latest
  sequence and is rejected before request replay lookup.
- Correction: lock the owner, look up request ID/hash first, return the prior
  event for same request, then validate sequence for new requests.

### REV-R3-C6-P2-04 — No whole-Basis maximum is defined

- File: `R3_BASIS_R6_PROTOCOL_R3_C6.md:20-53`
- Problem: record/body lengths have uint32/uint64 widths and individual BYTES
  has a 512 cap, but total record count/body size has no protocol maximum.
- Correction: define maximum record count, body bytes and total Basis bytes,
  with reject vectors.

### REV-R3-C6-P2-05 — Negative scalar vectors are documented but not executable evidence

- Files:
  - `SCALAR_ACCEPT_REJECT_VECTORS_R3_C6.json`
  - `R3_BASIS_SCALAR_VALIDATION_PROTOCOL_R3_C6.md`
- Problem: the file lists expected outcomes, but no review/fixture execution
  demonstrates both encoders reject every invalid case.
- Correction: provide executable negative fixtures and per-language results.

### REV-R3-C6-P2-06 — Source boundary checker reports, but does not run, all encoder boundary cases

- File: `tools/source_key_boundary_check.py`
- Problem: it constructs representative 275/362-byte values and prints a
  363-byte expectation, but does not invoke Node/Python rejection for 363,
  max+1 components, or invalid controls.
- Correction: run all boundary/reject cases through both encoders and capture
  exit/error category.

