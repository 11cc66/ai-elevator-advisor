# Review Findings and Required Corrections R3-C8 Corrections R2

## P1

### REV-R3-C8-CORRECTIONS-R2-P1-01 — Bootstrap recovery DDL is structurally invalid

- Source round: R3-C8 Corrections R2.
- Original risk: root recovery/rotation must execute without cross-Generation
  corruption.
- Severity: `P1`.
- Designs:
  - `DATABASE_FINAL_STATE_OVERLAY_R3_C8_CORRECTIONS_R2.sql`
  - `DATABASE_COMPLETE_DDL_DESIGN_R3_C8_CORRECTIONS_R2.sql`
- Objects/functions:
  - `bootstrap_root_session_r2`
  - `bootstrap_approval_r2`
  - `bootstrap_lifecycle_r2`
  - `bootstrap_execute_root_change_r2`
- Evidence:
  - The Root Session table defines `session_id`, but
    `bootstrap_root_session_generation_fk_r2` references the nonexistent source
    column `root_session_id` (Overlay lines 350-369 and 423-431).
  - Historical `bootstrap_approval_r2` and Root Session rows reference the
    mutable current `bootstrap_lifecycle_r2` Generation.
  - Rotation inserts new-Generation approvals before moving Lifecycle to that
    Generation, while the Approval FK is immediate.
  - Rotation updates State to the new Generation before Lifecycle, while the
    Lifecycle-to-State FK is immediate.
- Counterexample: start a valid rotation. PostgreSQL rejects the Root Session FK
  definition; if removed, the Approval/State/Lifecycle updates still cannot
  satisfy Generation relationships before commit.
- Impact: Root Recovery/Rotation is not executable and the complete DDL cannot
  compile.
- Required correction: reference immutable `bootstrap_generation_r2` for
  historical rows; use `session_id` consistently; make generation changes one
  atomic immutable-generation transition and avoid current-row historical FKs.
- Acceptance: complete DDL can create all FKs and a rotation can advance exactly
  one Generation in a real PostgreSQL transaction.
- Status: `NOT RESOLVED`.
- PostgreSQL runtime proof: `NOT VERIFIED`.

### REV-R3-C8-CORRECTIONS-R2-P1-02 — Catalog Binding FK targets are not unique keys

- Source round: R3-C8 Corrections R2.
- Original risk: Catalog Source must be tied to the exact review target.
- Severity: `P1`.
- Designs: `DATABASE_FINAL_STATE_OVERLAY_R3_C8_CORRECTIONS_R2.sql`.
- Objects/functions:
  - `catalog_source_target_binding_r2`
  - `catalog_review_event_r3`
- Evidence:
  - Binding-to-Source FK uses
    `(source_revision_id, source_evidence_object_id, source_content_digest)`
    (Overlay lines 1604-1607), but `catalog_source_revision` has no matching
    3-column UNIQUE/PK; its wider UNIQUE includes two additional columns.
  - Event-to-Binding FK uses 12 target columns (Overlay lines 1828-1839), but
    the Binding UNIQUE includes 14 columns, including source evidence and
    source content digest.
- Counterexample: PostgreSQL rejects each FK because the referenced column list
  is not backed by an exact unique key.
- Impact: Catalog Review DDL cannot compile; P1-03 is not closed.
- Required correction: define exact unique keys matching each FK, or reference
  the Binding primary key and enforce all other identity through a validated
  immutable key.
- Acceptance: all Catalog FKs reference exact UNIQUE/PK column sets and reject
  cross-target bindings.
- Status: `NOT RESOLVED`.
- PostgreSQL runtime proof: `NOT VERIFIED`.

### REV-R3-C8-CORRECTIONS-R2-P1-03 — R2 SECURITY DEFINER helpers are not explicitly revoked from PUBLIC

- Source round: R3-C8 Corrections R2.
- Original risk: caller identity must not be bypassable through function access.
- Severity: `P1`.
- Design/tool: `DATABASE_FINAL_STATE_OVERLAY_R3_C8_CORRECTIONS_R2.sql`.
- Objects:
  - `app_private.claim_bootstrap_request_r2`
  - `app_private.complete_bootstrap_request_r2`
  - `app_private.append_bootstrap_event_r2`
- Evidence:
  - The frozen DDL runs blanket function revokes at Complete DDL lines
    10741-10742, before the R2 overlay starts at line 10860.
  - R2 creates the helpers later (for example Complete DDL lines 11424, 11473
    and 11492).
  - The R2 grant/revoke block revokes PUBLIC from only three functions (Overlay
    lines 3002-3007); it never performs a final all-functions revoke.
  - `append_bootstrap_event_r2`, `claim_bootstrap_request_r2` and
    `complete_bootstrap_request_r2` have no internal caller identity check.
  - Session login roles can `SET ROLE` to `elevator_session_bootstrap`, which has
    `USAGE` on `app`; a residual PUBLIC EXECUTE grant therefore reaches them.
- Counterexample: PostgreSQL's default function EXECUTE privilege remains for
  PUBLIC after these new functions are created unless the actual creator is
  covered by the configured default privileges. A Session role can invoke the
  helper directly and forge or block bootstrap ledger/events.
- Impact: bootstrap audit/ledger integrity and denial-of-service protection are
  not fail closed.
- Required correction: add a final `REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA
  app, app_private FROM PUBLIC` after all R2 functions are created, then re-grant
  only explicit capabilities; add caller checks to mutable helpers.
- Acceptance: Catalog ACL inspection shows no PUBLIC EXECUTE and direct helper
  calls from arbitrary Session roles fail before mutation.
- Status: `NOT RESOLVED`.
- Actual ACL behavior: `NOT VERIFIED — DATABASE NOT AUTHORIZED`.

## P2

### REV-R3-C8-CORRECTIONS-R2-P2-01 — Result recovery is neither single-instance nor replay-safe

- Source round: R3-C8 Corrections R2.
- Severity: `P2`.
- Design/functions: `command_result_recovery_r2`,
  `approve_command_result_recovery_r2`,
  `execute_command_result_recovery_r2`.
- Evidence:
  - The table's only command-related uniqueness includes `id`, so multiple
    recovery records can target the same original request.
  - Approval checks the recovery row is `PENDING` before calling the Request
    Ledger.
  - Execute checks it is `AUTHORIZED` before calling the Request Ledger.
  - After approval/consumption, a lost response cannot replay the completed
    Request Ledger result.
- Counterexample: create two recovery IDs for one request, approve both, and
  consume each authorized recovery, disclosing the same stored result twice.
- Impact: "one-time recovery" and idempotent response-loss behavior are not
  guaranteed.
- Required correction: one active recovery per command request; check the
  Request Ledger and original approval grant before terminal-state rejection;
  make lost responses return the stored result without another disclosure.
- Status: `NOT RESOLVED`.

### REV-R3-C8-CORRECTIONS-R2-P2-02 — Bootstrap recovery loses idempotency and has no recovery from failed new issuance

- Source round: R3-C8 Corrections R2.
- Severity: `P2`.
- Functions: `bootstrap_begin_root_change_r2`,
  `bootstrap_approve_root_change_r2`,
  `bootstrap_execute_root_change_r2`.
- Evidence:
  - Begin and approval validate Lifecycle/Recovery state before the bootstrap
    Request Ledger claim.
  - Execute looks up the old Generation before the Request Ledger claim; after a
    committed generation change, the retry cannot reach the ledger response.
  - Begin only accepts `BOOTSTRAP_COMPLETED`, `ROOT_ROTATED`, or `LOCKED`, so a
    failed new Root Issuance in `ROOT_ISSUANCE_PENDING` has no recovery entry.
  - No recovery/approval expiry, deny transition, or timeout fields are defined.
- Impact: response loss or a lost new-root credential can leave bootstrap
  unrecoverable despite the claimed recovery state machine.
- Required correction: make request replay precede terminal-state checks,
  define stale-approval/deny/lock transitions, and allow an approved recovery
  from an interrupted new issuance.
- Status: `NOT RESOLVED`.

### REV-R3-C8-CORRECTIONS-R2-P2-03 — Owner Closure transaction lock is documented but absent

- Source round: R3-C8 Corrections R2.
- Severity: `P2`.
- Designs/functions: `OWNER_PRIVILEGE_CLOSURE_R3_C8_R2.md`,
  `assert_protected_owner_closure_r2`, `assert_active_session`.
- Evidence:
  - The document claims role/Owner changes coordinate through the same
    transaction advisory lock (document lines 59-60).
  - No `pg_advisory` call exists in the R2 Overlay.
- Impact: a role/Owner change can occur after the final closure digest check and
  before commit; the documentation overstates the guarantee.
- Required correction: implement the lock in both validation and the controlled
  provisioning/ownership path, or explicitly classify the race as a deployment
  blocker.
- Status: `NOT RESOLVED`.

### REV-R3-C8-CORRECTIONS-R2-P2-04 — Root Principal active state is not checked

- Source round: R3-C8 Corrections R2.
- Severity: `P2`.
- Function: `bootstrap_complete_root_r3`.
- Evidence: it checks Principal equality, token, approvals, backend and Epoch,
  but never verifies `trusted_principal.state='ACTIVE'` for the Root Principal or
  the approval Principals.
- Counterexample: seed references a pre-existing disabled Principal with Epoch
  1; completion can issue a Root Session/Grant for that disabled Principal.
- Required correction: recheck all participating Principal states under lock at
  completion.
- Status: `NOT RESOLVED`.

### REV-R3-C8-CORRECTIONS-R2-P2-05 — Catalog Binding creator Grant lacks a composite FK

- Source round: R3-C8 Corrections R2.
- Severity: `P2`.
- Object: `catalog_source_target_binding_r2`.
- Evidence: `created_by_session_id` has a Session FK and
  `created_by_principal_id` has a Principal FK, but
  `created_by_authority_grant_id` has no FK to the exact Session/Grant pair.
- Impact: database integrity does not prove that the recorded authority Grant
  belongs to the recorded actor Session.
- Required correction: add an exact composite FK through an
  `(id,session_id,principal_id)` Grant key.
- Status: `NOT RESOLVED`.

### REV-R3-C8-CORRECTIONS-R2-P2-06 — R2 validator is not sufficient for the claimed PASS

- Source round: R3-C8 Corrections R2.
- Severity: `P2`.
- File: `tools/validate_r2.py`.
- Evidence:
  - It reports 48/48 and 12/12.
  - It checks FK arity, but not that every target column set is backed by an
    exact unique key.
  - It does not detect the five FK structure errors found independently.
  - It does not detect mutable-Lifecycle history FKs, PUBLIC EXECUTE defaults,
    missing one-time recovery uniqueness, or recovery replay ordering.
  - Its 12 mutation fixtures are substantially below the explicit requested
    root 8 / owner 12 / catalog 9 coverage.
- Impact: a green self-validator cannot support `DESIGN COMPLETE`.
- Required correction: add structural DDL checks, target-key checks, ACL closure
  checks, state-machine replay ordering tests, and the required mutation sets.
- Status: `NOT RESOLVED`.

## P3

### REV-R3-C8-CORRECTIONS-R2-P3-01 — Lifecycle timestamp/state invariants are incomplete

- Root Session has no check linking `state='ACTIVE'` to `revoked_at IS NULL`.
- Generation `ACTIVE` has no check linking `superseded_at IS NULL`.
- Recovery terminal timestamps are not constrained by state.
- Required correction: add named CHECK constraints or transition triggers.
- Status: `PARTIALLY RESOLVED`.

### REV-R3-C8-CORRECTIONS-R2-P3-02 — Guard evidence records launch identity, not tool success

- `Invoke-R2GuardedTool.ps1` writes `verified=true` before Python/tool completion,
  and the history record has only start time, not exit code or finish time.
- Impact: a failed tool can leave a misleading valid identity record.
- Required correction: append exit code, completion time and failure status after
  the child exits.
- Status: `PARTIALLY RESOLVED`.
