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

-- __R3_C8_AUTO_OWNERS__

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
