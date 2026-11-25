# Owner Closure and Lock Review

## Positive Evidence

- `lock_owner_catalog_r3` calls `pg_advisory_xact_lock` with a fixed key.
- `validate_session_role_r3` calls `assert_protected_owner_closure_r3`.
- R2 Owner scans cover database, Schema, relation, function and type Owners.
- INHERIT/SET/ADMIN and direct ACL checks remain.
- Request start/end digest comparison remains.

## Boundary

Role provisioning and object-owner change code is external to the DDL. Their
cooperation with the same advisory lock remains an implementation requirement
and an Open Decision dependency. Actual lock ordering and Catalog behavior are
`NOT VERIFIED`.
