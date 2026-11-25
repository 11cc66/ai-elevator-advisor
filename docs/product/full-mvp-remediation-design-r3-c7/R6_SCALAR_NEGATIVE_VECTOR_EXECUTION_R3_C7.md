# R6 Scalar Negative Vector Execution R3-C7

Artifact: `R6_SCALAR_NEGATIVE_VECTOR_EXECUTION_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. Result

```text
SCALAR NEGATIVE VECTORS: PASS
Node/Python parity: PASS
Vectors: 23
Node failures: 0
Python failures: 0
Parity mismatches: 0
Partial Basis produced: 0
```

## 2. Real Encoder Entries

Node:

```text
tools/r6_encoder_r3_c7.js -> encodeScalar(field)
tools/r6_encoder_r3_c7.js -> validateSourceAux(value)
```

Python:

```text
tools/r6_encoder_r3_c7.py -> encode_scalar(field)
tools/r6_encoder_r3_c7.py -> validate_source_aux(value)
```

The runners invoke those entries. They do not call a duplicate inline validator.

## 3. Executed Cases

| ID | Input class | Expected | Observed |
|---|---|---|---|
| `SC-TXT-01` | TEXT 4,000 scalars | ACCEPT | ACCEPT |
| `SC-TXT-02` | TEXT 4,001 scalars | REJECT | REJECT `TEXT_LENGTH` |
| `SC-TXT-03` | TEXT with NUL | REJECT | REJECT `TEXT_NUL` |
| `SC-DEC-01` | `1.75` | ACCEPT | ACCEPT |
| `SC-DEC-02` | `1e3` | REJECT | REJECT `DECIMAL_GRAMMAR` |
| `SC-DEC-03` | `1.750000` | REJECT | REJECT `DECIMAL_NOT_CANONICAL` |
| `SC-DEC-04` | 19-digit decimal | REJECT | REJECT `DECIMAL_PRECISION` |
| `SC-BOOL-01` | Boolean true | ACCEPT | ACCEPT |
| `SC-BOOL-02` | string `"true"` | REJECT | REJECT `BOOLEAN_TYPE` |
| `SC-BOOL-03` | number 1 | REJECT | REJECT `BOOLEAN_TYPE` |
| `SC-INT-01` | INT64 minimum | ACCEPT | ACCEPT |
| `SC-INT-02` | INT64 max+1 | REJECT | REJECT `INTEGER_RANGE` |
| `SC-BYTE-01` | 512 bytes | ACCEPT | ACCEPT |
| `SC-BYTE-02` | 513 bytes | REJECT | REJECT `BYTES_LENGTH` |
| `SC-AUX-01` | NFC `café` | ACCEPT | ACCEPT |
| `SC-AUX-02` | control character | REJECT | REJECT `SOURCE_AUX_CONTROL` |
| `SC-AUX-03` | empty present auxiliary | REJECT | REJECT `SOURCE_AUX_EMPTY` |
| `C7-DEC-NEG-ZERO` | `-0.00` | REJECT | REJECT `DECIMAL_NEGATIVE_ZERO` |
| `C7-BOOL-NULL` | Boolean null | REJECT | REJECT `BOOLEAN_TYPE` |
| `C7-TEXT-NFD` | non-NFC text | REJECT | REJECT `TEXT_NOT_NFC` |
| `C7-ENUM-65` | ENUM 65 bytes | REJECT | REJECT `ASCII_LENGTH` |
| `C7-BYTES-EMPTY` | BYTES length 0 | REJECT | REJECT `BYTES_EMPTY` |
| `C7-UNKNOWN-TYPE` | unknown FLOAT | REJECT | REJECT `SCALAR_TYPE` |

## 4. Runtime Versions

```text
Node: v24.22.1
Python: 3.15.1
PYTHONDONTWRITEBYTECODE=1
python -B
```

## 5. Failure Atomicity

The runner records `partialBasisProduced=false` only because scalar encoding is
invoked before Basis assembly. Any scalar rejection exits the actual encoding
path before a Basis header/body can be emitted.

## 6. Evidence Commands

```text
node tools/run_scalar_node.js scalar_vectors_r3_c7.json
PYTHONDONTWRITEBYTECODE=1 python -B tools/run_scalar_python.py scalar_vectors_r3_c7.json
node tools/run_scalar_parity_check.js
```

Retained outputs:

```text
evidence/scalar-node-r3-c7.json
evidence/scalar-python-r3-c7.json
evidence/scalar-parity-r3-c7.json
```

## 7. Boundary

This proves offline Node/Python scalar behavior. Database scalar constraints and
NFC behavior remain subject to the separately authorized DB validation plan.
