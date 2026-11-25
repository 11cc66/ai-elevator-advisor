# P1 Product Remediation Open Decisions R3

Status:

```text
OPEN DECISIONS RETAINED
NO PRODUCT, ENGINEERING, LEGAL OR SECURITY DECISION IS APPROVED HERE
```

R3 does not close business, engineering, auditor-qualification, retention or
legal decisions. A decision may permit future work; it does not authorize
source, Schema, Migration, database, Runtime or deployment activity.

## 1. New R3 Decision Set

### OD-R3-01 — Catalog source evidence archive and retention

- Question: Which immutable evidence archive stores reviewed catalog source
  bytes, under what encryption, identity, availability and retention policy?
- Owner: security, legal, platform and catalog operations.
- Candidate choices:
  1. approved content-addressed object archive owned by the catalog domain;
  2. bounded PostgreSQL `bytea` for small sources plus an archive for large
     sources;
  3. externally signed immutable evidence artifact with independent retrieval.
- Risks: a digest-only option cannot prove content; external archive loss can
  invalidate future audits; unbounded DB bytes can exhaust the primary database.
- Blocked modules: source capture, catalog review, formal recommendation.
- Can proceed: archive interface, digest fixtures, immutability tests.
- Must be decided before schema/migration: yes for evidence/archive columns.
- Related: `OD-R2-04`, `OD-R2-18`.

### OD-R3-02 — Raw bytes versus canonical text as review basis

- Question: Is the authoritative reviewed source the exact raw bytes, the
  canonical extracted text, or both under an explicit dual-basis rule?
- Owner: technical, legal and catalog evidence owners.
- Candidate choices:
  1. raw bytes authoritative; canonical text only a derived index;
  2. canonical text authoritative with raw evidence retained;
  3. both must match and both participate in the review basis digest.
- Risks: text-only can lose layout/figures; raw-only complicates review; dual
  basis needs a deterministic relationship.
- Blocked modules: catalog review and evidence verification.
- Can proceed: immutable evidence object model and hash fixtures.
- Must be decided before schema/migration: yes for review-basis columns and
  validation contract.
- Related: `OD-R2-04`, `OD-R2-14`.

### OD-R3-03 — Professional-review event retention and resubmission

- Question: How long are professional-review attempts, returned decisions,
  evidence and event histories retained, and when must a terminal review create
  a new review instance?
- Owner: technical authority, security and legal.
- Candidate choices:
  1. retain all review/event history indefinitely;
  2. retain with legal hold and approved disposition;
  3. retain only approved/current review plus append-only destroyed-event
     metadata, if legally permitted.
- Risks: deleting history destroys auditability; indefinite retention may
  conflict with data policy.
- Blocked modules: professional-review UI/API and formal Operational.
- Can proceed: event schema, append-only tests, retention abstraction.
- Must be decided before schema/migration: yes for retention/deletion privileges;
  append-only default can be developed first.
- Related: `OD-R2-16`.

### OD-R3-04 — Review policy change continuity

- Question: Does an approval created under policy revision P1 remain valid
  after P2 becomes effective, and if so under what compatibility rule?
- Owner: technical authority, security and product.
- Candidate choices:
  1. no automatic carryover; new review required;
  2. carry over only when P2 explicitly declares P1-compatible;
  3. continue until a stated expiry or evidence change.
- Risks: carryover can preserve stale authority; no carryover disrupts active
  reviews.
- Blocked modules: formal review resolver and `OPERATIONAL`.
- Can proceed: immutable policy/event schema and denial tests.
- Must be decided before formal selection: yes; safe default is no carryover
  until explicitly approved.
- Related: `OD-R2-16`.

### OD-R3-05 — Snapshot export, deletion and retention

- Question: What snapshot views may be exported, to which roles, and how are
  immutable snapshots retained or lawfully deleted?
- Owner: business, legal, security and sales operations.
- Candidate choices:
  1. immutable append-only with no deletion;
  2. retention period plus legal hold;
  3. role-specific redaction/export views.
- Risks: immutable history conflicts with deletion requests; redaction can hide
  evidence required for audit.
- Blocked modules: sales snapshot UI/export, purge/deletion and retention jobs.
- Can proceed: normalized append-only snapshot and reconstruction test fixtures.
- Must be decided before deletion/export implementation: yes; not necessarily
  before append-only schema.
- Related: `OD-R2-09`, `OD-R2-14`, `OD-R2-19`.

### OD-R3-06 — Unmappable historical project scenario

- Question: What happens to legacy projects, conversations or requirements
  whose historical scenario cannot be mapped without guessing?
- Owner: product, data owner and security.
- Candidate choices:
  1. quarantine read-only and require explicit repair;
  2. create a new project with an approved scenario;
  3. retain legacy-only records without formal selection.
- Risks: guessed mappings create false engineering context; quarantine blocks
  old demos.
- Blocked modules: legacy backfill, new conversation creation for affected
  projects and formal selection.
- Can proceed: preflight detector and immutable quarantine record.
- Must be decided before backfill: yes.
- Related: `OD-R2-06`, `OD-R2-12`, `OD-R2-15`.

### OD-R3-07 — Rule-set creator and approver authority

- Question: Which authorized roles may create, review, approve, retire and
  emergency-disable each rule-set revision?
- Owner: technical authority and security.
- Candidate choices:
  1. separate creator and approver;
  2. technical lead plus security review;
  3. emergency retire by technical authority with retroactive audit.
- Risks: self-approval makes rules de facto unapproved; restrictive approval
  slows safe rule changes.
- Blocked modules: rule-set approval and formal Operational.
- Can proceed: immutable rule-set/rule revision tables and denial tests.
- Must be decided before rule data: yes.
- Related: `OD-R2-01`, `OD-R2-03`, `OD-R2-13`.

### OD-R3-08 — Persisted advisor failure and replay visibility

- Question: Which deterministic business failures are stored as replayable
  `FAILED` responses, and what retention/redaction applies to customer retries?
- Owner: product, support and security.
- Candidate choices:
  1. store only safe typed failure codes and response digests;
  2. store full failure response for exact replay;
  3. do not persist failures and always re-evaluate.
- Risks: re-evaluating can change the response; retaining full errors can leak
  internal detail.
- Blocked modules: advisor failure response retention and UI replay.
- Can proceed: success idempotency, transaction rollback and commit-unknown
  tests.
- Must be decided before exposing failure replay: yes; does not alter the
  requirement that unexpected rollback leaves no fake committed row.
- Related: `REV-R2-P2-03`.

### OD-R3-09 — Evidence unavailable or lost

- Question: When an immutable archive object is missing, inaccessible or its
  digest no longer matches, does the source become invalidated, quarantined, or
  subject to a replacement evidence process?
- Owner: legal, security and catalog authority.
- Candidate choices:
  1. immediate invalidation and formal exclusion;
  2. quarantine pending independent recovery;
  3. replacement evidence with a new review and explicit history link.
- Risks: recovery without a bound evidence trail can launder content; immediate
  invalidation may block operations during storage incidents.
- Blocked modules: formal catalog trust and any evidence-recovery workflow.
- Can proceed: negative verification states and fail-closed resolver tests.
- Must be decided before recovery/restore behavior: yes.
- Related: `OD-R2-04`, `OD-R2-18`.

## 2. Retained R2 Decisions

| R2 decision | R3 disposition | Main blocked area |
|---|---|---|
| `OD-R2-01` authoritative engineering rules | retained; see `OD-R3-07` for role mechanics | formal rules and Operational |
| `OD-R2-02` professional data/review authority | retained; see `OD-R3-03/04` | professional workflow, approval |
| `OD-R2-03` VERIFIED approval roles/evidence | retained; evidence mechanics are R3 technical design | catalog approval |
| `OD-R2-04` source content/review expiry | retained and split into `OD-R3-01/02/09` | source/model formal eligibility |
| `OD-R2-05` price semantics | retained | commercial status and quote |
| `OD-R2-06` Project Type changes | retained; historical cases mapped to `OD-R3-06` | project update and backfill |
| `OD-R2-07` project current requirement | retained | project head defaults |
| `OD-R2-08` conversation sharing/sales visibility | retained | APIs, raw history, sales |
| `OD-R2-09` snapshot retention/visibility | retained; see `OD-R3-05` | snapshot export/deletion |
| `OD-R2-10` Demo environment identity | retained | Demo startup/catalog |
| `OD-R2-11` effective-version ambiguity | retained | formal resolver policy |
| `OD-R2-12` legacy data disposition | retained; see `OD-R3-06` | migration/backfill |
| `OD-R2-13` rule-set approval separation | retained; see `OD-R3-07` | formal Operational |
| `OD-R2-14` snapshot canonicalization/hash | retained; normalized authority is technical R3 policy, final JCS/export format remains open | snapshot rendering/export |
| `OD-R2-15` historical JSON/field mismatch | retained | requirement backfill |
| `OD-R2-16` professional workflow | retained; see `OD-R3-03/04` | professional review and Operational |
| `OD-R2-17` sales assignment identity/scope | retained | sales assignment/list |
| `OD-R2-18` source review cadence | retained; see `OD-R3-01/09` | source trust expiry |
| `OD-R2-19` preliminary result visibility | retained | customer/sales presentation |
| `OD-R2-20` formal rollout policy | retained | production/Operational |

## 3. Decisions That Cannot Be Deferred as "Technical Open"

These are not product choices and must be designed before approval:

- composite ownership FKs;
- Requirement Message/Assertion/Value binding;
- review-to-exact-revision binding;
- append-only ProfessionalReview events and CAS;
- exact Case/Project/RequirementVersion/SelectionRun snapshot chain;
- normalized snapshot authority and database copy validation;
- idempotency exact conversation binding and rollback semantics.

A product decision may select source retention, policy continuity or roles,
but cannot excuse a missing key, nullable bypass, mutable audit event or
current-object substitution.

## 4. Decision Gate

```text
Business/engineering/security values declared in this file: UNRESOLVED
Technical ownership invariants in R3 main design: DESIGNED
Independent review approval: PENDING
Implementation authorization: NONE
```
