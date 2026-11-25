# SourceKey Real Encoder Boundary Execution R3-C7

Artifact: `SOURCEKEY_REAL_ENCODER_BOUNDARY_EXECUTION_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. Result

```text
SOURCEKEY REAL ENCODER BOUNDARY TEST: PASS
Cases: 19
Node accepted/rejected: 10 / 9
Python accepted/rejected: 10 / 9
Failures: 0
Parity mismatches: 0
Partial SourceKeys: 0
```

## 2. Real Entries

Node:

```text
sourceKey(components)
```

Python:

```text
source_key(components)
```

Both functions are exported by the R3-C7 complete encoders. No validation logic
is duplicated in the runners.

## 3. Boundary Cases

| ID | Boundary | Expected | Output |
|---|---|---|---|
| `SRC-361` | complete 361 bytes | ACCEPT | 361 |
| `SRC-362` | complete 362 bytes | ACCEPT | 362 |
| `SRC-363` | requires 129-byte auxiliary | REJECT | `SOURCE_AUX_LENGTH` |
| `SRC-KIND-MAX` | kind 64 bytes | ACCEPT | equal Node/Python |
| `SRC-KIND-MAX+1` | kind 65 bytes | REJECT | `ASCII_LENGTH` |
| `SRC-TYPE-MAX` | entity type 64 bytes | ACCEPT | equal Node/Python |
| `SRC-TYPE-MAX+1` | entity type 65 bytes | REJECT | `ASCII_LENGTH` |
| `SRC-ID-MAX` | entity ID 64 bytes | ACCEPT | equal Node/Python |
| `SRC-ID-MAX+1` | entity ID 65 bytes | REJECT | `ASCII_LENGTH` |
| `SRC-AUX-128` | auxiliary 128 bytes | ACCEPT | equal Node/Python |
| `SRC-AUX-129` | auxiliary 129 bytes | REJECT | `SOURCE_AUX_LENGTH` |
| `SRC-AUX-NFC` | composed café | ACCEPT | equal bytes |
| `SRC-AUX-NFD` | decomposed café | ACCEPT | equal NFC bytes |
| `SRC-AUX-CONTROL` | C0 control | REJECT | `SOURCE_AUX_CONTROL` |
| `SRC-AUX-INVALID-UTF8` | unpaired surrogate | REJECT | `SOURCE_UTF8_INVALID` |
| `SRC-AUX-NULL` | explicit NULL | ACCEPT | 45-byte sample |
| `SRC-AUX-EMPTY` | empty present | REJECT | `SOURCE_AUX_EMPTY` |
| `SRC-MISSING` | three components | REJECT | `SOURCE_COMPONENT_COUNT` |
| `SRC-MIN-FRAMING` | one-byte component payloads | ACCEPT | 46 bytes |

## 4. Complete-Byte Comparison

For every accepted case the runners compare complete output hex, not only
length or hash. NFD input normalizes to the same complete NFC bytes.

For every rejected case:

- both encoders reject;
- reason codes match;
- output length is zero;
- no partial SourceKey exists.

## 5. Commands

```text
node tools/run_sourcekey_node.js
PYTHONDONTWRITEBYTECODE=1 python -B tools/run_sourcekey_python.py
node tools/run_sourcekey_parity_check.js
```

Retained outputs:

```text
evidence/sourcekey-node-r3-c7.json
evidence/sourcekey-python-r3-c7.json
evidence/sourcekey-parity-r3-c7.json
```

## 6. Preserved Rule

The SourceKey limit remains 362 bytes, and its basis BYTES field still fits
within the 512-byte generic BYTES limit.
