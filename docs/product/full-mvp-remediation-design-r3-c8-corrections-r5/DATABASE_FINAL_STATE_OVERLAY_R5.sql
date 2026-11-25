-- FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS-R5
-- Final-state overlay over the transformed, hash-verified R4 Complete DDL.
-- DESIGN ONLY. Do not execute.

-- ===========================================================================
-- 1. Coarse transaction identity mutex and current-root authority gate
-- ===========================================================================

-- A single transaction-scoped lock serializes every Bootstrap recovery command
-- with every revocation path that can invalidate the current Root identity.
-- All writers take this lock before their first protected row lock. PostgreSQL
-- advisory transaction locks are re-entrant for the same transaction.
CREATE OR REPLACE FUNCTION app_private.lock_bootstrap_identity_r5()
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(8162026112501::bigint);
END
$$;

CREATE OR REPLACE FUNCTION app_private.enforce_bootstrap_identity_mutex_r5()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  PERFORM app_private.lock_bootstrap_identity_r5();
  RETURN COALESCE(NEW,OLD);
END
$$;

CREATE TRIGGER r5_identity_mutex_trusted_principal
BEFORE UPDATE OR DELETE ON app.trusted_principal
FOR EACH STATEMENT EXECUTE FUNCTION app_private.enforce_bootstrap_identity_mutex_r5();

CREATE TRIGGER r5_identity_mutex_principal_epoch
BEFORE UPDATE OR DELETE ON app.principal_epoch
FOR EACH STATEMENT EXECUTE FUNCTION app_private.enforce_bootstrap_identity_mutex_r5();

CREATE TRIGGER r5_identity_mutex_trusted_session
BEFORE UPDATE OR DELETE ON app.trusted_session
FOR EACH STATEMENT EXECUTE FUNCTION app_private.enforce_bootstrap_identity_mutex_r5();

CREATE TRIGGER r5_identity_mutex_authority_grant
BEFORE UPDATE OR DELETE ON app.authority_grant
FOR EACH STATEMENT EXECUTE FUNCTION app_private.enforce_bootstrap_identity_mutex_r5();

CREATE TRIGGER r5_identity_mutex_bootstrap_root_session
BEFORE UPDATE OR DELETE ON app.bootstrap_root_session_r2
FOR EACH STATEMENT EXECUTE FUNCTION app_private.enforce_bootstrap_identity_mutex_r5();

CREATE TRIGGER r5_identity_mutex_bootstrap_root_grant
BEFORE UPDATE OR DELETE ON app.bootstrap_root_grant_r2
FOR EACH STATEMENT EXECUTE FUNCTION app_private.enforce_bootstrap_identity_mutex_r5();

CREATE TRIGGER r5_identity_mutex_bootstrap_operator
BEFORE UPDATE OR DELETE ON app.bootstrap_operator_r3
FOR EACH STATEMENT EXECUTE FUNCTION app_private.enforce_bootstrap_identity_mutex_r5();

-- The caller must already hold the identity mutex. p_now is captured once so
-- every temporal predicate in one authorization decision uses one DB clock
-- reading. Missing, disabled or stale identity fails closed.
CREATE OR REPLACE FUNCTION app_private.assert_current_root_authority_r5(
  p_bootstrap_id boolean,
  p_generation bigint,
  p_root_session_id text,
  p_root_principal_id text,
  p_root_role_name text,
  p_root_grant_id text,
  p_now timestamptz,
  p_allow_superseded_for_transition boolean
) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  IF p_root_session_id IS NULL OR p_root_grant_id IS NULL
     OR p_root_principal_id IS NULL OR p_root_role_name IS NULL
     OR p_now IS NULL THEN
    RAISE EXCEPTION 'current root authority inputs missing'
      USING ERRCODE='42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM app.bootstrap_generation_r2 bg
      JOIN app.bootstrap_root_session_r2 bs
        ON bs.bootstrap_id=bg.bootstrap_id
       AND bs.bootstrap_generation=bg.bootstrap_generation
       AND bs.session_id=p_root_session_id
       AND bs.root_principal_id=p_root_principal_id
       AND bs.root_role_name=p_root_role_name
      JOIN app.trusted_session ts
        ON ts.session_id=bs.session_id
       AND ts.principal_id=bs.root_principal_id
       AND ts.db_auth_role=bs.root_role_name
      JOIN app.trusted_principal rp
        ON rp.id=bs.root_principal_id
       AND rp.state='ACTIVE'
      JOIN app.principal_epoch pe
        ON pe.principal_id=rp.id
       AND pe.current_epoch=ts.login_epoch
      JOIN app.bootstrap_root_grant_r2 gr
        ON gr.bootstrap_id=bg.bootstrap_id
       AND gr.bootstrap_generation=bg.bootstrap_generation
       AND gr.root_session_id=bs.session_id
       AND gr.root_principal_id=bs.root_principal_id
       AND gr.root_role_name=bs.root_role_name
       AND gr.root_grant_id=p_root_grant_id
      JOIN app.authority_grant ag
        ON ag.id=gr.root_grant_id
       AND ag.session_id=gr.root_session_id
       AND ag.principal_id=gr.root_principal_id
     WHERE bg.bootstrap_id=p_bootstrap_id
       AND bg.bootstrap_generation=p_generation
       AND (
         bg.activation_state='ACTIVE'
         OR (
           p_allow_superseded_for_transition
           AND bg.activation_state='SUPERSEDED'
           AND bg.superseded_at IS NOT NULL
         )
       )
       AND bg.root_principal_id=p_root_principal_id
       AND bg.root_role_name=p_root_role_name
       AND bs.state='ACTIVE'
       AND ts.state='ACTIVE'
       AND p_now>=ts.not_before
       AND p_now<ts.expires_at
       AND ag.revoked_at IS NULL
       AND p_now>=ag.valid_from
       AND (ag.valid_until IS NULL OR p_now<ag.valid_until)
  ) THEN
    RAISE EXCEPTION 'current root authority is not active'
      USING ERRCODE='42501';
  END IF;
END
$$;

-- Defense in depth: every ROTATION Generation insert revalidates the old
-- Root immediately before the row can enter the table. The check reads the
-- current APPROVED Attempt and its two approvals and rejects a stale Attempt,
-- revoked/expired Root identity, or mismatched target identity.
CREATE OR REPLACE FUNCTION app_private.enforce_rotation_generation_revalidation_r5()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  lc app.bootstrap_lifecycle_r2%ROWTYPE;
  rr app.bootstrap_recovery_r2%ROWTYPE;
  v_now timestamptz;
  v_approvals integer;
BEGIN
  IF NEW.bootstrap_generation<=1 THEN
    RETURN NEW;
  END IF;

  PERFORM app_private.lock_bootstrap_identity_r5();
  v_now:=clock_timestamp();

  SELECT * INTO STRICT lc
    FROM app.bootstrap_lifecycle_r2
   WHERE bootstrap_id=NEW.bootstrap_id
     AND bootstrap_generation=NEW.bootstrap_generation-1
   FOR SHARE;

  IF lc.state NOT IN (
    'RECOVERY_APPROVED','ROOT_ROTATION_PENDING','ROOT_ISSUANCE_PENDING'
  ) THEN
    RAISE EXCEPTION 'generation insert lifecycle is not authorized'
      USING ERRCODE='40001';
  END IF;

  SELECT * INTO STRICT rr
    FROM app.bootstrap_recovery_r2
   WHERE bootstrap_id=NEW.bootstrap_id
     AND from_generation=lc.bootstrap_generation
     AND state='APPROVED'
   FOR SHARE;

  IF rr.kind NOT IN ('RECOVERY','ROTATION')
     OR rr.target_root_principal_id<>NEW.root_principal_id
     OR rr.target_root_role_name<>NEW.root_role_name
     OR rr.target_token_digest<>NEW.root_token_digest
     OR v_now>=rr.approval_expires_at THEN
    RAISE EXCEPTION 'generation insert recovery attempt is stale'
      USING ERRCODE='40001';
  END IF;

  IF rr.kind='ROTATION' THEN
    PERFORM app_private.assert_current_root_authority_r5(
      rr.bootstrap_id,rr.from_generation,lc.root_session_id,
      lc.root_principal_id,lc.root_role_name,lc.root_grant_id,v_now,true
    );
  END IF;

  SELECT count(*) INTO v_approvals
    FROM app.bootstrap_recovery_approval_r2 a
    JOIN app.bootstrap_operator_r3 o
      ON o.role_name=a.role_name
     AND o.operator_kind=a.operator_kind
     AND o.principal_id=a.principal_id
     AND o.enabled
    JOIN app.trusted_principal p
      ON p.id=a.principal_id
     AND p.state='ACTIVE'
   WHERE a.recovery_id=rr.id
     AND a.principal_id NOT IN (
       rr.current_root_principal_id,rr.target_root_principal_id
     );
  IF v_approvals<>2 THEN
    RAISE EXCEPTION 'generation insert approvals are stale'
      USING ERRCODE='42501';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER r5_generation_current_root_revalidation
BEFORE INSERT ON app.bootstrap_generation_r2
FOR EACH ROW
EXECUTE FUNCTION app_private.enforce_rotation_generation_revalidation_r5();

-- ===========================================================================
-- 2. Durable terminalization of an expired active Attempt
-- ===========================================================================

CREATE TABLE app.bootstrap_recovery_terminalization_r5 (
  id text PRIMARY KEY,
  recovery_id text NOT NULL UNIQUE,
  bootstrap_id boolean NOT NULL,
  from_generation bigint NOT NULL,
  attempt_sequence bigint NOT NULL CHECK (attempt_sequence>0),
  previous_state text NOT NULL CHECK (previous_state IN ('PENDING','APPROVED')),
  terminal_state text NOT NULL CHECK (terminal_state='LOCKED'),
  reason_code text NOT NULL CHECK (reason_code='APPROVAL_EXPIRED'),
  approval_expires_at timestamptz(6) NOT NULL,
  authoritative_time timestamptz(6) NOT NULL,
  terminalized_at timestamptz(6) NOT NULL,
  observed_via text NOT NULL CHECK (
    observed_via IN (
      'BEGIN_EXPIRED_SWEEP','APPROVE_EXPIRY','EXECUTE_EXPIRY'
    )
  ),
  attempt_request_id text NOT NULL,
  attempt_request_hash text NOT NULL CHECK (
    attempt_request_hash ~ '^[0-9a-f]{64}$'
  ),
  actor_role text NOT NULL,
  actor_principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  event_id text NOT NULL REFERENCES app.bootstrap_event_r2(id),
  content_digest text NOT NULL CHECK (content_digest ~ '^[0-9a-f]{64}$'),
  FOREIGN KEY (bootstrap_id,from_generation)
    REFERENCES app.bootstrap_generation_r2(
      bootstrap_id,bootstrap_generation
    )
);

CREATE OR REPLACE FUNCTION app_private.terminalize_expired_root_change_r5(
  p_recovery_id text,
  p_observed_via text,
  p_now timestamptz
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  rr app.bootstrap_recovery_r2%ROWTYPE;
  v_existing text;
  v_event_id text;
  v_previous_state text;
  v_terminalized_at timestamptz;
  v_id text;
BEGIN
  IF p_observed_via NOT IN (
    'BEGIN_EXPIRED_SWEEP','APPROVE_EXPIRY','EXECUTE_EXPIRY'
  ) THEN
    RAISE EXCEPTION 'expiry observation origin invalid'
      USING ERRCODE='22023';
  END IF;
  IF p_now IS NULL THEN
    RAISE EXCEPTION 'expiry authoritative time missing'
      USING ERRCODE='22023';
  END IF;

  SELECT * INTO STRICT rr
    FROM app.bootstrap_recovery_r2
   WHERE id=p_recovery_id
   FOR UPDATE;

  IF rr.state='LOCKED' THEN
    SELECT event_id INTO v_existing
      FROM app.bootstrap_recovery_terminalization_r5
     WHERE recovery_id=p_recovery_id;
    IF v_existing IS NULL THEN
      RAISE EXCEPTION 'legacy LOCKED attempt lacks R5 terminal evidence'
        USING ERRCODE='40001';
    END IF;
    RETURN v_existing;
  END IF;
  IF rr.state NOT IN ('PENDING','APPROVED') THEN
    RAISE EXCEPTION 'root change cannot be expired in current state'
      USING ERRCODE='40001';
  END IF;
  IF p_now<rr.approval_expires_at THEN
    RAISE EXCEPTION 'root change approval has not expired'
      USING ERRCODE='40001';
  END IF;

  v_previous_state:=rr.state;
  v_terminalized_at:=p_now;
  UPDATE app.bootstrap_recovery_r2
     SET state='LOCKED',locked_at=v_terminalized_at,
         denial_reason='APPROVAL_EXPIRED'
   WHERE id=p_recovery_id;

  UPDATE app.bootstrap_lifecycle_r2
     SET state='LOCKED',locked_reason_code='APPROVAL_EXPIRED',
         state_revision=state_revision+1,updated_at=v_terminalized_at
   WHERE bootstrap_id=rr.bootstrap_id
     AND bootstrap_generation=rr.from_generation;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'expired attempt lifecycle target missing'
      USING ERRCODE='40001';
  END IF;

  v_event_id:=app_private.append_bootstrap_event_r2(
    'LOCKED',rr.bootstrap_id,rr.from_generation,
    rr.requested_by_role,rr.requested_by_principal_id,NULL,NULL
  );
  v_id:=app_private.sha256_hex(convert_to(jsonb_build_object(
    'schema','AIEA-BOOTSTRAP-EXPIRY-TERMINALIZATION-V1',
    'recoveryId',rr.id,
    'attemptSequence',rr.attempt_sequence,
    'previousState',v_previous_state,
    'terminalState','LOCKED',
    'reasonCode','APPROVAL_EXPIRED',
    'approvalExpiresAt',rr.approval_expires_at,
    'authoritativeTime',p_now,
    'observedVia',p_observed_via,
    'eventId',v_event_id
  )::text,'UTF8'));

  INSERT INTO app.bootstrap_recovery_terminalization_r5(
    id,recovery_id,bootstrap_id,from_generation,attempt_sequence,
    previous_state,terminal_state,reason_code,approval_expires_at,
    authoritative_time,terminalized_at,observed_via,attempt_request_id,
    attempt_request_hash,actor_role,actor_principal_id,event_id,content_digest
  ) VALUES(
    v_id,p_recovery_id,rr.bootstrap_id,rr.from_generation,rr.attempt_sequence,
    v_previous_state,'LOCKED','APPROVAL_EXPIRED',rr.approval_expires_at,
    p_now,v_terminalized_at,p_observed_via,rr.request_id,rr.request_hash,
    rr.requested_by_role,rr.requested_by_principal_id,v_event_id,v_id
  );
  RETURN v_event_id;
END
$$;

-- Compatibility helper used by the frozen R4 Approve/Execute callers.
CREATE OR REPLACE FUNCTION app_private.lock_expired_root_change_r4(
  p_recovery_id text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  rr app.bootstrap_recovery_r2%ROWTYPE;
  v_now timestamptz:=clock_timestamp();
BEGIN
  SELECT * INTO STRICT rr
    FROM app.bootstrap_recovery_r2
   WHERE id=p_recovery_id
   FOR UPDATE;
  IF rr.state='LOCKED' THEN
    PERFORM app_private.terminalize_expired_root_change_r5(
      p_recovery_id,'APPROVE_EXPIRY',v_now
    );
    RETURN;
  END IF;
  IF rr.state NOT IN ('PENDING','APPROVED') THEN
    RAISE EXCEPTION 'root change already reached another terminal state'
      USING ERRCODE='40001';
  END IF;
  PERFORM app_private.terminalize_expired_root_change_r5(
    p_recovery_id,'APPROVE_EXPIRY',v_now
  );
END
$$;

-- ===========================================================================
-- 3. Public Recovery command lock order and attempt lifecycle
-- ===========================================================================

CREATE OR REPLACE FUNCTION app.bootstrap_approve_root_change_r4(
  p_recovery_id text,
  p_request_id text,
  p_request_key text
) RETURNS text
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
  v_now timestamptz;
BEGIN
  PERFORM app_private.validate_session_role_r3(
    session_user,'BOOTSTRAP_APPROVER','elevator_bootstrap_approver'
  );
  PERFORM app_private.lock_bootstrap_identity_r5();
  SELECT * INTO STRICT rr FROM app.bootstrap_recovery_r2
   WHERE id=p_recovery_id FOR UPDATE;
  SELECT * INTO STRICT op FROM app.bootstrap_operator_r3
   WHERE role_name=session_user AND operator_kind='APPROVER'
     AND principal_id<>rr.current_root_principal_id
     AND principal_id<>rr.requested_by_principal_id
     AND principal_id<>rr.target_root_principal_id
     AND enabled FOR SHARE;
  PERFORM 1 FROM app.trusted_principal p
   WHERE p.id=op.principal_id AND p.state='ACTIVE' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'root change approver Principal is not active'
      USING ERRCODE='42501';
  END IF;
  v_hash:=app_private.r6_request_hash(jsonb_build_object(
    'operation','BOOTSTRAP_APPROVE_ROOT_CHANGE_R4',
    'recoveryId',p_recovery_id,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result
    FROM app_private.claim_bootstrap_request_r2(
      'BOOTSTRAP_APPROVE_ROOT_CHANGE_R4',p_request_id,v_hash,
      rr.bootstrap_id,rr.from_generation,session_user,op.principal_id,
      'BOOTSTRAP_RECOVERY_APPROVAL'
    );
  IF v_replay THEN RETURN v_result; END IF;
  v_now:=clock_timestamp();
  IF v_now>=rr.approval_expires_at THEN
    PERFORM app_private.terminalize_expired_root_change_r5(
      p_recovery_id,'APPROVE_EXPIRY',v_now
    );
    PERFORM app_private.complete_bootstrap_request_r2(
      'BOOTSTRAP_APPROVE_ROOT_CHANGE_R4',p_request_id,'LOCKED'
    );
    RETURN 'LOCKED';
  END IF;
  IF rr.state<>'PENDING' THEN
    RAISE EXCEPTION 'root change is not approval-pending' USING ERRCODE='40001';
  END IF;
  SELECT a.backend_start INTO v_backend_start
    FROM pg_catalog.pg_stat_activity a
   WHERE a.pid=pg_catalog.pg_backend_pid() AND a.usename=session_user;
  IF v_backend_start IS NULL THEN
    RAISE EXCEPTION 'root change backend identity unavailable'
      USING ERRCODE='42501';
  END IF;
  INSERT INTO app.bootstrap_recovery_approval_r2(
    recovery_id,operator_kind,role_name,principal_id,backend_pid,
    backend_started_at,approved_at,request_id,request_hash
  ) VALUES(
    p_recovery_id,'APPROVER',session_user,op.principal_id,
    pg_catalog.pg_backend_pid(),v_backend_start,v_now,
    p_request_id,v_hash
  );
  SELECT count(*) INTO v_count FROM app.bootstrap_recovery_approval_r2
   WHERE recovery_id=p_recovery_id;
  IF v_count=2 THEN
    UPDATE app.bootstrap_recovery_r2
       SET state='APPROVED',approved_at=v_now
     WHERE id=p_recovery_id;
    UPDATE app.bootstrap_lifecycle_r2
       SET state=CASE rr.kind
                    WHEN 'ROTATION' THEN 'ROOT_ROTATION_PENDING'
                    ELSE 'RECOVERY_APPROVED' END,
           state_revision=state_revision+1,updated_at=v_now
     WHERE bootstrap_id=rr.bootstrap_id
       AND bootstrap_generation=rr.from_generation;
  END IF;
  PERFORM app_private.append_bootstrap_event_r2(
    CASE rr.kind WHEN 'ROTATION' THEN 'ROTATION_APPROVED'
                 ELSE 'RECOVERY_APPROVED' END,
    rr.bootstrap_id,rr.from_generation,session_user,op.principal_id,NULL,NULL
  );
  PERFORM app_private.complete_bootstrap_request_r2(
    'BOOTSTRAP_APPROVE_ROOT_CHANGE_R4',p_request_id,'APPROVED'
  );
  RETURN 'APPROVED';
END
$$;

CREATE OR REPLACE FUNCTION app.bootstrap_begin_root_change_r4(
  p_recovery_id text,
  p_bootstrap_id boolean,
  p_kind text,
  p_reason_class text,
  p_target_root_principal_id text,
  p_target_root_role_name text,
  p_target_token_digest text,
  p_request_id text,
  p_request_key text
) RETURNS TABLE(recovery_id text,attempt_sequence bigint)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  lc app.bootstrap_lifecycle_r2%ROWTYPE;
  op app.bootstrap_operator_r3%ROWTYPE;
  v_active app.bootstrap_recovery_r2%ROWTYPE;
  v_hash text;
  v_replay boolean;
  v_result text;
  v_seq bigint;
  v_digest text;
  v_backend_start timestamptz;
  v_now timestamptz;
BEGIN
  IF p_kind NOT IN ('RECOVERY','ROTATION') THEN
    RAISE EXCEPTION 'root change kind invalid' USING ERRCODE='22023';
  END IF;
  PERFORM app_private.validate_session_role_r3(
    session_user,'BOOTSTRAP_INITIATOR','elevator_bootstrap_initiator'
  );
  PERFORM app_private.lock_bootstrap_identity_r5();
  SELECT * INTO STRICT lc FROM app.bootstrap_lifecycle_r2
   WHERE bootstrap_id=p_bootstrap_id FOR UPDATE;
  SELECT * INTO STRICT op FROM app.bootstrap_operator_r3
   WHERE role_name=session_user AND operator_kind='INITIATOR'
     AND principal_id<>lc.root_principal_id
     AND principal_id<>p_target_root_principal_id
     AND enabled FOR SHARE;
  PERFORM 1 FROM app.trusted_principal p
   WHERE p.id=op.principal_id AND p.state='ACTIVE' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'root change initiator Principal is not active'
      USING ERRCODE='42501';
  END IF;
  v_hash:=app_private.r6_request_hash(jsonb_build_object(
    'operation','BOOTSTRAP_BEGIN_ROOT_CHANGE_R4',
    'recoveryId',p_recovery_id,'bootstrapId',p_bootstrap_id,
    'kind',p_kind,'reasonClass',p_reason_class,
    'targetRootPrincipalId',p_target_root_principal_id,
    'targetRootRoleName',p_target_root_role_name,
    'targetTokenDigest',p_target_token_digest,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result
    FROM app_private.claim_bootstrap_request_r2(
      'BOOTSTRAP_BEGIN_ROOT_CHANGE_R4',p_request_id,v_hash,p_bootstrap_id,
      lc.bootstrap_generation,session_user,op.principal_id,
      'BOOTSTRAP_RECOVERY_ATTEMPT'
    );
  IF v_replay THEN
    RETURN QUERY
      SELECT r.id,r.attempt_sequence
        FROM app.bootstrap_recovery_r2 r WHERE r.id=v_result;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'bootstrap Begin replay target missing'
        USING ERRCODE='40001';
    END IF;
    RETURN;
  END IF;

  v_now:=clock_timestamp();
  IF p_kind='ROTATION' THEN
    IF lc.state NOT IN ('BOOTSTRAP_COMPLETED','ROOT_ROTATED') THEN
      RAISE EXCEPTION 'valid root required for rotation'
        USING ERRCODE='42501';
    END IF;
    PERFORM app_private.assert_current_root_authority_r5(
      p_bootstrap_id,lc.bootstrap_generation,lc.root_session_id,
      lc.root_principal_id,lc.root_role_name,lc.root_grant_id,v_now,false
    );
  ELSIF lc.state NOT IN (
    'BOOTSTRAP_COMPLETED','ROOT_ROTATED','RECOVERY_PENDING',
    'RECOVERY_APPROVED','ROOT_ROTATION_PENDING','ROOT_ISSUANCE_PENDING',
    'LOCKED','REVOKED'
  ) THEN
    RAISE EXCEPTION 'root recovery state invalid' USING ERRCODE='40001';
  END IF;
  IF p_target_root_principal_id=lc.root_principal_id
     OR p_target_root_role_name=lc.root_role_name THEN
    RAISE EXCEPTION 'root change requires a new Principal and role'
      USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM app.trusted_principal p
   WHERE p.id=p_target_root_principal_id AND p.state='ACTIVE' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'root change target Principal is not active'
      USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM app.principal_epoch pe
   WHERE pe.principal_id=p_target_root_principal_id
     AND pe.current_epoch=1 FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'root change target Principal epoch is not initial'
      USING ERRCODE='40001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM app.bootstrap_operator_r3 o
     WHERE o.principal_id=p_target_root_principal_id
        OR o.role_name=p_target_root_role_name
  ) THEN
    RAISE EXCEPTION 'root change target identity was already used or is inactive'
      USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_active
    FROM app.bootstrap_recovery_r2
   WHERE bootstrap_id=p_bootstrap_id
     AND from_generation=lc.bootstrap_generation
     AND state IN ('PENDING','APPROVED')
   ORDER BY attempt_sequence
   FOR UPDATE;
  IF FOUND AND v_now>=v_active.approval_expires_at THEN
    PERFORM app_private.terminalize_expired_root_change_r5(
      v_active.id,'BEGIN_EXPIRED_SWEEP',v_now
    );
    SELECT * INTO lc FROM app.bootstrap_lifecycle_r2
     WHERE bootstrap_id=p_bootstrap_id FOR UPDATE;
  END IF;
  IF EXISTS (
    SELECT 1 FROM app.bootstrap_recovery_r2 r
     WHERE r.bootstrap_id=p_bootstrap_id
       AND r.from_generation=lc.bootstrap_generation
       AND r.state IN ('PENDING','APPROVED')
  ) THEN
    RAISE EXCEPTION 'active recovery attempt already exists'
      USING ERRCODE='40001';
  END IF;

  v_seq:=app_private.next_bootstrap_recovery_sequence_r4(
    p_bootstrap_id,lc.bootstrap_generation
  );
  SELECT a.backend_start INTO v_backend_start
    FROM pg_catalog.pg_stat_activity a
   WHERE a.pid=pg_catalog.pg_backend_pid() AND a.usename=session_user;
  IF v_backend_start IS NULL THEN
    RAISE EXCEPTION 'root change backend identity unavailable'
      USING ERRCODE='42501';
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
    current_root_principal_id,target_root_principal_id,
    target_root_role_name,target_token_digest,requested_by_role,
    requested_by_principal_id,requested_at,approval_expires_at,
    request_id,request_hash,content_digest,attempt_sequence
  ) VALUES(
    p_recovery_id,p_bootstrap_id,lc.bootstrap_generation,p_kind,p_reason_class,
    'PENDING',lc.root_principal_id,p_target_root_principal_id,
    p_target_root_role_name,p_target_token_digest,session_user,op.principal_id,
    v_now,v_now+interval '30 minutes',
    p_request_id,v_hash,v_digest,v_seq
  );
  INSERT INTO app.bootstrap_recovery_approval_r2(
    recovery_id,operator_kind,role_name,principal_id,backend_pid,
    backend_started_at,approved_at,request_id,request_hash
  ) SELECT
    p_recovery_id,'INITIATOR',session_user,op.principal_id,
    pg_catalog.pg_backend_pid(),v_backend_start,v_now,
    p_request_id,v_hash;
  UPDATE app.bootstrap_lifecycle_r2
     SET state=CASE p_kind WHEN 'ROTATION' THEN 'ROOT_ROTATION_PENDING'
                           ELSE 'RECOVERY_PENDING' END,
         recovery_request_id=p_recovery_id,
         state_revision=state_revision+1,updated_at=v_now
   WHERE bootstrap_id=p_bootstrap_id
     AND bootstrap_generation=lc.bootstrap_generation;
  PERFORM app_private.append_bootstrap_event_r2(
    CASE p_kind WHEN 'ROTATION' THEN 'ROTATION_REQUESTED'
                ELSE 'RECOVERY_REQUESTED' END,
    p_bootstrap_id,lc.bootstrap_generation,session_user,op.principal_id,
    NULL,NULL
  );
  PERFORM app_private.complete_bootstrap_request_r2(
    'BOOTSTRAP_BEGIN_ROOT_CHANGE_R4',p_request_id,p_recovery_id
  );
  RETURN QUERY SELECT p_recovery_id,v_seq;
END
$$;

CREATE OR REPLACE FUNCTION app.bootstrap_execute_root_change_r4(
  p_recovery_id text,
  p_request_id text,
  p_request_key text
) RETURNS TABLE(result_code text,new_generation bigint)
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
  v_init app.bootstrap_recovery_approval_r2%ROWTYPE;
  v_appr app.bootstrap_recovery_approval_r2%ROWTYPE;
  v_active_operators integer;
  v_active_principals integer;
  v_now timestamptz;
BEGIN
  IF session_user<>'elevator_session_bootstrap_seed' THEN
    RAISE EXCEPTION 'bootstrap seed role required' USING ERRCODE='42501';
  END IF;
  PERFORM app_private.lock_bootstrap_identity_r5();
  SELECT * INTO STRICT rr FROM app.bootstrap_recovery_r2
   WHERE id=p_recovery_id FOR UPDATE;
  v_hash:=app_private.r6_request_hash(jsonb_build_object(
    'operation','BOOTSTRAP_EXECUTE_ROOT_CHANGE_R4',
    'recoveryId',p_recovery_id,'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result
    FROM app_private.claim_bootstrap_request_r2(
      'BOOTSTRAP_EXECUTE_ROOT_CHANGE_R4',p_request_id,v_hash,rr.bootstrap_id,
      rr.from_generation,session_user,rr.requested_by_principal_id,
      'BOOTSTRAP_GENERATION_R4'
    );
  IF v_replay THEN
    IF v_result='LOCKED' THEN
      RETURN QUERY SELECT 'LOCKED',NULL::bigint;
    ELSE
      RETURN QUERY SELECT 'GENERATION',
        substring(v_result from length('GENERATION:')+1)::bigint;
    END IF;
    RETURN;
  END IF;

  v_now:=clock_timestamp();
  IF v_now>=rr.approval_expires_at THEN
    PERFORM app_private.terminalize_expired_root_change_r5(
      p_recovery_id,'EXECUTE_EXPIRY',v_now
    );
    PERFORM app_private.complete_bootstrap_request_r2(
      'BOOTSTRAP_EXECUTE_ROOT_CHANGE_R4',p_request_id,'LOCKED'
    );
    RETURN QUERY SELECT 'LOCKED',NULL::bigint;
    RETURN;
  END IF;
  IF rr.state<>'APPROVED' THEN
    RAISE EXCEPTION 'root change lacks two approvals' USING ERRCODE='42501';
  END IF;
  SELECT * INTO STRICT lc FROM app.bootstrap_lifecycle_r2
   WHERE bootstrap_id=rr.bootstrap_id
     AND bootstrap_generation=rr.from_generation FOR UPDATE;
  IF lc.state NOT IN (
    'RECOVERY_APPROVED','ROOT_ROTATION_PENDING','ROOT_ISSUANCE_PENDING'
  ) THEN
    RAISE EXCEPTION 'root change lifecycle state invalid' USING ERRCODE='40001';
  END IF;
  IF lc.root_principal_id<>rr.current_root_principal_id
     OR rr.target_root_principal_id=lc.root_principal_id
     OR rr.target_root_role_name=lc.root_role_name THEN
    RAISE EXCEPTION 'root change lifecycle identity mismatch'
      USING ERRCODE='40001';
  END IF;

  -- P2-01: authorization is evaluated immediately before the Effect. The
  -- identity mutex prevents a revoke from committing between this check and
  -- the Generation insert. A Generation BEFORE INSERT trigger repeats it.
  IF rr.kind='ROTATION' THEN
    PERFORM app_private.assert_current_root_authority_r5(
      rr.bootstrap_id,rr.from_generation,lc.root_session_id,
      lc.root_principal_id,lc.root_role_name,lc.root_grant_id,v_now,false
    );
  END IF;

  SELECT * INTO STRICT v_init FROM app.bootstrap_recovery_approval_r2
   WHERE recovery_id=p_recovery_id AND operator_kind='INITIATOR';
  SELECT * INTO STRICT v_appr FROM app.bootstrap_recovery_approval_r2
   WHERE recovery_id=p_recovery_id AND operator_kind='APPROVER';
  PERFORM 1
    FROM app.bootstrap_recovery_approval_r2 a
    JOIN app.bootstrap_operator_r3 o
      ON o.role_name=a.role_name
     AND o.operator_kind=a.operator_kind
     AND o.principal_id=a.principal_id
   WHERE a.recovery_id=p_recovery_id
   FOR SHARE OF o;
  GET DIAGNOSTICS v_active_operators=ROW_COUNT;
  PERFORM 1 FROM app.trusted_principal p
   WHERE p.id IN (v_init.principal_id,v_appr.principal_id)
     AND p.state='ACTIVE'
   FOR SHARE;
  GET DIAGNOSTICS v_active_principals=ROW_COUNT;
  IF v_init.principal_id=v_appr.principal_id
     OR v_init.principal_id IN (
       rr.current_root_principal_id,rr.target_root_principal_id
     )
     OR v_appr.principal_id IN (
       rr.current_root_principal_id,rr.target_root_principal_id
     )
     OR v_active_operators<>2
     OR v_active_principals<>2
     OR EXISTS (
       SELECT 1
         FROM app.bootstrap_recovery_approval_r2 a
         JOIN app.bootstrap_operator_r3 o
           ON o.role_name=a.role_name
          AND o.operator_kind=a.operator_kind
          AND o.principal_id=a.principal_id
        WHERE a.recovery_id=p_recovery_id AND NOT o.enabled
     ) THEN
    RAISE EXCEPTION 'root change approvals invalid' USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM app.trusted_principal p
   WHERE p.id=rr.target_root_principal_id AND p.state='ACTIVE' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'root change target Principal is not active'
      USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM app.principal_epoch pe
   WHERE pe.principal_id=rr.target_root_principal_id
     AND pe.current_epoch=1 FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'root change target Principal epoch is not initial'
      USING ERRCODE='40001';
  END IF;

  UPDATE app.bootstrap_operator_r3 SET enabled=false
   WHERE operator_kind='ROOT' AND principal_id=rr.current_root_principal_id;
  INSERT INTO app.bootstrap_operator_r3(
    role_name,operator_kind,principal_id,token_digest,enabled,provisioned_at
  ) VALUES(
    rr.target_root_role_name,'ROOT',rr.target_root_principal_id,
    rr.target_token_digest,true,v_now
  );
  UPDATE app.bootstrap_generation_r2
     SET activation_state='SUPERSEDED',superseded_at=v_now
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
    v_now,
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
    rr.bootstrap_id,v_new_generation,a.operator_kind,a.role_name,
    a.principal_id,rr.target_root_principal_id,a.backend_pid,
    a.backend_started_at,a.approved_at,a.request_id,a.request_hash
  FROM app.bootstrap_recovery_approval_r2 a
  WHERE a.recovery_id=p_recovery_id;
  UPDATE app.authority_grant
     SET revoked_at=v_now,
         revocation_reason='ROOT_CHANGE:'||rr.reason_class
   WHERE id=lc.root_grant_id AND revoked_at IS NULL;
  UPDATE app.bootstrap_root_session_r2
     SET state='REVOKED',revoked_at=v_now
   WHERE bootstrap_id=rr.bootstrap_id
     AND bootstrap_generation=rr.from_generation AND state='ACTIVE';
  UPDATE app.trusted_session
     SET state='REVOKED',binding_state='REVOKED',revoked_at=v_now,
         revocation_reason='ROOT_CHANGE:'||rr.reason_class,
         termination_class=CASE rr.reason_class
           WHEN 'CREDENTIAL_COMPROMISE' THEN 'SECURITY_REVOKE'
           ELSE 'ADMIN_REVOKE' END
   WHERE session_id=lc.root_session_id AND state='ACTIVE';
  PERFORM app_private.append_bootstrap_event_r2(
    CASE rr.kind WHEN 'ROTATION' THEN 'ROTATION_EXECUTED'
                 ELSE 'RECOVERY_EXECUTED' END,
    rr.bootstrap_id,rr.from_generation,session_user,
    v_init.principal_id,NULL,NULL
  );
  UPDATE app.bootstrap_state_r3
     SET state='PREPARED',bootstrap_generation=v_new_generation,
         root_principal_id=rr.target_root_principal_id,
         root_role_name=rr.target_root_role_name,
         root_token_digest=rr.target_token_digest,
         prepared_at=v_now,completed_at=NULL,
         root_grant_id=NULL,root_session_id=NULL,
         root_grant_issuer_principal_id=NULL
   WHERE singleton=rr.bootstrap_id;
  UPDATE app.bootstrap_lifecycle_r2
     SET bootstrap_generation=v_new_generation,state='ROOT_ISSUANCE_PENDING',
         state_revision=state_revision+1,
         root_principal_id=rr.target_root_principal_id,
         root_role_name=rr.target_root_role_name,
         root_session_id=NULL,root_grant_id=NULL,
         recovery_request_id=p_recovery_id,updated_at=v_now
   WHERE bootstrap_id=rr.bootstrap_id
     AND bootstrap_generation=rr.from_generation;
  UPDATE app.bootstrap_recovery_r2
     SET state='EXECUTED',executed_at=v_now,
         new_generation=v_new_generation
   WHERE id=p_recovery_id;
  PERFORM app_private.complete_bootstrap_request_r2(
    'BOOTSTRAP_EXECUTE_ROOT_CHANGE_R4',p_request_id,
    'GENERATION:'||v_new_generation::text
  );
  RETURN QUERY SELECT 'GENERATION',v_new_generation;
END
$$;

CREATE OR REPLACE FUNCTION app.bootstrap_deny_root_change_r4(
  p_recovery_id text,
  p_reason text,
  p_request_id text,
  p_request_key text
) RETURNS text
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
  PERFORM app_private.lock_bootstrap_identity_r5();
  SELECT * INTO STRICT rr FROM app.bootstrap_recovery_r2
   WHERE id=p_recovery_id FOR UPDATE;
  SELECT * INTO STRICT op FROM app.bootstrap_operator_r3
   WHERE role_name=session_user AND operator_kind='APPROVER'
     AND principal_id<>rr.requested_by_principal_id
     AND principal_id<>rr.current_root_principal_id
     AND principal_id<>rr.target_root_principal_id
     AND enabled FOR SHARE;
  PERFORM 1 FROM app.trusted_principal p
   WHERE p.id=op.principal_id AND p.state='ACTIVE' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'root change deny Principal is not active'
      USING ERRCODE='42501';
  END IF;
  v_hash:=app_private.r6_request_hash(jsonb_build_object(
    'operation','BOOTSTRAP_DENY_ROOT_CHANGE_R4',
    'recoveryId',p_recovery_id,'reason',p_reason,
    'requestKey',p_request_key
  ));
  SELECT * INTO v_replay,v_result FROM app_private.claim_bootstrap_request_r2(
    'BOOTSTRAP_DENY_ROOT_CHANGE_R4',p_request_id,v_hash,rr.bootstrap_id,
    rr.from_generation,session_user,op.principal_id,'BOOTSTRAP_RECOVERY'
  );
  IF v_replay THEN RETURN v_result; END IF;
  IF rr.state NOT IN ('PENDING','APPROVED') THEN
    RAISE EXCEPTION 'root change cannot be denied in current state'
      USING ERRCODE='40001';
  END IF;
  UPDATE app.bootstrap_recovery_r2
     SET state='DENIED',locked_at=clock_timestamp(),denial_reason=p_reason
   WHERE id=p_recovery_id;
  UPDATE app.bootstrap_lifecycle_r2
     SET state='LOCKED',locked_reason_code='APPROVER_DENIED',
         state_revision=state_revision+1,updated_at=clock_timestamp()
   WHERE bootstrap_id=rr.bootstrap_id
     AND bootstrap_generation=rr.from_generation;
  PERFORM app_private.append_bootstrap_event_r2(
    'LOCKED',rr.bootstrap_id,rr.from_generation,
    session_user,op.principal_id,NULL,NULL
  );
  PERFORM app_private.complete_bootstrap_request_r2(
    'BOOTSTRAP_DENY_ROOT_CHANGE_R4',p_request_id,'DENIED'
  );
  RETURN 'DENIED';
END
$$;

-- ===========================================================================
-- 4. Controlled Candidate materialization with durable per-row audit
-- ===========================================================================

CREATE TABLE app.candidate_backfill_batch_r5 (
  id text PRIMARY KEY,
  request_id text NOT NULL UNIQUE,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  target_table text NOT NULL CHECK (
    target_table IN (
      'selection_professional_review_result',
      'sales_snapshot_professional_review_r3'
    )
  ),
  policy_version text NOT NULL CHECK (
    policy_version='AIEA-CANDIDATE-BACKFILL-R5-V1'
  ),
  expected_rows bigint NOT NULL CHECK (expected_rows>=0),
  applied_rows bigint NOT NULL DEFAULT 0 CHECK (applied_rows>=0),
  failed_rows bigint NOT NULL DEFAULT 0 CHECK (failed_rows>=0),
  state text NOT NULL CHECK (state IN ('RUNNING','COMPLETED')),
  actor_principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  actor_session_id text NOT NULL REFERENCES app.trusted_session(session_id),
  actor_authority_grant_id text NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason))>0),
  started_at timestamptz(6) NOT NULL,
  completed_at timestamptz(6),
  batch_digest text CHECK (
    batch_digest IS NULL OR batch_digest ~ '^[0-9a-f]{64}$'
  ),
  CHECK (
    (state='RUNNING'
      AND completed_at IS NULL
      AND batch_digest IS NULL
      AND failed_rows=0)
    OR (state='COMPLETED'
      AND completed_at IS NOT NULL
      AND batch_digest IS NOT NULL
      AND applied_rows=expected_rows
      AND failed_rows=0)
  ),
  FOREIGN KEY (actor_authority_grant_id,actor_session_id,actor_principal_id)
    REFERENCES app.authority_grant(id,session_id,principal_id)
);

CREATE TABLE app.candidate_backfill_row_audit_r5 (
  id text PRIMARY KEY,
  batch_id text NOT NULL REFERENCES app.candidate_backfill_batch_r5(id),
  target_table text NOT NULL CHECK (
    target_table IN (
      'selection_professional_review_result',
      'sales_snapshot_professional_review_r3'
    )
  ),
  target_row_key text NOT NULL,
  target_row_key_digest text NOT NULL CHECK (
    target_row_key_digest ~ '^[0-9a-f]{64}$'
  ),
  old_candidate_was_null boolean NOT NULL CHECK (old_candidate_was_null),
  old_candidate_id text CHECK (old_candidate_id IS NULL),
  new_candidate_id text NOT NULL CHECK (length(new_candidate_id)>0),
  provenance_type text NOT NULL,
  provenance_record_id text NOT NULL,
  provenance_version bigint NOT NULL CHECK (provenance_version>0),
  provenance_policy_version text NOT NULL CHECK (
    provenance_policy_version='AIEA-CANDIDATE-BACKFILL-R5-V1'
  ),
  target_parent_state text NOT NULL,
  old_row_digest text NOT NULL CHECK (old_row_digest ~ '^[0-9a-f]{64}$'),
  new_row_digest text NOT NULL CHECK (new_row_digest ~ '^[0-9a-f]{64}$'),
  original_sealed_digest text NOT NULL CHECK (
    original_sealed_digest ~ '^[0-9a-f]{64}$'
  ),
  correction_digest text NOT NULL CHECK (
    correction_digest ~ '^[0-9a-f]{64}$'
  ),
  actor_principal_id text NOT NULL REFERENCES app.trusted_principal(id),
  actor_session_id text NOT NULL REFERENCES app.trusted_session(session_id),
  actor_authority_grant_id text NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason))>0),
  audit_event_id text NOT NULL REFERENCES app.review_audit(id),
  occurred_at timestamptz(6) NOT NULL,
  success boolean NOT NULL CHECK (success),
  UNIQUE (batch_id,target_table,target_row_key_digest),
  FOREIGN KEY (actor_authority_grant_id,actor_session_id,actor_principal_id)
    REFERENCES app.authority_grant(id,session_id,principal_id)
);

CREATE OR REPLACE FUNCTION app_private.execute_candidate_backfill_r5(
  p_batch_id text,
  p_target_table text,
  p_request_id text,
  p_request_key text,
  p_actor_principal_id text,
  p_actor_session_id text,
  p_actor_authority_grant_id text,
  p_reason text,
  p_expected_rows bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_hash text;
  v_now timestamptz:=clock_timestamp();
  v_inserted boolean:=false;
  v_batch app.candidate_backfill_batch_r5%ROWTYPE;
  v_count bigint;
  v_applied bigint:=0;
  v_updated integer;
  v_row app.selection_professional_review_result%ROWTYPE;
  v_snapshot app.sales_snapshot_professional_review_r3%ROWTYPE;
  v_source_event_id text;
  v_source_candidate_id text;
  v_source_state text;
  v_original_digest text;
  v_old_json jsonb;
  v_new_json jsonb;
  v_old_digest text;
  v_new_digest text;
  v_row_key text;
  v_row_key_digest text;
  v_audit_id text;
  v_audit_event_id text;
  v_correction_digest text;
  v_batch_digest text;
BEGIN
  IF p_batch_id IS NULL OR length(btrim(p_batch_id))=0
     OR p_request_id IS NULL OR length(btrim(p_request_id))=0
     OR p_actor_principal_id IS NULL
     OR p_actor_session_id IS NULL
     OR p_actor_authority_grant_id IS NULL
     OR p_reason IS NULL OR length(btrim(p_reason))=0
     OR p_expected_rows IS NULL OR p_expected_rows<0 THEN
    RAISE EXCEPTION 'candidate backfill request is incomplete'
      USING ERRCODE='22023';
  END IF;
  IF p_target_table NOT IN (
    'selection_professional_review_result',
    'sales_snapshot_professional_review_r3'
  ) THEN
    RAISE EXCEPTION 'candidate backfill target table invalid'
      USING ERRCODE='22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM app.trusted_session ts
      JOIN app.trusted_principal p
        ON p.id=ts.principal_id AND p.state='ACTIVE'
      JOIN app.principal_epoch pe
        ON pe.principal_id=ts.principal_id
       AND pe.current_epoch=ts.login_epoch
      JOIN app.authority_grant ag
        ON ag.id=p_actor_authority_grant_id
       AND ag.session_id=ts.session_id
       AND ag.principal_id=ts.principal_id
     WHERE ts.session_id=p_actor_session_id
       AND ts.principal_id=p_actor_principal_id
       AND ts.state='ACTIVE'
       AND v_now>=ts.not_before
       AND v_now<ts.expires_at
       AND ag.revoked_at IS NULL
       AND v_now>=ag.valid_from
       AND (ag.valid_until IS NULL OR v_now<ag.valid_until)
  ) THEN
    RAISE EXCEPTION 'candidate backfill actor authority is not active'
      USING ERRCODE='42501';
  END IF;

  v_hash:=app_private.r6_request_hash(jsonb_build_object(
    'operation','CANDIDATE_BACKFILL_R5',
    'batchId',p_batch_id,
    'targetTable',p_target_table,
    'actorPrincipalId',p_actor_principal_id,
    'actorSessionId',p_actor_session_id,
    'actorAuthorityGrantId',p_actor_authority_grant_id,
    'reason',p_reason,
    'expectedRows',p_expected_rows,
    'requestKey',p_request_key
  ));

  INSERT INTO app.candidate_backfill_batch_r5(
    id,request_id,request_hash,target_table,policy_version,expected_rows,
    applied_rows,failed_rows,state,actor_principal_id,actor_session_id,
    actor_authority_grant_id,reason,started_at,completed_at,batch_digest
  ) VALUES(
    p_batch_id,p_request_id,v_hash,p_target_table,
    'AIEA-CANDIDATE-BACKFILL-R5-V1',p_expected_rows,0,0,'RUNNING',
    p_actor_principal_id,p_actor_session_id,p_actor_authority_grant_id,
    p_reason,v_now,NULL,NULL
  )
  ON CONFLICT (request_id) DO NOTHING
  RETURNING true INTO v_inserted;

  IF COALESCE(v_inserted,false) IS FALSE THEN
    SELECT * INTO STRICT v_batch
      FROM app.candidate_backfill_batch_r5
     WHERE request_id=p_request_id
     FOR UPDATE;
    IF v_batch.id<>p_batch_id
       OR v_batch.request_hash<>v_hash
       OR v_batch.target_table<>p_target_table
       OR v_batch.expected_rows<>p_expected_rows
       OR v_batch.actor_principal_id<>p_actor_principal_id
       OR v_batch.actor_session_id<>p_actor_session_id
       OR v_batch.actor_authority_grant_id<>p_actor_authority_grant_id THEN
      RAISE EXCEPTION 'candidate backfill request identity conflict'
        USING ERRCODE='40001';
    END IF;
    IF v_batch.state<>'COMPLETED' THEN
      RAISE EXCEPTION 'candidate backfill batch already in progress'
        USING ERRCODE='40001';
    END IF;
    RETURN jsonb_build_object(
      'replay',true,
      'batchId',v_batch.id,
      'requestId',v_batch.request_id,
      'targetTable',v_batch.target_table,
      'expectedRows',v_batch.expected_rows,
      'appliedRows',v_batch.applied_rows,
      'failedRows',v_batch.failed_rows,
      'batchDigest',v_batch.batch_digest
    );
  END IF;

  -- Freeze every source and target relation for the transaction. The caller
  -- must use one explicit database transaction for the complete migration step.
  LOCK TABLE
    app.professional_review_event,
    app.selection_professional_review_result,
    app.sales_handoff_snapshot_r3,
    app.sales_snapshot_professional_review_r3
  IN SHARE ROW EXCLUSIVE MODE;

  IF p_target_table='selection_professional_review_result' THEN
    SELECT count(*) INTO v_count
      FROM app.selection_professional_review_result
     WHERE candidate_id IS NULL;
    IF v_count<>p_expected_rows THEN
      RAISE EXCEPTION 'candidate backfill Selection row count mismatch'
        USING ERRCODE='40001';
    END IF;

    FOR v_row IN
      SELECT *
        FROM app.selection_professional_review_result
       WHERE candidate_id IS NULL
       ORDER BY selection_run_id,professional_review_id,event_sequence
       FOR UPDATE
    LOOP
      SELECT e.id,e.candidate_id,sr.state,seal.result_digest
        INTO STRICT v_source_event_id,v_source_candidate_id,
                    v_source_state,v_original_digest
        FROM app.professional_review_event e
        JOIN app.selection_run sr
          ON sr.id=v_row.selection_run_id
        JOIN app.selection_run_seal seal
          ON seal.selection_run_id=v_row.selection_run_id
       WHERE e.id=v_row.professional_review_event_id;
      IF v_source_candidate_id IS NULL THEN
        RAISE EXCEPTION 'candidate backfill Selection source is unresolved'
          USING ERRCODE='23502';
      END IF;

      v_row_key:=jsonb_build_object(
        'selectionRunId',v_row.selection_run_id,
        'professionalReviewId',v_row.professional_review_id,
        'eventSequence',v_row.event_sequence
      )::text;
      v_row_key_digest:=app_private.sha256_hex(
        convert_to(v_row_key,'UTF8')
      );
      v_old_json:=to_jsonb(v_row);
      v_new_json:=jsonb_set(
        v_old_json,'{candidate_id}',to_jsonb(v_source_candidate_id),true
      );
      v_old_digest:=app_private.sha256_hex(convert_to(
        jsonb_build_object(
          'schema','AIEA-CANDIDATE-BACKFILL-ROW-V1',
          'table',p_target_table,
          'rowKey',v_row_key,
          'row',v_old_json
        )::text,'UTF8'
      ));
      v_new_digest:=app_private.sha256_hex(convert_to(
        jsonb_build_object(
          'schema','AIEA-CANDIDATE-BACKFILL-ROW-V1',
          'table',p_target_table,
          'rowKey',v_row_key,
          'row',v_new_json
        )::text,'UTF8'
      ));
      v_correction_digest:=app_private.sha256_hex(convert_to(
        jsonb_build_object(
          'schema','AIEA-CANDIDATE-BACKFILL-CORRECTION-V1',
          'originalSealedDigest',v_original_digest,
          'oldRowDigest',v_old_digest,
          'newRowDigest',v_new_digest,
          'candidateId',v_source_candidate_id,
          'sourceEventId',v_source_event_id
        )::text,'UTF8'
      ));
      v_audit_id:=app_private.sha256_hex(convert_to(concat_ws(
        ':',p_batch_id,p_target_table,v_row_key_digest
      ),'UTF8'));
      v_audit_event_id:=gen_random_uuid()::text;
      INSERT INTO app.review_audit(
        id,review_id,event_id,action,actor_principal_id,occurred_at
      ) VALUES(
        v_audit_event_id,v_row.professional_review_id,
        v_row.professional_review_event_id,
        'CANDIDATE_BACKFILL_R5',p_actor_principal_id,v_now
      );
      INSERT INTO app.candidate_backfill_row_audit_r5(
        id,batch_id,target_table,target_row_key,target_row_key_digest,
        old_candidate_was_null,old_candidate_id,new_candidate_id,
        provenance_type,provenance_record_id,provenance_version,
        provenance_policy_version,target_parent_state,old_row_digest,
        new_row_digest,original_sealed_digest,correction_digest,
        actor_principal_id,actor_session_id,actor_authority_grant_id,
        reason,audit_event_id,occurred_at,success
      ) VALUES(
        v_audit_id,p_batch_id,p_target_table,v_row_key,v_row_key_digest,
        true,NULL,v_source_candidate_id,
        'PROFESSIONAL_REVIEW_EVENT',v_source_event_id,
        v_row.event_sequence,'AIEA-CANDIDATE-BACKFILL-R5-V1',
        v_source_state,v_old_digest,v_new_digest,v_original_digest,
        v_correction_digest,p_actor_principal_id,p_actor_session_id,
        p_actor_authority_grant_id,p_reason,v_audit_event_id,v_now,true
      );
      UPDATE app.selection_professional_review_result
         SET candidate_id=v_source_candidate_id
       WHERE selection_run_id=v_row.selection_run_id
         AND professional_review_id=v_row.professional_review_id
         AND event_sequence=v_row.event_sequence
         AND candidate_id IS NULL;
      GET DIAGNOSTICS v_updated=ROW_COUNT;
      IF v_updated<>1 THEN
        RAISE EXCEPTION 'candidate backfill Selection row update mismatch'
          USING ERRCODE='40001';
      END IF;
      v_applied:=v_applied+1;
    END LOOP;
  ELSE
    SELECT count(*) INTO v_count
      FROM app.sales_snapshot_professional_review_r3
     WHERE candidate_id IS NULL;
    IF v_count<>p_expected_rows THEN
      RAISE EXCEPTION 'candidate backfill Snapshot row count mismatch'
        USING ERRCODE='40001';
    END IF;

    FOR v_snapshot IN
      SELECT *
        FROM app.sales_snapshot_professional_review_r3
       WHERE candidate_id IS NULL
       ORDER BY snapshot_id,professional_review_id,event_sequence
       FOR UPDATE
    LOOP
      SELECT src.professional_review_event_id,src.candidate_id,
             header.state,seal.result_digest
        INTO STRICT v_source_event_id,v_source_candidate_id,
                    v_source_state,v_original_digest
        FROM app.selection_professional_review_result src
        JOIN app.sales_handoff_snapshot_r3 header
          ON header.id=v_snapshot.snapshot_id
        JOIN app.selection_run_seal seal
          ON seal.selection_run_id=src.selection_run_id
       WHERE src.selection_run_id=v_snapshot.selection_run_id
         AND src.professional_review_id=v_snapshot.professional_review_id
         AND src.event_sequence=v_snapshot.event_sequence;
      IF v_source_candidate_id IS NULL THEN
        RAISE EXCEPTION 'candidate backfill Snapshot source is unresolved'
          USING ERRCODE='23502';
      END IF;

      v_row_key:=jsonb_build_object(
        'snapshotId',v_snapshot.snapshot_id,
        'professionalReviewId',v_snapshot.professional_review_id,
        'eventSequence',v_snapshot.event_sequence
      )::text;
      v_row_key_digest:=app_private.sha256_hex(
        convert_to(v_row_key,'UTF8')
      );
      v_old_json:=to_jsonb(v_snapshot);
      v_new_json:=jsonb_set(
        v_old_json,'{candidate_id}',to_jsonb(v_source_candidate_id),true
      );
      v_old_digest:=app_private.sha256_hex(convert_to(
        jsonb_build_object(
          'schema','AIEA-CANDIDATE-BACKFILL-ROW-V1',
          'table',p_target_table,
          'rowKey',v_row_key,
          'row',v_old_json
        )::text,'UTF8'
      ));
      v_new_digest:=app_private.sha256_hex(convert_to(
        jsonb_build_object(
          'schema','AIEA-CANDIDATE-BACKFILL-ROW-V1',
          'table',p_target_table,
          'rowKey',v_row_key,
          'row',v_new_json
        )::text,'UTF8'
      ));
      v_correction_digest:=app_private.sha256_hex(convert_to(
        jsonb_build_object(
          'schema','AIEA-CANDIDATE-BACKFILL-CORRECTION-V1',
          'originalSealedDigest',v_original_digest,
          'oldRowDigest',v_old_digest,
          'newRowDigest',v_new_digest,
          'candidateId',v_source_candidate_id,
          'sourceEventId',v_source_event_id
        )::text,'UTF8'
      ));
      v_audit_id:=app_private.sha256_hex(convert_to(concat_ws(
        ':',p_batch_id,p_target_table,v_row_key_digest
      ),'UTF8'));
      v_audit_event_id:=gen_random_uuid()::text;
      INSERT INTO app.review_audit(
        id,review_id,event_id,action,actor_principal_id,occurred_at
      ) VALUES(
        v_audit_event_id,v_snapshot.professional_review_id,
        v_snapshot.professional_review_event_id,
        'CANDIDATE_BACKFILL_R5',p_actor_principal_id,v_now
      );
      INSERT INTO app.candidate_backfill_row_audit_r5(
        id,batch_id,target_table,target_row_key,target_row_key_digest,
        old_candidate_was_null,old_candidate_id,new_candidate_id,
        provenance_type,provenance_record_id,provenance_version,
        provenance_policy_version,target_parent_state,old_row_digest,
        new_row_digest,original_sealed_digest,correction_digest,
        actor_principal_id,actor_session_id,actor_authority_grant_id,
        reason,audit_event_id,occurred_at,success
      ) VALUES(
        v_audit_id,p_batch_id,p_target_table,v_row_key,v_row_key_digest,
        true,NULL,v_source_candidate_id,
        'SELECTION_PROFESSIONAL_REVIEW_RESULT',v_source_event_id,
        v_snapshot.event_sequence,'AIEA-CANDIDATE-BACKFILL-R5-V1',
        v_source_state,v_old_digest,v_new_digest,v_original_digest,
        v_correction_digest,p_actor_principal_id,p_actor_session_id,
        p_actor_authority_grant_id,p_reason,v_audit_event_id,v_now,true
      );
      UPDATE app.sales_snapshot_professional_review_r3
         SET candidate_id=v_source_candidate_id
       WHERE snapshot_id=v_snapshot.snapshot_id
         AND professional_review_id=v_snapshot.professional_review_id
         AND event_sequence=v_snapshot.event_sequence
         AND candidate_id IS NULL;
      GET DIAGNOSTICS v_updated=ROW_COUNT;
      IF v_updated<>1 THEN
        RAISE EXCEPTION 'candidate backfill Snapshot row update mismatch'
          USING ERRCODE='40001';
      END IF;
      v_applied:=v_applied+1;
    END LOOP;
  END IF;

  IF v_applied<>p_expected_rows THEN
    RAISE EXCEPTION 'candidate backfill applied row count mismatch'
      USING ERRCODE='40001';
  END IF;
  SELECT app_private.sha256_hex(convert_to(
    COALESCE(string_agg(correction_digest,'' ORDER BY target_row_key_digest),''),
    'UTF8'
  )) INTO v_batch_digest
    FROM app.candidate_backfill_row_audit_r5
   WHERE batch_id=p_batch_id;

  UPDATE app.candidate_backfill_batch_r5
     SET applied_rows=v_applied,failed_rows=0,state='COMPLETED',
         completed_at=v_now,batch_digest=v_batch_digest
   WHERE id=p_batch_id AND state='RUNNING';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'candidate backfill batch completion failed'
      USING ERRCODE='40001';
  END IF;

  RETURN jsonb_build_object(
    'replay',false,
    'batchId',p_batch_id,
    'requestId',p_request_id,
    'targetTable',p_target_table,
    'expectedRows',p_expected_rows,
    'appliedRows',v_applied,
    'failedRows',0,
    'batchDigest',v_batch_digest
  );
END
$$;

CREATE OR REPLACE FUNCTION app_private.guard_candidate_backfill_batch_r5()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'candidate backfill batch delete denied'
      USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' THEN
    IF (
      NEW.id,NEW.request_id,NEW.request_hash,NEW.target_table,
      NEW.policy_version,NEW.expected_rows,NEW.actor_principal_id,
      NEW.actor_session_id,NEW.actor_authority_grant_id,NEW.reason,
      NEW.started_at
    ) IS DISTINCT FROM (
      OLD.id,OLD.request_id,OLD.request_hash,OLD.target_table,
      OLD.policy_version,OLD.expected_rows,OLD.actor_principal_id,
      OLD.actor_session_id,OLD.actor_authority_grant_id,OLD.reason,
      OLD.started_at
    ) THEN
      RAISE EXCEPTION 'candidate backfill batch identity immutable'
        USING ERRCODE='23514';
    END IF;
    IF OLD.state<>'RUNNING' OR NEW.state<>'COMPLETED'
       OR NEW.applied_rows<>NEW.expected_rows
       OR NEW.failed_rows<>0
       OR NEW.batch_digest IS NULL
       OR NEW.completed_at IS NULL THEN
      RAISE EXCEPTION 'candidate backfill batch transition invalid'
        USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN COALESCE(NEW,OLD);
END
$$;

CREATE TRIGGER r5_guard_candidate_backfill_batch
BEFORE UPDATE OR DELETE ON app.candidate_backfill_batch_r5
FOR EACH ROW EXECUTE FUNCTION app_private.guard_candidate_backfill_batch_r5();
CREATE TRIGGER r5_deny_candidate_backfill_batch_truncate
BEFORE TRUNCATE ON app.candidate_backfill_batch_r5
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();

CREATE TRIGGER r5_guard_candidate_backfill_row_audit
BEFORE UPDATE OR DELETE ON app.candidate_backfill_row_audit_r5
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER r5_deny_candidate_backfill_row_audit_truncate
BEFORE TRUNCATE ON app.candidate_backfill_row_audit_r5
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();

CREATE TRIGGER r5_guard_terminalization
BEFORE UPDATE OR DELETE ON app.bootstrap_recovery_terminalization_r5
FOR EACH ROW EXECUTE FUNCTION app_private.guard_append_only_r3();
CREATE TRIGGER r5_deny_terminalization_truncate
BEFORE TRUNCATE ON app.bootstrap_recovery_terminalization_r5
FOR EACH STATEMENT EXECUTE FUNCTION app_private.deny_truncate_r3();

-- The complete DDL describes the final state, not a one-shot deployment.
-- Deployment must invoke execute_candidate_backfill_r5 once per target table
-- under separately authorized maintenance identity before this closure block
-- is run in the same controlled migration transaction.
DO $r5_candidate_preflight$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM app.selection_professional_review_result
     WHERE candidate_id IS NULL
  ) OR EXISTS (
    SELECT 1
      FROM app.sales_snapshot_professional_review_r3
     WHERE candidate_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'professional review candidate backfill batches are incomplete'
      USING ERRCODE='23502';
  END IF;
END
$r5_candidate_preflight$;

ALTER TABLE app.selection_professional_review_result
  ALTER COLUMN candidate_id SET NOT NULL;
ALTER TABLE app.sales_snapshot_professional_review_r3
  ALTER COLUMN candidate_id SET NOT NULL;

-- ===========================================================================
-- 5. Ownership, capability closure and fail-closed table ACLs
-- ===========================================================================

ALTER FUNCTION app_private.lock_bootstrap_identity_r5()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.enforce_bootstrap_identity_mutex_r5()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.assert_current_root_authority_r5(
  boolean,bigint,text,text,text,text,timestamptz,boolean
) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.enforce_rotation_generation_revalidation_r5()
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.terminalize_expired_root_change_r5(
  text,text,timestamptz
) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.execute_candidate_backfill_r5(
  text,text,text,text,text,text,text,text,bigint
) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.guard_candidate_backfill_batch_r5()
  OWNER TO elevator_review_function_owner;

ALTER TABLE app.bootstrap_recovery_terminalization_r5
  OWNER TO elevator_table_owner;
ALTER TABLE app.candidate_backfill_batch_r5
  OWNER TO elevator_table_owner;
ALTER TABLE app.candidate_backfill_row_audit_r5
  OWNER TO elevator_table_owner;

REVOKE ALL ON TABLE app.bootstrap_recovery_terminalization_r5 FROM PUBLIC;
REVOKE ALL ON TABLE app.candidate_backfill_batch_r5 FROM PUBLIC;
REVOKE ALL ON TABLE app.candidate_backfill_row_audit_r5 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_private.lock_bootstrap_identity_r5()
  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_private.enforce_bootstrap_identity_mutex_r5()
  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_private.assert_current_root_authority_r5(
  boolean,bigint,text,text,text,text,timestamptz,boolean
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_private.enforce_rotation_generation_revalidation_r5()
  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_private.terminalize_expired_root_change_r5(
  text,text,timestamptz
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_private.execute_candidate_backfill_r5(
  text,text,text,text,text,text,text,text,bigint
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_private.guard_candidate_backfill_batch_r5()
  FROM PUBLIC;

GRANT SELECT,INSERT,UPDATE ON TABLE app.bootstrap_recovery_terminalization_r5
  TO elevator_review_function_owner;
GRANT SELECT,INSERT,UPDATE ON TABLE app.candidate_backfill_batch_r5
  TO elevator_review_function_owner;
GRANT SELECT,INSERT ON TABLE app.candidate_backfill_row_audit_r5
  TO elevator_review_function_owner;

-- Public Recovery capabilities remain exact and do not include any R5 helper.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA app FROM PUBLIC;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA app_private FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.bootstrap_complete_root_r3(
  boolean,text,text,text
) TO elevator_root_issuer;
GRANT EXECUTE ON FUNCTION app.bootstrap_begin_root_change_r4(
  text,boolean,text,text,text,text,text,text,text
) TO elevator_bootstrap_initiator;
GRANT EXECUTE ON FUNCTION app.bootstrap_approve_root_change_r4(text,text,text)
  TO elevator_bootstrap_approver;
GRANT EXECUTE ON FUNCTION app.bootstrap_deny_root_change_r4(text,text,text,text)
  TO elevator_bootstrap_approver;
GRANT EXECUTE ON FUNCTION app.bootstrap_execute_root_change_r4(text,text,text)
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


