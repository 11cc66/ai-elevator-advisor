# Database Change Review Reference

## Required Review Areas

### Schema

- Confirm field nullability, defaults, units, decimal representation, timezone behavior, and JSONB limits.
- Confirm stable identifiers and version/reference relationships.
- Confirm core query and integrity fields are not hidden in unconstrained JSON.

### Migration

- Use a new forward migration; do not edit applied migration files.
- Separate expand, backfill, validate, and contract steps when existing data is involved.
- Define prechecks, postchecks, stop conditions, and rollback limitations.
- Do not backfill unknown values by guessing.

### Database Invariants

- Preserve composite foreign keys, CHECK constraints, unique indexes, partial unique indexes, append-only triggers, and state-transition guards.
- Verify that nullable composite relationships cannot bypass constraints through partial nulls.
- Treat trigger changes as behavior changes requiring real database tests.

### Transactions and Concurrency

- Keep related invariant writes and AuditLog changes in one transaction.
- Use conditional updates or row locks for state transitions.
- Use unique constraints as the final duplicate/concurrency guard.
- Retry only errors classified as transient serialization/deadlock failures.
- For workers, require the current processing token or lease and reject stale writers.
- Treat filesystem operations as outside database rollback.

### Commit Unknown

- Do not decide success from memory or a lost connection.
- Re-read durable database and filesystem evidence.
- Preserve canonical objects when COMMIT outcome is unknown.

### Roles and Testing

- Never infer that owner, role membership, or PUBLIC EXECUTE isolation is complete from table existence.
- Verify exact database name, login role, marker, storage root, and reset flag before test reset.
- Keep development, test, and production identities separate.

## Minimum Evidence

- `pnpm db:validate`
- `pnpm db:generate`
- `pnpm test:db:verify` before destructive test setup
- `pnpm test:db:constraints` for database behavior
- `pnpm typecheck`
- Relevant unit/integration/E2E tests
- `pnpm build` when production packaging or runtime behavior changes

Report `PASS`, `FAIL`, `PARTIAL`, and `NOT VERIFIED` separately.
