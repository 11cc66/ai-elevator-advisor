# Database Function Call Graph R3-C7

Artifact: `DATABASE_FUNCTION_CALL_GRAPH_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. High-Level Graph

```text
snapshot creation
  -> lock_active_session
  -> materialize_snapshot_r3
       -> stable_key_r3
  -> refresh_snapshot_basis_records_r3
       -> snapshot_record_projection_r3
       -> r6_record
  -> build_snapshot_basis_r6
  -> validate_snapshot_r3
       -> require_no_active_snapshot_children_r3
       -> build_snapshot_basis_r6
       -> verify_snapshot_basis_r6
       -> snapshot_record_count
       -> source_key_r3
  -> assert_active_session
```

```text
policy transition
  -> lock_active_session
  -> policy revision/current row locks
  -> request replay lookup
  -> sequence/state/CAS validation
  -> event insert
  -> current-pointer CAS
  -> assert_active_session
```

## 2. Exact Static Edges

| Caller | Direct R3-C7 callees |
|---|---|
| `r6_request_hash` | `sha256_hex` |
| `r6_field` | `u16be`, `u32be` |
| `source_key_r3` | `r6_field`, `u16be` |
| `stable_key_r3` | `i64be`, `u16be`, `u32be` |
| `r6_record` | `r6_field_allowed`, `r6_field`, `i64be`, `u16be`, `u32be` |
| `policy_digest` | `sha256_hex` |
| `create_policy_revision` | `lock_active_session`, `assert_active_session`, `has_project_authority`, `policy_digest`, `r6_request_hash` |
| `transition_policy_review` | `lock_active_session`, `assert_active_session`, `r6_request_hash` |
| `revoke_authority_grant` | `lock_active_session`, `assert_active_session` |
| `transition_professional_review` | `lock_active_session`, `assert_active_session`, `policy_is_effective`, `r6_request_hash` |
| `selection_result_digest` | `sha256_hex` |
| `seal_selection_run` | `lock_active_session`, `assert_active_session`, `selection_result_digest` |
| `snapshot_record_projection_r3` | `stable_key_r3`, `source_key_r3` |
| `materialize_snapshot_r3` | `stable_key_r3` |
| `refresh_snapshot_basis_records_r3` | `snapshot_record_projection_r3`, `r6_record` |
| `build_snapshot_basis_r6` | `u16be`, `u32be`, `u64be` |
| `verify_snapshot_basis_r6` | `snapshot_record_projection_r3`, `r6_record`, `u16be`, `u32be`, `u64be` |
| `validate_snapshot_r3` | `require_no_active_snapshot_children_r3`, `source_key_r3`, `build_snapshot_basis_r6`, `verify_snapshot_basis_r6`, `snapshot_record_count`, `sha256_hex` |
| `create_snapshot_r3` | `lock_active_session`, `materialize_snapshot_r3`, `refresh_snapshot_basis_records_r3`, `build_snapshot_basis_r6`, `sha256_hex`, `validate_snapshot_r3`, `assert_active_session` |
| `finalize_snapshot_r3` | `lock_active_session`, `refresh_snapshot_basis_records_r3`, `build_snapshot_basis_r6`, `sha256_hex`, `validate_snapshot_r3`, `assert_active_session` |
| `dispatch_snapshot_validation_r3` | `validate_snapshot_r3` |
| `guard_policy_revision_r3` | `policy_digest` |

Other trigger guard functions have no R3-C7 function callee and operate on their
trigger row/relation.

## 3. Undefined Reference Check

The static validator scanned every `app.*`/`app_private.*` function call against
the 44-function Registry:

```text
Undefined function references: 0
Undefined relation references: 0
Missing owner: 0
Unknown owner role: 0
Mismatched GRANT signatures: 0
Undefined FK columns: 0
Undefined key columns: 0
Undefined resolvable View columns: 0
Undefined resolvable function columns: 0
Dynamic SQL functions: 0
Missing fixed search_path on SECURITY DEFINER: 0
```

This is lexical design checking. PostgreSQL compilation and Catalog OIDs remain
unverified.
