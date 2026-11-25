# Database Role and Privilege Matrix R3-C8 Corrections

## Roles

Existing C8 roles remain. The corrections add:

| Role | Login | Purpose |
|---|---|---|
| `elevator_catalog_reviewer` | no | immutable Catalogue Review event producer |
| `elevator_catalog_publisher` | no | controlled immutable PriceRevision producer |
| `elevator_bootstrap_seed` | no | one-time deployment seed capability |
| `elevator_bootstrap_initiator` | no | first bootstrap approval capability |
| `elevator_bootstrap_approver` | no | second bootstrap approval capability |
| `elevator_root_issuer` | no | initial `AUTHORITY_ISSUE` root capability |
| `elevator_session_bootstrap_seed` | yes | one-time fixed bootstrap seed login |
| `elevator_session_bootstrap_initiator` | yes | fixed bootstrap initiator login |
| `elevator_session_bootstrap_approver` | yes | fixed bootstrap approver login |
| `elevator_session_root_issuer` | yes | fixed root issuer login |

Dynamic lifecycle roles must be:

```text
LOGIN / NOINHERIT / NOSUPERUSER / NOCREATEDB / NOCREATEROLE
NOREPLICATION / NOBYPASSRLS / CONNECTION LIMIT 1
direct database CONNECT
exact capability membership with INHERIT FALSE, SET TRUE, ADMIN FALSE
exact elevator_session_bootstrap membership with INHERIT FALSE, SET TRUE, ADMIN FALSE
no direct schema/table/sequence/function privileges
```

## Privilege Chain

```text
database deployment principal
  -> fixed bootstrap login roles + direct CONNECT
  -> bootstrap operator approvals
  -> root issuer session bound to backend
  -> first GLOBAL AUTHORITY_ISSUE Grant
  -> normal AuthorityGrant issuance
  -> dynamic session role creation
  -> SET ROLE capability
  -> controlled Function/View
```

`validate_session_role_r3` recursively checks the membership closure, option
bits and direct object privileges at registration, activation and each
`lock_current_session` call. A grant or membership change during an active
Session fails closed at the next request.

## Prohibited Direct Access

Runtime and session roles receive no direct:

```text
app schema USAGE/CREATE
app/app_private table DML/TRUNCATE
app sequence privileges
app/app_private function EXECUTE
```

Capability roles receive only the explicit View SELECT and Function EXECUTE
grants in the final DDL. PUBLIC receives no protected relation, function, View
or type privilege.

## Open Decision Dependencies

The actual role provisioning service, identity broker, credential custody,
break-glass ownership and deployment topology remain open decisions. This
matrix defines the technical target, not an approval of those operational
choices.
