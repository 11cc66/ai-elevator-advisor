# Event-only PostgreSQL Owner/Role Privilege Baseline R2

Status:

```text
DESIGN ONLY
NOT EXECUTED
EXACT DEPLOYMENT NAMES REQUIRE APPROVAL
```

## 1. Roles

| Logical role | Login | Responsibility |
|---|---|---|
| `elevator_db_admin` | No direct app use | PostgreSQL instance administration; not a business principal |
| `elevator_database_owner` | NO | owns database object namespace and database-level grants |
| `elevator_schema_owner` | NO | owns `app`/`app_private` schemas |
| `elevator_table_owner` | NO | owns protected tables and append-only triggers |
| `elevator_review_function_owner` | NO | owns Review transition and validation functions |
| `elevator_migrator` | NO runtime login | forward migration only; not routine runtime |
| `elevator_runtime_web` | Service login | ordinary Web runtime; no Event DML |
| `elevator_runtime_worker` | Service login | ordinary Worker runtime; no Event DML |
| `elevator_professional_reviewer` | Capability group | execute only approved Review transition command |
| `elevator_policy_author` | Capability group | draft policy only; no policy approval |
| `elevator_policy_reviewer` | Capability group | approve policy owned by another author |
| `elevator_readonly_auditor` | Capability login | SELECT audit views only |
| `elevator_reporting_readonly` | Capability login | SELECT approved reporting views only |
| `prn_<opaque>` | Per-principal login | identity-bound session user; membership only in approved capability |

Owner roles are `NOLOGIN NOINHERIT`. No runtime or principal login role may
own a protected table, function, sequence or schema.

## 2. Role Relationships

```text
elevator_migrator -> may SET ROLE to schema/table owner only during migration
elevator_runtime_web / worker -> no owner membership
prn_<opaque> -> at most one of reviewer/policy-author/policy-reviewer/auditor
prn_<opaque> -> never member of migrator, owner, runtime service role
elevator_review_function_owner -> not member of runtime principals
```

Reviewer and policy-author capabilities are not transitively inherited into
each other. A principal that needs both must use separate sessions and
separate identity-bound roles, approved explicitly.

## 3. Database and Schema

Conceptual DDL; exact database/schema names are deployment values:

```sql
REVOKE ALL ON DATABASE elevator_advisor FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

GRANT CONNECT ON DATABASE elevator_advisor TO
  elevator_runtime_web, elevator_runtime_worker,
  prn_reviewer_example, prn_policy_author_example,
  elevator_readonly_auditor, elevator_reporting_readonly;

GRANT USAGE ON SCHEMA app TO
  elevator_runtime_web, elevator_runtime_worker,
  elevator_professional_reviewer, elevator_policy_author,
  elevator_policy_reviewer, elevator_readonly_auditor,
  elevator_reporting_readonly;

GRANT USAGE ON SCHEMA app_private TO
  elevator_review_function_owner;

REVOKE CREATE ON SCHEMA app, app_private FROM PUBLIC;
REVOKE CREATE ON SCHEMA app, app_private FROM
  elevator_runtime_web, elevator_runtime_worker,
  elevator_professional_reviewer, elevator_policy_author,
  elevator_policy_reviewer, elevator_readonly_auditor,
  elevator_reporting_readonly;
```

The identity broker is outside the database. It selects the principal login
role and establishes a dedicated session/connection; it does not receive
owner/migrator credentials.

## 4. Protected Tables

For every Review Event, Review, current-state view and Snapshot canonical table:

```sql
REVOKE ALL ON TABLE app.professional_review_event FROM PUBLIC;
REVOKE ALL ON TABLE app.selection_rule_set_review_event FROM PUBLIC;
REVOKE ALL ON TABLE app.sales_handoff_snapshot FROM PUBLIC;
REVOKE ALL ON TABLE app.sales_snapshot_basis_metadata FROM PUBLIC;
REVOKE ALL ON TABLE app.sales_snapshot_validation_result FROM PUBLIC;
REVOKE ALL ON TABLE app.sales_snapshot_requirement_field FROM PUBLIC;
REVOKE ALL ON TABLE app.sales_snapshot_candidate FROM PUBLIC;
REVOKE ALL ON TABLE app.sales_snapshot_parameter FROM PUBLIC;
REVOKE ALL ON TABLE app.sales_snapshot_price FROM PUBLIC;
REVOKE ALL ON TABLE app.sales_snapshot_source FROM PUBLIC;
REVOKE ALL ON TABLE app.sales_snapshot_catalog_review FROM PUBLIC;
REVOKE ALL ON TABLE app.sales_snapshot_professional_review FROM PUBLIC;
REVOKE ALL ON TABLE app.sales_snapshot_warning FROM PUBLIC;
REVOKE ALL ON TABLE app.sales_snapshot_missing_field FROM PUBLIC;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  app.professional_review_event,
  app.selection_rule_set_review_event,
  app.sales_handoff_snapshot,
  app.sales_snapshot_basis_metadata,
  app.sales_snapshot_validation_result,
  app.sales_snapshot_requirement_field,
  app.sales_snapshot_candidate,
  app.sales_snapshot_parameter,
  app.sales_snapshot_price,
  app.sales_snapshot_source,
  app.sales_snapshot_catalog_review,
  app.sales_snapshot_professional_review,
  app.sales_snapshot_warning,
  app.sales_snapshot_missing_field
FROM elevator_runtime_web, elevator_runtime_worker;
```

Reviewer/policy roles also receive no direct DML on Event or Snapshot tables.
Their capability is function execution plus approved read views.

## 5. Table SELECT Matrix

| Object | Web | Worker | Reviewer | Policy Author | Auditor |
|---|---|---|---|---|---|
| latest Review view | yes | optional | yes | yes | yes |
| Review Event base table | no | no | no | no | via view only |
| policy draft view | no | no | no | yes | yes |
| current Snapshot view | yes | yes | yes | yes | yes |
| canonical child tables | no direct | no direct | no direct | no direct | via immutable view only |
| validation diagnostics | no | no | no | no | yes |

`SELECT` on a view does not imply base-table DML or TRUNCATE.

## 6. Sequences

All sequences owned by `elevator_table_owner`.

```sql
REVOKE ALL ON SEQUENCE app.<sequence_name> FROM PUBLIC;
REVOKE ALL ON SEQUENCE app.<sequence_name> FROM
  elevator_runtime_web, elevator_runtime_worker,
  elevator_professional_reviewer, elevator_policy_author,
  elevator_policy_reviewer, elevator_readonly_auditor,
  elevator_reporting_readonly;
```

Sequence next-value access is allowed only through the owned controlled
function, or is not used where a text/CUID ID is assigned by the controlled
creator. Direct sequence access by principal roles is denied.

## 7. Functions

### 7.1 Public Transition Function

```sql
ALTER FUNCTION app.transition_professional_review(
  text,integer,app.professional_review_command,text,text,text,text
) OWNER TO elevator_review_function_owner;

REVOKE EXECUTE ON FUNCTION app.transition_professional_review(
  text,integer,app.professional_review_command,text,text,text,text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.transition_professional_review(
  text,integer,app.professional_review_command,text,text,text,text
) TO elevator_professional_reviewer;
```

The function uses `SECURITY DEFINER`, `SET search_path=pg_catalog,app,app_private`,
does not use dynamic SQL, and derives actor from `session_user`.

### 7.2 Trigger and Validator Functions

```sql
REVOKE EXECUTE ON FUNCTION app_private.validate_snapshot_r2(text)
  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_private.snapshot_child_guard()
  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_private.snapshot_header_guard()
  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_private.deny_snapshot_truncate()
  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app.source_key_r3(...)
  FROM PUBLIC;
```

Runtime roles receive no EXECUTE on trigger functions. Trigger invocation is
controlled by the table owner's trigger definition.

### 7.3 Function Security Checklist

| Property | Requirement |
|---|---|
| Owner | Separate non-login owner |
| Search path | `pg_catalog` first, fixed approved schemas |
| Dynamic SQL | Prohibited |
| Caller actor input | Prohibited |
| New-state input | Prohibited; command matrix derives state |
| Authority input | Prohibited; exact AuthorityGrant lookup |
| Policy input | CAS expectation only; equal to immutable Review policy |
| Transaction | Function participates in caller transaction; one Event |
| Exception | Rollback; safe SQLSTATE; no secret detail |
| EXECUTE | Explicit capability grant only |
| Owner membership | Not inheritable by runtime/principal roles |

## 8. Default Privileges

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_migrator
  IN SCHEMA app
  REVOKE ALL ON TABLES FROM PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE elevator_migrator
  IN SCHEMA app
  REVOKE ALL ON SEQUENCES FROM PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE elevator_migrator
  IN SCHEMA app
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
```

Equivalent revokes are required for every migration/function/table owner that
can create objects in the schemas.

## 9. Role Membership and SET ROLE

- All owner/migrator roles: `NOINHERIT`.
- Principal roles: `NOINHERIT` except explicit capability assignment.
- `SET ROLE` membership is allowed only to the one capability selected for the
  session.
- No principal role has membership in `elevator_migrator`,
  `elevator_database_owner`, `elevator_schema_owner`,
  `elevator_table_owner` or `elevator_review_function_owner`.
- No principal role is `SUPERUSER`, `CREATEDB`, `CREATEROLE`, or `BYPASSRLS`.
- `SET SESSION AUTHORIZATION` by runtime roles is not granted/possible without
  superuser or membership.

## 10. Owner-Implied Access

Even a complete REVOKE cannot remove owner permissions. Therefore:

- owner roles cannot login;
- owner credentials are unavailable to application/worker/reviewer sessions;
- owner changes occur through a separately audited database administration
  path;
- a break-glass owner session is outside this design and needs explicit policy.

## 11. TRUNCATE

- No runtime/principal `TRUNCATE` grant.
- Protected tables owned by non-login owner.
- `BEFORE TRUNCATE` statement guard raises unconditionally.
- Database-owner/superuser action remains an administrative break-glass event
  that must be separately audited; it is not an ordinary application path.

## 12. Type and Extension Permissions

Principals receive `USAGE` only for reviewed enum/composite types used by
function signatures. Type creation and extension installation belong to the
database administrator, not runtime or migration runtimes unless separately
approved.

## 13. Verification Queries

Static/introspection tests in an authorized database must verify:

```sql
SELECT datname, datacl FROM pg_database WHERE datname = current_database();
SELECT nspname, nspacl FROM pg_namespace WHERE nspname IN ('app','app_private');
SELECT relname, relowner, relacl FROM pg_class
 WHERE relname LIKE 'sales_snapshot_%'
    OR relname IN ('professional_review_event','selection_rule_set_review_event');
SELECT proname, proowner, proacl, prosecdef, proconfig
  FROM pg_proc WHERE pronamespace = 'app_private'::regnamespace;
SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls,
       rolinherit, rolcanlogin
  FROM pg_roles WHERE rolname LIKE 'elevator_%' OR rolname LIKE 'prn_%';
```

Every PUBLIC privilege must be denied except explicitly reviewed non-sensitive
objects. No runtime role may appear as owner.

## 14. Open Decisions

- `OD-R3-C4-03`: exact deployment owner/function role names and provisioning.
- `OD-R3-C5-01`: trusted identity broker/session mechanism.
- `OD-R3-C5-05`: break-glass owner/DB-admin procedure and audit.

No role, grant or privilege in this document has been created.

