# Database Object and Function Inventory R3-C7

Artifact: `DATABASE_OBJECT_FUNCTION_INVENTORY_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

Authoritative source: `DATABASE_COMPLETE_DDL_R3_C7.sql`.

Machine-readable function inventory:

```text
database_function_signature_registry_r3_c7.json
```

## 1. Object Counts

```text
Schemas:  2  (app, app_private)
Tables:  46
Views:    8
Functions: 44
Roles:    15
Enums:     2
```

These are static counts from the DDL file, not PostgreSQL Catalog counts.

## 2. Table Inventory

Identity and authority:

```text
trusted_principal, principal_epoch, trusted_session, session_audit
authority_grant, project, conversation, requirement, requirement_version,
sales_case
```

Catalogue and selection:

```text
rule_set_revision, catalog_source_revision, product_revision, specification_revision,
price_revision, catalog_parameter_revision,
selection_run, selection_candidate, selection_candidate_price,
selection_candidate_parameter, selection_candidate_result,
selection_run_seal, selection_requirement_field, selection_source_result,
selection_catalog_review_result, selection_professional_review_result,
selection_warning_result, selection_missing_field_result
```

Snapshot:

```text
sales_handoff_snapshot_r3, snapshot_basis_metadata_r3,
sales_snapshot_requirement_field_r3, sales_snapshot_candidate_r3,
sales_snapshot_parameter_r3, sales_snapshot_price_r3,
sales_snapshot_source_r3, sales_snapshot_catalog_review_r3,
sales_snapshot_professional_review_r3, sales_snapshot_warning_r3,
sales_snapshot_missing_field_r3, sales_snapshot_basis_record_r3
```

Policy/review:

```text
policy_revision, policy_review_event, policy_current,
professional_review, professional_review_event, review_audit
```

## 3. View Inventory

```text
current_policy_revision_v
audit_policy_events_v
current_sales_snapshot_v
current_professional_review_v
audit_professional_review_events_v
trusted_session_status_v
authority_grant_v
selection_result_read_v
```

Every view uses `security_barrier=true`, explicit active Session/Epoch checks,
and a project/object capability predicate where project data is returned.

## 4. Function Inventory

| Schema | Function | Purpose |
|---|---|---|
| `app_private` | `u16be`, `u32be`, `u64be`, `i64be`, `sha256_hex` | deterministic binary helpers |
| `app_private` | `r6_request_hash`, `r6_field`, `r6_field_allowed`, `r6_record` | request/field/record encoding |
| `app` | `source_key_r3` | canonical SourceKey builder |
| `app_private` | `stable_key_r3` | SK-R2 record key builder |
| `app_private` | `lock_active_session`, `assert_active_session` | TrustedSession lock and final recheck |
| `app` | `open_trusted_session`, `revoke_trusted_session`, `advance_principal_epoch`, `revoke_authority_grant` | broker/security lifecycle |
| `app` | `has_project_authority`, `policy_digest(text)` | authority/digest helpers |
| `app` | `create_policy_revision`, `transition_policy_review`, `policy_is_effective` | Policy lifecycle |
| `app` | `transition_professional_review` | professional review lifecycle |
| `app` | `selection_result_digest`, `seal_selection_run` | sealed selection authority |
| `app_private` | `snapshot_record_projection_r3`, `materialize_snapshot_r3`, `refresh_snapshot_basis_records_r3` | canonical snapshot construction |
| `app` | `snapshot_record_count`, `build_snapshot_basis_r6`, `verify_snapshot_basis_r6` | Basis assembly/verification |
| `app_private` | `require_no_active_snapshot_children_r3`, `validate_snapshot_r3` | commit-time invariants |
| `app` | `create_snapshot_r3`, `finalize_snapshot_r3` | controlled Snapshot creation/finalization |
| `app_private` | `guard_snapshot_header_r3`, `guard_snapshot_child_r3`, `deny_snapshot_truncate_r3`, `dispatch_snapshot_validation_r3` | Snapshot guards |
| `app_private` | `guard_policy_revision_r3`, `guard_append_only_r3`, `deny_truncate_r3` | Policy/Event guards |
| `app_private` | `guard_selection_run_r3`, `guard_sealed_result_r3` | post-seal immutability |

## 5. Owner Classes

- review/transition/trigger functions: `elevator_review_function_owner`;
- tables: `elevator_table_owner`;
- views: `elevator_review_function_owner`;
- migration: `elevator_migrator`;
- broker, Web, Worker, auditors and capability roles are non-owner identities.

No function has a placeholder body or dynamic SQL. All SECURITY DEFINER bodies
use `SET search_path=pg_catalog,app,app_private`.

## 6. Verification Boundary

The static validator found 44 function definitions, 44 owners and no unresolved
`app.*` function call. PostgreSQL still must verify OIDs, SQL compilation,
trigger execution and ACL state in a future authorized isolated database.
