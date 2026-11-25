# P1 Product Remediation R3-C3 Changelog

## Status

```text
R1/R2/R3/R3-C2: PRESERVED / NOT MODIFIED
R3-C3 DESIGN: COMPLETE WITH OPEN BLOCKERS
SOURCE/Schema/Migration: NOT MODIFIED
DATABASE/Runtime: NOT VERIFIED
```

## P1-01 R3-BASIS-1

- Replaced UUID row IDs with canonical text/CUID row IDs.
- Defined revision 3 top-level, Record and Field frames with no implicit
  padding or separator.
- Fixed scalar encodings: Boolean, signed 64-bit INTEGER, normalized Decimal,
  NFC UTF-8 TEXT, stable ENUM, CANONICAL_ID, UTC Timestamp, BYTES and LIST.
- Added deterministic record/field sorting and duplicate rejection.
- Regenerated 23 valid vectors with exact field/record/basis bytes and SHA-256.
- Added V21 multi-field and V22/V23 multi-record order-invariance vectors.
- Added V24–V26 rejection vectors.
- Independently reproduced all valid vectors with Node.js and Python
  implementations.

## P1-02 ProfessionalReview Source

- Added full project/conversation/requirement/version/scenario columns to
  `ProfessionalReviewEvent`.
- Added six-column event FK to `ProfessionalReview`.
- Bound FieldValue professional-event source through that full key.
- Bound Snapshot source through FieldValue/sourceKind/sourceKey.
- Kept event-only current state; direct event mutation and cross-requirement
  references are forbidden.

## P1-03 Identity

- Selected CUID/Text identity, not native UUID.
- Defined namespaced text sourceKey formats.
- Preserved existing CUID foreign keys and removed implicit cast paths.
- Defined expand/backfill/validate/quarantine migration and rollback limits.
- Added identity collision, source prefix and legacy quarantine tests.

## P2

- P2-01: added explicit typed SQL column catalogue, precision, bounds and unit
  policy.
- P2-02: added multi-record/multi-field vectors.
- P2-03: added legacy/source quarantine and no silent SYSTEM_DERIVED mapping.
- P2-04: added event transition owner, fixed search_path, grant/revoke,
  policy-authoring and direct-SQL denial requirements.

## Preserved

R2/R3/C2 approved semantic, conversation/project, rule, catalog evidence,
technical/commercial/trust/professional, sales and P1-3-isolation directions
are retained unless this document explicitly replaces a failed C2 detail.

## Non-Changes

```text
Source: NOT MODIFIED
Tests: NOT MODIFIED
Prisma Schema: NOT MODIFIED
Migration: NOT MODIFIED
Config/Lockfile: NOT MODIFIED
Database/Storage: NOT ACCESSED
Build/Worker/Native RPC/Runtime: NOT USED
Git writes: NONE
$null: NOT READ/HASHED/MODIFIED
```

## Remaining

All historical and C3 Open Decisions remain pending. Independent R3-C3 review
and any implementation authorization are outside this task.
