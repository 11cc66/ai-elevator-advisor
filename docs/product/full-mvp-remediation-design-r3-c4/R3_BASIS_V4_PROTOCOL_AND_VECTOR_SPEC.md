# R3-BASIS-1 Revision 4 Protocol Specification

Status:

```text
NORMATIVE SNAPSHOT PROTOCOL
REGISTRY: SNAPSHOT-R1
NOT IMPLEMENTED
```

## 1. Purpose

Revision 4 makes the C3 generic framing usable for an actual Snapshot. It
binds every record to `SNAPSHOT_REGISTRY_R1.md` and uses the registry-defined
record/field tags and stable keys.

## 2. Header

```text
magic              8 bytes: 52 33 42 41 53 49 53 00
version            uint16be = 0x0004
payload type       uint16be = 0x0001
header length      uint32be = 28
record count       uint32be
body length        uint64be
body               concatenated canonical records
```

No padding, implicit separator or unknown extension is allowed. The parser
must consume exactly the declared body and no more.

## 3. Record and Field Frames

Record:

```text
recordLength uint32be (includes field)
recordType uint16be (SNAPSHOT-R1)
rowIdLength uint16be
rowId UTF-8 ASCII canonical CUID
stableKeyLength uint16be
stableKey UTF-8 NFC
fieldCount uint16be
fields
```

Field:

```text
fieldTag uint16be
typeTag uint8
presence uint8 (0 absent, 1 present)
valueLength uint32be
encodedValue
```

Field tags are record-local and sorted ascending. Unknown record types, field
tags, absent required fields and duplicate tags are rejected.

## 4. Scalar Types

Same exact scalar catalogue as R3-BASIS revision 3:

| Tag | Type | Encoding |
|---:|---|---|
| 0 | NULL | absent only |
| 1 | BOOLEAN | `00`/`01` |
| 2 | INTEGER | signed 64-bit big-endian |
| 3 | DECIMAL | canonical ASCII, max 18 digits/scale 6 |
| 4 | TEXT | UTF-8 NFC, max 4,000 code points |
| 5 | ENUM | stable ASCII code, max 64 bytes |
| 6 | CANONICAL_ID | ASCII CUID/ID, 1..64 |
| 7 | TIMESTAMP | UTC epoch milliseconds, int64 |
| 8 | BYTES | raw bytes, max 1 MiB |
| 9 | LIST | one-byte element type, count, length-prefixed sorted elements |

Unknown types, invalid UTF-8, non-NFC text, invalid decimal spelling,
overflow, null/presence mismatch and unknown enum values reject before hashing.

## 5. Canonical Ordering

Records sort by:

```text
(recordType, stableKey UTF-8 bytes, rowId UTF-8 bytes)
```

Fields sort by `fieldTag`. Duplicate `(recordType, stableKey)` is rejected;
rowId does not turn a duplicate into a valid second record. Input array order
must not affect output.

## 6. Actual Snapshot

A Snapshot Basis contains exactly the registry-defined records for the
snapshot, including the Header and all required child records. The full
`C4-SNAP-01` vector in `R3_BASIS_V4_FIXED_VECTORS.md` covers:

- Header;
- two Requirement Fields;
- two Candidates;
- two Parameters;
- two Prices;
- two Sources;
- Catalog Review;
- Professional Review;
- Warning;
- Missing Field.

The full vector is the actual Snapshot-level known-answer test. Generic
framing alone is not sufficient evidence.

## 7. Registry Binding

The Header fields `registryRevision=SNAPSHOT-R1` and
`protocolRevision=R3-BASIS-1-R4` must be present and exact. Unknown versions
are rejected, not reinterpreted. Registry changes require a new Registry
Revision and new Basis vectors.
