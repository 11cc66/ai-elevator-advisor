---
name: prisma-db-safety
description: "Design, implement, or review Prisma and PostgreSQL schema, migration, transaction, constraint, concurrency, and database-role changes for the AI Elevator Advisor. Use whenever data-model or database behavior changes."
---

# Prisma DB Safety

## When to Use

Use this skill for Prisma Schema edits, PostgreSQL migrations, constraints, triggers, indexes, transaction semantics, concurrency controls, test database validation, and database role/ACL work.

## Required Context

1. Resolve the repository root and inspect current Git status, `prisma/schema.prisma`, migrations, database access code, and relevant tests.
2. Follow the root `AGENTS.md` high-risk document router. Read all mapped database, concurrency, security, and decision documents completely.
3. When file tables, lifecycle tables, triggers, or file data safety are involved, also read `P31`–`P37`, `FZ`, `ST`, and `DBTP`.
4. Distinguish an isolated test database from development, shared, and production databases.

## Workflow

1. State the intended invariant and identify whether application code, a constraint, a transaction, or a database object must enforce it.
2. Review current schema and migration history before proposing changes.
3. Create a forward-only migration and preserve already-applied migrations.
4. Design transaction boundaries and concurrency controls using unique constraints, CAS, row locks, tokens, leases, or fencing as appropriate.
5. Validate with the narrowest safe database test set, then run typecheck and regression tests required by the risk.
6. Report schema, migration, trigger, role/ACL, transaction, concurrency, rollback, and data-risk implications separately.

Read [references/database-change-review.md](references/database-change-review.md) for the migration and concurrency review checklist.

## Coordination

- Start with `$project-architecture` when boundaries or data ownership are unclear.
- Use `$file-lifecycle` for file tables, lifecycle state, cleanup, lease fencing, and commit-unknown behavior.
- Use `$security-audit` for role/ACL, privilege, trigger bypass, or data-isolation review.
- Use `$testing-and-verification` for final evidence collection.

## Hard Safety Rules

- Never use `prisma db push` in place of a migration.
- Never edit an applied historical migration.
- Never execute `DROP`, `TRUNCATE`, `DELETE`, reset, repair, ACL/role changes, or migration deployment against a shared or production database without explicit authorization for that exact target.
- Never bypass triggers, constraints, database identity guards, or test storage guards.
- Never equate a successful migration with verified trigger behavior, transaction behavior, concurrency correctness, or filesystem safety.
- Test database resets are limited to the project’s validated test database and role after all identity and path checks pass.

## Completion

Report modified files, invariant mapping, migration plan, transaction and concurrency controls, test commands/results, database/config changes, rollback limits, risks, and unverified behavior.
