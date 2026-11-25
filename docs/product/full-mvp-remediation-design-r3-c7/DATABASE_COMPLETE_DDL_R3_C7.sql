-- R3-C7 complete design DDL draft.
-- PostgreSQL 18 design only. This file has NOT been executed or introspected.

CREATE SCHEMA app;
CREATE SCHEMA app_private;

CREATE TYPE app.policy_command AS ENUM (
  'CREATE', 'SUBMIT', 'APPROVE', 'REJECT', 'INVALIDATE', 'EXPIRE', 'SUPERSEDE'
);

CREATE TYPE app.professional_review_command AS ENUM (
  'SUBMIT', 'APPROVE', 'REJECT', 'RETURN', 'RESUBMIT', 'INVALIDATE', 'EXPIRE'
);

CREATE TABLE app.trusted_principal (
  id text PRIMARY KEY,
  state text NOT NULL CHECK (state IN ('ACTIVE','DISABLED')),
  created_at timestamptz(6) NOT NULL
);

CREATE TABLE app.principal_epoch (
  principal_id text PRIMARY KEY REFERENCES app.trusted_principal(id),
  current_epoch bigint NOT NULL CHECK (current_epoch > 0),
  updated_at timestamptz(6) NOT NULL
);

CREATE TABLE app.trusted_session (
  session_id text PRIMARY KEY,
  principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  login_epoch bigint NOT NULL,
  db_auth_role text NOT NULL UNIQUE,
  audience text NOT NULL,
  issuer text NOT NULL,
  assertion_id text NOT NULL,
  assertion_digest text NOT NULL,
  issued_at timestamptz(6) NOT NULL,
  not_before timestamptz(6) NOT NULL,
  expires_at timestamptz(6) NOT NULL,
  revoked_at timestamptz(6),
  revocation_reason text,
  state text NOT NULL CHECK (state IN ('ACTIVE','REVOKED','EXPIRED')),
  created_at timestamptz(6) NOT NULL,
  UNIQUE (principal_id, login_epoch),
  UNIQUE (issuer, assertion_id),
  CHECK (not_before >= issued_at),
  CHECK (expires_at > issued_at),
  CHECK (
    (state='ACTIVE' AND revoked_at IS NULL)
    OR (state IN ('REVOKED','EXPIRED') AND revoked_at IS NOT NULL)
  )
);

CREATE TABLE app.session_audit (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES app.trusted_session(session_id),
  action text NOT NULL CHECK (action IN ('OPEN','REVOKE','EXPIRE','EPOCH_ADVANCE')),
  actor_role text NOT NULL,
  reason text,
  occurred_at timestamptz(6) NOT NULL
);

CREATE TABLE app.project (
  id text PRIMARY KEY,
  created_at timestamptz(6) NOT NULL
);

CREATE TABLE app.conversation (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES app.project(id),
  created_at timestamptz(6) NOT NULL,
  UNIQUE (id, project_id)
);

CREATE TABLE app.requirement (
  id text PRIMARY KEY,
  project_id text NOT NULL,
  conversation_id text NOT NULL,
  created_at timestamptz(6) NOT NULL,
  FOREIGN KEY (conversation_id, project_id)
    REFERENCES app.conversation(id, project_id),
  UNIQUE (id, project_id, conversation_id)
);

CREATE TABLE app.requirement_version (
  id text PRIMARY KEY,
  requirement_id text NOT NULL,
  project_id text NOT NULL,
  conversation_id text NOT NULL,
  installation_scenario text NOT NULL,
  content_digest text NOT NULL,
  created_at timestamptz(6) NOT NULL,
  FOREIGN KEY (requirement_id, project_id, conversation_id)
    REFERENCES app.requirement(id, project_id, conversation_id),
  UNIQUE (id, requirement_id, project_id, conversation_id, installation_scenario)
);

CREATE TABLE app.sales_case (
  id text PRIMARY KEY,
  project_id text NOT NULL,
  conversation_id text NOT NULL,
  requirement_id text NOT NULL,
  requirement_version_id text NOT NULL,
  installation_scenario text NOT NULL,
  mutation_version bigint NOT NULL CHECK (mutation_version > 0),
  created_at timestamptz(6) NOT NULL,
  FOREIGN KEY (
    requirement_version_id, requirement_id, project_id,
    conversation_id, installation_scenario
  ) REFERENCES app.requirement_version(
    id, requirement_id, project_id, conversation_id, installation_scenario
  ),
  UNIQUE (
    id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario
  )
);

CREATE TABLE app.rule_set_revision (
  id text PRIMARY KEY,
  content_digest text NOT NULL,
  canonical_content bytea NOT NULL,
  approved boolean NOT NULL,
  created_at timestamptz(6) NOT NULL,
  UNIQUE (id, content_digest),
  CHECK (octet_length(canonical_content) <= 1048576),
  CHECK (approved)
);

CREATE TABLE app.catalog_source_revision (
  id text PRIMARY KEY,
  evidence_object_id text NOT NULL,
  raw_content_digest text NOT NULL,
  source_kind text NOT NULL,
  captured_at timestamptz(6) NOT NULL,
  UNIQUE (id, evidence_object_id, raw_content_digest, source_kind, captured_at)
);

CREATE TABLE app.product_revision (
  id text PRIMARY KEY,
  product_id text NOT NULL,
  content_digest text NOT NULL,
  canonical_content bytea NOT NULL,
  created_at timestamptz(6) NOT NULL,
  UNIQUE (product_id, id, content_digest)
);

CREATE TABLE app.specification_revision (
  id text PRIMARY KEY,
  product_id text NOT NULL,
  product_revision_id text NOT NULL,
  content_digest text NOT NULL,
  canonical_content bytea NOT NULL,
  created_at timestamptz(6) NOT NULL,
  FOREIGN KEY (product_id, product_revision_id)
    REFERENCES app.product_revision(product_id, id),
  UNIQUE (product_id, product_revision_id, id, content_digest)
);

CREATE TABLE app.price_revision (
  id text PRIMARY KEY,
  product_id text NOT NULL,
  product_revision_id text NOT NULL,
  specification_revision_id text NOT NULL,
  source_revision_id text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  price_basis text NOT NULL,
  tax_basis text NOT NULL,
  applicability text NOT NULL,
  valid_from timestamptz(6) NOT NULL,
  valid_until timestamptz(6),
  quoted_at timestamptz(6) NOT NULL,
  created_at timestamptz(6) NOT NULL,
  FOREIGN KEY (
    product_id, product_revision_id, specification_revision_id
  ) REFERENCES app.specification_revision(
    product_id, product_revision_id, id
  ),
  FOREIGN KEY (source_revision_id)
    REFERENCES app.catalog_source_revision(id),
  UNIQUE (
    id, product_id, product_revision_id,
    specification_revision_id, source_revision_id
  ),
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  CHECK (quoted_at <= created_at)
);

CREATE TABLE app.catalog_parameter_revision (
  id text PRIMARY KEY,
  product_id text NOT NULL,
  product_revision_id text NOT NULL,
  parameter_key text NOT NULL,
  value_type text NOT NULL,
  source_revision_id text NOT NULL,
  value_json jsonb NOT NULL,
  unit text,
  created_at timestamptz(6) NOT NULL,
  FOREIGN KEY (product_id, product_revision_id)
    REFERENCES app.product_revision(product_id, id),
  FOREIGN KEY (source_revision_id)
    REFERENCES app.catalog_source_revision(id),
  UNIQUE (
    id, product_id, product_revision_id,
    parameter_key, value_type, source_revision_id
  )
);

CREATE TABLE app.selection_run (
  id text PRIMARY KEY,
  case_id text NOT NULL,
  project_id text NOT NULL,
  conversation_id text NOT NULL,
  requirement_id text NOT NULL,
  requirement_version_id text NOT NULL,
  installation_scenario text NOT NULL,
  rule_set_revision_id text NOT NULL,
  rule_set_content_digest text NOT NULL,
  state text NOT NULL CHECK (state IN ('RUNNING','SEALED')),
  mutation_version bigint NOT NULL CHECK (mutation_version > 0),
  created_at timestamptz(6) NOT NULL,
  FOREIGN KEY (
    case_id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario
  ) REFERENCES app.sales_case(
    id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario
  ),
  FOREIGN KEY (rule_set_revision_id, rule_set_content_digest)
    REFERENCES app.rule_set_revision(id, content_digest),
  UNIQUE (
    id, case_id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario,
    rule_set_revision_id, rule_set_content_digest
  )
);

CREATE TABLE app.selection_candidate (
  id text PRIMARY KEY,
  selection_run_id text NOT NULL,
  project_id text NOT NULL,
  conversation_id text NOT NULL,
  requirement_id text NOT NULL,
  requirement_version_id text NOT NULL,
  installation_scenario text NOT NULL,
  rule_set_revision_id text NOT NULL,
  rule_set_content_digest text NOT NULL,
  product_id text NOT NULL,
  product_revision_id text NOT NULL,
  product_revision_digest text NOT NULL,
  specification_revision_id text NOT NULL,
  specification_revision_digest text NOT NULL,
  created_at timestamptz(6) NOT NULL,
  FOREIGN KEY (
    selection_run_id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario,
    rule_set_revision_id, rule_set_content_digest
  ) REFERENCES app.selection_run(
    id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario,
    rule_set_revision_id, rule_set_content_digest
  ),
  FOREIGN KEY (
    product_id, product_revision_id, product_revision_digest
  ) REFERENCES app.product_revision(product_id, id, content_digest),
  FOREIGN KEY (
    product_id, product_revision_id,
    specification_revision_id, specification_revision_digest
  ) REFERENCES app.specification_revision(
    product_id, product_revision_id, id, content_digest
  ),
  UNIQUE (
    id, selection_run_id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario,
    rule_set_revision_id, rule_set_content_digest,
    product_id, product_revision_id, product_revision_digest,
    specification_revision_id, specification_revision_digest
  ),
  UNIQUE (id, product_id, product_revision_id, specification_revision_id),
  UNIQUE (id, product_id, product_revision_id)
);

CREATE TABLE app.selection_candidate_price (
  candidate_id text PRIMARY KEY,
  product_id text NOT NULL,
  product_revision_id text NOT NULL,
  specification_revision_id text NOT NULL,
  price_revision_id text NOT NULL,
  source_revision_id text NOT NULL,
  FOREIGN KEY (
    candidate_id, product_id, product_revision_id, specification_revision_id
  ) REFERENCES app.selection_candidate(
    id, product_id, product_revision_id, specification_revision_id
  ),
  FOREIGN KEY (
    price_revision_id, product_id, product_revision_id,
    specification_revision_id, source_revision_id
  ) REFERENCES app.price_revision(
    id, product_id, product_revision_id,
    specification_revision_id, source_revision_id
  )
);

CREATE TABLE app.selection_candidate_parameter (
  candidate_id text NOT NULL,
  product_id text NOT NULL,
  product_revision_id text NOT NULL,
  parameter_key text NOT NULL,
  catalog_parameter_revision_id text NOT NULL,
  value_type text NOT NULL,
  source_revision_id text NOT NULL,
  value_json jsonb NOT NULL,
  unit text,
  PRIMARY KEY (candidate_id, parameter_key),
  FOREIGN KEY (candidate_id, product_id, product_revision_id)
    REFERENCES app.selection_candidate(id, product_id, product_revision_id),
  FOREIGN KEY (
    catalog_parameter_revision_id, product_id, product_revision_id,
    parameter_key, value_type, source_revision_id
  ) REFERENCES app.catalog_parameter_revision(
    id, product_id, product_revision_id,
    parameter_key, value_type, source_revision_id
  )
);

CREATE TABLE app.selection_candidate_result (
  id text PRIMARY KEY,
  candidate_id text NOT NULL,
  selection_run_id text NOT NULL,
  project_id text NOT NULL,
  conversation_id text NOT NULL,
  requirement_id text NOT NULL,
  requirement_version_id text NOT NULL,
  installation_scenario text NOT NULL,
  rule_set_revision_id text NOT NULL,
  rule_set_content_digest text NOT NULL,
  product_id text NOT NULL,
  product_revision_id text NOT NULL,
  product_revision_digest text NOT NULL,
  specification_revision_id text NOT NULL,
  specification_revision_digest text NOT NULL,
  technical_status text NOT NULL,
  commercial_status text NOT NULL,
  trust_status text NOT NULL,
  professional_review_status text NOT NULL,
  overall_status text NOT NULL,
  created_at timestamptz(6) NOT NULL,
  FOREIGN KEY (
    candidate_id, selection_run_id, project_id, conversation_id,
    requirement_id, requirement_version_id, installation_scenario,
    rule_set_revision_id, rule_set_content_digest,
    product_id, product_revision_id, product_revision_digest,
    specification_revision_id, specification_revision_digest
  ) REFERENCES app.selection_candidate(
    id, selection_run_id, project_id, conversation_id,
    requirement_id, requirement_version_id, installation_scenario,
    rule_set_revision_id, rule_set_content_digest,
    product_id, product_revision_id, product_revision_digest,
    specification_revision_id, specification_revision_digest
  ),
  UNIQUE (candidate_id),
  UNIQUE (id, candidate_id, selection_run_id),
  UNIQUE (
    id, candidate_id, selection_run_id, project_id, conversation_id,
    requirement_id, requirement_version_id, installation_scenario,
    rule_set_revision_id, rule_set_content_digest,
    product_id, product_revision_id, product_revision_digest,
    specification_revision_id, specification_revision_digest
  )
);

CREATE TABLE app.selection_run_seal (
  selection_run_id text PRIMARY KEY,
  case_id text NOT NULL,
  project_id text NOT NULL,
  conversation_id text NOT NULL,
  requirement_id text NOT NULL,
  requirement_version_id text NOT NULL,
  installation_scenario text NOT NULL,
  rule_set_revision_id text NOT NULL,
  rule_set_content_digest text NOT NULL,
  candidate_count integer NOT NULL CHECK (candidate_count > 0),
  result_digest text NOT NULL,
  sealed_at timestamptz(6) NOT NULL,
  FOREIGN KEY (
    selection_run_id, case_id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario,
    rule_set_revision_id, rule_set_content_digest
  ) REFERENCES app.selection_run(
    id, case_id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario,
    rule_set_revision_id, rule_set_content_digest
  ),
  UNIQUE (
    selection_run_id, case_id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario,
    rule_set_revision_id, rule_set_content_digest
  )
);

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
  version_number bigint NOT NULL CHECK (version_number > 0),
  mutation_version bigint NOT NULL CHECK (mutation_version > 0),
  state text NOT NULL CHECK (state IN ('DRAFT','FINALIZED')),
  created_by_principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  created_at timestamptz(6) NOT NULL,
  finalized_at timestamptz(6),
  FOREIGN KEY (
    selection_run_id, case_id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario,
    rule_set_revision_id, rule_set_content_digest
  ) REFERENCES app.selection_run_seal(
    selection_run_id, case_id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario,
    rule_set_revision_id, rule_set_content_digest
  ),
  UNIQUE (
    id, selection_run_id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario,
    rule_set_revision_id, rule_set_content_digest
  ),
  UNIQUE (id, selection_run_id),
  CHECK (
    (state='DRAFT' AND finalized_at IS NULL)
    OR (state='FINALIZED' AND finalized_at IS NOT NULL)
  )
);

CREATE TABLE app.snapshot_basis_metadata_r3 (
  snapshot_id text PRIMARY KEY REFERENCES app.sales_handoff_snapshot_r3(id),
  registry_revision text NOT NULL CHECK (registry_revision='SNAPSHOT-R3'),
  protocol_revision text NOT NULL CHECK (protocol_revision='R3-BASIS-1-R6'),
  stable_key_encoding text NOT NULL CHECK (stable_key_encoding='SK-R2'),
  record_count integer NOT NULL CHECK (record_count BETWEEN 1 AND 4096),
  field_count integer NOT NULL CHECK (field_count BETWEEN 1 AND 65536),
  body_byte_length bigint NOT NULL CHECK (body_byte_length BETWEEN 1 AND 16777216),
  basis_byte_length bigint NOT NULL CHECK (basis_byte_length BETWEEN 28 AND 16777244),
  basis_digest text NOT NULL,
  CHECK (basis_byte_length = body_byte_length + 28)
);

CREATE TABLE app.sales_snapshot_requirement_field_r3 (
  snapshot_id text NOT NULL REFERENCES app.sales_handoff_snapshot_r3(id),
  selection_run_id text NOT NULL,
  requirement_version_id text NOT NULL,
  field_key text NOT NULL,
  value_json jsonb NOT NULL,
  value_type text NOT NULL,
  unit text,
  field_status text NOT NULL,
  source_kind text NOT NULL,
  source_entity_type text NOT NULL,
  source_entity_id text NOT NULL,
  source_aux_is_null boolean NOT NULL,
  source_aux_text text,
  source_value_id text NOT NULL,
  source_revision_id text NOT NULL,
  stable_key bytea NOT NULL,
  PRIMARY KEY (snapshot_id, requirement_version_id, field_key),
  UNIQUE (snapshot_id, stable_key),
  FOREIGN KEY (snapshot_id, selection_run_id)
    REFERENCES app.sales_handoff_snapshot_r3(id, selection_run_id),
  CHECK (octet_length(stable_key) BETWEEN 1 AND 158),
  CHECK (
    (source_aux_is_null AND source_aux_text IS NULL)
    OR (NOT source_aux_is_null AND source_aux_text IS NOT NULL AND octet_length(source_aux_text) BETWEEN 1 AND 128)
  )
);

CREATE TABLE app.sales_snapshot_candidate_r3 (
  snapshot_id text NOT NULL REFERENCES app.sales_handoff_snapshot_r3(id),
  selection_run_id text NOT NULL,
  candidate_row_id text NOT NULL,
  selection_result_item_id text NOT NULL,
  candidate_id text NOT NULL,
  product_id text NOT NULL,
  product_revision_id text NOT NULL,
  product_revision_digest text NOT NULL,
  specification_revision_id text NOT NULL,
  specification_revision_digest text NOT NULL,
  rule_set_revision_id text NOT NULL,
  rule_set_content_digest text NOT NULL,
  technical_status text NOT NULL,
  commercial_status text NOT NULL,
  trust_status text NOT NULL,
  professional_review_status text NOT NULL,
  overall_status text NOT NULL,
  stable_key bytea NOT NULL,
  PRIMARY KEY (snapshot_id, candidate_row_id),
  UNIQUE (snapshot_id, stable_key),
  UNIQUE (
    snapshot_id, candidate_row_id, candidate_id,
    product_id, product_revision_id, specification_revision_id
  ),
  FOREIGN KEY (snapshot_id, selection_run_id)
    REFERENCES app.sales_handoff_snapshot_r3(id, selection_run_id),
  FOREIGN KEY (
    selection_result_item_id, candidate_id, selection_run_id
  ) REFERENCES app.selection_candidate_result(id, candidate_id, selection_run_id),
  CHECK (octet_length(stable_key) BETWEEN 1 AND 158)
);

CREATE TABLE app.sales_snapshot_parameter_r3 (
  snapshot_id text NOT NULL,
  candidate_row_id text NOT NULL,
  candidate_id text NOT NULL,
  parameter_key text NOT NULL,
  catalog_parameter_revision_id text NOT NULL,
  value_type text NOT NULL,
  value_json jsonb NOT NULL,
  unit text,
  source_revision_id text NOT NULL,
  product_id text NOT NULL,
  product_revision_id text NOT NULL,
  specification_revision_id text NOT NULL,
  stable_key bytea NOT NULL,
  PRIMARY KEY (snapshot_id, candidate_row_id, parameter_key),
  FOREIGN KEY (
    snapshot_id, candidate_row_id, candidate_id,
    product_id, product_revision_id, specification_revision_id
  ) REFERENCES app.sales_snapshot_candidate_r3(
    snapshot_id, candidate_row_id, candidate_id,
    product_id, product_revision_id, specification_revision_id
  ),
  FOREIGN KEY (
    catalog_parameter_revision_id, product_id, product_revision_id,
    parameter_key, value_type, source_revision_id
  ) REFERENCES app.catalog_parameter_revision(
    id, product_id, product_revision_id,
    parameter_key, value_type, source_revision_id
  ),
  CHECK (octet_length(stable_key) BETWEEN 1 AND 158)
);

CREATE TABLE app.sales_snapshot_price_r3 (
  snapshot_id text NOT NULL,
  candidate_row_id text NOT NULL,
  candidate_id text NOT NULL,
  price_revision_id text NOT NULL,
  product_id text NOT NULL,
  product_revision_id text NOT NULL,
  specification_revision_id text NOT NULL,
  source_revision_id text NOT NULL,
  amount_minor bigint NOT NULL,
  currency text NOT NULL,
  price_basis text NOT NULL,
  tax_basis text NOT NULL,
  applicability text NOT NULL,
  valid_from timestamptz(6) NOT NULL,
  valid_until timestamptz(6),
  quoted_at timestamptz(6) NOT NULL,
  stable_key bytea NOT NULL,
  PRIMARY KEY (snapshot_id, candidate_row_id, price_revision_id),
  FOREIGN KEY (
    snapshot_id, candidate_row_id, candidate_id,
    product_id, product_revision_id, specification_revision_id
  ) REFERENCES app.sales_snapshot_candidate_r3(
    snapshot_id, candidate_row_id, candidate_id,
    product_id, product_revision_id, specification_revision_id
  ),
  FOREIGN KEY (
    price_revision_id, product_id, product_revision_id,
    specification_revision_id, source_revision_id
  ) REFERENCES app.price_revision(
    id, product_id, product_revision_id, specification_revision_id, source_revision_id
  ),
  CHECK (octet_length(stable_key) BETWEEN 1 AND 158)
);

CREATE TABLE app.sales_snapshot_source_r3 (
  snapshot_id text NOT NULL REFERENCES app.sales_handoff_snapshot_r3(id),
  selection_run_id text NOT NULL,
  source_revision_id text NOT NULL,
  evidence_object_id text NOT NULL,
  raw_content_digest text NOT NULL,
  source_kind text NOT NULL,
  source_entity_type text NOT NULL,
  source_entity_id text NOT NULL,
  source_aux_is_null boolean NOT NULL,
  source_aux_text text,
  captured_at timestamptz(6) NOT NULL,
  stable_key bytea NOT NULL,
  PRIMARY KEY (snapshot_id, source_revision_id),
  UNIQUE (snapshot_id, stable_key),
  FOREIGN KEY (snapshot_id, selection_run_id)
    REFERENCES app.sales_handoff_snapshot_r3(id, selection_run_id),
  FOREIGN KEY (source_revision_id)
    REFERENCES app.catalog_source_revision(id),
  CHECK (octet_length(stable_key) BETWEEN 1 AND 158)
);

CREATE TABLE app.sales_snapshot_catalog_review_r3 (
  snapshot_id text NOT NULL REFERENCES app.sales_handoff_snapshot_r3(id),
  selection_run_id text NOT NULL,
  catalog_review_id text NOT NULL,
  target_revision_id text NOT NULL,
  source_revision_id text NOT NULL,
  policy_revision_id text NOT NULL REFERENCES app.policy_revision(id),
  decision text NOT NULL,
  reviewed_at timestamptz(6) NOT NULL,
  stable_key bytea NOT NULL,
  PRIMARY KEY (snapshot_id, catalog_review_id),
  UNIQUE (snapshot_id, stable_key),
  FOREIGN KEY (snapshot_id, selection_run_id)
    REFERENCES app.sales_handoff_snapshot_r3(id, selection_run_id),
  CHECK (octet_length(stable_key) BETWEEN 1 AND 158)
);

CREATE TABLE app.sales_snapshot_professional_review_r3 (
  snapshot_id text NOT NULL REFERENCES app.sales_handoff_snapshot_r3(id),
  selection_run_id text NOT NULL,
  professional_review_event_id text NOT NULL,
  professional_review_id text NOT NULL,
  event_sequence bigint NOT NULL,
  target_revision_id text NOT NULL,
  policy_revision_id text NOT NULL REFERENCES app.policy_revision(id),
  decision text NOT NULL,
  basis_digest text NOT NULL,
  occurred_at timestamptz(6) NOT NULL,
  stable_key bytea NOT NULL,
  PRIMARY KEY (snapshot_id, professional_review_id, event_sequence),
  UNIQUE (snapshot_id, professional_review_event_id),
  UNIQUE (snapshot_id, stable_key),
  FOREIGN KEY (snapshot_id, selection_run_id)
    REFERENCES app.sales_handoff_snapshot_r3(id, selection_run_id),
  CHECK (event_sequence > 0),
  CHECK (octet_length(stable_key) BETWEEN 1 AND 158)
);

CREATE TABLE app.sales_snapshot_warning_r3 (
  snapshot_id text NOT NULL,
  selection_run_id text NOT NULL,
  candidate_row_id text NOT NULL,
  candidate_id text NOT NULL,
  warning_sequence bigint NOT NULL CHECK (warning_sequence > 0),
  warning_code text NOT NULL,
  warning_text text NOT NULL,
  severity text NOT NULL,
  source_warning_id text NOT NULL,
  stable_key bytea NOT NULL,
  PRIMARY KEY (snapshot_id, candidate_row_id, warning_sequence),
  UNIQUE (snapshot_id, candidate_row_id, source_warning_id),
  UNIQUE (snapshot_id, stable_key),
  FOREIGN KEY (snapshot_id, selection_run_id)
    REFERENCES app.sales_handoff_snapshot_r3(id, selection_run_id),
  FOREIGN KEY (snapshot_id, candidate_row_id)
    REFERENCES app.sales_snapshot_candidate_r3(snapshot_id, candidate_row_id),
  CHECK (octet_length(stable_key) BETWEEN 1 AND 158)
);

CREATE TABLE app.sales_snapshot_missing_field_r3 (
  snapshot_id text NOT NULL,
  selection_run_id text NOT NULL,
  candidate_row_id text NOT NULL,
  candidate_id text NOT NULL,
  field_key text NOT NULL,
  reason text NOT NULL,
  impact_scope text NOT NULL,
  stable_key bytea NOT NULL,
  PRIMARY KEY (snapshot_id, candidate_row_id, field_key),
  UNIQUE (snapshot_id, stable_key),
  FOREIGN KEY (snapshot_id, selection_run_id)
    REFERENCES app.sales_handoff_snapshot_r3(id, selection_run_id),
  FOREIGN KEY (snapshot_id, candidate_row_id)
    REFERENCES app.sales_snapshot_candidate_r3(snapshot_id, candidate_row_id),
  CHECK (octet_length(stable_key) BETWEEN 1 AND 158)
);

CREATE TABLE app.sales_snapshot_basis_record_r3 (
  snapshot_id text NOT NULL REFERENCES app.sales_handoff_snapshot_r3(id),
  record_type smallint NOT NULL CHECK (record_type BETWEEN 0 AND 9),
  stable_key bytea NOT NULL,
  row_id text NOT NULL,
  field_count smallint NOT NULL CHECK (field_count BETWEEN 1 AND 32),
  fields_json jsonb NOT NULL,
  encoded_record bytea NOT NULL,
  PRIMARY KEY (snapshot_id, record_type, row_id),
  UNIQUE (snapshot_id, record_type, stable_key),
  CHECK (octet_length(stable_key) BETWEEN 1 AND 158),
  CHECK (octet_length(encoded_record) BETWEEN 1 AND 16874)
);

CREATE TABLE app.policy_revision (
  id text PRIMARY KEY,
  policy_id text NOT NULL,
  policy_kind text NOT NULL,
  scope_project_id text REFERENCES app.project(id),
  revision_number bigint NOT NULL CHECK (revision_number > 0),
  canonical_content bytea NOT NULL,
  content_digest text NOT NULL,
  content_version integer NOT NULL CHECK (content_version=1),
  created_by_principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  created_by_session_id text NOT NULL REFERENCES app.trusted_session(session_id),
  supersedes_revision_id text REFERENCES app.policy_revision(id),
  created_at timestamptz(6) NOT NULL,
  UNIQUE (policy_id, revision_number),
  UNIQUE (policy_kind, scope_project_id, content_digest),
  CHECK (octet_length(canonical_content) BETWEEN 1 AND 1048576)
);

CREATE TABLE app.policy_review_event (
  id text PRIMARY KEY,
  policy_id text NOT NULL,
  policy_revision_id text NOT NULL REFERENCES app.policy_revision(id),
  event_sequence bigint NOT NULL CHECK (event_sequence > 0),
  state_version bigint NOT NULL CHECK (state_version > 0),
  previous_state text,
  command app.policy_command NOT NULL,
  next_state text NOT NULL CHECK (
    next_state IN ('DRAFT','IN_REVIEW','APPROVED','REJECTED','INVALIDATED','EXPIRED','SUPERSEDED')
  ),
  actor_principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  actor_session_id text NOT NULL REFERENCES app.trusted_session(session_id),
  actor_authority_grant_id text NOT NULL,
  request_id text NOT NULL,
  request_hash text NOT NULL,
  evidence_reference text NOT NULL,
  occurred_at timestamptz(6) NOT NULL,
  UNIQUE (policy_revision_id, event_sequence),
  UNIQUE (policy_revision_id, state_version),
  UNIQUE (policy_revision_id, request_id)
);

CREATE TABLE app.policy_current (
  policy_id text PRIMARY KEY,
  policy_kind text NOT NULL,
  scope_project_id text,
  revision_id text NOT NULL REFERENCES app.policy_revision(id),
  effective_event_id text NOT NULL REFERENCES app.policy_review_event(id),
  state text NOT NULL CHECK (state IN ('APPROVED','NONE')),
  generation bigint NOT NULL CHECK (generation > 0),
  updated_at timestamptz(6) NOT NULL,
  UNIQUE (effective_event_id)
);
CREATE UNIQUE INDEX policy_current_project_unique_r3
  ON app.policy_current(policy_kind,scope_project_id)
  WHERE state='APPROVED' AND scope_project_id IS NOT NULL;
CREATE UNIQUE INDEX policy_current_global_unique_r3
  ON app.policy_current(policy_kind)
  WHERE state='APPROVED' AND scope_project_id IS NULL;

CREATE TABLE app.professional_review (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES app.project(id),
  conversation_id text NOT NULL,
  requirement_id text NOT NULL,
  requirement_version_id text NOT NULL,
  installation_scenario text NOT NULL,
  candidate_id text NOT NULL,
  policy_id text NOT NULL,
  policy_revision_id text NOT NULL REFERENCES app.policy_revision(id),
  created_by_principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  state text NOT NULL,
  state_version bigint NOT NULL CHECK (state_version > 0),
  mutation_version bigint NOT NULL CHECK (mutation_version > 0),
  created_at timestamptz(6) NOT NULL,
  UNIQUE (
    id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario,
    candidate_id, policy_id, policy_revision_id
  )
);

CREATE TABLE app.professional_review_event (
  id text PRIMARY KEY,
  review_id text NOT NULL,
  project_id text NOT NULL,
  conversation_id text NOT NULL,
  requirement_id text NOT NULL,
  requirement_version_id text NOT NULL,
  installation_scenario text NOT NULL,
  candidate_id text NOT NULL,
  policy_id text NOT NULL,
  policy_revision_id text NOT NULL,
  event_sequence bigint NOT NULL CHECK (event_sequence > 0),
  state_version bigint NOT NULL CHECK (state_version > 0),
  previous_state text,
  command app.professional_review_command NOT NULL,
  next_state text NOT NULL,
  actor_principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  actor_session_id text NOT NULL REFERENCES app.trusted_session(session_id),
  actor_authority_grant_id text NOT NULL,
  request_id text NOT NULL,
  request_hash text NOT NULL,
  basis_digest text,
  reason text,
  occurred_at timestamptz(6) NOT NULL,
  FOREIGN KEY (
    review_id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario,
    candidate_id, policy_id, policy_revision_id
  ) REFERENCES app.professional_review(
    id, project_id, conversation_id, requirement_id,
    requirement_version_id, installation_scenario,
    candidate_id, policy_id, policy_revision_id
  ),
  UNIQUE (review_id, event_sequence),
  UNIQUE (review_id, state_version),
  UNIQUE (review_id, request_id)
);

CREATE TABLE app.review_audit (
  id text PRIMARY KEY,
  review_id text NOT NULL REFERENCES app.professional_review(id),
  event_id text NOT NULL REFERENCES app.professional_review_event(id),
  action text NOT NULL,
  actor_principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  occurred_at timestamptz(6) NOT NULL
);

CREATE TABLE app.authority_grant (
  id text PRIMARY KEY,
  principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  authority_code text NOT NULL,
  project_id text REFERENCES app.project(id),
  policy_id text,
  policy_revision_id text REFERENCES app.policy_revision(id),
  valid_from timestamptz(6) NOT NULL,
  valid_until timestamptz(6),
  revoked_at timestamptz(6),
  revocation_reason text,
  created_at timestamptz(6) NOT NULL,
  UNIQUE (principal_id, id),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

ALTER TABLE app.policy_review_event
  ADD CONSTRAINT policy_review_event_actor_grant_fk
  FOREIGN KEY (actor_principal_id, actor_authority_grant_id)
  REFERENCES app.authority_grant(principal_id, id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE app.professional_review_event
  ADD CONSTRAINT professional_review_event_actor_grant_fk
  FOREIGN KEY (actor_principal_id, actor_authority_grant_id)
  REFERENCES app.authority_grant(principal_id, id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE app.selection_requirement_field (
  selection_run_id text NOT NULL REFERENCES app.selection_run(id),
  requirement_version_id text NOT NULL,
  field_key text NOT NULL,
  value_json jsonb NOT NULL,
  value_type text NOT NULL,
  unit text,
  field_status text NOT NULL,
  source_kind text NOT NULL,
  source_entity_type text NOT NULL,
  source_entity_id text NOT NULL,
  source_aux_is_null boolean NOT NULL,
  source_aux_text text,
  source_value_id text NOT NULL,
  source_revision_id text NOT NULL,
  PRIMARY KEY (selection_run_id, requirement_version_id, field_key)
);

CREATE TABLE app.selection_source_result (
  selection_run_id text NOT NULL REFERENCES app.selection_run(id),
  source_revision_id text NOT NULL,
  evidence_object_id text NOT NULL,
  raw_content_digest text NOT NULL,
  source_kind text NOT NULL,
  source_entity_type text NOT NULL,
  source_entity_id text NOT NULL,
  source_aux_is_null boolean NOT NULL,
  source_aux_text text,
  captured_at timestamptz(6) NOT NULL,
  PRIMARY KEY (selection_run_id, source_revision_id),
  FOREIGN KEY (source_revision_id)
    REFERENCES app.catalog_source_revision(id)
);

CREATE TABLE app.selection_catalog_review_result (
  selection_run_id text NOT NULL REFERENCES app.selection_run(id),
  catalog_review_id text NOT NULL,
  target_revision_id text NOT NULL,
  source_revision_id text NOT NULL,
  policy_revision_id text NOT NULL REFERENCES app.policy_revision(id),
  decision text NOT NULL,
  reviewed_at timestamptz(6) NOT NULL,
  PRIMARY KEY (selection_run_id, catalog_review_id)
);

CREATE TABLE app.selection_professional_review_result (
  selection_run_id text NOT NULL REFERENCES app.selection_run(id),
  professional_review_event_id text NOT NULL,
  professional_review_id text NOT NULL,
  event_sequence bigint NOT NULL,
  target_revision_id text NOT NULL,
  policy_revision_id text NOT NULL REFERENCES app.policy_revision(id),
  decision text NOT NULL,
  basis_digest text NOT NULL,
  occurred_at timestamptz(6) NOT NULL,
  PRIMARY KEY (selection_run_id, professional_review_id, event_sequence)
);

CREATE TABLE app.selection_warning_result (
  selection_run_id text NOT NULL REFERENCES app.selection_run(id),
  candidate_id text NOT NULL,
  warning_sequence bigint NOT NULL,
  warning_code text NOT NULL,
  warning_text text NOT NULL,
  severity text NOT NULL,
  source_warning_id text NOT NULL,
  PRIMARY KEY (selection_run_id, candidate_id, warning_sequence),
  UNIQUE (selection_run_id, candidate_id, source_warning_id)
);

CREATE TABLE app.selection_missing_field_result (
  selection_run_id text NOT NULL REFERENCES app.selection_run(id),
  candidate_id text NOT NULL,
  field_key text NOT NULL,
  reason text NOT NULL,
  impact_scope text NOT NULL,
  PRIMARY KEY (selection_run_id, candidate_id, field_key)
);

ALTER TABLE app.sales_snapshot_requirement_field_r3
  ADD CONSTRAINT sales_snapshot_requirement_source_fk
  FOREIGN KEY (selection_run_id, requirement_version_id, field_key)
  REFERENCES app.selection_requirement_field(
    selection_run_id, requirement_version_id, field_key
  );
ALTER TABLE app.sales_snapshot_source_r3
  ADD CONSTRAINT sales_snapshot_source_selection_fk
  FOREIGN KEY (selection_run_id, source_revision_id)
  REFERENCES app.selection_source_result(selection_run_id, source_revision_id);
ALTER TABLE app.sales_snapshot_catalog_review_r3
  ADD CONSTRAINT sales_snapshot_catalog_review_selection_fk
  FOREIGN KEY (selection_run_id, catalog_review_id)
  REFERENCES app.selection_catalog_review_result(selection_run_id, catalog_review_id);
ALTER TABLE app.sales_snapshot_professional_review_r3
  ADD CONSTRAINT sales_snapshot_professional_review_selection_fk
  FOREIGN KEY (selection_run_id, professional_review_id, event_sequence)
  REFERENCES app.selection_professional_review_result(
    selection_run_id, professional_review_id, event_sequence
  );
ALTER TABLE app.sales_snapshot_warning_r3
  ADD CONSTRAINT sales_snapshot_warning_selection_fk
  FOREIGN KEY (selection_run_id, candidate_id, warning_sequence)
  REFERENCES app.selection_warning_result(
    selection_run_id, candidate_id, warning_sequence
  );
ALTER TABLE app.sales_snapshot_missing_field_r3
  ADD CONSTRAINT sales_snapshot_missing_selection_fk
  FOREIGN KEY (selection_run_id, candidate_id, field_key)
  REFERENCES app.selection_missing_field_result(
    selection_run_id, candidate_id, field_key
  );

CREATE FUNCTION app_private.u16be(p_value integer)
RETURNS bytea
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
RETURN set_byte(set_byte(decode('0000','hex'),0,(p_value >> 8) & 255),1,p_value & 255);

CREATE FUNCTION app_private.u32be(p_value bigint)
RETURNS bytea
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
RETURN decode(lpad(to_hex(p_value),8,'0'),'hex');

CREATE FUNCTION app_private.u64be(p_value bigint)
RETURNS bytea
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
RETURN decode(lpad(to_hex(p_value),16,'0'),'hex');

CREATE FUNCTION app_private.i64be(p_value bigint)
RETURNS bytea
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
RETURN decode(lpad(to_hex(p_value # ((-9223372036854775808)::bigint)),16,'0'),'hex');

CREATE FUNCTION app_private.sha256_hex(p_value bytea)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
RETURN lower(encode(sha256(p_value),'hex'));

CREATE FUNCTION app_private.r6_request_hash(p_payload jsonb)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
RETURN app_private.sha256_hex(
  decode('414945412D5245515545535400763100','hex')
  || convert_to(p_payload::text,'UTF8')
);

CREATE FUNCTION app_private.r6_field(
  p_tag integer,
  p_type_tag integer,
  p_presence integer,
  p_payload bytea
) RETURNS bytea
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
RETURN app_private.u16be(p_tag)
  || decode(lpad(to_hex(p_type_tag),2,'0'),'hex')
  || decode(lpad(to_hex(p_presence),2,'0'),'hex')
  || app_private.u32be(octet_length(p_payload))
  || p_payload;

CREATE FUNCTION app.source_key_r3(
  p_source_kind text,
  p_source_entity_type text,
  p_source_entity_id text,
  p_source_aux_is_null boolean,
  p_source_aux_text text
) RETURNS bytea
LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_result bytea;
  v_aux bytea;
BEGIN
  IF p_source_kind !~ '^[\x20-\x7E]{1,64}$'
     OR p_source_entity_type !~ '^[\x20-\x7E]{1,64}$'
     OR p_source_entity_id !~ '^[\x20-\x7E]{1,64}$' THEN
    RAISE EXCEPTION 'source identity domain' USING ERRCODE='22023';
  END IF;
  IF p_source_aux_is_null THEN
    IF p_source_aux_text IS NOT NULL THEN
      RAISE EXCEPTION 'source auxiliary NULL mismatch' USING ERRCODE='22023';
    END IF;
    v_aux := app_private.r6_field(4,0,0,''::bytea);
  ELSE
    IF p_source_aux_text IS NULL
       OR octet_length(p_source_aux_text) NOT BETWEEN 1 AND 128
       OR p_source_aux_text ~ '[\x00-\x1F\x7F-\x9F]'
       OR p_source_aux_text IS NOT NFC NORMALIZED THEN
      RAISE EXCEPTION 'source auxiliary domain' USING ERRCODE='22023';
    END IF;
    v_aux := app_private.r6_field(4,2,1,convert_to(p_source_aux_text,'UTF8'));
  END IF;
  v_result := 'SRC3'::bytea || app_private.u16be(3) || app_private.u16be(4)
    || app_private.r6_field(1,1,1,convert_to(p_source_kind,'UTF8'))
    || app_private.r6_field(2,1,1,convert_to(p_source_entity_type,'UTF8'))
    || app_private.r6_field(3,1,1,convert_to(p_source_entity_id,'UTF8'))
    || v_aux
    || decode('FFFF','hex');
  IF octet_length(v_result) > 362 THEN
    RAISE EXCEPTION 'source key length' USING ERRCODE='22001';
  END IF;
  RETURN v_result;
END
$$;

CREATE FUNCTION app_private.stable_key_r3(
  p_record_type smallint,
  p_components jsonb
) RETURNS bytea
LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_component jsonb;
  v_index integer := 0;
  v_result bytea;
  v_name text;
  v_kind text;
  v_value jsonb;
  v_payload bytea;
  v_type_tag integer;
  v_expected_name text;
  v_expected_kind text;
BEGIN
  IF p_record_type NOT BETWEEN 0 AND 9
     OR jsonb_typeof(p_components) <> 'array'
     OR jsonb_array_length(p_components) NOT BETWEEN 1 AND 2 THEN
    RAISE EXCEPTION 'stable tuple shape' USING ERRCODE='22023';
  END IF;
  v_result := 'SKR2'::bytea || app_private.u16be(2) || app_private.u16be(3)
    || app_private.u16be(p_record_type) || app_private.u16be(jsonb_array_length(p_components));
  FOR v_component IN SELECT value FROM jsonb_array_elements(p_components) LOOP
    v_index := v_index + 1;
    v_name := v_component->>'name';
    v_kind := v_component->>'kind';
    v_value := v_component->'value';
    v_expected_name := CASE
      WHEN p_record_type=0 AND v_index=1 THEN 'snapshotId'
      WHEN p_record_type=1 AND v_index=1 THEN 'requirementVersionId'
      WHEN p_record_type=1 AND v_index=2 THEN 'fieldKey'
      WHEN p_record_type=2 AND v_index=1 THEN 'candidateId'
      WHEN p_record_type=3 AND v_index=1 THEN 'candidateId'
      WHEN p_record_type=3 AND v_index=2 THEN 'parameterKey'
      WHEN p_record_type=4 AND v_index=1 THEN 'candidateId'
      WHEN p_record_type=4 AND v_index=2 THEN 'priceRevisionId'
      WHEN p_record_type=5 AND v_index=1 THEN 'sourceRevisionId'
      WHEN p_record_type=6 AND v_index=1 THEN 'catalogReviewId'
      WHEN p_record_type=7 AND v_index=1 THEN 'professionalReviewId'
      WHEN p_record_type=7 AND v_index=2 THEN 'eventSequence'
      WHEN p_record_type=8 AND v_index=1 THEN 'candidateId'
      WHEN p_record_type=8 AND v_index=2 THEN 'warningSequence'
      WHEN p_record_type=9 AND v_index=1 THEN 'candidateId'
      WHEN p_record_type=9 AND v_index=2 THEN 'fieldKey'
    END;
    v_expected_kind := CASE
      WHEN p_record_type=1 AND v_index=2 THEN 'ASCII_KEY'
      WHEN p_record_type=3 AND v_index=2 THEN 'ASCII_KEY'
      WHEN p_record_type=7 AND v_index=2 THEN 'INT64'
      WHEN p_record_type=8 AND v_index=2 THEN 'INT64'
      WHEN p_record_type=9 AND v_index=2 THEN 'ASCII_KEY'
      ELSE 'ASCII_ID'
    END;
    IF v_name IS DISTINCT FROM v_expected_name OR v_kind IS DISTINCT FROM v_expected_kind THEN
      RAISE EXCEPTION 'stable tuple definition' USING ERRCODE='22023';
    END IF;
    IF v_kind = 'ASCII_ID' THEN
      v_type_tag := 1;
      IF jsonb_typeof(v_value) <> 'string'
         OR (v_value #>> '{}') !~ '^[\x20-\x7E]{0,64}$' THEN
        RAISE EXCEPTION 'stable ASCII_ID' USING ERRCODE='22023';
      END IF;
      v_payload := convert_to(v_value #>> '{}','UTF8');
    ELSIF v_kind = 'ASCII_KEY' THEN
      v_type_tag := 2;
      IF jsonb_typeof(v_value) <> 'string'
         OR (v_value #>> '{}') !~ '^[\x20-\x7E]{0,64}$' THEN
        RAISE EXCEPTION 'stable ASCII_KEY' USING ERRCODE='22023';
      END IF;
      v_payload := convert_to(v_value #>> '{}','UTF8');
    ELSIF v_kind = 'INT64' THEN
      v_type_tag := 3;
      IF jsonb_typeof(v_value) <> 'number' THEN
        RAISE EXCEPTION 'stable INT64' USING ERRCODE='22023';
      END IF;
      v_payload := app_private.i64be((v_value #>> '{}')::bigint);
    ELSE
      RAISE EXCEPTION 'stable component kind' USING ERRCODE='22023';
    END IF;
    v_result := v_result
      || app_private.u16be(v_index)
      || decode(lpad(to_hex(v_type_tag),2,'0') || '01','hex')
      || app_private.u32be(octet_length(v_payload))
      || v_payload;
  END LOOP;
  v_result := v_result || decode('FFFF','hex');
  IF octet_length(v_result) > 158 THEN
    RAISE EXCEPTION 'stable key length' USING ERRCODE='22001';
  END IF;
  RETURN v_result;
END
$$;

CREATE FUNCTION app_private.r6_field_allowed(
  p_record_type smallint,
  p_tag integer,
  p_type text
) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
RETURN CASE p_record_type
  WHEN 0 THEN p_tag BETWEEN 1 AND 14 AND p_type IN ('CANONICAL_ID','ENUM','TEXT','TIMESTAMP')
  WHEN 1 THEN
    (p_tag IN (1) AND p_type='TEXT')
    OR (p_tag IN (2,5,7,8) AND p_type='ENUM')
    OR (p_tag IN (6,9) AND p_type='CANONICAL_ID')
    OR (p_tag=3 AND p_type IN ('BOOLEAN','INTEGER','DECIMAL','TEXT','ENUM','CANONICAL_ID','TIMESTAMP','BYTES','NULL'))
    OR (p_tag=4 AND p_type IN ('TEXT','NULL'))
    OR (p_tag=10 AND p_type IN ('TEXT','NULL'))
    OR (p_tag=11 AND p_type='BYTES')
  WHEN 2 THEN
    (p_tag BETWEEN 1 AND 4 AND p_type='CANONICAL_ID')
    OR (p_tag IN (5,7) AND p_type='TEXT')
    OR (p_tag=6 AND p_type='CANONICAL_ID')
    OR (p_tag=8 AND p_type IN ('CANONICAL_ID','NULL'))
    OR (p_tag=9 AND p_type='CANONICAL_ID')
    OR (p_tag BETWEEN 10 AND 14 AND p_type='ENUM')
  WHEN 3 THEN
    (p_tag IN (1,2,7) AND p_type='CANONICAL_ID')
    OR (p_tag=3 AND p_type='TEXT')
    OR (p_tag=4 AND p_type='ENUM')
    OR (p_tag=5 AND p_type IN ('BOOLEAN','INTEGER','DECIMAL','TEXT','ENUM','CANONICAL_ID','TIMESTAMP','BYTES'))
    OR (p_tag=6 AND p_type IN ('TEXT','NULL'))
  WHEN 4 THEN
    (p_tag BETWEEN 1 AND 4 AND p_type='CANONICAL_ID')
    OR (p_tag=5 AND p_type='INTEGER')
    OR (p_tag BETWEEN 6 AND 9 AND p_type='ENUM')
    OR (p_tag IN (10,12) AND p_type='TIMESTAMP')
    OR (p_tag=11 AND p_type IN ('TIMESTAMP','NULL'))
  WHEN 5 THEN
    (p_tag BETWEEN 1 AND 2 AND p_type='CANONICAL_ID')
    OR (p_tag=3 AND p_type='TEXT')
    OR (p_tag=4 AND p_type='ENUM')
    OR (p_tag=5 AND p_type='TIMESTAMP')
  WHEN 6 THEN
    (p_tag BETWEEN 1 AND 4 AND p_type='CANONICAL_ID')
    OR (p_tag=5 AND p_type='ENUM')
    OR (p_tag=6 AND p_type='TIMESTAMP')
  WHEN 7 THEN
    (p_tag IN (1,2,4) AND p_type='CANONICAL_ID')
    OR (p_tag=3 AND p_type='INTEGER')
    OR (p_tag=5 AND p_type='ENUM')
    OR (p_tag=6 AND p_type='TEXT')
    OR (p_tag=7 AND p_type='TIMESTAMP')
  WHEN 8 THEN
    (p_tag IN (1,2) AND p_type='CANONICAL_ID')
    OR (p_tag=3 AND p_type='INTEGER')
    OR (p_tag IN (4,5) AND p_type='ENUM')
    OR (p_tag=6 AND p_type='TEXT')
  WHEN 9 THEN
    (p_tag IN (1) AND p_type='CANONICAL_ID')
    OR (p_tag=2 AND p_type='TEXT')
    OR (p_tag IN (3,4) AND p_type='ENUM')
  ELSE false
END;

CREATE FUNCTION app_private.r6_record(
  p_record_type smallint,
  p_row_id text,
  p_stable_key bytea,
  p_fields jsonb
) RETURNS bytea
LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_field jsonb;
  v_previous_tag integer := -1;
  v_tag integer;
  v_type text;
  v_type_tag integer;
  v_presence integer;
  v_payload bytea;
  v_fields bytea := ''::bytea;
  v_count integer := 0;
  v_expected_count integer;
  v_inner bytea;
BEGIN
  IF p_row_id !~ '^[\x20-\x7E]{1,64}$'
     OR octet_length(p_stable_key) NOT BETWEEN 1 AND 158
     OR jsonb_typeof(p_fields) <> 'array'
     OR jsonb_array_length(p_fields) NOT BETWEEN 1 AND 32 THEN
    RAISE EXCEPTION 'record shape' USING ERRCODE='22023';
  END IF;
  v_expected_count := CASE p_record_type
    WHEN 0 THEN 14
    WHEN 1 THEN 11
    WHEN 2 THEN 14
    WHEN 3 THEN 7
    WHEN 4 THEN 12
    WHEN 5 THEN 5
    WHEN 6 THEN 6
    WHEN 7 THEN 7
    WHEN 8 THEN 6
    WHEN 9 THEN 4
  END;
  IF jsonb_array_length(p_fields) <> v_expected_count THEN
    RAISE EXCEPTION 'field inventory mismatch' USING ERRCODE='22023';
  END IF;
  FOR v_field IN SELECT value FROM jsonb_array_elements(p_fields) LOOP
    v_count := v_count + 1;
    v_tag := (v_field->>'tag')::integer;
    v_type := v_field->>'type';
    IF v_tag <= v_previous_tag THEN
      RAISE EXCEPTION 'field order' USING ERRCODE='22023';
    END IF;
    IF NOT app_private.r6_field_allowed(p_record_type,v_tag,v_type) THEN
      RAISE EXCEPTION 'field/type registry mismatch' USING ERRCODE='22023';
    END IF;
    v_previous_tag := v_tag;
    IF v_type='NULL' THEN
      v_type_tag := 0; v_presence := 0; v_payload := ''::bytea;
    ELSIF v_type='BOOLEAN' THEN
      IF jsonb_typeof(v_field->'value') <> 'boolean' THEN
        RAISE EXCEPTION 'BOOLEAN value' USING ERRCODE='22023';
      END IF;
      v_type_tag := 1; v_presence := 1;
      v_payload := decode(CASE WHEN (v_field->>'value')::boolean THEN '01' ELSE '00' END,'hex');
    ELSIF v_type='INTEGER' OR v_type='TIMESTAMP' THEN
      IF jsonb_typeof(v_field->'value') <> 'number' THEN
        RAISE EXCEPTION 'INT64 value' USING ERRCODE='22023';
      END IF;
      v_type_tag := CASE WHEN v_type='INTEGER' THEN 2 ELSE 7 END;
      v_presence := 1;
      v_payload := app_private.i64be((v_field->>'value')::bigint);
    ELSIF v_type='DECIMAL' THEN
      IF jsonb_typeof(v_field->'value') <> 'string'
         OR (v_field->>'value') !~ '^-?(0|[1-9][0-9]*)(\.[0-9]{1,6})?$'
         OR (v_field->>'value') ~ '^-0(\.0+)?$'
         OR ((v_field->>'value') LIKE '%.%' AND (v_field->>'value') LIKE '%0') THEN
        RAISE EXCEPTION 'DECIMAL value' USING ERRCODE='22023';
      END IF;
      v_type_tag := 3; v_presence := 1;
      v_payload := convert_to(v_field->>'value','UTF8');
    ELSIF v_type='TEXT' THEN
      IF jsonb_typeof(v_field->'value') <> 'string'
         OR strpos(v_field->>'value',E'\x00') > 0
         OR (v_field->>'value') IS NOT NFC NORMALIZED
         OR char_length(v_field->>'value') > 4000 THEN
        RAISE EXCEPTION 'TEXT value' USING ERRCODE='22023';
      END IF;
      v_type_tag := 4; v_presence := 1;
      v_payload := convert_to(v_field->>'value','UTF8');
    ELSIF v_type='ENUM' THEN
      IF jsonb_typeof(v_field->'value') <> 'string'
         OR (v_field->>'value') !~ '^[\x20-\x7E]{1,64}$' THEN
        RAISE EXCEPTION 'ENUM value' USING ERRCODE='22023';
      END IF;
      v_type_tag := 5; v_presence := 1;
      v_payload := convert_to(v_field->>'value','UTF8');
    ELSIF v_type='CANONICAL_ID' THEN
      IF jsonb_typeof(v_field->'value') <> 'string'
         OR (v_field->>'value') !~ '^[\x20-\x7E]{1,64}$' THEN
        RAISE EXCEPTION 'CANONICAL_ID value' USING ERRCODE='22023';
      END IF;
      v_type_tag := 6; v_presence := 1;
      v_payload := convert_to(v_field->>'value','UTF8');
    ELSIF v_type='BYTES' THEN
      IF jsonb_typeof(v_field->'bytesHex') <> 'string' THEN
        RAISE EXCEPTION 'BYTES value' USING ERRCODE='22023';
      END IF;
      v_payload := decode(v_field->>'bytesHex','hex');
      IF octet_length(v_payload) NOT BETWEEN 1 AND 512 THEN
        RAISE EXCEPTION 'BYTES length' USING ERRCODE='22001';
      END IF;
      v_type_tag := 8; v_presence := 1;
    ELSE
      RAISE EXCEPTION 'field type' USING ERRCODE='22023';
    END IF;
    v_fields := v_fields || app_private.r6_field(v_tag,v_type_tag,v_presence,v_payload);
  END LOOP;
  v_inner := app_private.u16be(p_record_type)
    || app_private.u16be(octet_length(p_row_id))
    || convert_to(p_row_id,'UTF8')
    || app_private.u16be(octet_length(p_stable_key))
    || p_stable_key
    || app_private.u16be(v_count)
    || v_fields;
  IF octet_length(v_inner) + 4 > 16874 THEN
    RAISE EXCEPTION 'record length' USING ERRCODE='22001';
  END IF;
  RETURN app_private.u32be(octet_length(v_inner) + 4) || v_inner;
END
$$;

CREATE FUNCTION app_private.lock_active_session(
  p_db_role text,
  p_capability text
) RETURNS TABLE (
  session_id text,
  principal_id text,
  login_epoch bigint,
  authority_grant_id text
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_session_id text;
  v_principal_id text;
  v_current_epoch bigint;
  v_session_epoch bigint;
  v_grant_id text;
BEGIN
  SELECT ts.principal_id INTO v_principal_id
    FROM app.trusted_session ts
   WHERE ts.db_auth_role=p_db_role;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'trusted session role missing' USING ERRCODE='42501';
  END IF;
  SELECT pe.current_epoch INTO v_current_epoch
    FROM app.principal_epoch pe
   WHERE pe.principal_id=v_principal_id
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'principal epoch missing' USING ERRCODE='42501';
  END IF;
  SELECT ts.session_id,ts.login_epoch INTO v_session_id,v_session_epoch
    FROM app.trusted_session ts
   WHERE ts.db_auth_role=p_db_role
     AND ts.principal_id=v_principal_id
     AND ts.state='ACTIVE'
     AND ts.revoked_at IS NULL
     AND clock_timestamp()>=ts.not_before
     AND clock_timestamp()<ts.expires_at
     AND ts.login_epoch=v_current_epoch
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'active trusted session missing' USING ERRCODE='42501';
  END IF;
  SELECT g.id INTO v_grant_id
    FROM app.authority_grant g
   WHERE g.principal_id=v_principal_id
     AND g.authority_code=p_capability
     AND g.revoked_at IS NULL
     AND clock_timestamp() >= g.valid_from
     AND (g.valid_until IS NULL OR clock_timestamp() < g.valid_until)
   ORDER BY g.id
   LIMIT 1
   FOR SHARE;
  IF v_grant_id IS NULL THEN
    RAISE EXCEPTION 'capability not granted' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT v_session_id,v_principal_id,v_session_epoch,v_grant_id;
END
$$;

CREATE FUNCTION app_private.assert_active_session(
  p_session_id text,
  p_principal_id text,
  p_login_epoch bigint
) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM app.trusted_session ts
      JOIN app.principal_epoch pe ON pe.principal_id=ts.principal_id
     WHERE ts.session_id=p_session_id
       AND ts.principal_id=p_principal_id
       AND ts.login_epoch=p_login_epoch
       AND pe.current_epoch=p_login_epoch
       AND ts.state='ACTIVE'
       AND ts.revoked_at IS NULL
       AND clock_timestamp() >= ts.not_before
       AND clock_timestamp() < ts.expires_at
  ) THEN
    RAISE EXCEPTION 'trusted session changed' USING ERRCODE='42501';
  END IF;
END
$$;

CREATE FUNCTION app.open_trusted_session(
  p_session_id text,
  p_principal_id text,
  p_login_epoch bigint,
  p_db_auth_role text,
  p_audience text,
  p_issuer text,
  p_assertion_id text,
  p_assertion_digest text,
  p_issued_at timestamptz,
  p_not_before timestamptz,
  p_expires_at timestamptz
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_epoch bigint;
BEGIN
  IF session_user <> 'elevator_identity_broker' THEN
    RAISE EXCEPTION 'broker role required' USING ERRCODE='42501';
  END IF;
  IF p_session_id IS NULL OR p_principal_id IS NULL OR p_db_auth_role IS NULL
     OR p_assertion_id IS NULL OR p_assertion_digest IS NULL
     OR p_audience IS NULL OR p_issuer IS NULL THEN
    RAISE EXCEPTION 'session identity incomplete' USING ERRCODE='22004';
  END IF;
  IF p_not_before < p_issued_at OR p_expires_at <= p_issued_at
     OR p_expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'session validity invalid' USING ERRCODE='22007';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
     WHERE rolname=p_db_auth_role
       AND rolcanlogin
       AND NOT rolsuper
       AND NOT rolbypassrls
  ) THEN
    RAISE EXCEPTION 'session role invalid' USING ERRCODE='42501';
  END IF;
  SELECT pe.current_epoch INTO v_epoch
    FROM app.principal_epoch pe
   WHERE pe.principal_id=p_principal_id
   FOR UPDATE;
  IF v_epoch IS NULL THEN
    RAISE EXCEPTION 'principal epoch missing' USING ERRCODE='23503';
  END IF;
  IF v_epoch <> p_login_epoch THEN
    RAISE EXCEPTION 'stale login epoch' USING ERRCODE='40001';
  END IF;
  INSERT INTO app.trusted_session(
    session_id,principal_id,login_epoch,db_auth_role,audience,issuer,
    assertion_id,assertion_digest,issued_at,not_before,expires_at,
    state,created_at
  ) VALUES(
    p_session_id,p_principal_id,p_login_epoch,p_db_auth_role,p_audience,p_issuer,
    p_assertion_id,p_assertion_digest,p_issued_at,p_not_before,p_expires_at,
    'ACTIVE',clock_timestamp()
  );
  INSERT INTO app.session_audit(
    id,session_id,action,actor_role,reason,occurred_at
  ) VALUES(
    gen_random_uuid()::text,p_session_id,'OPEN',session_user,'opened',clock_timestamp()
  );
END
$$;

CREATE FUNCTION app.revoke_trusted_session(
  p_session_id text,
  p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_principal_id text;
BEGIN
  IF session_user <> 'elevator_identity_broker' THEN
    RAISE EXCEPTION 'broker role required' USING ERRCODE='42501';
  END IF;
  SELECT ts.principal_id INTO v_principal_id
    FROM app.trusted_session ts
   WHERE ts.session_id=p_session_id;
  IF v_principal_id IS NULL THEN
    RAISE EXCEPTION 'session missing' USING ERRCODE='23503';
  END IF;
  PERFORM 1 FROM app.principal_epoch pe
   WHERE pe.principal_id=v_principal_id
   FOR UPDATE;
  PERFORM 1 FROM app.trusted_session ts
   WHERE ts.session_id=p_session_id
   FOR UPDATE;
  UPDATE app.trusted_session
     SET state='REVOKED',revoked_at=clock_timestamp(),revocation_reason=p_reason
   WHERE session_id=p_session_id AND state='ACTIVE';
  IF NOT FOUND THEN
    RETURN;
  END IF;
  INSERT INTO app.session_audit(
    id,session_id,action,actor_role,reason,occurred_at
  ) VALUES(
    gen_random_uuid()::text,p_session_id,'REVOKE',session_user,p_reason,clock_timestamp()
  );
END
$$;

CREATE FUNCTION app.advance_principal_epoch(
  p_principal_id text,
  p_reason text
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_next bigint;
  v_session_id text;
BEGIN
  IF session_user <> 'elevator_identity_broker' THEN
    RAISE EXCEPTION 'broker role required' USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM app.principal_epoch pe
   WHERE pe.principal_id=p_principal_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'principal epoch missing' USING ERRCODE='23503';
  END IF;
  FOR v_session_id IN
    SELECT ts.session_id FROM app.trusted_session ts
     WHERE ts.principal_id=p_principal_id
     ORDER BY ts.session_id
     FOR UPDATE
  LOOP
    UPDATE app.trusted_session
       SET state='REVOKED',revoked_at=clock_timestamp(),revocation_reason=p_reason
     WHERE session_id=v_session_id AND state='ACTIVE';
    INSERT INTO app.session_audit(
      id,session_id,action,actor_role,reason,occurred_at
    ) VALUES(
      gen_random_uuid()::text,v_session_id,'REVOKE',session_user,p_reason,clock_timestamp()
    );
  END LOOP;
  UPDATE app.principal_epoch
     SET current_epoch=current_epoch+1,updated_at=clock_timestamp()
   WHERE principal_id=p_principal_id
   RETURNING current_epoch INTO v_next;
  INSERT INTO app.session_audit(
    id,session_id,action,actor_role,reason,occurred_at
  )
  SELECT gen_random_uuid()::text,ts.session_id,'EPOCH_ADVANCE',session_user,p_reason,clock_timestamp()
    FROM app.trusted_session ts
   WHERE ts.principal_id=p_principal_id
   ORDER BY ts.session_id;
  RETURN v_next;
END
$$;

CREATE FUNCTION app.revoke_authority_grant(
  p_grant_id text,
  p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  v_principal_id text;
  v_epoch bigint;
BEGIN
  SELECT * INTO s FROM app_private.lock_active_session(session_user,'AUTHORITY_REVOKE');
  SELECT g.principal_id INTO v_principal_id
    FROM app.authority_grant g
   WHERE g.id=p_grant_id;
  IF v_principal_id IS NULL THEN
    RAISE EXCEPTION 'authority grant missing' USING ERRCODE='23503';
  END IF;
  SELECT pe.current_epoch INTO v_epoch
    FROM app.principal_epoch pe
   WHERE pe.principal_id=v_principal_id
   FOR UPDATE;
  IF v_epoch IS NULL THEN
    RAISE EXCEPTION 'target principal epoch missing' USING ERRCODE='23503';
  END IF;
  PERFORM 1 FROM app.authority_grant g
   WHERE g.id=p_grant_id
   FOR UPDATE;
  UPDATE app.authority_grant
     SET revoked_at=clock_timestamp(),revocation_reason=p_reason
   WHERE id=p_grant_id AND revoked_at IS NULL;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
END
$$;

CREATE FUNCTION app.has_project_authority(
  p_principal_id text,
  p_project_id text,
  p_capability text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
RETURN EXISTS (
  SELECT 1
    FROM app.authority_grant g
   WHERE g.principal_id=p_principal_id
     AND (g.project_id IS NULL OR g.project_id=p_project_id)
     AND g.authority_code=p_capability
     AND g.revoked_at IS NULL
     AND clock_timestamp() >= g.valid_from
     AND (g.valid_until IS NULL OR clock_timestamp() < g.valid_until)
);

CREATE FUNCTION app.policy_digest(p_content text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  IF p_content::jsonb::text <> p_content THEN
    RAISE EXCEPTION 'policy content is not canonical JSONB text' USING ERRCODE='22023';
  END IF;
  RETURN app_private.sha256_hex(
    decode('414945412D504F4C49435900763100','hex') || convert_to(p_content,'UTF8')
  );
END
$$;

CREATE FUNCTION app.create_policy_revision(
  p_policy_id text,
  p_policy_kind text,
  p_scope_project_id text,
  p_revision_number bigint,
  p_content text,
  p_supersedes_revision_id text,
  p_request_id text,
  p_request_key text,
  p_reason text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  v_revision_id text := gen_random_uuid()::text;
  v_event_id text := gen_random_uuid()::text;
  v_content bytea;
  v_digest text;
  v_request_hash text;
BEGIN
  SELECT * INTO s FROM app_private.lock_active_session(session_user,'POLICY_AUTHOR');
  IF p_scope_project_id IS NOT NULL
     AND NOT app.has_project_authority(s.principal_id,p_scope_project_id,'POLICY_AUTHOR') THEN
    RAISE EXCEPTION 'policy project authority missing' USING ERRCODE='42501';
  END IF;
  IF p_content IS NULL OR p_policy_id IS NULL OR p_policy_kind IS NULL
     OR p_revision_number IS NULL OR p_request_id IS NULL OR p_request_key IS NULL THEN
    RAISE EXCEPTION 'policy create input incomplete' USING ERRCODE='22004';
  END IF;
  v_content := convert_to(p_content::text,'UTF8');
  v_content := convert_to(p_content::jsonb::text,'UTF8');
  v_digest := app.policy_digest(p_content);
  v_request_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','POLICY_CREATE',
    'policyId',p_policy_id,
    'policyKind',p_policy_kind,
    'scopeProjectId',p_scope_project_id,
    'revisionNumber',p_revision_number,
    'digest',v_digest,
    'requestKey',p_request_key
  ));
  INSERT INTO app.policy_revision(
    id,policy_id,policy_kind,scope_project_id,revision_number,
    canonical_content,content_digest,content_version,
    created_by_principal_id,created_by_session_id,
    supersedes_revision_id,created_at
  ) VALUES(
    v_revision_id,p_policy_id,p_policy_kind,p_scope_project_id,p_revision_number,
    v_content,v_digest,1,s.principal_id,s.session_id,
    p_supersedes_revision_id,clock_timestamp()
  );
  INSERT INTO app.policy_review_event(
    id,policy_id,policy_revision_id,event_sequence,state_version,
    previous_state,command,next_state,
    actor_principal_id,actor_session_id,actor_authority_grant_id,
    request_id,request_hash,evidence_reference,occurred_at
  ) VALUES(
    v_event_id,p_policy_id,v_revision_id,1,1,NULL,'CREATE','DRAFT',
    s.principal_id,s.session_id,s.authority_grant_id,
    p_request_id,v_request_hash,p_reason,clock_timestamp()
  );
  INSERT INTO app.policy_current(
    policy_id,policy_kind,scope_project_id,revision_id,effective_event_id,
    state,generation,updated_at
  ) VALUES(
    p_policy_id,p_policy_kind,p_scope_project_id,v_revision_id,v_event_id,
    'NONE',1,clock_timestamp()
  )
  ON CONFLICT (policy_id) DO NOTHING;
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
  RETURN v_revision_id;
END
$$;

CREATE FUNCTION app.transition_policy_review(
  p_policy_revision_id text,
  p_expected_sequence bigint,
  p_command app.policy_command,
  p_request_id text,
  p_request_key text,
  p_reason text
) RETURNS TABLE (
  event_id text,
  event_sequence bigint,
  resulting_state text,
  replay boolean
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  p app.policy_revision%ROWTYPE;
  current_row app.policy_current%ROWTYPE;
  old_event app.policy_review_event%ROWTYPE;
  replay_event app.policy_review_event%ROWTYPE;
  v_required_authority text;
  v_grant_id text;
  v_next_state text;
  v_request_hash text;
  v_new_event_id text := gen_random_uuid()::text;
BEGIN
  SELECT * INTO s FROM app_private.lock_active_session(session_user,'POLICY_REVIEW');
  SELECT * INTO STRICT p FROM app.policy_revision
   WHERE id=p_policy_revision_id FOR SHARE;
  SELECT * INTO STRICT current_row FROM app.policy_current
   WHERE policy_id=p.policy_id FOR UPDATE;
  v_request_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','POLICY_REVIEW',
    'revisionId',p.id,
    'expectedSequence',p_expected_sequence,
    'command',p_command::text,
    'requestKey',p_request_key,
    'reason',p_reason
  ));
  SELECT * INTO replay_event
    FROM app.policy_review_event e
   WHERE e.policy_revision_id=p.id AND e.request_id=p_request_id;
  IF FOUND THEN
    IF replay_event.actor_principal_id <> s.principal_id
       OR replay_event.request_hash <> v_request_hash THEN
      RAISE EXCEPTION 'request id reused' USING ERRCODE='40001';
    END IF;
    PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
    RETURN QUERY SELECT replay_event.id,replay_event.event_sequence,
                        replay_event.next_state,true;
    RETURN;
  END IF;
  SELECT * INTO old_event
    FROM app.policy_review_event e
   WHERE e.policy_revision_id=p.id
   ORDER BY e.event_sequence DESC
   LIMIT 1;
  IF old_event.id IS NULL OR old_event.event_sequence <> p_expected_sequence THEN
    RAISE EXCEPTION 'stale policy sequence' USING ERRCODE='40001';
  END IF;
  v_required_authority := CASE p_command
    WHEN 'SUBMIT' THEN 'POLICY_AUTHOR'
    WHEN 'APPROVE' THEN 'POLICY_APPROVER'
    WHEN 'REJECT' THEN 'POLICY_APPROVER'
    WHEN 'INVALIDATE' THEN 'POLICY_SECURITY_ADMIN'
    WHEN 'EXPIRE' THEN 'POLICY_LIFECYCLE'
    WHEN 'SUPERSEDE' THEN 'POLICY_APPROVER'
  END;
  SELECT g.id INTO v_grant_id
    FROM app.authority_grant g
   WHERE g.principal_id=s.principal_id
     AND g.authority_code=v_required_authority
     AND (g.project_id IS NULL OR g.project_id=p.scope_project_id)
     AND (g.policy_id IS NULL OR g.policy_id=p.policy_id)
     AND (g.policy_revision_id IS NULL OR g.policy_revision_id=p.id)
     AND g.revoked_at IS NULL
     AND clock_timestamp() >= g.valid_from
     AND (g.valid_until IS NULL OR clock_timestamp() < g.valid_until)
   ORDER BY g.id
   LIMIT 1
   FOR SHARE;
  IF v_grant_id IS NULL THEN
    RAISE EXCEPTION 'policy transition authority missing' USING ERRCODE='42501';
  END IF;
  IF p_command='APPROVE' AND s.principal_id=p.created_by_principal_id THEN
    RAISE EXCEPTION 'self approval denied' USING ERRCODE='42501';
  END IF;
  v_next_state := CASE
    WHEN old_event.next_state='DRAFT' AND p_command='SUBMIT' THEN 'IN_REVIEW'
    WHEN old_event.next_state='IN_REVIEW' AND p_command='APPROVE' THEN 'APPROVED'
    WHEN old_event.next_state='IN_REVIEW' AND p_command='REJECT' THEN 'REJECTED'
    WHEN old_event.next_state='APPROVED' AND p_command='INVALIDATE' THEN 'INVALIDATED'
    WHEN old_event.next_state='APPROVED' AND p_command='EXPIRE' THEN 'EXPIRED'
    WHEN old_event.next_state='APPROVED' AND p_command='SUPERSEDE' THEN 'SUPERSEDED'
    ELSE NULL
  END;
  IF v_next_state IS NULL THEN
    RAISE EXCEPTION 'undefined policy transition' USING ERRCODE='23514';
  END IF;
  INSERT INTO app.policy_review_event(
    id,policy_id,policy_revision_id,event_sequence,state_version,
    previous_state,command,next_state,
    actor_principal_id,actor_session_id,actor_authority_grant_id,
    request_id,request_hash,evidence_reference,occurred_at
  ) VALUES(
    v_new_event_id,p.policy_id,p.id,old_event.event_sequence+1,old_event.state_version+1,
    old_event.next_state,p_command,v_next_state,
    s.principal_id,s.session_id,v_grant_id,
    p_request_id,v_request_hash,p_reason,clock_timestamp()
  );
  IF v_next_state='APPROVED' THEN
    UPDATE app.policy_current
       SET revision_id=p.id,
           effective_event_id=v_new_event_id,
           state='APPROVED',
           generation=generation+1,
           updated_at=clock_timestamp()
     WHERE policy_id=p.policy_id;
  ELSIF current_row.revision_id=p.id THEN
    UPDATE app.policy_current
       SET effective_event_id=v_new_event_id,
           state='NONE',
           generation=generation+1,
           updated_at=clock_timestamp()
     WHERE policy_id=p.policy_id;
  END IF;
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
  RETURN QUERY SELECT v_new_event_id,old_event.event_sequence+1,v_next_state,false;
END
$$;

CREATE FUNCTION app.policy_is_effective(p_policy_revision_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
RETURN EXISTS (
  SELECT 1
    FROM app.policy_current pc
    JOIN app.policy_revision pr ON pr.id=pc.revision_id
    JOIN app.policy_review_event pe ON pe.id=pc.effective_event_id
   WHERE pr.id=p_policy_revision_id
     AND pc.state='APPROVED'
     AND pe.policy_revision_id=pr.id
     AND pe.next_state='APPROVED'
     AND NOT EXISTS (
       SELECT 1 FROM app.policy_review_event later
        WHERE later.policy_revision_id=pr.id
          AND later.event_sequence>pe.event_sequence
          AND later.next_state IN ('INVALIDATED','EXPIRED','SUPERSEDED')
     )
);

CREATE FUNCTION app.transition_professional_review(
  p_review_id text,
  p_expected_sequence bigint,
  p_command app.professional_review_command,
  p_expected_policy_revision_id text,
  p_basis_digest text,
  p_request_id text,
  p_request_key text,
  p_reason text
) RETURNS TABLE (
  event_id text,
  event_sequence bigint,
  resulting_state text,
  replay boolean
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  r app.professional_review%ROWTYPE;
  old_event app.professional_review_event%ROWTYPE;
  replay_event app.professional_review_event%ROWTYPE;
  v_required_authority text;
  v_grant_id text;
  v_next_state text;
  v_request_hash text;
  v_new_event_id text := gen_random_uuid()::text;
BEGIN
  SELECT * INTO s FROM app_private.lock_active_session(session_user,'PROFESSIONAL_REVIEW');
  SELECT * INTO STRICT r FROM app.professional_review
   WHERE id=p_review_id FOR UPDATE;
  IF r.policy_revision_id <> p_expected_policy_revision_id THEN
    RAISE EXCEPTION 'policy expectation mismatch' USING ERRCODE='40001';
  END IF;
  PERFORM 1 FROM app.policy_current pc
   WHERE pc.policy_id=r.policy_id
   FOR SHARE;
  PERFORM 1 FROM app.policy_revision pr
   WHERE pr.id=r.policy_revision_id
   FOR SHARE;
  IF NOT app.policy_is_effective(r.policy_revision_id) THEN
    RAISE EXCEPTION 'policy not effective' USING ERRCODE='23514';
  END IF;
  v_request_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','PROFESSIONAL_REVIEW',
    'reviewId',r.id,
    'expectedSequence',p_expected_sequence,
    'command',p_command::text,
    'policyRevisionId',p_expected_policy_revision_id,
    'basisDigest',p_basis_digest,
    'requestKey',p_request_key,
    'reason',p_reason
  ));
  SELECT * INTO replay_event
    FROM app.professional_review_event e
   WHERE e.review_id=r.id AND e.request_id=p_request_id;
  IF FOUND THEN
    IF replay_event.actor_principal_id <> s.principal_id
       OR replay_event.request_hash <> v_request_hash THEN
      RAISE EXCEPTION 'request id reused' USING ERRCODE='40001';
    END IF;
    PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
    RETURN QUERY SELECT replay_event.id,replay_event.event_sequence,
                        replay_event.next_state,true;
    RETURN;
  END IF;
  SELECT * INTO old_event
    FROM app.professional_review_event e
   WHERE e.review_id=r.id
   ORDER BY e.event_sequence DESC
   LIMIT 1;
  IF old_event.id IS NULL OR old_event.event_sequence <> p_expected_sequence THEN
    RAISE EXCEPTION 'stale review sequence' USING ERRCODE='40001';
  END IF;
  v_required_authority := CASE p_command
    WHEN 'SUBMIT' THEN 'REVIEW_SUBMITTER'
    WHEN 'RESUBMIT' THEN 'REVIEW_SUBMITTER'
    WHEN 'APPROVE' THEN 'PROFESSIONAL_APPROVER'
    WHEN 'REJECT' THEN 'PROFESSIONAL_APPROVER'
    WHEN 'RETURN' THEN 'PROFESSIONAL_APPROVER'
    WHEN 'INVALIDATE' THEN 'REVIEW_INVALIDATOR'
    WHEN 'EXPIRE' THEN 'POLICY_LIFECYCLE'
  END;
  SELECT g.id INTO v_grant_id
    FROM app.authority_grant g
   WHERE g.principal_id=s.principal_id
     AND g.authority_code=v_required_authority
     AND (g.project_id IS NULL OR g.project_id=r.project_id)
     AND (g.policy_revision_id IS NULL OR g.policy_revision_id=r.policy_revision_id)
     AND g.revoked_at IS NULL
     AND clock_timestamp() >= g.valid_from
     AND (g.valid_until IS NULL OR clock_timestamp() < g.valid_until)
   ORDER BY g.id
   LIMIT 1
   FOR SHARE;
  IF v_grant_id IS NULL THEN
    RAISE EXCEPTION 'review transition authority missing' USING ERRCODE='42501';
  END IF;
  IF p_command='APPROVE' AND r.created_by_principal_id=s.principal_id THEN
    RAISE EXCEPTION 'self approval denied' USING ERRCODE='42501';
  END IF;
  v_next_state := CASE
    WHEN old_event.next_state='CREATED' AND p_command='SUBMIT' THEN 'IN_REVIEW'
    WHEN old_event.next_state='IN_REVIEW' AND p_command='APPROVE' THEN 'APPROVED'
    WHEN old_event.next_state='IN_REVIEW' AND p_command='REJECT' THEN 'REJECTED'
    WHEN old_event.next_state='IN_REVIEW' AND p_command='RETURN' THEN 'RETURNED_FOR_INFORMATION'
    WHEN old_event.next_state='RETURNED_FOR_INFORMATION' AND p_command='RESUBMIT' THEN 'IN_REVIEW'
    WHEN old_event.next_state IN ('CREATED','IN_REVIEW','RETURNED_FOR_INFORMATION')
         AND p_command='INVALIDATE' THEN 'INVALIDATED'
    WHEN old_event.next_state IN ('IN_REVIEW','APPROVED') AND p_command='EXPIRE' THEN 'EXPIRED'
    ELSE NULL
  END;
  IF v_next_state IS NULL THEN
    RAISE EXCEPTION 'undefined review transition' USING ERRCODE='23514';
  END IF;
  INSERT INTO app.professional_review_event(
    id,review_id,project_id,conversation_id,requirement_id,
    requirement_version_id,installation_scenario,candidate_id,
    policy_id,policy_revision_id,event_sequence,state_version,
    previous_state,command,next_state,actor_principal_id,actor_session_id,
    actor_authority_grant_id,request_id,request_hash,basis_digest,reason,occurred_at
  ) VALUES(
    v_new_event_id,r.id,r.project_id,r.conversation_id,r.requirement_id,
    r.requirement_version_id,r.installation_scenario,r.candidate_id,
    r.policy_id,r.policy_revision_id,old_event.event_sequence+1,
    old_event.state_version+1,old_event.next_state,p_command,v_next_state,
    s.principal_id,s.session_id,v_grant_id,p_request_id,v_request_hash,
    p_basis_digest,p_reason,clock_timestamp()
  );
  INSERT INTO app.review_audit(
    id,review_id,event_id,action,actor_principal_id,occurred_at
  ) VALUES(
    gen_random_uuid()::text,r.id,v_new_event_id,p_command::text,
    s.principal_id,clock_timestamp()
  );
  UPDATE app.professional_review
     SET state=v_next_state,
         state_version=old_event.state_version+1,
         mutation_version=mutation_version+1
   WHERE id=r.id;
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
  RETURN QUERY SELECT v_new_event_id,old_event.event_sequence+1,v_next_state,false;
END
$$;

CREATE FUNCTION app.selection_result_digest(p_selection_run_id text)
RETURNS text
LANGUAGE sql STABLE STRICT
RETURN app_private.sha256_hex(convert_to(
  COALESCE((
    SELECT string_agg(
      concat_ws(E'\x1F',
        r.id,r.candidate_id,r.project_id,r.conversation_id,r.requirement_id,
        r.requirement_version_id,r.installation_scenario,
        r.rule_set_revision_id,r.rule_set_content_digest,
        r.product_id,r.product_revision_id,r.product_revision_digest,
        r.specification_revision_id,r.specification_revision_digest,
        r.technical_status,r.commercial_status,r.trust_status,
        r.professional_review_status,r.overall_status
      ),
      E'\x1E'
      ORDER BY r.id
    )
      FROM app.selection_candidate_result r
     WHERE r.selection_run_id=p_selection_run_id
  ),''),
  'UTF8'
));

CREATE FUNCTION app.seal_selection_run(
  p_selection_run_id text,
  p_expected_mutation_version bigint,
  p_request_id text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  run_row app.selection_run%ROWTYPE;
  v_candidate_count integer;
  v_result_count integer;
  v_digest text;
BEGIN
  SELECT * INTO s FROM app_private.lock_active_session(session_user,'SELECTION_SEAL');
  SELECT * INTO STRICT run_row FROM app.selection_run
   WHERE id=p_selection_run_id FOR UPDATE;
  IF run_row.state <> 'RUNNING'
     OR run_row.mutation_version <> p_expected_mutation_version THEN
    RAISE EXCEPTION 'selection seal CAS failed' USING ERRCODE='40001';
  END IF;
  SELECT count(*) INTO v_candidate_count
    FROM app.selection_candidate c
   WHERE c.selection_run_id=run_row.id;
  SELECT count(*) INTO v_result_count
    FROM app.selection_candidate_result r
   WHERE r.selection_run_id=run_row.id;
  IF v_candidate_count=0 OR v_result_count<>v_candidate_count THEN
    RAISE EXCEPTION 'selection result incomplete' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM app.selection_candidate c
      LEFT JOIN app.selection_candidate_result r ON r.candidate_id=c.id
     WHERE c.selection_run_id=run_row.id AND r.id IS NULL
  ) THEN
    RAISE EXCEPTION 'selection result candidate mismatch' USING ERRCODE='23514';
  END IF;
  v_digest := app.selection_result_digest(run_row.id);
  UPDATE app.selection_run
     SET state='SEALED',mutation_version=mutation_version+1
   WHERE id=run_row.id
     AND state='RUNNING'
     AND mutation_version=p_expected_mutation_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'selection seal CAS failed' USING ERRCODE='40001';
  END IF;
  INSERT INTO app.selection_run_seal(
    selection_run_id,case_id,project_id,conversation_id,requirement_id,
    requirement_version_id,installation_scenario,rule_set_revision_id,
    rule_set_content_digest,candidate_count,result_digest,sealed_at
  ) VALUES(
    run_row.id,run_row.case_id,run_row.project_id,run_row.conversation_id,
    run_row.requirement_id,run_row.requirement_version_id,
    run_row.installation_scenario,run_row.rule_set_revision_id,
    run_row.rule_set_content_digest,v_candidate_count,v_digest,clock_timestamp()
  );
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
  RETURN v_digest;
END
$$;

CREATE FUNCTION app_private.snapshot_record_projection_r3(p_snapshot_id text)
RETURNS TABLE (
  record_type smallint,
  stable_key bytea,
  row_id text,
  fields_json jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
  SELECT 0::smallint,
         app_private.stable_key_r3(0,jsonb_build_array(
           jsonb_build_object('name','snapshotId','kind','ASCII_ID','value',s.id)
         )),
         s.id,
         jsonb_build_array(
           jsonb_build_object('tag',1,'type','CANONICAL_ID','value',s.id),
           jsonb_build_object('tag',2,'type','CANONICAL_ID','value',s.case_id),
           jsonb_build_object('tag',3,'type','CANONICAL_ID','value',s.project_id),
           jsonb_build_object('tag',4,'type','CANONICAL_ID','value',s.conversation_id),
           jsonb_build_object('tag',5,'type','CANONICAL_ID','value',s.requirement_id),
           jsonb_build_object('tag',6,'type','CANONICAL_ID','value',s.requirement_version_id),
           jsonb_build_object('tag',7,'type','ENUM','value',s.installation_scenario),
           jsonb_build_object('tag',8,'type','CANONICAL_ID','value',s.selection_run_id),
           jsonb_build_object('tag',9,'type','CANONICAL_ID','value',s.rule_set_revision_id),
           jsonb_build_object('tag',10,'type','TEXT','value',s.rule_set_content_digest),
           jsonb_build_object('tag',11,'type','TIMESTAMP','value',floor(extract(epoch FROM s.basis_as_of)*1000)::bigint),
           jsonb_build_object('tag',12,'type','ENUM','value','SNAPSHOT-R3'),
           jsonb_build_object('tag',13,'type','ENUM','value','R3-BASIS-1-R6'),
           jsonb_build_object('tag',14,'type','ENUM','value','SK-R2')
         )
    FROM app.sales_handoff_snapshot_r3 s
   WHERE s.id=p_snapshot_id
  UNION ALL
  SELECT 1::smallint,
         r.stable_key,
         md5(r.stable_key),
         jsonb_build_array(
           jsonb_build_object('tag',1,'type','TEXT','value',r.field_key),
           jsonb_build_object('tag',2,'type','ENUM','value',r.value_type),
           jsonb_build_object('tag',3,'type',r.value_type) || r.value_json - 'tag',
           CASE WHEN r.unit IS NULL THEN jsonb_build_object('tag',4,'type','NULL')
                ELSE jsonb_build_object('tag',4,'type','TEXT','value',r.unit) END,
           jsonb_build_object('tag',5,'type','ENUM','value',r.field_status),
           jsonb_build_object('tag',6,'type','CANONICAL_ID','value',r.source_value_id),
           jsonb_build_object('tag',7,'type','ENUM','value',r.source_kind),
           jsonb_build_object('tag',8,'type','ENUM','value',r.source_entity_type),
           jsonb_build_object('tag',9,'type','CANONICAL_ID','value',r.source_entity_id),
           CASE WHEN r.source_aux_is_null THEN jsonb_build_object('tag',10,'type','NULL')
                ELSE jsonb_build_object('tag',10,'type','TEXT','value',r.source_aux_text) END,
           jsonb_build_object(
             'tag',11,'type','BYTES',
             'bytesHex',encode(app.source_key_r3(
               r.source_kind,r.source_entity_type,r.source_entity_id,
               r.source_aux_is_null,r.source_aux_text
             ),'hex')
           )
         )
    FROM app.sales_snapshot_requirement_field_r3 r
   WHERE r.snapshot_id=p_snapshot_id
  UNION ALL
  SELECT 2::smallint,
         c.stable_key,
         md5(c.stable_key),
         jsonb_build_array(
           jsonb_build_object('tag',1,'type','CANONICAL_ID','value',c.selection_result_item_id),
           jsonb_build_object('tag',2,'type','CANONICAL_ID','value',c.candidate_id),
           jsonb_build_object('tag',3,'type','CANONICAL_ID','value',c.product_id),
           jsonb_build_object('tag',4,'type','CANONICAL_ID','value',c.product_revision_id),
           jsonb_build_object('tag',5,'type','TEXT','value',c.product_revision_digest),
           jsonb_build_object('tag',6,'type','CANONICAL_ID','value',c.specification_revision_id),
           jsonb_build_object('tag',7,'type','TEXT','value',c.specification_revision_digest),
           CASE WHEN p.price_revision_id IS NULL THEN jsonb_build_object('tag',8,'type','NULL')
                ELSE jsonb_build_object('tag',8,'type','CANONICAL_ID','value',p.price_revision_id) END,
           jsonb_build_object('tag',9,'type','CANONICAL_ID','value',c.rule_set_revision_id),
           jsonb_build_object('tag',10,'type','ENUM','value',c.technical_status),
           jsonb_build_object('tag',11,'type','ENUM','value',c.commercial_status),
           jsonb_build_object('tag',12,'type','ENUM','value',c.trust_status),
           jsonb_build_object('tag',13,'type','ENUM','value',c.professional_review_status),
           jsonb_build_object('tag',14,'type','ENUM','value',c.overall_status)
         )
    FROM app.sales_snapshot_candidate_r3 c
    LEFT JOIN app.sales_snapshot_price_r3 p
      ON p.snapshot_id=c.snapshot_id AND p.candidate_row_id=c.candidate_row_id
   WHERE c.snapshot_id=p_snapshot_id
  UNION ALL
  SELECT 3::smallint,
         p.stable_key,
         md5(p.stable_key),
         jsonb_build_array(
           jsonb_build_object('tag',1,'type','CANONICAL_ID','value',p.candidate_id),
           jsonb_build_object('tag',2,'type','CANONICAL_ID','value',p.catalog_parameter_revision_id),
           jsonb_build_object('tag',3,'type','TEXT','value',p.parameter_key),
           jsonb_build_object('tag',4,'type','ENUM','value',p.value_type),
           jsonb_build_object('tag',5,'type',p.value_type) || p.value_json - 'tag',
           CASE WHEN p.unit IS NULL THEN jsonb_build_object('tag',6,'type','NULL')
                ELSE jsonb_build_object('tag',6,'type','TEXT','value',p.unit) END,
           jsonb_build_object('tag',7,'type','CANONICAL_ID','value',p.source_revision_id)
         )
    FROM app.sales_snapshot_parameter_r3 p
   WHERE p.snapshot_id=p_snapshot_id
  UNION ALL
  SELECT 4::smallint,
         p.stable_key,
         md5(p.stable_key),
         jsonb_build_array(
           jsonb_build_object('tag',1,'type','CANONICAL_ID','value',p.candidate_id),
           jsonb_build_object('tag',2,'type','CANONICAL_ID','value',p.price_revision_id),
           jsonb_build_object('tag',3,'type','CANONICAL_ID','value',p.product_revision_id),
           jsonb_build_object('tag',4,'type','CANONICAL_ID','value',p.source_revision_id),
           jsonb_build_object('tag',5,'type','INTEGER','value',p.amount_minor),
           jsonb_build_object('tag',6,'type','ENUM','value',p.currency),
           jsonb_build_object('tag',7,'type','ENUM','value',p.price_basis),
           jsonb_build_object('tag',8,'type','ENUM','value',p.tax_basis),
           jsonb_build_object('tag',9,'type','ENUM','value',p.applicability),
           jsonb_build_object('tag',10,'type','TIMESTAMP','value',floor(extract(epoch FROM p.valid_from)*1000)::bigint),
           CASE WHEN p.valid_until IS NULL THEN jsonb_build_object('tag',11,'type','NULL')
                ELSE jsonb_build_object('tag',11,'type','TIMESTAMP','value',floor(extract(epoch FROM p.valid_until)*1000)::bigint) END,
           jsonb_build_object('tag',12,'type','TIMESTAMP','value',floor(extract(epoch FROM p.quoted_at)*1000)::bigint)
         )
    FROM app.sales_snapshot_price_r3 p
   WHERE p.snapshot_id=p_snapshot_id
  UNION ALL
  SELECT 5::smallint,
         s.stable_key,
         md5(s.stable_key),
         jsonb_build_array(
           jsonb_build_object('tag',1,'type','CANONICAL_ID','value',s.source_revision_id),
           jsonb_build_object('tag',2,'type','CANONICAL_ID','value',s.evidence_object_id),
           jsonb_build_object('tag',3,'type','TEXT','value',s.raw_content_digest),
           jsonb_build_object('tag',4,'type','ENUM','value',s.source_kind),
           jsonb_build_object('tag',5,'type','TIMESTAMP','value',floor(extract(epoch FROM s.captured_at)*1000)::bigint)
         )
    FROM app.sales_snapshot_source_r3 s
   WHERE s.snapshot_id=p_snapshot_id
  UNION ALL
  SELECT 6::smallint,
         r.stable_key,
         md5(r.stable_key),
         jsonb_build_array(
           jsonb_build_object('tag',1,'type','CANONICAL_ID','value',r.catalog_review_id),
           jsonb_build_object('tag',2,'type','CANONICAL_ID','value',r.target_revision_id),
           jsonb_build_object('tag',3,'type','CANONICAL_ID','value',r.source_revision_id),
           jsonb_build_object('tag',4,'type','CANONICAL_ID','value',r.policy_revision_id),
           jsonb_build_object('tag',5,'type','ENUM','value',r.decision),
           jsonb_build_object('tag',6,'type','TIMESTAMP','value',floor(extract(epoch FROM r.reviewed_at)*1000)::bigint)
         )
    FROM app.sales_snapshot_catalog_review_r3 r
   WHERE r.snapshot_id=p_snapshot_id
  UNION ALL
  SELECT 7::smallint,
         r.stable_key,
         md5(r.stable_key),
         jsonb_build_array(
           jsonb_build_object('tag',1,'type','CANONICAL_ID','value',r.professional_review_event_id),
           jsonb_build_object('tag',2,'type','CANONICAL_ID','value',r.professional_review_id),
           jsonb_build_object('tag',3,'type','INTEGER','value',r.event_sequence),
           jsonb_build_object('tag',4,'type','CANONICAL_ID','value',r.policy_revision_id),
           jsonb_build_object('tag',5,'type','ENUM','value',r.decision),
           jsonb_build_object('tag',6,'type','TEXT','value',r.basis_digest),
           jsonb_build_object('tag',7,'type','TIMESTAMP','value',floor(extract(epoch FROM r.occurred_at)*1000)::bigint)
         )
    FROM app.sales_snapshot_professional_review_r3 r
   WHERE r.snapshot_id=p_snapshot_id
  UNION ALL
  SELECT 8::smallint,
         w.stable_key,
         md5(w.stable_key),
         jsonb_build_array(
           jsonb_build_object('tag',1,'type','CANONICAL_ID','value',w.candidate_id),
           jsonb_build_object('tag',2,'type','CANONICAL_ID','value',w.source_warning_id),
           jsonb_build_object('tag',3,'type','INTEGER','value',w.warning_sequence),
           jsonb_build_object('tag',4,'type','ENUM','value',w.severity),
           jsonb_build_object('tag',5,'type','ENUM','value',w.warning_code),
           jsonb_build_object('tag',6,'type','TEXT','value',w.warning_text)
         )
    FROM app.sales_snapshot_warning_r3 w
   WHERE w.snapshot_id=p_snapshot_id
  UNION ALL
  SELECT 9::smallint,
         m.stable_key,
         md5(m.stable_key),
         jsonb_build_array(
           jsonb_build_object('tag',1,'type','CANONICAL_ID','value',m.candidate_id),
           jsonb_build_object('tag',2,'type','TEXT','value',m.field_key),
           jsonb_build_object('tag',3,'type','ENUM','value',m.reason),
           jsonb_build_object('tag',4,'type','ENUM','value',m.impact_scope)
         )
    FROM app.sales_snapshot_missing_field_r3 m
   WHERE m.snapshot_id=p_snapshot_id;
$$;

CREATE FUNCTION app_private.materialize_snapshot_r3(p_snapshot_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s app.sales_handoff_snapshot_r3%ROWTYPE;
BEGIN
  SELECT * INTO STRICT s FROM app.sales_handoff_snapshot_r3
   WHERE id=p_snapshot_id FOR UPDATE;
  IF s.state <> 'DRAFT' THEN
    RAISE EXCEPTION 'materialization requires DRAFT' USING ERRCODE='23514';
  END IF;

  INSERT INTO app.sales_snapshot_requirement_field_r3(
    snapshot_id,selection_run_id,requirement_version_id,field_key,value_json,value_type,unit,
    field_status,source_kind,source_entity_type,source_entity_id,
    source_aux_is_null,source_aux_text,source_value_id,source_revision_id,stable_key
  )
  SELECT s.id,s.selection_run_id,r.requirement_version_id,r.field_key,r.value_json,r.value_type,r.unit,
         r.field_status,r.source_kind,r.source_entity_type,r.source_entity_id,
         r.source_aux_is_null,r.source_aux_text,r.source_value_id,r.source_revision_id,
         app_private.stable_key_r3(1,jsonb_build_array(
           jsonb_build_object('name','requirementVersionId','kind','ASCII_ID','value',r.requirement_version_id),
           jsonb_build_object('name','fieldKey','kind','ASCII_KEY','value',r.field_key)
         ))
    FROM app.selection_requirement_field r
   WHERE r.selection_run_id=s.selection_run_id;

  INSERT INTO app.sales_snapshot_candidate_r3(
    snapshot_id,selection_run_id,candidate_row_id,selection_result_item_id,
    candidate_id,product_id,product_revision_id,product_revision_digest,
    specification_revision_id,specification_revision_digest,
    rule_set_revision_id,rule_set_content_digest,
    technical_status,commercial_status,trust_status,
    professional_review_status,overall_status,stable_key
  )
  SELECT s.id,s.selection_run_id,r.id,r.id,r.candidate_id,r.product_id,
         r.product_revision_id,r.product_revision_digest,
         r.specification_revision_id,r.specification_revision_digest,
         r.rule_set_revision_id,r.rule_set_content_digest,
         r.technical_status,r.commercial_status,r.trust_status,
         r.professional_review_status,r.overall_status,
         app_private.stable_key_r3(2,jsonb_build_array(
           jsonb_build_object('name','candidateId','kind','ASCII_ID','value',r.candidate_id)
         ))
    FROM app.selection_candidate_result r
   WHERE r.selection_run_id=s.selection_run_id;

  INSERT INTO app.sales_snapshot_parameter_r3(
    snapshot_id,candidate_row_id,candidate_id,parameter_key,
    catalog_parameter_revision_id,value_type,value_json,unit,source_revision_id,
    product_id,product_revision_id,specification_revision_id,stable_key
  )
  SELECT s.id,cr.id,cr.candidate_id,p.parameter_key,
         p.catalog_parameter_revision_id,p.value_type,p.value_json,p.unit,p.source_revision_id,
         cr.product_id,cr.product_revision_id,cr.specification_revision_id,
         app_private.stable_key_r3(3,jsonb_build_array(
           jsonb_build_object('name','candidateId','kind','ASCII_ID','value',cr.candidate_id),
           jsonb_build_object('name','parameterKey','kind','ASCII_KEY','value',p.parameter_key)
         ))
    FROM app.selection_candidate_parameter p
    JOIN app.selection_candidate_result cr ON cr.candidate_id=p.candidate_id
   WHERE cr.selection_run_id=s.selection_run_id;

  INSERT INTO app.sales_snapshot_price_r3(
    snapshot_id,candidate_row_id,candidate_id,price_revision_id,product_id,
    product_revision_id,specification_revision_id,source_revision_id,
    amount_minor,currency,price_basis,tax_basis,applicability,
    valid_from,valid_until,quoted_at,stable_key
  )
  SELECT s.id,cr.id,cr.candidate_id,pr.id,pr.product_id,
         pr.product_revision_id,pr.specification_revision_id,pr.source_revision_id,
         pr.amount_minor,pr.currency,pr.price_basis,pr.tax_basis,pr.applicability,
         pr.valid_from,pr.valid_until,pr.quoted_at,
         app_private.stable_key_r3(4,jsonb_build_array(
           jsonb_build_object('name','candidateId','kind','ASCII_ID','value',cr.candidate_id),
           jsonb_build_object('name','priceRevisionId','kind','ASCII_ID','value',pr.id)
         ))
    FROM app.selection_candidate_price cp
    JOIN app.selection_candidate_result cr ON cr.candidate_id=cp.candidate_id
    JOIN app.price_revision pr ON pr.id=cp.price_revision_id
   WHERE cr.selection_run_id=s.selection_run_id;

  INSERT INTO app.sales_snapshot_source_r3(
    snapshot_id,selection_run_id,source_revision_id,evidence_object_id,raw_content_digest,
    source_kind,source_entity_type,source_entity_id,
    source_aux_is_null,source_aux_text,captured_at,stable_key
  )
  SELECT s.id,s.selection_run_id,r.source_revision_id,r.evidence_object_id,r.raw_content_digest,
         r.source_kind,r.source_entity_type,r.source_entity_id,
         r.source_aux_is_null,r.source_aux_text,r.captured_at,
         app_private.stable_key_r3(5,jsonb_build_array(
           jsonb_build_object('name','sourceRevisionId','kind','ASCII_ID','value',r.source_revision_id)
         ))
    FROM app.selection_source_result r
   WHERE r.selection_run_id=s.selection_run_id;

  INSERT INTO app.sales_snapshot_catalog_review_r3(
    snapshot_id,selection_run_id,catalog_review_id,target_revision_id,source_revision_id,
    policy_revision_id,decision,reviewed_at,stable_key
  )
  SELECT s.id,s.selection_run_id,r.catalog_review_id,r.target_revision_id,r.source_revision_id,
         r.policy_revision_id,r.decision,r.reviewed_at,
         app_private.stable_key_r3(6,jsonb_build_array(
           jsonb_build_object('name','catalogReviewId','kind','ASCII_ID','value',r.catalog_review_id)
         ))
    FROM app.selection_catalog_review_result r
   WHERE r.selection_run_id=s.selection_run_id;

  INSERT INTO app.sales_snapshot_professional_review_r3(
    snapshot_id,selection_run_id,professional_review_event_id,professional_review_id,event_sequence,
    target_revision_id,policy_revision_id,decision,basis_digest,occurred_at,stable_key
  )
  SELECT s.id,s.selection_run_id,r.professional_review_event_id,r.professional_review_id,r.event_sequence,
         r.target_revision_id,r.policy_revision_id,r.decision,r.basis_digest,r.occurred_at,
         app_private.stable_key_r3(7,jsonb_build_array(
           jsonb_build_object('name','professionalReviewId','kind','ASCII_ID','value',r.professional_review_id),
           jsonb_build_object('name','eventSequence','kind','INT64','value',r.event_sequence)
         ))
    FROM app.selection_professional_review_result r
   WHERE r.selection_run_id=s.selection_run_id;

  INSERT INTO app.sales_snapshot_warning_r3(
    snapshot_id,selection_run_id,candidate_row_id,candidate_id,warning_sequence,warning_code,warning_text,
    severity,source_warning_id,stable_key
  )
  SELECT s.id,s.selection_run_id,cr.id,cr.candidate_id,w.warning_sequence,w.warning_code,w.warning_text,w.severity,
         w.source_warning_id,
         app_private.stable_key_r3(8,jsonb_build_array(
           jsonb_build_object('name','candidateId','kind','ASCII_ID','value',cr.candidate_id),
           jsonb_build_object('name','warningSequence','kind','INT64','value',w.warning_sequence)
         ))
    FROM app.selection_warning_result w
    JOIN app.selection_candidate_result cr ON cr.candidate_id=w.candidate_id
   WHERE w.selection_run_id=s.selection_run_id;

  INSERT INTO app.sales_snapshot_missing_field_r3(
    snapshot_id,selection_run_id,candidate_row_id,candidate_id,field_key,reason,impact_scope,stable_key
  )
  SELECT s.id,s.selection_run_id,cr.id,cr.candidate_id,m.field_key,m.reason,m.impact_scope,
         app_private.stable_key_r3(9,jsonb_build_array(
           jsonb_build_object('name','candidateId','kind','ASCII_ID','value',cr.candidate_id),
           jsonb_build_object('name','fieldKey','kind','ASCII_KEY','value',m.field_key)
         ))
    FROM app.selection_missing_field_result m
    JOIN app.selection_candidate_result cr ON cr.candidate_id=m.candidate_id
   WHERE m.selection_run_id=s.selection_run_id;
END
$$;

CREATE FUNCTION app_private.refresh_snapshot_basis_records_r3(p_snapshot_id text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_count integer;
BEGIN
  PERFORM 1 FROM app.sales_handoff_snapshot_r3 s
   WHERE s.id=p_snapshot_id AND s.state='DRAFT'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'basis refresh requires DRAFT snapshot' USING ERRCODE='23514';
  END IF;
  DELETE FROM app.sales_snapshot_basis_record_r3 WHERE snapshot_id=p_snapshot_id;
  INSERT INTO app.sales_snapshot_basis_record_r3(
    snapshot_id,record_type,stable_key,row_id,field_count,fields_json,encoded_record
  )
  SELECT p_snapshot_id,p.record_type,p.stable_key,p.row_id,
         jsonb_array_length(p.fields_json),p.fields_json,
         app_private.r6_record(p.record_type,p.row_id,p.stable_key,p.fields_json)
    FROM app_private.snapshot_record_projection_r3(p_snapshot_id) p;
  SELECT count(*) INTO v_count
    FROM app.sales_snapshot_basis_record_r3
   WHERE snapshot_id=p_snapshot_id;
  IF v_count NOT BETWEEN 1 AND 4096 THEN
    RAISE EXCEPTION 'basis record count' USING ERRCODE='22001';
  END IF;
  RETURN v_count;
END
$$;

CREATE FUNCTION app.snapshot_record_count(p_snapshot_id text)
RETURNS integer
LANGUAGE sql STABLE STRICT SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
RETURN (
  SELECT count(*)::integer FROM app.sales_snapshot_basis_record_r3
   WHERE snapshot_id=p_snapshot_id
);

CREATE FUNCTION app.build_snapshot_basis_r6(p_snapshot_id text)
RETURNS bytea
LANGUAGE plpgsql STABLE STRICT SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_body bytea;
  v_count integer;
  v_fields integer;
BEGIN
  SELECT count(*),COALESCE(sum(field_count),0)
    INTO v_count,v_fields
    FROM app.sales_snapshot_basis_record_r3
   WHERE snapshot_id=p_snapshot_id;
  IF v_count NOT BETWEEN 1 AND 4096 OR v_fields NOT BETWEEN 1 AND 65536 THEN
    RAISE EXCEPTION 'basis resource count' USING ERRCODE='22001';
  END IF;
  SELECT decode(COALESCE(string_agg(encode(encoded_record,'hex'),'' ORDER BY record_type,stable_key,row_id),''),'hex')
    INTO v_body
    FROM app.sales_snapshot_basis_record_r3
   WHERE snapshot_id=p_snapshot_id;
  IF octet_length(v_body) NOT BETWEEN 1 AND 16777216 THEN
    RAISE EXCEPTION 'basis body bytes' USING ERRCODE='22001';
  END IF;
  IF 28 + octet_length(v_body) > 16777244 THEN
    RAISE EXCEPTION 'basis total bytes' USING ERRCODE='22001';
  END IF;
  RETURN decode('5233424153495300','hex')
    || app_private.u16be(6)
    || app_private.u16be(1)
    || app_private.u32be(28)
    || app_private.u32be(v_count)
    || app_private.u64be(octet_length(v_body))
    || v_body;
END
$$;

CREATE FUNCTION app.verify_snapshot_basis_r6(
  p_basis bytea,
  p_snapshot_id text
) RETURNS boolean
LANGUAGE plpgsql STABLE STRICT SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_expected bytea;
  v_expected_count integer;
  v_expected_body_bytes bigint;
  v_expected_fields integer;
BEGIN
  SELECT count(*),COALESCE(sum(jsonb_array_length(fields_json)),0)
    INTO v_expected_count,v_expected_fields
    FROM app_private.snapshot_record_projection_r3(p_snapshot_id);
  IF v_expected_count NOT BETWEEN 1 AND 4096
     OR v_expected_fields NOT BETWEEN 1 AND 65536 THEN
    RETURN false;
  END IF;
  SELECT decode(COALESCE(string_agg(
           encode(app_private.r6_record(
             p.record_type,p.row_id,p.stable_key,p.fields_json
           ),'hex'),'' ORDER BY p.record_type,p.stable_key,p.row_id),''),'hex')
    INTO v_expected
    FROM app_private.snapshot_record_projection_r3(p_snapshot_id) p;
  v_expected_body_bytes := octet_length(v_expected);
  IF v_expected_body_bytes NOT BETWEEN 1 AND 16777216 THEN
    RETURN false;
  END IF;
  v_expected := decode('5233424153495300','hex')
    || app_private.u16be(6)
    || app_private.u16be(1)
    || app_private.u32be(28)
    || app_private.u32be(v_expected_count)
    || app_private.u64be(v_expected_body_bytes)
    || v_expected;
  RETURN p_basis = v_expected
    AND octet_length(p_basis)=v_expected_body_bytes+28;
END
$$;

CREATE FUNCTION app_private.require_no_active_snapshot_children_r3(p_snapshot_id text)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_expected integer;
  v_actual integer;
BEGIN
  SELECT count(*) INTO v_expected
    FROM app.selection_candidate_result r
    JOIN app.sales_handoff_snapshot_r3 s ON s.selection_run_id=r.selection_run_id
   WHERE s.id=p_snapshot_id;
  SELECT count(*) INTO v_actual
    FROM app.sales_snapshot_candidate_r3 c
   WHERE c.snapshot_id=p_snapshot_id;
  IF v_expected=0 OR v_actual<>v_expected THEN
    RAISE EXCEPTION 'snapshot candidate completeness' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM app.sales_snapshot_parameter_r3 p
     LEFT JOIN app.sales_snapshot_candidate_r3 c
       ON c.snapshot_id=p.snapshot_id AND c.candidate_row_id=p.candidate_row_id
    WHERE p.snapshot_id=p_snapshot_id AND c.candidate_row_id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM app.sales_snapshot_price_r3 p
     LEFT JOIN app.sales_snapshot_candidate_r3 c
       ON c.snapshot_id=p.snapshot_id AND c.candidate_row_id=p.candidate_row_id
    WHERE p.snapshot_id=p_snapshot_id AND c.candidate_row_id IS NULL
  ) THEN
    RAISE EXCEPTION 'orphan snapshot child' USING ERRCODE='23514';
  END IF;
END
$$;

CREATE FUNCTION app_private.validate_snapshot_r3(p_snapshot_id text)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s app.sales_handoff_snapshot_r3%ROWTYPE;
  m app.snapshot_basis_metadata_r3%ROWTYPE;
  v_basis bytea;
BEGIN
  SELECT * INTO STRICT s FROM app.sales_handoff_snapshot_r3 WHERE id=p_snapshot_id;
  IF s.state <> 'FINALIZED' THEN
    RAISE EXCEPTION 'snapshot not finalized' USING ERRCODE='23514';
  END IF;
  SELECT * INTO STRICT m FROM app.snapshot_basis_metadata_r3 WHERE snapshot_id=s.id;
  PERFORM app_private.require_no_active_snapshot_children_r3(s.id);
  IF EXISTS (
    SELECT 1 FROM app.sales_snapshot_requirement_field_r3 r
     WHERE r.snapshot_id=s.id
       AND app.source_key_r3(
         r.source_kind,r.source_entity_type,r.source_entity_id,
         r.source_aux_is_null,r.source_aux_text
       ) IS NULL
  ) THEN
    RAISE EXCEPTION 'source key failure' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM app.sales_snapshot_price_r3 p
     WHERE p.snapshot_id=s.id
       AND (p.valid_from>s.basis_as_of OR (p.valid_until IS NOT NULL AND p.valid_until<s.basis_as_of))
       AND NOT EXISTS (
         SELECT 1 FROM app.sales_snapshot_candidate_r3 c
          WHERE c.snapshot_id=s.id AND c.candidate_row_id=p.candidate_row_id
            AND c.commercial_status IN ('PRICE_EXPIRED','REQUIRES_QUOTE')
       )
  ) THEN
    RAISE EXCEPTION 'price basis as-of failure' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM (
        SELECT w.candidate_row_id,
               row_number() OVER (
                 PARTITION BY w.candidate_row_id
                 ORDER BY w.warning_code,w.warning_text,w.source_warning_id
               ) AS expected_sequence,
               w.warning_sequence
          FROM app.sales_snapshot_warning_r3 w
         WHERE w.snapshot_id=s.id
      ) q
     WHERE q.expected_sequence<>q.warning_sequence
  ) THEN
    RAISE EXCEPTION 'warning ordering failure' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM app.sales_snapshot_candidate_r3 c
     WHERE c.snapshot_id=s.id AND c.rule_set_revision_id<>s.rule_set_revision_id
  ) THEN
    RAISE EXCEPTION 'candidate ruleset mismatch' USING ERRCODE='23514';
  END IF;
  v_basis := app.build_snapshot_basis_r6(s.id);
  IF octet_length(v_basis)<>m.basis_byte_length
     OR app_private.sha256_hex(v_basis)<>m.basis_digest
     OR app.snapshot_record_count(s.id)<>m.record_count
     OR NOT app.verify_snapshot_basis_r6(v_basis,s.id) THEN
    RAISE EXCEPTION 'basis verification failure' USING ERRCODE='23514';
  END IF;
END
$$;

CREATE FUNCTION app.create_snapshot_r3(
  p_snapshot_id text,
  p_selection_run_id text,
  p_expected_case_version bigint
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  run_row app.selection_run%ROWTYPE;
  seal_row app.selection_run_seal%ROWTYPE;
  case_row app.sales_case%ROWTYPE;
  v_basis bytea;
  v_count integer;
  v_fields integer;
  v_body_bytes bigint;
BEGIN
  SELECT * INTO s FROM app_private.lock_active_session(session_user,'SNAPSHOT_CREATE');
  SELECT * INTO STRICT seal_row FROM app.selection_run_seal
   WHERE selection_run_id=p_selection_run_id FOR SHARE;
  SELECT * INTO STRICT run_row FROM app.selection_run
   WHERE id=p_selection_run_id FOR SHARE;
  IF run_row.state<>'SEALED' THEN
    RAISE EXCEPTION 'selection run not sealed' USING ERRCODE='23514';
  END IF;
  SELECT * INTO STRICT case_row FROM app.sales_case
   WHERE id=run_row.case_id FOR UPDATE;
  IF case_row.mutation_version<>p_expected_case_version THEN
    RAISE EXCEPTION 'case version conflict' USING ERRCODE='40001';
  END IF;
  INSERT INTO app.sales_handoff_snapshot_r3(
    id,case_id,project_id,conversation_id,requirement_id,
    requirement_version_id,installation_scenario,selection_run_id,
    rule_set_revision_id,rule_set_content_digest,basis_as_of,
    version_number,mutation_version,state,created_by_principal_id,created_at
  ) VALUES(
    p_snapshot_id,seal_row.case_id,seal_row.project_id,seal_row.conversation_id,
    seal_row.requirement_id,seal_row.requirement_version_id,
    seal_row.installation_scenario,seal_row.selection_run_id,
    seal_row.rule_set_revision_id,seal_row.rule_set_content_digest,clock_timestamp(),
    p_expected_case_version+1,1,'DRAFT',s.principal_id,clock_timestamp()
  );
  PERFORM app_private.materialize_snapshot_r3(p_snapshot_id);
  v_count := app_private.refresh_snapshot_basis_records_r3(p_snapshot_id);
  SELECT COALESCE(sum(field_count),0) INTO v_fields
    FROM app.sales_snapshot_basis_record_r3 WHERE snapshot_id=p_snapshot_id;
  v_basis := app.build_snapshot_basis_r6(p_snapshot_id);
  v_body_bytes := octet_length(v_basis)-28;
  INSERT INTO app.snapshot_basis_metadata_r3(
    snapshot_id,registry_revision,protocol_revision,stable_key_encoding,
    record_count,field_count,body_byte_length,basis_byte_length,basis_digest
  ) VALUES(
    p_snapshot_id,'SNAPSHOT-R3','R3-BASIS-1-R6','SK-R2',
    v_count,v_fields,v_body_bytes,octet_length(v_basis),app_private.sha256_hex(v_basis)
  );
  UPDATE app.sales_handoff_snapshot_r3
     SET state='FINALIZED',finalized_at=clock_timestamp(),
         mutation_version=mutation_version+1
   WHERE id=p_snapshot_id AND state='DRAFT' AND mutation_version=1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'snapshot finalization CAS failed' USING ERRCODE='40001';
  END IF;
  PERFORM app_private.validate_snapshot_r3(p_snapshot_id);
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
  RETURN 2;
END
$$;

CREATE FUNCTION app.finalize_snapshot_r3(
  p_snapshot_id text,
  p_expected_mutation_version bigint
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  v_count integer;
  v_fields integer;
  v_basis bytea;
  v_body_bytes bigint;
  v_next bigint;
BEGIN
  SELECT * INTO s FROM app_private.lock_active_session(session_user,'SNAPSHOT_CREATE');
  PERFORM 1 FROM app.sales_handoff_snapshot_r3 sn
   WHERE sn.id=p_snapshot_id AND sn.state='DRAFT'
     AND sn.mutation_version=p_expected_mutation_version
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'snapshot finalization CAS failed' USING ERRCODE='40001';
  END IF;
  v_count := app_private.refresh_snapshot_basis_records_r3(p_snapshot_id);
  SELECT COALESCE(sum(field_count),0) INTO v_fields
    FROM app.sales_snapshot_basis_record_r3 WHERE snapshot_id=p_snapshot_id;
  v_basis := app.build_snapshot_basis_r6(p_snapshot_id);
  v_body_bytes := octet_length(v_basis)-28;
  INSERT INTO app.snapshot_basis_metadata_r3 AS m(
    snapshot_id,registry_revision,protocol_revision,stable_key_encoding,
    record_count,field_count,body_byte_length,basis_byte_length,basis_digest
  ) VALUES(
    p_snapshot_id,'SNAPSHOT-R3','R3-BASIS-1-R6','SK-R2',
    v_count,v_fields,v_body_bytes,octet_length(v_basis),app_private.sha256_hex(v_basis)
  )
  ON CONFLICT (snapshot_id) DO UPDATE
    SET record_count=EXCLUDED.record_count,
        field_count=EXCLUDED.field_count,
        body_byte_length=EXCLUDED.body_byte_length,
        basis_byte_length=EXCLUDED.basis_byte_length,
        basis_digest=EXCLUDED.basis_digest;
  UPDATE app.sales_handoff_snapshot_r3
     SET state='FINALIZED',finalized_at=clock_timestamp(),
         mutation_version=mutation_version+1
   WHERE id=p_snapshot_id AND state='DRAFT'
     AND mutation_version=p_expected_mutation_version
   RETURNING mutation_version INTO v_next;
  IF v_next IS NULL THEN
    RAISE EXCEPTION 'snapshot finalization CAS failed' USING ERRCODE='40001';
  END IF;
  PERFORM app_private.validate_snapshot_r3(p_snapshot_id);
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
  RETURN v_next;
END
$$;

CREATE FUNCTION app_private.guard_snapshot_header_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'snapshot delete denied' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND OLD.state='FINALIZED' THEN
    RAISE EXCEPTION 'finalized snapshot immutable' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' THEN
    IF (
      NEW.id,NEW.case_id,NEW.project_id,NEW.conversation_id,
      NEW.requirement_id,NEW.requirement_version_id,NEW.installation_scenario,
      NEW.selection_run_id,NEW.rule_set_revision_id,NEW.rule_set_content_digest,
      NEW.basis_as_of,NEW.version_number
    ) IS DISTINCT FROM (
      OLD.id,OLD.case_id,OLD.project_id,OLD.conversation_id,
      OLD.requirement_id,OLD.requirement_version_id,OLD.installation_scenario,
      OLD.selection_run_id,OLD.rule_set_revision_id,OLD.rule_set_content_digest,
      OLD.basis_as_of,OLD.version_number
    ) THEN
      RAISE EXCEPTION 'snapshot identity immutable' USING ERRCODE='23514';
    END IF;
    IF OLD.state='DRAFT' AND NEW.state='FINALIZED' THEN
      NEW.finalized_at := COALESCE(NEW.finalized_at,clock_timestamp());
      NEW.mutation_version := OLD.mutation_version+1;
    ELSIF NEW.state IS DISTINCT FROM OLD.state THEN
      RAISE EXCEPTION 'illegal snapshot transition' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

CREATE FUNCTION app_private.guard_snapshot_child_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_snapshot_id text;
  v_state text;
BEGIN
  v_snapshot_id := COALESCE(to_jsonb(NEW)->>'snapshot_id',to_jsonb(OLD)->>'snapshot_id');
  IF v_snapshot_id IS NULL THEN
    RAISE EXCEPTION 'snapshot child id missing' USING ERRCODE='23514';
  END IF;
  SELECT s.state INTO v_state
    FROM app.sales_handoff_snapshot_r3 s
   WHERE s.id=v_snapshot_id
   FOR UPDATE;
  IF v_state IS NULL THEN
    RAISE EXCEPTION 'snapshot parent missing' USING ERRCODE='23503';
  END IF;
  IF v_state='FINALIZED' THEN
    RAISE EXCEPTION 'finalized snapshot child immutable' USING ERRCODE='23514';
  END IF;
  RETURN COALESCE(NEW,OLD);
END
$$;

CREATE FUNCTION app_private.deny_snapshot_truncate_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  RAISE EXCEPTION 'snapshot truncate denied' USING ERRCODE='42501';
END
$$;

CREATE FUNCTION app_private.dispatch_snapshot_validation_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_snapshot_id text;
  v_state text;
BEGIN
  v_snapshot_id := COALESCE(
    to_jsonb(NEW)->>'snapshot_id',
    to_jsonb(OLD)->>'snapshot_id',
    CASE WHEN TG_TABLE_NAME='sales_handoff_snapshot_r3'
         THEN COALESCE(to_jsonb(NEW)->>'id',to_jsonb(OLD)->>'id') END
  );
  IF v_snapshot_id IS NULL THEN
    RETURN COALESCE(NEW,OLD);
  END IF;
  SELECT s.state INTO v_state
    FROM app.sales_handoff_snapshot_r3 s
   WHERE s.id=v_snapshot_id;
  IF v_state='FINALIZED' THEN
    PERFORM app_private.validate_snapshot_r3(v_snapshot_id);
  END IF;
  RETURN COALESCE(NEW,OLD);
END
$$;

CREATE FUNCTION app_private.guard_policy_revision_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    RAISE EXCEPTION 'policy revision immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.content_digest <> app.policy_digest(convert_from(NEW.canonical_content,'UTF8')) THEN
    RAISE EXCEPTION 'policy digest mismatch' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE FUNCTION app_private.guard_append_only_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    RAISE EXCEPTION 'append-only relation' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE FUNCTION app_private.deny_truncate_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  RAISE EXCEPTION 'truncate denied' USING ERRCODE='42501';
END
$$;

CREATE FUNCTION app_private.guard_selection_run_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  IF TG_OP='DELETE' OR (TG_OP='UPDATE' AND OLD.state='SEALED') THEN
    RAISE EXCEPTION 'sealed selection run immutable' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE'
     AND (NEW.id,NEW.case_id,NEW.project_id,NEW.conversation_id,
          NEW.requirement_id,NEW.requirement_version_id,
          NEW.installation_scenario,NEW.rule_set_revision_id,
          NEW.rule_set_content_digest)
         IS DISTINCT FROM
         (OLD.id,OLD.case_id,OLD.project_id,OLD.conversation_id,
          OLD.requirement_id,OLD.requirement_version_id,
          OLD.installation_scenario,OLD.rule_set_revision_id,
          OLD.rule_set_content_digest) THEN
    RAISE EXCEPTION 'selection run identity immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE FUNCTION app_private.guard_sealed_result_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_run_id text;
  v_state text;
BEGIN
  v_run_id := COALESCE(to_jsonb(NEW)->>'selection_run_id',to_jsonb(OLD)->>'selection_run_id');
  IF v_run_id IS NULL AND TG_TABLE_NAME='selection_run_seal' THEN
    v_run_id := COALESCE(to_jsonb(NEW)->>'selection_run_id',to_jsonb(OLD)->>'selection_run_id');
  END IF;
  SELECT r.state INTO v_state FROM app.selection_run r WHERE r.id=v_run_id;
  IF TG_TABLE_NAME='selection_run_seal' AND TG_OP IN ('UPDATE','DELETE') THEN
    RAISE EXCEPTION 'selection seal immutable' USING ERRCODE='23514';
  END IF;
  IF TG_TABLE_NAME='selection_run_seal' AND TG_OP='INSERT' AND v_state<>'SEALED' THEN
    RAISE EXCEPTION 'seal row requires sealed run' USING ERRCODE='23514';
  END IF;
  IF v_state='SEALED' AND TG_OP IN ('INSERT','UPDATE','DELETE') THEN
    IF TG_TABLE_NAME<>'selection_run_seal' THEN
      RAISE EXCEPTION 'sealed selection result immutable' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN COALESCE(NEW,OLD);
END
$$;

CREATE TRIGGER guard_snapshot_header_r3
BEFORE UPDATE OR DELETE ON app.sales_handoff_snapshot_r3
FOR EACH ROW EXECUTE FUNCTION app_private.guard_snapshot_header_r3();

CREATE TRIGGER deny_snapshot_header_truncate_r3
BEFORE TRUNCATE ON app.sales_handoff_snapshot_r3
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_snapshot_truncate_r3();

CREATE TRIGGER guard_snapshot_requirement_field_r3
BEFORE INSERT OR UPDATE OR DELETE ON app.sales_snapshot_requirement_field_r3
FOR EACH ROW EXECUTE FUNCTION app_private.guard_snapshot_child_r3();
CREATE TRIGGER guard_snapshot_candidate_r3
BEFORE INSERT OR UPDATE OR DELETE ON app.sales_snapshot_candidate_r3
FOR EACH ROW EXECUTE FUNCTION app_private.guard_snapshot_child_r3();
CREATE TRIGGER guard_snapshot_parameter_r3
BEFORE INSERT OR UPDATE OR DELETE ON app.sales_snapshot_parameter_r3
FOR EACH ROW EXECUTE FUNCTION app_private.guard_snapshot_child_r3();
CREATE TRIGGER guard_snapshot_price_r3
BEFORE INSERT OR UPDATE OR DELETE ON app.sales_snapshot_price_r3
FOR EACH ROW EXECUTE FUNCTION app_private.guard_snapshot_child_r3();
CREATE TRIGGER guard_snapshot_source_r3
BEFORE INSERT OR UPDATE OR DELETE ON app.sales_snapshot_source_r3
FOR EACH ROW EXECUTE FUNCTION app_private.guard_snapshot_child_r3();
CREATE TRIGGER guard_snapshot_catalog_review_r3
BEFORE INSERT OR UPDATE OR DELETE ON app.sales_snapshot_catalog_review_r3
FOR EACH ROW EXECUTE FUNCTION app_private.guard_snapshot_child_r3();
CREATE TRIGGER guard_snapshot_professional_review_r3
BEFORE INSERT OR UPDATE OR DELETE ON app.sales_snapshot_professional_review_r3
FOR EACH ROW EXECUTE FUNCTION app_private.guard_snapshot_child_r3();
CREATE TRIGGER guard_snapshot_warning_r3
BEFORE INSERT OR UPDATE OR DELETE ON app.sales_snapshot_warning_r3
FOR EACH ROW EXECUTE FUNCTION app_private.guard_snapshot_child_r3();
CREATE TRIGGER guard_snapshot_missing_field_r3
BEFORE INSERT OR UPDATE OR DELETE ON app.sales_snapshot_missing_field_r3
FOR EACH ROW EXECUTE FUNCTION app_private.guard_snapshot_child_r3();
CREATE TRIGGER guard_snapshot_basis_record_r3
BEFORE INSERT OR UPDATE OR DELETE ON app.sales_snapshot_basis_record_r3
FOR EACH ROW EXECUTE FUNCTION app_private.guard_snapshot_child_r3();
CREATE TRIGGER guard_snapshot_basis_metadata_r3
BEFORE INSERT OR UPDATE OR DELETE ON app.snapshot_basis_metadata_r3
FOR EACH ROW EXECUTE FUNCTION app_private.guard_snapshot_child_r3();

CREATE TRIGGER deny_snapshot_requirement_field_truncate_r3
BEFORE TRUNCATE ON app.sales_snapshot_requirement_field_r3
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_snapshot_truncate_r3();
CREATE TRIGGER deny_snapshot_candidate_truncate_r3
BEFORE TRUNCATE ON app.sales_snapshot_candidate_r3
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_snapshot_truncate_r3();
CREATE TRIGGER deny_snapshot_parameter_truncate_r3
BEFORE TRUNCATE ON app.sales_snapshot_parameter_r3
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_snapshot_truncate_r3();
CREATE TRIGGER deny_snapshot_price_truncate_r3
BEFORE TRUNCATE ON app.sales_snapshot_price_r3
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_snapshot_truncate_r3();
CREATE TRIGGER deny_snapshot_source_truncate_r3
BEFORE TRUNCATE ON app.sales_snapshot_source_r3
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_snapshot_truncate_r3();
CREATE TRIGGER deny_snapshot_catalog_review_truncate_r3
BEFORE TRUNCATE ON app.sales_snapshot_catalog_review_r3
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_snapshot_truncate_r3();
CREATE TRIGGER deny_snapshot_professional_review_truncate_r3
BEFORE TRUNCATE ON app.sales_snapshot_professional_review_r3
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_snapshot_truncate_r3();
CREATE TRIGGER deny_snapshot_warning_truncate_r3
BEFORE TRUNCATE ON app.sales_snapshot_warning_r3
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_snapshot_truncate_r3();
CREATE TRIGGER deny_snapshot_missing_field_truncate_r3
BEFORE TRUNCATE ON app.sales_snapshot_missing_field_r3
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_snapshot_truncate_r3();
CREATE TRIGGER deny_snapshot_basis_record_truncate_r3
BEFORE TRUNCATE ON app.sales_snapshot_basis_record_r3
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_snapshot_truncate_r3();
CREATE TRIGGER deny_snapshot_basis_metadata_truncate_r3
BEFORE TRUNCATE ON app.snapshot_basis_metadata_r3
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_snapshot_truncate_r3();

CREATE CONSTRAINT TRIGGER validate_snapshot_header_r3
AFTER INSERT OR UPDATE OR DELETE ON app.sales_handoff_snapshot_r3
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION app_private.dispatch_snapshot_validation_r3();
CREATE CONSTRAINT TRIGGER validate_snapshot_requirement_field_r3
AFTER INSERT OR UPDATE OR DELETE ON app.sales_snapshot_requirement_field_r3
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION app_private.dispatch_snapshot_validation_r3();
CREATE CONSTRAINT TRIGGER validate_snapshot_candidate_r3
AFTER INSERT OR UPDATE OR DELETE ON app.sales_snapshot_candidate_r3
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION app_private.dispatch_snapshot_validation_r3();
CREATE CONSTRAINT TRIGGER validate_snapshot_parameter_r3
AFTER INSERT OR UPDATE OR DELETE ON app.sales_snapshot_parameter_r3
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION app_private.dispatch_snapshot_validation_r3();
CREATE CONSTRAINT TRIGGER validate_snapshot_price_r3
AFTER INSERT OR UPDATE OR DELETE ON app.sales_snapshot_price_r3
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION app_private.dispatch_snapshot_validation_r3();
CREATE CONSTRAINT TRIGGER validate_snapshot_source_r3
AFTER INSERT OR UPDATE OR DELETE ON app.sales_snapshot_source_r3
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION app_private.dispatch_snapshot_validation_r3();
CREATE CONSTRAINT TRIGGER validate_snapshot_catalog_review_r3
AFTER INSERT OR UPDATE OR DELETE ON app.sales_snapshot_catalog_review_r3
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION app_private.dispatch_snapshot_validation_r3();
CREATE CONSTRAINT TRIGGER validate_snapshot_professional_review_r3
AFTER INSERT OR UPDATE OR DELETE ON app.sales_snapshot_professional_review_r3
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION app_private.dispatch_snapshot_validation_r3();
CREATE CONSTRAINT TRIGGER validate_snapshot_warning_r3
AFTER INSERT OR UPDATE OR DELETE ON app.sales_snapshot_warning_r3
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION app_private.dispatch_snapshot_validation_r3();
CREATE CONSTRAINT TRIGGER validate_snapshot_missing_field_r3
AFTER INSERT OR UPDATE OR DELETE ON app.sales_snapshot_missing_field_r3
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION app_private.dispatch_snapshot_validation_r3();
CREATE CONSTRAINT TRIGGER validate_snapshot_basis_record_r3
AFTER INSERT OR UPDATE OR DELETE ON app.sales_snapshot_basis_record_r3
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION app_private.dispatch_snapshot_validation_r3();
CREATE CONSTRAINT TRIGGER validate_snapshot_basis_metadata_r3
AFTER INSERT OR UPDATE OR DELETE ON app.snapshot_basis_metadata_r3
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION app_private.dispatch_snapshot_validation_r3();

CREATE TRIGGER guard_policy_revision_r3
BEFORE INSERT OR UPDATE OR DELETE ON app.policy_revision
FOR EACH ROW EXECUTE FUNCTION app_private.guard_policy_revision_r3();
CREATE TRIGGER deny_policy_revision_truncate_r3
BEFORE TRUNCATE ON app.policy_revision
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER guard_policy_review_event_r3
BEFORE UPDATE OR DELETE ON app.policy_review_event
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER deny_policy_review_event_truncate_r3
BEFORE TRUNCATE ON app.policy_review_event
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER guard_professional_review_event_r3
BEFORE UPDATE OR DELETE ON app.professional_review_event
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER deny_professional_review_event_truncate_r3
BEFORE TRUNCATE ON app.professional_review_event
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER guard_review_audit_r3
BEFORE UPDATE OR DELETE ON app.review_audit
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER deny_review_audit_truncate_r3
BEFORE TRUNCATE ON app.review_audit
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER guard_session_audit_r3
BEFORE UPDATE OR DELETE ON app.session_audit
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER deny_session_audit_truncate_r3
BEFORE TRUNCATE ON app.session_audit
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();

CREATE TRIGGER guard_selection_run_r3
BEFORE UPDATE OR DELETE ON app.selection_run
FOR EACH ROW EXECUTE FUNCTION app_private.guard_selection_run_r3();
CREATE TRIGGER deny_selection_run_truncate_r3
BEFORE TRUNCATE ON app.selection_run
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER guard_selection_candidate_r3
BEFORE INSERT OR UPDATE OR DELETE ON app.selection_candidate
FOR EACH ROW EXECUTE FUNCTION app_private.guard_sealed_result_r3();
CREATE TRIGGER guard_selection_candidate_price_r3
BEFORE INSERT OR UPDATE OR DELETE ON app.selection_candidate_price
FOR EACH ROW EXECUTE FUNCTION app_private.guard_sealed_result_r3();
CREATE TRIGGER guard_selection_candidate_parameter_r3
BEFORE INSERT OR UPDATE OR DELETE ON app.selection_candidate_parameter
FOR EACH ROW EXECUTE FUNCTION app_private.guard_sealed_result_r3();
CREATE TRIGGER guard_selection_candidate_result_r3
BEFORE INSERT OR UPDATE OR DELETE ON app.selection_candidate_result
FOR EACH ROW EXECUTE FUNCTION app_private.guard_sealed_result_r3();
CREATE TRIGGER guard_selection_run_seal_r3
BEFORE INSERT OR UPDATE OR DELETE ON app.selection_run_seal
FOR EACH ROW EXECUTE FUNCTION app_private.guard_sealed_result_r3();

CREATE VIEW app.current_policy_revision_v
WITH (security_barrier=true,security_invoker=false) AS
SELECT pr.id AS policy_revision_id,
       pr.policy_id,
       pr.policy_kind,
       pr.scope_project_id,
       pr.revision_number,
       pr.content_digest,
       pc.state,
       pc.generation,
       pe.id AS effective_event_id,
       pe.event_sequence,
       pe.occurred_at
  FROM app.policy_current pc
  JOIN app.policy_revision pr ON pr.id=pc.revision_id
  JOIN app.policy_review_event pe ON pe.id=pc.effective_event_id
 WHERE pc.state='APPROVED'
   AND pe.policy_revision_id=pr.id
   AND pe.next_state='APPROVED'
   AND NOT EXISTS (
     SELECT 1 FROM app.policy_review_event later
      WHERE later.policy_revision_id=pr.id
        AND later.event_sequence>pe.event_sequence
   )
   AND EXISTS (
     SELECT 1
       FROM app.trusted_session ts
       JOIN app.principal_epoch ep ON ep.principal_id=ts.principal_id
       JOIN app.authority_grant g ON g.principal_id=ts.principal_id
      WHERE ts.db_auth_role=session_user
        AND ts.state='ACTIVE'
        AND ts.revoked_at IS NULL
        AND ts.login_epoch=ep.current_epoch
        AND clock_timestamp()>=ts.not_before
        AND clock_timestamp()<ts.expires_at
        AND (g.project_id IS NULL OR g.project_id=pr.scope_project_id)
        AND g.authority_code='POLICY_READ'
        AND g.revoked_at IS NULL
        AND clock_timestamp()>=g.valid_from
        AND (g.valid_until IS NULL OR clock_timestamp()<g.valid_until)
   );

CREATE VIEW app.audit_policy_events_v
WITH (security_barrier=true,security_invoker=false) AS
SELECT e.policy_id,e.policy_revision_id,e.event_sequence,e.state_version,
       e.previous_state,e.command,e.next_state,
       e.actor_principal_id,e.actor_authority_grant_id,
       e.request_id,e.request_hash,e.evidence_reference,e.occurred_at
  FROM app.policy_review_event e
  JOIN app.policy_revision p ON p.id=e.policy_revision_id
 WHERE EXISTS (
   SELECT 1
     FROM app.trusted_session ts
     JOIN app.principal_epoch ep ON ep.principal_id=ts.principal_id
     JOIN app.authority_grant g ON g.principal_id=ts.principal_id
    WHERE ts.db_auth_role=session_user
      AND ts.state='ACTIVE'
      AND ts.revoked_at IS NULL
      AND ts.login_epoch=ep.current_epoch
      AND clock_timestamp()<ts.expires_at
      AND (g.project_id IS NULL OR g.project_id=p.scope_project_id)
      AND g.authority_code='POLICY_AUDIT'
      AND g.revoked_at IS NULL
      AND (g.valid_until IS NULL OR clock_timestamp()<g.valid_until)
 );

CREATE VIEW app.current_sales_snapshot_v
WITH (security_barrier=true,security_invoker=false) AS
SELECT s.id AS snapshot_id,s.case_id,s.project_id,s.conversation_id,
       s.requirement_id,s.requirement_version_id,s.installation_scenario,
       s.selection_run_id,s.rule_set_revision_id,s.rule_set_content_digest,
       s.basis_as_of,s.version_number,s.mutation_version,s.state,
       s.created_at,s.finalized_at,m.basis_digest,m.record_count,basis_byte_length
  FROM app.sales_handoff_snapshot_r3 s
  JOIN app.snapshot_basis_metadata_r3 m ON m.snapshot_id=s.id
 WHERE s.state='FINALIZED'
   AND EXISTS (
     SELECT 1
       FROM app.trusted_session ts
       JOIN app.principal_epoch ep ON ep.principal_id=ts.principal_id
       JOIN app.authority_grant g ON g.principal_id=ts.principal_id
      WHERE ts.db_auth_role=session_user
        AND ts.state='ACTIVE'
        AND ts.revoked_at IS NULL
        AND ts.login_epoch=ep.current_epoch
        AND clock_timestamp()<ts.expires_at
        AND (g.project_id IS NULL OR g.project_id=s.project_id)
        AND g.authority_code='SNAPSHOT_READ'
        AND g.revoked_at IS NULL
        AND (g.valid_until IS NULL OR clock_timestamp()<g.valid_until)
   );

CREATE VIEW app.current_professional_review_v
WITH (security_barrier=true,security_invoker=false) AS
SELECT r.id,r.project_id,r.conversation_id,r.requirement_id,
       r.requirement_version_id,r.installation_scenario,r.candidate_id,
       r.policy_id,r.policy_revision_id,r.state,r.state_version,e.event_sequence,
       e.command,e.occurred_at
  FROM app.professional_review r
  JOIN LATERAL (
    SELECT x.* FROM app.professional_review_event x
     WHERE x.review_id=r.id ORDER BY x.event_sequence DESC LIMIT 1
  ) e ON true
 WHERE EXISTS (
   SELECT 1
     FROM app.trusted_session ts
     JOIN app.principal_epoch ep ON ep.principal_id=ts.principal_id
     JOIN app.authority_grant g ON g.principal_id=ts.principal_id
    WHERE ts.db_auth_role=session_user
      AND ts.state='ACTIVE'
      AND ts.revoked_at IS NULL
      AND ts.login_epoch=ep.current_epoch
      AND clock_timestamp()<ts.expires_at
      AND (g.project_id IS NULL OR g.project_id=r.project_id)
      AND g.authority_code='REVIEW_READ'
      AND g.revoked_at IS NULL
      AND (g.valid_until IS NULL OR clock_timestamp()<g.valid_until)
 );

CREATE VIEW app.audit_professional_review_events_v
WITH (security_barrier=true,security_invoker=false) AS
SELECT e.id,e.review_id,e.project_id,e.event_sequence,e.state_version,
       e.previous_state,e.command,e.next_state,e.actor_principal_id,
       e.actor_authority_grant_id,e.request_id,e.request_hash,e.basis_digest,
       e.occurred_at
  FROM app.professional_review_event e
 WHERE EXISTS (
   SELECT 1
     FROM app.trusted_session ts
     JOIN app.principal_epoch ep ON ep.principal_id=ts.principal_id
     JOIN app.authority_grant g ON g.principal_id=ts.principal_id
    WHERE ts.db_auth_role=session_user
      AND ts.state='ACTIVE'
      AND ts.revoked_at IS NULL
      AND ts.login_epoch=ep.current_epoch
      AND clock_timestamp()<ts.expires_at
      AND (g.project_id IS NULL OR g.project_id=e.project_id)
      AND g.authority_code='REVIEW_AUDIT'
      AND g.revoked_at IS NULL
      AND (g.valid_until IS NULL OR clock_timestamp()<g.valid_until)
 );

CREATE VIEW app.trusted_session_status_v
WITH (security_barrier=true,security_invoker=false) AS
SELECT ts.session_id,ts.principal_id,ts.login_epoch,ts.audience,ts.issuer,
       ts.issued_at,ts.not_before,ts.expires_at,ts.revoked_at,
       ts.revocation_reason,ts.state
  FROM app.trusted_session ts
 WHERE EXISTS (
   SELECT 1 FROM app.authority_grant g
    WHERE g.principal_id=ts.principal_id
      AND g.authority_code='SESSION_AUDIT'
      AND g.revoked_at IS NULL
      AND clock_timestamp()>=g.valid_from
      AND (g.valid_until IS NULL OR clock_timestamp()<g.valid_until)
 );

CREATE VIEW app.authority_grant_v
WITH (security_barrier=true,security_invoker=false) AS
SELECT g.id,g.principal_id,g.authority_code,g.project_id,g.policy_id,
       g.policy_revision_id,g.valid_from,g.valid_until,g.revoked_at
  FROM app.authority_grant g
 WHERE EXISTS (
   SELECT 1
     FROM app.trusted_session ts
     JOIN app.principal_epoch ep ON ep.principal_id=ts.principal_id
     JOIN app.authority_grant reader ON reader.principal_id=ts.principal_id
    WHERE ts.db_auth_role=session_user
      AND ts.state='ACTIVE'
      AND ts.revoked_at IS NULL
      AND ts.login_epoch=ep.current_epoch
      AND clock_timestamp()<ts.expires_at
      AND reader.authority_code='AUTHORITY_AUDIT'
      AND reader.revoked_at IS NULL
 );

CREATE VIEW app.selection_result_read_v
WITH (security_barrier=true,security_invoker=false) AS
SELECT r.id,r.candidate_id,r.selection_run_id,r.project_id,r.conversation_id,
       r.requirement_id,r.requirement_version_id,r.installation_scenario,
       r.rule_set_revision_id,r.rule_set_content_digest,
       r.product_id,r.product_revision_id,r.product_revision_digest,
       r.specification_revision_id,r.specification_revision_digest,
       r.technical_status,r.commercial_status,r.trust_status,
       r.professional_review_status,r.overall_status
  FROM app.selection_candidate_result r
 WHERE EXISTS (
   SELECT 1
     FROM app.trusted_session ts
     JOIN app.principal_epoch ep ON ep.principal_id=ts.principal_id
     JOIN app.authority_grant g ON g.principal_id=ts.principal_id
    WHERE ts.db_auth_role=session_user
      AND ts.state='ACTIVE'
      AND ts.revoked_at IS NULL
      AND ts.login_epoch=ep.current_epoch
      AND clock_timestamp()<ts.expires_at
      AND (g.project_id IS NULL OR g.project_id=r.project_id)
      AND g.authority_code='SELECTION_READ'
      AND g.revoked_at IS NULL
      AND (g.valid_until IS NULL OR clock_timestamp()<g.valid_until)
 );

CREATE ROLE elevator_database_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE elevator_schema_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE elevator_table_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE elevator_function_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE elevator_review_function_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE elevator_migrator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE elevator_identity_broker LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE elevator_runtime_web LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE elevator_runtime_worker LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE elevator_professional_reviewer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE elevator_policy_author NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE elevator_policy_reviewer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE elevator_security_admin NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE elevator_readonly_auditor LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE elevator_reporting_readonly LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

ALTER DATABASE elevator_advisor OWNER TO elevator_database_owner;
REVOKE ALL ON DATABASE elevator_advisor FROM PUBLIC;
GRANT CONNECT ON DATABASE elevator_advisor TO
  elevator_identity_broker,elevator_runtime_web,elevator_runtime_worker,
  elevator_readonly_auditor,elevator_reporting_readonly;

ALTER SCHEMA app OWNER TO elevator_schema_owner;
ALTER SCHEMA app_private OWNER TO elevator_schema_owner;
REVOKE ALL ON SCHEMA app,app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO
  elevator_runtime_web,elevator_runtime_worker,elevator_professional_reviewer,
  elevator_policy_author,elevator_policy_reviewer,elevator_security_admin,
  elevator_readonly_auditor,elevator_reporting_readonly;
GRANT USAGE ON SCHEMA app_private TO
  elevator_function_owner,elevator_review_function_owner;

ALTER TABLE app.trusted_principal OWNER TO elevator_table_owner;
ALTER TABLE app.principal_epoch OWNER TO elevator_table_owner;
ALTER TABLE app.trusted_session OWNER TO elevator_table_owner;
ALTER TABLE app.session_audit OWNER TO elevator_table_owner;
ALTER TABLE app.project OWNER TO elevator_table_owner;
ALTER TABLE app.conversation OWNER TO elevator_table_owner;
ALTER TABLE app.requirement OWNER TO elevator_table_owner;
ALTER TABLE app.requirement_version OWNER TO elevator_table_owner;
ALTER TABLE app.sales_case OWNER TO elevator_table_owner;
ALTER TABLE app.rule_set_revision OWNER TO elevator_table_owner;
ALTER TABLE app.product_revision OWNER TO elevator_table_owner;
ALTER TABLE app.specification_revision OWNER TO elevator_table_owner;
ALTER TABLE app.price_revision OWNER TO elevator_table_owner;
ALTER TABLE app.catalog_parameter_revision OWNER TO elevator_table_owner;
ALTER TABLE app.catalog_source_revision OWNER TO elevator_table_owner;
ALTER TABLE app.selection_run OWNER TO elevator_table_owner;
ALTER TABLE app.selection_candidate OWNER TO elevator_table_owner;
ALTER TABLE app.selection_candidate_price OWNER TO elevator_table_owner;
ALTER TABLE app.selection_candidate_parameter OWNER TO elevator_table_owner;
ALTER TABLE app.selection_candidate_result OWNER TO elevator_table_owner;
ALTER TABLE app.selection_run_seal OWNER TO elevator_table_owner;
ALTER TABLE app.selection_requirement_field OWNER TO elevator_table_owner;
ALTER TABLE app.selection_source_result OWNER TO elevator_table_owner;
ALTER TABLE app.selection_catalog_review_result OWNER TO elevator_table_owner;
ALTER TABLE app.selection_professional_review_result OWNER TO elevator_table_owner;
ALTER TABLE app.selection_warning_result OWNER TO elevator_table_owner;
ALTER TABLE app.selection_missing_field_result OWNER TO elevator_table_owner;
ALTER TABLE app.sales_handoff_snapshot_r3 OWNER TO elevator_table_owner;
ALTER TABLE app.snapshot_basis_metadata_r3 OWNER TO elevator_table_owner;
ALTER TABLE app.sales_snapshot_requirement_field_r3 OWNER TO elevator_table_owner;
ALTER TABLE app.sales_snapshot_candidate_r3 OWNER TO elevator_table_owner;
ALTER TABLE app.sales_snapshot_parameter_r3 OWNER TO elevator_table_owner;
ALTER TABLE app.sales_snapshot_price_r3 OWNER TO elevator_table_owner;
ALTER TABLE app.sales_snapshot_source_r3 OWNER TO elevator_table_owner;
ALTER TABLE app.sales_snapshot_catalog_review_r3 OWNER TO elevator_table_owner;
ALTER TABLE app.sales_snapshot_professional_review_r3 OWNER TO elevator_table_owner;
ALTER TABLE app.sales_snapshot_warning_r3 OWNER TO elevator_table_owner;
ALTER TABLE app.sales_snapshot_missing_field_r3 OWNER TO elevator_table_owner;
ALTER TABLE app.sales_snapshot_basis_record_r3 OWNER TO elevator_table_owner;
ALTER TABLE app.policy_revision OWNER TO elevator_table_owner;
ALTER TABLE app.policy_review_event OWNER TO elevator_table_owner;
ALTER TABLE app.policy_current OWNER TO elevator_table_owner;
ALTER TABLE app.professional_review OWNER TO elevator_table_owner;
ALTER TABLE app.professional_review_event OWNER TO elevator_table_owner;
ALTER TABLE app.review_audit OWNER TO elevator_table_owner;
ALTER TABLE app.authority_grant OWNER TO elevator_table_owner;

ALTER FUNCTION app_private.u16be(integer) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.u32be(bigint) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.u64be(bigint) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.i64be(bigint) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.sha256_hex(bytea) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.r6_request_hash(jsonb) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.r6_field(integer,integer,integer,bytea) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.source_key_r3(text,text,text,boolean,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.stable_key_r3(smallint,jsonb) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.r6_field_allowed(smallint,integer,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.r6_record(smallint,text,bytea,jsonb) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.lock_active_session(text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.assert_active_session(text,text,bigint) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.open_trusted_session(text,text,bigint,text,text,text,text,text,timestamptz,timestamptz,timestamptz) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.revoke_trusted_session(text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.advance_principal_epoch(text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.revoke_authority_grant(text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.has_project_authority(text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.policy_digest(text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.create_policy_revision(text,text,text,bigint,text,text,text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.transition_policy_review(text,bigint,app.policy_command,text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.policy_is_effective(text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.transition_professional_review(text,bigint,app.professional_review_command,text,text,text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.selection_result_digest(text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.seal_selection_run(text,bigint,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.snapshot_record_projection_r3(text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.materialize_snapshot_r3(text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.refresh_snapshot_basis_records_r3(text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.snapshot_record_count(text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.build_snapshot_basis_r6(text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.verify_snapshot_basis_r6(bytea,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.require_no_active_snapshot_children_r3(text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.validate_snapshot_r3(text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.create_snapshot_r3(text,text,bigint) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.finalize_snapshot_r3(text,bigint) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.guard_snapshot_header_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.guard_snapshot_child_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.deny_snapshot_truncate_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.dispatch_snapshot_validation_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.guard_policy_revision_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.guard_append_only_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.deny_truncate_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.guard_selection_run_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.guard_sealed_result_r3() OWNER TO elevator_review_function_owner;

ALTER VIEW app.current_policy_revision_v OWNER TO elevator_review_function_owner;
ALTER VIEW app.audit_policy_events_v OWNER TO elevator_review_function_owner;
ALTER VIEW app.current_sales_snapshot_v OWNER TO elevator_review_function_owner;
ALTER VIEW app.current_professional_review_v OWNER TO elevator_review_function_owner;
ALTER VIEW app.audit_professional_review_events_v OWNER TO elevator_review_function_owner;
ALTER VIEW app.trusted_session_status_v OWNER TO elevator_review_function_owner;
ALTER VIEW app.authority_grant_v OWNER TO elevator_review_function_owner;
ALTER VIEW app.selection_result_read_v OWNER TO elevator_review_function_owner;

REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM
  elevator_identity_broker,elevator_runtime_web,elevator_runtime_worker,
  elevator_professional_reviewer,elevator_policy_author,elevator_policy_reviewer;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL VIEWS IN SCHEMA app FROM PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE elevator_migrator IN SCHEMA app REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_migrator IN SCHEMA app REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_migrator IN SCHEMA app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_migrator IN SCHEMA app REVOKE USAGE ON TYPES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_schema_owner IN SCHEMA app REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_schema_owner IN SCHEMA app REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_schema_owner IN SCHEMA app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_schema_owner IN SCHEMA app REVOKE USAGE ON TYPES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_table_owner IN SCHEMA app REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_table_owner IN SCHEMA app REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_table_owner IN SCHEMA app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_table_owner IN SCHEMA app REVOKE USAGE ON TYPES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_function_owner IN SCHEMA app REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_function_owner IN SCHEMA app REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_function_owner IN SCHEMA app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_function_owner IN SCHEMA app REVOKE USAGE ON TYPES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_review_function_owner IN SCHEMA app REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_review_function_owner IN SCHEMA app REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_review_function_owner IN SCHEMA app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_review_function_owner IN SCHEMA app REVOKE USAGE ON TYPES FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.open_trusted_session(text,text,bigint,text,text,text,text,text,timestamptz,timestamptz,timestamptz) TO elevator_identity_broker;
GRANT EXECUTE ON FUNCTION app.revoke_trusted_session(text,text) TO elevator_identity_broker;
GRANT EXECUTE ON FUNCTION app.advance_principal_epoch(text,text) TO elevator_identity_broker;
GRANT EXECUTE ON FUNCTION app.revoke_authority_grant(text,text) TO elevator_security_admin;
GRANT EXECUTE ON FUNCTION app.create_policy_revision(text,text,text,bigint,text,text,text,text,text) TO elevator_policy_author;
GRANT EXECUTE ON FUNCTION app.transition_policy_review(text,bigint,app.policy_command,text,text,text) TO elevator_policy_author,elevator_policy_reviewer;
GRANT EXECUTE ON FUNCTION app.transition_professional_review(text,bigint,app.professional_review_command,text,text,text,text,text) TO elevator_professional_reviewer;
GRANT EXECUTE ON FUNCTION app.create_snapshot_r3(text,text,bigint) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.finalize_snapshot_r3(text,bigint) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.seal_selection_run(text,bigint,text) TO elevator_runtime_worker;

GRANT SELECT ON app.current_policy_revision_v,app.current_sales_snapshot_v,
  app.current_professional_review_v,app.selection_result_read_v
  TO elevator_runtime_web,elevator_runtime_worker;
GRANT SELECT ON app.current_policy_revision_v,app.audit_policy_events_v,
  app.current_sales_snapshot_v,app.current_professional_review_v,
  app.audit_professional_review_events_v,app.trusted_session_status_v,
  app.authority_grant_v,app.selection_result_read_v
  TO elevator_readonly_auditor;
GRANT SELECT ON app.current_policy_revision_v,app.current_sales_snapshot_v,
  app.current_professional_review_v,app.selection_result_read_v
  TO elevator_reporting_readonly;
