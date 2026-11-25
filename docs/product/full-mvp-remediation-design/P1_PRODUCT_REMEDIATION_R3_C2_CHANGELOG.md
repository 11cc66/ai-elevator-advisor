# P1 Product Remediation R3-C2 Changelog

## Status

```text
R1/R2/R3: PRESERVED / NOT MODIFIED
R3-C2 DESIGN: COMPLETE WITH OPEN BLOCKERS
SOURCE/Schema/Migration: NOT MODIFIED
DATABASE/Runtime: NOT VERIFIED
```

## P1 Corrections

### `REV-R3-P1-01` — exact RequirementVersion key

Added both exact keys:

```text
UNIQUE(id, requirementId, projectId, conversationId)
UNIQUE(id, requirementId, projectId, conversationId, installationScenario)
```

All Assertion, FieldValue and Confirmation FKs now include `installationScenario`
and use exact parent keys.

### `REV-R3-P1-02` — complete typed Assertion/FieldValue model

Added:

- `fieldKey`, value type and exactly-one typed column;
- boolean/integer/decimal/text/enum/UUID/timestamp/bytes columns;
- unit, condition, exception, polarity, semantic kind, temporal scope,
  modality, parser and confirmation fields;
- field status values and source-kind checks;
- server-owned author and confirmation actor FKs;
- read-only JSON compatibility projection from FieldValues.

The previous R3 key-only sketches are insufficient and are superseded by the
C2 model.

### `REV-R3-P1-03` — RuleSet event-only approval

Removed mutable RuleSet status as the authoritative state. Added:

- immutable RuleSetRevision content;
- RuleSetReviewPolicyRevision;
- append-only SelectionRuleSetReviewEvent;
- `selection_rule_set_current` latest-event view;
- controlled transition function, CAS, exact policy/source basis and
  append-only/least-privilege requirements.

### `REV-R3-P1-04` — ProfessionalReview event-only projection

Removed independently writable `ProfessionalReview.state/stateVersion` truth.
Added:

- immutable Review header and exact basis;
- append-only `ProfessionalReviewEvent`;
- latest-event current view;
- row lock, sequence/CAS, allowed-transition checks and exact policy/source
  rechecks;
- direct SQL event/state bypass tests.

### `REV-R3-P1-05` — complete R3-BASIS-1

Defined revision 2 of the binary protocol:

- fixed magic, version, payload type, header length, record count and body
  length;
- record length/type/rowId/stableKey/field count;
- field tag/type/presence/length;
- canonical scalar encodings for NULL, boolean, integer, decimal, text, enum,
  UUID, timestamp, bytes and list;
- NFC/UTF-8, numeric normalization, fixed ordering, duplicate rejection and
  invalid-input rejection;
- 23 valid fixed vectors with exact field/record/basis bytes and SHA-256;
- three explicit rejection cases.

The full vectors are in the R3-C2 test plan.

### `REV-R3-P1-06` — snapshot field source equality

Added non-null `sourceKey` to FieldValue and snapshot field. USER_ASSERTION
requires `sourceKey = sourceAssertionId`; other source kinds use explicit typed
source relations. Snapshot field FK includes:

```text
fieldValueId, requirementVersionId, requirementId, projectId,
conversationId, installationScenario, sourceKind, sourceKey
```

This prevents a second valid assertion in the same requirement from becoming
the apparent source of an authoritative value.

## P2-A through P2-E

- P2-A `REV-R2-P2-01`: scenario expand/backfill/NOT NULL/freeze/row-lock
  design preserved; legacy rows get a mapping/quarantine table.
- P2-B `REV-R2-P2-02`: exact RuleSetRevision binding retained and RuleSet
  status now event-only.
- P2-C `REV-R2-P2-03`: idempotency conversation/actor/message/version relations
  and success/failure/COMMIT-unknown semantics retained.
- P2-D `REV-R2-P2-04`: exact Catalog/Professional policy revisions retained;
  event policy is checked on every transition.
- P2-E `REV-R2-P2-05`: direct DB negative, concurrent, source and vector tests
  added.

## R3 P2 Findings

- actor/author identity: `authorUserId`, User FKs, server-derived actor rules;
- legacy migration: `LegacyRequirementMapping` and quarantine path;
- Catalog/RuleSet append-only: event-only RuleSet and review transition
  requirements;
- missing tests: R3-C2 test plan covers the direct-write and vector gaps.

## Preserved

The R2/R3-approved conditional semantics, conversation/project separation,
scenario direction, no-approved-rule → no Operational, DEMO immutability,
technical/commercial/trust/professional separation, sales main ownership chain,
catalog evidence direction, SQL-scoped sales filtering, history immutability and
P1-3 isolation are retained.

## Explicit Non-Changes

```text
R1 source/docs: NOT MODIFIED
R2 source/docs: NOT MODIFIED
R3 source/docs: NOT MODIFIED
Application source: NOT MODIFIED
Tests: NOT MODIFIED
Prisma Schema: NOT MODIFIED
Migration: NOT MODIFIED
Configuration/Lockfile: NOT MODIFIED
Database: NOT CONNECTED
Storage: NOT ACCESSED
Native RPC/Build/Runtime: NOT USED
Git writes: NONE
$null: NOT READ/HASHED/MODIFIED
```

## Remaining Dependencies

All `OD-R2-01`–`OD-R2-20`, `OD-R3-01`–`OD-R3-09`, and
`OD-R3-C2-01`–`OD-R3-C2-04` remain open. A future independent R3-C2 review is
required before any implementation authorization.
