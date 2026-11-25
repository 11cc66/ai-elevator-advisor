# P1 Product Remediation R3-C5 Changelog

Status:

```text
R1/R2/R3/C2/C3/C4: PRESERVED
R3-C5: NEW DESIGN DIRECTORY
SOURCE/SCHEMA/MIGRATION: NOT MODIFIED
DATABASE/RUNTIME: NOT ACCESSED
```

## 1. Stable Identity

- Added `SK-R2` versioned binary tuple framing.
- Preserved colon-bearing ASCII IDs without parsing.
- Added explicit NULL/empty/missing semantics.
- Moved relational uniqueness authority to structured composite keys.
- Added collision vectors and version-migration rules.
- Retired R1 colon stable keys from forward use.

Reason:

`REV-R3-C4-P1-01`, `REV-R3-C4-P2-05`, `REV-R3-C4-P2-06`.

## 2. Snapshot Registry and Schema

- Added `SNAPSHOT-R2` with ten record types and explicit field tags.
- Added full requirement source binding to the Basis.
- Added `sourceKind` to Source Revision.
- Added Catalog Review `targetRevisionId` and `policyRevisionId`.
- Added structured Warning `warningSequence`.
- Added exact same-Snapshot and structured-source FKs.
- Added append-only/immutability and TRUNCATE guards.

Reasons:

`REV-R3-C4-P1-03`, `REV-R3-C4-P2-02`, `REV-R3-C4-P2-03`.

## 3. Basis

- Upgraded to `R3-BASIS-1-R5`.
- Made `stableKey` opaque binary bytes.
- Required every Registry field to be present.
- Made NULL a present field with type/presence zero.
- Added `SOURCE_KEY_R3`.
- Added semantic fixture `C5-SNAPSHOT-01`.
- Generated 3051-byte Basis with SHA-256
  `83F00E53B7AC21779B2753F0640B3023E2DE6A53AFA405BC0E4C8A2FDC056FB1`.
- Node/Python full bytes compared equal.

Reasons:

`REV-R3-C4-P1-02`, `REV-R3-C4-P1-03`.

## 4. Event Authority

- Removed caller-supplied actor ID and new state.
- Added `session_user`-bound principal resolution.
- Added scoped AuthorityGrant and policy binding.
- Added closed command/state matrix.
- Added policy-inclusive Review UNIQUE and Event FK.
- Added replay/sequence CAS and self-approval denial.

Reasons:

`REV-R3-C4-P1-04`, `REV-R3-C4-P2-01`.

## 5. PostgreSQL Privileges

- Added database/schema/table/function/migrator/runtime/principal roles.
- Added CONNECT, USAGE, CREATE, table, sequence, type, function, view,
  default-privilege, membership, INHERIT/SET ROLE, PUBLIC and owner controls.
- Added SECURITY DEFINER and trigger-function requirements.
- Added explicit TRUNCATE strategy.
- Added introspection queries and administrative break-glass boundary.

Reason:

`REV-R3-C4-P2-04`.

## 6. Tests and Decisions

- Added stable-key, registry, FK, deferred, concurrency, Basis, identity,
  authority and privilege test matrices.
- Preserved all 41 historical Open Decisions.
- Added five C5 Open Decisions.
- Kept implementation, Schema, Migration, Database, Runtime and Production
  unauthorized.

## 7. Compatibility

- R1/R4 records are historical read-only.
- R2/R5 uses new registry/protocol/encoding identities.
- No historical file is rewritten.
- No old Basis is reinterpreted under R2/R5.
- Quarantine is required if an old tuple cannot be structurally recovered.

## 8. Non-Changes

```text
Application source: NOT MODIFIED
Product tests: NOT MODIFIED
Prisma Schema: NOT MODIFIED
Migrations: NOT MODIFIED
Configuration/Lockfile: NOT MODIFIED
P1-3 lifecycle: NOT MODIFIED
Storage: NOT ACCESSED
Database: NOT ACCESSED
Runtime/Build: NOT EXECUTED
Git writes: NONE
$null: NOT READ/HASHED/MODIFIED
```

