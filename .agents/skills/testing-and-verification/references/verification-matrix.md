# Verification Matrix Reference

## Baseline Checks

Run when applicable:

```powershell
git status --short --branch
git diff --check
git diff --cached --name-only
pnpm typecheck
pnpm test
```

## Database Changes

```powershell
pnpm db:validate
pnpm db:generate
pnpm test:db:verify
pnpm test:db:constraints
```

Before any reset, verify the exact test database, role, marker, and `ALLOW_TEST_DB_RESET` authorization. Treat migration success and trigger correctness as separate evidence.

## Files and Workers

Test:

- Upload intent ownership, idempotency, MIME signature, size, checksum, and no-overwrite behavior.
- Download authorization, scan policy, checksum failure, headers, and streaming interruption.
- Queue duplicate delivery, permission revalidation, lease loss, stale token, retry exhaustion, and worker crash recovery.
- Staging/object cleanup only through approved test paths; never against real storage.

## Authentication and Authorization

Test unauthenticated, expired session, missing permission, project-scope mismatch, cross-customer access, and role-specific restrictions. Include negative tests for IDs taken from another project.

## Build and Release

```powershell
pnpm build
pnpm security:startup
```

Do not bypass startup security because the current HEAD is intentionally incomplete or because uncommitted P1-3 changes are present.

## Evidence Format

- Command
- Exit code
- Concise result
- Failure classification
- Whether the command changed database, storage, cache, build output, or Git state
- Remaining unverified behavior
