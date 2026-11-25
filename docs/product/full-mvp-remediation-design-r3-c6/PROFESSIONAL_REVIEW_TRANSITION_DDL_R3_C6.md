# Professional Review Transition DDL R3-C6

Status: design only, not executed.

## 1. Signature

```sql
CREATE TYPE app.professional_review_command AS ENUM (
  'SUBMIT','APPROVE','REJECT','RETURN','RESUBMIT','INVALIDATE','EXPIRE'
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
) RETURNS TABLE(event_id text,event_sequence bigint,
                 resulting_state text,replay boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,app,app_private
AS $$
DECLARE
  s app.trusted_session%ROWTYPE;
  r app.professional_review%ROWTYPE;
  old_event app.professional_review_event%ROWTYPE;
  replay_event app.professional_review_event%ROWTYPE;
  grant_id text;
  required_authority text;
  next_state text;
  event_id text := gen_random_uuid()::text;
BEGIN
  SELECT * INTO s FROM app_private.require_active_session(
    session_user,'PROFESSIONAL_REVIEW');
  SELECT * INTO STRICT r
    FROM app.professional_review
   WHERE id=p_review_id FOR UPDATE;
  IF r.policy_revision_id <> p_expected_policy_revision_id THEN
    RAISE EXCEPTION 'policy expectation mismatch' USING ERRCODE='40001';
  END IF;
  PERFORM 1 FROM app.policy_revision pr
   WHERE pr.id=r.policy_revision_id
     AND app.policy_is_effective(pr.id)
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'policy not effective' USING ERRCODE='23514';
  END IF;

  SELECT * INTO old_event
    FROM app.professional_review_event e
   WHERE e.review_id=r.id
   ORDER BY e.event_sequence DESC LIMIT 1;
  IF old_event.id IS NULL OR old_event.event_sequence <> p_expected_sequence THEN
    RAISE EXCEPTION 'stale event sequence' USING ERRCODE='40001';
  END IF;

  SELECT * INTO replay_event
    FROM app.professional_review_event e
   WHERE e.review_id=r.id AND e.request_id=p_request_id;
  IF FOUND THEN
    IF replay_event.request_key <> p_request_key THEN
      RAISE EXCEPTION 'request id reused with different payload' USING ERRCODE='40001';
    END IF;
    RETURN QUERY SELECT replay_event.id,replay_event.event_sequence,
                        replay_event.new_state,true;
    RETURN;
  END IF;

  required_authority := CASE p_command
    WHEN 'SUBMIT' THEN 'REVIEW_SUBMITTER'
    WHEN 'RESUBMIT' THEN 'REVIEW_SUBMITTER'
    WHEN 'APPROVE' THEN 'PROFESSIONAL_APPROVER'
    WHEN 'REJECT' THEN 'PROFESSIONAL_APPROVER'
    WHEN 'RETURN' THEN 'PROFESSIONAL_APPROVER'
    WHEN 'INVALIDATE' THEN 'REVIEW_INVALIDATOR'
    WHEN 'EXPIRE' THEN 'POLICY_LIFECYCLE'
  END;

  next_state := CASE
    WHEN old_event.new_state='CREATED' AND p_command='SUBMIT' THEN 'IN_REVIEW'
    WHEN old_event.new_state='IN_REVIEW' AND p_command='APPROVE' THEN 'APPROVED'
    WHEN old_event.new_state='IN_REVIEW' AND p_command='REJECT' THEN 'REJECTED'
    WHEN old_event.new_state='IN_REVIEW' AND p_command='RETURN' THEN 'RETURNED_FOR_INFORMATION'
    WHEN old_event.new_state='RETURNED_FOR_INFORMATION' AND p_command='RESUBMIT' THEN 'IN_REVIEW'
    WHEN old_event.new_state IN ('CREATED','IN_REVIEW','RETURNED_FOR_INFORMATION')
         AND p_command='INVALIDATE' THEN 'INVALIDATED'
    WHEN old_event.new_state IN ('IN_REVIEW','APPROVED') AND p_command='EXPIRE' THEN 'EXPIRED'
    ELSE NULL
  END;
  IF next_state IS NULL THEN
    RAISE EXCEPTION 'undefined transition' USING ERRCODE='23514';
  END IF;

  IF p_command='APPROVE' AND r.created_by_principal_id=s.principal_id THEN
    RAISE EXCEPTION 'self approval denied' USING ERRCODE='42501';
  END IF;
  IF p_command IN ('APPROVE','REJECT','RETURN') AND NOT EXISTS (
    SELECT 1 FROM app.authority_grant g
     WHERE g.principal_id=s.principal_id
       AND g.authority_code=required_authority
       AND g.project_id=r.project_id
       AND g.policy_revision_id=r.policy_revision_id
       AND g.revoked_at IS NULL
       AND now() >= g.valid_from
       AND (g.valid_until IS NULL OR now() < g.valid_until)
  ) THEN
    RAISE EXCEPTION 'review authority missing' USING ERRCODE='42501';
  END IF;
  IF p_command NOT IN ('APPROVE','REJECT','RETURN') AND NOT EXISTS (
    SELECT 1 FROM app.authority_grant g
     WHERE g.principal_id=s.principal_id
       AND g.authority_code=required_authority
       AND (g.project_id IS NULL OR g.project_id=r.project_id)
       AND g.revoked_at IS NULL
       AND now() >= g.valid_from
       AND (g.valid_until IS NULL OR now() < g.valid_until)
  ) THEN
    RAISE EXCEPTION 'transition authority missing' USING ERRCODE='42501';
  END IF;

  SELECT g.id INTO grant_id
    FROM app.authority_grant g
   WHERE g.principal_id=s.principal_id
     AND g.authority_code=required_authority
     AND (g.project_id IS NULL OR g.project_id=r.project_id)
     AND (g.policy_revision_id IS NULL OR g.policy_revision_id=r.policy_revision_id)
     AND g.revoked_at IS NULL
     AND now() >= g.valid_from
     AND (g.valid_until IS NULL OR now() < g.valid_until)
   ORDER BY g.id LIMIT 1;
  IF grant_id IS NULL THEN
    RAISE EXCEPTION 'authority grant missing' USING ERRCODE='42501';
  END IF;

  INSERT INTO app.professional_review_event(
    id,review_id,project_id,conversation_id,requirement_id,
    requirement_version_id,installation_scenario,event_sequence,
    resulting_state_version,previous_state,new_state,actor_principal_id,
    actor_authority_grant_id,decision,reason,occurred_at,basis_digest,
    policy_revision_id,request_id,request_key)
  VALUES(
    event_id,r.id,r.project_id,r.conversation_id,r.requirement_id,
    r.requirement_version_id,r.installation_scenario,
    old_event.event_sequence+1,old_event.resulting_state_version+1,
    old_event.new_state,next_state,s.principal_id,grant_id,
    CASE WHEN p_command IN ('APPROVE','REJECT','RETURN') THEN p_command ELSE NULL END,
    p_reason,clock_timestamp(),p_basis_digest,r.policy_revision_id,
    p_request_id,p_request_key);

  INSERT INTO app.review_audit(id,review_id,event_id,action,actor_principal_id,
                               occurred_at)
  VALUES(gen_random_uuid()::text,r.id,event_id,p_command::text,
         s.principal_id,clock_timestamp());
  RETURN QUERY SELECT event_id,old_event.event_sequence+1,next_state,false;
END
$$;
```

The exact six-column Event parent key remains unchanged. Review uses the
policy-inclusive seven-column FK.

