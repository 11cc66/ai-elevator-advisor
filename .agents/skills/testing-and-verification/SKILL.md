---
name: testing-and-verification
description: "Plan and execute risk-based verification for AI Elevator Advisor changes, including unit, integration, database, E2E, build, concurrency, and worktree checks. Use to validate implementation results or prepare a reproducible delivery report."
---

# Testing and Verification

## When to Use

Use this skill when selecting tests, validating a completed change, reproducing a failure, or independently checking another implementation result.

## Required Context

1. Read the root `AGENTS.md` task router and the relevant acceptance documents.
2. Inspect the actual diff, affected modules, tests, package scripts, environment guards, and current Git state.
3. Establish a baseline before running tests that can create build artifacts, reset a test database, or modify test storage.
4. Use only authorized environments and data.

## Workflow

1. Map the change to behavior, data, permissions, concurrency, filesystem, and build risks.
2. Select the smallest sufficient test matrix and add higher-risk tests for state, isolation, failure, and recovery behavior.
3. Run independent commands where possible and capture exit status and concise evidence.
4. Distinguish test failure, environment failure, flaky behavior, and missing prerequisites before editing anything.
5. Re-run affected checks after authorized fixes.
6. Report exact commands and classify each result as `PASS`, `FAIL`, `PARTIAL`, or `NOT VERIFIED`.

Read [references/verification-matrix.md](references/verification-matrix.md) when choosing tests or preparing the delivery evidence.

## Coordination

- Use `$project-architecture` to determine affected boundaries.
- Use `$prisma-db-safety` for database test design and failure interpretation.
- Use `$file-lifecycle` for lifecycle, worker, fencing, commit-unknown, and cleanup coverage.
- Use `$security-audit` for adversarial security verification.

## Hard Safety Rules

- Never delete, skip, weaken, or rewrite a failing test solely to obtain a green result.
- Never run destructive database setup without the project’s exact test database identity and path guards.
- Never use development, shared, or production data as a test fixture.
- Never hide a skipped or unavailable test.
- Do not mistake a successful migration, typecheck, or build for concurrency or runtime-safety verification.

## Completion

Provide the risk summary, commands, results, failures and diagnosis, artifacts produced, unexecuted checks, worktree impact, residual risks, and final status.
