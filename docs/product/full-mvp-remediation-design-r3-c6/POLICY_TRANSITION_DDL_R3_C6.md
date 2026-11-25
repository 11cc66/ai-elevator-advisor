# Policy Transition DDL R3-C6

Status: design only, not executed.

## 1. Create Revision and Initial Event

```sql
CREATE FUNCTION app.create_policy_revision(
  p_policy_revision_id text,
  p_policy_kind text,
  p_content jsonb,
  p_content_digest text,
  p_request_id text,
  p_request_key text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s app.trusted_session%ROWTYPE;
BEGIN
  SELECT * INTO s FROM app_private.require_active_session(
    session_user,'POLICY_AUTHOR');
  INSERT INTO app.policy_revision(
    id,policy_kind,content,content_digest,created_by_principal_id,created_at)
  VALUES(p_policy_revision_id,p_policy_kind,p_content,p_content_digest,
         s.principal_id,clock_timestamp());
  INSERT INTO app.policy_review_event(
    id,policy_revision_id,event_sequence,resulting_state_version,
    previous_state,new_state,actor_principal_id,actor_authority_grant_id,
    request_id,request_key,decision,reason,occurred_at)
  SELECT gen_random_uuid()::text,p_policy_revision_id,1,1,NULL,'DRAFT',
         s.principal_id,g.id,p_request_id,p_request_key,NULL,
         'policy created',clock_timestamp()
    FROM app.authority_grant g
   WHERE g.principal_id=s.principal_id
     AND g.authority_code='POLICY_AUTHOR'
     AND g.revoked_at IS NULL
     AND now()>=g.valid_from
     AND (g.valid_until IS NULL OR now()<g.valid_until)
   ORDER BY g.id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'policy author authority missing' USING ERRCODE='42501';
  END IF;
  RETURN p_policy_revision_id;
END
$$;
```

## 2. Transition Function

```sql
CREATE FUNCTION app.transition_policy_review(
  p_policy_revision_id text,
  p_expected_sequence bigint,
  p_command text,
  p_policy_digest text,
  p_request_id text,
  p_request_key text,
  p_reason text
) RETURNS TABLE(event_id text,event_sequence bigint,
                 resulting_state text,replay boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s app.trusted_session%ROWTYPE;
  p app.policy_revision%ROWTYPE;
  old_event app.policy_review_event%ROWTYPE;
  replay_event app.policy_review_event%ROWTYPE;
  next_state text;
  required_authority text;
  grant_id text;
  event_id text := gen_random_uuid()::text;
BEGIN
  SELECT * INTO s FROM app_private.require_active_session(
    session_user,'POLICY_REVIEW');
  SELECT * INTO STRICT p FROM app.policy_revision
   WHERE id=p_policy_revision_id FOR SHARE;
  IF p.content_digest <> p_policy_digest THEN
    RAISE EXCEPTION 'policy digest mismatch' USING ERRCODE='23514';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p.id,0));
  SELECT * INTO old_event FROM app.policy_review_event
   WHERE policy_revision_id=p.id ORDER BY event_sequence DESC LIMIT 1;
  IF old_event.id IS NULL OR old_event.event_sequence <> p_expected_sequence THEN
    RAISE EXCEPTION 'stale policy sequence' USING ERRCODE='40001';
  END IF;
  SELECT * INTO replay_event FROM app.policy_review_event
   WHERE policy_revision_id=p.id AND request_id=p_request_id;
  IF FOUND THEN
    IF replay_event.request_key <> p_request_key THEN
      RAISE EXCEPTION 'request id reused' USING ERRCODE='40001';
    END IF;
    RETURN QUERY SELECT replay_event.id,replay_event.event_sequence,
                        replay_event.new_state,true;
    RETURN;
  END IF;

  required_authority := CASE p_command
    WHEN 'SUBMIT' THEN 'POLICY_AUTHOR'
    WHEN 'APPROVE' THEN 'POLICY_APPROVER'
    WHEN 'REJECT' THEN 'POLICY_APPROVER'
    WHEN 'INVALIDATE' THEN 'POLICY_SECURITY_ADMIN'
    WHEN 'EXPIRE' THEN 'POLICY_LIFECYCLE'
    WHEN 'SUPERSEDE' THEN 'POLICY_APPROVER'
  END;
  next_state := CASE
    WHEN old_event.new_state='DRAFT' AND p_command='SUBMIT' THEN 'IN_REVIEW'
    WHEN old_event.new_state='IN_REVIEW' AND p_command='APPROVE' THEN 'APPROVED'
    WHEN old_event.new_state='IN_REVIEW' AND p_command='REJECT' THEN 'REJECTED'
    WHEN old_event.new_state='APPROVED' AND p_command='INVALIDATE' THEN 'INVALIDATED'
    WHEN old_event.new_state='APPROVED' AND p_command='EXPIRE' THEN 'EXPIRED'
    WHEN old_event.new_state='APPROVED' AND p_command='SUPERSEDE' THEN 'SUPERSEDED'
    ELSE NULL
  END;
  IF next_state IS NULL THEN
    RAISE EXCEPTION 'undefined policy transition' USING ERRCODE='23514';
  END IF;
  IF p_command='APPROVE' AND s.principal_id=p.created_by_principal_id THEN
    RAISE EXCEPTION 'self approval denied' USING ERRCODE='42501';
  END IF;

  SELECT g.id INTO grant_id FROM app.authority_grant g
   WHERE g.principal_id=s.principal_id
     AND g.authority_code=required_authority
     AND g.policy_revision_id=p.id
     AND g.revoked_at IS NULL
     AND now() >= g.valid_from
     AND (g.valid_until IS NULL OR now() < g.valid_until)
   ORDER BY g.id LIMIT 1;
  IF grant_id IS NULL THEN
    RAISE EXCEPTION 'policy authority missing' USING ERRCODE='42501';
  END IF;

  INSERT INTO app.policy_review_event(
    id,policy_revision_id,event_sequence,resulting_state_version,
    previous_state,new_state,actor_principal_id,actor_authority_grant_id,
    request_id,request_key,decision,reason,occurred_at)
  VALUES(
    event_id,p.id,old_event.event_sequence+1,old_event.resulting_state_version+1,
    old_event.new_state,next_state,s.principal_id,grant_id,p_request_id,
    p_request_key,p_command,p_reason,clock_timestamp());
  RETURN QUERY SELECT event_id,old_event.event_sequence+1,next_state,false;
END
$$;
```

## 2. Permissions

Owner: `elevator_review_function_owner`.

```sql
ALTER FUNCTION app.create_policy_revision(text,text,jsonb,text,text,text)
  OWNER TO elevator_review_function_owner;
ALTER FUNCTION app.transition_policy_review(
  text,bigint,text,text,text,text,text
) OWNER TO elevator_review_function_owner;

REVOKE EXECUTE ON FUNCTION app.create_policy_revision(
  text,text,jsonb,text,text,text
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app.transition_policy_review(
  text,bigint,text,text,text,text,text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.create_policy_revision(
  text,text,jsonb,text,text,text
) TO elevator_policy_author;
```

EXECUTE for transitions:

```text
elevator_policy_author
elevator_policy_reviewer
```

REVOKE from PUBLIC. Direct PolicyRev/Event DML is denied to all business roles.

