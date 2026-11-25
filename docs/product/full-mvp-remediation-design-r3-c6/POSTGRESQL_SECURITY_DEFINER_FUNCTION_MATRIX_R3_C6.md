# PostgreSQL SECURITY DEFINER Function Matrix R3-C6

| Function | Owner | EXECUTE | Public | Search path | Dynamic SQL |
|---|---|---|---|---|---|
| `open_trusted_session` | review function owner | identity broker | denied | `pg_catalog,app,app_private` | no |
| `revoke_trusted_session` | review function owner | identity broker | denied | `pg_catalog,app,app_private` | no |
| `transition_professional_review` | review function owner | reviewer capability | denied | `pg_catalog,app,app_private` | no |
| `transition_policy_review` | review function owner | author/reviewer capability | denied | `pg_catalog,app,app_private` | no |
| `create_policy_revision` | review function owner | policy author capability | denied | `pg_catalog,app,app_private` | no |
| `create_snapshot_r3` | review function owner | worker | denied | `pg_catalog,app,app_private` | no |
| `validate_snapshot_r3` | review function owner | trigger only | denied | `pg_catalog,app,app_private` | no |
| `dispatch_snapshot_validation_r3` | review function owner | trigger only | denied | `pg_catalog,app,app_private` | no |
| `source_key_r3` | table owner | controlled builder | denied | `pg_catalog,app` | no |
| `build_snapshot_basis_r6` | function owner | snapshot creator | denied | `pg_catalog,app,app_private` | no |
| `verify_snapshot_basis_r6` | function owner | validator only | denied | `pg_catalog,app,app_private` | no |

## Required Function Properties

1. All object names are schema-qualified.
2. Search path starts with `pg_catalog`.
3. No dynamic SQL or `EXECUTE format`.
4. `open_trusted_session` validates broker identity, assertion audience, epoch,
   expiry and exact DB role.
5. `transition_*` obtains actor from `session_user` and active TrustedSession.
6. Transition functions never accept actor, authority, or target state.
7. `create_snapshot_r3` derives created-by principal from TrustedSession.
8. All functions use one caller transaction.
9. Exceptions roll back without secret/stack details.
10. No function returns partial output after validation failure.

## DDL Pattern

```sql
ALTER FUNCTION app_private.validate_snapshot_r3(text)
  OWNER TO elevator_review_function_owner;
REVOKE EXECUTE ON FUNCTION app_private.validate_snapshot_r3(text)
  FROM PUBLIC;
```

The same owner/revoke pattern applies to every row above. Trigger functions have
no runtime EXECUTE grant.

