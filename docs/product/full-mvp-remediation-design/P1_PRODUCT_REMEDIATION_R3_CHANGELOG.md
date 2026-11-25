# P1 Product Remediation R3 Changelog

## Status

```text
R1: PRESERVED / NOT MODIFIED
R2: PRESERVED / NOT MODIFIED
R3 DESIGN: COMPLETE WITH OPEN BLOCKERS
SOURCE IMPLEMENTATION: NOT AUTHORIZED
DATABASE MIGRATION: NOT AUTHORIZED
RUNTIME: NOT VERIFIED
```

## R2 Finding Corrections

### Requirement lineage — `REV-R2-P1-01`

R3 replaces the loose requirement/value source references with a complete
Project → Conversation → Requirement → RequirementVersion → Assertion/Value →
Message chain.

Changes:

- stable `Requirement` identity and immutable `RequirementVersion`;
- composite FK from RequirementVersion to its Requirement;
- composite FK from FieldValue to its version and exact Assertion;
- composite FK from a customer-message Assertion to Message and Conversation;
- NOT NULL/CHECK rules for message-source assertions;
- correction creates a new version and preserves old assertions/messages.

This closes the database design gap, not the implementation finding.

### Catalog evidence — `REV-R2-P1-02`

R3 rejects locator-plus-digest as sufficient evidence.

Changes:

- independent immutable `CatalogEvidenceArchive` capability;
- content-addressed evidence object with byte length, content digest, MIME,
  capture time and archive identity;
- immutable `CatalogSourceRevision` bound to the exact evidence object;
- append-only verification events with `MATCH`, `MISMATCH`, `MISSING` and
  `INACCESSIBLE`;
- catalog review binds exact source revisions and matching verification events;
- unavailable or mismatched evidence can never remain formally trusted;
- no P1-3 Intent/Attempt/Lifecycle/FileVersion dependency.

The archive product, retention and legal basis remain Open Decisions.

### Sales ownership chain — `REV-R2-P1-03`

R3 makes the sales handoff chain exact:

```text
SalesHandoffCase
  -> Project
  -> Requirement
  -> RequirementVersion
  -> SelectionRun
  -> SalesHandoffSnapshot
```

Changes:

- Case has an exact `(id, projectId)` key;
- Snapshot binds case/project together;
- Snapshot binds the exact RequirementVersion;
- Snapshot binds the exact SelectionRun containing project, conversation,
  requirement, version, scenario and rule-set revision;
- selection candidates use exact product/specification/price revision keys;
- deferred validation rejects any cross-owner recombination.

### Professional review — `REV-R2-P1-04`

R3 replaces status words with persistent review records and event history.

Changes:

- immutable professional-review policy revisions;
- exact candidate/run/requirement/rule/policy basis;
- typed source and price basis rows;
- append-only `ProfessionalReviewEvent`;
- unique event sequence and state version;
- row lock plus CAS transition function;
- explicit states for submission, review, approval, rejection, return,
  withdrawal, invalidation and expiry;
- approval cannot move to a different candidate, requirement, source set or
  policy revision;
- formal resolver requires exact approved review and current basis.

Role names and qualifications remain Open Decisions.

### Snapshot authority — `REV-R2-P1-05`

R3 chooses Option A: normalized snapshot detail is the sole authority.

Changes:

- removes writable `canonicalPayload` from the authoritative model;
- snapshots contain normalized requirement fields, candidates, parameters,
  prices, sources, catalog reviews and professional-review events;
- copied values/statuses are checked against exact immutable revisions;
- payload is reconstructed read-only using a versioned serializer and RFC 8785
  JCS;
- a database-defined normalized basis digest is recomputable from rows;
- direct SQL cannot create a second payload truth;
- deferred triggers verify candidate completeness, copy equality and basis
  digest at COMMIT.

The final export/canonicalization format still needs security/architecture
approval, but no separate writable payload is allowed.

## Five R2 P2 Corrections

### `REV-R2-P2-01` Project Scenario

Added:

- NOT NULL final state and deterministic legacy mapping;
- expand/backfill/validate sequence;
- quarantine for unmappable data;
- immutable-after-conversation trigger;
- same Project row lock for scenario update and conversation creation;
- `ON UPDATE RESTRICT` for historical scenario keys.

### `REV-R2-P2-02` Rule Set

Added immutable rule-set and rule revisions, approval status, content digest,
effective range, authority source and exact SelectionRun FK. A display string
is no longer sufficient.

### `REV-R2-P2-03` Advisor Idempotency

Added exact project/conversation/actor/message/version FKs and explicit
transaction semantics:

- success records commit with the business result;
- deterministic replayable failure uses a separate failure-recording
  transaction with no business mutation;
- unexpected errors roll back completely;
- commit-unknown re-reads the durable key;
- same key/different payload is rejected;
- replay cannot cross conversation or actor.

### `REV-R2-P2-04` Review Policy

Added immutable `CatalogReviewPolicyRevision` and
`ProfessionalReviewPolicyRevision`, exact catalog/professional review/event
policy FKs, policy content digests and a safe no-carryover default until a
product/security decision approves compatibility.

### `REV-R2-P2-05` Test Coverage

Added direct DB and concurrency tests for:

- cross-requirement and cross-conversation source links;
- NULL composite bypasses;
- source replacement and archive unavailability;
- case/project/snapshot mismatch;
- exact requirement-version/run mismatch;
- payload/item/copy mismatch and forged basis digest;
- review event mutation, duplicate sequence and concurrent decisions;
- project scenario/conversation races;
- idempotency races and commit-unknown;
- snapshot/source withdrawal races;
- price expiry/evaluation races.

## Preserved R2 Design

R3 does not remove:

- six conditional/uncertain semantic outcomes;
- conversation and project current-requirement separation;
- server-derived scenario;
- no approved rule → no formal Operational;
- immutable DEMO classification;
- exact typed catalog review targets;
- independent technical/commercial/trust/professional/overall statuses;
- `REQUIRES_QUOTE` for invalid price;
- SQL-scoped sales filtering;
- requirement history and stale-basis overlay;
- route inventory and same-origin mutation policy;
- P1-3 isolation.

## External Systems and Worktree

```text
R1/R2 documents: NOT MODIFIED
Source: NOT MODIFIED
Tests: NOT MODIFIED
Prisma Schema: NOT MODIFIED
Migration: NOT MODIFIED
Configuration/Lockfile: NOT MODIFIED
Database: NOT CONNECTED
Storage: NOT ACCESSED
Native RPC/Runtime: NOT USED
ACL/Owner/Service/PFR: NOT MODIFIED
Git writes: NONE
$null: NOT READ/HASHED/MODIFIED
```

## Remaining Dependencies

- catalog evidence archive and retention;
- raw bytes versus canonical-text review basis;
- professional-review role separation, event retention and policy continuity;
- snapshot retention/export and final serialization approval;
- project-scenario legacy and change policy;
- rule-set roles;
- price and tax/region policy;
- project current requirement policy;
- conversation/sales visibility;
- Demo identity;
- effective-version ambiguity policy;
- legacy data disposition;
- formal rollout.

None is implicitly approved by R3.
