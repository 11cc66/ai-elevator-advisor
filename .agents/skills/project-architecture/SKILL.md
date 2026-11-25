---
name: project-architecture
description: "Review AI Elevator Advisor changes against current module boundaries, implementation state, and approved architecture decisions. Use for architecture-impact analysis, design planning, or when proposed work may alter a confirmed boundary."
---

# Project Architecture

## When to Use

Use this skill before implementation when a request may cross package, Web, Worker, contract, database, AI, selection-engine, or file-storage boundaries. Do not use it to impose architecture changes on routine work that already has a clear local pattern.

## Required Context

1. Resolve the repository root with `git rev-parse --show-toplevel` and stop if it is not `D:\thinkbook\Desktop\jieya`.
2. Apply the root `AGENTS.md` document router. Read only the task-mapped product and implementation documents.
3. Inspect `README.md`, relevant manifests, the related modules, tests, Prisma schema, and current Git status.
4. For cross-cutting or ambiguous changes, read the blueprint `AGENTS.md`, `D01`, `D03`, `D10`, and `D11`.

## Workflow

1. Separate confirmed decisions, current implemented behavior, partial work, planned work, and open decisions.
2. Trace the request through the smallest relevant module set and identify all ownership boundaries it affects.
3. Propose a vertical slice that preserves Web/API, Worker, contracts, deterministic selection, AI adapter, database, and storage separation.
4. Identify migrations, permissions, audit, lifecycle, concurrency, tests, and documentation affected by the change.
5. If the request requires a new service, framework, data owner, deployment model, or workflow owner, stop and request explicit approval.

Read [references/architecture-review.md](references/architecture-review.md) when mapping cross-module impact or resolving conflicting sources.

## Coordination

- Database work continues with `$prisma-db-safety`.
- File upload, download, recovery, or cleanup work continues with `$file-lifecycle`.
- Security-sensitive work is reviewed with `$security-audit`.
- Verification is completed with `$testing-and-verification`.
- Specialist Skills may add stricter constraints but may not relax confirmed architecture decisions.

## Safety Boundaries

- Do not infer unconfirmed roles, retention periods, production topology, model providers, or product rules from planning documents.
- Do not treat `BLOCKED`, `PARTIAL`, or `NOT VERIFIED` status as complete.
- Do not change the approved stack or module ownership without explicit user confirmation.
- Do not copy authoritative documents into the Skill; link to them.

## Completion

Report the affected modules, confirmed constraints, implementation status, proposed slice, required specialist review, tests, risks, and unresolved decisions.
