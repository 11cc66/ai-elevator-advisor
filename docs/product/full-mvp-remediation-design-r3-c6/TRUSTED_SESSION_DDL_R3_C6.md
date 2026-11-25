# Trusted Session DDL Proposal R3-C6

Status: design only, not executed.

## 1. Open Session

```sql
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
  IF p_session_id IS NULL OR p_db_auth_role IS NULL
     OR p_assertion_id IS NULL OR p_audience IS NULL OR p_issuer IS NULL THEN
    RAISE EXCEPTION 'session identity incomplete' USING ERRCODE='22004';
  END IF;
  IF p_not_before < p_issued_at OR p_expires_at <= p_issued_at
     OR p_expires_at <= now() THEN
    RAISE EXCEPTION 'invalid session validity' USING ERRCODE='22007';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=p_db_auth_role
                    AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls) THEN
    RAISE EXCEPTION 'session role invalid' USING ERRCODE='42501';
  END IF;

  PERFORM 1 FROM app.principal_epoch
   WHERE principal_id=p_principal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'principal epoch missing' USING ERRCODE='23503';
  END IF;
  SELECT current_epoch INTO v_epoch
    FROM app.principal_epoch WHERE principal_id=p_principal_id;
  IF p_login_epoch <> v_epoch THEN
    RAISE EXCEPTION 'stale login epoch' USING ERRCODE='40001';
  END IF;

  INSERT INTO app.trusted_session(
    session_id,principal_id,login_epoch,db_auth_role,audience,issuer,
    assertion_id,assertion_digest,issued_at,not_before,expires_at,
    state,created_at)
  VALUES(
    p_session_id,p_principal_id,p_login_epoch,p_db_auth_role,p_audience,p_issuer,
    p_assertion_id,p_assertion_digest,p_issued_at,p_not_before,p_expires_at,
    'ACTIVE',clock_timestamp());
END
$$;
```

The broker verifies the signed assertion before calling this function.

## 2. Revoke Session

```sql
CREATE FUNCTION app.revoke_trusted_session(
  p_session_id text,
  p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
BEGIN
  IF session_user <> 'elevator_identity_broker' THEN
    RAISE EXCEPTION 'broker role required' USING ERRCODE='42501';
  END IF;
  UPDATE app.trusted_session
     SET state='REVOKED', revoked_at=clock_timestamp(), revocation_reason=p_reason
   WHERE session_id=p_session_id AND state='ACTIVE';
  IF NOT FOUND THEN
    RETURN;
  END IF;
  INSERT INTO app.session_audit(
    id,session_id,action,actor_role,reason,occurred_at)
  VALUES(gen_random_uuid()::text,p_session_id,'REVOKE',session_user,
         p_reason,clock_timestamp());
END
$$;
```

The broker closes the database connection after commit. The transition gate
independently rejects the old session even if the client connection remains.

## 3. Principal Epoch Increment

```sql
CREATE FUNCTION app.advance_principal_epoch(p_principal_id text)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app
AS $$
DECLARE v_next bigint;
BEGIN
  IF session_user <> 'elevator_identity_broker' THEN
    RAISE EXCEPTION 'broker role required' USING ERRCODE='42501';
  END IF;
  UPDATE app.principal_epoch
     SET current_epoch=current_epoch+1,updated_at=clock_timestamp()
   WHERE principal_id=p_principal_id
   RETURNING current_epoch INTO v_next;
  IF v_next IS NULL THEN
    RAISE EXCEPTION 'principal epoch missing' USING ERRCODE='23503';
  END IF;
  RETURN v_next;
END
$$;
```

## 4. Active Session Guard

```sql
CREATE FUNCTION app_private.require_active_session(
  p_db_role text,
  p_capability text
) RETURNS app.trusted_session
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE s app.trusted_session%ROWTYPE;
BEGIN
  SELECT ts.* INTO STRICT s
    FROM app.trusted_session ts
    JOIN app.principal_epoch pe ON pe.principal_id=ts.principal_id
   WHERE ts.db_auth_role=p_db_role
     AND ts.state='ACTIVE'
     AND ts.revoked_at IS NULL
     AND now() >= ts.not_before
     AND now() < ts.expires_at
     AND pe.current_epoch=ts.login_epoch;
  IF NOT EXISTS (
    SELECT 1
      FROM app.authority_grant g
     WHERE g.principal_id=s.principal_id
       AND g.authority_code=p_capability
       AND g.revoked_at IS NULL
       AND now() >= g.valid_from
       AND (g.valid_until IS NULL OR now() < g.valid_until)
  ) THEN
    RAISE EXCEPTION 'capability not granted' USING ERRCODE='42501';
  END IF;
  RETURN s;
EXCEPTION WHEN NO_DATA_FOUND THEN
  RAISE EXCEPTION 'active trusted session missing' USING ERRCODE='42501';
END
$$;
```

## 5. Permissions

```sql
ALTER FUNCTION app.open_trusted_session(text,text,bigint,text,text,text,text,text,timestamptz,timestamptz,timestamptz)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.revoke_trusted_session(text,text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.advance_principal_epoch(text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app_private.require_active_session(text,text)
  OWNER TO elevator_review_function_owner;

REVOKE EXECUTE ON FUNCTION app.open_trusted_session(text,text,bigint,text,text,text,text,text,timestamptz,timestamptz,timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app.revoke_trusted_session(text,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app.advance_principal_epoch(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_private.require_active_session(text,text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.open_trusted_session(text,text,bigint,text,text,text,text,text,timestamptz,timestamptz,timestamptz) TO elevator_identity_broker;
GRANT EXECUTE ON FUNCTION app.revoke_trusted_session(text,text) TO elevator_identity_broker;
GRANT EXECUTE ON FUNCTION app.advance_principal_epoch(text) TO elevator_identity_broker;
```

