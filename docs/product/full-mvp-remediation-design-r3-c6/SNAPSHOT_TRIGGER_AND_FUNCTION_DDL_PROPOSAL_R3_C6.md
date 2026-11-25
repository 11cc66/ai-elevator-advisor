# Snapshot Trigger and Function DDL Proposal R3-C6

This file is a design proposal for PostgreSQL 18 and is not executed.

## 1. SHA-256 Helper

```sql
CREATE FUNCTION app.sha256_hex(p_value bytea)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
RETURN encode(sha256(p_value),'hex');
```

This uses the PostgreSQL 18 core `sha256(bytea)` binary-string function.

## 2. Validation Function

```sql
CREATE FUNCTION app_private.validate_snapshot_r3(p_snapshot_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s app.sales_handoff_snapshot_r3%ROWTYPE;
  m app.snapshot_basis_metadata_r3%ROWTYPE;
  v_count bigint;
  v_expected bigint;
  v_basis bytea;
BEGIN
  SELECT * INTO STRICT s
    FROM app.sales_handoff_snapshot_r3
   WHERE id=p_snapshot_id;
  IF s.state <> 'FINALIZED' THEN
    RAISE EXCEPTION 'snapshot not finalized' USING ERRCODE='23514';
  END IF;

  SELECT * INTO STRICT m
    FROM app.snapshot_basis_metadata_r3
   WHERE snapshot_id=p_snapshot_id;
  IF (m.registry_revision,m.protocol_revision,m.stable_key_encoding)
     IS DISTINCT FROM ('SNAPSHOT-R3','R3-BASIS-1-R6','SK-R2') THEN
    RAISE EXCEPTION 'snapshot version mismatch' USING ERRCODE='23514';
  END IF;

  SELECT count(*) INTO v_expected
    FROM app.selection_candidate_result
   WHERE selection_run_id=s.selection_run_id;
  SELECT count(*) INTO v_count
    FROM app.sales_snapshot_candidate_r3
   WHERE snapshot_id=p_snapshot_id;
  IF v_count <> v_expected OR v_count = 0 THEN
    RAISE EXCEPTION 'candidate completeness failure' USING ERRCODE='23514';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM app.sales_snapshot_source_r3
     WHERE snapshot_id=p_snapshot_id
       AND octet_length(stable_key) > 158
  ) OR EXISTS (
    SELECT 1 FROM app.sales_snapshot_requirement_field_r3
     WHERE snapshot_id=p_snapshot_id
       AND (octet_length(source_key)>362
            OR source_key IS DISTINCT FROM app.source_key_r3(
              source_kind,source_entity_type,source_entity_id,
              source_aux_is_null,source_aux_text))
  ) THEN
    RAISE EXCEPTION 'source identity failure' USING ERRCODE='23514';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM app.sales_snapshot_price_r3 p
     WHERE p.snapshot_id=p_snapshot_id
       AND (p.valid_from > s.basis_as_of
            OR (p.valid_until IS NOT NULL AND p.valid_until < s.basis_as_of))
       AND NOT EXISTS (
         SELECT 1 FROM app.sales_snapshot_candidate_r3 c
          WHERE c.id=p.candidate_row_id
            AND c.snapshot_id=p.snapshot_id
            AND c.commercial_status IN ('PRICE_EXPIRED','REQUIRES_QUOTE')
       )
  ) THEN
    RAISE EXCEPTION 'price validity failure' USING ERRCODE='23514';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM (
        SELECT w.id,
               row_number() OVER (
                 PARTITION BY w.candidate_row_id
                 ORDER BY w.warning_code, w.warning_text, w.source_warning_id
               ) AS expected_sequence,
               w.warning_sequence
          FROM app.sales_snapshot_warning_r3 w
         WHERE w.snapshot_id=p_snapshot_id
      ) z
     WHERE z.expected_sequence <> z.warning_sequence
  ) THEN
    RAISE EXCEPTION 'warning sequence mismatch' USING ERRCODE='23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM app.sales_snapshot_candidate_r3 c
     WHERE c.snapshot_id=p_snapshot_id
       AND c.rule_set_revision_id <> s.rule_set_revision_id
  ) THEN
    RAISE EXCEPTION 'candidate ruleset mismatch' USING ERRCODE='23514';
  END IF;

  v_basis := app.build_snapshot_basis_r6(p_snapshot_id);
  IF octet_length(v_basis) <> m.basis_byte_length
     OR app.sha256_hex(v_basis) <> m.basis_digest
     OR app.snapshot_record_count(p_snapshot_id) <> m.record_count
     OR app.verify_snapshot_basis_r6(v_basis,p_snapshot_id) IS DISTINCT FROM true
  THEN
    RAISE EXCEPTION 'basis verification failure' USING ERRCODE='23514';
  END IF;
END
$$;
```

`build_snapshot_basis_r6` and `verify_snapshot_basis_r6` must be two independently
reviewed implementations. The former serializes rows; the latter decodes and
rebuilds expected records. Neither may read a pre-stored Basis blob as its only
input.

## 2. Creation Function Contract

```sql
CREATE FUNCTION app.create_snapshot_r3(
  p_snapshot_id text,
  p_case_id text,
  p_selection_run_id text,
  p_requirement_version_id text,
  p_expected_case_version bigint
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_epoch bigint;
  v_role text := session_user;
  v_run app.selection_run%ROWTYPE;
BEGIN
  PERFORM app_private.require_active_session(v_role,'SNAPSHOT_CREATE');
  PERFORM 1 FROM app.sales_case WHERE id=p_case_id FOR UPDATE;
  SELECT * INTO STRICT v_run FROM app.selection_run
   WHERE id=p_selection_run_id FOR SHARE;
  IF v_run.state <> 'SEALED' THEN
    RAISE EXCEPTION 'selection run not sealed' USING ERRCODE='23514';
  END IF;

  INSERT INTO app.sales_handoff_snapshot_r3(
    id,case_id,project_id,conversation_id,requirement_id,
    requirement_version_id,installation_scenario,selection_run_id,
    rule_set_revision_id,rule_set_content_digest,basis_as_of,
    version_number,mutation_version,state,created_by_principal_id,created_at)
  VALUES(
    p_snapshot_id,p_case_id,v_run.project_id,v_run.conversation_id,
    v_run.requirement_id,p_requirement_version_id,v_run.installation_scenario,
    p_selection_run_id,v_run.rule_set_revision_id,
    v_run.rule_set_content_digest,clock_timestamp(),
    p_expected_case_version+1,1,'DRAFT',
    app_private.current_principal_id(v_role),clock_timestamp());

  PERFORM app_private.materialize_snapshot_candidates_r3(p_snapshot_id);
  PERFORM app_private.materialize_snapshot_parameters_r3(p_snapshot_id);
  PERFORM app_private.materialize_snapshot_prices_r3(p_snapshot_id);
  PERFORM app_private.materialize_snapshot_sources_r3(p_snapshot_id);
  PERFORM app_private.materialize_snapshot_reviews_r3(p_snapshot_id);
  PERFORM app_private.materialize_snapshot_warnings_r3(p_snapshot_id);
  PERFORM app_private.materialize_snapshot_missing_fields_r3(p_snapshot_id);
  PERFORM app_private.materialize_snapshot_basis_r3(p_snapshot_id);

  UPDATE app.sales_handoff_snapshot_r3
     SET state='FINALIZED', finalized_at=clock_timestamp(),
         mutation_version=mutation_version+1
   WHERE id=p_snapshot_id AND state='DRAFT' AND mutation_version=1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'finalization CAS failed' USING ERRCODE='40001';
  END IF;
  PERFORM app_private.require_no_active_snapshot_children_r3(p_snapshot_id);
  RETURN (SELECT mutation_version
            FROM app.sales_handoff_snapshot_r3
           WHERE id=p_snapshot_id);
END
$$;
```

Materializers are table-specific controlled functions. They select only sealed
immutable results and copy the exact revision identities into canonical rows;
they never query "latest" catalog state.

## 3. Function Ownership

```sql
ALTER FUNCTION app.create_snapshot_r3(text,text,text,text,bigint)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.validate_snapshot_r3(text)
  OWNER TO elevator_review_function_owner;
REVOKE EXECUTE ON FUNCTION app.create_snapshot_r3(text,text,text,text,bigint)
  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_private.validate_snapshot_r3(text)
  FROM PUBLIC;
```

The validator's trigger invocation does not require runtime EXECUTE.

