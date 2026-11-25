# R3-BASIS-1 Revision 3 Protocol Specification

Status:

```text
NORMATIVE DESIGN
NOT IMPLEMENTED
```

This is the complete encoding contract for normalized sales-snapshot basis
bytes. It does not authorize a database function, serializer or Migration.

## 1. Top-Level Frame

All integers are big-endian.

```text
magic              8 bytes: 52 33 42 41 53 49 53 00 (R3BASIS\0)
format version     uint16be = 0x0003
payload type       uint16be = 0x0001 (snapshot basis)
header length      uint32be = 28
record count       uint32be
body length        uint64be
body               concatenated records
```

`body length` is exactly the byte length of all records. No padding bytes,
implicit separators or extensions are permitted. A parser must reject
unconsumed bytes after the declared body.

## 2. Record Frame

```text
record length      uint32be, includes this field and whole record
record type        uint16be from the approved registry
rowId length       uint16be
rowId              UTF-8 ASCII canonical CUID/ID text
stableKey length   uint16be
stableKey          UTF-8 NFC bytes
field count        uint16be
fields             field records
```

Rules:

- `rowId` is 1..64 ASCII characters `[A-Za-z0-9:_-]`; it is not a UUID and
  is never padded to 16 bytes.
- `rowId` is included in the basis so a snapshot can identify its stored row.
- `stableKey` is 1..512 UTF-8 bytes; it is a semantic key, not a random
  surrogate ID. It must be unique for a given `(recordType, rowId)`.
- Records are sorted by `(recordType, stableKey bytes, rowId bytes)`.
- Duplicate `(recordType, stableKey)` is a rejection. The rowId does not
  turn a duplicate stable key into a new record.
- `record length` must equal the actual framed length and must not exceed
  16 MiB.

## 3. Field Frame

```text
field tag          uint16be from the record's registry
type tag           uint8
presence           0x00 = absent, 0x01 = present
value length       uint32be
encoded value      exactly value length bytes
```

Fields are sorted by `fieldTag` ascending. Duplicate tags, missing required
fields, unknown required tags and non-canonical presence/type combinations
are rejected. For absent values, `typeTag=0` and length `0`. A present value
may not use type 0.

The record and field tag registries are versioned separately from this
document. Every release of a registry has a stable immutable identifier.

## 4. Scalar Types

| Tag | Type | Exact encoding |
|---:|---|---|
| 0 | NULL | absent field only; length 0 |
| 1 | BOOLEAN | one byte, `00` false or `01` true |
| 2 | INTEGER | signed 64-bit two's-complement, exactly 8 bytes |
| 3 | DECIMAL | normalized ASCII: optional `-`, digits, optional `.` and fraction; no exponent, no `+`, no leading zero except `0`, trailing fractional zeros removed, zero is `0`; max 18 significant digits and scale 6 |
| 4 | TEXT | UTF-8 NFC, max 4,000 Unicode code points |
| 5 | ENUM | ASCII stable enum code, max 64 bytes |
| 6 | CANONICAL_ID | ASCII `[A-Za-z0-9:_-]{1,64}` |
| 7 | TIMESTAMP | signed 64-bit Unix epoch milliseconds UTC, exactly 8 bytes |
| 8 | BYTES | raw bytes, max 1 MiB |
| 9 | LIST | one-byte element type, uint32be count, then each uint32be length + encoded element; canonical sorted by encoded element bytes; count max 10,000; duplicates allowed only if the registry declares it |

`encodedValue` means the type-specific bytes after the frame. It is never a
JSON serialization or an application string with implicit type.

Text normalization is NFC. Inputs containing invalid UTF-8, non-NFC text or
surrogate code points are rejected, not repaired. Decimal text with multiple
equivalent spellings is normalized before encoding; if the caller supplies an
un-normalized decimal string, the serializer parses and rejects invalid or
overflowing input rather than guessing.

## 5. Stable Key and Row Identity

`rowId` identifies the stored row; `stableKey` identifies its semantic
business key. Both are nonempty and length-bounded. `stableKey` must not be
generated from a random UUID. If the schema has no natural stable key, the
record is ineligible for R3-BASIS-1 and must be explicitly assigned a
versioned canonical key in the registry.

## 6. Rejection Rules

The encoder/parser must reject before hashing:

- invalid UTF-8 or non-NFC text;
- invalid CUID/ID characters;
- invalid scalar type, unknown field/record type;
- wrong INTEGER length, timestamp arithmetic overflow or Decimal overflow;
- noncanonical Decimal spelling;
- absent field with nonzero length or present NULL;
- duplicate field tag, duplicate stable key, unsorted canonical input after
  attempted reordering (if the caller claims already canonical input);
- field/record body length mismatch;
- more than 16 MiB body, more than 1 MiB bytes or text length limit;
- unconsumed bytes after the body.

No rejection path returns a SHA-256.

## 7. Canonicalization Pipeline

```text
input
  -> typed field validation
  -> NFC/ASCII/canonical scalar normalization
  -> field tag sort + field bytes
  -> record fields and record framing
  -> record type/stableKey/rowId sort
  -> body bytes
  -> header + body
  -> SHA-256
```

The same bytes must be produced by the application encoder and the independent
DATABASE verifier/reference implementation. A database function is not
assumed to be available until its owner, language, immutable functions and
grants are approved under `OD-R3-C2-03`/`OD-R3-C3`.

## 8. Test Vectors

The fixed known-answer vectors are in `R3_BASIS_V3_FIXED_VECTORS.md`.
`R3_BASIS_V3_INDEPENDENT_REPRODUCTION.md` records the independent second
implementation. The protocol cannot be accepted if any valid vector differs
by one byte.
