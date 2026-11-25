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
