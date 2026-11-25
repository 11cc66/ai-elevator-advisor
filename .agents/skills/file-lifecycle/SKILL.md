---
name: file-lifecycle
description: "Implement or review the AI Elevator Advisor private file lifecycle across upload intent, staging, canonical objects, immutable versions, operations, leases, fencing, quarantine, recovery, and purge. Use for any file upload, download, deletion, cleanup, or recovery change."
---

# File Lifecycle

## When to Use

Use this skill for any change to private-file storage, file metadata, processing states, cleanup, recovery, or the P1-3 lifecycle protocol.

## Required Context

1. Confirm the repository root, current branch, HEAD, Git status, current lifecycle status, and relevant implementation files.
2. Follow the root `AGENTS.md` file-lifecycle route. Read `D02`, `D03`, `D04`, `D05`, `D08`, `D09`, `D11`, `P30`–`P37`, `FZ`, `ST`, and `DBTP` completely.
3. Read every design, decision, review, or report linked by `ST` for the operation being changed.
4. Inspect the actual schema, migrations, storage capabilities, worker lease code, download/upload services, and tests.

## Workflow

1. Identify the lifecycle object, operation, current state, intended transition, and durable evidence.
2. Verify database ownership, lease, generation, token, and operation constraints before allowing a state transition.
3. Verify filesystem identity, path namespace, links/reparse points, size, and checksum independently from database state.
4. Define behavior for retry, crash, stale worker, lease loss, partial failure, COMMIT unknown, and recovery.
5. Preserve immutable FileVersion, extraction, review, security event, and audit history.
6. Run database, unit, integration, E2E, concurrency, and failure tests required by the touched path.

Read [references/lifecycle-review.md](references/lifecycle-review.md) for the lifecycle and filesystem review checklist.

## Coordination

- Start with `$project-architecture` when ownership or state boundaries are unclear.
- Use `$prisma-db-safety` for schema, constraints, triggers, transactions, roles, and concurrency implementation.
- Use `$security-audit` for authorization, path traversal, symlink, IDOR, privilege, or destructive-operation review.
- Use `$testing-and-verification` for final evidence and worktree validation.

## Hard Safety Rules

- Filesystem and database are not one transaction.
- Never delete or move a canonical object merely because an intent expired, a lease expired, a database row says `DELETED`, or a client observed an error.
- Never claim physical deletion from a database state or cleanup counter alone.
- Stale workers must not overwrite newer processing or lifecycle results.
- Do not re-enable legacy Web/Worker delete capability.
- Do not enable automatic cleanup, purge, restore, ACTIVE recovery, or destructive filesystem execution without explicit approval and a reviewed Operation protocol.
- Treat `BLOCKED`, `PARTIAL`, and `NOT VERIFIED` status as unresolved.

## Completion

Report the state and operation flow, database and filesystem invariants, crash/concurrency behavior, authorization, test evidence, remaining gaps, and whether production enablement remains prohibited.
