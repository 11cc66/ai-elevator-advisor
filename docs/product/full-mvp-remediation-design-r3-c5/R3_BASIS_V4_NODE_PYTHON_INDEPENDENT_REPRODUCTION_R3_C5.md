# R3-BASIS-1 R5 Node/Python Independent Reproduction

Status:

```text
IN-MEMORY ONLY
DATABASE: NOT ACCESSED
RUNTIME: NOT EXECUTED
```

## 1. Independent Inputs

Both implementations read only:

```text
C5_SNAPSHOT_VECTOR_01.json
```

The fixture declares Registry `SNAPSHOT-R2`, Basis protocol
`R3-BASIS-1-R5`, stable-key encoding `SK-R2`, ten record-type definitions and
15 records.

## 2. Independent Implementations

| Implementation | Libraries | Encoder |
|---|---|---|
| Node.js | `Buffer`, `crypto`, `fs` | `tools/encode_snapshot_node.js` |
| Python | `struct`, `hashlib`, `json`, `unicodedata` | `tools/encode_snapshot_python.py` |

Each independently:

1. validates record tuple definitions;
2. encodes ASCII IDs, keys and INT64 components;
3. derives `SOURCE_KEY_R3`;
4. validates NFC text;
5. sorts fields by tag;
6. sorts records by `(recordType,stableKey,rowId)`;
7. frames each Record and Field;
8. assembles the 28-byte R5 header and body;
9. hashes complete Basis bytes.

## 3. Aggregate Result

```text
Fixture: C5-SNAP-01
Registry: SNAPSHOT-R2
Protocol: R3-BASIS-1-R5
StableKey: SK-R2

Node record count:    15
Python record count:  15
Node byte length:     3051
Python byte length:   3051

Node SHA-256:
83F00E53B7AC21779B2753F0640B3023E2DE6A53AFA405BC0E4C8A2FDC056FB1

Python SHA-256:
83F00E53B7AC21779B2753F0640B3023E2DE6A53AFA405BC0E4C8A2FDC056FB1
```

## 4. Full Byte Comparison

The PowerShell review harness decoded each independent output hex to bytes
and compared the complete byte arrays:

```text
FULL_BYTES_EQUAL = True
FIRST_DIFF_OFFSET = NONE
```

This was a byte comparison, not only a SHA-text comparison.

## 5. Record Inventory

| Type | Row ID | Length |
|---:|---|---:|
| 0 | header-1 | 204 |
| 1 | rf-2 | 344 |
| 1 | rf-1 | 347 |
| 2 | cand-1 | 225 |
| 2 | cand-2 | 230 |
| 3 | param-2 | 161 |
| 3 | param-1 | 168 |
| 4 | price-1 | 171 |
| 4 | price-2 | 171 |
| 5 | src-1 | 185 |
| 5 | src-2 | 180 |
| 6 | crev-1 | 139 |
| 7 | prev-1 | 212 |
| 8 | warn-1 | 152 |
| 9 | missing-1 | 134 |

Sum of record lengths plus the 28-byte Basis header:

```text
3023 + 28 = 3051
```

## 6. Failed Intermediate Attempt

The first Node/Python comparison failed because Node encoded the SK-R2
component type as `uint16be` while Python used the specified one byte. The
comparison detected different lengths/hashes. Node was corrected to the
written one-byte protocol and both implementations were rerun from the same
semantic fixture.

That failed intermediate result is not used as a PASS vector.

## 7. Evidence Files

```text
C5_SNAPSHOT_VECTOR_01.json
C5_SNAPSHOT_VECTOR_01_HEX.md
C5_SNAPSHOT_VECTOR_01_EXPECTED_RESULT.md
tools/encode_snapshot_node.js
tools/encode_snapshot_python.py
```

## 8. Coverage Boundary

Verified:

- Registry type coverage 0..9;
- SK-R2 framing;
- SOURCE_KEY_R3 framing;
- scalar and field framing;
- canonical ordering;
- 15-record complete Basis;
- byte-for-byte Node/Python equality.

Not verified:

- SQL DDL;
- PostgreSQL triggers/FKs;
- role grants;
- P1-3 storage;
- Runtime or production behavior.

