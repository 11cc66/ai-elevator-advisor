# R3-BASIS-1 Revision 5 Protocol Specification

Status:

```text
PROTOCOL: R3-BASIS-1-R5
REGISTRY: SNAPSHOT-R2
STABLE KEY ENCODING: SK-R2
NORMATIVE DESIGN
NOT IMPLEMENTED
```

## 1. Why Revision 5 Is Required

R4 defined `stableKey` as UTF-8 text and used a presence flag whose NULL/absent
semantics were underspecified. C5 uses:

- binary `SK-R2` stable-key bytes;
- every Registry field present exactly once;
- explicit NULL as `typeTag=0,presence=0`;
- present value as non-zero type and `presence=1`;
- a new Registry/protocol identity.

That is a wire-semantic change. R4 remains historical and is not reinterpreted.

## 2. Basis Header

```text
magic              8 bytes: 52 33 42 41 53 49 53 00
version            uint16be = 5
payload type       uint16be = 1
header length      uint32be = 28
record count       uint32be
body length        uint64be
body               concatenated canonical records
```

The parser consumes exactly the declared body and rejects trailing bytes.

## 3. Record Frame

```text
recordLength       uint32be (includes itself)
recordType         uint16be
rowIdLength        uint16be
rowId              printable ASCII bytes, 1..64
stableKeyLength    uint16be
stableKey          complete SK-R2 bytes
fieldCount         uint16be
fields
```

`stableKeyLength` is byte length, not text length. StableKey is not decoded as
UTF-8.

## 4. Field Frame

```text
fieldTag           uint16be
typeTag            uint8
presence           uint8
valueLength        uint32be
encodedValue
```

Rules:

- every Registry field tag appears exactly once;
- NULL has `typeTag=0,presence=0,valueLength=0`;
- a present value has `presence=1` and a non-zero type tag;
- an omitted field is invalid;
- typeTag zero with presence one is invalid;
- a non-zero type with presence zero is invalid;
- duplicate or descending field tags in a pre-encoded frame are invalid;
- semantic input arrays are sorted before encoding; decoder order is strict.

## 5. Scalar Catalogue

| Tag | Type | Encoding |
|---:|---|---|
| 0 | NULL | presence 0, length 0 |
| 1 | BOOLEAN | one byte `00` or `01` |
| 2 | INTEGER | signed 64-bit big-endian |
| 3 | DECIMAL | canonical ASCII, no exponent, no leading `+`, no redundant trailing zeros; NUMERIC(18,6) bounds |
| 4 | TEXT | UTF-8 NFC; maximum 4,000 Unicode scalar values |
| 5 | ENUM | registered printable ASCII code, 1..64 bytes |
| 6 | CANONICAL_ID | printable ASCII ID, 1..64 bytes; colon preserved |
| 7 | TIMESTAMP | signed int64 UTC epoch milliseconds |
| 8 | BYTES | raw bytes; sourceKey maximum 256 bytes |
| 9 | LIST | one-byte element type, uint32 count, length-prefixed sorted elements |

R2 does not currently register LIST fields. The type remains reserved.

## 6. SOURCE_KEY_R3

Requirement Field tag 11 uses `SOURCE_KEY_R3`:

```text
magic             4 bytes "SRC3"
version           uint16be = 3
componentCount    uint16be = 4

component 1       sourceKind: ASCII enum
component 2       sourceEntityType: ASCII enum
component 3       sourceEntityId: ASCII canonical ID
component 4       sourceAuxId: NULL or UTF-8 NFC

for each component:
  componentIndex  uint16be
  componentType   uint8 (0 NULL, 1 ASCII, 2 UTF8)
  presence        uint8
  length          uint32be
  bytes

endMarker         uint16be 0xFFFF
```

`sourceAuxId` is normalized/stored as an explicit null flag plus text; derived
SOURCE_KEY_R3 preserves the NULL/present distinction. ASCII entity ID domain
and UTF-8 auxiliary text domain are now separate, resolving the C4 contradiction.

## 7. Canonical Ordering

Records sort by:

```text
(recordType numeric, stableKey bytes, rowId ASCII bytes)
```

Fields sort by `fieldTag`. Duplicate `(recordType,stableKey)` is rejected before
hashing. Row order from database queries cannot affect output.

## 8. C5-SNAP-01

The sole semantic fixture is:

```text
C5_SNAPSHOT_VECTOR_01.json
```

Generated result:

```text
Record count: 15
Basis length: 3051
SHA-256:
83F00E53B7AC21779B2753F0640B3023E2DE6A53AFA405BC0E4C8A2FDC056FB1
```

Complete Basis bytes are in:

```text
C5_SNAPSHOT_VECTOR_01_HEX.md
```

The recommended value is derived, not manually transcribed:

```text
JSON semantic fixture
  -> schema/type/registry validation
  -> SK-R2 stable keys
  -> SOURCE_KEY_R3 source key
  -> sorted Record/Field frames
  -> Basis R5
  -> complete bytes
  -> SHA-256
```

## 9. C4 Vector Disposition

R1/R4 `C4-SNAP-01` remains historical and is not reinterpreted as R2/R5. The
R3-C4 review found that its checked-in hex hashed to
`4874A5E5...E262`, not `8C88E3F0...34E2`, with Requirement Field records
mis-tagged as type `0x0000`.

No R1/R4 implementation has been authorized. If historical R1/R4 bytes are
found outside this repository state, they are preserved read-only and may be
re-encoded as a new R2/R5 Snapshot version after structured tuple recovery.

## 10. Rejection Rules

Reject before hashing:

- unknown registry/protocol/encoding version;
- unknown record or field tag;
- NULL/presence/type mismatch;
- invalid UTF-8/NFC;
- oversized field;
- `SK-R2` tuple mismatch;
- `SOURCE_KEY_R3` mismatch;
- duplicate stable key or row ID;
- cross-Snapshot/context row;
- record/header/body length mismatch;
- trailing bytes.

## 11. Version Separation

```text
Stable-key encoding: SK-R2
Snapshot Registry: SNAPSHOT-R2
Basis protocol: R3-BASIS-1-R5
Normalized schema: SNAPSHOT-SCHEMA-R2
```

These versions are stored and reviewed independently. A Basis vector is valid
only when all four declarations match its fixture and Registry.

