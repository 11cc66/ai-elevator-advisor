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





