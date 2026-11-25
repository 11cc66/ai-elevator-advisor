# TrustedSession and Snapshot Independent Audit R3-C8

## TrustedSession

### Positive Static Evidence

- `trusted_session.db_auth_role` is unique.
- `session_role_registry.role_name` and `session_id` are unique.
- A session role is registered only by `elevator_identity_broker`.
- Activation requires `session_user`, registry assignment, token digest and
  expiry.
- Activation stores backend PID, `pg_stat_activity.backend_start`, binding
  digest and the session GUC.
- Request gates re-check `session_user`, backend PID/start, active binding,
  binding GUC, current PrincipalEpoch, expiry and registry state.
- Revocation and epoch advancement use update locks in the same coarse order as
  request-path share locks.
- Final-state recheck before each successful command prevents revocation from
  committing concurrently past held share locks.

### Remaining Blocking Issues

1. Role validation is incomplete:
   - no `rolcreatedb`;
   - no `rolcreaterole`;
   - no `rolinherit`;
   - no per-membership INHERIT/SET/ADMIN options;
   - no recursive membership closure;
   - no check for direct object DML.
2. No dynamic session login role receives an explicit direct database
   `CONNECT` grant.
3. No clean bootstrap path creates the first AuthorityGrant.

Current verdict:

```text
Backend Instance Binding:
PARTIAL — mechanism present, privilege closure incomplete

Token Replay:
PARTIAL — one-use state transition present, PostgreSQL behavior not executed

Role Membership / Inheritance:
PARTIAL — direct one-hop checks only

Clean Session-to-Command Path:
FAIL — CONNECT and root-grant bootstrap incomplete
```

## AuthorityGrant

### Corrected in C8

- Recipient `principal_id` is no longer conflated with
  `subject_principal_id`.
- Audit subject is required for `SESSION_AUDIT`/`AUTHORITY_AUDIT`.
- Ordinary capabilities reject a subject Principal.
- `object_scope` is constrained to `GLOBAL`, `PROJECT`, `POLICY` or
  `PRINCIPAL`.
- `lock_authority_grant` and `has_current_authority` use the same scope model.

### Remaining Issues

- No initial `AUTHORITY_ISSUE` Grant can be created from a clean database.
- No unique constraint decides which duplicate active Grant is authoritative.
- `revoke_authority_grant` does not check `FOUND` before updating zero rows.
- The Request Ledger stores but does not compare `session_id`.

## Session Status/Audit View Matrix

| Caller | Own active session | Other Principal without subject grant | Other Principal with subject grant | Revoked session |
|---|---|---|---|---|
| Unbound caller | No row / authority path fails | Reject/zero | Reject/zero | Not in status view |
| Ordinary capability caller | Visibility only if granted View; own status path evaluates | Reject/zero | Reject/zero | Not in status view |
| Session owner | Own active row | Reject/zero | Only if a subject-scoped audit grant exists | Historical audit only |
| `SESSION_AUDIT` holder, subject P | Own row | Reject/zero | P's authorized row | `trusted_session_audit_v` with current authority |
| Unrelated Principal | Own row if separately granted | Reject/zero | Reject/zero | Not visible |
| Revoked caller | No active current context | Reject/zero | Reject/zero | Not a caller |
| Invalid epoch | Current authority false | Reject/zero | Reject/zero | Audit unavailable until new active session |

The `trusted_session_status_v` predicate resolves the caller through
`current_session_context()` and requires a subject-scoped
`SESSION_AUDIT` grant for another Principal. It no longer grants visibility
merely because the target Principal holds `SESSION_AUDIT`. This closes the
specific C7 P1-06 attack at static design level.

## Snapshot Provenance

| Snapshot child | Source row | Content binding | Independent status |
|---|---|---|---|
| Candidate | SelectionCandidateResult | Full result payload digest + exact FK | `RESOLVED STATIC` |
| RequirementField | SelectionRequirementField | Digest matches sealed row, but source IDs are not FK-bound | `PARTIAL` |
| Source | SelectionSourceResult | Full copied source payload digest | `RESOLVED STATIC` |
| CatalogReview | SelectionCatalogReviewResult | Digest matches sealed row, but review/target/source IDs lack source FKs | `PARTIAL` |
| ProfessionalReview | SelectionProfessionalReviewResult | Digest matches sealed row, but decision/basis/time/target can be forged and IDs lack FK | `NOT RESOLVED` |
| Warning | SelectionWarningResult | Full copied warning payload digest | `RESOLVED STATIC` |
| MissingField | SelectionMissingFieldResult | Full copied missing-field payload digest | `RESOLVED STATIC` |
| Parameter | SelectionCandidateParameter | Full parameter content digest | `RESOLVED STATIC` |
| Price | SelectionCandidatePrice / PriceRevision | Digest omits amount/currency/basis/tax/applicability/validity/time | `NOT RESOLVED` |

## Completeness and Final Basis

Positive:

- The set comparison covers candidates, requirements, sources, catalog reviews,
  professional reviews, warnings, missing fields, parameters and prices.
- Comparison is bidirectional with `EXCEPT`.
- Snapshot child guards lock the parent and reject changes after FINALIZED.
- `finalize_snapshot_r3` refreshes basis records while holding the Snapshot row
  lock, then rebuilds and verifies bytes and metadata.
- All Snapshot state tables have deferred constraint triggers.
- All Snapshot state tables have named TRUNCATE guards.

Remaining defect:

- The comparison proves Snapshot equals the sealed Selection rows, not that the
  sealed Selection rows equal authoritative Requirement, Price, CatalogReview
  and ProfessionalReview facts.
- The Price digest omits the business amounts and validity fields.

## Concurrency Assessment

The following are design-level protections:

- parent-row mutation lock during Snapshot child writes;
- Snapshot finalization CAS and row lock;
- session/epoch share locks held through command execution;
- final active-session recheck;
- selection/run/event locks around event sequence;
- exact request ledger uniqueness.

Still unverified:

- PostgreSQL lock/wait behavior under concurrent transactions;
- trigger ordering and deferred execution;
- truncate cascades;
- connection pool/session reset behavior;
- actual graph of role memberships in production provisioning.

```text
Runtime Concurrency:
NOT VERIFIED — RUNTIME NOT AUTHORIZED
```
