# Request Ledger, TRUNCATE and Pre-Seal Audit

## Request Ledger

The corrections add:

- stored epoch;
- same-Session replay;
- same-Principal/new-Session replay at the current epoch;
- replay audit row;
- payload/scope/result checks.

Independent result: `PARTIAL`.

Finding `P2-02`: the code does not inspect the original Session's state before
cross-Session replay. A new Session of the same Principal at the same epoch can
recover a result after the original Session is revoked. The design must decide
explicitly whether this is permitted.

## TRUNCATE

Named guards now exist for:

- `professional_review`;
- `professional_review_event`;
- `trusted_session`;
- Snapshot/Selection/Policy archives.

Static result: `PASS WITH RUNTIME CAVEAT`. CASCADE behavior and owner bypass
remain unverified without PostgreSQL.

## Source-Aux Pre-Seal

`validate_selection_source_aux_r3` checks source auxiliary shape, NFC/control
domain, 362-byte SourceKey limit and copy consistency. `seal_selection_run`
calls it before result count, digest, seal and completion.

Static result: `PASS`. Concurrent behavior is `NOT VERIFIED`.

## Verdict

```text
Request Ledger: PARTIAL
ProfessionalReview TRUNCATE: PASS STATIC
Source-Aux Pre-Seal: PASS STATIC
Runtime concurrency: NOT VERIFIED
```
