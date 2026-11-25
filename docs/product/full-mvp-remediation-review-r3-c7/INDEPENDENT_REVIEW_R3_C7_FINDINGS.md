# Independent Review R3-C7 Findings

## Counts

```text
P0: 0
P1: 6
P2: 6
P3: 1
```

## P1

### REV-R3-C7-P1-01 — Snapshot Candidate provenance FK remains partial

- Related: `REV-R3-C6-P1-01`, `REV-R3-C5-P1-02`, `REV-R3-C4-P1-03`,
  `REV-R3-C4-P2-03`
- Files:
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:326-369`
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:481-510`
- Problem:
  - `SelectionCandidateResult` has a full candidate/context/revision uniqueness
    tuple.
  - `SnapshotCandidate`, however, references it only by
    `(selection_result_item_id,candidate_id,selection_run_id)`.
  - Its separately stored `product_id`, ProductRevision ID/digest,
    SpecificationRevision ID/digest and RuleSet ID/digest are not in that FK.
  - Snapshot Candidate has no direct FK to ProductRevision or
    SpecificationRevision.
- Counterexample: a valid result item R/candidate C/run S can be used while the
  Snapshot Candidate states Product P2, ProductRevision PR2, Specification SR2,
  RuleSet Q2 and arbitrary statuses. The shown FK still passes.
- Impact: the final Basis can encode provenance that differs from the sealed
  SelectionResult. This is the exact original provenance attack in a narrower
  form.
- Required correction: use one exact result uniqueness key containing every
  Registry provenance field and reference that full key, or add equivalent
  direct/composite FKs plus an exact equality constraint trigger.
- Acceptance: `PROV-01`, `PROV-02`, `PROV-04`, `PROV-09` mutations reject by a
  named DB constraint regardless of which writer performs them.

### REV-R3-C7-P1-02 — Snapshot source/review/warning children are not content-bound or completeness-checked

- Related: `REV-R3-C4-P1-03`, `REV-R3-C4-P2-02`,
  `REV-R3-C5-P1-02`, `REV-R3-C5-P2-02`
- Files:
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:453-478`
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:581-677`
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:929-958`
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:2585-2606`
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:2620-2688`
- Problem:
  - RequirementField, Source, CatalogReview, ProfessionalReview, Warning and
    MissingField children use key-only FKs to sealed inputs.
  - Their Basis-visible values, digests, source identity, decision and ordering
    fields are not proven equal to the referenced sealed row.
  - `require_no_active_snapshot_children_r3` checks only candidate count and
    parameter/price orphan rows. It does not compare source, review, warning,
    missing-field or requirement-field populations to the sealed SelectionRun.
- Counterexample: keep the same source revision ID but replace
  `evidence_object_id`, `raw_content_digest`, source kind and auxiliary text;
  all shown FKs pass. Separately delete all warning rows before finalization;
  candidate completeness still passes and a smaller, internally consistent
  Basis is accepted.
- Impact: the Snapshot can be incomplete or semantically different from the
  sealed run while all local Basis checks remain green.
- Required correction: bind every copied business field by exact composite
  key or verified digest; compare all canonical child populations and counts
  against the sealed selection tables before FINALIZED.
- Acceptance: mutate or omit one source/review/warning/missing/requirement
  field and finalization rejects with a specific constraint/check identity.

### REV-R3-C7-P1-03 — TrustedSession accepts shared/generic login roles and is not connection-bound

- Related: `REV-R3-C5-P1-03`, `REV-R3-C4-P1-04`,
  `REV-R3-C6-P1-03`
- Files:
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:1431-1494`
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:3387-3395`
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:3203-3219,3554-3564`
- Problem:
  - `open_trusted_session` accepts any role satisfying `rolcanlogin`,
    non-superuser and non-BYPASSRLS.
  - It does not reject shared `elevator_runtime_web` /
    `elevator_runtime_worker`, require a session-role marker, check
    `rolconnlimit=1`, or bind the TrustedSession to one backend/connection.
  - `lock_active_session` later treats every backend using that role as the same
    session.
- Counterexample: the broker passes `elevator_runtime_web` as
  `p_db_auth_role`. A second connection using the same role is indistinguishable
  from the first and satisfies the active-session lookup. SESS-06 and the
  copied-connection threat are not closed.
- Impact: shared-role or copied-credential reuse can bypass the intended
  one-session/per-user isolation.
- Required correction: provision session roles through a DB-verifiable
  registry, reject reserved/shared/owner roles, enforce one live backend, bind
  role + backend/session nonce, and grant Views/functions to those exact
  session roles or their capability groups.
- Acceptance: shared role, second concurrent backend, copied credential,
  revoked session and stale epoch all reject before business locks.

### REV-R3-C7-P1-04 — SECURITY DEFINER and broker execution privilege graph is incomplete

- Related: `REV-R3-C4-P2-04`, `REV-R3-C5-P2-04`
- Files:
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:3403-3411`
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:3460-3512`
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:3514-3552`
- Problem:
  - SECURITY DEFINER functions and Views are owned by
    `elevator_review_function_owner`.
  - That role has USAGE on `app_private`, but no USAGE on schema `app` and no
    SELECT/INSERT/UPDATE/DELETE grants on the tables/Views it must access.
  - `elevator_table_owner`, which owns every table, also lacks USAGE on schema
    `app`.
  - `elevator_identity_broker` receives EXECUTE on session functions but no
    USAGE on schema `app`.
- PostgreSQL privilege semantics require schema USAGE for object lookup, and a
  SECURITY DEFINER body executes with the owner's object privileges. The
  function/table owners are different and no cross-grants exist.
- Impact: the controlled functions and broker calls cannot execute in a real
  database, or will fail on the first table/function lookup.
- Required correction: grant minimal schema USAGE and exact table/View/function
  privileges to each owner role; grant broker schema USAGE; prove no direct
  business-role grants were introduced.
- Acceptance: Catalog introspection shows all owner-required USAGE/table rights
  and all business calls succeed only through intended functions/Views.

### REV-R3-C7-P1-05 — Core selection and ProfessionalReview creation paths are absent

- Related: `REV-R3-C4-P1-04`, `REV-R3-C5-P1-04`,
  `REV-R3-C6-P1-01`
- Files:
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:2059-2130`
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:753-820`
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:1889-2019`
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:3514-3552`
- Problem:
  - There is no controlled INSERT/create path for `selection_run`,
    `selection_candidate`, `selection_candidate_result`, price/parameter result
    rows, `professional_review`, or the initial `CREATED` professional event.
  - All runtime table DML is revoked. `seal_selection_run` assumes populated
    selection rows, and ProfessionalReview transition expects an existing
    `CREATED` event.
- Counterexample: a clean database has no reachable route to create the rows
  required before `seal_selection_run` or `transition_professional_review`.
- Impact: the core workflow cannot start without an undeclared owner/migration
  write, which would bypass the designed session/authority/audit path.
- Required correction: define controlled create/ingest functions with active
  Session, exact AuthorityGrant, context FKs, immutability and audit, and grant
  them to the appropriate runtime/session roles.
- Acceptance: a full create -> result -> seal and create review -> submit
  transaction matrix runs with direct table DML still denied.

### REV-R3-C7-P1-06 — `trusted_session_status_v` is not caller-bound and can disclose all sessions

- Related: `REV-R3-C6-P2-01`, `REV-R3-C5-P2-04`
- File: `DATABASE_COMPLETE_DDL_R3_C7.sql:3321-3334,3557-3561`
- Problem: the View filters on an AuthorityGrant belonging to the target
  session's principal:

```sql
FROM app.trusted_session ts
WHERE EXISTS (
  SELECT 1 FROM app.authority_grant g
  WHERE g.principal_id=ts.principal_id
    AND g.authority_code='SESSION_AUDIT'
)
```

It does not check `session_user`, an active caller TrustedSession or current
epoch. Yet SELECT is granted to `elevator_readonly_auditor`.
- Counterexample: any holder of the View SELECT privilege can read every
  session associated with any principal holding `SESSION_AUDIT`, including
  revoked/expired rows.
- Impact: cross-principal session metadata disclosure and incorrect
  presentation of revoked sessions.
- Required correction: join the caller role to an active TrustedSession and
  current epoch, scope returned sessions to the auditor's authority, and
  explicitly distinguish historical audit rows from active status rows.
- Acceptance: a caller with no current session/authority gets zero rows; a
  scoped auditor sees only authorized principal/project sessions.

## P2

### REV-R3-C7-P2-01 — Database R6 encoder still diverges from Node/Python/protocol

- Files:
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:1075-1079`
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:1151-1211`
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:1282-1290`
- Problems:
  - SQL `stable_key_r3` accepts one or two components without checking the
    Registry-specific arity.
  - Header `r6_field_allowed` only checks tag 1..14 and any allowed scalar,
    rather than the exact type per tag.
  - SQL DECIMAL validation omits the 18-total-digit precision check enforced by
    Node/Python. A 19-digit canonical decimal passes SQL validation.
- Impact: database-generated records can be accepted even though the normative
  Node/Python encoder rejects them; Basis bytes are not universally
  authoritative.
- Correction: encode exact per-record tag/type tables in SQL and add the same
  max+1 database-side reject vectors.
- Acceptance: all scalar, Header and StableKey vectors produce identical
  accept/reject categories in PostgreSQL, Node and Python.

### REV-R3-C7-P2-02 — SourceKey Unicode normalization differs between encoders and SQL

- Files:
  - `tools/r6_encoder_r3_c7.js:134-150`
  - `tools/r6_encoder_r3_c7.py:128-139`
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:1033-1040`
- Problem: Node/Python normalize source auxiliary text from NFD to NFC and
  accept it. SQL `source_key_r3` requires input to already be NFC and rejects
  NFD. The R3-C7 SourceKey evidence explicitly records `SRC-AUX-NFD=ACCEPT`.
- Impact: the same logical source identity succeeds in the application encoders
  but fails in the database path unless all callers perform an unwritten
  pre-normalization step.
- Correction: normalize in SQL before encoding, or reject NFD in both
  encoders; persist the exact preimage used by the key.
- Acceptance: one NFD vector returns identical accept/reject and complete bytes
  in PostgreSQL, Node and Python.

### REV-R3-C7-P2-03 — Policy creation and Selection sealing do not honor request idempotency

- Files:
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:1659-1731`
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:2059-2130`
- Problem:
  - `create_policy_revision` accepts a Request ID but performs no prior-request
    lookup. Repeating the same request with a new revision number creates a new
    draft/event instead of returning the original result.
  - `seal_selection_run` declares `p_request_id` but never uses it.
- Impact: retries after lost responses can create duplicate policy drafts or
  fail as a generic CAS conflict rather than safely replaying the committed
  result.
- Correction: add request-scoped unique keys and replay lookup before new
  mutation; bind Request ID to operation, principal/session and payload hash.
- Acceptance: identical retry returns one committed result; changed hash
  conflicts; concurrency produces one row.

### REV-R3-C7-P2-04 — AuthorityGrant is not session-bound; creation may record a different grant than the one authorizing scope

- Files:
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:822-836`
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:1382-1399`
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:1680-1720`
- Problem: `authority_grant` has no Session binding. `lock_active_session`
  chooses the first matching capability grant without project/policy filters;
  `create_policy_revision` then records that grant ID even when a separate
  project-scoped grant satisfied `has_project_authority`.
- Impact: audit evidence can name a grant that does not authorize the created
  object, and grants can be used from multiple Sessions without an explicit
  policy decision.
- Correction: make scope-specific grant selection deterministic and record that
  exact locked grant; either bind grants to Session or document and constrain
  principal-level reuse.
- Acceptance: the recorded grant always contains the exact project/action/policy
  scope and remains active through commit.

### REV-R3-C7-P2-05 — Business state domains and effective-pointer relationships are underconstrained

- Files:
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:342-346`
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:491-498`
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:712-750`
- Problem:
  - Status, decision, source-kind, price-basis and related ENUM fields are plain
    `text` without closed CHECK domains.
  - `policy_current` references Revision and Event IDs independently, without a
    composite FK proving the Event belongs to that Revision and policy.
  - `policy_review_event.policy_id` is not tied to the Revision's `policy_id`.
- Impact: unknown business states can enter Basis/read models; an owner-side
  pointer/policy inconsistency can look effective until Runtime.
- Correction: define explicit enums/CHECKs and composite uniqueness/FKs for
  current pointer identity and Event-policy equality.
- Acceptance: unknown state values reject and impossible pointer/revision/event
  combinations are impossible by constraint.

### REV-R3-C7-P2-06 — Truncate protection is incomplete for selection and policy pointer state

- Files:
  - `DATABASE_COMPLETE_DDL_R3_C7.sql:3157-3176`
- Problem: TRUNCATE guards exist for `selection_run`, but not for
  `selection_candidate`, `selection_candidate_result`, candidate price/parameter
  tables, `selection_run_seal`, or `policy_current`.
- Impact: a table-owner/migration mistake can erase sealed selection/current
  policy evidence without the row immutability trigger firing.
- Correction: add BEFORE TRUNCATE guards and remove TRUNCATE privileges from
  every non-dedicated owner path.
- Acceptance: every protected table rejects TRUNCATE even for the application
  table owner unless a separately approved recovery operation is active.

## P3

### REV-R3-C7-P3-01 — Duplicate dead assignment in policy creation

- File: `DATABASE_COMPLETE_DDL_R3_C7.sql:1704-1705`
- Problem: `v_content` is assigned
  `convert_to(p_content::text,'UTF8')`, then immediately overwritten by
  `convert_to(p_content::jsonb::text,'UTF8')`.
- Impact: harmless dead code but obscures the authoritative canonicalization
  step.
- Correction: remove the first assignment.
