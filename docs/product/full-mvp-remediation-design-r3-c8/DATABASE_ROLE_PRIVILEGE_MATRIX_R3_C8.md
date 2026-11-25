# Database Role and Privilege Matrix R3-C8

## Roles

| Role | Login | Inherit | Attributes | Use |
|---|---|---|---|---|
| `elevator_database_owner` | no | no | non-super/non-bypass | database ownership |
| `elevator_schema_owner` | no | no | non-super/non-bypass | schemas |
| `elevator_table_owner` | no | no | non-super/non-bypass | tables |
| `elevator_function_owner` | no | no | non-super/non-bypass | non-review functions |
| `elevator_review_function_owner` | no | no | non-super/non-bypass | SECURITY DEFINER functions, triggers and Views |
| `elevator_migrator` | no | no | non-super/non-bypass | forward migration only |
| `elevator_identity_broker` | yes | no | non-super/non-bypass | session provisioning/revocation |
| `elevator_runtime_web` | no | no | capability | read Views |
| `elevator_runtime_worker` | no | no | capability | selection/snapshot functions |
| `elevator_professional_reviewer` | no | no | capability | ProfessionalReview |
| `elevator_policy_author` | no | no | capability | policy create/review |
| `elevator_policy_reviewer` | no | no | capability | policy review |
| `elevator_security_admin` | no | no | capability | grant issue/revoke |
| `elevator_readonly_auditor` | no | no | capability | bounded audit Views |
| `elevator_reporting_readonly` | no | no | capability | non-sensitive reporting |
| `elevator_session_bootstrap` | no | no | capability | Session activation only |

Session login roles are externally pre-provisioned with:

```text
LOGIN
CONNECTION LIMIT 1
NOINHERIT
NOSUPERUSER
NOCREATEDB
NOCREATEROLE
NOBYPASSRLS
```

Each role is registered by the broker after checking its single capability
membership and bootstrap membership. A generic runtime role is not accepted as
a session role.

## Required Effective Rights

| Object class | Review Function Owner | Runtime capabilities | Broker |
|---|---|---|---|
| `app` schema | USAGE | USAGE | USAGE |
| protected tables | explicit controlled DML needed by functions | no direct DML | no direct DML |
| sequences | controlled USAGE/UPDATE | none | none |
| SECURITY DEFINER functions | owner | only explicit EXECUTE | session functions only |
| Views | owner | explicit SELECT by capability | none |
| trigger functions | owner | no EXECUTE | no EXECUTE |
| enum types | USAGE | required enum USAGE | none |

## Prohibited Access

No capability role receives:

```text
SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER
on protected base tables
```

No PUBLIC role receives protected table, View, function or type usage.

## Session Role Provisioning Boundary

The external identity broker must:

1. create a unique session login role with connection limit one;
2. grant exactly one capability role with `INHERIT FALSE, SET TRUE`;
3. grant `elevator_session_bootstrap` with `INHERIT FALSE, SET TRUE`;
4. generate a high-entropy activation token;
5. call `register_session_role` with its digest;
6. deliver database credential and activation token separately;
7. call `open_trusted_session`;
8. revoke the role/session and clear its credential on logout;
9. retire the role; never reuse the same role for another Session.

The exact external broker topology remains Open Decision `OD-R3-C6-01` and
`OD-R3-C6-04`. Catalog introspection was not executed.
