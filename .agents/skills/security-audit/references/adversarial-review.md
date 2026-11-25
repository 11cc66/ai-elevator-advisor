# Adversarial Security Review Reference

## Attack Surfaces

- Better Auth sessions, cookies, login/logout, account status, and session expiry.
- Global permissions, project-scoped roles, CUSTOMER ownership, and cross-project resource IDs.
- Route Handler input validation, object ownership chains, error leakage, and auditability.
- Upload intent ownership, idempotency reuse, MIME/signature mismatch, size limits, and path handling.
- Download authorization, malware-scan state, checksum verification, streaming interruption, and security headers.
- Worker job payload trust, permission revalidation, token/lease fencing, retries, and stale writes.
- File lifecycle operations, symlinks/reparse points, hard links, canonical overwrite, quarantine, recovery, and orphan cleanup.
- Startup/build gates, release manifests, trust roots, role assumptions, and secret exposure.
- Logs, test fixtures, screenshots, errors, and generated evidence files.

## Evidence Standard

For each finding include:

- Severity: P0 critical, P1 high, P2 medium, P3 low.
- Exact file and one-based line.
- Entry point and complete call path.
- Required actor, permissions, input, and environmental preconditions.
- Actual impact and whether the path is reachable.
- Why existing controls do not prevent the path.
- A minimal safe reproduction or verification method.

## Severity Guide

- P0: production compromise, broad data loss, arbitrary code execution, or systemic cross-tenant access.
- P1: practical privilege escalation, cross-project private data access, unauthorized destructive file operation, or auth bypass.
- P2: limited disclosure, defense bypass requiring strong preconditions, or meaningful integrity weakness.
- P3: low-impact hardening or information exposure with narrow preconditions.

## Review Discipline

- Treat uploaded file content and model output as untrusted.
- Check both page guards and API/data-access authorization.
- Verify that global admin permissions do not silently substitute for role-specific customer actions.
- Check stale-worker and retry paths for authorization revalidation.
- Treat lease expiry as loss of coordination, not proof that an operating-system file handle has closed.
- Mark behavior as `NOT VERIFIED` when tests or runtime evidence are insufficient.
