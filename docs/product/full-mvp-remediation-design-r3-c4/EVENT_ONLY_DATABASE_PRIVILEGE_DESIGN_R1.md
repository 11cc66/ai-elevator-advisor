# Event-only Database Privilege Design R1

Status:

```text
DDL DESIGN
NO DATABASE OPERATION AUTHORIZED
```

## 1. Role Model

The deployment must have distinct roles:

```text
elevator_migrator
elevator_schema_owner
elevator_review_function_owner
elevator_runtime_web
elevator_runtime_worker
elevator_professional_reviewer
elevator_policy_author
elevator_readonly_auditor
```

Exact deployment names are placeholders until the deployment security owner
approves them. Role relationships are normative:

- runtime roles cannot own tables or functions;
- runtime roles cannot be members of function owner;
- reviewers and policy authors are separate roles;
- the migration role is used only for approved migrations, not runtime.

## 2. Table and Event Grants

```sql
REVOKE ALL ON professional_review_event FROM PUBLIC;
REVOKE ALL ON selection_rule_set_review_event FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON professional_review_event FROM elevator_runtime_web, elevator_runtime_worker;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON selection_rule_set_review_event FROM elevator_runtime_web, elevator_runtime_worker;
GRANT SELECT ON professional_review_event TO elevator_professional_reviewer,
  elevator_policy_author, elevator_readonly_auditor;
GRANT SELECT ON selection_rule_set_review_event TO elevator_policy_author,
  elevator_readonly_auditor;
```

Append-only triggers independently reject UPDATE/DELETE/TRUNCATE for any role
that accidentally receives DML. The application roles may read through the
latest-event views only.

## 3. Transition Functions

Use `SECURITY DEFINER` only for the narrow state transition functions:

```sql
CREATE FUNCTION transition_professional_review(
  p_review_id text,
  p_expected_sequence integer,
  p_new_state text,
  p_actor_id text,
  p_policy_revision_id text,
  p_basis_digest text,
  p_request_id text,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, approved_review_schema
AS $$ BEGIN ... END; $$;

REVOKE EXECUTE ON FUNCTION transition_professional_review(
  text,integer,text,text,text,text,text,text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transition_professional_review(
  text,integer,text,text,text,text,text,text
) TO elevator_professional_reviewer;
```

`transition_rule_set_review` follows the same pattern and is granted only to
the policy/reviewer role approved for RuleSet review.

Function owner must be `elevator_review_function_owner`; schema owner and
function owner are separate. The function:

- locks the Review/Revision row;
- reads the latest event;
- checks expected sequence/state;
- validates exact candidate/Requirement/Version/Scenario/Policy/Basis;
- inserts exactly one event;
- updates no unrelated object;
- commits or rolls back as one transaction.

## 4. Policy Authoring

- `elevator_policy_author` may insert draft policy revisions;
- it cannot approve its own revision;
- approval uses a separate reviewer role/event;
- a policy revision cannot become effective without the approved policy event;
- runtime roles only read the current approved policy revision.

## 5. Failure and Concurrency

- Function receives a request idempotency identity; duplicate request returns
  the prior outcome or a stable conflict.
- CAS/sequence mismatch returns conflict without an event.
- Event insert or basis check failure rolls back the entire transaction.
- Direct table DML, direct view DML, and direct function execution by
  unauthorized roles are denied.

## 6. Required Tests

1. Ordinary runtime roles cannot insert/update/delete event rows.
2. PUBLIC cannot execute transition functions.
3. Reviewer can execute only the permitted transition.
4. Policy author cannot self-approve.
5. Duplicate request/sequence/state conflict is rejected.
6. Direct event mutation and truncate are rejected.
7. Two concurrent transitions produce one event/current state.
8. Event/current basis disagreement is quarantined or rejected.

## 7. Open Dependency

`OD-R3-C3-03`/`OD-R3-C4-03` must choose exact deployment role names, function
owner identity, password/privilege provisioning and operational approval.
