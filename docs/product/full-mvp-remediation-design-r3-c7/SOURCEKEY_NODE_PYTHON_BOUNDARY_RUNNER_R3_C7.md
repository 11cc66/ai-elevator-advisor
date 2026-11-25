# SourceKey Node/Python Boundary Runner R3-C7

Artifact: `SOURCEKEY_NODE_PYTHON_BOUNDARY_RUNNER_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. Files

```text
tools/r6_encoder_r3_c7.js
tools/r6_encoder_r3_c7.py
tools/run_sourcekey_node.js
tools/run_sourcekey_python.py
tools/run_sourcekey_parity_check.js
```

## 2. Comparison

The runners compare:

| Field | Meaning |
|---|---|
| `expected` | fixture authority |
| `observed` | actual encoder outcome |
| `reason` | standardized reject code |
| `outputLength` | actual complete bytes |
| `outputHex` | complete output for accepted vector |
| `partialSourceKeyProduced` | must be false |
| `result` | per-vector pass/fail |

The parity controller additionally requires equal inventories and the same
Node/Python version-independent result fields.

## 3. Input Construction

The cases are deterministic and in-memory:

- ASCII maxima are 64 single-byte characters;
- auxiliary maxima are 64 two-byte characters;
- 361/362/363 values differ only in auxiliary payload sizes;
- each component max+1 is tested independently;
- NFC and NFD share expected canonical output;
- an unpaired surrogate tests invalid Unicode explicitly.

No generated fixture file or project-root redirect is used.

## 4. Result

```text
19 cases
Node failed: 0
Python failed: 0
Parity mismatches: 0
PASS
```

## 5. Future Regression

The runner is suitable for inclusion in a future non-production CI design
evidence job. It is not a product test and executed no product code.
