# P1 Product Remediation Design R2

Task:

```text
FULL-MVP-REMEDIATION-DESIGN-R2
```

Date: 2026-11-23

Status:

```text
R2 DESIGN COMPLETE WITH OPEN BLOCKERS
```

R2 supersedes R1 for future implementation planning but does not modify or
close R1. The R2 design is ready for a new independent review. It does not
authorize source, Schema, Migration, database, Runtime or deployment changes.

## 1. Input and Baseline

### 1.1 Verified PowerShell

```text
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe
```

Direct child verification:

```text
Parent PID: 25744
Child PID: 17272
Child Parent PID: 25744
External FileVersion: 7.6.9.500
Internal PSVersion: 7.6.9
PSEdition: Core
Exit code: 0
```

### 1.2 Worktree

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 41
Untracked entries: 71
Staged: 0
Deleted: 0
```

The exact path list is recorded in `P1_PRODUCT_REMEDIATION_BASELINE_SNAPSHOT.md`.
No R1 or independent-review file may be modified by R2.

### 1.3 Reviewer findings to close

R2 addresses:

```text
7 P1 findings
10 P2 findings
1 P3 finding
```

The independent review remains the finding authority. R2 status only means
that a design correction has been written; it does not mean the issue is
implemented or accepted.

### 1.4 Verified input manifests

```text
R1 design manifest:
AB146C592DE41479994C88FABD811610D9ADFF90F46267F844F74409F3E70485

Independent review manifest:
EA593A3CADD38BC4B1E2C08E874E32A60E4C34550D20B41C79DA80D585D8C458

MVP build manifest:
4C48F50E387596D9464BF6EE0C2C1EAAD91E808C7C1C2D57302EE86143471077

Product review manifest:
CBC6240FA37E2533D8B185104B738DF1064F5FBD632814A0C33757FBCC7D1AC9
```

Every manifest entry matched its recorded byte length, line count and SHA-256
where the manifest contains those fields.

## 2. Preserved R1 Decisions

The following previously accepted directions remain unchanged:

1. Conversation requirement state and project requirement pointer are separate.
2. Scenario is server-derived and is never trusted from the normal client.
3. Floor count is not sufficient authority for capacity or speed hard filters.
4. Formal Operational evaluation is disabled without an approved rule set.
5. DEMO classification is immutable and formal queries exclude Demo data.
6. Product specification and price are independently versioned.
7. Every evaluated candidate retains reasons, missing data and check outcomes.
8. Sales query authorization is applied before joins, limits or counts.
9. P1-3 upload/lifecycle work remains a separate security workstream.

## 3. Target Architecture

```text
Project
  installationScenario = canonical project scenario
       |
       +-- AdvisorConversation(installationScenario)
               |
               +-- RequirementVersion(installationScenario)
                       |
                       +-- FieldAssertions / ResolvedFieldValues
                       +-- Professional engineering evidence
                       +-- SelectionRun
                               |
                               +-- Candidate technical/commercial/trust/review dimensions
                               +-- ProfessionalReview workflow

Immutable catalog evidence
  SourceRevision <- ReviewEvidence <- exact typed CatalogReview
  ProductRevision -> SpecificationRevision
                  -> PriceRevision

Immutable sales snapshot
  Requirement snapshot
  Selection and rule snapshot
  Candidate/item snapshot
  Source/review/parameter/price snapshot
  Canonical payload digest
```

The database owns identity, version and ownership-chain invariants. Services
own authorization, semantic parsing and workflow orchestration. The model
must not be inferred from a successful call alone.

## 4. Semantic Requirement Model

### 4.1 Parsed assertion

Introduce a structured assertion:

```text
RequirementAssertion
  messageId
  clauseIndex
  fieldKey
  targetText
  value?:
    boolean | number | string
  polarity:
    AFFIRM | NEGATE | UNKNOWN
  semanticKind:
    EXPLICIT_FACT
    EXPLICIT_CORRECTION
    CONDITIONAL
    EXCEPTION
    POSSIBILITY
    UNCERTAIN
    CONFLICT
  condition?:
    sourceText
    conditionKey?
    conditionState:
      UNRESOLVED | SATISFIED | FAILED | UNKNOWN
  timeScope?:
    PAST | CURRENT | FUTURE | UNKNOWN
  modality?:
    REQUIRED | PREFERRED | OPTIONAL | PROHIBITED | UNKNOWN
  sourceSpan:
    start
    end
  sourceText
  parserRuleId
  parserVersion
  confirmationState:
    AUTO_ACCEPTABLE
    NEEDS_CONFIRMATION
    CONFIRMED
    REJECTED
```

`confidence` may be stored as parser metadata, but it never determines whether
an assertion is true or professionally confirmed.

### 4.2 Deterministic precedence

Parser order:

1. Unicode NFKC and full-width normalization.
2. Sentence and clause segmentation with source offsets retained.
3. Negation tokens first: `不允许`, `不可以`, `不可行`, `不得`, `禁止`, `不行`.
4. Conditional/exception tokens: `如果`, `若`, `除非`, `只有`, `前提是`.
5. Uncertainty tokens: `不确定`, `可能`, `考虑`, `需要再确认`.
6. Temporal/correction tokens: `原来`, `现在`, `改成`, `更正`, `之前`, `后来`.
7. Positive assertions.
8. Field-target association within the same clause, with an explicit maximum
   span and clause-boundary rule.

No positive substring is accepted if it lies inside a recognized negative,
conditional or exception span.

### 4.3 Required semantic outcomes

| Input | Outcome | Field effect | Confirmation |
|---|---|---|---|
| `外装允许，但不能从临街侧施工。` | `CONDITIONAL` | no unconditional value; retain restriction | `NEEDS_CONFIRMATION` |
| `不是不允许外装，只是需要再确认。` | `UNCERTAIN` | no value | `NEEDS_CONFIRMATION` |
| `原来可以外装，现在明确不允许了。` | `EXPLICIT_CORRECTION` | false for current version; old true invalidated | can be proposed with correction evidence, still visible for customer confirmation |
| `如果物业不反对，可以考虑外装。` | `CONDITIONAL` | no value until condition resolves | `NEEDS_CONFIRMATION` |
| `不排除外装，但不能确定。` | `UNCERTAIN` | no value | `NEEDS_CONFIRMATION` |
| `外装不行，除非没有其他方案。` | `EXCEPTION` | no unconditional value | `NEEDS_CONFIRMATION` |

Additional mandatory behavior:

- `我说的是不允许外装，不是允许。` is a clarification/negation pattern and
  must not be automatically converted without either a stable explicit
  correction context or customer confirmation.
- A condition never becomes true because a model predicts it.
- Multiple unresolved conditions on one field produce `NEEDS_CONFIRMATION`.
- If the customer explicitly confirms a condition as satisfied in a later
  message, the resulting value is a new version with that fact and source.

### 4.4 Parser, model and fact boundary

- Deterministic parser: normalization, spans, negation, conditions, polarity,
  conflicts and parser rule version.
- Model: interpretation suggestions that must use the same assertion schema.
- Deterministic rule layer: rejects malformed, ambiguous or conflicting output.
- Customer: can confirm ordinary statements or choose the correct clarification.
- Professional confirmation: separate role and evidence type; never derived
  from a model score.
- Raw source text and message ID are immutable evidence.

## 5. Requirement Identity and Single Source of Truth

### 5.1 Canonical source

The canonical requirement facts are normalized `RequirementFieldAssertion` and
`RequirementFieldValue` rows. `BuildingRequirement.fields` is a compatibility
projection and never the selection source.

### 5.2 Data model

`BuildingRequirement` remains an immutable version row:

```text
id
projectId
conversationId NOT NULL for new data
installationScenario
version
status
fieldStateDigest
legacyProjection?
createdById
createdAt
```

`RequirementFieldAssertion`:

```text
id
requirementId
fieldKey
candidateSequence
semanticKind
polarity
valueJson?
unit?
conditionJson?
conditionState
timeScope
modality
sourceType
sourceMessageId?
sourceSpanStart?
sourceSpanEnd?
sourceTextSnapshot
parserRuleId
parserVersion
confirmationState
confirmationBy?
confirmationAt?
supersedesAssertionId?
```

`RequirementFieldValue`:

```text
id
requirementId
fieldKey
canonicalValueJson
valueType
unit
fieldStatus
sourceType
sourceAssertionId
requiresProfessionalReview
UNIQUE(requirementId, fieldKey)
```

`RequirementConflict`:

```text
id
requirementId
fieldKey
status OPEN | RESOLVED
candidatesJson
resolutionNote
resolvedBy
resolvedAt
```

`AdvisorConversation` adds:

```text
installationScenario NOT NULL
currentRequirementId String?
closedAt?
closedById?
```

`ProjectRequirementHead`:

```text
projectId PK
requirementId UNIQUE
conversationId
requirementVersion
selectedByUserId
selectedAt
```

### 5.3 Write and read paths

Write:

1. Parse assertions outside or inside the deterministic Mock transaction.
2. Resolve only explicit facts.
3. Insert requirement version header.
4. Insert assertions, conflicts and resolved field values.
5. Compute sorted canonical projection and digest server-side.
6. Update conversation pointer and optional project head.
7. Commit atomically.

Read:

- Conversation API reads its `currentRequirementId`.
- Requirement history endpoint reads all version rows for that conversation.
- Selection service reads `RequirementFieldValue`, never
  `BuildingRequirement.fields`.
- UI compatibility response may materialize JSON from field values.
- Audit endpoint reads assertion source spans and confirmation records.

`RequirementRevision` becomes an immutable revision event referencing the
requirement version and field-state digest. Its old JSON fields remain legacy
until a later contract migration.

### 5.4 Consistency enforcement

The write service must reject a version whose field rows and compatibility
projection digest do not match. A forward migration/trigger may prohibit direct
updates to the projection and field rows outside the controlled write function.
Until field tables are fully populated, legacy JSON rows remain read-only and
cannot be silently mapped.

## 6. Scenario Consistency and Project Type

### 6.1 One scenario authority

`Project.installationScenario` is the authoritative project scenario.
`Project.projectType` remains as a legacy compatibility field for one migration
cycle and is constrained to a deterministic mapping:

```text
OLD_BUILDING_ELEVATOR -> OLD_BUILDING_ADDITION
OLD_BUILDING_ADDITION -> OLD_BUILDING_ADDITION
EXISTING_ELEVATOR_RENOVATION -> EXISTING_ELEVATOR_RENOVATION
NEW_BUILDING_INSTALLATION -> NEW_BUILDING_INSTALLATION
```

New product code reads only `installationScenario`.

### 6.2 Relational invariants

Required keys and FKs:

```text
Project:
  UNIQUE(id, installationScenario)

AdvisorConversation:
  UNIQUE(id, projectId, installationScenario)
  FK(projectId, installationScenario)
    -> Project(id, installationScenario)

BuildingRequirement:
  UNIQUE(id, projectId, conversationId, installationScenario)
  UNIQUE(projectId, id)
  FK(conversationId, projectId, installationScenario)
    -> AdvisorConversation(id, projectId, installationScenario)

AdvisorConversation.currentRequirement:
  FK(currentRequirementId, projectId, id, installationScenario)
    -> BuildingRequirement(id, projectId, conversationId, installationScenario)

SelectionRun:
  UNIQUE(id, projectId)
  FK(requirementId, projectId)
    -> BuildingRequirement(id, projectId)

ProjectRequirementHead:
  UNIQUE(projectId)
  FK(projectId, requirementId)
    -> BuildingRequirement(projectId, id)

SalesHandoffSnapshot:
  FK(requirementId, projectId)
    -> BuildingRequirement(id, projectId)
  FK(selectionRunId, projectId)
    -> SelectionRun(id, projectId)
```

This makes cross-project and cross-scenario combinations impossible at the
database layer. `SelectionRun` does not need a duplicate scenario column; its
scenario is derived from the exact requirement. A handoff snapshot may copy the
scenario into its immutable payload, but the source relationship remains bound
to the exact requirement.

### 6.3 Project Type changes

Safe default:

- allowed only before any conversation exists;
- updates require `project.manage`;
- old and new scenario are audited;
- once any conversation or requirement exists, scenario is immutable;
- a requested later change creates a new project or separate approved
  migration/change workflow.

The final policy is OD-R2-06. The DB should implement the safe default until a
different product decision is approved.

## 7. Catalog Source, Revision and Review

### 7.1 Source and SourceRevision

Separate stable source identity from immutable content:

```text
CatalogSource
  id
  originType
  dataClassification
  createdBy
  createdAt

CatalogSourceRevision
  id
  sourceId
  revision
  title
  issuer
  locator
  contentDigest CHAR(64) NOT NULL
  collectedAt
  validFrom
  validTo?
  contentSchemaVersion
  createdBy
  createdAt
  UNIQUE(sourceId, revision)
```

For formal review, `contentDigest` is mandatory. Recollection creates a new
revision; it never edits an approved source revision. Withdrawal is an
append-only `CatalogSourceWithdrawal` record referencing the source revision,
actor, time, reason and replacement revision if any.

### 7.2 Typed catalog revisions

`ProductRevision`, `SpecificationRevision` and `PriceRevision` are immutable.
Each has its own `revision` number, owner product identity, lifecycle event
history, exact source revision references and canonical content digest.

Manufacturer and brand also use revisioned state or append-only lifecycle
events for name, active/suspended status, source revision and approval.

### 7.3 Exact review binding

Replace polymorphic subject IDs with a typed review:

```text
CatalogReview
  id
  reviewType
  manufacturerRevisionId?
  brandRevisionId?
  productRevisionId?
  specificationRevisionId?
  priceRevisionId?
  sourceRevisionId?
  decision APPROVE | REJECT | REVOKE
  reviewerUserId
  reviewerRoleSnapshot
  reviewedAt
  reason
  inputDigest
  CHECK exactly one target FK is non-null
  CHECK reviewType matches target FK
```

`CatalogReviewEvidence`:

```text
reviewId
sourceRevisionId
UNIQUE(reviewId, sourceRevisionId)
```

`inputDigest` is computed from the exact target revision's canonical digest,
sorted evidence source revision IDs/digests, review type and policy version.
No review can be applied to a later revision or a changed source.

### 7.4 Review invalidation

Any of the following creates a new revision/event and leaves the prior review
historical only:

- product metadata change;
- specification value change;
- price amount/scope/tax/currency change;
- source revision change;
- manufacturer/brand disablement or material change;
- source withdrawal;
- review rule version change.

An old recommendation may be displayed as history, but is never treated as
currently Operational without a current-basis overlay.

### 7.5 Formal catalog resolver

The resolver selects exactly one effective approved revision for:

- manufacturer;
- brand;
- product revision;
- specification;
- price (separate commercial evaluation);
- each supporting source revision;
- applicable review record.

No unique effective candidate -> no formal technical candidate. A missing,
expired, rejected, withdrawn or suspended dependency is a typed trust failure,
not an implicit pass.

Effective-time semantics:

```text
asOf = single database transaction timestamp in UTC
effective interval = [effectiveFrom, effectiveTo)
effectiveTo NULL = unbounded
client-supplied asOf is ignored in formal API responses
same asOf is reused for all products/rules/prices in one run
```

At `effectiveFrom`, a version is eligible. At `effectiveTo`, it is no longer
eligible. If more than one approved applicable version is effective, the
resolver fails with `AMBIGUOUS_EFFECTIVE_VERSION`; it does not choose by largest
version number. The selected `asOf` and revision IDs are stored in the selection
input snapshot.

## 8. Selection Result Model

### 8.1 Independent dimensions

Replace one overloaded candidate status with:

```text
TechnicalAssessment:
  TECHNICALLY_ELIGIBLE
  TECHNICALLY_INELIGIBLE
  TECHNICAL_DATA_INSUFFICIENT
  TECHNICAL_REVIEW_REQUIRED

CommercialAssessment:
  PRICE_VALID
  PRICE_EXPIRED
  PRICE_MISSING
  PRICE_SCOPE_MISMATCH
  PRICE_REVIEW_REQUIRED

TrustAssessment:
  TRUSTED
  SOURCE_MISSING
  SOURCE_WITHDRAWN
  VERSION_UNREVIEWED
  DEMO_MOCK
  VERSION_EXPIRED

ProfessionalReviewAssessment:
  NOT_REQUIRED_BY_APPROVED_POLICY
  REQUIRED_NOT_SUBMITTED
  SUBMITTED
  IN_REVIEW
  APPROVED
  REJECTED
  RETURNED_FOR_DATA
  EXPIRED_OR_INVALIDATED

OverallStatus:
  OPERATIONAL
  PRELIMINARY
  NOT_ELIGIBLE
  INSUFFICIENT_DATA
  REQUIRES_PROFESSIONAL_REVIEW
  REQUIRES_QUOTE
```

### 8.2 Overall determination

`OPERATIONAL` requires all of:

- approved rule set with exact version;
- approved exact catalog revisions;
- no withdrawn/missing/expired dependency;
- complete technical requirement and product parameters;
- technical checks pass;
- professional review state satisfies the approved policy;
- commercial price is valid and applicable.

`PRELIMINARY` means Demo or exploratory result. It can carry missing data and
professional-review requirements but is never presented as operational.

`REQUIRES_QUOTE` means technical information may be eligible but no valid
applicable price exists.

`INSUFFICIENT_DATA` means a required fact or revision is absent.

`REQUIRES_PROFESSIONAL_REVIEW` means the facts exist but authority/professional
confirmation is outstanding.

`NOT_ELIGIBLE` means at least one authoritative hard rule is known to fail.

### 8.3 Run summary

Persist both counts and a primary outcome:

```text
runCounts:
  operational
  preliminary
  notEligible
  insufficientData
  requiresProfessionalReview
  requiresQuote

primaryOutcome:
  FAILED
  COMPLETED_WITH_OPERATIONAL_MATCH
  COMPLETED_PRELIMINARY_ONLY
  REQUIRES_PROFESSIONAL_REVIEW
  INSUFFICIENT_DATA
  REQUIRES_QUOTE
  NO_ELIGIBLE_MATCH
```

Precedence for no operational candidate:

```text
INSUFFICIENT_DATA before REQUIRES_PROFESSIONAL_REVIEW when required facts are
actually missing; otherwise REQUIRES_PROFESSIONAL_REVIEW before REQUIRES_QUOTE;
REQUIRES_QUOTE before PRELIMINARY-only.
```

Every response includes `outcomesPresent[]`, counts and all candidate results,
so a mixed result never loses a distinct blocker.

### 8.4 Rule authority

`SelectionRuleSet` and `SelectionRule` have exact version, scenario, status,
authority source revision, effective range, reviewer and a canonical content
digest. A formal evaluation requires exactly one approved applicable rule set.

No approved rule set:

- formal Operational disabled;
- candidate `REQUIRES_PROFESSIONAL_REVIEW`;
- run outcome `REQUIRES_PROFESSIONAL_REVIEW`;
- Demo-only candidates remain `PRELIMINARY`.

No numeric engineering threshold is introduced by R2. Existing floor-derived
capacity/speed rules remain removed from hard filtering until approved by the
authorized professional source.

### 8.5 Professional review state machine

```text
REQUIRED_NOT_SUBMITTED
  -> SUBMITTED
  -> IN_REVIEW
  -> APPROVED
  -> REJECTED
  -> RETURNED_FOR_DATA
  -> EXPIRED_OR_INVALIDATED
```

Rules:

- submission and approval are separate events;
- approval binds selection run, requirement digest, rule-set digest, product
  revision/specification/price/source digests and reviewer;
- current approvals cannot be inherited by a changed basis;
- a returned review requires new data and/or a new run;
- reviewer roles are controlled by an approved workflow;
- model confidence and deterministic score are not professional approval.

### 8.6 Candidate result contract

```text
SelectionCandidateResult
  id
  selectionRunId
  productRevisionId
  specificationRevisionId
  priceRevisionId?
  technicalStatus
  commercialStatus
  trustStatus
  professionalReviewStatus
  overallStatus
  checkResults[]
  missingFields[]
  unmetConstraints[]
  unverifiedConditions[]
  sourceRevisionIds[]
  ruleSetVersion
  reasonCodes[]
  warnings[]
  FK(specificationRevisionId, productRevisionId)
    -> SpecificationRevision(id, productRevisionId)
  FK(priceRevisionId, productRevisionId)
    -> PriceRevision(id, productRevisionId)
```

Every candidate from the evaluated catalog snapshot is persisted, including
`NOT_ELIGIBLE` and `INSUFFICIENT_DATA` candidates.

## 9. Sales Handoff Snapshot

### 9.1 Case and snapshot

```text
SalesHandoffCase
  id
  projectId UNIQUE
  currentSnapshotId?
  status
  assignedToId? FK User
  FK(currentSnapshotId, id)
    -> SalesHandoffSnapshot(id, caseId)

SalesHandoffSnapshot
  id
  caseId
  version
  projectId
  conversationId
  requirementId
  requirementVersion
  selectionRunId
  snapshotSchemaVersion
  canonicalPayload Json
  canonicalDigest CHAR(64)
  createdById
  createdAt
  FK(caseId) -> SalesHandoffCase(id) ON DELETE RESTRICT
  UNIQUE(id, caseId)
  UNIQUE(caseId, version)
```

`currentSnapshotId` is nullable only during the first snapshot transaction.
Creation inserts the case, snapshot and items, then sets the pointer in the
same transaction. Deleting a snapshot/case is restricted.

`canonicalPayload` is self-contained and includes:

- full requirement fields and field values;
- field source refs and confirmation states;
- selection run input/result and rule-set version;
- exact product revision, specification revision and price revision;
- actual parameter values and units;
- amounts, currency, tax basis and applicability;
- source revision IDs and content digests;
- review IDs, decisions and review times;
- professional-review state;
- missing fields, risk warnings and candidate statuses;
- handoff actor and time.

### 9.2 Snapshot items

Normalize selected product evidence:

```text
SalesHandoffSnapshotItem
  id
  snapshotId
  productId
  productRevisionId
  specificationRevisionId
  priceRevisionId?
  technicalStatus
  commercialStatus
  trustStatus
  overallStatus
  payloadFragmentDigest
  exact FKs to immutable revision rows
  FK(productRevisionId, productId)
    -> ProductRevision(id, productId)
  FK(specificationRevisionId, productRevisionId)
    -> SpecificationRevision(id, productRevisionId)
  FK(priceRevisionId, productRevisionId)
    -> PriceRevision(id, productRevisionId)

SalesHandoffSnapshotItemSource
  snapshotItemId
  sourceRevisionId
  exact FK and source digest
```

Snapshot items provide database-checkable exact references. `canonicalPayload`
provides independent historical content and remains explainable after current
later revisions or withdrawals.

### 9.3 Canonical serialization

Use a fixed versioned format:

```text
Algorithm: SHA-256
Encoding: UTF-8
JSON canonicalization: RFC 8785 JCS
Properties: lexicographically sorted
Decimal values: strings with fixed scale
Money: integer minor units + currency
Timestamp: UTC RFC 3339 with milliseconds
Null: explicit JSON null
Arrays: preserve documented semantic order
Digest scope: whole payload excluding digest fields
```

The digest is tamper evidence, not source truth.

### 9.4 Immutability

- Snapshot and item insertion occurs in one transaction.
- Snapshot/item updates and deletes are rejected by privileges/triggers.
- FK deletion is `RESTRICT`.
- New handoff creates a new snapshot version and advances the case pointer.
- Notes are append-only child records and cannot alter snapshots.
- Direct SQL cannot mutate payload, item references or digest.

### 9.5 Current-versus-snapshot display

The UI/API returns:

```text
snapshot
projectCurrent
basisDiff:
  requirementChanged
  selectionChanged
  sourceWithdrawn
  priceExpired
  reviewInvalidated
```

The original snapshot is never overwritten or re-labeled with current state.

## 10. Transactions, CAS and Idempotency

### 10.1 Requirement command

Single transaction:

1. lock conversation row;
2. verify project/scenario/current requirement;
3. insert requirement version and immutable assertions;
4. resolve field values and conflicts;
5. insert revision event and digest;
6. update conversation pointer;
7. append user and assistant messages or initial greeting;
8. write audit event;
9. commit.

The client sends `expectedRequirementVersion`. A stale request returns 409 with
the current pointer metadata and makes no writes.

### 10.2 Conversation creation

Create conversation, initial empty requirement, current pointer and initial
assistant greeting in one transaction. A failure leaves no partial
conversation.

### 10.3 Idempotency

Add `AdvisorInteractionRequest`:

```text
id
conversationId
clientMessageId
requestDigest
state COMMITTED | FAILED
userMessageId
assistantMessageId
requirementId
requirementVersion
responseDigest
createdAt
UNIQUE(conversationId, clientMessageId)
```

A retry returns the stored response if request digest matches. Same key with a
different digest is a conflict.

### 10.4 Selection and handoff

Selection run creation uses exact requirement and rule-set IDs plus a
transactionally read catalog revision snapshot. Handoff snapshot creation
validates requirement/selection/rule/catalog basis and writes header/items/
payload atomically.

After a client timeout:

- re-read by idempotency key/request id;
- do not create a second run/snapshot;
- verify committed state before reporting failure.

## 11. Same-Origin and Mutation Protection

### 11.1 Shared guard

All browser-facing mutation handlers use:

```text
withMutationGuard(request, {
  authentication,
  originCheck,
  contentPolicy,
  bodySchema,
  authorization,
  handler,
})
```

Required behavior:

1. Session validation.
2. Exact configured-origin validation.
3. Method/content-type allowlist.
4. Zod body parsing.
5. Resource/project authorization.
6. Mutation.

File upload streaming remains a separately reviewed route but must still use
the same origin policy.

### 11.2 Route inventory

An executable static test enumerates every exported POST/PATCH/PUT/DELETE Route
Handler and fails if it is not in an explicit guarded/allowlisted map. A new
unguarded mutation route must fail CI.

`allowlisted` is only for framework-owned authentication endpoints or routes
with an equivalent reviewed control; it cannot be used to exempt a product
mutation without review.

## 12. SQL-Scoped Sales Access

Repository query accepts:

```text
scope:
  GLOBAL
  PROJECTS [ids]
pagination:
  cursor
  limit
```

For project scope, the SQL `WHERE` includes the authorized project IDs before
joins to requirements, snapshots and notes and before `LIMIT`, count or
aggregate. No application-memory filtering is used for confidentiality.

Unauthorized detail/count/order pagination must not reveal whether another
project record exists. Stable ordering is `(updatedAt DESC, id DESC)`.

## 13. API Contracts

### 13.1 Conversation and requirement

```text
POST /api/projects/[projectId]/advisor/conversations
  -> server-derived project scenario

GET /api/projects/[projectId]/advisor/conversations/[conversationId]
  -> conversation current requirement pointer

POST .../messages
  {
    content,
    clientMessageId,
    expectedRequirementVersion
  }

GET/PATCH .../requirement
  PATCH { expectedVersion, patch }

POST .../requirement/confirm
  { expectedVersion }

GET .../requirement/history
  cursor + complete immutable versions
```

The old project-level requirement endpoint is compatibility read-only for a
legacy project head. It cannot be a conversation write source.

### 13.2 Selection

```text
POST /api/projects/[projectId]/selection-runs
  {
    requirementId,
    expectedRequirementVersion
  }
```

Server determines formal/Demo mode and approved rule set. Response contains
technical, commercial, trust, professional-review and overall status for each
historical run. No client can force formal mode or submit a status.

### 13.3 Catalog

All edits create revision drafts and never directly change approval:

```text
POST /api/admin/catalog/products
PATCH /api/admin/catalog/products/[id]       -> new ProductRevision
POST /api/admin/catalog/products/[revisionId]/submit
POST /api/admin/catalog/specifications/[id]/submit
POST /api/admin/catalog/prices/[id]/submit
POST /api/admin/catalog/sources/[id]/submit
POST /api/admin/catalog/reviews/[id]/decision
POST /api/admin/catalog/reviews/[id]/revoke
```

Reviews target one exact typed revision. `inputDigest` is recomputed and
verified at decision time.

### 13.4 Sales

```text
POST /api/projects/[projectId]/sales-handoffs
  {
    requirementId,
    selectionRunId,
    summary,
    budgetConcern?
  }

GET /api/admin/sales?scope=authorized&cursor=...
GET /api/admin/sales/[caseId]/snapshots/[snapshotId]
POST /api/admin/sales/[caseId]/snapshots/[snapshotId]/notes
```

## 14. Permissions

New permissions:

```text
catalog.review
selection.rules.review
professional.review
```

Rules:

- Product Admin can create/submit revisions; it cannot approve own revisions.
- Technical Reviewer/Professional Reviewer can approve only within assigned
  authority and cannot approve a changed/different basis.
- System Admin does not inherit engineering approval.
- Customer can confirm ordinary requirements but cannot approve professional
  data or catalog revisions.
- Sales can view only authorized handoff snapshots and append follow-up notes.
- Project/resource access is checked on every mutation and read.

Exact role names and assignment model remain open decisions.

## 15. Database Constraints and State Machines

### 15.1 Catalog states

```text
DRAFT -> PENDING_REVIEW -> APPROVED -> SUPERSEDED
PENDING_REVIEW -> REJECTED
APPROVED -> EXPIRED | WITHDRAWN | SUSPENDED
DEMO_MOCK -> WITHDRAWN
LEGACY_REVIEW_REQUIRED -> REVIEW_FLOW_REQUIRED
```

Every transition has a command, actor, source revision, exact target version,
audit event and allowed failure result. Raw status updates are prohibited.

### 15.2 Review validity

A review is valid only while its target revision and all evidence source
revisions equal the recorded `inputDigest`, the target remains APPROVED/
effective, and no withdrawal/invalidation exists.

### 15.3 Constraint ownership

Database:

- exact FKs and unique keys;
- scenario and project ownership;
- version references;
- effective windows;
- append-only snapshots/reviews;
- no cross-project links.

Service:

- current permission;
- exact command state;
- canonical digest computation;
- rule authority policy;
- professional review workflow.

## 16. Legacy Migration

### 16.1 Expand

Add new fields/tables without destroying R1 columns. Keep old routes read-only
for compatibility while new writes use normalized records and immutable
catalog revisions.

### 16.2 Preflight

Before backfill, check:

- Project/Conversation/Requirement scenario consistency;
- whether legacy JSON fields can be mapped uniquely to field rows;
- VERIFIED catalog records lacking review/source revision evidence;
- effective windows that are absent/overlapping;
- dynamic sales handoffs lacking an identifiable requirement/selection;
- existing selection runs whose output basis is incomplete.

Ambiguous records must be quarantined/legacy-flagged, not guessed.

### 16.3 Backfill

- normalize unambiguous requirement JSON into field assertion/value rows;
- preserve old JSON as legacy projection;
- backfill scenario from one unambiguous project/conversation source;
- map old source references to legacy source records with `UNVERIFIED` status;
- VERIFIED without evidence -> `LEGACY_REVIEW_REQUIRED`;
- old handoff without snapshot -> `LEGACY_UNSNAPSHOTTED`, read-only;
- old selection runs -> historical only, `legacyBasis=true`.

### 16.4 Validation and contract

Use NOT VALID constraints during backfill, validate only after checks.
No column removal/rename occurs in the first remediation.

## 17. Failure Handling

| Failure | API | Durable state |
|---|---|---|
| CAS mismatch | 409 | no mutation; current pointer |
| ambiguous semantics | 200 structured `NEEDS_CONFIRMATION` | assertions only, no resolved value |
| duplicate client message | existing interaction response | no duplicate |
| no exact approved rule | selection `REQUIRES_PROFESSIONAL_REVIEW` | no Operational |
| technical facts missing | `INSUFFICIENT_DATA` | no candidate pass |
| price missing/expired | `REQUIRES_QUOTE` | technical result retained |
| source withdrawn | trust failure | historical source/review preserved |
| snapshot digest mismatch | transaction failure | no snapshot/items |
| unauthorized project | 403/404 | no resource content |
| source/review mismatch | review rejected | no approval |

## 18. Test and Verification Requirements

The complete R2 matrix is in `P1_PRODUCT_REMEDIATION_TEST_PLAN_R2.md`.

The future implementation must assert:

- exact semantic outcomes;
- database scenario equality;
- normalized field source-of-truth;
- exact review target/source revision;
- source withdrawal and review invalidation;
- separate professional-review and information states;
- technical/commercial/overall status separation;
- self-contained snapshot after withdrawals;
- CAS/idempotency/transaction final state;
- SQL-scoped sales filtering;
- all mutation route coverage;
- migration/legacy ambiguity handling.

### 18.1 Test infrastructure remediation

The current `packages/authority-core/package.json` declares `vitest` but the
working environment has not linked its executable. R2 requires:

1. clean dependency installation with the frozen lockfile in the authorized
   test environment;
2. a preflight check that `@elevator/authority-core` can execute its declared
   Vitest binary;
3. root test execution after dependency identity passes;
4. worker/PDF suites run with controlled workspace concurrency to eliminate
   resource-contention timeout ambiguity;
5. a browser installed only by separate authorization.

No dependency, lockfile or environment change is performed in R2.

## 19. Implementation Phases

### A. Low-risk after independent R2 approval

- pure conditional parser and test corpus;
- DTO/status fixtures;
- non-Schema UI confirmation/status copy;
- documentation/traceability;
- browser test preparation.

No database or claim of completed remediation.

### B. Dependent on Open Decisions

- formal Operational rule enablement;
- catalog review role assignment;
- source evidence acceptance;
- price/quote policy;
- Project Type policy;
- snapshot retention.

### C. High-risk separate authorization

- Prisma/PostgreSQL schema and migrations;
- composite FK/CHECK/trigger implementation;
- catalog revision/review/source migration;
- professional review workflow;
- sales snapshots and append-only rules;
- mutation guard rollout;
- database concurrency/trigger/runtime verification.

### D. Separate workflow

- P1-3 Upload/Attempt/Lifecycle/FileVersion;
- Native RPC;
- production deployment.

## 20. Acceptance Criteria

```text
P1 corrected in design: REQUIRED
P1 implemented: NOT AUTHORIZED
R2 independent review: PENDING
Open decisions: RETAINED
Database migration: NOT AUTHORIZED
Runtime: NOT VERIFIED
P1-3: ISOLATED
```

R2 can be called complete only if all seven P1 and every listed P2/P3 disposition
is represented in traceability and test matrix. It cannot be called fixed.

## 21. Open Decisions

See `P1_PRODUCT_REMEDIATION_OPEN_DECISIONS_R2.md`. No R2 design decision may
silently choose a value reserved for product, engineering, legal or security
authority.

