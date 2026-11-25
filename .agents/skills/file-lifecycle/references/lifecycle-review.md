# File Lifecycle Review Reference

## Required Model Chain

Verify the relationship and ownership chain for:

- `FileUploadIntent`
- `FileUploadAttempt`
- `StorageObjectLifecycle`
- `StorageObjectOperation`
- `FileVersion`
- `FileExtraction`
- `ExtractionField`
- `ExtractionFieldReview`
- `FileSecurityEvent`
- `AuditLog`

No foreign key, ownership token, generation, lease, operation, or storage key may be trusted from an untrusted job message or client payload.

## Lifecycle Checks

- Staging and canonical keys use their approved namespaces and are unique.
- An active canonical lifecycle has exactly one FileVersion.
- An ACTIVE lifecycle referenced by a FileVersion cannot leave ACTIVE through ordinary Web/Worker flow.
- Operation state follows the frozen state machine.
- Operation and lifecycle owner token, lease, and fencing generation agree.
- Terminal history is append-only and cannot be deleted or reclaimed through ordinary flows.
- `UNKNOWN` is resolved from durable filesystem evidence, not lease age alone.

## Filesystem Checks

- Reject symlinks, junctions, reparse points, network filesystems, unsupported filesystems, and untrusted roots.
- Use non-overwriting publication and verify file identity, size, and SHA-256.
- Do not assume an open file handle has closed because a database lease expired.
- Treat cross-device links, unsupported hard links, identity mismatch, and unverifiable close state as fail-closed conditions.

## Commit and Recovery Checks

- COMMIT unknown: preserve canonical objects and re-read durable evidence with a new connection.
- Duplicate queue delivery: an already-completed extraction is ignored without duplicating history.
- Lease loss: stop the active operation and reject late writes.
- Maintenance: require its own lease, fencing token, and re-read of current references before any destructive step.
- Orphan/inconsistent objects without valid Attempt ownership remain quarantined or retained for approved recovery.

## Test Evidence

Require:

- Upload/download authorization and integrity tests.
- Duplicate and concurrent worker tests.
- Lease renewal, lease loss, stale token, retry, and crash-recovery tests.
- Real database constraint/trigger behavior where authorized.
- Filesystem fail-closed tests in isolated test storage.
- No real file deletion or production database activity during verification.
