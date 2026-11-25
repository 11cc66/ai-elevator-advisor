# Security Definer ACL Review

## Positive Evidence

- Final `REVOKE EXECUTE ON ALL FUNCTIONS/ROUTINES ... FROM PUBLIC` appears after
  the last function definition.
- Explicit bootstrap, catalog, broker, recovery and runtime grants follow the
  revoke.
- Private ledger/event helpers have no explicit caller grant.
- Registry records Owner, Security mode and `search_path`.

## Residual Risk

Default Privileges and final Catalog ACL cannot be proven without PostgreSQL
Catalog access. The design's explicit final revoke removes dependency on the
DDL execution role for existing functions, but future functions still require
the same closure.

No P1 ACL defect was found in the current static design.
