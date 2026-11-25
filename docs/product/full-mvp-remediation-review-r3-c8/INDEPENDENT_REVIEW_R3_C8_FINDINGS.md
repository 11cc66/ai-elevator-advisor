# Independent Review R3-C8 Findings

## Counts

```text
P0: 0
P1: 4
P2: 4
P3: 3
```

## P1

### REV-R3-C8-P1-01 — Snapshot Price business content is not digest-bound

- Severity: `P1`
- C8 claim: Snapshot Price is bound to the sealed Selection result by
  `source_row_digest`, with content verification.
- Files:
  - `DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql:553-591`
  - `DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql:4405-4418`
  - `DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql:7192-7194`
- Problem:
  - `sales_snapshot_price_r3` stores `amount_minor`, `currency`,
    `price_basis`, `tax_basis`, `applicability`, `valid_from`, `valid_until`
    and `quoted_at`.
  - The canonical row payload used by `source_row_digest` contains only
    candidate/product/specification/price/source IDs. It omits all eight
    business-content fields above.
  - The digest trigger therefore verifies that identifiers are unchanged, not
    that the Snapshot Price values equal the sealed price facts.
- Counterexample:
  1. Materialize a DRAFT Snapshot with price amount 420000.
  2. Keep every ID and `source_row_digest` unchanged.
  3. Change Snapshot `amount_minor` to an arbitrary value.
  4. The digest trigger recomputes the same digest and the exact FK still
     passes; finalization rebuilds Basis from the altered amount.
- Root cause: the sealed Selection stores only the Price Revision identity, and
  the Snapshot digest projection does not cover the Price Revision content.
- Risk: a Basis can be internally consistent while presenting a price that was
  never part of the sealed SelectionRun.
- Required correction: seal the complete price content, or a trusted Price
  Revision content digest, into SelectionCandidatePrice and Snapshot Price;
  bind it by exact FK/check and include every business-visible price field in
  the digest.
- Acceptance: mutation of each price field, or replacement with a different
  Price Revision having the same IDs, rejects before finalization.
- Blocks next gate: `YES`.

### REV-R3-C8-P1-02 — Sealed source rows and ProfessionalReview content remain caller-forgeable

- Severity: `P1`
- Related C7 findings: `REV-R3-C7-P1-02`, historical provenance findings.
- Files:
  - `DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql:857-873`
  - `DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql:891-913`
  - `DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql:5608-5755`
  - `DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql:5756-5820`
  - `DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql:5821-5881`
- Problem:
  - `selection_requirement_field` has no FK from
    `requirement_version_id`, `source_revision_id` or `source_value_id`.
  - `selection_catalog_review_result` has no FK for `catalog_review_id`,
    `target_revision_id` or `source_revision_id`; it accepts those IDs and the
    decision/review time from the worker.
  - `selection_professional_review_result` has no FK to the selected
    ProfessionalReviewEvent/Review or target revision. Its ingestion function
    copies caller-supplied `p_target_revision_id`, `p_decision`,
    `p_basis_digest` and `p_occurred_at`.
  - The only event/decision check is asymmetric:
    `ev.next_state <> 'APPROVED' AND p_decision = 'APPROVED'` at line 5863.
    It permits an approved event to be sealed as `REJECTED`, and does not bind
    basis or occurrence time to the event.
- Counterexample:
  1. Select a real approved ProfessionalReviewEvent.
  2. Call `record_selection_professional_review_result` with the real event ID
     but `decision='REJECTED'`, `basis_digest='attacker'`,
     `occurred_at=now()+interval '1 year'` and any target revision.
  3. The function's current condition is false, the row is inserted, sealed,
     copied into the Snapshot, and its forged payload becomes the Basis.
- Root cause: the digest proves equality to a sealed row, but the sealed row
  itself is not constrained to authoritative source/event content.
- Risk: Basis provenance can be byte-correct and still describe facts that did
  not come from the referenced review or source records.
- Required correction:
  - add exact source/event/revision FKs and immutable source digests;
  - derive decision, basis digest and occurrence time from the referenced
    event, never from caller input;
  - enforce the complete state-to-decision mapping;
  - define authoritative expected sets for warnings/missing fields or document
    a database-verifiable producer.
- Acceptance: cross-run/cross-project source IDs, approved-as-rejected, forged
  basis/time, and omitted required child rows all reject by named DB controls.
- Blocks next gate: `YES`.

### REV-R3-C8-P1-03 — Session role validation does not prove the claimed privilege closure

- Severity: `P1`
- Related C7 finding: `REV-R3-C7-P1-03`.
- File: `DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql:4533-4609`
- Problem:
  - Validation checks LOGIN, `rolconnlimit=1`, non-superuser, non-BYPASSRLS,
    direct bootstrap membership, direct owner membership and direct capability
    membership.
  - It does not check `rolcreatedb`, `rolcreaterole`, `rolinherit`, membership
    `INHERIT`/`SET`/`ADMIN` options, recursive role closure, indirect owner
    membership or direct object privileges.
  - The role matrix claims NOINHERIT/NOCREATEDB/NOCREATEROLE and exact SET-only
    membership, but those facts are not database-verified by the function.
- Counterexample: a role with the expected name and connection limit can be
  recursively granted membership in `elevator_table_owner`, or hold
  `CREATEROLE`, while all current checks pass. `SET ROLE` can then expose
  owner-side DML outside the controlled function path.
- Root cause: only one-hop memberships and a subset of role attributes are
  inspected.
- Risk: a malformed or malicious provisioning path can convert a session login
  into an owner-capable or otherwise overprivileged identity.
- Required correction: recursively reject all owner/service/audit-broker role
  closure; require NOINHERIT/NOCREATEDB/NOCREATEROLE/NOBYPASSRLS; verify
  membership options; reject direct table DML and unexpected grants.
- Acceptance: every overprivileged/indirect-membership role variant rejects
  during registration, before `open_trusted_session`.
- Blocks next gate: `YES`.

### REV-R3-C8-P1-04 — Clean-database AuthorityGrant and connect path is circular/incomplete

- Severity: `P1`
- Related C7 findings:
  - `REV-R3-C7-P1-04`
  - `REV-R3-C7-P1-05`
- Files:
  - `DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql:3404-3410`
  - `DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql:5154-5215`
  - `DATABASE_ROLE_PRIVILEGE_MATRIX_R3_C8.md:57-75`
- Problem:
  - The only `INSERT INTO app.authority_grant` path is
    `issue_authority_grant`.
  - That function first requires a current `AUTHORITY_ISSUE` grant through
    `lock_authority_grant`.
  - No bootstrap function, deployment function, root-grant seed or controlled
    break-glass path exists. A clean database therefore cannot issue the first
    grant, and no business function can be called.
  - `GRANT CONNECT` names only five fixed roles. Dynamic session login roles are
    required to be NOINHERIT with capability membership granted using SET, but
    no step grants those login roles database CONNECT. Connection checks occur
    before `SET ROLE`, so capability-role CONNECT cannot substitute.
  - The role matrix says the external broker creates login roles, while
    `elevator_identity_broker` is NOCREATEROLE. No separate provisioning
    identity or exact grant/connect operation is specified.
- Counterexample: a clean database, broker-created session role with the correct
  capability membership, and a security admin session all exist. The admin
  cannot issue the first grant without already holding `AUTHORITY_ISSUE`;
  non-web/policy/reviewer session roles also cannot establish the database
  connection required to activate.
- Root cause: authorization bootstrapping and database connection privileges
  were not included in the clean-start protocol.
- Risk: the business creation APIs are unreachable from a clean allowed state
  except through undocumented owner DML.
- Required correction: define a separately authorized bootstrap/deployment
  procedure for root grants and catalog prerequisites; require a direct
  CONNECT grant on each provisioned session login role; specify the identity
  allowed to create/retire those roles.
- Acceptance: an empty database proceeds through provisioning, activation,
  grant issuance, selection, seal, review creation and snapshot creation
  without direct table DML.
- Blocks next gate: `YES`.

## P2

### REV-R3-C8-P2-01 — Command Request Ledger does not compare session identity

- Severity: `P2`
- Files:
  - `DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql:3620-3635`
  - `DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql:5091-5140`
- Problem: the ledger stores `session_id`, but replay conflict comparison checks
  operation, request hash, scope, principal and result type only.
- Counterexample: the same Principal creates a new TrustedSession after the
  first request commits. Reusing the same Request ID and payload from the new
  Session returns the first Session's result.
- Risk: request evidence is not the exact `(principal, session, operation,
  request)` tuple claimed by the C8 protocol. Cross-session replay may disclose
  a prior result or violate a per-session revocation decision.
- Required correction: compare `r.session_id` exactly; define whether
  cross-session replay is prohibited or explicitly authorized.
- Acceptance: same principal/new session with the same request ID conflicts,
  unless an explicitly approved protocol says otherwise.
- Blocks next gate: `NO`, but must be corrected before implementation.

### REV-R3-C8-P2-02 — `professional_review` lacks an explicit TRUNCATE lifecycle guard

- Severity: `P2`
- Files:
  - `DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql:760-785`
  - `DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql:3133-3162`
- Problem: `professional_review_event` and `review_audit` have named DELETE and
  TRUNCATE guards, but `professional_review` has none. `trusted_session` also
  lacks a named TRUNCATE guard.
- Risk: protection would rely on FK/cascade behavior and on triggers on related
  tables, which C8 has not verified. The requirement explicitly covers the
  Review state table, not only its event history.
- Required correction: add named `BEFORE TRUNCATE` guards for
  `professional_review`, `trusted_session` and any other current-state table
  whose history must remain authoritative; remove TRUNCATE from non-dedicated
  paths.
- Acceptance: direct and cascading truncate attempts fail by explicit named
  controls in PostgreSQL, not by inference from FK behavior.
- Blocks next gate: `NO`, but PostgreSQL verification is required before
  schema activation.

### REV-R3-C8-P2-03 — C8 self-validation overstates DDL consistency

- Severity: `P2`
- Files:
  - `tools/validate_c8_ddl.py:425-443`
  - `tools/validate_c8_ddl.py:527-536`
  - `evidence/DDL_STATIC_AUDIT_R3_C8.json`
- Problem: the validator checks selected names/counts, but not source-table FK
  coverage, Price digest content, bootstrap reachability, session-role closure,
  CONNECT grants or decision/event equality. It returns `PASS` while the
  independent review found four P1 issues.
- Risk: C8 artifacts present a stronger assurance statement than the tool
  actually supports.
- Required correction: either narrow the evidence claim to the exact checked
  properties or add independent checks for the missing invariants. Do not use
  `PASS` as a statement of complete DDL correctness.
- Acceptance: a deliberately mutated Price payload, omitted source FK, circular
  grant path and bad role membership cause named validator failures.
- Blocks next gate: `NO`, but the C8 evidence must not be represented as complete
  self-proof.

### REV-R3-C8-P2-04 — Selection ingestion can seal invalid source-aux data

- Severity: `P2`
- File: `DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql:5608-5705`
- Problem: `record_selection_requirement_field` normalizes source auxiliary
  text but does not enforce non-empty, 128-byte maximum, or C0/C1 control
  rejection before inserting the sealed selection row. The run can seal; the
  failure is deferred to Snapshot materialization when `source_key_r3` runs.
- Risk: a valid-looking sealed SelectionRun can become permanently unable to
  produce a Snapshot.
- Required correction: call the same canonical source-key domain validation at
  selection ingestion and reject before insert/seal.
- Acceptance: empty, 129-byte and control-bearing auxiliary values reject with
  a stable SQLSTATE before the SelectionRun can be sealed.
- Blocks next gate: `NO`.

## P3

### REV-R3-C8-P3-01 — Generator tooling accepts arbitrary overwrite targets

- Severity: `P3`
- Files:
  - `tools/generate_complete_ddl_r3_c8.py:10-15,56`
  - `tools/validate_c8_ddl.py:527`
  - `tools/build_function_registry_r3_c8.py:117`
  - `tools/run_independent_evidence.py:40-74`
- Problem: output paths are caller-supplied and are written with no repository
  allowlist, no “must be under C8 evidence” guard and no overwrite protection.
  The registry builder also replaces, rather than unions, execute-role grants
  for a signature.
- Risk: a future invocation can overwrite a design input or produce incomplete
  Registry grants. The checked-in execution did not do so, but the tooling is
  unsafe as a reusable guard.
- Required correction: restrict input/output roots, add no-overwrite/atomic
  output handling, and union grant roles.
- Acceptance: attempts to write outside the C8 directory or over an existing
  input fail before any write.

### REV-R3-C8-P3-02 — Authority grant revocation silently accepts a missing target

- Severity: `P3`
- File: `DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql:5219-5248`
- Problem: after `PERFORM ... FOR UPDATE`, the function does not check
  `FOUND`; the following update may affect zero rows while the function returns
  success. There is also no uniqueness constraint for duplicate grants with the
  same Session/action/scope.
- Risk: audit tooling can record a nominal revocation that did not occur, and
  duplicate grants make “the” effective grant ambiguous.
- Required correction: require exactly one target row and add an explicit
  uniqueness policy for active grants.
- Acceptance: missing target raises `NO_DATA_FOUND`-class failure; duplicate
  active grant issue rejects by named unique constraint.

### REV-R3-C8-P3-03 — Review process experienced Bash misrouting

- Severity: `P3` process finding
- Evidence: `evidence/SHELL_AND_EXECUTION_EVIDENCE_R3_C8.md`
- Problem: several read-only commands were dispatched with the Bash shell
  parameter instead of PowerShell and failed at command lookup.
- Impact: no command executed and no evidence was accepted from those attempts;
  all conclusions were reproduced with PowerShell or the independent Python
  verifier. The event remains a process-control deviation because this project
  has a history of Bash/CMD/PowerShell syntax confusion.
- Required correction: enforce shell/script-language binding at the runner
  boundary and reject PowerShell syntax selected under a Bash execution mode.
- Acceptance: the runner has a regression test that fails closed before process
  creation on a shell/syntax mismatch.

## Summary

The independently reproducible C6/R6 evidence is valid at the static
design-vector layer. The DDL has exact target keys for all 64 parsed FKs,
78-function Registry/owner agreement, fixed `pg_catalog`-first search paths,
and no PUBLIC execute grants in the static registry view.

Those positives do not close the P1 findings above. No Schema, Migration,
implementation or Runtime work is authorized by this review.
