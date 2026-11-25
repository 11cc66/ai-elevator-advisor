# PostgreSQL Owner / Role / Privilege Baseline R3-C6

Status:

```text
DESIGN ONLY
POSTGRESQL 18
NOT EXECUTED
```

Official semantics checked read-only:

- PostgreSQL 18 `CREATE ROLE`;
- `ALTER DEFAULT PRIVILEGES`;
- `CREATE TRIGGER`/constraint trigger;
- `CREATE VIEW` `security_barrier`/`security_invoker`;
- `GRANT`/`REVOKE`.

## 1. Role Creation

Executed by database administrator only:

```sql
CREATE ROLE elevator_database_owner NOLOGIN NOINHERIT;
CREATE ROLE elevator_schema_owner NOLOGIN NOINHERIT;
CREATE ROLE elevator_table_owner NOLOGIN NOINHERIT;
CREATE ROLE elevator_review_function_owner NOLOGIN NOINHERIT;
CREATE ROLE elevator_migrator NOLOGIN NOINHERIT;
CREATE ROLE elevator_identity_broker LOGIN NOINHERIT;
CREATE ROLE elevator_runtime_web LOGIN NOINHERIT;
CREATE ROLE elevator_runtime_worker LOGIN NOINHERIT;
CREATE ROLE elevator_professional_reviewer NOLOGIN NOINHERIT;
CREATE ROLE elevator_policy_author NOLOGIN NOINHERIT;
CREATE ROLE elevator_policy_reviewer NOLOGIN NOINHERIT;
CREATE ROLE elevator_readonly_auditor LOGIN NOINHERIT;
CREATE ROLE elevator_reporting_readonly LOGIN NOINHERIT;
```

No role is SUPERUSER/CREATEDB/CREATEROLE/BYPASSRLS.

## 2. Database/Schema

```sql
ALTER DATABASE elevator_advisor OWNER TO elevator_database_owner;
REVOKE ALL ON DATABASE elevator_advisor FROM PUBLIC;
GRANT CONNECT ON DATABASE elevator_advisor TO
  elevator_runtime_web, elevator_runtime_worker,
  elevator_readonly_auditor, elevator_reporting_readonly,
  elevator_identity_broker;

CREATE SCHEMA app AUTHORIZATION elevator_schema_owner;
CREATE SCHEMA app_private AUTHORIZATION elevator_schema_owner;
REVOKE ALL ON SCHEMA app, app_private FROM PUBLIC;
REVOKE CREATE ON SCHEMA app, app_private FROM
  elevator_runtime_web, elevator_runtime_worker,
  elevator_readonly_auditor, elevator_reporting_readonly;
GRANT USAGE ON SCHEMA app TO
  elevator_runtime_web, elevator_runtime_worker,
  elevator_professional_reviewer, elevator_policy_author,
  elevator_policy_reviewer, elevator_readonly_auditor,
  elevator_reporting_readonly;
GRANT USAGE ON SCHEMA app_private TO elevator_review_function_owner;
```

Session-bound login roles receive `CONNECT`, `USAGE ON app`, and exactly one
capability group; the broker creates them dynamically.

## 3. Ownership

```sql
ALTER TABLE app.<protected_table> OWNER TO elevator_table_owner;
ALTER SEQUENCE app.<sequence> OWNER TO elevator_table_owner;
ALTER VIEW app.<read_view> OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.<function> OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.<trigger_function> OWNER TO elevator_review_function_owner;
```

Object ownership is applied after migration under a separate controlled
deployment step; migration role is not a runtime identity.

## 4. Protected Objects

Tables:

```text
trusted_principal
principal_epoch
trusted_session
session_audit
authority_grant
policy_revision
policy_review_event
professional_review
professional_review_event
selection_run
selection_candidate_result
sales_handoff_snapshot_r3
snapshot_basis_metadata_r3
sales_snapshot_requirement_field_r3
sales_snapshot_candidate_r3
sales_snapshot_parameter_r3
sales_snapshot_price_r3
sales_snapshot_source_r3
sales_snapshot_catalog_review_r3
sales_snapshot_professional_review_r3
sales_snapshot_warning_r3
sales_snapshot_missing_field_r3
sales_snapshot_validation_result_r3
```

Views:

```text
current_professional_review_v
current_policy_revision_v
current_sales_snapshot_v
audit_professional_review_events_v
audit_policy_events_v
```

Functions:

```text
open_trusted_session
revoke_trusted_session
transition_professional_review
transition_policy_review
create_snapshot_r3
source_key_r3
build_snapshot_basis_r6
verify_snapshot_basis_r6
snapshot_record_count
sha256_hex
trigger/validation functions
```

## 5. Default Privileges

Run for every object-creating owner:

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_migrator IN SCHEMA app
  REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_migrator IN SCHEMA app
  REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_migrator IN SCHEMA app
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_migrator IN SCHEMA app
  REVOKE USAGE ON TYPES FROM PUBLIC;
```

Repeat with appropriate `FOR ROLE` for `elevator_schema_owner`,
`elevator_table_owner`, and `elevator_review_function_owner`.

## 6. Membership

```sql
GRANT elevator_professional_reviewer TO <session_role>
  WITH INHERIT FALSE, SET TRUE;
GRANT elevator_policy_author TO <policy_author_session_role>
  WITH INHERIT FALSE, SET TRUE;
GRANT elevator_policy_reviewer TO <policy_reviewer_session_role>
  WITH INHERIT FALSE, SET TRUE;
REVOKE ADMIN OPTION FOR elevator_professional_reviewer FROM <session_role>;
```

No session role is a member of any owner/migrator role.

## 7. Runtime APIs

```sql
GRANT EXECUTE ON FUNCTION app.create_snapshot_r3(text,text,text,text,bigint)
  TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.transition_professional_review(
  text,bigint,text,text,text,text,text
) TO elevator_professional_reviewer;
GRANT EXECUTE ON FUNCTION app.transition_policy_review(
  text,bigint,text,text,text,text
) TO elevator_policy_author, elevator_policy_reviewer;
```

Exact signatures are fixed in the function matrix. No PUBLIC EXECUTE remains.

