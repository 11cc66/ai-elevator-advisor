# PostgreSQL Owner / Role / Privilege Baseline R3-C7

Artifact: `POSTGRESQL_OWNER_ROLE_PRIVILEGE_BASELINE_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. Role Set

| Role | Login | Inherit | Purpose |
|---|---|---|---|
| `elevator_database_owner` | no | no | database ownership |
| `elevator_schema_owner` | no | no | schema ownership |
| `elevator_table_owner` | no | no | protected tables |
| `elevator_function_owner` | no | no | non-review functions |
| `elevator_review_function_owner` | no | no | review/transition/trigger functions and Views |
| `elevator_migrator` | no | no | controlled migration only |
| `elevator_identity_broker` | yes | no | Session lifecycle |
| `elevator_runtime_web` | yes | no | current read Views |
| `elevator_runtime_worker` | yes | no | sealed/selection/Snapshot controlled functions |
| `elevator_professional_reviewer` | no | no | review transition capability |
| `elevator_policy_author` | no | no | policy create/transition capability |
| `elevator_policy_reviewer` | no | no | policy transition capability |
| `elevator_security_admin` | no | no | grant revocation |
| `elevator_readonly_auditor` | yes | no | current/audit Views |
| `elevator_reporting_readonly` | yes | no | non-sensitive current Views |

No owner, migrator or capability role is SUPERUSER, CREATEDB, CREATEROLE or
BYPASSRLS. No runtime role inherits owner membership.

Session-bound database login roles are dynamically created per TrustedSession
and receive one capability role with `INHERIT FALSE, SET TRUE`. Their exact
provisioning remains an Open Decision.

## 2. Ownership

- database: database owner;
- schemas: schema owner;
- tables: table owner;
- views and review/transition/trigger functions: review function owner;
- other deterministic helpers: function owner where appropriate;
- migration role does not remain a runtime identity.

The complete DDL assigns every table, View and function explicitly.

## 3. Default Privileges

Exact `ALTER DEFAULT PRIVILEGES` blocks exist for:

```text
elevator_migrator
elevator_schema_owner
elevator_table_owner
elevator_function_owner
elevator_review_function_owner
```

Each revokes PUBLIC privileges on tables, sequences, functions and types.

## 4. Protected Object Access

- runtime roles: no direct protected table DML;
- broker: controlled session functions only;
- policy roles: controlled policy functions only;
- reviewers: controlled professional transition only;
- security admin: controlled AuthorityGrant revocation only;
- auditor/reporting: protected read Views only;
- trigger functions: no runtime EXECUTE;
- sequences: no runtime access.

## 5. Bypass-Surface Controls

The design covers:

- database/schema CREATE;
- table/sequence FUNCTION/TRIGGER/REFERENCES privileges;
- PUBLIC function EXECUTE;
- DEFAULT PRIVILEGES for every creator;
- owner membership and SET ROLE;
- SECURITY DEFINER search path;
- trigger function ownership;
- View owner/invoker semantics;
- direct base-table read bypass.

## 6. Future Introspection

Run after separate database authorization:

```text
pg_roles
pg_auth_members
pg_class.relacl/relowner
pg_namespace.nspacl/nspowner
pg_proc.proacl/proowner/proconfig/prosecdef
pg_default_acl
has_*_privilege(...)
```

No Catalog query was executed in R3-C7.
