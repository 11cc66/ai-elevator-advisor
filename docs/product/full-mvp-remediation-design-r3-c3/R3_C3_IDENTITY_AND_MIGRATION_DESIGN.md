# R3-C3 Identity and Migration Design

## 1. Current Identity Facts

Current Prisma models use `String @id @default(cuid())` for Project,
Conversation, Requirement, Message, Selection and Sales entities. Existing
foreign keys are text/CUID. The repository does not use native UUID primary
keys for these business objects.

Evidence:

- `prisma/schema.prisma:197-220` (`Project.id` CUID);
- `prisma/schema.prisma:868-928` (conversation/message/requirement CUIDs);
- `prisma/schema.prisma:1042-1097` (selection/sales CUIDs).

## 2. Selected Identity Strategy

C3 selects **Option A: retain CUID/Text identity**.

```text
Entity primary key       TEXT / CUID
Foreign key             TEXT / CUID
sourceKey               TEXT
sourceKey format        <kind>:<canonical-entity-id>[:<aux-id>]
R3-BASIS-1 rowId         length-prefixed UTF-8 text/CUID
```

No native UUID conversion is required for existing business IDs.

### 2.1 Canonical forms

```text
assertion:<assertionId>
professional-event:<professionalReviewEventId>
catalog-evidence:<catalogEvidenceObjectId>
session-system:<ruleSetRevisionId>:<assertionId>
```

IDs are bounded to 64 ASCII characters. New IDs are server-generated CUIDs.
`sourceKey` is bounded to 160 ASCII characters. An empty, whitespace,
overlength, non-ASCII, UUID-shaped substitution or unknown prefix is rejected.

### 2.2 Why not UUID

A UUID conversion would require rewriting every existing primary/foreign key,
all DTOs, URLs, test fixtures, audit links and application code; it would also
make historical CUID references ambiguous during the migration. It provides
no security property that CUID text identity lacks when the keys are still
opaque and server-generated.

## 3. Source Identity Invariants

- `sourceKey` is `NOT NULL` and immutable.
- A source kind plus sourceKey has exactly one source record.
- The actual typed source FK and sourceKey MUST match:
  - USER_ASSERTION: `sourceKey = 'assertion:' || sourceAssertionId`;
  - PROFESSIONAL_REVIEW:
    `sourceKey = 'professional-event:' || sourceProfessionalReviewEventId`;
  - CATALOG_EVIDENCE:
    `sourceKey = 'catalog-evidence:' || sourceEvidenceObjectId`;
  - SYSTEM_DERIVED:
    `sourceKey = 'session-system:' || sourceSystemRuleRevisionId || ':' || sourceAssertionId`.
- A sourceKey cannot be reused with a different source kind.
- Snapshot fields copy sourceFieldValueId/sourceKind/sourceKey, not a second
  independently chosen source ID.

## 4. Migration Phases

### A. Preflight

- Inventory all existing CUID values and references.
- Detect non-CUID or overlong IDs.
- Detect null/ambiguous legacy sources.
- Detect catalog evidence without immutable content.
- Detect existing C2/R3 design rows that cannot fit typed fields.

### B. Expand

- Add nullable text sourceKey and typed evidence columns.
- Do not alter or rewrite existing primary keys.
- Keep legacy JSON and existing foreign keys read-only.
- Create a mapping/quarantine table.

### C. Backfill

- Map existing conversation-linked requirement rows to stable Requirement and
  RequirementVersion identities with a deterministic source ID.
- Map only unambiguous typed values.
- Create sourceKey from the actual existing source ID.
- Store legacy JSON only as read-only compatibility projection.
- Quarantine unknown sources; never map them to SYSTEM_DERIVED.

### D. Validate

- Check sourceKey length/prefix/typed FK relation.
- Check all composite parent/child key pairs.
- Check no sourceKey collides across kinds.
- Check no rejected/quarantined row gets a resolved formal value.
- Validate typed column/CHECK constraints on a copy of the historical data.

### E. Activate

- Set sourceKey and typed owner columns NOT NULL for active rows.
- Enable new controlled write functions.
- Keep quarantine rows readable but non-formal.

### F. Contract (deferred)

Removing legacy JSON/columns requires a separate migration authorization after
historical reconciliation. C3 does not authorize column removal.

## 5. New ID Generation

- Server generates CUIDs using the existing Prisma default policy.
- Client-supplied IDs are never trusted as new canonical entity identities.
- Import IDs are accepted only through an approved mapping record with exact
  legacy evidence.
- A row may not have two active canonical IDs.

## 6. Rollback Limits

- Before activation: drop only the new nullable columns/identity mappings in an
  authorized isolated migration branch.
- After a real backfill COMMIT: rollback cannot guess old JSON or delete
  quarantined evidence. The affected rows remain read-only and require a
  separately reviewed data repair.
- After a formal Snapshot is created: historical IDs, source keys and basis
  bytes are immutable; no ordinary rollback may rewrite them.

## 7. Quarantine Reasons

```text
LEGACY_ID_INVALID
LEGACY_SOURCE_UNKNOWN
LEGACY_SOURCE_UNAVAILABLE
LEGACY_TYPE_AMBIGUOUS
LEGACY_JSON_CONFLICT
LEGACY_SCENARIO_UNMAPPABLE
LEGACY_EVIDENCE_MISSING
```

Quarantine resolution requires an approved actor, exact evidence and an audit
event. It never silently converts to a typed fact.
