# Design Object Cross Reference R3-C8 Corrections R2

## Object Inventory

Independent balanced-block parsing produced:

```text
Tables:                    71
FK declarations:          119
Final function signatures:145
Triggers:                 169
Roles:                     26
```

This matches the input summary counts.

## Foreign Keys

Five FK structure discrepancies were found.

### F-01 Binding → CatalogSourceRevision

```text
Child:
  catalog_source_target_binding_r2(
    source_revision_id,
    source_evidence_object_id,
    source_content_digest
  )

Parent:
  catalog_source_revision(
    id,
    evidence_object_id,
    raw_content_digest
  )
```

No exact 3-column UNIQUE/PK exists on the parent. The parent UNIQUE includes
`source_kind` and `captured_at`, so it cannot satisfy this FK.

### F-02 CatalogReviewEvent → Binding

The Event FK references 12 binding columns. The Binding UNIQUE contains 14
columns, including `source_evidence_object_id` and `source_content_digest`.
PostgreSQL requires an exact unique key, so the FK is invalid.

### F-03/04 ProfessionalReview result FKs

`selection_professional_review_result` and
`sales_snapshot_professional_review_r3` both declare:

```text
(selection_candidate_result_id, candidate_id, result_row_digest)
```

Neither source table has `candidate_id`.

### F-05 Bootstrap Root Session → Lifecycle

`bootstrap_root_session_generation_fk_r2` uses source column
`root_session_id`, but the table column is `session_id`. The current
`bootstrap_lifecycle_r2` reference is also mutable history, not an immutable
Generation key.

## Trigger Cross Reference

All 169 Trigger statements resolve to existing functions in the final DDL and
the trigger function definitions precede their first trigger creation.

No Trigger target error was found.

## Function Registry

Independent extraction and comparison:

```text
DDL final signatures:       145
Registry signatures:        145
Missing from Registry:        0
Extra in Registry:            0
Owner mismatches:             0
Return-type mismatches:       0
Security-mode mismatches:     0
Missing owners in Registry:   0
```

Registry/DDL agreement is positive, but does not prove PostgreSQL compilation.

## ACL / PUBLIC

The R2 overlay creates new functions after the frozen DDL's final blanket
PUBLIC function revoke. It revokes PUBLIC only from:

- `owner_closure_digest_r2`;
- `assert_protected_owner_closure_r2`;
- `requirement_field_domain_valid_r2`.

It does not add a final all-functions revoke after R2 function creation.

Highest-risk mutable SECURITY DEFINER helpers without internal identity checks:

```text
claim_bootstrap_request_r2
complete_bootstrap_request_r2
append_bootstrap_event_r2
```

The final ACL therefore depends on the unspecified DDL execution role and its
default privileges. The design cannot demonstrate no-PUBLIC-EXECUTE for all R2
functions.

## Overlay / Complete DDL Relationship

The complete DDL is exactly:

```text
frozen Corrections R1 complete DDL
  + R2 Overlay
```

Generation is deterministic and hashes are recorded. The internal ordering of
the Bootstrap Generation transition is not transaction-safe:

- State Generation is moved before Lifecycle.
- The separating FK is not deferrable.
- New-Generation approvals are inserted before Lifecycle moves.
- Historical Approval/Root Session rows point to the mutable current Lifecycle.

## Role/Owner Model

The expanded Owner scan covers database, Schema, relation, function, procedure
and type Owners. Static design is substantially stronger than R1.

Defects:

- documented advisory lock is absent;
- no final PUBLIC function ACL closure;
- new R2 function creation role is not fixed in the DDL.

## PostgreSQL Semantic Boundary

```text
POSTGRESQL GRAMMAR: NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER
POSTGRESQL COMPILATION: NOT VERIFIED — DATABASE NOT AUTHORIZED
CATALOG INTROSPECTION: NOT VERIFIED — DATABASE NOT AUTHORIZED
TRIGGER/ACL/RUNTIME CONCURRENCY: NOT VERIFIED — DATABASE/RUNTIME NOT AUTHORIZED
```

The FK errors are static structural findings; no database execution is needed to
know that the listed target column sets do not match the declared unique keys.
