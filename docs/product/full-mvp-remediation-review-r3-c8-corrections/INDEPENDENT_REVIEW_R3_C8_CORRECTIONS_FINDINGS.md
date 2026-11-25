# Independent Review R3-C8 Corrections Findings

## Counts

```text
P0: 0
P1: 3
P2: 3
P3: 2
```

## P1

### REV-R3-C8-CORRECTIONS-P1-01 — Bootstrap root operator Principal is not cross-checked

- Severity: `P1`
- Original root cause: initial root authority must not be transferable to a
  different Principal.
- Correction claim: seed, two distinct approvals, root issuer session and
  first `AUTHORITY_ISSUE` Grant.
- Affected:
  - `DATABASE_FINAL_STATE_OVERLAY_R3_C8_CORRECTIONS.sql:10212-10305`
  - Complete DDL generated from the same overlay.
- Independent evidence:
  - `bootstrap_complete_root_r3` selects `rootop` by `session_user` and
    `operator_kind='ROOT'`.
  - It then binds the session and Grant to `st.root_principal_id`.
  - It never requires `rootop.principal_id = st.root_principal_id`.
- Counterexample: the seed registers root role R with Principal A, but the
  bootstrap state names Principal B. R can complete bootstrap and receive a
  session/Grant for B.
- Impact: the initial root authority can be attached to a different Principal
  than the operator registration, breaking the bootstrap identity chain.
- Required correction: require exact equality between the root operator
  registration, bootstrap state, session Principal and root Grant recipient;
  record that equality in the bootstrap event.
- Acceptance: mismatched root operator/state Principal rejects before any
  TrustedSession or AuthorityGrant insert.
- Blocks next gate: `YES`.

### REV-R3-C8-CORRECTIONS-P1-02 — Database owner privilege is not rejected by Session Role validation

- Severity: `P1`
- Original root cause: direct/indirect ownership must not remain available to a
  Runtime session role.
- Correction claim: recursive membership, attribute and direct ACL closure.
- Affected:
  - `DATABASE_FINAL_STATE_OVERLAY_R3_C8_CORRECTIONS.sql:9978-10080`
  - `SESSION_ROLE_PRIVILEGE_CLOSURE_R3_C8.md`
- Independent evidence:
  - The direct database check uses `pg_database.datacl` only to require
    `CONNECT`.
  - It does not reject `pg_database.datdba = v_role`.
  - An owner’s default database ACL can still satisfy the CONNECT test.
- Counterexample: a session login role is made owner of
  `elevator_advisor` while retaining the expected capability/bootstrap
  memberships. `validate_session_role_r3` does not reject it based on database
  ownership.
- Impact: the role can cross the intended ownership boundary through the
  database owner attribute rather than role membership.
- Required correction: explicitly reject database owner, schema owner, table
  owner, function owner and sequence owner; recheck the same ownership closure
  before every request.
- Acceptance: owner-by-database-attribute, owner-by-ACL and indirect owner
  variants all reject with a stable SQLSTATE.
- Blocks next gate: `YES`.

### REV-R3-C8-CORRECTIONS-P1-03 — CatalogReview source revision is not tied to the reviewed target

- Severity: `P1`
- Original root cause: a valid CatalogSourceRevision can be paired with an
  unrelated review target.
- Correction claim: immutable CatalogReview event with source, target Product/
  Specification/Price revision, policy and decision.
- Affected:
  - `DATABASE_FINAL_STATE_OVERLAY_R3_C8_CORRECTIONS.sql:8621-8738`
  - `DATABASE_FINAL_STATE_OVERLAY_R3_C8_CORRECTIONS.sql:8740-8820`
- Independent evidence:
  - `catalog_review_event_r3.source_revision_id` has a direct FK to
    `catalog_source_revision(id)`.
  - The target FKs bind product/specification/price revisions.
  - No immutable relation or digest proves that the source revision belongs to
    the target product/specification/price.
- Counterexample: a valid source revision for Product A is submitted as the
  source for a review of Product B. The source FK and target FKs both pass; the
  event digest records the cross-object pairing as if it were authoritative.
- Impact: Snapshot CatalogReview can be internally consistent but cite the
  wrong source for the reviewed revision.
- Required correction: add an authoritative source-to-target relation, or
  include a target/source binding digest in both CatalogSourceRevision and the
  event; enforce it during event creation and snapshot verification.
- Acceptance: Product A source with Product B target rejects; source/revision
  swap and same-ID source content swap reject.
- Blocks next gate: `YES`.

## P2

### REV-R3-C8-CORRECTIONS-P2-01 — Bootstrap recovery after a lost root response is not executable

- Severity: `P2`
- Files:
  - `DATABASE_FINAL_STATE_OVERLAY_R3_C8_CORRECTIONS.sql:10212-10305`
  - `AUTHORITY_BOOTSTRAP_AND_DATABASE_CONNECT_R3_C8.md`
- Problem: the root session and root Grant have a bounded expiry. Once the
  bootstrap state is `COMPLETE`, `bootstrap_complete_root_r3` rejects a retry.
  If the root response is lost before it issues a normal Grant, the documented
  recovery is only an external deployment action; no controlled recovery
  function, second bootstrap generation, or root rotation protocol is
  specified.
- Risk: an empty database can reach `COMPLETE` while the only root session/Grant
  becomes unusable.
- Required correction: define an authorized root-session recovery/rotation
  transaction with two approvals, audit and one-time state transition.
- Acceptance: lost-response retry and expired-root-session recovery are both
  deterministic and cannot create a second unapproved root.
- Blocks next gate: `NO` for the static design, but implementation must not
  proceed until the recovery gate is closed.

### REV-R3-C8-CORRECTIONS-P2-02 — Original Session revocation is not considered for cross-Session replay

- Severity: `P2`
- File: `DATABASE_FINAL_STATE_OVERLAY_R3_C8_CORRECTIONS.sql:10347-10445`
- Problem: the ledger compares Principal, scope, payload and the current epoch,
  and records replay audit. It does not check whether the original Session was
  revoked at the time of cross-Session replay. A new Session of the same
  Principal with the same current epoch can recover the result after the
  original Session was revoked.
- Risk: revocation semantics and idempotent recovery have overlapping but
  distinct purposes. The design must explicitly permit or reject this case.
- Required correction: read the original TrustedSession state under an explicit
  lock/epoch rule and define whether post-revocation result recovery is
  authorized.
- Acceptance: original revoked/new valid Session, epoch unchanged and epoch
  advanced cases each produce a documented deterministic result.
- Blocks next gate: `NO`, but must be settled before Runtime.

### REV-R3-C8-CORRECTIONS-P2-03 — Corrections validator has test blind spots

- Severity: `P2`
- Files:
  - `tools/validate_corrections.py`
  - `evidence/VALIDATION_R3_C8_CORRECTIONS.json`
- Problem: it reports 28/28 and 13/13 but its checks are mostly marker names.
  It does not detect the missing root Principal equality or database-owner
  acceptance. An independent check found both.
- Independent evidence: the final checker reports 32/37 checks passing and
  identifies five failed checks: Catalog source-target binding,
  database-owner rejection, protected-object owner rejection, bootstrap root
  Principal binding and bootstrap recovery. Thirteen targeted mutations were
  detected when judged by new failures relative to the unchanged baseline.
- Risk: a green Corrections validator is not evidence of complete semantic
  consistency.
- Required correction: add independent checks and mutation fixtures for
  root/operator Principal equality, database/schema/table/function owner
  rejection and CatalogReview source-target binding.
- Acceptance: removing each of these DDL constraints causes a dedicated
  validator failure.
- Blocks next gate: `NO`, but the validator claim must be downgraded to partial.

## P3

### REV-R3-C8-CORRECTIONS-P3-01 — Source fact value domains are not fully constrained

- Severity: `P3`
- File: `DATABASE_FINAL_STATE_OVERLAY_R3_C8_CORRECTIONS.sql:970-1060`
- Problem: the new Requirement FieldValue identity chain is strong, but
  `value_type`, `unit` and `field_status` on `requirement_field_value_r3` do not
  have the same closed domains as Selection/Snapshot records.
- Required correction: add explicit domain checks and matching selection
  ingestion validation.
- Acceptance: unknown type/status/unit combinations reject before source fact
  insertion.
- Blocks next gate: `NO`.

### REV-R3-C8-CORRECTIONS-P3-02 — Tooling path safety is improved but not a runtime boundary

- Severity: `P3`
- Files: `tools/generate_complete_ddl_r3_c8_corrections.py`,
  `tools/build_function_registry_r3_c8_corrections.py`
- Problem: the new tools use fixed paths and no arbitrary overwrite target, but
  they still overwrite their own generated output and do not authenticate the
  executing process beyond the outer shell wrapper. This review again observed
  read-only requests selected with Bash execution mode reach CMD or fail before
  execution, confirming that the runner boundary remains relevant.
- Required correction: retain the documented PowerShell-only invocation and
  add a runner-level shell/identity guard outside this design package.
- Acceptance: wrong shell or wrong working root fails before writing.
- Blocks next gate: `NO`.
