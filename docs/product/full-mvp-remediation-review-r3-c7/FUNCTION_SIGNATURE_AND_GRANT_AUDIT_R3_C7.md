# Function Signature and Grant Audit R3-C7

## Result

```text
Definition completeness: PASS
Registry signature match: PASS
Explicit GRANT/REVOKE signature match: PASS
Runtime executability: FAIL — P1-04
```

## Independent Checks

The DDL contains 44 `CREATE FUNCTION` signatures; the JSON Registry contains
the same 44. Definition argument types, order and Registry signatures match.
The previously reported Policy and ProfessionalReview argument-count defects
are corrected:

```text
transition_policy_review(
  text,bigint,app.policy_command,text,text,text
)

transition_professional_review(
  text,bigint,app.professional_review_command,
  text,text,text,text,text
)
```

All functions have an `ALTER FUNCTION ... OWNER TO` declaration. All
SECURITY DEFINER function bodies declare a fixed `pg_catalog`-first
`search_path`. No dynamic SQL or placeholder body was found.

## Functional Trace

- Snapshot builder/verifier and all named materializer helpers exist.
- Policy/Professional replay lookup precedes stale sequence checks.
- Session/Authority lock helpers exist.
- Trigger functions referenced by Snapshot, Policy, and event triggers exist.
- Return types are present in the JSON Registry.

## Blocking Permission Finding

The signature Registry matching does not prove executability. The review owner
does not have:

- USAGE on schema `app`;
- SELECT/INSERT/UPDATE/DELETE rights on the tables its SECURITY DEFINER bodies
  access.

The broker has no USAGE on schema `app` either. The independent permission
audit records this as `REV-R3-C7-P1-04`.

## Acceptance

Future Catalog introspection must compare `pg_proc.proargtypes/prorettype`,
`proowner`, `prosecdef`, `proconfig` and ACLs, then execute positive/negative
authorization tests. No database execution occurred here.
