# Database DDL Static Reference Validation R3-C7

Artifact: `DATABASE_DDL_STATIC_REFERENCE_VALIDATION_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. Scope

Tool:

```text
tools/validate_ddl_references_r3_c7.py
```

Target:

```text
DATABASE_COMPLETE_DDL_R3_C7.sql
```

The tool parses declarations lexically. It does not compile SQL, connect to a
database or inspect `pg_catalog`.

## 2. Executed Command

```text
PYTHONDONTWRITEBYTECODE=1 python -B tools/validate_ddl_references_r3_c7.py DATABASE_COMPLETE_DDL_R3_C7.sql
```

## 3. Result

```text
Result: PASS
Tables: 46
Views: 8
Functions: 44
Roles: 15
SECURITY DEFINER functions: 31
Explicit function grants/revokes: 10
FK column pairs checked: 45
Key columns checked: 24
View-qualified columns checked: 250
Function-qualified columns checked: 272
Undefined function references: 0
Undefined relation references: 0
Missing function owner: 0
Unknown owner role: 0
Unknown grant signature: 0
Missing fixed search_path: 0
Dynamic SQL: 0
Missing required FK fragment: 0
```

## 4. Checks

The validator checks:

- duplicate function signatures;
- declaration/owner signatures;
- GRANT/REVOKE function signatures;
- all `app.*` calls resolve to `CREATE FUNCTION`;
- all `FROM/JOIN/INSERT/UPDATE/DELETE` relation references resolve to a table or
  view in the design;
- all owner names resolve to declared roles;
- every SECURITY DEFINER body has fixed `pg_catalog` search path;
- no dynamic `EXECUTE format`;
- PUBLIC function EXECUTE is revoked;
- no `app.<...>` or empty function-body placeholders remain;
- required provenance FK fragments exist.
- every local and referenced FK column exists in the declared table inventory;
- FK local/target column counts match.
- PRIMARY KEY / UNIQUE columns exist in the same table.
- qualified View columns for resolvable base-table aliases exist.
- qualified function-body columns for resolvable table aliases exist.

## 5. Future Catalog Introspection

After separate DB authorization, compare:

- `pg_proc` signature, owner, `prosecdef`, `proconfig`, ACL;
- `pg_constraint` type, columns, referenced columns and deferrability;
- `pg_trigger` event mask, row/statement timing and function OID;
- `pg_class.relacl`, `pg_namespace.nspacl`;
- `pg_default_acl`;
- role attributes, memberships, ADMIN/SET/INHERIT;
- effective privileges using `has_table_privilege`, `has_function_privilege`,
  `has_schema_privilege` and role-membership queries.

This document does not claim those runtime checks occurred.

Retained output:

```text
evidence/ddl-static-reference-r3-c7.json
```
