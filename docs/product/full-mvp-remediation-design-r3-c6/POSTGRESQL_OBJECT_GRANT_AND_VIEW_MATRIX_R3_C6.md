# PostgreSQL Object Grant and View Matrix R3-C6

## 1. Table Privilege Matrix

| Object | Web | Worker | Reviewer | Policy Author | Policy Reviewer | Auditor | Broker |
|---|---|---|---|---|---|---|---|
| trusted_principal | none | none | none | none | none | select view | function-only |
| principal_epoch | none | none | none | none | none | select view | function-only |
| trusted_session | none | none | none | none | none | select view | function-only |
| session_audit | none | none | none | none | none | select view | function-only |
| authority_grant | none | none | none | none | none | select view | none |
| policy_revision | none | none | none | draft-function only | draft-function only | select view | none |
| policy_review_event | none | none | none | function-only | function-only | select view | none |
| professional_review | none | none | view | none | none | select view | none |
| professional_review_event | none | none | view | none | none | select view | none |
| selection_run | none | select | none | none | none | select view | none |
| selection_candidate_result | none | select | none | none | none | select view | none |
| Snapshot envelope | view | function-only | view | view | view | select view | none |
| Snapshot canonical children | none | function-only | none | none | none | select view | none |
| Basis metadata | view | function-only | view | view | view | select view | none |
| validation result | none | function-only | none | none | none | select view | none |

No role receives DELETE/TRUNCATE on protected history. Reviewer/policy roles
execute controlled transition functions; they do not receive direct INSERT on
events.

## 2. Sequence Matrix

| Sequence | Owner | Runtime | Reviewer | Auditor |
|---|---|---|---|---|
| event sequence/allocator | table owner | function-only | none | none |
| snapshot version allocator | table owner | controlled function | none | none |

## 3. Read Views

### Current Professional Review

```sql
CREATE VIEW app.current_professional_review_v
WITH (security_barrier=true, security_invoker=false) AS
SELECT r.id,r.project_id,r.conversation_id,r.requirement_id,
       r.requirement_version_id,r.installation_scenario,
       r.candidate_id,r.policy_revision_id,e.event_sequence,
       e.new_state,e.decision,e.occurred_at
  FROM app.professional_review r
  JOIN LATERAL (
    SELECT * FROM app.professional_review_event x
     WHERE x.review_id=r.id ORDER BY x.event_sequence DESC LIMIT 1
  ) e ON true
 WHERE EXISTS (
   SELECT 1 FROM app.trusted_session s
    JOIN app.principal_epoch pe ON pe.principal_id=s.principal_id
    WHERE s.db_auth_role=session_user
      AND s.state='ACTIVE' AND s.revoked_at IS NULL
      AND now() >= s.not_before AND now() < s.expires_at
      AND pe.current_epoch=s.login_epoch
      AND app.has_project_authority(s.principal_id,r.project_id,'REVIEW_READ')
 );
```

### Current Policy

```sql
CREATE VIEW app.current_policy_revision_v
WITH (security_barrier=true, security_invoker=false) AS
SELECT DISTINCT ON (e.policy_revision_id)
       e.policy_revision_id,e.event_sequence,e.new_state,
       p.content_digest,p.policy_kind,e.occurred_at
  FROM app.policy_review_event e
  JOIN app.policy_revision p ON p.id=e.policy_revision_id
 WHERE EXISTS (
   SELECT 1 FROM app.trusted_session s
    WHERE s.db_auth_role=session_user AND s.state='ACTIVE'
      AND s.revoked_at IS NULL AND now()<s.expires_at
 )
 ORDER BY e.policy_revision_id,e.event_sequence DESC;
```

### Current Snapshot and Audit

`current_sales_snapshot_v`, `audit_professional_review_events_v` and
`audit_policy_events_v` follow the same pattern:

- security barrier;
- explicit schema qualification;
- session/epoch active check;
- principal project/object authority check;
- no sensitive assertion digest/key column;
- base table SELECT revoked from runtime principal roles.

## 4. View Privilege

```sql
REVOKE ALL ON app.current_professional_review_v,
  app.current_policy_revision_v,
  app.current_sales_snapshot_v,
  app.audit_professional_review_events_v,
  app.audit_policy_events_v
  FROM PUBLIC;

GRANT SELECT ON app.current_professional_review_v,
  app.current_policy_revision_v,
  app.current_sales_snapshot_v,
  app.audit_professional_review_events_v,
  app.audit_policy_events_v
  TO elevator_runtime_web, elevator_runtime_worker,
     elevator_readonly_auditor;
```

Reviewer/policy views receive narrower role grants where needed.

## 5. Revokes

```sql
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER
  ON ALL TABLES IN SCHEMA app
  FROM elevator_runtime_web,elevator_runtime_worker;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;
```

`REFERENCES`/`TRIGGER` are included because they can affect protected data even
without direct DML.

