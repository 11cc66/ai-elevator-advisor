# P1 Product Remediation R2 Changelog

## Status

```text
R1: PRESERVED / NOT MODIFIED
R2: NEW DESIGN DELIVERABLE
R2 DESIGN STATUS: COMPLETE WITH OPEN BLOCKERS
IMPLEMENTATION: NOT AUTHORIZED
```

## Chapter Changes

### R1 §4.1–4.2: semantic protocol

Revised in R2 §4:

- added conditional, exception, possibility, uncertainty, time and modality;
- added clause span and source evidence;
- specified deterministic precedence;
- added all six review expressions;
- separated model confidence from fact confirmation;
- added tests `SEM-01`–`SEM-16`.

Reason: `REV-P1-01`.

### R1 §4.3–4.5: conversation and CAS

Revised in R2 §5 and §10:

- dedicated conversation pointer and project head remain;
- requirement versions always belong to a conversation;
- added normalized assertion/value records;
- added idempotent interaction coroutine;
- added atomic conversation creation;
- added response replay record;
- added field projection/digest.

Reason: `REV-P1-02`, `REV-P1-03`, `REV-P2-06`, `REV-P2-07`.

### R1 §4.4 and §7.3: scenario constraints

Revised in R2 §6:

- authoritative `Project.installationScenario`;
- composite unique keys include scenario;
- Conversation and Requirement are linked by scenario;
- legacy ProjectType remains compatibility-mapped and read-only in product flow.

Reason: `REV-P1-02`.

### R1 §5.2–5.3: source and review

Revised in R2 §7:

- Source and SourceRevision split;
- content digest mandatory for reviewable source revision;
- typed exact revision FKs instead of polymorphic IDs;
- review evidence joins to exact source revisions;
- source withdrawal is append-only;
- old review cannot cover new revision;
- review validity is explicitly invalidated.

Reason: `REV-P1-05`, `REV-P2-05`.

### R1 §5.4–5.8: directory lifecycle

Revised in R2 §7:

- product metadata and technical/price revisions are immutable;
- state transitions are controlled and audited;
- no direct VERIFIED edit;
- exact version/evidence binding;
- formal resolver selects one approved effective basis or fails closed.

Reason: `REV-P1-05`, `REV-P1-07`.

### R1 §6.1–6.7: selection states

Revised in R2 §8:

- technical, commercial, trust, professional-review and overall statuses are
  independent;
- `REQUIRES_PROFESSIONAL_REVIEW` is a distinct run outcome;
- expired price produces `REQUIRES_QUOTE`, not Operational;
- no approved rule produces professional-review status;
- every candidate remains present;
- rule-set approval remains versioned and fail-closed.

Reason: `REV-P1-04`, `REV-P1-07`.

### R1 §7.2 and §9.4: sales snapshot

Revised in R2 §9:

- self-contained canonical payload;
- normalized snapshot item and item-source rows;
- exact revision FKs;
- copied source/review/price/technical evidence;
- canonical JSON/hash rules;
- current-versus-snapshot basis diff;
- append-only DB constraints.

Reason: `REV-P1-06`, `REV-P2-08`, `REV-P2-09`.

### R1 §8: same-origin and sales queries

Revised in R2 §11–12:

- shared mutation guard;
- route inventory and content-type policy;
- SQL scope before joins/limits/counts;
- unauthorized details do not leak existence.

Reason: `REV-P2-02`, `REV-P2-03`.

### R1 §11: migration

Revised in R2 §16:

- expand/backfill/validate sequencing;
- explicit ambiguity quarantine;
- no guessing legacy VERIFIED or handoff data;
- no deletion/rename in first remediation.

Reason: `REV-P2-01`, `REV-P1-05`, `REV-P2-08`.

### R1 §12–16: errors, stages, authorization

Revised in R2 §17–19:

- status-specific error outcomes;
- future authorization split into low-risk, decision-blocked, high-risk and
  separate P1-3 workstream.

Reason: independent-review authorization matrix and P2 findings.

## Preserved Design

The following R1 directions were retained:

- conversation-specific state;
- explicit project head;
- server-derived scenario;
- no floor-derived hard authority;
- no approved rule -> no Operational;
- immutable Demo classification;
- formal query excludes Demo;
- independent spec/price versioning;
- all-candidate explanations;
- SQL-scoped sales query;
- P1-3 isolation.

## New Database/Invariant Concepts

- `Project.installationScenario` canonical key.
- Scenario-bearing composite foreign keys.
- `RequirementFieldAssertion` and normalized `RequirementFieldValue`.
- `AdvisorInteractionRequest` idempotency record.
- `CatalogSourceRevision`, typed `CatalogReview`,
  `CatalogReviewEvidence`, withdrawal events.
- Technical/commercial/trust/professional/overall assessment dimensions.
- `SelectionProfessionalReview`.
- `SalesHandoffSnapshotItem` and `SalesHandoffSnapshotItemSource`.
- Canonical RFC 8785/SHA-256 snapshot payload.
- Read-time stale-basis overlay.

## External Systems Not Changed

```text
Source code: NOT MODIFIED
Tests: NOT MODIFIED
Prisma Schema: NOT MODIFIED
Migration: NOT MODIFIED
Environment files: NOT READ
Database: NOT CONNECTED
Storage: NOT ACCESSED
Native RPC: NOT USED
PFR / Registry: NOT ACCESSED
Git writes: NONE
```

## Remaining Open Items

- engineering rules and professional authority;
- source/review roles and evidence policy;
- price semantics;
- Project Type change policy;
- project current requirement policy;
- conversation/sales visibility;
- snapshot retention and canonicalization approval;
- Demo startup identity;
- active-version ambiguity policy;
- legacy data disposition;
- professional review workflow;
- sales assignment scope;
- formal rollout policy.

These are listed in `P1_PRODUCT_REMEDIATION_OPEN_DECISIONS_R2.md`.

