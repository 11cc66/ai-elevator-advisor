# Canonical Source Identity R2

## 1. Decision

R3-C4 chooses **structured source identity plus a derived, non-authoritative
sourceKey**.

The authoritative source columns are:

```text
sourceKind TEXT NOT NULL
sourceEntityType TEXT NOT NULL
sourceEntityId TEXT NOT NULL
sourceAuxId TEXT NULL
sourceKey TEXT NOT NULL
```

`sourceKey` is generated deterministically by `canonical_source_key_r2` from
the structured columns. It is for audit/display and Basis inclusion only; it
is never the sole FK or authorization proof.

## 2. Canonical Source Key R2

```text
version = SRC-R2
encoding = length-prefixed UTF-8 NFC components
component = uint16be(byteLength) || UTF8(bytes) || 0x1f
key = "SRC-R2" || sourceKind || sourceEntityType ||
      sourceEntityId || sourceAuxId-or-empty || 0x1e
```

Empty aux is represented by a zero-length component, not `NULL` string.
Source components are limited to 64 ASCII bytes. The function rejects invalid
UTF-8, overlong components, control characters, empty required components and
unknown source kinds.

This eliminates `:` parsing ambiguity. IDs may contain `:`, but source key
reconstruction uses typed columns/length prefixes, not delimiter splitting.

## 3. Typed Source FKs

For each source kind:

- `USER_ASSERTION`: exact `sourceAssertionId` and same RequirementVersion;
- `PROFESSIONAL_REVIEW`: exact Event six-column owner key;
- `CATALOG_EVIDENCE`: exact immutable EvidenceObject/SourceRevision;
- `SYSTEM_DERIVED`: exact SystemRuleRevision and generated Assertion;
- `OTHER_AUTHORIZED_SOURCE`: registered extension table only.

No source kind is allowed to use a free string as the only relationship.

## 4. Migration

1. Preserve existing CUID/Text IDs.
2. Add structured source columns nullable during expand.
3. Backfill source kind/type/id from typed FKs where unambiguous.
4. Derive sourceKey with one versioned function.
5. Reject/quarantine malformed or ambiguous legacy source data.
6. Add exact source FKs and NOT NULL constraints.
7. Never rewrite an existing ID during sourceKey derivation.

## 5. Tests

- IDs containing `:`, multiple `:`, Unicode, empty, overlong.
- Source namespace/entity type mismatch.
- Same entity ID in different namespaces.
- Missing aux ID.
- FieldValue sourceKey vs typed source mismatch.
- Snapshot sourceKey copy mismatch.
- Legacy source round-trip and quarantine.

## 6. Result

```text
DELIMITER AMBIGUITY = CLOSED
STRUCTURED SOURCE IDENTITY = DESIGNED
sourceKey DERIVATION = DETERMINISTIC
DATABASE SOURCE BINDING = TYPED FK
```
