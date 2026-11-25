# Independent Review R3-C5 Findings

Date: 2026-11-24

```text
P0: 0
P1: 4
P2: 6
P3: 1
```

## P0

None identified.

## P1

### REV-R3-C5-P1-01 — SOURCE_KEY_R3 allowed range exceeds the Basis limit

- Related: `REV-R3-C4-P2-06`, new source-boundary defect
- Files:
  - `docs/product/full-mvp-remediation-design-r3-c5/CANONICAL_SOURCE_IDENTITY_R3.md:50-55`
  - `docs/product/full-mvp-remediation-design-r3-c5/R3_BASIS_V4_REVISED_PROTOCOL_AND_VECTOR_SPEC.md:89`
  - `docs/product/full-mvp-remediation-design-r3-c5/tools/encode_snapshot_python.py:119-180`
  - `docs/product/full-mvp-remediation-design-r3-c5/tools/encode_snapshot_node.js:141-275`
- Problem: declared component maxima create up to 362 source-key bytes, while
  the R5 BYTES scalar permits only 256. The supplied encoders do not enforce
  256.
- Counterexample: a `USER_ASSERTION` with an entity type of 64 bytes, entity ID
  of 64 bytes and auxiliary text of 128 UTF-8 bytes produces a valid logical
  SOURCE_KEY_R3 larger than 256 bytes.
- Root cause: component limits and Basis scalar limit were designed separately.
- Impact: typed source identities can be valid at the source layer and
  unrepresentable in the Snapshot Basis.
- Required correction: choose one consistent limit at least as large as 362,
  or reduce component limits; enforce in SQL, both generators and verifier.
- Acceptance: max-bound fixture reconstructs identical bytes; +1 byte rejects
  identically in all implementations.

### REV-R3-C5-P1-02 — Registry/Schema/Basis still omit or fail to bind business provenance

- Related: `REV-R3-C4-P1-03`, `REV-R3-C4-P2-03`
- Files:
  - `SNAPSHOT_NORMALIZED_CHILD_SCHEMA_R2.md:199-325`
  - `SNAPSHOT_REGISTRY_R2.md:99-119`
  - `SNAPSHOT_REGISTRY_SCHEMA_BASIS_CROSSWALK_R2.md:73-114`
- Problems:
  1. Candidate `product_revision_id`, `specification_revision_id` and
     `price_revision_id` have no FK to their immutable source revisions. The
     Candidate source FK covers only ID/run/context/rule-set (lines 229–237).
  2. Price has no source revision, valid-from/valid-to, or immutable Price
     Revision FK.
  3. Parameter `catalog_parameter_revision_id` is in the schema but absent
     from Registry, Basis and Crosswalk.
  4. Snapshot `rule_set_revision_id` is in the envelope but absent from the
     Header Basis record.
- Counterexample: a `SelectionCandidateResult` can identify product revision
  P1 while the Snapshot Candidate row claims P2; the shown FK still passes.
  Likewise a Price row can reference an arbitrary/unverified price revision
  and no source revision.
- Impact: the Basis can be internally byte-correct while describing
  provenance that differs from the immutable source facts. The Crosswalk’s
  one-to-one claim is false.
- Required correction: add exact source/product/specification/price revision
  fields and FKs, Price validity/source fields, Parameter catalog revision in
  the Registry/Basis, and classify every remaining envelope field.
- Acceptance: mutation of every business revision/source field is either
  blocked by FK or changes the Basis; no business field is unclassified.

### REV-R3-C5-P1-03 — Trusted Principal is not bound to a verifiable session lifecycle

- Related: `REV-R3-C4-P1-04`
- File:
  - `TRUSTED_PRINCIPAL_AUTHORITY_TRANSITION_DESIGN_R2.md:31-50,136-152,254-294`
- Problem: the DB sees only `session_user` plus principal validity dates. It
  has no assertion ID, login/session epoch, DB backend identity, session expiry
  or revocation row. Broker “audience/session/replay protection” is not
  represented in a database-verifiable object.
- Counterexample: user A logs out or loses the application session while the
  principal-bound DB connection remains open. The function continues to see
  `session_user=A` and accepts new request IDs until the principal or
  authority is globally revoked.
- Impact: stale/replayed sessions can create new audit events; the trust chain
  still depends on an unverified external promise.
- Required correction: add an authenticated session record and exact
  DB-visible binding: principal, session/assertion ID, audience, issued/expiry,
  login epoch, backend/process identity or broker session, revocation; bind
  each transition request to a live session.
- Acceptance: logout/revoke immediately rejects the old session; copying a
  session credential to another connection fails; request replay fails across
  epochs.

### REV-R3-C5-P1-04 — Policy Revision lifecycle has no executable schema

- Related: `REV-R3-C4-P1-04`
- File:
  - `TRUSTED_PRINCIPAL_AUTHORITY_TRANSITION_DESIGN_R2.md:194-215`
- Problem: “Policy Revision becomes effective only from an immutable
  PolicyReviewEvent” appears only as prose. There is no table DDL, event
  sequence/state constraint, author/approver relationship, unique key, current
  view, append-only trigger or privilege matrix for it.
- Counterexample: policy content can be inserted or an `APPROVED` value can be
  represented without a verifiable PolicyReviewEvent; the Review Event still
  references the policy ID and passes the stated FK.
- Impact: exact policy approval, author/approver separation and effective
  policy identification are not enforceable.
- Required correction: define PolicyRevision and PolicyReviewEvent DDL,
  immutable content digest, creator/approver principals, event sequence/CAS,
  current-state view, effective-policy uniqueness, append-only and grants.
- Acceptance: no policy can bind unless an APPROVED event from a different
  authorized principal exists; replay/concurrent approval yields one event.

## P2

### REV-R3-C5-P2-01 — Finalization CAS references an undefined column

- File:
  - `SNAPSHOT_DEFERRED_VALIDATION_CONTRACT_R2.md:234-253`
  - `SNAPSHOT_NORMALIZED_CHILD_SCHEMA_R2.md:25-56`
- Problem: `WHERE ... version_vector = expected` references a column absent
  from the Snapshot DDL.
- Correction: add a monotonic version/CAS column, or use the existing
  `version_number` plus row lock and state condition consistently.

### REV-R3-C5-P2-02 — Deferred validation remains only partially executable

- File:
  - `SNAPSHOT_DEFERRED_VALIDATION_CONTRACT_R2.md:65-179`
- Problem: only the header guard has full SQL; child guard and TRUNCATE guard
  are prose. `validate_snapshot_change()` is never defined and
  `validate_snapshot_r2` body is `BEGIN ... END`.
- Correction: publish exact trigger functions, owner, fixed search_path,
  grants, event matrix, exception codes and final-state queries.

### REV-R3-C5-P2-03 — Warning sequence references an unstored ordering key

- Files:
  - `SNAPSHOT_REGISTRY_R2.md:160-175`
  - `SNAPSHOT_NORMALIZED_CHILD_SCHEMA_R2.md:454-475`
- Problem: deterministic sequence assignment sorts by `sourceWarningId`, but
  that ID is absent from Registry, schema and Basis.
- Counterexample: two warnings have identical code/text but different source
  IDs; their sequence order cannot be reconstructed or audited from the
  Snapshot.
- Correction: add immutable sourceWarningId or another persisted unique
  tie-breaker and include it or its canonical derivation in the Basis.

### REV-R3-C5-P2-04 — PostgreSQL privilege baseline omits authorization objects and exact provisioning

- File:
  - `EVENT_ONLY_POSTGRESQL_OWNER_ROLE_PRIVILEGE_BASELINE_R2.md:11-133,172-224`
- Problems:
  - no `CREATE ROLE`, `ALTER ROLE`, `GRANT ROLE`, ADMIN/SET/INHERIT statements;
  - `trusted_principal`, `authority_grant`, PolicyRevision and
    PolicyReviewEvent are absent from protected object grants;
  - views named in the matrix have no DDL, owner or `security_barrier`;
  - trigger function owner and trigger object privileges are prose;
  - default privileges are only reset for migrator.
- Correction: provide complete role/object inventory and exact owner/grant/
  revoke/default-privilege DDL for every authorization object and view.

### REV-R3-C5-P2-05 — Supplied encoders do not enforce the complete R5 scalar contract

- Files:
  - `tools/encode_snapshot_node.js:230-275`
  - `tools/encode_snapshot_python.py:150-180`
- Problem: numeric/string validators omitted. Examples:
  - no TEXT 4,000-scalar cap;
  - no canonical decimal grammar/range check;
  - BOOLEAN accepts truthiness rather than exact boolean;
  - BYTES/sourceKey does not enforce 256;
  - source auxiliary does not reject control characters.
- Impact: Node/Python byte agreement can still accept inputs the normative
  protocol requires rejecting.
- Correction: add complete rejection vectors and independent verifier
  enforcement.

### REV-R3-C5-P2-06 — Test plan omits the remaining high-risk semantic cases

- File:
  - `P1_PRODUCT_REMEDIATION_TEST_PLAN_R3_C5.md`
- Missing:
  - SOURCE_KEY_R3 max/+1;
  - Price source revision, validity and price-revision mismatch;
  - Parameter catalog revision mismatch;
  - Candidate product/specification revision mismatch;
  - Rule-set revision absent from Basis;
  - session logout/expiry and stale connection;
  - PolicyReviewEvent and effective-policy uniqueness;
  - warning tie-break identity.
- Correction: add tests before any independent PASS can be considered.

## P3

### REV-R3-C5-P3-01 — Registry-separation vector uses a hypothetical registry code

- Files:
  - `STABLE_KEY_TEST_VECTORS_R2.json`
  - `SNAPSHOT_STABLE_KEY_TUPLE_ENCODING_R2.md:28-42`
- Problem: SK-R2 declares registry code 2 for SNAPSHOT-R2 and unknown
  registry versions reject, while the test encodes hypothetical registry 3.
- Correction: distinguish “codec accepts arbitrary domain byte” from
  “production Registry version registry” and label the test explicitly as a
  synthetic framing-only vector.

