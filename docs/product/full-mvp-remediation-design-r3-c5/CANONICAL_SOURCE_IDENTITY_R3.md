# Canonical Source Identity R3

Status:

```text
SOURCE KEY VERSION: SOURCE_KEY_R3
DESIGN ONLY
NOT IMPLEMENTED
```

## 1. Structured Authority

The authoritative source identity is the tuple:

```text
sourceKind          ENUM, registered
sourceEntityType    ENUM, registered
sourceEntityId      ASCII canonical ID
sourceAuxIsNull     BOOLEAN
sourceAuxText       TEXT, empty when null
```

`sourceKey` is a derived binary completeness check, not an authorization or
foreign-key proof.

## 2. Encoding

```text
magic             4 bytes "SRC3"
version           uint16be 3
componentCount    uint16be 4

component 1: sourceKind
component 2: sourceEntityType
component 3: sourceEntityId
component 4: sourceAuxId

component:
  index           uint16be
  type            uint8 (0 NULL, 1 ASCII, 2 UTF8)
  presence        uint8
  length          uint32be
  bytes

end               uint16be 0xFFFF
```

Component domains:

| Component | Domain | Limit |
|---|---|---|
| sourceKind | registered ASCII enum | 64 bytes |
| sourceEntityType | registered ASCII enum | 64 bytes |
| sourceEntityId | printable ASCII canonical ID | 1..64 bytes |
| sourceAuxId | required -> UTF-8 NFC printable text; optional -> explicit NULL | 1..128 bytes or NULL |

Unicode is allowed only in `sourceAuxId`, where it is normalized to NFC and
stored as both null-state and text. IDs remain ASCII and are never
Unicode-normalized or case-folded.

## 3. Typed Source Relationships

| Source kind | Exact bound source |
|---|---|
| `USER_ASSERTION` | `RequirementFieldAssertion` exact requirement/version/conversation/project/scenario and source identity |
| `PROFESSIONAL_REVIEW` | `ProfessionalReviewEvent` exact six-column owner key |
| `CATALOG_EVIDENCE` | immutable EvidenceObject/SourceRevision |
| `SYSTEM_DERIVED` | exact SystemRuleRevision and generated assertion |
| `OTHER_AUTHORIZED_SOURCE` | only a separately registered immutable extension table |

No free string alone establishes a source.

## 4. Snapshot Binding

`SalesSnapshotRequirementField` copies the structured identity and
`sourceKey` bytes. It does not copy only a display string.

Both:

- an exact composite FK to `RequirementFieldValue`; and
- a deferred equality/recompute check;

must pass. This prevents a Snapshot from mixing FieldValue ID with a different
source.

## 5. Historical IDs

IDs may contain one or multiple `:`. The bytes are preserved exactly in ASCII
components. The colon has no syntax.

Examples that remain distinct:

```text
sourceEntityId "a:b" + aux null
sourceEntityId "a"   + aux "b"
```

## 6. Migration

1. preserve existing IDs;
2. recover sourceKind/type/id from typed FKs where unambiguous;
3. recover auxiliary ID and null state;
4. derive `sourceKey`;
5. verify `sourceKey` against stored typed identity;
6. quarantine malformed/ambiguous source rows;
7. add exact NOT NULL/FK constraints;
8. never rewrite an existing ID to remove colons.

## 7. Tests

- colon/multi-colon IDs;
- sourceAux Unicode NFC/NFD;
- sourceAux NULL vs empty;
- invalid Unicode scalar;
- source type/kind mismatch;
- same ID in different namespaces;
- sourceKey mismatch;
- Snapshot FieldValue/source mismatch;
- two source kinds with same textual ID.

