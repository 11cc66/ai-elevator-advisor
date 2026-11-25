# Event-only Privilege Independent Audit R3-C4

Date: 2026-11-24

Result:

```text
EVENT-ONLY PERMISSIONS: FAIL
DATABASE: NOT ACCESSED
```

## 1. Role Matrix

| Role | Intended responsibility | Static issue |
|---|---|---|
| `elevator_migrator` | approved migrations only | Exact membership/default privileges not specified |
| `elevator_schema_owner` | owns schema/tables | Owner-implied DML must be constrained by deployment |
| `elevator_review_function_owner` | owns transition functions | Actual `ALTER ... OWNER TO` not shown |
| `elevator_runtime_web` | application read/controlled function | No table DML on events is granted |
| `elevator_runtime_worker` | worker read/controlled function | No event DML is granted |
| `elevator_professional_reviewer` | execute ProfessionalReview transition | Caller can choose actor/state under shown signature |
| `elevator_policy_author` | author draft policy | Self-approval denial is prose only |
| `elevator_readonly_auditor` | read/audit | Sequence/schema/default privileges not fully specified |

## 2. Positive Controls

- PUBLIC table privileges are revoked.
- Runtime web/worker INSERT/UPDATE/DELETE/TRUNCATE on Event tables are revoked.
- Transition execute is revoked from PUBLIC.
- `SECURITY DEFINER` uses a fixed `search_path`.
- Runtime roles are prohibited from owning tables/functions or being members
  of the function owner.
- Event append-only triggers are required independently of grants.

These are necessary controls, not a complete boundary.

## 3. Critical Actor/State Defect

Function signature:

```text
transition_professional_review(
  p_review_id,
  p_expected_sequence,
  p_new_state,
  p_actor_id,
  p_policy_revision_id,
  p_basis_digest,
  p_request_id,
  p_reason
)
```

Missing from the design:

- mapping from `session_user`/trusted application principal to `p_actor_id`;
- mapping from actor to authority and exact authority record;
- closed state-transition matrix for `p_new_state`;
- proof that the actor owns or may review this exact Review;
- policy-author/reviewer separation inside the function;
- proof that `actor_authority_id` cannot be supplied freely.

The SQL body is only `BEGIN ... END`, so these controls cannot be verified from
the design.

## 4. PostgreSQL Bypass Checklist

| Surface | Status |
|---|---|
| Table owner DML | Owner role identified; deployment evidence absent |
| PUBLIC table rights | Revoked in shown statements |
| Schema USAGE/CREATE | NOT SPECIFIED |
| Default privileges | NOT SPECIFIED |
| Sequence privileges | NOT SPECIFIED |
| Role membership/inheritance | Prose only |
| Function execute | Revoked/granted for transition; trigger functions absent |
| `SECURITY DEFINER` owner | Named role, assignment SQL absent |
| `search_path` | Fixed, but schema ownership/write access not specified |
| Trigger bypass | Append-only trigger function/DDL absent |
| TRUNCATE | Trigger cannot cover; privilege/owner controls incomplete |
| Direct view DML | Prose denial only |
| Caller-supplied actor/state | NOT SECURELY BOUND |

## 5. Required Acceptance

1. Bind actor identity from a trusted session-to-user mapping.
2. Bind authority to an exact immutable grant/record.
3. Publish a closed transition matrix and enforce it in the function.
4. Publish exact owner, schema, table, sequence, function and default
   privileges.
5. Revoke trigger-function EXECUTE from PUBLIC and application roles.
6. Test direct DML, TRUNCATE, inherited-role, function-owner, search-path and
   actor-spoof paths in an authorized isolated database.

Database execution remains `NOT VERIFIED`.

