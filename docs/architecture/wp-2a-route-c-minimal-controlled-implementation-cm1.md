# WP-2A-CM1 — Route C-Minimal Controlled Implementation

## 0. Document Control

```text
Stage: WP-2A-CM1
Mode: CONTROLLED IMPLEMENTATION / READ-ONLY EXTERNAL VALIDATION
Date: 2026-11-26
Repository: D:\thinkbook\Desktop\jieya
Branch: codex/public-github-sync
HEAD: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main: 101e8a362e430f4fa7b31b67c56823cb702eb1e6
Final result: CM1 PARTIAL — IMPLEMENTATION BLOCKED
```

This is a controlled local/source implementation. The Migration has not been
applied to a database. No real Provider, IAM, PostgreSQL, Storage, ACL, Build,
E2E, Native RPC or deployment validation was performed.

## 1. Implementation Summary

Implemented:

- Provider-neutral object storage capability contract;
- explicit object version, write/read, error and capability types;
- `StorageObjectBinding` Prisma model and forward-only Migration;
- object backend discriminator on `FileVersion` and
  `StorageObjectLifecycle`;
- P1-3 object-backend binding guards;
- server-proxied object upload with pre-write Intent/Attempt/Lifecycle/
  Operation/Binding reservation;
- exact readback and SHA-256 verification before FileVersion creation;
- Web download through `FileVersion -> StorageObjectBinding -> exact version`;
- Worker exact-binding read path with Worker remains read-only;
- bounded local object adapter for isolated development and tests;
- no delete, purge, restore, quarantine or orphan cleanup in the new adapter;
- source and test type checking;
- file-storage adapter contract tests.

Not implemented:

- real Provider adapter or credentials;
- production database migration application;
- production database role/ACL split;
- real Provider version/copy/delete/audit tests;
- database integration and E2E execution;
- automatic cleanup or recovery;
- production deployment.

## 2. Files

Added:

```text
packages/file-storage/src/object-storage-adapter.ts
packages/file-storage/src/object-storage-errors.ts
packages/file-storage/src/local-object-storage-adapter.ts
packages/file-storage/tests/object-storage-adapter.test.ts
apps/web/src/modules/files/object-upload-service.ts
apps/web/tests/helpers/p13-file-version.ts
prisma/migrations/20261126120000_phase38_route_c_minimal_object_binding/migration.sql
docs/architecture/wp-2a-route-c-minimal-controlled-implementation-cm1.md
```

Modified tracked files:

```text
prisma/schema.prisma
packages/file-storage/src/index.ts
apps/web/src/modules/files/upload-service.ts
apps/web/src/modules/files/download-service.ts
apps/web/src/server/files/storage.ts
apps/web/src/app/api/projects/[projectId]/files/upload-intents/[intentId]/content/route.ts
apps/web/src/app/api/projects/[projectId]/files/[fileId]/versions/[versionId]/content/route.ts
apps/worker/src/storage.ts
apps/worker/src/file-processing.ts
apps/web/tests/download-route.test.ts
apps/web/tests/e2e/phase32-upload.spec.ts
apps/web/tests/integration/phase31-schema.test.ts
apps/web/tests/integration/phase33-file-access.test.ts
apps/web/tests/integration/phase36-field-review.test.ts
apps/web/tests/integration/phase37-review-invariants.test.ts
```

The pre-existing untracked reports and artifacts were not modified. No
operation touched `$null`, `UNKNOWN'`, `apps/web/.next`,
`apps/worker/dist`, `.env` or `.env.test`.

## 3. Adapter Contract

`packages/file-storage/src/object-storage-adapter.ts` defines:

```text
ObjectStorageVersionIdentity
ObjectStorageWriteRequest
ObjectStorageWriteResult
ObjectStorageExactReadRequest
ObjectStorageExactReadResult
ObjectStorageCapabilities
ObjectStorageReadCapability
ObjectStorageAdapter
```

The contract contains no delete, purge, restore, quarantine or cleanup
operation. The adapter must expose provider identity, exact version/token,
optional generation, size, SHA-256 and a capability state.

`packages/file-storage/src/object-storage-errors.ts` defines stable failure
classes for unavailable, permission denied, uncertain write, missing version,
version mismatch, checksum mismatch, size mismatch, unsupported no-overwrite
and unverified capability.

`LocalObjectStorageAdapter` is explicitly provider kind
`LOCAL_DEVELOPMENT`. It is a bounded local test/development adapter, not a real
Provider result or production validation.

## 4. Schema and Migration

Added enums:

```text
StorageBackend: LEGACY_LOCAL | OBJECT_STORE
StorageObjectBindingState: PENDING | VERIFIED | FAILED_RETAINED
```

Added `StorageObjectBinding`:

```text
id, objectLifecycleId, operationId
providerKind, accountScopeRef, region, bucketOrContainer, objectKey
providerVersionId, providerGeneration
sizeBytes, checksumSha256
state, createdAt, verifiedAt
```

Added to `FileVersion`:

```text
storageBackend
storageObjectBindingId
```

Added to `StorageObjectLifecycle`:

```text
storageBackend
```

The new forward migration is:

```text
prisma/migrations/20261126120000_phase38_route_c_minimal_object_binding/migration.sql
```

It adds the binding table, lifecycle/operation FKs, unique binding anchors,
object/legacy backend checks, binding state checks, binding immutability and
delete/truncate guards, the FileVersion binding guard and the object-backend
staging branch.

The historical P1-3 Migration was not modified. The new migration has not
been applied to any database.

Validation:

```text
pnpm db:validate: PASS
prisma generate: PASS
Migration application: NOT EXECUTED
Database trigger behavior: NOT VERIFIED
```

## 5. Upload Call Chain

The object path is implemented in
`apps/web/src/modules/files/object-upload-service.ts`:

```text
1. Validate Intent, actor, project, size and MIME.
2. Verify adapter capabilities are SUPPORTED.
3. Create Attempt, logical STAGING lifecycle, canonical FINALIZING lifecycle,
   FINALIZE operation and PENDING binding in one DB transaction.
4. Commit before any Provider write.
5. Service writes the request stream to a unique canonical object key.
6. Service obtains exact Provider version identity.
7. Service reads the exact version back.
8. Service verifies written/readback size, SHA-256, MIME and filename.
9. One DB transaction marks binding VERIFIED, staging READY, operation
   APPLIED, canonical lifecycle ACTIVE, attempt COMPLETED and creates the
   complete FileVersion/Extraction/current pointer chain.
10. Intent is completed and AuditLog is appended.
11. Queue extraction only after DB commit.
```

The existing local path now creates the same logical Attempt/Lifecycle/
Operation chain for bounded development/tests. It is not enabled as a
production publication mechanism: `completeUpload` fails closed with
`OBJECT_STORAGE_REQUIRED` in production when no object adapter exists.

The local path no longer uses the simple precheck-then-rename object as an
object-store publication claim. `LocalObjectStorageAdapter` writes the
reserved canonical key with exclusive creation and no delete capability.

## 6. Download and Worker Paths

Download:

```text
prepareFileDownload
  -> project/file/version ownership checks
  -> load storageObjectBinding
  -> require OBJECT_STORE binding state VERIFIED
  -> require binding objectKey/size/hash match FileVersion
  -> adapter.readExact(exact provider version)
  -> verify response bytes/size/SHA-256
  -> existing scan/integrity policy and safe response headers
```

Worker:

```text
FileExtraction
  -> reload FileVersion from database
  -> load StorageObjectBinding
  -> require exact verified binding
  -> adapter.readExact(exact provider version)
  -> verify size/SHA/MIME
  -> process only that bytes value
```

Worker has only `ObjectStorageReadCapability` plus existing local read
capability. It does not accept a job-provided object key, Provider version,
project owner or user identity. Missing or mismatched binding is blocked and
recorded as a security/integrity event.

## 7. Idempotency, Concurrency and Failure Recovery

Implemented behavior:

- existing `(uploadedById, requestKey)` Intent idempotency remains;
- a reused fingerprint returns the existing Intent;
- a different fingerprint fails before Provider work;
- a completed Intent returns its existing FileVersion;
- one canonical lifecycle/operation owns one binding;
- the object key is server-generated per attempt and never reused;
- a duplicate or conflicting binding is rejected by database uniqueness;
- Provider write uncertainty is retained and is not blindly replayed;
- DB commit uncertainty is recoverable by reading binding, operation,
  attempt and FileVersion through a fresh connection;
- a failed object path marks the binding `FAILED_RETAINED` when the failure
  transaction is available;
- no failure path deletes a possibly successful object.

Not claimed:

- retry/reconciliation against a real Provider;
- PostgreSQL row-lock/contention behavior;
- service restart behavior on a running deployment.

## 8. Delete and Cleanup Fail-Closed

Existing fail-closed code remains:

```text
cleanupExpiredUploadIntents -> LegacyStorageCleanupDisabledError
QuarantinedLegacyStorageCleanup.removeStaging -> throws
QuarantinedLegacyStorageCleanup.removeObject -> throws
cleanupOrphanObjects -> throws
cleanupTemp -> throws
```

The new adapter exposes no delete, purge, restore, quarantine or cleanup
method. No business File/FileVersion DELETE route was added.

Static storage-delete audit tests passed and reported no unallowlisted
production physical delete calls.

## 9. RA1-V01 through RA1-V12

The table records the implemented source path and current evidence state.
`NOT EXECUTED` means the test needs an isolated database/Provider runtime that
was not available or authorized in this run; it is not a PASS.

| ID | Source path | Expected final state | Current result |
|---|---|---|---|
| `RA1-V01` | object upload service + Web upload route | one FileVersion, one VERIFIED exact binding, one object version | Adapter contract/unit: PASS; DB/provider end-to-end: NOT EXECUTED |
| `RA1-V02` | upload adapter interruption | attempt retained, no FileVersion, object retained | unit contract of no-delete: PASS; DB interruption: NOT EXECUTED |
| `RA1-V03` | object write -> DB finalization fault | binding/operation recoverable; no second write or FV | state design implemented; fault database test: NOT EXECUTED |
| `RA1-V04` | Intent idempotency and binding uniqueness | same request returns same result; one object/FV | source paths implemented; DB concurrency: NOT EXECUTED |
| `RA1-V05` | parallel finalization/current pointer | one valid binding/current pointer, no dual success | source uses transaction and unique constraints; two-session test: NOT EXECUTED |
| `RA1-V06` | adapter readback/hash checks | no VERIFIED binding or readable FV on digest mismatch; object retained | fake adapter/contract: PASS for adapter shape; Web/DB mismatch: NOT EXECUTED |
| `RA1-V07` | Web download policy and binding read | unauthorized project/user read denied, no bytes | existing unit policy/access tests pass; object-route cross-user DB/E2E: NOT EXECUTED |
| `RA1-V08` | legacy cleanup/delete inventory and new adapter | no delete/purge/restore/cleanup capability | static delete audit: PASS |
| `RA1-V09` | Worker binding read path | wrong/missing version blocked; no raw key substitution | Worker TypeScript/tests: PASS for existing behavior; exact-binding DB/Worker test: NOT EXECUTED |
| `RA1-V10` | adapter unavailable error classification | retained pending/recovery state; no success | error contract implemented; real unavailable Provider: NOT EXECUTED |
| `RA1-V11` | binding/object mismatch path | no read/publish; object retained; security event | source guard implemented; DB/Provider mismatch test: NOT EXECUTED |
| `RA1-V12` | durable chain/restart | existing committed result or retained recovery state; no blind retry | source chain implemented; restart/fault injection: NOT EXECUTED |

## 10. Test and Verification Results

Executed:

```text
pnpm db:validate
PASS

pnpm db:generate
PASS (Prisma Client generation only)

pnpm --filter @elevator/file-storage test
PASS — 22 tests, including 3 object adapter contract tests

pnpm --filter @elevator/worker test
PASS — 19 tests

pnpm --filter @elevator/web test
PASS — 275 unit/static tests

pnpm --filter @elevator/contracts test
PASS — 15 tests

pnpm --filter @elevator/selection-engine test
PASS — 9 tests

pnpm typecheck
PASS
```

Not executed:

```text
pnpm test:db:verify
pnpm test:db:constraints
pnpm test:e2e
pnpm build
pnpm security:startup
Real Provider tests
Migration application
```

`pnpm test` at workspace root was attempted and returned FAIL because the
`packages/authority-core` package invokes `vitest run` without resolving a
local `vitest` binary. Scoped package tests above were run directly and pass.
This is an independent workspace-tooling defect, not a CM1 Provider result.

## 11. Provider and Production Permission Boundary

Current implementation:

- Web receives a local bounded adapter in non-production through
  `getObjectStorageAdapter`;
- Worker receives only an object read capability through
  `createWorkerObjectStorage`;
- the adapter interface has no delete method;
- production Web without an object adapter fails closed on upload;
- no real Provider credential is configured or read.

Not implemented:

- Provider IAM policy and role separation;
- exact-key credential issuance/revocation;
- PostgreSQL production roles and ACLs;
- mTLS/pg_ident;
- production Trust Root;
- real Provider conditional-write/version/audit verification.

The current `elevator_app` owner role cannot be treated as a production
Web/Worker separation. Real production authorization remains BLOCKED.

## 12. Migration and Database Boundary

The forward Migration is present but was not applied. Static Prisma validation
is not proof of:

- PostgreSQL trigger compilation;
- Trigger behavior under commit/rollback;
- FK/CHECK behavior;
- concurrent transaction behavior;
- binding/object lifecycle invariants in a real database.

An isolated, disposable PostgreSQL clone must be created and identity-checked
before applying this Migration. Development, shared and production databases
remain prohibited.

## 13. Remaining Blockers

```text
Provider account/region/API version/credentials: NOT VERIFIED
Provider exact-version readback/conditional write: NOT VERIFIED
Provider no-overwrite/version identity semantics: NOT VERIFIED
PostgreSQL isolated migration and trigger behavior: NOT EXECUTED
Database production roles/ACL: NOT IMPLEMENTED
Historical file classification/backfill: NOT EXECUTED
Service restart/recovery integration: NOT EXECUTED
Real Provider IAM and audit: NOT VERIFIED
Production deployment: NOT AUTHORIZED
```

The current local object adapter is bounded local development/test only. It is
not evidence that a cloud Provider supports the contract.

## 14. Differences from MI1

Implemented beyond MI1 readiness plan:

- added concrete adapter interfaces and error taxonomy;
- added `StorageObjectBinding` schema and forward migration;
- added object version binding fields to FileVersion;
- added object-backed Web upload branch;
- added exact binding read to Web download;
- added exact binding read to Worker;
- added object capability tests and P1-3 test fixture support;
- made production local publication fail closed.

Still not completed:

- real Provider adapter;
- isolated database application and trigger proof;
- database concurrency/fault tests;
- E2E and restart tests;
- production permission setup;
- production deployment.

## 15. Git and Integrity

At CM1 start:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       0
Staged:                 0
Deleted:                0
Untracked:              37
```

At CM1 end:

```text
Branch:                 codex/public-github-sync
HEAD:                   101e8a362e430f4fa7b31b67c56823cb702eb1e6
origin/main:            101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:       15
Staged:                 0
Deleted:                0
Untracked:              45
```

The exact tracked modified and untracked file list is recorded in the final
delivery message. Existing untracked reports and user work were not removed.

No Git add, commit, push, reset, restore, clean, checkout, stash or rebase was
executed. No source operation touched the protected build directories.

A file cannot contain its own whole-file SHA-256 without changing that SHA;
the final SHA-256, byte count and line count are supplied after the report
bytes are frozen.

## 16. Final Verdict

```text
WP-2A-CM1: CM1 PARTIAL — IMPLEMENTATION BLOCKED

Implemented:
  adapter contract, binding schema/migration, upload branch,
  exact Web/Worker binding read, delete fail-closed boundary,
  type checks and local/unit tests

Not admitted as complete:
  isolated database migration/trigger behavior,
  real Provider semantics, IAM/ACL, restart/E2E,
  production permission boundary and deployment

Source implementation:
  PARTIAL

Provider / PostgreSQL / Storage / IAM / Runtime:
  NOT VERIFIED
```
