# R6 Basis Limit Accept/Reject Vectors R3-C7

Artifact: `R6_BASIS_LIMIT_ACCEPT_REJECT_VECTORS_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. Machine-Readable Input

```text
basis_limit_vectors_r3_c7.json
```

## 2. Execution

```text
node tools/run_basis_limits_node.js basis_limit_vectors_r3_c7.json
PYTHONDONTWRITEBYTECODE=1 python -B tools/run_basis_limits_python.py basis_limit_vectors_r3_c7.json
node tools/run_basis_limits_parity_check.js
```

## 3. Per-Case Result

| ID | Boundary | Expected | Node | Python | Reason |
|---|---|---|---|---|---|
| `LIM-REC-4096` | records = max | ACCEPT | ACCEPT | ACCEPT | OK |
| `LIM-REC-4097` | records +1 | REJECT | REJECT | REJECT | `BASIS_RECORD_COUNT` |
| `LIM-FIELD-65536` | snapshot fields = max | ACCEPT | ACCEPT | ACCEPT | OK |
| `LIM-FIELD-65537` | snapshot fields +1 | REJECT | REJECT | REJECT | `BASIS_FIELD_COUNT` |
| `LIM-RECORD-FIELDS-32` | record fields = max | ACCEPT | ACCEPT | ACCEPT | OK |
| `LIM-RECORD-FIELDS-33` | record fields +1 | REJECT | REJECT | REJECT | `RECORD_FIELD_COUNT` |
| `LIM-RECORD-BYTES-16874` | record bytes = max | ACCEPT | ACCEPT | ACCEPT | OK |
| `LIM-RECORD-BYTES-16875` | record bytes +1 | REJECT | REJECT | REJECT | `RECORD_BYTES` |
| `LIM-FIELD-BYTES-520` | field bytes = max | ACCEPT | ACCEPT | ACCEPT | OK |
| `LIM-FIELD-BYTES-521` | field bytes +1 | REJECT | REJECT | REJECT | `FIELD_BYTES` |
| `LIM-BODY-16777216` | body = max | ACCEPT | ACCEPT | ACCEPT | OK |
| `LIM-BODY-16777217` | body +1 | REJECT | REJECT | REJECT | `BASIS_BODY_BYTES` |
| `LIM-BASIS-16777244` | total = max | ACCEPT | ACCEPT | ACCEPT | OK |
| `LIM-BASIS-16777245` | total +1 | REJECT | REJECT | REJECT | `BASIS_TOTAL_BYTES` |

## 4. Summary

```text
Vectors: 14
Node failures: 0
Python failures: 0
Node/Python mismatches: 0
Partial Basis produced: 0
Result: PASS
```

## 5. Related Preserved Bounds

Single BYTES 512/513 and SourceKey 362/overflow are executed in the scalar and
SourceKey suites. This suite covers the global resource envelope.

Retained outputs:

```text
evidence/basis-limits-node-r3-c7.json
evidence/basis-limits-python-r3-c7.json
evidence/basis-limits-parity-r3-c7.json
```
