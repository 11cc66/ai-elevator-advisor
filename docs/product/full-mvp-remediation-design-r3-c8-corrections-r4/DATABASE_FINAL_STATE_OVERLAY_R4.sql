-- FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS-R4
-- Final-state overlay over the frozen R3 complete DDL.
-- DESIGN ONLY. Do not execute.

-- ===========================================================================
-- 1. ProfessionalReview candidate identity
-- ===========================================================================

-- Migration-only narrow guard exception. It permits exactly one NULL-to-value
-- candidate_id transition and requires every other JSON field to be identical.
-- The existing composite Candidate FK remains the authority for the value.
CREATE OR REPLACE FUNCTION app_private.r4_candidate_backfill_row_allowed(
  p_old jsonb,
  p_new jsonb
) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path=pg_catalog
RETURN (
  p_old->>'candidate_id' IS NULL
  AND p_new->>'candidate_id' IS NOT NULL
  AND (p_new-'candidate_id')=(p_old-'candidate_id')
);

ALTER FUNCTION app_private.r4_candidate_backfill_row_allowed(jsonb,jsonb)
  OWNER TO elevator_review_function_owner;
REVOKE EXECUTE ON FUNCTION
  app_private.r4_candidate_backfill_row_allowed(jsonb,jsonb)
  FROM PUBLIC;

CREATE OR REPLACE FUNCTION app_private.guard_sealed_result_r3()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_run_id text;
  v_state text;
BEGIN
  v_run_id:=COALESCE(
    to_jsonb(NEW)->>'selection_run_id',
    to_jsonb(OLD)->>'selection_run_id'
  );
  IF v_run_id IS NULL AND TG_TABLE_NAME='selection_run_seal' THEN
    v_run_id:=COALESCE(
      to_jsonb(NEW)->>'selection_run_id',
      to_jsonb(OLD)->>'selection_run_id'
    );
  END IF;
  SELECT r.state INTO v_state FROM app.selection_run r WHERE r.id=v_run_id;
  IF TG_TABLE_NAME='selection_run_seal' AND TG_OP IN ('UPDATE','DELETE') THEN
    RAISE EXCEPTION 'selection seal immutable' USING ERRCODE='23514';
  END IF;
  IF TG_TABLE_NAME='selection_run_seal'
     AND TG_OP='INSERT' AND v_state<>'SEALED' THEN
    RAISE EXCEPTION 'seal row requires sealed run' USING ERRCODE='23514';
  END IF;
  IF v_state='SEALED' AND TG_OP IN ('INSERT','UPDATE','DELETE') THEN
    IF TG_TABLE_NAME='selection_professional_review_result'
       AND TG_OP='UPDATE'
       AND app_private.r4_candidate_backfill_row_allowed(
         to_jsonb(OLD),to_jsonb(NEW)
       ) THEN
      RETURN NEW;
    END IF;
    IF TG_TABLE_NAME<>'selection_run_seal' THEN
      RAISE EXCEPTION 'sealed selection result immutable' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN COALESCE(NEW,OLD);
END
$$;

CREATE OR REPLACE FUNCTION app_private.guard_snapshot_child_r3()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_snapshot_id text;
  v_state text;
BEGIN
  v_snapshot_id:=COALESCE(
    to_jsonb(NEW)->>'snapshot_id',
    to_jsonb(OLD)->>'snapshot_id'
  );
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
    IF TG_TABLE_NAME='sales_snapshot_professional_review_r3'
       AND TG_OP='UPDATE'
       AND app_private.r4_candidate_backfill_row_allowed(
         to_jsonb(OLD),to_jsonb(NEW)
       ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'finalized snapshot child immutable' USING ERRCODE='23514';
  END IF;
  RETURN COALESCE(NEW,OLD);
END
$$;

LOCK TABLE
  app.professional_review_event,
  app.selection_professional_review_result,
  app.sales_handoff_snapshot_r3,
  app.sales_snapshot_professional_review_r3
IN SHARE ROW EXCLUSIVE MODE;

-- Existing rows may predate the candidate-binding trigger. Backfill only from
-- the exact authoritative source row; never invent a candidate or use LIMIT 1.
UPDATE app.selection_professional_review_result AS target
   SET candidate_id=source.candidate_id
  FROM app.professional_review_event AS source
 WHERE source.id=target.professional_review_event_id
   AND target.candidate_id IS NULL;

UPDATE app.sales_snapshot_professional_review_r3 AS target
   SET candidate_id=source.candidate_id
  FROM app.selection_professional_review_result AS source
 WHERE source.selection_run_id=target.selection_run_id
   AND source.professional_review_id=target.professional_review_id
   AND source.event_sequence=target.event_sequence
   AND target.candidate_id IS NULL;

DO $r4_candidate_preflight$
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
      'professional review candidate provenance is not uniquely resolvable'
      USING ERRCODE='23502';
  END IF;
END
$r4_candidate_preflight$;

ALTER TABLE app.selection_professional_review_result
  ALTER COLUMN candidate_id SET NOT NULL;
ALTER TABLE app.sales_snapshot_professional_review_r3
  ALTER COLUMN candidate_id SET NOT NULL;

-- ===========================================================================
-- 2. Recovery attempt sequence
-- ===========================================================================

ALTER TABLE app.bootstrap_recovery_r2
  DROP CONSTRAINT IF EXISTS bootstrap_recovery_one_per_generation_r3,
  ADD COLUMN attempt_sequence bigint,
  ADD COLUMN locked_at timestamptz(6),
  ADD COLUMN denial_reason text,
  ADD CONSTRAINT bootstrap_recovery_attempt_sequence_positive_r4
    CHECK (attempt_sequence IS NULL OR attempt_sequence>0);

-- Deterministic legacy ordering uses immutable recovery ID as the tie-breaker.
-- Redundant secondary requester columns are not part of attempt identity.
WITH ordered AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY bootstrap_id,from_generation
           ORDER BY requested_at,id
         ) AS sequence,
         clock_timestamp() AS migration_observed_at
    FROM app.bootstrap_recovery_r2
   WHERE attempt_sequence IS NULL
)
UPDATE app.bootstrap_recovery_r2 AS target
   SET attempt_sequence=ordered.sequence,
       locked_at=CASE
         WHEN target.state IN ('DENIED','LOCKED')
           THEN ordered.migration_observed_at
         ELSE NULL
       END,
       denial_reason=CASE
         WHEN target.state IN ('DENIED','LOCKED')
           THEN 'LEGACY_TERMINAL_STATE_PRE_R4'
         ELSE NULL
       END
  FROM ordered
 WHERE target.id=ordered.id;

ALTER TABLE app.bootstrap_recovery_r2
  ALTER COLUMN attempt_sequence SET NOT NULL,
  ADD CONSTRAINT bootstrap_recovery_attempt_identity_unique_r4
    UNIQUE (bootstrap_id,from_generation,attempt_sequence),
  ADD CONSTRAINT bootstrap_recovery_terminal_reason_check_r4 CHECK (
    (state='DENIED'
      AND locked_at IS NOT NULL
      AND denial_reason IS NOT NULL
      AND length(btrim(denial_reason))>0
      AND executed_at IS NULL)
    OR (state='LOCKED'
      AND locked_at IS NOT NULL
      AND denial_reason IS NOT NULL
      AND length(btrim(denial_reason))>0
      AND executed_at IS NULL)
    OR (state NOT IN ('DENIED','LOCKED')
      AND locked_at IS NULL
      AND denial_reason IS NULL)
  );

CREATE TABLE app.bootstrap_recovery_sequence_r4 (
  bootstrap_id boolean NOT NULL,
  bootstrap_generation bigint NOT NULL,
  next_sequence bigint NOT NULL CHECK (next_sequence>1),
  updated_at timestamptz(6) NOT NULL,
  PRIMARY KEY (bootstrap_id,bootstrap_generation),
  FOREIGN KEY (bootstrap_id,bootstrap_generation)
    REFERENCES app.bootstrap_generation_r2(
      bootstrap_id,bootstrap_generation
    )
);

INSERT INTO app.bootstrap_recovery_sequence_r4(
  bootstrap_id,bootstrap_generation,next_sequence,updated_at
)
SELECT bootstrap_id,from_generation,max(attempt_sequence)+1,clock_timestamp()
  FROM app.bootstrap_recovery_r2
 GROUP BY bootstrap_id,from_generation
ON CONFLICT (bootstrap_id,bootstrap_generation) DO NOTHING;

CREATE UNIQUE INDEX bootstrap_recovery_one_active_attempt_r4
ON app.bootstrap_recovery_r2 (bootstrap_id,from_generation)
WHERE state IN ('PENDING','APPROVED');

CREATE OR REPLACE FUNCTION app_private.next_bootstrap_recovery_sequence_r4(
  p_bootstrap_id boolean,
  p_generation bigint
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  v_sequence bigint;
BEGIN
  INSERT INTO app.bootstrap_recovery_sequence_r4(
    bootstrap_id,bootstrap_generation,next_sequence,updated_at
  ) VALUES(p_bootstrap_id,p_generation,2,clock_timestamp())
  ON CONFLICT (bootstrap_id,bootstrap_generation) DO UPDATE
    SET next_sequence=app.bootstrap_recovery_sequence_r4.next_sequence+1,
        updated_at=clock_timestamp()
  RETURNING app.bootstrap_recovery_sequence_r4.next_sequence-1
    INTO v_sequence;
  RETURN v_sequence;
END
$$;

-- ===========================================================================
-- 3. Structured, committing expiry paths
-- ===========================================================================

CREATE OR REPLACE FUNCTION app_private.lock_expired_root_change_r4(
  p_recovery_id text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  rr app.bootstrap_recovery_r2%ROWTYPE;
BEGIN
  SELECT * INTO STRICT rr FROM app.bootstrap_recovery_r2
   WHERE id=p_recovery_id FOR UPDATE;
  IF rr.state='LOCKED' THEN
    RETURN;
  END IF;
  IF rr.state IN ('DENIED','EXECUTED') THEN
    RAISE EXCEPTION 'root change already reached another terminal state'
      USING ERRCODE='40001';
  END IF;
  IF rr.state NOT IN ('PENDING','APPROVED') THEN
    RAISE EXCEPTION 'root change expiry state invalid' USING ERRCODE='40001';
  END IF;
  UPDATE app.bootstrap_recovery_r2
     SET state='LOCKED',locked_at=clock_timestamp(),
         denial_reason='APPROVAL_EXPIRED'
   WHERE id=p_recovery_id;
  UPDATE app.bootstrap_lifecycle_r2
     SET state='LOCKED',locked_reason_code='APPROVAL_EXPIRED',
         state_revision=state_revision+1,updated_at=clock_timestamp()
   WHERE bootstrap_id=rr.bootstrap_id
     AND bootstrap_generation=rr.from_generation;
  PERFORM app_private.append_bootstrap_event_r2(
    'LOCKED',rr.bootstrap_id,rr.from_generation,
    rr.requested_by_role,rr.requested_by_principal_id,NULL,NULL
  );
END
$$;

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
BEGIN
  PERFORM app_private.validate_session_role_r3(
    session_user,'BOOTSTRAP_APPROVER','elevator_bootstrap_approver'
  );
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
  IF clock_timestamp()>=rr.approval_expires_at THEN
    PERFORM app_private.lock_expired_root_change_r4(p_recovery_id);
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
  SELECT count(*) INTO v_count FROM app.bootstrap_recovery_approval_r2
   WHERE recovery_id=p_recovery_id;
  IF v_count=2 THEN
    UPDATE app.bootstrap_recovery_r2
       SET state='APPROVED',approved_at=clock_timestamp()
     WHERE id=p_recovery_id;
    UPDATE app.bootstrap_lifecycle_r2
       SET state=CASE rr.kind
                    WHEN 'ROTATION' THEN 'ROOT_ROTATION_PENDING'
                    ELSE 'RECOVERY_APPROVED' END,
           state_revision=state_revision+1,updated_at=clock_timestamp()
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
  v_hash text;
  v_replay boolean;
  v_result text;
  v_seq bigint;
  v_digest text;
  v_backend_start timestamptz;
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
  IF p_kind='ROTATION' THEN
    IF lc.state NOT IN ('BOOTSTRAP_COMPLETED','ROOT_ROTATED') THEN
      RAISE EXCEPTION 'valid root required for rotation' USING ERRCODE='42501';
    END IF;
    PERFORM 1
      FROM app.bootstrap_root_session_r2 s
      JOIN app.trusted_session ts ON ts.session_id=s.session_id
      JOIN app.trusted_principal rp
        ON rp.id=s.root_principal_id AND rp.state='ACTIVE'
      JOIN app.principal_epoch pe ON pe.principal_id=ts.principal_id
      JOIN app.bootstrap_root_grant_r2 g ON g.root_grant_id=lc.root_grant_id
      JOIN app.authority_grant ag ON ag.id=g.root_grant_id
     WHERE s.bootstrap_id=p_bootstrap_id
       AND s.bootstrap_generation=lc.bootstrap_generation
       AND s.session_id=lc.root_session_id
       AND s.root_principal_id=lc.root_principal_id
       AND s.root_role_name=lc.root_role_name
       AND s.state='ACTIVE' AND ts.state='ACTIVE'
       AND ts.principal_id=s.root_principal_id
       AND ts.login_epoch=pe.current_epoch
       AND clock_timestamp()>=ts.not_before
       AND clock_timestamp()<ts.expires_at
       AND g.root_principal_id=lc.root_principal_id
       AND ag.revoked_at IS NULL
       AND clock_timestamp()>=ag.valid_from
       AND (ag.valid_until IS NULL OR clock_timestamp()<ag.valid_until);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'root rotation requires active root authority'
        USING ERRCODE='42501';
    END IF;
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
  IF EXISTS (
    SELECT 1 FROM app.bootstrap_recovery_r2 r
     WHERE r.bootstrap_id=p_bootstrap_id
       AND r.from_generation=lc.bootstrap_generation
       AND r.state IN ('PENDING','APPROVED')
  ) THEN
    RAISE EXCEPTION 'active recovery attempt already exists' USING ERRCODE='40001';
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
    clock_timestamp(),clock_timestamp()+interval '30 minutes',
    p_request_id,v_hash,v_digest,v_seq
  );
  INSERT INTO app.bootstrap_recovery_approval_r2(
    recovery_id,operator_kind,role_name,principal_id,backend_pid,
    backend_started_at,approved_at,request_id,request_hash
  ) SELECT
    p_recovery_id,'INITIATOR',session_user,op.principal_id,
    pg_catalog.pg_backend_pid(),v_backend_start,clock_timestamp(),
    p_request_id,v_hash;
  UPDATE app.bootstrap_lifecycle_r2
     SET state=CASE p_kind WHEN 'ROTATION' THEN 'ROOT_ROTATION_PENDING'
                           ELSE 'RECOVERY_PENDING' END,
         recovery_request_id=p_recovery_id,
         state_revision=state_revision+1,updated_at=clock_timestamp()
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
BEGIN
  IF session_user<>'elevator_session_bootstrap_seed' THEN
    RAISE EXCEPTION 'bootstrap seed role required' USING ERRCODE='42501';
  END IF;
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
  IF clock_timestamp()>=rr.approval_expires_at THEN
    PERFORM app_private.lock_expired_root_change_r4(p_recovery_id);
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
     OR v_init.principal_id IN (rr.current_root_principal_id,rr.target_root_principal_id)
     OR v_appr.principal_id IN (rr.current_root_principal_id,rr.target_root_principal_id)
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
    rr.target_token_digest,true,clock_timestamp()
  );
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
    rr.bootstrap_id,v_new_generation,a.operator_kind,a.role_name,
    a.principal_id,rr.target_root_principal_id,a.backend_pid,
    a.backend_started_at,a.approved_at,a.request_id,a.request_hash
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
    v_init.principal_id,NULL,NULL
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
     SET bootstrap_generation=v_new_generation,state='ROOT_ISSUANCE_PENDING',
         state_revision=state_revision+1,
         root_principal_id=rr.target_root_principal_id,
         root_role_name=rr.target_root_role_name,
         root_session_id=NULL,root_grant_id=NULL,
         recovery_request_id=p_recovery_id,updated_at=clock_timestamp()
   WHERE bootstrap_id=rr.bootstrap_id
     AND bootstrap_generation=rr.from_generation;
  UPDATE app.bootstrap_recovery_r2
     SET state='EXECUTED',executed_at=clock_timestamp(),
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

-- Compatibility wrappers for historical signatures. The unsafe R3 bodies are
-- replaced so the final Catalog contains no update-then-raise expiry path.
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
BEGIN
  PERFORM 1 FROM app.bootstrap_begin_root_change_r4(
    p_recovery_id,p_bootstrap_id,p_kind,p_reason_class,
    p_target_root_principal_id,p_target_root_role_name,
    p_target_token_digest,p_request_id,p_request_key
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
BEGIN
  PERFORM app.bootstrap_approve_root_change_r4(
    p_recovery_id,p_request_id,p_request_key
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
  r record;
BEGIN
  SELECT * INTO STRICT r FROM app.bootstrap_execute_root_change_r4(
    p_recovery_id,p_request_id,p_request_key
  );
  RETURN CASE WHEN r.result_code='GENERATION' THEN r.new_generation ELSE 0 END;
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
BEGIN
  PERFORM app.bootstrap_deny_root_change_r4(
    p_recovery_id,p_reason,p_request_id,p_request_key
  );
END
$$;

-- ===========================================================================
-- 4. Owners, retirement of unsafe legacy entry points and final ACL
-- ===========================================================================

ALTER TABLE app.bootstrap_recovery_sequence_r4 OWNER TO elevator_table_owner;
REVOKE ALL ON TABLE app.bootstrap_recovery_sequence_r4 FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON TABLE app.bootstrap_recovery_sequence_r4
  TO elevator_review_function_owner;

ALTER FUNCTION app_private.next_bootstrap_recovery_sequence_r4(boolean,bigint)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.lock_expired_root_change_r4(text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.bootstrap_approve_root_change_r4(text,text,text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.bootstrap_begin_root_change_r4(
  text,boolean,text,text,text,text,text,text,text
) OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.bootstrap_execute_root_change_r4(text,text,text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.bootstrap_deny_root_change_r4(text,text,text,text)
  OWNER TO elevator_review_function_owner;

REVOKE EXECUTE ON FUNCTION app.bootstrap_begin_root_change_r2(
  text,boolean,text,text,text,text,text,text,text
) FROM elevator_bootstrap_initiator;
REVOKE EXECUTE ON FUNCTION app.bootstrap_approve_root_change_r2(text,text,text)
  FROM elevator_bootstrap_approver;
REVOKE EXECUTE ON FUNCTION app.bootstrap_deny_root_change_r3(text,text,text,text)
  FROM elevator_bootstrap_approver;
REVOKE EXECUTE ON FUNCTION app.bootstrap_execute_root_change_r2(text,text,text)
  FROM elevator_bootstrap_seed;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA app FROM PUBLIC;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA app_private FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.bootstrap_begin_root_change_r4(
  text,boolean,text,text,text,text,text,text,text
) TO elevator_bootstrap_initiator;
GRANT EXECUTE ON FUNCTION app.bootstrap_approve_root_change_r4(text,text,text)
  TO elevator_bootstrap_approver;
GRANT EXECUTE ON FUNCTION app.bootstrap_deny_root_change_r4(text,text,text,text)
  TO elevator_bootstrap_approver;
GRANT EXECUTE ON FUNCTION app.bootstrap_execute_root_change_r4(text,text,text)
  TO elevator_bootstrap_seed;
GRANT EXECUTE ON FUNCTION app.bootstrap_complete_root_r3(
  boolean,text,text,text
) TO elevator_root_issuer;
GRANT EXECUTE ON FUNCTION app.bootstrap_complete_root_r3(boolean,text)
  TO elevator_root_issuer;
GRANT EXECUTE ON FUNCTION app.bootstrap_mark_issuance_failed_r3(
  boolean,text,text,text
) TO elevator_bootstrap_seed;
GRANT EXECUTE ON FUNCTION app.bootstrap_prepare_r3(
  text,text,text,text,text,text,text,text,text
) TO elevator_bootstrap_seed;
GRANT EXECUTE ON FUNCTION app.bootstrap_record_approval_r3(boolean,text)
  TO elevator_bootstrap_initiator,elevator_bootstrap_approver;
GRANT EXECUTE ON FUNCTION app.register_session_role(text,text,text,text)
  TO elevator_identity_broker;
GRANT EXECUTE ON FUNCTION app.open_trusted_session(
  text,text,bigint,text,text,text,text,text,timestamptz,timestamptz,timestamptz
) TO elevator_identity_broker;
GRANT EXECUTE ON FUNCTION app.activate_trusted_session(text,text)
  TO elevator_session_bootstrap;
GRANT EXECUTE ON FUNCTION app.revoke_trusted_session(text,text)
  TO elevator_identity_broker;
GRANT EXECUTE ON FUNCTION app.advance_principal_epoch(text,text)
  TO elevator_identity_broker;
GRANT EXECUTE ON FUNCTION app.issue_authority_grant(
  text,text,text,text,text,text,text,timestamptz
) TO elevator_root_issuer,elevator_security_admin;
GRANT EXECUTE ON FUNCTION app.revoke_authority_grant(text,text)
  TO elevator_security_admin;
GRANT EXECUTE ON FUNCTION app.create_policy_revision(
  text,text,text,bigint,text,text,text,text,text
) TO elevator_policy_author;
GRANT EXECUTE ON FUNCTION app.transition_policy_review(
  text,bigint,app.policy_command,text,text,text
) TO elevator_policy_author,elevator_policy_reviewer;
GRANT EXECUTE ON FUNCTION app.create_professional_review(
  text,text,text,text,text,text,text,text,text,text,text
) TO elevator_professional_reviewer;
GRANT EXECUTE ON FUNCTION app.transition_professional_review(
  text,bigint,app.professional_review_command,text,text,text,text,text
) TO elevator_professional_reviewer;
GRANT EXECUTE ON FUNCTION app.create_selection_run(
  text,text,text,bigint,text,text
) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.add_selection_candidate(
  text,text,text,text,text,text
) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.set_selection_candidate_price(
  text,text,text,text
) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.set_selection_candidate_parameter(
  text,text,text,text
) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.complete_selection_candidate_result(
  text,text,text,text,text,text,text,text,text
) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.record_selection_requirement_field(
  text,text,text,jsonb,text,text,text,text,text,text,boolean,text,text,text,text,text
) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.record_selection_source_result(
  text,text,text,text
) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.record_selection_catalog_review_result(
  text,text,text,text,text,text,timestamptz,text,text
) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.record_selection_professional_review_result(
  text,text,text,bigint,text,text,text,text,timestamptz,text,text
) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.record_selection_warning_result(
  text,text,bigint,text,text,text,text,text,text
) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.record_selection_missing_field_result(
  text,text,text,text,text,text,text
) TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.seal_selection_run(text,bigint,text)
  TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.create_snapshot_r3(text,text,bigint)
  TO elevator_runtime_worker;
GRANT EXECUTE ON FUNCTION app.finalize_snapshot_r3(text,bigint)
  TO elevator_runtime_worker;
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
