# PostgreSQL Owner / Role / Privilege Independent Audit R3-C6

Date: 2026-11-24

## 1. Result

```text
PostgreSQL Owner / Role / Privilege: FAIL
Findings: REV-R3-C6-P1-02, REV-R3-C6-P1-04, REV-R3-C6-P2-01, REV-R3-C6-P2-02
```

The role taxonomy is improved, but the document is not yet an executable
least-privilege baseline. Several objects and grants cannot resolve, and some
protected views are undefined.

## 2. Positive Role Design

`POSTGRESQL_OWNER_ROLE_PRIVILEGE_BASELINE_R3_C6.md:19-37` distinguishes:

- database, schema, table and review-function owners;
- migration role;
- identity broker;
- Web and Worker runtime;
- professional reviewer and policy roles;
- read-only auditor/reporting roles.

It states that no role is SUPERUSER, CREATEDB, CREATEROLE or BYPASSRLS, and
uses NOINHERIT. The database/schema section revokes PUBLIC access and restricts
schema creation.

`POSTGRESQL_SECURITY_DEFINER_FUNCTION_MATRIX_R3_C6.md:3-40` identifies a fixed
search path starting with `pg_catalog`, denies PUBLIC execution and forbids
dynamic SQL for the listed functions.

These are appropriate design directions.

## 3. Function Signature Mismatch

Declared policy transition signature:

```text
app.transition_policy_review(
  text, bigint, text, text, text, text, text
)
```

Granted signature:

```text
app.transition_policy_review(
  text, bigint, text, text, text, text
)
```

Evidence: `POLICY_TRANSITION_DDL_R3_C6.md:53-61` versus
`POSTGRESQL_OWNER_ROLE_PRIVILEGE_BASELINE_R3_C6.md:177-179`.

Declared professional transition signature has eight arguments, including
`app.professional_review_command`
(`PROFESSIONAL_REVIEW_TRANSITION_DDL_R3_C6.md:12-22`). The grant uses seven
`text`-shaped arguments
(`POSTGRESQL_OWNER_ROLE_PRIVILEGE_BASELINE_R3_C6.md:174-176`).

PostgreSQL resolves functions by exact argument types and counts. These grants
will not target the declared functions.

## 4. Undefined Functions and Views

The protected-function list names `build_snapshot_basis_r6`,
`verify_snapshot_basis_r6` and `snapshot_record_count`
(`POSTGRESQL_OWNER_ROLE_PRIVILEGE_BASELINE_R3_C6.md:120-134`), but no function
bodies exist in the design.

`current_sales_snapshot_v`, `audit_professional_review_events_v` and
`audit_policy_events_v` receive `REVOKE`/`GRANT` statements
(`POSTGRESQL_OBJECT_GRANT_AND_VIEW_MATRIX_R3_C6.md:91-106`) without complete
`CREATE VIEW` DDL. The document only says they "follow the same pattern"
(lines 79-89).

`current_professional_review_v` calls `app.has_project_authority`
(`POSTGRESQL_OBJECT_GRANT_AND_VIEW_MATRIX_R3_C6.md:39-61`), but that function
is not defined with exact signature and owner.

`current_policy_revision_v`
(`POSTGRESQL_OBJECT_GRANT_AND_VIEW_MATRIX_R3_C6.md:64-77`) selects the latest
event regardless of terminal/effective state and lacks policy/project
authority. It is not safe as an "effective policy" API.

## 5. Incomplete Per-Object Boundary

The ownership section uses placeholders:

```text
ALTER TABLE app.<protected_table>
ALTER SEQUENCE app.<sequence>
ALTER VIEW app.<read_view>
ALTER FUNCTION app.<function>
```

The default-privilege section gives one owner and instructs the operator to
"repeat" for three others without exact statements. The table matrix is useful
as policy intent, but it is not a complete per-object `GRANT`/`REVOKE` audit.

The following still require exact definitions:

- every auth/session/policy/snapshot table;
- every sequence and identity generator;
- all trigger functions and append-only/truncate triggers;
- all read/audit views;
- all SECURITY DEFINER functions;
- runtime capability role membership and SET paths;
- owner/migrator paths that can bypass runtime DML revokes.

## 6. View Security Assessment

The supplied current professional view uses `security_barrier=true` and
`security_invoker=false` with an explicit active-session check and project
authority predicate. That pattern is promising.

It is not sufficient evidence because:

- the VIEW owner is generic;
- base-table privileges and owner bypass are not fully enumerated;
- `has_project_authority` is undefined;
- revoked/expired session handling is not executed;
- the same semantics are not supplied for the other protected views.

No direct base table SELECT, sequence, function or owner-membership behavior
was tested.

## 7. Required Correction

1. Generate exact `ALTER ... OWNER` and `GRANT`/`REVOKE` statements from a
   single object inventory.
2. Correct all function grants to exact argument types and counts.
3. Define every function/view referenced by grants, triggers and security
   predicates.
4. Define effective policy/snapshot views with terminal-state exclusion,
   object/project authority and explicit session/epoch checks.
5. Expand default privileges into exact commands for every creator role and
   object type.
6. Include owner/migrator, membership, `SET ROLE`, PUBLIC and indirect-grant
   analysis.
7. Add a catalog introspection acceptance test proving exact privileges,
   owners and absence of unintended memberships.

## 8. Runtime Boundary

No PostgreSQL instance was connected. No role, schema, table, sequence, view,
function, trigger or privilege was created or queried. Runtime privilege
behavior remains `NOT VERIFIED`.
