# R3-BASIS Node/Python Accept/Reject Vector Set R3-C6

## 1. Scalar Vectors

| ID | Input | Expected |
|---|---|---|
| `SC-TXT-01` | 4,000 Unicode scalars | accept |
| `SC-TXT-02` | 4,001 Unicode scalars | reject `TEXT_LENGTH` |
| `SC-TXT-03` | text containing NUL | reject `TEXT_NUL` |
| `SC-DEC-01` | `1.75` | accept |
| `SC-DEC-02` | `1e3` | reject `DECIMAL_GRAMMAR` |
| `SC-DEC-03` | `1.750000` | reject `DECIMAL_NOT_CANONICAL` |
| `SC-DEC-04` | 19 integer digits | reject `DECIMAL_PRECISION` |
| `SC-BOOL-01` | JSON `true` | accept |
| `SC-BOOL-02` | string `"true"` | reject `BOOLEAN_TYPE` |
| `SC-BOOL-03` | number `1` | reject `BOOLEAN_TYPE` |
| `SC-INT-01` | `-9223372036854775808` | accept |
| `SC-INT-02` | `9223372036854775808` | reject `INTEGER_RANGE` |
| `SC-BYTE-01` | 512 bytes | accept |
| `SC-BYTE-02` | 513 bytes | reject `BYTES_LENGTH` |
| `SC-AUX-01` | NFC `café` | accept source key |
| `SC-AUX-02` | control character | reject `SOURCE_AUX_CONTROL` |
| `SC-AUX-03` | empty present auxiliary | reject `SOURCE_AUX_EMPTY` |

## 2. Source-Key Boundary

| ID | Identity | Expected |
|---|---|---|
| `SC-SRC-01` | complete key 361 bytes | accept |
| `SC-SRC-02` | complete key 362 bytes | accept |
| `SC-SRC-03` | complete key 363 bytes | reject `SOURCE_KEY_LENGTH` |
| `SC-SRC-04` | any component max+1 | reject component rule |
| `SC-SRC-05` | NULL auxiliary | accept |
| `SC-SRC-06` | empty auxiliary | reject |
| `SC-SRC-07` | multibyte auxiliary exactly 128 bytes | accept |
| `SC-SRC-08` | multibyte auxiliary 129 bytes | reject |

## 3. StableKey Vectors

`STABLE_KEY_TEST_VECTORS_R3_C6.json` contains the 16 production-domain cases.
All production entries use Registry code 3. Registry code 4 exists only as a
synthetic framing-only inequality vector and must be rejected by the production
parser.

## 4. C6 Snapshot Vector

`C6_SNAPSHOT_VECTOR_01`:

```text
records: 15
length: 4036
SHA-256:
7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB
```

Node and Python complete bytes must match.

