# P1 Product Remediation R3-C7 Changelog

Artifact: `P1_PRODUCT_REMEDIATION_R3_C7_CHANGELOG.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## Added

- Complete PostgreSQL 18 design DDL draft with 46 tables, 8 views, 44 functions
  and 15 roles.
- Full contextual provenance graph from RequirementVersion through sealed run
  and Snapshot children.
- Complete snapshot materializer, Basis builder, independent Basis verifier,
  deferred validators and finalizer.
- Session/epoch/grant locking protocol and linearized revoke semantics.
- Database-computed Policy digest, immutable Revision, append-only Event,
  effective-policy pointer and protected views.
- Exact function owner/search-path/grant inventory and static validator.
- Node and Python actual encoder entries with scalar, SourceKey and resource
  limit runners.
- Machine-readable scalar and Basis limit vectors.

## Preserved

- `SOURCE_KEY_R3` 362-byte maximum.
- R6 BYTES 512-byte maximum.
- SK-R2 registry code 3.
- C6-SNAP-01 4036 bytes and
  `7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB`.
- Warning identity/order.
- Policy author/approver separation.
- ProfessionalReview and policy-inclusive Review/Event FK design.
- All 51 prior Open Decisions.

## Corrected

- Undefined Database function references removed.
- Policy/ProfessionalReview EXECUTE argument mismatches removed.
- Idempotent replay now precedes stale-sequence rejection.
- Basis has finite record/field/body/total limits.
- View definitions and effective-policy state semantics are complete.
- Snapshot caller can no longer mix Case/RequirementVersion with another run.

## Not Performed

- No SQL, DDL, PostgreSQL connection or Catalog introspection.
- No Prisma Schema/Migration or source implementation.
- No Build, product test, Storage, Runtime or production operation.
- No Git write.
