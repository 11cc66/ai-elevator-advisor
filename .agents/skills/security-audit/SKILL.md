---
name: security-audit
description: "Perform a read-only adversarial security review of the AI Elevator Advisor, including authentication, authorization, tenant isolation, API validation, files, secrets, startup gates, and release integrity. Use when the user requests a security audit or security-sensitive review."
---

# Security Audit

## When to Use

Default to read-only analysis. Produce evidence-backed attack paths, not a general checklist recital.

## Required Context

1. Confirm the repository root and inspect current Git status before reviewing.
2. Apply the root `AGENTS.md` high-risk document router for auth, permissions, files, concurrency, startup, deployment, and database scope.
3. Read the current security-sensitive implementation, tests, schema, configuration names, and status documents.
4. Never print or copy secrets. Redact tokens, passwords, cookies, keys, and sensitive paths.

## Workflow

1. Define the reviewed surface, trust boundaries, actors, and assets.
2. Trace untrusted input to authorization decisions, database queries, filesystem operations, subprocesses, outbound requests, and logs.
3. Verify controls in code and tests; do not assume a nearby guard applies.
4. Check client/project isolation, IDOR, state transitions, replay/idempotency, stale-worker writes, and cleanup races.
5. Classify confirmed findings as P0–P3 with file and line references, call chain, preconditions, impact, and evidence.
6. Separate confirmed vulnerabilities, defense-in-depth gaps, unverified assumptions, and accepted risks.

Read [references/adversarial-review.md](references/adversarial-review.md) when building the attack-path matrix or assigning severity.

## Coordination

- Use `$project-architecture` to understand intended boundaries.
- Use `$prisma-db-safety` for database privileges, trigger bypass, role/ACL, or transaction findings.
- Use `$file-lifecycle` for upload, download, deletion, recovery, storage identity, or commit-unknown findings.
- Use `$testing-and-verification` to reproduce findings without weakening the security baseline.

## Hard Safety Rules

- Do not modify code, database, ACL, configuration, security gates, reports, or production state during an audit unless the user separately authorizes remediation.
- Do not weaken or bypass Startup Gate, authentication, authorization, scanning, or test-identity checks to obtain a result.
- Do not call a system secure solely because tests pass.
- Do not present unverified assumptions as implemented controls.
- Do not expose secrets in reports or logs.

## Completion

Report scope, reviewed revisions, confirmed findings by severity, evidence, unverified areas, and a final status. Use `PASS`, `PASS WITH WARNINGS`, or `FAIL` only when supported by the reviewed scope.
