# R3-C8 Finding Traceability Corrections R2

All statuses below are `DESIGN-ADDRESSED — PENDING INDEPENDENT REVIEW`.

## REV-R3-C8-CORRECTIONS-P1-01

- Original root cause: root operator Principal was not compared with bootstrap
  state/root Grant Principal.
- Previous correction: seed, approval and root issuance path.
- Independent review evidence: root role A could complete Principal B.
- R2 correction: exact operator/state/session/grant equality, Generation record
  and composite deferred FKs.
- Design file: `ROOT_PRINCIPAL_BINDING_R3_C8_R2.md`.
- DDL: `bootstrap_complete_root_r3`,
  `bootstrap_state_root_operator_fk_r2`,
  `bootstrap_root_grant_r2`.
- Positive test: exact identity completes.
- Negative test: any mismatch rejects before Insert.
- Mutation: remove root Principal equality check.
- Validation: root case matrix plus validator mutation.
- Remaining limitation: PostgreSQL PK/FK behavior not executed.
- Independent status: pending.

## REV-R3-C8-CORRECTIONS-P1-02

- Original root cause: database and protected-object Owner paths were accepted.
- Previous correction: recursive membership and direct ACL checks.
- Independent review evidence: `datdba` and protected Owner bypass.
- R2 correction: all Owner Catalog classes, membership options, implicit
  `pg_database_owner`, direct ACLs and transaction closure digest.
- Design file: `OWNER_PRIVILEGE_CLOSURE_R3_C8_R2.md`.
- DDL: `assert_protected_owner_closure_r2`,
  `validate_session_role_r3`, `assert_active_session`.
- Positive test: exact Session role passes.
- Negative test: every Owner class and SET/INHERIT/ADMIN path rejects.
- Mutation: delete each Owner check.
- Validation: 15-case matrix and six owner mutations.
- Remaining limitation: Catalog and role options require PG18 execution.
- Independent status: pending.

## REV-R3-C8-CORRECTIONS-P1-03

- Original root cause: Source Revision was not proven to belong to review target.
- Previous correction: immutable Event with source and target FKs.
- Independent review evidence: Product A Source plus Product B target passed.
- R2 correction: exact Source columns/FKs, immutable Source-Target Binding,
  binding digest, Event V2 digest and Selection/Snapshot binding FKs.
- Design file: `CATALOG_SOURCE_TARGET_BINDING_R3_C8_R2.md`.
- DDL: `catalog_source_target_binding_r2`,
  `create_catalog_source_target_binding_r2`,
  `catalog_review_event_payload_v2`.
- Positive test: exact Product/Specification/Price binding accepted.
- Negative test: wrong Source, revision, digest, target kind or Project rejects.
- Mutation: remove Binding table or Event binding digest.
- Validation: 10-case matrix and catalog mutations.
- Remaining limitation: PostgreSQL composite FK behavior not executed.
- Independent status: pending.

## REV-R3-C8-CORRECTIONS-P2-01

- Original root cause: no controlled root recovery/rotation state machine.
- Previous correction: one-time completion.
- Independent review evidence: completed Bootstrap with lost/expired root had no
  executable recovery.
- R2 correction: lifecycle state machine, generation history, request ledger,
  two-approval recovery/rotation and controlled new issuance.
- Design file: `BOOTSTRAP_RECOVERY_AND_ROTATION_R3_C8_R2.md`.
- DDL: `bootstrap_begin_root_change_r2`,
  `bootstrap_approve_root_change_r2`,
  `bootstrap_execute_root_change_r2`.
- Positive test: lost response and approved rotation.
- Negative test: one approval, duplicate generation, active old root and
  cross-Principal change.
- Mutation: remove begin/approve/execute chain.
- Validation: 10-case recovery matrix.
- Remaining limitation: transaction/crash behavior not executed.
- Independent status: pending.

## REV-R3-C8-CORRECTIONS-P2-02

- Original root cause: cross-Session replay ignored original Session revocation.
- Previous correction: Session/epoch comparison and replay audit.
- Independent review evidence: revoked Session result could be replayed.
- R2 correction: termination classes, ordinary replay allowlist, fail-closed
  denial, two-approver result recovery and one-time consumption.
- Design file: `REQUEST_LEDGER_REVOCATION_AND_RECOVERY_R3_C8_R2.md`.
- DDL: `terminate_trusted_session_r2`, `claim_command_request`,
  `command_result_recovery_r2`.
- Positive test: normal close/expiry replay and approved recovery.
- Negative test: revoked, security-revoked, disabled, stale epoch or changed
  payload.
- Mutation: remove original Session state check.
- Validation: 10-case request matrix.
- Remaining limitation: concurrent revocation/request races not executed.
- Independent status: pending.

## REV-R3-C8-CORRECTIONS-P2-03

- Original root cause: validator missed Root, Owner and Catalog invariants.
- Previous correction: 28 checks and 13 textual mutations.
- Independent review evidence: green validator missed three P1 classes.
- R2 correction: semantic checks, missing-file fail-close, Registry check,
  detailed mutation evidence and new Owner/Catalog/Root/Request/Domain fixtures.
- Design file: acceptance matrix plus evidence.
- DDL object: all three invariant groups.
- Positive test: complete package checks pass.
- Negative test: missing file/Registry and each mutated invariant fail.
- Mutation: targeted mutation list in validator.
- Validation: `VALIDATION_R3_C8_CORRECTIONS_R2.json`.
- Remaining limitation: static text analysis remains not a SQL parser.
- Independent status: pending.

## REV-R3-C8-CORRECTIONS-P3-01

- Original root cause: Requirement value domains weaker than Selection/Snapshot.
- Previous correction: source identity/digest only.
- Independent review evidence: type/unit/status accepted inconsistent values.
- R2 correction: one shared domain function and triggers on all three layers.
- Design file: `REQUIREMENT_FIELDVALUE_DOMAIN_ALIGNMENT_R3_C8_R2.md`.
- DDL: `requirement_field_domain_valid_r2`.
- Positive test: typed confirmed/proposed values.
- Negative test: unit/status/null/grammar/NFC/control violations.
- Mutation: remove Selection domain trigger.
- Validation: domain mutation plus R6 vector compatibility.
- Remaining limitation: PostgreSQL exception and cast semantics not executed.
- Independent status: pending.

## REV-R3-C8-CORRECTIONS-P3-02

- Original root cause: shell identity guard outside design/tool boundary.
- Previous correction: documentation and manual invocation.
- Independent review evidence: repeated Bash/CMD misrouting.
- R2 correction: PowerShell launcher, Python parent verification, nonce evidence,
  fixed output root and fail-closed status.
- Design file: `EXECUTION_IDENTITY_GUARD_R3_C8_CORRECTIONS_R2.md`.
- DDL object: not applicable; tool boundary.
- Positive test: guarded self-test.
- Negative test: direct Python, wrong parent, wrong image or output escape.
- Mutation: remove guard call/marker from a tool source.
- Validation: guard evidence and shell mutation.
- Remaining limitation: outer Codex wrapper remains outside repository control.
- Independent status: pending.
