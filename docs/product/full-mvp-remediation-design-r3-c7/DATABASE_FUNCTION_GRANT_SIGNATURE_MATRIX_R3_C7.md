# Database Function Grant Signature Matrix R3-C7

Artifact: `DATABASE_FUNCTION_GRANT_SIGNATURE_MATRIX_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

Machine-readable registry:

```text
database_function_signature_registry_r3_c7.json
```

## 1. External Callable Functions

| Function | Exact signature | Owner | EXECUTE roles | Public |
|---|---|---|---|---|
| `open_trusted_session` | `(text,text,bigint,text,text,text,text,text,timestamptz,timestamptz,timestamptz)` | review function owner | identity broker | denied |
| `revoke_trusted_session` | `(text,text)` | review function owner | identity broker | denied |
| `advance_principal_epoch` | `(text,text)` | review function owner | identity broker | denied |
| `revoke_authority_grant` | `(text,text)` | review function owner | security admin | denied |
| `create_policy_revision` | `(text,text,text,bigint,text,text,text,text,text)` | review function owner | policy author | denied |
| `transition_policy_review` | `(text,bigint,app.policy_command,text,text,text)` | review function owner | policy author, policy reviewer | denied |
| `transition_professional_review` | `(text,bigint,app.professional_review_command,text,text,text,text,text)` | review function owner | professional reviewer | denied |
| `seal_selection_run` | `(text,bigint,text)` | review function owner | Worker | denied |
| `create_snapshot_r3` | `(text,text,bigint)` | review function owner | Worker | denied |
| `finalize_snapshot_r3` | `(text,bigint)` | review function owner | Worker | denied |

The policy command is the enum type, not `text`. The ProfessionalReview command
is the dedicated enum type with eight total arguments.

## 2. Protected Helper Functions

These are callable only from owned controlled functions/triggers:

```text
source_key_r3(text,text,text,boolean,text)
has_project_authority(text,text,text)
policy_digest(text)
policy_is_effective(text)
selection_result_digest(text)
snapshot_record_count(text)
build_snapshot_basis_r6(text)
verify_snapshot_basis_r6(bytea,text)
```

No runtime role receives direct EXECUTE.

## 3. Private Functions

The 31 `app_private` functions have no runtime EXECUTE grant. The role
`elevator_review_function_owner` owns them and SECURITY DEFINER callers execute
them through trusted bodies.

## 4. Negative Privilege Proof

The DDL contains:

```sql
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL VIEWS IN SCHEMA app FROM PUBLIC;
```

Trigger functions additionally have no runtime GRANT. Runtime Web and Worker
cannot create, alter or replace functions.

## 5. Static Validation

Definition, invocation and explicit GRANT/REVOKE signatures were compared by
`validate_ddl_references_r3_c7.py`.

```text
Functions: 44
Security definite functions: 31
Explicit function grants/revokes indexed: 10
Unknown grant signatures: 0
Missing owners: 0
Result: PASS
```

Future Catalog introspection must compare the exact same signatures to database
OIDs and pro ACLs.
