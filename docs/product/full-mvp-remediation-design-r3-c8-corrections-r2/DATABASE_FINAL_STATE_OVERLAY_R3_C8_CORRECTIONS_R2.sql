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
    REFERENCES app.bootstrap_lifecycle_r2(
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

ALTER TABLE app.bootstrap_root_session_r2
  ADD CONSTRAINT bootstrap_root_session_generation_fk_r2
    FOREIGN KEY (
      bootstrap_id,bootstrap_generation,root_session_id,root_principal_id,
      root_role_name
    ) REFERENCES app.bootstrap_lifecycle_r2(
      bootstrap_id,bootstrap_generation,root_session_id,root_principal_id,
      root_role_name
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
  FOREIGN KEY (source_revision_id,source_evidence_object_id,source_content_digest)
    REFERENCES app.catalog_source_revision(
      id,evidence_object_id,raw_content_digest
    ),
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
    FOREIGN KEY (
      source_target_binding_id,source_target_binding_digest,
      source_revision_id,target_kind,product_id,product_revision_id,
      product_revision_digest,specification_revision_id,
      specification_revision_digest,price_revision_id,price_fact_digest,
      project_id
    ) REFERENCES app.catalog_source_target_binding_r2(
      id,binding_digest,source_revision_id,target_kind,product_id,
      product_revision_id,product_revision_digest,
      specification_revision_id,specification_revision_digest,
      price_revision_id,price_fact_digest,project_id
    ) DEFERRABLE INITIALLY DEFERRED,
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

  PERFORM app_private.assert_protected_owner_closure_r2(p_role_name);
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
