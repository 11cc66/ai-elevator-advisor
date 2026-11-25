# Design Changelog R3-C8 Corrections

## Added

- Full Price Fact canonical object and database-computed digest.
- Sealed Price facts and Snapshot Price fact FK/check.
- Requirement assertion/FieldValue authoritative tables and source FKs.
- Immutable CatalogReview event and target bindings.
- ProfessionalReview result/target/event/basis bindings.
- Recursive Session Role closure, membership option and direct ACL checks.
- One-time seed/initiator/approver/root bootstrap and root Grant.
- Explicit Database CONNECT for fixed bootstrap login roles.
- Request Ledger epoch and cross-Session replay audit.
- Explicit ProfessionalReview and TrustedSession TRUNCATE guards.
- Pre-Seal Source-Aux validation.
- Corrections validator with 11 mutation fixtures.

## Preserved

- C6-SNAP-01: 15 records / 4036 bytes / exact SHA-256.
- SourceKey 362-byte and Basis 512-byte compatibility limits.
- SK-R2 registry code 3.
- 57 original Open Decision IDs.
- Original C8 and C8 Review directories unchanged.
