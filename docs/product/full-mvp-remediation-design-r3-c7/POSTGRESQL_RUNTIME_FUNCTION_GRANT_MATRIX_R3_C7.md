# PostgreSQL Runtime Function Grant Matrix R3-C7

Artifact: `POSTGRESQL_RUNTIME_FUNCTION_GRANT_MATRIX_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. Runtime EXECUTE Matrix

| Role | Function | Exact signature |
|---|---|---|
| `elevator_identity_broker` | `app.open_trusted_session` | `(text,text,bigint,text,text,text,text,text,timestamptz,timestamptz,timestamptz)` |
| `elevator_identity_broker` | `app.revoke_trusted_session` | `(text,text)` |
| `elevator_identity_broker` | `app.advance_principal_epoch` | `(text,text)` |
| `elevator_security_admin` | `app.revoke_authority_grant` | `(text,text)` |
| `elevator_policy_author` | `app.create_policy_revision` | `(text,text,text,bigint,text,text,text,text,text)` |
| `elevator_policy_author` | `app.transition_policy_review` | `(text,bigint,app.policy_command,text,text,text)` |
| `elevator_policy_reviewer` | `app.transition_policy_review` | `(text,bigint,app.policy_command,text,text,text)` |
| `elevator_professional_reviewer` | `app.transition_professional_review` | `(text,bigint,app.professional_review_command,text,text,text,text,text)` |
| `elevator_runtime_worker` | `app.seal_selection_run` | `(text,bigint,text)` |
| `elevator_runtime_worker` | `app.create_snapshot_r3` | `(text,text,bigint)` |
| `elevator_runtime_worker` | `app.finalize_snapshot_r3` | `(text,bigint)` |

## 2. Non-Grants

The following have no direct runtime EXECUTE:

```text
source_key_r3
has_project_authority
policy_digest
policy_is_effective
selection_result_digest
snapshot_record_count
build_snapshot_basis_r6
verify_snapshot_basis_r6
all app_private functions
all trigger functions
```

The functions are called from SECURITY DEFINER owner bodies or triggers.

## 3. Signature Validation

The original C6 mismatch is removed:

```text
Policy definition = 7 arguments
Policy grant      = 7 arguments

ProfessionalReview definition = 8 arguments
ProfessionalReview grant      = 8 arguments
```

The second policy argument in the ProfessionalReview signature is the enum
`app.professional_review_command`, and the policy command is
`app.policy_command`.

Static validator result:

```text
Unknown grant signatures: 0
Missing owners: 0
Duplicate function signatures: 0
```

## 4. Public Privileges

```text
app:        REVOKE EXECUTE ON ALL FUNCTIONS FROM PUBLIC
app_private: REVOKE ALL ON ALL FUNCTIONS FROM PUBLIC
```

No function relies on default PUBLIC EXECUTE.

## 5. Catalog Gate

Future PostgreSQL introspection must compare these strings to `pg_proc`
`proargtypes`, owner and ACL. This design did not execute them.
