# Snapshot Normalized Child Schema R2

Status:

```text
SCHEMA DESIGN VERSION: SNAPSHOT-SCHEMA-R2
REGISTRY: SNAPSHOT-R2
PROTOCOL: R3-BASIS-1-R5
DDL IS A PROPOSAL; NOT EXECUTED
```

## 1. Authority

Normalized Snapshot rows are the sole Snapshot fact authority. The Basis is
computed from these rows and immutable referenced evidence. A JSON/JCS payload
is a read-only reconstruction and has no independent truth.

All foreign keys below use `ON DELETE RESTRICT ON UPDATE RESTRICT`. Ordinary
runtime roles cannot issue direct DML on protected Snapshot tables; controlled
functions create the rows.

## 2. Envelope

```sql
CREATE TABLE app.sales_handoff_snapshot (
  id text PRIMARY KEY,
  case_id text NOT NULL,
  project_id text NOT NULL,
  conversation_id text NOT NULL,
  requirement_id text NOT NULL,
  requirement_version_id text NOT NULL,
  installation_scenario text NOT NULL,
  selection_run_id text NOT NULL,
  rule_set_revision_id text NOT NULL,
  version_number bigint NOT NULL,
  state text NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamptz(6) NOT NULL,
  finalized_at timestamptz(6),
  CONSTRAINT sales_handoff_snapshot_state_chk
    CHECK (state IN ('DRAFT','FINALIZED')),
  CONSTRAINT sales_handoff_snapshot_finalized_chk
    CHECK ((state = 'DRAFT' AND finalized_at IS NULL)
        OR (state = 'FINALIZED' AND finalized_at IS NOT NULL)),
  CONSTRAINT sales_handoff_snapshot_case_version_key
    UNIQUE (case_id, version_number),
  CONSTRAINT sales_handoff_snapshot_context_key
    UNIQUE (id, project_id, conversation_id, requirement_id,
            requirement_version_id, installation_scenario),
  CONSTRAINT sales_handoff_snapshot_candidate_context_key
    UNIQUE (id, selection_run_id, project_id, conversation_id,
            requirement_id, requirement_version_id, installation_scenario),
  CONSTRAINT sales_handoff_snapshot_owner_key
    UNIQUE (id, case_id, project_id, conversation_id, requirement_id,
            requirement_version_id, installation_scenario, selection_run_id)
);
```

## 3. Basis Metadata

```sql
CREATE TABLE app.sales_snapshot_basis_metadata (
  snapshot_id text PRIMARY KEY,
  registry_revision text NOT NULL,
  protocol_revision text NOT NULL,
  stable_key_encoding text NOT NULL,
  basis_digest text NOT NULL,
  basis_byte_length bigint NOT NULL,
  record_count integer NOT NULL,
  generated_at timestamptz(6) NOT NULL,
  CONSTRAINT basis_revision_chk
    CHECK (registry_revision = 'SNAPSHOT-R2'
       AND protocol_revision = 'R3-BASIS-1-R5'
       AND stable_key_encoding = 'SK-R2'),
  CONSTRAINT basis_positive_length_chk
    CHECK (basis_byte_length > 0 AND record_count > 0),
  CONSTRAINT basis_snapshot_fk
    FOREIGN KEY (snapshot_id)
    REFERENCES app.sales_handoff_snapshot(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
);
```

## 4. Validation Results

Validation results are append-only diagnostics. The authoritative pre-commit
validation is the database constraint function. A result row is never used as
a substitute for child-row validation.

```sql
CREATE TABLE app.sales_snapshot_validation_result (
  id text PRIMARY KEY,
  snapshot_id text NOT NULL,
  validation_phase text NOT NULL,
  basis_digest text NOT NULL,
  result text NOT NULL,
  reason_code text,
  validated_at timestamptz(6) NOT NULL,
  CONSTRAINT validation_result_chk
    CHECK (result IN ('PASS','FAIL')),
  CONSTRAINT validation_snapshot_fk
    FOREIGN KEY (snapshot_id)
    REFERENCES app.sales_handoff_snapshot(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
);
```

Updates and deletes are denied by privilege and append-only trigger.

## 5. Type 1 — Requirement Field

```sql
CREATE TABLE app.sales_snapshot_requirement_field (
  id text PRIMARY KEY,
  snapshot_id text NOT NULL,
  record_type smallint NOT NULL DEFAULT 1 CHECK (record_type = 1),
  project_id text NOT NULL,
  conversation_id text NOT NULL,
  requirement_id text NOT NULL,
  requirement_version_id text NOT NULL,
  installation_scenario text NOT NULL,
  field_key text NOT NULL,
  value_type text NOT NULL,
  null_value boolean NOT NULL DEFAULT false,
  boolean_value boolean,
  integer_value bigint,
  decimal_value numeric(18,6),
  text_value text,
  enum_value text,
  canonical_id_value text,
  timestamp_value timestamptz(6),
  bytes_value bytea,
  unit text,
  field_status text NOT NULL,
  source_field_value_id text NOT NULL,
  source_kind text NOT NULL,
  source_entity_type text NOT NULL,
  source_entity_id text NOT NULL,
  source_aux_text text NOT NULL,
  source_aux_is_null boolean NOT NULL,
  source_key bytea NOT NULL,
  stable_key bytea NOT NULL,
  row_id text NOT NULL,
  CONSTRAINT req_field_exactly_one_chk
    CHECK (
      (null_value
       AND boolean_value IS NULL AND integer_value IS NULL
       AND decimal_value IS NULL AND text_value IS NULL
       AND enum_value IS NULL AND canonical_id_value IS NULL
       AND timestamp_value IS NULL AND bytes_value IS NULL)
      OR
      (NOT null_value
       AND num_nonnulls(boolean_value, integer_value, decimal_value,
                        text_value, enum_value, canonical_id_value,
                        timestamp_value, bytes_value) = 1)
    ),
  CONSTRAINT req_field_aux_chk
    CHECK ((source_aux_is_null AND source_aux_text = '')
        OR (NOT source_aux_is_null AND source_aux_text <> '')),
  CONSTRAINT req_field_source_key_chk
    CHECK (source_key = app.source_key_r3(
      source_kind, source_entity_type, source_entity_id,
      source_aux_is_null, source_aux_text)),
  CONSTRAINT req_field_snapshot_context_fk FOREIGN KEY (
    snapshot_id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario
  ) REFERENCES app.sales_handoff_snapshot (
    id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario
  ) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT req_field_source_fk FOREIGN KEY (
    source_field_value_id, requirement_version_id, requirement_id,
    project_id, conversation_id, installation_scenario,
    source_kind, source_entity_type, source_entity_id,
    source_aux_text, source_aux_is_null, source_key
  ) REFERENCES app.requirement_field_value (
    id, requirement_version_id, requirement_id, project_id,
    conversation_id, installation_scenario,
    source_kind, source_entity_type, source_entity_id,
    source_aux_text, source_aux_is_null, source_key
  ) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT req_field_business_key
    UNIQUE (snapshot_id, requirement_version_id, field_key),
  CONSTRAINT req_field_stable_key
    UNIQUE (snapshot_id, stable_key),
  CONSTRAINT req_field_row_key UNIQUE (snapshot_id, row_id),
  CONSTRAINT req_field_snapshot_ref
    UNIQUE (id, snapshot_id),
  CONSTRAINT req_field_stable_length_chk
    CHECK (octet_length(stable_key) BETWEEN 1 AND 158)
);
```

The migration must first add the shown structured/source columns and exact
UNIQUE to `requirement_field_value`; it cannot invent the parent key at runtime.

## 6. Type 2 — Candidate

```sql
CREATE TABLE app.sales_snapshot_candidate (
  id text PRIMARY KEY,
  snapshot_id text NOT NULL,
  record_type smallint NOT NULL DEFAULT 2 CHECK (record_type = 2),
  candidate_id text NOT NULL,
  selection_run_id text NOT NULL,
  project_id text NOT NULL,
  conversation_id text NOT NULL,
  requirement_id text NOT NULL,
  requirement_version_id text NOT NULL,
  installation_scenario text NOT NULL,
  rule_set_revision_id text NOT NULL,
  product_revision_id text NOT NULL,
  specification_revision_id text NOT NULL,
  price_revision_id text,
  technical_status text NOT NULL,
  commercial_status text NOT NULL,
  trust_status text NOT NULL,
  professional_review_status text NOT NULL,
  overall_status text NOT NULL,
  stable_key bytea NOT NULL,
  row_id text NOT NULL,
  CONSTRAINT snapshot_candidate_context_fk FOREIGN KEY (
    snapshot_id, selection_run_id, project_id, conversation_id,
    requirement_id, requirement_version_id, installation_scenario
  ) REFERENCES app.sales_handoff_snapshot (
    id, selection_run_id, project_id, conversation_id,
    requirement_id, requirement_version_id, installation_scenario
  ) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT snapshot_candidate_source_fk FOREIGN KEY (
    candidate_id, selection_run_id, project_id, conversation_id,
    requirement_id, requirement_version_id, installation_scenario,
    rule_set_revision_id
  ) REFERENCES app.selection_candidate_result (
    id, selection_run_id, project_id, conversation_id,
    requirement_id, requirement_version_id, installation_scenario,
    rule_set_revision_id
  ) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT snapshot_candidate_business_key
    UNIQUE (snapshot_id, candidate_id),
  CONSTRAINT snapshot_candidate_stable_key
    UNIQUE (snapshot_id, stable_key),
  CONSTRAINT snapshot_candidate_row_key UNIQUE (snapshot_id, row_id),
  CONSTRAINT snapshot_candidate_parent_key UNIQUE (id, snapshot_id),
  CONSTRAINT snapshot_candidate_stable_length_chk
    CHECK (octet_length(stable_key) BETWEEN 1 AND 158)
);
```

`price_revision_id` is nullable for a candidate without a price. If present,
the Price row and source evidence are completeness-checked at commit.

## 7. Type 3 — Parameter

```sql
CREATE TABLE app.sales_snapshot_parameter (
  id text PRIMARY KEY,
  snapshot_id text NOT NULL,
  record_type smallint NOT NULL DEFAULT 3 CHECK (record_type = 3),
  candidate_row_id text NOT NULL,
  catalog_parameter_revision_id text NOT NULL,
  parameter_key text NOT NULL,
  value_type text NOT NULL,
  null_value boolean NOT NULL DEFAULT false,
  boolean_value boolean,
  integer_value bigint,
  decimal_value numeric(18,6),
  text_value text,
  enum_value text,
  canonical_id_value text,
  timestamp_value timestamptz(6),
  bytes_value bytea,
  unit text,
  source_revision_id text NOT NULL,
  stable_key bytea NOT NULL,
  row_id text NOT NULL,
  CONSTRAINT snapshot_parameter_one_value_chk
    CHECK (NOT null_value
       AND num_nonnulls(boolean_value, integer_value, decimal_value,
                        text_value, enum_value, canonical_id_value,
                        timestamp_value, bytes_value) = 1),
  CONSTRAINT snapshot_parameter_candidate_fk
    FOREIGN KEY (candidate_row_id, snapshot_id)
    REFERENCES app.sales_snapshot_candidate(id, snapshot_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT snapshot_parameter_source_fk
    FOREIGN KEY (source_revision_id, snapshot_id)
    REFERENCES app.sales_snapshot_source(source_revision_id, snapshot_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT snapshot_parameter_business_key
    UNIQUE (snapshot_id, candidate_row_id, parameter_key),
  CONSTRAINT snapshot_parameter_stable_key
    UNIQUE (snapshot_id, stable_key),
  CONSTRAINT snapshot_parameter_row_key UNIQUE (snapshot_id, row_id),
  CONSTRAINT snapshot_parameter_stable_length_chk
    CHECK (octet_length(stable_key) BETWEEN 1 AND 158)
);
```

## 8. Type 4 — Price

```sql
CREATE TABLE app.sales_snapshot_price (
  id text PRIMARY KEY,
  snapshot_id text NOT NULL,
  record_type smallint NOT NULL DEFAULT 4 CHECK (record_type = 4),
  candidate_row_id text NOT NULL,
  price_revision_id text NOT NULL,
  amount_minor bigint NOT NULL,
  currency text NOT NULL,
  tax_basis text NOT NULL,
  applicability text NOT NULL,
  stable_key bytea NOT NULL,
  row_id text NOT NULL,
  CONSTRAINT snapshot_price_candidate_fk
    FOREIGN KEY (candidate_row_id, snapshot_id)
    REFERENCES app.sales_snapshot_candidate(id, snapshot_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT snapshot_price_business_key
    UNIQUE (snapshot_id, candidate_row_id, price_revision_id),
  CONSTRAINT snapshot_price_stable_key
    UNIQUE (snapshot_id, stable_key),
  CONSTRAINT snapshot_price_row_key UNIQUE (snapshot_id, row_id),
  CONSTRAINT snapshot_price_stable_length_chk
    CHECK (octet_length(stable_key) BETWEEN 1 AND 158)
);
```

## 9. Type 5 — Source Revision

```sql
CREATE TABLE app.sales_snapshot_source (
  id text PRIMARY KEY,
  snapshot_id text NOT NULL,
  record_type smallint NOT NULL DEFAULT 5 CHECK (record_type = 5),
  source_revision_id text NOT NULL,
  evidence_object_id text NOT NULL,
  raw_content_digest text NOT NULL,
  source_kind text NOT NULL,
  stable_key bytea NOT NULL,
  row_id text NOT NULL,
  CONSTRAINT snapshot_source_snapshot_fk
    FOREIGN KEY (snapshot_id)
    REFERENCES app.sales_handoff_snapshot(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT snapshot_source_evidence_fk FOREIGN KEY (
    source_revision_id, evidence_object_id, raw_content_digest, source_kind
  ) REFERENCES app.catalog_source_revision_immutable (
    id, evidence_object_id, raw_content_digest, source_kind
  ) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT snapshot_source_business_key
    UNIQUE (snapshot_id, source_revision_id),
  CONSTRAINT snapshot_source_stable_key
    UNIQUE (snapshot_id, stable_key),
  CONSTRAINT snapshot_source_row_key UNIQUE (snapshot_id, row_id),
  CONSTRAINT snapshot_source_parent_key
    UNIQUE (snapshot_id, source_revision_id),
  CONSTRAINT snapshot_source_stable_length_chk
    CHECK (octet_length(stable_key) BETWEEN 1 AND 158)
);
```

## 10. Type 6 — Catalog Review

```sql
CREATE TABLE app.sales_snapshot_catalog_review (
  id text PRIMARY KEY,
  snapshot_id text NOT NULL,
  record_type smallint NOT NULL DEFAULT 6 CHECK (record_type = 6),
  catalog_review_id text NOT NULL,
  target_revision_id text NOT NULL,
  policy_revision_id text NOT NULL,
  decision text NOT NULL,
  reviewed_at timestamptz(6) NOT NULL,
  stable_key bytea NOT NULL,
  row_id text NOT NULL,
  CONSTRAINT snapshot_catalog_review_fk FOREIGN KEY (
    catalog_review_id, target_revision_id,
    policy_revision_id, decision, reviewed_at
  ) REFERENCES app.catalog_review_immutable (
    id, target_revision_id, policy_revision_id, decision, reviewed_at
  ) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT snapshot_catalog_snapshot_fk
    FOREIGN KEY (snapshot_id)
    REFERENCES app.sales_handoff_snapshot(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT snapshot_catalog_business_key
    UNIQUE (snapshot_id, catalog_review_id),
  CONSTRAINT snapshot_catalog_stable_key
    UNIQUE (snapshot_id, stable_key),
  CONSTRAINT snapshot_catalog_row_key UNIQUE (snapshot_id, row_id),
  CONSTRAINT snapshot_catalog_stable_length_chk
    CHECK (octet_length(stable_key) BETWEEN 1 AND 158)
);
```

## 11. Type 7 — Professional Review

```sql
CREATE TABLE app.sales_snapshot_professional_review (
  id text PRIMARY KEY,
  snapshot_id text NOT NULL,
  record_type smallint NOT NULL DEFAULT 7 CHECK (record_type = 7),
  professional_review_id text NOT NULL,
  professional_review_event_id text NOT NULL,
  policy_revision_id text NOT NULL,
  project_id text NOT NULL,
  conversation_id text NOT NULL,
  requirement_id text NOT NULL,
  requirement_version_id text NOT NULL,
  installation_scenario text NOT NULL,
  decision text NOT NULL,
  basis_digest text NOT NULL,
  stable_key bytea NOT NULL,
  row_id text NOT NULL,
  CONSTRAINT snapshot_professional_context_fk FOREIGN KEY (
    snapshot_id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario
  ) REFERENCES app.sales_handoff_snapshot (
    id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario
  ) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT snapshot_professional_event_fk FOREIGN KEY (
    professional_review_event_id, project_id, conversation_id,
    requirement_id, requirement_version_id, installation_scenario
  ) REFERENCES app.professional_review_event (
    id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario
  ) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT snapshot_professional_review_policy_fk FOREIGN KEY (
    professional_review_id, policy_revision_id,
    project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario
  ) REFERENCES app.professional_review (
    id, policy_revision_id, project_id, conversation_id,
    requirement_id, requirement_version_id, installation_scenario
  ) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT snapshot_professional_business_key
    UNIQUE (snapshot_id, professional_review_id,
            professional_review_event_id),
  CONSTRAINT snapshot_professional_stable_key
    UNIQUE (snapshot_id, stable_key),
  CONSTRAINT snapshot_professional_row_key UNIQUE (snapshot_id, row_id),
  CONSTRAINT snapshot_professional_stable_length_chk
    CHECK (octet_length(stable_key) BETWEEN 1 AND 158)
);
```

This preserves the independently passed six-column Event key and adds an exact
seven-column Review/policy key.

## 12. Type 8 — Warning

```sql
CREATE TABLE app.sales_snapshot_warning (
  id text PRIMARY KEY,
  snapshot_id text NOT NULL,
  record_type smallint NOT NULL DEFAULT 8 CHECK (record_type = 8),
  candidate_row_id text NOT NULL,
  warning_sequence bigint NOT NULL CHECK (warning_sequence > 0),
  warning_code text NOT NULL,
  warning_text text NOT NULL,
  stable_key bytea NOT NULL,
  row_id text NOT NULL,
  CONSTRAINT snapshot_warning_candidate_fk
    FOREIGN KEY (candidate_row_id, snapshot_id)
    REFERENCES app.sales_snapshot_candidate(id, snapshot_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT snapshot_warning_business_key
    UNIQUE (snapshot_id, candidate_row_id, warning_sequence),
  CONSTRAINT snapshot_warning_stable_key
    UNIQUE (snapshot_id, stable_key),
  CONSTRAINT snapshot_warning_row_key UNIQUE (snapshot_id, row_id),
  CONSTRAINT snapshot_warning_stable_length_chk
    CHECK (octet_length(stable_key) BETWEEN 1 AND 158)
);
```

## 13. Type 9 — Missing Field

```sql
CREATE TABLE app.sales_snapshot_missing_field (
  id text PRIMARY KEY,
  snapshot_id text NOT NULL,
  record_type smallint NOT NULL DEFAULT 9 CHECK (record_type = 9),
  candidate_row_id text NOT NULL,
  field_key text NOT NULL,
  reason_code text NOT NULL,
  stable_key bytea NOT NULL,
  row_id text NOT NULL,
  CONSTRAINT snapshot_missing_candidate_fk
    FOREIGN KEY (candidate_row_id, snapshot_id)
    REFERENCES app.sales_snapshot_candidate(id, snapshot_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT snapshot_missing_business_key
    UNIQUE (snapshot_id, candidate_row_id, field_key),
  CONSTRAINT snapshot_missing_stable_key
    UNIQUE (snapshot_id, stable_key),
  CONSTRAINT snapshot_missing_row_key UNIQUE (snapshot_id, row_id),
  CONSTRAINT snapshot_missing_stable_length_chk
    CHECK (octet_length(stable_key) BETWEEN 1 AND 158)
);
```

## 14. Required Existing-Table Additions

Before these Snapshot FKs can be created, the C5 migration design must add:

- `requirement_field_value` structured source columns and the exact UNIQUE used
  by `req_field_source_fk`;
- `requirement_field_assertion` retained six-column professional Event FK;
- `professional_review` policy-inclusive owner UNIQUE;
- immutable source/catalog review parent keys;
- `source_key_r3(...) IMMUTABLE` and its exact argument signature.

These additions are design requirements only. No migration is executed.

