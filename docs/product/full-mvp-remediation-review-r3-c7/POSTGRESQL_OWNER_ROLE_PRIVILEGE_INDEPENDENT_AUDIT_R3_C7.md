# PostgreSQL Owner / Role / Privilege Independent Audit R3-C7

## Result

```text
Role declaration/attributes: PASS — static
Object ownership declarations: PASS — static
Required execution privilege graph: FAIL — P1-04
View caller binding: FAIL — P1-06
Catalog verification: NOT VERIFIED
```

## Role Matrix

| Role | Login | Inherit | Super/Bypass | Intended Use |
|---|---|---|---|---|
| database owner | no | no | no | database ownership |
| schema owner | no | no | no | schemas |
| table owner | no | no | no | tables |
| function owner | no | no | no | non-review functions |
| review function owner | no | no | no | SECURITY DEFINER/View owner |
| migrator | no | no | no | migration |
| identity broker | yes | no | no | session lifecycle |
| runtime web | yes | no | no | runtime reads |
| runtime worker | yes | no | no | controlled worker functions |
| professional reviewer | no | no | no | review transition |
| policy author | no | no | no | policy create/review |
| policy reviewer | no | no | no | policy review |
| security admin | no | no | no | grant revocation |
| readonly auditor | yes | no | no | audit Views |
| reporting readonly | yes | no | no | reporting Views |

No role is declared SUPERUSER, CREATEDB, CREATEROLE or BYPASSRLS.

## P1-04: Owner/broker execution is under-provisioned

`GRANT USAGE ON SCHEMA app` includes runtime/business/capability roles but
omits:

- `elevator_review_function_owner`;
- `elevator_table_owner`;
- `elevator_identity_broker`.

Every table is owned by `elevator_table_owner`; all SECURITY DEFINER functions
and Views are owned by `elevator_review_function_owner`. No explicit table or
function grants are made to the review owner. PostgreSQL SECURITY DEFINER runs
with the owner's privileges, so the owner must have schema and table
privileges. The broker also must have schema USAGE to reach its functions.

## P1-06: Session status View

`trusted_session_status_v:3321-3334` checks only that the *target* session's
principal has a `SESSION_AUDIT` grant. It never checks the caller's
`session_user`, active session or epoch. Since SELECT is granted to the
read-only auditor, that caller can read all sessions belonging to any principal
with a SESSION_AUDIT grant.

## P2-06: TRUNCATE

Selection candidate/result/price/parameter/seal tables lack TRUNCATE guards.

## P2-05: State domains

Many Status/decision/source fields are unconstrained `text`; unknown values can
enter Snapshot Basis.

## Runtime Boundary

No role, ACL, View or function was executed. Catalog and effective privilege
checks remain `NOT VERIFIED`.
