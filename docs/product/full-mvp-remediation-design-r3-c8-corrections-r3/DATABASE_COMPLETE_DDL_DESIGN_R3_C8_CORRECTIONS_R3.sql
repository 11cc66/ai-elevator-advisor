-- FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS-R3
-- Complete PostgreSQL 18 design DDL draft.
-- Frozen and transformed R3-C8 Corrections R2 DDL plus R3 overlay.
-- DESIGN ONLY. Do not execute.

-- ===== BEGIN TRANSFORMED FROZEN R3-C8 CORRECTIONS R2 DDL =====
-- FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS-R2
-- Complete PostgreSQL 18 design DDL draft.
-- Frozen R3-C8 Corrections complete DDL plus R2 final-state overlay.
-- DESIGN ONLY. Do not execute.

-- ===== BEGIN FROZEN R3-C8 CORRECTIONS COMPLETE DDL =====
-- FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS
-- Complete PostgreSQL 18 design DDL draft.
-- Frozen R3-C8 baseline followed by corrections overlay.
-- DESIGN ONLY. Do not execute this file.

-- ===== BEGIN FROZEN R3-C8 BASELINE =====
-- FULL-MVP-REMEDIATION-DESIGN-R3-C8
-- Complete PostgreSQL 18 design DDL draft.
-- The frozen R3-C7 base is followed by the R3-C8 final-state amendment layer.
-- This file is DOCUMENTATION ONLY and must not be executed in this phase.
-- CREATE OR REPLACE and ALTER are intentionally used; later definitions are final.

-- ===== BEGIN FROZEN R3-C7 BASE =====
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

-- ===== END FROZEN R3-C7 BASE =====

-- ===== BEGIN R3-C8 FINAL-STATE CORRECTIONS =====
-- R3-C8 final-state amendments to the frozen R3-C7 design DDL.
-- Design only. No statement in this file has been executed.

CREATE TABLE app.session_role_registry (
  role_name text PRIMARY KEY,
  role_kind text NOT NULL CHECK (
    role_kind IN (
      'WEB','WORKER','PROFESSIONAL_REVIEWER','POLICY_AUTHOR',
      'POLICY_REVIEWER','SECURITY_ADMIN','AUDITOR','REPORTING'
    )
  ),
  capability_role text NOT NULL,
  activation_token_digest text NOT NULL CHECK (
    activation_token_digest ~ '^[0-9a-f]{64}$'
  ),
  state text NOT NULL CHECK (state IN ('AVAILABLE','ASSIGNED','ACTIVE','RETIRED')),
  session_id text UNIQUE,
  provisioned_at timestamptz(6) NOT NULL,
  assigned_at timestamptz(6),
  retired_at timestamptz(6),
  CHECK (
    (state='AVAILABLE' AND session_id IS NULL AND assigned_at IS NULL AND retired_at IS NULL)
    OR (state IN ('ASSIGNED','ACTIVE') AND session_id IS NOT NULL AND assigned_at IS NOT NULL AND retired_at IS NULL)
    OR (state='RETIRED' AND retired_at IS NOT NULL)
  )
);

CREATE TABLE app.session_binding_audit (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES app.trusted_session(session_id),
  actor_role text NOT NULL,
  backend_pid integer NOT NULL CHECK (backend_pid > 0),
  backend_started_at timestamptz(6) NOT NULL,
  binding_digest text NOT NULL,
  occurred_at timestamptz(6) NOT NULL
);

CREATE TABLE app.command_request (
  operation text NOT NULL,
  request_id text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  scope_key text NOT NULL,
  principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  session_id text NOT NULL REFERENCES app.trusted_session(session_id),
  result_type text NOT NULL,
  result_id text,
  state text NOT NULL CHECK (state IN ('CLAIMED','COMPLETED')),
  claimed_at timestamptz(6) NOT NULL,
  completed_at timestamptz(6),
  PRIMARY KEY (operation,request_id),
  CHECK (
    (state='CLAIMED' AND result_id IS NULL AND completed_at IS NULL)
    OR (state='COMPLETED' AND result_id IS NOT NULL AND completed_at IS NOT NULL)
  )
);

CREATE TABLE app.selection_run_event (
  id text PRIMARY KEY,
  selection_run_id text NOT NULL REFERENCES app.selection_run(id),
  event_sequence bigint NOT NULL CHECK (event_sequence > 0),
  command text NOT NULL CHECK (
    command IN (
      'CREATE','ADD_CANDIDATE','ADD_PRICE','ADD_PARAMETER','ADD_RESULT',
      'ADD_REQUIREMENT_FIELD','ADD_SOURCE','ADD_CATALOG_REVIEW',
      'ADD_PROFESSIONAL_REVIEW','ADD_WARNING','ADD_MISSING_FIELD','SEAL'
    )
  ),
  actor_principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  actor_session_id text NOT NULL REFERENCES app.trusted_session(session_id),
  actor_authority_grant_id text NOT NULL,
  request_id text NOT NULL,
  request_hash text NOT NULL,
  occurred_at timestamptz(6) NOT NULL,
  UNIQUE (selection_run_id,event_sequence),
  UNIQUE (selection_run_id,request_id)
);

ALTER TABLE app.trusted_session
  ADD COLUMN binding_state text NOT NULL DEFAULT 'PROVISIONED'
    CHECK (binding_state IN ('PROVISIONED','ACTIVE','REVOKED','EXPIRED')),
  ADD COLUMN backend_pid integer,
  ADD COLUMN backend_started_at timestamptz(6),
  ADD COLUMN activated_at timestamptz(6),
  ADD COLUMN last_verified_at timestamptz(6),
  ADD COLUMN binding_digest text,
  ADD CONSTRAINT trusted_session_binding_state_check CHECK (
    (binding_state='PROVISIONED' AND backend_pid IS NULL AND backend_started_at IS NULL AND activated_at IS NULL)
    OR (binding_state='ACTIVE' AND backend_pid IS NOT NULL AND backend_started_at IS NOT NULL AND activated_at IS NOT NULL)
    OR (binding_state IN ('REVOKED','EXPIRED'))
  );

ALTER TABLE app.trusted_session
  ADD CONSTRAINT trusted_session_role_registered_fk
  FOREIGN KEY (db_auth_role)
  REFERENCES app.session_role_registry(role_name);

ALTER TABLE app.authority_grant
  ADD COLUMN session_id text NOT NULL,
  ADD COLUMN subject_principal_id text,
  ADD COLUMN object_scope text,
  ADD CONSTRAINT authority_grant_session_fk
    FOREIGN KEY (session_id) REFERENCES app.trusted_session(session_id),
  ADD CONSTRAINT authority_grant_subject_fk
    FOREIGN KEY (subject_principal_id) REFERENCES app.trusted_principal(id),
  ADD CONSTRAINT authority_grant_scope_check CHECK (
    (object_scope='GLOBAL'
      AND project_id IS NULL
      AND policy_id IS NULL
      AND policy_revision_id IS NULL
      AND subject_principal_id IS NULL)
    OR (object_scope='PROJECT'
      AND project_id IS NOT NULL
      AND subject_principal_id IS NULL)
    OR (object_scope='POLICY'
      AND policy_id IS NOT NULL
      AND subject_principal_id IS NULL)
    OR (object_scope='PRINCIPAL'
      AND subject_principal_id IS NOT NULL)
  );
ALTER TABLE app.authority_grant ALTER COLUMN object_scope SET NOT NULL;
ALTER TABLE app.authority_grant
  ADD CONSTRAINT authority_grant_session_grant_unique
  UNIQUE (session_id,id);
ALTER TABLE app.policy_review_event
  ADD CONSTRAINT policy_event_actor_session_grant_fk
  FOREIGN KEY (actor_session_id,actor_authority_grant_id)
  REFERENCES app.authority_grant(session_id,id)
  DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE app.professional_review_event
  ADD CONSTRAINT professional_event_actor_session_grant_fk
  FOREIGN KEY (actor_session_id,actor_authority_grant_id)
  REFERENCES app.authority_grant(session_id,id)
  DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE app.selection_run_event
  ADD CONSTRAINT selection_event_actor_session_grant_fk
  FOREIGN KEY (actor_session_id,actor_authority_grant_id)
  REFERENCES app.authority_grant(session_id,id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE app.selection_requirement_field ADD COLUMN row_digest text;
ALTER TABLE app.selection_source_result ADD COLUMN row_digest text;
ALTER TABLE app.selection_catalog_review_result ADD COLUMN row_digest text;
ALTER TABLE app.selection_professional_review_result ADD COLUMN row_digest text;
ALTER TABLE app.selection_warning_result ADD COLUMN row_digest text;
ALTER TABLE app.selection_missing_field_result ADD COLUMN row_digest text;
ALTER TABLE app.selection_candidate_price ADD COLUMN row_digest text;
ALTER TABLE app.selection_candidate_parameter ADD COLUMN row_digest text;
ALTER TABLE app.selection_candidate_result ADD COLUMN row_digest text;

ALTER TABLE app.sales_snapshot_requirement_field_r3 ADD COLUMN source_row_digest text;
ALTER TABLE app.sales_snapshot_source_r3 ADD COLUMN source_row_digest text;
ALTER TABLE app.sales_snapshot_catalog_review_r3 ADD COLUMN source_row_digest text;
ALTER TABLE app.sales_snapshot_professional_review_r3 ADD COLUMN source_row_digest text;
ALTER TABLE app.sales_snapshot_warning_r3 ADD COLUMN source_row_digest text;
ALTER TABLE app.sales_snapshot_missing_field_r3 ADD COLUMN source_row_digest text;
ALTER TABLE app.sales_snapshot_parameter_r3 ADD COLUMN source_row_digest text;
ALTER TABLE app.sales_snapshot_price_r3 ADD COLUMN source_row_digest text;
ALTER TABLE app.sales_snapshot_candidate_r3 ADD COLUMN result_row_digest text;
ALTER TABLE app.sales_snapshot_candidate_r3
  ADD COLUMN project_id text,
  ADD COLUMN conversation_id text,
  ADD COLUMN requirement_id text,
  ADD COLUMN requirement_version_id text,
  ADD COLUMN installation_scenario text;

-- PostgreSQL requires the referenced column set itself to be backed by an exact
-- PRIMARY KEY or UNIQUE constraint. The supersets in the frozen R3-C7 base do
-- not satisfy that rule for the product/specification/run context FKs.
ALTER TABLE app.product_revision
  ADD CONSTRAINT product_revision_context_unique_r3
  UNIQUE (product_id,id);
ALTER TABLE app.specification_revision
  ADD CONSTRAINT specification_revision_context_unique_r3
  UNIQUE (product_id,product_revision_id,id);
ALTER TABLE app.selection_run
  ADD CONSTRAINT selection_run_context_unique_r3
  UNIQUE (
    id,project_id,conversation_id,requirement_id,
    requirement_version_id,installation_scenario,
    rule_set_revision_id,rule_set_content_digest
  );

ALTER TABLE app.selection_candidate_price
  ADD CONSTRAINT selection_candidate_price_row_digest_unique
  UNIQUE (candidate_id,price_revision_id,row_digest);
ALTER TABLE app.selection_candidate_parameter
  ADD CONSTRAINT selection_candidate_parameter_row_digest_unique
  UNIQUE (candidate_id,parameter_key,row_digest);
ALTER TABLE app.selection_candidate_result
  ADD CONSTRAINT selection_candidate_result_row_digest_unique
  UNIQUE (id,candidate_id,selection_run_id,row_digest);
ALTER TABLE app.selection_requirement_field
  ADD CONSTRAINT selection_requirement_field_row_digest_unique
  UNIQUE (selection_run_id,requirement_version_id,field_key,row_digest);
ALTER TABLE app.selection_source_result
  ADD CONSTRAINT selection_source_result_row_digest_unique
  UNIQUE (selection_run_id,source_revision_id,row_digest);
ALTER TABLE app.selection_catalog_review_result
  ADD CONSTRAINT selection_catalog_review_result_row_digest_unique
  UNIQUE (selection_run_id,catalog_review_id,row_digest);
ALTER TABLE app.selection_professional_review_result
  ADD CONSTRAINT selection_professional_review_result_row_digest_unique
  UNIQUE (selection_run_id,professional_review_id,event_sequence,row_digest);
ALTER TABLE app.selection_warning_result
  ADD CONSTRAINT selection_warning_result_row_digest_unique
  UNIQUE (selection_run_id,candidate_id,warning_sequence,row_digest);
ALTER TABLE app.selection_missing_field_result
  ADD CONSTRAINT selection_missing_field_result_row_digest_unique
  UNIQUE (selection_run_id,candidate_id,field_key,row_digest);

ALTER TABLE app.sales_snapshot_candidate_r3
  ADD CONSTRAINT snapshot_candidate_result_digest_fk
  FOREIGN KEY (
    selection_result_item_id,candidate_id,selection_run_id,result_row_digest
  ) REFERENCES app.selection_candidate_result(
    id,candidate_id,selection_run_id,row_digest
  );
ALTER TABLE app.sales_snapshot_requirement_field_r3
  ADD CONSTRAINT snapshot_requirement_field_source_digest_fk
  FOREIGN KEY (
    selection_run_id,requirement_version_id,field_key,source_row_digest
  ) REFERENCES app.selection_requirement_field(
    selection_run_id,requirement_version_id,field_key,row_digest
  );
ALTER TABLE app.sales_snapshot_source_r3
  ADD CONSTRAINT snapshot_source_source_digest_fk
  FOREIGN KEY (selection_run_id,source_revision_id,source_row_digest)
  REFERENCES app.selection_source_result(selection_run_id,source_revision_id,row_digest);
ALTER TABLE app.sales_snapshot_catalog_review_r3
  ADD CONSTRAINT snapshot_catalog_review_source_digest_fk
  FOREIGN KEY (selection_run_id,catalog_review_id,source_row_digest)
  REFERENCES app.selection_catalog_review_result(selection_run_id,catalog_review_id,row_digest);
ALTER TABLE app.sales_snapshot_professional_review_r3
  ADD CONSTRAINT snapshot_professional_review_source_digest_fk
  FOREIGN KEY (
    selection_run_id,professional_review_id,event_sequence,source_row_digest
  ) REFERENCES app.selection_professional_review_result(
    selection_run_id,professional_review_id,event_sequence,row_digest
  );
ALTER TABLE app.sales_snapshot_warning_r3
  ADD CONSTRAINT snapshot_warning_source_digest_fk
  FOREIGN KEY (
    selection_run_id,candidate_id,warning_sequence,source_row_digest
  ) REFERENCES app.selection_warning_result(
    selection_run_id,candidate_id,warning_sequence,row_digest
  );
ALTER TABLE app.sales_snapshot_missing_field_r3
  ADD CONSTRAINT snapshot_missing_field_source_digest_fk
  FOREIGN KEY (selection_run_id,candidate_id,field_key,source_row_digest)
  REFERENCES app.selection_missing_field_result(
    selection_run_id,candidate_id,field_key,row_digest
  );
ALTER TABLE app.sales_snapshot_parameter_r3
  ADD CONSTRAINT snapshot_parameter_source_digest_fk
  FOREIGN KEY (candidate_id,parameter_key,source_row_digest)
  REFERENCES app.selection_candidate_parameter(candidate_id,parameter_key,row_digest);
ALTER TABLE app.sales_snapshot_price_r3
  ADD CONSTRAINT snapshot_price_source_digest_fk
  FOREIGN KEY (candidate_id,price_revision_id,source_row_digest)
  REFERENCES app.selection_candidate_price(candidate_id,price_revision_id,row_digest);

ALTER TABLE app.selection_candidate_price ALTER COLUMN row_digest SET NOT NULL;
ALTER TABLE app.selection_candidate_parameter ALTER COLUMN row_digest SET NOT NULL;
ALTER TABLE app.selection_candidate_result ALTER COLUMN row_digest SET NOT NULL;
ALTER TABLE app.selection_requirement_field ALTER COLUMN row_digest SET NOT NULL;
ALTER TABLE app.selection_source_result ALTER COLUMN row_digest SET NOT NULL;
ALTER TABLE app.selection_catalog_review_result ALTER COLUMN row_digest SET NOT NULL;
ALTER TABLE app.selection_professional_review_result ALTER COLUMN row_digest SET NOT NULL;
ALTER TABLE app.selection_warning_result ALTER COLUMN row_digest SET NOT NULL;
ALTER TABLE app.selection_missing_field_result ALTER COLUMN row_digest SET NOT NULL;

ALTER TABLE app.sales_snapshot_requirement_field_r3 ALTER COLUMN source_row_digest SET NOT NULL;
ALTER TABLE app.sales_snapshot_source_r3 ALTER COLUMN source_row_digest SET NOT NULL;
ALTER TABLE app.sales_snapshot_catalog_review_r3 ALTER COLUMN source_row_digest SET NOT NULL;
ALTER TABLE app.sales_snapshot_professional_review_r3 ALTER COLUMN source_row_digest SET NOT NULL;
ALTER TABLE app.sales_snapshot_warning_r3 ALTER COLUMN source_row_digest SET NOT NULL;
ALTER TABLE app.sales_snapshot_missing_field_r3 ALTER COLUMN source_row_digest SET NOT NULL;
ALTER TABLE app.sales_snapshot_parameter_r3 ALTER COLUMN source_row_digest SET NOT NULL;
ALTER TABLE app.sales_snapshot_price_r3 ALTER COLUMN source_row_digest SET NOT NULL;
ALTER TABLE app.sales_snapshot_candidate_r3 ALTER COLUMN result_row_digest SET NOT NULL;
ALTER TABLE app.sales_snapshot_candidate_r3
  ALTER COLUMN project_id SET NOT NULL,
  ALTER COLUMN conversation_id SET NOT NULL,
  ALTER COLUMN requirement_id SET NOT NULL,
  ALTER COLUMN requirement_version_id SET NOT NULL,
  ALTER COLUMN installation_scenario SET NOT NULL;

ALTER TABLE app.selection_candidate_result
  ADD CONSTRAINT selection_result_technical_status_check
    CHECK (technical_status IN ('TECHNICALLY_ELIGIBLE','TECHNICALLY_INELIGIBLE','TECHNICAL_REVIEW_REQUIRED')),
  ADD CONSTRAINT selection_result_commercial_status_check
    CHECK (commercial_status IN ('PRICE_VALID','PRICE_EXPIRED','REQUIRES_QUOTE','NO_PRICE')),
  ADD CONSTRAINT selection_result_trust_status_check
    CHECK (trust_status IN ('TRUSTED','UNVERIFIED','CONFLICTED')),
  ADD CONSTRAINT selection_result_professional_status_check
    CHECK (professional_review_status IN ('PENDING','IN_REVIEW','APPROVED','REJECTED','RETURNED_FOR_INFORMATION','INVALIDATED','EXPIRED')),
  ADD CONSTRAINT selection_result_overall_status_check
    CHECK (overall_status IN ('OPERATIONAL','REQUIRES_QUOTE','NOT_OPERATIONAL'));

ALTER TABLE app.sales_snapshot_candidate_r3
  ADD CONSTRAINT snapshot_candidate_technical_status_check
    CHECK (technical_status IN ('TECHNICALLY_ELIGIBLE','TECHNICALLY_INELIGIBLE','TECHNICAL_REVIEW_REQUIRED')),
  ADD CONSTRAINT snapshot_candidate_commercial_status_check
    CHECK (commercial_status IN ('PRICE_VALID','PRICE_EXPIRED','REQUIRES_QUOTE','NO_PRICE')),
  ADD CONSTRAINT snapshot_candidate_trust_status_check
    CHECK (trust_status IN ('TRUSTED','UNVERIFIED','CONFLICTED')),
  ADD CONSTRAINT snapshot_candidate_professional_status_check
    CHECK (professional_review_status IN ('PENDING','IN_REVIEW','APPROVED','REJECTED','RETURNED_FOR_INFORMATION','INVALIDATED','EXPIRED')),
  ADD CONSTRAINT snapshot_candidate_overall_status_check
    CHECK (overall_status IN ('OPERATIONAL','REQUIRES_QUOTE','NOT_OPERATIONAL'));

ALTER TABLE app.price_revision
  ADD CONSTRAINT price_revision_basis_check
    CHECK (price_basis IN ('EQUIPMENT_ONLY','TURNKEY','INSTALLATION_ONLY','MAINTENANCE','OTHER')),
  ADD CONSTRAINT price_revision_tax_basis_check
    CHECK (tax_basis IN ('INCLUDED','EXCLUDED','UNKNOWN')),
  ADD CONSTRAINT price_revision_applicability_check
    CHECK (applicability IN ('REGION_DEMO','PROJECT_SPECIFIC','GLOBAL'));

ALTER TABLE app.catalog_source_revision
  ADD CONSTRAINT catalog_source_kind_check CHECK (
    source_kind IN ('USER_ASSERTION','PRODUCT_DOCUMENT','PRICE_SHEET','CATALOG_REVIEW','PROFESSIONAL_REVIEW','SYSTEM_RULE')
  );

ALTER TABLE app.selection_source_result
  ADD CONSTRAINT selection_source_kind_check CHECK (
    source_kind IN ('USER_ASSERTION','PRODUCT_DOCUMENT','PRICE_SHEET','CATALOG_REVIEW','PROFESSIONAL_REVIEW','SYSTEM_RULE')
  );
ALTER TABLE app.sales_snapshot_source_r3
  ADD CONSTRAINT snapshot_source_kind_check CHECK (
    source_kind IN ('USER_ASSERTION','PRODUCT_DOCUMENT','PRICE_SHEET','CATALOG_REVIEW','PROFESSIONAL_REVIEW','SYSTEM_RULE')
  );
ALTER TABLE app.sales_snapshot_requirement_field_r3
  ADD CONSTRAINT snapshot_requirement_source_kind_check CHECK (
    source_kind IN ('USER_ASSERTION','PRODUCT_DOCUMENT','PRICE_SHEET','CATALOG_REVIEW','PROFESSIONAL_REVIEW','SYSTEM_RULE')
  );
ALTER TABLE app.selection_requirement_field
  ADD CONSTRAINT selection_requirement_source_kind_check CHECK (
    source_kind IN ('USER_ASSERTION','PRODUCT_DOCUMENT','PRICE_SHEET','CATALOG_REVIEW','PROFESSIONAL_REVIEW','SYSTEM_RULE')
  );

ALTER TABLE app.selection_requirement_field
  ADD CONSTRAINT selection_requirement_value_type_check
    CHECK (value_type IN ('BOOLEAN','INTEGER','DECIMAL','TEXT','ENUM','CANONICAL_ID','TIMESTAMP','BYTES')),
  ADD CONSTRAINT selection_requirement_field_status_check
    CHECK (field_status IN ('CONFIRMED','PROPOSED','MISSING','NOT_APPLICABLE','CONFLICTED'));
ALTER TABLE app.selection_requirement_field
  ADD CONSTRAINT selection_requirement_source_aux_nfc_check CHECK (
    source_aux_text IS NULL OR source_aux_text IS NFC NORMALIZED
  );
ALTER TABLE app.selection_source_result
  ADD CONSTRAINT selection_source_aux_nfc_check CHECK (
    source_aux_text IS NULL OR source_aux_text IS NFC NORMALIZED
  );
ALTER TABLE app.sales_snapshot_requirement_field_r3
  ADD CONSTRAINT snapshot_requirement_value_type_check
    CHECK (value_type IN ('BOOLEAN','INTEGER','DECIMAL','TEXT','ENUM','CANONICAL_ID','TIMESTAMP','BYTES')),
  ADD CONSTRAINT snapshot_requirement_field_status_check
    CHECK (field_status IN ('CONFIRMED','PROPOSED','MISSING','NOT_APPLICABLE','CONFLICTED'));
ALTER TABLE app.sales_snapshot_requirement_field_r3
  ADD CONSTRAINT snapshot_requirement_source_aux_nfc_check CHECK (
    source_aux_text IS NULL OR source_aux_text IS NFC NORMALIZED
  );
ALTER TABLE app.sales_snapshot_source_r3
  ADD CONSTRAINT snapshot_source_aux_nfc_check CHECK (
    source_aux_text IS NULL OR source_aux_text IS NFC NORMALIZED
  );

ALTER TABLE app.selection_catalog_review_result
  ADD CONSTRAINT selection_catalog_review_decision_check
    CHECK (decision IN ('APPROVE','APPROVED','REJECT','REJECTED','INVALIDATE','INVALIDATED','EXPIRE','EXPIRED'));
ALTER TABLE app.sales_snapshot_catalog_review_r3
  ADD CONSTRAINT snapshot_catalog_review_decision_check
    CHECK (decision IN ('APPROVE','APPROVED','REJECT','REJECTED','INVALIDATE','INVALIDATED','EXPIRE','EXPIRED'));
ALTER TABLE app.selection_professional_review_result
  ADD CONSTRAINT selection_professional_review_decision_check
    CHECK (decision IN ('APPROVE','APPROVED','REJECT','REJECTED','RETURN','RETURNED_FOR_INFORMATION','INVALIDATE','INVALIDATED','EXPIRE','EXPIRED'));
ALTER TABLE app.sales_snapshot_professional_review_r3
  ADD CONSTRAINT snapshot_professional_review_decision_check
    CHECK (decision IN ('APPROVE','APPROVED','REJECT','REJECTED','RETURN','RETURNED_FOR_INFORMATION','INVALIDATE','INVALIDATED','EXPIRE','EXPIRED'));
ALTER TABLE app.selection_warning_result
  ADD CONSTRAINT selection_warning_severity_check
    CHECK (severity IN ('INFO','WARNING','ERROR','BLOCKING')),
  ADD CONSTRAINT selection_warning_code_check
    CHECK (warning_code ~ '^[A-Z][A-Z0-9_]{1,63}$');
ALTER TABLE app.sales_snapshot_warning_r3
  ADD CONSTRAINT snapshot_warning_severity_check
    CHECK (severity IN ('INFO','WARNING','ERROR','BLOCKING')),
  ADD CONSTRAINT snapshot_warning_code_check
    CHECK (warning_code ~ '^[A-Z][A-Z0-9_]{1,63}$');

ALTER TABLE app.selection_missing_field_result
  ADD CONSTRAINT selection_missing_reason_check
    CHECK (reason IN ('NOT_PROVIDED','NOT_APPLICABLE','UNRECOGNIZED','INSUFFICIENT_DATA','SOURCE_UNAVAILABLE','CONFLICTED')),
  ADD CONSTRAINT selection_missing_impact_scope_check
    CHECK (impact_scope IN ('REQUIREMENT_COMPLETENESS','INSTALLATION_FEASIBILITY','SELECTION_ELIGIBILITY','PRICING','PROFESSIONAL_REVIEW'));
ALTER TABLE app.sales_snapshot_missing_field_r3
  ADD CONSTRAINT snapshot_missing_reason_check
    CHECK (reason IN ('NOT_PROVIDED','NOT_APPLICABLE','UNRECOGNIZED','INSUFFICIENT_DATA','SOURCE_UNAVAILABLE','CONFLICTED')),
  ADD CONSTRAINT snapshot_missing_impact_scope_check
    CHECK (impact_scope IN ('REQUIREMENT_COMPLETENESS','INSTALLATION_FEASIBILITY','SELECTION_ELIGIBILITY','PRICING','PROFESSIONAL_REVIEW'));

ALTER TABLE app.selection_warning_result
  ADD CONSTRAINT selection_warning_sequence_positive CHECK (warning_sequence > 0);
ALTER TABLE app.selection_professional_review_result
  ADD CONSTRAINT selection_professional_sequence_positive CHECK (event_sequence > 0);

ALTER TABLE app.professional_review
  ADD CONSTRAINT professional_review_state_check CHECK (
    state IN ('CREATED','IN_REVIEW','APPROVED','REJECTED','RETURNED_FOR_INFORMATION','INVALIDATED','EXPIRED')
  );
ALTER TABLE app.professional_review_event
  ADD CONSTRAINT professional_review_event_next_state_check CHECK (
    next_state IN ('CREATED','IN_REVIEW','APPROVED','REJECTED','RETURNED_FOR_INFORMATION','INVALIDATED','EXPIRED')
  );

ALTER TYPE app.professional_review_command ADD VALUE IF NOT EXISTS 'CREATE' BEFORE 'SUBMIT';

ALTER TABLE app.sales_snapshot_parameter_r3
  ADD COLUMN selection_run_id text;
ALTER TABLE app.sales_snapshot_price_r3
  ADD COLUMN selection_run_id text;
ALTER TABLE app.sales_snapshot_parameter_r3
  ALTER COLUMN selection_run_id SET NOT NULL,
  ADD CONSTRAINT snapshot_parameter_run_fk
    FOREIGN KEY (snapshot_id,selection_run_id)
    REFERENCES app.sales_handoff_snapshot_r3(id,selection_run_id);
ALTER TABLE app.sales_snapshot_price_r3
  ALTER COLUMN selection_run_id SET NOT NULL,
  ADD CONSTRAINT snapshot_price_run_fk
    FOREIGN KEY (snapshot_id,selection_run_id)
    REFERENCES app.sales_handoff_snapshot_r3(id,selection_run_id);

CREATE OR REPLACE FUNCTION app.source_key_r3(
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
  v_aux_text text;
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
    IF p_source_aux_text IS NULL THEN
      RAISE EXCEPTION 'source auxiliary NULL mismatch' USING ERRCODE='22023';
    END IF;
    v_aux_text := normalize(p_source_aux_text,NFC);
    IF octet_length(v_aux_text) NOT BETWEEN 1 AND 128
       OR v_aux_text ~ '[\x00-\x1F\x7F-\x9F]' THEN
      RAISE EXCEPTION 'source auxiliary domain' USING ERRCODE='22023';
    END IF;
    v_aux := app_private.r6_field(4,2,1,convert_to(v_aux_text,'UTF8'));
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

CREATE OR REPLACE FUNCTION app_private.stable_key_r3(
  p_record_type smallint,
  p_components jsonb
) RETURNS bytea
LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_expected_count integer := CASE p_record_type
    WHEN 0 THEN 1 WHEN 1 THEN 2 WHEN 2 THEN 1 WHEN 3 THEN 2 WHEN 4 THEN 2
    WHEN 5 THEN 1 WHEN 6 THEN 1 WHEN 7 THEN 2 WHEN 8 THEN 2 WHEN 9 THEN 2
  END;
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
  IF v_expected_count IS NULL
     OR jsonb_typeof(p_components) <> 'array'
     OR jsonb_array_length(p_components) <> v_expected_count THEN
    RAISE EXCEPTION 'stable tuple shape' USING ERRCODE='22023';
  END IF;
  v_result := 'SKR2'::bytea || app_private.u16be(2) || app_private.u16be(3)
    || app_private.u16be(p_record_type) || app_private.u16be(v_expected_count);
  FOR v_component IN SELECT value FROM jsonb_array_elements(p_components) LOOP
    v_index := v_index+1;
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
      WHEN p_record_type IN (1,3,9) AND v_index=2 THEN 'ASCII_KEY'
      WHEN p_record_type IN (7,8) AND v_index=2 THEN 'INT64'
      ELSE 'ASCII_ID'
    END;
    IF v_name IS DISTINCT FROM v_expected_name OR v_kind IS DISTINCT FROM v_expected_kind THEN
      RAISE EXCEPTION 'stable tuple definition' USING ERRCODE='22023';
    END IF;
    IF v_kind IN ('ASCII_ID','ASCII_KEY') THEN
      v_type_tag := CASE WHEN v_kind='ASCII_ID' THEN 1 ELSE 2 END;
      IF jsonb_typeof(v_value) <> 'string'
         OR (v_value #>> '{}') !~ '^[\x20-\x7E]{0,64}$' THEN
        RAISE EXCEPTION 'stable ASCII domain' USING ERRCODE='22023';
      END IF;
      v_payload := convert_to(v_value #>> '{}','UTF8');
    ELSIF v_kind='INT64' THEN
      v_type_tag := 3;
      IF jsonb_typeof(v_value) <> 'number' THEN
        RAISE EXCEPTION 'stable INT64' USING ERRCODE='22023';
      END IF;
      v_payload := app_private.i64be((v_value #>> '{}')::bigint);
    ELSE
      RAISE EXCEPTION 'stable component kind' USING ERRCODE='22023';
    END IF;
    v_result := v_result || app_private.u16be(v_index)
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

CREATE OR REPLACE FUNCTION app_private.r6_field_allowed(
  p_record_type smallint,
  p_tag integer,
  p_type text
) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
RETURN CASE p_record_type
  WHEN 0 THEN
    (p_tag BETWEEN 1 AND 9 AND p_type='CANONICAL_ID')
    OR (p_tag=10 AND p_type='TEXT')
    OR (p_tag=11 AND p_type='TIMESTAMP')
    OR (p_tag BETWEEN 12 AND 14 AND p_type='ENUM')
  WHEN 1 THEN
    (p_tag=1 AND p_type='TEXT')
    OR (p_tag IN (2,5,7,8) AND p_type='ENUM')
    OR (p_tag IN (6,9) AND p_type='CANONICAL_ID')
    OR (p_tag=3 AND p_type IN ('BOOLEAN','INTEGER','DECIMAL','TEXT','ENUM','CANONICAL_ID','TIMESTAMP','BYTES','NULL'))
    OR (p_tag IN (4,10) AND p_type IN ('TEXT','NULL'))
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
    (p_tag=1 AND p_type='CANONICAL_ID')
    OR (p_tag=2 AND p_type='TEXT')
    OR (p_tag IN (3,4) AND p_type='ENUM')
  ELSE false
END;

CREATE OR REPLACE FUNCTION app_private.r6_record(
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
  v_previous_tag integer := 0;
  v_tag integer;
  v_type text;
  v_type_tag integer;
  v_presence integer;
  v_payload bytea;
  v_fields bytea := ''::bytea;
  v_count integer := 0;
  v_expected_count integer := CASE p_record_type
    WHEN 0 THEN 14 WHEN 1 THEN 11 WHEN 2 THEN 14 WHEN 3 THEN 7 WHEN 4 THEN 12
    WHEN 5 THEN 5 WHEN 6 THEN 6 WHEN 7 THEN 7 WHEN 8 THEN 6 WHEN 9 THEN 4
  END;
  v_inner bytea;
BEGIN
  IF v_expected_count IS NULL
     OR p_row_id !~ '^[\x20-\x7E]{1,64}$'
     OR octet_length(p_stable_key) NOT BETWEEN 1 AND 158
     OR jsonb_typeof(p_fields) <> 'array'
     OR jsonb_array_length(p_fields) <> v_expected_count THEN
    RAISE EXCEPTION 'record shape' USING ERRCODE='22023';
  END IF;
  FOR v_field IN SELECT value FROM jsonb_array_elements(p_fields) LOOP
    v_count := v_count+1;
    v_tag := (v_field->>'tag')::integer;
    v_type := v_field->>'type';
    IF v_tag <= v_previous_tag
       OR NOT app_private.r6_field_allowed(p_record_type,v_tag,v_type) THEN
      RAISE EXCEPTION 'field/type registry mismatch' USING ERRCODE='22023';
    END IF;
    v_previous_tag := v_tag;
    IF v_type='NULL' THEN
      v_type_tag:=0; v_presence:=0; v_payload:=''::bytea;
    ELSIF v_type='BOOLEAN' THEN
      IF jsonb_typeof(v_field->'value')<>'boolean' THEN
        RAISE EXCEPTION 'BOOLEAN value' USING ERRCODE='22023';
      END IF;
      v_type_tag:=1; v_presence:=1;
      v_payload:=decode(CASE WHEN (v_field->>'value')::boolean THEN '01' ELSE '00' END,'hex');
    ELSIF v_type IN ('INTEGER','TIMESTAMP') THEN
      IF jsonb_typeof(v_field->'value')<>'number' THEN
        RAISE EXCEPTION 'INT64 value' USING ERRCODE='22023';
      END IF;
      v_type_tag:=CASE WHEN v_type='INTEGER' THEN 2 ELSE 7 END;
      v_presence:=1;
      v_payload:=app_private.i64be((v_field->>'value')::bigint);
    ELSIF v_type='DECIMAL' THEN
      IF jsonb_typeof(v_field->'value')<>'string'
         OR (v_field->>'value') !~ '^-?(0|[1-9][0-9]*)(\.[0-9]{1,6})?$'
         OR (v_field->>'value') ~ '^-0(\.0+)?$'
         OR ((v_field->>'value') LIKE '%.%' AND (v_field->>'value') LIKE '%0')
         OR char_length(regexp_replace(v_field->>'value','[-.]','','g')) > 18 THEN
        RAISE EXCEPTION 'DECIMAL value' USING ERRCODE='22023';
      END IF;
      v_type_tag:=3; v_presence:=1;
      v_payload:=convert_to(v_field->>'value','UTF8');
    ELSIF v_type='TEXT' THEN
      IF jsonb_typeof(v_field->'value')<>'string'
         OR strpos(v_field->>'value',E'\x00')>0
         OR (v_field->>'value') IS NOT NFC NORMALIZED
         OR char_length(v_field->>'value')>4000 THEN
        RAISE EXCEPTION 'TEXT value' USING ERRCODE='22023';
      END IF;
      v_type_tag:=4; v_presence:=1;
      v_payload:=convert_to(v_field->>'value','UTF8');
    ELSIF v_type IN ('ENUM','CANONICAL_ID') THEN
      IF jsonb_typeof(v_field->'value')<>'string'
         OR (v_field->>'value') !~ '^[\x20-\x7E]{1,64}$' THEN
        RAISE EXCEPTION 'ASCII value' USING ERRCODE='22023';
      END IF;
      v_type_tag:=CASE WHEN v_type='ENUM' THEN 5 ELSE 6 END;
      v_presence:=1; v_payload:=convert_to(v_field->>'value','UTF8');
    ELSIF v_type='BYTES' THEN
      IF jsonb_typeof(v_field->'bytesHex')<>'string' THEN
        RAISE EXCEPTION 'BYTES value' USING ERRCODE='22023';
      END IF;
      v_payload:=decode(v_field->>'bytesHex','hex');
      IF octet_length(v_payload) NOT BETWEEN 1 AND 512 THEN
        RAISE EXCEPTION 'BYTES length' USING ERRCODE='22001';
      END IF;
      v_type_tag:=8; v_presence:=1;
    ELSE
      RAISE EXCEPTION 'field type' USING ERRCODE='22023';
    END IF;
    v_fields:=v_fields||app_private.r6_field(v_tag,v_type_tag,v_presence,v_payload);
  END LOOP;
  v_inner:=app_private.u16be(p_record_type)
    || app_private.u16be(octet_length(p_row_id)) || convert_to(p_row_id,'UTF8')
    || app_private.u16be(octet_length(p_stable_key)) || p_stable_key
    || app_private.u16be(v_count) || v_fields;
  IF octet_length(v_inner)+4>16874 THEN
    RAISE EXCEPTION 'record length' USING ERRCODE='22001';
  END IF;
  RETURN app_private.u32be(octet_length(v_inner)+4)||v_inner;
END
$$;

CREATE OR REPLACE FUNCTION app_private.canonical_row_payload_r3(
  p_table text,
  p_row jsonb
) RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
RETURN CASE p_table
  WHEN 'selection_requirement_field' THEN jsonb_build_object(
    'selectionRunId',p_row->>'selection_run_id',
    'requirementVersionId',p_row->>'requirement_version_id',
    'fieldKey',p_row->>'field_key','value',p_row->'value_json',
    'valueType',p_row->>'value_type','unit',p_row->'unit',
    'fieldStatus',p_row->>'field_status','sourceKind',p_row->>'source_kind',
    'sourceEntityType',p_row->>'source_entity_type',
    'sourceEntityId',p_row->>'source_entity_id',
    'sourceAuxIsNull',p_row->'source_aux_is_null','sourceAuxText',p_row->'source_aux_text',
    'sourceValueId',p_row->>'source_value_id','sourceRevisionId',p_row->>'source_revision_id'
  )
  WHEN 'sales_snapshot_requirement_field_r3' THEN jsonb_build_object(
    'selectionRunId',p_row->>'selection_run_id',
    'requirementVersionId',p_row->>'requirement_version_id',
    'fieldKey',p_row->>'field_key','value',p_row->'value_json',
    'valueType',p_row->>'value_type','unit',p_row->'unit',
    'fieldStatus',p_row->>'field_status','sourceKind',p_row->>'source_kind',
    'sourceEntityType',p_row->>'source_entity_type',
    'sourceEntityId',p_row->>'source_entity_id',
    'sourceAuxIsNull',p_row->'source_aux_is_null','sourceAuxText',p_row->'source_aux_text',
    'sourceValueId',p_row->>'source_value_id','sourceRevisionId',p_row->>'source_revision_id'
  )
  WHEN 'selection_source_result' THEN jsonb_build_object(
    'selectionRunId',p_row->>'selection_run_id','sourceRevisionId',p_row->>'source_revision_id',
    'evidenceObjectId',p_row->>'evidence_object_id','rawContentDigest',p_row->>'raw_content_digest',
    'sourceKind',p_row->>'source_kind','sourceEntityType',p_row->>'source_entity_type',
    'sourceEntityId',p_row->>'source_entity_id','sourceAuxIsNull',p_row->'source_aux_is_null',
    'sourceAuxText',p_row->'source_aux_text','capturedAt',p_row->>'captured_at'
  )
  WHEN 'sales_snapshot_source_r3' THEN jsonb_build_object(
    'selectionRunId',p_row->>'selection_run_id','sourceRevisionId',p_row->>'source_revision_id',
    'evidenceObjectId',p_row->>'evidence_object_id','rawContentDigest',p_row->>'raw_content_digest',
    'sourceKind',p_row->>'source_kind','sourceEntityType',p_row->>'source_entity_type',
    'sourceEntityId',p_row->>'source_entity_id','sourceAuxIsNull',p_row->'source_aux_is_null',
    'sourceAuxText',p_row->'source_aux_text','capturedAt',p_row->>'captured_at'
  )
  WHEN 'selection_catalog_review_result' THEN jsonb_build_object(
    'selectionRunId',p_row->>'selection_run_id','catalogReviewId',p_row->>'catalog_review_id',
    'targetRevisionId',p_row->>'target_revision_id','sourceRevisionId',p_row->>'source_revision_id',
    'policyRevisionId',p_row->>'policy_revision_id','decision',p_row->>'decision',
    'reviewedAt',p_row->>'reviewed_at'
  )
  WHEN 'sales_snapshot_catalog_review_r3' THEN jsonb_build_object(
    'selectionRunId',p_row->>'selection_run_id','catalogReviewId',p_row->>'catalog_review_id',
    'targetRevisionId',p_row->>'target_revision_id','sourceRevisionId',p_row->>'source_revision_id',
    'policyRevisionId',p_row->>'policy_revision_id','decision',p_row->>'decision',
    'reviewedAt',p_row->>'reviewed_at'
  )
  WHEN 'selection_professional_review_result' THEN jsonb_build_object(
    'selectionRunId',p_row->>'selection_run_id','eventId',p_row->>'professional_review_event_id',
    'professionalReviewId',p_row->>'professional_review_id','eventSequence',p_row->'event_sequence',
    'targetRevisionId',p_row->>'target_revision_id','policyRevisionId',p_row->>'policy_revision_id',
    'decision',p_row->>'decision','basisDigest',p_row->>'basis_digest','occurredAt',p_row->>'occurred_at'
  )
  WHEN 'sales_snapshot_professional_review_r3' THEN jsonb_build_object(
    'selectionRunId',p_row->>'selection_run_id','eventId',p_row->>'professional_review_event_id',
    'professionalReviewId',p_row->>'professional_review_id','eventSequence',p_row->'event_sequence',
    'targetRevisionId',p_row->>'target_revision_id','policyRevisionId',p_row->>'policy_revision_id',
    'decision',p_row->>'decision','basisDigest',p_row->>'basis_digest','occurredAt',p_row->>'occurred_at'
  )
  WHEN 'selection_warning_result' THEN jsonb_build_object(
    'selectionRunId',p_row->>'selection_run_id','candidateId',p_row->>'candidate_id',
    'warningSequence',p_row->'warning_sequence','warningCode',p_row->>'warning_code',
    'warningText',p_row->>'warning_text','severity',p_row->>'severity',
    'sourceWarningId',p_row->>'source_warning_id'
  )
  WHEN 'sales_snapshot_warning_r3' THEN jsonb_build_object(
    'selectionRunId',p_row->>'selection_run_id','candidateId',p_row->>'candidate_id',
    'warningSequence',p_row->'warning_sequence','warningCode',p_row->>'warning_code',
    'warningText',p_row->>'warning_text','severity',p_row->>'severity',
    'sourceWarningId',p_row->>'source_warning_id'
  )
  WHEN 'selection_missing_field_result' THEN jsonb_build_object(
    'selectionRunId',p_row->>'selection_run_id','candidateId',p_row->>'candidate_id',
    'fieldKey',p_row->>'field_key','reason',p_row->>'reason','impactScope',p_row->>'impact_scope'
  )
  WHEN 'sales_snapshot_missing_field_r3' THEN jsonb_build_object(
    'selectionRunId',p_row->>'selection_run_id','candidateId',p_row->>'candidate_id',
    'fieldKey',p_row->>'field_key','reason',p_row->>'reason','impactScope',p_row->>'impact_scope'
  )
  WHEN 'selection_candidate_price' THEN jsonb_build_object(
    'candidateId',p_row->>'candidate_id','productId',p_row->>'product_id',
    'productRevisionId',p_row->>'product_revision_id',
    'specificationRevisionId',p_row->>'specification_revision_id',
    'priceRevisionId',p_row->>'price_revision_id','sourceRevisionId',p_row->>'source_revision_id'
  )
  WHEN 'sales_snapshot_price_r3' THEN jsonb_build_object(
    'candidateId',p_row->>'candidate_id','productId',p_row->>'product_id',
    'productRevisionId',p_row->>'product_revision_id',
    'specificationRevisionId',p_row->>'specification_revision_id',
    'priceRevisionId',p_row->>'price_revision_id','sourceRevisionId',p_row->>'source_revision_id'
  )
  WHEN 'selection_candidate_parameter' THEN jsonb_build_object(
    'candidateId',p_row->>'candidate_id','productId',p_row->>'product_id',
    'productRevisionId',p_row->>'product_revision_id',
    'parameterKey',p_row->>'parameter_key',
    'catalogParameterRevisionId',p_row->>'catalog_parameter_revision_id',
    'valueType',p_row->>'value_type','sourceRevisionId',p_row->>'source_revision_id',
    'value',p_row->'value_json','unit',p_row->'unit'
  )
  WHEN 'sales_snapshot_parameter_r3' THEN jsonb_build_object(
    'candidateId',p_row->>'candidate_id','productId',p_row->>'product_id',
    'productRevisionId',p_row->>'product_revision_id',
    'parameterKey',p_row->>'parameter_key',
    'catalogParameterRevisionId',p_row->>'catalog_parameter_revision_id',
    'valueType',p_row->>'value_type','sourceRevisionId',p_row->>'source_revision_id',
    'value',p_row->'value_json','unit',p_row->'unit'
  )
  WHEN 'selection_candidate_result' THEN jsonb_build_object(
    'selectionResultItemId',p_row->>'id','candidateId',p_row->>'candidate_id',
    'selectionRunId',p_row->>'selection_run_id','projectId',p_row->>'project_id',
    'conversationId',p_row->>'conversation_id','requirementId',p_row->>'requirement_id',
    'requirementVersionId',p_row->>'requirement_version_id',
    'installationScenario',p_row->>'installation_scenario',
    'ruleSetRevisionId',p_row->>'rule_set_revision_id',
    'ruleSetContentDigest',p_row->>'rule_set_content_digest',
    'productId',p_row->>'product_id','productRevisionId',p_row->>'product_revision_id',
    'productRevisionDigest',p_row->>'product_revision_digest',
    'specificationRevisionId',p_row->>'specification_revision_id',
    'specificationRevisionDigest',p_row->>'specification_revision_digest',
    'technicalStatus',p_row->>'technical_status','commercialStatus',p_row->>'commercial_status',
    'trustStatus',p_row->>'trust_status','professionalReviewStatus',p_row->>'professional_review_status',
    'overallStatus',p_row->>'overall_status'
  )
  WHEN 'sales_snapshot_candidate_r3' THEN jsonb_build_object(
    'selectionResultItemId',p_row->>'selection_result_item_id','candidateId',p_row->>'candidate_id',
    'selectionRunId',p_row->>'selection_run_id',
    'projectId',p_row->>'project_id','conversationId',p_row->>'conversation_id',
    'requirementId',p_row->>'requirement_id','requirementVersionId',p_row->>'requirement_version_id',
    'installationScenario',p_row->>'installation_scenario',
    'ruleSetRevisionId',p_row->>'rule_set_revision_id',
    'ruleSetContentDigest',p_row->>'rule_set_content_digest',
    'productId',p_row->>'product_id','productRevisionId',p_row->>'product_revision_id',
    'productRevisionDigest',p_row->>'product_revision_digest',
    'specificationRevisionId',p_row->>'specification_revision_id',
    'specificationRevisionDigest',p_row->>'specification_revision_digest',
    'technicalStatus',p_row->>'technical_status','commercialStatus',p_row->>'commercial_status',
    'trustStatus',p_row->>'trust_status','professionalReviewStatus',p_row->>'professional_review_status',
    'overallStatus',p_row->>'overall_status'
  )
  ELSE NULL
END;

CREATE OR REPLACE FUNCTION app_private.row_digest_r3(
  p_kind text,
  p_table text,
  p_row jsonb
) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_payload jsonb;
BEGIN
  v_payload := app_private.canonical_row_payload_r3(p_table,p_row);
  IF v_payload IS NULL THEN
    RAISE EXCEPTION 'unknown row digest table' USING ERRCODE='22023';
  END IF;
  RETURN app_private.sha256_hex(
    decode('414945412D524F5700','hex') || convert_to(p_kind || E'\x1F' || v_payload::text,'UTF8')
  );
END
$$;

CREATE OR REPLACE FUNCTION app_private.compute_selection_row_digest_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  NEW.row_digest := app_private.row_digest_r3(
    'SELECTION',TG_TABLE_NAME,to_jsonb(NEW)
  );
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION app_private.verify_snapshot_row_digest_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_expected text;
BEGIN
  v_expected := app_private.row_digest_r3(
    'SELECTION',TG_TABLE_NAME,to_jsonb(NEW)
  );
  IF TG_TABLE_NAME='sales_snapshot_candidate_r3' THEN
    IF NEW.result_row_digest IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'snapshot candidate source digest mismatch' USING ERRCODE='23514';
    END IF;
  ELSE
    IF NEW.source_row_digest IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'snapshot source digest mismatch' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION app_private.session_token_digest(p_token text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
RETURN app_private.sha256_hex(
  decode('414945412D53455353494F4E2D544F4B454E00','hex')
  || convert_to(p_token,'UTF8')
);

CREATE OR REPLACE FUNCTION app_private.validate_session_role_r3(
  p_role_name text,
  p_role_kind text,
  p_capability_role text
) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_capability_count integer;
BEGIN
  IF p_role_name !~ '^elevator_session_[a-z0-9_]{6,48}$' THEN
    RAISE EXCEPTION 'session role name invalid' USING ERRCODE='22023';
  END IF;
  IF p_capability_role IS DISTINCT FROM CASE p_role_kind
    WHEN 'WEB' THEN 'elevator_runtime_web'
    WHEN 'WORKER' THEN 'elevator_runtime_worker'
    WHEN 'PROFESSIONAL_REVIEWER' THEN 'elevator_professional_reviewer'
    WHEN 'POLICY_AUTHOR' THEN 'elevator_policy_author'
    WHEN 'POLICY_REVIEWER' THEN 'elevator_policy_reviewer'
    WHEN 'SECURITY_ADMIN' THEN 'elevator_security_admin'
    WHEN 'AUDITOR' THEN 'elevator_readonly_auditor'
    WHEN 'REPORTING' THEN 'elevator_reporting_readonly'
  END THEN
    RAISE EXCEPTION 'session role kind/capability mismatch' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles r
     WHERE r.rolname=p_role_name
       AND r.rolcanlogin
       AND r.rolconnlimit=1
       AND NOT r.rolsuper
       AND NOT r.rolbypassrls
  ) THEN
    RAISE EXCEPTION 'session role attributes invalid' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members am
    JOIN pg_catalog.pg_roles member_role ON member_role.oid=am.member
    JOIN pg_catalog.pg_roles granted_role ON granted_role.oid=am.roleid
    WHERE member_role.rolname=p_role_name
      AND granted_role.rolname='elevator_session_bootstrap'
  ) THEN
    RAISE EXCEPTION 'session bootstrap membership missing' USING ERRCODE='42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members am
    JOIN pg_catalog.pg_roles member_role ON member_role.oid=am.member
    JOIN pg_catalog.pg_roles granted_role ON granted_role.oid=am.roleid
    WHERE member_role.rolname=p_role_name
      AND granted_role.rolname IN (
        'elevator_database_owner','elevator_schema_owner',
        'elevator_table_owner','elevator_review_function_owner',
        'elevator_migrator'
      )
  ) THEN
    RAISE EXCEPTION 'session role has owner membership' USING ERRCODE='42501';
  END IF;
  SELECT count(*) INTO v_capability_count
    FROM pg_catalog.pg_auth_members am
    JOIN pg_catalog.pg_roles member_role ON member_role.oid=am.member
    JOIN pg_catalog.pg_roles granted_role ON granted_role.oid=am.roleid
   WHERE member_role.rolname=p_role_name
     AND granted_role.rolname IN (
       'elevator_runtime_web','elevator_runtime_worker',
       'elevator_professional_reviewer','elevator_policy_author',
       'elevator_policy_reviewer','elevator_security_admin',
       'elevator_readonly_auditor','elevator_reporting_readonly'
     );
  IF v_capability_count<>1
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_auth_members am
       JOIN pg_catalog.pg_roles member_role ON member_role.oid=am.member
       JOIN pg_catalog.pg_roles granted_role ON granted_role.oid=am.roleid
       WHERE member_role.rolname=p_role_name
         AND granted_role.rolname=p_capability_role
     ) THEN
    RAISE EXCEPTION 'session role capability membership invalid' USING ERRCODE='42501';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION app.register_session_role(
  p_role_name text,
  p_role_kind text,
  p_capability_role text,
  p_activation_token_digest text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  IF session_user<>'elevator_identity_broker' THEN
    RAISE EXCEPTION 'broker role required' USING ERRCODE='42501';
  END IF;
  PERFORM app_private.validate_session_role_r3(
    p_role_name,p_role_kind,p_capability_role
  );
  IF p_activation_token_digest !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'activation token digest invalid' USING ERRCODE='22023';
  END IF;
  INSERT INTO app.session_role_registry(
    role_name,role_kind,capability_role,activation_token_digest,
    state,provisioned_at
  ) VALUES(
    p_role_name,p_role_kind,p_capability_role,p_activation_token_digest,
    'AVAILABLE',clock_timestamp()
  );
END
$$;

CREATE OR REPLACE FUNCTION app.open_trusted_session(
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
  r app.session_role_registry%ROWTYPE;
  v_epoch bigint;
BEGIN
  IF session_user<>'elevator_identity_broker' THEN
    RAISE EXCEPTION 'broker role required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO STRICT r
    FROM app.session_role_registry
   WHERE role_name=p_db_auth_role
     AND state='AVAILABLE'
   FOR UPDATE;
  PERFORM app_private.validate_session_role_r3(
    r.role_name,r.role_kind,r.capability_role
  );
  IF p_session_id IS NULL OR p_principal_id IS NULL OR p_assertion_id IS NULL
     OR p_assertion_digest IS NULL OR p_audience IS NULL OR p_issuer IS NULL
     OR p_not_before<p_issued_at OR p_expires_at<=p_issued_at
     OR p_expires_at<=clock_timestamp() THEN
    RAISE EXCEPTION 'session identity or validity invalid' USING ERRCODE='22007';
  END IF;
  SELECT pe.current_epoch INTO v_epoch
    FROM app.principal_epoch pe
   WHERE pe.principal_id=p_principal_id
   FOR UPDATE;
  IF v_epoch IS NULL OR v_epoch<>p_login_epoch THEN
    RAISE EXCEPTION 'stale login epoch' USING ERRCODE='40001';
  END IF;
  INSERT INTO app.trusted_session(
    session_id,principal_id,login_epoch,db_auth_role,audience,issuer,
    assertion_id,assertion_digest,issued_at,not_before,expires_at,
    state,binding_state,created_at
  ) VALUES(
    p_session_id,p_principal_id,p_login_epoch,p_db_auth_role,p_audience,p_issuer,
    p_assertion_id,p_assertion_digest,p_issued_at,p_not_before,p_expires_at,
    'ACTIVE','PROVISIONED',clock_timestamp()
  );
  UPDATE app.session_role_registry
     SET state='ASSIGNED',session_id=p_session_id,assigned_at=clock_timestamp()
   WHERE role_name=r.role_name;
  INSERT INTO app.session_audit(id,session_id,action,actor_role,reason,occurred_at)
  VALUES(
    gen_random_uuid()::text,p_session_id,'OPEN',session_user,
    'session provisioned; activation pending',clock_timestamp()
  );
END
$$;

CREATE OR REPLACE FUNCTION app.activate_trusted_session(
  p_session_id text,
  p_activation_token text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  ts app.trusted_session%ROWTYPE;
  reg app.session_role_registry%ROWTYPE;
  v_backend_start timestamptz;
  v_binding_digest text;
BEGIN
  IF p_activation_token IS NULL OR p_activation_token='' THEN
    RAISE EXCEPTION 'activation token required' USING ERRCODE='22004';
  END IF;
  SELECT * INTO STRICT ts FROM app.trusted_session
   WHERE session_id=p_session_id
     AND db_auth_role=session_user
     AND state='ACTIVE'
     AND binding_state='PROVISIONED'
   FOR UPDATE;
  SELECT * INTO STRICT reg FROM app.session_role_registry
   WHERE role_name=ts.db_auth_role
     AND session_id=ts.session_id
     AND state='ASSIGNED'
   FOR UPDATE;
  IF clock_timestamp()>=ts.expires_at
     OR reg.activation_token_digest<>app_private.session_token_digest(p_activation_token) THEN
    RAISE EXCEPTION 'activation denied' USING ERRCODE='42501';
  END IF;
  SELECT a.backend_start INTO v_backend_start
    FROM pg_catalog.pg_stat_activity a
   WHERE a.pid=pg_catalog.pg_backend_pid()
     AND a.usename=session_user;
  IF v_backend_start IS NULL THEN
    RAISE EXCEPTION 'backend identity unavailable' USING ERRCODE='42501';
  END IF;
  v_binding_digest := app_private.sha256_hex(convert_to(
    p_session_id || ':' || pg_catalog.pg_backend_pid()::text || ':' || v_backend_start::text,
    'UTF8'
  ));
  UPDATE app.trusted_session
     SET binding_state='ACTIVE',backend_pid=pg_catalog.pg_backend_pid(),
         backend_started_at=v_backend_start,activated_at=clock_timestamp(),
         last_verified_at=clock_timestamp(),binding_digest=v_binding_digest
   WHERE session_id=ts.session_id AND binding_state='PROVISIONED';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'session already activated' USING ERRCODE='40001';
  END IF;
  UPDATE app.session_role_registry
     SET state='ACTIVE'
   WHERE role_name=reg.role_name;
  PERFORM pg_catalog.set_config('aiea.session_binding',p_session_id,false);
  INSERT INTO app.session_binding_audit(
    id,session_id,actor_role,backend_pid,backend_started_at,binding_digest,occurred_at
  ) VALUES(
    gen_random_uuid()::text,ts.session_id,session_user,
    pg_catalog.pg_backend_pid(),v_backend_start,v_binding_digest,clock_timestamp()
  );
END
$$;

CREATE OR REPLACE FUNCTION app_private.lock_current_session()
RETURNS TABLE (
  session_id text,
  principal_id text,
  login_epoch bigint,
  capability_role text
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_principal_id text;
  v_current_epoch bigint;
  v_session_epoch bigint;
  v_session_id text;
  v_capability_role text;
  v_expected_backend_start timestamptz;
BEGIN
  SELECT ts.principal_id INTO v_principal_id
    FROM app.trusted_session ts
   WHERE ts.db_auth_role=session_user
     AND ts.state='ACTIVE'
     AND ts.binding_state IN ('PROVISIONED','ACTIVE');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'session role missing' USING ERRCODE='42501';
  END IF;
  SELECT pe.current_epoch INTO v_current_epoch
    FROM app.principal_epoch pe
   WHERE pe.principal_id=v_principal_id
   FOR SHARE;
  SELECT a.backend_start INTO v_expected_backend_start
    FROM pg_catalog.pg_stat_activity a
   WHERE a.pid=pg_catalog.pg_backend_pid()
     AND a.usename=session_user;
  SELECT ts.session_id,ts.login_epoch,reg.capability_role
    INTO v_session_id,v_session_epoch,v_capability_role
    FROM app.trusted_session ts
    JOIN app.session_role_registry reg
      ON reg.role_name=ts.db_auth_role AND reg.session_id=ts.session_id
   WHERE ts.db_auth_role=session_user
     AND ts.principal_id=v_principal_id
     AND ts.state='ACTIVE'
     AND ts.binding_state='ACTIVE'
     AND ts.backend_pid=pg_catalog.pg_backend_pid()
     AND ts.backend_started_at=v_expected_backend_start
     AND pg_catalog.current_setting('aiea.session_binding',true)=ts.session_id
     AND ts.login_epoch=v_current_epoch
     AND clock_timestamp()>=ts.not_before
     AND clock_timestamp()<ts.expires_at
     AND reg.state='ACTIVE'
   FOR SHARE OF ts,reg;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'current backend is not the active trusted session' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT v_session_id,v_principal_id,v_session_epoch,v_capability_role;
END
$$;

CREATE OR REPLACE FUNCTION app_private.current_session_context()
RETURNS TABLE (
  session_id text,
  principal_id text,
  login_epoch bigint,
  capability_role text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  RETURN QUERY
    SELECT ts.session_id,ts.principal_id,ts.login_epoch,reg.capability_role
      FROM app.trusted_session ts
      JOIN app.session_role_registry reg
        ON reg.role_name=ts.db_auth_role AND reg.session_id=ts.session_id
      JOIN app.principal_epoch pe ON pe.principal_id=ts.principal_id
     WHERE ts.db_auth_role=session_user
       AND ts.state='ACTIVE'
       AND ts.binding_state='ACTIVE'
       AND ts.backend_pid=pg_catalog.pg_backend_pid()
       AND ts.backend_started_at=(
         SELECT a.backend_start FROM pg_catalog.pg_stat_activity a
          WHERE a.pid=pg_catalog.pg_backend_pid() AND a.usename=session_user
       )
       AND pg_catalog.current_setting('aiea.session_binding',true)=ts.session_id
       AND ts.login_epoch=pe.current_epoch
       AND clock_timestamp()>=ts.not_before
       AND clock_timestamp()<ts.expires_at
       AND reg.state='ACTIVE';
END
$$;

CREATE OR REPLACE FUNCTION app_private.lock_authority_grant(
  p_session_id text,
  p_principal_id text,
  p_capability text,
  p_project_id text,
  p_policy_id text,
  p_policy_revision_id text,
  p_subject_principal_id text
) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_grant_id text;
BEGIN
  SELECT g.id INTO v_grant_id
    FROM app.authority_grant g
   WHERE g.session_id=p_session_id
     AND g.principal_id=p_principal_id
     AND g.authority_code=p_capability
     AND (
       g.object_scope='GLOBAL'
       OR (g.object_scope='PROJECT'
           AND p_project_id IS NOT NULL
           AND g.project_id=p_project_id)
       OR (g.object_scope='POLICY'
           AND p_policy_id IS NOT NULL
           AND g.policy_id=p_policy_id
           AND (p_project_id IS NULL OR g.project_id IS NOT DISTINCT FROM p_project_id)
           AND (p_policy_revision_id IS NULL
                OR g.policy_revision_id IS NULL
                OR g.policy_revision_id=p_policy_revision_id))
       OR (g.object_scope='PRINCIPAL'
           AND p_subject_principal_id IS NOT NULL
           AND g.subject_principal_id=p_subject_principal_id
           AND (p_project_id IS NULL OR g.project_id IS NOT DISTINCT FROM p_project_id))
     )
     AND (g.project_id IS NULL OR p_project_id IS NOT DISTINCT FROM g.project_id)
     AND (g.policy_id IS NULL OR p_policy_id IS NOT DISTINCT FROM g.policy_id)
     AND (g.policy_revision_id IS NULL OR p_policy_revision_id IS NOT DISTINCT FROM g.policy_revision_id)
     AND (g.subject_principal_id IS NULL OR p_subject_principal_id IS NOT DISTINCT FROM g.subject_principal_id)
     AND g.revoked_at IS NULL
     AND clock_timestamp()>=g.valid_from
     AND (g.valid_until IS NULL OR clock_timestamp()<g.valid_until)
   ORDER BY g.id
   LIMIT 1
   FOR SHARE;
  IF v_grant_id IS NULL THEN
    RAISE EXCEPTION 'authority grant missing for exact session/scope' USING ERRCODE='42501';
  END IF;
  RETURN v_grant_id;
END
$$;

CREATE OR REPLACE FUNCTION app_private.has_current_authority(
  p_capability text,
  p_project_id text,
  p_policy_id text,
  p_policy_revision_id text,
  p_subject_principal_id text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
RETURN EXISTS (
  SELECT 1
    FROM app.trusted_session ts
    JOIN app.session_role_registry reg
      ON reg.role_name=ts.db_auth_role AND reg.session_id=ts.session_id
    JOIN app.principal_epoch pe ON pe.principal_id=ts.principal_id
    JOIN app.authority_grant g ON g.session_id=ts.session_id
   WHERE ts.db_auth_role=session_user
     AND ts.state='ACTIVE'
     AND ts.binding_state='ACTIVE'
     AND ts.backend_pid=pg_catalog.pg_backend_pid()
     AND ts.backend_started_at=(
       SELECT a.backend_start FROM pg_catalog.pg_stat_activity a
        WHERE a.pid=pg_catalog.pg_backend_pid() AND a.usename=session_user
     )
     AND pg_catalog.current_setting('aiea.session_binding',true)=ts.session_id
     AND ts.login_epoch=pe.current_epoch
     AND clock_timestamp()>=ts.not_before
     AND clock_timestamp()<ts.expires_at
     AND reg.state='ACTIVE'
     AND g.principal_id=ts.principal_id
     AND g.authority_code=p_capability
     AND (
       g.object_scope='GLOBAL'
       OR (g.object_scope='PROJECT'
           AND p_project_id IS NOT NULL
           AND g.project_id=p_project_id)
       OR (g.object_scope='POLICY'
           AND p_policy_id IS NOT NULL
           AND g.policy_id=p_policy_id
           AND (p_project_id IS NULL OR g.project_id IS NOT DISTINCT FROM p_project_id)
           AND (p_policy_revision_id IS NULL
                OR g.policy_revision_id IS NULL
                OR g.policy_revision_id=p_policy_revision_id))
       OR (g.object_scope='PRINCIPAL'
           AND p_subject_principal_id IS NOT NULL
           AND g.subject_principal_id=p_subject_principal_id
           AND (p_project_id IS NULL OR g.project_id IS NOT DISTINCT FROM p_project_id))
     )
     AND (g.project_id IS NULL OR p_project_id IS NOT DISTINCT FROM g.project_id)
     AND (g.policy_id IS NULL OR p_policy_id IS NOT DISTINCT FROM g.policy_id)
     AND (g.policy_revision_id IS NULL OR p_policy_revision_id IS NOT DISTINCT FROM g.policy_revision_id)
     AND (g.subject_principal_id IS NULL OR p_subject_principal_id IS NOT DISTINCT FROM g.subject_principal_id)
     AND g.revoked_at IS NULL
     AND clock_timestamp()>=g.valid_from
     AND (g.valid_until IS NULL OR clock_timestamp()<g.valid_until)
);

CREATE OR REPLACE FUNCTION app_private.assert_active_session(
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
      JOIN app.session_role_registry reg
        ON reg.role_name=ts.db_auth_role AND reg.session_id=ts.session_id
      JOIN app.principal_epoch pe ON pe.principal_id=ts.principal_id
     WHERE ts.session_id=p_session_id
       AND ts.principal_id=p_principal_id
       AND ts.login_epoch=p_login_epoch
       AND pe.current_epoch=p_login_epoch
       AND ts.state='ACTIVE'
       AND ts.binding_state='ACTIVE'
       AND ts.db_auth_role=session_user
       AND ts.backend_pid=pg_catalog.pg_backend_pid()
       AND ts.backend_started_at=(
         SELECT a.backend_start FROM pg_catalog.pg_stat_activity a
          WHERE a.pid=pg_catalog.pg_backend_pid() AND a.usename=session_user
       )
       AND pg_catalog.current_setting('aiea.session_binding',true)=ts.session_id
       AND clock_timestamp()<ts.expires_at
       AND reg.state='ACTIVE'
  ) THEN
    RAISE EXCEPTION 'trusted session changed' USING ERRCODE='42501';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION app.revoke_trusted_session(
  p_session_id text,
  p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_principal_id text;
  v_role text;
BEGIN
  IF session_user<>'elevator_identity_broker' THEN
    RAISE EXCEPTION 'broker role required' USING ERRCODE='42501';
  END IF;
  SELECT ts.principal_id,ts.db_auth_role INTO v_principal_id,v_role
    FROM app.trusted_session ts WHERE ts.session_id=p_session_id;
  IF v_principal_id IS NULL THEN
    RAISE EXCEPTION 'session missing' USING ERRCODE='23503';
  END IF;
  PERFORM 1 FROM app.principal_epoch pe
   WHERE pe.principal_id=v_principal_id FOR UPDATE;
  PERFORM 1 FROM app.trusted_session ts
   WHERE ts.session_id=p_session_id FOR UPDATE;
  UPDATE app.authority_grant
     SET revoked_at=clock_timestamp(),revocation_reason=p_reason
   WHERE session_id=p_session_id AND revoked_at IS NULL;
  UPDATE app.trusted_session
     SET state='REVOKED',binding_state='REVOKED',
         revoked_at=clock_timestamp(),revocation_reason=p_reason
   WHERE session_id=p_session_id AND state='ACTIVE';
  UPDATE app.session_role_registry
     SET state='RETIRED',retired_at=clock_timestamp()
   WHERE role_name=v_role AND session_id=p_session_id;
  INSERT INTO app.session_audit(id,session_id,action,actor_role,reason,occurred_at)
  SELECT gen_random_uuid()::text,p_session_id,'REVOKE',session_user,p_reason,clock_timestamp()
  WHERE EXISTS (SELECT 1 FROM app.trusted_session WHERE session_id=p_session_id);
END
$$;

CREATE OR REPLACE FUNCTION app.advance_principal_epoch(
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
  IF session_user<>'elevator_identity_broker' THEN
    RAISE EXCEPTION 'broker role required' USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM app.principal_epoch pe WHERE pe.principal_id=p_principal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'principal epoch missing' USING ERRCODE='23503';
  END IF;
  FOR v_session_id IN
    SELECT ts.session_id FROM app.trusted_session ts
     WHERE ts.principal_id=p_principal_id
     ORDER BY ts.session_id FOR UPDATE
  LOOP
    UPDATE app.authority_grant
       SET revoked_at=clock_timestamp(),revocation_reason=p_reason
     WHERE session_id=v_session_id AND revoked_at IS NULL;
    UPDATE app.trusted_session
       SET state='REVOKED',binding_state='REVOKED',
           revoked_at=clock_timestamp(),revocation_reason=p_reason
     WHERE session_id=v_session_id;
    UPDATE app.session_role_registry
       SET state='RETIRED',retired_at=clock_timestamp()
     WHERE session_id=v_session_id;
    INSERT INTO app.session_audit(id,session_id,action,actor_role,reason,occurred_at)
    VALUES(gen_random_uuid()::text,v_session_id,'REVOKE',session_user,p_reason,clock_timestamp());
  END LOOP;
  UPDATE app.principal_epoch
     SET current_epoch=current_epoch+1,updated_at=clock_timestamp()
   WHERE principal_id=p_principal_id RETURNING current_epoch INTO v_next;
  RETURN v_next;
END
$$;

CREATE OR REPLACE FUNCTION app_private.claim_command_request(
  p_operation text,
  p_request_id text,
  p_request_hash text,
  p_scope_key text,
  p_principal_id text,
  p_session_id text,
  p_result_type text
) RETURNS TABLE (replay boolean,result_id text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  r app.command_request%ROWTYPE;
  v_inserted boolean;
BEGIN
  INSERT INTO app.command_request(
    operation,request_id,request_hash,scope_key,principal_id,session_id,
    result_type,state,claimed_at
  ) VALUES(
    p_operation,p_request_id,p_request_hash,p_scope_key,p_principal_id,p_session_id,
    p_result_type,'CLAIMED',clock_timestamp()
  )
  ON CONFLICT (operation,request_id) DO NOTHING
  RETURNING true INTO v_inserted;
  IF v_inserted THEN
    RETURN QUERY SELECT false,NULL::text;
    RETURN;
  END IF;
  SELECT * INTO STRICT r FROM app.command_request
   WHERE operation=p_operation AND request_id=p_request_id
   FOR UPDATE;
  IF r.request_hash<>p_request_hash
     OR r.scope_key<>p_scope_key
     OR r.principal_id<>p_principal_id
     OR r.result_type<>p_result_type THEN
    RAISE EXCEPTION 'request id reused with different payload/scope' USING ERRCODE='40001';
  END IF;
  IF r.state<>'COMPLETED' THEN
    RAISE EXCEPTION 'request already in progress' USING ERRCODE='40001';
  END IF;
  RETURN QUERY SELECT true,r.result_id;
END
$$;

CREATE OR REPLACE FUNCTION app_private.complete_command_request(
  p_operation text,
  p_request_id text,
  p_result_id text
) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  UPDATE app.command_request
     SET state='COMPLETED',result_id=p_result_id,completed_at=clock_timestamp()
   WHERE operation=p_operation AND request_id=p_request_id AND state='CLAIMED';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'request completion CAS failed' USING ERRCODE='40001';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION app.issue_authority_grant(
  p_grant_id text,
  p_session_id text,
  p_capability text,
  p_project_id text,
  p_policy_id text,
  p_policy_revision_id text,
  p_subject_principal_id text,
  p_valid_until timestamptz
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  admin_grant text;
  target app.trusted_session%ROWTYPE;
  v_is_audit boolean;
BEGIN
  v_is_audit := p_capability IN ('SESSION_AUDIT','AUTHORITY_AUDIT');
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT target FROM app.trusted_session
   WHERE session_id=p_session_id
     AND state='ACTIVE'
     AND binding_state='ACTIVE';
  IF v_is_audit AND p_subject_principal_id IS NULL THEN
    RAISE EXCEPTION 'audit grant requires subject principal scope' USING ERRCODE='42501';
  END IF;
  IF NOT v_is_audit AND p_subject_principal_id IS NOT NULL THEN
    RAISE EXCEPTION 'non-audit grant cannot carry subject scope' USING ERRCODE='42501';
  END IF;
  IF p_policy_revision_id IS NOT NULL AND p_policy_id IS NULL THEN
    RAISE EXCEPTION 'policy revision requires policy scope' USING ERRCODE='22023';
  END IF;
  IF p_policy_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM app.policy_revision pr
     WHERE pr.policy_id=p_policy_id
       AND (p_policy_revision_id IS NULL OR pr.id=p_policy_revision_id)
  ) THEN
    RAISE EXCEPTION 'grant policy scope mismatch' USING ERRCODE='23514';
  END IF;
  admin_grant := app_private.lock_authority_grant(
    s.session_id,s.principal_id,'AUTHORITY_ISSUE',p_project_id,NULL,NULL,p_subject_principal_id
  );
  PERFORM 1 FROM app.trusted_session ts
   WHERE ts.session_id=p_session_id FOR SHARE;
  INSERT INTO app.authority_grant(
    id,principal_id,session_id,subject_principal_id,object_scope,
    authority_code,project_id,policy_id,policy_revision_id,
    valid_from,valid_until,created_at
  ) VALUES(
    p_grant_id,target.principal_id,p_session_id,p_subject_principal_id,
    CASE
      WHEN v_is_audit THEN 'PRINCIPAL'
      WHEN p_project_id IS NOT NULL THEN 'PROJECT'
      WHEN p_policy_id IS NOT NULL THEN 'POLICY'
      ELSE 'GLOBAL'
    END,
    p_capability,p_project_id,p_policy_id,p_policy_revision_id,
    clock_timestamp(),p_valid_until,clock_timestamp()
  );
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
END
$$;

CREATE OR REPLACE FUNCTION app.revoke_authority_grant(
  p_grant_id text,
  p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  target app.authority_grant%ROWTYPE;
  admin_grant text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  admin_grant := app_private.lock_authority_grant(
    s.session_id,s.principal_id,'AUTHORITY_REVOKE',
    (SELECT g.project_id FROM app.authority_grant g WHERE g.id=p_grant_id),
    (SELECT g.policy_id FROM app.authority_grant g WHERE g.id=p_grant_id),
    (SELECT g.policy_revision_id FROM app.authority_grant g WHERE g.id=p_grant_id),
    (SELECT g.subject_principal_id FROM app.authority_grant g WHERE g.id=p_grant_id)
  );
  PERFORM 1 FROM app.authority_grant g WHERE g.id=p_grant_id FOR UPDATE;
  UPDATE app.authority_grant
     SET revoked_at=clock_timestamp(),revocation_reason=p_reason
   WHERE id=p_grant_id AND revoked_at IS NULL;
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
END
$$;

CREATE OR REPLACE FUNCTION app.create_selection_run(
  p_selection_run_id text,
  p_case_id text,
  p_rule_set_revision_id text,
  p_expected_case_version bigint,
  p_request_id text,
  p_request_key text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  c app.sales_case%ROWTYPE;
  rs app.rule_set_revision%ROWTYPE;
  v_grant_id text;
  v_hash text;
  v_replay boolean;
  v_result text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT c FROM app.sales_case WHERE id=p_case_id;
  v_grant_id := app_private.lock_authority_grant(
    s.session_id,s.principal_id,'SELECTION_WRITE',c.project_id,NULL,NULL,NULL
  );
  SELECT * INTO STRICT c FROM app.sales_case WHERE id=p_case_id FOR SHARE;
  IF c.mutation_version<>p_expected_case_version THEN
    RAISE EXCEPTION 'case version conflict' USING ERRCODE='40001';
  END IF;
  SELECT * INTO STRICT rs FROM app.rule_set_revision
   WHERE id=p_rule_set_revision_id AND approved FOR SHARE;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','SELECTION_CREATE','runId',p_selection_run_id,'caseId',p_case_id,
    'ruleSetRevisionId',p_rule_set_revision_id,
    'expectedCaseVersion',p_expected_case_version,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'SELECTION_CREATE',p_request_id,v_hash,p_selection_run_id,
    s.principal_id,s.session_id,'SELECTION_RUN'
  );
  IF v_replay THEN
    PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
    RETURN v_result;
  END IF;
  INSERT INTO app.selection_run(
    id,case_id,project_id,conversation_id,requirement_id,
    requirement_version_id,installation_scenario,rule_set_revision_id,
    rule_set_content_digest,state,mutation_version,created_at
  ) VALUES(
    p_selection_run_id,c.id,c.project_id,c.conversation_id,c.requirement_id,
    c.requirement_version_id,c.installation_scenario,rs.id,rs.content_digest,
    'RUNNING',1,clock_timestamp()
  );
  INSERT INTO app.selection_run_event(
    id,selection_run_id,event_sequence,command,actor_principal_id,
    actor_session_id,actor_authority_grant_id,request_id,request_hash,occurred_at
  ) VALUES(
    gen_random_uuid()::text,p_selection_run_id,1,'CREATE',s.principal_id,
    s.session_id,v_grant_id,p_request_id,v_hash,clock_timestamp()
  );
  PERFORM app_private.complete_command_request('SELECTION_CREATE',p_request_id,p_selection_run_id);
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
  RETURN p_selection_run_id;
END
$$;

CREATE OR REPLACE FUNCTION app.add_selection_candidate(
  p_candidate_id text,
  p_selection_run_id text,
  p_product_revision_id text,
  p_specification_revision_id text,
  p_request_id text,
  p_request_key text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  run app.selection_run%ROWTYPE;
  pr app.product_revision%ROWTYPE;
  sr app.specification_revision%ROWTYPE;
  v_grant_id text;
  v_hash text;
  v_replay boolean;
  v_result text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT run FROM app.selection_run WHERE id=p_selection_run_id;
  v_grant_id := app_private.lock_authority_grant(
    s.session_id,s.principal_id,'SELECTION_WRITE',run.project_id,NULL,NULL,NULL
  );
  SELECT * INTO STRICT run FROM app.selection_run
   WHERE id=p_selection_run_id FOR UPDATE;
  IF run.state<>'RUNNING' THEN
    RAISE EXCEPTION 'selection run is not writable' USING ERRCODE='23514';
  END IF;
  SELECT * INTO STRICT pr FROM app.product_revision
   WHERE id=p_product_revision_id FOR SHARE;
  SELECT * INTO STRICT sr FROM app.specification_revision
   WHERE id=p_specification_revision_id
     AND product_id=pr.product_id
     AND product_revision_id=pr.id
   FOR SHARE;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','SELECTION_ADD_CANDIDATE','runId',run.id,'candidateId',p_candidate_id,
    'productRevisionId',pr.id,'specificationRevisionId',sr.id,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'SELECTION_ADD_CANDIDATE',p_request_id,v_hash,run.id,
    s.principal_id,s.session_id,'SELECTION_CANDIDATE'
  );
  IF v_replay THEN
    PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
    RETURN v_result;
  END IF;
  INSERT INTO app.selection_candidate(
    id,selection_run_id,project_id,conversation_id,requirement_id,
    requirement_version_id,installation_scenario,rule_set_revision_id,
    rule_set_content_digest,product_id,product_revision_id,product_revision_digest,
    specification_revision_id,specification_revision_digest,created_at
  ) VALUES(
    p_candidate_id,run.id,run.project_id,run.conversation_id,run.requirement_id,
    run.requirement_version_id,run.installation_scenario,run.rule_set_revision_id,
    run.rule_set_content_digest,pr.product_id,pr.id,pr.content_digest,
    sr.id,sr.content_digest,clock_timestamp()
  );
  INSERT INTO app.selection_run_event(
    id,selection_run_id,event_sequence,command,actor_principal_id,
    actor_session_id,actor_authority_grant_id,request_id,request_hash,occurred_at
  )
  SELECT gen_random_uuid()::text,run.id,COALESCE(max(event_sequence),0)+1,
         'ADD_CANDIDATE',s.principal_id,s.session_id,v_grant_id,
         p_request_id,v_hash,clock_timestamp()
    FROM app.selection_run_event WHERE selection_run_id=run.id;
  PERFORM app_private.complete_command_request(
    'SELECTION_ADD_CANDIDATE',p_request_id,p_candidate_id
  );
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
  RETURN p_candidate_id;
END
$$;

CREATE OR REPLACE FUNCTION app.set_selection_candidate_price(
  p_candidate_id text,
  p_price_revision_id text,
  p_request_id text,
  p_request_key text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  c app.selection_candidate%ROWTYPE;
  pr app.price_revision%ROWTYPE;
  v_grant_id text;
  v_hash text;
  v_replay boolean;
  v_result text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT c FROM app.selection_candidate WHERE id=p_candidate_id;
  v_grant_id := app_private.lock_authority_grant(
    s.session_id,s.principal_id,'SELECTION_WRITE',c.project_id,NULL,NULL,NULL
  );
  PERFORM 1 FROM app.selection_run r
   WHERE r.id=c.selection_run_id AND r.state='RUNNING' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'selection run is not writable' USING ERRCODE='23514';
  END IF;
  SELECT * INTO STRICT pr FROM app.price_revision
   WHERE id=p_price_revision_id
     AND product_id=c.product_id
     AND product_revision_id=c.product_revision_id
     AND specification_revision_id=c.specification_revision_id
   FOR SHARE;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','SELECTION_SET_PRICE','candidateId',c.id,
    'priceRevisionId',pr.id,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'SELECTION_SET_PRICE',p_request_id,v_hash,c.id,
    s.principal_id,s.session_id,'SELECTION_PRICE'
  );
  IF v_replay THEN
    PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
    RETURN v_result;
  END IF;
  INSERT INTO app.selection_candidate_price(
    candidate_id,product_id,product_revision_id,
    specification_revision_id,price_revision_id,source_revision_id
  ) VALUES(c.id,c.product_id,c.product_revision_id,c.specification_revision_id,pr.id,pr.source_revision_id);
  PERFORM app_private.complete_command_request('SELECTION_SET_PRICE',p_request_id,c.id);
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
  RETURN c.id;
END
$$;

CREATE OR REPLACE FUNCTION app.set_selection_candidate_parameter(
  p_candidate_id text,
  p_catalog_parameter_revision_id text,
  p_request_id text,
  p_request_key text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  c app.selection_candidate%ROWTYPE;
  cp app.catalog_parameter_revision%ROWTYPE;
  v_grant_id text;
  v_hash text;
  v_replay boolean;
  v_result text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT c FROM app.selection_candidate WHERE id=p_candidate_id;
  v_grant_id := app_private.lock_authority_grant(
    s.session_id,s.principal_id,'SELECTION_WRITE',c.project_id,NULL,NULL,NULL
  );
  PERFORM 1 FROM app.selection_run r
   WHERE r.id=c.selection_run_id AND r.state='RUNNING' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'selection run is not writable' USING ERRCODE='23514';
  END IF;
  SELECT * INTO STRICT cp FROM app.catalog_parameter_revision
   WHERE id=p_catalog_parameter_revision_id
     AND product_id=c.product_id
     AND product_revision_id=c.product_revision_id
   FOR SHARE;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','SELECTION_SET_PARAMETER','candidateId',c.id,
    'catalogParameterRevisionId',cp.id,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'SELECTION_SET_PARAMETER',p_request_id,v_hash,c.id,
    s.principal_id,s.session_id,'SELECTION_PARAMETER'
  );
  IF v_replay THEN
    PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
    RETURN v_result;
  END IF;
  INSERT INTO app.selection_candidate_parameter(
    candidate_id,product_id,product_revision_id,parameter_key,
    catalog_parameter_revision_id,value_type,source_revision_id,value_json,unit
  ) VALUES(
    c.id,c.product_id,c.product_revision_id,cp.parameter_key,
    cp.id,cp.value_type,cp.source_revision_id,cp.value_json,cp.unit
  );
  PERFORM app_private.complete_command_request('SELECTION_SET_PARAMETER',p_request_id,c.id);
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
  RETURN c.id;
END
$$;

CREATE OR REPLACE FUNCTION app_private.append_selection_run_event(
  p_selection_run_id text,
  p_command text,
  p_principal_id text,
  p_session_id text,
  p_authority_grant_id text,
  p_request_id text,
  p_request_hash text
) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_sequence bigint;
BEGIN
  SELECT COALESCE(max(event_sequence),0)+1 INTO v_sequence
    FROM app.selection_run_event
   WHERE selection_run_id=p_selection_run_id;
  INSERT INTO app.selection_run_event(
    id,selection_run_id,event_sequence,command,actor_principal_id,
    actor_session_id,actor_authority_grant_id,request_id,request_hash,occurred_at
  ) VALUES(
    gen_random_uuid()::text,p_selection_run_id,v_sequence,p_command,
    p_principal_id,p_session_id,p_authority_grant_id,p_request_id,
    p_request_hash,clock_timestamp()
  );
END
$$;

CREATE OR REPLACE FUNCTION app.complete_selection_candidate_result(
  p_result_id text,
  p_candidate_id text,
  p_technical_status text,
  p_commercial_status text,
  p_trust_status text,
  p_professional_review_status text,
  p_overall_status text,
  p_request_id text,
  p_request_key text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  c app.selection_candidate%ROWTYPE;
  run app.selection_run%ROWTYPE;
  v_grant_id text;
  v_hash text;
  v_replay boolean;
  v_result text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT c FROM app.selection_candidate WHERE id=p_candidate_id;
  SELECT * INTO STRICT run FROM app.selection_run WHERE id=c.selection_run_id;
  v_grant_id := app_private.lock_authority_grant(
    s.session_id,s.principal_id,'SELECTION_WRITE',run.project_id,NULL,NULL,NULL
  );
  SELECT * INTO STRICT run FROM app.selection_run
   WHERE id=c.selection_run_id AND state='RUNNING' FOR UPDATE;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','SELECTION_COMPLETE_RESULT','resultId',p_result_id,
    'candidateId',c.id,'technicalStatus',p_technical_status,
    'commercialStatus',p_commercial_status,'trustStatus',p_trust_status,
    'professionalReviewStatus',p_professional_review_status,
    'overallStatus',p_overall_status,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'SELECTION_COMPLETE_RESULT',p_request_id,v_hash,c.id,
    s.principal_id,s.session_id,'SELECTION_RESULT'
  );
  IF v_replay THEN
    PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
    RETURN v_result;
  END IF;
  INSERT INTO app.selection_candidate_result(
    id,candidate_id,selection_run_id,project_id,conversation_id,
    requirement_id,requirement_version_id,installation_scenario,
    rule_set_revision_id,rule_set_content_digest,product_id,
    product_revision_id,product_revision_digest,
    specification_revision_id,specification_revision_digest,
    technical_status,commercial_status,trust_status,
    professional_review_status,overall_status,created_at
  ) VALUES(
    p_result_id,c.id,c.selection_run_id,c.project_id,c.conversation_id,
    c.requirement_id,c.requirement_version_id,c.installation_scenario,
    c.rule_set_revision_id,c.rule_set_content_digest,c.product_id,
    c.product_revision_id,c.product_revision_digest,
    c.specification_revision_id,c.specification_revision_digest,
    p_technical_status,p_commercial_status,p_trust_status,
    p_professional_review_status,p_overall_status,clock_timestamp()
  );
  PERFORM app_private.append_selection_run_event(
    c.selection_run_id,'ADD_RESULT',s.principal_id,s.session_id,
    v_grant_id,p_request_id,v_hash
  );
  PERFORM app_private.complete_command_request(
    'SELECTION_COMPLETE_RESULT',p_request_id,p_result_id
  );
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
  RETURN p_result_id;
END
$$;

CREATE OR REPLACE FUNCTION app.record_selection_requirement_field(
  p_selection_run_id text,
  p_requirement_version_id text,
  p_field_key text,
  p_value_json jsonb,
  p_value_type text,
  p_unit text,
  p_field_status text,
  p_source_kind text,
  p_source_entity_type text,
  p_source_entity_id text,
  p_source_aux_is_null boolean,
  p_source_aux_text text,
  p_source_value_id text,
  p_source_revision_id text,
  p_request_id text,
  p_request_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  run app.selection_run%ROWTYPE;
  v_grant_id text;
  v_hash text;
  v_replay boolean;
  v_result text;
  v_aux text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT run FROM app.selection_run
   WHERE id=p_selection_run_id AND state='RUNNING';
  v_grant_id := app_private.lock_authority_grant(
    s.session_id,s.principal_id,'SELECTION_WRITE',run.project_id,NULL,NULL,NULL
  );
  PERFORM 1 FROM app.selection_run r
   WHERE r.id=p_selection_run_id AND r.state='RUNNING' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'selection run is not writable' USING ERRCODE='23514';
  END IF;
  IF run.requirement_version_id<>p_requirement_version_id THEN
    RAISE EXCEPTION 'requirement context mismatch' USING ERRCODE='23514';
  END IF;
  IF p_source_aux_is_null THEN
    IF p_source_aux_text IS NOT NULL THEN
      RAISE EXCEPTION 'source auxiliary NULL mismatch' USING ERRCODE='22023';
    END IF;
    v_aux:=NULL;
  ELSE
    IF p_source_aux_text IS NULL THEN
      RAISE EXCEPTION 'source auxiliary NULL mismatch' USING ERRCODE='22023';
    END IF;
    v_aux:=normalize(p_source_aux_text,NFC);
  END IF;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','SELECTION_ADD_REQUIREMENT_FIELD','runId',run.id,
    'requirementVersionId',p_requirement_version_id,'fieldKey',p_field_key,
    'value',p_value_json,'valueType',p_value_type,'unit',p_unit,
    'fieldStatus',p_field_status,'sourceKind',p_source_kind,
    'sourceEntityType',p_source_entity_type,'sourceEntityId',p_source_entity_id,
    'sourceAuxIsNull',p_source_aux_is_null,'sourceAuxText',v_aux,
    'sourceValueId',p_source_value_id,'sourceRevisionId',p_source_revision_id,
    'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'SELECTION_ADD_REQUIREMENT_FIELD',p_request_id,v_hash,run.id,
    s.principal_id,s.session_id,'SELECTION_REQUIREMENT_FIELD'
  );
  IF v_replay THEN RETURN; END IF;
  INSERT INTO app.selection_requirement_field(
    selection_run_id,requirement_version_id,field_key,value_json,value_type,
    unit,field_status,source_kind,source_entity_type,source_entity_id,
    source_aux_is_null,source_aux_text,source_value_id,source_revision_id
  ) VALUES(
    run.id,p_requirement_version_id,p_field_key,p_value_json,p_value_type,
    p_unit,p_field_status,p_source_kind,p_source_entity_type,p_source_entity_id,
    p_source_aux_is_null,v_aux,p_source_value_id,p_source_revision_id
  );
  PERFORM app_private.append_selection_run_event(
    run.id,'ADD_REQUIREMENT_FIELD',s.principal_id,s.session_id,
    v_grant_id,p_request_id,v_hash
  );
  PERFORM app_private.complete_command_request(
    'SELECTION_ADD_REQUIREMENT_FIELD',p_request_id,run.id||':'||p_requirement_version_id||':'||p_field_key
  );
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
END
$$;

CREATE OR REPLACE FUNCTION app.record_selection_source_result(
  p_selection_run_id text,
  p_source_revision_id text,
  p_request_id text,
  p_request_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  run app.selection_run%ROWTYPE;
  src app.catalog_source_revision%ROWTYPE;
  v_grant_id text;
  v_hash text;
  v_replay boolean;
  v_result text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT run FROM app.selection_run
   WHERE id=p_selection_run_id AND state='RUNNING';
  v_grant_id := app_private.lock_authority_grant(
    s.session_id,s.principal_id,'SELECTION_WRITE',run.project_id,NULL,NULL,NULL
  );
  PERFORM 1 FROM app.selection_run r
   WHERE r.id=p_selection_run_id AND r.state='RUNNING' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'selection run is not writable' USING ERRCODE='23514';
  END IF;
  SELECT * INTO STRICT src FROM app.catalog_source_revision
   WHERE id=p_source_revision_id FOR SHARE;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','SELECTION_ADD_SOURCE','runId',run.id,
    'sourceRevisionId',src.id,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'SELECTION_ADD_SOURCE',p_request_id,v_hash,run.id,
    s.principal_id,s.session_id,'SELECTION_SOURCE'
  );
  IF v_replay THEN RETURN; END IF;
  INSERT INTO app.selection_source_result(
    selection_run_id,source_revision_id,evidence_object_id,raw_content_digest,
    source_kind,source_entity_type,source_entity_id,source_aux_is_null,
    source_aux_text,captured_at
  ) VALUES(
    run.id,src.id,src.evidence_object_id,src.raw_content_digest,
    src.source_kind,'SOURCE_REVISION',src.id,true,NULL,src.captured_at
  );
  PERFORM app_private.append_selection_run_event(
    run.id,'ADD_SOURCE',s.principal_id,s.session_id,v_grant_id,p_request_id,v_hash
  );
  PERFORM app_private.complete_command_request(
    'SELECTION_ADD_SOURCE',p_request_id,run.id||':'||src.id
  );
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
END
$$;

CREATE OR REPLACE FUNCTION app.record_selection_catalog_review_result(
  p_selection_run_id text,
  p_catalog_review_id text,
  p_target_revision_id text,
  p_source_revision_id text,
  p_policy_revision_id text,
  p_decision text,
  p_reviewed_at timestamptz,
  p_request_id text,
  p_request_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  run app.selection_run%ROWTYPE;
  v_grant_id text;
  v_hash text;
  v_replay boolean;
  v_result text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT run FROM app.selection_run
   WHERE id=p_selection_run_id AND state='RUNNING';
  v_grant_id := app_private.lock_authority_grant(
    s.session_id,s.principal_id,'SELECTION_WRITE',run.project_id,NULL,NULL,NULL
  );
  PERFORM 1 FROM app.selection_run r
   WHERE r.id=p_selection_run_id AND r.state='RUNNING' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'selection run is not writable' USING ERRCODE='23514';
  END IF;
  PERFORM 1 FROM app.catalog_source_revision WHERE id=p_source_revision_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'source revision missing' USING ERRCODE='23503'; END IF;
  PERFORM 1 FROM app.policy_revision WHERE id=p_policy_revision_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'policy revision missing' USING ERRCODE='23503'; END IF;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','SELECTION_ADD_CATALOG_REVIEW','runId',run.id,
    'catalogReviewId',p_catalog_review_id,'targetRevisionId',p_target_revision_id,
    'sourceRevisionId',p_source_revision_id,'policyRevisionId',p_policy_revision_id,
    'decision',p_decision,'reviewedAt',p_reviewed_at,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'SELECTION_ADD_CATALOG_REVIEW',p_request_id,v_hash,run.id,
    s.principal_id,s.session_id,'SELECTION_CATALOG_REVIEW'
  );
  IF v_replay THEN RETURN; END IF;
  INSERT INTO app.selection_catalog_review_result(
    selection_run_id,catalog_review_id,target_revision_id,source_revision_id,
    policy_revision_id,decision,reviewed_at
  ) VALUES(
    run.id,p_catalog_review_id,p_target_revision_id,p_source_revision_id,
    p_policy_revision_id,p_decision,p_reviewed_at
  );
  PERFORM app_private.append_selection_run_event(
    run.id,'ADD_CATALOG_REVIEW',s.principal_id,s.session_id,v_grant_id,p_request_id,v_hash
  );
  PERFORM app_private.complete_command_request(
    'SELECTION_ADD_CATALOG_REVIEW',p_request_id,run.id||':'||p_catalog_review_id
  );
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
END
$$;

CREATE OR REPLACE FUNCTION app.record_selection_professional_review_result(
  p_selection_run_id text,
  p_professional_review_event_id text,
  p_professional_review_id text,
  p_event_sequence bigint,
  p_target_revision_id text,
  p_policy_revision_id text,
  p_decision text,
  p_basis_digest text,
  p_occurred_at timestamptz,
  p_request_id text,
  p_request_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  run app.selection_run%ROWTYPE;
  ev app.professional_review_event%ROWTYPE;
  v_grant_id text;
  v_hash text;
  v_replay boolean;
  v_result text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT run FROM app.selection_run
   WHERE id=p_selection_run_id AND state='RUNNING';
  v_grant_id := app_private.lock_authority_grant(
    s.session_id,s.principal_id,'SELECTION_WRITE',run.project_id,NULL,NULL,NULL
  );
  PERFORM 1 FROM app.selection_run r
   WHERE r.id=p_selection_run_id AND r.state='RUNNING' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'selection run is not writable' USING ERRCODE='23514';
  END IF;
  SELECT * INTO STRICT ev FROM app.professional_review_event
   WHERE id=p_professional_review_event_id
     AND review_id=p_professional_review_id
     AND event_sequence=p_event_sequence
     AND policy_revision_id=p_policy_revision_id
   FOR SHARE;
  IF ev.next_state<>'APPROVED' AND p_decision='APPROVED' THEN
    RAISE EXCEPTION 'review event/decision mismatch' USING ERRCODE='23514';
  END IF;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','SELECTION_ADD_PROFESSIONAL_REVIEW','runId',run.id,
    'reviewEventId',ev.id,'reviewId',ev.review_id,'eventSequence',ev.event_sequence,
    'decision',p_decision,'basisDigest',p_basis_digest,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'SELECTION_ADD_PROFESSIONAL_REVIEW',p_request_id,v_hash,run.id,
    s.principal_id,s.session_id,'SELECTION_PROFESSIONAL_REVIEW'
  );
  IF v_replay THEN RETURN; END IF;
  INSERT INTO app.selection_professional_review_result(
    selection_run_id,professional_review_event_id,professional_review_id,
    event_sequence,target_revision_id,policy_revision_id,decision,basis_digest,occurred_at
  ) VALUES(
    run.id,ev.id,ev.review_id,ev.event_sequence,p_target_revision_id,
    ev.policy_revision_id,p_decision,p_basis_digest,p_occurred_at
  );
  PERFORM app_private.append_selection_run_event(
    run.id,'ADD_PROFESSIONAL_REVIEW',s.principal_id,s.session_id,
    v_grant_id,p_request_id,v_hash
  );
  PERFORM app_private.complete_command_request(
    'SELECTION_ADD_PROFESSIONAL_REVIEW',p_request_id,ev.id
  );
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
END
$$;

CREATE OR REPLACE FUNCTION app.record_selection_warning_result(
  p_selection_run_id text,
  p_candidate_id text,
  p_warning_sequence bigint,
  p_warning_code text,
  p_warning_text text,
  p_severity text,
  p_source_warning_id text,
  p_request_id text,
  p_request_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  run app.selection_run%ROWTYPE;
  c app.selection_candidate%ROWTYPE;
  v_grant_id text;
  v_hash text;
  v_replay boolean;
  v_result text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT run FROM app.selection_run
   WHERE id=p_selection_run_id AND state='RUNNING';
  v_grant_id := app_private.lock_authority_grant(
    s.session_id,s.principal_id,'SELECTION_WRITE',run.project_id,NULL,NULL,NULL
  );
  PERFORM 1 FROM app.selection_run r
   WHERE r.id=p_selection_run_id AND r.state='RUNNING' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'selection run is not writable' USING ERRCODE='23514';
  END IF;
  SELECT * INTO STRICT c FROM app.selection_candidate
   WHERE id=p_candidate_id AND selection_run_id=run.id;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','SELECTION_ADD_WARNING','runId',run.id,'candidateId',c.id,
    'warningSequence',p_warning_sequence,'warningCode',p_warning_code,
    'warningText',p_warning_text,'severity',p_severity,
    'sourceWarningId',p_source_warning_id,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'SELECTION_ADD_WARNING',p_request_id,v_hash,run.id,
    s.principal_id,s.session_id,'SELECTION_WARNING'
  );
  IF v_replay THEN RETURN; END IF;
  INSERT INTO app.selection_warning_result(
    selection_run_id,candidate_id,warning_sequence,warning_code,
    warning_text,severity,source_warning_id
  ) VALUES(
    run.id,c.id,p_warning_sequence,p_warning_code,
    p_warning_text,p_severity,p_source_warning_id
  );
  PERFORM app_private.append_selection_run_event(
    run.id,'ADD_WARNING',s.principal_id,s.session_id,v_grant_id,p_request_id,v_hash
  );
  PERFORM app_private.complete_command_request(
    'SELECTION_ADD_WARNING',p_request_id,run.id||':'||c.id||':'||p_warning_sequence::text
  );
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
END
$$;

CREATE OR REPLACE FUNCTION app.record_selection_missing_field_result(
  p_selection_run_id text,
  p_candidate_id text,
  p_field_key text,
  p_reason text,
  p_impact_scope text,
  p_request_id text,
  p_request_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  run app.selection_run%ROWTYPE;
  c app.selection_candidate%ROWTYPE;
  v_grant_id text;
  v_hash text;
  v_replay boolean;
  v_result text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT run FROM app.selection_run
   WHERE id=p_selection_run_id AND state='RUNNING';
  v_grant_id := app_private.lock_authority_grant(
    s.session_id,s.principal_id,'SELECTION_WRITE',run.project_id,NULL,NULL,NULL
  );
  PERFORM 1 FROM app.selection_run r
   WHERE r.id=p_selection_run_id AND r.state='RUNNING' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'selection run is not writable' USING ERRCODE='23514';
  END IF;
  SELECT * INTO STRICT c FROM app.selection_candidate
   WHERE id=p_candidate_id AND selection_run_id=run.id;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','SELECTION_ADD_MISSING_FIELD','runId',run.id,
    'candidateId',c.id,'fieldKey',p_field_key,'reason',p_reason,
    'impactScope',p_impact_scope,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'SELECTION_ADD_MISSING_FIELD',p_request_id,v_hash,run.id,
    s.principal_id,s.session_id,'SELECTION_MISSING_FIELD'
  );
  IF v_replay THEN RETURN; END IF;
  INSERT INTO app.selection_missing_field_result(
    selection_run_id,candidate_id,field_key,reason,impact_scope
  ) VALUES(run.id,c.id,p_field_key,p_reason,p_impact_scope);
  PERFORM app_private.append_selection_run_event(
    run.id,'ADD_MISSING_FIELD',s.principal_id,s.session_id,v_grant_id,p_request_id,v_hash
  );
  PERFORM app_private.complete_command_request(
    'SELECTION_ADD_MISSING_FIELD',p_request_id,run.id||':'||c.id||':'||p_field_key
  );
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
END
$$;

CREATE OR REPLACE FUNCTION app.create_professional_review(
  p_review_id text,
  p_project_id text,
  p_conversation_id text,
  p_requirement_id text,
  p_requirement_version_id text,
  p_installation_scenario text,
  p_candidate_id text,
  p_policy_id text,
  p_policy_revision_id text,
  p_request_id text,
  p_request_key text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  candidate app.selection_candidate%ROWTYPE;
  v_grant_id text;
  v_hash text;
  v_replay boolean;
  v_result text;
  v_event_id text := gen_random_uuid()::text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT candidate FROM app.selection_candidate
   WHERE id=p_candidate_id
     AND project_id=p_project_id
     AND conversation_id=p_conversation_id
     AND requirement_id=p_requirement_id
     AND requirement_version_id=p_requirement_version_id
     AND installation_scenario=p_installation_scenario;
  IF NOT EXISTS (
    SELECT 1 FROM app.policy_revision pr
     WHERE pr.id=p_policy_revision_id AND pr.policy_id=p_policy_id
  ) THEN
    RAISE EXCEPTION 'review policy/revision mismatch' USING ERRCODE='23514';
  END IF;
  v_grant_id := app_private.lock_authority_grant(
    s.session_id,s.principal_id,'PROFESSIONAL_REVIEW',
    p_project_id,p_policy_id,p_policy_revision_id,NULL
  );
  PERFORM 1 FROM app.selection_candidate c
   WHERE c.id=p_candidate_id
     AND c.project_id=p_project_id
     AND c.conversation_id=p_conversation_id
     AND c.requirement_id=p_requirement_id
     AND c.requirement_version_id=p_requirement_version_id
     AND c.installation_scenario=p_installation_scenario
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'review candidate binding mismatch' USING ERRCODE='23514';
  END IF;
  PERFORM 1 FROM app.policy_current pc
   WHERE pc.policy_id=p_policy_id AND pc.revision_id=p_policy_revision_id
   FOR SHARE;
  IF NOT app.policy_is_effective(p_policy_revision_id) THEN
    RAISE EXCEPTION 'policy not effective' USING ERRCODE='23514';
  END IF;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','PROFESSIONAL_REVIEW_CREATE','reviewId',p_review_id,
    'projectId',p_project_id,'candidateId',p_candidate_id,
    'policyId',p_policy_id,'policyRevisionId',p_policy_revision_id,
    'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'PROFESSIONAL_REVIEW_CREATE',p_request_id,v_hash,p_review_id,
    s.principal_id,s.session_id,'PROFESSIONAL_REVIEW'
  );
  IF v_replay THEN
    PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
    RETURN v_result;
  END IF;
  INSERT INTO app.professional_review(
    id,project_id,conversation_id,requirement_id,requirement_version_id,
    installation_scenario,candidate_id,policy_id,policy_revision_id,
    created_by_principal_id,state,state_version,mutation_version,created_at
  ) VALUES(
    p_review_id,p_project_id,p_conversation_id,p_requirement_id,
    p_requirement_version_id,p_installation_scenario,p_candidate_id,
    p_policy_id,p_policy_revision_id,s.principal_id,'CREATED',1,1,clock_timestamp()
  );
  INSERT INTO app.professional_review_event(
    id,review_id,project_id,conversation_id,requirement_id,
    requirement_version_id,installation_scenario,candidate_id,policy_id,
    policy_revision_id,event_sequence,state_version,previous_state,command,
    next_state,actor_principal_id,actor_session_id,actor_authority_grant_id,
    request_id,request_hash,basis_digest,reason,occurred_at
  ) VALUES(
    v_event_id,p_review_id,p_project_id,p_conversation_id,p_requirement_id,
    p_requirement_version_id,p_installation_scenario,p_candidate_id,p_policy_id,
    p_policy_revision_id,1,1,NULL,'CREATE','CREATED',s.principal_id,
    s.session_id,v_grant_id,p_request_id,v_hash,NULL,'review created',clock_timestamp()
  );
  INSERT INTO app.review_audit(id,review_id,event_id,action,actor_principal_id,occurred_at)
  VALUES(gen_random_uuid()::text,p_review_id,v_event_id,'CREATE',s.principal_id,clock_timestamp());
  PERFORM app_private.complete_command_request(
    'PROFESSIONAL_REVIEW_CREATE',p_request_id,p_review_id
  );
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
  RETURN p_review_id;
END
$$;

CREATE OR REPLACE FUNCTION app.seal_selection_run(
  p_selection_run_id text,
  p_expected_mutation_version bigint,
  p_request_id text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  run app.selection_run%ROWTYPE;
  v_grant_id text;
  v_request_hash text;
  v_replay boolean;
  v_result text;
  v_candidate_count integer;
  v_result_count integer;
  v_digest text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT run FROM app.selection_run
   WHERE id=p_selection_run_id;
  v_grant_id := app_private.lock_authority_grant(
    s.session_id,s.principal_id,'SELECTION_SEAL',run.project_id,NULL,NULL,NULL
  );
  PERFORM 1 FROM app.selection_run r
   WHERE r.id=p_selection_run_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'selection run missing' USING ERRCODE='23503';
  END IF;
  v_request_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','SELECTION_SEAL','runId',run.id,
    'expectedMutationVersion',p_expected_mutation_version
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'SELECTION_SEAL',p_request_id,v_request_hash,run.id,
    s.principal_id,s.session_id,'SELECTION_RUN_SEAL'
  );
  IF v_replay THEN
    PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
    RETURN v_result;
  END IF;
  IF run.state<>'RUNNING' OR run.mutation_version<>p_expected_mutation_version THEN
    RAISE EXCEPTION 'selection seal CAS failed' USING ERRCODE='40001';
  END IF;
  SELECT count(*) INTO v_candidate_count
    FROM app.selection_candidate c WHERE c.selection_run_id=run.id;
  SELECT count(*) INTO v_result_count
    FROM app.selection_candidate_result r WHERE r.selection_run_id=run.id;
  IF v_candidate_count=0 OR v_result_count<>v_candidate_count THEN
    RAISE EXCEPTION 'selection result incomplete' USING ERRCODE='23514';
  END IF;
  v_digest := app.selection_result_digest(run.id);
  UPDATE app.selection_run
     SET state='SEALED',mutation_version=mutation_version+1
   WHERE id=run.id AND state='RUNNING'
     AND mutation_version=p_expected_mutation_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'selection seal CAS failed' USING ERRCODE='40001';
  END IF;
  INSERT INTO app.selection_run_seal(
    selection_run_id,case_id,project_id,conversation_id,requirement_id,
    requirement_version_id,installation_scenario,rule_set_revision_id,
    rule_set_content_digest,candidate_count,result_digest,sealed_at
  ) VALUES(
    run.id,run.case_id,run.project_id,run.conversation_id,run.requirement_id,
    run.requirement_version_id,run.installation_scenario,
    run.rule_set_revision_id,run.rule_set_content_digest,
    v_candidate_count,v_digest,clock_timestamp()
  );
  PERFORM app_private.append_selection_run_event(
    run.id,'SEAL',s.principal_id,s.session_id,v_grant_id,
    p_request_id,v_request_hash
  );
  PERFORM app_private.complete_command_request('SELECTION_SEAL',p_request_id,v_digest);
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
  RETURN v_digest;
END
$$;

CREATE OR REPLACE FUNCTION app.create_policy_revision(
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
  v_grant_id text;
  v_revision_id text := gen_random_uuid()::text;
  v_event_id text := gen_random_uuid()::text;
  v_content bytea;
  v_digest text;
  v_request_hash text;
  v_scope text;
  v_replay boolean;
  v_result text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  v_grant_id := app_private.lock_authority_grant(
    s.session_id,s.principal_id,'POLICY_AUTHOR',p_scope_project_id,NULL,NULL,NULL
  );
  IF p_content IS NULL OR p_policy_id IS NULL OR p_policy_kind IS NULL
     OR p_revision_number IS NULL OR p_request_id IS NULL OR p_request_key IS NULL THEN
    RAISE EXCEPTION 'policy create input incomplete' USING ERRCODE='22004';
  END IF;
  v_content := convert_to(p_content::jsonb::text,'UTF8');
  v_digest := app.policy_digest(p_content);
  IF p_supersedes_revision_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM app.policy_revision pr
     WHERE pr.id=p_supersedes_revision_id
       AND pr.policy_id=p_policy_id
       AND pr.policy_kind=p_policy_kind
       AND pr.scope_project_id IS NOT DISTINCT FROM p_scope_project_id
  ) THEN
    RAISE EXCEPTION 'superseded revision context mismatch' USING ERRCODE='23514';
  END IF;
  v_scope := COALESCE(p_scope_project_id,'GLOBAL')||':'||p_policy_id;
  v_request_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','POLICY_CREATE','policyId',p_policy_id,
    'policyKind',p_policy_kind,'scopeProjectId',p_scope_project_id,
    'revisionNumber',p_revision_number,'digest',v_digest,
    'supersedesRevisionId',p_supersedes_revision_id,
    'requestKey',p_request_key,'reason',p_reason
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'POLICY_CREATE',p_request_id,v_request_hash,v_scope,
    s.principal_id,s.session_id,'POLICY_REVISION'
  );
  IF v_replay THEN
    PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
    RETURN v_result;
  END IF;
  INSERT INTO app.policy_revision(
    id,policy_id,policy_kind,scope_project_id,revision_number,
    canonical_content,content_digest,content_version,
    created_by_principal_id,created_by_session_id,supersedes_revision_id,created_at
  ) VALUES(
    v_revision_id,p_policy_id,p_policy_kind,p_scope_project_id,p_revision_number,
    v_content,v_digest,1,s.principal_id,s.session_id,
    p_supersedes_revision_id,clock_timestamp()
  );
  INSERT INTO app.policy_review_event(
    id,policy_id,policy_revision_id,event_sequence,state_version,
    previous_state,command,next_state,actor_principal_id,actor_session_id,
    actor_authority_grant_id,request_id,request_hash,evidence_reference,occurred_at
  ) VALUES(
    v_event_id,p_policy_id,v_revision_id,1,1,NULL,'CREATE','DRAFT',
    s.principal_id,s.session_id,v_grant_id,p_request_id,v_request_hash,
    p_reason,clock_timestamp()
  );
  INSERT INTO app.policy_current(
    policy_id,policy_kind,scope_project_id,revision_id,effective_event_id,
    state,generation,updated_at
  ) VALUES(
    p_policy_id,p_policy_kind,p_scope_project_id,v_revision_id,v_event_id,
    'NONE',1,clock_timestamp()
  )
  ON CONFLICT (policy_id) DO NOTHING;
  PERFORM app_private.complete_command_request('POLICY_CREATE',p_request_id,v_revision_id);
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
  RETURN v_revision_id;
END
$$;

CREATE OR REPLACE FUNCTION app.transition_policy_review(
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
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT p FROM app.policy_revision
   WHERE id=p_policy_revision_id;
  v_required_authority := CASE p_command
    WHEN 'SUBMIT' THEN 'POLICY_AUTHOR'
    WHEN 'APPROVE' THEN 'POLICY_APPROVER'
    WHEN 'REJECT' THEN 'POLICY_APPROVER'
    WHEN 'INVALIDATE' THEN 'POLICY_SECURITY_ADMIN'
    WHEN 'EXPIRE' THEN 'POLICY_LIFECYCLE'
    WHEN 'SUPERSEDE' THEN 'POLICY_APPROVER'
  END;
  v_grant_id := app_private.lock_authority_grant(
    s.session_id,s.principal_id,v_required_authority,
    p.scope_project_id,p.policy_id,p.id,NULL
  );
  PERFORM 1 FROM app.policy_revision pr
   WHERE pr.id=p_policy_revision_id FOR SHARE;
  SELECT * INTO STRICT current_row FROM app.policy_current
   WHERE policy_id=p.policy_id
   FOR UPDATE;
  v_request_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','POLICY_REVIEW','revisionId',p.id,
    'expectedSequence',p_expected_sequence,'command',p_command::text,
    'requestKey',p_request_key,'reason',p_reason
  ));
  SELECT * INTO replay_event FROM app.policy_review_event e
   WHERE e.policy_revision_id=p.id AND e.request_id=p_request_id;
  IF FOUND THEN
    IF replay_event.actor_principal_id<>s.principal_id
       OR replay_event.request_hash<>v_request_hash THEN
      RAISE EXCEPTION 'request id reused' USING ERRCODE='40001';
    END IF;
    PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
    RETURN QUERY SELECT replay_event.id,replay_event.event_sequence,
                        replay_event.next_state,true;
    RETURN;
  END IF;
  SELECT * INTO old_event FROM app.policy_review_event e
   WHERE e.policy_revision_id=p.id ORDER BY e.event_sequence DESC LIMIT 1;
  IF old_event.id IS NULL OR old_event.event_sequence<>p_expected_sequence THEN
    RAISE EXCEPTION 'stale policy sequence' USING ERRCODE='40001';
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
    previous_state,command,next_state,actor_principal_id,actor_session_id,
    actor_authority_grant_id,request_id,request_hash,evidence_reference,occurred_at
  ) VALUES(
    v_new_event_id,p.policy_id,p.id,old_event.event_sequence+1,
    old_event.state_version+1,old_event.next_state,p_command,v_next_state,
    s.principal_id,s.session_id,v_grant_id,p_request_id,v_request_hash,
    p_reason,clock_timestamp()
  );
  IF v_next_state='APPROVED' THEN
    UPDATE app.policy_current
       SET revision_id=p.id,effective_event_id=v_new_event_id,state='APPROVED',
           generation=generation+1,updated_at=clock_timestamp()
     WHERE policy_id=p.policy_id;
  ELSIF current_row.revision_id=p.id THEN
    UPDATE app.policy_current
       SET effective_event_id=v_new_event_id,state='NONE',
           generation=generation+1,updated_at=clock_timestamp()
     WHERE policy_id=p.policy_id;
  END IF;
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
  RETURN QUERY SELECT v_new_event_id,old_event.event_sequence+1,v_next_state,false;
END
$$;

CREATE OR REPLACE FUNCTION app.transition_professional_review(
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
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT r FROM app.professional_review
   WHERE id=p_review_id;
  IF r.policy_revision_id<>p_expected_policy_revision_id THEN
    RAISE EXCEPTION 'policy expectation mismatch' USING ERRCODE='40001';
  END IF;
  v_required_authority := CASE p_command
    WHEN 'CREATE' THEN 'PROFESSIONAL_REVIEW'
    WHEN 'SUBMIT' THEN 'REVIEW_SUBMITTER'
    WHEN 'RESUBMIT' THEN 'REVIEW_SUBMITTER'
    WHEN 'APPROVE' THEN 'PROFESSIONAL_APPROVER'
    WHEN 'REJECT' THEN 'PROFESSIONAL_APPROVER'
    WHEN 'RETURN' THEN 'PROFESSIONAL_APPROVER'
    WHEN 'INVALIDATE' THEN 'REVIEW_INVALIDATOR'
    WHEN 'EXPIRE' THEN 'POLICY_LIFECYCLE'
  END;
  v_grant_id := app_private.lock_authority_grant(
    s.session_id,s.principal_id,v_required_authority,
    r.project_id,r.policy_id,r.policy_revision_id,NULL
  );
  PERFORM 1 FROM app.professional_review rev
   WHERE rev.id=p_review_id FOR UPDATE;
  PERFORM 1 FROM app.policy_current pc
   WHERE pc.policy_id=r.policy_id AND pc.revision_id=r.policy_revision_id
   FOR SHARE;
  IF NOT app.policy_is_effective(r.policy_revision_id) THEN
    RAISE EXCEPTION 'policy not effective' USING ERRCODE='23514';
  END IF;
  v_request_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','PROFESSIONAL_REVIEW','reviewId',r.id,
    'expectedSequence',p_expected_sequence,'command',p_command::text,
    'policyRevisionId',p_expected_policy_revision_id,
    'basisDigest',p_basis_digest,'requestKey',p_request_key,'reason',p_reason
  ));
  SELECT * INTO replay_event FROM app.professional_review_event e
   WHERE e.review_id=r.id AND e.request_id=p_request_id;
  IF FOUND THEN
    IF replay_event.actor_principal_id<>s.principal_id
       OR replay_event.request_hash<>v_request_hash THEN
      RAISE EXCEPTION 'request id reused' USING ERRCODE='40001';
    END IF;
    PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
    RETURN QUERY SELECT replay_event.id,replay_event.event_sequence,
                        replay_event.next_state,true;
    RETURN;
  END IF;
  SELECT * INTO old_event FROM app.professional_review_event e
   WHERE e.review_id=r.id ORDER BY e.event_sequence DESC LIMIT 1;
  IF old_event.id IS NULL OR old_event.event_sequence<>p_expected_sequence THEN
    RAISE EXCEPTION 'stale review sequence' USING ERRCODE='40001';
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
  INSERT INTO app.review_audit(id,review_id,event_id,action,actor_principal_id,occurred_at)
  VALUES(gen_random_uuid()::text,r.id,v_new_event_id,p_command::text,s.principal_id,clock_timestamp());
  UPDATE app.professional_review
     SET state=v_next_state,state_version=old_event.state_version+1,
         mutation_version=mutation_version+1
   WHERE id=r.id;
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
  RETURN QUERY SELECT v_new_event_id,old_event.event_sequence+1,v_next_state,false;
END
$$;

CREATE OR REPLACE FUNCTION app_private.materialize_snapshot_r3(p_snapshot_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s app.sales_handoff_snapshot_r3%ROWTYPE;
BEGIN
  SELECT * INTO STRICT s FROM app.sales_handoff_snapshot_r3
   WHERE id=p_snapshot_id FOR UPDATE;
  IF s.state<>'DRAFT' THEN
    RAISE EXCEPTION 'materialization requires DRAFT' USING ERRCODE='23514';
  END IF;
  INSERT INTO app.sales_snapshot_requirement_field_r3(
    snapshot_id,selection_run_id,requirement_version_id,field_key,value_json,
    value_type,unit,field_status,source_kind,source_entity_type,
    source_entity_id,source_aux_is_null,source_aux_text,source_value_id,
    source_revision_id,source_row_digest,stable_key
  )
  SELECT s.id,s.selection_run_id,r.requirement_version_id,r.field_key,r.value_json,
         r.value_type,r.unit,r.field_status,r.source_kind,r.source_entity_type,
         r.source_entity_id,r.source_aux_is_null,r.source_aux_text,r.source_value_id,
         r.source_revision_id,r.row_digest,
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
    professional_review_status,overall_status,result_row_digest,
    project_id,conversation_id,requirement_id,requirement_version_id,
    installation_scenario,stable_key
  )
  SELECT s.id,s.selection_run_id,r.id,r.id,r.candidate_id,r.product_id,
         r.product_revision_id,r.product_revision_digest,
         r.specification_revision_id,r.specification_revision_digest,
         r.rule_set_revision_id,r.rule_set_content_digest,
         r.technical_status,r.commercial_status,r.trust_status,
         r.professional_review_status,r.overall_status,r.row_digest,
         r.project_id,r.conversation_id,r.requirement_id,
         r.requirement_version_id,r.installation_scenario,
         app_private.stable_key_r3(2,jsonb_build_array(
           jsonb_build_object('name','candidateId','kind','ASCII_ID','value',r.candidate_id)
         ))
    FROM app.selection_candidate_result r
   WHERE r.selection_run_id=s.selection_run_id;

  INSERT INTO app.sales_snapshot_parameter_r3(
    snapshot_id,selection_run_id,candidate_row_id,candidate_id,parameter_key,
    catalog_parameter_revision_id,value_type,value_json,unit,source_revision_id,
    product_id,product_revision_id,specification_revision_id,
    source_row_digest,stable_key
  )
  SELECT s.id,s.selection_run_id,cr.id,cr.candidate_id,p.parameter_key,
         p.catalog_parameter_revision_id,p.value_type,p.value_json,p.unit,
         p.source_revision_id,cr.product_id,cr.product_revision_id,
         cr.specification_revision_id,p.row_digest,
         app_private.stable_key_r3(3,jsonb_build_array(
           jsonb_build_object('name','candidateId','kind','ASCII_ID','value',cr.candidate_id),
           jsonb_build_object('name','parameterKey','kind','ASCII_KEY','value',p.parameter_key)
         ))
    FROM app.selection_candidate_parameter p
    JOIN app.selection_candidate_result cr ON cr.candidate_id=p.candidate_id
   WHERE cr.selection_run_id=s.selection_run_id;

  INSERT INTO app.sales_snapshot_price_r3(
    snapshot_id,selection_run_id,candidate_row_id,candidate_id,price_revision_id,
    product_id,product_revision_id,specification_revision_id,source_revision_id,
    amount_minor,currency,price_basis,tax_basis,applicability,
    valid_from,valid_until,quoted_at,source_row_digest,stable_key
  )
  SELECT s.id,s.selection_run_id,cr.id,cr.candidate_id,pr.id,
         pr.product_id,pr.product_revision_id,pr.specification_revision_id,
         pr.source_revision_id,pr.amount_minor,pr.currency,pr.price_basis,
         pr.tax_basis,pr.applicability,pr.valid_from,pr.valid_until,pr.quoted_at,
         cp.row_digest,
         app_private.stable_key_r3(4,jsonb_build_array(
           jsonb_build_object('name','candidateId','kind','ASCII_ID','value',cr.candidate_id),
           jsonb_build_object('name','priceRevisionId','kind','ASCII_ID','value',pr.id)
         ))
    FROM app.selection_candidate_price cp
    JOIN app.selection_candidate_result cr ON cr.candidate_id=cp.candidate_id
    JOIN app.price_revision pr ON pr.id=cp.price_revision_id
   WHERE cr.selection_run_id=s.selection_run_id;

  INSERT INTO app.sales_snapshot_source_r3(
    snapshot_id,selection_run_id,source_revision_id,evidence_object_id,
    raw_content_digest,source_kind,source_entity_type,source_entity_id,
    source_aux_is_null,source_aux_text,captured_at,source_row_digest,stable_key
  )
  SELECT s.id,s.selection_run_id,r.source_revision_id,r.evidence_object_id,
         r.raw_content_digest,r.source_kind,r.source_entity_type,r.source_entity_id,
         r.source_aux_is_null,r.source_aux_text,r.captured_at,r.row_digest,
         app_private.stable_key_r3(5,jsonb_build_array(
           jsonb_build_object('name','sourceRevisionId','kind','ASCII_ID','value',r.source_revision_id)
         ))
    FROM app.selection_source_result r
   WHERE r.selection_run_id=s.selection_run_id;

  INSERT INTO app.sales_snapshot_catalog_review_r3(
    snapshot_id,selection_run_id,catalog_review_id,target_revision_id,
    source_revision_id,policy_revision_id,decision,reviewed_at,
    source_row_digest,stable_key
  )
  SELECT s.id,s.selection_run_id,r.catalog_review_id,r.target_revision_id,
         r.source_revision_id,r.policy_revision_id,r.decision,r.reviewed_at,
         r.row_digest,
         app_private.stable_key_r3(6,jsonb_build_array(
           jsonb_build_object('name','catalogReviewId','kind','ASCII_ID','value',r.catalog_review_id)
         ))
    FROM app.selection_catalog_review_result r
   WHERE r.selection_run_id=s.selection_run_id;

  INSERT INTO app.sales_snapshot_professional_review_r3(
    snapshot_id,selection_run_id,professional_review_event_id,
    professional_review_id,event_sequence,target_revision_id,
    policy_revision_id,decision,basis_digest,occurred_at,
    source_row_digest,stable_key
  )
  SELECT s.id,s.selection_run_id,r.professional_review_event_id,
         r.professional_review_id,r.event_sequence,r.target_revision_id,
         r.policy_revision_id,r.decision,r.basis_digest,r.occurred_at,
         r.row_digest,
         app_private.stable_key_r3(7,jsonb_build_array(
           jsonb_build_object('name','professionalReviewId','kind','ASCII_ID','value',r.professional_review_id),
           jsonb_build_object('name','eventSequence','kind','INT64','value',r.event_sequence)
         ))
    FROM app.selection_professional_review_result r
   WHERE r.selection_run_id=s.selection_run_id;

  INSERT INTO app.sales_snapshot_warning_r3(
    snapshot_id,selection_run_id,candidate_row_id,candidate_id,
    warning_sequence,warning_code,warning_text,severity,source_warning_id,
    source_row_digest,stable_key
  )
  SELECT s.id,s.selection_run_id,cr.id,cr.candidate_id,
         w.warning_sequence,w.warning_code,w.warning_text,w.severity,w.source_warning_id,
         w.row_digest,
         app_private.stable_key_r3(8,jsonb_build_array(
           jsonb_build_object('name','candidateId','kind','ASCII_ID','value',cr.candidate_id),
           jsonb_build_object('name','warningSequence','kind','INT64','value',w.warning_sequence)
         ))
    FROM app.selection_warning_result w
    JOIN app.selection_candidate_result cr ON cr.candidate_id=w.candidate_id
   WHERE w.selection_run_id=s.selection_run_id;

  INSERT INTO app.sales_snapshot_missing_field_r3(
    snapshot_id,selection_run_id,candidate_row_id,candidate_id,field_key,
    reason,impact_scope,source_row_digest,stable_key
  )
  SELECT s.id,s.selection_run_id,cr.id,cr.candidate_id,m.field_key,
         m.reason,m.impact_scope,m.row_digest,
         app_private.stable_key_r3(9,jsonb_build_array(
           jsonb_build_object('name','candidateId','kind','ASCII_ID','value',cr.candidate_id),
           jsonb_build_object('name','fieldKey','kind','ASCII_KEY','value',m.field_key)
         ))
    FROM app.selection_missing_field_result m
    JOIN app.selection_candidate_result cr ON cr.candidate_id=m.candidate_id
   WHERE m.selection_run_id=s.selection_run_id;
END
$$;

CREATE OR REPLACE FUNCTION app_private.require_no_active_snapshot_children_r3(p_snapshot_id text)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s app.sales_handoff_snapshot_r3%ROWTYPE;
BEGIN
  SELECT * INTO STRICT s FROM app.sales_handoff_snapshot_r3 WHERE id=p_snapshot_id;
  IF EXISTS (
    SELECT selection_result_item_id,candidate_id,selection_run_id,result_row_digest
      FROM app.sales_snapshot_candidate_r3 WHERE snapshot_id=s.id
    EXCEPT
    SELECT id,candidate_id,selection_run_id,row_digest
      FROM app.selection_candidate_result WHERE selection_run_id=s.selection_run_id
  ) OR EXISTS (
    SELECT id,candidate_id,selection_run_id,row_digest
      FROM app.selection_candidate_result WHERE selection_run_id=s.selection_run_id
    EXCEPT
    SELECT selection_result_item_id,candidate_id,selection_run_id,result_row_digest
      FROM app.sales_snapshot_candidate_r3 WHERE snapshot_id=s.id
  ) THEN
    RAISE EXCEPTION 'snapshot candidate source set mismatch' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT requirement_version_id,field_key,source_row_digest
      FROM app.sales_snapshot_requirement_field_r3 WHERE snapshot_id=s.id
    EXCEPT
    SELECT requirement_version_id,field_key,row_digest
      FROM app.selection_requirement_field WHERE selection_run_id=s.selection_run_id
  ) OR EXISTS (
    SELECT requirement_version_id,field_key,row_digest
      FROM app.selection_requirement_field WHERE selection_run_id=s.selection_run_id
    EXCEPT
    SELECT requirement_version_id,field_key,source_row_digest
      FROM app.sales_snapshot_requirement_field_r3 WHERE snapshot_id=s.id
  ) THEN
    RAISE EXCEPTION 'snapshot requirement field source set mismatch' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT source_revision_id,source_row_digest
      FROM app.sales_snapshot_source_r3 WHERE snapshot_id=s.id
    EXCEPT
    SELECT source_revision_id,row_digest
      FROM app.selection_source_result WHERE selection_run_id=s.selection_run_id
  ) OR EXISTS (
    SELECT source_revision_id,row_digest
      FROM app.selection_source_result WHERE selection_run_id=s.selection_run_id
    EXCEPT
    SELECT source_revision_id,source_row_digest
      FROM app.sales_snapshot_source_r3 WHERE snapshot_id=s.id
  ) THEN
    RAISE EXCEPTION 'snapshot source set mismatch' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT catalog_review_id,source_row_digest
      FROM app.sales_snapshot_catalog_review_r3 WHERE snapshot_id=s.id
    EXCEPT
    SELECT catalog_review_id,row_digest
      FROM app.selection_catalog_review_result WHERE selection_run_id=s.selection_run_id
  ) OR EXISTS (
    SELECT catalog_review_id,row_digest
      FROM app.selection_catalog_review_result WHERE selection_run_id=s.selection_run_id
    EXCEPT
    SELECT catalog_review_id,source_row_digest
      FROM app.sales_snapshot_catalog_review_r3 WHERE snapshot_id=s.id
  ) THEN
    RAISE EXCEPTION 'snapshot catalog review set mismatch' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT professional_review_id,event_sequence,source_row_digest
      FROM app.sales_snapshot_professional_review_r3 WHERE snapshot_id=s.id
    EXCEPT
    SELECT professional_review_id,event_sequence,row_digest
      FROM app.selection_professional_review_result WHERE selection_run_id=s.selection_run_id
  ) OR EXISTS (
    SELECT professional_review_id,event_sequence,row_digest
      FROM app.selection_professional_review_result WHERE selection_run_id=s.selection_run_id
    EXCEPT
    SELECT professional_review_id,event_sequence,source_row_digest
      FROM app.sales_snapshot_professional_review_r3 WHERE snapshot_id=s.id
  ) THEN
    RAISE EXCEPTION 'snapshot professional review set mismatch' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT candidate_id,warning_sequence,source_row_digest
      FROM app.sales_snapshot_warning_r3 WHERE snapshot_id=s.id
    EXCEPT
    SELECT candidate_id,warning_sequence,row_digest
      FROM app.selection_warning_result WHERE selection_run_id=s.selection_run_id
  ) OR EXISTS (
    SELECT candidate_id,warning_sequence,row_digest
      FROM app.selection_warning_result WHERE selection_run_id=s.selection_run_id
    EXCEPT
    SELECT candidate_id,warning_sequence,source_row_digest
      FROM app.sales_snapshot_warning_r3 WHERE snapshot_id=s.id
  ) THEN
    RAISE EXCEPTION 'snapshot warning set mismatch' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT candidate_id,field_key,source_row_digest
      FROM app.sales_snapshot_missing_field_r3 WHERE snapshot_id=s.id
    EXCEPT
    SELECT candidate_id,field_key,row_digest
      FROM app.selection_missing_field_result WHERE selection_run_id=s.selection_run_id
  ) OR EXISTS (
    SELECT candidate_id,field_key,row_digest
      FROM app.selection_missing_field_result WHERE selection_run_id=s.selection_run_id
    EXCEPT
    SELECT candidate_id,field_key,source_row_digest
      FROM app.sales_snapshot_missing_field_r3 WHERE snapshot_id=s.id
  ) THEN
    RAISE EXCEPTION 'snapshot missing-field set mismatch' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT candidate_id,parameter_key,source_row_digest
      FROM app.sales_snapshot_parameter_r3 WHERE snapshot_id=s.id
    EXCEPT
    SELECT candidate_id,parameter_key,row_digest
      FROM app.selection_candidate_parameter
       WHERE candidate_id IN (SELECT id FROM app.selection_candidate WHERE selection_run_id=s.selection_run_id)
  ) OR EXISTS (
    SELECT candidate_id,parameter_key,row_digest
      FROM app.selection_candidate_parameter
       WHERE candidate_id IN (SELECT id FROM app.selection_candidate WHERE selection_run_id=s.selection_run_id)
    EXCEPT
    SELECT candidate_id,parameter_key,source_row_digest
      FROM app.sales_snapshot_parameter_r3 WHERE snapshot_id=s.id
  ) THEN
    RAISE EXCEPTION 'snapshot parameter set mismatch' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT candidate_id,price_revision_id,source_row_digest
      FROM app.sales_snapshot_price_r3 WHERE snapshot_id=s.id
    EXCEPT
    SELECT candidate_id,price_revision_id,row_digest
      FROM app.selection_candidate_price
       WHERE candidate_id IN (SELECT id FROM app.selection_candidate WHERE selection_run_id=s.selection_run_id)
  ) OR EXISTS (
    SELECT candidate_id,price_revision_id,row_digest
      FROM app.selection_candidate_price
       WHERE candidate_id IN (SELECT id FROM app.selection_candidate WHERE selection_run_id=s.selection_run_id)
    EXCEPT
    SELECT candidate_id,price_revision_id,source_row_digest
      FROM app.sales_snapshot_price_r3 WHERE snapshot_id=s.id
  ) THEN
    RAISE EXCEPTION 'snapshot price set mismatch' USING ERRCODE='23514';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION app_private.validate_snapshot_r3(p_snapshot_id text)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s app.sales_handoff_snapshot_r3%ROWTYPE;
  m app.snapshot_basis_metadata_r3%ROWTYPE;
  v_basis bytea;
  v_actual_fields integer;
BEGIN
  SELECT * INTO STRICT s FROM app.sales_handoff_snapshot_r3 WHERE id=p_snapshot_id;
  IF s.state<>'FINALIZED' THEN
    RAISE EXCEPTION 'snapshot not finalized' USING ERRCODE='23514';
  END IF;
  SELECT * INTO STRICT m FROM app.snapshot_basis_metadata_r3 WHERE snapshot_id=s.id;
  PERFORM app_private.require_no_active_snapshot_children_r3(s.id);
  SELECT COALESCE(sum(field_count),0) INTO v_actual_fields
    FROM app.sales_snapshot_basis_record_r3 WHERE snapshot_id=s.id;
  IF m.field_count<>v_actual_fields THEN
    RAISE EXCEPTION 'basis field count metadata mismatch' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM app.sales_snapshot_requirement_field_r3 r
     WHERE r.snapshot_id=s.id
       AND octet_length(app.source_key_r3(
         r.source_kind,r.source_entity_type,r.source_entity_id,
         r.source_aux_is_null,r.source_aux_text
       ))>362
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
    SELECT 1 FROM (
      SELECT w.candidate_row_id,
             row_number() OVER (
               PARTITION BY w.candidate_row_id
               ORDER BY w.warning_code,w.warning_text,w.source_warning_id
             ) AS expected_sequence,w.warning_sequence
        FROM app.sales_snapshot_warning_r3 w
       WHERE w.snapshot_id=s.id
    ) q WHERE q.expected_sequence<>q.warning_sequence
  ) THEN
    RAISE EXCEPTION 'warning ordering failure' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM app.sales_snapshot_candidate_r3 c
     WHERE c.snapshot_id=s.id
       AND (c.rule_set_revision_id<>s.rule_set_revision_id
            OR c.rule_set_content_digest<>s.rule_set_content_digest)
  ) THEN
    RAISE EXCEPTION 'candidate ruleset mismatch' USING ERRCODE='23514';
  END IF;
  v_basis:=app.build_snapshot_basis_r6(s.id);
  IF octet_length(v_basis)<>m.basis_byte_length
     OR app_private.sha256_hex(v_basis)<>m.basis_digest
     OR app.snapshot_record_count(s.id)<>m.record_count
     OR NOT app.verify_snapshot_basis_r6(v_basis,s.id) THEN
    RAISE EXCEPTION 'basis verification failure' USING ERRCODE='23514';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION app.create_snapshot_r3(
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
  v_grant_id text;
  v_basis bytea;
  v_count integer;
  v_fields integer;
  v_body_bytes bigint;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT seal_row FROM app.selection_run_seal
   WHERE selection_run_id=p_selection_run_id;
  v_grant_id := app_private.lock_authority_grant(
    s.session_id,s.principal_id,'SNAPSHOT_CREATE',
    seal_row.project_id,NULL,NULL,NULL
  );
  SELECT * INTO STRICT seal_row FROM app.selection_run_seal
   WHERE selection_run_id=p_selection_run_id FOR SHARE;
  SELECT * INTO STRICT run_row FROM app.selection_run
   WHERE id=p_selection_run_id FOR SHARE;
  IF run_row.state<>'SEALED'
     OR app.selection_result_digest(run_row.id)<>seal_row.result_digest THEN
    RAISE EXCEPTION 'selection run seal mismatch' USING ERRCODE='23514';
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
    seal_row.rule_set_revision_id,seal_row.rule_set_content_digest,
    clock_timestamp(),p_expected_case_version+1,1,'DRAFT',
    s.principal_id,clock_timestamp()
  );
  PERFORM app_private.materialize_snapshot_r3(p_snapshot_id);
  v_count:=app_private.refresh_snapshot_basis_records_r3(p_snapshot_id);
  SELECT COALESCE(sum(field_count),0) INTO v_fields
    FROM app.sales_snapshot_basis_record_r3 WHERE snapshot_id=p_snapshot_id;
  v_basis:=app.build_snapshot_basis_r6(p_snapshot_id);
  v_body_bytes:=octet_length(v_basis)-28;
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

CREATE OR REPLACE FUNCTION app.finalize_snapshot_r3(
  p_snapshot_id text,
  p_expected_mutation_version bigint
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  snap app.sales_handoff_snapshot_r3%ROWTYPE;
  v_grant_id text;
  v_count integer;
  v_fields integer;
  v_basis bytea;
  v_body_bytes bigint;
  v_next bigint;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT snap FROM app.sales_handoff_snapshot_r3 WHERE id=p_snapshot_id;
  v_grant_id:=app_private.lock_authority_grant(
    s.session_id,s.principal_id,'SNAPSHOT_CREATE',snap.project_id,NULL,NULL,NULL
  );
  PERFORM 1 FROM app.sales_handoff_snapshot_r3 sn
   WHERE sn.id=p_snapshot_id AND sn.state='DRAFT'
     AND sn.mutation_version=p_expected_mutation_version
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'snapshot finalization CAS failed' USING ERRCODE='40001';
  END IF;
  v_count:=app_private.refresh_snapshot_basis_records_r3(p_snapshot_id);
  SELECT COALESCE(sum(field_count),0) INTO v_fields
    FROM app.sales_snapshot_basis_record_r3 WHERE snapshot_id=p_snapshot_id;
  v_basis:=app.build_snapshot_basis_r6(p_snapshot_id);
  v_body_bytes:=octet_length(v_basis)-28;
  INSERT INTO app.snapshot_basis_metadata_r3 AS m(
    snapshot_id,registry_revision,protocol_revision,stable_key_encoding,
    record_count,field_count,body_byte_length,basis_byte_length,basis_digest
  ) VALUES(
    p_snapshot_id,'SNAPSHOT-R3','R3-BASIS-1-R6','SK-R2',
    v_count,v_fields,v_body_bytes,octet_length(v_basis),app_private.sha256_hex(v_basis)
  )
  ON CONFLICT (snapshot_id) DO UPDATE
    SET record_count=EXCLUDED.record_count,field_count=EXCLUDED.field_count,
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

ALTER TABLE app.policy_revision
  ADD CONSTRAINT policy_revision_policy_revision_unique UNIQUE (policy_id,id);
ALTER TABLE app.policy_review_event
  ADD CONSTRAINT policy_event_policy_revision_event_unique
  UNIQUE (policy_id,policy_revision_id,id);
ALTER TABLE app.policy_current
  ADD CONSTRAINT policy_current_revision_policy_fk
  FOREIGN KEY (policy_id,revision_id)
  REFERENCES app.policy_revision(policy_id,id),
  ADD CONSTRAINT policy_current_event_revision_fk
  FOREIGN KEY (policy_id,revision_id,effective_event_id)
  REFERENCES app.policy_review_event(policy_id,policy_revision_id,id);

CREATE OR REPLACE FUNCTION app_private.guard_policy_event_link_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  pr app.policy_revision%ROWTYPE;
BEGIN
  SELECT * INTO STRICT pr FROM app.policy_revision WHERE id=NEW.policy_revision_id;
  IF pr.policy_id<>NEW.policy_id THEN
    RAISE EXCEPTION 'policy event does not match revision' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION app_private.guard_policy_current_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  pr app.policy_revision%ROWTYPE;
BEGIN
  SELECT * INTO STRICT pr FROM app.policy_revision WHERE id=NEW.revision_id;
  IF pr.policy_id<>NEW.policy_id
     OR pr.policy_kind<>NEW.policy_kind
     OR pr.scope_project_id IS DISTINCT FROM NEW.scope_project_id THEN
    RAISE EXCEPTION 'policy current revision scope mismatch' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM app.policy_review_event pe
     WHERE pe.id=NEW.effective_event_id
       AND pe.policy_id=NEW.policy_id
       AND pe.policy_revision_id=NEW.revision_id
  ) THEN
    RAISE EXCEPTION 'policy current event mismatch' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION app_private.guard_sealed_result_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_run_id text;
  v_state text;
BEGIN
  v_run_id:=COALESCE(to_jsonb(NEW)->>'selection_run_id',to_jsonb(OLD)->>'selection_run_id');
  IF v_run_id IS NULL
     AND COALESCE(to_jsonb(NEW)->>'candidate_id',to_jsonb(OLD)->>'candidate_id') IS NOT NULL THEN
    SELECT c.selection_run_id INTO v_run_id
      FROM app.selection_candidate c
     WHERE c.id=COALESCE(to_jsonb(NEW)->>'candidate_id',to_jsonb(OLD)->>'candidate_id');
  END IF;
  SELECT r.state INTO v_state FROM app.selection_run r WHERE r.id=v_run_id;
  IF TG_TABLE_NAME='selection_run_seal' AND TG_OP IN ('UPDATE','DELETE') THEN
    RAISE EXCEPTION 'selection seal immutable' USING ERRCODE='23514';
  END IF;
  IF TG_TABLE_NAME='selection_run_seal' AND TG_OP='INSERT' AND v_state<>'SEALED' THEN
    RAISE EXCEPTION 'seal row requires sealed run' USING ERRCODE='23514';
  END IF;
  IF v_state='SEALED' AND TG_OP IN ('INSERT','UPDATE','DELETE')
     AND TG_TABLE_NAME<>'selection_run_seal' THEN
    RAISE EXCEPTION 'sealed selection result immutable' USING ERRCODE='23514';
  END IF;
  RETURN COALESCE(NEW,OLD);
END
$$;

CREATE TRIGGER a_compute_selection_requirement_digest
BEFORE INSERT OR UPDATE ON app.selection_requirement_field
FOR EACH ROW EXECUTE FUNCTION app_private.compute_selection_row_digest_r3();
CREATE TRIGGER a_compute_selection_source_digest
BEFORE INSERT OR UPDATE ON app.selection_source_result
FOR EACH ROW EXECUTE FUNCTION app_private.compute_selection_row_digest_r3();
CREATE TRIGGER a_compute_selection_catalog_review_digest
BEFORE INSERT OR UPDATE ON app.selection_catalog_review_result
FOR EACH ROW EXECUTE FUNCTION app_private.compute_selection_row_digest_r3();
CREATE TRIGGER a_compute_selection_professional_review_digest
BEFORE INSERT OR UPDATE ON app.selection_professional_review_result
FOR EACH ROW EXECUTE FUNCTION app_private.compute_selection_row_digest_r3();
CREATE TRIGGER a_compute_selection_warning_digest
BEFORE INSERT OR UPDATE ON app.selection_warning_result
FOR EACH ROW EXECUTE FUNCTION app_private.compute_selection_row_digest_r3();
CREATE TRIGGER a_compute_selection_missing_digest
BEFORE INSERT OR UPDATE ON app.selection_missing_field_result
FOR EACH ROW EXECUTE FUNCTION app_private.compute_selection_row_digest_r3();
CREATE TRIGGER a_compute_selection_price_digest
BEFORE INSERT OR UPDATE ON app.selection_candidate_price
FOR EACH ROW EXECUTE FUNCTION app_private.compute_selection_row_digest_r3();
CREATE TRIGGER a_compute_selection_parameter_digest
BEFORE INSERT OR UPDATE ON app.selection_candidate_parameter
FOR EACH ROW EXECUTE FUNCTION app_private.compute_selection_row_digest_r3();
CREATE TRIGGER a_compute_selection_result_digest
BEFORE INSERT OR UPDATE ON app.selection_candidate_result
FOR EACH ROW EXECUTE FUNCTION app_private.compute_selection_row_digest_r3();

CREATE TRIGGER a_verify_snapshot_requirement_digest
BEFORE INSERT OR UPDATE ON app.sales_snapshot_requirement_field_r3
FOR EACH ROW EXECUTE FUNCTION app_private.verify_snapshot_row_digest_r3();
CREATE TRIGGER a_verify_snapshot_source_digest
BEFORE INSERT OR UPDATE ON app.sales_snapshot_source_r3
FOR EACH ROW EXECUTE FUNCTION app_private.verify_snapshot_row_digest_r3();
CREATE TRIGGER a_verify_snapshot_catalog_review_digest
BEFORE INSERT OR UPDATE ON app.sales_snapshot_catalog_review_r3
FOR EACH ROW EXECUTE FUNCTION app_private.verify_snapshot_row_digest_r3();
CREATE TRIGGER a_verify_snapshot_professional_review_digest
BEFORE INSERT OR UPDATE ON app.sales_snapshot_professional_review_r3
FOR EACH ROW EXECUTE FUNCTION app_private.verify_snapshot_row_digest_r3();
CREATE TRIGGER a_verify_snapshot_warning_digest
BEFORE INSERT OR UPDATE ON app.sales_snapshot_warning_r3
FOR EACH ROW EXECUTE FUNCTION app_private.verify_snapshot_row_digest_r3();
CREATE TRIGGER a_verify_snapshot_missing_digest
BEFORE INSERT OR UPDATE ON app.sales_snapshot_missing_field_r3
FOR EACH ROW EXECUTE FUNCTION app_private.verify_snapshot_row_digest_r3();
CREATE TRIGGER a_verify_snapshot_parameter_digest
BEFORE INSERT OR UPDATE ON app.sales_snapshot_parameter_r3
FOR EACH ROW EXECUTE FUNCTION app_private.verify_snapshot_row_digest_r3();
CREATE TRIGGER a_verify_snapshot_price_digest
BEFORE INSERT OR UPDATE ON app.sales_snapshot_price_r3
FOR EACH ROW EXECUTE FUNCTION app_private.verify_snapshot_row_digest_r3();
CREATE TRIGGER a_verify_snapshot_candidate_digest
BEFORE INSERT OR UPDATE ON app.sales_snapshot_candidate_r3
FOR EACH ROW EXECUTE FUNCTION app_private.verify_snapshot_row_digest_r3();

CREATE TRIGGER guard_selection_requirement_sealed
BEFORE INSERT OR UPDATE OR DELETE ON app.selection_requirement_field
FOR EACH ROW EXECUTE FUNCTION app_private.guard_sealed_result_r3();
CREATE TRIGGER guard_selection_source_sealed
BEFORE INSERT OR UPDATE OR DELETE ON app.selection_source_result
FOR EACH ROW EXECUTE FUNCTION app_private.guard_sealed_result_r3();
CREATE TRIGGER guard_selection_catalog_review_sealed
BEFORE INSERT OR UPDATE OR DELETE ON app.selection_catalog_review_result
FOR EACH ROW EXECUTE FUNCTION app_private.guard_sealed_result_r3();
CREATE TRIGGER guard_selection_professional_review_sealed
BEFORE INSERT OR UPDATE OR DELETE ON app.selection_professional_review_result
FOR EACH ROW EXECUTE FUNCTION app_private.guard_sealed_result_r3();
CREATE TRIGGER guard_selection_warning_sealed
BEFORE INSERT OR UPDATE OR DELETE ON app.selection_warning_result
FOR EACH ROW EXECUTE FUNCTION app_private.guard_sealed_result_r3();
CREATE TRIGGER guard_selection_missing_sealed
BEFORE INSERT OR UPDATE OR DELETE ON app.selection_missing_field_result
FOR EACH ROW EXECUTE FUNCTION app_private.guard_sealed_result_r3();

CREATE TRIGGER guard_policy_event_link_r3
BEFORE INSERT ON app.policy_review_event
FOR EACH ROW EXECUTE FUNCTION app_private.guard_policy_event_link_r3();
CREATE TRIGGER guard_policy_current_r3
BEFORE INSERT OR UPDATE ON app.policy_current
FOR EACH ROW EXECUTE FUNCTION app_private.guard_policy_current_r3();

CREATE TRIGGER guard_selection_run_event_r3
BEFORE UPDATE OR DELETE ON app.selection_run_event
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER deny_selection_run_event_truncate_r3
BEFORE TRUNCATE ON app.selection_run_event
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER guard_session_binding_audit_r3
BEFORE UPDATE OR DELETE ON app.session_binding_audit
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER deny_session_binding_audit_truncate_r3
BEFORE TRUNCATE ON app.session_binding_audit
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();

CREATE TRIGGER deny_selection_candidate_truncate_r3
BEFORE TRUNCATE ON app.selection_candidate
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER deny_selection_candidate_price_truncate_r3
BEFORE TRUNCATE ON app.selection_candidate_price
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER deny_selection_candidate_parameter_truncate_r3
BEFORE TRUNCATE ON app.selection_candidate_parameter
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER deny_selection_candidate_result_truncate_r3
BEFORE TRUNCATE ON app.selection_candidate_result
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER deny_selection_run_seal_truncate_r3
BEFORE TRUNCATE ON app.selection_run_seal
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER deny_selection_requirement_truncate_r3
BEFORE TRUNCATE ON app.selection_requirement_field
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER deny_selection_source_truncate_r3
BEFORE TRUNCATE ON app.selection_source_result
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER deny_selection_catalog_review_truncate_r3
BEFORE TRUNCATE ON app.selection_catalog_review_result
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER deny_selection_professional_review_truncate_r3
BEFORE TRUNCATE ON app.selection_professional_review_result
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER deny_selection_warning_truncate_r3
BEFORE TRUNCATE ON app.selection_warning_result
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER deny_selection_missing_truncate_r3
BEFORE TRUNCATE ON app.selection_missing_field_result
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER deny_policy_current_truncate_r3
BEFORE TRUNCATE ON app.policy_current
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER deny_session_role_registry_truncate_r3
BEFORE TRUNCATE ON app.session_role_registry
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER deny_command_request_truncate_r3
BEFORE TRUNCATE ON app.command_request
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();

CREATE OR REPLACE FUNCTION app_private.deny_delete_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  RAISE EXCEPTION 'delete denied by lifecycle guard' USING ERRCODE='23514';
END
$$;

CREATE TRIGGER deny_policy_current_delete_r3
BEFORE DELETE ON app.policy_current
FOR EACH ROW EXECUTE FUNCTION app_private.deny_delete_r3();
CREATE TRIGGER deny_session_role_registry_delete_r3
BEFORE DELETE ON app.session_role_registry
FOR EACH ROW EXECUTE FUNCTION app_private.deny_delete_r3();

CREATE OR REPLACE FUNCTION app_private.guard_command_request_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'command request delete denied' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' THEN
    IF (NEW.operation,NEW.request_id,NEW.request_hash,NEW.scope_key,
        NEW.principal_id,NEW.session_id,NEW.result_type,NEW.claimed_at)
       IS DISTINCT FROM
       (OLD.operation,OLD.request_id,OLD.request_hash,OLD.scope_key,
        OLD.principal_id,OLD.session_id,OLD.result_type,OLD.claimed_at) THEN
      RAISE EXCEPTION 'command request identity immutable' USING ERRCODE='23514';
    END IF;
    IF OLD.state<>'CLAIMED' OR NEW.state<>'COMPLETED' THEN
      RAISE EXCEPTION 'illegal command request transition' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN COALESCE(NEW,OLD);
END
$$;

CREATE OR REPLACE FUNCTION app_private.guard_session_role_registry_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'session role registry delete denied' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND (
    NEW.role_name,NEW.role_kind,NEW.capability_role,NEW.activation_token_digest,
    NEW.provisioned_at
  ) IS DISTINCT FROM (
    OLD.role_name,OLD.role_kind,OLD.capability_role,OLD.activation_token_digest,
    OLD.provisioned_at
  ) THEN
    RAISE EXCEPTION 'session role identity immutable' USING ERRCODE='23514';
  END IF;
  RETURN COALESCE(NEW,OLD);
END
$$;

CREATE OR REPLACE FUNCTION app_private.guard_authority_grant_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'authority grant delete denied' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND (
    NEW.id,NEW.principal_id,NEW.session_id,NEW.subject_principal_id,
    NEW.object_scope,NEW.authority_code,NEW.project_id,NEW.policy_id,
    NEW.policy_revision_id,NEW.valid_from,NEW.valid_until,NEW.created_at
  ) IS DISTINCT FROM (
    OLD.id,OLD.principal_id,OLD.session_id,OLD.subject_principal_id,
    OLD.object_scope,OLD.authority_code,OLD.project_id,OLD.policy_id,
    OLD.policy_revision_id,OLD.valid_from,OLD.valid_until,OLD.created_at
  ) THEN
    RAISE EXCEPTION 'authority grant identity immutable' USING ERRCODE='23514';
  END IF;
  RETURN COALESCE(NEW,OLD);
END
$$;

CREATE TRIGGER guard_command_request_r3
BEFORE UPDATE OR DELETE ON app.command_request
FOR EACH ROW EXECUTE FUNCTION app_private.guard_command_request_r3();
CREATE TRIGGER guard_session_role_registry_r3
BEFORE UPDATE OR DELETE ON app.session_role_registry
FOR EACH ROW EXECUTE FUNCTION app_private.guard_session_role_registry_r3();
CREATE TRIGGER guard_authority_grant_r3
BEFORE UPDATE OR DELETE ON app.authority_grant
FOR EACH ROW EXECUTE FUNCTION app_private.guard_authority_grant_r3();
CREATE TRIGGER deny_authority_grant_truncate_r3
BEFORE TRUNCATE ON app.authority_grant
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();

CREATE OR REPLACE VIEW app.current_policy_revision_v
WITH (security_barrier=true,security_invoker=false) AS
SELECT pr.id AS policy_revision_id,pr.policy_id,pr.policy_kind,pr.scope_project_id,
       pr.revision_number,pr.content_digest,pc.state,pc.generation,
       pe.id AS effective_event_id,pe.event_sequence,pe.occurred_at
  FROM app.policy_current pc
  JOIN app.policy_revision pr ON pr.id=pc.revision_id
  JOIN app.policy_review_event pe ON pe.id=pc.effective_event_id
 WHERE pc.state='APPROVED'
   AND pe.policy_revision_id=pr.id
   AND pe.next_state='APPROVED'
   AND NOT EXISTS (
     SELECT 1 FROM app.policy_review_event later
      WHERE later.policy_revision_id=pr.id AND later.event_sequence>pe.event_sequence
   )
   AND app_private.has_current_authority(
     'POLICY_READ',pr.scope_project_id,pr.policy_id,pr.id,NULL
   );

CREATE OR REPLACE VIEW app.audit_policy_events_v
WITH (security_barrier=true,security_invoker=false) AS
SELECT e.policy_id,e.policy_revision_id,e.event_sequence,e.state_version,
       e.previous_state,e.command,e.next_state,e.actor_principal_id,
       e.actor_authority_grant_id,e.request_id,e.request_hash,
       e.evidence_reference,e.occurred_at
  FROM app.policy_review_event e
  JOIN app.policy_revision p ON p.id=e.policy_revision_id
 WHERE app_private.has_current_authority(
   'POLICY_AUDIT',p.scope_project_id,p.policy_id,p.id,NULL
 );

CREATE OR REPLACE VIEW app.current_sales_snapshot_v
WITH (security_barrier=true,security_invoker=false) AS
SELECT s.id AS snapshot_id,s.case_id,s.project_id,s.conversation_id,
       s.requirement_id,s.requirement_version_id,s.installation_scenario,
       s.selection_run_id,s.rule_set_revision_id,s.rule_set_content_digest,
       s.basis_as_of,s.version_number,s.mutation_version,s.state,
       s.created_at,s.finalized_at,m.basis_digest,m.record_count,basis_byte_length
  FROM app.sales_handoff_snapshot_r3 s
  JOIN app.snapshot_basis_metadata_r3 m ON m.snapshot_id=s.id
 WHERE s.state='FINALIZED'
   AND app_private.has_current_authority(
     'SNAPSHOT_READ',s.project_id,NULL,NULL,NULL
   );

CREATE OR REPLACE VIEW app.current_professional_review_v
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
 WHERE app_private.has_current_authority(
   'REVIEW_READ',r.project_id,r.policy_id,r.policy_revision_id,NULL
 );

CREATE OR REPLACE VIEW app.audit_professional_review_events_v
WITH (security_barrier=true,security_invoker=false) AS
SELECT e.id,e.review_id,e.project_id,e.event_sequence,e.state_version,
       e.previous_state,e.command,e.next_state,e.actor_principal_id,
       e.actor_authority_grant_id,e.request_id,e.request_hash,e.basis_digest,
       e.occurred_at
  FROM app.professional_review_event e
 WHERE app_private.has_current_authority(
   'REVIEW_AUDIT',e.project_id,e.policy_id,e.policy_revision_id,NULL
 );

CREATE OR REPLACE VIEW app.trusted_session_status_v
WITH (security_barrier=true,security_invoker=false) AS
SELECT ts.session_id,ts.principal_id,ts.login_epoch,ts.audience,ts.issuer,
       ts.issued_at,ts.not_before,ts.expires_at,ts.revoked_at,
       ts.revocation_reason,ts.state
  FROM app.trusted_session ts
 WHERE ts.state='ACTIVE'
   AND ts.binding_state='ACTIVE'
   AND (
     ts.principal_id=(
       SELECT c.principal_id FROM app_private.current_session_context() c LIMIT 1
     )
     OR app_private.has_current_authority(
       'SESSION_AUDIT',NULL,NULL,NULL,ts.principal_id
     )
   );

DROP VIEW app.authority_grant_v;
CREATE OR REPLACE VIEW app.authority_grant_v
WITH (security_barrier=true,security_invoker=false) AS
SELECT g.id,g.principal_id,g.session_id,g.subject_principal_id,g.object_scope,
       g.authority_code,g.project_id,g.policy_id,g.policy_revision_id,
       g.valid_from,g.valid_until,g.revoked_at
  FROM app.authority_grant g
 WHERE app_private.has_current_authority(
   'AUTHORITY_AUDIT',g.project_id,g.policy_id,g.policy_revision_id,g.subject_principal_id
 );

CREATE OR REPLACE VIEW app.selection_result_read_v
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
   SELECT 1 FROM app.selection_run sr
    WHERE sr.id=r.selection_run_id AND sr.state='SEALED'
 )
 AND app_private.has_current_authority(
   'SELECTION_READ',r.project_id,NULL,NULL,NULL
 );

CREATE VIEW app.trusted_session_audit_v
WITH (security_barrier=true,security_invoker=false) AS
SELECT ts.session_id,ts.principal_id,ts.login_epoch,ts.audience,ts.issuer,
       ts.issued_at,ts.not_before,ts.expires_at,ts.revoked_at,
       ts.revocation_reason,ts.state,ts.binding_state
  FROM app.trusted_session ts
 WHERE app_private.has_current_authority(
   'SESSION_AUDIT',NULL,NULL,NULL,ts.principal_id
 );

ALTER VIEW app.authority_grant_v OWNER TO elevator_review_function_owner;
ALTER VIEW app.trusted_session_audit_v OWNER TO elevator_review_function_owner;

ALTER FUNCTION app.activate_trusted_session(text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.add_selection_candidate(text,text,text,text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.advance_principal_epoch(text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.build_snapshot_basis_r6(text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.complete_selection_candidate_result(text,text,text,text,text,text,text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.create_policy_revision(text,text,text,bigint,text,text,text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.create_professional_review(text,text,text,text,text,text,text,text,text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.create_selection_run(text,text,text,bigint,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.create_snapshot_r3(text,text,bigint) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.finalize_snapshot_r3(text,bigint) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.has_project_authority(text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.issue_authority_grant(text,text,text,text,text,text,text,timestamptz) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.open_trusted_session(text,text,bigint,text,text,text,text,text,timestamptz,timestamptz,timestamptz) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.policy_digest(text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.policy_is_effective(text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.record_selection_catalog_review_result(text,text,text,text,text,text,timestamptz,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.record_selection_missing_field_result(text,text,text,text,text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.record_selection_professional_review_result(text,text,text,bigint,text,text,text,text,timestamptz,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.record_selection_requirement_field(text,text,text,jsonb,text,text,text,text,text,text,boolean,text,text,text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.record_selection_source_result(text,text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.record_selection_warning_result(text,text,bigint,text,text,text,text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.register_session_role(text,text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.revoke_authority_grant(text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.revoke_trusted_session(text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.seal_selection_run(text,bigint,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.selection_result_digest(text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.set_selection_candidate_parameter(text,text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.set_selection_candidate_price(text,text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.snapshot_record_count(text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.source_key_r3(text,text,text,boolean,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.transition_policy_review(text,bigint,app.policy_command,text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.transition_professional_review(text,bigint,app.professional_review_command,text,text,text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.verify_snapshot_basis_r6(bytea,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.append_selection_run_event(text,text,text,text,text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.assert_active_session(text,text,bigint) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.canonical_row_payload_r3(text,jsonb) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.claim_command_request(text,text,text,text,text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.complete_command_request(text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.compute_selection_row_digest_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.current_session_context() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.deny_delete_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.deny_snapshot_truncate_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.deny_truncate_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.dispatch_snapshot_validation_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.guard_append_only_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.guard_authority_grant_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.guard_command_request_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.guard_policy_current_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.guard_policy_event_link_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.guard_policy_revision_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.guard_sealed_result_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.guard_selection_run_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.guard_session_role_registry_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.guard_snapshot_child_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.guard_snapshot_header_r3() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.has_current_authority(text,text,text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.i64be(bigint) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.lock_active_session(text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.lock_authority_grant(text,text,text,text,text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.lock_current_session() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.materialize_snapshot_r3(text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.r6_field(integer,integer,integer,bytea) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.r6_field_allowed(smallint,integer,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.r6_record(smallint,text,bytea,jsonb) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.r6_request_hash(jsonb) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.refresh_snapshot_basis_records_r3(text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.require_no_active_snapshot_children_r3(text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.row_digest_r3(text,text,jsonb) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.session_token_digest(text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.sha256_hex(bytea) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.snapshot_record_projection_r3(text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.stable_key_r3(smallint,jsonb) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.u16be(integer) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.u32be(bigint) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.u64be(bigint) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.validate_session_role_r3(text,text,text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.validate_snapshot_r3(text) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.verify_snapshot_row_digest_r3() OWNER TO elevator_review_function_owner;

ALTER ROLE elevator_runtime_web NOLOGIN;
ALTER ROLE elevator_runtime_worker NOLOGIN;
ALTER ROLE elevator_readonly_auditor NOLOGIN;
ALTER ROLE elevator_reporting_readonly NOLOGIN;
CREATE ROLE elevator_session_bootstrap NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

ALTER TABLE app.session_role_registry OWNER TO elevator_table_owner;
ALTER TABLE app.session_binding_audit OWNER TO elevator_table_owner;
ALTER TABLE app.command_request OWNER TO elevator_table_owner;
ALTER TABLE app.selection_run_event OWNER TO elevator_table_owner;
ALTER VIEW app.trusted_session_audit_v OWNER TO elevator_review_function_owner;

GRANT USAGE ON SCHEMA app TO
  elevator_table_owner,elevator_review_function_owner,elevator_identity_broker,
  elevator_runtime_web,elevator_runtime_worker,elevator_professional_reviewer,
  elevator_policy_author,elevator_policy_reviewer,elevator_security_admin,
  elevator_readonly_auditor,elevator_reporting_readonly,elevator_session_bootstrap;
GRANT USAGE ON SCHEMA app_private TO elevator_review_function_owner;
GRANT USAGE ON TYPE app.policy_command, app.professional_review_command TO
  elevator_table_owner,elevator_review_function_owner,
  elevator_runtime_worker,elevator_professional_reviewer,
  elevator_policy_author,elevator_policy_reviewer,
  elevator_security_admin,elevator_session_bootstrap;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA app TO elevator_review_function_owner;
GRANT USAGE,SELECT,UPDATE ON ALL SEQUENCES IN SCHEMA app TO elevator_review_function_owner;

REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM
  elevator_identity_broker,elevator_runtime_web,elevator_runtime_worker,
  elevator_professional_reviewer,elevator_policy_author,elevator_policy_reviewer,
  elevator_security_admin,elevator_readonly_auditor,elevator_reporting_readonly,
  elevator_session_bootstrap;
REVOKE ALL ON ALL VIEWS IN SCHEMA app FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.register_session_role(text,text,text,text) TO elevator_identity_broker;
GRANT EXECUTE ON FUNCTION app.open_trusted_session(text,text,bigint,text,text,text,text,text,timestamptz,timestamptz,timestamptz) TO elevator_identity_broker;
GRANT EXECUTE ON FUNCTION app.revoke_trusted_session(text,text) TO elevator_identity_broker;
GRANT EXECUTE ON FUNCTION app.advance_principal_epoch(text,text) TO elevator_identity_broker;
GRANT EXECUTE ON FUNCTION app.activate_trusted_session(text,text) TO elevator_session_bootstrap;
GRANT EXECUTE ON FUNCTION app.issue_authority_grant(text,text,text,text,text,text,text,timestamptz) TO elevator_security_admin;
GRANT EXECUTE ON FUNCTION app.revoke_authority_grant(text,text) TO elevator_security_admin;
GRANT EXECUTE ON FUNCTION app.create_policy_revision(text,text,text,bigint,text,text,text,text,text) TO elevator_policy_author;
GRANT EXECUTE ON FUNCTION app.transition_policy_review(text,bigint,app.policy_command,text,text,text) TO elevator_policy_author,elevator_policy_reviewer;
GRANT EXECUTE ON FUNCTION app.create_professional_review(text,text,text,text,text,text,text,text,text,text,text) TO elevator_professional_reviewer;
GRANT EXECUTE ON FUNCTION app.transition_professional_review(text,bigint,app.professional_review_command,text,text,text,text,text) TO elevator_professional_reviewer;
GRANT EXECUTE ON FUNCTION app.create_selection_run(text,text,text,bigint,text,text) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.add_selection_candidate(text,text,text,text,text,text) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.set_selection_candidate_price(text,text,text,text) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.set_selection_candidate_parameter(text,text,text,text) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.complete_selection_candidate_result(text,text,text,text,text,text,text,text,text) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.record_selection_requirement_field(text,text,text,jsonb,text,text,text,text,text,text,boolean,text,text,text,text,text) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.record_selection_source_result(text,text,text,text) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.record_selection_catalog_review_result(text,text,text,text,text,text,timestamptz,text,text) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.record_selection_professional_review_result(text,text,text,bigint,text,text,text,text,timestamptz,text,text) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.record_selection_warning_result(text,text,bigint,text,text,text,text,text,text) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.record_selection_missing_field_result(text,text,text,text,text,text,text) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.seal_selection_run(text,bigint,text) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.create_snapshot_r3(text,text,bigint) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.finalize_snapshot_r3(text,bigint) TO elevator_runtime_worker;

GRANT SELECT ON app.current_policy_revision_v,app.current_sales_snapshot_v,
  app.current_professional_review_v,app.selection_result_read_v
  TO elevator_runtime_web,elevator_runtime_worker;
GRANT SELECT ON app.current_policy_revision_v,app.audit_policy_events_v,
  app.current_sales_snapshot_v,app.current_professional_review_v,
  app.audit_professional_review_events_v,app.trusted_session_status_v,
  app.trusted_session_audit_v,app.authority_grant_v,app.selection_result_read_v
  TO elevator_readonly_auditor;
GRANT SELECT ON app.current_policy_revision_v,app.current_sales_snapshot_v,
  app.current_professional_review_v,app.selection_result_read_v
  TO elevator_reporting_readonly;

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
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_review_function_owner IN SCHEMA app REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_review_function_owner IN SCHEMA app REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_review_function_owner IN SCHEMA app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_review_function_owner IN SCHEMA app REVOKE USAGE ON TYPES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_function_owner IN SCHEMA app REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_function_owner IN SCHEMA app REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_function_owner IN SCHEMA app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE elevator_function_owner IN SCHEMA app REVOKE USAGE ON TYPES FROM PUBLIC;

-- ===== END R3-C8 FINAL-STATE CORRECTIONS =====

-- ===== END FROZEN R3-C8 BASELINE =====

-- ===== BEGIN R3-C8 CORRECTIONS OVERLAY =====
-- FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS
-- Final-state corrections over DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql.
-- DESIGN ONLY. This file has not been executed.
-- Historical protocol compatibility marker: C6-SNAP-01 = 15 records, 4036 bytes,
-- SHA-256 7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB.

-- Exact target keys required before subsequent ALTER TABLE foreign keys.
ALTER TABLE app.selection_candidate
  ADD CONSTRAINT selection_candidate_run_unique_early_c8c
  UNIQUE (id,selection_run_id);
ALTER TABLE app.product_revision
  ADD CONSTRAINT product_revision_id_digest_unique_early_c8c
  UNIQUE (id,content_digest);
ALTER TABLE app.selection_candidate_result
  ADD CONSTRAINT selection_result_id_candidate_digest_unique_early_c8c
  UNIQUE (id,candidate_id,row_digest);

-- P1-01: immutable price fact and full-content row digests

ALTER TABLE app.price_revision
  ADD COLUMN product_revision_digest text,
  ADD COLUMN specification_revision_digest text,
  ADD COLUMN price_unit_code text,
  ADD COLUMN quantity_min numeric(18,6),
  ADD COLUMN quantity_max numeric(18,6),
  ADD COLUMN fact_digest text;

ALTER TABLE app.price_revision
  ADD CONSTRAINT price_revision_product_digest_fk
    FOREIGN KEY (product_id,product_revision_id,product_revision_digest)
    REFERENCES app.product_revision(product_id,id,content_digest),
  ADD CONSTRAINT price_revision_specification_digest_fk
    FOREIGN KEY (
      product_id,product_revision_id,
      specification_revision_id,specification_revision_digest
    ) REFERENCES app.specification_revision(
      product_id,product_revision_id,id,content_digest
    ),
  ADD CONSTRAINT price_revision_validity_check
    CHECK (valid_until IS NULL OR valid_until>valid_from),
  ADD CONSTRAINT price_revision_quantity_check CHECK (
    (quantity_min IS NULL AND quantity_max IS NULL)
    OR (quantity_min IS NOT NULL AND quantity_max IS NOT NULL
        AND quantity_min>0 AND quantity_max>=quantity_min)
  ),
  ADD CONSTRAINT price_revision_unit_check CHECK (
    price_unit_code IS NULL OR price_unit_code ~ '^[A-Z][A-Z0-9_]{1,31}$'
  );

CREATE OR REPLACE FUNCTION app_private.price_fact_canonical_v1(
  p_price_revision_id text,
  p_source_revision_id text,
  p_product_id text,
  p_product_revision_id text,
  p_product_revision_digest text,
  p_specification_revision_id text,
  p_specification_revision_digest text,
  p_amount_minor bigint,
  p_currency text,
  p_price_basis text,
  p_tax_basis text,
  p_applicability text,
  p_valid_from timestamptz,
  p_valid_until timestamptz,
  p_quoted_at timestamptz,
  p_price_unit_code text,
  p_quantity_min numeric,
  p_quantity_max numeric
) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path=pg_catalog
RETURN jsonb_build_object(
  'schema','AIEA-PRICE-FACT-V1',
  'priceRevisionId',p_price_revision_id,
  'sourceRevisionId',p_source_revision_id,
  'productId',p_product_id,
  'productRevisionId',p_product_revision_id,
  'productRevisionDigest',p_product_revision_digest,
  'specificationRevisionId',p_specification_revision_id,
  'specificationRevisionDigest',p_specification_revision_digest,
  'amountMinor',p_amount_minor::text,
  'currency',upper(p_currency),
  'priceBasis',p_price_basis,
  'taxBasis',p_tax_basis,
  'applicability',p_applicability,
  'validFromUtc',to_char(p_valid_from AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'validUntilUtc',CASE WHEN p_valid_until IS NULL THEN NULL
    ELSE to_char(p_valid_until AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END,
  'quotedAtUtc',to_char(p_quoted_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'priceUnitCode',p_price_unit_code,
  'quantityMin',CASE WHEN p_quantity_min IS NULL THEN NULL ELSE p_quantity_min::text END,
  'quantityMax',CASE WHEN p_quantity_max IS NULL THEN NULL ELSE p_quantity_max::text END
);

CREATE OR REPLACE FUNCTION app_private.price_fact_digest_v1(
  p_price_revision_id text,
  p_source_revision_id text,
  p_product_id text,
  p_product_revision_id text,
  p_product_revision_digest text,
  p_specification_revision_id text,
  p_specification_revision_digest text,
  p_amount_minor bigint,
  p_currency text,
  p_price_basis text,
  p_tax_basis text,
  p_applicability text,
  p_valid_from timestamptz,
  p_valid_until timestamptz,
  p_quoted_at timestamptz,
  p_price_unit_code text,
  p_quantity_min numeric,
  p_quantity_max numeric
) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path=pg_catalog,app_private
RETURN app_private.sha256_hex(
  decode('414945412D50524943452D4641435400763100','hex')
  || convert_to(app_private.price_fact_canonical_v1(
    p_price_revision_id,p_source_revision_id,p_product_id,
    p_product_revision_id,p_product_revision_digest,
    p_specification_revision_id,p_specification_revision_digest,
    p_amount_minor,p_currency,p_price_basis,p_tax_basis,p_applicability,
    p_valid_from,p_valid_until,p_quoted_at,p_price_unit_code,
    p_quantity_min,p_quantity_max
  )::text,'UTF8')
);

CREATE OR REPLACE FUNCTION app_private.a_compute_price_revision_fact_digest_r3()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    RAISE EXCEPTION 'price revision immutable' USING ERRCODE='23514';
  END IF;
  NEW.fact_digest := app_private.price_fact_digest_v1(
    NEW.id,NEW.source_revision_id,NEW.product_id,NEW.product_revision_id,
    NEW.product_revision_digest,NEW.specification_revision_id,
    NEW.specification_revision_digest,NEW.amount_minor,NEW.currency,
    NEW.price_basis,NEW.tax_basis,NEW.applicability,NEW.valid_from,
    NEW.valid_until,NEW.quoted_at,NEW.price_unit_code,NEW.quantity_min,
    NEW.quantity_max
  );
  RETURN NEW;
END
$$;

CREATE TRIGGER a_compute_price_revision_fact_digest_r3
BEFORE INSERT ON app.price_revision
FOR EACH ROW EXECUTE FUNCTION app_private.a_compute_price_revision_fact_digest_r3();

CREATE TRIGGER guard_price_revision_r3
BEFORE UPDATE OR DELETE ON app.price_revision
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();

CREATE TRIGGER deny_price_revision_truncate_r3
BEFORE TRUNCATE ON app.price_revision
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();

ALTER TABLE app.price_revision
  ALTER COLUMN product_revision_digest SET NOT NULL,
  ALTER COLUMN specification_revision_digest SET NOT NULL,
  ALTER COLUMN fact_digest SET NOT NULL,
  ADD CONSTRAINT price_revision_fact_digest_check
    CHECK (fact_digest ~ '^[0-9a-f]{64}$');

ALTER TABLE app.price_revision
  ADD CONSTRAINT price_revision_fact_identity_unique
  UNIQUE (
    id,source_revision_id,product_id,product_revision_id,
    product_revision_digest,specification_revision_id,
    specification_revision_digest,fact_digest
  );

ALTER TABLE app.selection_candidate_price
  ADD COLUMN selection_run_id text,
  ADD COLUMN product_revision_digest text,
  ADD COLUMN specification_revision_digest text,
  ADD COLUMN price_fact_digest text,
  ADD COLUMN amount_minor bigint,
  ADD COLUMN currency text,
  ADD COLUMN price_basis text,
  ADD COLUMN tax_basis text,
  ADD COLUMN applicability text,
  ADD COLUMN valid_from timestamptz,
  ADD COLUMN valid_until timestamptz,
  ADD COLUMN quoted_at timestamptz,
  ADD COLUMN price_unit_code text,
  ADD COLUMN quantity_min numeric(18,6),
  ADD COLUMN quantity_max numeric(18,6);

CREATE OR REPLACE FUNCTION app_private.a_fill_selection_price_fact_r3()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  pr app.price_revision%ROWTYPE;
  v_run_id text;
BEGIN
  SELECT * INTO STRICT pr FROM app.price_revision
   WHERE id=NEW.price_revision_id
     AND product_id=NEW.product_id
     AND product_revision_id=NEW.product_revision_id
     AND specification_revision_id=NEW.specification_revision_id
     AND source_revision_id=NEW.source_revision_id
   FOR SHARE;
  SELECT c.selection_run_id INTO STRICT v_run_id
    FROM app.selection_candidate c
   WHERE c.id=NEW.candidate_id;
  NEW.selection_run_id := v_run_id;
  NEW.product_revision_digest := pr.product_revision_digest;
  NEW.specification_revision_digest := pr.specification_revision_digest;
  NEW.price_fact_digest := pr.fact_digest;
  NEW.amount_minor := pr.amount_minor;
  NEW.currency := upper(pr.currency);
  NEW.price_basis := pr.price_basis;
  NEW.tax_basis := pr.tax_basis;
  NEW.applicability := pr.applicability;
  NEW.valid_from := pr.valid_from;
  NEW.valid_until := pr.valid_until;
  NEW.quoted_at := pr.quoted_at;
  NEW.price_unit_code := pr.price_unit_code;
  NEW.quantity_min := pr.quantity_min;
  NEW.quantity_max := pr.quantity_max;
  RETURN NEW;
END
$$;

CREATE TRIGGER a_fill_selection_price_fact_r3
BEFORE INSERT OR UPDATE ON app.selection_candidate_price
FOR EACH ROW EXECUTE FUNCTION app_private.a_fill_selection_price_fact_r3();

CREATE OR REPLACE FUNCTION app_private.price_row_payload_v1(p_table text,p_row jsonb)
RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path=pg_catalog
RETURN jsonb_build_object(
  'candidateId',p_row->>'candidate_id',
  'selectionRunId',p_row->>'selection_run_id',
  'priceRevisionId',p_row->>'price_revision_id',
  'sourceRevisionId',p_row->>'source_revision_id',
  'productId',p_row->>'product_id',
  'productRevisionId',p_row->>'product_revision_id',
  'productRevisionDigest',p_row->>'product_revision_digest',
  'specificationRevisionId',p_row->>'specification_revision_id',
  'specificationRevisionDigest',p_row->>'specification_revision_digest',
  'priceFactDigest',p_row->>'price_fact_digest',
  'amountMinor',p_row->>'amount_minor',
  'currency',p_row->>'currency',
  'priceBasis',p_row->>'price_basis',
  'taxBasis',p_row->>'tax_basis',
  'applicability',p_row->>'applicability',
  'validFrom',p_row->>'valid_from',
  'validUntil',p_row->'valid_until',
  'quotedAt',p_row->>'quoted_at',
  'priceUnitCode',p_row->'price_unit_code',
  'quantityMin',p_row->'quantity_min',
  'quantityMax',p_row->'quantity_max'
);

CREATE OR REPLACE FUNCTION app_private.price_row_digest_v1(p_table text,p_row jsonb)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path=pg_catalog,app_private
RETURN app_private.sha256_hex(
  decode('414945412D50524943452D524F5700763100','hex')
  || convert_to(p_table||E'\x1F'||app_private.price_row_payload_v1(p_table,p_row)::text,'UTF8')
);

CREATE OR REPLACE FUNCTION app_private.a_compute_selection_price_row_digest_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  NEW.row_digest := app_private.price_row_digest_v1('selection_candidate_price',to_jsonb(NEW));
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS a_compute_selection_price_digest ON app.selection_candidate_price;
CREATE TRIGGER z_compute_selection_price_row_digest_r3
BEFORE INSERT OR UPDATE ON app.selection_candidate_price
FOR EACH ROW EXECUTE FUNCTION app_private.a_compute_selection_price_row_digest_r3();

ALTER TABLE app.selection_candidate_price
  ALTER COLUMN selection_run_id SET NOT NULL,
  ALTER COLUMN product_revision_digest SET NOT NULL,
  ALTER COLUMN specification_revision_digest SET NOT NULL,
  ALTER COLUMN price_fact_digest SET NOT NULL,
  ALTER COLUMN amount_minor SET NOT NULL,
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN price_basis SET NOT NULL,
  ALTER COLUMN tax_basis SET NOT NULL,
  ALTER COLUMN applicability SET NOT NULL,
  ALTER COLUMN valid_from SET NOT NULL,
  ALTER COLUMN quoted_at SET NOT NULL,
  ADD CONSTRAINT selection_candidate_price_fact_fk
    FOREIGN KEY (
      price_revision_id,source_revision_id,product_id,product_revision_id,
      product_revision_digest,specification_revision_id,
      specification_revision_digest,price_fact_digest
    ) REFERENCES app.price_revision(
      id,source_revision_id,product_id,product_revision_id,
      product_revision_digest,specification_revision_id,
      specification_revision_digest,fact_digest
    ),
  ADD CONSTRAINT selection_candidate_price_run_fk
    FOREIGN KEY (candidate_id,selection_run_id)
    REFERENCES app.selection_candidate(id,selection_run_id),
  ADD CONSTRAINT selection_candidate_price_currency_check
    CHECK (currency ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT selection_candidate_price_validity_check
    CHECK (valid_until IS NULL OR valid_until>valid_from),
  ADD CONSTRAINT selection_candidate_price_fact_digest_check
    CHECK (price_fact_digest ~ '^[0-9a-f]{64}$');

ALTER TABLE app.sales_snapshot_price_r3
  ADD COLUMN product_revision_digest text,
  ADD COLUMN specification_revision_digest text,
  ADD COLUMN price_fact_digest text,
  ADD COLUMN price_unit_code text,
  ADD COLUMN quantity_min numeric(18,6),
  ADD COLUMN quantity_max numeric(18,6);

CREATE OR REPLACE FUNCTION app_private.a_fill_snapshot_price_fact_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  src app.selection_candidate_price%ROWTYPE;
BEGIN
  SELECT * INTO STRICT src FROM app.selection_candidate_price
   WHERE candidate_id=NEW.candidate_id
     AND price_revision_id=NEW.price_revision_id
   FOR SHARE;
  IF NEW.selection_run_id IS DISTINCT FROM src.selection_run_id THEN
    RAISE EXCEPTION 'snapshot price selection run mismatch' USING ERRCODE='23514';
  END IF;
  NEW.candidate_row_id := src.candidate_id;
  NEW.product_id := src.product_id;
  NEW.product_revision_id := src.product_revision_id;
  NEW.product_revision_digest := src.product_revision_digest;
  NEW.specification_revision_id := src.specification_revision_id;
  NEW.specification_revision_digest := src.specification_revision_digest;
  NEW.source_revision_id := src.source_revision_id;
  NEW.amount_minor := src.amount_minor;
  NEW.currency := src.currency;
  NEW.price_basis := src.price_basis;
  NEW.tax_basis := src.tax_basis;
  NEW.applicability := src.applicability;
  NEW.valid_from := src.valid_from;
  NEW.valid_until := src.valid_until;
  NEW.quoted_at := src.quoted_at;
  NEW.price_fact_digest := src.price_fact_digest;
  NEW.price_unit_code := src.price_unit_code;
  NEW.quantity_min := src.quantity_min;
  NEW.quantity_max := src.quantity_max;
  NEW.source_row_digest := src.row_digest;
  RETURN NEW;
END
$$;

CREATE TRIGGER a_fill_snapshot_price_fact_r3
BEFORE INSERT OR UPDATE ON app.sales_snapshot_price_r3
FOR EACH ROW EXECUTE FUNCTION app_private.a_fill_snapshot_price_fact_r3();

CREATE OR REPLACE FUNCTION app_private.a_verify_snapshot_price_fact_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_expected text;
BEGIN
  v_expected := app_private.price_row_digest_v1(
    'sales_snapshot_price_r3',to_jsonb(NEW)
  );
  IF NEW.source_row_digest IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'snapshot price fact digest mismatch' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS a_verify_snapshot_price_digest ON app.sales_snapshot_price_r3;
CREATE TRIGGER z_verify_snapshot_price_fact_r3
BEFORE INSERT OR UPDATE ON app.sales_snapshot_price_r3
FOR EACH ROW EXECUTE FUNCTION app_private.a_verify_snapshot_price_fact_r3();

ALTER TABLE app.sales_snapshot_price_r3
  ALTER COLUMN product_revision_digest SET NOT NULL,
  ALTER COLUMN specification_revision_digest SET NOT NULL,
  ALTER COLUMN price_fact_digest SET NOT NULL,
  ALTER COLUMN source_row_digest SET NOT NULL,
  ADD CONSTRAINT snapshot_price_fact_digest_check
    CHECK (price_fact_digest ~ '^[0-9a-f]{64}$');

ALTER TABLE app.sales_snapshot_price_r3
  DROP CONSTRAINT snapshot_price_source_digest_fk;
ALTER TABLE app.selection_candidate_price
  DROP CONSTRAINT selection_candidate_price_row_digest_unique;
ALTER TABLE app.selection_candidate_price
  ADD CONSTRAINT selection_candidate_price_row_digest_unique
  UNIQUE (candidate_id,price_revision_id,price_fact_digest,row_digest);

ALTER TABLE app.sales_snapshot_price_r3
  ADD CONSTRAINT snapshot_price_selection_fact_fk
  FOREIGN KEY (candidate_id,price_revision_id,price_fact_digest,source_row_digest)
  REFERENCES app.selection_candidate_price(
    candidate_id,price_revision_id,price_fact_digest,row_digest
  );

-- P1-02(A): authoritative Requirement assertion and FieldValue chain

CREATE TABLE app.requirement_assertion_r3 (
  id text PRIMARY KEY,
  requirement_version_id text NOT NULL,
  requirement_id text NOT NULL,
  project_id text NOT NULL,
  conversation_id text NOT NULL,
  installation_scenario text NOT NULL,
  field_key text NOT NULL,
  source_kind text NOT NULL CHECK (
    source_kind IN (
      'USER_ASSERTION','PRODUCT_DOCUMENT','PRICE_SHEET',
      'CATALOG_REVIEW','PROFESSIONAL_REVIEW','SYSTEM_RULE'
    )
  ),
  source_entity_type text NOT NULL,
  source_aux_is_null boolean NOT NULL,
  source_aux_text text,
  actor_principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  actor_session_id text NOT NULL REFERENCES app.trusted_session(session_id),
  actor_authority_grant_id text NOT NULL,
  request_id text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz(6) NOT NULL,
  content_digest text NOT NULL CHECK (content_digest ~ '^[0-9a-f]{64}$'),
  FOREIGN KEY (
    requirement_version_id,requirement_id,project_id,
    conversation_id,installation_scenario
  ) REFERENCES app.requirement_version(
    id,requirement_id,project_id,conversation_id,installation_scenario
  ),
  UNIQUE (
    id,requirement_version_id,requirement_id,project_id,
    conversation_id,installation_scenario,field_key,content_digest
  ),
  UNIQUE (actor_session_id,request_id),
  CHECK (
    (source_aux_is_null AND source_aux_text IS NULL)
    OR (NOT source_aux_is_null
        AND source_aux_text IS NOT NULL
        AND octet_length(source_aux_text) BETWEEN 1 AND 128)
  )
);

ALTER TABLE app.requirement_assertion_r3
  ADD CONSTRAINT requirement_assertion_context_exact_unique_early_c8c
  UNIQUE (
    id,requirement_version_id,requirement_id,project_id,
    conversation_id,installation_scenario,field_key
  );
ALTER TABLE app.requirement_assertion_r3
  ADD CONSTRAINT requirement_assertion_digest_exact_unique_early_c8c
  UNIQUE (id,requirement_version_id,field_key,content_digest);

CREATE TABLE app.requirement_field_value_r3 (
  id text PRIMARY KEY,
  assertion_id text NOT NULL,
  requirement_version_id text NOT NULL,
  requirement_id text NOT NULL,
  project_id text NOT NULL,
  conversation_id text NOT NULL,
  installation_scenario text NOT NULL,
  field_key text NOT NULL,
  value_json jsonb NOT NULL,
  value_type text NOT NULL,
  unit text,
  field_status text NOT NULL,
  content_digest text NOT NULL CHECK (content_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz(6) NOT NULL,
  FOREIGN KEY (
    assertion_id,requirement_version_id,requirement_id,
    project_id,conversation_id,installation_scenario,field_key
  ) REFERENCES app.requirement_assertion_r3(
    id,requirement_version_id,requirement_id,
    project_id,conversation_id,installation_scenario,field_key
  ),
  UNIQUE (
    id,requirement_version_id,requirement_id,project_id,
    conversation_id,installation_scenario,field_key,content_digest
  )
);

ALTER TABLE app.requirement_field_value_r3
  ADD CONSTRAINT requirement_value_digest_exact_unique_early_c8c
  UNIQUE (id,requirement_version_id,field_key,content_digest);

CREATE OR REPLACE FUNCTION app_private.requirement_source_digest_r3(
  p_table text,
  p_row jsonb
) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path=pg_catalog,app_private
RETURN app_private.sha256_hex(
  decode('414945412D524551554952454D454E5400763100','hex')
  || convert_to(
    p_table||E'\x1F'||jsonb_build_object(
      'id',p_row->>'id',
      'requirementVersionId',p_row->>'requirement_version_id',
      'requirementId',p_row->>'requirement_id',
      'projectId',p_row->>'project_id',
      'conversationId',p_row->>'conversation_id',
      'installationScenario',p_row->>'installation_scenario',
      'fieldKey',p_row->>'field_key',
      'value',p_row->'value_json',
      'valueType',p_row->>'value_type',
      'unit',p_row->'unit',
      'fieldStatus',p_row->>'field_status',
      'sourceKind',p_row->>'source_kind',
      'sourceEntityType',p_row->>'source_entity_type',
      'sourceEntityId',CASE
        WHEN p_table='requirement_field_value_r3'
          THEN p_row->>'assertion_id'
        ELSE p_row->>'source_entity_id'
      END,
      'sourceAuxIsNull',p_row->'source_aux_is_null',
      'sourceAuxText',p_row->'source_aux_text',
      'actorPrincipalId',p_row->>'actor_principal_id',
      'actorSessionId',p_row->>'actor_session_id',
      'actorAuthorityGrantId',p_row->>'actor_authority_grant_id',
      'occurredAt',p_row->>'occurred_at'
    )::text,
    'UTF8'
  )
);

CREATE OR REPLACE FUNCTION app_private.validate_source_aux_r3(p_value text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE
SET search_path=pg_catalog
AS $$
DECLARE
  v_value text;
BEGIN
  v_value:=normalize(p_value,NFC);
  IF octet_length(v_value) NOT BETWEEN 1 AND 128
     OR v_value ~ '[\x00-\x1F\x7F-\x9F]' THEN
    RAISE EXCEPTION 'source auxiliary domain' USING ERRCODE='22023';
  END IF;
  RETURN v_value;
END
$$;

CREATE OR REPLACE FUNCTION app_private.a_compute_requirement_source_digest_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  IF TG_TABLE_NAME='requirement_assertion_r3' THEN
    NEW.content_digest := app_private.requirement_source_digest_r3(
      TG_TABLE_NAME,to_jsonb(NEW)
    );
  ELSE
    NEW.content_digest := app_private.requirement_source_digest_r3(
      TG_TABLE_NAME,to_jsonb(NEW)
    );
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER a_compute_requirement_assertion_digest_r3
BEFORE INSERT OR UPDATE ON app.requirement_assertion_r3
FOR EACH ROW EXECUTE FUNCTION app_private.a_compute_requirement_source_digest_r3();
CREATE TRIGGER a_compute_requirement_value_digest_r3
BEFORE INSERT OR UPDATE ON app.requirement_field_value_r3
FOR EACH ROW EXECUTE FUNCTION app_private.a_compute_requirement_source_digest_r3();
CREATE TRIGGER guard_requirement_assertion_r3
BEFORE UPDATE OR DELETE ON app.requirement_assertion_r3
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER guard_requirement_value_r3
BEFORE UPDATE OR DELETE ON app.requirement_field_value_r3
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER deny_requirement_assertion_truncate_r3
BEFORE TRUNCATE ON app.requirement_assertion_r3
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER deny_requirement_value_truncate_r3
BEFORE TRUNCATE ON app.requirement_field_value_r3
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();

CREATE OR REPLACE FUNCTION app.create_requirement_field_fact_r3(
  p_assertion_id text,
  p_value_id text,
  p_requirement_version_id text,
  p_field_key text,
  p_value_json jsonb,
  p_value_type text,
  p_unit text,
  p_field_status text,
  p_source_kind text,
  p_source_entity_type text,
  p_source_aux_is_null boolean,
  p_source_aux_text text,
  p_request_id text,
  p_request_key text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  rv app.requirement_version%ROWTYPE;
  v_grant_id text;
  v_hash text;
  v_aux text;
  v_replay boolean;
  v_result text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT rv FROM app.requirement_version
   WHERE id=p_requirement_version_id FOR SHARE;
  v_grant_id := app_private.lock_authority_grant(
    s.session_id,s.principal_id,'REQUIREMENT_WRITE',
    rv.project_id,NULL,NULL,NULL
  );
  IF p_source_aux_is_null THEN
    IF p_source_aux_text IS NOT NULL THEN
      RAISE EXCEPTION 'requirement source aux mismatch' USING ERRCODE='22023';
    END IF;
    v_aux:=NULL;
  ELSE
    v_aux:=app_private.validate_source_aux_r3(p_source_aux_text);
  END IF;
  v_hash:=app_private.r6_request_hash(jsonb_build_object(
    'operation','REQUIREMENT_FACT_CREATE',
    'assertionId',p_assertion_id,'valueId',p_value_id,
    'requirementVersionId',p_requirement_version_id,
    'fieldKey',p_field_key,'value',p_value_json,'valueType',p_value_type,
    'unit',p_unit,'fieldStatus',p_field_status,'sourceKind',p_source_kind,
    'sourceEntityType',p_source_entity_type,'sourceAux',v_aux,
    'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'REQUIREMENT_FACT_CREATE',p_request_id,v_hash,rv.id,
    s.principal_id,s.session_id,'REQUIREMENT_FIELD_VALUE'
  );
  IF v_replay THEN
    PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
    RETURN v_result;
  END IF;
  INSERT INTO app.requirement_assertion_r3(
    id,requirement_version_id,requirement_id,project_id,conversation_id,
    installation_scenario,field_key,source_kind,source_entity_type,
    source_aux_is_null,source_aux_text,actor_principal_id,actor_session_id,
    actor_authority_grant_id,request_id,request_hash,occurred_at,content_digest
  ) VALUES(
    p_assertion_id,p_requirement_version_id,rv.requirement_id,rv.project_id,
    rv.conversation_id,rv.installation_scenario,p_field_key,p_source_kind,
    p_source_entity_type,p_source_aux_is_null,v_aux,s.principal_id,
    s.session_id,v_grant_id,p_request_id,v_hash,clock_timestamp(),
    repeat('0',64)
  );
  INSERT INTO app.requirement_field_value_r3(
    id,assertion_id,requirement_version_id,requirement_id,project_id,
    conversation_id,installation_scenario,field_key,value_json,value_type,
    unit,field_status,content_digest,created_at
  ) VALUES(
    p_value_id,p_assertion_id,p_requirement_version_id,rv.requirement_id,
    rv.project_id,rv.conversation_id,rv.installation_scenario,p_field_key,
    p_value_json,p_value_type,p_unit,p_field_status,
    repeat('0',64),clock_timestamp()
  );
  PERFORM app_private.complete_command_request(
    'REQUIREMENT_FACT_CREATE',p_request_id,p_value_id
  );
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
  RETURN p_value_id;
END
$$;

ALTER TABLE app.selection_requirement_field
  ADD COLUMN source_assertion_digest text,
  ADD COLUMN source_value_digest text;

ALTER TABLE app.selection_requirement_field
  ADD CONSTRAINT selection_requirement_source_fact_unique_early_c8c
  UNIQUE (
    source_value_id,source_revision_id,source_assertion_digest,
    source_value_digest,row_digest
  );

ALTER TABLE app.selection_requirement_field
  ADD CONSTRAINT selection_requirement_assertion_fk
    FOREIGN KEY (
      source_revision_id,requirement_version_id,field_key,source_assertion_digest
    ) REFERENCES app.requirement_assertion_r3(
      id,requirement_version_id,field_key,content_digest
    ),
  ADD CONSTRAINT selection_requirement_value_fk
    FOREIGN KEY (
      source_value_id,requirement_version_id,field_key,source_value_digest
    ) REFERENCES app.requirement_field_value_r3(
      id,requirement_version_id,field_key,content_digest
    );

ALTER TABLE app.selection_requirement_field
  ALTER COLUMN source_assertion_digest SET NOT NULL,
  ALTER COLUMN source_value_digest SET NOT NULL;

CREATE OR REPLACE FUNCTION app_private.a_bind_selection_requirement_source_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  a app.requirement_assertion_r3%ROWTYPE;
  v app.requirement_field_value_r3%ROWTYPE;
BEGIN
  SELECT * INTO STRICT a FROM app.requirement_assertion_r3
   WHERE id=NEW.source_revision_id
     AND requirement_version_id=NEW.requirement_version_id
     AND field_key=NEW.field_key FOR SHARE;
  SELECT * INTO STRICT v FROM app.requirement_field_value_r3
   WHERE id=NEW.source_value_id
     AND assertion_id=a.id
     AND requirement_version_id=a.requirement_version_id
     AND field_key=a.field_key FOR SHARE;
  IF (NEW.value_json,NEW.value_type,NEW.unit,NEW.field_status)
       IS DISTINCT FROM (v.value_json,v.value_type,v.unit,v.field_status)
     OR (NEW.source_kind,NEW.source_entity_type,
         NEW.source_aux_is_null,NEW.source_aux_text)
       IS DISTINCT FROM (
         a.source_kind,a.source_entity_type,
         a.source_aux_is_null,a.source_aux_text
       ) THEN
    RAISE EXCEPTION 'selection requirement source mismatch' USING ERRCODE='23514';
  END IF;
  NEW.source_assertion_digest:=a.content_digest;
  NEW.source_value_digest:=v.content_digest;
  NEW.row_digest:=app_private.requirement_source_digest_r3(
    'selection_requirement_field',to_jsonb(NEW)
  );
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS a_compute_selection_requirement_digest ON app.selection_requirement_field;
CREATE TRIGGER z_bind_selection_requirement_source_r3
BEFORE INSERT OR UPDATE ON app.selection_requirement_field
FOR EACH ROW EXECUTE FUNCTION app_private.a_bind_selection_requirement_source_r3();

CREATE OR REPLACE FUNCTION app.record_selection_requirement_field(
  p_selection_run_id text,
  p_requirement_version_id text,
  p_field_key text,
  p_value_json jsonb,
  p_value_type text,
  p_unit text,
  p_field_status text,
  p_source_kind text,
  p_source_entity_type text,
  p_source_entity_id text,
  p_source_aux_is_null boolean,
  p_source_aux_text text,
  p_source_value_id text,
  p_source_revision_id text,
  p_request_id text,
  p_request_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  run app.selection_run%ROWTYPE;
  v app.requirement_field_value_r3%ROWTYPE;
  a app.requirement_assertion_r3%ROWTYPE;
  v_grant_id text;
  v_hash text;
  v_replay boolean;
  v_result text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT run FROM app.selection_run
   WHERE id=p_selection_run_id AND state='RUNNING' FOR UPDATE;
  v_grant_id:=app_private.lock_authority_grant(
    s.session_id,s.principal_id,'SELECTION_WRITE',run.project_id,NULL,NULL,NULL
  );
  IF run.requirement_version_id<>p_requirement_version_id THEN
    RAISE EXCEPTION 'requirement context mismatch' USING ERRCODE='23514';
  END IF;
  SELECT * INTO STRICT v FROM app.requirement_field_value_r3
   WHERE id=p_source_value_id
     AND requirement_version_id=p_requirement_version_id
     AND field_key=p_field_key FOR SHARE;
  SELECT * INTO STRICT a FROM app.requirement_assertion_r3
   WHERE id=p_source_revision_id
     AND id=v.assertion_id
     AND requirement_version_id=p_requirement_version_id
     AND field_key=p_field_key FOR SHARE;
  IF (p_value_json,p_value_type,p_unit,p_field_status)
       IS DISTINCT FROM (v.value_json,v.value_type,v.unit,v.field_status)
     OR (p_source_entity_id,p_source_kind,p_source_entity_type,
         p_source_aux_is_null,p_source_aux_text)
       IS DISTINCT FROM (
         a.id,a.source_kind,a.source_entity_type,
         a.source_aux_is_null,a.source_aux_text
       ) THEN
    RAISE EXCEPTION 'caller source facts do not match authoritative rows' USING ERRCODE='23514';
  END IF;
  v_hash:=app_private.r6_request_hash(jsonb_build_object(
    'operation','SELECTION_ADD_REQUIREMENT_FIELD','runId',run.id,
    'requirementVersionId',p_requirement_version_id,'fieldKey',p_field_key,
    'sourceValueId',v.id,'sourceAssertionId',a.id,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'SELECTION_ADD_REQUIREMENT_FIELD',p_request_id,v_hash,run.id,
    s.principal_id,s.session_id,'SELECTION_REQUIREMENT_FIELD'
  );
  IF v_replay THEN
    PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
    RETURN;
  END IF;
  INSERT INTO app.selection_requirement_field(
    selection_run_id,requirement_version_id,field_key,value_json,value_type,
    unit,field_status,source_kind,source_entity_type,source_entity_id,
    source_aux_is_null,source_aux_text,source_value_id,source_revision_id,
    source_assertion_digest,source_value_digest
  ) VALUES(
    run.id,p_requirement_version_id,p_field_key,v.value_json,v.value_type,
    v.unit,v.field_status,a.source_kind,a.source_entity_type,a.id,
    a.source_aux_is_null,a.source_aux_text,v.id,a.id,
    a.content_digest,v.content_digest
  );
  PERFORM app_private.append_selection_run_event(
    run.id,'ADD_REQUIREMENT_FIELD',s.principal_id,s.session_id,
    v_grant_id,p_request_id,v_hash
  );
  PERFORM app_private.complete_command_request(
    'SELECTION_ADD_REQUIREMENT_FIELD',p_request_id,
    run.id||':'||p_requirement_version_id||':'||p_field_key
  );
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
END
$$;

ALTER TABLE app.sales_snapshot_requirement_field_r3
  ADD COLUMN source_assertion_digest text,
  ADD COLUMN source_value_digest text;

CREATE OR REPLACE FUNCTION app_private.a_bind_snapshot_requirement_source_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  src app.selection_requirement_field%ROWTYPE;
BEGIN
  SELECT * INTO STRICT src FROM app.selection_requirement_field
   WHERE selection_run_id=NEW.selection_run_id
     AND requirement_version_id=NEW.requirement_version_id
     AND field_key=NEW.field_key FOR SHARE;
  NEW.source_assertion_digest:=src.source_assertion_digest;
  NEW.source_value_digest:=src.source_value_digest;
  NEW.source_row_digest:=src.row_digest;
  RETURN NEW;
END
$$;

CREATE TRIGGER a_bind_snapshot_requirement_source_r3
BEFORE INSERT OR UPDATE ON app.sales_snapshot_requirement_field_r3
FOR EACH ROW EXECUTE FUNCTION app_private.a_bind_snapshot_requirement_source_r3();

ALTER TABLE app.sales_snapshot_requirement_field_r3
  ALTER COLUMN source_assertion_digest SET NOT NULL,
  ALTER COLUMN source_value_digest SET NOT NULL,
  ADD CONSTRAINT snapshot_requirement_source_fact_fk
    FOREIGN KEY (
      source_value_id,source_revision_id,source_assertion_digest,
      source_value_digest,source_row_digest
    ) REFERENCES app.selection_requirement_field(
      source_value_id,source_revision_id,source_assertion_digest,
      source_value_digest,row_digest
    );

ALTER TABLE app.selection_requirement_field
  ADD CONSTRAINT selection_requirement_source_fact_unique
  UNIQUE (
    source_value_id,source_revision_id,source_assertion_digest,
    source_value_digest,row_digest
  );

CREATE OR REPLACE FUNCTION app_private.a_verify_snapshot_requirement_source_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_expected text;
BEGIN
  v_expected:=app_private.requirement_source_digest_r3(
    'sales_snapshot_requirement_field_r3',to_jsonb(NEW)
  );
  IF NEW.source_row_digest IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'snapshot requirement source digest mismatch' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS a_verify_snapshot_requirement_digest
  ON app.sales_snapshot_requirement_field_r3;
CREATE TRIGGER z_verify_snapshot_requirement_source_r3
BEFORE INSERT OR UPDATE ON app.sales_snapshot_requirement_field_r3
FOR EACH ROW EXECUTE FUNCTION app_private.a_verify_snapshot_requirement_source_r3();

-- P1-02(B): immutable Catalogue Review Target/Event

CREATE ROLE elevator_catalog_reviewer
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE elevator_catalog_publisher
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

ALTER TABLE app.price_revision
  ADD CONSTRAINT price_revision_target_unique
  UNIQUE (id,product_id,product_revision_id,specification_revision_id,fact_digest);

CREATE TABLE app.catalog_review_event_r3 (
  id text PRIMARY KEY,
  project_id text REFERENCES app.project(id),
  target_kind text NOT NULL CHECK (
    target_kind IN ('PRODUCT_REVISION','SPECIFICATION_REVISION','PRICE_REVISION')
  ),
  product_id text NOT NULL,
  product_revision_id text,
  product_revision_digest text,
  specification_revision_id text,
  specification_revision_digest text,
  price_revision_id text,
  price_fact_digest text,
  source_revision_id text NOT NULL REFERENCES app.catalog_source_revision(id),
  policy_revision_id text NOT NULL REFERENCES app.policy_revision(id),
  decision text NOT NULL CHECK (decision IN ('APPROVE','REJECT')),
  actor_principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  actor_session_id text NOT NULL REFERENCES app.trusted_session(session_id),
  actor_authority_grant_id text NOT NULL,
  request_id text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  reviewed_at timestamptz(6) NOT NULL,
  content_digest text NOT NULL CHECK (content_digest ~ '^[0-9a-f]{64}$'),
  CHECK (
    (target_kind='PRODUCT_REVISION'
      AND product_revision_id IS NOT NULL
      AND product_revision_digest IS NOT NULL
      AND specification_revision_id IS NULL
      AND price_revision_id IS NULL)
    OR (target_kind='SPECIFICATION_REVISION'
      AND product_revision_id IS NOT NULL
      AND product_revision_digest IS NOT NULL
      AND specification_revision_id IS NOT NULL
      AND specification_revision_digest IS NOT NULL
      AND price_revision_id IS NULL)
    OR (target_kind='PRICE_REVISION'
      AND product_revision_id IS NOT NULL
      AND product_revision_digest IS NOT NULL
      AND specification_revision_id IS NOT NULL
      AND specification_revision_digest IS NOT NULL
      AND price_revision_id IS NOT NULL
      AND price_fact_digest IS NOT NULL)
  ),
  FOREIGN KEY (product_id,product_revision_id,product_revision_digest)
    REFERENCES app.product_revision(product_id,id,content_digest),
  FOREIGN KEY (
    product_id,product_revision_id,specification_revision_id,
    specification_revision_digest
  ) REFERENCES app.specification_revision(
    product_id,product_revision_id,id,content_digest
  ),
  FOREIGN KEY (
    price_revision_id,product_id,product_revision_id,
    specification_revision_id,price_fact_digest
  ) REFERENCES app.price_revision(
    id,product_id,product_revision_id,specification_revision_id,fact_digest
  ),
  UNIQUE (
    id,project_id,target_kind,product_id,product_revision_id,
    product_revision_digest,specification_revision_id,
    specification_revision_digest,price_revision_id,price_fact_digest,
    source_revision_id,policy_revision_id,decision,reviewed_at,content_digest
  ),
  UNIQUE (id,content_digest)
);

CREATE OR REPLACE FUNCTION app_private.catalog_review_event_payload_v1(p_row jsonb)
RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path=pg_catalog
RETURN jsonb_build_object(
  'schema','AIEA-CATALOG-REVIEW-EVENT-V1',
  'id',p_row->>'id','projectId',p_row->'project_id',
  'targetKind',p_row->>'target_kind','productId',p_row->>'product_id',
  'productRevisionId',p_row->'product_revision_id',
  'productRevisionDigest',p_row->'product_revision_digest',
  'specificationRevisionId',p_row->'specification_revision_id',
  'specificationRevisionDigest',p_row->'specification_revision_digest',
  'priceRevisionId',p_row->'price_revision_id',
  'priceFactDigest',p_row->'price_fact_digest',
  'sourceRevisionId',p_row->>'source_revision_id',
  'policyRevisionId',p_row->>'policy_revision_id',
  'decision',p_row->>'decision',
  'actorPrincipalId',p_row->>'actor_principal_id',
  'actorSessionId',p_row->>'actor_session_id',
  'actorAuthorityGrantId',p_row->>'actor_authority_grant_id',
  'reviewedAtUtc',to_char((p_row->>'reviewed_at')::timestamptz AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
);

CREATE OR REPLACE FUNCTION app_private.catalog_review_event_digest_v1(p_row jsonb)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path=pg_catalog,app_private
RETURN app_private.sha256_hex(
  decode('414945412D434154414C4F472D52455649455700763100','hex')
  || convert_to(app_private.catalog_review_event_payload_v1(p_row)::text,'UTF8')
);

CREATE OR REPLACE FUNCTION app_private.a_compute_catalog_review_event_digest_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  NEW.reviewed_at := date_trunc('microseconds',NEW.reviewed_at);
  NEW.content_digest := app_private.catalog_review_event_digest_v1(to_jsonb(NEW));
  RETURN NEW;
END
$$;

CREATE TRIGGER a_compute_catalog_review_event_digest_r3
BEFORE INSERT OR UPDATE ON app.catalog_review_event_r3
FOR EACH ROW EXECUTE FUNCTION app_private.a_compute_catalog_review_event_digest_r3();
CREATE TRIGGER guard_catalog_review_event_r3
BEFORE UPDATE OR DELETE ON app.catalog_review_event_r3
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER deny_catalog_review_event_truncate_r3
BEFORE TRUNCATE ON app.catalog_review_event_r3
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();

CREATE OR REPLACE FUNCTION app.create_catalog_review_event_r3(
  p_event_id text,
  p_project_id text,
  p_target_kind text,
  p_product_id text,
  p_product_revision_id text,
  p_product_revision_digest text,
  p_specification_revision_id text,
  p_specification_revision_digest text,
  p_price_revision_id text,
  p_price_fact_digest text,
  p_source_revision_id text,
  p_policy_revision_id text,
  p_decision text,
  p_request_id text,
  p_request_key text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  v_grant_id text;
  v_hash text;
  v_replay boolean;
  v_result text;
  v_target_id text;
  v_target_digest text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  v_grant_id:=app_private.lock_authority_grant(
    s.session_id,s.principal_id,'CATALOG_REVIEW_WRITE',
    p_project_id,NULL,NULL,NULL
  );
  IF p_target_kind='PRODUCT_REVISION' THEN
    v_target_id:=p_product_revision_id;
    v_target_digest:=p_product_revision_digest;
  ELSIF p_target_kind='SPECIFICATION_REVISION' THEN
    v_target_id:=p_specification_revision_id;
    v_target_digest:=p_specification_revision_digest;
  ELSIF p_target_kind='PRICE_REVISION' THEN
    v_target_id:=p_price_revision_id;
    v_target_digest:=p_price_fact_digest;
  ELSE
    RAISE EXCEPTION 'catalog review target kind invalid' USING ERRCODE='22023';
  END IF;
  IF v_target_id IS NULL OR v_target_digest IS NULL THEN
    RAISE EXCEPTION 'catalog review target missing' USING ERRCODE='22004';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM app.policy_revision pr
     WHERE pr.id=p_policy_revision_id
       AND (p_project_id IS NULL OR pr.scope_project_id=p_project_id)
       AND app.policy_is_effective(pr.id)
  ) THEN
    RAISE EXCEPTION 'catalog review policy is not effective' USING ERRCODE='23514';
  END IF;
  v_hash:=app_private.r6_request_hash(jsonb_build_object(
    'operation','CATALOG_REVIEW_CREATE','eventId',p_event_id,
    'projectId',p_project_id,'targetKind',p_target_kind,
    'productId',p_product_id,'productRevisionId',p_product_revision_id,
    'productRevisionDigest',p_product_revision_digest,
    'specificationRevisionId',p_specification_revision_id,
    'specificationRevisionDigest',p_specification_revision_digest,
    'priceRevisionId',p_price_revision_id,'priceFactDigest',p_price_fact_digest,
    'sourceRevisionId',p_source_revision_id,
    'policyRevisionId',p_policy_revision_id,'decision',p_decision,
    'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'CATALOG_REVIEW_CREATE',p_request_id,v_hash,
    coalesce(p_project_id,'GLOBAL'),s.principal_id,s.session_id,
    'CATALOG_REVIEW_EVENT'
  );
  IF v_replay THEN
    PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
    RETURN v_result;
  END IF;
  INSERT INTO app.catalog_review_event_r3(
    id,project_id,target_kind,product_id,product_revision_id,
    product_revision_digest,specification_revision_id,
    specification_revision_digest,price_revision_id,price_fact_digest,
    source_revision_id,policy_revision_id,decision,actor_principal_id,
    actor_session_id,actor_authority_grant_id,request_id,request_hash,
    reviewed_at,content_digest
  ) VALUES(
    p_event_id,p_project_id,p_target_kind,p_product_id,p_product_revision_id,
    p_product_revision_digest,p_specification_revision_id,
    p_specification_revision_digest,p_price_revision_id,p_price_fact_digest,
    p_source_revision_id,p_policy_revision_id,p_decision,s.principal_id,
    s.session_id,v_grant_id,p_request_id,v_hash,clock_timestamp(),
    repeat('0',64)
  );
  PERFORM app_private.complete_command_request(
    'CATALOG_REVIEW_CREATE',p_request_id,p_event_id
  );
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
  RETURN p_event_id;
END
$$;

CREATE OR REPLACE FUNCTION app.create_price_revision_r3(
  p_price_revision_id text,
  p_source_revision_id text,
  p_product_id text,
  p_product_revision_id text,
  p_product_revision_digest text,
  p_specification_revision_id text,
  p_specification_revision_digest text,
  p_amount_minor bigint,
  p_currency text,
  p_price_basis text,
  p_tax_basis text,
  p_applicability text,
  p_valid_from timestamptz,
  p_valid_until timestamptz,
  p_quoted_at timestamptz,
  p_price_unit_code text,
  p_quantity_min numeric,
  p_quantity_max numeric,
  p_request_id text,
  p_request_key text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  v_grant_id text;
  v_hash text;
  v_replay boolean;
  v_result text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  v_grant_id:=app_private.lock_authority_grant(
    s.session_id,s.principal_id,'CATALOG_PRICE_WRITE',NULL,NULL,NULL,NULL
  );
  IF p_amount_minor<0 OR upper(p_currency) !~ '^[A-Z]{3}$'
     OR p_price_basis NOT IN ('EQUIPMENT_ONLY','TURNKEY','INSTALLATION_ONLY','MAINTENANCE','OTHER')
     OR p_tax_basis NOT IN ('INCLUDED','EXCLUDED','UNKNOWN')
     OR p_applicability NOT IN ('REGION_DEMO','PROJECT_SPECIFIC','GLOBAL')
     OR (p_valid_until IS NOT NULL AND p_valid_until<=p_valid_from)
     OR (p_price_unit_code IS NOT NULL AND p_price_unit_code !~ '^[A-Z][A-Z0-9_]{1,31}$')
     OR ((p_quantity_min IS NULL) <> (p_quantity_max IS NULL))
     OR (p_quantity_min IS NOT NULL AND (p_quantity_min<=0 OR p_quantity_max<p_quantity_min)) THEN
    RAISE EXCEPTION 'price fact input invalid' USING ERRCODE='22023';
  END IF;
  v_hash:=app_private.r6_request_hash(jsonb_build_object(
    'operation','PRICE_REVISION_CREATE','priceRevisionId',p_price_revision_id,
    'sourceRevisionId',p_source_revision_id,'productId',p_product_id,
    'productRevisionId',p_product_revision_id,
    'productRevisionDigest',p_product_revision_digest,
    'specificationRevisionId',p_specification_revision_id,
    'specificationRevisionDigest',p_specification_revision_digest,
    'amountMinor',p_amount_minor,'currency',upper(p_currency),
    'priceBasis',p_price_basis,'taxBasis',p_tax_basis,
    'applicability',p_applicability,'validFrom',p_valid_from,
    'validUntil',p_valid_until,'quotedAt',p_quoted_at,
    'priceUnitCode',p_price_unit_code,'quantityMin',p_quantity_min,
    'quantityMax',p_quantity_max,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'PRICE_REVISION_CREATE',p_request_id,v_hash,'CATALOG',
    s.principal_id,s.session_id,'PRICE_REVISION'
  );
  IF v_replay THEN
    PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
    RETURN v_result;
  END IF;
  INSERT INTO app.price_revision(
    id,product_id,product_revision_id,specification_revision_id,
    source_revision_id,amount_minor,currency,price_basis,tax_basis,
    applicability,valid_from,valid_until,quoted_at,created_at,
    product_revision_digest,specification_revision_digest,
    price_unit_code,quantity_min,quantity_max,fact_digest
  ) VALUES(
    p_price_revision_id,p_product_id,p_product_revision_id,
    p_specification_revision_id,p_source_revision_id,p_amount_minor,
    upper(p_currency),p_price_basis,p_tax_basis,p_applicability,
    p_valid_from,p_valid_until,p_quoted_at,clock_timestamp(),
    p_product_revision_digest,p_specification_revision_digest,
    p_price_unit_code,p_quantity_min,p_quantity_max,repeat('0',64)
  );
  PERFORM app_private.complete_command_request(
    'PRICE_REVISION_CREATE',p_request_id,p_price_revision_id
  );
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
  RETURN p_price_revision_id;
END
$$;

ALTER TABLE app.selection_catalog_review_result
  ADD COLUMN catalog_review_event_digest text,
  ADD COLUMN target_kind text,
  ADD COLUMN target_revision_digest text,
  ADD COLUMN product_revision_id text,
  ADD COLUMN product_revision_digest text,
  ADD COLUMN specification_revision_id text,
  ADD COLUMN price_revision_id text;

CREATE OR REPLACE FUNCTION app_private.a_bind_selection_catalog_review_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  e app.catalog_review_event_r3%ROWTYPE;
BEGIN
  SELECT * INTO STRICT e FROM app.catalog_review_event_r3
   WHERE id=NEW.catalog_review_id FOR SHARE;
  IF NEW.target_kind IS DISTINCT FROM e.target_kind
     OR NEW.target_revision_id IS DISTINCT FROM
        CASE e.target_kind
          WHEN 'PRODUCT_REVISION' THEN e.product_revision_id
          WHEN 'SPECIFICATION_REVISION' THEN e.specification_revision_id
          ELSE e.price_revision_id END
     OR NEW.target_revision_digest IS DISTINCT FROM
        CASE e.target_kind
          WHEN 'PRODUCT_REVISION' THEN e.product_revision_digest
          WHEN 'SPECIFICATION_REVISION' THEN e.specification_revision_digest
          ELSE e.price_fact_digest END
     OR NEW.source_revision_id IS DISTINCT FROM e.source_revision_id
     OR NEW.policy_revision_id IS DISTINCT FROM e.policy_revision_id
     OR NEW.decision IS DISTINCT FROM e.decision
     OR NEW.reviewed_at IS DISTINCT FROM e.reviewed_at THEN
    RAISE EXCEPTION 'catalog review caller facts mismatch' USING ERRCODE='23514';
  END IF;
  NEW.product_revision_id:=e.product_revision_id;
  NEW.product_revision_digest:=e.product_revision_digest;
  NEW.specification_revision_id:=e.specification_revision_id;
  NEW.price_revision_id:=e.price_revision_id;
  NEW.catalog_review_event_digest:=e.content_digest;
  RETURN NEW;
END
$$;

CREATE TRIGGER a_bind_selection_catalog_review_r3
BEFORE INSERT OR UPDATE ON app.selection_catalog_review_result
FOR EACH ROW EXECUTE FUNCTION app_private.a_bind_selection_catalog_review_r3();

ALTER TABLE app.selection_catalog_review_result
  ADD CONSTRAINT selection_catalog_review_event_digest_unique_early_c8c
  UNIQUE (catalog_review_id,catalog_review_event_digest);

ALTER TABLE app.selection_catalog_review_result
  ADD CONSTRAINT selection_catalog_review_event_fk
    FOREIGN KEY (catalog_review_id,catalog_review_event_digest)
    REFERENCES app.catalog_review_event_r3(id,content_digest),
  ADD CONSTRAINT selection_catalog_review_target_kind_check
    CHECK (target_kind IN ('PRODUCT_REVISION','SPECIFICATION_REVISION','PRICE_REVISION'));

CREATE OR REPLACE FUNCTION app_private.catalog_review_row_payload_v1(
  p_table text,
  p_row jsonb
) RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path=pg_catalog
RETURN jsonb_build_object(
  'selectionRunId',p_row->>'selection_run_id',
  'catalogReviewId',p_row->>'catalog_review_id',
  'eventDigest',p_row->>'catalog_review_event_digest',
  'targetKind',p_row->>'target_kind',
  'targetRevisionId',p_row->>'target_revision_id',
  'targetRevisionDigest',p_row->>'target_revision_digest',
  'productRevisionId',p_row->'product_revision_id',
  'productRevisionDigest',p_row->'product_revision_digest',
  'specificationRevisionId',p_row->'specification_revision_id',
  'priceRevisionId',p_row->'price_revision_id',
  'sourceRevisionId',p_row->>'source_revision_id',
  'policyRevisionId',p_row->>'policy_revision_id',
  'decision',p_row->>'decision',
  'reviewedAtUtc',to_char((p_row->>'reviewed_at')::timestamptz AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
);

CREATE OR REPLACE FUNCTION app_private.catalog_review_row_digest_v1(
  p_table text,
  p_row jsonb
) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path=pg_catalog,app_private
RETURN app_private.sha256_hex(
  decode('414945412D434154414C4F472D524F5700763100','hex')
  || convert_to(p_table||E'\x1F'||app_private.catalog_review_row_payload_v1(p_table,p_row)::text,'UTF8')
);

CREATE OR REPLACE FUNCTION app_private.a_compute_selection_catalog_review_row_digest_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  NEW.row_digest:=app_private.catalog_review_row_digest_v1(
    'selection_catalog_review_result',to_jsonb(NEW)
  );
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS a_compute_selection_catalog_review_digest
  ON app.selection_catalog_review_result;
CREATE TRIGGER z_compute_selection_catalog_review_row_digest_r3
BEFORE INSERT OR UPDATE ON app.selection_catalog_review_result
FOR EACH ROW EXECUTE FUNCTION app_private.a_compute_selection_catalog_review_row_digest_r3();

ALTER TABLE app.selection_catalog_review_result
  ALTER COLUMN catalog_review_event_digest SET NOT NULL,
  ALTER COLUMN target_kind SET NOT NULL,
  ALTER COLUMN target_revision_digest SET NOT NULL,
  ALTER COLUMN product_revision_id SET NOT NULL,
  ALTER COLUMN product_revision_digest SET NOT NULL,
  ALTER COLUMN specification_revision_id SET NOT NULL;

CREATE OR REPLACE FUNCTION app.record_selection_catalog_review_result(
  p_selection_run_id text,
  p_catalog_review_id text,
  p_target_revision_id text,
  p_source_revision_id text,
  p_policy_revision_id text,
  p_decision text,
  p_reviewed_at timestamptz,
  p_request_id text,
  p_request_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  run app.selection_run%ROWTYPE;
  e app.catalog_review_event_r3%ROWTYPE;
  v_grant_id text;
  v_hash text;
  v_replay boolean;
  v_result text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT run FROM app.selection_run
   WHERE id=p_selection_run_id AND state='RUNNING' FOR UPDATE;
  v_grant_id:=app_private.lock_authority_grant(
    s.session_id,s.principal_id,'SELECTION_WRITE',run.project_id,NULL,NULL,NULL
  );
  SELECT * INTO STRICT e FROM app.catalog_review_event_r3
   WHERE id=p_catalog_review_id
     AND source_revision_id=p_source_revision_id
     AND policy_revision_id=p_policy_revision_id
     AND decision=p_decision
     AND reviewed_at=p_reviewed_at
   FOR SHARE;
  IF e.project_id IS NOT NULL AND e.project_id<>run.project_id THEN
    RAISE EXCEPTION 'catalog review project mismatch' USING ERRCODE='23514';
  END IF;
  IF p_target_revision_id IS DISTINCT FROM
     CASE e.target_kind
       WHEN 'PRODUCT_REVISION' THEN e.product_revision_id
       WHEN 'SPECIFICATION_REVISION' THEN e.specification_revision_id
       ELSE e.price_revision_id END THEN
    RAISE EXCEPTION 'catalog review target mismatch' USING ERRCODE='23514';
  END IF;
  v_hash:=app_private.r6_request_hash(jsonb_build_object(
    'operation','SELECTION_ADD_CATALOG_REVIEW','runId',run.id,
    'catalogReviewId',e.id,'eventDigest',e.content_digest,
    'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'SELECTION_ADD_CATALOG_REVIEW',p_request_id,v_hash,run.id,
    s.principal_id,s.session_id,'SELECTION_CATALOG_REVIEW'
  );
  IF v_replay THEN
    PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
    RETURN;
  END IF;
  INSERT INTO app.selection_catalog_review_result(
    selection_run_id,catalog_review_id,target_revision_id,source_revision_id,
    policy_revision_id,decision,reviewed_at,catalog_review_event_digest,
    target_kind,target_revision_digest,product_revision_id,
    product_revision_digest,specification_revision_id,price_revision_id
  ) VALUES(
    run.id,e.id,p_target_revision_id,e.source_revision_id,e.policy_revision_id,
    e.decision,e.reviewed_at,e.content_digest,e.target_kind,
    CASE e.target_kind
      WHEN 'PRODUCT_REVISION' THEN e.product_revision_digest
      WHEN 'SPECIFICATION_REVISION' THEN e.specification_revision_digest
      ELSE e.price_fact_digest END,
    e.product_revision_id,e.product_revision_digest,
    e.specification_revision_id,e.price_revision_id
  );
  PERFORM app_private.append_selection_run_event(
    run.id,'ADD_CATALOG_REVIEW',s.principal_id,s.session_id,
    v_grant_id,p_request_id,v_hash
  );
  PERFORM app_private.complete_command_request(
    'SELECTION_ADD_CATALOG_REVIEW',p_request_id,run.id||':'||e.id
  );
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
END
$$;

ALTER TABLE app.sales_snapshot_catalog_review_r3
  ADD COLUMN catalog_review_event_digest text,
  ADD COLUMN target_kind text,
  ADD COLUMN target_revision_digest text,
  ADD COLUMN product_revision_id text,
  ADD COLUMN product_revision_digest text,
  ADD COLUMN specification_revision_id text,
  ADD COLUMN price_revision_id text;

CREATE OR REPLACE FUNCTION app_private.a_bind_snapshot_catalog_review_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  src app.selection_catalog_review_result%ROWTYPE;
BEGIN
  SELECT * INTO STRICT src FROM app.selection_catalog_review_result
   WHERE selection_run_id=NEW.selection_run_id
     AND catalog_review_id=NEW.catalog_review_id FOR SHARE;
  NEW.target_revision_id:=src.target_revision_id;
  NEW.source_revision_id:=src.source_revision_id;
  NEW.policy_revision_id:=src.policy_revision_id;
  NEW.decision:=src.decision;
  NEW.reviewed_at:=src.reviewed_at;
  NEW.catalog_review_event_digest:=src.catalog_review_event_digest;
  NEW.target_kind:=src.target_kind;
  NEW.target_revision_digest:=src.target_revision_digest;
  NEW.product_revision_id:=src.product_revision_id;
  NEW.product_revision_digest:=src.product_revision_digest;
  NEW.specification_revision_id:=src.specification_revision_id;
  NEW.price_revision_id:=src.price_revision_id;
  NEW.source_row_digest:=src.row_digest;
  RETURN NEW;
END
$$;

CREATE TRIGGER a_bind_snapshot_catalog_review_r3
BEFORE INSERT OR UPDATE ON app.sales_snapshot_catalog_review_r3
FOR EACH ROW EXECUTE FUNCTION app_private.a_bind_snapshot_catalog_review_r3();

ALTER TABLE app.sales_snapshot_catalog_review_r3
  ALTER COLUMN catalog_review_event_digest SET NOT NULL,
  ALTER COLUMN target_kind SET NOT NULL,
  ALTER COLUMN target_revision_digest SET NOT NULL,
  ALTER COLUMN product_revision_id SET NOT NULL,
  ALTER COLUMN product_revision_digest SET NOT NULL,
  ALTER COLUMN specification_revision_id SET NOT NULL,
  ADD CONSTRAINT snapshot_catalog_review_event_fk
    FOREIGN KEY (catalog_review_id,catalog_review_event_digest)
    REFERENCES app.selection_catalog_review_result(
      catalog_review_id,catalog_review_event_digest
    );

CREATE OR REPLACE FUNCTION app_private.a_verify_snapshot_catalog_review_row_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_expected text;
BEGIN
  v_expected:=app_private.catalog_review_row_digest_v1(
    'sales_snapshot_catalog_review_r3',to_jsonb(NEW)
  );
  IF NEW.source_row_digest IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'snapshot catalog review digest mismatch' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS a_verify_snapshot_catalog_review_digest
  ON app.sales_snapshot_catalog_review_r3;
CREATE TRIGGER z_verify_snapshot_catalog_review_row_r3
BEFORE INSERT OR UPDATE ON app.sales_snapshot_catalog_review_r3
FOR EACH ROW EXECUTE FUNCTION app_private.a_verify_snapshot_catalog_review_row_r3();

ALTER TABLE app.sales_snapshot_catalog_review_r3
  ADD CONSTRAINT snapshot_catalog_review_source_unique
  UNIQUE (catalog_review_id,catalog_review_event_digest,source_row_digest);

ALTER TABLE app.selection_catalog_review_result
  ADD CONSTRAINT selection_catalog_review_event_digest_unique
  UNIQUE (catalog_review_id,catalog_review_event_digest),
  ADD CONSTRAINT selection_catalog_review_event_unique
  UNIQUE (
    catalog_review_id,catalog_review_event_digest,target_kind,
    target_revision_id,target_revision_digest,source_revision_id,
    policy_revision_id,decision,reviewed_at,row_digest
  );

-- P1-02(C): ProfessionalReview is a projection of the sealed result and
-- immutable event/basis facts

ALTER TABLE app.selection_candidate_result
  ADD CONSTRAINT selection_result_event_identity_unique
  UNIQUE (
    id,candidate_id,project_id,conversation_id,requirement_id,
    requirement_version_id,installation_scenario,product_revision_id,
    product_revision_digest,row_digest
  );

ALTER TABLE app.professional_review
  ADD COLUMN selection_candidate_result_id text,
  ADD COLUMN result_row_digest text,
  ADD COLUMN target_revision_id text,
  ADD COLUMN target_revision_digest text;

ALTER TABLE app.professional_review
  ADD CONSTRAINT professional_review_result_fk
    FOREIGN KEY (
      selection_candidate_result_id,candidate_id,project_id,
      conversation_id,requirement_id,requirement_version_id,
      installation_scenario,target_revision_id,target_revision_digest,
      result_row_digest
    ) REFERENCES app.selection_candidate_result(
      id,candidate_id,project_id,conversation_id,requirement_id,
      requirement_version_id,installation_scenario,product_revision_id,
      product_revision_digest,row_digest
    ),
  ADD CONSTRAINT professional_review_target_revision_fk
    FOREIGN KEY (target_revision_id,target_revision_digest)
    REFERENCES app.product_revision(id,content_digest),
  ADD CONSTRAINT professional_review_result_unique
    UNIQUE (id,selection_candidate_result_id,result_row_digest);

ALTER TABLE app.professional_review
  ALTER COLUMN selection_candidate_result_id SET NOT NULL,
  ALTER COLUMN result_row_digest SET NOT NULL,
  ALTER COLUMN target_revision_id SET NOT NULL,
  ALTER COLUMN target_revision_digest SET NOT NULL;

ALTER TABLE app.professional_review_event
  ADD COLUMN selection_candidate_result_id text,
  ADD COLUMN result_row_digest text,
  ADD COLUMN target_revision_id text,
  ADD COLUMN target_revision_digest text,
  ADD COLUMN basis_payload jsonb,
  ADD COLUMN basis_digest text,
  ADD COLUMN event_digest text;

ALTER TABLE app.professional_review_event
  ADD CONSTRAINT professional_event_review_result_fk
    FOREIGN KEY (review_id,selection_candidate_result_id,result_row_digest)
    REFERENCES app.professional_review(id,selection_candidate_result_id,result_row_digest),
  ADD CONSTRAINT professional_event_target_revision_fk
    FOREIGN KEY (target_revision_id,target_revision_digest)
    REFERENCES app.product_revision(id,content_digest),
  ADD CONSTRAINT professional_event_basis_check CHECK (
    (basis_payload IS NULL AND basis_digest IS NULL)
    OR (basis_payload IS NOT NULL AND basis_digest ~ '^[0-9a-f]{64}$')
  ),
  ADD CONSTRAINT professional_event_digest_check
    CHECK (event_digest ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION app_private.professional_basis_digest_v1(p_payload jsonb)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path=pg_catalog,app_private
RETURN app_private.sha256_hex(
  decode('414945412D50524F46455353494F4E414C2D424153495300763100','hex')
  || convert_to(p_payload::text,'UTF8')
);

CREATE OR REPLACE FUNCTION app_private.professional_event_digest_v1(p_row jsonb)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path=pg_catalog,app_private
RETURN app_private.sha256_hex(
  decode('414945412D50524F46455353494F4E414C2D4556454E5400763100','hex')
  || convert_to(jsonb_build_object(
    'schema','AIEA-PROFESSIONAL-REVIEW-EVENT-V1',
    'id',p_row->>'id','reviewId',p_row->>'review_id',
    'selectionResultId',p_row->>'selection_candidate_result_id',
    'resultRowDigest',p_row->>'result_row_digest',
    'targetRevisionId',p_row->>'target_revision_id',
    'targetRevisionDigest',p_row->>'target_revision_digest',
    'eventSequence',p_row->>'event_sequence',
    'stateVersion',p_row->>'state_version',
    'previousState',p_row->'previous_state',
    'command',p_row->>'command','nextState',p_row->>'next_state',
    'basisPayload',p_row->'basis_payload','basisDigest',p_row->'basis_digest',
    'actorPrincipalId',p_row->>'actor_principal_id',
    'actorSessionId',p_row->>'actor_session_id',
    'actorAuthorityGrantId',p_row->>'actor_authority_grant_id',
    'occurredAtUtc',to_char((p_row->>'occurred_at')::timestamptz AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  )::text,'UTF8')
);

CREATE OR REPLACE FUNCTION app_private.a_fill_professional_event_review_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  r app.professional_review%ROWTYPE;
BEGIN
  SELECT * INTO STRICT r FROM app.professional_review
   WHERE id=NEW.review_id
     AND project_id=NEW.project_id
     AND conversation_id=NEW.conversation_id
     AND requirement_id=NEW.requirement_id
     AND requirement_version_id=NEW.requirement_version_id
     AND installation_scenario=NEW.installation_scenario
     AND candidate_id=NEW.candidate_id
     AND policy_id=NEW.policy_id
     AND policy_revision_id=NEW.policy_revision_id
   FOR SHARE;
  NEW.selection_candidate_result_id:=r.selection_candidate_result_id;
  NEW.result_row_digest:=r.result_row_digest;
  NEW.target_revision_id:=r.target_revision_id;
  NEW.target_revision_digest:=r.target_revision_digest;
  IF NEW.basis_payload IS NOT NULL THEN
    NEW.basis_digest:=app_private.professional_basis_digest_v1(NEW.basis_payload);
  END IF;
  NEW.event_digest:=app_private.professional_event_digest_v1(to_jsonb(NEW));
  RETURN NEW;
END
$$;

CREATE TRIGGER a_fill_professional_event_review_r3
BEFORE INSERT OR UPDATE ON app.professional_review_event
FOR EACH ROW EXECUTE FUNCTION app_private.a_fill_professional_event_review_r3();

CREATE OR REPLACE FUNCTION app_private.a_verify_professional_event_digest_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_expected text;
BEGIN
  v_expected:=app_private.professional_event_digest_v1(to_jsonb(NEW));
  IF NEW.event_digest IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'professional review event digest mismatch' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER z_verify_professional_event_digest_r3
BEFORE INSERT OR UPDATE ON app.professional_review_event
FOR EACH ROW EXECUTE FUNCTION app_private.a_verify_professional_event_digest_r3();

ALTER TABLE app.professional_review_event
  ALTER COLUMN selection_candidate_result_id SET NOT NULL,
  ALTER COLUMN result_row_digest SET NOT NULL,
  ALTER COLUMN target_revision_id SET NOT NULL,
  ALTER COLUMN target_revision_digest SET NOT NULL,
  ALTER COLUMN event_digest SET NOT NULL;

CREATE OR REPLACE FUNCTION app.professional_event_decision_r3(
  p_next_state text
) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path=pg_catalog
RETURN CASE p_next_state
  WHEN 'APPROVED' THEN 'APPROVED'
  WHEN 'REJECTED' THEN 'REJECTED'
  WHEN 'RETURNED_FOR_INFORMATION' THEN 'RETURNED_FOR_INFORMATION'
  WHEN 'INVALIDATED' THEN 'INVALIDATED'
  WHEN 'EXPIRED' THEN 'EXPIRED'
  ELSE NULL
END;

CREATE OR REPLACE FUNCTION app.create_professional_review(
  p_review_id text,
  p_project_id text,
  p_conversation_id text,
  p_requirement_id text,
  p_requirement_version_id text,
  p_installation_scenario text,
  p_candidate_id text,
  p_policy_id text,
  p_policy_revision_id text,
  p_request_id text,
  p_request_key text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  result app.selection_candidate_result%ROWTYPE;
  v_grant_id text;
  v_hash text;
  v_replay boolean;
  v_result text;
  v_event_id text:=gen_random_uuid()::text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT result FROM app.selection_candidate_result
   WHERE candidate_id=p_candidate_id
     AND project_id=p_project_id
     AND conversation_id=p_conversation_id
     AND requirement_id=p_requirement_id
     AND requirement_version_id=p_requirement_version_id
     AND installation_scenario=p_installation_scenario
   FOR SHARE;
  IF NOT EXISTS (
    SELECT 1 FROM app.selection_run run
     WHERE run.id=result.selection_run_id AND run.state='SEALED'
  ) THEN
    RAISE EXCEPTION 'professional review requires sealed selection' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM app.policy_revision pr
     WHERE pr.id=p_policy_revision_id AND pr.policy_id=p_policy_id
  ) THEN
    RAISE EXCEPTION 'review policy/revision mismatch' USING ERRCODE='23514';
  END IF;
  v_grant_id:=app_private.lock_authority_grant(
    s.session_id,s.principal_id,'PROFESSIONAL_REVIEW',
    p_project_id,p_policy_id,p_policy_revision_id,NULL
  );
  IF NOT app.policy_is_effective(p_policy_revision_id) THEN
    RAISE EXCEPTION 'policy not effective' USING ERRCODE='23514';
  END IF;
  v_hash:=app_private.r6_request_hash(jsonb_build_object(
      'operation','PROFESSIONAL_REVIEW_CREATE','reviewId',p_review_id,
      'resultId',result.id,'resultRowDigest',result.row_digest,
      'policyRevisionId',p_policy_revision_id,'requestKey',p_request_key
    ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'PROFESSIONAL_REVIEW_CREATE',p_request_id,v_hash,
    p_review_id,s.principal_id,s.session_id,'PROFESSIONAL_REVIEW'
  );
  IF v_replay THEN
    PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
    RETURN v_result;
  END IF;
  INSERT INTO app.professional_review(
    id,project_id,conversation_id,requirement_id,requirement_version_id,
    installation_scenario,candidate_id,policy_id,policy_revision_id,
    selection_candidate_result_id,result_row_digest,target_revision_id,
    target_revision_digest,created_by_principal_id,state,state_version,
    mutation_version,created_at
  ) VALUES(
    p_review_id,p_project_id,p_conversation_id,p_requirement_id,
    p_requirement_version_id,p_installation_scenario,p_candidate_id,
    p_policy_id,p_policy_revision_id,result.id,result.row_digest,
    result.product_revision_id,result.product_revision_digest,
    s.principal_id,'CREATED',1,1,clock_timestamp()
  );
  INSERT INTO app.professional_review_event(
    id,review_id,project_id,conversation_id,requirement_id,
    requirement_version_id,installation_scenario,candidate_id,policy_id,
    policy_revision_id,event_sequence,state_version,previous_state,
    command,next_state,actor_principal_id,actor_session_id,
    actor_authority_grant_id,request_id,request_hash,basis_digest,reason,
    occurred_at,selection_candidate_result_id,result_row_digest,
    target_revision_id,target_revision_digest,basis_payload,event_digest
  ) VALUES(
    v_event_id,p_review_id,p_project_id,p_conversation_id,p_requirement_id,
    p_requirement_version_id,p_installation_scenario,p_candidate_id,p_policy_id,
    p_policy_revision_id,1,1,NULL,'CREATE','CREATED',s.principal_id,
    s.session_id,v_grant_id,p_request_id,v_hash,NULL,'review created',
    clock_timestamp(),result.id,result.row_digest,result.product_revision_id,
    result.product_revision_digest,NULL,repeat('0',64)
  );
  INSERT INTO app.review_audit(id,review_id,event_id,action,actor_principal_id,occurred_at)
  VALUES(gen_random_uuid()::text,p_review_id,v_event_id,'CREATE',s.principal_id,clock_timestamp());
  PERFORM app_private.complete_command_request(
    'PROFESSIONAL_REVIEW_CREATE',p_request_id,p_review_id
  );
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
  RETURN p_review_id;
END
$$;

CREATE OR REPLACE FUNCTION app.transition_professional_review(
  p_review_id text,
  p_expected_sequence bigint,
  p_command app.professional_review_command,
  p_expected_policy_revision_id text,
  p_basis_payload text,
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
  v_new_event_id text:=gen_random_uuid()::text;
  v_basis jsonb;
  v_basis_digest text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT r FROM app.professional_review
   WHERE id=p_review_id FOR UPDATE;
  IF r.policy_revision_id<>p_expected_policy_revision_id THEN
    RAISE EXCEPTION 'policy expectation mismatch' USING ERRCODE='40001';
  END IF;
  v_required_authority:=CASE p_command
    WHEN 'CREATE' THEN 'PROFESSIONAL_REVIEW'
    WHEN 'SUBMIT' THEN 'REVIEW_SUBMITTER'
    WHEN 'RESUBMIT' THEN 'REVIEW_SUBMITTER'
    WHEN 'APPROVE' THEN 'PROFESSIONAL_APPROVER'
    WHEN 'REJECT' THEN 'PROFESSIONAL_APPROVER'
    WHEN 'RETURN' THEN 'PROFESSIONAL_APPROVER'
    WHEN 'INVALIDATE' THEN 'REVIEW_INVALIDATOR'
    WHEN 'EXPIRE' THEN 'POLICY_LIFECYCLE'
  END;
  v_grant_id:=app_private.lock_authority_grant(
    s.session_id,s.principal_id,v_required_authority,
    r.project_id,r.policy_id,r.policy_revision_id,NULL
  );
  IF NOT app.policy_is_effective(r.policy_revision_id) THEN
    RAISE EXCEPTION 'policy not effective' USING ERRCODE='23514';
  END IF;
  IF p_basis_payload IS NULL THEN
    v_basis:=NULL;
    v_basis_digest:=NULL;
  ELSE
    v_basis:=p_basis_payload::jsonb;
    IF p_basis_payload<>v_basis::text THEN
      RAISE EXCEPTION 'basis payload not canonical jsonb text' USING ERRCODE='22023';
    END IF;
    v_basis_digest:=app_private.professional_basis_digest_v1(v_basis);
  END IF;
  v_request_hash:=app_private.r6_request_hash(jsonb_build_object(
    'operation','PROFESSIONAL_REVIEW','reviewId',r.id,
    'expectedSequence',p_expected_sequence,'command',p_command::text,
    'policyRevisionId',p_expected_policy_revision_id,
    'basisDigest',v_basis_digest,'requestKey',p_request_key,'reason',p_reason
  ));
  SELECT * INTO replay_event FROM app.professional_review_event e
   WHERE e.review_id=r.id AND e.request_id=p_request_id;
  IF FOUND THEN
    IF replay_event.actor_principal_id<>s.principal_id
       OR replay_event.request_hash<>v_request_hash THEN
      RAISE EXCEPTION 'request id reused' USING ERRCODE='40001';
    END IF;
    PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
    RETURN QUERY SELECT replay_event.id,replay_event.event_sequence,
                        replay_event.next_state,true;
    RETURN;
  END IF;
  SELECT * INTO old_event FROM app.professional_review_event e
   WHERE e.review_id=r.id ORDER BY e.event_sequence DESC LIMIT 1;
  IF old_event.id IS NULL OR old_event.event_sequence<>p_expected_sequence THEN
    RAISE EXCEPTION 'stale review sequence' USING ERRCODE='40001';
  END IF;
  IF p_command='APPROVE' AND r.created_by_principal_id=s.principal_id THEN
    RAISE EXCEPTION 'self approval denied' USING ERRCODE='42501';
  END IF;
  v_next_state:=CASE
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
  IF v_next_state IN ('IN_REVIEW','APPROVED','REJECTED','RETURNED_FOR_INFORMATION')
     AND v_basis IS NULL THEN
    RAISE EXCEPTION 'review transition requires canonical basis payload' USING ERRCODE='22004';
  END IF;
  INSERT INTO app.professional_review_event(
    id,review_id,project_id,conversation_id,requirement_id,
    requirement_version_id,installation_scenario,candidate_id,
    policy_id,policy_revision_id,event_sequence,state_version,
    previous_state,command,next_state,actor_principal_id,actor_session_id,
    actor_authority_grant_id,request_id,request_hash,basis_digest,reason,
    occurred_at,selection_candidate_result_id,result_row_digest,
    target_revision_id,target_revision_digest,basis_payload,event_digest
  ) VALUES(
    v_new_event_id,r.id,r.project_id,r.conversation_id,r.requirement_id,
    r.requirement_version_id,r.installation_scenario,r.candidate_id,
    r.policy_id,r.policy_revision_id,old_event.event_sequence+1,
    old_event.state_version+1,old_event.next_state,p_command,v_next_state,
    s.principal_id,s.session_id,v_grant_id,p_request_id,v_request_hash,
    v_basis_digest,p_reason,clock_timestamp(),r.selection_candidate_result_id,
    r.result_row_digest,r.target_revision_id,r.target_revision_digest,
    v_basis,repeat('0',64)
  );
  INSERT INTO app.review_audit(id,review_id,event_id,action,actor_principal_id,occurred_at)
  VALUES(gen_random_uuid()::text,r.id,v_new_event_id,p_command::text,s.principal_id,clock_timestamp());
  UPDATE app.professional_review
     SET state=v_next_state,state_version=old_event.state_version+1,
         mutation_version=mutation_version+1
   WHERE id=r.id;
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
  RETURN QUERY SELECT v_new_event_id,old_event.event_sequence+1,v_next_state,false;
END
$$;

ALTER TABLE app.selection_professional_review_result
  ADD COLUMN candidate_id text,
  ADD COLUMN professional_review_event_digest text,
  ADD COLUMN selection_candidate_result_id text,
  ADD COLUMN result_row_digest text,
  ADD COLUMN target_revision_digest text,
  ADD COLUMN basis_payload jsonb;

CREATE OR REPLACE FUNCTION app_private.a_bind_selection_professional_review_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  e app.professional_review_event%ROWTYPE;
BEGIN
  SELECT * INTO STRICT e FROM app.professional_review_event
   WHERE id=NEW.professional_review_event_id
     AND review_id=NEW.professional_review_id
     AND event_sequence=NEW.event_sequence
   FOR SHARE;
  IF NEW.policy_revision_id IS DISTINCT FROM e.policy_revision_id
     OR NEW.target_revision_id IS DISTINCT FROM e.target_revision_id
     OR NEW.target_revision_digest IS DISTINCT FROM e.target_revision_digest
     OR NEW.decision IS DISTINCT FROM app.professional_event_decision_r3(e.next_state)
     OR NEW.basis_digest IS DISTINCT FROM e.basis_digest
     OR NEW.occurred_at IS DISTINCT FROM e.occurred_at
     OR NEW.selection_candidate_result_id IS DISTINCT FROM e.selection_candidate_result_id
     OR NEW.result_row_digest IS DISTINCT FROM e.result_row_digest THEN
    RAISE EXCEPTION 'professional review caller facts mismatch' USING ERRCODE='23514';
  END IF;
  NEW.professional_review_event_digest:=e.event_digest;
  NEW.basis_payload:=e.basis_payload;
  NEW.row_digest:=app_private.sha256_hex(
    decode('414945412D5245564945572D524F5700763100','hex')
    || convert_to(jsonb_build_object(
      'selectionRunId',NEW.selection_run_id,
      'eventId',NEW.professional_review_event_id,
      'eventDigest',e.event_digest,
      'professionalReviewId',NEW.professional_review_id,
      'eventSequence',NEW.event_sequence,
      'selectionResultId',e.selection_candidate_result_id,
      'resultRowDigest',e.result_row_digest,
      'targetRevisionId',e.target_revision_id,
      'targetRevisionDigest',e.target_revision_digest,
      'policyRevisionId',e.policy_revision_id,
      'decision',app.professional_event_decision_r3(e.next_state),
      'basisDigest',e.basis_digest,'basisPayload',e.basis_payload,
      'occurredAtUtc',to_char(e.occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    )::text,'UTF8')
  );
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS a_compute_selection_professional_review_digest
  ON app.selection_professional_review_result;
CREATE TRIGGER z_bind_selection_professional_review_r3
BEFORE INSERT OR UPDATE ON app.selection_professional_review_result
FOR EACH ROW EXECUTE FUNCTION app_private.a_bind_selection_professional_review_r3();

ALTER TABLE app.professional_review_event
  ADD CONSTRAINT professional_event_id_digest_unique_early_c8c
  UNIQUE (id,event_digest);
ALTER TABLE app.professional_review_event
  ADD CONSTRAINT professional_event_review_digest_unique_early_c8c
  UNIQUE (id,review_id,event_sequence,event_digest);

ALTER TABLE app.selection_professional_review_result
  ALTER COLUMN professional_review_event_digest SET NOT NULL,
  ALTER COLUMN selection_candidate_result_id SET NOT NULL,
  ALTER COLUMN result_row_digest SET NOT NULL,
  ALTER COLUMN target_revision_digest SET NOT NULL,
  ADD CONSTRAINT selection_professional_event_fk
    FOREIGN KEY (professional_review_event_id,professional_review_event_digest)
    REFERENCES app.professional_review_event(id,event_digest),
  ADD CONSTRAINT selection_professional_result_fk
    FOREIGN KEY (
      selection_candidate_result_id,candidate_id,result_row_digest
    ) REFERENCES app.selection_candidate_result(id,candidate_id,row_digest);

ALTER TABLE app.professional_review_event
  ADD CONSTRAINT professional_event_id_digest_unique UNIQUE (id,event_digest),
  ADD CONSTRAINT professional_event_review_digest_unique
    UNIQUE (id,review_id,event_sequence,event_digest);

ALTER TABLE app.selection_professional_review_result
  ADD CONSTRAINT selection_professional_review_source_unique
  UNIQUE (professional_review_event_id,professional_review_event_digest,row_digest);

ALTER TABLE app.sales_snapshot_professional_review_r3
  ADD COLUMN candidate_id text,
  ADD COLUMN professional_review_event_digest text,
  ADD COLUMN selection_candidate_result_id text,
  ADD COLUMN result_row_digest text,
  ADD COLUMN target_revision_digest text,
  ADD COLUMN basis_payload jsonb;

CREATE OR REPLACE FUNCTION app_private.a_bind_snapshot_professional_review_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  src app.selection_professional_review_result%ROWTYPE;
BEGIN
  SELECT * INTO STRICT src FROM app.selection_professional_review_result
   WHERE selection_run_id=NEW.selection_run_id
     AND professional_review_id=NEW.professional_review_id
     AND event_sequence=NEW.event_sequence FOR SHARE;
  NEW.professional_review_event_id:=src.professional_review_event_id;
  NEW.target_revision_id:=src.target_revision_id;
  NEW.policy_revision_id:=src.policy_revision_id;
  NEW.decision:=src.decision;
  NEW.basis_digest:=src.basis_digest;
  NEW.occurred_at:=src.occurred_at;
  NEW.professional_review_event_digest:=src.professional_review_event_digest;
  NEW.selection_candidate_result_id:=src.selection_candidate_result_id;
  NEW.result_row_digest:=src.result_row_digest;
  NEW.target_revision_digest:=src.target_revision_digest;
  NEW.basis_payload:=src.basis_payload;
  NEW.source_row_digest:=src.row_digest;
  RETURN NEW;
END
$$;

CREATE TRIGGER a_bind_snapshot_professional_review_r3
BEFORE INSERT OR UPDATE ON app.sales_snapshot_professional_review_r3
FOR EACH ROW EXECUTE FUNCTION app_private.a_bind_snapshot_professional_review_r3();

CREATE OR REPLACE FUNCTION app_private.a_verify_snapshot_professional_review_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_expected text;
BEGIN
  v_expected:=app_private.sha256_hex(
    decode('414945412D5245564945572D524F5700763100','hex')
    || convert_to(jsonb_build_object(
      'selectionRunId',NEW.selection_run_id,
      'eventId',NEW.professional_review_event_id,
      'eventDigest',NEW.professional_review_event_digest,
      'professionalReviewId',NEW.professional_review_id,
      'eventSequence',NEW.event_sequence,
      'selectionResultId',NEW.selection_candidate_result_id,
      'resultRowDigest',NEW.result_row_digest,
      'targetRevisionId',NEW.target_revision_id,
      'targetRevisionDigest',NEW.target_revision_digest,
      'policyRevisionId',NEW.policy_revision_id,
      'decision',NEW.decision,'basisDigest',NEW.basis_digest,
      'basisPayload',NEW.basis_payload,
      'occurredAtUtc',to_char(NEW.occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    )::text,'UTF8')
  );
  IF NEW.source_row_digest IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'snapshot professional review digest mismatch' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS a_verify_snapshot_professional_review_digest
  ON app.sales_snapshot_professional_review_r3;
CREATE TRIGGER z_verify_snapshot_professional_review_r3
BEFORE INSERT OR UPDATE ON app.sales_snapshot_professional_review_r3
FOR EACH ROW EXECUTE FUNCTION app_private.a_verify_snapshot_professional_review_r3();

ALTER TABLE app.sales_snapshot_professional_review_r3
  ALTER COLUMN professional_review_event_digest SET NOT NULL,
  ALTER COLUMN selection_candidate_result_id SET NOT NULL,
  ALTER COLUMN result_row_digest SET NOT NULL,
  ALTER COLUMN target_revision_digest SET NOT NULL,
  ADD CONSTRAINT snapshot_professional_review_event_fk
    FOREIGN KEY (professional_review_event_id,professional_review_event_digest)
    REFERENCES app.professional_review_event(id,event_digest),
  ADD CONSTRAINT snapshot_professional_result_fk
    FOREIGN KEY (
      selection_candidate_result_id,candidate_id,result_row_digest
    ) REFERENCES app.selection_candidate_result(id,candidate_id,row_digest);

CREATE OR REPLACE FUNCTION app.record_selection_professional_review_result(
  p_selection_run_id text,
  p_professional_review_event_id text,
  p_professional_review_id text,
  p_event_sequence bigint,
  p_target_revision_id text,
  p_policy_revision_id text,
  p_decision text,
  p_basis_digest text,
  p_occurred_at timestamptz,
  p_request_id text,
  p_request_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  run app.selection_run%ROWTYPE;
  e app.professional_review_event%ROWTYPE;
  v_grant_id text;
  v_hash text;
  v_replay boolean;
  v_result text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT run FROM app.selection_run
   WHERE id=p_selection_run_id AND state='RUNNING' FOR UPDATE;
  v_grant_id:=app_private.lock_authority_grant(
    s.session_id,s.principal_id,'SELECTION_WRITE',run.project_id,NULL,NULL,NULL
  );
  SELECT * INTO STRICT e FROM app.professional_review_event
   WHERE id=p_professional_review_event_id
     AND review_id=p_professional_review_id
     AND event_sequence=p_event_sequence
     AND policy_revision_id=p_policy_revision_id
   FOR SHARE;
  IF NOT EXISTS (
    SELECT 1 FROM app.selection_candidate_result r
     WHERE r.id=e.selection_candidate_result_id
       AND r.selection_run_id=run.id
       AND r.row_digest=e.result_row_digest
  ) THEN
    RAISE EXCEPTION 'professional event result is not in selection run' USING ERRCODE='23514';
  END IF;
  IF p_target_revision_id IS DISTINCT FROM e.target_revision_id
     OR p_decision IS DISTINCT FROM app.professional_event_decision_r3(e.next_state)
     OR p_basis_digest IS DISTINCT FROM e.basis_digest
     OR p_occurred_at IS DISTINCT FROM e.occurred_at THEN
    RAISE EXCEPTION 'professional event caller facts mismatch' USING ERRCODE='23514';
  END IF;
  v_hash:=app_private.r6_request_hash(jsonb_build_object(
    'operation','SELECTION_ADD_PROFESSIONAL_REVIEW','runId',run.id,
    'reviewEventId',e.id,'eventDigest',e.event_digest,
    'reviewId',e.review_id,'eventSequence',e.event_sequence,
    'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'SELECTION_ADD_PROFESSIONAL_REVIEW',p_request_id,v_hash,run.id,
    s.principal_id,s.session_id,'SELECTION_PROFESSIONAL_REVIEW'
  );
  IF v_replay THEN
    PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
    RETURN;
  END IF;
  INSERT INTO app.selection_professional_review_result(
    selection_run_id,professional_review_event_id,professional_review_id,
    event_sequence,target_revision_id,policy_revision_id,decision,basis_digest,
    occurred_at,professional_review_event_digest,selection_candidate_result_id,
    result_row_digest,target_revision_digest,basis_payload,row_digest
  ) VALUES(
    run.id,e.id,e.review_id,e.event_sequence,e.target_revision_id,
    e.policy_revision_id,app.professional_event_decision_r3(e.next_state),
    e.basis_digest,e.occurred_at,e.event_digest,e.selection_candidate_result_id,
    e.result_row_digest,e.target_revision_digest,e.basis_payload,repeat('0',64)
  );
  PERFORM app_private.append_selection_run_event(
    run.id,'ADD_PROFESSIONAL_REVIEW',s.principal_id,s.session_id,
    v_grant_id,p_request_id,v_hash
  );
  PERFORM app_private.complete_command_request(
    'SELECTION_ADD_PROFESSIONAL_REVIEW',p_request_id,e.id
  );
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
END
$$;

-- P1-03/P1-04: recursive role closure, explicit CONNECT, and one-shot root bootstrap

CREATE ROLE elevator_bootstrap_initiator
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE elevator_bootstrap_approver
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE elevator_root_issuer
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE elevator_bootstrap_seed
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE elevator_session_bootstrap_seed LOGIN
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE elevator_session_bootstrap_initiator LOGIN
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE elevator_session_bootstrap_approver LOGIN
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE elevator_session_root_issuer LOGIN
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

CREATE TABLE app.bootstrap_operator_r3 (
  role_name text PRIMARY KEY CHECK (role_name ~ '^elevator_session_[a-z0-9_]{6,48}$'),
  operator_kind text NOT NULL CHECK (operator_kind IN ('INITIATOR','APPROVER','ROOT')),
  principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  token_digest text NOT NULL CHECK (token_digest ~ '^[0-9a-f]{64}$'),
  enabled boolean NOT NULL DEFAULT true,
  provisioned_at timestamptz(6) NOT NULL
);

ALTER TABLE app.session_role_registry
  DROP CONSTRAINT session_role_registry_role_kind_check;
ALTER TABLE app.session_role_registry
  ADD CONSTRAINT session_role_registry_role_kind_check CHECK (
    role_kind IN (
      'WEB','WORKER','PROFESSIONAL_REVIEWER','POLICY_AUTHOR','POLICY_REVIEWER',
      'SECURITY_ADMIN','CATALOG_REVIEWER','CATALOG_PUBLISHER','AUDITOR','REPORTING',
      'BOOTSTRAP_INITIATOR','BOOTSTRAP_APPROVER','ROOT_ISSUER'
    )
  );

CREATE TABLE app.bootstrap_state_r3 (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  state text NOT NULL CHECK (state IN ('PREPARED','COMPLETE','FAILED')),
  root_principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  root_role_name text NOT NULL,
  root_token_digest text NOT NULL CHECK (root_token_digest ~ '^[0-9a-f]{64}$'),
  prepared_at timestamptz(6) NOT NULL,
  completed_at timestamptz(6),
  root_grant_id text,
  UNIQUE (root_role_name),
  CHECK (
    (state='PREPARED' AND completed_at IS NULL AND root_grant_id IS NULL)
    OR (state='COMPLETE' AND completed_at IS NOT NULL AND root_grant_id IS NOT NULL)
  )
);

CREATE TABLE app.bootstrap_approval_r3 (
  bootstrap_id boolean NOT NULL REFERENCES app.bootstrap_state_r3(singleton),
  operator_kind text NOT NULL CHECK (operator_kind IN ('INITIATOR','APPROVER')),
  role_name text NOT NULL REFERENCES app.bootstrap_operator_r3(role_name),
  principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  backend_pid integer NOT NULL,
  backend_started_at timestamptz(6) NOT NULL,
  approved_at timestamptz(6) NOT NULL,
  PRIMARY KEY (bootstrap_id,operator_kind)
);

CREATE TABLE app.bootstrap_event_r3 (
  id text PRIMARY KEY,
  bootstrap_id boolean NOT NULL REFERENCES app.bootstrap_state_r3(singleton),
  event_sequence bigint NOT NULL CHECK (event_sequence>0),
  action text NOT NULL CHECK (action IN ('APPROVE_INITIATOR','APPROVE_APPROVER','ROOT_SESSION_ACTIVE')),
  actor_role text NOT NULL,
  actor_principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  occurred_at timestamptz(6) NOT NULL,
  UNIQUE (bootstrap_id,event_sequence)
);

CREATE OR REPLACE FUNCTION app_private.validate_session_role_r3(
  p_role_name text,
  p_role_kind text,
  p_capability_role text
) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_role oid;
  v_bootstrap oid;
  v_capability oid;
  v_unexpected integer;
BEGIN
  IF p_role_name !~ '^elevator_session_[a-z0-9_]{6,48}$' THEN
    RAISE EXCEPTION 'session role name invalid' USING ERRCODE='22023';
  END IF;
  IF p_capability_role IS DISTINCT FROM CASE p_role_kind
    WHEN 'WEB' THEN 'elevator_runtime_web'
    WHEN 'WORKER' THEN 'elevator_runtime_worker'
    WHEN 'PROFESSIONAL_REVIEWER' THEN 'elevator_professional_reviewer'
    WHEN 'POLICY_AUTHOR' THEN 'elevator_policy_author'
    WHEN 'POLICY_REVIEWER' THEN 'elevator_policy_reviewer'
    WHEN 'SECURITY_ADMIN' THEN 'elevator_security_admin'
    WHEN 'CATALOG_REVIEWER' THEN 'elevator_catalog_reviewer'
    WHEN 'CATALOG_PUBLISHER' THEN 'elevator_catalog_publisher'
    WHEN 'AUDITOR' THEN 'elevator_readonly_auditor'
    WHEN 'REPORTING' THEN 'elevator_reporting_readonly'
    WHEN 'BOOTSTRAP_INITIATOR' THEN 'elevator_bootstrap_initiator'
    WHEN 'BOOTSTRAP_APPROVER' THEN 'elevator_bootstrap_approver'
    WHEN 'ROOT_ISSUER' THEN 'elevator_root_issuer'
  END THEN
    RAISE EXCEPTION 'session role kind/capability mismatch' USING ERRCODE='22023';
  END IF;
  SELECT oid INTO v_role FROM pg_catalog.pg_roles WHERE rolname=p_role_name;
  SELECT oid INTO v_bootstrap FROM pg_catalog.pg_roles
   WHERE rolname='elevator_session_bootstrap';
  SELECT oid INTO v_capability FROM pg_catalog.pg_roles WHERE rolname=p_capability_role;
  IF v_role IS NULL OR v_bootstrap IS NULL OR v_capability IS NULL THEN
    RAISE EXCEPTION 'session role dependency missing' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles r
     WHERE r.oid=v_role AND r.rolcanlogin AND r.rolconnlimit=1
       AND NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole
       AND NOT r.rolreplication AND NOT r.rolbypassrls AND NOT r.rolinherit
  ) THEN
    RAISE EXCEPTION 'session role attributes invalid' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members am
     WHERE am.member=v_role AND am.roleid=v_bootstrap
       AND NOT am.inherit_option AND am.set_option AND NOT am.admin_option
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members am
     WHERE am.member=v_role AND am.roleid=v_capability
       AND NOT am.inherit_option AND am.set_option AND NOT am.admin_option
  ) THEN
    RAISE EXCEPTION 'session role membership options invalid' USING ERRCODE='42501';
  END IF;
  WITH RECURSIVE reachable(role_oid) AS (
    SELECT am.roleid FROM pg_catalog.pg_auth_members am WHERE am.member=v_role
    UNION
    SELECT am.roleid FROM pg_catalog.pg_auth_members am
    JOIN reachable r ON am.member=r.role_oid
  )
  SELECT count(*) INTO v_unexpected
    FROM reachable WHERE role_oid NOT IN (v_bootstrap,v_capability);
  IF v_unexpected<>0 THEN
    RAISE EXCEPTION 'session role has indirect/owner membership' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_database d
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(d.datacl,pg_catalog.acldefault('d',d.datdba))
    ) acl
     WHERE d.datname=pg_catalog.current_database()
       AND acl.grantee=v_role AND acl.privilege_type='CONNECT'
  ) THEN
    RAISE EXCEPTION 'session role requires direct database CONNECT' USING ERRCODE='42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_namespace n
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(n.nspacl,pg_catalog.acldefault('n',n.nspowner))
    ) acl
     WHERE n.nspname IN ('app','app_private')
       AND acl.grantee=v_role
       AND acl.privilege_type IN ('USAGE','CREATE')
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(c.relacl,pg_catalog.acldefault(
        CASE WHEN c.relkind IN ('S') THEN 'S' ELSE 'r' END,c.relowner
      ))
    ) acl
     WHERE n.nspname IN ('app','app_private')
       AND acl.grantee=v_role
       AND acl.privilege_type IN
         ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE')
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))
    ) acl
     WHERE n.nspname IN ('app','app_private')
       AND acl.grantee=v_role AND acl.privilege_type='EXECUTE'
  ) THEN
    RAISE EXCEPTION 'session role has direct object privilege' USING ERRCODE='42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))
    ) acl
     WHERE n.nspname IN ('app','app_private') AND acl.grantee=0
       AND acl.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE')
  ) THEN
    RAISE EXCEPTION 'PUBLIC has protected relation privilege' USING ERRCODE='42501';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION app.bootstrap_prepare_r3(
  p_root_principal_id text,
  p_root_role_name text,
  p_initiator_principal_id text,
  p_initiator_role_name text,
  p_approver_principal_id text,
  p_approver_role_name text,
  p_root_token_digest text,
  p_initiator_token_digest text,
  p_approver_token_digest text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  IF session_user<>'elevator_session_bootstrap_seed' THEN
    RAISE EXCEPTION 'bootstrap seed role required' USING ERRCODE='42501';
  END IF;
  IF p_root_token_digest !~ '^[0-9a-f]{64}$'
     OR p_initiator_token_digest !~ '^[0-9a-f]{64}$'
     OR p_approver_token_digest !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'bootstrap token digest invalid' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM app.bootstrap_state_r3) THEN
    RAISE EXCEPTION 'bootstrap already prepared' USING ERRCODE='23505';
  END IF;
  INSERT INTO app.trusted_principal(id,state,created_at)
  VALUES(p_root_principal_id,'ACTIVE',clock_timestamp())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO app.principal_epoch(principal_id,current_epoch,updated_at)
  VALUES(p_root_principal_id,1,clock_timestamp())
  ON CONFLICT (principal_id) DO NOTHING;
  INSERT INTO app.trusted_principal(id,state,created_at)
  VALUES(p_initiator_principal_id,'ACTIVE',clock_timestamp())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO app.principal_epoch(principal_id,current_epoch,updated_at)
  VALUES(p_initiator_principal_id,1,clock_timestamp())
  ON CONFLICT (principal_id) DO NOTHING;
  INSERT INTO app.trusted_principal(id,state,created_at)
  VALUES(p_approver_principal_id,'ACTIVE',clock_timestamp())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO app.principal_epoch(principal_id,current_epoch,updated_at)
  VALUES(p_approver_principal_id,1,clock_timestamp())
  ON CONFLICT (principal_id) DO NOTHING;
  INSERT INTO app.bootstrap_operator_r3(
    role_name,operator_kind,principal_id,token_digest,enabled,provisioned_at
  ) VALUES
    (p_initiator_role_name,'INITIATOR',p_initiator_principal_id,p_initiator_token_digest,true,clock_timestamp()),
    (p_approver_role_name,'APPROVER',p_approver_principal_id,p_approver_token_digest,true,clock_timestamp()),
    (p_root_role_name,'ROOT',p_root_principal_id,p_root_token_digest,true,clock_timestamp());
  INSERT INTO app.bootstrap_state_r3(
    singleton,state,root_principal_id,root_role_name,root_token_digest,prepared_at
  ) VALUES(true,'PREPARED',p_root_principal_id,p_root_role_name,p_root_token_digest,clock_timestamp());
END
$$;

CREATE OR REPLACE FUNCTION app.bootstrap_record_approval_r3(
  p_bootstrap_id boolean,
  p_operator_kind text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  op app.bootstrap_operator_r3%ROWTYPE;
  st app.bootstrap_state_r3%ROWTYPE;
  v_backend_start timestamptz;
BEGIN
  IF p_operator_kind NOT IN ('INITIATOR','APPROVER') THEN
    RAISE EXCEPTION 'bootstrap approval kind invalid' USING ERRCODE='22023';
  END IF;
  PERFORM app_private.validate_session_role_r3(
    session_user,
    CASE p_operator_kind WHEN 'INITIATOR' THEN 'BOOTSTRAP_INITIATOR'
      ELSE 'BOOTSTRAP_APPROVER' END,
    CASE p_operator_kind WHEN 'INITIATOR' THEN 'elevator_bootstrap_initiator'
      ELSE 'elevator_bootstrap_approver' END
  );
  SELECT * INTO STRICT st FROM app.bootstrap_state_r3
   WHERE singleton=p_bootstrap_id AND state='PREPARED' FOR UPDATE;
  SELECT * INTO STRICT op FROM app.bootstrap_operator_r3
   WHERE role_name=session_user
     AND operator_kind=p_operator_kind
     AND enabled FOR SHARE;
  SELECT a.backend_start INTO v_backend_start FROM pg_catalog.pg_stat_activity a
   WHERE a.pid=pg_catalog.pg_backend_pid() AND a.usename=session_user;
  IF v_backend_start IS NULL THEN
    RAISE EXCEPTION 'bootstrap backend identity unavailable' USING ERRCODE='42501';
  END IF;
  INSERT INTO app.bootstrap_approval_r3(
    bootstrap_id,operator_kind,role_name,principal_id,backend_pid,
    backend_started_at,approved_at
  ) VALUES(
    p_bootstrap_id,p_operator_kind,session_user,op.principal_id,
    pg_catalog.pg_backend_pid(),v_backend_start,clock_timestamp()
  );
  INSERT INTO app.bootstrap_event_r3(
    id,bootstrap_id,event_sequence,action,actor_role,actor_principal_id,occurred_at
  ) VALUES(
    gen_random_uuid()::text,p_bootstrap_id,
    (SELECT COALESCE(max(event_sequence),0)+1 FROM app.bootstrap_event_r3 WHERE bootstrap_id=p_bootstrap_id),
    'APPROVE_'||p_operator_kind,session_user,op.principal_id,clock_timestamp()
  );
END
$$;

CREATE OR REPLACE FUNCTION app.bootstrap_complete_root_r3(
  p_bootstrap_id boolean,
  p_root_token text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  st app.bootstrap_state_r3%ROWTYPE;
  rootop app.bootstrap_operator_r3%ROWTYPE;
  v_backend_start timestamptz;
  v_session_id text:='bootstrap:'||gen_random_uuid()::text;
  v_grant_id text:='bootstrap-grant:'||gen_random_uuid()::text;
  v_epoch bigint;
BEGIN
  PERFORM app_private.validate_session_role_r3(
    session_user,'ROOT_ISSUER','elevator_root_issuer'
  );
  SELECT * INTO STRICT st FROM app.bootstrap_state_r3
   WHERE singleton=p_bootstrap_id AND state='PREPARED' FOR UPDATE;
  SELECT * INTO STRICT rootop FROM app.bootstrap_operator_r3
   WHERE role_name=session_user AND operator_kind='ROOT' AND enabled FOR SHARE;
  IF NOT app_private.session_token_digest(p_root_token)=st.root_token_digest THEN
    RAISE EXCEPTION 'root bootstrap token invalid' USING ERRCODE='42501';
  END IF;
  IF (SELECT count(*) FROM app.bootstrap_approval_r3
      WHERE bootstrap_id=p_bootstrap_id AND operator_kind IN ('INITIATOR','APPROVER'))<>2
     OR (SELECT count(DISTINCT principal_id) FROM app.bootstrap_approval_r3
         WHERE bootstrap_id=p_bootstrap_id)<>2 THEN
    RAISE EXCEPTION 'bootstrap requires two distinct approvals' USING ERRCODE='42501';
  END IF;
  SELECT a.backend_start INTO v_backend_start FROM pg_catalog.pg_stat_activity a
   WHERE a.pid=pg_catalog.pg_backend_pid() AND a.usename=session_user;
  IF v_backend_start IS NULL THEN
    RAISE EXCEPTION 'root bootstrap backend identity unavailable' USING ERRCODE='42501';
  END IF;
  SELECT current_epoch INTO v_epoch FROM app.principal_epoch
   WHERE principal_id=st.root_principal_id FOR UPDATE;
  IF v_epoch IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'bootstrap root epoch invalid' USING ERRCODE='40001';
  END IF;
  INSERT INTO app.session_role_registry(
    role_name,role_kind,capability_role,activation_token_digest,state,
    session_id,provisioned_at,assigned_at
  ) VALUES(
    session_user,'ROOT_ISSUER','elevator_root_issuer',st.root_token_digest,
    'ASSIGNED',v_session_id,clock_timestamp(),clock_timestamp()
  )
  ON CONFLICT (role_name) DO UPDATE
    SET state='ASSIGNED',session_id=EXCLUDED.session_id,assigned_at=EXCLUDED.assigned_at
    WHERE app.session_role_registry.state='AVAILABLE';
  UPDATE app.session_role_registry
     SET state='ACTIVE'
   WHERE role_name=session_user AND session_id=v_session_id;
  INSERT INTO app.trusted_session(
    session_id,principal_id,login_epoch,db_auth_role,audience,issuer,
    assertion_id,assertion_digest,issued_at,not_before,expires_at,
    state,binding_state,backend_pid,backend_started_at,activated_at,
    last_verified_at,binding_digest,created_at
  ) VALUES(
    v_session_id,st.root_principal_id,v_epoch,session_user,'bootstrap',
    'database-bootstrap',p_bootstrap_id::text,st.root_token_digest,
    clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '15 minutes',
    'ACTIVE','ACTIVE',pg_catalog.pg_backend_pid(),v_backend_start,
    clock_timestamp(),clock_timestamp(),
    app_private.sha256_hex(convert_to(v_session_id||':'||pg_catalog.pg_backend_pid()::text,'UTF8')),
    clock_timestamp()
  );
  INSERT INTO app.authority_grant(
    id,principal_id,session_id,subject_principal_id,object_scope,
    authority_code,project_id,policy_id,policy_revision_id,
    valid_from,valid_until,created_at
  ) VALUES(
    v_grant_id,st.root_principal_id,v_session_id,NULL,'GLOBAL',
    'AUTHORITY_ISSUE',NULL,NULL,NULL,clock_timestamp(),
    clock_timestamp()+interval '15 minutes',clock_timestamp()
  );
  UPDATE app.bootstrap_state_r3
     SET state='COMPLETE',completed_at=clock_timestamp(),root_grant_id=v_grant_id
   WHERE singleton=p_bootstrap_id;
  INSERT INTO app.bootstrap_event_r3(
    id,bootstrap_id,event_sequence,action,actor_role,actor_principal_id,occurred_at
  ) VALUES(
    gen_random_uuid()::text,p_bootstrap_id,
    (SELECT COALESCE(max(event_sequence),0)+1 FROM app.bootstrap_event_r3 WHERE bootstrap_id=p_bootstrap_id),
    'ROOT_SESSION_ACTIVE',session_user,st.root_principal_id,clock_timestamp()
  );
  PERFORM pg_catalog.set_config('aiea.session_binding',v_session_id,false);
END
$$;

GRANT EXECUTE ON FUNCTION app.bootstrap_prepare_r3(text,text,text,text,text,text,text,text,text)
  TO elevator_bootstrap_seed;
GRANT EXECUTE ON FUNCTION app.bootstrap_record_approval_r3(boolean,text)
  TO elevator_bootstrap_initiator,elevator_bootstrap_approver;
GRANT EXECUTE ON FUNCTION app.bootstrap_complete_root_r3(boolean,text)
  TO elevator_root_issuer;

GRANT CONNECT ON DATABASE elevator_advisor TO
  elevator_session_bootstrap_seed,elevator_session_bootstrap_initiator,
  elevator_session_bootstrap_approver,elevator_session_root_issuer;
GRANT elevator_bootstrap_seed TO elevator_session_bootstrap_seed
  WITH INHERIT FALSE, SET TRUE;
GRANT elevator_session_bootstrap TO elevator_session_bootstrap_seed,
  elevator_session_bootstrap_initiator,elevator_session_bootstrap_approver,
  elevator_session_root_issuer
  WITH INHERIT FALSE, SET TRUE;
GRANT elevator_bootstrap_initiator TO elevator_session_bootstrap_initiator
  WITH INHERIT FALSE, SET TRUE;
GRANT elevator_bootstrap_approver TO elevator_session_bootstrap_approver
  WITH INHERIT FALSE, SET TRUE;
GRANT elevator_root_issuer TO elevator_session_root_issuer
  WITH INHERIT FALSE, SET TRUE;

GRANT EXECUTE ON FUNCTION app.issue_authority_grant(text,text,text,text,text,text,text,timestamptz)
  TO elevator_root_issuer;

-- P2-01: a completed request may be recovered by a new Session of the same
-- Principal and scope, but only at the current PrincipalEpoch.

ALTER TABLE app.command_request
  ADD COLUMN epoch bigint;

CREATE TABLE app.command_request_replay_audit_r3 (
  id text PRIMARY KEY,
  operation text NOT NULL,
  request_id text NOT NULL,
  original_session_id text NOT NULL,
  replay_session_id text NOT NULL,
  principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  epoch bigint NOT NULL,
  request_hash text NOT NULL,
  replayed_at timestamptz(6) NOT NULL
);

CREATE OR REPLACE FUNCTION app_private.claim_command_request(
  p_operation text,
  p_request_id text,
  p_request_hash text,
  p_scope_key text,
  p_principal_id text,
  p_session_id text,
  p_result_type text
) RETURNS TABLE (replay boolean,result_id text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  r app.command_request%ROWTYPE;
  v_inserted boolean;
  v_epoch bigint;
BEGIN
  SELECT ts.login_epoch INTO STRICT v_epoch
    FROM app.trusted_session ts
   WHERE ts.session_id=p_session_id
     AND ts.principal_id=p_principal_id
     AND ts.state='ACTIVE'
     AND ts.binding_state='ACTIVE'
     AND ts.backend_pid=pg_catalog.pg_backend_pid()
     AND ts.backend_started_at=(
       SELECT a.backend_start FROM pg_catalog.pg_stat_activity a
        WHERE a.pid=pg_catalog.pg_backend_pid() AND a.usename=session_user
     )
     AND pg_catalog.current_setting('aiea.session_binding',true)=ts.session_id;
  INSERT INTO app.command_request(
    operation,request_id,request_hash,scope_key,principal_id,session_id,
    result_type,state,claimed_at,epoch
  ) VALUES(
    p_operation,p_request_id,p_request_hash,p_scope_key,p_principal_id,
    p_session_id,p_result_type,'CLAIMED',clock_timestamp(),v_epoch
  )
  ON CONFLICT (operation,request_id) DO NOTHING
  RETURNING true INTO v_inserted;
  IF v_inserted THEN
    RETURN QUERY SELECT false,NULL::text;
    RETURN;
  END IF;
  SELECT * INTO STRICT r FROM app.command_request
   WHERE operation=p_operation AND request_id=p_request_id
   FOR UPDATE;
  IF r.request_hash<>p_request_hash
     OR r.scope_key<>p_scope_key
     OR r.principal_id<>p_principal_id
     OR r.result_type<>p_result_type THEN
    RAISE EXCEPTION 'request id reused with different payload/scope' USING ERRCODE='40001';
  END IF;
  IF r.state<>'COMPLETED' THEN
    RAISE EXCEPTION 'request already in progress' USING ERRCODE='40001';
  END IF;
  IF r.session_id<>p_session_id THEN
    IF r.epoch<>v_epoch THEN
      RAISE EXCEPTION 'request replay epoch is stale' USING ERRCODE='40001';
    END IF;
    INSERT INTO app.command_request_replay_audit_r3(
      id,operation,request_id,original_session_id,replay_session_id,
      principal_id,epoch,request_hash,replayed_at
    ) VALUES(
      gen_random_uuid()::text,p_operation,p_request_id,r.session_id,
      p_session_id,p_principal_id,v_epoch,p_request_hash,clock_timestamp()
    );
  END IF;
  RETURN QUERY SELECT true,r.result_id;
END
$$;

ALTER TABLE app.command_request
  ALTER COLUMN epoch SET NOT NULL;

CREATE TRIGGER guard_command_request_replay_audit_r3
BEFORE UPDATE OR DELETE ON app.command_request_replay_audit_r3
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER deny_command_request_replay_audit_truncate_r3
BEFORE TRUNCATE ON app.command_request_replay_audit_r3
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();

CREATE TRIGGER deny_professional_review_truncate_r3
BEFORE TRUNCATE ON app.professional_review
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER guard_professional_review_rows_r3
BEFORE DELETE ON app.professional_review
FOR EACH ROW EXECUTE FUNCTION app_private.deny_delete_r3();
CREATE OR REPLACE FUNCTION app_private.guard_professional_review_state_r3()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  e app.professional_review_event%ROWTYPE;
BEGIN
  IF NEW.id<>OLD.id OR NEW.project_id<>OLD.project_id
     OR NEW.conversation_id<>OLD.conversation_id
     OR NEW.requirement_id<>OLD.requirement_id
     OR NEW.requirement_version_id<>OLD.requirement_version_id
     OR NEW.installation_scenario<>OLD.installation_scenario
     OR NEW.candidate_id<>OLD.candidate_id
     OR NEW.policy_id<>OLD.policy_id
     OR NEW.policy_revision_id<>OLD.policy_revision_id
     OR NEW.selection_candidate_result_id<>OLD.selection_candidate_result_id
     OR NEW.result_row_digest<>OLD.result_row_digest THEN
    RAISE EXCEPTION 'professional review identity immutable' USING ERRCODE='23514';
  END IF;
  SELECT * INTO STRICT e FROM app.professional_review_event
   WHERE review_id=NEW.id ORDER BY event_sequence DESC LIMIT 1;
  IF NEW.state<>e.next_state OR NEW.state_version<>e.state_version THEN
    RAISE EXCEPTION 'professional review state does not match event' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER guard_professional_review_state_r3
BEFORE UPDATE ON app.professional_review
FOR EACH ROW EXECUTE FUNCTION app_private.guard_professional_review_state_r3();
CREATE TRIGGER deny_trusted_session_truncate_r3
BEFORE TRUNCATE ON app.trusted_session
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();

CREATE UNIQUE INDEX authority_grant_active_scope_unique_r3c8c
ON app.authority_grant (
  session_id,authority_code,
  COALESCE(project_id,''),COALESCE(policy_id,''),
  COALESCE(policy_revision_id,''),COALESCE(subject_principal_id,'')
)
WHERE revoked_at IS NULL;

CREATE OR REPLACE FUNCTION app.revoke_authority_grant(
  p_grant_id text,
  p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  target app.authority_grant%ROWTYPE;
  admin_grant text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT target FROM app.authority_grant WHERE id=p_grant_id;
  admin_grant:=app_private.lock_authority_grant(
    s.session_id,s.principal_id,'AUTHORITY_REVOKE',
    target.project_id,target.policy_id,target.policy_revision_id,
    target.subject_principal_id
  );
  PERFORM 1 FROM app.authority_grant g WHERE g.id=p_grant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'authority grant missing' USING ERRCODE='23503';
  END IF;
  UPDATE app.authority_grant
     SET revoked_at=clock_timestamp(),revocation_reason=p_reason
   WHERE id=p_grant_id AND revoked_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'authority grant already revoked' USING ERRCODE='23514';
  END IF;
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
END
$$;

-- P2-04: validate all source-aux domains before the run can be sealed.

CREATE OR REPLACE FUNCTION app_private.validate_selection_source_aux_r3(
  p_selection_run_id text
) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  r record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM app.selection_requirement_field
     WHERE selection_run_id=p_selection_run_id
  ) THEN
    RAISE EXCEPTION 'selection has no requirement source facts' USING ERRCODE='23514';
  END IF;
  FOR r IN
    SELECT source_kind,source_entity_type,source_entity_id,
           source_aux_is_null,source_aux_text
      FROM app.selection_requirement_field
     WHERE selection_run_id=p_selection_run_id
  LOOP
    IF r.source_aux_is_null THEN
      IF r.source_aux_text IS NOT NULL THEN
        RAISE EXCEPTION 'selection source aux null mismatch' USING ERRCODE='23514';
      END IF;
    ELSE
      PERFORM app_private.validate_source_aux_r3(r.source_aux_text);
    END IF;
    IF octet_length(app.source_key_r3(
      r.source_kind,r.source_entity_type,r.source_entity_id,
      r.source_aux_is_null,r.source_aux_text
    ))>362 THEN
      RAISE EXCEPTION 'selection source key too large' USING ERRCODE='22001';
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM app.selection_source_result s
     WHERE s.selection_run_id=p_selection_run_id
       AND NOT s.source_aux_is_null
       AND s.source_aux_text IS NULL
  ) OR EXISTS (
    SELECT 1 FROM app.selection_source_result s
     WHERE s.selection_run_id=p_selection_run_id
       AND s.source_aux_is_null
       AND s.source_aux_text IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'selection source result aux mismatch' USING ERRCODE='23514';
  END IF;
  FOR r IN
    SELECT source_kind,source_entity_type,source_entity_id,
           source_aux_is_null,source_aux_text
      FROM app.selection_source_result
     WHERE selection_run_id=p_selection_run_id
  LOOP
    IF NOT r.source_aux_is_null THEN
      PERFORM app_private.validate_source_aux_r3(r.source_aux_text);
    END IF;
    IF octet_length(app.source_key_r3(
      r.source_kind,r.source_entity_type,r.source_entity_id,
      r.source_aux_is_null,r.source_aux_text
    ))>362 THEN
      RAISE EXCEPTION 'selection source result key too large' USING ERRCODE='22001';
    END IF;
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION app.seal_selection_run(
  p_selection_run_id text,
  p_expected_mutation_version bigint,
  p_request_id text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  run app.selection_run%ROWTYPE;
  v_grant_id text;
  v_request_hash text;
  v_replay boolean;
  v_result text;
  v_candidate_count integer;
  v_result_count integer;
  v_digest text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT run FROM app.selection_run WHERE id=p_selection_run_id;
  v_grant_id:=app_private.lock_authority_grant(
    s.session_id,s.principal_id,'SELECTION_SEAL',run.project_id,NULL,NULL,NULL
  );
  PERFORM 1 FROM app.selection_run r WHERE r.id=p_selection_run_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'selection run missing' USING ERRCODE='23503';
  END IF;
  v_request_hash:=app_private.r6_request_hash(jsonb_build_object(
    'operation','SELECTION_SEAL','runId',run.id,
    'expectedMutationVersion',p_expected_mutation_version
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'SELECTION_SEAL',p_request_id,v_request_hash,run.id,
    s.principal_id,s.session_id,'SELECTION_RUN_SEAL'
  );
  IF v_replay THEN
    PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
    RETURN v_result;
  END IF;
  IF run.state<>'RUNNING' OR run.mutation_version<>p_expected_mutation_version THEN
    RAISE EXCEPTION 'selection seal CAS failed' USING ERRCODE='40001';
  END IF;
  PERFORM app_private.validate_selection_source_aux_r3(run.id);
  SELECT count(*) INTO v_candidate_count
    FROM app.selection_candidate c WHERE c.selection_run_id=run.id;
  SELECT count(*) INTO v_result_count
    FROM app.selection_candidate_result r WHERE r.selection_run_id=run.id;
  IF v_candidate_count=0 OR v_result_count<>v_candidate_count THEN
    RAISE EXCEPTION 'selection result incomplete' USING ERRCODE='23514';
  END IF;
  v_digest:=app.selection_result_digest(run.id);
  UPDATE app.selection_run
     SET state='SEALED',mutation_version=mutation_version+1
   WHERE id=run.id AND state='RUNNING'
     AND mutation_version=p_expected_mutation_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'selection seal CAS failed' USING ERRCODE='40001';
  END IF;
  INSERT INTO app.selection_run_seal(
    selection_run_id,case_id,project_id,conversation_id,requirement_id,
    requirement_version_id,installation_scenario,rule_set_revision_id,
    rule_set_content_digest,candidate_count,result_digest,sealed_at
  ) VALUES(
    run.id,run.case_id,run.project_id,run.conversation_id,run.requirement_id,
    run.requirement_version_id,run.installation_scenario,
    run.rule_set_revision_id,run.rule_set_content_digest,
    v_candidate_count,v_digest,clock_timestamp()
  );
  PERFORM app_private.append_selection_run_event(
    run.id,'SEAL',s.principal_id,s.session_id,v_grant_id,
    p_request_id,v_request_hash
  );
  PERFORM app_private.complete_command_request('SELECTION_SEAL',p_request_id,v_digest);
  PERFORM app_private.assert_active_session(s.session_id,s.principal_id,s.login_epoch);
  RETURN v_digest;
END
$$;

CREATE OR REPLACE FUNCTION app_private.lock_current_session()
RETURNS TABLE (
  session_id text,
  principal_id text,
  login_epoch bigint,
  capability_role text
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_principal_id text;
  v_current_epoch bigint;
  v_session_epoch bigint;
  v_session_id text;
  v_capability_role text;
  v_role_kind text;
  v_expected_backend_start timestamptz;
BEGIN
  SELECT ts.principal_id INTO v_principal_id
    FROM app.trusted_session ts
   WHERE ts.db_auth_role=session_user
     AND ts.state='ACTIVE'
     AND ts.binding_state IN ('PROVISIONED','ACTIVE');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'session role missing' USING ERRCODE='42501';
  END IF;
  SELECT pe.current_epoch INTO v_current_epoch
    FROM app.principal_epoch pe WHERE pe.principal_id=v_principal_id FOR SHARE;
  SELECT a.backend_start INTO v_expected_backend_start
    FROM pg_catalog.pg_stat_activity a
   WHERE a.pid=pg_catalog.pg_backend_pid() AND a.usename=session_user;
  SELECT ts.session_id,ts.login_epoch,reg_row.capability_role,reg_row.role_kind
    INTO v_session_id,v_session_epoch,v_capability_role,v_role_kind
    FROM app.trusted_session ts
    JOIN app.session_role_registry reg_row
      ON reg_row.role_name=ts.db_auth_role AND reg_row.session_id=ts.session_id
   WHERE ts.db_auth_role=session_user
     AND ts.principal_id=v_principal_id
     AND ts.state='ACTIVE'
     AND ts.binding_state='ACTIVE'
     AND ts.backend_pid=pg_catalog.pg_backend_pid()
     AND ts.backend_started_at=v_expected_backend_start
     AND pg_catalog.current_setting('aiea.session_binding',true)=ts.session_id
     AND ts.login_epoch=v_current_epoch
     AND clock_timestamp()>=ts.not_before
     AND clock_timestamp()<ts.expires_at
     AND reg_row.state='ACTIVE'
   FOR SHARE OF ts,reg_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'current backend is not the active trusted session' USING ERRCODE='42501';
  END IF;
  PERFORM app_private.validate_session_role_r3(
    session_user,v_role_kind,v_capability_role
  );
  RETURN QUERY SELECT v_session_id,v_principal_id,v_session_epoch,v_capability_role;
END
$$;

GRANT USAGE ON SCHEMA app TO
  elevator_bootstrap_seed,elevator_bootstrap_initiator,
  elevator_bootstrap_approver,elevator_root_issuer,elevator_catalog_reviewer,
  elevator_catalog_publisher;

GRANT EXECUTE ON FUNCTION app.create_catalog_review_event_r3(
  text,text,text,text,text,text,text,text,text,text,text,text,text,text,text
) TO elevator_catalog_reviewer;
GRANT EXECUTE ON FUNCTION app.create_price_revision_r3(
  text,text,text,text,text,text,text,bigint,text,text,text,text,
  timestamptz,timestamptz,timestamptz,text,numeric,numeric,text,text
) TO elevator_catalog_publisher;
GRANT EXECUTE ON FUNCTION app.create_requirement_field_fact_r3(
  text,text,text,text,jsonb,text,text,text,text,text,boolean,text,text,text
) TO elevator_runtime_worker;

REVOKE ALL ON ALL TABLES IN SCHEMA app FROM
  elevator_bootstrap_seed,elevator_bootstrap_initiator,
  elevator_bootstrap_approver,elevator_root_issuer,elevator_catalog_reviewer,
  elevator_catalog_publisher;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;

ALTER FUNCTION app_private.price_fact_canonical_v1(text,text,text,text,text,text,text,bigint,text,text,text,text,timestamptz,timestamptz,timestamptz,text,numeric,numeric)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.price_fact_digest_v1(text,text,text,text,text,text,text,bigint,text,text,text,text,timestamptz,timestamptz,timestamptz,text,numeric,numeric)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_compute_price_revision_fact_digest_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_fill_selection_price_fact_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.price_row_payload_v1(text,jsonb)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.price_row_digest_v1(text,jsonb)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_compute_selection_price_row_digest_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_fill_snapshot_price_fact_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_verify_snapshot_price_fact_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.validate_source_aux_r3(text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.requirement_source_digest_r3(text,jsonb)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_compute_requirement_source_digest_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_bind_selection_requirement_source_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_bind_snapshot_requirement_source_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_verify_snapshot_requirement_source_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.catalog_review_event_payload_v1(jsonb)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.catalog_review_event_digest_v1(jsonb)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_compute_catalog_review_event_digest_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.catalog_review_row_payload_v1(text,jsonb)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.catalog_review_row_digest_v1(text,jsonb)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_compute_selection_catalog_review_row_digest_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_bind_selection_catalog_review_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_bind_snapshot_catalog_review_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_verify_snapshot_catalog_review_row_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.professional_basis_digest_v1(jsonb)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.professional_event_digest_v1(jsonb)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_fill_professional_event_review_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_verify_professional_event_digest_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.professional_event_decision_r3(text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_bind_selection_professional_review_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_bind_snapshot_professional_review_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_verify_snapshot_professional_review_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.guard_professional_review_state_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.validate_selection_source_aux_r3(text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.validate_session_role_r3(text,text,text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.lock_current_session() OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.issue_authority_grant(text,text,text,text,text,text,text,timestamptz)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.bootstrap_prepare_r3(text,text,text,text,text,text,text,text,text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.bootstrap_record_approval_r3(boolean,text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.bootstrap_complete_root_r3(boolean,text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.create_requirement_field_fact_r3(text,text,text,text,jsonb,text,text,text,text,text,boolean,text,text,text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.create_catalog_review_event_r3(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.create_price_revision_r3(text,text,text,text,text,text,text,bigint,text,text,text,text,timestamptz,timestamptz,timestamptz,text,numeric,numeric,text,text)
  OWNER TO elevator_review_function_owner;

ALTER TABLE app.selection_candidate
  ADD CONSTRAINT selection_candidate_run_unique_c8c UNIQUE (id,selection_run_id);
ALTER TABLE app.product_revision
  ADD CONSTRAINT product_revision_id_digest_unique_c8c
  UNIQUE (id,content_digest);
ALTER TABLE app.selection_candidate_result
  ADD CONSTRAINT selection_result_id_candidate_digest_unique_c8c
  UNIQUE (id,candidate_id,row_digest);
ALTER TABLE app.requirement_assertion_r3
  ADD CONSTRAINT requirement_assertion_context_exact_unique_c8c
  UNIQUE (
    id,requirement_version_id,requirement_id,project_id,
    conversation_id,installation_scenario,field_key
  );
ALTER TABLE app.requirement_assertion_r3
  ADD CONSTRAINT requirement_assertion_digest_exact_unique_c8c
  UNIQUE (id,requirement_version_id,field_key,content_digest);
ALTER TABLE app.requirement_field_value_r3
  ADD CONSTRAINT requirement_value_digest_exact_unique_c8c
  UNIQUE (id,requirement_version_id,field_key,content_digest);






-- ===== END R3-C8 CORRECTIONS OVERLAY =====

-- ===== END FROZEN R3-C8 CORRECTIONS COMPLETE DDL =====

-- ===== BEGIN R3-C8 CORRECTIONS R2 OVERLAY =====
-- FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS-R2
-- Final-state overlay over the frozen R3-C8 Corrections complete DDL.
-- DESIGN ONLY. Do not execute.

-- ===========================================================================
-- 1. Owner privilege closure
-- ===========================================================================

CREATE OR REPLACE FUNCTION app_private.owner_closure_digest_r2(
  p_role_name text
) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
  WITH RECURSIVE role_closure(role_oid) AS (
    SELECT r.oid
      FROM pg_catalog.pg_roles r
     WHERE r.rolname=p_role_name
    UNION
    SELECT am.roleid
      FROM pg_catalog.pg_auth_members am
      JOIN role_closure rc ON rc.role_oid=am.member
  ),
  catalog_state AS (
    SELECT 'database'::text AS kind,d.datname AS object_name,
           r.rolname AS owner_name,'database'::text AS detail
      FROM pg_catalog.pg_database d
      JOIN pg_catalog.pg_roles r ON r.oid=d.datdba
     WHERE d.datname=pg_catalog.current_database()
    UNION ALL
    SELECT 'schema',n.nspname,r.rolname,n.nspname
      FROM pg_catalog.pg_namespace n
      JOIN pg_catalog.pg_roles r ON r.oid=n.nspowner
     WHERE n.nspname IN ('app','app_private')
    UNION ALL
    SELECT 'relation',n.nspname||'.'||c.relname,r.rolname,c.relkind::text
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_catalog.pg_roles r ON r.oid=c.relowner
     WHERE n.nspname IN ('app','app_private')
       AND c.relkind IN ('r','p','v','m','f','S')
    UNION ALL
    SELECT 'routine',n.nspname||'.'||p.proname,r.rolname,p.prokind::text
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      JOIN pg_catalog.pg_roles r ON r.oid=p.proowner
     WHERE n.nspname IN ('app','app_private')
       AND p.prokind IN ('f','p')
    UNION ALL
    SELECT 'type',n.nspname||'.'||t.typname,r.rolname,t.typtype::text
      FROM pg_catalog.pg_type t
      JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
      JOIN pg_catalog.pg_roles r ON r.oid=t.typowner
     WHERE n.nspname IN ('app','app_private')
       AND t.typtype IN ('d','e','r','c')
    UNION ALL
    SELECT 'membership',
           member_role.rolname||'->'||parent_role.rolname,
           parent_role.rolname,
           concat_ws(':',am.inherit_option::text,am.set_option::text,am.admin_option::text)
      FROM pg_catalog.pg_auth_members am
      JOIN pg_catalog.pg_roles member_role ON member_role.oid=am.member
      JOIN pg_catalog.pg_roles parent_role ON parent_role.oid=am.roleid
     WHERE am.member IN (SELECT role_oid FROM role_closure)
  )
  SELECT app_private.sha256_hex(
    convert_to(
      coalesce(
        string_agg(
          kind||E'\x1f'||object_name||E'\x1f'||owner_name||E'\x1f'||detail,
          E'\x1e' ORDER BY kind,object_name,owner_name,detail
        ),
        ''
      ),
      'UTF8'
    )
  )
  FROM catalog_state
$$;

CREATE OR REPLACE FUNCTION app_private.assert_protected_owner_closure_r2(
  p_role_name text
) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_role_oid oid;
  v_database_owner oid;
  v_schema_owner oid;
  v_relation_owner oid;
  v_function_owner oid;
  v_type_owner oid;
  v_schema_count integer;
  v_relation_count integer;
  v_function_count integer;
  v_type_count integer;
  v_digest text;
BEGIN
  -- PostgreSQL 18 pg_database_owner has the current database Owner as its
  -- single implicit member. The datdba and pg_has_role checks cover it.
  SELECT r.oid INTO STRICT v_role_oid
    FROM pg_catalog.pg_roles r WHERE r.rolname=p_role_name;
  SELECT d.datdba INTO STRICT v_database_owner
    FROM pg_catalog.pg_database d
   WHERE d.datname=pg_catalog.current_database();

  SELECT count(*) INTO v_schema_count
    FROM pg_catalog.pg_namespace n
   WHERE n.nspname IN ('app','app_private');
  SELECT count(*) INTO v_relation_count
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname IN ('app','app_private')
     AND c.relkind IN ('r','p','v','m','f','S');
  SELECT count(*) INTO v_function_count
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname IN ('app','app_private')
     AND p.prokind IN ('f','p');
  SELECT count(*) INTO v_type_count
    FROM pg_catalog.pg_type t
    JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
   WHERE n.nspname IN ('app','app_private')
     AND t.typtype IN ('d','e','r','c');

  IF v_schema_count<>2 OR v_relation_count=0
     OR v_function_count=0 OR v_type_count=0 THEN
    RAISE EXCEPTION 'protected owner catalog incomplete' USING ERRCODE='42501';
  END IF;

  IF v_database_owner=v_role_oid
     OR pg_catalog.pg_has_role(v_role_oid,v_database_owner,'MEMBER') THEN
    RAISE EXCEPTION 'session role reaches database owner' USING ERRCODE='42501';
  END IF;

  SELECT n.nspowner INTO v_schema_owner
    FROM pg_catalog.pg_namespace n
   WHERE n.nspname IN ('app','app_private')
     AND (n.nspowner=v_role_oid OR pg_catalog.pg_has_role(v_role_oid,n.nspowner,'MEMBER'))
   LIMIT 1;
  IF v_schema_owner IS NOT NULL THEN
    RAISE EXCEPTION 'session role reaches protected schema owner' USING ERRCODE='42501';
  END IF;

  SELECT c.relowner INTO v_relation_owner
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname IN ('app','app_private')
     AND c.relkind IN ('r','p','v','m','f','S')
     AND (c.relowner=v_role_oid OR pg_catalog.pg_has_role(v_role_oid,c.relowner,'MEMBER'))
   LIMIT 1;
  IF v_relation_owner IS NOT NULL THEN
    RAISE EXCEPTION 'session role reaches protected relation owner' USING ERRCODE='42501';
  END IF;

  SELECT p.proowner INTO v_function_owner
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname IN ('app','app_private')
     AND p.prokind IN ('f','p')
     AND (p.proowner=v_role_oid OR pg_catalog.pg_has_role(v_role_oid,p.proowner,'MEMBER'))
   LIMIT 1;
  IF v_function_owner IS NOT NULL THEN
    RAISE EXCEPTION 'session role reaches protected function owner' USING ERRCODE='42501';
  END IF;

  SELECT t.typowner INTO v_type_owner
    FROM pg_catalog.pg_type t
    JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
   WHERE n.nspname IN ('app','app_private')
     AND t.typtype IN ('d','e','r','c')
     AND (t.typowner=v_role_oid OR pg_catalog.pg_has_role(v_role_oid,t.typowner,'MEMBER'))
   LIMIT 1;
  IF v_type_owner IS NOT NULL THEN
    RAISE EXCEPTION 'session role reaches protected type owner' USING ERRCODE='42501';
  END IF;

  v_digest := app_private.owner_closure_digest_r2(p_role_name);
  PERFORM pg_catalog.set_config('aiea.owner_closure_digest',v_digest,true);
  RETURN v_digest;
END
$$;

-- ===========================================================================
-- 2. Session termination classification
-- ===========================================================================

ALTER TABLE app.trusted_session
  ADD COLUMN termination_class text NOT NULL DEFAULT 'NONE'
    CHECK (
      termination_class IN (
        'NONE','NORMAL_CLOSE','NATURAL_EXPIRY','CREDENTIAL_ROTATION',
        'EPOCH_ADVANCE','ADMIN_REVOKE','SECURITY_REVOKE',
        'PRINCIPAL_DISABLED','GRANT_REVOKED'
      )
    );

-- ===========================================================================
-- 3. Root Principal binding, bootstrap ledger, recovery and rotation
-- ===========================================================================

ALTER TABLE app.bootstrap_operator_r3
  ADD CONSTRAINT bootstrap_operator_identity_unique_r2
    UNIQUE (role_name,operator_kind,principal_id);

ALTER TABLE app.bootstrap_state_r3
  ADD COLUMN bootstrap_generation bigint NOT NULL DEFAULT 1,
  ADD COLUMN root_operator_kind text NOT NULL DEFAULT 'ROOT',
  ADD COLUMN root_session_id text,
  ADD COLUMN root_grant_issuer_principal_id text,
  ADD CONSTRAINT bootstrap_generation_positive_r2 CHECK (bootstrap_generation>0),
  ADD CONSTRAINT bootstrap_state_root_operator_kind_r2
    CHECK (root_operator_kind='ROOT'),
  ADD CONSTRAINT bootstrap_state_generation_unique_r2
    UNIQUE (singleton,bootstrap_generation),
  ADD CONSTRAINT bootstrap_state_root_operator_fk_r2
    FOREIGN KEY (root_role_name,root_operator_kind,root_principal_id)
    REFERENCES app.bootstrap_operator_r3(
      role_name,operator_kind,principal_id
    ) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE app.bootstrap_generation_r2 (
  bootstrap_id boolean NOT NULL
    REFERENCES app.bootstrap_state_r3(singleton),
  bootstrap_generation bigint NOT NULL CHECK (bootstrap_generation>0),
  root_principal_id text NOT NULL,
  root_role_name text NOT NULL,
  root_operator_kind text NOT NULL DEFAULT 'ROOT'
    CHECK (root_operator_kind='ROOT'),
  root_token_digest text NOT NULL CHECK (root_token_digest ~ '^[0-9a-f]{64}$'),
  activation_state text NOT NULL CHECK (
    activation_state IN ('ACTIVE','SUPERSEDED','REVOKED','LOCKED')
  ),
  created_at timestamptz(6) NOT NULL,
  superseded_at timestamptz(6),
  generation_digest text NOT NULL CHECK (generation_digest ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY (bootstrap_id,bootstrap_generation),
  UNIQUE (bootstrap_id,bootstrap_generation,root_principal_id),
  UNIQUE (
    bootstrap_id,bootstrap_generation,root_principal_id,root_role_name
  ),
  FOREIGN KEY (root_role_name,root_operator_kind,root_principal_id)
    REFERENCES app.bootstrap_operator_r3(
      role_name,operator_kind,principal_id
    ) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE app.bootstrap_lifecycle_r2 (
  bootstrap_id boolean PRIMARY KEY
    REFERENCES app.bootstrap_state_r3(singleton),
  bootstrap_generation bigint NOT NULL CHECK (bootstrap_generation>0),
  state text NOT NULL CHECK (
    state IN (
      'SEED_READY','APPROVAL_PENDING','ROOT_ISSUANCE_PENDING',
      'ROOT_ISSUED','BOOTSTRAP_COMPLETED','RECOVERY_PENDING',
      'RECOVERY_APPROVED','ROOT_ROTATION_PENDING','ROOT_ROTATED',
      'REVOKED','LOCKED'
    )
  ),
  state_revision bigint NOT NULL CHECK (state_revision>0),
  root_principal_id text NOT NULL,
  root_role_name text NOT NULL,
  root_operator_kind text NOT NULL DEFAULT 'ROOT'
    CHECK (root_operator_kind='ROOT'),
  root_session_id text,
  root_grant_id text,
  recovery_request_id text,
  locked_reason_code text,
  updated_at timestamptz(6) NOT NULL,
  UNIQUE (bootstrap_id,bootstrap_generation),
  UNIQUE (bootstrap_id,bootstrap_generation,root_principal_id),
  UNIQUE (
    bootstrap_id,bootstrap_generation,root_principal_id,root_role_name
  ),
  UNIQUE (
    bootstrap_id,bootstrap_generation,root_session_id,root_principal_id
  ),
  UNIQUE (
    bootstrap_id,bootstrap_generation,root_session_id,root_principal_id,
    root_role_name
  ),
  UNIQUE (
    bootstrap_id,bootstrap_generation,root_grant_id,root_principal_id
  ),
  FOREIGN KEY (
    bootstrap_id,bootstrap_generation
  ) REFERENCES app.bootstrap_state_r3(
    singleton,bootstrap_generation
  ),
  FOREIGN KEY (root_role_name,root_operator_kind,root_principal_id)
    REFERENCES app.bootstrap_operator_r3(
      role_name,operator_kind,principal_id
    ) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (bootstrap_id,bootstrap_generation)
    REFERENCES app.bootstrap_generation_r2(
      bootstrap_id,bootstrap_generation
    )
);

CREATE TABLE app.bootstrap_request_ledger_r2 (
  operation text NOT NULL,
  request_id text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  bootstrap_id boolean NOT NULL,
  bootstrap_generation bigint NOT NULL,
  actor_role text NOT NULL,
  actor_principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  result_type text NOT NULL,
  result_id text,
  state text NOT NULL CHECK (state IN ('CLAIMED','COMPLETED')),
  claimed_at timestamptz(6) NOT NULL,
  completed_at timestamptz(6),
  PRIMARY KEY (operation,request_id),
  CHECK (
    (state='CLAIMED' AND result_id IS NULL AND completed_at IS NULL)
    OR (state='COMPLETED' AND result_id IS NOT NULL AND completed_at IS NOT NULL)
  ),
  FOREIGN KEY (bootstrap_id,bootstrap_generation)
    REFERENCES app.bootstrap_generation_r2(
      bootstrap_id,bootstrap_generation
    )
);

CREATE TABLE app.bootstrap_approval_r2 (
  bootstrap_id boolean NOT NULL,
  bootstrap_generation bigint NOT NULL,
  operator_kind text NOT NULL CHECK (operator_kind IN ('INITIATOR','APPROVER')),
  role_name text NOT NULL,
  principal_id text NOT NULL,
  root_principal_id text NOT NULL,
  backend_pid integer NOT NULL CHECK (backend_pid>0),
  backend_started_at timestamptz(6) NOT NULL,
  approved_at timestamptz(6) NOT NULL,
  request_id text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY (bootstrap_id,bootstrap_generation,operator_kind),
  UNIQUE (bootstrap_id,bootstrap_generation,principal_id),
  CHECK (principal_id<>root_principal_id),
  FOREIGN KEY (bootstrap_id,bootstrap_generation)
    REFERENCES app.bootstrap_generation_r2(
      bootstrap_id,bootstrap_generation
    ),
  FOREIGN KEY (bootstrap_id,bootstrap_generation,root_principal_id)
    REFERENCES app.bootstrap_generation_r2(
      bootstrap_id,bootstrap_generation,root_principal_id
    ),
  FOREIGN KEY (role_name,operator_kind,principal_id)
    REFERENCES app.bootstrap_operator_r3(
      role_name,operator_kind,principal_id
    )
);

CREATE TABLE app.bootstrap_root_session_r2 (
  bootstrap_id boolean NOT NULL,
  bootstrap_generation bigint NOT NULL,
  session_id text PRIMARY KEY,
  root_principal_id text NOT NULL,
  root_role_name text NOT NULL,
  state text NOT NULL CHECK (state IN ('ACTIVE','REVOKED','EXPIRED')),
  issued_at timestamptz(6) NOT NULL,
  revoked_at timestamptz(6),
  UNIQUE (bootstrap_id,bootstrap_generation),
  UNIQUE (session_id,root_principal_id),
  UNIQUE (
    bootstrap_id,bootstrap_generation,session_id,root_principal_id
  ),
  FOREIGN KEY (bootstrap_id,bootstrap_generation)
    REFERENCES app.bootstrap_generation_r2(
      bootstrap_id,bootstrap_generation
    ),
  FOREIGN KEY (session_id,root_principal_id)
    REFERENCES app.trusted_session(session_id,principal_id)
);

ALTER TABLE app.trusted_session
  ADD CONSTRAINT trusted_session_id_principal_unique_r2
    UNIQUE (session_id,principal_id);

ALTER TABLE app.authority_grant
  ADD CONSTRAINT authority_grant_id_session_principal_unique_r2
    UNIQUE (id,session_id,principal_id);

CREATE TABLE app.bootstrap_root_grant_r2 (
  bootstrap_id boolean NOT NULL,
  bootstrap_generation bigint NOT NULL,
  root_grant_id text PRIMARY KEY,
  root_session_id text NOT NULL,
  root_principal_id text NOT NULL,
  root_role_name text NOT NULL,
  issuer_principal_id text NOT NULL,
  grant_version bigint NOT NULL CHECK (grant_version>0),
  mapping_digest text NOT NULL CHECK (mapping_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz(6) NOT NULL,
  UNIQUE (bootstrap_id,bootstrap_generation),
  UNIQUE (
    bootstrap_id,bootstrap_generation,root_grant_id,root_principal_id
  ),
  UNIQUE (root_grant_id,bootstrap_id,bootstrap_generation),
  CHECK (root_principal_id=issuer_principal_id),
  FOREIGN KEY (bootstrap_id,bootstrap_generation)
    REFERENCES app.bootstrap_generation_r2(
      bootstrap_id,bootstrap_generation
    ),
  FOREIGN KEY (root_session_id,root_principal_id)
    REFERENCES app.bootstrap_root_session_r2(
      session_id,root_principal_id
    ),
  FOREIGN KEY (root_grant_id,root_session_id,root_principal_id)
    REFERENCES app.authority_grant(id,session_id,principal_id)
);

ALTER TABLE app.bootstrap_lifecycle_r2
  ADD CONSTRAINT bootstrap_lifecycle_root_session_fk_r2
    FOREIGN KEY (
      bootstrap_id,bootstrap_generation,root_session_id,root_principal_id
    ) REFERENCES app.bootstrap_root_session_r2(
      bootstrap_id,bootstrap_generation,session_id,root_principal_id
    ) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT bootstrap_lifecycle_root_grant_fk_r2
    FOREIGN KEY (
      bootstrap_id,bootstrap_generation,root_grant_id,root_principal_id
    ) REFERENCES app.bootstrap_root_grant_r2(
      bootstrap_id,bootstrap_generation,root_grant_id,root_principal_id
    ) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE app.bootstrap_event_r2 (
  id text PRIMARY KEY,
  bootstrap_id boolean NOT NULL,
  bootstrap_generation bigint NOT NULL,
  event_sequence bigint NOT NULL CHECK (event_sequence>0),
  action text NOT NULL CHECK (
    action IN (
      'SEED_READY','APPROVE_INITIATOR','APPROVE_APPROVER',
      'ROOT_SESSION_ACTIVE','BOOTSTRAP_COMPLETED',
      'RECOVERY_REQUESTED','RECOVERY_APPROVED','RECOVERY_EXECUTED',
      'ROTATION_REQUESTED','ROTATION_APPROVED','ROTATION_EXECUTED',
      'ROOT_ROTATED','ROOT_REVOKED','LOCKED'
    )
  ),
  actor_role text NOT NULL,
  actor_principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  root_session_id text,
  root_grant_id text,
  occurred_at timestamptz(6) NOT NULL,
  content_digest text NOT NULL CHECK (content_digest ~ '^[0-9a-f]{64}$'),
  UNIQUE (bootstrap_id,bootstrap_generation,event_sequence),
  FOREIGN KEY (bootstrap_id,bootstrap_generation)
    REFERENCES app.bootstrap_generation_r2(
      bootstrap_id,bootstrap_generation
    ),
  FOREIGN KEY (root_session_id,actor_principal_id)
    REFERENCES app.bootstrap_root_session_r2(session_id,root_principal_id)
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (root_grant_id,bootstrap_id,bootstrap_generation)
    REFERENCES app.bootstrap_root_grant_r2(
      root_grant_id,bootstrap_id,bootstrap_generation
    ) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE app.bootstrap_recovery_r2 (
  id text PRIMARY KEY,
  bootstrap_id boolean NOT NULL,
  from_generation bigint NOT NULL CHECK (from_generation>0),
  kind text NOT NULL CHECK (kind IN ('RECOVERY','ROTATION')),
  reason_class text NOT NULL CHECK (
    reason_class IN (
      'LOST_RESPONSE','ROOT_SESSION_EXPIRED','ROOT_SESSION_REVOKED',
      'ROOT_GRANT_EXPIRED','ROOT_GRANT_REVOKED','OPERATOR_LOST',
      'CREDENTIAL_COMPROMISE','PLANNED_ROTATION'
    )
  ),
  state text NOT NULL CHECK (
    state IN ('PENDING','APPROVED','EXECUTED','DENIED','LOCKED')
  ),
  current_root_principal_id text NOT NULL,
  target_root_principal_id text NOT NULL,
  target_root_role_name text NOT NULL,
  target_token_digest text NOT NULL CHECK (target_token_digest ~ '^[0-9a-f]{64}$'),
  requested_by_role text NOT NULL,
  requested_by_principal_id text NOT NULL,
  requested_at timestamptz(6) NOT NULL,
  approved_at timestamptz(6),
  executed_at timestamptz(6),
  new_generation bigint CHECK (new_generation IS NULL OR new_generation>from_generation),
  request_id text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  content_digest text NOT NULL CHECK (content_digest ~ '^[0-9a-f]{64}$'),
  CHECK (target_root_principal_id<>current_root_principal_id),
  FOREIGN KEY (bootstrap_id,from_generation)
    REFERENCES app.bootstrap_generation_r2(
      bootstrap_id,bootstrap_generation
    )
);

CREATE TABLE app.bootstrap_recovery_approval_r2 (
  recovery_id text NOT NULL REFERENCES app.bootstrap_recovery_r2(id),
  operator_kind text NOT NULL CHECK (operator_kind IN ('INITIATOR','APPROVER')),
  role_name text NOT NULL,
  principal_id text NOT NULL,
  backend_pid integer NOT NULL CHECK (backend_pid>0),
  backend_started_at timestamptz(6) NOT NULL,
  approved_at timestamptz(6) NOT NULL,
  request_id text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY (recovery_id,operator_kind),
  UNIQUE (recovery_id,principal_id)
);

CREATE OR REPLACE FUNCTION app_private.bootstrap_request_payload_v2(
  p_row jsonb
) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path=pg_catalog
RETURN jsonb_build_object(
  'schema','AIEA-BOOTSTRAP-EVENT-V2',
  'id',p_row->>'id',
  'bootstrapId',p_row->>'bootstrap_id',
  'generation',p_row->>'bootstrap_generation',
  'sequence',p_row->>'event_sequence',
  'action',p_row->>'action',
  'actorRole',p_row->>'actor_role',
  'actorPrincipalId',p_row->>'actor_principal_id',
  'rootSessionId',p_row->'root_session_id',
  'rootGrantId',p_row->'root_grant_id',
  'occurredAtUtc',to_char(
    (p_row->>'occurred_at')::timestamptz AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
  )
);

CREATE OR REPLACE FUNCTION app_private.bootstrap_request_digest_v2(
  p_row jsonb
) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path=pg_catalog,app_private
RETURN app_private.sha256_hex(
  decode('414945412D424F4F5453545241502D4556454E5400763200','hex')
  || convert_to(app_private.bootstrap_request_payload_v2(p_row)::text,'UTF8')
);

CREATE OR REPLACE FUNCTION app_private.a_compute_bootstrap_event_digest_r2()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  NEW.occurred_at := date_trunc('microseconds',NEW.occurred_at);
  NEW.content_digest := app_private.bootstrap_request_digest_v2(to_jsonb(NEW));
  RETURN NEW;
END
$$;

CREATE TRIGGER a_compute_bootstrap_event_digest_r2
BEFORE INSERT OR UPDATE ON app.bootstrap_event_r2
FOR EACH ROW EXECUTE FUNCTION app_private.a_compute_bootstrap_event_digest_r2();

CREATE OR REPLACE FUNCTION app_private.claim_bootstrap_request_r2(
  p_operation text,
  p_request_id text,
  p_request_hash text,
  p_bootstrap_id boolean,
  p_generation bigint,
  p_actor_role text,
  p_actor_principal_id text,
  p_result_type text
) RETURNS TABLE(replay boolean,result_id text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  r app.bootstrap_request_ledger_r2%ROWTYPE;
  v_inserted boolean;
BEGIN
  INSERT INTO app.bootstrap_request_ledger_r2(
    operation,request_id,request_hash,bootstrap_id,bootstrap_generation,
    actor_role,actor_principal_id,result_type,state,claimed_at
  ) VALUES(
    p_operation,p_request_id,p_request_hash,p_bootstrap_id,p_generation,
    p_actor_role,p_actor_principal_id,p_result_type,'CLAIMED',clock_timestamp()
  )
  ON CONFLICT (operation,request_id) DO NOTHING
  RETURNING true INTO v_inserted;
  IF v_inserted THEN
    RETURN QUERY SELECT false,NULL::text;
    RETURN;
  END IF;
  SELECT * INTO STRICT r
    FROM app.bootstrap_request_ledger_r2
   WHERE operation=p_operation AND request_id=p_request_id
   FOR UPDATE;
  IF r.request_hash<>p_request_hash
     OR r.bootstrap_id<>p_bootstrap_id
     OR r.bootstrap_generation<>p_generation
     OR r.actor_role<>p_actor_role
     OR r.actor_principal_id<>p_actor_principal_id
     OR r.result_type<>p_result_type THEN
    RAISE EXCEPTION 'bootstrap request identity conflict' USING ERRCODE='40001';
  END IF;
  IF r.state<>'COMPLETED' THEN
    RAISE EXCEPTION 'bootstrap request already in progress' USING ERRCODE='40001';
  END IF;
  RETURN QUERY SELECT true,r.result_id;
END
$$;

CREATE OR REPLACE FUNCTION app_private.complete_bootstrap_request_r2(
  p_operation text,
  p_request_id text,
  p_result_id text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  UPDATE app.bootstrap_request_ledger_r2
     SET state='COMPLETED',result_id=p_result_id,completed_at=clock_timestamp()
   WHERE operation=p_operation AND request_id=p_request_id
     AND state='CLAIMED';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'bootstrap request completion missing' USING ERRCODE='40001';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION app_private.append_bootstrap_event_r2(
  p_action text,
  p_bootstrap_id boolean,
  p_generation bigint,
  p_actor_role text,
  p_actor_principal_id text,
  p_root_session_id text,
  p_root_grant_id text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_id text:=gen_random_uuid()::text;
  v_sequence bigint;
BEGIN
  SELECT coalesce(max(e.event_sequence),0)+1 INTO v_sequence
    FROM app.bootstrap_event_r2 e
   WHERE e.bootstrap_id=p_bootstrap_id
     AND e.bootstrap_generation=p_generation;
  INSERT INTO app.bootstrap_event_r2(
    id,bootstrap_id,bootstrap_generation,event_sequence,action,
    actor_role,actor_principal_id,root_session_id,root_grant_id,
    occurred_at,content_digest
  ) VALUES(
    v_id,p_bootstrap_id,p_generation,v_sequence,p_action,
    p_actor_role,p_actor_principal_id,p_root_session_id,p_root_grant_id,
    clock_timestamp(),repeat('0',64)
  );
  RETURN v_id;
END
$$;

CREATE OR REPLACE FUNCTION app_private.bootstrap_root_grant_digest_r2(
  p_bootstrap_id boolean,
  p_generation bigint,
  p_grant_id text,
  p_session_id text,
  p_principal_id text,
  p_role_name text,
  p_grant_version bigint
) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path=pg_catalog,app_private
RETURN app_private.sha256_hex(
  convert_to(
    jsonb_build_object(
      'schema','AIEA-ROOT-GRANT-V2',
      'bootstrapId',p_bootstrap_id::text,
      'generation',p_generation::text,
      'grantId',p_grant_id,
      'sessionId',p_session_id,
      'principalId',p_principal_id,
      'roleName',p_role_name,
      'grantVersion',p_grant_version::text
    )::text,
    'UTF8'
  )
);

CREATE OR REPLACE FUNCTION app_private.bootstrap_generation_digest_r2(
  p_bootstrap_id boolean,
  p_generation bigint,
  p_root_principal_id text,
  p_root_role_name text,
  p_root_token_digest text
) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path=pg_catalog,app_private
RETURN app_private.sha256_hex(
  convert_to(
    jsonb_build_object(
      'schema','AIEA-BOOTSTRAP-GENERATION-V2',
      'bootstrapId',p_bootstrap_id::text,
      'generation',p_generation::text,
      'rootPrincipalId',p_root_principal_id,
      'rootRoleName',p_root_role_name,
      'rootTokenDigest',p_root_token_digest
    )::text,
    'UTF8'
  )
);

CREATE OR REPLACE FUNCTION app.bootstrap_prepare_r3(
  p_root_principal_id text,
  p_root_role_name text,
  p_initiator_principal_id text,
  p_initiator_role_name text,
  p_approver_principal_id text,
  p_approver_role_name text,
  p_root_token_digest text,
  p_initiator_token_digest text,
  p_approver_token_digest text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  st app.bootstrap_state_r3%ROWTYPE;
  lc app.bootstrap_lifecycle_r2%ROWTYPE;
BEGIN
  IF session_user<>'elevator_session_bootstrap_seed' THEN
    RAISE EXCEPTION 'bootstrap seed role required' USING ERRCODE='42501';
  END IF;
  IF p_root_token_digest !~ '^[0-9a-f]{64}$'
     OR p_initiator_token_digest !~ '^[0-9a-f]{64}$'
     OR p_approver_token_digest !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'bootstrap token digest invalid' USING ERRCODE='22023';
  END IF;
  IF p_root_principal_id IN (p_initiator_principal_id,p_approver_principal_id)
     OR p_initiator_principal_id=p_approver_principal_id THEN
    RAISE EXCEPTION 'bootstrap Principals must be distinct' USING ERRCODE='42501';
  END IF;
  SELECT * INTO st FROM app.bootstrap_state_r3 WHERE singleton FOR UPDATE;
  IF FOUND THEN
    SELECT * INTO STRICT lc FROM app.bootstrap_lifecycle_r2
     WHERE bootstrap_id=true FOR UPDATE;
    IF st.root_principal_id=p_root_principal_id
       AND st.root_role_name=p_root_role_name
       AND st.root_token_digest=p_root_token_digest
       AND EXISTS (
         SELECT 1 FROM app.bootstrap_operator_r3 o
          WHERE o.role_name=p_initiator_role_name
            AND o.operator_kind='INITIATOR'
            AND o.principal_id=p_initiator_principal_id
            AND o.token_digest=p_initiator_token_digest
       )
       AND EXISTS (
         SELECT 1 FROM app.bootstrap_operator_r3 o
          WHERE o.role_name=p_approver_role_name
            AND o.operator_kind='APPROVER'
            AND o.principal_id=p_approver_principal_id
            AND o.token_digest=p_approver_token_digest
       ) THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'bootstrap already prepared with different identity'
      USING ERRCODE='23505';
  END IF;
  INSERT INTO app.trusted_principal(id,state,created_at)
  VALUES
    (p_root_principal_id,'ACTIVE',clock_timestamp()),
    (p_initiator_principal_id,'ACTIVE',clock_timestamp()),
    (p_approver_principal_id,'ACTIVE',clock_timestamp())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO app.principal_epoch(principal_id,current_epoch,updated_at)
  VALUES
    (p_root_principal_id,1,clock_timestamp()),
    (p_initiator_principal_id,1,clock_timestamp()),
    (p_approver_principal_id,1,clock_timestamp())
  ON CONFLICT (principal_id) DO NOTHING;
  INSERT INTO app.bootstrap_operator_r3(
    role_name,operator_kind,principal_id,token_digest,enabled,provisioned_at
  ) VALUES
    (p_initiator_role_name,'INITIATOR',p_initiator_principal_id,
     p_initiator_token_digest,true,clock_timestamp()),
    (p_approver_role_name,'APPROVER',p_approver_principal_id,
     p_approver_token_digest,true,clock_timestamp()),
    (p_root_role_name,'ROOT',p_root_principal_id,
     p_root_token_digest,true,clock_timestamp());
  INSERT INTO app.bootstrap_state_r3(
    singleton,state,root_principal_id,root_role_name,root_token_digest,
    prepared_at,bootstrap_generation,root_operator_kind
  ) VALUES(
    true,'PREPARED',p_root_principal_id,p_root_role_name,p_root_token_digest,
    clock_timestamp(),1,'ROOT'
  );
  INSERT INTO app.bootstrap_generation_r2(
    bootstrap_id,bootstrap_generation,root_principal_id,root_role_name,
    root_operator_kind,root_token_digest,activation_state,created_at,
    generation_digest
  ) VALUES(
    true,1,p_root_principal_id,p_root_role_name,'ROOT',p_root_token_digest,
    'ACTIVE',clock_timestamp(),
    app_private.bootstrap_generation_digest_r2(
      true,1,p_root_principal_id,p_root_role_name,p_root_token_digest
    )
  );
  INSERT INTO app.bootstrap_lifecycle_r2(
    bootstrap_id,bootstrap_generation,state,state_revision,
    root_principal_id,root_role_name,root_operator_kind,updated_at
  ) VALUES(
    true,1,'SEED_READY',1,p_root_principal_id,p_root_role_name,'ROOT',
    clock_timestamp()
  );
  PERFORM app_private.append_bootstrap_event_r2(
    'SEED_READY',true,1,session_user,p_root_principal_id,NULL,NULL
  );
END
$$;

CREATE OR REPLACE FUNCTION app.bootstrap_record_approval_r3(
  p_bootstrap_id boolean,
  p_operator_kind text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  op app.bootstrap_operator_r3%ROWTYPE;
  lc app.bootstrap_lifecycle_r2%ROWTYPE;
  v_backend_start timestamptz;
  v_request_id text;
  v_hash text;
  v_replay boolean;
  v_result text;
  v_approval_count integer;
BEGIN
  IF p_operator_kind NOT IN ('INITIATOR','APPROVER') THEN
    RAISE EXCEPTION 'bootstrap approval kind invalid' USING ERRCODE='22023';
  END IF;
  PERFORM app_private.validate_session_role_r3(
    session_user,
    CASE p_operator_kind WHEN 'INITIATOR' THEN 'BOOTSTRAP_INITIATOR'
      ELSE 'BOOTSTRAP_APPROVER' END,
    CASE p_operator_kind WHEN 'INITIATOR' THEN 'elevator_bootstrap_initiator'
      ELSE 'elevator_bootstrap_approver' END
  );
  SELECT * INTO STRICT lc
    FROM app.bootstrap_lifecycle_r2
   WHERE bootstrap_id=p_bootstrap_id
   FOR UPDATE;
  IF lc.state NOT IN ('SEED_READY','APPROVAL_PENDING') THEN
    RAISE EXCEPTION 'bootstrap approval state invalid' USING ERRCODE='40001';
  END IF;
  SELECT * INTO STRICT op FROM app.bootstrap_operator_r3
   WHERE role_name=session_user
     AND operator_kind=p_operator_kind
     AND principal_id<>lc.root_principal_id
     AND enabled
   FOR SHARE;
  SELECT a.backend_start INTO v_backend_start
    FROM pg_catalog.pg_stat_activity a
   WHERE a.pid=pg_catalog.pg_backend_pid() AND a.usename=session_user;
  IF v_backend_start IS NULL THEN
    RAISE EXCEPTION 'bootstrap backend identity unavailable' USING ERRCODE='42501';
  END IF;
  v_request_id := format('bootstrap-approval:%s:%s',
    lc.bootstrap_generation,p_operator_kind);
  v_hash := app_private.sha256_hex(convert_to(
    concat_ws(':',p_bootstrap_id::text,lc.bootstrap_generation::text,
      p_operator_kind,session_user,op.principal_id),
    'UTF8'
  ));
  SELECT * INTO v_replay,v_result
    FROM app_private.claim_bootstrap_request_r2(
      'BOOTSTRAP_APPROVAL',v_request_id,v_hash,p_bootstrap_id,
      lc.bootstrap_generation,session_user,op.principal_id,'BOOTSTRAP_APPROVAL'
    );
  IF v_replay THEN
    RETURN;
  END IF;
  INSERT INTO app.bootstrap_approval_r2(
    bootstrap_id,bootstrap_generation,operator_kind,role_name,principal_id,
    root_principal_id,
    backend_pid,backend_started_at,approved_at,request_id,request_hash
  ) VALUES(
    p_bootstrap_id,lc.bootstrap_generation,p_operator_kind,session_user,
    op.principal_id,lc.root_principal_id,pg_catalog.pg_backend_pid(),v_backend_start,
    clock_timestamp(),v_request_id,v_hash
  );
  SELECT count(*) INTO v_approval_count
    FROM app.bootstrap_approval_r2 a
   WHERE a.bootstrap_id=p_bootstrap_id
     AND a.bootstrap_generation=lc.bootstrap_generation;
  UPDATE app.bootstrap_lifecycle_r2
     SET state=CASE WHEN v_approval_count=2
                    THEN 'ROOT_ISSUANCE_PENDING' ELSE 'APPROVAL_PENDING' END,
         state_revision=state_revision+1,
         updated_at=clock_timestamp()
   WHERE bootstrap_id=p_bootstrap_id
     AND bootstrap_generation=lc.bootstrap_generation;
  PERFORM app_private.append_bootstrap_event_r2(
    'APPROVE_'||p_operator_kind,p_bootstrap_id,lc.bootstrap_generation,
    session_user,op.principal_id,NULL,NULL
  );
  PERFORM app_private.complete_bootstrap_request_r2(
    'BOOTSTRAP_APPROVAL',v_request_id,p_operator_kind
  );
END
$$;

CREATE OR REPLACE FUNCTION app.bootstrap_complete_root_r3(
  p_bootstrap_id boolean,
  p_root_token text,
  p_request_id text,
  p_request_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  st app.bootstrap_state_r3%ROWTYPE;
  lc app.bootstrap_lifecycle_r2%ROWTYPE;
  rootop app.bootstrap_operator_r3%ROWTYPE;
  v_backend_start timestamptz;
  v_session_id text:='bootstrap:'||gen_random_uuid()::text;
  v_grant_id text:='bootstrap-grant:'||gen_random_uuid()::text;
  v_epoch bigint;
  v_hash text;
  v_replay boolean;
  v_result text;
  v_mapping_digest text;
BEGIN
  PERFORM app_private.validate_session_role_r3(
    session_user,'ROOT_ISSUER','elevator_root_issuer'
  );
  SELECT * INTO STRICT st FROM app.bootstrap_state_r3
   WHERE singleton=p_bootstrap_id FOR UPDATE;
  SELECT * INTO STRICT lc FROM app.bootstrap_lifecycle_r2
   WHERE bootstrap_id=p_bootstrap_id
     AND bootstrap_generation=st.bootstrap_generation
   FOR UPDATE;
  SELECT * INTO STRICT rootop FROM app.bootstrap_operator_r3
   WHERE role_name=session_user
     AND operator_kind='ROOT'
     AND principal_id=st.root_principal_id
     AND role_name=st.root_role_name
     AND enabled
   FOR SHARE;
  IF NOT app_private.session_token_digest(p_root_token)=st.root_token_digest THEN
    RAISE EXCEPTION 'root bootstrap token invalid' USING ERRCODE='42501';
  END IF;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','BOOTSTRAP_COMPLETE_ROOT','bootstrapId',p_bootstrap_id,
    'generation',st.bootstrap_generation,'rootPrincipalId',st.root_principal_id,
    'rootRoleName',st.root_role_name,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result
    FROM app_private.claim_bootstrap_request_r2(
      'BOOTSTRAP_COMPLETE_ROOT',p_request_id,v_hash,p_bootstrap_id,
      st.bootstrap_generation,session_user,rootop.principal_id,
      'BOOTSTRAP_ROOT_GRANT'
    );
  IF v_replay THEN
    PERFORM 1
      FROM app.bootstrap_root_grant_r2 g
     WHERE g.root_grant_id=v_result
       AND g.bootstrap_id=p_bootstrap_id
       AND g.bootstrap_generation=st.bootstrap_generation
       AND g.root_principal_id=rootop.principal_id
       AND g.issuer_principal_id=rootop.principal_id
       AND g.root_role_name=session_user;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'bootstrap replay identity mismatch' USING ERRCODE='42501';
    END IF;
    RETURN;
  END IF;
  IF lc.state<>'ROOT_ISSUANCE_PENDING' THEN
    RAISE EXCEPTION 'bootstrap root issuance state invalid' USING ERRCODE='40001';
  END IF;
  IF lc.root_principal_id<>st.root_principal_id
     OR lc.root_role_name<>st.root_role_name THEN
    RAISE EXCEPTION 'bootstrap state/lifecycle Principal mismatch'
      USING ERRCODE='42501';
  END IF;
  IF (SELECT count(*) FROM app.bootstrap_approval_r2 a
       WHERE a.bootstrap_id=p_bootstrap_id
         AND a.bootstrap_generation=st.bootstrap_generation)<>2
     OR (SELECT count(DISTINCT a.principal_id)
           FROM app.bootstrap_approval_r2 a
          WHERE a.bootstrap_id=p_bootstrap_id
            AND a.bootstrap_generation=st.bootstrap_generation)<>2
     OR EXISTS (
       SELECT 1 FROM app.bootstrap_approval_r2 a
        WHERE a.bootstrap_id=p_bootstrap_id
          AND a.bootstrap_generation=st.bootstrap_generation
          AND a.principal_id=st.root_principal_id
     ) THEN
    RAISE EXCEPTION 'bootstrap requires two distinct non-root approvals'
      USING ERRCODE='42501';
  END IF;
  SELECT a.backend_start INTO v_backend_start
    FROM pg_catalog.pg_stat_activity a
   WHERE a.pid=pg_catalog.pg_backend_pid() AND a.usename=session_user;
  IF v_backend_start IS NULL THEN
    RAISE EXCEPTION 'root bootstrap backend identity unavailable' USING ERRCODE='42501';
  END IF;
  SELECT current_epoch INTO v_epoch
    FROM app.principal_epoch
   WHERE principal_id=st.root_principal_id FOR UPDATE;
  IF v_epoch IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'bootstrap root epoch invalid' USING ERRCODE='40001';
  END IF;
  INSERT INTO app.session_role_registry(
    role_name,role_kind,capability_role,activation_token_digest,state,
    session_id,provisioned_at,assigned_at
  ) VALUES(
    session_user,'ROOT_ISSUER','elevator_root_issuer',st.root_token_digest,
    'ASSIGNED',v_session_id,clock_timestamp(),clock_timestamp()
  )
  ON CONFLICT (role_name) DO UPDATE
    SET state='ASSIGNED',session_id=EXCLUDED.session_id,
        assigned_at=EXCLUDED.assigned_at
    WHERE app.session_role_registry.state='AVAILABLE';
  UPDATE app.session_role_registry
     SET state='ACTIVE'
   WHERE role_name=session_user AND session_id=v_session_id;
  INSERT INTO app.trusted_session(
    session_id,principal_id,login_epoch,db_auth_role,audience,issuer,
    assertion_id,assertion_digest,issued_at,not_before,expires_at,
    state,binding_state,backend_pid,backend_started_at,activated_at,
    last_verified_at,binding_digest,created_at,termination_class
  ) VALUES(
    v_session_id,st.root_principal_id,v_epoch,session_user,'bootstrap',
    'database-bootstrap',p_request_id,st.root_token_digest,
    clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '15 minutes',
    'ACTIVE','ACTIVE',pg_catalog.pg_backend_pid(),v_backend_start,
    clock_timestamp(),clock_timestamp(),
    app_private.sha256_hex(convert_to(
      v_session_id||':'||pg_catalog.pg_backend_pid()::text,'UTF8'
    )),
    clock_timestamp(),'NONE'
  );
  INSERT INTO app.bootstrap_root_session_r2(
    bootstrap_id,bootstrap_generation,session_id,root_principal_id,
    root_role_name,state,issued_at
  ) VALUES(
    p_bootstrap_id,st.bootstrap_generation,v_session_id,
    st.root_principal_id,session_user,'ACTIVE',clock_timestamp()
  );
  INSERT INTO app.authority_grant(
    id,principal_id,session_id,subject_principal_id,object_scope,
    authority_code,project_id,policy_id,policy_revision_id,
    valid_from,valid_until,created_at
  ) VALUES(
    v_grant_id,st.root_principal_id,v_session_id,NULL,'GLOBAL',
    'AUTHORITY_ISSUE',NULL,NULL,NULL,clock_timestamp(),
    clock_timestamp()+interval '15 minutes',clock_timestamp()
  );
  v_mapping_digest := app_private.bootstrap_root_grant_digest_r2(
    p_bootstrap_id,st.bootstrap_generation,v_grant_id,v_session_id,
    st.root_principal_id,session_user,st.bootstrap_generation
  );
  INSERT INTO app.bootstrap_root_grant_r2(
    bootstrap_id,bootstrap_generation,root_grant_id,root_session_id,
    root_principal_id,root_role_name,issuer_principal_id,grant_version,
    mapping_digest,created_at
  ) VALUES(
    p_bootstrap_id,st.bootstrap_generation,v_grant_id,v_session_id,
    st.root_principal_id,session_user,st.root_principal_id,
    st.bootstrap_generation,
    v_mapping_digest,clock_timestamp()
  );
  UPDATE app.bootstrap_lifecycle_r2
     SET state=CASE WHEN st.bootstrap_generation=1
                    THEN 'BOOTSTRAP_COMPLETED' ELSE 'ROOT_ROTATED' END,
         state_revision=state_revision+1,
         root_session_id=v_session_id,
         root_grant_id=v_grant_id,
         updated_at=clock_timestamp()
   WHERE bootstrap_id=p_bootstrap_id
     AND bootstrap_generation=st.bootstrap_generation;
  UPDATE app.bootstrap_state_r3
     SET state='COMPLETE',completed_at=clock_timestamp(),
         root_grant_id=v_grant_id,root_session_id=v_session_id,
         root_grant_issuer_principal_id=st.root_principal_id
   WHERE singleton=p_bootstrap_id;
  PERFORM app_private.append_bootstrap_event_r2(
    'ROOT_SESSION_ACTIVE',p_bootstrap_id,st.bootstrap_generation,
    session_user,st.root_principal_id,v_session_id,v_grant_id
  );
  PERFORM app_private.append_bootstrap_event_r2(
    CASE WHEN st.bootstrap_generation=1 THEN 'BOOTSTRAP_COMPLETED'
         ELSE 'ROOT_ROTATED' END,
    p_bootstrap_id,st.bootstrap_generation,
    session_user,st.root_principal_id,v_session_id,v_grant_id
  );
  PERFORM app_private.complete_bootstrap_request_r2(
    'BOOTSTRAP_COMPLETE_ROOT',p_request_id,v_grant_id
  );
  PERFORM pg_catalog.set_config('aiea.session_binding',v_session_id,false);
END
$$;

CREATE OR REPLACE FUNCTION app_private.bootstrap_recovery_digest_r2(
  p_row jsonb
) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path=pg_catalog,app_private
RETURN app_private.sha256_hex(
  convert_to(
    jsonb_build_object(
      'schema','AIEA-BOOTSTRAP-RECOVERY-V2',
      'id',p_row->>'id',
      'bootstrapId',p_row->>'bootstrap_id',
      'fromGeneration',p_row->>'from_generation',
      'kind',p_row->>'kind',
      'reasonClass',p_row->>'reason_class',
      'currentRootPrincipalId',p_row->>'current_root_principal_id',
      'targetRootPrincipalId',p_row->>'target_root_principal_id',
      'targetRootRoleName',p_row->>'target_root_role_name',
      'targetTokenDigest',p_row->>'target_token_digest',
      'requestedByRole',p_row->>'requested_by_role',
      'requestedByPrincipalId',p_row->>'requested_by_principal_id'
    )::text,
    'UTF8'
  )
);

CREATE OR REPLACE FUNCTION app.bootstrap_begin_root_change_r2(
  p_recovery_id text,
  p_bootstrap_id boolean,
  p_kind text,
  p_reason_class text,
  p_target_root_principal_id text,
  p_target_root_role_name text,
  p_target_token_digest text,
  p_request_id text,
  p_request_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  lc app.bootstrap_lifecycle_r2%ROWTYPE;
  op app.bootstrap_operator_r3%ROWTYPE;
  v_backend_start timestamptz;
  v_hash text;
  v_replay boolean;
  v_result text;
  v_digest text;
BEGIN
  IF p_kind NOT IN ('RECOVERY','ROTATION') THEN
    RAISE EXCEPTION 'root change kind invalid' USING ERRCODE='22023';
  END IF;
  PERFORM app_private.validate_session_role_r3(
    session_user,'BOOTSTRAP_INITIATOR','elevator_bootstrap_initiator'
  );
  SELECT * INTO STRICT lc FROM app.bootstrap_lifecycle_r2
   WHERE bootstrap_id=p_bootstrap_id FOR UPDATE;
  IF p_kind='ROTATION' THEN
    IF lc.state NOT IN ('BOOTSTRAP_COMPLETED','ROOT_ROTATED') THEN
      RAISE EXCEPTION 'valid root required for rotation' USING ERRCODE='42501';
    END IF;
    PERFORM 1
      FROM app.bootstrap_root_session_r2 s
      JOIN app.trusted_session ts ON ts.session_id=s.session_id
      JOIN app.bootstrap_root_grant_r2 g ON g.root_grant_id=lc.root_grant_id
      JOIN app.authority_grant ag ON ag.id=g.root_grant_id
     WHERE s.bootstrap_id=p_bootstrap_id
       AND s.bootstrap_generation=lc.bootstrap_generation
       AND s.state='ACTIVE'
       AND ts.state='ACTIVE'
       AND ag.revoked_at IS NULL
       AND (ag.valid_until IS NULL OR clock_timestamp()<ag.valid_until);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'root rotation requires active root authority'
        USING ERRCODE='42501';
    END IF;
  ELSIF lc.state NOT IN ('BOOTSTRAP_COMPLETED','ROOT_ROTATED','LOCKED') THEN
    RAISE EXCEPTION 'root recovery state invalid' USING ERRCODE='40001';
  END IF;
  IF p_target_root_principal_id=lc.root_principal_id
     OR p_target_root_role_name=lc.root_role_name THEN
    RAISE EXCEPTION 'root change requires a new Principal and role'
      USING ERRCODE='42501';
  END IF;
  SELECT * INTO STRICT op FROM app.bootstrap_operator_r3
   WHERE role_name=session_user
     AND operator_kind='INITIATOR'
     AND principal_id<>lc.root_principal_id
     AND principal_id<>p_target_root_principal_id
     AND enabled
   FOR SHARE;
  SELECT a.backend_start INTO v_backend_start
    FROM pg_catalog.pg_stat_activity a
   WHERE a.pid=pg_catalog.pg_backend_pid() AND a.usename=session_user;
  IF v_backend_start IS NULL THEN
    RAISE EXCEPTION 'root change backend identity unavailable' USING ERRCODE='42501';
  END IF;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','BOOTSTRAP_BEGIN_ROOT_CHANGE','recoveryId',p_recovery_id,
    'bootstrapId',p_bootstrap_id,'generation',lc.bootstrap_generation,
    'kind',p_kind,'reasonClass',p_reason_class,
    'targetRootPrincipalId',p_target_root_principal_id,
    'targetRootRoleName',p_target_root_role_name,
    'targetTokenDigest',p_target_token_digest,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result
    FROM app_private.claim_bootstrap_request_r2(
      'BOOTSTRAP_BEGIN_ROOT_CHANGE',p_request_id,v_hash,p_bootstrap_id,
      lc.bootstrap_generation,session_user,op.principal_id,'BOOTSTRAP_RECOVERY'
    );
  IF v_replay THEN
    RETURN;
  END IF;
  v_digest := app_private.bootstrap_recovery_digest_r2(jsonb_build_object(
    'id',p_recovery_id,'bootstrap_id',p_bootstrap_id,
    'from_generation',lc.bootstrap_generation,'kind',p_kind,
    'reason_class',p_reason_class,
    'current_root_principal_id',lc.root_principal_id,
    'target_root_principal_id',p_target_root_principal_id,
    'target_root_role_name',p_target_root_role_name,
    'target_token_digest',p_target_token_digest,
    'requested_by_role',session_user,
    'requested_by_principal_id',op.principal_id
  ));
  INSERT INTO app.bootstrap_recovery_r2(
    id,bootstrap_id,from_generation,kind,reason_class,state,
    current_root_principal_id,target_root_principal_id,target_root_role_name,
    target_token_digest,requested_by_role,requested_by_principal_id,
    requested_at,request_id,request_hash,content_digest
  ) VALUES(
    p_recovery_id,p_bootstrap_id,lc.bootstrap_generation,p_kind,
    p_reason_class,'PENDING',lc.root_principal_id,p_target_root_principal_id,
    p_target_root_role_name,p_target_token_digest,session_user,op.principal_id,
    clock_timestamp(),p_request_id,v_hash,v_digest
  );
  INSERT INTO app.bootstrap_recovery_approval_r2(
    recovery_id,operator_kind,role_name,principal_id,backend_pid,
    backend_started_at,approved_at,request_id,request_hash
  ) VALUES(
    p_recovery_id,'INITIATOR',session_user,op.principal_id,
    pg_catalog.pg_backend_pid(),v_backend_start,clock_timestamp(),
    p_request_id,v_hash
  );
  UPDATE app.bootstrap_lifecycle_r2
     SET state=CASE p_kind WHEN 'ROTATION' THEN 'ROOT_ROTATION_PENDING'
                           ELSE 'RECOVERY_PENDING' END,
         recovery_request_id=p_recovery_id,
         state_revision=state_revision+1,
         updated_at=clock_timestamp()
   WHERE bootstrap_id=p_bootstrap_id
     AND bootstrap_generation=lc.bootstrap_generation;
  PERFORM app_private.append_bootstrap_event_r2(
    CASE p_kind WHEN 'ROTATION' THEN 'ROTATION_REQUESTED'
                ELSE 'RECOVERY_REQUESTED' END,
    p_bootstrap_id,lc.bootstrap_generation,session_user,op.principal_id,
    NULL,NULL
  );
  PERFORM app_private.complete_bootstrap_request_r2(
    'BOOTSTRAP_BEGIN_ROOT_CHANGE',p_request_id,p_recovery_id
  );
END
$$;

CREATE OR REPLACE FUNCTION app.bootstrap_approve_root_change_r2(
  p_recovery_id text,
  p_request_id text,
  p_request_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  rr app.bootstrap_recovery_r2%ROWTYPE;
  lc app.bootstrap_lifecycle_r2%ROWTYPE;
  op app.bootstrap_operator_r3%ROWTYPE;
  v_backend_start timestamptz;
  v_hash text;
  v_replay boolean;
  v_result text;
  v_count integer;
BEGIN
  PERFORM app_private.validate_session_role_r3(
    session_user,'BOOTSTRAP_APPROVER','elevator_bootstrap_approver'
  );
  SELECT * INTO STRICT rr FROM app.bootstrap_recovery_r2
   WHERE id=p_recovery_id FOR UPDATE;
  SELECT * INTO STRICT lc FROM app.bootstrap_lifecycle_r2
   WHERE bootstrap_id=rr.bootstrap_id
     AND bootstrap_generation=rr.from_generation
   FOR UPDATE;
  IF rr.state<>'PENDING' THEN
    RAISE EXCEPTION 'root change is not approval-pending' USING ERRCODE='40001';
  END IF;
  SELECT * INTO STRICT op FROM app.bootstrap_operator_r3
   WHERE role_name=session_user
     AND operator_kind='APPROVER'
     AND principal_id<>rr.current_root_principal_id
     AND principal_id<>rr.requested_by_principal_id
     AND principal_id<>rr.target_root_principal_id
     AND enabled
   FOR SHARE;
  SELECT a.backend_start INTO v_backend_start
    FROM pg_catalog.pg_stat_activity a
   WHERE a.pid=pg_catalog.pg_backend_pid() AND a.usename=session_user;
  IF v_backend_start IS NULL THEN
    RAISE EXCEPTION 'root change backend identity unavailable' USING ERRCODE='42501';
  END IF;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','BOOTSTRAP_APPROVE_ROOT_CHANGE','recoveryId',p_recovery_id,
    'generation',rr.from_generation,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result
    FROM app_private.claim_bootstrap_request_r2(
      'BOOTSTRAP_APPROVE_ROOT_CHANGE',p_request_id,v_hash,rr.bootstrap_id,
      rr.from_generation,session_user,op.principal_id,'BOOTSTRAP_RECOVERY'
    );
  IF v_replay THEN
    RETURN;
  END IF;
  INSERT INTO app.bootstrap_recovery_approval_r2(
    recovery_id,operator_kind,role_name,principal_id,backend_pid,
    backend_started_at,approved_at,request_id,request_hash
  ) VALUES(
    p_recovery_id,'APPROVER',session_user,op.principal_id,
    pg_catalog.pg_backend_pid(),v_backend_start,clock_timestamp(),
    p_request_id,v_hash
  );
  SELECT count(*) INTO v_count
    FROM app.bootstrap_recovery_approval_r2 a
   WHERE a.recovery_id=p_recovery_id;
  IF v_count=2 THEN
    UPDATE app.bootstrap_recovery_r2
       SET state='APPROVED',approved_at=clock_timestamp()
     WHERE id=p_recovery_id;
    UPDATE app.bootstrap_lifecycle_r2
       SET state=CASE rr.kind
                    WHEN 'ROTATION' THEN 'ROOT_ROTATION_PENDING'
                    ELSE 'RECOVERY_APPROVED' END,
           state_revision=state_revision+1,
           updated_at=clock_timestamp()
     WHERE bootstrap_id=rr.bootstrap_id
       AND bootstrap_generation=rr.from_generation;
  END IF;
  PERFORM app_private.append_bootstrap_event_r2(
    CASE rr.kind WHEN 'ROTATION' THEN 'ROTATION_APPROVED'
                 ELSE 'RECOVERY_APPROVED' END,
    rr.bootstrap_id,rr.from_generation,session_user,op.principal_id,NULL,NULL
  );
  PERFORM app_private.complete_bootstrap_request_r2(
    'BOOTSTRAP_APPROVE_ROOT_CHANGE',p_request_id,p_recovery_id
  );
END
$$;

CREATE OR REPLACE FUNCTION app.bootstrap_execute_root_change_r2(
  p_recovery_id text,
  p_request_id text,
  p_request_key text
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  rr app.bootstrap_recovery_r2%ROWTYPE;
  lc app.bootstrap_lifecycle_r2%ROWTYPE;
  st app.bootstrap_state_r3%ROWTYPE;
  v_hash text;
  v_replay boolean;
  v_result text;
  v_new_generation bigint;
  v_initiator app.bootstrap_recovery_approval_r2%ROWTYPE;
  v_approver app.bootstrap_recovery_approval_r2%ROWTYPE;
BEGIN
  IF session_user<>'elevator_session_bootstrap_seed' THEN
    RAISE EXCEPTION 'bootstrap seed role required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO STRICT rr FROM app.bootstrap_recovery_r2
   WHERE id=p_recovery_id FOR UPDATE;
  SELECT * INTO STRICT lc FROM app.bootstrap_lifecycle_r2
   WHERE bootstrap_id=rr.bootstrap_id
     AND bootstrap_generation=rr.from_generation
   FOR UPDATE;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','BOOTSTRAP_EXECUTE_ROOT_CHANGE','recoveryId',p_recovery_id,
    'generation',rr.from_generation,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result
    FROM app_private.claim_bootstrap_request_r2(
      'BOOTSTRAP_EXECUTE_ROOT_CHANGE',p_request_id,v_hash,rr.bootstrap_id,
      rr.from_generation,session_user,rr.requested_by_principal_id,
      'BOOTSTRAP_GENERATION'
    );
  IF v_replay THEN
    RETURN v_result::bigint;
  END IF;
  IF rr.state<>'APPROVED' THEN
    RAISE EXCEPTION 'root change lacks two approvals' USING ERRCODE='42501';
  END IF;
  SELECT * INTO STRICT v_initiator FROM app.bootstrap_recovery_approval_r2
   WHERE recovery_id=p_recovery_id AND operator_kind='INITIATOR';
  SELECT * INTO STRICT v_approver FROM app.bootstrap_recovery_approval_r2
   WHERE recovery_id=p_recovery_id AND operator_kind='APPROVER';
  IF v_initiator.principal_id=v_approver.principal_id
     OR v_initiator.principal_id=rr.current_root_principal_id
     OR v_approver.principal_id=rr.current_root_principal_id THEN
    RAISE EXCEPTION 'root change approvals are not distinct' USING ERRCODE='42501';
  END IF;
  UPDATE app.bootstrap_operator_r3
     SET enabled=false
   WHERE operator_kind='ROOT' AND principal_id=rr.current_root_principal_id;
  INSERT INTO app.bootstrap_operator_r3(
    role_name,operator_kind,principal_id,token_digest,enabled,provisioned_at
  ) VALUES(
    rr.target_root_role_name,'ROOT',rr.target_root_principal_id,
    rr.target_token_digest,true,clock_timestamp()
  );
  INSERT INTO app.trusted_principal(id,state,created_at)
  VALUES(rr.target_root_principal_id,'ACTIVE',clock_timestamp())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO app.principal_epoch(principal_id,current_epoch,updated_at)
  VALUES(rr.target_root_principal_id,1,clock_timestamp())
  ON CONFLICT (principal_id) DO NOTHING;
  UPDATE app.bootstrap_generation_r2
     SET activation_state='SUPERSEDED',superseded_at=clock_timestamp()
   WHERE bootstrap_id=rr.bootstrap_id
     AND bootstrap_generation=rr.from_generation
     AND activation_state='ACTIVE';
  INSERT INTO app.bootstrap_generation_r2(
    bootstrap_id,bootstrap_generation,root_principal_id,root_role_name,
    root_operator_kind,root_token_digest,activation_state,created_at,
    generation_digest
  ) VALUES(
    rr.bootstrap_id,rr.from_generation+1,rr.target_root_principal_id,
    rr.target_root_role_name,'ROOT',rr.target_token_digest,'ACTIVE',
    clock_timestamp(),
    app_private.bootstrap_generation_digest_r2(
      rr.bootstrap_id,rr.from_generation+1,rr.target_root_principal_id,
      rr.target_root_role_name,rr.target_token_digest
    )
  );
  INSERT INTO app.bootstrap_approval_r2(
    bootstrap_id,bootstrap_generation,operator_kind,role_name,principal_id,
    root_principal_id,
    backend_pid,backend_started_at,approved_at,request_id,request_hash
  ) SELECT
    rr.bootstrap_id,rr.from_generation+1,a.operator_kind,a.role_name,
    a.principal_id,rr.target_root_principal_id,a.backend_pid,
    a.backend_started_at,a.approved_at,
    a.request_id,a.request_hash
  FROM app.bootstrap_recovery_approval_r2 a
  WHERE a.recovery_id=p_recovery_id;
  UPDATE app.authority_grant
     SET revoked_at=clock_timestamp(),
         revocation_reason='ROOT_CHANGE:'||rr.reason_class
   WHERE id=lc.root_grant_id AND revoked_at IS NULL;
  UPDATE app.bootstrap_root_session_r2
     SET state='REVOKED',revoked_at=clock_timestamp()
   WHERE bootstrap_id=rr.bootstrap_id
     AND bootstrap_generation=rr.from_generation
     AND state='ACTIVE';
  UPDATE app.trusted_session
     SET state='REVOKED',binding_state='REVOKED',revoked_at=clock_timestamp(),
         revocation_reason='ROOT_CHANGE:'||rr.reason_class,
         termination_class=CASE rr.reason_class
           WHEN 'CREDENTIAL_COMPROMISE' THEN 'SECURITY_REVOKE'
           ELSE 'ADMIN_REVOKE' END
   WHERE session_id=lc.root_session_id AND state='ACTIVE';
  v_new_generation := rr.from_generation+1;
  PERFORM app_private.append_bootstrap_event_r2(
    CASE rr.kind WHEN 'ROTATION' THEN 'ROTATION_EXECUTED'
                 ELSE 'RECOVERY_EXECUTED' END,
    rr.bootstrap_id,rr.from_generation,session_user,
    v_initiator.principal_id,NULL,NULL
  );
  SELECT * INTO STRICT st FROM app.bootstrap_state_r3
   WHERE singleton=rr.bootstrap_id FOR UPDATE;
  UPDATE app.bootstrap_state_r3
     SET state='PREPARED',bootstrap_generation=v_new_generation,
         root_principal_id=rr.target_root_principal_id,
         root_role_name=rr.target_root_role_name,
         root_token_digest=rr.target_token_digest,
         prepared_at=clock_timestamp(),completed_at=NULL,
         root_grant_id=NULL,root_session_id=NULL,
         root_grant_issuer_principal_id=NULL
   WHERE singleton=rr.bootstrap_id;
  UPDATE app.bootstrap_lifecycle_r2
     SET bootstrap_generation=v_new_generation,
         state='ROOT_ISSUANCE_PENDING',
         state_revision=state_revision+1,
         root_principal_id=rr.target_root_principal_id,
         root_role_name=rr.target_root_role_name,
         root_session_id=NULL,root_grant_id=NULL,
         recovery_request_id=p_recovery_id,
         updated_at=clock_timestamp()
   WHERE bootstrap_id=rr.bootstrap_id
     AND bootstrap_generation=rr.from_generation;
  UPDATE app.bootstrap_recovery_r2
     SET state='EXECUTED',executed_at=clock_timestamp(),
         new_generation=v_new_generation
   WHERE id=p_recovery_id;
  PERFORM app_private.complete_bootstrap_request_r2(
    'BOOTSTRAP_EXECUTE_ROOT_CHANGE',p_request_id,v_new_generation::text
  );
  RETURN v_new_generation;
END
$$;

-- ===========================================================================
-- 4. Catalog source-to-target binding and review event digest
-- ===========================================================================

ALTER TABLE app.product_revision
  ADD COLUMN source_revision_id text,
  ADD CONSTRAINT product_revision_source_fk_r2
    FOREIGN KEY (source_revision_id)
    REFERENCES app.catalog_source_revision(id),
  ADD CONSTRAINT product_revision_source_exact_unique_r2
    UNIQUE (product_id,id,content_digest,source_revision_id);
ALTER TABLE app.product_revision
  ALTER COLUMN source_revision_id SET NOT NULL;

ALTER TABLE app.specification_revision
  ADD COLUMN source_revision_id text,
  ADD CONSTRAINT specification_revision_source_fk_r2
    FOREIGN KEY (source_revision_id)
    REFERENCES app.catalog_source_revision(id),
  ADD CONSTRAINT specification_revision_source_exact_unique_r2
    UNIQUE (
      product_id,product_revision_id,id,content_digest,source_revision_id
    );
ALTER TABLE app.specification_revision
  ALTER COLUMN source_revision_id SET NOT NULL;

ALTER TABLE app.price_revision
  ADD CONSTRAINT price_revision_source_exact_unique_r2
    UNIQUE (
      id,product_id,product_revision_id,specification_revision_id,
      fact_digest,source_revision_id
    );

CREATE TABLE app.catalog_source_target_binding_r2 (
  id text PRIMARY KEY,
  project_id text REFERENCES app.project(id),
  target_kind text NOT NULL CHECK (
    target_kind IN ('PRODUCT_REVISION','SPECIFICATION_REVISION','PRICE_REVISION')
  ),
  product_id text NOT NULL,
  product_revision_id text NOT NULL,
  product_revision_digest text NOT NULL,
  specification_revision_id text,
  specification_revision_digest text,
  price_revision_id text,
  price_fact_digest text,
  source_revision_id text NOT NULL,
  source_evidence_object_id text NOT NULL,
  source_content_digest text NOT NULL,
  binding_digest text NOT NULL CHECK (binding_digest ~ '^[0-9a-f]{64}$'),
  created_by_principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  created_by_session_id text NOT NULL REFERENCES app.trusted_session(session_id),
  created_by_authority_grant_id text NOT NULL,
  request_id text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz(6) NOT NULL,
  CHECK (
    (target_kind='PRODUCT_REVISION'
      AND specification_revision_id IS NULL
      AND specification_revision_digest IS NULL
      AND price_revision_id IS NULL
      AND price_fact_digest IS NULL)
    OR (target_kind='SPECIFICATION_REVISION'
      AND specification_revision_id IS NOT NULL
      AND specification_revision_digest IS NOT NULL
      AND price_revision_id IS NULL
      AND price_fact_digest IS NULL)
    OR (target_kind='PRICE_REVISION'
      AND specification_revision_id IS NOT NULL
      AND specification_revision_digest IS NOT NULL
      AND price_revision_id IS NOT NULL
      AND price_fact_digest IS NOT NULL)
  ),
  FOREIGN KEY (
    product_id,product_revision_id,product_revision_digest,source_revision_id
  ) REFERENCES app.product_revision(
    product_id,id,content_digest,source_revision_id
  ),
  FOREIGN KEY (
    product_id,product_revision_id,specification_revision_id,
    specification_revision_digest,source_revision_id
  ) REFERENCES app.specification_revision(
    product_id,product_revision_id,id,content_digest,source_revision_id
  ),
  FOREIGN KEY (
    price_revision_id,product_id,product_revision_id,
    specification_revision_id,price_fact_digest,source_revision_id
  ) REFERENCES app.price_revision(
    id,product_id,product_revision_id,specification_revision_id,
    fact_digest,source_revision_id
  ),
  FOREIGN KEY (source_revision_id)
    REFERENCES app.catalog_source_revision(id),
  UNIQUE (
    id,target_kind,product_id,product_revision_id,product_revision_digest,
    specification_revision_id,specification_revision_digest,
    price_revision_id,price_fact_digest,source_revision_id,
    source_evidence_object_id,source_content_digest,project_id,binding_digest
  ),
  UNIQUE (id,binding_digest)
);

ALTER TABLE app.catalog_source_target_binding_r2
  ADD COLUMN target_revision_id text GENERATED ALWAYS AS (
    CASE target_kind
      WHEN 'PRODUCT_REVISION' THEN product_revision_id
      WHEN 'SPECIFICATION_REVISION' THEN specification_revision_id
      ELSE price_revision_id
    END
  ) STORED,
  ADD COLUMN target_revision_digest text GENERATED ALWAYS AS (
    CASE target_kind
      WHEN 'PRODUCT_REVISION' THEN product_revision_digest
      WHEN 'SPECIFICATION_REVISION' THEN specification_revision_digest
      ELSE price_fact_digest
    END
  ) STORED,
  ADD CONSTRAINT catalog_binding_target_identity_unique_r2
    UNIQUE (
      id,binding_digest,source_revision_id,target_kind,target_revision_id,
      target_revision_digest,product_revision_id,product_revision_digest,
      specification_revision_id,price_revision_id
    );

CREATE OR REPLACE FUNCTION app_private.catalog_source_target_payload_v2(
  p_row jsonb
) RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path=pg_catalog
RETURN jsonb_build_object(
  'schema','AIEA-CATALOG-SOURCE-TARGET-V1',
  'id',p_row->>'id',
  'projectId',p_row->'project_id',
  'targetKind',p_row->>'target_kind',
  'productId',p_row->>'product_id',
  'productRevisionId',p_row->>'product_revision_id',
  'productRevisionDigest',p_row->>'product_revision_digest',
  'specificationRevisionId',p_row->'specification_revision_id',
  'specificationRevisionDigest',p_row->'specification_revision_digest',
  'priceRevisionId',p_row->'price_revision_id',
  'priceFactDigest',p_row->'price_fact_digest',
  'sourceRevisionId',p_row->>'source_revision_id',
  'sourceEvidenceObjectId',p_row->>'source_evidence_object_id',
  'sourceContentDigest',p_row->>'source_content_digest'
);

CREATE OR REPLACE FUNCTION app_private.catalog_source_target_digest_v2(
  p_row jsonb
) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path=pg_catalog,app_private
RETURN app_private.sha256_hex(
  decode('414945412D434154414C4F472D534F555243452D54415247455400763100','hex')
  || convert_to(app_private.catalog_source_target_payload_v2(p_row)::text,'UTF8')
);

CREATE OR REPLACE FUNCTION app_private.a_compute_catalog_source_target_digest_r2()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  NEW.binding_digest := app_private.catalog_source_target_digest_v2(to_jsonb(NEW));
  RETURN NEW;
END
$$;

CREATE TRIGGER a_compute_catalog_source_target_digest_r2
BEFORE INSERT ON app.catalog_source_target_binding_r2
FOR EACH ROW EXECUTE FUNCTION app_private.a_compute_catalog_source_target_digest_r2();

CREATE TRIGGER guard_catalog_source_target_binding_r2
BEFORE UPDATE OR DELETE ON app.catalog_source_target_binding_r2
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();

CREATE TRIGGER deny_catalog_source_target_binding_truncate_r2
BEFORE TRUNCATE ON app.catalog_source_target_binding_r2
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();

CREATE OR REPLACE FUNCTION app.create_catalog_source_target_binding_r2(
  p_binding_id text,
  p_project_id text,
  p_target_kind text,
  p_product_id text,
  p_product_revision_id text,
  p_product_revision_digest text,
  p_specification_revision_id text,
  p_specification_revision_digest text,
  p_price_revision_id text,
  p_price_fact_digest text,
  p_source_revision_id text,
  p_source_evidence_object_id text,
  p_source_content_digest text,
  p_request_id text,
  p_request_key text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  sr app.catalog_source_revision%ROWTYPE;
  v_grant_id text;
  v_hash text;
  v_replay boolean;
  v_result text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  v_grant_id := app_private.lock_authority_grant(
    s.session_id,s.principal_id,'CATALOG_REVIEW_WRITE',
    p_project_id,NULL,NULL,NULL
  );
  SELECT * INTO STRICT sr FROM app.catalog_source_revision
   WHERE id=p_source_revision_id
     AND evidence_object_id=p_source_evidence_object_id
     AND raw_content_digest=p_source_content_digest
   FOR SHARE;
  IF p_target_kind='PRODUCT_REVISION' THEN
    IF p_specification_revision_id IS NOT NULL OR p_price_revision_id IS NOT NULL THEN
      RAISE EXCEPTION 'catalog product target shape invalid' USING ERRCODE='23514';
    END IF;
    PERFORM 1 FROM app.product_revision pr
     WHERE pr.product_id=p_product_id
       AND pr.id=p_product_revision_id
       AND pr.content_digest=p_product_revision_digest
       AND pr.source_revision_id=p_source_revision_id
     FOR SHARE;
  ELSIF p_target_kind='SPECIFICATION_REVISION' THEN
    IF p_specification_revision_id IS NULL
       OR p_specification_revision_digest IS NULL
       OR p_price_revision_id IS NOT NULL THEN
      RAISE EXCEPTION 'catalog specification target shape invalid'
        USING ERRCODE='23514';
    END IF;
    PERFORM 1 FROM app.specification_revision sr2
     WHERE sr2.product_id=p_product_id
       AND sr2.product_revision_id=p_product_revision_id
       AND sr2.id=p_specification_revision_id
       AND sr2.content_digest=p_specification_revision_digest
       AND sr2.source_revision_id=p_source_revision_id
     FOR SHARE;
  ELSIF p_target_kind='PRICE_REVISION' THEN
    IF p_specification_revision_id IS NULL
       OR p_price_revision_id IS NULL OR p_price_fact_digest IS NULL THEN
      RAISE EXCEPTION 'catalog price target shape invalid' USING ERRCODE='23514';
    END IF;
    PERFORM 1 FROM app.price_revision pr
     WHERE pr.id=p_price_revision_id
       AND pr.product_id=p_product_id
       AND pr.product_revision_id=p_product_revision_id
       AND pr.specification_revision_id=p_specification_revision_id
       AND pr.fact_digest=p_price_fact_digest
       AND pr.source_revision_id=p_source_revision_id
     FOR SHARE;
  ELSE
    RAISE EXCEPTION 'catalog target kind invalid' USING ERRCODE='22023';
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'catalog source and target do not match'
      USING ERRCODE='23514';
  END IF;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','CATALOG_SOURCE_TARGET_BIND','bindingId',p_binding_id,
    'projectId',p_project_id,'targetKind',p_target_kind,
    'productId',p_product_id,'productRevisionId',p_product_revision_id,
    'productRevisionDigest',p_product_revision_digest,
    'specificationRevisionId',p_specification_revision_id,
    'specificationRevisionDigest',p_specification_revision_digest,
    'priceRevisionId',p_price_revision_id,'priceFactDigest',p_price_fact_digest,
    'sourceRevisionId',p_source_revision_id,
    'sourceEvidenceObjectId',p_source_evidence_object_id,
    'sourceContentDigest',p_source_content_digest,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'CATALOG_SOURCE_TARGET_BIND',p_request_id,v_hash,
    coalesce(p_project_id,'GLOBAL'),s.principal_id,s.session_id,
    'CATALOG_SOURCE_TARGET_BINDING'
  );
  IF v_replay THEN
    PERFORM app_private.assert_active_session(
      s.session_id,s.principal_id,s.login_epoch
    );
    RETURN v_result;
  END IF;
  INSERT INTO app.catalog_source_target_binding_r2(
    id,project_id,target_kind,product_id,product_revision_id,
    product_revision_digest,specification_revision_id,
    specification_revision_digest,price_revision_id,price_fact_digest,
    source_revision_id,source_evidence_object_id,source_content_digest,
    binding_digest,created_by_principal_id,created_by_session_id,
    created_by_authority_grant_id,request_id,request_hash,created_at
  ) VALUES(
    p_binding_id,p_project_id,p_target_kind,p_product_id,p_product_revision_id,
    p_product_revision_digest,p_specification_revision_id,
    p_specification_revision_digest,p_price_revision_id,p_price_fact_digest,
    p_source_revision_id,p_source_evidence_object_id,p_source_content_digest,
    repeat('0',64),s.principal_id,s.session_id,v_grant_id,p_request_id,v_hash,
    clock_timestamp()
  );
  PERFORM app_private.complete_command_request(
    'CATALOG_SOURCE_TARGET_BIND',p_request_id,p_binding_id
  );
  PERFORM app_private.assert_active_session(
    s.session_id,s.principal_id,s.login_epoch
  );
  RETURN p_binding_id;
END
$$;

ALTER TABLE app.catalog_review_event_r3
  ADD COLUMN source_target_binding_id text,
  ADD COLUMN source_target_binding_digest text,
  ADD CONSTRAINT catalog_event_source_target_binding_fk_r2
    FOREIGN KEY (source_target_binding_id)
    REFERENCES app.catalog_source_target_binding_r2(id)
    DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT catalog_event_binding_identity_unique_r2
    UNIQUE (
      id,source_target_binding_id,source_target_binding_digest,
      source_revision_id,target_kind,product_id,product_revision_id,
      product_revision_digest,specification_revision_id,
      specification_revision_digest,price_revision_id,price_fact_digest
    );
ALTER TABLE app.catalog_review_event_r3
  ALTER COLUMN source_target_binding_id SET NOT NULL,
  ALTER COLUMN source_target_binding_digest SET NOT NULL;

CREATE OR REPLACE FUNCTION app_private.catalog_review_event_payload_v2(
  p_row jsonb
) RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path=pg_catalog
RETURN jsonb_build_object(
  'schema','AIEA-CATALOG-REVIEW-EVENT-V2',
  'id',p_row->>'id',
  'projectId',p_row->'project_id',
  'sourceTargetBindingId',p_row->>'source_target_binding_id',
  'sourceTargetBindingDigest',p_row->>'source_target_binding_digest',
  'targetKind',p_row->>'target_kind',
  'productId',p_row->>'product_id',
  'productRevisionId',p_row->'product_revision_id',
  'productRevisionDigest',p_row->'product_revision_digest',
  'specificationRevisionId',p_row->'specification_revision_id',
  'specificationRevisionDigest',p_row->'specification_revision_digest',
  'priceRevisionId',p_row->'price_revision_id',
  'priceFactDigest',p_row->'price_fact_digest',
  'sourceRevisionId',p_row->>'source_revision_id',
  'policyRevisionId',p_row->>'policy_revision_id',
  'decision',p_row->>'decision',
  'actorPrincipalId',p_row->>'actor_principal_id',
  'actorSessionId',p_row->>'actor_session_id',
  'actorAuthorityGrantId',p_row->>'actor_authority_grant_id',
  'reviewedAtUtc',to_char(
    (p_row->>'reviewed_at')::timestamptz AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
  )
);

CREATE OR REPLACE FUNCTION app_private.catalog_review_event_digest_v2(
  p_row jsonb
) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path=pg_catalog,app_private
RETURN app_private.sha256_hex(
  decode('414945412D434154414C4F472D52455649455700763200','hex')
  || convert_to(app_private.catalog_review_event_payload_v2(p_row)::text,'UTF8')
);

CREATE OR REPLACE FUNCTION app_private.a_compute_catalog_review_event_digest_r3()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  NEW.reviewed_at := date_trunc('microseconds',NEW.reviewed_at);
  NEW.content_digest := app_private.catalog_review_event_digest_v2(to_jsonb(NEW));
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS a_compute_catalog_review_event_digest_r3
  ON app.catalog_review_event_r3;
CREATE TRIGGER a_compute_catalog_review_event_digest_v2_r3
BEFORE INSERT OR UPDATE ON app.catalog_review_event_r3
FOR EACH ROW EXECUTE FUNCTION app_private.a_compute_catalog_review_event_digest_r3();

CREATE OR REPLACE FUNCTION app.create_catalog_review_event_r3(
  p_event_id text,
  p_project_id text,
  p_target_kind text,
  p_product_id text,
  p_product_revision_id text,
  p_product_revision_digest text,
  p_specification_revision_id text,
  p_specification_revision_digest text,
  p_price_revision_id text,
  p_price_fact_digest text,
  p_source_revision_id text,
  p_policy_revision_id text,
  p_decision text,
  p_request_id text,
  p_request_key text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  binding app.catalog_source_target_binding_r2%ROWTYPE;
  v_grant_id text;
  v_hash text;
  v_replay boolean;
  v_result text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  v_grant_id := app_private.lock_authority_grant(
    s.session_id,s.principal_id,'CATALOG_REVIEW_WRITE',
    p_project_id,NULL,NULL,NULL
  );
  SELECT * INTO STRICT binding
    FROM app.catalog_source_target_binding_r2
   WHERE project_id IS NOT DISTINCT FROM p_project_id
     AND target_kind=p_target_kind
     AND product_id=p_product_id
     AND product_revision_id=p_product_revision_id
     AND product_revision_digest=p_product_revision_digest
     AND specification_revision_id IS NOT DISTINCT FROM p_specification_revision_id
     AND specification_revision_digest IS NOT DISTINCT FROM p_specification_revision_digest
     AND price_revision_id IS NOT DISTINCT FROM p_price_revision_id
     AND price_fact_digest IS NOT DISTINCT FROM p_price_fact_digest
     AND source_revision_id=p_source_revision_id
   FOR SHARE;
  IF NOT EXISTS (
    SELECT 1 FROM app.policy_revision pr
     WHERE pr.id=p_policy_revision_id
       AND (p_project_id IS NULL OR pr.scope_project_id=p_project_id)
       AND app.policy_is_effective(pr.id)
  ) THEN
    RAISE EXCEPTION 'catalog review policy is not effective' USING ERRCODE='23514';
  END IF;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','CATALOG_REVIEW_CREATE_V2','eventId',p_event_id,
    'bindingId',binding.id,'bindingDigest',binding.binding_digest,
    'projectId',p_project_id,'targetKind',p_target_kind,
    'productId',p_product_id,'productRevisionId',p_product_revision_id,
    'productRevisionDigest',p_product_revision_digest,
    'specificationRevisionId',p_specification_revision_id,
    'specificationRevisionDigest',p_specification_revision_digest,
    'priceRevisionId',p_price_revision_id,'priceFactDigest',p_price_fact_digest,
    'sourceRevisionId',p_source_revision_id,
    'policyRevisionId',p_policy_revision_id,'decision',p_decision,
    'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'CATALOG_REVIEW_CREATE',p_request_id,v_hash,
    coalesce(p_project_id,'GLOBAL'),s.principal_id,s.session_id,
    'CATALOG_REVIEW_EVENT'
  );
  IF v_replay THEN
    PERFORM app_private.assert_active_session(
      s.session_id,s.principal_id,s.login_epoch
    );
    RETURN v_result;
  END IF;
  INSERT INTO app.catalog_review_event_r3(
    id,project_id,target_kind,product_id,product_revision_id,
    product_revision_digest,specification_revision_id,
    specification_revision_digest,price_revision_id,price_fact_digest,
    source_revision_id,source_target_binding_id,source_target_binding_digest,
    policy_revision_id,decision,actor_principal_id,actor_session_id,
    actor_authority_grant_id,request_id,request_hash,reviewed_at,content_digest
  ) VALUES(
    p_event_id,p_project_id,p_target_kind,p_product_id,p_product_revision_id,
    p_product_revision_digest,p_specification_revision_id,
    p_specification_revision_digest,p_price_revision_id,p_price_fact_digest,
    p_source_revision_id,binding.id,binding.binding_digest,
    p_policy_revision_id,p_decision,s.principal_id,s.session_id,
    v_grant_id,p_request_id,v_hash,clock_timestamp(),repeat('0',64)
  );
  PERFORM app_private.complete_command_request(
    'CATALOG_REVIEW_CREATE',p_request_id,p_event_id
  );
  PERFORM app_private.assert_active_session(
    s.session_id,s.principal_id,s.login_epoch
  );
  RETURN p_event_id;
END
$$;

ALTER TABLE app.selection_catalog_review_result
  ADD COLUMN source_target_binding_id text,
  ADD COLUMN source_target_binding_digest text;

CREATE OR REPLACE FUNCTION app_private.a_bind_selection_catalog_review_r3()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  e app.catalog_review_event_r3%ROWTYPE;
BEGIN
  SELECT * INTO STRICT e
    FROM app.catalog_review_event_r3
   WHERE id=NEW.catalog_review_id FOR SHARE;
  IF NEW.target_kind IS DISTINCT FROM e.target_kind
     OR NEW.target_revision_id IS DISTINCT FROM
        CASE e.target_kind
          WHEN 'PRODUCT_REVISION' THEN e.product_revision_id
          WHEN 'SPECIFICATION_REVISION' THEN e.specification_revision_id
          ELSE e.price_revision_id END
     OR NEW.target_revision_digest IS DISTINCT FROM
        CASE e.target_kind
          WHEN 'PRODUCT_REVISION' THEN e.product_revision_digest
          WHEN 'SPECIFICATION_REVISION' THEN e.specification_revision_digest
          ELSE e.price_fact_digest END
     OR NEW.source_revision_id IS DISTINCT FROM e.source_revision_id
     OR NEW.policy_revision_id IS DISTINCT FROM e.policy_revision_id
     OR NEW.decision IS DISTINCT FROM e.decision
     OR NEW.reviewed_at IS DISTINCT FROM e.reviewed_at THEN
    RAISE EXCEPTION 'catalog review caller facts mismatch' USING ERRCODE='23514';
  END IF;
  NEW.product_revision_id := e.product_revision_id;
  NEW.product_revision_digest := e.product_revision_digest;
  NEW.specification_revision_id := e.specification_revision_id;
  NEW.price_revision_id := e.price_revision_id;
  NEW.catalog_review_event_digest := e.content_digest;
  NEW.source_target_binding_id := e.source_target_binding_id;
  NEW.source_target_binding_digest := e.source_target_binding_digest;
  RETURN NEW;
END
$$;

ALTER TABLE app.selection_catalog_review_result
  ALTER COLUMN source_target_binding_id SET NOT NULL,
  ALTER COLUMN source_target_binding_digest SET NOT NULL,
  ADD CONSTRAINT selection_catalog_source_target_binding_fk_r2
    FOREIGN KEY (
      source_target_binding_id,source_target_binding_digest,source_revision_id,
      target_kind,target_revision_id,target_revision_digest,product_revision_id,
      product_revision_digest,specification_revision_id,price_revision_id
    ) REFERENCES app.catalog_source_target_binding_r2(
      id,binding_digest,source_revision_id,target_kind,target_revision_id,
      target_revision_digest,product_revision_id,product_revision_digest,
      specification_revision_id,price_revision_id
    ) DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION app_private.catalog_review_row_payload_v1(
  p_table text,
  p_row jsonb
) RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
SET search_path=pg_catalog
RETURN jsonb_build_object(
  'schema','AIEA-CATALOG-REVIEW-ROW-V2',
  'selectionRunId',p_row->>'selection_run_id',
  'catalogReviewId',p_row->>'catalog_review_id',
  'eventDigest',p_row->>'catalog_review_event_digest',
  'sourceTargetBindingId',p_row->>'source_target_binding_id',
  'sourceTargetBindingDigest',p_row->>'source_target_binding_digest',
  'targetKind',p_row->>'target_kind',
  'targetRevisionId',p_row->>'target_revision_id',
  'targetRevisionDigest',p_row->>'target_revision_digest',
  'productRevisionId',p_row->'product_revision_id',
  'productRevisionDigest',p_row->'product_revision_digest',
  'specificationRevisionId',p_row->'specification_revision_id',
  'priceRevisionId',p_row->'price_revision_id',
  'sourceRevisionId',p_row->>'source_revision_id',
  'policyRevisionId',p_row->>'policy_revision_id',
  'decision',p_row->>'decision',
  'reviewedAtUtc',to_char(
    (p_row->>'reviewed_at')::timestamptz AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
  )
);

ALTER TABLE app.sales_snapshot_catalog_review_r3
  ADD COLUMN source_target_binding_id text,
  ADD COLUMN source_target_binding_digest text;

CREATE OR REPLACE FUNCTION app_private.a_bind_snapshot_catalog_review_r3()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  src app.selection_catalog_review_result%ROWTYPE;
BEGIN
  SELECT * INTO STRICT src
    FROM app.selection_catalog_review_result
   WHERE selection_run_id=NEW.selection_run_id
     AND catalog_review_id=NEW.catalog_review_id FOR SHARE;
  NEW.target_revision_id := src.target_revision_id;
  NEW.source_revision_id := src.source_revision_id;
  NEW.policy_revision_id := src.policy_revision_id;
  NEW.decision := src.decision;
  NEW.reviewed_at := src.reviewed_at;
  NEW.catalog_review_event_digest := src.catalog_review_event_digest;
  NEW.source_target_binding_id := src.source_target_binding_id;
  NEW.source_target_binding_digest := src.source_target_binding_digest;
  NEW.target_kind := src.target_kind;
  NEW.target_revision_digest := src.target_revision_digest;
  NEW.product_revision_id := src.product_revision_id;
  NEW.product_revision_digest := src.product_revision_digest;
  NEW.specification_revision_id := src.specification_revision_id;
  NEW.price_revision_id := src.price_revision_id;
  NEW.source_row_digest := src.row_digest;
  RETURN NEW;
END
$$;

ALTER TABLE app.sales_snapshot_catalog_review_r3
  ALTER COLUMN source_target_binding_id SET NOT NULL,
  ALTER COLUMN source_target_binding_digest SET NOT NULL,
  ADD CONSTRAINT snapshot_catalog_source_target_binding_fk_r2
    FOREIGN KEY (
      source_target_binding_id,source_target_binding_digest,source_revision_id,
      target_kind,target_revision_id,target_revision_digest,product_revision_id,
      product_revision_digest,specification_revision_id,price_revision_id
    ) REFERENCES app.catalog_source_target_binding_r2(
      id,binding_digest,source_revision_id,target_kind,target_revision_id,
      target_revision_digest,product_revision_id,product_revision_digest,
      specification_revision_id,price_revision_id
    ) DEFERRABLE INITIALLY DEFERRED;

-- ===========================================================================
-- 5. Session termination and Request Ledger recovery
-- ===========================================================================

CREATE TABLE app.session_termination_audit_r2 (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES app.trusted_session(session_id),
  principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  termination_class text NOT NULL CHECK (
    termination_class IN (
      'NORMAL_CLOSE','NATURAL_EXPIRY','CREDENTIAL_ROTATION',
      'EPOCH_ADVANCE','ADMIN_REVOKE','SECURITY_REVOKE',
      'PRINCIPAL_DISABLED','GRANT_REVOKED'
    )
  ),
  actor_role text NOT NULL,
  reason text NOT NULL,
  request_id text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz(6) NOT NULL,
  content_digest text NOT NULL CHECK (content_digest ~ '^[0-9a-f]{64}$')
);

ALTER TABLE app.command_request_replay_audit_r3
  ADD COLUMN original_termination_class text NOT NULL,
  ADD COLUMN replay_policy text NOT NULL CHECK (
    replay_policy IN ('NORMAL_CLOSE','NATURAL_EXPIRY','CONTROLLED_RECOVERY')
  ),
  ADD COLUMN result_disclosed boolean NOT NULL;

CREATE OR REPLACE FUNCTION app.terminate_trusted_session_r2(
  p_session_id text,
  p_termination_class text,
  p_reason text,
  p_request_id text,
  p_request_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  ts app.trusted_session%ROWTYPE;
  v_hash text;
  v_state text;
BEGIN
  IF session_user<>'elevator_identity_broker' THEN
    RAISE EXCEPTION 'broker role required' USING ERRCODE='42501';
  END IF;
  IF p_termination_class NOT IN (
    'NORMAL_CLOSE','NATURAL_EXPIRY','CREDENTIAL_ROTATION',
    'EPOCH_ADVANCE','ADMIN_REVOKE','SECURITY_REVOKE',
    'PRINCIPAL_DISABLED','GRANT_REVOKED'
  ) THEN
    RAISE EXCEPTION 'session termination class invalid' USING ERRCODE='22023';
  END IF;
  SELECT * INTO STRICT ts
    FROM app.trusted_session
   WHERE session_id=p_session_id
   FOR UPDATE;
  IF ts.state<>'ACTIVE' THEN
    RAISE EXCEPTION 'session already terminated' USING ERRCODE='40001';
  END IF;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','SESSION_TERMINATE','sessionId',p_session_id,
    'terminationClass',p_termination_class,'reason',p_reason,
    'requestKey',p_request_key
  ));
  v_state := CASE WHEN p_termination_class='NATURAL_EXPIRY'
                  THEN 'EXPIRED' ELSE 'REVOKED' END;
  UPDATE app.authority_grant
     SET revoked_at=clock_timestamp(),
         revocation_reason=p_termination_class||':'||p_reason
   WHERE session_id=p_session_id AND revoked_at IS NULL;
  UPDATE app.trusted_session
     SET state=v_state,binding_state=v_state,revoked_at=clock_timestamp(),
         revocation_reason=p_reason,termination_class=p_termination_class
   WHERE session_id=p_session_id;
  UPDATE app.session_role_registry
     SET state='RETIRED',retired_at=clock_timestamp()
   WHERE role_name=ts.db_auth_role AND session_id=p_session_id;
  INSERT INTO app.session_termination_audit_r2(
    id,session_id,principal_id,termination_class,actor_role,reason,
    request_id,request_hash,occurred_at,content_digest
  ) VALUES(
    gen_random_uuid()::text,p_session_id,ts.principal_id,p_termination_class,
    session_user,p_reason,p_request_id,v_hash,clock_timestamp(),
    app_private.sha256_hex(convert_to(
      concat_ws(':',p_session_id,ts.principal_id,p_termination_class,
        session_user,p_reason,p_request_id,v_hash),
      'UTF8'
    ))
  );
  INSERT INTO app.session_audit(
    id,session_id,action,actor_role,reason,occurred_at
  ) VALUES(
    gen_random_uuid()::text,p_session_id,'REVOKE',session_user,p_reason,
    clock_timestamp()
  );
END
$$;

CREATE OR REPLACE FUNCTION app.revoke_trusted_session(
  p_session_id text,
  p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  PERFORM app.terminate_trusted_session_r2(
    p_session_id,'ADMIN_REVOKE',p_reason,
    'legacy-revoke:'||p_session_id,'legacy-wrapper'
  );
END
$$;

CREATE OR REPLACE FUNCTION app.advance_principal_epoch(
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
  IF session_user<>'elevator_identity_broker' THEN
    RAISE EXCEPTION 'broker role required' USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM app.principal_epoch
   WHERE principal_id=p_principal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'principal epoch missing' USING ERRCODE='23503';
  END IF;
  FOR v_session_id IN
    SELECT ts.session_id FROM app.trusted_session ts
     WHERE ts.principal_id=p_principal_id AND ts.state='ACTIVE'
     ORDER BY ts.session_id FOR UPDATE
  LOOP
    PERFORM app.terminate_trusted_session_r2(
      v_session_id,'EPOCH_ADVANCE',p_reason,
      'epoch-advance:'||p_principal_id||':'||v_session_id,
      'advance-principal-epoch'
    );
  END LOOP;
  UPDATE app.principal_epoch
     SET current_epoch=current_epoch+1,updated_at=clock_timestamp()
   WHERE principal_id=p_principal_id
   RETURNING current_epoch INTO v_next;
  RETURN v_next;
END
$$;

CREATE TABLE app.command_result_recovery_r2 (
  id text PRIMARY KEY,
  operation text NOT NULL,
  command_request_id text NOT NULL,
  original_session_id text NOT NULL REFERENCES app.trusted_session(session_id),
  principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  original_epoch bigint NOT NULL CHECK (original_epoch>0),
  original_request_hash text NOT NULL CHECK (original_request_hash ~ '^[0-9a-f]{64}$'),
  scope_key text NOT NULL,
  result_type text NOT NULL,
  original_termination_class text NOT NULL,
  reason_class text NOT NULL CHECK (
    reason_class IN (
      'ADMIN_REVOKE','CREDENTIAL_ROTATION','GRANT_REVOKED','LOST_RESPONSE'
    )
  ),
  requester_session_id text NOT NULL REFERENCES app.trusted_session(session_id),
  requester_principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  state text NOT NULL CHECK (
    state IN ('PENDING','AUTHORIZED','DENIED','CONSUMED','LOCKED')
  ),
  requested_at timestamptz(6) NOT NULL,
  authorized_at timestamptz(6),
  consumed_at timestamptz(6),
  request_id text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  content_digest text NOT NULL CHECK (content_digest ~ '^[0-9a-f]{64}$'),
  UNIQUE (operation,command_request_id,id),
  FOREIGN KEY (operation,command_request_id)
    REFERENCES app.command_request(operation,request_id)
);

CREATE TABLE app.command_result_recovery_approval_r2 (
  recovery_id text NOT NULL REFERENCES app.command_result_recovery_r2(id),
  approver_session_id text NOT NULL REFERENCES app.trusted_session(session_id),
  approver_principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  approver_authority_grant_id text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('APPROVE','DENY')),
  reason text NOT NULL,
  decided_at timestamptz(6) NOT NULL,
  request_id text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY (recovery_id,approver_principal_id),
  FOREIGN KEY (approver_session_id,approver_authority_grant_id)
    REFERENCES app.authority_grant(session_id,id)
);

CREATE OR REPLACE FUNCTION app.request_command_result_recovery_r2(
  p_recovery_id text,
  p_operation text,
  p_command_request_id text,
  p_reason_class text,
  p_request_id text,
  p_request_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  cr app.command_request%ROWTYPE;
  orig app.trusted_session%ROWTYPE;
  v_epoch bigint;
  v_hash text;
  v_replay boolean;
  v_result text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT cr FROM app.command_request
   WHERE operation=p_operation AND request_id=p_command_request_id
   FOR SHARE;
  IF cr.state<>'COMPLETED' OR cr.principal_id<>s.principal_id THEN
    RAISE EXCEPTION 'request recovery identity mismatch' USING ERRCODE='42501';
  END IF;
  SELECT * INTO STRICT orig FROM app.trusted_session
   WHERE session_id=cr.session_id FOR SHARE;
  IF orig.termination_class IN ('SECURITY_REVOKE','PRINCIPAL_DISABLED') THEN
    RAISE EXCEPTION 'request result is permanently non-recoverable'
      USING ERRCODE='42501';
  END IF;
  IF orig.termination_class NOT IN (
    'ADMIN_REVOKE','CREDENTIAL_ROTATION','GRANT_REVOKED'
  ) THEN
    RAISE EXCEPTION 'ordinary replay policy must handle this termination class'
      USING ERRCODE='40001';
  END IF;
  SELECT pe.current_epoch INTO STRICT v_epoch
    FROM app.principal_epoch pe
   WHERE pe.principal_id=s.principal_id FOR SHARE;
  IF v_epoch<>cr.epoch OR v_epoch<>orig.login_epoch THEN
    RAISE EXCEPTION 'request recovery epoch is stale' USING ERRCODE='40001';
  END IF;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','REQUEST_RESULT_RECOVERY_CREATE',
    'recoveryId',p_recovery_id,'commandOperation',p_operation,
    'commandRequestId',p_command_request_id,
    'reasonClass',p_reason_class,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'REQUEST_RESULT_RECOVERY_CREATE',p_request_id,v_hash,cr.scope_key,
    s.principal_id,s.session_id,'COMMAND_RESULT_RECOVERY'
  );
  IF v_replay THEN
    PERFORM app_private.assert_active_session(
      s.session_id,s.principal_id,s.login_epoch
    );
    RETURN;
  END IF;
  INSERT INTO app.command_result_recovery_r2(
    id,operation,command_request_id,original_session_id,principal_id,
    original_epoch,original_request_hash,scope_key,result_type,
    original_termination_class,
    reason_class,requester_session_id,requester_principal_id,state,
    requested_at,request_id,request_hash,content_digest
  ) VALUES(
    p_recovery_id,p_operation,p_command_request_id,cr.session_id,
    cr.principal_id,cr.epoch,cr.request_hash,cr.scope_key,cr.result_type,
    orig.termination_class,p_reason_class,s.session_id,s.principal_id,
    'PENDING',clock_timestamp(),p_request_id,v_hash,
    app_private.sha256_hex(convert_to(
      concat_ws(':',p_recovery_id,p_operation,p_command_request_id,cr.session_id,
        cr.principal_id,cr.request_hash,p_reason_class,s.session_id,
        s.principal_id,p_request_id,v_hash),
      'UTF8'
    ))
  );
  PERFORM app_private.complete_command_request(
    'REQUEST_RESULT_RECOVERY_CREATE',p_request_id,p_recovery_id
  );
  PERFORM app_private.assert_active_session(
    s.session_id,s.principal_id,s.login_epoch
  );
END
$$;

CREATE OR REPLACE FUNCTION app.approve_command_result_recovery_r2(
  p_recovery_id text,
  p_decision text,
  p_reason text,
  p_request_id text,
  p_request_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  rr app.command_result_recovery_r2%ROWTYPE;
  v_grant_id text;
  v_hash text;
  v_replay boolean;
  v_result text;
  v_approvals integer;
BEGIN
  IF p_decision NOT IN ('APPROVE','DENY') THEN
    RAISE EXCEPTION 'recovery decision invalid' USING ERRCODE='22023';
  END IF;
  SELECT * INTO s FROM app_private.lock_current_session();
  v_grant_id := app_private.lock_authority_grant(
    s.session_id,s.principal_id,'RECOVERY_APPROVE',NULL,NULL,NULL,NULL
  );
  SELECT * INTO STRICT rr FROM app.command_result_recovery_r2
   WHERE id=p_recovery_id FOR UPDATE;
  IF rr.state<>'PENDING' THEN
    RAISE EXCEPTION 'request recovery is not pending' USING ERRCODE='40001';
  END IF;
  IF s.principal_id IN (rr.principal_id,rr.requester_principal_id) THEN
    RAISE EXCEPTION 'recovery approver must be independent' USING ERRCODE='42501';
  END IF;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','REQUEST_RESULT_RECOVERY_APPROVE','recoveryId',p_recovery_id,
    'decision',p_decision,'reason',p_reason,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'REQUEST_RESULT_RECOVERY_APPROVE',p_request_id,v_hash,rr.scope_key,
    s.principal_id,s.session_id,'COMMAND_RESULT_RECOVERY_APPROVAL'
  );
  IF v_replay THEN
    PERFORM app_private.assert_active_session(
      s.session_id,s.principal_id,s.login_epoch
    );
    RETURN;
  END IF;
  INSERT INTO app.command_result_recovery_approval_r2(
    recovery_id,approver_session_id,approver_principal_id,
    approver_authority_grant_id,decision,reason,decided_at,
    request_id,request_hash
  ) VALUES(
    p_recovery_id,s.session_id,s.principal_id,v_grant_id,p_decision,p_reason,
    clock_timestamp(),p_request_id,v_hash
  );
  IF p_decision='DENY' THEN
    UPDATE app.command_result_recovery_r2
       SET state='DENIED' WHERE id=p_recovery_id;
  ELSE
    SELECT count(*) INTO v_approvals
      FROM app.command_result_recovery_approval_r2 a
     WHERE a.recovery_id=p_recovery_id AND a.decision='APPROVE';
    IF v_approvals>=2 THEN
      UPDATE app.command_result_recovery_r2
         SET state='AUTHORIZED',authorized_at=clock_timestamp()
       WHERE id=p_recovery_id;
    END IF;
  END IF;
  PERFORM app_private.complete_command_request(
    'REQUEST_RESULT_RECOVERY_APPROVE',p_request_id,p_recovery_id
  );
  PERFORM app_private.assert_active_session(
    s.session_id,s.principal_id,s.login_epoch
  );
END
$$;

CREATE OR REPLACE FUNCTION app.execute_command_result_recovery_r2(
  p_recovery_id text,
  p_request_id text,
  p_request_key text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  rr app.command_result_recovery_r2%ROWTYPE;
  cr app.command_request%ROWTYPE;
  v_epoch bigint;
  v_hash text;
  v_replay boolean;
  v_result text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT rr FROM app.command_result_recovery_r2
   WHERE id=p_recovery_id FOR UPDATE;
  IF rr.state<>'AUTHORIZED'
     OR rr.principal_id<>s.principal_id
     OR rr.requester_principal_id<>s.principal_id THEN
    RAISE EXCEPTION 'request recovery execution not authorized' USING ERRCODE='42501';
  END IF;
  SELECT pe.current_epoch INTO STRICT v_epoch
    FROM app.principal_epoch pe
   WHERE pe.principal_id=s.principal_id FOR SHARE;
  IF v_epoch<>rr.original_epoch THEN
    RAISE EXCEPTION 'request recovery epoch is stale' USING ERRCODE='40001';
  END IF;
  SELECT * INTO STRICT cr FROM app.command_request
   WHERE operation=rr.operation AND request_id=rr.command_request_id
   FOR SHARE;
  IF cr.epoch<>v_epoch
     OR cr.request_hash<>rr.original_request_hash
     OR cr.scope_key<>rr.scope_key
     OR cr.result_type<>rr.result_type THEN
    RAISE EXCEPTION 'request recovery identity changed' USING ERRCODE='40001';
  END IF;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','REQUEST_RESULT_RECOVERY_EXECUTE','recoveryId',p_recovery_id,
    'commandOperation',rr.operation,'commandRequestId',rr.command_request_id,
    'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'REQUEST_RESULT_RECOVERY_EXECUTE',p_request_id,v_hash,rr.scope_key,
    s.principal_id,s.session_id,'COMMAND_RESULT_RECOVERY_RESULT'
  );
  IF v_replay THEN
    RETURN v_result;
  END IF;
  UPDATE app.command_result_recovery_r2
     SET state='CONSUMED',consumed_at=clock_timestamp()
   WHERE id=p_recovery_id;
  INSERT INTO app.command_request_replay_audit_r3(
    id,operation,request_id,original_session_id,replay_session_id,
    principal_id,epoch,request_hash,replayed_at,
    original_termination_class,replay_policy,result_disclosed
  ) VALUES(
    gen_random_uuid()::text,rr.operation,rr.command_request_id,
    rr.original_session_id,s.session_id,s.principal_id,v_epoch,
    rr.original_request_hash,clock_timestamp(),
    rr.original_termination_class,'CONTROLLED_RECOVERY',true
  );
  PERFORM app_private.complete_command_request(
    'REQUEST_RESULT_RECOVERY_EXECUTE',p_request_id,cr.result_id
  );
  PERFORM app_private.assert_active_session(
    s.session_id,s.principal_id,s.login_epoch
  );
  RETURN cr.result_id;
END
$$;

CREATE OR REPLACE FUNCTION app_private.claim_command_request(
  p_operation text,
  p_request_id text,
  p_request_hash text,
  p_scope_key text,
  p_principal_id text,
  p_session_id text,
  p_result_type text
) RETURNS TABLE(replay boolean,result_id text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  r app.command_request%ROWTYPE;
  orig app.trusted_session%ROWTYPE;
  v_inserted boolean;
  v_epoch bigint;
BEGIN
  SELECT ts.login_epoch INTO STRICT v_epoch
    FROM app.trusted_session ts
   WHERE ts.session_id=p_session_id
     AND ts.principal_id=p_principal_id
     AND ts.state='ACTIVE'
     AND ts.binding_state='ACTIVE'
     AND ts.backend_pid=pg_catalog.pg_backend_pid()
     AND ts.backend_started_at=(
       SELECT a.backend_start FROM pg_catalog.pg_stat_activity a
        WHERE a.pid=pg_catalog.pg_backend_pid() AND a.usename=session_user
     )
     AND pg_catalog.current_setting('aiea.session_binding',true)=ts.session_id;
  INSERT INTO app.command_request(
    operation,request_id,request_hash,scope_key,principal_id,session_id,
    result_type,state,claimed_at,epoch
  ) VALUES(
    p_operation,p_request_id,p_request_hash,p_scope_key,p_principal_id,
    p_session_id,p_result_type,'CLAIMED',clock_timestamp(),v_epoch
  )
  ON CONFLICT (operation,request_id) DO NOTHING
  RETURNING true INTO v_inserted;
  IF v_inserted THEN
    RETURN QUERY SELECT false,NULL::text;
    RETURN;
  END IF;
  SELECT * INTO STRICT r FROM app.command_request
   WHERE operation=p_operation AND request_id=p_request_id
   FOR UPDATE;
  IF r.request_hash<>p_request_hash
     OR r.scope_key<>p_scope_key
     OR r.principal_id<>p_principal_id
     OR r.result_type<>p_result_type THEN
    RAISE EXCEPTION 'request id reused with different payload/scope'
      USING ERRCODE='40001';
  END IF;
  IF r.state<>'COMPLETED' THEN
    RAISE EXCEPTION 'request already in progress' USING ERRCODE='40001';
  END IF;
  IF r.session_id<>p_session_id THEN
    SELECT * INTO STRICT orig FROM app.trusted_session
     WHERE session_id=r.session_id FOR SHARE;
    IF r.epoch<>v_epoch OR orig.login_epoch<>v_epoch THEN
      RAISE EXCEPTION 'request replay epoch is stale' USING ERRCODE='40001';
    END IF;
    IF orig.state='ACTIVE'
       OR orig.termination_class NOT IN ('NORMAL_CLOSE','NATURAL_EXPIRY') THEN
      RAISE EXCEPTION 'ordinary cross-session replay denied'
        USING ERRCODE='42501';
    END IF;
    INSERT INTO app.command_request_replay_audit_r3(
      id,operation,request_id,original_session_id,replay_session_id,
      principal_id,epoch,request_hash,replayed_at,
      original_termination_class,replay_policy,result_disclosed
    ) VALUES(
      gen_random_uuid()::text,p_operation,p_request_id,r.session_id,
      p_session_id,p_principal_id,v_epoch,p_request_hash,clock_timestamp(),
      orig.termination_class,
      CASE orig.termination_class
        WHEN 'NORMAL_CLOSE' THEN 'NORMAL_CLOSE'
        ELSE 'NATURAL_EXPIRY' END,
      true
    );
  END IF;
  RETURN QUERY SELECT true,r.result_id;
END
$$;

-- ===========================================================================
-- 6. Requirement FieldValue domain alignment
-- ===========================================================================

ALTER TABLE app.requirement_field_value_r3
  ADD CONSTRAINT requirement_value_type_check_r2 CHECK (
    value_type IN (
      'BOOLEAN','INTEGER','DECIMAL','TEXT','ENUM',
      'CANONICAL_ID','TIMESTAMP','BYTES'
    )
  ),
  ADD CONSTRAINT requirement_field_status_check_r2 CHECK (
    field_status IN (
      'CONFIRMED','PROPOSED','MISSING','NOT_APPLICABLE','CONFLICTED'
    )
  ),
  ADD CONSTRAINT requirement_unit_shape_check_r2 CHECK (
    unit IS NULL OR unit ~ '^[A-Z][A-Z0-9_./-]{0,31}$'
  );

ALTER TABLE app.selection_requirement_field
  ADD CONSTRAINT selection_requirement_unit_shape_check_r2 CHECK (
    unit IS NULL OR unit ~ '^[A-Z][A-Z0-9_./-]{0,31}$'
  );

ALTER TABLE app.sales_snapshot_requirement_field_r3
  ADD CONSTRAINT snapshot_requirement_unit_shape_check_r2 CHECK (
    unit IS NULL OR unit ~ '^[A-Z][A-Z0-9_./-]{0,31}$'
  );

CREATE OR REPLACE FUNCTION app_private.requirement_field_domain_valid_r2(
  p_value_json jsonb,
  p_value_type text,
  p_unit text,
  p_field_status text
) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path=pg_catalog
AS $$
DECLARE
  v_text text;
  v_numeric numeric;
BEGIN
  IF p_field_status IN ('MISSING','NOT_APPLICABLE','CONFLICTED') THEN
    RETURN p_value_json='null'::jsonb AND p_unit IS NULL;
  END IF;
  IF p_field_status NOT IN ('CONFIRMED','PROPOSED')
     OR p_value_json='null'::jsonb THEN
    RETURN false;
  END IF;
  IF p_unit IS NOT NULL
     AND (p_value_type NOT IN ('INTEGER','DECIMAL')
          OR p_unit !~ '^[A-Z][A-Z0-9_./-]{0,31}$') THEN
    RETURN false;
  END IF;
  CASE p_value_type
    WHEN 'BOOLEAN' THEN
      RETURN pg_catalog.jsonb_typeof(p_value_json)='boolean';
    WHEN 'INTEGER' THEN
      IF pg_catalog.jsonb_typeof(p_value_json)<>'number' THEN RETURN false; END IF;
      v_numeric := (p_value_json::text)::numeric;
      RETURN v_numeric=trunc(v_numeric)
         AND octet_length(p_value_json::text)<=32;
    WHEN 'DECIMAL' THEN
      IF pg_catalog.jsonb_typeof(p_value_json)<>'number' THEN RETURN false; END IF;
      v_numeric := (p_value_json::text)::numeric;
      RETURN octet_length(p_value_json::text)<=64;
    WHEN 'TEXT' THEN
      IF pg_catalog.jsonb_typeof(p_value_json)<>'string' THEN RETURN false; END IF;
      v_text := p_value_json #>> '{}';
      RETURN octet_length(v_text)<=65536
         AND v_text IS NFC NORMALIZED
         AND v_text !~ '[[:cntrl:]]';
    WHEN 'ENUM' THEN
      IF pg_catalog.jsonb_typeof(p_value_json)<>'string' THEN RETURN false; END IF;
      v_text := p_value_json #>> '{}';
      RETURN octet_length(v_text) BETWEEN 1 AND 128
         AND v_text IS NFC NORMALIZED
         AND v_text ~ '^[A-Z][A-Z0-9_./:-]*$';
    WHEN 'CANONICAL_ID' THEN
      IF pg_catalog.jsonb_typeof(p_value_json)<>'string' THEN RETURN false; END IF;
      v_text := p_value_json #>> '{}';
      RETURN v_text ~ '^[A-Za-z0-9][A-Za-z0-9:_./-]{0,127}$';
    WHEN 'TIMESTAMP' THEN
      IF pg_catalog.jsonb_typeof(p_value_json)<>'string' THEN RETURN false; END IF;
      v_text := p_value_json #>> '{}';
      RETURN v_text ~
        '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$'
        AND to_char(
          v_text::timestamptz AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
        )=v_text;
    WHEN 'BYTES' THEN
      IF pg_catalog.jsonb_typeof(p_value_json)<>'string' THEN RETURN false; END IF;
      v_text := p_value_json #>> '{}';
      RETURN octet_length(v_text) BETWEEN 2 AND 131072
         AND length(v_text)%2=0
         AND v_text ~ '^[0-9a-f]+$';
    ELSE
      RETURN false;
  END CASE;
EXCEPTION WHEN others THEN
  RETURN false;
END
$$;

CREATE OR REPLACE FUNCTION app_private.a_validate_requirement_field_domain_r2()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  IF NOT app_private.requirement_field_domain_valid_r2(
    NEW.value_json,NEW.value_type,NEW.unit,NEW.field_status
  ) THEN
    RAISE EXCEPTION 'requirement field value domain invalid' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER a_validate_requirement_field_domain_r2
BEFORE INSERT OR UPDATE ON app.requirement_field_value_r3
FOR EACH ROW EXECUTE FUNCTION app_private.a_validate_requirement_field_domain_r2();

CREATE TRIGGER a_validate_selection_requirement_domain_r2
BEFORE INSERT OR UPDATE ON app.selection_requirement_field
FOR EACH ROW EXECUTE FUNCTION app_private.a_validate_requirement_field_domain_r2();

CREATE TRIGGER a_validate_snapshot_requirement_domain_r2
BEFORE INSERT OR UPDATE ON app.sales_snapshot_requirement_field_r3
FOR EACH ROW EXECUTE FUNCTION app_private.a_validate_requirement_field_domain_r2();

-- ===========================================================================
-- 7. Append-only guards, ownership and grants
-- ===========================================================================

CREATE TRIGGER guard_bootstrap_event_r2
BEFORE UPDATE OR DELETE ON app.bootstrap_event_r2
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER deny_bootstrap_event_truncate_r2
BEFORE TRUNCATE ON app.bootstrap_event_r2
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER deny_bootstrap_request_ledger_delete_r2
BEFORE DELETE ON app.bootstrap_request_ledger_r2
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER deny_bootstrap_request_ledger_truncate_r2
BEFORE TRUNCATE ON app.bootstrap_request_ledger_r2
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER guard_bootstrap_generation_delete_r2
BEFORE DELETE ON app.bootstrap_generation_r2
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER deny_bootstrap_generation_truncate_r2
BEFORE TRUNCATE ON app.bootstrap_generation_r2
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER guard_bootstrap_lifecycle_delete_r2
BEFORE DELETE ON app.bootstrap_lifecycle_r2
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER deny_bootstrap_lifecycle_truncate_r2
BEFORE TRUNCATE ON app.bootstrap_lifecycle_r2
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER guard_bootstrap_approval_r2
BEFORE UPDATE OR DELETE ON app.bootstrap_approval_r2
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER deny_bootstrap_approval_truncate_r2
BEFORE TRUNCATE ON app.bootstrap_approval_r2
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER guard_bootstrap_root_session_delete_r2
BEFORE DELETE ON app.bootstrap_root_session_r2
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER deny_bootstrap_root_session_truncate_r2
BEFORE TRUNCATE ON app.bootstrap_root_session_r2
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER guard_bootstrap_root_grant_delete_r2
BEFORE DELETE ON app.bootstrap_root_grant_r2
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER deny_bootstrap_root_grant_truncate_r2
BEFORE TRUNCATE ON app.bootstrap_root_grant_r2
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER guard_bootstrap_recovery_delete_r2
BEFORE DELETE ON app.bootstrap_recovery_r2
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER deny_bootstrap_recovery_truncate_r2
BEFORE TRUNCATE ON app.bootstrap_recovery_r2
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER guard_bootstrap_recovery_approval_r2
BEFORE UPDATE OR DELETE ON app.bootstrap_recovery_approval_r2
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER deny_bootstrap_recovery_approval_truncate_r2
BEFORE TRUNCATE ON app.bootstrap_recovery_approval_r2
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER guard_session_termination_audit_r2
BEFORE UPDATE OR DELETE ON app.session_termination_audit_r2
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER deny_session_termination_audit_truncate_r2
BEFORE TRUNCATE ON app.session_termination_audit_r2
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER guard_command_result_recovery_approval_r2
BEFORE UPDATE OR DELETE ON app.command_result_recovery_approval_r2
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER deny_command_result_recovery_approval_truncate_r2
BEFORE TRUNCATE ON app.command_result_recovery_approval_r2
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();
CREATE TRIGGER guard_command_result_recovery_delete_r2
BEFORE DELETE ON app.command_result_recovery_r2
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER deny_command_result_recovery_truncate_r2
BEFORE TRUNCATE ON app.command_result_recovery_r2
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();

ALTER TABLE app.bootstrap_generation_r2 OWNER TO elevator_table_owner;
ALTER TABLE app.bootstrap_lifecycle_r2 OWNER TO elevator_table_owner;
ALTER TABLE app.bootstrap_request_ledger_r2 OWNER TO elevator_table_owner;
ALTER TABLE app.bootstrap_approval_r2 OWNER TO elevator_table_owner;
ALTER TABLE app.bootstrap_root_session_r2 OWNER TO elevator_table_owner;
ALTER TABLE app.bootstrap_root_grant_r2 OWNER TO elevator_table_owner;
ALTER TABLE app.bootstrap_event_r2 OWNER TO elevator_table_owner;
ALTER TABLE app.bootstrap_recovery_r2 OWNER TO elevator_table_owner;
ALTER TABLE app.bootstrap_recovery_approval_r2 OWNER TO elevator_table_owner;
ALTER TABLE app.catalog_source_target_binding_r2 OWNER TO elevator_table_owner;
ALTER TABLE app.session_termination_audit_r2 OWNER TO elevator_table_owner;
ALTER TABLE app.command_result_recovery_r2 OWNER TO elevator_table_owner;
ALTER TABLE app.command_result_recovery_approval_r2 OWNER TO elevator_table_owner;

ALTER FUNCTION app_private.owner_closure_digest_r2(text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.assert_protected_owner_closure_r2(text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.bootstrap_request_payload_v2(jsonb)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.bootstrap_request_digest_v2(jsonb)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_compute_bootstrap_event_digest_r2()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.claim_bootstrap_request_r2(
  text,text,text,boolean,bigint,text,text,text
) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.complete_bootstrap_request_r2(text,text,text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.append_bootstrap_event_r2(
  text,boolean,bigint,text,text,text,text
) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.bootstrap_root_grant_digest_r2(
  boolean,bigint,text,text,text,text,bigint
) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.bootstrap_generation_digest_r2(
  boolean,bigint,text,text,text
) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.bootstrap_recovery_digest_r2(jsonb)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.bootstrap_complete_root_r3(boolean,text,text,text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.bootstrap_begin_root_change_r2(
  text,boolean,text,text,text,text,text,text,text
) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.bootstrap_approve_root_change_r2(text,text,text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.bootstrap_execute_root_change_r2(text,text,text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.catalog_source_target_payload_v2(jsonb)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.catalog_source_target_digest_v2(jsonb)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_compute_catalog_source_target_digest_r2()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.create_catalog_source_target_binding_r2(
  text,text,text,text,text,text,text,text,text,text,text,text,text,text,text
) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.catalog_review_event_payload_v2(jsonb)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.catalog_review_event_digest_v2(jsonb)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.terminate_trusted_session_r2(text,text,text,text,text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.request_command_result_recovery_r2(
  text,text,text,text,text,text
) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.approve_command_result_recovery_r2(
  text,text,text,text,text
) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.execute_command_result_recovery_r2(text,text,text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.requirement_field_domain_valid_r2(
  jsonb,text,text,text
) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_validate_requirement_field_domain_r2()
  OWNER TO elevator_review_function_owner;

GRANT EXECUTE ON FUNCTION app.bootstrap_complete_root_r3(
  boolean,text,text,text
) TO elevator_root_issuer;
GRANT EXECUTE ON FUNCTION app.bootstrap_begin_root_change_r2(
  text,boolean,text,text,text,text,text,text,text
) TO elevator_bootstrap_initiator;
GRANT EXECUTE ON FUNCTION app.bootstrap_approve_root_change_r2(text,text,text)
  TO elevator_bootstrap_approver;
GRANT EXECUTE ON FUNCTION app.bootstrap_execute_root_change_r2(text,text,text)
  TO elevator_bootstrap_seed;
GRANT EXECUTE ON FUNCTION app.create_catalog_source_target_binding_r2(
  text,text,text,text,text,text,text,text,text,text,text,text,text,text,text
) TO elevator_catalog_reviewer,elevator_catalog_publisher;
GRANT EXECUTE ON FUNCTION app.terminate_trusted_session_r2(
  text,text,text,text,text
) TO elevator_identity_broker;
GRANT EXECUTE ON FUNCTION app.request_command_result_recovery_r2(
  text,text,text,text,text,text
) TO elevator_runtime_web,elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.approve_command_result_recovery_r2(
  text,text,text,text,text
) TO elevator_security_admin;
GRANT EXECUTE ON FUNCTION app.execute_command_result_recovery_r2(
  text,text,text
) TO elevator_runtime_web,elevator_runtime_worker;

REVOKE ALL ON TABLE app.bootstrap_generation_r2 FROM PUBLIC;
REVOKE ALL ON TABLE app.bootstrap_lifecycle_r2 FROM PUBLIC;
REVOKE ALL ON TABLE app.bootstrap_request_ledger_r2 FROM PUBLIC;
REVOKE ALL ON TABLE app.bootstrap_approval_r2 FROM PUBLIC;
REVOKE ALL ON TABLE app.bootstrap_root_session_r2 FROM PUBLIC;
REVOKE ALL ON TABLE app.bootstrap_root_grant_r2 FROM PUBLIC;
REVOKE ALL ON TABLE app.bootstrap_event_r2 FROM PUBLIC;
REVOKE ALL ON TABLE app.bootstrap_recovery_r2 FROM PUBLIC;
REVOKE ALL ON TABLE app.bootstrap_recovery_approval_r2 FROM PUBLIC;
REVOKE ALL ON TABLE app.catalog_source_target_binding_r2 FROM PUBLIC;
REVOKE ALL ON TABLE app.session_termination_audit_r2 FROM PUBLIC;
REVOKE ALL ON TABLE app.command_result_recovery_r2 FROM PUBLIC;
REVOKE ALL ON TABLE app.command_result_recovery_approval_r2 FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.owner_closure_digest_r2(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.assert_protected_owner_closure_r2(text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.requirement_field_domain_valid_r2(
  jsonb,text,text,text
) FROM PUBLIC;

CREATE OR REPLACE FUNCTION app.bootstrap_complete_root_r3(
  p_bootstrap_id boolean,
  p_root_token text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_generation bigint;
BEGIN
  SELECT bootstrap_generation INTO STRICT v_generation
    FROM app.bootstrap_state_r3 WHERE singleton=p_bootstrap_id;
  PERFORM app.bootstrap_complete_root_r3(
    p_bootstrap_id,p_root_token,
    format('bootstrap-root:%s',v_generation),
    'legacy-2-arg-wrapper'
  );
END
$$;

CREATE OR REPLACE FUNCTION app_private.validate_session_role_r3(
  p_role_name text,
  p_role_kind text,
  p_capability_role text
) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_role oid;
  v_bootstrap oid;
  v_capability oid;
  v_unexpected integer;
  v_admin_paths integer;
  v_owner_actions integer;
  v_direct_other integer;
BEGIN
  IF p_role_name !~ '^elevator_session_[a-z0-9_]{6,48}$' THEN
    RAISE EXCEPTION 'session role name invalid' USING ERRCODE='22023';
  END IF;
  IF p_capability_role IS DISTINCT FROM CASE p_role_kind
    WHEN 'WEB' THEN 'elevator_runtime_web'
    WHEN 'WORKER' THEN 'elevator_runtime_worker'
    WHEN 'PROFESSIONAL_REVIEWER' THEN 'elevator_professional_reviewer'
    WHEN 'POLICY_AUTHOR' THEN 'elevator_policy_author'
    WHEN 'POLICY_REVIEWER' THEN 'elevator_policy_reviewer'
    WHEN 'SECURITY_ADMIN' THEN 'elevator_security_admin'
    WHEN 'CATALOG_REVIEWER' THEN 'elevator_catalog_reviewer'
    WHEN 'CATALOG_PUBLISHER' THEN 'elevator_catalog_publisher'
    WHEN 'BOOTSTRAP_INITIATOR' THEN 'elevator_bootstrap_initiator'
    WHEN 'BOOTSTRAP_APPROVER' THEN 'elevator_bootstrap_approver'
    WHEN 'ROOT_ISSUER' THEN 'elevator_root_issuer'
    WHEN 'AUDITOR' THEN 'elevator_auditor'
    WHEN 'REPORTING' THEN 'elevator_reporting'
  END THEN
    RAISE EXCEPTION 'session capability invalid' USING ERRCODE='22023';
  END IF;

  SELECT r.oid INTO STRICT v_role
    FROM pg_catalog.pg_roles r WHERE r.rolname=p_role_name;
  SELECT r.oid INTO STRICT v_bootstrap
    FROM pg_catalog.pg_roles r WHERE r.rolname='elevator_session_bootstrap';
  SELECT r.oid INTO STRICT v_capability
    FROM pg_catalog.pg_roles r WHERE r.rolname=p_capability_role;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles r
     WHERE r.oid=v_role AND r.rolcanlogin
       AND r.rolconnlimit=1
       AND NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole
       AND NOT r.rolreplication AND NOT r.rolbypassrls AND NOT r.rolinherit
  ) THEN
    RAISE EXCEPTION 'session role attributes invalid' USING ERRCODE='42501';
  END IF;

  IF (SELECT count(*) FROM pg_catalog.pg_auth_members am
       WHERE am.member=v_role)<>2
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_auth_members am
        WHERE am.member=v_role AND am.roleid=v_bootstrap
          AND NOT am.inherit_option AND am.set_option AND NOT am.admin_option
     )
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_auth_members am
        WHERE am.member=v_role AND am.roleid=v_capability
          AND NOT am.inherit_option AND am.set_option AND NOT am.admin_option
     ) THEN
    RAISE EXCEPTION 'session role membership options invalid' USING ERRCODE='42501';
  END IF;

  WITH RECURSIVE reachable(
    role_oid,inherit_path,set_path,admin_seen,visited
  ) AS (
    SELECT am.roleid,am.inherit_option,am.set_option,am.admin_option,
           ARRAY[v_role,am.roleid]
      FROM pg_catalog.pg_auth_members am
     WHERE am.member=v_role
    UNION ALL
    SELECT am.roleid,
           r.inherit_path AND am.inherit_option,
           r.set_path AND am.set_option,
           r.admin_seen OR am.admin_option,
           r.visited||am.roleid
      FROM reachable r
      JOIN pg_catalog.pg_auth_members am ON am.member=r.role_oid
     WHERE NOT am.roleid=ANY(r.visited)
  )
  SELECT count(*),count(*) FILTER (WHERE admin_seen)
    INTO v_unexpected,v_admin_paths
    FROM reachable
   WHERE role_oid NOT IN (v_bootstrap,v_capability);
  IF v_unexpected<>0 OR v_admin_paths<>0 THEN
    RAISE EXCEPTION 'session role has indirect owner/admin membership'
      USING ERRCODE='42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_database d
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(d.datacl,pg_catalog.acldefault('d',d.datdba))
      ) acl
     WHERE d.datname=pg_catalog.current_database()
       AND acl.grantee=v_role AND acl.privilege_type='CONNECT'
  ) THEN
    RAISE EXCEPTION 'session role requires direct database CONNECT'
      USING ERRCODE='42501';
  END IF;

  SELECT count(*) INTO v_direct_other
    FROM pg_catalog.pg_database d
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(d.datacl,pg_catalog.acldefault('d',d.datdba))
    ) acl
   WHERE d.datname=pg_catalog.current_database()
     AND acl.grantee=v_role AND acl.privilege_type<>'CONNECT';
  IF v_direct_other<>0 THEN
    RAISE EXCEPTION 'session role has unexpected database privilege'
      USING ERRCODE='42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_namespace n
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(n.nspacl,pg_catalog.acldefault('n',n.nspowner))
    ) acl
     WHERE n.nspname IN ('app','app_private')
       AND acl.grantee=v_role
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(c.relacl,pg_catalog.acldefault(
        CASE WHEN c.relkind='S' THEN 'S' ELSE 'r' END,c.relowner
      ))
    ) acl
     WHERE n.nspname IN ('app','app_private') AND acl.grantee=v_role
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(a.attacl) acl
     WHERE n.nspname IN ('app','app_private') AND acl.grantee=v_role
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))
    ) acl
     WHERE n.nspname IN ('app','app_private') AND acl.grantee=v_role
  ) THEN
    RAISE EXCEPTION 'session role has direct protected object privilege'
      USING ERRCODE='42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))
    ) acl
     WHERE n.nspname IN ('app','app_private') AND acl.grantee=0
       AND acl.privilege_type IN
         ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')
  ) THEN
    RAISE EXCEPTION 'PUBLIC has protected relation privilege' USING ERRCODE='42501';
  END IF;

  PERFORM app_private.assert_protected_owner_closure_r3(p_role_name);
END
$$;

CREATE OR REPLACE FUNCTION app_private.assert_active_session(
  p_session_id text,
  p_principal_id text,
  p_login_epoch bigint
) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_role_kind text;
  v_capability_role text;
  v_expected_digest text;
  v_current_digest text;
BEGIN
  PERFORM 1
    FROM app.trusted_session ts
    JOIN app.session_role_registry reg
      ON reg.role_name=ts.db_auth_role AND reg.session_id=ts.session_id
    JOIN app.principal_epoch pe ON pe.principal_id=ts.principal_id
   WHERE ts.session_id=p_session_id
     AND ts.principal_id=p_principal_id
     AND ts.login_epoch=p_login_epoch
     AND pe.current_epoch=p_login_epoch
     AND ts.state='ACTIVE'
     AND ts.binding_state='ACTIVE'
     AND ts.db_auth_role=session_user
     AND ts.backend_pid=pg_catalog.pg_backend_pid()
     AND ts.backend_started_at=(
       SELECT a.backend_start FROM pg_catalog.pg_stat_activity a
        WHERE a.pid=pg_catalog.pg_backend_pid() AND a.usename=session_user
     )
     AND pg_catalog.current_setting('aiea.session_binding',true)=ts.session_id
     AND clock_timestamp()<ts.expires_at
     AND reg.state='ACTIVE'
   FOR SHARE OF ts,reg;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'trusted session changed' USING ERRCODE='42501';
  END IF;
  SELECT reg.role_kind,reg.capability_role
    INTO STRICT v_role_kind,v_capability_role
    FROM app.session_role_registry reg
   WHERE reg.role_name=session_user AND reg.session_id=p_session_id;
  v_expected_digest := pg_catalog.current_setting('aiea.owner_closure_digest',true);
  IF v_expected_digest IS NULL THEN
    RAISE EXCEPTION 'owner closure transaction guard absent' USING ERRCODE='42501';
  END IF;
  PERFORM app_private.validate_session_role_r3(
    session_user,v_role_kind,v_capability_role
  );
  v_current_digest := app_private.owner_closure_digest_r2(session_user);
  IF v_current_digest<>v_expected_digest THEN
    RAISE EXCEPTION 'owner closure changed during transaction' USING ERRCODE='40001';
  END IF;
END
$$;

-- ===== END R3-C8 CORRECTIONS R2 OVERLAY =====

-- ===== END TRANSFORMED FROZEN R3-C8 CORRECTIONS R2 DDL =====

-- ===== BEGIN R3-C8 CORRECTIONS R3 OVERLAY =====
-- FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS-R3
-- Final-state overlay. DESIGN ONLY. Do not execute.

-- The R3 generator first removes the five known-invalid R2 FK definitions and
-- adds candidate_id columns needed by the two ProfessionalReview source FKs.

-- ===========================================================================
-- 1. Bootstrap Generation history and recovery constraints
-- ===========================================================================

ALTER TABLE app.bootstrap_state_r3
  DROP CONSTRAINT IF EXISTS bootstrap_state_r3_check;
ALTER TABLE app.bootstrap_state_r3
  ADD CONSTRAINT bootstrap_state_r3_state_check_r3 CHECK (
    (state='PREPARED'
      AND completed_at IS NULL AND root_grant_id IS NULL)
    OR (state='COMPLETE'
      AND completed_at IS NOT NULL AND root_grant_id IS NOT NULL)
    OR (state='FAILED'
      AND completed_at IS NULL AND root_grant_id IS NULL)
  );

ALTER TABLE app.bootstrap_approval_r2
  ADD CONSTRAINT bootstrap_approval_generation_identity_fk_r3
    FOREIGN KEY (
      bootstrap_id,bootstrap_generation,root_principal_id
    ) REFERENCES app.bootstrap_generation_r2(
      bootstrap_id,bootstrap_generation,root_principal_id
    ) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE app.bootstrap_root_session_r2
  ADD CONSTRAINT bootstrap_root_session_generation_history_fk_r3
    FOREIGN KEY (
      bootstrap_id,bootstrap_generation,root_principal_id,root_role_name
    ) REFERENCES app.bootstrap_generation_r2(
      bootstrap_id,bootstrap_generation,root_principal_id,root_role_name
    ) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE app.bootstrap_lifecycle_r2
  DROP CONSTRAINT IF EXISTS
    bootstrap_lifecycle_r2_bootstrap_id_bootstrap_generation_fkey;
ALTER TABLE app.bootstrap_lifecycle_r2
  ADD CONSTRAINT bootstrap_lifecycle_generation_fk_r3
    FOREIGN KEY (bootstrap_id,bootstrap_generation)
    REFERENCES app.bootstrap_generation_r2(
      bootstrap_id,bootstrap_generation
    ) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE app.bootstrap_recovery_r2
  ADD COLUMN approval_expires_at timestamptz(6) NOT NULL,
  ADD CONSTRAINT bootstrap_recovery_one_per_generation_r3
    UNIQUE (bootstrap_id,from_generation),
  ADD CONSTRAINT bootstrap_recovery_expiry_check_r3
    CHECK (approval_expires_at>requested_at);

CREATE TABLE app.bootstrap_issuance_attempt_r3 (
  bootstrap_id boolean NOT NULL,
  bootstrap_generation bigint NOT NULL,
  state text NOT NULL CHECK (
    state IN ('PENDING','SESSION_CREATED','GRANT_CREATED','ISSUED','FAILED')
  ),
  root_principal_id text NOT NULL,
  root_role_name text NOT NULL,
  root_session_id text,
  root_grant_id text,
  request_id text,
  started_at timestamptz(6) NOT NULL,
  completed_at timestamptz(6),
  failure_code text,
  PRIMARY KEY (bootstrap_id,bootstrap_generation),
  FOREIGN KEY (
    bootstrap_id,bootstrap_generation,root_principal_id,root_role_name
  ) REFERENCES app.bootstrap_generation_r2(
    bootstrap_id,bootstrap_generation,root_principal_id,root_role_name
  ),
  CHECK (
    (state IN ('PENDING','SESSION_CREATED','GRANT_CREATED','ISSUED')
      AND failure_code IS NULL)
    OR (state='FAILED' AND failure_code IS NOT NULL)
  ),
  CHECK (state<>'ISSUED' OR completed_at IS NOT NULL)
);

CREATE OR REPLACE FUNCTION app_private.a_create_bootstrap_issuance_attempt_r3()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  INSERT INTO app.bootstrap_issuance_attempt_r3(
    bootstrap_id,bootstrap_generation,state,root_principal_id,
    root_role_name,started_at
  ) VALUES(
    NEW.bootstrap_id,NEW.bootstrap_generation,'PENDING',
    NEW.root_principal_id,NEW.root_role_name,clock_timestamp()
  );
  RETURN NEW;
END
$$;

CREATE TRIGGER a_create_bootstrap_issuance_attempt_r3
AFTER INSERT ON app.bootstrap_generation_r2
FOR EACH ROW EXECUTE FUNCTION app_private.a_create_bootstrap_issuance_attempt_r3();

CREATE OR REPLACE FUNCTION app_private.claim_bootstrap_request_r2(
  p_operation text,
  p_request_id text,
  p_request_hash text,
  p_bootstrap_id boolean,
  p_generation bigint,
  p_actor_role text,
  p_actor_principal_id text,
  p_result_type text
) RETURNS TABLE(replay boolean,result_id text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  r app.bootstrap_request_ledger_r2%ROWTYPE;
  v_inserted boolean;
BEGIN
  SELECT * INTO r
    FROM app.bootstrap_request_ledger_r2
   WHERE operation=p_operation AND request_id=p_request_id
   FOR UPDATE;
  IF FOUND THEN
    IF r.request_hash<>p_request_hash
       OR r.bootstrap_id<>p_bootstrap_id
       OR r.actor_role<>p_actor_role
       OR r.actor_principal_id<>p_actor_principal_id
       OR r.result_type<>p_result_type THEN
      RAISE EXCEPTION 'bootstrap request identity conflict' USING ERRCODE='40001';
    END IF;
    IF r.state<>'COMPLETED' THEN
      RAISE EXCEPTION 'bootstrap request already in progress' USING ERRCODE='40001';
    END IF;
    RETURN QUERY SELECT true,r.result_id;
    RETURN;
  END IF;
  INSERT INTO app.bootstrap_request_ledger_r2(
    operation,request_id,request_hash,bootstrap_id,bootstrap_generation,
    actor_role,actor_principal_id,result_type,state,claimed_at
  ) VALUES(
    p_operation,p_request_id,p_request_hash,p_bootstrap_id,p_generation,
    p_actor_role,p_actor_principal_id,p_result_type,'CLAIMED',clock_timestamp()
  )
  ON CONFLICT (operation,request_id) DO NOTHING
  RETURNING true INTO v_inserted;
  IF NOT v_inserted THEN
    RAISE EXCEPTION 'bootstrap request raced' USING ERRCODE='40001';
  END IF;
  RETURN QUERY SELECT false,NULL::text;
END
$$;

-- ===========================================================================
-- 2. Catalog Source / Binding / Event exact identity
-- ===========================================================================

CREATE OR REPLACE FUNCTION app_private.a_bind_catalog_source_evidence_r3()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  sr app.catalog_source_revision%ROWTYPE;
BEGIN
  SELECT * INTO STRICT sr FROM app.catalog_source_revision
   WHERE id=NEW.source_revision_id FOR SHARE;
  IF TG_OP='UPDATE'
     AND (NEW.source_evidence_object_id IS DISTINCT FROM OLD.source_evidence_object_id
       OR NEW.source_content_digest IS DISTINCT FROM OLD.source_content_digest) THEN
    RAISE EXCEPTION 'catalog source evidence is immutable' USING ERRCODE='23514';
  END IF;
  NEW.source_evidence_object_id:=sr.evidence_object_id;
  NEW.source_content_digest:=sr.raw_content_digest;
  RETURN NEW;
END
$$;

CREATE TRIGGER a_bind_catalog_source_evidence_r3
BEFORE INSERT OR UPDATE ON app.catalog_source_target_binding_r2
FOR EACH ROW EXECUTE FUNCTION app_private.a_bind_catalog_source_evidence_r3();

CREATE OR REPLACE FUNCTION app_private.a_bind_catalog_event_binding_r3()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  b app.catalog_source_target_binding_r2%ROWTYPE;
  v_target_id text;
  v_target_digest text;
BEGIN
  SELECT * INTO STRICT b FROM app.catalog_source_target_binding_r2
   WHERE id=NEW.source_target_binding_id FOR SHARE;
  v_target_id := CASE NEW.target_kind
    WHEN 'PRODUCT_REVISION' THEN b.product_revision_id
    WHEN 'SPECIFICATION_REVISION' THEN b.specification_revision_id
    ELSE b.price_revision_id END;
  v_target_digest := CASE NEW.target_kind
    WHEN 'PRODUCT_REVISION' THEN b.product_revision_digest
    WHEN 'SPECIFICATION_REVISION' THEN b.specification_revision_digest
    ELSE b.price_fact_digest END;
  IF NEW.source_target_binding_id IS DISTINCT FROM b.id
     OR NEW.source_target_binding_digest IS DISTINCT FROM b.binding_digest
     OR NEW.project_id IS DISTINCT FROM b.project_id
     OR NEW.target_kind IS DISTINCT FROM b.target_kind
     OR NEW.product_id IS DISTINCT FROM b.product_id
     OR NEW.product_revision_id IS DISTINCT FROM b.product_revision_id
     OR NEW.product_revision_digest IS DISTINCT FROM b.product_revision_digest
     OR NEW.specification_revision_id IS DISTINCT FROM b.specification_revision_id
     OR NEW.specification_revision_digest IS DISTINCT FROM b.specification_revision_digest
     OR NEW.price_revision_id IS DISTINCT FROM b.price_revision_id
     OR NEW.price_fact_digest IS DISTINCT FROM b.price_fact_digest
     OR NEW.source_revision_id IS DISTINCT FROM b.source_revision_id
     OR (NEW.target_kind='PRODUCT_REVISION' AND NEW.product_revision_id<>v_target_id)
     OR (NEW.target_kind='SPECIFICATION_REVISION' AND NEW.specification_revision_id<>v_target_id)
     OR (NEW.target_kind='PRICE_REVISION' AND NEW.price_revision_id<>v_target_id)
     OR (NEW.target_kind NOT IN ('PRODUCT_REVISION','SPECIFICATION_REVISION','PRICE_REVISION')) THEN
    RAISE EXCEPTION 'catalog event binding mismatch' USING ERRCODE='23514';
  END IF;
  NEW.source_target_binding_digest:=b.binding_digest;
  NEW.project_id:=b.project_id;
  NEW.target_kind:=b.target_kind;
  NEW.product_id:=b.product_id;
  NEW.product_revision_id:=b.product_revision_id;
  NEW.product_revision_digest:=b.product_revision_digest;
  NEW.specification_revision_id:=b.specification_revision_id;
  NEW.specification_revision_digest:=b.specification_revision_digest;
  NEW.price_revision_id:=b.price_revision_id;
  NEW.price_fact_digest:=b.price_fact_digest;
  NEW.source_revision_id:=b.source_revision_id;
  RETURN NEW;
END
$$;

CREATE TRIGGER a_bind_catalog_event_binding_r3
BEFORE INSERT OR UPDATE ON app.catalog_review_event_r3
FOR EACH ROW EXECUTE FUNCTION app_private.a_bind_catalog_event_binding_r3();

ALTER TABLE app.authority_grant
  ADD CONSTRAINT authority_grant_session_id_principal_unique_r3
    UNIQUE (session_id,id,principal_id);

ALTER TABLE app.catalog_source_target_binding_r2
  ADD CONSTRAINT catalog_binding_actor_grant_fk_r3
    FOREIGN KEY (
      created_by_session_id,created_by_authority_grant_id,
      created_by_principal_id
    ) REFERENCES app.authority_grant(
      session_id,id,principal_id
    ) DEFERRABLE INITIALLY DEFERRED;

-- ===========================================================================
-- 3. Owner closure lock
-- ===========================================================================

CREATE OR REPLACE FUNCTION app_private.lock_owner_catalog_r3()
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog
AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('AIEA:owner-catalog:v3',0)
  );
END
$$;

CREATE OR REPLACE FUNCTION app_private.assert_protected_owner_closure_r3(
  p_role_name text
) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  PERFORM app_private.lock_owner_catalog_r3();
  -- The R2 closure checks remain authoritative; this wrapper establishes the
  -- lock before invoking the already-defined owner checks.
  RETURN app_private.assert_protected_owner_closure_r2(p_role_name);
END
$$;

-- ===========================================================================
-- 4. Root issuance with active-principal checks and attempt tracking
-- ===========================================================================

CREATE OR REPLACE FUNCTION app.bootstrap_complete_root_r3(
  p_bootstrap_id boolean,
  p_root_token text,
  p_request_id text,
  p_request_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  st app.bootstrap_state_r3%ROWTYPE;
  lc app.bootstrap_lifecycle_r2%ROWTYPE;
  rootop app.bootstrap_operator_r3%ROWTYPE;
  v_backend_start timestamptz;
  v_session_id text:='bootstrap:'||gen_random_uuid()::text;
  v_grant_id text:='bootstrap-grant:'||gen_random_uuid()::text;
  v_epoch bigint;
  v_hash text;
  v_replay boolean;
  v_result text;
  v_mapping_digest text;
BEGIN
  PERFORM app_private.validate_session_role_r3(
    session_user,'ROOT_ISSUER','elevator_root_issuer'
  );
  SELECT * INTO STRICT st FROM app.bootstrap_state_r3
   WHERE singleton=p_bootstrap_id FOR UPDATE;
  SELECT * INTO STRICT lc FROM app.bootstrap_lifecycle_r2
   WHERE bootstrap_id=p_bootstrap_id
     AND bootstrap_generation=st.bootstrap_generation
   FOR UPDATE;
  SELECT * INTO STRICT rootop FROM app.bootstrap_operator_r3
   WHERE role_name=session_user
     AND operator_kind='ROOT'
     AND principal_id=st.root_principal_id
     AND role_name=st.root_role_name
     AND enabled
   FOR SHARE;
  IF NOT app_private.session_token_digest(p_root_token)=st.root_token_digest THEN
    RAISE EXCEPTION 'root bootstrap token invalid' USING ERRCODE='42501';
  END IF;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','BOOTSTRAP_COMPLETE_ROOT','bootstrapId',p_bootstrap_id,
    'generation',st.bootstrap_generation,
    'rootPrincipalId',st.root_principal_id,
    'rootRoleName',st.root_role_name,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result
    FROM app_private.claim_bootstrap_request_r2(
      'BOOTSTRAP_COMPLETE_ROOT',p_request_id,v_hash,p_bootstrap_id,
      st.bootstrap_generation,session_user,rootop.principal_id,
      'BOOTSTRAP_ROOT_GRANT'
    );
  IF v_replay THEN
    PERFORM 1 FROM app.bootstrap_root_grant_r2 g
     WHERE g.root_grant_id=v_result
       AND g.bootstrap_id=p_bootstrap_id
       AND g.bootstrap_generation=st.bootstrap_generation
       AND g.root_principal_id=rootop.principal_id
       AND g.issuer_principal_id=rootop.principal_id
       AND g.root_role_name=session_user;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'bootstrap replay identity mismatch' USING ERRCODE='42501';
    END IF;
    RETURN;
  END IF;
  IF lc.state<>'ROOT_ISSUANCE_PENDING' THEN
    RAISE EXCEPTION 'bootstrap root issuance state invalid' USING ERRCODE='40001';
  END IF;
  IF lc.root_principal_id<>st.root_principal_id
     OR lc.root_role_name<>st.root_role_name THEN
    RAISE EXCEPTION 'bootstrap state/lifecycle Principal mismatch'
      USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM app.trusted_principal p
   WHERE p.id=st.root_principal_id AND p.state='ACTIVE' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'root Principal is not active' USING ERRCODE='42501';
  END IF;
  IF (SELECT count(*) FROM app.bootstrap_approval_r2 a
       WHERE a.bootstrap_id=p_bootstrap_id
         AND a.bootstrap_generation=st.bootstrap_generation)<>2
     OR (SELECT count(DISTINCT a.principal_id)
           FROM app.bootstrap_approval_r2 a
          WHERE a.bootstrap_id=p_bootstrap_id
            AND a.bootstrap_generation=st.bootstrap_generation)<>2
     OR EXISTS (
       SELECT 1
         FROM app.bootstrap_approval_r2 a
         JOIN app.bootstrap_operator_r3 o
           ON o.role_name=a.role_name
          AND o.operator_kind=a.operator_kind
          AND o.principal_id=a.principal_id
         JOIN app.trusted_principal p ON p.id=a.principal_id
        WHERE a.bootstrap_id=p_bootstrap_id
          AND a.bootstrap_generation=st.bootstrap_generation
          AND (a.principal_id=st.root_principal_id
               OR NOT o.enabled OR p.state<>'ACTIVE')
     ) THEN
    RAISE EXCEPTION 'bootstrap requires two active distinct non-root approvals'
      USING ERRCODE='42501';
  END IF;
  SELECT a.backend_start INTO v_backend_start
    FROM pg_catalog.pg_stat_activity a
   WHERE a.pid=pg_catalog.pg_backend_pid() AND a.usename=session_user;
  IF v_backend_start IS NULL THEN
    RAISE EXCEPTION 'root bootstrap backend identity unavailable' USING ERRCODE='42501';
  END IF;
  SELECT current_epoch INTO v_epoch FROM app.principal_epoch
   WHERE principal_id=st.root_principal_id FOR UPDATE;
  IF v_epoch IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'bootstrap root epoch invalid' USING ERRCODE='40001';
  END IF;
  INSERT INTO app.session_role_registry(
    role_name,role_kind,capability_role,activation_token_digest,state,
    session_id,provisioned_at,assigned_at
  ) VALUES(
    session_user,'ROOT_ISSUER','elevator_root_issuer',st.root_token_digest,
    'ASSIGNED',v_session_id,clock_timestamp(),clock_timestamp()
  )
  ON CONFLICT (role_name) DO UPDATE
    SET state='ASSIGNED',session_id=EXCLUDED.session_id,
        assigned_at=EXCLUDED.assigned_at
    WHERE app.session_role_registry.state='AVAILABLE';
  UPDATE app.session_role_registry
     SET state='ACTIVE'
   WHERE role_name=session_user AND session_id=v_session_id;
  INSERT INTO app.trusted_session(
    session_id,principal_id,login_epoch,db_auth_role,audience,issuer,
    assertion_id,assertion_digest,issued_at,not_before,expires_at,
    state,binding_state,backend_pid,backend_started_at,activated_at,
    last_verified_at,binding_digest,created_at,termination_class
  ) VALUES(
    v_session_id,st.root_principal_id,v_epoch,session_user,'bootstrap',
    'database-bootstrap',p_request_id,st.root_token_digest,
    clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '15 minutes',
    'ACTIVE','ACTIVE',pg_catalog.pg_backend_pid(),v_backend_start,
    clock_timestamp(),clock_timestamp(),
    app_private.sha256_hex(convert_to(
      v_session_id||':'||pg_catalog.pg_backend_pid()::text,'UTF8'
    )),
    clock_timestamp(),'NONE'
  );
  UPDATE app.bootstrap_issuance_attempt_r3
     SET state='SESSION_CREATED',root_session_id=v_session_id,
         request_id=p_request_id
   WHERE bootstrap_id=p_bootstrap_id
     AND bootstrap_generation=st.bootstrap_generation
     AND state='PENDING';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'bootstrap issuance attempt unavailable' USING ERRCODE='40001';
  END IF;
  INSERT INTO app.bootstrap_root_session_r2(
    bootstrap_id,bootstrap_generation,session_id,root_principal_id,
    root_role_name,state,issued_at
  ) VALUES(
    p_bootstrap_id,st.bootstrap_generation,v_session_id,
    st.root_principal_id,session_user,'ACTIVE',clock_timestamp()
  );
  INSERT INTO app.authority_grant(
    id,principal_id,session_id,subject_principal_id,object_scope,
    authority_code,project_id,policy_id,policy_revision_id,
    valid_from,valid_until,created_at
  ) VALUES(
    v_grant_id,st.root_principal_id,v_session_id,NULL,'GLOBAL',
    'AUTHORITY_ISSUE',NULL,NULL,NULL,clock_timestamp(),
    clock_timestamp()+interval '15 minutes',clock_timestamp()
  );
  UPDATE app.bootstrap_issuance_attempt_r3
     SET state='GRANT_CREATED',root_grant_id=v_grant_id
   WHERE bootstrap_id=p_bootstrap_id
     AND bootstrap_generation=st.bootstrap_generation;
  v_mapping_digest:=app_private.bootstrap_root_grant_digest_r2(
    p_bootstrap_id,st.bootstrap_generation,v_grant_id,v_session_id,
    st.root_principal_id,session_user,st.bootstrap_generation
  );
  INSERT INTO app.bootstrap_root_grant_r2(
    bootstrap_id,bootstrap_generation,root_grant_id,root_session_id,
    root_principal_id,root_role_name,issuer_principal_id,grant_version,
    mapping_digest,created_at
  ) VALUES(
    p_bootstrap_id,st.bootstrap_generation,v_grant_id,v_session_id,
    st.root_principal_id,session_user,st.root_principal_id,
    st.bootstrap_generation,v_mapping_digest,clock_timestamp()
  );
  UPDATE app.bootstrap_lifecycle_r2
     SET state=CASE WHEN st.bootstrap_generation=1
                    THEN 'BOOTSTRAP_COMPLETED' ELSE 'ROOT_ROTATED' END,
         state_revision=state_revision+1,
         root_session_id=v_session_id,root_grant_id=v_grant_id,
         updated_at=clock_timestamp()
   WHERE bootstrap_id=p_bootstrap_id
     AND bootstrap_generation=st.bootstrap_generation;
  UPDATE app.bootstrap_state_r3
     SET state='COMPLETE',completed_at=clock_timestamp(),
         root_grant_id=v_grant_id,root_session_id=v_session_id,
         root_grant_issuer_principal_id=st.root_principal_id
   WHERE singleton=p_bootstrap_id;
  UPDATE app.bootstrap_issuance_attempt_r3
     SET state='ISSUED',completed_at=clock_timestamp()
   WHERE bootstrap_id=p_bootstrap_id
     AND bootstrap_generation=st.bootstrap_generation;
  PERFORM app_private.append_bootstrap_event_r2(
    CASE WHEN st.bootstrap_generation=1 THEN 'BOOTSTRAP_COMPLETED'
         ELSE 'ROOT_ROTATED' END,
    p_bootstrap_id,st.bootstrap_generation,session_user,
    st.root_principal_id,v_session_id,v_grant_id
  );
  PERFORM app_private.complete_bootstrap_request_r2(
    'BOOTSTRAP_COMPLETE_ROOT',p_request_id,v_grant_id
  );
  PERFORM pg_catalog.set_config('aiea.session_binding',v_session_id,false);
END
$$;

-- ===========================================================================
-- 5. Replay-first Bootstrap recovery and rotation
-- ===========================================================================

CREATE OR REPLACE FUNCTION app.bootstrap_begin_root_change_r2(
  p_recovery_id text,
  p_bootstrap_id boolean,
  p_kind text,
  p_reason_class text,
  p_target_root_principal_id text,
  p_target_root_role_name text,
  p_target_token_digest text,
  p_request_id text,
  p_request_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  lc app.bootstrap_lifecycle_r2%ROWTYPE;
  op app.bootstrap_operator_r3%ROWTYPE;
  v_backend_start timestamptz;
  v_hash text;
  v_replay boolean;
  v_result text;
  v_digest text;
BEGIN
  IF p_kind NOT IN ('RECOVERY','ROTATION') THEN
    RAISE EXCEPTION 'root change kind invalid' USING ERRCODE='22023';
  END IF;
  PERFORM app_private.validate_session_role_r3(
    session_user,'BOOTSTRAP_INITIATOR','elevator_bootstrap_initiator'
  );
  SELECT * INTO STRICT lc FROM app.bootstrap_lifecycle_r2
   WHERE bootstrap_id=p_bootstrap_id FOR UPDATE;
  SELECT * INTO STRICT op FROM app.bootstrap_operator_r3
   WHERE role_name=session_user
     AND operator_kind='INITIATOR'
     AND principal_id<>lc.root_principal_id
     AND principal_id<>p_target_root_principal_id
     AND enabled
   FOR SHARE;
  v_hash := app_private.r6_request_hash(jsonb_build_object(
    'operation','BOOTSTRAP_BEGIN_ROOT_CHANGE','recoveryId',p_recovery_id,
    'bootstrapId',p_bootstrap_id,'kind',p_kind,
    'reasonClass',p_reason_class,
    'targetRootPrincipalId',p_target_root_principal_id,
    'targetRootRoleName',p_target_root_role_name,
    'targetTokenDigest',p_target_token_digest,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result
    FROM app_private.claim_bootstrap_request_r2(
      'BOOTSTRAP_BEGIN_ROOT_CHANGE',p_request_id,v_hash,p_bootstrap_id,
      lc.bootstrap_generation,session_user,op.principal_id,'BOOTSTRAP_RECOVERY'
    );
  IF v_replay THEN
    RETURN;
  END IF;
  IF p_kind='ROTATION' THEN
    IF lc.state NOT IN ('BOOTSTRAP_COMPLETED','ROOT_ROTATED') THEN
      RAISE EXCEPTION 'valid root required for rotation' USING ERRCODE='42501';
    END IF;
    PERFORM 1
      FROM app.bootstrap_root_session_r2 s
      JOIN app.trusted_session ts ON ts.session_id=s.session_id
      JOIN app.bootstrap_root_grant_r2 g ON g.root_grant_id=lc.root_grant_id
      JOIN app.authority_grant ag ON ag.id=g.root_grant_id
     WHERE s.bootstrap_id=p_bootstrap_id
       AND s.bootstrap_generation=lc.bootstrap_generation
       AND s.state='ACTIVE' AND ts.state='ACTIVE'
       AND ag.revoked_at IS NULL
       AND (ag.valid_until IS NULL OR clock_timestamp()<ag.valid_until);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'root rotation requires active root authority'
        USING ERRCODE='42501';
    END IF;
  ELSIF lc.state NOT IN (
    'BOOTSTRAP_COMPLETED','ROOT_ROTATED','LOCKED','ROOT_ISSUANCE_PENDING'
  ) THEN
    RAISE EXCEPTION 'root recovery state invalid' USING ERRCODE='40001';
  END IF;
  IF p_target_root_principal_id=lc.root_principal_id
     OR p_target_root_role_name=lc.root_role_name THEN
    RAISE EXCEPTION 'root change requires a new Principal and role'
      USING ERRCODE='42501';
  END IF;
  SELECT a.backend_start INTO v_backend_start
    FROM pg_catalog.pg_stat_activity a
   WHERE a.pid=pg_catalog.pg_backend_pid() AND a.usename=session_user;
  IF v_backend_start IS NULL THEN
    RAISE EXCEPTION 'root change backend identity unavailable' USING ERRCODE='42501';
  END IF;
  v_digest:=app_private.bootstrap_recovery_digest_r2(jsonb_build_object(
    'id',p_recovery_id,'bootstrap_id',p_bootstrap_id,
    'from_generation',lc.bootstrap_generation,'kind',p_kind,
    'reason_class',p_reason_class,
    'current_root_principal_id',lc.root_principal_id,
    'target_root_principal_id',p_target_root_principal_id,
    'target_root_role_name',p_target_root_role_name,
    'target_token_digest',p_target_token_digest,
    'requested_by_role',session_user,
    'requested_by_principal_id',op.principal_id
  ));
  INSERT INTO app.bootstrap_recovery_r2(
    id,bootstrap_id,from_generation,kind,reason_class,state,
    current_root_principal_id,target_root_principal_id,target_root_role_name,
    target_token_digest,requested_by_role,requested_by_principal_id,
    requested_at,approval_expires_at,request_id,request_hash,content_digest
  ) VALUES(
    p_recovery_id,p_bootstrap_id,lc.bootstrap_generation,p_kind,p_reason_class,
    'PENDING',lc.root_principal_id,p_target_root_principal_id,
    p_target_root_role_name,p_target_token_digest,session_user,op.principal_id,
    clock_timestamp(),clock_timestamp()+interval '30 minutes',
    p_request_id,v_hash,v_digest
  );
  INSERT INTO app.bootstrap_recovery_approval_r2(
    recovery_id,operator_kind,role_name,principal_id,backend_pid,
    backend_started_at,approved_at,request_id,request_hash
  ) VALUES(
    p_recovery_id,'INITIATOR',session_user,op.principal_id,
    pg_catalog.pg_backend_pid(),v_backend_start,clock_timestamp(),
    p_request_id,v_hash
  );
  UPDATE app.bootstrap_lifecycle_r2
     SET state=CASE p_kind WHEN 'ROTATION' THEN 'ROOT_ROTATION_PENDING'
                           ELSE 'RECOVERY_PENDING' END,
         recovery_request_id=p_recovery_id,
         state_revision=state_revision+1,
         updated_at=clock_timestamp()
   WHERE bootstrap_id=p_bootstrap_id
     AND bootstrap_generation=lc.bootstrap_generation;
  PERFORM app_private.append_bootstrap_event_r2(
    CASE p_kind WHEN 'ROTATION' THEN 'ROTATION_REQUESTED'
                ELSE 'RECOVERY_REQUESTED' END,
    p_bootstrap_id,lc.bootstrap_generation,session_user,op.principal_id,
    NULL,NULL
  );
  PERFORM app_private.complete_bootstrap_request_r2(
    'BOOTSTRAP_BEGIN_ROOT_CHANGE',p_request_id,p_recovery_id
  );
END
$$;

CREATE OR REPLACE FUNCTION app.bootstrap_approve_root_change_r2(
  p_recovery_id text,
  p_request_id text,
  p_request_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  rr app.bootstrap_recovery_r2%ROWTYPE;
  op app.bootstrap_operator_r3%ROWTYPE;
  v_backend_start timestamptz;
  v_hash text;
  v_replay boolean;
  v_result text;
  v_count integer;
BEGIN
  PERFORM app_private.validate_session_role_r3(
    session_user,'BOOTSTRAP_APPROVER','elevator_bootstrap_approver'
  );
  SELECT * INTO STRICT rr FROM app.bootstrap_recovery_r2
   WHERE id=p_recovery_id FOR UPDATE;
  SELECT * INTO STRICT op FROM app.bootstrap_operator_r3
   WHERE role_name=session_user
     AND operator_kind='APPROVER'
     AND principal_id<>rr.current_root_principal_id
     AND principal_id<>rr.requested_by_principal_id
     AND principal_id<>rr.target_root_principal_id
     AND enabled
   FOR SHARE;
  v_hash:=app_private.r6_request_hash(jsonb_build_object(
    'operation','BOOTSTRAP_APPROVE_ROOT_CHANGE','recoveryId',p_recovery_id,
    'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result
    FROM app_private.claim_bootstrap_request_r2(
      'BOOTSTRAP_APPROVE_ROOT_CHANGE',p_request_id,v_hash,rr.bootstrap_id,
      rr.from_generation,session_user,op.principal_id,'BOOTSTRAP_RECOVERY'
    );
  IF v_replay THEN RETURN; END IF;
  IF rr.state<>'PENDING' THEN
    RAISE EXCEPTION 'root change is not approval-pending' USING ERRCODE='40001';
  END IF;
  IF clock_timestamp()>=rr.approval_expires_at THEN
    UPDATE app.bootstrap_recovery_r2 SET state='LOCKED' WHERE id=p_recovery_id;
    UPDATE app.bootstrap_lifecycle_r2
       SET state='LOCKED',state_revision=state_revision+1,
           updated_at=clock_timestamp()
     WHERE bootstrap_id=rr.bootstrap_id
       AND bootstrap_generation=rr.from_generation;
    RAISE EXCEPTION 'root change approval expired' USING ERRCODE='40001';
  END IF;
  SELECT a.backend_start INTO v_backend_start
    FROM pg_catalog.pg_stat_activity a
   WHERE a.pid=pg_catalog.pg_backend_pid() AND a.usename=session_user;
  IF v_backend_start IS NULL THEN
    RAISE EXCEPTION 'root change backend identity unavailable' USING ERRCODE='42501';
  END IF;
  INSERT INTO app.bootstrap_recovery_approval_r2(
    recovery_id,operator_kind,role_name,principal_id,backend_pid,
    backend_started_at,approved_at,request_id,request_hash
  ) VALUES(
    p_recovery_id,'APPROVER',session_user,op.principal_id,
    pg_catalog.pg_backend_pid(),v_backend_start,clock_timestamp(),
    p_request_id,v_hash
  );
  SELECT count(*) INTO v_count
    FROM app.bootstrap_recovery_approval_r2
   WHERE recovery_id=p_recovery_id;
  IF v_count=2 THEN
    UPDATE app.bootstrap_recovery_r2
       SET state='APPROVED',approved_at=clock_timestamp()
     WHERE id=p_recovery_id;
    UPDATE app.bootstrap_lifecycle_r2
       SET state=CASE rr.kind WHEN 'ROTATION' THEN 'ROOT_ROTATION_PENDING'
                              ELSE 'RECOVERY_APPROVED' END,
           state_revision=state_revision+1,
           updated_at=clock_timestamp()
     WHERE bootstrap_id=rr.bootstrap_id
       AND bootstrap_generation=rr.from_generation;
  END IF;
  PERFORM app_private.append_bootstrap_event_r2(
    CASE rr.kind WHEN 'ROTATION' THEN 'ROTATION_APPROVED'
                 ELSE 'RECOVERY_APPROVED' END,
    rr.bootstrap_id,rr.from_generation,session_user,op.principal_id,NULL,NULL
  );
  PERFORM app_private.complete_bootstrap_request_r2(
    'BOOTSTRAP_APPROVE_ROOT_CHANGE',p_request_id,p_recovery_id
  );
END
$$;

CREATE OR REPLACE FUNCTION app.bootstrap_execute_root_change_r2(
  p_recovery_id text,
  p_request_id text,
  p_request_key text
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  rr app.bootstrap_recovery_r2%ROWTYPE;
  lc app.bootstrap_lifecycle_r2%ROWTYPE;
  v_hash text;
  v_replay boolean;
  v_result text;
  v_new_generation bigint;
  v_initiator app.bootstrap_recovery_approval_r2%ROWTYPE;
  v_approver app.bootstrap_recovery_approval_r2%ROWTYPE;
BEGIN
  IF session_user<>'elevator_session_bootstrap_seed' THEN
    RAISE EXCEPTION 'bootstrap seed role required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO STRICT rr FROM app.bootstrap_recovery_r2
   WHERE id=p_recovery_id FOR UPDATE;
  v_hash:=app_private.r6_request_hash(jsonb_build_object(
    'operation','BOOTSTRAP_EXECUTE_ROOT_CHANGE','recoveryId',p_recovery_id,
    'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result
    FROM app_private.claim_bootstrap_request_r2(
      'BOOTSTRAP_EXECUTE_ROOT_CHANGE',p_request_id,v_hash,rr.bootstrap_id,
      rr.from_generation,session_user,rr.requested_by_principal_id,
      'BOOTSTRAP_GENERATION'
    );
  IF v_replay THEN
    RETURN v_result::bigint;
  END IF;
  IF rr.state<>'APPROVED' THEN
    RAISE EXCEPTION 'root change lacks two approvals' USING ERRCODE='42501';
  END IF;
  IF clock_timestamp()>=rr.approval_expires_at THEN
    UPDATE app.bootstrap_recovery_r2 SET state='LOCKED' WHERE id=p_recovery_id;
    UPDATE app.bootstrap_lifecycle_r2
       SET state='LOCKED',state_revision=state_revision+1,
           updated_at=clock_timestamp()
     WHERE bootstrap_id=rr.bootstrap_id
       AND bootstrap_generation=rr.from_generation;
    RAISE EXCEPTION 'root change approval expired' USING ERRCODE='40001';
  END IF;
  SELECT * INTO STRICT lc FROM app.bootstrap_lifecycle_r2
   WHERE bootstrap_id=rr.bootstrap_id
     AND bootstrap_generation=rr.from_generation
   FOR UPDATE;
  IF lc.state NOT IN (
    'RECOVERY_APPROVED','ROOT_ROTATION_PENDING','ROOT_ISSUANCE_PENDING'
  ) THEN
    RAISE EXCEPTION 'root change lifecycle state invalid' USING ERRCODE='40001';
  END IF;
  SELECT * INTO STRICT v_initiator FROM app.bootstrap_recovery_approval_r2
   WHERE recovery_id=p_recovery_id AND operator_kind='INITIATOR';
  SELECT * INTO STRICT v_approver FROM app.bootstrap_recovery_approval_r2
   WHERE recovery_id=p_recovery_id AND operator_kind='APPROVER';
  IF v_initiator.principal_id=v_approver.principal_id
     OR v_initiator.principal_id IN (
       rr.current_root_principal_id,rr.target_root_principal_id
     )
     OR v_approver.principal_id IN (
       rr.current_root_principal_id,rr.target_root_principal_id
     ) THEN
    RAISE EXCEPTION 'root change approvals are not distinct' USING ERRCODE='42501';
  END IF;
  UPDATE app.bootstrap_operator_r3 SET enabled=false
   WHERE operator_kind='ROOT'
     AND principal_id=rr.current_root_principal_id;
  INSERT INTO app.bootstrap_operator_r3(
    role_name,operator_kind,principal_id,token_digest,enabled,provisioned_at
  ) VALUES(
    rr.target_root_role_name,'ROOT',rr.target_root_principal_id,
    rr.target_token_digest,true,clock_timestamp()
  );
  INSERT INTO app.trusted_principal(id,state,created_at)
  VALUES(rr.target_root_principal_id,'ACTIVE',clock_timestamp())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO app.principal_epoch(principal_id,current_epoch,updated_at)
  VALUES(rr.target_root_principal_id,1,clock_timestamp())
  ON CONFLICT (principal_id) DO NOTHING;
  UPDATE app.bootstrap_generation_r2
     SET activation_state='SUPERSEDED',superseded_at=clock_timestamp()
   WHERE bootstrap_id=rr.bootstrap_id
     AND bootstrap_generation=rr.from_generation
     AND activation_state='ACTIVE';
  v_new_generation:=rr.from_generation+1;
  INSERT INTO app.bootstrap_generation_r2(
    bootstrap_id,bootstrap_generation,root_principal_id,root_role_name,
    root_operator_kind,root_token_digest,activation_state,created_at,
    generation_digest
  ) VALUES(
    rr.bootstrap_id,v_new_generation,rr.target_root_principal_id,
    rr.target_root_role_name,'ROOT',rr.target_token_digest,'ACTIVE',
    clock_timestamp(),
    app_private.bootstrap_generation_digest_r2(
      rr.bootstrap_id,v_new_generation,rr.target_root_principal_id,
      rr.target_root_role_name,rr.target_token_digest
    )
  );
  INSERT INTO app.bootstrap_approval_r2(
    bootstrap_id,bootstrap_generation,operator_kind,role_name,principal_id,
    root_principal_id,backend_pid,backend_started_at,approved_at,
    request_id,request_hash
  ) SELECT
    rr.bootstrap_id,v_new_generation,a.operator_kind,a.role_name,a.principal_id,
    rr.target_root_principal_id,a.backend_pid,a.backend_started_at,
    a.approved_at,a.request_id,a.request_hash
  FROM app.bootstrap_recovery_approval_r2 a
  WHERE a.recovery_id=p_recovery_id;
  UPDATE app.authority_grant
     SET revoked_at=clock_timestamp(),
         revocation_reason='ROOT_CHANGE:'||rr.reason_class
   WHERE id=lc.root_grant_id AND revoked_at IS NULL;
  UPDATE app.bootstrap_root_session_r2
     SET state='REVOKED',revoked_at=clock_timestamp()
   WHERE bootstrap_id=rr.bootstrap_id
     AND bootstrap_generation=rr.from_generation AND state='ACTIVE';
  UPDATE app.trusted_session
     SET state='REVOKED',binding_state='REVOKED',revoked_at=clock_timestamp(),
         revocation_reason='ROOT_CHANGE:'||rr.reason_class,
         termination_class=CASE rr.reason_class
           WHEN 'CREDENTIAL_COMPROMISE' THEN 'SECURITY_REVOKE'
           ELSE 'ADMIN_REVOKE' END
   WHERE session_id=lc.root_session_id AND state='ACTIVE';
  PERFORM app_private.append_bootstrap_event_r2(
    CASE rr.kind WHEN 'ROTATION' THEN 'ROTATION_EXECUTED'
                 ELSE 'RECOVERY_EXECUTED' END,
    rr.bootstrap_id,rr.from_generation,session_user,
    v_initiator.principal_id,NULL,NULL
  );
  UPDATE app.bootstrap_state_r3
     SET state='PREPARED',bootstrap_generation=v_new_generation,
         root_principal_id=rr.target_root_principal_id,
         root_role_name=rr.target_root_role_name,
         root_token_digest=rr.target_token_digest,
         prepared_at=clock_timestamp(),completed_at=NULL,
         root_grant_id=NULL,root_session_id=NULL,
         root_grant_issuer_principal_id=NULL
   WHERE singleton=rr.bootstrap_id;
  UPDATE app.bootstrap_lifecycle_r2
     SET bootstrap_generation=v_new_generation,
         state='ROOT_ISSUANCE_PENDING',
         state_revision=state_revision+1,
         root_principal_id=rr.target_root_principal_id,
         root_role_name=rr.target_root_role_name,
         root_session_id=NULL,root_grant_id=NULL,
         recovery_request_id=p_recovery_id,
         updated_at=clock_timestamp()
   WHERE bootstrap_id=rr.bootstrap_id
     AND bootstrap_generation=rr.from_generation;
  UPDATE app.bootstrap_recovery_r2
     SET state='EXECUTED',executed_at=clock_timestamp(),
         new_generation=v_new_generation
   WHERE id=p_recovery_id;
  PERFORM app_private.complete_bootstrap_request_r2(
    'BOOTSTRAP_EXECUTE_ROOT_CHANGE',p_request_id,v_new_generation::text
  );
  RETURN v_new_generation;
END
$$;

CREATE OR REPLACE FUNCTION app.bootstrap_deny_root_change_r3(
  p_recovery_id text,
  p_reason text,
  p_request_id text,
  p_request_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  rr app.bootstrap_recovery_r2%ROWTYPE;
  op app.bootstrap_operator_r3%ROWTYPE;
  v_hash text;
  v_replay boolean;
  v_result text;
BEGIN
  PERFORM app_private.validate_session_role_r3(
    session_user,'BOOTSTRAP_APPROVER','elevator_bootstrap_approver'
  );
  SELECT * INTO STRICT rr FROM app.bootstrap_recovery_r2
   WHERE id=p_recovery_id FOR UPDATE;
  SELECT * INTO STRICT op FROM app.bootstrap_operator_r3
   WHERE role_name=session_user AND operator_kind='APPROVER'
     AND principal_id<>rr.requested_by_principal_id AND enabled
   FOR SHARE;
  v_hash:=app_private.r6_request_hash(jsonb_build_object(
    'operation','BOOTSTRAP_DENY_ROOT_CHANGE','recoveryId',p_recovery_id,
    'reason',p_reason,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_bootstrap_request_r2(
    'BOOTSTRAP_DENY_ROOT_CHANGE',p_request_id,v_hash,rr.bootstrap_id,
    rr.from_generation,session_user,op.principal_id,'BOOTSTRAP_RECOVERY'
  );
  IF v_replay THEN RETURN; END IF;
  IF rr.state NOT IN ('PENDING','APPROVED') THEN
    RAISE EXCEPTION 'root change cannot be denied in current state'
      USING ERRCODE='40001';
  END IF;
  UPDATE app.bootstrap_recovery_r2 SET state='DENIED' WHERE id=p_recovery_id;
  UPDATE app.bootstrap_lifecycle_r2
     SET state='LOCKED',state_revision=state_revision+1,
         updated_at=clock_timestamp()
   WHERE bootstrap_id=rr.bootstrap_id
     AND bootstrap_generation=rr.from_generation;
  PERFORM app_private.append_bootstrap_event_r2(
    'LOCKED',rr.bootstrap_id,rr.from_generation,session_user,op.principal_id,
    NULL,NULL
  );
  PERFORM app_private.complete_bootstrap_request_r2(
    'BOOTSTRAP_DENY_ROOT_CHANGE',p_request_id,p_recovery_id
  );
END
$$;

CREATE OR REPLACE FUNCTION app.bootstrap_mark_issuance_failed_r3(
  p_bootstrap_id boolean,
  p_reason_code text,
  p_request_id text,
  p_request_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  st app.bootstrap_state_r3%ROWTYPE;
  lc app.bootstrap_lifecycle_r2%ROWTYPE;
  at app.bootstrap_issuance_attempt_r3%ROWTYPE;
  v_hash text;
  v_replay boolean;
  v_result text;
BEGIN
  IF session_user<>'elevator_session_bootstrap_seed' THEN
    RAISE EXCEPTION 'bootstrap seed role required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO STRICT st FROM app.bootstrap_state_r3
   WHERE singleton=p_bootstrap_id FOR UPDATE;
  SELECT * INTO STRICT lc FROM app.bootstrap_lifecycle_r2
   WHERE bootstrap_id=p_bootstrap_id
     AND bootstrap_generation=st.bootstrap_generation
   FOR UPDATE;
  SELECT * INTO STRICT at FROM app.bootstrap_issuance_attempt_r3
   WHERE bootstrap_id=p_bootstrap_id
     AND bootstrap_generation=st.bootstrap_generation FOR UPDATE;
  v_hash:=app_private.r6_request_hash(jsonb_build_object(
    'operation','BOOTSTRAP_MARK_ISSUANCE_FAILED','bootstrapId',p_bootstrap_id,
    'generation',st.bootstrap_generation,'reasonCode',p_reason_code,
    'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_bootstrap_request_r2(
    'BOOTSTRAP_MARK_ISSUANCE_FAILED',p_request_id,v_hash,p_bootstrap_id,
    st.bootstrap_generation,session_user,st.root_principal_id,
    'BOOTSTRAP_ISSUANCE_FAILURE'
  );
  IF v_replay THEN RETURN; END IF;
  IF lc.state<>'ROOT_ISSUANCE_PENDING'
     OR at.state NOT IN ('PENDING','SESSION_CREATED','GRANT_CREATED') THEN
    RAISE EXCEPTION 'issuance failure state invalid' USING ERRCODE='40001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM app.bootstrap_root_session_r2 s
     WHERE s.bootstrap_id=p_bootstrap_id
       AND s.bootstrap_generation=st.bootstrap_generation AND s.state='ACTIVE'
  ) OR EXISTS (
    SELECT 1 FROM app.bootstrap_root_grant_r2 g
     WHERE g.bootstrap_id=p_bootstrap_id
       AND g.bootstrap_generation=st.bootstrap_generation
  ) THEN
    RAISE EXCEPTION 'issuance failure cannot discard active root objects'
      USING ERRCODE='40001';
  END IF;
  UPDATE app.bootstrap_issuance_attempt_r3
     SET state='FAILED',failure_code=p_reason_code,completed_at=clock_timestamp()
   WHERE bootstrap_id=p_bootstrap_id
     AND bootstrap_generation=st.bootstrap_generation;
  UPDATE app.bootstrap_state_r3
     SET state='FAILED',completed_at=NULL,root_grant_id=NULL,
         root_session_id=NULL,root_grant_issuer_principal_id=NULL
   WHERE singleton=p_bootstrap_id;
  UPDATE app.bootstrap_lifecycle_r2
     SET state='LOCKED',locked_reason_code=p_reason_code,
         state_revision=state_revision+1,updated_at=clock_timestamp()
   WHERE bootstrap_id=p_bootstrap_id
     AND bootstrap_generation=st.bootstrap_generation;
  PERFORM app_private.append_bootstrap_event_r2(
    'LOCKED',p_bootstrap_id,st.bootstrap_generation,
    session_user,st.root_principal_id,NULL,NULL
  );
  PERFORM app_private.complete_bootstrap_request_r2(
    'BOOTSTRAP_MARK_ISSUANCE_FAILED',p_request_id,p_reason_code
  );
END
$$;

-- ===========================================================================
-- 6. Request Ledger and result recovery replay-first semantics
-- ===========================================================================

ALTER TABLE app.command_result_recovery_r2
  ADD CONSTRAINT command_result_recovery_single_request_r3
    UNIQUE (operation,command_request_id);

CREATE OR REPLACE FUNCTION app.approve_command_result_recovery_r2(
  p_recovery_id text,
  p_decision text,
  p_reason text,
  p_request_id text,
  p_request_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  rr app.command_result_recovery_r2%ROWTYPE;
  v_grant_id text;
  v_hash text;
  v_replay boolean;
  v_result text;
  v_approvals integer;
BEGIN
  IF p_decision NOT IN ('APPROVE','DENY') THEN
    RAISE EXCEPTION 'recovery decision invalid' USING ERRCODE='22023';
  END IF;
  SELECT * INTO s FROM app_private.lock_current_session();
  v_grant_id:=app_private.lock_authority_grant(
    s.session_id,s.principal_id,'RECOVERY_APPROVE',NULL,NULL,NULL,NULL
  );
  SELECT * INTO STRICT rr FROM app.command_result_recovery_r2
   WHERE id=p_recovery_id FOR UPDATE;
  v_hash:=app_private.r6_request_hash(jsonb_build_object(
    'operation','REQUEST_RESULT_RECOVERY_APPROVE','recoveryId',p_recovery_id,
    'decision',p_decision,'reason',p_reason,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'REQUEST_RESULT_RECOVERY_APPROVE',p_request_id,v_hash,rr.scope_key,
    s.principal_id,s.session_id,'COMMAND_RESULT_RECOVERY_APPROVAL'
  );
  IF v_replay THEN
    PERFORM app_private.assert_active_session(
      s.session_id,s.principal_id,s.login_epoch
    );
    RETURN;
  END IF;
  IF rr.state<>'PENDING' THEN
    RAISE EXCEPTION 'request recovery is not pending' USING ERRCODE='40001';
  END IF;
  IF s.principal_id IN (rr.principal_id,rr.requester_principal_id) THEN
    RAISE EXCEPTION 'recovery approver must be independent' USING ERRCODE='42501';
  END IF;
  INSERT INTO app.command_result_recovery_approval_r2(
    recovery_id,approver_session_id,approver_principal_id,
    approver_authority_grant_id,decision,reason,decided_at,
    request_id,request_hash
  ) VALUES(
    p_recovery_id,s.session_id,s.principal_id,v_grant_id,p_decision,p_reason,
    clock_timestamp(),p_request_id,v_hash
  );
  IF p_decision='DENY' THEN
    UPDATE app.command_result_recovery_r2 SET state='DENIED'
     WHERE id=p_recovery_id;
  ELSE
    SELECT count(*) INTO v_approvals
      FROM app.command_result_recovery_approval_r2
     WHERE recovery_id=p_recovery_id AND decision='APPROVE';
    IF v_approvals>=2 THEN
      UPDATE app.command_result_recovery_r2
         SET state='AUTHORIZED',authorized_at=clock_timestamp()
       WHERE id=p_recovery_id;
    END IF;
  END IF;
  PERFORM app_private.complete_command_request(
    'REQUEST_RESULT_RECOVERY_APPROVE',p_request_id,p_recovery_id
  );
  PERFORM app_private.assert_active_session(
    s.session_id,s.principal_id,s.login_epoch
  );
END
$$;

CREATE OR REPLACE FUNCTION app.execute_command_result_recovery_r2(
  p_recovery_id text,
  p_request_id text,
  p_request_key text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s record;
  rr app.command_result_recovery_r2%ROWTYPE;
  cr app.command_request%ROWTYPE;
  v_epoch bigint;
  v_hash text;
  v_replay boolean;
  v_result text;
BEGIN
  SELECT * INTO s FROM app_private.lock_current_session();
  SELECT * INTO STRICT rr FROM app.command_result_recovery_r2
   WHERE id=p_recovery_id FOR UPDATE;
  v_hash:=app_private.r6_request_hash(jsonb_build_object(
    'operation','REQUEST_RESULT_RECOVERY_EXECUTE','recoveryId',p_recovery_id,
    'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_command_request(
    'REQUEST_RESULT_RECOVERY_EXECUTE',p_request_id,v_hash,rr.scope_key,
    s.principal_id,s.session_id,'COMMAND_RESULT_RECOVERY_RESULT'
  );
  IF v_replay THEN
    PERFORM app_private.assert_active_session(
      s.session_id,s.principal_id,s.login_epoch
    );
    RETURN v_result;
  END IF;
  IF rr.state<>'AUTHORIZED'
     OR rr.principal_id<>s.principal_id
     OR rr.requester_principal_id<>s.principal_id THEN
    RAISE EXCEPTION 'request recovery execution not authorized' USING ERRCODE='42501';
  END IF;
  SELECT pe.current_epoch INTO STRICT v_epoch FROM app.principal_epoch pe
   WHERE pe.principal_id=s.principal_id FOR SHARE;
  IF v_epoch<>rr.original_epoch THEN
    RAISE EXCEPTION 'request recovery epoch is stale' USING ERRCODE='40001';
  END IF;
  SELECT * INTO STRICT cr FROM app.command_request
   WHERE operation=rr.operation AND request_id=rr.command_request_id
   FOR SHARE;
  IF cr.epoch<>v_epoch
     OR cr.request_hash<>rr.original_request_hash
     OR cr.scope_key<>rr.scope_key
     OR cr.result_type<>rr.result_type THEN
    RAISE EXCEPTION 'request recovery identity changed' USING ERRCODE='40001';
  END IF;
  UPDATE app.command_result_recovery_r2
     SET state='CONSUMED',consumed_at=clock_timestamp()
   WHERE id=p_recovery_id;
  INSERT INTO app.command_request_replay_audit_r3(
    id,operation,request_id,original_session_id,replay_session_id,
    principal_id,epoch,request_hash,replayed_at,
    original_termination_class,replay_policy,result_disclosed
  ) VALUES(
    gen_random_uuid()::text,rr.operation,rr.command_request_id,
    rr.original_session_id,s.session_id,s.principal_id,v_epoch,
    rr.original_request_hash,clock_timestamp(),
    rr.original_termination_class,'CONTROLLED_RECOVERY',true
  );
  PERFORM app_private.complete_command_request(
    'REQUEST_RESULT_RECOVERY_EXECUTE',p_request_id,cr.result_id
  );
  PERFORM app_private.assert_active_session(
    s.session_id,s.principal_id,s.login_epoch
  );
  RETURN cr.result_id;
END
$$;

-- ===========================================================================
-- 7. ProfessionalReview candidate identity completion
-- ===========================================================================

CREATE OR REPLACE FUNCTION app_private.a_bind_professional_candidate_r3()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  e app.professional_review_event%ROWTYPE;
BEGIN
  SELECT * INTO STRICT e FROM app.professional_review_event
   WHERE id=NEW.professional_review_event_id FOR SHARE;
  NEW.candidate_id:=e.candidate_id;
  RETURN NEW;
END
$$;

CREATE TRIGGER z_bind_selection_professional_candidate_r3
BEFORE INSERT OR UPDATE ON app.selection_professional_review_result
FOR EACH ROW EXECUTE FUNCTION app_private.a_bind_professional_candidate_r3();

CREATE OR REPLACE FUNCTION app_private.a_bind_snapshot_professional_candidate_r3()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  src app.selection_professional_review_result%ROWTYPE;
BEGIN
  SELECT * INTO STRICT src FROM app.selection_professional_review_result
   WHERE selection_run_id=NEW.selection_run_id
     AND professional_review_id=NEW.professional_review_id
     AND event_sequence=NEW.event_sequence FOR SHARE;
  NEW.candidate_id:=src.candidate_id;
  RETURN NEW;
END
$$;

CREATE TRIGGER y_bind_snapshot_professional_candidate_r3
BEFORE INSERT OR UPDATE ON app.sales_snapshot_professional_review_r3
FOR EACH ROW EXECUTE FUNCTION app_private.a_bind_snapshot_professional_candidate_r3();

-- ===========================================================================
-- 8. State/timestamp invariants
-- ===========================================================================

ALTER TABLE app.bootstrap_generation_r2
  ADD CONSTRAINT bootstrap_generation_timestamp_state_check_r3 CHECK (
    (activation_state='ACTIVE' AND superseded_at IS NULL)
    OR (activation_state IN ('SUPERSEDED','REVOKED','LOCKED')
      AND superseded_at IS NOT NULL)
  );

ALTER TABLE app.bootstrap_root_session_r2
  ADD CONSTRAINT bootstrap_root_session_revocation_check_r3 CHECK (
    (state='ACTIVE' AND revoked_at IS NULL)
    OR (state IN ('REVOKED','EXPIRED') AND revoked_at IS NOT NULL)
  );

ALTER TABLE app.bootstrap_recovery_r2
  ADD CONSTRAINT bootstrap_recovery_state_timestamp_check_r3 CHECK (
    (state='PENDING' AND approved_at IS NULL AND executed_at IS NULL)
    OR (state='APPROVED' AND approved_at IS NOT NULL AND executed_at IS NULL)
    OR (state='EXECUTED' AND approved_at IS NOT NULL AND executed_at IS NOT NULL)
    OR (state IN ('DENIED','LOCKED'))
  );

-- ===========================================================================
-- 9. Final ownership and ACL closure
-- ===========================================================================

ALTER TABLE app.bootstrap_issuance_attempt_r3 OWNER TO elevator_table_owner;

ALTER FUNCTION app_private.lock_owner_catalog_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.assert_protected_owner_closure_r3(text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_create_bootstrap_issuance_attempt_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_bind_catalog_source_evidence_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_bind_catalog_event_binding_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_bind_professional_candidate_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.a_bind_snapshot_professional_candidate_r3()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.bootstrap_deny_root_change_r3(text,text,text,text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.bootstrap_mark_issuance_failed_r3(boolean,text,text,text)
  OWNER TO elevator_review_function_owner;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA app FROM PUBLIC;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA app_private FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.bootstrap_complete_root_r3(
  boolean,text,text,text
) TO elevator_root_issuer;
GRANT EXECUTE ON FUNCTION app.bootstrap_begin_root_change_r2(
  text,boolean,text,text,text,text,text,text,text
) TO elevator_bootstrap_initiator;
GRANT EXECUTE ON FUNCTION app.bootstrap_approve_root_change_r2(text,text,text)
  TO elevator_bootstrap_approver;
GRANT EXECUTE ON FUNCTION app.bootstrap_deny_root_change_r3(text,text,text,text)
  TO elevator_bootstrap_approver;
GRANT EXECUTE ON FUNCTION app.bootstrap_execute_root_change_r2(text,text,text)
  TO elevator_bootstrap_seed;
GRANT EXECUTE ON FUNCTION app.bootstrap_mark_issuance_failed_r3(
  boolean,text,text,text
) TO elevator_bootstrap_seed;
GRANT EXECUTE ON FUNCTION app.create_catalog_source_target_binding_r2(
  text,text,text,text,text,text,text,text,text,text,text,text,text,text,text
) TO elevator_catalog_reviewer,elevator_catalog_publisher;
GRANT EXECUTE ON FUNCTION app.terminate_trusted_session_r2(
  text,text,text,text,text
) TO elevator_identity_broker;
GRANT EXECUTE ON FUNCTION app.request_command_result_recovery_r2(
  text,text,text,text,text,text
) TO elevator_runtime_web,elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.approve_command_result_recovery_r2(
  text,text,text,text,text
) TO elevator_security_admin;
GRANT EXECUTE ON FUNCTION app.execute_command_result_recovery_r2(
  text,text,text
) TO elevator_runtime_web,elevator_runtime_worker;

ALTER TABLE app.command_result_recovery_r2
  ADD CONSTRAINT command_result_recovery_state_timestamp_check_r3 CHECK (
    (state='PENDING' AND authorized_at IS NULL AND consumed_at IS NULL)
    OR (state='AUTHORIZED' AND authorized_at IS NOT NULL AND consumed_at IS NULL)
    OR (state='CONSUMED' AND authorized_at IS NOT NULL AND consumed_at IS NOT NULL)
    OR (state IN ('DENIED','LOCKED'))
  );

-- ===== END R3-C8 CORRECTIONS R3 OVERLAY =====
