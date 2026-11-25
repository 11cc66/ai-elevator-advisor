# Security Definer Final ACL Closure R3

## Final Stage

R3 creates every function first, then executes:

```sql
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA app FROM PUBLIC;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA app_private FROM PUBLIC;
```

Capability grants are applied after this final revoke.

Private ledger/event/trigger helpers receive no direct caller grant. Every
Security Definer function in the Function Registry records Owner, mode,
fixed `search_path`, role grants and call graph.

Runtime login roles have no inherited direct function access. They can reach
only explicit capability functions after `SET ROLE`.

The R3 mutation suite removes the final PUBLIC revoke, narrows the schema scope,
and adds a direct helper grant; each mutation must fail the ACL invariant.

Actual PostgreSQL ACL and Default Privilege Catalog state remains
`NOT VERIFIED — DATABASE NOT AUTHORIZED`.
