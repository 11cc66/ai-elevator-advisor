# Snapshot Normalized Schema R3-C6

Status:

```text
SCHEMA: SNAPSHOT-SCHEMA-R3
DDL PROPOSAL — NOT EXECUTED
```

## 1. Snapshot Envelope

```sql
CREATE TABLE app.sales_handoff_snapshot_r3 (
  id text PRIMARY KEY,
  case_id text NOT NULL,
  project_id text NOT NULL,
  conversation_id text NOT NULL,
  requirement_id text NOT NULL,
  requirement_version_id text NOT NULL,
  installation_scenario text NOT NULL,
  selection_run_id text NOT NULL,
  rule_set_revision_id text NOT NULL,
  rule_set_content_digest text NOT NULL,
  basis_as_of timestamptz(6) NOT NULL,
  version_number bigint NOT NULL,
  mutation_version bigint NOT NULL DEFAULT 1,
  state text NOT NULL CHECK (state IN ('DRAFT','FINALIZED')),
  created_by_principal_id text NOT NULL
    REFERENCES app.trusted_principal(id),
  created_at timestamptz(6) NOT NULL,
  finalized_at timestamptz(6),
  CONSTRAINT snapshot_r3_state_time_chk CHECK (
    (state='DRAFT' AND finalized_at IS NULL)
    OR (state='FINALIZED' AND finalized_at IS NOT NULL)
  ),
  CONSTRAINT snapshot_r3_case_version UNIQUE (case_id, version_number),
  CONSTRAINT snapshot_r3_context UNIQUE (
    id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario
  ),
  CONSTRAINT snapshot_r3_run UNIQUE (
    id, selection_run_id, project_id, conversation_id,
    requirement_id, requirement_version_id, installation_scenario
  ),
  CONSTRAINT snapshot_r3_run_ruleset UNIQUE (
    id, selection_run_id, rule_set_revision_id, rule_set_content_digest
  )
);
```

Legal state transition:

```text
DRAFT -> FINALIZED
```

CAS:

```sql
UPDATE app.sales_handoff_snapshot_r3
SET state='FINALIZED', finalized_at=clock_timestamp(),
    mutation_version=mutation_version+1
WHERE id=p_snapshot_id
  AND state='DRAFT'
  AND mutation_version=p_expected_mutation_version;
```

## 2. Selection/Provenance Tables

```sql
CREATE TABLE app.selection_run (
  id text PRIMARY KEY,
  project_id text NOT NULL,
  conversation_id text NOT NULL,
  requirement_id text NOT NULL,
  requirement_version_id text NOT NULL,
  installation_scenario text NOT NULL,
  rule_set_revision_id text NOT NULL,
  rule_set_content_digest text NOT NULL,
  state text NOT NULL CHECK (state IN ('RUNNING','SEALED')),
  sealed_at timestamptz(6),
  CONSTRAINT selection_run_context UNIQUE (
    id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario
  ),
  CONSTRAINT selection_run_ruleset UNIQUE (
    id, rule_set_revision_id, rule_set_content_digest
  )
);

CREATE TABLE app.selection_candidate_result (
  id text PRIMARY KEY,
  selection_run_id text NOT NULL,
  candidate_id text NOT NULL,
  project_id text NOT NULL,
  conversation_id text NOT NULL,
  requirement_id text NOT NULL,
  requirement_version_id text NOT NULL,
  installation_scenario text NOT NULL,
  rule_set_revision_id text NOT NULL,
  product_id text NOT NULL,
  product_revision_id text NOT NULL,
  product_revision_digest text NOT NULL,
  specification_revision_id text NOT NULL,
  specification_revision_digest text NOT NULL,
  price_has_value boolean NOT NULL,
  price_revision_key text NOT NULL,
  product_revision_key text NOT NULL,
  specification_revision_key text NOT NULL,
  statuses_valid boolean NOT NULL,
  CONSTRAINT selection_candidate_exact UNIQUE (
    id, selection_run_id, candidate_id,
    project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario,
    rule_set_revision_id, product_id,
    product_revision_id, product_revision_digest,
    specification_revision_id, specification_revision_digest,
    price_has_value, price_revision_key
  )
);
```

The product/specification/price revision IDs are bound through immutable
revision tables and composite keys; no standalone text ID is sufficient.

## 3. Basis Metadata

```sql
CREATE TABLE app.snapshot_basis_metadata_r3 (
  snapshot_id text PRIMARY KEY REFERENCES app.sales_handoff_snapshot_r3(id),
  registry_revision text NOT NULL CHECK (registry_revision='SNAPSHOT-R3'),
  protocol_revision text NOT NULL CHECK (protocol_revision='R3-BASIS-1-R6'),
  stable_key_encoding text NOT NULL CHECK (stable_key_encoding='SK-R2'),
  basis_digest text NOT NULL,
  basis_byte_length bigint NOT NULL CHECK (basis_byte_length > 0),
  record_count integer NOT NULL CHECK (record_count > 0),
  generated_at timestamptz(6) NOT NULL
);
```

## 4. Canonical Child Tables

All child tables have:

```text
id TEXT PRIMARY KEY
snapshot_id TEXT NOT NULL
record_type SMALLINT NOT NULL
row_id TEXT NOT NULL
stable_key BYTEA NOT NULL
UNIQUE(snapshot_id,row_id)
UNIQUE(snapshot_id,stable_key)
FK snapshot_id -> envelope(id) ON DELETE RESTRICT
```

### Header

The envelope row is the Type-0 Header. `rule_set_revision_id`,
`rule_set_content_digest`, `conversation_id`, scenario and `basis_as_of` are
mandatory Basis fields.

### Requirement Field

Columns:

```text
field_key, value_type, null_value, boolean_value, integer_value,
decimal_value, text_value, enum_value, canonical_id_value,
timestamp_value, bytes_value, unit, field_status,
source_field_value_id, source_kind, source_entity_type,
source_entity_id, source_aux_is_null, source_aux_text, source_key
```

Exact context FK and exact `requirement_field_value` source FK are required.

### Candidate

Columns:

```text
selection_result_item_id, candidate_id, product_id,
product_revision_id, product_revision_digest,
specification_revision_id, specification_revision_digest,
price_revision_id, rule_set_revision_id,
technical_status, commercial_status, trust_status,
professional_review_status, overall_status
```

Exact FK to `selection_candidate_result` full key. Optional price uses an
explicit `price_present` bridge and exact price link.

### Parameter

```text
candidate_row_id, catalog_parameter_revision_id, parameter_key,
value_type, typed value columns, unit, source_revision_id
```

FKs:

```text
(candidate_row_id,snapshot_id) -> Candidate(id,snapshot_id)
(catalog_parameter_revision_id,parameter_key,value_type,source_revision_id)
  -> immutable catalog_parameter_revision exact key
(source_revision_id,snapshot_id) -> SnapshotSource(source_revision_id,snapshot_id)
```

### Price

```text
candidate_row_id, price_revision_id, product_revision_id,
source_revision_id, amount_minor, currency, price_basis,
tax_basis, applicability, valid_from, valid_until, quoted_at
```

Exact FK to immutable PriceRevision includes all copied dimensions and source
revision. Exact candidate and source FKs are mandatory.

### Source Revision

```text
source_revision_id, evidence_object_id, raw_content_digest,
source_kind, captured_at
```

Exact FK to immutable Catalog SourceRevision.

### Catalog Review

```text
catalog_review_id, target_revision_id, source_revision_id,
policy_revision_id, decision, reviewed_at
```

Exact FK to immutable CatalogReviewEvent.

### Professional Review

```text
professional_review_event_id, professional_review_id,
event_sequence, policy_revision_id, decision, basis_digest, occurred_at,
project_id, conversation_id, requirement_id,
requirement_version_id, installation_scenario
```

Exact six-column Event FK and seven-column Review/policy FK remain.

### Warning

```text
candidate_row_id, source_warning_id, warning_sequence,
severity, warning_code, warning_text
```

`UNIQUE(snapshot_id,candidate_row_id,source_warning_id)` prevents source
duplication. `UNIQUE(snapshot_id,candidate_row_id,warning_sequence)` assigns
the canonical order.

### Missing Field

```text
candidate_row_id, field_key, reason_code, impact_scope
```

Exact same-Snapshot candidate FK and structured uniqueness.

## 5. Immutability

Direct DML grants are absent. `BEFORE` guards reject:

- any mutation after parent `FINALIZED`;
- identity/stable/source field changes;
- INSERT/UPDATE/DELETE by ordinary roles.

`TRUNCATE` is denied by privilege and statement trigger.

