# PostgreSQL 18 Semantics Evidence R3-C8 Corrections R2

## Sources Read

The following official PostgreSQL 18 documentation pages were read directly
during design, without installing or changing any PostgreSQL component:

```text
https://www.postgresql.org/docs/18/role-membership.html
https://www.postgresql.org/docs/18/role-attributes.html
https://www.postgresql.org/docs/18/predefined-roles.html
https://www.postgresql.org/docs/18/ddl-priv.html
```

## Membership

- `SET TRUE` permits `SET ROLE`; `SET ROLE` can select a direct or indirect
  member when every SET edge is true.
- `INHERIT TRUE` permits automatic inherited privileges through a membership
  chain; `INHERIT FALSE` stops that automatic path.
- `ADMIN TRUE` permits membership administration and is treated as security
  reachability even when INHERIT and SET are false.
- LOGIN, SUPERUSER, CREATEDB and CREATEROLE are role attributes and are not
  inherited like ordinary object privileges.
- Circular role membership is prevented by PostgreSQL.

## Predefined Role

- `pg_database_owner` has exactly one implicit member: the current database
  Owner.
- It cannot be granted to another role and no role can be granted membership in
  it.
- Owning objects or receiving grants through `pg_database_owner` transfers
  those capabilities to the current database Owner.

The R2 Owner Closure therefore checks `pg_database.datdba`, all recursive
memberships, and `pg_has_role(...,'MEMBER')`.

## Object Ownership and Privileges

- An object has an Owner at creation.
- The Owner can alter/drop the object and implicitly controls its grant options.
- The right to modify or destroy an object is inherent in ownership and cannot
  be revoked through an ordinary ACL.
- Object permissions can be inherited by members of the owning role.
- Table-like objects, sequences, functions/procedures, schemas, types and
  domains have different applicable privilege sets.

The R2 validator rejects Owner reachability in addition to direct ACLs; ACL
checks alone are insufficient.

## R2 Interpretations

```text
ordinary Session membership:
  exactly two memberships, INHERIT FALSE, SET TRUE, ADMIN FALSE

recursive closure:
  every path is inspected; unexpected role/Admin path fails

database Owner:
  direct datdba and membership reachability fail

protected Owners:
  Schema, Relation, Function/Procedure, Type/Domain OID reachability fails

request lifetime:
  closure observed at request start is rechecked before completion
```

## Evidence Boundary

Reading the official documentation does not prove that this DDL compiles or
that the current PostgreSQL deployment exposes the expected Catalog rows.

```text
PostgreSQL Grammar:
NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER

PostgreSQL Compilation/Catalog/Runtime:
NOT VERIFIED — DATABASE/RUNTIME NOT AUTHORIZED
```
