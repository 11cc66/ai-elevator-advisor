# Architecture Review Reference

## Current Module Boundaries

- `apps/web`: Next.js pages, Route Handlers, server-side auth/authorization, domain services, and private file access.
- `apps/worker`: pg-boss jobs, file processing, maintenance, recovery, and lease ownership.
- `packages/contracts`: shared Zod input/output contracts.
- `packages/selection-engine`: deterministic engineering and selection rules; AI must not own hard constraints.
- `packages/file-storage`: private storage capabilities and filesystem safety boundaries.
- `packages/shared-ui`: shared presentation primitives.
- `packages/build-integrity`: release identity and startup verification.
- `prisma`: schema and migrations; P1-3 DB invariants are in `docs/architecture/`.

## Source Priority

1. Root and applicable nested `AGENTS.md` safety boundaries.
2. `README.md` and the root AGENTS task/document router.
3. Current code, tests, schema, and migration state.
4. Phase and architecture status documents.
5. Product planning documents not contradicted by confirmed implementation facts.

The blueprint `AGENTS.md` statement that the technology stack is not final is historical. Current stack facts come from the root README, manifests, and implemented code. Product scope and AI safety rules remain authoritative.

## Change Impact Questions

- Which package owns the behavior after the change?
- Is the change implemented, partially implemented, planned, or unconfirmed?
- Does it alter auth, project scope, audit, versioning, or immutable history?
- Does it add or change a database invariant, transaction, lease, or background job?
- Does it touch a private file object, its metadata, physical path, or lifecycle state?
- Can AI output become authoritative data or bypass human review?
- Does the change affect deployment identity, startup gates, storage ACLs, or role ownership?
- Which public contracts, tests, and operator instructions must change together?

## Escalation Triggers

Stop for user confirmation when the task requires a new technology, package, service boundary, multi-tenant model, external provider, production data access, destructive operation, or a change to a frozen architecture decision.
