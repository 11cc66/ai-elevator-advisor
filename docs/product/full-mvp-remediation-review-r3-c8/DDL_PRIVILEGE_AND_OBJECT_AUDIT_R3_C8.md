# DDL and Privilege Independent Audit R3-C8

## Scope and Method

Reviewed:

- `DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql`
- `R3_C8_FINAL_STATE_OVERLAY.sql`
- `DATABASE_FUNCTION_SIGNATURE_REGISTRY_R3_C8.json`
- `DATABASE_ROLE_PRIVILEGE_MATRIX_R3_C8.md`
- all four C8 tools

The review independently scanned every SQL line for object declarations,
constraints, function bodies, trigger declarations and grants. It did not run
any C8 tool, did not connect to PostgreSQL and did not execute SQL.

## Object Inventory

```text
Unique tables:                     50
Unique views:                       9
View definitions after overlay:    17
Unique functions:                  78
Function owner assignments:        78
Roles declared in DDL:             16
Parsed foreign keys:               64
Trigger declarations:             103
Deferred constraint triggers:      12
Tables with named TRUNCATE guard:  35
Unique function call targets:      32
```

Full machine-readable inventories are in
`evidence/OBJECT_INVENTORY_R3_C8.json`.

### Tables

```text
app.authority_grant
app.catalog_parameter_revision
app.catalog_source_revision
app.command_request
app.conversation
app.policy_current
app.policy_review_event
app.policy_revision
app.price_revision
app.principal_epoch
app.product_revision
app.professional_review
app.professional_review_event
app.project
app.requirement
app.requirement_version
app.review_audit
app.rule_set_revision
app.sales_case
app.sales_handoff_snapshot_r3
app.sales_snapshot_basis_record_r3
app.sales_snapshot_candidate_r3
app.sales_snapshot_catalog_review_r3
app.sales_snapshot_missing_field_r3
app.sales_snapshot_parameter_r3
app.sales_snapshot_price_r3
app.sales_snapshot_professional_review_r3
app.sales_snapshot_requirement_field_r3
app.sales_snapshot_source_r3
app.sales_snapshot_warning_r3
app.selection_candidate
app.selection_candidate_parameter
app.selection_candidate_price
app.selection_candidate_result
app.selection_catalog_review_result
app.selection_missing_field_result
app.selection_professional_review_result
app.selection_requirement_field
app.selection_run
app.selection_run_event
app.selection_run_seal
app.selection_source_result
app.selection_warning_result
app.session_audit
app.session_binding_audit
app.session_role_registry
app.snapshot_basis_metadata_r3
app.specification_revision
app.trusted_principal
app.trusted_session
```

### Views

```text
app.audit_policy_events_v
app.audit_professional_review_events_v
app.authority_grant_v
app.current_policy_revision_v
app.current_professional_review_v
app.current_sales_snapshot_v
app.selection_result_read_v
app.trusted_session_audit_v
app.trusted_session_status_v
```

## Composite Foreign-Key Audit

The independent parser found 64 `FOREIGN KEY (...)` declarations. Every one:

- has equal source/target column counts;
- references an existing `app.*` table;
- references an exact table-level PRIMARY KEY/UNIQUE tuple; and
- uses source columns present in the source table.

The C8-added product/specification/SelectionRun uniqueness constraints close the
earlier “target key was only a superset” defect.

This result does **not** close source semantics. The following authoritative
selection rows contain unbound business identifiers:

| Source row | Not FK-bound |
|---|---|
| `selection_requirement_field` | `requirement_version_id`, `source_revision_id`, `source_value_id` |
| `selection_catalog_review_result` | `catalog_review_id`, `source_revision_id`, `target_revision_id` |
| `selection_professional_review_result` | `professional_review_event_id`, `professional_review_id`, `target_revision_id` |

See `REV-R3-C8-P1-02`.

## Functions, Owners and Search Path

- Registry signatures and DDL signatures match: `78/78`.
- Owner assignments match: `78/78`.
- Registry reports 62 SECURITY DEFINER and 16 INVOKER functions.
- All SECURITY DEFINER Registry entries have `pg_catalog` first in
  `search_path`.
- Registry call graph has 32 unique known targets and no unresolved qualified
  call name.
- Registry reports no PUBLIC execute.
- The source scan found no unresolved qualified call target.

The C8 Registry tool overwrites `execute_roles` on repeated GRANT statements
instead of unioning them. Current output is not contradicted by this review, but
the builder is not a reliable general-purpose grant audit.

## Schema/Object Privileges

Static grant review confirms:

- `elevator_table_owner`, `elevator_review_function_owner` and
  `elevator_identity_broker` receive schema `app` USAGE.
- `elevator_review_function_owner` receives schema/table/sequence access needed
  by SECURITY DEFINER functions and triggers.
- Runtime capability roles receive View SELECT and selected function EXECUTE,
  not direct base-table DML.
- PUBLIC table/view/function/type access is revoked.
- `elevator_runtime_web`, `elevator_runtime_worker`,
  `elevator_readonly_auditor` and `elevator_reporting_readonly` are changed to
  NOLOGIN capability roles.

Two blocking gaps remain:

1. Dynamic session login roles have no specified direct `CONNECT` grant.
2. The only AuthorityGrant insert path requires an existing AuthorityGrant; no
   clean-start root grant/bootstrap path exists.

See `REV-R3-C8-P1-04`.

Additionally, `validate_session_role_r3` checks only direct role membership and
a subset of role attributes. See `REV-R3-C8-P1-03`.

## Trigger and Deferred Validation

- 103 trigger declarations were parsed.
- 12 are deferred constraint triggers covering the Snapshot header, nine
  displayed child classes, basis records and basis metadata.
- Snapshot child INSERT/UPDATE/DELETE guard functions acquire the parent row
  lock and reject mutation after `FINALIZED`.
- Selection, Policy, audit and 35 tables have named TRUNCATE denial triggers.
- `professional_review` itself has no named UPDATE/DELETE/TRUNCATE lifecycle
  trigger.

The design can verify final Snapshot set equality and Basis bytes, but the
source-content gaps in C8 P1-01/P1-02 mean the final state can still encode
facts not proven by the claimed authoritative sources.

## Main DDL / Overlay Relationship

The C8 main DDL is generated as:

```text
frozen R3-C7 baseline
  -> explicit C8 final-state marker
  -> R3-C8 ALTER/CREATE OR REPLACE corrections
  -> explicit end marker
```

The main DDL contains both markers, the auto-owner placeholder is resolved, and
there are no duplicate overlay table/role/trigger names or changed function
return types. The standalone overlay is not a complete DDL by itself; it must
be applied after the frozen C7 base. That dependency is documented in C8 and is
therefore `PASS STATIC` for marker/order consistency, while PostgreSQL grammar
remains unverified.

## PostgreSQL Evidence Boundary

```text
PostgreSQL SQL Grammar:
NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER

PostgreSQL Compilation:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Catalog Introspection:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Trigger/ACL/Concurrency Behavior:
NOT VERIFIED — DATABASE NOT AUTHORIZED
```

All findings in this audit are static design findings. No database statement
was executed.
